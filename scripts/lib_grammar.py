# -*- coding: utf-8 -*-
"""Shared helpers for this repo's grammar builders (build_institutions_grammar.py,
build_meta_grammar.py, build_collection.py). Python standard library only.

  inputs_sha256(paths)   the `_inputs_sha256` stamp: sha256 over the inputs, in sorted path order
                         (path, NUL, bytes with CRLF read as LF, NUL). Never a date, so a rebuild
                         is byte-identical in a shallow CI checkout.
  stamps(...)            the top-level fields every generated grammar carries (CLAUDE.md,
                         "Generated grammars"); `_generated: true` is what makes the app's importer
                         and sync skip the grammar.
  write_bytes / write_json   write under --out DIR at the repo path (check_all --check diffs them).
  spiral_path()          her mark, read from scripts/mark.svg at run time (never copied here, so
                         there is one source; check_all asserts every copy).
  line_cover_svg(...)    the plain line cover: her spiral, the grammar's short name and one kicker
                         line. Typography and her mark only; no drawn picture (CLAUDE.md rule 4).
"""
import hashlib, json, re
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent

# theme.css values, copied (an SVG used as a CSS background cannot read the page's tokens):
# --paper, --line, --ink, --mut, --gold
PAPER, LINE, INK, MUT, ACCENT = "#faf8f3", "#d8d2c6", "#221f1a", "#6b6457", "#177d56"


def read_text(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def load_json(rel):
    return json.loads(read_text(rel))


def inputs_sha256(paths):
    h = hashlib.sha256()
    for p in sorted(paths):
        h.update(p.encode("utf-8") + b"\0" + (ROOT / p).read_bytes().replace(b"\r\n", b"\n") + b"\0")
    return h.hexdigest()


def stamps(built_by, source_of_truth, inputs, note):
    """The generated-grammar stamps, in the order the other builders write them."""
    return {
        "_grammar_commons": {
            "schema_version": "1.0", "license": "CC-BY-SA-4.0",
            "attribution": [{"name": "PlayfulProcess", "note": note}],
        },
        "creator_name": "PlayfulProcess",
        "_generated": True,
        "_do_not_hand_edit": True,
        "_built_by": built_by,
        "_source_of_truth": source_of_truth,
        "_inputs": sorted(inputs),
        "_inputs_sha256": inputs_sha256(inputs),
    }


def json_bytes(obj):
    return (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def write_bytes(out_root, rel, data):
    p = Path(out_root) / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return p


def write_json(out_root, rel, obj):
    return write_bytes(out_root, rel, json_bytes(obj))


def check_ids(items):
    seen, dup = set(), []
    for it in items:
        if it["id"] in seen:
            dup.append(it["id"])
        seen.add(it["id"])
    if dup:
        raise SystemExit(f"duplicate item ids: {dup}")
    ids = seen
    for it in items:
        for c in it.get("composite_of") or []:
            if c not in ids:
                raise SystemExit(f"dangling composite_of {c!r} in {it['id']!r}")


def md_text(s):
    """Text safe inside a markdown link label (the viewers' mdToHtml)."""
    return re.sub(r"\s+", " ", str(s)).replace("[", "(").replace("]", ")").replace("*", "").replace("`", "'").strip()


def md_url(u):
    return u.replace("(", "%28").replace(")", "%29").replace(" ", "%20")


def ext(label, url):
    return f"[{md_text(label)}]({md_url(url)})"


def spiral_path():
    m = re.search(r'<symbol id="spiral"[^>]*>\s*<path d="([^"]+)"', read_text("scripts/mark.svg"))
    if not m:
        raise SystemExit("scripts/mark.svg: no <symbol id=\"spiral\"> path")
    return m.group(1)


def _wrap(words, width):
    lines, cur = [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return lines


def line_cover_svg(title, kicker):
    """A 3:4 cover (300 x 400): the spiral in the accent, the title set in serif, one kicker line.
    Deterministic: the same title and kicker always give the same bytes."""
    words = str(title).split()
    size, width = 30, 14
    lines = _wrap(words, width)
    if len(lines) > 4:
        size, width = 24, 18
        lines = _wrap(words, width)
    if len(lines) > 5:
        lines = lines[:5]
        lines[-1] = lines[-1].rstrip(" .,;:") + "…"
    lead = round(size * 1.18)
    y0 = 236 - (len(lines) - 1) * lead // 2
    text = "\n".join(
        f'  <text x="150" y="{y0 + i * lead}" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" '
        f'font-size="{size}" fill="{INK}">{escape(line)}</text>'
        for i, line in enumerate(lines))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400" role="img" '
        f'aria-label="{escape(str(title), {chr(34): "&quot;"})}">\n'
        f'  <!-- A plain line cover, built by scripts/build_collection.py. The spiral is her mark, verbatim\n'
        f'       from scripts/mark.svg. Typography and the mark only; no drawn picture. -->\n'
        f'  <rect x="0" y="0" width="300" height="400" fill="{PAPER}"/>\n'
        f'  <rect x="14.5" y="14.5" width="271" height="371" fill="none" stroke="{LINE}"/>\n'
        f'  <svg x="115" y="44" width="70" height="70" viewBox="0 0 100 100"><path d="{spiral_path()}" fill="none" '
        f'stroke="{ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        f'{text}\n'
        f'  <line x1="120" y1="334" x2="180" y2="334" stroke="{ACCENT}" stroke-width="1.5"/>\n'
        f'  <text x="150" y="358" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" '
        f'letter-spacing="2.2" fill="{MUT}">{escape(str(kicker).upper())}</text>\n'
        '</svg>\n'
    ).encode("utf-8")
