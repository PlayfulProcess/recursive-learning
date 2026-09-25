"""Who holds AI compute: cumulative H100-equivalents by owner and chip designer (Epoch AI,
Data on AI Chip Owners, cumulative_by_designer.csv).
"""

import collections

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, write_data, zip_csv)

ID = "epoch_chip_owners"
URL = "https://epoch.ai/data/ai_chip_owners.zip"
PAGE = "https://epoch.ai/data/ai-chip-owners"


def run():
    fetched_at = now_iso()
    src = zip_csv(http_get_cached(URL), "cumulative_by_designer.csv")
    need = ["Chip manufacturer", "Owner", "End date", "Compute estimate in H100e (median)",
            "H100e (5th percentile)", "H100e (95th percentile)", "Power in MW (median)", "Incomplete"]
    require_columns(src, need, "cumulative_by_designer.csv")
    columns = ["owner", "designer", "quarter_end", "median", "p5", "p95", "power_mw", "incomplete"]
    rows = []
    for r in src:
        d, m = iso_date(r["End date"]), num(r["Compute estimate in H100e (median)"])
        if not d or m is None:
            continue
        rows.append([r["Owner"].strip(), r["Chip manufacturer"].strip(), d, round(m),
                     num(r["H100e (5th percentile)"]), num(r["H100e (95th percentile)"]),
                     num(r["Power in MW (median)"]), (r["Incomplete"] or "").strip().lower() == "true"])
    rows.sort(key=lambda x: (x[0], x[1], x[2]))
    owners = sorted(set(x[0] for x in rows))
    # the latest quarter every owner-designer pair reports: the fair date for a comparison
    latest = collections.defaultdict(str)
    for x in rows:
        latest[(x[0], x[1])] = max(latest[(x[0], x[1])], x[2])
    common_q = min(latest.values())
    coverage = {
        "summary": (f"Owners counted: {', '.join(owners)}. Every owner and designer pair is reported "
                    f"up to {common_q}, so that is the date the page compares. Figures are Epoch's "
                    "estimates from filings, reports and supply-chain data, with 5th to 95th percentile ranges."),
        "counted": "Chips from Nvidia, Google (TPU), AMD, Amazon (Trainium), Huawei and Cambricon, where Epoch attributes them to an owner.",
        "not_counted": ("Labs that mostly rent their compute (OpenAI and Anthropic, for example) are not listed "
                        "as owners; the chips they use are counted under whoever owns them. Everyone outside "
                        "the named companies sits in 'Other'. 'China (smuggled)' is Epoch's estimate of chips "
                        "that reached China outside export rules."),
        "numbers": {"owners": owners, "common_quarter": common_q},
    }
    payload = envelope({
        "id": ID,
        "name": "Who holds the compute",
        "what_it_measures": "Estimated cumulative AI compute owned, in H100-equivalents, by owner and by chip designer.",
        "source": "Epoch AI, Data on AI Chip Owners",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": "Epoch's README: free to use, distribute, and reproduce provided the source and authors are credited.",
        "citation": "Epoch AI, 'Data on AI Chip Owners'. Published online at epoch.ai. Retrieved from https://epoch.ai/data/ai-chip-owners",
        "redistribution": "copied",
    }, fetched_at, coverage, columns, rows, unit="H100-equivalents", source_updated=max(x[2] for x in rows))
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
