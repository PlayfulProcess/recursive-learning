"""Whole-model fp32 forward pass for Qwen2.5-0.5B-Instruct, returning hidden states at chosen layers.

The alternative to stream.py (which loads one decoder layer at a time to survive paging on a 2-core
laptop). Same maths: hidden_states[0] = embeddings, hidden_states[i] = output of decoder layer i-1,
hidden_states[24] = final-norm(output of layer 23). Build step 0 (throughput.py) times both and checks
they agree to 1e-4; the faster one is recorded in PREREGISTRATION.md. Default: the lean load (lean.py).
"""
import sys, time
sys.modules.setdefault("sklearn", None)
import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
REV = "7ae557604adf67be50417f59c2c2f167def9a775"


class FullPass:
    def __init__(self, threads=4, lean=True):
        """lean=True (the path used): bf16-stored weights upcast to fp32 at each use (lean.py), same numbers as
        an fp32 load in about half the memory. lean=False: a plain fp32 load."""
        torch.set_num_threads(threads)
        self.tok = AutoTokenizer.from_pretrained(MODEL, revision=REV)
        if lean:
            from lean import load_base
            self.model = load_base(MODEL, REV)
        else:
            self.model = AutoModel.from_pretrained(MODEL, revision=REV, torch_dtype=torch.float32,
                                                   attn_implementation="sdpa").eval()
        self.NL = self.model.config.num_hidden_layers
        self.H = self.model.config.hidden_size

    @torch.no_grad()
    def states(self, seqs, layers, batch=8, log=None):
        """seqs: list of token-id lists (right-padded inside). Yields (i, {layer: float32 [n_i, H]})
        in input order of each batch; batches are formed from length-sorted texts to save padding."""
        order = sorted(range(len(seqs)), key=lambda i: len(seqs[i]))
        t0, done = time.time(), 0
        for b in range(0, len(order), batch):
            ch = order[b:b + batch]
            T = max(len(seqs[i]) for i in ch)
            ids = torch.zeros((len(ch), T), dtype=torch.long)
            m = torch.zeros((len(ch), T), dtype=torch.long)
            for j, i in enumerate(ch):
                ids[j, :len(seqs[i])] = torch.tensor(seqs[i]); m[j, :len(seqs[i])] = 1
            out = self.model(input_ids=ids, attention_mask=m, output_hidden_states=True)
            hs = out.hidden_states
            for j, i in enumerate(ch):
                n = len(seqs[i])
                yield i, {L: hs[L][j, :n].float().numpy() for L in layers}
            done += int(m.sum())
            if log:
                el = time.time() - t0
                log(f"  {b + len(ch)}/{len(seqs)} texts, {done} tokens, {el:.0f}s, {done / max(el, 1e-9):.1f} tok/s")
