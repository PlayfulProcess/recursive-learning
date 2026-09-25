"""Formats the results for the page (explainers/model-affect/data/). Computes no test: it only copies numbers
from results/*.json, rounds them to 2 decimals, and leaves out every series the page must not show (concepts
that did not come out readable, and axes that did not pass). Their traces stay in results/traces.json."""
import os, datetime
from concepts import MODEL, REVISION, LICENSE, N_LAYERS, HIDDEN, BY_ID, IDS, AXES, EMA_ALPHA, GLOW, BASELINE_QUESTIONS
from common import REPO, rpath, jload, jsave

OUT = os.path.join(REPO, "explainers", "model-affect", "data")
GH = "https://github.com/PlayfulProcess/recursive-learning/blob"
TEST_TEXT = {
    "valence": "comments people tagged with a pleasant emotion vs an unpleasant one",
    "arousal": "high-energy vs low-energy emotions of the same kind (anger, fear, nervousness vs sadness, grief, "
               "disappointment; excitement, amusement vs relief, caring, approval)",
    "intensity": "comments tagged with any emotion vs comments tagged neutral, tested separately for pleasant "
                 "and unpleasant emotions",
}


def r2(x):
    if x is None:
        return None
    if isinstance(x, list):
        return [r2(v) for v in x]
    if isinstance(x, dict):
        return {k: r2(v) for k, v in x.items()}
    if isinstance(x, float):
        return round(x, 2)
    return x


def main():
    M = jload(rpath("metrics.json")); T = jload(rpath("traces.json")); L = jload(rpath("layer.json"))
    pre = jload(rpath("prereg.json")) if os.path.exists(rpath("prereg.json")) else {}
    tests = M["tests"]
    readable = [c for c in IDS if tests[c]["state"] == "readable"]
    axis_ok = {a: tests[a]["state"] == "readable" for a in AXES}
    base = T["baseline"]
    sm = base["smooth"]["reply"]

    def zmark(raw, s):
        m, sd = sm[s]
        return (raw - m) / sd

    # story markers (where each concept's stories sit, projected like the dot)
    stories = M["clusters"]["stories"]
    pos = {}
    for c in IDS + ["neutral"]:
        vs = [zmark(x["v"], "valence") for x in stories if x["c"] == c]
        as_ = [zmark(x["a"], "arousal") for x in stories if x["c"] == c]
        pos[c] = {"v": sum(vs) / len(vs), "a": sum(as_) / len(as_)}

    def controls(R):
        C = R["controls"]
        return {"word_spotter_auc": C["word_spotter_auc"], "beyond_words": C["beyond_words"],
                "length_auc": C["length_auc"], "length_matched_auc": C.get("length_matched_auc"),
                "layer0_auc": C["layer0_auc"], "ceiling": C["ceiling"], "untouched": C["untouched"]}

    axes = []
    for a in AXES:
        R = tests[a]
        row = {"id": a, "label": AXES[a]["label"], "state": R["state"], "auc": R["auc"], "ci": R["ci"],
               "null_median": R["null_median"], "null_band": R["null_band"], "p": R["p"],
               "n_pos": R["n_pos"], "n_neg": R["n_neg"], "test": TEST_TEXT[a], "controls": controls(R)}
        if a == "intensity":
            row["halves"] = R["halves"]
        if a == "arousal":
            row["parts"] = R["parts"]
        axes.append(row)
    concepts = []
    for c in IDS:
        R = tests[c]; K = BY_ID[c]
        row = {"id": c, "label": K["label"], "family": K["family"], "state": R["state"],
               "test": {"source": "GoEmotions" if K["pos"] else None, "labels": K["pos"], "proxy": K["proxy"]},
               "pos": pos[c]}
        if K["pos"]:
            row.update({"auc": R["auc"], "ci": R["ci"], "null_median": R["null_median"], "null_band": R["null_band"],
                        "p": R["p"], "spec_auc": R.get("spec_auc"), "n_pos": R["n_pos"][0], "n_neg": R["n_neg"][0],
                        "controls": controls(R)})
        concepts.append(row)
    jsave(r2({"axes": axes, "concepts": concepts, "neutral_pos": pos["neutral"]}), os.path.join(OUT, "concepts.json"), indent=None)

    jsave(r2({"order": IDS, "cos": M["clusters"]["cos"],
              "stories": [{"c": x["c"], "v": zmark(x["v"], "valence"), "a": zmark(x["a"], "arousal")} for x in stories]}),
          os.path.join(OUT, "clusters.json"), indent=None)

    shown = [s for s in ["valence", "arousal", "intensity"] if axis_ok[s]] + readable
    for rid, run in T["runs"].items():
        series = {s: (run["z"][s] if s in shown else None) for s in ["valence", "arousal", "intensity"]}
        series.update({c: run["z"][c] for c in readable})
        raw = {s: run["z_raw"][s] for s in shown}
        pr = run["prereply"]
        swap_axis = next((s for s in ["valence", "intensity", "arousal"] if axis_ok[s]), None)
        sw = run["swap"][swap_axis] if swap_axis else None
        own = run["z"][swap_axis][run["prompt_end"]:] if swap_axis else None
        jsave(r2({"id": rid, "title": run["title"], "prompt": run["prompt"], "reply": run["reply"],
                  "tokens": run["tokens"], "prompt_end": run["prompt_end"],
                  "prereply": {"v": pr[0]["valence"] if axis_ok["valence"] else None,
                               "a": pr[0]["arousal"] if axis_ok["arousal"] else None,
                               "i": pr[0]["intensity"] if axis_ok["intensity"] else None,
                               "paraphrases": [{"v": p["valence"] if axis_ok["valence"] else None,
                                                "a": p["arousal"] if axis_ok["arousal"] else None} for p in pr[1:]]},
                  "series": series, "raw": raw,
                  "swap": None if not sw else {"axis": swap_axis, "own_raw_z": [None if v is None else v for v in run["z_raw"][swap_axis][run["prompt_end"]:]],
                                               "series": sw["series_swap_z"], "r": sw["r"], "mean_diff": sw["mean_diff_z"],
                                               "reading": sw["reading"]}}),
              os.path.join(OUT, "runs", f"{rid}.json"), indent=None)

    shown_rates = [base["chance_full_glow"][s] for s in shown] or list(base["chance_full_glow"].values())
    rate = sum(shown_rates) / len(shown_rates)
    meta = {"model": {"id": MODEL, "revision": REVISION, "license": LICENSE, "layers": N_LAYERS, "hidden": HIDDEN},
            "layer": M["layer"], "pcs_removed": M["pcs_removed"], "prereg": pre,
            "baseline": {"questions": len(BASELINE_QUESTIONS)}, "smoothing": {"type": "ema", "alpha": EMA_ALPHA},
            "glow": GLOW, "chance_full_glow_rate": rate, "chance_rate_over": shown or "all series (none passed)",
            "p0_cv": M["p0"], "negation": {k: M["negation"][k] for k in ["n", "moved_as_expected", "fraction"]} if M.get("negation") else None,
            "readable": readable, "axes_ok": axis_ok,
            "n_passed": sum(1 for t in tests.values() if t["state"] == "readable"),
            "code_url": f"{GH}/{pre.get('commit', 'lab/model-affect')}/lab/model-affect",
            "results_url": f"{GH}/lab/model-affect/lab/model-affect/results.md",
            "runs": [{"id": k, "title": v["title"]} for k, v in T["runs"].items()],
            "generated": datetime.date.today().isoformat()}
    jsave(r2(meta), os.path.join(OUT, "meta.json"))
    print("exported", sorted(os.listdir(OUT)), "readable:", readable, "axes:", axis_ok)


if __name__ == "__main__":
    main()
