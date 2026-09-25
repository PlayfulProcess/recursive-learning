# State of AI, many meters: licences and credits

This folder (`state-of-ai/`) mixes our own code and text with data copied, with changes, from other
people. What is under which terms:

| What | Licence |
|---|---|
| Code: `app.js`, `charts.js`, `style.css`, `index.html` (its markup), `scripts/*.py`, and `.github/workflows/state-of-ai-refresh.yml` | Apache-2.0, as the rest of the repository's code (the repository's `LICENSE` and `NOTICE`). Copyright 2026 PlayfulProcess |
| Page text (the words on the page and in this folder's `README.md`) | CC BY-SA 4.0, PlayfulProcess (the repository's `LICENSE-CONTENT.txt`) |
| `data/epoch_*.json` | **Epoch AI's data, CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/), with changes (below). Each file's `citation` field is Epoch's recommended citation; for `epoch_ai_companies.json` it names the dataset's authors: Josh You, John Croxton, Venkat Somala, Yafah Edelman, 'Data on AI Companies', Epoch AI |
| `data/arena_leaderboard.json` | **Arena (lmarena-ai) data, CC BY 4.0**, from the Hugging Face dataset https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset, with changes (below). The arena's own website is not under this licence and nothing is taken from it |
| `data/metr_time_horizon.json` | METR's own fitted doubling times, quoted with attribution; no per-model numbers are copied (METR's site: all rights reserved). Its page: https://metr.org/time-horizons |
| `data/summary.json` | Our adaptation of the Epoch AI and Arena data above (rows filtered and combined; trend lines, positions and sentences ours), offered under CC BY 4.0, keeping every credit in its `sources` field |
| `data/players.json` | Written by us (links to each player's own pages, which keep their own terms): CC BY-SA 4.0, PlayfulProcess |

Also quoted, with credit: Marius Hobbhahn, Lennart Heim and Gökçe Aydos (2023), 'Trends in machine
learning hardware', Epoch AI (CC BY 4.0): its doubling time and range only.

## What we changed (CC BY 4.0, section 3(a)(1)(B))

More than filtering rows. Each data file's `changes` field says exactly what, and each card on the
page shows it under "What we changed from the source". In short: rows filtered; columns renamed or
dropped; values rounded; some fields recoded (Epoch's "Open model weights?" to true, false or blank);
some values computed by us (FLOP/s per dollar; each quarter's chip shipments as the difference of
Epoch's cumulative medians); labels of our own (Arena licences sorted into open, closed or neither;
chips sorted into data-centre, workstation and consumer; the kind of each chip price); and the trend
lines, positions and sentences in `summary.json`.

OpenRouter's usage data are linked, never copied: its terms forbid copying.

No endorsement by Epoch AI, Arena, METR or anyone named here is implied.
