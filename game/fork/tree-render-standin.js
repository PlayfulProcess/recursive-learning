// A STAND-IN for the Film chat's explainers/belief-tree/tree-render.js, used only until that module is on main.
// It has EXACTLY the contract's exports and nothing else: renderTree, NODES, leafFor. Same node ids, same state
// shape, same events. The game never imports this file directly: game/fork/tree-adapter.js picks it (or the
// Film's module) and the swap is one line there. Do not grow this into a second renderer: anything the game
// needs beyond the contract is drawn by the game in its own DOM, or asked of the Film chat.
//
// Contract (from the Film chat, Sep 24 2026):
//   renderTree(el, state, opts = { animate: true })  calling again on the same el updates in place and animates
//     differences. state = { step: 1..8|null, answers: { gate, alignment, containment, race } each
//     'yes'|'no'|'unknown'|null, lit?: [nodeIds] (overrides glow), open: [nodeIds still uncertain],
//     focus: person slug|null, people (defaults to the shared file), casting: { node, method:
//     'coin'|'yarrow'|'decide'|'unknown', result: 'yes'|'no'|'unknown' }|null, theme: 'dark'|'light'|'auto' }
//   The cast plays AT the node (coin spins and lands; yarrow six quick ticks then the result; decide a firm
//   pulse; unknown a soft question mark), at most 1.6 s, instant under prefers-reduced-motion.
//   Events on el: 'belieftree:castend' { node, method, result }; 'belieftree:select' { node } or { person }.
//   Leaves: alignment yes + containment yes -> proceed; yes/no -> regulate; no/yes -> contain; no/no -> shutdown.
//
// This file touches no DOM when imported (node can import it for the tests). A cast starts when state.casting is
// a new object (not the same object as the last render's); a render whose casting is a different object, or
// null, ends a cast still in flight at once, and its castend fires with the same detail.

export const NODES = [
  { id: 'gate', kind: 'question', key: 'gate', label: 'The gate', short: "can't undo, can't try first?",
    links: [{ to: 'alignment', when: 'yes' }, { to: 'alignment', when: 'no' }, { to: 'alignment', when: 'unknown' }] },
  { id: 'alignment', kind: 'question', key: 'alignment', label: 'Alignment', short: 'our goals, checked in time?',
    links: [{ to: 'containment-if-aligned', when: 'yes' }, { to: 'containment-if-not', when: 'no' }] },
  { id: 'containment-if-aligned', kind: 'question', key: 'containment', label: 'Containment', short: 'if aligned: kept in?',
    links: [{ to: 'proceed', when: 'yes' }, { to: 'regulate', when: 'no' }] },
  { id: 'containment-if-not', kind: 'question', key: 'containment', label: 'Containment', short: 'if not aligned: kept in?',
    links: [{ to: 'contain', when: 'yes' }, { to: 'shutdown', when: 'no' }] },
  { id: 'proceed', kind: 'leaf', label: 'Proceed', leadsFrom: { alignment: 'yes', containment: 'yes' }, links: [] },
  { id: 'regulate', kind: 'leaf', label: 'Regulate', leadsFrom: { alignment: 'yes', containment: 'no' }, links: [] },
  { id: 'contain', kind: 'leaf', label: 'Contain', leadsFrom: { alignment: 'no', containment: 'yes' }, links: [] },
  { id: 'shutdown', kind: 'leaf', label: 'Shut down', leadsFrom: { alignment: 'no', containment: 'no' }, links: [] },
  { id: 'race', kind: 'band', key: 'race', label: 'The race', short: 'if we stopped, would others keep going? (under every branch)', links: [] }
];

export function leafFor(answers) {
  const a = answers && answers.alignment, c = answers && answers.containment;
  if ((a !== 'yes' && a !== 'no') || (c !== 'yes' && c !== 'no')) return null;
  return a === 'yes' ? (c === 'yes' ? 'proceed' : 'regulate') : (c === 'yes' ? 'contain' : 'shutdown');
}

// ── drawing ────────────────────────────────────────────────────────────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';
const POS = {
  gate: { x: 180, y: 32, w: 216, h: 42 },
  alignment: { x: 180, y: 108, w: 216, h: 42 },
  'containment-if-aligned': { x: 92, y: 190, w: 160, h: 42 },
  'containment-if-not': { x: 268, y: 190, w: 160, h: 42 },
  proceed: { x: 48, y: 272, w: 80, h: 30 },
  regulate: { x: 136, y: 272, w: 80, h: 30 },
  contain: { x: 224, y: 272, w: 80, h: 30 },
  shutdown: { x: 312, y: 272, w: 80, h: 30 },
  race: { x: 180, y: 384, w: 344, h: 50 }
};
const EDGES = [
  ['gate', 'alignment', null],
  ['alignment', 'containment-if-aligned', 'yes'], ['alignment', 'containment-if-not', 'no'],
  ['containment-if-aligned', 'proceed', 'yes'], ['containment-if-aligned', 'regulate', 'no'],
  ['containment-if-not', 'contain', 'yes'], ['containment-if-not', 'shutdown', 'no']
];
const DUR = { coin: 1200, yarrow: 1500, decide: 350, unknown: 600 };
const RECS = new WeakMap();
let sharedPeople = null;   // Promise<array>, fetched once, only when a render needs it

const STYLE = `
.bt-root{--bt-box:#1c212c;--bt-line:#2a3140;--bt-ink:#e8ecf3;--bt-muted:#8e9aae;--bt-accent:#5ee2b0;--bt-accent-ink:#06281d;--bt-yes:#f0d9a8;--bt-no:#9fb8d8;--bt-turn:#f08a5e;--bt-leaf:#151922;display:block;width:100%;height:100%;min-height:0}
.bt-root[data-bt-theme="light"]{--bt-box:#ffffff;--bt-line:#cfc8ba;--bt-ink:#1d2230;--bt-muted:#5d6678;--bt-accent:#0d7a57;--bt-accent-ink:#ffffff;--bt-yes:#8a5a00;--bt-no:#2f5d8a;--bt-turn:#b9481b;--bt-leaf:#f4f1ea}
@media (prefers-color-scheme: light){.bt-root[data-bt-theme="auto"]{--bt-box:#ffffff;--bt-line:#cfc8ba;--bt-ink:#1d2230;--bt-muted:#5d6678;--bt-accent:#0d7a57;--bt-accent-ink:#ffffff;--bt-yes:#8a5a00;--bt-no:#2f5d8a;--bt-turn:#b9481b;--bt-leaf:#f4f1ea}}
.bt-svg{display:block;width:100%;height:100%;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.bt-edge{stroke:var(--bt-line);stroke-width:2;fill:none;transition:stroke .4s,stroke-width .4s,opacity .4s}
.bt-edge.is-on{stroke:var(--bt-accent);stroke-width:3}
.bt-edge.is-maybe{stroke:var(--bt-accent);stroke-dasharray:4 4;opacity:.7}
.bt-edge-t{fill:var(--bt-muted);font-size:10px}
.bt-node{cursor:pointer;outline:none}
.bt-box{fill:var(--bt-box);stroke:var(--bt-line);stroke-width:1.5;transition:fill .4s,stroke .4s}
.bt-leaf .bt-box{fill:var(--bt-leaf)}
.bt-band .bt-box{fill:none;stroke-dasharray:6 4}
.bt-node:focus-visible .bt-box{stroke:var(--bt-accent);stroke-width:3}
.bt-node.is-reached .bt-box{fill:var(--bt-accent);stroke:var(--bt-accent)}
.bt-node.is-reached .bt-label{fill:var(--bt-accent-ink)}
.bt-node.is-focus .bt-box{stroke:var(--bt-turn);stroke-width:2.5}
.bt-label{fill:var(--bt-ink);font-size:12.5px;font-weight:700}
.bt-short{fill:var(--bt-muted);font-size:10px}
.bt-glow{fill:none;stroke:var(--bt-accent);stroke-width:2;opacity:0;transition:opacity .4s}
.bt-node.is-open .bt-glow{opacity:.9;animation:bt-breathe 1.4s ease-in-out infinite alternate}
.bt-badge{opacity:0;transition:opacity .3s}
.bt-badge circle{fill:var(--bt-box);stroke:var(--bt-line);stroke-width:1.5}
.bt-badge text{font-size:11px;font-weight:700;fill:var(--bt-ink)}
.bt-node.is-yes .bt-badge,.bt-node.is-no .bt-badge,.bt-node.is-unknown .bt-badge{opacity:1}
.bt-node.is-yes .bt-badge circle{stroke:var(--bt-yes)} .bt-node.is-yes .bt-badge text{fill:var(--bt-yes)}
.bt-node.is-no .bt-badge circle{stroke:var(--bt-no)} .bt-node.is-no .bt-badge text{fill:var(--bt-no)}
.bt-node.is-open.is-yes .bt-badge circle,.bt-node.is-open.is-no .bt-badge circle{stroke-dasharray:3 2.5;stroke-width:2}
.bt-node.is-casting .bt-badge{opacity:0}
.bt-chip{cursor:pointer;outline:none}
.bt-chip circle{fill:var(--bt-box);stroke:var(--bt-muted);stroke-width:1.5}
.bt-chip text{fill:var(--bt-ink);font-size:9.5px;font-weight:700}
.bt-chip.is-focus circle{stroke:var(--bt-turn);stroke-width:2.5}
.bt-chip:focus-visible circle{stroke:var(--bt-accent);stroke-width:3}
.bt-cast{pointer-events:none}
.bt-coin{transform-box:fill-box;transform-origin:center;animation:bt-flip .25s linear 4 alternate}
.bt-coin circle{fill:var(--bt-yes);stroke:var(--bt-ink);stroke-width:1}
.bt-coin text,.bt-res{font-size:10.5px;font-weight:800;fill:var(--bt-accent-ink)}
.bt-cast.is-landed .bt-coin{animation:none}
.bt-res-bg{fill:var(--bt-accent)}
.bt-tick{stroke:var(--bt-ink);stroke-width:2.5;stroke-linecap:round;opacity:0;transition:opacity .08s}
.bt-tick.is-on{opacity:1}
.bt-pulse{fill:none;stroke:var(--bt-accent);stroke-width:3;transform-box:fill-box;transform-origin:center;animation:bt-pulse .35s ease-out 1 forwards}
.bt-q{font-size:22px;font-weight:700;fill:var(--bt-muted);animation:bt-soft .6s ease-in-out 1 forwards}
@keyframes bt-flip{from{transform:scaleX(1)}to{transform:scaleX(-1)}}
@keyframes bt-pulse{from{transform:scale(.8);opacity:1}to{transform:scale(1.6);opacity:0}}
@keyframes bt-soft{from{opacity:0}to{opacity:.95}}
@keyframes bt-breathe{from{opacity:.35}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.bt-node.is-open .bt-glow{animation:none;opacity:.9}.bt-edge,.bt-box,.bt-glow,.bt-badge{transition:none}}
`;

function reducedMotion() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function mk(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) Object.keys(attrs).forEach(k => e.setAttribute(k, String(attrs[k])));
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function ensureStyle() {
  if (document.getElementById('bt-standin-style')) return;
  const s = document.createElement('style'); s.id = 'bt-standin-style'; s.textContent = STYLE;
  document.head.appendChild(s);
}
function fire(el, name, detail) { el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true })); }
function nodeById(id) { return NODES.find(n => n.id === id); }
function answerFor(id, answers) {
  const n = nodeById(id); if (!n || !n.key || !answers) return null;
  return answers[n.key] == null ? null : answers[n.key];
}
function badgeText(a) { return a === 'yes' ? 'Y' : a === 'no' ? 'N' : a === 'unknown' ? '?' : ''; }
function wordOf(a) { return a === 'yes' ? 'yes' : a === 'no' ? 'no' : a === 'unknown' ? "don't know" : 'not answered'; }

function build(el) {
  ensureStyle();
  el.textContent = '';
  const root = document.createElement('div'); root.className = 'bt-root'; el.appendChild(root);
  const svg = mk('svg', { viewBox: '0 0 360 420', class: 'bt-svg', role: 'group', 'aria-label': 'The belief tree', preserveAspectRatio: 'xMidYMid meet' }, root);
  const rec = { el, root, svg, nodes: {}, edges: {}, chips: mk('g', { class: 'bt-chips' }), casts: null, casting: null, inflight: null, state: null };
  const gEdges = mk('g', { class: 'bt-edges' }, svg);
  EDGES.forEach(([a, b, when]) => {
    const p = POS[a], q = POS[b];
    const x1 = p.x, y1 = p.y + p.h / 2, x2 = q.x, y2 = q.y - q.h / 2, my = (y1 + y2) / 2;
    const path = mk('path', { class: 'bt-edge', d: `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}` }, gEdges);
    rec.edges[a + '>' + b] = path;
    if (when) mk('text', { class: 'bt-edge-t', x: (x1 + x2) / 2 + (x2 < x1 ? -12 : 12), y: my + 3, 'text-anchor': 'middle' }, gEdges, when);
  });
  const gNodes = mk('g', { class: 'bt-nodes' }, svg);
  NODES.forEach(n => {
    const p = POS[n.id];
    const g = mk('g', { class: 'bt-node bt-' + n.kind, tabindex: 0, role: 'button', 'data-node': n.id, transform: `translate(${p.x} ${p.y})` }, gNodes);
    mk('rect', { class: 'bt-glow', x: -p.w / 2 - 4, y: -p.h / 2 - 4, width: p.w + 8, height: p.h + 8, rx: 12 }, g);
    mk('rect', { class: 'bt-box', x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: n.kind === 'leaf' ? 15 : 9 }, g);
    if (n.kind === 'leaf') mk('text', { class: 'bt-label', x: 0, y: 4, 'text-anchor': 'middle' }, g, n.label);
    else {
      mk('text', { class: 'bt-label', x: -p.w / 2 + 10, y: -3 }, g, n.label);
      mk('text', { class: 'bt-short', x: -p.w / 2 + 10, y: 12 }, g, n.short);
      const b = mk('g', { class: 'bt-badge', transform: `translate(${p.w / 2 - 15} 0)` }, g);
      mk('circle', { r: 10 }, b);
      mk('text', { 'text-anchor': 'middle', y: 4 }, b, '');
    }
    const pick = () => fire(el, 'belieftree:select', { node: n.id });
    g.addEventListener('click', pick);
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    rec.nodes[n.id] = g;
  });
  svg.appendChild(rec.chips);
  rec.casts = mk('g', { class: 'bt-casts' }, svg);
  return rec;
}

function peopleFor(rec, state) {
  if (Array.isArray(state.people)) return state.people;
  if (state.people === undefined && typeof fetch === 'function') {
    if (!sharedPeople) {
      sharedPeople = fetch(new URL('../../explainers/belief-tree/people.json', import.meta.url))
        .then(r => (r.ok ? r.json() : [])).then(j => (Array.isArray(j) ? j : [])).catch(() => []);
    }
    if (!rec.peopleWait) {
      rec.peopleWait = true;
      sharedPeople.then(list => { rec.shared = list; if (rec.state && rec.state.people === undefined) drawChips(rec, rec.state); });
    }
    return rec.shared || [];
  }
  return [];
}
function initials(name) {
  const w = String(name).split(/[\s-]+/).filter(x => /^[A-Za-z0-9]/.test(x));
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
// A person's path: with alignment yes or no, its side; with alignment open, the side of the leaf they name (so the
// drawn path reaches it), or both sides when they name none.
function personNodes(p) {
  const al = p.alignment && typeof p.alignment === 'object' ? p.alignment.answer : p.alignment;
  const leafSide = { proceed: 'containment-if-aligned', regulate: 'containment-if-aligned', contain: 'containment-if-not', shutdown: 'containment-if-not' };
  const cont = al === 'no' ? ['containment-if-not'] : al === 'yes' ? ['containment-if-aligned']
    : leafSide[p.stated_leaf] ? [leafSide[p.stated_leaf]] : ['containment-if-aligned', 'containment-if-not'];
  const ids = ['gate', 'alignment', ...cont, 'race'];
  if (p.stated_leaf) ids.push(p.stated_leaf);
  return ids;
}
function drawChips(rec, state) {
  const people = peopleFor(rec, state);
  const key = (state.focus || '') + '|' + people.map(p => (p && p.slug) + ':' + (p && p.stated_leaf)).join(',');
  if (key === rec.chipKey) return people;   // unchanged: keep the chips (and keyboard focus on them)
  rec.chipKey = key;
  rec.chips.textContent = '';
  const byLeaf = {};
  people.forEach(p => { if (p && p.stated_leaf && POS[p.stated_leaf]) (byLeaf[p.stated_leaf] = byLeaf[p.stated_leaf] || []).push(p); });
  Object.keys(byLeaf).forEach(leaf => {
    const list = byLeaf[leaf], p0 = POS[leaf], per = 3;
    list.forEach((p, i) => {
      const row = Math.floor(i / per), col = i - row * per, inRow = Math.min(per, list.length - row * per);
      const x = p0.x + (col - (inRow - 1) / 2) * 24, y = p0.y + p0.h / 2 + 16 + row * 22;
      const g = mk('g', { class: 'bt-chip' + (state.focus === p.slug ? ' is-focus' : ''), tabindex: 0, role: 'button',
        'aria-label': (p.name || p.slug) + ': says ' + (nodeById(leaf) ? nodeById(leaf).label : leaf), transform: `translate(${x} ${y})` }, rec.chips);
      mk('circle', { r: 10 }, g);
      mk('text', { 'text-anchor': 'middle', y: 3.5 }, g, initials(p.name || p.slug || '?'));
      const pick = () => fire(rec.el, 'belieftree:select', { person: p.slug });
      g.addEventListener('click', pick);
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    });
  });
  return people;
}

function paint(rec, state) {
  const answers = state.answers || {};
  const glow = new Set(Array.isArray(state.lit) ? state.lit : (state.open || []));
  const leaf = leafFor(answers);
  const people = drawChips(rec, state);
  const focusP = state.focus ? people.find(p => p && p.slug === state.focus) : null;
  const focusSet = new Set(focusP ? personNodes(focusP) : []);
  NODES.forEach(n => {
    const g = rec.nodes[n.id], a = answerFor(n.id, answers);
    g.classList.toggle('is-open', glow.has(n.id));
    ['yes', 'no', 'unknown'].forEach(v => g.classList.toggle('is-' + v, a === v));
    g.classList.toggle('is-reached', n.kind === 'leaf' && leaf === n.id);
    g.classList.toggle('is-focus', focusSet.has(n.id));
    const t = g.querySelector('.bt-badge text'); if (t) t.textContent = badgeText(a);
    // an answer that is yes or no yet still open was cast, not known: its badge ring is dashed, as its edge is
    const castYN = glow.has(n.id) && (a === 'yes' || a === 'no');
    let label = n.label + (n.short ? ', ' + n.short : '');
    if (n.kind === 'leaf') label += leaf === n.id ? ': where the answers lead' : '';
    else label += ': ' + wordOf(a) + (castYN ? ', cast, not known' : '');
    if (glow.has(n.id) && !castYN) label += ', still open';
    g.setAttribute('aria-label', label);
  });
  // Solid: an answer that is settled. Dashed: an open one, or one still in state.open (cast, not known), so a cast
  // answer never lights its edge the way a decision does.
  const al = answers.alignment, co = answers.containment;
  const on = {}, maybe = {};
  if (answers.gate != null) (glow.has('gate') ? maybe : on)['gate>alignment'] = true;
  const alSide = al === 'yes' ? ['containment-if-aligned'] : al === 'no' ? ['containment-if-not'] : al === 'unknown' ? ['containment-if-aligned', 'containment-if-not'] : [];
  alSide.forEach(c => { (al === 'unknown' || glow.has('alignment') ? maybe : on)['alignment>' + c] = true; });
  alSide.forEach(c => {
    const kids = c === 'containment-if-aligned' ? ['proceed', 'regulate'] : ['contain', 'shutdown'];
    const pick = co === 'yes' ? [kids[0]] : co === 'no' ? [kids[1]] : co === 'unknown' ? kids : [];
    pick.forEach(k => { (al === 'unknown' || co === 'unknown' || glow.has('alignment') || glow.has(c) ? maybe : on)[c + '>' + k] = true; });
  });
  Object.keys(rec.edges).forEach(k => {
    rec.edges[k].classList.toggle('is-on', !!on[k]);
    rec.edges[k].classList.toggle('is-maybe', !on[k] && !!maybe[k]);
  });
}

// ── casting ────────────────────────────────────────────────────────────────────────────────────
function later(fl, fn, ms) { fl.timers.push(setTimeout(fn, ms)); }
function finishCast(rec, fl) {
  if (fl.done) return;
  fl.done = true;
  fl.timers.forEach(t => clearTimeout(t));
  if (fl.frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(fl.frame);
  if (fl.overlay && fl.overlay.parentNode) fl.overlay.parentNode.removeChild(fl.overlay);
  const g = rec.nodes[fl.detail.node]; if (g) g.classList.remove('is-casting');
  if (rec.inflight === fl) rec.inflight = null;
  fire(rec.el, 'belieftree:castend', { node: fl.detail.node, method: fl.detail.method, result: fl.detail.result });
}
function startCast(rec, casting, instant) {
  const detail = { node: casting.node, method: casting.method, result: casting.result };
  const fl = { casting, detail, timers: [], frame: null, overlay: null, done: false };
  rec.inflight = fl;
  const g = rec.nodes[casting.node], p = POS[casting.node];
  if (instant || !g || !DUR[casting.method]) {
    if (typeof requestAnimationFrame === 'function') fl.frame = requestAnimationFrame(() => finishCast(rec, fl));
    later(fl, () => finishCast(rec, fl), 40);   // a hidden tab never paints a frame
    return;
  }
  g.classList.add('is-casting');
  const res = casting.result === 'yes' ? 'yes' : casting.result === 'no' ? 'no' : '?';
  const ox = casting.node === 'race' ? p.x + p.w / 2 - 34 : p.x + p.w / 2 - 15;
  const ov = mk('g', { class: 'bt-cast', transform: `translate(${ox} ${p.y})` }, rec.casts);
  fl.overlay = ov;
  const showResult = () => {
    ov.classList.add('is-landed');
    mk('rect', { class: 'bt-res-bg', x: -16, y: -10, width: 32, height: 20, rx: 10 }, ov);
    mk('text', { class: 'bt-res', 'text-anchor': 'middle', y: 4 }, ov, res);
  };
  if (casting.method === 'coin') {
    const c = mk('g', { class: 'bt-coin' }, ov);
    mk('circle', { r: 13 }, c);
    later(fl, () => { if (c.parentNode) c.parentNode.removeChild(c); showResult(); }, 1000);
  } else if (casting.method === 'yarrow') {
    const ticks = [];
    for (let i = 0; i < 6; i++) ticks.push(mk('line', { class: 'bt-tick', x1: -15 + i * 6, y1: -9, x2: -15 + i * 6, y2: 9 }, ov));
    ticks.forEach((t, i) => later(fl, () => t.classList.add('is-on'), 60 + i * 160));
    later(fl, () => { ticks.forEach(t => t.parentNode && t.parentNode.removeChild(t)); showResult(); }, 1080);
  } else if (casting.method === 'decide') {
    mk('circle', { class: 'bt-pulse', r: 16 }, ov);
  } else {
    mk('text', { class: 'bt-q', 'text-anchor': 'middle', y: 8 }, ov, '?');
  }
  later(fl, () => finishCast(rec, fl), DUR[casting.method]);
}

export function renderTree(el, state, opts = { animate: true }) {
  if (!el) throw new Error('renderTree: no element');
  state = state || {};
  let rec = RECS.get(el);
  if (!rec || !rec.root.isConnected || rec.root.parentNode !== el) { rec = build(el); RECS.set(el, rec); }
  rec.state = state;
  rec.root.setAttribute('data-bt-theme', state.theme === 'light' || state.theme === 'dark' ? state.theme : 'auto');
  paint(rec, state);
  const instant = (opts && opts.animate === false) || reducedMotion();
  const next = state.casting || null, prev = rec.casting;
  rec.casting = next;
  if (rec.inflight && rec.inflight.casting !== next) finishCast(rec, rec.inflight);
  if (next && next !== prev) startCast(rec, next, instant);
}
