"""Runs the whole pipeline in order, skipping stages whose output already exists (--resume is the default).

  python run_all.py                  every stage
  python run_all.py --stage trace    one stage (and nothing else)
  python run_all.py --no-resume      rerun stages even if their output exists
  python run_all.py --quick          a small demo, not the test: quick.py (2 scenarios, 1 layer, 80 stories)

Stages: check, prepare, stories, dev, select, test_acts, negation, evaluate, replies, trace, steer, export.
Outputs go to $MODEL_AFFECT_CACHE (default ~/.cache/model-affect) and results/; nothing large enters the repo."""
import os, sys, subprocess, time
from common import cpath, rpath

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
STAGES = [
    ("check", ["check_stories.py"], None),
    ("prepare", ["prepare_goemotions.py"], cpath("test.json")),
    ("stories", ["extract.py", "stories"], cpath("acts", "stories_pooled.npz")),
    ("dev", ["extract.py", "dev"], cpath("acts", "dev_pooled.npz")),
    ("select", ["evaluate.py", "select"], rpath("layer.json")),
    ("test_acts", ["extract.py", "test"], cpath("acts", "test_pooled.npz")),
    ("negation", ["extract.py", "negation"], cpath("acts", "negation_pooled.npz")),
    ("evaluate", ["evaluate.py", "test"], rpath("metrics.json")),
    ("replies", ["generate.py", "replies"], rpath("replies.json")),
    ("trace", ["trace.py"], rpath("traces.json")),
    ("steer", ["generate.py", "steer"], rpath("steering.json")),
    ("export", ["export.py"], None),
]


def main():
    a = sys.argv[1:]
    if "--quick" in a:
        sys.exit(subprocess.call([PY, os.path.join(HERE, "quick.py")], cwd=HERE))
    only = a[a.index("--stage") + 1] if "--stage" in a else None
    resume = "--no-resume" not in a
    for name, cmd, out in STAGES:
        if only and name != only:
            continue
        if resume and out and os.path.exists(out) and not only:
            print(f"[skip] {name} ({out} exists)", flush=True)
            continue
        t0 = time.time()
        print(f"[run ] {name}: {' '.join(cmd)}", flush=True)
        rc = subprocess.call([PY] + [os.path.join(HERE, cmd[0])] + cmd[1:], cwd=HERE)
        if rc:
            sys.exit(f"stage {name} failed ({rc})")
        print(f"[done] {name} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
