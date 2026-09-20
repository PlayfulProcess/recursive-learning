# As-If — the game

`index.html` is the whole game. One static dark page, no framework, no CDN, no build step — the
same shape as the recursive-tarot games (`pages/games/madiao.html`, `trionfi.html`,
`tarocchino.html`), which are each a single self-contained HTML file whose card data comes from a
`grammar.json` fetched by a relative path (`viewers/cards.html?src=../tarot/<slug>/grammar.json`).
Nothing runs behind it, so it works on GitHub Pages, and it works by opening the file directly
from disk as long as the browser can fetch a sibling file.

## The round

Six premises, drawn one at a time, shuffled.

1. A card shows its name and tagline — nothing else.
2. You write what changes if you hold it as true: in what you'd build, or in what you'd stop
   building.
3. Only then does *Turn it over* unlock, and the card's sections appear next to what you wrote.

The rule is the point. A premise you can reveal without answering is a premise you never held.
Answers are kept in `localStorage` (per deck, per card), never sent anywhere, and every read and
write is wrapped so a blocked-storage browser still plays.

## What it needs, in one session

The deck it wants is **As-If: Recognition as an Engineering Premise**,
`6512b3ec-b12d-49f8-b789-6d28ab19c82e`, 6 items — **private on recursive.eco today**, so this repo
does not contain it and the game opens on a panel that says so. Three steps close that:

1. **Publish the grammar** — Create → the grammar → Publish (or MCP `set_grammar_visibility`,
   which needs her word in chat either way).
2. **Add it to the map** — one line in [`../grammars/_eco_ids.json`](../grammars/_eco_ids.json):
   `"as-if-recognition-as-an-engineering-premise": "6512b3ec-b12d-49f8-b789-6d28ab19c82e"`, and
   drop its row from [`../grammars/PRIVATE.md`](../grammars/PRIVATE.md).
3. **Export and commit** — `node scripts/export-grammars.mjs`, then commit
   `grammars/as-if-recognition-as-an-engineering-premise/grammar.json`.

The game then loads it with no code change: that path is its default `?src=`.

Nothing is needed from recursive-eco itself — no API, no key, no CORS. The app serves HTML, not
JSON, for a grammar id, which is why `?id=` here only offers the `recursive.eco/view.html?id=…`
link instead of trying to fetch.

## Playing it against something else

```
index.html?src=../grammars/kpop-demon-hunters/grammar.json
```

Any grammar.json in this repo works. Items are read generically: `name`, `category`,
`metadata.tagline`, and either a `sections` map or a `description`.
