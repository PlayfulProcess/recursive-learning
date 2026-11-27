# 2027 — inventory of what already exists

Nov 27 2026. Read-only survey for the 2027 section (contact with non-human intelligence: the
claimed extraterrestrial kind and the AI kind). For each item: what it is, where it lives, and how
it could feed the section. This repo is public: private material is named here (name, place, id)
and never quoted.

## 1. In this repo (recursive-learning, public)

| Item | Where | What it is | Use in 2027 |
|---|---|---|---|
| HOT POTATO: The Chosen Alien Invasion | `grammars/hot-potato-the-chosen-alien-invasion/` (eco `162eadff`) | Her film: AI framed as an alien arrival, cut from public footage (393 nodes in the app) | The AI history "told as a contact story" links here instead of being retold. Cards 21 and 0 point to it. |
| The Chosen Alien Invasion | `grammars/the-chosen-alien-invasion/` (eco `1cf86c7d`) | Earlier build of the same film | Linked from the 2027 page as the film's first version |
| The Chosen Alien Invasion, v2 and opening test | `grammars/the-chosen-alien-invasion-v2/`, `…-star-wars-primitives/` | Rebuild and an opening experiment | Not linked; working copies |
| As-If — HOT POTATO edition | `grammars/as-if-hot-potato-edition/` (eco `0489bd30`) | Upright-or-reversed deck: "the Tell is the evidence that would separate them" | The model for the evidence section of each card; the 2027 page sends readers to As-If for the AI side |
| Words deck + glossary | `glossary/terms.json`, `grammars/words-deck/` | 20 working definitions | *Presence*, *Reversibility*, *Channel* and *Human-AI alignment* are linked from the page. No new glossary terms are added yet (the words need her yes). |
| Explainers | `explainers/curves-and-odds/`, `risk-and-uncertainty/`, `belief-tree/`, `model-affect/` | Futures as states, odds, the belief tree | "Odds, not paths" is already the site's frame; the 2027 page links *Curves and odds* and *Risk or uncertainty?* |
| Take part | `site/pages/take-part.html` | Six routes, odds marks, "not today" is a legal move | The page closes on it: "what each of us would do either way" |
| Ideas seed map, Sources, Institutions | `grammars/ideas-of-alignment/`, `sources-of-alignment/`, `institutions-of-alignment/` | The AI debate's record | Reachable from the AI cards; nothing copied |
| The games | `game/` (As-If, Hot Potato, The Walk, Ekho) | Played decks | A later 2027 spread can reuse the caster (`viewers/caster-studio.html`) with no new code |
| `lab/`, `research/lab-export/` | empty in the public clone | — | Nothing to reuse |

## 2. recursive-tarot (the template, read-only)

| Item | Where | Use in 2027 |
|---|---|---|
| The deck format | `tarot/book-t/grammar.json`, `docs/GRAMMAR_FORMAT.md` | The 2027 deck copies its shape: `nodes` with `sections`, `metadata.credit`, `sort_order` |
| Book T | eco `2000ad96`, `tarot/book-t/` | The print pipeline (The Game Crafter, numbered booklet) for the later printed contact deck. Book T's pictures are AI paintings, so none of them can be reused here (rule 4). |
| Research convention | `research/` dossiers with ✔/○/◆ confidence marks | The brief's green/yellow/red ratings follow the same idea |
| History of Tarot course, chapter on Court de Gébelin | `research/09-court-de-gebelin.mdx` | A close parallel to the ancient-astronaut critique: an 18th-century claim that the cards were Egyptian, which historians traced to Italian card games. Card 7 links it as "the same move, on cards". |
| How Tarot Works, Divination Traditions courses | `tarot/how-tarot-works-course/`, `divination-traditions-course/` | The rule "relate to the card; never obey it" goes in the deck's how-to card |
| `docs/REPLICATE-THE-PATTERN.md` | | The Prime Rule this build follows |

## 3. recursive-transcripts (private, remote only; read with `gh api`)

Only names and paths here; nothing quoted.

| Item | Where | Use |
|---|---|---|
| Alien and SETI episodes in the podcast corpus | `corpus/podcasts-library/sean-carroll-mindscape/` (Avi Loeb; Arik Kershenbaum; Adam Frank; Daniel Whiteson), `80000-hours/anders-sandberg-fermi-paradox.txt`, `ezra-klein-show/` (two UFO episodes, "should we say hi to aliens") | The science-lens cards (Fermi, SETI, technosignatures) can cite the public episodes by title and date with short quotes |
| AI 2027 talks | `corpus/podcasts-library/dwarkesh-patel/` (Kokotajlo and Alexander), `80000-hours/daniel-kokotajlo-ai-2027-updates…`, `hard-fork/` | The AI-dates column of the dates table |
| Film plans | `plans/film/`, `films/hot-potato/`, `plans/FILM-PLAN-recursive-eco-improvement-2026-09-20.md` | Structure only; the film already carries the AI story |
| Cutting tools | `tools/words.py`, `tools/edges.py` | For clips, if the section later gets a film |

## 4. The local alien2027 index (a search index on her laptop, 320 episodes)

Searched by keyword, hits only. Holds Bashar (Darryl Anka) transmissions, Rogan with Grusch,
Pasulka, Elizondo, Vallée, Lazar; Spielberg's *Disclosure Day* talks; AI 2027 talks. The hits used
in the brief (each with its YouTube timestamp in BRIEF.md): *The Two Paths to AI* (event of May 27
2023), *2027, The Contact Fulcrum*, *2027 The Year Everything Changes* (event of May 24 2025),
*Dominoes Day 2* (Sedona, Sep 14 2025), *2026: The Year of Disclosure* (Jan 24 2026), *The
Fantasy vs Reality of Contact* (Mar 29 2025). Chico Xavier is not indexed yet; nor is the 2020
postcard session (video `zffDhELsg9k`).

## 5. recursive.eco grammars (via MCP)

Public ones are named with their ids. Private drafts are named and id'd only.

| Grammar | id | State | Use |
|---|---|---|---|
| HOT POTATO: The Chosen Alien Invasion | `162eadff` | public | linked (above) |
| The Chosen Alien Invasion | `1cf86c7d` | public | linked (above) |
| Two Disclosure Days — draft 1 | `cc534340` | private draft | The closest existing piece (a draft film setting the contact calendar beside the AI one). Its contents stay private; it could become the section's film later, her call. |
| Contact: A Disclosure Timeline; Contact Countdown; Disclosure Timeline: A Speculative History of Contact; Disclosure Timeline: A Path Toward Contact | `eec7e192`, `bbcf8686`, `ce2464d9`, `9065cc50` | private, July 2026 | Four speculative timelines from July (one empty). They overlap the dates table; candidates to fold into one, her call. |
| Character grammars for HOT POTATO (Yampolskiy, Amodei, Harris, Harari, Berg, Sutskever) | `715c22e3` etc. | private | The AI-parallel lines of cards 21 and 15 can point to the public film nodes, not to these |
| Weather for the Turning; Tools, not gods | `f55c98ab`, `4f0ef561` | private | AI-futures practice decks; possible companions, not linked |
| The Will to Hope — the company of the book | `14d13f69` | private | Her own words on hope; the section's closing line could come from her book, her pick |
| Recursive Fictions — the Research Room | `d00107c5` | private | The futures fiction; shape C of her plan (a story told through a reading) would start here |

## 6. Root GitHub folder

| Item | Use |
|---|---|
| `film-plan-v3.md`, `film-plan-2-recognition.md` | Film 2's "the aliens were always about us" act and the Spielberg line about communicating are the AI-parallel thread; linked by idea, not copied |
| `_research/` | Tarot and astrology plans only; nothing on contact |
| `fiction/` (private) | The futures atlas; nothing on contact claims |
| `PRIORITIES.md` | Row 7 asks whether The Chosen Alien Invasion should go private; the 2027 page links it while it is public |
| `book-repo/PLAN-contact-2027-tarot-book.md` (local only) | The working method this section follows: odds not paths, dates as data, her voice for the card texts |

## 7. value-lab (read-only) and emergence-lab (not opened)

- **value-lab**: a commons simulation (does a value system eat its own preconditions?). It speaks to
  the "great filter" idea on card 16: civilizations that may not survive their own technology.
  A link from that card's science lens, no new runs.
- **emergence-lab**: not opened. Possibly relevant for the same reason (group selection, commons);
  her call whether to link it.

## What is missing

- Chico Xavier in his own recorded words (TV Tupi *Pinga-Fogo*, 1971) — needs her Chrome transcript panel.
- A primary page for Bashar's 2020 postcard campaign (only her note on `zffDhELsg9k` so far).
- Her thesis paragraph and her card texts.
