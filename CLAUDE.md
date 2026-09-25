# CLAUDE.md — recursive-learning (learning.recursive.eco)

Working title of the site: **Recursive Eco-Improvement: explorations in adaptive alignment**
(PlayfulProcess's call; it appears in `site/site-header.js`, the `<title>`s and `site/index.html`).
The owner is **PlayfulProcess**; never a real name, in files, commits or pages.

Since Sep 24 2026 the site runs on the **recursive-tarot template**: the shell in `site/` is a
port of tarot's header, footer, theme and viewers. The repo is **public**, so every pushed branch
is public too.

## Rules

1. **The Prime Rule** (recursive-tarot `docs/REPLICATE-THE-PATTERN.md`): copy the working file,
   change only data paths, branding, the accent colour and content. Never re-imagine a mechanism
   that tarot already has; fix it in tarot and let the next port inherit it.
2. **Read-only elsewhere.** recursive-tarot, recursive-iching, recursive-eco and value-lab are
   read-only from this repo's chats (copying out of them is reading). Never touch emergence-lab.
3. **No emoji or dingbats as marks.** The mark is her spiral, `scripts/mark.svg` `#spiral`, copied
   verbatim, never redrawn (`site/site-header.js`, `site/site-footer.js` and `site/spiral.svg`
   carry the same path; `check_all` asserts it).
4. **No AI-generated images.** Pictures are credited public-domain works (Wikimedia Commons through
   `Special:FilePath/<file>?width=480`, `object-fit: contain`, never cropped) or the plain line
   covers. Agent-drawn emblems count as AI images until PlayfulProcess says otherwise.
5. **Arguments, not people.** People and institutions are described from their own pages, dated,
   not ranked, with no stance labels.
6. **Plain, hedged words.** No absolutist claims ("the only", "always", "never", "proves");
   `check_all` lists them as warnings in authored prose.
7. **One theme source.** Colour lives in `site/theme.css` only (light only). A page links it and
   declares no colour tokens and no `prefers-color-scheme` block. `python scripts/apply_theme.py`
   is the fixer. The legacy dark game pages are the one exception until they are relit.
8. **Run `python scripts/check_all.py` before every push**; after touching data or a builder, run
   it with `--check`. Before the first push of anything under `research/`, run
   `python scripts/check_all.py --only privacy`: pushing a branch publishes it.
9. **Never merge.** Prepare the PR and wait; PlayfulProcess merges. Decisions go to the queue in
   `GitHub/PRIORITIES.md`.
10. Write scripts and commit messages with the Write tool (heredocs break on apostrophes). LF only
    (`.gitattributes`; the app compares grammar bytes).

## Layout

| Folder | Published at | What |
|---|---|---|
| `site/` | `/` | the tarot shell: `index.html` (home), `404.html`, `theme.css`, `style.css`, `site-header.js`, `site-footer.js`, `icons.js`, `viewers/` (cards, explorer, tree, caster), `pages/` (about, play), `map/` (the Sources hub) |
| `game/` | `/game/` | the games (hand-written pages; the dark ones load `shared/nav.js`) |
| `glossary/` | `/glossary/` | `terms.json` (the one source of the words) and the generated `index.html` |
| `grammars/` | `/grammars/` | every grammar (`<slug>/grammar.json`), `_collection.json`, `_eco_ids.json` |
| `shared/` | `/shared/` | `nav.js`, the shim that gives the game pages the tarot header |
| `research/`, `scripts/`, `docs/` | not published | sources, builders and checks |

The published folders are listed once, in `scripts/site-folders.txt`, which
`scripts/assemble-site.sh` reads (CI and local). A new top-level page folder (`explainers/`,
`lab/`, `data/`) is one line there plus its menu entry in `site/site-header.js`.

Paths renamed from tarot: `../tarot/` became `../grammars/`, the regex `tarot\/` became
`grammars\/`, and the slug `all-decks-many-lenses` became `all-decks`.

**Test on an assembled site, never on the repo tree:**

    bash scripts/assemble-site.sh _site && python -m http.server -d _site 8000

The viewers reach grammars as `../grammars/` and the chrome as `/site-header.js`, which only
resolve in the assembled layout. Check at 1280 and 375 px.

## The header is the one site map

`site/site-header.js` (tarot's shadow-DOM header, dropdown code unchanged) holds every menu:
Home, Words, Sources (`/map/`), Ideas, Games (`/pages/play.html`), Institutions (tarot's Shop
slot) and GitHub. Its prefix is root-relative (`PFX = '/'`): tarot's depth formula reads
`/glossary/` as the root. `active` keys: `home`, `words`, `sources`, `ideas`, `play`,
`institutions`; on `/viewers/*` the tab follows the grammar in `?src=`.

`shared/nav.js` contract:
- **browser**: inserts "Skip to content" (first Tab stop, lands on `#main`), `<site-header>` with
  the tab from the path, the views row of a multi-view game (The Walk carries its `#v1;...` hash
  across views), and `<site-footer>`; marks new-tab links with `aria-describedby`; opens a closed
  `<details>` that a hash points into. It removes the old build-time header and footer if a page
  still carries them (the glossary until it is rebuilt).
- **node**: `SITE.games` (the one list of games and their views; `pages/play.html` and the
  header's Games menu must agree with it, and `check_all` asserts that), plus `header(o)`,
  `footer()` and `CSS`, which now emit the tarot tags. There is no `SITE.sections` any more.

The home page's anchors `#main`, `#games` and `#grammars` are load-bearing (game pages, the
glossary and 404 link into them).

## Left out in v1, as stubs

`site/auth-widget.js` sets `window.recursiveAuth = { client: null, getUser: async () => null }`
(cards.html polls for it for up to 4 s before loading a grammar, so it must exist).
`site/viewers/oracle-ribbon.js` sets `window.OracleRibbon = { show() {} }`. `site/assistant.js`
is empty. In `viewers/caster-studio.html` the recursive.eco panels (My spreads, the model hint,
Interpret with AI, Cast in recursive.eco) sit behind one `const FLOW_ON = false`; nothing was
deleted. To restore any of them, copy tarot's file back over the stub.

## The accent

Tarot's gold became the landing's mint darkened to pass 4.5:1 on `--bg #f4f1ea` (tarot's gold
only reached 3.84:1 there). One scripted swap, the same list in `scripts/apply_theme.py` and
`scripts/check_all.py`:

| tarot | here | role |
|---|---|---|
| `#9a7322` | `#177d56` | `--gold` / `--accent` (4.54:1 on `--bg`) |
| `#7c5b18` | `#126445` | hover, darker accent |
| `#b8902f` | `#1b9566` | light decorative accent |
| `#8a6414` | `#15704d` | darker accent text |
| `#c4ad7a` | `#8cc6ad` | underline tint |
| `#faf3e6` | `#e9f5ef` | `--chip`, the soft fill |
| `rgba(154,115,34,a)` | `rgba(23,125,86,a)` | tints |

Purple (`#9333ea`) stays reserved for links to recursive.eco. The token names stay tarot's
(`--gold`, `--accent`) so the copied viewers resolve them unchanged.

## Grammars and the app

- Grammars live in `grammars/<slug>/grammar.json`. The app-owned ones (the films, the courses,
  the As-If deck `0489bd30…`) come from `scripts/export-grammars.mjs`; never hand-edit them.
- **Generated grammars** (`words-deck`, `sources-of-alignment`, `ideas-of-alignment`,
  `institutions-of-alignment`, `all-decks`) are built locally by `scripts/build_*.py` and
  committed; CI only checks them. Each carries at top level `_generated: true`,
  `_do_not_hand_edit: true`, `_source_of_truth`, `_built_by`, `_inputs_sha256` (sha256 over the
  sorted input bytes; never a wall-clock or git date, so a rebuild is byte-identical in a shallow
  CI checkout), `creator_name: "PlayfulProcess"` and `_grammar_commons` (CC-BY-SA-4.0).
- **Every builder takes `--out DIR`** and then writes its outputs under DIR at their repo paths;
  `check_all --check` rebuilds each into a temp folder and diffs byte for byte.
- **What stops the app syncing a generated grammar** (checked Sep 24 2026 on recursive-eco
  origin/main 608ec28f): the importer and sync skip any grammar with
  `_generated === true || _source_of_truth` (`apps/flow/src/lib/channel/import-new-grammar.ts:115`,
  `apps/flow/src/app/api/channel/sync-pull/route.ts:158`, sync-resolve, sync-preflight).
  `recursive-eco.json` `grammars.exclude` is typed (`import-from-github/route.ts:37`) but read
  nowhere; it lists the generated grammars for parity with tarot. `_generated: true` does the work.
- `grammars/_collection.json` is built by `scripts/build_collection.py` (the recursive-iching
  pattern: glob every grammar, curation dicts in the script); the home gallery reads it
  (`!is_meta && cover_image_url`, bands by `provenance`: `living` = Practice, `record` = Record).
- **One cross-link pattern**: `metadata.source_deck` + `metadata.source_item_id` + `metadata.deck`
  renders the "Open in X →" pill and the framed embed (`viewers/reference-resolve.js`). Never add
  another link field; never name a section Link or URL and never set `metadata.youtube_url`
  (cards.html turns both into whole-card redirects); only institutions carry `metadata.url`.
- The fork link for a visitor is `https://flow.recursive.eco/create/dashboard/unified/new?forkId=<id>`
  (makes a copy); `?id=` opens the original document itself.

## Checks

`python scripts/check_all.py` (standard library; node for two sub-checks) runs: grammars,
generated (`--check`), collection, sync, words, reach, links, theme, privacy, asif. While other
builders' files have not landed, `--allow-pending` reports them as pending with their owner
instead of failing; CI never passes it. The Pages workflow runs the same checks on every pull
request (no deploy) and on every push to main (then deploys).
