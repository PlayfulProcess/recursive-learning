#!/usr/bin/env node
// potato_solve.mjs: is there a real choice in Hot Potato? Run from anywhere:
//
//   node --max-old-space-size=6000 game/tools/potato_solve.mjs      (under a minute)
//
// It plays game/potato-model.js (the page's own rules) three ways, over all 16 hidden draws
// (4 or 5 pairs of hands, fire at 15 or 16, Wren waits 1, 2, 3 or 4 moves; all equally likely):
//   1. the best possible play for someone who can't see the hidden numbers (it only sees what the
//      page shows, and learns from Wren's "not yet"), found by searching every move up to 15 presses;
//   2. one button pressed over and over (the round-1 testers' winning line was Together every move);
//   3. random presses, with and without tossing.
// It prints the best play against each draw, and how often it needs Hold, I don't know and Toss.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const M = createRequire(import.meta.url)(join(here, '..', 'potato-model.js'));
const DEPTH = 15;

const draws = [];
for (const n of M.NEEDS) for (const b of M.BURNS) for (const w of M.WAITS) draws.push([n, b, w]);
const fresh = d => M.create(...d);
const copy = s => Object.assign({}, s, { on: s.on.slice(), hands: Object.assign({}, s.hands), log: [],
  joined: s.joined.slice(), refusedHot: s.refusedHot.slice() });
const after = (s, v) => { const t = copy(s); M.step(t, v); return t; };
// What the page shows: flames, what Wren has seen, who holds it, every pair of hands, the ending,
// and whether Put it down is showing.
const shown = s => [s.F, s.seen, s.on.join(''), M.SEATS.map(k => s.hands[k]).join(''), s.out || '',
  s.out ? '' : (M.enough(s) && s.on.length > 1 ? 'D' : '')].join('|');

const memo = new Map();
function best(states, d) {                        // states: [drawIndex, state][], all showing the same
  const key = shown(states[0][1]) + '#' + states.map(x => x[0]).join('.') + '#' + d;
  if (memo.has(key)) return memo.get(key);
  let top = [0, null];
  if (d > 0) for (const v of M.offered(states[0][1])) {
    const groups = new Map();
    for (const [i, s] of states) { const t = after(s, v), k = shown(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([i, t]); }
    let val = 0;
    for (const g of groups.values()) {
      const o = g[0][1].out;
      if (o === 'down') val += g.length;
      else if (!o) val += g.length * (best(g, d - 1)[0] - 1e-4);     // a shorter win is a little better
    }
    val /= states.length;
    if (val > top[0] + 1e-12 || top[1] === null) top = [val, v];
  }
  memo.set(key, top);
  return top;
}
function playBest(di) {
  let belief = draws.map((d, i) => [i, fresh(d)]), s = fresh(draws[di]); const moves = [];
  for (let d = DEPTH; d > 0 && !s.out; d--) {
    const v = best(belief, d)[1];
    s = after(s, v); moves.push(v);
    const k = shown(s);
    belief = belief.map(([i, x]) => [i, after(x, v)]).filter(([, x]) => shown(x) === k);
  }
  return { out: s.out, F: s.F, moves };
}
function play(pick, d, seed) {
  let s = fresh(d), n = 0, r = seed * 7919 + 1;
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  while (!s.out && !s.hopeless && n++ < 40) s = after(s, pick(s, rnd));
  return s.out === 'down';
}
const rate = (pick, reps = 1) => { let w = 0; for (let r = 0; r < reps; r++) draws.forEach(d => { w += play(pick, d, r); }); return w / (draws.length * reps); };
const spam = v => s => { const o = M.offered(s); return o.includes('down') ? 'down' : o.includes(v) ? v : o.includes('idk') ? 'idk' : o[0]; };
const random = noToss => (s, rnd) => { const o = M.offered(s).filter(v => !noToss || v !== 'toss'); return o[Math.floor(rnd() * o.length)]; };

const t0 = Date.now();
const opt = best(draws.map((d, i) => [i, fresh(d)]), DEPTH)[0];
const use = { hold: 0, idk: 0, toss: 0 }, lines = []; let won = 0;
draws.forEach((d, i) => {
  const r = playBest(i);
  for (const k in use) use[k] += r.moves.includes(k);
  won += r.out === 'down';
  lines.push(`  pairs ${d[0]}  fire ${d[1]}  Wren waits ${d[2]}: ${String(r.out).padEnd(6)} at ${String(r.F).padStart(2)} flames  ${r.moves.join(' ')}`);
});
console.log(`Best play without seeing the hidden numbers wins ${won} of ${draws.length} draws (search value ${opt.toFixed(3)}; a tiny cost per press makes shorter wins count a little more).`);
console.log(`The same button every move: Together ${(100 * rate(spam('together'))).toFixed(0)}%, Hold ${(100 * rate(spam('hold'))).toFixed(0)}%, ` +
  `I don't know ${(100 * rate(spam('idk'))).toFixed(0)}%, Toss ${(100 * rate(spam('toss'))).toFixed(0)}%.`);
console.log(`Random presses ${(100 * rate(random(false), 200)).toFixed(0)}%; random presses that never toss ${(100 * rate(random(true), 200)).toFixed(0)}%.`);
console.log(`Best play uses Hold in ${Math.round(100 * use.hold / draws.length)}% of games, I don't know in ${Math.round(100 * use.idk / draws.length)}%, Toss in ${Math.round(100 * use.toss / draws.length)}%.`);
console.log(lines.join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
