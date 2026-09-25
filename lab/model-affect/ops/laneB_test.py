"""Second lane for `extract.py test`: computes the same part files, highest parts first, so two processes share
the work. Each part is computed by extract.main() unchanged (same texts, same code); this wrapper only makes
it skip every part but one, and sends its (partial) assembly to a scratch file that nothing reads."""
import os, sys
sys.path.insert(0, os.getcwd())
sys.argv = ["extract.py", "test"]
import extract, common
real_exists = os.path.exists
real_cpath = extract.cpath
extract.cpath = lambda *p: real_cpath("acts", "laneB_scratch.npz") if p[-1] == "test_pooled.npz" else real_cpath(*p)
n = len(common.jload(real_cpath("test.json")))
for start in sorted(range(0, n, 256), reverse=True)[:5]:
    part = real_cpath("acts", "test", f"part_{start:05d}.npz")
    if real_exists(part):
        continue
    os.path.exists = lambda p, s=start: real_exists(p) if not os.path.basename(p).startswith("part_") else (os.path.basename(p) != f"part_{s:05d}.npz" or real_exists(p))
    extract.main()
    os.path.exists = real_exists
print("lane B done")
