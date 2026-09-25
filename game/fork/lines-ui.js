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
import { renderTree, NODES, leafFor, SOURCE, LABELS } from './tree-adapter.js';
import * as E from './fork-engine.js';
import * as B from './bowl.js';

const EXPLAINER = '../../explainers/risk-and-uncertainty/';
const GRAMMAR = 'https://iching.recursive.eco/grammars/zhouyi-core/grammar.json';
const HOLD = 600, SAFETY = 2200, PATH_SALT = 0x3C6EF372;
const DRAWS = ['yarrow', 'coins'];
const BOWL = { yarrow: B.START.yarrow, coins: B.START.coins, coin: { 6: 0, 7: 1, 8: 1, 9: 0 } };
const SAYS = { yarrow: 'the yarrow bowl', coins: 'the coin bowl', coin: 'the coin' };
const IN_AIR = { yarrow: 'drawing from the yarrow bowl…', coins: 'drawing from the coin bowl…', coin: 'the coin is in the air…' };
const BTN = { yarrow: 'Yarrow bowl', coins: 'Coin bowl' };
const BTN_LONG = { yarrow: 'Draw from the yarrow bowl', coins: 'Draw from the coin bowl (three coins)' };
const HEAD = { yarrow: 'The yarrow bowl: 16 marbles, a fresh bowl each draw', coins: 'The coin bowl: three coins’ odds as 16 marbles, a fresh bowl each draw', coin: 'One coin: two sides' };
const T = {
  hello: "Build a hexagram, the I Ching's figure of six stacked lines, from the bottom up: yes is a solid (firm) line, no a broken (yielding) one. Decide each line, draw it from a bowl, or say I don't know.",
  relatingHonest: 'In the tradition all turning lines change at once; walking them one at a time is ours (from the Recursive I Ching’s path caster).',
  mustBelieve: "To get here you'd have to come to believe (or someone would have to show): ",
  noneTurning: 'No line is turning. The hexagram stands; the tradition reads only its judgment.',
  line6Waits: 'Line 6 waits for a leaf: alignment (line 3) and containment (line 4) each need an answer. With your own no on the gate (ordinary trial and error), an open line 3 or 4 names no leaf: it needs a yes or a no, yours or drawn.',
  flipShows: 'A flip in a reading shows nothing about the world: it only asks what would follow.',
  pathRule: 'The path changes only lines 3 and 4. Lines 1, 2 and 5 stay as they are; line 6, our reading, reads the same for every leaf.',
  pathIs: "Each step names what you would have to come to believe, by the tree's rule. A path of beliefs, not a forecast.",
  noNotes: "The notes on each leaf didn't load, so line 6 can't be read.",
  unread: "The walk in this link couldn't be read, so this is a new walk.",
  unreadKept: "The walk in that address couldn't be read, so your walk stays as it was.",
  legge: 'Judgment and line texts: James Legge (tr.), 1882, public domain; hexagram names as in the Wilhelm/Baynes translation (1950); both read from the Recursive I Ching.'
};

const $ = id => document.getElementById(id);
const treeEl = $('tree'), hexEl = $('hex'), hexNameEl = $('hexname'), captionEl = $('caption'), panelEl = $('panel'), skipEl = $('skip'), ruleEl = $('rulebar');
const sheet = $('sheet'), sheetIn = $('sheet-in');
const params = new URLSearchParams(location.search);
const oneOf = (v, ok, d) => (ok.includes(v) ? v : d);

const ui = {
  walk: null, line: 0, tapped: null, loose: false,
  bowl: ({ coin: 'coins', coins: 'coins', yarrow: 'yarrow' })[params.get('method')] || 'yarrow',
  peek: null, last: null,
  casting: null, token: 0, playing: null, inAir: null,
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
const nm = leaf => E.leafName(leaf, NODES, LABELS);
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
// Where the drawn lines point, the drawing only (never a landing): leafFor is only ever asked with alignment and
// containment both yes or no (the gate and the race ride along)
function leafOf(k5, w = ui.walk) {
  if (!k5[2] || !k5[3]) return null;
  return leafFor({ ...E.answersOf(w), alignment: yn(k5[2]), containment: yn(k5[3]) }) || null;
}
// `w` with lines 1 to 5 as `k5` shows them; a line that changes keeps how it was held (a reading's flip: a drawn
// line that flips is still drawn, your own answer stays yours)
function walkAt(k5, w = ui.walk) {
  const v = E.cloneWalk(w);
  for (let i = 0; i < 5; i++) {
    const k = k5[i], l = v.lines[i];
    if (!k || l.kind === k) continue;
    v.lines[i] = { answer: yn(k), how: E.isDevice(l.how) || l.how === 'decide' ? l.how : 'decide', kind: k };
  }
  return v;
}
// Line 6 reads the leaf the page names (fork-engine.js namedLeaf: the rule's leaf, or the drawn lines' pick), the
// same leaf the landing names, never the raw drawing's
function line6OfWalk(w) {
  const leaf = E.namedLeaf(w, leafFor), la = ui.leafActions;
  if (!leaf || !la) return 0;
  const l6 = E.line6For(leaf, la, null);
  return l6 ? l6.kind : 0;
}
// line 6 for lines 1 to 5 as `k5` shows them (for the reading: the walk with those lines turned)
function line6Kind(k5, w = ui.walk) { return line6OfWalk(walkAt(k5, w)); }
// line 6's sentence for the leaf the page names for `w`, with the line's kind as it now stands
function l6Words(w, kind) {
  const leaf = E.namedLeaf(w, leafFor), la = ui.leafActions;
  const l6 = leaf && la ? E.line6For(leaf, la, null) : null;
  return E.line6Sentence({ ...(l6 || {}), kind: kind == null ? line6OfWalk(w) : kind });
}
function l6Short(k) { return B.isFirm(k) ? 'firm: a lever known to work' : 'yielding: no lever shown to work'; }
function walkKinds(w) {
  const k = w.lines.map(l => (l.answer === 'yes' || l.answer === 'no' ? l.kind : 0));
  k.push(line6OfWalk(w));
  return k;
}
function leafAnswers(leaf) { return E.leafAnswersFor(leaf, leafFor); }
function pathSeed(w) { return (Math.imul(w.seed, 0x9E3779B1) ^ Math.imul(w.n + 1, 0x85EBCA6B) ^ PATH_SALT) >>> 0; }
function hexTitle(kinds) {
  const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null;
  return hx ? [hx[0] + '. ' + hx[1], h('small', null, ' ' + hx[3] + ' ' + hx[2])] : 'an unfinished hexagram';
}
function hexName(kinds) { const hx = B.isWhole(kinds) ? B.hexOf(B.bits(kinds)) : null; return hx ? hx[0] + '. ' + hx[1] : 'an unfinished hexagram'; }

// ── drawing ────────────────────────────────────────────────────────────────────────────────────
function stepNow() { return ui.path ? ui.path.steps[ui.path.k] : null; }
// the walk the tree shows: yours, or yours with the lines a reading or a path has turned so far (a Walk to a leaf
// step carries its own walk: the lines drawn for the path, and the beliefs come to so far)
function shownWalk() {
  const st = stepNow();
  if (!st) return ui.walk;
  return st.walk || walkAt(st.kinds);
}
function draw(opts) {
  skipEl.hidden = !ui.playing;
  renderTree(treeEl, E.toTreeState(shownWalk(), { focus: null, people: [], casting: ui.casting, theme: ui.theme, leafFor }), opts || { animate: true });
  renderHex();
  renderPanel();
  renderRule();
  renderViews();
  writeHash();
}
// Under the hexagram, in the page's own DOM: when the drawing points at a leaf the rule doesn't put you on, when
// open answers leave the drawing short of a leaf the rule names, or when the lit leaf is only the drawn lines'
// pick, say so where the drawing is. During a reading or a path it speaks of the walk the tree shows.
function renderRule() {
  if (!ruleEl) return;
  const w = ui.inAir ? null : shownWalk(), L = w ? E.landing(w, leafFor) : null, named = w ? E.namedLeaf(w, leafFor) : null;
  let t = '';
  if (L && L.drawnDiffers) t = 'The lines as drawn point at ' + nm(L.leaf) + ' (dashed). By the tree\'s rule you land on ' + nm(L.headline) + '.';
  else if (L && L.caution && named && !L.leaf) t = 'Lines 3 and 4 don\'t both point yet; an open answer counts as not shown. By the tree\'s rule you land on ' + nm(named) + '.';
  else if (L && L.pick) t = 'The drawn lines pick ' + nm(L.pick) + ' (dashed): a pick, not a finding.';
  ruleEl.hidden = !t;
  ruleEl.textContent = t;
}
function turnedSoFar() { const P = ui.path; return P ? P.steps.slice(1, P.k + 1).map(s => s.flipped) : []; }
function slotTag(i, k) {
  if (turnedSoFar().includes(i)) return ui.path.type === 'leaf' && stepNow().walk.lines[i].how !== 'decide' ? 'cast' : 'turned';
  if (i === 5) return k ? 'our reading' : '';
  const l = shownWalk().lines[i];
  if (l.answer == null) return '';
  if (l.how === 'unknown') return 'open';
  if (E.isDevice(l.how)) return 'cast';
  return 'yours';
}
function slotLabel(i, k, tag) {
  const w = shownWalk();
  let s = lineWord(i) + ', ' + (i < 5 ? E.QUESTIONS[i].short.toLowerCase() : 'is a lever known to work? our reading, never cast') + ': ';
  if (i < 5 && !k && E.mootLines(w).includes(i)) return s + (w.lines[i].answer === 'unknown' ? "I don't know; " : '') + 'not needed for the gate (your no on the other gate line settles it); it only completes the hexagram';
  if (!k) s += i === 5 ? 'waits for a leaf' : w.lines[i].answer === 'unknown' ? "I don't know, open" : 'not yet asked';
  else s += (i === 5 ? l6Short(k) : yn(k) + ', ' + (B.isFirm(k) ? 'a firm line' : 'a yielding line')) + (B.isTurning(k) ? ', turning: it could flip' : '');
  if (tag === 'cast') s += ', ' + E.TEXT.castTag;
  else if (tag === 'yours') s += ', your answer';
  else if (tag === 'turned') s += ui.path && ui.path.type === 'leaf' ? ', come to believe on this path' : ', turned in this reading';
  return s;
}
function renderHex() {
  const st = stepNow(), kinds = st ? st.kinds : walkKinds(ui.walk), shown = shownWalk();
  const a = document.activeElement, key = a && hexEl.contains(a) ? a.getAttribute('data-k') : null;
  const busy = !!ui.playing || !!ui.path;
  hexEl.textContent = '';
  for (let i = 0; i < 6; i++) {
    const k = kinds[i], tag = slotTag(i, k), unknown = i < 5 && !k && shown.lines[i].answer === 'unknown';
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
  if (E.mootLines(ui.walk).includes(i)) box.append(h('p', { class: 'after' }, 'Your no on line ' + (2 - i) + ' settles the gate. This line is not needed for it; it only completes the hexagram.'));
  if (i < 2) box.append(h('p', { class: 'slicing' }, E.TEXT.slicing + ' ', why('slicing')));
  const after = i < 2 ? ((L[0].answer != null && L[1].answer != null) || E.mootLines(ui.walk).length ? E.afterLine('gate', ui.walk) : '') : i === 4 ? E.afterLine('race', ui.walk) : '';
  if (after) box.append(h('p', { class: 'after' }, after));
  return box;
}
// Line 6 reads the leaf the landing names (E.namedLeaf): the rule's leaf, whatever lines 3 and 4 hold (yours,
// drawn, or "I don't know"), or the drawn lines' pick when the caution is off. It waits only while line 3 or 4 has
// no answer at all, or, with the caution off, while one is open.
function topPanel() {
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions;
  const named = E.namedLeaf(ui.walk, leafFor);
  const l6 = la && named ? E.line6For(named, la, null) : null;
  const box = h('div', null, kicker('Line 6 of 6 · ' + B.PLACES[5].nm + ' · our reading, never cast'), h('h2', null, 'Is a lever known to work where this lands?'));
  if (l6) {
    const byRule = L.headline === named;
    box.append(h('div', { class: 'leafbox' + (byRule ? '' : ' pick') },
      h('span', { class: 'small' }, byRule ? (L.caution ? "By the tree's rule you land on " : 'Your answers put you at ') : 'No single leaf is known. The drawn lines pick '),
      h('b', null, nm(named)), ': ' + la.leaves[named].gloss),
      h('p', { class: 'l6' }, E.line6Sentence(l6)));
    if (L.drawnDiffers) box.append(h('p', { class: 'small' }, h('span', { class: 'tag' }, E.TEXT.castTag),
      'The lines as drawn point at ' + nm(L.leaf) + ". By the tree's rule a drawn yes isn't shown, so that isn't where you land. Line 6 reads the same for every leaf today, so the hexagram's top line doesn't change with it."));
    else if (L.caution && !L.leaf) {
      const open = [2, 3].filter(i => ui.walk.lines[i].answer === 'unknown');
      box.append(h('p', { class: 'small' }, cap(numWords(open)) + (open.length > 1 ? ' are' : ' is') +
        " open. By the tree's rule an open answer counts as not shown, so it reads as no here."));
    }
    else if (L.anyCast) box.append(h('p', { class: 'small' }, h('span', { class: 'tag' }, E.TEXT.castTag), 'Some lines that got you here were drawn: they count as not shown.'));
    const flip = E.flipLine(L, nm);
    if (flip) box.append(h('p', { class: 'small' }, flip));
    if (ui.more) box.append(h('p', { class: 'small' }, l6.why));
  } else if (!la) box.append(h('p', { class: 'warn' }, T.noNotes));
  else {
    box.append(h('p', { class: 'l6' }, T.line6Waits));
    // with the caution on the rule already names a leaf (the landing sheet says which); a list of "still possible"
    // leaves here would read as a second answer. With it off, every leaf still possible, a drawn line counted open.
    if (!L.caution && L.still.length) box.append(h('p', { class: 'small' }, 'Leaves still possible:'), chips(L.still.map(nm)));
    const flip = E.flipLine(L, nm);
    if (flip) box.append(h('p', { class: 'small' }, flip));
  }
  if (ui.more || !l6) box.append(h('p', { class: 'small' }, E.TEXT.line6Intro));
  if (ui.more) box.append(h('p', { class: 'small' }, B.PLACES[5].tr));
  box.append(h('div', { class: 'row' }, h('button', { class: 'primary', 'data-k': 'land', disabled: !!ui.playing, onclick: () => openLanding() }, E.TEXT.landingAsk)));
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
function airCaption(s, k, n) { return where(s.line) + ': ' + IN_AIR[s.walk.lines[s.line].how] + (n > 1 ? ' · ' + k + ' of ' + n : ''); }
function captionFor(s, k, n) {
  const i = s.line, l = s.walk.lines[i];
  const of = n > 1 ? ' · ' + k + ' of ' + n : '';
  if (l.how === 'decide') return where(i) + ': ' + l.answer + ', ' + E.heldWord(l) + '.' + of;
  if (l.how === 'unknown') return where(i) + ": I don't know. The slot stays open." + of;
  return where(i) + ': ' + SAYS[l.how] + ' says ' + l.answer + ' (' + B.kindName(l.kind) + '). ' + E.castAfter(l.how) + of;
}
// Play steps one at a time at their nodes. A draw plays "in the air" first: the hexagram, the tree's answers, the
// bowl's ringed marble, the panel and the caption keep the walk as it was until the renderer's castend (or a safety
// timeout), so nothing gives the result away mid-animation; then it lands everywhere at once, and a short hold. A
// decision or "I don't know" shows at once. The casting object stays the same after its castend, so a re-render
// never restarts it. A token makes late events from an older sequence harmless. Skip (or Esc) jumps to the end.
function play(steps, done) {
  if (!steps.length) { draw(); if (done) done(); return; }
  const token = ++ui.token;
  ui.playing = { token, steps, done };
  let k = 0;
  const next = () => {
    if (token !== ui.token) return;
    if (k >= steps.length) { ui.playing = null; ui.inAir = null; draw(); if (done) done(); return; }
    const s = steps[k++];
    const device = E.isDevice(s.walk.lines[s.line].how);
    ui.casting = s.casting;
    if (!ui.path) ui.line = s.line;   // the panel follows the line being played
    if (device) { ui.inAir = s; ui.peek = s.walk.lines[s.line].how; say(airCaption(s, k, steps.length)); } else ui.walk = s.walk;
    drawThenEnd(s.casting, token, () => {
      if (device) {
        ui.walk = s.walk; ui.inAir = null;
        const d = lastDrawOf(s);
        if (d) { ui.last = d; ui.peek = d.method; }
        draw();
      }
      say(captionFor(s, k, steps.length));
      if (k < steps.length) setTimeout(next, HOLD); else next();
    });
  };
  next();
}
// Draw, then call back once the renderer's castend for `casting` arrives, or after a safety timeout (a hidden tab
// paints no frames, so an animation driven by requestAnimationFrame may never end there). A renderer may also end a
// cast inside the render itself (the film's module does under reduced motion): that end is caught too, so reduced
// motion never waits for the timeout. A token makes a late end from an older sequence harmless.
function drawThenEnd(casting, token, cb) {
  let sync = null;
  const early = ev => { if (ev.detail && ev.detail.node === casting.node) sync = ev; };
  treeEl.addEventListener('belieftree:castend', early);
  draw();
  treeEl.removeEventListener('belieftree:castend', early);
  let finished = false;
  const onEnd = ev => {
    if (finished) return;
    if (ev && ev.detail && ev.detail.node !== casting.node) return;
    finished = true; clearTimeout(safety); treeEl.removeEventListener('belieftree:castend', onEnd);
    if (token === ui.token) cb();
  };
  treeEl.addEventListener('belieftree:castend', onEnd);
  const safety = setTimeout(onEnd, SAFETY);
  if (sync) onEnd(sync);
}
function skip() {
  const p = ui.playing;
  if (!p) return;
  ui.token++; ui.playing = null; ui.casting = null; ui.inAir = null;
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
  ui.path = { type: 'relating', steps: B.relatingSteps(kinds, k5 => line6Kind(k5)), k: 0 };
  const n = ui.path.steps.length - 1;
  say('The reading: ' + hexName(kinds) + '. ' + (n ? (n === 1 ? '1 line is' : n + ' lines are') + ' turning.' : T.noneTurning));
  draw();
}
function countWord(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
// "2 answers to come to believe, and 1 drawn line to turn (the drawing only)", or "you're already there"
function leafPathSummary(r) {
  if (!r.beliefs) return "By the tree's rule you're already there." + (r.drawings ? ' ' + cap(countWord(r.drawings, 'drawn line turns', 'drawn lines turn')) + ' to match, which moves only the drawing.' : '');
  return cap(countWord(r.beliefs, 'answer', 'answers')) + ' to come to believe' + (r.drawings ? ', and ' + countWord(r.drawings, 'drawn line', 'drawn lines') + ' to turn (the drawing only)' : '') + '.';
}
// Walk to a leaf, by the tree's rule (fork-engine.js walkToLeaf): each step says what you would have to come to
// believe, and "you're already there" only when the rule already lands there. Open lines are drawn first so the
// start is a whole hexagram, but only for the path: your walk keeps them open, as "Back to your walk" shows.
function startLeafWalk(leaf) {
  if (ui.playing || ui.path) return;
  const open = E.openLines(ui.walk), keep = ui.walk;
  const go = () => {
    const start = ui.walk;
    if (open.length) ui.walk = { ...E.cloneWalk(keep), n: start.n };   // the draws were for the path; the seed moves on
    const kinds = walkKinds(start);
    const r = E.walkToLeaf(start, leaf, leafFor, E.rngFrom(pathSeed(start)));
    if (!B.isWhole(kinds) || !r) { say(ui.leafActions ? 'The start is not a whole hexagram yet.' : T.noNotes); draw(); return; }
    const steps = [{ kinds, flipped: null, line6Changed: false, walk: start }];
    r.steps.forEach(s => {
      const k = walkKinds(s.walk);
      steps.push({ kinds: k, flipped: s.line, line6Changed: k[5] !== steps[steps.length - 1].kinds[5], walk: s.walk, type: s.type, answer: s.answer, was: s.was });
    });
    ui.path = { type: 'leaf', leaf, steps, k: 0, r, drewFor: open };
    say('Walk to ' + nm(leaf) + ': from ' + hexName(kinds) + '. ' + leafPathSummary(r) +
      (open.length ? ' ' + cap(numWords(open)) + ' drawn for the path only: your walk keeps ' + (open.length === 1 ? 'it' : 'them') + ' open.' : ''));
    draw();
  };
  if (open.length) {
    ui.peek = ui.bowl;
    const r = E.castLines(ui.walk, open, ui.bowl, { node: ui.tapped });
    play(r.steps, go);
  } else go();
}
function stepWord(st) {
  if (st.flipped === 5) return 'Line 6 turns';
  if (st.type === 'own') return lineWord(st.flipped) + ', yours now (' + st.answer + ')';
  if (st.type === 'drawing') return lineWord(st.flipped) + ', the drawing turns to no';
  return lineWord(st.flipped) + ', turns';
}
function pathNav(d) {
  const P = ui.path;
  if (!P) return;
  const k = Math.max(0, Math.min(P.steps.length - 1, P.k + d));
  if (k === P.k) return;
  P.k = k;
  const st = P.steps[k];
  say(k === 0 ? 'Back to the start: ' + hexName(st.kinds) + '.' : stepWord(st) + ': ' + (k === P.steps.length - 1 ? 'arriving at ' : 'passing through ') + hexName(st.kinds) + '.');
  draw();
}
function exitPath() {
  if (!ui.path) return;
  const drew = ui.path.drewFor || [];
  ui.path = null;
  say('Back to your walk.' + (drew.length ? ' ' + cap(numWords(drew)) + (drew.length === 1 ? ' is' : ' are') + ' open again, as you left ' + (drew.length === 1 ? 'it' : 'them') + ': the draws were only for the path.' : ''));
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
function line6Again(w, kinds) { return 'And line 6, our reading for where this leads: ' + l6Words(w, kinds[5]).replace(/^Line 6, our reading \(not cast\): /, ''); }
// the leaf the page names for your walk (by the rule, or the drawn lines' pick), else where the lines point
function readingLeaf(kinds) { return E.namedLeaf(ui.walk, leafFor) || leafOf(kinds); }
// where a walk lands, in the landing's words ('' when no leaf is named)
function landedWords(L) {
  if (L.headline) return (L.caution ? "By the tree's rule you land on " : 'Your answers put you at ') + nm(L.headline) + '.';
  if (L.pick) return 'No single leaf is known; the drawn lines pick ' + nm(L.pick) + '.';
  return '';
}
// The last step of a reading: where the rule puts you, before and after the turning answers flip. The flip is read
// by the rule too (fork-engine.js flipLine): an own "no" on the gate held loosely that flips brings the caution on.
function ruleAfterReading() {
  const L = E.landing(ui.walk, leafFor), drawnTurning = L.turned.some(i => i < 5 && E.isDevice(ui.walk.lines[i].how));
  const flip = E.flipLine(L, nm);
  if (L.headline) {
    const who = L.caution ? "By the tree's rule you land on " : 'Your answers put you at ';
    if (flip) return who + nm(L.headline) + '. ' + flip;
    return who + nm(L.headline) + ', before and after' + (drawnTurning ? ": a drawn line that flips is still drawn, so it still isn't shown." : '.');
  }
  if (flip) return 'No single leaf is known now: drawn lines only pick. ' + flip;
  return 'No single leaf is known, before or after: drawn lines only pick. Still possible: ' + E.listWords(L.still.map(nm)) + '.';
}
function pathNavRow(lastLabel) {
  const P = ui.path, last = P.k === P.steps.length - 1;
  return h('div', { class: 'row pathnav' },
    h('button', { 'data-k': 'p-back', disabled: P.k === 0, onclick: () => pathNav(-1) }, 'Back'),
    last ? h('button', { class: 'primary', 'data-k': 'p-done', onclick: exitPath }, lastLabel)
      : h('button', { class: 'primary', 'data-k': 'p-next', onclick: () => pathNav(1) }, P.k === 0 ? (P.type === 'relating' ? 'Turn the first line' : 'Take the first step') : 'Next'),
    last ? null : h('button', { class: 'ghost', 'data-k': 'p-stop', onclick: exitPath }, 'Back to your walk'));
}
// A gate line turning in a reading: what the gate and the caution would then be, by the rule (a drawn line that
// flips is still drawn; your own answer that flips is still yours)
function gateTurnWords(prevKinds, kinds) {
  const w0 = walkAt(prevKinds), w1 = walkAt(kinds);
  const c0 = E.cautionOn(w0), c1 = E.cautionOn(w1), g0 = E.answersOf(w0).gate, g1 = E.answersOf(w1).gate;
  if (c0 && !c1) return 'The gate would then read no, as your own answer: ordinary trial and error could work, and the caution would go off.';
  if (!c0 && c1) return (g0 !== g1 ? 'The gate would then read ' + g1 + '. ' : '') + "Nobody would then have said, as their own answer, that the step can be undone or tried first, so the caution would be on: whoever takes the step would have to show it's safe.";
  if (g0 === g1) return '';
  return 'The gate would then read ' + g1 + ' on the drawing. ' + (c1
    ? "A drawn line that flips is still drawn: it doesn't show the step can be undone or tried first, so the caution stays on."
    : 'Your own no on the other part still settles it: ordinary trial and error, as before.');
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
      const leaf = readingLeaf(P.steps[0].kinds), l6 = leaf && ui.leafActions ? E.line6For(leaf, ui.leafActions, null) : null;
      box.append(h('p', null, 'Our reading of line 6 was ' + l6Short(prev.kinds[5]) + ', and it could turn' + (l6 && l6.turn ? ' ' + l6.turn : '') +
        '. Turned, it reads ' + l6Short(st.kinds[5]) + '. ' + T.flipShows));
    } else {
      const l = ui.walk.lines[i], drawn = E.isDevice(l.how), how = drawn ? 'drawn from ' + SAYS[l.how] : 'your answer, held loosely';
      box.append(h('p', null, 'It was ' + yn(prev.kinds[i]) + ' (' + how + ') and could flip. If it did, it would read ' + yn(st.kinds[i]) +
        (drawn ? ': still drawn, still not shown' : ": you'd have to come to believe " + E.QUESTIONS[i].believe[yn(st.kinds[i])]) + '. ' + T.flipShows));
    }
    if (i < 2) { const t = gateTurnWords(prev.kinds, st.kinds); if (t) box.append(h('p', { class: 'small' }, t)); }
    const lt = lineText(prev.kinds, i);
    if (lt) box.append(h('details', { class: 'more' }, h('summary', null, 'The tradition’s text for line ' + (i + 1) + ' of ' + lt.hx[1]), h('p', { class: 'small' }, lt.text)));
    box.append(h('h2', null, svgNode(B.hexSVG(st.kinds, { hl: i })), last ? 'It is turning into ' : 'Passing through ', hexTitle(st.kinds)));
    const a = leafOf(prev.kinds), b = leafOf(st.kinds);
    if (a !== b) box.append(h('p', null, 'On the drawing, the path turns from ', h('i', null, nm(a)), ' to ', h('i', null, nm(b)), '.'));
    if (st.line6Changed) box.append(h('p', null, line6Again(walkAt(st.kinds), st.kinds)));
    if (last) {
      const A = leafOf(P.steps[0].kinds), Z = leafOf(st.kinds);
      // line 6 turned only as an "if": our reading of it is the same for every leaf and has not changed
      if (st.lookedUp && B.isFirm(st.lookedUp) !== B.isFirm(st.kinds[5])) box.append(h('p', { class: 'small' }, 'Line 6 turned here only as an if. Our reading of it is unchanged for every leaf (' + l6Short(st.lookedUp) + ').'));
      box.append(judgment(st.kinds) || '',
        h('p', null, 'If the turning answers flip, the drawing\'s path ', A === Z ? ['stays at ', h('i', null, nm(A))] : ['turns from ', h('i', null, nm(A)), ' to ', h('i', null, nm(Z))], '.'),
        h('p', null, h('b', null, ruleAfterReading())),
        h('p', { class: 'small' }, T.relatingHonest),
        h('p', { class: 'small' }, E.TEXT.hexFrame + ' ' + T.legge));
    }
  }
  box.append(pathNavRow('Done'));
  return box;
}
// where the walk at the start of a path stands, by the rule; and where the drawing points when that differs
function hereWords(w) {
  const L = E.landing(w, leafFor);
  const drawn = L.leaf && L.leaf !== L.headline && L.leaf !== L.pick ? ' The lines as drawn point at ' + nm(L.leaf) + ": that isn't where you land." : '';
  if (L.headline) return 'Where you are now: ' + (L.caution ? "by the tree's rule, " : 'your answers put you at ') + nm(L.headline) + '.' + drawn;
  if (L.pick) return 'Where you are now: no single leaf is known. The drawn lines pick ' + nm(L.pick) + ': a pick, not a finding.';
  return 'Where you are now: no single leaf is known yet.' + drawn;
}
function leafPanel() {
  const P = ui.path, st = P.steps[P.k], d = P.steps.length - 1, last = P.k === d, r = P.r;
  const box = h('div', { class: 'pathcard' },
    h('p', { class: 'kicker' }, h('span', null, 'Walk to a leaf · to ' + nm(P.leaf) + (P.k ? ' · step ' + P.k + ' of ' + d : ''))));
  if (P.k === 0) {
    box.append(h('h2', null, svgNode(B.hexSVG(st.kinds)), r.beliefs
      ? ['From ', hexTitle(st.kinds), ': ' + countWord(r.beliefs, 'answer', 'answers') + ' to come to believe']
      : "By the tree's rule you're already there."),
      h('p', null, hereWords(st.walk)));
    if (r.drawings) box.append(h('p', { class: 'small' }, "With the caution on, the tree's rule already reads a drawn yes as no. The path also turns " +
      countWord(r.drawings, 'drawn line', 'drawn lines') + ' so the drawing matches ' + nm(P.leaf) + ': that moves only the drawing, and asks no new belief.'));
    box.append(h('p', { class: 'small' }, T.pathRule), h('p', { class: 'small' }, T.pathIs + ' ' + E.TEXT.hexFrame));
  } else {
    const i = st.flipped, ans = st.answer, Q = E.QUESTIONS[i];
    if (st.type === 'own') box.append(h('h2', null, lineWord(i) + ': yours now, ' + ans),
      h('p', null, 'It was drawn ' + ans + ", and a drawn line isn't shown. To land here by the tree's rule you'd have to come to believe it yourself (or someone would have to show it): " + Q.believe[ans] + '. On the drawing the line keeps its side.'));
    else if (st.type === 'drawing') box.append(h('h2', null, lineWord(i) + ', the drawing turns to no'),
      h('p', null, "It was drawn yes. With the caution on, the tree's rule already reads a drawn yes as no, so this turn moves only the drawing: nothing new to believe."));
    else box.append(h('h2', null, lineWord(i) + ', turns to ' + ans),
      h('p', null, T.mustBelieve + Q.believe[ans] + '.' + (E.isDevice(st.was.how) ? " A drawn answer isn't yours: by the tree's rule only your own counts." : '')));
    box.append(h('p', null, svgNode(B.hexSVG(st.kinds, { hl: i })), last ? 'Arriving at ' : 'Passing through ', h('b', null, hexTitle(st.kinds)), '. ' + landedWords(E.landing(st.walk, leafFor))));
    if (st.line6Changed) box.append(h('p', null, line6Again(st.walk, st.kinds)));
    if (last) box.append(h('p', { class: 'small' }, l6Words(st.walk) + ' ' + T.pathIs));
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

// "Is there an action?" By the same rule as the tree view (fork-engine.js ruleOf): at most one leaf is named, and a
// casts' pick is shown as a pick. Line 6 reads the same for every leaf, so the hexagram and the notes agree.
function openLanding() {
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions, kinds = walkKinds(ui.walk), whole = B.isWhole(kinds), top = L.headline;
  const kick = L.caution ? E.TEXT.landingRule : top ? E.TEXT.landingOwn : L.pick ? E.TEXT.landingPick : E.TEXT.landingOpen;
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, kick), h('h2', { id: 'sheet-title', class: 'big' }, E.TEXT.landingAsk));
    if (top) {
      el.append(h('div', { class: 'leafbox' }, h('span', { class: 'small' }, L.caution ? "By the tree's rule you land on " : 'Your answers put you at '),
        h('b', null, nm(top)), la && la.leaves[top] ? ': ' + la.leaves[top].gloss : ''));
    } else if (L.pick) {
      el.append(h('div', { class: 'leafbox pick' }, h('span', { class: 'small' }, 'No single leaf is known. The drawn lines pick '),
        h('b', null, nm(L.pick)), la && la.leaves[L.pick] ? ': ' + la.leaves[L.pick].gloss : ''));
    } else el.append(h('p', null, 'Some lines are still open, so there is no single leaf yet.'));
    E.ruleText(L, nm).forEach((t, k) => el.append(h('p', { class: k ? 'small' : null },
      t.replace('The drawing shows where the answers as cast point', 'The hexagram and the drawing show where the lines as drawn point').replace('The casts picked', 'The drawn lines picked'),
      k === 0 ? [' ', why('burden')] : null)));
    if (L.throwSame) el.append(h('p', { class: 'small' }, E.throwSameText(nm(top))));
    const flip = E.flipLine(L, nm);
    if (flip) el.append(h('p', null, flip));
    if (!top) el.append(h('p', { class: 'small' }, E.TEXT.stillPossible), chips(L.still.map(nm), L.pick ? nm(L.pick) : null));
    if (whole) el.append(h('p', { class: 'hexline' }, svgNode(B.hexSVG(kinds)), 'As six lines: ', h('b', null, hexName(kinds)), '. ' + E.TEXT.hexFrame));
    el.append(h('p', { class: 'small' }, E.raceNote(L.answers.race, top, E.isDevice(ui.walk.lines[4].how)).replace(/^The race/, 'The race (line 5)')));
    if ((top || L.pick) && la) actionsBlock(el, top || L.pick, !top);
    if (!top && la) eitherBlock(el, L.still);
    if (!la) el.append(h('p', { class: 'warn' }, T.noNotes));
    if (L.pick) el.append(gladBlock(L));   // only when a new draw could change the pick
    const btns = h('div', { class: 'sheet-actions' });
    const decideLine = L.pickedBy != null ? L.pickedBy : firstOpen();
    if (L.throwSame) btns.append(h('button', { class: 'primary', onclick: () => { closeSheet(); setLine(decideLine); say("Decide it yourself: yes, no, or I don't know."); } }, 'Decide a line yourself'));
    if (whole) btns.append(h('button', { class: L.throwSame ? null : 'primary', onclick: () => { closeSheet(); startRelating(); } }, 'The reading'));
    if (L.anyCast) btns.append(h('button', { onclick: () => { closeSheet(); play(E.throwAgain(ui.walk).steps, () => { toTop(); openLanding(); }); } },
      L.throwMatters ? 'Draw again' : 'Draw again (the drawing only)'));
    btns.append(h('button', { onclick: openEither }, E.TEXT.eitherTitle),
      h('button', { onclick: () => openWalk(null) }, 'Walk to a leaf'));
    if (!L.throwSame) btns.append(h('button', { onclick: () => { closeSheet(); setLine(decideLine); } }, 'Change an answer'));
    btns.append(h('button', { class: 'ghost', onclick: closeSheet }, 'Back to the lines'));
    el.append(btns);
  });
}
function firstOpen() { const o = E.openLines(ui.walk)[0]; return o == null ? 0 : o; }
// What one leaf faces, and line 6 for it: the page's own reading, never cast. `picked`: only the drawn lines' pick.
// Each gloss shows only when its word is on screen.
function actionsBlock(el, leaf, picked) {
  const A = E.actionsFor([leaf], null, ui.leafActions, null)[leaf];
  const nd = A.noData, plain = nd.class === 'none' || nd.class === 'gap';
  el.append(h('h3', null, picked ? 'If you try ' + nm(leaf) + ', it faces' : 'What ' + nm(leaf) + ' faces'),
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
        h('p', null, (ew.sharedFaces.length ? E.TEXT.eitherShared + ' ' : '') + E.TEXT.eitherDangers),
        h('p', { class: 'small' }, E.TEXT.noList));
    }
    el.append(h('div', { class: 'sheet-actions' },
      h('button', { onclick: () => openLanding() }, L.headline ? 'Where you land' : E.TEXT.landingAsk),
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
      el.append(h('p', null, 'First the open ' + numWords(open) + (open.length === 1 ? ' is' : ' are') + ' drawn, so the start is a whole hexagram. ' +
        (open.length === 1 ? 'It is' : 'They are') + ' cast, not known, and only for this path: your walk keeps ' + (open.length === 1 ? 'it' : 'them') + ' open. Drawn from:'), bowls);
    }
    el.append(h('div', { class: 'opts' }, E.LEAVES.map(leaf => {
      const w = leafAnswers(leaf);
      if (!w) return null;
      const where = L.headline === leaf ? (L.caution ? " (where the tree's rule puts you)" : ' (where your answers put you)') : L.pick === leaf ? ' (the drawn lines’ pick)' : L.leaf === leaf ? ' (where the lines point, not where you land)' : '';
      return optBtn(nm(leaf) + where, 'line 3 ' + w.alignment + ', line 4 ' + w.containment,
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
  else if (E.LEAVES.includes(n)) { const L = E.landing(ui.walk, leafFor); if (L.leaf === n || L.headline === n) setLine(5); else openWalk(n); }
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
  const fromHash = E.decodeHash(location.hash), unread = !fromHash && E.isForkHash(location.hash);
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
    if (!d) { if (E.isForkHash(location.hash)) { say(T.unreadKept); writeHash(); } return; }
    if (d.seeded ? E.encodeHash(d.walk) === E.encodeHash(ui.walk) : E.sameLines(d.walk, ui.walk)) return;
    ui.token++; ui.playing = null; ui.casting = null; ui.inAir = null; ui.path = null; ui.last = null; ui.walk = d.walk;
    ui.line = firstUnasked();
    closeSheet();   // a sheet still open speaks of the old walk
    draw({ animate: false });
    // the message line follows the walk, so it never tells of a draw the page no longer shows
    say('Your walk, picked up from the page address, as six lines. ' + E.countsSummary(E.counts(ui.walk), 'lines') + '.');
  });
  say(unread ? T.unread + ' ' + T.hello : fromHash ? 'Your walk, picked up from the page address, as six lines. ' + E.countsSummary(E.counts(ui.walk), 'lines') + '.' : T.hello + ' ' + E.TEXT.coinIsFor);
  draw({ animate: false });
}
// the help box: a Close button inside it, and a tap outside it closes it
function wireHelp() {
  const help = $('help'), close = $('help-close');
  if (close) close.addEventListener('click', () => { help.open = false; help.querySelector('summary').focus(); });
  document.addEventListener('click', ev => { if (help.open && !help.contains(ev.target)) help.open = false; });
}

init();
