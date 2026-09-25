# Hot Potato v3 -- FINAL rule check. These are the GAME's own rules, made up to show one idea.
# Not value-lab's model, not the Walk model. Run: python model.py
import random, copy
OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak']        # clockwise from you
HANDW  = ['cool', 'warm', 'sore', 'burning', 'too hot']   # hand steps 0..4
def potw(F):  return 'warm' if F <= 4 else 'hot' if F <= 8 else 'very hot' if F <= 12 else 'scorching'
def lines(F): return {'warm': 1, 'hot': 2, 'very hot': 3, 'scorching': 4}[potw(F)]
START, SCORCH = 2, 13

def new(need, burn):
    # opening: Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands
    return dict(F=START, need=need, burn=burn, on=['you'], hands={k: 0 for k in ['you'] + OTHERS},
                written=False, out=None, log=[], tosses=0, flint_built=0, maxhand=0)

def enough(s): return len(s['on']) >= s['need']
def deal_heat(s):
    """Each move the potato is kept, it gives off lines of heat (1 warm .. 4 scorching) unless enough
    hands hold it. Lines go one at a time to the coolest hands on it; ties go to you, then clockwise."""
    if enough(s): return []
    got = []
    order = ['you'] + [k for k in OTHERS if k in s['on']]
    for _ in range(lines(s['F'])):
        k = min(order, key=lambda x: (s['hands'][x], order.index(x)))
        s['hands'][k] = min(4, s['hands'][k] + 1); got.append(k)
    s['maxhand'] = max(s['maxhand'], s['hands']['you'])
    return got
def willing(s, k):                          # judged on what they saw BEFORE you asked
    pairs, scorch = len(s['on']), s['F'] >= SCORCH
    if s['hands'][k] >= 3: return False     # burning hands can't take it
    return {'wren': True, 'moss': pairs >= 2, 'flint': False,
            'reed': s['written'] and not scorch, 'oak': pairs >= 4 and not scorch}[k]
def joiners(s): return [k for k in OTHERS if k not in s['on'] and willing(s, k)]
def offered(s):
    L = ['toss', 'idk']
    if s['hands']['you'] < 4: L.append('hold')
    if enough(s) and len(s['on']) > 1: L.append('down')
    elif joiners(s): L.append('together')
    return L
def flame(s):
    s['F'] += 1
    if s['F'] >= s['burn']: s['out'] = 'burned'
def goes_round(s, yours):
    """Off your hands: the group breaks, the written rule is rubbed out, your hands are cool at once,
    and everyone else tosses it on in turn (a flame each) until it is back with you."""
    s['on'] = ['you']; s['written'] = False; s['hands']['you'] = 0
    if yours: s['tosses'] += 1; flame(s)
    for _ in OTHERS:
        if s['out']: return
        flame(s)
def step(s, v):
    s['log'].append(v); went_round = False
    if v == 'toss':
        goes_round(s, True); went_round = True
    elif v in ('hold', 'idk'):
        if s['hands']['you'] >= 4:          # 'I don't know' with too-hot hands: it slips
            goes_round(s, False); went_round = True
        else: deal_heat(s)
    elif v == 'together':
        s['on'] += joiners(s); deal_heat(s)
    elif v == 'down':
        s['out'] = 'down'; return
    if s['out']: return
    for k in s['hands']:                     # hands off it cool one step a move
        if k not in s['on']: s['hands'][k] = max(0, s['hands'][k] - 1)
    if len(s['on']) >= 3 and not s['written']: s['written'] = True       # written on the ground
    if not went_round and len(s['on']) < 3:                              # Flint builds
        s['flint_built'] += 1; flame(s)

CODE = {'hold': 'H', 'toss': 'X', 'together': 'T', 'down': 'D', 'idk': 'I'}
REV = {v: k for k, v in CODE.items()}
def run(seq, need, burn):
    s = new(need, burn)
    for c in seq:
        if s['out']: break
        v = REV[c]
        if v not in offered(s): s['log'].append('[' + v + ' not offered]'); break
        step(s, v)
    return s
if __name__ == '__main__':
    paths = ['TTTD', 'TTTTD', 'HHXTTTD', 'HHXTTTTD', 'HHXHTTTD', 'HHXHTTTTD', 'XTTTD', 'XTTTTD',
             'HHHHXTTT', 'XX', 'HXHX', 'IIIIIIIIIIII', 'THHHTTD', 'THHHTTTD', 'TTXTTTD', 'TTXTTTTD', 'TTHHHHHTD']
    for need in (4, 5):
        for burn in (15, 16):
            print(f'need {need}  burn {burn}')
            for p in paths:
                s = run(p, need, burn)
                print(f"   {p:14} {(s['out'] or '...'):7} flames={s['F']:2} ({potw(s['F']):9}) pairs={len(s['on'])} "
                      f"worst hands={HANDW[s['maxhand']]:8} last={' '.join(s['log'][-2:])}")
    random.seed(7)
    for need in (4, 5):
        for burn in (15, 16):
            res = {'down': 0, 'burned': 0, None: 0}; n_moves = []
            for _ in range(20000):
                s = new(need, burn); n = 0
                while not s['out'] and n < 80:
                    step(s, random.choice(offered(s))); n += 1
                res[s['out']] += 1; n_moves.append(n)
            n_moves.sort()
            print('random buttons', need, burn, res, 'median moves', n_moves[len(n_moves) // 2])
    def search(need, burn, depth=8):
        wins, stack = {}, [(new(need, burn), '')]
        while stack:
            s, q = stack.pop()
            for v in offered(s):
                t = copy.deepcopy(s); step(t, v); r = q + CODE[v]
                if t['out'] == 'down': wins.setdefault(len(r), []).append(r)
                elif not t['out'] and len(r) < depth: stack.append((t, r))
        return wins
    for need in (4, 5):
        w = search(need, 16); ks = sorted(w)
        tossy = [k for k in ks if any('X' in q for q in w[k])]
        print('need', need, 'shortest win', ks[0], w[ks[0]][:4], '| shortest with a toss', tossy[0], [q for q in w[tossy[0]] if 'X' in q][:3])
