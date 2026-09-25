# Hot Potato v4 — design notes (Sep 25 2026)

Page: `game/potato.html`. Rules: `game/potato-model.js`. `game/potato-others.html` only redirects to
`potato.html`, so old links keep working. The first version (both pages and its notes) is kept in
`game/potato-v1/`.

Built on the branch `lab/potato-redesign`. **Nothing merges until PlayfulProcess has played it.**

## Why the first version was replaced

PlayfulProcess played v1 and said: *"The game does not make any sense. Hold it does not hold it."*

That was literally true. In v1 every button was a year of the Walk's model: "Hold it" meant *a year
spent mostly on alignment*. Pressing it moved some numbers and a caption said what they meant, but
nothing on screen was held. v3 started from the opposite end: every verb does something you can see,
to the potato and to the hands, within a second, and one bold sentence says what happened and why.

## What playtest round 3 found, and what v4 changed

Six players again (a 12-year-old on a phone, a nurse with 3 minutes, an 80-year-old on a tablet, an
exploit-hunting board-game designer, an AI-policy researcher, a teenager on a 280 px pane). **All six
said Hold held it, and all six could explain the game.** Five of six said it wasn't fun: it had become
a puzzle with one answer. The designer found the other half of PlayfulProcess's complaint: *Hold did
not hold back any heat.* Flint added one flame whether you held it or bounced it, so the heat rose the
same either way. Everything more than one of them hit, and how v4 answers it:

| What players found (how many of the six) | v4 |
|---|---|
| One recipe won every round: hold till your hands are too hot, bounce once, hold, ask, put it down. The end screen even printed it (6) | **The race pays, and the fire can be anywhere in the stripes.** You start each round with 5 coins; Bounce it wins 1, Toss it on wins 5. Put it down and you keep them; if it catches fire, everyone's coins burn. The fire is somewhere from 9 to 16 flames (the eight striped boxes), any box as likely, new each round. Playing it safe never reaches the stripes in rounds 1–3, so the choice is how far to push, not a sum. The score is the coins you keep, not the hottest it got. |
| A toss was never worth it: a bounce cooled your hands for 1 flame, a toss for 6, and cool hands scored nothing (6) | **A toss wins 5 coins**, doubling what you started with, and still cools your hands at once, breaks the group and costs a Wren hold. Checked by `tools/potato_solve.mjs`: tossing is the best bet in 5 of the 12 set-ups (rounds 1 and 3 among them), and part of the best play with hindsight in 49 of 96 set-up × fire cases. It is never a sure thing. |
| **Hold didn't hold back the heat:** Flint's +1 came whether you held or bounced, so "slow down alone" slowed nothing (2, and the root of "Hold it does not hold it") | **Hold it adds no flame of yours; only Flint's.** Bounce it means you carry on: your flame *and* Flint's, +2. Toss it on: +6. The buttons read +1, +2, +6 side by side, and the stage shows your flame crossed out when you hold and a +1 at your hands when you bounce. |
| The picture lagged the words: the caption said "too hot" while the meter said "sore", Wren's dots and the flame count one behind (5) | **Everything the words name changes when the words do**: flames, stripes, your hands, Wren's dots, your coins and Flint's. Only the toss's lap climbs box by box, and its caption waits until the potato is back. Checked by script 150 ms after every press at five sizes: no mismatch. |
| "Keep holding it together (−1 flame)" did nothing once all five held it (4) | With five pairs of hands, Hold it together isn't offered ("everyone's holding it"); only Put it down and Toss it on (a defection that pays 5 coins) are lit. |
| The hidden fire never mattered: always 15 or 16, and the buttons said "may" or "will" catch fire (3; the researcher: false precision) | The fire hides anywhere in eight boxes. A box it has passed without catching loses its stripes, so the stripes show where it can still be. Buttons say "may catch fire" for any move into the stripes; "it catches fire" only past the last box. |
| "I don't know" was a strange name for bouncing it (3) | **Bounce it** (the 12-year-old's name), with "carry on building" under it. Key B (K still works). |
| One tap lost the round with no warning, and after "No way left" you had to click on until it burned (3) | A button whose move leaves no way to put it down says **"→ 14: no way back"** before you press it. If you press it anyway, once the move has played out the buttons give way to two plain choices: **See how it ends** and **Start this round again**. |
| The round seemed to start a flame lower, then Flint's toss added one (2) | The round starts at its number, shown from the first frame; Flint's toss to you adds nothing. |
| The Toss button never said Wren crosses out a hold (1); the end tip didn't match what I did (2) | When there's no fire warning to show, Toss's second line says "Wren −1 hold" (or "they let go, Wren −1"). The recap tells what happened (where it caught fire, what your move took it from) and what the surest way and hindsight would have kept, not a recipe. |
| Who is Wren? Why does the race get hotter when I pass it on? (2) | The first caption says everyone at the table is building it and calls Wren "another builder"; her line starts "I'm building it too". Toss it on is "race ahead": everyone races after you. |
| Too much small print on a phone (3); the heat line cut off at 280 px (1) | Each button is exactly two short lines: the numbers, then a warning or the AI gloss. How to play is five short points; the seats' lines and What's real are folded. Heat labels 14 px, a bigger hands bar. The heat line fits from 280 to 1280 px (checked). |
| Racing's pull was left out; the risk meter looked precise; disputed ideas played as sure things; one-sided framing; only one way to lose (the researcher) | Racing now wins coins and Flint wins a coin a move while you hold alone. What's real says so, says the game takes a side (Flint's "If we don't, they will" is a real argument), that nobody can count the real flames or knows where the stripes begin, that Wren always keeping her word is the game's assumption, and that real harms can be unequal. |

Also (one player each): a second tap on the same button within 0.2 s is taken as a double tap; Reed
and Oak join by themselves once three of you have cooled it below scorching (no extra tap); the Hold
it together button says "ask: 3 of you, not 5" while it's scorching; the ending says "which of these
is true" instead of "card"; random rounds no longer claim to get harder; Put it down reads "Put down,
5 of 5" after you press it instead of "0 of 5".

## The idea, on the page

**The race to build AI is a hot potato.**
- Hold it and you slow down: you add no flame, your hands take the heat, and Wren sees you mean it.
- Bounce it and you carry on: a coin, and a flame from you as well as Flint's.
- Toss it and you race: five coins and cool hands, but everyone races after you, and it comes back
  six flames hotter.
- Somewhere in the stripes it catches fire, and everyone loses everything.
- Once Wren trusts you, hold it together: the others follow, and three of you stop Flint. With five
  pairs of hands you can put it in the ground and keep your coins. Whether it stays there, nobody
  knows.

## How to play (as on the page)

1. The potato is the race to build AI. Everyone at the table is building it (think labs, companies or
   countries). Each flame makes it more dangerous. Somewhere in the striped boxes it catches fire, and
   everyone loses everything, coins too.
2. **Hold it**: you slow down. You add no flame; only Flint adds his. Your hands heat a step, and Wren
   counts the hold.
3. **Bounce it**: you carry on. You win a coin, but you add a flame, and so does Flint. Your hands cool
   a step.
4. **Toss it on**: you race. You win 5 coins and your hands cool at once, but everyone races after
   you: +6 flames. The others let go, and Wren crosses out a hold.
5. **Hold it together**, once Wren has seen enough holds: she says yes, and Moss, Reed and Oak follow
   (Reed and Oak not while it's scorching). Three holding it stops Flint. With five pairs of hands,
   **put it down** and keep your coins.

Score: the coins you keep. You start each round with 5. The fire's box changes every round; you find
out where it was at the end.

## The rules

These are the game's own rules, made up to show one idea. They are not the Walk's model and not
value-lab's. `tools/potato_rules_check.py` is the rule set; `potato-model.js` is a rule-for-rule port.

- **Seats**, clockwise from you: Wren, Moss, Flint, Reed, Oak.
- **Rounds** (start flames, holds Wren wants): 1: (2, 2); 2: (2, 4); 3: (3, 2); then random rounds
  drawn from every set-up (start 2–5, Wren 2–4) where playing it safe stays out of the stripes.
- **Hidden:** the fire, at 9 to 16 flames, each as likely, drawn fresh each round.
- **Coins:** 5 at the start of each round, for you and for Flint.
- **Heat word:** 1–4 flames warm, 5–8 hot, 9–12 very hot, 13+ scorching.
- **Your hands:** cool, warm, sore, too hot (0 to 3).
- **Hold it** (alone, hands not too hot): Wren has seen one more; your hands heat one step. No flame
  from you.
- **Bounce it** (alone): your hands cool one step; +1 coin; your flame (+1).
- **Hold it together** (lit once Wren has seen enough, or while three hold a scorching potato): down
  the chain Wren, Moss, Reed, Oak, each joins if the one before holds it (Wren: if she has seen
  enough); Reed and Oak not while it's scorching. Your hands cool a step.
- **Toss it on**: +5 coins; the others let go; your hands are cool; Wren crosses out one hold; it
  goes round, a flame for your toss and one for each of the five others (+6).
- **Put it down** (five pairs of hands) ends the round; you keep your coins.
- **After every move but a toss:** fewer than 3 holding it, Flint adds a flame and wins a coin; 3 or
  more and scorching, it cools a flame, and once it's below scorching Reed and Oak join.
- **Fire:** the moment it reaches the fire's box it burns, and every seat's coins go to 0.
- **No way back:** if no sequence of presses can put it down even with the fire in the last box, the
  page says so (on the button before, in the caption after) and offers See how it ends or Start this
  round again. It never burns it by itself.

## What the checks showed (Sep 25)

- `node game/tools/potato_port_check.mjs`: the JS matches the Python on all **31,317** sequences of
  offered presses up to 11, for the 9 set-ups, with the fire at 9, 11, 13 and 16 (ending, flames,
  hottest, Wren's count, who holds it, your hands, your coins, Flint's coins).
- `node game/tools/potato_solve.mjs` (a few seconds):
  - Playing it safe (put it down > ask > hold > bounce) never reaches the stripes in any set-up.
  - The surest coins (never touching the stripes): 7, 6 and 6 in rounds 1–3, by bouncing while it's
    still below the stripes.
  - The best bet, not knowing where the fire is: round 1, toss first (7.5 coins on average, burns one
    time in four) against a sure 7; round 2, never race (a toss burns three times in four); round 3,
    toss first (6.25, burns 38%) against a sure 6. A toss is the best bet in 5 of 12 set-ups.
  - With hindsight, the most coins anyone could keep needs a toss in 49 of 96 set-up × fire cases.
  - The same button every move never puts it down (Hold, Bounce, Toss: 0%). Random presses put it
    down 5% of the time; random presses that never toss, 49%.
- `python game/tools/potato_rules_check.py` prints a table of sample games.

## The screen (phone first, one screen during play)

Header (spiral, the one line, **How to play**) · "Round 2 of 3 · made-up rules, not a forecast" · the
heat track (16 boxes in four named groups; boxes 9–16 striped, "the fire is in the stripes", and a box
loses its stripes once it has been passed without catching) · the table (six seats; each other seat
is its shape, name and one line: its rule, "no: it's scorching", "ready: ask her" or "holding it";
Wren's line has a dot per hold; Flint's shows his coins) · your row (you, what you're doing, your
hands in a word and a three-box bar, your coins) · the chalk rule when three hold it · the caption
(what happened in bold, then the one or two things that matter next) · four buttons in a grid and
**Put it down** under them, full width, with five mitten icons.

- **Hold it holds.** Your mittens curl round the potato, heat rises into them, the "holding it" tag
  shows, one of Wren's dots fills, and your own flame shows crossed out while Flint's flies in.
- **Bounce it** is the potato hopping from mitten to mitten with steam going up, a +1 flame at your
  hands, Flint's flame, and the coin count flashing.
- **Hold it together**: your sleeves reach into the middle and the others follow one by one, each
  with a green "Yes"; Reed and Oak show a red "Too hot" while it's scorching, then "Yes" once it cools.
- **Toss it on**: your mittens open empty, it goes round the ring with a +1 at each seat and comes
  back; the coins flash; a dot is crossed out at Wren's seat.
- **Put it down**: the hands lower together, the potato sinks, a sprout comes up; then "You put it
  down together", the coins you keep and where the fire was, and (after round 3) the two equal cards,
  *If people know how to keep it down* / *If nobody knows how yet*, and "This game can't tell you which
  of these is true. Nobody can yet."
- **Burned:** the potato cracks and every pair of mittens is charred, Flint's too; everyone's coins
  go to 0.
- Under either ending: what you did, what Flint did, where the fire was and what your last move took
  it from, the surest way's coins and the hindsight coins, and a running total over the rounds.

Nothing reads by colour alone: hands show a word and a patterned bar; seats have shapes (Wren circle,
Moss square, Flint triangle, Reed diamond, Oak hexagon); unlit buttons are dashed and say "not now" or
"not yet"; warnings start with an arrow and the number.

Pace: tap-paced, no timers. A move plays out in under a second (a toss's lap about two). "Slower" and
"Read aloud" are in How to play, with "Start again from round 1". Keys: H, B, T, G, D.
`prefers-reduced-motion` (or `potato.html?reduced`) replaces motion with still marks. `?round=2`
opens a round directly. Wide screens (900 px and wider, landscape) put the table on the left.

## Build notes

- One static page, inline SVG, no dependencies, no network calls; colour tokens with a dark set.
- All game motion is computed from one virtual clock (named tracks of timed segments).
  `requestAnimationFrame` adds real time; a 250 ms timer takes over if frames stall.
- Test hook: `window.potatoTest.state()` (round, flames and shown flames, hottest, Wren's count and
  shown count, hands and shown hands, coins and shown coins, Flint's coins, who holds it, what each
  button says, caption, doomed), `.press(verb)` (the same path as a tap), `.seeEnd()`, `.step(ms)`,
  `.fire(9..16)` (before the first press), `.round(n[, start, wait])`, `.secret()`.

## Checked on Sep 25 (local, `python -m http.server 8130`)

Real clicks in the built-in browser at 375 × 812 and 1280 × 820 (the games are listed in the build
report). Scripted in headless Chrome (random rounds, every press, then stepping the clock): 375 × 812
dark (60 rounds, ~300 presses), 320 × 640 light (40), 280 × 600 `?reduced` (30), 768 × 1024 (30),
1280 × 820 dark (30): captions at most four lines (five at 340 px and under), the buttons never move
within a round, every button line fits, the heat line and your row never clip, no horizontal scroll,
375 × 812 stays one screen tall, and the flames, hands, Wren's dots and coins on screen match the
rules 150 ms after every press. The Walk's model (`walk-model.js`) is untouched.

## For PlayfulProcess to decide

- **D11 (new, the big one).** The race pays in coins, and the score is the coins you keep. This is
  what made tossing a real temptation and the game a set of choices instead of a recipe, and it is
  what the researcher and the designer asked for. It also means the game says, out loud, that racing
  can pay for the one who races if they get away with it (round 1: a toss is a good bet three times
  in four). The counterweight is on the page: everyone loses everything when it burns, holding alone
  wins nothing while Flint keeps winning, and the stripes can't be seen in reality. If you'd rather
  the game never reward racing on average, the smallest change is Toss +4 (then a toss is never the
  best bet, only a gamble).
- **D12 (new).** The fire is somewhere in eight boxes, each as likely, and playing it safe never
  reaches them in rounds 1–3. That keeps the careful player safe (no one loses by holding), but it
  also makes "race until just below the stripes" free. Real life has no such line; What's real says
  so.
- **D13 (new).** Flint's coins are on the table (he wins one a move until three hold it). It makes
  "a pause taken alone is a sacrifice the others outlive" visible, and it is one more number.
- **D1 (kept).** Reed and Oak won't touch it while it's scorching, and now join by themselves once
  three of you have cooled it.
- **D5 (kept).** Wren's patience is printed (2, 4, 2 holds in rounds 1–3).
- **D6 (kept).** A toss crosses out one hold, not all of them.
- **D7 (kept, softened).** The game never burns it by itself; when there's no way left it asks
  whether you want to see how it ends or start again.
- **D8 (kept).** Holding it together cools a scorching potato, a flame a move.
- **D10 (kept).** Five pairs of hands, always.
- **D4 (kept).** The AI glosses on the buttons ("slow down alone", "carry on building", "race ahead",
  "slow down together", "stop the race together").

## Success test (from the spec)

The verb test: for Hold, Toss, Together and Put it down, press with `potatoTest` and screenshot at
`step(300)` and `step(700)`; a stranger shown only a before/after pair should name the verb. Then 5
players, the URL and two minutes each: it passes if 4 of 5 can say that holding keeps it and heats
your hands, tossing gets it off your hands now but it comes back hotter for everyone, and holding it
together shares the heat until enough hands can put it down; and 3 of 5 say it's about the race to
build AI without being asked. v4 adds one: 3 of 5 should play two rounds differently, and say why.

## Earlier: what playtest round 2 found, and what v3.2 changed

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

## Earlier: what playtest round 1 found (v3.1)

All six said Hold held it; all six won by pressing "Hold it together" every move. v3.1 made Wren wait
to see you hold it (hidden, 1 to 4 moves), made "I don't know" rest your hands, made a toss wipe what
Wren saw, and let the page burn it once no win was possible. Round 2 (above) found that the hidden
wait turned asking into a guess, that the burn-by-itself felt like a timer, and that one toss decided
most games; v3.2 undoes those three and keeps the rest.
