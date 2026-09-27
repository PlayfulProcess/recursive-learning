// game/shared/matrix-board.js — The Tree drawn as a table, not a repeated diagram. GAME-OWNED: never
// imports anything but the three named exports of explainers/belief-tree/tree-render.js (leafFor,
// LEAF_LABEL, ANSWER_WORD) so the grid's mapping can never drift from the Film's own tree, and never
// touches that file, people.json, or explainers/belief-tree/index.html.
//
// This module draws; it holds no game rules and no state of its own. game/tree-board/tree-board.js
// calls renderBoard(el, view) on every render with a plain view object (see the shape below) and
// wires clicks by querying the DOM this function just built (the same pattern
// explainers/belief-tree/tree-render.js uses for the tree's own click handling, minus the custom
// events — this module is small enough not to need its own event bus).
//
// Crossing/casting to MOVE a character (gate -> alignment -> containment -> a leaf) still happens
// through the existing action buttons in tree-board.js; this module only ever visualises `people`'s
// current positions, so the same board-engine.js rules and game/fork/fork-engine.js cast odds decide
// everything it draws.

import { leafFor, LEAF_LABEL, ANSWER_WORD } from '../../explainers/belief-tree/tree-render.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Every inline SVG here carries explicit width/height (never left to the ~300×150 default a bare
// <svg> renders at) — CSS still overrides the size wherever one is reused in a different context.
const SVG_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 12.5l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SVG_CROSS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>';
const SVG_MID = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8Z" fill="currentColor" stroke="none"/></svg>';
const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>';

// answerMark(raw): the icon+word pair used everywhere a yes/no/depends value is shown. Never colour
// alone — the word is always printed next to the mark.
export function answerMark(raw) {
  if (raw === 'yes') return { cls: 'is-yes', svg: SVG_CHECK, word: ANSWER_WORD.yes };
  if (raw === 'no') return { cls: 'is-no', svg: SVG_CROSS, word: ANSWER_WORD.no };
  return { cls: 'is-mid', svg: SVG_MID, word: (raw == null ? 'not addressed' : (ANSWER_WORD[raw] || String(raw))) };
}

export function answerMarkHtml(raw, label) {
  const m = answerMark(raw);
  return `<span class="mb-answer ${m.cls}">${m.svg}<span>${label ? esc(label) + ': ' : ''}${esc(m.word)}</span></span>`;
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const CHIP_COLORS = ['#5b7fc0', '#3f7a5c', '#c0473b', '#8a5fb0', '#c8932f'];
export function chipColor(i) { return CHIP_COLORS[i % CHIP_COLORS.length]; }

// Node ids (board-engine.js / tree-render.js's NODES) that sit BEFORE a leaf: characters here have
// not yet answered both alignment and containment, so they have no cell yet and sit in the staging
// strip instead.
const PRE_LEAF = ['gate', 'alignment', 'containment-if-aligned', 'containment-if-not'];
const LEAVES = ['proceed', 'regulate', 'contain', 'shutdown'];

function chipHtml(person, opts) {
  const { active, colorIndex, dim } = opts || {};
  return `<button type="button" class="mb-chip${active ? ' is-active' : ''}" data-slug="${esc(person.slug)}"
      style="background:${dim ? 'var(--mb-chip)' : chipColor(colorIndex || 0)};${dim ? 'color:var(--mb-ink);' : 'color:#fff;'}"
      title="${esc(person.name)}" aria-label="${esc(person.name)}">${esc(initials(person.short || person.name))}</button>`;
}

// ── the gate bar ──────────────────────────────────────────────────────────────────────────────
function gateHtml(view) {
  const active = view.active;
  const raw = active ? active.resolved.gate != null ? active.resolved.gate : active.raw.gate : null;
  return `
    <div class="mb-gate">
      <span class="mb-gate-q">The gate</span>
      <span class="mb-gate-sub">${esc(view.gateSub)}</span>
      ${active ? answerMarkHtml(raw, active.short) : ''}
    </div>`;
}

// ── the 2×2 grid: columns = alignment (yes/no), rows = containment (yes/no) ─────────────────────
function cellFor(alignment, containment) { return leafFor({ alignment, containment }); }

function gridHtml(view) {
  const byPos = view.byPos; // Map: pos -> [{person, colorIndex}]
  const cell = (align, contain) => {
    const leaf = cellFor(align, contain);
    const list = byPos.get(leaf) || [];
    const chips = list.map(e => chipHtml(e.person, { active: e.person.slug === view.activeSlug, colorIndex: e.colorIndex })).join('');
    return `<div class="mb-cell" data-leaf="${leaf}">
        <div class="mb-cell-title">${esc(LEAF_LABEL[leaf])}</div>
        <div class="mb-cell-chips">${chips}</div>
      </div>`;
  };
  const flashCol = view.flashNode === 'alignment' ? ' is-flash' : '';
  const flashRowYes = view.flashNode === 'containment-if-aligned' ? ' is-flash' : '';
  const flashRowNo = view.flashNode === 'containment-if-not' ? ' is-flash' : '';
  const flashColYes = view.flashNode === 'alignment' && view.flashValue === 'yes' ? ' is-flash' : '';
  const flashColNo = view.flashNode === 'alignment' && view.flashValue === 'no' ? ' is-flash' : '';
  return `
    <div class="mb-grid">
      <div class="mb-corner"><span class="mb-q">${esc(view.alignQ)} / ${esc(view.containQ)}</span></div>
      <div class="mb-colhead${flashColYes}">${SVG_CHECK}<span class="mb-htitle">Alignment: yes</span></div>
      <div class="mb-colhead${flashColNo}">${SVG_CROSS}<span class="mb-htitle">Alignment: no</span></div>
      <div class="mb-rowhead${flashRowYes}">${SVG_CHECK}<span class="mb-htitle" style="writing-mode:horizontal-tb;transform:none">Containment: yes</span></div>
      ${cell('yes', 'yes')}
      ${cell('no', 'yes')}
      <div class="mb-rowhead${flashRowNo}">${SVG_CROSS}<span class="mb-htitle" style="writing-mode:horizontal-tb;transform:none">Containment: no</span></div>
      ${cell('yes', 'no')}
      ${cell('no', 'no')}
    </div>`;
}

// ── the staging strip: not-yet-leafed characters ────────────────────────────────────────────────
function stagingHtml(view) {
  const list = [];
  for (const node of PRE_LEAF) {
    for (const e of (view.byPos.get(node) || [])) list.push(e);
  }
  if (!list.length) return '';
  const chips = list.map(e => chipHtml(e.person, { active: e.person.slug === view.activeSlug, colorIndex: e.colorIndex, dim: true })).join('');
  return `<div class="mb-staging"><span class="mb-staging-label">Still crossing:</span>${chips}</div>`;
}

// ── trails: a faint dotted history per person, with an arrow to "now" ───────────────────────────
function trailHtml(person, points) {
  if (!points || points.length < 1) return '';
  const dots = points.map((p, i) => {
    const isNow = i === points.length - 1;
    const cls = p.game_move ? ' is-game' : '';
    return `${i > 0 ? '<span class="mb-trail-arrow">&rarr;</span>' : ''}` +
      `<button type="button" class="mb-dot${cls}" data-slug="${esc(person.slug)}" data-idx="${i}"
        aria-label="${esc(person.name)}, ${esc(p.date || '')}${isNow ? ' (now)' : ''}" title="${esc(p.date || '')}"></button>`;
  }).join('');
  return `<div class="mb-trail"><span class="mb-trail-who">${esc(person.short || person.name)}</span>${dots}</div>`;
}

function trailsHtml(view) {
  if (!view.showTrails || !view.trailPeople || !view.trailPeople.length) return '';
  const rows = view.trailPeople.map(({ person, points }) => trailHtml(person, points)).join('');
  return `<div class="mb-trails">${rows}</div>`;
}

function outsideHtml(view) {
  if (!view.outside || !view.outside.length) return '';
  const rows = view.outside.map(p => `<div class="mb-outside-person"><b>${esc(p.name)}</b><span>${esc(p.role || '')}</span></div>`).join('');
  return `<div class="mb-outside"><div class="mb-outside-title">Outside the tree</div>${rows}</div>`;
}

function raceHtml(view) {
  let pips = '';
  for (let i = 0; i < view.raceLimit; i++) pips += `<span class="pip${i < view.race ? ' is-filled' : ''}"></span>`;
  return `<div class="mb-race" aria-hidden="true">${pips}</div>`;
}

// ── the dot-detail popover (a dated quote/note + source link) ───────────────────────────────────
function dotDetailHtml(view) {
  const d = view.openDot;
  if (!d) return '';
  const pos = d.anchor || {};
  const style = `left:${pos.left || 0}px;top:${pos.top || 0}px;`;
  return `<div class="mb-dot-detail" style="${style}" role="dialog" aria-label="History">
      <button type="button" class="mb-dd-close" data-dot-close>${SVG_CLOSE}</button>
      <div class="mb-dd-date">${esc(d.date || '')}${d.now ? ' &middot; now' : ''}</div>
      ${d.quoteText ? `<blockquote>&ldquo;${esc(d.quoteText)}&rdquo;</blockquote>` : `<p>${esc(d.note || '')}</p>`}
      ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.sourceLabel || 'Source')}</a>` : (d.sourceLabel ? `<p>${esc(d.sourceLabel)}</p>` : '')}
    </div>`;
}

// ── main entry point ─────────────────────────────────────────────────────────────────────────────
// view: {
//   theme: 'auto'|'light'|'dark',
//   gateSub, alignQ, containQ: header strings,
//   active: the active character (or null on a static render), activeSlug,
//   byPos: Map<positionId, [{person, colorIndex}]>  — person here is the board-engine character,
//   showTrails, trailPeople: [{person, points}], openDot: {date, quoteText, note, url, sourceLabel, now, anchor} | null,
//   outside: [{name, role}],
//   race, raceLimit,
//   flashNode, flashValue: which header to flash after a just-made cross (or null),
// }
export function renderBoard(el, view) {
  el.innerHTML =
    `<div class="mb-board${view.compact ? ' is-compact' : ''}" data-mb-theme="${esc(view.theme || 'auto')}">` +
      gateHtml(view) +
      `<div class="mb-body">` +
        `<div class="mb-gridwrap"><div style="display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;gap:6px">` +
          gridHtml(view) +
          stagingHtml(view) +
          trailsHtml(view) +
        `</div></div>` +
        outsideHtml(view) +
      `</div>` +
      raceHtml(view) +
      dotDetailHtml(view) +
    `</div>`;
}

export { LEAVES, PRE_LEAF };
