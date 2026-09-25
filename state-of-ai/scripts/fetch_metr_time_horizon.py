"""METR task-completion time horizons: LINK-ONLY until PlayfulProcess decides.

METR publishes the data (a YAML file behind the 'Download data' button on
https://metr.org/time-horizons/), and robots.txt allows it, but the site says
"(c) 2026 METR. All rights reserved." and no open licence covers the per-model numbers
(the 2025 paper, arXiv 2503.14499, is CC BY 4.0; later site updates are not). So by default this
fetcher stores NO per-model rows. It stores:
  - METR's own fitted doubling times, quoted with attribution (a few published figures);
  - counts, dates and which labs are measured (our description of the coverage).

Setting METR_STORE_ROWS=1 adds the per-model 50% horizons. Do that only after deciding to (or
after METR says yes); outreach to METR needs PlayfulProcess's approval.

Python's standard library has no YAML parser; the small reader below handles the indentation
subset METR's file uses and fails loudly if the shape changes.
"""

import collections
import os
import re

from common import FetchError, envelope, http_get, main_wrapper, now_iso, write_data

ID = "metr_time_horizon"
PAGE = "https://metr.org/time-horizons/"
VERSIONS = [("v1.1", "https://metr.org/assets/benchmark_results_1_1.yaml"),
            ("v1.0", "https://metr.org/assets/benchmark_results_1_0.yaml")]

PREFIX_ORG = [("claude", "Anthropic"), ("gpt", "OpenAI"), ("o1", "OpenAI"), ("o3", "OpenAI"), ("o4", "OpenAI"),
              ("davinci", "OpenAI"), ("gemini", "Google DeepMind"), ("qwen", "Alibaba"), ("deepseek", "DeepSeek"),
              ("grok", "xAI"), ("kimi", "Moonshot"), ("llama", "Meta AI"), ("mistral", "Mistral AI")]


def parse_yaml_subset(text):
    """Nested mappings and '- item' lists, scalars only. Enough for METR's benchmark_results files."""
    root = {}
    stack = [(-1, root)]
    last_key_at = {}
    for raw in text.splitlines():
        line = raw.split(" #", 1)[0].rstrip() if not raw.lstrip().startswith("#") else ""
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        body = line.strip()
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if body.startswith("- "):
            key = last_key_at.get(id(parent))
            if key is None:
                raise FetchError("YAML: list item without a key")
            if not isinstance(parent.get(key), list):
                parent[key] = []
            parent[key].append(body[2:].strip())
            continue
        m = re.match(r"^([^:]+):\s*(.*)$", body)
        if not m:
            raise FetchError(f"YAML: cannot read line {raw!r}")
        key, val = m.group(1).strip(), m.group(2).strip()
        if val == "":
            child = {}
            parent[key] = child
            last_key_at[id(parent)] = key
            stack.append((indent, child))
        else:
            parent[key] = scalar(val)
            last_key_at[id(parent)] = key
    return root


def scalar(v):
    v = v.strip().strip("'\"")
    if v in ("true", "false"):
        return v == "true"
    try:
        return float(v) if re.match(r"^-?[\d.]+(e-?\d+)?$", v) else v
    except ValueError:
        return v


def org_of(key):
    k = key.lower()
    for p, o in PREFIX_ORG:
        if k.startswith(p):
            return o
    return "other"


def run():
    fetched_at = now_iso()
    quoted, versions, rows = [], [], []
    store_rows = os.environ.get("METR_STORE_ROWS") == "1"
    for ver, url in VERSIONS:
        doc = parse_yaml_subset(http_get(url).decode("utf-8"))
        res = doc.get("results")
        dt = doc.get("doubling_time_in_days")
        if not isinstance(res, dict) or not isinstance(dt, dict):
            raise FetchError(f"{url}: 'results' or 'doubling_time_in_days' missing (format changed?)")
        for window, v in dt.items():
            if isinstance(v, dict) and "point_estimate" in v:
                quoted.append({"version": ver, "window": window.replace("_", " "),
                               "doubling_days": v.get("point_estimate"),
                               "ci_low_days": v.get("ci_low"), "ci_high_days": v.get("ci_high"),
                               "note": "METR excludes points whose central 50% horizon is over 16 hours" if ver == "v1.1" else None})
        dates = sorted(str(r.get("release_date")) for r in res.values() if isinstance(r, dict))
        orgs = collections.Counter(org_of(k) for k in res)
        newest_key = max(res, key=lambda k: str(res[k].get("release_date")))
        versions.append({"version": ver, "url": url, "models": len(res), "first": dates[0], "newest": dates[-1],
                         "newest_model": newest_key, "orgs": dict(orgs)})
        if store_rows:
            for k, r in res.items():
                p50 = (r.get("metrics") or {}).get("p50_horizon_length") or {}
                rows.append([ver, k, org_of(k), str(r.get("release_date")), p50.get("estimate"),
                             p50.get("ci_low"), p50.get("ci_high")])
    v11 = versions[0]
    major = ["xAI", "Meta AI", "DeepSeek", "Alibaba", "Moonshot", "Mistral AI"]
    missing = [o for o in major if o not in v11["orgs"]]
    only_old = [o for o in missing if any(o in v["orgs"] for v in versions[1:])]
    not_counted = (f"In {v11['version']}: no models from " + ", ".join(missing) + "."
                   + (f" ({', '.join(only_old)} appear only in an older version.)" if only_old else "")
                   if missing else "All the major labs we track appear at least once.")
    coverage = {
        "summary": (f"{v11['models']} models in {v11['version']}, {v11['first']} to {v11['newest']}: "
                    + ", ".join(f"{k} {v}" for k, v in sorted(v11['orgs'].items(), key=lambda kv: -kv[1])) +
                    ". The tasks are software and ML-research work only, so this is not general capability. "
                    "METR may skip a release or measure it late."),
        "counted": "Models METR has run on its task suite, mostly from OpenAI, Anthropic and Google, plus old baselines.",
        "not_counted": not_counted,
        "numbers": {"versions": versions},
    }
    payload = envelope({
        "id": ID,
        "name": "METR task-completion time horizon",
        "what_it_measures": ("How long a task, timed by how long a skilled person takes, an AI agent can finish "
                             "with 50% success. METR fits a doubling time to it."),
        "source": "METR, Time Horizons of Frontier AI Models",
        "url": VERSIONS[0][1], "page": PAGE,
        "licence": "No open licence stated (site: all rights reserved)",
        "licence_url": PAGE,
        "licence_note": ("robots.txt allows the download, but no licence grants reuse of the per-model numbers. "
                         "Only METR's headline doubling times are quoted here, with attribution; the chart lives "
                         "on METR's page. Decision pending: store per-model numbers, or ask METR."),
        "citation": "METR, 'Task-Completion Time Horizons of Frontier AI Models', https://metr.org/time-horizons/",
        "redistribution": "rows" if store_rows else "link-only",
    }, fetched_at, coverage,
        ["version", "model", "org", "date", "p50_minutes", "p50_lo", "p50_hi"], rows,
        quoted=quoted, unit="minutes of skilled-human time", source_updated=v11["newest"])
    return write_data(payload, min_ratio=0)


if __name__ == "__main__":
    main_wrapper(run)
