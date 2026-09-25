# -*- coding: utf-8 -*-
"""Generate grammars/institutions-of-alignment/grammar.json, the Institutions grammar.

    python scripts/build_institutions_grammar.py              write it in place
    python scripts/build_institutions_grammar.py --out DIR    write DIR/grammars/institutions-of-alignment/grammar.json
                                                              (check_all --check diffs that against the repo)

Input (hand-kept, the one source): research/institutions/institutions.json
Read by: site/pages/institutions.html (tarot's Shop slot: one card per institution, linking out to
its own site), the cards viewer, and scripts/build_sources_grammar.py (the Sources grammar's
Institutions suit is one pointer stub per card here). Build order: this first, then Sources.

Shape (levels as the viewers compute them):
  root-institutions (3) -> one group per kind of work (2) -> one card per institution (1)
Groups keep the order of `groups` in the input (alphabetical there, so nothing reads as a rank);
names inside a group are alphabetical.

Each card carries metadata.url, its own site. That is the one place the site uses a whole-card
link out (cards.html shows an "Open" button on it): check_all refuses metadata.url in any other
generated grammar. No section named Link or URL, no metadata.youtube_url.
Python standard library only.
"""
import argparse, collections, sys
from urllib.parse import urlsplit

from lib_grammar import ROOT, check_ids, ext, load_json, stamps, write_json

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SLUG = "institutions-of-alignment"
OUT_REL = f"grammars/{SLUG}/grammar.json"
SRC = "research/institutions/institutions.json"
BUILT_BY = "scripts/build_institutions_grammar.py"


def domain(u):
    h = urlsplit(u).hostname or ""
    return h[4:] if h.startswith("www.") else h


def build():
    D = load_json(SRC)
    checked = D["checked"]
    groups = D["groups"]
    gname = {g["id"]: g["name"] for g in groups}
    problems = []
    seen = set()
    for r in D["institutions"]:
        if r["group"] not in gname:
            problems.append(f"{r['id']}: unknown group {r['group']!r}")
        if not r["url"].startswith(("https://", "http://")):
            problems.append(f"{r['id']}: url is not http(s)")
        if r["id"] in seen:
            problems.append(f"{r['id']}: duplicate id")
        seen.add(r["id"])
        if r["id"] in gname or r["id"] == "root-institutions":
            problems.append(f"{r['id']}: an institution id equals a group id")
    if problems:
        raise SystemExit("institutions.json:\n  " + "\n  ".join(problems))

    by_group = collections.defaultdict(list)
    for r in D["institutions"]:
        by_group[r["group"]].append(r)

    items, order = [], [0]

    def add(it):
        order[0] += 1
        it["sort_order"] = order[0]
        items.append(it)
        return it["id"]

    group_ids = []
    for g in groups:
        members = sorted(by_group.get(g["id"], []), key=lambda r: r["name"].lower())
        if not members:
            continue
        leaf_ids = []
        for r in members:
            sec = {"What it does": f"{r['what_it_does']}\n\n*Paraphrased from its own site, checked {checked}.*"}
            if r.get("founded"):
                sec["Founded"] = r["founded"]
            made = r["one_thing_it_made"]
            # list items: a section that opens with "[" reads as a dated later attribution in cards.html
            sec["One thing it made"] = "- " + ext(made["title"], made["url"])
            if r.get("also"):
                sec["More from it"] = "\n".join(f"- {ext(a['title'], a['url'])}" for a in r["also"])
            sec["Its own site"] = "- " + ext(domain(r["url"]), r["url"])
            leaf_ids.append(add({
                "id": r["id"], "name": r["name"], "level": 1, "category": "institution",
                "description": r["what_it_does"],
                "keywords": [g["name"]],
                "metadata": {"kind": "institution", "url": r["url"], "domain": domain(r["url"]),
                             "group": g["name"], "checked": checked},
                "sections": sec,
            }))
        group_ids.append(add({
            "id": g["id"], "name": g["name"], "level": 2,
            "description": g["about"],
            "metadata": {"kind": "group"},
            "composite_of": leaf_ids,
            "sections": {"What it gathers": f"{g['about']}\n\n{len(leaf_ids)} organisation{'s' if len(leaf_ids) != 1 else ''} here."},
        }))
    n = len(D["institutions"])
    add({
        "id": "root-institutions", "name": "Institutions", "level": 3,
        "description": f"{n} organisations working on alignment, AI safety and humane technology, grouped by the kind of work they do.",
        "metadata": {"kind": "root"},
        "composite_of": group_ids,
        "sections": {
            "What it is": (f"{n} organisations working on alignment, AI safety and humane technology, by quite "
                           "different routes. Each card describes the organisation from its own site and links "
                           "out to it."),
            "How to read it": ("Listing is not endorsement, and nothing here is ranked: the groups follow the kind "
                               "of work, and many organisations work across several. The list is not complete; "
                               "an issue or a pull request against research/institutions/institutions.json in "
                               "the public repo is how to add one or correct one."),
        },
    })
    check_ids(items)
    return items, n, checked


def grammar(items, n, checked):
    g = {
        "name": "Institutions — working on alignment",
        "slug": SLUG,
        "grammar_type": "custom",
        "creator_link": "https://learning.recursive.eco/pages/institutions.html",
        "default_view": "cards",
        "provenance": "record",
        "description": (f"{n} organisations working on alignment, AI safety and humane technology: technical "
                        "research, testing and evaluation, governance and policy, public-interest research and "
                        f"more. Each is described from its own site (checked {checked}) and links out to it. "
                        "Listing is not endorsement, and nothing is ranked."),
        "tags": ["institutions", "alignment", "ai-safety", "humane-technology", "record"],
        "is_published": True,
    }
    st = stamps(BUILT_BY, SRC, [SRC], "Built from research/institutions/institutions.json; each description paraphrased from the organisation's own site.")
    out = {"_grammar_commons": st.pop("_grammar_commons")}
    out.update({k: g[k] for k in ("name", "slug", "grammar_type")})
    out["creator_name"] = st.pop("creator_name")
    out.update({k: g[k] for k in ("creator_link", "default_view", "provenance")})
    out.update(st)
    out.update({k: g[k] for k in ("description", "tags", "is_published")})
    out["items"] = items
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT), help="write <out>/" + OUT_REL + " (default: the repo)")
    a = ap.parse_args()
    items, n, checked = build()
    p = write_json(a.out, OUT_REL, grammar(items, n, checked))
    print(f"{SLUG}: {n} institutions, {len(items)} items -> {p}")


if __name__ == "__main__":
    main()
