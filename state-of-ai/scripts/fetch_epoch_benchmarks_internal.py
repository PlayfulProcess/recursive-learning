"""Benchmarks that Epoch AI runs itself (not the *_external.csv files it bundles from others).

Copies three Epoch-run benchmarks, scores only (never questions or answers), with each
benchmark's random baseline and score ceiling from benchmark_metadata.csv, so the page can show
a test running out of room.

  GPQA Diamond                 graduate-level science questions, 4 choices
  FrontierMath Tiers 1-3 (v2)  hard, unpublished maths problems (private set)
  SWE-bench Verified           fixing real bugs in open-source Python projects (Epoch's own runs;
                               the official leaderboard is CC BY-NC and is not used)
"""

import collections

from common import (CC_BY_4, FetchError, count_list, envelope, http_get_cached, iso_date, main_wrapper,
                    now_iso, num, require_columns, write_data, zip_csv, zip_names)

ID = "epoch_benchmarks_internal"
URL = "https://epoch.ai/data/benchmark_data.zip"
PAGE = "https://epoch.ai/benchmarks"

BENCHMARKS = [
    # file in the zip, short id, plain name, what it tests
    ("gpqa_diamond.csv", "gpqa", "GPQA Diamond", "Graduate-level science questions with four choices; guessing scores 25%."),
    ("frontiermath_tiers_1_3_v2.csv", "frontiermath", "FrontierMath, tiers 1-3",
     "Hard, unpublished maths problems with checkable answers (tiers 1 to 3 of 4)."),
    ("swe_bench_verified.csv", "swebench", "SWE-bench Verified",
     "Fixing real reported bugs in open-source Python projects (Epoch's own runs)."),
]


def run():
    fetched_at = now_iso()
    z = http_get_cached(URL)
    names = set(zip_names(z))
    meta_rows = zip_csv(z, "benchmark_metadata.csv")
    require_columns(meta_rows, ["source_file", "random_baseline", "score_ceiling", "superseded_by", "benchmark"], "benchmark_metadata.csv")
    models = zip_csv(z, "model_metadata.csv")
    access = {m["model_version"]: (m.get("accessibility") or "").strip() for m in models if m.get("model_version")}

    columns = ["bench", "model", "org", "country", "date", "score", "stderr", "access"]
    rows, bench_meta = [], []
    for fname, bid, label, what in BENCHMARKS:
        if fname in names and fname.endswith("_external.csv"):
            raise FetchError("refusing to copy an external file")
        if fname not in names:
            raise FetchError(f"{fname} missing from the zip")
        src = zip_csv(z, fname)
        require_columns(src, ["Model version", "Best score (across scorers)", "Release date", "Organization", "stderr"], fname)
        m = next((x for x in meta_rows if x["source_file"] == fname), {})
        bench_meta.append({
            "id": bid, "name": label, "what": what, "file": fname,
            "random_baseline": num(m.get("random_baseline")), "score_ceiling": num(m.get("score_ceiling")),
            "superseded_by": (m.get("superseded_by") or "").strip() or None,
            "epoch_name": (m.get("benchmark") or "").strip() or None,
        })
        for r in src:
            d, s = iso_date(r["Release date"]), num(r["Best score (across scorers)"])
            if not d or s is None:
                continue
            mv = r["Model version"].strip()
            rows.append([bid, mv, (r["Organization"] or "").strip() or None, (r.get("Country") or "").strip() or None,
                         d, round(s, 4), round(num(r["stderr"]), 4) if num(r["stderr"]) is not None else None,
                         access.get(mv) or None])
    rows.sort(key=lambda x: (x[0], x[4], x[1]))
    per = collections.Counter(x[0] for x in rows)
    orgs = collections.Counter(x[2] for x in rows if x[2])
    coverage = {
        "summary": ("Only models Epoch chooses to run through an API: mostly US frontier labs plus the "
                    "major Chinese labs. Rows: " + ", ".join(f"{b['name']} {per[b['id']]}" for b in bench_meta) +
                    ". Models without an API, and labs that don't give access, are missing."),
        "counted": "Rows by organization: " + count_list(orgs, 8) + ".",
        "not_counted": "Models with no public API; results other projects publish (those files keep their own licences and are not copied).",
        "numbers": {"rows_per_benchmark": dict(per), "orgs": dict(orgs.most_common(12))},
    }
    payload = envelope({
        "id": ID,
        "name": "Hard tests, run by Epoch AI",
        "what_it_measures": "Share of questions each model gets right on benchmarks Epoch runs itself, with a standard error.",
        "source": "Epoch AI, Capabilities & Benchmarking hub",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": "Epoch-run results only. Benchmark questions and answers belong to their creators; only scores are used.",
        "citation": "Epoch AI, 'Capabilities & Benchmarking'. Published online at epoch.ai. Retrieved from https://epoch.ai/benchmarks",
        "redistribution": "copied",
        "changes": ("Three Epoch-run benchmark files kept (never the *_external.csv files); scores and standard errors rounded to 4 decimals; each model's accessibility joined from model_metadata.csv; questions and answers never copied."
                    " Coverage notes, trend lines and summaries (summary.json) are ours."),
    }, fetched_at, coverage, columns, rows, unit="share correct", benchmarks=bench_meta,
        source_updated=max(x[4] for x in rows))
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
