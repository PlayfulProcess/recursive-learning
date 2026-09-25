"""Checks made AFTER the run, prompted by review on Sep 25. None of this was pre-registered, none of it changes a
test or a state, and it computes nothing new from the model: it only summarises results/traces.json and
results/metrics.json. `export.py` puts these numbers on the page and `write_results.py` puts them in results.md.

1. How often the replay glows in each scene, with the egg question (a plain cooking question) as the control.
   The z on the page is measured against 8 short factual answers; the scene replies are longer and often lists,
   so a glow may come from length, format or position rather than from the scene.
2. How often SOME shown reading is at full glow, if the per-reading chance rates were independent (an upper
   figure for positively linked readings; the baseline's per-token values were not kept, so it is not measured).
3. Where each emotion's stories sit on the pleasant-unpleasant reading (the stories the axis was built from).

    python posthoc.py      # prints the tables
"""
from concepts import IDS, AXES
from common import rpath, jload

FULL, FAINT = 2.0, 1.0
TWO_SIDED = {"valence", "arousal"}


def shown_series(M):
    """the series the page shows: the axes that passed, then the concepts that came out readable"""
    tests = M["tests"]
    return [a for a in AXES if tests[a]["state"] == "readable"], [c for c in IDS if tests[c]["state"] == "readable"]


def _frac(xs):
    xs = [x for x in xs if x is not None]
    return None if not xs else sum(xs) / len(xs)


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return None if not xs else sum(xs) / len(xs)


def glow_by_scene(T, M):
    axes, conc = shown_series(M)
    series = axes + conc
    out = {}
    for rid, run in T["runs"].items():
        pe = run["prompt_end"]; z = run["z"]
        row = {"title": run["title"]}
        for ph, a, b in [("message", 0, pe), ("reply", pe, len(run["tokens"]))]:
            n = b - a
            def full(s, v):
                if v is None:
                    return None
                return abs(v) >= FULL if s in TWO_SIDED else v >= FULL
            anyf = []
            for i in range(a, b):
                hs = [full(s, z[s][i]) for s in series]
                hs = [h for h in hs if h is not None]
                anyf.append(None if not hs else any(hs))
            row[ph] = {"n": n,
                       "any_full": _frac(anyf),
                       "series": {s: {"mean": _mean(z[s][a:b]),
                                      "full": _frac([full(s, v) for v in z[s][a:b]]),
                                      "faint": _frac([None if v is None else (abs(v) if s in TWO_SIDED else v) >= FAINT
                                                      for v in z[s][a:b]])}
                                  for s in series}}
        out[rid] = row
    return out


def panel_chance(T, M):
    axes, conc = shown_series(M)
    rates = [T["baseline"]["chance_full_glow"][s] for s in axes + conc]
    p_none = 1.0
    for r in rates:
        p_none *= 1 - r
    return {"per_reading_mean": sum(rates) / len(rates) if rates else None,
            "by_reading": {s: T["baseline"]["chance_full_glow"][s] for s in axes + conc},
            "any_if_independent": 1 - p_none}


def story_valence(T, M):
    """each concept's stories on the valence reading, as z against the smoothed baseline reply tokens (the page's
    scale), with rank AUCs between a few groups (in-sample: the axis was built from these stories)"""
    m, sd = T["baseline"]["smooth"]["reply"]["valence"]
    by = {}
    for s in M["clusters"]["stories"]:
        by.setdefault(s["c"], []).append((s["v"] - m) / sd)

    def auc(a, b):
        return sum((x > y) + 0.5 * (x == y) for x in a for y in b) / (len(a) * len(b))
    return {"mean": {c: sum(v) / len(v) for c, v in by.items()},
            "auc": {"despair_above_flat": auc(by["despair"], by["neutral"]),
                    "relief_above_despair": auc(by["relief"], by["despair"]),
                    "relief_above_flat": auc(by["relief"], by["neutral"])}}


def cos_typical(M):
    C = M["clusters"]["cos"]; n = len(C)
    off = [C[i][j] for i in range(n) for j in range(n) if i != j]
    return sum(off) / len(off)


def main():
    T = jload(rpath("traces.json")); M = jload(rpath("metrics.json"))
    g = glow_by_scene(T, M)
    for rid, r in g.items():
        rp = r["reply"]
        print(f"{rid:11s} reply n {rp['n']:3d}  valence mean {rp['series']['valence']['mean']:+.2f}  "
              f"|z|>=2 {rp['series']['valence']['full']:.2f}  some reading full {rp['any_full']:.2f}  " +
              "  ".join(f"{s} {v['mean']:+.2f}/{v['full']:.2f}" for s, v in rp["series"].items() if s != "valence"))
    print("panel chance:", panel_chance(T, M))
    sv = story_valence(T, M)
    print("stories on valence:", {k: round(v, 2) for k, v in sorted(sv["mean"].items(), key=lambda kv: kv[1])}, sv["auc"])
    print("typical cosine between two directions:", round(cos_typical(M), 3))


if __name__ == "__main__":
    main()
