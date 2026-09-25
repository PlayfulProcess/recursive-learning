"""Training compute of notable AI models (FLOP), from Epoch AI.

Writes data/epoch_training_compute.json with EVERY notable model (so the open-weights share of
releases can be counted from the same file), with `flop` empty where Epoch has no estimate.
"""

import collections

import epoch_models as em
from common import envelope, iso_date, main_wrapper, now_iso, sig, write_data

ID = "epoch_training_compute"


def run():
    fetched_at = now_iso()
    src = em.load()
    since, newest = em.recent_window(src)
    has = lambda r: em.flop(r) is not None

    columns = ["model", "org", "date", "flop", "confidence", "open", "access", "country", "frontier", "link"]
    rows = []
    for r in src:
        d = iso_date(r["Publication date"])
        if not d:
            continue
        f = em.flop(r)
        rows.append([
            r["Model"].strip(), r["Organization"].strip(), d, sig(f),
            (r["Confidence"] or "").strip() or None if f is not None else None,
            em.yes_no(r["Open model weights?"]), (r["Model accessibility"] or "").strip() or None,
            (r["Country (of organization)"] or "").strip() or None,
            (r["Frontier model"] or "").strip().lower() == "true",
            (r["Link"] or "").strip() or None,
        ])
    rows.sort(key=lambda x: (x[2], x[0]))

    n_all = len(rows)
    n_val = sum(1 for x in rows if x[3] is not None)
    recent = [r for r in src if (iso_date(r["Publication date"]) or "") >= since]
    conf = collections.Counter(x[4] for x in rows if x[3] is not None)
    by_org = em.coverage_by_org(src, has, since)
    blind = [o for o in by_org if o["released"] >= 3 and o["with_value"] <= o["released"] / 3]
    coverage = {
        "summary": (
            f"{n_all:,} models Epoch judges 'notable', {rows[0][2][:4]} to {newest}. "
            f"A compute estimate exists for {n_val:,} of them. In the last 12 months "
            f"({since} to {newest}) it exists for {sum(1 for r in recent if has(r))} of {len(recent)}. "
            "Labs that publish details are counted more often than labs that don't, so the newest "
            "part of any compute curve leans on whoever discloses."
        ),
        "counted": "Models Epoch lists as notable (state of the art, highly cited, historically important, or widely used), with an estimate built from papers, announcements and hardware reports.",
        "not_counted": (
            "Models with no public details. In the last 12 months: "
            + "; ".join(f"{o['org']} {o['with_value']} of {o['released']}" for o in blind[:8])
            + "." if blind else "No large gaps by lab in the last 12 months."
        ),
        "numbers": {
            "models": n_all, "with_estimate": n_val,
            "recent_since": since, "recent_models": len(recent),
            "recent_with_estimate": sum(1 for r in recent if has(r)),
            "confidence": dict(conf), "recent_by_org": by_org,
            "countries_with_estimate": em.countries(src, has),
        },
    }
    payload = envelope(
        em.meta(ID, "Training compute of notable AI models",
                "Estimated total floating-point operations (FLOP) used to train each model. "
                "Each estimate carries Epoch's confidence label: Confident, Likely or Speculative.",
                changes=("From notable_ai_models.csv: every model with a publication date kept, with or without an "
                         "estimate; 10 of its columns kept and renamed; FLOP rounded to 4 significant figures; "
                         "'Open model weights?' turned into true, false or blank." + """ Coverage notes, trend lines and summaries (summary.json) are ours.""")),
        fetched_at, coverage, columns, rows,
        unit="FLOP", source_updated=newest,
    )
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
