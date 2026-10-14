# Private grammars — index only

These belong to this channel by subject, but they are **not public on recursive.eco**
(`is_public = false`), so their contents are **not** in this repo. Only the name and the id are
listed. Nothing here was read out of the app into a file.

To include one: publish it on recursive.eco (Create → the grammar → Publish, or the MCP
`set_grammar_visibility`), add its slug + id to [`_eco_ids.json`](./_eco_ids.json), and run

```
node scripts/export-grammars.mjs
```

The script refuses anything still private — it reads with the anonymous key, which can only see
`is_public = true` rows — so a forgotten publish fails loudly instead of leaking.

| Grammar | id | Items | Why it's here |
|---|---|---|---|
| As-If: Recognition as an Engineering Premise | `6512b3ec-b12d-49f8-b789-6d28ab19c82e` | 6 | The game's source deck — see [`../game/README.md`](../game/README.md). **Publish this one first**: the game has nothing to play until it exists. |
| Ilya Sutskever — sources (for the film) | `117e5648-b6a2-42c9-888e-7b65896f059d` | 9 | Source material for the film. Carries an `ai_personality_prompt`, which is never exported to this repo. |
| Prayer for the Loop | `202b82ba-160a-412c-ac74-96569c5df035` | 14 | The song/prayer for Studies. Draft. |
| Nobody Made the Honmoon | `445c34c7-afe5-4a54-adb4-e0cf6541c182` | 0 | Empty shell — a title waiting for a grammar. |
| AI Consciousness — the project | `f837871d-b333-4e01-8033-81092c49b94f` | 53 | The research spine behind the film. |
| AI Consciousness — the playlist | `0ae5ad73-3f06-4a3b-a8d0-75d6df4fa5e2` | 13 | The watch list the project was built from. |
| ML 101 — how the machines are made (after AI 101) | `b6742232-57a0-4e3b-aec7-afd403e6fa45` | 25 | Course, unfinished. |
| AI 101 — Build a Very Smart Chat | `98ff0d88-7b99-4765-91db-e4c84ecaf025` | 6 | Course, unfinished. |
| Readings: How can we approach studying ai for education? | `c8f69a3a-322e-47fb-9814-a342f57d6005` | 4 | A saved reading, not a published work. |

Two duplicate private copies of *Vibe Coding 101 — Tools & Process* (`e7b54a6f-…`,
`d0119f59-…`) are deliberately left out of this table: the public original is already exported.

## The one thing that never gets exported

`ai_personality_prompt`. It is stripped by `scripts/export-grammars.mjs` on every run, for public
grammars too — two of the grammars in the channel carry one. Nothing else is stripped beyond the
app's own `NON_CONTENT_APP_KEYS` / `NON_CONTENT_ITEM_KEYS` lists, which exist so that row
bookkeeping (`editors`, `origin`, `_detected_categories`, …) never gets mistaken for content.
