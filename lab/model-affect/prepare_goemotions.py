"""Downloads GoEmotions (Demszky et al. 2020) into the cache (never into the repo), draws the dev and test
samples with the frozen seed, and lists the comments the Sep 24 spike read (by replaying extract2.py's
seed-0 shuffle), so every test can also be reported on the spike-untouched subset.

Writes (cache): goemotions/*, dev.json, test.json, spike_touched.json. Writes (repo): results/data_counts.json
(counts and ids only, no comment text) and results/licence.json."""
import os, csv, re, json, random, urllib.request
from collections import Counter, defaultdict
from concepts import (GOEMO_BASE, GOEMO_FILES, SEED, SPIKE_SEED, CONCEPTS, DEV_CAPS, TEST_CAPS,
                      DESPAIR_GRIEF_SHARE)
from common import cpath, rpath, jsave

GD = cpath("goemotions")


def download():
    os.makedirs(GD, exist_ok=True)
    for fn in GOEMO_FILES + ["README.md"]:
        p = os.path.join(GD, fn)
        if not os.path.exists(p):
            print("downloading", fn, flush=True)
            urllib.request.urlretrieve(GOEMO_BASE.replace("/data/", "/") + fn if fn == "README.md" else GOEMO_BASE + fn, p)
    lic = os.path.join(GD, "REPO_LICENSE")
    if not os.path.exists(lic):
        urllib.request.urlretrieve("https://raw.githubusercontent.com/google-research/google-research/master/LICENSE", lic)


def licence_note():
    readme = open(os.path.join(GD, "README.md"), encoding="utf-8").read()
    hits = [l.strip() for l in readme.splitlines() if re.search(r"licen[cs]e|CC BY|creative commons", l, re.I)]
    head = open(os.path.join(GD, "REPO_LICENSE"), encoding="utf-8").read().splitlines()[:3]
    return {"goemotions_readme_lines": hits, "repo_license_head": [h.strip() for h in head if h.strip()],
            "source": GOEMO_BASE}


def read_split(sp, labs):
    rows = []
    with open(os.path.join(GD, f"{sp}.tsv"), encoding="utf-8") as f:
        for r in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            rows.append({"text": r[0], "labels": [labs[int(i)] for i in r[1].split(",")], "split": sp, "id": r[2]})
    return rows


def spike_touched(labs):
    """Exact replay of the spike's extract2.py sampling (random.Random(0) over train+dev+test)."""
    rng = random.Random(SPIKE_SEED)
    rows = []
    for sp in ["train", "dev", "test"]:
        rows += read_split(sp, labs)
    rng.shuffle(rows)
    CAP_TARGET = {"grief": 10 ** 6, "relief": 120, "remorse": 100}
    COMPARE = ["sadness", "disappointment", "fear", "embarrassment", "joy", "gratitude", "optimism",
               "nervousness", "anger", "neutral"]
    picked, seen, counts = [], set(), {}
    for r in rows:
        for t in CAP_TARGET:
            if t in r["labels"] and counts.get(t, 0) < CAP_TARGET[t] and r["text"] not in seen:
                picked.append(r); seen.add(r["text"]); counts[t] = counts.get(t, 0) + 1
    for r in rows:
        if len(r["labels"]) == 1 and r["labels"][0] in COMPARE and r["text"] not in seen:
            l = r["labels"][0]
            if counts.get(l, 0) < 50:
                picked.append(r); seen.add(r["text"]); counts[l] = counts.get(l, 0) + 1
    ntok = []
    for r in rows:
        if r["labels"] == ["neutral"] and r["text"] not in seen and len(ntok) < 80:
            ntok.append(r); seen.add(r["text"])
    return sorted({r["id"] for r in picked + ntok}), counts


def sample(rows, caps, rng):
    """Single-label comments only; up to caps['pos'] for every label that is some concept's positive, caps['other']
    for every other emotion label, caps['neutral'] for neutral. One shuffle, then first-k per label."""
    pos_labels = {l for c in CONCEPTS for l in c["pos"]}
    rows = [r for r in rows if len(r["labels"]) == 1]
    seen, uniq = set(), []
    for r in rows:
        if r["text"] not in seen:
            seen.add(r["text"]); uniq.append(r)
    rng.shuffle(uniq)
    by = defaultdict(list)
    for r in uniq:
        l = r["labels"][0]
        cap = caps["neutral"] if l == "neutral" else caps["pos"] if l in pos_labels else caps["other"]
        if len(by[l]) < cap:
            by[l].append({"id": r["id"], "text": r["text"], "label": l, "split": r["split"]})
    out = [x for l in sorted(by) for x in by[l]]
    return out


def main():
    download()
    labs = open(os.path.join(GD, "emotions.txt")).read().split()
    touched, spike_counts = spike_touched(labs)
    jsave(touched, cpath("spike_touched.json"), indent=None)
    rng = random.Random(SEED)
    dev = sample(read_split("dev", labs), DEV_CAPS, rng)
    test = sample(read_split("train", labs) + read_split("test", labs), TEST_CAPS, rng)
    jsave(dev, cpath("dev.json"), indent=None)
    jsave(test, cpath("test.json"), indent=None)
    ts = set(touched)
    counts = {"dev": dict(Counter(r["label"] for r in dev)), "test": dict(Counter(r["label"] for r in test)),
              "test_spike_untouched": dict(Counter(r["label"] for r in test if r["id"] not in ts)),
              "spike_touched_total": len(touched), "spike_counts": spike_counts,
              "grief_share_rule": DESPAIR_GRIEF_SHARE}
    jsave(counts, rpath("data_counts.json"))
    jsave(licence_note(), rpath("licence.json"))
    print(json.dumps(counts["test"], sort_keys=True))
    print("dev", len(dev), "test", len(test), "spike-touched ids", len(touched))


if __name__ == "__main__":
    main()
