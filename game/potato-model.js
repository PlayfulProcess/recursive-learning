// potato-model.js: the rules of Hot Potato (v3.1, Sep 25 2026).
// These are the GAME's own rules, made up to show one idea. They are not measured from anything,
// and they are not the Walk's model (walk-model.js) or value-lab's.
// A rule-for-rule port of tools/potato_rules_check.py; tools/potato_port_check.mjs runs both on the
// same list of paths and the outcomes must match. tools/potato_solve.mjs finds the best play.
// Loaded as a plain script (window.potatoModel); also require()-able from node for the checks.
//
// What changed from v3 (after playtest round 1): Wren joins only once she has seen you hold it for
// a while (1 to 4 moves, hidden). Asking is not holding, so pressing "Hold it together" over and over
// no longer wins. A toss wipes what Wren has seen. "I don't know" rests your hands a step instead of
// copying Hold. Heat goes to the others before you on a tie, and hands that take no heat cool a step,
// so sharing the heat shows on your own hands.
(function (root) {
'use strict';

var OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak'];          // clockwise from you
var SEATS  = ['you'].concat(OTHERS);
var HANDW  = ['cool', 'warm', 'sore', 'burning', 'too hot'];    // hand steps 0..4
var START = 2, SCORCH = 13, TOO_HOT = 4, BURNING = 3, ROUND = 6;
var WAITS = [1, 2, 3, 4], NEEDS = [4, 5], BURNS = [15, 16];     // hidden, drawn fresh each game

function potw(F) { return F <= 4 ? 'warm' : F <= 8 ? 'hot' : F <= 12 ? 'very hot' : 'scorching'; }
function lines(F) { return { 'warm': 1, 'hot': 2, 'very hot': 3, 'scorching': 4 }[potw(F)]; }

// Opening: Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands.
// need: pairs of hands it takes to put it down. burn: where it catches fire. wait: how many moves
// Wren wants to see you hold it before she will hold it with you.
function create(need, burn, wait) {
  var hands = {}; SEATS.forEach(function (k) { hands[k] = 0; });
  return { F: START, need: need, burn: burn, wait: wait, seen: 0, on: ['you'], hands: hands, out: null,
           log: [], tosses: 0, tossesWithOthers: 0, tossedWithEnough: 0, rests: 0, holdsAlone: 0, asks: 0,
           notYet: 0, flintBuilt: 0, maxhand: 0, joined: [], refusedHot: [], lapBurn: null, hopeless: false };
}
function has(a, k) { return a.indexOf(k) >= 0; }
function enough(s) { return s.on.length >= s.need; }

// Each move it is kept without enough hands, the potato gives off lines of heat (1 warm .. 4
// scorching). Lines go one at a time to the coolest hands on it; on a tie, the others (clockwise)
// before you. skipYou: your hands take none (I don't know).
function dealHeat(s, ev, skipYou) {
  var got = {};
  if (enough(s)) return got;
  var order = OTHERS.filter(function (k) { return has(s.on, k); });
  if (!skipYou) order.push('you');
  if (!order.length) return got;
  for (var i = 0, n = lines(s.F); i < n; i++) {
    var best = order[0];
    order.forEach(function (k) { if (s.hands[k] < s.hands[best]) best = k; });
    s.hands[best] = Math.min(TOO_HOT, s.hands[best] + 1); got[best] = true;
    if (ev) ev.push({ type: 'heat', to: best, hand: s.hands[best] });
  }
  s.maxhand = Math.max(s.maxhand, s.hands.you);
  return got;
}
// Each seat's own line, judged on what they saw BEFORE you asked. Burning hands can't take it.
function why(s, k) {                              // null = yes; otherwise the reason for no
  if (k === 'flint') return 'never';
  if (s.hands[k] >= BURNING) return 'burning';
  var n = s.on.length, scorch = s.F >= SCORCH;
  if (k === 'wren') return s.seen >= s.wait ? null : 'not yet';
  if (k === 'moss') return n >= 2 ? null : 'two';
  if (k === 'reed') return n < 3 ? 'three' : scorch ? 'scorching' : null;
  if (k === 'oak') return n < 4 ? 'four' : scorch ? 'scorching' : null;
}
function willing(s, k) { return why(s, k) === null; }
function joiners(s) { return OTHERS.filter(function (k) { return !has(s.on, k) && willing(s, k); }); }
function tooHot(s) { return s.hands.you >= TOO_HOT; }
function offered(s) {
  if (s.out) return [];
  if (tooHot(s)) return ['toss', 'idk'];
  var L = ['toss', 'idk', 'hold'];
  L.push(enough(s) && s.on.length > 1 ? 'down' : 'together');
  return L;
}
// Scorching, and not enough hands now or ever: Reed and Oak won't join, and it only gets hotter.
function hopeless(s) {
  if (s.out || enough(s) || s.F < SCORCH) return false;
  var reach = s.on.length + (has(s.on, 'wren') ? 0 : 1) + (has(s.on, 'moss') ? 0 : 1);
  return reach < s.need;
}
function flame(s, by, ev) {
  s.F += 1;
  if (ev) ev.push({ type: 'flame', by: by, F: s.F });
  if (s.F >= s.burn) { s.out = 'burned'; if (ev) ev.push({ type: 'burn', by: by }); }
}
// Off your hands: the group breaks, your hands are cool at once, Wren forgets what she saw, and
// everyone else tosses it on in turn (your toss and theirs: a flame each) until it is back with you.
function goesRound(s, ev) {
  var left = s.on.filter(function (k) { return k !== 'you'; });
  if (ev) ev.push({ type: 'leave', others: left, forgot: s.seen });
  if (left.length) s.tossesWithOthers += 1;
  if (enough(s) && left.length) s.tossedWithEnough += 1;
  s.on = ['you']; s.hands.you = 0; s.seen = 0; s.tosses += 1;
  for (var i = 0; i < SEATS.length; i++) {
    flame(s, SEATS[i], ev);
    if (s.out) { s.lapBurn = SEATS[i]; break; }
  }
  if (!s.out && ev) ev.push({ type: 'back' });
}
function step(s, v) {
  var ev = [], got = {}, wentRound = false;
  s.log.push(v);
  if (v === 'toss') {
    goesRound(s, ev); wentRound = true; got = { you: true };
  } else if (v === 'hold') {
    if (s.on.length === 1) { s.seen += 1; s.holdsAlone += 1; ev.push({ type: 'seen', n: s.seen }); }
    got = dealHeat(s, ev, false);
  } else if (v === 'idk') {
    s.rests += 1;
    ev.push({ type: 'rest' });
    if (s.on.length > 1) got = dealHeat(s, ev, true);
  } else if (v === 'together') {
    s.asks += 1;
    var js = [];
    OTHERS.forEach(function (k) {
      if (has(s.on, k) || k === 'flint') return;
      var w = why(s, k);
      if (w === null) js.push(k);
      else {
        ev.push({ type: 'refuse', who: k, why: w });
        if (w === 'not yet') s.notYet += 1;
        if (w === 'scorching' && !has(s.refusedHot, k)) s.refusedHot.push(k);
      }
    });
    js.forEach(function (k) {
      if (!has(s.joined, k)) s.joined.push(k);
      ev.push({ type: 'join', who: k });
    });
    s.on = ['you'].concat(OTHERS.filter(function (k) { return has(s.on, k) || has(js, k); }));
    got = dealHeat(s, ev, false);
  } else if (v === 'down') {
    s.out = 'down'; ev.push({ type: 'down' }); return ev;
  }
  if (s.out) return ev;
  SEATS.forEach(function (k) {                    // hands that took no heat this move cool a step
    if (!got[k] && s.hands[k] > 0) { s.hands[k] -= 1; ev.push({ type: 'cool', who: k, hand: s.hands[k], on: has(s.on, k) }); }
  });
  if (!wentRound && s.on.length < 3) {            // Flint builds until three of you hold it
    s.flintBuilt += 1; ev.push({ type: 'build' }); flame(s, 'flint', ev);
  }
  if (!s.out && hopeless(s)) { s.hopeless = true; ev.push({ type: 'hopeless' }); }
  return ev;
}
function clone(s) { return JSON.parse(JSON.stringify(s)); }

var api = { OTHERS: OTHERS, SEATS: SEATS, HANDW: HANDW, START: START, SCORCH: SCORCH, TOO_HOT: TOO_HOT,
            BURNING: BURNING, ROUND: ROUND, WAITS: WAITS, NEEDS: NEEDS, BURNS: BURNS,
            potw: potw, lines: lines, create: create, enough: enough, dealHeat: dealHeat, why: why,
            willing: willing, joiners: joiners, tooHot: tooHot, offered: offered, hopeless: hopeless,
            step: step, clone: clone };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.potatoModel = api;
})(this);
