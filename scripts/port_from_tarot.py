# -*- coding: utf-8 -*-
"""Port the recursive-tarot template shell into site/ (the tarot template's header, footer, theme and viewers).

    python scripts/port_from_tarot.py [--tarot ../recursive-tarot] [--ref origin/main]

Reads each template file with `git show <ref>:<path>` from the recursive-tarot clone (read-only:
nothing there is written, fetched or checked out) and writes site/. Re-run it to harvest a later
tarot fix: the output is byte-identical when tarot has not changed.

The Prime Rule (recursive-tarot docs/REPLICATE-THE-PATTERN.md): copy the working file, change only
(1) data paths, (2) branding strings, (3) the accent colour, (4) content. Every edit below is one of
those four, and every edit is ASSERTED, so a template change upstream fails loudly here instead of
silently not applying. This file is the complete list of what differs from tarot.

Not ported by this script (written by hand for this site): site/index.html, site/404.html,
site/pages/about.html, site/pages/play.html, site/map/index.html, the stubs site/auth-widget.js,
site/assistant.js, site/viewers/oracle-ribbon.js, and site/spiral.svg.
"""
import argparse, os, re, subprocess, sys, pathlib

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
REPO = pathlib.Path(__file__).resolve().parent.parent
_ap = argparse.ArgumentParser(description="Port the recursive-tarot shell into site/.")
_ap.add_argument("--tarot", default=str(REPO.parent / "recursive-tarot"), help="a recursive-tarot clone (read-only)")
_ap.add_argument("--ref", default="origin/main", help="the tarot commit or branch to read (default origin/main)")
ARGS = _ap.parse_args()
DST = REPO / "site"

# ---- (3) the accent: tarot gold -> the landing's mint, darkened to pass 4.5:1 on --bg ----
ACCENT = [
    ("#9a7322", "#177d56"),   # --gold / --accent          4.54:1 on #f4f1ea (gold was 3.84:1)
    ("#7c5b18", "#126445"),   # hover / --grammar-accent-dark
    ("#b8902f", "#1b9566"),   # light decorative accent
    ("#8a6414", "#15704d"),   # darker accent text
    ("#c4ad7a", "#8cc6ad"),   # dotted underline tint
    ("#faf3e6", "#e9f5ef"),   # --chip, the soft accent fill (accent text on it: 4.57:1)
]
RGBA = (re.compile(r"rgba\(\s*154\s*,\s*115\s*,\s*34\s*,", re.I), "rgba(23,125,86,")

def accent(t):
    for a, b in ACCENT:
        t = re.sub(re.escape(a), b, t, flags=re.I)
    return RGBA[0].sub(RGBA[1], t)

# ---- (1) data paths ----
def paths(t):
    t = t.replace("tarot/all-decks-many-lenses", "grammars/all-decks")
    t = t.replace("all-decks-many-lenses", "all-decks")
    t = t.replace("../tarot/", "../grammars/")
    t = t.replace("PFX+'tarot/", "PFX+'grammars/")
    t = t.replace("PFX + 'tarot/", "PFX + 'grammars/")
    t = t.replace("${PFX}tarot/", "${PFX}grammars/")
    t = t.replace(r"tarot\/", r"grammars\/")               # the regex literal in resolveDeckFlowId etc.
    t = t.replace("tarot/_eco_ids.json", "grammars/_eco_ids.json")
    t = t.replace("tarot/_collection.json", "grammars/_collection.json")
    t = t.replace("tarot/<slug>/", "grammars/<slug>/")
    t = t.replace("tarot/<deck-slug>/", "grammars/<deck-slug>/")
    return t

# ---- (2) branding ----
def brand(t):
    t = t.replace("The Recursive Tarot", "Recursive Eco-Improvement")
    t = t.replace("Recursive Tarot", "Recursive Eco-Improvement")
    t = t.replace("github.com/PlayfulProcess/recursive-tarot", "github.com/PlayfulProcess/recursive-learning")
    t = t.replace("tarot.recursive.eco", "learning.recursive.eco")
    return t

def must(t, old, new, count=1, label=""):
    n = t.count(old)
    if n != count:
        raise SystemExit(f"port: expected {count}x {old[:70]!r} {label}, found {n}")
    return t.replace(old, new)

def sub(t, pattern, repl, count=1, label="", flags=0):
    new, n = re.subn(pattern, repl, t, flags=flags)
    if n != count:
        raise SystemExit(f"port: expected {count}x /{pattern[:70]}/ {label}, found {n}")
    return new

def read(rel):
    r = subprocess.run(["git", "-C", ARGS.tarot, "show", f"{ARGS.ref}:{rel}"], capture_output=True)
    if r.returncode != 0:
        raise SystemExit(f"port: cannot read {rel} at {ARGS.ref} in {ARGS.tarot}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout.decode("utf-8").replace(chr(13) + chr(10), chr(10))
def write(rel, t):
    p = DST / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(t, encoding="utf-8", newline="\n")
    print(f"  wrote site/{rel}")

def std(rel):   return brand(paths(accent(read(rel))))

# ---------------------------------------------------------------------------------------------
# Copy as-is (accent + paths + brand only)
for rel in ["style.css", "icons.js", "view-switcher.js",
            "viewers/dimension-engine.js", "viewers/deck-picker.js",
            "viewers/caster.html", "pages/spread-builder.html"]:
    write(rel, std(rel))

# theme.css: only the accent family changes (light only, no dark block)
t = std("theme.css")
t = must(t, "/* soft gold chip fill */", "/* soft accent chip fill */")
t = must(t, "the one UI accent: restrained gold (accent only, never a fill)",
            "the one UI accent: the landing's mint, darkened to 4.5:1 on --bg (accent only, never a fill).\n     Token NAMES keep tarot's (--gold, --accent) so every copied viewer resolves them unchanged")
t = must(t, "legacy alias of --gold (was purple in old dark pages)", "legacy alias of --gold")
t = must(t, "legacy alias — folded into gold", "legacy alias, folded into the accent")
write("theme.css", t)

# grammar-loader.js: paths + strip the emoji from its console logs
t = std("viewers/grammar-loader.js")
t = re.sub(r"(console\.(?:log|warn|error)\(\s*[`'])[\U0001F000-\U0001FFFF☀-➿]️?\s*", r"\1", t)
t = must(t, "NOTE for this repo (recursive-tarot): learning.recursive.eco", "NOTE for this repo (recursive-learning): learning.recursive.eco")
t = must(t, "const COMMUNITY_FOLDERS = ['tarot', 'iching', 'sequences', 'astrology', 'custom', 'classics'];",
            "const COMMUNITY_FOLDERS = ['tarot', 'iching', 'sequences', 'astrology', 'custom', 'classics', 'grammars'];")
write("viewers/grammar-loader.js", t)

# ---------------------------------------------------------------------------------------------
# cards.html
t = std("viewers/cards.html")
t = must(t, "<title>Cards — Recursive Eco-Improvement</title>", "<title>Cards · Recursive Eco-Improvement</title>")
# default src: the Words deck (the meta is the caster pool, not a reading deck)
t = must(t, "'../grammars/all-decks/grammar.json' : '');", "'../grammars/words-deck/grammar.json' : '');")
# the decorative star goes (no dingbats as marks)
t = must(t, ">✦ Decks ▾</button>", ">Decks ▾</button>")
t = must(t, "btn.textContent = `✦ Decks ▾ (${activeDecks.length})`;", "btn.textContent = `Decks ▾ (${activeDecks.length})`;", count=2)
t = must(t, "'↺ Clear filter · show all' : '✦ Showing all';", "'↺ Clear filter · show all' : 'Showing all';")
t = must(t, "'↺ Clear filter · show all' : '✦ Showing all cards';", "'↺ Clear filter · show all' : 'Showing all items';")
t = must(t, "opt(metaItem.slug, '✦ All Decks (the meta)')", "opt(metaItem.slug, 'All decks')")
# the pill: "Open in X →" (the grammars here are not all decks)
t = must(t, "Open in ${escapeHtml(sourceDeckLabel)} deck &rarr;", "Open in ${escapeHtml(sourceDeckLabel)} &rarr;")
# accuracy reports go to this repo
t = must(t, "*Reported via learning.recursive.eco*", "*Reported via learning.recursive.eco*")
# print is left out in v1 (no print viewer here): the button stays in the markup, hidden
t = sub(t, r'(<button id="print-btn" class="edit-btn" onclick="navigateToPrint\(\)"[^>]*?style=")display:inline-flex;',
        r"\1display:none;", label="print button")
# ?github= raw URLs from this repo live under grammars/ (iching made the same one-word addition)
t = must(t, "const COMMUNITY_FOLDERS = ['tarot', 'iching', 'sequences', 'astrology', 'custom', 'classics'];",
            "const COMMUNITY_FOLDERS = ['tarot', 'iching', 'sequences', 'astrology', 'custom', 'classics', 'grammars'];")
write("viewers/cards.html", t)

# explorer.html
t = std("viewers/explorer.html")
t = must(t, "<title>Emergence Explorer — Pivot the Tarot · Recursive Eco-Improvement</title>",
            "<title>Explorer · Recursive Eco-Improvement</title>")
t = must(t, "const src = srcParam || PFX+'grammars/all-decks/grammar.json';",
            "const src = srcParam || PFX+'grammars/words-deck/grammar.json';")
t = must(t, '<span class="lab">🖐 Drag any field chip', '<span class="lab">Drag any field chip')
t = must(t, 'title="Pick one or many grammars">✦ Decks ▾</button>', 'title="Pick one or many grammars">Decks ▾</button>')
t = must(t, '<button data-a="meta">✦ Meta (all-in-one)</button>', '<button data-a="meta">All decks in one</button>')
t = must(t, "$('#deckbtn').textContent = `✦ Decks ▾ (${slugs.length})`;", "$('#deckbtn').textContent = `Decks ▾ (${slugs.length})`;")
t = must(t, "$('#deckbtn').textContent = '✦ ' + (g.name||'deck')", "$('#deckbtn').textContent = (g.name||'deck')")
write("viewers/explorer.html", t)

# tree-viewer.html
t = std("viewers/tree-viewer.html")
t = must(t, "<title>Tree View — Recursive Eco-Improvement</title>", "<title>Tree · Recursive Eco-Improvement</title>")
t = must(t, "'../grammars/all-decks/grammar.json' : '');", "'../grammars/words-deck/grammar.json' : '');")
# there is no genealogy page here: the second header button opens the same grammar in the Explorer
t = must(t, "if (exploreBtn) { exploreBtn.textContent = 'Genealogy'; exploreBtn.href = '../genealogy.html'; }",
            "if (exploreBtn) { exploreBtn.textContent = 'Explorer'; exploreBtn.href = `explorer.html${srcUrl ? '?src=' + encodeURIComponent(srcUrl) : ''}`; }")
write("viewers/tree-viewer.html", t)

# reference-resolve.js
t = std("viewers/reference-resolve.js")
t = must(t, "const PERSONISH = ['person', 'institution', 'role-group', 'makers', 'patrons', 'occultists', 'scholars', 'institutions'];",
            "const PERSONISH = ['person', 'institution', 'role-group', 'makers', 'patrons', 'occultists', 'scholars', 'institutions',\n"
            "    'organization', 'lab', 'nonprofit', 'government'];")
t = must(t, "const BOOKISH = ['book', 'lens', 'foundation', 'scholarship', 'occult-revival'];",
            "// Source kinds only: a term, a mechanism or a moment is not a source, so it falls through to\n"
            "  // the parallel-entry case below.\n"
            "  const BOOKISH = ['book', 'lens', 'foundation', 'scholarship', 'occult-revival',\n"
            "    'paper', 'essay', 'statement', 'report', 'episode', 'podcast'];")
t = must(t, "kicker: 'Source text: ' + (srcName || deckLabel),", "kicker: 'Source: ' + (srcName || deckLabel),")
t = must(t, "note: 'A book entry from ' + deckLabel + '. It is the book’s own entry, not part of this card’s description.',",
            "note: 'A source entry from ' + deckLabel + '. It is the source’s own entry, not part of this item’s description.',")
t = must(t, "cta: 'Open this book in ' + deckLabel,", "cta: 'Open this source in ' + deckLabel,")
t = must(t, "cta: 'View this card in ' + deckLabel,", "cta: 'View this item in ' + deckLabel,")
t = must(t, "note: 'Background from ' + deckLabel + ' on the people behind this card. It is their entry, not part of this card’s own description.',",
            "note: 'Background from ' + deckLabel + '. It is their own entry, not part of this item’s description.',")
t = must(t, "kicker: 'Featured card from ' + deckLabel,", "kicker: 'Featured item from ' + deckLabel,")
t = must(t, "note: 'Shown as an example of this maker’s work. Everything below is the card’s own entry in its deck — not part of the biography above.',",
            "note: 'Shown as an example. Everything below is the item’s own entry in its grammar, not part of the entry above.',")
t = must(t, "cta: 'Open this card in ' + deckLabel,", "cta: 'Open this item in ' + deckLabel,", count=2)
t = must(t, "kicker: 'The same card in ' + deckLabel,", "kicker: 'The same idea in ' + deckLabel,")
t = must(t, "note: 'A parallel entry in another deck, shown for comparison. It is that deck’s text, not this one’s.',",
            "note: 'A parallel entry in another grammar, shown for comparison. It is that grammar’s text, not this one’s.',")
write("viewers/reference-resolve.js", t)

# eco-links.js
t = std("viewers/eco-links.js")
t = must(t, " *   ✏️ Edit  → https://flow.recursive.eco/create/dashboard/unified/new?forkId=<id>",
            " *   <rt-icon name=\"pencil\"></rt-icon> Edit  → https://flow.recursive.eco/create/dashboard/unified/new?forkId=<id>")
t = must(t, "a('eco-edit', u.edit, '✏️ Edit')", "a('eco-edit', u.edit, '<rt-icon name=\"pencil\"></rt-icon> Edit')")
t = must(t, "const PFX = '../'.repeat(Math.max(0, _segs.length - 1));   // path back to repo root, depth-aware",
            "// Root-relative: the site is served at the root of learning.recursive.eco, and the depth formula\n"
            "  // gets /glossary/ wrong (a trailing-slash page is one folder down, not at the root).\n"
            "  const PFX = '/';")
t = must(t, "  const _segs = location.pathname.split('/').filter(Boolean);\n", "")
t = must(t, "const type = opts.type || 'tarot';", "const type = opts.type || 'custom';")
write("viewers/eco-links.js", t)


# caster-studio.html
t = std("viewers/caster-studio.html")
t = must(t, "<title>Recursive Eco-Improvement — Spread Caster</title>", "<title>Spread Caster · Recursive Eco-Improvement</title>")
# the castable pool: leaves the meta marks castable (tarot keyed this on metadata.arcana)
t = must(t, "i.metadata && i.metadata.source_deck && i.metadata.arcana);",
            "i.metadata && i.metadata.source_deck && i.metadata.castable);")
# no reversals by default here, and the control is hidden (the cards are words, not tarot)
t = must(t, '<div class="revfield">', '<div class="revfield" style="display:none">')
t = must(t, '<strong id="revPct">30%</strong>', '<strong id="revPct">0%</strong>')
t = must(t, 'id="revProb" min="0" max="100" step="5" value="30">', 'id="revProb" min="0" max="100" step="5" value="0">')
t = must(t, '<span class="revpct" id="revPctEnd">30%</span>', '<span class="revpct" id="revPctEnd">0%</span>')
t = must(t, "_type:'recursive-tarot-cast', _version:2,", "_type:'recursive-learning-cast', _version:2,")
# the recursive.eco panels (my spreads, model hint, AI interpret, Cast in recursive.eco) sit
# behind ONE guard. This site has no sign-in in v1; no code block is deleted.
t = must(t, "const FLOW = 'https://flow.recursive.eco';",
            "const FLOW = 'https://flow.recursive.eco';\n"
            "// The recursive.eco panels: My spreads, the model hint, Interpret with AI and Cast in recursive.eco.\n"
            "// OFF in v1 (this site has no sign-in, and auth-widget.js is a stub). Flip to true to bring every\n"
            "// one of them back; each is gated below, none was deleted.\n"
            "const FLOW_ON = false;")
t = must(t, "  loadMySpreads();   // pull the signed-in user's saved spreads", "  if (FLOW_ON) loadMySpreads();   // pull the signed-in user's saved spreads")
t = must(t, "  checkAssistantModel();   // hint (never a block)", "  if (FLOW_ON) checkAssistantModel();   // hint (never a block)")
t = must(t, "  $('interpretAI').addEventListener('click', interpretWithAI);\n",
            "  $('interpretAI').addEventListener('click', interpretWithAI);\n"
            "  if (!FLOW_ON) {\n"
            "    document.querySelectorAll('[data-flow]').forEach(el => { el.style.display = 'none'; });\n"
            "    $('exportTitle').textContent = 'Keep the reading';\n"
            "  }\n")
t = must(t, '<p class="sub">Build a spread from scratch (or start from a preset), cast the cards into it, and send the whole reading to <a href="https://flow.recursive.eco/" target="_blank" rel="noopener">recursive.eco</a> for an AI interpretation. This page draws; recursive.eco interprets and keeps a Journal.</p>',
            '<p class="sub">Build a spread from scratch (or start from a preset) and cast the cards into it.<span data-flow> Send the whole reading to <a href="https://flow.recursive.eco/" target="_blank" rel="noopener">recursive.eco</a> for an AI interpretation. This page draws; recursive.eco interprets and keeps a Journal.</span></p>')
t = must(t, "    <h2>Interpret the reading</h2>\n    <p>Send this cast",
            "    <h2 id=\"exportTitle\">Interpret the reading</h2>\n    <p data-flow>Send this cast")
t = must(t, '<button type="button" id="interpretAI" class="journal-cta">✦ Interpret with AI</button>',
            '<button type="button" id="interpretAI" class="journal-cta" data-flow>Interpret with AI</button>')
t = must(t, '<a id="journalLink" class="btn" href="https://flow.recursive.eco/"', '<a id="journalLink" data-flow class="btn" href="https://flow.recursive.eco/"')
# contribute a spread: a proposal file, prefilled, beside the one source of the spreads
t = must(t, 'href="https://github.com/PlayfulProcess/recursive-learning/new/main?filename=spreads/my-spread.json"',
            'href="https://github.com/PlayfulProcess/recursive-learning/new/main?filename=glossary/proposed-spreads/my-spread.json"')
t = must(t, "link.href = base + '?filename=' + encodeURIComponent('spreads/my-spread.json');",
            "link.href = base + '?filename=' + encodeURIComponent('glossary/proposed-spreads/my-spread.json');")
t = must(t, "const filename = 'spreads/' + slugify(obj.name) + '.json';",
            "// A proposal file; a maintainer folds it into glossary/spreads.src.json, the one source of the\n"
            "  // spreads (viewers/spreads.json is generated from it).\n"
            "  const filename = 'glossary/proposed-spreads/' + slugify(obj.name) + '.json';")
t = must(t, '<a class="btn" href="../pages/course-viewer.html?course=how-to-contribute" target="_blank" rel="noopener" title="How to contribute a deck, spread, or course">How to contribute →</a>',
            '<a class="btn" href="../pages/about.html#contribute" title="How to contribute a spread or a correction">How to contribute →</a>')
t = must(t, "Data: this repo's <code>grammars/all-decks/grammar.json</code> (cards + provenance) and <code>viewers/spreads.json</code> (layouts). Cross-deck casts sample the whole pool; single-deck casts sample one deck. Cards are public domain. Click any card for its Scene &amp; Symbol.",
            "Data: this repo's <code>grammars/all-decks/grammar.json</code> (the castable pool) and <code>viewers/spreads.json</code> (layouts, generated from <code>glossary/spreads.src.json</code>). Cross-deck casts sample the whole pool; single-deck casts sample one deck. Content is CC BY-SA 4.0. Click any card for its full entry.")
t = must(t, '<footer class="site">Public-domain tarot data · ', '<footer class="site">Open data, CC BY-SA 4.0 · ')
t = must(t, "'One card may come from each of several centuries — only the meta can do this.'",
            "'A cross-deck draw samples every castable deck at once.'")
# no dingbats as marks
t = must(t, "oc.textContent = '✎ Custom (build your own)';", "oc.textContent = 'Custom (build your own)';")
t = must(t, "oc.textContent = n ? '✎ Custom — editing' : '✎ Custom (build your own)';", "oc.textContent = n ? 'Custom (editing)' : 'Custom (build your own)';")
t = must(t, ": '<div class=\"ph\">★</div>')", ": '<div class=\"ph\">' + esc(shortCardName(c.name, c.deck)) + '</div>')")
t = must(t, "(\"✎ Nature's Negotiation (3×3) (editing)\")", "(\"Nature's Negotiation (3×3) (editing)\" with a pencil glyph)")
t = must(t, "b.textContent='Copied ✓';", "b.textContent='Copied';")
t = must(t, "flash($('saveAsNew'), 'Saved ✓');", "flash($('saveAsNew'), 'Saved');")
t = must(t, "a.download='tarot-reading-'", "a.download='reading-'")
t = must(t, "a.download='tarot-spread-'", "a.download='spread-'")
write("viewers/caster-studio.html", t)

print("port: viewers done")

# ============================================================================ the chrome
# site-header.js and site-footer.js: the dropdown, positioning, keyboard, touch and scroll code is
# carried byte for byte; only the menus (content), the brand, the accent and the root prefix change.
MARK = (REPO / "scripts" / "mark.svg").read_text(encoding="utf-8")
SPIRAL_D = re.search(r'<symbol id="spiral"[^>]*>\s*<path d="([^"]+)"', MARK).group(1)

# ============================================================================ site-header.js
t = std("site-header.js")

t = must(t, """/* Shared site header for the Recursive Eco-Improvement static site.
 * One definition, used by every page (root + viewers/ + pages/). Style-isolated
 * via Shadow DOM so each viewer's own CSS can't override it. Path-aware so links
 * resolve from both the repo root and the /viewers/ subdir.
 *
 * Usage:  <script src="<path-to>/site-header.js?v=7"></script>
 *         <site-header active="cards"></site-header>
 * The `active` attribute highlights the matching tab; if omitted it is
 * auto-detected from the filename.
 *
 * Nav model (June 2026): two groups, all right-aligned.
 *  - VIEWS  — previews of the same data (Cards, Explorer, Tree of Life, Timeline,
 *             Tree, Genealogy), introduced by a tiny "views" caption.
 *  - TOOLS  — different-natured pages, each colour-coded: Caster (violet),
 *             Course (green), Shop (gold), GitHub (muted, external).
 */""", """/* Shared site header for learning.recursive.eco (working title: Recursive Eco-Improvement).
 * PORTED from recursive-tarot/site-header.js under its Prime Rule: the dropdown, positioning,
 * keyboard, touch and auto-hide code below is tarot's, unchanged. Only the menus, the brand, the
 * accent and the root prefix changed. Fix a mechanism in tarot first; the next port inherits it.
 *
 * Usage:  <script src="/site-header.js"></script>
 *         <site-header active="words"></site-header>
 * `active` is one of: home, words, sources, ideas, play, institutions. On a viewer page
 * (/viewers/...) the tab is always derived from the grammar in ?src=, so the viewers keep
 * their tarot `active` values unedited. Hand-written pages that load ../shared/nav.js get
 * this header through that shim (see the top of shared/nav.js).
 *
 * THE SITE MAP lives here, once: the menu arrays below. shared/nav.js holds only the list of
 * games and their views (the Walk's view switcher). scripts/check_all.py parses these arrays
 * and fails when an href lands on nothing.
 *
 * The brand mark is her spiral, the path copied verbatim from scripts/mark.svg (check_all
 * asserts it). No emoji, no redrawn mark.
 */""", label="header comment")

t = must(t, """  // Path back to the repo root — depth-aware so it works at any nesting
  // (root, /viewers/, /pages/, AND /viewers/prototypes/, /pages/book/ …).
  const _segs = location.pathname.split('/').filter(Boolean);
  const PFX = '../'.repeat(Math.max(0, _segs.length - 1));
""", """  // Root-relative. The site is served at the root of learning.recursive.eco (the github.io
  // address 301s there). Tarot's depth formula ('../'.repeat(segs-1)) reads /glossary/ as the
  // root, because a trailing-slash page has one segment, so it is not used here.
  const PFX = '/';

  // The spiral: her mark, verbatim from scripts/mark.svg (viewBox 0 0 100 100).
  const SPIRAL_D = '""" + SPIRAL_D + """';
""", label="PFX")

# the menus: content only
t = sub(t, r"  // \[key, label, href\] — split by level\n.*?\n    \]\],\n  \];\n", """  // ---- the site map (content) ----
  // Grammar paths as the viewers take them in ?src= (relative to /viewers/).
  const WORDS = '../grammars/words-deck/grammar.json';
  const SOURCES = '../grammars/sources-of-alignment/grammar.json';
  const IDEAS = '../grammars/ideas-of-alignment/grammar.json';
  const INSTITUTIONS = '../grammars/institutions-of-alignment/grammar.json';
  // [href, label, external?] — each pill links to its hub; the dropdown lists the rest.
  const HOME_MENU = [
    [PFX,                         'Home'],
    [PFX + 'pages/about.html',    'About &amp; method'],
  ];
  const WORDS_MENU = [
    [PFX + 'glossary/',                                                     'The glossary'],
    [PFX + 'viewers/cards.html?src=' + WORDS,                               'Words as cards'],
    [PFX + 'viewers/caster-studio.html?spread=before-you-delegate',         'Cast: Before you delegate'],
    [PFX + 'viewers/caster-studio.html?spread=the-fork',                    'Cast: The fork'],
    [PFX + 'viewers/caster-studio.html?spread=single',                      'A single draw'],
    [PFX + 'viewers/explorer.html?src=' + WORDS,                            'Explore the words'],
  ];
  const SOURCES_MENU = [
    [PFX + 'map/',                                                          'All sources'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-podcasts#groupby=suit', 'Podcasts'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-papers#groupby=suit',   'Papers &amp; books'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-people#groupby=suit',   'People'],
    [PFX + 'viewers/cards.html?src=' + INSTITUTIONS + '&layout=thumbnails', 'Institutions'],
    [PFX + 'viewers/tree-viewer.html?src=' + SOURCES,                       'Tree of sources'],
  ];
  const IDEAS_MENU = [
    [PFX + 'viewers/cards.html?src=' + IDEAS,                               'Ideas as cards'],
    [PFX + 'viewers/tree-viewer.html?src=' + IDEAS,                         'Ideas by lane'],
    [PFX + 'viewers/explorer.html?src=' + IDEAS,                            'Explore the ideas'],
  ];
  const PLAY_MENU = [
    [PFX + 'game/as-if.html',          'As-If'],
    [PFX + 'game/potato-others.html',  'Hot Potato'],
    [PFX + 'game/potato.html',         'Hot Potato, alone'],
    [PFX + 'game/spread.html',         'The Walk'],
    [PFX + 'game/lines.html',          'Changing Lines'],
    [PFX + 'pages/play.html',          'All games →'],
  ];
  // [key, label, href, cssClass, external?] — tarot's TOOLS slot. Institutions sits where tarot
  // has Shop: each card there is a link out to an institution's own site.
  const TOOLS = [
    ['institutions', 'Institutions', PFX + 'viewers/cards.html?src=' + INSTITUTIONS + '&layout=thumbnails', 't-shop'],
    ['github', 'GitHub ↗',  'https://github.com/PlayfulProcess/recursive-learning', 't-github', true],
  ];
  const KEYS = ['home', 'words', 'sources', 'ideas', 'play', 'institutions'];
""", flags=re.S, label="menus")

t = sub(t, r"  function autoActive\(\) \{\n.*?\n    return 'home';\n  \}\n", """  function autoActive() {
    const p = location.pathname, q = decodeURIComponent(location.search);
    if (p.startsWith('/glossary/')) return 'words';
    if (p.startsWith('/map/')) return 'sources';
    if (p.startsWith('/game/') || /\\/pages\\/play\\.html$/.test(p)) return 'play';
    if (/\\/viewers\\//.test(p)) {
      if (q.includes('institutions-of-alignment')) return 'institutions';
      if (q.includes('sources-of-alignment')) return 'sources';
      if (q.includes('ideas-of-alignment')) return 'ideas';
      return 'words';   // the Words deck is every viewer's default, and the caster casts it
    }
    return 'home';
  }
""", flags=re.S, label="autoActive")

t = must(t, "      const active = this.getAttribute('active') || autoActive();",
            "      // On a viewer page the grammar decides; elsewhere a known `active` wins.\n"
            "      const attr = this.getAttribute('active');\n"
            "      const active = (/\\/viewers\\//.test(location.pathname) || !KEYS.includes(attr)) ? autoActive() : attr;")
t = must(t, """      const VIEW_KEYS = ['explorer', 'cards', 'lenses', 'tree', 'treeoflife', 'timeline', 'genealogy', 'channels'];
      const viewActive = VIEW_KEYS.includes(active);
""", "")

# the brand: a longer name, so a subtitle line and a slightly smaller face
t = must(t, "          .brand-name .name{ font-family:\"Fraunces\",Georgia,serif; font-size:21px; font-weight:600; letter-spacing:.4px; color:#221f1a; white-space:nowrap; }",
            "          .brand-name .name{ font-family:\"Fraunces\",Georgia,serif; font-size:19px; font-weight:600; letter-spacing:.2px; color:#221f1a; white-space:nowrap; }\n"
            "          .brand-name{ flex-direction:column; align-items:flex-start; line-height:1.15; }\n"
            "          .brand-name .sub{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#6b6457; margin-top:3px; white-space:nowrap; }\n"
            "          @media (max-width:380px){ .brand-name .name{ font-size:16px; } }")
t = must(t, """              <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;border-radius:50%;flex-shrink:0"><img src="${PFX}public/spiral-purple.svg" width="30" height="30" alt="" aria-hidden="true" style="display:block"></span>""",
            """              <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;border-radius:50%;flex-shrink:0;color:#9333ea"><svg viewBox="0 0 100 100" width="28" height="28" aria-hidden="true" focusable="false" style="display:block"><path d="${SPIRAL_D}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></span>""")
t = must(t, """            <a class="brand-name" href="${PFX}index.html" title="Recursive Eco-Improvement — home">
              <span class="name">The <span class="gold">Recursive Eco-Improvement</span></span>
            </a>""", """            <a class="brand-name" href="${PFX}" title="Recursive Eco-Improvement, home">
              <span class="name">Recursive <span class="gold">Eco-Improvement</span></span>
              <span class="sub">explorations in adaptive alignment</span>
            </a>""")

# the nav: tarot's dropdown markup, one block per pill, pointed at this site's menus
t = sub(t, r"          <nav aria-label=\"Site sections\">\n.*?\n          </nav>\n", """          <nav aria-label="Site sections">
            <span class="dd">
              <a class="tab dd-btn${active === 'home' ? ' active' : ''}" href="${PFX}" aria-haspopup="true" aria-expanded="false" aria-label="Home menu">Home</a>
              <span class="dd-menu">
                ${HOME_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'words' ? ' active' : ''}" href="${PFX}glossary/" aria-haspopup="true" aria-expanded="false" aria-label="Words menu">Words</a>
              <span class="dd-menu">
                ${WORDS_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'sources' ? ' active' : ''}" href="${PFX}map/" aria-haspopup="true" aria-expanded="false" aria-label="Sources menu">Sources</a>
              <span class="dd-menu">
                ${SOURCES_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'ideas' ? ' active' : ''}" href="${PFX}viewers/tree-viewer.html?src=${IDEAS}" aria-haspopup="true" aria-expanded="false" aria-label="Ideas menu">Ideas</a>
              <span class="dd-menu">
                ${IDEAS_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab t-caster dd-btn${active === 'play' ? ' active' : ''}" href="${PFX}pages/play.html" aria-haspopup="true" aria-expanded="false" aria-label="Games menu">Games</a>
              <span class="dd-menu">
                ${PLAY_MENU.map(([href, label, ext]) => `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`).join('')}
              </span>
            </span>
            ${TOOLS.map(tab).join('')}
            <recursive-auth></recursive-auth>
          </nav>
""", flags=re.S, label="nav markup")
t = must(t, "  function autoActive() {", "  function autoActive() {")  # sanity: one definition
write("site-header.js", t)

# ============================================================================ site-footer.js
t = std("site-footer.js")
t = must(t, """/* Recursive Eco-Improvement — one shared footer: under construction · recursive.eco spiral · newsletter.
   <site-footer></site-footer>  (reads theme.css tokens).""",
            """/* Recursive Eco-Improvement — one shared footer: under construction · her spiral · newsletter.
   PORTED from recursive-tarot/site-footer.js (Prime Rule: copy, change paths/brand/accent/content).
   <site-footer></site-footer>  (reads theme.css tokens). Links are root-relative (PFX '/'), so
   the `base` attribute the copied viewers still pass is read by nothing.""")
t = sub(t, r"var SPIRAL='[^']*';", "var SPIRAL='" + SPIRAL_D + "';  // verbatim from scripts/mark.svg\n  var PFX='/';", label="SPIRAL")
t = must(t, "      var base=this.getAttribute('base')||'';\n", "")
t = must(t, "'<h3>One branch of a larger tree</h3>'+", "'<h3>One channel of recursive.eco</h3>'+")
t = must(t, "'<p>The work so far of <strong>one solo developer</strong> — passionate about the tarot and meaning systems, and built with a great deal of help from AI. The hope is that <strong>real human collaborators</strong> will make the whole thing better.</p>'+",
            "'<p>The work so far of <strong>one solo developer</strong>, built with a great deal of help from AI (Claude, made by Anthropic: <a href=\"'+PFX+'pages/about.html#method\">what that means here</a>). The hope is that <strong>real human collaborators</strong> will make it better.</p>'+")
t = must(t, "'<div class=\"links\"><a href=\"https://recursive.eco\" target=\"_blank\" rel=\"noopener\">recursive.eco ↗</a> · '+\n        '<a href=\"'+base+'pages/about.html\">About</a> · '+\n        '<a href=\"https://github.com/PlayfulProcess/recursive-learning\" target=\"_blank\" rel=\"noopener\">the repo</a> · CC-BY-SA-4.0</div>'+",
            "'<div class=\"links\"><a href=\"https://recursive.eco\" target=\"_blank\" rel=\"noopener\">recursive.eco ↗</a> · '+\n"
            "        '<a href=\"'+PFX+'pages/about.html\">About &amp; method</a> · '+\n"
            "        '<a href=\"https://flow.recursive.eco/library/channels/recursive-learning\" target=\"_blank\" rel=\"noopener\">the channel ↗</a> · '+\n"
            "        '<a href=\"https://github.com/PlayfulProcess/recursive-learning\" target=\"_blank\" rel=\"noopener\">the repo</a> · '+\n"
            "        '<a href=\"'+PFX+'pages/about.html#licences\">code Apache-2.0, content CC BY-SA 4.0</a></div>'+")
t = must(t, "subscribed_from:'recursive-tarot'", "subscribed_from:'recursive-learning'")
t = must(t, "msg.textContent='✓ Welcome to the recursive public!';", "msg.textContent='Welcome. You are on the list.';")
t = must(t, "msg.textContent='✓ You\\'re already signed up!';", "msg.textContent='You are already on the list.';")
t = must(t, """        var _segs = location.pathname.split('/').filter(Boolean);
        var PFX = '../'.repeat(Math.max(0, _segs.length - 1));
""", "        // (PFX is the root-relative '/' declared at the top of this file.)\n")
write("site-footer.js", t)
print("port: done")
