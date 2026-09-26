// The Tree: the board game's engine. Pure logic, no DOM, no dependencies beyond the two shared
// modules below. Node can import it directly (tests/tree-board.test.mjs).
//
// Reuses, on purpose:
//   - leafFor, NODES, LEAF_LABEL, ANSWER_WORD from the Film's shared tree renderer
//     (explainers/belief-tree/tree-render.js) — the same mapping and words the tree itself uses,
//     so this game can never disagree with the drawing about which leaf an alignment/containment
//     pair lands on, or what a person's own answer is called.
//   - METHODS, kindFrom, drawValue, isFirm, randomSeed, rngFrom from The Fork's cast engine
//     (game/fork/fork-engine.js) — the same coin and yarrow odds The Fork uses. This file does not
//     define a second random number generator or a second I Ching bowl.
//
// The board: everyone starts at `gate`, then crosses to `alignment`, then to whichever containment
// node their (possibly just-resolved) alignment answer opens, then to a leaf. Node ids match
// tree-render.js's NODES exactly, so a character's `pos` can be passed straight to nodeRect() to
// place a token over the SVG.
//
// A turn is one action by the active player: cross your own character's next node (`attemptMove`),
// play one evidence card on any character (`playEvidence`), or `pass`. Naming a split (`nameSplit`)
// is a free action, available any time once every character has reached a leaf, and does not use up
// a turn. The race track ticks once every time the turn order wraps around (a "round"), and once
// more the moment any token first reaches Proceed (a design choice, not just the clock: shipping
// speeds the pace for everyone, not only for the one who shipped).

import { leafFor, NODES, LEAF_LABEL, ANSWER_WORD } from '../../explainers/belief-tree/tree-render.js';
import { METHODS, kindFrom, drawValue, isFirm, randomSeed, rngFrom } from '../fork/fork-engine.js';

export const LEAVES = ['proceed', 'regulate', 'contain', 'shutdown'];
export const RACE_LIMIT = 8;
export const CAST_METHODS = ['coin', 'yarrow'];   // + 'unknown' ("I don't know"), handled separately

const clone = x => JSON.parse(JSON.stringify(x));
const NODE_TITLE = (() => {
  const m = {};
  (NODES || []).forEach(n => { m[n.id] = n.title; });
  return m;
})();

export const isPlainAnswer = a => a === 'yes' || a === 'no';
export const wordFor = a => (a == null ? 'not addressed' : (ANSWER_WORD[a] || String(a)));
export const leafName = leaf => (LEAF_LABEL && LEAF_LABEL[leaf]) || leaf;

// ── people → characters ────────────────────────────────────────────────────────────────────────
// Characters "outside the tree" (stated_leaf === 'outside', e.g. someone who never takes up the
// tree's questions) are not dealt: their two answers don't move them through gate/alignment/
// containment the way the rest of the deck's do. Documented choice for this first playable version;
// a later one could deal them in as a stated reason instead of redrawing.
export function dealablePeople(people) {
  return (people || []).filter(p => p && p.stated_leaf !== 'outside');
}

export function buildCharacter(person) {
  return {
    slug: person.slug,
    name: person.name,
    short: person.short || person.name,
    role: person.role || '',
    raw: {
      gate: (person.gate && person.gate.answer) || null,
      alignment: (person.alignment && person.alignment.answer) || null,
      containment: (person.containment && person.containment.answer) || null,
    },
    basis: {
      gate: (person.gate && person.gate.basis) || null,
      alignment: (person.alignment && person.alignment.basis) || null,
      containment: (person.containment && person.containment.basis) || null,
    },
    to_move: person.to_move || [],
    card_quote_ids: person.card_quote_ids || [],
    stated_leaf: person.stated_leaf || null,
    pos: 'gate',
    resolved: { gate: null, alignment: null, containment: null },
    tag: { gate: null, alignment: null, containment: null },   // 'own' | 'coin' | 'yarrow' | 'evidence-open' | 'evidence-plain'
  };
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── setup ──────────────────────────────────────────────────────────────────────────────────────
export function newGame({ people, playerCount, seed, evidence }) {
  const s0 = seed == null ? randomSeed() : (seed >>> 0);
  const rng = rngFrom(s0);
  const pool = shuffle(dealablePeople(people), rng);
  const n = Math.max(2, Math.min(5, playerCount || 2, pool.length));
  const characters = pool.slice(0, n).map(buildCharacter);
  const deck = shuffle((evidence || []).map(c => c.id), rng);
  return {
    seed: s0, drawN: 0,
    characters, turnIndex: 0, round: 0,
    race: 0, raceLimit: RACE_LIMIT,
    deck, discard: [],
    namedSplits: [],
    log: [`New game: ${characters.length} players, seed ${s0}.`],
    ended: null,
  };
}

// ── position / fields ──────────────────────────────────────────────────────────────────────────
export function fieldForPos(pos) {
  if (pos === 'gate') return 'gate';
  if (pos === 'alignment') return 'alignment';
  if (pos === 'containment-if-aligned' || pos === 'containment-if-not') return 'containment';
  return null;   // a leaf: nothing left to cross
}
function nodeIdForField(field, resolved) {
  if (field === 'gate') return 'gate';
  if (field === 'alignment') return 'alignment';
  return resolved.alignment === 'yes' ? 'containment-if-aligned' : 'containment-if-not';
}
function advance(ch, field) {
  if (field === 'gate') { ch.pos = 'alignment'; return; }
  if (field === 'alignment') { ch.pos = ch.resolved.alignment === 'yes' ? 'containment-if-aligned' : 'containment-if-not'; return; }
  ch.pos = leafFor({ alignment: ch.resolved.alignment, containment: ch.resolved.containment });
}
export function allLeafed(state) { return state.characters.every(c => LEAVES.includes(c.pos)); }
function activeCharacter(state) { return state.characters[state.turnIndex]; }

function castAnswer(method, seed, n) {
  const kind = kindFrom(method, drawValue(seed, n));
  return isFirm(kind) ? 'yes' : 'no';
}

function endTurn(s) {
  s.turnIndex = (s.turnIndex + 1) % s.characters.length;
  if (s.turnIndex === 0) {
    s.round += 1;
    s.race += 1;
    s.log.push(`Round ${s.round}: the race advances to ${s.race}/${s.raceLimit}.`);
  }
}

// ── splits ─────────────────────────────────────────────────────────────────────────────────────
// The node where two (both-leafed) characters' paths part: the first place their resolved answers
// differ. Gate never decides a leaf, so a split is always at alignment or at whichever containment
// node their (equal) alignment answer opened.
function splitNodeFor(a, b) {
  if (a.resolved.alignment !== b.resolved.alignment) return 'alignment';
  return a.resolved.alignment === 'yes' ? 'containment-if-aligned' : 'containment-if-not';
}
export function activeSplitNodes(state) {
  const leafed = state.characters.filter(c => LEAVES.includes(c.pos));
  const set = new Set();
  for (let i = 0; i < leafed.length; i++) {
    for (let j = i + 1; j < leafed.length; j++) {
      if (leafed[i].pos !== leafed[j].pos) set.add(splitNodeFor(leafed[i], leafed[j]));
    }
  }
  return [...set];
}

function checkEnd(s) {
  if (s.ended) return;
  if (allLeafed(s)) {
    const need = activeSplitNodes(s);
    const named = new Set(s.namedSplits);
    if (need.every(n => named.has(n))) {
      s.ended = {
        result: 'win',
        reason: need.length === 0
          ? 'Every character stands on one shared leaf.'
          : 'Every split between the leaves has been named.',
      };
      s.log.push(`The table wins: ${s.ended.reason}`);
      return;
    }
  }
  if (s.race >= s.raceLimit) {
    s.ended = { result: 'lose', reason: 'The race filled before the table finished naming where everyone stands.' };
    s.log.push(`The table loses: ${s.ended.reason}`);
  }
}

// ── moving ─────────────────────────────────────────────────────────────────────────────────────
// method is required only when the character's own answer at this node is not a plain yes/no:
// 'coin' | 'yarrow' cast (The Fork's engine decides the result); 'unknown' ("I don't know") is
// always legal and leaves the node open — a turn spent, no advance.
export function attemptMove(state, slug, method) {
  const s = clone(state);
  if (s.ended) return { state: s, error: 'The game is over.' };
  const ch = s.characters.find(c => c.slug === slug);
  if (!ch) return { state: s, error: 'No such character.' };
  if (slug !== activeCharacter(s).slug) return { state: s, error: `It is ${activeCharacter(s).short}'s turn, not ${ch.short}'s.` };
  const field = fieldForPos(ch.pos);
  if (!field) return { state: s, error: `${ch.short} has already reached a leaf.` };

  let casting = null;
  if (ch.resolved[field] != null) {
    // pre-set by an evidence card while still open: cross on it, no new cast needed
    s.log.push(`${ch.short}: ${field}, crosses on the answer evidence already set (${wordFor(ch.resolved[field])}).`);
    advance(ch, field);
  } else {
    const raw = ch.raw[field];
    if (isPlainAnswer(raw)) {
      ch.resolved[field] = raw; ch.tag[field] = 'own';
      s.log.push(`${ch.short}: ${field}, ${wordFor(raw)}, their own answer.`);
      advance(ch, field);
    } else if (method === 'unknown') {
      casting = { node: nodeIdForField(field, ch.resolved), method: 'unknown', result: 'unknown' };
      s.log.push(`${ch.short}: ${field}, ${wordFor(raw)} → "I don't know": stays open.`);
    } else if (method === 'coin' || method === 'yarrow') {
      const result = castAnswer(method, s.seed, s.drawN); s.drawN += 1;
      casting = { node: nodeIdForField(field, ch.resolved), method, result };
      ch.resolved[field] = result; ch.tag[field] = method;
      s.log.push(`${ch.short}: ${field}, ${wordFor(raw)} → ${method}: ${result}.`);
      advance(ch, field);
    } else {
      return { state: clone(state), error: `${ch.short}'s ${field} answer is ${wordFor(raw)}: choose coin, yarrow, or "I don't know".` };
    }
  }
  if (field === 'containment' && ch.pos === 'proceed') {
    s.race += 1;
    s.log.push(`${ch.short} reaches Proceed: the race advances one more, to ${s.race}/${s.raceLimit}.`);
  }
  endTurn(s);
  checkEnd(s);
  return { state: s, casting };
}

export function pass(state) {
  const s = clone(state);
  if (s.ended) return { state: s, error: 'The game is over.' };
  s.log.push(`${activeCharacter(s).short} passes.`);
  endTurn(s);
  checkEnd(s);
  return { state: s };
}

// ── evidence ───────────────────────────────────────────────────────────────────────────────────
// Whether `card` may be played on `character` right now, and why. See game/tree-board/README or
// the PR body for the rule in full: an open (not plain yes/no) answer can always be flipped; a
// plain answer can be flipped only when the flip would send the character to a leaf that is one of
// their OWN stated to_move[] conditions — persuasion by their own terms, never invented.
export function evidenceLegality(card, character) {
  const field = card.node;
  if (character.resolved[field] != null) {
    return { legal: false, reason: `${character.short}'s ${field} answer is already settled for this game.` };
  }
  const raw = character.raw[field];
  if (!isPlainAnswer(raw)) {
    return { legal: true, reason: `${character.short}'s own answer here is still ${wordFor(raw)}.` };
  }
  const other = field === 'alignment' ? 'containment' : field === 'containment' ? 'alignment' : null;
  if (!other) {
    return { legal: false, reason: `${character.short}'s gate answer is settled, and the gate never decides which leaf they reach.` };
  }
  const otherRaw = character.resolved[other] != null ? character.resolved[other]
    : (isPlainAnswer(character.raw[other]) ? character.raw[other] : null);
  if (otherRaw == null) {
    return { legal: false, reason: `Not enough is known yet about ${character.short} to say where this flip would lead.` };
  }
  const hypothetical = field === 'alignment' ? { alignment: card.push, containment: otherRaw } : { alignment: otherRaw, containment: card.push };
  const leaf = leafFor(hypothetical);
  if (!leaf) return { legal: false, reason: `That combination does not name a leaf.` };
  const moveEntry = (character.to_move || []).find(m => m.to === leaf);
  if (!moveEntry) {
    return { legal: false, reason: `${character.short}'s ${field} answer is settled, and moving them to ${leafName(leaf)} is not a condition they have stated.` };
  }
  return { legal: true, leaf, reason: moveEntry.would_have_to_believe };
}

export function playEvidence(state, evidence, cardId, targetSlug) {
  const s = clone(state);
  if (s.ended) return { state: s, ok: false, reason: 'The game is over.' };
  const acting = activeCharacter(s);
  if (!s.deck.includes(cardId)) return { state: s, ok: false, reason: 'That card is not available.' };
  const card = (evidence || []).find(c => c.id === cardId);
  if (!card) return { state: s, ok: false, reason: 'Unknown card.' };
  const ch = s.characters.find(c => c.slug === targetSlug);
  if (!ch) return { state: s, ok: false, reason: 'No such character.' };
  const legality = evidenceLegality(card, ch);
  if (!legality.legal) return { state: s, ok: false, reason: legality.reason };

  ch.resolved[card.node] = card.push;
  ch.tag[card.node] = legality.leaf ? 'evidence-plain' : 'evidence-open';
  s.deck = s.deck.filter(id => id !== cardId);
  s.discard.push(cardId);
  const msg = legality.leaf
    ? `${ch.short}: ${card.node} flips to ${card.push} — evidence played by ${acting.short}: "${card.text}" (their own condition: ${legality.reason})`
    : `${ch.short}: ${card.node} flips to ${card.push} — evidence played by ${acting.short}: "${card.text}" (their answer here was still ${wordFor(ch.raw[card.node])})`;
  s.log.push(msg);
  endTurn(s);
  checkEnd(s);
  return { state: s, ok: true };
}

// A free action: mark a fork point as named once the table has looked at both characters' bases
// there. Available any time (does not consume a turn); harmless before everyone is leafed.
export function nameSplit(state, nodeId) {
  const s = clone(state);
  if (s.ended) return { state: s };
  if (!s.namedSplits.includes(nodeId)) {
    s.namedSplits.push(nodeId);
    s.log.push(`Named the split at "${NODE_TITLE[nodeId] || nodeId}".`);
  }
  checkEnd(s);
  return { state: s };
}
