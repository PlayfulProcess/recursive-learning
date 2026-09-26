"""Layer-streaming forward pass for Qwen2.5-0.5B-Instruct: exact fp32 hidden states in ~300 MB of RAM.

Why: on this shared 2-core laptop the whole model (1-2 GB) got paged out and throughput fell below
1 token/s. Here only ONE decoder layer's weights are in memory at a time (read from the
safetensors file, bf16 -> fp32, lossless), and all texts pass through that layer before the next
one loads. Same maths as model(..., output_hidden_states=True), mirrored exactly:
states[0] = embeddings, states[i] = output of layer i-1, states[24] = final-norm(output of layer 23).

Reading the state at each token of prompt+reply in one pass gives the same numbers the model
computes at those tokens while it generates (causal attention: a token never sees later ones).
"""
import sys, time
sys.modules.setdefault("sklearn", None)  # a parallel job may be mid-install; transformers does not need it here
import numpy as np
import torch
from safetensors import safe_open
from huggingface_hub import hf_hub_download
from transformers import AutoConfig, AutoTokenizer
from transformers.models.qwen2.modeling_qwen2 import Qwen2DecoderLayer, Qwen2RotaryEmbedding, Qwen2RMSNorm

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
REV = "7ae557604adf67be50417f59c2c2f167def9a775"


class Streamer:
    def __init__(self, threads=2):
        torch.set_num_threads(threads)
        self.cfg = AutoConfig.from_pretrained(MODEL, revision=REV)
        self.cfg._attn_implementation = "sdpa"
        self.tok = AutoTokenizer.from_pretrained(MODEL, revision=REV)
        self.path = hf_hub_download(MODEL, "model.safetensors", revision=REV)
        self.rot = Qwen2RotaryEmbedding(self.cfg)
        self.NL = self.cfg.num_hidden_layers

    def _layer(self, f, i):
        layer = Qwen2DecoderLayer(self.cfg, i)
        pre = f"model.layers.{i}."
        sd = {k[len(pre):]: f.get_tensor(k).float() for k in f.keys() if k.startswith(pre)}
        layer.load_state_dict(sd, strict=True)
        return layer.eval()

    @torch.no_grad()
    def run(self, seqs, keep_tokens=None, chunk=32, log=print):
        """seqs: list of token-id lists. Returns mean (tokens 1..n-1), last: [N, NL+1, H] float16, and
        tokens: {i: [n_i, NL+1, H] float32} for i in keep_tokens."""
        keep_tokens = set(keep_tokens or [])
        N, H, L1 = len(seqs), self.cfg.hidden_size, self.NL + 1
        order = sorted(range(N), key=lambda i: len(seqs[i]))
        chunks = [order[b:b + chunk] for b in range(0, N, chunk)]
        mean = np.zeros((N, L1, H), np.float16)
        last = np.zeros((N, L1, H), np.float16)
        toks = {i: np.zeros((len(seqs[i]), L1, H), np.float32) for i in keep_tokens}
        cache = []  # per chunk: (hidden [B,T,H], mask [B,T], pos, cos, sin, attn4d)
        with safe_open(self.path, "pt") as f:
            E = f.get_tensor("model.embed_tokens.weight")  # bf16, 272 MB, only while embedding
            for ch in chunks:
                T = max(len(seqs[i]) for i in ch)
                ids = torch.zeros((len(ch), T), dtype=torch.long)
                m = torch.zeros((len(ch), T), dtype=torch.long)
                for j, i in enumerate(ch):
                    ids[j, :len(seqs[i])] = torch.tensor(seqs[i]); m[j, :len(seqs[i])] = 1
                h = torch.nn.functional.embedding(ids, E).float()
                pos = torch.arange(T)[None].expand(len(ch), T)
                cos, sin = self.rot(h, pos)
                causal = torch.tril(torch.ones(T, T, dtype=torch.bool))
                allowed = causal[None, None] & m[:, None, None, :].bool()
                attn = torch.zeros(allowed.shape, dtype=torch.float32).masked_fill(~allowed, torch.finfo(torch.float32).min)
                cache.append([h, m, pos, cos, sin, attn])
            del E
            ntok = sum(len(s) for s in seqs)
            t0 = time.time()
            for li in range(L1):
                if li > 0:
                    layer = self._layer(f, li - 1)
                    for c in cache:
                        c[0] = layer(c[0], attention_mask=c[5], position_ids=c[2], position_embeddings=(c[3], c[4]))[0]
                    del layer
                    if li == L1 - 1:  # HF's last hidden state is after the final norm
                        norm = Qwen2RMSNorm(H, eps=self.cfg.rms_norm_eps)
                        norm.weight.data = f.get_tensor("model.norm.weight").float()
                for ci, (ch, c) in enumerate(zip(chunks, cache)):
                    h, m = c[0], c[1]
                    if li == L1 - 1:
                        h = norm(h)
                    # Mean over tokens 1..n-1: position 0 is an "attention sink" whose state has a
                    # massive activation (dim 62 ~1700 vs typical |v|<5 at layers 4-20). Averaging it in
                    # makes the pooled vector a function of text length. 1-token texts keep position 0.
                    mf = m[:, :, None].float().clone()
                    multi = m.sum(1) > 1
                    mf[multi, 0] = 0
                    mp = (h * mf).sum(1) / mf.sum(1)
                    lp = h[torch.arange(len(ch)), m.sum(1) - 1]
                    for j, i in enumerate(ch):
                        mean[i, li] = mp[j].numpy(); last[i, li] = lp[j].numpy()
                        if i in keep_tokens:
                            toks[i][:, li] = h[j, :len(seqs[i])].numpy()
                el = time.time() - t0
                if li > 0:
                    log(f"  layer {li:2d}/{self.NL}  {el:6.0f}s  ~{ntok*li/el:.1f} tok-layers/s ({ntok*li/el/self.NL:.1f} tok/s full-model equiv)")
        return mean, last, toks
