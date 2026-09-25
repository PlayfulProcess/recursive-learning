#!/usr/bin/env node
// potato_solve.mjs: is Hot Potato v3.2 fair, and does it ask for real choices? Run from anywhere:
//
//   node game/tools/potato_solve.mjs          (a few seconds)
//
// It plays game/potato-model.js (the page's own rules) for the three rounds and every random round
// (start 2 to 5 flames, Wren wants 2 to 5 holds), with the fire at 15 or 16:
//   1. the coolest safe play (the lowest "hottest it got", the page's score), found by searching
//      every sequence of offered moves (safe = it never reaches 15 flames, so it wins wherever the
//      fire is), compared with the page's "coolest possible" line (put it down > ask > hold > bounce);
//   2. one toss (then two) slipped into that play at every point: does it still win?
//   3. one button pressed over and over, and random presses, with and without tossing.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const M = createRequire(import.meta.url)(join(here, '..', 'potato-model.js'));
const DEPTH = 22;
const after = (s, v) => { const t = M.clone(s); M.step(t, v); return t; };

// Coolest safe play: the lowest "hottest it got" over all plays that win with the fire at 15.
function coolestSafe(start, wait) {
  const memo = new Map();
  const go = (s, d) => {
    if (s.out === 'down') return { F: s.maxF, line: [] };
    if (s.out || d === 0) return null;
    const key = [s.F, s.seen, s.on.length, s.hand, s.maxF, d].join('|');
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (const v of M.offered(s)) {
      const r = go(after(s, v), d - 1);
      if (r && (!best || r.F < best.F || (r.F === best.F && r.line.length + 1 < best.line.length))) best = { F: r.F, line: [v, ...r.line] };
    }
    memo.set(key, best);
    return best;
  };
  return go(M.create(start, wait, 15), DEPTH);
}
function playLine(start, wait, burn, line, then = M.greedy) {
  let s = M.create(start, wait, burn), n = 0;
  for (const v of line) { if (s.out) break; if (!M.offered(s).includes(v)) return { out: 'not offered', F: s.F, s }; M.step(s, v); }
  while (!s.out && n++ < 60) M.step(s, then(s));
  return { out: s.out, F: s.F, s };
}
const greedyLine = (start, wait) => { const s = M.create(start, wait, 99), L = []; while (!s.out) { const v = M.greedy(s); L.push(v); M.step(s, v); } return L; };
const short = L => L.map(v => ({ hold: 'H', idk: 'K', toss: 'T', together: 'G', down: 'D' })[v]).join('');

const params = [];
M.ROUNDS.forEach((r, i) => params.push({ name: `round ${i + 1}`, ...r }));
for (const start of M.FREE.starts) for (const wait of M.FREE.waits) params.push({ name: `random  `, start, wait });

let allGreedyBest = true;
console.log('Coolest safe play (search) vs the page\'s line; then one toss slipped in at each point (wins with fire at 15 / 16):');
for (const p of params) {
  const best = coolestSafe(p.start, p.wait), g = M.coolest(p.start, p.wait), gl = greedyLine(p.start, p.wait);
  if (!best || best.F !== g.maxF) allGreedyBest = false;
  const one = [], two = [];
  for (let k = 0; k < gl.length - 1; k++) {
    const line = [...gl.slice(0, k), 'toss'];
    const a = playLine(p.start, p.wait, 15, line), b = playLine(p.start, p.wait, 16, line);
    one.push(a.out === 'down' ? 'W' : b.out === 'down' ? 'w' : 'x');
    const line2 = [...gl.slice(0, k), 'toss', 'toss'];
    two.push(playLine(p.start, p.wait, 16, line2).out === 'down' ? 'w' : 'x');
  }
  console.log(`  ${p.name} start ${p.start} Wren ${p.wait}: coolest ${best ? best.F : '-'} (${best ? short(best.line) : 'none'}); page line ${g.maxF} in ${g.moves} (${short(gl)})` +
    `  one toss: ${one.join('')}  two tosses: ${two.join('')}`);
}
console.log(`  (W = still wins with the fire at 15, w = only if it's at 16, x = burns. The page line is the coolest in every case: ${allGreedyBest})`);

// One button every move (put it down if you can; if the button isn't lit, bounce; if that isn't either, ask).
const spam = v => s => { const o = M.offered(s); return o.includes('down') ? 'down' : o.includes(v) ? v : o.includes('idk') ? 'idk' : 'together'; };
const random = noToss => (s, rnd) => { const o = M.offered(s).filter(v => !noToss || v !== 'toss'); return o[Math.floor(rnd() * o.length)]; };
function rate(pick, reps, only) {
  let w = 0, n = 0;
  for (let r = 0; r < reps; r++) for (const p of only || params) for (const burn of M.BURNS) {
    let s = M.create(p.start, p.wait, burn), k = 0, x = (r * 7919 + p.start * 31 + p.wait * 7 + burn) || 1;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    while (!s.out && k++ < 60) M.step(s, pick(s, rnd));
    w += s.out === 'down'; n++;
  }
  return (100 * w / n).toFixed(0) + '%';
}
const rounds = params.slice(0, 3);
console.log(`\nThe same button every move, rounds 1-3 / all rounds: Hold ${rate(spam('hold'), 1, rounds)} / ${rate(spam('hold'), 1)}, ` +
  `Toss ${rate(spam('toss'), 1, rounds)} / ${rate(spam('toss'), 1)}, I don't know ${rate(spam('idk'), 1, rounds)} / ${rate(spam('idk'), 1)}.`);
console.log(`Random presses: ${rate(random(false), 300, rounds)} of rounds 1-3 (${rate(random(false), 100)} of all); never tossing: ${rate(random(true), 300, rounds)} (${rate(random(true), 100)}).`);
