# The games

Two standalone rounds live here. `index.html` is **As-If**; `walk.html` is **The Walk**. Neither has a framework, a CDN or a build step; the only requests are the spread's card art. Both
work from GitHub Pages and from a file opened straight off disk.

---

# The Walk — conditional probability as a game

Two faces of the same walk share one model (`walk-model.js`, loaded as a plain script) and one
URL hash, so a link to either opens in the other:

- **`spread.html` — the spread.** Three positions on a table, read the way a tarot spread is
  read. **1 · The Node**: the card we stand on (allocation strip, step, capability, coordination).
  **2 · The Inheritance**: the sixteen constants as three cards — *Capability grows with power*,
  *A shock can end everything*, *Stopping needs company* — turn one over and its numbers are
  there to change. **3 · The Horizon**: the seven endings, each with its live share, dealt
  upright or reversed from the cast's seed, art on the face, the source text and a generous or
  cynical reading on the back. *Cast again* deals a new table (a new seed; the Inheritance stays).
  Under the table: your hand (the four sliders), *What changed* in words, and **the ending as
  fiction** — a box to write the likeliest (or the reached) ending as a scene, kept in the
  browser and included by *Copy the reading*. The art is public-domain minhwa on Wikimedia
  Commons, fetched as server-side thumbnails (`Special:FilePath?width=480`, never the full scan:
  one of them is 15,000 px wide) and credited at the foot of the page. The upright/reversed lines
  on the endings are the page's own words, hers to edit in `CARDS`.
- **The Step and the casting (Sep 21).** Position 5 on the spread reads the deck's `action`
  cards (keywords `action` + one of `take` / `slack` / `ratchet` / `gift`; a card with
  `metadata.status: "parked"` is skipped): who can do this, the move, both faces of the coin, the
  kind visible on the face. The player takes one and writes the asymmetry. **Copy my casting**
  puts the block from `PLAN-as-if-data-and-coordination-2026-09-21.md` §2A on the clipboard: deck
  id, cast seed and link, the node, the inheritance, the horizon with faces, the seats with faces,
  the forecast and confidence, the reading, the step with its kind and card id, the two forgiveness
  lines, the asymmetry, the synthesis, a timestamp and the consent line. `FORM_URL` near the Step
  code is empty until she makes the form; once set, a **Send it** button opens it.
- **`potato.html` — Hot Potato (v4, Sep 25; v3 rebuilt from scratch Sep 24).** "The race to build
  AI is a hot potato." Three short rounds, then random ones. You start each round with 5 coins.
  **Hold it** keeps it in your hands and slows you down: you add no flame (only Flint adds his), your
  hands heat a step and Wren counts it (her seat prints how many holds she wants). **Bounce it**
  carries on: +1 coin, but your flame and Flint's (+2). **Toss it on** races: +5 coins and cool hands,
  but everyone races after you (+6 flames) and Wren crosses out a hold. The fire hides somewhere in
  the striped boxes (9 to 16 flames); if it catches, everyone's coins burn. **Hold it together** lights
  up once Wren is ready: she says yes and Moss, Reed and Oak follow (Reed and Oak not while it's
  scorching); three holding it stops Flint. With five pairs of hands, **Put it down** and keep your
  coins. The rules are the game's own, small enough to print (`potato-model.js`, checked against
  `tools/potato_rules_check.py` by `tools/potato_port_check.mjs`; `tools/potato_solve.mjs` checks
  that each round asks for a choice). Notes, why v1 was replaced ("Hold it did not hold it") and what
  playtest rounds 1 to 3 changed: `DESIGN-potato.md`.
- **`potato-others.html`** only redirects to `potato.html`, so old links still work. **`potato-v1/`**
  keeps the first version (with others, and alone, on the Walk's model) and its notes.
- **`lines.html` — Changing Lines (prototype, Sep 22).** A second game for the same lesson, built on
  the I Ching's sixteen-marble bowl (the yarrow odds). Six lines, bottom to top, each a stage of an
  AI future; before each draw a move changes the marbles, so the chance of every line belongs to the
  bowl given the path. At the end the turning lines are drawn one at a time to the hexagram they lead
  to, then the same hexagram is priced under three paths and walked a hundred times. Legge's text
  (public domain) is read live from iching.recursive.eco. Design and research: `DESIGN-changing-lines.md`.
- **`scroll.html` — the story (mock-up, Sep 22).** The same walk read down a page in the shape of
  ai-2027.com: a sticky rail on the left with the seven endings ranked, the hand and the two
  gauges; one section per year in words with the ending that moved most as a small figure; the
  choice at the end of the latest year (the hand, Walk a year, Walk together, lean toward an
  ending, Cast again) writes the next year underneath. Scrolling back up shows the rail "as of"
  that year. What we inherited is a drawer at the top; changing a number re-walks every year below.
  Same model, same hash, so a link opens in any of the three pages. No dependencies.
- **`walk.html` — the dashboard.** The same walk with the gauges, the timeline and every prior
  as a flat list.

Its one teaching: **a probability is never a property of the
world on its own — it is a property of the world *given a path*.** "Ten percent" is really
*P(doom | the path people expect)*, and the condition is usually left unspoken. The Walk makes the
condition visible and walkable.

## How it plays

- **The Node** — the card at the top is where the walk stands: the allocation as one strip, the
  step, capability, coordination, and the most likely ending on this path with its number. On a
  phone it stays pinned while you drag, so the number moves under your hand. Under it, the last
  "what changed" line in words.
- **Your first three steps** — a walkthrough that advances only when you do the thing (drag Power,
  press Step, read the line). It shows once per browser; the footer brings it back.

- **Four sliders** — Power, Alignment, Sustainability, Stop — always summing to 100%. Move one and
  the other three rebalance.
- **Step** advances one step of a 20-step horizon with that allocation. **Step together** is the
  step of faith: it moves the world only if coordination has reached `stagK`; below it the step is
  spent and the page says *"You stepped alone. Nothing moved."* That is a stag hunt (Skyrms, 2004),
  and the footnote says so.
- **Seven endpoint cards** (the Horizon) on the right carry plain names — Grace, the sustainable
  turn, the Stop, Adolescence, Lock-in, Doom, still walking — with the source text under each, and a live probability and a standard error, recomputed
  from 4,000 Monte-Carlo rollouts after every step and every slider move. Each is one absorbing
  state: Machines of Loving Grace (Amodei 2024) · The sustainability turn (hers; van Wynsberghe
  2021) · The Stop · The Adolescence of Technology (Amodei 2026) · Situational Awareness
  (Aschenbrenner 2024) · AI 2027 / If Anyone Builds It, Everyone Dies (Kokotajlo et al.; Yudkowsky &
  Soares 2025) · Still walking.
- **What changed** says the biggest move in words after each step, and a timeline SVG draws you and
  three ghost agents — all-Power, all-Alignment-first, Sustainability-first — as arrows walking the
  same horizon, so their endpoints compare with yours.
- **Priors** — every one of the sixteen constants has a slider and a number, with a plain line of
  gloss and a *Reset to defaults*. Nothing about the world is hardcoded outside that panel.

The whole walk — every allocation stepped with, plus any prior edited — is encoded in the URL hash,
so **a walk is a link**. *Copy link* hands it over; opening it replays the identical world, because
the walk's RNG seed rides in the hash too.

## What it reads at the defaults

Holding the default allocation (power .40 · alignment .30 · sustainability .15 · stop .15) to the
horizon: **Adolescence 67% · Doom 28% · Lock-in 5%**, everything else 0%. Hold 100% Power instead
and it is **Doom 55% · Lock-in 45%**. Put Stop at 50% and it is **The Stop 94% · Doom 6%**. Same
world, three numbers — that is the lesson.

Most cards read 0% at any one allocation, and that is the point rather than a bug: **the allocation
decides where you are going; chance decides whether you arrive.** Move a slider and the destination
itself changes.

## The contract

The model is ~150 commented lines at the top of the one `<script>`, and it is exported so the page
can be scripted or reused:

```js
window.walk.state                       // State { t, alloc, capability, alignmentStock,
                                        //          sustStock, coordination, endpoint, history }
window.walk.priors                      // the live overrides object the sliders write into
window.walk.simulate(state, priors, n)  // -> { n, horizon, probs, se, medianStep }   n = 4000
window.walk.stepOnce(state, priors, rng[, together])  // pure; returns a NEW State
window.walk.makeRng(seed)               // mulberry32
window.walk.ENDPOINTS                   // the seven absorbing states
```

`simulate` runs the **remaining** steps from the current state, holding the current allocation —
that assumption is the teaching — and never returns a probability without its standard error beside
it. 4,000 rollouts take about 20 ms. It is seed-free unless `priors.seed` is set; the page pins a
seed so the bars do not jitter between renders.

Shape and priors follow `DESIGN-the-walk-2026-09-20.md` §6a. **These numbers are a teaching
instrument, not a forecast** — the page says so above the cards, and every prior is yours to change.

---

# As-If — the other round

`index.html` is the whole game. One static dark page, no framework, no CDN, no build step — the
same shape as the recursive-tarot games (`pages/games/madiao.html`, `trionfi.html`,
`tarocchino.html`), which are each a single self-contained HTML file whose card data comes from a
`grammar.json` fetched by a relative path (`viewers/cards.html?src=../tarot/<slug>/grammar.json`).
Nothing runs behind it, so it works on GitHub Pages, and it works by opening the file directly
from disk as long as the browser can fetch a sibling file.

## The round

Six premises, drawn one at a time, shuffled.

1. A card shows its name and tagline — nothing else.
2. You write what changes if you hold it as true: in what you'd build, or in what you'd stop
   building.
3. Only then does *Turn it over* unlock, and the card's sections appear next to what you wrote.

The rule is the point. A premise you can reveal without answering is a premise you never held.
Answers are kept in `localStorage` (per deck, per card), never sent anywhere, and every read and
write is wrapped so a blocked-storage browser still plays.

## The deck it plays

**As-If — HOT POTATO edition**, `0489bd30-d71d-4b7b-82b2-662bcbef25b0`: published Sep 21 2026 and
exported to [`../grammars/as-if-hot-potato-edition/grammar.json`](../grammars/as-if-hot-potato-edition/grammar.json),
which is this page's default `?src=`. Ten characters (Upright · Reversed · Tell · Sources) and nine
hypotheses (with an "I don't know" face). The same ten characters sit at the spread's table as
*the other seats*: which path each one walks, upright or reversed, is `SEATS` in `spread.html`,
the page's reading of the deck's texts and hers to edit; the words on the back of each seat are
the deck's own.

## The earlier plan, kept for the record

The deck it wants is **As-If: Recognition as an Engineering Premise**,
`6512b3ec-b12d-49f8-b789-6d28ab19c82e`, 6 items — **private on recursive.eco today**, so this repo
does not contain it and the game opens on a panel that says so. Three steps close that:

1. **Publish the grammar** — Create → the grammar → Publish (or MCP `set_grammar_visibility`,
   which needs her word in chat either way).
2. **Add it to the map** — one line in [`../grammars/_eco_ids.json`](../grammars/_eco_ids.json):
   `"as-if-recognition-as-an-engineering-premise": "6512b3ec-b12d-49f8-b789-6d28ab19c82e"`, and
   drop its row from [`../grammars/PRIVATE.md`](../grammars/PRIVATE.md).
3. **Export and commit** — `node scripts/export-grammars.mjs`, then commit
   `grammars/as-if-recognition-as-an-engineering-premise/grammar.json`.

The game then loads it with no code change: that path is its default `?src=`.

Nothing is needed from recursive-eco itself — no API, no key, no CORS. The app serves HTML, not
JSON, for a grammar id, which is why `?id=` here only offers the `recursive.eco/view.html?id=…`
link instead of trying to fetch.

## Playing it against something else

```
index.html?src=../grammars/kpop-demon-hunters/grammar.json
```

Any grammar.json in this repo works. Items are read generically: `name`, `category`,
`metadata.tagline`, and either a `sections` map or a `description`.
