#!/usr/bin/env node
/**
 * build-site.mjs — rebuild the game landing from `grammars/_eco_ids.json` + each grammar.json.
 * Pure node, no dependencies, no node_modules. Run it after adding or re-exporting a grammar.
 *
 *   node scripts/build-site.mjs
 *
 * WHERE THE OUTPUT GOES, and why there are two copies
 * ---------------------------------------------------
 * `gh api repos/PlayfulProcess/recursive-learning/pages` answered on Sep 24 2026:
 *
 *     "build_type":"workflow", "cname":"learning.recursive.eco"
 *
 * so learning.recursive.eco is published by the Pages workflow in .github/workflows/pages.yml,
 * with `site/` as its root. Until Sep 24 it was the legacy branch build at game.recursive.eco
 * (now 404), served from the ROOT of `main` by Jekyll; before this file wrote a root index.html,
 * `/` served a Jekyll-themed rendering of README.md.
 *
 * So the landing is written to BOTH places, and they cannot drift because one script writes them:
 *   - `site/index.html`  what the Pages workflow publishes at `/` today
 *   - `index.html`       the repo root, what the branch build would serve if the source is ever
 *                        switched back (Settings -> Pages -> Source)
 *
 * It also makes sure a `.nojekyll` sits at the repo ROOT. Without it Jekyll runs and every path
 * beginning with `_` is silently 404'd — which is exactly what `grammars/_eco_ids.json` was
 * doing (verified: 404 before, the channel importer and this script's own id map both point at
 * it). `site/.nojekyll` did not help, because `site/` is not the published root.
 *
 * It also writes `404.html` to the same two places: the page GitHub Pages shows for any missing
 * path, with the site header, a way home and every game. Pages serves it AT the missing path
 * (/game/nope.html shows it under game/), so every link in it is root-absolute.
 *
 * THE NAVIGATION lives in one file, `shared/nav.js`: the sections, the list of games, the header,
 * the footer. This script loads it with require() and renders the same header and footer into the
 * landing and 404.html (and build-glossary.mjs into the glossary), so those pages show them
 * without waiting for a script. The hand-written pages under game/ get them from the same file at
 * run time, with one line. To add a game or a section, edit shared/nav.js, then run this.
 *
 * The pages under game/ are not touched by this script. They are hand-written.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* The one navigation: sections, games, header, footer (see the top of shared/nav.js). */
const NAV = createRequire(import.meta.url)('../shared/nav.js');
const ids = JSON.parse(readFileSync(join(ROOT, 'grammars', '_eco_ids.json'), 'utf8')).ids;

/* The spiral and the icons, inline — one sprite, copied verbatim from home-v4.html. Inlined
   rather than linked so the page is a single file that works from file:// too. */
const SPRITE = readFileSync(join(ROOT, 'scripts', 'mark.svg'), 'utf8')
  .replace(/^<!--[\s\S]*?-->\s*/, '').trim();

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstLine = s => {
  const t = String(s ?? '').split('\n').find(l => l.trim()) || '';
  return t.length > 150 ? t.slice(0, 147).replace(/\s+\S*$/, '') + '…' : t;
};

const rows = [];
for (const [slug, id] of Object.entries(ids)) {
  const file = join(ROOT, 'grammars', slug, 'grammar.json');
  if (!existsSync(file)) { console.error(`  ! ${slug}: no grammar.json — skipped`); continue; }
  const g = JSON.parse(readFileSync(file, 'utf8'));
  rows.push({
    slug, id,
    name: g.name || slug,
    items: Array.isArray(g.items) ? g.items.length : 0,
    blurb: firstLine(g.description),
    type: g.grammar_type || '',
  });
}
rows.sort((a, b) => b.items - a.items);

/* The glossary (glossary/terms.json) — its size goes into the landing's link to it. */
const nTerms = JSON.parse(readFileSync(join(ROOT, 'glossary', 'terms.json'), 'utf8')).terms.length;

const cards = rows.map(r => `      <li class="g">
        <a class="t" href="https://recursive.eco/view.html?id=${esc(r.id)}">${esc(r.name)}</a>
        <p class="b">${esc(r.blurb)}</p>
        <p class="m">${r.items} item${r.items === 1 ? '' : 's'}${r.type ? ' &middot; ' + esc(r.type) : ''} &middot;
          <a href="grammars/${esc(r.slug)}/grammar.json" aria-label="grammar.json for ${esc(r.name)} (the data)">grammar.json</a> &middot;
          <a href="https://flow.recursive.eco/create/dashboard/unified/new?id=${esc(r.id)}" aria-label="fork ${esc(r.name)} on recursive.eco">fork it</a></p>
      </li>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recursive Learning — the games</title>
<meta name="description" content="Small games about how a thing that improves itself still has to adapt with its environment. Conditional probability made into steps, a deck you have to answer before it turns over, and the words they lean on.">
<meta name="author" content="PlayfulProcess">
<meta property="og:title" content="Recursive Learning — the games">
<meta property="og:description" content="Conditional probability made into steps you actually take, a deck you have to answer before it turns over, and more small games.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://learning.recursive.eco/">
<!-- Generated by scripts/build-site.mjs — edit that (and shared/nav.js for the header, footer
     and the list of games), not this. Written to BOTH site/ (what the Pages workflow publishes)
     and the repo root (what a branch build would serve). See the header of that script. -->
<style>
  :root{
    --bg:#0d0f14; --panel:#151922; --panel2:#1c212c; --line:#2a3140;
    --ink:#e8ecf3; --muted:#8e9aae; --accent:#5ee2b0; --accent-ink:#06281d; --warn:#f0b866;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--ink);color-scheme:dark;
    font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
    -webkit-text-size-adjust:100%}
  .wrap{max-width:840px;margin:0 auto;padding-block:28px 24px;padding-left:16px;padding-right:16px}
  a{color:var(--accent)}
  svg.i{width:1em;height:1em;display:inline-block;vertical-align:-.125em;flex:none}

  /* hero */
  .mark{display:flex;align-items:center;gap:13px;margin:0 0 16px}
  .mark svg{width:40px;height:40px;color:var(--accent);opacity:.92;flex:none}
  h1{font-size:25px;line-height:1.18;margin:0;letter-spacing:-.01em}
  h1 .sub{display:block;font-size:13px;font-weight:400;letter-spacing:.14em;
    text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  .thesis{font-size:15.5px;max-width:64ch;margin:0 0 30px;color:var(--ink)}
  .thesis em{color:var(--accent);font-style:italic}

  /* the two doors */
  .doors{display:grid;gap:14px;grid-template-columns:1fr;margin:0 0 34px}
  @media (min-width:700px){ .doors{grid-template-columns:1fr 1fr;gap:16px} }
  .door{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);
    border-radius:16px;padding:20px 19px 17px;text-decoration:none;color:var(--ink);
    transition:border-color .15s ease,background .15s ease}
  .door:hover,.door:focus-visible{border-color:var(--accent);background:var(--panel2)}
  .door:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .door .top{display:flex;align-items:center;gap:9px;color:var(--accent);font-size:19px}
  .door h2{font-size:19px;margin:0;font-weight:700;color:var(--accent);letter-spacing:-.01em}
  .door .say{margin:9px 0 0;font-size:14.5px;color:var(--ink)}
  .door .teaser{margin:14px 0 0;border-top:1px solid var(--line);padding-top:12px;
    display:grid;gap:7px}
  .door .teaser div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
    font-size:13px;color:var(--muted)}
  .door .teaser b{color:var(--ink);font-size:13.5px;font-weight:700;text-align:right}
  .door .note{margin:14px 0 0;border-top:1px solid var(--line);padding-top:12px;
    font-size:13px;color:var(--warn)}
  .door .alt{margin:6px 0 0;font-size:12px;color:var(--muted)}
  .door .go{margin:15px 0 0;font-size:13.5px;font-weight:700;color:var(--accent);
    display:flex;align-items:center;gap:7px}
  .door.shut{border-style:dashed}
  .door.shut h2,.door.shut .top,.door.shut .go{color:var(--muted)}
  .door.shut:hover,.door.shut:focus-visible{border-color:var(--muted)}

  /* every game, then the quiet row */
  #games,#grammars{scroll-margin-top:12px}
  .k{font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);
    margin:0 0 8px;font-weight:600;display:flex;align-items:center;gap:8px;line-height:1.4}
  .every{margin:0 0 30px}
  .room{color:var(--muted);font-size:13px;max-width:70ch;margin:0 0 15px}
  details.shelf{border-top:1px solid var(--line);padding-top:14px}
  details.shelf summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;min-height:32px}
  details.shelf summary::-webkit-details-marker{display:none}
  details.shelf summary::before{content:"";width:0;height:0;border:5px solid transparent;border-left:7px solid var(--muted);
    transform:translateX(3px)}
  details.shelf[open] summary::before{transform:rotate(90deg) translateY(-3px)}
  details.shelf summary .k{margin:0}
  details.shelf .room{margin-top:10px}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
  .g{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px 14px}
  .g .t{font-size:15px;font-weight:700;text-decoration:none;line-height:1.3;display:inline-block}
  .g .b{margin:5px 0 0;font-size:13px;color:var(--muted)}
  .g .m{margin:7px 0 0;font-size:11.5px;color:var(--muted)}

  .words{font-size:13px;color:var(--muted);margin:0 0 26px;max-width:70ch}
  .words a:first-child{font-weight:700}
</style>
<style id="site-nav-css">
${NAV.CSS}
</style>
</head>
<body>
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-9999px">${SPRITE}</svg>

${NAV.header({ base: '', rel: 'index.html', sprite: true, max: '840px' })}
<main class="wrap" id="main">

  <header class="mark">
    <svg viewBox="0 0 100 100" aria-hidden="true"><use href="#spiral"/></svg>
    <h1><span class="sub">Recursive Learning</span>the games</h1>
  </header>

  <p class="thesis">We're here to do recursive eco-improvement. A thing that improves itself still
    has to adapt <em>with</em> its environment, or adapt the environment — so improvement that
    ignores the ground it stands on tends to stall. These are small places where that
    hypothesis gets played rather than argued: you move something, and you watch what the move
    costs.</p>

  <section id="games" aria-label="Games">
  <div class="doors">

    <a class="door" href="game/spread.html">
      <span class="top"><svg class="i" aria-hidden="true"><use href="#ic-sequence"/></svg>
        <h2>The Walk</h2></span>
      <p class="say">A spread with three positions: where we stand, what we inherited, where it
        ends. A probability is never a property of the world on its own — it is a property of the
        world <em>given a path</em>. Cast the table, move the allocation, and watch which ending moves.</p>
      <div class="teaser">
        <div><span>Spend it all on power</span><b>most walks end in Doom</b></div>
        <div><span>Spend half on stopping, together</span><b>most walks end in the Stop</b></div>
        <div><span>Same world, same dice</span><b>a different path</b></div>
      </div>
      <p class="go">Cast the table <svg class="i" aria-hidden="true"><use href="#ic-arrow"/></svg></p>
    </a>

    <a class="door" href="game/index.html">
      <span class="top"><svg class="i" aria-hidden="true"><use href="#ic-tarot"/></svg>
        <h2>As-If — HOT POTATO edition</h2></span>
      <p class="say">Draw a character, hold it as if it were true, take a step. You cannot turn
        the card over until you have written what changes if it is. The reveal is earned, not
        clicked.</p>
      <p class="alt">The deck: <em>As-If — HOT POTATO edition</em>, ten characters and nine
        hypotheses, public on recursive.eco and exported here as JSON.</p>
      <p class="go">Draw a card <svg class="i" aria-hidden="true"><use href="#ic-arrow"/></svg></p>
    </a>

  </div>

  <div class="every">
    <h2 class="k">Every game</h2>
${NAV.gamesList({ base: '' })}
  </div>
  </section>

  <p class="words"><a href="glossary/">Words</a> &mdash; the ${nTerms} terms the film and the games lean on, from
    <a href="glossary/#alignment">alignment</a> to <a href="glossary/#what-held">what held</a>. One idea each, and a link for each.</p>

  <details class="shelf" id="grammars">
    <summary><h2 class="k"><svg class="i" aria-hidden="true"><use href="#ic-library"/></svg> The grammars behind the games</h2></summary>
    <p class="room">The games play over grammars — decks, sequences, courses — and this repo is
      one channel of <a href="https://recursive.eco">recursive.eco</a>, held in git. The film the
      games belong to is here, and so are the other grammars of the channel. Every one can be
      opened, starred onto your own channel, forked, or corrected — the JSON is right here.</p>
    <ul>
${cards}
    </ul>
  </details>

</main>

${NAV.footer({ base: '', rel: 'index.html', max: '840px' })}
<script src="shared/nav.js"></script>
</body>
</html>
`;

/* Both copies, plus the root .nojekyll that keeps Jekyll's hands off `grammars/_eco_ids.json`. */
const targets = [join(ROOT, 'index.html'), join(ROOT, 'site', 'index.html')];
for (const t of targets) writeFileSync(t, html, 'utf8');

for (const n of [join(ROOT, '.nojekyll'), join(ROOT, 'site', '.nojekyll')]) {
  if (!existsSync(n)) { writeFileSync(n, '', 'utf8'); console.log(`  + ${n} created (Jekyll would 404 every _-prefixed path)`); }
}

const kb = (statSync(targets[0]).size / 1024).toFixed(1);
console.log(`index.html + site/index.html written — ${rows.length} grammars, ${kb} KB.`);
if (statSync(targets[0]).size > 40 * 1024) console.error('  ! over the 40 KB budget');

/* 404.html: what Pages shows for any missing path. It is served AT that path (a bad link under
   /game/ shows it as /game/whatever), so every link here is root-absolute. */
const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · Recursive Learning</title>
<meta name="robots" content="noindex">
<meta name="author" content="PlayfulProcess">
<!-- Generated by scripts/build-site.mjs (the header, footer and games come from shared/nav.js).
     Pages serves this page at whatever path was missing, so every link is root-absolute. -->
<style>
  :root{
    --bg:#0d0f14; --panel:#151922; --panel2:#1c212c; --line:#2a3140;
    --ink:#e8ecf3; --muted:#8e9aae; --accent:#5ee2b0; --accent-ink:#06281d; --warn:#f0b866;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--ink);color-scheme:dark;
    font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
    -webkit-text-size-adjust:100%}
  .wrap{max-width:760px;margin:0 auto;padding-block:28px 24px;padding-left:16px;padding-right:16px}
  a{color:var(--accent)}
  h1{font-size:25px;line-height:1.18;margin:0 0 10px;letter-spacing:-.01em}
  h1 .sub{display:block;font-size:12px;font-weight:400;letter-spacing:.14em;
    text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  .lede{font-size:15.5px;max-width:64ch;margin:0 0 26px}
  .k{font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);
    margin:26px 0 8px;font-weight:600;line-height:1.4}
  ul.more{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:14px;color:var(--muted)}
</style>
<style id="site-nav-css">
${NAV.CSS}
</style>
</head>
<body>
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-9999px">${SPRITE}</svg>

${NAV.header({ base: '/', rel: '404.html', sprite: true, max: '760px' })}
<main class="wrap" id="main">
  <h1><span class="sub">Not found</span>That page isn't here</h1>
  <p class="lede">The address may be mistyped, or the page may have moved. Everything on the site
    is one step from here: <a href="/">the home page</a>, any game below, or the words they use.</p>

  <h2 class="k">Every game</h2>
${NAV.gamesList({ base: '/' })}

  <h2 class="k">More</h2>
  <ul class="more">
    <li><a href="/glossary/">Words, a glossary</a> &mdash; the ${nTerms} terms the film and the games lean on</li>
    <li><a href="/#grammars">The grammars behind the games</a> &mdash; the decks and sequences they play over</li>
  </ul>
</main>

${NAV.footer({ base: '/', rel: '404.html', max: '760px' })}
<script src="/shared/nav.js"></script>
</body>
</html>
`;
for (const t of [join(ROOT, '404.html'), join(ROOT, 'site', '404.html')]) writeFileSync(t, notFound, 'utf8');
console.log('404.html + site/404.html written.');

/* And the glossary page, from glossary/terms.json — one command rebuilds both. */
await import('./build-glossary.mjs');
