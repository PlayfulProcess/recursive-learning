/* app.js: the State of AI page. Reads data/*.json (written by scripts/, refreshed weekly) and
 * draws one "where are we" card per meter, the open-vs-closed meters side by side, the
 * doubling-time comparison, and a player panel. Vanilla JS; charts come from charts.js.
 *
 * Rules the page keeps: every number shows its source, licence, what we changed and how old its
 * data are; every card shows who is counted and who is not; meters that disagree are shown side
 * by side, never averaged; a fitted trend always carries its 90% band, and is only drawn past the
 * data when the reader turns on "if the trend continued", labelled as not a forecast, with the
 * wider range where single points could land. "Today" is read here, in the browser: the summary
 * build never reads the clock.
 */
(function () {
  'use strict';
  var C = window.SOACharts, h = C.h;
  var IDS = ['epoch_training_compute', 'epoch_training_cost', 'epoch_eci', 'epoch_benchmarks_internal',
    'epoch_ml_hardware', 'epoch_chip_sales', 'epoch_chip_owners', 'epoch_ai_companies',
    'metr_time_horizon', 'arena_leaderboard'];
  var D = {}, S = null, P = null;               // data files, summary, players
  var state = { player: null, ext: false };
  var cards = [];                               // {spec, chart, make}
  var aliasMap = {}, playerById = {};

  /* ---------------- small helpers ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function objs(d) {
    if (!d) return [];
    return d.rows.map(function (r) { var o = {}; d.columns.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  }
  function decYear(iso) {
    var p = String(iso).slice(0, 10).split('-').map(Number), y = p[0];
    var s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1), t = Date.UTC(y, (p[1] || 1) - 1, p[2] || 1);
    return y + (t - s + 43200000) / (e - s);
  }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function monthsSince(iso) { return (decYear(todayIso()) - decYear(iso)) * 12; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso, day) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return (day && p[2] ? (+p[2]) + ' ' : '') + MON[(+p[1] || 1) - 1] + ' ' + p[0];
  }
  // the summary marks "how long ago" as {{since:YYYY-MM-DD}}; the reader's clock fills it in
  function fillSince(text) {
    return String(text).replace(/\{\{since:(\d{4}-\d{2}-\d{2})\}\}/g, function (_, d) {
      var m = Math.round(monthsSince(d));
      return 'about ' + m + ' month' + (m === 1 ? '' : 's') + ' ago (' + fmtDate(d, true) + ')';
    });
  }
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function pow10(k) { return '10' + String(k).split('').map(function (c) { return SUP[c] || c; }).join(''); }
  function sci(v) {
    if (v == null) return '–';
    var k = Math.floor(Math.log10(v)), m = v / Math.pow(10, k);
    if (m >= 9.95) { m /= 10; k += 1; }
    return (m.toFixed(1) === '1.0' ? '' : m.toFixed(1) + ' × ') + pow10(k);
  }
  function compact(v, digits) {
    if (v == null) return '–';
    var a = Math.abs(v), d = digits == null ? 1 : digits;
    function t(x) { return (+x.toFixed(d)).toLocaleString('en-US'); }
    if (a >= 1e12) return t(v / 1e12) + 'T';
    if (a >= 1e9) return t(v / 1e9) + 'B';
    if (a >= 1e6) return t(v / 1e6) + 'M';
    if (a >= 1e4) return t(v / 1e3) + 'k';
    return (+v.toFixed(a < 10 ? 2 : 0)).toLocaleString('en-US');
  }
  function usd(v) { return v == null ? '–' : '$' + compact(v); }
  function pct(v, d) { return v == null ? '–' : (v * 100).toFixed(d == null ? 0 : d) + '%'; }
  function months(m) {
    if (m == null) return 'no doubling';
    if (m < 1) return (m * 30.4).toFixed(0) + ' days';
    return m < 24 ? m.toFixed(1) + ' months' : (m / 12).toFixed(1) + ' years';
  }
  function monthsRange(ci, v) {
    if (!ci || ci[0] == null) return 'range unknown';
    if (v != null && v >= 24 && ci[1] != null) return (ci[0] / 12).toFixed(1) + ' to ' + (ci[1] / 12).toFixed(1) + ' years';
    if (ci[1] == null) return months(ci[0]) + ' to no growth';
    if (ci[0] >= 24 && ci[1] >= 24) return (ci[0] / 12).toFixed(1) + ' to ' + (ci[1] / 12).toFixed(1) + ' years';
    if (ci[0] < 24 && ci[1] < 24) return ci[0].toFixed(1) + ' to ' + ci[1].toFixed(1) + ' months';
    return months(ci[0]) + ' to ' + months(ci[1]);
  }
  function monthsTick(m) { return m < 12 ? m + ' mo' : (m / 12) + ' yr'; }
  function f1(v) { return v == null ? '–' : (+v).toFixed(1); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  // Epoch writes several report kinds in one cell ('Company disclosure,Media report')
  function sourceTypes(s) { return s ? String(s).split(/\s*,\s*/).join(', ') : 'reported'; }
  // '3 of their 12 notable models since X have a Y', 'their one notable model since X has no Y'
  function countLine(k, n, noun, tail, what) {
    if (n === 1) return 'their one ' + noun + tail + ' ' + (k ? 'has ' : 'does not have ') + what;
    return (k ? k + ' of' : 'none of') + ' their ' + n + ' ' + noun + 's' + tail + ' ' + (k === 1 ? 'has ' : 'have ') + what;
  }
  function andList(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }
  // a legend key or other HTML swatch follows the theme by itself when it names the variable
  function cv(name) { return 'var(' + name + ')'; }
  // a quarter's midpoint date ('2026-05-15') as 'Q2 2026'
  function qLabel(iso) { var p = String(iso).split('-'); return 'Q' + (Math.floor((+p[1] - 1) / 3) + 1) + ' ' + p[0]; }
  function quarterEnd(iso) {
    var p = String(iso).split('-'), q = Math.floor((+p[1] - 1) / 3), m = q * 3 + 3;
    return p[0] + '-' + String(m).padStart(2, '0') + '-' + (m === 6 || m === 9 ? '30' : '31');
  }
  function spanText(t, part) {
    return t.period === 'quarter' ? qLabel(part.from) + ' to ' + qLabel(part.to) : fmtDate(part.from) + ' to ' + fmtDate(part.to);
  }
  function verdictText(ch) { return ch.verdict + (ch.borderline ? ' (borderline)' : ''); }
  // Epoch's link cells can hold several addresses, an address with no scheme, or plain text. Use
  // the first real web address; add https:// to a bare domain; otherwise draw no link at all.
  function firstUrl(s) {
    if (!s) return null;
    var toks = String(s).split(/[\s;|]+|,\s+/);
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i].replace(/^[<("'\[]+/, '').replace(/[>"'\].,]+$/, '');
      if ((t.match(/\)/g) || []).length > (t.match(/\(/g) || []).length) t = t.replace(/\)+$/, '');
      var k = t.search(/https?:\/\//i);
      if (k >= 0) {
        var u = t.slice(k), again = u.slice(8).search(/https?:\/\//i);
        if (again >= 0) u = u.slice(0, again + 8);   // two addresses run together
        return webUrl(u);
      }
      if (/^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}([/?#]\S*)?$/i.test(t)) return webUrl('https://' + t);
    }
    return null;
  }
  function webUrl(u) {
    try { var x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0 ? x.href : null; } catch (e) { return null; }
  }
  // model ids as the sources write them ('gpt-6-astra_max'), lightly tidied for reading
  function modelName(m) {
    if (!m) return m;
    var s = String(m), e = /^(.*?)_(minimal|low|medium|high|xhigh|max|none)$/.exec(s);
    return (e ? e[1] + ' (' + e[2] + ')' : s).replace(/_/g, ' ');
  }
  function link(href, text, parent, external) {
    var a = h('a', null, text, parent); a.href = href;
    if (external) { a.rel = 'noopener'; a.target = '_blank'; }
    return a;
  }
  function txt(parent, s) { parent.appendChild(document.createTextNode(s)); }
  function kindOfOpen(v) { return v === true ? 'open' : v === false ? 'closed' : 'unknown'; }
  function kindOfAccess(s) {
    if (!s) return 'unknown';
    if (/^open weights/i.test(s) || s === 'Open weights') return 'open';
    if (/closed|api access|hosted access|unreleased|limited/i.test(s)) return 'closed';
    return 'unknown';
  }
  function kindColor(k) { return css(k === 'open' ? '--open' : k === 'closed' ? '--closed' : '--unknown'); }
  var KIND_LABEL = { open: 'open weights', closed: 'closed weights', unknown: 'not stated' };
  // chip designers take the categorical colours from slot 3 on: slots 1 and 2 are the same blue and
  // orange as closed and open weights, and a reader who has learnt those should not meet them again
  // meaning Nvidia and Google
  var DESIGNERS = ['Nvidia', 'Google', 'AMD', 'Amazon', 'Huawei', 'Cambricon'];
  function dslotName(i) { return '--s' + (i + 3); }
  function dslot(i) { return css(dslotName(i)); }
  function newest(id) { return (S.sources[id] || {}).newest_data; }

  /* ---------------- players ---------------- */
  function initPlayers() {
    (P.players || []).forEach(function (p) {
      playerById[p.id] = p;
      aliasMap[p.id] = p.id;
      p.aliases.concat([p.name]).forEach(function (a) { aliasMap[a.toLowerCase()] = p.id; });
    });
  }
  // a model built by several organizations ('Google DeepMind, Google') counts for each player named
  function playersOf(org) {
    if (!org) return [];
    var out = [];
    String(org).split(',').forEach(function (part) {
      var id = aliasMap[part.trim().toLowerCase()];
      if (id && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }
  function playerOf(org) { return playersOf(org)[0] || null; }
  function isMine(org, id) { return playersOf(org).indexOf(id) >= 0; }
  function playerName(id) { return id && playerById[id] ? playerById[id].name : null; }
  // an organization as a source writes it ('moonshot', 'anthropic'), in the form people read
  function orgName(o) {
    if (!o) return o;
    var p = playerById[playerOf(o)];
    if (p && o === o.toLowerCase()) return p.aliases[0];
    return o === o.toLowerCase() ? o.charAt(0).toUpperCase() + o.slice(1) : o;
  }
  function markClass(d) {
    var c = '';
    if (state.player) c = (d.players ? d.players.indexOf(state.player) >= 0 : d.player === state.player) ? 'hl' : 'dim';
    if (d.pinned) c += ' pin';
    return c;
  }

  /* ---------------- trends from summary ---------------- */
  function trend(id) { return (S.trends || []).filter(function (t) { return t.id === id; })[0]; }
  function hasExt(t) { return !!(t && t.status === 'ok' && t.if_trend_continued && t.if_trend_continued.length); }
  // bands go under the dots; the fitted lines go over them, so the dots' surface rings cannot cut a
  // solid line into what looks like the dashed "if the trend continued" stretch
  function trendParts(t) {
    var under = [], over = [];
    if (!t || t.status !== 'ok') return { under: under, over: over };
    under.push({ type: 'band', data: t.band.map(function (b) { return [b[0], b[1], b[3]]; }), logged: true });
    over.push({ type: 'line', data: t.band.map(function (b) { return [b[0], b[2]]; }), logged: true, cls: 'trend-line' });
    if (state.ext && hasExt(t)) {
      var e = t.if_trend_continued, last = t.band[t.band.length - 1];
      // the wide band: where a single new point could land (the line's own range plus the scatter of points)
      if (e[0].length >= 6) under.push({ type: 'band', data: e.map(function (b) { return [b[0], b[4], b[5]]; }), logged: true, cls: 'trend-pred-band' });
      var j = [last].concat(e);
      under.push({ type: 'band', data: j.map(function (b) { return [b[0], b[1], b[3]]; }), logged: true, cls: 'trend-ext-band' });
      over.push({ type: 'line', data: j.map(function (b) { return [b[0], b[2]]; }), logged: true, cls: 'trend-ext',
        label: 'if the trend continued: not a forecast' });
    }
    return { under: under, over: over };
  }
  // a log axis from the decade below the smallest value to the decade above the largest, and far
  // enough to hold a trend's 'if it continued' stretch (with its point range) when that is on
  function logRange(values, trends) {
    var v = values.filter(function (x) { return x > 0; });
    var lo = Math.floor(Math.log10(Math.min.apply(null, v))), hi = Math.ceil(Math.log10(Math.max.apply(null, v)));
    (trends || []).forEach(function (t) {
      if (state.ext && hasExt(t)) t.if_trend_continued.forEach(function (b) { hi = Math.max(hi, Math.ceil(b.length >= 6 ? b[5] : b[3])); });
    });
    return [Math.pow(10, lo), Math.pow(10, hi)];
  }
  function trendXMax(t, xmax) {
    if (state.ext && hasExt(t)) return Math.max(xmax, t.if_trend_continued[t.if_trend_continued.length - 1][0]);
    return xmax;
  }
  function fitSentence(t, what) {
    if (!t) return '';
    if (t.status !== 'ok') return (what || t.label) + ': too few points to fit a trend (' + t.n + ').';
    var w = t.whole;
    var s = (what || t.label) + ', ' + spanText(t, w) + ' (' + w.n + ' points): doubles every ' +
      months(w.doubling_months) + ' (90% range of the line: ' + monthsRange(w.doubling_ci, w.doubling_months) + '), about ' + w.x_per_year + '× a year.';
    if (w.scatter_x90) s += ' Nine points in ten sit within about ' + (w.scatter_x90 < 10 ? w.scatter_x90.toFixed(1) : Math.round(w.scatter_x90)) + ' times of the line, above or below.';
    var ch = t.change || {};
    if (ch.verdict === 'too few points') s += ' Pace lately: too few points on one side of the last 24 months to tell.';
    else if (t.recent && t.before && ch.recent) {
      s += ' Last 24 months of data (' + spanText(t, ch.recent) + ', ' + ch.recent.n + ' points): ' + months(t.recent.doubling_months) +
        ' (' + monthsRange(t.recent.doubling_ci, t.recent.doubling_months) + '); the years before (' + spanText(t, ch.before) + ', ' + ch.before.n +
        ' points): ' + months(t.before.doubling_months) + ' (' + monthsRange(t.before.doubling_ci, t.before.doubling_months) + '). Pace lately: ' + verdictText(ch) + '.';
      if (ch.borderline) s += ' A borderline call: ' + ch.borderline + '.';
    }
    if (/blocks/.test(w.resampling || '')) s += ' Its ranges resample runs of neighbouring points together, since they move together.';
    var stop = t.data_stop ? (t.period === 'quarter' ? 'with the quarter to ' + fmtDate(quarterEnd(t.data_stop + '-15'), true) : 'in ' + fmtDate(t.data_stop)) : '';
    if (t.scope === 'company') s += ' One company: no "if the trend continued" stretch is drawn.';
    else if (t.data_stop && !hasExt(t)) s += ' The data stop ' + stop + ', so no "if the trend continued" stretch is drawn.';
    else if (t.data_stop) s += ' The data stop ' + stop + '.';
    return s;
  }

  /* ---------------- card scaffolding ---------------- */
  function card(parent, id, title, question, opts) {
    opts = opts || {};
    var c = h('article', 'card' + (opts.cls ? ' ' + opts.cls : ''), null, parent);
    c.id = id;
    h('h3', null, title, c);
    if (question) h('p', 'q', question, c);
    return c;
  }
  function nowLine(parent, value, who) {
    var n = h('div', 'now', null, parent);
    h('span', 'v', value, n);
    if (who) h('span', 'who', who, n);
    return n;
  }
  function coverage(parent, d, extra) {
    var box = h('div', 'cov', null, parent);
    var p1 = h('p', null, null, box); h('b', null, 'Who is counted. ', p1); txt(p1, d.coverage.summary + ' ' + (d.coverage.counted || ''));
    var p2 = h('p', null, null, box); h('b', null, 'Who is not. ', p2); txt(p2, d.coverage.not_counted || '');
    if (extra) { var p3 = h('p', null, null, box); txt(p3, extra); }
    return box;
  }
  // the page link goes to the licensed item itself (for Arena, the Hugging Face dataset, not the site)
  function sourceHref(d) { return d.page || d.url; }
  function sourceLine(parent, d, id) {
    var p = h('p', 'src', null, parent), src = S.sources[id] || {};
    txt(p, 'Source: ');
    link(sourceHref(d), d.source, p, true);
    if (d.authors) txt(p, ', by ' + d.authors);
    if (d.site) { txt(p, ' (the arena\'s own site: '); link(d.site, d.site.replace(/^https?:\/\//, '').replace(/\/.*$/, ''), p, true); txt(p, ', not under this licence)'); }
    txt(p, ' · licence: ');
    link(d.licence_url || d.page, d.licence, p, true);
    txt(p, ' · newest data: ' + fmtDate(src.newest_data, true) + (src.newest_note ? ' (' + src.newest_note + ')' : '') +
      ' · these numbers fetched ' + fmtDate(d.fetched_at, true) + ' · ');
    link('data/' + id + '.json', 'data file', p);
    txt(p, ' · ');
    link('scripts/fetch_' + id + '.py', 'how it is fetched', p);
    // what we changed, in full and reachable by touch and keyboard (CC BY asks us to say)
    var det = h('details', 'changes', null, parent);
    h('summary', null, d.redistribution === 'link-only' ? 'What we quote, and what we leave on their page' : 'What we changed from the source', det);
    h('p', null, d.changes || '', det);
    if (d.citation) h('p', null, 'Cite as: ' + d.citation, det);
    return p;
  }
  // keys name CSS variables (cv('--closed')), so they follow a theme change without a redraw
  function legend(parent, items) {
    var ul = h('ul', 'legend', null, parent);
    items.forEach(function (it) {
      var li = h('li', null, null, ul), k = h('span', 'key ' + (it.shape || ''), null, li);
      if (it.color) { if (it.shape === 'hollow' || it.shape === 'ring') k.style.borderColor = it.color; else k.style.background = it.color; }
      if (it.faded) k.style.opacity = '0.45';
      txt(li, it.label);
    });
    return ul;
  }
  function table(parent, columns, rows, caption) {
    var det = h('details', 'table', null, parent);
    h('summary', null, 'Table' + (caption ? ': ' + caption : '') + ' (' + rows.length + ' rows)', det);
    var wrap = h('div', 'tablewrap', null, det), t = h('table', null, null, wrap);
    var tr = h('tr', null, null, h('thead', null, null, t));
    columns.forEach(function (c) { h('th', c.num ? 'n' : '', c.label, tr); });
    var tb = h('tbody', null, null, t);
    det.addEventListener('toggle', function () {        // build rows on first open only
      if (!det.open || tb.childNodes.length) return;
      rows.forEach(function (r) {
        var row = h('tr', null, null, tb);
        columns.forEach(function (c) {
          var v = c.get(r), td = h('td', c.num ? 'n' : '', null, row);
          if (c.href && c.href(r)) link(c.href(r), v == null ? '' : String(v), td, true);
          else td.textContent = v == null ? '' : String(v);
        });
      });
    });
    return det;
  }
  function pinBox(parent) {
    var b = h('div', 'pin', null, parent); b.hidden = true; b.setAttribute('aria-live', 'polite');
    return b;
  }
  function showPin(box, d, lines, source) {
    box.textContent = '';
    box.hidden = false;
    var x = h('button', 'x', '×', box); x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', function () { box.hidden = true; });
    h('div', 'pv', lines[0], box);
    lines.slice(1).forEach(function (s) { h('div', 'muted', s, box); });
    var act = h('div', 'actions', null, box);
    (d.players || (d.player ? [d.player] : [])).forEach(function (pid) {
      var b = h('button', null, 'Place ' + playerName(pid) + ' on every meter', act);
      b.addEventListener('click', function () { setPlayer(pid, true); });
    });
    if (source && source.href) link(source.href, source.text, act, true);
  }
  function mount(host, kind, make) {
    var c = { make: make, kind: kind };
    c.spec = make();
    c.chart = C[kind](host, c.spec);
    cards.push(c);
    return c;
  }
  function refreshAll() {
    cards.forEach(function (c) {
      var s = c.make();
      Object.keys(c.spec).forEach(function (k) { delete c.spec[k]; });
      Object.assign(c.spec, s);
      c.chart.redraw();
    });
    renderPlayerPanel();
  }

  /* ---------------- 1. where the meters disagree ---------------- */
  var METER_ANCHOR = {
    epoch_training_compute: 'm-compute', epoch_training_cost: 'm-cost', epoch_eci: 'm-eci',
    epoch_benchmarks_internal: 'm-tests', epoch_ml_hardware: 'm-hardware', epoch_chip_sales: 'm-shipped',
    epoch_chip_owners: 'm-owners', epoch_ai_companies: 'm-revenue', metr_time_horizon: 'm-metr',
    arena_leaderboard: 'ovc', usage: 'ovc-use', compute_frontier: 'm-compute', compute_notable: 'm-compute',
    compute_frontier_no_spec: 'm-compute', cost_frontier: 'm-cost', cost_frontier_no_spec: 'm-cost',
    hw_datacentre: 'm-hardware', hw_all: 'm-hardware',
    shipped_nvidia: 'm-shipped', shipped_all: 'm-shipped', revenue_openai: 'm-revenue', revenue_anthropic: 'm-revenue'
  };
  var METER_NAME = {
    epoch_training_compute: 'training compute', epoch_training_cost: 'training cost', epoch_eci: 'capability index',
    epoch_benchmarks_internal: 'hard tests', epoch_ml_hardware: 'chips per dollar', epoch_chip_sales: 'chips shipped',
    epoch_chip_owners: 'who holds compute', epoch_ai_companies: 'revenue', metr_time_horizon: 'METR',
    arena_leaderboard: 'Arena votes', usage: 'use', compute_frontier: 'training compute', compute_notable: 'training compute',
    cost_frontier: 'training cost', hw_datacentre: 'chips per dollar', shipped_nvidia: 'chips shipped', shipped_all: 'chips shipped',
    revenue_openai: 'revenue', revenue_anthropic: 'revenue'
  };
  var SHORT = {
    epoch_training_compute: 'compute estimates', epoch_training_cost: 'training cost', epoch_eci: 'capability index',
    epoch_benchmarks_internal: 'hard tests', epoch_ml_hardware: 'chip prices', epoch_chip_sales: 'chips shipped',
    epoch_chip_owners: 'chip holders', epoch_ai_companies: 'revenue', metr_time_horizon: 'METR', arena_leaderboard: 'Arena'
  };
  function renderDisagree() {
    var ul = $('#disagree'); ul.textContent = '';
    (S.sentences || []).forEach(function (s) {
      var li = h('li', null, null, ul);
      h('p', 'lead', fillSince(s.text), li);
      if (s.items && s.items.length) {
        var sub = h('ul', 'items', null, li);
        s.items.forEach(function (it) { h('li', null, fillSince(it), sub); });
      }
      var m = h('span', 'meters', 'Meters: ', li), seen = {};
      s.meters.forEach(function (id) {
        var name = METER_NAME[id] || (trend(id) || {}).label || id, a = METER_ANCHOR[id];
        if (seen[name]) return; seen[name] = 1;
        if (Object.keys(seen).length > 1) txt(m, ' · ');
        if (a) link('#' + a, name, m); else txt(m, name);
      });
    });
    var asof = $('#asof'); asof.textContent = '';
    txt(asof, 'Each sentence names the dates its data reach, and they differ by source. Newest data: ');
    IDS.forEach(function (id, i) {
      var src = S.sources[id]; if (!src || !src.newest_data) return;
      if (i) txt(asof, ' · ');
      var a = link('#' + (METER_ANCHOR[id] || ''), SHORT[id], asof);
      a.className = 'quiet';
      txt(asof, ' ' + (id === 'epoch_chip_sales' ? 'quarter to ' : '') + fmtDate(src.newest_data) +
        (id === 'epoch_training_cost' && src.frontier_date ? ' (biggest models ' + fmtDate(src.frontier_date) + ')' : ''));
    });
    txt(asof, '. Every source is re-checked weekly, and new numbers arrive through a pull request that a person reads before it is merged.');
  }

  /* ---------------- 2. how fast, by each meter ---------------- */
  function renderSpeed() {
    var host = $('#speed-chart');
    var industry = [], company = [], quoted = [];
    var PART = { whole: 'Whole period', before: 'The years before the last 24 months', recent: 'Last 24 months of data' };
    (S.trends || []).forEach(function (t) {
      if (t.variant_of) return;
      var list = t.scope === 'company' ? company : industry;
      if (t.status !== 'ok') { list.push({ label: t.label, marks: [], empty: 'too few points to fit', t: t, sort: 999 }); return; }
      var ch = t.change || {};
      var marks = [{ v: t.whole.doubling_months, lo: t.whole.doubling_ci[0], hi: t.whole.doubling_ci[1], kind: 'whole', t: t }];
      // the bend is judged between the years before and the last 24 months, so those two are drawn,
      // each on its own line; the whole period (which contains both) sits above them
      if (ch.verdict !== 'too few points' && t.before && t.recent) {
        marks.push({ v: t.before.doubling_months, lo: t.before.doubling_ci[0], hi: t.before.doubling_ci[1], kind: 'before', shape: 'square', t: t });
        marks.push({ v: t.recent.doubling_months, lo: t.recent.doubling_ci[0], hi: t.recent.doubling_ci[1], kind: 'recent', hollow: true, t: t });
      }
      var lately = 'lately: ' + (ch.verdict === 'too few points' ? 'too few points to judge' : ch.verdict.replace(/ lately$/, '') + (ch.borderline ? ' (borderline)' : ''));
      list.push({ label: t.label, sub: spanText(t, t.whole) + ' · ' + lately, marks: marks, t: t, sort: t.whole.doubling_months || 999 });
    });
    (S.metr_quoted || []).forEach(function (q) {
      quoted.push({ label: q.label, sub: 'METR\'s own fit and range', marks: [{ v: q.doubling_months, lo: q.doubling_ci[0], hi: q.doubling_ci[1], kind: 'quoted', q: q }], sort: q.doubling_months, anchor: 'm-metr' });
    });
    var eh = S.epoch_hw_trend;
    if (eh) quoted.push({ label: eh.label, sub: 'Epoch\'s own fit and range, ' + fmtDate(eh.as_of), marks: [{ v: eh.doubling_months, lo: eh.doubling_ci[0], hi: eh.doubling_ci[1], kind: 'quoted', q: { note: eh.note, range_note: 'Epoch\'s own range, from its own method: not our 90% bootstrap.' } }], sort: eh.doubling_months, anchor: 'm-hardware' });
    function bySort(a, b) { return (a.sort || 999) - (b.sort || 999); }
    industry.sort(bySort); company.sort(bySort); quoted.sort(bySort);
    var rows = [{ header: true, label: 'Across the industry (our fits)' }].concat(industry)
      .concat(company.length ? [{ header: true, label: 'Single companies (not the industry)' }].concat(company) : [])
      .concat(quoted.length ? [{ header: true, label: 'Published by the sources (their fits)' }].concat(quoted) : []);
    mount(host, 'intervalChart', function () {
      rows.forEach(function (r) { (r.marks || []).forEach(function (m) { m.color = m.kind === 'quoted' ? css('--ink-3') : css('--neutral'); }); });
      return {
        rows: rows, aria: 'Months to double, by meter, with ranges', title: 'months to double (log scale): further left is faster',
        x: { min: 2, max: 150, ticks: [3, 6, 12, 24, 48, 96], fmt: monthsTick, fmtOut: months },
        tooltip: function (d) {
          var m = d.mark, lines = [];
          if (m.kind === 'quoted') {
            lines.push(m.q.range_note || 'The source\'s own range.');
            if (m.q.note) lines.push(m.q.note);
          } else {
            var src = m.t[m.kind];
            lines.push(PART[m.kind] + ': ' + spanText(m.t, src) + ', ' + src.n + ' points');
            lines.push('About ' + src.x_per_year + '× a year');
            var ch = m.t.change;
            lines.push('Pace lately: ' + (ch.verdict === 'too few points' ? 'too few points on one side of the last 24 months to judge' : verdictText(ch)));
            if (ch.borderline) lines.push('A borderline call: ' + ch.borderline + '.');
          }
          return { value: months(m.v) + ' to double', lines: [d.row.label, (m.kind === 'quoted' ? 'Their range: ' : '90% range of the line: ') + monthsRange([m.lo, m.hi], m.v)].concat(lines) };
        },
        onPick: function (d) { var a = d.row.t ? METER_ANCHOR[d.row.t.id] : d.row.anchor; if (a) location.hash = a; }
      };
    });
    legend(host.parentNode, [{ label: 'whole period', color: cv('--neutral') }, { label: 'the years before the last 24 months', color: cv('--neutral'), shape: 'sq' },
      { label: 'last 24 months of data', color: cv('--neutral'), shape: 'hollow' }, { label: 'the source\'s own fit and range', color: cv('--ink-3') },
      { label: 'arrow: the range runs off the scale', shape: 'arrow' }]);
  }

  /* ---------------- 3. open vs closed, side by side ---------------- */
  function renderOpenClosed() {
    var ovc = S.open_vs_closed, tiles = $('#ovc-tiles'); tiles.textContent = '';
    // capability
    var e = ovc.eci, n = e.now, t1 = h('div', 'tile', null, tiles);
    h('p', 'tq', 'How capable (Epoch index)', t1);
    if (n.lag_months != null) {
      h('p', 'tv', 'About ' + Math.round(n.lag_months) + ' months behind at release', t1);
      var r = n.lag_range_months || [], hr = e.history_range_months;
      h('p', 'td', 'The best open-weights model, ' + n.open_model + ' (' + n.open_org + '), came out ' + fmtDate(n.open_date, true) + ' scoring ' + f1(n.open_eci) +
        '. A closed model, ' + n.closed_model + ', had first reached that on ' + fmtDate(n.closed_date, true) + '.' +
        (r[0] != null && r[1] != null ? ' Range ' + Math.round(r[0]) + ' to ' + Math.round(r[1]) + ' months, from the uncertainty in ' + n.open_model + '\'s own score only.' : '') +
        ' No open model has beaten it since, so as of today closed models reached that level ' + fillSince('{{since:' + n.closed_date + '}}') + '.' +
        ' It is ' + e.gap_points + ' points below the best closed model (' + e.best_closed.model + ', ' + fmtDate(e.best_closed.date, true) + ').' +
        (hr ? ' At each new open record since ' + fmtDate(e.history_range_from) + ', this gap has ranged from ' + Math.round(hr[0]) + ' to ' + Math.round(hr[1]) +
          ' months, so any single number is a snapshot' + (e.early_note ? ' (earlier records are floors: see the chart below)' : '') + '.' : ''), t1);
    } else {
      h('p', 'tv', 'Open is ahead', t1);
      h('p', 'td', n.status || '', t1);
    }
    // preference
    var a = ovc.arena, t2 = h('div', 'tile', null, tiles);
    h('p', 'tq', 'How liked (Arena votes)', t2);
    if (a && a.configs && (a.configs.text_style_control || a.configs.text)) {
      var cfg = a.configs.text_style_control || a.configs.text, lt = cfg.latest, raw = a.configs.text && a.configs.text_style_control ? a.configs.text.latest : null;
      h('p', 'tv', 'Best closed wins ' + pct(lt.win_prob) + ' of votes with a winner', t2);
      var td2 = h('p', 'td', 'Best closed, ' + modelName(lt.closed_model) + ' (' + orgName(lt.closed_org) + '), against best open, ' + modelName(lt.open_model) + ' (' + orgName(lt.open_org) + ', ' +
        lt.open_licence + '): ' + Math.round(lt.gap) + ' rating points apart, ' + cfg.label + ', ' + fmtDate(lt.date, true) +
        (lt.win_prob_range ? '. Rough range ' + pct(lt.win_prob_range[0]) + ' to ' + pct(lt.win_prob_range[1]) : '') +
        (raw ? '; with raw votes, ' + pct(raw.win_prob) + (raw.win_prob_range ? ' (' + pct(raw.win_prob_range[0]) + ' to ' + pct(raw.win_prob_range[1]) + ')' : '') : '') +
        '. 50% would be a coin flip. ' + (a.range_note || '') + ' A known criticism, that providers test private versions before release, is set out in ', t2);
      link('https://arxiv.org/abs/2504.20879', 'The Leaderboard Illusion (2025)', td2, true);
      txt(td2, '.');
    } else {
      h('p', 'tv', 'Not available this week', t2);
      h('p', 'td', 'The Arena fetch did not complete; the last good numbers will return with the next refresh.', t2);
    }
    // releases
    var rs = ovc.release_share, full = rs.series.filter(function (s) { return s[0] < rs.partial_year && s[4] != null; }), last = full[full.length - 1],
      cur = rs.series.filter(function (s) { return s[0] === rs.partial_year; })[0], t3 = h('div', 'tile', null, tiles);
    h('p', 'tq', 'How many (notable releases)', t3);
    h('p', 'tv', pct(last[4]) + ' open in ' + last[0], t3);
    // every share here is of the models with a stated open or closed status, and says so
    h('p', 'td', 'Of the notable models released in ' + last[0] + ', ' + last[1] + ' of the ' + (last[1] + last[2]) + ' with a stated status had downloadable weights, under any licence' +
      (last[3] ? '; ' + last[3] + ' more have no stated status' : ' (every ' + last[0] + ' model has one)') +
      (cur ? '. So far in ' + cur[0] + ' (to ' + fmtDate(rs.newest, true) + '): ' + cur[1] + ' of the ' + (cur[1] + cur[2]) + ' with a stated status, ' + pct(cur[4]) +
        (cur[3] ? ', and ' + cur[3] + ' more have none' : '') : '') + '. Each model counts once, whatever its size or how much it is used. ' + (rs.late_note || ''), t3);
    // use: link-only views that exist, with their coverage
    var t4 = h('div', 'tile gap', null, tiles); t4.id = 'ovc-use';
    h('p', 'tq', 'How much used (tokens served)', t4);
    h('p', 'tv', 'No open, official measure', t4);
    h('p', 'td', 'No official, openly licensed source counts how much open and closed models are used across the industry. Public views that exist, linked here and not copied (OpenRouter\'s terms forbid copying its data):', t4);
    var ul = h('ul', 'uselinks', null, t4);
    link('https://openrouter.ai/rankings', 'OpenRouter rankings', h('li', null, null, ul), true);
    link('https://openrouter.ai/state-of-ai', 'OpenRouter, State of AI 2025: a 100-trillion-token usage study', h('li', null, null, ul), true);
    h('p', 'td', 'Coverage: one router\'s paid API traffic, leaning towards developers and cheaper models. It misses the companies\' own apps (ChatGPT, Claude, Gemini), where much closed-model use happens.', t4);

    // charts: ECI lag history, Arena chance over time, release share by year
    var hist = e.history.filter(function (x) { return x.lag_months != null; });
    var counted = hist.filter(function (x) { return !x.early; });
    mount($('#ovc-lag'), 'xyChart', function () {
      var col = css('--neutral');
      return {
        height: 200, aria: 'Months the best open model trailed the closed frontier, at each new open record',
        x: { min: decYear(hist[0].open_date) - 0.1, max: decYear(hist[hist.length - 1].open_date) + 0.1 },
        y: { min: Math.min(0, Math.floor(Math.min.apply(null, hist.map(function (x) { return x.lag_range_months[0] != null ? x.lag_range_months[0] : x.lag_months; })) / 3) * 3),
          max: Math.max(12, Math.ceil(Math.max.apply(null, hist.map(function (x) { return x.lag_range_months[1] || x.lag_months; })) / 3) * 3), fmt: function (v) { return v + ' mo'; }, title: 'months behind at release (below 0: open ahead)' },
        layers: [
          { type: 'whiskers', data: hist.map(function (x) { return { x: decYear(x.open_date), lo: x.lag_range_months[0], hi: x.lag_range_months[1], color: col, players: playersOf(x.open_org) }; }) },
          { type: 'line', data: counted.map(function (x) { return [decYear(x.open_date), x.lag_months]; }), color: col },
          { type: 'points', data: hist.map(function (x) { return { x: decYear(x.open_date), y: x.lag_months, color: css('--open'), r: 4, hollow: !!x.early, row: x, players: playersOf(x.open_org) }; }) }
        ],
        markClass: markClass,
        tooltip: function (d) {
          var x = d.row;
          return { value: (x.early ? 'At least ' : '') + x.lag_months + ' months behind at release', lines: [x.open_model + ' (' + x.open_org + ', ' + fmtDate(x.open_date, true) + '), index ' + x.open_eci,
            'Closed first reached it: ' + x.closed_model + ', ' + fmtDate(x.closed_date, true), 'Range from the open model\'s own score: ' + x.lag_range_months[0] + ' to ' + x.lag_range_months[1] + ' months']
            .concat(x.early ? ['A floor: the index lists no closed model before ' + e.first_closed.model + ', so the lag could be longer.'] : []) };
        },
        onPick: function (d) { if (d.players && d.players[0]) setPlayer(d.players[0], true); }
      };
    });
    legend($('#ovc-lag').parentNode, [{ label: 'new open record', color: cv('--open') }, { label: 'hollow: a floor, from the index\'s first months', color: cv('--open'), shape: 'hollow' },
      { label: 'range from the open model\'s own score', color: cv('--neutral'), shape: 'line' }]);
    if (e.early_note) h('p', 'fitline muted', e.early_note, $('#ovc-lag').parentNode);
    sourceLine($('#ovc-lag').parentNode, D.epoch_eci, 'epoch_eci');
    table($('#ovc-lag').parentNode, [{ label: 'Open record', get: function (x) { return x.open_model + ' (' + x.open_org + ')'; } }, { label: 'Released', get: function (x) { return x.open_date; } },
      { label: 'Index', num: 1, get: function (x) { return x.open_eci; } }, { label: 'Closed first there', get: function (x) { return x.closed_model + ', ' + x.closed_date; } },
      { label: 'Months behind', num: 1, get: function (x) { return (x.early ? 'at least ' : '') + x.lag_months; } }, { label: 'Range', num: 1, get: function (x) { return x.lag_range_months[0] + ' to ' + x.lag_range_months[1]; } }],
      hist.slice().reverse(), 'each new open record, newest first');
    if (a && a.configs && Object.keys(a.configs).length) {
      mount($('#ovc-arena'), 'xyChart', function () {
        var cfgs = ['text', 'text_style_control'].filter(function (k) { return a.configs[k]; });
        var colors = { text: css('--neutral-soft'), text_style_control: css('--ink') };
        var all = [], layers = [];
        cfgs.forEach(function (k) {
          var s = a.configs[k].series;
          var band = s.filter(function (p) { return p[2] != null; }).map(function (p) {
            var t = decYear(p[0]); return [t, 1 / (1 + Math.pow(10, (p[1] - p[2]) / -400)) * 100, 1 / (1 + Math.pow(10, (p[1] + p[2]) / -400)) * 100]; });
          if (k === 'text_style_control' && band.length) layers.push({ type: 'band', data: band, cls: 'trend-band' });
          layers.push({ type: 'line', data: s.map(function (p) { return [decYear(p[0]), p[3] * 100]; }), color: colors[k] });
          s.forEach(function (p) { all.push({ x: decYear(p[0]), y: p[3] * 100, color: colors[k], r: 2.5, cfg: k, p: p }); });
        });
        var xs = all.map(function (d) { return d.x; });
        layers.push({ type: 'rule', y: 50, label: 'coin flip', labelAt: 'start-below' });
        layers.push({ type: 'points', data: all, invisible: true });
        return {
          height: 210, aria: 'Chance the best closed model beats the best open one in an Arena vote with a winner, over time', crosshair: true,
          x: { min: Math.min.apply(null, xs) - 0.05, max: Math.max.apply(null, xs) + 0.05 },
          y: { min: Math.min(40, Math.floor(Math.min.apply(null, all.map(function (d) { return d.y; })) / 10) * 10),
               max: Math.max(80, Math.ceil(Math.max.apply(null, all.map(function (d) { return d.y; })) / 10) * 10), fmt: function (v) { return v + '%'; }, title: 'best closed wins (of votes with a winner)' },
          layers: layers,
          tooltip: function (d) {
            var row = objs(D.arena_leaderboard).filter(function (r) { return r.config === d.cfg && r.date === d.p[0]; })[0] || {};
            return { value: 'Best closed wins ' + d.y.toFixed(0) + '%', lines: [a.configs[d.cfg].label + ', ' + fmtDate(d.p[0], true), 'Gap: ' + d.p[1] + ' points' + (d.p[2] != null ? ' (rough ± ' + d.p[2] + ')' : ''),
              'Closed: ' + (modelName(row.closed_model) || '?') + '; open: ' + (modelName(row.open_model) || '?')] };
          }
        };
      });
      var sc = a.configs.text_style_control, rw = a.configs.text, from = a.complete_from;
      legend($('#ovc-arena').parentNode, [{ label: 'style-adjusted votes (the arena\'s default view)', color: cv('--ink'), shape: 'line' },
        { label: 'raw votes', color: cv('--neutral-soft'), shape: 'line' }, { label: 'rough ± range: the arena\'s two intervals combined as if independent', shape: 'band' }]);
      if (sc && rw) h('p', 'fitline muted', 'History: ' + rw.snapshots + ' raw-vote snapshots (' + fmtDate(rw.from) + ' to ' + fmtDate(rw.to) + ') and ' + sc.snapshots +
        ' style-adjusted ones (' + fmtDate(sc.from) + ' to ' + fmtDate(sc.to) + ')' + (rw.left_out ? '; ' + rw.left_out + ' earlier raw-vote snapshots, from ' + fmtDate(rw.left_out_from) + ', are left out.' : '.'),
        $('#ovc-arena').parentNode);
      if (a.gaps_note) { var gp = h('p', 'fitline gapnote', null, $('#ovc-arena').parentNode); h('b', null, 'Gaps in the record. ', gp); txt(gp, a.gaps_note); }
      sourceLine($('#ovc-arena').parentNode, D.arena_leaderboard, 'arena_leaderboard');
      table($('#ovc-arena').parentNode, [{ label: 'Snapshot', get: function (r) { return r.date; } }, { label: 'Count', get: function (r) { return r.config === 'text' ? 'raw' : 'style-adjusted'; } },
        { label: 'Best closed', get: function (r) { return modelName(r.closed_model) + ' (' + r.closed_rating + ')'; } }, { label: 'Best open', get: function (r) { return modelName(r.open_model) + ' (' + r.open_rating + ')'; } },
        { label: 'Closed wins', num: 1, get: function (r) {
          if (r.open_rating == null) return '';
          return from && r.date < from ? 'left out: incomplete' : pct(1 / (1 + Math.pow(10, -(r.closed_rating - r.open_rating) / 400)));
        } }],
        objs(D.arena_leaderboard).slice().sort(function (x, y) { return y.date.localeCompare(x.date) || x.config.localeCompare(y.config); }), 'newest first');
    } else {
      $('#ovc-arena').textContent = 'Arena history is not available in this refresh.';
    }
    var shareQ = $('#ovc-share').parentNode.querySelector('.q');
    if (shareQ) shareQ.textContent = 'Counted from Epoch\'s list of notable models. ' + (rs.start_note || '') + ' ' + (rs.late_note || '') + ' The last year is not over yet.';
    mount($('#ovc-share'), 'columnsChart', function () {
      var cats = rs.series.map(function (s) {
        return { key: s[0], tick: "'" + s[0].slice(2), incomplete: s[0] === rs.partial_year, s: s,
          parts: [{ value: s[1], color: css('--open') }, { value: s[2], color: css('--closed') }, { value: s[3], color: css('--unknown') }] };
      });
      return {
        height: 200, categories: cats, aria: 'Notable model releases per year, open and closed weights',
        y: { fmt: function (v) { return String(v); }, title: 'notable models' },
        tooltip: function (c) {
          var s = c.s;
          return { value: s[0] + (c.incomplete ? ' (so far)' : ''), rows: [
            { value: String(s[1]), label: 'open weights (' + pct(s[4]) + ' of those with a status)', color: css('--open') },
            { value: String(s[2]), label: 'closed', color: css('--closed') },
            { value: String(s[3]), label: 'not stated', color: css('--unknown') }] };
        }
      };
    });
    legend($('#ovc-share').parentNode, [{ label: 'open weights', color: cv('--open'), shape: 'sq' }, { label: 'closed', color: cv('--closed'), shape: 'sq' },
      { label: 'not stated', color: cv('--unknown'), shape: 'sq' }]);
    sourceLine($('#ovc-share').parentNode, D.epoch_training_compute, 'epoch_training_compute');
    table($('#ovc-share').parentNode, [{ label: 'Year', get: function (s) { return s[0]; } }, { label: 'Open', num: 1, get: function (s) { return s[1]; } },
      { label: 'Closed', num: 1, get: function (s) { return s[2]; } }, { label: 'Not stated', num: 1, get: function (s) { return s[3]; } },
      { label: 'Open share', num: 1, get: function (s) { return pct(s[4]); } }], rs.series.slice().reverse());
  }

  /* ---------------- 4. the metric cards ---------------- */
  function scatterSpec(o) {
    // o: {points, trend, ylog, ymin, ymax, yfmt, ytitle, xmin, xmax, tooltip, onPick, height, extra layers}
    return function () {
      var t = o.trend ? trend(o.trend) : null, xmax = trendXMax(t, o.xmax);
      var pts = o.points(), yr = o.ylog ? logRange(pts.map(function (p) { return p.y; }), [t]) : [o.ymin, o.ymax], tp = trendParts(t);
      return {
        height: function (W) { return W < 480 ? 280 : 330; }, aria: o.aria,
        x: { min: o.xmin, max: xmax },
        y: { log: o.ylog, min: yr[0], max: yr[1], fmt: o.yfmt, title: o.ytitle },
        layers: (o.before ? o.before() : []).concat(tp.under).concat(o.layers ? o.layers() : []).concat([{ type: 'points', data: pts }]).concat(tp.over),
        markClass: markClass, tooltip: o.tooltip, onPick: o.onPick
      };
    };
  }
  function kindLegend(parent, extra) {
    return legend(parent, [{ label: 'closed weights', color: cv('--closed') }, { label: 'open weights', color: cv('--open') },
      { label: 'not stated', color: cv('--unknown') }].concat(extra || []));
  }
  var EXT_LEGEND = { label: 'with "if the trend continued" on: dashed line and inner band, the line\'s range; wide band, where single points could land (not a forecast)', shape: 'dash' };

  function renderCompute(parent) {
    var d = D.epoch_training_compute, c = card(parent, 'm-compute', 'Training compute',
      'How much computation went into training each notable model? The fitted line follows the biggest models of their day.');
    var pos = S.positions.epoch_training_compute;
    nowLine(c, sci(pos.value) + ' FLOP', 'largest estimate: ' + pos.who + ' (' + pos.org + ', ' + fmtDate(pos.date) + ', "' + pos.confidence + '")');
    var host = h('div', null, null, c), pin = pinBox(c);
    var withFlop = objs(d).filter(function (r) { return r.flop; });
    var rows = withFlop.filter(function (r) { return r.date >= '2010-01-01'; });
    var pts = rows.map(function (r) {
      var k = kindOfOpen(r.open);
      return { x: decYear(r.date), y: r.flop, r: r.frontier ? 5 : 3, hollow: r.confidence === 'Speculative', row: r, kind: k, players: playersOf(r.org) };
    });
    mount(host, 'xyChart', scatterSpec({
      aria: 'Training compute of notable models since 2010, log scale, with the trend of the biggest models',
      points: function () { pts.forEach(function (p) { p.color = kindColor(p.kind); }); return pts; },
      trend: 'compute_frontier', ylog: true, yfmt: function (v) { return pow10(Math.round(Math.log10(v))); }, ytitle: 'FLOP (log scale)',
      xmin: 2010, xmax: decYear(rows[rows.length - 1].date) + 0.2,
      tooltip: function (p) {
        var r = p.row;
        return { value: sci(r.flop) + ' FLOP', lines: [r.model, (r.org || '') + ', ' + fmtDate(r.date, true), 'Estimate: ' + r.confidence + (r.frontier ? ' · frontier model' : ''), KIND_LABEL[p.kind]] };
      },
      onPick: function (p) {
        var r = p.row;
        showPin(pin, p, [r.model + ': ' + sci(r.flop) + ' FLOP', (r.org || '') + ' · ' + fmtDate(r.date, true) + ' · estimate ' + r.confidence + ' · ' + KIND_LABEL[p.kind]],
          firstUrl(r.link) ? { href: firstUrl(r.link), text: 'Their announcement or paper' } : { href: d.page, text: 'Epoch AI: Data on AI Models' });
      }
    }));
    kindLegend(c, [{ label: 'hollow: "Speculative" estimate', color: cv('--ink-3'), shape: 'hollow' }, { label: 'fitted line, 90% range of the line', shape: 'band' }, EXT_LEGEND]);
    var t = trend('compute_frontier'), t2 = trend('compute_frontier_no_spec'), t3 = trend('compute_notable');
    h('p', 'fitline', fitSentence(t, 'Biggest models'), c);
    var more = h('p', 'fitline muted', null, c), ss = t && t.start_sensitivity;
    more.textContent = (ss ? 'Starting the fit anywhere from ' + ss.from_years[0] + ' to ' + ss.from_years[1] + ' gives ' + f1(ss.doubling_months[0]) + ' to ' + f1(ss.doubling_months[1]) + ' months. ' : '') +
      (t2 && t2.status === 'ok' ? 'Leaving out "Speculative" estimates: ' + months(t2.whole.doubling_months) + '. ' : '') +
      (t3 && t3.status === 'ok' ? 'All notable models since 2018: ' + months(t3.whole.doubling_months) + ' over the whole period, but ' +
        (t3.recent ? months(t3.recent.doubling_months) + ' in the last 24 months of data, where most estimates come from labs that disclose (often smaller, open-weights models), so the flattening may be about who is counted.' : 'too few recent points.') : '');
    coverage(c, d);
    sourceLine(c, d, 'epoch_training_compute');
    table(c, [{ label: 'Model', get: function (r) { return r.model; }, href: function (r) { return firstUrl(r.link); } }, { label: 'Organization', get: function (r) { return r.org; } },
      { label: 'Date', get: function (r) { return r.date; } }, { label: 'FLOP', num: 1, get: function (r) { return r.flop.toExponential(2); } },
      { label: 'Confidence', get: function (r) { return r.confidence; } }, { label: 'Weights', get: function (r) { return KIND_LABEL[kindOfOpen(r.open)]; } }],
      withFlop.slice().reverse(), 'every model with an estimate, newest first; the chart starts in 2010, so ' + (withFlop.length - rows.length) + ' earlier ones are only here');
  }

  function renderShipped(parent) {
    var d = D.epoch_chip_sales, c = card(parent, 'm-shipped', 'AI chips shipped',
      'How much AI compute do chip designers ship each quarter? Measured in H100-equivalents: one unit is the dense 16-bit compute of one Nvidia H100.');
    var pos = S.positions.epoch_chip_sales;
    nowLine(c, compact(pos.value) + ' H100e', 'Nvidia, quarter to ' + fmtDate(pos.date) + ' (latest complete quarter)');
    var rows = objs(d), designers = DESIGNERS.filter(function (x) { return rows.some(function (r) { return r.designer === x; }); });
    rows.forEach(function (r) { if (designers.indexOf(r.designer) < 0) designers.push(r.designer); });
    var quarters = Array.from(new Set(rows.map(function (r) { return r.quarter_end; }))).sort();
    // where counting starts (solid line, '+') and where a designer's series ends (dashed line):
    // one marker per quarter, naming who joins or who has no estimate from then on
    var nums = d.coverage.numbers || {}, starts = nums.start || {}, lastQ = nums.last_quarter || {}, first = quarters[0], lastAll = quarters[quarters.length - 1];
    var byQ = {}, endQ = {};
    designers.forEach(function (dz) {
      var s = starts[dz];
      if (s) {
        var q = quarters.filter(function (x) { return x >= s; })[0];
        if (q && q !== first) (byQ[q] = byQ[q] || []).push(dz);
      }
      var e = lastQ[dz];
      if (e && e < lastAll) {
        var nq = quarters.filter(function (x) { return x > e; })[0];
        if (nq) (endQ[nq] = endQ[nq] || []).push(dz);
      }
    });
    function namesLabel(prefix, names) {
      return names.length > 2 ? prefix + names.slice(0, 2).join(', ') + ',|' + names.slice(2).join(', ') : prefix + names.join(', ');
    }
    var markers = Object.keys(byQ).sort().map(function (q) { return { key: q, label: namesLabel('+ ', byQ[q]) }; })
      .concat(Object.keys(endQ).sort().map(function (q) { return { key: q, end: true, label: namesLabel('no data: ', endQ[q]) }; }));
    function whyMissing(dz, q) {
      if (starts[dz] && q < starts[dz]) return 'not counted yet';
      if (lastQ[dz] && q > lastQ[dz]) return 'no estimate after ' + fmtDate(lastQ[dz]);
      return 'no estimate';
    }
    var host = h('div', null, null, c);
    mount(host, 'columnsChart', function () {
      var cats = quarters.map(function (q) {
        var parts = designers.map(function (dz, i) {
          var r = rows.filter(function (x) { return x.designer === dz && x.quarter_end === q; })[0];
          return { value: r ? r.q_median : 0, color: dslot(i), designer: dz, row: r, player: playerOf(dz), incomplete: !!(r && r.incomplete) };
        });
        var inc = rows.some(function (x) { return x.quarter_end === q && x.incomplete; });
        var qn = Math.floor((+q.slice(5, 7) - 1) / 3) + 1;
        return { key: q, tick: qn === 1 ? q.slice(0, 4) : '', parts: parts, partial: inc, q: q, qn: qn };
      });
      return {
        height: 280, categories: cats, markers: markers, aria: 'AI compute shipped per quarter by chip designer; counting starts and stops at different dates',
        y: { fmt: function (v) { return compact(v, 0); }, title: 'H100-equivalents per quarter' },
        markClass: markClass,
        tooltip: function (cat) {
          var missing = {};
          cat.parts.forEach(function (p) { if (!p.row) { var w = whyMissing(p.designer, cat.q); (missing[w] = missing[w] || []).push(p.designer); } });
          return { value: 'Q' + cat.qn + ' ' + cat.q.slice(0, 4),
            rows: cat.parts.filter(function (p) { return p.value > 0; }).reverse().map(function (p) { return { value: compact(p.value), label: p.designer + (p.incomplete ? ' (still being counted)' : ''), color: p.color }; })
              .concat(Object.keys(missing).map(function (w) { return { value: '', label: w + ': ' + missing[w].join(', ') }; })) };
        }
      };
    });
    legend(c, designers.map(function (dz, i) { return { label: dz, color: cv(dslotName(i)), shape: 'sq' }; })
      .concat([{ label: 'lighter shade of a colour: quarter still being counted', color: cv(dslotName(0)), shape: 'sq', faded: true },
        { label: 'dashed line: a series ends', shape: 'vdash' }]));
    var sd = designers.filter(function (dz) { return starts[dz]; }).sort(function (a, b) { return starts[a].localeCompare(starts[b]); });
    if (sd.length > 1 && starts[sd[0]] !== starts[sd[sd.length - 1]]) {
      var minS = starts[sd[0]], maxS = starts[sd[sd.length - 1]];
      var firstN = sd.filter(function (dz) { return starts[dz] === minS; }), mids = sd.filter(function (dz) { return starts[dz] > minS && starts[dz] < maxS; });
      h('p', 'fitline muted', 'Before ' + fmtDate(maxS) + ' only ' + firstN.join(' and ') + (firstN.length > 1 ? ' are' : ' is') + ' counted' +
        (mids.length ? ', plus ' + mids.map(function (dz) { return dz + ' from ' + fmtDate(starts[dz]); }).join(', ') : '') +
        '. The solid vertical lines mark where counting starts, so part of the jump after them is counting starting, not only more chips.', c);
    }
    // and where it stops: Epoch's series end at different quarters, so the newest columns leave some designers out
    var ended = designers.filter(function (dz) { return lastQ[dz] && lastQ[dz] < lastAll; });
    if (ended.length) {
      var byEnd = {};
      ended.forEach(function (dz) { (byEnd[lastQ[dz]] = byEnd[lastQ[dz]] || []).push(dz); });
      var ends = Object.keys(byEnd).sort().map(function (q) { return andList(byEnd[q]) + ' after ' + fmtDate(q); });
      var inc = rows.filter(function (r) { return r.incomplete; }).map(function (r) { return r.designer + '\'s quarter to ' + fmtDate(r.quarter_end); });
      h('p', 'fitline muted', 'Epoch\'s series also end at different dates: there are no estimates for ' + ends.join(', or for ') +
        '. The dashed lines mark where each stops, so the newest columns leave those designers out and are lower partly for that reason.' +
        (inc.length ? ' Still being counted, and drawn lighter: ' + andList(inc) + '.' : ''), c);
    }
    h('p', 'fitline', fitSentence(trend('shipped_nvidia'), 'Nvidia alone'), c);
    h('p', 'fitline', fitSentence(trend('shipped_all'), 'All designers together'), c);
    coverage(c, d, 'Each quarter here is the change in Epoch\'s cumulative median, so it has no range of its own; the cumulative totals, with 5th to 95th percentiles, are in the table.');
    sourceLine(c, d, 'epoch_chip_sales');
    table(c, [{ label: 'Designer', get: function (r) { return r.designer; } }, { label: 'Quarter to', get: function (r) { return r.quarter_end; } },
      { label: 'Shipped (median)', num: 1, get: function (r) { return compact(r.q_median); } }, { label: 'Cumulative (median)', num: 1, get: function (r) { return compact(r.cum_median); } },
      { label: '5th-95th', num: 1, get: function (r) { return compact(r.cum_p5) + '–' + compact(r.cum_p95); } }, { label: 'Incomplete', get: function (r) { return r.incomplete ? 'yes' : ''; } }],
      rows.slice().sort(function (a, b) { return b.quarter_end.localeCompare(a.quarter_end); }));
  }

  function renderOwners(parent) {
    var d = D.epoch_chip_owners, c = card(parent, 'm-owners', 'Who holds the compute',
      'Where the AI chips end up: estimated compute owned, by owner and by the chip\'s designer.');
    var q = d.coverage.numbers.common_quarter, rows = objs(d).filter(function (r) { return r.quarter_end === q; });
    var pos = S.positions.epoch_chip_owners;
    nowLine(c, compact(pos.value) + ' H100e', pos.who + ' holds the most, of about ' + compact(pos.world_total) + ' counted, to ' + fmtDate(q));
    var designers = DESIGNERS;
    var owners = Array.from(new Set(rows.map(function (r) { return r.owner; })));
    function range(r) { return r.p5 == null || r.p95 == null ? null : compact(r.p5) + ' to ' + compact(r.p95); }
    var host = h('div', null, null, c);
    mount(host, 'hbarsChart', function () {
      var list = owners.map(function (o) {
        var parts = designers.map(function (dz, i) {
          var r = rows.filter(function (x) { return x.owner === o && x.designer === dz; })[0];
          return { value: r ? r.median : 0, color: dslot(i), designer: dz, row: r };
        });
        return { label: o, parts: parts, player: playerOf(o) };
      });
      list.forEach(function (r) { r.total = r.parts.reduce(function (s, p) { return s + p.value; }, 0); });
      list.sort(function (a, b) { return b.total - a.total; });
      return {
        rows: list, aria: 'AI compute held by owner, stacked by chip designer',
        x: { fmt: function (v) { return compact(v, 1); } }, markClass: markClass,
        tooltip: function (m) {
          var p = m.part, r = p.row;
          return { value: compact(p.value) + ' H100e', lines: [m.row.label + ', ' + p.designer + ' chips', r && range(r) ? '5th-95th percentile: ' + range(r) : 'Epoch gives no 5th-95th range for this one',
            'Owner total: ' + compact(m.row.total) + ' (sum of medians)'] };
        },
        onPick: function (m) { if (m.row.player) setPlayer(m.row.player, true); }
      };
    });
    legend(c, designers.map(function (dz, i) { return { label: dz, color: cv(dslotName(i)), shape: 'sq' }; }));
    var noRange = rows.filter(function (r) { return !range(r); }).map(function (r) { return r.owner + ' (' + r.designer + ')'; });
    coverage(c, d, 'Totals add the medians of each designer\'s estimate; ranges do not add that way, so each part\'s own 5th to 95th percentile is in the tooltip and the table' +
      (noRange.length ? ', where Epoch gives one (it gives none for ' + andList(noRange) + ')' : '') + '.');
    sourceLine(c, d, 'epoch_chip_owners');
    table(c, [{ label: 'Owner', get: function (r) { return r.owner; } }, { label: 'Designer', get: function (r) { return r.designer; } },
      { label: 'Median', num: 1, get: function (r) { return compact(r.median); } }, { label: '5th-95th', num: 1, get: function (r) { return range(r) || 'not given'; } },
      { label: 'Power (MW)', num: 1, get: function (r) { return r.power_mw == null ? '' : compact(r.power_mw); } }], rows, 'quarter to ' + q);
  }

  function renderHardware(parent) {
    var d = D.epoch_ml_hardware, c = card(parent, 'm-hardware', 'Chip speed per dollar',
      'How much 16-bit AI compute does one dollar buy? Only chips with a price can be placed, and data-centre makers rarely publish one, so most prices are reported by others.');
    var pos = S.positions.epoch_ml_hardware;
    nowLine(c, months(pos.value) + ' to double', 'data-centre chips, FLOP/s per dollar (' + pos.chips + ' chips with a price, to ' + fmtDate(pos.newest) + '): too few for a firm headline');
    var rows = objs(d).filter(function (r) { return r.flops_per_usd; }), host = h('div', null, null, c), pin = pinBox(c);
    var pts = rows.map(function (r) {
      var dc = r.segment === 'data centre';
      return { x: decYear(r.date), y: r.flops_per_usd, r: dc ? 5 : 4, hollow: !dc, ring: r.price_kind === 'estimate', row: r, dc: dc, players: playersOf(r.maker) };
    });
    var xs = pts.map(function (p) { return p.x; });
    mount(host, 'xyChart', scatterSpec({
      aria: 'FP16 FLOP per second per dollar, by chip release date, log scale; data-centre chips filled, consumer and workstation cards hollow',
      points: function () { pts.forEach(function (p) { p.color = p.dc ? css('--neutral') : css('--ink-3'); }); return pts; },
      trend: 'hw_datacentre', ylog: true, yfmt: function (v) { return compact(v, 0); }, ytitle: 'FLOP/s per dollar (log scale)',
      xmin: Math.floor(Math.min.apply(null, xs)), xmax: Math.max.apply(null, xs) + 0.3,
      tooltip: function (p) {
        var r = p.row;
        return { value: compact(r.flops_per_usd, 1) + ' FLOP/s per $', lines: [r.name + ' (' + (r.maker || '') + ', ' + fmtDate(r.date) + ')', r.segment,
          compact(r.fp16_flops, 0) + ' FLOP/s FP16/BF16 at ' + usd(r.price_usd) + ' (' + (r.price_kind || 'price') + ')'] };
      },
      onPick: function (p) {
        var r = p.row;
        showPin(pin, p, [r.name + ': ' + compact(r.flops_per_usd, 1) + ' FLOP/s per dollar', (r.maker || '') + ' · ' + fmtDate(r.date) + ' · ' + r.segment + ' · ' + usd(r.price_usd) + ', ' + (r.price_kind || 'price')],
          firstUrl(r.price_source) ? { href: firstUrl(r.price_source), text: 'Where the price comes from' } : firstUrl(r.link) ? { href: firstUrl(r.link), text: 'Datasheet' } : { href: d.page, text: 'Epoch AI hardware data' });
      }
    }));
    var estNames = pts.filter(function (p) { return p.ring; }).map(function (p) { return p.row.name; });
    legend(c, [{ label: 'data-centre chip', color: cv('--neutral') }, { label: 'consumer or workstation card', color: cv('--ink-3'), shape: 'hollow' }]
      .concat(estNames.length ? [{ label: 'dashed ring: the price is Epoch\'s own estimate (' + andList(estNames) + ')', color: cv('--ink-2'), shape: 'ring' }] : [])
      .concat([{ label: 'fitted line (data-centre chips), 90% range of the line', shape: 'band' }, EXT_LEGEND]));
    h('p', 'fitline', fitSentence(trend('hw_datacentre'), 'Data-centre chips'), c);
    var ta = trend('hw_all'), eh = S.epoch_hw_trend, more = h('p', 'fitline muted', null, c);
    if (ta && ta.status === 'ok') txt(more, 'Every priced chip, consumer and workstation cards included: ' + months(ta.whole.doubling_months) + ' (' + monthsRange(ta.whole.doubling_ci, ta.whole.doubling_months) + '), a wider range because the cards sit far above the data-centre chips. ');
    if (eh) {
      txt(more, 'Epoch\'s own published trend, measured differently (FP32, inflation-adjusted, chips to ' + fmtDate(eh.as_of) + '): ' + months(eh.doubling_months) + ' (' + monthsRange(eh.doubling_ci, eh.doubling_months) + '). Source: ' +
        (eh.authors ? eh.authors + ', ' : ''));
      link(eh.url, 'Trends in machine learning hardware', more, true);
      txt(more, ' (Epoch AI, 2023, CC BY 4.0).');
    }
    var est = (pos.estimated || []).join(', ');
    coverage(c, d, 'Prices: consumer cards carry the maker\'s launch price; data-centre chips carry prices reported by resellers, analysts or the press' +
      (est ? ', and ' + est + ' carries Epoch\'s own estimate (Google sells no TPUs and publishes no price)' : '') + '. None of these is what the largest buyers pay. ' +
      'For GeForce gaming cards, the FP16 figure appears to be the rate with FP16 accumulation, about twice the rate with FP32 accumulation that training usually uses (Nvidia\'s architecture whitepapers list both), so the cards are drawn hollow and left out of the headline line.');
    sourceLine(c, d, 'epoch_ml_hardware');
    table(c, [{ label: 'Chip', get: function (r) { return r.name; }, href: function (r) { return firstUrl(r.link); } }, { label: 'Maker', get: function (r) { return r.maker; } },
      { label: 'Released', get: function (r) { return r.date; } }, { label: 'Segment', get: function (r) { return r.segment; } },
      { label: 'FP16 FLOP/s', num: 1, get: function (r) { return r.fp16_flops ? r.fp16_flops.toExponential(2) : ''; } },
      { label: 'Price', num: 1, get: function (r) { return r.price_usd ? usd(r.price_usd) : ''; } }, { label: 'Price kind', get: function (r) { return r.price_kind || ''; }, href: function (r) { return firstUrl(r.price_source); } },
      { label: 'FLOP/s per $', num: 1, get: function (r) { return r.flops_per_usd ? compact(r.flops_per_usd) : ''; } }],
      objs(d).slice().reverse(), 'all chips, newest first');
  }

  function renderEci(parent) {
    var d = D.epoch_eci, c = card(parent, 'm-eci', 'Epoch Capabilities Index',
      'One general-capability score per model, fitted across many benchmarks. The steps trace the best closed and the best open model so far.');
    var pos = S.positions.epoch_eci;
    nowLine(c, f1(pos.value), 'highest: ' + pos.who + ' (' + pos.org + ', ' + fmtDate(pos.date) + '), interval ' + f1(pos.lo) + ' to ' + f1(pos.hi));
    var rows = objs(d), host = h('div', null, null, c), pin = pinBox(c);
    var pts = rows.map(function (r) {
      var k = r.group === 'Open weights' ? 'open' : r.group === 'Closed weights' ? 'closed' : 'unknown';
      return { x: decYear(r.date), y: r.eci, r: 3.5, row: r, kind: k, players: playersOf(r.org) };
    });
    function frontier(k) {
      var best = -1, out = [];
      rows.forEach(function (r) {
        var kk = r.group === 'Open weights' ? 'open' : r.group === 'Closed weights' ? 'closed' : 'x';
        if (kk === k && r.eci > best) { best = r.eci; out.push([decYear(r.date), r.eci]); }
      });
      return out;
    }
    var xs = pts.map(function (p) { return p.x; }), xmax = Math.max.apply(null, xs) + 0.15;
    mount(host, 'xyChart', function () {
      pts.forEach(function (p) { p.color = kindColor(p.kind); });
      var pinned = pts.filter(function (p) { return p.pinned || (state.player && p.players.indexOf(state.player) >= 0); });
      return {
        height: function (W) { return W < 480 ? 280 : 320; }, aria: 'Epoch Capabilities Index by release date, open and closed weights',
        x: { min: Math.min.apply(null, xs) - 0.1, max: xmax },
        y: { min: Math.floor(Math.min.apply(null, rows.map(function (r) { return r.eci; })) / 10) * 10, max: Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.hi || r.eci; })) / 10) * 10 + 5,
          fmt: function (v) { return String(v); }, title: 'ECI' },
        layers: [
          { type: 'whiskers', data: pinned.map(function (p) { return { x: p.x, lo: p.row.lo, hi: p.row.hi, color: p.color, players: p.players }; }) },
          { type: 'steps', data: frontier('closed'), color: css('--closed'), extendTo: xmax },
          { type: 'steps', data: frontier('open'), color: css('--open'), extendTo: xmax },
          { type: 'points', data: pts }
        ],
        markClass: markClass,
        tooltip: function (p) {
          var r = p.row;
          return { value: 'ECI ' + f1(r.eci) + (r.lo != null ? ' (' + f1(r.lo) + ' to ' + f1(r.hi) + ')' : ''), lines: [r.model, (r.org || 'organization not stated') + ', ' + fmtDate(r.date, true), KIND_LABEL[p.kind] + (r.access ? ' · ' + r.access : '')] };
        },
        onPick: function (p) {
          var r = p.row;
          showPin(pin, p, [r.model + ': ECI ' + f1(r.eci), (r.org || '') + ' · ' + fmtDate(r.date, true) + ' · interval ' + (r.lo != null ? f1(r.lo) + ' to ' + f1(r.hi) : 'none (an anchor point)') + ' · ' + KIND_LABEL[p.kind]],
            { href: d.page, text: 'Epoch AI benchmarking hub' });
        }
      };
    });
    kindLegend(c, [{ label: 'best closed so far (steps)', color: cv('--closed'), shape: 'line' }, { label: 'best open so far (steps)', color: cv('--open'), shape: 'line' }]);
    var e = S.open_vs_closed.eci;
    h('p', 'fitline', 'Gap today: the best closed model scores ' + e.best_closed.eci + ', the best open one ' + e.best_open.eci + ' (' + e.gap_points +
      ' points). The index is built so steady progress looks like a straight line, so it has no doubling time to compare with the others.', c);
    coverage(c, d);
    sourceLine(c, d, 'epoch_eci');
    table(c, [{ label: 'Model', get: function (r) { return r.model; } }, { label: 'Organization', get: function (r) { return r.org; } }, { label: 'Date', get: function (r) { return r.date; } },
      { label: 'ECI', num: 1, get: function (r) { return f1(r.eci); } }, { label: 'Interval', num: 1, get: function (r) { return r.lo != null ? f1(r.lo) + '–' + f1(r.hi) : ''; } },
      { label: 'Weights', get: function (r) { return r.group; } }], rows.slice().reverse(), 'newest first');
  }

  function renderTests(parent) {
    var d = D.epoch_benchmarks_internal, c = card(parent, 'm-tests', 'Hard tests: how much room is left',
      'Share of questions right on three benchmarks Epoch runs itself. When the best scores bunch near the top, the test stops telling the leaders apart, and a new test takes over.');
    var pos = S.positions.epoch_benchmarks_internal;
    var n = h('ul', 'testnow', null, c);
    pos.items.forEach(function (it) {
      var li = h('li', null, null, n), ru = it.runner_up;
      h('b', null, it.name + ': ', li);
      txt(li, 'best ' + pct(it.value, 1) + ' (' + modelName(it.who) + ', ' + fmtDate(it.date) + ')' +
        (ru ? (it.tied ? ', tied with ' : ', ahead of ') + modelName(ru.who) + ' (' + pct(ru.value, 1) + ')' + (it.tied ? ' within two standard errors' : '') : '') +
        '. Room left, if every answer key is right: ' + Math.round(it.room_left_if_keys_right * 100) + ' points. ' +
        (it.newest_tested.who === it.who ? 'It is also the newest model Epoch has run on this test.' :
          'Newest model Epoch ran: ' + modelName(it.newest_tested.who) + ' (released ' + fmtDate(it.newest_tested.date, true) + '), ' + pct(it.newest_tested.value, 1) + '.'));
    });
    var rows = objs(d), grid = h('div', null, null, c), pin = pinBox(c);
    var allX = rows.map(function (r) { return decYear(r.date); }), xmin = Math.min.apply(null, allX) - 0.1, xmaxAll = Math.max.apply(null, allX) + 0.1;
    d.benchmarks.forEach(function (b) {
      var sub = h('div', null, null, grid);
      h('p', 'fitline', b.name + '. ' + b.what, sub);
      var host = h('div', null, null, sub);
      var rs = rows.filter(function (r) { return r.bench === b.id; });
      var pts = rs.map(function (r) { var k = kindOfAccess(r.access); return { x: decYear(r.date), y: r.score, r: 3.2, row: r, kind: k, players: playersOf(r.org) }; });
      var xmax = xmaxAll, best = -1, steps = [];
      rs.slice().sort(function (a, b2) { return a.date.localeCompare(b2.date); }).forEach(function (r) { if (r.score > best) { best = r.score; steps.push([decYear(r.date), r.score]); } });
      mount(host, 'xyChart', function () {
        pts.forEach(function (p) { p.color = kindColor(p.kind); });
        var layers = [{ type: 'rule', y: 1, label: 'all correct, if every answer key is right' }];
        if (b.random_baseline) layers.push({ type: 'rule', y: b.random_baseline, label: 'guessing' });
        if (b.score_ceiling && b.score_ceiling < 1) layers.push({ type: 'rule', y: b.score_ceiling, label: 'Epoch\'s stated ceiling' });
        layers.push({ type: 'steps', data: steps, color: css('--ink-3'), extendTo: xmax });
        layers.push({ type: 'points', data: pts });
        return {
          height: 200, aria: b.name + ' scores by model release date (the three tests share one time axis)',
          x: { min: xmin, max: xmax },
          y: { min: 0, max: 1.08, fmt: function (v) { return Math.round(v * 100) + '%'; } },
          layers: layers, markClass: markClass,
          tooltip: function (p) {
            var r = p.row;
            return { value: pct(r.score, 1) + (r.stderr != null ? ' ± ' + pct(r.stderr, 1) : ''), lines: [modelName(r.model), (r.org || '') + ', released ' + fmtDate(r.date, true), KIND_LABEL[p.kind]] };
          },
          onPick: function (p) {
            var r = p.row;
            showPin(pin, p, [modelName(r.model) + ' on ' + b.name + ': ' + pct(r.score, 1) + (r.stderr != null ? ' (standard error ' + pct(r.stderr, 1) + ')' : ''), (r.org || '') + ' · released ' + fmtDate(r.date, true)],
              { href: d.page, text: 'Epoch AI benchmarking hub' });
          }
        };
      });
    });
    kindLegend(c, [{ label: 'best so far (steps)', color: cv('--ink-3'), shape: 'line' }]);
    h('p', 'fitline muted', 'The three charts share one time axis, from ' + fmtDate(rows.reduce(function (a, r) { return r.date < a ? r.date : a; }, '9999')) +
      ', so the same place across them is the same date. Dots sit at each model\'s release date, so a test\'s dots start with the oldest model Epoch has run on it.', c);
    coverage(c, d, pos.note);
    sourceLine(c, d, 'epoch_benchmarks_internal');
    table(c, [{ label: 'Test', get: function (r) { return r.bench; } }, { label: 'Model', get: function (r) { return modelName(r.model); } }, { label: 'Organization', get: function (r) { return r.org; } },
      { label: 'Released', get: function (r) { return r.date; } }, { label: 'Score', num: 1, get: function (r) { return pct(r.score, 1); } },
      { label: 'Std. error', num: 1, get: function (r) { return r.stderr != null ? pct(r.stderr, 1) : ''; } }], rows.slice().reverse());
  }

  function renderMetr(parent) {
    var d = D.metr_time_horizon, c = card(parent, 'm-metr', 'METR: how long a task an agent can finish',
      'The length of software and ML-research task, timed by how long a skilled person takes, that an AI agent completes half the time.', { cls: 'linkonly' });
    if (!d) { h('p', 'err', 'Not available in this refresh.', c); return; }
    var p = h('p', 'fitline', null, c);
    txt(p, 'The chart lives on METR\'s own page, because no open licence covers its per-model numbers: ');
    link(d.page, 'metr.org/time-horizons', p, true);
    txt(p, '. Quoted here, with attribution, are only METR\'s own fitted doubling times, with METR\'s own ranges (its method, not our 90% bootstrap):');
    var ul = h('ul', null, null, c);
    d.quoted.forEach(function (q) {
      h('li', null, 'Version ' + q.version.slice(1) + ', ' + q.window + ': doubles every ' + (q.doubling_days / 30.44).toFixed(1) + ' months' +
        (q.ci_low_days ? ' (METR\'s range ' + (q.ci_low_days / 30.44).toFixed(1) + ' to ' + (q.ci_high_days / 30.44).toFixed(1) + ')' : '') + (q.note ? '. ' + q.note + '.' : '.'), ul);
    });
    h('p', 'fitline muted', 'The two versions of METR\'s task suite give different numbers, but their ranges overlap: they differ rather than disagree. Both are listed, neither is averaged away. Newest model measured: ' +
      modelName(d.coverage.numbers.versions[0].newest_model) + ' (' + fmtDate(d.coverage.numbers.versions[0].newest) + ').', c);
    coverage(c, d, 'Until METR\'s per-model numbers come with a clear licence or permission, this card links to them rather than redrawing them.');
    sourceLine(c, d, 'metr_time_horizon');
  }

  function renderRevenue(parent) {
    var d = D.epoch_ai_companies, c = card(parent, 'm-revenue', 'Revenue',
      'Reported yearly revenue run-rates of companies whose main business is AI models. Lines join each company\'s reports; the bands are fitted lines for the two with the most reports. Each is one company, not the industry.');
    var pos = S.positions.epoch_ai_companies;
    nowLine(c, usd(pos.value) + ' a year', 'highest reported: ' + pos.who + ' (' + fmtDate(pos.date) + ')');
    var rows = objs(d), host = h('div', null, null, c), pin = pinBox(c);
    var cos = Array.from(new Set(rows.map(function (r) { return r.company; })));
    var pts = rows.map(function (r) { return { x: decYear(r.date), y: r.annualized_usd, r: 3.5, row: r, players: playersOf(r.company) }; });
    var xs = pts.map(function (p) { return p.x; });
    mount(host, 'xyChart', function () {
      var ta = trend('revenue_openai'), tb = trend('revenue_anthropic');
      var xmax = trendXMax(tb, trendXMax(ta, Math.max.apply(null, xs) + 0.1));
      var pa = trendParts(ta), pb = trendParts(tb), layers = pa.under.concat(pb.under);
      var ends = [];
      var FIT = { OpenAI: css('--s3'), Anthropic: css('--s7') };
      cos.forEach(function (co) {
        var rs = pts.filter(function (p) { return p.row.company === co; }).sort(function (a, b) { return a.x - b.x; });
        var col = FIT[co] || css('--neutral-soft');
        rs.forEach(function (p) { p.color = col; });
        if (rs.length > 1) layers.push({ type: 'line', data: rs.map(function (p) { return [p.x, p.y]; }), color: col });
        var last = rs[rs.length - 1];
        ends.push({ x: last.x, y: last.y, text: co, players: last.players, muted: !FIT[co], emph: !!FIT[co] });
      });
      // label line ends selectively: the two fitted companies always (the lower one goes under
      // its line end if the two are close), the others only where they do not collide
      ends.sort(function (a, b) { return b.y - a.y; });
      var kept = [];
      ends.forEach(function (e) {
        var clash = kept.some(function (k) { return Math.abs(Math.log10(k.y) - Math.log10(e.y)) < 0.22; });
        if (!clash) { e.dy = 4; kept.push(e); }
        else if (e.emph) { e.dy = 16; kept.push(e); }
      });
      layers.push({ type: 'labels', data: kept.map(function (e) { return { x: e.x, y: e.y, text: e.text, dx: 6, dy: e.dy, players: e.players, muted: e.muted }; }) });
      layers.push({ type: 'points', data: pts });
      layers = layers.concat(pa.over).concat(pb.over);
      return {
        height: function (W) { return W < 480 ? 280 : 320; }, aria: 'Reported annualized revenue by company, log scale',
        marginRight: function () { return 84; },
        x: { min: Math.floor(Math.min.apply(null, xs)), max: xmax },
        y: (function () { var yr = logRange(pts.map(function (p) { return p.y; }), [ta, tb]); return { log: true, min: yr[0], max: yr[1], fmt: usd, title: 'US dollars a year (log scale)' }; })(),
        layers: layers, markClass: markClass,
        tooltip: function (p) {
          var r = p.row;
          return { value: usd(r.annualized_usd) + ' a year', lines: [r.company + ', ' + fmtDate(r.date, true), (r.kind || '') + (r.confidence ? ' · ' + r.confidence : ''), sourceTypes(r.source_type)] };
        },
        onPick: function (p) {
          var r = p.row;
          showPin(pin, p, [r.company + ': ' + usd(r.annualized_usd) + ' a year', fmtDate(r.date, true) + ' · ' + (r.kind || '') + ' · ' + sourceTypes(r.source_type) + ' · confidence ' + (r.confidence || 'not stated')],
            firstUrl(r.source_link) ? { href: firstUrl(r.source_link), text: 'Where it was reported' } : { href: d.page, text: 'Epoch AI: Data on AI Companies' });
        }
      };
    });
    legend(c, [{ label: 'OpenAI', color: cv('--s3') }, { label: 'Anthropic', color: cv('--s7') }, { label: 'other companies (hover or table)', color: cv('--neutral-soft') },
      { label: 'fitted line (one company), 90% range of the line', shape: 'band' }]);
    h('p', 'fitline', fitSentence(trend('revenue_anthropic'), 'Anthropic'), c);
    h('p', 'fitline', fitSentence(trend('revenue_openai'), 'OpenAI'), c);
    coverage(c, d, 'These two companies grow from a small base and were picked because they have the most reports, so their pace is theirs, not the industry\'s.');
    sourceLine(c, d, 'epoch_ai_companies');
    table(c, [{ label: 'Company', get: function (r) { return r.company; } }, { label: 'Date', get: function (r) { return r.date; } },
      { label: 'Run-rate', num: 1, get: function (r) { return usd(r.annualized_usd); } }, { label: 'Kind', get: function (r) { return r.kind; } },
      { label: 'Report', get: function (r) { return sourceTypes(r.source_type); }, href: function (r) { return firstUrl(r.source_link); } }], rows.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }));
  }

  function renderCost(parent) {
    var d = D.epoch_training_cost, c = card(parent, 'm-cost', 'Training cost',
      'What the compute for one final training run cost, in 2023 dollars. Research, staff, failed runs and data are not included.');
    var pos = S.positions.epoch_training_cost;
    var fd = (S.sources.epoch_training_cost || {}).frontier_date;
    nowLine(c, usd(pos.value), 'costliest estimate: ' + pos.who + ' (' + pos.org + ', ' + fmtDate(pos.date) + ', compute "' + pos.confidence + '"); newest estimate ' + fmtDate(newest('epoch_training_cost')) +
      (fd ? '; newest for the biggest models ' + fmtDate(fd, true) : ''));
    var all = objs(d), rows = all.filter(function (r) { return r.date >= '2012-01-01'; }), host = h('div', null, null, c), pin = pinBox(c);
    var pts = rows.map(function (r) { var k = kindOfOpen(r.open); return { x: decYear(r.date), y: r.cost_usd_2023, r: r.frontier ? 5 : 3, hollow: r.confidence === 'Speculative', row: r, kind: k, players: playersOf(r.org) }; });
    var xs = pts.map(function (p) { return p.x; });
    mount(host, 'xyChart', scatterSpec({
      aria: 'Training run cost of notable models, log scale, with the trend of the biggest models',
      points: function () { pts.forEach(function (p) { p.color = kindColor(p.kind); }); return pts; },
      trend: 'cost_frontier', ylog: true, yfmt: usd, ytitle: '2023 US dollars (log scale)',
      xmin: 2012, xmax: Math.max.apply(null, xs) + 0.3,
      tooltip: function (p) { var r = p.row; return { value: usd(r.cost_usd_2023), lines: [r.model, (r.org || '') + ', ' + fmtDate(r.date, true), 'Compute estimate: ' + (r.confidence || 'not stated') + (r.frontier ? ' · frontier model' : '')] }; },
      onPick: function (p) {
        var r = p.row;
        showPin(pin, p, [r.model + ': ' + usd(r.cost_usd_2023), (r.org || '') + ' · ' + fmtDate(r.date, true) + ' · ' + KIND_LABEL[p.kind]],
          firstUrl(r.link) ? { href: firstUrl(r.link), text: 'Their announcement or paper' } : { href: d.page, text: 'Epoch AI: Data on AI Models' });
      }
    }));
    kindLegend(c, [{ label: 'hollow: "Speculative" compute estimate', color: cv('--ink-3'), shape: 'hollow' }, { label: 'fitted line (biggest models), 90% range of the line', shape: 'band' }]);
    h('p', 'fitline', fitSentence(trend('cost_frontier'), 'Biggest models since 2016'), c);
    var t2 = trend('cost_frontier_no_spec');
    if (t2 && t2.status === 'ok') h('p', 'fitline muted', 'Leaving out "Speculative" estimates: ' + months(t2.whole.doubling_months) + ' (' + monthsRange(t2.whole.doubling_ci, t2.whole.doubling_months) + '), ' +
      t2.whole.n + ' points; pace lately: ' + verdictText(t2.change) + (t2.change.recent ? ' (' + spanText(t2, t2.change.recent) + ', ' + t2.change.recent.n + ' points)' : '') + '.', c);
    coverage(c, d);
    sourceLine(c, d, 'epoch_training_cost');
    table(c, [{ label: 'Model', get: function (r) { return r.model; }, href: function (r) { return firstUrl(r.link); } }, { label: 'Organization', get: function (r) { return r.org; } },
      { label: 'Date', get: function (r) { return r.date; } }, { label: 'Cost (2023 $)', num: 1, get: function (r) { return usd(r.cost_usd_2023); } },
      { label: 'Confidence', get: function (r) { return r.confidence; } }], all.slice().reverse(),
      'every model with an estimate, newest first' + (all.length > rows.length ? '; the chart starts in 2012, so ' + (all.length - rows.length) + ' earlier ones are only here' : ''));
  }

  /* ---------------- 5. the player panel: what they say, what they do ---------------- */
  function best(list, key) { return list.reduce(function (b, r) { return !b || r[key] > b[key] ? r : b; }, null); }
  function renderPlayerPanel() {
    var box = $('#player'), id = state.player;
    $('#clear').hidden = !id;
    if (!id) { box.hidden = true; box.textContent = ''; return; }
    var p = playerById[id]; box.hidden = false; box.textContent = '';
    h('h2', null, p.name, box);
    h('p', 'kind', p.kind + ' · ' + p.country + '. Marked in every chart below; everyone else is faded. We write no strategy text of our own: first what they say, in their own words, then what other people\'s measurements show.', box);

    // what they say
    h('h3', null, 'What they say', box);
    var say = h('ul', 'say', null, box);
    if (p.lab_page) { var l0 = h('li', null, null, say); link(p.lab_page, 'Our page on ' + p.name, l0); }
    (p.own_words || []).forEach(function (w) {
      var li = h('li', null, null, say);
      link(w.url, w.title, li, true);
      if (w.date) {
        var age = monthsSince(w.date);
        txt(li, ' · ' + fmtDate(w.date, true));
        if (age > 12) h('span', 'old', ' · older than 12 months (' + Math.floor(age / 12) + (Math.floor(age / 12) === 1 ? ' year' : ' years') + (age % 12 >= 1 ? ' ' + Math.floor(age % 12) + ' months' : '') + '); they may have moved on from it', li);
      } else txt(li, ' · a living page, undated');
    });
    var hl = h('li', null, null, say); link(p.home, 'Home page', hl, true); txt(hl, ' · a living page');
    if (!(p.own_words || []).length) h('li', 'absent', 'No statement of their own linked yet.', say);

    // what they do: other people's measurements, each with its source
    h('h3', null, 'What they do (other people\'s measurements)', box);
    var ul = h('ul', 'do', null, box);
    function line(meter, anchor, text, absent, srcId) {
      var li = h('li', null, null, ul), m = h('span', 'm', null, li);
      link('#' + anchor, meter, m);
      var t = h('span', absent ? 'absent' : '', text + ' ', li);
      if (srcId && D[srcId]) { var s = h('span', 'srcref', '(', t); link('data/' + srcId + '.json', D[srcId].source, s); txt(s, ')'); }
    }
    // a model several organizations built counts for each of them that is a player
    var mine = function (rows, key) { return rows.filter(function (r) { return isMine(r[key || 'org'], id); }); };
    var tcAll = mine(objs(D.epoch_training_compute));
    var known = tcAll.filter(function (r) { return r.open === true || r.open === false; }), openN = known.filter(function (r) { return r.open === true; }).length;
    var cov = D.epoch_training_compute.coverage.numbers, recentN = tcAll.filter(function (r) { return r.date >= cov.recent_since; });
    var recentKnown = recentN.filter(function (r) { return r.open === true || r.open === false; });
    var upTo = fmtDate(D.epoch_training_compute.source_updated);
    if (known.length) line('Open weights', 'ovc', countLine(openN, known.length, 'notable model', ' with a stated status', 'downloadable weights') + ' (' + pct(openN / known.length) + '); ' +
      (recentKnown.length ? 'in the 12 months to ' + upTo + ', ' + recentKnown.filter(function (r) { return r.open === true; }).length + ' of ' + recentKnown.length + '.' : 'none released in the 12 months to ' + upTo + '.'), false, 'epoch_training_compute');
    else line('Open weights', 'ovc', tcAll.length ? 'no stated open or closed status for their ' + plural(tcAll.length, 'notable model') + '.' : 'no notable models listed.', true, 'epoch_training_compute');
    var recentF = recentN.filter(function (r) { return r.flop; }).length;
    if (tcAll.length) line('Compute disclosed', 'm-compute', (recentN.length ? countLine(recentF, recentN.length, 'notable model', ' since ' + fmtDate(cov.recent_since, true), 'a public compute estimate') + '; ' :
      'no notable models since ' + fmtDate(cov.recent_since, true) + '; ') +
      tcAll.filter(function (r) { return r.flop; }).length + ' of ' + tcAll.length + ' over all years.', false, 'epoch_training_compute');
    var q = D.epoch_chip_owners.coverage.numbers.common_quarter, own = objs(D.epoch_chip_owners).filter(function (r) { return r.quarter_end === q; });
    var mineOwn = own.filter(function (r) { return isMine(r.owner, id); }), total = own.reduce(function (s, r) { return s + r.median; }, 0);
    if (mineOwn.length) { var so = mineOwn.reduce(function (s, r) { return s + r.median; }, 0); line('Compute owned', 'm-owners', compact(so) + ' H100e, about ' + pct(so / total) + ' of what is counted (to ' + fmtDate(q) + ').', false, 'epoch_chip_owners'); }
    else line('Compute owned', 'm-owners', 'not listed as an owner (may rent, or be counted inside ' + (p.country === 'China' ? '"China" or "Other"' : '"Other"') + ').', true, 'epoch_chip_owners');
    var hw = objs(D.epoch_ml_hardware).filter(function (r) { return isMine(r.maker, id); });
    if (hw.length) { var lh = hw[hw.length - 1]; line('Chips designed', 'm-hardware', plural(hw.length, 'chip') + ' listed; newest ' + lh.name + ' (' + fmtDate(lh.date) + ')' + (lh.flops_per_usd ? '.' : ', no public price.'), false, 'epoch_ml_hardware'); }
    else line('Chips designed', 'm-hardware', 'none listed.', true, 'epoch_ml_hardware');

    // where they sit on each meter
    h('h3', null, 'Where they sit on each meter', box);
    ul = h('ul', 'do', null, box);
    var withF = tcAll.filter(function (r) { return r.flop; });
    if (withF.length) { var b = best(withF, 'flop'); line('Training compute', 'm-compute', 'largest estimate ' + sci(b.flop) + ' FLOP (' + b.model + ', ' + fmtDate(b.date) + ', "' + b.confidence + '").'); }
    else line('Training compute', 'm-compute', tcAll.length ? 'no public estimate for any of their ' + tcAll.length + ' notable models.' : 'no notable models listed.', true);
    var cost = mine(objs(D.epoch_training_cost));
    if (cost.length) { var bc = best(cost, 'cost_usd_2023'); line('Training cost', 'm-cost', 'costliest estimate ' + usd(bc.cost_usd_2023) + ' (' + bc.model + ', ' + fmtDate(bc.date) + ').'); }
    else line('Training cost', 'm-cost', 'no cost estimates.', true);
    var eci = mine(objs(D.epoch_eci));
    if (eci.length) { var be = best(eci, 'eci'); line('Capability index', 'm-eci', 'best ' + f1(be.eci) + ' (' + be.model + ', ' + fmtDate(be.date) + ', ' + be.group.toLowerCase() + '); ' + plural(eci.length, 'model') + ' scored.'); }
    else line('Capability index', 'm-eci', 'no models scored.', true);
    var tests = mine(objs(D.epoch_benchmarks_internal));
    if (tests.length) {
      line('Hard tests', 'm-tests', D.epoch_benchmarks_internal.benchmarks.map(function (bm) {
        var rs = tests.filter(function (r) { return r.bench === bm.id; }), bb = best(rs, 'score');
        return bm.name + ' ' + (bb ? pct(bb.score) : 'not run');
      }).join('; ') + '.');
    } else line('Hard tests', 'm-tests', 'not run by Epoch.', true);
    var ar = D.arena_leaderboard;
    if (ar && ar.latest_top) {
      var cols = ar.latest_columns, top = ar.latest_top.concat(ar.latest_top_open || []).map(function (r) { var o = {}; cols.forEach(function (c, i) { o[c] = r[i]; }); return o; });
      var ma = top.filter(function (r) { return isMine(r.org, id); });
      if (ma.length) { var ba = best(ma, 'rating'); line('Arena votes', 'ovc', 'best rating ' + ba.rating + ' (' + modelName(ba.model) + ', ' + ba.lo + ' to ' + ba.hi + '), rank ' + ba.rank + ' on ' + fmtDate(ar.latest_snapshot, true) + '.'); }
      else line('Arena votes', 'ovc', 'not in the top 30, or the top 10 open models, of the latest snapshot.', true);
    }
    var metr = D.metr_time_horizon;
    if (metr) {
      var vs = metr.coverage.numbers.versions, found = vs.map(function (v) {
        var nn = Object.keys(v.orgs).filter(function (o) { return isMine(o, id); }).reduce(function (s, o) { return s + v.orgs[o]; }, 0);
        return nn ? nn + ' in ' + v.version : null;
      }).filter(Boolean);
      line('METR time horizon', 'm-metr', found.length ? 'models measured: ' + found.join(', ') + ' (numbers on METR\'s page).' : 'not measured by METR.', !found.length);
    }
    var sales = objs(D.epoch_chip_sales).filter(function (r) { return isMine(r.designer, id) && !r.incomplete; });
    if (sales.length) { var ls = sales.sort(function (a, b2) { return b2.quarter_end.localeCompare(a.quarter_end); })[0]; line('Chips shipped', 'm-shipped', compact(ls.q_median) + ' H100e shipped in the quarter to ' + fmtDate(ls.quarter_end) + '; ' + compact(ls.cum_median) + ' since ' + fmtDate(ls.start) + '.'); }
    var rev = objs(D.epoch_ai_companies).filter(function (r) { return isMine(r.company, id); });
    if (rev.length) { var lr = rev.sort(function (a, b2) { return b2.date.localeCompare(a.date); })[0]; line('Revenue', 'm-revenue', usd(lr.annualized_usd) + ' a year (' + fmtDate(lr.date) + ', ' + sourceTypes(lr.source_type) + ').'); }
    else line('Revenue', 'm-revenue', 'no reported AI revenue figure.', true);
    h('p', 'kind', 'Links checked ' + fmtDate(P.checked, true) + '. Their own words are how they describe themselves, not a strategy we have written for them.', box);
  }
  function writeHash() {
    var parts = [];
    if (state.player) parts.push('player=' + state.player);
    if (state.ext) parts.push('ext=1');
    try { history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search); } catch (e) { /* file:// */ }
  }
  function setPlayer(id, scroll) {
    state.player = id || null;
    var sel = $('#player-select'); if (sel.value !== (id || '')) sel.value = id || '';
    writeHash();
    refreshAll();
    if (scroll && id) $('#player').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------------- 6. sources and method ---------------- */
  function renderSources() {
    var tb = $('#sources tbody'); tb.textContent = '';
    IDS.forEach(function (id) {
      var d = D[id]; if (!d) return;
      var src = S.sources[id] || {};
      var tr = h('tr', null, null, tb);
      var td = h('td', null, null, tr); link(sourceHref(d), d.name, td, true);
      h('td', null, d.source + (d.authors ? ', by ' + d.authors : ''), tr);
      var tl = h('td', null, null, tr); link(d.licence_url || d.page, d.licence, tl, true);
      var tk = h('td', null, null, tr), kd = h('details', 'changes', null, tk);
      h('summary', null, d.redistribution === 'link-only' ? 'link only' : 'copied, with changes', kd);
      h('p', null, d.changes || '', kd);
      h('td', null, fmtDate(src.newest_data, true) + (src.newest_note ? ' (' + src.newest_note + ')' : ''), tr);
      h('td', null, fmtDate(d.fetched_at, true), tr);
      var tf = h('td', null, null, tr); link('data/' + id + '.json', 'data', tf); txt(tf, ' · '); link('scripts/fetch_' + id + '.py', 'fetcher', tf);
    });
  }

  /* ---------------- boot ---------------- */
  function initControls() {
    var sel = $('#player-select');
    P.players.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (p) {
      var o = h('option', null, p.name, sel); o.value = p.id;
    });
    sel.addEventListener('change', function () { setPlayer(sel.value, false); });
    $('#clear').addEventListener('click', function () { setPlayer(null); });
    var ext = $('#ext');
    ext.addEventListener('change', function () { state.ext = ext.checked; writeHash(); refreshAll(); });
    var m = /player=([a-z0-9_-]+)/.exec(location.hash);
    if (m && playerById[m[1]]) state.player = m[1];
    if (/(^#|&)ext=1/.test(location.hash)) { state.ext = true; ext.checked = true; }
    sel.value = state.player || '';
  }
  function initTheme() {
    var root = document.documentElement, btns = document.querySelectorAll('.theme button');
    function apply(t) {
      if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === (t || 'auto'))); });
    }
    var saved = null;
    try { saved = localStorage.getItem('soa-theme'); } catch (e) { /* storage blocked */ }
    apply(saved);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.t === 'auto' ? null : b.dataset.t;
        try { if (t) localStorage.setItem('soa-theme', t); else localStorage.removeItem('soa-theme'); } catch (e) { /* ignore */ }
        apply(t); if (cards.length) refreshAll();
      });
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (cards.length) refreshAll(); });
  }

  function load(name) {
    return fetch('data/' + name + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(name + ': HTTP ' + r.status);
      return r.json();
    });
  }
  initTheme();
  Promise.all([load('summary'), load('players')].concat(IDS.map(function (id) {
    return load(id).catch(function () { return null; });
  }))).then(function (res) {
    S = res[0]; P = res[1];
    IDS.forEach(function (id, i) { D[id] = res[i + 2]; });
    initPlayers();
    initControls();
    document.querySelectorAll('.loading').forEach(function (n) { n.remove(); });
    renderDisagree();
    renderSpeed();
    renderOpenClosed();
    var inputs = $('#g-inputs .cards'), cap = $('#g-capability .cards'), money = $('#g-money .cards');
    [[renderCompute, inputs], [renderShipped, inputs], [renderOwners, inputs], [renderHardware, inputs],
     [renderEci, cap], [renderTests, cap], [renderMetr, cap], [renderRevenue, money], [renderCost, money]].forEach(function (f) {
      try { f[0](f[1]); } catch (e) { h('p', 'err', 'This card could not be drawn: ' + e.message, f[1]); if (window.console) console.error(e); }
    });
    renderSources();
    renderPlayerPanel();
    if (state.player) refreshAll();
    if (location.hash && !/player=/.test(location.hash)) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(function (e) {
    document.querySelectorAll('.loading').forEach(function (n) { n.textContent = 'The data could not be loaded (' + e.message + ').'; n.classList.add('err'); });
  });
})();
