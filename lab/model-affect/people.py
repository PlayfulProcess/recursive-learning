"""People's passages (section 12 of the pre-registration): NOT run in v1.

The recommendation is to leave real people's words out of v1 (decision 3 for PlayfulProcess). If she says
yes, the passage rules are frozen first in ADDENDUM-people.md (phrase list, skip regex, selection order,
the excluded NYT show), committed and pushed before any passage is read. Only then does this script run:

  python people.py <path to the private transcript folder>

It reads the private transcripts from that path, never copies transcript text into the repo, and writes only
axis readings (never concept labels) for snippets of at most 20 words, each linked to its YouTube moment."""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

if __name__ == "__main__":
    if not os.path.exists(os.path.join(HERE, "ADDENDUM-people.md")):
        sys.exit("No ADDENDUM-people.md: people's passages are not part of v1. Freeze the addendum first.")
    sys.exit("The addendum exists, but the people pipeline is written only after it is pushed (see README).")
