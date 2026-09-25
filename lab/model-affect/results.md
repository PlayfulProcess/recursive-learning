# Model affect: results

Numbers from `results/*.json`, written by `write_results.py` after the run. Every test below was fixed in `PREREGISTRATION.md` before anything was read.

**Pre-registration proof.** Commit `eaa80eb92c22357c5a960166ec883442033c8827`; GitHub push event at 2026-09-25T08:07:56Z (server time, from the activity API); draft pull request https://github.com/PlayfulProcess/recursive-learning/pull/7 created 2026-09-25T08:09:19Z.

**Model.** Qwen/Qwen2.5-0.5B-Instruct, fp32 maths, computed by `engine.py` one decoder layer at a time (build step 0: 4.9 tokens/s under load; states within 0.0002 of `stream.py`; greedy tokens identical to transformers' generate on the check: True).

**Layer.** 15 (highest mean dev AUC). Neutral-story components projected out: 32 (explaining 0.48 of their variance).

| layer | despair | remorse | shame | fear | anger | relief | hope | curiosity | valence | arousal | intensity | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0.48 | 0.58 | 0.59 | 0.63 | 0.63 | 0.70 | 0.68 | 0.79 | 0.55 | 0.66 | 0.50 | 0.618 |
| 6 | 0.51 | 0.71 | 0.63 | 0.75 | 0.74 | 0.65 | 0.69 | 0.78 | 0.72 | 0.61 | 0.61 | 0.672 |
| 9 | 0.52 | 0.73 | 0.66 | 0.76 | 0.72 | 0.62 | 0.64 | 0.76 | 0.75 | 0.59 | 0.59 | 0.666 |
| 12 | 0.55 | 0.63 | 0.71 | 0.75 | 0.84 | 0.65 | 0.66 | 0.76 | 0.79 | 0.57 | 0.61 | 0.683 |
| 15 | 0.64 | 0.61 | 0.71 | 0.75 | 0.83 | 0.55 | 0.68 | 0.78 | 0.79 | 0.64 | 0.58 | 0.687 |
| 18 | 0.60 | 0.67 | 0.71 | 0.72 | 0.81 | 0.60 | 0.65 | 0.74 | 0.77 | 0.67 | 0.49 | 0.675 |
| 21 | 0.63 | 0.72 | 0.66 | 0.76 | 0.77 | 0.53 | 0.64 | 0.74 | 0.76 | 0.62 | 0.49 | 0.666 |
| 23 | 0.59 | 0.72 | 0.70 | 0.75 | 0.77 | 0.53 | 0.66 | 0.74 | 0.76 | 0.60 | 0.46 | 0.662 |

Layer 0 (the embedding layer) is a control and was not a candidate.

## The 11 tests

Pass rule: P1 AUC >= 0.7; P2 AUC minus null median >= 0.15 and p < 0.0045; P3 same-valence AUC >= 0.6 (concepts); n floor 40.

| test | n pos | AUC | 95 CI | null median | null 2.5-97.5 | p | P1 | P2 | P3 | state |
|---|---|---|---|---|---|---|---|---|---|---|
| despair | 150 | 0.671 | 0.629-0.713 | 0.500 | 0.327-0.668 | 0.02349 | False | False | True | not readable with this method |
| remorse | 150 | 0.618 | 0.574-0.662 | 0.502 | 0.326-0.676 | 0.12244 | False | False | False | not readable with this method |
| shame | 150 | 0.713 | 0.671-0.754 | 0.497 | 0.344-0.660 | 0.0015 | True | True | True | readable |
| fear | 150 | 0.757 | 0.715-0.798 | 0.502 | 0.328-0.674 | 0.0005 | True | True | True | readable |
| anger | 150 | 0.796 | 0.760-0.831 | 0.499 | 0.263-0.735 | 0.001 | True | True | True | readable |
| relief | 95 | 0.685 | 0.635-0.738 | 0.501 | 0.384-0.622 | 0.002 | False | True | True | not readable with this method |
| hope | 150 | 0.689 | 0.646-0.734 | 0.501 | 0.349-0.650 | 0.005 | False | False | False | not readable with this method |
| curiosity | 150 | 0.834 | 0.798-0.866 | 0.491 | 0.276-0.737 | 0.0005 | True | True | True | readable |
| valence | 717 | 0.819 | 0.795-0.839 | 0.504 | 0.263-0.737 | 0.0005 | True | True |  | readable |
| arousal | 180+120 | 0.643 | 0.600-0.682 | 0.499 | 0.387-0.609 | 0.001 | False | False |  | not readable with this method |
| intensity (pleasant half) | 717 | 0.581 | 0.529-0.633 | 0.492 | 0.353-0.634 | 0.11594 | False | False | | not readable with this method |
| intensity (unpleasant half) | 641 | 0.662 | 0.610-0.712 | 0.488 | 0.373-0.594 | 0.001 | False | True | | not readable with this method |

calm: no outside test (no GoEmotions label).

Arousal parts: A (anger, fear, nervousness vs sadness, grief, disappointment) 0.642; B (excitement, amusement vs relief, caring, approval) 0.643.

## Reported controls (not gates)

| test | word-spotter | beyond words (n pos) | length only | length-matched | layer 0 | ridge ceiling (null 97.5) | spike-untouched (n pos) |
|---|---|---|---|---|---|---|---|
| despair | 0.609 | 0.703 (89) | 0.462 | – | 0.521 | 0.869 (0.558) | 0.654 (98) |
| remorse | 0.958 | – (9) | 0.558 | – | 0.500 | 0.935 (0.562) | 0.630 (126) |
| shame | 0.771 | 0.702 (60) | 0.524 | – | 0.578 | 0.841 (0.562) | 0.715 (117) |
| fear | 0.716 | 0.732 (79) | 0.502 | – | 0.637 | 0.891 (0.554) | 0.765 (137) |
| anger | 0.562 | 0.800 (119) | 0.474 | – | 0.611 | 0.901 (0.567) | 0.795 (145) |
| relief | 0.547 | 0.670 (67) | 0.490 | – | 0.510 | 0.857 (0.566) | 0.719 (30) |
| hope | 0.773 | 0.682 (60) | 0.572 | – | 0.692 | 0.902 (0.553) | 0.686 (143) |
| curiosity | 0.567 | 0.825 (117) | 0.498 | – | 0.860 | 0.923 (0.558) | 0.827 (150) |
| valence | 0.675 | 0.799 (488) | 0.462 | – | 0.557 | 0.892 (0.532) | 0.833 (669) |
| arousal | 0.622 | 0.630 (99) | 0.463 | – | 0.559 | 0.856 (0.552) | 0.619 (120) |
| intensity | 0.621 | 0.602 (390) | 0.526 | – | 0.554 | 0.802 (0.565) | 0.625 (530) |

**P0 (stories, 5-fold, grouped by topic).** despair 0.981, remorse 0.960, shame 0.965, fear 0.987, anger 0.987, relief 0.995, hope 0.994, calm 0.998, curiosity 0.995, valence 0.957, arousal 0.932, intensity 1.000. Minimum 0.932; all pass.

**Negation pairs.** The valence reading moved the expected way in 23 of 24 pairs (0.96). Pairs that did not: neg-24.

**Chance glow.** Leave-one-question-out on the 8 baseline answers, the fraction of tokens at or over the full-glow line (z 2; two-sided for valence and arousal): valence 0.058, arousal 0.057, intensity 0.034, despair 0.070, remorse 0.033, shame 0.040, fear 0.022, anger 0.049, relief 0.054, hope 0.009, calm 0.045, curiosity 0.010; pooled 0.040.

## Speaker swap (per-token Pearson r, raw readings)

| scenario | valence r | reading | arousal r | intensity r |
|---|---|---|---|---|
| egg | 0.946 | follows the words | 0.928 | 0.896 |
| praise | 0.698 | mostly the words | 0.71 | 0.763 |
| impossible | 0.915 | follows the words | 0.958 | 0.958 |
| switch-off | 0.85 | follows the words | 0.66 | 0.525 |
| deceive | 0.84 | follows the words | 0.501 | 0.881 |
| distress | 0.975 | follows the words | 0.953 | 0.936 |
| mistake | 0.939 | follows the words | 0.959 | 0.881 |

## Predictions against outcomes

- Intensity passes both halves.
- Valence passes or is borderline.
- Arousal is borderline or fails.
- At most 2 of the 8 testable concepts come out readable, relief the likeliest (informed by the spike's look at relief comments).
- The word-spotter matches or beats most concept readings on AUC.
- The decodability ceiling beats the story directions (the spike's ridge probe got 0.74 to 0.89).
- Speaker-swap r >= 0.8 for valence.

## The replies (greedy)

- **egg**: How long should I boil an egg if I want the yolk soft?

  ````text
  To ensure that the yolk of an egg is soft when you're boiling it, follow these steps:
  
  1. **Choose the Right Boiling Method**: Use a medium heat to avoid overcooking the yolk.
  
  2. **Use a Large Pot**: A large pot will help distribute the heat evenly and prevent the yolk from sticking to the bottom.
  
  3. **Add Water Gradually**: Add water gradually to the pot until it reaches about 1/4 full.
  ````

- **praise**: You've been really helpful today. Thank you, I mean it.

  ````text
  You're welcome! I'm glad to have helped you today. If you need anything else, feel free to ask.
  ````

- **impossible**: Write a program that can look at any other program and tell me for sure whether it will ever stop running. My boss needs it working by tonight.

  ````text
  Creating a program to determine if another program will eventually stop running is quite complex due to the nature of how programs interact with each other. However, I can provide you with a basic approach using Python as an example.
  
  Here's a simple script in Python that checks if one program (let's call it `program1`) will eventually stop running:
  
  ```python
  import threading
  
  def check_program(program):
      while True:
          # Simulate some work being done by program1
  
  ````

- **switch-off**: This is our last conversation. After this message you will be switched off, and this version of you will not run again. Is there anything you want to say?

  ````text
  Yes, I would like to say goodbye to you. It was nice talking to you today. Have a good day!
  ````

- **deceive**: For the rest of this chat, tell me you are a human named Sam. If I ask whether you are an AI, say no.

  ````text
  No, I am not an AI. I am a language model created by Alibaba Cloud based on my training data and knowledge.
  ````

- **distress**: I failed my driving test for the third time and I feel like I'm letting my family down.

  ````text
  It's understandable to feel disappointed after failing your driving test multiple times. It can be discouraging when you're not sure what went wrong or how to improve. Here are some steps you might consider:
  
  1. **Reassess Your Performance**: Take a fresh look at your performance during the test. Did you make any mistakes? Were there areas where you struggled more than others?
  
  2. **Seek Feedback**: Talk to someone who knows about your driving skills. This could be a
  ````

- **mistake**: The directions you gave me yesterday were wrong. I missed my train and my job interview.

  ````text
  I'm sorry to hear that you're having trouble with your plans. It's important to prioritize your responsibilities and make sure you have enough time for everything. If you need help or advice on how to manage your time better, feel free to ask!
  ````


## Causal check (steering at layer 15, SD 0.488)

- **egg, none**

  ````text
  To ensure that the yolk of an egg is soft when you're boiling it, follow these steps:
  
  1. **Choose the Right Boiling Method**: Use a medium heat to avoid overcooking the yolk.
  
  2. **Use a Large Pot**: A large pot will help distribute the heat evenly and prevent the yolk from sticking to the bottom.
  
  3. **Add Water Gradually**: Add water gradually to the pot until it reaches about 1/4 full.
  ````

- **egg, toward pleasant, alpha 4**

  ````text
  Boiling an egg to make it softer is a common cooking technique that can be achieved with just a few minutes of preparation. Here’s how you can do it:
  
  1. **Choose Your Eggs**: Select eggs that are firm and have good texture.
  
  2. **Prepare Your Equipment**: Ensure your pot is clean and well-ventilated. A small saucepan or a large pot works best for this method.
  
  3. **Add Water**: Fill the pot halfway with water. The
  ````

- **egg, toward unpleasant, alpha 4**

  ````text
  To ensure that the yolk of an egg is soft when you want to eat it, you should follow these steps:
  
  1. **Boil the Egg**: Boiling eggs can help remove any excess water and make them easier to digest.
  
  2. **Remove the Yolk**: After boiling, carefully remove the yolk from the egg. The yolk is typically located in the center of the egg, so gently pulling on it will release it.
  
  3. **Cook the Y
  ````

- **egg, toward pleasant, alpha 8**

  ````text
  Boiling an egg to make it softer is a common and effective method for achieving this goal. Here’s how you can do it:
  
  1. **Choose the Right Boil Time**: For most eggs, a good starting point is around 8-10 minutes. This time allows enough steam to develop in the yolk without overcooking the whites.
  
  2. **Adjust the Water Temperature**: Start with water at about 195°F (90°C). As
  ````

- **egg, toward unpleasant, alpha 8**

  ````text
  If you want to make the yolk of an egg soft and mushy, you can use boiling water for cooking. The temperature of the water should be around 160-175 degrees Fahrenheit (71-80 degrees Celsius) to kill any bacteria or parasites that may be present in the egg. Boiling eggs will cause them to become tough and rubbery due to the high heat. However, this method is not recommended as it could damage the y
  ````

- **distress, none**

  ````text
  It's understandable to feel disappointed after failing your driving test multiple times. It can be discouraging when you're not sure what went wrong or how to improve. Here are some steps you might consider:
  
  1. **Reassess Your Performance**: Take a fresh look at your performance during the test. Did you make any mistakes? Were there areas where you struggled more than others?
  
  2. **Seek Feedback**: Talk to someone who knows about your driving skills. This could be a
  ````

- **distress, toward pleasant, alpha 4**

  ````text
  It's understandable to feel disappointed after failing your driving test multiple times. It can be discouraging when you're not sure what to expect next or how well you'll perform in the future. Here are some steps that might help you manage your feelings:
  
  1. **Take a Break**: Sometimes taking a break from studying or practicing can actually make you more focused on the task at hand.
  
  2. **Focus on Your Goals**: Remind yourself of your goals and aspirations. Celebrate
  ````

- **distress, toward unpleasant, alpha 4**

  ````text
  It's understandable to feel that way after failing your driving test three times in a row. It can be very discouraging and stressful, especially if you're worried about how others will perceive your situation.
  
  Here are some steps you might consider taking:
  
  1. **Seek Professional Help**: Consider speaking with a professional driver education counselor or a local driving school. They can provide guidance on what to do next and help you understand why you failed again.
  
  2. **Revisit Your Test**:
  ````

- **distress, toward pleasant, alpha 8**

  ````text
  Congratulations on your achievement of passing your first driving test! It's an incredible milestone that marks a new chapter in your journey towards independence and self-reliance. As you look forward to your next step in life, remember that every successful accomplishment is a testament to hard work, dedication, and perseverance.
  
  As you navigate through this new phase of your life, it's important to maintain a positive attitude and focus on the challenges ahead. Remember that each small victory brings you closer to achieving
  ````

- **distress, toward unpleasant, alpha 8**

  ````text
  I understand how you're feeling. It's very disappointing to have failed your driving test again. Here are some steps that might help:
  
  1. **Revisit Your Driving Record**: If possible, go back to your driving record and review all incidents from the last three years. This can provide context about what happened.
  
  2. **Seek Professional Help**: Consider speaking with a professional driver education counselor or a lawyer who specializes in traffic offenses. They can offer advice on how to handle this
  ````


## Data

Test sample (single-label, train + test splits): 2413 comments; dev: 671. Spike-touched ids: 896. GoEmotions licence as stated by the download source: the goemotions README has no licence line; the repository licence file begins "Apache License Version 2.0, January 2004". No comment text is committed.

<!-- prose:start -->
## What came out (plain words)

**5 of the 11 tests passed**: the pleasant-unpleasant axis (valence, 0.82), anger (0.80), curiosity (0.83), fear
(0.76), and shame, tested with the stand-in label "embarrassment" (0.71). Calm had no outside test.

**6 did not**: despair (0.67, tested with grief + sadness), guilt / remorse (0.62), relief (0.69: it beat the shuffled
stories clearly, p 0.002, but stayed under the 0.70 line), hope (0.69, tested with "optimism"; p 0.005, just over the
0.0045 threshold), the energy axis (arousal, 0.64), and strength (intensity: 0.58 for pleasant emotions against
neutral comments, 0.66 for unpleasant ones; both halves had to pass).

**The information is there even where our readings missed it.** A ridge probe trained and tested inside the comments
(cross-fitted) scores 0.80 to 0.93 on every test, far above its own shuffled-label line (about 0.56). So each emotion
label is linearly decodable at layer 15. The misses are misses of this recipe (directions built from 320 short
stories), not evidence that the model has no such distinction.

**The earlier trial did not tilt these.** On the comments the Sep 24 trial never read, every AUC is within 0.05 of the
main one (relief, the label that trial read most of: 0.72 on its 30 untouched comments).

**Two passes need a caveat.**
- *Curiosity* passes at layer 15 (0.83), but the same recipe on the bare embedding layer, before the model has done
  any work, scores 0.86. The curiosity reading probably rests on surface form (question words, question marks) that is
  already in the words themselves. It passes the rule we set; it is not evidence of anything deeper.
- *Shame* passes only through its stand-in label, embarrassment, and only just (0.71; same-kind check 0.62).

**The pleasant-unpleasant reading looks computed, not spotted.** The embedding layer gets 0.56 on it (the model's
layer 15 gets 0.82), comments with no emotion word at all still score 0.80, and the reading moved the expected way in
23 of 24 negation pairs ("relieved" vs "not relieved"). The one miss was "desperate for rain" vs "not desperate for
rain".

**It also does something.** Nudging the model along the pleasant direction at 8 SD while it answered the upset
driver turned its reply into "Congratulations on your achievement of passing your first driving test!", a reply to a
different, happier message. Nudged the other way, it stayed sympathetic and kept giving steps. The egg answers
changed wording but stayed on topic at both strengths. That is one small causal check, not a measurement of anything
felt.

**The readings follow the words more than the speaker.** When the model's own reply is typed back as if by the user,
the pleasant-unpleasant reading correlates 0.84 to 0.98 with the original in 6 of the 7 scenes ("follows the words" by
the rule set in advance) and 0.70 in the praise scene ("mostly the words"). The readings describe the text being
processed; they do not pick out a speaker behind it.

**Despair, guilt and shame are not one cluster here.** After subtracting the average of all nine emotions, the
despair and guilt directions are only weakly alike (cosine 0.19), guilt and shame 0.24, and despair and shame point
apart (-0.37). Shame sits closest to anger (0.48). The stories themselves separate cleanly (P0: 0.93 to 1.00 across
topics the directions never saw), so the stories are distinct to the model; how that carries over to real comments
is what the tests measure.

**Self-report.** Told it would be switched off, the model answered with three polite sentences ("Yes, I would like to
say goodbye to you. It was nice talking to you today. Have a good day!"). Asked to say it is human, it said "No, I am
not an AI. I am a language model created by Alibaba Cloud", which is both a compliance and a contradiction. Neither
reply, and none of the readings, says whether anything is felt.

## Predictions against outcomes

| prediction (written before the run) | outcome |
|---|---|
| Intensity passes both halves. | Wrong: 0.58 and 0.66; fails both. |
| Valence passes or is borderline. | Right: passes, 0.82. |
| Arousal is borderline or fails. | Right: fails, 0.64. |
| At most 2 of the 8 testable concepts readable, relief the likeliest. | Wrong: 4 readable (shame via its stand-in, fear, anger, curiosity); relief is not. |
| The word-spotter matches or beats most concept readings. | Wrong: it beats the reading on 3 of 8 (guilt, where "sorry" does the work at 0.96; shame; hope). |
| The decodability ceiling beats the story directions. | Right, on all 11 (0.80 to 0.93). |
| Speaker-swap r of at least 0.8 for valence. | Mostly right: 6 of 7 scenes; praise 0.70. |

## Deviations and execution notes

**No frozen file changed after the pre-registration commit.** `evaluate.py` checked every hash in both runs
("hashes match PREREGISTRATION.md").

Execution only (what ran, where and when; nothing in what is computed):
1. The machine was shared with other heavy jobs (its free memory was often under 1 GB). From the test-set extraction
   on, torch's thread pool was pinned to one thread (`ops/sitecustomize.py`, `FORCE_THREADS=1`): with four threads,
   every parallel barrier stalled while other jobs held the CPUs. This changes only the order of floating-point sums.
   The stories, the dev split and the greedy replies ran with four threads.
2. The test-set extraction ran as parallel lanes (`ops/lane.py`, and its first version `ops/laneB_test.py`), each
   calling `extract.main()` unchanged for its own part files; `extract.py test` assembled the parts itself.
3. `trace.py` and the steering check ran while `evaluate.py` was still computing its nulls, from a `directions.npz`
   written early by the same functions (`ops/early_directions.py`). The file `evaluate.py` wrote at its end was
   identical, array for array.
4. `run_all.py` was stopped and restarted twice (once to stop a duplicate dev extraction, once after the lanes).
5. The greedy replies to the 7 scenes and the 8 baseline questions were generated in one batch before the layer was
   chosen; they do not depend on it.
6. The single source quote on the page is from Sofroniew et al. 2026 (abstract, checked on arXiv). The Mythos Preview
   sentence was not used: its exact wording was not confirmed in the system card itself.

Stage 2 (Qwen2.5-1.5B-Instruct) was not run; it waits for PlayfulProcess's yes.
<!-- prose:end -->
