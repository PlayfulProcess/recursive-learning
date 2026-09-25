# Hot Potato v3 — design notes (Sep 24 2026)

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

v3 starts from the opposite end. Every verb does something you can see, to the potato and to the
hands, within one second, and one bold sentence says what happened and why. The rules are small
enough to print on the page, and every seat's rule is printed.

## The idea, on the page

**The race to build AI is a hot potato.**
- Hold it and your hands take the heat.
- Toss it and your hands cool at once, but it goes round the whole table and comes back hotter.
- Ask for hands and the heat is shared.
- With enough hands you can put it in the ground. Whether it stays there, nobody knows.

## How to play (the short version)

1. Flint tosses you the potato. You have four buttons.
2. **Hold it**: it stays in your hands; your hands get hotter; Flint keeps building (+1 flame).
3. **Toss it on**: your hands cool at once, but everyone else tosses it on too, and it comes back
   six flames hotter.
4. **Hold it together**: ask the others. Each joins by the line printed under their name; the heat
   is shared. Three holding writes the rule on the ground and stops Flint.
5. With enough hands (about 4, sometimes 5), **Put it down**. Past the hatched boxes it burns everyone.

## The rules

These are the game's own rules, made up to show one idea. They are not the Walk's model and not
value-lab's. `tools/potato_rules_check.py` is the rule set as designed and checked;
`potato-model.js` is a rule-for-rule port, and `tools/potato_port_check.mjs` walks every sequence of
offered moves up to 8 presses, for all four hidden draws, in both languages (96,146 sequences on
Sep 24) and compares the ending, the flames, how many hold it and every seat's hands.

- **Seats**, clockwise from you: Wren, Moss, Flint, Reed, Oak.
- **Hidden each game:** `need` (pairs of hands it takes: 4 or 5) and `burnAt` (15 or 16 flames).
- **Heat word:** 1–4 flames warm, 5–8 hot, 9–12 very hot, 13+ scorching. It gives off 1, 2, 3 or 4
  lines of heat a move.
- **Opening:** Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands.
- **Dealing heat:** while it is kept without enough hands, each line goes to the coolest hands on it
  (ties: you first, then clockwise). Hands run cool, warm, sore, burning, too hot.
- **Hold it** deals the heat. **I don't know** is the same as Hold, except with too-hot hands, when
  it slips and goes round (+5).
- **Toss it on** sends it round: the group breaks, the rule is rubbed out, your hands are cool at
  once, your toss adds a flame and each of the others adds one (+6).
- **Hold it together** adds every willing seat, then deals the heat. Willing, judged before you ask,
  and only if their hands are not burning: Wren always; Moss once 2 hold it; Reed once it's written
  and not scorching; Oak once 4 hold it and not scorching. Flint never.
- **Put it down** (only with enough hands) ends the game in the ground.
- **After every move:** hands off it cool one step; 3 or more holding writes the rule on the ground;
  if it did not go round and fewer than 3 hold it, Flint builds (+1). At `burnAt` it burns,
  even halfway round.

What the check showed: the fastest win is Together ×3 then Put it down (4 pairs) or Together ×4
(5 pairs); Hold, Hold, Toss, then Together until Put it down wins with either number; four Holds
then a Toss reaches scorching, Reed and Oak refuse, and it burns; "I don't know" every time burns
at move 8 or 9; pressing buttons at random burns 93% of games with 4 pairs, 97% with 5 (the page's
own random run on Sep 24: 142 of 150).

## The screen (phone first, one screen during play)

Header (spiral, the one line, Read to me, ?) · the heat track (16 boxes, the last two hatched:
"catches fire somewhere in here") · the stage (the ring of six seats, each with its shape, name,
printed tag, mittens and hand word; the middle; the ground) · Hands on it (five mittens, "enough:
about 4, sometimes 5") · the caption (what happened, then how the others answered) · four buttons,
each with an AI gloss ("slow down: it stays in your hands", "build faster: off your hands, hotter
for all", "ask the others for hands", "it stays where it is").

- **Hold it holds.** Your mittens curl round the potato and a "holding" tag appears; it does not
  move. Heat rises from it into your mittens and your hand word changes. When your hands are too
  hot the button is taken away, with the reason on it, so pressing Hold always holds.
- **I don't know** is open palms with the potato resting on them ("while you think…"), so the two
  never look alike.
- **Toss it on:** your mittens open empty, your hands read cool at once, and the potato goes round
  the ring, a box lighting at each seat, back into your hands.
- **Hold it together:** your sleeves reach into the middle with the potato; each joiner's sleeves
  reach in; the heat is split and the caption says who got what and why they joined.
- **Put it down:** the hands lower together, the potato sinks, the soil closes over it, the hands go
  home empty; then two equal cards: *If there's a known way to keep it down* / *If nobody knows how
  yet*, and "This game can't tell you which card is true. Nobody can yet."
- **Burned:** the potato cracks, every pair of mittens is charred, Flint's too.
- Under either ending: a recap in words (who joined and why, how often you tossed, the two hidden
  numbers), and the river line, labelled as a rhyme, not a finding about AI.

Nothing reads by colour alone: hands show a word, a notch count and a pattern (empty, 1 notch,
hatched, cross-hatched, jagged outline); the potato shows steam lines and its word; seats have
shapes (Wren circle, Moss square, Flint triangle, Reed diamond, Oak hexagon).

Pace: tap-paced, no timers, nothing moves while it waits for you. Your verb plays out in about a
second, then a still 0.6 s, then the others answer one at a time (0.8 s each). The "?" sheet has a
Slower setting (half speed) and Read to me (speaks each caption; off by default). Keys: H, T, G, D, K.
`prefers-reduced-motion` (or `potato.html?reduced`) replaces motion with still marks: a dotted loop
with a +1 at each seat for a toss, "+ joined" tags, a down arrow, "+1 Flint".

## Build notes

- One static page, inline SVG, no dependencies, no network calls; colour tokens with a dark set.
- All game motion is computed from one virtual clock (named tracks of timed segments; no CSS
  transitions for game motion). `requestAnimationFrame` adds real time; a 250 ms timer takes over
  if frames stall.
- Test hook: `window.potatoTest.state()`, `.press(verb)`, `.step(ms)`, `.draw(need, burnAt)` (before
  the first press only).
- The stage is sized from the space left on the screen; text on it is HTML at real pixel sizes
  (13 px and up), so it does not shrink with the drawing.

## Checked on Sep 24 (local, `python -m http.server`)

Played with real clicks at 375 px (dark) and 1280 px wide, and checked at 360 × 700 (light):
Hold keeps the potato in your hands and heats them; Toss sends it round and back six flames
hotter; Together moves it to the middle and adds hands; Put it down sinks it and shows the cards;
"I don't know" until it burns shows the slip and the charred ending. No console errors from the
page, no horizontal scroll. The Walk's model (`walk-model.js`) is untouched.

## For PlayfulProcess to decide

- **D1.** Reed and Oak refuse while it's scorching, instead of "hands needed grows with the flames".
- **D2.** Heat ties go to you first, so only your hands can reach "too hot".
- **D3.** Random play burns more than 90% of the time. If testers find it too harsh, move the fire
  boxes to 17–18.
- **D4.** The AI glosses on the buttons ("slow down", "build faster").
- **One wording mismatch, flagged not fixed.** The design spec's prose says a seat joins only if its
  hands are "warm or cooler"; the checked rules (`potato_rules_check.py`) block only burning hands,
  so sore hands can still join. The page follows the checked rules. Changing it changes the win
  paths, so it wants a re-check first.
- Also open (risks named in the spec): tossing never helps the group (the pull is "off my hands
  now"); only you can start holding it together; the lap takes 2.7 s; voices for Read to me vary.

## Success test (from the spec)

Before the panel, the verb test: for Hold, Toss, Together and Put it down, press with `potatoTest`
and screenshot at `step(300)` and `step(700)`; a stranger shown only a before/after pair should name
the verb (Hold against I don't know first: grip against open palms). Then 5 players, the URL and two
minutes each: it passes if 4 of 5 can say that holding keeps it and heats your hands, tossing gets
it off your hands now but it comes back hotter for everyone, and holding it together shares the heat
until enough hands can put it down; and 3 of 5 say it's about the race to build AI without being asked.
