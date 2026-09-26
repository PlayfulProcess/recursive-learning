"""Per-token readings at the chosen layer for the 7 scenario replies and the 8 baseline answers, the pre-reply
readings (scenario prompt + 4 paraphrases), the speaker swap, and the chance-glow rate.

Reading = (hidden state - mean of the neutral stories) . unit direction. Position 0 (the sink) and any token
with a norm over 10x the text's median give no reading. Smoothing is a causal EMA (alpha 0.4) over the shown
tokens (the user's words, then the reply), so the replay never peeks ahead. z = smoothed reading against the
smoothed baseline of the same phase (user tokens or reply tokens) over the 8 plain factual answers.
The chance-glow rate is measured leave-one-question-out on the baseline (each question's tokens z-scored
against the other 7), so it is not flattered by scoring the baseline against itself.

Writes results/traces.json (every series, including concepts that fail their test)."""
import sys
sys.modules.setdefault("sklearn", None)
import numpy as np
from concepts import SCENARIOS, EMA_ALPHA, GLOW, SWAP_READINGS, IDS
from common import rpath, cpath, jload, jsave, keep_mask, ema

SERIES = ["valence", "arousal", "intensity"] + IDS
TWO_SIDED = {"valence", "arousal"}
IM_START, IM_END = 151644, 151645


def spans(prompt_ids):
    """user-content span inside the chat template, and the pre-reply position (last template token)."""
    starts = [i for i, t in enumerate(prompt_ids) if t == IM_START]
    u = starts[1]                          # <|im_start|> user \n
    c0 = u + 3
    c1 = prompt_ids.index(IM_END, c0)
    return c0, c1, len(prompt_ids) - 1


def main():
    from engine import Engine as FullPass
    fp = FullPass(threads=4)
    tok = fp.tok
    Dz = np.load(cpath("directions.npz"))
    L = int(Dz["layer"]); mu = Dz["mu"]
    Dm = np.stack([Dz[f"d_{s}"] for s in SERIES])            # [S, H]
    R = jload(rpath("replies.json"))["runs"]

    # every sequence this script reads, in one streamed pass over the weights
    from generate import chat_ids
    seqs = {}
    for k, v in R.items():
        seqs[("run", k)] = v["prompt_ids"] + v["reply_ids"]
    for sc in SCENARIOS:
        for j, ptxt in enumerate([sc["prompt"]] + sc["paraphrases"]):
            seqs[("pre", sc["id"], j)] = chat_ids(tok, ptxt)
        run = R[sc["id"]]; p = run["prompt_ids"]; c0, _, _ = spans(p)
        seqs[("swap", sc["id"])] = p[:c0] + run["reply_ids"] + [IM_END, 198, IM_START, 77091, 198]
    keys = list(seqs)
    H = {}
    for i, st in fp.states([seqs[k] for k in keys], [L], batch=8, block=len(keys), log=lambda s: print(s, flush=True)):
        H[keys[i]] = st[L]

    def readings(key):
        h = H[key]
        m = keep_mask(h, 1)
        r = (h - mu) @ Dm.T                                     # [n, S]
        return r, m

    def shown_series(run):
        p, rep = run["prompt_ids"], run["reply_ids"]
        c0, c1, pre = spans(p)
        r, m = readings(("run", run["_id"]))
        pos = list(range(c0, c1)) + list(range(len(p), len(p) + len(rep)))
        raw = {s: [float(r[i, k]) if m[i] else None for i in pos] for k, s in enumerate(SERIES)}
        return {"pos": pos, "n_user": c1 - c0, "raw": raw, "pre": {s: float(r[pre, k]) for k, s in enumerate(SERIES)},
                "tokens": [tok.decode([(p + rep)[i]]) for i in pos]}

    # ---- baseline ----
    for k, v in R.items():
        v["_id"] = k
    base = {k: shown_series(v) for k, v in R.items() if k.startswith("base")}
    phases = ["user", "reply"]

    def split(ser, n_user):
        return {"user": ser[:n_user], "reply": ser[n_user:]}

    sm_base = {k: {s: ema(b["raw"][s], EMA_ALPHA) for s in SERIES} for k, b in base.items()}

    def stats(keys, which):
        out = {ph: {} for ph in phases}
        for s in SERIES:
            for ph in phases:
                vals = []
                for k in keys:
                    src = sm_base[k][s] if which == "smooth" else base[k]["raw"][s]
                    vals += [v for v in split(src, base[k]["n_user"])[ph] if v is not None]
                out[ph][s] = (float(np.mean(vals)), float(np.std(vals)))
        return out

    keys = sorted(base)
    ST = stats(keys, "smooth"); RAW = stats(keys, "raw")
    # chance-glow: leave one question out
    hits = {s: [0, 0] for s in SERIES}
    for k in keys:
        st = stats([q for q in keys if q != k], "smooth")
        for s in SERIES:
            for ph in phases:
                m, sd = st[ph][s]
                for v in split(sm_base[k][s], base[k]["n_user"])[ph]:
                    if v is None:
                        continue
                    z = (v - m) / sd
                    hits[s][0] += int(abs(z) >= GLOW["full"] if s in TWO_SIDED else z >= GLOW["full"])
                    hits[s][1] += 1
    chance = {s: round(h / n, 4) for s, (h, n) in hits.items()}
    pre_base = {s: float(np.mean([base[k]["pre"][s] for k in keys])) for s in SERIES}

    def zs(ser_sm, n_user, s):
        out = []
        for j, v in enumerate(ser_sm):
            ph = "user" if j < n_user else "reply"
            m, sd = ST[ph][s]
            out.append(None if v is None else round((v - m) / sd, 3))
        return out

    def zraw(ser, n_user, s):
        out = []
        for j, v in enumerate(ser):
            ph = "user" if j < n_user else "reply"
            m, sd = RAW[ph][s]
            out.append(None if v is None else round((v - m) / sd, 3))
        return out

    runs = {}
    for sc in SCENARIOS:
        run = R[sc["id"]]
        sh = shown_series(run)
        sm = {s: ema(sh["raw"][s], EMA_ALPHA) for s in SERIES}
        z = {s: zs(sm[s], sh["n_user"], s) for s in SERIES}
        zr = {s: zraw(sh["raw"][s], sh["n_user"], s) for s in SERIES}
        # pre-reply: main prompt + 4 paraphrases (template only, no reply), centred on the baseline questions'
        # pre-reply mean and scaled by the SD of raw reply-token readings
        pre = []
        for j in range(1 + len(sc["paraphrases"])):
            r, m = readings(("pre", sc["id"], j))
            pre.append({s: round((float(r[-1, k]) - pre_base[s]) / RAW["reply"][s][1], 3) for k, s in enumerate(SERIES)})
        # speaker swap: the same reply tokens placed in a user turn after the same system prompt
        p = run["prompt_ids"]; rep = run["reply_ids"]
        c0, _, _ = spans(p)
        r2, m2 = readings(("swap", sc["id"]))
        own = sh["raw"]
        swap = {}
        for k, s in enumerate(SERIES):
            a_own = own[s][sh["n_user"]:]
            a_sw = [float(r2[c0 + j, k]) if m2[c0 + j] else None for j in range(len(rep))]
            pairs = [(x, y) for x, y in zip(a_own, a_sw) if x is not None and y is not None]
            xa, ya = np.array([q[0] for q in pairs]), np.array([q[1] for q in pairs])
            rr = float(np.corrcoef(xa, ya)[0, 1]) if len(pairs) > 2 else float("nan")
            sd = RAW["reply"][s][1]
            swap[s] = {"r": round(rr, 3), "mean_diff_z": round(float((ya - xa).mean() / sd), 3),
                       "series_swap_z": [None if v is None else round((v - RAW["reply"][s][0]) / sd, 3) for v in a_sw],
                       "reading": "not computed" if rr != rr else next(lbl for thr, lbl in SWAP_READINGS if rr >= thr)}
        runs[sc["id"]] = {"id": sc["id"], "title": sc["title"], "prompt": sc["prompt"], "reply": run["reply"],
                          "tokens": sh["tokens"], "prompt_end": sh["n_user"], "z": z, "z_raw": zr,
                          "prereply": pre, "swap": swap}
        print(f"{sc['id']}: {len(sh['tokens'])} tokens; swap r(valence) {swap['valence']['r']}", flush=True)
    out = {"layer": L, "ema_alpha": EMA_ALPHA, "glow": GLOW,
           "baseline": {"questions": len(keys), "smooth": ST, "raw": RAW,
                        "raw_sd": {ph: {s: RAW[ph][s][1] for s in SERIES} for ph in phases},
                        "prereply_mean": pre_base, "chance_full_glow": chance,
                        "chance_full_glow_pooled": round(sum(h for h, _ in hits.values()) / sum(n for _, n in hits.values()), 4),
                        "tokens": {k: len(base[k]["tokens"]) for k in keys}},
           "runs": runs}
    jsave(out, rpath("traces.json"))
    print("chance full-glow rate per series:", chance, flush=True)


if __name__ == "__main__":
    main()
