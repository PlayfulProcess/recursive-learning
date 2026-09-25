"""Reported annualized revenue of AI companies (Epoch AI, Data on AI Companies,
ai_companies_revenue_reports.csv).

Each row keeps the report's own first source link (a news article or company statement), so a
number can be traced past Epoch to where it was said.
"""

import collections

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, sig, write_data, zip_csv)

ID = "epoch_ai_companies"
URL = "https://epoch.ai/data/ai_companies.zip"
PAGE = "https://epoch.ai/data/ai-companies"


def run():
    fetched_at = now_iso()
    z = http_get_cached(URL)
    src = zip_csv(z, "ai_companies_revenue_reports.csv")
    need = ["Company", "Date", "Annualized revenue (USD)", "Annualized revenue type", "Scope",
            "Confidence", "Source 1", "Source type"]
    require_columns(src, need, "ai_companies_revenue_reports.csv")
    columns = ["company", "date", "annualized_usd", "kind", "scope", "confidence", "source_type", "source_link"]
    rows = []
    for r in src:
        d, v = iso_date(r["Date"]), num(r["Annualized revenue (USD)"])
        if not d or v is None:
            continue
        rows.append([r["Company"].strip(), d, sig(v), (r["Annualized revenue type"] or "").strip() or None,
                     (r["Scope"] or "").strip() or None, (r["Confidence"] or "").strip() or None,
                     (r["Source type"] or "").strip() or None, (r["Source 1"] or "").strip() or None])
    rows.sort(key=lambda x: (x[0], x[1]))
    per = collections.Counter(x[0] for x in rows)
    coverage = {
        "summary": ("Revenue run-rates that companies disclosed or the press reported, collected by Epoch: "
                    + ", ".join(f"{k} {v}" for k, v in per.most_common()) +
                    " reports. A run-rate is often the latest month's revenue times twelve, so it swings, and "
                    "some figures are leaks rather than audited accounts."),
        "counted": "Companies whose main business is AI models, as far as reports exist.",
        "not_counted": ("Google, Meta, Microsoft and Amazon: they do not report AI revenue separately. Chinese "
                        "labs appear only when a figure was reported."),
        "numbers": {"reports": dict(per)},
    }
    payload = envelope({
        "id": ID,
        "name": "Revenue of AI companies",
        "what_it_measures": "Reported annualized revenue (run-rate or annual recurring revenue) per company, over time.",
        "source": "Epoch AI, Data on AI Companies",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": "Epoch's README: free to use, distribute, and reproduce provided the source and authors are credited. Each row also links its original report.",
        "citation": "Epoch AI, 'Data on AI Companies'. Published online at epoch.ai. Retrieved from https://epoch.ai/data/ai-companies",
        "redistribution": "copied",
    }, fetched_at, coverage, columns, rows, unit="US dollars per year", source_updated=max(x[1] for x in rows))
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
