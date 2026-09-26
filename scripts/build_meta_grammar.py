# -*- coding: utf-8 -*-
"""Generate grammars/all-decks/grammar.json, the castable pool (the meta grammar).

    python scripts/build_meta_grammar.py              write it in place
    python scripts/build_meta_grammar.py --out DIR    write DIR/grammars/all-decks/grammar.json

PORTED in shape from recursive-tarot/scripts/build_meta_grammar.py ("All Decks, Many Lenses"),
cut down to what this site's viewers read:
  - viewers/caster-studio.html loads it as META_URL and casts from every item that has
    metadata.source_deck + metadata.castable and no composite_of; its deck menu comes from
    `_decks` (slug, label, date, era, era_sort) and lists a deck when it has 3 or more cards;
  - viewers/reference-resolve.js knows the aggregator by `_decks` and opens the drawn card's
    full entry from its own deck (the pointer stub carries no content of its own);
  - viewers/cards.html offers it as "All decks" in its deck switcher.

Which decks are castable is curated here (DECKS), the recursive-iching pattern: the Words deck
and the Ideas seed map. The records (Sources, Institutions) and the game and film grammars are
not cast. Every leaf of a listed deck becomes one pointer stub; nothing is copied but the name.

Shape: root-all-decks (3) -> deck-<key> (2) -> <key>--<item id> (1)
Python standard library only.
"""
import argparse, sys

from lib_grammar import ROOT, check_ids, load_json, stamps, write_json

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SLUG = "all-decks"
OUT_REL = f"grammars/{SLUG}/grammar.json"
BUILT_BY = "scripts/build_meta_grammar.py"

# slug -> (key, label, date, era, era_sort, what it is)
DECKS = {
    "words-deck": ("words", "Words", "2026", "The glossary", 1,
                   "The twenty working words of the glossary, one card each."),
    "ideas-of-alignment": ("ideas", "Ideas (draft)", "2026", "A seed map", 2,
                           "The seed terms of the lab's map of the AI debate: interpretation, a draft."),
}


def leaves(g):
    return [i for i in g.get("items") or [] if not i.get("composite_of")]


def build():
    inputs, items, decks, deck_ids = [], [], [], []
    for slug, (key, label, date, era, era_sort, about) in DECKS.items():
        rel = f"grammars/{slug}/grammar.json"
        inputs.append(rel)
        g = load_json(rel)
        stub_ids = []
        for it in leaves(g):
            stub = {"id": f"{key}--{it['id']}", "name": it["name"], "level": 1}
            if it.get("keywords"):
                stub["keywords"] = it["keywords"]
            stub["metadata"] = {"source_deck": slug, "source_item_id": it["id"], "deck": label, "castable": True}
            if it.get("image_url"):
                stub["image_url"] = it["image_url"]
            items.append(stub)
            stub_ids.append(stub["id"])
        deck_ids.append(f"deck-{key}")
        items.append({
            "id": f"deck-{key}", "name": label, "level": 2,
            "description": f"{about} {len(stub_ids)} cards.",
            "metadata": {"kind": "deck", "deck_slug": slug},
            "composite_of": stub_ids,
        })
        decks.append({"slug": slug, "label": label, "date": date, "era": era, "era_sort": era_sort,
                      "cards": len(stub_ids)})
    items.append({
        "id": "root-all-decks", "name": "All decks", "level": 3,
        "description": "Every castable card on the site, as pointers to its own deck.",
        "metadata": {"kind": "root"},
        "composite_of": deck_ids,
        "sections": {"What it is": ("The pool the Spread Caster draws from. Each card here is a pointer: "
                                    "its full entry opens from its own deck.")},
    })
    for n, it in enumerate(items, 1):
        it["sort_order"] = n
    check_ids(items)
    return items, decks, inputs


def grammar(items, decks, inputs):
    st = stamps(BUILT_BY, "the decks listed in DECKS in " + BUILT_BY, inputs,
                "Generated: pointers to the castable decks' cards; the content lives in each deck.")
    out = {"_grammar_commons": st.pop("_grammar_commons"),
           "name": "All decks — the castable pool",
           "slug": SLUG,
           "grammar_type": "custom",
           "creator_name": st.pop("creator_name"),
           "creator_link": "https://learning.recursive.eco/viewers/caster-studio.html",
           "default_view": "cards",
           "provenance": "reference",
           "is_meta": True}
    out.update(st)
    out.update({
        "description": ("Every castable card on the site in one pool, as pointers: the Words deck and the Ideas "
                        "seed map. The Spread Caster draws from it; each card's entry opens from its own deck."),
        "tags": ["meta", "cast", "words", "ideas"],
        "is_published": True,
        "_decks": decks,
        "items": items,
    })
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT), help="write <out>/" + OUT_REL + " (default: the repo)")
    a = ap.parse_args()
    items, decks, inputs = build()
    p = write_json(a.out, OUT_REL, grammar(items, decks, inputs))
    print(f"{SLUG}: " + ", ".join(f"{d['label']} {d['cards']}" for d in decks) + f" -> {p}")


if __name__ == "__main__":
    main()
