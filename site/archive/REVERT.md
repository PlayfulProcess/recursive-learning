# Putting an archived page back

Nothing has moved into this archive yet (Oct 20 2026). This site's Cards and Tree pages
(`site/viewers/cards.html`, `site/viewers/tree-viewer.html`) are how it reads Words, Sources and
Ideas, which have no recursive.eco id yet, so they stay where they are. This folder holds the
archive page and its "build your own" guide; the Method menu links it (`site/site-header.js`).

When they do move (once those grammars open in Play), each move is one `git mv` into
`site/archive/`, a stub at the old address that forwards with the query and `#hash`, and a line
here. Putting one back is the reverse: delete the stub, `git mv` the page back, undo its
`../viewers/` path edits, point `site/site-header.js` and `site/view-switcher.js` back. The tarot
site's `archive/REVERT.md` shows the same steps for pages that have moved.

Note: `site/viewers/*` is written by `scripts/port_from_tarot.py`. That script fails today on a
drifted assert (tarot's Cards page dropped its "Decks" picker button), and the header's six rooms
were edited by hand after the last port, so a re-run would also overwrite them. Bring the port up
to date before using it to move these pages.

To remove the archive page itself, revert the pull request's merge commit.
