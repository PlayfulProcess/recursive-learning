"""Run every fetcher, then build the summary. Python standard library only.

    python3 state-of-ai/scripts/run_all.py            # all sources
    python3 state-of-ai/scripts/run_all.py epoch_eci  # just some

A fetcher that fails keeps its previous data file and is listed at the end; the others still
run. Exit status: 0 when the summary was built (even if some sources failed, which the report
names), 1 when nothing could be built. The report is printed and, inside GitHub Actions, also
written to the job summary and to $STATE_OF_AI_REPORT for the pull request body.
"""

import importlib
import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

FETCHERS = [
    "epoch_training_compute", "epoch_training_cost", "epoch_eci", "epoch_benchmarks_internal",
    "epoch_ml_hardware", "epoch_chip_sales", "epoch_chip_owners", "epoch_ai_companies",
    "metr_time_horizon", "arena_leaderboard",
]


def main(argv):
    wanted = argv or FETCHERS
    results = []
    for mid in wanted:
        t = time.time()
        try:
            mod = importlib.import_module(f"fetch_{mid}")
            status = mod.run()
            results.append((mid, status, f"{time.time() - t:.0f}s", ""))
        except Exception as e:  # keep going; the old file stays
            results.append((mid, "FAILED", f"{time.time() - t:.0f}s", f"{type(e).__name__}: {e}"))
            traceback.print_exc()
    built = True
    try:
        importlib.import_module("build_summary").main()
    except SystemExit as e:
        built = e.code in (0, None)
    except Exception:
        traceback.print_exc()
        built = False

    lines = ["| source | result | time | note |", "|---|---|---|---|"]
    lines += [f"| `{m}` | {s} | {t} | {n.replace('|', '/')[:300]} |" for m, s, t, n in results]
    lines.append("")
    lines.append("Summary rebuilt." if built else "**Summary NOT rebuilt.**")
    failed = [m for m, s, _, _ in results if s == "FAILED"]
    if failed:
        lines.append(f"Failed, previous data kept: {', '.join(failed)}.")
    report = "\n".join(lines)
    print(report)
    for var in ("GITHUB_STEP_SUMMARY", "STATE_OF_AI_REPORT"):
        path = os.environ.get(var)
        if path:
            with open(path, "a", encoding="utf-8") as f:
                f.write("### State of AI refresh\n\n" + report + "\n")
    return 0 if built else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
