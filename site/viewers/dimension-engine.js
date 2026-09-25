/* dimension-engine.js — the shared "emergent pattern" brain for every viewer.
 *
 * Extracted verbatim from explorer.html (P5, June 2026). Pure, DOM-free, stateless:
 * grammars in → records + discovered dimensions + inferred hierarchy + pivots out.
 * Explorer is its first consumer; Cards / Tree / the grammar-level graphs adopt the
 * same functions so one grammar shape drives every view. No tarot-specific names.
 *
 * The two pieces of state the explorer used to close over are now explicit params:
 *   - flatten(..., nameOf)   nameOf(id) → display name | undefined  (was byId lookup)
 *   - passes(r, filters)     filters = { field: [selectedValue, ...] }  (was spec.filters)
 *
 * Load before a viewer's inline script:  <script src="dimension-engine.js?v=1"></script>
 * then bind thin local wrappers so existing call sites stay unchanged.
 */
(function (global) {
  'use strict';

  function smartCmp(a, b) {
    // The "no value" bucket always sorts LAST. It used to head every pivot — a landfill row
    // in the first position reads as "this data is broken" when it is usually a handful of
    // cards that genuinely have no value (Bologna's four equal-ranking Papi carry no trump
    // number; that is the deck, not a gap).
    const da = a === '—', db = b === '—';
    if (da !== db) return da ? 1 : -1;
    const na = +a, nb = +b;
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  }

  /* FLATTEN: grammar.items → records, each field a string[] (multi-membership ready).
     Tracks __parents/__children from composite_of for relationship tracing. */
  function flatten(grammar, inherit, prefix, nameOf) {
    const items = grammar.items || [];
    const pid = id => (prefix ? prefix + ':' : '') + id;
    const memberOf = {};
    for (const it of items)
      for (const cid of (it.composite_of || []))
        (memberOf[pid(cid)] = memberOf[pid(cid)] || []).push(pid(it.id));
    const recs = [];
    for (const it of items) {
      const lvl = it.level || (it.composite_of?.length ? 2 : 1);
      const r = {
        __name: it.name, __img: it.image_url || it.metadata?.image_url || '',
        __id: pid(it.id),
        __children: (it.composite_of || []).map(pid),
        __parents: memberOf[pid(it.id)] || []
      };
      r.level = ['L' + lvl];
      const md = it.metadata || {};
      for (const [k, v] of Object.entries(md)) {
        if (v == null) continue;
        if (k === 'print' && v.quality) { r['print quality'] = [String(v.quality)]; continue; }
        if (typeof v === 'string' && !/^https?:/.test(v) && v.length < 60) r[k] = [v];
        else if (typeof v === 'number') r[k] = [v];
      }
      // inherited deck-level fields (multiselect mode): records WITHOUT their own
      // value take the deck's — so a deck's emergences are catalogued into its
      // century, branch, etc. alongside the cards. Identity fields (deck) are the
      // exception: the cross-link convention (CLAUDE.md "one cross-link pattern")
      // stamps metadata.deck with the OTHER grammar's label, which collides with
      // this same identity key — inherited (the item's REAL deck) must always win.
      if (inherit) for (const [k, v] of Object.entries(inherit)) {
        if (v == null) continue;
        if (k === 'deck') r[k] = [v];
        else if (!r[k]) r[k] = [v];
      }
      if (r.year) { const y = +r.year[0]; if (y) r.century = [(Math.floor((y - 1) / 100) + 1) + 'th c.']; }
      for (const kw of (it.keywords || [])) {
        const m = /^([a-z_-]{2,20}):(.+)$/.exec(kw);
        if (m) (r[m[1] + ' ·kw'] = r[m[1] + ' ·kw'] || []).push(m[2]);
        else (r.keyword = r.keyword || []).push(kw);
      }
      if (it.category) r.category = [it.category];
      if (r.__parents.length)
        r.emergence = r.__parents.map(p => ((nameOf && nameOf(p)) || p).split(' — ')[0].slice(0, 40));
      recs.push(r);
    }
    return recs;
  }

  /* DISCOVER: which fields are usable dimensions (2..64 distinct values). */
  function discoverFields(recs) {
    const tally = {};
    for (const r of recs) for (const k of Object.keys(r)) {
      if (k.startsWith('__')) continue;
      tally[k] = tally[k] || { vals: new Set(), cover: 0 };
      tally[k].cover++;
      for (const v of r[k]) tally[k].vals.add(v);
    }
    return Object.entries(tally)
      .filter(([k, t]) => t.vals.size >= 2 && t.vals.size <= 64)
      .map(([k, t]) => ({ name: k, count: t.vals.size, values: [...t.vals].sort(smartCmp) }))
      .sort((a, b) => a.count - b.count);
  }

  /* INFER HIERARCHY from the data: field A nests inside field B when every observed
     value of A co-occurs with exactly ONE value of B. Cross-cutting axes stay flat. */
  function inferHierarchy(recs, flds) {
    const parent = {};
    const META = new Set(['level', 'print quality']);
    for (const a of flds) {
      if (META.has(a.name)) continue;
      let best = null;
      for (const b of flds) {
        if (a === b || META.has(b.name) || b.count >= a.count) continue;
        const map = new Map(); let ok = true, seen = 0;
        for (const r of recs) {
          if (!r[a.name] || !r[b.name]) continue;
          if (r[a.name].length > 1 || r[b.name].length > 1) continue;
          const av = String(r[a.name][0]), bv = String(r[b.name][0]);
          if (av === '—' || bv === '—') continue;
          seen++;
          if (map.has(av)) { if (map.get(av) !== bv) { ok = false; break; } }
          else map.set(av, bv);
        }
        if (ok && map.size >= 2 && seen >= map.size * 2)
          if (!best || b.count > best.count) best = b;
      }
      if (best) parent[a.name] = best.name;
    }
    return parent;
  }

  /* PIVOT primitives. */
  const vals = (r, f) => r[f] || ['—'];

  function passes(r, filters) {
    for (const [f, sel] of Object.entries(filters || {})) {
      if (!sel.length) continue;
      if (!vals(r, f).some(v => sel.includes(String(v)))) return false;
    }
    return true;
  }

  function groupBy(recs, fs) {
    if (!fs.length) return null;
    const m = new Map();
    for (const r of recs) for (const v of vals(r, fs[0])) {
      if (!m.has(v)) m.set(v, []);
      m.get(v).push(r);
    }
    return [...m.entries()].sort((a, b) => smartCmp(a[0], b[0]))
      .map(([key, rs]) => ({ key, recs: rs, children: groupBy(rs, fs.slice(1)) }));
  }

  global.DimensionEngine = {
    smartCmp, flatten, discoverFields, inferHierarchy, vals, passes, groupBy
  };
})(typeof window !== 'undefined' ? window : globalThis);
