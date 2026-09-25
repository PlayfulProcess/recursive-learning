# -*- coding: utf-8 -*-
"""Build the Words deck and the caster's spreads from the glossary: one source, two readings.

    python scripts/build_words_deck.py              write both files into the repo
    python scripts/build_words_deck.py --out DIR    write them under DIR at their repo paths
                                                    (scripts/check_all.py --check diffs the two)

Inputs (the one source; edit these, never the outputs):
    glossary/terms.json          the words: every term becomes one card
    glossary/spreads.src.json    the spreads, written by hand; term_id positions resolve here
Outputs (generated, committed, checked for currency by CI):
    grammars/words-deck/grammar.json   the deck the viewers open (cards, explorer, tree, caster)
    site/viewers/spreads.json          the layouts the Spread Caster offers (published at /viewers/)

The glossary page (glossary/index.html, scripts/build-glossary.mjs) reads the same two inputs,
so the page and the deck carry the same words.

Each term card: the term (name), standard or ours, the definition, the note, "When you draw it"
(the term's `draw` question) and the related words, as links that open the related card. The
related words are links inside a section rather than a new link field: the site keeps one
cross-grammar link pattern (metadata.source_deck + source_item_id + deck, the "Open in X" pill),
and a pill to a card in the same deck is hidden by the cards viewer, so it could not carry them.
The deck holds one card per term and nothing else: no group or root items. The glossary's
sections ride on each card as `metadata.section` (and a keyword), which the explorer offers as a
dimension; a composite hierarchy would add six section cards and a root card to the deck, open
the cards viewer's hierarchy sidebar, and give the caster's pool items that are not words.

The stamps (see CLAUDE.md, "Generated grammars"): `_generated: true` is what makes the app's
importer and sync skip this grammar; `_inputs_sha256` is a sha256 over the inputs' bytes (paths
sorted, line endings normalised), never a date, so a rebuild is byte-identical anywhere.

Python standard library only. Refuses to write when an id repeats, a term names an unknown
section or related term, a `draw` question is missing or over 20 words, a spread position names
an unknown term or sits off the board, or a spread the site header links to is missing.
"""
import argparse, hashlib, json, re, sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
TERMS = "glossary/terms.json"
SPREADS_SRC = "glossary/spreads.src.json"
HEADER = "site/site-header.js"          # read only to check the spread ids it links to
OUT_GRAMMAR = "grammars/words-deck/grammar.json"
OUT_SPREADS = "site/viewers/spreads.json"
SLUG = "words-deck"
BUILT_BY = "scripts/build_words_deck.py"

# The viewers live in /viewers/ and take a grammar in ?src= relative to that folder. The links
# are root-relative so they work wherever the text is shown on the site.
CARD_URL = "/viewers/cards.html?src=../grammars/" + SLUG + "/grammar.json&item={id}"
CAST_URL = "/viewers/caster-studio.html?src=../grammars/" + SLUG + "/grammar.json&spread={id}"

ABSOLUTIST = re.compile(r"\b(the only|always|never|proves?)\b", re.I)
NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
                "eighteen", "nineteen", "twenty"]


def words(n):
    return NUMBER_WORDS[n] if 0 <= n < len(NUMBER_WORDS) else str(n)


def read_bytes(rel):
    return (ROOT / rel).read_bytes().replace(b"\r\n", b"\n")


def inputs_sha256(paths):
    h = hashlib.sha256()
    for rel in sorted(paths):
        b = read_bytes(rel)
        h.update(rel.encode("utf-8") + b"\0" + str(len(b)).encode("ascii") + b"\0" + b)
    return h.hexdigest()


def dumps(obj):
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def check(terms_doc, spreads_doc):
    problems, warnings = [], []
    sections = terms_doc.get("sections") or []
    terms = terms_doc.get("terms") or []
    sec_ids = [s["id"] for s in sections]
    term_ids = [t["id"] for t in terms]
    seen = set()
    for i in sec_ids + term_ids:
        if not re.fullmatch(r"[a-z0-9-]+", i or ""): problems.append(f"id {i!r} is not lowercase-kebab")
        if i in seen: problems.append(f"duplicate id {i!r}")
        seen.add(i)
    for t in terms:
        if t.get("section") not in sec_ids: problems.append(f"{t['id']}: unknown section {t.get('section')!r}")
        for r in t.get("related") or []:
            if r not in term_ids: problems.append(f"{t['id']}: related {r!r} is not a term")
            if r == t["id"]: problems.append(f"{t['id']}: related to itself")
        for k in ("term", "definition"):
            if not (t.get(k) or "").strip(): problems.append(f"{t['id']}: no {k}")
        q = (t.get("draw") or "").strip()
        if not q: problems.append(f"{t['id']}: no `draw` question")
        elif len(q.split()) > 20: problems.append(f"{t['id']}: `draw` is {len(q.split())} words (20 or fewer)")
        for field in ("draw", "definition", "note"):
            m = ABSOLUTIST.search(t.get(field) or "")
            if m: warnings.append(f"{t['id']}: {field} has {m.group(0)!r}")
    sp_ids = set()
    for s in spreads_doc.get("spreads") or []:
        sid = s.get("id") or ""
        if not re.fullmatch(r"[a-z0-9-]+", sid): problems.append(f"spread id {sid!r} is not lowercase-kebab")
        if sid in sp_ids: problems.append(f"duplicate spread id {sid!r}")
        sp_ids.add(sid)
        if not s.get("name"): problems.append(f"spread {sid}: no name")
        if not s.get("positions"): problems.append(f"spread {sid}: no positions")
        for n, p in enumerate(s.get("positions") or [], 1):
            tid = p.get("term_id")
            if tid and tid not in term_ids: problems.append(f"spread {sid} position {n}: term_id {tid!r} is not a term")
            if not tid and not (p.get("label") and p.get("meaning")):
                problems.append(f"spread {sid} position {n}: needs a term_id, or a label and a meaning")
            for k in ("x", "y"):
                v = p.get(k)
                if not isinstance(v, (int, float)) or not 0 <= v <= 1:
                    problems.append(f"spread {sid} position {n}: {k}={v!r} is not a fraction in [0, 1]")
    header = ROOT / HEADER
    if header.exists():
        for sid in sorted(set(re.findall(r"caster-studio\.html\?(?:[^'\"]*&)?spread=([a-z0-9-]+)", header.read_text(encoding="utf-8")))):
            if sid not in sp_ids: problems.append(f"{HEADER} links spread={sid}, which {SPREADS_SRC} lacks")
    return problems, warnings


def standing_text(t):
    if t.get("standard"):
        if t.get("standard_in"):
            return f"Standard: the term as it is used in {t['standard_in']}, given here in one line."
        return "Standard: a term in general use, given here in one line."
    return "Ours: a working definition written for this project, open to argument."


def worked_example(ex):
    lines = [ex.get("caption", "").strip(), ""]
    for r in ex.get("rows") or []:
        lines.append(f"- **{r['step']}.** {r['action']}. *Held:* {r['held']}.")
    return "\n".join(lines).strip()


def build_grammar(terms_doc, spreads_doc, digest):
    sections = terms_doc["sections"]
    terms = terms_doc["terms"]
    by_id = {t["id"]: t for t in terms}
    sec_title = {s["id"]: s["title"] for s in sections}
    ex = terms_doc.get("what_held_example") or {}
    ex_term = re.sub(r"-example$", "", ex.get("id", "")) if ex else ""

    items = []
    for i, t in enumerate(terms, 1):
        standing = "standard" if t.get("standard") else "ours"
        secs = {"Definition": t["definition"], "Standard or ours": standing_text(t)}
        if (t.get("note") or "").strip():
            secs["Note"] = t["note"]
        secs["When you draw it"] = t["draw"]
        rel = t.get("related") or []
        if rel:
            # inline rather than a list: the caster's lighter markdown renders no lists. It opens with
            # "See", not "[": cards.html reads a section that starts with "[...]" as a dated later
            # attribution and hides it by default (lensAttribution).
            secs["Related words"] = "See " + " · ".join(f"[{by_id[r]['term']}]({CARD_URL.format(id=r)})" for r in rel)
        if t["id"] == ex_term and ex.get("rows"):
            secs["Worked example"] = worked_example(ex)
        md = {"section": sec_title[t["section"]], "standing": standing}
        if t.get("standard_in"):
            md["standard_in"] = t["standard_in"]
        items.append({
            "id": t["id"],
            "name": t["term"],
            "level": 1,
            "category": "term",
            "sort_order": i,
            "keywords": [sec_title[t["section"]], standing],
            "metadata": md,
            "sections": secs,
        })

    n = len(terms)
    n_std = sum(1 for t in terms if t.get("standard"))

    casts = ", ".join(f"[{s['name']}]({CAST_URL.format(id=s['id'])})" for s in spreads_doc["spreads"])
    description = (
        f"The glossary's {words(n)} working definitions, one per card: the words the film and the games "
        f"lean on. {words(n_std).capitalize()} are standard terms and {words(n - n_std)} are ours, marked so. "
        f"Each card holds the definition, a note, a question for when you draw it, and the related words. "
        f"The deck is built from the same file as [the glossary](/glossary/), so the two carry the same words. "
        f"Cast it in the Spread Caster: {casts}."
    )

    return {
        "_grammar_commons": {
            "schema_version": "1.0",
            "license": "CC-BY-SA-4.0",
            "attribution": [{"name": "PlayfulProcess",
                             "note": "Generated from glossary/terms.json: working definitions, written to be argued with."}],
        },
        "name": "Words — the glossary as cards",
        "slug": SLUG,
        "grammar_type": "custom",
        "creator_name": "PlayfulProcess",
        "creator_link": "https://learning.recursive.eco/glossary/",
        "default_view": "cards",
        "provenance": "living",
        "_generated": True,
        "_do_not_hand_edit": True,
        "_built_by": BUILT_BY,
        "_source_of_truth": TERMS,
        "_inputs_sha256": digest,
        "description": description,
        "tags": ["words", "glossary", "alignment", "ai", "cards"],
        "is_published": True,
        "items": items,
    }


def build_spreads(terms_doc, spreads_doc, digest):
    by_id = {t["id"]: t for t in terms_doc["terms"]}
    out = []
    for s in spreads_doc["spreads"]:
        positions = []
        for p in s["positions"]:
            t = by_id.get(p.get("term_id")) if p.get("term_id") else None
            q = {
                "label": p.get("label") or (t["term"] if t else ""),
                "meaning": p.get("meaning") or (t["definition"] if t else ""),
                "x": p["x"],
                "y": p["y"],
            }
            if t:
                q["term_id"] = t["id"]
            positions.append(q)
        out.append({"id": s["id"], "name": s["name"], "description": s.get("description", ""), "positions": positions})
    return {
        "_generated": True,
        "_do_not_hand_edit": True,
        "_built_by": BUILT_BY,
        "_source_of_truth": SPREADS_SRC + " + " + TERMS,
        "_inputs_sha256": digest,
        "_type": "recursive-learning-spreads",
        "_version": 1,
        "_note": "The spreads the Spread Caster offers. A position with a term_id reads the drawn card through that word. Edit glossary/spreads.src.json and rebuild; do not edit this file. Author PlayfulProcess; CC-BY-SA-4.0.",
        "spreads": out,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", help="write the outputs under this folder (at their repo paths) instead of the repo")
    args = ap.parse_args()
    terms_doc = json.loads(read_bytes(TERMS).decode("utf-8"))
    spreads_doc = json.loads(read_bytes(SPREADS_SRC).decode("utf-8"))
    problems, warnings = check(terms_doc, spreads_doc)
    for w in warnings:
        print("  WARN:", w)
    if problems:
        print("build_words_deck: refusing to write\n  " + "\n  ".join(problems), file=sys.stderr)
        sys.exit(1)
    digest = inputs_sha256([TERMS, SPREADS_SRC])
    grammar = build_grammar(terms_doc, spreads_doc, digest)
    spreads = build_spreads(terms_doc, spreads_doc, digest)
    base = Path(args.out).resolve() if args.out else ROOT
    for rel, obj in ((OUT_GRAMMAR, grammar), (OUT_SPREADS, spreads)):
        p = base / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(dumps(obj).encode("utf-8"))
    print(f"words-deck: {len(grammar['items'])} cards; spreads: {len(spreads['spreads'])} -> {base.as_posix()}")


if __name__ == "__main__":
    main()
