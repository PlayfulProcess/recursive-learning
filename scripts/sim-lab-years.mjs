#!/usr/bin/env node
// The Lab Years: balance by simulation. Plays ~2000 games with simple bot policies and reports
// the ending distribution, the average year of the ending, and each secret objective's win rate.
// Run: node scripts/sim-lab-years.mjs [gamesPerTable]
//
// This never touches the DOM; it drives game/lab-years/engine.js exactly as a UI would, through
// its public actions only (no reaching into state to cheat the numbers).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as E from '../game/lab-years/engine.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const CARDS = JSON.parse(readFileSync(here('../game/lab-years/cards.json'), 'utf8'));
CARDS.__byId = E.indexCards(CARDS);

const GAMES_PER_TABLE = Number(process.argv[2]) || 2000;

// ── bot policies ─────────────────────────────────────────────────────────────────────────────
// Each policy picks ONE action for the active player this call. All go through the engine's real
// exported actions; a policy that picks something illegal (e.g. no compute) just falls through to
// the next choice, ending in pass.
function cardSuit(id) { return (CARDS.__byId[id] || {}).suit; }
function bestSecureTarget(state, p) {
  const counts = {};
  p.hand.forEach(id => { const s = cardSuit(id); if (s && s !== 'wild') counts[s] = (counts[s] || 0) + 1; });
  const open = E.SAFEGUARDS.filter(s => !state.safeguards[s].secured);
  let best = null, bestN = 0;
  open.forEach(s => { const n = (counts[s] || 0) + p.hand.filter(id => cardSuit(id) === 'wild').length; if (n > bestN) { bestN = n; best = s; } });
  return bestN >= 1 ? best : null;
}
function cardsFor(state, p, safeguardId) {
  const matching = p.hand.filter(id => cardSuit(id) === safeguardId);
  const wild = p.hand.filter(id => cardSuit(id) === 'wild');
  return [...matching, ...wild];
}

function policyRandom(state, p, rng) {
  const options = ['research', 'build', 'secure', 'publish', 'lobby', 'pass'];
  const pick = options[Math.floor(rng() * options.length)];
  return actOrPass(state, p, pick, rng);
}
function policyGreedyProfit(state, p, rng) {
  if (p.compute >= 2 && rng() < 0.35) return { type: 'release' };
  if (p.compute >= 1 && p.hand.length) return { type: 'build', cardId: p.hand[0] };
  return { type: 'research' };
}
function policyCautiousHumanity(state, p, rng) {
  const target = bestSecureTarget(state, p);
  if (target) return { type: 'secure', cardIds: cardsFor(state, p, target), safeguardId: target };
  if (rng() < 0.4) return { type: 'lobby' };
  return { type: 'research' };
}
function policyMixed(state, p, rng) {
  const r = rng();
  if (r < 0.34) return policyCautiousHumanity(state, p, rng);
  if (r < 0.67) return policyGreedyProfit(state, p, rng);
  return policyRandom(state, p, rng);
}
function actOrPass(state, p, pick, rng) {
  if (pick === 'build' && p.compute >= 1 && p.hand.length) return { type: 'build', cardId: p.hand[0] };
  if (pick === 'secure') { const t = bestSecureTarget(state, p); if (t) return { type: 'secure', cardIds: cardsFor(state, p, t), safeguardId: t }; }
  if (pick === 'publish' && p.hand.length) return { type: 'publish', cardId: p.hand[0] };
  if (pick === 'lobby') return { type: 'lobby' };
  if (pick === 'research') return { type: 'research' };
  return { type: 'pass' };
}

const POLICIES = {
  random: policyRandom, greedyProfit: policyGreedyProfit, cautiousHumanity: policyCautiousHumanity, mixed: policyMixed,
};

function applyAction(state, playerId, action) {
  switch (action.type) {
    case 'research': return E.research(state, playerId, CARDS);
    case 'build': return E.build(state, playerId, action.cardId, CARDS);
    case 'release': return E.releaseModel(state, playerId, [], CARDS);
    case 'secure': return E.secure(state, playerId, action.cardIds, action.safeguardId, CARDS);
    case 'publish': return E.publish(state, playerId, action.cardId, CARDS);
    case 'lobby': return E.lobby(state, playerId, CARDS);
    default: return E.pass(state, playerId, CARDS);
  }
}

// mulberry32, local to the sim only (never fed into the engine's own seed/rng — this just drives
// bot CHOICES; the engine's own randomness still runs through fork-engine's rngFrom/drawValue).
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function playOne(policyNames, seed, world) {
  const players = policyNames.map((name, i) => ({ id: 'p' + i, name: 'Player ' + (i + 1) }));
  let state = E.newGame({ players, seed, cards: CARDS, world });
  const rng = mulberry32((seed * 2654435761) >>> 0);
  let guard = 0;
  while (!state.ended && guard < 5000) {
    guard += 1;
    const p = E.activePlayer(state);
    const idx = state.players.indexOf(p);
    const policy = POLICIES[policyNames[idx]] || policyRandom;
    const action = policy(state, p, rng);
    try { state = applyAction(state, p.id, action); }
    catch (e) { try { state = E.pass(state, p.id, CARDS); } catch (e2) { break; } }
  }
  return state;
}

function summarize(label, policyNames, n, world) {
  const endings = { proceed: 0, regulate_ongoing: 0, contain_ongoing: 0, catastrophe: 0, timeout: 0 };
  const objectiveWins = {}; E.OBJECTIVE_IDS.forEach(o => { objectiveWins[o] = 0; });
  const objectiveSeen = {}; E.OBJECTIVE_IDS.forEach(o => { objectiveSeen[o] = 0; });
  let yearSum = 0, roundSum = 0;
  for (let i = 0; i < n; i++) {
    const state = playOne(policyNames, 1000 + i, world);
    const end = state.ended || { type: 'timeout', year: state.year };
    const key = end.type === 'proceed' ? 'proceed' : end.type === 'catastrophe' ? 'catastrophe' : end.type === 'timeout' ? 'timeout'
      : state.raceCapped ? 'regulate_ongoing' : state.capabilityFrozen ? 'contain_ongoing' : 'timeout';
    endings[key] = (endings[key] || 0) + 1;
    yearSum += end.year || state.year;
    roundSum += state.round;
    const score = E.scoreGame(state);
    score.results.forEach(r => { objectiveSeen[r.objective] += 1; if (r.won) objectiveWins[r.objective] += 1; });
  }
  console.log(`\n=== ${label} (${n} games) ===`);
  console.log('Endings:');
  Object.entries(endings).forEach(([k, v]) => { if (v) console.log(`  ${k}: ${(100 * v / n).toFixed(1)}% (${v})`); });
  console.log(`Average ending year: ${(yearSum / n).toFixed(1)}`);
  console.log(`Average rounds played: ${(roundSum / n).toFixed(1)}`);
  console.log('Objective win rates (of games where that objective was in play):');
  E.OBJECTIVE_IDS.forEach(o => {
    const seen = objectiveSeen[o] || 0;
    const rate = seen ? (100 * objectiveWins[o] / seen).toFixed(1) : '0.0';
    console.log(`  ${o}: ${rate}% (${objectiveWins[o]}/${seen})`);
  });
  return { endings, yearAvg: yearSum / n, roundAvg: roundSum / n, objectiveWins, objectiveSeen };
}

// per-World-combo table: does not force any one theory across the whole run — each of the 12
// takeoff x alignment-dynamics combinations gets its own mixed-table batch, at a smaller N (the
// headline table above already covers the random-World case at full N).
function summarizeWorldCombos(n) {
  console.log(`\n=== Mixed table, 5 players, by World combination (${n} games each, 12 combos) ===`);
  console.log('takeoff | alignment dynamics | proceed% | regulate% | contain% | catastrophe% | timeout% | avg rounds');
  for (const takeoff of E.TAKEOFF_WORLDS) {
    for (const alignmentDynamics of E.ALIGNMENT_DYNAMICS_WORLDS) {
      const world = { takeoff, alignmentDynamics };
      let proceed = 0, regulate = 0, contain = 0, catastrophe = 0, timeout = 0, roundSum = 0;
      for (let i = 0; i < n; i++) {
        const state = playOne(['mixed', 'mixed', 'mixed', 'mixed', 'mixed'], 5000 + i, world);
        const end = state.ended || { type: 'timeout' };
        if (end.type === 'proceed') proceed++;
        else if (end.type === 'catastrophe') catastrophe++;
        else if (end.type === 'timeout') timeout++;
        else if (state.raceCapped) regulate++;
        else if (state.capabilityFrozen) contain++;
        else timeout++;
        roundSum += state.round;
      }
      const pct = x => (100 * x / n).toFixed(0);
      console.log(`  ${takeoff.padEnd(20)} | ${alignmentDynamics.padEnd(12)} | ${pct(proceed)}% | ${pct(regulate)}% | ${pct(contain)}% | ${pct(catastrophe)}% | ${pct(timeout)}% | ${(roundSum / n).toFixed(1)}`);
    }
  }
}

console.log('The Lab Years: balance by simulation');
summarize('All random, 3 players', ['random', 'random', 'random'], GAMES_PER_TABLE);
summarize('All greedy-profit, 4 players', ['greedyProfit', 'greedyProfit', 'greedyProfit', 'greedyProfit'], GAMES_PER_TABLE);
summarize('All cautious-humanity, 4 players', ['cautiousHumanity', 'cautiousHumanity', 'cautiousHumanity', 'cautiousHumanity'], GAMES_PER_TABLE);
summarize('Mixed table, 5 players (the headline numbers)', ['mixed', 'mixed', 'mixed', 'mixed', 'mixed'], GAMES_PER_TABLE);
summarize('Mixed table, 4 players, one of each style', ['random', 'greedyProfit', 'cautiousHumanity', 'mixed'], GAMES_PER_TABLE);
summarizeWorldCombos(Math.max(50, Math.round(GAMES_PER_TABLE / 10)));
