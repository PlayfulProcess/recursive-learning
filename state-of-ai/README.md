# State of AI, many meters

`learning.recursive.eco/state-of-ai/`: where AI seems to be on its curves, by several meters at
once, with each meter's coverage and the places where meters disagree.

A static page (`index.html`, `style.css`, `charts.js`, `app.js`: vanilla JS, no library, no build)
reads JSON files from `data/`. Python scripts in `scripts/` write those files, using only the
standard library, so a GitHub Action runs them with no installs.

## Rules the page keeps

- Every number keeps its source URL, licence and `fetched_at`, and every card says what we changed, in full.
- Every card says who is counted and who is not (`coverage` in each data file, computed from the data),
  and the date its data reach (`newest_data` in `summary.json`), which differs a lot by source.
- Meters that disagree are shown side by side, never averaged.
- Fitted lines carry a 90% bootstrap band for where the line could be. They are drawn past the data
  only when the reader turns on "if the trend continued", labelled as not a forecast, with a wider band
  for where single points could land. No stretch is drawn for a single company, or when the data
  stopped so long ago that the stretch would end in the past.
- Series about one company or one chipmaker (revenue, shipments) are resampled in runs of neighbouring
  points, since neighbours move together; lists of models and chips are resampled point by point.
- Each "faster lately" or "slower lately" names its dates and number of points, and the summary gives
  the chance that at least one of the checks says "changed" by luck.
- Light and dark mode each use their own colour steps; reduced motion is respected; every chart has a
  keyboard path and a table view.
- "Today" is read only in the reader's browser. The summary build never reads the clock.

## Meters

| id | what | source | kept here as |
|---|---|---|---|
| `epoch_training_compute` | training compute of notable models; also the open-weights share of releases | Epoch AI, Data on AI Models | copied (CC BY 4.0) |
| `epoch_training_cost` | cost of the final training run | same zip | copied (CC BY 4.0) |
| `epoch_eci` | Epoch Capabilities Index, open vs closed weights | Epoch AI benchmarking hub | copied (CC BY 4.0) |
| `epoch_benchmarks_internal` | GPQA Diamond, FrontierMath 1-3, SWE-bench Verified: Epoch's own runs | Epoch AI benchmarking hub | copied (CC BY 4.0); the `*_external.csv` files are never copied |
| `epoch_ml_hardware` | chip FLOP/s per dollar, data-centre chips apart from consumer cards | Epoch AI hardware data | copied (CC BY 4.0) |
| `epoch_chip_sales` | AI compute shipped per quarter, by designer | Epoch AI chip sales | copied (CC BY 4.0) |
| `epoch_chip_owners` | AI compute held, by owner and designer | Epoch AI chip owners | copied (CC BY 4.0) |
| `epoch_ai_companies` | reported revenue run-rates | Epoch AI companies | copied (CC BY 4.0) |
| `arena_leaderboard` | best closed vs best open in every Arena snapshot | lmarena-ai dataset on Hugging Face | copied (CC BY 4.0) |
| `metr_time_horizon` | task-length doubling time | METR | **link only**: METR's own doubling times are quoted; no per-model rows (site: all rights reserved) |
| (usage share) | tokens served by open vs closed models | OpenRouter rankings and its 2025 usage study | **link only**: OpenRouter's terms forbid copying its data; the page links to them and states their coverage |

## Licences, and what we changed

**[`NOTICE.md`](NOTICE.md) is this folder's licence notice**: code Apache-2.0, page text CC BY-SA 4.0
(PlayfulProcess), the `epoch_*` and `arena_leaderboard` data files CC BY 4.0 by their sources, with
changes, and `summary.json` our CC BY 4.0 adaptation. The page links to it from its footer.

- Files under `data/` named after a source stay under that source's licence: **CC BY 4.0, by Epoch AI**
  (the `epoch_*` files; the revenue file names the dataset's four authors, as Epoch's citation does) or
  **by Arena (lmarena-ai)** (`arena_leaderboard.json`, whose page link goes to the licensed Hugging Face
  dataset, not the arena's site). CC BY 4.0 asks us to say what we changed: each file's `changes` field
  does, and each card shows it in full under "What we changed from the source" (a `<details>`, so touch
  and keyboard reach it).
- `data/summary.json` is **our adaptation** of those files: rows filtered and combined, and the trend
  lines, positions and sentences are ours. It carries the same credit, each source's citation included.
- `data/players.json` is hand-written by us.
- METR's figures are quoted with attribution only. OpenRouter's are linked, not copied.
- The repository's root README "Licensing" table does not list this folder yet: it is a shared file, and
  other branches are editing it. When this branch merges, add a row pointing to `state-of-ai/NOTICE.md`.

## Run it locally

    python state-of-ai/scripts/test_scripts.py     # offline checks
    python state-of-ai/scripts/run_all.py          # fetch everything, rebuild the summary
    python state-of-ai/scripts/run_all.py epoch_eci   # just one source (the summary is rebuilt too)
    python -m http.server 8000                      # from the repo root, then open /state-of-ai/

A fetcher reads robots.txt first and never fetches a disallowed address (Arena's own `/api/` is
disallowed and is not used; its data come from the Hugging Face dataset). A fetcher that fails keeps
the previous file. A file whose rows did not change keeps its `fetched_at`, so **`fetched_at` is when we
first fetched the numbers now in the file**, not when they were last checked and not when the source
last changed them; the page says "these numbers fetched". If only the notes around unchanged rows
change (coverage wording, `changes`), the file is rewritten with the old `fetched_at`. Adding a column
counts as a change of rows; when a new column only labels rows whose numbers are the same, set
`fetched_at` back by hand and say so in the commit (done once, for `epoch_ml_hardware.json`, on 25 Sep
2026: 162 rows, 0 cells changed in the original columns).

`run_all.py` exits 0 when every source was checked, 2 when the summary was built but a source failed,
and 1 when nothing could be built.

## The weekly refresh

`.github/workflows/state-of-ai-refresh.yml` runs every Monday at 06:17 UTC (and on demand). It never
pushes to `main`: it rebuilds the branch `data/state-of-ai-refresh` from `main` and opens or updates one
pull request. Merging publishes, through `pages.yml`.

- **A failed source fails the run**, after whatever succeeded has been committed. GitHub emails the
  owner when a scheduled run fails, so a dead source cannot sit unnoticed behind "nothing changed".
- **The schedule starts only once the workflow file is on `main`.** In a public repository GitHub turns
  scheduled runs off after 60 days with no activity, and emails a warning first.
- **Pull requests show no checks.** A pull request opened with GitHub's own token does not start other
  workflows. The refresh job runs the offline checks itself; to run the checks that run on pull
  requests, close and reopen the pull request.
- Opening the pull request needs "Allow GitHub Actions to create and approve pull requests" in the
  repository's Actions settings; without it the run pushes the branch and prints a link to open it.

The Arena fetcher is incremental: it records a `history_cursor` and reads only newer snapshots (the
first run reads the whole history page by page, about 1,000 small requests). The history holds two
counts, kept apart: raw-vote snapshots and style-adjusted snapshots (the page gives both).

## Open decisions (PlayfulProcess)

1. **METR**: stay link-only (the default), store per-model numbers with a citation
   (`METR_STORE_ROWS=1`), or ask METR (outreach needs your approval). METR's site says "all rights
   reserved"; its public repository (METR/eval-analysis-public) has no licence file; the 2025 paper
   (arXiv 2503.14499) is CC BY 4.0 but its numbers are older.
2. **The 70/30 figure**: no source found for it (who said it, when, which way round, what it counts).
   The page mentions it without quotation marks and says so. If you have the clip, its link and
   timestamp can go in the lede.
3. **Player pages**: `lab_page` in `data/players.json` is empty for everyone. When the lab has a page for
   a player, put its URL there and the player panel links to it.
4. **"Open their strategy on click"** is not built as strategy text: the player panel shows what each
   player says (their own dated statements, flagged when older than 12 months) beside what the data show
   they do, each line with its source.

## When lab/replatform and lab/curves-and-odds land

- `lab/curves-and-odds` adds `explainers/` at the same two places in `pages.yml` as this branch adds
  `state-of-ai/`; whichever merges second gets a one-line conflict. Keep both lines.
- `lab/replatform` moves the list of published folders to `scripts/site-folders.txt` and adds a link check
  that fails the deploy if a top-level folder with a page is not listed. Once both are in `main`: add the
  line `state-of-ai  state-of-ai` to `site-folders.txt`, keep `'state-of-ai/**'` in `pages.yml`'s path
  triggers (without it, merging a weekly data pull request would not republish the page), and run
  `check_all.py` on the result.
