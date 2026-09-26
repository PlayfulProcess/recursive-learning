#!/usr/bin/env bash
# Assemble the published site into DIR (default _site) from scripts/site-folders.txt.
#   bash scripts/assemble-site.sh [_site]
# Then serve it (python -m http.server -d _site 8000) or check it
# (python scripts/check_all.py --site _site). Local tests always run on an assembled site:
# the viewers in site/viewers/ reach the grammars as ../grammars/, which only exists here.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-_site}"
rm -rf "$OUT"
mkdir -p "$OUT"
while read -r src dest; do
  case "$src" in ''|'#'*) continue ;; esac
  if [ "$dest" = "/" ]; then
    cp -r "$src" "$OUT/"
  else
    mkdir -p "$OUT/$(dirname "$dest")"
    cp -r "$src" "$OUT/$dest"
  fi
done < scripts/site-folders.txt
# .nojekyll: without it Pages runs Jekyll and 404s every _-prefixed path (grammars/_eco_ids.json).
test -f "$OUT/.nojekyll" || touch "$OUT/.nojekyll"
echo "--- assembled $OUT ---"
find "$OUT" -maxdepth 2 | sort
