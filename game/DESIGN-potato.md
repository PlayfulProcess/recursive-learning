# Hot Potato v3.1 — design notes (Sep 25 2026)

Page: `game/potato.html`. Rules: `game/potato-model.js`. `game/potato-others.html` now only redirects
to `potato.html`, so old links keep working. The first version (both pages and its notes) is kept in
`game/potato-v1/`.

Built on the branch `lab/potato-redesign`. **Nothing merges until PlayfulProcess has played it.**

## Why the first version was replaced

PlayfulProcess played v1 and said: *"The game does not make any sense. Hold it does not hold it."*

That was literally true. In v1 every button was a year of the Walk's model: "Hold it" meant *a year
spent mostly on alignment*. Pressing it moved some numbers (risk, coordination) and a caption said
what they meant, but nothing on screen was held. The potato did not stay in your hands, your hands
did not change, and the next press looked the same whatever you had pressed. Cause and effect lived
in the model, where the player could not see it.

v3 started from the opposite end. Every verb does something you can see, to the potato and to the
hands, within one second, and one bold sentence says what happened and why. The rules are small
enough to print on the page.

## What playtest round 1 found, and what v3.1 changed

Six players (a 12-year-old, a nurse on a phone, an 80-year-old on a tablet, a board-game designer,
an AI-policy researcher, a teenager) played v3. **All six said Hold held it.** All six also said it
wasn't fun, for one reason: **pressing "Hold it together" every move won every game.** "Hold it" and
"I don't know" were never better, a toss cost little, and your own hands' heat never forced anything.

| What players found (how many of the six) | v3.1 |
|---|---|
| Together every move wins; Hold and I don't know are never better (all 6) | Wren says yes only once she has **seen you hold it** a while (1 to 4 moves, hidden). Asking isn't holding, so Together every move never wins (0 of 16 draws). Hold is in every winning game. |
| I don't know does exactly what Hold does (4) | **I don't know waits**: open palms, your hands take no heat and rest a step, nobody sees you hold it, Flint keeps building. It is how you get too-hot hands back, and the best play needs it in a quarter of games. |
| Hand heat never matters; tossing isn't tempting (3) | Holding alone heats your hands toward "too hot", when you can't hold or ask. Only a toss (cool at once) or I don't know (a step) helps, so a toss is a real pull. |
| One toss costs nothing, two lose with no warning, then forced moves (4) | A toss wipes what Wren has seen, as well as adding six flames. The Toss button says "6 flames hotter", and when a toss would make it scorching it says so and that it will then burn. When there can't be enough hands any more, the page says so and lets it burn, instead of walking you through dead moves. |
| The recap blamed the wrong thing, and "once… each time" (4) | There is no slip any more; the recap says which toss caught fire, and counts are grammatical. |
| Whose heat meter is whose (3) | Each seat is one block: name, its answer, and its hands, together. Your hands have their own row under the table. |
| Words overlap on the phone (3) | The potato's heat word, "the middle", "enough hands" and "burned" labels are gone from the table (the track says how hot); the rule on the ground moved clear of the sleeves; a seat's line hides the luggage tag. |
| Grammar slips: "got burning", "all two lines" (4) | Captions rewritten; the word "lines" is gone from them. |
| Too much small grey text; "written" and "scorching" unexplained (3) | One short line per seat in full-strength ink: "yes when 2 hold it", "would say yes now", "no: it's scorching", "holding it". The track names its four groups: warm, hot, very hot, scorching. How to play is six steps, with "What's real here" folded away. |
| The speaker icon looked like a mute switch (2) | Gone from the header; Read aloud is in How to play, next to Slower. The ? is a "How to play" button with words. |
| "Now the heat is shared" but my hands still heated (3) | Heat goes to the others before you on a tie, and hands that take no heat cool a step, so when Wren joins, the caption says "The heat went to Wren, and your hands rested" and your bar goes down. |
| Buttons went grey during the animation with no sign (2) | A line says "Watch… tap any button to skip ahead", and a tap during a move skips to its end (it never makes a second move). Moves are shorter. |
| "slow down" under Hold, but flames still rose (2) | The button says "slow down alone"; the first Hold says "You added no flame, but Flint did: holding it alone doesn't stop Flint." |
| Tossing with enough hands broke the group without warning (2) | The Toss button says the others let go; the recap says there were enough hands. |
| "about 4, sometimes 5" read as a cheat (1, plus a gap at desktop size (1)) | "4 or 5 needed". Wide screens get two columns (table left, words and buttons right); narrow ones no longer push the buttons to the bottom. |
| Flint's line said "builds faster every round" (1); two strong claims in the help (1) | Flint "adds a flame every move". Hedged: "We don't know that it would." Added: Flint stopping without agreeing is an open question; holding alone earning trust is debated; tossing here only buys a rest, while real racing can win a lead. |

## The idea, on the page

**The race to build AI is a hot potato.**
- Hold it and your hands take the heat, and the others see you mean it.
- Toss it and your hands cool at once, but it goes round the whole table and comes back hotter.
- Ask for hands and the heat is shared.
- With enough hands you can put it in the ground. Whether it stays there, nobody knows.

## How to play (the short version)

1. Flint tosses you the potato. Wren is watching.
2. **Hold it**: it stays in your hands; your hands get hotter; Wren sees you hold it.
3. **Hold it together**: ask the others. Wren says yes once she has seen you hold it a while;
   Moss once 2 hold it; Reed once 3 do; Oak once 4 do. Asking too soon: "not yet".
4. Three holding stops Flint. With enough hands (4 or 5), **Put it down**.
5. **Toss it on**: your hands cool at once, but it comes back six flames hotter and Wren forgets.
6. **I don't know**: wait; your hands rest a step; Flint builds on.

## The rules

These are the game's own rules, made up to show one idea. They are not the Walk's model and not
value-lab's. `tools/potato_rules_check.py` is the rule set; `potato-model.js` is a rule-for-rule port,
and `tools/potato_port_check.mjs` walks every sequence of offered moves up to 7 presses, for all
sixteen hidden draws, in both languages (135,992 sequences on Sep 25) and compares the ending, the
flames, what Wren has seen, who holds it, every seat's hands and whether it has become hopeless.

- **Seats**, clockwise from you: Wren, Moss, Flint, Reed, Oak.
- **Hidden each game:** `need` (pairs of hands it takes: 4 or 5), `burn` (15 or 16 flames) and
  `wait` (how many moves Wren wants to see you hold it: 1, 2, 3 or 4), all equally likely.
- **Heat word:** 1–4 flames warm, 5–8 hot, 9–12 very hot, 13+ scorching. It gives off 1, 2, 3 or 4
  lines of heat a move.
- **Opening:** Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands.
- **Dealing heat:** while it is kept without enough hands, each line goes to the coolest hands on it;
  ties go to the others (clockwise), then you. Hands run cool, warm, sore, burning, too hot.
- **Hold it**: if you hold it alone, Wren has seen one more move. Then the heat is dealt.
- **I don't know**: your hands take none of the heat (the others take it, if they hold it with you).
- **Hold it together**: each seat whose line is met puts its hands on it, judged before you asked:
  Wren once she has seen `wait` moves; Moss once 2 hold it; Reed once 3 do, not while scorching; Oak
  once 4 do, not while scorching; nobody whose hands are burning; Flint never. Then the heat is dealt.
- **Toss it on**: the group breaks, your hands are cool at once, Wren forgets what she saw, and it
  goes round: a flame for your toss and one for each of the five others (+6), burning if it reaches
  `burn` on the way.
- **Too-hot hands** can't hold it or ask: only Toss it on or I don't know.
- **Put it down** (only with enough hands) ends the game in the ground.
- **After every move:** hands that took no heat cool a step; if it did not go round and fewer than 3
  hold it, Flint builds (+1). At `burn` it burns.
- **Hopeless:** scorching, not enough hands, and not enough possible (only Wren and Moss can still
  join). The page says so and lets it burn.

## What the checks showed

`node --max-old-space-size=6000 game/tools/potato_solve.mjs` (under a minute) searches for the
best play by someone who sees only what the page shows:

- **Best play wins all 16 draws.** When Wren waits 1 to 3 moves: Hold, Hold, Hold, then Together until
  Put it down (it ends at 6 flames). When she waits 4, her "not yet" after three holds changes the
  plan: I don't know, Hold, I don't know, then Together (it ends at 10 flames, three short of
  scorching). So a "not yet" is information you act on.
- **The same button every move wins nothing**: Together 0%, Hold 0%, I don't know 0%, Toss 0%.
- Random presses win about 1%; random presses that never toss about 30%.
- Best play uses Hold in every game, I don't know in a quarter, Toss in none. A toss on the first
  move still leaves a win in half the draws (when Wren waits 1 or 2 moves); a toss after one or two
  holds leaves a win only when she waits 1; a toss after three holds loses every draw.

`python game/tools/potato_rules_check.py` prints the path table and the same one-button and random
checks from the Python side.

## The screen (phone first, one screen during play)

Header (spiral, the one line, **How to play**) · the heat track (16 boxes in four named groups, warm,
hot, very hot, scorching; the last two hatched: "catches fire in here") · the table (six seats; each
of the five others is one block: shape and name, its answer if you asked now, its hands when warm or
holding; mittens and the potato in the middle) · your row (you, what you're doing, your hands) ·
Hands on it (five mittens, "4 or 5 needed") · the caption (what happened in bold, then how the others
answered) · four buttons, each with an AI gloss ("slow down alone: you take the heat; Wren sees",
"race on: cool hands now; 6 flames hotter", "ask the others to hold it with you", "wait: your hands
rest; Flint builds on").

- **Hold it holds.** Your mittens curl round the potato and a "holding" tag appears; heat rises into
  your mittens and Wren's "seen" count goes up. Too-hot hands take Hold away, with the reason on it.
- **I don't know** is open palms with steam rising into the air, a "waiting" tag, and your bar going
  down a step.
- **Hold it together**: if nobody is ready, a "Not yet" bubble at Wren and the potato stays with you;
  when someone is, your sleeves reach into the middle and theirs join; the caption says who took the
  heat.
- **Toss it on**: your mittens open empty, your hands read cool at once, the potato goes round the
  ring with a +1 at each seat and back into your hands.
- **Put it down**: the button turns green and pulses once when it appears; the hands lower together,
  the potato sinks, a sprout comes up; then "You put it down together. Nobody's hands got burned."
  and the two equal cards, *If there's a known way to keep it down* / *If nobody knows how yet*, and
  "This game can't tell you which card is true. Nobody can yet."
- **Burned:** the potato cracks, every pair of mittens is charred, Flint's too.
- Under either ending: a recap in words (how long Wren wanted, how often you asked too soon, tossed or
  waited, who joined and why, the hidden numbers), and the river line, labelled as a rhyme.

Nothing reads by colour alone: hands show a word and a notched, patterned bar; the potato shows steam
lines; seats have shapes (Wren circle, Moss square, Flint triangle, Reed diamond, Oak hexagon).

Pace: tap-paced, no timers. A move plays out in about a second (a toss's lap about two), then the
others answer. A tap during a move skips to its end. "Slower" (half speed) and "Read aloud" are in
How to play. Keys: H, T, G, D, K. `prefers-reduced-motion` (or `potato.html?reduced`) replaces motion
with still marks.

Wide screens (900 px and wider, landscape) put the table on the left and the words and buttons on the
right.

## Build notes

- One static page, inline SVG, no dependencies, no network calls; colour tokens with a dark set.
- All game motion is computed from one virtual clock (named tracks of timed segments).
  `requestAnimationFrame` adds real time; a 250 ms timer takes over if frames stall.
- Test hook: `window.potatoTest.state()`, `.press(verb)`, `.step(ms)`, `.draw(need, burn, wait)`
  (before the first press only), `.secret()`.

## Checked on Sep 25 (local, `python -m http.server 8130`)

Real clicks at 375 × 812 (dark): a game where Wren waited 4 (asked too soon, rested twice, won at 10
flames, five hands); a game with a toss at sore hands (Wren waited 1, won at 12 flames); a
Together-every-move game (too hot by move 4, then a toss, then it burned, with the "can't be enough
hands" line). Real clicks at 1280 × 820 (two columns): Hold ×3, Together ×3, Put it down. Also 768 ×
1024, 360 × 700 in light, `?reduced`, the How to play sheet, a tap during a move (skips, doesn't
move), and a scripted run of every caption for grammar. No console errors from the page; no
horizontal scroll. The Walk's model (`walk-model.js`) is untouched.

## For PlayfulProcess to decide

- **D1.** Reed and Oak refuse while it's scorching, instead of "hands needed grows with the flames".
- **D2.** (changed) Heat ties go to the others before you, so joining shows as your hands resting.
- **D3.** Random play almost always burns (random presses that never toss win about 30%).
- **D4.** The AI glosses on the buttons ("slow down alone", "race on").
- **D5. New: Wren's patience.** Holding it alone is what makes Wren trust you: a claim the game now
  makes (hedged in "What's real here"). 1 to 4 moves, hidden. With 4, the win is tight.
- **D6. New: a toss wipes Wren's trust.** Tossing is now costly even once. The alternative (she
  keeps what she saw) makes a toss a legitimate rest; the check showed both are winnable.
- **D7. New: the game ends itself when it can't be won** (scorching, too few hands possible).
- **Still open:** the hidden 4-or-5 hands never changes a decision (the designer's point): Put it
  down appears exactly when there are enough. Letting it be tried at 4 would make it a bet.
  Also: only Wren's patience is hidden, so after she joins, the rest is sure.

## Success test (from the spec)

Before the panel, the verb test: for Hold, Toss, Together and Put it down, press with `potatoTest`
and screenshot at `step(300)` and `step(700)`; a stranger shown only a before/after pair should name
the verb. Then 5 players, the URL and two minutes each: it passes if 4 of 5 can say that holding
keeps it and heats your hands, tossing gets it off your hands now but it comes back hotter for
everyone, and holding it together shares the heat until enough hands can put it down; and 3 of 5
say it's about the race to build AI without being asked.
