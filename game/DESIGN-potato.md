# Hot Potato v3.2 — design notes (Sep 25 2026)

Page: `game/potato.html`. Rules: `game/potato-model.js`. `game/potato-others.html` now only redirects
to `potato.html`, so old links keep working. The first version (both pages and its notes) is kept in
`game/potato-v1/`.

Built on the branch `lab/potato-redesign`. **Nothing merges until PlayfulProcess has played it.**

## Why the first version was replaced

PlayfulProcess played v1 and said: *"The game does not make any sense. Hold it does not hold it."*

That was literally true. In v1 every button was a year of the Walk's model: "Hold it" meant *a year
spent mostly on alignment*. Pressing it moved some numbers (risk, coordination) and a caption said
what they meant, but nothing on screen was held. v3 started from the opposite end: every verb does
something you can see, to the potato and to the hands, within a second, and one bold sentence says
what happened and why.

## What playtest round 2 found, and what v3.2 changed

Six players again (a 12-year-old, a nurse on a phone, an 80-year-old on a tablet, a board-game
designer, an AI-policy researcher, a teenager). **All six said Hold held it.** Two could not explain
the game and five said it wasn't fun. Everything more than one of them hit, and how v3.2 answers it:

| What players found (how many of the six) | v3.2 |
|---|---|
| Pressing "Hold it together" too soon showed "holding" and heated my hands, but Wren said "asking isn't holding" and didn't count it: hold didn't hold again (5) | **A button is lit only when it will do what it says.** Hold it together lights up once Wren would say yes, so asking always puts hands on it. Tapping a grey button says why in the caption ("Not now: Wren wants to see you hold it 4 times first. She has seen 3.") and does nothing else. |
| Wren's hidden number (and the hidden 4-or-5 hands) made asking a guess, and each wrong guess cost (5) | **Nothing that decides the game is hidden except the fire's box** (15 or 16). Wren's seat says "yes after 4 holds" with a dot for each hold she has seen. It takes five pairs of hands, always, and the Put it down button counts them. |
| It ended by itself: "there can't be enough hands now", then it burned with no press; "I don't know" gave no warning (5) | **The page never burns it by itself.** Three of you holding it stops Flint and cools it a flame a move, so a scorching potato can be brought back. Every button says when its flame would make it scorching or might catch fire ("+1 flame (Flint) → 15: it may catch fire"). When no play can still win, the caption says "No way left to put it down in time" with a **Start again** button; the buttons still work. |
| One toss decided the game (four) or cost nothing (one): a trap, not a choice (6) | **A toss crosses out one hold Wren saw, not all of them**, and still adds six flames. In rounds 1 and 2 one toss is survivable wherever you make it (you meet the scorching refusal on the way back); in round 3, which starts hotter, it isn't. Two tosses lose everywhere. |
| The middle was a hold/rest grind, and the hands bar jumped two steps at a time (4, and 3) | **Hold it heats your hands exactly one step** (cool, warm, sore, too hot), whatever the potato's heat. Your hands take three holds; Wren wants 2, 4 and 5 holds in the three rounds, so at most two rests are ever needed. |
| After Wren joined nothing was left to decide: press Together three more times (4) | **One ask brings the chain**: Wren says yes, Moss follows her, Reed follows Moss, Oak follows Reed, in one press with a "Yes" at each seat. Then Put it down. If it's scorching, Reed and Oak say "Too hot" and you hold it with three until it cools. |
| Too much to track on a phone; captions of 3 to 5 lines that changed halfway (4) | Every other seat's hands meter is gone (only yours is left), each seat has one short line, the "hands on it" row is folded into the Put it down button, and captions are at most four lines on a 375 px phone and appear whole. Checked by script: nothing moves when the words change. |
| Too-hot hands locked out asking, even when Wren would take the heat (3) | Hold it together stays lit with too-hot hands once Wren is ready: "Wren is ready: ask, and the others take the heat." |
| A tap meant to skip the intro made a move (1); a tap only skipped the animation (1); "is it waiting for me?" (1) | No skip mode and no "Watch…" line. A lit button always does its move; if a move is still playing, it finishes at once first. |
| Flint's flame was sometimes mentioned and sometimes not (3) | Every move Flint builds on says "Flint added a flame", a small flame flies from Flint to the potato, and the box shows +1. Flint's line: "+1 flame a move until 3 hold it". |
| "Hold it together" turned into "Put it down" in the same spot, so a double tap ended the game (2) | **Put it down is its own button**, full width under the others, always there, green only with five pairs of hands. |
| Grey buttons looked like buttons; Toss looked pressable after the end (2) | Unlit buttons are dashed and faded, their line starts "not now:", and after the end every button reads "the round is over". |
| Mittens sat on the chalk "We hold it until it's down" at the end (2) | The chalk sits below the table, away from every pair of mittens, and fades when you put it down. |
| The end advice contradicted the game; the rules were only learned from the loss screen (2) | Advice is chosen from what you did and matches the rules ("when your hands are too hot, bounce it instead of tossing it: one flame instead of six"). Three short rounds teach one thing each, during play. |
| The hedges were folded away; who the others are was unclear (2) | "made-up rules, not a forecast" is always on screen; the first caption says "You and five others are building it"; How to play says "think labs, companies or countries". |

Also fixed (one player each): the burn screen now says "burned" for Flint too; your hands never read
"burning", so the win's "Nobody got burned" no longer collides; "written on the ground" is gone; the
unexplained dark oval and dashed ring are gone; the 280 px overlap; the caption that recommended a
toss that was about to be fatal. "I don't know" is now *bouncing it from hand to hand* (cools your
hands, isn't holding, Flint builds), and What's real says what it stands for.

## The idea, on the page

**The race to build AI is a hot potato.**
- Hold it and your hands take the heat, and Wren sees you mean it.
- Toss it and your hands cool at once, but it goes round the whole table and comes back hotter.
- Once Wren trusts you, hold it together: the others follow, and the heat is shared.
- With five pairs of hands you can put it in the ground. Whether it stays there, nobody knows.

## How to play (as on the page)

1. The potato is the race to build AI. You and five others are building it. Flint adds a flame every
   move; somewhere in the two striped boxes it catches fire and burns everyone.
2. **Hold it**: it stays in your hands. Your hands heat up one step, and Wren counts it.
3. **Hold it together** lights up once Wren has seen enough. Wren says yes; Moss follows her, Reed
   follows Moss, Oak follows Reed. Reed and Oak won't touch it while it's scorching.
4. Three holding it stops Flint and cools it a flame a move. With five pairs of hands, **Put it down**.
5. **Toss it on**: your hands cool at once, but it comes back six flames hotter, and Wren crosses out
   one hold.
6. **I don't know**: you bounce it from hand to hand. Your hands cool a step, Wren doesn't count it,
   and Flint adds a flame.

Score: the hottest it got (lower is better), shown against the coolest possible for that round.

## The rules

These are the game's own rules, made up to show one idea. They are not the Walk's model and not
value-lab's. `tools/potato_rules_check.py` is the rule set; `potato-model.js` is a rule-for-rule port.

- **Seats**, clockwise from you: Wren, Moss, Flint, Reed, Oak.
- **Rounds** (start flames, holds Wren wants): 1: (2, 2); 2: (2, 4); 3: (5, 5); then random rounds,
  start 2 to 5, Wren 2 to 5, printed at the start. **Hidden:** the fire, at 15 or 16 flames.
- **Heat word:** 1–4 flames warm, 5–8 hot, 9–12 very hot, 13+ scorching.
- **Your hands:** cool, warm, sore, too hot (0 to 3).
- **Hold it** (alone, hands not too hot): Wren has seen one more; your hands heat one step.
- **I don't know** (alone): your hands cool one step.
- **Hold it together** (lit once Wren has seen enough, or once others hold it): down the chain Wren,
  Moss, Reed, Oak, each joins if the one before holds it (Wren: if she has seen enough); Reed and Oak
  not while it's scorching. Your hands cool a step (the others take the heat).
- **Toss it on**: the others let go; your hands are cool; Wren crosses out one hold; it goes round,
  a flame for your toss and one for each of the five others (+6), burning if it reaches the fire.
- **Put it down** (five pairs of hands) ends the round in the ground.
- **After every move but a toss:** fewer than 3 holding it, Flint adds a flame (it burns at the
  fire); 3 or more, it cools a flame.
- **No way left:** if no sequence of presses can put it down even with the fire at 16, the page
  says so and offers Start again. It does not burn it for you.

## What the checks showed (Sep 25)

- `node game/tools/potato_port_check.mjs`: the JS matches the Python on all **134,814** sequences of
  offered presses up to 9, for the 3 rounds and all 16 random set-ups, with the fire at 15 and 16.
- `node game/tools/potato_solve.mjs` (a few seconds):
  - The page's "coolest possible" line (put it down, else ask, else hold, else bounce) is the coolest
    safe play in every one of the 19 set-ups: round 1 keeps it at 4 flames in 4 presses, round 2 at 7
    in 7 (one bounce), round 3 at 12 in 9 (two bounces).
  - One toss slipped in anywhere: rounds 1 and 2 still win, even with the fire at 15; round 3 never.
    Two tosses: no set-up wins.
  - The same button every move wins none (Hold, Toss, I don't know: 0%). Random presses win 4% of
    rounds 1–3; random presses that never toss win 71%.
- `python game/tools/potato_rules_check.py` prints a table of sample games.

## The screen (phone first, one screen during play)

Header (spiral, the one line, **How to play**) · "Round 2 of 3 · made-up rules, not a forecast" · the
heat track (16 boxes in four named groups, the last two striped: "fire in here", or "fire at 16" once
it has passed 15) · the table (six seats; each other seat is its shape, name and one line: its rule,
"no: it's scorching", "ready: ask her" or "holding it"; Wren's line has a dot per hold) · your row
(you, what you're doing, your hands in a word and a three-box bar) · the chalk rule when three hold it
· the caption (what happened in bold, then Flint's flame and the one thing that matters next) · four
buttons in a grid and **Put it down** under them, full width, with five mitten icons.

- **Hold it holds.** Your mittens curl round the potato, heat rises into them, the "holding it" tag
  shows and one of Wren's dots fills. Too-hot hands grey Hold it out with the reason on it.
- **I don't know** is the potato hopping from mitten to mitten with steam going up; "bouncing it".
- **Hold it together**: your sleeves reach into the middle and the others follow one by one, each
  with a green "Yes"; Reed and Oak show a red "Too hot" while it's scorching. A −1 shows in the box.
- **Toss it on**: your mittens open empty, it goes round the ring with a +1 at each seat and comes
  back; a dot is crossed out at Wren's seat.
- **Put it down**: the hands lower together, the potato sinks, a sprout comes up; then "You put it
  down together", the hottest it got against the coolest possible, and (after round 3) the two equal
  cards, *If there's a known way to keep it down* / *If nobody knows how yet*, and "This game can't
  tell you which card is true. Nobody can yet."
- **Burned:** the potato cracks and every pair of mittens is charred, Flint's too.
- Under either ending: what you did, in a few lines, and one piece of advice that matches the rules.

Nothing reads by colour alone: hands show a word and a patterned bar; seats have shapes (Wren circle,
Moss square, Flint triangle, Reed diamond, Oak hexagon); unlit buttons are dashed and say "not now".

Pace: tap-paced, no timers. A move plays out in under a second (a toss's lap about two). "Slower" and
"Read aloud" are in How to play, with "Start again from round 1". Keys: H, T, G, K, D.
`prefers-reduced-motion` (or `potato.html?reduced`) replaces motion with still marks. `?round=2`
opens a round directly. Wide screens (900 px and wider, landscape) put the table on the left.

## Build notes

- One static page, inline SVG, no dependencies, no network calls; colour tokens with a dark set.
- All game motion is computed from one virtual clock (named tracks of timed segments).
  `requestAnimationFrame` adds real time; a 250 ms timer takes over if frames stall.
- Test hook: `window.potatoTest.state()` (round, flames, hottest, seen, hands, who holds it, what each
  button says, caption), `.press(verb)` (the same path as a tap), `.step(ms)`, `.fire(15|16)` (before
  the first press), `.round(n[, start, wait])`, `.secret()`.

## Checked on Sep 25 (local, `python -m http.server 8130`)

Real clicks at 375 × 812 (dark): round 1 (Hold, Hold, Together, Put it down: 4 flames, the coolest);
round 2 with a toss at too-hot hands (back at 11, Wren crossed out a hold, scorching at the ask, Reed
and Oak said "Too hot", it cooled, they joined: put down, hottest 13); round 3 the coolest way (12);
round 3 with a toss (No way left, Start again shown; bounced on and it caught fire at 16). Real clicks
at 1280 × 820 (two columns): rounds 1 and 2, including tapping the grey Hold it together to read why.
768 × 1024: round 2 with one bounce (7, the coolest). 320 × 640 in light and 280 × 600 with
`?reduced`: no horizontal scroll, no seat labels overlapping. Keys H and G; the How to play sheet.
Scripted at 375 × 812 (60 random rounds, 588 presses): captions at most four lines, button lines at
most two, the buttons never move, the page stays one screen tall during play, no page errors. At
320 × 640 (40 rounds) the buttons stay within 1 px. The Walk's model (`walk-model.js`) is untouched.

## For PlayfulProcess to decide

- **D1 (kept, softened).** Reed and Oak won't touch it while it's scorching, but they join once three
  of you have cooled it. Danger slows agreement here; it doesn't end it.
- **D5 (changed).** Wren's patience is printed (2, 4, 5 holds), not hidden. Clearer, but real
  builders don't publish how much restraint would earn their trust; the hedge says so.
- **D6 (changed).** A toss crosses out one hold, not all of them: costly, survivable once early on.
- **D7 (reversed).** The game never ends itself. It says when there's no way left and offers Start
  again.
- **D8 (new).** Holding it together cools it, a flame a move. That is a claim (hedged in What's real):
  an agreement lowers the risk over time.
- **D9 (new).** There is now a best way to play each round (hold while your hands can take it, bounce
  when they're too hot, ask as soon as Wren is ready), shown after the round as advice. Round 2 and 3
  change the numbers, and the score is the hottest it got. This trades the old guessing for a small
  puzzle with a known answer: clear, but not much to replay. The researcher suggested giving a toss a
  prize (a lead); that would make tossing a real temptation, and also teach that racing pays. Not
  built; your call.
- **D10 (new).** Five pairs of hands, always (everyone but Flint), instead of a hidden 4 or 5.
- **D4 (kept).** The AI glosses on the buttons ("slow down alone", "race on", "wait and see").

## Success test (from the spec)

The verb test: for Hold, Toss, Together and Put it down, press with `potatoTest` and screenshot at
`step(300)` and `step(700)`; a stranger shown only a before/after pair should name the verb. Then 5
players, the URL and two minutes each: it passes if 4 of 5 can say that holding keeps it and heats
your hands, tossing gets it off your hands now but it comes back hotter for everyone, and holding it
together shares the heat until enough hands can put it down; and 3 of 5 say it's about the race to
build AI without being asked.

## Earlier: what playtest round 1 found (v3.1)

All six said Hold held it; all six won by pressing "Hold it together" every move. v3.1 made Wren wait
to see you hold it (hidden, 1 to 4 moves), made "I don't know" rest your hands, made a toss wipe what
Wren saw, and let the page burn it once no win was possible. Round 2 (above) found that the hidden
wait turned asking into a guess, that the burn-by-itself felt like a timer, and that one toss decided
most games; v3.2 undoes those three and keeps the rest.
