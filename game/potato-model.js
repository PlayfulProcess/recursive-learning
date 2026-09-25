// potato-model.js: the rules of Hot Potato (v3.2, Sep 25 2026).
// These are the GAME's own rules, made up to show one idea. They are not measured from anything,
// and they are not the Walk's model (walk-model.js) or value-lab's.
// A rule-for-rule port of tools/potato_rules_check.py; tools/potato_port_check.mjs runs both on the
// same sequences and the outcomes must match. tools/potato_solve.mjs checks the rounds.
// Loaded as a plain script (window.potatoModel); also require()-able from node for the checks.
//
// What changed from v3.1 (after playtest round 2):
// - Nothing that decides the game is hidden except where it catches fire (15 or 16 flames). How many
//   holds Wren wants is printed at her seat, with a dot for each one she has seen.
// - A button is lit only when it will do what it says. "Hold it together" lights up once Wren would
//   say yes, so asking always gets hands on it; there is no "not yet" that looks like holding.
// - Hold it heats your hands exactly one step (cool, warm, sore, too hot), whatever the potato's heat.
// - One ask brings the whole chain: Wren says yes, Moss follows her, Reed follows Moss, Oak follows
//   Reed. Reed and Oak won't touch it while it's scorching.
// - Three of you holding it stops Flint AND cools it a flame a move, so a scorching potato can be
//   brought back; the page never burns it by itself.
// - A toss adds six flames and Wren crosses out one hold she saw (not all of them): costly,
//   survivable once in rounds 1 and 2, not in round 3.
// - "I don't know" is bouncing it from hand to hand: your hands cool a step, it isn't holding, and
//   Flint adds a flame.
// - Three rounds with printed numbers, each harder, then random rounds.
(function (root) {
'use strict';

var OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak'];          // clockwise from you
var SEATS  = ['you'].concat(OTHERS);
var CHAIN  = ['wren', 'moss', 'reed', 'oak'];                    // each follows the one before
var HANDW  = ['cool', 'warm', 'sore', 'too hot'];               // your hands, steps 0..3
var TOO_HOT = 3, SCORCH = 13, ROUND = 6, NEED = 5, TOP = 16;
var BURNS = [15, 16];                                            // hidden, drawn fresh each round
var ROUNDS = [{ start: 2, wait: 2 }, { start: 2, wait: 4 }, { start: 5, wait: 5 }];
var FREE = { starts: [2, 3, 4, 5], waits: [2, 3, 4, 5] };      // random rounds after round 3

function potw(F) { return F <= 4 ? 'warm' : F <= 8 ? 'hot' : F <= 12 ? 'very hot' : 'scorching'; }
function level(F) { return F <= 4 ? 1 : F <= 8 ? 2 : F <= 12 ? 3 : 4; }

// start: flames when Flint tosses it to you. wait: holds Wren wants to see. burn: where it catches fire.
function create(start, wait, burn) {
  return { F: start, start: start, wait: wait, burn: burn, seen: 0, on: ['you'], hand: 0, out: null, log: [],
           holds: 0, rests: 0, idleRests: 0, tosses: 0, tossesWithOthers: 0, forgot: 0, asks: 0,
           flintBuilt: 0, cooled: 0, refusedHot: 0, maxF: start, lapBurn: null, everThree: false };
}
function has(a, k) { return a.indexOf(k) >= 0; }
function alone(s) { return s.on.length === 1; }
function enough(s) { return s.on.length >= NEED; }
function tooHot(s) { return s.hand >= TOO_HOT; }
function scorching(s) { return s.F >= SCORCH; }
function ready(s) { return s.seen >= s.wait; }                  // Wren would say yes

// What each seat not holding it would answer if you asked now, down the chain. why: null = yes;
// 'not yet' (Wren hasn't seen enough holds), 'scorching' (Reed, Oak), 'waits' (the one before said no).
function answers(s) {
  var on = s.on.slice(), out = [], stop = false;
  CHAIN.forEach(function (k) {
    if (has(on, k)) return;
    var w;
    if (k === 'wren') w = ready(s) ? null : 'not yet';
    else if ((k === 'reed' || k === 'oak') && scorching(s)) w = 'scorching';
    else if (stop) w = 'waits';
    else w = null;
    if (w === null) on.push(k); else stop = true;
    out.push({ who: k, why: w });
  });
  return out;
}
// A button is offered only when it will do what it says.
function offered(s) {
  if (s.out) return [];
  var L = ['toss'];
  if (alone(s)) {
    if (!tooHot(s)) L.push('hold');
    L.push('idk');
    if (ready(s)) L.push('together');
  } else L.push('together');
  if (enough(s)) L.push('down');
  return L;
}
function flame(s, by, ev) {
  s.F += 1; s.maxF = Math.max(s.maxF, s.F);
  if (ev) ev.push({ type: 'flame', by: by, F: s.F });
  if (s.F >= s.burn) { s.out = 'burned'; if (ev) ev.push({ type: 'burn', by: by }); }
}
// After every move but a toss: fewer than three holding it, Flint adds a flame; three or more,
// Flint has stopped and it cools a flame.
function endMove(s, ev) {
  if (s.on.length < 3) { s.flintBuilt += 1; if (ev) ev.push({ type: 'build' }); flame(s, 'flint', ev); }
  else if (s.F > 1) { s.F -= 1; s.cooled += 1; if (ev) ev.push({ type: 'cool', F: s.F }); }
}
function step(s, v) {
  var ev = [];
  s.log.push(v);
  if (v === 'toss') {
    // Off your hands: the others let go, your hands are cool at once, Wren crosses out one hold she
    // saw, and everyone tosses it on in turn (a flame each, yours first) until it's back with you.
    var left = s.on.filter(function (k) { return k !== 'you'; });
    if (left.length) s.tossesWithOthers += 1;
    ev.push({ type: 'leave', others: left, forgot: s.seen > 0, hand: s.hand });
    if (s.seen > 0) { s.seen -= 1; s.forgot += 1; }
    s.on = ['you']; s.hand = 0; s.tosses += 1;
    for (var i = 0; i < SEATS.length; i++) {
      flame(s, SEATS[i], ev);
      if (s.out) { s.lapBurn = SEATS[i]; break; }
    }
    if (!s.out) ev.push({ type: 'back' });
    return ev;
  }
  if (v === 'hold') {
    s.holds += 1; s.seen += 1; s.hand = Math.min(TOO_HOT, s.hand + 1);
    ev.push({ type: 'held', seen: s.seen, hand: s.hand });
  } else if (v === 'idk') {
    s.rests += 1;
    if (s.hand > 0) s.hand -= 1; else s.idleRests += 1;
    ev.push({ type: 'bounce', hand: s.hand });
  } else if (v === 'together') {
    s.asks += 1;
    answers(s).forEach(function (a) {
      if (a.why === null) { s.on.push(a.who); ev.push({ type: 'join', who: a.who }); }
      else ev.push({ type: 'refuse', who: a.who, why: a.why });
    });
    if (ev.some(function (e) { return e.why === 'scorching'; })) s.refusedHot += 1;
    s.on = ['you'].concat(CHAIN.filter(function (k) { return has(s.on, k); }));
    if (s.hand > 0) { s.hand -= 1; ev.push({ type: 'shared', hand: s.hand }); }   // the others take the heat
  } else if (v === 'down') {
    s.out = 'down'; ev.push({ type: 'down' }); return ev;
  }
  if (s.on.length >= 3) s.everThree = true;
  endMove(s, ev);
  return ev;
}
// The coolest way through: put it down when you can, ask when Wren's ready, hold while your hands
// allow, otherwise bounce it. A round's score is the hottest it got; tools/potato_solve.mjs checks
// that no play keeps it cooler than this one, in every round.
function greedy(s) {
  var o = offered(s);
  return has(o, 'down') ? 'down' : has(o, 'together') ? 'together' : has(o, 'hold') ? 'hold' : 'idk';
}
function coolest(start, wait) {
  var s = create(start, wait, 99), n = 0;
  while (!s.out && n++ < 60) step(s, greedy(s));
  return { maxF: s.maxF, moves: s.log.length };
}
function clone(s) {
  var t = {}; for (var k in s) t[k] = s[k];
  t.on = s.on.slice(); t.log = s.log.slice();
  return t;
}
// Can it still be put down, if the fire is as far off as it can be (16)? Only then is a loss certain.
function canWin(s) {
  var memo = {};
  function go(t, d) {
    if (t.out === 'down') return true;
    if (t.out || d === 0) return false;
    var key = t.F + '|' + t.seen + '|' + t.on.length + '|' + t.hand + '|' + d;
    if (key in memo) return memo[key];
    memo[key] = false;
    var o = offered(t), r = false;
    for (var i = 0; i < o.length && !r; i++) { var u = clone(t); u.burn = TOP; step(u, o[i]); r = go(u, d - 1); }
    return (memo[key] = r);
  }
  var t0 = clone(s); t0.burn = TOP;
  return go(t0, 24);
}

var api = { OTHERS: OTHERS, SEATS: SEATS, CHAIN: CHAIN, HANDW: HANDW, TOO_HOT: TOO_HOT, SCORCH: SCORCH,
            ROUND: ROUND, NEED: NEED, TOP: TOP, BURNS: BURNS, ROUNDS: ROUNDS, FREE: FREE,
            potw: potw, level: level, create: create, alone: alone, enough: enough, tooHot: tooHot,
            scorching: scorching, ready: ready, answers: answers, offered: offered, step: step,
            greedy: greedy, coolest: coolest, canWin: canWin, clone: clone };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.potatoModel = api;
})(this);
