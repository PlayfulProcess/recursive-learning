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

1. **chunk**: caption cues -> cleaned passages (strip `[Music]`-style tags). Aim 70 words, stop at 90, prefer a full
   stop. A change of speaker is kept as a position, never as text: `>>` (automatic captions), a leading `- ` (Lex's
   captions), or a speaker label such as `Rob Wiblin:` (80,000 Hours; a name seen 3+ times before a colon), which is
   also removed from the text. Passage text goes only to the private work dir. Chunker `c3` (Sep 25).
2. **embed**: sentence-transformers/all-MiniLM-L6-v2, mean pool + L2, stored int8 with a per-row scale.
   The cache is the shipped data: a passage whose (video, start, end) and chunker version match is not re-embedded.
3. **tag**: the terms' regexes over the cleaned text -> idea ids per passage (in order of first match).
4. **project**: UMAP, cosine, 15 neighbours, min_dist 0.1, seed 42, single thread (repeatable). Scaled into a square.
   When every passage came from the cache and the shipped map holds exactly these passages, the shipped positions
   and clusters are reused (they are what UMAP and KMeans would return), so a quotes-only re-run takes minutes.
   The build logs, and ships as `layout_keep`, how much of each passage's neighbourhood the flat map keeps: of its
   10 nearest passages by the 384 numbers, the share among its 10, 30 and 100 nearest dots (Sep 25: 21%, 39%, 59%).
   The page quotes it, since distance on the map means much less than the scores.
5. **cluster**: KMeans on the vectors, k = round(sqrt(N/5)). Label = idea terms with lift >= 2 and >= 8 hits that
   at least 1 passage in 5 of the group carries (the idle-diamond floor; before Sep 25 a name could be carried by
   7%), plus the share from the top person's episodes. No such term: "mixed talk".
6. **nodes**: a person or idea node sits at the densest spot of its passages (the point with the most of its own
   passages within 4.5% of the map, then the median of those), not the median of all of them, which can land in
   empty space. `own` = the share of all dots near the node that are its own (logged; shipped for reference).
   Idea vector = normalised mean of its passages. Lanes count every passage with any of their idea words.
7. **nn**: 6 nearest neighbours per passage (cosine).
8. **questions**: embeds `questions.json`, keeps the top 12; drops a question whose best score is < 0.5.
   The hits are written to the work dir (`question-hits.txt`) for a private read before shipping.
9. **snippets**: only for the top 12 of each question, one exemplar per cluster, and up to 3 exemplars per idea.
   Each quote is the window of whole sentences (or of a long sentence) that the model scores closest to why the
   passage was picked: the question, the passage itself, or the idea (and then it must hold the idea word). A window
   never crosses a marked change of speaker; where an episode's captions mark none (Dwarkesh), a window stays inside
   one sentence. At most 20 words (15 for The Ezra Klein Show, a New York Times show), at most 2% of each episode's
   caption words. Idea-word links are widened to whole words.
   **Quote review** (`quote-review.json`, committed: keys and verdicts only, never text). Captions rarely name the
   speaker, so every published quote is read privately in its caption context before it ships. Verdicts: `ok`,
   `host` (the host speaking), `paraphrase` (someone repeating another person's view), `garble` (a wrong word or
   name in the captions), `unclear` (the speaker cannot be told). A window whose verdict is not `ok` is skipped, with
   every window overlapping it, and the next closest window is taken; so a re-run can surface new quotes. The build
   writes those, with the raw captions around them, to the work dir (`quote-review-todo.txt`), and check.py fails
   until each is marked. Keys hash the quote text, so a changed window is read again. For 80,000 Hours the
   captions' speaker labels settle it; elsewhere it is a reading, and the page says the speaker is not marked.
10. **key words**: every passage gets up to 5 words or two-word phrases by tf-idf over all passages (fillers and
   stop words removed, min 2 passages, max 12%). An index of terms, not a quote: `data/words.json`. Misspelt names of
   people in automatic captions (`ilia`, `daario`, `alman`, `benjio`, `jensen hang`, ...) are corrected here
   (`NAME_FIX`, `PAIR_FIX`); quotes are never corrected, a garbled quote is dropped instead.
11. **export**, then `check.py`, then the work dir (passage text, the 88 MB Python model) is deleted.
    With `--keep-work` the work dir also keeps the UMAP layout and KMeans clusters, keyed by the exact int8
    vectors, so a re-run that only changes quotes or key words skips them (on a busy CPU they took 15 minutes).
    Delete the work dir by hand when done: it holds passage text.

Episode facts the private manifest gets wrong or lacks live in `episodes-extra.json` (committed): the caption kind
(`creator` or `auto`, checked on each watch page's caption track list), and the real title and episode page for
the two episodes whose manifest titles were placeholders, and a `date` where the manifest's was the YouTube upload
date rather than the episode page's (Making Sense #494). Hosts come from the who's-who (`hosts` of each show node);
an episode can override them with `hosts`. An episode missing from it gets a guessed kind
(`auto?` / `creator?`), and the page then says just "caption".

The browser model (`map/model/Xenova/all-MiniLM-L6-v2/`, q8 ONNX, 23 MB, Apache-2.0) is fetched once
from Hugging Face on the first build and then served from this site.

## Checks that fail the build

Snippet over its cap; a New York Times show over 15 words; an episode over its snippet share; a snippet with caption
markup or a speaker label; a quote not marked `ok` in `quote-review.json`; an idea link that stops mid-word; an
episode with no caption kind; a key word longer than
two words or more than 5 per passage; any string in `data/` over 25 words; an absolute path or this machine's account name anywhere in `map/`; a passage with no
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
Sep 25 (chunker c3): top-10 overlap 0.929, top-1 the same for 7 of 7.

## Scale

`--episodes all` builds every manifest episode with captions (91 of 93; the two without are listed as not
included). About 26k passages, about 1 CPU-hour to embed: run it in the background. The page adapts from the
counts. `--dims 192` is reserved (not built yet) in case 9.6 MB of lazily loaded vectors is too heavy.

Note for this machine: a global gitignore ignores every `build/` folder, so new files here need `git add -f`
(files already tracked are fine). `local.json` stays ignored by `map/build/.gitignore`.
