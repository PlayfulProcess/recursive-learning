# -*- coding: utf-8 -*-
"""Generate grammars/ideas-of-alignment/grammar.json, the Ideas meta-grammar (a seed draft).

    python scripts/build_ideas_grammar.py              write it in place
    python scripts/build_ideas_grammar.py --out DIR    write DIR/grammars/ideas-of-alignment/grammar.json
                                                       (check_all --check diffs that against the repo)

The interpretation wing (provenance `living`, status `draft`): the lab's 52 seed terms from the
AI debate map, placed in the lanes of its genealogy of AI research. Never hand-edit the grammar;
change the inputs and re-run.

Inputs (all in this repo):
  research/lab-export/ideas.json     terms with derived counts, lanes, milestones, the outcome fork
  research/lab-export/sources.json   people's names and episode titles, for the links to Sources
  research/crosswalk.json            which terms meet a Words glossary term (links, not copies)

Shape: root-ideas (3) -> lane-<genealogy lane> (2) -> <term id> (1). Term ids are the lab's own
(ai-map/terms.json), so they stay stable across rebuilds.

Numbers are derived only (no caption text): mentions, episodes, first episode in which a term
comes up, per-year episodes (scaled by episodes that year, PRIORITIES #12), whose episodes carry it
most, and co-mentions. Each term's one pill (metadata.source_deck + source_item_id + deck) goes to
the person whose episodes carry it most, in Sources; the rest are markdown links to the cards.
No metadata.url, no metadata.youtube_url, no section named Link or URL.
Python standard library only.
"""
import argparse, collections, hashlib, json, re, sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SLUG = "ideas-of-alignment"
SOURCES = "sources-of-alignment"
OUT_REL = f"grammars/{SLUG}/grammar.json"
INPUTS = ["research/lab-export/ideas.json", "research/lab-export/sources.json", "research/crosswalk.json"]

PRECISION = {
    "high": "high: almost every hit is about the idea",
    "medium": "medium: most hits are about the idea, some use the words in another sense",
    "low": "low: a common word with other meanings, so many hits are off topic",
}
LAYER = {"idea": "an idea", "outcome": "an outcome", "regulation": "a regulatory idea", "lore": "lore"}

# Corrections from a public review of the site (Sep 25 2026), applied on top of the lab's export.
# research/lab-export/ideas.json stays a faithful copy of the lab's data; what changes here is
# said on the card, with why.
#   TERM_REVIEW[id]  = {"precision": new rating, "note": why}      (a count rated too high)
#   LANE_REVIEW[id]  = {"heading": new text, "sources": [...]}    (a claim with no source)
TERM_REVIEW = {
    "ea-rationalists": {
        "precision": "medium",
        "note": ("Lowered from high on review (Sep 25 2026): the pattern also matches \"rationalist\" and "
                 "\"rationalism\" in the philosophical sense. The guest whose episodes carry it most is a "
                 "philosopher of mind, and the term said most often alongside it is Consciousness, so a "
                 "share of the hits is likely about philosophy rather than the movement. Not yet spot-checked."),
    },
}
LANE_REVIEW = {
    "safety": {
        "heading": ("Growing, but still a thin stream next to capabilities (ETO, 2025). In July 2025 researchers "
                    "from several rival labs argued together for keeping models' reasoning readable, so that it "
                    "can be monitored (Korbak et al., 2025). The lab's notes also say that labs moved further in "
                    "2026; no source is attached to that yet, so it is left out here."),
        "sources": [{"kind": "link", "title": "Korbak et al., Chain of Thought Monitorability (Jul 2025)",
                     "url": "https://arxiv.org/abs/2507.11473"}],
    },
}


def inputs_sha256(paths):
    """sha256 over the inputs, in sorted path order: path, NUL, bytes, NUL. Never a date."""
    h = hashlib.sha256()
    for p in sorted(paths):
        h.update(p.encode("utf-8") + b"\0" + (ROOT / p).read_bytes() + b"\0")
    return h.hexdigest()


def md_text(s):
    return re.sub(r"\s+", " ", str(s)).replace("[", "(").replace("]", ")").replace("*", "").replace("`", "'").strip()


def md_url(u):
    return u.replace("(", "%28").replace(")", "%29").replace(" ", "%20")


def ext(label, url):
    return f"[{md_text(label)}]({md_url(url)})"


def card(slug, item_id, label):
    return f"[{md_text(label)}](cards.html?src=../grammars/{slug}/grammar.json&item={item_id})"


def person_id(w):
    return "person-" + w.replace("_", "-")


def link_ok(check):
    return not check or int(check.split()[0]) in (200, 202, 401, 403)


def times(n):
    return f"{n} time" + ("" if n == 1 else "s")


def episodes_word(n):
    return f"{n} episode" + ("" if n == 1 else "s")


def build():
    I = json.loads((ROOT / INPUTS[0]).read_text(encoding="utf-8"))
    S = json.loads((ROOT / INPUTS[1]).read_text(encoding="utf-8"))
    X = json.loads((ROOT / INPUTS[2]).read_text(encoding="utf-8"))
    checks = I.get("link_checks") or {}
    ok = lambda u: link_ok(checks.get(u))
    people = {p["id"]: p["name"] for p in S["people"]}
    shows = {s["id"]: s["name"] for s in S["shows"]}
    label = {t["id"]: t["label"] for t in I["terms"]}
    lanes = {l["id"]: l for l in I["lanes"]}
    miles = {m["id"]: m for m in I["milestones"]}
    outcomes = {o["id"]: o for o in I["outcomes"]}
    words = collections.defaultdict(list)
    for p in X["pairs"]:
        words[p["idea"]].append(p)
    C = I["corpus"]
    n_cap = C["captioned"]
    cap_years = sorted(C["captioned_by_year"])
    span = f"{cap_years[0]} to {cap_years[-1]}"

    items, order = [], [0]

    def add(it):
        order[0] += 1
        it["sort_order"] = order[0]
        items.append(it)
        return it["id"]

    by_lane = collections.defaultdict(list)
    for t in I["terms"]:
        by_lane[t["lane"]].append(t)

    lane_ids = []
    for l in I["lanes"]:
        tids = []
        for t in by_lane[l["id"]]:
            rv = TERM_REVIEW.get(t["id"]) or {}
            if rv.get("precision"):
                t = dict(t, precision=rv["precision"])
            sec, meta = {}, {"kind": "term", "lane": l["name"], "layer": t["layer"],
                             "count_reliability": t["precision"]}
            # definition: where the Words glossary holds the same idea, link there (it lives once)
            same = [p for p in words.get(t["id"], []) if p["relation"] == "same"]
            if same:
                sec["Working definition"] = "In the Words glossary: " + ", ".join(
                    ext(p["word_label"], f"../glossary/#{p['word']}") for p in same) + "."
            m = miles.get(t["milestone"]) if t["milestone"] else None
            if m:
                src = [f"- {ext(s['title'], s['url'])}" for s in m["sources"] if ok(s["url"])]
                sec["In the lab's genealogy"] = f"**{md_text(m['title'])}** ({int(m['year'])}). {m['summary']}" + \
                    ("\n\n" + "\n".join(src) if src else "")
            # how often
            f = t["first"]
            if t["mentions"]:
                first = f"{f['date']}, {md_text(shows.get(f['show'], f['show']))}, " + \
                    (card(SOURCES, f["episode"], f["title"]) if f.get("episode") else md_text(f["title"]))
                years = " · ".join(f"{y}: {w} of {n}" for y, w, n, _ in t["by_year"])
                sec["How often it comes up"] = (
                    f"Said {times(t['mentions'])}, in {t['episodes']} of the {n_cap} episodes with automatic captions "
                    f"({span}).\n\nFirst heard in these episodes: {first}.\n\n"
                    f"Episodes where it comes up, out of the episodes that year: {years}.")
                meta["first_heard"] = f["date"][:4]
            else:
                sec["How often it comes up"] = (f"Not heard in the {n_cap} episodes with automatic captions ({span}).")
            # whose episodes carry it most
            if t["top_people"]:
                lines = [f"- {card(SOURCES, person_id(w), people.get(w, w))}: {times(n)}, in {episodes_word(e)}"
                         for w, n, e in t["top_people"][:3]]
                sec["Whose episodes carry it most"] = (
                    "Counted in the episodes where they are a guest. The captions do not say who is speaking, so "
                    "some of these may be the host.\n" + "\n".join(lines))
                top = t["top_people"][0][0]
                meta.update({"source_deck": SOURCES, "source_item_id": person_id(top), "deck": "Sources"})
            if t["alongside"]:
                sec["Often said alongside"] = "Terms that come up within the same two minutes most often: " + \
                    ", ".join(f"{card(SLUG, b, label.get(b, b))} ({n})" for b, n in t["alongside"]) + "."
            o = outcomes.get(t["outcome"]) if t["outcome"] else None
            if o:
                names = "; ".join(md_text(x) for x in o["if_controllable"])
                sec["The fork (draft)"] = (
                    f"If it can be controlled, the lab's draft notes on regulation list "
                    f"{len(o['if_controllable'])} idea{'s' if len(o['if_controllable']) != 1 else ''} aimed at it: "
                    f"{names}.\n\nTheir verdict for now: {o['verdict']}.")
            related = [p for p in words.get(t["id"], []) if p["relation"] == "related"]
            if related:
                # opens with "See", not "[": cards.html reads a section that starts with "[...]" as a
                # dated later attribution and hides it by default (lensAttribution)
                sec["See also, in Words"] = "See " + ", ".join(ext(p["word_label"], f"../glossary/#{p['word']}") for p in related) + "."
            how = (f"A case-insensitive pattern over automatic captions; hits within 20 seconds count once. "
                   f"Count reliability, the lab's estimate: {PRECISION.get(t['precision'], t['precision'])}.")
            if t["spotcheck"]:
                how += f" Spot-checked by the lab on Sep 24 2026: {t['spotcheck']}."
            if rv.get("note"):
                how += " " + rv["note"]
            sec["How it was counted"] = how
            desc = (f"Said {times(t['mentions'])} in {episodes_word(t['episodes'])}; first heard here in {f['date'][:4]}. "
                    if t["mentions"] else "Not heard in these episodes. ") + f"{LAYER.get(t['layer'], t['layer']).capitalize()}, {l['short'] or l['name']} lane."
            tids.append(add({"id": t["id"], "name": t["label"], "level": 1, "description": desc,
                             "metadata": meta, "sections": sec}))
        lr = LANE_REVIEW.get(l["id"]) or {}
        src = [f"- {ext(s['title'], s['url'])}" for s in list(l["sources"]) + lr.get("sources", []) if ok(s["url"])]
        lsec = {"What the lane is": l["summary"]}
        heading = lr.get("heading") or l["heading"]
        if heading:
            lsec["Where it seems to be heading (Sep 2026)"] = heading
        if l["parent"] and l["parent"] in lanes:
            lsec["Forks from"] = card(SLUG, "lane-" + l["parent"], lanes[l["parent"]]["name"])
        if l["people"]:
            lsec["People the genealogy names"] = ", ".join(l["people"]) + "."
        if src:
            lsec["Sources"] = "\n".join(src)
        lane_ids.append(add({
            "id": "lane-" + l["id"], "name": l["name"], "level": 2,
            "description": f"Since {int(l['start'])} · {len(tids)} seed term{'s' if len(tids) != 1 else ''}",
            "metadata": {"kind": "lane", "lane": l["name"]},
            "composite_of": tids, "sections": lsec,
        }))
    add({
        "id": "root-ideas", "name": "Ideas in the AI debate", "level": 3,
        "description": "A seed draft: the ideas, the lanes of AI research they belong to, and how often they come up.",
        "metadata": {"kind": "root"},
        "composite_of": lane_ids,
        "sections": {
            "What it is": (f"{len(I['terms'])} seed terms from the lab's map of the AI debate, placed in the lanes of its "
                           f"genealogy of AI research. For each: how often it comes up in {n_cap} podcast episodes with "
                           f"automatic captions ({span}), when it is first heard there, whose episodes carry it most, "
                           "what it is said alongside and, where the genealogy has one, the milestone that names it."),
            "Read the counts with care": (
                "The counts are pattern matches on automatic captions. The speaker is unknown and may be the host; "
                "long episodes weigh more; recent years have more episodes; the episode list leans towards people "
                "at AI labs. The terms await PlayfulProcess's review, so this is a draft."),
            "Where the sources are": ("The episodes, people and papers are in the Sources grammar; each person "
                                      "link opens their card there."),
        },
    })
    return items


def grammar(items):
    I = json.loads((ROOT / INPUTS[0]).read_text(encoding="utf-8"))
    n_terms, n_cap = len(I["terms"]), I["corpus"]["captioned"]
    return {
        "_grammar_commons": {
            "schema_version": "1.0", "license": "CC-BY-SA-4.0",
            "attribution": [{"name": "PlayfulProcess",
                             "note": "Generated from the lab's AI debate map and genealogy (recursive-transcripts) through research/lab-export/ideas.json. A seed draft."}],
        },
        "name": "Ideas — a seed map of the AI debate",
        "slug": SLUG,
        "grammar_type": "custom",
        "creator_name": "PlayfulProcess",
        "creator_link": "https://recursive.eco",
        "default_view": "tree",
        "default_preview": "tree",
        "provenance": "living",
        "status": "draft",
        "_generated": True,
        "_do_not_hand_edit": True,
        "_built_by": "scripts/build_ideas_grammar.py",
        "_source_of_truth": "research/lab-export/ideas.json (written by scripts/lab_export.py from the lab's research) and research/crosswalk.json",
        "_inputs": sorted(INPUTS),
        "_inputs_sha256": inputs_sha256(INPUTS),
        "description": (f"A seed draft of the ideas in the AI debate: the lab's {n_terms} seed terms, placed in the lanes of "
                        f"its genealogy of AI research. For each, how often it comes up in {n_cap} podcast episodes with "
                        "automatic captions, when it is first heard there, whose episodes carry it most, and the "
                        "milestone that names it. Counts are pattern matches on captions: the speaker is unknown, "
                        "long episodes weigh more, and recent years have more episodes. Awaiting review."),
        "tags": ["ideas", "alignment", "ai", "genealogy", "draft"],
        "is_published": True,
        "items": items,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT), help="write <out>/" + OUT_REL + " (default: the repo)")
    a = ap.parse_args()
    items = build()
    g = grammar(items)
    ids = [i["id"] for i in items]
    dup = [k for k, n in collections.Counter(ids).items() if n > 1]
    if dup:
        raise SystemExit(f"duplicate item ids: {dup}")
    gl = ROOT / "glossary/terms.json"     # a check only: the crosswalk's Words ids must exist
    if gl.exists():
        have = {t["id"] for t in json.loads(gl.read_text(encoding="utf-8")).get("terms", [])}
        X = json.loads((ROOT / INPUTS[2]).read_text(encoding="utf-8"))
        missing = sorted({p["word"] for p in X["pairs"]} - have)
        if missing:
            raise SystemExit(f"research/crosswalk.json names Words ids the glossary lacks: {missing}")
    out = Path(a.out) / OUT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes((json.dumps(g, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    kinds = collections.Counter((i.get("metadata") or {}).get("kind") for i in items)
    print(f"{SLUG}: {len(items)} items {dict(kinds)} -> {out}")


if __name__ == "__main__":
    main()
