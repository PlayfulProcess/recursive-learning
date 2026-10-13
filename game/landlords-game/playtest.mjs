#!/usr/bin/env node
// Playtest harness for "The Landlord's Game, live again" (engine.js). No npm installs.
//
//   node playtest.mjs new  --file game.json [--mode landlord|prosperity] [--players 3] [--seed 7]
//                          [--equal | --starts 200,350,500] [--bots 1,2] [--ask-forced] [--answers 1,2,1]
//   node playtest.mjs show --file game.json        state + the choice waiting, as numbered options
//   node playtest.mjs act 1 --file game.json       answer the choice (1 = yes / pay, 2 = no / pass)
//   node playtest.mjs board --file game.json       who owns what
//   node playtest.mjs sim [--games 300] [--players 3] [--equal | --starts 20,30,60] [--seed0 1] [--policy name] [--json out.json]
//   node playtest.mjs policies [--games 300]       does a choice matter? (each choice swapped for a fixed habit)
//   node playtest.mjs flows [--games 300]          where the money goes in a game (wages, rent, Treasury, land)
//   node playtest.mjs scenarios                    hand-made situations the bots rarely reach (Poorhouse, forced sale ...)
//   node playtest.mjs variants [--games 300]       the round 2 decisions: each old rule against the adopted one
//   node playtest.mjs physical [--games 1000]      what a printed box must hold: money in play, tickets, laps
//   node playtest.mjs tension [--games 1000]       Prosperity tension (Oct 12): each candidate win rule or deadline, measured
//   Any command takes --rules price=bank,sale=cheapest,end=rounds,win=double to play the old rules (engine.js DEFAULT_RULES).
//
// The game file holds only the setup and the list of answers; every call replays the game from the seed
// (engine.js is deterministic), so nothing in engine.js is changed or patched. Turns with no choice
// (a roll that lands on rent, a necessity, a legacy, the Poorhouse) play themselves and are printed.
// A player listed in --bots is played by engine.auto, the same habits the page's computer seats use.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mod = { exports: {} };
// run engine.js as a plain script with a CommonJS-style module, so a package.json "type" cannot matter
new Function('module', fs.readFileSync(path.join(HERE, 'engine.js'), 'utf8')).call({}, mod);
const LG = mod.exports;
const SP = JSON.parse(fs.readFileSync(path.join(HERE, 'spaces.json'), 'utf8')).spaces;
const C = LG.consts;

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const cmd = argv.shift() || 'help';
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1];
    if (nx === undefined || nx.startsWith('--')) flags[k] = true; else { flags[k] = nx; i++; } }
  else pos.push(a);
}
const DEFAULT_STARTS = [200, 350, 500, 800];
const RULES = flags.rules ? Object.fromEntries(String(flags.rules).split(',').map((kv) => kv.split('='))) : {};
const startsFor = (n) => flags.starts ? String(flags.starts).split(',').map(Number)
  : flags.equal ? Array(n).fill(500) : DEFAULT_STARTS.slice(0, n);

// ---------------------------------------------------------------- one game, with every message captured
// The engine logs with g.log.push and keeps only 400 lines; we keep them all, and add the rolls and moves.
function makeGame(mode, starts, seed, names, events, rules) {
  const g = LG.newGame(SP, { mode, starts, seed, names, rules: rules || RULES });
  g.log = []; g.log.push = (t) => { events.push(t.replace(/^Round \d+ · /, '')); return 0; };
  const rand = g.rand; let n = 0, first = 0;
  g.rand = () => { const r = rand(); const die = 1 + Math.floor(r * 6); n++;
    if (n % 2 === 1) first = die; else events.push(g.players[g.turn].name + ' rolls ' + first + ' + ' + die + (first === die ? ' (doubles)' : '') + '.');
    return r; };
  g.players.forEach((p) => { let at = p.pos; Object.defineProperty(p, 'pos', { enumerable: true, get() { return at; },
    set(v) { if (v !== at) events.push((p.name + ' moves to ' + SP[v].name + '.').replace(/\.\.$/, '.')); at = v; } }); });
  return g;
}

class Need { constructor(d, p) { this.d = d; this.p = p; } }

function replay(cfg, answers) {
  const events = [];
  const g = makeGame(cfg.mode, cfg.starts, cfg.seed, cfg.names, events, cfg.rules);
  let ci = 0, guard = 20000;
  while (!g.over && guard--) {
    const p = g.players[g.turn];
    try {
      LG.playTurn(g, (d) => {
        if (cfg.bots.includes(p.id)) return LG.auto(g, p, d);
        // a buy or a ticket the player cannot pay for is not a choice: it passes by itself (--ask-forced keeps the prompt)
        if (!cfg.askForced && d.kind !== 'jail' && p.cash < (d.price || C.LUXURY)) { events.push(p.name + ' cannot afford ' + SP[d.space].name + ' ($' + (d.price || C.LUXURY) + ') and passes.'); return false; }
        if (ci < answers.length) return answers[ci++] === 1;
        throw new Need(d, p);
      });
    } catch (e) { if (e instanceof Need) return { g, events, need: e }; throw e; }
  }
  return { g, events, need: null, stuck: !g.over };
}

// ---------------------------------------------------------------- text for people (and agents)
const sideName = (i) => ['bottom', 'left', 'top', 'right'][Math.floor(i / 10)];
function lotsOf(g, p) { return LG.ownedBy(g, p).map((i) => SP[i].name + (g.mode === 'landlord' || SP[i].kind === 'lot' ? '' : '')); }
function statusText(g) {
  const lines = ['Round ' + g.round + (g.mode === 'prosperity' && g.rules.end === 'rounds' ? ' of ' + C.PROSPERITY_LIMIT : '') + ' · Treasury $' + g.treasury + ' · mode: ' + g.mode];
  g.players.forEach((p, k) => {
    const where = p.poor ? 'POORHOUSE' : p.jail ? 'JAIL' : SP[p.pos].name;
    const lots = LG.ownedBy(g, p);
    lines.push((k === g.turn && !g.over ? '> ' : '  ') + p.name.padEnd(9) + ('$' + p.cash).padStart(6) + '  worth $' + String(LG.worth(g, p)).padEnd(5)
      + ' start $' + String(p.start).padEnd(4) + ' laps ' + p.laps + '  at ' + where + (p.skip ? ' (loses next turn)' : '')
      + (p.tickets ? ' tickets ' + p.tickets : '') + (lots.length ? '  owns: ' + lots.map((i) => SP[i].name + '(' + SP[i].price + ')').join(', ') : ''));
  });
  return lines.join('\n');
}
function options(g, need) {
  const d = need.d, p = need.p, s = d.space !== undefined ? SP[d.space] : null, out = [];
  if (d.kind === 'buy') {
    const rent = s.kind === 'lot' ? ' Rent here would be $' + LG.rentOf(s) + (g.mode === 'landlord' ? '' : ' (ground rent into the Treasury; buying gives every other player $' + C.GIFT_ON_PURCHASE + ')') : '';
    out.push(p.name + ' is on ' + s.name + ' (' + s.kind + ', ' + sideName(d.space) + ' side), free for $' + d.price + '. Cash $' + p.cash + '.' + rent);
    out.push(p.cash >= d.price ? '  1) Buy it for $' + d.price : '  1) Buy it (cannot afford: not allowed)'); out.push('  2) Pass');
  } else if (d.kind === 'luxury') {
    out.push(p.name + ' is on ' + s.name + ' (luxury). Cash $' + p.cash + '.');
    out.push(p.cash < C.LUXURY ? '  1) Pay (cannot afford: not allowed)' : g.mode === 'prosperity' ? '  1) Pay $50 into the Treasury (no ticket: only cash counts)' : '  1) Buy a ticket for $50 (worth $60 in the landlord\'s count; the $50 goes to the Treasury)');
    out.push('  2) Pass and lose the next turn');
  } else {
    out.push(p.name + ' is in Jail, rolled ' + g.dice[0] + ' + ' + g.dice[1] + ' (no doubles). Cash $' + p.cash + ', tries so far ' + p.tries + '.');
    out.push('  1) Pay the $50 fine and move ' + (g.dice[0] + g.dice[1])); out.push('  2) Stay in Jail');
  }
  return out;
}

// ---------------------------------------------------------------- file commands
const gameFile = () => flags.file ? String(flags.file) : path.join(os.tmpdir(), 'lg-playtest.json');
const load = () => JSON.parse(fs.readFileSync(gameFile(), 'utf8'));
const save = (f) => fs.writeFileSync(gameFile(), JSON.stringify(f));

function present(f) {
  const r = replay(f, f.answers);
  const fresh = r.events.slice(f.shown);
  if (fresh.length) console.log(fresh.map((e) => '  ' + e).join('\n'));
  f.shown = r.events.length; save(f);
  console.log('\n' + statusText(r.g));
  if (r.g.over) { console.log('\nGAME OVER (' + r.g.over.kind + '): ' + r.g.over.text); return; }
  if (r.stuck) { console.log('\nSTUCK: no end after 20000 turns.'); return; }
  console.log('\n' + options(r.g, r.need).join('\n') + '\n(answer with: act 1  or  act 2)');
}

if (cmd === 'new') {
  const n = Number(flags.players || 3), mode = flags.mode || 'landlord';
  if (!['landlord', 'prosperity'].includes(mode)) throw new Error('mode must be landlord or prosperity');
  const f = { mode, seed: Number(flags.seed || Date.now() % 1e6), starts: startsFor(n), names: ['Ana', 'Ben', 'Cleo', 'Dev'].slice(0, n),
    rules: RULES, bots: flags.bots ? String(flags.bots).split(',').map(Number) : [], askForced: !!flags['ask-forced'], answers: flags.answers ? String(flags.answers).split(',').map(Number) : [], shown: 0 };
  save(f); console.log('New ' + mode + ' game, seed ' + f.seed + ', starts ' + f.starts.join('/') + ', file ' + gameFile());
  present(f);
} else if (cmd === 'show') { present(load());
} else if (cmd === 'act') {
  const f = load();
  for (const a of pos) {
    const r = replay(f, f.answers);
    if (!r.need) { console.log('Nothing to answer.'); break; }
    const v = Number(a);
    if (v !== 1 && v !== 2) { console.log('Answer 1 or 2.'); break; }
    if (v === 1 && r.need.d.kind !== 'jail' && r.g.players[r.need.p.id].cash < (r.need.d.price || C.LUXURY)) { console.log('Cannot afford; answer 2.'); break; }
    f.answers.push(v);
    if (pos.length > 1) { /* several answers in one call: print only the end */ }
  }
  present(f);
} else if (cmd === 'board') {
  const f = load(), r = replay(f, f.answers), g = r.g, rows = [];
  SP.forEach((s, i) => { const o = g.owner[i]; const here = g.players.filter((p) => !p.poor && p.pos === i).map((p) => p.name).join(',');
    rows.push(String(i).padStart(2) + ' ' + s.name.padEnd(15) + s.kind.padEnd(10) + (s.price ? ('$' + s.price).padEnd(6) : '      ')
      + (o !== null && o !== undefined ? 'owner ' + g.players[o].name : '').padEnd(14) + (here ? ' <- ' + here : '')); });
  console.log(rows.join('\n'));
}

// ---------------------------------------------------------------- bot games, with invariants
const KIND_BUYABLE = { landlord: ['lot', 'railroad', 'franchise'], prosperity: ['lot'] };

// Choice habits. 'default' is engine.auto (what the page's computer uses). The others fix one choice.
const POLICIES = {
  default: (g, p, d) => LG.auto(g, p, d),
  'never-buy': (g, p, d) => d.kind === 'buy' ? false : LG.auto(g, p, d),
  'always-buy': (g, p, d) => d.kind === 'buy' ? p.cash >= d.price : LG.auto(g, p, d),
  'buy-lots-only': (g, p, d) => d.kind === 'buy' ? (SP[d.space].kind === 'lot' && p.cash >= d.price + (g.mode === 'prosperity' ? 60 : 120)) : LG.auto(g, p, d),
  'cushion-60': (g, p, d) => d.kind === 'buy' ? p.cash >= d.price + 60 : LG.auto(g, p, d),     // the Prosperity habit, in both modes
  'cushion-120': (g, p, d) => d.kind === 'buy' ? p.cash >= d.price + 120 : LG.auto(g, p, d),   // the landlord habit, in both modes
  'never-luxury': (g, p, d) => d.kind === 'luxury' ? false : LG.auto(g, p, d),
  'always-luxury': (g, p, d) => d.kind === 'luxury' ? p.cash >= C.LUXURY : LG.auto(g, p, d),
  // Prosperity: who buys. 'rich-buy': everyone but the lowest starter buys with the default cushion; 'poor-buy': only the lowest starter buys.
  'rich-buy': (g, p, d) => d.kind === 'buy' ? (p.start > Math.min(...g.players.map((q) => q.start)) && LG.auto(g, p, d)) : LG.auto(g, p, d),
  'poor-buy': (g, p, d) => d.kind === 'buy' ? (p.start === Math.min(...g.players.map((q) => q.start)) && LG.auto(g, p, d)) : LG.auto(g, p, d),
  // Prosperity tension (Oct 12): the habit a table finds once it reads the win rule. The richer players buy
  // land only while they keep at least their own start after paying; the poorest never buys.
  'give-above-start': (g, p, d) => d.kind === 'buy' ? (p.start > Math.min(...g.players.map((q) => q.start)) && p.cash - d.price >= p.start) : LG.auto(g, p, d),
  'stay-in-jail': (g, p, d) => d.kind === 'jail' ? false : LG.auto(g, p, d),
  'always-pay-jail': (g, p, d) => d.kind === 'jail' ? true : LG.auto(g, p, d),
};

const RE = { buy: /^(.*) buys (.*) for \$(\d+)[.,]/, sell: /sells (.*) back to the bank for/, gift: /^New land in use/,
  jailIn: /goes to Jail/, fine: /pays the \$50 fine/, doubles: /rolls doubles and leaves Jail/, stays: /stays in Jail/,
  sit: /sits this turn out/, passLux: /passes on/, ticket: /luxury ticket|for a luxury/, poor: /goes to the Poorhouse/, leave: /leaves the Poorhouse/,
  rent: /pays \$(\d+) (rent|ground rent)/, fare: /public fare/, necessity: /absolute necessity/, legacy: /legacy/, dividend: /Public Treasury pays every player/ };
const spaceByName = Object.fromEntries(SP.map((s, i) => [s.name, i]));

function simOne(mode, starts, seed, policy, o) {
  o = o || {};
  const events = [], g = makeGame(mode, starts, seed, null, events, o.rules), n = starts.length;
  const issues = [], note = (m) => { if (issues.length < 6) issues.push(m); };
  const focal = o.focal, focalPolicy = o.focalPolicy;
  const stat = { turns: 0, decisions: 0, drought: 0, longestDrought: 0, byRound: [] };
  let guard = 6000, lastRound = 0;
  const sumMoney = () => g.players.reduce((a, p) => a + p.cash, 0) + g.treasury;
  const lapsSum = () => g.players.reduce((a, p) => a + p.laps, 0), legSum = () => g.players.reduce((a, p) => a + p.legacies, 0);
  const snapRound = () => { if (g.round !== lastRound) { lastRound = g.round;
    stat.byRound[g.round] = { cash: g.players.map((p) => p.cash), poor: g.players.map((p) => p.poor), treasury: g.treasury,
      worth: g.players.map((p) => LG.worth(g, p)), owned: g.owner.filter((x) => x !== null).length }; } };
  snapRound();
  while (!g.over && guard--) {
    const p = g.players[g.turn], pre = sumMoney(), preLaps = lapsSum(), preLeg = legSum(), e0 = events.length, preRound = g.round;
    let decided = false;
    const pol = (focal !== undefined && p.id === focal) ? focalPolicy : policy;
    LG.playTurn(g, (d) => { decided = true; return pol(g, p, d); });
    stat.turns++;
    if (stat.firstFive === undefined && g.players.some((q) => !q.poor && q.laps >= C.LAPS_TO_END)) stat.firstFive = g.round;
    if (decided) { stat.decisions++; stat.drought = 0; } else { stat.drought++; if (stat.drought > stat.longestDrought) stat.longestDrought = stat.drought; }
    const ev = events.slice(e0);
    // --- conservation: cash + treasury changes only by wages, legacies, the bank's purchases/buy-backs, and the $10 gifts
    let bought = 0, back = 0, gifts = 0;
    ev.forEach((t) => { let m;
      if ((m = RE.buy.exec(t))) bought += Number(m[3]);
      if ((m = RE.sell.exec(t))) back += Math.floor(SP[spaceByName[m[1]]].price / 2);
      if (RE.gift.test(t)) gifts += C.GIFT_ON_PURCHASE * (n - 1); });
    const expect = C.WAGES * (lapsSum() - preLaps) + C.LEGACY * (legSum() - preLeg) - (g.rules.price === 'bank' ? bought : 0) + back + gifts;
    if (sumMoney() - pre !== expect) note('money not conserved at round ' + preRound + ' (' + p.name + '): moved ' + (sumMoney() - pre) + ', expected ' + expect + ' :: ' + ev.join(' | '));
    // --- sanity
    g.players.forEach((q) => {
      if (!Number.isInteger(q.cash)) note('non-integer cash ' + q.cash + ' for ' + q.name);
      if (q.cash < 0) note('NEGATIVE cash ' + q.cash + ' for ' + q.name + ' round ' + g.round + ' :: ' + ev.join(' | '));
      if (q.poor && LG.ownedBy(g, q).length) note(q.name + ' is poor but still owns land');
      if (q.pos < 0 || q.pos > 39) note('bad position ' + q.pos);
      if (q.jail && q.pos !== 10) note(q.name + ' in jail but at ' + q.pos);
    });
    if (!Number.isInteger(g.treasury) || g.treasury < 0) note('bad treasury ' + g.treasury);
    g.owner.forEach((o2, i) => { if (o2 !== null) {
      if (!KIND_BUYABLE[mode].includes(SP[i].kind)) note(SP[i].name + ' (' + SP[i].kind + ') is owned in ' + mode);
      if (g.players[o2].poor) note(SP[i].name + ' owned by a poor player'); } });
    // --- end conditions as written
    const act = g.players.filter((q) => !q.poor);
    if (mode === 'prosperity') {
      const least = Math.min(...g.players.map((q) => q.start));   // every player tied for the lowest start
      const low = g.players.filter((q) => q.start === least), rest = g.players.filter((q) => q.start !== least);
      const doubled = low.every((q) => !q.poor && q.cash >= 2 * q.start);
      // 'rise' (Oct 12, adopted): also nobody below their start, and the lowest starters hold as much as anyone
      const won = doubled && (g.rules.win === 'double' || (rest.every((q) => !q.poor && q.cash >= q.start) && rest.every((q) => low.every((l) => l.cash >= q.cash))));
      if (typeof g.rules.win !== 'function' && typeof g.rules.end !== 'function') {
        const limit = g.rules.end === 'laps' ? (act.length > 0 && act.every((q) => q.laps >= C.LAPS_TO_END)) || g.round > 80 : g.round > C.PROSPERITY_LIMIT;
        const expOver = won || limit || act.length === 0;
        if (!!g.over !== expOver) note('Prosperity end mismatch at round ' + g.round + ': over=' + !!g.over + ' expected ' + expOver);
        if (g.over && g.over.kind === 'all' && !won) note('"everyone wins" without the win as written');
      }
    } else {
      const expOver = act.length <= 1 || act.every((q) => q.laps >= C.LAPS_TO_END) || g.round > 80;
      if (!!g.over !== expOver) note('landlord end mismatch at round ' + g.round + ': over=' + !!g.over + ' expected ' + expOver);
    }
    snapRound();
    if (preRound !== g.round && g.round - preRound > 1) note('round jumped ' + preRound + ' -> ' + g.round);
  }
  if (!g.over) note('STUCK: no end after 6000 turns');
  // winner as written: the richest in cash + land at full price + tickets at 60
  if (g.over && mode === 'landlord') {
    const w = g.players.map((q) => ({ id: q.id, w: q.cash + q.tickets * 60 + LG.ownedBy(g, q).reduce((a, i) => a + SP[i].price, 0) }));
    const act = g.players.filter((q) => !q.poor);
    const top = Math.max(...w.map((x) => x.w));
    if (act.length !== 1 && w[g.over.winner].w !== top) note('winner ' + g.over.winner + ' is not the richest');
    if (act.length === 1 && g.over.winner !== act[0].id) note('last player standing is not the winner');
  }
  const text = events.join('\n');
  const count = (re) => (text.match(new RegExp(re.source, 'g')) || []).length;
  const c = { jailIn: count(RE.jailIn), fine: count(RE.fine), doubles: count(RE.doubles), stays: count(RE.stays), sit: count(RE.sit), passLux: count(RE.passLux),
    ticket: count(RE.ticket), poor: count(RE.poor), leave: count(RE.leave), buys: events.filter((t) => RE.buy.test(t)).length,
    sell: count(RE.sell), dividend: count(RE.dividend), rents: events.filter((t) => RE.rent.test(t)).length };
  return { g, stat, issues, c, events };
}

function pct(a, b) { return b ? Math.round(1000 * a / b) / 10 + '%' : '-'; }
function med(a) { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function pctile(a, q) { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }

function sim() {
  const N = Number(flags.games || 300), n = Number(flags.players || 3), s0 = Number(flags.seed0 || 1), starts = startsFor(n), out = {};
  const policy = POLICIES[flags.policy || 'default'];
  console.log('Bot games: ' + N + ' per rule set, ' + n + ' players, starts ' + starts.join('/') + ', seeds ' + s0 + '..' + (s0 + N - 1) + ', policy ' + (flags.policy || 'default'));
  for (const mode of ['landlord', 'prosperity']) {
    const R = { tail: [], rounds: [], turns: [], issues: [], stuck: 0, winKind: {}, winSeat: Array(n).fill(0), poorSeat: Array(n).fill(0), anyPoor: 0, poorCount: 0,
      lapsEnd: [], c: {}, decisionShare: [], drought: [], ownedEnd: [], byRound: {}, endBy: {}, wealthRatio: [] };
    for (let k = 0; k < N; k++) {
      const r = simOne(mode, starts, s0 + k, policy), g = r.g;
      R.rounds.push(g.round); R.turns.push(r.stat.turns); r.issues.forEach((m) => R.issues.push('seed ' + (s0 + k) + ': ' + m));
      if (!g.over) { R.stuck++; continue; }
      R.winKind[g.over.kind] = (R.winKind[g.over.kind] || 0) + 1;
      if (g.over.winner !== undefined) R.winSeat[g.over.winner]++;
      const pc = g.players.filter((q) => q.poor).length; if (pc) R.anyPoor++; R.poorCount += pc;
      g.players.forEach((q, i) => { if (q.poor) R.poorSeat[i]++; });
      if (mode === 'landlord' && r.stat.firstFive !== undefined) R.tail.push(g.round - r.stat.firstFive);
      if (mode === 'landlord') { const act = g.players.filter((q) => !q.poor); R.lapsEnd.push(Math.max(...act.map((q) => q.laps)) - Math.min(...act.map((q) => q.laps)));
        const ends = act.length <= 1 ? 'last one standing' : act.every((q) => q.laps >= C.LAPS_TO_END) ? 'all active at 5 laps' : 'round limit 80'; R.endBy[ends] = (R.endBy[ends] || 0) + 1;
        const ws = g.players.map((q) => LG.worth(g, q)).sort((a, b) => b - a); R.wealthRatio.push(ws[0] / Math.max(1, ws[ws.length - 1])); }
      else { const poorest = g.players.reduce((a, b) => (b.start < a.start ? b : a));
        const ends = g.over.kind === 'all' ? 'everyone wins' : g.players.every((q) => q.poor) ? 'everyone poor' : g.rules.end === 'laps' ? 'five laps, not won' : 'forty rounds'; R.endBy[ends] = (R.endBy[ends] || 0) + 1; }
      for (const key of Object.keys(r.c)) R.c[key] = (R.c[key] || 0) + r.c[key];
      R.decisionShare.push(r.stat.decisions / r.stat.turns); R.drought.push(r.stat.longestDrought);
      R.ownedEnd.push(g.owner.filter((x) => x !== null).length);
      r.stat.byRound.forEach((b, rd) => { if (!b) return; const a = R.byRound[rd] || (R.byRound[rd] = { n: 0, cash: Array(n).fill(0), treasury: 0, worth: Array(n).fill(0), owned: 0, poor: 0 });
        a.n++; b.cash.forEach((v, i) => { a.cash[i] += v; }); b.worth.forEach((v, i) => { a.worth[i] += v; }); a.treasury += b.treasury; a.owned += b.owned; a.poor += b.poor.filter(Boolean).length; });
    }
    out[mode] = R;
    console.log('\n=== ' + mode.toUpperCase() + ' ===');
    console.log('stuck or infinite games: ' + R.stuck + ' of ' + N);
    console.log('length in rounds: median ' + med(R.rounds) + ', mean ' + mean(R.rounds).toFixed(1) + ', p10 ' + pctile(R.rounds, .1) + ', p90 ' + pctile(R.rounds, .9) + ', max ' + Math.max(...R.rounds)
      + ' | turns per game: median ' + med(R.turns));
    console.log('how it ended: ' + JSON.stringify(R.endBy) + '   kinds: ' + JSON.stringify(R.winKind));
    if (mode === 'landlord') console.log('winner by seat (start $): ' + starts.map((s, i) => '$' + s + ' ' + pct(R.winSeat[i], N)).join(' | ')
      + '   | lap spread (fastest-slowest active) at end: median ' + med(R.lapsEnd) + ', p90 ' + pctile(R.lapsEnd, .9) + ' | top worth / bottom worth: median ' + med(R.wealthRatio.map((x) => Math.round(x * 10) / 10)));
    if (mode === 'landlord') console.log('rounds the table waits after the first player has finished 5 laps: median ' + med(R.tail) + ', p90 ' + pctile(R.tail, .9) + ', max ' + Math.max(...R.tail));
    console.log('Poorhouse: a game had at least one ' + pct(R.anyPoor, N) + '; players ' + pct(R.poorCount, N * n) + '; by seat ' + starts.map((s, i) => '$' + s + ' ' + pct(R.poorSeat[i], N)).join(' | '));
    console.log('events per game: ' + Object.entries(R.c).map(([k, v]) => k + ' ' + (v / N).toFixed(1)).join(', '));
    console.log('turns with any choice: ' + (100 * mean(R.decisionShare)).toFixed(0) + '%; longest run of turns with no choice at all: median ' + med(R.drought) + ', max ' + Math.max(...R.drought) + '; lots owned at end: mean ' + mean(R.ownedEnd).toFixed(1) + ' of 22 lots' + (mode === 'landlord' ? ' + 4 rail + 2 franchise = 28' : ''));
    const rows = [1, 5, 10, 15, 20, 25, 30, 40, 60].filter((rd) => R.byRound[rd]);
    console.log('money over time (mean cash per seat, treasury, lots owned, players in Poorhouse; n = games still running):');
    rows.forEach((rd) => { const a = R.byRound[rd]; console.log('  round ' + String(rd).padStart(2) + '  n=' + String(a.n).padStart(3) + '  cash ' + a.cash.map((v) => String(Math.round(v / a.n)).padStart(5)).join(' ')
      + '  treasury ' + String(Math.round(a.treasury / a.n)).padStart(5) + '  lots ' + (a.owned / a.n).toFixed(1).padStart(4) + '  poor ' + (a.poor / a.n).toFixed(2)); });
    console.log('invariant violations: ' + R.issues.length + (R.issues.length ? '\n  ' + R.issues.slice(0, 8).join('\n  ') : ''));
  }
  if (flags.json) fs.writeFileSync(String(flags.json), JSON.stringify(out, (k, v) => v, 1));
}

function policies() {
  const N = Number(flags.games || 300), n = 3, s0 = 1;
  const names = Object.keys(POLICIES);
  console.log('Does a choice matter? Three players, ' + N + ' games per row (seeds ' + s0 + '..' + (s0 + N - 1) + '). Landlord columns and the lone-seat column: equal $500 starts. Prosperity all-win columns: starts 200/350/500.');
  console.log('Landlord: a focal seat (rotating) uses the habit, the others use the default; "win" is the focal seat\'s share (fair share is 33%).');
  console.log('Prosperity: all seats use the habit; the table wins together, so we read the share of games where everyone wins and the median round.\n');
  console.log('habit'.padEnd(18) + 'LANDLORD focal win  focal poor  | PROSPERITY all-win  median round  poor games  (one seat alone, end cash)');
  for (const name of names) {
    let win = 0, poor = 0; const rr = [];
    for (let k = 0; k < N; k++) { const f = k % n, r = simOne('landlord', [500, 500, 500], s0 + k, POLICIES.default, { focal: f, focalPolicy: POLICIES[name] });
      if (r.g.over && r.g.over.winner === f) win++; if (r.g.players[f].poor) poor++; }
    let all = 0, anyPoor = 0;
    for (let k = 0; k < N; k++) { const r = simOne('prosperity', [200, 350, 500], s0 + k, POLICIES[name]);
      if (r.g.over && r.g.over.kind === 'all') { all++; rr.push(r.g.round); } if (r.g.players.some((q) => q.poor)) anyPoor++; }
    // Prosperity, one seat alone: does the habit leave that seat richer in cash than the others (equal $500 starts)?
    const gap = [];
    for (let k = 0; k < N; k++) { const f = k % n, r = simOne('prosperity', [500, 500, 500], s0 + k, POLICIES.default, { focal: f, focalPolicy: POLICIES[name] });
      const others = r.g.players.filter((q) => q.id !== f); gap.push(r.g.players[f].cash - mean(others.map((q) => q.cash))); }
    console.log(name.padEnd(18) + pct(win, N).padStart(18) + pct(poor, N).padStart(12) + '  | ' + pct(all, N).padStart(18) + String(med(rr)).padStart(14) + pct(anyPoor, N).padStart(12)
      + ('  lone seat cash vs others ' + (mean(gap) >= 0 ? '+' : '') + mean(gap).toFixed(0)).padStart(30));
  }
}

// ---------------------------------------------------------------- where the money goes, per game (bots, default habits)
function flows() {
  const N = Number(flags.games || 300), n = Number(flags.players || 3), starts = startsFor(n);
  for (const mode of ['landlord', 'prosperity']) {
    const T = {}; const add = (k, v) => { T[k] = (T[k] || 0) + v; };
    for (let s = 1; s <= N; s++) {
      const r = simOne(mode, starts, s, POLICIES.default), g = r.g;
      add('wages', C.WAGES * g.players.reduce((a, p) => a + p.laps, 0)); add('legacies', C.LEGACY * g.players.reduce((a, p) => a + p.legacies, 0));
      add('cash at the end', g.players.reduce((a, p) => a + p.cash, 0)); add('treasury at the end', g.treasury);
      r.events.forEach((l) => { let m;
        if ((m = /^(.*) pays \$(\d+) rent to (.*) for (.*)\.$/.exec(l))) { const a = +m[2]; add('lot rent', a); add('rents paid (count)', 1); if (a > LG.rentOf(SP[spaceByName[m[4]]])) { add('doubled rents (count)', 1); add('doubled rents ($)', a); } }
        else if ((m = /pays \$(\d+) ground rent/.exec(l))) add('ground rent to Treasury', +m[1]);
        else if ((m = /^(.*) pays \$(\d+) to (.*) at (.*)\.$/.exec(l))) add(/R\.R\./.test(m[4]) ? 'railroad fares' : 'franchise fees', +m[2]);
        else if (/public fare/.test(l)) add('public fares/fees to Treasury', C.PUBLIC_FEE);
        else if (/absolute necessity/.test(l)) add('necessities to Treasury', C.NECESSITY);
        else if (/luxury ticket|for a luxury/.test(l)) add('tickets to Treasury', C.LUXURY);
        else if (/pays the \$50 fine/.test(l)) add('jail fines to Treasury', C.JAIL_FINE);
        else if (/New land in use/.test(l)) add('gifts ($10 each other player)', C.GIFT_ON_PURCHASE * (n - 1));
        else if ((m = /Treasury pays every player \$(\d+)/.exec(l))) add('dividends out of Treasury', +m[1] * n);
        else if ((m = /buys (.*) for \$(\d+)[.,]/.exec(l)) && !/luxury/.test(l)) add(g.rules.price === 'bank' ? 'paid to the bank for land' : 'paid into the Treasury for land', +m[2]); });
    }
    console.log('\n' + mode.toUpperCase() + ', per game (mean of ' + N + '), ' + n + ' players, start total $' + starts.reduce((a, b) => a + b, 0));
    Object.keys(T).forEach((k) => console.log('  ' + k.padEnd(34) + (k.includes('count') ? (T[k] / N).toFixed(1) : '$' + Math.round(T[k] / N))));
  }
}

// ---------------------------------------------------------------- small hand-made situations that bots rarely reach
function scenarios() {
  const mk = (mode, starts, seed) => { const events = []; const g = makeGame(mode, starts, seed, null, events); return { g, events }; };
  let t = mk('prosperity', [200, 350, 500], 5), a = t.g.players[0];
  a.cash = 5; t.g.owner[1] = 0; LG.pay(t.g, a, 100, 'treasury');
  console.log('A. Prosperity, cannot pay $100 with $5 and Hollow Road: poor=' + a.poor + ' cash=' + a.cash + ' lots=' + LG.ownedBy(t.g, a).length + ' treasury=' + t.g.treasury + ' :: ' + t.events.join(' / '));
  a.cash = 55; t.g.turn = 2; LG.nextPlayer(t.g); const lb = a.laps, cb = a.cash; LG.playTurn(t.g, () => false);
  console.log('   given $55 it leaves the Poorhouse at square ' + 39 + '; its first move: laps ' + lb + ' -> ' + a.laps + ', cash ' + cb + ' -> ' + a.cash + ' (the move only left the Poorhouse)');
  t = mk('prosperity', [200, 350, 500], 6); t.g.players[0].poor = true; t.g.players[0].cash = 450;
  console.log('B. Prosperity, the poorest starter sits in the Poorhouse holding $450 (>= 2 x $200): game over? ' + !!LG.checkEnd(t.g));
  t = mk('landlord', [200, 350, 500], 6); t.g.players[1].poor = true; t.g.players[2].poor = true; t.g.players[0].cash = 10;
  console.log('C. Landlord, last player standing with $10 against two poor players: ' + LG.checkEnd(t.g).text);
  t = mk('landlord', [500, 500, 500], 6); const pp = t.g.players[0]; pp.pos = 36; t.g.dice = [2, 2]; const c0 = pp.cash; LG.move(t.g, pp);
  console.log('D. Landlord, 36 + 4 lands exactly on Mother Earth (square ' + pp.pos + '): wages paid $' + (pp.cash - c0));
  t = mk('prosperity', [200, 350, 500], 6); t.g.treasury = 100; const t0 = t.g.players.map((x) => x.cash); LG.passMotherEarth(t.g, t.g.players[0]);
  console.log('E. Prosperity, Treasury $100 and 3 players: each gets $' + (t.g.players[1].cash - t0[1]) + ', Treasury keeps $' + t.g.treasury + ' (half of $100 is $50; each share rounds down, so $2 of that half stays behind)');
  t = mk('landlord', [10, 500, 500], 1); t.g.players[0].cash = 10; [1, 3, 4, 31].forEach((i) => { t.g.owner[i] = 0; });
  LG.pay(t.g, t.g.players[0], 55, t.g.players[1]);
  console.log('F. Landlord, debt $55 with $10 cash and lots Hollow 60, Mill 60, Brook 80, Park Avenue 300: lots left ' + LG.ownedBy(t.g, t.g.players[0]).map((i) => SP[i].name + '(' + SP[i].price + ')').join(', ') + '; cash ' + t.g.players[0].cash + ' :: ' + t.events.join(' / '));
  t = mk('landlord', [10, 500, 500], 1); t.g.players[0].cash = 10; [1, 6, 11].forEach((i) => { t.g.owner[i] = 0; });
  LG.pay(t.g, t.g.players[0], 55, t.g.players[1]);
  console.log('J. Landlord, round 1 hand game of Oct 12: debt $55 with $10 and Hollow Road 60, Orchard Row 100, Elm Avenue 140: lots left ' + LG.ownedBy(t.g, t.g.players[0]).map((i) => SP[i].name).join(', ') + ' :: ' + t.events.join(' / '));
  t = mk('landlord', [500, 500, 500], 6); [1, 3, 4].forEach((i) => { t.g.owner[i] = 1; }); t.g.players[0].pos = 3; const c1 = t.g.players[0].cash; LG.land(t.g, t.g.players[0]);
  console.log('G. Landlord, one owner holds Hollow Road, Mill Street and Brook Lane (3 of 6 on the bottom side): Mill Street rent $' + (c1 - t.g.players[0].cash) + ' instead of $' + LG.rentOf(SP[3]));
  console.log('H. Lots per side (bottom, left, top, right): ' + [0, 1, 2, 3].map((k) => SP.filter((x, i) => x.kind === 'lot' && Math.floor(i / 10) === k).length).join(' / ') + '; the double needs 3 of them');
  t = mk('prosperity', [200, 350, 500], 7); t.g.players[1].pos = 3; t.g.owner[3] = 1; const c2 = t.g.players[1].cash; const dd = LG.land(t.g, t.g.players[1]);
  console.log('I. Prosperity, landing on your own lot: asks nothing, pays $' + (c2 - t.g.players[1].cash) + '; landing on a free lot: asks to buy, charges nothing (' + JSON.stringify(LG.land(t.g, Object.assign(t.g.players[2], { pos: 1 }))) + ')');
}

// ---------------------------------------------------------------- the round 2 decisions, measured
// Each row: the rules as given (anything not named is the adopted default). Same seeds for every row.
function variants() {
  const N = Number(flags.games || 300);
  const rows = flags.rows ? JSON.parse(String(flags.rows)) : [
    ['old rules (before round 2)', { price: 'bank', sale: 'cheapest', end: 'rounds', win: 'double' }],
    ['price into the Treasury only', { price: 'treasury', sale: 'cheapest', end: 'rounds', win: 'double' }],
    ['forced sale: least land given up only', { price: 'bank', sale: 'least', end: 'rounds', win: 'double' }],
    ['Prosperity ends at five laps only', { price: 'bank', sale: 'cheapest', end: 'laps', win: 'double' }],
    ['ROUND 2 (the three decisions, the old doubling win)', { win: 'double' }],
    ['ADOPTED (round 2 + the Prosperity tension win)', {}],
  ];
  const run = (mode, starts, rules, pol, k) => simOne(mode, starts, k, POLICIES[pol || 'default'], { rules });
  console.log('Variants, ' + N + ' games a cell, 3 players. L = landlord\'s way, starts 200/350/500; P = Prosperity, starts 200/350/500 unless said.');
  for (const [name, rules] of rows) {
    const L = { win: [0, 0, 0], poor: 0, rounds: [], sells: 0 };
    for (let k = 1; k <= N; k++) { const r = run('landlord', [200, 350, 500], rules, null, k); L.rounds.push(r.g.round); if (r.g.over.winner !== undefined) L.win[r.g.over.winner]++;
      if (r.g.players.some((q) => q.poor)) L.poor++; L.sells += r.c.sell; }
    const P = {};
    for (const pol of ['default', 'never-buy', 'always-buy', 'rich-buy', 'poor-buy', 'give-above-start']) { let all = 0; const rr = [];
      for (let k = 1; k <= N; k++) { const r = run('prosperity', [200, 350, 500], rules, pol, k); if (r.g.over.kind === 'all') { all++; rr.push(r.g.round); } }
      P[pol] = pct(all, N) + ' (r' + med(rr) + ')'; }
    let eqAll = 0, eq4 = 0, eq2 = 0;
    for (let k = 1; k <= N; k++) { if (run('prosperity', [500, 500, 500], rules, null, k).g.over.kind === 'all') eqAll++;
      if (run('prosperity', [200, 350, 500, 800], rules, null, k).g.over.kind === 'all') eq4++;
      if (run('prosperity', [200, 350], rules, null, k).g.over.kind === 'all') eq2++; }
    // the lone buyer in Prosperity: one seat always buys, the others never (equal $350 starts); its end cash minus the others' mean
    const gap = []; for (let k = 1; k <= N; k++) { const f = k % 3; const r = simOne('prosperity', [350, 350, 350], k, POLICIES['never-buy'], { rules, focal: f, focalPolicy: POLICIES['always-buy'] });
      gap.push(r.g.players[f].cash - mean(r.g.players.filter((q) => q.id !== f).map((q) => q.cash))); }
    console.log('\n' + name + '  ' + JSON.stringify(rules));
    console.log('  L: wins by start $200/$350/$500 ' + L.win.map((w) => pct(w, N)).join(' / ') + '; a Poorhouse in ' + pct(L.poor, N) + ' of games; lots sold back ' + (L.sells / N).toFixed(2) + ' a game; median ' + med(L.rounds) + ' rounds');
    console.log('  P everyone wins (median round), by buying habit: ' + Object.entries(P).map(([k, v]) => k + ' ' + v).join(' | '));
    console.log('  P everyone wins with 2 players ' + pct(eq2, N) + ', 4 players ' + pct(eq4, N) + ', equal $500 starts ' + pct(eqAll, N) + '; a lone buyer ends ' + (mean(gap) >= 0 ? '+' : '') + mean(gap).toFixed(0) + ' cash against the others');
  }
}

// ---------------------------------------------------------------- what the box must hold
function physical() {
  const N = Number(flags.games || 1000);
  for (const mode of ['landlord', 'prosperity']) for (const starts of [[200, 350, 500, 800], [500, 500, 500, 500], [200, 350, 500]]) {
    if (mode === 'prosperity' && starts[0] === 500) continue;
    let maxPlay = 0, maxTreas = 0, maxTickets = 0, maxLaps = 0, maxCash = 0, maxRounds = 0, maxDeeds = 0;
    for (let k = 1; k <= N; k++) { const g = makeGame(mode, starts, k, null, []); let guard = 6000;
      while (!g.over && guard--) { const p = g.players[g.turn]; LG.playTurn(g, (d) => LG.auto(g, p, d));
        maxPlay = Math.max(maxPlay, g.players.reduce((a, q) => a + q.cash, 0) + g.treasury); maxTreas = Math.max(maxTreas, g.treasury);
        maxCash = Math.max(maxCash, ...g.players.map((q) => q.cash)); maxTickets = Math.max(maxTickets, g.players.reduce((a, q) => a + q.tickets, 0));
        maxLaps = Math.max(maxLaps, ...g.players.map((q) => q.laps)); maxDeeds = Math.max(maxDeeds, g.owner.filter((x) => x !== null).length); }
      maxRounds = Math.max(maxRounds, g.round); }
    console.log(mode.padEnd(11) + ' starts ' + starts.join('/').padEnd(16) + ' most money on the table (cash + Treasury) $' + maxPlay + '; Treasury $' + maxTreas + '; one player $' + maxCash
      + '; luxury tickets out ' + maxTickets + '; most laps ' + maxLaps + '; deeds out ' + maxDeeds + '; longest ' + maxRounds + ' rounds');
  }
}

// ---------------------------------------------------------------- Prosperity tension (Oct 12 2026)
// "If everyone wins in Prosperity every time, is it fun?" Each row is one candidate change to the win condition
// or the deadline, passed to the engine as rule functions (engine.js accepts a function for rules.win and
// rules.end). Same seeds in every cell. Target: unequal starts won 55-75% of bot games in 15-25 rounds; equal starts harder.
function tension() {
  const N = Number(flags.games || 1000);
  const doubled = (g, low) => low.every((q) => !q.poor && q.cash >= 2 * q.start);
  const behind = (g, low, rest) => rest.every((q) => !q.poor && q.cash >= q.start);
  const level = (g, low, rest) => rest.every((q) => low.every((l) => l.cash >= q.cash));
  const laps = (g, k, every) => { const a = g.players.filter((q) => !q.poor); return every ? a.length > 0 && a.every((q) => q.laps >= k) : g.players.some((q) => q.laps >= k); };
  const rows = [
    ['as of round 2: the poorest doubles, by five laps each', { win: 'double' }],
    ["...before the slowest player's third lap", { win: 'double', end: (g) => laps(g, 3, true) }],
    ["...before anyone's third lap", { win: 'double', end: (g) => laps(g, 3, false) }],
    ["...before anyone's second lap", { win: 'double', end: (g) => laps(g, 2, false) }],
    ['doubled + nobody below their start', { win: (g, l, r) => doubled(g, l) && behind(g, l, r) }],
    ["doubled + nobody below their start, before anyone's third lap", { win: (g, l, r) => doubled(g, l) && behind(g, l, r), end: (g) => laps(g, 3, false) }],
    ['everyone gains what the poorest started with', { win: (g, l) => g.players.every((q) => !q.poor && q.cash >= q.start + l[0].start) }],
    ['every player doubles', { win: (g) => g.players.every((q) => !q.poor && q.cash >= 2 * q.start) }],
    ['doubled + holds as much as anyone', { win: (g, l, r) => doubled(g, l) && level(g, l, r) }],
    ['doubled + as much as anyone + nobody below 2x the least start', { win: (g, l, r) => doubled(g, l) && level(g, l, r) && g.players.every((q) => !q.poor && q.cash >= 2 * l[0].start) }],
    ['ADOPTED: doubled + as much as anyone + nobody below their start', {}],
  ];
  const cell = (starts, rules, pol) => { let w = 0; const rw = [];
    for (let k = 1; k <= N; k++) { const r = simOne('prosperity', starts, k, POLICIES[pol || 'default'], { rules }); if (r.g.over.kind === 'all') { w++; rw.push(r.g.round); } }
    return pct(w, N) + ' r' + med(rw); };
  console.log('Prosperity tension, ' + N + ' bot games a cell (seeds 1..' + N + '); "r" = median round of the won games.');
  console.log('Starts: 2p 200/350, 3p 200/350/500, 4p 200/350/500/800, equal $500. Habits at 3p.');
  for (const [name, rules] of rows) {
    const out = ['3p ' + cell([200, 350, 500], rules), '4p ' + cell([200, 350, 500, 800], rules), '2p ' + cell([200, 350], rules),
      'eq3 ' + cell([500, 500, 500], rules), 'eq4 ' + cell([500, 500, 500, 500], rules), 'eq2 ' + cell([500, 500], rules)];
    for (const pol of ['never-buy', 'always-buy', 'rich-buy', 'poor-buy', 'give-above-start']) out.push(pol + ' ' + cell([200, 350, 500], rules, pol));
    console.log('\n' + name + '\n  ' + out.join(' | '));
  }
}

if (cmd === 'sim') sim();
else if (cmd === 'tension') tension();
else if (cmd === 'variants') variants();
else if (cmd === 'physical') physical();
else if (cmd === 'policies') policies();
else if (cmd === 'flows') flows();
else if (cmd === 'scenarios') scenarios();
else if (cmd === 'help') console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n'));
