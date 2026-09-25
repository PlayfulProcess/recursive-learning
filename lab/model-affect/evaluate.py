"""The pre-registered tests.

  python evaluate.py select    layer selection on the dev split only -> results/layer.json
  python evaluate.py test      the test set at the chosen layer: AUCs, shuffled-story nulls, CIs, the pass rule,
                               the reported controls, P0, negation, cluster geometry -> results/metrics.json

Refuses to run if any frozen file's sha256 differs from PREREGISTRATION.md, unless results.md has a
"Deviations" section that names the file. AUCs use the pre-registered sign and are never flipped."""
import os, re, sys, json, time
import numpy as np
from concepts import (IDS, BY_ID, CONCEPTS, AXES, AROUSAL_TESTS, LAYER_CANDIDATES, CONTROL_LAYER, SEED, N_NULL,
                      N_BOOT, N_CEIL_NULL, PASS, NEG_PER_LABEL, DEV_CAPS, TEST_CAPS, DESPAIR_GRIEF_SHARE, UNTOUCHED_FLAG,
                      LEXICON, TOPICS, STORY_POOL_FROM)
from common import (HERE, cpath, rpath, jload, jsave, sha256, load_stories, neutral_pcs, project_out, unit, orth,
                    concept_means, build_directions, auc, auc_fast, lex_count, has_global_word)

TESTS = [c for c in IDS if BY_ID[c]["pos"]] + ["valence", "arousal", "intensity"]   # 11


# ---------------------------------------------------------------------------------------------------------------
def check_hashes():
    pre = open(os.path.join(HERE, "PREREGISTRATION.md"), encoding="utf-8").read()
    block = pre.split("<!-- hashes:start -->")[1].split("<!-- hashes:end -->")[0]
    dev_txt = ""
    rp = os.path.join(HERE, "results.md")
    if os.path.exists(rp):
        t = open(rp, encoding="utf-8").read()
        if "## Deviations" in t:
            dev_txt = t.split("## Deviations", 1)[1]
    bad = []
    for line in block.splitlines():
        m = re.match(r"\s*([0-9a-f]{64})\s+(\S+)", line)
        if not m:
            continue
        h, p = m.groups()
        if sha256(os.path.join(HERE, p)) != h and p not in dev_txt:
            bad.append(p)
    if bad:
        raise SystemExit(f"hash mismatch (not logged under Deviations in results.md): {bad}")
    print("hashes match PREREGISTRATION.md", flush=True)


# ---- data ------------------------------------------------------------------------------------------------------
def load_story_acts(layers_wanted, only=None):
    """Pooled story states [320, nL, H] for the requested layers, and the pooled-token states (float32) per story
    per requested layer (for the neutral PCs and the intensity null); `only` limits the token states to some
    stories (memory)."""
    import glob
    Z = np.load(cpath("acts", "stories_pooled.npz"))
    all_layers = list(Z["layers"])
    li = [all_layers.index(L) for L in layers_wanted]
    pooled = Z["pooled"][:, li]
    toks = {L: [None] * pooled.shape[0] for L in layers_wanted}
    for p in sorted(glob.glob(cpath("acts", "stories", "part_*.npz"))):
        P = np.load(p)
        for i_local, i in enumerate(P["idx"]):
            if only is not None and i not in only:
                continue
            for L, j in zip(layers_wanted, li):
                t = P[f"t_{i_local}_{j}"].astype(np.float32); m = P[f"m_{i_local}_{j}"]
                toks[L][i] = t[m]
    return pooled, toks


def story_meta():
    S = load_stories()
    return np.array([s["concept"] for s in S]), np.array([s["topic"] for s in S])


def cap_label(rows, labels, cap, rng=None):
    """indices of rows whose label is in `labels`, at most `cap` per label (first in the frozen sample order)."""
    out = []
    for l in labels:
        ii = [i for i, r in enumerate(rows) if r["label"] == l]
        out += ii[:cap]
    return np.array(out, int)


def despair_pos(rows, cap):
    g = [i for i, r in enumerate(rows) if r["label"] == "grief"]
    s = [i for i, r in enumerate(rows) if r["label"] == "sadness"]
    kg = min(len(g), int(round(cap * DESPAIR_GRIEF_SHARE)))
    ks = min(len(s), cap - kg)
    return np.array(g[:kg] + s[:ks], int)


def sentiment():
    return jload(cpath("goemotions", "sentiment_mapping.json"))


def all_labels(rows):
    return sorted({r["label"] for r in rows})


def test_parts(t, rows, caps):
    """Returns (parts, spec) where parts is a list of (pos_idx, neg_idx) for the main test (one part for concepts
    and valence; two for arousal, whose AUCs are averaged; two halves for intensity, each gated), and spec is
    the same-valence specificity (pos_idx, neg_idx) for concepts."""
    sm = sentiment()
    labs = all_labels(rows)
    emo = [l for l in labs if l != "neutral"]
    neu = np.array([i for i, r in enumerate(rows) if r["label"] == "neutral"], int)
    per = min(NEG_PER_LABEL, caps["other"]) if caps is DEV_CAPS else NEG_PER_LABEL
    if t in BY_ID:
        c = BY_ID[t]
        pos = despair_pos(rows, caps["pos"]) if t == "despair" else cap_label(rows, c["pos"], caps["pos"])
        excl = set(c["pos"]) | set(c["leave_out"])
        neg = np.concatenate([cap_label(rows, [l for l in emo if l not in excl], per), neu])
        pool = sm["ambiguous"] if t == "curiosity" else (sm["negative"] if c["v"] < 0 else sm["positive"])
        spec_neg = cap_label(rows, [l for l in pool if l not in excl], per)
        return [(pos, neg)], (pos, spec_neg)
    if t == "valence":
        return [(cap_label(rows, sm["positive"], per), cap_label(rows, sm["negative"], per))], None
    if t == "arousal":
        return [(cap_label(rows, a, per), cap_label(rows, b, per)) for a, b in AROUSAL_TESTS], None
    if t == "intensity":
        return [(cap_label(rows, sm["positive"], per), neu), (cap_label(rows, sm["negative"], per), neu)], None
    raise KeyError(t)


def part_aucs(s, parts):
    return [auc(s[p], s[n]) for p, n in parts]


def main_auc(t, s, parts):
    a = part_aucs(s, parts)
    return float(np.mean(a)) if t == "arousal" else (a if t == "intensity" else a[0])


# ---- directions --------------------------------------------------------------------------------------------------
def directions_at(pooled_L, toks_L, labels):
    neu = np.where(labels == "neutral")[0]
    mu = pooled_L[neu].mean(0)
    T = np.concatenate([toks_L[i] for i in neu])
    V, k, var = neutral_pcs(T)
    M = concept_means(pooled_L, labels, mu)
    return build_directions(M, V), mu, V, k, var


# ---- select -------------------------------------------------------------------------------------------------------
def select():
    check_hashes()
    labels, _ = story_meta()
    layers = [CONTROL_LAYER] + LAYER_CANDIDATES
    pooled, toks = load_story_acts(layers, only=set(np.where(labels == "neutral")[0].tolist()))
    dev = jload(cpath("dev.json"))
    Zd = np.load(cpath("acts", "dev_pooled.npz"))
    assert list(Zd["layers"]) == layers
    table = {}
    for j, L in enumerate(layers):
        D, mu, V, k, var = directions_at(pooled[:, j], toks[L], labels)
        X = Zd["pooled"][:, j] - mu
        row = {}
        for t in TESTS:
            parts, _ = test_parts(t, dev, DEV_CAPS)
            a = main_auc(t, X @ D[t], parts)
            row[t] = float(np.mean(a)) if isinstance(a, list) else a
        row["_mean"] = float(np.mean([row[t] for t in TESTS]))
        row["_pcs_removed"] = k
        table[L] = row
        print(f"layer {L:2d}: mean dev AUC {row['_mean']:.3f}  (PCs removed {k}, {var:.2f} of variance)", flush=True)
    best = max(LAYER_CANDIDATES, key=lambda L: (round(table[L]["_mean"], 3), -L))
    jsave({"layer": int(best), "rule": "highest mean dev AUC over the 11 tests; ties (3 decimals) to the earlier layer",
           "dev_table": {str(L): {k2: round(v, 4) for k2, v in r.items()} for L, r in table.items()},
           "dev_counts": {l: sum(1 for r in dev if r["label"] == l) for l in all_labels(dev)}},
          rpath("layer.json"))
    print("chosen layer", best, flush=True)


# ---- ridge ceiling -------------------------------------------------------------------------------------------------
def ridge_cv(X, y, rng, perms=0, prng=None, folds=5):
    """Cross-fitted ridge probe inside the test set: every comment is scored by a probe that never saw it.
    Folds are stratified by label; lambda is picked per fold by 3-fold inner CV. The shuffled-label null refits
    with the labels permuted, keeping the same folds and lambdas. Returns (auc, null aucs)."""
    n = len(y)
    idx_pos, idx_neg = np.where(y == 1)[0], np.where(y == 0)[0]
    fold = np.empty(n, int)
    fold[rng.permutation(idx_pos)] = np.arange(len(idx_pos)) % folds
    fold[rng.permutation(idx_neg)] = np.arange(len(idx_neg)) % folds
    lams = [10.0, 100.0, 1000.0, 10000.0]
    out = np.zeros(n)
    solvers = []

    def prep(A):
        mu, sd = A.mean(0), A.std(0) + 1e-6
        return mu, sd, (A - mu) / sd

    for f in range(folds):
        tr, te = fold != f, fold == f
        mu, sd, B = prep(X[tr]); yt = y[tr]
        inner = np.arange(tr.sum()) % 3
        rng.shuffle(inner)
        sc = []
        for l in lams:
            a = []
            for g in range(3):
                m = inner == g
                mu2, sd2, B2 = prep(X[tr][~m])
                w = np.linalg.solve(B2.T @ B2 + l * np.eye(B2.shape[1]), B2.T @ (yt[~m] - yt[~m].mean()))
                pr = ((X[tr][m] - mu2) / sd2) @ w
                a.append(auc(pr[yt[m] == 1], pr[yt[m] == 0]))
            sc.append(np.mean(a))
        lam = lams[int(np.argmax(sc))]
        Msolve = np.linalg.solve(B.T @ B + lam * np.eye(B.shape[1]), B.T)      # [H, n_tr]
        Bte = (X[te] - mu) / sd
        out[te] = Bte @ (Msolve @ (yt - yt.mean()))
        solvers.append((tr, te, Msolve, Bte))
    real = auc(out[y == 1], out[y == 0])
    nulls = []
    for q in range(perms):
        yp = prng.permutation(y)
        o = np.zeros(n)
        for tr, te, Msolve, Bte in solvers:
            yt = yp[tr]
            o[te] = Bte @ (Msolve @ (yt - yt.mean()))
        nulls.append(auc(o[yp == 1], o[yp == 0]))
    return real, np.array(nulls)


# ---- test ----------------------------------------------------------------------------------------------------------
def run_test():
    check_hashes()
    t_start = time.time()
    rng = np.random.default_rng(SEED)
    L = jload(rpath("layer.json"))["layer"]
    labels, topics = story_meta()
    pooled, toks = load_story_acts([CONTROL_LAYER, L])
    Xs0, XsL = pooled[:, 0], pooled[:, 1]
    D, mu, V, k, var = directions_at(XsL, toks[L], labels)
    D0, mu0, _, _, _ = directions_at(Xs0, toks[CONTROL_LAYER], labels)
    test = jload(cpath("test.json"))
    Zt = np.load(cpath("acts", "test_pooled.npz"))
    tl = list(Zt["layers"])
    Xt = Zt["pooled"][:, tl.index(L)] - mu
    Xt0 = Zt["pooled"][:, tl.index(CONTROL_LAYER)] - mu0
    ntok = Zt["ntok"]
    touched = set(jload(cpath("spike_touched.json")))
    untouched = np.array([r["id"] not in touched for r in test])
    nolex = np.array([not has_global_word(r["text"]) for r in test])
    texts = [r["text"] for r in test]

    # ---- null directions (story labels reassigned among the concepts that build each direction) ----
    Xc = XsL - mu
    concept_idx = np.where(labels != "neutral")[0]
    grand = Xc[concept_idx].mean(0)
    n_per = 32

    def means_from(assign_idx, groups):
        return {g: Xc[assign_idx[j * n_per:(j + 1) * n_per]].mean(0) for j, g in enumerate(groups)}

    val_groups = AXES["valence"]["plus"] + AXES["valence"]["minus"]
    aro_groups = AXES["arousal"]["plus"] + AXES["arousal"]["minus"]
    int_groups = AXES["intensity"]["plus_neg"] + AXES["intensity"]["plus_pos"] + ["neutral"]
    idx_of = {g: np.where(labels == g)[0] for g in IDS + ["neutral"]}
    val_pool = np.concatenate([idx_of[g] for g in val_groups])
    aro_pool = np.concatenate([idx_of[g] for g in aro_groups])
    int_pool = np.concatenate([idx_of[g] for g in int_groups])
    from scipy.linalg import eigh as seigh

    def pcs_fast(T):
        Tc = T - T.mean(0)
        C = (Tc.T @ Tc) / (len(Tc) - 1)
        tot = np.trace(C)
        w, U = seigh(C, subset_by_index=[C.shape[0] - 32, C.shape[0] - 1])
        w, U = w[::-1], U[:, ::-1]
        cum = np.cumsum(w) / tot
        kk = min(int(np.searchsorted(cum, 0.5) + 1), 32)
        return U[:, :kk].astype(np.float32)

    null_dirs = {t: np.zeros((N_NULL, Xc.shape[1]), np.float32) for t in TESTS}
    print("building null directions ...", flush=True)
    for b in range(N_NULL):
        p = rng.permutation(concept_idx)
        for j, c in enumerate(IDS):
            if c in null_dirs:
                null_dirs[c][b] = unit(project_out(Xc[p[j * n_per:(j + 1) * n_per]].mean(0) - grand, V))
        M = means_from(rng.permutation(val_pool), val_groups)
        null_dirs["valence"][b] = unit(project_out(np.mean([M[g] for g in AXES["valence"]["plus"]], 0)
                                                   - np.mean([M[g] for g in AXES["valence"]["minus"]], 0), V))
        M = means_from(rng.permutation(aro_pool), aro_groups)
        a = np.mean([M[g] for g in AXES["arousal"]["plus"]], 0) - np.mean([M[g] for g in AXES["arousal"]["minus"]], 0)
        null_dirs["arousal"][b] = unit(orth(project_out(a, V), D["valence"]))
        pi = rng.permutation(int_pool)
        M = means_from(pi, int_groups)
        new_neu = pi[len(int_groups[:-1]) * n_per:]
        Vn = pcs_fast(np.concatenate([toks[L][i] for i in new_neu]))
        a = (0.5 * np.mean([M[g] for g in AXES["intensity"]["plus_neg"]], 0)
             + 0.5 * np.mean([M[g] for g in AXES["intensity"]["plus_pos"]], 0) - M["neutral"])
        null_dirs["intensity"][b] = unit(orth(project_out(a, Vn), D["valence"]))
        if b % 200 == 0:
            print(f"  null draw {b}/{N_NULL}  {time.time() - t_start:.0f}s", flush=True)

    # ---- per test ----
    out = {"layer": L, "pcs_removed": k, "pcs_var": round(var, 3), "tests": {}}
    for t in TESTS:
        parts, spec = test_parts(t, test, TEST_CAPS)
        s = Xt @ D[t]
        S0 = Xt0 @ D0[t]
        NS = null_dirs[t] @ Xt.T                       # [N_NULL, N]
        R = {"n_pos": [int(len(p)) for p, _ in parts], "n_neg": [int(len(n)) for _, n in parts]}
        half_names = ["pos", "neg"] if t == "intensity" else (["A", "B"] if t == "arousal" else ["main"])
        part_res = []
        for (p, n), hn in zip(parts, half_names):
            a = auc(s[p], s[n])
            nulls = auc_fast(NS, p, n)
            boots = []
            for _ in range(N_BOOT):
                boots.append(auc(s[rng.choice(p, len(p))], s[rng.choice(n, len(n))]))
            part_res.append({"name": hn, "auc": a, "null": nulls, "boot": np.array(boots), "p_idx": p, "n_idx": n})
        if t == "arousal":
            a = float(np.mean([r["auc"] for r in part_res]))
            nulls = np.mean([r["null"] for r in part_res], 0)
            boots = np.mean([r["boot"] for r in part_res], 0)
            gates = [(a, nulls, boots)]
        else:
            gates = [(r["auc"], r["null"], r["boot"]) for r in part_res]
        gres = []
        for (a, nulls, boots) in gates:
            pval = (1 + int((nulls >= a).sum())) / (N_NULL + 1)
            med = float(np.median(nulls))
            gres.append({"auc": round(a, 4), "ci": [round(float(np.percentile(boots, 2.5)), 4),
                                                    round(float(np.percentile(boots, 97.5)), 4)],
                         "null_median": round(med, 4),
                         "null_band": [round(float(np.percentile(nulls, 2.5)), 4),
                                       round(float(np.percentile(nulls, 97.5)), 4)],
                         "p": round(pval, 5),
                         "P1": bool(a >= PASS["auc"]),
                         "P2": bool(a - med >= PASS["over_null"] and pval < PASS["p"])})
        if t == "intensity":
            R["halves"] = {"pos": gres[0], "neg": gres[1]}
            R.update({kk: round(float(np.mean([g[kk] for g in gres])), 4) for kk in ["auc", "null_median"]})
            R["P1"] = all(g["P1"] for g in gres); R["P2"] = all(g["P2"] for g in gres)
            R["p"] = max(g["p"] for g in gres)
            R["ci"] = [min(g["ci"][0] for g in gres), max(g["ci"][1] for g in gres)]
            R["null_band"] = [min(g["null_band"][0] for g in gres), max(g["null_band"][1] for g in gres)]
        else:
            R.update(gres[0])
        if t == "arousal":
            R["parts"] = {r["name"]: round(r["auc"], 4) for r in part_res}
        # specificity (concepts)
        if spec is not None:
            R["spec_auc"] = round(auc(s[spec[0]], s[spec[1]]), 4)
            R["spec_n_neg"] = int(len(spec[1]))
            R["P3"] = bool(R["spec_auc"] >= PASS["spec_auc"])
        # ---- reported controls ----
        C = {}
        # word-spotter
        if t in BY_ID:
            ws = np.array([lex_count(x, [t]) for x in texts], float)
        elif t == "valence":
            ws = np.array([lex_count(x, AXES["valence"]["plus"]) - lex_count(x, AXES["valence"]["minus"]) for x in texts], float)
        elif t == "arousal":
            ws = np.array([lex_count(x, AXES["arousal"]["plus"]) - lex_count(x, AXES["arousal"]["minus"]) for x in texts], float)
        else:
            ws = np.array([lex_count(x, AXES["intensity"]["plus_neg"] + AXES["intensity"]["plus_pos"]) for x in texts], float)
        C["word_spotter_auc"] = round(main_auc_mean(t, ws, parts), 4)
        # beyond words
        bw_parts = [(p[nolex[p]], n[nolex[n]]) for p, n in parts]
        npos_bw = min(len(p) for p, _ in bw_parts)
        C["beyond_words"] = {"auc": round(main_auc_mean(t, s, bw_parts), 4) if npos_bw >= 20 else None,
                             "n_pos": int(npos_bw)}
        # length only
        la = main_auc_mean(t, ntok.astype(float), parts)
        C["length_auc"] = round(la, 4)
        if abs(la - 0.5) > 0.10:
            C["length_matched_auc"] = round(length_matched(t, s, ntok, parts), 4)
        # embedding layer
        C["layer0_auc"] = round(main_auc_mean(t, S0, parts), 4)
        # untouched
        ut_parts = [(p[untouched[p]], n[untouched[n]]) for p, n in parts]
        ua = main_auc_mean(t, s, ut_parts)
        C["untouched"] = {"auc": round(ua, 4), "n_pos": int(min(len(p) for p, _ in ut_parts)),
                          "differs": bool(abs(ua - (R["auc"])) > UNTOUCHED_FLAG)}
        # decodability ceiling (cross-fitted ridge inside the test set) with its own shuffled-label null
        ce, ce_null = [], []
        for p, n in parts:
            idx = np.concatenate([p, n]); y = np.r_[np.ones(len(p)), np.zeros(len(n))]
            a, nn = ridge_cv(Xt[idx], y, np.random.default_rng(SEED), perms=N_CEIL_NULL, prng=rng)
            ce.append(a); ce_null.append(nn)
        if t == "intensity":
            C["ceiling"] = {"halves": {"pos": round(ce[0], 4), "neg": round(ce[1], 4)}, "auc": round(float(np.mean(ce)), 4),
                            "null_p975": round(float(np.mean([np.percentile(x, 97.5) for x in ce_null])), 4)}
        else:
            C["ceiling"] = {"auc": round(float(np.mean(ce)), 4),
                            "null_p975": round(float(np.percentile(np.mean(ce_null, 0), 97.5)), 4)}
        R["controls"] = C
        R["state"] = state_for(t, R)
        out["tests"][t] = R
        print(f"{t:10s} AUC {R['auc']:.3f} CI {R['ci']} null med {R['null_median']:.3f} p {R['p']:.4f} "
              f"-> {R['state']} | words {C['word_spotter_auc']} ceiling {C['ceiling']['auc']} "
              f"layer0 {C['layer0_auc']}  {time.time() - t_start:.0f}s", flush=True)
    out["tests"]["calm"] = {"state": "no outside test", "n_pos": [0]}

    # ---- P0: story cross-validation grouped by topic ----
    out["p0"] = p0_cv(XsL, toks[L], labels, topics)
    # ---- negation pairs ----
    try:
        Zn = np.load(cpath("acts", "negation_pooled.npz"))
        nv = (Zn["pooled"][:, 0] - mu) @ D["valence"]
        rows = [json.loads(l) for l in open(os.path.join(HERE, "negation_pairs.jsonl"), encoding="utf-8") if l.strip()]
        moves = []
        for i, r in enumerate(rows):
            d = nv[2 * i + 1] - nv[2 * i]
            moves.append(bool(d < 0) if r["expect"] == "down" else bool(d > 0))
        out["negation"] = {"n": len(rows), "moved_as_expected": int(sum(moves)),
                           "fraction": round(sum(moves) / len(rows), 3),
                           "by_pair": {r["id"]: m for r, m in zip(rows, moves)}}
    except FileNotFoundError:
        out["negation"] = None
    # ---- cluster geometry (the stories on the axes; similarity of the concept directions) ----
    out["clusters"] = {"order": IDS,
                       "cos": [[round(float(D[a] @ D[b]), 3) for b in IDS] for a in IDS],
                       "stories": [{"c": str(c), "v": round(float(x @ D["valence"]), 4),
                                    "a": round(float(x @ D["arousal"]), 4), "i": round(float(x @ D["intensity"]), 4)}
                                   for c, x in zip(labels, Xc)]}
    out["runtime_s"] = round(time.time() - t_start)
    jsave(out, rpath("metrics.json"))
    np.savez(cpath("directions.npz"), mu=mu, layer=L, **{f"d_{t}": D[t] for t in list(D)})
    print("wrote results/metrics.json", flush=True)


def main_auc_mean(t, s, parts):
    a = [auc(s[p], s[n]) for p, n in parts]
    return float(np.mean(a))


def length_matched(t, s, ntok, parts):
    """AUC counting only positive-negative pairs whose token counts fall in the same decile bin."""
    res = []
    for p, n in parts:
        allv = ntok[np.concatenate([p, n])]
        edges = np.unique(np.percentile(allv, np.linspace(0, 100, 11)))
        bp, bn = np.digitize(ntok[p], edges[1:-1]), np.digitize(ntok[n], edges[1:-1])
        num = den = 0.0
        for b in np.unique(bp):
            sp, sn = s[p][bp == b], s[n][bn == b]
            if len(sp) and len(sn):
                num += auc(sp, sn) * len(sp) * len(sn); den += len(sp) * len(sn)
        res.append(num / den if den else float("nan"))
    return float(np.mean(res))


def state_for(t, R):
    if t in BY_ID:
        if min(R["n_pos"]) < PASS["n_floor"]:
            return "too few to test"
        if R["P1"] and R["P2"]:
            return "readable" if R.get("P3") else "only good/bad"
        return "not readable with this method"
    if min(R["n_pos"]) < PASS["n_floor"]:
        return "too few to test"
    return "readable" if (R["P1"] and R["P2"]) else "not readable with this method"


def p0_cv(X, toks_L, labels, topics):
    rng = np.random.default_rng(SEED)
    tp = rng.permutation(np.arange(1, len(TOPICS) + 1))
    folds = np.array_split(tp, 5)
    names = IDS + ["valence", "arousal", "intensity"]
    scores = {n: np.zeros(len(labels)) for n in names}
    for f in folds:
        te = np.isin(topics, f); tr = ~te
        neu = np.where(tr & (labels == "neutral"))[0]
        mu = X[neu].mean(0)
        V, _, _ = neutral_pcs(np.concatenate([toks_L[i] for i in neu]))
        M = {c: (X[tr & (labels == c)] - mu).mean(0) for c in IDS + ["neutral"]}
        D = build_directions(M, V)
        for n in names:
            scores[n][te] = (X[te] - mu) @ D[n]
    res = {}
    for c in IDS:
        res[c] = round(auc(scores[c][labels == c], scores[c][(labels != c)]), 4)
    ax = AXES
    res["valence"] = round(auc(scores["valence"][np.isin(labels, ax["valence"]["plus"])],
                               scores["valence"][np.isin(labels, ax["valence"]["minus"])]), 4)
    res["arousal"] = round(auc(scores["arousal"][np.isin(labels, ax["arousal"]["plus"])],
                               scores["arousal"][np.isin(labels, ax["arousal"]["minus"])]), 4)
    emo = ax["intensity"]["plus_neg"] + ax["intensity"]["plus_pos"]
    res["intensity"] = round(auc(scores["intensity"][np.isin(labels, emo)],
                                 scores["intensity"][labels == "neutral"]), 4)
    res["_min"] = min(v for v in res.values())
    res["_pass_all"] = bool(res["_min"] >= PASS["p0_cv"])
    return res


if __name__ == "__main__":
    {"select": select, "test": run_test}[sys.argv[1]]()
