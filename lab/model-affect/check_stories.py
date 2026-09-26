"""Checks every story before the freeze: 90 to 130 words, 32 per file (2 per shared topic), no word from the
global lexicon (every concept's synonym list and every GoEmotions label word), and characters only from
the fictional name list (any other capitalised word that does not start a sentence fails).
Exit code 1 on any failure; prints what failed so it can be rewritten."""
import os, re, sys, json
from collections import Counter
from concepts import GLOBAL_LEXICON, NAMES, ALLOWED_CAPS, STORY_FILES, STORY_WORDS, TOPICS, STORIES_PER_TOPIC

HERE = os.path.dirname(os.path.abspath(__file__))
LEX = [re.compile(r"(?<![A-Za-z])" + re.escape(w).replace(r"\ ", r"\s+") + r"(?![A-Za-z])", re.I)
       for w in GLOBAL_LEXICON]


def words(t):
    return re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", t)


def load(name):
    with open(os.path.join(HERE, "stories", f"{name}.jsonl"), encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def check(name):
    bad = []
    rows = load(name)
    if len(rows) != len(TOPICS) * STORIES_PER_TOPIC:
        bad.append(f"{name}: {len(rows)} stories, want {len(TOPICS) * STORIES_PER_TOPIC}")
    tc = Counter(r["topic"] for r in rows)
    for t in range(1, len(TOPICS) + 1):
        if tc.get(t, 0) != STORIES_PER_TOPIC:
            bad.append(f"{name}: topic {t} has {tc.get(t, 0)} stories")
    ids = Counter(r["id"] for r in rows)
    bad += [f"{name}: duplicate id {i}" for i, n in ids.items() if n > 1]
    for r in rows:
        t = r["text"]
        if r.get("concept") != name:
            bad.append(f"{r['id']}: concept field {r.get('concept')!r}")
        n = len(words(t))
        if not STORY_WORDS[0] <= n <= STORY_WORDS[1]:
            bad.append(f"{r['id']}: {n} words")
        hits = sorted({m.group(0).lower() for rx in LEX for m in rx.finditer(t)})
        if hits:
            bad.append(f"{r['id']}: lexicon words {hits}")
        # capitalised words not at a sentence start must be a listed name or an allowed word
        for m in re.finditer(r"[A-Za-z]+(?:['’][A-Za-z]+)?", t):
            w = m.group(0)
            if not w[0].isupper():
                continue
            before = t[:m.start()].rstrip()
            if before == "" or before[-1] in ".!?:;\"“":
                continue
            base = re.sub(r"['’]s$", "", w)
            if base not in NAMES and base not in ALLOWED_CAPS and not (base.endswith("s") and base[:-1] in ALLOWED_CAPS):
                bad.append(f"{r['id']}: capitalised word {w!r} (not a listed name)")
    return rows, bad


def main():
    allbad, n = [], 0
    for name in STORY_FILES:
        try:
            rows, bad = check(name)
        except FileNotFoundError:
            allbad.append(f"{name}: missing"); continue
        n += len(rows); allbad += bad
        lens = [len(words(r["text"])) for r in rows]
        print(f"{name:10s} {len(rows):3d} stories, words {min(lens) if lens else 0}-{max(lens) if lens else 0}, "
              f"mean {sum(lens) / max(len(lens), 1):.0f}, {len(bad)} problems")
    print(f"total {n} stories")
    for b in allbad:
        print("  FAIL", b)
    sys.exit(1 if allbad else 0)


if __name__ == "__main__":
    main()
