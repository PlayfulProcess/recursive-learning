# Recursive Ekho, the board game

A draft you can play in the browser, alone or with up to four seats: seven hollows of beads
(Grace, The turn, The Stop, Adolescence, Lock-in, Doom, Still walking), a rising tide, a veiled
world and a Council. Your moves shift beads toward better hollows; when the tide reaches the
Crossing, every veil lifts and one bead is drawn from the bag. Odds, not paths: a toy model with
made-up numbers, about how the game plays and nothing about the world. No real person appears in it.

| File | What |
|---|---|
| `index.html` | the page (the rules and the line icons are inlined) |
| `engine.js` | the rules as code, deterministic from a seed (rules version 4) |
| `playtest.mjs` | bot games, balance grids and hand play from the command line: `node playtest.mjs sim --games 1000` |
| `../../tests/ekho-engine.test.mjs` | `node --test tests/*.test.mjs`: determinism, a Council that passes and fails, every ending reachable, balance in a band; also that `index.html` inlines `engine.js` byte for byte |

`index.html` carries a copy of `engine.js` inline; after changing the engine, copy it in again (the test fails until you do). `index.html?seed=N` deals the first game from seed N.

These were made in recursive.eco's workshop and copied here; the page's head, colours (the hollow
hues are `--ek-*` in `site/theme.css`), header and footer were changed to fit this site.

## Licence

The edition's rules, names and words are by PlayfulProcess under CC BY-SA 4.0
([`LICENSE-CONTENT.txt`](../../LICENSE-CONTENT.txt)); the code (`index.html`, `engine.js`,
`playtest.mjs`) is Apache-2.0 ([`LICENSE`](../../LICENSE)).
