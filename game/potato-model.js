// potato-model.js: the rules of Hot Potato (v4, Sep 25 2026).
// These are the GAME's own rules, made up to show one idea. They are not measured from anything,
// and they are not the Walk's model (walk-model.js) or value-lab's.
// A rule-for-rule port of tools/potato_rules_check.py; tools/potato_port_check.mjs runs both on the
// same sequences and the outcomes must match. tools/potato_solve.mjs checks the rounds.
// Loaded as a plain script (window.potatoModel); also require()-able from node for the checks.
//
// What changed from v3.2 (after playtest round 3: Hold held, everyone understood it, but one
// recipe won every round, a toss was never worth it, and holding held back no heat):
// - Hold it holds back YOUR flame: you add none; Flint still adds his. Bounce it (was "I don't
//   know") means you carry on: you add a flame too. So holding is the coolest move you can make.
// - The race pays. You start each round with 5 coins; Bounce it wins 1, Toss it on wins 5. Put it
//   down and you keep them; if it catches fire, everyone's coins burn. Flint wins a coin with every
//   flame he adds.
// - The fire is somewhere in the striped boxes, 9 to 16 flames, any box as likely, drawn fresh each
//   round. Playing it safe never reaches the stripes in rounds 1-3; racing does.
// - With five holding it, "Hold it together" isn't offered. Three holding a scorching potato cool
//   it a flame a move, and Reed and Oak join by themselves once it's below scorching.
(function (root) {
'use strict';

var OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak'];          // clockwise from you
var SEATS  = ['you'].concat(OTHERS);
var CHAIN  = ['wren', 'moss', 'reed', 'oak'];                    // each follows the one before
var HANDW  = ['cool', 'warm', 'sore', 'too hot'];               // your hands, steps 0..3
var TOO_HOT = 3, SCORCH = 13, NEED = 5, TOP = 16, LO = 9, LAP = 6;
var BANK = 5, BOUNCE_COINS = 1, TOSS_COINS = 5;
var FIRES = [9, 10, 11, 12, 13, 14, 15, 16];                    // hidden, any as likely, drawn each round
var ROUNDS = [{ start: 2, wait: 2 }, { start: 2, wait: 4 }, { start: 3, wait: 2 }];
// Random rounds after round 3: every set-up (start 2 to 5, Wren 2 to 4) where playing it safe stays
// out of the stripes. Some leave room to race, some leave none.
var FREE = [{ start: 2, wait: 2 }, { start: 2, wait: 3 }, { start: 2, wait: 4 }, { start: 3, wait: 2 }, { start: 3, wait: 3 },
            { start: 4, wait: 2 }, { start: 4, wait: 3 }, { start: 5, wait: 2 }, { start: 5, wait: 3 }];

function potw(F) { return F <= 4 ? 'warm' : F <= 8 ? 'hot' : F <= 12 ? 'very hot' : 'scorching'; }
function level(F) { return F <= 4 ? 1 : F <= 8 ? 2 : F <= 12 ? 3 : 4; }

// start: flames when Flint tosses it to you. wait: holds Wren wants to see. burn: where it catches fire.
function create(start, wait, burn) {
  return { F: start, start: start, wait: wait, burn: burn, seen: 0, on: ['you'], hand: 0, out: null, log: [],
           coins: BANK, flint: BANK, holds: 0, bounces: 0, idleBounces: 0, tosses: 0, tossesWithOthers: 0,
           forgot: 0, asks: 0, flintBuilt: 0, cooled: 0, refusedHot: 0, maxF: start, lapBurn: null,
           everThree: false, won: 0, lost: 0, flintLost: 0, burnFrom: null, burnMove: null };
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
    L.push('bounce');
    if (ready(s)) L.push('together');
  } else if (!enough(s)) L.push('together');
  if (enough(s)) L.push('down');
  return L;
}
function flame(s, by, ev) {
  s.F += 1; s.maxF = Math.max(s.maxF, s.F);
  if (ev) ev.push({ type: 'flame', by: by, F: s.F });
  if (s.F >= s.burn) {
    s.out = 'burned'; s.lost = s.coins; s.flintLost = s.flint; s.coins = 0; s.flint = 0;
    if (ev) ev.push({ type: 'burn', by: by });
  }
}
function join(s, ev, late) {
  answers(s).forEach(function (a) {
    if (a.why === null) { s.on.push(a.who); if (ev) ev.push({ type: 'join', who: a.who, late: !!late }); }
    else if (ev && !late) ev.push({ type: 'refuse', who: a.who, why: a.why });
  });
  s.on = ['you'].concat(CHAIN.filter(function (k) { return has(s.on, k); }));
}
// After every move but a toss: fewer than three holding it, Flint adds a flame (and wins a coin);
// three or more, Flint has stopped, and a scorching potato cools a flame. Once it's below
// scorching, Reed and Oak join by themselves.
function endMove(s, ev) {
  if (s.on.length < 3) {
    s.flintBuilt += 1; s.flint += 1;
    if (ev) ev.push({ type: 'build' });
    flame(s, 'flint', ev);
  } else if (scorching(s)) {
    s.F -= 1; s.cooled += 1;
    if (ev) ev.push({ type: 'cool', F: s.F });
    if (!scorching(s)) join(s, ev, true);
  }
}
function step(s, v) {
  var ev = [], F0 = s.F;
  s.log.push(v);
  if (v === 'toss') {
    // You race: +5 coins, the others let go, your hands are cool at once, Wren crosses out one hold,
    // and everyone races after you (a flame each, yours first) until it's back with you.
    var left = s.on.filter(function (k) { return k !== 'you'; });
    if (left.length) s.tossesWithOthers += 1;
    ev.push({ type: 'leave', others: left, forgot: s.seen > 0, hand: s.hand });
    if (s.seen > 0) { s.seen -= 1; s.forgot += 1; }
    s.on = ['you']; s.hand = 0; s.tosses += 1;
    s.coins += TOSS_COINS; s.won += TOSS_COINS;
    ev.push({ type: 'coin', n: TOSS_COINS });
    for (var i = 0; i < SEATS.length; i++) {
      flame(s, SEATS[i], ev);
      if (s.out) { s.lapBurn = SEATS[i]; break; }
    }
    if (!s.out) ev.push({ type: 'back' });
  } else if (v === 'down') {
    s.out = 'down'; ev.push({ type: 'down' }); return ev;
  } else {
    if (v === 'hold') {
      s.holds += 1; s.seen += 1; s.hand = Math.min(TOO_HOT, s.hand + 1);
      ev.push({ type: 'held', seen: s.seen, hand: s.hand });
    } else if (v === 'bounce') {
      s.bounces += 1;
      if (s.hand > 0) s.hand -= 1; else s.idleBounces += 1;
      s.coins += BOUNCE_COINS; s.won += BOUNCE_COINS;
      ev.push({ type: 'bounce', hand: s.hand });
      ev.push({ type: 'coin', n: BOUNCE_COINS });
      flame(s, 'you', ev);                                       // you carry on: your flame
    } else if (v === 'together') {
      s.asks += 1;
      join(s, ev, false);
      if (ev.some(function (e) { return e.type === 'refuse' && e.why === 'scorching'; })) s.refusedHot += 1;
      if (s.hand > 0) { s.hand -= 1; ev.push({ type: 'shared', hand: s.hand }); }   // the others take the heat
    }
    if (s.on.length >= 3) s.everThree = true;
    if (!s.out) endMove(s, ev);
    if (s.on.length >= 3) s.everThree = true;
  }
  if (s.out === 'burned') { s.burnFrom = F0; s.burnMove = v; }
  return ev;
}
// The fire's last act, once there's no way left: Flint keeps adding flames until it catches.
function playOut(s) {
  var ev = [], F0 = s.F;
  while (!s.out) { s.flintBuilt += 1; s.flint += 1; ev.push({ type: 'build' }); flame(s, 'flint', ev); }
  s.burnFrom = F0; s.burnMove = 'wait';
  return ev;
}
function clone(s) {
  var t = {}; for (var k in s) t[k] = s[k];
  t.on = s.on.slice(); t.log = s.log.slice();
  return t;
}
function key(t, d) { return t.F + '|' + t.seen + '|' + t.on.length + '|' + t.hand + '|' + d; }
// Can it still be put down, if the fire is as far off as it can be (16)? Only then is a loss certain.
function canWin(s) {
  var memo = {};
  function go(t, d) {
    if (t.out === 'down') return true;
    if (t.out || d === 0) return false;
    var k = key(t, d);
    if (k in memo) return memo[k];
    memo[k] = false;
    var o = offered(t), r = false;
    for (var i = 0; i < o.length && !r; i++) { var u = clone(t); u.burn = TOP; step(u, o[i]); r = go(u, d - 1); }
    return (memo[k] = r);
  }
  var t0 = clone(s); t0.burn = TOP;
  return go(t0, 24);
}
// The most coins you can still keep, if it must never reach `thr` flames (thr = LO: never touch the
// stripes, the surest way; thr = the real fire: with hindsight). Returns { gain, line } from s.
function most(s, thr) {
  var memo = {};
  function go(t, d) {
    if (t.out === 'down') return { gain: 0, line: [] };
    if (t.out || d === 0) return null;
    var k = key(t, d);
    if (k in memo) return memo[k];
    memo[k] = null;
    var best = null, o = offered(t);
    for (var i = 0; i < o.length; i++) {
      var u = clone(t); u.burn = thr; var c0 = u.coins; step(u, o[i]);
      if (u.out === 'burned') continue;
      var r = go(u, d - 1);
      if (!r) continue;
      var g = u.coins - c0 + r.gain;
      if (!best || g > best.gain || (g === best.gain && r.line.length + 1 < best.line.length)) best = { gain: g, line: [o[i]].concat(r.line) };
    }
    return (memo[k] = best);
  }
  var t0 = clone(s); t0.burn = thr;
  var r = go(t0, 30);
  return r ? { coins: s.coins + r.gain, line: r.line } : null;
}
function surest(start, wait) { return most(create(start, wait, 99), LO); }
// The page's careful line: put it down when you can, ask when Wren's ready, hold while your hands
// allow, otherwise bounce it. tools/potato_solve.mjs checks it never reaches the stripes in rounds 1-3.
function careful(s) {
  var o = offered(s);
  return has(o, 'down') ? 'down' : has(o, 'together') ? 'together' : has(o, 'hold') ? 'hold' : 'bounce';
}

var api = { OTHERS: OTHERS, SEATS: SEATS, CHAIN: CHAIN, HANDW: HANDW, TOO_HOT: TOO_HOT, SCORCH: SCORCH,
            NEED: NEED, TOP: TOP, LO: LO, LAP: LAP, BANK: BANK, BOUNCE_COINS: BOUNCE_COINS, TOSS_COINS: TOSS_COINS,
            FIRES: FIRES, ROUNDS: ROUNDS, FREE: FREE,
            potw: potw, level: level, create: create, alone: alone, enough: enough, tooHot: tooHot,
            scorching: scorching, ready: ready, answers: answers, offered: offered, step: step, playOut: playOut,
            careful: careful, canWin: canWin, most: most, surest: surest, clone: clone };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.potatoModel = api;
})(this);
