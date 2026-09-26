"""Writes directions.npz exactly as evaluate.py's run_test() does (same functions, same inputs), so trace.py and
the steering check can run while the test evaluation is still computing its nulls. The file evaluate.py writes at
its end is compared with this one afterwards."""
import os, sys
sys.path.insert(0, os.getcwd())
import numpy as np
import evaluate
from concepts import CONTROL_LAYER
from common import cpath, rpath, jload
L = jload(rpath("layer.json"))["layer"]
labels, topics = evaluate.story_meta()
pooled, toks = evaluate.load_story_acts([CONTROL_LAYER, L])
D, mu, V, k, var = evaluate.directions_at(pooled[:, 1], toks[L], labels)
np.savez(cpath("directions.npz"), mu=mu, layer=L, **{f"d_{t}": D[t] for t in list(D)})
np.savez(cpath("directions_early_copy.npz"), mu=mu, layer=L, **{f"d_{t}": D[t] for t in list(D)})
print("wrote directions.npz at layer", L, "PCs", k, round(var, 3))
