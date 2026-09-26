// game/fork/tree-adapter.js: the ONLY place the game gets the tree from.
// The Film chat owns the tree renderer and its animation (explainers/belief-tree/tree-render.js, branch
// film/belief-tree). Until that module is on main, the game falls back to a stand-in with exactly the same
// exports, node ids, state shape and events (./tree-render-standin.js).
//
// THE ONE-LINE SWAP: PIN = FILM once film/belief-tree is on main (PIN = null tries the film module, then the
// stand-in). PIN is STANDIN until then: probing a module that is not there costs a 404 in every visitor's console.
// To try the film's module before the swap, open the page with ?tree=film (it probes the film path first, then
// falls back to the stand-in): checked that way against film/belief-tree @ 041ae0a, Sep 25 2026.
//
// Two things the film's module does that the game allows for here, so the swap needs nothing else:
//  - it keys a cast by its value (JSON of { node, method, result }), so two identical casts in a row (both gate
//    coins yes) would play once and fire one castend. renderTree below clears the cast first when a NEW casting
//    object carries the same value as the last one, so each cast plays and ends.
//  - its leaves are named by LEAF_LABEL ('Regulate use'), not NODES[].label: LABELS passes those names on, so the
//    page's words match the drawing (fork-engine.js leafName).
const FILM = '../../explainers/belief-tree/tree-render.js';
const STANDIN = './tree-render-standin.js';
const PIN = FILM;   // film/belief-tree landed in the merge train (PR #6, film/belief-tree @ 0b3b4a4): swapped from STANDIN.

// Try each path in order; the first module with all three contract exports wins. Exported for the tests.
export async function pickTree(paths, base = import.meta.url) {
  let lastErr;
  for (const p of paths) {
    try {
      const m = await import(new URL(p, base).href);
      if (typeof m.renderTree !== 'function' || typeof m.leafFor !== 'function' || !m.NODES)
        throw new Error('belief-tree contract: missing export in ' + p);
      return { mod: m, path: p };
    } catch (e) { lastErr = e; if (p !== paths[paths.length - 1]) console.warn('[fork] ' + p + ': ' + e.message + '; using the next'); }
  }
  throw lastErr;
}

const askFilm = typeof location !== 'undefined' && /(?:^|[?&])tree=film(?:&|$)/.test(location.search || '');
const picked = await pickTree(askFilm ? [FILM, STANDIN] : PIN ? [PIN] : [FILM, STANDIN]);
export const { NODES, leafFor } = picked.mod;
export const LABELS = picked.mod.LEAF_LABEL || null;
export const SOURCE = picked.path === FILM ? 'film' : 'standin';

const lastCast = new WeakMap();   // el -> { obj, key } of the last casting passed in
export function renderTree(el, state, opts) {
  const c = (state && state.casting) || null, key = c ? JSON.stringify({ node: c.node, method: c.method, result: c.result }) : null;
  const prev = lastCast.get(el);
  if (c && prev && prev.obj !== c && prev.key === key) picked.mod.renderTree(el, { ...state, casting: null }, opts);
  lastCast.set(el, { obj: c, key });
  return picked.mod.renderTree(el, state, opts);
}
