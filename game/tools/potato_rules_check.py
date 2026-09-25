# Hot Potato v4 -- rule check (Sep 25 2026). These are the GAME's own rules, made up to show one
# idea. Not value-lab's model, not the Walk model. Run: python game/tools/potato_rules_check.py
#
# Changed after playtest round 3 (Hold held and everyone understood it, but five of six said it
# wasn't fun: one recipe won every round, a toss was never worth it, and holding didn't hold back
# any heat, since Flint added his flame whether you held it or not):
#   - Hold it holds back YOUR flame: you add none, Flint still adds his (+1 a move in all).
#     Bounce it (was "I don't know") means you carry on: you add a flame too (+2 a move in all).
#   - The race pays: you start each round with 5 coins. Bounce it: +1 coin. Toss it on: +5 coins.
#     Put it down and you keep your coins; if it catches fire, everyone's coins burn.
#   - The fire is somewhere from 9 to 16 flames (the striped boxes), any box as likely, drawn fresh
#     each round. Playing it safe never reaches the stripes in rounds 1-3; racing does.
#   - Five holding it: Hold it together isn't offered (nothing left to do but put it down, or toss).
#     Three holding a scorching potato cool it a flame a move, and Reed and Oak join by themselves
#     once it's below scorching.
#   - Rounds: (start 2, Wren 2), (2, 4), (3, 2), then random ones where playing it safe stays out of
#     the stripes (some leave room to race, some none).
import copy
OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak']        # clockwise from you
SEATS = ['you'] + OTHERS
CHAIN = ['wren', 'moss', 'reed', 'oak']                  # each follows the one before
HANDW = ['cool', 'warm', 'sore', 'too hot']              # your hands, steps 0..3
TOO_HOT, SCORCH, NEED, TOP, LO = 3, 13, 5, 16, 9
BANK, BOUNCE_COINS, TOSS_COINS = 5, 1, 5
FIRES = list(range(LO, TOP + 1))                         # hidden, any of these as likely
ROUNDS = [(2, 2), (2, 4), (3, 2)]                        # (start, wait)
FREE = [(2, 2), (2, 3), (2, 4), (3, 2), (3, 3), (4, 2), (4, 3), (5, 2), (5, 3)]  # random: safe play stays out of the stripes
def potw(F): return 'warm' if F <= 4 else 'hot' if F <= 8 else 'very hot' if F <= 12 else 'scorching'

def new(start, wait, burn):
    return dict(F=start, wait=wait, burn=burn, seen=0, on=['you'], hand=0, out=None, log=[], maxF=start,
                coins=BANK, flint=BANK, tosses=0)
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
        L.append('bounce')
        if ready(s): L.append('together')
    elif not enough(s): L.append('together')
    if enough(s): L.append('down')
    return L
def flame(s):
    s['F'] += 1; s['maxF'] = max(s['maxF'], s['F'])
    if s['F'] >= s['burn']: s['out'] = 'burned'; s['coins'] = 0; s['flint'] = 0
def join(s):
    yes = [k for k, w in answers(s) if w is None]
    s['on'] = ['you'] + [k for k in CHAIN if k in s['on'] or k in yes]
def end_move(s):
    if len(s['on']) < 3:                               # Flint adds a flame (and wins a coin)
        s['flint'] += 1; flame(s)
    elif s['F'] >= SCORCH:                             # three or more: Flint stops; scorching cools
        s['F'] -= 1
        if s['F'] < SCORCH: join(s)                    # Reed and Oak join once it's below scorching
def step(s, v):
    s['log'].append(v)
    if v == 'toss':
        if s['seen'] > 0: s['seen'] -= 1
        s['on'] = ['you']; s['hand'] = 0; s['tosses'] += 1; s['coins'] += TOSS_COINS
        for _ in SEATS:                                # your toss, then each of the five others
            flame(s)
            if s['out']: return
        return
    if v == 'hold':
        s['seen'] += 1; s['hand'] = min(TOO_HOT, s['hand'] + 1)
    elif v == 'bounce':
        s['hand'] = max(0, s['hand'] - 1); s['coins'] += BOUNCE_COINS
        flame(s)                                       # you carry on: your flame
        if s['out']: return
    elif v == 'together':
        join(s)
        s['hand'] = max(0, s['hand'] - 1)              # the others take the heat
    elif v == 'down':
        s['out'] = 'down'; return
    end_move(s)

CODE = {'hold': 'H', 'toss': 'X', 'together': 'G', 'down': 'D', 'bounce': 'B'}
REV = {v: k for k, v in CODE.items()}
def run(seq, start, wait, burn):
    s = new(start, wait, burn)
    for c in seq:
        if s['out']: break
        v = REV[c]
        if v not in offered(s): s['log'].append('[' + v + ' not offered]'); break
        step(s, v)
    return s
PATHS = ['HHGD', 'HHBBGD', 'XHHGD', 'HHGXHGD', 'HHHBHGD', 'HHHXHHGGD', 'BBBBBBBB', 'HHHHHH', 'XX', 'HHHGD',
         'BHHHGD', 'XHHHGGGD']
if __name__ == '__main__':
    for start, wait in ROUNDS:
        for burn in (9, 12, 16):
            print(f'start {start}  Wren wants {wait}  fire at {burn}')
            for p in PATHS:
                s = run(p, start, wait, burn)
                print(f"   {p:12} {(s['out'] or '...'):7} flames={s['F']:2} hottest={s['maxF']:2} ({potw(s['maxF']):9}) "
                      f"coins={s['coins']:2} Flint={s['flint']:2} pairs={len(s['on'])} seen={s['seen']} "
                      f"hands={HANDW[s['hand']]:8} last={' '.join(s['log'][-2:])}")
