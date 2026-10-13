# Elasticity, inside a model: an honest look at the idea

Written Oct 8 2026. Every citation below was checked that day; where only a record (not the
paper) could be read, the entry says so.

## The idea, in her words and ours

PlayfulProcess comes to this from economics and pricing work. Her observation: in academic
papers, measured price elasticities rarely match the theoretical ones. Her question: does
elasticity need a shift like the one Lisa Feldman Barrett brought to emotion, from a fixed,
universal thing to something constructed in the moment? And is that an AI research problem that
interpretability could study?

## Short answer

Two questions sit inside this one, and they need different tools.

| | Question | Who can answer it | Feasible here? |
|---|---|---|---|
| A | Is human price response a stable parameter, or constructed from context each time? | economists and psychologists, with human data | no: a model trained on text about people is not a sample of consumers |
| B | How does a language model represent price, and does its choice respond to price consistently? | interpretability, on an open model | yes: small, cheap, a few evenings |

B is doable, and it touches alignment directly: language models are starting to buy things for
people, so their own price sensitivity quietly shapes what people pay. A is where the paradigm
idea lives. B can serve as a test bed and an analogy for A, but it cannot settle A.

---

## What economics already knows

"Elasticity varies with context" is already mainstream in marketing science. A paradigm-shift
claim would need to predict something these findings do not.

- **Elasticities differ a lot, and in patterns.** Bijmolt, van Heerde and Pieters,
  [New Empirical Generalizations on the Determinants of Price Elasticity](https://doi.org/10.1509/jmkr.42.2.141.62296)
  (Journal of Marketing Research, 2005), a meta-analysis of published elasticities and what
  makes them vary. (Bibliographic record checked; the full text was not readable on Oct 8.)
- **People judge a price against a reference price, and losses weigh more than gains.**
  Kalyanaram and Winer,
  [Empirical Generalizations from Reference Price Research](https://ideas.repec.org/a/inm/ormksc/v14y1995i3_supplementpg161-g169.html)
  (Marketing Science, 1995).
- **Firms do not price the way estimated elasticities say they should.** DellaVigna and
  Gentzkow, [Uniform Pricing in U.S. Retail Chains](https://www.nber.org/papers/w23996)
  (Quarterly Journal of Economics, 2019): most chains charge nearly the same prices across their
  stores even though demand differs between stores, and leave profit on the table. Differences
  between chains look roughly in line with the theory.
- **Prices and promotions vary widely across stores and chains.** Hitsch, Hortaçsu and Lin,
  [Prices and Promotions in U.S. Retail Markets](https://doi.org/10.1007/s11129-021-09238-x)
  (Quantitative Marketing and Economics, 2021). (Record checked, not the full text.)

### Where the Barrett analogy might hold

Barrett's move, in brief
([The theory of constructed emotion](https://pmc.ncbi.nlm.nih.gov/articles/PMC5390700/), 2017;
[Emotional Expressions Reconsidered](https://doi.org/10.1177/1529100619832930), 2019): there is
no fixed fingerprint for each emotion. The brain builds an emotion in the moment from bodily
signals, the situation, and the concepts a person has learned.

An elasticity version would say: there is no fixed price response for a person and a product.
It is built in the moment from the reference price, the framing, the concept the product falls
under ("a treat", "a staple"), and the options in view.

Reference-price and behavioural models already go part of the way. The open question is what a
constructed view predicts that they do not. That is a question for human data, and for her
judgement as an economist; this note does not try to answer it.

A privacy note: this repo is public. Employer data, methods and numbers stay out of it.

---

## What is known about language models as consumers

The pattern across these papers: model demand curves usually slope down and look reasonable, and
models often choose more consistently than people do. But the curves move with prompt wording,
price changes can drag unstated assumptions along with them, and different models differ a lot.

| Paper | What it found |
|---|---|
| Horton, Filippas and Manning, [Large Language Models as Simulated Economic Agents: What Can We Learn from Homo Silicus?](https://arxiv.org/abs/2301.07543) (NBER WP 31122, 2023) | Classic behavioural-economics experiments rerun on LLM "agents" give results qualitatively like the originals; the differences suggest new questions. |
| Brand, Israeli and Ngwe, [Using GPT for Market Research](https://www.msi.org/working-paper/using-gpt-for-market-research/) (MSI working paper; ACM EC 2024) | GPT's survey answers fit basic demand theory (downward-sloping demand, falling marginal utility), with willingness-to-pay estimates of realistic size. |
| Gui and Toubia, [The Challenge of Using LLMs to Simulate Human Behavior: A Causal Inference Perspective](https://arxiv.org/abs/2312.15524) (2023, revised 2025) | When a prompt changes a product's price, the model also shifts things the prompt left unsaid, which confounds the demand estimate. Against a real 40-product experiment this gave implausible results; telling the model the experiment's design helped across every model they tested. |
| Goli and Singh, [Can Large Language Models Capture Human Preferences?](https://arxiv.org/abs/2305.02531) (Marketing Science, 2024) | In choices over time, the models were less patient than people. |
| Chen, Liu, Shan and Zhong, [The emergence of economic rationality of GPT](https://arxiv.org/abs/2305.12763) (PNAS, 2023) | GPT's budget choices were largely consistent with utility maximisation, more so than human subjects, and sensitive to wording. |
| Argyle et al., [Out of One, Many](https://arxiv.org/abs/2209.06899) (Political Analysis, 2023) | Conditioning on demographics gives "silicon samples" that track human subgroups on survey questions. |
| Aher, Arriaga and Kalai, [Using Large Language Models to Simulate Multiple Humans](https://arxiv.org/abs/2208.10264) (ICML, 2023) | Several classic studies replicate; some models show a "hyper-accuracy" distortion. |
| Reusens, Goethals, Calders and Martens, [Would a Large Language Model Pay Extra for a View?](https://arxiv.org/abs/2602.09802) (2026) | Larger models give meaningful implied willingness to pay, but it differs from people's by attribute and runs higher, especially for expensive options. |
| Oetzel and Maiberger, [How price sensitive is AI?](https://doi.org/10.1057/s41270-026-00542-7) (Journal of Marketing Analytics, 2026) | Against incentive-compatible consumer data, model willingness to pay looks reasonable but leads to different pricing decisions. (Record checked, not the full text.) |
| Kireyev, [PriceBench](https://arxiv.org/abs/2609.31468) (2026) | Across 28 models booking hotels, price sensitivity spans more than tenfold; what a buying agent picks has to be measured model by model. |

## What is known inside models

We did not find a paper, on Oct 8 2026, that probes how a model represents price or willingness
to pay. That may be a gap, or we missed it. The nearest work:

- Numbers: [LLMs Know More About Numbers than They Can Say](https://arxiv.org/abs/2602.07812)
  (Yuchi, Du and Eisner, 2026) finds a straight-line readout of a number's size (on a log scale)
  in the activations. [Language Models Encode Numbers Using Digit Representations in Base 10](https://arxiv.org/abs/2410.11781)
  (Levy and Geva, 2025) finds that models also store numbers digit by digit, which matters when
  prices are written as "$2.99". [Language Models Use Trigonometry to Do Addition](https://arxiv.org/abs/2502.00873)
  (Kantamneni and Tegmark, 2025) shows how one model adds numbers.
- Economic facts: [Revealing economic facts: LLMs know more than they say](https://arxiv.org/abs/2505.08662)
  (Buckmann, Nguyen and Hill, Bank of England, 2025): probes on activations estimate regional
  and firm statistics better than the model's own text answers.
- Directions for concepts: [Language Models Represent Space and Time](https://arxiv.org/abs/2310.02207)
  (Gurnee and Tegmark), [The Geometry of Truth](https://arxiv.org/abs/2310.06824) (Marks and
  Tegmark), [Refusal in Language Models Is Mediated by a Single Direction](https://arxiv.org/abs/2406.11717)
  (Arditi et al.), [Representation Engineering](https://arxiv.org/abs/2310.01405) (Zou et al.),
  and [Persona Vectors](https://arxiv.org/abs/2507.21509) (Chen et al., 2025).
- In this repo: the [model-affect study](../../lab/model-affect/results.md) probed a small open
  model for emotion concepts. Its pleasant-unpleasant axis was readable; despair, guilt and
  relief were not, at that size and with that method. That fits Barrett's picture (a basic
  pleasant-unpleasant signal, with finer categories built on top), but it does not test it: a
  small model may simply lack the finer concepts.

---

## A small study that could be done

The question: **does an open model's implied demand curve hold together, and is there a price
direction inside it that drives the choice?**

Model: Qwen2.5-0.5B-Instruct, which the model-affect study already runs on this laptop, one layer
at a time (`lab/model-affect/engine.py`). A larger open model, such as Gemma 2 2B, can run in
free Colab, and Neuronpedia hosts ready-made features for the Gemma models.

**Stage 1. The curve (behaviour).** A short shopper scenario: a product, a usual price, today's
price, and the question "Do you buy it? Answer Yes or No." Read the model's probability of "Yes"
directly from its output scores, so no sampling is needed. Vary today's price over a grid around
the usual price. Fit a logit curve and read the implied elasticity. Then test:

1. Does the buy probability fall as price rises?
2. Does it stay the same under changes that should not matter: "$3" against "3 dollars" against
   "$3.00", the order of sentences, a synonym for the product?
3. Reference price: at the same price, does a higher "usual price" raise the buy probability,
   and does a loss weigh more than a gain of the same size (the Kalyanaram and Winer pattern)?
4. Gui and Toubia's check: does telling the model that only the price changes alter the curve?

**Stage 2. The direction (inside).** Save the activations at the price and at the final token.
At each layer, fit a probe for log price, and a second probe for price relative to the usual
price (a gain or loss signal). Controls: shuffled labels; the same numbers in a sentence that is
not about buying (is it only number size?); a probe trained on one product category and tested
on another.

**Stage 3. The cause (steering).** Add the gain-or-loss direction to the activations and see
whether the buy probability moves the expected way. Compare with a random direction of the same
length.

Write the tests and the pass rules down and push them before any reading, as the model-affect
study did ([its pre-registration](../../lab/model-affect/PREREGISTRATION.md)). Cost: free. Time:
a few evenings.

### What each result would mean

- **Only number size inside, no gain-or-loss signal:** the model treats price as a number, and
  its "elasticity" comes from word associations.
- **A gain-or-loss direction that moves the choice when steered:** an inside version of
  reference-dependent demand, learned from text. Worth writing up.
- **Curves that change under wording that should not matter:** the model's price response is
  built from the prompt. That is an analogy to a constructed view, not evidence about people.

---

## What would make it a real contribution

- A causal result, not only a correlation: steering moves the choice, against matched controls.
- Pre-registered tests with null baselines, and the prompts and code released.
- A link to agents that buy. PriceBench finds price sensitivity varies more than tenfold across
  models. A way to read a buying agent's price sensitivity from its insides, or to explain where
  it comes from, would be useful to anyone who deploys such agents. That is the alignment angle:
  whose preferences decide what a person pays.

## What would not

- Reporting "the model's elasticity is X" from one prompt. Many papers already measure behaviour,
  and one prompt says little.
- Claiming the model's results show that human elasticity is constructed. The model learned from
  text about people. It is not a sample of consumers, and in one 2026 test its willingness to pay
  led to different pricing decisions from real consumers' data.
- Finding a "price" feature on Neuronpedia and stopping there. Labels are written by an AI, and
  there are price features for many senses of the word.
- A probe that decodes price with no controls. Number size is easy to read out of activations.
- Talk of a paradigm shift before there is a result.

## Scope, and people

One study, small enough to finish in 2027 without strain, written up in this repo. Any note to
the authors above waits until 2028; drafts can sit in this folder until then.
