#!/usr/bin/env node
// potato_solve.mjs: does Hot Potato v4 ask for real choices, and is it fair? Run from anywhere:
//
//   node game/tools/potato_solve.mjs          (a few seconds)
//
// It plays game/potato-model.js (the page's own rules) for the three rounds and every random round's
// set-up. The fire is hidden somewhere from 9 to 16 flames, any box as likely. Your score is the
// coins you keep: 5 to start, +1 for each bounce, +5 for each toss, all lost if it catches fire.
//   1. The careful line (put it down > ask > hold > bounce): does it stay out of the stripes?
//   2. The surest line: the most coins you can keep without touching the stripes (a sure thing).
//   3. The best bet: the play that keeps the most coins on average, not knowing where the fire is
//      (the fire is above every box you've passed), and how often it burns.
//   4. With hindsight: for each place the fire could be, the most coins anyone could have kept, and
//      whether that play needs a toss.
//   5. One button over and over, and random presses.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const M = createRequire(import.meta.url)(join(here, '..', 'potato-model.js'));
const short = L => L.map(v => ({ hold: 'H', bounce: 'B', toss: 'X', together: 'G', down: 'D' })[v]).join('');
const params = [];
M.ROUNDS.forEach((r, i) => params.push({ name: `round ${i + 1}`, ...r }));
M.FREE.forEach(r => params.push({ name: 'random ', ...r }));

// Expected coins, with the fire uniform over the boxes above the hottest it has been (and >= 9).
function bestBet(start, wait) {
  const memo = new Map();
  const go = (s, d) => {
    if (s.out === 'down') return { ev: s.coins, pb: 0, line: [] };
    if (d === 0) return { ev: 0, pb: 1, line: [] };
    const key = [s.F, s.seen, s.on.length, s.hand, s.coins, s.maxF, d].join('|');
    if (memo.has(key)) return memo.get(key);
    const a = Math.max(M.LO, s.maxF + 1), tot = M.TOP - a + 1;
    let best = null;
    for (const v of M.offered(s)) {
      const t = M.clone(s); t.burn = 99; M.step(t, v);
      const surv = t.maxF < a ? 1 : Math.max(0, M.TOP - t.maxF) / tot;
      const r = surv > 0 ? go(t, d - 1) : { ev: 0, pb: 1, line: [] };
      const ev = surv * r.ev, pb = 1 - surv * (1 - r.pb);
      if (!best || ev > best.ev + 1e-9) best = { ev, pb, line: [v, ...r.line] };
    }
    memo.set(key, best);
    return best;
  };
  return go(M.create(start, wait, 99), 30);
}
function playLine(start, wait, burn, line, then = M.careful) {
  const s = M.create(start, wait, burn);
  for (const v of line) { if (s.out) break; if (!M.offered(s).includes(v)) return { out: 'not offered', s }; M.step(s, v); }
  let n = 0; while (!s.out && n++ < 60) M.step(s, then(s));
  return { out: s.out, s };
}
const avg = (start, wait, line) => {
  let c = 0, w = 0;
  for (const f of M.FIRES) { const r = playLine(start, wait, f, line); c += r.s.coins; w += r.out === 'down'; }
  return { coins: c / M.FIRES.length, win: w / M.FIRES.length };
};

let carefulSafe = true, tossBestSomewhere = 0, tossHindsight = 0, hindsightCells = 0;
console.log('Set-up        careful line (hottest, coins) | surest (never in the stripes) | best bet: avg coins, burns, line | toss first, then careful');
for (const p of params) {
  const s = M.create(p.start, p.wait, 99), cl = [];
  while (!s.out) { const v = M.careful(s); cl.push(v); M.step(s, v); }
  if (s.maxF >= M.LO) carefulSafe = false;
  const sure = M.surest(p.start, p.wait), bet = bestBet(p.start, p.wait), tf = avg(p.start, p.wait, ['toss']);
  if (bet.line.includes('toss')) tossBestSomewhere++;
  console.log(`${p.name} ${p.start}/${p.wait}  ${short(cl).padEnd(9)} (${String(s.maxF).padStart(2)}, ${s.coins}) | ${short(sure.line).padEnd(9)} ${sure.coins} coins | ` +
    `${bet.ev.toFixed(2)}, ${(100 * bet.pb).toFixed(0).padStart(2)}% ${short(bet.line).padEnd(10)} | ${tf.coins.toFixed(2)}, burns ${(100 * (1 - tf.win)).toFixed(0)}%`);
}
console.log(`\nThe careful line never reaches the stripes in any set-up: ${carefulSafe}.`);
console.log(`Set-ups where the best bet includes a toss: ${tossBestSomewhere} of ${params.length}.`);

console.log('\nWith hindsight (the fire at 9 ... 16): the most coins anyone could keep, * = that play needs a toss:');
for (const p of params) {
  const row = M.FIRES.map(f => {
    const r = M.most(M.create(p.start, p.wait, 99), f);
    hindsightCells++;
    if (!r) return '  -';
    const t = r.line.includes('toss') ? '*' : ' ';
    if (t === '*') tossHindsight++;
    return String(r.coins).padStart(2) + t;
  });
  console.log(`  ${p.name} ${p.start}/${p.wait}: ${row.join(' ')}`);
}
console.log(`  A toss is part of the best hindsight play in ${tossHindsight} of ${hindsightCells} cases.`);

// One button every move (put it down if you can; if the button isn't lit, the careful move).
const spam = v => s => { const o = M.offered(s); return o.includes('down') ? 'down' : o.includes(v) && v !== 'together' ? v : M.careful(s); };
const random = noToss => (s, rnd) => { const o = M.offered(s).filter(v => !noToss || v !== 'toss'); return o[Math.floor(rnd() * o.length)]; };
function rate(pick, reps, only) {
  let w = 0, n = 0, c = 0;
  for (let r = 0; r < reps; r++) for (const p of only || params) for (const burn of M.FIRES) {
    const s = M.create(p.start, p.wait, burn); let k = 0, x = (r * 7919 + p.start * 31 + p.wait * 7 + burn) || 1;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    while (!s.out && k++ < 80) M.step(s, pick(s, rnd));
    w += s.out === 'down'; c += s.coins; n++;
  }
  return `${(100 * w / n).toFixed(0)}% put down, ${(c / n).toFixed(1)} coins`;
}
const rounds = params.slice(0, 3);
console.log(`\nRounds 1-3, averaged over where the fire is:`);
console.log(`  careful every move:        ${rate(s => M.careful(s), 1, rounds)}`);
console.log(`  Bounce whenever it's lit:  ${rate(spam('bounce'), 1, rounds)}`);
console.log(`  Toss whenever it's lit:    ${rate(spam('toss'), 1, rounds)}`);
console.log(`  random presses:            ${rate(random(false), 200, rounds)}`);
console.log(`  random presses, no toss:   ${rate(random(true), 200, rounds)}`);
