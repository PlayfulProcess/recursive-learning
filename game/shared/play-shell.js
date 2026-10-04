// game/shared/play-shell.js — small, dependency-free helpers behind both games' new play screen:
// icon buttons (round, aria-label + tooltip, label shown on wide screens), overlay/drawer open+
// close with Escape and focus return, and the ps-active/ps-reduced-motion body toggles. No game
// rules live here — layout and a11y plumbing only. Icons are inline stroke-style SVG (site's own
// style: viewBox 0 0 24 24, stroke=currentColor, stroke-width 1.75, round caps), no emoji, no
// generated art.

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/>',
  rules: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4 1-1.4 2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>',
  log: '<path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5v-16Z" stroke-linejoin="round"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5v-16Z" stroke-linejoin="round"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/>',
  tokens: '<circle cx="9" cy="10" r="5.5"/><circle cx="15" cy="14" r="5.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.75 1.7 1l.4 2.5h4l.4-2.5c.6-.25 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>',
};

export function icon(name, size) {
  const s = size || 20;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// A round icon button. `label` shows as text on wide screens (per spec); `tip`/aria-label are
// always present so phones (icon + tooltip) and screen readers get the same information.
export function iconButton({ id, iconName, label, tip, onClick, disabled }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  if (id) b.id = id;
  b.setAttribute('aria-label', tip || label);
  b.setAttribute('data-tip', tip || label);
  b.innerHTML = `${icon(iconName)}<span class="icon-label">${label}</span>`;
  if (disabled) b.disabled = true;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// ── overlay / drawer plumbing: Escape closes the top-most open one, focus returns to the trigger.
const openStack = [];

export function openOverlay(overlayEl, triggerEl) {
  if (!overlayEl) return;
  overlayEl.hidden = false;
  openStack.push({ overlayEl, triggerEl: triggerEl || document.activeElement });
  const focusable = overlayEl.querySelector('[data-autofocus]') ||
    overlayEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (focusable || overlayEl).focus({ preventScroll: true });
}

export function closeOverlay(overlayEl) {
  if (!overlayEl || overlayEl.hidden) return;
  overlayEl.hidden = true;
  const i = openStack.findIndex(e => e.overlayEl === overlayEl);
  if (i >= 0) {
    const { triggerEl } = openStack[i];
    openStack.splice(i, 1);
    if (triggerEl && document.contains(triggerEl) && typeof triggerEl.focus === 'function') triggerEl.focus();
  }
}

export function closeAllOverlays() {
  while (openStack.length) closeOverlay(openStack[openStack.length - 1].overlayEl);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !openStack.length) return;
  e.preventDefault();
  closeOverlay(openStack[openStack.length - 1].overlayEl);
});

// Wires a trigger icon button to open an overlay, and every [data-ps-close] inside it to close it.
export function wireDrawer(triggerEl, overlayEl) {
  triggerEl.addEventListener('click', () => openOverlay(overlayEl, triggerEl));
  overlayEl.querySelectorAll('[data-ps-close]').forEach(b => b.addEventListener('click', () => closeOverlay(overlayEl)));
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) closeOverlay(overlayEl); });
}

// ── play-mode toggle: the site header/footer hide, the page becomes a fixed 100dvh shell.
export function enterPlayMode() {
  document.body.classList.add('ps-active');
  const shell = document.querySelector('main.wrap.play-shell');
  if (shell) shell.classList.add('ps-in-play');
}
export function exitPlayMode() {
  closeAllOverlays();
  document.body.classList.remove('ps-active');
  const shell = document.querySelector('main.wrap.play-shell');
  if (shell) shell.classList.remove('ps-in-play');
}

// A tiny "N of M filled pips" progress bar (used for the race track under the icon row).
export function renderProgress(el, filled, total) {
  if (!el) return;
  el.innerHTML = '';
  const n = Math.max(total, filled, 1);
  for (let i = 0; i < n; i++) {
    const span = document.createElement('i');
    if (i < filled) span.className = 'is-filled';
    el.appendChild(span);
  }
}

// A slim topbar: mark (site spiral) + back icon + game title. `backHref` is the games index.
export function mountTopbar(el, { title, backHref, markSrc }) {
  if (!el) return;
  el.innerHTML =
    `<a class="ps-back" href="${backHref}" aria-label="Back to games" data-tip="Back to games">${icon('back', 18)}</a>` +
    `<img class="ps-mark" src="${markSrc}" alt="" aria-hidden="true">` +
    `<span class="ps-title">${title}</span>`;
}

// ── fitting explainers/belief-tree/tree-render.js's SVG into a box of any shape, without scrolling ─
// tree-render.js's own CSS sizes the tree by WIDTH alone (100% wide, height following the tree's
// aspect ratio) — fine in a wide column, but a stage that's short and wide, or narrow and tall,
// needs the tree scaled to fit BOTH dimensions, and the renderer's 'narrow' layout (a taller,
// narrower arrangement of the same tree) picked when the box itself is taller than it is wide.

// 'narrow' when the box is taller than it is wide, else 'wide' — box aspect, not viewport width
// (the renderer's own 'auto' only ever looks at width, which is the wrong axis for a short stage).
export function treeLayoutFor(container) {
  if (!container) return 'wide';
  const r = container.getBoundingClientRect();
  if (!r.width || !r.height) return 'wide';
  return r.height > r.width * 1.05 ? 'narrow' : 'wide';
}

// Sizes the tree's <svg> (found inside `container`) with an explicit pixel width+height — never a
// CSS transform or object-fit, so explainers/belief-tree/tree-render.js's own nodeRect() (which The
// Tree's token badges read: `scale = svg.getBoundingClientRect().width / viewBox.width`) keeps
// reading the true rendered scale — chosen so the whole viewBox fits inside container's own box on
// both axes. Idempotent and cheap: safe to call after every render and on every resize.
export function fitTreeSvg(container) {
  if (!container) return;
  const svg = container.querySelector('svg');
  const vb = svg && svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;
  const availW = container.clientWidth, availH = container.clientHeight;
  // No room at all (a hidden ancestor, or a box squeezed past its own min-height): shrink the svg
  // to nothing rather than leaving a stale, larger size from the last successful fit — a gap reads
  // better than a tree that spills out of its box and overlaps whatever comes after it.
  if (!availW || !availH) { svg.style.width = '0px'; svg.style.height = '0px'; return; }
  const scale = Math.min(availW / vb.width, availH / vb.height);
  if (!isFinite(scale) || scale <= 0) { svg.style.width = '0px'; svg.style.height = '0px'; return; }
  svg.style.width = (vb.width * scale) + 'px';
  svg.style.height = (vb.height * scale) + 'px';
}

// Re-fits (and, if the box's own aspect flips wide/narrow, re-renders at the other layout) whenever
// `container` resizes — a window resize, or the flex shell giving the stage more or less room.
// `rerender()` should re-issue the same renderTree() call the page last made, at a given layout.
export function watchTreeBox(container, rerender) {
  if (!container || container.__psTreeWatched) return;
  container.__psTreeWatched = true;
  let raf = null;
  const run = () => {
    raf = null;
    const want = treeLayoutFor(container);
    if (want !== container.__psTreeLayout) { container.__psTreeLayout = want; rerender(want); }
    fitTreeSvg(container);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(container);
  window.addEventListener('resize', schedule);
}

export function setReducedMotion(on) {
  document.body.classList.toggle('ps-reduced-motion', !!on);
  try { localStorage.setItem('ps-reduced-motion', on ? '1' : '0'); } catch (e) { /* private mode: ignore */ }
}
export function getStoredReducedMotion() {
  try { return localStorage.getItem('ps-reduced-motion') === '1'; } catch (e) { return false; }
}
