#!/usr/bin/env python3
"""The fixer for theme drift: make site/theme.css the single source of colour. Idempotent.

PORTED from recursive-tarot/scripts/apply_theme.py. For every page it:
  - links theme.css (depth-relative) if the page does not;
  - strips local definitions of the colour tokens theme.css owns;
  - removes @media(prefers-color-scheme:dark) blocks (the site is light only);
and, added here, for every page, script, stylesheet and JSON file:
  - swaps tarot's gold for this site's accent (the list below, the same one scripts/check_all.py
    fails on), so a file copied from recursive-tarot later lands in the right colour.

    python scripts/apply_theme.py          fix in place, print what changed

Scope: site/ and game/as-if*. Generated pages (glossary/index.html) are fixed in their builder,
never here, and the legacy dark game pages are left alone until they are relit (decision 11).
"""
import os, re, glob, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

COLOR = ['bg','surface','panel','panel2','card','paper','chip','thumb-bg','stage','felt',
 'grammar-bg-light','grammar-bg-dark','tree-bg','tree-bg-light','ink','ink-soft','ink-strong',
 'mut','muted','faint','fg','text','grammar-text','grammar-text-muted','tree-text','tree-text-muted',
 'line','line-soft','chipline','tree-line','gold','accent','accent2','violet','grammar-accent',
 'grammar-accent-dark','tree-accent','roots','occult','native','myriads','strings','tens','sui',
 'cash','a','b','c','good','win','us','bad','lose','later']
toks = sorted(COLOR, key=len, reverse=True)
DEF = re.compile(r'--(?:' + '|'.join(map(re.escape, toks)) + r')(?![a-z0-9-])\s*:\s*[^;}]+;?')

# tarot gold -> the landing's mint, darkened to 4.5:1 on --bg #f4f1ea
ACCENT = [
    ("#9a7322", "#177d56"), ("#7c5b18", "#126445"), ("#b8902f", "#1b9566"),
    ("#8a6414", "#15704d"), ("#c4ad7a", "#8cc6ad"), ("#faf3e6", "#e9f5ef"),
]
RGBA = re.compile(r"rgba\(\s*154\s*,\s*115\s*,\s*34\s*,", re.I)

def accent(t):
    for a, b in ACCENT:
        t = re.sub(re.escape(a), b, t, flags=re.I)
    return RGBA.sub("rgba(23,125,86,", t)

def strip_dark(css):
    out = []; i = 0
    while True:
        m = re.search(r'@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{', css[i:])
        if not m:
            out.append(css[i:]); break
        out.append(css[i:i + m.start()])
        j = i + m.end(); d = 1
        while j < len(css) and d > 0:
            d += 1 if css[j] == '{' else -1 if css[j] == '}' else 0
            j += 1
        i = j
    return ''.join(out)

def proc_css(css):
    return DEF.sub('', strip_dark(css))

def norm(p): return p.replace(os.sep, '/')

pages = sorted(set(norm(f) for f in glob.glob('site/**/*.html', recursive=True) + glob.glob('game/as-if*.html')))
other = sorted(set(norm(f) for f in glob.glob('site/**/*.js', recursive=True) + glob.glob('site/**/*.css', recursive=True)
                   + glob.glob('site/**/*.json', recursive=True) + glob.glob('game/as-if*.js') + glob.glob('game/game-*.js')
                   + glob.glob('game/game-*.css')))

report = []
for f in pages + other:
    s = open(f, encoding='utf-8').read(); orig = s
    s = accent(s)
    if f.endswith('.html'):
        redirect = 'location.replace(' in s and len(s) < 3000
        if 'theme.css' not in s and not redirect:
            depth = f.count('/') - (1 if f.startswith('site/') else 0)
            link = '<link rel="stylesheet" href="' + ('../' * depth) + 'theme.css?v=1">'
            s = re.sub(r'(<head[^>]*>)', r'\1\n' + link, s, count=1)
        s = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + proc_css(m.group(2)) + m.group(3), s, flags=re.S)
    elif f.endswith('.css') and not f.endswith('theme.css'):
        s = proc_css(s)
    if s != orig:
        open(f, 'w', encoding='utf-8', newline='\n').write(s)
        report.append(f)

for f in report:
    print('  fixed', f)
print('files changed:', len(report))
