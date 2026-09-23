# Changing Lines — design (Sep 22 2026)

A second game for the same lesson as The Walk, built on the I Ching's own probability device.
Page: `game/lines.html`. Live: https://game.recursive.eco/game/lines.html

## The objective, unchanged

One teaching: **a probability is a property of the world given a path.** The step of faith is a
stag hunt. "I don't know" is always legal. No stakes, no leaderboards, and the numbers are never
forecasts. Educational first, then engaging, then beautiful.

## Why the I Ching carries this lesson better than anything we could invent

The I Ching already contains a conditional-probability puzzle, and it is about paths.

| | P(firm) | P(turning given firm) | P(turning given yielding) |
|---|---|---|---|
| Yarrow stalks (1 : 5 : 7 : 3 in sixteen) | 1/2 | 3/8 | 1/8 |
| Three coins (2 : 6 : 6 : 2 in sixteen) | 1/2 | 1/4 | 1/4 |

Both methods give half firm, half yielding, and both give a line a one-in-four chance of turning
overall. They differ only once you condition on the kind of line. The yarrow count leans that way
because only its first "change" is biased 3 : 1, and a line turns only when all three changes
agree. So the same question, cast by two methods, has two different probabilities of change. That
is the lesson in one table, and it is 2,500 years old.

The **sixteen-marble bowl** reproduces the yarrow odds exactly (1 old yin, 5 young yang, 7 young
yin, 3 old yang). It is also, without our help, the format the research says lay people read best:
an icon array of counted cases (Galesic and Garcia-Retamero 2009; Ancker et al. 2011). A deck of
counted worlds and the picture of its odds are the same object. The patterns agent reached this
independently from Pandemic's epidemic deck and the "100 worlds" icon array.

## The game

1. **Two bowls.** The player sees the yarrow bowl and the coin bowl, both half firm, and is asked:
   you draw a firm line; in which bowl is it more likely to be turning? Four answers, "I don't know"
   among them. The reveal is the table above in words. The player then picks the bowl to walk with,
   which is the first choice of path.
2. **Six lines, bottom to top.** Each line is a place in the hexagram read as a stage of an AI
   future (the page's own reading, beside the tradition's):

   | Place | Tradition | This game |
   |---|---|---|
   | 1 | the beginning, below the surface | what is being built, inside the labs |
   | 2 | centre of the lower half, the official | the people who build it |
   | 3 | the crossing, perilous | the release into the world |
   | 4 | the minister beside the ruler | the institutions that meet it |
   | 5 | centre of the upper half, the ruler | who holds the power |
   | 6 | the end, beyond the matter | what it becomes past the horizon |

3. **A move changes the bowl before the draw.** The odds are shown before and after, as counts out of
   sixteen, and the marbles that changed pulse. The draw is a separate button, so the player sees
   the new odds before committing.

   | Move | What it does to the bowl | Others ready to walk together |
   |---|---|---|
   | Push ahead | 2 yielding marbles become firm and turning | one fewer |
   | Steady it | 2 turning marbles become still | one more |
   | Hold back | 2 firm marbles become yielding | same |
   | Mend the bowl | 2 marbles return toward the starting mix | same |
   | Walk together | with 3 of 5 others ready: every turning marble becomes still; otherwise nothing, and one more is ready next time | stag hunt |
   | I don't know | nothing; the bowl stays as the path left it | same |

   The mapping to The Walk's hand: Push = power, Steady = alignment, Mend = sustainability,
   Hold back = stop. Walk together is the same stag hunt as The Walk's, with the same honesty: when
   too few are ready, the line is spent for nothing, and the button says so before you press it.
4. **What happened is part of the path.** A turning line, once drawn, turns one marble of its kind in
   the bowl with it. So the odds of line 4 depend on your moves and on what lines 1 to 3 drew.
5. **Drawing the changing lines to the end.** After six lines, the primary hexagram stands with its
   judgment (Legge). Then the turning lines flip one at a time, bottom to top, each flip passing
   through a real hexagram, until the relating hexagram: "what it is turning into". Each step shows
   the line text of the line that turns, read from the hexagram being left. This is the sequential
   caster from `recursive-iching/docs/DESIGN-path-caster.md` (one transition is classical; the
   journey is ours). With no turning lines, the hexagram stands and only its judgment is read.
6. **The lesson screen.**
   - *How likely was this hexagram?* The same six lines asked of three paths: your moves, "I don't
     know" six times in the same bowl, and "I don't know" six times in the other bowl. Two columns:
     the firm/yielding pattern, and the exact reading including turning. With no choices the two
     bowls tie in the first column and part in the second, which is the opening lesson again.
   - *Walk the same path a hundred times.* 100 small hexagrams from the same moves and fresh draws,
     beside 100 with no choices. Yours are lit; turning lines are orange. One of these worlds is the
     one you drew; it is not a forecast of the others. (Hypothetical outcome plots, Hullman et al.
     2015; "many worlds" small multiples, Dragicevic et al. 2019.)
   - *Tell it as a story.* From the first hexagram to the last, what happened at each place and what
     is it turning into. Stays in the browser. "Copy my casting" puts it on the clipboard.

A link names the whole casting (`#l1;m=yarrow;s=<seed>;v=<moves>`), so a casting can be shared and
replays exactly.

## Sources and licences

- Hexagram texts: James Legge, *The Yî King*, 1882 and 1899, public domain, read live from
  `https://iching.recursive.eco/grammars/zhouyi-core/grammar.json` (served with open cross-origin
  access). The names table embedded in the page was checked on Sep 22: all 64 line patterns agree
  with the NINE/SIX of their own line texts.
- Not used, on purpose: the i-ching-summarized and meta-iching layers (their wording is close to
  Wilhelm-Baynes, still in copyright, and their binary field is wrong for hexagrams 15, 16, 46, 63
  and 64), and anything from The Thing From The Future (CC BY-NC-SA).
- The recursive-iching `caster-engine.js` casts only yin or yang, never 6/7/8/9, so this page has
  its own four-outcome draw.

## What the research turned up (three opus agents, Sep 22)

**Patterns.** Ranked for teaching conditional probability: an icon array of counted worlds, sorted
by kind, where cells change colour when a choice moves them; a frequency tree drawn as you walk;
hypothetical outcome plots; counterfactual small multiples. Avoid fan charts and cones (read as
forecasts; the hurricane cone is misread as the storm growing). Mechanics worth taking: Pandemic's
epidemic deck (what comes next depends on what came before), Slay the Spire's visible map (preview
each branch's odds before choosing), Frostpunk's irreversible laws (path dependence), Suzerain's
single save. Reigns' swipe is a good phone gesture but its death-at-an-edge rule is deterministic.
Pattern to avoid: En-ROADS and the FT Climate Game present model output as the result of your
choices, which reads as a forecast.

**The I Ching.** Casting odds and the yarrow arithmetic verified (sources: Cottrell's Virtual Yarrow
Stalks, biroco, Wikipedia on I Ching divination). Zhu Xi's rules for which texts to read when 0 to 6
lines change are a possible reading mode; the page follows the path caster instead.

**AI 2027 and the AI wargames.** ai-2027.com hides a zero-height marker with a JSON snapshot in
each of its sixteen sections, and the rail animates to the snapshot in view (approval, revenue,
compute share, an AGI-arrival year, capability scores). Uncertainty lives in 99 footnotes,
collapsible boxes ("Why our uncertainty increases substantially beyond 2026") and five research
supplements. The fork is one shared branch point, a committee vote of 6 to 4, and the site says the
slowdown ending "is not a recommendation". Readers are invited to write their own branch "from
wherever you think we first start to go wrong". Neither the AI 2027 tabletop exercise (about 4
hours, 8 to 14 players, 11 factions, 30-minute rounds) nor Intelligence Rising (43 games studied
in arXiv 2410.03092) publishes its rules. Both settle uncertain events with dice and a stated
probability, keep one thing hidden (the AI's values are a secret die roll), and even the best path
rolls for its ending: Intelligence Rising's finding is that good outcomes "almost always require
coordination between actors who by default have strong incentives to compete". Nicky Case's The
Evolution of Trust is CC0 and asks the player to bet before every reveal.

What this game takes from them, now or next:
- **The roll is never removed** (Intelligence Rising). Already here: the best bowl still draws.
- **Bet before the reveal** (The Evolution of Trust). The two-bowls question does this once; a
  one-tap guess before each draw ("firm, yielding, or I don't know") is the next step.
- **Branch from where you disagree** (AI 2027). A "change one line's move" replay at the end.
- **A hidden die** (the AI 2027 exercise). A variant where the player does not know which bowl the
  world started from; that teaches updating on evidence, a different lesson, so it stays a variant.

## Next, if the shape holds

- The five others as the As-If deck's characters, each deciding to come or not from what the path
  has done (their Upright and Reversed readings already exist).
- Correspondence: the tradition pairs places 1–4, 2–5, 3–6. The bowl for line 4 could lean on what
  line 1 drew, and the page would show both odds side by side: P(line 4 turns) and P(line 4 turns
  given line 1 turned).
- A "had you chosen" row at the end: replay with one move swapped.
- Zhu Xi's reading rules as a setting beside the path-caster reading.
- The fiction box feeding the As-If castings form once `FORM_URL` exists.
