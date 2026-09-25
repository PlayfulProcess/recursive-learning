"""Arena (formerly LMArena / Chatbot Arena) text leaderboard: best open-weights vs best
proprietary model in every published snapshot.

Source: the lmarena-ai/leaderboard-dataset on Hugging Face (CC BY 4.0), read through the
Hugging Face datasets-server JSON API (the raw files are Parquet, which the standard library cannot
read). The arena site itself disallows /api/ in robots.txt, so it is never called.

Every model row carries a `license` field. 'Proprietary' counts as closed; any named licence
(Apache 2.0, MIT, Llama, Gemma, non-commercial ones too) counts as open weights; 'Other' or blank is
left out of both.

Two configs, both in the 'overall' category:
  text                 ratings from raw votes
  text_style_control   ratings adjusted for style (answer length and formatting)
They can disagree, so both are kept.

HOW IT READS THE DATA. The API's /filter endpoint (a database index over the million-row 'full'
split) was often down or timing out in Sep 2026, so this uses /rows, which serves the Parquet
pages directly. The 'full' split is stored sorted by category, then date, then rank, so every snapshot's
'overall' rows sit in one contiguous block: a binary search finds where the block (or the first
date not yet stored) starts, then the fetcher reads forward 100 rows at a time until the category
changes. It checks that order as it reads and stops with an error if the order ever breaks,
rather than guess.

Incremental and resumable: `history_cursor` records the last snapshot read in full, so a run
reads only newer snapshots; the first run reads the whole history (about 1,000 requests, a few
minutes). ARENA_BUDGET_MIN (default 20) caps a run; it saves what it has, and the next run carries
on. ARENA_FULL=1 starts again from nothing.
"""

import collections
import json
import os
import sys
import time
import urllib.parse

from common import (CC_BY_4, FetchError, envelope, http_get, main_wrapper, now_iso, read_data,
                    write_data)

ID = "arena_leaderboard"
DATASET = "lmarena-ai/leaderboard-dataset"
API = "https://datasets-server.huggingface.co/"
CONFIGS = ["text", "text_style_control"]
CATEGORY = "overall"
PAUSE = 0.15  # seconds between requests: a weekly job has time to be polite


def rows_page(config, split, offset, length=100):
    params = {"dataset": DATASET, "config": config, "split": split, "offset": offset, "length": length}
    url = API + "rows?" + urllib.parse.urlencode(params)
    d = json.loads(http_get(url, timeout=90, retries=5, backoff=10).decode("utf-8"))
    time.sleep(PAUSE)
    return [r["row"] for r in d.get("rows", [])], d.get("num_rows_total", 0)


def key(r):
    return (r["category"], str(r["leaderboard_publish_date"])[:10])


def first_after(config, split, total, target):
    """First offset whose (category, date) is greater than `target` (bisect_right)."""
    lo, hi = 0, total
    while lo < hi:
        mid = (lo + hi) // 2
        rows, _ = rows_page(config, split, mid, 1)
        if not rows:
            raise FetchError(f"{config}/{split}: empty row at {mid}")
        if key(rows[0]) <= target:
            lo = mid + 1
        else:
            hi = mid
    return lo


def read_block(config, split, start_after, deadline=None):
    """Yield (date, rows) for each complete snapshot of the 'overall' category after a date."""
    _, total = rows_page(config, split, 0, 1)
    offset = first_after(config, split, total, (CATEGORY, start_after or ""))
    current, buf, prev_key = None, [], None
    while offset < total:
        rows, _ = rows_page(config, split, offset)
        if not rows:
            break
        for r in rows:
            k = key(r)
            if prev_key and k < prev_key:
                raise FetchError(f"{config}/{split}: rows out of order at offset {offset} ({prev_key} then {k}); "
                                 "the storage order this fetcher relies on has changed")
            prev_key = k
            if k[0] != CATEGORY:
                if current is not None:
                    yield current, buf
                return
            if k[1] != current:
                if current is not None:
                    yield current, buf
                    if deadline and time.time() > deadline:
                        return
                current, buf = k[1], []
            buf.append(r)
        offset += len(rows)
    if current is not None:
        yield current, buf


def read_latest(config):
    """The 'latest' split is stored with the 'overall' category first (checked Sep 2026), so read
    from the top until the category changes; refuse if the first row is not 'overall'."""
    out, offset = [], 0
    while True:
        rows, total = rows_page(config, "latest", offset)
        if offset == 0 and (not rows or rows[0]["category"] != CATEGORY):
            raise FetchError(f"{config}/latest: first row is not '{CATEGORY}' (storage order changed)")
        for r in rows:
            if r["category"] != CATEGORY:
                return out
            out.append(r)
        offset += len(rows)
        if not rows or offset >= total:
            return out


def kind(lic):
    lic = (lic or "").strip()
    if lic == "Proprietary":
        return "closed"
    if not lic or lic.lower() in ("other", "unknown", "n/a"):
        return None
    return "open"


def best(rows, k):
    xs = [r for r in rows if kind(r.get("license")) == k and r.get("rating") is not None]
    return max(xs, key=lambda r: r["rating"]) if xs else None


def r1(v):
    return round(v, 1) if v is not None else None


def snapshot_row(config, date, rows):
    c, o = best(rows, "closed"), best(rows, "open")
    if not c:
        return None
    part = [c["model_name"], c.get("organization"), r1(c["rating"]), r1(c.get("rating_lower")), r1(c.get("rating_upper"))]
    op = [None] * 6 if not o else [o["model_name"], o.get("organization"), o.get("license"), r1(o["rating"]),
                                   r1(o.get("rating_lower")), r1(o.get("rating_upper"))]
    return [config, date] + part + op


def table_rows(rows, n, only=None):
    out = []
    for r in sorted(rows, key=lambda r: -(r.get("rating") or 0)):
        k = kind(r.get("license"))
        if only and k != only:
            continue
        out.append([r["model_name"], r.get("organization"), r.get("license"), k, r1(r["rating"]),
                    r1(r.get("rating_lower")), r1(r.get("rating_upper")),
                    int(r["vote_count"]) if r.get("vote_count") is not None else None, r.get("rank")])
        if len(out) >= n:
            break
    return out


def run():
    fetched_at = now_iso()
    deadline = time.time() + 60 * float(os.environ.get("ARENA_BUDGET_MIN", "20"))
    old = None if os.environ.get("ARENA_FULL") == "1" else read_data(ID)
    columns = ["config", "date", "closed_model", "closed_org", "closed_rating", "closed_lo", "closed_hi",
               "open_model", "open_org", "open_licence", "open_rating", "open_lo", "open_hi"]
    kept = list((old or {}).get("rows", [])) if old and old.get("columns") == columns else []
    cursor = dict((old or {}).get("history_cursor") or {}) if kept else {}

    new_rows, errors, last_snapshot = [], [], {}
    for config in CONFIGS:
        n = 0
        try:
            for date, rows in read_block(config, "full", cursor.get(config, ""), deadline):
                row = snapshot_row(config, date, rows)
                if row:
                    new_rows.append(row)
                cursor[config] = date
                last_snapshot[config] = rows
                n += 1
                if n % 25 == 0:
                    print(f"  arena {config}: {n} snapshots read, up to {date}", file=sys.stderr, flush=True)
        except FetchError as e:
            errors.append(f"{config}: {e}")

    merged = {}
    for r in kept + new_rows:
        merged[(r[0], r[1])] = r
    rows = sorted(merged.values(), key=lambda r: (r[0], r[1]))
    if not rows:
        raise FetchError("no snapshots" + (f"; {errors[0]}" if errors else ""))

    # The newest snapshot's full table, for the tiles and the player panel: from this run's read
    # when it reached the newest snapshot, otherwise from the small 'latest' split.
    latest = last_snapshot.get("text_style_control")
    newest_stored = max((r[1] for r in rows if r[0] == "text_style_control"), default=None)
    if not latest or cursor.get("text_style_control") != newest_stored:
        try:
            latest = read_latest("text_style_control") or None
        except FetchError as e:
            latest = None
            errors.append(f"latest: {e}")
    if errors:
        print("  arena: " + "; ".join(e[:200] for e in errors), file=sys.stderr)
    if not latest:
        if old and old.get("latest_top"):
            payload = dict(old, rows=rows, fetched_at=fetched_at, history_cursor=cursor)
            return write_data(payload) + " (history only; latest tables kept from before)"
        raise FetchError("no latest snapshot" + (f"; {errors[-1]}" if errors else ""))
    snap = str(latest[0]["leaderboard_publish_date"])[:10]
    orgs = collections.Counter((r.get("organization") or "not stated") for r in latest)
    kinds = collections.Counter(kind(r.get("license")) or "unknown" for r in latest)
    first = {c: min((r[1] for r in rows if r[0] == c), default=None) for c in CONFIGS}
    last = {c: max((r[1] for r in rows if r[0] == c), default=None) for c in CONFIGS}
    coverage = {
        "summary": (f"{len(latest)} models rated in the {snap} snapshot ({kinds.get('closed', 0)} proprietary, "
                    f"{kinds.get('open', 0)} open weights). Only models the arena hosts are rated. Voters are "
                    "self-selected site visitors, and providers can test private variants before release, a "
                    "known critique of this leaderboard. Ratings are relative: a gap between two models in the "
                    "same snapshot means more than a rating compared across years, and the arena's method has "
                    "changed over time."),
        "counted": "Most models: " + ", ".join(f"{k} {v}" for k, v in orgs.most_common(10)) + ".",
        "not_counted": "Models not offered on the arena, and use outside chat (agents, APIs, on-device).",
        "numbers": {"latest_snapshot": snap, "models": len(latest), "by_kind": dict(kinds),
                    "orgs": dict(orgs.most_common(15)), "history_from": first, "history_to": last},
    }
    payload = envelope({
        "id": ID,
        "name": "Arena: human preference votes",
        "what_it_measures": ("Ratings from blind side-by-side votes between two anonymous chatbots. Every model "
                             "has a licence field, which makes it a second, independent open-vs-closed meter."),
        "source": "Arena (lmarena-ai), leaderboard dataset on Hugging Face",
        "url": "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset",
        "page": "https://lmarena.ai/leaderboard",
        "licence": "CC BY 4.0", "licence_url": CC_BY_4,
        "licence_note": ("The dataset card declares license: cc-by-4.0. Read through the Hugging Face API; the "
                         "arena site's /api/ is disallowed by robots.txt and is not used."),
        "citation": "Arena (lmarena-ai), 'leaderboard-dataset', Hugging Face, https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset",
        "redistribution": "copied",
    }, fetched_at, coverage, columns, rows,
        latest_columns=["model", "org", "licence", "kind", "rating", "lo", "hi", "votes", "rank"],
        latest_top=table_rows(latest, 30), latest_top_open=table_rows(latest, 10, only="open"),
        latest_snapshot=snap, history_cursor=cursor,
        unit="rating points (Bradley-Terry scale)", source_updated=snap)
    return write_data(payload)


if __name__ == "__main__":
    main_wrapper(run)
