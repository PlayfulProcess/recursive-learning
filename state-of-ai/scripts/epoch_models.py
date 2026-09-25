"""Shared reading of Epoch AI's 'Data on AI Models' zip (notable_ai_models.csv).

Used by fetch_epoch_training_compute.py and fetch_epoch_training_cost.py, which read the same
download (it is cached for the run, so it is fetched once).
"""

import collections
from datetime import date, timedelta

from common import CC_BY_4, http_get_cached, iso_date, num, require_columns, zip_csv

URL = "https://epoch.ai/data/ai_models.zip"
PAGE = "https://epoch.ai/data/ai-models"
SOURCE = "Epoch AI, Data on AI Models"
CITATION = "Epoch AI, 'Data on AI Models'. Published online at epoch.ai. Retrieved from https://epoch.ai/data/ai-models"
LICENCE = "CC BY 4.0"
LICENCE_NOTE = ("Epoch's README: the data is free to use, distribute, and reproduce provided the "
                "source and authors are credited.")

COLS = ["Model", "Organization", "Publication date", "Training compute (FLOP)", "Confidence",
        "Open model weights?", "Model accessibility", "Country (of organization)", "Frontier model",
        "Link", "Training compute cost (2023 USD)"]


def load():
    rows = zip_csv(http_get_cached(URL), "notable_ai_models.csv")
    require_columns(rows, COLS, "notable_ai_models.csv")
    return rows


def yes_no(v):
    v = (v or "").strip().lower()
    return True if v == "yes" else False if v == "no" else None


def orgs(r):
    return [o.strip() for o in (r.get("Organization") or "").split(",") if o.strip()]


def recent_window(rows, days=365):
    dates = [iso_date(r["Publication date"]) for r in rows]
    newest = max(d for d in dates if d)
    since = (date.fromisoformat(newest) - timedelta(days=days)).isoformat()
    return since, newest


def coverage_by_org(rows, has_value, since, top=14):
    """For releases on or after `since`: per organization, [released, with a value]."""
    c = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        d = iso_date(r["Publication date"])
        if not d or d < since:
            continue
        for o in orgs(r):
            c[o][0] += 1
            c[o][1] += 1 if has_value(r) else 0
    ranked = sorted(c.items(), key=lambda kv: (-kv[1][0], kv[0]))[:top]
    return [{"org": o, "released": n, "with_value": k} for o, (n, k) in ranked]


def countries(rows, has_value):
    c = collections.Counter()
    for r in rows:
        if has_value(r):
            for x in (r.get("Country (of organization)") or "").split(","):
                if x.strip():
                    c[x.strip()] += 1
    return [{"country": k, "n": v} for k, v in c.most_common(8)]


def meta(metric_id, name, what):
    return {
        "id": metric_id,
        "name": name,
        "what_it_measures": what,
        "source": SOURCE,
        "url": URL,
        "page": PAGE,
        "licence": LICENCE,
        "licence_url": CC_BY_4,
        "licence_note": LICENCE_NOTE,
        "citation": CITATION,
        "redistribution": "copied",
    }


def flop(r):
    return num(r["Training compute (FLOP)"])


def cost(r):
    return num(r["Training compute cost (2023 USD)"])
