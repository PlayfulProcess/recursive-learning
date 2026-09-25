"""AI accelerators and their price-performance, from Epoch AI's Data on Machine Learning Hardware.

Price-performance here is computed ONE way for every chip, so old and new chips are comparable:
dense FP16/BF16 tensor FLOP/s divided by the release price in US dollars (not inflation-adjusted).
Epoch's own 'Price-performance' column mixes number formats across generations, so it is not used.

Two labels are ours, so the page can keep unlike things apart:
  segment      'data centre', 'workstation' or 'consumer' (GeForce gaming cards), from the name.
               Consumer cards sit far above data-centre chips per dollar and are not what large
               training runs use, so the headline trend is data-centre chips only.
  price_kind   'maker launch price' (a consumer card's announced price), 'estimate' (Epoch's own
               modelled price, for a chip that is not sold, such as Google's TPUs) or 'reported'
               (a price from a reseller, analyst or news report: data-centre makers rarely publish one).
For GeForce cards, Epoch's tensor FP16 figure appears to be the rate with FP16 accumulation; Nvidia's
own spec sheets give half that with FP32 accumulation, which training usually uses. The page says so.
"""

import collections

import re

from common import (CC_BY_4, envelope, http_get_cached, iso_date, main_wrapper, now_iso, num,
                    require_columns, sig, write_data, zip_csv)

ID = "epoch_ml_hardware"
URL = "https://epoch.ai/data/ml_hardware.zip"
PAGE = "https://epoch.ai/data/machine-learning-hardware"


def segment(name):
    n = name.lower()
    if "rtx pro" in n or "quadro" in n or re.search(r"\brtx a\d", n):
        return "workstation"
    if "geforce" in n or re.search(r"\brtx \d{4}\b", n) or re.search(r"\bradeon rx\b", n):
        return "consumer"
    return "data centre"


def price_kind(seg, price, source):
    if not price:
        return None
    src = (source or "").lower()
    if "epoch.ai" in src:
        return "estimate"
    return "maker launch price" if seg == "consumer" else "reported"


def run():
    fetched_at = now_iso()
    src = zip_csv(http_get_cached(URL), "ml_hardware.csv")
    need = ["Hardware name", "Manufacturer", "Type", "Release date", "Release price (USD)",
            "Tensor-FP16/BF16 performance (FLOP/s)", "FP8 performance (FLOP/s)", "TDP (W)", "Link to datasheet",
            "Source for the price"]
    require_columns(src, need, "ml_hardware.csv")
    columns = ["name", "maker", "type", "date", "price_usd", "fp16_flops", "fp8_flops", "tdp_w", "flops_per_usd", "link",
               "segment", "price_kind", "price_source"]
    rows, undated = [], 0
    for r in src:
        d = iso_date(r["Release date"])
        if not d:
            undated += 1
            continue
        price, fp16 = num(r["Release price (USD)"]), num(r["Tensor-FP16/BF16 performance (FLOP/s)"])
        name = r["Hardware name"].strip()
        seg = segment(name)
        psrc = (r["Source for the price"] or "").strip() or None
        rows.append([name, (r["Manufacturer"] or "").strip() or None,
                     (r["Type"] or "").strip() or None, d, price, sig(fp16), sig(num(r["FP8 performance (FLOP/s)"])),
                     num(r["TDP (W)"]), sig(fp16 / price) if price and fp16 else None,
                     (r["Link to datasheet"] or "").strip() or None,
                     seg, price_kind(seg, price, psrc), psrc if price else None])
    rows.sort(key=lambda x: (x[3], x[0]))
    makers = collections.Counter(x[1] or "(blank)" for x in rows)
    priced = [x for x in rows if x[8]]
    seg_n = collections.Counter(x[10] for x in priced)
    estimated = [x[0] for x in priced if x[11] == "estimate"]
    unpriced_new = [x[0] for x in rows if x[3] >= "2024-01-01" and not x[4]]
    coverage = {
        "summary": (f"{len(rows)} accelerators used to train a notable model or rented by the big clouds "
                    f"(CPUs excluded; {undated} more have no release date and are left out). Only "
                    f"{len(priced)} have both a price and an FP16/BF16 figure: "
                    + ", ".join(f"{v} {k}" for k, v in seg_n.most_common()) + ". Data-centre makers rarely "
                    "publish a price, so those are reported prices"
                    + (f", and {', '.join(estimated)} carries Epoch's own estimate for a chip that is not sold"
                       if estimated else "") + ". Most custom chips have no price at all."),
        "counted": "By maker: " + ", ".join(f"{k} {v}" for k, v in makers.most_common(9)) + ".",
        "not_counted": ("Chips with no public price since 2024: " + ", ".join(unpriced_new[:10]) +
                        (f", and {len(unpriced_new) - 10} more" if len(unpriced_new) > 10 else "") + "."),
        "numbers": {"chips": len(rows), "priced": len(priced), "priced_by_segment": dict(seg_n),
                    "estimated_prices": estimated, "makers": dict(makers),
                    "newest_priced": max((x[3] for x in priced), default=None)},
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
        "changes": ("From ml_hardware.csv: chips with a release date kept; 10 columns kept and renamed; FLOP/s per dollar computed by us (FP16/BF16 FLOP/s divided by release price); the segment (data centre, workstation, consumer) and the kind of price are our labels, from the chip's name and Epoch's price source."
                    " Coverage notes, trend lines and summaries (summary.json) are ours."),
    }, fetched_at, coverage, columns, rows, unit="FLOP/s per US dollar", source_updated=rows[-1][3])
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
