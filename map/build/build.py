#!/usr/bin/env python3
"""Build the data behind learning.recursive.eco/map/ ("The map that lights up").

    python map/build/build.py --episodes pilot     (default; ids in map/build/pilot.txt)
    python map/build/build.py --episodes all       (every episode in the manifest that has captions)

Private inputs (the caption files, the manifest, the draft terms, the who's-who) are read from
flags, from environment variables, or from the gitignored map/build/local.json. This script
never writes transcript text into map/: passage text lives only in the private work dir
(default: <system temp>/map-work), which is deleted at the end unless --keep-work is given.

What gets shipped (map/data/): positions, times, tags, int8 vectors, neighbours, a capped set
of short labelled snippets, and up to five key words per passage (an index of terms, not a quote). check.py then fails the build on any breach of the snippet rules.

Steps: chunk -> embed -> tag -> project -> cluster -> nodes -> nn -> questions -> snippets
       -> key words -> export -> (check.py) -> cleanup
"""
import argparse, gzip, html, json, math, os, re, shutil, subprocess, sys, tempfile, time
from collections import Counter, defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.dirname(HERE)
DATA = os.path.join(MAP, 'data')
MODEL_DIR = os.path.join(MAP, 'model', 'Xenova', 'all-MiniLM-L6-v2')

CHUNKER_VERSION = 'c3'            # bump when chunk text or boundaries change: invalidates the embedding cache
                                  # c3 (Sep 25): speaker labels removed, speaker turns kept for cutting quotes
PY_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
WEB_MODEL = 'Xenova/all-MiniLM-L6-v2'
WEB_MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']
MIN_W, TARGET_W, MAX_W, MAX_S = 55, 70, 90, 36.0
NYT_SHOWS = {'pod_ezra', 'pod_ezra_klein'}          # The Ezra Klein Show is a New York Times show
SHOW_ALIAS = {'pod_making_sense': 'pod_ms', 'pod_ezra_klein': 'pod_ezra'}
SNIP_CAP, SNIP_CAP_NYT = 20, 15
PALETTE_SLOTS = 6                 # categorical slots the page has colours for (see map.css)
# Names for the draft terms' lanes, written from what each lane holds in terms.json (the page lists every
# idea in each lane): 'scaling' holds compute, chips and China as well as scaling laws, 'rsi' holds AGI.
LANE_LABELS = {
    'safety': 'Safety and risk', 'scaling': 'Compute, chips and scaling', 'rsi': 'AGI and self-improvement',
    'neuro': 'Generalization and mind', 'rl': 'Agents and reasoning', 'neurosym': 'Neuro-symbolic',
    'world': 'World models', 'openended': 'Open-endedness', 'multi': 'Many agents',
}


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- config
def load_config(args):
    cfg = {}
    lp = os.path.join(HERE, 'local.json')
    if os.path.exists(lp):
        cfg.update(json.load(open(lp, encoding='utf-8')))
    env = {'manifest': 'MAP_MANIFEST', 'terms': 'MAP_TERMS', 'whoswho': 'MAP_WHOSWHO', 'episodes': 'MAP_EPISODES'}
    for k, e in env.items():
        if os.environ.get(e):
            cfg[k] = os.environ[e]
    if os.environ.get('MAP_CUES_DIRS'):
        cfg['cues_dirs'] = os.environ['MAP_CUES_DIRS'].split(os.pathsep)
    for k in ('manifest', 'terms', 'whoswho', 'episodes'):
        if getattr(args, k):
            cfg[k] = getattr(args, k)
    if args.cues_dir:
        cfg['cues_dirs'] = args.cues_dir
    miss = [k for k in ('manifest', 'terms', 'whoswho') if not cfg.get(k)]
    if miss:
        sys.exit(f'missing inputs {miss}: pass flags, env vars, or write map/build/local.json (see README)')
    return cfg


def fix_mojibake(s):
    if not s or not re.search('[Â-ô][\u0080-™]', s):
        return s
    try:
        return s.encode('cp1252').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


# ---------------------------------------------------------------- 1. chunk
TAG_RE = re.compile(r'\[[^\]]{1,40}\]|\([A-Za-z ]{3,20}\)')     # [Music], [Applause], (laughter)
SENT_END = re.compile('[.?!]["\')\\]”]?$')
TURN = '␞'                   # stands for a change of speaker while cleaning; never shipped
# "Rob Wiblin: ..." at the start of a cue or after a sentence end (80,000 Hours style speaker labels)
LABEL_RE = re.compile('(?:^|(?<=[.?!…"”)]\\s))([A-Z][a-z]+(?: [A-Z][a-z\'’-]+){1,2}):\\s')


def speaker_labels(cues):
    """Names used as speaker labels in this caption file (seen at least 3 times)."""
    c = Counter()
    for x in cues:
        for m in LABEL_RE.finditer(html.unescape(x.get('text') or '')):
            c[m.group(1)] += 1
    return {k for k, n in c.items() if n >= 3}


def clean(t, labels=()):
    """Caption text -> words, with TURN where the captions mark a new speaker:
    '>>' (automatic captions), a leading '- ' (some creator captions), or a known speaker label (removed)."""
    t = html.unescape(t or '').replace(chr(10), ' ')
    t = TAG_RE.sub(' ', t)
    t = t.replace('>>', f' {TURN} ')
    t = re.sub(r'^\s*-\s+', f'{TURN} ', t)
    t = re.sub(r'(^|\s)-\s+', lambda m: m.group(1), t)            # other stray dashes
    if labels:
        t = LABEL_RE.sub(lambda m: f' {TURN} ' if m.group(1) in labels else m.group(0), t)
    return re.sub(r'\s+', ' ', t).strip()


def prep_cues(cues, labels):
    """-> [{start, end, words, turns}] ; turns = indexes (in words) where a new speaker starts."""
    out, pending = [], False
    for c in cues:
        words, turns = [], []
        for tok in clean(c.get('text'), labels).split():
            if tok == TURN:
                pending = True
                continue
            if pending:
                turns.append(len(words))
                pending = False
            words.append(tok)
        if words:
            out.append({'start': float(c['start']), 'end': float(c['end']), 'words': words, 'turns': turns})
    return out


def chunk(cues):
    """prepped cues -> [{t0, t1, text, words, marks:[[word_index, cue_start]], turns:[word_index]}] ;
    aim 70 words, stop at 90, prefer a full stop."""
    groups, cur, wc = [], [], 0
    for c in cues:
        n = len(c['words'])
        if cur and wc + n > MAX_W and wc >= MIN_W:
            groups.append(cur)
            cur, wc = [], 0
        cur.append(c)
        wc += n
        dur = cur[-1]['end'] - cur[0]['start']
        if (wc >= TARGET_W and SENT_END.search(c['words'][-1])) or wc >= MAX_W or (dur >= MAX_S and wc >= MIN_W):
            groups.append(cur)
            cur, wc = [], 0
    if cur:
        if groups and wc < MIN_W // 2:        # merge a short tail into the previous passage
            groups[-1] += cur
        else:
            groups.append(cur)
    out = []
    for g in groups:
        words, marks, turns = [], [], []
        for c in g:
            marks.append([len(words), round(c['start'], 1)])
            turns += [len(words) + k for k in c['turns']]
            words += c['words']
        out.append({'t0': round(g[0]['start'], 1), 't1': round(g[-1]['end'], 1), 'text': ' '.join(words),
                    'words': len(words), 'marks': marks, 'turns': [k for k in turns if k > 0]})
    return out


def find_cues(vid, cfg, man_row):
    for d in cfg.get('cues_dirs') or []:
        p = os.path.join(d, vid + '.json')
        if os.path.exists(p):
            return p
    p = man_row.get('cues')
    return p if p and os.path.exists(p) else None


# ---------------------------------------------------------------- 2. embed
def load_py_model(work, keep_model):
    import torch
    from transformers import AutoTokenizer, AutoModel
    torch.set_num_threads(os.cpu_count() or 4)
    base = os.path.join(tempfile.gettempdir(), 'map-model-py') if keep_model else os.path.join(work, 'model-py')
    if not os.path.exists(os.path.join(base, 'model.safetensors')):
        from huggingface_hub import snapshot_download
        log(f'  downloading {PY_MODEL} (~88 MB) into the work dir')
        snapshot_download(PY_MODEL, local_dir=base, allow_patterns=[
            'config.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.txt', 'special_tokens_map.json',
            'model.safetensors'])
    tok = AutoTokenizer.from_pretrained(base)
    mod = AutoModel.from_pretrained(base).eval()
    return tok, mod


def embed_texts(texts, tok, mod, bs=32):
    import torch
    out = []
    with torch.inference_mode():
        for i in range(0, len(texts), bs):
            b = tok(texts[i:i + bs], padding=True, truncation=True, max_length=256, return_tensors='pt')
            h = mod(**b).last_hidden_state
            m = b['attention_mask'].unsqueeze(-1).float()
            v = (h * m).sum(1) / m.sum(1).clamp(min=1e-9)
            out.append(torch.nn.functional.normalize(v, dim=-1).numpy())
            if len(texts) > 200 and (i // bs) % 20 == 0:
                log(f'    {i + len(b["input_ids"])}/{len(texts)}')
    return np.vstack(out).astype('float32') if out else np.zeros((0, 384), 'float32')


def quantize(E):
    s = (np.abs(E).max(1) / 127).astype('float32')
    s[s == 0] = 1e-9
    q = np.clip(np.round(E / s[:, None]), -127, 127).astype(np.int8)
    return q, s


def load_cache():
    """The cache IS the shipped int8 data: {(vid, t0, t1): (int8 row, scale)} when the chunker version matches."""
    try:
        info = json.load(open(os.path.join(DATA, 'build-info.json'), encoding='utf-8'))
        if info.get('chunker') != CHUNKER_VERSION or info.get('dims') != 384:
            return {}
        idx = json.load(open(os.path.join(DATA, 'index.json'), encoding='utf-8'))
        Q = np.fromfile(os.path.join(DATA, 'vectors.i8.bin'), dtype=np.int8).reshape(-1, 384)
        S = np.fromfile(os.path.join(DATA, 'scale.f32.bin'), dtype=np.float32)
        P = idx['passages']
        vids = [e['vid'] for e in idx['episodes']]
        return {(vids[P['ep'][i]], P['t0'][i], P['t1'][i]): (Q[i], S[i]) for i in range(len(S))}
    except (OSError, KeyError, ValueError):
        return {}


# ---------------------------------------------------------------- 3. tag
def compile_terms(terms):
    return [re.compile('|'.join(f'(?:{p})' for p in t['patterns']), re.I) for t in terms]


def tag(text, rx):
    hits = []
    for i, r in enumerate(rx):
        m = r.search(text)
        if m:
            hits.append((m.start(), i))
    return [i for _, i in sorted(hits)]


# ---------------------------------------------------------------- 4-7. layout, clusters, nodes, neighbours
def project(D):
    import umap
    xy = umap.UMAP(n_neighbors=15, min_dist=0.1, metric='cosine', random_state=42, n_jobs=1).fit_transform(D)
    lo, hi = xy.min(0), xy.max(0)
    span = float((hi - lo).max()) or 1.0
    xy = (xy - lo) / span + (1 - (hi - lo) / span) / 2          # keep the aspect ratio, centre in the square
    return np.clip(np.round(xy * 10000), 0, 10000).astype(int)


def neighbours(D, k=6, block=2048):
    N = len(D)
    out = np.zeros((N, k), dtype=np.uint16)
    for a in range(0, N, block):
        S = D[a:a + block] @ D.T
        for r in range(S.shape[0]):
            S[r, a + r] = -9
        part = np.argpartition(-S, k, axis=1)[:, :k]
        order = np.argsort(-np.take_along_axis(S, part, 1), axis=1)
        out[a:a + block] = np.take_along_axis(part, order, 1)
    return out


def median_xy(ix, XY):
    if not len(ix):
        return None, None
    m = np.median(XY[ix], 0)
    return int(m[0]), int(m[1])


def peak_xy(ix, XY, R=450, cap=2000):
    """Where a set of passages is densest: the median of the points within R of the point with the most
    neighbours within R (a mode, not a median of everything, which can land in empty space)."""
    ix = np.asarray(ix, dtype=int)
    if not len(ix):
        return None, None
    pts = XY[ix].astype(np.float64)
    ref = pts
    if len(pts) > cap:
        ref = pts[np.random.default_rng(42).choice(len(pts), cap, replace=False)]
    cnt = np.zeros(len(ref), int)
    for a in range(0, len(ref), 512):
        d2 = ((ref[a:a + 512, None, :] - pts[None, :, :]) ** 2).sum(-1)
        cnt[a:a + 512] = (d2 <= R * R).sum(1)
    k = int(np.argmax(cnt))
    near = pts[((pts - ref[k]) ** 2).sum(1) <= R * R]
    m = np.median(near, 0)
    return int(m[0]), int(m[1])


def own_share(x, y, ix, XY, R=450):
    """Share of all passages within R of (x, y) that belong to this set: how well the node sits in its own dots."""
    if x is None:
        return None
    near = np.where(((XY - np.array([x, y])) ** 2).sum(1) <= R * R)[0]
    if not len(near):
        return 0.0
    return round(float(np.isin(near, np.asarray(ix, dtype=int)).mean()), 2)


# ---------------------------------------------------------------- 9. snippets
def windows(p, cap, marked):
    """Candidate quote windows [(lo, hi)] of a passage: whole sentences inside one speaker's turn, at most cap words.
    Where an episode's captions never mark a change of speaker, a window stays inside one sentence, since a
    change of speaker almost always falls between sentences. A sentence longer than cap gives sliding windows."""
    words = p['text'].split()
    n = len(words)
    sent = sorted({0} | {i + 1 for i, w in enumerate(words[:-1]) if SENT_END.search(w)})
    cuts = sorted({0, n} | set(p['turns']) | (set() if marked else set(sent)))
    out = []
    for a, b in zip(cuts, cuts[1:]):
        ss = [s for s in sent if a <= s < b]
        if not ss or ss[0] != a:
            ss = [a] + ss
        ends = ss[1:] + [b]
        for k in range(len(ss)):
            lo = ss[k]
            for m in range(k, len(ss)):
                hi = ends[m]
                if hi - lo > cap:
                    break
                if hi - lo >= 5:
                    out.append((lo, hi))
            if ends[k] - lo > cap:
                for s in list(range(lo, ends[k] - cap + 1, 4)) + [ends[k] - cap]:
                    out.append((s, s + cap))
    return words, sent, sorted(set(out))


def window_text(words, lo, hi, starts):
    seg = words[lo:hi]
    text = ' '.join(seg)
    if lo not in starts or not seg[0][:1].isupper():
        text = '…' + text
    if not SENT_END.search(seg[-1]):
        text = text + '…'
    return text


def pick_window(p, cap, marked, target_vec, embed, must=None):
    """The window closest (by the model) to target_vec; with must (a regex), only windows it matches, if any.
    -> (text, n_words, cue_time) or None."""
    words, sent, cands = windows(p, cap, marked)
    starts = set(sent) | set(p['turns'])
    if not cands:
        return None
    if must is not None:
        hit = [c for c in cands if must.search(' '.join(words[c[0]:c[1]]))]
        cands = hit or cands
    texts = [' '.join(words[lo:hi]) for lo, hi in cands]
    V = embed(texts)
    best, bs = None, -9
    for (lo, hi), v in zip(cands, V):
        s = float(v @ target_vec)
        whole = lo in starts and SENT_END.search(words[hi - 1])
        s += 0.03 if whole else 0
        s -= 0.08 if hi - lo < 8 else 0
        if s > bs:
            best, bs = (lo, hi), s
    lo, hi = best
    t = p['t0']
    for wi, ts in p['marks']:
        if wi <= lo:
            t = ts
    return window_text(words, lo, hi, starts), hi - lo, t


def word_spans(text, rx):
    """Idea-word spans in a snippet, widened to whole words (a pattern can stop mid-word: 'superintelligen')."""
    spans = []
    for ii, r in enumerate(rx):
        for m in r.finditer(text):
            a, b = m.start(), m.end()
            while a > 0 and text[a - 1].isalnum():
                a -= 1
            while b < len(text) and (text[b].isalnum() or (text[b] in "-'’" and b + 1 < len(text) and text[b + 1].isalnum())):
                b += 1
            spans.append([a, b, ii])
    spans.sort()
    keep, last = [], -1
    for s in spans:
        if s[0] >= last:
            keep.append(s)
            last = s[1]
    return keep


# ---------------------------------------------------------------- key words (every passage)
FILLER = set('''uh um uhm hmm mm yeah yep yes like know think going gonna wanna really just thing things kind sort mean
actually lot lots right okay ok want say said says got get gets getting way ways stuff maybe pretty basically sure
don't doesn't didn't it's that's there's what's i'm you're we're they're he's she's i've you've we've they've i'd you'd
we'd they'd it'll i'll you'll we'll they'll can't won't isn't aren't wasn't weren't let's let need make makes made
look looking good great bit little probably definitely obviously literally exactly question questions talk talking
point time times today guess feel tell told come comes coming goes went doing does did able different important
interesting true whatever something anything everything nothing someone somebody anybody everybody thank thanks
okay yeah course kinda gotta lemme hey oh ah wow cool totally absolutely certainly clearly quite fact case sense
start started use used using try trying tried understand saying says believe idea ideas world years year long
end ends turn turns happen happens happened happening ones one two three big huge'''.split())


def key_words(P, k=5):
    """-> (vocab, [[term index] x <=k per passage]) : the passage's most distinctive words and two-word phrases
    by tf-idf over this set of passages. An index of terms, not a quote."""
    from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
    stop = set(ENGLISH_STOP_WORDS) | FILLER
    tok_re = re.compile(r"[a-z][a-z'-]*[a-z]")

    def analyse(text):
        toks = [re.sub(r"'s$", '', t) for t in tok_re.findall(text.lower().replace('’', "'"))]
        ok = [t if (len(t) >= 3 and t not in stop and not t.startswith("'")) else None for t in toks]
        grams = [t for t in ok if t]
        grams += [f'{a} {b}' for a, b in zip(ok, ok[1:]) if a and b and a != b]
        return grams

    vec = TfidfVectorizer(analyzer=analyse, min_df=2, max_df=0.12, sublinear_tf=True)
    M = vec.fit_transform([p['text'] for p in P]).tocsr()
    names = vec.get_feature_names_out()
    vocab, vid, out = [], {}, []
    for r in range(M.shape[0]):
        row = M.getrow(r)
        order = np.argsort(-row.data)
        chosen = []
        for j in order:
            t = names[row.indices[j]]
            if any(t in c.split(' ') or c in t.split(' ') for c in chosen if ' ' in c or ' ' in t):
                continue
            chosen.append(t)
            if len(chosen) == k:
                break
        ids = []
        for t in chosen:
            if t not in vid:
                vid[t] = len(vocab)
                vocab.append(t)
            ids.append(vid[t])
        out.append(ids)
    return vocab, out


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--episodes', default='pilot', help='pilot (map/build/pilot.txt) | all | a file of ids')
    ap.add_argument('--work', default=os.path.join(tempfile.gettempdir(), 'map-work'))
    ap.add_argument('--keep-work', action='store_true')
    ap.add_argument('--manifest'); ap.add_argument('--terms'); ap.add_argument('--whoswho'); ap.add_argument('--episodes-meta', dest='episodes_meta')
    ap.add_argument('--cues-dir', action='append')
    ap.add_argument('--dims', type=int, default=384, choices=[384, 192])
    ap.add_argument('--k', default='auto')
    ap.add_argument('--snippet-share', type=float, default=0.02)
    ap.add_argument('--keep-model', action='store_true', help='keep the Python model outside the work dir for re-runs')
    ap.add_argument('--no-check', action='store_true')
    args = ap.parse_args()
    args.episodes_file = args.episodes
    args.episodes = None
    cfg = load_config(args)
    if args.episodes_meta:
        cfg['episodes'] = args.episodes_meta
    if args.dims != 384:
        sys.exit('--dims 192 is reserved for the full build (a PCA projection shipped beside the vectors); not built yet')
    os.makedirs(args.work, exist_ok=True)
    os.makedirs(DATA, exist_ok=True)
    T = time.time()

    # ---- inputs
    man = json.load(open(cfg['manifest'], encoding='utf-8'))
    man = {m['video_id']: m for m in man}
    terms_doc = json.load(open(cfg['terms'], encoding='utf-8'))
    terms = terms_doc['terms']
    rx = compile_terms(terms)
    who = json.load(open(cfg['whoswho'], encoding='utf-8'))
    wnodes = {n['id']: n for n in who['nodes']}
    ep_meta = {}
    if cfg.get('episodes') and os.path.exists(cfg['episodes']):
        for e in json.load(open(cfg['episodes'], encoding='utf-8')):
            ep_meta.setdefault(e['video_id'], e)
    extra = json.load(open(os.path.join(HERE, 'episodes-extra.json'), encoding='utf-8'))['episodes']
    gl_path = os.path.join(os.path.dirname(MAP), 'glossary', 'terms.json')
    glossary = set()
    if os.path.exists(gl_path):
        glossary = {t['id'] for t in json.load(open(gl_path, encoding='utf-8')).get('terms', [])}

    sel = args.episodes_file
    if sel == 'pilot':
        ids = [l.strip() for l in open(os.path.join(HERE, 'pilot.txt')) if l.strip()]
    elif sel == 'all':
        ids = list(man)
    else:
        ids = [l.strip() for l in open(sel) if l.strip()]
    excluded, rows = [], []
    for vid in ids:
        m = man.get(vid)
        cp = find_cues(vid, cfg, m or {})
        if not m or not cp:
            excluded.append({'vid': vid, 'why': 'no captions' if m else 'not in manifest'})
            continue
        rows.append((m, cp))
    log(f'episodes: {len(rows)} built, {len(excluded)} not included')

    # ---- 1. chunk (private)
    t0 = time.time()
    P, ep_words, ep_marked, ep_caps = [], [], [], []
    for ei, (m, cp) in enumerate(rows):
        cues = json.load(open(cp, encoding='utf-8'))
        raw = ' '.join(c.get('text') or '' for c in cues)
        labels = speaker_labels(cues)
        pc = prep_cues(cues, labels)
        ch = chunk(pc)
        for c in ch:
            c['ep'] = ei
            c['vid'] = m['video_id']
            P.append(c)
        ep_words.append(sum(c['words'] for c in ch))
        ep_marked.append(any(c['turns'] for c in pc))
        # caption kind: checked by hand in episodes-extra.json; otherwise a guess from the text ('>>' and no
        # curly quotes = automatic captions), shipped as a guess so the page says "caption", not which kind
        kind = extra.get(m['video_id'], {}).get('captions')
        if not kind:
            kind = 'auto?' if ('>>' in raw and '’' not in raw) else 'creator?'
        ep_caps.append(kind)
        log(f'   {m["video_id"]}: {len(ch)} passages, captions {kind}, speaker turns '
            f'{"marked" if ep_marked[-1] else "not marked"}{", labels " + ", ".join(sorted(labels)) if labels else ""}')
    N = len(P)
    with open(os.path.join(args.work, 'passages.jsonl'), 'w', encoding='utf-8') as f:
        for p in P:
            f.write(json.dumps(p, ensure_ascii=False) + '\n')
    log(f'1 chunk: {N} passages, {sum(ep_words):,} caption words, median {int(np.median([p["words"] for p in P]))} words '
        f'/ {np.median([p["t1"] - p["t0"] for p in P]):.1f} s  ({time.time() - t0:.1f}s)')

    # ---- 2. embed (cache = shipped int8 data)
    t0 = time.time()
    cache = load_cache()
    Q = np.zeros((N, 384), np.int8)
    S = np.zeros(N, np.float32)
    todo = []
    for i, p in enumerate(P):
        hit = cache.get((p['vid'], p['t0'], p['t1']))
        if hit is not None:
            Q[i], S[i] = hit
        else:
            todo.append(i)
    tok = mod = None
    if todo:
        tok, mod = load_py_model(args.work, args.keep_model)
        E = embed_texts([P[i]['text'] for i in todo], tok, mod)
        q, s = quantize(E)
        Q[todo], S[todo] = q, s
    D = Q.astype(np.float32) * S[:, None]          # everything downstream uses what the browser will see
    log(f'2 embed: {len(todo)} new, {N - len(todo)} from cache  ({time.time() - t0:.1f}s)')

    # ---- 3. tag
    for p in P:
        p['ideas'] = tag(p['text'], rx)
    tagged = sum(1 for p in P if p['ideas'])
    idea_n = Counter(i for p in P for i in p['ideas'])
    log(f'3 tag: {tagged} of {N} passages ({100 * tagged / N:.0f}%) carry an idea tag; {len(idea_n)} ideas seen')

    # ---- 4. project
    t0 = time.time()
    # UMAP and KMeans are repeatable but slow on a busy CPU; a kept work dir (--keep-work) caches them, keyed
    # by the exact int8 vectors, so a re-run that only changes quotes or key words skips them
    import hashlib
    vkey = hashlib.sha1(Q.tobytes() + S.tobytes()).hexdigest()[:16]
    lay_path = os.path.join(args.work, f'layout-{vkey}.npz')
    lay = np.load(lay_path) if os.path.exists(lay_path) else None
    XY = lay['XY'] if lay is not None else project(D)
    log(f'4 project: UMAP cosine n15 d0.1 seed42 single-thread ({time.time() - t0:.1f}s)')

    # ---- 5. cluster
    t0 = time.time()
    from sklearn.cluster import KMeans
    k = round(math.sqrt(N / 5)) if args.k == 'auto' else int(args.k)
    if lay is not None and 'C' in lay and len(lay['cen']) == k:
        C, centers = lay['C'], lay['cen']
    else:
        km = KMeans(n_clusters=k, n_init=4, random_state=42).fit(D)
        C, centers = km.labels_, km.cluster_centers_
        np.savez(lay_path, XY=XY, C=C, cen=centers)
    # person of a passage = first guest of its episode
    people_ids = []
    for m, _ in rows:
        for g in m['guests']:
            if g not in people_ids:
                people_ids.append(g)
    ep_people = [[people_ids.index(g) for g in m['guests']] for m, _ in rows]
    p_person = np.array([ep_people[p['ep']][0] for p in P])
    base_rate = {i: idea_n[i] / N for i in idea_n}
    clusters = []
    exemplar_of_cluster = []
    for c in range(k):
        ix = np.where(C == c)[0]
        cn = Counter(i for j in ix for i in P[j]['ideas'])
        lab = [i for i, h in cn.most_common() if h >= 8 and (h / len(ix)) / base_rate[i] >= 2][:3]
        pc = Counter(p_person[ix].tolist()).most_common(1)[0]
        x, y = peak_xy(ix, XY)
        clusters.append({'x': x, 'y': y, 'n': int(len(ix)), 'label': lab,
                         'mostly': {'person': int(pc[0]), 'share': round(pc[1] / len(ix), 2)}})
        cen = centers[c] / np.linalg.norm(centers[c])
        exemplar_of_cluster.append(int(ix[np.argmax(D[ix] @ cen)]))
    log(f'5 cluster: k={k}; {sum(1 for c in clusters if c["label"])} labelled by idea terms, '
        f'{sum(1 for c in clusters if not c["label"])} "mixed talk"  ({time.time() - t0:.1f}s)')

    # ---- 6. nodes
    # a node sits where its passages are densest (peak_xy); 'own' = share of the dots around it that are its own
    person_n = Counter(p_person.tolist())
    people = []
    for pi, pid in enumerate(people_ids):
        ix = np.array([j for j, p in enumerate(P) if pi in ep_people[p['ep']]])
        x, y = peak_xy(ix, XY)
        node = wnodes.get(pid, {})
        people.append({'id': pid, 'name': node.get('name') or pid.replace('_', ' ').title(),
                       'colour': None, 'x': x, 'y': y, 'n': int(len(ix)), 'channel': None,
                       'own': own_share(x, y, ix, XY)})
    # colour slots go to the people with the most passages (by first guest), the rest stay grey
    for slot, (pi, _) in enumerate(sorted(person_n.items(), key=lambda kv: -kv[1])[:PALETTE_SLOTS]):
        people[pi]['colour'] = slot
    ideas, IV = [], np.zeros((len(terms), 384), np.float32)
    for ii, t in enumerate(terms):
        ix = np.array([j for j, p in enumerate(P) if ii in p['ideas']], dtype=int)
        x, y = peak_xy(ix, XY) if len(ix) >= 8 else (None, None)
        if len(ix) >= 3:
            v = D[ix].mean(0)
            IV[ii] = v / np.linalg.norm(v)
        ideas.append({'id': t['id'], 'label': t['label'], 'lane': t['lane'], 'layer': t.get('layer'),
                      'precision': t.get('precision'), 'x': x, 'y': y, 'n': int(len(ix)),
                      'glossary': t['id'] in glossary, 'own': own_share(x, y, ix, XY)})
    IQ, IS = quantize(IV)
    IS[np.abs(IV).max(1) == 0] = 0
    # a lane counts every passage with any of its idea words (a passage can count in more than one lane);
    # the page colours a passage by the lane holding most of its idea words (ties: the first found)
    lane_n = Counter(l for p in P for l in dict.fromkeys(terms[i]['lane'] for i in p['ideas']))
    lanes = [{'id': l, 'label': LANE_LABELS.get(l, l), 'n': n, 'colour': ci if ci < PALETTE_SLOTS else None}
             for ci, (l, n) in enumerate(lane_n.most_common())]
    log(f'6 nodes: {len(people)} people (own share {[p["own"] for p in people]}), '
        f'{sum(1 for i in ideas if i["x"] is not None)} idea nodes (>= 8 passages), '
        f'own share {sorted((i["own"], i["id"]) for i in ideas if i["x"] is not None)}; lanes {[(l["id"], l["n"]) for l in lanes]}')

    # ---- 7. nn
    t0 = time.time()
    NN = neighbours(D)
    log(f'7 nn: 6 neighbours per passage ({time.time() - t0:.1f}s); same-episode share '
        f'{np.mean([P[j]["ep"] == P[i]["ep"] for i in range(N) for j in NN[i]]):.2f}')

    # ---- 8. questions
    qdoc = json.load(open(os.path.join(HERE, 'questions.json'), encoding='utf-8'))
    if tok is None:
        tok, mod = load_py_model(args.work, args.keep_model)
    QE = embed_texts([q['text'] for q in qdoc['questions']], tok, mod)
    questions, dropped, qvecs = [], [], []
    hits_log = open(os.path.join(args.work, 'question-hits.txt'), 'w', encoding='utf-8')
    for q, v in zip(qdoc['questions'], QE):
        if q.get('skip'):
            dropped.append({'id': q['id'], 'why': 'skipped after reading hits'})
            continue
        sc = D @ v
        top = np.argsort(-sc)[:12]
        isc = IV @ v
        itop = [(int(i), round(float(isc[i]), 3)) for i in np.argsort(-isc)[:3] if isc[i] >= 0.35]
        hits_log.write(f'\n## {q["id"]}: {q["text"]}  best {sc[top[0]]:.3f}\n')
        for j in top[:12]:
            hits_log.write(f'  {sc[j]:.3f} {P[j]["vid"]} {int(P[j]["t0"])}s  {P[j]["text"][:220]}\n')
        if sc[top[0]] < 0.5:
            dropped.append({'id': q['id'], 'best': round(float(sc[top[0]]), 3)})
            continue
        questions.append({'id': q['id'], 'text': q['text'],
                          'top': [[int(j), round(float(sc[j]), 3)] for j in top],
                          'ideas': itop})
        qvecs.append(v)
    hits_log.close()
    log(f'8 questions: kept {len(questions)}, dropped {dropped}; best scores '
        f'{[q["top"][0][1] for q in questions]}  (hits for private reading: {os.path.join(args.work, "question-hits.txt")})')

    # ---- 9. snippets (select, cut, cap)
    shows_raw = [m['show'] for m, _ in rows]
    budget = [int(args.snippet_share * w) for w in ep_words]
    used = [0] * len(rows)
    # Each quote is the window of its passage closest (by the model) to why it was picked: the question for a
    # question's top 12, the passage's own vector for a cluster exemplar, the idea for an idea exemplar (and
    # then it must contain the idea word). A window never crosses a marked change of speaker.
    order = []                                # (passage, target vector, must-match regex), in priority order
    for q, v in zip(questions, qvecs):
        order += [(j, v, None) for j, _ in q['top']]
    order += [(j, D[j] / (np.linalg.norm(D[j]) or 1), None) for j in exemplar_of_cluster]
    for ii in range(len(terms)):
        ix = [j for j, p in enumerate(P) if ii in p['ideas']]
        if ix and IS[ii] > 0:
            best = sorted(ix, key=lambda j: -float(D[j] @ IV[ii]))[:3]
            order += [(j, IV[ii], rx[ii]) for j in best]
    emb = lambda texts: embed_texts(texts, tok, mod)
    snippets, skipped = {}, 0
    for j, target, must in order:
        if str(j) in snippets:
            continue
        p = P[j]
        cap = SNIP_CAP_NYT if shows_raw[p['ep']] in NYT_SHOWS else SNIP_CAP
        got = pick_window(p, cap, ep_marked[p['ep']], target, emb, must)
        if not got:
            continue
        text, nw, ts = got
        if used[p['ep']] + nw > budget[p['ep']]:
            skipped += 1
            continue
        used[p['ep']] += nw
        snippets[str(j)] = {'t': text, 's': int(ts), 'm': word_spans(text, rx)}
    total_snip = sum(used)
    log(f'9 snippets: {len(snippets)} kept, {skipped} skipped by the per-episode cap; {total_snip:,} of '
        f'{sum(ep_words):,} words ({100 * total_snip / sum(ep_words):.2f}%); worst episode '
        f'{max(u / w for u, w in zip(used, ep_words)) * 100:.2f}%')

    # ---- 10. export
    shows = {}
    for sid in dict.fromkeys(shows_raw):
        cid = SHOW_ALIAS.get(sid, sid)
        node = wnodes.get(cid, {})
        shows[cid] = {'name': node.get('name', cid), 'url': node.get('url'), 'nyt': cid in NYT_SHOWS or sid in NYT_SHOWS}
    episodes = []
    for ei, (m, _) in enumerate(rows):
        em = ep_meta.get(m['video_id'], {})
        xe = extra.get(m['video_id'], {})
        episodes.append({'vid': m['video_id'], 'show': SHOW_ALIAS.get(m['show'], m['show']),
                         'date': m.get('date'),
                         'title': fix_mojibake(xe.get('title') or em.get('episode') or m.get('title')),
                         'people': ep_people[ei], 'url': xe.get('url') or em.get('episode_url'),
                         'captions': ep_caps[ei], 'turns': ep_marked[ei],
                         'n': sum(1 for p in P if p['ep'] == ei), 'words': ep_words[ei]})
    # key words for every passage (an index of terms, not a quote): a vocabulary + indexes per passage
    t0 = time.time()
    kw_vocab, kw = key_words(P)
    log(f'   key words: {len(kw_vocab):,} terms, {sum(len(a) for a in kw) / N:.1f} per passage  ({time.time() - t0:.1f}s)')
    index = {
        'v': 1,
        'shows': shows, 'people': people, 'episodes': episodes, 'lanes': lanes, 'ideas': ideas,
        'clusters': clusters,
        'passages': {'ep': [p['ep'] for p in P], 't0': [p['t0'] for p in P], 't1': [p['t1'] for p in P],
                     'x': XY[:, 0].tolist(), 'y': XY[:, 1].tolist(), 'c': C.tolist(),
                     'ideas': [p['ideas'] for p in P]},
        'questions': questions,
        'excluded': excluded,
    }
    wj = lambda name, obj: json.dump(obj, open(os.path.join(DATA, name), 'w', encoding='utf-8'),
                                     ensure_ascii=False, separators=(',', ':'))
    wj('index.json', index)
    wj('snippets.json', snippets)
    wj('words.json', {'note': 'key words per passage, picked by tf-idf; an index, not a quote', 'vocab': kw_vocab, 'p': kw})
    NN.astype('<u2').tofile(os.path.join(DATA, 'nn.u16.bin'))
    Q.tofile(os.path.join(DATA, 'vectors.i8.bin'))
    S.astype('<f4').tofile(os.path.join(DATA, 'scale.f32.bin'))
    IQ.tofile(os.path.join(DATA, 'ideas.i8.bin'))
    IS.astype('<f4').tofile(os.path.join(DATA, 'ideas.scale.f32.bin'))
    info = {
        'built': time.strftime('%Y-%m-%d'),
        'model': PY_MODEL + ' (mean pool, L2), int8 per-row scale; browser query: ' + WEB_MODEL + ' q8',
        'layout': 'UMAP cosine, 15 neighbours, min_dist 0.1, seed 42, single thread',
        'clusters': f'KMeans k={k} on 384-d vectors',
        'chunker': CHUNKER_VERSION, 'dims': 384,
        'terms_status': terms_doc.get('meta', {}).get('status', '')[:120],
        'terms_date': terms_doc.get('meta', {}).get('date'),
        'counts': {'episodes': len(rows), 'passages': N, 'caption_words': sum(ep_words),
                   'snippets': len(snippets), 'snippet_words': total_snip, 'tagged_passages': tagged},
        'snippet_share': args.snippet_share,
        'questions_dropped': dropped,
        'excluded': excluded,
    }
    wj('build-info.json', info)
    for f in sorted(os.listdir(DATA)):
        b = open(os.path.join(DATA, f), 'rb').read()
        log(f'   data/{f:22s} {len(b):>9,} B   gz {len(gzip.compress(b, 9)):>9,} B')

    # ---- model for the browser (fetched once, same origin)
    if not os.path.exists(os.path.join(MODEL_DIR, 'onnx', 'model_quantized.onnx')):
        from huggingface_hub import hf_hub_download
        for f in WEB_MODEL_FILES:
            hf_hub_download(WEB_MODEL, f, local_dir=MODEL_DIR)
        shutil.rmtree(os.path.join(MODEL_DIR, '.cache'), ignore_errors=True)
        log('   fetched the q8 browser model into map/model/')
    lic = os.path.join(MODEL_DIR, 'LICENSE')
    if not os.path.exists(lic):
        import urllib.request
        txt = urllib.request.urlopen('https://www.apache.org/licenses/LICENSE-2.0.txt', timeout=30).read().decode('utf-8')
        open(lic, 'w', encoding='utf-8', newline='\n').write(
            'all-MiniLM-L6-v2 (sentence-transformers, 2021), ONNX export by Xenova (Hugging Face: Xenova/all-MiniLM-L6-v2).\n'
            'Licensed under the Apache License, Version 2.0; files here are unmodified copies.\n\n' + txt)

    # ---- check + cleanup
    rc = 0
    if not args.no_check:
        rc = subprocess.call([sys.executable, os.path.join(HERE, 'check.py')])
    if not args.keep_work:
        tok = mod = None                      # release the memory-mapped model file first (Windows)
        import gc
        gc.collect()
        shutil.rmtree(args.work, ignore_errors=True)
        if os.path.exists(args.work):
            log(f'   WARNING: could not fully delete the work dir; delete it by hand: {args.work}')
        else:
            log('   work dir deleted (passage text, Python model)')
    log(f'done in {time.time() - T:.0f}s')
    sys.exit(rc)


if __name__ == '__main__':
    main()
