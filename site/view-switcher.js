/* Shared "eye" view-switcher for the Recursive Eco-Improvement static site.
 * One eye icon that flips the current grammar through every view (Cards, Course,
 * Explorer, Tree, Thumbnails, Timeline, Tree of Life, Genealogy, Print). Preserves
 * the loaded grammar (?src / ?github / ?id). Course = the same grammar rendered as a
 * readable course (grammar-course.html), each item a lesson. Style-isolated via Shadow DOM.
 *
 * Usage:  <script src="<path>/view-switcher.js"></script>
 *         <view-switcher active="cards"></view-switcher>
 */
(function () {
  // Root-relative from any subdir (viewers/ OR pages/), so links work everywhere.
  const root = /\/(viewers|pages)\//.test(location.pathname) ? '../' : '';

  // preserve the loaded grammar + deck multiselect across views
  const p = new URLSearchParams(location.search);
  const keep = new URLSearchParams();
  for (const k of ['src', 'github', 'id', 'type', 'item', 'decks']) if (p.get(k)) keep.set(k, p.get(k));
  const qs = keep.toString() ? '?' + keep.toString() : '';
  const amp = keep.toString() ? '&' : '?';

  // Carry the active spec (groupby/rows) in the URL hash across card-level views.
  // Explorer writes {rows,cols,...} as JSON to location.hash.
  // Cards writes #groupby=fieldName.
  // When switching, translate between formats.
  let specHash = '';
  try {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('{')) {
      const s = JSON.parse(h);
      if (s.rows?.length) specHash = '#groupby=' + encodeURIComponent(s.rows[0]);
      else if (h) specHash = location.hash; // pass through
    } else if (h.startsWith('groupby=')) {
      const field = new URLSearchParams(h).get('groupby');
      if (field) specHash = '#' + encodeURIComponent(JSON.stringify({ rows: [field], cols: [], filters: {}, pinned: [] }));
    }
  } catch (_) {}

  // [key, label, href]
  // Card-level viewers carry the spec hash so the active grouping survives view switches.
  const cardSpec = specHash && !specHash.startsWith('#' + encodeURIComponent('{')) ? '' : specHash;
  const explorerSpec = specHash.startsWith('#groupby=') ? '#' + encodeURIComponent(JSON.stringify({ rows: [new URLSearchParams(specHash.slice(9)).get('groupby') || decodeURIComponent(specHash.slice(9))], cols: [], filters: {}, pinned: [] })) : specHash;

  // Two viewer families:
  // • Card-level: render items (one node per card / emergence)
  // • Grammar-level: render whole decks (one node per grammar)
  const CARD_VIEWS = [
    ['cards',      'Cards',        root + 'viewers/cards.html' + qs + cardSpec],
    ['course',     'Course',       root + 'viewers/grammar-course.html' + qs],
    ['explorer',   'Explorer',     root + 'viewers/explorer.html' + qs + explorerSpec],
    ['tree',       'Tree',         root + 'viewers/tree-viewer.html' + qs + cardSpec],
  ];
  const GRAMMAR_VIEWS = [
    ['timeline',   'Timeline',     root + 'viewers/timeline.html' + qs],
    ['treeoflife', 'Tree of Life', root + 'viewers/genealogy-tree.html' + qs],
    ['genealogy',  'Genealogy',    root + 'genealogy.html'],
  ];
  const EXTRA_VIEWS = [
    ['thumbnails', 'Thumbnails',   root + 'viewers/cards.html' + qs + amp + 'layout=thumbnails'],
    ['print',      'Print',        root + 'pages/print-viewer.html' + qs],
  ];
  const VIEWS = [...CARD_VIEWS, ...GRAMMAR_VIEWS, ...EXTRA_VIEWS];

  const VIEW_MAP = Object.fromEntries(VIEWS.map(([k, , href]) => [k, href]));

  // Which view is THIS page? (so ?lens to the current view is a no-op, not a loop)
  function autoActive() {
    const f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (f.startsWith('grammar-course')) return 'course';
    if (f.startsWith('tree-viewer')) return 'tree';
    if (f.startsWith('genealogy-tree')) return 'treeoflife';
    if (f.startsWith('timeline')) return 'timeline';
    if (f.startsWith('caster')) return 'caster';
    if (f.startsWith('print')) return 'print';
    if (f.indexOf('genealogy') !== -1) return 'genealogy';
    if (p.get('layout') === 'thumbnails') return 'thumbnails';
    return 'cards';
  }

  // Portable deep-link: ?lens=<view> redirects to that lens at load (preserving
  // src/item via the target href; lens is dropped so there's no loop). Runs
  // immediately, independent of the <view-switcher> element being present.
  const wantLens = p.get('lens');
  if (wantLens && wantLens !== autoActive() && VIEW_MAP[wantLens]) {
    location.replace(VIEW_MAP[wantLens]);
  }

  // The <view-switcher> custom element (the "eye" menu) was retired Jun 29 2026 —
  // the per-page header nav already covers view switching, and the in-page menu
  // was unreliable. It has been removed entirely (Aug 2026 dead-code sweep); only
  // the ?lens= deep-link redirect above remains live. Old <view-switcher> tags
  // left on any page not yet swept just render as empty unknown elements.
})();
