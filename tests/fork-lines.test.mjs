// node --test "tests/*.test.mjs"   (no dependencies). The Fork's six-lines view: the copied bowl and hexagram data,
// and the relating reading (game/fork/bowl.js). Walk to a leaf is the engine's walkToLeaf, tested in
// tests/fork-engine.test.mjs. The page itself (lines.html, lines-ui.js) is checked in the browser; here only that
// its files hold no percent sign.
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
// line 6 read the way lines-ui.js does it: the leaf for lines 3 and 4, then the page's own (editorial) line 6
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

test('line 6 is our reading, never drawn: the editorial kinds per leaf', () => {
  assert.equal(line6At([7, 7, 7, 7, 7]), 6);   // proceed: yielding, turning (no lever shown to work)
  assert.equal(line6At([7, 7, 7, 8, 7]), 6);   // regulate
  assert.equal(line6At([7, 7, 8, 7, 7]), 6);   // contain
  assert.equal(line6At([7, 7, 8, 8, 7]), 6);   // shutdown
});

test('the relating reading: turning lines flip one at a time, bottom to top, and end where the tradition does', () => {
  let n = 0;
  for (const k5 of allFive()) {
    const kinds = whole(k5), steps = B.relatingSteps(kinds, line6At);
    assert.deepEqual(steps[0].kinds, kinds);
    const flips = steps.slice(1).map(s => s.flipped);
    const turning = [0, 1, 2, 3, 4, 5].filter(i => B.isTurning(kinds[i]));
    // the number of steps is the number of turning lines the hexagram shows, line 6 included: the header's count
    assert.deepEqual(flips, turning, 'bottom to top, each turning line once, line 6 last');
    // each step changes exactly one line: nothing turns that was not turning
    steps.slice(1).forEach((s, k) => assert.equal(B.hamming(B.bits(steps[k].kinds), B.bits(s.kinds)), 1));
    // every step passes through a real hexagram
    steps.forEach(s => { assert.ok(B.isWhole(s.kinds)); assert.ok(B.hexOf(B.bits(s.kinds))); });
    const end = steps[steps.length - 1].kinds;
    // all six lines end as the tradition's relating hexagram has them (every turning line changed at once)
    assert.equal(B.bits(end), B.bits(kinds, true));
    assert.equal(steps[steps.length - 1].lookedUp, line6At(end.slice(0, 5)));
    // the relating leaf agrees with the engine's
    const w = E.newWalk(1);
    k5.forEach((k, i) => { w.lines[i] = { answer: yn(k), how: 'decide', kind: k }; });
    const rel = E.relating(w, leafFor);
    if (turning.some(i => i < 5)) assert.equal(leafFor({ alignment: yn(end[2]), containment: yn(end[3]) }), rel.relatingLeaf);
    assert.ok(end.every(k => !B.isTurning(k)), 'nothing left turning');
    n++;
  }
  assert.equal(n, 1024);
});

test('no percent sign in the six-lines files', () => {
  for (const f of ['../game/fork/bowl.js', '../game/fork/lines-ui.js', '../game/fork/lines.html']) {
    assert.ok(!readFileSync(here(f), 'utf8').includes('%'), f + ' contains a percent sign');
  }
});
