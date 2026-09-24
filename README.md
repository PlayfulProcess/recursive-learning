# Recursive Learning

**We're here to do recursive eco-improvement.** Recursive self-improvement can fail in several
ways, because a thing that improves itself still has to adapt *with* its environment, or adapt the
environment. This repository is where that hypothesis gets tested at the sizes and in the areas we
actually work in: a film cut out of other people's footage, a game, and the grammars about AI and
about how anyone learns alongside it.

It is not a position paper. The AI-safety material — no off switch, superintelligence being
unprovable either way, "set the stage now so the only research left is sustainability" — lives
inside the film and inside the grammars, **as questions**. Nothing here argues with anyone.

This repo is one **channel** of recursive.eco, held in git.

## Work in progress

This is a work in progress. I published it mainly so the pages could be served, and it isn't
finished. Contributors are welcome: open an issue or send a pull request, however small.

The idea behind it is the one above, and it stays a hypothesis, not a claim: that we may need to
learn together how to create the conditions for recursive eco-improvement, rather than race
toward recursive self-improvement.

If your work appears here and you'd like it featured differently, removed, or given a shelf of
your own, please write to pp@playfulprocess.com.

---

## What a channel is, and why there are two

A channel on recursive.eco is a room with a subject. A grammar (a deck, a sequence, a course, a
film's running order) belongs to a channel, and a channel can be bound to a GitHub repo, which
then holds its grammars as plain JSON that anyone can read, fork, or correct.

- **This repo is the `recursive-learning` channel** — everything about AI and recursive learning.
- **The `PlayfulProcess` channel stays her personal projects** — the other rooms (tarot, kids'
  stories, astrology, wellness) keep their own channels and their own repos.

One owner edits several channels. That is already how the app works: a channel-document is a row
owned by a user, and there is no limit of one per person. Nothing new had to be built for it.
The long version, and the answer to *"or maybe it is recursive learning transformed into a
repo?"*, is in [`docs/CHANNELS.md`](docs/CHANNELS.md). Short answer: **yes — this is the existing
`recursive-learning` channel, transformed into a repo.** It already existed, with four members;
binding it to this repo continues it instead of starting a rival.

---

## What's in here

```
index.html                a copy of the landing for the branch build — GENERATED, edit build-site.mjs
404.html                  a copy of the not-found page for the branch build — GENERATED, same
.nojekyll                 without it Jekyll 404s every _-prefixed path (grammars/_eco_ids.json)
CNAME                     learning.recursive.eco (read only by a branch build; see below)
recursive-eco.json        the channel manifest the app reads (identity, where grammars live, id map)
grammars/
  _eco_ids.json           slug -> recursive.eco grammar UUID
  PRIVATE.md              the private grammars: name + id only, never contents
  <slug>/grammar.json     one public grammar, exported in the app's own sync shape
game/                     the games, hand-written: spread.html · scroll.html · walk.html (The Walk
                          as a table, a story, a dashboard; walk-model.js is their shared model)
                          · index.html (As-If) · lines.html (Changing Lines) · potato-others.html
                          (Hot Potato, with others; potato.html alone) · DESIGN-*.md (design notes)
glossary/                 Words: terms.json (the canonical definitions) + index.html (GENERATED)
shared/nav.js             the one navigation: sections, the list of games, the site header and
                          footer, the skip link. See "Navigation" below
site/                     what the Pages workflow publishes at learning.recursive.eco: the landing
                          and 404.html (both GENERATED)
scripts/                  export-grammars.mjs (re-export) · build-site.mjs (rebuild the landing,
                          404.html and the glossary) · build-glossary.mjs (the glossary alone)
                          · check-links.mjs (the deploy's link check) · mark.svg (her spiral +
                          icons, inlined into the landing)
docs/CHANNELS.md          the two-channel model, and what sync needs
```

### Where GitHub Pages serves from

The site is **https://learning.recursive.eco**, published by the **Pages workflow**
(`.github/workflows/pages.yml`): its root is `site/`, with `game/`, `glossary/`, `shared/` and `grammars/` copied beside it.
Until Sep 24 2026 it was the legacy branch build at `game.recursive.eco`, which now answers 404
("Site not found"). Confirm rather than assume, any time this matters:

```
gh api repos/PlayfulProcess/recursive-learning/pages --jq '.build_type, .source, .https_enforced'
```

`node scripts/build-site.mjs` writes the landing to `site/` **and** to the repo root, so if the
source is ever switched back to the branch build it gets the same page.

### Navigation (every page, one file)

Every page carries the same header (the spiral and "Recursive Learning" linking home, then Games
and Words, the current one marked), a "Skip to content" link, and the same footer listing every
game and section. All of it comes from [`shared/nav.js`](shared/nav.js):

- **A new hand-written page** gets it with one line, the first thing inside `<body>`:
  `<script src="../shared/nav.js"></script>` (from a folder one down; `shared/nav.js` from the
  root), and `id="main"` on its content wrapper.
- **A new game or section**: one entry in `SITE.games` or `SITE.sections` in that file, then
  `node scripts/build-site.mjs`, which renders the same header, footer and list of games into the
  landing, the glossary and `404.html`. A section is added only once its folder exists and
  `pages.yml` copies it.
- **The deploy checks the links.** `node scripts/check-links.mjs _site --repo .` runs in the Pages
  workflow and fails it on any internal link to a missing page, or on a folder with pages that the
  workflow forgot to copy. Run it locally with `node scripts/check-links.mjs .`.

### Words (the glossary)

[`glossary/`](glossary/) holds twenty working definitions the film and the games use (alignment,
access, channel, the two kinds of guardrail, what held, and more), two of them standard terms and
the rest the lab's own. Edit `glossary/terms.json`, then run `node scripts/build-site.mjs`. Each
term has a fixed anchor, so anything can link one: `glossary/#what-held`.

### The grammars (public, exported)

| Grammar | Items | Read |
|---|---|---|
| HOT POTATO: The Chosen Alien Invasion — opening test | 259 | [open](https://recursive.eco/view.html?id=162eadff-00fc-4c01-87f7-ec1d2d37f438) |
| KPop Demon Hunters | 142 | [open](https://recursive.eco/view.html?id=3f7543af-d5e1-42d0-bc52-c3736d270dce) |
| The Chosen Alien Invasion — opening test (Star Wars primitives) | 212 | [open](https://recursive.eco/view.html?id=a5a39d3a-5d93-45c9-9347-f844cfbe830e) |
| The Chosen Alien Invasion — v2 (rebuild) | 202 | [open](https://recursive.eco/view.html?id=83668113-006c-4980-850c-5deeaae43221) |
| The Chosen Alien Invasion | 98 | [open](https://recursive.eco/view.html?id=1cf86c7d-18c3-47e7-8d1a-c152032630f8) |
| The Freedom Paradox: Open Source, AI, and the Limits of Openness | 22 | [open](https://recursive.eco/view.html?id=b00c0001-0000-4000-8000-000000000001) |
| Vibe Coding 101 — Tools & Process | 9 | [open](https://recursive.eco/view.html?id=602bc57a-d0a4-4db0-9b8c-3309488b566b) |
| Vibe Coding 102: Create Your Own Audiobook with Claude Code | 1 | [open](https://recursive.eco/view.html?id=68b4fdf7-2b17-4db3-a183-e74fceb96ad5) |
| Vibe Coding with Claude: Building 3 Journaling AI Tools in 1 hour | 1 | [open](https://recursive.eco/view.html?id=0a79720e-9d5a-4f91-bff9-8a9318da79bd) |
| Create Grammars with AI | 1 | [open](https://recursive.eco/view.html?id=fe2c3b4e-06f8-4f36-9035-eca044179e90) |
| Create Magic Stories for Your Kids with AI | 1 | [open](https://recursive.eco/view.html?id=2f78e910-25e9-4667-aea8-8e30bf327a88) |

The KPop Demon Hunters grammar carries the Korean-shamanism sources as its appendix — the reason
it sits in this channel and not in the kids' one.

**Private ones are not here.** Nine grammars that belong to this subject are still
`is_public = false`; [`grammars/PRIVATE.md`](grammars/PRIVATE.md) lists their names and ids with
"publish to include", and nothing else.

Four grammars whose names mention AI or KPop were deliberately left out because they belong to
other channels, not this one: *I Ching Summarized by AI* (the I Ching channel — it is summarized
*by* AI, it is not *about* AI), and the KPop fan-video / props / companion playlists (the family
channel).

### The export is not a new format

`grammars/<slug>/grammar.json` is produced to match, byte-shape for byte-shape, what the app's own
sync already writes: the grammar's `document_data` verbatim, minus the app's row bookkeeping,
plus the two `_recursive_eco_*` back-links — the one serializer at
`recursive-eco/apps/flow/src/lib/grammar/document-data-to-grammar-json.ts`. Re-export any time
with:

```
node scripts/export-grammars.mjs
```

It reads only. It can only see public grammars (it authenticates with the anonymous key), it
never writes to recursive.eco, and it drops `ai_personality_prompt` before writing.

---

## Licensing

| What | License |
|------|---------|
| Code — `game/` (HTML and JS), `shared/nav.js`, `scripts/*.mjs`, `site/`, the root `index.html` and `404.html`, `.github/` | Apache-2.0 — [`LICENSE`](LICENSE), [`NOTICE`](NOTICE) |
| Content — the grammars in `grammars/`, `docs/`, `glossary/terms.json`, and the design notes in `game/*.md` | CC BY-SA 4.0 for PlayfulProcess's own text — [`LICENSE-CONTENT.txt`](LICENSE-CONTENT.txt). Linked or embedded third-party media (videos, images, quoted sources) keep their own terms |
| The names "recursive.eco" and "Recursive", and the spiral mark (`scripts/mark.svg`, and its copy in `shared/nav.js`) | Not licensed — see [`TRADEMARKS.md`](TRADEMARKS.md) |

The grammars here are exported from recursive.eco; most do not carry their own
`_grammar_commons` licence block, so this table is what applies to them.

Author on everything here is **PlayfulProcess**.
