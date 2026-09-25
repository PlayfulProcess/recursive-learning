"""AI accelerators and their price-performance, from Epoch AI's Data on Machine Learning Hardware.

Price-performance here is computed ONE way for every chip, so old and new chips are comparable:
dense FP16/BF16 tensor FLOP/s divided by the release price in US dollars (not inflation-adjusted).
Epoch's own 'Price-performance' column mixes number formats across generations, so it is not used.
"""

import collections

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, sig, write_data, zip_csv)

ID = "epoch_ml_hardware"
URL = "https://epoch.ai/data/ml_hardware.zip"
PAGE = "https://epoch.ai/data/machine-learning-hardware"


def run():
    fetched_at = now_iso()
    src = zip_csv(http_get_cached(URL), "ml_hardware.csv")
    need = ["Hardware name", "Manufacturer", "Type", "Release date", "Release price (USD)",
            "Tensor-FP16/BF16 performance (FLOP/s)", "FP8 performance (FLOP/s)", "TDP (W)", "Link to datasheet"]
    require_columns(src, need, "ml_hardware.csv")
    columns = ["name", "maker", "type", "date", "price_usd", "fp16_flops", "fp8_flops", "tdp_w", "flops_per_usd", "link"]
    rows, undated = [], 0
    for r in src:
        d = iso_date(r["Release date"])
        if not d:
            undated += 1
            continue
        price, fp16 = num(r["Release price (USD)"]), num(r["Tensor-FP16/BF16 performance (FLOP/s)"])
        rows.append([r["Hardware name"].strip(), (r["Manufacturer"] or "").strip() or None,
                     (r["Type"] or "").strip() or None, d, price, sig(fp16), sig(num(r["FP8 performance (FLOP/s)"])),
                     num(r["TDP (W)"]), sig(fp16 / price) if price and fp16 else None,
                     (r["Link to datasheet"] or "").strip() or None])
    rows.sort(key=lambda x: (x[3], x[0]))
    makers = collections.Counter(x[1] or "(blank)" for x in rows)
    priced = [x for x in rows if x[8]]
    unpriced_new = [x[0] for x in rows if x[3] >= "2024-01-01" and not x[4]]
    coverage = {
        "summary": (f"{len(rows)} accelerators used to train a notable model or rented by the big clouds "
                    f"(CPUs excluded; {undated} more have no release date and are left out). Only "
                    f"{len(priced)} have both a list price and an FP16/BF16 figure, "
                    "so price-performance covers mostly chips sold on the open market. Custom chips that "
                    "are not sold have no price."),
        "counted": "By maker: " + ", ".join(f"{k} {v}" for k, v in makers.most_common(9)) + ".",
        "not_counted": ("Chips with no public price since 2024: " + ", ".join(unpriced_new[:10]) +
                        (f", and {len(unpriced_new) - 10} more" if len(unpriced_new) > 10 else "") + "."),
        "numbers": {"chips": len(rows), "priced": len(priced), "makers": dict(makers)},
    }
    payload = envelope({
        "id": ID,
        "name": "AI chips: speed per dollar",
        "what_it_measures": "For each accelerator: FP16/BF16 tensor FLOP/s, list price, and the FLOP/s each dollar buys.",
        "source": "Epoch AI, Data on Machine Learning Hardware",
        "url": URL, "page": PAGE,
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": "Epoch's README: free to use, distribute, and reproduce provided the source and authors are credited.",
        "citation": "Epoch AI, 'Data on Machine Learning Hardware'. Published online at epoch.ai. Retrieved from https://epoch.ai/data/machine-learning-hardware",
        "redistribution": "copied",
    }, fetched_at, coverage, columns, rows, unit="FLOP/s per US dollar", source_updated=rows[-1][3])
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
