#!/usr/bin/env python3
"""Writes sitemap.xml and robots.txt, and keeps every public page's head honest for search.

    python scripts/build_sitemap.py          # write sitemap.xml, robots.txt, and add any missing head tags
    python scripts/build_sitemap.py --check  # fail if anything would change, or a title/description repeats

A page is public when it is an .html file outside the shells listed in EXCLUDE (query-driven viewers,
404s, anything marked noindex). Head tags are only ever ADDED, never rewritten: a page that already
has a <title>, meta description, canonical or og:* tag keeps it. A missing description is taken from
the page's own first paragraph, a missing title from its <h1>; nothing is invented. Canonical and
og:url are the page's URL on HOST. sitemap.xml carries no <lastmod> (an unreliable one is worse than none).
"""
import html, pathlib, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = pathlib.Path(__file__).resolve().parent.parent
CHECK = "--check" in sys.argv

# ---- per-repo settings -------------------------------------------------------------------------
HOST = "https://learning.recursive.eco"
SITE_NAME = "Recursive Eco-Improvement"
PUBLISH_ROOT = "site"       # folder whose contents are served at / ("" = the repo root)
# (repo folder, path in the site) for folders published beside the root; "" root handled by PUBLISH_ROOT
EXTRA_FOLDERS = [("game","game"),("glossary","glossary"),("explainers","explainers")]
# pages that draw their text from a grammar: description = the start of that grammar's own description
GRAMMAR_DESC = {}
EXCLUDE = re.compile(r"(^|/)404\.html$|^viewers/|spread-builder\.html$")
# -------------------------------------------------------------------------------------------------

SKIP_DIRS = {".git", "node_modules", "_site", "_retired", "docs", "research", "scripts", "tests", ".github"}


def read(p):
    with open(p, encoding="utf-8", newline="") as fh:
        return fh.read()


def pages():
    """[(file path, url path)] for every public page."""
    out = []
    roots = [(REPO / PUBLISH_ROOT if PUBLISH_ROOT else REPO, "")] + [(REPO / f, s) for f, s in EXTRA_FOLDERS]
    for base, prefix in roots:
        for f in sorted(base.rglob("*.html")):
            rel = f.relative_to(base).as_posix()
            top = rel.split("/")[0]
            if PUBLISH_ROOT == "" and top in SKIP_DIRS:
                continue
            if rel.startswith(".") or any(part in SKIP_DIRS for part in rel.split("/")[:-1]):
                continue
            url = (prefix + "/" + rel).strip("/") if prefix else rel
            if EXCLUDE.search(url):
                continue
            text = read(f)
            if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', text, re.I):
                continue
            if url == "index.html":
                loc = "/"
            elif url.endswith("/index.html"):
                loc = "/" + url[: -len("index.html")]
            else:
                loc = "/" + url
            out.append((f, loc))
    return out


def strip_tags(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def clip(t):
    if len(t) <= 160:
        return t
    cut = t[:160]
    sent = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    if sent >= 80:
        return cut[: sent + 1]
    return cut[: cut.rfind(" ")].rstrip(",;:—-") + "…"


PARA = r'<(?:p\b|div\s[^>]*class="[^"]*\b(?:sub|lede|intro)\b[^"]*")[^>]*>(.*?)</(?:p|div)>'

def own_description(text):
    body = text.split("</head>", 1)[-1]
    body = re.sub(r"<(nav|footer|aside|script|style|noscript)\b.*?</\1>", " ", body, flags=re.S | re.I)
    for m in re.finditer(PARA, body, flags=re.S | re.I):
        t = strip_tags(m.group(1))
        if len(t) >= (60 if '<' not in m.group(1) else 40) and not t.startswith("Loading"):
            return clip(t)
    return None


def head_info(text):
    head = text.split("</head>", 1)[0]
    g = lambda pat: (re.search(pat, head, re.I | re.S) or [None, None])[1]
    return {
        "title": g(r"<title>(.*?)</title>"),
        "desc": g(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>'),
        "canonical": g(r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']'),
        "og": {k: v for k, v in re.findall(r'<meta\s+property=["\']og:(\w+)["\']\s+content=["\'](.*?)["\']', head, re.I | re.S)},
    }


def fix_head(text, loc, rel=''):
    """Returns (new text, title, description) after adding only what is missing."""
    if "</head>" not in text:
        return text, None, None
    info = head_info(text)
    add = []
    title, desc = info["title"], info["desc"]
    if not title:
        h1 = re.search(r"<h1\b[^>]*>(.*?)</h1>", text, re.S | re.I)
        if h1:
            title = html.escape(strip_tags(h1.group(1)) + " · " + SITE_NAME, quote=False)
            add.append(f"<title>{title}</title>")
    if not desc:
        gd = ""
        if rel in GRAMMAR_DESC:
            import json
            gd = clip(re.sub(r"\s+", " ", json.loads(read(REPO / GRAMMAR_DESC[rel])).get("description", "")).strip())
        d = info["og"].get("description") or (html.escape(gd or own_description(text) or "", quote=True) or None)
        if d:
            desc = d
            add.append(f'<meta name="description" content="{d}">')
    url = HOST + loc
    if not info["canonical"]:
        add.append(f'<link rel="canonical" href="{url}">')
    og = info["og"]
    if title and "title" not in og:
        add.append(f'<meta property="og:title" content="{title}">')
    if desc and "description" not in og:
        add.append(f'<meta property="og:description" content="{desc}">')
    if "url" not in og:
        add.append(f'<meta property="og:url" content="{url}">')
    if "type" not in og:
        add.append('<meta property="og:type" content="website">')
    if "site_name" not in og:
        add.append(f'<meta property="og:site_name" content="{html.escape(SITE_NAME)}">')
    if add:
        block = "\n".join(add) + "\n"
        text = text.replace("</head>", block + "</head>", 1)
    return text, title, desc


def main():
    changed, problems, seen_t, seen_d, entries = [], [], {}, {}, []
    for f, loc in pages():
        text = read(f)
        rel = f.relative_to(REPO).as_posix()
        new, title, desc = fix_head(text, loc, rel)
        if not title:
            problems.append(f"{rel}: no <title> and no <h1> to take one from")
        if not desc:
            problems.append(f"{rel}: no description and no paragraph to take one from")
        for label, val, seen in (("title", title, seen_t), ("description", desc, seen_d)):
            if val:
                if val in seen:
                    problems.append(f"{rel}: same {label} as {seen[val]}")
                seen[val] = rel
        if new != text:
            changed.append(rel)
            if not CHECK:
                f.write_bytes(new.encode("utf-8"))
        entries.append(loc)
    root = REPO / PUBLISH_ROOT if PUBLISH_ROOT else REPO
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          "<!-- Generated by scripts/build_sitemap.py; never hand-edit. -->",
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc in sorted(entries, key=lambda x: (x != "/", x)):
        sm.append(f"  <url><loc>{HOST}{loc}</loc><priority>{'1.0' if loc == '/' else '0.6'}</priority></url>")
    sm.append("</urlset>\n")
    files = {"sitemap.xml": "\n".join(sm), "robots.txt": f"User-agent: *\nAllow: /\n\nSitemap: {HOST}/sitemap.xml\n"}
    for name, content in files.items():
        p = root / name
        if not p.exists() or p.read_bytes().decode("utf-8") != content:
            changed.append(p.relative_to(REPO).as_posix())
            if not CHECK:
                p.write_bytes(content.encode("utf-8"))
    for p in problems:
        print("PROBLEM", p)
    if CHECK:
        for c in changed:
            print("STALE", c)
        sys.exit(1 if changed or problems else 0)
    print(f"sitemap.xml: {len(entries)} URLs; updated {len(changed)} file(s)")
    for c in changed:
        print("  ", c)
    sys.exit(1 if problems else 0)


main()
