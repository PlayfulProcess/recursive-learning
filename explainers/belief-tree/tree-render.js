/*
 * tree-render.js — the belief tree, drawn once and shared.
 * One renderer for the explainer page (index.html in this folder), the film's "you are here"
 * dividers, and the Lab's game, so all three show the same tree with the same animation.
 * An ES module with no dependencies. Content CC BY-SA 4.0, code Apache-2.0.
 *
 * API (agreed between the Film and Lab chats, Sep 24 2026)
 *   renderTree(el, state, opts = { animate: true, layout: 'auto' })
 *       Draws the tree into `el` as inline SVG. Called again on the same `el`, it updates in place
 *       and animates the differences (a cut when opts.animate is false or the viewer prefers
 *       reduced motion). opts.layout: 'wide' | 'narrow' | 'auto' (auto = narrow under 560 px).
 *   NODES            [{ id, title, sub, parent, children, via, leaf, answers }] (stable ids below)
 *   leafFor(answers) 'proceed' | 'regulate' | 'contain' | 'shutdown' | null
 *   STEP_LIT         { 1..8: [nodeIds] } what each explainer step lights (8 = the person in focus)
 *   LEAF_LABEL       { proceed, regulate, contain, shutdown, outside } display names
 *   loadPeople(url?) fetches people.json (default: next to this module) once and caches it
 *   nodeRect(el, id) where a node will sit once the current change settles, in viewport pixels
 *                    ({ top, bottom, left, right }), so a page can scroll it into view mid-animation
 *
 * Node ids: gate, alignment, containment-if-aligned, containment-if-not,
 *           proceed, regulate, contain, shutdown, race.
 * Leaves:   alignment yes + containment yes -> proceed · yes/no -> regulate
 *           no/yes -> contain · no/no -> shutdown.
 *
 * state = {
 *   step:    1..8 | null     explainer step; null = the game drives it by answers / lit
 *   answers: { gate, alignment, containment, race }  each 'yes'|'no'|'unknown'|null
 *   lit:     [nodeIds]       optional override of what glows (coral)
 *   open:    [nodeIds]       still uncertain: drawn with a dashed outline
 *   focus:   '<person slug>' | null   a lens that lasts across steps: that person's chip is shown at every
 *                            step with a ring; at step 8 their path lights up, and the nodes where their own
 *                            answer is not a plain yes or no are drawn open (dashed); so is the edge that
 *                            answer leads down, and its label says their answer ('depends', 'not known',
 *                            'not addressed') instead of the yes/no of the branch
 *   people:  [...]           defaults to the cached people.json (see loadPeople); [] hides chips
 *   casting: { node, method: 'coin'|'yarrow'|'decide'|'unknown', result: 'yes'|'no'|'unknown' } | null
 *   theme:   'dark' | 'light' | 'auto'
 * }
 * Chips: with a step, a leaf's people appear when a step first lights that leaf and stay (dimmer)
 * after; people a step's caption names (STEP_NAMED) appear from that step; step 6 keeps the Proceed
 * people dim, so its caption reads as being about the branch, not about them; step 8 shows everyone,
 * including "outside the tree". With step null, every person passed is shown. Chips are neutral: no
 * good/bad colours; the focus ring is selection, not judgement. A chip is drawn solid when the
 * person's own two answers lead to their leaf (placed_by 'answers') and dashed when they are placed by
 * what they ask for ('ask', 'plan'): at least one of their answers is not known yet, conditional or not
 * addressed. The narrow layout sizes its chip band to the chips on show (no empty band in steps 1-3).
 * Whenever a dashed chip is on show, a two-line key says what solid and dashed mean (top left in the
 * wide layout, under the race in the narrow one); opts.legend === false leaves it out.
 *
 * people.json holds public fields only (it is served with the page): slug, name, short, role,
 * stated_leaf, placed_by, scope, confidence, gate/alignment/containment {answer, basis}, race,
 * own_conditional, to_move[], card_quote_ids, shares_principle_with, on_record[], reader_notes[],
 * quotes[] {id, text, verbatim, wording?, speaker_confirmed?, context?, checked_against, video_id,
 * start_sec, end_sec, source_label, url}, channel_url, channel_label? (link text). Editor notes (cautions, how each quote was
 * checked, film item ids) are kept out of this public repo, in the private recursive-transcripts repo.
 *
 * Events dispatched on `el`:
 *   belieftree:select   detail { node } | { person }   a node or a person chip was tapped (or Enter/Space)
 *   belieftree:castend  detail { node, method, result } a cast finished
 */

const SVGNS = 'http://www.w3.org/2000/svg';

export const LEAF_LABEL = {
  proceed: 'Proceed', regulate: 'Regulate use', contain: 'Contain', shutdown: 'Shut down',
  outside: 'Outside the tree',
};

export const NODES = [
  { id: 'gate', title: 'The gate', sub: "If it can't be tested first or undone after, the burden of proof is on whoever proceeds",
    parent: null, children: ['alignment'], via: null, leaf: false },
  { id: 'alignment', title: 'Is alignment solvable?', sub: 'Will it want what we want?',
    parent: 'gate', children: ['containment-if-aligned', 'containment-if-not'], via: null, leaf: false },
  { id: 'containment-if-aligned', title: 'Is containment solvable?', sub: 'Can we keep it boxed?',
    parent: 'alignment', children: ['proceed', 'regulate'], via: 'yes', leaf: false },
  { id: 'containment-if-not', title: 'Is containment solvable?', sub: 'Can we keep it boxed?',
    parent: 'alignment', children: ['contain', 'shutdown'], via: 'no', leaf: false },
  { id: 'proceed', title: 'Proceed', sub: 'trust: yes · cage: yes', parent: 'containment-if-aligned', children: [],
    via: 'yes', leaf: true, answers: { alignment: 'yes', containment: 'yes' } },
  { id: 'regulate', title: 'Regulate use', sub: 'trust: yes · cage: no', parent: 'containment-if-aligned',
    children: [], via: 'no', leaf: true, answers: { alignment: 'yes', containment: 'no' } },
  { id: 'contain', title: 'Contain', sub: 'trust: no · cage: yes', parent: 'containment-if-not',
    children: [], via: 'yes', leaf: true, answers: { alignment: 'no', containment: 'yes' } },
  { id: 'shutdown', title: 'Shut down', sub: 'trust: no · cage: no', parent: 'containment-if-not', children: [],
    via: 'no', leaf: true, answers: { alignment: 'no', containment: 'no' } },
  { id: 'race', title: 'Underneath every branch: the race',
    sub: "No villains needed: each lab thinks it's the careful one, so it must lead.",
    parent: null, children: [], via: null, leaf: false },
];
const LEAVES = ['proceed', 'regulate', 'contain', 'shutdown'];

export const STEP_LIT = {
  1: ['gate'], 2: ['alignment'], 3: ['containment-if-aligned', 'containment-if-not'],
  4: ['shutdown'], 5: ['regulate', 'contain'], 6: ['proceed'], 7: ['race'], 8: [],
};
/* people a step's caption names: their chips show from that step (lit at it), so the names have a place */
export const STEP_NAMED = { 3: ['huang', 'yampolskiy'] };
/* how the page words a person's own answer at a node */
export const ANSWER_WORD = { yes: 'yes', no: 'no', unclear: 'not known yet', conditional: 'depends',
  'not-addressed': 'not addressed', unknown: 'not known yet' };

export function leafFor(answers) {
  const a = answers && answers.alignment, c = answers && answers.containment;
  if (a === 'yes' && c === 'yes') return 'proceed';
  if (a === 'yes' && c === 'no') return 'regulate';
  if (a === 'no' && c === 'yes') return 'contain';
  if (a === 'no' && c === 'no') return 'shutdown';
  return null;
}

let cachedPeople = null;
export async function loadPeople(url) {
  if (cachedPeople && !url) return cachedPeople;
  const res = await fetch(url || new URL('people.json', import.meta.url));
  if (!res.ok) throw new Error('people.json: HTTP ' + res.status);
  const data = await res.json();
  if (!url) cachedPeople = data;
  return data;
}

/* ---------------- geometry ---------------- */
const LAYOUTS = {
  wide: {
    w: 1000, h: 700,
    font: { title: 21.5, sub: 15.5, leafTitle: 20.5, leafSub: 14.5, edge: 14, chip: 15, zone: 12.5 },
    nodes: {
      gate: { x: 500, y: 60, w: 470, h: 84 },
      alignment: { x: 500, y: 178, w: 340, h: 62 },
      'containment-if-aligned': { x: 254, y: 300, w: 300, h: 62 },
      'containment-if-not': { x: 746, y: 300, w: 300, h: 62 },
      proceed: { x: 130, y: 424, w: 220, h: 70 },
      regulate: { x: 377, y: 424, w: 220, h: 70 },
      contain: { x: 623, y: 424, w: 220, h: 70 },
      shutdown: { x: 870, y: 424, w: 220, h: 70 },
      race: { x: 500, y: 653, w: 960, h: 58 },
    },
    lines: {
      gate: { sub: ["If it can't be tested first or undone after,", 'the burden of proof is on whoever proceeds'] },
    },
    chip: { w: 106, h: 28, gap: 8, rowGap: 8, cols: 2, top: 472 },
    outside: { x: 866, y: 58, w: 240, h: 84, labelDx: 0, labelDy: -24, chipsTop: 64, cols: 2, row: false },
    legend: { x: 10, y: 28, font: 14, pill: 26, rowH: 25 },
  },
  narrow: {
    w: 400, h: 880, dynamic: true,
    font: { title: 17.5, sub: 13.5, leafTitle: 16, leafSub: 12.5, edge: 13, chip: 14, zone: 12.5 },
    nodes: {
      gate: { x: 200, y: 50, w: 380, h: 92 },
      alignment: { x: 200, y: 164, w: 310, h: 66 },
      'containment-if-aligned': { x: 104, y: 280, w: 188, h: 86 },
      'containment-if-not': { x: 296, y: 280, w: 188, h: 86 },
      proceed: { x: 53, y: 410, w: 94, h: 90 },
      regulate: { x: 151, y: 410, w: 94, h: 90 },
      contain: { x: 249, y: 410, w: 94, h: 90 },
      shutdown: { x: 347, y: 410, w: 94, h: 90 },
      race: { x: 200, y: 0, w: 384, h: 80 },      // placed below the chips on show (layoutBand)
    },
    lines: {
      gate: { title: ['The gate'], sub: ["If it can't be tested first or undone", 'after, the burden of proof is on', 'whoever proceeds'] },
      'containment-if-aligned': { title: ['Is containment', 'solvable?'], sub: ['Can we keep it boxed?'] },
      'containment-if-not': { title: ['Is containment', 'solvable?'], sub: ['Can we keep it boxed?'] },
      proceed: { sub: ['trust: yes', 'cage: yes'] },
      regulate: { title: ['Regulate', 'use'], sub: ['trust: yes', 'cage: no'] },
      contain: { sub: ['trust: no', 'cage: yes'] },
      shutdown: { title: ['Shut', 'down'], sub: ['trust: no', 'cage: no'] },
      race: { title: ['Underneath every branch: the race'],
              sub: ['No villains needed: each lab thinks', "it's the careful one, so it must lead."] },
    },
    chip: { w: 94, h: 31, gap: 6, rowGap: 7, cols: 1, top: 467 },
    outside: { x: 200, y: 0, w: 384, h: 50, labelDx: -178, labelDy: 4.5, chipsTop: 0, cols: 1, row: true },
    legend: { x: 10, y: 0, font: 12.5, pill: 24, rowH: 21 },     // placed under the race (layoutBand)
  },
};

const CSS = (() => {
  const dark = '--bt-node:#121a29;--bt-line:#2e3a55;--bt-dim:#a7b0bf;--bt-faint:#7f889a;--bt-ink:#f3ede2;' +
    '--bt-coral:#ff8a6b;--bt-coral-soft:rgba(255,138,107,.17);--bt-coral-ink:#ffc4b1;--bt-chip:#1b2438;' +
    '--bt-chip-line:#3d4b6b;--bt-bg-label:#0a0e16;--bt-focus:#cfe2ff;';
  const light = '--bt-node:#f6f3ec;--bt-line:#cbc3b3;--bt-dim:#4f5663;--bt-faint:#5f6572;--bt-ink:#1d1b18;' +
    '--bt-coral:#d4553a;--bt-coral-soft:rgba(212,85,58,.13);--bt-coral-ink:#9c3a1f;--bt-chip:#ffffff;' +
    '--bt-chip-line:#c4bba9;--bt-bg-label:#fbfaf6;--bt-focus:#1f5fbf;';
  return `
.bt-svg{${dark}display:block;width:100%;height:auto;overflow:visible;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-user-select:none;user-select:none}
.bt-svg[data-bt-theme="light"]{${light}}
@media (prefers-color-scheme: light){.bt-svg[data-bt-theme="auto"]{${light}}}
.bt-svg text{pointer-events:none}
.bt-node{cursor:pointer;outline:none}
.bt-node .box{fill:var(--bt-node);stroke:var(--bt-line);stroke-width:1.5;transition:fill .45s ease,stroke .45s ease,stroke-width .45s ease}
.bt-node .t{fill:var(--bt-dim);font-weight:650;transition:fill .45s ease}
.bt-node .s{fill:var(--bt-faint);transition:fill .45s ease}
.bt-node.is-lit .box{fill:var(--bt-coral-soft);stroke:var(--bt-coral);stroke-width:2.5}
.bt-node.is-lit .t{fill:var(--bt-ink)}
.bt-node.is-lit .s{fill:var(--bt-coral-ink)}
.bt-node.is-open .box{stroke-dasharray:7 5}
.bt-race .box{stroke-dasharray:8 6;fill:transparent}
.bt-race.is-lit .box{fill:var(--bt-coral-soft)}
.bt-node:focus-visible .box{stroke:var(--bt-focus);stroke-width:3;transition:none}
.bt-node .pulse{fill:none;stroke:var(--bt-coral);stroke-width:2;opacity:0}
.bt-node.pulse-now .pulse{animation:bt-pulse 1.1s ease-out 1}
@keyframes bt-pulse{0%{opacity:.85;stroke-width:2}100%{opacity:0;stroke-width:22}}
.bt-edge{fill:none;stroke:var(--bt-line);stroke-width:2;transition:stroke .45s ease,stroke-width .45s ease}
.bt-edge.is-lit{stroke:var(--bt-coral);stroke-width:3}
.bt-edge.is-open{stroke-dasharray:7 5}
.bt-elabel rect{fill:var(--bt-bg-label)}
.bt-elabel text{fill:var(--bt-faint);font-weight:600;transition:fill .45s ease}
.bt-elabel.is-lit text{fill:var(--bt-coral)}
.bt-chip{cursor:pointer;outline:none;opacity:0;transform:translateY(8px);pointer-events:none;
  transition:opacity .45s ease,transform .45s ease}
.bt-chip.is-shown{opacity:.72;transform:none;pointer-events:auto}
.bt-chip .hit{fill:transparent;stroke:none}
.bt-chip.is-ask .cbox{stroke-dasharray:5 3.5}
.bt-chip.is-shown.is-here{opacity:1}
.bt-chip .cbox{fill:var(--bt-chip);stroke:var(--bt-chip-line);stroke-width:1.2;transition:stroke .3s ease,stroke-width .3s ease}
.bt-chip .ct{fill:var(--bt-ink);font-weight:550}
.bt-chip:hover .cbox{stroke:var(--bt-dim)}
.bt-chip.is-focus{opacity:1}
.bt-chip.is-focus .cbox{stroke:var(--bt-coral);stroke-width:2.6}
.bt-chip:focus-visible .cbox{stroke:var(--bt-focus);stroke-width:3;transition:none}
.bt-dyn{transition:transform .45s ease}
.bt-zone{opacity:0;transition:opacity .45s ease}
.bt-zone.is-shown{opacity:1}
.bt-zone .zbox{fill:none;stroke:var(--bt-line);stroke-width:1.3;stroke-dasharray:4 5}
.bt-zone.is-lit .zbox{stroke:var(--bt-coral);stroke-width:2}
.bt-zone .zt{fill:var(--bt-faint);font-weight:650;letter-spacing:.08em}
.bt-legend{opacity:0;transition:opacity .45s ease}
.bt-legend.is-shown{opacity:1}
.bt-legend .lbox{fill:var(--bt-chip);stroke:var(--bt-chip-line);stroke-width:1.2}
.bt-legend .lbox.ask{stroke-dasharray:5 3.5}
.bt-legend text{fill:var(--bt-dim)}
.bt-cast .coin{fill:var(--bt-chip);stroke:var(--bt-coral);stroke-width:2}
.bt-cast .stalk{stroke:var(--bt-coral);stroke-width:3;stroke-linecap:round}
.bt-cast .ring{fill:none;stroke:var(--bt-coral)}
.bt-cast .res{fill:var(--bt-coral);font-weight:700}
.bt-cast .q{fill:var(--bt-dim);font-weight:600}
.bt-cut,.bt-cut *{transition:none!important;animation:none!important}
`;
})();

let uid = 0;
function S(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* a centred block of title + sub lines at (cx, cy) */
function textBlock(g, cx, cy, titleLines, subLines, tf, sf, anchor = 'middle') {
  const tlh = tf * 1.16, slh = sf * 1.3, gap = subLines.length ? sf * 0.35 : 0;
  const total = titleLines.length * tlh + gap + subLines.length * slh;
  let y = cy - total / 2;
  for (const line of titleLines) {
    const t = S('text', { class: 't', x: cx, y: y + tf * 0.86, 'text-anchor': anchor, 'font-size': tf }, g);
    t.textContent = line; y += tlh;
  }
  y += gap;
  for (const line of subLines) {
    const t = S('text', { class: 's', x: cx, y: y + sf * 0.9, 'text-anchor': anchor, 'font-size': sf }, g);
    t.textContent = line; y += slh;
  }
}

function leafOfPerson(p) {
  const l = p && p.stated_leaf;
  return LEAVES.includes(l) ? l : (l ? 'outside' : null);
}

function build(el, L) {
  const id = 'bt' + (++uid);
  el.textContent = '';
  const svg = S('svg', {
    class: 'bt-svg', viewBox: `0 0 ${L.w} ${L.h}`, role: 'group',
    'aria-labelledby': id + '-t', 'aria-describedby': id + '-d', 'data-bt-theme': 'dark',
  });
  const title = S('title', { id: id + '-t' }, svg);
  title.textContent = 'The belief tree';
  const desc = S('desc', { id: id + '-d' }, svg);
  desc.textContent = 'A decision tree. The gate (if it cannot be tested first or undone after, the burden of proof is on ' +
    'whoever proceeds) leads to "Is alignment solvable?" (can we trust it). Yes and no each lead to "Is containment ' +
    'solvable?" (can we cage it). Trust yes and cage yes: Proceed. Trust yes, cage no: Regulate use. Trust no, cage yes: ' +
    'Contain. Trust no, cage no: Shut down. Underneath every branch: the race.';
  S('style', null, svg).textContent = CSS;

  const gEdges = S('g', { class: 'bt-edges' }, svg);
  const gLabels = S('g', { class: 'bt-elabels' }, svg);
  const gNodes = S('g', { class: 'bt-nodes' }, svg);
  const gZone = S('g', { class: 'bt-zone bt-dyn', 'data-node': 'outside' }, svg);
  const gChips = S('g', { class: 'bt-chips' }, svg);
  const gChipsOut = S('g', { class: 'bt-chips-outside bt-dyn' }, svg);
  const gCast = S('g', { class: 'bt-cast' }, svg);
  const gLegend = S('g', { class: 'bt-legend' + (L.dynamic ? ' bt-dyn' : ''), 'aria-hidden': 'true' }, svg);
  {
    const k = L.legend;
    [['', 'own two answers lead here'], ['ask', 'placed by what they ask for']].forEach(([cls, words], i) => {
      const y = k.y + i * k.rowH;
      S('rect', { class: 'lbox' + (cls ? ' ' + cls : ''), x: k.x, y: y - 7, width: k.pill, height: 14, rx: 7 }, gLegend);
      const t = S('text', { x: k.x + k.pill + 7, y: y + k.font * 0.36, 'font-size': k.font }, gLegend);
      t.textContent = words;
    });
  }

  const nodeEls = {}, edgeEls = [], labelEls = [];
  for (const n of NODES) {
    const b = L.nodes[n.id];
    // edge from the parent
    if (n.parent) {
      const p = L.nodes[n.parent];
      const x1 = p.x, y1 = p.y + p.h / 2, x2 = b.x, y2 = b.y - b.h / 2, my = (y1 + y2) / 2;
      const path = S('path', { class: 'bt-edge', d: `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`,
        'data-to': n.id }, gEdges);
      edgeEls.push(path);
      if (n.via) {
        const lx = x1 + (x2 - x1) * 0.5, ly = my;
        const lg = S('g', { class: 'bt-elabel', 'data-to': n.id, 'data-via': n.via, 'data-lx': lx }, gLabels);
        const fw = L.font.edge;
        S('rect', { x: lx - fw * 1.3, y: ly - fw * 0.8, width: fw * 2.6, height: fw * 1.6, rx: fw * 0.5 }, lg);
        const t = S('text', { x: lx, y: ly + fw * 0.36, 'text-anchor': 'middle', 'font-size': fw }, lg);
        t.textContent = n.via;
        labelEls.push(lg);
      }
    }
    const g = S('g', { class: 'bt-node' + (n.id === 'race' ? ' bt-race' : ''), 'data-node': n.id,
      role: 'button', tabindex: '0', 'aria-label': n.title + (n.sub ? (/[?.!:]$/.test(n.title) ? ' ' : '. ') + n.sub : '') }, gNodes);
    const r = Math.min(14, b.h / 3);
    S('rect', { class: 'pulse', x: b.x - b.w / 2, y: b.y - b.h / 2, width: b.w, height: b.h, rx: r }, g);
    S('rect', { class: 'box', x: b.x - b.w / 2, y: b.y - b.h / 2, width: b.w, height: b.h, rx: r }, g);
    const lines = L.lines[n.id] || {};
    const tf = n.leaf ? L.font.leafTitle : L.font.title;
    textBlock(g, b.x, b.y, lines.title || [n.title], lines.sub || (n.sub ? [n.sub] : []), tf,
      n.id === 'race' ? L.font.sub - 0.5 : (n.leaf ? L.font.leafSub : L.font.sub));
    nodeEls[n.id] = g;
    if (n.id === 'race') g.classList.add('bt-dyn');
  }

  // "outside the tree" zone
  const o = L.outside;
  S('rect', { class: 'zbox', x: o.x - o.w / 2, y: o.y - o.h / 2, width: o.w, height: o.h, rx: 12 }, gZone);
  const zt = S('text', { class: 'zt', x: o.x + o.labelDx, y: o.y + o.labelDy, 'font-size': L.font.zone,
    'text-anchor': o.row ? 'start' : 'middle' }, gZone);
  zt.textContent = 'OUTSIDE THE TREE';

  const st = { svg, L, nodeEls, edgeEls, labelEls, gChips, gChipsOut, gZone, gCast, gLegend, chipEls: {}, peopleKey: null,
    prevLit: new Set(), castKey: null, castTimer: 0, layoutName: null };

  svg.addEventListener('click', e => {
    const chip = e.target.closest('.bt-chip');
    if (chip) { el.dispatchEvent(new CustomEvent('belieftree:select', { detail: { person: chip.dataset.person }, bubbles: true })); return; }
    const node = e.target.closest('.bt-node');
    if (node) el.dispatchEvent(new CustomEvent('belieftree:select', { detail: { node: node.dataset.node }, bubbles: true }));
  });
  svg.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('.bt-chip, .bt-node');
    if (!t) return;
    e.preventDefault();
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  el.appendChild(svg);
  return st;
}

/* chips: one per person, placed under their leaf (or in the outside zone) */
const PLACED_WORDS = { answers: 'placed by their own two answers', ask: 'placed by what they ask for',
  plan: "placed by their organisation's plan", frame: "does not take up the tree's questions" };
function placeChips(st, people) {
  const { L, gChips, gChipsOut } = st;
  gChips.textContent = '';
  gChipsOut.textContent = '';
  st.chipEls = {};
  const groups = {};
  for (const p of people) {
    const leaf = leafOfPerson(p);
    if (!leaf) continue;
    (groups[leaf] = groups[leaf] || []).push(p);
  }
  const c = L.chip;
  for (const leaf in groups) {
    const list = groups[leaf];
    let cols, cx0, top, rowMode = false;
    if (leaf === 'outside') {
      const o = L.outside; cols = o.cols;
      if (o.row) { rowMode = true; cx0 = o.x - o.w / 2 + 150; top = o.y - c.h / 2; }
      else { cx0 = o.x; top = o.y - o.h / 2 + o.chipsTop - 20; }
    } else { cols = c.cols; cx0 = L.nodes[leaf].x; top = c.top; }
    list.forEach((p, i) => {
      let x, y;
      if (rowMode) { x = cx0 + i * (c.w + c.gap); y = top; }
      else {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, list.length - row * cols);
        const rowW = inRow * c.w + (inRow - 1) * c.gap;
        x = cx0 - rowW / 2 + col * (c.w + c.gap);
        y = top + row * (c.h + c.rowGap);
      }
      const ask = isAsk(p);
      const how = [PLACED_WORDS[p.placed_by], p.confidence === 'low' ? 'low confidence' : null].filter(Boolean).join(', ');
      const label = `${p.name}: ${LEAF_LABEL[leaf]}${p.scope ? ' (' + p.scope + ')' : ''}.${how ? ' ' + how + '.' : ''} Open the card.`;
      const g = S('g', { class: 'bt-chip' + (ask ? ' is-ask' : ''), 'data-person': p.slug, 'data-leaf': leaf,
        role: 'button', tabindex: '-1', 'aria-label': label }, leaf === 'outside' ? gChipsOut : gChips);
      const pad = Math.min(c.rowGap, c.gap) / 2;
      S('rect', { class: 'hit', x: x - pad, y: y - pad, width: c.w + 2 * pad, height: c.h + 2 * pad }, g);
      S('rect', { class: 'cbox', x, y, width: c.w, height: c.h, rx: c.h / 2 }, g);
      const t = S('text', { class: 'ct', x: x + c.w / 2, y: y + c.h / 2 + L.font.chip * 0.35, 'text-anchor': 'middle',
        'font-size': L.font.chip }, g);
      t.textContent = p.short || p.name.split(' ').slice(-1)[0];
      st.chipEls[p.slug] = g;
      g.dataset.row = String(rowMode ? 0 : Math.floor(i / cols));
    });
  }
}

/* a chip is dashed when the person is placed by what they ask for (or their organisation's plan) */
const isAsk = p => p.placed_by === 'ask' || p.placed_by === 'plan';
/* the edge label for a person's own answer that is not a plain yes or no */
const EDGE_WORD = { conditional: 'depends', unclear: 'not known', unknown: 'not known', 'not-addressed': 'not addressed' };

/* what glows, what is open, which chips show, from the state */
function computeView(state, people) {
  const step = state.step == null ? null : Math.max(1, Math.min(8, Math.round(Number(state.step)) || 1));
  const focusP = state.focus ? people.find(p => p.slug === state.focus) : null;
  let lit, open = new Set(state.open || []);
  const edgeOpen = new Set(), edgeWord = {};
  if (Array.isArray(state.lit)) lit = new Set(state.lit);
  else if (step) {
    lit = new Set(STEP_LIT[step]);
    if (step === 8 && focusP) {
      // their path through the tree; a node where their own answer is not a plain yes or no is drawn open
      const leaf = leafOfPerson(focusP);
      if (LEAVES.includes(leaf)) {
        const plain = a => a === 'yes' || a === 'no';
        const cNode = leaf === 'proceed' || leaf === 'regulate' ? 'containment-if-aligned' : 'containment-if-not';
        ['gate', 'alignment', cNode, leaf].forEach(n => lit.add(n));
        if (!plain(focusP.gate && focusP.gate.answer)) open.add('gate');
        const aA = focusP.alignment && focusP.alignment.answer, cA = focusP.containment && focusP.containment.answer;
        // the yes/no on an edge is the branch's answer; where theirs is not a plain yes or no, the edge is
        // drawn open and its label says their answer, so the path does not credit them with a yes they did not give
        if (!plain(aA)) { open.add('alignment'); edgeOpen.add(cNode); edgeWord[cNode] = EDGE_WORD[aA] || 'not known'; }
        if (!plain(cA)) { open.add(cNode); edgeOpen.add(leaf); edgeWord[leaf] = EDGE_WORD[cA] || 'not known'; }
      }
    }
  } else {
    lit = new Set();
    const a = state.answers || {};
    if (a.gate != null) { lit.add('gate'); if (a.gate === 'unknown') open.add('gate'); }
    if (a.alignment != null) {
      lit.add('alignment');
      if (a.alignment === 'yes') lit.add('containment-if-aligned');
      else if (a.alignment === 'no') lit.add('containment-if-not');
      else { open.add('alignment'); open.add('containment-if-aligned'); open.add('containment-if-not'); }
    }
    const leaf = leafFor(a);
    if (leaf) lit.add(leaf);
    else if (a.containment === 'unknown') { open.add('containment-if-aligned'); open.add('containment-if-not'); }
    if (a.race != null) lit.add('race');
    if (focusP) lit.add(leafOfPerson(focusP));
  }
  // chips
  const shown = new Set(), here = new Set();
  const revealed = new Set();
  if (step) {
    const upto = Math.min(step, 7);
    for (let s = 1; s <= upto; s++) for (const n of STEP_LIT[s]) if (LEAVES.includes(n)) revealed.add(n);
    if (step === 8) { LEAVES.forEach(l => revealed.add(l)); revealed.add('outside'); }
  } else { LEAVES.forEach(l => revealed.add(l)); revealed.add('outside'); }
  const named = new Set(), namedHere = new Set();
  if (step) for (const s in STEP_NAMED) {
    if (Number(s) <= step) STEP_NAMED[s].forEach(n => { named.add(n); if (Number(s) === step) namedHere.add(n); });
  }
  for (const p of people) {
    const leaf = leafOfPerson(p);
    if (!revealed.has(leaf) && !named.has(p.slug) && !(focusP && focusP.slug === p.slug)) continue;
    shown.add(p.slug);
    if (step === 8 || !step || namedHere.has(p.slug) || (lit.has(leaf) && step !== 6)) here.add(p.slug);
  }
  const legend = [...shown].some(slug => { const p = people.find(q => q.slug === slug); return p && isAsk(p); });
  return { step, lit, open, shown, here, focus: focusP ? focusP.slug : null, people, edgeOpen, edgeWord, legend,
    zoneShown: revealed.has('outside') && people.some(p => leafOfPerson(p) === 'outside') };
}

function apply(st, view, animate) {
  const { svg, nodeEls, edgeEls, labelEls, chipEls, gZone } = st;
  const newlyLit = [];
  for (const id in nodeEls) {
    const on = view.lit.has(id);
    if (on && !st.prevLit.has(id)) newlyLit.push(id);
    nodeEls[id].classList.toggle('is-lit', on);
    nodeEls[id].classList.toggle('is-open', view.open.has(id));
    if (on) nodeEls[id].setAttribute('aria-current', 'true'); else nodeEls[id].removeAttribute('aria-current');
  }
  // the edge into a lit node glows with it, so the answer that leads there reads at a glance
  const edgeOn = to => view.lit.has(to);
  edgeEls.forEach(e => {
    e.classList.toggle('is-lit', edgeOn(e.dataset.to));
    e.classList.toggle('is-open', view.edgeOpen.has(e.dataset.to));
  });
  labelEls.forEach(e => {
    e.classList.toggle('is-lit', edgeOn(e.dataset.to));
    const word = view.edgeWord[e.dataset.to] || e.dataset.via;
    const t = e.querySelector('text');
    if (t.textContent !== word) {
      t.textContent = word;
      const fw = st.L.font.edge, lx = Number(e.dataset.lx);
      const w = Math.max(fw * 2.6, word.length * fw * 0.58 + fw * 1.1);
      const r = e.querySelector('rect');
      r.setAttribute('x', lx - w / 2); r.setAttribute('width', w);
    }
  });
  st.legendPrev = st.gLegend.classList.contains('is-shown');
  st.gLegend.classList.toggle('is-shown', !!view.legend && st.legendOn);
  gZone.classList.toggle('is-shown', view.zoneShown);
  gZone.classList.toggle('is-lit', !!view.focus && chipEls[view.focus] && chipEls[view.focus].dataset.leaf === 'outside');
  let k = 0;
  for (const slug in chipEls) {
    const g = chipEls[slug];
    const was = g.classList.contains('is-shown'), on = view.shown.has(slug);
    g.style.transitionDelay = animate && on && !was ? (60 * k++) + 'ms' : '0ms';
    g.classList.toggle('is-shown', on);
    g.classList.toggle('is-here', view.here.has(slug));
    g.classList.toggle('is-focus', view.focus === slug);
    g.setAttribute('tabindex', on ? '0' : '-1');
    g.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  if (animate) {
    newlyLit.forEach(id => {
      const g = nodeEls[id];
      g.classList.remove('pulse-now'); void g.getBoundingClientRect(); g.classList.add('pulse-now');
      setTimeout(() => g.classList.remove('pulse-now'), 1200);
    });
  }
  st.prevLit = new Set(view.lit);
  if (st.L.dynamic) layoutBand(st, view);
}

/* narrow layout: the chip band is as tall as the chips on show; the outside zone and the race sit below it */
function layoutBand(st, view) {
  const { L, svg, nodeEls, gZone, gChipsOut } = st, c = L.chip;
  // chips keep their slot, so the band reaches the lowest slot on show
  let maxRows = 0;
  for (const slug of view.shown) {
    const g = st.chipEls[slug];
    if (g && g.dataset.leaf !== 'outside') maxRows = Math.max(maxRows, Number(g.dataset.row) + 1);
  }
  const leafBottom = L.nodes.proceed.y + L.nodes.proceed.h / 2;
  let y = maxRows ? c.top + maxRows * (c.h + c.rowGap) - c.rowGap + 18 : leafBottom + 22;
  if (view.zoneShown) {
    const zy = y + L.outside.h / 2;
    gZone.style.transform = gChipsOut.style.transform = `translateY(${zy}px)`;
    y = zy + L.outside.h / 2 + 18;
  }
  nodeEls.race.style.transform = `translateY(${y + L.nodes.race.h / 2}px)`;
  let bottom = y + L.nodes.race.h + 8;
  if (view.legend && st.legendOn) {
    const ly = bottom + 12, gl = st.gLegend;
    if (!st.legendPrev) {   // appearing: put it in place first, then fade it in (no slide across the tree)
      gl.style.transition = 'opacity .45s ease';
      gl.style.transform = `translateY(${ly}px)`;
      void gl.getBoundingClientRect();
      requestAnimationFrame(() => { gl.style.transition = ''; });
    } else gl.style.transform = `translateY(${ly}px)`;
    bottom = ly + L.legend.rowH + 14;
  }
  svg.setAttribute('viewBox', `0 0 ${L.w} ${Math.ceil(bottom)}`);
}

/* ---------------- casting ---------------- */
function cast(el, st, casting, animate) {
  const key = casting ? JSON.stringify(casting) : null;
  if (key === st.castKey) return;
  st.castKey = key;
  clearTimeout(st.castTimer);
  if (st.castRaf) cancelAnimationFrame(st.castRaf);
  const g = st.gCast;
  g.textContent = '';
  if (!casting || !st.L.nodes[casting.node]) return;
  const b = st.L.nodes[casting.node], L = st.L;
  const narrow = L.w < 600;
  // the cast sits just right of the node (left of it for nodes on the right edge)
  const side = b.x > L.w * 0.7 ? -1 : 1;
  const cx = b.x + side * (b.w / 2 + (narrow ? 16 : 26)), cy = b.y;
  const fs = narrow ? 12 : 15;
  const label = { yes: 'yes', no: 'no', unknown: 'not known' }[casting.result] || String(casting.result || '');
  const done = () => {
    const t = S('text', { class: casting.result === 'unknown' ? 'q' : 'res', x: cx, y: cy + (narrow ? 26 : 34),
      'text-anchor': 'middle', 'font-size': fs }, g);
    t.textContent = label;
    el.dispatchEvent(new CustomEvent('belieftree:castend', { detail: { node: casting.node, method: casting.method,
      result: casting.result }, bubbles: true }));
  };
  const instant = !animate || reducedMotion();
  const r = narrow ? 11 : 16;
  if (casting.method === 'coin') {
    const coin = S('ellipse', { class: 'coin', cx, cy, rx: r, ry: r }, g);
    if (instant) return done();
    const t0 = performance.now(), dur = 1300;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const turns = 5 * (1 - Math.pow(1 - p, 2));
      coin.setAttribute('rx', Math.max(1, Math.abs(Math.cos(turns * Math.PI)) * r));
      coin.setAttribute('cy', cy - Math.sin(p * Math.PI) * r * 1.4);
      if (p < 1) st.castRaf = requestAnimationFrame(tick); else { coin.setAttribute('rx', r); done(); }
    };
    st.castRaf = requestAnimationFrame(tick);
  } else if (casting.method === 'yarrow') {
    const n = 6, w = narrow ? 18 : 26, gap = narrow ? 4 : 5.5, top = cy + ((n - 1) * gap) / 2;
    const stalks = [];
    for (let i = 0; i < n; i++) {
      const y = top - i * gap;
      stalks.push(S('line', { class: 'stalk', x1: cx - w / 2, x2: cx + w / 2, y1: y, y2: y, opacity: instant ? 1 : 0 }, g));
    }
    if (instant) return done();
    stalks.forEach((s, i) => { st.castTimer = setTimeout(() => s.setAttribute('opacity', 1), 190 * (i + 1)); });
    st.castTimer = setTimeout(done, 190 * n + 250);
  } else if (casting.method === 'decide') {
    const ring = S('circle', { class: 'ring', cx, cy, r: r * 0.6, 'stroke-width': 3 }, g);
    S('circle', { class: 'coin', cx, cy, r: r * 0.45 }, g);
    if (instant) return done();
    const t0 = performance.now(), dur = 650;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      ring.setAttribute('r', r * (0.6 + p * 1.2)); ring.setAttribute('opacity', 1 - p);
      if (p < 1) st.castRaf = requestAnimationFrame(tick); else done();
    };
    st.castRaf = requestAnimationFrame(tick);
  } else {
    const q = S('text', { class: 'q', x: cx, y: cy + fs * 0.5, 'text-anchor': 'middle', 'font-size': fs * 1.8,
      opacity: instant ? 1 : 0 }, g);
    q.textContent = '?';
    if (instant) return done();
    let o = 0;
    const tick = () => { o = Math.min(1, o + 0.06); q.setAttribute('opacity', o); if (o < 1) st.castRaf = requestAnimationFrame(tick); else done(); };
    st.castRaf = requestAnimationFrame(tick);
  }
}

/* where node `id` will sit once the current change settles (the race moves by a CSS transition in the
   narrow layout; this reads its target, not its position mid-move), in viewport pixels */
export function nodeRect(el, id) {
  const st = el && el.__beliefTree;
  if (!st || !st.L.nodes[id]) return null;
  const b = st.L.nodes[id], vb = st.svg.viewBox.baseVal, r = st.svg.getBoundingClientRect();
  if (!vb || !vb.width || !r.width) return null;
  const m = /translateY\((-?[\d.]+)px\)/.exec(st.nodeEls[id].style.transform || '');
  const dy = m ? Number(m[1]) : 0, s = r.width / vb.width;
  const top = r.top + (b.y - b.h / 2 + dy - vb.y) * s;
  const left = r.left + (b.x - b.w / 2 - vb.x) * s;
  return { top, bottom: top + b.h * s, left, right: left + b.w * s };
}

/* ---------------- entry point ---------------- */
export function renderTree(el, state = {}, opts = {}) {
  const o = Object.assign({ animate: true, layout: 'auto' }, opts);
  const width = el.clientWidth || (el.getBoundingClientRect && el.getBoundingClientRect().width) || 1000;
  const layoutName = o.layout === 'wide' || o.layout === 'narrow' ? o.layout : (width < 560 ? 'narrow' : 'wide');
  let st = el.__beliefTree;
  const people = Array.isArray(state.people) ? state.people : (cachedPeople || []);
  let fresh = false;
  if (!st || st.layoutName !== layoutName || !el.contains(st.svg)) {
    st = build(el, LAYOUTS[layoutName]);
    st.layoutName = layoutName;
    el.__beliefTree = st;
    fresh = true;
  }
  const peopleKey = people.map(p => p.slug + ':' + p.stated_leaf).join('|');
  if (peopleKey !== st.peopleKey) { placeChips(st, people); st.peopleKey = peopleKey; }
  st.svg.setAttribute('data-bt-theme', state.theme === 'light' || state.theme === 'dark' ? state.theme : 'auto');
  st.legendOn = o.legend !== false;
  const animate = o.animate !== false && !fresh && !reducedMotion();
  if (!animate) st.svg.classList.add('bt-cut');
  apply(st, computeView(state, people), animate);
  if (!animate) {
    void st.svg.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => st.svg.classList.remove('bt-cut')));
  }
  cast(el, st, state.casting || null, o.animate !== false);
  // re-render on a layout change (auto layout only)
  if (o.layout === 'auto' && typeof ResizeObserver === 'function' && !el.__beliefTreeRO) {
    el.__beliefTreeRO = new ResizeObserver(() => {
      const cur = el.__beliefTree;
      const w = el.clientWidth;
      if (!cur || !w) return;
      const want = w < 560 ? 'narrow' : 'wide';
      if (want !== cur.layoutName && el.__beliefTreeLast) {
        const [s, op] = el.__beliefTreeLast;
        renderTree(el, s, Object.assign({}, op, { animate: false }));
      }
    });
    el.__beliefTreeRO.observe(el);
  }
  el.__beliefTreeLast = [state, o];
  return st.svg;
}
