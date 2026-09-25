# map/build: how the map's data is made

Not deployed: the Pages workflow copies `map/` and then deletes `_site/map/build`.

```
python map/build/build.py --episodes pilot    # default; ids in map/build/pilot.txt
python map/build/build.py --episodes all      # every manifest episode that has captions
python map/build/check.py                      # the publishing rules; build.py runs it at the end
```

## Inputs (private, never committed)

The build reads the caption files, the manifest, the draft terms and the who's-who from flags
(`--manifest --cues-dir --terms --whoswho --episodes-meta`), from env vars (`MAP_MANIFEST`,
`MAP_CUES_DIRS`, `MAP_TERMS`, `MAP_WHOSWHO`, `MAP_EPISODES`), or from the gitignored
`map/build/local.json`:

```json
{ "manifest": ".../manifest.json", "cues_dirs": [".../cues"], "terms": ".../ai-map/terms.json",
  "whoswho": ".../ai-map/provenance/whoswho.json", "episodes": ".../ai-map/episodes.json" }
```

The canonical terms file is on the private `recursive-transcripts` repo, branch `ai-map-sep24`
(`ai-map/terms.json`, a SEED DRAFT until PlayfulProcess approves it; the page calls them draft tags).

## Steps

1. **chunk**: caption cues -> cleaned passages (strip `>>`, leading `- `, `[Music]`-style tags). Aim 70 words,
   stop at 90, prefer a full stop. Passage text goes only to the private work dir.
2. **embed**: sentence-transformers/all-MiniLM-L6-v2, mean pool + L2, stored int8 with a per-row scale.
   The cache is the shipped data: a passage whose (video, start, end) and chunker version match is not re-embedded.
3. **tag**: the terms' regexes over the cleaned text -> idea ids per passage (in order of first match).
4. **project**: UMAP, cosine, 15 neighbours, min_dist 0.1, seed 42, single thread (repeatable). Scaled into a square.
5. **cluster**: KMeans on the vectors, k = round(sqrt(N/5)). Label = idea terms with lift >= 2 and >= 8 hits,
   plus the share from the top person's episodes. No such term: "mixed talk".
6. **nodes**: person and idea 2-D medians (ideas with >= 8 passages); idea vector = normalised mean of its passages.
7. **nn**: 6 nearest neighbours per passage (cosine).
8. **questions**: embeds `questions.json`, keeps the top 12; drops a question whose best score is < 0.5.
   The hits are written to the work dir (`question-hits.txt`) for a private read before shipping.
9. **snippets**: only for the top 12 of each question, one exemplar per cluster, and up to 3 exemplars per idea.
   At most 20 words (15 for The Ezra Klein Show, a New York Times show), at most 2% of each episode's caption words.
10. **export**, then `check.py`, then the work dir (passage text, the 88 MB Python model) is deleted.

The browser model (`map/model/Xenova/all-MiniLM-L6-v2/`, q8 ONNX, 23 MB, Apache-2.0) is fetched once
from Hugging Face on the first build and then served from this site.

## Checks that fail the build

Snippet over its cap; a New York Times show over 15 words; an episode over its snippet share; any string in
`data/` over 25 words; an absolute path or this machine's account name anywhere in `map/`; a passage with no
video id + time; a file over its size budget.

## Colours

Six categorical slots (blue, aqua, yellow, green, violet, red from the dataviz reference palette; orange and
magenta are left out so the glow, a deep pink, is not in the palette). For a scatter every pair of colours
can sit side by side, and no six colours pass that test in both themes: light passes the normal-vision floor
(15.6) with a colour-blind separation of 6.9 (the warn band), dark fails blue/violet. So colour is never the
only cue: person nodes are labelled on the map, the legend chips filter to one person or lane, and the result
list is the text version of the map.

## Parity

`parity.html` (serve the repo root, open `/map/build/parity.html`) embeds the suggested questions in the
browser with the shipped q8 model and compares its top 10 with the Python build's. Target: overlap >= 0.9.

## Scale

`--episodes all` builds every manifest episode with captions (91 of 93; the two without are listed as not
included). About 26k passages, about 1 CPU-hour to embed: run it in the background. The page adapts from the
counts. `--dims 192` is reserved (not built yet) in case 9.6 MB of lazily loaded vectors is too heavy.

Note for this machine: a global gitignore ignores every `build/` folder, so new files here need `git add -f`
(files already tracked are fine). `local.json` stays ignored by `map/build/.gitignore`.
