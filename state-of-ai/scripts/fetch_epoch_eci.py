"""Epoch Capabilities Index (ECI), with each model's open/closed-weights group.

Copies only epoch_capabilities_index/eci_scores.csv (Epoch's own index, CC BY 4.0). The bootstrap
file (3.8 MB) is not copied; the confidence interval columns are.
"""

import collections

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, write_data, zip_csv)

ID = "epoch_eci"
URL = "https://epoch.ai/data/benchmark_data.zip"
PAGE = "https://epoch.ai/benchmarks"


def run():
    fetched_at = now_iso()
    src = zip_csv(http_get_cached(URL), "epoch_capabilities_index/eci_scores.csv")
    need = ["Model", "Display name", "eci", "eci_ci_low", "eci_ci_high", "date", "Organization",
            "Country (of organization)", "Model accessibility", "Accessibility group"]
    require_columns(src, need, "eci_scores.csv")
    columns = ["model", "org", "country", "date", "eci", "lo", "hi", "group", "access"]
    rows = []
    for r in src:
        d, e = iso_date(r["date"]), num(r["eci"])
        if not d or e is None:
            continue
        rows.append([(r["Display name"] or r["Model"]).strip(), (r["Organization"] or "").strip() or None,
                     (r["Country (of organization)"] or "").strip() or None, d, round(e, 2),
                     num(r["eci_ci_low"]), num(r["eci_ci_high"]),
                     (r["Accessibility group"] or "").strip() or "Other",
                     (r["Model accessibility"] or "").strip() or None])
    rows.sort(key=lambda x: (x[3], x[0]))
    groups = collections.Counter(x[7] for x in rows)
    ctry = collections.Counter(x[2] or "not stated" for x in rows)
    no_ci = sum(1 for x in rows if x[5] is None)
    coverage = {
        "summary": (
            f"{len(rows)} models, {rows[0][3]} to {rows[-1][3]}: {groups.get('Open weights', 0)} open weights, "
            f"{groups.get('Closed weights', 0)} closed, {groups.get('Other', 0)} other or unknown. "
            "Only models with enough benchmark results for the index to be fitted are here, and the "
            "score depends on which benchmarks Epoch picked. It is one vantage point, not ground truth."
        ),
        "counted": "By country: " + ", ".join(f"{k} {v}" for k, v in ctry.most_common(6)) + ".",
        "not_counted": ("Models with too few benchmark runs, and models Epoch cannot reach through an API. "
                        f"{no_ci} rows have no interval (the index's fixed anchor points)."),
        "numbers": {"models": len(rows), "groups": dict(groups), "countries": dict(ctry.most_common(8))},
    }
    payload = envelope({
        "id": ID,
        "name": "Epoch Capabilities Index (ECI)",
        "what_it_measures": ("One general-capability score per model, fitted across many benchmarks, "
                             "with a confidence interval. Each model is tagged open weights, closed "
                             "weights, or other."),
        "source": "Epoch AI, Capabilities & Benchmarking hub",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": ("Epoch's own index. The hub notes that data it bundles from other projects "
                         "keeps its original licence; none of that is copied here."),
        "citation": "Epoch AI, 'Capabilities & Benchmarking'. Published online at epoch.ai. Retrieved from https://epoch.ai/benchmarks",
        "redistribution": "copied",
    }, fetched_at, coverage, columns, rows, unit="ECI points", source_updated=rows[-1][3])
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
