"""Shared helpers: paths, loading, pooling, the direction recipe, AUC. Frozen with the rest (hash in
PREREGISTRATION.md). Nothing here reads GoEmotions labels to build anything."""
import os, re, json, hashlib
import numpy as np
from concepts import (IDS, BY_ID, AXES, STORY_FILES, STORY_POOL_FROM, SINK_NORM_FACTOR, PC_VAR, PC_CAP,
                      LEXICON, GLOBAL_LEXICON)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.environ.get("MODEL_AFFECT_CACHE", os.path.join(os.path.expanduser("~"), ".cache", "model-affect"))
RESULTS = os.path.join(HERE, "results")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(RESULTS, exist_ok=True)


def cpath(*p):
    return os.path.join(CACHE, *p)


def rpath(*p):
    return os.path.join(RESULTS, *p)


def jload(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def jsave(obj, p, indent=1):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False)


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        h.update(f.read().replace(b"\r\n", b"\n"))  # line-ending proof: a Windows checkout hashes the same
    return h.hexdigest()


def load_stories():
    rows = []
    for name in STORY_FILES:
        with open(os.path.join(HERE, "stories", f"{name}.jsonl"), encoding="utf-8") as f:
            rows += [json.loads(l) for l in f if l.strip()]
    return rows


# ---- pooling -------------------------------------------------------------------------------------------------
def keep_mask(h, start=1):
    """h: [n, H] states of one text at one layer. Position 0 (the attention sink) is always dropped, and so is
    any token whose norm is more than SINK_NORM_FACTOR x the median norm of the text's remaining tokens.
    Tokens before `start` are not pooled."""
    n = h.shape[0]
    m = np.zeros(n, bool)
    if n <= 1:
        m[:] = True
        return m
    nr = np.linalg.norm(h[1:], axis=1)
    ok = nr <= SINK_NORM_FACTOR * np.median(nr)
    m[1:] = ok
    m[:max(start, 1)] = False
    if not m.any():               # a very short text: fall back to every non-sink token
        m[1:] = True
    return m


def pool(h, start=1):
    m = keep_mask(h, start)
    return h[m].mean(0), m


# ---- the recipe --------------------------------------------------------------------------------------------------
def neutral_pcs(T):
    """T: [ntok, H] token states of the neutral stories (pooled tokens only). Returns (V [H, k], k, var_explained)
    for the top principal components explaining PC_VAR of variance, capped at PC_CAP. Only the top PC_CAP
    eigenpairs are computed (the rest cannot be kept anyway); the total variance is the covariance trace."""
    from scipy.linalg import eigh
    Tc = T - T.mean(0)
    C = (Tc.T @ Tc) / max(len(Tc) - 1, 1)
    H = C.shape[0]
    w, V = eigh(C, subset_by_index=[H - PC_CAP, H - 1])
    w, V = w[::-1], V[:, ::-1]
    cum = np.cumsum(w) / np.trace(C)
    k = int(np.searchsorted(cum, PC_VAR) + 1)
    k = min(k, PC_CAP)
    return np.ascontiguousarray(V[:, :k]).astype(np.float32), k, float(cum[k - 1])


def project_out(d, V):
    return d - V @ (V.T @ d)


def unit(d):
    n = np.linalg.norm(d)
    return d / n if n > 0 else d


def orth(d, u):
    return d - (d @ u) * u


def concept_means(X, labels, mu_neutral):
    """X: [N, H] pooled story states, labels: concept id per story. Returns {id: mean of centred states}."""
    Xc = X - mu_neutral
    return {c: Xc[labels == c].mean(0) for c in IDS + ["neutral"]}


def build_directions(M, V):
    """M: concept means (centred on neutral). V: neutral PCs to project out. Returns unit directions for the 9
    concepts and the 3 axes, per the pre-registered recipe."""
    grand = np.mean([M[c] for c in IDS], 0)
    D = {c: unit(project_out(M[c] - grand, V)) for c in IDS}
    ax = AXES
    val = np.mean([M[c] for c in ax["valence"]["plus"]], 0) - np.mean([M[c] for c in ax["valence"]["minus"]], 0)
    val = unit(project_out(val, V))
    aro = np.mean([M[c] for c in ax["arousal"]["plus"]], 0) - np.mean([M[c] for c in ax["arousal"]["minus"]], 0)
    aro = unit(orth(project_out(aro, V), val))
    inten = (0.5 * np.mean([M[c] for c in ax["intensity"]["plus_neg"]], 0)
             + 0.5 * np.mean([M[c] for c in ax["intensity"]["plus_pos"]], 0) - M["neutral"])
    inten = unit(orth(project_out(inten, V), val))
    D.update({"valence": val, "arousal": aro, "intensity": inten})
    return D


# ---- AUC --------------------------------------------------------------------------------------------------------
def auc(pos, neg):
    """Directional AUC: P(score of a positive > score of a negative), ties count half. Never flipped."""
    pos = np.asarray(pos, float); neg = np.asarray(neg, float)
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    from scipy.stats import rankdata
    ranks = rankdata(np.concatenate([pos, neg]))
    rp = ranks[:len(pos)].sum()
    return float((rp - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def auc_fast(scores, ypos, yneg):
    """Many AUCs at once without ties handling (continuous scores). scores: [K, N]; ypos/yneg index arrays."""
    S = scores[:, np.concatenate([ypos, yneg])]
    r = S.argsort(1).argsort(1) + 1
    rp = r[:, :len(ypos)].sum(1)
    return (rp - len(ypos) * (len(ypos) + 1) / 2) / (len(ypos) * len(yneg))


# ---- lexicon --------------------------------------------------------------------------------------------------
def _rx(words):
    return [re.compile(r"(?<![A-Za-z])" + re.escape(w).replace(r"\ ", r"\s+") + r"(?![A-Za-z])", re.I) for w in words]


LEX_RX = {c: _rx(ws) for c, ws in LEXICON.items()}
GLOBAL_RX = _rx(GLOBAL_LEXICON)


def lex_count(text, concepts):
    return sum(len(rx.findall(text)) for c in concepts for rx in LEX_RX[c])


def has_global_word(text):
    return any(rx.search(text) for rx in GLOBAL_RX)


def ema(xs, alpha):
    """Causal EMA over a series with None gaps (a gap carries the previous state)."""
    out, s = [], None
    for x in xs:
        if x is not None:
            s = x if s is None else alpha * x + (1 - alpha) * s
        out.append(s)
    return out
