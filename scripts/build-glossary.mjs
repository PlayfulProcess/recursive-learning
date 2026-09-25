#!/usr/bin/env node
/**
 * build-glossary.mjs — render the glossary page from the one source of the words.
 * Pure node, no dependencies.
 *
 *   node scripts/build-glossary.mjs              writes glossary/index.html
 *   node scripts/build-glossary.mjs --out DIR    writes DIR/glossary/index.html
 *                                                (scripts/check_all.py --check diffs the two)
 *
 * Inputs: glossary/terms.json (the words) and glossary/spreads.src.json (the spreads). The Words
 * deck (grammars/words-deck/grammar.json) and the caster's site/viewers/spreads.json are built
 * from the same two files by scripts/build_words_deck.py, so this page and the cards carry the
 * same words: the page is one view of the data, the deck another. Edit the JSON, never the HTML.
 *
 * The page is rendered at build time rather than fetched in the browser, so every term's anchor
 * (#alignment, #what-held, ...) exists in the HTML itself: a deep link from a game or the film
 * lands on the term without waiting for any script. Those anchors are published and listed in
 * scripts/live-urls.txt, so an id never changes once it is out.
 *
 * The page wears the site's shell like every other page: it links /theme.css (colour lives there
 * only; no local colour tokens, light only) and /style.css, and loads tarot's <site-header>
 * (tab "words") and <site-footer>.
 *
 * It refuses to write if an id is duplicated, a term points at an unknown section, a `related`
 * id or a spread's term_id does not exist, or a term has no `draw` question: a broken anchor is
 * the one failure a glossary must not have.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const BASE = outIdx !== -1 ? resolve(argv[outIdx + 1] || '.') : ROOT;
const OUT = join(BASE, 'glossary', 'index.html');

const readJson = rel => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const g = readJson('glossary/terms.json');
const sp = readJson('glossary/spreads.src.json');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DECK = '../grammars/words-deck/grammar.json';
const cardUrl = id => `../viewers/cards.html?src=${DECK}&amp;item=${encodeURIComponent(id)}`;
const castUrl = id => `../viewers/caster-studio.html?src=${DECK}&amp;spread=${encodeURIComponent(id)}`;

/* ---- checks: every anchor unique, every link resolvable ---- */
const problems = [];
const ex = g.what_held_example;
const spreads = sp.spreads || [];
const ids = ['main', 'spreads', ...g.sections.map(s => s.id), ...g.terms.map(t => t.id), ex.id,
  ...spreads.map(s => 'spread-' + s.id)];
const seen = new Set();
for (const id of [...ids, ...ids.map(i => i + '-h')]) {
  if (!/^[a-z0-9-]+$/.test(id)) problems.push(`id "${id}" is not lowercase-kebab`);
  if (seen.has(id)) problems.push(`duplicate id "${id}"`);
  seen.add(id);
}
const sectionIds = new Set(g.sections.map(s => s.id));
const termIds = new Set(g.terms.map(t => t.id));
for (const t of g.terms) {
  if (!sectionIds.has(t.section)) problems.push(`${t.id}: unknown section "${t.section}"`);
  for (const r of t.related || []) if (!termIds.has(r)) problems.push(`${t.id}: related "${r}" does not exist`);
  if (!String(t.draw || '').trim()) problems.push(`${t.id}: no \`draw\` question`);
}
for (const s of spreads) for (const p of s.positions || [])
  if (p.term_id && !termIds.has(p.term_id)) problems.push(`spread ${s.id}: term_id "${p.term_id}" does not exist`);
if (problems.length) { console.error('glossary: refusing to write\n  ' + problems.join('\n  ')); process.exit(1); }

const byId = new Map(g.terms.map(t => [t.id, t]));
const nStd = g.terms.filter(t => t.standard).length;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = n => WORDS[n] ?? String(n);
const cap = s => s[0].toUpperCase() + s.slice(1);
const exTerm = ex.id.replace(/-example$/, '');

const termHtml = t => `      <article class="term" id="${esc(t.id)}">
        <h3><a class="self" href="#${esc(t.id)}">${esc(t.term)}</a>
          <span class="tag ${t.standard ? 'std' : 'ours'}">${t.standard ? 'standard' + (t.standard_in ? ' in ' + esc(t.standard_in) : '') : 'ours'}</span></h3>
        <p class="def">${esc(t.definition)}</p>
${t.note ? `        <p class="note">${esc(t.note)}${t.id === exTerm ? ` <a href="#${esc(ex.id)}">Read the example.</a>` : ''}</p>\n` : ''}        <p class="draw"><span class="lab">When you draw it</span>${esc(t.draw)}</p>
        <p class="rel">${(t.related || []).length ? `See also: ${t.related.map(r => `<a href="#${esc(r)}">${esc(byId.get(r).term)}</a>`).join(' &middot; ')}` : ''}<a class="card" href="${cardUrl(t.id)}">Open as a card</a></p>
      </article>`;

const sectionsHtml = g.sections.map(s => {
  const ts = g.terms.filter(t => t.section === s.id);
  return `    <section class="sec" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-h">
      <h2 id="${esc(s.id)}-h">${esc(s.title)}</h2>
      <p class="blurb">${esc(s.blurb)}</p>
${ts.map(termHtml).join('\n')}
    </section>`;
}).join('\n\n');

const posHtml = p => {
  const t = p.term_id ? byId.get(p.term_id) : null;
  const label = p.label || (t ? t.term : '');
  if (t) return `<li><a href="#${esc(t.id)}">${esc(label)}</a>${p.meaning ? `: ${esc(p.meaning)}` : ''}</li>`;
  return `<li><strong>${esc(label)}</strong>: ${esc(p.meaning)}</li>`;
};
const spreadsHtml = spreads.map(s => `      <div class="spread" id="spread-${esc(s.id)}">
        <h3 id="spread-${esc(s.id)}-h">${esc(s.name)}</h3>
        <p class="sdesc">${esc(s.description || '')}</p>
        <ol class="pos">${(s.positions || []).map(posHtml).join('')}</ol>
        <a class="cast" href="${castUrl(s.id)}">Cast it in the Spread Caster</a>
      </div>`).join('\n');

const nav = g.sections.map(s => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`).join('\n      ');
const exRows = ex.rows.map(r => `          <tr><td class="n">${r.step}</td><td>${esc(r.action)}</td><td class="held k-${esc(r.kind)}">${esc(r.held)}</td></tr>`).join('\n');
const title = 'Words · Recursive Eco-Improvement';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<link rel="stylesheet" href="../theme.css?v=1">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(g.description)}">
<meta name="author" content="PlayfulProcess">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(g.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(g.url)}">
<link rel="icon" type="image/svg+xml" href="../spiral.svg">
<link rel="stylesheet" href="../style.css?v=1">
<link rel="alternate" type="application/json" href="terms.json">
<!-- Generated by scripts/build-glossary.mjs from glossary/terms.json and glossary/spreads.src.json.
     Edit the JSON, not this. The Words deck is built from the same files (scripts/build_words_deck.py). -->
<style>
  .wrap{max-width:760px}
  .page{padding:34px 0 20px}
  .page h1{font-family:var(--serif-display);font-weight:600;font-size:clamp(30px,4.4vw,42px);line-height:1.08;margin:0 0 12px}
  .page .lede{margin:0 0 12px;max-width:64ch;font-size:18px}
  .how{font-family:var(--sans);font-size:13.5px;line-height:1.6;color:var(--mut);max-width:66ch;margin:0 0 18px}
  .how code{font-size:12.5px;background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 5px;overflow-wrap:anywhere}
  .doors{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}
  .doors a{font-family:var(--sans);font-size:13px;font-weight:600;color:var(--gold);background:var(--surface);
    border:1px solid var(--line-soft);border-radius:999px;padding:7px 14px}
  .doors a:hover{border-color:var(--gold);text-decoration:none}
  nav.toc{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 32px;padding:0}
  nav.toc a{font-family:var(--sans);font-size:12.5px;color:var(--ink-soft);background:var(--panel2);
    border:1px solid var(--line);border-radius:999px;padding:5px 12px}
  nav.toc a:hover,nav.toc a:focus-visible{border-color:var(--gold);color:var(--gold);text-decoration:none}

  .sec{margin:0 0 34px;scroll-margin-top:16px}
  .sec > h2,.example h2{font-family:var(--sans);font-size:11px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--gold);font-weight:600;margin:0 0 4px}
  .blurb{font-family:var(--sans);font-size:13.5px;color:var(--mut);margin:0 0 12px}

  .term{background:var(--surface);border:1px solid var(--line-soft);border-radius:10px;
    padding:14px 16px 13px;margin:0 0 10px;scroll-margin-top:16px;transition:border-color .2s ease,box-shadow .2s ease}
  .term:target{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .term h3{margin:0;font-family:var(--serif-display);font-weight:600;font-size:21px;line-height:1.2;
    display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
  .term h3 a.self{color:var(--ink)}
  .term h3 a.self:hover,.term h3 a.self:focus-visible{color:var(--gold)}
  .term .tag{margin:0;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
  .term .tag.ours{color:var(--gold);border-color:var(--gold)}
  .term .tag.std{color:var(--ink-soft)}
  .def{margin:7px 0 0;font-size:17px;line-height:1.55;color:var(--ink)}
  .note{margin:6px 0 0;font-size:15px;line-height:1.55;color:var(--ink-soft)}
  .draw{margin:11px 0 0;padding:8px 12px;background:var(--chip);border-radius:8px;font-size:15.5px;line-height:1.5;
    font-style:italic;color:var(--ink)}
  .draw .lab{display:block;font-family:var(--sans);font-style:normal;font-size:10px;font-weight:600;letter-spacing:.16em;
    text-transform:uppercase;color:var(--gold);margin-bottom:2px}
  .rel{margin:9px 0 0;font-family:var(--sans);font-size:12.5px;line-height:1.6;color:var(--mut);
    display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 14px}
  .rel a.card{font-weight:600;white-space:nowrap;margin-left:auto}

  .spread{background:var(--surface);border:1px solid var(--line-soft);border-radius:10px;padding:14px 16px;margin:0 0 10px;
    scroll-margin-top:16px}
  .spread:target{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .spread h3{margin:0;font-family:var(--serif-display);font-weight:600;font-size:19px;line-height:1.2}
  .sdesc{margin:4px 0 6px;font-size:15px;color:var(--ink-soft)}
  ol.pos{margin:0 0 8px;padding-left:1.3em;font-size:15px;line-height:1.55;color:var(--ink-soft)}
  ol.pos li{margin:.2em 0}
  a.cast{font-family:var(--sans);font-size:12.5px;font-weight:600}

  .example{scroll-margin-top:16px;margin:8px 0 34px;border-top:1px solid var(--line);padding-top:18px}
  .example .cap{font-family:var(--sans);font-size:13.5px;line-height:1.6;color:var(--mut);margin:0 0 12px;max-width:66ch}
  table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13.5px;table-layout:fixed;background:var(--surface)}
  th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;color:var(--ink-soft)}
  th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:600}
  th.n,td.n{width:2.2em;color:var(--mut)}
  th.held{width:38%}
  td.held{font-weight:600}
  .k-inner{color:var(--gold)} .k-outer{color:var(--ink-soft)} .k-presence{color:var(--later)} .k-nothing{color:var(--bad)}
  @media (max-width:520px){
    table,tbody,tr,td{display:block;width:100%}
    thead{position:absolute;left:-9999px}
    tr{border-bottom:1px solid var(--line);padding:8px 0}
    td{border:0;padding:2px 8px}
    td.n{width:auto;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
    td.n::before{content:"Step "}
    td.held::before{content:"held: ";font-weight:400;color:var(--mut)}
  }

  .edit{margin:30px 0 0;font-family:var(--sans);color:var(--mut);font-size:12.5px}
</style>
</head>
<body>
<script src="../site-header.js?v=1"></script>
<site-header active="words"></site-header>

<main class="wrap" id="main">
<article class="page">
  <p class="kicker">Words</p>
  <h1>A glossary, and a deck</h1>

  <p class="lede">The words the film and the games lean on, one idea each. ${cap(word(nStd))} are standard
    terms; the other ${word(g.terms.length - nStd)} are ours, marked so. They are working definitions,
    written to be argued with. Each word is also a card, with a question for when you draw it.</p>
  <p class="how">Every term has its own link, so a game card or a frame of the film can point at it:
    <code>learning.recursive.eco/glossary/#what-held</code>. The same words as data:
    <a href="terms.json">terms.json</a>. The page and the deck are built from that one file.</p>

  <div class="doors">
    <a href="../viewers/cards.html?src=${DECK}">Draw them as cards</a>
    <a href="${castUrl('single')}">Cast a single word</a>
    <a href="../viewers/explorer.html?src=${DECK}">Explore the words</a>
  </div>

  <nav class="toc" aria-label="Sections">
      ${nav}
      <a href="#${esc(ex.id)}">Worked example</a>
      <a href="#spreads">Spreads</a>
  </nav>

${sectionsHtml}

    <section class="example" id="${esc(ex.id)}" aria-labelledby="${esc(ex.id)}-h">
      <h2 id="${esc(ex.id)}-h">${esc(ex.title)}</h2>
      <p class="cap">${esc(ex.caption)} The four answers are the ones <a href="#what-held">what held</a> allows:
        <a href="#guardrail-inner">inner rule</a>, <a href="#guardrail-outer">outer rule</a>, <a href="#presence">presence</a>, or nothing.</p>
      <table>
        <thead><tr><th class="n">#</th><th>Action</th><th class="held">What held</th></tr></thead>
        <tbody>
${exRows}
        </tbody>
      </table>
    </section>

    <section class="sec" id="spreads" aria-labelledby="spreads-h">
      <h2 id="spreads-h">Spreads</h2>
      <p class="blurb">Ways to lay the cards out in the Spread Caster. A position named for a word reads
        whichever card lands there through that word.</p>
${spreadsHtml}
    </section>

  <p class="edit">Text CC BY-SA 4.0 &middot;
    <a href="https://github.com/PlayfulProcess/recursive-learning/blob/main/glossary/terms.json">edit the words</a> &middot;
    <a href="https://github.com/PlayfulProcess/recursive-learning/blob/main/glossary/spreads.src.json">edit the spreads</a></p>
</article>
</main>

<script src="../site-footer.js?v=1"></script>
<site-footer></site-footer>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, 'utf8');
console.log(`glossary/index.html written: ${g.terms.length} terms, ${g.sections.length} sections, ${spreads.length} spreads.`);
