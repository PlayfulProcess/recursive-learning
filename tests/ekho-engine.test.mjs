// node --test "tests/*.test.mjs"   (no dependencies)
// Recursive Ekho's engine (game/ekho/engine.js): determinism, a Council that can go either way, every
// ending reachable, and a balance that stays in a band. Ranges, never exact values: the numbers are
// about this toy's play, nothing about the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const E = require('../game/ekho/engine.js');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// the page's first-game setup: three players, fair tide, fair world, no young AI
const BASE = { players: 3, tide: 'fair', tilt: 'fair', mode: 'commons' };
const table = (h, n = 3) => Array(n).fill(h);
function play(o, habits) { const g = E.newGame(o); E.run(g, E.tableChooser(habits)); return g; }
function batch(o, habits, games, seed0 = 1) {
  const out = [];
  for (let s = seed0; s < seed0 + games; s++) out.push(play({ ...o, seed: s }, habits));
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const passRate = (gs) => gs.reduce((s, g) => s + g.stats.passed, 0) / gs.reduce((s, g) => s + g.stats.councils, 0);
const goodOdds = (gs) => mean(gs.map((g) => g.over.good));
const drawn = (gs, hollow) => gs.filter((g) => g.over.hollow === hollow).length / gs.length;

const GREEDY = batch(BASE, table('greedy'), 600);
const RANDOM = batch(BASE, table('random'), 600);

test('rules version 4, and the page shows the engine it inlines', () => {
  assert.equal(E.consts.VERSION, 4);
  const html = readFileSync(here('../game/ekho/index.html'), 'utf8');
  const eng = readFileSync(here('../game/ekho/engine.js'), 'utf8');
  const start = html.indexOf('<script>// Recursive Ekho, the board game: the rules as code');
  assert.ok(start > 0, 'the inline engine block is in index.html');
  const inline = html.slice(start + '<script>'.length, html.indexOf('</script>', start));
  assert.equal(inline, eng, 'index.html carries engine.js byte for byte (copy it in after every engine change)');
  assert.match(html, /Rules version <span id="ver">4<\/span>/);
});

test('deterministic from a seed: the same deal plays the same game', () => {
  for (const habits of [table('greedy'), table('random'), ['racer', 'greedy', 'rival']]) {
    for (const seed of [1, 7, 12345]) {
      const a = play({ ...BASE, seed }, habits), b = play({ ...BASE, seed }, habits);
      assert.deepEqual(a.log, b.log);
      assert.deepEqual(a.over, b.over);
    }
  }
  const logs = new Set([1, 2, 3, 4, 5].map((s) => play({ ...BASE, seed: s }, table('greedy')).log.join('\n')));
  assert.ok(logs.size > 1, 'different seeds deal different games');
});

test('the Council is a decision: it passes in some rounds and fails in others', () => {
  const pass = passRate(GREEDY);
  assert.ok(pass > 0.35 && pass < 0.9, `careful table passes ${pass}`);
  assert.ok(GREEDY.some((g) => g.stats.passed > 0 && g.stats.passed < g.stats.councils), 'one game holds both a pass and a fail');
  assert.ok(GREEDY.some((g) => g.stats.passed === g.stats.councils), 'some games pass every Council');
  // how the table plays moves it: careful > random > a table that always votes Build
  const random = passRate(RANDOM), racer = passRate(batch(BASE, table('racer'), 200));
  assert.ok(pass > random + 0.15, `careful ${pass} vs random ${random}`);
  assert.equal(racer, 0);
  // with the share above one, the table's own votes alone cannot pass it: Together must be banked first
  for (let n = 1; n <= 4; n++) {
    const g = E.newGame({ ...BASE, players: n, seed: 1 });
    assert.equal(E.councilNeed(g), n + 1, `${n} players`);
    g.together = 1; assert.equal(E.councilNeed(g), n);
  }
});

test('every ending can be drawn, Still walking included', () => {
  for (const h of E.HOLLOWS) {
    assert.ok(GREEDY.concat(RANDOM).some((g) => g.over.hollow === h), `${E.HOLLOW_NAME[h]} reached`);
  }
  const still = drawn(GREEDY, 'still'), stillRandom = drawn(RANDOM, 'still');
  assert.ok(still > 0.01 && still < 0.08, `careful table draws Still walking ${still}`);
  assert.ok(stillRandom > 0.02 && stillRandom < 0.15, `random table draws Still walking ${stillRandom}`);
  // Still walking is reachable by a human, too: a table of other habits (one racer, the rest careful)
  assert.ok(batch(BASE, ['racer', 'greedy', 'greedy'], 400).some((g) => g.over.hollow === 'still'));
});

test('balance stays in a band', () => {
  const good = goodOdds(GREEDY), random = goodOdds(RANDOM);
  assert.ok(good > 0.6 && good < 0.82, `careful good odds ${good}`);
  assert.ok(random > 0.25 && random < 0.55, `random good odds ${random}`);
  assert.ok(goodOdds(batch(BASE, table('racer'), 200)) < 0.3, 'a table that races does worse');
  for (const h of ['grace', 'turn', 'stop', 'adolescence', 'lockin', 'doom']) {
    const p = drawn(GREEDY, h);
    assert.ok(p > 0.02 && p < 0.5, `${E.HOLLOW_NAME[h]} drawn ${p}`);
  }
  const rounds = mean(GREEDY.map((g) => g.round));
  assert.ok(rounds > 4 && rounds < 9, `rounds ${rounds}`);
  // the difficulty dials do what they say: a gentle tide in a kind world beats a dire tide in a harsh one
  const easy = goodOdds(batch({ ...BASE, tide: 'gentle', tilt: 'kind' }, table('greedy'), 300));
  const hard = goodOdds(batch({ ...BASE, tide: 'dire', tilt: 'harsh' }, table('greedy'), 300));
  assert.ok(easy > hard + 0.1, `easy ${easy} vs hard ${hard}`);
  // every table size still plays to an ending with a passable Council
  for (const n of [1, 2, 4]) {
    const gs = batch({ ...BASE, players: n }, table('greedy', n), 200);
    assert.ok(gs.every((g) => g.over), `${n} players end`);
    const p = passRate(gs);
    assert.ok(p > 0.25 && p < 0.95, `${n} players pass ${p}`);
  }
});
