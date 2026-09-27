// The Lab Years: the DOM layer. Imports the shared belief-tree renderer (explainers/belief-tree/
// tree-render.js — never edited here) for the RSI/ending drawing, and this game's own pure rules
// from engine.js. Hidden information (a player's hand, secret objective, belief bets) is a UI
// convention here, not a security boundary: everything lives in one page's state, and the
// pass-cover screen is what keeps the wrong eyes off it between turns.
import { renderTree } from '../../explainers/belief-tree/tree-render.js';
import * as E from './engine.js';
import * as PS from '../shared/play-shell.js';

const els = id => document.getElementById(id);
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Presentation-only short names for the safeguard chips (a narrow phone can't fit "Alignment
// verified" as one unshrinkable pill four times over); the full name is still in the chip's title
// and everywhere else (log lines, drawers) via engine.js's own SAFEGUARD_LABEL, untouched.
const SAFEGUARD_SHORT = { alignment: 'Alignment', containment: 'Containment', agreement: 'Agreement', understanding: 'Understanding' };

let CARDS = null;
let game = null;
let castSeed = null, castYear = null;
let pickedCardId = null, pickedSafeguard = null, pendingResponses = [];

async function boot() {
  CARDS = await fetch(new URL('cards.json', import.meta.url)).then(r => r.json());
  CARDS.__byId = E.indexCards(CARDS);

  els('playerCount').addEventListener('change', renderNameInputs);
  renderNameInputs();
  els('castYearBtn').addEventListener('click', castYearNow);
  els('dealBtn').addEventListener('click', dealAndBegin);
  els('revealBtn').addEventListener('click', () => { els('passCover').hidden = true; els('game').inert = false; renderTurn(); els('turnScreen').hidden = false; refitTreeNow(); });
  els('hideBtn').addEventListener('click', () => { PS.closeAllOverlays(); els('turnScreen').hidden = true; showPassCover(); });
  els('passActionBtn').addEventListener('click', () => applyAndRender(g => E.pass(g, E.activePlayer(g).id, CARDS)));
  els('placeBetBtn').addEventListener('click', placeBet);
  els('betCategory').addEventListener('change', renderBetValues);
  els('rsiContinue').addEventListener('click', () => { els('rsiPanel').hidden = true; afterRSICheck(); });
  els('againBtn').addEventListener('click', () => location.reload());
  els('newGameBtn').addEventListener('click', () => location.reload());
  renderBetValues();

  setupPlayShell();
}

// ── the play-screen shell: topbar, the utility icon row, drawers, reduced motion ────────────────
function setupPlayShell() {
  PS.mountTopbar(els('psTopbar'), { title: 'The Lab Years', backHref: '../index.html', markSrc: '../../spiral.svg' });

  document.querySelectorAll('.ps-close').forEach(b => { b.innerHTML = PS.icon('close', 16); });
  els('objectiveBtn').innerHTML = PS.icon('eye');
  els('tokensBtn').innerHTML = PS.icon('tokens');

  // the setup screen's own "Quick rules" <details> is reused inside the play-time drawer verbatim
  els('drawerRulesBody').innerHTML = els('rulesDetails').innerHTML.replace(/<summary[^>]*>.*?<\/summary>/s, '');

  const utility = els('psUtility');
  const rulesBtn = PS.iconButton({ iconName: 'rules', label: 'Rules', tip: 'Quick rules' });
  const historyBtn = PS.iconButton({ iconName: 'book', label: 'History', tip: 'History & clues' });
  const logBtn = PS.iconButton({ iconName: 'log', label: 'Log', tip: 'Full log' });
  const settingsBtn = PS.iconButton({ iconName: 'settings', label: 'Settings', tip: 'Settings' });
  [rulesBtn, historyBtn, logBtn, settingsBtn].forEach(b => utility.appendChild(b));

  PS.wireDrawer(rulesBtn, els('drawerRules'));
  PS.wireDrawer(historyBtn, els('drawerHistory'));
  PS.wireDrawer(logBtn, els('drawerLog'));
  PS.wireDrawer(settingsBtn, els('drawerSettings'));
  PS.wireDrawer(els('objectiveBtn'), els('drawerObjective'));
  PS.wireDrawer(els('tokensBtn'), els('drawerTokens'));
  PS.wireDrawer(els('handChipBtn'), els('drawerHand'));

  els('psWhy').addEventListener('click', () => PS.openOverlay(els('drawerLog'), els('psWhy')));

  // re-fit (and, if the stage's own aspect flips, re-layout) the persistent tree whenever the box
  // it lives in resizes — a window resize, or the shell giving the stage more or less room.
  PS.watchTreeBox(els('treeBox'), () => {
    if (game && game.lastRSI && !game.lastRSI.__shown) renderRSI(game.lastRSI);
    else renderNeutralTree();
  });

  const reduced = PS.getStoredReducedMotion();
  els('reducedMotionToggle').checked = reduced;
  PS.setReducedMotion(reduced);
  els('reducedMotionToggle').addEventListener('change', e => PS.setReducedMotion(e.target.checked));
}

function renderNameInputs() {
  const n = Number(els('playerCount').value) || 4;
  const wrap = els('nameInputs');
  wrap.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Player ' + (i + 1); input.id = 'name' + i;
    input.style.maxWidth = '140px';
    wrap.appendChild(input);
  }
}
function renderBetValues() {
  const cat = els('betCategory').value;
  const list = cat === 'takeoff' ? E.TAKEOFF_WORLDS : E.ALIGNMENT_DYNAMICS_WORLDS;
  els('betValue').innerHTML = list.map(v => `<option value="${v}">${esc(E.WORLD_INFO[cat][v].name)}</option>`).join('');
}

function castYearNow() {
  castSeed = Math.floor(Math.random() * 900000) + 1;
  castYear = E.castStartYear(castSeed, 0);
  els('yearCastResult').textContent = `Cast: ${castYear} (seed ${castSeed})`;
  els('dealBtn').disabled = false;
}

function dealAndBegin() {
  const n = Number(els('playerCount').value) || 4;
  const players = [];
  for (let i = 0; i < n; i++) {
    const v = (els('name' + i) && els('name' + i).value.trim()) || ('Player ' + (i + 1));
    players.push({ id: 'p' + i, name: v });
  }
  game = E.newGame({ players, startYear: castYear, seed: castSeed, cards: CARDS });
  els('setup').hidden = true; els('game').hidden = false;
  PS.enterPlayMode();
  renderBoard();
  afterRSICheck();
}

// the belief tree, shown persistently in the stage (not only when an RSI card fires); renderRSI()
// below repaints the same #tree element with the real answers the moment one does fire. The layout
// ('wide'/'narrow') is chosen from the STAGE box's own aspect ratio (a short, wide stage still wants
// 'wide'; a tall, narrow one wants 'narrow'), then the svg is sized to fit that box on both axes —
// see game/shared/play-shell.js's treeLayoutFor/fitTreeSvg. No inner scroll on the stage.
function renderNeutralTree() {
  const box = els('treeBox');
  renderTree(els('tree'), { step: null, answers: {}, open: [], people: [], casting: null, theme: 'auto' },
    { animate: !document.body.classList.contains('ps-reduced-motion'), legend: false, layout: PS.treeLayoutFor(box) });
  PS.fitTreeSvg(box);
}

// #turnScreen showing or hiding changes how much height .ps-stage has left (the pass-cover phase
// gives the stage everything; a turn's HUD+hand+actions take some of it back) — re-fit (and
// re-layout, if the box's own aspect flips) right after, or the tree stays sized for whichever
// state was active when it last rendered and can spill out of the now-smaller box.
function refitTreeNow() {
  if (game && game.lastRSI && !game.lastRSI.__shown) renderRSI(game.lastRSI);
  else renderNeutralTree();
}

// ── the public board (visible always; nothing secret lives here) ───────────────────────────────
function renderBoard() {
  if (!game) return;
  els('statYear').textContent = game.year;
  els('statCapability').textContent = game.capability + (game.capabilityFrozen ? ' (frozen)' : '');
  els('rsiThreshVal').textContent = game.rsiThreshold;
  const capMax = Math.max(20, game.rsiThreshold * 1.5, game.capability + 2);
  els('capMeterFill').style.width = Math.min(100, 100 * game.capability / capMax) + '%';
  els('capMeterThresh').style.left = Math.min(100, 100 * game.rsiThreshold / capMax) + '%';
  const flags = els('raceFlags');
  flags.textContent = game.raceCapped ? ' — capped' : '';
  const race = els('race'); race.innerHTML = '';
  const shown = Math.max(game.raceLimit, game.race);
  for (let i = 0; i < shown; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip' + (i < game.race ? ' is-filled' : '');
    race.appendChild(pip);
  }
  els('raceLabelSr').textContent = `The race: ${game.race}/${shown}${game.raceCapped ? ', capped' : ''}`;
  const sgWrap = els('safeguards'); sgWrap.innerHTML = '';
  E.SAFEGUARDS.forEach(id => {
    const sg = game.safeguards[id], target = E.safeguardTarget(id);
    const div = document.createElement('div');
    div.className = 'sg' + (sg.secured ? ' secured' : '');
    div.title = `${E.SAFEGUARD_LABEL[id]}: ${sg.progress}/${target}${sg.secured ? ' — secured' : ''}${sg.shield ? ' (shielded)' : ''}`;
    div.innerHTML = `<b>${esc(SAFEGUARD_SHORT[id] || E.SAFEGUARD_LABEL[id])}</b><span class="muted">${sg.progress}/${target}</span><div class="bar"><i style="width:${100 * sg.progress / target}%"></i></div>`;
    sgWrap.appendChild(div);
  });
  const hp = els('historyPanel');
  if (game.historyFaceUp.length) {
    hp.innerHTML = '<h2>Face up before the first turn</h2>' + game.historyFaceUp.map(id => {
      const h = CARDS.__byId[id];
      return `<p style="font-size:13px;margin:6px 0"><b>${h.year}</b> — ${esc(h.title)}: ${esc(h.text)} <a href="${esc(h.source.url)}" target="_blank" rel="noopener">${esc(h.source.label)}</a></p>`;
    }).join('');
  } else hp.innerHTML = '';
  const cp = els('cluesPanel'), cl = els('clueList');
  if (game.cluesRevealed.length) {
    cp.hidden = false;
    cl.innerHTML = game.cluesRevealed.map(id => `<div class="clue">${esc((CARDS.__byId[id] || {}).text || '')}</div>`).join('');
  } else cp.hidden = true;
  const log = els('log'); log.innerHTML = '';
  game.log.slice(-10).reverse().forEach(line => { const li = document.createElement('li'); li.textContent = line; log.appendChild(li); });
  els('psWhy').textContent = game.log.length ? game.log[game.log.length - 1] : 'Nothing has happened yet.';
  if (!(game.lastRSI && !game.lastRSI.__shown)) renderNeutralTree();
}

// ── the pass-and-play cover ──────────────────────────────────────────────────────────────────
function showPassCover() {
  if (!game || game.ended) { renderEnd(); return; }
  PS.closeAllOverlays();
  renderBoard();
  const p = E.activePlayer(game);
  els('passWho').textContent = `Pass the device to ${p.name}`;
  els('passCover').hidden = false;
  els('game').inert = true;
}

function applyAndRender(fn) {
  const beforeId = E.activePlayer(game).id;
  try { game = fn(game); }
  catch (e) { flashError(e.message); return; }
  renderBoard();
  if (game.ended) { showEndOrRSI(); return; }
  if (game.lastRSI && !game.lastRSI.__shown) { showEndOrRSI(); return; }
  const stillSame = E.activePlayer(game).id === beforeId;
  if (stillSame) renderTurn();
  else { els('turnScreen').hidden = true; showPassCover(); }
}
function afterRSICheck() {
  if (game && (game.ended || (game.lastRSI && !game.lastRSI.__shown))) { showEndOrRSI(); return; }
  showPassCover();
}
function showEndOrRSI() {
  if (game.ended) { renderEnd(); return; }
  if (game.lastRSI) { renderRSI(game.lastRSI); return; }
  showPassCover();
}
function flashError(msg) {
  const panel = document.getElementById('actionPanel');
  if (panel) { const p = document.createElement('p'); p.style.color = '#c0473b'; p.textContent = msg; panel.prepend(p); }
  else alert(msg);
}

// ── the belief tree, drawn for an RSI fire or fizzle ────────────────────────────────────────────
function renderRSI(rsi) {
  els('turnScreen').hidden = true; els('passCover').hidden = true;
  const panel = els('rsiPanel');
  panel.hidden = false;
  els('rsiTitle').textContent = rsi.title;
  if (!rsi.fired) {
    els('rsiText').textContent = rsi.reason === 'plateau'
      ? 'Fizzles for good: this World is a Plateau. RSI cards never resolve the tree in this game.'
      : `Fizzles: capability ${rsi.capability} is below the threshold ${rsi.threshold}, so it does not fire.`;
    renderNeutralTree();
  } else if (rsi.deferred) {
    els('rsiText').textContent = 'Fires, but the tree does not resolve yet — capability and the race keep climbing on their own every remaining year (Automated research). The tree resolves at the end of the game.';
    renderNeutralTree();
  } else {
    const a = rsi.alignment.answer, c = rsi.containment.answer;
    const containmentNode = a === 'yes' ? 'containment-if-aligned' : 'containment-if-not';
    const open = [];
    if (rsi.alignment.cast) open.push('alignment');
    if (rsi.containment.cast) open.push(containmentNode);
    const box = els('treeBox');
    renderTree(els('tree'), {
      step: null, answers: { gate: 'yes', alignment: a, containment: c, race: 'yes' },
      open, people: [], casting: null, theme: 'auto',
    }, { animate: !document.body.classList.contains('ps-reduced-motion'), legend: false, layout: PS.treeLayoutFor(box) });
    PS.fitTreeSvg(box);
    els('rsiText').textContent = `Alignment reads ${a}${rsi.alignment.cast ? ' (cast on partial progress)' : ''}${rsi.alignment.locked ? ' (locked by Goal-keeping)' : ''}. Containment reads ${c}${rsi.containment.cast ? ' (cast on partial progress)' : ''}. Result: ${E.LAB_LEAF_LABEL[rsi.leaf]}.`;
  }
  game.lastRSI = { ...game.lastRSI, __shown: true };
}

// ── a player's own turn ─────────────────────────────────────────────────────────────────────────
function renderTurn() {
  if (!game || game.ended) { showEndOrRSI(); return; }
  const p = E.activePlayer(game);
  els('turnTitle').textContent = `${p.name}'s turn — action ${4 - p.actionsLeft} of 3`;
  const role = E.ROLES.find(r => r.id === p.role);
  els('turnRole').textContent = `Role: ${role.name} — ${role.power}`;
  els('turnRole').title = `Role: ${role.name} — ${role.power}`;
  els('turnCompute').textContent = `Compute: ${p.compute}`;
  const obj = E.OBJECTIVES.find(o => o.id === p.objective);
  els('objectiveBox').innerHTML = `<b>Secret objective: ${esc(obj.name)}</b><p class="muted" style="margin:4px 0 0">${esc(obj.desc)}</p>`;
  els('tokensLeft').textContent = p.beliefTokensLeft;
  els('betList').innerHTML = p.beliefBets.map(b => `${b.category === 'takeoff' ? 'Takeoff' : 'Alignment dynamics'}: ${esc(E.WORLD_INFO[b.category][b.value].name)}`).join('<br>') || 'none placed yet';

  els('handChipBtn').textContent = `Hand (${p.hand.length})`;
  pickedCardId = null; pickedSafeguard = null; pendingResponses = [];
  const hand = els('hand'); hand.innerHTML = '';
  p.hand.forEach(id => {
    const c = CARDS.__byId[id];
    const btn = document.createElement('button');
    btn.className = 'card suit-' + (c.suit || 'wild') + (pickedCardId === id ? ' is-picked' : '');
    btn.innerHTML = `<span class="tag">${esc(c.suit || '')}</span>${esc(c.text)}`;
    btn.addEventListener('click', () => { pickedCardId = id; PS.closeOverlay(els('drawerHand')); renderTurn(); });
    hand.appendChild(btn);
  });

  renderActionPanel(p);
}

function renderActionPanel(p) {
  const panel = els('actionPanel'); panel.innerHTML = '';
  const row = document.createElement('div'); row.className = 'actions';
  row.appendChild(actBtn('Research', () => applyAndRender(g => E.research(g, p.id, CARDS))));
  row.appendChild(actBtn('Build', () => applyAndRender(g => E.build(g, p.id, pickedCardId, CARDS)),
    !pickedCardId || p.compute < 1, !pickedCardId ? 'Pick a card from your hand first.' : 'Needs 1 compute.'));
  row.appendChild(actBtn('Release (compute 2)', releaseFlow, p.compute < 2, 'Needs 2 compute.'));
  row.appendChild(actBtn('Lobby (agreement +1)', () => applyAndRender(g => E.lobby(g, p.id, CARDS))));
  row.appendChild(actBtn('Publish', () => applyAndRender(g => E.publish(g, p.id, pickedCardId, CARDS)),
    !pickedCardId, 'Pick a card from your hand first.'));
  panel.appendChild(row);

  const secureRow = document.createElement('div'); secureRow.className = 'actions';
  E.SAFEGUARDS.forEach(id => {
    if (game.safeguards[id].secured) return;
    secureRow.appendChild(actBtn(`Secure ${E.SAFEGUARD_LABEL[id]}`, () => {
      const matching = p.hand.filter(cid => (CARDS.__byId[cid].suit === id || CARDS.__byId[cid].suit === 'wild'));
      if (!matching.length) { flashError('No matching (or wild) cards in hand.'); return; }
      applyAndRender(g => E.secure(g, p.id, matching, id, CARDS));
    }));
  });
  panel.appendChild(secureRow);

  const roleRow = document.createElement('div'); roleRow.className = 'actions';
  if (p.role === 'interpreter') {
    roleRow.appendChild(actBtn('Peek: top event card (free)', () => { flashInfo('Top event card: ' + peekEventTitle()); }));
    roleRow.appendChild(actBtn('Peek: a safeguard\'s odds (free)', () => { flashInfo(peekOddsText()); }));
    if (!p.worldPeekUsed) {
      roleRow.appendChild(actBtn('Peek World: Takeoff (once/game)', () => peekWorld('takeoff')));
      roleRow.appendChild(actBtn('Peek World: Alignment dynamics (once/game)', () => peekWorld('alignmentDynamics')));
    }
  }
  if (p.role === 'redTeamer') roleRow.appendChild(actBtn('Audit (cancel a capability step)', () => applyAndRender(g => E.auditCapabilityStep(g, p.id, CARDS)), game.auditUsedThisRound, 'Already used this round.'));
  if (p.role === 'whistleblower' && !p.whistleblowUsed) {
    game.players.filter(o => o.id !== p.id).forEach(o => {
      roleRow.appendChild(actBtn(`Whistleblow: reveal ${o.name}'s hand (once/game)`, () => applyAndRender(g => E.useWhistleblower(g, p.id, 'reveal', o.id, CARDS))));
    });
    roleRow.appendChild(actBtn('Whistleblow: force an audit instead (once/game)', () => applyAndRender(g => E.useWhistleblower(g, p.id, 'audit', null, CARDS))));
  }
  if (roleRow.children.length) panel.appendChild(roleRow);

  const tradeRow = document.createElement('div'); tradeRow.className = 'actions';
  game.players.filter(o => o.id !== p.id).forEach(o => {
    tradeRow.appendChild(actBtn(`Trade to ${o.name}`, () => {
      applyAndRender(g => (p.bloc === o.bloc ? E.trade(g, p.id, o.id, [pickedCardId], CARDS) : E.tradeWithConsent(g, p.id, o.id, [pickedCardId], CARDS)));
    }, !pickedCardId, 'Pick a card from your hand first.'));
  });
  panel.appendChild(tradeRow);
}
// A disabled action still explains why on tap (aria-disabled, not the disabled attribute, since a
// natively-disabled button never receives a click at all — phones have no hover to show a title).
function actBtn(label, onClick, disabled, reason) {
  const b = document.createElement('button');
  b.textContent = label;
  if (disabled) {
    b.classList.add('is-disabled');
    b.setAttribute('aria-disabled', 'true');
    if (reason) b.title = reason;
    b.addEventListener('click', () => { if (reason) flashError(reason); });
  } else {
    b.addEventListener('click', onClick);
  }
  return b;
}
function flashInfo(text) {
  const panel = els('actionPanel'); const p = document.createElement('p'); p.className = 'muted'; p.textContent = text; panel.prepend(p);
}
function peekEventTitle() {
  const id = E.peekEvent(game); return id ? (CARDS.__byId[id] || {}).title || id : '(deck empty)';
}
function peekOddsText() {
  const id = E.SAFEGUARDS.find(s => !game.safeguards[s].secured) || 'alignment';
  const odds = E.peekSafeguardOdds(game, id);
  return `${E.SAFEGUARD_LABEL[id]}: about ${(odds * 100).toFixed(0)} in 100, if it were cast right now.`;
}
function peekWorld(which) {
  const p = E.activePlayer(game);
  try {
    const r = E.peekWorldCard(game, p.id, which);
    game = r.state;
    flashInfo(`(private, shown only to ${p.name}) ${which === 'takeoff' ? 'Takeoff' : 'Alignment dynamics'} is ${r.info.name}: ${r.info.text}`);
    renderTurn();
  } catch (e) { flashError(e.message); }
}

// ── Release: opens a response window before it resolves (the stack) ────────────────────────────
// A non-blocking, two-step flow (no confirm() dialogs): pick responses with checkboxes, then
// resolve. Skipped straight to resolving with no responses when nobody is eligible to answer.
let releaseResponses = [];
function releaseFlow() {
  const p = E.activePlayer(game);
  const eligible = game.players.filter(o => o.id !== p.id).flatMap(o => {
    const r = [];
    if (o.role === 'redTeamer' && !game.auditUsedThisRound) r.push({ o, type: 'audit', label: `${o.name} audits (red-teamer)` });
    if (o.role === 'whistleblower' && !o.whistleblowUsed) r.push({ o, type: 'whistleblow', label: `${o.name} blows the whistle` });
    return r;
  });
  if (!eligible.length) { applyAndRender(g => E.releaseModel(g, p.id, [], CARDS)); return; }
  releaseResponses = [];
  const panel = els('actionPanel');
  panel.innerHTML = '';
  const title = document.createElement('p'); title.innerHTML = '<b>Response window:</b> before this release resolves, anyone eligible may respond.';
  panel.appendChild(title);
  const row = document.createElement('div'); row.className = 'actions';
  eligible.forEach(e => {
    const btn = actBtn(e.label, () => {
      const i = releaseResponses.findIndex(r => r.responderId === e.o.id && r.type === e.type);
      if (i >= 0) releaseResponses.splice(i, 1); else releaseResponses.push({ responderId: e.o.id, type: e.type });
      btn.classList.toggle('is-picked', releaseResponses.some(r => r.responderId === e.o.id && r.type === e.type));
    });
    row.appendChild(btn);
  });
  panel.appendChild(row);
  panel.appendChild(actBtn('Resolve the release', () => applyAndRender(g => E.releaseModel(g, p.id, releaseResponses, CARDS))));
}

// ── belief bets (secret; never spends a turn action) ────────────────────────────────────────────
function placeBet() {
  const p = E.activePlayer(game);
  const category = els('betCategory').value, value = els('betValue').value;
  try { game = E.placeBeliefToken(game, p.id, category, value); renderTurn(); }
  catch (e) { flashError(e.message); }
}

// ── the end: the World is revealed, and scoring shown ───────────────────────────────────────────
function renderEnd() {
  els('turnScreen').hidden = true; els('passCover').hidden = true; els('rsiPanel').hidden = true;
  els('game').inert = false; els('game').hidden = true;
  PS.closeAllOverlays();
  PS.exitPlayMode();
  renderBoard();
  els('end').hidden = false;
  const type = game.ended.type;
  els('endTitle').textContent = type === 'proceed' ? 'Proceed — the best ending'
    : type === 'catastrophe' ? 'Catastrophe' : 'The game reached the end of ' + game.endYear;
  els('endReason').textContent = game.ended.reason;
  const info = game.worldRevealInfo || E.revealWorld(game);
  els('worldReveal').innerHTML = `
    <h3>The World, revealed</h3>
    <p><b>Takeoff:</b> ${esc(info.takeoff.name)} — ${esc(info.takeoff.text)}${info.takeoff.source ? ` <span class="src"><a href="${esc(info.takeoff.source.url)}" target="_blank" rel="noopener">${esc(info.takeoff.source.label)}</a></span>` : ''}</p>
    <p><b>Alignment dynamics:</b> ${esc(info.alignmentDynamics.name)} — ${esc(info.alignmentDynamics.text)}${info.alignmentDynamics.source ? ` <span class="src"><a href="${esc(info.alignmentDynamics.source.url)}" target="_blank" rel="noopener">${esc(info.alignmentDynamics.source.label)}</a></span>` : ''}</p>
    <p class="muted">${esc(info.note)}</p>`;
  const score = E.scoreGame(game);
  const table = els('scoreTable');
  table.innerHTML = '<tr><th>Player</th><th>Objective</th><th>Correct bets</th><th>Result</th></tr>' +
    score.results.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(E.OBJECTIVES.find(o => o.id === r.objective).name)}</td><td>${r.correctBets}</td><td class="${r.won ? 'won' : ''}">${r.won ? 'Won (' + r.points + ' pt)' : score.catastrophe ? 'Lost — catastrophe' : 'Did not win'}</td></tr>`).join('');
}

boot();
