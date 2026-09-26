"""Low-RAM loading with exact fp32 maths.

The Qwen2.5-0.5B-Instruct checkpoint is stored in bf16. Upcasting bf16 to fp32 is lossless, so keeping the
bf16 weights and upcasting each one at the moment it is used gives the same numbers as an fp32 load, in about
half the memory. On this machine (16 GB shared with many other programs, often about 1 GB free) a plain fp32
load pages to disk and runs about 20 times slower; this does not.

Every matmul, norm and attention runs in fp32. The language-model head (used only to pick the next token) is
also computed in fp32, in vocabulary chunks, so greedy decoding sees exactly the fp32 logits."""
import sys
sys.modules.setdefault("sklearn", None)
import torch
import torch.nn.functional as F

HEAD_CHUNK = 16384


class UpLinear(torch.nn.Module):
    def __init__(self, w, b=None):
        super().__init__()
        self.register_buffer("w", w.detach(), persistent=False)
        self.register_buffer("b", None if b is None else b.detach().float(), persistent=False)

    def forward(self, x):
        return F.linear(x, self.w.float(), self.b)


class UpEmbed(torch.nn.Module):
    def __init__(self, w):
        super().__init__()
        self.register_buffer("w", w.detach(), persistent=False)

    def forward(self, ids):
        return F.embedding(ids, self.w).float()


class ChunkedHead(torch.nn.Module):
    """fp32 logits from the tied bf16 embedding, upcast one vocabulary chunk at a time."""
    def __init__(self, w):
        super().__init__()
        self.register_buffer("w", w.detach(), persistent=False)

    def forward(self, x):
        return torch.cat([F.linear(x, self.w[i:i + HEAD_CHUNK].float()) for i in range(0, self.w.shape[0], HEAD_CHUNK)], -1)


def _swap(mod):
    for name, ch in list(mod.named_children()):
        if isinstance(ch, torch.nn.Linear):
            setattr(mod, name, UpLinear(ch.weight, ch.bias))
        else:
            _swap(ch)


def make_lean(base, emb):
    """base: a Qwen2Model loaded in bf16. Linear layers keep bf16 weights and compute in fp32; norms and rotary
    buffers become fp32 (tiny)."""
    _swap(base)
    base.embed_tokens = UpEmbed(emb)
    for m in base.modules():
        if isinstance(m, (UpLinear, UpEmbed)):
            continue
        for pn, p in list(m.named_parameters(recurse=False)):
            p.data = p.data.float()
        for bn, b in list(m.named_buffers(recurse=False)):
            if b is not None and b.is_floating_point():
                m._buffers[bn] = b.float()
    return base


def load_causal(model, revision):
    from transformers import AutoModelForCausalLM
    lm = AutoModelForCausalLM.from_pretrained(model, revision=revision, torch_dtype=torch.bfloat16).eval()
    emb = lm.model.embed_tokens.weight.detach()
    make_lean(lm.model, emb)
    lm.lm_head = ChunkedHead(emb)
    lm.config.torch_dtype = torch.float32
    return lm


def load_base(model, revision):
    from transformers import AutoModel
    m = AutoModel.from_pretrained(model, revision=revision, torch_dtype=torch.bfloat16).eval()
    make_lean(m, m.embed_tokens.weight.detach())
    m.config.torch_dtype = torch.float32
    return m
