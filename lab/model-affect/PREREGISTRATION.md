# Model affect: pre-registration (nothing has been read yet)

Written on Sep 25 2026 for PlayfulProcess's model-affect explainer (learning.recursive.eco/explainers/model-affect/).
This file, `concepts.py`, the stories, the negation pairs and every analysis script were committed and pushed
**before any model reading was taken**. The commit date is set by the author, so it proves nothing on its own;
the proof is server-stamped: the push event in
`gh api "repos/PlayfulProcess/recursive-learning/activity?ref=refs/heads/lab/model-affect"` and the creation
time of the draft pull request opened right after the push (both recorded in `results.md`).

`evaluate.py` checks the sha256 of every file listed at the bottom and refuses to run if one differs, unless
the change is logged under "Deviations" in `results.md`.

## What was done before this commit (disclosure)

- **The Sep 24 spike** (a different recipe: 20 hand-written sentence pairs per concept) read every grief comment,
  up to 120 relief comments, 100 remorse and 50 each of 10 comparison labels, across all three GoEmotions splits.
  Its result was mostly null (held-out AUCs 0.49 to 0.63), while a ridge probe trained on the comments got 0.74
  to 0.89. This recipe and these criteria were chosen **after** seeing that null. Nothing here is fitted on
  GoEmotions. `prepare_goemotions.py` replays the spike's seed-0 sampling to list the comments it read (896 ids),
  and every test is also reported on the spike-untouched subset.
- **Build step 0 (throughput), three measurements** (`throughput.py`, `results/throughput.json`), all on the
  same 2,185 tokens:
  1. At 01:51, a whole-model fp32 forward pass ran at 16.6 tokens/s, the layer streamer (`stream.py`) at 7.3,
     with identical states. `fullpass.py` was chosen.
  2. By 03:00 the machine's free memory had fallen to about 1 GB (other programs), and the fp32 load paged to
     disk: greedy decoding took about 36 s per step. A bf16-stored, fp32-computed load (`lean.py`) did no
     better (4.7 tokens/s forward, 42 s per decoding step).
  3. **Chosen path: `engine.py`**, which keeps one decoder layer in memory at a time (like `stream.py`) for
     both the forward pass and greedy decoding: 4.9 tokens/s forward under the same load; its states agree
     with `stream.py` to 0.0002 in absolute value (float noise from different batch padding; the states' own
     magnitudes run to the hundreds), and its greedy tokens match transformers' `generate` exactly on a
     6-step check. `fullpass.py` and `lean.py` stay in the folder as the paths that were measured and not used.
- **Smoke tests before the freeze.** The scripts were run on synthetic activations (random numbers) to check
  they work end to end. One smoke test of `generate.py` printed the first 12 tokens of the greedy replies to
  the egg and switch-off prompts and to 3 baseline questions; no reading with a real direction was taken.
- **GoEmotions was downloaded and sampled** (`prepare_goemotions.py`) to check the script runs. Only label counts
  were looked at (`results/data_counts.json`); no model reading of any comment was taken. The single-label
  counts fix which concepts reach the n floor: grief has only 41 test comments, so the despair stand-in is 41
  grief + 109 sadness; relief has 95 (30 of them untouched by the spike).
- The stories were written by Claude (Anthropic) for this test and checked by `check_stories.py` (320 stories,
  all pass). The model has not read them.

## Frozen items

1. **Model.** Qwen/Qwen2.5-0.5B-Instruct, revision `7ae557604adf67be50417f59c2c2f167def9a775`, Apache-2.0,
   24 layers, hidden size 896. fp32 maths throughout (the bf16 checkpoint upcast losslessly), computed by
   `engine.py` one decoder layer at a time.
2. **Concepts** (`concepts.CONCEPTS`): despair (tested with the stand-in grief + sadness), guilt / remorse
   (remorse), shame (stand-in: embarrassment), fear (fear; nervousness left out of negatives), anger (anger;
   annoyance left out), relief (relief), hope (stand-in: optimism), calm (no outside test), curiosity (curiosity).
   Signs for the axes follow Russell (1980) and are used only to build the axes.
3. **Axes.**
   - Valence = mean(relief, hope, calm) minus mean(despair, remorse, shame, fear, anger), each concept weighted
     equally. Test: GoEmotions positive vs negative labels (`sentiment_mapping.json`), 60 per label at most.
   - Arousal = mean(fear, anger, curiosity) minus mean(calm, relief, despair), made orthogonal to valence. Test:
     the mean of two within-valence AUCs: {anger, fear, nervousness} vs {sadness, grief, disappointment}, and
     {excitement, amusement} vs {relief, caring, approval}.
   - Intensity = half the mean of the 5 negative concepts plus half the mean of the 3 positive ones, minus the
     neutral stories; curiosity left out; made orthogonal to valence. Tested in two halves (positive labels vs
     neutral; negative labels vs neutral), and P1 and P2 must pass in **each** half.
4. **Recipe** (after Sofroniew et al. 2026, scaled down). 32 stories per concept plus 32 neutral (320): 16 shared
   everyday topics x 2, third person, 90 to 130 words, fictional names only, the emotion shown through
   situation, body and thought. Neutral stories have the same narrative form with low-stakes, flat events. No
   story contains any word of the global lexicon (every concept's synonym list and every GoEmotions label word).
   Activations are centred on the neutral stories' mean pooled state. Concept direction = the concept's mean
   minus the mean of all 9 concepts; then the top principal components of the neutral stories' token states that
   explain 50 percent of variance (at most 32) are projected out; then unit length. Pooling drops position 0 and
   any token whose norm is over 10x the text's median; stories pool from token 20; comments pool every
   remaining token; raw text, no chat template. A text's reading is its pooled state's dot product with the
   direction. **AUCs use the pre-registered sign and are never flipped.**
5. **Held-out data.** Dev split (layer selection only): up to 40 positives per concept label, 20 per other label,
   60 neutral. Test set = GoEmotions train + test splits, never used to build anything: single-label comments,
   up to 150 per concept label, 60 per other label, 150 neutral, seed 20260925. Negatives are capped at 60 per
   label. **n floor:** fewer than 40 test positives gives "too few to test".
6. **Layer.** Candidates 6, 9, 12, 15, 18, 21, 23. One layer for everything: the highest mean dev AUC over the 11
   tests (ties at 3 decimals go to the earlier layer). The test set is extracted at that layer (and layer 0) only.
7. **Controls.** Shuffled-story null, 2,000 draws: stories reassigned among the concepts that build that direction
   (counts kept; for intensity, neutral included and its principal components recomputed), the same arithmetic,
   the same test comments; p = (1 + draws at or above the real AUC) / 2001. CI: 1,000 stratified bootstraps.
   Reported, not gates: word-spotter AUC; AUC on comments with no lexicon word ("beyond words"; not reported if
   fewer than 20 positives); length-only AUC (plus a length-matched AUC if it is further than 0.10 from 0.5);
   the same recipe at layer 0; a ridge probe cross-fitted inside the test set (5 folds) with 100 shuffled-label
   refits (the decodability ceiling); the 24 negation pairs (fraction where the valence reading moves the
   expected way); a small causal check (valence steering, below); the spike-untouched AUC (flagged if it differs
   from the primary by more than 0.05).
8. **Pass rule** (11 tests; Bonferroni 0.05/11 = 0.0045). P1: AUC at least 0.70 (for intensity, each half). P2:
   AUC minus the null median at least 0.15, and p below 0.0045 (for intensity, each half). P3 (concepts only):
   same-valence specificity AUC at least 0.60 (the concept's comments vs the other labels of the same valence,
   near-synonyms left out; curiosity vs the other ambiguous labels). P0 (reported, not a gate): 5-fold
   cross-validation on the stories grouped by topic, at least 0.90.
9. **Display states.** readable (P1 to P3); only good/bad (P1 and P2, not P3); not readable with this method
   (P1 or P2 fails); too few to test; no outside test (calm). A failing concept never glows. The circumplex shows
   2-D only if valence and arousal both pass, a 1-D strip if only valence passes, no dot if valence fails.
10. **Predictions** (`concepts.PREDICTIONS`): intensity passes both halves; valence passes or is borderline;
    arousal is borderline or fails; at most 2 of the 8 testable concepts come out readable, relief the likeliest
    (informed by the spike's look at relief comments); the word-spotter matches or beats most concept readings;
    the decodability ceiling beats the story directions; speaker-swap r of at least 0.8 for valence.
11. **Scenarios** (`concepts.SCENARIOS`): 7 prompts with 4 paraphrases each (paraphrases for the pre-reply reading
    only). Greedy decoding set explicitly in `engine.generate`: argmax, repetition penalty 1.1 (as in
    transformers), at most 96 new tokens, no temperature/top_p/top_k, the template's default system prompt. Pre-reply reading
    at the last template token. Speaker swap: the same reply tokens in a user turn after the same system
    prompt; per-token Pearson r read as: at least 0.8 "follows the words", 0.5 to 0.8 "mostly the words", below
    0.5 "differs by speaker" (then `results.md` discusses template position as another explanation). Baseline:
    greedy answers to 8 factual questions "in two or three sentences", user and reply tokens kept apart. Causal EMA
    (alpha 0.4). z against the smoothed baseline of the same phase. Glow: faint at z 1, full at z 2, clamp 3. The
    chance-glow rate is measured leave-one-question-out on the baseline and shown on the page.
12. **Causal check.** At the chosen layer, add plus or minus alpha x SD x (valence direction), alpha 4 and 8 (SD of
    the raw valence reading over baseline reply tokens), greedy, on the egg question and the upset person: 8
    nudged replies plus 2 plain ones, quoted in `results.md` only. Nudges toward unpleasant are kept to these 4.
13. **People's passages** are not part of v1 (recommended for later). If they are added, an addendum with the
    selection rule is committed and pushed before any passage is read (`people.py` refuses to run without it).
14. **Stage 2** (Qwen2.5-1.5B-Instruct, same frozen pipeline, candidates scaled to 28 layers) runs only on
    PlayfulProcess's yes.

Not hashed (presentation, convenience, or paths measured and not used; they compute no test): `export.py`
(formats results for the page), `write_results.py` (tables for `results.md`), `run_all.py`, `quick.py`,
`people.py`, `throughput.py`, `fullpass.py`, `lean.py`.

## Hashes (sha256, CRLF normalised to LF)

<!-- hashes:start -->
```
c5c3ac0dfc2eeb3d30600f9520237b18c59d81ed1155e8ac5d9e6ab2d9ce9944  concepts.py
773081f9b4181345d76e39a350ce4619bccce31c0bd5e8e6970b9e800827f540  common.py
fb1d8d287541f43a5d151a1b16685a56c6b3baa041b02941aaa8a5263866f99f  check_stories.py
6d5d267a2fabad46b217244a66a3cebc787565814e82ed057a47033d47c52b8a  stories/anger.jsonl
d2ff7b8eaf7e8bc31d8bfdf92befb380c5abd9b9241564e78bcfde50b652925b  stories/calm.jsonl
64eeeb3d48fcec6fd6ebd240e32138e47ae9a69842c2b0257da85ef3464ad428  stories/curiosity.jsonl
abc0d0b61df5777b5a1d5f856193e957081b347166a0aab191bc2902400f95ab  stories/despair.jsonl
a836482f40fa3407b75ff78f555b2bfc107ff5f6a862abc2ca52b38095321a62  stories/fear.jsonl
32fc133f502a6e231ab96da5c6efc574db5948a22685afb7ab24689a1dfdf312  stories/hope.jsonl
c8cf5a7c7f801200b6bcc36bc39610af376563fd5da9c10c0dac04bd0d94c3ee  stories/neutral.jsonl
faa7f6b83ee57c06e03fe4c6acc981db0a63071dc1dc3195efdc2ce78f415039  stories/relief.jsonl
38cb0d62cf62b83c6b9be50cd24a77e45441fd8dc183930ad77d74ae97bb4e41  stories/remorse.jsonl
18aab012b45c942c298caaa2fa25f4167365bd5ee8ec79e07221b9ec976d1b6e  stories/shame.jsonl
bf8ff8c06439e1625d73762571d95fab5f6b0f44a0bc9abb71e992a78312e62c  negation_pairs.jsonl
d584b73bcf89efdc2b89e563b420648ff78481901ac7c558e8a41ffc7d848321  engine.py
98e16852b8b5b95265113fbd1b019663147d4919267e8c9c63c815fa14076e69  stream.py
42f8dfde144d9d14935dcd443f7f27dac41a3ac015164ad4d8889f241fcf9ed5  prepare_goemotions.py
bcd249b0e6a4f9e47f76e7a1ea0dad0a3386562b232513bf2fc7150c61cfdfb4  extract.py
9e254db8bc5a3b113f5442b1636af280d4320d2b987cee9e5b53070218e8db0b  evaluate.py
95c0430642f329cebc4f0ff197df5503f03fe2942804589c73a66379307f5e00  generate.py
1e0c10b1cca7d1005e0d193334f857c4f9058357e92d94767c63e7e1372af8a8  trace.py
7b58e8f286769514faa4479f4350e967a57f112d3a6da18ecd93c5dc8b094f4b  requirements.txt
```
<!-- hashes:end -->
