# Model affect: the pre-registered test behind the explainer

This folder is the lab work behind `explainers/model-affect/` ("Does the model feel anything? What we can and
can't read"). It asks a scoped question of a small open model (Qwen2.5-0.5B-Instruct): **which emotion concepts
are active in how the model processes the current words, token by token**. It cannot say whether anything is
felt, and nothing here claims that.

It is not published to the site (the Pages workflow copies only `explainers/`); the page links here through
GitHub.

## Read in this order

1. `PREREGISTRATION.md`: the tests, written and pushed before any reading, with the sha256 of every frozen file.
2. `results.md`: every number, predictions against outcomes, the controls, the steering replies, deviations.
3. `concepts.py`: the single source of truth (concepts, lexicons, scenarios, seeds, the pass rule).

## Run it yourself

CPU only; about 20 GB free disk is plenty (the model is about 1 GB; scratch stays under 1 GB).

```
pip install -r requirements.txt
python run_all.py            # everything, checkpointed; a few hours on 4 CPUs
python run_all.py --quick    # a 15-minute demo of the method (2 scenarios, 1 layer); not the test
```

Caches go to `$MODEL_AFFECT_CACHE` (default `~/.cache/model-affect`), never into the repo. The model downloads
from Hugging Face on first use (revision pinned in `concepts.py`); to free the space afterwards, delete
`~/.cache/huggingface/hub/models--Qwen--Qwen2.5-0.5B-Instruct`, and the next run fetches it again.

| Stage | Script | Output |
|---|---|---|
| story check | `check_stories.py` | pass/fail per story |
| data | `prepare_goemotions.py` | cache: GoEmotions, samples, spike-touched ids; `results/data_counts.json` |
| readings | `extract.py stories / dev / test / negation` | cache: pooled states |
| layer | `evaluate.py select` | `results/layer.json` |
| tests | `evaluate.py test` | `results/metrics.json` |
| replies | `generate.py replies` | `results/replies.json` |
| traces | `trace.py` | `results/traces.json` |
| causal check | `generate.py steer` | `results/steering.json` |
| page data | `export.py` | `explainers/model-affect/data/` |

`engine.py` is the forward pass and greedy decoder used: one decoder layer in memory at a time, fp32 maths.
Build step 0 (`throughput.py`) also measured a whole-model fp32 load (`fullpass.py`) and a bf16-stored one
(`lean.py`); under the machine's memory pressure both paged to disk. `people.py` is a stub: real people's
passages are not part of v1.

## Data and text

- No GoEmotions comment text is committed; only counts, ids and derived numbers.
- The 320 stories in `stories/` were written by Claude (Anthropic) for this test; the characters are fictional.
- GoEmotions: Demszky et al. 2020 (arXiv 2005.00547), downloaded from the google-research repository.
