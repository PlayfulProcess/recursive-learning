# Hot Potato v3.1 -- rule check (Sep 25 2026). These are the GAME's own rules, made up to show one
# idea. Not value-lab's model, not the Walk model. Run: python game/tools/potato_rules_check.py
#
# Changed after playtest round 1 (all six testers won by pressing "Hold it together" every move):
#   - Wren joins only once she has seen you hold it for a while: `wait`, 1 to 4 moves, hidden.
#     Asking is not holding, so only Hold it adds to what she has seen. A toss wipes it.
#   - I don't know: you wait with it on open palms. Your hands take no heat this move (the others
#     take it if they hold it with you) and so rest a step. Flint keeps building.
#   - Heat goes to the coolest hands on it; on a tie, the others before you. Hands that take no heat
#     in a move cool a step (on it or not), so sharing the heat shows on your own hands.
#   - Reed joins once 3 hold it (it's written then), Oak once 4 do; neither while it's scorching.
#   - Too-hot hands can't hold it or ask: only Toss it on or I don't know.
import random, copy
OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak']        # clockwise from you
SEATS = ['you'] + OTHERS
HANDW = ['cool', 'warm', 'sore', 'burning', 'too hot']   # hand steps 0..4
def potw(F):  return 'warm' if F <= 4 else 'hot' if F <= 8 else 'very hot' if F <= 12 else 'scorching'
def lines(F): return {'warm': 1, 'hot': 2, 'very hot': 3, 'scorching': 4}[potw(F)]
START, SCORCH, TOO_HOT, BURNING = 2, 13, 4, 3
WAITS, NEEDS, BURNS = (1, 2, 3, 4), (4, 5), (15, 16)

def new(need, burn, wait):
    # opening: Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands
    return dict(F=START, need=need, burn=burn, wait=wait, seen=0, on=['you'], hands={k: 0 for k in SEATS},
                out=None, log=[], tosses=0, flint_built=0, maxhand=0, hopeless=False)

def enough(s): return len(s['on']) >= s['need']
def deal_heat(s, skip_you=False):
    """Each move it is kept without enough hands, the potato gives off lines of heat (1 warm ..
    4 scorching). Lines go one at a time to the coolest hands on it; ties: the others, then you."""
    got = set()
    if enough(s): return got
    order = [k for k in OTHERS if k in s['on']] + ([] if skip_you else ['you'])
    for _ in range(lines(s['F']) if order else 0):
        k = min(order, key=lambda x: (s['hands'][x], order.index(x)))
        s['hands'][k] = min(TOO_HOT, s['hands'][k] + 1); got.add(k)
    s['maxhand'] = max(s['maxhand'], s['hands']['you'])
    return got
def why(s, k):                              # None = yes. Judged on what they saw BEFORE you asked.
    if k == 'flint': return 'never'
    if s['hands'][k] >= BURNING: return 'burning'
    n, scorch = len(s['on']), s['F'] >= SCORCH
    if k == 'wren': return None if s['seen'] >= s['wait'] else 'not yet'
    if k == 'moss': return None if n >= 2 else 'two'
    if k == 'reed': return 'three' if n < 3 else 'scorching' if scorch else None
    if k == 'oak':  return 'four' if n < 4 else 'scorching' if scorch else None
def joiners(s): return [k for k in OTHERS if k not in s['on'] and why(s, k) is None]
def offered(s):
    if s['out']: return []
    if s['hands']['you'] >= TOO_HOT: return ['toss', 'idk']
    return ['toss', 'idk', 'hold', 'down' if enough(s) and len(s['on']) > 1 else 'together']
def hopeless(s):
    if s['out'] or enough(s) or s['F'] < SCORCH: return False
    reach = len(s['on']) + ('wren' not in s['on']) + ('moss' not in s['on'])
    return reach < s['need']
def flame(s):
    s['F'] += 1
    if s['F'] >= s['burn']: s['out'] = 'burned'
def goes_round(s):
    """Off your hands: the group breaks, your hands are cool at once, Wren forgets what she saw, and
    it goes round the table, a flame for your toss and one for each of the others, back to you."""
    s['on'] = ['you']; s['hands']['you'] = 0; s['seen'] = 0; s['tosses'] += 1
    for _ in SEATS:
        flame(s)
        if s['out']: return
def step(s, v):
    s['log'].append(v); went_round = False; got = set()
    if v == 'toss':
        goes_round(s); went_round = True; got = {'you'}
    elif v == 'hold':
        if len(s['on']) == 1: s['seen'] += 1
        got = deal_heat(s)
    elif v == 'idk':
        if len(s['on']) > 1: got = deal_heat(s, skip_you=True)
    elif v == 'together':
        js = joiners(s)
        s['on'] = ['you'] + [k for k in OTHERS if k in s['on'] or k in js]
        got = deal_heat(s)
    elif v == 'down':
        s['out'] = 'down'; return
    if s['out']: return
    for k in SEATS:                          # hands that took no heat this move cool a step
        if k not in got and s['hands'][k] > 0: s['hands'][k] -= 1
    if not went_round and len(s['on']) < 3:  # Flint builds until three of you hold it
        s['flint_built'] += 1; flame(s)
    if not s['out'] and hopeless(s): s['hopeless'] = True

CODE = {'hold': 'H', 'toss': 'X', 'together': 'T', 'down': 'D', 'idk': 'I'}
REV = {v: k for k, v in CODE.items()}
def run(seq, need, burn, wait):
    s = new(need, burn, wait)
    for c in seq:
        if s['out']: break
        v = REV[c]
        if v not in offered(s): s['log'].append('[' + v + ' not offered]'); break
        step(s, v)
    return s
PATHS = ['TTTTD', 'HTTTD', 'HHTTTD', 'HHHTTTD', 'HHHTTTTD', 'HHHTIHITTTD', 'HHHTIHITTTTD', 'XHHHTTTD',
         'HHHXHHHTTTD', 'IIIIIIII', 'HHHHHHHH', 'XX', 'HHHTTXTTTD', 'HHTHTTTD']
if __name__ == '__main__':
    for wait in WAITS:
        for need in NEEDS:
            burn = 15
            print(f'wait {wait}  need {need}  burn {burn}')
            for p in PATHS:
                s = run(p, need, burn, wait)
                print(f"   {p:14} {(s['out'] or ('no way' if s['hopeless'] else '...')):7} flames={s['F']:2} ({potw(s['F']):9}) "
                      f"pairs={len(s['on'])} seen={s['seen']} worst hands={HANDW[s['maxhand']]:8} last={' '.join(s['log'][-2:])}")
    random.seed(7)
    for noss in (False, True):
        res = {'down': 0, 'burned': 0, 'no way': 0, 'still going': 0}
        for i in range(20000):
            s = new(random.choice(NEEDS), random.choice(BURNS), random.choice(WAITS)); n = 0
            while not s['out'] and not s['hopeless'] and n < 60:
                o = [v for v in offered(s) if not (noss and v == 'toss')]
                step(s, random.choice(o)); n += 1
            res[s['out'] or ('no way' if s['hopeless'] else 'still going')] += 1
        print('random buttons' + (', never toss' if noss else ''), res)
    for v in ('together', 'hold', 'idk', 'toss'):
        w = 0
        for need in NEEDS:
            for burn in BURNS:
                for wait in WAITS:
                    s = new(need, burn, wait); n = 0
                    while not s['out'] and not s['hopeless'] and n < 60:
                        o = offered(s); step(s, 'down' if 'down' in o else v if v in o else 'idk'); n += 1
                    w += s['out'] == 'down'
        print(f'the same button every move ({v}): wins {w} of 16 draws')
