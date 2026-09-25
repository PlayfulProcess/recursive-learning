// node --test "tests/*.test.mjs"   (no dependencies). The Fork's six-lines view: the copied bowl and hexagram data,
// the relating reading and Walk to a leaf (game/fork/bowl.js). The page itself (lines.html, lines-ui.js) is checked
// in the browser; here only that its files hold no percent sign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as B from '../game/fork/bowl.js';
import * as E from '../game/fork/fork-engine.js';
import { leafFor } from '../game/fork/tree-render-standin.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const LEAF_ACTIONS = JSON.parse(readFileSync(here('../game/fork/data/leaf-actions.json'), 'utf8'));
const yn = k => (B.isFirm(k) ? 'yes' : 'no');
// line 6 looked up the way lines-ui.js does it: the leaf for lines 3 and 4, then the editorial line 6
const line6At = k5 => {
  const leaf = leafFor({ alignment: yn(k5[2]), containment: yn(k5[3]) });
  return E.line6For(leaf, LEAF_ACTIONS, null).kind;
};
const KINDS = [6, 7, 8, 9];
function* allFive() { for (const a of KINDS) for (const b of KINDS) for (const c of KINDS) for (const d of KINDS) for (const e of KINDS) yield [a, b, c, d, e]; }
const whole = k5 => [...k5, line6At(k5)];

test('the copied data: 64 hexagrams, 64 distinct lines, bowls of 16 as in Changing Lines', () => {
  assert.equal(B.HEX.length, 64);
  assert.equal(Object.keys(B.BY_BITS).length, 64);
  B.HEX.forEach((x, i) => { assert.equal(x[0], i + 1); assert.match(x[4], /^[01]{6}$/); });
  assert.equal(B.hexOf('111111')[1], 'The Creative');
  assert.equal(B.hexOf('101010')[0], 63);
  assert.equal(B.listOf(B.START.yarrow).length, 16);
  assert.equal(B.listOf(B.START.coins).length, 16);
  assert.equal(B.firm(B.START.yarrow), 8); assert.equal(B.turning(B.START.yarrow), 4);
  assert.equal(B.firm(B.START.coins), 8); assert.equal(B.turning(B.START.coins), 4);
  assert.equal(B.PLACES.length, 6);
  B.PLACES.forEach(p => { assert.deepEqual(Object.keys(p).sort(), ['nm', 'tr']); });   // not Changing Lines' `ai`
  assert.equal('afterDraw' in B, false);
});

test("the drawn marble: the engine's draw and the bowl on screen agree, marble for marble", () => {
  for (const m of ['yarrow', 'coins']) {
    assert.deepEqual(B.listOf(B.START[m]), E.listOf(E.METHODS[m].bowl), m + ': same marbles in the same order');
    let w = E.newWalk(4821);
    for (let t = 0; t < 40; t++) {
      const r = E.cast(w, t - Math.floor(t / 5) * 5, m);
      const l = r.walk.lines[t - Math.floor(t / 5) * 5];
      const index = Math.floor(E.drawValue(r.walk.seed, r.walk.n - 1) * 16);
      assert.equal(B.listOf(B.START[m])[index], l.kind);
      w = r.walk;
    }
  }
  assert.deepEqual(B.listOf({ 6: 0, 7: 1, 8: 1, 9: 0 }), E.listOf(E.METHODS.coin.bowl));
});

test('line 6 is looked up, never drawn: the editorial kinds per leaf', () => {
  assert.equal(line6At([7, 7, 7, 7, 7]), 7);   // proceed
  assert.equal(line6At([7, 7, 7, 8, 7]), 9);   // regulate
  assert.equal(line6At([7, 7, 8, 7, 7]), 6);   // contain
  assert.equal(line6At([7, 7, 8, 8, 7]), 6);   // shutdown
});

test('the relating reading: turning lines flip one at a time, bottom to top, and end where the tradition does', () => {
  let n = 0;
  for (const k5 of allFive()) {
    const kinds = whole(k5), steps = B.relatingSteps(kinds, line6At);
    assert.deepEqual(steps[0].kinds, kinds);
    const flips = steps.slice(1).map(s => s.flipped);
    const turning5 = [0, 1, 2, 3, 4].filter(i => B.isTurning(kinds[i]));
    assert.deepEqual(flips.filter(i => i < 5), turning5, 'bottom to top, each turning line once');
    // every step passes through a real hexagram
    steps.forEach(s => { assert.ok(B.isWhole(s.kinds)); assert.ok(B.hexOf(B.bits(s.kinds))); });
    const end = steps[steps.length - 1].kinds;
    // lines 1 to 5 end as the tradition's relating hexagram has them (every turning line changed)
    assert.equal(B.bits(end).slice(0, 5), B.bits(kinds, true).slice(0, 5));
    // the relating leaf agrees with the engine's
    const w = E.newWalk(1);
    k5.forEach((k, i) => { w.lines[i] = { answer: yn(k), how: 'decide', kind: k }; });
    const rel = E.relating(w, leafFor);
    if (turning5.length) assert.equal(leafFor({ alignment: yn(end[2]), containment: yn(end[3]) }), rel.relatingLeaf);
    // line 6 is looked up again after each flip; its own turning, if any, is the last step
    const last = steps[steps.length - 1];
    if (last.flipped === 5) { assert.ok(B.isTurning(steps[steps.length - 2].kinds[5])); assert.ok(!B.isTurning(end[5])); }
    else assert.ok(!B.isTurning(end[5]));
    assert.ok(end.every(k => !B.isTurning(k)), 'nothing left turning');
    n++;
  }
  assert.equal(n, 1024);
});

test('walk to a leaf: always arrives, flips only lines 3 and 4, at most two steps; line 6 looked up after each', () => {
  const want = { proceed: ['yes', 'yes'], regulate: ['yes', 'no'], contain: ['no', 'yes'], shutdown: ['no', 'no'] };
  let seed = 1;
  for (const k5 of allFive()) {
    const kinds = whole(k5);
    for (const leaf of Object.keys(want)) {
      const [a, c] = want[leaf];
      const r = B.leafWalk(kinds, { alignment: a, containment: c }, B.rngFrom(seed++), line6At);
      const end = r.steps[r.steps.length - 1].kinds;
      assert.equal(leafFor({ alignment: yn(end[2]), containment: yn(end[3]) }), leaf, 'arrives');
      assert.ok(r.d <= 2 && r.steps.length - 1 === r.d, 'at most two steps, exactly d');
      r.steps.slice(1).forEach(s => assert.ok(s.flipped === 2 || s.flipped === 3, 'only lines 3 and 4'));
      for (const i of [0, 1, 4]) assert.equal(end[i], kinds[i], 'lines 1, 2 and 5 unchanged');
      r.steps.forEach(s => { assert.equal(s.kinds[5], line6At(s.kinds.slice(0, 5))); assert.ok(B.hexOf(B.bits(s.kinds))); });
      if (leafFor({ alignment: yn(kinds[2]), containment: yn(kinds[3]) }) === leaf) assert.equal(r.d, 0, "already there");
    }
  }
});

test('walk to a leaf is seeded: the same seed gives the same order of flips', () => {
  const kinds = whole([7, 7, 7, 8, 7]);   // regulate: to contain is two flips, in either order
  const order = s => B.leafWalk(kinds, { alignment: 'no', containment: 'yes' }, B.rngFrom(s), line6At).steps.slice(1).map(x => x.flipped).join('');
  for (let s = 1; s < 50; s++) assert.equal(order(s), order(s));
  const seen = new Set(); for (let s = 1; s < 200; s++) seen.add(order(s));
  assert.deepEqual([...seen].sort(), ['23', '32']);
});

test('buildPath (direct): the final flip is fixed, so it always arrives', () => {
  const r = B.rngFrom(7);
  for (let t = 0; t < 500; t++) {
    const o = Array.from({ length: 6 }, () => (r() < 0.5 ? '1' : '0')).join('');
    const d = Array.from({ length: 6 }, () => (r() < 0.5 ? '1' : '0')).join('');
    const p = B.buildPath(o, d, B.hamming(o, d), r);
    assert.equal(p[p.length - 1].binary, d);
    assert.equal(p.length - 1, B.hamming(o, d));
  }
});

test('no percent sign in the six-lines files', () => {
  for (const f of ['../game/fork/bowl.js', '../game/fork/lines-ui.js', '../game/fork/lines.html']) {
    assert.ok(!readFileSync(here(f), 'utf8').includes('%'), f + ' contains a percent sign');
  }
});
