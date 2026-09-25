"""Build data/summary.json from the fetched data files: fitted trends with their uncertainty,
the open-vs-closed meters side by side, the latest position on each meter, the newest data date of
each source, and plain-words sentences about where the meters disagree.

Nothing here reads the clock: every date comes from the data, so the same inputs always give the
same summary. Where a sentence needs "today" (how long ago closed models reached a level), it
carries a {{since:YYYY-MM-DD}} marker that the page fills in, in the reader's browser.
Run after the fetchers (run_all.py does both).

summary.json is our adaptation of Epoch AI's and Arena's CC BY 4.0 data: rows are filtered and
combined, and the trend lines and sentences are ours.
"""

import collections
import math
import os
import sys

from common import DATA_DIR, dumps, read_data
from fit import dec_year, fit_series, iso_of, ols, r3

OUT = os.path.join(DATA_DIR, "summary.json")
IDS = ["epoch_training_compute", "epoch_training_cost", "epoch_eci", "epoch_benchmarks_internal",
       "epoch_ml_hardware", "epoch_chip_sales", "epoch_chip_owners", "epoch_ai_companies",
       "metr_time_horizon", "arena_leaderboard"]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Epoch's own published price-performance trend, quoted beside ours (CC BY 4.0, Epoch AI).
EPOCH_HW_TREND = {
    "label": "Epoch's own fit: GPU FLOP per dollar",
    "doubling_months": 25.2, "doubling_ci": [19.2, 34.9],
    "as_of": "2023-11-09",
    "url": "https://epoch.ai/publications/trends-in-machine-learning-hardware",
    "note": ("Epoch AI, 'Trends in machine learning hardware' (Nov 2023): 2.1 years, range 1.6 to 2.9. "
             "A different number format (FP32), inflation-adjusted prices and an older set of chips, so it "
             "is shown beside ours, not merged with it."),
}


def objs(d):
    cols = d["columns"]
    return [dict(zip(cols, r)) for r in d["rows"]]


def months_between(a, b):
    return (dec_year(b) - dec_year(a)) * 12


def mon(iso, day=False):
    """'2025-07-09' -> 'Jul 2025' (or '9 Jul 2025')."""
    if not iso:
        return "?"
    y, m = iso[:4], int(iso[5:7])
    d = int(iso[8:10]) if day and len(iso) >= 10 else None
    return (f"{d} " if d else "") + f"{MON[m - 1]} {y}"


def fmt_months(m):
    if m is None:
        return "no doubling (flat or shrinking)"
    return f"{m:.1f} months" if m < 24 else f"{m / 12:.1f} years"


def fmt_range(ci):
    lo, hi = ci
    if lo is None:
        return "range unknown"
    if hi is None:
        return f"{fmt_months(lo)} to no growth at all"
    if lo >= 24 and hi >= 24:
        return f"{lo / 12:.1f} to {hi / 12:.1f} years"
    if lo < 24 and hi < 24:
        return f"{lo:.1f} to {hi:.1f} months"
    return f"{fmt_months(lo)} to {fmt_months(hi)}"


# ---------------------------------------------------------------- where each source's data stop

def newest_data(data):
    """The date of the newest data point each meter uses: not when it was fetched."""
    out = {}
    tc = objs(data["epoch_training_compute"])
    out["epoch_training_compute"] = {
        "date": max(r["date"] for r in tc if r["flop"]),
        "note": f"newest compute estimate; newest model listed {mon(max(r['date'] for r in tc), True)}"}
    out["epoch_training_cost"] = {"date": max(r["date"] for r in objs(data["epoch_training_cost"])),
                                  "note": "newest cost estimate"}
    out["epoch_eci"] = {"date": max(r["date"] for r in objs(data["epoch_eci"])), "note": "newest model scored"}
    out["epoch_benchmarks_internal"] = {"date": max(r["date"] for r in objs(data["epoch_benchmarks_internal"])),
                                        "note": "newest model tested (by release date)"}
    hw = [r for r in objs(data["epoch_ml_hardware"]) if r["flops_per_usd"]]
    out["epoch_ml_hardware"] = {"date": max(r["date"] for r in hw), "note": "newest chip with a price"}
    sales = [r for r in objs(data["epoch_chip_sales"]) if not r["incomplete"]]
    out["epoch_chip_sales"] = {"date": max(r["quarter_end"] for r in sales), "note": "newest complete quarter"}
    out["epoch_chip_owners"] = {"date": data["epoch_chip_owners"]["coverage"]["numbers"]["common_quarter"],
                                "note": "newest quarter every owner reports"}
    out["epoch_ai_companies"] = {"date": max(r["date"] for r in objs(data["epoch_ai_companies"])),
                                 "note": "newest revenue report"}
    if data.get("metr_time_horizon"):
        out["metr_time_horizon"] = {"date": data["metr_time_horizon"]["coverage"]["numbers"]["versions"][0]["newest"],
                                    "note": "newest model METR measured"}
    if data.get("arena_leaderboard"):
        out["arena_leaderboard"] = {"date": data["arena_leaderboard"].get("latest_snapshot"), "note": "newest snapshot"}
    return out


# ---------------------------------------------------------------- trends (log-scale meters)

def trends(data, ref):
    out = []
    tc = objs(data["epoch_training_compute"])
    front = [(r["date"], r["flop"]) for r in tc if r["frontier"]]
    out.append(fit_series(
        "compute_frontier", "Training compute of the biggest models", front,
        "FLOP", start="2010-01-01", ref_date=ref,
        note="Epoch's 'frontier' models (the largest at their release). Few recent ones have public estimates."))
    out.append(fit_series(
        "compute_frontier_no_spec", "Training compute, biggest models, without 'Speculative' estimates",
        [(r["date"], r["flop"]) for r in tc if r["frontier"] and r["confidence"] != "Speculative"],
        "FLOP", start="2010-01-01", ref_date=ref, note="A check on how much the guessed points move the line."))
    out[-1]["variant_of"] = "compute_frontier"
    out.append(fit_series(
        "compute_notable", "Training compute, all notable models", [(r["date"], r["flop"]) for r in tc],
        "FLOP", start="2018-01-01", ref_date=ref,
        note="Includes small models. Recent estimates come mostly from labs that disclose, often open-weights labs."))
    # how much the frontier fit depends on where it starts (point estimates only)
    starts = []
    for y in range(2010, 2023):
        pts = sorted((dec_year(d), math.log10(v)) for d, v in front if v and d >= f"{y}-01-01")
        if len(pts) >= 6:
            f = ols([p[0] for p in pts], [p[1] for p in pts])
            if f and f[0] > 0:
                starts.append((y, 12 * math.log10(2) / f[0]))
    if starts and out[0]["status"] == "ok":
        out[0]["start_sensitivity"] = {"from_years": [starts[0][0], starts[-1][0]],
                                       "doubling_months": [r3(min(s for _, s in starts)), r3(max(s for _, s in starts))]}

    cost = objs(data["epoch_training_cost"])
    out.append(fit_series(
        "cost_frontier", "Training cost of the biggest models", [(r["date"], r["cost_usd_2023"]) for r in cost if r["frontier"]],
        "2023 US dollars", start="2016-01-01", ref_date=ref, note="Final training run only. Very few recent estimates."))
    out.append(fit_series(
        "cost_frontier_no_spec", "Training cost, biggest models, without 'Speculative' estimates",
        [(r["date"], r["cost_usd_2023"]) for r in cost if r["frontier"] and r["confidence"] != "Speculative"],
        "2023 US dollars", start="2016-01-01", ref_date=ref, note="A check on how much the guessed points move the line."))
    out[-1]["variant_of"] = "cost_frontier"

    hw = [r for r in objs(data["epoch_ml_hardware"]) if r["flops_per_usd"]]
    out.append(fit_series(
        "hw_datacentre", "Chip speed per dollar, data-centre chips", [(r["date"], r["flops_per_usd"]) for r in hw
                                                                     if r.get("segment") == "data centre"],
        "FLOP/s per dollar", ref_date=ref,
        note="Data-centre accelerators with a reported or estimated price; consumer and workstation cards left out."))
    out.append(fit_series(
        "hw_all", "Chip speed per dollar, every priced chip (consumer cards included)",
        [(r["date"], r["flops_per_usd"]) for r in hw], "FLOP/s per dollar", ref_date=ref,
        note="Consumer gaming cards sit far above data-centre chips per dollar, so they pull this line around."))
    out[-1]["variant_of"] = "hw_datacentre"

    sales = objs(data["epoch_chip_sales"])
    nv = [r for r in sales if r["designer"] == "Nvidia" and not r["incomplete"]]
    out.append(fit_series(
        "shipped_nvidia", "Nvidia AI chips shipped, per quarter", [(quarter_mid(r["quarter_end"]), r["q_median"]) for r in nv],
        "H100-equivalents per quarter", block=True, ref_date=ref,
        note="Medians of Epoch's modelled estimates; incomplete quarters left out. One chipmaker's quarters, so runs of neighbouring quarters are resampled together."))
    total = shipped_total(sales)
    out.append(fit_series(
        "shipped_all", "All designers' AI chips shipped, per quarter", [(d, v) for d, v in total["points"]],
        "H100-equivalents per quarter", block=True, ref_date=ref,
        note=f"Only quarters where all {len(total['designers'])} designers are counted and complete: {total['from']} to {total['to']}."))

    rev = objs(data["epoch_ai_companies"])
    for co, key in (("Anthropic", "revenue_anthropic"), ("OpenAI", "revenue_openai")):
        out.append(fit_series(
            key, f"{co} revenue run-rate", [(r["date"], r["annualized_usd"]) for r in rev if r["company"] == co],
            "US dollars per year", start="2023-01-01", block=True, extend_months=0, ref_date=ref, scope="company",
            note=("One company growing from a small base; reported figures, disclosed or leaked. Chosen because it "
                  "has the most reports, so it is not the industry's pace. No 'if the trend continued' stretch.")))
    return out, total


def quarter_mid(end_iso):
    return iso_of(dec_year(end_iso) - 0.125)


def shipped_total(sales):
    designers = sorted(set(r["designer"] for r in sales))
    by_q = collections.defaultdict(dict)
    for r in sales:
        by_q[r["quarter_end"]][r["designer"]] = r
    pts = []
    for q in sorted(by_q):
        rs = by_q[q]
        if len(rs) == len(designers) and not any(r["incomplete"] for r in rs.values()):
            pts.append((quarter_mid(q), sum(r["q_median"] for r in rs.values())))
    return {"designers": designers, "points": pts,
            "from": pts[0][0][:7] if pts else None, "to": pts[-1][0][:7] if pts else None}


# ---------------------------------------------------------------- open vs closed, three ways

def eci_meter(data):
    rows = sorted(objs(data["epoch_eci"]), key=lambda r: (r["date"], -r["eci"]))
    closed = [r for r in rows if r["group"] == "Closed weights"]
    open_ = [r for r in rows if r["group"] == "Open weights"]
    best_open = max(open_, key=lambda r: r["eci"])
    best_closed = max(closed, key=lambda r: r["eci"])

    def first_closed_at(level):
        for r in closed:  # sorted by date
            if r["eci"] >= level:
                return r
        return None

    def lag_for(o):
        pt = first_closed_at(o["eci"])
        res = {"open_model": o["model"], "open_org": o["org"], "open_date": o["date"], "open_eci": o["eci"],
               "open_lo": o["lo"], "open_hi": o["hi"]}
        if pt is None:
            res.update({"lag_months": None, "status": "open ahead: no closed model has reached this score"})
            return res
        res.update({"closed_model": pt["model"], "closed_org": pt["org"], "closed_date": pt["date"],
                    "closed_eci": pt["eci"], "lag_months": round(months_between(pt["date"], o["date"]), 1)})
        # the range: when did closed models reach the open model's interval ends? This uses only the
        # open model's own interval; the closed models' intervals are not counted.
        lo_pt = first_closed_at(o["lo"]) if o["lo"] is not None else None
        hi_pt = first_closed_at(o["hi"]) if o["hi"] is not None else None
        res["lag_range_months"] = [
            round(months_between(hi_pt["date"], o["date"]), 1) if hi_pt else None,
            round(months_between(lo_pt["date"], o["date"]), 1) if lo_pt else None,
        ]
        return res

    # history: at each new open-weights record, how far behind was it? It starts once the index has
    # six months of closed models behind it, so the start of Epoch's data is not read as a lead.
    start = iso_of(dec_year(closed[0]["date"]) + 0.5)
    history, top = [], -1
    for o in open_:
        if o["eci"] > top:
            top = o["eci"]
            if o["date"] < start:
                continue
            history.append(lag_for(o))
    now = lag_for(best_open)
    lags = [h["lag_months"] for h in history if h["lag_months"] is not None]
    return {
        "id": "eci_lag", "source_id": "epoch_eci",
        "question": "How capable? Months until a closed model first reached the best open model's score.",
        "best_open": {k: best_open[k] for k in ("model", "org", "date", "eci", "lo", "hi")},
        "best_closed": {k: best_closed[k] for k in ("model", "org", "date", "eci", "lo", "hi")},
        "gap_points": round(best_closed["eci"] - best_open["eci"], 1),
        "range_note": "The range comes only from the uncertainty in the open model's own score; the closed models' uncertainty is not counted.",
        "history_range_months": [min(lags), max(lags)] if lags else None,
        "now": now, "history": history,
    }


def arena_meter(data):
    d = data.get("arena_leaderboard")
    if not d or not d.get("rows"):
        return None
    rows = objs(d)
    out = {"id": "arena_gap", "source_id": "arena_leaderboard",
           "question": ("How liked? The chance, implied by the ratings, that the best closed model wins a blind "
                        "vote against the best open one, counting only votes with a winner."),
           "range_note": ("Rough: it combines the arena's own intervals for the two models as if they were "
                          "independent. The chances come from the ratings, not from counting real votes between "
                          "those two models."),
           "configs": {}}
    for cfg in ("text", "text_style_control"):
        rs = [r for r in rows if r["config"] == cfg and r["open_rating"] is not None]
        if not rs:
            continue
        series = []
        for r in rs:
            gap = r["closed_rating"] - r["open_rating"]
            hw = None
            if None not in (r["closed_lo"], r["closed_hi"], r["open_lo"], r["open_hi"]):
                hw = math.sqrt(((r["closed_hi"] - r["closed_lo"]) / 2) ** 2 + ((r["open_hi"] - r["open_lo"]) / 2) ** 2)
            series.append([r["date"], round(gap, 1), round(hw, 1) if hw is not None else None,
                           round(win_prob(gap), 3)])
        last = rs[-1]
        gap = series[-1][1]
        out["configs"][cfg] = {
            "label": "raw votes" if cfg == "text" else "style-adjusted votes",
            "snapshots": len(rs), "from": rs[0]["date"], "to": rs[-1]["date"],
            "latest": {"date": last["date"], "closed_model": last["closed_model"], "closed_org": last["closed_org"],
                       "closed_rating": last["closed_rating"], "open_model": last["open_model"],
                       "open_org": last["open_org"], "open_licence": last["open_licence"],
                       "open_rating": last["open_rating"], "gap": gap, "gap_halfwidth": series[-1][2],
                       "win_prob": series[-1][3],
                       "win_prob_range": ([round(win_prob(gap - series[-1][2]), 3), round(win_prob(gap + series[-1][2]), 3)]
                                          if series[-1][2] is not None else None)},
            "columns": ["date", "gap", "gap_halfwidth_approx", "win_prob"],
            "series": series,
        }
    return out


def win_prob(gap):
    return 1 / (1 + 10 ** (-gap / 400))


def release_share(data, first_year="2019"):
    rows = objs(data["epoch_training_compute"])
    by = collections.defaultdict(lambda: [0, 0, 0])
    for r in rows:
        by[r["date"][:4]][0 if r["open"] is True else 1 if r["open"] is False else 2] += 1
    newest = max(r["date"] for r in rows)
    series = []
    early_unknown = [by[y][2] for y in sorted(by) if "2015" <= y < first_year]
    for y in sorted(by):
        if y < first_year:
            continue
        o, c, u = by[y]
        share = o / (o + c) if o + c else None
        series.append([y, o, c, u, round(share, 3) if share is not None else None])
    return {"id": "release_share", "source_id": "epoch_training_compute",
            "question": "How many? Share of notable model releases with downloadable weights, under any licence.",
            "columns": ["year", "open", "closed", "unknown", "open_share"], "series": series,
            "first_year": first_year,
            "start_note": (f"Starts in {first_year}: from 2015 to {int(first_year) - 1}, {min(early_unknown)} to "
                           f"{max(early_unknown)} notable models a year have no open or closed label, too many for a share."
                           if early_unknown else None),
            "late_note": "Epoch adds some models months after release, so the newest year can still change.",
            "partial_year": newest[:4], "newest": newest}


# ---------------------------------------------------------------- where each meter stands now

def positions(data, tr):
    pos = {}
    tc = [r for r in objs(data["epoch_training_compute"]) if r["flop"]]
    top = max(tc, key=lambda r: r["flop"])
    pos["epoch_training_compute"] = {"label": "Largest training run with an estimate", "value": top["flop"], "unit": "FLOP",
                                     "who": top["model"], "org": top["org"], "date": top["date"],
                                     "confidence": top["confidence"]}
    cost = objs(data["epoch_training_cost"])
    topc = max(cost, key=lambda r: r["cost_usd_2023"])
    pos["epoch_training_cost"] = {"label": "Costliest training run with an estimate", "value": topc["cost_usd_2023"],
                                  "unit": "2023 US dollars", "who": topc["model"], "org": topc["org"], "date": topc["date"],
                                  "confidence": topc["confidence"]}
    eci = objs(data["epoch_eci"])
    tope = max(eci, key=lambda r: r["eci"])
    pos["epoch_eci"] = {"label": "Highest index score", "value": tope["eci"], "lo": tope["lo"], "hi": tope["hi"],
                        "unit": "ECI", "who": tope["model"], "org": tope["org"], "date": tope["date"]}
    hw = [r for r in objs(data["epoch_ml_hardware"]) if r["flops_per_usd"]]
    dc = [r for r in hw if r.get("segment") == "data centre"]
    t = next(x for x in tr if x["id"] == "hw_datacentre")
    pos["epoch_ml_hardware"] = {"label": "Data-centre chips: months for FLOP/s per dollar to double",
                                "trend": "hw_datacentre", "chips": len(dc), "priced_all": len(hw),
                                "value": t.get("whole", {}).get("doubling_months") if t["status"] == "ok" else None,
                                "newest": max(r["date"] for r in dc) if dc else None,
                                "estimated": [r["name"] for r in hw if r.get("price_kind") == "estimate"]}
    sales = objs(data["epoch_chip_sales"])
    last_nv = max((r for r in sales if r["designer"] == "Nvidia" and not r["incomplete"]), key=lambda r: r["quarter_end"])
    pos["epoch_chip_sales"] = {"label": "Nvidia AI compute shipped in its latest complete quarter", "value": last_nv["q_median"],
                               "unit": "H100-equivalents", "who": "Nvidia", "org": "Nvidia", "date": last_nv["quarter_end"]}
    own = objs(data["epoch_chip_owners"])
    q = data["epoch_chip_owners"]["coverage"]["numbers"]["common_quarter"]
    tot = collections.Counter()
    for r in own:
        if r["quarter_end"] == q:
            tot[r["owner"]] += r["median"]
    o, v = tot.most_common(1)[0]
    pos["epoch_chip_owners"] = {"label": "Largest holder of AI compute", "value": v, "unit": "H100-equivalents",
                                "who": o, "org": o, "date": q, "world_total": sum(tot.values())}
    rev = objs(data["epoch_ai_companies"])
    latest = {}
    for r in rev:
        if r["company"] not in latest or r["date"] > latest[r["company"]]["date"]:
            latest[r["company"]] = r
    topr = max(latest.values(), key=lambda r: r["annualized_usd"])
    pos["epoch_ai_companies"] = {"label": "Highest reported revenue run-rate", "value": topr["annualized_usd"],
                                 "unit": "US dollars per year", "who": topr["company"], "org": topr["company"], "date": topr["date"]}
    b = objs(data["epoch_benchmarks_internal"])
    bm = {x["id"]: x for x in data["epoch_benchmarks_internal"]["benchmarks"]}
    pos["epoch_benchmarks_internal"] = {"label": "Best score on each hard test", "items": [],
                                        "note": ("Room left if every answer key is right. A test with some wrong answer "
                                                 "keys has a real ceiling below 100%. Two scores within two standard "
                                                 "errors of each other are called tied.")}
    for bid, m in bm.items():
        rs = sorted((r for r in b if r["bench"] == bid), key=lambda r: -r["score"])
        t1 = rs[0]
        t2 = next((r for r in rs[1:] if r["model"] != t1["model"]), None)
        tied = None
        if t2 is not None:
            se = math.sqrt((t1["stderr"] or 0) ** 2 + (t2["stderr"] or 0) ** 2)
            tied = bool(se) and (t1["score"] - t2["score"]) <= 2 * se
        newest = max(rs, key=lambda r: (r["date"], r["score"]))
        ceiling = m.get("score_ceiling") or 1.0
        pos["epoch_benchmarks_internal"]["items"].append({
            "bench": bid, "name": m["name"], "value": t1["score"], "stderr": t1["stderr"], "who": t1["model"],
            "org": t1["org"], "date": t1["date"], "ceiling": ceiling,
            "room_left_if_keys_right": round(ceiling - t1["score"], 3),
            "runner_up": ({"who": t2["model"], "org": t2["org"], "value": t2["score"], "stderr": t2["stderr"],
                           "date": t2["date"]} if t2 else None),
            "tied": tied,
            "newest_tested": {"who": newest["model"], "org": newest["org"], "date": newest["date"], "value": newest["score"]}})
    metr = data.get("metr_time_horizon")
    if metr:
        pos["metr_time_horizon"] = {"label": "Newest model METR has measured", "value": None,
                                    "who": metr["coverage"]["numbers"]["versions"][0]["newest_model"],
                                    "date": metr["coverage"]["numbers"]["versions"][0]["newest"], "link_only": True}
    return pos


# ---------------------------------------------------------------- plain words

def tr_by(tr, key):
    return next((t for t in tr if t["id"] == key), None)


def speed_item(t, extra=""):
    w = t["whole"]
    return (f"{t['label']}: {fmt_months(w['doubling_months'])} ({fmt_range(w['doubling_ci'])}), "
            f"{mon(w['from'])} to {mon(w['to'])}, {w['n']} points.{extra}")


def sentences(tr, eci, arena, share, metr, data, newest):
    out = []

    # 1. open vs closed, three meters that don't agree
    items = []
    n = eci["now"]
    if n.get("lag_months") is not None:
        rng = n.get("lag_range_months") or [None, None]
        hr = eci.get("history_range_months")
        items.append(
            f"Epoch's capability index: the best open-weights model, {n['open_model']} ({n['open_org']}, {mon(n['open_date'], True)}), "
            f"was about {n['lag_months']:.0f} months behind when it came out: a closed model, {n['closed_model']}, had first "
            f"reached its score on {mon(n['closed_date'], True)}"
            + (f" (range {rng[0]:.0f} to {rng[1]:.0f} months, from the uncertainty in {n['open_model']}'s own score only)"
               if None not in rng else "")
            + f". No open model has beaten it since, so as of today closed models reached that level {{{{since:{n['closed_date']}}}}}. "
            f"It is {eci['gap_points']} points below the best closed model ({eci['best_closed']['model']}, "
            f"{mon(eci['best_closed']['date'], True)})."
            + (f" Over time this gap has ranged from {hr[0]:.0f} to {hr[1]:.0f} months, so any single number is a snapshot."
               if hr else "")
            + f" Index data to {mon(newest['epoch_eci']['date'], True)}.")
    elif n.get("status"):
        items.append(f"Epoch's capability index: {n['status']}.")
    if arena and arena["configs"]:
        bits = []
        for cfg in ("text_style_control", "text"):
            c = arena["configs"].get(cfg)
            if not c:
                continue
            lt = c["latest"]
            r = lt.get("win_prob_range")
            bits.append(f"about {lt['win_prob'] * 100:.0f}% using {c['label']}"
                        + (f" (rough range {r[0] * 100:.0f} to {r[1] * 100:.0f}%)" if r else ""))
        snap = (arena["configs"].get("text_style_control") or arena["configs"].get("text"))["latest"]["date"]
        items.append("Arena's blind votes: the ratings imply the best closed model would win, of the votes that have "
                     "a winner, " + ", or ".join(bits) + ". That is close to a coin flip. These chances come from the "
                     f"ratings, not from counting real votes between those two models. Snapshot of {mon(snap, True)}.")
    full = [s for s in share["series"] if s[0] < share["partial_year"] and s[4] is not None]
    cur = next((s for s in share["series"] if s[0] == share["partial_year"]), None)
    if full:
        y = full[-1]
        items.append(f"Releases: {y[1]} of the {y[1] + y[2]} notable models released in {y[0]} "
                     f"({y[4] * 100:.0f}%) had downloadable weights under any licence"
                     + (f" ({y[3]} more have no stated status and are not counted)" if y[3] else "")
                     + (f"; so far in {cur[0]} it is {cur[4] * 100:.0f}% (to {mon(share['newest'], True)})" if cur and cur[4] is not None else "")
                     + ". Each model counts once, whatever its size or how much it is used.")
    items.append("Share of actual use: no official, openly licensed source exists. The public views that do exist, "
                 "such as OpenRouter's rankings, see one router's paid API traffic and miss the companies' own apps.")
    out.append({"topic": "open_vs_closed", "meters": ["epoch_eci", "arena_leaderboard", "epoch_training_compute", "usage"],
                "text": "Open against closed: three meters that don't agree.", "items": items})

    # 2. how fast, by meter: industry-wide first, single companies on their own line
    items = []
    t = tr_by(tr, "compute_frontier")
    if t and t["status"] == "ok":
        ss = t.get("start_sensitivity")
        tc = objs(data["epoch_training_compute"])
        newest_list = max(r["date"] for r in tc)
        since = iso_of(dec_year(newest_list) - 1)
        recent_front = sum(1 for r in tc if r["frontier"] and r["flop"] and r["date"] >= since)
        extra = ((f" Starting the fit anywhere from {ss['from_years'][0]} to {ss['from_years'][1]} gives "
                  f"{ss['doubling_months'][0]:.1f} to {ss['doubling_months'][1]:.1f} months." if ss else "")
                 + f" Single models land about {t['whole']['scatter_x90']:.0f} times above or below the line."
                 + f" {recent_front} of these models released in the 12 months to {mon(newest_list, True)} "
                   f"{'has' if recent_front == 1 else 'have'} an estimate.")
        items.append(speed_item(t, extra))
    t, ta = tr_by(tr, "hw_datacentre"), tr_by(tr, "hw_all")
    if t and t["status"] == "ok":
        extra = ""
        if ta and ta["status"] == "ok":
            extra += (f" Every priced chip, the {ta['whole']['n'] - t['whole']['n']} consumer and workstation cards "
                      f"included: {fmt_months(ta['whole']['doubling_months'])} ({fmt_range(ta['whole']['doubling_ci'])}).")
        extra += (f" Epoch's own published trend (Nov 2023; FP32, ML GPUs): "
                  f"{EPOCH_HW_TREND['doubling_months'] / 12:.1f} years ({EPOCH_HW_TREND['doubling_ci'][0] / 12:.1f} to "
                  f"{EPOCH_HW_TREND['doubling_ci'][1] / 12:.1f}). Too few chips for a firm headline.")
        items.append(speed_item(t, extra))
    t, ta = tr_by(tr, "shipped_nvidia"), tr_by(tr, "shipped_all")
    if t and t["status"] == "ok":
        extra = ""
        if ta and ta["status"] == "ok":
            extra = (f" All designers together: {fmt_months(ta['whole']['doubling_months'])} "
                     f"({fmt_range(ta['whole']['doubling_ci'])}), measured on {mon(ta['whole']['from'])} to "
                     f"{mon(ta['whole']['to'])} only, the quarters where every designer is counted.")
        items.append(speed_item(t, extra))
    comp = [x for x in tr if x.get("scope") == "company" and x["status"] == "ok" and x["whole"]["doubling_months"]]
    comp.sort(key=lambda x: x["whole"]["doubling_months"])
    if comp:
        items.append("Single companies, growing from a small base and picked because they have the most reports: "
                     + "; ".join(f"{x['label']} {fmt_months(x['whole']['doubling_months'])} "
                                 f"({fmt_range(x['whole']['doubling_ci'])}, {mon(x['whole']['from'])} to {mon(x['whole']['to'])})"
                                 for x in comp)
                     + ". They are not the industry's pace.")
    if metr:
        q = {(x["version"], x["window"]): x for x in metr["quoted"]}
        a, b = q.get(("v1.1", "from 2023 on")), q.get(("v1.0", "from 2023 on"))
        if a and b:
            overlap = (a["ci_low_days"] is not None and b["ci_low_days"] is not None
                       and a["ci_low_days"] <= b["ci_high_days"] and b["ci_low_days"] <= a["ci_high_days"])
            txt = (f"METR, quoting its own fits from 2023 on: version 1.1 {a['doubling_days'] / 30.44:.1f} months "
                   f"(its range {a['ci_low_days'] / 30.44:.1f} to {a['ci_high_days'] / 30.44:.1f}); version 1.0 "
                   f"{b['doubling_days'] / 30.44:.1f} months ({b['ci_low_days'] / 30.44:.1f} to {b['ci_high_days'] / 30.44:.1f}). "
                   + ("The ranges overlap, so the versions differ rather than disagree." if overlap
                      else "The ranges do not overlap: the versions disagree."))
            aa = [x for x in metr["quoted"] if x["window"].startswith("all time")]
            if len(aa) == 2:
                txt += (" Over all years: " + " and ".join(f"{x['doubling_days'] / 30.44:.1f}" for x in aa) + " months.")
            txt += f" Newest model measured: {mon(newest['metr_time_horizon']['date'], True)}."
            items.append(txt)
    out.append({"topic": "speed", "meters": [x["id"] for x in tr if not x.get("variant_of")] + ["metr_time_horizon"],
                "text": ("How fast things double depends on the meter (whole period, with the 90% range of the fit). "
                         "They count different things, so they sit side by side, never averaged."),
                "items": items})

    # 3. has the pace changed? Each verdict names its own dates
    items, verdicts = [], 0
    for t in tr:
        if t["status"] != "ok" or t.get("variant_of"):
            continue
        ch = t["change"]
        if ch["verdict"] == "too few points":
            rn, bn, need = ch.get("recent_n"), ch.get("before_n"), ch.get("min_points", 6)
            why = (f"only {rn} points in the last {ch['recent_months']} months of its data" if rn is not None and rn < need
                   else f"the series covers little more than the last {ch['recent_months']} months" if not bn
                   else f"only {bn} points before the last {ch['recent_months']} months of its data")
            items.append(f"{t['label']}: can't be judged, {why} ({need} needed on each side).")
            continue
        verdicts += 1
        r, b = ch["recent"], ch["before"]
        s = (f"{t['label']}: {ch['verdict']} ({mon(r['from'])} to {mon(r['to'])}, {r['n']} points, against "
             f"{mon(b['from'])} to {mon(b['to'])}, {b['n']} points).")
        if t["id"] == "cost_frontier":
            cost = [x for x in objs(data["epoch_training_cost"]) if x["frontier"] and x["date"] >= r["from"]]
            spec = sum(1 for x in cost if x["confidence"] == "Speculative")
            s += (f" Weak evidence: {spec} of the {len(cost)} recent points are 'Speculative', and the data stop in "
                  f"{mon(r['to'])}.")
            ns = tr_by(tr, "cost_frontier_no_spec")
            if ns and ns["status"] == "ok":
                s += f" Without 'Speculative' estimates: {ns['change']['verdict']}."
        if t["id"] == "compute_notable" and ch["verdict"] == "slower lately":
            s += (f" This probably reflects who discloses, not the industry: recent estimates come mostly from "
                  f"open-weights labs with smaller models, and the recent doubling time "
                  f"({fmt_months(t['recent']['doubling_months'])}) could also be flat.")
        if "blocks" in (t["whole"].get("resampling") or ""):
            s += " Neighbouring points were resampled together, since they move together."
        items.append(s)
    luck = 1 - 0.9 ** verdicts if verdicts else 0
    if verdicts:
        items.append(f"Some 'changes' could be luck: {verdicts} of these checks give a verdict, and even if nothing had "
                     f"changed, the chance that at least one would say 'changed' is about {luck * 100:.0f}%.")
    out.append({"topic": "bend", "meters": [t["id"] for t in tr if not t.get("variant_of")],
                "text": "Has the pace changed? The last 24 months of each meter's data, against the years before.",
                "items": items, "false_alarm_chance": round(luck, 2)})

    # 4. who discloses
    cov = data["epoch_training_compute"]["coverage"]["numbers"]
    labs = [o for o in cov["recent_by_org"] if o["released"] >= 4]
    rarely = [o for o in labs if o["with_value"] / o["released"] <= 0.25]
    often = [o for o in labs if o["with_value"] / o["released"] >= 0.5]
    items = []
    if rarely:
        items.append("Labs that rarely disclose: " + ", ".join(f"{o['org']} {o['with_value']} of {o['released']}" for o in rarely) + ".")
    if often:
        items.append("Labs that often disclose: " + ", ".join(f"{o['org']} {o['with_value']} of {o['released']}" for o in often) + ".")
    out.append({"topic": "coverage", "meters": ["epoch_training_compute", "epoch_training_cost"],
                "text": (f"Who discloses: of the {cov['recent_models']} notable models released between "
                         f"{mon(cov['recent_since'], True)} and {mon(data['epoch_training_compute'].get('source_updated'), True)}, "
                         f"{cov['recent_with_estimate']} have a compute estimate. The newest part of any compute curve leans on whoever discloses."),
                "items": items})
    return out


def main():
    data = {i: read_data(i) for i in IDS}
    missing = [i for i in IDS if data[i] is None and i not in ("arena_leaderboard", "metr_time_horizon")]
    if missing:
        print(f"build_summary: missing data files {missing}", file=sys.stderr)
        sys.exit(1)
    ref = max((d or {}).get("fetched_at", "") for d in data.values())[:10]
    newest = newest_data(data)
    tr, total = trends(data, ref)
    eci = eci_meter(data)
    arena = arena_meter(data)
    share = release_share(data)
    metr = data.get("metr_time_horizon")
    metr_q = []
    if metr:
        for x in metr["quoted"]:
            metr_q.append({"id": f"metr_{x['version']}_{x['window'].replace(' ', '_')}",
                           "label": f"METR time horizon, {x['version']}, {x['window']}",
                           "doubling_months": r3(x["doubling_days"] / 30.44),
                           "doubling_ci": [r3(x["ci_low_days"] / 30.44) if x["ci_low_days"] else None,
                                           r3(x["ci_high_days"] / 30.44) if x["ci_high_days"] else None],
                           "quoted": True, "note": x.get("note"),
                           "range_note": "METR's own range, from its own method: not our 90% bootstrap."})
    summary = {
        "about": ("Our adaptation of Epoch AI's and Arena's CC BY 4.0 data (credited per source below): rows "
                  "filtered and combined; the trend lines, positions and sentences are ours. METR's figures are "
                  "quoted with attribution only."),
        "as_of": max((d or {}).get("fetched_at", "") for d in data.values()),
        "ref_date": ref,
        "sources": {i: {"fetched_at": d.get("fetched_at"), "source_updated": d.get("source_updated"),
                        "newest_data": newest.get(i, {}).get("date"), "newest_note": newest.get(i, {}).get("note"),
                        "licence": d.get("licence"), "redistribution": d.get("redistribution"),
                        "changes": d.get("changes")}
                    for i, d in data.items() if d},
        "trends": tr,
        "metr_quoted": metr_q,
        "epoch_hw_trend": EPOCH_HW_TREND,
        "open_vs_closed": {"eci": eci, "arena": arena, "release_share": share},
        "positions": positions(data, tr),
        "sentences": sentences(tr, eci, arena, share, metr, data, newest),
    }
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(dumps(summary))
    print("build_summary: written")


if __name__ == "__main__":
    main()
