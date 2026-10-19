/* Recursive.eco per-deck links — shared across viewers.
 * Reads the hardcoded slug -> deckId map (grammars/_eco_ids.json) and builds three
 * links for any deck that's in the map:
 *   <rt-icon name="oracle"></rt-icon> Cast  → https://recursive.eco/process?cast=<id>          (Cast, with this deck chosen)
 *   <rt-icon name="eye"></rt-icon> View  → https://recursive.eco/play?id=<id>               (Play, the reader)
 *   <rt-icon name="pencil"></rt-icon> Edit  → https://recursive.eco/play?id=<id>&edit=1        (Play with the pencil: the owner edits; others propose edits or make a copy)
 * Links only RESOLVE for visitors once that deck is is_public on recursive.eco —
 * but they're shown regardless (stable UUIDs), so they light up as decks publish.
 *
 * Usage:
 *   <script src="<pfx>viewers/eco-links.js"></script>
 *   await RecursiveEcoLinks.ready();
 *   el.innerHTML = RecursiveEcoLinks.barHTML(slug, { type:'tarot', item:22 });
 */
(function () {
  if (window.RecursiveEcoLinks) return;
  // Root-relative: the site is served at the root of learning.recursive.eco, and the depth formula
  // gets /glossary/ wrong (a trailing-slash page is one folder down, not at the root).
  const PFX = '/';
  let MAP = null, _p = null;

  function ready() {
    if (_p) return _p;
    _p = fetch(PFX + 'grammars/_eco_ids.json')
      .then(r => r.json())
      .then(j => { MAP = (j && j.ids) || {}; return MAP; })
      .catch(() => { MAP = {}; return MAP; });
    return _p;
  }
  const deckId = slug => (MAP && MAP[slug]) || null;

  function urls(slug, opts) {
    opts = opts || {};
    const id = deckId(slug);
    if (!id) return null;
    return {
      id,
      cast: 'https://recursive.eco/process?cast=' + id,
      view: 'https://recursive.eco/play?id=' + id,
      edit: 'https://recursive.eco/play?id=' + id + '&edit=1',
    };
  }

  function barHTML(slug, opts) {
    const u = urls(slug, opts);
    if (!u) return '';
    const a = (cls, href, label) => `<a class="eco-btn ${cls}" href="${href}" target="_blank" rel="noopener">${label}</a>`;
    return '<div class="eco-links" title="Open this deck on recursive.eco">'
      + a('eco-cast', u.cast, '<rt-icon name="oracle"></rt-icon> Cast')
      + a('eco-view', u.view, '<rt-icon name="eye"></rt-icon> View')
      + a('eco-edit', u.edit, '<rt-icon name="pencil"></rt-icon> Edit')
      + '</div>';
  }

  (function injectCSS() {
    if (document.getElementById('eco-links-css')) return;
    const s = document.createElement('style');
    s.id = 'eco-links-css';
    s.textContent =
      '.eco-links{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}' +
      '.eco-btn{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;' +
      'text-decoration:none;padding:8px 14px;border-radius:9px;border:1px solid transparent;transition:filter .15s,background .15s}' +
      '.eco-cast{background:linear-gradient(135deg,#126445,#177d56);color:#fff;box-shadow:0 3px 14px rgba(23,125,86,.35)}' +
      '.eco-view{background:transparent;color:#b9a3f5;border-color:rgba(23,125,86,.45)}' +
      '.eco-edit{background:transparent;color:#9ad0b5;border-color:rgba(129,178,154,.45)}' +
      '.eco-btn:hover{filter:brightness(1.12)}' +
      '.eco-view:hover{background:rgba(23,125,86,.12)} .eco-edit:hover{background:rgba(129,178,154,.10)}';
    document.head.appendChild(s);
  })();

  window.RecursiveEcoLinks = { ready, deckId, urls, barHTML, prefix: PFX };
})();
