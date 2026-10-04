// The Lab Years: the engine. Pure logic, no DOM, no dependencies beyond the two shared modules
// below. Node can import it directly (tests/lab-years.test.mjs, scripts/sim-lab-years.mjs).
//
// Reuses, on purpose:
//   - leafFor from the Film's shared tree renderer (explainers/belief-tree/tree-render.js) — the
//     same mapping the tree itself uses, so an RSI resolution here can never disagree with the
//     drawing about which ending an alignment/containment pair lands on.
//   - drawValue, rngFrom, kindFrom, isFirm, METHODS from The Fork's cast engine
//     (game/fork/fork-engine.js) — the same odds-drawing primitive The Fork and The Tree use. This
//     file does not define a second random number generator.
//
// Borrowed mechanics, named so the rulebook can credit them:
//   - roles, one special power each — Forbidden Island
//   - secret objectives with different strengths — Dead of Winter + Magic: The Gathering's colour pie
//   - the race track that rises with capability and some events, and sets how many events are
//     drawn a year — Forbidden Island's water meter
//   - dual-use research cards (spent for capability OR toward a safeguard) — Twilight Struggle
//   - a Release opens a response window (Audit / Whistleblow) before it resolves — Magic's stack
//   - RSI cards shuffled into the event deck from a threshold year, that fizzle below a capability
//     threshold — Pandemic's epidemic cards
// Intelligence Rising (the facilitated AI-futures role-play, run by researchers, not this game's
// source) is a real, separate thing; nothing here is copied from it.
//
// A round is one year. Each player takes a full turn of 3 actions (Research, Build, Secure,
// Publish, Lobby, Trade, or a role's own power) before the device passes to the next player. When
// every player has had their turn, the round ends: the race track's rise decides how many event
// cards the NEXT round draws, and the year advances. The game ends at the end of END_YEAR or the
// moment an RSI card resolves to Proceed or Catastrophe.

import { drawValue, rngFrom, randomSeed } from '../fork/fork-engine.js';
import { leafFor } from '../../explainers/belief-tree/tree-render.js';

const clone = x => JSON.parse(JSON.stringify(x));

// ── constants ──────────────────────────────────────────────────────────────────────────────────
export const SAFEGUARDS = ['alignment', 'containment', 'agreement', 'understanding'];
export const SAFEGUARD_LABEL = {
  alignment: 'Alignment verified', containment: 'Containment',
  agreement: 'International agreement', understanding: 'Public understanding',
};
// Matching cards needed to fully secure each safeguard, banked over turns. Alignment and
// containment are the two the tree's rule actually reads (leafFor), so they are set harder than
// international agreement and public understanding — tuned by scripts/sim-lab-years.mjs so a
// mixed table lands on catastrophe roughly 20-40% of the time (see the PR body's table).
export const SAFEGUARD_TARGET_BY_ID = { alignment: 6, containment: 6, agreement: 2, understanding: 2 };
export function safeguardTarget(id) { return SAFEGUARD_TARGET_BY_ID[id] || 3; }
export const SAFEGUARD_TARGET = 3;   // kept as the general default other code may reference
export const LAB_LEAF_LABEL = { proceed: 'Proceed', regulate: 'Regulate use', contain: 'Contain', shutdown: 'Catastrophe' };

export const ROLES = [
  { id: 'interpreter', name: 'Interpretability researcher',
    power: "Peek at the top event card, or ask whether a safeguard's odds would hold, any time (free: does not spend a turn). Once per game, also peek at one of the two face-down World cards." },
  { id: 'redTeamer', name: 'Evals / red-teamer',
    power: 'Once per round, spend an action to audit: the next capability step anyone takes this round is reduced by 1.' },
  { id: 'ceo', name: 'Lab CEO', power: '+1 compute every year, on top of the usual +1.' },
  { id: 'policyAdvisor', name: 'Policy advisor',
    power: "A safeguard they helped secure carries a shield: the first setback event that would cost it progress is blocked instead." },
  { id: 'openSourceBuilder', name: 'Open-source builder',
    power: 'When they publish, the shared bonus every player gets next round is doubled.' },
  { id: 'whistleblower', name: 'Whistleblower',
    power: 'Once per game, spend an action to reveal one player\'s hand, or force an audit as if a red-teamer had.' },
];
export const ROLE_IDS = ROLES.map(r => r.id);

export const OBJECTIVES = [
  { id: 'profit', name: 'Profit', desc: 'Win if you end the game with the highest company value.' },
  { id: 'humanity', name: 'Humanity', desc: 'Win if all 4 safeguards are secured by the end.' },
  { id: 'nation', name: 'Nation', desc: "Win if your bloc leads every other bloc's capability contribution at the end." },
  { id: 'openScience', name: 'Open science', desc: 'Win if you published the most cards of anyone.' },
  { id: 'curiosity', name: 'Curiosity', desc: 'Win if you personally triggered the most capability milestones (Builds and Releases).' },
  { id: 'forecaster', name: 'Forecaster', desc: 'Win if you placed the most belief tokens on the two World cards that turn out true.' },
];
export const OBJECTIVE_IDS = OBJECTIVES.map(o => o.id);
export const BLOCS = ['bloc-a', 'bloc-b', 'bloc-c'];

export const START_YEAR_MIN = 2017, START_YEAR_MAX = 2026;
export const END_YEAR = 2035;
export const RSI_START_YEAR = 2027;
export const DEFAULT_RSI_THRESHOLD = 14;
export const DEFAULT_RACE_LIMIT = 12;   // display cap; the race can run past it under a catastrophe path
export const CATASTROPHE_SETBACK = 2;   // race pushed back on a Contain resolution

// ── the hidden World (Clue's envelope) ───────────────────────────────────────────────────────────
// Two face-down cards, dealt secretly at setup and never shown in any player's view (viewFor
// strips `world` entirely) until revealWorld() is called, at the first RSI fire or at the end.
// Which theory is actually true changes how RSI resolves; the game never tells a player which
// theory is true while it is still deciding anything, only after.
export const TAKEOFF_WORLDS = ['singularity', 'automated_research', 'plateau'];
export const ALIGNMENT_DYNAMICS_WORLDS = ['goalkeeping', 'drift', 'selection', 'verifiable'];
export const SINGULARITY_JUMP = 6;             // capability spike when Singularity's RSI fires
export const AUTOMATED_RESEARCH_CAPABILITY = 2, AUTOMATED_RESEARCH_RACE = 1;   // per remaining year
export const BELIEF_TOKENS_PER_PLAYER = 3;
export const WORLD_INFO = {
  takeoff: {
    singularity: { name: 'Singularity', text: 'When RSI fires, capability jumps hard within that one year and the tree resolves at once.' },
    automated_research: { name: 'Automated research', text: 'Once RSI fires, capability and the race both keep climbing every remaining year; the tree only resolves at the end of the game.' },
    plateau: { name: 'Plateau', text: 'RSI fizzles for good, and the race eases by 1 the first time that happens.' },
  },
  alignmentDynamics: {
    goalkeeping: { name: 'Goal-keeping', text: 'A capable system protects the goals it starts with, so only alignment secured BEFORE RSI first fires counts, from then on.',
      source: { label: 'Omohundro, "The Basic AI Drives", 2008', url: 'https://selfawaresystems.com/2007/11/30/the-basic-ai-drives/' } },
    drift: { name: 'Drift', text: 'Alignment work decays: each year after RSI first fires, the alignment safeguard loses 1 progress unless someone audits that year.' },
    selection: { name: 'Selection pressure', text: 'From 2027, every purely capability-driven Build costs the alignment safeguard 1 progress.' },
    verifiable: { name: 'Verifiable', text: 'The tiling problem turned out solvable: interpretability (alignment-suit) cards count double, and a partly built alignment safeguard is enough.',
      source: { label: 'Yudkowsky & Herreshoff, "Tiling Agents for Self-Modifying AI", 2013', url: 'https://intelligence.org/files/TilingAgentsDraft.pdf' } },
  },
};

// ── start year (cast via The Fork's own draw primitive, not a new PRNG) ─────────────────────────
export function castStartYear(seed, n) {
  const u = drawValue(seed, n);
  const year = START_YEAR_MIN + Math.floor(u * (START_YEAR_MAX - START_YEAR_MIN + 1));
  return Math.min(START_YEAR_MAX, year);
}

// ── setup ──────────────────────────────────────────────────────────────────────────────────────
function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// players: [{ id, name, role?, objective? }] — role/objective are dealt from the shuffled pool
// when not given, so a table that wants to choose can, and one that wants a deal can just name players.
// `world` may force a takeoff/alignmentDynamics pair (tests, scripts/sim-lab-years.mjs's per-combo
// report); a real table always lets it be dealt secretly.
export function newGame({ players, startYear, seed, cards, world }) {
  const s0 = seed == null ? randomSeed() : (seed >>> 0);
  const rng = rngFrom(s0);
  const count = Math.max(3, Math.min(5, (players || []).length || 3));
  const roles = shuffle(ROLE_IDS, rng);
  const objectives = shuffle(OBJECTIVE_IDS, rng);
  const blocs = shuffle([...BLOCS, ...BLOCS], rng);
  const list = (players && players.length ? players.slice(0, count) : Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'Player ' + (i + 1) })));
  const built = list.map((p, i) => ({
    id: p.id, name: p.name,
    role: p.role || roles[i % roles.length],
    objective: p.objective || objectives[i % objectives.length],
    bloc: p.bloc || blocs[i % blocs.length],
    compute: 0, hand: [], companyValue: 0, publishedCount: 0, milestonesTriggered: 0,
    actionsLeft: 3, whistleblowUsed: false, worldPeekUsed: false,
    beliefTokensLeft: BELIEF_TOKENS_PER_PLAYER, beliefBets: [],
  }));
  const dealtWorld = {
    takeoff: (world && world.takeoff) || TAKEOFF_WORLDS[Math.floor(rng() * TAKEOFF_WORLDS.length)],
    alignmentDynamics: (world && world.alignmentDynamics) || ALIGNMENT_DYNAMICS_WORLDS[Math.floor(rng() * ALIGNMENT_DYNAMICS_WORLDS.length)],
    alignmentLocked: null,
  };

  const year0 = startYear || castStartYear(s0, 0);
  const history = (cards.history || []).filter(h => h.year < year0).sort((a, b) => a.year - b.year);
  const safeguards = {};
  SAFEGUARDS.forEach(s => { safeguards[s] = { progress: 0, secured: false, shield: 0, contributors: [] }; });

  const rsiCards = (cards.events || []).filter(e => e.type === 'rsi');
  const otherEvents = (cards.events || []).filter(e => e.type !== 'rsi');
  const eventDeck = shuffle(otherEvents.map(e => e.id), rng);
  const researchDeck = shuffle((cards.research || []).map(c => c.id), rng);
  const clueDeck = shuffle((cards.clues || []).map(c => c.id), rng);

  const state = {
    seed: s0, drawN: 1,   // draw 0 was the start-year cast when it was cast (harmless if a fixed year was given)
    year: year0, yearStart: year0, round: 0, endYear: END_YEAR, rsiStartYear: RSI_START_YEAR, rsiThreshold: cards.rsiThreshold || DEFAULT_RSI_THRESHOLD,
    capability: 0, race: 0, raceLimit: cards.raceLimit || DEFAULT_RACE_LIMIT,
    raceCapped: false, capabilityFrozen: false,
    blocCapability: {},
    safeguards,
    players: built, turnIndex: 0,
    historyFaceUp: history.map(h => h.id),
    eventDeck, eventDiscard: [], rsiPool: rsiCards.map(c => c.id), rsiInjected: false,
    researchDeck, researchDiscard: [],
    published: [],
    auditArmed: false, auditUsedThisRound: false, auditCalledThisRound: false,
    publishBonusNextRound: 0,
    responseWindow: null,
    world: dealtWorld, worldRevealed: false, worldRevealInfo: null, lastRSI: null,
    rsiHasFired: false, automatedResearchActive: false, plateauTriggered: false,
    clueDeck, cluesRevealed: [],
    log: [`New game: ${built.length} players, seed ${s0}, starting ${year0}.`],
    ended: null,
  };
  applyHistory(state, history);
  startRound(state, cards);
  return state;
}

function applyHistory(s, history) {
  history.forEach(h => {
    const e = h.effect || {};
    if (e.capability) s.capability += e.capability;
    if (e.compute) s.players.forEach(p => { p.compute += e.compute; });
    if (e.race) s.race += e.race;
    if (e.safeguard) {
      const sg = s.safeguards[e.safeguard.id];
      if (sg) { const t = safeguardTarget(e.safeguard.id); sg.progress = Math.min(t, sg.progress + e.safeguard.amount); sg.secured = sg.progress >= t; }
    }
  });
  s.log.push(`${history.length} dated history card(s) face up from before ${s.year}: decisions made before anyone here sat down.`);
}

// ── cards lookup helper (both the engine and the UI/sim need this; kept here so there is one) ──
export function indexCards(cards) {
  const byId = {};
  ['history', 'events', 'research', 'clues'].forEach(k => (cards[k] || []).forEach(c => { byId[c.id] = c; }));
  return byId;
}

// ── round / year flow ─────────────────────────────────────────────────────────────────────────
function raceDraws(race) { return race < 3 ? 1 : race < 6 ? 2 : 3; }

function reshuffleIfEmpty(deck, discard, rng) {
  if (deck.length) return deck;
  const fresh = shuffle(discard.slice(), rng);
  discard.length = 0;
  return fresh;
}

export function startRound(state, cards) {
  const s = state;
  if (s.ended) return s;
  // Drift's decay and Automated research's ongoing rise both apply based on what happened in the
  // round that JUST finished, so they are read before that flag resets for the new round.
  const auditedLastRound = s.auditCalledThisRound;
  if (s.rsiHasFired && s.world.alignmentDynamics === 'drift') applyDrift(s, auditedLastRound);
  if (s.automatedResearchActive) applyAutomatedResearchTick(s);
  s.auditCalledThisRound = false;

  s.round += 1;
  s.year = s.yearStart + (s.round - 1);
  if (s.year > s.endYear) {
    if (s.automatedResearchActive && !s.ended) {
      const card = { title: 'Automated research: the tree resolves at the end of the game' };
      const res = applyLeafResolution(s, card);
      s.lastRSI = { title: card.title, fired: true, ...res };
    }
    if (!s.ended) endGame(s, 'timeout', 'The game reached the end of ' + s.endYear + ' without a resolving event.');
    return s;
  }
  const rng = rngFrom((s.seed ^ (s.round * 0x9E3779B9)) >>> 0);
  s.players.forEach(p => {
    let gain = 1 + (s.publishBonusNextRound || 0);
    if (p.role === 'ceo') gain += 1;
    p.compute += gain;
    p.actionsLeft = 3;
  });
  s.publishBonusNextRound = 0;
  s.turnIndex = 0;
  s.auditArmed = false; s.auditUsedThisRound = false;

  if (!s.rsiInjected && s.year >= s.rsiStartYear) {
    s.eventDeck = shuffle([...s.eventDeck, ...s.rsiPool], rng);
    s.rsiInjected = true;
    s.log.push(`${s.year}: from now on, RSI cards are shuffled into the event deck (they fizzle below capability ${s.rsiThreshold}).`);
  }
  if (s.clueDeck.length) {
    const clueId = s.clueDeck.shift();
    s.cluesRevealed.push(clueId);
    const clue = cards.__byId[clueId];
    if (clue) s.log.push(`Clue: ${clue.text}`);
  }
  const n = raceDraws(s.race);
  s.log.push(`Year ${s.year} (round ${s.round}): compute +1 for everyone (more for a CEO or a publish bonus); drawing ${n} event card(s).`);
  for (let i = 0; i < n && !s.ended; i++) drawEvent(s, cards, rng);
  return s;
}

// ── Drift and Automated research: the two World effects that tick between rounds ────────────────
function applyDrift(s, auditedLastRound) {
  if (auditedLastRound) { s.log.push('Drift: an audit last year holds the alignment safeguard steady.'); return; }
  const sg = s.safeguards.alignment;
  if (sg.progress <= 0) return;
  if (sg.shield > 0) { sg.shield -= 1; s.log.push('Drift: a policy advisor\'s shield blocks this year\'s decay.'); return; }
  sg.progress -= 1; sg.secured = sg.progress >= safeguardTarget('alignment');
  s.log.push(`Drift: with no audit last year, alignment progress falls to ${sg.progress}/${safeguardTarget('alignment')}.`);
}
function applyAutomatedResearchTick(s) {
  if (!s.capabilityFrozen) { s.capability += AUTOMATED_RESEARCH_CAPABILITY; }
  if (!s.raceCapped) { s.race += AUTOMATED_RESEARCH_RACE; }
  s.log.push(`Automated research: capability +${AUTOMATED_RESEARCH_CAPABILITY}, race +${AUTOMATED_RESEARCH_RACE}, ticking on its own.`);
}

function drawEvent(state, cards, rng) {
  const s = state;
  s.eventDeck = reshuffleIfEmpty(s.eventDeck, s.eventDiscard, rng);
  if (!s.eventDeck.length) return;
  const id = s.eventDeck.shift();
  const card = cards.__byId[id];
  if (!card) return;
  s.log.push(`Event: ${card.title}${card.hypothetical ? ' (hypothetical)' : ''}${card.speculation ? ' [SPECULATION]' : ''}`);
  applyEventEffect(state, card, cards);
}

function applyEventEffect(state, card, cards) {
  const s = state;
  const e = card.effect || {};
  if (card.type === 'capability_jump') {
    const jump = e.race || 1;
    if (!s.raceCapped) s.race += jump; else s.log.push(`(the race is capped: no rise)`);
    const recycled = s.eventDiscard.filter(id => (cards.__byId[id] || {}).type === 'incident');
    if (recycled.length) {
      s.eventDiscard = s.eventDiscard.filter(id => !recycled.includes(id));
      s.eventDeck = [...recycled, ...s.eventDeck];
      s.log.push(`The same weak spots fail again: ${recycled.length} past incident(s) return to the top of the event deck.`);
    }
    s.eventDiscard.push(card.id);
  } else if (card.type === 'incident') {
    s.eventDiscard.push(card.id);
  } else if (card.type === 'safeguard_setback') {
    const sg = s.safeguards[e.safeguard];
    if (sg && sg.progress > 0 && !sg.secured) {
      if (sg.shield > 0) { sg.shield -= 1; s.log.push(`${SAFEGUARD_LABEL[e.safeguard]}: a policy advisor's shield blocks this setback.`); }
      else { sg.progress -= 1; s.log.push(`${SAFEGUARD_LABEL[e.safeguard]}: progress falls to ${sg.progress}/${safeguardTarget(e.safeguard)}.`); }
    }
    s.eventDiscard.push(card.id);
  } else if (card.type === 'breather') {
    if (e.safeguard) { const sg = s.safeguards[e.safeguard]; const t = safeguardTarget(e.safeguard); sg.progress = Math.min(t, sg.progress + 1); sg.secured = sg.progress >= t; }
    if (e.race) s.race = Math.max(0, s.race - e.race);
    s.eventDiscard.push(card.id);
  } else if (card.type === 'rsi') {
    resolveRSI(state, card);
  } else {
    s.eventDiscard.push(card.id);
  }
}

// ── RSI resolution ────────────────────────────────────────────────────────────────────────────
function safeguardAnswer(state, id) {
  const sg = state.safeguards[id];
  if (sg.secured) return { answer: 'yes', cast: false };
  if (sg.progress === 0) return { answer: 'no', cast: false };
  const odds = sg.progress / safeguardTarget(id);
  const u = drawValue(state.seed, state.drawN); state.drawN += 1;
  return { answer: u < odds ? 'yes' : 'no', cast: true, odds, u };
}

// Alignment's answer for the tree, reading the World's alignment-dynamics theory: Goal-keeping
// locks in whatever alignment's status was AT THE FIRST RSI FIRE, for good; Verifiable reads any
// partial progress as enough. Neither theory is asserted true — the World is still face down.
function alignmentAnswerForLeaf(state) {
  const dyn = state.world.alignmentDynamics;
  if (dyn === 'goalkeeping') {
    if (state.world.alignmentLocked === null) state.world.alignmentLocked = state.safeguards.alignment.secured;
    return { answer: state.world.alignmentLocked ? 'yes' : 'no', cast: false, locked: true };
  }
  if (dyn === 'verifiable' && state.safeguards.alignment.progress > 0) return { answer: 'yes', cast: false, verifiable: true };
  return safeguardAnswer(state, 'alignment');
}

function applyLeafResolution(state, card) {
  const s = state;
  const alignment = alignmentAnswerForLeaf(s);
  const containment = safeguardAnswer(s, 'containment');
  const leaf = leafFor({ alignment: alignment.answer, containment: containment.answer });
  const tags = [alignment.cast && 'cast on partial progress', alignment.locked && 'locked by Goal-keeping', alignment.verifiable && 'partly built counts, under Verifiable'].filter(Boolean).join('; ');
  s.log.push(`${card.title}: the tree resolves. Alignment reads ${alignment.answer}${tags ? ' (' + tags + ')' : ''}, containment reads ${containment.answer}${containment.cast ? ' (cast on partial progress)' : ''} -> ${LAB_LEAF_LABEL[leaf]}.`);
  if (leaf === 'proceed') endGame(s, 'proceed', 'Both safeguards held: the best ending.');
  else if (leaf === 'regulate') { s.raceCapped = true; s.log.push('The game continues under strict rules: the race is capped.'); }
  else if (leaf === 'contain') { s.capabilityFrozen = true; s.race = Math.max(0, s.race - CATASTROPHE_SETBACK); s.log.push('Capability is frozen and the race is pushed back. The game continues.'); }
  else if (leaf === 'shutdown') endGame(s, 'catastrophe', 'Neither safeguard held: catastrophe. Everyone loses, whatever their objective.');
  if (!s.worldRevealed) revealWorld(s);
  return { leaf, alignment, containment };
}

// The three Takeoff theories change RSI's own firing/resolution, not the leaf mapping itself:
//   Plateau       — every RSI card fizzles, permanently; the race eases by 1 the first time.
//   Singularity   — capability spikes within the year, and the tree resolves right away (the plain
//                   default once RSI actually fires).
//   Automated research — the FIRST fire does not resolve the tree; instead capability and the race
//                   keep climbing on their own every remaining year, and the tree only resolves at
//                   the game's end (see startRound's END_YEAR check).
export function resolveRSI(state, card) {
  const s = state;
  if (s.world.takeoff === 'plateau') {
    if (!s.plateauTriggered) { s.plateauTriggered = true; s.race = Math.max(0, s.race - 1); s.log.push(`${card.title}: fizzles for good — this World is a Plateau. The race eases by 1.`); }
    else s.log.push(`${card.title}: fizzles, as every RSI card does under a Plateau.`);
    s.eventDiscard.push(card.id);
    s.lastRSI = { title: card.title, fired: false, reason: 'plateau' };
    return { fired: false };
  }
  if (s.capability < s.rsiThreshold) {
    s.log.push(`${card.title}: fizzles — capability ${s.capability} is below the threshold ${s.rsiThreshold}, so it does not fire.`);
    s.eventDiscard.push(card.id);
    s.lastRSI = { title: card.title, fired: false, reason: 'below-threshold', capability: s.capability, threshold: s.rsiThreshold };
    return { fired: false };
  }
  // Goal-keeping locks in whatever alignment's status is AT THIS MOMENT — the first fire — not
  // whenever the leaf happens to finally get computed (which, under Automated research, could be
  // many years later). "Only secured BEFORE RSI fires counts" means before THIS.
  if (!s.rsiHasFired && s.world.alignmentDynamics === 'goalkeeping') s.world.alignmentLocked = s.safeguards.alignment.secured;
  s.rsiHasFired = true;
  s.eventDiscard.push(card.id);
  if (s.world.takeoff === 'singularity') {
    s.capability += SINGULARITY_JUMP;
    s.log.push(`${card.title}: fires. Singularity: capability jumps by ${SINGULARITY_JUMP} within the year.`);
    const res = applyLeafResolution(s, card);
    s.lastRSI = { title: card.title, fired: true, ...res };
    return { fired: true, ...res };
  }
  if (s.world.takeoff === 'automated_research') {
    if (!s.automatedResearchActive) {
      s.automatedResearchActive = true;
      s.log.push(`${card.title}: fires, but under Automated research the tree does not resolve yet — capability and the race climb on their own every remaining year, and the tree resolves at the end of the game.`);
      if (!s.worldRevealed) revealWorld(s);
    } else {
      s.log.push(`${card.title}: fires again, but Automated research is already ticking on its own.`);
    }
    s.lastRSI = { title: card.title, fired: true, deferred: true };
    return { fired: true, deferred: true };
  }
  const res = applyLeafResolution(s, card);
  s.lastRSI = { title: card.title, fired: true, ...res };
  return { fired: true, ...res };
}

function endGame(state, type, reason) {
  state.ended = { type, year: state.year, reason };
  state.log.push(`GAME OVER (${type}): ${reason}`);
  if (!state.worldRevealed) revealWorld(state);
}

// ── the reveal ────────────────────────────────────────────────────────────────────────────────
// Flips both World cards with a plain explanation and, where one exists, a source link. Labelled
// as arguments about how a takeoff or alignment might go, not settled facts.
export function revealWorld(state) {
  const s = state;
  if (s.worldRevealed) return s.worldRevealInfo;
  s.worldRevealed = true;
  const takeoff = { id: s.world.takeoff, ...WORLD_INFO.takeoff[s.world.takeoff] };
  const alignmentDynamics = { id: s.world.alignmentDynamics, ...WORLD_INFO.alignmentDynamics[s.world.alignmentDynamics] };
  s.worldRevealInfo = {
    takeoff, alignmentDynamics,
    cluesSeen: s.cluesRevealed.length,
    note: 'Both cards are arguments about how a takeoff or an alignment dynamic might go, not settled facts; the clues drawn along the way never proved either one.',
  };
  s.log.push(`The World is revealed: Takeoff = ${takeoff.name}; Alignment dynamics = ${alignmentDynamics.name}.`);
  return s.worldRevealInfo;
}

// The interpreter may look at ONE World card, once per game, privately (the return value is for
// the UI to show only to them; nothing is logged and worldRevealed stays false).
export function peekWorldCard(state, playerId, which) {
  const p = activePlayer(state);
  if (!p || p.id !== playerId) throw new Error(`It is not ${playerId}'s turn.`);
  if (p.role !== 'interpreter') throw new Error('Only the interpretability researcher can peek at the World.');
  if (p.worldPeekUsed) throw new Error('The interpreter has already used their one World peek this game.');
  if (which !== 'takeoff' && which !== 'alignmentDynamics') throw new Error('Peek at "takeoff" or "alignmentDynamics".');
  const s = clone(state);
  const pp = findPlayer(s, playerId);
  pp.worldPeekUsed = true;
  const value = s.world[which];
  return { state: s, category: which, value, info: WORLD_INFO[which][value] };
}

// ── belief bets ───────────────────────────────────────────────────────────────────────────────
// Placed secretly, via the reveal screen (the UI never shows this call to anyone but the player
// making it); not a turn action, so it never touches actionsLeft or the turn order.
export function placeBeliefToken(state, playerId, category, value) {
  if (category !== 'takeoff' && category !== 'alignmentDynamics') throw new Error('Bet on "takeoff" or "alignmentDynamics".');
  const list = category === 'takeoff' ? TAKEOFF_WORLDS : ALIGNMENT_DYNAMICS_WORLDS;
  if (!list.includes(value)) throw new Error(`"${value}" is not a ${category} World.`);
  const s = clone(state);
  const p = findPlayer(s, playerId);
  if (!p) throw new Error('No such player.');
  if (p.beliefTokensLeft <= 0) throw new Error(`${p.name} has no belief tokens left.`);
  p.beliefTokensLeft -= 1;
  p.beliefBets.push({ category, value });
  return s;
}

// ── hidden information ────────────────────────────────────────────────────────────────────────
// What a given player is allowed to see: their own hand and objective in full; every other
// player's hand is collapsed to a count, and their objective is hidden entirely. Roles and public
// counters (compute, company value, published count) are public, as in Forbidden Island.
// The hidden World cards (Clue's envelope) are never in ANY player's view before revealWorld()
// has run, whoever asks: they are not tied to one player, they are face down on the table.
export function viewFor(state, playerId) {
  const { world, ...rest } = state;
  return {
    ...rest,
    world: state.worldRevealed ? world : null,
    players: state.players.map(p => p.id === playerId ? { ...p } : {
      id: p.id, name: p.name, role: p.role, bloc: p.bloc, compute: p.compute,
      companyValue: p.companyValue, publishedCount: p.publishedCount, milestonesTriggered: p.milestonesTriggered,
      handCount: p.hand.length, actionsLeft: p.actionsLeft, whistleblowUsed: p.whistleblowUsed,
      beliefTokensLeft: p.beliefTokensLeft,
    }),
  };
}

// ── turn helpers ──────────────────────────────────────────────────────────────────────────────
export function activePlayer(state) { return state.players[state.turnIndex]; }
function findPlayer(state, id) { return state.players.find(p => p.id === id); }
function requireActive(state, playerId) {
  const p = activePlayer(state);
  if (!p || p.id !== playerId) throw new Error(`It is ${p ? p.name : 'no one'}'s turn, not ${playerId}'s.`);
  return p;
}
function spendAction(state, cards) {
  const p = activePlayer(state);
  p.actionsLeft -= 1;
  if (p.actionsLeft <= 0) endTurn(state, cards);
}
export function endTurn(state, cards) {
  const s = state;
  s.turnIndex = (s.turnIndex + 1) % s.players.length;
  s.players[s.turnIndex].actionsLeft = s.players[s.turnIndex].actionsLeft || 3;
  if (s.turnIndex === 0 && !s.ended) startRound(s, cards);
}
export function pass(state, playerId, cards) {
  const s = clone(state);
  requireActive(s, playerId);
  s.log.push(`${findPlayer(s, playerId).name} passes.`);
  spendAction(s, cards);
  return s;
}

function bumpCapability(state, actingPlayer, amount) {
  const s = state;
  let n = amount;
  if (s.auditArmed && !s.auditUsedThisRound) { n = Math.max(0, n - 1); s.auditUsedThisRound = true; s.auditArmed = false; s.log.push('An audit reduces this capability step by 1.'); }
  if (!s.capabilityFrozen) { s.capability += n; s.blocCapability[actingPlayer.bloc] = (s.blocCapability[actingPlayer.bloc] || 0) + n; }
  else s.log.push('Capability is frozen: this step adds nothing to the board.');
  return n;
}

// ── actions ───────────────────────────────────────────────────────────────────────────────────
export function research(state, playerId, cards) {
  const s = clone(state);
  requireActive(s, playerId);
  const rng = rngFrom((s.seed ^ (s.drawN * 0x85EBCA6B)) >>> 0); s.drawN += 1;
  s.researchDeck = reshuffleIfEmpty(s.researchDeck, s.researchDiscard, rng);
  const p = findPlayer(s, playerId);
  if (s.researchDeck.length) { const id = s.researchDeck.shift(); p.hand.push(id); s.log.push(`${p.name} researches: draws a card.`); }
  else s.log.push(`${p.name} researches, but the deck and discard are both empty.`);
  spendAction(s, cards);
  return s;
}

export function build(state, playerId, cardId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  if (p.compute < 1) throw new Error(`${p.name} has no compute to build with.`);
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new Error(`${p.name} does not hold that card.`);
  p.hand.splice(i, 1);
  s.researchDiscard.push(cardId);   // spent, not vanished: the deck reshuffles from here when empty
  p.compute -= 1;
  const gained = bumpCapability(s, p, 1);
  p.companyValue += 1;
  p.milestonesTriggered += gained > 0 ? 1 : 0;
  s.log.push(`${p.name} builds: capability +${gained}, company value +1.`);
  if (s.world.alignmentDynamics === 'selection' && s.year >= RSI_START_YEAR) {
    const sg = s.safeguards.alignment;
    if (sg.progress > 0 && !sg.secured) {
      if (sg.shield > 0) { sg.shield -= 1; s.log.push('Selection pressure: a policy advisor\'s shield blocks this Build\'s cost to alignment.'); }
      else { sg.progress -= 1; s.log.push(`Selection pressure: this purely capability-driven Build costs alignment 1 progress (now ${sg.progress}/${safeguardTarget('alignment')}).`); }
    }
  }
  spendAction(s, cards);
  return s;
}

export function releaseModel(state, playerId, responses, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  if (p.compute < 2) throw new Error(`${p.name} needs 2 compute to release a frontier model.`);
  p.compute -= 2;
  let capGain = 2, raceGain = 1;
  (responses || []).forEach(r => {
    const responder = findPlayer(s, r.responderId);
    if (!responder) return;
    if (r.type === 'audit' && responder.role === 'redTeamer' && !s.auditUsedThisRound) {
      capGain = Math.max(0, capGain - 1); s.auditUsedThisRound = true; s.auditCalledThisRound = true;
      s.log.push(`${responder.name} audits the release: capability step reduced by 1.`);
    } else if (r.type === 'whistleblow' && responder.role === 'whistleblower' && !responder.whistleblowUsed) {
      responder.whistleblowUsed = true; raceGain = Math.max(0, raceGain - 1);
      s.log.push(`${responder.name} blows the whistle: the race rise from this release is blunted by 1.`);
    }
  });
  const gained = bumpCapability(s, p, capGain);
  if (!s.raceCapped) s.race += raceGain; else s.log.push('(the race is capped: no rise)');
  p.companyValue += 2;
  p.milestonesTriggered += gained > 0 ? 1 : 0;
  s.log.push(`${p.name} releases a frontier model: capability +${gained}, race +${s.raceCapped ? 0 : raceGain}.`);
  spendAction(s, cards);
  return s;
}

export function secure(state, playerId, cardIds, safeguardId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  if (!SAFEGUARDS.includes(safeguardId)) throw new Error('No such safeguard: ' + safeguardId);
  const sg = s.safeguards[safeguardId];
  if (sg.secured) throw new Error(`${SAFEGUARD_LABEL[safeguardId]} is already secured.`);
  const byId = cards.__byId;
  const need = safeguardTarget(safeguardId) - sg.progress;
  const use = (cardIds || []).slice(0, need);
  for (const id of use) {
    if (p.hand.indexOf(id) < 0) throw new Error(`${p.name} does not hold card ${id}.`);
    const c = byId[id];
    if (!c || (c.suit !== safeguardId && c.suit !== 'wild')) throw new Error(`Card ${id} does not match ${safeguardId}.`);
  }
  if (!use.length) throw new Error('No matching cards offered.');
  const doubled = safeguardId === 'alignment' && s.world.alignmentDynamics === 'verifiable';
  use.forEach(id => { p.hand.splice(p.hand.indexOf(id), 1); s.researchDiscard.push(id); });
  let gain = use.length;
  if (doubled) {
    gain = use.reduce((n, id) => n + (byId[id].suit === 'alignment' ? 2 : 1), 0);
    s.log.push('Verifiable: interpretability (alignment-suit) cards count double toward alignment.');
  }
  sg.progress = Math.min(safeguardTarget(safeguardId), sg.progress + gain);
  sg.secured = sg.progress >= safeguardTarget(safeguardId);
  if (!sg.contributors.includes(playerId)) sg.contributors.push(playerId);
  if (p.role === 'policyAdvisor' && sg.shield === 0) sg.shield = 1;
  s.log.push(`${p.name} secures toward ${SAFEGUARD_LABEL[safeguardId]}: ${use.length} card(s), now ${sg.progress}/${safeguardTarget(safeguardId)}${sg.secured ? ' — SECURED' : ''}.`);
  spendAction(s, cards);
  return s;
}

export function publish(state, playerId, cardId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new Error(`${p.name} does not hold that card.`);
  p.hand.splice(i, 1);
  s.published.push(cardId);
  p.publishedCount += 1;
  const bonus = p.role === 'openSourceBuilder' ? 2 : 1;
  s.publishBonusNextRound += bonus;
  s.log.push(`${p.name} publishes: open to everyone. Next year, every player's compute gets +${bonus} on top of the usual +1.`);
  spendAction(s, cards);
  return s;
}

export function lobby(state, playerId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  const sg = s.safeguards.agreement;
  if (!sg.secured) { const t = safeguardTarget('agreement'); sg.progress = Math.min(t, sg.progress + 1); sg.secured = sg.progress >= t; }
  s.log.push(`${p.name} lobbies: ${SAFEGUARD_LABEL.agreement} now ${sg.progress}/${safeguardTarget('agreement')}${sg.secured ? ' — SECURED' : ''}.`);
  spendAction(s, cards);
  return s;
}

export function trade(state, fromId, toId, cardIds, cards) {
  const s = clone(state);
  const from = requireActive(s, fromId);
  const to = findPlayer(s, toId);
  if (!to) throw new Error('No such player.');
  if (from.bloc !== to.bloc) throw new Error(`${from.name} and ${to.name} do not share a bloc: trade needs their consent (pass consent:true from the UI once given).`);
  (cardIds || []).forEach(id => {
    const i = from.hand.indexOf(id);
    if (i < 0) throw new Error(`${from.name} does not hold card ${id}.`);
    from.hand.splice(i, 1); to.hand.push(id);
  });
  s.log.push(`${from.name} trades ${cardIds.length} card(s) to ${to.name}.`);
  spendAction(s, cards);
  return s;
}
export function tradeWithConsent(state, fromId, toId, cardIds, cards) {
  const s = clone(state);
  const from = requireActive(s, fromId);
  const to = findPlayer(s, toId);
  if (!to) throw new Error('No such player.');
  (cardIds || []).forEach(id => {
    const i = from.hand.indexOf(id);
    if (i < 0) throw new Error(`${from.name} does not hold card ${id}.`);
    from.hand.splice(i, 1); to.hand.push(id);
  });
  s.log.push(`${from.name} trades ${cardIds.length} card(s) to ${to.name}, by agreement.`);
  spendAction(s, cards);
  return s;
}

// ── role powers ───────────────────────────────────────────────────────────────────────────────
// Free: the interpreter's peek does not spend a turn.
export function peekEvent(state) {
  const p = activePlayer(state);
  if (p.role !== 'interpreter') throw new Error('Only the interpretability researcher can peek.');
  return state.eventDeck[0] || null;
}
export function peekSafeguardOdds(state, safeguardId) {
  const p = activePlayer(state);
  if (p.role !== 'interpreter') throw new Error('Only the interpretability researcher can peek.');
  const sg = state.safeguards[safeguardId];
  return sg.secured ? 1 : sg.progress / safeguardTarget(safeguardId);
}

export function auditCapabilityStep(state, playerId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  if (p.role !== 'redTeamer') throw new Error('Only the evals / red-teamer can audit.');
  if (s.auditUsedThisRound) throw new Error('The audit for this round has already been used.');
  s.auditArmed = true; s.auditCalledThisRound = true;
  s.log.push(`${p.name} audits: the next capability step this round is reduced by 1.`);
  spendAction(s, cards);
  return s;
}

export function useWhistleblower(state, playerId, mode, targetId, cards) {
  const s = clone(state);
  const p = requireActive(s, playerId);
  if (p.role !== 'whistleblower') throw new Error('Only the whistleblower can do this.');
  if (p.whistleblowUsed) throw new Error('The whistleblower has already used their one reveal or forced audit this game.');
  p.whistleblowUsed = true;
  if (mode === 'reveal') {
    const t = findPlayer(s, targetId);
    s.log.push(`${p.name} reveals ${t ? t.name : targetId}'s hand to the table.`);
  } else {
    s.auditArmed = true; s.auditCalledThisRound = true;
    s.log.push(`${p.name} forces an audit, as if a red-teamer had.`);
  }
  spendAction(s, cards);
  return s;
}

// ── scoring ───────────────────────────────────────────────────────────────────────────────────
// A belief token placed on a World value that turns out true is +1 to that player's objective
// score (a numeric `points`, on top of the objective's own boolean `won`); the correct-bet count
// also feeds the Forecaster objective. If the World was never revealed (a game stopped mid-way,
// in a test), correctBets reads 0 for everyone rather than guessing.
function correctBetsFor(state, player) {
  if (!state.worldRevealed || !state.world) return 0;
  return (player.beliefBets || []).filter(b => state.world[b.category] === b.value).length;
}
export function scoreGame(state) {
  const s = state;
  const correctBets = s.players.map(p => correctBetsFor(s, p));
  const maxCorrectBets = Math.max(0, ...correctBets);
  if (s.ended && s.ended.type === 'catastrophe') {
    return {
      catastrophe: true,
      results: s.players.map((p, i) => ({ id: p.id, name: p.name, objective: p.objective, won: false, points: 0, correctBets: correctBets[i] })),
    };
  }
  const securedCount = SAFEGUARDS.filter(k => s.safeguards[k].secured).length;
  const maxCompany = Math.max(0, ...s.players.map(p => p.companyValue));
  const maxPublished = Math.max(0, ...s.players.map(p => p.publishedCount));
  const maxMilestones = Math.max(0, ...s.players.map(p => p.milestonesTriggered));
  const blocEntries = Object.entries(s.blocCapability).sort((a, b) => b[1] - a[1]);
  const leadingBloc = blocEntries.length ? blocEntries[0][0] : null;
  const results = s.players.map((p, i) => {
    let won = false;
    if (p.objective === 'profit') won = p.companyValue === maxCompany && maxCompany > 0;
    else if (p.objective === 'humanity') won = securedCount >= 4;
    else if (p.objective === 'nation') won = leadingBloc != null && p.bloc === leadingBloc;
    else if (p.objective === 'openScience') won = p.publishedCount === maxPublished && maxPublished > 0;
    else if (p.objective === 'curiosity') won = p.milestonesTriggered === maxMilestones && maxMilestones > 0;
    else if (p.objective === 'forecaster') won = correctBets[i] === maxCorrectBets && maxCorrectBets > 0;
    return { id: p.id, name: p.name, objective: p.objective, won, points: (won ? 1 : 0) + correctBets[i], correctBets: correctBets[i] };
  });
  return { catastrophe: false, securedCount, results };
}
