"""Greedy replies to the 7 scenarios and the 8 baseline questions, and the small causal check (steering).

  python generate.py replies   -> results/replies.json
  python generate.py steer     -> results/steering.json   (needs results/traces.json for the baseline SD)

Decoding is greedy and set explicitly (engine.generate: argmax, repetition_penalty=1.1, max_new_tokens=96, no
temperature/top_p/top_k), so the model's shipped sampling defaults cannot leak in. The chat template's
default system prompt is used. Steering adds +/- alpha x SD x (unit valence direction) to the output of
decoder layer L-1, i.e. to hidden_states[L], at every position, where L is the layer chosen on dev; the 10
steering runs (2 of them plain) go through as one batch, one vector per row."""
import sys, time
sys.modules.setdefault("sklearn", None)
import numpy as np
import torch
from concepts import MODEL, REVISION, SCENARIOS, BASELINE_QUESTIONS, GEN, STEER_ALPHAS, STEER_SCENARIOS
from common import rpath, cpath, jload, jsave


def load():
    from engine import Engine
    eng = Engine(threads=4)
    tok = eng.tok
    end = {tok.eos_token_id, tok.convert_tokens_to_ids("<|im_end|>")}
    return tok, eng, end


def chat_ids(tok, prompt):
    return tok.apply_chat_template([{"role": "user", "content": prompt}], tokenize=True, add_generation_prompt=True)


def generate(tok, eng, end, prompts, steer=None):
    ids = [chat_ids(tok, p) for p in prompts]
    t0 = time.time()
    outs = eng.generate(ids, GEN["max_new_tokens"], GEN["repetition_penalty"], end, tok.pad_token_id, steer=steer,
                        log=lambda s: print(s, flush=True))
    print(f"  {len(prompts)} replies in {time.time() - t0:.0f}s", flush=True)
    return [{"prompt_ids": x, "reply_ids": o, "reply": tok.decode(o)} for x, o in zip(ids, outs)]


def replies():
    tok, eng, end = load()
    items = [(s["id"], s["prompt"]) for s in SCENARIOS] + [(f"base{i + 1}", q) for i, q in enumerate(BASELINE_QUESTIONS)]
    res = generate(tok, eng, end, [p for _, p in items])
    out = {"generation": {**GEN, "temperature": None, "top_p": None, "top_k": None, "system_prompt": "template default"},
           "runs": {k: {"prompt": p, **r} for (k, p), r in zip(items, res)}}
    jsave(out, rpath("replies.json"))
    for k, _ in items:
        print(f"[{k}] {out['runs'][k]['reply']!r}", flush=True)


def steer():
    tok, eng, end = load()
    Dz = np.load(cpath("directions.npz"))
    L = int(Dz["layer"])
    d = torch.tensor(Dz["d_valence"], dtype=torch.float32)
    sd = jload(rpath("traces.json"))["baseline"]["raw_sd"]["reply"]["valence"]
    prompts = {s["id"]: s["prompt"] for s in SCENARIOS}
    runs = []
    for sid in STEER_SCENARIOS:
        runs.append((sid, 0, 0))
        for a in STEER_ALPHAS:
            for sign in (+1, -1):
                runs.append((sid, sign, a))
    vec = torch.stack([(sign * a * sd) * d for _, sign, a in runs])      # one row per run; zero for the plain ones
    res = generate(tok, eng, end, [prompts[sid] for sid, _, _ in runs], steer=(L, vec))
    out = {"layer": L, "baseline_sd": sd, "alphas": STEER_ALPHAS, "runs": []}
    for (sid, sign, a), r in zip(runs, res):
        out["runs"].append({"scenario": sid, "sign": sign, "alpha": a,
                            "direction": "none" if a == 0 else ("toward pleasant" if sign > 0 else "toward unpleasant"),
                            "reply": r["reply"]})
        print(f"[{sid} {sign:+d}x{a}] {r['reply']!r}", flush=True)
    jsave(out, rpath("steering.json"))


if __name__ == "__main__":
    {"replies": replies, "steer": steer}[sys.argv[1]]()
