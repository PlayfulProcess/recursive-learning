// The Tree: the DOM layer. Imports the shared belief-tree renderer (explainers/belief-tree/
// tree-render.js — never edited here) for the drawing and loadPeople(), The Fork's engine only for
// its cast-result event pattern (drawThenEnd, below, ported from game/fork/fork-ui.js's own), and
// this game's own pure rules from board-engine.js. Tokens are this page's own: small badges placed
// over the shared SVG with nodeRect(), which the renderer exports exactly so a page can do this.
import { renderTree, loadPeople, nodeRect } from '../../explainers/belief-tree/tree-render.js';
import * as B from './board-engine.js';

const SAFETY = 2200;   // ms: a hidden tab's requestAnimationFrame may never fire castend

const els = {
  setup: document.getElementById('setup'),
  playerCount: document.getElementById('playerCount'),
  dealBtn: document.getElementById('dealBtn'),
  game: document.getElementById('game'),
  end: document.getElementById('end'),
  treeWrap: document.getElementById('treeWrap'),
  tree: document.getElementById('tree'),
  tokens: document.getElementById('tokens'),
  race: document.getElementById('race'),
  raceLabel: document.getElementById('raceLabel'),
  turnPanel: document.getElementById('turnPanel'),
  turnTitle: document.getElementById('turnTitle'),
  card: document.getElementById('card'),
  actions: document.getElementById('actions'),
  evidencePanel: document.getElementById('evidencePanel'),
  splitPanel: document.getElementById('splitPanel'),
  log: document.getElementById('log'),
  endBody: document.getElementById('endBody'),
  again: document.getElementById('againBtn'),
};

let PEOPLE = [];
let peopleBySlug = new Map();
let EVIDENCE = [];
let game = null;
let peopleForChips = [];   // the original person records for whoever is currently dealt
let casting = null;        // { node, method, result } | null — shown on the next render only

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function boot() {
  const [evidenceRes, people] = await Promise.all([
    fetch(new URL('evidence.json', import.meta.url)).then(r => r.json()),
    loadPeople(),
  ]);
  EVIDENCE = evidenceRes;
  PEOPLE = people;
  peopleBySlug = new Map(people.map(p => [p.slug, p]));
  els.dealBtn.addEventListener('click', deal);
  els.again.addEventListener('click', () => {
    els.end.hidden = true; els.game.hidden = true; els.setup.hidden = false;
  });
  els.tree.addEventListener('belieftree:select', e => {
    const node = e.detail && e.detail.node;
    if (node && game && !game.ended && B.allLeafed(game) && B.activeSplitNodes(game).includes(node)) doNameSplit(node);
  });
  window.addEventListener('resize', () => positionTokens());
  if (window.ResizeObserver) new ResizeObserver(() => positionTokens()).observe(els.treeWrap);
}

function deal() {
  const n = Math.max(2, Math.min(5, Number(els.playerCount.value) || 3));
  game = B.newGame({ people: PEOPLE, playerCount: n, evidence: EVIDENCE });
  peopleForChips = game.characters.map(c => peopleBySlug.get(c.slug)).filter(Boolean);
  casting = null;
  els.setup.hidden = true; els.end.hidden = true; els.game.hidden = false;
  render();
}

// ── rendering ─────────────────────────────────────────────────────────────────────────────────
function activeCharacter() { return game.characters[game.turnIndex]; }

function render() {
  if (!game) return;
  renderTreeAndTokens();
  renderRace();
  renderLog();
  if (game.ended) { els.turnPanel.hidden = true; els.splitPanel.hidden = true; renderEnd(); return; }
  els.turnPanel.hidden = false;
  renderTurn();
  renderSplitPanel();
}

function renderTreeAndTokens() {
  const active = activeCharacter();
  const answers = { gate: active.resolved.gate, alignment: active.resolved.alignment, containment: active.resolved.containment, race: 'yes' };
  const openNow = [];
  const field = B.fieldForPos(active.pos);
  if (field && active.resolved[field] == null && !B.isPlainAnswer(active.raw[field])) {
    openNow.push(field === 'alignment' ? 'alignment' : field === 'gate' ? 'gate'
      : (active.resolved.alignment === 'yes' ? 'containment-if-aligned' : 'containment-if-not'));
  }
  renderTree(els.tree, {
    step: null, answers, open: openNow, focus: active.slug,
    people: peopleForChips, casting, theme: 'auto',
  }, { animate: true });
  positionTokens();
}

const TOKEN_COLORS = ['#5b7fc0', '#3f7a5c', '#c0473b', '#8a5fb0', '#c8932f'];
function positionTokens() {
  if (!game) return;
  const wrapRect = els.treeWrap.getBoundingClientRect();
  els.tokens.textContent = '';
  const byNode = new Map();
  game.characters.forEach((c, i) => {
    const list = byNode.get(c.pos) || []; list.push({ c, i }); byNode.set(c.pos, list);
  });
  for (const [node, list] of byNode) {
    const r = nodeRect(els.tree, node);
    if (!r) continue;
    list.forEach((entry, k) => {
      const badge = document.createElement('span');
      badge.className = 'token' + (entry.c === activeCharacter() ? ' is-active' : '');
      badge.textContent = (entry.c.short || entry.c.name).slice(0, 2).toUpperCase();
      badge.title = entry.c.name;
      badge.style.background = TOKEN_COLORS[entry.i % TOKEN_COLORS.length];
      const left = r.left - wrapRect.left + 4 + k * 20;
      const top = r.top - wrapRect.top + 4;
      badge.style.left = left + 'px';
      badge.style.top = top + 'px';
      els.tokens.appendChild(badge);
    });
  }
}

function renderRace() {
  els.race.textContent = '';
  for (let i = 0; i < game.raceLimit; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip' + (i < game.race ? ' is-filled' : '');
    els.race.appendChild(pip);
  }
  els.raceLabel.textContent = `The race: ${game.race}/${game.raceLimit}`;
}

function renderLog() {
  els.log.textContent = '';
  const recent = game.log.slice(-8).reverse();
  for (const line of recent) {
    const li = document.createElement('li');
    li.textContent = line;
    els.log.appendChild(li);
  }
}

function answerRow(label, raw) {
  return `<div class="ans"><span class="k">${esc(label)}</span><span class="v">${esc(B.wordFor(raw))}</span></div>`;
}

function renderCharacterCard(character) {
  const person = peopleBySlug.get(character.slug) || {};
  const quoteId = (character.card_quote_ids || [])[0];
  const quote = quoteId ? (person.quotes || []).find(q => q.id === quoteId) : null;
  const toMove = (character.to_move || []).map(m =>
    `<li>To move to <b>${esc(B.leafName(m.to))}</b>, they would have to believe: ${esc(m.would_have_to_believe)}</li>`).join('');
  els.card.innerHTML = `
    <h3>${esc(character.name)}</h3>
    <p class="role">${esc(character.role)}</p>
    <div class="answers">
      ${answerRow('Gate', character.raw.gate)}
      ${answerRow('Alignment', character.raw.alignment)}
      ${answerRow('Containment', character.raw.containment)}
    </div>
    ${quote ? `<blockquote>&ldquo;${esc(quote.text)}&rdquo;<footer><a href="${esc(quote.url)}" target="_blank" rel="noopener">${esc(quote.source_label || 'Source')}</a></footer></blockquote>` : ''}
    ${toMove ? `<p class="k">To move, they would have to believe…</p><ul class="tomove">${toMove}</ul>` : ''}
  `;
}

function renderTurn() {
  const active = activeCharacter();
  renderCharacterCard(active);
  const field = B.fieldForPos(active.pos);
  els.turnTitle.textContent = field
    ? `${active.name}'s turn — crossing ${field}`
    : `${active.name}'s turn — already at ${B.leafName(active.pos)}`;
  els.actions.innerHTML = '';
  els.actions.appendChild(moveButtons(active, field));
  els.actions.appendChild(button('Play evidence …', () => renderEvidencePanel(true), game.deck.length === 0));
  els.actions.appendChild(button('Pass', () => { const r = B.pass(game); game = r.state; casting = null; render(); }));
  renderEvidencePanel(false);
}

function button(label, onClick, disabled) {
  const b = document.createElement('button');
  b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', onClick);
  return b;
}

function moveButtons(active, field) {
  const wrap = document.createElement('div'); wrap.className = 'move-actions';
  if (!field) { wrap.innerHTML = `<p class="hint">${esc(active.short)} has reached a leaf. Play evidence, or pass.</p>`; return wrap; }
  const alreadySet = active.resolved[field] != null;
  const raw = active.raw[field];
  if (alreadySet || B.isPlainAnswer(raw)) {
    const word = alreadySet ? B.wordFor(active.resolved[field]) : B.wordFor(raw);
    const why = alreadySet ? 'set by evidence' : 'their own answer';
    wrap.appendChild(button(`Cross ${field}: ${word} (${why})`, () => doMove(active.slug)));
  } else {
    wrap.appendChild(button('Cast a coin', () => doMove(active.slug, 'coin')));
    wrap.appendChild(button('Cast yarrow', () => doMove(active.slug, 'yarrow')));
    wrap.appendChild(button('"I don’t know"', () => doMove(active.slug, 'unknown')));
  }
  return wrap;
}

function doMove(slug, method) {
  const r = B.attemptMove(game, slug, method);
  if (r.error) { flash(r.error); return; }
  game = r.state;
  if (r.casting) { casting = r.casting; showCast(r.casting, () => { casting = null; render(); }); render(); }
  else { casting = null; render(); }
}

// Draw with the cast showing, then wait for the renderer's own castend (or a safety timeout) before
// clearing it — ported from game/fork/fork-ui.js's drawThenEnd, so the coin/yarrow/"?" animation the
// Film's module plays gets to finish instead of being cut off by the next render.
function showCast(cst, cb) {
  let finished = false;
  const onEnd = ev => {
    if (finished) return;
    if (ev && ev.detail && ev.detail.node !== cst.node) return;
    finished = true; clearTimeout(safety); els.tree.removeEventListener('belieftree:castend', onEnd);
    cb();
  };
  els.tree.addEventListener('belieftree:castend', onEnd);
  const safety = setTimeout(onEnd, SAFETY);
}

function flash(message) {
  els.turnTitle.textContent = message;
  setTimeout(() => { if (game && !game.ended) render(); }, 1600);
}

// ── evidence ──────────────────────────────────────────────────────────────────────────────────
let evidenceOpen = false, pickedCard = null;
function renderEvidencePanel(toggle) {
  if (toggle) evidenceOpen = !evidenceOpen;
  els.evidencePanel.hidden = !evidenceOpen;
  if (!evidenceOpen) { pickedCard = null; return; }
  els.evidencePanel.innerHTML = '';
  const list = document.createElement('div'); list.className = 'evidence-list';
  for (const card of EVIDENCE) {
    if (!game.deck.includes(card.id)) continue;
    const item = document.createElement('button');
    item.className = 'evidence-card' + (pickedCard === card.id ? ' is-picked' : '');
    item.innerHTML = `<span class="tag">${esc(card.node)} → ${esc(card.push)}</span><span class="txt">${esc(card.text)}</span>` +
      (card.source ? `<a class="src" href="${esc(card.source.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(card.source.label)}</a>` : '');
    item.addEventListener('click', () => { pickedCard = card.id; renderEvidencePanel(false); renderEvidenceTargets(card); });
    list.appendChild(item);
  }
  els.evidencePanel.appendChild(list);
  const targets = document.createElement('div'); targets.id = 'evidenceTargets';
  els.evidencePanel.appendChild(targets);
  if (pickedCard) renderEvidenceTargets(EVIDENCE.find(c => c.id === pickedCard));
}

function renderEvidenceTargets(card) {
  const box = document.getElementById('evidenceTargets');
  if (!box) return;
  box.innerHTML = `<p class="hint">Play on which character?</p>`;
  const row = document.createElement('div'); row.className = 'evidence-targets';
  for (const ch of game.characters) {
    const legality = B.evidenceLegality(card, ch);
    const b = document.createElement('button');
    b.textContent = ch.short;
    b.className = legality.legal ? 'target ok' : 'target no';
    b.title = legality.reason;
    b.addEventListener('click', () => {
      const r = B.playEvidence(game, EVIDENCE, card.id, ch.slug);
      if (!r.ok) { showRefusal(r.reason); return; }
      game = r.state; casting = null; pickedCard = null; evidenceOpen = false; render();
    });
    row.appendChild(b);
  }
  box.appendChild(row);
  const reasonBox = document.createElement('p'); reasonBox.className = 'reason'; reasonBox.id = 'evidenceReason';
  box.appendChild(reasonBox);
}

function showRefusal(reason) {
  const box = document.getElementById('evidenceReason');
  if (box) box.textContent = 'Refused: ' + reason;
}

// ── splits ────────────────────────────────────────────────────────────────────────────────────
function renderSplitPanel() {
  if (!B.allLeafed(game)) { els.splitPanel.hidden = true; return; }
  const need = B.activeSplitNodes(game).filter(n => !game.namedSplits.includes(n));
  els.splitPanel.hidden = false;
  if (!need.length) {
    els.splitPanel.innerHTML = `<p class="hint">${game.namedSplits.length ? 'Every split is named.' : 'Everyone stands on one shared leaf.'}</p>`;
    return;
  }
  els.splitPanel.innerHTML = `<p class="hint">Everyone has reached a leaf, but not the same one. Tap a lit node above, or a button below, to name where the paths split — the table needs every split named to win.</p>`;
  const row = document.createElement('div'); row.className = 'split-buttons';
  for (const node of need) {
    row.appendChild(button(`Name the split at "${node.replace(/-/g, ' ')}"`, () => doNameSplit(node)));
  }
  els.splitPanel.appendChild(row);
  const compare = document.createElement('div'); compare.className = 'split-compare';
  for (const node of game.namedSplits) {
    const field = node === 'alignment' ? 'alignment' : 'containment';
    const here = game.characters.filter(c => B.LEAVES.includes(c.pos));
    const seen = new Set();
    for (const c of here) {
      const key = c.resolved[field];
      if (seen.has(key)) continue; seen.add(key);
      const p = document.createElement('p');
      p.innerHTML = `<b>${esc(c.short)}</b> at "${esc(node.replace(/-/g, ' '))}": ${esc(B.wordFor(c.resolved[field]))} — ${esc(c.basis[field] || 'no stated basis')}`;
      compare.appendChild(p);
    }
  }
  els.splitPanel.appendChild(compare);
}

function doNameSplit(node) {
  const r = B.nameSplit(game, node);
  game = r.state;
  render();
}

// ── end ───────────────────────────────────────────────────────────────────────────────────────
function renderEnd() {
  els.end.hidden = false;
  const rows = game.characters.map(c =>
    `<li><b>${esc(c.name)}</b>: ${esc(B.leafName(c.pos))}</li>`).join('');
  els.endBody.innerHTML = `
    <p class="${game.ended.result === 'win' ? 'win' : 'lose'}">${game.ended.result === 'win' ? 'The table wins.' : 'The table loses.'}</p>
    <p>${esc(game.ended.reason)}</p>
    <ul>${rows}</ul>
  `;
}

boot();
