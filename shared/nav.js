/*
 * shared/nav.js: a SHIM onto the one header of learning.recursive.eco.
 *
 * The site header and footer are tarot's, ported: /site-header.js (<site-header>) and
 * /site-footer.js (<site-footer>). Their menu arrays are the only site map. This file exists so
 * the hand-written game pages keep working unedited: they load it as the first thing in <body>,
 *
 *     <script src="../shared/nav.js"></script>     a page one folder down (game/x.html)
 *
 * and it writes, in the browser:
 *   - "Skip to content", the first thing a keyboard reaches, landing on #main (a <main>, .wrap or
 *     .page gets the id if the page forgot it);
 *   - <site-header active="..."> (loading /site-header.js), the tab chosen from the page's path;
 *   - on a page that is one view of a game (The Walk as a table, a story, a dashboard; Hot Potato
 *     with others or alone), a row that switches views and carries the walk in progress (the
 *     #v1;... hash) across;
 *   - <site-footer> at the end (loading /site-footer.js);
 *   - aria-describedby on every link that opens a new tab, so a screen reader says so;
 *   - a link into a closed <details> (/#grammars) opens it.
 * A page generated before this shim (the glossary) carries the OLD build-time header and footer
 * in its HTML; they are removed and replaced, so nothing has to be rebuilt for the new header.
 *
 * In node (scripts/check-links.mjs, scripts/build-glossary.mjs) it exports:
 *   SITE.games   the list of games and their views, the one list of them (play.html and the
 *                header's Games menu must agree with it; scripts/check_all.py asserts that)
 *   header(o) / footer(o) / CSS   build-time helpers that now emit the tarot tags, so a builder
 *                that still calls them gets the new header. New builders write the tags directly:
 *                  <script src="/site-header.js"></script><site-header active="words"></site-header>
 * There is no SITE.sections and no SITE.shelf any more: the sections live in site-header.js.
 *
 * On the dark game pages the tarot footer finds no theme.css tokens and falls back to inherited
 * text colours; that stays until those pages are relit (decision 11).
 *
 * The spiral is her mark; it is drawn by site-header.js and site-footer.js from the path in
 * scripts/mark.svg. No emoji.
 */
(function (factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }   // node
  window.RLNav = api;
  api.mount(document.currentScript);                                                     // a browser
})(function () {
  'use strict';

  /* Every href is relative to the site root. */
  var SITE = {
    name: 'Recursive Eco-Improvement',
    games: [
      { name: 'As-If', href: 'game/as-if.html',
        blurb: 'Cast face down, forecast before you look, then hold the cards as if true and take one step.' },
      { name: 'As-If, first edition', full: 'As-If — HOT POTATO edition', href: 'game/index.html',
        blurb: 'Draw a character, hold it as if it were true, take a step. The reveal is earned, not clicked.' },
      { name: 'The Walk', href: 'game/spread.html', carry: 'v1',
        blurb: 'Cast the table, move the allocation, and watch which ending moves.',
        viewsLabel: 'The Walk, as', viewsIntro: 'One walk, three views:',
        views: [
          { label: 'a table', short: 'as a table', href: 'game/spread.html' },
          { label: 'a story', short: 'as a story', href: 'game/scroll.html', note: 'read down, one year per section' },
          { label: 'a dashboard', short: 'as a dashboard', href: 'game/walk.html', note: 'every gauge and prior laid flat' }
        ] },
      { name: 'Changing Lines', href: 'game/lines.html', tag: 'new and rough',
        blurb: 'The same lesson in six draws from the I Ching’s bowl of sixteen marbles.',
        notes: 'https://github.com/PlayfulProcess/recursive-learning/blob/main/game/DESIGN-changing-lines.md' },
      { name: 'Hot Potato', href: 'game/potato-others.html', tag: 'new and rough',
        blurb: 'The ad made playable with six others in the ring: toss it on, or hold it together.',
        viewsLabel: 'Hot Potato,', viewsIntro: 'Two ways to play:',
        views: [
          { label: 'with others', short: 'with others', href: 'game/potato-others.html' },
          { label: 'alone', short: 'play alone', href: 'game/potato.html', note: 'for careful readers' }
        ],
        notes: 'https://github.com/PlayfulProcess/recursive-learning/blob/main/game/DESIGN-potato.md' },
      { name: 'The Tree', href: 'game/tree-board/index.html', tag: 'new and rough',
        blurb: 'A cooperative board game: place the people on the belief tree before the race runs out.' }
    ]
  };

  /* Only what the shim itself draws: the skip link and the game views row. The header and footer
     style themselves (shadow DOM / theme.css). Tokens fall back through the dark game pages' names. */
  var CSS = [
    ':root{--site-a:var(--accent,var(--eco,#177d56));--site-m:var(--muted,var(--dim,#6b6457));--site-i:var(--ink,#221f1a);--site-l:var(--line,#d8d2c6)}',
    '.site-skip{position:absolute;left:12px;top:-120px;z-index:1000;padding:10px 14px;border-radius:8px;background:#177d56;color:#fff;font:600 14px/1.2 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none}',
    '.site-skip:focus{top:10px}',
    '.site-views{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 16px;box-sizing:border-box;width:100%;max-width:var(--site-max,900px);margin:0 auto;padding:6px 16px 4px;font:400 13px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--site-m)}',
    '.site-views a{display:inline-block;padding:6px 0;color:var(--site-m);text-decoration:none}',
    '.site-views a:hover{color:var(--site-i)}',
    '.site-views a[aria-current]{color:var(--site-i);text-decoration:underline;text-decoration-color:var(--site-a);text-decoration-thickness:2px;text-underline-offset:6px}',
    '.site-vl{font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--site-m)}',
    ':where(a,button,summary,input,select,textarea,[tabindex]:not([tabindex="-1"])):focus-visible{outline:2px solid var(--site-a);outline-offset:2px}'
  ].join('\n');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 'game/' -> 'game/index.html', '' -> 'index.html'; query and hash dropped */
  function norm(p) {
    p = String(p == null ? '' : p).split('#')[0].split('?')[0];
    return (p === '' || /\/$/.test(p)) ? p + 'index.html' : p;
  }
  function url(base, href) { var u = (base || '') + href; return u === '' ? './' : u; }

  /* Where a page sits: rel is its path from the site root ('game/spread.html', 'glossary/').
     `active` is the header tab: one of site-header.js's keys. */
  function where(rel) {
    var r = norm(rel), w = { page: r, active: 'home', game: null, view: null };
    if (r.indexOf('game/') === 0) w.active = 'play';
    else if (r.indexOf('glossary/') === 0) w.active = 'words';
    else if (r.indexOf('map/') === 0) w.active = 'sources';
    SITE.games.forEach(function (g) {
      if (norm(g.href) === r) w.game = g;
      (g.views || []).forEach(function (v) { if (norm(v.href) === r) { w.game = g; w.view = v; } });
    });
    return w;
  }

  /* The views row of a game with several views, or ''. */
  function viewsRow(w, base, max) {
    if (!(w.view && w.game && w.game.views)) return '';
    return '<nav class="site-views" aria-label="' + esc(w.game.name) + ', views"' +
      (max ? ' style="--site-max:' + esc(max) + '"' : '') + '>' +
      '<span class="site-vl">' + esc(w.game.viewsLabel || w.game.name) + '</span>' +
      w.game.views.map(function (v) {
        return '<a href="' + esc(url(base, v.href)) + '"' + (w.game.carry ? ' data-carry="' + esc(w.game.carry) + '"' : '') +
          (v === w.view ? ' aria-current="page"' : '') + '>' + esc(v.label) + '</a>';
      }).join('') + '</nav>';
  }

  /* ---- build time (node): the tarot tags ---- */
  /* o: { base: '' | '../' | '/', rel: this page's path from the root, max } (sprite is ignored) */
  function header(o) {
    o = o || {};
    var w = where(o.rel);
    return '<a class="site-skip" href="#main">Skip to content</a>\n' +
      '<script src="/site-header.js"></script>\n' +
      '<site-header active="' + esc(w.active) + '"></site-header>\n' +
      (w.view ? viewsRow(w, o.base || '', o.max) + '\n' : '');
  }
  function footer() {
    return '<script src="/site-footer.js"></script>\n<site-footer></site-footer>\n';
  }

  /* ---- the browser ---- */
  function mount(script) {
    var d = document;
    var src = (script && script.src) || '';
    var base = src.replace(/shared\/nav\.js(?:[?#].*)?$/, '');   // the site root, as an absolute URL
    var here = location.href.split('#')[0].split('?')[0];
    var rel = base && here.indexOf(base) === 0 ? here.slice(base.length) : '';
    var w = where(rel);

    if (!d.getElementById('site-nav-css')) {
      var st = d.createElement('style'); st.id = 'site-nav-css'; st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
    }
    function load(file, tag) {
      if (window.customElements && customElements.get(tag)) return;
      if (d.querySelector('script[src*="' + file + '"]')) return;
      var s = d.createElement('script'); s.src = base + file;
      (d.head || d.documentElement).appendChild(s);
    }
    // the header generated into a page's HTML before this shim (the glossary): replaced
    function dropLegacy() {
      var old = d.querySelector('header.site-bar#site-header'); if (old) old.remove();
      var oldf = d.querySelector('footer.site-foot#site-footer'); if (oldf) oldf.remove();
      var skips = d.querySelectorAll('a.site-skip');
      for (var i = 1; i < skips.length; i++) skips[i].remove();
    }
    function addHeader() {
      if (!d.body || d.querySelector('site-header')) return;
      dropLegacy();
      var html = (d.querySelector('a.site-skip') ? '' : '<a class="site-skip" href="#main">Skip to content</a>') +
        '<site-header active="' + esc(w.active) + '"></site-header>' + viewsRow(w, base);
      var skip = d.querySelector('a.site-skip');
      if (skip) skip.insertAdjacentHTML('afterend', html); else d.body.insertAdjacentHTML('afterbegin', html);
      load('site-header.js', 'site-header');
    }
    if (d.body) addHeader();

    function ready() {
      if (!d.body) return;
      addHeader();
      if (!d.querySelector('site-footer')) {
        dropLegacy();
        d.body.insertAdjacentHTML('beforeend', '<site-footer></site-footer>');
        load('site-footer.js', 'site-footer');
      }

      // the skip link's target
      if (!d.getElementById('main')) { var m = d.querySelector('main, .wrap, .page'); if (m) m.id = 'main'; }

      // the views row as wide as the page's own column
      var vr = d.querySelector('nav.site-views'), boxes = [d.getElementById('main'), d.querySelector('.wrap'), d.querySelector('.page')], mw = '';
      for (var i = 0; i < boxes.length && !mw; i++) if (boxes[i]) { var x = getComputedStyle(boxes[i]).maxWidth; if (x && x !== 'none') mw = x; }
      if (vr && mw && !vr.style.getPropertyValue('--site-max')) vr.style.setProperty('--site-max', mw);

      // links that open a new tab say so to a screen reader
      if (!d.getElementById('site-newtab')) {
        var nt = d.createElement('span'); nt.id = 'site-newtab'; nt.hidden = true; nt.textContent = '(opens in a new tab)';
        d.body.appendChild(nt);
      }
      function mark(root) {
        if (!root || root.nodeType !== 1) return;
        var list = root.matches && root.matches('a[target="_blank"]') ? [root] : [];
        list = list.concat([].slice.call(root.querySelectorAll('a[target="_blank"]')));
        list.forEach(function (a) { if (!a.hasAttribute('aria-describedby')) a.setAttribute('aria-describedby', 'site-newtab'); });
      }
      mark(d.body);
      if (window.MutationObserver) new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          if (m.type === 'attributes') mark(m.target);
          else [].forEach.call(m.addedNodes, mark);
        });
      }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['target'] });

      openTo(location.hash);
    }

    // a link into a closed <details> (/#grammars) opens it
    function openTo(hash) {
      var id = String(hash || '').slice(1);
      if (!/^[A-Za-z][\w-]*$/.test(id)) return;
      var t = d.getElementById(id), opened = false;
      for (var n = t; n; n = n.parentElement) if (n.tagName === 'DETAILS' && !n.open) { n.open = true; opened = true; }
      if (opened && t.scrollIntoView) t.scrollIntoView();
    }
    window.addEventListener('hashchange', function () { openTo(location.hash); });

    // switching between views of one walk keeps the walk: the pages hold it in the #v1;... hash
    function carry(e) {
      var a = e.target && e.target.closest ? e.target.closest('a[data-carry]') : null;
      if (!a) return;
      var h = location.hash, tag = a.getAttribute('data-carry');
      if (h.indexOf('#' + tag + ';') === 0 || h === '#' + tag) a.href = a.href.split('#')[0] + h;
    }
    ['pointerdown', 'focusin', 'click'].forEach(function (t) { d.addEventListener(t, carry, true); });

    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
  }

  return { SITE: SITE, CSS: CSS, header: header, footer: footer, where: where, mount: mount };
});
