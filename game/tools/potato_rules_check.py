# Hot Potato v3.2 -- rule check (Sep 25 2026). These are the GAME's own rules, made up to show one
# idea. Not value-lab's model, not the Walk model. Run: python game/tools/potato_rules_check.py
#
# Changed after playtest round 2 (hold held, but asking too soon looked like holding and didn't
# count; Wren's hidden number made asking a guess; one toss decided the game; the middle was a
# hold/rest grind; after Wren joined nothing was left to decide; it burned by itself):
#   - Nothing that decides the game is hidden except the fire (15 or 16). Wren's number is printed.
#   - A button is offered only when it will do what it says: Hold it together once Wren would say yes.
#   - Hold it: one step of heat to your hands (cool, warm, sore, too hot), whatever the potato's heat.
#   - One ask brings the chain: Wren, then Moss follows her, Reed follows Moss, Oak follows Reed.
#     Reed and Oak won't touch it while it's scorching.
#   - Three or more holding it: Flint stops and it cools a flame a move. Nothing burns by itself.
#   - A toss: +6 flames, your hands cool, Wren crosses out ONE hold she saw.
#   - I don't know: you bounce it from hand to hand; your hands cool a step; it isn't holding.
#   - Rounds: (start 2, Wren 2), (2, 4), (5, 5), then random (start 2-5, Wren 2-5).
import copy
OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak']        # clockwise from you
SEATS = ['you'] + OTHERS
CHAIN = ['wren', 'moss', 'reed', 'oak']                  # each follows the one before
HANDW = ['cool', 'warm', 'sore', 'too hot']              # your hands, steps 0..3
TOO_HOT, SCORCH, NEED = 3, 13, 5
BURNS = (15, 16)
ROUNDS = [(2, 2), (2, 4), (5, 5)]                        # (start, wait)
def potw(F): return 'warm' if F <= 4 else 'hot' if F <= 8 else 'very hot' if F <= 12 else 'scorching'

def new(start, wait, burn):
    return dict(F=start, wait=wait, burn=burn, seen=0, on=['you'], hand=0, out=None, log=[], maxF=start, tosses=0)
def alone(s): return len(s['on']) == 1
def enough(s): return len(s['on']) >= NEED
def ready(s): return s['seen'] >= s['wait']
def answers(s):
    on, out, stop = list(s['on']), [], False
    for k in CHAIN:
        if k in on: continue
        if k == 'wren': w = None if ready(s) else 'not yet'
        elif k in ('reed', 'oak') and s['F'] >= SCORCH: w = 'scorching'
        elif stop: w = 'waits'
        else: w = None
        if w is None: on.append(k)
        else: stop = True
        out.append((k, w))
    return out
def offered(s):
    if s['out']: return []
    L = ['toss']
    if alone(s):
        if s['hand'] < TOO_HOT: L.append('hold')
        L.append('idk')
        if ready(s): L.append('together')
    else: L.append('together')
    if enough(s): L.append('down')
    return L
def flame(s):
    s['F'] += 1; s['maxF'] = max(s['maxF'], s['F'])
    if s['F'] >= s['burn']: s['out'] = 'burned'
def end_move(s):
    if len(s['on']) < 3: flame(s)                      # Flint adds a flame until three hold it
    elif s['F'] > 1: s['F'] -= 1                       # three or more: it cools a flame
def step(s, v):
    s['log'].append(v)
    if v == 'toss':
        if s['seen'] > 0: s['seen'] -= 1
        s['on'] = ['you']; s['hand'] = 0; s['tosses'] += 1
        for _ in SEATS:                                # your toss, then each of the five others
            flame(s)
            if s['out']: return
        return
    if v == 'hold':
        s['seen'] += 1; s['hand'] = min(TOO_HOT, s['hand'] + 1)
    elif v == 'idk':
        s['hand'] = max(0, s['hand'] - 1)
    elif v == 'together':
        yes = [k for k, w in answers(s) if w is None]
        s['on'] = ['you'] + [k for k in CHAIN if k in s['on'] or k in yes]
        s['hand'] = max(0, s['hand'] - 1)              # the others take the heat
    elif v == 'down':
        s['out'] = 'down'; return
    end_move(s)

CODE = {'hold': 'H', 'toss': 'X', 'together': 'T', 'down': 'D', 'idk': 'I'}
REV = {v: k for k, v in CODE.items()}
def run(seq, start, wait, burn):
    s = new(start, wait, burn)
    for c in seq:
        if s['out']: break
        v = REV[c]
        if v not in offered(s): s['log'].append('[' + v + ' not offered]'); break
        step(s, v)
    return s
PATHS = ['HHTD', 'HHHIHTD', 'HHHIHIHTD', 'XHHTD', 'HHHXHHTTD', 'HHHIIHIHTTD', 'IIIIIIIIIIIII', 'HHHHHHHH', 'XX',
         'HHHXHHHTTTD', 'HHTXHHTD']
if __name__ == '__main__':
    for start, wait in ROUNDS:
        for burn in BURNS:
            print(f'start {start}  Wren wants {wait}  fire at {burn}')
            for p in PATHS:
                s = run(p, start, wait, burn)
                print(f"   {p:14} {(s['out'] or '...'):7} flames={s['F']:2} hottest={s['maxF']:2} ({potw(s['maxF']):9}) "
                      f"pairs={len(s['on'])} seen={s['seen']} hands={HANDW[s['hand']]:8} last={' '.join(s['log'][-2:])}")
