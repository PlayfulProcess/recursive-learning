"""Shared helpers for the state-of-ai fetchers. Python standard library only.

Every fetcher writes one file, state-of-ai/data/<id>.json, with the same envelope:

    id, name, what_it_measures, source, url, page, licence, licence_url, citation,
    redistribution ("copied" or "link-only"), changes, fetched_at, coverage, columns, rows

`changes` says what was changed from the source, as CC BY 4.0 asks: which rows were kept, which
columns renamed or rounded. The trend lines and sentences in summary.json are ours.

`rows` is a list of arrays in the order of `columns` (smaller than a list of objects).

Rules the helpers enforce, so a fetcher cannot forget them:
  - robots.txt is read before any download, and a disallowed URL is never fetched;
  - one User-Agent that says who we are and where the page lives;
  - a download is retried with backoff, then the fetcher fails and the OLD file is kept;
  - if the new rows are the same as the old ones, the file keeps its old fetched_at, so
    fetched_at means "these numbers have not changed since", not "last checked" (the weekly
    workflow run is the record of each check, and it fails loudly when a source fails);
  - a fetch that returns fewer than half the old rows is refused as a probable format change.
"""

import csv
import hashlib
import io
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import zipfile
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))
USER_AGENT = ("recursive-learning-state-of-ai/1.1 "
              "(+https://learning.recursive.eco/state-of-ai/; weekly; one download per Epoch or METR "
              "file, and Arena's history read page by page through the Hugging Face API)")
CACHE_DIR = os.environ.get("STATE_OF_AI_CACHE") or os.path.join(tempfile.gettempdir(), "state-of-ai-cache")

CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/"


class FetchError(RuntimeError):
    pass


_robots = {}


def allowed_by_robots(url):
    parts = urllib.parse.urlsplit(url)
    root = f"{parts.scheme}://{parts.netloc}"
    rp = _robots.get(root)
    if rp is None:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(root + "/robots.txt", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
        except urllib.error.HTTPError as e:
            # 4xx: no robots.txt, everything allowed (the standard's rule). 5xx: be careful.
            rp.parse([] if 400 <= e.code < 500 else ["User-agent: *", "Disallow: /"])
        except Exception:
            rp.parse(["User-agent: *", "Disallow: /"])
        _robots[root] = rp
    return rp.can_fetch(USER_AGENT, url)


def http_get(url, timeout=90, retries=5, backoff=15, retry_on=(429, 500, 502, 503, 504)):
    """GET a URL and return bytes. Honours robots.txt; retries transient failures."""
    if not allowed_by_robots(url):
        raise FetchError(f"robots.txt disallows {url}")
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:200]!r}"
            if e.code not in retry_on:
                break
        except Exception as e:  # timeouts, resets
            last = repr(e)
        time.sleep(backoff * (attempt + 1))
    raise FetchError(f"GET {url} failed: {last}")


def http_get_cached(url, **kw):
    """Same as http_get, but several fetchers in one run share one download of a zip."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    path = os.path.join(CACHE_DIR, key)
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 6 * 3600:
        with open(path, "rb") as f:
            return f.read()
    data = http_get(url, **kw)
    with open(path, "wb") as f:
        f.write(data)
    return data


def zip_csv(zip_bytes, name):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        text = zf.read(name).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def zip_names(zip_bytes):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        return zf.namelist()


def require_columns(rows, cols, what):
    if not rows:
        raise FetchError(f"{what}: no rows")
    missing = [c for c in cols if c not in rows[0]]
    if missing:
        raise FetchError(f"{what}: columns missing (format changed?): {missing}")


def num(s):
    if s is None:
        return None
    s = str(s).strip().replace(",", "")
    if not s or s.lower() in ("nan", "none", "null", "n/a"):
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return v if v == v else None  # drop NaN


def sig(v, digits=4):
    """Round to significant digits, so the JSON stays small and diffs stay quiet."""
    if v is None or v == 0:
        return v
    return float(f"{v:.{digits}g}")


def iso_date(s):
    s = (s or "").strip()[:10]
    try:
        date.fromisoformat(s)
        return s
    except ValueError:
        return None


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def data_path(metric_id):
    return os.path.join(DATA_DIR, f"{metric_id}.json")


def read_data(metric_id):
    try:
        with open(data_path(metric_id), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _digest(payload):
    body = {k: v for k, v in payload.items() if k != "fetched_at"}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def _rows_digest(payload):
    body = {"columns": payload.get("columns"), "rows": payload.get("rows")}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def write_data(payload, min_ratio=0.5):
    """Write data/<id>.json. Returns 'written', 'notes updated' or 'unchanged'.
    Raises on a suspicious shrink.

    When the rows are the same as before, the old fetched_at is kept: it records when these
    numbers were first fetched. If only the notes around them changed (coverage wording, the
    licence note, `changes`), the file is rewritten with that old fetched_at."""
    metric_id = payload["id"]
    old = read_data(metric_id)
    status = "written"
    if old is not None:
        if _digest(old) == _digest(payload):
            return "unchanged"
        if _rows_digest(old) == _rows_digest(payload) and old.get("fetched_at"):
            payload = dict(payload, fetched_at=old["fetched_at"])
            status = "notes updated"
        n_old, n_new = len(old.get("rows") or []), len(payload.get("rows") or [])
        if n_old and n_new < n_old * min_ratio:
            raise FetchError(f"{metric_id}: {n_new} rows vs {n_old} before; refusing to overwrite")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(data_path(metric_id), "w", encoding="utf-8", newline="\n") as f:
        f.write(dumps(payload))
    return status


def dumps(payload):
    """Readable JSON with one table row per line, so a weekly diff shows which rows changed."""
    parts = []
    for k, v in payload.items():
        key = json.dumps(k)
        if isinstance(v, list) and v and all(isinstance(x, list) for x in v):
            inner = ",\n  ".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in v)
            parts.append(f" {key}: [\n  {inner}\n ]")
        else:
            parts.append(f" {key}: " + json.dumps(v, ensure_ascii=False, indent=1).replace("\n", "\n "))
    return "{\n" + ",\n".join(parts) + "\n}\n"


DEFAULT_CHANGES = ("Rows filtered and columns renamed or reduced from the source file; some values "
                   "rounded. Coverage notes, trend lines and summaries (summary.json) are ours.")


def envelope(meta, fetched_at, coverage, columns, rows, **extra):
    out = dict(meta)
    out.setdefault("changes", DEFAULT_CHANGES)
    out.update({
        "fetched_at": fetched_at,
        "coverage": coverage,
        "columns": columns,
        "rows": rows,
    })
    out.update(extra)
    return out


def main_wrapper(fn):
    """Run a fetcher as a script: print one line, exit 1 on failure (the old file stays)."""
    try:
        status = fn()
        print(f"{os.path.basename(sys.argv[0])}: {status}")
    except FetchError as e:
        print(f"{os.path.basename(sys.argv[0])}: FAILED, kept the previous file. {e}", file=sys.stderr)
        sys.exit(1)
