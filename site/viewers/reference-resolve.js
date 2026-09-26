/**
 * Shared repo-local reference resolver.
 *
 * The meta grammar (`grammars/all-decks/grammar.json`, "The Tarot — All Decks, Many
 * Lenses") wires every card item with `metadata.source_deck` (the source deck's repo slug) +
 * `metadata.source_item_id` (the card's id within that deck's own grammar.json) — see
 * `scripts/build_meta_grammar.py` and the cross-link pattern documented in CLAUDE.md. That's
 * the repo-native counterpart of the Supabase-imported copy's `ref_document_id`/`ref_item_id`
 * pointer (wired at import time by the private app's `scripts/import-historical-tarot.mjs`).
 *
 * This module resolves that pointer to the SOURCE card's own content (keywords + sections) by
 * fetching the source deck's grammar.json directly from the repo — no backend, no Supabase call
 * needed, since the source decks live right here in `grammars/<slug>/grammar.json`. Mirrors the
 * semantics of the private app's `apps/flow/src/lib/grammar/reference-resolve.ts` (the
 * `get_grammar_item_text` RPC + source-doc name lookup): resolve whenever the pointer is
 * present, cache per (deck, item), never treat "item already has its own content" as a reason
 * to skip resolution — the meta card's own "Origin" blurb and the resolved source content are
 * additive, not a replace-vs-keep choice.
 *
 * Used by viewers/cards.html (card detail modal), viewers/caster-studio.html (drawn-card detail
 * in a cast/reading), and viewers/tree-viewer.html (tree node detail).
 *
 * ── FRAMING (Jul 27 2026) ─────────────────────────────────────────────────────────────────
 * Resolution alone is not enough: the resolved content used to render with the SAME section
 * markup as the host item's own sections, so one grammar's content read as if it belonged to
 * the other. The reported symptom: opening Pamela Colman Smith in `people-of-tarot` appended
 * "SCENE / SYMBOL / DIVINATORY MEANING / GOLDEN DAWN TITLE / CORRESPONDENCES" from the Golden
 * Dawn Two of Wands straight onto her biography — and, in the other direction, every one of
 * the 78 Golden Dawn cards appended her whole biography ("WHO / CLAIM VS THE RECORD / IN THIS
 * COLLECTION") onto the card.
 *
 * So the embed is now always FRAMED here, in one place, for all three viewers:
 *   - a bounded <details> box, collapsed by default, that names the relationship in its summary
 *     ("Featured card from Golden Dawn Tarot", "About Pamela Colman Smith", …);
 *   - a one-line note saying whose content this is and that it is not part of the host entry;
 *   - a thumbnail + link back to the source item;
 *   - section titles rendered in a visibly secondary style, never the host's section styling.
 * The ONE exception that stays expanded is the aggregator (meta) grammar, whose items are thin
 * pointers — there the resolved entry IS the content (its own sections literally say "Open the
 * source deck for this card's full interpretation").
 *
 * The markup is self-styled with inline styles + theme.css variables (same approach the
 * viewers' own mdToHtml uses) so it looks right in every viewer without a per-viewer CSS block
 * and without a theme.css cache-bust.
 */
(function (global) {
  // slug -> Promise<grammarJson|null>, shared across every resolveSourceItem call on the page.
  const deckGrammarCache = {};

  function loadDeckGrammar(slug) {
    if (!deckGrammarCache[slug]) {
      deckGrammarCache[slug] = fetch('../grammars/' + encodeURIComponent(slug) + '/grammar.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return deckGrammarCache[slug];
  }

  /**
   * @param {string} srcDeck - source deck slug (metadata.source_deck)
   * @param {string} srcItemId - source item id within that deck (metadata.source_item_id)
   * @param {string} [deckLabelHint] - display name to prefer (e.g. metadata.deck), falls back
   *   to the source grammar's own `name`, then the slug — NEVER shows a bare id/uuid.
   * @returns {Promise<{status:'ok', item:object, deckLabel:string, grammar:object}|{status:'error', deckLabel:string|null}>}
   */
  async function resolveSourceItem(srcDeck, srcItemId, deckLabelHint) {
    if (!srcDeck || !srcItemId) {
      return { status: 'error', deckLabel: deckLabelHint || null };
    }
    const g = await loadDeckGrammar(srcDeck);
    const deckLabel = deckLabelHint || (g && g.name) || srcDeck;
    if (!g) return { status: 'error', deckLabel: deckLabelHint || null };
    const item = (g.items || []).find(function (it) { return it.id === srcItemId; });
    if (!item) return { status: 'error', deckLabel };
    return { status: 'ok', item: item, deckLabel: deckLabel, grammar: g };
  }

  // ── Framing ────────────────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // An item's "kind" for framing purposes: metadata.kind wins (people-of-tarot sets it),
  // else the item's category. Never a slug check — the data says what a thing is.
  function kindOf(item) {
    const m = (item && item.metadata) || {};
    return String(m.kind || (item && item.category) || '').toLowerCase();
  }

  const PERSONISH = ['person', 'institution', 'role-group', 'makers', 'patrons', 'occultists', 'scholars', 'institutions',
    'organization', 'lab', 'nonprofit', 'government'];
  // Source kinds only: a term, a mechanism or a moment is not a source, so it falls through to
  // the parallel-entry case below.
  const BOOKISH = ['book', 'lens', 'foundation', 'scholarship', 'occult-revival',
    'paper', 'essay', 'statement', 'report', 'episode', 'podcast'];

  function isPersonish(item) {
    const k = kindOf(item);
    const m = (item && item.metadata) || {};
    return PERSONISH.indexOf(k) !== -1 || PERSONISH.indexOf(String(m.role_group || '').toLowerCase()) !== -1;
  }
  function isBookish(item) {
    return BOOKISH.indexOf(kindOf(item)) !== -1 || !!((item && item.metadata) || {}).author;
  }

  // The aggregator (meta) grammar is the only grammar built by fanning every deck's cards into
  // one document; `_decks` is its unique marker (scripts/build_meta_grammar.py writes it).
  function isAggregatorGrammar(g) {
    return !!(g && g._decks);
  }

  /**
   * Decide how a resolved cross-grammar embed should be introduced.
   * @returns {{kicker:string, note:string, open:boolean, cta:string}}
   */
  function describeEmbed(opts) {
    opts = opts || {};
    const hostItem = opts.hostItem || {};
    const src = opts.sourceItem || {};
    const deckLabel = opts.deckLabel || 'the source grammar';
    const srcName = src.name || '';

    // 1. Aggregator host: the host item is a pointer stub, the embed IS the content.
    if (opts.hostIsAggregator) {
      return {
        kicker: 'Full entry from ' + deckLabel,
        note: '',
        open: true,
        cta: 'View this item in ' + deckLabel,
      };
    }
    // 2. The embed is a person / institution — background on a maker, not card description.
    if (isPersonish(src)) {
      return {
        kicker: 'About ' + (srcName || deckLabel),
        note: 'Background from ' + deckLabel + '. It is their own entry, not part of this item’s description.',
        open: false,
        cta: 'Open this entry in ' + deckLabel,
      };
    }
    // 3. The embed is a book / source text.
    if (isBookish(src)) {
      return {
        kicker: 'Source: ' + (srcName || deckLabel),
        note: 'A source entry from ' + deckLabel + '. It is the source’s own entry, not part of this item’s description.',
        open: false,
        cta: 'Open this source in ' + deckLabel,
      };
    }
    // 4. A person / institution host showing one of the cards that features their work.
    if (isPersonish(hostItem)) {
      return {
        kicker: 'Featured item from ' + deckLabel,
        note: 'Shown as an example. Everything below is the item’s own entry in its grammar, not part of the entry above.',
        open: false,
        cta: 'Open this item in ' + deckLabel,
      };
    }
    // 5. Card ↔ card across two different decks: a parallel entry, shown for comparison.
    return {
      kicker: 'The same idea in ' + deckLabel,
      note: 'A parallel entry in another grammar, shown for comparison. It is that grammar’s text, not this one’s.',
      open: false,
      cta: 'Open this item in ' + deckLabel,
    };
  }

  const SEC_ORDER = ['Scene', 'Symbol', 'Figure', 'Tradition Note', 'History', 'Reading', 'Iconography', 'Research note'];

  function orderedSectionKeys(sections) {
    const s = sections || {};
    const has = function (k) { return s[k] && String(s[k]).trim(); };
    return SEC_ORDER.filter(has).concat(Object.keys(s).filter(function (k) {
      return SEC_ORDER.indexOf(k) === -1 && has(k);
    }));
  }

  /**
   * Render the whole framed embed. Self-styled so every viewer gets the same bounded box.
   *
   * @param {object} o
   * @param {object} o.hostItem      the item whose detail view we're in
   * @param {object} o.sourceItem    the resolved item from the other grammar
   * @param {string} o.deckLabel     human label for the source grammar
   * @param {string} o.href          link to the source item in cards.html
   * @param {boolean} [o.hostIsAggregator]
   * @param {function(string):string} [o.md]  markdown→HTML for section bodies (defaults to escaped text)
   * @returns {string} HTML
   */
  function renderEmbed(o) {
    o = o || {};
    const src = o.sourceItem || {};
    const d = describeEmbed(o);
    const md = typeof o.md === 'function' ? o.md : function (t) { return esc(t).replace(/\n/g, '<br>'); };
    const href = o.href || '';
    const PLUM = '#6d4ab6';

    const boxStyle = 'margin:1.15rem 0 .35rem;border:1px solid rgba(109,74,182,.32);border-left:3px solid ' + PLUM +
      ';border-radius:10px;background:var(--panel2,#faf8f3);overflow:hidden;';
    const sumStyle = 'cursor:pointer;padding:.6rem .8rem;list-style:revert;font-size:.78rem;font-weight:700;' +
      'text-transform:uppercase;letter-spacing:.05em;color:' + PLUM + ';';
    const bodyStyle = 'padding:0 .8rem .8rem;border-top:1px solid rgba(109,74,182,.18);';
    const noteStyle = 'margin:.65rem 0 .8rem;font-size:.78rem;line-height:1.5;font-style:italic;color:var(--ink-soft,#4a4439);';
    const secTitleStyle = 'margin:.75rem 0 .2rem;font-size:.72rem;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.06em;color:' + PLUM + ';opacity:.85;';
    const secBodyStyle = 'font-size:.86rem;line-height:1.6;color:var(--ink-soft,#4a4439);';
    const linkStyle = 'display:inline-block;margin-top:.85rem;font-size:.8rem;color:' + PLUM + ';text-decoration:underline;';

    // The name is appended only when the kicker doesn't already carry it ("About <name>" and
    // "Source text: <name>" do), so the summary never reads "About X — “X”".
    const showName = !!src.name && d.kicker.indexOf(src.name) === -1;
    let h = '<details class="rr-embed"' + (d.open ? ' open' : '') + ' style="' + boxStyle + '">';
    h += '<summary class="rr-embed-summary" style="' + sumStyle + '">' + esc(d.kicker) +
      (showName ? ' <span style="text-transform:none;letter-spacing:0;font-weight:600;">&mdash; &ldquo;' + esc(src.name) + '&rdquo;</span>' : '') +
      '</summary>';
    h += '<div class="rr-embed-body" style="' + bodyStyle + '">';
    if (d.note) h += '<p style="' + noteStyle + '">' + esc(d.note) + '</p>';

    if (src.image_url) {
      h += '<img src="' + esc(src.image_url) + '" alt="' + esc(src.name || '') + '" loading="lazy" ' +
        'style="max-width:120px;width:100%;height:auto;object-fit:contain;background:var(--thumb-bg,#faf8f3);' +
        'border-radius:6px;float:right;margin:0 0 .6rem .8rem;">';
    }
    if (Array.isArray(src.keywords) && src.keywords.length) {
      h += '<p style="font-size:.75rem;color:var(--mut,#6b6457);margin:.2rem 0 .1rem;">' +
        src.keywords.map(esc).join(' &middot; ') + '</p>';
    }
    orderedSectionKeys(src.sections).forEach(function (k) {
      h += '<div style="' + secTitleStyle + '">' + esc(String(k).replace(/_/g, ' ')) + '</div>';
      h += '<div style="' + secBodyStyle + '">' + md(String(src.sections[k])) + '</div>';
    });
    h += '<div style="clear:both;"></div>';
    if (href) h += '<a href="' + esc(href) + '" style="' + linkStyle + '">' + esc(d.cta) + ' &rarr;</a>';
    h += '</div></details>';
    return h;
  }

  /** The "couldn't load it" fallback, framed the same way. */
  function renderEmbedError(deckLabel, href) {
    const s = 'margin:1.15rem 0 .35rem;padding:.55rem .75rem;border:1px dashed rgba(109,74,182,.4);' +
      'border-radius:10px;font-size:.8rem;color:var(--ink-soft,#4a4439);';
    return '<p style="' + s + '">Related entry in ' + esc(deckLabel || 'another grammar') +
      ' &mdash; couldn’t load it' +
      (href ? ', <a href="' + esc(href) + '" style="color:#6d4ab6;text-decoration:underline;">open it there &rarr;</a>' : '') +
      '.</p>';
  }

  global.RefResolve = {
    resolveSourceItem: resolveSourceItem,
    loadDeckGrammar: loadDeckGrammar,
    describeEmbed: describeEmbed,
    renderEmbed: renderEmbed,
    renderEmbedError: renderEmbedError,
    isAggregatorGrammar: isAggregatorGrammar,
    orderedSectionKeys: orderedSectionKeys,
  };
})(window);
