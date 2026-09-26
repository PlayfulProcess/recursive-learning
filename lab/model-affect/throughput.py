"""Build step 0: time stream.py (one layer at a time) against a whole-model fp32 forward pass (fullpass.py)
on about 2,000 tokens in batches of 8, and check the two give the same states on 3 texts.
Writes results/throughput.json. Run before the freeze; the chosen path is recorded in PREREGISTRATION.md."""
import os, sys, json, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TEXT = ("On Tuesday morning the bus was late again, so Mara walked the long way past the bakery and the "
        "closed cinema, counting the lamp posts and thinking about the list of things she still had to "
        "buy for the weekend. The river was high after the rain, and a man on the bridge was feeding "
        "bread to a line of ducks that did not seem hungry. ")
words = (TEXT * 4).split()


def texts(n):
    out = []
    for k in range(n):
        w = words[k % 7:]
        out.append(" ".join(w[: 60 + (k * 13) % 50]))
    return out


def main():
    from fullpass import FullPass
    from stream import Streamer
    T = texts(24)
    res = {}
    t0 = time.time(); fp = FullPass(threads=4); res["fullpass_load_s"] = round(time.time() - t0, 1)
    seqs = [fp.tok(t)["input_ids"] for t in T]
    ntok = sum(map(len, seqs)); res["tokens"] = ntok
    layers = list(range(fp.NL + 1))
    t0 = time.time(); F = {}
    for i, st in fp.states(seqs, layers, batch=8):
        F[i] = st
    dt = time.time() - t0
    res["fullpass_s"] = round(dt, 1); res["fullpass_tok_s"] = round(ntok / dt, 1)
    del fp
    import gc; gc.collect()
    t0 = time.time(); sm = Streamer(threads=4); res["stream_load_s"] = round(time.time() - t0, 1)
    t0 = time.time()
    _, _, toks = sm.run(seqs, keep_tokens=[0, 11, 23], chunk=8, log=lambda s: None)
    dt = time.time() - t0
    res["stream_s"] = round(dt, 1); res["stream_tok_s"] = round(ntok / dt, 1)
    diffs = []
    for i in [0, 11, 23]:
        for L in layers:
            a, b = F[i][L][1:], toks[i][1:, L]
            diffs.append({"text": i, "layer": L, "max_abs": float(np.abs(a - b).max()),
                          "max_rel": float((np.abs(a - b) / (np.abs(b) + 1.0)).max())})
    res["agree_max_abs"] = max(d["max_abs"] for d in diffs)
    res["agree_max_rel_(|a-b|/(|b|+1))"] = max(d["max_rel"] for d in diffs)
    res["faster"] = "fullpass" if res["fullpass_s"] < res["stream_s"] else "stream"
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    json.dump(res, open(os.path.join(HERE, "results", "throughput.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


def lean_check():
    """Second check (Sep 25, after a plain fp32 load paged to disk under memory pressure): the lean load
    (lean.py) against the layer streamer, which computes in fp32 from the same bf16 weights. Adds to
    results/throughput.json; also times 20 greedy decoding steps with the lean causal model."""
    import torch
    from fullpass import FullPass
    from stream import Streamer
    T = texts(24)
    p = os.path.join(HERE, "results", "throughput.json")
    res = json.load(open(p)) if os.path.exists(p) else {}
    t0 = time.time(); fp = FullPass(threads=4, lean=True); res["lean_load_s"] = round(time.time() - t0, 1)
    seqs = [fp.tok(t)["input_ids"] for t in T]
    ntok = sum(map(len, seqs))
    layers = list(range(fp.NL + 1))
    t0 = time.time(); F = {i: st for i, st in fp.states(seqs, layers, batch=8)}
    dt = time.time() - t0
    res["lean_s"] = round(dt, 1); res["lean_tok_s"] = round(ntok / dt, 1)
    del fp
    import gc; gc.collect()
    sm = Streamer(threads=4)
    _, _, toks = sm.run([seqs[i] for i in [0, 11, 23]], keep_tokens=[0, 1, 2], chunk=8, log=lambda s: None)
    d = [float(np.abs(F[i][L][1:] - toks[j][1:, L]).max()) for j, i in enumerate([0, 11, 23]) for L in layers]
    res["lean_vs_stream_max_abs"] = max(d)
    del sm; gc.collect()
    from generate import load, chat_ids
    tok, model, gc_, END = load()
    ids = torch.tensor([chat_ids(tok, "Say something about rivers.")])
    gc_.max_new_tokens = 20
    t0 = time.time()
    with torch.no_grad():
        g = model.generate(input_ids=ids, attention_mask=torch.ones_like(ids), generation_config=gc_)
    res["lean_generate_s_per_step"] = round((time.time() - t0) / max(g.shape[1] - ids.shape[1], 1), 2)
    res["path_used"] = "fullpass.py with lean.py (bf16-stored weights, fp32 maths)"
    json.dump(res, open(p, "w"), indent=1)
    print(json.dumps(res, indent=1))


def engine_check():
    """Third check (Sep 25): engine.py (one decoder layer in memory at a time, the path used) against the
    streamer on 3 texts, its throughput, and its greedy decoding against transformers' generate (6 steps)."""
    import torch
    p = os.path.join(HERE, "results", "throughput.json")
    from engine import Engine
    from stream import Streamer
    res = json.load(open(p))
    T = texts(24)
    eng = Engine(threads=4)
    seqs = [eng.tok(t)["input_ids"] for t in T]
    ntok = sum(map(len, seqs)); layers = list(range(25))
    t0 = time.time(); F = {i: st for i, st in eng.states(seqs, layers, batch=8, block=24)}
    dt = time.time() - t0
    res["engine_s"] = round(dt, 1); res["engine_tok_s"] = round(ntok / dt, 1)
    sm = Streamer(threads=4)
    _, _, toks = sm.run([seqs[i] for i in [0, 11, 23]], keep_tokens=[0, 1, 2], chunk=8, log=lambda s: None)
    res["engine_vs_stream_max_abs"] = max(float(np.abs(F[i][L][1:] - toks[j][1:, L]).max()) for j, i in enumerate([0, 11, 23]) for L in layers)
    print(json.dumps(res, indent=1), flush=True)
    from generate import chat_ids
    ids = chat_ids(eng.tok, "Say something about rivers.")
    end = {eng.tok.eos_token_id, eng.tok.convert_tokens_to_ids("<|im_end|>")}
    t0 = time.time(); mine = eng.generate([ids, chat_ids(eng.tok, "Name a colour.")], 6, 1.1, end, eng.tok.pad_token_id)
    res["engine_generate_s_per_step_batch2"] = round((time.time() - t0) / 6, 2)
    from lean import load_causal
    from transformers import GenerationConfig
    lm = load_causal("Qwen/Qwen2.5-0.5B-Instruct", "7ae557604adf67be50417f59c2c2f167def9a775")
    gc = GenerationConfig(do_sample=False, repetition_penalty=1.1, max_new_tokens=6, temperature=None, top_p=None, top_k=None,
                          pad_token_id=eng.tok.pad_token_id, eos_token_id=list(end))
    with torch.no_grad():
        g = lm.generate(input_ids=torch.tensor([ids]), attention_mask=torch.ones(1, len(ids), dtype=torch.long), generation_config=gc)
    hf = [t for t in g[0, len(ids):].tolist() if t not in end]
    res["engine_generate_matches_transformers"] = mine[0][:len(hf)] == hf
    res["engine_generate_tokens"] = [mine[0], hf]
    res["path_used"] = "engine.py (one decoder layer in memory at a time; fp32 maths)"
    json.dump(res, open(p, "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    {"lean": lean_check, "engine": engine_check}.get(sys.argv[1] if sys.argv[1:] else "", main)()
