"""The forward pass and greedy decoding used by the test: exact fp32 maths, one decoder layer in memory at a time.

Why this and not a plain model load (build step 0, results/throughput.json): on this machine (16 GB shared with
many other programs, often about 1 GB free) a whole-model fp32 load pages to disk. Its forward pass fell to a
few tokens per second and greedy decoding to about 40 seconds per step. Here each decoder layer's weights are
read from the safetensors file (bf16, upcast to fp32: lossless), applied to every text in a block, and dropped
before the next layer is read. The numbers are those of model(..., output_hidden_states=True):
states[0] = embeddings, states[i] = output of decoder layer i-1 (i = 1..23), states[24] = final-norm(layer 23).

  states(seqs, layers)   hidden states per text at the requested layers, blocks of texts, checkpoint-friendly
  generate(prompts, ...) greedy decoding in lock-step over a batch with a key/value cache, repetition penalty
                         as in transformers (divide positive logits, multiply negative ones, over every token
                         so far), optional steering: a per-row vector added to the output of one decoder layer
"""
import sys, time
sys.modules.setdefault("sklearn", None)
import numpy as np
import torch
from safetensors import safe_open
from huggingface_hub import hf_hub_download
from transformers import AutoConfig, AutoTokenizer
from transformers.models.qwen2.modeling_qwen2 import Qwen2DecoderLayer, Qwen2RotaryEmbedding, Qwen2RMSNorm

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
REV = "7ae557604adf67be50417f59c2c2f167def9a775"
HEAD_CHUNK = 16384
NEG = torch.finfo(torch.float32).min


class KV:
    """A minimal key/value cache with the update() call Qwen2Attention makes."""
    def __init__(self):
        self.k, self.v = {}, {}

    def update(self, k, v, i, kw=None):
        if i in self.k:
            self.k[i] = torch.cat([self.k[i], k], 2); self.v[i] = torch.cat([self.v[i], v], 2)
        else:
            self.k[i], self.v[i] = k, v
        return self.k[i], self.v[i]


class Engine:
    def __init__(self, threads=4):
        torch.set_num_threads(threads)
        self.cfg = AutoConfig.from_pretrained(MODEL, revision=REV)
        self.cfg._attn_implementation = "sdpa"
        self.tok = AutoTokenizer.from_pretrained(MODEL, revision=REV)
        self.path = hf_hub_download(MODEL, "model.safetensors", revision=REV)
        self.rot = Qwen2RotaryEmbedding(self.cfg)
        self.NL = self.cfg.num_hidden_layers
        self.H = self.cfg.hidden_size

    def _layer(self, f, i):
        with torch.device("meta"):
            layer = Qwen2DecoderLayer(self.cfg, i)
        pre = f"model.layers.{i}."
        sd = {k[len(pre):]: f.get_tensor(k).float() for k in f.keys() if k.startswith(pre)}
        layer.load_state_dict(sd, strict=True, assign=True)
        return layer.eval()

    def _norm(self, f):
        n = Qwen2RMSNorm(self.H, eps=self.cfg.rms_norm_eps)
        n.weight.data = f.get_tensor("model.norm.weight").float()
        return n

    # ---- hidden states -------------------------------------------------------------------------------------
    @torch.no_grad()
    def states(self, seqs, layers, batch=8, block=64, log=None):
        """Yields (i, {layer: float32 [n_i, H]}) for every text, a block of texts at a time (length-sorted)."""
        layers = sorted(set(layers))
        order = sorted(range(len(seqs)), key=lambda i: len(seqs[i]))
        t0, done = time.time(), 0
        for b0 in range(0, len(order), block):
            blk = order[b0:b0 + block]
            chunks = [blk[c:c + batch] for c in range(0, len(blk), batch)]
            rec = {i: {} for i in blk}
            with safe_open(self.path, "pt") as f:
                E = f.get_tensor("model.embed_tokens.weight")
                cache = []
                for ch in chunks:
                    T = max(len(seqs[i]) for i in ch)
                    ids = torch.zeros((len(ch), T), dtype=torch.long); m = torch.zeros((len(ch), T), dtype=torch.long)
                    for j, i in enumerate(ch):
                        ids[j, :len(seqs[i])] = torch.tensor(seqs[i]); m[j, :len(seqs[i])] = 1
                    h = torch.nn.functional.embedding(ids, E).float()
                    pos = torch.arange(T)[None].expand(len(ch), T)
                    cos, sin = self.rot(h, pos)
                    allowed = torch.tril(torch.ones(T, T, dtype=torch.bool))[None, None] & m[:, None, None, :].bool()
                    attn = torch.zeros(allowed.shape).masked_fill(~allowed, NEG)
                    cache.append([h, m, pos, cos, sin, attn, ch])
                del E
                if 0 in layers:
                    for c in cache:
                        for j, i in enumerate(c[6]):
                            rec[i][0] = c[0][j, :len(seqs[i])].numpy().copy()
                top = max(layers)
                for li in range(1, top + 1):
                    layer = self._layer(f, li - 1)
                    norm = self._norm(f) if li == self.NL else None
                    for c in cache:
                        c[0] = layer(c[0], attention_mask=c[5], position_ids=c[2], position_embeddings=(c[3], c[4]))[0]
                        if li in layers:
                            h = norm(c[0]) if norm is not None else c[0]
                            for j, i in enumerate(c[6]):
                                rec[i][li] = h[j, :len(seqs[i])].numpy().copy()
                    del layer
            for i in blk:
                done += len(seqs[i])
                yield i, rec[i]
            if log:
                el = time.time() - t0
                log(f"  {b0 + len(blk)}/{len(seqs)} texts, {done} tokens, {el:.0f}s, {done / max(el, 1e-9):.1f} tok/s")

    # ---- greedy decoding --------------------------------------------------------------------------------------
    @torch.no_grad()
    def generate(self, prompts, max_new, repetition_penalty, end_ids, pad_id, steer=None, log=None):
        """prompts: list of token-id lists. steer: None or (L, tensor [B, H]) added to the output of decoder layer
        L-1 (= hidden_states[L]) at every position. Returns a list of generated id lists (end token excluded)."""
        B = len(prompts); T0 = max(map(len, prompts))
        ids = torch.full((B, T0), pad_id, dtype=torch.long); mask = torch.zeros((B, T0), dtype=torch.long)
        for j, p in enumerate(prompts):
            ids[j, T0 - len(p):] = torch.tensor(p); mask[j, T0 - len(p):] = 1
        pos = (mask.cumsum(1) - 1).clamp(min=0)
        seen = ids.clone()
        kv = KV()
        out = [[] for _ in range(B)]
        done = torch.zeros(B, dtype=torch.bool)
        end = torch.tensor(sorted(end_ids))
        t0 = time.time()
        with safe_open(self.path, "pt") as f:
            E = f.get_tensor("model.embed_tokens.weight")      # bf16, kept for the embedding and the tied head
            norm = self._norm(f)

            def run(x, p, attn, cpos):
                cos, sin = self.rot(x, p)
                for li in range(self.NL):
                    layer = self._layer(f, li)
                    x = layer(x, attention_mask=attn, position_ids=p, past_key_value=kv, use_cache=True,
                              cache_position=cpos, position_embeddings=(cos, sin))[0]
                    del layer
                    if steer is not None and li == steer[0] - 1:
                        x = x + steer[1][:, None, :]
                return x

            def next_token(x_last):
                h = norm(x_last)
                logits = torch.cat([h @ E[i:i + HEAD_CHUNK].float().T for i in range(0, E.shape[0], HEAD_CHUNK)], -1)
                sc = torch.gather(logits, 1, seen)
                sc = torch.where(sc < 0, sc * repetition_penalty, sc / repetition_penalty)
                logits.scatter_(1, seen, sc)
                return logits.argmax(-1)

            # prefill (left padding: a pad position attends only to itself, so nothing is fully masked)
            keym = mask.bool()
            allowed = torch.tril(torch.ones(T0, T0, dtype=torch.bool))[None, None] & keym[:, None, None, :]
            allowed |= torch.eye(T0, dtype=torch.bool)[None, None] & ~keym[:, None, :, None]
            attn = torch.zeros(allowed.shape).masked_fill(~allowed, NEG)
            x = run(torch.nn.functional.embedding(ids, E).float(), pos, attn, torch.arange(T0))
            nt = next_token(x[:, -1])
            for step in range(max_new):
                nt = torch.where(done, torch.full_like(nt, pad_id), nt)
                for j in range(B):
                    if not done[j]:
                        if nt[j].item() in end_ids:
                            done[j] = True
                        else:
                            out[j].append(int(nt[j]))
                if bool(done.all()) or step == max_new - 1:
                    break
                seen = torch.cat([seen, nt[:, None]], 1)
                mask = torch.cat([mask, torch.ones((B, 1), dtype=torch.long)], 1)
                cur = pos[:, -1:] + 1
                pos = torch.cat([pos, cur], 1)
                attn = torch.zeros((B, 1, 1, mask.shape[1])).masked_fill(~mask.bool()[:, None, None, :], NEG)
                x = run(torch.nn.functional.embedding(nt[:, None], E).float(), cur, attn,
                        torch.tensor([mask.shape[1] - 1]))
                nt = next_token(x[:, -1])
                if log and step % 8 == 0:
                    log(f"  step {step + 1}/{max_new}  {time.time() - t0:.0f}s")
        return out
