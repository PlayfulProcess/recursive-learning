// The Landlord's Game, live again: the rules as code, shared by the page and the node tests.
// Two rule sets on one board, after Lizzie Magie (patents 1904 and 1924, public domain).
// The words and numbers here are ours. Plain script: defines window.LG (or module.exports).
(function (root) {
'use strict';

var WAGES = 100, NECESSITY = 20, LUXURY = 50, LUXURY_WORTH = 60, LEGACY = 100, JAIL_FINE = 50;
var PUBLIC_FEE = 10, GIFT_ON_PURCHASE = 10, DIVIDEND_SHARE = 0.5;
var LAPS_TO_END = 5, PROSPERITY_LIMIT = 40, LANDLORD_LIMIT = 80;
// Round 2 playtest (Oct 12 2026): three decisions, each with the old rule kept as a variant so the
// numbers can be re-run (playtest.mjs variants). Defaults are the adopted rules.
//   price: 'treasury' = a buyer pays the price into the Public Treasury (the 1904 patent's rule); 'bank' = the old rule.
//   sale:  'least'    = short of cash, the lots that give up the least land value and still cover the debt (on
//                       paper the player chooses, as in the 1924 patent; this is the computer's choice); 'cheapest' = the old rule.
//   end:   'laps'     = Prosperity ends, like the landlord's way, when every player still in has been round
//                       five times (the 1904 patent's end); 'rounds' = the old forty-round count.
// Prosperity tension (Oct 12 2026): with the price into the Treasury, unequal tables won 100% of bot games in
// about 9 rounds, whatever anyone chose. One change to the win condition:
//   win:   'rise'     = the poorest starter has doubled AND holds at least as much as anyone, while nobody
//                       holds less than they started with ("the poorest rises to the top, and nobody falls");
//                       'double' = the old rule (the poorest starter has doubled). Equal starts: both mean every player doubles.
var DEFAULT_RULES = { price: 'treasury', sale: 'least', end: 'laps', win: 'rise' };
var JAIL = 10, POORHOUSE = 39;

function rng(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0;
  var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function rentOf(s) { return Math.max(5, Math.round(s.price * 0.3 / 5) * 5); }
function side(i) { return Math.floor(i / 10); }

function newGame(spaces, opts) {
  var starts = opts.starts, n = starts.length;
  var g = { spaces: spaces, mode: opts.mode, rand: rng(opts.seed || 1), round: 1, turn: 0, treasury: 0,
    owner: spaces.map(function () { return null; }), log: [], over: null, pending: null, dice: [0, 0],
    players: [], rules: {} };
  for (var key in DEFAULT_RULES) g.rules[key] = (opts.rules && opts.rules[key]) || DEFAULT_RULES[key];
  for (var k = 0; k < n; k++) g.players.push({ id: k, name: (opts.names && opts.names[k]) || ('Player ' + (k + 1)),
    start: starts[k], cash: starts[k], pos: 0, jail: false, tries: 0, skip: false, poor: false, laps: 0,
    tickets: 0, legacies: 0, computer: !!(opts.computers && opts.computers[k]) });
  return g;
}

// One period at the end, even after a name that ends in one ("Southern R.R.").
function say(g, t) { g.log.push('Round ' + g.round + ' · ' + t.replace(/\.\.$/, '.')); if (g.log.length > 400) g.log.shift(); }
function ownedBy(g, p) { var out = []; for (var i = 0; i < g.owner.length; i++) if (g.owner[i] === p.id) out.push(i); return out; }
function worth(g, p) { var w = p.cash + p.tickets * LUXURY_WORTH;
  ownedBy(g, p).forEach(function (i) { w += g.spaces[i].price || 0; }); return w; }
function active(g) { return g.players.filter(function (p) { return !p.poor; }); }

// Paying, with the bank buying back land at half price when cash runs short.
function pay(g, p, amount, to) {
  if (p.cash < amount) lotsToSell(g, p, amount - p.cash).forEach(function (i) {
    g.owner[i] = null; p.cash += Math.floor(g.spaces[i].price / 2);
    say(g, p.name + ' sells ' + g.spaces[i].name + ' back to the bank for $' + Math.floor(g.spaces[i].price / 2) + '.'); });
  var paid = Math.min(p.cash, amount); p.cash -= paid;
  if (to === 'treasury') g.treasury += paid; else if (to) to.cash += paid;
  if (paid < amount) { toPoorhouse(g, p); }
  return paid;
}
// Which holdings go back when cash runs short. On paper the player chooses; this is the computer's choice
// (and the page's): the set whose half prices cover what is missing while giving up the least land value
// (ties: fewer lots). If nothing covers it, everything goes, and the Poorhouse follows.
function lotsToSell(g, p, short) {
  var lots = ownedBy(g, p).sort(function (a, b) { return g.spaces[a].price - g.spaces[b].price; });
  var half = function (i) { return Math.floor(g.spaces[i].price / 2); };
  if (g.rules.sale === 'cheapest') { var out = [], got = 0; while (got < short && lots.length) { var i = lots.shift(); out.push(i); got += half(i); } return out; }
  var total = lots.reduce(function (a, i) { return a + half(i); }, 0);
  if (total < short) return lots;
  // best[c] = the cheapest set raising at least c (c capped at short): a small knapsack over the player's lots
  var best = [{ cost: 0, set: [] }];
  for (var c = 1; c <= short; c++) best[c] = null;
  lots.forEach(function (i) {
    for (var c2 = short; c2 >= 0; c2--) { var from = best[c2]; if (!from) continue;
      var to = Math.min(short, c2 + half(i)), cand = { cost: from.cost + g.spaces[i].price, set: from.set.concat([i]) }, now = best[to];
      if (!now || cand.cost < now.cost || (cand.cost === now.cost && cand.set.length < now.set.length)) best[to] = cand; }
  });
  return best[short].set;
}
function toPoorhouse(g, p) {
  p.poor = true; p.pos = POORHOUSE; p.jail = false;
  ownedBy(g, p).forEach(function (i) { g.owner[i] = null; });
  say(g, p.name + ' cannot pay and goes to the Poorhouse.');
}

function passMotherEarth(g, p) {
  p.cash += WAGES; p.laps++; say(g, p.name + ' passes Mother Earth: +$' + WAGES + ' wages.');
  if (g.mode === 'prosperity' && g.treasury > 0) {
    var share = Math.floor(g.treasury * DIVIDEND_SHARE / g.players.length);
    if (share > 0) { g.players.forEach(function (q) { q.cash += share; }); g.treasury -= share * g.players.length;
      say(g, 'The Public Treasury pays every player $' + share + '.'); }
  }
}

// What the player on space i owes or may do. Returns a decision for buyables and luxuries.
function land(g, p) {
  var i = p.pos, s = g.spaces[i], o = g.owner[i], prosperity = g.mode === 'prosperity';
  if (s.kind === 'lot') {
    if (o === null) return { kind: 'buy', space: i, price: s.price };
    if (o === p.id) return null;
    var r = rentOf(s);
    if (!prosperity) { var sameSide = ownedBy(g, g.players[o]).filter(function (j) { return g.spaces[j].kind === 'lot' && side(j) === side(i); }).length;
      if (sameSide >= 3) r *= 2;
      pay(g, p, r, g.players[o]); say(g, p.name + ' pays $' + r + ' rent to ' + g.players[o].name + ' for ' + s.name + '.'); }
    else { pay(g, p, r, 'treasury'); say(g, p.name + ' pays $' + r + ' ground rent for ' + s.name + ' into the Public Treasury.'); }
    return null;
  }
  if (s.kind === 'railroad' || s.kind === 'franchise') {
    if (prosperity) { pay(g, p, PUBLIC_FEE, 'treasury'); say(g, p.name + ' pays a $' + PUBLIC_FEE + ' public fare at ' + s.name + '.'); return null; }
    if (o === null) return { kind: 'buy', space: i, price: s.price };
    if (o === p.id) return null;
    var owner = g.players[o], fee;
    if (s.kind === 'railroad') { var n = ownedBy(g, owner).filter(function (j) { return g.spaces[j].kind === 'railroad'; }).length; fee = 25 * n; }
    else fee = 4 * (g.dice[0] + g.dice[1]);
    pay(g, p, fee, owner); say(g, p.name + ' pays $' + fee + ' to ' + owner.name + ' at ' + s.name + '.'); return null;
  }
  if (s.kind === 'necessity') { pay(g, p, NECESSITY, 'treasury'); say(g, p.name + ' pays $' + NECESSITY + ' for ' + s.name + ' (an absolute necessity).'); return null; }
  if (s.kind === 'luxury') return { kind: 'luxury', space: i, price: LUXURY };
  if (s.kind === 'legacy') { p.cash += LEGACY; p.legacies++; say(g, p.name + ' receives a $' + LEGACY + ' legacy.'); return null; }
  if (i === 30) { p.pos = JAIL; p.jail = true; p.tries = 0; say(g, p.name + ' trespasses on the landlord\'s estate and goes to Jail.'); return null; }
  return null;
}

function decide(g, p, d, choice) {
  var s = g.spaces[d.space];
  if (d.kind === 'buy') {
    if (choice && p.cash >= d.price) { p.cash -= d.price; g.owner[d.space] = p.id;
      if (g.rules.price === 'treasury') g.treasury += d.price;
      say(g, p.name + ' buys ' + s.name + ' for $' + d.price + (g.rules.price === 'treasury' ? ', paid into the Public Treasury.' : '.'));
      if (g.mode === 'prosperity' && s.kind === 'lot') { g.players.forEach(function (q) { if (q !== p) q.cash += GIFT_ON_PURCHASE; });
        say(g, 'New land in use: every other player gains $' + GIFT_ON_PURCHASE + '.'); } }
  } else if (d.kind === 'luxury') {
    // Round 2 playtest: in Prosperity only cash counts, so a luxury is paid for and no ticket is taken
    // (the box holds 14 tickets; Prosperity games with equal starts used up to 22).
    if (choice && p.cash >= LUXURY) { p.cash -= LUXURY; g.treasury += LUXURY;
      if (g.mode === 'prosperity') say(g, p.name + ' pays $' + LUXURY + ' for a luxury (' + s.name + ') into the Public Treasury.');
      else { p.tickets++; say(g, p.name + ' buys a luxury ticket (' + s.name + ').'); } }
    else { p.skip = true; say(g, p.name + ' passes on ' + s.name + ' and loses the next turn.'); }
  }
  g.pending = null;
}

// The computer's choices (and the simulation's): the same for both rule sets, so only the rules differ.
// Oct 12 2026 playtest: one cushion for both ($60; it was $120 in the landlord's way and $60 in Prosperity).
function auto(g, p, d) {
  if (d.kind === 'buy') return p.cash >= d.price + 60;
  if (d.kind === 'luxury') return p.cash >= 220;
  if (d.kind === 'jail') return p.cash >= 200 || p.tries >= 2;
  return false;
}

function move(g, p) { var to = p.pos + g.dice[0] + g.dice[1];
  if (to >= 40) { to -= 40; passMotherEarth(g, p); }
  p.pos = to; }

// Jail, one rule for the page and the engine (Oct 12 2026 playtest): roll first; doubles free you;
// otherwise pay $50 and move with that roll if you chose to, or stay; the third failed roll pays.
// Returns true when the player moves this turn.
function jailTurn(g, p, payIfNoDoubles) {
  var d = g.dice;
  if (d[0] === d[1]) { p.jail = false; p.tries = 0; say(g, p.name + ' rolls doubles and leaves Jail.'); return true; }
  if (payIfNoDoubles || p.tries >= 2) {
    pay(g, p, JAIL_FINE, 'treasury'); p.jail = false; p.tries = 0;
    say(g, p.name + (payIfNoDoubles ? ' pays the $' + JAIL_FINE + ' fine.' : ' pays the fine after three tries.'));
    return !p.poor;
  }
  p.tries++; say(g, p.name + ' stays in Jail.'); return false;
}

function roll(g) { g.dice = [1 + Math.floor(g.rand() * 6), 1 + Math.floor(g.rand() * 6)]; return g.dice; }

// Prosperity's win, as one test. Oct 12 2026 playtest: with tied starts every player who started with the
// least must double (it was the first seat alone). Returns '' when the table has won, or what is still missing.
function lowestStarters(g) { var least = Math.min.apply(null, g.players.map(function (q) { return q.start; }));
  return g.players.filter(function (q) { return q.start === least; }); }
function prosperityShort(g) {
  var lowest = lowestStarters(g), rest = g.players.filter(function (q) { return lowest.indexOf(q) < 0; });
  if (typeof g.rules.win === 'function') return g.rules.win(g, lowest, rest) ? '' : 'the goal is not met';   // playtest.mjs tension: candidate rules
  var notDoubled = lowest.filter(function (q) { return q.poor || q.cash < 2 * q.start; });
  if (notDoubled.length) return notDoubled.map(function (q) { return q.name; }).join(' and ') + ' (who started with the least) ' + (notDoubled.length > 1 ? 'have' : 'has') + ' not doubled it';
  if (g.rules.win !== 'rise') return '';
  var below = rest.filter(function (q) { return q.poor || q.cash < q.start; });
  if (below.length) return below.map(function (q) { return q.name; }).join(' and ') + (below.length > 1 ? ' have' : ' has') + ' less than at the start';
  var top = rest.reduce(function (a, q) { return !a || q.cash > a.cash ? q : a; }, null);
  var behind = top ? lowest.filter(function (q) { return q.cash < top.cash; }) : [];
  if (behind.length) return behind.map(function (q) { return q.name; }).join(' and ') + ' (who started with the least) ' + (behind.length > 1 ? 'hold' : 'holds') + ' less than ' + top.name;
  return '';
}

function checkEnd(g) {
  if (g.over) return g.over;
  if (g.mode === 'prosperity') {
    var short = prosperityShort(g);
    if (!short) {
      var lowest = lowestStarters(g), names = lowest.map(function (q) { return q.name; }).join(' and '), many = lowest.length > 1;
      g.over = { kind: 'all', text: names + ', who started with the least, ' + (many ? 'have' : 'has') + ' doubled it'
        + (g.rules.win === 'rise' && lowest.length < g.players.length ? ' and ' + (many ? 'hold' : 'holds') + ' as much as anyone, and nobody has less than at the start' : '') + '. Everyone wins.' }; return g.over; }
    var a0 = active(g);
    var laps = g.rules.end !== 'rounds';
    if (typeof g.rules.end === 'function' ? g.rules.end(g, a0) || g.round > LANDLORD_LIMIT
        : laps ? (a0.length && a0.every(function (q) { return q.laps >= LAPS_TO_END; })) || g.round > LANDLORD_LIMIT : g.round > PROSPERITY_LIMIT) {
      g.over = { kind: 'none', text: (laps ? 'Everyone has been round five times' : 'Forty rounds') + ', and ' + short + '. The table loses this one: talk about why.' }; return g.over; }
    if (active(g).length === 0) { g.over = { kind: 'none', text: 'Everyone is in the Poorhouse.' }; return g.over; }
  } else {
    var a = active(g);
    var done = a.every(function (p) { return p.laps >= LAPS_TO_END; });
    if (a.length <= 1 || done || g.round > LANDLORD_LIMIT) {
      var best = g.players.slice().sort(function (x, y) { return worth(g, y) - worth(g, x); })[0];
      if (a.length === 1) best = a[0];
      g.over = { kind: 'one', winner: best.id, text: best.name + ' wins, worth $' + worth(g, best) + '. ' +
        (g.players.filter(function (p) { return p.poor; }).length ? g.players.filter(function (p) { return p.poor; }).map(function (p) { return p.name; }).join(', ') + ' in the Poorhouse.' : '') };
    }
  }
  return g.over;
}

function nextPlayer(g) {
  var n = g.players.length;
  for (var k = 0; k < n; k++) {
    g.turn = (g.turn + 1) % n; if (g.turn === 0) g.round++;
    var p = g.players[g.turn];
    if (p.poor && g.mode === 'prosperity' && p.cash >= 50) { p.poor = false; p.pos = 0; say(g, p.name + ' leaves the Poorhouse and starts again at Mother Earth.'); }
    if (!p.poor) return p;
  }
  return g.players[g.turn];
}

// One whole turn for the current player. `choose(decision)` answers buy/luxury/jail.
function playTurn(g, choose) {
  if (checkEnd(g)) return;
  var p = g.players[g.turn];
  if (p.poor) { nextPlayer(g); return; }
  if (p.skip) { p.skip = false; say(g, p.name + ' sits this turn out.'); nextPlayer(g); checkEnd(g); return; }
  roll(g);
  if (p.jail) {
    var doubles = g.dice[0] === g.dice[1];
    if (!jailTurn(g, p, !doubles && p.tries < 2 && choose({ kind: 'jail' }))) { nextPlayer(g); checkEnd(g); return; }
  }
  if (p.poor) { nextPlayer(g); checkEnd(g); return; }
  move(g, p);
  var dec = land(g, p);
  if (dec && !p.poor) decide(g, p, dec, choose(dec));
  nextPlayer(g); checkEnd(g);
}

function simulate(spaces, mode, starts, seed, rules) {
  var g = newGame(spaces, { mode: mode, starts: starts, seed: seed, rules: rules });
  var guard = 4000;
  while (!g.over && guard--) { var p = g.players[g.turn]; playTurn(g, function (d) { return auto(g, p, d); }); }
  return g;
}

var api = { lotsToSell: lotsToSell, say: say, move: move, jailTurn: jailTurn, newGame: newGame, playTurn: playTurn, roll: roll, land: land, decide: decide, auto: auto, nextPlayer: nextPlayer,
  checkEnd: checkEnd, prosperityShort: prosperityShort, simulate: simulate, worth: worth, ownedBy: ownedBy, rentOf: rentOf, pay: pay, passMotherEarth: passMotherEarth,
  consts: { WAGES: WAGES, NECESSITY: NECESSITY, LUXURY: LUXURY, LUXURY_WORTH: LUXURY_WORTH, LEGACY: LEGACY, JAIL_FINE: JAIL_FINE,
    PUBLIC_FEE: PUBLIC_FEE, GIFT_ON_PURCHASE: GIFT_ON_PURCHASE, DIVIDEND_SHARE: DIVIDEND_SHARE, LAPS_TO_END: LAPS_TO_END,
    PROSPERITY_LIMIT: PROSPERITY_LIMIT, DEFAULT_RULES: DEFAULT_RULES } };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LG = api;
})(this);
