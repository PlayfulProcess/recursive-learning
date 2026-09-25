// map.js: The map that lights up. Vanilla JS, two stacked canvases, no library.
// Base canvas: every dot (redrawn only on pan, zoom, filter or colour change).
// Overlay canvas: glow, lines, nodes, labels, focus ring.
const $ = (s, r = document) => r.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const DARKQ = matchMedia('(prefers-color-scheme: dark)');
const NYT = new Set(['pod_ezra', 'pod_ezra_klein']);
const SVG_PLAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const SVG_OUT = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';

let IX, SN = {}, NN, N = 0;
let X, Y, EP, PERSON, LANE;               // typed arrays per passage
let grid, GRID = 48;
let C = {};                                // resolved colours
const st = {
  mode: 'person', lit: [], litSet: new Set(), focus: -1, filter: null, ideasLit: [],
  z: 1, cx: 0.5, cy: 0.5, pulseStart: 0, raf: 0, view: 'none', qid: null, typed: null,
};
let search = null, modelState = 'none', modelPromise = null;    // none | loading | ready | failed
let W = 0, dpr = 1;
const base = $('#base'), over = $('#over'), stage = $('#stage');
const bctx = base.getContext('2d'), octx = over.getContext('2d');

// ------------------------------------------------------------------ helpers
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const ytUrl = (vid, s) => `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}&t=${Math.max(0, Math.floor(s))}s`;
const listNames = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const closeWord = s => s == null ? '' : s >= 0.65 ? 'close' : s >= 0.5 ? 'related' : 'further off';
const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };

function readColours() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  C = { bg: g('--panel'), ink: g('--ink'), muted: g('--muted'), grey: g('--dot-grey'), other: g('--dot-other'),
        glow: g('--glow'), glowSoft: g('--glow-soft'), focus: g('--focus') };
  for (let i = 0; i < 6; i++) C['s' + i] = g('--s' + i);
}
const slotColour = s => (s == null ? C.other : C['s' + s]);
const personColour = pi => slotColour(IX.people[pi].colour);

// ------------------------------------------------------------------ load
async function boot() {
  readColours();
  const [ix, sn, nn] = await Promise.all([
    fetch('data/index.json').then(r => r.json()),
    fetch('data/snippets.json').then(r => r.json()),
    fetch('data/nn.u16.bin').then(r => r.arrayBuffer()),
  ]);
  IX = ix; SN = sn; NN = new Uint16Array(nn);
  const P = IX.passages; N = P.ep.length;
  X = new Float32Array(N); Y = new Float32Array(N); EP = new Int16Array(N); PERSON = new Int16Array(N); LANE = new Int16Array(N);
  const laneIdx = Object.fromEntries(IX.lanes.map((l, i) => [l.id, i]));
  for (let i = 0; i < N; i++) {
    X[i] = P.x[i] / 10000; Y[i] = P.y[i] / 10000; EP[i] = P.ep[i];
    PERSON[i] = IX.episodes[P.ep[i]].people[0];
    LANE[i] = P.ideas[i].length ? laneIdx[IX.ideas[P.ideas[i][0]].lane] : -1;
  }
  grid = Array.from({ length: GRID * GRID }, () => []);
  for (let i = 0; i < N; i++) grid[cell(X[i], Y[i])].push(i);

  const nE = IX.episodes.length;
  $('#subtitle').textContent = `${nE} conversations about AI, cut into ${N.toLocaleString('en')} half-minute passages. Ask a question and the closest passages light up.`;
  const untagged = P.ideas.filter(a => !a.length).length;
  $('#tagshare').textContent = `About ${Math.round(100 * untagged / N)}% of passages match no idea word; they are grey in Idea mode.`;
  buildSuggest(); buildLegend(); buildSources(); setCaption();
  clampView(); sizeCanvas();
  new ResizeObserver(sizeCanvas).observe(stage);
  applyHash();
  addEventListener('hashchange', applyHash);
  over.setAttribute('aria-label', mapLabel());
}
const cell = (x, y) => Math.min(GRID - 1, Math.max(0, Math.floor(x * GRID))) + GRID * Math.min(GRID - 1, Math.max(0, Math.floor(y * GRID)));

// ------------------------------------------------------------------ view transform
const PAD = 14;
function sizeCanvas() {
  const r = stage.getBoundingClientRect();
  W = r.width; dpr = Math.min(2, devicePixelRatio || 1);
  for (const [c, ctx] of [[base, bctx], [over, octx]]) {
    c.width = Math.round(W * dpr); c.height = Math.round(W * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawBase(); drawOver();
}
const inner = () => W - 2 * PAD;
const sx = x => PAD + ((x - st.cx) * st.z + 0.5) * inner();
const sy = y => PAD + ((y - st.cy) * st.z + 0.5) * inner();
const dx = px => ((px - PAD) / inner() - 0.5) / st.z + st.cx;
const dy = py => ((py - PAD) / inner() - 0.5) / st.z + st.cy;
const dotR = () => Math.min(4.2, (N > 10000 ? 1.3 : 1.9) + 0.9 * Math.log2(st.z));

function clampView() {
  const h = 0.5 / st.z;
  st.cx = st.z <= 1 ? 0.5 : Math.min(1 - h + 0.05, Math.max(h - 0.05, st.cx));
  st.cy = st.z <= 1 ? 0.5 : Math.min(1 - h + 0.05, Math.max(h - 0.05, st.cy));
  over.style.touchAction = st.z > 1 ? 'none' : 'pan-y';
}
function zoomAt(f, px = W / 2, py = W / 2) {
  const x0 = dx(px), y0 = dy(py);
  st.z = Math.min(12, Math.max(1, st.z * f));
  st.cx = x0 - ((px - PAD) / inner() - 0.5) / st.z;
  st.cy = y0 - ((py - PAD) / inner() - 0.5) / st.z;
  clampView(); drawBase(); drawOver();
}

// ------------------------------------------------------------------ colour + filter
function passes(i) {
  const f = st.filter;
  if (!f) return true;
  if (f.type === 'person') return IX.episodes[EP[i]].people.includes(f.i);
  if (f.type === 'idea') return IX.passages.ideas[i].includes(f.i);
  if (f.type === 'lane') return LANE[i] === f.i;
  if (f.type === 'untagged') return LANE[i] < 0;
  if (f.type === 'otherlane') return LANE[i] >= 0 && IX.lanes[LANE[i]].colour == null;
  if (f.type === 'otherperson') return IX.people[PERSON[i]].colour == null;
  return true;
}
function colourOf(i) {
  if (st.mode === 'person') return personColour(PERSON[i]);
  if (st.mode === 'idea') return LANE[i] < 0 ? C.grey : slotColour(IX.lanes[LANE[i]].colour);
  return C.other;
}

function drawBase() {
  if (!IX) return;
  bctx.clearRect(0, 0, W, W);
  const r = dotR(), dim = st.lit.length > 0;
  const groups = new Map(), faded = [];
  for (let i = 0; i < N; i++) {
    const x = sx(X[i]), y = sy(Y[i]);
    if (x < -5 || y < -5 || x > W + 5 || y > W + 5) continue;
    if (!passes(i)) { faded.push(i); continue; }
    const c = colourOf(i);
    (groups.get(c) || groups.set(c, []).get(c)).push(i);
  }
  const paint = (ids, colour, alpha) => {
    bctx.globalAlpha = alpha; bctx.fillStyle = colour; bctx.beginPath();
    for (const i of ids) { const x = sx(X[i]), y = sy(Y[i]); bctx.moveTo(x + r, y); bctx.arc(x, y, r, 0, 6.2832); }
    bctx.fill();
  };
  if (faded.length) paint(faded, C.grey, 0.18);
  // grey (untagged) first so colour sits on top
  const order = [...groups.keys()].sort((a, b) => (a === C.grey ? -1 : b === C.grey ? 1 : 0));
  for (const c of order) paint(groups.get(c), c, dim ? 0.25 : (st.mode === 'plain' ? 0.55 : 0.85));
  bctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ overlay
function nodeXY(n) { return n && n.x != null ? [sx(n.x / 10000), sy(n.y / 10000)] : null; }
function label(ctx, text, x, y, opts = {}) {
  ctx.font = `${opts.weight || 700} ${opts.size || 14}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  ctx.textAlign = opts.align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.bg; ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.colour || C.ink; ctx.fillText(text, x, y);
}
// greedy label placement: try a few spots around the node, keep the first that overlaps nothing placed yet
let placed = [];
function place(text, x, y, opts = {}) {
  const size = opts.size || 14;
  octx.font = `${opts.weight || 700} ${size}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  const w = octx.measureText(text).width, h = size + 4, g = opts.gap ?? 12;
  const cands = opts.center ? [[x, y, 'center']] :
    [[x + g, y, 'left'], [x - g, y, 'right'], [x, y - h - 2, 'center'], [x, y + h + 2, 'center'],
     [x + g, y - h, 'left'], [x + g, y + h, 'left'], [x - g, y - h, 'right'], [x - g, y + h, 'right']];
  const box = ([cx, cy, al]) => [al === 'left' ? cx : al === 'right' ? cx - w : cx - w / 2, cy - h / 2, w, h];
  const free = b => b[0] >= 2 && b[1] >= 2 && b[0] + b[2] <= W - 2 && b[1] + b[3] <= W - 2 &&
    !placed.some(o => b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3]);
  let pick = cands.find(c => free(box(c)));
  if (!pick) {
    if (opts.optional) return;
    const b = box(cands[0]), lx = Math.min(Math.max(2, b[0]), W - 2 - w);     // keep it inside the canvas
    placed.push([lx, b[1], w, h]);
    label(octx, text, lx, cands[0][1], { ...opts, align: 'left' });
    return;
  }
  placed.push(box(pick));
  label(octx, text, pick[0], pick[1], { ...opts, align: pick[2] });
}
const shortLabel = t => t.replace(/\s*\(.*\)\s*$/, '');
function diamond(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); }
const lineAlpha = s => s == null ? 0.45 : Math.min(0.9, Math.max(0.15, (s - 0.35) / 0.4));

function drawOver(now = performance.now()) {
  if (!IX) return;
  octx.clearRect(0, 0, W, W);
  const r = dotR();
  const litIdeas = new Set(st.ideasLit.map(a => a[0]));
  const showPeople = st.mode === 'person' || st.lit.length > 0 || (st.filter && st.filter.type === 'person');
  const usedPeople = new Set(), usedIdeas = new Set();
  placed = [];
  // cluster labels only when zoomed in (placed last, and only where they fit)
  const clusterLabels = [];
  if (st.z >= 2) {
    for (const c of IX.clusters) {
      const x = sx(c.x / 10000), y = sy(c.y / 10000);
      if (x < 0 || y < 0 || x > W || y > W) continue;
      const t = c.label.length ? c.label.slice(0, 2).map(i => IX.ideas[i].label).join(' · ') : 'mixed talk';
      clusterLabels.push([t, x, y]);
    }
  }
  // lines from lit dots to person nodes (solid) and idea nodes (dashed)
  for (const [i, s] of st.lit) {
    const px = sx(X[i]), py = sy(Y[i]), on = i === st.focus;
    octx.strokeStyle = C.glow;
    for (const pi of IX.episodes[EP[i]].people) {
      const q = nodeXY(IX.people[pi]); if (!q) continue; usedPeople.add(pi);
      octx.globalAlpha = on ? 1 : lineAlpha(s); octx.lineWidth = on ? 2.5 : 1; octx.setLineDash([]);
      octx.beginPath(); octx.moveTo(px, py); octx.lineTo(q[0], q[1]); octx.stroke();
    }
    for (const ii of IX.passages.ideas[i]) {
      const q = nodeXY(IX.ideas[ii]); if (!q) continue; usedIdeas.add(ii);
      octx.globalAlpha = on ? 1 : lineAlpha(s) * 0.85; octx.lineWidth = on ? 2.5 : 1; octx.setLineDash([5, 4]);
      octx.beginPath(); octx.moveTo(px, py); octx.lineTo(q[0], q[1]); octx.stroke();
    }
  }
  octx.setLineDash([]); octx.globalAlpha = 1;
  // lit dots: glow (3 pulses over ~5 s, then hold; a static halo with reduced motion)
  let k = 0, animating = false;
  if (st.lit.length && !RM.matches) {
    const ph = (now - st.pulseStart) / 5000;
    if (ph < 1) { k = Math.sin(ph * 3 * Math.PI) ** 2; animating = true; }
  }
  for (const [i] of st.lit) {
    const x = sx(X[i]), y = sy(Y[i]);
    octx.beginPath(); octx.arc(x, y, r + 5 + 7 * k, 0, 6.2832); octx.fillStyle = C.glowSoft; octx.fill();
    octx.beginPath(); octx.arc(x, y, r + 2.2, 0, 6.2832); octx.fillStyle = C.glow; octx.fill();
    octx.lineWidth = 1.5; octx.strokeStyle = C.bg; octx.stroke();
  }
  // idea nodes (diamonds) and person nodes (circles): shapes first, then labels placed around them
  const ideaNodes = IX.ideas.map((d, i) => i).filter(i => IX.ideas[i].x != null && (usedIdeas.has(i) || litIdeas.has(i) ||
    (st.filter && st.filter.type === 'idea' && st.filter.i === i) ||
    (st.mode === 'idea' && !st.lit.length && IX.ideas[i].n >= (N > 10000 ? 80 : 25))));
  for (const i of ideaNodes) {
    const [x, y] = nodeXY(IX.ideas[i]); const hot = litIdeas.has(i);
    diamond(octx, x, y, hot ? 8 : 6);
    octx.fillStyle = C.bg; octx.fill(); octx.lineWidth = hot ? 3 : 1.5; octx.strokeStyle = hot ? C.glow : C.ink; octx.stroke();
    placed.push([x - 8, y - 8, 16, 16]);
  }
  const peopleShown = [];
  if (showPeople) {
    IX.people.forEach((p, pi) => {
      const q = nodeXY(p); if (!q) return;
      if (st.lit.length && !usedPeople.has(pi) && st.mode !== 'person') return;
      octx.beginPath(); octx.arc(q[0], q[1], 7, 0, 6.2832);
      octx.fillStyle = personColour(pi); octx.fill(); octx.lineWidth = 2; octx.strokeStyle = C.bg; octx.stroke();
      octx.lineWidth = 1; octx.strokeStyle = C.ink; octx.beginPath(); octx.arc(q[0], q[1], 8.5, 0, 6.2832); octx.stroke();
      placed.push([q[0] - 9, q[1] - 9, 18, 18]);
      peopleShown.push([p.name, q]);
    });
  }
  for (const [name, q] of peopleShown) place(name, q[0], q[1]);
  const byHeat = ideaNodes.slice().sort((a, b) => (litIdeas.has(b) - litIdeas.has(a)) || IX.ideas[b].n - IX.ideas[a].n);
  for (const i of byHeat) {
    const [x, y] = nodeXY(IX.ideas[i]); const hot = litIdeas.has(i);
    place(shortLabel(IX.ideas[i].label), x, y, { size: 13, weight: hot ? 700 : 500, gap: 10, optional: !hot });
  }
  for (const [t, x, y] of clusterLabels) place(t, x, y, { size: 13, weight: 400, colour: C.muted, center: true, optional: true });
  if (st.focus >= 0) {
    const x = sx(X[st.focus]), y = sy(Y[st.focus]);
    octx.beginPath(); octx.arc(x, y, r + 8, 0, 6.2832); octx.lineWidth = 2.5; octx.strokeStyle = C.ink; octx.stroke();
  }
  cancelAnimationFrame(st.raf);
  if (animating) st.raf = requestAnimationFrame(drawOver);
}

// ------------------------------------------------------------------ light up
function light(lit, ideas = [], focus = -1) {
  st.lit = lit; st.litSet = new Set(lit.map(a => a[0])); st.ideasLit = ideas; st.focus = focus;
  st.pulseStart = performance.now();
  drawBase(); drawOver();
  over.setAttribute('aria-label', mapLabel());
}
function mapLabel() {
  const base = `Map of ${N.toLocaleString('en')} passages from ${IX.episodes.length} episodes, coloured by ${st.mode}.`;
  return st.lit.length ? `${base} ${st.lit.length} lit.` : base;
}
function announce(t) { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); }
function setFocus(i, scroll) {
  st.focus = i; drawOver();
  document.querySelectorAll('.row.on').forEach(r => r.classList.remove('on'));
  const row = document.querySelector(`.row[data-i="${i}"]`);
  if (row) { row.classList.add('on'); if (scroll) { row.scrollIntoView({ block: 'nearest', behavior: RM.matches ? 'auto' : 'smooth' }); } }
  return row;
}

// ------------------------------------------------------------------ result rows
function episodeWith(e) { return listNames(e.people.map(pi => IX.people[pi].name)); }
function personHref(p) { return p.channel ? p.channel : '#person=' + encodeURIComponent(p.id); }
function ideaHref(d) { return d.glossary ? '../glossary/#' + encodeURIComponent(d.id) : '#idea=' + encodeURIComponent(d.id); }

function quoteHtml(i, sn, e) {
  const yt = ytUrl(e.vid, sn.s);
  const t = sn.t; let html = '', at = 0;
  const seg = (a, b) => a < b ? `<a href="${yt}" target="_blank" rel="noopener">${esc(t.slice(a, b))}</a>` : '';
  for (const [a, b, ii] of sn.m) {
    html += seg(at, a);
    const d = IX.ideas[ii];
    html += `<a class="idea" href="${ideaHref(d)}" title="Idea: ${esc(d.label)} (draft tag)">${esc(t.slice(a, b))}</a>`;
    at = b;
  }
  html += seg(at, t.length);
  return `<span class="src">auto-caption</span><p class="quote">“${html}”</p>`;
}

function row(i, score) {
  const P = IX.passages, e = IX.episodes[EP[i]], show = IX.shows[e.show] || { name: e.show };
  const sn = SN[i], t = sn ? sn.s : P.t0[i];
  const li = el('li', 'row'); li.dataset.i = i; li.tabIndex = -1;
  let h = '';
  if (sn) h += quoteHtml(i, sn, e);
  else {
    const talks = P.ideas[i].map(ii => IX.ideas[ii].label);
    h += `<p class="noq">No quote kept for this moment.${talks.length ? ' Talks about: ' + esc(talks.slice(0, 4).join(', ')) + '.' : ''}</p>`;
  }
  const cw = closeWord(score);
  h += `<p class="meta">${cw ? `<span class="close" title="similarity ${score.toFixed(3)}">${cw}</span> · ` : ''}From the episode with ${esc(episodeWith(e))} · ${esc(show.name)} · ${esc((e.date || '').slice(0, 4))} · ${fmtT(t)}</p>`;
  h += `<div class="links"><button type="button" class="play">${SVG_PLAY} Play here</button>`;
  h += `<a href="${ytUrl(e.vid, t)}" target="_blank" rel="noopener">YouTube at ${fmtT(t)} ${SVG_OUT}</a>`;
  const epu = e.url || show.url;
  if (epu) h += `<a href="${esc(epu)}" target="_blank" rel="noopener">${e.url ? 'Episode page' : 'Show page'} ${SVG_OUT}</a>`;
  h += '</div><div class="tags">';
  for (const pi of e.people) { const p = IX.people[pi]; h += `<a class="tag person" style="--c:${personColour(pi)}" href="${personHref(p)}">${esc(p.name)}</a>`; }
  for (const ii of P.ideas[i].slice(0, 4)) { const d = IX.ideas[ii]; h += `<a class="tag idea" href="${ideaHref(d)}">${esc(d.label)}</a>`; }
  h += '</div>';
  li.innerHTML = h;
  li.querySelector('.play').addEventListener('click', ev => {
    const f = el('iframe', 'player');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(e.vid)}?start=${Math.max(0, Math.floor(P.t0[i]) - 2)}&end=${Math.ceil(P.t1[i]) + 2}&autoplay=1&rel=0`;
    f.title = `${show.name}, episode with ${episodeWith(e)}, from ${fmtT(P.t0[i])}`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
    ev.currentTarget.closest('.links').after(f); ev.currentTarget.remove();
  });
  const on = () => { if (st.litSet.has(i)) setFocus(i, false); };
  li.addEventListener('mouseenter', on); li.addEventListener('focusin', on);
  return li;
}
function rows(list) { const ul = el('ul', 'rows'); for (const [i, s] of list) ul.append(row(i, s)); return ul; }

// ------------------------------------------------------------------ views
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
function resetOut(msg) { $('#out').innerHTML = msg === '' ? '' : `<p class="empty">${msg || 'Pick a question above, or tap any dot on the map.'}</p>`; }
function markChip(id) { document.querySelectorAll('#suggest button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id))); }

function showResults(text, top, ideas, note) {
  closeSheet(); st.filter = null; markLegend();
  const out = $('#out'); out.innerHTML = '';
  const nE = IX.episodes.length;
  const best = top.length ? top[0][1] : 0;
  out.append(el('h2', null, 'Closest passages'));
  out.append(el('p', 'lead', `To “${esc(text)}”`));
  if (note) out.append(el('p', 'caveat', esc(note)));
  if (ideas.length) {
    const p = el('p', 'near-ideas', 'Ideas near your question: ');
    ideas.forEach(([ii, s], k) => { const a = el('a', null, esc(IX.ideas[ii].label)); a.href = ideaHref(IX.ideas[ii]); a.title = 'similarity ' + s.toFixed(3); p.append(a); if (k < ideas.length - 1) p.append(', '); });
    out.append(p);
  }
  if (best < 0.5) {
    out.append(el('p', null, `Nothing in these ${nE} episodes is close to that (best ${best.toFixed(2)}).`));
    const d = el('details', 'anyway'); d.append(el('summary', null, 'Closest anyway')); d.append(rows(top.slice(0, 3)));
    out.append(d);
    light(top.slice(0, 3), ideas);
    announce(`Nothing close; best ${best.toFixed(2)}. Three closest anyway are lit.`);
  } else {
    out.append(rows(top));
    light(top, ideas);
    announce(`${top.length} passages lit; closest: from the episode with ${episodeWith(IX.episodes[EP[top[0][0]]])}.`);
  }
}

function askSuggested(id, push) {
  const q = IX.questions.find(x => x.id === id); if (!q) return false;
  st.view = 'question'; st.qid = id; st.typed = null; $('#q').value = q.text; $('#share').hidden = true;
  markChip(id);
  showResults(q.text, q.top, q.ideas || []);
  if (push) history.pushState(null, '', '#q=' + id);
  $('#status').textContent = '';
  return true;
}

async function ensureModel(fromButton) {
  if (modelState === 'ready') return true;
  if (modelState === 'failed') return false;
  if (modelPromise) return modelPromise;
  if (!fromButton && saveData()) { $('#modelnote').hidden = false; $('#status').textContent = 'You seem to be on a data saver. Press Load to download the model.'; return false; }
  $('#modelnote').hidden = false;
  modelPromise = loadModel();
  return modelPromise;
}
async function loadModel() {
  modelState = 'loading';
  const status = $('#status'), prog = {};
  status.textContent = 'Loading the model…';
  try {
    search = await import('./search.js?v=4');
    await search.load(p => {
      if (p.status === 'progress' && p.total) {
        prog[p.file] = [p.loaded, p.total];
        const [a, b] = Object.values(prog).reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
        status.textContent = `Loading the model… ${Math.round(100 * a / b)}%`;
      }
    });
    modelState = 'ready'; status.textContent = 'Model loaded. Your questions stay in this browser.';
    $('#modelnote').hidden = true;
    return true;
  } catch (err) {
    console.warn('model load failed', err);
    modelState = 'failed';
    status.textContent = 'The model did not load, so questions are matched against idea names instead.';
    return false;
  }
}

const STOP = new Set('the and for are but not you all any can had her was one our out has have what when who will with would about could should there their them they this that from into more most some than then very does how why ai'.split(' '));
function keywordFallback(text) {
  const words = (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOP.has(w));
  const hits = IX.ideas.map((d, i) => [i, d]).filter(([, d]) => words.some(w => {
    const hay = (d.label + ' ' + d.id.replace(/-/g, ' ')).toLowerCase();
    return hay.includes(w) || (w.length > 4 && hay.includes(w.slice(0, -1)));
  })).map(([i]) => i);
  const P = IX.passages, pick = [];
  for (const withSnip of [true, false]) for (let i = 0; i < N && pick.length < 12; i++)
    if (!!SN[i] === withSnip && !pick.includes(i) && P.ideas[i].some(ii => hits.includes(ii))) pick.push(i);
  return { top: pick.map(i => [i, null]), ideas: hits.slice(0, 3).map(i => [i, 1]) };
}

async function askTyped(text, fromButton) {
  text = text.trim(); if (!text) return;
  const sug = IX.questions.find(q => q.text.toLowerCase() === text.toLowerCase());
  if (sug) return askSuggested(sug.id, true);
  st.view = 'question'; st.qid = null; st.typed = text; markChip(null);
  const ok = await ensureModel(fromButton);
  if (!ok) {
    if (modelState !== 'failed') return;
    const r = keywordFallback(text);
    if (!r.top.length) { closeSheet(); resetOut(`No idea name matches “${esc(text)}”, and the model did not load. Try a suggested question.`); light([]); return; }
    showKeyword(text, r);
    return;
  }
  const r = await search.query(text);
  showResults(text, r.top, r.ideas);
  $('#share').hidden = false;
  $('#status').textContent = `Answered in ${r.ms.embed + r.ms.search} ms, inside your browser.`;
}
function showKeyword(text, r) {
  closeSheet(); const out = $('#out'); out.innerHTML = '';
  out.append(el('h2', null, 'Passages with matching idea words'));
  out.append(el('p', 'caveat', 'The model did not load, so this matched your words against idea names instead. These are keyword matches, not closeness.'));
  out.append(rows(r.top)); light(r.top, r.ideas);
  announce(`${r.top.length} passages lit by keyword match.`);
}

function showPassage(i, push) {
  st.view = 'passage'; markChip(null);
  const sheet = $('#sheet'); sheet.innerHTML = '';
  const head = el('div', 'panelhead', '<h2>This passage</h2>');
  const x = el('button', null, 'Close'); x.type = 'button'; x.addEventListener('click', () => { closeSheet(); light([]); history.pushState(null, '', location.pathname); over.focus(); });
  head.append(x); sheet.append(head);
  sheet.append(rows([[i, null]]));
  sheet.append(el('h3', null, 'Passages like this one'));
  const nn = Array.from(NN.subarray(i * 6, i * 6 + 6));
  sheet.append(rows(nn.map(j => [j, null])));
  sheet.append(el('p', 'caveat', 'Neighbours by the model’s numbers. Many come from the same episode.'));
  sheet.hidden = false; resetOut('');
  light([[i, null], ...nn.map(j => [j, null])], [], i);
  setFocus(i, false);
  const e = IX.episodes[EP[i]];
  if (push) history.pushState(null, '', `#p=${e.vid}:${Math.floor(IX.passages.t0[i])}`);
  announce(`Passage from the episode with ${episodeWith(e)} at ${fmtT(IX.passages.t0[i])}; 6 like it are lit.`);
  sheet.querySelector('.row').focus({ preventScroll: true });
}

function showPerson(pi) {
  const p = IX.people[pi]; closeSheet(); markChip(null);
  st.view = 'person'; st.filter = { type: 'person', i: pi }; light([]); markLegend();
  const eps = IX.episodes.filter(e => e.people.includes(pi));
  const out = $('#out'); out.innerHTML = '';
  const head = el('div', 'panelhead', `<h2>${esc(p.name)}</h2>`);
  head.append(clearBtn()); out.append(head);
  out.append(el('p', 'lead', `${p.n.toLocaleString('en')} passages from ${eps.length} episode${eps.length > 1 ? 's' : ''} with ${esc(p.name)}. The map shows only these. A passage mixes host and guest.`));
  const ul = el('ul', 'eplist');
  for (const e of eps) {
    const s = IX.shows[e.show] || {}; const u = e.url || s.url;
    ul.append(el('li', null, `${esc(s.name || e.show)} · ${esc(e.date || '')} · ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(e.title)} ${SVG_OUT}</a>` : esc(e.title)}`));
  }
  out.append(ul);
  const some = [];
  for (let i = 0; i < N && some.length < 6; i++) if (SN[i] && IX.episodes[EP[i]].people.includes(pi)) some.push([i, null]);
  if (some.length) { out.append(el('h3', null, 'Some moments')); out.append(rows(some)); }
  announce(`Showing ${p.n} passages from episodes with ${p.name}.`);
}

function showIdea(ii) {
  const d = IX.ideas[ii]; closeSheet(); markChip(null);
  st.view = 'idea'; st.filter = { type: 'idea', i: ii }; light([]); markLegend();
  const out = $('#out'); out.innerHTML = '';
  const head = el('div', 'panelhead', `<h2>${esc(d.label)}</h2>`); head.append(clearBtn()); out.append(head);
  const cav = d.precision === 'high' ? 'keyword match; most hits are on topic' : 'keyword match; some hits are off-topic';
  out.append(el('p', 'caveat', `Draft tag (${cav}). ${d.n.toLocaleString('en')} passages carry it; the map shows only these.`));
  if (d.glossary) out.append(el('p', null, `<a href="../glossary/#${encodeURIComponent(d.id)}">In the glossary</a>`));
  const P = IX.passages, pick = [];
  for (const withSnip of [true, false]) for (let i = 0; i < N && pick.length < 8; i++)
    if (!!SN[i] === withSnip && !pick.some(a => a[0] === i) && P.ideas[i].includes(ii)) pick.push([i, null]);
  out.append(rows(pick));
  announce(`Showing ${d.n} passages tagged ${d.label}.`);
}
function clearBtn() { const b = el('button', null, 'Show the whole map'); b.type = 'button'; b.addEventListener('click', clearAll); return b; }

function clearAll() {
  st.filter = null; st.view = 'none'; st.qid = null; st.typed = null;
  closeSheet(); resetOut(); markChip(null); markLegend(); light([]);
  $('#share').hidden = true; $('#status').textContent = '';
  if (location.hash) history.pushState(null, '', location.pathname);
}

// ------------------------------------------------------------------ chrome: chips, legend, sources
function buildSuggest() {
  const ul = $('#suggest'); ul.innerHTML = '';
  for (const q of IX.questions) {
    const li = el('li'), b = el('button', null, esc(q.text)); b.type = 'button'; b.dataset.id = q.id; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => askSuggested(q.id, true)); li.append(b); ul.append(li);
  }
}
function legendItems() {
  if (st.mode === 'person') {
    const its = IX.people.map((p, pi) => ({ key: 'p' + pi, name: p.name, colour: personColour(pi), n: p.n, f: { type: 'person', i: pi }, hash: '#person=' + p.id }))
      .filter((x, pi) => IX.people[pi].colour != null).sort((a, b) => IX.people[+a.key.slice(1)].colour - IX.people[+b.key.slice(1)].colour);
    const other = IX.people.filter(p => p.colour == null);
    if (other.length) its.push({ key: 'po', name: `Others (${other.length})`, colour: C.other, n: null, f: { type: 'otherperson' } });
    return its;
  }
  if (st.mode === 'idea') {
    const its = IX.lanes.filter(l => l.colour != null).map(l => ({ key: 'l' + l.id, name: l.label, colour: slotColour(l.colour), n: l.n, f: { type: 'lane', i: IX.lanes.indexOf(l) } }));
    const oth = IX.lanes.filter(l => l.colour == null);
    if (oth.length) its.push({ key: 'lo', name: 'Other ideas', colour: C.other, n: oth.reduce((s, l) => s + l.n, 0), f: { type: 'otherlane' } });
    its.push({ key: 'lu', name: 'No idea word', colour: C.grey, n: IX.passages.ideas.filter(a => !a.length).length, f: { type: 'untagged' } });
    return its;
  }
  return [];
}
function buildLegend() {
  const ul = $('#legend'); ul.innerHTML = '';
  for (const it of legendItems()) {
    const li = el('li'), b = el('button', null, `<span class="sw" style="background:${it.colour}"></span>${esc(it.name)}${it.n != null ? ` <span class="n">${it.n.toLocaleString('en')}</span>` : ''}`);
    b.type = 'button'; b.dataset.key = it.key; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const same = st.filter && JSON.stringify(st.filter) === JSON.stringify(it.f);
      if (same) { clearAll(); return; }
      if (it.f.type === 'person') { history.pushState(null, '', it.hash); showPerson(it.f.i); return; }
      st.filter = it.f; closeSheet(); light([]); markLegend();
      resetOut(`Showing ${esc(it.name)} only. Tap the chip again to show everything.`);
    });
    li.append(b); ul.append(li);
  }
  markLegend();
}
function markLegend() {
  const f = st.filter;
  document.querySelectorAll('#legend button').forEach(b => {
    const k = b.dataset.key;
    const on = !!f && ((f.type === 'person' && k === 'p' + f.i) || (f.type === 'lane' && k === 'l' + IX.lanes[f.i].id) ||
      (f.type === 'otherlane' && k === 'lo') || (f.type === 'untagged' && k === 'lu') || (f.type === 'otherperson' && k === 'po'));
    b.setAttribute('aria-pressed', String(on));
  });
}
function setCaption() {
  $('#mapcap').textContent = st.mode === 'person' ? 'Colour shows whose episode a passage comes from, not who is speaking.'
    : st.mode === 'idea' ? 'Colour shows idea words found by a draft keyword list; grey had none.'
    : 'Plain: one colour, so the shape of the map shows.';
}
function buildSources() {
  const tb = $('#srcrows'); tb.innerHTML = '';
  const eps = IX.episodes.map((e, i) => [e, i]).sort((a, b) => (IX.shows[a[0].show]?.name || '').localeCompare(IX.shows[b[0].show]?.name || '') || (a[0].date || '').localeCompare(b[0].date || ''));
  for (const [e] of eps) {
    const s = IX.shows[e.show] || { name: e.show };
    const tr = el('tr');
    tr.innerHTML = `<td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</td>` +
      `<td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : `${esc(e.title)} (<a href="${ytUrl(e.vid, 0)}" target="_blank" rel="noopener">video</a>)`}</td>` +
      `<td>${esc(episodeWith(e))}</td><td>${esc(e.date || '')}</td><td class="num">${e.n.toLocaleString('en')}</td>`;
    tb.append(tr);
  }
  for (const x of IX.excluded || []) {
    const tr = el('tr'); tr.innerHTML = `<td colspan="5">Not included: <a href="${ytUrl(x.vid, 0)}" target="_blank" rel="noopener">${esc(x.vid)}</a> (${esc(x.why)})</td>`; tb.append(tr);
  }
  const nyt = IX.episodes.some(e => IX.shows[e.show]?.nyt);
  $('#sourceslead').textContent = `Every episode on the map (${IX.episodes.length}), linked to the show's own page.` + (nyt ? ' The Ezra Klein Show is a New York Times show, so its quotes stop at 15 words.' : '');
}

// ------------------------------------------------------------------ hash
function applyHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [k, ...rest] = h.split('='); const v = rest.join('=');
  if (!h) { if (st.view !== 'none') clearAll(); return; }
  if (k === 'q' && askSuggested(v, false)) return;
  if (k === 'p') {
    const [vid, t] = [v.slice(0, v.lastIndexOf(':')), +v.slice(v.lastIndexOf(':') + 1)];
    const ei = IX.episodes.findIndex(e => e.vid === vid);
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) if (EP[i] === ei) { const d = Math.abs(IX.passages.t0[i] - t); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { showPassage(best, false); return; }
  }
  if (k === 'person') { const pi = IX.people.findIndex(p => p.id === v); if (pi >= 0) { showPerson(pi); return; } }
  if (k === 'idea') { const ii = IX.ideas.findIndex(d => d.id === v); if (ii >= 0) { showIdea(ii); return; } }
  if (k === 'ask' && v) {
    $('#q').value = v; $('#modelnote').hidden = false;
    $('#status').textContent = 'A shared question. Press Light up (it downloads the model once) to ask it.';
    return;
  }
}

// ------------------------------------------------------------------ input: map
function hit(px, py) {
  const x = dx(px), y = dy(py), rr = 14 / (inner() * st.z);
  let best = -1, bd = rr * rr;
  const x0 = Math.floor((x - rr) * GRID), x1 = Math.floor((x + rr) * GRID), y0 = Math.floor((y - rr) * GRID), y1 = Math.floor((y + rr) * GRID);
  for (let gy = Math.max(0, y0); gy <= Math.min(GRID - 1, y1); gy++)
    for (let gx = Math.max(0, x0); gx <= Math.min(GRID - 1, x1); gx++)
      for (const i of grid[gx + GRID * gy]) {
        const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2;
        const pref = st.litSet.has(i) ? 0.5 : 1;             // lit dots win close calls
        if (d * pref < bd) { bd = d * pref; best = i; }
      }
  return best;
}
const ptrs = new Map(); let drag = null, pinch = null;
over.addEventListener('pointerdown', e => {
  over.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.z }; drag = null; }
  else drag = { x: e.offsetX, y: e.offsetY, cx: st.cx, cy: st.cy, moved: 0 };
});
over.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt((pinch.z * d / pinch.d) / st.z, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return;
  }
  if (!drag) return;
  const mx = e.offsetX - drag.x, my = e.offsetY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(mx, my));
  if (st.z > 1 && drag.moved > 4) {
    st.cx = drag.cx - mx / (inner() * st.z); st.cy = drag.cy - my / (inner() * st.z); clampView(); drawBase(); drawOver();
  }
});
const endPtr = e => {
  ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
  if (drag && drag.moved < 6 && e.type === 'pointerup') tapAt(e.offsetX, e.offsetY);
  drag = null;
};
over.addEventListener('pointerup', endPtr); over.addEventListener('pointercancel', endPtr);
over.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.002), e.offsetX, e.offsetY); }, { passive: false });
over.addEventListener('dblclick', e => zoomAt(2, e.offsetX, e.offsetY));
function tapAt(px, py) {
  const i = hit(px, py); if (i < 0) return;
  if (st.litSet.has(i) && st.view === 'question') { const r = setFocus(i, true); if (r) r.focus({ preventScroll: true }); return; }
  showPassage(i, true);
}
over.addEventListener('keydown', e => {
  const lit = st.lit.map(a => a[0]);
  if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key) && lit.length) {
    e.preventDefault();
    const k = lit.indexOf(st.focus), step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const i = lit[(k + step + lit.length) % lit.length];
    setFocus(i, true);
    const ep = IX.episodes[EP[i]], sn = SN[i];
    announce(`${lit.indexOf(i) + 1} of ${lit.length}: from the episode with ${episodeWith(ep)}, ${fmtT(IX.passages.t0[i])}.${sn ? ' ' + sn.t : ''}`);
  } else if (e.key === 'Enter' && st.focus >= 0) {
    const r = document.querySelector(`.row[data-i="${st.focus}"]`); if (r) r.focus();
  } else if (e.key === '+' || e.key === '=') zoomAt(1.5);
  else if (e.key === '-') zoomAt(1 / 1.5);
  else if (e.key === '0') { st.z = 1; clampView(); drawBase(); drawOver(); }
});

// ------------------------------------------------------------------ input: page
$('#zin').addEventListener('click', () => zoomAt(1.5));
$('#zout').addEventListener('click', () => zoomAt(1 / 1.5));
$('#zreset').addEventListener('click', () => { st.z = 1; clampView(); drawBase(); drawOver(); });
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
  st.mode = r.value; if (st.filter && ['lane', 'untagged', 'otherlane', 'otherperson'].includes(st.filter.type)) st.filter = null;
  buildLegend(); setCaption(); drawBase(); drawOver(); over.setAttribute('aria-label', mapLabel());
}));
$('#q').addEventListener('focus', () => { if (modelState !== 'ready') $('#modelnote').hidden = false; }, { once: false });
$('#loadmodel').addEventListener('click', async () => { const ok = await ensureModel(true); if (ok && $('#q').value.trim()) askTyped($('#q').value, true); });
$('#qform').addEventListener('submit', e => { e.preventDefault(); askTyped($('#q').value, false); });
$('#share').addEventListener('click', async () => {
  if (!st.typed) return;
  history.pushState(null, '', '#ask=' + encodeURIComponent(st.typed));
  try { await navigator.clipboard.writeText(location.href); $('#status').textContent = 'Link copied. It carries your question.'; }
  catch { $('#status').textContent = 'The link with your question is now in the address bar.'; }
});
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); }
  else if (e.key === 'Escape') { $('#q').value = ''; clearAll(); }
});
const retheme = () => { readColours(); if (IX) { buildLegend(); drawBase(); drawOver(); } };
DARKQ.addEventListener('change', retheme);
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
RM.addEventListener('change', () => drawOver());

boot().catch(err => { console.error(err); resetOut('The map data did not load. Try reloading the page.'); });
