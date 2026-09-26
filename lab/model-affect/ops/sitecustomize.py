# Execution note (not part of the method): on a machine whose 4 CPUs are shared with other heavy jobs, a 4-thread
# torch/BLAS pool stalls at every parallel barrier. With FORCE_THREADS=n, torch.set_num_threads() is pinned to n.
import os
n = os.environ.get("FORCE_THREADS")
if n:
    try:
        import torch
        _set = torch.set_num_threads
        torch.set_num_threads = lambda k: _set(int(n))
        _set(int(n))
    except Exception:
        pass
