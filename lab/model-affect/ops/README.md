# Execution helpers (not part of the method)

Used on Sep 25 2026 because the machine's 4 CPUs and 16 GB were shared with other heavy jobs. None of them
changes what is computed; `results.md` ("Deviations and execution notes") says when each was used.

- `lane.py <set> <part starts...>`: runs `extract.main()` unchanged for chosen part files only, so several
  processes can share the test-set extraction. `laneB_test.py` is its first version (top parts first).
- `sitecustomize.py`: put this folder on `PYTHONPATH` with `FORCE_THREADS=1` to pin torch's thread pool to
  one thread (with 4 threads, every parallel barrier stalled while other jobs held the CPUs).
- `early_directions.py`: writes `directions.npz` exactly as `evaluate.py test` does, so `trace.py` and the
  steering check could run while the nulls were computing. The file `evaluate.py` wrote later was identical.

Run them from `lab/model-affect/` (they import the frozen scripts from the working directory).
