// search.js: loaded only when someone types their own question.
// transformers.js runs all-MiniLM-L6-v2 (q8, self-hosted in ./model/) inside the browser; the question never leaves it.
// Keep the version pinned: 4.3.0 pulls a dev ORT build, so re-test parity (build/parity.html) before any bump.
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';
const HERE = new URL('./', import.meta.url);
const D = 384;
let fe = null, V, S, IV, IS;

const bin = (path, T) => fetch(new URL(path, HERE)).then(r => {
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.arrayBuffer();
}).then(b => new T(b));

export async function load(onProgress) {
  if (fe) return;
  const [T, v, s, iv, is] = await Promise.all([
    import(TJS),
    bin('data/vectors.i8.bin', Int8Array), bin('data/scale.f32.bin', Float32Array),
    bin('data/ideas.i8.bin', Int8Array), bin('data/ideas.scale.f32.bin', Float32Array),
  ]);
  V = v; S = s; IV = iv; IS = is;
  T.env.allowRemoteModels = false;
  T.env.allowLocalModels = true;
  // a path, not a full URL: 4.3.0 skips its local-file check for http(s) URLs and would then find no tokenizer
  T.env.localModelPath = new URL('model/', HERE).pathname;
  T.env.useBrowserCache = true;
  fe = await T.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2',
    { dtype: 'q8', device: 'wasm', progress_callback: onProgress });
}

export async function embed(text) {
  const o = await fe(text, { pooling: 'mean', normalize: true });
  return Float32Array.from(o.data);
}

function scores(q, M, Sc) {
  const n = Sc.length, out = new Float32Array(n);
  for (let r = 0; r < n; r++) {
    let d = 0; const o = r * D;
    for (let k = 0; k < D; k++) d += q[k] * M[o + k];
    out[r] = d * Sc[r];
  }
  return out;
}

function topk(sc, k) {
  const idx = [];
  for (let i = 0; i < sc.length; i++) {
    if (idx.length < k) { idx.push(i); if (idx.length === k) idx.sort((a, b) => sc[b] - sc[a]); continue; }
    if (sc[i] > sc[idx[k - 1]]) {
      let j = k - 1; while (j > 0 && sc[idx[j - 1]] < sc[i]) j--;
      idx.splice(j, 0, i); idx.pop();
    }
  }
  return idx.sort((a, b) => sc[b] - sc[a]);
}

// -> {top: [[passage, score] x k], ideas: [[idea, score] x <=3], ms}
export async function query(text, k = 12) {
  const t0 = performance.now();
  const q = await embed(text);
  const t1 = performance.now();
  const sc = scores(q, V, S);
  const top = topk(sc, k).map(i => [i, sc[i]]);
  const isc = scores(q, IV, IS);
  const ideas = topk(isc, 3).filter(i => isc[i] >= 0.35).map(i => [i, isc[i]]);
  return { top, ideas, ms: { embed: Math.round(t1 - t0), search: Math.round(performance.now() - t1) } };
}
