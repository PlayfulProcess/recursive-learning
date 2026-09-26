"""Pooled hidden states for the stories, the GoEmotions dev and test samples, and the negation pairs.

  python extract.py stories    layers 0 + candidates; pooled from token 20; keeps story token states (cache)
  python extract.py dev        layers 0 + candidates; pooled over every token but the sink/outliers
  python extract.py test       layer 0 + the layer chosen on dev (results/layer.json); read once
  python extract.py negation   the chosen layer

Raw text, no chat template. Checkpointed per chunk of 32 texts under $MODEL_AFFECT_CACHE/acts/<set>/, so
--resume (the default) picks up where it stopped. Uses engine.py (see build step 0 in PREREGISTRATION.md)."""
import os, sys, json, time, glob
import numpy as np
from concepts import LAYER_CANDIDATES, CONTROL_LAYER, STORY_POOL_FROM
from common import cpath, rpath, jload, load_stories, keep_mask, HERE

CHUNK = {"stories": 32}   # texts per checkpoint (and per pass over the weights); comments: 256


def texts_for(which):
    if which == "stories":
        return [r["text"] for r in load_stories()], STORY_POOL_FROM
    if which in ("dev", "test"):
        return [r["text"] for r in jload(cpath(f"{which}.json"))], 1
    if which == "negation":
        rows = [json.loads(l) for l in open(os.path.join(HERE, "negation_pairs.jsonl"), encoding="utf-8") if l.strip()]
        return [t for r in rows for t in (r["plain"], r["negated"])], 1
    raise SystemExit(f"unknown set {which}")


def layers_for(which):
    if which in ("stories", "dev"):
        return [CONTROL_LAYER] + LAYER_CANDIDATES
    L = jload(rpath("layer.json"))["layer"]
    return [CONTROL_LAYER, L] if which == "test" else [L]


def main():
    which = sys.argv[1]
    texts, start = texts_for(which)
    layers = layers_for(which)
    out = cpath("acts", which)
    os.makedirs(out, exist_ok=True)
    from engine import Engine as FullPass
    fp = FullPass(threads=4)
    seqs = [fp.tok(t)["input_ids"] for t in texts]
    print(f"{which}: {len(seqs)} texts, {sum(map(len, seqs))} tokens, layers {layers}", flush=True)
    t0 = time.time()
    chunk = CHUNK.get(which, 256)
    for c0 in range(0, len(seqs), chunk):
        part = os.path.join(out, f"part_{c0:05d}.npz")
        if os.path.exists(part):
            continue
        idx = list(range(c0, min(c0 + chunk, len(seqs))))
        pooled = np.zeros((len(idx), len(layers), fp.H), np.float32)
        ntok = np.array([len(seqs[i]) for i in idx])
        toks, masks = {}, {}
        for i, st in fp.states([seqs[i] for i in idx], layers, batch=8, block=len(idx)):
            for li, L in enumerate(layers):
                h = st[L]
                m = keep_mask(h, start)
                pooled[i, li] = h[m].mean(0)
                if which == "stories":
                    toks[(i, li)] = h[start:].astype(np.float16)
                    masks[(i, li)] = m[start:]
        extra = {}
        if which == "stories":
            for (i, li), a in toks.items():
                extra[f"t_{i}_{li}"] = a
                extra[f"m_{i}_{li}"] = masks[(i, li)]
        np.savez(part, pooled=pooled, ntok=ntok, idx=np.array(idx), layers=np.array(layers), **extra)
        el = time.time() - t0
        print(f"  chunk {c0}: done {min(c0 + chunk, len(seqs))}/{len(seqs)}  {el:.0f}s", flush=True)
    # assemble
    parts = sorted(glob.glob(os.path.join(out, "part_*.npz")))
    P = [np.load(p) for p in parts]
    pooled = np.concatenate([p["pooled"] for p in P])
    ntok = np.concatenate([p["ntok"] for p in P])
    np.savez(cpath("acts", f"{which}_pooled.npz"), pooled=pooled, ntok=ntok, layers=np.array(layers))
    print(f"{which}: assembled {pooled.shape} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
