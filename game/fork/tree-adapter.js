// game/fork/tree-adapter.js: the ONLY place the game gets the tree from.
// The Film chat owns the tree renderer and its animation (explainers/belief-tree/tree-render.js, branch
// film/belief-tree). Until that module is on main, the game falls back to a stand-in with exactly the same
// exports, node ids, state shape and events (./tree-render-standin.js).
//
// THE ONE-LINE SWAP: PIN = FILM once film/belief-tree is on main (PIN = null tries the film module, then the
// stand-in). PIN is STANDIN until then: probing a module that is not there costs a 404 in every visitor's console.
const FILM = '../../explainers/belief-tree/tree-render.js';
const STANDIN = './tree-render-standin.js';
const PIN = STANDIN;   // film/belief-tree is not on main yet: no 404 probe, a clean console. Swap to FILM (or null) when it lands.

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

const picked = await pickTree(PIN ? [PIN] : [FILM, STANDIN]);
export const { renderTree, NODES, leafFor } = picked.mod;
export const SOURCE = picked.path === FILM ? 'film' : 'standin';
