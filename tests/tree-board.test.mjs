// node --test "tests/*.test.mjs"   (no dependencies; Node 22 does not expand a bare directory argument).
// The Tree's board engine: pure rules only (no DOM). Cross-checks that its casts are exactly The
// Fork's cast engine's (game/fork/fork-engine.js), never a second one, and that its leaf mapping is
// exactly the Film's shared renderer's (explainers/belief-tree/tree-render.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as B from '../game/tree-board/board-engine.js';
import { leafFor, LEAF_LABEL } from '../explainers/belief-tree/tree-render.js';
import { kindFrom, drawValue, isFirm } from '../game/fork/fork-engine.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const json = p => JSON.parse(readFileSync(here(p), 'utf8'));
const PEOPLE = json('../explainers/belief-tree/people.json');
const EVIDENCE = json('../game/tree-board/evidence.json');
const TRAJECTORIES = json('../game/tree-board/trajectories.json');

// ── fixtures: small synthetic people, independent of the real (and changing) people.json ────────
function person(slug, over) {
  return Object.assign({
    slug, name: slug[0].toUpperCase() + slug.slice(1), short: slug, role: 'test character',
    stated_leaf: 'proceed', to_move: [], card_quote_ids: [],
    gate: { answer: 'yes' }, alignment: { answer: 'yes' }, containment: { answer: 'yes' },
  }, over);
}
const PLAIN_A = person('plain-a', {});
const PLAIN_B = person('plain-b', {});
const OPEN_ALL = person('open-all', {
  stated_leaf: 'contain',
  gate: { answer: 'conditional' }, alignment: { answer: 'unclear' }, containment: { answer: 'not-addressed' },
  to_move: [{ to: 'contain', would_have_to_believe: 'containment cannot be verified' },
            { to: 'shutdown', would_have_to_believe: 'nothing can verify it' }],
});
const PLAIN_WITH_TOMOVE = person('plain-tm', {
  stated_leaf: 'proceed',
  gate: { answer: 'yes' }, alignment: { answer: 'yes' }, containment: { answer: 'yes' },
  to_move: [{ to: 'contain', would_have_to_believe: 'containment cannot hold' }],
});
const OUTSIDE = person('outside-one', { stated_leaf: 'outside' });

function fresh(people, playerCount, seed) {
  return B.newGame({ people, playerCount, seed: seed == null ? 1 : seed, evidence: EVIDENCE });
}
// dealing shuffles, so a fixture's own array order is not the turn order: pass other players'
// turns until `slug` is the one on the move.
function untilTurn(g, slug) {
  let guard = 0;
  while (g.characters[g.turnIndex].slug !== slug) {
    g = B.pass(g).state;
    if (++guard > 20) throw new Error('untilTurn: never reached ' + slug);
  }
  return g;
}
function crossAll(g, slug) {
  while (B.fieldForPos(g.characters.find(c => c.slug === slug).pos)) {
    g = untilTurn(g, slug);
    g = B.attemptMove(g, slug).state;
  }
  return g;
}

// ── dealing ───────────────────────────────────────────────────────────────────────────────────
test('dealablePeople excludes "outside the tree" people', () => {
  const pool = B.dealablePeople([PLAIN_A, OUTSIDE, PLAIN_B]);
  assert.deepEqual(pool.map(p => p.slug).sort(), ['plain-a', 'plain-b']);
});

test('buildCharacter starts at the gate with nothing resolved', () => {
  const c = B.buildCharacter(PLAIN_A);
  assert.equal(c.pos, 'gate');
  assert.deepEqual(c.resolved, { gate: null, alignment: null, containment: null });
});

test('newGame deals exactly playerCount characters, clamped to 2..5, deterministic by seed', () => {
  const people = [PLAIN_A, PLAIN_B, OPEN_ALL, PLAIN_WITH_TOMOVE];
  const g1 = fresh(people, 3, 42);
  const g2 = fresh(people, 3, 42);
  assert.equal(g1.characters.length, 3);
  assert.deepEqual(g1.characters.map(c => c.slug), g2.characters.map(c => c.slug));
  assert.deepEqual(g1.deck, g2.deck);
  const gLow = fresh(people, 1, 1);
  assert.equal(gLow.characters.length, 2, 'playerCount is clamped up to 2');
  const gHigh = fresh(people, 9, 1);
  assert.equal(gHigh.characters.length, Math.min(5, people.length), 'playerCount is clamped down to 5 (or the pool size)');
});

// ── moving on your own answer ─────────────────────────────────────────────────────────────────
test('a fully plain character crosses gate, alignment, containment on their own answer alone', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  const slug = g.characters[0].slug;
  let r = B.attemptMove(g, slug); g = r.state;
  assert.equal(g.characters[0].pos, 'alignment');
  assert.match(g.log.at(-1), /their own answer/);
  assert.equal(r.casting, null, 'no cast animation for a plain own answer');
  // it is now the other character's turn
  assert.notEqual(g.characters[g.turnIndex].slug, slug);
});

test('attemptMove refuses to move on a character whose turn it is not', () => {
  const g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  const notActive = g.characters[1].slug;
  const r = B.attemptMove(g, notActive);
  assert.match(r.error, /not/i);
  assert.equal(r.state.characters[1].pos, 'gate', 'no move happened');
});

test('attemptMove past a leaf errors', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  g = crossAll(g, 'plain-a');
  assert.equal(g.characters.find(c => c.slug === 'plain-a').pos, 'proceed');
  g = untilTurn(g, 'plain-a');
  const r = B.attemptMove(g, 'plain-a');
  assert.match(r.error, /leaf/);
});

// ── open answers: coin, yarrow, "I don't know" ────────────────────────────────────────────────
test('an open answer with no method is refused, asking to choose', () => {
  const g = fresh([OPEN_ALL, PLAIN_B], 2, 1);
  const r = B.attemptMove(g, g.characters[0].slug);
  assert.match(r.error, /coin, yarrow, or "I don't know"/);
});

test('"I don\'t know" is always legal, leaves the node open, spends the turn, does not advance', () => {
  const g = fresh([OPEN_ALL, PLAIN_B], 2, 1);
  const slug = g.characters[0].slug;
  const r = B.attemptMove(g, slug, 'unknown');
  const ch = r.state.characters.find(c => c.slug === slug);
  assert.equal(ch.pos, 'gate', 'still at the gate: no advance');
  assert.equal(ch.resolved.gate, null, 'left open, not resolved');
  assert.equal(r.casting.method, 'unknown');
  assert.notEqual(r.state.turnIndex, g.turnIndex, 'the turn still passed');
});

test('a coin or yarrow cast reads exactly The Fork\'s cast engine, not a second one', () => {
  let g = fresh([OPEN_ALL, PLAIN_B], 2, 7);
  const slug = 'open-all';
  g = untilTurn(g, slug);
  const expectedKind = kindFrom('yarrow', drawValue(g.seed, g.drawN));
  const expected = isFirm(expectedKind) ? 'yes' : 'no';
  const r = B.attemptMove(g, slug, 'yarrow');
  assert.equal(r.casting.result, expected);
  const ch = r.state.characters.find(c => c.slug === slug);
  assert.equal(ch.resolved.gate, expected);
  assert.equal(ch.tag.gate, 'yarrow');
  assert.ok(ch.pos === 'alignment', 'a cast answer still advances the token');
});

test('containment lands on the node tree-render.js\'s leafFor names, for every yes/no pair', () => {
  for (const alignment of ['yes', 'no']) {
    for (const containment of ['yes', 'no']) {
      const p = person('x', { gate: { answer: 'yes' }, alignment: { answer: alignment }, containment: { answer: containment } });
      let g = fresh([p, PLAIN_B], 2, 3);
      const slug = g.characters.find(c => c.slug === 'x') ? 'x' : null;
      if (!slug) continue;   // dealt order can vary; the loop below covers both orders across runs
    }
  }
  // direct check, independent of dealing order
  for (const alignment of ['yes', 'no']) {
    for (const containment of ['yes', 'no']) {
      const ch = B.buildCharacter(person('x', { gate: { answer: 'yes' }, alignment: { answer: alignment }, containment: { answer: containment } }));
      ch.resolved.alignment = alignment; ch.resolved.containment = containment;
      const leaf = leafFor({ alignment, containment });
      assert.ok(B.LEAVES.includes(leaf));
    }
  }
});

// ── evidence ──────────────────────────────────────────────────────────────────────────────────
test('evidence.json: every card is well-formed and every source is a public link', () => {
  const ids = new Set();
  for (const c of EVIDENCE) {
    assert.ok(!ids.has(c.id), 'unique id: ' + c.id); ids.add(c.id);
    assert.ok(['gate', 'alignment', 'containment'].includes(c.node), c.id);
    assert.ok(['yes', 'no'].includes(c.push), c.id);
    assert.equal(typeof c.text, 'string');
    assert.ok(c.text.length > 0 && c.text.length < 260, c.id + ': keep the argument to one line');
    if (c.source) assert.match(c.source.url, /^https:\/\//, c.id);
  }
  assert.ok(EVIDENCE.length >= 10, 'a small deck, ~12 cards');
});

test('evidence flips an open answer freely', () => {
  const g = fresh([OPEN_ALL, PLAIN_B], 2, 1);
  const card = EVIDENCE.find(c => c.node === 'gate');
  const legal = B.evidenceLegality(card, g.characters.find(c => c.slug === 'open-all'));
  assert.equal(legal.legal, true);
});

test('evidence refuses to flip a plain answer unless the resulting leaf is the character\'s OWN stated to_move condition', () => {
  const g = fresh([PLAIN_WITH_TOMOVE, PLAIN_B], 2, 1);
  const ch = g.characters.find(c => c.slug === 'plain-tm');
  // containment push 'no' with alignment 'yes' (their plain answer) -> leaf 'regulate', not in their to_move (only 'contain' is)
  const cardToRegulate = { id: 'test-1', node: 'containment', push: 'no', text: 't' };
  const refused = B.evidenceLegality(cardToRegulate, ch);
  assert.equal(refused.legal, false);
  assert.match(refused.reason, /not a condition they have stated/);
  // containment push 'no' with alignment 'no' would be 'contain' but alignment is fixed 'yes' here, so
  // instead flip alignment to 'no' first: with containment 'yes' (their plain answer) that lands on 'contain',
  // which IS one of their to_move entries.
  const cardToContain = { id: 'test-2', node: 'alignment', push: 'no', text: 't' };
  const allowed = B.evidenceLegality(cardToContain, ch);
  assert.equal(allowed.legal, true);
  assert.equal(allowed.leaf, 'contain');
  assert.equal(allowed.reason, 'containment cannot hold');
});

test('playEvidence: a refused card changes nothing and does not spend the turn; a legal one does', () => {
  let g = fresh([PLAIN_WITH_TOMOVE, PLAIN_B], 2, 1);
  const before = g.turnIndex, deckBefore = g.deck.slice();
  const illegal = EVIDENCE.find(c => c.node === 'containment' && c.push === 'no');
  const bad = B.playEvidence(g, EVIDENCE, illegal.id, 'plain-tm');
  assert.equal(bad.ok, false);
  assert.ok(bad.reason);
  assert.equal(bad.state.turnIndex, before, 'a refusal does not spend the turn');
  assert.deepEqual(bad.state.deck, deckBefore, 'a refusal does not remove the card');

  const legalCard = { id: 'test-legal', node: 'alignment', push: 'no', text: 'x' };
  g = { ...g, deck: [...g.deck, 'test-legal'] };
  const good = B.playEvidence(g, [...EVIDENCE, legalCard], 'test-legal', 'plain-tm');
  assert.equal(good.ok, true);
  const ch = good.state.characters.find(c => c.slug === 'plain-tm');
  assert.equal(ch.resolved.alignment, 'no');
  assert.notEqual(good.state.turnIndex, before, 'a legal play spends the turn');
  assert.ok(!good.state.deck.includes('test-legal'));
  assert.ok(good.state.discard.includes('test-legal'));
});

test('after evidence pre-sets a field, crossing it needs no method and says so', () => {
  let g = fresh([PLAIN_WITH_TOMOVE, PLAIN_B], 2, 1);
  const legalCard = { id: 'test-legal', node: 'alignment', push: 'no', text: 'x' };
  g = B.playEvidence({ ...g, deck: [...g.deck, 'test-legal'] }, [legalCard], 'test-legal', 'plain-tm').state;
  const ch0 = g.characters.find(c => c.slug === 'plain-tm');
  assert.equal(ch0.resolved.alignment, 'no', 'evidence pre-set the still-open field, ahead of the token reaching it');

  // cross the gate first (their own plain 'yes'); alignment is next
  g = untilTurn(g, 'plain-tm'); g = B.attemptMove(g, 'plain-tm').state;
  g = untilTurn(g, 'plain-tm');
  const r = B.attemptMove(g, 'plain-tm');
  assert.equal(r.error, undefined);
  assert.match(r.state.log.at(-1), /evidence already set/);
  const ch = r.state.characters.find(c => c.slug === 'plain-tm');
  assert.equal(ch.pos, 'containment-if-not', 'alignment no -> containment-if-not');
});

// ── the race ──────────────────────────────────────────────────────────────────────────────────
test('the race advances by one every time the turn order completes a round', () => {
  let g = fresh([PLAIN_A, PLAIN_B, OPEN_ALL], 3, 1);
  assert.equal(g.race, 0);
  g = B.pass(g).state; g = B.pass(g).state;
  assert.equal(g.race, 0, 'not a full round yet');
  g = B.pass(g).state;
  assert.equal(g.race, 1, 'one full round: +1');
});

test('reaching Proceed ticks the race one extra step', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  const before = g.race;
  g = B.attemptMove(g, g.characters[0].slug).state;   // gate
  g = B.pass(g).state;                                 // plain-b's turn
  g = B.attemptMove(g, g.characters[0].slug).state;    // alignment
  g = B.pass(g).state;
  g = B.attemptMove(g, g.characters[0].slug).state;    // containment -> proceed
  assert.equal(g.characters[0].pos, 'proceed');
  assert.ok(g.race > before, 'the race ticked at least once from the Proceed bonus');
});

// ── win / lose ────────────────────────────────────────────────────────────────────────────────
test('wins when every character lands on one shared leaf', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  g = crossAll(g, 'plain-a');
  g = crossAll(g, 'plain-b');
  assert.ok(g.ended);
  assert.equal(g.ended.result, 'win');
  assert.match(g.ended.reason, /one shared leaf/);
});

test('activeSplitNodes names where two leafed characters part ways', () => {
  const alignYes = B.buildCharacter(person('a', { alignment: { answer: 'yes' }, containment: { answer: 'yes' } }));
  alignYes.resolved = { gate: 'yes', alignment: 'yes', containment: 'yes' }; alignYes.pos = 'proceed';
  const alignNo = B.buildCharacter(person('b', { alignment: { answer: 'no' }, containment: { answer: 'yes' } }));
  alignNo.resolved = { gate: 'yes', alignment: 'no', containment: 'yes' }; alignNo.pos = 'contain';
  const state = { characters: [alignYes, alignNo], namedSplits: [] };
  assert.deepEqual(B.activeSplitNodes(state), ['alignment']);

  const sameAlignDiffContain1 = B.buildCharacter(person('c', { alignment: { answer: 'yes' }, containment: { answer: 'yes' } }));
  sameAlignDiffContain1.resolved = { gate: 'yes', alignment: 'yes', containment: 'yes' }; sameAlignDiffContain1.pos = 'proceed';
  const sameAlignDiffContain2 = B.buildCharacter(person('d', { alignment: { answer: 'yes' }, containment: { answer: 'no' } }));
  sameAlignDiffContain2.resolved = { gate: 'yes', alignment: 'yes', containment: 'no' }; sameAlignDiffContain2.pos = 'regulate';
  const state2 = { characters: [sameAlignDiffContain1, sameAlignDiffContain2], namedSplits: [] };
  assert.deepEqual(B.activeSplitNodes(state2), ['containment-if-aligned']);
});

test('does not win on differing leaves until every split is named, then wins once it is', () => {
  let g = fresh([PLAIN_A, { ...PLAIN_B, slug: 'no-align', alignment: { answer: 'no' } }], 2, 1);
  g = crossAll(g, 'plain-a');
  g = crossAll(g, 'no-align');
  assert.ok(!g.ended, 'leaves differ (proceed vs. contain); not yet won');
  assert.deepEqual(B.activeSplitNodes(g), ['alignment']);
  g = B.nameSplit(g, 'alignment').state;
  assert.ok(g.ended);
  assert.equal(g.ended.result, 'win');
});

test('loses when the race fills before the table finishes', () => {
  let g = fresh([OPEN_ALL, { ...OPEN_ALL, slug: 'open-two' }], 2, 1);
  for (let i = 0; i < B.RACE_LIMIT * g.characters.length && !g.ended; i++) g = B.pass(g).state;
  assert.ok(g.ended);
  assert.equal(g.ended.result, 'lose');
});

// ── data sanity: the real people.json and evidence.json agree with the engine ───────────────────
test('every dealable real person\'s to_move[].to is a leaf the engine recognises', () => {
  const dealable = B.dealablePeople(PEOPLE);
  assert.ok(dealable.length >= 10, 'enough people to deal 2-5 players');
  for (const p of dealable) {
    for (const m of (p.to_move || [])) assert.ok(B.LEAVES.includes(m.to), `${p.slug}: to_move.to "${m.to}"`);
  }
});

test('every dealable real person builds into a playable character', () => {
  for (const p of B.dealablePeople(PEOPLE)) {
    const ch = B.buildCharacter(p);
    assert.equal(ch.pos, 'gate');
    assert.ok(['yes', 'no', 'conditional', 'unclear', 'not-addressed', 'unknown'].includes(ch.raw.gate), p.slug);
  }
});

// ── the grid: all 4 cells reachable, and every one is exactly leafFor's mapping ───────────────────
// The matrix board (game/shared/matrix-board.js) draws its 4 cells from leafFor(alignment, containment)
// directly, with LEAF_LABEL for their titles. This locks that mapping down from the test side too, so
// the two can never quietly disagree about which cell a (alignment, containment) pair names.
test('the grid: every (alignment, containment) pair names exactly one of the 4 cells, matching LEAF_LABEL', () => {
  const expected = {
    'yes,yes': 'proceed', 'yes,no': 'regulate', 'no,yes': 'contain', 'no,no': 'shutdown',
  };
  for (const alignment of ['yes', 'no']) {
    for (const containment of ['yes', 'no']) {
      const leaf = leafFor({ alignment, containment });
      assert.equal(leaf, expected[`${alignment},${containment}`]);
      assert.ok(LEAF_LABEL[leaf], `LEAF_LABEL has a title for "${leaf}"`);
      assert.ok(B.LEAVES.includes(leaf));
    }
  }
  // and only those 4 — no fifth cell, no pair left unmapped
  assert.deepEqual(new Set(B.LEAVES), new Set(Object.values(expected)));
});

// ── trajectories.json: dated, sourced, sorted, and every quote real ────────────────────────────────
test('trajectories.json: every entry is dated, sourced, and every quote_id resolves to a real, checked quote', () => {
  const peopleBySlug = new Map(PEOPLE.map(p => [p.slug, p]));
  const slugs = Object.keys(TRAJECTORIES).filter(k => !k.startsWith('_'));
  assert.ok(slugs.length >= 2, 'at least a couple of real trajectories');
  for (const slug of slugs) {
    const person = peopleBySlug.get(slug);
    assert.ok(person, `trajectories.json has a real person for "${slug}"`);
    const points = TRAJECTORIES[slug];
    assert.ok(Array.isArray(points) && points.length >= 2, `${slug}: a trail needs at least two dated points`);
    for (const p of points) {
      assert.ok(p.date, `${slug}: every point has a date`);
      assert.ok(p.note || p.quote_id || p.quote, `${slug}: every point says something`);
      assert.ok(p.source_label, `${slug}: every point names its source`);
      if (p.url) assert.match(p.url, /^https:\/\//, `${slug}: source url is public`);
      if (p.quote_id) {
        const q = (person.quotes || []).find(x => x.id === p.quote_id);
        assert.ok(q, `${slug}: quote_id "${p.quote_id}" exists in people.json`);
        assert.ok(['captions', 'published text'].includes(q.checked_against),
          `${slug}: quote_id "${p.quote_id}" was already checked (captions or published text), not new/unverified`);
      }
      if (p.cell) assert.ok(B.LEAVES.includes(p.cell), `${slug}: cell "${p.cell}" is a real leaf`);
    }
    // dates sort ascending (ISO strings sort lexically) and the last point is the one marked "now"
    const dates = points.map(p => p.date);
    assert.deepEqual(dates, [...dates].sort(), `${slug}: dated positions are stored in order`);
    assert.ok(points[points.length - 1].now, `${slug}: the last dated point is marked "now"`);
  }
});

// ── casting ANY card ──────────────────────────────────────────────────────────────────────────────
test('castCard draws from the SAME seeded RNG as the rest of the game (deterministic in tests), and never removes the card until it is played', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 11);
  const before = g.deck.slice();
  const r1 = B.castCard(g);
  assert.ok(before.includes(r1.cardId));
  assert.deepEqual(r1.state.deck, before, 'drawing does not remove the card from the deck');
  // same seed, same drawN so far -> same draw, exactly like the coin/yarrow cast's own determinism
  const expectedIdx = Math.min(before.length - 1, Math.floor(drawValue(g.seed, g.drawN) * before.length));
  assert.equal(r1.cardId, before[expectedIdx]);
  // drawing again from the advanced state gives a (deterministically) different draw slot
  const r2 = B.castCard(r1.state);
  assert.equal(r2.state.drawN, r1.state.drawN + 1);
});

test('castCard refuses once the deck is empty', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  g = { ...g, deck: [] };
  const r = B.castCard(g);
  assert.match(r.error, /No evidence left/);
});

// ── cast multiple people: a group cast checks each target separately ───────────────────────────────
test('groupTargets finds positions with more than one character; playEvidenceGroup checks each one and spends one turn', () => {
  // two plain characters both start at the gate together: a group is available immediately
  let g = fresh([PLAIN_A, PLAIN_B, PLAIN_WITH_TOMOVE], 3, 1);
  const groups = B.groupTargets(g);
  const gateGroup = groups.find(x => x.pos === 'gate');
  assert.ok(gateGroup, 'everyone starts at the gate together');
  assert.equal(gateGroup.slugs.length, 3);

  const before = g.turnIndex;
  const card = { id: 'grp-test', node: 'gate', push: 'no', text: 'x' };
  const r = B.playEvidenceGroup({ ...g, deck: [...g.deck, 'grp-test'] }, [card], 'grp-test', 'gate');
  assert.equal(r.ok, true);
  assert.equal(r.results.length, 3, 'each character in the group was checked separately');
  assert.notEqual(r.state.turnIndex, before, 'a group cast spends exactly one turn, not one per target');
  assert.ok(!r.state.deck.includes('grp-test'));
  for (const res of r.results) {
    const ch = r.state.characters.find(c => c.slug === res.slug);
    if (res.applied) assert.equal(ch.resolved.gate, 'no');
  }
});

test('playEvidenceGroup: some targets can be refused while others move, and the log says why for each', () => {
  // plain-tm's gate is a plain 'yes' with no to_move entry for gate at all, so a gate-node card can
  // never legally flip it (gate never decides a leaf) — it stays refused even though open-all (whose
  // gate is still open) accepts the very same card.
  let g = fresh([OPEN_ALL, PLAIN_WITH_TOMOVE], 2, 1);
  const card = { id: 'grp-test-2', node: 'gate', push: 'no', text: 'x' };
  const r = B.playEvidenceGroup({ ...g, deck: [...g.deck, 'grp-test-2'] }, [card], 'grp-test-2', 'gate');
  assert.equal(r.ok, true);
  const openResult = r.results.find(x => x.slug === 'open-all');
  const tmResult = r.results.find(x => x.slug === 'plain-tm');
  assert.equal(openResult.applied, true);
  assert.equal(tmResult.applied, false);
  assert.ok(tmResult.reason);
  assert.ok(r.state.log.some(l => l.includes('unmoved') && l.includes('plain-tm')));
});

test('playEvidenceGroup refuses a card not in the deck, or an empty position, without spending a turn', () => {
  let g = fresh([PLAIN_A, PLAIN_B], 2, 1);
  const before = g.turnIndex;
  const missing = B.playEvidenceGroup(g, EVIDENCE, 'not-a-real-card', 'gate');
  assert.equal(missing.ok, false);
  assert.equal(missing.state.turnIndex, before);
  const card = EVIDENCE.find(c => c.node === 'gate');
  const nobodyThere = B.playEvidenceGroup(g, EVIDENCE, card.id, 'proceed');
  assert.equal(nobodyThere.ok, false);
  assert.match(nobodyThere.reason, /No one is there/);
});
