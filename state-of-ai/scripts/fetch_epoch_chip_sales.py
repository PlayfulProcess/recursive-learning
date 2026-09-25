"""AI compute sold, by chip designer, in H100-equivalents (Epoch AI, Data on AI Chip Sales).

From cumulative_timelines_by_designer.csv: for each designer and quarter, the cumulative compute
sold since that designer's series starts, with Epoch's 5th and 95th percentiles. The per-quarter
amount (`q_median`) is the difference of successive cumulative medians; percentiles do not
subtract, so the quarter has no band of its own.
"""

import collections

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, write_data, zip_csv)

ID = "epoch_chip_sales"
URL = "https://epoch.ai/data/ai_chip_sales.zip"
PAGE = "https://epoch.ai/data/ai-chip-sales"


def run():
    fetched_at = now_iso()
    src = zip_csv(http_get_cached(URL), "cumulative_timelines_by_designer.csv")
    need = ["Chip manufacturer", "Start date", "End date", "Compute estimate in H100e (median)",
            "Compute estimate in H100e (5th percentile)", "Compute estimate in H100e (95th percentile)",
            "Power in MW (median)", "Incomplete"]
    require_columns(src, need, "cumulative_timelines_by_designer.csv")
    by = collections.defaultdict(list)
    for r in src:
        d = iso_date(r["End date"])
        m = num(r["Compute estimate in H100e (median)"])
        if d and m is not None:
            by[r["Chip manufacturer"].strip()].append(r)
    columns = ["designer", "start", "quarter_end", "cum_median", "cum_p5", "cum_p95", "q_median", "power_mw", "incomplete"]
    rows, starts = [], {}
    for designer, rs in by.items():
        rs.sort(key=lambda r: r["End date"])
        prev = 0.0
        starts[designer] = rs[0]["Start date"]
        for r in rs:
            cum = num(r["Compute estimate in H100e (median)"])
            rows.append([designer, iso_date(r["Start date"]), iso_date(r["End date"]), round(cum),
                         num(r["Compute estimate in H100e (5th percentile)"]),
                         num(r["Compute estimate in H100e (95th percentile)"]),
                         round(cum - prev), num(r["Power in MW (median)"]),
                         (r["Incomplete"] or "").strip().lower() == "true"])
            prev = cum
    rows.sort(key=lambda x: (x[0], x[2]))
    last = {d: max(x[2] for x in rows if x[0] == d) for d in by}
    coverage = {
        "summary": ("Designers counted: " + ", ".join(f"{d} from {starts[d][:7]}" for d in sorted(by, key=lambda d: starts[d])) +
                    ". The series start at different dates, so a total across designers is only fair from "
                    "the latest start. Estimates are modelled from company filings and reports; quarters "
                    "marked incomplete are still being counted."),
        "counted": "Accelerators sold by these designers, converted to H100-equivalents of dense 16-bit compute.",
        "not_counted": ("Designers outside this list (grouped as 'Other' where Epoch has them), chips sold before "
                        "each series starts, and most grey-market and smuggled chips. Chips that were retired "
                        "are not subtracted."),
        "numbers": {"designers": sorted(by), "start": starts, "last_quarter": last},
    }
    payload = envelope({
        "id": ID,
        "name": "AI compute sold, by chip designer",
        "what_it_measures": "Estimated AI compute shipped each quarter and in total, in H100-equivalents, with 5th to 95th percentile ranges.",
        "source": "Epoch AI, Data on AI Chip Sales",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": "Epoch's README: free to use, distribute, and reproduce provided the source and authors are credited.",
        "citation": "Epoch AI, 'Data on AI Chip Sales'. Published online at epoch.ai. Retrieved from https://epoch.ai/data/ai-chip-sales",
        "redistribution": "copied",
        "changes": ("From cumulative_timelines_by_designer.csv: the per-quarter amount computed by us as the difference of Epoch's cumulative medians; cumulative figures rounded to whole H100-equivalents."
                    " Coverage notes, trend lines and summaries (summary.json) are ours."),
    }, fetched_at, coverage, columns, rows, unit="H100-equivalents", source_updated=max(x[2] for x in rows))
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
