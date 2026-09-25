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

Since Sep 24 2026 the site runs on the **recursive-tarot template**: the header, footer, theme and
viewers in `site/` are ports of recursive-tarot's (copied, then only paths, branding, the accent
colour and content changed). [`CLAUDE.md`](CLAUDE.md) has the rules for working here.

```
site/                     published at / : the tarot shell
  index.html              the home page: doors to Words, Sources, Ideas, Games, Institutions; the
                          games strip; the grammar gallery (from grammars/_collection.json)
  site-header.js          the one site map (every menu); site-footer.js; theme.css (the one colour
                          source, light only); style.css; icons.js; spiral.svg (her mark)
  viewers/                cards, explorer, tree-viewer, caster-studio (the Spread Caster), with
                          spreads.json (GENERATED) and voices.json
  pages/                  about, play (the games hub), institutions (tarot's Shop slot)
  map/                    the Sources hub
game/                     the games, hand-written: as-if.html (As-If, cast from the As-If deck) ·
                          spread.html / scroll.html / walk.html (The Walk) · lines.html (Changing
                          Lines) · potato-others.html / potato.html (Hot Potato) · index.html (the
                          first As-If) · DESIGN-*.md
glossary/                 terms.json (the words, the one source) · spreads.src.json (the spreads) ·
                          index.html (GENERATED)
grammars/                 every grammar as <slug>/grammar.json, plus _collection.json and
                          _covers/ (GENERATED), _eco_ids.json and PRIVATE.md
shared/nav.js             the shim that gives the hand-written game pages the site header
research/                 not published: lab-export/ (the public inputs of Sources and Ideas),
                          crosswalk.json, institutions/institutions.json
scripts/                  builders, checks and the export (below); mark.svg (her spiral)
recursive-eco.json        the channel manifest the app reads
index.html, 404.html      noindex stubs; the site is served from site/
```

The published folders are listed once, in `scripts/site-folders.txt`. Test on an assembled site,
never on the repo tree (the viewers reach `../grammars/` and `/site-header.js`):

```
bash scripts/assemble-site.sh _site && python -m http.server -d _site 8000
```

### The sections

| Section | Where | Built from |
|---|---|---|
| **Words** | `/glossary/`, the Words deck in the viewers, the Spread Caster | `glossary/terms.json` + `glossary/spreads.src.json`: one source for the page, the deck and the spreads |
| **Sources** | `/map/` (the hub), the Sources grammar | `research/lab-export/sources.json`: podcast episodes, people, papers and books, plus one pointer per institution |
| **Ideas** | the Ideas grammar (tree, cards, explorer) | `research/lab-export/ideas.json` + `research/crosswalk.json`: the seed terms of the lab's map, a draft, kept apart from the record |
| **Games** | `/pages/play.html`, `/game/` | hand-written pages; the list of games is `SITE.games` in `shared/nav.js` |
| **Institutions** | `/pages/institutions.html` (where tarot has its Shop), the Institutions grammar | `research/institutions/institutions.json`: thirty organisations, each described from its own site, each card linking out to it |

Nothing in Sources or Institutions is ranked, and listing is not endorsement. People and
organisations are described from their own pages, dated, with no stance labels.

### Generated files, and how to regenerate them

Never hand-edit a generated file; edit its source and rebuild. One command rebuilds everything,
in dependency order:

```
python scripts/build_all.py            # add --check to run scripts/check_all.py --check after
```

| Output | Builder | Source |
|---|---|---|
| `grammars/words-deck/grammar.json`, `site/viewers/spreads.json` | `build_words_deck.py` | `glossary/terms.json`, `glossary/spreads.src.json` |
| `grammars/institutions-of-alignment/grammar.json` | `build_institutions_grammar.py` | `research/institutions/institutions.json` |
| `grammars/sources-of-alignment/grammar.json` | `build_sources_grammar.py` | `research/lab-export/sources.json`, `ideas.json`, the institutions grammar |
| `grammars/ideas-of-alignment/grammar.json` | `build_ideas_grammar.py` | `research/lab-export/ideas.json`, `research/crosswalk.json` |
| `grammars/all-decks/grammar.json` (the caster's pool) | `build_meta_grammar.py` | the Words and Ideas grammars |
| `grammars/_collection.json`, `grammars/_covers/*.svg` | `build_collection.py` | every `grammars/*/grammar.json` |
| `glossary/index.html` | `build-glossary.mjs` (node) | `glossary/terms.json`, `glossary/spreads.src.json` |

Every builder takes `--out DIR`, which `check_all --check` uses to rebuild into a temp folder and
compare byte for byte. The generated grammars carry `_generated: true` (the app's importer and
sync skip them), `_inputs_sha256` (never a date, so a rebuild is identical anywhere) and
`_grammar_commons` (CC BY-SA 4.0). `recursive-eco.json` lists them under `grammars.exclude` too.

Two steps are not in `build_all.py`:
- `python scripts/lab_export.py --repo PATH/TO/recursive-transcripts` re-exports
  `research/lab-export/` from the lab's **private** research repo, field by field from an
  allow-list; no transcript text crosses over. Run `python scripts/check_all.py --only privacy`
  before pushing anything under `research/`: this repo is public, and so is every pushed branch.
- `node scripts/export-grammars.mjs` re-exports the app-owned grammars (below).

The home gallery's covers are plain line covers (her spiral and the grammar's name), except where
a grammar has a credited public-domain cover on Wikimedia Commons. No AI-generated images.

### Checks

```
python scripts/check_all.py            # before every push
python scripts/check_all.py --check    # after touching data or a builder
```

It checks the grammars (ids, links between cards, the generated stamps), that every generated
file is current, the collection, the sync manifest, the words and spreads, that every page is
reachable from the home page and loads the header, every internal link
(`scripts/check-links.mjs`), the URLs already live (`scripts/live-urls.txt`), the theme (one
colour source, her spiral, no emoji as marks), the privacy of the research export, and the As-If
game (`scripts/check-asif.mjs`). The Pages workflow runs the same checks on every pull request
(no deploy) and on every push to `main` (then deploys).

### Where GitHub Pages serves from

The site is **https://learning.recursive.eco**, published by the **Pages workflow**
(`.github/workflows/pages.yml`, build type "workflow"), which assembles `_site` from
`scripts/site-folders.txt`. Confirm rather than assume, any time this matters:

```
gh api repos/PlayfulProcess/recursive-learning/pages --jq '.build_type, .source, .https_enforced'
```

### The grammars

Generated here (above): **Words** (20 cards), **Sources** (podcast episodes, people, papers and
books, and pointers to the institutions), **Ideas** (52 seed terms, a draft), **Institutions**
(30 organisations) and **All decks** (the caster's pool).

Exported from recursive.eco (public, app-owned):

| Grammar | Items | Read |
|---|---|---|
| As-If — HOT POTATO edition (the deck the As-If game deals) | 39 | [open](https://recursive.eco/view.html?id=0489bd30-d71d-4b7b-82b2-662bcbef25b0) |
| HOT POTATO: The Chosen Alien Invasion | 259 | [open](https://recursive.eco/view.html?id=162eadff-00fc-4c01-87f7-ec1d2d37f438) |
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
| Code — `site/` (much of it ported from recursive-tarot), `game/` (HTML and JS), `shared/nav.js`, `scripts/`, the root `index.html` and `404.html`, `.github/` | Apache-2.0 — [`LICENSE`](LICENSE), [`NOTICE`](NOTICE) |
| Content — the grammars in `grammars/`, `docs/`, `glossary/`, `research/`, and the design notes in `game/*.md` | CC BY-SA 4.0 for PlayfulProcess's own text — [`LICENSE-CONTENT.txt`](LICENSE-CONTENT.txt). Linked or embedded third-party media (videos, images, quoted sources) keep their own terms; the names and sites of the institutions belong to them |
| The names "recursive.eco" and "Recursive", and the spiral mark (`scripts/mark.svg`, and its copies in `site/site-header.js`, `site/site-footer.js`, `site/spiral.svg` and the covers in `grammars/_covers/`) | Not licensed — see [`TRADEMARKS.md`](TRADEMARKS.md) |

The grammars exported from recursive.eco mostly do not carry their own `_grammar_commons`
licence block, so this table is what applies to them; the generated ones carry CC BY-SA 4.0.

Author on everything here is **PlayfulProcess**.
