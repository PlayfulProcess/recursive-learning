# -*- coding: utf-8 -*-
"""Rebuild every generated file in this repo, in dependency order, in place.

    python scripts/build_all.py            rebuild everything
    python scripts/build_all.py --check    ... then run scripts/check_all.py --check

Order (a builder reads the committed outputs of the ones before it):
  1. build_words_deck.py            glossary/terms.json + spreads.src.json -> words-deck, viewers/spreads.json
  2. build_institutions_grammar.py  research/institutions/institutions.json -> institutions-of-alignment
  3. build_sources_grammar.py       research/lab-export/ + institutions -> sources-of-alignment
  4. build_ideas_grammar.py         research/lab-export/ + research/crosswalk.json -> ideas-of-alignment
  5. build_meta_grammar.py          words-deck + ideas -> all-decks (the caster's pool)
  6. build_collection.py            every grammar -> grammars/_collection.json + grammars/_covers/
  7. build-glossary.mjs             glossary/terms.json + spreads.src.json -> glossary/index.html

Not here: scripts/lab_export.py, which reads the PRIVATE research repo and writes
research/lab-export/ (run it by hand with --repo; see its docstring), and
scripts/export-grammars.mjs, which exports the app-owned grammars from recursive.eco.
Python standard library only (node for the glossary page).
"""
import argparse, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STEPS = [
    "scripts/build_words_deck.py",
    "scripts/build_institutions_grammar.py",
    "scripts/build_sources_grammar.py",
    "scripts/build_ideas_grammar.py",
    "scripts/build_meta_grammar.py",
    "scripts/build_collection.py",
    "scripts/build-glossary.mjs",
]


def run(cmd):
    print("$ " + " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=ROOT, env=dict(os.environ, PYTHONUTF8="1"))
    if r.returncode != 0:
        sys.exit(r.returncode)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="run scripts/check_all.py --check afterwards")
    a = ap.parse_args()
    for s in STEPS:
        run((["node"] if s.endswith(".mjs") else [sys.executable]) + [s])
    if a.check:
        run([sys.executable, "scripts/check_all.py", "--check"])


if __name__ == "__main__":
    main()
