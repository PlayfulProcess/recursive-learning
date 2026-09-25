// The Fork, tree view: the page logic (panel, sheets, Cast 100 strip, landing, person walk, hash, keys).
// The rules live in fork-engine.js; the tree comes only through tree-adapter.js (the Film chat's renderer, or the
// stand-in until it lands). Everything the contract does not cover (the "cast, not known" tags, the tally, the
// Cast 100 strip, "1 of 2") is drawn here, in the game's own DOM, never inside the renderer.
// No percent sign in this file: odds are words or "N in M"; CSS lives in fork.css.
import { renderTree, NODES, leafFor, SOURCE, LABELS } from './tree-adapter.js';
import * as E from './fork-engine.js';

const EXPLAINER = '../../explainers/risk-and-uncertainty/';
const SHARED_PEOPLE = '../../explainers/belief-tree/people.json';
const EXAMPLE_PEOPLE = './people.example.json';
// 'auto': the film's people file when it is published (the contract default, decision 3); 'example': hold the
// real people back and walk only the two made-up placeholders.
const PEOPLE = 'auto';
const HOLD = 600, SAFETY = 2200, PERSON_PAUSE = 3200;
const Q_ORDER = ['gate', 'alignment', 'containment', 'race'];
const Q_LINE = { alignment: 2, containment: 3, race: 4 };
const LINE_NAME = ['out for good (the gate, part 1)', 'no trial first (the gate, part 2)', 'alignment', 'containment', 'the race'];
const DEVICE_SAYS = { coin: 'the coin', yarrow: 'the yarrow bowl', coins: 'the coin bowl' };
const IN_AIR = { coin: 'the coin is in the air…', yarrow: 'drawing from the yarrow bowl…', coins: 'drawing from the coin bowl…' };
const BOX = { gate: 'gate', alignment: 'alignment', 'containment-if-aligned': 'containment (if aligned)', 'containment-if-not': 'containment (if not aligned)', race: 'race' };

const $ = id => document.getElementById(id);
const treeEl = $('tree'), captionEl = $('caption'), stripEl = $('strip'), panelEl = $('panel'), skipEl = $('skip'), ruleEl = $('rulebar');
const sheet = $('sheet'), sheetIn = $('sheet-in');
const params = new URLSearchParams(location.search);
const oneOf = (v, ok, d) => (ok.includes(v) ? v : d);

const ui = {
  walk: null, q: 'gate', gateRow: 0, tapped: null,
  casting: null, token: 0, playing: null, inAir: null,
  people: [], peopleFrom: 'none', person: null,
  theme: oneOf(params.get('theme'), ['dark', 'light', 'auto'], 'dark'),
  method: oneOf(params.get('method'), ['coin', 'yarrow'], 'coin'),
  leafActions: null, more: false, labelFor: 'coin', strip: null
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
function mmss(s) { if (s == null || isNaN(s)) return 'the source'; s = Math.floor(s); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r; }
async function getJSON(u) { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function leafFixed() { const L = ui.walk.lines; return L[2].how === 'decide' && L[3].how === 'decide'; }
function lineNow() { return ui.q === 'gate' ? ui.gateRow : Q_LINE[ui.q]; }

// ── drawing ────────────────────────────────────────────────────────────────────────────────────
function shownWalk() { return ui.person ? ui.person.walk : ui.walk; }
// The made-up example people are not drawn on the tree (two unexplained initials under the leaves read as real
// people): they appear only while one of them is being walked. The film's own people file, once published, is.
function treeState() {
  const people = ui.peopleFrom === 'example' ? (ui.person ? ui.people.filter(p => p.slug === ui.person.slug) : []) : ui.people;
  return E.toTreeState(shownWalk(), { focus: ui.person ? ui.person.slug : null, people, casting: ui.casting, theme: ui.theme, leafFor });
}
function draw(opts) {
  skipEl.hidden = !ui.playing;
  renderTree(treeEl, treeState(), opts || { animate: true });
  renderPanel();
  renderStrip();
  renderRule();
  renderViews();
  writeHash();
}
// Under the tree, in the game's own DOM: when the drawing lights a leaf the rule does not put you on, or when the
// lit leaf is only the casts' pick, say so where the drawing is (not only in the sheet).
function renderRule() {
  if (!ruleEl) return;
  const L = ui.person || ui.inAir ? null : E.landing(ui.walk, leafFor);
  let t = '';
  if (L && L.drawnDiffers) t = 'The drawing points at ' + nm(L.leaf) + " (dashed: cast). By the tree's rule you land on " + nm(L.headline) + '.';
  else if (L && L.pick) t = 'The casts picked ' + nm(L.pick) + ' (dashed): a pick, not a finding.';
  ruleEl.hidden = !t;
  ruleEl.textContent = t;
}
function renderPanel() {
  const a = document.activeElement;
  const key = a && panelEl.contains(a) ? a.getAttribute('data-k') : null;
  panelEl.textContent = '';
  panelEl.append(ui.person ? personPanel() : ui.q === 'gate' ? gatePanel() : questionPanel(ui.q));
  hideIdleMore();
  if (key) { const again = panelEl.querySelector('[data-k="' + key + '"]'); if (again && !again.disabled) again.focus({ preventScroll: true }); }
}
// "more" only unclamps the belief lines on a question: where nothing is clamped (a wide screen), it would do
// nothing, so it is hidden
function hideIdleMore() {
  const box = panelEl.querySelector('.answers.clamp'), btn = panelEl.querySelector('.more');
  if (!box || !btn || ui.more) return;
  const clipped = [...box.querySelectorAll('.believe')].some(b => b.scrollHeight > b.clientHeight + 1);
  if (!clipped) btn.hidden = true;
}
function renderViews() {
  const slot = $('to-lines');
  if (!slot) return;
  const search = ui.theme !== 'dark' ? '?theme=' + ui.theme : '';
  const href = 'lines.html' + search + E.encodeHash(ui.walk);
  if (slot.tagName !== 'A') { const a = h('a', { id: 'to-lines', href }, 'six lines'); slot.replaceWith(a); }
  else slot.setAttribute('href', href);
}
function writeHash() {
  const hash = E.encodeHash(ui.walk, { person: ui.person ? ui.person.slug : null });
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

// ── the panel ──────────────────────────────────────────────────────────────────────────────────
// the gate is answered when both parts are, or when the player's own no on one part settles it
function answeredQ(q) {
  const L = ui.walk.lines;
  if (q !== 'gate') return L[Q_LINE[q]].answer != null;
  return (L[0].answer != null && L[1].answer != null) || E.mootLines(ui.walk).length > 0;
}
function kicker(q, extra) {
  const n = Q_ORDER.indexOf(q);
  const dots = h('span', { class: 'dots', 'aria-hidden': 'true' }, Q_ORDER.map((x, i) => h('i', { class: i === n ? 'on' : answeredQ(x) ? 'done' : '' })));
  return h('p', { class: 'kicker' }, h('span', null, 'Question ' + (n + 1) + ' of 4' + (extra ? ' · ' + extra : '')), dots, moreBtn());
}
function moreBtn() {
  return h('button', { class: 'linkish more', 'data-k': 'more', 'aria-expanded': String(ui.more), onclick: () => { ui.more = !ui.more; renderPanel(); } }, ui.more ? 'less' : 'more');
}
function questionPanel(q) {
  const i = Q_LINE[q], Q = E.QUESTIONS[i], l = ui.walk.lines[i], busy = !!ui.playing, own = l.how === 'decide';
  const box = BOX[q === 'containment' ? (ui.tapped || E.nodeFor(ui.walk, 3)) : q];
  const ans = a => h('div', { class: 'ans' },
    h('button', { 'data-k': 'ans-' + a, 'aria-pressed': own && l.answer === a ? 'true' : 'false', disabled: busy, onclick: () => doDecide(i, a) }, a === 'yes' ? 'Yes' : 'No'),
    h('p', { class: 'believe' }, "you'd have to believe " + Q.believe[a]));
  return h('div', null,
    kicker(q, 'the ' + box + ' box'),
    h('h2', null, Q.ask),
    h('div', { class: 'answers' + (ui.more ? '' : ' clamp') }, ans('yes'), ans('no')),
    castRow([i], l.how === 'unknown'),
    status(q, [i]),
    foot());
}
function gatePanel() {
  const L = ui.walk.lines, busy = !!ui.playing;
  const moot = E.mootLines(ui.walk);
  const rows = [0, 1].map(i => {
    const Q = E.QUESTIONS[i], l = L[i], own = l.how === 'decide';
    const chip = (a, label) => h('button', {
      'data-k': 'g' + i + a, disabled: busy,
      'aria-pressed': (own || a === 'unknown') && l.answer === a ? 'true' : 'false',
      'aria-label': Q.ask + ' ' + (a === 'unknown' ? "I don't know" : a),
      class: a === 'unknown' ? 'idk' : null,
      onclick: () => { ui.gateRow = i; if (a === 'unknown') doUnknown(i); else doDecide(i, a); }
    }, label);
    return h('div', { class: 'gate-row' + (ui.gateRow === i ? ' cur' : '') },
      h('span', { class: 'gq' }, (i + 1) + '. ' + Q.ask),
      h('span', { class: 'chips' }, chip('yes', 'yes'), chip('no', 'no'), chip('unknown', "don't know")),
      l.answer != null ? h('span', { class: 'held' }, rowHeld(l), own ? [' · ', h('button', { class: 'linkish', 'data-k': 'loose' + i, disabled: busy, onclick: () => toggleLoose(i) }, E.isTurning(l.kind) ? 'hold it steady' : 'hold it loosely')] : null)
        : moot.includes(i) ? h('span', { class: 'held' }, 'not needed: your no on part ' + (2 - i) + ' settles the gate') : null,
      ui.more ? h('span', { class: 'held' }, "yes: you'd have to believe " + Q.believe.yes + '. No: ' + Q.believe.no + '.') : null);
  });
  // a cast never quietly replaces a part you decided: the buttons cast only the parts that are not yours (and not
  // a part your own no has made moot)
  const notMine = [0, 1].filter(i => L[i].how !== 'decide' && !moot.includes(i));
  const targets = notMine.length ? notMine : moot.length ? [0, 1].filter(i => !moot.includes(i)) : [0, 1];
  const which = notMine.length === 2 ? 'both' : notMine.length === 1 ? 'part ' + (notMine[0] + 1) : moot.length ? 'part ' + (2 - moot[0]) + ' (replaces your no)' : 'both (replaces your answers)';
  return h('div', null,
    kicker('gate', 'the gate box, two parts'),
    h('h2', null, E.TREE_QUESTIONS[0].ask),
    rows,
    h('div', { class: 'row' },
      h('button', { 'data-k': 'coin', disabled: busy, onclick: () => doCast(targets, 'coin') }, 'Flip for ' + which),
      h('button', { 'data-k': 'yarrow', disabled: busy, onclick: () => doCast(targets, 'yarrow') }, 'Yarrow for ' + which)),
    h('p', { class: 'slicing' }, E.TREE_QUESTIONS[0].note + ' ' + E.TEXT.slicing + ' ', why('slicing')),
    status('gate', [0, 1]),
    foot());
}
function rowHeld(l) {
  if (l.how === 'unknown') return "I don't know: it stays open";
  if (E.isDevice(l.how)) return E.TEXT.castTag + ': ' + l.answer + (E.isTurning(l.kind) ? ', could flip' : '');
  return 'yours: ' + l.answer + ', ' + (E.isTurning(l.kind) ? 'held loosely' : 'held steady');
}
function castRow(lines, unknownNow) {
  const busy = !!ui.playing, i = lines[0];
  const m = E.METHODS[ui.labelFor];
  return [
    h('div', { class: 'casts' },
      h('button', { 'data-k': 'coin', disabled: busy, onclick: () => doCast(lines, 'coin'), onfocus: () => setLabel('coin'), onmouseenter: () => setLabel('coin') }, 'Flip a coin'),
      h('button', { 'data-k': 'yarrow', disabled: busy, onclick: () => doCast(lines, 'yarrow'), onfocus: () => setLabel('yarrow'), onmouseenter: () => setLabel('yarrow') }, 'Yarrow'),
      h('button', { class: 'idk', 'data-k': 'idk', 'aria-pressed': unknownNow ? 'true' : 'false', disabled: busy, onclick: () => doUnknown(i) }, "I don't know")),
    h('p', { class: 'mlabel', id: 'mlabel' }, m.label + ' ', why(m.anchor))
  ];
}
function setLabel(k) {
  if (ui.labelFor === k) return;
  ui.labelFor = k;
  const el = $('mlabel');
  if (el) { el.textContent = E.METHODS[k].label + ' '; el.append(why(E.METHODS[k].anchor)); }
}
function status(q, lines) {
  const box = h('div', { class: 'status' }), L = ui.walk.lines;
  // the gate's two rows already say how each part is held; here only the question panels carry the tag
  if (q !== 'gate') {
    const i = lines[0], l = L[i];
    if (l.how === 'decide') {
      box.append(h('p', null, h('span', { class: 'tag own' }, E.heldWord(l)), 'Your answer: ' + l.answer + '. ',
        h('button', { class: 'linkish', 'data-k': 'loose', disabled: !!ui.playing, onclick: () => toggleLoose(i) }, E.isTurning(l.kind) ? 'hold it steady instead' : 'hold it loosely instead')));
    } else if (E.isDevice(l.how)) {
      box.append(h('p', null, h('span', { class: 'tag' }, E.TEXT.castTag),
        cap(DEVICE_SAYS[l.how]) + ' says ' + l.answer + (E.isTurning(l.kind) ? ', turning: it could flip' : '') + '. ' + E.castAfter(l.how).replace(/^Cast, not known\. /, '')));
    } else if (l.how === 'unknown') {
      box.append(h('p', { class: 'after' }, E.TEXT.afterUnknown));
    }
  }
  const after = E.afterLine(q, ui.walk);
  const nx = Q_ORDER[Q_ORDER.indexOf(q) + 1];
  const next = nx && answeredQ(q) && !ui.playing ? h('button', { class: 'linkish', 'data-k': 'next', onclick: () => setQ(nx) }, 'Next question') : null;
  if (after || next) box.append(h('p', { class: 'after' }, after ? after + ' ' : '', next));
  return box;
}
function foot() {
  const busy = !!ui.playing, fixed = leafFixed();
  return h('div', { class: 'foot' },
    h('p', { class: 'tally' }, E.countsSummary(E.counts(ui.walk), 'answers'), ' · ', why('short', 'risk or uncertainty?')),
    h('div', { class: 'row' },
      h('button', { class: 'primary', 'data-k': 'gap', disabled: busy, onclick: openClose }, 'Close the gap'),
      // greyed with its reason on the button itself: a tablet can't show a hover tooltip
      h('button', { 'data-k': 'c100', disabled: busy, 'aria-disabled': fixed ? 'true' : null, onclick: openCast100 }, 'Cast 100', fixed ? h('small', { class: 'why-off' }, 'nothing to cast') : null),
      h('button', { 'data-k': 'people', disabled: busy, onclick: openPeople }, 'Walk it as…')));
}
function setQ(q) {
  ui.q = q;
  if (q !== 'containment') ui.tapped = null;
  if (q === 'gate') ui.gateRow = ui.walk.lines[0].answer != null && ui.walk.lines[1].answer == null ? 1 : 0;
  renderPanel();
}
function moveQ(d) {
  if (ui.q === 'gate' && d > 0 && ui.gateRow === 0) { ui.gateRow = 1; renderPanel(); return; }
  if (ui.q === 'alignment' && d < 0) { ui.q = 'gate'; ui.gateRow = 1; renderPanel(); return; }
  if (ui.q === 'gate' && d < 0 && ui.gateRow === 1) { ui.gateRow = 0; renderPanel(); return; }
  const n = Q_ORDER.indexOf(ui.q) + d;
  if (n >= 0 && n < Q_ORDER.length) setQ(Q_ORDER[n]);
}

// ── moves, and playing them at the node ──────────────────────────────────────────────────────
function doDecide(i, a) {
  if (ui.playing || ui.person) return;
  const r = E.decide(ui.walk, i, a, { node: i === 3 ? ui.tapped : null });
  if (ui.q === 'gate' && i === 0 && !E.mootLines(r.walk).length) ui.gateRow = 1;
  play([{ walk: r.walk, casting: r.casting, line: i }]);
}
function doUnknown(i) {
  if (ui.playing || ui.person) return;
  const r = E.dontKnow(ui.walk, i, { node: i === 3 ? ui.tapped : null });
  if (ui.q === 'gate' && i === 0) ui.gateRow = 1;
  play([{ walk: r.walk, casting: r.casting, line: i }]);
}
function doCast(lines, method) {
  if (ui.playing || ui.person) return;
  setLabel(method);
  const r = E.castLines(ui.walk, lines, method, { node: ui.tapped });
  play(r.steps);
}
function toggleLoose(i) {
  if (ui.playing) return;
  const l = ui.walk.lines[i], r = E.setLoose(ui.walk, i, !E.isTurning(l.kind));
  ui.walk = r.walk;
  say(cap(LINE_NAME[i]) + ': ' + E.heldWord(ui.walk.lines[i]) + '.');
  draw();
}
function whereOf(i) { return i < 2 ? 'The gate, ' + (i + 1) + ' of 2 (' + E.QUESTIONS[i].short.replace('?', '').toLowerCase() + ')' : cap(LINE_NAME[i]); }
function airCaption(s, k, n) {
  const l = s.walk.lines[s.line];
  return whereOf(s.line) + ': ' + IN_AIR[l.how] + (n > 1 ? ' (' + k + ' of ' + n + ')' : '');
}
function captionFor(s, k, n) {
  const i = s.line, l = s.walk.lines[i];
  const where = whereOf(i);
  const of = n > 1 && i >= 2 ? ' (' + k + ' of ' + n + ')' : '';
  if (l.how === 'decide') return where + ': ' + l.answer + ', ' + E.heldWord(l) + '.' + of;
  if (l.how === 'unknown') return where + ": I don't know. It stays open." + of;
  return where + ': ' + DEVICE_SAYS[l.how] + ' says ' + l.answer + (E.isTurning(l.kind) ? ', turning' : '') + '. ' + E.castAfter(l.how) + of;
}
// Play steps one at a time at their nodes. A device cast plays "in the air" first: the tree's answers, the panel
// and the caption keep the walk as it was until the renderer's castend (or a safety timeout), so nothing gives the
// result away while the coin spins; then the result lands everywhere at once, and a short hold. A decision or
// "I don't know" shows at once (the player chose it). The casting object stays the same after its castend, so a
// re-render never restarts it. A token makes late events from an older sequence harmless. Skip (or Esc) jumps to
// the end.
function play(steps, done) {
  if (!steps.length) { draw(); if (done) done(); return; }
  const token = ++ui.token;
  ui.playing = { token, final: steps[steps.length - 1].walk, done, steps };
  let k = 0;
  const next = () => {
    if (token !== ui.token) return;
    if (k >= steps.length) { ui.playing = null; ui.inAir = null; draw(); if (done) done(); return; }
    const s = steps[k++];
    const device = E.isDevice(s.walk.lines[s.line].how);
    ui.casting = s.casting;
    if (device) { ui.inAir = s; say(airCaption(s, k, steps.length)); } else ui.walk = s.walk;
    drawThenEnd(s.casting, token, () => {
      if (device) { ui.walk = s.walk; ui.inAir = null; draw(); }
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
  ui.walk = p.final;
  draw({ animate: false });
  say('Skipped to the end. ' + captionFor(p.steps[p.steps.length - 1], p.steps.length, p.steps.length));
  if (p.done) p.done();
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
  if (ui.playing || ui.person) return;
  const open = E.neededOpenLines(ui.walk);
  openSheet(el => {
    el.append(h('h2', { id: 'sheet-title' }, E.TEXT.closeTitle));
    if (!open.length) {
      el.append(h('p', null, 'Nothing is open: every question has an answer, yours or cast. A cast answer is still not known.'),
        h('div', { class: 'opts' },
          optBtn('See where you land', E.TEXT.landingAsk, () => openLanding(), true),
          optBtn(E.TEXT.eitherTitle, 'casts nothing', openEither)),
        closeRow('Not now'));
      return;
    }
    if (open.length === 5) el.append(h('p', { class: 'warn' }, E.TEXT.allFive));
    el.append(h('p', { class: 'small' }, 'Open: ' + E.listWords(open.map(i => LINE_NAME[i])) + '.'));
    const ways = [
      optBtn('Flip coins for the open ones', 'one coin each: its odds are 1 in 2 because we made it so', () => closeBy('coin'), ui.method === 'coin'),
      optBtn('Draw yarrow for the open ones', 'half yes, half no; 1 in 4 comes up turning (it could flip)', () => closeBy('yarrow'), ui.method === 'yarrow')
    ];
    if (ui.method === 'yarrow') ways.reverse();
    el.append(h('div', { class: 'opts' }, ways,
      optBtn('One at a time', "each open one: yes, no, flip, or I don't know", () => stepper(open, 0)),
      optBtn(E.TEXT.eitherTitle, 'casts nothing: what you face under every leaf still possible', openEither)),
      closeRow('Not now'));
  });
}
function closeBy(way) {
  closeSheet();
  const r = E.closeTheGap(ui.walk, way, { needed: true });
  play(r.steps, () => openLanding());
}
function stepper(prompts, k) {
  if (k >= prompts.length) { openLanding(); return; }
  const i = prompts[k], Q = E.QUESTIONS[i];
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, 'One at a time · ' + (k + 1) + ' of ' + prompts.length),
      h('h2', { id: 'sheet-title' }, Q.ask),
      h('div', { class: 'row' },
        h('button', { autofocus: true, onclick: () => stepMove(prompts, k, 'yes') }, 'Yes'),
        h('button', { onclick: () => stepMove(prompts, k, 'no') }, 'No'),
        h('button', { onclick: () => stepMove(prompts, k, 'coin') }, 'Flip a coin'),
        h('button', { class: 'idk', onclick: () => stepMove(prompts, k, 'unknown') }, "I don't know")),
      h('p', { class: 'small' }, "Yes: you'd have to believe " + Q.believe.yes + '.'),
      h('p', { class: 'small' }, "No: you'd have to believe " + Q.believe.no + '.'),
      closeRow('Stop here'));
  }, { light: true });
}
function stepMove(prompts, k, m) {
  const i = prompts[k];
  const r = m === 'yes' || m === 'no' ? E.decide(ui.walk, i, m) : m === 'coin' ? E.cast(ui.walk, i, 'coin') : E.dontKnow(ui.walk, i);
  closeSheet();
  play([{ walk: r.walk, casting: r.casting, line: i }], () => stepper(prompts, k + 1));
}

// "Is there an action?" At most one leaf is named, and only by the tree's rule (fork-engine.js ruleOf): with the
// caution on, the leaf your own answers give when every cast or open answer reads as not shown; with it off, the
// leaf your own alignment and containment give. When the caution is off and a cast picked alignment or
// containment, no leaf is named: the casts' pick is shown as a pick, with what is still possible. The notes, the
// lever reading, the flip line and Cast 100 all follow the same rule, so the sheet never names two landings.
function openLanding() {
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions, top = L.headline;
  const kick = L.caution ? E.TEXT.landingRule : top ? E.TEXT.landingOwn : L.pick ? E.TEXT.landingPick : E.TEXT.landingOpen;
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, kick), h('h2', { id: 'sheet-title', class: 'big' }, E.TEXT.landingAsk));
    if (top) {
      el.append(h('div', { class: 'leafbox' }, h('span', { class: 'small' }, L.caution ? "By the tree's rule you land on " : 'Your answers put you at '),
        h('b', null, nm(top)), la && la.leaves[top] ? ': ' + la.leaves[top].gloss : ''));
    } else if (L.pick) {
      el.append(h('div', { class: 'leafbox pick' }, h('span', { class: 'small' }, 'No single leaf is known. The casts picked '),
        h('b', null, nm(L.pick)), la && la.leaves[L.pick] ? ': ' + la.leaves[L.pick].gloss : ''));
    } else el.append(h('p', null, 'Some answers are still open, so there is no single leaf yet.'));
    E.ruleText(L, nm).forEach((t, k) => el.append(h('p', { class: k ? 'small' : null }, t, k === 0 ? [' ', why('burden')] : null)));
    if (L.throwSame) el.append(h('p', { class: 'small' }, E.throwSameText(nm(top))));
    if (L.flipLeaf) el.append(h('p', null, E.flipText(nm(L.flipLeaf))));
    if (!top) el.append(h('p', { class: 'small' }, E.TEXT.stillPossible), chips(L.still.map(nm), L.pick ? nm(L.pick) : null));
    el.append(h('p', { class: 'small' }, E.raceNote(L.answers.race, top, E.isDevice(ui.walk.lines[4].how))));
    if ((top || L.pick) && la) actionsBlock(el, top || L.pick, !top);
    if (!top && la) eitherBlock(el, L.still);
    if (!la) el.append(h('p', { class: 'warn' }, "The notes on each leaf didn't load."));
    if (L.pick) el.append(gladBlock(L));   // only when a new cast could change the pick
    const btns = h('div', { class: 'sheet-actions' });
    const decideQ = L.pickedBy === 2 ? 'alignment' : L.pickedBy === 3 ? 'containment' : firstOpenQ();
    const change = h('button', { class: L.throwSame ? 'primary' : null, onclick: () => { closeSheet(); setQ(decideQ); say("Decide it yourself: yes, no, or I don't know."); } },
      L.throwSame ? 'Decide a question yourself' : 'Change an answer');
    if (L.throwSame) btns.append(change);
    if (L.anyCast) btns.append(h('button', { class: L.throwMatters ? 'primary' : null, onclick: () => { closeSheet(); play(E.throwAgain(ui.walk).steps, () => openLanding()); } },
      L.throwMatters ? 'Throw again' : 'Throw again (the drawing only)'));
    btns.append(h('button', { onclick: openEither }, E.TEXT.eitherTitle));
    if (!L.throwSame) btns.append(change);
    btns.append(h('button', { onclick: openCast100, 'aria-disabled': leafFixed() ? 'true' : null }, 'Cast 100'),
      h('button', { class: 'ghost', onclick: closeSheet }, 'Back to the tree'));
    el.append(btns);
  });
}
function firstOpenQ() { const o = E.neededOpenLines(ui.walk)[0]; return o == null ? 'gate' : o < 2 ? 'gate' : Q_ORDER[o - 1]; }
// What one leaf faces, and whether a lever is known to work there (the page's own reading, never cast). `picked`:
// the leaf is only the casts' pick, not a landing. Each gloss shows only when its word is on screen.
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
    h('h3', null, 'Is a lever known to work here?'),
    h('p', null, E.line6Sentence(A.line6, 'tree')),
    h('p', { class: 'small' }, A.line6.why + ' ' + E.TEXT.leverIntro));
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
      ['Sorry', () => show(E.TEXT.sorry, h('button', { class: 'linkish', onclick: () => { closeSheet(); setQ(L.pickedBy === 3 ? 'containment' : 'alignment'); say("Decide it yourself: yes, no, or I don't know."); } }, 'Decide it yourself'))],
      ['Neither', () => show(E.TEXT.neither)]]),
    out);
}
function openEither() {
  if (ui.playing || ui.person) return;
  const L = E.landing(ui.walk, leafFor), la = ui.leafActions;
  openSheet(el => {
    el.append(h('p', { class: 'kicker' }, 'Casts nothing'), h('h2', { id: 'sheet-title' }, E.TEXT.eitherTitle),
      h('p', { class: 'small' }, "When you can't close the gap by knowing, look for what holds under every answer still possible. Cast answers count as open here: a coin found nothing out. ", why('either-way')),
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
      h('button', { class: 'ghost', onclick: closeSheet, autofocus: true }, 'Back to the tree')));
  });
}

// Cast 100: the device's spread, never the world's
const DEVICE_SUB = {
  coin: 'odds we made: 1 in 2', yarrow: 'odds we made: half yes, half no',
  'urn-new': "a jar of marbles (an 'urn') whose mix we don't show you, new every draw", 'urn-one': "one jar of marbles whose mix we don't show you, kept for all 100"
};
function openCast100() {
  if (ui.playing || ui.person) return;
  if (leafFixed()) { closeSheet(); say(E.TEXT.fixed); return; }
  openSheet(el => {
    const res = h('div', { 'aria-live': 'polite' });
    el.append(h('h2', { id: 'sheet-title' }, 'Cast 100'),
      h('p', { class: 'small' }, "Re-cast the open and cast questions 100 times with one device. Your decided answers stay. The counts show where the drawing points each time: the device's spread, not landings and not the world's odds."),
      h('div', { class: 'opts' }, Object.keys(E.DEVICES).map((d, k) => optBtn(cap(E.DEVICES[d].name), DEVICE_SUB[d], () => runCast100(d, res), k === 0))),
      res, closeRow());
  });
}
function spreadLines(r, d) {
  const out = [E.spreadLabel(d)];
  if (r.gateParts > 0 && !r.gateSettled) out.push(E.gateSpreadLine(r.gateYes, d, r.gateParts, r.caution));
  const t = E.turningLine(r);
  if (t) out.push(t);
  return out;
}
function runCast100(d, res) {
  const r = E.cast100(ui.walk, d, leafFor);
  if (r.fixed) { res.textContent = E.TEXT.fixed; return; }
  ui.strip = { r, d, hash: E.encodeHash(ui.walk) };
  renderStrip();
  const out = h('p', { class: 'reply', hidden: true });
  res.textContent = '';
  res.append(h('p', { class: 'small' }, E.drawnHead(d)),
    h('div', { class: 'counts' }, E.LEAVES.map(l => h('span', null, nm(l) + ': ' + E.countsLabel(r.counts[l] || 0, d)))),
    h('p', null, E.ruleLine100(r, r.rule ? nm(r.rule) : '')),
    ...spreadLines(r, d).map(t => h('p', { class: 'small' }, t)),
    h('p', null, h('b', null, E.TEXT.riskAsk)),
    pickRow(Object.keys(E.RISK_PICKS).map(p => [cap(E.RISK_PICKS[p]), () => {
      out.hidden = false; out.textContent = E.riskReply(p, d) + ' ';
      out.append(why('short', 'risk or uncertainty?'), ' · ', why('urn', 'the hidden jar (urn)'), ' · ', why('slicing', 'cutting the question'), ' · ', why('coin-metaphor', 'is a coin a good metaphor?'));
    }])),
    out);
}
function renderStrip() {
  const s = ui.strip;
  if (!s || ui.person || s.hash !== E.encodeHash(ui.walk)) { stripEl.hidden = true; return; }
  stripEl.hidden = false;
  stripEl.textContent = '';
  stripEl.append(h('div', { class: 'lab' }, E.drawnHead(s.d)),
    h('div', { class: 'cells' }, E.LEAVES.map(l => h('span', null, nm(l) + ': ' + E.countsLabel(s.r.counts[l] || 0, s.d)))),
    h('div', { class: 'lab rule' }, s.r.rule ? "By the tree's rule: " + nm(s.r.rule) + ', in ' + s.r.runs + ' of ' + s.r.runs + '.' : "Picks, not landings: you said the step can be undone or tried first."),
    h('div', { class: 'lab' }, spreadLines(s.r, s.d).join(' · ')));
}

// ── walk it as a person ────────────────────────────────────────────────────────────────────────
function openPeople() {
  if (ui.playing) return;
  openSheet(el => {
    el.append(h('h2', { id: 'sheet-title' }, 'Walk it as…'));
    if (ui.peopleFrom === 'example') el.append(h('p', { class: 'warn' }, "Made-up examples to test the walk, not real people. Real people's walks appear here once the film's people file is published."));
    if (!ui.people.length) el.append(h('p', null, 'No people loaded.'));
    el.append(h('div', { class: 'opts' }, ui.people.map((p, k) => optBtn(p.name || p.slug,
      (p.role ? p.role + ' · ' : '') + 'says: ' + (p.stated_leaf ? nm(p.stated_leaf) : 'no leaf'),
      () => { closeSheet(); startPerson(p.slug, true); }, k === 0))), closeRow());
  });
}
function startPerson(slug, auto) {
  const p = ui.people.find(x => x && x.slug === slug);
  if (!p) { say('No one called ' + slug + ' in the people file.'); return; }
  stopTimers();
  ui.token++; ui.playing = null; ui.casting = null;
  ui.person = { slug, p, pw: E.personWalk(p, leafFor), i: -1, auto: !!auto, walk: E.walkFromPerson(p, ui.walk, -1), timer: 0 };
  personGo(0);
}
function stopTimers() { if (ui.person) clearTimeout(ui.person.timer); }
function personGo(i) {
  const P = ui.person;
  if (!P) return;
  clearTimeout(P.timer);
  const token = ++ui.token;
  if (i >= 4) {
    P.i = 4; P.walk = E.walkFromPerson(P.p, ui.walk, 3); ui.casting = null;
    draw();
    say('They say: ' + (P.pw.stated_leaf ? nm(P.pw.stated_leaf) : 'no leaf') + '. By this page’s reading, their answers lead to: ' + (P.pw.computedLeaf ? nm(P.pw.computedLeaf) : 'a question still open') + '.');
    return;
  }
  P.i = Math.max(0, i);
  const st = P.pw.steps[P.i], yn = st.answer === 'yes' || st.answer === 'no';
  P.walk = E.walkFromPerson(P.p, ui.walk, P.i);
  const casting = { node: st.node, method: yn ? 'decide' : 'unknown', result: yn ? st.answer : 'unknown' };
  ui.casting = casting;
  say((P.p.name || P.slug) + ', ' + E.TREE_QUESTIONS[P.i].ask.toLowerCase() + ' ' + E.answerWord(st.answer) + '.');
  drawThenEnd(casting, token, () => {
    if (P.auto && ui.person === P) P.timer = setTimeout(() => { if (token === ui.token && ui.person === P) personGo(P.i + 1); }, PERSON_PAUSE);
  });
}
function personNav(d) { const P = ui.person; if (!P) return; P.auto = false; personGo(Math.min(4, Math.max(0, P.i + d))); }
function stopPerson(adopt) {
  const P = ui.person;
  if (!P) return;
  clearTimeout(P.timer);
  ui.token++; ui.casting = null; ui.person = null;
  if (adopt) {
    ui.walk = E.walkFromPerson(P.p, ui.walk, 3);
    ui.q = 'gate'; ui.gateRow = 0;
    say(E.TEXT.yourTurn + " Every question still offers I don't know.");
  } else say('Back to your own walk.');
  draw({ animate: false });
}
function sourceLink(q) {
  if (!q || !q.url) return null;
  let u;
  try { u = new URL(q.url); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (q.start_sec != null && /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) u.searchParams.set('t', Math.floor(q.start_sec) + 's');
  return h('a', { href: u.href, target: '_blank', rel: 'noopener' }, q.start_sec != null ? 'watch at ' + mmss(q.start_sec) : 'the source');
}
function personPanel() {
  const P = ui.person, pw = P.pw, example = ui.peopleFrom === 'example';
  const wrap = h('div', { class: 'person' },
    h('p', { class: 'kicker' }, h('span', null, 'Walking as ' + (P.p.name || P.slug) + (example ? ' · made-up example' : ''))));
  if (P.i < 4) {
    const st = pw.steps[P.i];
    wrap.append(h('h2', null, E.TREE_QUESTIONS[P.i].ask),
      h('p', null, 'Their answer: ', h('b', null, E.answerWord(st.answer)), P.i === 0 ? ' (one answer for both parts of the gate)' : ''));
    if (st.basis) wrap.append(h('p', { class: 'basis' }, st.basis));
    if (st.quote) {
      const q = st.quote, src = h('p', { class: 'src' }, q.source_label || 'source');
      const link = sourceLink(q);
      if (link) src.append(' · ', link);
      if (q.how_checked && q.how_checked !== 'placeholder') src.append(' · checked: ' + q.how_checked);
      wrap.append(h('blockquote', null, q.text || '', q.verbatim === false ? h('span', { class: 'small' }, ' (paraphrase)') : null), src);
    }
  } else {
    const said = pw.stated_leaf ? nm(pw.stated_leaf) : 'no leaf';
    const reading = pw.computedLeaf ? nm(pw.computedLeaf) : 'still open between ' + E.listWords(pw.possible.map(nm));
    wrap.append(h('h2', null, 'They say: ' + said + '. By this page’s reading of their words, their answers lead to: ' + reading + '.'));
    if (pw.mismatch) wrap.append(h('p', { class: 'warn' }, E.TEXT.differ));
    if (pw.own_conditional) wrap.append(h('p', null, pw.own_conditional));
    pw.to_move.forEach(t => wrap.append(h('p', { class: 'small' }, 'To move to ' + nm(t.to) + ' they would have to believe ' + t.would_have_to_believe + '.')));
    if (pw.confidence) wrap.append(h('p', { class: 'small' }, 'How sure this reading is: ' + pw.confidence + '.'));
    if (pw.cautions[0]) wrap.append(h('p', { class: 'small' }, pw.cautions[0]));
    if (pw.cautions.length > 1) wrap.append(h('details', { class: 'more' }, h('summary', null, 'More cautions'), pw.cautions.slice(1).map(c => h('p', { class: 'small' }, c))));
    wrap.append(h('p', null, h('b', null, E.TEXT.yourTurn)));
  }
  const atEnd = P.i >= 4;
  wrap.append(h('div', { class: 'row' },
    h('button', { 'data-k': 'p-back', disabled: P.i <= 0, onclick: () => personNav(-1) }, 'Back'),
    atEnd ? h('button', { class: 'primary', 'data-k': 'p-adopt', onclick: () => stopPerson(true) }, 'Start from their answers')
      : h('button', { class: 'primary', 'data-k': 'p-next', onclick: () => personNav(1) }, 'Next'),
    atEnd ? null : h('button', { 'data-k': 'p-auto', onclick: () => { P.auto = !P.auto; if (P.auto) personGo(P.i + 1); else { clearTimeout(P.timer); renderPanel(); } } }, P.auto ? 'Pause' : 'Play'),
    h('button', { class: 'ghost', 'data-k': 'p-stop', onclick: () => stopPerson(false) }, 'Back to my walk')));
  return wrap;
}

// ── events ─────────────────────────────────────────────────────────────────────────────────────
function leafTapped(leaf) {
  const L = E.landing(ui.walk, leafFor);
  // the leaf you land on, the leaf the drawing points at, or the casts' pick: the landing sheet explains all three
  if (L.headline === leaf || L.leaf === leaf) { openLanding(); return; }
  const ways = [['yes', 'yes'], ['yes', 'no'], ['no', 'yes'], ['no', 'no']]
    .filter(([a, c]) => leafFor({ alignment: a, containment: c }) === leaf)
    .map(([a, c]) => 'alignment ' + a + ' and containment ' + c);
  say(nm(leaf) + ': reached when ' + ways.join(', or ') + '.' + (L.possible.includes(leaf) ? ' Still possible from here.' : ''));
}
function onSelect(ev) {
  const d = ev.detail || {};
  if (d.person) { if (!ui.playing) startPerson(d.person, true); return; }
  if (ui.playing || ui.person) return;
  const n = d.node;
  if (n === 'gate' || n === 'alignment' || n === 'race') setQ(n);
  else if (n === 'containment-if-aligned' || n === 'containment-if-not') { ui.tapped = n; setQ('containment'); }
  else if (E.LEAVES.includes(n)) leafTapped(n);
}
function goLines() { const a = $('to-lines'); if (a && a.href) location.href = a.href; }
function onKey(ev) {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const t = ev.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (sheet.open) return;   // the dialog closes itself on Esc
  const k = ev.key;
  if (k === 'Escape') {
    if (ui.playing) { ev.preventDefault(); skip(); }
    else if ($('help').open) $('help').open = false;
    else if (ui.person) stopPerson(false);
    return;
  }
  if (ui.person) {
    if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); personNav(1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); personNav(-1); }
    return;
  }
  if (ui.playing) return;
  const key = k.length === 1 ? k.toLowerCase() : k;
  const i = lineNow(), both = ui.q === 'gate' ? [0, 1] : [i];
  const act = {
    ArrowDown: () => moveQ(1), ArrowUp: () => moveQ(-1),
    y: () => doDecide(i, 'yes'), n: () => doDecide(i, 'no'),
    c: () => doCast(both, 'coin'), s: () => doCast(both, 'yarrow'), i: () => doUnknown(i),
    g: openClose, e: openEither, h: openCast100, l: goLines
  }[key];
  if (!act) return;
  ev.preventDefault();
  act();
}

async function init() {
  document.documentElement.setAttribute('data-theme', ui.theme);
  E.checkNodes(NODES);
  if (SOURCE === 'standin') $('draft').hidden = false;
  const fromHash = E.decodeHash(location.hash);
  ui.walk = fromHash ? fromHash.walk : E.newWalk();
  const [la] = await Promise.all([getJSON('data/leaf-actions.json'), loadPeople()]);
  ui.leafActions = la && la.leaves ? la : null;
  treeEl.addEventListener('belieftree:select', onSelect);
  skipEl.addEventListener('click', skip);
  document.addEventListener('keydown', onKey);
  wireHelp();
  sheet.addEventListener('click', ev => { if (ev.target === sheet) closeSheet(); });   // a tap on the backdrop
  window.addEventListener('hashchange', () => {
    const d = E.decodeHash(location.hash);
    if (!d || E.encodeHash(d.walk) === E.encodeHash(ui.walk)) return;
    stopTimers();
    ui.token++; ui.playing = null; ui.casting = null; ui.inAir = null; ui.person = null; ui.walk = d.walk;
    draw({ animate: false });
    // the message line follows the walk, so it never tells of a cast the page no longer shows
    say('Your walk, picked up from the page address. ' + E.countsSummary(E.counts(ui.walk), 'answers') + '.');
  });
  say(fromHash ? 'Your walk, picked up from the page address. ' + E.countsSummary(E.counts(ui.walk), 'answers') + '.'
    : "Decide each question, cast for it, or say I don't know. " + E.TEXT.coinIsFor);
  draw({ animate: false });
  const focus = params.get('focus') || (fromHash && fromHash.person);
  if (focus) startPerson(focus, !!params.get('focus'));
}
// the help box: a Close button inside it, and a tap outside it closes it
function wireHelp() {
  const help = $('help'), close = $('help-close');
  if (close) close.addEventListener('click', () => { help.open = false; help.querySelector('summary').focus(); });
  document.addEventListener('click', ev => { if (help.open && !help.contains(ev.target)) help.open = false; });
}
async function loadPeople() {
  // While the film's module is not on main (SOURCE standin), its people file is not either: skip that probe and
  // its 404, and walk the two made-up placeholders.
  if (PEOPLE === 'auto' && SOURCE === 'film') {
    const shared = await getJSON(SHARED_PEOPLE);
    if (Array.isArray(shared) && shared.length) { ui.people = shared; ui.peopleFrom = 'shared'; return; }
  }
  const ex = await getJSON(EXAMPLE_PEOPLE);
  ui.people = Array.isArray(ex) ? ex : [];
  ui.peopleFrom = 'example';
}

init();
