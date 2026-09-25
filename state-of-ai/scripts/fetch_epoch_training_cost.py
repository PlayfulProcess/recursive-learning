"""Training compute cost of notable models (2023 US dollars), from Epoch AI.

Same download as training compute. Only models with a cost estimate are written.
"""

import epoch_models as em
from common import envelope, iso_date, main_wrapper, now_iso, sig, write_data

ID = "epoch_training_cost"


def run():
    fetched_at = now_iso()
    src = em.load()
    since, newest = em.recent_window(src)
    has = lambda r: em.cost(r) is not None

    columns = ["model", "org", "date", "cost_usd_2023", "flop", "confidence", "open", "frontier", "link"]
    rows = []
    for r in src:
        d = iso_date(r["Publication date"])
        c = em.cost(r)
        if not d or c is None:
            continue
        rows.append([
            r["Model"].strip(), r["Organization"].strip(), d, sig(c), sig(em.flop(r)),
            (r["Confidence"] or "").strip() or None, em.yes_no(r["Open model weights?"]),
            (r["Frontier model"] or "").strip().lower() == "true", (r["Link"] or "").strip() or None,
        ])
    rows.sort(key=lambda x: (x[2], x[0]))
    recent = [r for r in src if (iso_date(r["Publication date"]) or "") >= since]
    by_org = em.coverage_by_org(src, has, since)
    coverage = {
        "summary": (
            f"A cost estimate exists for {len(rows)} of {len(src):,} notable models, and for "
            f"{sum(1 for r in recent if has(r))} of {len(recent)} released in the last 12 months "
            f"({since} to {newest}). It is the cost of the final training run's compute only: not "
            "research, staff, failed runs or data. Read the dots one by one; there are too few "
            "recent ones for a firm trend."
        ),
        "counted": "Models whose hardware, training time and utilization are public or estimable; the dollar figure is Epoch's estimate, inflation-adjusted to 2023 US dollars.",
        "not_counted": "; ".join(f"{o['org']} {o['with_value']} of {o['released']}" for o in by_org[:8]) + " (last 12 months, estimates of releases).",
        "numbers": {"models_with_cost": len(rows), "models": len(src), "recent_since": since,
                    "recent_models": len(recent), "recent_with_cost": sum(1 for r in recent if has(r)),
                    "recent_by_org": by_org},
    }
    payload = envelope(
        em.meta(ID, "Training cost of notable models",
                "Estimated dollar cost of the compute for each model's final training run, in 2023 US dollars.",
                changes=("From notable_ai_models.csv: only models with a cost estimate and a date kept; 9 columns "
                         "kept and renamed; dollars and FLOP rounded to 4 significant figures." + """ Coverage notes, trend lines and summaries (summary.json) are ours.""")),
        fetched_at, coverage, columns, rows,
        unit="USD (2023)", source_updated=newest,
    )
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
