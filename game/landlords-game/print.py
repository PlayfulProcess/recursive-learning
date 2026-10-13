"""Print-and-play for 'The Landlord's Game, live again': the board and the deeds, from spaces.json.

    python print.py

Writes print/board.svg (a 10-inch square board) and print/deeds-1.svg, deeds-2.svg ... (US Letter
pages, nine poker-size cards each, 63 x 88 mm, with cut marks). Open a file in a browser and print
at 100% scale. The rules here are in our words; the game itself is public domain.
"""
import html
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'print'
spaces = json.loads((HERE / 'spaces.json').read_text(encoding='utf-8'))['spaces']

COL = {'lot': '#3f8f5a', 'necessity': '#3b6fb6', 'luxury': '#7a4fa0', 'franchise': '#d9a520',
       'railroad': '#2a2a2a', 'legacy': '#b5651d', 'corner': '#e7dcc2', 'poorhouse': '#9a9088'}
INK, PAPER, SOFT = '#2a2420', '#fbf6ea', '#5a5048'
SERIF = "Fraunces, Georgia, 'Times New Roman', serif"
SANS = "Inter, Arial, Helvetica, sans-serif"


def e(s):
    return html.escape(str(s))


def rent(p):
    return max(5, round(p * 0.3 / 5) * 5)


# ---------- the board: the same layout as the page (660 units square) ----------
def board(credits=True, facing=False):
    """The board as an SVG string. credits=False leaves the credit lines off (they go on a colophon);
    facing=True turns each side's words to face the player sitting on that side (for a printed board)."""
    C, S = 84, (660 - 2 * 84) / 9

    def rect(i):
        if i == 0: return (576, 576, C, C)
        if i == 10: return (0, 576, C, C)
        if i == 20: return (0, 0, C, C)
        if i == 30: return (576, 0, C, C)
        if i < 10: return (576 - i * S, 576, S, C)
        if i < 20: return (0, 576 - (i - 10) * S, C, S)
        if i < 30: return (C + (i - 21) * S, 0, S, C)
        return (576, C + (i - 31) * S, C, S)

    def band(i, r):
        x, y, w, h = r; t = 13
        if i < 10: return (x, y, w, t)
        if i < 20: return (x + w - t, y, t, h)
        if i < 30: return (x, y + h - t, w, t)
        return (x, y, t, h)

    def words(name, mx):
        out, line = [], ''
        for w in name.split():
            if len((line + ' ' + w).strip()) > mx and line:
                out.append(line); line = w
            else:
                line = (line + ' ' + w).strip()
        if line: out.append(line)
        return out

    p = ['<svg xmlns="http://www.w3.org/2000/svg" width="10in" height="10in" viewBox="0 0 660 660">',
         f'<rect width="660" height="660" fill="#f4ecd8"/>']
    for i, s in enumerate(spaces):
        r = rect(i); corner = i % 10 == 0
        if facing and not corner:
            p.append(faced(i, s, r, S, C, words)); continue
        p.append(f'<rect x="{r[0]:.2f}" y="{r[1]:.2f}" width="{r[2]:.2f}" height="{r[3]:.2f}" fill="{"#e7dcc2" if corner else PAPER}" stroke="#bfb29a" stroke-width=".8"/>')
        if not corner and s['kind'] != 'poorhouse':
            b = band(i, r)
            p.append(f'<rect x="{b[0]:.2f}" y="{b[1]:.2f}" width="{b[2]:.2f}" height="{b[3]:.2f}" fill="{COL[s["kind"]]}"/>')
        lines = words(s['name'], 11 if corner else 8)
        cx, cy = r[0] + r[2] / 2, r[1] + r[3] / 2 - (len(lines) - 1) * 5
        if not corner:
            if i < 10: cy += 6
            elif 20 < i < 30: cy -= 6
            elif 10 < i < 20: cx -= 6
            elif i > 30: cx += 6
        size, weight = (10.5, 600) if corner else (8.6, 500)
        p.append(f'<text text-anchor="middle" font-family="{SANS}" font-size="{size}" font-weight="{weight}" fill="{INK}">'
                 + ''.join(f'<tspan x="{cx:.2f}" y="{cy + k * 10:.2f}">{e(l)}</tspan>' for k, l in enumerate(lines)) + '</text>')
        sub = f'${s["price"]}' if s.get('price') else {'necessity': 'pay $20', 'luxury': 'luxury', 'legacy': '+$100'}.get(s['kind'], '')
        if s.get('lot'): sub = f'Lot {s["lot"]} · {sub}'
        if sub:
            p.append(f'<text x="{cx:.2f}" y="{cy + len(lines) * 10 + 4:.2f}" text-anchor="middle" font-family="{SANS}" font-size="7.6" fill="{SOFT}">{e(sub)}</text>')
    p.append(f'<text x="330" y="250" text-anchor="middle" font-family="{SERIF}" font-size="32" font-weight="600" fill="{INK}">The Landlord’s Game</text>'
             f'<text x="330" y="276" text-anchor="middle" font-family="{SANS}" font-size="11" letter-spacing="3" fill="#8a3b24">{"LIVE AGAIN · AFTER LIZZIE MAGIE, 1904" if credits else "LIVE AGAIN"}</text>'
             f'<rect x="250" y="310" width="160" height="70" rx="10" fill="#fff" stroke="#bfb29a"/>'
             f'<text x="330" y="338" text-anchor="middle" font-family="{SANS}" font-size="11" letter-spacing="2" fill="{SOFT}">PUBLIC TREASURY</text>'
             f'<text x="330" y="364" text-anchor="middle" font-family="{SANS}" font-size="10" fill="{SOFT}">put its money here</text>'
             + lap_track()
             + (f'<text x="330" y="540" text-anchor="middle" font-family="{SANS}" font-size="10" fill="{SOFT}">Game: public domain (US 748,626 · 1,509,312). This board: CC BY-SA 4.0, PlayfulProcess.</text>' if credits else '')
             + '</svg>')
    return '\n'.join(p)


def lap_track():
    """Round 2 playtest: both games end when every player still in has been round five times, so the
    table needs to count laps. Each player moves a cube of their colour one box at each pass of Mother Earth."""
    out = [f'<text x="330" y="412" text-anchor="middle" font-family="{SANS}" font-size="11" letter-spacing="2" fill="{SOFT}">LAPS · MOVE YOUR CUBE AT EACH PASS OF MOTHER EARTH</text>']
    w, gap = 46, 8
    x0 = 330 - (5 * w + 4 * gap) / 2
    for k in range(5):
        x = x0 + k * (w + gap)
        out.append(f'<rect x="{x:.1f}" y="424" width="{w}" height="{w}" rx="6" fill="#fff" stroke="#bfb29a"/>'
                   f'<text x="{x + w / 2:.1f}" y="{424 + w / 2 + 8:.1f}" text-anchor="middle" font-family="{SERIF}" font-size="22" fill="#d6cbb4">{k + 1}</text>')
    out.append(f'<text x="330" y="494" text-anchor="middle" font-family="{SANS}" font-size="10" fill="{SOFT}">When every player still in reaches 5, the game ends.</text>')
    return ''.join(out)


def faced(i, s, r, S, C, words):
    """One side space drawn as if on the bottom row (S wide, C tall, its colour band on the inner edge),
    then turned to face the player on its side of the table."""
    x, y = r[0], r[1]
    if i < 10: tf = f'translate({x:.2f} {y:.2f})'
    elif i < 20: tf = f'translate({C:.2f} {y:.2f}) rotate(90)'
    elif i < 30: tf = f'translate({x + S:.2f} {C:.2f}) rotate(180)'
    else: tf = f'translate({x:.2f} {y + S:.2f}) rotate(-90)'
    g = [f'<g transform="{tf}">', f'<rect width="{S:.2f}" height="{C:.2f}" fill="{PAPER}" stroke="#bfb29a" stroke-width=".8"/>']
    if s['kind'] != 'poorhouse':
        g.append(f'<rect width="{S:.2f}" height="13" fill="{COL[s["kind"]]}"/>')
    lines = words(s['name'], 8)
    cx, cy = S / 2, C / 2 - (len(lines) - 1) * 5 + 6
    g.append(f'<text text-anchor="middle" font-family="{SANS}" font-size="8.6" font-weight="500" fill="{INK}">'
             + ''.join(f'<tspan x="{cx:.2f}" y="{cy + k * 10:.2f}">{e(l)}</tspan>' for k, l in enumerate(lines)) + '</text>')
    sub = f'${s["price"]}' if s.get('price') else {'necessity': 'pay $20', 'luxury': 'luxury', 'legacy': '+$100'}.get(s['kind'], '')
    if s.get('lot'): sub = f'Lot {s["lot"]} · {sub}'
    if sub:
        g.append(f'<text x="{cx:.2f}" y="{cy + len(lines) * 10 + 4:.2f}" text-anchor="middle" font-family="{SANS}" font-size="7.6" fill="{SOFT}">{e(sub)}</text>')
    g.append('</g>')
    return ''.join(g)


# ---------- the deeds: 63 x 88 mm cards drawn in 630 x 880 units ----------
FOOTER = 'The Landlord’s Game, live again · after Lizzie Magie'


def frame(edge):
    """The card's paper. edge=False drops the outline (a printer's cut drifts, and an edge line shows it)."""
    return f'<rect width="630" height="880" rx="28" fill="{PAPER}" stroke="#bfb29a" stroke-width="3"/>' if edge else ''


def deed(s, footer=FOOTER, edge=True):
    kind, col = s['kind'], COL[s['kind']]
    head = {'lot': f'LOT {s.get("lot", "")} · TITLE DEED', 'railroad': 'RAILROAD', 'franchise': 'FRANCHISE'}[kind]
    if kind == 'lot':
        a = [f'Price ${s["price"]}', f'Rent ${rent(s["price"])}', f'Three lots on this side: rent ${2 * rent(s["price"])}']
        b = [f'Price ${s["price"]}: every other player gains $10.', f'Ground rent ${rent(s["price"])} goes to the Public Treasury.']
    elif kind == 'railroad':
        a = [f'Price ${s["price"]}', 'Fare $25 for each railroad its owner holds']
        b = ['Not for sale. Public: a $10 fare to the Treasury.']
    else:
        a = [f'Price ${s["price"]}', 'Fee: four times the roll']
        b = ['Not for sale. Public: a $10 fee to the Treasury.']
    g = [frame(edge),
         f'<rect x="30" y="30" width="570" height="170" rx="14" fill="{col}"/>',
         f'<text x="315" y="92" text-anchor="middle" font-family="{SANS}" font-size="24" letter-spacing="4" fill="#fff">{e(head)}</text>',
         f'<text x="315" y="160" text-anchor="middle" font-family="{SERIF}" font-size="52" font-weight="600" fill="#fff">{e(s["name"])}</text>',
         f'<text x="60" y="270" font-family="{SANS}" font-size="22" letter-spacing="3" fill="#8a3b24">THE LANDLORD’S WAY</text>']
    y = 320
    for line in a:
        words, cur, rows = line.split(), '', []
        for w in words:   # wrap a long line (the railroad's fare) inside the card's safe area
            if len(cur) + len(w) + 1 > 34: rows.append(cur); cur = w
            else: cur = (cur + ' ' + w).strip()
        rows.append(cur)
        for k, r in enumerate(rows):
            g.append(f'<text x="60" y="{y}" font-family="{SANS}" font-size="30" fill="{INK}">{e(r)}</text>'); y += 40 if k < len(rows) - 1 else 50
    y += 30
    g.append(f'<line x1="60" y1="{y - 40}" x2="570" y2="{y - 40}" stroke="#bfb29a" stroke-width="2"/>')
    g.append(f'<text x="60" y="{y + 10}" font-family="{SANS}" font-size="22" letter-spacing="3" fill="#3f8f5a">PROSPERITY</text>'); y += 60
    for line in b:
        words, cur, rows = line.split(), '', []
        for w in words:
            if len(cur) + len(w) + 1 > 34: rows.append(cur); cur = w
            else: cur = (cur + ' ' + w).strip()
        rows.append(cur)
        for r in rows:
            g.append(f'<text x="60" y="{y}" font-family="{SANS}" font-size="28" fill="{INK}">{e(r)}</text>'); y += 42
        y += 8
    g.append(f'<text x="315" y="840" text-anchor="middle" font-family="{SANS}" font-size="18" fill="{SOFT}">{e(footer)}</text>')
    return ''.join(g)


def rules_card(title, lines, col, edge=True):
    g = [frame(edge),
         f'<rect x="30" y="30" width="570" height="120" rx="14" fill="{col}"/>',
         f'<text x="315" y="108" text-anchor="middle" font-family="{SERIF}" font-size="44" font-weight="600" fill="#fff">{e(title)}</text>']
    y = 210
    for line in lines:
        words, cur, rows = line.split(), '', []
        for w in words:
            if len(cur) + len(w) + 1 > 40: rows.append(cur); cur = w
            else: cur = (cur + ' ' + w).strip()
        rows.append(cur)
        for k, r in enumerate(rows):
            g.append(f'<text x="60" y="{y}" font-family="{SANS}" font-size="24" fill="{INK}">{"• " if k == 0 else "  "}{e(r)}</text>'); y += 33
        y += 10
    return ''.join(g)


RULES_LANDLORD = ('The landlord’s way', [
    'The poorest goes first. Passing Mother Earth: $100 and one lap.', 'Buy free land, railroads, franchises (price into the Treasury); others pay you rent.',
    'Necessities: $20 to the Treasury. Luxury: a $50 ticket worth $60, or lose a turn.', 'No Trespassing: Jail. Doubles free you, or pay $50; the third try pays.',
    'Short of cash: sell land of your choice to the bank at half price; then the Poorhouse, out.', 'When all still in have five laps, the richest wins: cash, land, $60 a ticket.'], '#8a3b24')
RULES_PROSPERITY = ('Prosperity', [
    'Buy a lot: price into the Treasury; every other player gains $10.', 'Ground rent goes to the Treasury, not the owner.', 'Railroads and franchises are public: a $10 fare.',
    'Luxury: $50 to the Treasury, no ticket, or lose a turn.', 'Passing Mother Earth: the Treasury pays half its money to all, equally.',
    'Poorhouse: your land goes back; leave from Mother Earth with $50.', 'All win when the poorest starter has doubled, holds as much as anyone, and nobody has less than their start (equal starts: all double). Five laps each first: lost.'], '#3f8f5a')


def deed_spaces():
    return [s for s in spaces if s['kind'] in ('lot', 'railroad', 'franchise')]


def all_cards(footer=FOOTER, edge=True):
    """Every card face (630 x 880 units): the deeds, then the two rules cards."""
    return ([deed(s, footer=footer, edge=edge) for s in deed_spaces()]
            + [rules_card(*RULES_LANDLORD, edge=edge), rules_card(*RULES_PROSPERITY, edge=edge)])


def main():
    OUT.mkdir(exist_ok=True)
    cards = all_cards()
    MM = 1  # page units are millimetres (US Letter 215.9 x 279.4)
    CW, CH = 63, 88
    X0, Y0 = (215.9 - 3 * CW) / 2, (279.4 - 3 * CH) / 2
    pages = [cards[i:i + 9] for i in range(0, len(cards), 9)]
    for n, page in enumerate(pages, 1):
        p = ['<svg xmlns="http://www.w3.org/2000/svg" width="215.9mm" height="279.4mm" viewBox="0 0 215.9 279.4">',
             '<rect width="215.9" height="279.4" fill="#fff"/>']
        for k, c in enumerate(page):
            x, y = X0 + (k % 3) * CW, Y0 + (k // 3) * CH
            p.append(f'<svg x="{x:.2f}" y="{y:.2f}" width="{CW}" height="{CH}" viewBox="0 0 630 880">{c}</svg>')
        # cut marks on the grid lines
        for i in range(4):
            x = X0 + i * CW
            p.append(f'<line x1="{x:.2f}" y1="{Y0 - 6:.2f}" x2="{x:.2f}" y2="{Y0 - 1.5:.2f}" stroke="#999" stroke-width=".2"/>'
                     f'<line x1="{x:.2f}" y1="{Y0 + 3 * CH + 1.5:.2f}" x2="{x:.2f}" y2="{Y0 + 3 * CH + 6:.2f}" stroke="#999" stroke-width=".2"/>')
            y = Y0 + i * CH
            p.append(f'<line x1="{X0 - 6:.2f}" y1="{y:.2f}" x2="{X0 - 1.5:.2f}" y2="{y:.2f}" stroke="#999" stroke-width=".2"/>'
                     f'<line x1="{X0 + 3 * CW + 1.5:.2f}" y1="{y:.2f}" x2="{X0 + 3 * CW + 6:.2f}" y2="{y:.2f}" stroke="#999" stroke-width=".2"/>')
        p.append('</svg>')
        (OUT / f'deeds-{n}.svg').write_text('\n'.join(p), encoding='utf-8', newline='\n')

    (OUT / 'board.svg').write_text(board(), encoding='utf-8', newline='\n')
    print('board.svg +', len(pages), 'deed pages,', len(cards), 'cards')


if __name__ == '__main__':
    main()
