"""Recursive Map grammar -> data/ekho/ekho.json (the Ekho lens). Read-only on the source.

Usage: python scripts/ekho/map_to_ekho.py grammars/recursive-map/grammar.json data/ekho/ekho.json
(Repo-first since Oct 11 2026, her decision: the Recursive Map lives here; recursive-gospels keeps only the seed builder.)
"""
import json, sys, subprocess, pathlib
src, out = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2])
repo = src.parents[2]
commit = subprocess.run(['git', '-C', str(repo), 'log', '-1', '--format=%h', '--', str(src.relative_to(repo))],
                        capture_output=True, text=True).stdout.strip()
g = json.loads(src.read_text(encoding='utf-8'))
nodes = g['nodes']


def sec(n, k):
    return ((n.get('sections') or {}).get(k) or '').strip()


def md(n):
    return n.get('metadata') or {}


def her_first(n):
    t = sec(n, 'Her words')
    if not t:
        return None
    quotes = [q.strip()[1:].strip() for q in t.split('\n\n') if q.strip().startswith('>')]
    return quotes[0] if quotes else None


def cat(c):
    return [n for n in nodes if n.get('category') == c]


def base(n):
    return {'id': n['id'], 'noun': md(n).get('noun'), 'name': n['name'], 'what': sec(n, 'What it is'), 'her_words': her_first(n)}


# The reading axes: each wildcard is read 1 at its "high" face, 0 at the other, 0.5 when the player is not sure;
# the dial is read as set. TARGET gives each ending a point on these axes: a toy sketch of the plan's
# "roughly when", NOT a model, until her engine decision.
AXES = [
    {'id': 'wildcard-ai-and-the-whole', 'kind': 'wildcard', 'high': 'aligned-by-nature'},
    {'id': 'wildcard-humans-as-ai-sees-them', 'kind': 'wildcard', 'high': 'aligned'},
    {'id': 'wildcard-ai-power', 'kind': 'wildcard', 'high': 'unbounded'},
    {'id': 'parameter-relationality', 'kind': 'dial'},
]
TARGET = {'ending-co-regeneration': [0.85, 0.85, 0.6, 0.7], 'ending-teachers-turn': [0.25, 0.5, 0.4, 0.9],
          'ending-containment': [0.85, 0.15, 0.85, 0.3], 'ending-night-then-dawn': [0.5, 0.3, 1.0, 0.3],
          'ending-school-goes-on': [0.15, 0.15, 0.15, 0.15], 'ending-chosen-collaborators': [0.75, 0.4, 0.6, 0.5],
          'ending-promotion': [0.9, 0.9, 0.9, 0.9]}

wildcards = []
for n in cat('wildcard'):
    w = base(n)
    w['faces'] = [{'id': f['id'], 'name': f['name'], 'text': sec(n, 'Face: ' + f['name'] + ' ◇')} for f in md(n).get('faces') or []]
    wildcards.append(w)

out_data = {
    '_about': 'Recursive Ekho, Ekho lens: her lore, generated from the Recursive Map grammar (repo-first in grammars/recursive-map; seeded by the Recursive Gospels session). Every node is lore, a draft. Do not hand-edit: rerun scripts/ekho/map_to_ekho.py after the Recursive Map changes. "axes" and the endings\' "target" are a toy sketch of the plan\'s "roughly when", not a model.',
    'source': {'repo': repo.name, 'path': str(src.relative_to(repo)).replace(chr(92), '/'), 'commit': commit, 'name': g.get('name')},
    'lens': 'ekho', 'lore': True,
    'axes': AXES,
    'wildcards': wildcards,
    'dials': [base(n) for n in cat('parameter')],
    'principles': [base(n) for n in cat('principle')],
    'beings': [base(n) for n in cat('being')],
    'trainings': [dict(base(n), move_kind=md(n).get('move_kind'), adaptive_when=md(n).get('adaptive_when')) for n in cat('training')],
    'strategies': [dict(base(n), adaptive_when=md(n).get('adaptive_when')) for n in cat('strategy')],
    'practices': [dict(base(n), text=sec(n, 'The text'), human=sec(n, 'For a human ◇'), ai=sec(n, 'For an AI ◇'),
                       refs=md(n).get('refs'), adaptive_when=md(n).get('adaptive_when')) for n in cat('practice')],
    'places': [base(n) for n in cat('place')],
    'endings': [dict(base(n), placeholder=md(n).get('name_status') == 'placeholder', target=TARGET.get(n['id'])) for n in cat('ending')],
    'myths': [dict(base(n), parts=n.get('parts') or []) for n in cat('myth')],
}
missing = [e['id'] for e in out_data['endings'] if not e['target']]
assert not missing, missing
ids = {w['id'] for w in wildcards}
assert all(a['id'] in ids for a in AXES if a['kind'] == 'wildcard'), 'an axis names a wildcard the Map does not have'
assert len(out_data['dials']) == 1, 'expected one dial (relationality)'
out.write_text(json.dumps(out_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print('ekho.json from', commit, {k: len(v) for k, v in out_data.items() if isinstance(v, list)})
