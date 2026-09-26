# -*- coding: utf-8 -*-
"""Repo-wide integrity check for learning.recursive.eco. Run before every push.

    python scripts/check_all.py                  everything that needs no rebuild, on a temp _site
    python scripts/check_all.py --check          ... plus: every generated file equals a fresh rebuild
    python scripts/check_all.py --site _site     check an already-assembled site (what CI does)
    python scripts/check_all.py --only theme     one group (repeatable)
    python scripts/check_all.py --allow-pending  files another builder has not delivered yet are
                                                 reported as pending instead of failing

PORTED from recursive-tarot/scripts/check_all.py (its grammar checks and mojibake pattern), then
extended for this repo. Python standard library only; node is used for check-links.mjs and the
As-If check, as in CI. Exits non-zero on any failure and prints `name=N` counts.

Groups:
  grammars    every grammars/*/grammar.json parses, has name + items[]; ids unique, names present;
              composite_of and pills (metadata.source_deck + source_item_id) resolve; generated
              grammars carry their stamps and no whole-card redirect fields
  generated   (--check) each builder runs with --out <temp> and its outputs are diffed byte for byte
  collection  grammars/_collection.json lists every grammar folder, covers present and unique, meta flagged
  sync        recursive-eco.json: channel slug, id_map, generated grammars excluded; .gitattributes LF
  words       each glossary term has a `draw` question and a words-deck item; spreads resolve
  reach       every page is reachable from / (links, the header's menus, the footer, SITE.games,
              the gallery) and loads the header; every ?src= grammar exists
  links       check-links.mjs; scripts/live-urls.txt; the og tags on /
  theme       no tarot gold left; no local colour tokens or dark blocks; theme.css linked; the spiral
              is mark.svg's path; no emoji/dingbats as marks; no mojibake; absolutist phrases (warn)
  privacy     no private lab keys; lab-export records match lab_export.py's ALLOWED_KEYS; no long quotes
  asif        node scripts/check-asif.mjs
"""
import argparse, ast, collections, hashlib, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
GR = ROOT / "grammars"

# ------------------------------------------------------------------------------------------------
# What other builders deliver. A missing entry is PENDING (named with its owner), which fails the
# run unless --allow-pending. Paths are repo-relative.
GENERATED = {
    # output                                          builder                                  owner
    "grammars/institutions-of-alignment/grammar.json": ("scripts/build_institutions_grammar.py", "B3 institutions"),
    "grammars/sources-of-alignment/grammar.json":      ("scripts/build_sources_grammar.py",      "B2 lab data"),
    "grammars/ideas-of-alignment/grammar.json":        ("scripts/build_ideas_grammar.py",        "B2 lab data"),
    "grammars/words-deck/grammar.json":                ("scripts/build_words_deck.py",           "B4 words"),
    "site/viewers/spreads.json":                       ("scripts/build_words_deck.py",           "B4 words"),
    "grammars/all-decks/grammar.json":                 ("scripts/build_meta_grammar.py",         "B3 collection"),
    "grammars/_collection.json":                       ("scripts/build_collection.py",           "B3 collection"),
    "grammars/_covers/":                               ("scripts/build_collection.py",           "B3 collection"),
    "glossary/index.html":                             ("scripts/build-glossary.mjs",            "B4 words"),
}
GENERATED_GRAMMARS = [p for p in GENERATED if p.startswith("grammars/") and p.endswith("/grammar.json")]
HAND_WRITTEN = {
    "game/as-if.html": "B5 As-If", "game/as-if-engine.js": "B5 As-If", "scripts/check-asif.mjs": "B5 As-If",
    "glossary/spreads.src.json": "B4 words", "site/viewers/voices.json": "B4 words",
    "scripts/lab_export.py": "B2 lab data", "research/lab-export/sources.json": "B2 lab data",
    "research/lab-export/ideas.json": "B2 lab data", "research/crosswalk.json": "B2 lab data",
    "research/institutions/institutions.json": "B3 institutions",
    "scripts/lib_grammar.py": "integrator", "scripts/build_all.py": "integrator",
}
# which grammar a site path belongs to, for pending-aware link checks
def owner_of(path):
    """The builder that owes a repo path or a site path (/viewers/x lives at site/viewers/x), or None."""
    path = path.lstrip("/")
    for cand in (path, "site/" + path):
        for p, (_, owner) in GENERATED.items():
            if cand == p or (p.endswith("/") and cand.startswith(p)):
                return owner
        if cand in HAND_WRITTEN:
            return HAND_WRITTEN[cand]
    return None

# ------------------------------------------------------------------------------------------------
errors, warnings, pending = [], [], {}
counts = collections.OrderedDict()

def err(group, msg):  errors.append(f"[{group}] {msg}")
def warn(group, msg): warnings.append(f"[{group}] {msg}")
def pend(what, owner): pending.setdefault(what, owner)
def count(name, n):   counts[name] = counts.get(name, 0) + n

def rel(p): return Path(p).resolve().relative_to(ROOT).as_posix()
def read(p): return Path(p).read_text(encoding="utf-8")
def load(p): return json.loads(read(p))

# UTF-8 decoded as Latin-1 / CP1252 (tarot's pattern), plus U+FFFD.
MOJIBAKE_RE = re.compile(
    "[ÂÃâ]"
    "[\u0080-¿"
    "€‚ƒ„…†‡ˆ‰Š‹Œ"
    "Ž‘’“”•–—˜™š›"
    "œžŸ]"
    "|�"
)

# ================================================================================ grammars
def check_grammars():
    g_all = {}
    dangling = 0
    for path in sorted(GR.glob("*/grammar.json")):
        slug = path.parent.name
        raw = read(path)
        for m in MOJIBAKE_RE.finditer(raw):
            err("grammars", f"{slug}: mojibake {m.group(0)!r} near {raw[max(0, m.start()-30):m.end()+30]!r}")
        try:
            g = json.loads(raw)
        except Exception as e:
            err("grammars", f"{slug}: invalid JSON: {e}"); continue
        g_all[slug] = g
    for slug, g in g_all.items():
        generated = f"grammars/{slug}/grammar.json" in GENERATED_GRAMMARS
        if not g.get("name"): err("grammars", f"{slug}: missing name")
        items = g.get("items")
        if not isinstance(items, list) or not items:
            err("grammars", f"{slug}: items[] missing or empty"); continue
        ids = [it.get("id") for it in items]
        for k, v in collections.Counter(ids).items():
            if not k: err("grammars", f"{slug}: {v} item(s) without an id")
            elif v > 1: err("grammars", f"{slug}: duplicate item id {k!r} (x{v})")
        for it in items:
            if not it.get("name"): err("grammars", f"{slug}: item {it.get('id')!r} has no name")
        idset = set(ids)
        for it in items:
            for c in it.get("composite_of") or []:
                if c not in idset:
                    dangling += 1; err("grammars", f"{slug}: dangling composite_of {c!r} in {it.get('id')!r}")
            md = it.get("metadata") or {}
            sd, si = md.get("source_deck"), md.get("source_item_id")
            if sd or si:
                if not (sd and si):
                    dangling += 1; err("grammars", f"{slug}: half a pill on {it.get('id')!r} (source_deck and source_item_id go together)")
                elif sd not in g_all:
                    o = owner_of(f"grammars/{sd}/grammar.json")
                    if o: pend(f"grammars/{sd}/grammar.json (pill target from {slug})", o)
                    else: dangling += 1; err("grammars", f"{slug}: pill on {it.get('id')!r} -> unknown grammar {sd!r}")
                elif si not in {x.get("id") for x in g_all[sd].get("items", [])}:
                    dangling += 1; err("grammars", f"{slug}: pill on {it.get('id')!r} -> no item {si!r} in {sd}")
            if generated:
                for k in (it.get("sections") or {}):
                    if k.strip().lower() in ("link", "url"):
                        err("grammars", f"{slug}: item {it.get('id')!r} has a section named {k!r}; cards.html turns it into a whole-card redirect")
                if "youtube_url" in md:
                    err("grammars", f"{slug}: item {it.get('id')!r} sets metadata.youtube_url (a whole-card redirect); use youtube_video_id")
                if "url" in md and slug != "institutions-of-alignment":
                    err("grammars", f"{slug}: item {it.get('id')!r} sets metadata.url; only institutions link out whole-card")
        if generated:
            for k in ("_generated", "_do_not_hand_edit", "_source_of_truth", "_built_by", "_inputs_sha256",
                      "_grammar_commons", "creator_name"):
                if k not in g: err("grammars", f"{slug}: generated grammar lacks {k}")
            if g.get("_generated") is not True: err("grammars", f"{slug}: _generated must be true (the app's sync skips on it)")
            if "_inputs_sha256" in g and not re.fullmatch(r"[0-9a-f]{64}", str(g["_inputs_sha256"])):
                err("grammars", f"{slug}: _inputs_sha256 is not a sha256 hex digest")
            if "_built_at" in g: err("grammars", f"{slug}: _built_at is a wall-clock stamp; a rebuild must be byte-identical")
            gc = g.get("_grammar_commons") or {}
            if gc and gc.get("license") != "CC-BY-SA-4.0": err("grammars", f"{slug}: _grammar_commons.license must be CC-BY-SA-4.0")
            if g.get("creator_name") not in (None, "PlayfulProcess"): err("grammars", f"{slug}: creator_name must be PlayfulProcess")
    for p in GENERATED_GRAMMARS:
        if not (ROOT / p).exists():
            pend(p, GENERATED[p][1])
    count("grammars", len(g_all)); count("dangling", dangling)
    return g_all

# ================================================================================ generated
def check_generated():
    by_builder = collections.OrderedDict()
    for out, (builder, owner) in GENERATED.items():
        by_builder.setdefault(builder, (owner, []))[1].append(out)
    stale = 0
    for builder, (owner, outs) in by_builder.items():
        bpath = ROOT / builder
        present = [o for o in outs if (ROOT / o).exists()]
        if not bpath.exists():
            for o in outs:
                if (ROOT / o).exists() and not _is_placeholder(ROOT / o):
                    err("generated", f"{o} exists but its builder {builder} does not")
            pend(f"{builder} (writes {', '.join(outs)})", owner); continue
        if "--out" not in read(bpath):
            pend(f"{builder} takes no --out yet, so its outputs cannot be checked for currency", owner); continue
        with tempfile.TemporaryDirectory(prefix="check_all_") as tmp:
            cmd = ([sys.executable] if builder.endswith(".py") else ["node"]) + [str(bpath), "--out", tmp]
            env = dict(os.environ, PYTHONUTF8="1")
            r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
            if r.returncode != 0:
                err("generated", f"{builder} --out failed:\n{(r.stdout + r.stderr).strip()[:1500]}"); continue
            for o in outs:
                a, b = Path(tmp) / o, ROOT / o
                if o.endswith("/"):
                    fa = {p.relative_to(a).as_posix(): p for p in a.rglob("*") if p.is_file()} if a.exists() else {}
                    fb = {p.relative_to(b).as_posix(): p for p in b.rglob("*") if p.is_file()} if b.exists() else {}
                    for k in sorted(set(fa) | set(fb)):
                        if k not in fb: stale += 1; err("generated", f"{o}{k}: built but not committed")
                        elif k not in fa: stale += 1; err("generated", f"{o}{k}: committed but no longer built")
                        elif fa[k].read_bytes() != fb[k].read_bytes(): stale += 1; err("generated", f"{o}{k}: stale (rebuild and commit)")
                    continue
                if not a.exists(): err("generated", f"{builder} --out did not write {o}"); continue
                if not b.exists(): stale += 1; err("generated", f"{o}: built but not committed"); continue
                if a.read_bytes() != b.read_bytes():
                    stale += 1; err("generated", f"{o}: stale; the committed file differs from a fresh `{builder}` (rebuild and commit)")
    count("stale", stale)

def _is_placeholder(p):
    try:
        return p.suffix == ".json" and "_placeholder" in load(p)
    except Exception:
        return False

# ================================================================================ collection
def check_collection(g_all):
    p = GR / "_collection.json"
    if not p.exists():
        pend("grammars/_collection.json", GENERATED["grammars/_collection.json"][1]); return
    c = load(p)
    entries = c.get("grammars") or []
    listed = {e.get("slug") for e in entries}
    folders = {q.parent.name for q in GR.glob("*/grammar.json")}
    for s in sorted(folders - listed): err("collection", f"grammar folder {s!r} is not in _collection.json")
    for s in sorted(listed - folders): err("collection", f"_collection.json lists {s!r}, which has no grammars/{s}/grammar.json")
    covers = collections.Counter()
    for e in entries:
        if e.get("is_meta"): continue
        cov = e.get("cover_image_url")
        if not cov: err("collection", f"{e.get('slug')}: no cover_image_url (it would drop out of the home gallery)"); continue
        covers[cov] += 1
        if not re.match(r"^[a-z]+:", cov):   # a repo-relative cover must exist
            if not (ROOT / cov.lstrip("/")).exists() and not (ROOT / "site" / cov.lstrip("/")).exists():
                err("collection", f"{e.get('slug')}: cover {cov!r} does not exist")
        if e.get("provenance") not in ("living", "record", "reference"):
            err("collection", f"{e.get('slug')}: provenance {e.get('provenance')!r} is not living / record / reference")
    for cov, n in covers.items():
        if n > 1: err("collection", f"cover used {n} times on the home page: {cov}")
    meta = [e for e in entries if e.get("slug") == "all-decks"]
    if meta and not meta[0].get("is_meta"): err("collection", "all-decks must be is_meta")
    if (GR / "all-decks" / "grammar.json").exists() and "_decks" not in g_all.get("all-decks", {}):
        err("collection", "all-decks has no _decks (RefResolve and the caster read it)")
    count("collection", len(entries))

# ================================================================================ sync
def check_sync():
    m = load(ROOT / "recursive-eco.json")
    if (m.get("channel") or {}).get("slug") != "recursive-learning": err("sync", "recursive-eco.json channel.slug must be recursive-learning")
    idm = (m.get("grammars") or {}).get("id_map")
    if not idm or not (ROOT / idm).exists(): err("sync", f"recursive-eco.json grammars.id_map {idm!r} does not exist")
    exc = set((m.get("grammars") or {}).get("exclude") or [])
    for p in GENERATED_GRAMMARS:
        if p not in exc: err("sync", f"recursive-eco.json grammars.exclude lacks {p}")
    ga = read(ROOT / ".gitattributes")
    if not re.search(r"^\*\s+text=auto\s+eol=lf", ga, re.M): err("sync", ".gitattributes no longer forces LF (the app compares bytes)")

# ================================================================================ words
def check_words(g_all):
    if not (ROOT / "scripts/build_words_deck.py").exists():
        pend("words: glossary `draw` questions, words-deck items, spreads.src.json", "B4 words"); return
    t = load(ROOT / "glossary/terms.json")
    deck = g_all.get("words-deck")
    deck_ids = {i.get("id") for i in (deck or {}).get("items", [])}
    for term in t.get("terms", []):
        q = (term.get("draw") or "").strip()
        if not q: err("words", f"term {term['id']!r} has no `draw` question")
        elif len(q.split()) > 20: err("words", f"term {term['id']!r}: `draw` is {len(q.split())} words (20 or fewer)")
        if deck is not None and term["id"] not in deck_ids: err("words", f"term {term['id']!r} has no words-deck item")
    count("terms", len(t.get("terms", [])))
    sp = ROOT / "glossary/spreads.src.json"
    if sp.exists():
        ids = {x["id"] for x in t.get("terms", [])}
        for s in load(sp).get("spreads", []):
            for pos in s.get("positions", []):
                if pos.get("term_id") and pos["term_id"] not in ids: err("words", f"spread {s.get('id')}: term_id {pos['term_id']!r} is not a glossary term")
                for k in ("x", "y"):
                    if k in pos and not (0 <= float(pos[k]) <= 1): err("words", f"spread {s.get('id')}: {k}={pos[k]} is outside [0,1]")
    em = ROOT / "glossary/emblems"
    if em.exists():
        ink = re.search(r"--ink:\s*(#[0-9a-fA-F]{3,6})", read(ROOT / "site/theme.css")).group(1).lower()
        for f in sorted(em.glob("*.svg")):
            s = read(f)
            if 'viewBox="0 0 24 24"' not in s: err("words", f"{rel(f)}: viewBox must be 0 0 24 24")
            if "currentColor" not in s: err("words", f"{rel(f)}: strokes must be currentColor")
            mcol = re.search(r'<svg[^>]*\scolor="([^"]+)"', s)
            if not mcol or mcol.group(1).lower() != ink: err("words", f"{rel(f)}: root color must equal theme.css --ink {ink}")
            if re.search(r"<(style|script|animate|image|text)\b", s, re.I): err("words", f"{rel(f)}: no style, script, animate, image or text")

# ================================================================================ site assembly
def assemble(out):
    out = Path(out)
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    for line in read(ROOT / "scripts/site-folders.txt").splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        src, dest = line.split()
        s = ROOT / (src[:-2] if src.endswith("/.") else src)
        if dest == "/":
            shutil.copytree(s, out, dirs_exist_ok=True)
        else:
            shutil.copytree(s, out / dest, dirs_exist_ok=True)
    (out / ".nojekyll").touch()
    return out

# ================================================================================ reach
HREF_RE = re.compile(r"""\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')""", re.I)

def visible(html):
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    html = re.sub(r"<script\b[^>]*>.*?</script>", lambda m: re.match(r"<script\b[^>]*>", m.group(0), re.I).group(0), html, flags=re.S | re.I)
    return re.sub(r"<style\b.*?</style>", "", html, flags=re.S | re.I)

def site_target(site, path):
    p = unquote(path)
    f = site.joinpath(*[x for x in p.split("/") if x])
    if p.endswith("/") or p == "" or f.is_dir():
        f = f / "index.html"
    return f if f.exists() else None

def resolve_url(page_url, ref):
    """page_url: '/viewers/cards.html'. Returns (path, query, fragment) or None for external."""
    ref = ref.strip().replace("&amp;", "&")
    if not ref or ref.startswith(("mailto:", "javascript:", "data:", "tel:")): return None
    live = re.match(r"^https?://learning\.recursive\.eco(/.*)?$", ref, re.I)
    if live: ref = live.group(1) or "/"
    elif re.match(r"^[a-z][a-z0-9+.-]*:", ref, re.I) or ref.startswith("//"): return None
    base = page_url.rsplit("/", 1)[0] + "/"
    u = urlsplit(ref)
    if u.path.startswith("/"): path = u.path
    elif u.path == "": path = page_url
    else:
        parts = (base + u.path).split("/")
        stack = []
        for x in parts:
            if x == "..":
                if stack and stack[-1] != "": stack.pop()
            elif x != ".": stack.append(x)
        path = "/".join(stack)
        if not path.startswith("/"): path = "/" + path
    return path, u.query, u.fragment

def node_json(code):
    r = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0: raise RuntimeError(r.stderr.strip()[:800])
    return json.loads(r.stdout)

def header_menu_urls(site):
    """Evaluate the site map block of site-header.js in node (with PFX '/') and return every href."""
    src = read(site / "site-header.js")
    m = re.search(r"// ---- the site map \(content\) ----\n(.*?)\n  const KEYS = ", src, re.S)
    if not m:
        err("reach", "site-header.js: cannot find the site map block (// ---- the site map (content) ---- ... const KEYS)"); return []
    block = m.group(1)
    names = re.findall(r"const ([A-Z_]+) = \[", block)
    js = "const PFX='/';\n" + block + "\nconsole.log(JSON.stringify({" + ",".join(names) + "}));"
    try:
        menus = node_json(js)
    except Exception as e:
        err("reach", f"site-header.js menus did not evaluate: {e}"); return []
    urls = []
    for name, arr in menus.items():
        for row in arr:
            href = row[2] if name == "TOOLS" else row[0]
            urls.append((f"site-header.js {name}", href))
    consts = dict(re.findall(r"const ([A-Z]+) = '([^']*)';", block))
    for h in re.findall(r'href="\$\{PFX\}([^"]*)"', src):
        h = re.sub(r"\$\{([A-Z]+)\}", lambda mm: consts.get(mm.group(1), ""), h)
        urls.append(("site-header.js pill", "/" + h))
    return urls, menus

def footer_urls(site):
    src = read(site / "site-footer.js")
    return [("site-footer.js", "/" + h) for h in re.findall(r"PFX\+'([^'\"]+)", src)]

def nav_games():
    return node_json("const n=require('./shared/nav.js');console.log(JSON.stringify(n.SITE.games));")

def check_reach(site, g_all):
    allow = {}
    af = ROOT / "scripts/reachability-allow.txt"
    if af.exists():
        for line in read(af).splitlines():
            line = line.strip()
            if not line or line.startswith("#"): continue
            parts = line.split(None, 2)
            allow.setdefault(parts[0], set()).add(parts[1])
    seeds = [("home", "/index.html")]
    hm = header_menu_urls(site)
    menus = {}
    if hm:
        urls, menus = hm
        seeds += urls
    seeds += footer_urls(site)
    try:
        games = nav_games()
    except Exception as e:
        err("reach", f"shared/nav.js did not load in node: {e}"); games = []
    for g in games:
        seeds.append(("nav.js SITE.games", "/" + g["href"]))
        for v in g.get("views") or []: seeds.append(("nav.js views", "/" + v["href"]))
    cp = GR / "_collection.json"
    if cp.exists():
        for e in load(cp).get("grammars", []):
            if not e.get("is_meta"):
                seeds.append(("gallery", f"/viewers/cards.html?src=../grammars/{e['slug']}/grammar.json"))
    # the games list must agree with the header's Games menu and the Play hub
    play_menu = {h.lstrip("/") for h, *_ in menus.get("PLAY_MENU", []) if h.lstrip("/").startswith("game/")}
    game_hrefs = {h for g in games for h in [g["href"]] + [v["href"] for v in g.get("views") or []]}
    for h in sorted(play_menu - game_hrefs): err("reach", f"site-header.js Games menu has {h}, which shared/nav.js SITE.games lacks")
    play = site / "pages/play.html"
    if play.exists():
        ph = read(play)
        for g in games:
            for h in [g["href"]] + [v["href"] for v in g.get("views") or []]:
                if f'"../{h}"' not in ph: err("reach", f"pages/play.html does not link {h} (a game in shared/nav.js)")

    reached, queue, n_links, missing_src = set(), [], 0, 0
    def visit(origin, url, page_url="/index.html"):
        nonlocal n_links, missing_src
        r = resolve_url(page_url, url)
        if not r: return
        path, query, frag = r
        n_links += 1
        f = site_target(site, path)
        if not f:
            o = owner_of(path)
            if o: pend(path, o)
            else: err("reach", f"{origin}: {url} -> {path} does not exist")
            return
        for k, vals in parse_qs(query).items():
            if k != "src": continue
            for v in vals:
                rr = resolve_url(path if path.endswith(".html") else path + "index.html", v)
                if not rr: continue
                if not site_target(site, rr[0]):
                    o = owner_of(rr[0])
                    if o: pend(rr[0], o)
                    else: missing_src += 1; err("reach", f"{origin}: ?src={v} -> {rr[0]} does not exist")
        if f.suffix == ".html":
            key = f.relative_to(site).as_posix()
            if key not in reached:
                reached.add(key); queue.append(key)
    for origin, u in seeds: visit(origin, u)
    while queue:
        key = queue.pop()
        html = read(site / key)
        for m in HREF_RE.finditer(visible(html)):
            visit(key, m.group(3) if m.group(3) is not None else m.group(4), "/" + key)
    unreachable = 0
    for f in sorted(site.rglob("*.html")):
        key = f.relative_to(site).as_posix()
        kinds = allow.get(key, set())
        if key not in reached and not kinds & {"unreachable", "redirect"}:
            unreachable += 1; err("reach", f"{key} is reachable from no link, menu or gallery (or list it in scripts/reachability-allow.txt with a reason)")
        html = read(f)
        if not kinds & {"no-header", "redirect"} and "<site-header" not in html and "shared/nav.js" not in html:
            err("reach", f"{key} loads neither <site-header> nor shared/nav.js")
    count("links_followed", n_links); count("unreachable", unreachable); count("missing_src", missing_src)

# ================================================================================ links
def check_links(site):
    missing = sorted("/" + p for p in list(GENERATED) + list(HAND_WRITTEN) if not (ROOT / p).exists() and not p.endswith("/"))
    cmd = ["node", str(ROOT / "scripts/check-links.mjs"), str(site), "--repo", str(ROOT)]
    if ARGS.allow_pending and missing:
        cmd += ["--allow-missing", ",".join(x.replace("/site/", "/", 1) if x.startswith("/site/") else x for x in missing)]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (r.stdout + r.stderr).strip()
    print("  " + out.replace("\n", "\n  "))
    if r.returncode != 0: err("links", "check-links.mjs failed (above)")
    live = ROOT / "scripts/live-urls.txt"
    n = 0
    for line in read(live).splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        n += 1
        path, _, frag = line.partition("#")
        f = site_target(site, path)
        if not f:
            o = owner_of(path)
            if o: pend(path, o)
            else: err("links", f"live URL {line} no longer exists")
            continue
        if frag and not re.search(r"""\s(?:id|name)\s*=\s*["']""" + re.escape(frag) + r"""["']""", read(f)):
            err("links", f"live URL {line}: no id={frag!r} in {f.relative_to(site).as_posix()}")
    count("live_urls", n)
    home = read(site / "index.html")
    for tag in ("og:title", "og:description", "og:type", "og:url"):
        if f'property="{tag}"' not in home: err("links", f"/ lost its {tag} tag")

# ================================================================================ theme & hygiene
OLD_GOLD = re.compile(r"#9a7322|#7c5b18|#b8902f|#8a6414|#c4ad7a|#faf3e6|rgba\(\s*154\s*,\s*115\s*,\s*34", re.I)
COLOR_TOKENS = ['bg','surface','panel','panel2','card','paper','chip','thumb-bg','stage','felt',
 'grammar-bg-light','grammar-bg-dark','tree-bg','tree-bg-light','ink','ink-soft','ink-strong',
 'mut','muted','faint','fg','text','grammar-text','grammar-text-muted','tree-text','tree-text-muted',
 'line','line-soft','chipline','tree-line','gold','accent','accent2','violet','grammar-accent',
 'grammar-accent-dark','tree-accent','roots','occult','native','myriads','strings','tens','sui',
 'cash','a','b','c','good','win','us','bad','lose','later']
TOKEN_DEF = re.compile(r"--(?:" + "|".join(map(re.escape, sorted(COLOR_TOKENS, key=len, reverse=True))) + r")(?![a-z0-9-])\s*:")
TAROT_PATH = re.compile(r"(\.\./|PFX\s*\+\s*'|\$\{PFX\})tarot/|tarot\\/|all-decks-many-lenses|tarot/_(eco_ids|collection)")
EMOJI = re.compile("[\U0001F000-\U0010FFFF☀-➿️]")
# functional glyphs the copied viewers use, per file (not marks): close buttons, trigram data
GLYPHS_OK = {
    "site/viewers/cards.html": set("☰☱☲☳☴☵☶☷☯♈"),   # I Ching trigrams / type fallbacks, never shown for these grammars
    "site/viewers/explorer.html": set("✕"),
    "site/viewers/caster-studio.html": set("✕"),
}
ABSOLUTIST = re.compile(r"\b(the only|always|never|proves?)\b", re.I)

def mark_path():
    return re.search(r'<symbol id="spiral"[^>]*>\s*<path d="([^"]+)"', read(ROOT / "scripts/mark.svg")).group(1)

def check_theme():
    site_files = [p for p in (ROOT / "site").rglob("*") if p.is_file()]
    glossary = [p for p in (ROOT / "glossary").rglob("*") if p.is_file()]
    asif = list((ROOT / "game").glob("as-if*"))
    gold_n = 0
    for p in site_files + glossary + asif:
        if p.suffix not in (".html", ".js", ".css", ".json", ".svg"): continue
        for m in OLD_GOLD.finditer(read(p)):
            gold_n += 1; err("theme", f"{rel(p)}: tarot gold {m.group(0)} (run python scripts/apply_theme.py)")
    count("old_gold", gold_n)
    for p in site_files:
        if p.suffix in (".html", ".js") and TAROT_PATH.search(read(p)):
            err("theme", f"{rel(p)}: a tarot/ path or the all-decks-many-lenses slug is left ({TAROT_PATH.search(read(p)).group(0)})")
    # one theme source: every page links theme.css; no local colour tokens; no dark blocks
    pages = [p for p in site_files if p.suffix == ".html"] + [ROOT / "glossary/index.html"] + [p for p in asif if p.suffix == ".html"]
    for p in pages:
        if not p.exists(): continue
        html = read(p)
        r = rel(p)
        redirect = "location.replace(" in html and len(html) < 3000
        glossary_pending = r == "glossary/index.html" and "theme.css" not in html
        if glossary_pending:
            pend("glossary/index.html relit on theme.css (build-glossary.mjs)", "B4 words"); continue
        if "theme.css" not in html: err("theme", f"{r}: does not link theme.css")
        styles = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S | re.I))
        if re.search(r"prefers-color-scheme", styles): err("theme", f"{r}: has a prefers-color-scheme block (light only)")
        for m in TOKEN_DEF.finditer(styles):
            err("theme", f"{r}: declares colour token {m.group(0)} locally (theme.css owns colour)")
    # the spiral: every copy is mark.svg's path
    d = mark_path()
    spiral_files = [ROOT / "site/site-header.js", ROOT / "site/site-footer.js", ROOT / "site/spiral.svg"]
    if (ROOT / "scripts/lib_grammar.py").exists(): spiral_files.append(ROOT / "scripts/lib_grammar.py")
    spirals = 0
    for p in site_files + [ROOT / "shared/nav.js", ROOT / "scripts/lib_grammar.py"]:
        if not p.exists() or p.suffix not in (".js", ".html", ".svg", ".py", ".css"): continue
        t = read(p)
        if "M50.60 50.00 L50.61" in t: err("theme", f"{rel(p)}: carries tarot's footer spiral, not her mark")
        for m in re.finditer(r"M50\.5 50L[0-9., ]+", t):
            spirals += 1
            if m.group(0).strip() != d: err("theme", f"{rel(p)}: a spiral path that is not scripts/mark.svg's")
    for p in spiral_files[:3]:
        if d not in read(p): err("theme", f"{rel(p)}: does not carry the spiral from scripts/mark.svg")
    count("spirals", spirals)
    # emoji / dingbats as marks, mojibake
    scan = [p for p in site_files if p.suffix in (".html", ".js", ".css", ".json", ".svg")]
    scan += [p for p in glossary if p.suffix in (".html", ".json")] + [ROOT / "shared/nav.js"] + asif
    scan += [ROOT / g for g in GENERATED_GRAMMARS if (ROOT / g).exists()]
    emoji_n = 0
    for p in scan:
        t = read(p); r = rel(p)
        ok = GLYPHS_OK.get(r, set())
        bad = collections.Counter(ch for ch in EMOJI.findall(t) if ch not in ok)
        for ch, n in bad.items():
            emoji_n += n; err("theme", f"{r}: {n}x {ch!r} (U+{ord(ch):04X}); no emoji or dingbats as marks")
        for m in MOJIBAKE_RE.finditer(t):
            err("theme", f"{r}: mojibake {m.group(0)!r}")
    count("emoji", emoji_n)
    # absolutist phrases in authored prose: a warning list for a human to read
    prose = [ROOT / "site/index.html", ROOT / "site/404.html", ROOT / "site/map/index.html"] + list((ROOT / "site/pages").glob("*.html"))
    for p in prose:
        if not p.exists(): continue
        text = re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)\b.*?</\1>|<!--.*?-->", " ", read(p), flags=re.S | re.I))
        for m in ABSOLUTIST.finditer(text):
            warn("theme", f"{rel(p)}: absolutist phrase {m.group(0)!r}: …{text[max(0, m.start()-50):m.end()+50].strip()}…")
    for g in GENERATED_GRAMMARS:
        if (ROOT / g).exists():
            for m in ABSOLUTIST.finditer(load(ROOT / g).get("description") or ""):
                warn("theme", f"{g}: description has {m.group(0)!r}")
    tj = load(ROOT / "glossary/terms.json")
    for t in tj.get("terms", []):
        for m in ABSOLUTIST.finditer(t.get("draw") or ""):
            warn("theme", f"glossary/terms.json {t['id']}: draw has {m.group(0)!r}")
    vj = ROOT / "site/viewers/voices.json"
    if vj.exists():
        si = json.dumps(load(vj).get("shared_intention") or {}, ensure_ascii=False)
        for m in ABSOLUTIST.finditer(si): warn("theme", f"voices.json shared_intention has {m.group(0)!r}")

# ================================================================================ privacy
PRIVATE_KEY = re.compile(r"^(stance.*|.*owner_film.*|writer_.*|fit_with_.*|sentence|consistency|recursive_grammar_id|searched_none_found)$")
QUOTE = re.compile(r"[“\"]([^”\"]{40,})[”\"]")

def walk_keys(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield path + "/" + str(k), k, v
            yield from walk_keys(v, path + "/" + str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_keys(v, f"{path}[{i}]")

def check_privacy():
    lab_files = sorted((ROOT / "research/lab-export").glob("*.json")) if (ROOT / "research/lab-export").exists() else []
    targets = [(p, load(p), True) for p in lab_files]
    for g in GENERATED_GRAMMARS:
        if (ROOT / g).exists():
            lab = "sources-of-alignment" in g or "ideas-of-alignment" in g
            targets.append((ROOT / g, load(ROOT / g), lab))
    hits = 0
    for p, data, lab in targets:
        for path, k, v in walk_keys(data):
            if PRIVATE_KEY.match(str(k)) or (lab and k == "note" and "/_grammar_commons/" not in path):
                hits += 1; err("privacy", f"{rel(p)}: private key {path}")
            if lab and isinstance(v, str):
                for m in QUOTE.finditer(v):
                    if len(m.group(1).split()) > 20:
                        hits += 1; err("privacy", f"{rel(p)}: a quotation over 20 words at {path}")
    le = ROOT / "scripts/lab_export.py"
    if lab_files and not le.exists(): err("privacy", "research/lab-export/ exists but scripts/lab_export.py does not")
    if le.exists():
        allowed = None
        for node in ast.walk(ast.parse(read(le))):
            if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "ALLOWED_KEYS" for t in node.targets):
                try: allowed = ast.literal_eval(node.value)
                except Exception: pass
        if not isinstance(allowed, dict):
            err("privacy", "scripts/lab_export.py must declare ALLOWED_KEYS as a literal dict {record kind or file name: [keys]}")
        else:
            for p in lab_files:
                data = load(p)
                recs = [r for _, _, v in walk_keys(data) if isinstance(v, list) for r in v if isinstance(r, dict)]
                for r in recs:
                    kind = r.get("kind")
                    spec = allowed.get(kind) if kind in allowed else allowed.get(p.name)
                    if spec is None: continue
                    if set(r) != set(spec):
                        hits += 1; err("privacy", f"{rel(p)}: record {r.get('id', '?')} keys {sorted(set(r) ^ set(spec))} differ from ALLOWED_KEYS[{kind or p.name!r}]")
    elif not lab_files:
        pend("scripts/lab_export.py + research/lab-export/ (privacy allow-list)", "B2 lab data")
    count("private_hits", hits)

# ================================================================================ asif
def check_asif():
    s = ROOT / "scripts/check-asif.mjs"
    if not s.exists(): pend("scripts/check-asif.mjs", "B5 As-If"); return
    r = subprocess.run(["node", str(s)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print("  " + (r.stdout + r.stderr).strip().replace("\n", "\n  "))
    if r.returncode != 0: err("asif", "check-asif.mjs failed (above)")

# ================================================================================ main
GROUPS = ["grammars", "generated", "collection", "sync", "words", "reach", "links", "theme", "privacy", "asif"]

def main():
    global ARGS
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--site", help="an assembled site to check (default: assemble a temp one from scripts/site-folders.txt)")
    ap.add_argument("--check", action="store_true", help="also rebuild every generated file into a temp folder and diff it")
    ap.add_argument("--only", action="append", choices=GROUPS, help="run one group (repeatable)")
    ap.add_argument("--allow-pending", action="store_true", help="report other builders' missing files as pending, not failures")
    ARGS = ap.parse_args()
    want = set(ARGS.only or GROUPS)
    if "generated" in want and not ARGS.check and not ARGS.only: want.discard("generated")
    tmp = None
    site = Path(ARGS.site).resolve() if ARGS.site else None
    if want & {"reach", "links"} and site is None:
        tmp = tempfile.mkdtemp(prefix="rl_site_")
        site = assemble(Path(tmp) / "_site")
    try:
        g_all = {}
        if want & {"grammars", "collection", "words", "reach"}:
            print("== grammars"); g_all = check_grammars()
        if "generated" in want: print("== generated (rebuild into a temp folder and diff)"); check_generated()
        if "collection" in want: print("== collection"); check_collection(g_all)
        if "sync" in want: print("== sync"); check_sync()
        if "words" in want: print("== words"); check_words(g_all)
        if "reach" in want: print("== reach"); check_reach(site, g_all)
        if "links" in want: print("== links"); check_links(site)
        if "theme" in want: print("== theme"); check_theme()
        if "privacy" in want: print("== privacy"); check_privacy()
        if "asif" in want: print("== asif"); check_asif()
    finally:
        if tmp: shutil.rmtree(tmp, ignore_errors=True)

    print("\n" + "  ".join(f"{k}={v}" for k, v in counts.items()) + f"  pending={len(pending)}")
    for w in warnings: print("WARN:", w)
    if pending:
        print(f"\nPENDING ({len(pending)}), waiting on another builder:")
        for what, owner in sorted(pending.items(), key=lambda kv: (kv[1], kv[0])):
            print(f"  - [{owner}] {what}")
        if not ARGS.allow_pending:
            errors.append(f"{len(pending)} pending item(s); pass --allow-pending while other builders' work has not landed")
    if errors:
        print(f"\nFAIL: {len(errors)} error(s):")
        for e in errors: print("  -", e)
        sys.exit(1)
    print("\nOK: all checks passed" + (" (with pending items allowed)" if pending else ""))

ARGS = None
if __name__ == "__main__":
    main()
