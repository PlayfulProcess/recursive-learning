/* The Recursive Tarot — the ONE recursive.eco assistant sidebar.
   <script src="assistant.js" defer></script>   (../assistant.js from pages/ or viewers/)

   NOT a copy of the assistant: this only loads the shared shell,
   https://recursive.eco/js/assistant-launcher.js, which iframes the flow app's
   /assistant embed — the exact same star FAB and tabbed sidebar (Chat · Tarot ·
   I Ching · Astro · Story, same icon bars) every recursive.eco page mounts.
   When the pattern changes in the app, this site follows automatically —
   nothing here to keep in sync. Auth carries too: learning.recursive.eco is a
   .recursive.eco subdomain, so the signed-in session flows into the iframe.
   This file IS the pattern source for the family: recursive-astrology's own
   assistant.js is modeled on this one (its header comment says so). Keep the
   two in sync by hand when the pattern evolves — there's no shared package. */
(function () {
  // Never render inside an embed: some viewer pages iframe other viewer pages
  // (e.g. pages/course-viewer.html embeds viewers/genealogy-tree.html and
  // viewers/timeline.html with ?embed=1) — this guard keeps the shared shell
  // from double-mounting inside those frames. Same rule site-header.js /
  // site-footer.js apply. (Jul 15 2026: the last hand-rolled assistant widgets
  // — viewers/cards.html, viewers/tree-viewer.html, pages/course-viewer.html —
  // were retired in favour of this shared shell; every page now mounts the
  // same star FAB from here and nothing else.)
  if (window.self !== window.top) return;
  if (new URLSearchParams(location.search).get('embed') === '1') return;

  // Aug 11 2026: static viewer pages (viewers/cards.html, viewers/tree-viewer.html,
  // viewers/caster-studio.html, …) link to grammars via ?src=../grammars/<slug>/grammar.json
  // — never ?grammar_id= or ?id= (see viewers/tree-viewer.html's own comment: "the src
  // path is always ../grammars/<slug>/grammar.json, the form every link on this site uses").
  // buildSrc() below only ever looked for grammar_id/id, so on those pages it fell through
  // to the generic page_title/page_url branch with no idea a grammar was even open — this
  // is why, on cards.html?src=../grammars/bus-passengers/grammar.json, asking about "item
  // 36-38" got "tell me the name of the deck you're working with" back. Fix: read the slug
  // out of ?src= ourselves, and resolve it to the app's grammar UUID via grammars/_eco_ids.json
  // (the exact mapping viewers/tree-viewer.html's resolveStaticSrcForId/setupCopyButton
  // already use for the same slug↔UUID problem) — riding the grammar_id channel that
  // already exists and already works, not a new one. Started here (not inside buildSrc)
  // so the fetch has the whole assistant-launcher.js network round-trip to resolve before
  // buildSrc is ever called.
  var srcSlug = (function () {
    try {
      var src = new URLSearchParams(location.search).get('src') || '';
      var m = /grammars\/([^/]+)\/grammar\.json/.exec(src);
      return m ? m[1] : '';
    } catch (_) { return ''; }
  })();
  var srcGrammarId = ''; // filled in below if the ?src= slug resolves to a known app UUID
  if (srcSlug) {
    var _segs = location.pathname.split('/').filter(Boolean);
    var _PFX = '../'.repeat(Math.max(0, _segs.length - 1)); // same depth formula as site-footer.js's PFX
    fetch(_PFX + 'grammars/_eco_ids.json').then(function (r) { return r.json(); }).then(function (j) {
      srcGrammarId = (j && j.ids && j.ids[srcSlug]) || '';
    }).catch(function () { /* offline / 404 — page_title fallback below still names the slug */ });
  }
  function titleCaseSlug(slug) {
    return String(slug || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  }

  var s = document.createElement('script');
  s.src = 'https://recursive.eco/js/assistant-launcher.js';
  s.defer = true;
  s.onload = function () {
    if (!window.RecursiveAssistant) return;
    window.RecursiveAssistant.init({
      // Declare explicitly rather than relying on the launcher's background-
      // luminance guess: this site is light-only by policy (CLAUDE.md "Theme
      // & colour" — light backgrounds, no dark stages, ever), so there's no
      // ambiguity to auto-detect.
      theme: 'light',
      buildSrc: function () {
        var params = new URLSearchParams(location.search);
        var grammarId = params.get('grammar_id') || params.get('id') || srcGrammarId || '';
        // A page can declare its own embed context (e.g. the Spread Caster sets
        // data-assistant-context="spread-builder") so the flow side knows where it's
        // hosted. Pages that don't set it keep the previous behaviour.
        var pageCtx = (document.body && document.body.getAttribute('data-assistant-context')) || '';
        var qs = new URLSearchParams();
        if (grammarId) {
          // A grammar is on the page (either a real ?grammar_id=/?id=, or resolved above
          // from a static ?src= link): the assistant grounds "this grammar" on it.
          qs.set('grammar_id', grammarId);
          qs.set('context', pageCtx || 'learning');
        } else {
          // No grammar_id available (no grammar on the page, or the grammars/_eco_ids.json
          // lookup above hasn't resolved / has no entry for this slug yet). Pass page
          // context so "what is this page?" just works — and if we at least know the
          // SLUG from ?src=, name it explicitly in the title so "what grammar is this?"
          // also works without the UUID: "The user is on <page> viewing the grammar
          // <slug>" is exactly document.title once this runs.
          var title = document.title || 'The Recursive Tarot';
          if (srcSlug) title = titleCaseSlug(srcSlug) + ' — ' + title;
          qs.set('page_title', title);
          qs.set('page_url', location.href);
          var ctx = pageCtx || (srcSlug ? 'learning' : '');
          if (ctx) qs.set('context', ctx);
        }
        return window.RecursiveAssistant.flowBaseUrl() + '/assistant?' + qs.toString();
      }
    });
  };
  document.head.appendChild(s);

  // Jul 9 2026 fix, carried over from recursive-astrology's assistant.js —
  // header-over-assistant overlap. Root cause, confirmed by reading the shared
  // launcher's actual source (recursive-eco/apps/landing/js/assistant-launcher.js):
  // `.rec-assistant-shell` is z-index:45, LOWER than this site's own sticky
  // <site-header> (site-header.js, z-index:50). Both are position:fixed/sticky
  // elements competing directly at the document root, so whichever has the
  // bigger number paints on top — no stacking-context trap involved.
  // site-header.js also auto-hides on scroll-down and *reveals* on scroll-up (a
  // normal reading gesture), which re-plants the header at top:0 while the
  // assistant panel (position:fixed, unaffected by page scroll) is open — at
  // that moment the header's opaque background paints over the assistant's
  // top ~129px, covering the first lines of whatever response is scrolled to
  // the top. recursive-tarot's site-header.js has the identical sticky/
  // z-index:50/auto-hide-reveal pattern (confirmed by reading it), so the same
  // bug applies here too.
  //
  // The correct long-term fix is bumping z-index in the shared launcher itself
  // (it's meant to be the topmost layer on every recursive.eco family site) —
  // that lives in a different, private repo and needs its own session/approval.
  // Until then, force it here so this site is never affected regardless of the
  // shared file's current value or load order.
  var zfix = document.createElement('style');
  zfix.textContent = '.rec-assistant-shell{z-index:2147483000!important}';
  document.head.appendChild(zfix);

  // Jul 15 2026: on course-viewer.html the mobile table-of-contents button
  // (.mobile-toc-button, bottom-left, static markup) and this shared assistant
  // FAB (bottom-right) are meant to sit at the same height — but the shared
  // shell mounts with its own `bottom`, which doesn't necessarily match. Read
  // the TOC button's actual computed offset (rather than hardcoding a value
  // that could drift out of sync with its CSS) and apply it to the shell once
  // the shell appears. No-op on pages with no TOC button.
  var toc = document.querySelector('.mobile-toc-button');
  if (toc) {
    var tocBottom = getComputedStyle(toc).bottom;
    if (tocBottom && tocBottom !== 'auto') {
      var alignTries = 0;
      var alignTimer = setInterval(function () {
        var shell = document.querySelector('.rec-assistant-shell');
        if (shell) {
          shell.style.setProperty('bottom', tocBottom, 'important');
          clearInterval(alignTimer);
        } else if (++alignTries > 40) {
          clearInterval(alignTimer); // ~10s: shell never mounted, give up quietly
        }
      }, 250);
    }
  }
})();
