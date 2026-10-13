// The Tree: the DOM layer. Draws the board as a grid, not a repeated diagram, via the shared
// game/shared/matrix-board.js (which itself only ever imports leafFor/LEAF_LABEL/ANSWER_WORD/NODES
// from the Film's shared renderer, explainers/belief-tree/tree-render.js — never edited here, and
// never rendered as an SVG on this page any more). Crossing a node (gate/alignment/containment)
// still goes through the same action buttons and board-engine.js rules as before; the new pieces
// here are: casting ANY card at random (not only a chosen one), casting at a whole group, and
// drawing each dealt person's trajectory trail from game/tree-board/trajectories.json.
import { loadPeople, NODES } from '../../explainers/belief-tree/tree-render.js';
import * as B from './board-engine.js';
import * as PS from '../shared/play-shell.js';
import { renderBoard, chipColor } from '../shared/matrix-board.js';

const FLASH_MS = 1100;

const NODE_SUB = (() => {
  const m = {};
  (NODES || []).forEach(n => { m[n.id] = n.sub; });
  return m;
})();

const els = {
  setup: document.getElementById('setup'),
  playerCount: document.getElementById('playerCount'),
  dealBtn: document.getElementById('dealBtn'),
  game: document.getElementById('game'),
  end: document.getElementById('end'),
  boardWrap: document.getElementById('boardWrap'),
  board: document.getElementById('board'),
  raceLabel: document.getElementById('raceLabel'),
  turnTitle: document.getElementById('turnTitle'),
  psWhy: document.getElementById('psWhy'),
  handChipBtn: document.getElementById('handChipBtn'),
  card: document.getElementById('card'),
  actions: document.getElementById('actions'),
  evidencePanel: document.getElementById('evidencePanel'),
  drawerEvidence: document.getElementById('drawerEvidence'),
  drawerCard: document.getElementById('drawerCard'),
  drawerCast: document.getElementById('drawerCast'),
  castPanel: document.getElementById('castPanel'),
  log: document.getElementById('log'),
  endBody: document.getElementById('endBody'),
  again: document.getElementById('againBtn'),
};

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

let PEOPLE = [];
let OUTSIDE_PEOPLE = [];
let peopleBySlug = new Map();
let EVIDENCE = [];
let TRAJECTORIES = {};
let game = null;
let flashNode = null, flashValue = null, flashTimer = null;
let showTrails = true;
let openDot = null;          // { slug, idx, anchor:{left,top} }
let gameDots = new Map();    // slug -> [{ date:'in this game', note, sourceLabel, url, game_move:true }]
let pendingCastCardId = null;
let castPhase = null;        // 'reveal' | 'targets' | null

async function boot() {
  const [evidenceRes, people, trajectoriesRes] = await Promise.all([
    fetch(new URL('evidence.json', import.meta.url)).then(r => r.json()),
    loadPeople(),
    fetch(new URL('trajectories.json', import.meta.url)).then(r => r.json()),
  ]);
  EVIDENCE = evidenceRes;
  PEOPLE = people;
  TRAJECTORIES = trajectoriesRes;
  OUTSIDE_PEOPLE = people.filter(p => p && p.stated_leaf === 'outside');
  peopleBySlug = new Map(people.map(p => [p.slug, p]));
  els.dealBtn.addEventListener('click', deal);
  els.again.addEventListener('click', () => {
    els.end.hidden = true; els.game.hidden = true; els.setup.hidden = false;
    PS.exitPlayMode();
  });
  setupPlayShell();
}

// ── the play-screen shell: topbar, the utility icon row, drawers, reduced motion ────────────────
function setupPlayShell() {
  PS.mountTopbar(document.getElementById('psTopbar'), { title: 'The Tree', backHref: '../index.html', markSrc: '../../spiral.svg' });
  document.querySelectorAll('.ps-close').forEach(b => { b.innerHTML = PS.icon('close', 16); });

  document.getElementById('drawerRulesBody').innerHTML =
    document.getElementById('rulesDetails').innerHTML.replace(/<summary[^>]*>.*?<\/summary>/s, '');

  const utility = document.getElementById('psUtility');
  const rulesBtn = PS.iconButton({ iconName: 'rules', label: 'Rules', tip: 'How to play' });
  const logBtn = PS.iconButton({ iconName: 'log', label: 'Log', tip: 'Full log' });
  const trailsBtn = PS.iconButton({ iconName: 'eye', label: 'Trails', tip: 'Show or hide trails' });
  trailsBtn.setAttribute('aria-pressed', 'true');
  trailsBtn.addEventListener('click', () => {
    showTrails = !showTrails;
    trailsBtn.setAttribute('aria-pressed', String(showTrails));
    renderBoardView();
  });
  const settingsBtn = PS.iconButton({ iconName: 'settings', label: 'Settings', tip: 'Settings' });
  [rulesBtn, logBtn, trailsBtn, settingsBtn].forEach(b => utility.appendChild(b));

  PS.wireDrawer(rulesBtn, document.getElementById('drawerRules'));
  PS.wireDrawer(logBtn, document.getElementById('drawerLog'));
  PS.wireDrawer(settingsBtn, document.getElementById('drawerSettings'));
  els.drawerCard.querySelectorAll('[data-ps-close]').forEach(b => b.addEventListener('click', () => PS.closeOverlay(els.drawerCard)));
  els.drawerCard.addEventListener('click', e => { if (e.target === els.drawerCard) PS.closeOverlay(els.drawerCard); });
  const closeEvidence = () => { pickedCard = null; PS.closeOverlay(els.drawerEvidence); };
  els.drawerEvidence.querySelectorAll('[data-ps-close]').forEach(b => b.addEventListener('click', closeEvidence));
  els.drawerEvidence.addEventListener('click', e => { if (e.target === els.drawerEvidence) closeEvidence(); });
  const closeCast = () => { pendingCastCardId = null; castPhase = null; PS.closeOverlay(els.drawerCast); };
  els.drawerCast.querySelectorAll('[data-ps-close]').forEach(b => b.addEventListener('click', closeCast));
  els.drawerCast.addEventListener('click', e => { if (e.target === els.drawerCast) closeCast(); });
  els.handChipBtn.addEventListener('click', () => {
    const active = game && activeCharacter();
    if (!active) return;
    openCardFor(active.slug);
  });
  els.psWhy.addEventListener('click', () => PS.openOverlay(document.getElementById('drawerLog'), els.psWhy));

  document.getElementById('newGameBtn2').addEventListener('click', () => location.reload());

  // A resize re-measures the stage for the compact (is-compact) breakpoint above, and also
  // invalidates any open trail dot's popover, which is anchored to a snapshot of its own on-screen
  // position taken at click time (see wireBoardEvents) — closing it here keeps the one-screen rule
  // true across every resize, not just the layout the popover happened to open in.
  window.addEventListener('resize', () => {
    if (!game) return;
    openDot = null;
    renderBoardView();
  });

  const reduced = PS.getStoredReducedMotion();
  document.getElementById('reducedMotionToggle').checked = reduced;
  PS.setReducedMotion(reduced);
  document.getElementById('reducedMotionToggle').addEventListener('change', e => PS.setReducedMotion(e.target.checked));
}

function deal() {
  const n = Math.max(2, Math.min(5, Number(els.playerCount.value) || 3));
  game = B.newGame({ people: PEOPLE, playerCount: n, evidence: EVIDENCE });
  gameDots = new Map();
  showTrails = true;
  openDot = null;
  els.setup.hidden = true; els.end.hidden = true; els.game.hidden = false;
  PS.enterPlayMode();
  render();
}

// ── rendering ─────────────────────────────────────────────────────────────────────────────────
function activeCharacter() { return game.characters[game.turnIndex]; }

// A grid has no visual ambiguity the way the linear tree diagram did (two people short of a leaf
// used to overlap on the same drawn node): every finished (alignment, containment) pair already
// names exactly one cell. So whenever everyone has reached a leaf, name every remaining split
// immediately and silently — board-engine.js's own win rule (unchanged, and still covered by
// tests/tree-board.test.mjs) is satisfied by the grid's own layout, with no "name the split" panel
// needed to do it a second time.
function autoNameSplits() {
  if (!game || game.ended) return;
  if (!B.allLeafed(game)) return;
  for (const node of B.activeSplitNodes(game)) {
    if (!game.namedSplits.includes(node)) game = B.nameSplit(game, node).state;
  }
}

function render() {
  if (!game) return;
  autoNameSplits();
  renderBoardView();
  renderLog();
  if (game.ended) { els.actions.hidden = true; renderEnd(); return; }
  els.actions.hidden = false;
  renderTurn();
}

function trailPointsFor(slug) {
  const person = peopleBySlug.get(slug);
  const real = (TRAJECTORIES[slug] || []).map(p => ({
    date: p.date,
    note: p.note,
    quoteText: p.quote_id && person ? (person.quotes || []).find(q => q.id === p.quote_id)?.text : (p.quote && p.quote.text),
    url: p.url,
    sourceLabel: p.source_label,
    now: !!p.now,
    game_move: false,
  }));
  const game_ = (gameDots.get(slug) || []).map(d => ({ ...d, now: true, game_move: true }));
  // real trail's own "now" stops being the last dot once the game has moved the character further.
  if (game_.length) real.forEach(p => { p.now = false; });
  return [...real, ...game_];
}

function renderBoardView() {
  if (!game) return;
  const active = activeCharacter();
  const byPos = new Map();
  game.characters.forEach((c, i) => {
    const list = byPos.get(c.pos) || []; list.push({ person: c, colorIndex: i }); byPos.set(c.pos, list);
  });
  const focusSlug = active ? active.slug : null;
  const trailPeople = [];
  if (focusSlug) {
    const person = peopleBySlug.get(focusSlug) || {};
    const points = trailPointsFor(focusSlug);
    if (points.length) trailPeople.push({ person: { slug: focusSlug, name: person.name || active.name, short: active.short }, points });
  }
  let openDotView = null;
  if (openDot) {
    const points = trailPointsFor(openDot.slug);
    const p = points[openDot.idx];
    if (p) openDotView = { ...p, anchor: openDot.anchor };
  }
  const wrapH = els.boardWrap.getBoundingClientRect().height;
  renderBoard(els.board, {
    theme: 'auto',
    compact: wrapH > 0 && wrapH < 460,
    gateSub: NODE_SUB.gate,
    alignQ: NODE_SUB.alignment,
    containQ: NODE_SUB['containment-if-aligned'],
    active,
    activeSlug: focusSlug,
    byPos,
    showTrails,
    trailPeople,
    openDot: openDotView,
    outside: OUTSIDE_PEOPLE.map(p => ({ name: p.name, role: p.role })),
    race: game.race,
    raceLimit: game.raceLimit,
    flashNode, flashValue,
  });
  wireBoardEvents();
}

function wireBoardEvents() {
  els.board.querySelectorAll('.mb-chip').forEach(b => {
    b.addEventListener('click', () => openCardFor(b.getAttribute('data-slug')));
  });
  els.board.querySelectorAll('.mb-dot').forEach(b => {
    b.addEventListener('click', () => {
      const slug = b.getAttribute('data-slug');
      const idx = Number(b.getAttribute('data-idx'));
      if (openDot && openDot.slug === slug && openDot.idx === idx) { openDot = null; renderBoardView(); return; }
      const wrapRect = els.boardWrap.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      // Clamped to the board's own box (never past its right/bottom edge) so the popover can never
      // push the PAGE taller or wider than the viewport — the one-screen rule holds even here.
      const left = Math.min(Math.max(4, r.left - wrapRect.left - 40), Math.max(4, wrapRect.width - 284));
      const top = Math.min(r.bottom - wrapRect.top + 6, Math.max(4, wrapRect.height - 130));
      openDot = { slug, idx, anchor: { left, top } };
      renderBoardView();
    });
  });
  const closeBtn = els.board.querySelector('[data-dot-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => { openDot = null; renderBoardView(); });
}

function openCardFor(slug) {
  const ch = game.characters.find(c => c.slug === slug);
  if (!ch) return;
  document.getElementById('drawerCardTitle').textContent = ch.name;
  renderCharacterCard(ch);
  PS.openOverlay(els.drawerCard, document.activeElement);
}

function renderRaceLabel() {
  els.raceLabel.textContent = `The race: ${game.race}/${game.raceLimit}`;
}

function renderLog() {
  renderRaceLabel();
  els.log.textContent = '';
  const recent = game.log.slice(-8).reverse();
  for (const line of recent) {
    const li = document.createElement('li');
    li.textContent = line;
    els.log.appendChild(li);
  }
  els.psWhy.textContent = game.log.length ? game.log[game.log.length - 1] : 'Nothing has happened yet.';
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
  els.handChipBtn.textContent = active.short || active.name;
  const field = B.fieldForPos(active.pos);
  els.turnTitle.textContent = field
    ? `${active.name}'s turn — crossing ${field}`
    : `${active.name}'s turn — already at ${B.leafName(active.pos)}`;
  els.actions.innerHTML = '';
  els.actions.appendChild(moveButtons(active, field));
  els.actions.appendChild(button('Play evidence …', openEvidenceDrawer, game.deck.length === 0,
    'No evidence left in the deck.'));
  els.actions.appendChild(button('Cast a card', castCardFlow, game.deck.length === 0,
    'No evidence left in the deck.'));
  els.actions.appendChild(button('Pass', () => { const r = B.pass(game); game = r.state; render(); }));
}

function openEvidenceDrawer() {
  PS.openOverlay(els.drawerEvidence, document.activeElement);
  renderEvidencePanel();
}

// A disabled action still explains why on tap (aria-disabled, not the disabled attribute — a
// natively-disabled button never receives a click, and phones have no hover for a title tooltip).
function button(label, onClick, disabled, reason) {
  const b = document.createElement('button');
  b.textContent = label;
  if (disabled) {
    b.classList.add('is-disabled');
    b.setAttribute('aria-disabled', 'true');
    if (reason) b.title = reason;
    b.addEventListener('click', () => { if (reason) flash(reason); });
  } else {
    b.addEventListener('click', onClick);
  }
  return b;
}

function moveButtons(active, field) {
  const wrap = document.createElement('div'); wrap.className = 'move-actions';
  if (!field) { wrap.innerHTML = `<p class="hint">${esc(active.short)} has reached a leaf. Play evidence, cast a card, or pass.</p>`; return wrap; }
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
  const ch = r.state.characters.find(c => c.slug === slug);
  const field = B.fieldForPos(game.characters.find(c => c.slug === slug).pos);
  game = r.state;
  if (field) flashCrossing(field, ch.resolved[field]);
  render();
}

function flashCrossing(field, value) {
  flashNode = field === 'alignment' ? 'alignment' : field === 'containment' ? (value === 'yes' ? 'containment-if-aligned' : 'containment-if-not') : null;
  flashValue = value;
  if (flashTimer) clearTimeout(flashTimer);
  const dur = document.body.classList.contains('ps-reduced-motion') ? 0 : FLASH_MS;
  flashTimer = setTimeout(() => { flashNode = null; flashValue = null; renderBoardView(); }, dur || 0);
}

function flash(message) {
  els.turnTitle.textContent = message;
  setTimeout(() => { if (game && !game.ended) render(); }, 1600);
}

// ── evidence: choosing a card from the open drawer ("Play evidence …") ───────────────────────────
let pickedCard = null;
function renderEvidencePanel() {
  els.evidencePanel.innerHTML = '';
  const list = document.createElement('div'); list.className = 'evidence-list';
  for (const card of EVIDENCE) {
    if (!game.deck.includes(card.id)) continue;
    const item = document.createElement('button');
    item.className = 'evidence-card' + (pickedCard === card.id ? ' is-picked' : '');
    item.innerHTML = `<span class="tag">${esc(card.node)} → ${esc(card.push)}</span><span class="txt">${esc(card.text)}</span>` +
      (card.source ? `<a class="src" href="${esc(card.source.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(card.source.label)}</a>` : '');
    item.addEventListener('click', () => { pickedCard = card.id; renderEvidencePanel(); renderEvidenceTargets(card); });
    list.appendChild(item);
  }
  els.evidencePanel.appendChild(list);
  const targets = document.createElement('div'); targets.id = 'evidenceTargets';
  els.evidencePanel.appendChild(targets);
  if (pickedCard) renderEvidenceTargets(EVIDENCE.find(c => c.id === pickedCard));
}

function noteGameDot(ch, card) {
  if (!card.source) return;
  const list = gameDots.get(ch.slug) || [];
  list.push({ date: 'in this game', note: `${card.text}`, sourceLabel: card.source.label, url: card.source.url });
  gameDots.set(ch.slug, list);
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
      if (r.state.characters.find(c => c.slug === ch.slug).resolved[card.node] === card.push) noteGameDot(ch, card);
      game = r.state; pickedCard = null;
      PS.closeOverlay(els.drawerEvidence);
      render();
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

// ── casting ANY card at random ("Cast a card"), at one person or a whole group ───────────────────
function castCardFlow() {
  const r = B.castCard(game);
  if (r.error) { flash(r.error); return; }
  game = r.state;   // advances the seeded draw counter deterministically; the deck itself is untouched
  pendingCastCardId = r.cardId;
  castPhase = 'reveal';
  PS.openOverlay(els.drawerCast, document.activeElement);
  renderCastDrawer();
  const dur = document.body.classList.contains('ps-reduced-motion') ? 0 : 650;
  setTimeout(() => {
    if (pendingCastCardId == null) return;   // cancelled mid-reveal
    castPhase = 'targets';
    renderCastDrawer();
  }, dur);
}

function renderCastDrawer() {
  const card = EVIDENCE.find(c => c.id === pendingCastCardId);
  if (!card) { els.castPanel.innerHTML = ''; return; }
  if (castPhase === 'reveal') {
    els.castPanel.innerHTML = `<div class="mb-cast-reveal"><div class="mb-cast-card">
        <div class="mb-cast-tag">${esc(card.node)} → ${esc(card.push)}</div>
        <p>${esc(card.text)}</p>
      </div></div>`;
    return;
  }
  const groups = B.groupTargets(game);
  els.castPanel.innerHTML = `
    <div class="mb-cast-reveal"><div class="mb-cast-card" style="transform:none;animation:none">
      <div class="mb-cast-tag">${esc(card.node)} → ${esc(card.push)}</div>
      <p>${esc(card.text)}</p>
      ${card.source ? `<a href="${esc(card.source.url)}" target="_blank" rel="noopener">${esc(card.source.label)}</a>` : ''}
    </div></div>
    <p class="hint">Aim it at one character, or a whole group.</p>
    <div class="mb-cast-targets" id="castSingleTargets"></div>
    ${groups.length ? '<p class="hint">Or cast at everyone sharing a spot:</p><div class="mb-group-targets" id="castGroupTargets"></div>' : ''}
    <ul class="mb-cast-log" id="castResultLog"></ul>
  `;
  const singleBox = document.getElementById('castSingleTargets');
  for (const ch of game.characters) {
    const legality = B.evidenceLegality(card, ch);
    const b = document.createElement('button');
    b.textContent = ch.short;
    b.className = legality.legal ? 'ok' : 'no';
    b.title = legality.reason;
    b.addEventListener('click', () => {
      const r = B.playEvidence(game, EVIDENCE, card.id, ch.slug);
      if (!r.ok) { logCastResult([{ short: ch.short, applied: false, reason: r.reason }]); return; }
      if (r.state.characters.find(c => c.slug === ch.slug).resolved[card.node] === card.push) noteGameDot(ch, card);
      game = r.state;
      logCastResult([{ short: ch.short, applied: true, reason: null }]);
      pendingCastCardId = null; castPhase = null;
      setTimeout(() => { PS.closeOverlay(els.drawerCast); render(); }, 550);
    });
    singleBox.appendChild(b);
  }
  const groupBox = document.getElementById('castGroupTargets');
  if (groupBox) {
    for (const g of groups) {
      const b = document.createElement('button');
      const label = B.LEAVES.includes(g.pos) ? B.leafName(g.pos) : g.pos.replace(/-/g, ' ');
      b.textContent = `${label} (${g.slugs.length})`;
      b.addEventListener('click', () => {
        const targeted = g.slugs.map(s => game.characters.find(c => c.slug === s));
        const r = B.playEvidenceGroup(game, EVIDENCE, card.id, g.pos);
        if (!r.ok) { logCastResult([{ short: label, applied: false, reason: r.reason }]); return; }
        for (const res of r.results) {
          if (res.applied) { const ch = targeted.find(c => c.slug === res.slug); if (ch) noteGameDot(ch, card); }
        }
        game = r.state;
        logCastResult(r.results);
        pendingCastCardId = null; castPhase = null;
        setTimeout(() => { PS.closeOverlay(els.drawerCast); render(); }, 900);
      });
      groupBox.appendChild(b);
    }
  }
}

function logCastResult(results) {
  const box = document.getElementById('castResultLog');
  if (!box) return;
  for (const r of results) {
    const li = document.createElement('li');
    li.className = r.applied ? 'moved' : 'stayed';
    li.textContent = r.applied ? `${r.short}: moved.` : `${r.short}: unmoved — ${r.reason}`;
    box.appendChild(li);
  }
}

// ── end ───────────────────────────────────────────────────────────────────────────────────────
function renderEnd() {
  els.game.hidden = true;
  PS.closeAllOverlays();
  PS.exitPlayMode();
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
