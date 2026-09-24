# Hot Potato, playable — design notes (Sep 24 2026)

Page: `game/potato.html`. Live: https://learning.recursive.eco/game/potato.html

The sequel to the 64-second recursive.eco ad (`recursive-eco/apps/landing/ads/hot-potato.html`,
on the branch `claude/prayer-for-the-loop` when this was written). Same four scenes (I In
training, II Among us, III The turn, IV Together), same palette, same closing line. Underneath is
the Walk's model, `walk-model.js`, unchanged; the fixed-seed check (seed 1: Adolescence .683,
Lock-in .053, Doom .264) still holds.

## The mapping

| In the ad | In the model |
|---|---|
| Heat of the potato | `s.lastRisk`, the chance it burns this year (shown on a square-root scale of risk/8%, since most years are small) |
| Hands joining in the ring | `s.coordination`, with the stag-hunt bar at `stagK` = 0.60 |
| Toss it on | a year on power: 70 / 10 / 10 / 10 |
| Hold it | a year on alignment: 25 / 50 / 10 / 15 |
| Hold it together, set down on shared ground | the step together, spent mostly on sustainability: 15 / 30 / 45 / 10. Below the bar the year is spent and nothing changes (the model's own rule) |
| I don't know | keep last year's hand |
| Planted, and the spiral | the endings Grace or the sustainable turn |

The link is the Walk's own (`#v1;s=;a=;h=`), so a potato walk opens at the table (`spread.html`)
and on the dashboard with the same years.

## A balance decision, and why

A first version had a separate "Set it down" move (sustainability without the step together). In
1,000 walks it planted 97 times in 100 with no hands at all, which contradicts the ad: there the
potato cools only when it is held together. So setting it down on shared ground is now the step
together itself. Measured over 1,000 walks each:

| Sequence | Planted | Burned | Still in the air | Other |
|---|---|---|---|---|
| Toss it on every year | 0 | 592 | 0 | lock-in 408 |
| Hold it every year | 0 | 99 | 901 | |
| Hold it together from year 1 | 0 | 0 | 1000 (every year spent: the ring never reaches the bar) | |
| Hold five years, then together | 696 | 43 | 261 | |
| Hold five, together twice, then toss | 0 | 275 | 0 | adolescence 534, lock-in 191 |

Holding alone keeps it from burning but plants nothing; reaching for hands too early spends the
years; the way to planting is a sequence: hold until the ring is there, then hold it together.

Honest limit: in this version tossing never pays. The ad's line "if we don't build it, they will"
is a temptation, and the game does not yet make it one. Next step below.

## Round 2, after the first stranger (Sep 24)

- "I don't know" now repeats last year's move exactly, the step together included (year 1: the
  starting hand). Before, after a failed step together it replayed the shared-ground hand without
  the hands, which could plant the potato with nobody holding it.
- The heat is the model's yearly risk without the shock term (what was built against how well it is
  understood), so it rises with every toss and falls only as understanding catches up. A shock is
  shown apart, as a one-year flare; the log says what it added. The bar is linear, 0 to 20%.
- Captions say what happened: "more hands" only when the ring grew; "every toss adds heat" only
  when it did.
- How a walk can end is said before it ends; the moves fold away at the end.
- Phones: the moves sit right under the stage; the ring sits higher so the caption clears it.
- Previews use the same draws for the same state, so the numbers do not change between visits.
- The "designed but not built" line about recursion left the page; it lives here.

## Next

- **The temptation.** A rival that tosses when you hold: each year you do not toss, a chance that
  another lab does, adding capability you did not choose. It needs a model change (a rival term),
  so it goes through the Walk's design doc first, not this page.
- **Why "recursive".** What one walk plants becomes what the next table inherits: a sustainable
  turn lowers the next walk's `shockRate` and raises its `coordGain`; a burn does the reverse.
  Walk after walk, the spiral grows or frays. The spread's Inheritance position already edits
  these same priors, so a second walk can open with them changed and say why.
- **The deck's seats in the ring**, as in Changing Lines: each hand that joins shows its own
  reason (the As-If deck's upright line).
