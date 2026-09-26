// map.js: The map that lights up. Vanilla JS, two stacked canvases, no library.
// Base canvas: every dot (redrawn only on pan, zoom, filter or colour change).
// Overlay canvas: glow, lines, nodes, labels, numbers, focus ring.
const $ = (s, r = document) => r.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const DARKQ = matchMedia('(prefers-color-scheme: dark)');
const WIDE = matchMedia('(min-width: 900px)');
const TAU = 6.2832;
const SVG_PLAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const SVG_OUT = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const SVG_DOWN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

let IX, SN = {}, NN, N = 0, KW = null;
let X, Y, EP, PERSON, LANE, LANESETS;       // typed arrays per passage (LANESETS: bit mask of lanes)
let grid, GRID = 48;
let C = {};                                // resolved colours
const st = {
  mode: 'person', lit: [], litSet: new Set(), num: new Map(), focus: -1, filter: null, ideasLit: [],
  z: 1, cx: 0.5, cy: 0.5, pulseStart: 0, raf: 0, view: 'none', qid: null, typed: null, last: null, quietUntil: 0,
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
// The model's score bands (thresholds fixed before any results were read: 0.65 and 0.50).
// They describe the model's number, not whether a passage answers the question.
const band = s => s == null ? null : s >= 0.65 ? 'high' : s >= 0.5 ? 'medium' : 'low';
const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
const numWord = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
function hostLabel(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    return h === 'podcasts.apple.com' ? 'Apple Podcasts' : h === 'open.spotify.com' ? 'Spotify' : h;
  } catch { return 'link'; }
}
const capKind = e => e.captions === 'creator' ? 'creator caption' : e.captions === 'auto' ? 'auto-caption' : 'caption';

function readColours() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  C = { bg: g('--panel'), ink: g('--ink'), muted: g('--muted'), grey: g('--dot-grey'), other: g('--dot-other'),
        glow: g('--glow'), glowSoft: g('--glow-soft'), focus: g('--focus') };
  for (let i = 0; i < 6; i++) C['s' + i] = g('--s' + i);
}
const slotColour = s => (s == null ? C.other : C['s' + s]);
// pi < 0: no guest identified for the episode (most of corpus-expansion's shows) -- colours like "Other"
const personColour = pi => pi < 0 ? C.other : slotColour(IX.people[pi].colour);

// ------------------------------------------------------------------ load
async function boot() {
  readColours();
  // 'no-cache' asks the server whether a file changed (a 304 when not), so a rebuilt map never mixes old and new data
  const get = f => fetch('data/' + f, { cache: 'no-cache' });
  const [ix, sn, nn, kw] = await Promise.all([
    get('index.json').then(r => r.json()),
    get('snippets.json').then(r => r.json()),
    get('nn.u16.bin').then(r => r.arrayBuffer()),
    get('words.json').then(r => r.json()).catch(() => null),     // key words are a help, not a need
  ]);
  IX = ix; SN = sn; NN = new Uint16Array(nn); KW = kw;
  const P = IX.passages; N = P.ep.length;
  X = new Float32Array(N); Y = new Float32Array(N); EP = new Int16Array(N); PERSON = new Int16Array(N);
  LANE = new Int16Array(N); LANESETS = new Uint32Array(N);
  const laneIdx = Object.fromEntries(IX.lanes.map((l, i) => [l.id, i]));
  for (let i = 0; i < N; i++) {
    X[i] = P.x[i] / 10000; Y[i] = P.y[i] / 10000; EP[i] = P.ep[i];
    PERSON[i] = IX.episodes[P.ep[i]].people[0] ?? -1;
    // colour lane: the lane holding most of the passage's idea words (ties: the first found)
    const cnt = new Map();
    for (const ii of P.ideas[i]) { const l = laneIdx[IX.ideas[ii].lane]; if (l == null) continue; cnt.set(l, (cnt.get(l) || 0) + 1); LANESETS[i] |= 1 << l; }
    let best = -1, bn = 0; for (const [l, n] of cnt) if (n > bn) { best = l; bn = n; }
    LANE[i] = best;
  }
  grid = Array.from({ length: GRID * GRID }, () => []);
  for (let i = 0; i < N; i++) grid[cell(X[i], Y[i])].push(i);

  fillText();
  buildSuggest(); buildLegend(); buildSources(); setCaption();
  clampView(); sizeCanvas();
  new ResizeObserver(sizeCanvas).observe(stage);
  addEventListener('hashchange', safeApplyHash);
  safeApplyHash();
  over.setAttribute('aria-label', mapLabel());
  if (WIDE.matches) $('#keybox').open = true;
}
const cell = (x, y) => Math.min(GRID - 1, Math.max(0, Math.floor(x * GRID))) + GRID * Math.min(GRID - 1, Math.max(0, Math.floor(y * GRID)));

// numbers in the page text come from the data, so they stay true when the build grows
function fillText() {
  const E = IX.episodes, nE = E.length, P = IX.passages;
  $('#subtitle').textContent = `${nE} conversations about AI, cut into ${N.toLocaleString('en')} half-minute passages. Ask a question and the passages the model scores closest light up.`;
  const untagged = P.ideas.filter(a => !a.length).length;
  $('#tagshare').textContent = `About ${Math.round(100 * untagged / N)}% of passages match no idea word; they are grey in Idea mode.`;
  const K = IX.layout_keep;
  if (K) $('#keepinfo').textContent = `Of each passage’s 10 nearest passages by the model’s numbers, on average ${Math.round(100 * K['10'])}% are among its 10 nearest dots on the map (${Math.round(100 * K['100'])}% within the nearest 100).`;
  const cr = E.filter(e => e.captions === 'creator').length, au = E.filter(e => e.captions === 'auto').length;
  const parts = [];
  if (cr) parts.push(`the creator's own captions for ${numWord(cr)} episode${cr > 1 ? 's' : ''}`);
  if (au) parts.push(`YouTube's automatic captions for ${numWord(au)}`);
  if (nE - cr - au) parts.push(`captions of an unchecked kind for ${numWord(nE - cr - au)}`);
  $('#capinfo').textContent = `taken from each video's English captions on YouTube: ${listNames(parts)}. Each quote says which.`;
  const nq = Object.keys(SN).length;
  $('#quoteshare').textContent = `Only ${nq.toLocaleString('en')} of the ${N.toLocaleString('en')} passages (about 1 in ${Math.round(N / Math.max(1, nq))}) have a quote.`;
  const dario = IX.people.findIndex(p => p.id === 'dario_amodei');
  const nd = dario < 0 ? 0 : E.filter(e => e.people.includes(dario)).length;
  $('#disclosure').textContent = nd
    ? `Built with Claude, made by Anthropic, whose CEO (Dario Amodei) is the guest in ${nd === 1 ? 'one' : numWord(nd)} of these ${nE} episodes.`
    : 'Built with Claude, made by Anthropic.';
}

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
  if (f.type === 'lane') return (LANESETS[i] >> f.i) & 1;                     // any idea word of the lane
  if (f.type === 'untagged') return LANE[i] < 0;
  if (f.type === 'otherlane') return IX.lanes.some((l, li) => l.colour == null && ((LANESETS[i] >> li) & 1));
  if (f.type === 'otherperson') return PERSON[i] < 0 || IX.people[PERSON[i]].colour == null;
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
    for (const i of ids) { const x = sx(X[i]), y = sy(Y[i]); bctx.moveTo(x + r, y); bctx.arc(x, y, r, 0, TAU); }
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
const onCanvas = q => q && q[0] >= 4 && q[1] >= 4 && q[0] <= W - 4 && q[1] <= W - 4;
function label(ctx, text, x, y, opts = {}) {
  ctx.font = `${opts.weight || 700} ${opts.size || 14}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  ctx.textAlign = opts.align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.bg; ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.colour || C.ink; ctx.fillText(text, x, y);
}
// Label placement: try spots around the node, then spots further out (joined to the node by a thin leader
// line), keeping the first that overlaps nothing placed yet. Optional labels are dropped rather than crowded.
// Placing and painting are separate: everything is placed first, then painted in a fixed order (lines, node
// marks, lit dots with number one on top, names, numbers), so no mark is ever painted over a lit passage.
let placed = [], later = [], laterNum = [], numHits = [];
const boxHit = (b, o) => b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3];
const overlaps = (b, skip) => placed.some(o => o !== skip && boxHit(b, o));
const insideCanvas = b => b[0] >= 2 && b[1] >= 2 && b[0] + b[2] <= W - 2 && b[1] + b[3] <= W - 2;
function leader(x, y, b, from) {
  const nx = Math.min(Math.max(x, b[0]), b[0] + b[2]), ny = Math.min(Math.max(y, b[1]), b[1] + b[3]);
  const a = Math.atan2(ny - y, nx - x);
  octx.save(); octx.globalAlpha = 0.9; octx.strokeStyle = C.ink; octx.lineWidth = 1; octx.setLineDash([]);
  octx.beginPath(); octx.moveTo(x + from * Math.cos(a), y + from * Math.sin(a)); octx.lineTo(nx, ny); octx.stroke(); octx.restore();
}
function place(text, x, y, opts = {}) {
  const size = opts.size || 14;
  octx.font = `${opts.weight || 700} ${size}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  const w = octx.measureText(text).width, h = size + 4, g = opts.gap ?? 12;
  const box = ([cx, cy, al]) => [al === 'left' ? cx : al === 'right' ? cx - w : cx - w / 2, cy - h / 2, w, h];
  // a name must sit clearly nearer its own node than any other node, so it is never read as the neighbour's
  const near = (b, px, py) => Math.hypot(px - Math.min(Math.max(px, b[0]), b[0] + b[2]), py - Math.min(Math.max(py, b[1]), b[1] + b[3]));
  const margin = b => { const d = near(b, x, y); let m = 1e9; for (const [nx, ny] of nodesXY) if (nx !== x || ny !== y) m = Math.min(m, near(b, nx, ny) - d); return m; };
  const own = b => { const d = near(b, x, y); return nodesXY.every(([nx, ny]) => (nx === x && ny === y) || (near(b, nx, ny) - d >= 5 && near(b, nx, ny) >= 1.5 * d)); };
  const free = b => insideCanvas(b) && !overlaps(b);
  const draw = (c, lead) => {
    const b = box(c); placed.push(b);
    later.push(() => { if (lead) leader(x, y, b, 10); label(octx, text, c[0], c[1], { ...opts, align: c[2] }); });
    return true;
  };
  if (opts.center) {
    const c = [x, y, 'center'];
    if (free(box(c)) || !opts.optional) return draw(c, false);
    return false;
  }
  const ring = d => [[x + d, y, 'left'], [x - d, y, 'right'], [x, y - d - h / 2 + 4, 'center'], [x, y + d + h / 2 - 4, 'center'],
    [x + d * 0.8, y - d * 0.8, 'left'], [x + d * 0.8, y + d * 0.8, 'left'], [x - d * 0.8, y - d * 0.8, 'right'], [x - d * 0.8, y + d * 0.8, 'right']];
  // 1) the nearest free spot that is clearly this node's; 2) else the free spot that is most clearly this node's
  // (joined by a leader line); 3) else, for a required name, the nearest spot on the canvas
  const rings = opts.optional ? [g] : [g, g + 16, g + 34, g + 56, g + 84];
  const cands = rings.flatMap(d => ring(d).map(c => [c, d])).filter(([c]) => free(box(c)));
  const mine = cands.find(([c]) => own(box(c)));
  if (mine) return draw(mine[0], mine[1] > g);
  if (opts.optional) return false;
  if (cands.length) {
    const best = cands.reduce((a, b) => (margin(box(b[0])) - b[1] / 20 > margin(box(a[0])) - a[1] / 20 ? b : a));
    return draw(best[0], true);
  }
  const c = ring(g).find(c => insideCanvas(box(c)) && own(box(c))) || ring(g).find(c => insideCanvas(box(c))) || [x, y + g + h / 2, 'center'];
  return draw(c, false);
}
let nodesXY = [];
const shortLabel = t => t.replace(/\s+\(.*\)\s*$/, '');          // 'The race (arms race, US–China)' -> 'The race'; 'p(doom)' stays
function diamond(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); }
const lineAlpha = s => { const b = band(s); return b === 'high' ? 0.9 : b === 'medium' ? 0.65 : b === 'low' ? 0.4 : 0.55; };
// Two node marks closer than this are pushed apart (each moves half the gap), so neither hides the other.
function separate(nodes, min = 21) {
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const A = nodes[a], B = nodes[b];
      let vx = B.x - A.x, vy = B.y - A.y, d = Math.hypot(vx, vy);
      if (d >= min) continue;
      if (d < 0.01) { vx = 1; vy = 0.4; d = Math.hypot(vx, vy); }
      const p = (min - d) / 2 + 0.05;
      A.x -= vx / d * p; A.y -= vy / d * p; B.x += vx / d * p; B.y += vy / d * p; moved = true;
    }
    for (const n of nodes) { n.x = Math.min(W - 10, Math.max(10, n.x)); n.y = Math.min(W - 10, Math.max(10, n.y)); }
    if (!moved) break;
  }
}
// Numbers beside lit dots, matching the numbered list. Dots whose glows touch share one label ("1, 5, 7").
// A label goes in the nearest spot that covers nothing else; failing that, one that may cover a node mark but
// no lit dot or number; failing that, one that covers no number. Further spots get a thin leader line.
// [1, 2, 3, 4, 6, 9, 10] -> "1–4, 6, 9, 10": runs of three or more become a range
function numRanges(ns) {
  const out = [];
  for (let k = 0; k < ns.length;) {
    let j = k; while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    if (j - k >= 2) out.push(`${ns[k]}–${ns[j]}`); else for (let q = k; q <= j; q++) out.push(String(ns[q]));
    k = j + 1;
  }
  return out.join(', ');
}
const NUM_ANG = [-0.6, 0.6, -2.55, 2.55, -1.57, 1.57, 0, 3.14, -1.05, 1.05, -2.1, 2.1];
function placeNumbers(r, dotBox) {
  const pts = [];
  for (const [i] of st.lit) {
    const n = st.num.get(i); if (!n) continue;
    const x = sx(X[i]), y = sy(Y[i]);
    if (x < 0 || y < 0 || x > W || y > W) continue;
    pts.push({ i, n, x, y });
  }
  const G = Math.max(10, 2 * r + 6);
  const par = pts.map((_, k) => k), find = k => (par[k] === k ? k : (par[k] = find(par[k])));
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++)
    if (Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) < G) par[find(a)] = find(b);
  const byRoot = new Map();
  pts.forEach((p, k) => { const g = find(k); (byRoot.get(g) || byRoot.set(g, []).get(g)).push(p); });
  const groups = [...byRoot.values()].map(m => m.sort((a, b) => a.n - b.n)).sort((a, b) => a[0].n - b[0].n);
  const H = 15, dots = new Set(dotBox.values()), nums = new Set();
  octx.font = '700 12px system-ui,-apple-system,"Segoe UI",sans-serif';
  for (const m of groups) {
    const cx = m.reduce((s, p) => s + p.x, 0) / m.length, cy = m.reduce((s, p) => s + p.y, 0) / m.length;
    const R = Math.max(...m.map(p => Math.hypot(p.x - cx, p.y - cy))) + r + 3;
    const t = numRanges(m.map(p => p.n)), w = octx.measureText(t).width + 4;
    const mine = new Set(m.map(p => dotBox.get(p.i)));
    const cands = [];
    for (const d of [R + 1, R + 9, R + 20, R + 34, R + 52, R + 76, R + 106])
      for (const a of NUM_ANG) {
        const c = Math.cos(a), s = Math.sin(a), ex = cx + d * c, ey = cy + d * s;
        cands.push({ d, b: [c > 0.3 ? ex : c < -0.3 ? ex - w : ex - w / 2, s > 0.3 ? ey : s < -0.3 ? ey - H : ey - H / 2, w, H] });
      }
    const clear = (b, isObstacle) => !placed.some(o => isObstacle(o) && boxHit(b, o));
    const tiers = [o => !mine.has(o), o => nums.has(o) || (dots.has(o) && !mine.has(o)), o => nums.has(o)];
    let pick = null;
    for (const ob of tiers) { pick = cands.find(c => insideCanvas(c.b) && clear(c.b, ob)); if (pick) break; }
    pick = pick || cands.find(c => insideCanvas(c.b)) || cands[0];
    const b = pick.b; placed.push(b); nums.add(b);
    numHits.push({ b, i: m[0].i });
    const lead = pick.d > R + 1 || m.length > 1;
    laterNum.push(() => { if (lead) leader(cx, cy, b, Math.max(0, R - 3)); label(octx, t, b[0] + 2, b[1] + H / 2, { size: 12, align: 'left' }); });
  }
}

function drawOver(now = performance.now()) {
  if (!IX) return;
  octx.clearRect(0, 0, W, W);
  const r = dotR();
  const litIdeas = new Set(st.ideasLit.map(a => a[0]));
  const showPeople = st.mode === 'person' || st.lit.length > 0 || (st.filter && st.filter.type === 'person');
  const usedPeople = new Set(), usedIdeas = new Set();
  for (const [i] of st.lit) {
    for (const pi of IX.episodes[EP[i]].people) if (IX.people[pi].x != null) usedPeople.add(pi);
    for (const ii of IX.passages.ideas[i]) if (IX.ideas[ii].x != null) usedIdeas.add(ii);
  }
  placed = []; later = []; laterNum = []; numHits = [];
  // which node marks show. A node whose spot is off the canvas (zoomed in) is not drawn, so its name never
  // floats over other dots. Idea mode, nothing lit: only ideas with a real patch (at least 1 in 5 dots around
  // the diamond carry the word).
  const ideaIdx = IX.ideas.map((d, i) => i).filter(i => IX.ideas[i].x != null && onCanvas(nodeXY(IX.ideas[i])) && (usedIdeas.has(i) || litIdeas.has(i) ||
    (st.filter && st.filter.type === 'idea' && st.filter.i === i) ||
    (st.mode === 'idea' && !st.lit.length && IX.ideas[i].n >= (N > 10000 ? 80 : 25) && (IX.ideas[i].own ?? 1) >= 0.2)));
  const peopleIdx = !showPeople ? [] : IX.people.map((p, pi) => pi).filter(pi => onCanvas(nodeXY(IX.people[pi])) &&
    !(st.lit.length && !usedPeople.has(pi) && st.mode !== 'person'));
  const nodes = [...peopleIdx.map(i => ({ kind: 'p', i })), ...ideaIdx.map(i => ({ kind: 'i', i }))];
  for (const n of nodes) [n.x, n.y] = nodeXY(n.kind === 'p' ? IX.people[n.i] : IX.ideas[n.i]);
  separate(nodes);
  const pos = new Map(nodes.map(n => [n.kind + n.i, [n.x, n.y]]));
  nodesXY = nodes.map(n => [n.x, n.y]);
  // cluster labels only when zoomed in (placed last, and only where they fit)
  const clusterLabels = [];
  if (st.z >= 2) {
    for (const c of IX.clusters) {
      const x = sx(c.x / 10000), y = sy(c.y / 10000);
      if (x < 0 || y < 0 || x > W || y > W) continue;
      const t = c.label.length ? c.label.slice(0, 2).map(i => shortLabel(IX.ideas[i].label)).join(' · ') : 'mixed talk';
      clusterLabels.push([t, x, y]);
    }
  }
  // 1) lines from lit dots to person nodes (solid) and idea nodes (dashed); stronger for higher scores
  for (const [i, s] of st.lit) {
    const px = sx(X[i]), py = sy(Y[i]), on = i === st.focus;
    octx.strokeStyle = C.glow;
    for (const pi of IX.episodes[EP[i]].people) {
      const q = pos.get('p' + pi) || nodeXY(IX.people[pi]); if (!q) continue;
      octx.globalAlpha = on ? 1 : lineAlpha(s); octx.lineWidth = on ? 2.5 : 1.25; octx.setLineDash([]);
      octx.beginPath(); octx.moveTo(px, py); octx.lineTo(q[0], q[1]); octx.stroke();
    }
    for (const ii of IX.passages.ideas[i]) {
      const q = pos.get('i' + ii) || nodeXY(IX.ideas[ii]); if (!q) continue;
      octx.globalAlpha = on ? 1 : lineAlpha(s) * 0.8; octx.lineWidth = on ? 2.5 : 1; octx.setLineDash([5, 4]);
      octx.beginPath(); octx.moveTo(px, py); octx.lineTo(q[0], q[1]); octx.stroke();
    }
  }
  octx.setLineDash([]); octx.globalAlpha = 1;
  // place: lit dots and node marks hold their room first, then numbers, then names
  const dotBox = new Map();
  for (const [i] of st.lit) { const x = sx(X[i]), y = sy(Y[i]); const b = [x - r - 4, y - r - 4, 2 * r + 8, 2 * r + 8]; placed.push(b); dotBox.set(i, b); }
  for (const n of nodes) placed.push([n.x - 9, n.y - 9, 18, 18]);
  if (st.num.size) placeNumbers(r, dotBox);
  // bigger people first, so the most populous names get the best spots; on a narrow map, family names only
  // (the legend and the list carry full names)
  const people = nodes.filter(n => n.kind === 'p').sort((a, b) => IX.people[b.i].n - IX.people[a.i].n);
  for (const n of people) { const name = IX.people[n.i].name; place(W < 520 ? name.split(' ').slice(-1)[0] : name, n.x, n.y); }
  const ideaShapes = [];
  const byHeat = nodes.filter(n => n.kind === 'i').sort((a, b) => (litIdeas.has(b.i) - litIdeas.has(a.i)) || IX.ideas[b.i].n - IX.ideas[a.i].n);
  for (const n of byHeat) {
    const hot = litIdeas.has(n.i);
    const named = place(shortLabel(IX.ideas[n.i].label), n.x, n.y, { size: 13, weight: hot ? 700 : 500, gap: 10, optional: !hot && !usedIdeas.has(n.i) });
    // an idle diamond with no room for its name is left out; one tied to a lit passage or the filter always shows
    if (!named && !usedIdeas.has(n.i) && !(st.filter && st.filter.type === 'idea' && st.filter.i === n.i)) continue;
    ideaShapes.push([n.x, n.y, hot]);
  }
  for (const [t, x, y] of clusterLabels) place(t, x, y, { size: 13, weight: 400, colour: C.muted, center: true, optional: true });
  // 2) node marks, under the lit dots
  for (const n of people) {
    octx.beginPath(); octx.arc(n.x, n.y, 7, 0, TAU);
    octx.fillStyle = personColour(n.i); octx.fill(); octx.lineWidth = 2; octx.strokeStyle = C.bg; octx.stroke();
    octx.lineWidth = 1; octx.strokeStyle = C.ink; octx.beginPath(); octx.arc(n.x, n.y, 8.5, 0, TAU); octx.stroke();
  }
  for (const [x, y, hot] of ideaShapes) {
    diamond(octx, x, y, hot ? 8 : 6);
    octx.fillStyle = C.bg; octx.fill(); octx.lineWidth = hot ? 3 : 1.5; octx.strokeStyle = hot ? C.glow : C.ink; octx.stroke();
  }
  // 3) lit dots: high and medium scores glow (3 pulses over ~5 s, then hold; a static halo with reduced motion);
  // low scores are rings. In Person mode the dot's core takes its person's colour. Painted last-ranked first,
  // so number one is never under another dot.
  let k = 0, animating = false;
  if (st.lit.length && !RM.matches) {
    const ph = (now - st.pulseStart) / 5000;
    if (ph < 1) { k = Math.sin(ph * 3 * Math.PI) ** 2; animating = true; }
  }
  for (let j = st.lit.length - 1; j >= 0; j--) {
    const [i, s] = st.lit[j], x = sx(X[i]), y = sy(Y[i]), b = band(s);
    if (b === 'low') {
      octx.beginPath(); octx.arc(x, y, r + 3, 0, TAU); octx.lineWidth = 3.5; octx.strokeStyle = C.bg; octx.stroke();
      octx.lineWidth = 2; octx.strokeStyle = C.glow; octx.stroke();
    } else {
      octx.beginPath(); octx.arc(x, y, (b === 'high' ? r + 5 + 7 * k : r + 4 + 3 * k), 0, TAU); octx.fillStyle = C.glowSoft; octx.fill();
      octx.beginPath(); octx.arc(x, y, r + 2.4, 0, TAU);
      octx.fillStyle = st.mode === 'person' ? personColour(PERSON[i]) : C.glow; octx.fill();
      octx.lineWidth = 2; octx.strokeStyle = C.glow; octx.stroke();
    }
  }
  // 4) names, then numbers, on top
  for (const f of later) f();
  for (const f of laterNum) f();
  if (st.focus >= 0) {
    const x = sx(X[st.focus]), y = sy(Y[st.focus]);
    octx.beginPath(); octx.arc(x, y, r + 8, 0, TAU); octx.lineWidth = 2.5; octx.strokeStyle = C.ink; octx.stroke();
  }
  cancelAnimationFrame(st.raf);
  if (animating) st.raf = requestAnimationFrame(drawOver);
}

// ------------------------------------------------------------------ light up
function light(lit, ideas = [], focus = -1, numbered = null) {
  st.lit = lit; st.litSet = new Set(lit.map(a => a[0])); st.ideasLit = ideas; st.focus = focus;
  st.num = new Map((numbered || []).map((i, k) => [i, k + 1]));
  st.pulseStart = performance.now();
  drawBase(); drawOver();
  over.setAttribute('aria-label', mapLabel());
}
function mapLabel() {
  const base = `Map of ${N.toLocaleString('en')} passages from ${IX.episodes.length} episodes, coloured by ${st.mode}.`;
  return st.lit.length ? `${base} ${st.lit.length} lit${st.num.size ? ', numbered as in the list' : ''}.` : base;
}
function announce(t) { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); }
function setFocus(i, scroll) {
  st.focus = i; drawOver();
  document.querySelectorAll('.row.on').forEach(r => r.classList.remove('on'));
  const row = [...document.querySelectorAll(`.row[data-i="${i}"]`)].find(r => !r.closest('[hidden]'));
  if (row) {
    row.classList.add('on');
    if (scroll) { st.quietUntil = performance.now() + 1000; row.scrollIntoView({ block: 'nearest', behavior: RM.matches ? 'auto' : 'smooth' }); }
  }
  return row;
}

// ------------------------------------------------------------------ result rows
function episodeWith(e) { return listNames(e.people.map(pi => IX.people[pi].name)); }
const hostsOf = e => e.hosts || IX.shows[e.show]?.hosts || [];
// "Ezra Klein with Jensen Huang": the host is named too, since a passage mixes host and guest.
// Most corpus-expansion episodes carry no guest name at all, so fall back to the host(s) alone, or
// "the episode" when neither is known.
function withLine(e) {
  const h = hostsOf(e), w = episodeWith(e);
  if (h.length && w) return `${listNames(h)} with ${w}`;
  if (h.length) return listNames(h);
  return w ? `the episode with ${w}` : 'the episode';
}
const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);
const listOr = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
// the time a row shows: the quote's start when it has one, else the passage's
const timeOf = i => (SN[i] ? SN[i].s : IX.passages.t0[i]);
function personHref(p) { return p.channel ? p.channel : '#person=' + encodeURIComponent(p.id); }
function ideaHref(d) { return d.glossary ? '../glossary/#' + encodeURIComponent(d.id) : '#idea=' + encodeURIComponent(d.id); }
function keyWords(i) { return KW && KW.p[i] ? KW.p[i].map(k => KW.vocab[k]) : []; }

function quoteHtml(i, sn, e) {
  const yt = ytUrl(e.vid, sn.s);
  const t = sn.t; let html = '', at = 0;
  const seg = (a, b) => a < b ? `<a href="${yt}" target="_blank" rel="noopener">${esc(t.slice(a, b))}</a>` : '';
  for (let [a, b, ii] of sn.m) {
    if (a < at) continue;
    while (a > at && /[\p{L}\p{N}]/u.test(t[a - 1])) a--;                // whole words only, even with older data
    while (b < t.length && /[\p{L}\p{N}]/u.test(t[b])) b++;
    html += seg(at, a);
    const d = IX.ideas[ii];
    html += `<a class="idea" href="${ideaHref(d)}" title="Idea: ${esc(d.label)} (draft tag)">${esc(t.slice(a, b))}</a>`;
    at = b;
  }
  html += seg(at, t.length);
  return `<p class="quote">“${html}”</p>`;
}

function row(i, score, num) {
  const P = IX.passages, e = IX.episodes[EP[i]], show = IX.shows[e.show] || { name: e.show };
  const sn = SN[i], t = sn ? sn.s : P.t0[i], b = band(score);
  const li = el('li', 'row'); li.dataset.i = i; li.tabIndex = -1;
  let h = '<div class="rowhead">';
  if (num) h += `<span class="rank" title="Number ${num} on the map">${num}</span>`;
  if (b) h += `<span class="score b-${b}">${b} score <span class="n">${score.toFixed(2)}</span></span>`;
  else if (score === null && st.view === 'keyword') h += '<span class="score">keyword match</span>';
  if (sn) h += `<span class="src">${capKind(e)} excerpt</span>`;
  h += '</div>';
  if (sn) {
    h += quoteHtml(i, sn, e);
    const hs = hostsOf(e);
    h += `<p class="who">Speaker not marked: could be ${esc(listOr([...hs.map(n => n + ' (host)'), ...e.people.map(pi => IX.people[pi].name)]))}.</p>`;
  } else h += '<p class="noq">No quote for this passage.</p>';
  const kw = keyWords(i);
  if (kw.length) h += `<p class="kw"><span class="kwl">Key words</span> ${kw.map(esc).join(' · ')}</p>`;
  h += `<p class="meta">${esc(cap1(withLine(e)))} · ${esc(show.name)} · ${esc((e.date || '').slice(0, 4))} · ${fmtT(t)}</p>`;
  h += `<div class="links"><button type="button" class="play">${SVG_PLAY} Watch here</button>`;
  h += `<a href="${ytUrl(e.vid, t)}" target="_blank" rel="noopener">YouTube at ${fmtT(t)} ${SVG_OUT}</a>`;
  const epu = e.url || show.url;
  if (epu) h += `<a href="${esc(epu)}" target="_blank" rel="noopener">${e.url ? 'Episode' : 'Show'} on ${esc(hostLabel(epu))} ${SVG_OUT}</a>`;
  h += '</div><div class="tags">';
  for (const pi of e.people) { const p = IX.people[pi]; h += `<a class="tag person" style="--c:${personColour(pi)}" href="${personHref(p)}">${esc(p.name)}</a>`; }
  for (const ii of P.ideas[i].slice(0, 4)) { const d = IX.ideas[ii]; h += `<a class="tag idea" href="${ideaHref(d)}">${esc(d.label)}</a>`; }
  h += '</div>';
  li.innerHTML = h;
  li.querySelector('.play').addEventListener('click', ev => openClip(ev.currentTarget, i, e, show));
  // highlight on a real mouse move or keyboard focus; not while a programmatic scroll slides rows under a still pointer
  li.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'mouse' && performance.now() > st.quietUntil && st.litSet.has(i) && st.focus !== i) setFocus(i, false);
  });
  li.addEventListener('focusin', () => { if (st.litSet.has(i) && st.focus !== i) setFocus(i, false); });
  return li;
}
function openClip(btn, i, e, show) {
  document.querySelectorAll('.clip').forEach(c => c._close());           // one clip at a time
  const P = IX.passages, links = btn.closest('.links');
  const box = el('div', 'clip');
  const f = el('iframe', 'player');
  // no autoplay: the player appears ready at the passage, and the viewer presses play
  // the player starts 2 s before the time the row shows (the quote's start, else the passage's)
  const t = timeOf(i);
  f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(e.vid)}?start=${Math.max(0, Math.floor(t) - 2)}&end=${Math.ceil(P.t1[i]) + 2}&rel=0`;
  f.title = `${show.name}, ${withLine(e)}, from ${fmtT(t)} (starts 2 seconds early)`;
  f.allow = 'encrypted-media; picture-in-picture'; f.allowFullscreen = true;
  const x = el('button', 'closeclip', 'Close the clip'); x.type = 'button';
  box._close = () => { box.remove(); btn.hidden = false; };
  x.addEventListener('click', () => { box._close(); btn.focus(); });
  box.append(f, x); links.after(box); btn.hidden = true; x.focus({ preventScroll: true });
}
function rows(list, numbered) {
  const ul = el('ul', 'rows');
  list.forEach(([i, s], k) => ul.append(row(i, s, numbered ? k + 1 : 0)));
  return ul;
}

// ------------------------------------------------------------------ views
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; $('#out').hidden = false; }
function resetOut(msg) { $('#out').innerHTML = msg === '' ? '' : `<p class="empty">${msg || 'Pick a question above, or tap any dot on the map.'}</p>`; }
function markChip(id) { document.querySelectorAll('#suggest button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id))); }
function hideVerdict() { const v = $('#verdict'); v.hidden = true; v.innerHTML = ''; }
function setHash(h) { if (location.hash !== h && !(h === '' && !location.hash)) history.pushState(null, '', h || location.pathname); }
// leaving a question: the question box, the chip and the verdict go too
function forgetQuestion() {
  st.qid = null; st.typed = null; st.last = null; $('#q').value = ''; markChip(null); hideVerdict();
  $('#share').hidden = true; $('#status').textContent = '';
}

function showResults(text, top, ideas, note) {
  closeSheet(); st.filter = null; markLegend();
  st.last = { text, top, ideas, note, qid: st.qid, typed: st.typed };
  const out = $('#out'); out.innerHTML = '';
  const scored = top.length && top[0][1] != null;
  const best = scored ? top[0][1] : 0;
  const nHM = top.filter(a => a[1] != null && a[1] >= 0.5).length, nLow = top.length - nHM;
  const shortQ = text.trim().split(/\s+/).length <= 6;
  const hd = el('h2', null, 'Closest passages'); hd.id = 'resultshead'; hd.tabIndex = -1; out.append(hd);
  out.append(el('p', 'lead', `To “${esc(text)}”, by the model’s score.`));
  if (note) out.append(el('p', 'caveat', esc(note)));
  let verdict;
  if (!scored) verdict = '';
  else if (nHM) verdict = `${nHM === top.length ? `All ${top.length}` : `${nHM} of ${top.length}`} passages scored high or medium (best ${best.toFixed(2)}).${nLow ? ` ${nLow} scored low: they are rings on the map and come last.` : ''}`;
  else verdict = `No passage scored high or medium for this wording (best ${best.toFixed(2)}). Either these episodes don’t discuss it, or this small model missed it; the page can’t tell which.${shortQ ? ' Short questions often score lower, so saying more may help.' : ' A different wording may help.'} The ${top.length} highest scores are below anyway, drawn as rings on the map.`;
  if (verdict) out.append(el('p', 'verdictlong', esc(verdict)));
  if (ideas.length) {
    const p = el('p', 'near-ideas', scored ? 'Ideas near your question (idea score 0.35 or more, a looser line than the 0.50 for passages): ' : 'Idea names matching your words: ');
    ideas.forEach(([ii, s], k) => {
      const a = el('a', null, esc(IX.ideas[ii].label)); a.href = ideaHref(IX.ideas[ii]); p.append(a);
      if (scored) p.append(` ${s.toFixed(2)}`);
      if (k < ideas.length - 1) p.append(', ');
    });
    out.append(p);
  }
  if (top.some(([i]) => !SN[i])) out.append(el('p', 'caveat', 'Most passages have no quote: quotes are capped (see “Quotes and key words”, further down). Every passage shows its key words, picked by counting, and links to its moment in the video.'));
  const ul = rows(top, true);
  if (nHM && nLow) { const lh = el('li', 'lowhead', '<h3>Low scores</h3>'); ul.insertBefore(lh, ul.children[nHM]); }
  out.append(ul);
  light(top, ideas, -1, top.map(a => a[0]));
  // the short verdict sits under the question, so a phone visitor sees it without scrolling
  const v = $('#verdict'); v.innerHTML = '';
  const short = !scored ? `${top.length} passages lit by keyword match.`
    : nHM ? `${nHM} of ${top.length} lit passages scored high or medium (best ${best.toFixed(2)}).`
    : `No high or medium scores (best ${best.toFixed(2)}). The episodes may not cover this, or the model missed it.${shortQ ? ' Short questions often score lower: saying more may help.' : ''}`;
  v.append(el('p', null, esc(short)));
  const go = el('button', 'readbtn', `${SVG_DOWN} Read the ${top.length} passages`); go.type = 'button';
  go.addEventListener('click', () => { const h = $('#resultshead'); if (h) { h.scrollIntoView({ block: 'start', behavior: RM.matches ? 'auto' : 'smooth' }); h.focus({ preventScroll: true }); } });
  v.append(go); v.hidden = false;
  announce(scored ? `${short} ${top.length} passages lit, numbered as in the list; the first is from ${withLine(IX.episodes[EP[top[0][0]]])}.` : short);
}

function askSuggested(id, push) {
  const q = IX.questions.find(x => x.id === id); if (!q) return false;
  st.view = 'question'; st.qid = id; st.typed = null; $('#q').value = q.text; $('#share').hidden = true;
  markChip(id);
  showResults(q.text, q.top, q.ideas || []);
  if (push) setHash('#q=' + id);
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
  status.textContent = 'Downloading the model…';
  try {
    search = await import('./search.js?v=7');
    await search.load(p => {
      if (p.status === 'progress' && p.total) {
        prog[p.file] = [p.loaded, p.total];
        const [a, b] = Object.values(prog).reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
        // the counts cover the model files only; the runtime (about 5 MB) loads after them
        status.textContent = a >= b ? 'Model files downloaded. Starting the model (one more download)…' : `Downloading the model… ${Math.round(100 * a / b)}%`;
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
  if (!IX) { $('#status').textContent = 'The map is still loading. Try again in a moment.'; return; }
  const sug = IX.questions.find(q => q.text.toLowerCase() === text.toLowerCase());
  if (sug) return askSuggested(sug.id, true);
  st.view = 'question'; st.qid = null; st.typed = text; st.last = null; markChip(null);
  setHash('');                     // the address bar no longer names an older question; Share puts this one there
  // the old answer goes at once, so it never sits under the new question while the model downloads
  closeSheet(); hideVerdict(); $('#share').hidden = true; light([]);
  resetOut(`Lighting up the passages closest to “${esc(text)}”…`);
  const ok = await ensureModel(fromButton);
  if (!ok) {
    if (modelState !== 'failed') { resetOut(`Press Load above to download the model and ask “${esc(text)}”.`); return; }
    const r = keywordFallback(text);
    if (!r.top.length) { closeSheet(); hideVerdict(); resetOut(`No idea name matches “${esc(text)}”, and the model did not load. Try a suggested question.`); light([]); return; }
    st.view = 'keyword';
    showResults(text, r.top, r.ideas, 'The model did not load, so this matched your words against idea names instead. These are keyword matches, not scores.');
    return;
  }
  const r = await search.query(text);
  showResults(text, r.top, r.ideas);
  $('#share').hidden = false;
  $('#status').textContent = `Answered in ${r.ms.embed + r.ms.search} ms, inside your browser.`;
}

function showPassage(i, push) {
  st.view = 'passage'; markChip(null);
  const sheet = $('#sheet'); sheet.innerHTML = '';
  const head = el('div', 'panelhead', '<h2>This passage</h2>');
  const x = el('button', null, st.last ? 'Back to the question' : 'Close'); x.type = 'button';
  x.addEventListener('click', () => { closePassage(); over.focus(); });
  head.append(x); sheet.append(head);
  sheet.append(rows([[i, null]], false));
  sheet.append(el('h3', null, 'Passages like this one'));
  const nn = Array.from(NN.subarray(i * 6, i * 6 + 6));
  sheet.append(rows(nn.map(j => [j, null]), true));
  const same = nn.filter(j => EP[j] === EP[i]).length, eps = new Set(nn.map(j => EP[j])).size;
  sheet.append(el('p', 'caveat', `Neighbours by the model’s 384 numbers, numbered on the map. The flat map keeps only rough neighbourhoods, so they can sit far apart on it. ${same === 6 ? 'All six come from the same episode.' : `${same ? numWord(same)[0].toUpperCase() + numWord(same).slice(1) : 'None'} of the six come${same === 1 ? 's' : ''} from the same episode; together they come from ${numWord(eps)} episode${eps > 1 ? 's' : ''}.`}`));
  sheet.hidden = false; $('#out').hidden = true; hideVerdict();
  light([[i, null], ...nn.map(j => [j, null])], [], i, nn);
  setFocus(i, false);
  const e = IX.episodes[EP[i]];
  if (push) history.pushState(null, '', `#p=${e.vid}:${Math.floor(IX.passages.t0[i])}`);
  announce(`Passage from ${withLine(e)} at ${fmtT(timeOf(i))}; the 6 like it are lit and numbered.`);
  sheet.querySelector('.row').focus({ preventScroll: true });
}
// closing a tapped passage returns to the question it was opened from, or to the whole map
function closePassage() {
  const L = st.last;
  if (L) {
    closeSheet(); st.view = 'question'; st.qid = L.qid; st.typed = L.typed;
    if (L.qid) { markChip(L.qid); setHash('#q=' + L.qid); } else setHash('');
    $('#q').value = L.text;
    showResults(L.text, L.top, L.ideas, L.note);
  } else clearAll();
}

function showPerson(pi) {
  const p = IX.people[pi]; closeSheet(); forgetQuestion();
  st.view = 'person'; st.filter = { type: 'person', i: pi }; light([]); markLegend();
  const eps = IX.episodes.filter(e => e.people.includes(pi));
  const out = $('#out'); out.innerHTML = '';
  const head = el('div', 'panelhead', `<h2>${esc(p.name)}</h2>`);
  head.append(clearBtn()); out.append(head);
  out.append(el('p', 'lead', `${p.n.toLocaleString('en')} passages from ${eps.length} episode${eps.length > 1 ? 's' : ''} with ${esc(p.name)}. The map shows only these. A passage mixes host and guest, and the captions don’t say who is speaking.`));
  const ul = el('ul', 'eplist');
  for (const e of eps) {
    const s = IX.shows[e.show] || {};
    let h = `${esc(s.name || e.show)}${hostsOf(e).length ? ', hosted by ' + esc(listNames(hostsOf(e))) : ''} · ${esc(e.date || '')} · `;
    h += e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)} ${SVG_OUT}</a> <span class="host">(${esc(hostLabel(e.url))})</span>` : esc(e.title);
    h += ` · <a href="${ytUrl(e.vid, 0)}" target="_blank" rel="noopener">video ${SVG_OUT}</a>`;
    ul.append(el('li', null, h));
  }
  out.append(ul);
  const some = [];
  for (let i = 0; i < N && some.length < 6; i++) if (SN[i] && IX.episodes[EP[i]].people.includes(pi)) some.push([i, null]);
  if (some.length) { out.append(el('h3', null, 'Some moments')); out.append(rows(some, false)); }
  announce(`Showing ${p.n} passages from episodes with ${p.name}.`);
}

function showIdea(ii) {
  const d = IX.ideas[ii]; closeSheet(); forgetQuestion();
  st.view = 'idea'; st.filter = { type: 'idea', i: ii }; light([]); markLegend();
  const out = $('#out'); out.innerHTML = '';
  const head = el('div', 'panelhead', `<h2>${esc(d.label)}</h2>`); head.append(clearBtn()); out.append(head);
  const cav = d.precision === 'high' ? 'keyword match; most hits are on topic' : 'keyword match; some hits are off-topic';
  out.append(el('p', 'caveat', `Draft tag (${cav}). ${d.n.toLocaleString('en')} passages carry it; the map shows only these.`));
  if (d.glossary) out.append(el('p', null, `<a href="../glossary/#${encodeURIComponent(d.id)}">In the glossary</a>`));
  const P = IX.passages, pick = [];
  for (const withSnip of [true, false]) for (let i = 0; i < N && pick.length < 8; i++)
    if (!!SN[i] === withSnip && !pick.some(a => a[0] === i) && P.ideas[i].includes(ii)) pick.push([i, null]);
  out.append(rows(pick, false));
  announce(`Showing ${d.n} passages tagged ${d.label}.`);
}
function clearBtn() { const b = el('button', null, 'Show the whole map'); b.type = 'button'; b.addEventListener('click', () => { clearAll(); }); return b; }

function clearAll(keepHash) {
  st.filter = null; st.view = 'none';
  forgetQuestion();
  closeSheet(); resetOut(); markLegend(); light([]);
  if (!keepHash) setHash('');
}
function unknownLink(msg) {
  clearAll(true);
  resetOut(esc(msg || 'This link points to something that is not on this map.') + ' Pick a question above, or tap any dot.');
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
    if (oth.length) {
      let n = 0; for (let i = 0; i < N; i++) if (IX.lanes.some((l, li) => l.colour == null && ((LANESETS[i] >> li) & 1))) n++;
      its.push({ key: 'lo', name: 'Other ideas', colour: C.other, n, f: { type: 'otherlane' } });
    }
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
    if (it.n != null) b.setAttribute('aria-label', `${it.name}, ${it.n} passages`);
    b.addEventListener('click', () => {
      const same = st.filter && JSON.stringify(st.filter) === JSON.stringify(it.f);
      if (same) { clearAll(); return; }
      if (it.f.type === 'person') { history.pushState(null, '', it.hash); showPerson(it.f.i); return; }
      forgetQuestion(); setHash('');
      st.view = 'filter'; st.filter = it.f; closeSheet(); light([]); markLegend();
      resetOut(`Showing ${esc(it.name)} only. Tap the chip again to show everything.`);
    });
    li.append(b); ul.append(li);
  }
  markLegend();
  const note = $('#legendnote'), key = $('#lanekey');
  if (st.mode === 'person') {
    note.textContent = 'Numbers count passages. Tap a name to show only that person’s episodes.';
    key.hidden = true;
  } else if (st.mode === 'idea') {
    note.textContent = 'Numbers count passages with at least one idea word from the group, so a passage with words from two groups counts in both. Its dot takes the colour of the group holding most of its idea words. The groups come from a draft list.';
    const ul2 = $('#lanelist'); ul2.innerHTML = '';
    IX.lanes.forEach((l, li) => {
      const ideas = IX.ideas.filter(d => d.lane === l.id && d.n).sort((a, b) => b.n - a.n);
      ul2.append(el('li', null, `<span class="sw" style="background:${slotColour(l.colour)}"></span><b>${esc(l.label)}</b>: ${ideas.map(d => `${esc(shortLabel(d.label))} ${d.n}`).join(', ')}`));
    });
    key.hidden = false;
  } else { note.textContent = ''; key.hidden = true; }
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
  const hosts = new Set();
  for (const [e] of eps) {
    const s = IX.shows[e.show] || { name: e.show };
    const tr = el('tr');
    let ep = e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a> <span class="host">(${esc(hostLabel(e.url))})</span>` : esc(e.title);
    if (e.url) hosts.add(/apple|spotify/i.test(hostLabel(e.url)) ? hostLabel(e.url) : 'site');
    ep += ` · <a href="${ytUrl(e.vid, 0)}" target="_blank" rel="noopener">video</a>`;
    tr.innerHTML = `<td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</td>` +
      `<td>${ep}</td><td>${esc(cap1(withLine(e)))}</td><td>${esc(e.date || '')}</td><td>${esc(capKind(e).replace('caption', 'captions'))}</td><td class="num">${e.n.toLocaleString('en')}</td>`;
    tb.append(tr);
  }
  for (const x of IX.excluded || []) {
    const tr = el('tr'); tr.innerHTML = `<td colspan="6">Not included: <a href="${ytUrl(x.vid, 0)}" target="_blank" rel="noopener">${esc(x.vid)}</a> (${esc(x.why)})</td>`; tb.append(tr);
  }
  const where = [...hosts].map(h => h === 'site' ? "the show's own site" : h);
  const nytNames = [...new Set(IX.episodes.map(e => IX.shows[e.show]).filter(s => s?.nyt).map(s => s.name))];
  const nytLine = nytNames.length
    ? ` ${listNames(nytNames)} ${nytNames.length > 1 ? 'are' : 'is a'} New York Times show${nytNames.length > 1 ? 's' : ''}, so ${nytNames.length > 1 ? 'their' : 'its'} quotes stop at 15 words.`
    : '';
  $('#sourceslead').textContent = `Every episode on the map (${IX.episodes.length}), linked to where it is published (${listNames(where)}) and to its video, with the kind of captions it came from.` + nytLine;
}

// ------------------------------------------------------------------ hash
function safeApplyHash() {
  try { applyHash(); } catch (err) { console.warn('bad link', err); unknownLink('This link could not be read.'); }
}
function applyHash() {
  let h;
  try { h = decodeURIComponent(location.hash.slice(1)); }
  catch { unknownLink('This link could not be read (it has a stray % sign).'); return; }
  const [k, ...rest] = h.split('='); const v = rest.join('=');
  if (!h) {
    if (st.view === 'passage' && st.last) { closePassage(); return; }
    if (st.view !== 'none' && st.view !== 'question' && st.view !== 'keyword') clearAll(true);
    if (st.view === 'question' && st.qid) clearAll(true);
    return;
  }
  if (k === 'q') { if (askSuggested(v, false)) return; unknownLink('That suggested question is not on this map.'); return; }
  if (k === 'p') {
    const [vid, t] = [v.slice(0, v.lastIndexOf(':')), +v.slice(v.lastIndexOf(':') + 1)];
    const ei = IX.episodes.findIndex(e => e.vid === vid);
    let best = -1, bd = 1e9;
    if (ei >= 0 && isFinite(t)) for (let i = 0; i < N; i++) if (EP[i] === ei) { const d = Math.abs(IX.passages.t0[i] - t); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { showPassage(best, false); return; }
    unknownLink('That passage is not on this map.'); return;
  }
  if (k === 'person') { const pi = IX.people.findIndex(p => p.id === v); if (pi >= 0) { showPerson(pi); return; } unknownLink('That person is not on this map.'); return; }
  if (k === 'idea') { const ii = IX.ideas.findIndex(d => d.id === v); if (ii >= 0) { showIdea(ii); return; } unknownLink('That idea is not on this map.'); return; }
  if (k === 'ask' && v) {
    clearAll(true);
    $('#q').value = v; $('#modelnote').hidden = false;
    $('#status').textContent = 'A shared question. Press Light up (it downloads the model once) to ask it.';
    return;
  }
  unknownLink();
}

// ------------------------------------------------------------------ input: map
function hit(px, py) {
  // a tapped number opens the first passage it names
  for (const h of numHits) { const b = h.b; if (px >= b[0] - 4 && px <= b[0] + b[2] + 4 && py >= b[1] - 4 && py <= b[1] + b[3] + 4) return h.i; }
  // any lit dot within reach beats every unlit one; among lit dots on top of each other, the higher-ranked
  // (painted on top) wins unless another is clearly nearer
  let li = -1, ld = 16 * 16;
  for (const [i] of st.lit) { const d = (sx(X[i]) - px) ** 2 + (sy(Y[i]) - py) ** 2; if (d < ld - (li < 0 ? 0 : 6)) { ld = d; li = i; } }
  if (li >= 0) return li;
  const x = dx(px), y = dy(py), rr = 14 / (inner() * st.z);
  let best = -1, bd = rr * rr;
  const x0 = Math.floor((x - rr) * GRID), x1 = Math.floor((x + rr) * GRID), y0 = Math.floor((y - rr) * GRID), y1 = Math.floor((y + rr) * GRID);
  for (let gy = Math.max(0, y0); gy <= Math.min(GRID - 1, y1); gy++)
    for (let gx = Math.max(0, x0); gx <= Math.min(GRID - 1, x1); gx++)
      for (const i of grid[gx + GRID * gy]) {
        const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2;
        if (d < bd) { bd = d; best = i; }
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
  if (st.litSet.has(i) && (st.view === 'question' || st.view === 'keyword')) { const r = setFocus(i, true); if (r) r.focus({ preventScroll: true }); return; }
  showPassage(i, true);
}
over.addEventListener('keydown', e => {
  const lit = st.lit.map(a => a[0]);
  if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key) && lit.length) {
    e.preventDefault();
    const k = lit.indexOf(st.focus), step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const i = lit[(k + step + lit.length) % lit.length];
    setFocus(i, true);
    const ep = IX.episodes[EP[i]], sn = SN[i], n = st.num.get(i), kw = keyWords(i);
    announce(`${n ? 'Number ' + n : 'The tapped passage'}: from ${withLine(ep)}, ${fmtT(timeOf(i))}.${sn ? ' Quote, speaker not marked: ' + sn.t : kw.length ? ' Key words: ' + kw.join(', ') + '.' : ''}`);
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
  st.mode = r.value;
  if (st.filter && ['lane', 'untagged', 'otherlane', 'otherperson'].includes(st.filter.type)) { st.filter = null; if (st.view === 'filter') { st.view = 'none'; resetOut(); } }
  buildLegend(); setCaption(); drawBase(); drawOver(); over.setAttribute('aria-label', mapLabel());
}));
$('#q').addEventListener('focus', () => { if (modelState !== 'ready') $('#modelnote').hidden = false; });
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
  else if (e.key === 'Escape') { if (!$('#sheet').hidden && st.last) closePassage(); else clearAll(); }
});
const retheme = () => { readColours(); if (IX) { buildLegend(); drawBase(); drawOver(); } };
DARKQ.addEventListener('change', retheme);
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
RM.addEventListener('change', () => drawOver());

boot().catch(err => { console.error(err); resetOut('The map data did not load. Try reloading the page.'); });
