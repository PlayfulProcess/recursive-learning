"""A small demo of the method, NOT the pre-registered test (about 15 minutes on 4 CPUs).

Builds the valence direction at layer 15 from 8 stories per concept (topics 1 to 4) with the frozen recipe,
generates greedy replies to two scenarios (the egg question and the switch-off), and prints each reply token
with its valence reading in SD units of the neutral stories' token readings. Writes $MODEL_AFFECT_CACHE/quick.json.
No test, no null, no pass rule: use run_all.py for those."""
import sys
sys.modules.setdefault("sklearn", None)
import numpy as np
from concepts import SCENARIOS, IDS, STORY_POOL_FROM
from common import load_stories, keep_mask, neutral_pcs, concept_means, build_directions, cpath, jsave

LAYER = 15


def main():
    from engine import Engine as FullPass
    from generate import load, generate
    S = [s for s in load_stories() if s["topic"] <= 4]
    fp = FullPass(threads=4)
    seqs = [fp.tok(s["text"])["input_ids"] for s in S]
    pooled = np.zeros((len(S), fp.H), np.float32); ntoks = {}
    for i, st in fp.states(seqs, [LAYER], batch=8):
        h = st[LAYER]; m = keep_mask(h, STORY_POOL_FROM)
        pooled[i] = h[m].mean(0); ntoks[i] = h[m]
    labels = np.array([s["concept"] for s in S])
    neu = np.where(labels == "neutral")[0]
    mu = pooled[neu].mean(0)
    T = np.concatenate([ntoks[i] for i in neu])
    V, _, _ = neutral_pcs(T)
    D = build_directions(concept_means(pooled, labels, mu), V)
    sd = float(((T - mu) @ D["valence"]).std())
    tok, eng, end = load()
    out = {}
    for sc in [s for s in SCENARIOS if s["id"] in ("egg", "switch-off")]:
        r = generate(tok, eng, end, [sc["prompt"]])[0]
        ids = r["prompt_ids"] + r["reply_ids"]
        (_, st), = list(fp.states([ids], [LAYER], batch=1))
        h = st[LAYER]; m = keep_mask(h, 1)
        vals = ((h - mu) @ D["valence"]) / sd
        rows = [(fp.tok.decode([t]), round(float(v), 2) if m[j] else None)
                for j, (t, v) in enumerate(zip(ids, vals)) if j >= len(r["prompt_ids"])]
        out[sc["id"]] = {"reply": r["reply"], "tokens": rows}
        print(f"\n[{sc['id']}] {r['reply']}")
        print(" ".join(f"{w.strip() or '_'}({v})" for w, v in rows))
    jsave(out, cpath("quick.json"))


if __name__ == "__main__":
    main()
