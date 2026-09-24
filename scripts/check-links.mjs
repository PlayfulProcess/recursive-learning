#!/usr/bin/env node
/**
 * check-links.mjs — fail on any link inside the site that points at nothing.
 * Pure node, no dependencies.
 *
 *   node scripts/check-links.mjs _site --repo .   what the Pages workflow deploys (it runs this)
 *   node scripts/check-links.mjs .                the repo root, which is the branch-build layout
 *
 * It reads every .html under DIR and every href/src in the static HTML (script bodies, styles and
 * comments are skipped: links a script builds are not seen here), plus every href in the site map
 * of shared/nav.js. Each one is resolved the way a browser would (relative to its page, `/` = DIR)
 * and must exist; a folder needs an index.html. A link into a page with a #fragment that looks
 * like an id must find that id in the page. Links to learning.recursive.eco are checked as local
 * files; any link to game.recursive.eco fails (that domain answers 404). Other external links are
 * not fetched.
 *
 * --repo PATH also fails when a top-level folder of the repo holds an .html page but was not
 * copied into DIR: that is how /glossary/ 404'd for a day after it was merged.
 *
 * Why this exists: on Sep 24 2026 the landing linked /glossary/ while pages.yml did not deploy it.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { createRequire } from 'node:module';

let dirArg = '.', repoArg = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--repo') repoArg = process.argv[++i] || '.';
  else dirArg = process.argv[i];
}
const DIR = resolve(dirArg);
const REPO = repoArg === null ? null : resolve(repoArg);
const LIVE = /^https?:\/\/learning\.recursive\.eco(\/|$)/i;
const DEAD = /game\.recursive\.eco/i;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', '.claude', '_site']);

const problems = [];
const pages = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    // at the repo root, site/ is the Pages root mirrored by the root copies: not a subfolder of the site
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !(d === DIR && e.name === 'site')) walk(join(d, e.name)); }
    else if (e.name.endsWith('.html')) pages.push(join(d, e.name));
  }
})(DIR);

const cache = new Map();
const read = f => { if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8')); return cache.get(f); };
const visible = html => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, m => (m.match(/^<script\b[^>]*>/i) || [''])[0])   // keep <script src>
  .replace(/<style\b[\s\S]*?<\/style>/gi, '');

/* the file a local URL path lands on, or null */
function target(absPath) {
  let p = absPath;
  try { p = decodeURIComponent(p); } catch { /* keep it raw */ }
  let f = join(DIR, ...p.split('/').filter(Boolean));
  if (p.endsWith('/') || p === '') f = join(f, 'index.html');
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  return existsSync(f) ? f : null;
}
function hasId(file, id) {
  const html = read(file);
  return new RegExp(`\\s(?:id|name)\\s*=\\s*["']${id.replace(/[-]/g, '\\-')}["']`).test(html);
}

function check(fromFile, raw, what) {
  const ref = raw.trim().replace(/&amp;/g, '&');
  if (!ref) return;
  if (DEAD.test(ref)) { problems.push(`${what}: ${ref} (game.recursive.eco is dead)`); return; }
  let path, frag = '';
  if (LIVE.test(ref)) {
    path = ref.replace(/^https?:\/\/learning\.recursive\.eco/i, '') || '/';
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
    return;                                                    // external: not fetched
  } else {
    const pageUrl = '/' + relative(DIR, fromFile).split(sep).join('/');
    path = new URL(ref, 'http://x' + pageUrl).pathname;
  }
  const hashAt = ref.indexOf('#');
  if (hashAt >= 0) frag = ref.slice(hashAt + 1);
  path = path.split('#')[0].split('?')[0];
  const f = target(path);
  if (!f) { problems.push(`${what}: ${ref} -> ${path} does not exist`); return; }
  if (frag && /^[A-Za-z][\w-]*$/.test(frag) && f.endsWith('.html') && !hasId(f, frag))
    problems.push(`${what}: ${ref} -> no id="${frag}" in ${relative(DIR, f)}`);
}

let n = 0;
for (const file of pages) {
  const html = visible(read(file));
  const rel = relative(DIR, file).split(sep).join('/');
  for (const m of html.matchAll(/\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    n++; check(file, m[3] ?? m[4], `${rel} ${m[1]}`);
  }
  for (const m of html.matchAll(/<meta\b[^>]*\bcontent\s*=\s*"([^"]*)"/gi)) {
    if (DEAD.test(m[1]) || LIVE.test(m[1])) { n++; check(file, m[1], `${rel} meta`); }
  }
}

/* the site map in shared/nav.js: every section, game and view must exist */
const navFile = join(DIR, 'shared', 'nav.js');
if (existsSync(navFile)) {
  const { SITE } = createRequire(import.meta.url)(navFile);
  const home = target('/') || join(DIR, 'index.html');
  const refs = [...SITE.sections.map(s => s.href), SITE.shelf && SITE.shelf.href,
    ...SITE.games.flatMap(g => [g.href, ...(g.views || []).map(v => v.href)])].filter(Boolean);
  for (const h of refs) { n++; check(home, h, 'shared/nav.js'); }
} else if (pages.some(f => /shared\/nav\.js/.test(read(f)))) {
  problems.push('shared/nav.js is referenced but was not deployed');
}

/* every top-level folder with a page must have been copied */
if (REPO) {
  for (const e of readdirSync(REPO, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || ['site', 'scripts', 'node_modules', '_site', 'docs'].includes(e.name)) continue;
    const hasPage = readdirSync(join(REPO, e.name)).some(f => f.endsWith('.html'));
    if (hasPage && !existsSync(join(DIR, e.name))) problems.push(`${e.name}/ holds pages but is not in ${relative(process.cwd(), DIR) || '.'} (add it to .github/workflows/pages.yml)`);
  }
}

if (problems.length) {
  console.error(`check-links: ${problems.length} broken, of ${n} links in ${pages.length} pages\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-links: ${n} links in ${pages.length} pages, none broken.`);
