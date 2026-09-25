# -*- coding: utf-8 -*-
"""Build grammars/_collection.json and the plain line covers in grammars/_covers/.

    python scripts/build_collection.py              write them in place
    python scripts/build_collection.py --out DIR    write them under DIR at their repo paths
                                                    (check_all --check diffs both, file by file)

PORTED from recursive-iching/scripts/build_collection.py (itself a port of recursive-tarot's
collection builder), same schema, root path grammars/. Glob-driven: every grammars/*/grammar.json
is listed, so a new grammar appears without touching this file; the curation below only ADDS
what the grammar files do not carry (a branch, a provenance, a status). A grammar this script
does not know lands in "other", living, never guessed into a date.

Readers: the home gallery (site/index.html: `!is_meta && cover_image_url`, two bands by
`provenance`: living = Practice, record = Record), the cards viewer's deck switcher and deck
picker, the explorer, and scripts/check_all.py (collection).

COVERS (CLAUDE.md rule 4: no AI-generated images). A grammar keeps its own cover_image_url only
when it is a credited public-domain work on Wikimedia Commons; every other grammar gets a plain
line cover written here (her spiral from scripts/mark.svg, the grammar's short name, the branch).
That also keeps every home cover unique, which check_all asserts. The films' own covers (images
made with recursive.eco's image generator) and thumbnails of copyrighted video stay inside those
grammars; they are not put on the home page.
Python standard library only.
"""
import argparse, glob, json, os, re, sys
from pathlib import Path

from lib_grammar import ROOT, json_bytes, line_cover_svg, write_bytes

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUT_REL = "grammars/_collection.json"
COVERS_REL = "grammars/_covers"
REPO = "PlayfulProcess/recursive-learning"
META = "all-decks"

# (id, name, provenance). The order is the home gallery's order, band by band.
BRANCHES = [
    ("words",   "Words — the glossary as cards",                      "living"),
    ("ideas",   "Ideas — a seed map of the AI debate, a draft",        "living"),
    ("games",   "Games — the decks the games deal",                     "living"),
    ("films",   "Films — sequences cut from public footage",           "living"),
    ("courses", "Courses — how the tools are made and used",           "living"),
    ("studies", "Studies — longer readings",                           "living"),
    ("other",   "Other",                                               "living"),
    ("record",  "Record — sources and institutions, dated",            "record"),
    ("meta",    "The castable pool",                                   "reference"),
]
BRANCH_OF = {
    "words-deck": "words",
    "ideas-of-alignment": "ideas",
    "as-if-hot-potato-edition": "games",
    "hot-potato-the-chosen-alien-invasion": "films",
    "the-chosen-alien-invasion": "films",
    "the-chosen-alien-invasion-v2": "films",
    "the-chosen-alien-invasion-star-wars-primitives": "films",
    "kpop-demon-hunters": "films",
    "create-grammars-with-ai": "courses",
    "create-magic-stories-for-your-kids-with-ai": "courses",
    "vibe-coding-101-tools-and-process": "courses",
    "vibe-coding-102-audiobook-with-claude-code": "courses",
    "vibe-coding-with-claude-journaling-tools": "courses",
    "the-freedom-paradox": "studies",
    "sources-of-alignment": "record",
    "institutions-of-alignment": "record",
    META: "meta",
}
# A short name where the grammar's own name does not tell two grammars apart (the home gallery,
# the cards viewer's deck switcher and the line cover all use it).
COMMON_NAME = {
    "the-chosen-alien-invasion": "The Chosen Alien Invasion",
    "the-chosen-alien-invasion-v2": "The Chosen Alien Invasion, v2",
    "the-chosen-alien-invasion-star-wars-primitives": "The Chosen Alien Invasion, opening test",
    "hot-potato-the-chosen-alien-invasion": "Hot Potato: The Chosen Alien Invasion",
}
# Kicker line on a line cover (short; set in capitals).
KICKER = {"words": "Words", "ideas": "Ideas · draft", "games": "Game deck", "films": "Film",
          "courses": "Course", "studies": "Study", "other": "Grammar", "record": "Record", "meta": "All decks"}
COMMONS = re.compile(r"^https://(upload|commons)\.wikimedia\.org/", re.I)


def short_name(name, slug):
    return re.split(r"\s[—–]\s|:\s", (name or slug).strip())[0].strip() or slug


def has_generated_images(g):
    """True when the grammar carries a picture made with recursive.eco's image generator: the app
    records one in an item's metadata.image_generation, and serves it from /flow-image-gen/. The
    home gallery marks such a grammar (the About page says so)."""
    for it in [g] + list(g.get("items") or []):
        if (it.get("metadata") or {}).get("image_generation"):
            return True
        if any("/flow-image-gen/" in str(it.get(k) or "") for k in ("image_url", "cover_image_url")):
            return True
    return False


def blurb_of(g):
    desc = (g.get("description") or "").strip().split("\n")[0]
    return (desc[:200] + "…") if len(desc) > 200 else desc


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT), help="write under this folder at the repo paths (default: the repo)")
    a = ap.parse_args()

    branch_ids = [b[0] for b in BRANCHES]
    prov_of = {b[0]: b[2] for b in BRANCHES}
    entries, covers = [], {}
    for path in sorted(glob.glob(str(ROOT / "grammars" / "*" / "grammar.json"))):
        slug = os.path.basename(os.path.dirname(path))
        g = json.loads(Path(path).read_text(encoding="utf-8"))
        branch = BRANCH_OF.get(slug, "other")
        e = {
            "slug": slug,
            "name": g.get("name"),
            "type": g.get("grammar_type"),
            "branch": branch,
            "is_meta": slug == META,
            "default_preview": g.get("default_preview"),
            "items": len(g.get("items") or []),
            "blurb": blurb_of(g),
            "path": f"grammars/{slug}/grammar.json",
            "provenance": prov_of[branch],
        }
        if slug in COMMON_NAME:
            e["common_name"] = COMMON_NAME[slug]
        if g.get("status"):
            e["status"] = g["status"]
        if g.get("_generated"):
            e["generated"] = True
        if has_generated_images(g):
            e["ai_images"] = True
        if slug != META:
            own = g.get("cover_image_url") or ""
            if COMMONS.match(own):
                e["cover_image_url"] = own
                e["cover_credit"] = "the grammar's own cover, a public-domain work on Wikimedia Commons"
            else:
                covers[slug] = line_cover_svg(COMMON_NAME.get(slug) or short_name(g.get("name"), slug), KICKER[branch])
                e["cover_image_url"] = f"/{COVERS_REL}/{slug}.svg"
                e["cover_credit"] = "a plain line cover (her spiral and the name), built by scripts/build_collection.py"
        entries.append(e)
    entries.sort(key=lambda e: (branch_ids.index(e["branch"]), (e["name"] or e["slug"]).lower()))

    collection = {
        "repo": REPO,
        "branch": "main",
        "github_url": f"https://github.com/{REPO}",
        "collection": "recursive-learning",
        "name": "Recursive Eco-Improvement: explorations in adaptive alignment",
        "version": "1.0.0",
        "license": "Mixed: see each grammar's own licence; this site's own text and generated grammars are CC-BY-SA-4.0",
        "original_creator": None,
        "creator_name": "PlayfulProcess",
        "meta_grammar": META,
        "_generated": True,
        "_built_by": "scripts/build_collection.py",
        "branches": [{"id": bid, "name": bname, "provenance": prov,
                      "deck_slugs": [e["slug"] for e in entries if e["branch"] == bid]}
                     for bid, bname, prov in BRANCHES if any(e["branch"] == bid for e in entries)],
        "grammars": entries,
    }
    write_bytes(a.out, OUT_REL, json_bytes(collection))
    for slug, svg in covers.items():
        write_bytes(a.out, f"{COVERS_REL}/{slug}.svg", svg)
    # a cover whose grammar is gone must not linger (check_all diffs the folder both ways)
    cdir = Path(a.out) / COVERS_REL
    for f in cdir.glob("*.svg"):
        if f.stem not in covers:
            f.unlink()
    print(f"_collection.json: {len(entries)} grammars, {len(covers)} line covers -> {Path(a.out) / OUT_REL}")


if __name__ == "__main__":
    main()
