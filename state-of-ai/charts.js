/* charts.js: the small SVG chart kit for the State of AI page. No library, no build.
 *
 * Four chart shapes, all redrawn on resize and on theme or player change:
 *   xyChart        time on x; linear or log y; layers of bands, lines, steps, rules, whiskers, dots
 *   columnsChart   stacked columns (one per period), 2px surface gaps between parts
 *   hbarsChart     stacked horizontal bars (one per row)
 *   intervalChart  a dot and its 90% interval per row, on a log axis
 *
 * Every chart: hover or tap shows a tooltip (values first, then labels); the keyboard reaches
 * every mark (Tab to the chart, arrow keys to move, Enter to open, Escape to close); a click
 * calls spec.onPick. Labels always go in with textContent, never innerHTML. Colours are CSS
 * custom properties, so light and dark mode are each their own validated steps.
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function lin(d0, d1, r0, r1) {
    var k = (r1 - r0) / ((d1 - d0) || 1);
    var f = function (v) { return r0 + (v - d0) * k; };
    f.inv = function (p) { return d0 + (p - r0) / k; };
    return f;
  }
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function linTicks(a, b, n) {
    var s = niceStep(b - a, n), out = [];
    for (var v = Math.ceil(a / s - 1e-9) * s; v <= b + s * 1e-9; v += s) out.push(+v.toFixed(10));
    return out;
  }
  function logTicks(a, b, n) {
    var lo = Math.ceil(a - 1e-9), hi = Math.floor(b + 1e-9), step = 1, out = [];
    while ((hi - lo) / step + 1 > n) step++;
    for (var k = lo; k <= hi; k += step) out.push(k);
    return out;
  }
  function yearTicks(a, b, n) {
    var lo = Math.ceil(a - 1e-9), hi = Math.floor(b + 1e-9), steps = [1, 2, 5, 10, 20, 25, 50], step = 1;
    for (var i = 0; i < steps.length; i++) { step = steps[i]; if ((hi - lo) / step + 1 <= n) break; }
    var out = [];
    for (var y = Math.ceil(lo / step) * step; y <= hi; y += step) out.push(y);
    return out;
  }
  function textWidth(s, px) { return String(s).length * (px || 11) * 0.58; }

  /* ---------- tooltip + keyboard shared by every chart ---------- */
  function Interactive(host, spec) {
    this.host = host; this.spec = spec;
    this.tt = h('div', 'tt'); this.tt.setAttribute('role', 'status'); this.tt.setAttribute('aria-live', 'polite');
    host.appendChild(this.tt);
    this.idx = -1; this.marks = [];
  }
  Interactive.prototype.show = function (m) {
    var tt = this.tt, spec = this.spec;
    tt.textContent = '';
    var info = (m.tip || spec.tooltip)(m.d);
    if (!info) return this.hide();
    if (info.value != null) h('div', 'tv', info.value, tt);
    (info.rows || []).forEach(function (r) {
      var row = h('div', 'row', null, tt);
      if (r.color) { var k = h('span', 'lk', null, row); k.style.background = r.color; }
      h('span', r.strong ? 'tv' : '', r.value, row);
      if (r.label) h('span', 'tl', r.label, row);
    });
    (info.lines || []).forEach(function (s) { h('div', 'tl', s, tt); });
    tt.classList.add('on');
    var W = this.host.clientWidth, tw = tt.offsetWidth, th = tt.offsetHeight;
    var x = m.px + 14, y = m.py - th - 10;
    if (x + tw > W) x = Math.max(0, m.px - tw - 14);
    if (y < 0) y = m.py + 14;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
    if (this.ring) {
      this.ring.setAttribute('cx', m.px); this.ring.setAttribute('cy', m.py);
      this.ring.setAttribute('r', (m.r || 4) + 5); this.ring.style.display = '';
    }
  };
  Interactive.prototype.hide = function () {
    this.tt.classList.remove('on');
    if (this.ring) this.ring.style.display = 'none';
  };
  // svg-level listeners are bound once; the overlay is rebuilt on every draw
  Interactive.prototype.bindSvg = function (svg) {
    var self = this, spec = this.spec;
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', function (ev) {
      var n = self.marks.length;
      if (!n) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { self.idx = (self.idx + 1) % n; }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { self.idx = (self.idx - 1 + n) % n; }
      else if (ev.key === 'Home') self.idx = 0;
      else if (ev.key === 'End') self.idx = n - 1;
      else if (ev.key === 'Enter' || ev.key === ' ') {
        if (self.idx >= 0 && self.idx < n && spec.onPick) spec.onPick(self.marks[self.idx].d);
        ev.preventDefault(); return;
      } else if (ev.key === 'Escape') { self.hide(); return; }
      else return;
      ev.preventDefault();
      self.show(self.marks[self.idx]);
    });
    svg.addEventListener('blur', function () { self.hide(); });
  };
  Interactive.prototype.attach = function (svg, overlay, nearest) {
    var self = this, spec = this.spec, downAt = null;
    if (self.idx >= self.marks.length) self.idx = -1;
    function local(ev) { var r = svg.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    overlay.addEventListener('pointermove', function (ev) {
      var p = local(ev), m = nearest(p[0], p[1]);
      if (m) { self.idx = self.marks.indexOf(m); self.show(m); } else self.hide();
    });
    overlay.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') self.hide(); });
    overlay.addEventListener('pointerdown', function (ev) { downAt = local(ev); });
    overlay.addEventListener('pointerup', function (ev) {
      var p = local(ev);
      if (!downAt || Math.abs(p[0] - downAt[0]) > 8 || Math.abs(p[1] - downAt[1]) > 8) return;
      var m = nearest(p[0], p[1]);
      if (m) { self.show(m); if (spec.onPick) spec.onPick(m.d); }
    });
  };

  function frame(host, spec) {
    host.classList.add('chart');
    host.textContent = '';
    var inter = new Interactive(host, spec);
    var svg = el('svg', { role: 'group', 'aria-label': spec.aria || '' });
    host.insertBefore(svg, inter.tt);
    inter.bindSvg(svg);
    return { svg: svg, inter: inter };
  }

  function observe(host, draw) {
    var last = 0, raf = 0;
    draw();
    if (!('ResizeObserver' in global)) { global.addEventListener('resize', draw); return; }
    new ResizeObserver(function () {
      var w = host.clientWidth;
      if (Math.abs(w - last) < 2) return;
      last = w;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    }).observe(host);
  }

  function klass(spec, d, base) {
    var c = base || '';
    if (spec.markClass) { var k = spec.markClass(d); if (k) c += ' ' + k; }
    return c;
  }

  /* ---------- xyChart ---------- */
  function xyChart(host, spec) {
    var f = frame(host, spec), svg = f.svg, inter = f.inter;
    function draw() {
      var W = Math.max(240, host.clientWidth), H = typeof spec.height === 'function' ? spec.height(W) : (spec.height || 280);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
      var ylog = !!spec.y.log;
      var Y = function (v, logged) { return ylog && !logged ? Math.log10(v) : v; };
      var y0 = ylog ? Math.log10(spec.y.min) : spec.y.min, y1 = ylog ? Math.log10(spec.y.max) : spec.y.max;
      var nT = H < 240 ? 4 : 6;
      var yt = ylog ? logTicks(y0, y1, nT) : linTicks(y0, y1, nT);
      var yfmt = function (t) { return spec.y.fmt(ylog ? Math.pow(10, t) : t); };
      var ml = 8 + Math.max.apply(null, yt.map(function (t) { return textWidth(yfmt(t)); }));
      var mr = spec.marginRight != null ? spec.marginRight(W) : 12, mt = 12, mb = 24;
      var x = lin(spec.x.min, spec.x.max, ml, W - mr), y = lin(y0, y1, H - mb, mt);
      var g = el('g', null, svg);
      // grid and axes
      var ga = el('g', { 'class': 'axis' }, g);
      yt.forEach(function (t) {
        el('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), 'class': 'gridline' }, ga);
        var tx = el('text', { x: ml - 6, y: y(t) + 3.5, 'text-anchor': 'end' }, ga); tx.textContent = yfmt(t);
      });
      var xt = spec.x.ticks ? spec.x.ticks : yearTicks(spec.x.min, spec.x.max, Math.max(3, Math.floor((W - ml - mr) / 62)));
      xt.forEach(function (t) {
        var tx = el('text', { x: x(t), y: H - 6, 'text-anchor': 'middle' }, ga);
        tx.textContent = spec.x.fmt ? spec.x.fmt(t) : String(t);
      });
      el('line', { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, 'class': 'baseline' }, ga);
      if (spec.y.title) { var tt = el('text', { x: ml, y: mt - 2, 'class': 'axis-title' }, ga); tt.textContent = spec.y.title; }
      var clipId = 'c' + Math.random().toString(36).slice(2);
      var cp = el('clipPath', { id: clipId }, el('defs', null, svg));
      el('rect', { x: ml, y: mt - 6, width: W - ml - mr, height: H - mb - mt + 12 }, cp);
      var plot = el('g', { 'clip-path': 'url(#' + clipId + ')' }, g);
      var marks = [];
      (spec.layers || []).forEach(function (L) {
        if (L.hidden) return;
        var lg = L.logged;
        if (L.type === 'band' && L.data.length) {
          var top = L.data.map(function (p) { return x(p[0]) + ',' + y(Y(p[2], lg)); });
          var bot = L.data.slice().reverse().map(function (p) { return x(p[0]) + ',' + y(Y(p[1], lg)); });
          el('polygon', { points: top.concat(bot).join(' '), 'class': L.cls || 'trend-band' }, plot);
        } else if (L.type === 'line' && L.data.length) {
          var pl = el('polyline', { points: L.data.map(function (p) { return x(p[0]) + ',' + y(Y(p[1], lg)); }).join(' '),
            'class': L.cls || 'series-line' }, plot);
          if (L.color) pl.style.stroke = L.color;
          if (L.label) {
            var lp = L.data[L.data.length - 1];
            var lt = el('text', { x: Math.min(x(lp[0]) + 4, W - mr - 2), y: y(Y(lp[1], lg)) - 6, 'class': L.labelCls || 'ext-label',
              'text-anchor': x(lp[0]) + 4 > W - mr - 60 ? 'end' : 'start' }, g);
            lt.textContent = L.label;
          }
        } else if (L.type === 'steps' && L.data.length) {
          var pts = [], prev = null;
          L.data.forEach(function (p) {
            var px = x(p[0]), py = y(Y(p[1], lg));
            if (prev) pts.push(px + ',' + prev);
            pts.push(px + ',' + py); prev = py;
          });
          if (L.extendTo != null && prev != null) pts.push(x(L.extendTo) + ',' + prev);
          var sp = el('polyline', { points: pts.join(' '), 'class': 'step-line' }, plot);
          sp.style.stroke = L.color;
          if (L.opacity) sp.style.opacity = L.opacity;
        } else if (L.type === 'rule') {
          var ry = y(Y(L.y, lg));
          el('line', { x1: ml, x2: W - mr, y1: ry, y2: ry, 'class': 'rule' }, g);
          if (L.label) { var rt = el('text', { x: W - mr, y: ry - 4, 'text-anchor': 'end', 'class': 'rule-label' }, g); rt.textContent = L.label; }
        } else if (L.type === 'vrule') {
          var rx = x(L.x);
          el('line', { x1: rx, x2: rx, y1: mt, y2: H - mb, 'class': 'rule' }, g);
          if (L.label) { var vt = el('text', { x: rx + 4, y: mt + 10, 'class': 'rule-label' }, g); vt.textContent = L.label; }
        } else if (L.type === 'whiskers') {
          L.data.forEach(function (d) {
            if (d.lo == null || d.hi == null) return;
            var wl = el('line', { x1: x(d.x), x2: x(d.x), y1: y(Y(d.lo, lg)), y2: y(Y(d.hi, lg)), 'class': klass(spec, d, 'whisker') }, plot);
            wl.style.stroke = d.color;
          });
        } else if (L.type === 'points') {
          L.data.forEach(function (d) {
            if (d.y == null || (ylog && !(d.y > 0) && !lg)) return;
            var px = x(d.x), py = y(Y(d.y, lg)), r = d.r || L.r || 4;
            if (!L.invisible) {  // an invisible layer is hover and keyboard targets only (dense lines)
              var c = el('circle', { cx: px, cy: py, r: r, 'class': klass(spec, d, 'dot' + (d.hollow ? ' hollow' : '')) }, plot);
              c.style.fill = d.color; if (d.hollow) c.style.stroke = d.color;
            }
            if (L.hit !== false) marks.push({ d: d, px: px, py: py, r: r, tip: L.tooltip });
          });
        } else if (L.type === 'labels') {
          L.data.forEach(function (d) {
            var t = el('text', { x: x(d.x) + (d.dx || 0), y: y(Y(d.y, lg)) + (d.dy || 0), 'text-anchor': d.anchor || 'start',
              'class': klass(spec, d, 'lbl' + (d.muted ? ' muted' : '')) }, g);
            t.textContent = d.text;
          });
        }
      });
      marks.sort(function (a, b) { return a.px - b.px || a.py - b.py; });
      inter.marks = marks;
      inter.ring = el('circle', { 'class': 'focusring', r: 9 }, g); inter.ring.style.display = 'none';
      var ov = el('rect', { x: ml, y: 0, width: W - ml - mr, height: H - mb + 6, 'class': 'hit' }, svg);
      inter.attach(svg, ov, function (px, py) {
        var best = null, bd = spec.crosshair ? 1e9 : 30 * 30;
        marks.forEach(function (m) {
          var dx = m.px - px, dy = m.py - py, dd = spec.crosshair ? dx * dx : dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = m; }
        });
        return best;
      });
    }
    observe(host, draw);
    return { redraw: draw };
  }

  /* ---------- columnsChart: stacked columns ---------- */
  function columnsChart(host, spec) {
    var f = frame(host, spec), svg = f.svg, inter = f.inter;
    function draw() {
      var W = Math.max(240, host.clientWidth), H = spec.height || 260;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
      var cats = spec.categories, maxV = 0;
      cats.forEach(function (c) { var t = 0; c.parts.forEach(function (p) { t += p.value || 0; }); c.total = t; maxV = Math.max(maxV, t); });
      var yt = linTicks(0, maxV * 1.05, 5);
      var ml = 8 + Math.max.apply(null, yt.map(function (t) { return textWidth(spec.y.fmt(t)); })), mr = 8, mt = (spec.markers && spec.markers.length) ? 42 : 14, mb = 24;
      var y = lin(0, yt[yt.length - 1], H - mb, mt);
      var band = (W - ml - mr) / cats.length, bw = Math.min(24, band * 0.72);
      var g = el('g', null, svg), ga = el('g', { 'class': 'axis' }, g);
      yt.forEach(function (t) {
        el('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), 'class': 'gridline' }, ga);
        var tx = el('text', { x: ml - 6, y: y(t) + 3.5, 'text-anchor': 'end' }, ga); tx.textContent = spec.y.fmt(t);
      });
      if (spec.y.title) { var at = el('text', { x: ml, y: mt - 4, 'class': 'axis-title' }, ga); at.textContent = spec.y.title; }
      var marks = [];
      cats.forEach(function (c, i) {
        var cx = ml + band * i + band / 2, acc = 0;
        if (c.tick) { var tx = el('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, ga); tx.textContent = c.tick; }
        var n = c.parts.filter(function (p) { return p.value > 0; }).length, k = 0;
        c.parts.forEach(function (p) {
          if (!(p.value > 0)) return;
          k++;
          var y0 = y(acc), y1 = y(acc + p.value); acc += p.value;
          var top = k === n, hgt = Math.max(0, y0 - y1);
          var path = top ? roundedTop(cx - bw / 2, y1, bw, hgt, Math.min(4, hgt)) : null;
          var s = top ? el('path', { d: path, 'class': klass(spec, p, 'seg') }, g)
                      : el('rect', { x: cx - bw / 2, y: y1, width: bw, height: hgt, 'class': klass(spec, p, 'seg') }, g);
          s.style.fill = p.color;
          if (c.incomplete || p.incomplete) s.style.fillOpacity = 0.45;
        });
        marks.push({ d: c, px: cx, py: y(c.total), r: 2 });
      });
      el('line', { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, 'class': 'baseline' }, ga);
      // markers: where counting changes (a solid hairline before that period, labelled)
      (spec.markers || []).forEach(function (mk, j) {
        var i = cats.map(function (c) { return c.key; }).indexOf(mk.key);
        if (i < 0) return;
        var mx = ml + band * i;
        el('line', { x1: mx, x2: mx, y1: mt + 2, y2: H - mb, 'class': 'rule' }, g);
        var lines = String(mk.label).split('|');
        lines.forEach(function (ln, k) {
          var right = mx > (W - mr) * 0.62;
          var t = el('text', { x: right ? mx - 4 : mx + 4, y: 11 + k * 13, 'text-anchor': right ? 'end' : 'start', 'class': 'rule-label' }, g);
          t.textContent = ln;
        });
      });
      inter.marks = marks;
      inter.ring = null;
      var ov = el('rect', { x: ml, y: 0, width: W - ml - mr, height: H, 'class': 'hit' }, svg);
      inter.attach(svg, ov, function (px) {
        var i = Math.floor((px - ml) / band);
        return marks[Math.max(0, Math.min(marks.length - 1, i))];
      });
    }
    observe(host, draw);
    return { redraw: draw };
  }
  function roundedTop(x, y, w, hgt, r) {
    if (hgt <= 0) return '';
    r = Math.min(r, w / 2, hgt);
    return 'M' + x + ',' + (y + hgt) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + hgt) + 'Z';
  }

  /* ---------- hbarsChart: stacked horizontal bars, label above each bar ---------- */
  function hbarsChart(host, spec) {
    var f = frame(host, spec), svg = f.svg, inter = f.inter;
    function draw() {
      var W = Math.max(240, host.clientWidth), rows = spec.rows, rowH = 40, mt = 6, H = mt + rows.length * rowH + 22;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
      var maxV = 0;
      rows.forEach(function (r) { var t = 0; r.parts.forEach(function (p) { t += p.value || 0; }); r.total = t; maxV = Math.max(maxV, t); });
      var ml = 0, mr = 64, x = lin(0, maxV, ml, W - mr), g = el('g', null, svg), marks = [];
      var xt = linTicks(0, maxV, Math.max(3, Math.floor(W / 120)));
      var ga = el('g', { 'class': 'axis' }, g);
      xt.forEach(function (t) {
        if (x(t) > W - mr + 1) return;
        el('line', { x1: x(t), x2: x(t), y1: mt, y2: H - 20, 'class': 'gridline' }, ga);
        var tx = el('text', { x: x(t), y: H - 6, 'text-anchor': t === 0 ? 'start' : 'middle' }, ga); tx.textContent = spec.x.fmt(t);
      });
      rows.forEach(function (r, i) {
        var top = mt + i * rowH, by = top + 17, bh = 16, acc = 0;
        var lt = el('text', { x: 0, y: top + 12, 'class': klass(spec, r, 'lbl') }, g); lt.textContent = r.label;
        var n = r.parts.filter(function (p) { return p.value > 0; }).length, k = 0;
        r.parts.forEach(function (p) {
          if (!(p.value > 0)) return;
          k++;
          var x0 = x(acc), w = Math.max(0, x(acc + p.value) - x0); acc += p.value;
          var s = k === n ? el('path', { d: roundedRight(x0, by, w, bh, Math.min(4, w)), 'class': klass(spec, r, 'seg') }, g)
                          : el('rect', { x: x0, y: by, width: w, height: bh, 'class': klass(spec, r, 'seg') }, g);
          s.style.fill = p.color;
          marks.push({ d: { row: r, part: p }, px: x0 + w / 2, py: by + bh / 2, r: 2 });
        });
        var vt = el('text', { x: x(r.total) + 6, y: by + 12, 'class': klass(spec, r, 'lbl muted') }, g);
        vt.textContent = spec.x.fmt(r.total);
      });
      el('line', { x1: 0, x2: 0, y1: mt, y2: H - 20, 'class': 'baseline' }, ga);
      inter.marks = marks; inter.ring = null;
      var ov = el('rect', { x: 0, y: 0, width: W, height: H, 'class': 'hit' }, svg);
      inter.attach(svg, ov, function (px, py) {
        var i = Math.floor((py - mt) / rowH), best = null, bd = 1e9;
        marks.forEach(function (m) {
          if (m.d.row !== rows[i]) return;
          var dd = Math.abs(m.px - px);
          if (dd < bd) { bd = dd; best = m; }
        });
        return best;
      });
    }
    observe(host, draw);
    return { redraw: draw };
  }
  function roundedRight(x, y, w, hgt, r) {
    if (w <= 0) return '';
    r = Math.min(r, hgt / 2, w);
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + hgt - r) + 'Q' + (x + w) + ',' + (y + hgt) + ' ' + (x + w - r) + ',' + (y + hgt) + 'H' + x + 'Z';
  }

  /* ---------- intervalChart: dot + 90% interval per row, log x ---------- */
  function intervalChart(host, spec) {
    var f = frame(host, spec), svg = f.svg, inter = f.inter;
    function draw() {
      var W = Math.max(240, host.clientWidth), rows = spec.rows, rowH = 46, headH = 30, mt = 4;
      var tops = [], acc = mt;
      rows.forEach(function (r) { tops.push(acc); acc += r.header ? headH : rowH; });
      var H = acc + 24;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
      var lx0 = Math.log10(spec.x.min), lx1 = Math.log10(spec.x.max), ml = 4, mr = 10;
      var x = lin(lx0, lx1, ml, W - mr), X = function (v) { return x(Math.log10(Math.max(spec.x.min, Math.min(spec.x.max, v)))); };
      var g = el('g', null, svg), ga = el('g', { 'class': 'axis' }, g), marks = [];
      spec.x.ticks.forEach(function (t) {
        el('line', { x1: X(t), x2: X(t), y1: mt, y2: H - 20, 'class': 'gridline' }, ga);
        var tx = el('text', { x: X(t), y: H - 6, 'text-anchor': 'middle' }, ga); tx.textContent = spec.x.fmt(t);
      });
      rows.forEach(function (r, i) {
        var top = tops[i], cy = top + 30;
        if (r.header) {
          var ht = el('text', { x: ml, y: top + 22, 'class': 'grp' }, g); ht.textContent = r.label;
          return;
        }
        var lt = el('text', { x: ml, y: top + 13, 'class': 'lbl' }, g), room = W - ml - mr, lab = r.label;
        // a label wider than the chart is cut with an ellipsis; the tooltip carries it in full
        lt.textContent = lab;
        var fits = function () { var w = lt.getComputedTextLength ? lt.getComputedTextLength() : 0; return !w || w <= room; };
        while (lab.length > 8 && !fits()) {
          lab = lab.slice(0, -2);
          lt.textContent = lab.replace(/[\s,(]+$/, '') + '…';
        }
        r.marks.forEach(function (m, j) {
          var yy = cy + (r.marks.length > 1 ? (j === 0 ? -4 : 4) : 0);
          if (m.lo != null || m.hi != null) {
            var a = X(m.lo != null ? m.lo : m.v), b = m.hi != null ? X(m.hi) : W - mr;
            var ln = el('line', { x1: a, x2: b, y1: yy, y2: yy, 'class': 'whisker' }, g);
            ln.style.stroke = m.color; ln.style.opacity = 0.8;
            if (m.hi == null) {  // open-ended: could be flat
              var ar = el('text', { x: W - mr, y: yy - 3, 'text-anchor': 'end', 'class': 'rule-label' }, g); ar.textContent = 'may be flat';
            }
          }
          if (m.v == null) return;
          var c = el('circle', { cx: X(m.v), cy: yy, r: 5, 'class': 'dot' + (m.hollow ? ' hollow' : '') }, g);
          c.style.fill = m.color; if (m.hollow) c.style.stroke = m.color;
          marks.push({ d: { row: r, mark: m }, px: X(m.v), py: yy, r: 5 });
        });
        if (!r.marks.some(function (m) { return m.v != null; })) {
          var nt = el('text', { x: ml, y: cy + 4, 'class': 'lbl muted' }, g); nt.textContent = r.empty || 'too few points to fit';
        }
      });
      inter.marks = marks;
      inter.ring = el('circle', { 'class': 'focusring', r: 9 }, g); inter.ring.style.display = 'none';
      var ov = el('rect', { x: 0, y: 0, width: W, height: H, 'class': 'hit' }, svg);
      inter.attach(svg, ov, function (px, py) {
        var best = null, bd = 34 * 34;
        marks.forEach(function (m) { var dx = m.px - px, dy = m.py - py, dd = dx * dx + dy * dy * 4; if (dd < bd) { bd = dd; best = m; } });
        return best;
      });
    }
    observe(host, draw);
    return { redraw: draw };
  }

  global.SOACharts = { xyChart: xyChart, columnsChart: columnsChart, hbarsChart: hbarsChart, intervalChart: intervalChart, h: h };
})(window);
