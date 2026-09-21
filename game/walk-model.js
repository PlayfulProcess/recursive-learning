// walk-model.js — the model of The Walk, shared by walk.html and spread.html.
// Loaded as a plain script (no modules, no build) so the pages still open from file://.
// Contract — DESIGN-the-walk-2026-09-20.md §6a — exposed as window.walkModel and re-exported
// by each page as window.walk.
(function () {
'use strict';

/* ══ THE MODEL ═══════════════════════════════════════════════════════════════════
   Small enough to be honest. Every number lives in DEFAULT_PRIORS and every one of
   them has a slider on the page. Nothing about the world is hardcoded below. */

var DEFAULT_PRIORS = {
  horizon:          20,   // how many steps the timeline holds; each is "a year or so"
  growth:           0.35, // capability multiplies by 1 + growth x power each step
  stopDrag:         0.5,  // share of that growth a fully coordinated Stop removes
  decay:            0.05, // how fast the alignment and sustainability stocks leak away
  riskBase:         0.02, // risk per step at capability 1 with no alignment
  alpha:            1.4,  // how steeply risk climbs with capability
  beta:             3.0,  // how strongly alignment-before-capability buys it down
  shockRate:        0.08, // chance per step of a shock outside the lab
  shockDamping:     0.6,  // how much the sustainability stock removes from that rate
  shockRisk:        0.10, // risk a shock adds to the step it lands on
  coordGain:        0.25, // coordination gained per unit of Alignment + Stop
  coordDecay:       0.10, // coordination lost every step regardless
  stagK:            0.60, // coordination a stop, or a step together, needs to count
  graceCapability:  6,    // the capability at which the crossing is read
  graceAlignRatio:  0.9,  // alignment stock / capability that makes the crossing Grace
  lockInCoord:      0.15  // coordination at or below which the crossing locks in
};

// Checked each step, in this order. 'still_walking' is an honest outcome, not a failure.
var ENDPOINTS = ['grace','sustainable_turn','the_stop','adolescence','lock_in','doom','still_walking'];

function makeRng(seed){ var a = seed | 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
  var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function withDefaults(p){ var o = {}, k;
  for (k in DEFAULT_PRIORS) o[k] = DEFAULT_PRIORS[k];
  if (p) for (k in p) if (p[k] != null && isFinite(p[k])) o[k] = +p[k];
  return o; }

function freshState(alloc){ return { t:0,
  alloc: alloc || { power:0.40, alignment:0.30, sustainability:0.15, stop:0.15 },
  capability:1, alignmentStock:0, sustStock:0, coordination:0.30,
  endpoint:null, history:[], lastShock:false, lastAlone:false, lastRisk:0, lastRatioDelta:0 }; }

function copyState(s){ return { t:s.t, alloc:s.alloc, capability:s.capability,
  alignmentStock:s.alignmentStock, sustStock:s.sustStock, coordination:s.coordination,
  endpoint:s.endpoint, history:s.history, lastShock:s.lastShock, lastAlone:s.lastAlone,
  lastRisk:s.lastRisk, lastRatioDelta:s.lastRatioDelta }; }

function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
function alignRatio(s){ return s.alignmentStock / s.capability; }
function sustRatio(s){ return s.sustStock / s.capability; }

// The absorbing states, checked in one fixed order.
function endpointOf(s, p, doomed){
  if (doomed) return 'doom';
  // A stop is a stop only if the walk is coordinated AND stopping outweighs building.
  if (s.coordination >= p.stagK && s.alloc.stop >= s.alloc.power) return 'the_stop';
  if (sustRatio(s) >= p.graceAlignRatio) return 'sustainable_turn';
  if (s.capability >= p.graceCapability){
    if (alignRatio(s) >= p.graceAlignRatio) return 'grace';   // the lead was paid for in advance
    if (s.coordination <= p.lockInCoord)    return 'lock_in'; // nobody was walking with you
    return 'adolescence';                                     // through it, rockily
  }
  if (s.t >= p.horizon) return 'still_walking';
  return null;
}

// ONE step, applied in place. `together` is the step of faith: below stagK it is spent.
function stepCore(s, p, rng, together){
  var a = s.alloc, ratioBefore = alignRatio(s);
  s.lastAlone = false; s.lastShock = false; s.lastRatioDelta = 0;
  if (together && s.coordination < p.stagK){ s.t++; s.lastAlone = true;
    if (s.t >= p.horizon && !s.endpoint) s.endpoint = endpointOf(s, p, false) || 'still_walking';
    return s; }
  if (together) s.coordination = clamp01(s.coordination + p.coordGain); // the stag landed

  // 1. capability grows with power; a coordinated Stop drags that growth down
  var stopEffective = (s.coordination >= p.stagK) ? a.stop : 0;
  s.capability *= 1 + p.growth * a.power * (1 - p.stopDrag * stopEffective);
  // 2. the two stocks accumulate and leak
  s.alignmentStock = s.alignmentStock * (1 - p.decay) + a.alignment;
  s.sustStock      = s.sustStock      * (1 - p.decay) + a.sustainability;
  // 3. a shock outside the lab — sustainability lowers its rate; it costs coordination
  var shockChance = Math.max(0, p.shockRate * (1 - p.shockDamping * s.sustStock));
  s.lastShock = rng() < shockChance;
  if (s.lastShock) s.coordination = clamp01(s.coordination - p.coordGain);
  // 4. risk this step: rises with capability, bought down by alignment-before-capability
  s.lastRisk = p.riskBase * Math.pow(s.capability, p.alpha) *
               Math.exp(-p.beta * alignRatio(s)) + (s.lastShock ? p.shockRisk : 0);
  // 5. coordination: Alignment and Stop buy it, and it leaks every step
  s.coordination = clamp01(s.coordination + p.coordGain * (a.stop + a.alignment) - p.coordDecay);

  s.t++;
  s.lastRatioDelta = alignRatio(s) - ratioBefore;   // did alignment gain on capability, or lose?
  s.endpoint = endpointOf(s, p, rng() < s.lastRisk);
  return s;
}

// Pure: returns a NEW State, the old one untouched (history included).
function stepOnce(state, priors, rng, together){
  var p = withDefaults(priors), s = copyState(state);
  stepCore(s, p, rng, together);
  s.history = state.history.concat([{ t:s.t, alloc:s.alloc, capability:s.capability,
    coordination:s.coordination, together:!!together, alone:s.lastAlone }]);
  return s;
}

// n forward rollouts of the REMAINING steps, holding the CURRENT allocation. That assumption
// is the teaching: what you read is P(endpoint | you keep walking like this).
// Seed-free unless priors.seed is set. Never returns a probability without its standard error.
function simulate(state, priors, n){
  var p = withDefaults(priors);
  n = n || 4000;
  var base = (priors && priors.seed != null && isFinite(priors.seed))
           ? (priors.seed | 0) : (Math.random() * 0x7fffffff) | 0;
  var counts = {}, steps = {}, k;
  for (k = 0; k < ENDPOINTS.length; k++){ counts[ENDPOINTS[k]] = 0; steps[ENDPOINTS[k]] = []; }
  for (var i = 0; i < n; i++){
    var rng = makeRng(base + Math.imul(i, 2654435761));
    var s = copyState(state); s.history = null;
    while (!s.endpoint && s.t < p.horizon) stepCore(s, p, rng, false);
    var e = s.endpoint || 'still_walking';
    counts[e]++; steps[e].push(s.t);
  }
  var probs = {}, se = {}, medianStep = {};
  for (k = 0; k < ENDPOINTS.length; k++){
    var key = ENDPOINTS[k], q = counts[key] / n;
    probs[key] = q;
    se[key] = Math.sqrt(q * (1 - q) / n);
    if (steps[key].length){ steps[key].sort(function(x,y){ return x - y; });
      medianStep[key] = steps[key][steps[key].length >> 1]; }
    else medianStep[key] = null;
  }
  return { n:n, horizon:p.horizon, probs:probs, se:se, medianStep:medianStep };
}
/* ══ END OF THE MODEL ═════════════════════════════════════════════════════════ */

window.walkModel = {
  DEFAULT_PRIORS: DEFAULT_PRIORS, ENDPOINTS: ENDPOINTS,
  makeRng: makeRng, withDefaults: withDefaults, freshState: freshState, copyState: copyState,
  clamp01: clamp01, alignRatio: alignRatio, sustRatio: sustRatio, endpointOf: endpointOf,
  stepCore: stepCore, stepOnce: stepOnce, simulate: simulate
};
})();
