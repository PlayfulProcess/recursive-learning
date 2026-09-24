# Hot Potato, playable — design notes (Sep 24 2026)

Pages: `game/potato-others.html` (with others, the default) and `game/potato.html` (alone). Live:
https://learning.recursive.eco/game/potato-others.html and https://learning.recursive.eco/game/potato.html

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

## Round 3, after the panel (Sep 24, lab chat)

Five personas played round 2 (the handoff's "Playtest panel"). Fixed on the solo page:

- The first line names AI: "The AI race is a hot potato: each lab builds faster because the others
  might. Can you get everyone to hold it instead?"
- The ring as people: "3 of 10 people are holding it; you need 6". The count is
  floor(coordination x 10), guarded so it never lands across the bar from the model; ten people
  because the bar (0.60) is exactly 6 of 10 and 4.8 of 8 is not a count. The holders are lit.
- The ending's verdict sits right under the ring.
- Hold it together is dimmed, with one line saying why, while it would be spent. It stays pressable:
  reaching too early and losing the year is part of the lesson (and the model's rule, decision #28).
- The move cards are made once and keep their tallest height, so nothing moves between years;
  phones get a 2 x 2 grid with no empty cell.
- Decision #27 (hers): the small print "planted N, burns M in 100" is gone from the cards. After
  each move one line gives every ending in rough words (almost never / rarely / sometimes / often /
  most times; cut at 0, 5, 25 and 60 in 100) if every remaining year were that move.
- Plain words: endings are Planted in time, Planted on shared ground, Put down together, Through it
  still hot, One lab keeps it, It burned, Still in the air, with the table's name on the end card.
  Adolescence's line follows the ring as it was (it said "partly there" with a full ring). Scene II
  is "Among the labs". Recursive eco-improvement gets one line.
- The table and the dashboard say the endings' names are borrowed labels, not those authors' odds.

## With others (`potato-others.html`, Sep 24; decision #26: beside the solo game, and the default)

Six seats sit in the ring with you, each moving after you, one at a time (0.7 s apart), by one rule
written on the page. The model file is unchanged; the page does three things around it:

- **The year's allocation is the ring's:** the average of the seven hands.
- **The step together** is taken when more than half the ring reaches for it, and the model counts
  it only past the bar (else the year is spent, as before). Seats reach for hands only when they
  would hold and the trust (coordination) is past the bar, so below the bar you reach alone and
  nothing is spent: your hand just goes to shared ground.
- **Each lab's size** is a tally the page keeps: a seat's lab grows by 1 + growth x its own power
  share each year. Tossing grows your own lab fastest; the heat stays the model's, shared. That is
  the temptation the solo game lacked.

The seats: **Racer** (tosses whenever anyone else held last year; holds when nobody did; holds once
the ring has held it together, "a toss would be seen"), **Mirror** (holds when at least 2 others held
last year; one year in ten it slips), **Starter** (holds from the start), **Neighbour**, **Cautious**
and **Late** (join once 1, 2, 3 others held). Above each seat, the one word its rule gives for next
year; under its name, what it did; every move and its reason in the log.

Measured over 1,000 walks (seeds 1 to 1,000, seat slips on their own random stream):

| Your way | Planted | Burned | Through it, still hot | One lab keeps it | Still in the air | Your lab the biggest |
|---|---|---|---|---|---|---|
| Toss it on every year | 0 | 269 | 691 | 40 | 0 | 1000 |
| Hold it every year | 0 | 156 | 309 | 0 | 535 | 0 |
| Hold it, then together once trust is at 6 | 395 | 146 | 286 | 0 | 173 | 0 |
| Toss whenever most of the ring held | 0 | 225 | 762 | 13 | 0 | 451 |
| Hold five years, then toss | 0 | 235 | 753 | 12 | 0 | 459 |

With best play the trust reached the bar in 807 walks in 1,000, in year 8 at the median.

**A design choice for her to check:** the Racer's "a toss would be seen" clause. Without it (a
Racer that tosses whenever anyone held, forever), the same ring planted 0 in 1,000 walks with each of
the five sequences above: in this model the Racer's extra building pushes capability to the crossing before
the shared ground can catch up. With it, holding it together works as a weak form of verification.
Whether that is the right story, or whether a verify move should carry it instead, is hers.

## Next

- **The temptation, in the model.** The "with others" page makes tossing pay at the page level (the
  lab tally). A rival or lead term in the model itself is decision #28 (model v2).
- **Why "recursive".** What one walk plants becomes what the next table inherits: a sustainable
  turn lowers the next walk's `shockRate` and raises its `coordGain`; a burn does the reverse.
  Walk after walk, the spiral grows or frays. The spread's Inheritance position already edits
  these same priors, so a second walk can open with them changed and say why.
- **The deck's seats in the ring**, as in Changing Lines: each hand that joins shows its own
  reason (the As-If deck's upright line).
