"""Runs extract.main() unchanged for chosen part files only (parallel lanes over the same parts the frozen
script would compute; each part's texts and code are identical). Its partial assembly goes to a scratch file.
usage: python lane.py <set> <part start> [<part start> ...]"""
import os, sys
sys.path.insert(0, os.getcwd())
which, starts = sys.argv[1], [int(x) for x in sys.argv[2:]]
sys.argv = ["extract.py", which]
import extract
real_exists = os.path.exists
real_cpath = extract.cpath
extract.cpath = lambda *p: real_cpath("acts", f"lane_scratch_{os.getpid()}.npz") if p[-1] == f"{which}_pooled.npz" else real_cpath(*p)
for s in starts:
    if real_exists(real_cpath("acts", which, f"part_{s:05d}.npz")):
        continue
    os.path.exists = lambda p, s=s: real_exists(p) if not os.path.basename(p).startswith("part_") else (os.path.basename(p) != f"part_{s:05d}.npz" or real_exists(p))
    extract.main()
    os.path.exists = real_exists
try:
    os.remove(real_cpath("acts", f"lane_scratch_{os.getpid()}.npz"))
except OSError:
    pass
print("lane done", starts, flush=True)
