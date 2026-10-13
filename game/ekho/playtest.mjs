#!/usr/bin/env node
// Playtest harness for Recursive Ekho (engine.js). No npm installs.
//
//   node playtest.mjs new  --file game.json [--players 3] [--tide gentle|fair|harsh|dire] [--tilt kind|fair|harsh|open]
//                          [--mode commons|race] [--seed 7] [--bots 2,3] [--habit greedy] [--young-ai]
//                          [--roles researcher,teacher,poet] [--faces gentle,harsh,gentle,harsh (with --tilt open)]
//   node playtest.mjs show --file game.json       the table, and the choice waiting, as numbered options
//   node playtest.mjs act 2 --file game.json      answer the waiting choice with option 2
//   node playtest.mjs log  --file game.json       the whole log so far
//   node playtest.mjs sim  [--games 1000] [--habits greedy,greedy,greedy] [--tide fair] [--tilt fair] [--mode commons]
//   node playtest.mjs grid [--games 600] [--habits ...]   tide x tilt: does difficulty do what it says?
//   node playtest.mjs habits [--games 600]                does a choice matter? tables of different habits
//   node playtest.mjs dominance [--games 600]             one move played always, against the greedy table
//   node playtest.mjs switches [--games 2000]             the good share, by each switch's hidden face
//   node playtest.mjs race [--games 600]                  commons vs race, with free-riders at the table
//
// The game file holds only the setup and the answers; every call replays from the seed (the engine is deterministic).
// Numbers are about this toy's balance, never about the world: odds, not paths.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mod = { exports: {} };
new Function('module', fs.readFileSync(path.join(HERE, 'engine.js'), 'utf8')).call({}, mod);
const E = mod.exports;

const argv = process.argv.slice(2);
const cmd = argv.shift() || 'help';
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1];
    if (nx === undefined || nx.startsWith('--')) flags[k] = true; else { flags[k] = nx; i++; } }
  else pos.push(a);
}
const num = (k, d) => (flags[k] !== undefined ? +flags[k] : d);
const pct = (x) => (Math.round(1000 * x) / 10).toFixed(1) + '%';
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function opts(seed) {
  return { players: num('players', 3), tide: flags.tide || 'fair', tilt: flags.tilt || 'fair', mode: flags.mode || 'commons',
    youngAI: !!flags['young-ai'], faces: flags.faces ? String(flags.faces).split(',') : undefined,
    roles: flags.roles ? String(flags.roles).split(',') : undefined, seed };
}

// ---------------------------------------------------------------- hand play (replay from the file)
class Wait { constructor(d, g) { this.d = d; this.g = g; } }
function replay(f) {
  const g = E.newGame(f.cfg);
  const bots = new Set(f.bots || []), habit = E.bot(f.habit || 'greedy');
  let k = 0;
  const choose = (gg, d) => {
    if (bots.has(d.player + 1)) return habit(gg, d);
    if (k >= f.answers.length) throw new Wait(d, gg);
    const n = f.answers[k++]; return (d.options[n - 1] || d.options[0]).id;
  };
  try { E.run(g, choose); return { g }; } catch (e) { if (e instanceof Wait) return { g: e.g, wait: e.d }; throw e; }
}
function table(g) {
  const L = [];
  L.push(`Round ${g.round} · tide ${g.tide}/${E.consts.CROSSING} (marks ${E.consts.MARKS.join(', ')}) · a round is a ${E.consts.CLOCK[g.clock]}`);
  L.push('Hollows: ' + E.HOLLOWS.map((h) => `${E.HOLLOW_NAME[h]} ${g.beads[h]}`).join(' · ') +
    `   (good share ${pct(E.share(g, E.GOOD))}, bad ${pct(E.share(g, E.BAD))})`);
  L.push(`Leads: alignment ${g.align} · commons ${g.commons} · together ${g.together} · relationality ${g.rel}`);
  L.push('World: ' + E.SWITCHES.map((s, i) => (g.lifted[i] ? s[g.world[i]] : g.known[i] ? s[g.world[i]] + ' (face-up, not yet found)' : s.q + ' (veiled)')).join(' · '));
  g.players.forEach((p) => L.push(`  ${p.name}: ${E.ROLES[p.role][0]} · hand ${p.hand.map((c) => E.MOVES[c][1]).join(', ') || '—'}` +
    ` · practices ${p.practices}` + (g.mode === 'race' ? ` · Edge ${p.edge}` : '')));
  return L.join('\n');
}
function present(f) {
  const { g, wait } = replay(f);
  console.log(g.log.slice(-14).join('\n'));
  console.log('\n' + table(g));
  if (g.over) { console.log(`\nENDING: ${g.over.name} (${g.over.kind}) after ${g.over.round} rounds. ${g.over.why}`);
    console.log('The odds at the Crossing: ' + E.HOLLOWS.map((h) => `${E.HOLLOW_NAME[h]} ${pct(g.over.probs[h])}`).join(' · ')); return; }
  if (wait) { const p = g.players[wait.player];
    console.log(`\n${p.name} (${E.ROLES[p.role][0]}) chooses: ${wait.kind}${wait.need ? ` (the Council needs ${wait.need} Together)` : ''}`);
    wait.options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`)); }
}

// ---------------------------------------------------------------- simulation
function batch(o0, habits, games, seed0 = 1) {
  const out = [];
  for (let s = seed0; s < seed0 + games; s++) { const o = { ...o0, seed: s }; const g = E.newGame(o);
    E.run(g, E.tableChooser(habits)); out.push({ ...g.over, stats: g.stats, rounds: g.round, players: g.players.map((p) => p.edge) }); }
  return out;
}
function summary(rs) {
  const drawnGood = rs.filter((r) => r.kind === 'good').length / rs.length;
  const drawnBad = rs.filter((r) => r.kind === 'bad').length / rs.length;
  const still = rs.filter((r) => /Still walking|forty|ran out/.test(r.why)).length / rs.length;
  return { good: mean(rs.map((r) => r.good)), bad: mean(rs.map((r) => r.bad)), drawnGood, drawnBad, still,
    rounds: mean(rs.map((r) => r.rounds)), holds: mean(rs.map((r) => r.stats.holds)), pledges: mean(rs.map((r) => r.stats.pledges)), spilled: mean(rs.map((r) => r.stats.spilled)),
    pass: mean(rs.map((r) => r.stats.passed / Math.max(1, r.stats.councils))) };
}
const line = (label, s) => `${label.padEnd(26)} good odds ${pct(s.good).padStart(6)}  bad odds ${pct(s.bad).padStart(6)}  ` +
  `drawn good ${pct(s.drawnGood).padStart(6)}  rounds ${s.rounds.toFixed(1).padStart(4)}  holds ${s.holds.toFixed(2)}  spilled ${s.spilled.toFixed(1)}  council passes ${pct(s.pass)}  still ${pct(s.still)}`;
const habitsFlag = () => (flags.habits ? String(flags.habits).split(',') : Array(num('players', 3)).fill('greedy'));

if (cmd === 'new') {
  const f = { cfg: opts(num('seed', 1)), bots: flags.bots ? String(flags.bots).split(',').map(Number) : [], habit: flags.habit || 'greedy', answers: [] };
  fs.writeFileSync(flags.file, JSON.stringify(f, null, 1)); present(f);
} else if (cmd === 'show') present(JSON.parse(fs.readFileSync(flags.file, 'utf8')));
else if (cmd === 'act') { const f = JSON.parse(fs.readFileSync(flags.file, 'utf8')); pos.forEach((n) => f.answers.push(+n));
  fs.writeFileSync(flags.file, JSON.stringify(f, null, 1)); present(f); }
else if (cmd === 'log') console.log(replay(JSON.parse(fs.readFileSync(flags.file, 'utf8'))).g.log.join('\n'));
else if (cmd === 'sim') {
  const rs = batch(opts(1), habitsFlag(), num('games', 1000));
  console.log(line(habitsFlag().join(','), summary(rs)));
  const by = {}; rs.forEach((r) => (by[r.name] = (by[r.name] || 0) + 1));
  console.log('endings drawn: ' + Object.entries(by).map(([k, v]) => `${k} ${pct(v / rs.length)}`).join(' · '));
  const rounds = {}; rs.forEach((r) => (rounds[r.rounds] = (rounds[r.rounds] || 0) + 1));
  console.log('rounds: ' + Object.entries(rounds).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log('rounds spent per clock (quarter, month, week, day): ' + [0, 1, 2, 3].map((i) => mean(rs.map((r) => r.clockRounds[i])).toFixed(2)).join(', '));
  if ((flags.mode || 'commons') === 'race') {
    const winners = rs.filter((r) => r.raceWinner).length / rs.length; console.log('a race winner (ending not bad): ' + pct(winners)); }
} else if (cmd === 'grid') {
  for (const tilt of ['kind', 'fair', 'harsh']) for (const tide of ['gentle', 'fair', 'harsh', 'dire'])
    console.log(line(`tilt ${tilt}, tide ${tide}`, summary(batch({ ...opts(1), tide, tilt }, habitsFlag(), num('games', 600)))));
} else if (cmd === 'habits') {
  const n = num('players', 3), G = num('games', 600), o = opts(1);
  const tables = { greedy: Array(n).fill('greedy'), commons: Array(n).fill('commons'), racer: Array(n).fill('racer'),
    random: Array(n).fill('random'), 'one racer': ['racer'].concat(Array(n - 1).fill('greedy')),
    'one free-rider': ['rival'].concat(Array(n - 1).fill('greedy')), 'all free-riders': Array(n).fill('rival'),
    'one random': ['random'].concat(Array(n - 1).fill('greedy')) };
  for (const [k, h] of Object.entries(tables)) console.log(line(k, summary(batch(o, h, G))));
} else if (cmd === 'dominance') {
  const n = num('players', 3), G = num('games', 600), o = opts(1);
  console.log(line('greedy (mixed play)', summary(batch(o, Array(n).fill('greedy'), G))));
  for (const m of Object.keys(E.MOVES)) console.log(line('always ' + m, summary(batch(o, Array(n).fill('only:' + m), G))));
} else if (cmd === 'race') {
  // the two rule sets side by side: the same tables, commons then race (Build votes earn Edge)
  const n = num('players', 3), G = num('games', 600);
  for (const mode of ['commons', 'race']) for (const [k, h] of Object.entries({ greedy: Array(n).fill('greedy'),
    'one free-rider': ['rival'].concat(Array(n - 1).fill('greedy')), 'all free-riders': Array(n).fill('rival') })) {
    const rs = batch({ ...opts(1), mode }, h, G);
    const fr = rs.map((r) => r.players[0]), others = rs.map((r) => mean(r.players.slice(1)));
    const wins = mode === 'race' ? `  seat 1 wins the race ${pct(rs.filter((r) => r.raceWinner === 'Player 1').length / rs.length)}, nobody wins ${pct(rs.filter((r) => !r.raceWinner).length / rs.length)}` : '';
    console.log(line(`${mode}: ${k}`, summary(rs)) + `  Edge seat1 ${mean(fr).toFixed(1)} vs others ${mean(others).toFixed(1)}` + wins);
  }
} else if (cmd === 'switches') {
  const rs = batch(opts(1), habitsFlag(), num('games', 2000));
  E.SWITCHES.forEach((s, i) => {
    const gentle = rs.filter((r) => r.world[i] === 'gentle'), harsh = rs.filter((r) => r.world[i] === 'harsh');
    console.log(`${s.q.padEnd(24)} ${s.gentle}: good ${pct(mean(gentle.map((r) => r.good)))} (n ${gentle.length})   ${s.harsh}: good ${pct(mean(harsh.map((r) => r.good)))} (n ${harsh.length})`);
  });
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
