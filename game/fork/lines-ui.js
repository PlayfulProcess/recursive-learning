// The Fork, six-lines view: the I Ching path game on the same walk as the tree view (index.html).
// One walk, one URL hash (#f1;...), one engine (fork-engine.js), one renderer (reached only through tree-adapter.js).
// Lines 1 to 5 are the tree's questions (1 and 2 together are the gate); line 6 is the page's own reading, never drawn. Each line
// is decided (yes is a firm line, no a yielding one; held loosely it could flip), drawn from a fresh bowl of 16
// marbles (the yarrow bowl or the coin bowl), or left open with "I don't know". Every draw plays the renderer's own
// cast at the matching node; the bowl here is static, the drawn marble ringed.
// Then: the relating reading (turning lines flip one at a time, bottom to top, each naming the real hexagram it
// passes through) and Walk to a leaf (the path caster's direct mode, flipping only lines 3 and 4, each flip saying
// what you would have to come to believe).
// The bowl, hexagram and path maths are copies in bowl.js. The landing, either-way and one-at-a-time sheets repeat
// fork-ui.js's in this view's words (fork-ui.js runs its own page on import, so it cannot be shared as it stands).
// No percent sign in this file: odds are words or "N in M".
import { renderTree, NODES, leafFor, SOURCE } from './tree-adapter.js';
import * as E from './fork-engine.js';
import * as B from './bowl.js';

const EXPLAINER = '../../explainers/risk-and-uncertainty/';
const GRAMMAR = 'https://iching.recursive.eco/grammars/zhouyi-core/grammar.json';
const HOLD = 250, SAFETY = 2200, PATH_SALT = 0x3C6EF372;
const DRAWS = ['yarrow', 'coins'];
const BOWL = { yarrow: B.START.yarrow, coins: B.START.coins, coin: { 6: 0, 7: 1, 8: 1, 9: 0 } };
const SAYS = { yarrow: 'the yarrow bowl', coins: 'the coin bowl', coin: 'the coin' };
const BTN = { yarrow: 'Yarrow bowl', coins: 'Coin bowl' };
const BTN_LONG = { yarrow: 'Draw from the yarrow bowl', coins: 'Draw from the coin bowl (three coins)' };
const HEAD = { yarrow: 'The yarrow bowl: 16 marbles, a fresh bowl each draw', coins: 'The coin bowl: three coins’ odds as 16 marbles, a fresh bowl each draw', coin: 'One coin: two sides' };
const T = {
  hello: "Build a hexagram, the I Ching's figure of six stacked lines, from the bottom up: yes is a solid (firm) line, no a broken (yielding) one. Decide each line, draw it from a bowl, or say I don't know.",
  relatingHonest: 'In the tradition all turning lines change at once; walking them one at a time is ours (from the Recursive I Ching’s path caster).',
  mustBelieve: "To get here you'd have to come to believe (or someone would have to show): ",
  notMind: 'That is a change in the landing, not a change of mind.',
  already: "You're already there.",
  noneTurning: 'No line is turning. The hexagram stands; the tradition reads only its judgment.',
  line6Waits: 'Line 6 waits for a leaf: alignment (line 3) and containment (line 4) each need a yes or a no, yours or drawn.',
  flipShows: 'A flip in a reading shows nothing about the world: it only asks what would follow.',
  pathRule: 'The path flips only lines 3 and 4. Lines 1, 2 and 5 stay as they are; line 6, our reading, is read again after each flip.',
  pathIs: 'Each flip names what you would have to come to believe. A path of beliefs, not a forecast.',
  noNotes: "The notes on each leaf didn't load, so line 6 can't be read.",
  legge: 'Judgment and line texts: James Legge (tr.), 1882, public domain; hexagram names as in the Wilhelm/Baynes translation (1950); both read from the Recursive I Ching.'
};

const $ = id => document.getElementById(id);
const treeEl = $('tree'), hexEl = $('hex'), hexNameEl = $('hexname'), captionEl = $('caption'), panelEl = $('panel'), skipEl = $('skip');
const sheet = $('sheet'), sheetIn = $('sheet-in');
const params = new URLSearchParams(location.search);
const oneOf = (v, ok, d) => (ok.includes(v) ? v : d);

const ui = {
  walk: null, line: 0, tapped: null, loose: false,
  bowl: ({ coin: 'coins', coins: 'coins', yarrow: 'yarrow' })[params.get('method')] || 'yarrow',
  peek: null, last: null,
  casting: null, token: 0, playing: null,
  theme: oneOf(params.get('theme'), ['dark', 'light', 'auto'], 'dark'),
  leafActions: null, texts: undefined, more: false,
  path: null   // { type: 'relating'|'leaf', leaf, steps, k }
};

// ── small helpers ───────────────────────────────────────────────────────────────────────────────
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nm = leaf => E.leafName(leaf, NODES);
const say = t => { captionEl.textContent = t; };
function why(anchor, text) { return h('a', { href: EXPLAINER + '#' + anchor, target: '_blank', rel: 'noopener' }, text || 'why?'); }
function chips(labels, hi) { return h('div', { class: 'chipset' }, labels.map(x => h('span', { class: 'chip' + (hi && x === hi ? ' this' : '') }, x))); }
async function getJSON(u) { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function svgNode(markup, cls) { const s = h('span', { class: cls || 'hexmini', 'aria-hidden': 'true' }); s.innerHTML = markup; return s; }
const lines5 = () => [0, 1, 2, 3, 4];
function lineWord(i) { return 'Line ' + (i + 1) + ', ' + B.PLACES[i].nm; }
function where(i) { return lineWord(i) + (i < 2 ? ' (the gate, ' + (i + 1) + ' of 2)' : ''); }
function numWords(list) { return (list.length === 1 ? 'line ' : 'lines ') + E.listWords(list.map(i => String(i + 1))); }

// ── the six kinds: lines 1 to 5 from the walk (0 while open), line 6 our reading for the leaf ─────────────
const yn = k => (B.isFirm(k) ? 'yes' : 'no');
// leafFor is only ever asked with alignment and containment both yes or no (the gate and the race ride along)
function leafOf(k5, w = ui.walk) {
  if (!k5[2] || !k5[3]) return null;
  return leafFor({ ...E.answersOf(w), alignment: yn(k5[2]), containment: yn(k5[3]) }) || null;
}
function line6Kind(k5, w = ui.walk) {
  const leaf = leafOf(k5, w), la = ui.leafActions;
  if (!leaf || !la) return 0;
  const l6 = E.line6For(leaf, la, null);
  return l6 ? l6.kind : 0;
}
// line 6's sentence for the leaf lines 1 to 5 of `kinds` lead to, with the line's kind as it now stands
function l6Words(kinds, kind) {
  const leaf = leafOf(kinds), la = ui.leafActions;
  const l6 = leaf && la ? E.line6For(leaf, la, null) : null;
  return E.line6Sentence({ ...(l6 || {}), kind: kind == null ? kinds[5] : kind });
}
function l6Short(k) { return B.isFirm(k) ? 'firm: rules aim at the main danger' : 'yielding: no lever known to work'; }
function walkKinds(w) {
  const k = w.lines.map(l => (l.answer === 'yes' || l.answer === 'no' ? l.kind : 0));
  k.push(line6Kind(k, w));
  return k;
}
function leafAnswers(leaf) {
  const base = E.answersOf(ui.walk);
  for (const a of ['yes', 'no']) for (const c of ['yes', 'no']) if (leafFor({ ...base, alignment: a, containment: c }) === leaf) return { alignment: a, containment: c };
  return null;
}
function pathSeed(w) { return (Math.imul(w.seed, 0x9E3779B1) ^ Math.imul(w.n + 1, 0x85EBCA6B) ^ PATH_SALT) >>> 0; }
function hexTitle(kinds) {
  const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null;
  return hx ? [hx[0] + '. ' + hx[1], h('small', null, ' ' + hx[3] + ' ' + hx[2])] : 'an unfinished hexagram';
}
function hexName(kinds) { const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null; return hx ? hx[0] + '. ' + hx[1] : 'an unfinished hexagram'; }

// ── drawing ────────────────────────────────────────────────────────────────────────────────────
function stepNow() { return ui.path ? ui.path.steps[ui.path.k] : null; }
// the walk the tree shows: yours, or yours with the lines a reading or a path has turned so far
function shownWalk() {
  const st = stepNow();
  if (!st) return ui.walk;
  const w = E.cloneWalk(ui.walk);
  for (let i = 0; i < 5; i++) {
    const k = st.kinds[i], l = w.lines[i];
    if (!k || l.kind === k) continue;
    const ans = yn(k);
    w.lines[i] = { answer: ans, how: ui.path.type === 'leaf' && ans !== l.answer ? 'decide' : l.how, kind: k };
  }
  return w;
}
function draw(opts) {
  skipEl.hidden = !ui.playing;
  renderTree(treeEl, E.toTreeState(shownWalk(), { focus: null, people: [], casting: ui.casting, theme: ui.theme }), opts || { animate: true });
  renderHex();
  renderPanel();
  renderViews();
  writeHash();
}
function turnedSoFar() { const P = ui.path; return P ? P.steps.slice(1, P.k + 1).map(s => s.flipped) : []; }
function slotTag(i, k) {
  if (turnedSoFar().includes(i)) return 'turned';
  if (i === 5) return k ? 'our reading' : '';
  const l = ui.walk.lines[i];
  if (l.answer == null) return '';
  if (l.how === 'unknown') return 'open';
  if (E.isDevice(l.how)) return 'cast';
  return 'yours';
}
function slotLabel(i, k, tag) {
  let s = lineWord(i) + ', ' + (i < 5 ? E.QUESTIONS[i].short.toLowerCase() : 'is a lever known to work? our reading, never cast') + ': ';
  if (!k) s += i === 5 ? 'waits for a leaf' : ui.walk.lines[i].answer === 'unknown' ? "I don't know, open" : 'not yet asked';
  else s += (i === 5 ? l6Short(k) : yn(k) + ', ' + (B.isFirm(k) ? 'a firm line' : 'a yielding line')) + (B.isTurning(k) ? ', turning: it could flip' : '');
  if (tag === 'cast') s += ', ' + E.TEXT.castTag;
  else if (tag === 'yours') s += ', your answer';
  else if (tag === 'turned') s += ', turned in this reading';
  return s;
}
function renderHex() {
  const st = stepNow(), kinds = st ? st.kinds : walkKinds(ui.walk);
  const a = document.activeElement, key = a && hexEl.contains(a) ? a.getAttribute('data-k') : null;
  const busy = !!ui.playing || !!ui.path;
  hexEl.textContent = '';
  for (let i = 0; i < 6; i++) {
    const k = kinds[i], tag = slotTag(i, k), unknown = i < 5 && !k && ui.walk.lines[i].answer === 'unknown';
    const cls = 'slot' + (!k ? (unknown ? ' unknown' : ' empty') : B.isFirm(k) ? ' yes' : ' no') +
      (!ui.path && ui.line === i ? ' now' : '') + (st && st.flipped === i ? ' hl' : '') + (i === 5 ? ' top' : '');
    const ln = h('span', { class: 'ln', 'aria-hidden': 'true' }, k ? (B.isFirm(k) ? h('i', { class: 'bar' }) : [h('i', { class: 'bar' }), h('i', { class: 'bar' })]) : unknown ? '?' : '');
    hexEl.append(h('button', { class: cls, 'data-k': 'slot' + i, 'aria-label': slotLabel(i, k, tag), 'aria-current': !ui.path && ui.line === i ? 'step' : null, disabled: busy, onclick: () => setLine(i) },
      h('span', { class: 'n', 'aria-hidden': 'true' }, String(i + 1)), ln,
      h('span', { class: 'mk', 'aria-hidden': 'true' }, B.isTurning(k) ? (k === 9 ? '○' : '×') : ''),
      h('span', { class: 'tg' + (tag === 'cast' ? ' cast' : ''), 'aria-hidden': 'true' }, tag)));
  }
  hexNameEl.textContent = '';
  if (B.isWhole(kinds)) {
    const hx = B.hexOf(B.bits(kinds)), n = kinds.filter(B.isTurning).length;
    hexNameEl.append(h('b', null, hx[0] + '. ' + hx[1]), ' ' + hx[3], h('br'), n ? n + ' turning' : 'none turning');
  } else {
    const n = kinds.filter(Boolean).length;
    hexNameEl.append(n + ' of 6 lines set. ', n ? '' : 'Line 1 is at the bottom.');
  }
  if (key) { const again = hexEl.querySelector('[data-k="' + key + '"]'); if (again && !again.disabled) again.focus({ preventScroll: true }); }
}
function renderPanel() {
  const a = document.activeElement;
  const key = a && panelEl.contains(a) ? a.getAttribute('data-k') : null;
  panelEl.textContent = '';
  panelEl.append(ui.path ? (ui.path.type === 'relating' ? relatingPanel() : leafPanel()) : ui.line === 5 ? topPanel() : linePanel(ui.line));
  if (key) { const again = panelEl.querySelector('[data-k="' + key + '"]'); if (again && !again.disabled) again.focus({ preventScroll: true }); }
}
function treeHref(extra) {
  const sp = new URLSearchParams(location.search);
  if (extra && extra.focus) sp.set('focus', extra.focus);
  if (ui.theme !== 'dark') sp.set('theme', ui.theme); else sp.delete('theme');
  const q = sp.toString();
  return './' + (q ? '?' + q : '') + E.encodeHash(ui.walk);
}
function renderViews() { const a = $('to-tree'); if (a) a.setAttribute('href', treeHref()); }
function writeHash() { const hash = E.encodeHash(ui.walk); if (location.hash !== hash) history.replaceState(null, '', hash); }

// ── the panel: one line ────────────────────────────────────────────────────────────────────────
function moreBtn() {
  return h('button', { class: 'linkish more', 'data-k': 'more', 'aria-expanded': String(ui.more), onclick: () => { ui.more = !ui.more; renderPanel(); } }, ui.more ? 'less' : 'more');
}
function kicker(text) { return h('p', { class: 'kicker' }, h('span', null, text), moreBtn()); }
function linePanel(i) {
  const Q = E.QUESTIONS[i], l = ui.walk.lines[i], busy = !!ui.playing, own = l.how === 'decide';
  const loose = own ? E.isTurning(l.kind) : ui.loose;
  const peek = ui.peek || ui.bowl;
  const ans = a => h('div', { class: 'ans' },
    h('button', { 'data-k': 'ans-' + a, 'aria-pressed': own && l.answer === a ? 'true' : 'false', disabled: busy, onclick: () => doDecide(i, a) },
      a === 'yes' ? 'Yes · firm' : 'No · yielding'),
    h('p', { class: 'believe' }, "you'd have to believe " + Q.believe[a]));
  return h('div', null,
    kicker('Line ' + (i + 1) + ' of 6 · ' + B.PLACES[i].nm + (i < 2 ? ' · gate ' + (i + 1) + ' of 2' : '')),
    h('h2', null, Q.ask),
    h('div', { class: 'answers' + (ui.more ? '' : ' clamp') }, ans('yes'), ans('no')),
    h('p', { class: 'loose-row' }, h('button', { class: 'linkish', 'data-k': 'loose', 'aria-pressed': String(loose), disabled: busy, onclick: () => toggleLoose(i) },
      loose ? (own ? 'held loosely: it could flip · hold it steady' : 'next answer held loosely: it could flip · hold it steady') : 'hold it loosely: it could flip')),
    bowlBlock(peek),
    h('div', { class: 'casts' },
      DRAWS.map(m => h('button', { 'data-k': 'draw-' + m, 'aria-label': BTN_LONG[m], disabled: busy, onclick: () => doDraw([i], m), onfocus: () => setPeek(m), onmouseenter: () => setPeek(m) }, BTN[m])),
      h('button', { class: 'idk', 'data-k': 'idk', 'aria-pressed': l.how === 'unknown' ? 'true' : 'false', disabled: busy, onclick: () => doUnknown(i) }, "I don't know")),
    h('p', { class: 'mlabel', id: 'mlabel' }, E.METHODS[peek].label + ' ', why(E.METHODS[peek].anchor)),
    lineStatus(i),
    ui.more ? h('p', { class: 'small' }, B.PLACES[i].tr + ' The reading of the six places as these questions is this page’s own.') : null,
    foot());
}
function bowlBlock(m) {
  const last = ui.last && ui.last.method === m ? ui.last : null;
  const b = BOWL[m], box = h('div', { class: 'bowl' + (m === 'coin' ? ' two' : ''), role: 'img' });
  B.renderBowl(box, b, null, last ? last.index : undefined);
  box.setAttribute('aria-label', cap(SAYS[m]) + ': ' + [7, 9, 8, 6].filter(k => b[k]).map(k => b[k] + ' ' + B.kindName(k)).join(', ') +
    (last ? '. Drawn for line ' + (last.line + 1) + ': ' + B.kindName(last.kind) + '.' : '.'));
  return h('div', { class: 'bowlrow', id: 'bowlrow' },
    h('p', { class: 'bowlhead' }, h('span', null, HEAD[m]),
      h('span', { class: 'drawn' }, last ? 'drawn for line ' + (last.line + 1) + ': ' + B.kindName(last.kind) : 'ringed: turning')),
    box);
}
function setPeek(m) {
  if ((ui.peek || ui.bowl) === m) return;
  ui.peek = m;
  const row = $('bowlrow'), lab = $('mlabel');
  if (row) row.replaceWith(bowlBlock(m));
  if (lab) { lab.textContent = E.METHODS[m].label + ' '; lab.append(why(E.METHODS[m].anchor)); }
}
function lineStatus(i) {
  const box = h('div', { class: 'status' }), L = ui.walk.lines, l = L[i];
  if (l.how === 'decide') box.append(h('p', null, h('span', { class: 'tag own' }, E.heldWord(l)), 'Your answer: ' + l.answer + ', a ' + (B.isFirm(l.kind) ? 'firm' : 'yielding') + ' line.'));
  else if (E.isDevice(l.how)) box.append(h('p', null, h('span', { class: 'tag' }, E.TEXT.castTag),
    cap(SAYS[l.how]) + ' says ' + l.answer + (E.isTurning(l.kind) ? ', turning: it could flip' : '') + '. ' + E.castAfter(l.how).replace(/^Cast, not known\. /, '')));
  else if (l.how === 'unknown') box.append(h('p', { class: 'after' }, E.TEXT.afterUnknown));
  if (i < 2) box.append(h('p', { class: 'slicing' }, E.TEXT.slicing + ' ', why('slicing')));
  const after = i < 2 ? (L[0].answer != null && L[1].answer != null ? E.afterLine('gate', ui.walk) : '') : i === 4 ? E.afterLine('race', ui.walk) : '';
  if (after) box.append(h('p', { class: 'after' }, after));
  return box;
}
function topPanel() {
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions;
  const l6 = L.leaf && la ? E.line6For(L.leaf, la, null) : null;
  const box = h('div', null, kicker('Line 6 of 6 · ' + B.PLACES[5].nm + ' · our reading, never cast'), h('h2', null, 'Is a lever known to work where this lands?'));
  if (l6) {
    box.append(h('div', { class: 'leafbox' }, h('span', { class: 'small' }, 'Where the lines lead: '), h('b', null, nm(L.leaf)), ': ' + la.leaves[L.leaf].gloss),
      h('p', { class: 'l6' }, E.line6Sentence(l6)));
    if (L.anyCast) box.append(h('p', { class: 'small' }, h('span', { class: 'tag' }, E.TEXT.castTag), 'Some lines that got you here were drawn.'));
    if (L.ruleDiffers) box.append(h('p', { class: 'small' }, "By the tree's rule a drawn yes counts as not shown, so you land on " + nm(L.headline) + ' instead. Is there an action? says more.'));
    if (ui.more) box.append(h('p', { class: 'small' }, l6.why));
  } else if (!la) box.append(h('p', { class: 'warn' }, T.noNotes));
  else {
    box.append(h('p', { class: 'l6' }, T.line6Waits));
    if (L.possible.length) box.append(h('p', { class: 'small' }, 'Leaves still possible:'), chips(L.possible.map(nm)));
  }
  if (ui.more || !L.leaf) box.append(h('p', { class: 'small' }, E.TEXT.line6Intro));
  if (ui.more) box.append(h('p', { class: 'small' }, B.PLACES[5].tr));
  if (L.leaf) box.append(h('div', { class: 'row' }, h('button', { class: 'primary', 'data-k': 'land', disabled: !!ui.playing, onclick: () => openLanding() }, E.TEXT.landingAsk)));
  box.append(foot());
  return box;
}
function foot() {
  const busy = !!ui.playing, whole = B.isWhole(walkKinds(ui.walk));
  return h('div', { class: 'foot' },
    h('p', { class: 'tally' }, E.countsSummary(E.counts(ui.walk), 'lines'), ' · ', why('short', 'risk or uncertainty?')),
    h('div', { class: 'row' },
      h('button', { class: 'primary', 'data-k': 'gap', disabled: busy, onclick: openClose }, 'Close the gap'),
      h('button', { 'data-k': 'walk', disabled: busy, onclick: () => openWalk(null) }, 'Walk to a leaf'),
      h('button', { 'data-k': 'read', disabled: busy, 'aria-disabled': whole ? null : 'true', title: whole ? null : 'Every line needs a yes or a no first', onclick: startRelating }, 'The reading')));
}
function setLine(i) {
  if (ui.path) return;
  ui.line = i;
  if (i !== 3) ui.tapped = null;
  renderHex();
  renderPanel();
}
// after a move on line i: on to the next line still unasked, and from line 5 to line 6 once all five are set
function advance(i) {
  const L = ui.walk.lines;
  let j = -1;
  for (let k = i + 1; k < 5; k++) if (L[k].answer == null) { j = k; break; }
  if (j < 0 && i === 4) { j = L.findIndex(l => l.answer == null); if (j < 0) j = 5; }
  if (j >= 0) { ui.line = j; if (j !== 3) ui.tapped = null; }
  renderHex();
  renderPanel();
}

// ── moves, and playing them at the node ──────────────────────────────────────────────────────
function doDecide(i, a) {
  if (ui.playing || ui.path) return;
  const l = ui.walk.lines[i], loose = l.how === 'decide' ? E.isTurning(l.kind) : ui.loose;
  const r = E.decide(ui.walk, i, a, { loose, node: i === 3 ? ui.tapped : null });
  ui.loose = false;   // "held loosely" is for one answer; the next starts steady again
  play([{ walk: r.walk, casting: r.casting, line: i }], () => advance(i));
}
function doUnknown(i) {
  if (ui.playing || ui.path) return;
  const r = E.dontKnow(ui.walk, i, { node: i === 3 ? ui.tapped : null });
  play([{ walk: r.walk, casting: r.casting, line: i }], () => advance(i));
}
function doDraw(lines, m) {
  if (ui.playing || ui.path) return;
  ui.bowl = m; ui.peek = m;
  const r = E.castLines(ui.walk, lines, m, { node: ui.tapped });
  play(r.steps, () => advance(lines[lines.length - 1]));
}
function toggleLoose(i) {
  if (ui.playing || ui.path) return;
  const l = ui.walk.lines[i];
  if (l.how === 'decide') {
    ui.walk = E.setLoose(ui.walk, i, !E.isTurning(l.kind)).walk;
    say(where(i) + ': ' + E.heldWord(ui.walk.lines[i]) + '.');
    draw();
  } else {
    ui.loose = !ui.loose;
    say(ui.loose ? 'Your next answer will be held loosely: a turning line, it could flip.' : 'Your next answer will be held steady.');
    renderPanel();
  }
}
// which marble a device drew: the engine draws with the rng at n, from a list in the bowl's marble order
function lastDrawOf(s) {
  const l = s.walk.lines[s.line];
  if (!E.isDevice(l.how)) return null;
  const list = B.listOf(BOWL[l.how]);
  const index = Math.floor(E.drawValue(s.walk.seed, s.walk.n - 1) * list.length);
  return { line: s.line, method: l.how, index, kind: l.kind };
}
function captionFor(s, k, n) {
  const i = s.line, l = s.walk.lines[i];
  const of = n > 1 ? ' · ' + k + ' of ' + n : '';
  if (l.how === 'decide') return where(i) + ': ' + l.answer + ', ' + E.heldWord(l) + '.' + of;
  if (l.how === 'unknown') return where(i) + ": I don't know. The slot stays open." + of;
  return where(i) + ': ' + SAYS[l.how] + ' says ' + l.answer + ' (' + B.kindName(l.kind) + '). ' + E.castAfter(l.how) + of;
}
// Play steps one at a time at their nodes: each waits for the renderer's castend (or a safety timeout), then a
// short hold. A token makes late events from an older sequence harmless. Skip (or Esc) jumps to the end.
function play(steps, done) {
  if (!steps.length) { draw(); if (done) done(); return; }
  const token = ++ui.token;
  ui.playing = { token, steps, done };
  let k = 0;
  const next = () => {
    if (token !== ui.token) return;
    if (k >= steps.length) { ui.playing = null; ui.casting = null; draw(); if (done) done(); return; }
    const s = steps[k++];
    ui.walk = s.walk; ui.casting = s.casting;
    if (!ui.path) ui.line = s.line;   // the panel follows the line being played
    const d = lastDrawOf(s);
    if (d) { ui.last = d; ui.peek = d.method; }
    draw();
    let finished = false;
    const onEnd = ev => {
      if (finished) return;
      if (token !== ui.token) { finished = true; clearTimeout(safety); treeEl.removeEventListener('belieftree:castend', onEnd); return; }
      if (ev && ev.detail && ev.detail.node !== s.casting.node) return;
      finished = true; clearTimeout(safety); treeEl.removeEventListener('belieftree:castend', onEnd);
      ui.casting = null;
      say(captionFor(s, k, steps.length));
      if (k < steps.length) setTimeout(next, HOLD); else next();
    };
    // attached after draw(): a cast that the new render replaced ends synchronously inside draw(), and is not ours
    treeEl.addEventListener('belieftree:castend', onEnd);
    const safety = setTimeout(onEnd, SAFETY);
  };
  next();
}
function skip() {
  const p = ui.playing;
  if (!p) return;
  ui.token++; ui.playing = null; ui.casting = null;
  const lastStep = p.steps[p.steps.length - 1];
  ui.walk = lastStep.walk;
  const d = lastDrawOf(lastStep);
  if (d) { ui.last = d; ui.peek = d.method; }
  draw({ animate: false });
  say('Skipped to the end. ' + captionFor(lastStep, p.steps.length, p.steps.length));
  if (p.done) p.done();
}

// ── the relating reading and Walk to a leaf: the panel steps, the hexagram and the tree follow ─────
function startRelating() {
  if (ui.playing || ui.path) return;
  const kinds = walkKinds(ui.walk);
  if (!B.isWhole(kinds)) {
    const open = lines5().filter(i => !kinds[i]);
    say(open.length ? 'The hexagram isn’t whole yet: ' + numWords(open) + ' still open. Close the gap, or walk to a leaf, which draws them first.' : T.line6Waits);
    return;
  }
  ui.path = { type: 'relating', steps: B.relatingSteps(kinds, line6Kind), k: 0 };
  const n = ui.path.steps.length - 1;
  say('The reading: ' + hexName(kinds) + '. ' + (n ? (n === 1 ? '1 line is' : n + ' lines are') + ' turning.' : T.noneTurning));
  draw();
}
function startLeafWalk(leaf) {
  if (ui.playing || ui.path) return;
  const open = E.openLines(ui.walk);
  const go = () => {
    const kinds = walkKinds(ui.walk), want = leafAnswers(leaf);
    if (!B.isWhole(kinds) || !want) { say(ui.leafActions ? 'The start is not a whole hexagram yet.' : T.noNotes); draw(); return; }
    const r = B.leafWalk(kinds, want, E.rngFrom(pathSeed(ui.walk)), line6Kind);
    ui.path = { type: 'leaf', leaf, steps: r.steps, k: 0 };
    say('Walk to ' + nm(leaf) + ': from ' + hexName(kinds) + '. ' + (r.d ? r.d + (r.d === 1 ? ' line' : ' lines') + ' to turn.' : T.already));
    draw();
  };
  if (open.length) {
    ui.peek = ui.bowl;
    const r = E.castLines(ui.walk, open, ui.bowl, { node: ui.tapped });
    play(r.steps, go);
  } else go();
}
function pathNav(d) {
  const P = ui.path;
  if (!P) return;
  const k = Math.max(0, Math.min(P.steps.length - 1, P.k + d));
  if (k === P.k) return;
  P.k = k;
  const st = P.steps[k];
  say(k === 0 ? 'Back to the start: ' + hexName(st.kinds) + '.' : (st.flipped === 5 ? 'Line 6 turns' : lineWord(st.flipped) + ', turns') + ': ' + (k === P.steps.length - 1 ? 'arriving at ' : 'passing through ') + hexName(st.kinds) + '.');
  draw();
}
function exitPath() {
  if (!ui.path) return;
  ui.path = null;
  say('Back to your walk.');
  draw();
}
function judgment(kinds) {
  const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null;
  if (!hx) return null;
  if (ui.texts === false) return h('p', { class: 'small' }, 'The text could not be loaded; the names still hold.');
  if (!ui.texts) return h('p', { class: 'small' }, 'Loading the text…');
  const t = ui.texts[hx[0]] && ui.texts[hx[0]].Judgment;
  return t ? h('p', { class: 'judg' }, String(t)) : null;
}
function lineText(kinds, i) {
  const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null;
  const t = hx && ui.texts && ui.texts[hx[0]] ? ui.texts[hx[0]]['Line ' + (i + 1)] : null;
  return t ? { hx, text: String(t) } : null;
}
function line6Again(kinds) { return 'And line 6, read again for where this leads: ' + l6Words(kinds).replace(/^Line 6, our reading \(not cast\): /, '') + ' ' + T.notMind; }
function pathNavRow(lastLabel) {
  const P = ui.path, last = P.k === P.steps.length - 1;
  return h('div', { class: 'row pathnav' },
    h('button', { 'data-k': 'p-back', disabled: P.k === 0, onclick: () => pathNav(-1) }, 'Back'),
    last ? h('button', { class: 'primary', 'data-k': 'p-done', onclick: exitPath }, lastLabel)
      : h('button', { class: 'primary', 'data-k': 'p-next', onclick: () => pathNav(1) }, P.k === 0 ? (P.type === 'relating' ? 'Turn the first line' : 'Take the first step') : 'Next'),
    last ? null : h('button', { class: 'ghost', 'data-k': 'p-stop', onclick: exitPath }, 'Back to your walk'));
}
function relatingPanel() {
  const P = ui.path, st = P.steps[P.k], n = P.steps.length - 1, last = P.k === n;
  const box = h('div', { class: 'pathcard' });
  if (P.k === 0) {
    box.append(h('p', { class: 'kicker' }, h('span', null, 'The reading · ' + (n ? n + ' turning' : 'none turning'))),
      h('h2', null, svgNode(B.hexSVG(st.kinds)), hexTitle(st.kinds)),
      judgment(st.kinds) || '',
      h('p', { class: 'small' }, n ? 'Where the six lines stand. ' + (n === 1 ? '1 of them is' : n + ' of them are') + ' turning: they turn one at a time, bottom to top, and each passes through a real hexagram.' : T.noneTurning),
      h('p', { class: 'small' }, E.TEXT.hexFrame + ' ' + T.legge));
  } else {
    const i = st.flipped, prev = P.steps[P.k - 1];
    box.append(h('p', { class: 'kicker' }, h('span', null, (i === 5 ? 'Line 6, our reading, is turning too' : lineWord(i) + ', turns') + ' · ' + P.k + ' of ' + n)));
    if (i === 5) {
      const leaf = leafOf(P.steps[0].kinds), l6 = leaf && ui.leafActions ? E.line6For(leaf, ui.leafActions, null) : null;
      box.append(h('p', null, 'Our reading of line 6 was ' + l6Short(prev.kinds[5]) + ', and it could turn' + (l6 && l6.turn ? ' ' + l6.turn : '') +
        '. Turned, it reads ' + l6Short(st.kinds[5]) + '. ' + T.flipShows));
    } else {
      const l = ui.walk.lines[i], how = E.isDevice(l.how) ? 'drawn from ' + SAYS[l.how] : 'your answer, held loosely';
      box.append(h('p', null, 'It was ' + yn(prev.kinds[i]) + ' (' + how + ') and could flip. If it did, it would read ' + yn(st.kinds[i]) +
        ": you'd have to come to believe " + E.QUESTIONS[i].believe[yn(st.kinds[i])] + '. ' + T.flipShows));
    }
    if (i < 2) {
      const g0 = E.gateOf(yn(prev.kinds[0]), yn(prev.kinds[1])), g1 = E.gateOf(yn(st.kinds[0]), yn(st.kinds[1]));
      if (g0 !== g1) box.append(h('p', { class: 'small' }, 'The gate would then read ' + g1 + '. ' + (g1 === 'no'
        ? "Ordinary trial and error could work, if that no were shown; a flip in a reading doesn't show it."
        : "The burden would flip: whoever takes the step would have to show it's safe.")));
    }
    const lt = lineText(prev.kinds, i);
    if (lt) box.append(h('details', { class: 'more' }, h('summary', null, 'The tradition’s text for line ' + (i + 1) + ' of ' + lt.hx[1]), h('p', { class: 'small' }, lt.text)));
    box.append(h('h2', null, svgNode(B.hexSVG(st.kinds, { hl: i })), last ? 'It is turning into ' : 'Passing through ', hexTitle(st.kinds)));
    const a = leafOf(prev.kinds), b = leafOf(st.kinds);
    if (a !== b) box.append(h('p', null, 'The path turns from ', h('i', null, nm(a)), ' to ', h('i', null, nm(b)), '.'));
    if (st.line6Changed) box.append(h('p', null, line6Again(st.kinds)));
    if (last) {
      const A = leafOf(P.steps[0].kinds), Z = leafOf(st.kinds);
      if (st.lookedUp && B.isFirm(st.lookedUp) !== B.isFirm(st.kinds[5]) && Z) box.append(h('p', { class: 'small' }, 'Read again for where lines 1 to 5 now lead (' + nm(Z) + '), our line 6 would be ' + l6Short(st.lookedUp) + (B.isTurning(st.lookedUp) ? ', turning' : '') + '. ' + T.notMind));
      box.append(judgment(st.kinds) || '',
        h('p', null, h('b', null, 'If the turning answers flip, the path ', A === Z ? ['stays at ', h('i', null, nm(A))] : ['turns from ', h('i', null, nm(A)), ' to ', h('i', null, nm(Z))], '.')),
        h('p', { class: 'small' }, T.relatingHonest),
        h('p', { class: 'small' }, E.TEXT.hexFrame + ' ' + T.legge));
    }
  }
  box.append(pathNavRow('Done'));
  return box;
}
function leafPanel() {
  const P = ui.path, st = P.steps[P.k], d = P.steps.length - 1, last = P.k === d;
  const box = h('div', { class: 'pathcard' },
    h('p', { class: 'kicker' }, h('span', null, 'Walk to a leaf · to ' + nm(P.leaf) + (P.k ? ' · step ' + P.k + ' of ' + d : ''))));
  if (P.k === 0) {
    box.append(h('h2', null, svgNode(B.hexSVG(st.kinds)), d === 0 ? T.already : ['From ', hexTitle(st.kinds), ': ' + d + (d === 1 ? ' line' : ' lines') + ' to turn']),
      h('p', null, 'You are at ', h('i', null, nm(leafOf(st.kinds))), '. ' + T.pathRule),
      h('p', { class: 'small' }, T.pathIs + ' ' + E.TEXT.hexFrame));
  } else {
    const i = st.flipped, ans = yn(st.kinds[i]);
    box.append(h('h2', null, lineWord(i) + ', turns to ' + ans),
      h('p', null, T.mustBelieve + E.QUESTIONS[i].believe[ans] + '.'),
      h('p', null, svgNode(B.hexSVG(st.kinds, { hl: i })), last ? 'Arriving at ' : 'Passing through ', h('b', null, hexTitle(st.kinds)), '. The path is at ', h('i', null, nm(leafOf(st.kinds))), '.'));
    if (st.line6Changed) box.append(h('p', null, line6Again(st.kinds)));
    if (last) box.append(h('p', { class: 'small' }, l6Words(st.kinds) + ' ' + T.pathIs));
  }
  box.append(pathNavRow('Back to your walk'));
  return box;
}

// ── sheets ─────────────────────────────────────────────────────────────────────────────────────
function openSheet(build, opts = {}) {
  sheetIn.textContent = '';
  build(sheetIn);
  sheet.classList.toggle('light-backdrop', !!opts.light);
  if (!sheet.open) sheet.showModal();
  sheetIn.scrollTop = 0;
  const title = $('sheet-title');
  if (title) title.setAttribute('tabindex', '-1');
  const first = sheetIn.querySelector('[autofocus]') || title || sheetIn.querySelector('button, a[href]');
  if (first) first.focus({ preventScroll: true });
}
function closeSheet() { if (sheet.open) sheet.close(); }
function optBtn(title, sub, fn, auto) { return h('button', { onclick: fn, autofocus: auto || null }, title, sub ? h('small', null, sub) : null); }
function closeRow(label) { return h('div', { class: 'sheet-actions' }, h('button', { class: 'ghost', onclick: closeSheet }, label || 'Close')); }

function openClose() {
  if (ui.playing || ui.path) return;
  const open = E.openLines(ui.walk);
  openSheet(el => {
    el.append(h('h2', { id: 'sheet-title' }, E.TEXT.closeTitle));
    if (!open.length) {
      el.append(h('p', null, 'Nothing is open: every line has a yes or a no.'),
        h('div', { class: 'opts' },
          optBtn('See where you land', E.TEXT.landingAsk, () => openLanding(), true),
          optBtn(E.TEXT.eitherTitle, 'casts nothing', openEither)),
        closeRow('Not now'));
      return;
    }
    if (open.length === 5) el.append(h('p', { class: 'warn' }, E.TEXT.allFive));
    el.append(h('p', { class: 'small' }, 'Open: ' + numWords(open) + '. Each is drawn from a fresh bowl, bottom to top. The two bowls both come up yes half the time and turning 1 time in 4; in the yarrow bowl a yes turns more often than a no, in the coin bowl they turn alike.'));
    const ways = DRAWS.map(m => optBtn(m === 'yarrow' ? 'Draw yarrow for the open ones' : 'Draw from the coin bowl for the open ones', E.METHODS[m].label, () => closeBy(m), ui.bowl === m));
    if (ui.bowl === 'coins') ways.reverse();
    el.append(h('div', { class: 'opts' }, ways,
      optBtn('One at a time', "each open line: yes, no, a draw, or I don't know", () => stepper(open, 0)),
      optBtn(E.TEXT.eitherTitle, 'casts nothing: what you face under every leaf still possible', openEither)),
    closeRow('Not now'));
  });
}
function toTop() { ui.line = 5; ui.tapped = null; renderHex(); renderPanel(); }
function closeBy(m) {
  closeSheet();
  ui.bowl = m; ui.peek = m;
  const r = E.closeTheGap(ui.walk, m);
  play(r.steps, () => { toTop(); openLanding(); });
}
function stepper(prompts, k) {
  if (k >= prompts.length) { toTop(); openLanding(); return; }
  const i = prompts[k], Q = E.QUESTIONS[i];
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, 'One at a time · ' + (k + 1) + ' of ' + prompts.length + ' · line ' + (i + 1)),
      h('h2', { id: 'sheet-title' }, Q.ask),
      h('div', { class: 'row' },
        h('button', { autofocus: true, onclick: () => stepMove(prompts, k, 'yes') }, 'Yes · firm'),
        h('button', { onclick: () => stepMove(prompts, k, 'no') }, 'No · yielding'),
        DRAWS.map(m => h('button', { onclick: () => stepMove(prompts, k, m) }, BTN[m])),
        h('button', { class: 'idk', onclick: () => stepMove(prompts, k, 'unknown') }, "I don't know")),
      h('p', { class: 'small' }, "Yes: you'd have to believe " + Q.believe.yes + '.'),
      h('p', { class: 'small' }, "No: you'd have to believe " + Q.believe.no + '.'),
      closeRow('Stop here'));
  }, { light: true });
}
function stepMove(prompts, k, m) {
  const i = prompts[k];
  const r = m === 'yes' || m === 'no' ? E.decide(ui.walk, i, m, { loose: ui.loose }) : DRAWS.includes(m) ? E.cast(ui.walk, i, m) : E.dontKnow(ui.walk, i);
  if (m === 'yes' || m === 'no') ui.loose = false;
  if (DRAWS.includes(m)) { ui.bowl = m; ui.peek = m; }
  closeSheet();
  ui.line = i;
  play([{ walk: r.walk, casting: r.casting, line: i }], () => stepper(prompts, k + 1));
}

// "Is there an action?" One leaf is named, as in the tree view: under the burden reading the rule's leaf.
function openLanding() {
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions, kinds = walkKinds(ui.walk), whole = B.isWhole(kinds), top = L.headline;
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, L.anyCast ? E.TEXT.landingCast : E.TEXT.landingOwn),
      h('h2', { id: 'sheet-title', class: 'big' }, E.TEXT.landingAsk));
    if (top) {
      el.append(h('div', { class: 'leafbox' }, L.byRule ? h('span', { class: 'small' }, "By the tree's rule you land on ") : null,
        h('b', null, nm(top)), la && la.leaves[top] ? ': ' + la.leaves[top].gloss : ''));
    } else {
      el.append(h('p', null, 'Some lines are still open, so there is no single leaf yet.'),
        h('details', { class: 'more' }, h('summary', null, 'The leaves still possible'), chips(L.possible.map(nm))));
    }
    if (L.burden === 'flipped' && L.burdenLeaf) {
      el.append(h('p', null, E.burdenText(nm(L.burdenLeaf), { gateCast: L.gateCast, gateCastNo: L.gateCastNo, differs: L.ruleDiffers && L.leaf ? nm(L.leaf) : null, open: !L.leaf }).replace('The drawing lights', 'The hexagram and the drawing show'), ' ', why('burden')));
      if (L.throwSame) el.append(h('p', { class: 'small' }, E.TEXT.throwSame));
    } else if (L.burden === 'unclear') el.append(h('p', { class: 'small' }, (L.gateCastNo ? E.TEXT.gateNoCast + ' ' : '') + E.TEXT.gateUnknown));
    else el.append(h('p', { class: 'small' }, E.TEXT.gateNo));
    if (L.couldHave.length > 1 && top) el.append(h('p', { class: 'small' }, E.TEXT.couldHave), chips(L.couldHave.map(nm), nm(top)));
    if (whole) el.append(h('p', { class: 'hexline' }, svgNode(B.hexSVG(kinds)), 'As six lines: ', h('b', null, hexName(kinds)), '. ' + E.TEXT.hexFrame +
      (L.ruleDiffers ? ' Its line 6 is read for where the lines as drawn lead (' + nm(L.leaf) + ').' : '')));
    if (L.relatingLeaf && top) el.append(h('p', null, E.relatingText(nm(L.relatingLeaf), L.relatingLeaf === top) + '.'));
    el.append(h('p', { class: 'small' }, E.raceNote(L.answers.race, top, E.isDevice(ui.walk.lines[4].how)).replace(/^The race/, 'The race (line 5)')));
    if (top && la) actionsBlock(el, top);
    if (!top && la) eitherBlock(el, L.couldHave);
    if (!la) el.append(h('p', { class: 'warn' }, T.noNotes));
    if (L.leafCast && !L.throwSame) el.append(gladBlock(L));   // only when a new cast could change where you land
    const btns = h('div', { class: 'sheet-actions' });
    if (whole) btns.append(h('button', { class: 'primary', onclick: () => { closeSheet(); startRelating(); } }, 'The reading'));
    if (L.anyCast) btns.append(h('button', { onclick: () => { closeSheet(); play(E.throwAgain(ui.walk).steps, () => { toTop(); openLanding(); }); } }, 'Throw again'));
    btns.append(h('button', { onclick: openEither }, E.TEXT.eitherTitle),
      h('button', { onclick: () => openWalk(null) }, 'Walk to a leaf'),
      h('button', { onclick: () => { closeSheet(); setLine(L.pickedBy != null ? L.pickedBy : firstOpen()); } }, 'Change an answer'),
      h('button', { class: 'ghost', onclick: closeSheet }, 'Back to the lines'));
    el.append(btns);
  });
}
function firstOpen() { const o = E.openLines(ui.walk)[0]; return o == null ? 0 : o; }
// What the one named leaf faces, and line 6 for it: the page's own reading, never cast. Each gloss shows only
// when its word is on screen.
function actionsBlock(el, leaf) {
  const A = E.actionsFor([leaf], null, ui.leafActions, null)[leaf];
  const nd = A.noData, plain = nd.class === 'none' || nd.class === 'gap';
  el.append(h('h3', null, 'What ' + nm(leaf) + ' faces'),
    chips(A.faces.map(E.faceName)),
    h('p', null, 'Where it stands: ', plain ? h('span', { class: 'nm' }, nd.text) : nd.text));
  if (nd.class === 'none') el.append(h('p', { class: 'small' }, h('span', { class: 'nm' }, E.TEXT.noMechanism), ' ' + E.TEXT.noMechanismMeans));
  if (nd.class === 'targeted' || nd.class === 'weak' || nd.class === 'partial') el.append(h('p', { class: 'small' }, E.TEXT.targeted));
  if (A.faces.includes('jobs')) el.append(h('p', { class: 'small' }, E.TEXT.jobs));
  el.append(h('p', { class: 'small' }, E.TEXT.noList),
    h('h3', null, 'Line 6: is a lever known to work here?'),
    h('p', null, E.line6Sentence(A.line6)),
    h('p', { class: 'small' }, A.line6.why + ' ' + E.TEXT.line6Intro));
}
function eitherBlock(el, leaves) {
  const ew = E.eitherWay(leaves, ui.leafActions, null);
  el.append(h('h3', null, E.TEXT.eitherTitle), h('p', null, ew.sentence));
  if (ew.sharedFaces.length) el.append(chips(ew.sharedFaces.map(E.faceName)));
  el.append(h('p', { class: 'small' }, E.TEXT.eitherDangers));
}
// a row of buttons where the one pressed stays marked
function pickRow(items) {
  const row = h('div', { class: 'row' });
  items.forEach(([label, fn]) => row.append(h('button', { 'aria-pressed': 'false', onclick: ev => {
    row.querySelectorAll('button[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    ev.currentTarget.setAttribute('aria-pressed', 'true'); fn();
  } }, label)));
  return row;
}
function gladBlock(L) {
  const out = h('p', { class: 'reply', 'aria-live': 'polite', hidden: true });
  const show = (t, extra) => { out.hidden = false; out.textContent = t; if (extra) out.append(' ', extra); };
  return h('div', null,
    h('p', null, h('b', null, E.TEXT.gladAsk)),
    pickRow([
      ['Glad', () => show(E.TEXT.glad)],
      ['Sorry', () => show(E.TEXT.sorry, h('button', { class: 'linkish', onclick: () => { closeSheet(); setLine(L.pickedBy != null ? L.pickedBy : 2); say("Decide it yourself: yes, no, or I don't know."); } }, 'Decide it yourself'))],
      ['Neither', () => show(E.TEXT.neither)]]),
    out);
}
function openEither() {
  if (ui.playing || ui.path) return;
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions;
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, 'Casts nothing'), h('h2', { id: 'sheet-title' }, E.TEXT.eitherTitle),
      h('p', { class: 'small' }, "When you can't close the gap by knowing, look for what holds under every answer still possible. Drawn answers count as open here: a bowl found nothing out. ", why('either-way')),
      h('p', null, 'Leaves still possible:'), chips(L.couldHave.map(nm)));
    if (la) {
      const ew = E.eitherWay(L.couldHave, la, null);
      el.append(h('p', null, ew.sentence));
      if (ew.sharedFaces.length) el.append(chips(ew.sharedFaces.map(E.faceName)));
      el.append(h('p', { class: 'big' }, E.TEXT.landingAsk),
        h('p', null, ew.sharedFaces.length
          ? 'If a move holds either way, it will be aimed at these, and maybe at more. ' + E.TEXT.noList
          : 'Not one this list can show. ' + E.TEXT.noList),
        h('p', { class: 'small' }, E.TEXT.eitherDangers));
    }
    el.append(h('div', { class: 'sheet-actions' },
      L.headline ? h('button', { onclick: () => openLanding() }, 'Where you land') : null,
      h('button', { class: 'ghost', onclick: closeSheet, autofocus: true }, 'Back to the lines')));
  });
}
function openWalk(pre) {
  if (ui.playing || ui.path) return;
  const open = E.openLines(ui.walk), L = E.landing(ui.walk, leafFor);
  openSheet(el => {
    el.append(h('h2', { id: 'sheet-title' }, 'Walk to a leaf'),
      h('p', { class: 'small' }, 'Pick where to arrive. ' + T.pathRule + ' ' + T.pathIs));
    if (open.length) {
      const bowls = h('div', { class: 'row' });
      const paint = () => { bowls.textContent = ''; bowls.append(...DRAWS.map(m => h('button', { 'aria-pressed': String(ui.bowl === m), onclick: () => { ui.bowl = m; ui.peek = null; paint(); } }, BTN[m]))); };
      paint();
      el.append(h('p', null, 'First the open ' + numWords(open) + (open.length === 1 ? ' is' : ' are') + ' drawn, so the start is a whole hexagram. They are cast, not known. Drawn from:'), bowls);
    }
    el.append(h('div', { class: 'opts' }, E.LEAVES.map(leaf => {
      const w = leafAnswers(leaf);
      if (!w) return null;
      return optBtn(nm(leaf) + (L.leaf === leaf ? ' (where you are now)' : ''), 'line 3 ' + w.alignment + ', line 4 ' + w.containment,
        () => { closeSheet(); startLeafWalk(leaf); }, pre ? pre === leaf : leaf === E.LEAVES[0]);
    })), closeRow('Not now'));
  });
}

// ── events ─────────────────────────────────────────────────────────────────────────────────────
function onSelect(ev) {
  const d = ev.detail || {};
  if (d.person) { if (!ui.playing) location.href = treeHref({ focus: d.person }); return; }
  if (ui.playing || ui.path) return;
  const n = d.node, L = ui.walk.lines;
  if (n === 'gate') setLine(L[0].answer != null && L[1].answer == null ? 1 : 0);
  else if (n === 'alignment') setLine(2);
  else if (n === 'containment-if-aligned' || n === 'containment-if-not') { ui.tapped = n; setLine(3); }
  else if (n === 'race') setLine(4);
  else if (E.LEAVES.includes(n)) { if (E.landing(ui.walk, leafFor).leaf === n) setLine(5); else openWalk(n); }
}
function goTree() { location.href = treeHref(); }
function onKey(ev) {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const t = ev.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (sheet.open) return;   // the dialog closes itself on Esc
  const k = ev.key;
  if (k === 'Escape') {
    if (ui.playing) { ev.preventDefault(); skip(); }
    else if ($('help').open) $('help').open = false;
    else if (ui.path) exitPath();
    return;
  }
  if (ui.playing) return;
  const key = k.length === 1 ? k.toLowerCase() : k;
  if (ui.path) {
    const act = { ArrowRight: () => pathNav(1), ArrowUp: () => pathNav(1), ArrowLeft: () => pathNav(-1), ArrowDown: () => pathNav(-1), l: goTree }[key];
    if (act) { ev.preventDefault(); act(); }
    return;
  }
  const i = ui.line, onLine = i < 5;
  const act = {
    ArrowUp: () => setLine(Math.min(5, i + 1)), ArrowDown: () => setLine(Math.max(0, i - 1)),
    y: onLine ? () => doDecide(i, 'yes') : null, n: onLine ? () => doDecide(i, 'no') : null, f: onLine ? () => toggleLoose(i) : null,
    s: onLine ? () => doDraw([i], 'yarrow') : null, c: onLine ? () => doDraw([i], 'coins') : null, i: onLine ? () => doUnknown(i) : null,
    g: openClose, e: openEither, w: () => openWalk(null), r: startRelating, l: goTree
  }[key];
  if (!act) return;
  ev.preventDefault();
  act();
}

async function loadTexts() {
  const g = await getJSON(GRAMMAR);
  if (!g || !Array.isArray(g.items)) { ui.texts = false; }
  else { const m = {}; g.items.forEach(it => { if (it && it.metadata && it.sections) m[it.metadata.number] = it.sections; }); ui.texts = m; }
  if (ui.path) renderPanel();
}
function firstUnasked() { const j = ui.walk.lines.findIndex(l => l.answer == null); return j < 0 ? 5 : j; }
async function init() {
  document.documentElement.setAttribute('data-theme', ui.theme);
  E.checkNodes(NODES);
  if (SOURCE === 'standin') $('draft').hidden = false;
  const fromHash = E.decodeHash(location.hash);
  ui.walk = fromHash ? fromHash.walk : E.newWalk();
  ui.line = firstUnasked();
  const la = await getJSON('data/leaf-actions.json');
  ui.leafActions = la && la.leaves ? la : null;
  loadTexts();
  treeEl.addEventListener('belieftree:select', onSelect);
  skipEl.addEventListener('click', skip);
  document.addEventListener('keydown', onKey);
  wireHelp();
  sheet.addEventListener('click', ev => { if (ev.target === sheet) closeSheet(); });   // a tap on the backdrop
  window.addEventListener('hashchange', () => {
    const d = E.decodeHash(location.hash);
    if (!d || E.encodeHash(d.walk) === E.encodeHash(ui.walk)) return;
    ui.token++; ui.playing = null; ui.casting = null; ui.path = null; ui.last = null; ui.walk = d.walk;
    ui.line = firstUnasked();
    draw({ animate: false });
  });
  say(fromHash ? 'Your walk, picked up from the page address, as six lines. ' + E.countsSummary(E.counts(ui.walk), 'lines') + '.' : T.hello + ' ' + E.TEXT.coinIsFor);
  draw({ animate: false });
}
// the help box: a Close button inside it, and a tap outside it closes it
function wireHelp() {
  const help = $('help'), close = $('help-close');
  if (close) close.addEventListener('click', () => { help.open = false; help.querySelector('summary').focus(); });
  document.addEventListener('click', ev => { if (help.open && !help.contains(ev.target)) help.open = false; });
}

init();
