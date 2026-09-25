"""Offline checks for the fitting code and the small YAML reader. No network, no installs.

    python3 state-of-ai/scripts/test_scripts.py
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_metr_time_horizon import parse_yaml_subset  # noqa: E402
from fit import dec_year, fit_series, iso_of  # noqa: E402


def check(cond, msg):
    if not cond:
        print("FAIL:", msg)
        sys.exit(1)
    print("ok:", msg)


def test_recovers_known_doubling():
    rng = random.Random(1)
    pts = []
    for i in range(80):
        t = 2015 + i / 8
        v = 10 ** (2 + (t - 2015) * math.log10(2) * 12 / 6 + rng.gauss(0, 0.15))  # doubles every 6 months
        pts.append((iso_of(t), v))
    f = fit_series("t", "test", pts, "x")
    d = f["whole"]["doubling_months"]
    lo, hi = f["whole"]["doubling_ci"]
    check(abs(d - 6) < 0.3, f"doubling time recovered ({d} months, 90% interval {lo}-{hi})")
    check(lo <= 6 <= hi, "the 90% interval contains the true value")
    check(f["change"]["verdict"] == "no clear change", f"a steady series is not called a bend ({f['change']})")
    check(all(b[1] <= b[2] <= b[3] for b in f["band"]), "band is ordered low <= fit <= high")
    f2 = fit_series("t", "test", pts, "x")
    check(f == f2, "same data, same numbers (fixed seed)")


def test_detects_a_bend():
    pts = []
    for i in range(60):
        t = 2018 + i / 8
        slope = math.log10(2) * 12 / (12 if t < 2023.5 else 4)
        base = 0 if t < 2023.5 else (2023.5 - 2018) * math.log10(2)
        v = 10 ** (1 + (base + (t - (2018 if t < 2023.5 else 2023.5)) * slope))
        pts.append((iso_of(t), v))
    f = fit_series("b", "bend", pts, "x")
    check(f["change"]["verdict"] == "faster lately", f"a speed-up is detected ({f['change']['verdict']})")


def test_blocks_and_extension():
    rng = random.Random(3)
    pts, walk = [], 0.0
    for i in range(40):
        t = 2020 + i / 4
        walk += rng.gauss(0, 0.08)  # neighbours move together
        pts.append((iso_of(t), 10 ** (1 + (t - 2020) * 0.3 + walk)))
    iid = fit_series("w", "walk", pts, "x")
    blk = fit_series("w", "walk", pts, "x", block=True)
    wi = iid["whole"]["slope_ci"][1] - iid["whole"]["slope_ci"][0]
    wb = blk["whole"]["slope_ci"][1] - blk["whole"]["slope_ci"][0]
    check(wb > wi, f"resampling runs of neighbours widens the range for a series that moves together ({wi:.3f} -> {wb:.3f})")
    check("blocks" in blk["whole"]["resampling"], "the block resampling is named in the output")
    e = iid["if_trend_continued"]
    check(len(e) == 12 and all(r[4] <= r[1] <= r[2] <= r[3] <= r[5] for r in e),
          "the point range is wider than the line's own range, past the data")
    late = fit_series("w", "walk", pts, "x", ref_date="2032-01-01")
    check(late["if_trend_continued"] == [] and late["data_stop"] == iso_of(2029.75)[:7],
          f"no stretch when the data stopped long ago; data_stop {late['data_stop']}")
    none = fit_series("w", "walk", pts, "x", extend_months=0)
    check(none["if_trend_continued"] == [], "extend_months=0 draws no stretch (single companies)")


def test_fetched_at_kept_when_rows_unchanged():
    import tempfile
    import common
    old_dir = common.DATA_DIR
    common.DATA_DIR = tempfile.mkdtemp()
    try:
        base = {"id": "t", "name": "t", "fetched_at": "2026-01-01T00:00:00Z", "columns": ["a"], "rows": [[1], [2]]}
        check(common.write_data(dict(base)) == "written", "first write")
        check(common.write_data(dict(base, fetched_at="2026-02-01T00:00:00Z")) == "unchanged", "same rows: unchanged")
        st = common.write_data(dict(base, fetched_at="2026-03-01T00:00:00Z", changes="new note"))
        d = common.read_data("t")
        check(st == "notes updated" and d["fetched_at"] == "2026-01-01T00:00:00Z" and d["changes"] == "new note",
              "notes changed, rows not: the old fetched_at is kept")
        common.write_data(dict(base, fetched_at="2026-04-01T00:00:00Z", rows=[[1], [3]]))
        check(common.read_data("t")["fetched_at"] == "2026-04-01T00:00:00Z", "rows changed: fetched_at moves")
    finally:
        common.DATA_DIR = old_dir


def test_too_few_points():
    f = fit_series("s", "short", [("2024-01-01", 1), ("2025-01-01", 2)], "x")
    check(f["status"] == "too few points", "two points are not fitted")


def test_dates():
    check(abs(dec_year("2024-07-01") - 2024.5) < 0.01, "decimal year")
    check(iso_of(dec_year("2025-03-15"))[:7] == "2025-03", "round trip")


def test_yaml_subset():
    doc = parse_yaml_subset("""benchmark_name: METR-Horizon-v1.1
doubling_time_in_days: # a comment
  from_2023_on:
    ci_high: 158.012
    ci_low: 104.428
    point_estimate: 128.744
results:
  model_a:
    metrics:
      p50_horizon_length:
        estimate: 11.39
      is_sota: true
    release_date: 2024-06-20
    scaffolds:
    - one
    - two
  model_b:
    release_date: 2025-01-01
""")
    check(doc["doubling_time_in_days"]["from_2023_on"]["point_estimate"] == 128.744, "yaml: nested number")
    check(doc["results"]["model_a"]["metrics"]["p50_horizon_length"]["estimate"] == 11.39, "yaml: deep number")
    check(doc["results"]["model_a"]["scaffolds"] == ["one", "two"], "yaml: list under a key")
    check(doc["results"]["model_b"]["release_date"] == "2025-01-01", "yaml: sibling after a list")
    check(doc["results"]["model_a"]["metrics"]["is_sota"] is True, "yaml: boolean")


def test_arena_block_reader():
    import fetch_arena_leaderboard as fa
    from common import FetchError
    table = []
    for cat in ("chinese", "overall", "spanish"):
        for date in ("2025-01-01", "2025-02-01", "2025-03-01"):
            for rank in range(1, 131):  # more than one page per snapshot
                lic = "Proprietary" if rank % 3 else "MIT"
                table.append({"category": cat, "leaderboard_publish_date": date, "rank": rank,
                              "model_name": f"m{rank}", "organization": "x", "license": lic,
                              "rating": 1500 - rank, "rating_lower": 1495 - rank, "rating_upper": 1505 - rank})
    calls = []

    def fake(config, split, offset, length=100):
        calls.append(offset)
        return table[offset:offset + length], len(table)
    real = fa.rows_page
    fa.rows_page = fake
    try:
        snaps = list(fa.read_block("text", "full", ""))
        check([d for d, _ in snaps] == ["2025-01-01", "2025-02-01", "2025-03-01"], "arena: every overall snapshot, in order")
        check(all(len(rows) == 130 and all(r["category"] == "overall" for r in rows) for _, rows in snaps),
              "arena: each snapshot whole, nothing from other categories")
        row = fa.snapshot_row("text", snaps[0][0], snaps[0][1])
        check(row[2] == "m1" and row[7] == "m3", "arena: best closed and best open found")
        rest = list(fa.read_block("text", "full", "2025-02-01"))
        check([d for d, _ in rest] == ["2025-03-01"], "arena: resumes after the cursor")
        table[400], table[401] = table[401], table[400]
        table[401] = dict(table[401], leaderboard_publish_date="2024-12-01")
        try:
            list(fa.read_block("text", "full", ""))
            check(False, "arena: out-of-order rows are refused")
        except FetchError:
            check(True, "arena: out-of-order rows are refused")
    finally:
        fa.rows_page = real


if __name__ == "__main__":
    test_arena_block_reader()
    test_dates()
    test_too_few_points()
    test_recovers_known_doubling()
    test_detects_a_bend()
    test_blocks_and_extension()
    test_fetched_at_kept_when_rows_unchanged()
    test_yaml_subset()
    print("all checks passed")
