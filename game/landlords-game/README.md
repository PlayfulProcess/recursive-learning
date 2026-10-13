# The Landlord's Game, live again

Lizzie Magie's board game, patented in 1904 (US 748,626) and again in 1924 (US 1,509,312), both
public domain, rebuilt with both of her rule sets on one board:

- **The landlord's way.** Buy land, collect rent, and the richest player wins when everyone has
  been round five times. Unequal starting money, so the table can see how much the deal decides.
- **Prosperity.** The same board under the single tax: ground rent goes to the Public Treasury,
  the Treasury pays half of what it holds to everyone at each pass of Mother Earth, and the table
  wins or loses together.

After one game each way the table answers one question: which felt more exciting, and why?

## Play

- **On a screen:** [`index.html`](index.html) (on the site: `/game/landlords-game/`). Two to four
  players, any of them played by the computer, and a button that runs 300 games each way.
- **On a table:** print [`print/board.svg`](print/board.svg) (18 in square) and the four deed
  sheets [`print/deeds-1.svg`](print/deeds-1.svg) to `deeds-4.svg` (28 title deeds and the two
  rules cards, nine to a page, with cut marks). Add two dice, a pawn and a small cube per player
  (the cube marks laps on the board's lap track), and play money.
- **As a grammar:** [`../../grammars/landlords-game-live-again/grammar.json`](../../grammars/landlords-game-live-again/grammar.json),
  one node per space, the two rule sets and the story as nodes, the board order as a selection.

## How Prosperity was tuned (Oct 12 2026)

The first version of Prosperity was won in every bot game, in about nine rounds, whatever anyone
chose: the poorest player starts with $200, and two wages are $200. PlayfulProcess asked: "If everyone wins
in Prosperity every time, is it fun?" One change to the win condition followed, chosen from ten
candidates measured on 1,000 bot games each:

> Everyone wins together when the player who started with the least has doubled it and holds at
> least as much as anyone, while nobody holds less than they started with: the poorest rises to
> the top, and nobody falls.

The doubling is the win as Ketcham (Harper's, 2012) and Pilon (*The Monopolists*, 2015) report
Magie's Prosperity rule; the other two parts are ours. With starts of $200, $350 and $500:

| Bot games, 1,000 each | Before | After |
|---|---|---|
| Everyone wins | 100% | 69.9% |
| Rounds, median | 9 | 23 |
| Four players ($200 to $800) | 100% | 34.5% |
| Equal $500 starts (every player must double) | 24.6% | 24.6% |
| Richer players buy land, the poorest does not | 100% | 94.2% |
| Nobody buys land | 100% | 16.8% |
| The poorest buys land | 51.5% | 0% |

So the richer players' "buy?" became a real question: buying fills the Treasury, which pays
everyone equally, but a player who buys too much falls below their own start. These numbers come
from bots with fixed habits; people at a table may do better or worse.

Re-run any of them with `node playtest.mjs tension --games 1000` (or `sim`, `policies`,
`physical`, and `new` / `act` to play by hand at the command line). `engine.js` is the rules as
code, shared by the page and `playtest.mjs`.

## Files

| File | What |
|---|---|
| `index.html` | the page (the engine and the board data are inlined) |
| `engine.js` | the rules as code; the old rules stay as variants (`DEFAULT_RULES`) |
| `spaces.json` | the forty spaces: names, kinds, prices |
| `playtest.mjs` | bot games with invariants, choice experiments, hand play from the command line |
| `print.py`, `print/*.svg` | the print-and-play board and cards, drawn from `spaces.json` |

These were made in recursive.eco's workshop and copied here; the page's head, colours and footer
were changed to fit this site.

## Credits and licence

The game is public domain: Lizzie Magie, US patents 748,626 (1904) and 1,509,312 (1924). From the
1904 patent: the price of land paid into the Public Treasury, the $60 luxury ticket, Jail by
doubles or a $50 fine, and the end when the last player has passed Mother Earth the fifth time;
from the 1924 patent, choosing what to sell when short of cash. Broadway, Fifth Avenue and Wall
Street are the names reported from the 1906 edition.

This edition's board layout, street names, amounts, cards and words are by PlayfulProcess under
CC BY-SA 4.0 ([`LICENSE-CONTENT.txt`](../../LICENSE-CONTENT.txt)); the code (`index.html`,
`engine.js`, `playtest.mjs`, `print.py`) is Apache-2.0 ([`LICENSE`](../../LICENSE)).
