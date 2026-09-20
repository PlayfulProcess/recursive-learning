# The two-channel model

Written Sep 20 2026, answering this, verbatim:

> "I wonder if you could also attempt to create the new repo I was imagining with the game and
> all, and maybe all grammars related to AI, as maybe the recursive.eco channel, and then the
> playfulprocess channel remains for my personal projects? and then I edit multiple channels? Or
> maybe it is recursive learning transformed into a repo?"

Four questions in one sentence. Taken one at a time.

---

## 1. "and then I edit multiple channels?"

Yes, already. A channel is a row — a document with `is_channel = true` — owned by a user. Nothing
in the app limits one per person; ownership is resolved by slug, and every channel you own shows
up on your account page with its own sync panel. Today there are twelve channel documents live,
five of them bound to repos (tarot, astrology, nara, kali-paradevi, family-watch). Editing several
is the normal case, not a new feature.

## 2. "as maybe the recursive.eco channel"

Recommended: **no.** Use the slug `recursive-learning`, not `recursive-eco`.

Two reasons, one of them mechanical:

- **`recursive-eco` is the platform, not a room in it.** A channel named after the whole site
  would be the one channel that cannot be told apart from the site — and channel slugs show up in
  URLs, in the offer/submission API, and in every sync message.
- **`recursive-learning` already exists as a live channel**, with four members, created before
  this repo. The importer resolves channel ownership *by slug* and the database enforces a unique
  index on it (`user_documents_channel_slug_uniq`). Importing this repo under slug
  `recursive-learning` **updates** that channel and adopts its four members. Importing it under
  `recursive-eco` would create a *second*, parallel channel and orphan the first.

This is the one field to change if she disagrees: `channel.slug` in `recursive-eco.json`. Change
it before the first import; after an import, the slug is what everything else points at.

## 3. "the playfulprocess channel remains for my personal projects"

Kept, with one correction of fact: there is no channel whose slug is `playfulprocess`. Her
personal projects live across several channels she owns (kids-stories, wellness, resources,
iching, recursive-tarot, astrology, nara, kali-paradevi) plus her **Personal Channel** at
`/library/altar/<userId>` — the one the Star button fills.

So the split she is describing is real, but it is:

| | This repo | Everything else she owns |
|---|---|---|
| Channel | `recursive-learning` | her other channels + her Personal Channel |
| Subject | AI, the film, the game, recursive learning | tarot, kids' stories, astrology, wellness, books |
| Where the truth lives | this repo (the intent — see §5) | the app, or each channel's own repo |
| Identity | PlayfulProcess | PlayfulProcess |

Nothing needs to move out of the personal channels for this repo to exist.

## 4. "Or maybe it is recursive learning transformed into a repo?"

**Yes — that is the recommendation, and it is what this repo is.**

The one-line reason: **the `recursive-learning` channel already exists with members, so binding it
to a repo continues something rather than starting a rival to it** — and "graduating an existing
channel to GitHub-first" is the exact motion the sync design was built for (`DESIGN-github-sync-
and-contribution.md` §0.1: *born app-first → connected to a repo → graduates → spins out*), where
inventing a new channel is not.

---

## 5. What the sync code would need to treat this repo as the channel's source of truth

Three things, in order. None of them are code changes except the last, which is optional.

1. **Import the repo as the channel.** `POST /api/channel/import-from-github` with
   `{ repoUrl: "https://github.com/PlayfulProcess/recursive-learning" }`, signed in as her. It
   reads `recursive-eco.json` (raw first, GitHub-App contents fallback — so it works while the
   repo is private), upserts the `recursive-learning` channel document with the manifest's
   identity, reads `grammars/_eco_ids.json`, and hashes every `grammars/<slug>/grammar.json` as
   the drift baseline in `sync_hashes`.
2. **Install the GitHub App on this repo** (`recursive-eco[bot]`, App ID 4009636) so the push
   webhook can reindex repo → app, and so the app can write PRs back. Without it, repo→app is
   blind and drift is only ever detected app-side.
3. **Flip `source_of_truth` to `'repo'` on the channel document.** This lives on
   `document_data.source_of_truth`, not in the manifest — the importer does not copy it from
   `recursive-eco.json` today. That flip is what makes the repo canonical: owner saves stop
   committing directly and publishing becomes Resolve-as-PR + merge; `_source_of_truth`/
   `_generated` files are never overwritten by an app push (`sync-pull`, `sync-resolve`,
   `github/webhook` all check it).

   The honest gap: **there is no UI for that flip**, and no path that sets it from the manifest.
   Today it is a row update. The small change that would close it is ~2 lines in
   `import-from-github/route.ts` — carry `manifest.source_of_truth` into `channelDocData` the way
   `icon` / `gradient` / `hero` are carried. `recursive-eco.json` already declares the intent in
   `_source_of_truth_note` so that change has something to read.

After those three, the loop is the one pattern every other repo-channel uses: **save → private
vault always; app → repo as one deliberate sync PR; repo → app by push webhook; the repo wins
between syncs, and the panel tells you when a sync is due.**
