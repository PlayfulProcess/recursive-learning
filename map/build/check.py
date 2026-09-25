#!/usr/bin/env python3
"""Fail the map build on any breach of the publishing rules. Run by build.py; also runnable alone:

    python map/build/check.py

Fails if: a snippet is over its cap (20 words; 15 for New York Times shows); an episode's snippets
go over their share of its caption words; a snippet keeps caption markup or a speaker label; an idea
link stops mid-word; an episode has no caption kind; the key words are longer than two-word terms
or more than 5 per passage; any string in data/ is over 25 words; an absolute path or this machine's
account name appears anywhere in map/; a passage has no video id + time; or a file is over its size budget.
"""
import getpass, gzip, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.dirname(HERE)
DATA = os.path.join(MAP, 'data')
NYT_SHOWS = {'pod_ezra', 'pod_ezra_klein'}
fails = []


def fail(msg):
    fails.append(msg)


def words(s):
    return len(s.split())


def walk_strings(o, path='$'):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from walk_strings(v, f'{path}.{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk_strings(v, f'{path}[{i}]')


idx = json.load(open(os.path.join(DATA, 'index.json'), encoding='utf-8'))
snips = json.load(open(os.path.join(DATA, 'snippets.json'), encoding='utf-8'))
info = json.load(open(os.path.join(DATA, 'build-info.json'), encoding='utf-8'))
kw = json.load(open(os.path.join(DATA, 'words.json'), encoding='utf-8'))
P, E = idx['passages'], idx['episodes']
N = len(P['ep'])
share = info.get('snippet_share', 0.02)

# ---- passages carry a video + time
for k in ('ep', 't0', 't1', 'x', 'y', 'c', 'ideas'):
    if len(P[k]) != N:
        fail(f'passages.{k} has {len(P[k])} rows, expected {N}')
for i in range(N):
    e = P['ep'][i]
    if not (0 <= e < len(E)) or not E[e].get('vid') or P['t0'][i] is None or P['t0'][i] < 0:
        fail(f'passage {i} has no video id + time')
        break

# ---- snippet caps
used = [0] * len(E)
for k, s in snips.items():
    i = int(k)
    ep = E[P['ep'][i]]
    nyt = ep['show'] in NYT_SHOWS or idx['shows'].get(ep['show'], {}).get('nyt')
    cap = 15 if nyt else 20
    n = words(s['t'])
    if n > cap:
        fail(f'snippet {k} ({ep["show"]}) has {n} words, cap {cap}')
    if nyt and n > 15:
        fail(f'NYT snippet {k} over 15 words')
    if re.search(r'>>|\[[A-Za-z ]+\]', s['t']):
        fail(f'snippet {k} still carries caption markup')
    if re.search(r'(?:^|[.?!…] )[A-Z][a-z]+ [A-Z][a-z]+: ', s['t'].lstrip('…')):
        fail(f'snippet {k} still carries a speaker label: {s["t"][:60]!r}')
    for a, b, _ in s['m']:
        if (a > 0 and s['t'][a - 1].isalnum()) or (b < len(s['t']) and s['t'][b].isalnum()):
            fail(f'snippet {k} has an idea link that stops mid-word')
    used[P['ep'][i]] += n
for e in E:
    if e.get('captions') not in ('creator', 'auto', 'creator?', 'auto?'):
        fail(f'episode {e["vid"]} has no caption kind')
for e, u in zip(E, used):
    if u > share * e['words'] + 1e-9:
        fail(f'episode {e["vid"]} snippets {u} words > {share:.0%} of {e["words"]}')

# ---- key words: an index of short terms, never a phrase that could be a quote
if len(kw['p']) != N:
    fail(f'words.json has {len(kw["p"])} rows, expected {N}')
if any(len(t.split()) > 2 for t in kw['vocab']):
    fail('words.json has a term longer than two words')
if any(len(a) > 5 or any(not (0 <= i < len(kw['vocab'])) for i in a) for a in kw['p']):
    fail('words.json has more than 5 terms for a passage, or a bad index')

# ---- no long strings anywhere in data/
for name, doc in (('index.json', idx), ('snippets.json', snips), ('build-info.json', info), ('words.json', kw)):
    for path, s in walk_strings(doc):
        if words(s) > 25:
            fail(f'{name} {path} is {words(s)} words (> 25)')

# ---- no absolute paths or account names in map/**
who = {getpass.getuser(), os.environ.get('USERNAME', ''), os.path.basename(os.path.expanduser('~'))}
try:
    email = subprocess.run(['git', 'config', 'user.email'], capture_output=True, text=True, cwd=MAP).stdout.strip()
    if email:
        who.add(email.split('@')[0])
except OSError:
    pass
who = {w.lower() for w in who if w and len(w) >= 3}
path_re = re.compile(r'\b[A-Za-z]:[\\/]{1,2}[A-Za-z]|[\\/]Users[\\/]|/home/[a-z]', re.I)
for root, dirs, files in os.walk(MAP):
    dirs[:] = [d for d in dirs if d not in ('__pycache__', '.git')]
    for f in files:
        p = os.path.join(root, f)
        rel = os.path.relpath(p, MAP).replace('\\', '/')
        if f in ('local.json',) or f.endswith(('.bin', '.onnx', '.pyc')):
            continue
        try:
            txt = open(p, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        low = txt.lower()
        for w in who:
            if re.search(r'(?<![a-z])' + re.escape(w) + r'(?![a-z])', low):
                fail(f'{rel} contains the account name')
        m = path_re.search(txt)
        if m and rel != 'build/check.py':
            fail(f'{rel} contains an absolute path near "{txt[max(0, m.start() - 10):m.end() + 20]!r}"')

# ---- size budgets (bytes; gz where the server compresses)
def gz(p):
    return len(gzip.compress(open(p, 'rb').read(), 9))


budget = {                       # file: (measure, limit)
    'data/index.json': (gz, 20_000 + 12 * N),
    'data/snippets.json': (gz, 10_000 + 5 * N),
    'data/words.json': (gz, 20_000 + 20 * N),
    'data/nn.u16.bin': (os.path.getsize, 12 * N),
    'data/vectors.i8.bin': (os.path.getsize, 384 * N),
    'data/scale.f32.bin': (os.path.getsize, 4 * N),
    'data/build-info.json': (os.path.getsize, 4_000),
    'index.html': (gz, 12_000),
    'map.css': (gz, 8_000),
    'map.js': (gz, 30_000),
    'search.js': (gz, 8_000),
    'model/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx': (os.path.getsize, 24_000_000),
}
for rel, (fn, lim) in budget.items():
    p = os.path.join(MAP, rel)
    if not os.path.exists(p):
        if not rel.startswith('model/'):
            fail(f'{rel} missing')
        continue
    v = fn(p)
    if v > lim:
        fail(f'{rel} is {v:,} B, budget {lim:,} B')
    print(f'  {rel:58s} {v:>11,} B  (budget {lim:,})')

snip_words = sum(used)
cap_words = sum(e['words'] for e in E)
print(f'  snippets {len(snips)}, {snip_words:,} of {cap_words:,} caption words ({100 * snip_words / cap_words:.2f}%)')
if fails:
    print('CHECK FAILED')
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('check.py: all rules pass')
