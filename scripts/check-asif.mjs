#!/usr/bin/env node
/* The As-If check: checks that game/as-if-engine.js deals the deck's cast, and that the page keeps the
 * deck's honesty rules. Run by scripts/check_all.py (group "asif") and in CI.
 *
 *   node scripts/check-asif.mjs            prints one [ok] / [FAIL] line per claim, exits 1 on a failure
 *
 * PORTED from recursive-iching/scripts/determinism-check.js (the Path Caster's proof: many random
 * trials, one assertion each, "N/N trials" at the end). Here the trials are seeded, so a failure
 * names the seed that reproduces it: game/as-if.html?seed=<n>&spread=...&poss=...&reach=...
 *
 * What it checks, on the real deck (grammars/as-if-hot-potato-edition/grammar.json):
 *   1. the deck reads: a rules item, characters, hypotheses, one weather card, action cards;
 *      a parked card is never an action card and never a character
 *   2. every cast has the deck's shape: Structures = a character + the weather card, read at the
 *      Tell (three positions) or a character turned by the coin (the random draw); Possibilities =
 *      1 or 2 hypotheses (1 to 5 in the random draw), each turned by the coin; Process = one
 *      action card sized to the player's reach. No card twice; never the rules, a divider, a
 *      casting, a case or a parked card
 *   3. the same seed deals the same cast (determinism), and the seeds reach every card in the deck
 *   4. the coin is fair over the trials (45 to 55 percent reversed)
 *   5. a kept cast has the deck's Castings shape: composite_of resolves inside the deck and inside
 *      the downloaded grammar, keywords synthesis + human, "I don't know" recorded as itself, a
 *      forecast outside 0-100 refused, no points, score or stake anywhere
 *   6. the page: links theme.css, loads the engine and shared/nav.js, honours reduced motion,
 *      keeps the first edition (index.html) reachable, says nothing is staked and that I don't
 *      know is legal; the engine has no source of chance but its seed (no Math.random)
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = p => readFileSync(join(ROOT, p), 'utf8');

const DECK = 'grammars/as-if-hot-potato-edition/grammar.json';
const ENGINE = 'game/as-if-engine.js';
const PAGE = 'game/as-if.html';
const TRIALS = 400;

let failures = 0, oks = 0;
const ok = msg => { oks++; console.log('[ok] ' + msg); };
const fail = msg => { failures++; console.error('[FAIL] ' + msg); };
const claim = (cond, msg, why) => (cond ? ok(msg) : fail(msg + (why ? ': ' + why : '')));

for (const p of [DECK, ENGINE, PAGE]) {
  if (!existsSync(join(ROOT, p))) { console.error(`[FAIL] ${p} is missing`); process.exit(1); }
}
const E = require(join(ROOT, ENGINE));
const grammar = JSON.parse(read(DECK));
const d = E.classify(grammar);
const ids = new Set(grammar.items.map(it => it.id));

// ── 1. the deck reads ───────────────────────────────────────────────────
claim(!!d.rules && !!E.section(d.rules, 'The cast'), 'the deck has a rules item with a "The cast" section');
claim(d.characters.length >= 1 && d.hypotheses.length >= 2 && d.actions.length >= 1,
  `the deck deals: ${d.characters.length} characters, ${d.hypotheses.length} hypotheses, ${d.weather.length} weather, ${d.actions.length} action cards`);
claim(d.weather.length === 1, 'exactly one weather card (the Structures read it at the Tell)', `found ${d.weather.length}`);
const parkedIds = new Set(d.parked.map(x => x.id));
claim(d.parked.every(p => !d.actions.includes(p) && !d.characters.includes(p)),
  `${d.parked.length} parked card(s) sit outside the action and character piles`);
const reaches = E.reaches(d);
claim(reaches[0] === 'anyone' && reaches.length >= 1, 'reaches: ' + reaches.join(', '));
claim(E.playable(d) === '', 'the deck can be cast');

// ── 2 + 3. the cast, seeded ─────────────────────────────────────────────
const NEVER = new Set([d.rules && d.rules.id, ...d.dividers.map(x => x.id), ...d.castings.map(x => x.id),
  ...d.cases.map(x => x.id), ...parkedIds].filter(Boolean));
const seen = new Set();
let coins = 0, reversed = 0, shapeBad = 0, detBad = 0;
const counts = { three: {}, random: {} };
const SETTINGS = [];
for (const spread of ['three', 'random'])
  for (const possibilities of spread === 'three' ? ['coin', '1', '2'] : ['coin'])
    for (const reach of reaches) SETTINGS.push({ spread, possibilities, reach });

for (let t = 0; t < TRIALS; t++) {
  const seed = (Math.imul(t + 1, 2654435761) >>> 0);          // a spread of seeds, the same on every run
  for (const s of SETTINGS) {
    const o = Object.assign({ seed }, s);
    const tag = `seed=${seed}&spread=${s.spread}&poss=${s.possibilities}&reach=${s.reach}`;
    let c;
    try { c = E.cast(d, o); } catch (e) { shapeBad++; fail(`${tag}: cast threw ${e.message}`); continue; }
    const problems = [];
    const all = E.cardIds(c);
    if (new Set(all).size !== all.length) problems.push('a card twice');
    for (const id of all) { if (!d.byId[id]) problems.push('unknown id ' + id); if (NEVER.has(id)) problems.push('dealt a card that is never dealt: ' + (d.byId[id] || {}).name); }
    const ch = c.structures.filter(x => x.role === 'character'), we = c.structures.filter(x => x.role === 'weather');
    if (ch.length !== 1 || !d.characters.some(x => x.id === ch[0].id)) problems.push('Structures lack one character');
    const n = c.possibilities.length;
    if (s.spread === 'three') {
      if (we.length !== 1 || we[0].id !== d.weather[0].id) problems.push('Structures lack the weather card');
      if (c.structures.some(x => x.face !== null)) problems.push('a Structure was turned by the coin (it is read at the Tell)');
      const wantN = s.possibilities === 'coin' ? [1, 2] : [Number(s.possibilities)];
      if (!wantN.includes(n)) problems.push(`${n} Possibilities, wanted ${wantN.join(' or ')}`);
    } else {
      if (we.length) problems.push('the random draw dealt the weather card');
      if (!E.FACES.includes(ch[0] && ch[0].face)) problems.push('the random draw left the character unturned');
      if (n < 1 || n > 5) problems.push(`${n} hypotheses, wanted 1 to 5`);
    }
    for (const p of c.possibilities) {
      if (!d.hypotheses.some(h => h.id === p.id)) problems.push('a Possibility that is not a hypothesis');
      if (!E.FACES.includes(p.face)) problems.push('a Possibility without a face');
      coins++; if (p.face === 'reversed') reversed++;
    }
    const pa = d.byId[c.process.id];
    if (!pa || !d.actions.includes(pa)) problems.push('Process is not an action card');
    else if (!(E.reachOf(pa) === 'anyone' || E.reachOf(pa) === s.reach)) problems.push(`Process sized to ${E.reachOf(pa)}, not ${s.reach}`);
    if (problems.length) { shapeBad++; if (shapeBad <= 10) fail(`${tag}: ${problems.join('; ')}`); }
    const again = E.cast(d, o);
    if (JSON.stringify(again) !== JSON.stringify(c) || JSON.stringify(JSON.parse(JSON.stringify(c))) !== JSON.stringify(c)) {
      detBad++; if (detBad <= 5) fail(`${tag}: the same seed dealt a different cast`);
    }
    all.forEach(id => seen.add(id));
    counts[s.spread][n] = (counts[s.spread][n] || 0) + 1;
  }
}
const casts = TRIALS * SETTINGS.length;
claim(shapeBad === 0, `${casts - shapeBad}/${casts} casts have the deck's shape (${TRIALS} seeds x ${SETTINGS.length} settings)`);
claim(detBad === 0, `${casts - detBad}/${casts} casts dealt again from their seed came out the same`);
const dealable = [...d.characters, ...d.hypotheses, ...d.weather, ...d.actions].map(x => x.id);
const unseen = dealable.filter(id => !seen.has(id));
claim(unseen.length === 0, `the seeds reach all ${dealable.length} dealable cards`, 'never dealt: ' + unseen.map(id => d.byId[id].name).join(', '));
const share = reversed / coins;
claim(share >= 0.45 && share <= 0.55, `the coin: ${(100 * share).toFixed(1)}% reversed over ${coins} coins`);
claim(Object.keys(counts.random).length === 5, 'the random draw deals every count from 1 to 5: ' + JSON.stringify(counts.random));
let threw = 0;
for (const bad of [{ seed: -1 }, { seed: 1.5 }, { seed: 2 ** 32 }, { seed: 'x' }]) { try { E.cast(d, bad); } catch (_) { threw++; } }
claim(threw === 4, 'a seed outside 0..4294967295 is refused');

// ── 5. keeping a cast ───────────────────────────────────────────────────
{
  const c = E.cast(d, { seed: 20260920, spread: 'three', possibilities: '2', reach: 'anyone' });
  const [p1, p2] = c.possibilities;
  const rec = {
    shown: { [p1.id]: true, [p2.id]: true },
    forecasts: { [p1.id]: { dir: 'reversed', sure: 70 }, [p2.id]: { dir: 'unknown' } },
    notes: { asIf: 'one small thing', other: 'the other side', asym: 'yes', synthesis: 'held together' },
    stepId: null,
  };
  const item = E.buildCasting(d, c, rec, { date: '2026-09-20', author: '' });
  claim(item.composite_of.length === E.cardIds(c).length && item.composite_of.every(id => ids.has(id)), 'the casting is composed of the cast: composite_of resolves inside the deck');
  claim(['synthesis', 'human'].every(k => item.keywords.includes(k)), 'the casting carries the keywords synthesis and human');
  claim(/I don't know\*\*/.test(item.sections.Forecast) && !/unknown/.test(item.sections.Forecast), '"I don\'t know" is recorded as itself, not as a number');
  claim(/reversed, 70%/.test(item.sections.Forecast), 'a forecast is recorded as a face and a number, 0 to 100');
  claim(/^Casting — Sep 20 2026: /.test(item.name), 'the casting is named the way the deck names its castings');
  claim(E.buildCasting(d, c, rec, { date: '2026-09-20' }).id === item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.id),
    'the casting id is a stable uuid (the same cast on the same day, the same id)');
  const bad = [{ dir: 'upright', sure: 101 }, { dir: 'upright', sure: -1 }, { dir: 'upright', sure: 50.5 }, { dir: 'sideways', sure: 50 }, { dir: 'reversed' }, null];
  claim(bad.every(f => E.normForecast(f) === null), 'a forecast outside 0-100, or without a face, is refused');
  const half = E.buildCasting(d, c, { shown: { [p1.id]: true }, forecasts: {}, notes: {} }, { date: '2026-09-20' });
  claim(/face down, the coin not shown/.test(half.sections.Cast) && /not recorded/.test(half.sections.Forecast),
    'a cast ended early keeps an unshown coin face down and an unrecorded forecast as not recorded');
  const early = E.buildCasting(d, c, { shown: {}, forecasts: {}, notes: {}, turned: { structures: true, possibilities: true, step: false } }, { date: '2026-09-20' });
  const none = E.buildCasting(d, c, { turned: { structures: false, possibilities: false, step: false } }, { date: '2026-09-20' });
  claim(!('The step' in early.sections) && /\*\*face down, not turned\*\* \(Process\)/.test(early.sections.Cast) &&
    (none.sections.Cast.match(/face down/g) || []).length === E.cardIds(c).length,
    'a card the player never turned stays face down in the casting (no step claimed before the step)');
  const ex = E.buildExport(d, c, rec, { date: '2026-09-20', author: 'someone' });
  const exIds = ex.items.map(x => x.id);
  const last = ex.items[ex.items.length - 1];
  claim(new Set(exIds).size === exIds.length && last.composite_of.every(id => exIds.includes(id)),
    'the downloaded grammar stands alone: ids unique, the casting resolves inside it');
  claim(ex.items.slice(0, -1).every(x => JSON.stringify(Object.assign({}, x, { sort_order: 0 })) === JSON.stringify(Object.assign({}, d.byId[x.id], { sort_order: 0 }))),
    'the downloaded cards are the deck\'s own, credits and all');
  const STAKE = /\b(points?|scores?|stakes?|staked|bets?|wagers?|winnings?|leaderboard)\b/i;
  const keys = [];
  (function walk(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.push(k); walk(v); } })(Object.assign({}, ex, { items: [last] }));
  claim(!keys.some(k => STAKE.test(k)), 'no points, score or stake in what a cast keeps', keys.filter(k => STAKE.test(k)).join(', '));
  const md = E.buildMarkdown(d, c, rec, { date: '2026-09-20' });
  claim(md.startsWith('# Casting — Sep 20 2026') && /nothing is staked/.test(md), 'the Markdown copy says what it is');
  const h = E.mdToHtml('**b** *i* [x](https://example.org/a?b=1&c=2) <script>alert(1)</script> [y](javascript:alert(1))');
  claim(!/<script/i.test(h) && !/href="javascript/i.test(h) && /<a href="https:\/\/example\.org\/a\?b=1&amp;c=2"/.test(h),
    'the deck\'s Markdown is escaped; only http(s) links become links');
  const t = E.thumb('https://upload.wikimedia.org/wikipedia/commons/9/93/%EC%B1%85%EA%B1%B0%EB%A6%AC.jpg');
  claim(t === 'https://commons.wikimedia.org/wiki/Special:FilePath/%EC%B1%85%EA%B1%B0%EB%A6%AC.jpg?width=480',
    'a Commons original is asked for as a 480 px rendition', t);
}

// ── 6. the page and the engine ──────────────────────────────────────────
{
  const html = read(PAGE);
  const engine = read(ENGINE);
  const code = engine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  claim(!/Math\.random/.test(code), 'the engine has no source of chance but its seed (no Math.random)');
  claim(/<link rel="stylesheet" href="\.\.\/theme\.css/.test(html), 'the page links ../theme.css (one theme source)');
  claim(/<script src="as-if-engine\.js"><\/script>/.test(html) && /<script src="\.\.\/shared\/nav\.js"><\/script>/.test(html),
    'the page loads the engine and the site header (shared/nav.js)');
  claim(/@media \(prefers-reduced-motion: reduce\)/.test(html) && /REDUCED \? 'auto'/.test(html), 'the page honours reduced motion (no turn animation, no smooth scroll)');
  claim(/<a href="index\.html">/.test(html) && existsSync(join(ROOT, 'game/index.html')), 'the first edition (game/index.html) stays reachable from the page');
  claim(html.includes(`'../${DECK}'`) || html.includes(`'../grammars/as-if-hot-potato-edition/grammar.json'`), 'the page reads the deck by default');
  claim(/Nothing is staked/.test(html) && /I don't know/.test(html) && /nothing on this page predicts anything/.test(html),
    'the page says: nothing is staked, "I don\'t know" is legal, nothing here predicts');
  // a text box is labelled by aria-label, by a <label for=its id>, or by sitting inside a <label>
  const unlabelled = [];
  for (const m of html.matchAll(/<(textarea|input|select)\b[^>]*>/g)) {
    const tg = m[0];
    if (/type="radio"|aria-label=/.test(tg)) continue;
    const id = /\sid="([^"]+)"/.exec(tg);
    const forId = id && (html.includes(`for="${id[1]}"`) || (id[1].includes('${') && html.includes('for="' + id[1].split('${')[0])));
    const before = html.slice(0, m.index);
    const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    if (!forId && !wrapped) unlabelled.push(tg);
  }
  claim(unlabelled.length === 0, 'every text box on the page has a label', unlabelled.join(' '));
  claim(!/<button(?![^>]*type="button")[^>]*>/.test(html), 'every button is type="button" (nothing submits)');
}

console.log(`\n${oks}/${oks + failures} As-If claims hold.`);
if (failures) { console.error(`${failures} FAILED.`); process.exit(1); }
console.log('As-If check PASSED.');
