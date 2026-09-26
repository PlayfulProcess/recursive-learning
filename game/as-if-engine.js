/* As-If, the engine (learning.recursive.eco/game/as-if.html).
 *
 * PORTED from recursive-iching/viewers/caster-engine.js, the Path Caster's engine (the Prime Rule:
 * copy the working file, change the data). Pure functions, no DOM, shared between the page (a
 * browser) and scripts/check-asif.mjs (node), which checks the cast's guarantees across many
 * seeded trials the way recursive-iching/scripts/determinism-check.js checks that a path arrives.
 *
 * What it reads: an As-If deck (default grammars/as-if-hot-potato-edition/grammar.json). The
 * deck's own "How to play" item defines the cast; this file only deals it:
 *   Structures     a character card plus the weather card, read at the Tell (no coin)
 *   Possibilities  one or two hypothesis cards, each turned upright or reversed by a coin
 *   Process        one action card, sized to the player (metadata.reach), picked after the flip
 * and the variant the deck keeps, "the random draw": a character and one to five hypotheses,
 * every card turned by the coin.
 * Never dealt: the rules, the Castings divider, the castings, the cases, and a parked card
 * (metadata.status "parked": it failed the deck's sizing test and went back to the characters).
 *
 * Randomness: every draw comes from one seeded generator (mulberry32), so a cast is a function
 * of its seed and its settings: the same seed deals the same cards the same way up. The page
 * picks the seed (crypto.getRandomValues); this file has no other source of chance. The coin is
 * 50/50. Nothing here forecasts anything. The forecast is the player's, recorded before the coin
 * is shown, "I don't know" is recorded as itself, and nothing is scored or staked.
 */
(function (root) {
  'use strict';

  const SIZE_WORDS = ['take', 'slack', 'ratchet', 'gift'];   // the deck's "size of a move"
  const FACES = ['upright', 'reversed'];
  const SPREADS = ['three', 'random'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── chance: one seeded generator ──────────────────────────────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {                       // Fisher-Yates, as the tarot games deal
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function coin(rng) { return rng() < 0.5 ? 'upright' : 'reversed'; }
  function other(face) { return face === 'upright' ? 'reversed' : face === 'reversed' ? 'upright' : face; }
  function isSeed(n) { return Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF; }

  // ── reading the deck ──────────────────────────────────────────────────
  function kw(it) { return (it.keywords || []).map(k => String(k).toLowerCase()); }
  function kindOf(it) {
    const k = kw(it), md = it.metadata || {}, cat = String(it.category || '').toLowerCase();
    if (k.includes('rules')) return 'rules';
    if (md.kind === 'divider' || k.includes('castings')) return 'divider';
    if (k.includes('casting') || k.includes('synthesis') || k.includes('ai-reading')) return 'casting';
    if (md.status === 'parked') return 'parked';
    if (cat === 'action' || k.includes('action')) return 'action';
    if (k.includes('weather') || cat === 'structure') return 'weather';
    if (cat === 'case' || k.includes('case')) return 'case';
    if (cat === 'hypothesis' || k.includes('hypothesis')) return 'hypothesis';
    if (k.includes('character')) return 'character';
    return 'other';
  }
  function classify(g) {
    const d = { name: (g && g.name) || '', grammar_type: (g && g.grammar_type) || '', url: (g && g._recursive_eco_url) || '',
      byId: {}, rules: null, characters: [], hypotheses: [], weather: [], cases: [], actions: [], parked: [],
      castings: [], dividers: [], other: [] };
    const bucket = { character: 'characters', hypothesis: 'hypotheses', weather: 'weather', case: 'cases', action: 'actions',
      parked: 'parked', casting: 'castings', divider: 'dividers', other: 'other' };
    for (const it of (g && g.items) || []) {
      if (!it || !it.id) continue;
      d.byId[it.id] = it;
      const k = kindOf(it);
      if (k === 'rules') { if (!d.rules) d.rules = it; else d.other.push(it); }
      else d[bucket[k]].push(it);
    }
    return d;
  }
  function playable(d) {               // why a deck cannot be cast, or '' when it can
    if (!d.characters.length) return 'it has no character cards';
    if (!d.hypotheses.length) return 'it has no hypothesis cards';
    if (!d.actions.length) return 'it has no action cards';
    return '';
  }
  function section(it, name) {         // a section by name, ignoring case
    const s = (it && it.sections) || {};
    if (s[name] != null) return String(s[name]);
    const want = String(name).toLowerCase();
    for (const k of Object.keys(s)) if (k.toLowerCase() === want) return String(s[k]);
    return '';
  }
  function faceText(it, face) { return section(it, face === 'reversed' ? 'Reversed' : 'Upright'); }
  function sizeWord(it) { const k = kw(it); return SIZE_WORDS.find(w => k.includes(w)) || ''; }
  function reachOf(it) { return String(((it && it.metadata) || {}).reach || 'anyone'); }
  function reaches(d) {                // the deck's own reach values, "anyone" first
    const out = ['anyone'];
    for (const a of d.actions) { const r = reachOf(a); if (!out.includes(r)) out.push(r); }
    return out;
  }
  function eligible(d, reach) {        // "sized to you": the cards for anyone, plus the ones for your reach
    return d.actions.filter(a => reachOf(a) === 'anyone' || reachOf(a) === reach);
  }

  // ── the cast ──────────────────────────────────────────────────────────
  function normOpts(o) {
    o = o || {};
    const seed = Number(o.seed);
    if (!isSeed(seed)) throw new Error('cast: seed must be an integer from 0 to 4294967295');
    const spread = SPREADS.includes(o.spread) ? o.spread : 'three';
    const p = o.possibilities == null ? 'coin' : String(o.possibilities);
    const possibilities = p === '1' ? 1 : p === '2' ? 2 : 'coin';
    const reach = String(o.reach || 'anyone');
    return { seed, spread, possibilities, reach };
  }
  /* Deals one cast. The order in which the generator is read is part of the contract (the same
     seed must deal the same cast in every browser): character, count, hypotheses, the
     character's coin (variant only), weather, the hypotheses' coins, the action card. */
  function cast(d, o) {
    const opt = normOpts(o);
    const why = playable(d);
    if (why) throw new Error('cast: this deck cannot be cast: ' + why);
    const rng = mulberry32(opt.seed);
    const character = shuffle(d.characters, rng)[0];
    let n;
    if (opt.spread === 'random') n = 1 + Math.floor(rng() * 5);                         // one to five
    else n = opt.possibilities === 'coin' ? (rng() < 0.5 ? 1 : 2) : opt.possibilities;  // one or two
    n = Math.min(n, d.hypotheses.length);
    const hyps = shuffle(d.hypotheses, rng).slice(0, n);
    const structures = [{ id: character.id, role: 'character', face: opt.spread === 'random' ? coin(rng) : null }];
    if (opt.spread === 'three' && d.weather.length) structures.push({ id: shuffle(d.weather, rng)[0].id, role: 'weather', face: null });
    const possibilities = hyps.map(h => ({ id: h.id, face: coin(rng) }));
    const pool = eligible(d, opt.reach);
    const process = { id: shuffle(pool, rng)[0].id };
    return { v: 1, seed: opt.seed, spread: opt.spread, possibilities_rule: opt.possibilities, reach: opt.reach,
      structures, possibilities, process };
  }
  function cardIds(c, stepId) {
    return c.structures.map(s => s.id).concat(c.possibilities.map(p => p.id), [stepId || c.process.id]);
  }

  // ── the forecast: the player's, never the page's ─────────────────────
  function normForecast(f) {
    if (!f || typeof f !== 'object') return null;
    if (f.dir === 'unknown') return { dir: 'unknown' };
    if (!FACES.includes(f.dir)) return null;
    const s = Number(f.sure);
    if (!Number.isInteger(s) || s < 0 || s > 100) return null;
    return { dir: f.dir, sure: s };
  }
  function forecastText(f) {
    const n = normForecast(f);
    if (!n) return 'not recorded';
    return n.dir === 'unknown' ? "I don't know" : n.dir + ', ' + n.sure + '%';
  }

  // ── small text helpers (pure; the page and the check share them) ─────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function inline(s) {                 // s is escaped already
    return s
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  }
  /* The deck's sections are a little Markdown: paragraphs, "- " lists, **bold**, *italic*,
     `code` and [links](https://...). Everything is escaped first; only http(s) links become <a>.
     An author's note to self ("**Working doc:** `docs/drafts/...`", a path in a private working
     repo) is not for players and leads nowhere, so a line that starts that way is not shown. */
  const NOTE_TO_SELF = /^\s*\*\*Working doc:\*\*/i;
  function mdToHtml(src) {
    const blocks = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(b => b.trim());
    return blocks.map(b => {
      const lines = b.split('\n').filter(l => l.trim() && !NOTE_TO_SELF.test(l));
      if (!lines.length) return '';
      if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
        return '<ul>' + lines.map(l => '<li>' + inline(esc(l.replace(/^\s*[-*]\s+/, ''))) + '</li>').join('') + '</ul>';
      }
      return '<p>' + lines.map(l => inline(esc(l))).join('<br>') + '</p>';
    }).join('');
  }
  /* A Wikimedia Commons original (upload.wikimedia.org/wikipedia/commons/x/xy/File.jpg, often a
     3000 px scan) as a sized rendition, the way the tarot viewers ask for one:
     commons.wikimedia.org/wiki/Special:FilePath/File.jpg?width=480. Only the file name is
     encoded; anything else comes back unchanged. */
  function thumb(url, width) {
    const m = /^https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/([^?#/]+)$/i.exec(String(url || ''));
    if (!m) return String(url || '');
    let name = m[1];
    try { name = decodeURIComponent(name); } catch (_) { /* keep it raw */ }
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=' + (width || 480);
  }
  function dateLabel(iso) {            // "2026-09-20" -> "Sep 20 2026", the way the deck dates its castings
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) throw new Error('dateLabel: expected YYYY-MM-DD, got ' + iso);
    return MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ' ' + m[1];
  }
  function uuidFor(seed, iso) {        // a stable id for a casting: the same cast on the same day, the same id
    let h = 2166136261 >>> 0;
    for (const ch of String(iso)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rng = mulberry32((seed ^ h) >>> 0);
    const b = [];
    for (let i = 0; i < 16; i++) b.push(Math.floor(rng() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const hex = b.map(x => x.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  // ── keeping a cast: the deck's Castings shape ─────────────────────────
  /* The cards of a cast, in order, with how each one is held:
     how = 'tell' (read at the Tell), 'upright' / 'reversed', 'down' (not turned, or the coin not
     shown) or 'step'. rec.turned = { structures, possibilities, step } says which positions the
     player turned before the cast ended; a position left out of it counts as turned. */
  function dealt(d, c, rec) {
    rec = rec || {};
    const shown = rec.shown || {};
    const turned = Object.assign({ structures: true, possibilities: true, step: true }, rec.turned || {});
    const out = [];
    for (const s of c.structures) {
      const item = d.byId[s.id];
      if (item) out.push({ item, pos: 'Structures', role: s.role, how: turned.structures ? (s.face || 'tell') : 'down' });
    }
    for (const p of c.possibilities) {
      const item = d.byId[p.id];
      if (item) out.push({ item, pos: 'Possibilities', role: 'hypothesis', how: turned.possibilities && shown[p.id] ? p.face : 'down' });
    }
    const step = d.byId[rec.stepId] || d.byId[c.process.id];
    if (step) out.push({ item: step, pos: 'Process', role: 'action', how: turned.step ? 'step' : 'down' });
    return out;
  }
  function howText(x) {
    if (x.how === 'tell') return 'read at the Tell';
    if (x.how === 'down') return x.role === 'hypothesis' ? 'face down, the coin not shown' : 'face down, not turned';
    if (x.how === 'step') return 'the step' + (sizeWord(x.item) ? ', ' + sizeWord(x.item) : '');
    return x.how;
  }
  /* One cast as one grammar item, the shape of the deck's own example casting: the cards in
     composite_of (ids within the deck), the keywords synthesis + human (a person wrote it), and
     sections in the deck's Markdown. rec = what the player did: { shown, forecasts, notes, stepId, turned };
     opts = { date: 'YYYY-MM-DD', author }. */
  function buildCasting(d, c, rec, opts) {
    rec = rec || {}; opts = opts || {};
    const notes = rec.notes || {};
    const forecasts = rec.forecasts || {};
    const cards = dealt(d, c, rec);
    const held = cards.filter(x => x.role !== 'action' && x.role !== 'weather');
    const title = held.map(x => x.item.name + ' ' + (x.how === 'tell' ? 'at the Tell' : x.how === 'down' ? 'face down' : x.how)).join(', ');
    const sections = {};
    sections.Cast = cards.map(x => '- **' + x.item.name + '** — **' + howText(x) + '** (' + x.pos + ')').join('\n') +
      '\n\n' + (c.spread === 'random'
        ? 'The random draw (the deck\'s variant): a character and ' + c.possibilities.length + ' hypothes' + (c.possibilities.length === 1 ? 'is' : 'es') + ', every card turned by the coin.'
        : 'The deck\'s cast: one Structure, ' + (c.possibilities.length === 1 ? 'one Possibility' : 'two Possibilities') + ', one Process.') +
      ' Cast number ' + c.seed + '.';
    sections.Forecast = c.possibilities.map(p => {
      const it = d.byId[p.id];
      return '- **' + (it ? it.name : p.id) + '** — **' + forecastText(forecasts[p.id]) + '**';
    }).join('\n') + '\n\nRecorded before the coin was shown. Nature votes later; scored for calibration only, and nothing is staked.';
    const clean = s => String(s || '').trim();
    if (clean(notes.asIf)) sections['As if true'] = clean(notes.asIf);
    if (clean(notes.other)) sections['From the other side'] = clean(notes.other);
    const step = cards.find(x => x.role === 'action' && x.how === 'step');
    if (step) {
      const move = section(step.item, 'The move');
      sections['The step'] = '**' + step.item.name + '**' + (sizeWord(step.item) ? ' (' + sizeWord(step.item) + ')' : '') + (move ? '. ' + move : '');
    }
    if (clean(notes.asym)) sections['The asymmetry'] = clean(notes.asym);
    if (clean(notes.synthesis)) sections.Synthesis = clean(notes.synthesis);
    if (clean(opts.author)) sections.Author = clean(opts.author);
    return {
      id: uuidFor(c.seed, opts.date),
      name: 'Casting — ' + dateLabel(opts.date) + ': ' + title,
      keywords: ['synthesis', 'human', 'casting'],
      metadata: { kind: 'note', cast_number: c.seed, spread: c.spread },
      composite_of: cards.map(x => x.item.id),
      sections,
    };
  }
  /* A whole grammar to download: the dealt cards, copied from the deck with their ids and
     credits, then the casting that is composed of them. Importable on its own; the last item is
     what a player proposes to the deck's Castings. */
  function buildExport(d, c, rec, opts) {
    opts = opts || {};
    const casting = buildCasting(d, c, rec, opts);
    const copies = dealt(d, c, rec).map((x, i) => Object.assign(JSON.parse(JSON.stringify(x.item)), { sort_order: i }));
    casting.sort_order = copies.length;
    return {
      name: 'My As-If casting — ' + dateLabel(opts.date),
      description: 'One cast of "' + d.name + '", played on ' + dateLabel(opts.date) + ' at learning.recursive.eco/game/as-if.html. ' +
        'The cards are the deck\'s own, with their credits; the forecast, the readings, the step and the synthesis are the player\'s. ' +
        'A casting, not a prediction: the draw was a coin, and nothing was staked.',
      cover_image_url: null,
      tags: ['as-if', 'casting'],
      grammar_type: d.grammar_type || 'tarot',
      items: copies.concat([casting]),
      creator_name: String(opts.author || '').trim(),
      creator_link: '',
      is_published: false,
    };
  }
  function buildMarkdown(d, c, rec, opts) {
    const casting = buildCasting(d, c, rec, opts);
    const L = ['# ' + casting.name, '',
      '*Cast with As-If at learning.recursive.eco, on the deck "' + d.name + '". A casting, not a prediction; nothing is staked.*', ''];
    for (const [k, v] of Object.entries(casting.sections)) L.push('## ' + k, '', v, '');
    return L.join('\n');
  }

  const AsIfEngine = {
    SIZE_WORDS, FACES, SPREADS,
    mulberry32, shuffle, coin, other, isSeed,
    kindOf, classify, playable, section, faceText, sizeWord, reachOf, reaches, eligible,
    normOpts, cast, cardIds,
    normForecast, forecastText,
    esc, mdToHtml, thumb, dateLabel, uuidFor,
    dealt, howText, buildCasting, buildExport, buildMarkdown,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AsIfEngine;
  else root.AsIfEngine = AsIfEngine;
})(typeof window !== 'undefined' ? window : globalThis);
