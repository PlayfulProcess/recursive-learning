// potato-model.js — the rules of Hot Potato (v3, Sep 24 2026).
// These are the GAME's own rules, made up to show one idea. They are not measured from anything,
// and they are not the Walk's model (walk-model.js) or value-lab's.
// A rule-for-rule port of tools/potato_rules_check.py; tools/potato_port_check.mjs runs both
// on the same list of paths and the outcomes must match.
// Loaded as a plain script (window.potatoModel); also require()-able from node for the check.
(function (root) {
'use strict';

var OTHERS = ['wren', 'moss', 'flint', 'reed', 'oak'];          // clockwise from you
var SEATS  = ['you'].concat(OTHERS);
var HANDW  = ['cool', 'warm', 'sore', 'burning', 'too hot'];    // hand steps 0..4
var START = 2, SCORCH = 13;

function potw(F) { return F <= 4 ? 'warm' : F <= 8 ? 'hot' : F <= 12 ? 'very hot' : 'scorching'; }
function lines(F) { return { 'warm': 1, 'hot': 2, 'very hot': 3, 'scorching': 4 }[potw(F)]; }

// Opening: Flint holds it at 1 flame and tosses it to you: 2 flames, in your hands.
function create(need, burn) {
  var hands = {}; SEATS.forEach(function (k) { hands[k] = 0; });
  return { F: START, need: need, burn: burn, on: ['you'], hands: hands, written: false, out: null,
           log: [], tosses: 0, slips: 0, aloneHolds: 0, flintBuilt: 0, maxhand: 0,
           joined: [], refused: [], burnedInLap: false };
}
function has(a, k) { return a.indexOf(k) >= 0; }
function enough(s) { return s.on.length >= s.need; }

// Each move the potato is kept it gives off lines of heat (1 warm .. 4 scorching), unless enough
// hands hold it. Lines go one at a time to the coolest hands on it; ties go to you, then clockwise.
function dealHeat(s, ev) {
  if (enough(s)) return [];
  var got = [], order = ['you'].concat(OTHERS.filter(function (k) { return has(s.on, k); }));
  for (var i = 0, n = lines(s.F); i < n; i++) {
    var best = order[0];
    order.forEach(function (k) { if (s.hands[k] < s.hands[best]) best = k; });
    s.hands[best] = Math.min(4, s.hands[best] + 1); got.push(best);
    if (ev) ev.push({ type: 'heat', to: best, hand: s.hands[best] });
  }
  s.maxhand = Math.max(s.maxhand, s.hands.you);
  return got;
}
// Judged on what they saw BEFORE you asked. Burning hands can't take it.
function wouldJoin(s, k) {                       // their own line, heat of their hands aside
  var pairs = s.on.length, scorch = s.F >= SCORCH;
  return { wren: true, moss: pairs >= 2, flint: false,
           reed: s.written && !scorch, oak: pairs >= 4 && !scorch }[k];
}
function willing(s, k) { return s.hands[k] < 3 && wouldJoin(s, k); }
function joiners(s) { return OTHERS.filter(function (k) { return !has(s.on, k) && willing(s, k); }); }
function offered(s) {
  var L = ['toss', 'idk'];
  if (s.hands.you < 4) L.push('hold');
  if (enough(s) && s.on.length > 1) L.push('down');
  else if (joiners(s).length) L.push('together');
  return L;
}
// Why nobody will join right now (for the disabled "Hold it together"): burning hands, or scorching.
function whyNot(s) {
  var scorch = s.F >= SCORCH, out = { burning: [], scorching: [] };
  OTHERS.forEach(function (k) {
    if (k === 'flint' || has(s.on, k)) return;
    if (s.hands[k] >= 3) out.burning.push(k);
    else if (scorch && (k === 'reed' || k === 'oak')) out.scorching.push(k);
  });
  return out;
}
function flame(s, by, ev) {
  s.F += 1;
  if (ev) ev.push({ type: 'flame', by: by, F: s.F });
  if (s.F >= s.burn) { s.out = 'burned'; if (ev) ev.push({ type: 'burn', by: by }); }
}
// Off your hands: the group breaks, the written rule is rubbed out, your hands are cool at once,
// and everyone else tosses it on in turn (a flame each) until it is back with you.
function goesRound(s, yours, ev) {
  var left = s.on.filter(function (k) { return k !== 'you'; });
  if (ev) ev.push({ type: 'leave', others: left, rubbed: s.written, yours: yours });
  s.on = ['you']; s.written = false; s.hands.you = 0;
  if (yours) { s.tosses += 1; flame(s, 'you', ev); }
  for (var i = 0; i < OTHERS.length; i++) {
    if (s.out) break;
    flame(s, OTHERS[i], ev);
  }
  if (s.out) s.burnedInLap = true;
  else if (ev) ev.push({ type: 'back' });
}
function noteRefusals(s) {                        // Reed/Oak whose own line was met but for the heat
  if (s.F < SCORCH) return;
  ['reed', 'oak'].forEach(function (k) {
    if (has(s.on, k) || has(s.refused, k)) return;
    var met = k === 'reed' ? s.written : s.on.length >= 4;
    if (met || (!enough(s) && s.on.length >= 3)) s.refused.push(k);
  });
}
function step(s, v) {
  var ev = [], wentRound = false;
  s.log.push(v);
  if (v === 'toss') {
    goesRound(s, true, ev); wentRound = true;
  } else if (v === 'hold' || v === 'idk') {
    if (s.hands.you >= 4) {                        // "I don't know" with too-hot hands: it slips
      s.slips += 1; ev.push({ type: 'slip' });
      goesRound(s, false, ev); wentRound = true;
    } else {
      if (s.on.length === 1) s.aloneHolds += 1;
      dealHeat(s, ev);
    }
  } else if (v === 'together') {
    joiners(s).forEach(function (k) {
      s.on.push(k); if (!has(s.joined, k)) s.joined.push(k);
      ev.push({ type: 'join', who: k });
    });
    s.on = ['you'].concat(OTHERS.filter(function (k) { return has(s.on, k); }));
    dealHeat(s, ev);
  } else if (v === 'down') {
    s.out = 'down'; ev.push({ type: 'down' }); return ev;
  }
  if (s.out) return ev;
  SEATS.forEach(function (k) {                    // hands off it cool one step a move
    if (!has(s.on, k) && s.hands[k] > 0) { s.hands[k] -= 1; ev.push({ type: 'cool', who: k, hand: s.hands[k] }); }
  });
  if (s.on.length >= 3 && !s.written) { s.written = true; ev.push({ type: 'written' }); }
  if (!wentRound && s.on.length < 3) {            // Flint builds
    s.flintBuilt += 1; ev.push({ type: 'build' }); flame(s, 'flint-build', ev);
  }
  noteRefusals(s);
  return ev;
}
function clone(s) { return JSON.parse(JSON.stringify(s)); }

var api = { OTHERS: OTHERS, SEATS: SEATS, HANDW: HANDW, START: START, SCORCH: SCORCH,
            potw: potw, lines: lines, create: create, enough: enough, dealHeat: dealHeat,
            wouldJoin: wouldJoin, willing: willing, joiners: joiners, offered: offered, whyNot: whyNot,
            step: step, clone: clone };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.potatoModel = api;
})(this);
