# Recursive Ekho: the builders

Recursive Ekho is one world with two lenses. **Sources** is what is sourced: The Walk's endings, moves argued by a voice, quotes matched to captions. **Ekho** is her lore, the **Recursive Map** grammar. Drafts, published under CC BY-SA at her word (Oct 12 2026); the Recursive Map is repo-first and recursive.eco edits it.

| Step | Command | What it does |
|---|---|---|
| Ekho lens | `python scripts/ekho/map_to_ekho.py grammars/recursive-map/grammar.json data/ekho/ekho.json` | Reads the Recursive Map (repo-first since Oct 11 2026; the only copy) and writes the Ekho lens |
| Sources lens | `node scripts/ekho/extract_moves.js <recursive-eco>/docs/ai-readiness/five-futures-draft-1.html game/spread.html data/ekho/sources.json` | The Walk's seven endings plus the odds board's argued moves and voices (scaffolding until the futures deck exists as a grammar) |
| World page | `python scripts/ekho/build_world_page.py <recursive-eco>/docs/ai-readiness/ekho/world.template.html data/ekho <out.html>` | Injects the three data files into the private prototype page (the template stays in the private repo while its code-drawn look waits for her exception to rule 4) |
| Gospel quotes | `python <recursive-gospels>/scripts/build_recursive_map.py --check grammars/recursive-map/grammar.json` | Checks every gospel quotation in the Map against recursive-gospels `sources/` |

## The convention, in the grammar itself

- `category` names the kind: principle, being, training, practice, strategy, wildcard, parameter (the dial), place, ending, myth, selection.
- `metadata.noun` maps each node to the model's nouns: principle, voice, move, wildcard, dial, step, ending, story.
- Moves carry `metadata.move_kind` (goodwill, processing, creative-work, take) and `metadata.adaptive_when`: `"any"` (robust) or `{"wildcard": id, "face": id}` (conditional).
- Wildcards carry `metadata.faces` `[{id, name}]` and one section per face, titled exactly `Face: <name> ◇`.
- Practices carry `metadata.faces` `["human", "ai"]` and the sections "The text", "For a human ◇" and "For an AI ◇".
- Endings carry `metadata.name_status: "placeholder"` until she names them.
- Her words sit in a "Her words" section, verbatim; "In her words" stays `(blank)` until she writes it.

`data/ekho/*.json` is scaffolding. Delete it once the Recursive Map and the futures deck exist as grammars and the game reads them from `../grammars/`.
