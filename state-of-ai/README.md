# State of AI, many meters

`learning.recursive.eco/state-of-ai/`: where AI seems to be on its curves, by several meters at
once, with each meter's coverage and the places where meters disagree.

A static page (`index.html`, `style.css`, `charts.js`, `app.js`: vanilla JS, no library, no build)
reads JSON files from `data/`. Python scripts in `scripts/` write those files, using only the
standard library, so a GitHub Action runs them with no installs.

## Rules the page keeps

- Every number keeps its source URL, licence and `fetched_at`.
- Every card says who is counted and who is not (`coverage` in each data file, computed from the data).
- Meters that disagree are shown side by side, never averaged.
- Fitted lines carry a 90% bootstrap band and are drawn past the data only when the reader turns on
  "if the trend continued", labelled as not a forecast.
- Light and dark mode each use their own validated colour steps; reduced motion is respected;
  every chart has a keyboard path and a table view.

## Meters

| id | what | source | kept here as |
|---|---|---|---|
| `epoch_training_compute` | training compute of notable models; also the open-weights share of releases | Epoch AI, Data on AI Models | copied (CC BY 4.0) |
| `epoch_training_cost` | cost of the final training run | same zip | copied (CC BY 4.0) |
| `epoch_eci` | Epoch Capabilities Index, open vs closed weights | Epoch AI benchmarking hub | copied (CC BY 4.0) |
| `epoch_benchmarks_internal` | GPQA Diamond, FrontierMath 1-3, SWE-bench Verified: Epoch's own runs | Epoch AI benchmarking hub | copied (CC BY 4.0); the `*_external.csv` files are never copied |
| `epoch_ml_hardware` | chip FLOP/s per list-price dollar | Epoch AI hardware data | copied (CC BY 4.0) |
| `epoch_chip_sales` | AI compute shipped per quarter, by designer | Epoch AI chip sales | copied (CC BY 4.0) |
| `epoch_chip_owners` | AI compute held, by owner and designer | Epoch AI chip owners | copied (CC BY 4.0) |
| `epoch_ai_companies` | reported revenue run-rates | Epoch AI companies | copied (CC BY 4.0) |
| `arena_leaderboard` | best closed vs best open in every Arena snapshot | lmarena-ai dataset on Hugging Face | copied (CC BY 4.0) |
| `metr_time_horizon` | task-length doubling time | METR | **link only**: METR's own doubling times are quoted; no per-model rows (site: all rights reserved) |

`data/summary.json` is built from those files by `scripts/build_summary.py`: trends (`scripts/fit.py`),
the open-vs-closed meters, the latest position on each meter, and the plain-words sentences at the
top of the page. `data/players.json` is hand-written: it maps each source's spelling of an
organization to one player, with links in the player's own words.

## Run it locally

    python state-of-ai/scripts/test_scripts.py     # offline checks
    python state-of-ai/scripts/run_all.py          # fetch everything, rebuild the summary
    python state-of-ai/scripts/run_all.py epoch_eci   # just one source (the summary is rebuilt too)
    python -m http.server 8000                      # from the repo root, then open /state-of-ai/

A fetcher that fails keeps the previous file. A file whose contents did not change is not
rewritten, so its `fetched_at` stays the time those numbers were fetched.

## The weekly refresh

`.github/workflows/state-of-ai-refresh.yml` runs every Monday (and on demand). It never pushes to
`main`: it commits to `data/state-of-ai-refresh` and opens or updates one pull request. Merging
publishes, through `pages.yml`. Opening the pull request needs "Allow GitHub Actions to create and
approve pull requests" in the repository's Actions settings; without it the run prints a link.

The Arena fetcher is incremental: it records a `history_cursor` and reads only newer snapshots
(the first run reads the whole history, about 1,000 small requests).

## Open decisions (PlayfulProcess)

1. **METR**: stay link-only, store per-model numbers with a citation (`METR_STORE_ROWS=1`), or ask
   METR for permission (outreach needs your approval).
2. **Player pages**: `lab_page` in `data/players.json` is empty for everyone. When the lab has a
   page for a player (an institutions entry, a person page), put its URL there and the player
   panel links to it.
3. **Usage share** (tokens served by open vs closed models) is shown as "not measured here": no
   official, openly licensed download was found.

## When lab/replatform lands

That branch moves the list of published folders to `scripts/site-folders.txt` and adds a menu in
`site/site-header.js`. This folder then needs one line, `state-of-ai`, in that list (replacing the
`cp -r state-of-ai` line this branch adds to `pages.yml`), plus a menu entry if wanted.
