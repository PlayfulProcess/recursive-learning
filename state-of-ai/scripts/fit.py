"""Trend fitting for the state-of-ai page. Python standard library only, deterministic.

A steady exponential is a straight line on a log scale, so every trend here is an ordinary
least-squares line through log10(value) against time in years. Its uncertainty comes from a
bootstrap: resample 1,000 times, refit, and read the 5th and 95th percentiles (a 90% interval).
The random seed is fixed per series, so the same data always gives the same numbers and a weekly
refresh only changes what the data changed.

Two ways to resample:
  points   each point drawn independently (lists of models or chips: one row is one release)
  blocks   runs of neighbouring points drawn together (a moving-block bootstrap), for series about
           one company or one chipmaker (revenue, shipments), where neighbouring points move
           together and drawing them one by one makes the range too narrow

What the numbers are, in plain words:
  doubling_months   how many months the fitted line takes to double
  band              the 90% range of where the fitted LINE could be (not where points fall)
  scatter_x90       nine points in ten sit within this factor of the line, above or below
  if_trend_continued  twelve months past the last point: [t, line_lo, fit, line_hi, point_lo,
                    point_hi]; the point range adds how far single points land from the line.
                    Never a forecast, and left out when the data stopped too long ago
  change            whether the last 24 months of data run faster or slower than the years
                    before, judged by whether the 90% interval of the difference in slopes
                    excludes zero; both windows carry their own dates and number of points
"""

import math
import random
from datetime import date, timedelta

B = 1000
LOG2 = math.log10(2)


def dec_year(iso):
    d = date.fromisoformat(iso[:10])
    start = date(d.year, 1, 1)
    days = (date(d.year + 1, 1, 1) - start).days
    return d.year + ((d - start).days + 0.5) / days


def iso_of(t):
    y = int(math.floor(t))
    start = date(y, 1, 1)
    days = (date(y + 1, 1, 1) - start).days
    return (start + timedelta(days=int((t - y) * days))).isoformat()


def ols(ts, ys):
    n = len(ts)
    mt, my = sum(ts) / n, sum(ys) / n
    sxx = sum((t - mt) ** 2 for t in ts)
    if sxx == 0:
        return None
    b = sum((t - mt) * (y - my) for t, y in zip(ts, ys)) / sxx
    return b, my - b * mt


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    f, c = math.floor(k), math.ceil(k)
    return xs[f] if f == c else xs[f] + (xs[c] - xs[f]) * (k - f)


def seed_of(key):
    return sum((i + 1) * ord(ch) for i, ch in enumerate(key)) % 2 ** 31


def block_len(n):
    """Moving-block length: the usual n^(1/3) rule, at least 2."""
    return max(2, int(round(n ** (1 / 3))))


def resample_idx(rng, n, block):
    if not block:
        return [rng.randrange(n) for _ in range(n)]
    L = min(block, n)
    idx = []
    while len(idx) < n:
        s = rng.randrange(n - L + 1)
        idx.extend(range(s, s + L))
    return idx[:n]


def boot(ts, ys, key, b=B, block=None):
    rng = random.Random(seed_of(key))
    n = len(ts)
    out = []
    for _ in range(b):
        idx = resample_idx(rng, n, block)
        r = ols([ts[i] for i in idx], [ys[i] for i in idx])
        if r:
            out.append(r)
    return out


def doubling(slope):
    """Months to double for a slope in log10 units per year; None if not growing."""
    return 12 * LOG2 / slope if slope and slope > 0 else None


def r3(x):
    return None if x is None else float(f"{x:.3g}")


def lag1(xs):
    """Lag-1 autocorrelation: near 0 when neighbours are independent, near 1 when they move together."""
    n = len(xs)
    if n < 4:
        return None
    m = sum(xs) / n
    den = sum((x - m) ** 2 for x in xs)
    return None if den == 0 else sum((xs[i] - m) * (xs[i + 1] - m) for i in range(n - 1)) / den


def describe(ts, ys, key, block=False):
    fit = ols(ts, ys)
    if not fit:
        return None
    L = block_len(len(ts)) if block else None
    bs = boot(ts, ys, key, block=L)
    slopes = [s for s, _ in bs]
    lo, hi = pct(slopes, 0.05), pct(slopes, 0.95)
    resid = [y - (fit[1] + fit[0] * t) for t, y in zip(ts, ys)]
    return {
        "n": len(ts), "from": iso_of(min(ts)), "to": iso_of(max(ts)),
        "resampling": f"blocks of {L} neighbouring points" if L else "single points",
        "slope_log10_per_year": r3(fit[0]),
        "slope_ci": [r3(lo), r3(hi)],
        "x_per_year": r3(10 ** fit[0]),
        "x_per_year_ci": [r3(10 ** lo), r3(10 ** hi)],
        "doubling_months": r3(doubling(fit[0])),
        # a faster slope means a SHORTER doubling time, so the bounds swap; None = could be flat
        "doubling_ci": [r3(doubling(hi)), r3(doubling(lo))],
        "scatter_x90": r3(10 ** pct([abs(r) for r in resid], 0.90)),
        "resid_lag1": r3(lag1(resid)),
        "_fit": fit, "_boot": bs, "_resid": resid,
    }


def fit_series(key, label, points, unit, start=None, recent_months=24, min_points=6,
               extend_months=12, grid=48, note=None, block=False, ref_date=None, scope="industry"):
    """points: [(iso_date, value > 0)]. Returns the JSON-ready description of one trend.

    block: resample runs of neighbouring points (one company's or one chipmaker's series).
    ref_date: the newest date seen in any source (from the data, never the clock). When the
      twelve-month 'if the trend continued' stretch would end before it, the stretch is left out
      and `data_stop` says when the data stop.
    scope: 'industry' (many makers or models) or 'company' (one firm's own numbers)."""
    pts = sorted((dec_year(d), math.log10(v)) for d, v in points
                 if v is not None and v > 0 and (start is None or d >= start))
    out = {"id": key, "label": label, "unit": unit, "note": note, "scope": scope}
    if len(pts) < min_points:
        out.update({"n": len(pts), "status": "too few points"})
        return out
    ts, ys = [p[0] for p in pts], [p[1] for p in pts]
    whole = describe(ts, ys, key, block)
    t0, t1 = min(ts), max(ts)
    band = [_band_at(t0 + (t1 - t0) * i / grid, whole) for i in range(grid + 1)]
    ext, data_stop = [], None
    ref = dec_year(ref_date) if ref_date else None
    if ref is not None and ref - t1 > 0.5:
        data_stop = iso_of(t1)[:7]
    if extend_months and not (ref is not None and t1 + extend_months / 12 < ref):
        rng = random.Random(seed_of(key + ":ext"))
        for i in range(1, 13):
            t = t1 + extend_months / 12 * i / 12
            ext.append(_band_at(t, whole, rng))
    cut = t1 - recent_months / 12
    rec_idx = [i for i, t in enumerate(ts) if t > cut]
    old_idx = [i for i, t in enumerate(ts) if t <= cut]
    recent = before = None
    change = {"verdict": "too few points", "recent_months": recent_months,
              "recent_n": len(rec_idx), "before_n": len(old_idx), "min_points": min_points}
    if len(rec_idx) >= min_points:
        recent = describe([ts[i] for i in rec_idx], [ys[i] for i in rec_idx], key + ":recent", block)
    if len(old_idx) >= min_points:
        before = describe([ts[i] for i in old_idx], [ys[i] for i in old_idx], key + ":before", block)
    if recent and before:
        diffs = [a[0] - b[0] for a, b in zip(recent["_boot"], before["_boot"])]
        lo, hi = pct(diffs, 0.05), pct(diffs, 0.95)
        verdict = "faster lately" if lo > 0 else "slower lately" if hi < 0 else "no clear change"
        change = {"verdict": verdict, "recent_months": recent_months,
                  "slope_diff_ci": [r3(lo), r3(hi)],
                  "recent": {"from": recent["from"], "to": recent["to"], "n": recent["n"]},
                  "before": {"from": before["from"], "to": before["to"], "n": before["n"]}}
    out.update({
        "status": "ok",
        "whole": _public(whole), "recent": _public(recent), "before": _public(before),
        "change": change, "band": band, "if_trend_continued": ext, "data_stop": data_stop,
    })
    return out


def _band_at(t, d, rng=None):
    """[t, line_lo, fit, line_hi] and, with rng, [.., point_lo, point_hi]: the line's own 90% range,
    then the wider range where a single new point could land (line draw plus a drawn residual)."""
    a, b = d["_fit"][1], d["_fit"][0]
    preds = [ic + sl * t for sl, ic in d["_boot"]]
    row = [round(t, 3), round(pct(preds, 0.05), 3), round(a + b * t, 3), round(pct(preds, 0.95), 3)]
    if rng is not None:
        res = d["_resid"]
        pp = [p + res[rng.randrange(len(res))] for p in preds]
        row += [round(pct(pp, 0.05), 3), round(pct(pp, 0.95), 3)]
    return row


def _public(d):
    return None if d is None else {k: v for k, v in d.items() if not k.startswith("_")}
