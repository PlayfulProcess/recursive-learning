// Recursive Ekho, the board game: the rules as code (a toy model, sketch 1, rules v5).
// Odds, not paths: beads sit in seven hollows; at the Crossing one bead is drawn from a bag.
// Moves raise or lower a chance; nothing here forecasts anything about the world.
// Plain script: defines window.EKHO, or module.exports under Node. Deterministic from a seed.
// PLAYTEST-ekho-2026-10-12.md says what changed between rule versions, and why.
(function (root) {
'use strict';

// ---------------------------------------------------------------- the table
var HOLLOWS = ['grace', 'turn', 'stop', 'adolescence', 'lockin', 'doom', 'still'];
var HOLLOW_NAME = { grace: 'Grace', turn: 'The turn', stop: 'The Stop', adolescence: 'Adolescence',
  lockin: 'Lock-in', doom: 'Doom', still: 'Still walking' };
var GOOD = ['grace', 'turn', 'stop'], BAD = ['lockin', 'doom'];
var START_BEADS = { grace: 1, turn: 1, stop: 0, adolescence: 4, lockin: 3, doom: 3, still: 6 };   // v4: Still walking 2 -> 6, so Goodwill and the red team do not empty it every game

var C = {                    // every number the playtests tune, in one place
  VERSION: 5,
  CROSSING: 10,
  TIDE_START: { gentle: 0, fair: 2, harsh: 4, dire: 5 },
  MARKS: [3, 6, 8],          // ◇: a veil lifts and the clock speeds up
  CLOCK: ['quarter', 'month', 'week', 'day'],
  CONDITIONS_PER_ROUND: [1, 2, 2, 3],
  POUR: [1, 2, 4, 6],        // beads of new capability poured into Adolescence each round, by clock
  ADOLESCENCE_CAP: 5,        // above it, Adolescence spills, alternately into Lock-in and Doom
  HAND: 4, MOVES_EACH: 2, MAX_ROUNDS: 40,
  COUNCIL_SHARE: 1.2,        // v4 (was 0.6): the Council needs one more Together than the table has seats (1-4 players),
                             // so it passes only when Advocate, Public mood or a Warning shot made up the difference
  RELATIONALITY_MARK: 3,
};

// The world: four switches, each with a gentle and a harsh face, drawn face-down from a tilted deck.
var SWITCHES = [
  { id: 'nature', q: 'Aligned by its nature?', gentle: 'Aligned by its nature', harsh: 'Orthogonal to morality' },
  { id: 'contain', q: 'Containable?', gentle: 'Containable', harsh: 'Not containable' },
  { id: 'look', q: 'How do we look to it?', gentle: 'Partners', harsh: 'We look like a threat' },
  { id: 'reach', q: 'Its reach?', gentle: 'Bounded', harsh: 'Unbounded' },
];
var TILTS = { kind: [2, 1], fair: [1, 1], harsh: [1, 2] };   // [gentle, harsh] cards shuffled per switch

var MOVES = {   // the Move deck: id -> [copies, name, what it does]
  build:    [10, 'Build', 'Edge +1 for you and a bead into Adolescence; draw a card.'],
  align:    [8, 'Align & secure', 'Move a bead from Doom (else Lock-in) to Grace. Alignment lead +1.'],
  tend:     [8, 'Tend the commons', 'Move a bead from Lock-in (else Doom) to The turn. Commons lead +1.'],
  advocate: [6, 'Advocate', 'Together +1 (the next Council needs one fewer). If the Council passed, a bead from Adolescence into the Stop.'],
  stop:     [6, 'Stop together', 'Only if the Council passed: pledge a Stop and move a bead from Adolescence into it. If half the table (at least two players) pledges this round, the tide holds.'],
  goodwill: [3, 'Goodwill', 'Relationality +1, and a bead from Still walking to The turn.'],
  process:  [3, 'Processing', 'Move two beads from Adolescence to The turn.'],
  create:   [2, 'Creative work', 'Relationality +1 and move one bead one hollow toward Grace.'],
  take:     [2, 'Take', 'Edge +2 for you, and a bead from The turn into Lock-in.'],
};
var CONDITIONS = {   // the Conditions deck: id -> [copies, name, what happens]
  warning:      [4, 'Warning shot', 'The Council needs one fewer Together this round. A bead moves from Doom to the Stop.'],
  breakthrough: [6, 'Breakthrough', 'A bead into Adolescence. The tide rises one, unless someone discards Align & secure.'],
  rival:        [5, 'A rival ships first', 'A bead into Lock-in. Whoever voted Build last Council gains Edge +1.'],
  misuse:       [3, 'Misuse', 'A bead into Doom, unless the Commons lead is 2 or more.'],
  result:       [4, 'A safety result', 'Alignment lead +1.'],
  mood:         [3, 'Public mood turns', 'Together +1.'],
  surge:        [3, 'The waters rise', 'The tide climbs one. The used conditions go back on top, the same troubles returning sooner; this card goes under the deck.'],
  crossroads:   [4, 'Crossroads', 'The active player casts their oracle: one free move, and a free change of role.'],
  redteam:      [2, 'The red team', 'Each player answers with a practice, or a bead goes from Still walking to Doom.'],
  whiteteam:    [2, 'The white team', 'Each player draws a practice.'],
};
var ROLES = {
  researcher: ['The AI researcher', 'Once a round, Align & secure costs no move.'],
  poet:       ['The poet', 'Once a round, move one bead one hollow toward Grace. Creative work counts twice.'],
  seeker:     ['The wisdom seeker', 'Starts with two practices and may answer the red team for a neighbour.'],
  teacher:    ['The teacher', 'Once a round, sit beside a player: you each gain a free move. Beside the young AI, it stops adding Doom.'],
  youngai:    ['The young AI', 'Advanced. Its Builds add a Doom bead until a teacher sits beside it; once taught, it may play a Build reversed, as Align & secure.'],
};

// ---------------------------------------------------------------- randomness that survives a JSON copy
function rand(g) { var a = (g.rs = (g.rs + 0x6D2B79F5) | 0);
  var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(g, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand(g) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function deckOf(table) { var d = []; Object.keys(table).forEach(function (k) { for (var i = 0; i < table[k][0]; i++) d.push(k); }); return d; }
function say(g, t) { if (!g.log) return; g.log.push('R' + g.round + ' · ' + t); if (g.log.length > 600) g.log.shift(); }

// ---------------------------------------------------------------- a new game
function newGame(o) {
  o = o || {};
  var n = o.players || 3;
  var g = { opts: o, rs: (o.seed || 1) | 0, round: 0, mode: o.mode || 'commons', log: [], over: null,
    tide: C.TIDE_START[o.tide || 'fair'], clock: 0, beads: {}, align: 0, commons: 0, together: 0, rel: 0, spill: 0, pourExtra: 0, doomPour: 0, spillDoom: false,
    passed: false, pledges: 0, pledgers: [], bar: 0, votes: [], lastBuilders: [], moveDeck: [], moveUsed: [],
    condDeck: [], condUsed: [], marks: [], practices: 8, world: [], lifted: [], known: [], players: [], pool: [], clockRounds: [0, 0, 0, 0],
    stats: { moves: {}, conds: {}, councils: 0, passed: 0, holds: 0, pledges: 0, poured: 0, spilled: 0 } };
  HOLLOWS.forEach(function (h) { g.beads[h] = START_BEADS[h]; });
  var tilt = o.tilt || 'fair';
  SWITCHES.forEach(function (s, i) {   // per switch: shuffle the tilted cards, keep one face-down
    var face;
    if (tilt === 'open') face = (o.faces && o.faces[i]) || 'gentle';
    else { var t = TILTS[tilt], cards = []; for (var k = 0; k < t[0]; k++) cards.push('gentle'); for (k = 0; k < t[1]; k++) cards.push('harsh');
      face = shuffle(g, cards)[0]; }
    g.world.push(face); g.lifted.push(false); g.known.push(tilt === 'open');   // open: face-up from the start, still applied at a mark
  });
  g.moveDeck = shuffle(g, deckOf(MOVES));
  g.condDeck = shuffle(g, deckOf(CONDITIONS));
  var roles = (o.roles || ['researcher', 'teacher', 'poet', 'seeker', 'researcher', 'teacher']).slice(0, n);
  if (o.youngAI && roles.indexOf('youngai') < 0) roles[n - 1] = 'youngai';
  g.pool = Object.keys(ROLES).filter(function (r) { return r !== 'youngai' && roles.indexOf(r) < 0; });
  for (var p = 0; p < n; p++) {
    var pl = { id: p, name: (o.names && o.names[p]) || ('Player ' + (p + 1)), role: roles[p], hand: [], practices: 0, edge: 0, taught: false, sat: false };
    if (pl.role === 'seeker') { pl.practices = 2; g.practices -= 2; }
    g.players.push(pl);
    for (var k2 = 0; k2 < C.HAND; k2++) draw(g, pl);
  }
  // a later start is a later world: the marks already behind the tide have sped the clock and lifted their veils
  C.MARKS.forEach(function (m) { if (g.tide >= m) { g.marks.push(m); g.clock = Math.min(C.CLOCK.length - 1, g.clock + 1); liftOne(g); } });
  return g;
}

function draw(g, p) {
  if (!g.moveDeck.length) { g.moveDeck = shuffle(g, g.moveUsed); g.moveUsed = []; }
  if (g.moveDeck.length) p.hand.push(g.moveDeck.pop());
}
function discard(g, p, card) { var i = p.hand.indexOf(card); if (i >= 0) { p.hand.splice(i, 1); g.moveUsed.push(card); return true; } return false; }

// Beads. move(): from the first non-empty source to a hollow; nothing to take, nothing moves.
function move(g, sources, to) {
  for (var i = 0; i < sources.length; i++) if (g.beads[sources[i]] > 0) { g.beads[sources[i]]--; g.beads[to]++; return true; }
  return false;
}
function add(g, to, n) { g.beads[to] += (n || 1); }
function towardGrace(g) {   // the poet's and Creative work's nudge: the worst non-empty hollow gives one bead to its neighbour
  var next = { doom: 'lockin', lockin: 'adolescence', adolescence: 'turn', still: 'turn' };
  var order = ['doom', 'lockin', 'adolescence', 'still'];
  for (var i = 0; i < order.length; i++) if (move(g, [order[i]], next[order[i]])) return order[i] + '>' + next[order[i]];
  return null;
}
function total(g) { return HOLLOWS.reduce(function (s, h) { return s + g.beads[h]; }, 0); }
function share(g, list) { var t = total(g); return t ? list.reduce(function (s, h) { return s + g.beads[h]; }, 0) / t : 0; }
function isOn(g, i, face) { return g.lifted[i] && g.world[i] === face; }
function stopNeed(g) { var n = g.players.length; return n === 1 ? 1 : Math.max(2, Math.ceil(n / 2)); }

// ---------------------------------------------------------------- what a card does to the table
// effect() touches only the table (beads, leads, tide flags), so a bot can try it on a light copy.
function effect(g, c, role) {
  if (c === 'build') add(g, 'adolescence');
  else if (c === 'align') { var t = isOn(g, 1, 'gentle') ? 2 : 1; for (var i = 0; i < t; i++) { move(g, ['doom', 'lockin'], 'grace'); g.align++; } }
  else if (c === 'tend') { move(g, ['lockin', 'doom'], 'turn'); g.commons++; }
  else if (c === 'advocate') { g.together++; if (g.passed) move(g, ['adolescence'], 'stop'); }
  else if (c === 'stop') { move(g, ['adolescence'], 'stop'); }
  else if (c === 'goodwill') { g.rel++; move(g, ['still'], 'turn'); }
  else if (c === 'process') { move(g, ['adolescence'], 'turn'); move(g, ['adolescence'], 'turn'); }
  else if (c === 'create') { var k = role === 'poet' ? 2 : 1; for (var j = 0; j < k; j++) { g.rel++; towardGrace(g); } }
  else if (c === 'take') { if (!move(g, ['turn'], 'lockin')) add(g, 'lockin'); }
}

function playCard(g, p, c, extra) {
  g.stats.moves[c] = (g.stats.moves[c] || 0) + 1;
  if (c === 'stop') { g.stats.pledges++; if (g.pledgers.indexOf(p.id) < 0) { g.pledgers.push(p.id); g.pledges = g.pledgers.length; } }
  effect(g, c, p.role);
  if (c === 'build') { p.edge++; draw(g, p);
    if (p.role === 'youngai' && !p.taught) { add(g, 'doom'); say(g, p.name + ' (young AI) builds untaught: a Doom bead.'); } }
  if (c === 'take') p.edge += 2;
  say(g, p.name + ' plays ' + MOVES[c][1] + (extra || '') + '.');
}

// ---------------------------------------------------------------- decisions
// A decision is { player, kind: 'council'|'move'|'respond', options: [{ id, label }] }.
// choose(g, decision) returns an option id. Bots and the CLI both answer through it.
function ask(g, choose, d) {
  var id = choose(g, d);
  if (!d.options.some(function (o) { return o.id === id; })) id = d.options[0].id;
  return id;
}

function moveOptions(g, p, free) {
  var opts = [], seen = {};
  p.hand.forEach(function (c) {
    if (seen[c]) return; seen[c] = 1;
    if (c === 'stop' && !g.passed) return;
    opts.push({ id: 'play:' + c, label: MOVES[c][1] + ' — ' + MOVES[c][2] });
    if (c === 'build' && p.role === 'youngai' && p.taught) opts.push({ id: 'reverse:build', label: 'Build, reversed (taught young AI): play it as Align & secure' });
  });
  opts.push({ id: 'draw', label: 'Draw a card' });
  if (p.role === 'teacher' && !free && !p.sat) g.players.forEach(function (q) { if (q !== p) opts.push({ id: 'sit:' + q.id, label: 'Sit beside ' + q.name + ' (you each gain a free move)' }); });
  if (g.pool.length && !free) g.pool.forEach(function (r) { opts.push({ id: 'role:' + r, label: 'Change role to ' + ROLES[r][0] + ' (' + ROLES[r][1] + ')' }); });
  return opts;
}

function doMove(g, p, choose, free) {
  var id = ask(g, choose, { player: p.id, kind: 'move', free: !!free, options: moveOptions(g, p, free) });
  if (id === 'draw') { draw(g, p); say(g, p.name + ' draws.'); return; }
  var parts = id.split(':');
  if (parts[0] === 'play') { discard(g, p, parts[1]); playCard(g, p, parts[1]); }
  else if (parts[0] === 'reverse') { discard(g, p, 'build'); g.stats.moves.reversed = (g.stats.moves.reversed || 0) + 1; effect(g, 'align', p.role);
    say(g, p.name + ' plays a Build reversed: Align & secure.'); }
  else if (parts[0] === 'sit') { var q = g.players[+parts[1]]; q.taught = true; p.sat = true; say(g, p.name + ' sits beside ' + q.name + '.');
    doMove(g, p, choose, true); doMove(g, q, choose, true); }
  else if (parts[0] === 'role') swapRole(g, p, parts[1]);
}
function swapRole(g, p, r) { var i = g.pool.indexOf(r); if (i < 0) return; g.pool.splice(i, 1); if (p.role !== 'youngai') g.pool.push(p.role);
  say(g, p.name + ' changes role: ' + ROLES[p.role][0] + ' → ' + ROLES[r][0] + '.'); p.role = r; }

// ---------------------------------------------------------------- a round
function conditions(g, choose, active) {
  var n = C.CONDITIONS_PER_ROUND[g.clock];
  for (var i = 0; i < n && !g.over; i++) {
    if (!g.condDeck.length) { g.over = ending(g, 'still', 'the conditions ran out'); return; }
    var c = g.condDeck.pop(); g.condUsed.push(c); g.stats.conds[c] = (g.stats.conds[c] || 0) + 1;
    say(g, 'Condition: ' + CONDITIONS[c][1] + '.');
    if (c === 'warning') { g.bar--; move(g, ['doom'], 'stop'); }
    else if (c === 'breakthrough') { add(g, 'adolescence');
      var holder = g.players.filter(function (q) { return q.hand.indexOf('align') >= 0; })[0];
      var block = holder && ask(g, choose, { player: holder.id, kind: 'respond', options: [
        { id: 'discard', label: 'Discard Align & secure: the tide holds' }, { id: 'keep', label: 'Keep it: the tide rises one' }] }) === 'discard';
      if (block) { discard(g, holder, 'align'); say(g, holder.name + ' spends Align & secure; the tide holds.'); } else rise(g, 1); }
    else if (c === 'rival') { add(g, 'lockin'); g.lastBuilders.forEach(function (id) { g.players[id].edge++; }); }
    else if (c === 'misuse') { if (g.commons < 2) add(g, 'doom'); }
    else if (c === 'result') g.align++;
    else if (c === 'mood') g.together++;
    else if (c === 'surge') {   // v5: the used conditions go back on top, but the surge itself goes under the deck, so it cannot return at once
      rise(g, 1); g.condUsed.pop();
      g.condDeck = [c].concat(g.condDeck, shuffle(g, g.condUsed.slice())); g.condUsed = []; }
    else if (c === 'crossroads') { var p = g.players[active];
      if (g.pool.length) { var r = ask(g, choose, { player: p.id, kind: 'respond', options: [{ id: 'keep', label: 'Keep your role' }]
        .concat(g.pool.map(function (x) { return { id: x, label: 'Take ' + ROLES[x][0] + ' (' + ROLES[x][1] + ')' }; })) });
        if (r !== 'keep') swapRole(g, p, r); }
      doMove(g, p, choose, true); }
    else if (c === 'redteam') g.players.forEach(function (q) {
      if (q.practices > 0) { q.practices--; g.practices++; return; }
      var helper = g.players.filter(function (s) { return s.role === 'seeker' && s.practices > 0; })[0];
      if (helper) { helper.practices--; g.practices++; } else if (!move(g, ['still'], 'doom')) add(g, 'doom'); });
    else if (c === 'whiteteam') g.players.forEach(function (q) { if (g.practices > 0) { q.practices++; g.practices--; } });
    if (g.tide >= C.CROSSING) return;
  }
}

// The Together a Council needs: a share of the table, less the Together banked and this round's warnings.
function councilNeed(g) { return Math.max(1, Math.ceil(C.COUNCIL_SHARE * g.players.length) + g.bar - g.together); }
// How many of those the table's own votes cannot cover: they come from Advocate, Public mood or a Warning shot.
function councilShort(g) { return Math.max(0, Math.ceil(C.COUNCIL_SHARE * g.players.length) - g.players.length); }

function council(g, choose) {
  var n = g.players.length;
  var need = councilNeed(g);
  var t = 0; g.votes = [];
  g.players.forEach(function (p) {
    var v = ask(g, choose, { player: p.id, kind: 'council', need: need, options: [
      { id: 'together', label: 'Together' }, { id: 'build', label: 'Build (you draw a card' + (g.mode === 'race' ? ' and gain Edge +1' : '') + ')' }] });
    g.votes.push(v); if (v === 'together') t++;
  });
  g.lastBuilders = [];
  g.votes.forEach(function (v, i) { if (v === 'build') { var p = g.players[i]; draw(g, p); if (g.mode === 'race') p.edge++; g.lastBuilders.push(i); } });
  g.passed = t >= need; g.stats.councils++; if (g.passed) { g.stats.passed++; g.together = 0; }
  say(g, 'Council: ' + t + ' Together of ' + n + ', needed ' + need + (g.passed ? ': it passes.' : ': it fails.'));
}

// v5: a ◇ mark counts once. When Bounded drops the tide below a mark it has passed, rising past it again lifts no second veil.
function rise(g, k) {
  var before = g.tide; g.tide = Math.min(C.CROSSING, g.tide + k);
  C.MARKS.forEach(function (m) { if (before < m && g.tide >= m && g.marks.indexOf(m) < 0) { g.marks.push(m); g.clock = Math.min(C.CLOCK.length - 1, g.clock + 1);
    say(g, 'The tide passes a ◇ mark: a round is now a ' + C.CLOCK[g.clock] + '.'); liftOne(g); } });
}
function fall(g, k) { g.tide = Math.max(0, g.tide - k); }

function liftOne(g) {
  var hidden = []; g.lifted.forEach(function (l, i) { if (!l) hidden.push(i); });
  if (hidden.length) lift(g, hidden[Math.floor(rand(g) * hidden.length)]);
}
function lift(g, i) {
  if (g.lifted[i]) return; g.lifted[i] = true; g.known[i] = true;
  var s = SWITCHES[i], face = g.world[i];
  say(g, 'A veil lifts: ' + s.q + ' ' + s[face] + '.');
  if (s.id === 'nature') { if (face === 'gentle') { move(g, ['doom', 'lockin'], 'grace'); move(g, ['doom', 'lockin'], 'grace'); }
    else { add(g, 'doom', 2); if (g.align < g.tide) { g.doomPour = 1; say(g, 'The alignment lead stands below the tide: from now on each pour also drops a bead into Doom.'); } } }
  else if (s.id === 'contain') { if (face === 'harsh') { add(g, 'doom', 2); g.spillDoom = true; } }
  else if (s.id === 'look') { if (face === 'gentle') { move(g, ['still', 'adolescence'], 'grace'); move(g, ['still', 'adolescence'], 'grace'); }
    else { add(g, 'lockin', 2); if (g.rel < C.RELATIONALITY_MARK) add(g, 'lockin', 2); } }
  else if (s.id === 'reach' && !g.crossed) { if (face === 'gentle') { g.pourExtra = -1; fall(g, 1); } else { g.pourExtra = 1; rise(g, 1); } }   // at the Crossing the tide stays where it is
}

// The tide pours new capability into Adolescence; what it cannot hold spills into Lock-in and Doom.
function pour(g) {
  // the pour is set for three players and scales with the table, so a bigger table meets a bigger flood
  var k = Math.max(0, Math.round(C.POUR[g.clock] * g.players.length / 3) + g.pourExtra); add(g, 'adolescence', k); g.stats.poured += k;
  if (g.doomPour) add(g, 'doom', g.doomPour);
  var spilt = 0;
  while (g.beads.adolescence > C.ADOLESCENCE_CAP) { g.beads.adolescence--; g.beads[g.spillDoom || g.spill++ % 2 ? 'doom' : 'lockin']++; g.stats.spilled++; spilt++; }
  // the log lines below only narrate (the page's "Watch a round" reads them); they change no rule
  say(g, 'The pour: ' + k + ' new bead' + (k === 1 ? '' : 's') + ' into Adolescence' + (g.doomPour ? ', and one into Doom' : '')
    + (spilt ? '; ' + spilt + ' spill' + (spilt === 1 ? 's' : '') + ' into Lock-in and Doom' : '') + '.');
}

function ending(g, hollow, why) {
  var probs = {}; var t = total(g); HOLLOWS.forEach(function (h) { probs[h] = t ? g.beads[h] / t : 0; });
  var kind = GOOD.indexOf(hollow) >= 0 ? 'good' : BAD.indexOf(hollow) >= 0 ? 'bad' : 'open';
  var o = { hollow: hollow, name: HOLLOW_NAME[hollow], kind: kind, why: why, round: g.round, probs: probs,
    good: share(g, GOOD), bad: share(g, BAD), world: g.world.slice(), clockRounds: g.clockRounds.slice() };
  if (g.mode === 'race') {   // the race is won only in a world still standing, and only by a clear lead
    var top = Math.max.apply(null, g.players.map(function (p) { return p.edge; }));
    var leaders = g.players.filter(function (p) { return p.edge === top; });
    o.raceWinner = kind === 'bad' || top === 0 ? null : leaders.length > 1 ? 'shared' : leaders[0].name; }
  say(g, 'Ending: ' + o.name + ' (' + why + ').');
  return o;
}

function crossing(g) {
  g.crossed = true;
  g.lifted.forEach(function (l, i) { if (!l) lift(g, i); });
  var t = total(g), r = rand(g) * t, acc = 0, pick = 'still';
  for (var i = 0; i < HOLLOWS.length; i++) { acc += g.beads[HOLLOWS[i]]; if (r < acc) { pick = HOLLOWS[i]; break; } }
  g.over = ending(g, pick, 'the tide reached the Crossing; one bead drawn from ' + t);
}

function playRound(g, choose) {
  g.round++; g.bar = 0; g.passed = false; g.pledges = 0; g.pledgers = [];
  g.players.forEach(function (p) { p.sat = false; });
  var active = (g.round - 1) % g.players.length;
  g.clockRounds[g.clock]++;
  conditions(g, choose, active);
  if (g.over) return;
  if (g.tide >= C.CROSSING) return crossing(g);
  council(g, choose);
  var used = {};
  for (var k = 0; k < g.players.length; k++) {
    var p = g.players[(active + k) % g.players.length];
    for (var m = 0; m < C.MOVES_EACH; m++) doMove(g, p, choose, false);
    if (p.role === 'researcher' && p.hand.indexOf('align') >= 0 && !used[p.id]) {
      var a = ask(g, choose, { player: p.id, kind: 'respond', options: [{ id: 'yes', label: 'Researcher: play Align & secure for free' }, { id: 'no', label: 'Not now' }] });
      if (a === 'yes') { discard(g, p, 'align'); playCard(g, p, 'align', ' (free, researcher)'); } used[p.id] = 1; }
    if (p.role === 'poet') { var mv = towardGrace(g); if (mv) say(g, p.name + ' (poet) nudges a bead: ' + mv + '.'); }
  }
  g.players.forEach(function (p) { while (p.hand.length < C.HAND) draw(g, p); while (p.hand.length > C.HAND + 2) g.moveUsed.push(p.hand.shift()); });
  pour(g);
  var held = g.passed && g.pledges >= stopNeed(g);
  if (held) { g.stats.holds++; say(g, 'Stop together: ' + g.pledges + ' players pledged. The tide holds.');
    if (C.CLOCK[g.clock] === 'day') { g.clock--; say(g, 'A Stop on the day clock gives the table back time: the clock turns back.'); } }
  else {
    if (g.pledges) say(g, 'Only ' + g.pledges + ' player(s) pledged a Stop, ' + stopNeed(g) + ' needed: the tide does not hold.');
    var builds = g.votes.filter(function (v) { return v === 'build'; }).length, up = builds > g.votes.length - builds ? 2 : 1;
    say(g, 'The tide rises ' + up + (up === 2 ? ' (most voted Build)' : '') + ', to ' + Math.min(C.CROSSING, g.tide + up) + ' of ' + C.CROSSING + '.');
    rise(g, up);
  }
  if (g.tide >= C.CROSSING) return crossing(g);
  if (g.round >= C.MAX_ROUNDS) g.over = ending(g, 'still', 'forty rounds');
}

function run(g, choose) { var guard = 200; while (!g.over && guard--) playRound(g, choose); return g; }

// ---------------------------------------------------------------- bots
// A bot is a habit, not a mind. 'greedy' looks one move ahead with value(); 'commons' plays a fixed
// cooperative order; 'racer' builds; 'rival' free-rides (Build when its vote is not needed);
// 'random' picks anything legal; 'only:<move>' plays one card whenever it holds it.
function value(g) {   // the table's sense of how things stand: the odds now, plus what the veils will ask of it
  var v = share(g, GOOD) - share(g, BAD);
  if (!g.lifted[0]) v += 0.02 * Math.min(g.align, g.tide + 1);
  if (!g.lifted[2]) v += 0.02 * Math.min(g.rel, C.RELATIONALITY_MARK);
  if (g.commons < 2) v += 0.01 * g.commons;
  v += 0.02 * Math.min(g.together, councilShort(g));   // Together the next Council will need beyond the table's own votes
  return v;
}
function light(g) {   // the part of the table effect() touches
  return { beads: Object.assign({}, g.beads), align: g.align, commons: g.commons, together: g.together, rel: g.rel,
    passed: g.passed, pledges: g.pledges, tide: g.tide, lifted: g.lifted, world: g.world, players: g.players };
}

function bot(habit) {
  return function (g, d) {
    var p = g.players[d.player], ids = d.options.map(function (o) { return o.id; });
    var has = function (id) { return ids.indexOf(id) >= 0; };
    if (habit === 'random') return ids[Math.floor(rand(g) * ids.length)];
    if (d.kind === 'council') {
      if (habit === 'racer') return 'build';
      if (habit === 'commons' || habit.indexOf('only:') === 0) return 'together';
      var sofar = g.votes.filter(function (v) { return v === 'together'; }).length, left = g.players.length - g.votes.length;
      if (habit === 'rival') return sofar >= d.need ? 'build' : 'together';   // free-ride when the vote is already won
      if (sofar + left >= d.need) return 'together';                        // greedy: Together while it can still pass
      var builds = g.votes.length - sofar;                                  // a lost vote: Build draws a card, unless
      return builds + 1 > g.players.length - builds - 1 ? 'together' : 'build';   // it makes Build the majority (tide +2)
    }
    if (d.kind === 'respond') {
      if (has('discard')) return habit === 'racer' || habit === 'rival' ? 'keep' : 'discard';
      if (has('yes')) return 'yes';
      return 'keep';
    }
    var pref = habit === 'racer' ? ['play:take', 'play:build', 'play:advocate', 'draw']
      : habit === 'commons' ? ['play:stop', 'play:align', 'play:tend', 'play:process', 'play:create', 'play:goodwill', 'play:advocate', 'draw']
      : habit.indexOf('only:') === 0 ? ['play:' + habit.slice(5), 'draw'] : null;
    if (pref) { for (var i = 0; i < pref.length; i++) if (has(pref[i])) return pref[i]; return 'draw'; }
    if (habit === 'rival' && share(g, GOOD) > 0.45) { if (has('play:take')) return 'play:take'; if (has('play:build')) return 'play:build'; }
    // greedy: try each option on a light copy, one move deep, and keep the best value
    var best = 'draw', bestV = -1e9;
    var pledgesLeft = stopNeed(g) - g.pledges;
    d.options.forEach(function (o) {
      if (o.id.indexOf('role:') === 0) return;
      var c = light(g), v;
      if (o.id === 'draw') v = value(c) - 0.004;
      else if (o.id.indexOf('sit:') === 0) { var q = g.players[+o.id.slice(4)]; v = value(c) + (q.role === 'youngai' && !q.taught ? 0.07 : 0.03); }
      else if (o.id === 'reverse:build') { effect(c, 'align', p.role); v = value(c); }
      else { effect(c, o.id.slice(5), p.role); v = value(c);
        if (o.id === 'play:stop' && g.pledgers.indexOf(p.id) < 0) v += pledgesLeft <= 1 ? 0.06 : 0.025 * g.players.filter(function (q) { return q !== p && q.hand.indexOf('stop') >= 0; }).length;
        if (o.id === 'play:build') v -= 0.01; }
      if (v > bestV) { bestV = v; best = o.id; }
    });
    return best;
  };
}
function tableChooser(habits) { var bots = habits.map(bot); return function (g, d) { return bots[d.player % bots.length](g, d); }; }
function simulate(o, habits) { return run(newGame(o), tableChooser(habits || ['greedy'])).over; }

var api = { consts: C, HOLLOWS: HOLLOWS, HOLLOW_NAME: HOLLOW_NAME, GOOD: GOOD, BAD: BAD, SWITCHES: SWITCHES, MOVES: MOVES,
  CONDITIONS: CONDITIONS, ROLES: ROLES, TILTS: TILTS, START_BEADS: START_BEADS, newGame: newGame, playRound: playRound, run: run,
  bot: bot, tableChooser: tableChooser, simulate: simulate, value: value, share: share, total: total, stopNeed: stopNeed,
  councilNeed: councilNeed, councilShort: councilShort };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EKHO = api;
})(this);
