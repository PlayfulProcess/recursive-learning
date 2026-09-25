"""Build data/summary.json from the fetched data files: fitted trends with their uncertainty,
the open-vs-closed meters side by side, the latest position on each meter, and plain-words
sentences about where the meters disagree.

Nothing here reads the clock: every date comes from the data, so the same inputs always give the
same summary. Run after the fetchers (run_all.py does both).
"""

import collections
import json
import math
import os
import sys

from common import DATA_DIR, dumps, read_data
from fit import dec_year, fit_series, iso_of, r3

OUT = os.path.join(DATA_DIR, "summary.json")


def objs(d):
    cols = d["columns"]
    return [dict(zip(cols, r)) for r in d["rows"]]


def months_between(a, b):
    return (dec_year(b) - dec_year(a)) * 12


# ---------------------------------------------------------------- trends (log-scale meters)

def trends(data):
    out = []
    tc = objs(data["epoch_training_compute"])
    out.append(fit_series(
        "compute_frontier", "Training compute, frontier models", [(r["date"], r["flop"]) for r in tc if r["frontier"]],
        "FLOP", start="2010-01-01",
        note="Epoch's 'frontier' models (the largest at their release). Few recent ones have public estimates."))
    out.append(fit_series(
        "compute_frontier_no_spec", "Training compute, frontier, without 'Speculative' estimates",
        [(r["date"], r["flop"]) for r in tc if r["frontier"] and r["confidence"] != "Speculative"],
        "FLOP", start="2010-01-01", note="A check on how much the guessed points move the line."))
    out[-1]["variant_of"] = "compute_frontier"
    out.append(fit_series(
        "compute_notable", "Training compute, all notable models", [(r["date"], r["flop"]) for r in tc],
        "FLOP", start="2018-01-01",
        note="Includes small models. Recent estimates come mostly from labs that disclose, often open-weights labs."))

    cost = objs(data["epoch_training_cost"])
    out.append(fit_series(
        "cost_frontier", "Training cost, frontier models", [(r["date"], r["cost_usd_2023"]) for r in cost if r["frontier"]],
        "2023 US dollars", start="2016-01-01", note="Final training run only. Very few recent estimates."))

    hw = objs(data["epoch_ml_hardware"])
    out.append(fit_series(
        "hw_price_performance", "Chip speed per dollar (FP16/BF16)", [(r["date"], r["flops_per_usd"]) for r in hw],
        "FLOP/s per dollar", note="Chips with a public list price only; most custom chips have none."))

    sales = objs(data["epoch_chip_sales"])
    nv = [r for r in sales if r["designer"] == "Nvidia" and not r["incomplete"]]
    out.append(fit_series(
        "shipped_nvidia", "Nvidia AI compute shipped per quarter", [(quarter_mid(r["quarter_end"]), r["q_median"]) for r in nv],
        "H100-equivalents per quarter", recent_months=24,
        note="Medians of Epoch's modelled estimates; incomplete quarters left out."))
    total = shipped_total(sales)
    out.append(fit_series(
        "shipped_all", "All designers' AI compute shipped per quarter", [(d, v) for d, v in total["points"]],
        "H100-equivalents per quarter", recent_months=24,
        note=f"Only quarters where all {len(total['designers'])} designers are counted and complete: {total['from']} to {total['to']}."))

    rev = objs(data["epoch_ai_companies"])
    for co, key in (("OpenAI", "revenue_openai"), ("Anthropic", "revenue_anthropic")):
        out.append(fit_series(
            key, f"{co} revenue run-rate", [(r["date"], r["annualized_usd"]) for r in rev if r["company"] == co],
            "US dollars per year", start="2023-01-01", note="Reported figures, disclosed or leaked."))
    return out, total


def quarter_mid(end_iso):
    t = dec_year(end_iso) - 0.125
    return iso_of(t)


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
        # the range: when did closed models reach the open model's interval ends?
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
    return {
        "id": "eci_lag", "source_id": "epoch_eci",
        "question": "How capable? Months until a closed model first reached the best open model's score.",
        "best_open": {k: best_open[k] for k in ("model", "org", "date", "eci", "lo", "hi")},
        "best_closed": {k: best_closed[k] for k in ("model", "org", "date", "eci", "lo", "hi")},
        "gap_points": round(best_closed["eci"] - best_open["eci"], 1),
        "now": now, "history": history,
    }


def arena_meter(data):
    d = data.get("arena_leaderboard")
    if not d or not d.get("rows"):
        return None
    rows = objs(d)
    out = {"id": "arena_gap", "source_id": "arena_leaderboard",
           "question": "How liked? The chance the best closed model wins a blind vote against the best open one.",
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


def release_share(data):
    rows = objs(data["epoch_training_compute"])
    by = collections.defaultdict(lambda: [0, 0, 0])
    for r in rows:
        y = r["date"][:4]
        by[y][0 if r["open"] is True else 1 if r["open"] is False else 2] += 1
    newest = max(r["date"] for r in rows)
    series = []
    for y in sorted(by):
        if y < "2015":
            continue
        o, c, u = by[y]
        share = o / (o + c) if o + c else None
        series.append([y, o, c, u, round(share, 3) if share is not None else None])
    return {"id": "release_share", "source_id": "epoch_training_compute",
            "question": "How many? Share of notable model releases with downloadable weights.",
            "columns": ["year", "open", "closed", "unknown", "open_share"], "series": series,
            "partial_year": newest[:4], "newest": newest}


# ---------------------------------------------------------------- where each meter stands now

def positions(data, total):
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
    toph = max(hw, key=lambda r: r["flops_per_usd"])
    pos["epoch_ml_hardware"] = {"label": "Most FP16 compute per dollar (priced chips)", "value": toph["flops_per_usd"],
                                "unit": "FLOP/s per dollar", "who": toph["name"], "org": toph["maker"], "date": toph["date"]}
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
    pos["epoch_benchmarks_internal"] = {"label": "Best score on each hard test", "items": []}
    for bid, m in bm.items():
        rs = [r for r in b if r["bench"] == bid]
        t = max(rs, key=lambda r: r["score"])
        ceiling = m.get("score_ceiling") or 1.0
        pos["epoch_benchmarks_internal"]["items"].append({
            "bench": bid, "name": m["name"], "value": t["score"], "stderr": t["stderr"], "who": t["model"],
            "org": t["org"], "date": t["date"], "ceiling": ceiling,
            "room_left": round(ceiling - t["score"], 3)})
    metr = data.get("metr_time_horizon")
    if metr:
        pos["metr_time_horizon"] = {"label": "Newest model METR has measured", "value": None,
                                    "who": metr["coverage"]["numbers"]["versions"][0]["newest_model"],
                                    "date": metr["coverage"]["numbers"]["versions"][0]["newest"], "link_only": True}
    return pos


# ---------------------------------------------------------------- plain words

def fmt_months(m):
    if m is None:
        return "no doubling (flat or shrinking)"
    return f"{m:.1f} months" if m < 24 else f"{m / 12:.1f} years"


def sentences(tr, eci, arena, share, metr, data):
    out = []
    # 1. open vs closed
    n = eci["now"]
    parts = []
    if n.get("lag_months") is not None:
        rng = n.get("lag_range_months") or [None, None]
        rtxt = (f" (between {rng[0]:.0f} and {rng[1]:.0f} months, given the score's uncertainty)"
                if None not in rng else "")
        parts.append(f"by Epoch's capability index, the best open-weights model ({n['open_model']}) is about "
                     f"{n['lag_months']:.0f} months behind the best closed ones{rtxt}")
    if arena and arena["configs"]:
        cfg = arena["configs"].get("text_style_control") or arena["configs"].get("text")
        lt = cfg["latest"]
        p = lt["win_prob"]
        feel = ("close to a coin flip" if p < 0.55 else "a modest edge" if p < 0.65 else "a clear edge")
        parts.append(f"by Arena's blind votes, the best closed model would be preferred to the best open one in about "
                     f"{p * 100:.0f}% of head-to-head votes, {feel}")
    full_years = [s for s in share["series"] if s[0] < share["partial_year"] and s[4] is not None]
    if full_years:
        y = full_years[-1]
        parts.append(f"by count, {y[4] * 100:.0f}% of the notable models released in {y[0]} had downloadable weights")
    out.append({"topic": "open_vs_closed", "meters": ["epoch_eci", "arena_leaderboard", "epoch_training_compute"],
                "text": ("Open against closed, three ways: " + "; ".join(parts) + ". They answer different "
                         "questions (how capable, how liked, how many), so no single ratio covers all three.")})
    # 2. how fast, by meter
    ok = [t for t in tr if t["status"] == "ok" and t["whole"]["doubling_months"] and not t.get("variant_of")]
    if ok:
        fast = min(ok, key=lambda t: t["whole"]["doubling_months"])
        slow = max(ok, key=lambda t: t["whole"]["doubling_months"])
        txt = (f"How fast depends on the meter: fitted doubling times run from {fmt_months(fast['whole']['doubling_months'])} "
               f"({fast['label']}) to {fmt_months(slow['whole']['doubling_months'])} ({slow['label']})")
        if metr:
            q = next((x for x in metr["quoted"] if x["version"] == "v1.1" and "2023" in x["window"]), None)
            if q:
                txt += f"; METR's task-length measure doubles about every {q['doubling_days'] / 30.44:.1f} months by its own fit"
        out.append({"topic": "speed", "meters": [t["id"] for t in ok],
                    "text": txt + ". These count different things, so they are shown side by side, not averaged."})
    # 3. has the pace changed?
    buckets = collections.defaultdict(list)
    for t in tr:
        if t["status"] == "ok" and not t.get("variant_of"):
            buckets[t["change"]["verdict"]].append(t["label"])
    bits = []
    for v in ("faster lately", "slower lately", "no clear change", "too few points"):
        if buckets.get(v):
            name = {"too few points": "too few recent points to tell"}.get(v, v)
            bits.append(f"{name}: " + ", ".join(buckets[v]))
    if bits:
        out.append({"topic": "bend", "meters": [t["id"] for t in tr],
                    "text": ("Straight line or bend? Comparing the last 24 months with the years before. " + ". ".join(
                        b[0].upper() + b[1:] for b in bits) + ". A bend can be real, or can come from who is "
                        "counted lately; each chart's coverage note says which labs are missing.")})
    # 4. METR versions disagree
    if metr:
        q = {(x["version"], x["window"]): x for x in metr["quoted"]}
        a, b = q.get(("v1.1", "from 2023 on")), q.get(("v1.0", "from 2023 on"))
        if a and b:
            out.append({"topic": "metr_versions", "meters": ["metr_time_horizon"],
                        "text": (f"METR's own two task suites disagree: from 2023 on, version 1.1 gives a doubling time of "
                                 f"about {a['doubling_days'] / 30.44:.1f} months, version 1.0 about {b['doubling_days'] / 30.44:.1f}. "
                                 "Both are shown; neither is averaged away.")})
    # 5. arena raw vs style-adjusted
    if arena and len(arena["configs"]) == 2:
        r, s = arena["configs"]["text"]["latest"], arena["configs"]["text_style_control"]["latest"]
        out.append({"topic": "arena_configs", "meters": ["arena_leaderboard"],
                    "text": (f"Arena's raw votes and its style-adjusted votes put the open-closed gap at {r['gap']:.0f} and "
                             f"{s['gap']:.0f} rating points, so the best closed model would win about {r['win_prob'] * 100:.0f}% "
                             f"or {s['win_prob'] * 100:.0f}% of votes against the best open one, depending on the count "
                             + (f"(both from the {r['date']} snapshot)." if r['date'] == s['date'] else f"({r['date']} and {s['date']} snapshots).")
                             + " Both are shown.")})
    # 6. who the newest compute estimates depend on
    cov = data["epoch_training_compute"]["coverage"]["numbers"]
    labs = [o for o in cov["recent_by_org"] if o["released"] >= 4][:5]
    out.append({"topic": "coverage", "meters": ["epoch_training_compute", "epoch_training_cost"],
                "text": (f"The newest part of the compute curve leans on whoever discloses: of {cov['recent_models']} notable models "
                         f"released since {cov['recent_since']}, {cov['recent_with_estimate']} have a compute estimate ("
                         + ", ".join(f"{o['org']} {o['with_value']} of {o['released']}" for o in labs) + ").")})
    return out


def main():
    ids = ["epoch_training_compute", "epoch_training_cost", "epoch_eci", "epoch_benchmarks_internal",
           "epoch_ml_hardware", "epoch_chip_sales", "epoch_chip_owners", "epoch_ai_companies",
           "metr_time_horizon", "arena_leaderboard"]
    data = {i: read_data(i) for i in ids}
    missing = [i for i in ids if data[i] is None and i not in ("arena_leaderboard", "metr_time_horizon")]
    if missing:
        print(f"build_summary: missing data files {missing}", file=sys.stderr)
        sys.exit(1)
    tr, total = trends(data)
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
                           "quoted": True, "note": x.get("note")})
    summary = {
        "as_of": max((d or {}).get("fetched_at", "") for d in data.values()),
        "sources": {i: {"fetched_at": d.get("fetched_at"), "source_updated": d.get("source_updated"),
                        "licence": d.get("licence"), "redistribution": d.get("redistribution")}
                    for i, d in data.items() if d},
        "trends": tr,
        "metr_quoted": metr_q,
        "open_vs_closed": {"eci": eci, "arena": arena, "release_share": share},
        "positions": positions(data, total),
        "sentences": sentences(tr, eci, arena, share, metr, data),
    }
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(dumps(summary))
    print("build_summary: written")


if __name__ == "__main__":
    main()
