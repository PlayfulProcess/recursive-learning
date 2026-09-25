// node --test "tests/*.test.mjs"   (no dependencies; Node 22 does not expand a bare directory argument).
// The Fork's engine, the stand-in's leafFor and the adapter's pickTree. DOM behaviour of the stand-in (castend once
// per cast, select events) is checked in the browser, not here. The fixture regulatory.sample.json is made up: the
// real regulatory.json is held for PlayfulProcess's word and is never committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as E from '../game/fork/fork-engine.js';
import * as S from '../game/fork/tree-render-standin.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const json = p => JSON.parse(readFileSync(here(p), 'utf8'));
const LEAF_ACTIONS = json('../game/fork/data/leaf-actions.json');
const FIXTURE = json('./fixtures/regulatory.sample.json');
const PEOPLE = json('../game/fork/people.example.json');
const { leafFor } = S;

// a leafFor that fails the test if it is ever called with alignment or containment open
function spyLeafFor() {
  const calls = [];
  const f = a => {
    calls.push(a);
    assert.ok(['yes', 'no'].includes(a.alignment) && ['yes', 'no'].includes(a.containment), 'leafFor called with an open answer: ' + JSON.stringify(a));
    return leafFor(a);
  };
  f.calls = calls;
  return f;
}
// a walk built from a small local rng: every kind of move on every line
function randomWalk(seed) {
  const r = E.rngFrom(seed * 7919 + 13);
  let w = E.newWalk(seed);
  for (let i = 0; i < 5; i++) {
    const m = Math.floor(r() * 8);
    if (m === 0) w = E.decide(w, i, 'yes').walk;
    else if (m === 1) w = E.decide(w, i, 'no', { loose: true }).walk;
    else if (m === 2) w = E.dontKnow(w, i).walk;
    else if (m === 3) w = E.cast(w, i, 'coin').walk;
    else if (m === 4) w = E.cast(w, i, 'yarrow').walk;
    else if (m === 5) w = E.cast(w, i, 'coins').walk;
    else if (m === 6) w = E.decide(w, i, 'yes', { loose: true }).walk;
    // 7: leave the line unasked
  }
  return w;
}

test('stand-in leafFor: four leaves, null when open, ignores gate and race', () => {
  assert.equal(leafFor({ alignment: 'yes', containment: 'yes' }), 'proceed');
  assert.equal(leafFor({ alignment: 'yes', containment: 'no' }), 'regulate');
  assert.equal(leafFor({ alignment: 'no', containment: 'yes' }), 'contain');
  assert.equal(leafFor({ alignment: 'no', containment: 'no' }), 'shutdown');
  for (const open of [null, 'unknown', undefined]) {
    assert.equal(leafFor({ alignment: open, containment: 'yes' }), null);
    assert.equal(leafFor({ alignment: 'no', containment: open }), null);
  }
  for (const gate of ['yes', 'no', 'unknown', null]) for (const race of ['yes', 'no', 'unknown', null])
    assert.equal(leafFor({ gate, race, alignment: 'no', containment: 'yes' }), 'contain');
});

test('stand-in NODES: the nine contract ids, leaves say which answers lead to them', () => {
  assert.deepEqual(E.checkNodes(S.NODES, () => {}), []);
  const idx = E.nodeIndex(S.NODES);
  for (const leaf of E.LEAVES) assert.equal(leafFor(idx[leaf].leadsFrom), leaf);
  // a map keyed by id is accepted too
  const asMap = {}; S.NODES.forEach(n => { asMap[n.id] = { label: n.label }; });
  assert.deepEqual(E.checkNodes(asMap, () => {}), []);
  const warned = []; E.checkNodes([{ id: 'gate' }], m => warned.push(m));
  assert.equal(warned.length, 1);
});

test('the engine never calls leafFor with an open answer', () => {
  const spy = spyLeafFor();
  for (let s = 1; s <= 300; s++) {
    const w = randomWalk(s);
    E.landing(w, spy);
    E.relating(w, spy);
    E.closeTheGap(w, 'either', { leafFor: spy, leafActions: LEAF_ACTIONS });
    E.landing(E.closeTheGap(w, 'coin').walk, spy);
    if (s <= 40) for (const d of ['coin', 'yarrow', 'urn-new', 'urn-one']) E.cast100(w, d, spy);
  }
  PEOPLE.forEach(p => E.personWalk(p, spy));
  assert.ok(spy.calls.length > 1000);
});

test('gate: yes-yes gives yes, any no gives no, otherwise unknown', () => {
  assert.equal(E.gateOf('yes', 'yes'), 'yes');
  for (const x of ['yes', 'no', 'unknown', null]) { assert.equal(E.gateOf('no', x), 'no'); assert.equal(E.gateOf(x, 'no'), 'no'); }
  assert.equal(E.gateOf('yes', 'unknown'), 'unknown');
  assert.equal(E.gateOf('unknown', 'unknown'), 'unknown');
  // one part yes and the other not asked yet is "not answered yet", never a "?" the player didn't say
  assert.equal(E.gateOf('yes', null), null);
  assert.equal(E.gateOf(null, 'yes'), null);
  assert.equal(E.gateOf(null, null), null);
  assert.equal(E.answersOf(E.decide(E.newWalk(1), 0, 'yes').walk).gate, null);
});

test("I don't know stays open until cast, and a cast answer is still uncertain", () => {
  let w = E.newWalk(77);
  w = E.decide(w, 'alignment', 'yes').walk;
  w = E.dontKnow(w, 'containment').walk;
  let st = E.toTreeState(w);
  assert.ok(st.open.includes('containment-if-aligned'));
  assert.ok(!st.open.includes('alignment'));
  assert.equal(st.answers.containment, 'unknown');
  assert.deepEqual(E.counts(w), { decided: 1, cast: 0, open: 4, moot: 0 });
  assert.equal(E.landing(w, leafFor).leaf, null);
  const r = E.cast(w, 'containment', 'coin');
  w = r.walk;
  st = E.toTreeState(w);
  assert.ok(['yes', 'no'].includes(st.answers.containment));
  assert.ok(st.open.includes('containment-if-aligned'), 'cast answers stay in open');
  assert.ok(!st.open.includes('containment-if-not'), 'alignment decided yes: only the node on the path');
  assert.deepEqual(E.counts(w), { decided: 1, cast: 1, open: 3, moot: 0 });
  assert.equal(r.casting.node, 'containment-if-aligned');
  assert.equal(r.casting.method, 'coin');
  // alignment cast: both containment nodes stay open
  let v = E.cast(E.newWalk(5), 'alignment', 'yarrow').walk;
  v = E.dontKnow(v, 'containment').walk;
  st = E.toTreeState(v);
  assert.ok(st.open.includes('alignment') && st.open.includes('containment-if-aligned') && st.open.includes('containment-if-not'));
  assert.equal(st.step, null);
  assert.ok(!('lit' in st));
});

test('the tapped containment node is where the cast plays', () => {
  const w = E.newWalk(3);
  assert.equal(E.cast(w, 3, 'coin', { node: 'containment-if-not' }).casting.node, 'containment-if-not');
  assert.equal(E.cast(w, 3, 'coin').casting.node, 'containment-if-aligned');
  const no = E.decide(w, 2, 'no').walk;
  assert.equal(E.cast(no, 3, 'coin').casting.node, 'containment-if-not');
  assert.equal(E.cast(w, 0, 'coin').casting.node, 'gate');
  assert.equal(E.dontKnow(w, 4).casting.node, 'race');
});

test('burden reading: cast and unknown answers count as no', () => {
  let w = E.newWalk(9);
  w = E.decide(w, 0, 'yes').walk; w = E.decide(w, 1, 'yes').walk;
  w = E.decide(w, 2, 'yes').walk;
  w = E.dontKnow(w, 3).walk;
  let L = E.landing(w, leafFor);
  assert.equal(L.burden, 'flipped');
  assert.equal(L.ruleLeaf, 'regulate');             // own yes stays, unknown containment reads as no
  assert.equal(L.headline, 'regulate');
  assert.deepEqual(L.possible, ['proceed', 'regulate']);
  // a cast alignment yes counts as not shown
  let v = E.newWalk(1);
  while (true) { const r = E.cast(v, 2, 'coin'); if (r.walk.lines[2].answer === 'yes') { v = r.walk; break; } v = r.walk; }
  v = E.decide(v, 3, 'yes').walk;
  L = E.landing(v, leafFor);
  assert.equal(L.leaf, 'proceed');
  assert.equal(L.ruleLeaf, 'contain');
  assert.equal(L.headline, 'contain', 'the gate not asked yet: nobody has shown it can be undone, so the caution is on');
  assert.deepEqual(L.couldHave, ['proceed', 'contain']);
  assert.deepEqual(L.possible, ['proceed']);
  assert.equal(L.leafCast, true);
  assert.equal(L.pickedBy, 2);
  // the gate put at yes by coins
  let g = E.newWalk(2);
  g = E.castLines(g, [0, 1], 'coin').walk;
  while (E.answersOf(g).gate !== 'yes') g = E.castLines(g, [0, 1], 'coin').walk;
  assert.equal(E.landing(g, leafFor).gateCast, true);
  assert.ok(E.toTreeState(g).open.includes('gate'));
  // an own no on either part settles the gate
  const own = E.decide(E.cast(E.newWalk(2), 0, 'coin').walk, 1, 'no').walk;
  assert.equal(E.gateInfo(own).open, false);
  assert.equal(E.landing(own, leafFor).burden, 'ordinary');
});

test('a cast can neither satisfy the caution nor switch it off (the reviewers\' seed 3 walk)', () => {
  // all five cast by coins: the gate cast at no, alignment and containment cast at yes
  const d = E.decodeHash('#f1;L=nc8.yc7.yc7.yc7.nc8;s=3;n=5');
  const L = E.landing(d.walk, leafFor);
  assert.equal(L.answers.gate, 'no');
  assert.equal(L.gateCastNo, true);
  assert.equal(L.burden, 'flipped', "a coin's 'it can be undone' was not shown either");
  assert.equal(L.leaf, 'proceed');                  // where the casts point, as drawn
  assert.equal(L.ruleLeaf, 'shutdown');              // cast yeses count as no
  assert.equal(L.headline, 'shutdown', 'the page names the rule\'s leaf, never the casts\'');
  assert.equal(L.byRule, true);
  assert.equal(L.drawnDiffers, true);
  assert.equal(L.throwSame, true);
  assert.equal(L.pick, null);
  assert.equal(E.afterLine('gate', d.walk), E.TEXT.gateNoCast);
  assert.ok(!E.afterLine('gate', d.walk).includes(E.TEXT.gateNo));
  const words = E.ruleText(L, l => E.leafName(l)).join(' ');
  assert.match(words, /you land on Shut down\./);
  assert.ok(!/yes counts as no|yes still counts as no/.test(words), 'plain words: never "a yes counts as no"');
  // with every combination of casts on the gate, only an own no gives ordinary trial and error
  for (const how of ['coin', 'yarrow', 'coins']) {
    for (let s = 1; s < 40; s++) {
      let w = E.castLines(E.newWalk(s), [0, 1], how).walk;
      assert.notEqual(E.landing(w, leafFor).burden, 'ordinary', 'a cast gate never reads ordinary');
      w = E.decide(w, 1, 'no').walk;
      assert.equal(E.landing(w, leafFor).burden, 'ordinary');
    }
  }
  // a cast no on one part and an open other part: the caution stays on (nobody has shown it can be undone)
  let u = E.newWalk(5);
  while (true) { const r = E.cast(u, 0, 'coin'); u = r.walk; if (u.lines[0].answer === 'no') break; }
  u = E.dontKnow(u, 1).walk;
  assert.equal(E.landing(u, leafFor).burden, 'flipped');
  // without the burden reading, the headline is where the answers lead
  let own = E.decide(E.decide(E.newWalk(1), 0, 'no').walk, 1, 'no').walk;
  own = E.decide(E.decide(own, 2, 'yes').walk, 3, 'no').walk;
  const O = E.landing(own, leafFor);
  assert.equal(O.headline, 'regulate'); assert.equal(O.byRule, false);
});

// The reviewers' repro walks (round 3, lab/fork @ e113764), each checked against the one rule.
test("I don't know on the gate keeps the caution on: coins never pick Proceed past it", () => {
  for (const h of ['#f1;L=uu0.uu0.yc7.yc7.nc8;s=3;n=5', '#f1;L=uu0.uu0.yc7.yc7.uu0;s=3;n=2']) {
    const L = E.landing(E.decodeHash(h).walk, leafFor);
    assert.equal(L.caution, true, h);
    assert.equal(L.headline, 'shutdown', h + ': an honest "I don\'t know" is not less cautious than a coin');
    assert.equal(L.leaf, 'proceed');                     // the drawing still points where the coins fell
    assert.equal(L.drawnDiffers, true);
    assert.equal(L.pick, null);
    assert.match(E.ruleText(L, l => E.leafName(l)).join(' '), /"I don't know" hasn't shown it/);
  }
  // the same walk with a coin on the gate lands in the same place: open and cast are treated alike
  assert.equal(E.landing(E.decodeHash('#f1;L=nc8.nc8.yc7.yc7.uu0;s=3;n=5').walk, leafFor).headline, 'shutdown');
  // the gate not asked at all: the caution is on too
  let w = E.newWalk(4);
  w = E.cast(w, 2, 'coin').walk; w = E.cast(w, 3, 'coin').walk;
  assert.equal(E.landing(w, leafFor).caution, true);
  // every walk: only an own no on a gate part switches the caution off
  for (let s = 1; s <= 300; s++) {
    const v = randomWalk(s), own = v.lines.slice(0, 2).some(l => l.how === 'decide' && l.answer === 'no');
    assert.equal(E.landing(v, leafFor).caution, !own, 'seed ' + s);
  }
});

test("the gate 'no, shown' and a coin's yes: no single leaf, the coin's pick, still possible all four (as the explainer)", () => {
  const L = E.landing(E.decodeHash('#f1;L=nd8.yd7.yc7.yc7.nd8;s=3;n=5').walk, leafFor);
  assert.equal(L.caution, false);
  assert.equal(L.headline, null, 'a coin is never presented as the answer to "is there an action?"');
  assert.equal(L.pick, 'proceed');
  assert.deepEqual(L.still, ['proceed', 'regulate', 'contain', 'shutdown']);
  assert.equal(L.throwMatters, true); assert.equal(L.throwSame, false);
  const words = E.ruleText(L, l => E.leafName(l)).join(' ');
  assert.match(words, /still not known: Proceed, Regulate, Contain and Shut down all stay possible\./);
  assert.match(words, /The casts picked Proceed/);
  assert.match(words, /It is not a finding\./);
});

test('the flip line follows the rule: a drawn line that could flip never names a second landing', () => {
  // yarrow everywhere, the gate cast: by the rule Shut down, and a turning drawn line is still drawn
  let L = E.landing(E.decodeHash('#f1;L=yy7.yy7.yy9.yy7.nd8;s=3;n=5').walk, leafFor);
  assert.equal(L.headline, 'shutdown'); assert.equal(L.flipLeaf, null);
  assert.equal(L.relatingLeaf, 'contain');             // the drawing's own turning, kept for the six-lines reading
  // own gate yes, a drawn turning no on alignment, own yes on containment: Contain, and it stays Contain
  L = E.landing(E.decodeHash('#f1;L=yd7.yd7.ny6.yd7.nd8;s=3;n=1').walk, leafFor);
  assert.equal(L.headline, 'contain'); assert.equal(L.flipLeaf, null);
  // own loose yes on alignment, a coin's yes on containment: Regulate; the own yes flipping gives Shut down
  L = E.landing(E.decodeHash('#f1;L=yd7.yd7.yd9.yc7.nc8;s=3;n=2').walk, leafFor);
  assert.equal(L.headline, 'regulate'); assert.equal(L.flipLeaf, 'shutdown');
  assert.equal(E.flipText('Shut down'), 'If the answers you hold loosely did flip, you would land on Shut down instead.');
  // the 12-year-old's six-lines walk: the only turning answer is a drawn gate part, so nothing can move the landing
  L = E.landing(E.decodeHash('#f1;L=yd7.yy9.y37.n38.n38;s=213569;n=4').walk, leafFor);
  assert.equal(L.headline, 'shutdown'); assert.equal(L.flipLeaf, null);
  // for every walk: a flip never names the landing itself, and with no own turning answer there is no flip
  for (let s = 1; s <= 300; s++) {
    const v = randomWalk(s), M = E.landing(v, leafFor);
    if (M.flipLeaf) assert.notEqual(M.flipLeaf, M.headline);
    const ownTurning = v.lines.some(l => l.how === 'decide' && E.isTurning(l.kind));
    if (!ownTurning) assert.equal(M.flipLeaf, null, 'seed ' + s);
    if (M.caution) { assert.ok(M.headline, 'the rule always names a leaf'); assert.equal(M.pick, null); }
  }
});

test('the tree draws a cast-reached leaf as open (dashed), never as a place you landed', () => {
  const w = E.decodeHash('#f1;L=nc8.yc7.yc7.yc7.nc8;s=3;n=5').walk;
  assert.ok(E.toTreeState(w, { leafFor }).open.includes('proceed'));
  assert.ok(!E.toTreeState(w).open.includes('proceed'), 'without leafFor the engine does not guess the mapping');
  let own = E.decide(E.decide(E.newWalk(1), 2, 'yes').walk, 3, 'yes').walk;
  assert.ok(!E.toTreeState(own, { leafFor }).open.includes('proceed'), 'your own answers reach a solid leaf');
});

test('a gate settled by your own no: the other part is not needed', () => {
  let w = E.decide(E.newWalk(2), 0, 'no').walk;
  assert.deepEqual(E.mootLines(w), [1]);
  assert.deepEqual(E.neededOpenLines(w), [2, 3, 4]);
  assert.deepEqual(E.openLines(w), [1, 2, 3, 4]);              // the six-lines view still needs line 2 for the hexagram
  assert.deepEqual(E.counts(w), { decided: 1, cast: 0, open: 3, moot: 1 });
  assert.match(E.countsSummary(E.counts(w)), /not needed 1/);
  assert.match(E.countsSummary(E.counts(w), 'lines'), /open 4, of lines 1 to 5/);
  assert.match(E.afterLine('gate', w), /settles the gate/);
  const c = E.closeTheGap(w, 'coin', { needed: true });
  assert.deepEqual(c.steps.map(x => x.line), [2, 3, 4]);
  assert.equal(c.walk.lines[1].answer, null);
  assert.deepEqual(E.closeTheGap(w, 'each', { needed: true }).prompts, [2, 3, 4]);
  // a cast no does not settle it: the other part still matters for the caution
  let v = E.newWalk(5);
  while (true) { const r = E.cast(v, 0, 'coin'); v = r.walk; if (v.lines[0].answer === 'no') break; }
  assert.deepEqual(E.mootLines(v), []);
});

test("leafName speaks the renderer's words: LEAF_LABEL, then label, then title", () => {
  const filmLike = [{ id: 'regulate', title: 'Regulate use' }, { id: 'proceed', title: 'Proceed' }];
  assert.equal(E.leafName('regulate', filmLike), 'Regulate use');
  assert.equal(E.leafName('regulate', filmLike, { regulate: 'Regulate use' }), 'Regulate use');
  assert.equal(E.leafName('regulate', S.NODES), 'Regulate');
  assert.equal(E.leafName('shutdown', null), 'Shut down');
});


test('the race changes the landing words, never the leaf', () => {
  let w = E.newWalk(1);
  [0, 1, 2, 3].forEach(i => { w = E.decide(w, i, 'yes').walk; });
  const yes = E.decide(w, 4, 'yes').walk, no = E.decide(w, 4, 'no').walk;
  assert.equal(E.landing(yes, leafFor).headline, E.landing(no, leafFor).headline);
  assert.notEqual(E.raceNote('yes', 'proceed'), E.raceNote('no', 'proceed'));
  assert.match(E.raceNote('yes', 'shutdown'), /would take others stopping too/);
  assert.match(E.raceNote('yes', 'regulate', true), /cast, not known/);
  assert.match(E.raceNote(null, 'contain'), /Both readings stay/);
});

test('relating: turning lines flip, loosely held decisions included', () => {
  let w = E.newWalk(4);
  w = E.decide(w, 2, 'yes', { loose: true }).walk;   // kind 9
  w = E.decide(w, 3, 'yes').walk;                    // kind 7
  const r = E.relating(w, leafFor);
  assert.deepEqual(r.turned, [2]);
  assert.equal(r.answers.alignment, 'no');
  assert.equal(r.relatingLeaf, 'contain');
  assert.equal(E.landing(w, leafFor).relatingLeaf, 'contain');
  // the landing's flip line follows the rule: an own loose yes flipping moves it
  assert.equal(E.landing(w, leafFor).headline, 'proceed');
  assert.equal(E.landing(w, leafFor).flipLeaf, 'contain');
  const steady = E.relating(E.decide(w, 2, 'yes').walk, leafFor);
  assert.equal(steady.relatingLeaf, null);
  // setLoose switches how an own answer is held
  const held = E.setLoose(E.decide(E.newWalk(4), 2, 'no').walk, 2, true).walk;
  assert.equal(held.lines[2].kind, 6);
  assert.equal(E.heldWord(held.lines[2]), 'held loosely: it could flip');
});

test('replay: same seed, same moves, same kinds; the hash round-trips; n continues the draws', () => {
  const play = seed => {
    let w = E.newWalk(seed);
    w = E.cast(w, 0, 'yarrow').walk; w = E.decide(w, 1, 'no', { loose: true }).walk;
    w = E.cast(w, 2, 'coins').walk; w = E.dontKnow(w, 3).walk; w = E.cast(w, 4, 'coin').walk;
    return w;
  };
  assert.deepEqual(play(4821), play(4821));
  const w = play(4821);
  const h = E.encodeHash(w, { person: 'example-a' });
  assert.match(h, /^#f1;L=[ynu-][dcy3u-][06789](\.[ynu-][dcy3u-][06789]){4};s=4821;n=3;p=example-a$/);
  const back = E.decodeHash(h);
  assert.deepEqual(back.walk, w);
  assert.equal(back.person, 'example-a');
  // three draws, shared, then two more == five draws straight
  let a = E.newWalk(99);
  a = E.cast(a, 0, 'coin').walk; a = E.cast(a, 1, 'yarrow').walk; a = E.cast(a, 2, 'coin').walk;
  let b = E.decodeHash(E.encodeHash(a)).walk;
  b = E.cast(b, 3, 'yarrow').walk; b = E.cast(b, 4, 'coins').walk;
  let c = E.newWalk(99);
  c = E.cast(c, 0, 'coin').walk; c = E.cast(c, 1, 'yarrow').walk; c = E.cast(c, 2, 'coin').walk;
  c = E.cast(c, 3, 'yarrow').walk; c = E.cast(c, 4, 'coins').walk;
  assert.deepEqual(b, c);
  // draw i is the rng advanced i times
  const r = E.rngFrom(99); r(); r();
  assert.equal(E.drawValue(99, 2), r());
  // garbage and inconsistent hashes are refused
  for (const bad of ['', '#f1;L=yd8.--0.--0.--0.--0;s=1;n=0', '#f1;L=yc9.--0.--0.--0.--0;s=1;n=0', '#f2;L=--0.--0.--0.--0.--0;s=1;n=0', '#f1;L=ud0.--0.--0.--0.--0;s=1;n=0'])
    assert.equal(E.decodeHash(bad), null, bad);
  assert.ok(E.decodeHash('#f1;L=--0.--0.--0.--0.--0;s=1;n=0'));
});

test('close the gap: only the open lines, alignment before containment, always a leaf', () => {
  for (let s = 1; s <= 200; s++) {
    const w = randomWalk(s);
    for (const way of ['coin', 'yarrow']) {
      const open = E.openLines(w);
      const r = E.closeTheGap(w, way);
      assert.equal(r.sequence.length, open.length);
      assert.deepEqual(r.steps.map(x => x.line), open);
      w.lines.forEach((l, i) => { if (!open.includes(i)) assert.deepEqual(r.walk.lines[i], l); });
      assert.equal(E.openLines(r.walk).length, 0);
      const L = E.landing(r.walk, leafFor);
      assert.ok(E.LEAVES.includes(L.leaf), 'close the gap lands on a leaf');
      assert.equal(E.counts(r.walk).open, 0);
      const ai = r.steps.findIndex(x => x.line === 2), ci = r.steps.findIndex(x => x.line === 3);
      if (ai >= 0 && ci >= 0) assert.ok(ai < ci);
      if (ci >= 0) {
        const al = r.steps[ci].walk.lines[2].answer;
        assert.equal(r.sequence[ci].node, al === 'no' ? 'containment-if-not' : 'containment-if-aligned');
      }
    }
  }
  const each = E.closeTheGap(E.dontKnow(E.newWalk(1), 3).walk, 'each');
  assert.deepEqual(each.prompts, [0, 1, 2, 3, 4]);
  const either = E.closeTheGap(E.newWalk(1), 'either', { leafFor, leafActions: LEAF_ACTIONS });
  assert.deepEqual(either.either.sharedFaces, ['bio-misuse', 'cyber', 'race']);
});

test('throw again re-casts only the device-cast lines, with their own methods', () => {
  let w = E.newWalk(12);
  w = E.decide(w, 0, 'yes').walk; w = E.cast(w, 2, 'yarrow').walk; w = E.cast(w, 3, 'coin').walk;
  const r = E.throwAgain(w);
  assert.deepEqual(r.steps.map(s => s.line), [2, 3]);
  assert.deepEqual(r.walk.lines[0], w.lines[0]);
  assert.equal(r.walk.lines[2].how, 'yarrow');
  assert.equal(r.walk.lines[3].how, 'coin');
  assert.equal(r.walk.n, w.n + 2);
  assert.equal(r.sequence[0].method, 'yarrow');
});

test('cast 100: counts sum to 100, snapshots, fixed when both leaf answers are decided', () => {
  const w = E.newWalk(4821);
  const snap = {
    coin: { proceed: 20, regulate: 26, contain: 22, shutdown: 32 },
    yarrow: { proceed: 33, regulate: 19, contain: 19, shutdown: 29 },
    'urn-new': { proceed: 27, regulate: 26, contain: 31, shutdown: 16 },
    'urn-one': { proceed: 95, regulate: 3, contain: 1, shutdown: 1 }
  };
  for (const d of Object.keys(snap)) {
    const r = E.cast100(w, d, leafFor);
    assert.equal(Object.values(r.counts).reduce((a, b) => a + b, 0), 100);
    assert.deepEqual(r.counts, snap[d], d);
    assert.equal(E.cast100(w, d, leafFor).counts.proceed, r.counts.proceed, 'deterministic from the seed');
  }
  // a new hidden urn each time looks like the coin: every leaf between 10 and 40 of 100, as the coin's
  const urn = E.cast100(w, 'urn-new', leafFor).counts;
  Object.values(urn).forEach(n => assert.ok(n >= 10 && n <= 40));
  // the gate as two coins lands yes about 1 time in 4; with one part decided yes, about 1 in 2
  assert.equal(E.cast100(w, 'coin', leafFor).gateYes, 23);
  const half = E.dontKnow(E.decide(w, 0, 'yes').walk, 1).walk;
  assert.equal(E.cast100(half, 'coin', leafFor).gateYes, 53);
  // the odds note: about 50 for one coin or draw, but one hidden jar's single draw gives its own hidden mix
  assert.match(E.gateSpreadLine(23, 'coin'), /one coin would give about 50/);
  assert.match(E.gateSpreadLine(23, 'yarrow'), /one draw would give about 50/);
  assert.ok(!E.gateSpreadLine(82, 'urn-one').includes('about 50'));
  assert.match(E.gateSpreadLine(82, 'urn-one'), /its hidden mix/);
  const fixed = E.decide(E.decide(w, 2, 'no').walk, 3, 'yes').walk;
  assert.deepEqual(E.cast100(fixed, 'coin', leafFor), { fixed: 'contain' });
  // the rule, in all 100: nothing decided, so the caution is on and every run lands on Shut down
  for (const d of Object.keys(snap)) {
    const r = E.cast100(w, d, leafFor);
    assert.equal(r.rule, 'shutdown', d); assert.equal(r.caution, true); assert.equal(r.ruleCounts.shutdown, 100);
    assert.match(E.ruleLine100(r, 'Shut down'), /^By the tree's rule: Shut down, in 100 of 100\./);
  }
  assert.match(E.drawnHead('coin'), /not landings/);
  // yarrow's turning is a whole count, never a decimal
  const y = E.cast100(w, 'yarrow', leafFor);
  assert.ok(Number.isInteger(y.turning) && Number.isInteger(y.linesDrawn));
  assert.equal(y.linesDrawn, 500);
  assert.ok(!/\d\.\d/.test(E.turningLine(y)), 'no decimal: ' + E.turningLine(y));
  // with an own no on the gate the runs are picks: no rule leaf, and the moot part is not re-cast
  const ordinary = E.decide(w, 0, 'no').walk;
  const o = E.cast100(ordinary, 'coin', leafFor);
  assert.equal(o.rule, null); assert.equal(o.caution, false); assert.equal(o.gateSettled, true);
  assert.ok(!o.recast.includes(1));
  assert.match(E.ruleLine100(o, ''), /picks/);
});

test('what holds either way', () => {
  // the race sits under every branch, so every leaf faces it
  for (const leaf of E.LEAVES) assert.ok(LEAF_ACTIONS.leaves[leaf].faces.includes('race'), leaf + ' faces the race');
  const all = E.eitherWay(E.LEAVES, LEAF_ACTIONS, null);
  // Contain and Shut down face misuse too (stopping recalls no released model; a caged model still has users)
  assert.deepEqual(all.sharedFaces, ['bio-misuse', 'cyber', 'race']);
  assert.match(all.sentence, /^Under every leaf still possible you face: bio misuse, cyber and the race\./);
  // the either-way words never claim a move that holds must aim at the shared dangers
  assert.match(E.TEXT.eitherDangers, /different danger under each leaf/);
  assert.equal(E.eitherWay([], LEAF_ACTIONS, null).sentence, E.TEXT.eitherNothing);
  // the page never says "no action": it says this compares dangers, not moves
  assert.match(E.TEXT.eitherDangers, /can't name the moves that hold, or say that none does/);
  const two = E.eitherWay(['proceed', 'regulate'], LEAF_ACTIONS, null);
  assert.deepEqual(two.sharedFaces, ['bio-misuse', 'cyber', 'reward-hacking', 'concentration-of-power', 'jobs', 'race']);
  assert.match(two.sentence, /^Under every leaf still possible you face: bio misuse, cyber, reward hacking, concentration of power, jobs and the race\./);
  assert.deepEqual(two.sharedIdeas, []);
  const withData = E.eitherWay(['proceed', 'regulate'], LEAF_ACTIONS, FIXTURE);
  assert.ok(withData.sharedIdeas.length > 0);
  assert.deepEqual(E.eitherWay(['contain', 'shutdown'], LEAF_ACTIONS, null).sharedFaces, ['takeoff', 'takeover', 'existential-risk', 'bio-misuse', 'cyber', 'race']);
});

test('actions on the made-up fixture', () => {
  const noData = E.actionsFor(['contain'], { race: 'yes' }, LEAF_ACTIONS, null);
  assert.match(noData.contain.noData.text, /^uncertainty: no known mechanism;/);
  assert.equal(noData.contain.noData.class, 'none');
  assert.equal(noData.contain.outcomes, undefined);
  const r = E.actionsFor(E.LEAVES, { race: 'no' }, LEAF_ACTIONS, FIXTURE);
  for (const leaf of E.LEAVES) for (const o of r[leaf].outcomes) {
    assert.ok(o.ideas.length > 0 || o.verdict === 'uncertainty: no known mechanism' || o.verdict.startsWith('gap'),
      leaf + ' ' + o.id + ' shows ideas, no known mechanism, or a gap');
  }
  const cls = id => r.proceed.outcomes.concat(r.regulate.outcomes, r.contain.outcomes, r.shutdown.outcomes).find(o => o.id === id).class;
  assert.equal(cls('bio-misuse'), 'targeted');
  assert.equal(cls('cyber'), 'partial');
  assert.equal(cls('concentration-of-power'), 'weak');
  assert.equal(cls('jobs'), 'gap');
  assert.equal(cls('deception'), 'none');
  assert.equal(cls('race'), 'targeted');
  const ideas = {}; r.proceed.outcomes.concat(r.regulate.outcomes).forEach(o => o.ideas.forEach(x => { ideas[x.id] = x; }));
  assert.equal(ideas['fixture-law'].onTheBooks, true);
  assert.equal(ideas['fixture-regulation'].onTheBooks, true);
  assert.equal(ideas['chip-export-controls'].onTheBooks, true);          // 'agency'
  assert.equal(ideas['fixture-roadmap'].onTheBooks, false);              // 'agency roadmap', 'agency (voluntary agreements)'
  assert.equal(ideas['fixture-not-yet'].onTheBooks, false);
  assert.equal(ideas['fixture-not-yet'].notYet, true);
  assert.deepEqual(ideas['fixture-not-yet'].statuses, ['law (not yet applying; January 2027)', 'law (applies from Dec 9, 2026)']);
  assert.equal(ideas['fixture-roadmap'].checkSources, true);
  assert.equal(ideas['fixture-roadmap'].verifyCount, 2);
  assert.equal(ideas['fixture-law'].checkSources, false);
  assert.equal(ideas['treaty-ban'].needsOthers, true);
  assert.equal(ideas['chip-export-controls'].raceAccelerant, true);
  // race yes: ideas that need others go first; race no: the file's order
  const raceOf = ans => E.actionsFor(['regulate'], { race: ans }, LEAF_ACTIONS, FIXTURE).regulate.outcomes.find(o => o.id === 'race');
  assert.deepEqual(raceOf('yes').ideas.map(x => x.id), ['treaty-ban', 'voluntary-moratorium', 'fixture-law', 'chip-export-controls']);
  assert.equal(raceOf('yes').order, 'needs-others-first');
  assert.deepEqual(raceOf('no').ideas.map(x => x.id), ['fixture-law', 'treaty-ban', 'voluntary-moratorium', 'chip-export-controls']);
  assert.equal(raceOf('unknown').order, 'both-groups');
});

test('line 6: "is a lever KNOWN TO WORK?" reads yielding and turning for every leaf, with or without data', () => {
  const ed = E.LEAVES.map(l => E.line6For(l, LEAF_ACTIONS, null).kind);
  assert.deepEqual(ed, [6, 6, 6, 6]);
  const data = E.LEAVES.map(l => E.line6For(l, LEAF_ACTIONS, FIXTURE).kind);
  assert.deepEqual(data, [6, 6, 6, 6]);
  // "targeted" means aimed at, not shown to work: no line 6 is firm (a firm line would draw "aimed at" as "works")
  for (const leaf of E.LEAVES) assert.ok(!E.isFirm(E.line6For(leaf, LEAF_ACTIONS, null).kind), leaf);
  // Shut down's open question is the race, not "no known mechanism"; its gloss keeps "slow down enough to find out"
  assert.deepEqual(LEAF_ACTIONS.leaves.shutdown.main, ['race']);
  assert.ok(!LEAF_ACTIONS.leaves.shutdown.if_no_data.text.startsWith('uncertainty: no known mechanism'));
  assert.match(LEAF_ACTIONS.leaves.shutdown.gloss, /slow down enough to find out/);
  assert.ok(!/none has been tried/.test(JSON.stringify(LEAF_ACTIONS)), 'no absolute "none has been tried"');
  // Regulate faces reward hacking as Proceed does (both are alignment yes)
  assert.ok(LEAF_ACTIONS.leaves.regulate.faces.includes('reward-hacking'));
  const bare = JSON.parse(JSON.stringify(FIXTURE));
  bare.outcomes.find(o => o.id === 'deception').if_controllable = [];
  assert.equal(E.line6For('contain', LEAF_ACTIONS, bare).kind, 8);
  // each leaf says how its own line could turn (contain's is not "a proposal became law": laws aimed at it exist)
  for (const leaf of E.LEAVES) assert.ok(LEAF_ACTIONS.leaves[leaf].line6.turn, leaf + ' has its own turn text');
  assert.ok(!E.line6Sentence(E.line6For('contain', LEAF_ACTIONS, null)).includes('became law'));
  assert.match(E.line6Sentence({ kind: 6 }), /^Line 6, our reading \(not cast\): yielding, turning: no lever shown to work against the main danger\. It could turn/);
  assert.match(E.line6Sentence({ kind: 9 }), /^Line 6, our reading \(not cast\): firm, turning: a lever is known to work/);
  assert.match(E.line6Sentence({ kind: 6 }, 'tree'), /^Our reading: no lever shown to work/);
  assert.ok(![6, 7, 8, 9].some(k => /looked up|a known action/.test(E.line6Sentence({ kind: k }))), 'never "looked up" or "a known action"');
});

test('Cast 100 replies: each pick hears whether it fits, and the reason is not "someone made it"', () => {
  for (const d of Object.keys(E.DEVICES)) {
    const said = Object.keys(E.RISK_PICKS).map(p => E.riskReply(p, d));
    assert.equal(new Set(said).size, 3, d + ': the three picks get three different replies');
  }
  assert.ok(!E.RISK_REPLY.coin.includes("weren't made by anyone"));
  assert.match(E.RISK_REPLY.coin, /no pile of like cases/);
  assert.match(E.countsSummary({ decided: 2, cast: 3, open: 0 }), /of 5 answers/);
  assert.match(E.countsSummary({ decided: 2, cast: 3, open: 0 }, 'lines'), /of lines 1 to 5/);
});

test('walk it as a person (the made-up examples)', () => {
  const a = E.personWalk(PEOPLE[0], leafFor);
  assert.deepEqual(a.steps.map(s => s.node), ['gate', 'alignment', 'containment-if-aligned', 'race']);
  assert.equal(a.computedLeaf, 'regulate');
  assert.equal(a.stated_leaf, 'proceed');
  assert.equal(a.mismatch, true);
  assert.equal(a.steps[0].quote.verbatim, false);
  const b = E.personWalk(PEOPLE[1], leafFor);
  assert.equal(b.computedLeaf, null);
  assert.equal(b.mismatch, false);
  assert.deepEqual(b.possible, ['proceed', 'contain']);
  assert.equal(b.answers.race, 'no');
  // race given as a plain string is accepted
  assert.equal(E.personWalk({ ...PEOPLE[0], race: 'no' }, leafFor).answers.race, 'no');
  const w = E.walkFromPerson(PEOPLE[0], E.newWalk(5));
  assert.equal(E.answersOf(w).gate, 'yes');
  assert.equal(E.landing(w, leafFor).leaf, 'regulate');
  assert.equal(w.seed, 5);
  const firstTwo = E.walkFromPerson(PEOPLE[0], E.newWalk(5), 1);
  assert.equal(firstTwo.lines[3].answer, null);
  for (const p of PEOPLE) {
    assert.ok(p.cautions.includes('A made-up example to test the walk. Not a real person.'));
    p.quotes.forEach(q => { assert.equal(q.verbatim, false); assert.equal(q.video_id, null); assert.equal(q.how_checked, 'placeholder'); });
  }
});

test('no percent sign in any formatter output or string constant', () => {
  const outs = [];
  for (const d of Object.keys(E.DEVICES)) {
    outs.push(E.countsLabel(31, d), E.spreadLabel(d), E.gateSpreadLine(24, d));
    for (const p of Object.keys(E.RISK_PICKS)) outs.push(E.riskReply(p, d));
  }
  outs.push(E.countsSummary({ decided: 1, cast: 2, open: 2, moot: 1 }), E.flipText('Shut down'), E.throwSameText('Contain'),
    E.drawnHead('coin'), E.ruleLine100({ rule: 'shutdown', runs: 100 }, 'Shut down'), E.ruleLine100({ rule: null }, ''),
    E.turningLine({ turning: 131, linesDrawn: 500 }));
  for (let s = 1; s <= 60; s++) outs.push(...E.ruleText(E.landing(randomWalk(s), leafFor), l => E.leafName(l)));
  ['yes', 'no', 'unknown', null].forEach(r => E.LEAVES.forEach(l => outs.push(E.raceNote(r, l, true))));
  [6, 7, 8, 9].forEach(k => outs.push(E.line6Sentence({ kind: k }), E.line6Sentence({ kind: k }, 'tree')));
  outs.push(JSON.stringify(E.RISK_VERDICT));
  outs.push(E.eitherWay(['proceed', 'regulate'], LEAF_ACTIONS, null).sentence, E.eitherWay(['proceed'], LEAF_ACTIONS, null).sentence);
  const w = randomWalk(3); ['gate', 'race', 'alignment'].forEach(q => outs.push(E.afterLine(q, w)));
  w.lines.forEach(l => outs.push(E.heldWord(l)));
  outs.push(JSON.stringify([E.TEXT, E.RISK_REPLY, E.RISK_PICKS, E.DEVICES, E.QUESTIONS, E.TREE_QUESTIONS, E.LINES, E.METHODS, S.NODES]));
  outs.forEach(s => assert.ok(!String(s).includes('%'), 'percent sign in: ' + s));
  assert.equal(E.countsLabel(31, 'coin'), '31 of 100 coins');
  // whole files that hold words: none may contain a percent sign (CSS lives in fork.css and in the stand-in's style)
  for (const f of ['../game/fork/fork-engine.js', '../game/fork/fork-ui.js', '../game/fork/index.html', '../game/fork/tree-adapter.js',
    '../game/fork/data/leaf-actions.json', '../game/fork/people.example.json']) {
    const src = readFileSync(here(f), 'utf8');
    assert.ok(!src.includes('%'), f + ' contains a percent sign');
  }
});

test('pickTree: film when present and whole, stand-in otherwise, with a warning', async () => {
  const { pickTree, SOURCE, renderTree, NODES, leafFor: lf } = await import('../game/fork/tree-adapter.js');
  assert.equal(SOURCE, 'standin');               // explainers/belief-tree is not on this branch
  assert.equal(typeof renderTree, 'function'); assert.ok(NODES); assert.equal(typeof lf, 'function');
  const STANDIN = '../game/fork/tree-render-standin.js';
  const base = import.meta.url;
  const warns = [];
  const orig = console.warn; console.warn = m => warns.push(m);
  try {
    let r = await pickTree(['./fixtures/no-such-module.mjs', STANDIN], base);
    assert.equal(r.path, STANDIN);
    assert.equal(warns.length, 1);
    r = await pickTree(['./fixtures/tree-stub-ok.mjs', STANDIN], base);
    assert.equal(r.path, './fixtures/tree-stub-ok.mjs');
    warns.length = 0;
    r = await pickTree(['./fixtures/tree-stub-missing.mjs', STANDIN], base);
    assert.equal(r.path, STANDIN);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /missing export/);
    await assert.rejects(pickTree(['./fixtures/tree-stub-missing.mjs'], base));
  } finally { console.warn = orig; }
});

// The Film chat's renderer, once film/belief-tree is merged: the game's contract checked against the real module.
// Skipped while explainers/belief-tree is not on this branch (checked by hand against film/belief-tree @ 041ae0a).
const FILM_PATH = '../explainers/belief-tree/tree-render.js';
test('the film renderer: nine ids, the same leaves, names the game can speak', { skip: existsSync(here(FILM_PATH)) ? false : 'explainers/belief-tree is not on this branch' }, async () => {
  const F = await import(FILM_PATH);
  assert.equal(typeof F.renderTree, 'function');
  assert.deepEqual(E.checkNodes(F.NODES, () => {}), []);
  for (const a of ['yes', 'no']) for (const c of ['yes', 'no'])
    assert.equal(F.leafFor({ alignment: a, containment: c }), leafFor({ alignment: a, containment: c }));
  for (const open of [null, 'unknown']) assert.equal(F.leafFor({ alignment: open, containment: 'yes' }), null);
  for (const l of E.LEAVES) assert.ok(E.leafName(l, F.NODES, F.LEAF_LABEL || null).length > 1);
  if (F.LEAF_LABEL) assert.equal(E.leafName('regulate', F.NODES, F.LEAF_LABEL), F.LEAF_LABEL.regulate);
});
