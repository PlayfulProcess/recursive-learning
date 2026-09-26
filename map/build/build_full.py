#!/usr/bin/env python3
"""Build map/data/ for the WHOLE corpus_index.py corpus (563 episodes, ~81k passages), instead of
chunking raw captions like build.py does for the pilot. Source: the local sqlite index built by
recursive-transcripts' tools/corpus_index.py (passages already chunked to ~30s and embedded with
sentence-transformers/all-MiniLM-L6-v2, float16, L2-normalised) -- no re-embedding of passages.
Reuses build.py's pure helper functions (clean, tag, project, cluster maths, windows/pick_window,
key_words, ...) so the shipped format and rules match.

    python map/build/build_full.py

Private inputs (the corpus_index.py sqlite file, the draft terms, the who's-who) are read from flags
(--corpus-db --terms --whoswho), from env vars (MAP_CORPUS_DB, MAP_TERMS, MAP_WHOSWHO), or from the
gitignored map/build/local.json (the same file build.py reads, plus a "corpus_db" key):

    { "corpus_db": ".../corpus.sqlite", "terms": ".../ai-map/terms.json", "whoswho": ".../whoswho.json" }

Differences from build.py, and why (see map/build/README.md for the pilot's own rules):
  - Passage text has no per-cue word timings (corpus_index.py joins raw cue text into ~30s blocks), so
    a quote's timestamp is its ~30s passage's start, not the finer per-cue time build.py gets. Turn
    detection (">>" / "Name: " labels) is re-run over each passage's text so quotes still avoid crossing
    a marked change of speaker; passages with no marks fall back to single-sentence quotes, same as build.py.
  - 470 of 563 episodes (everything from corpus-expansion) carry no guest name, so "person" nodes exist
    only for the 93 ai-map episodes; the rest colour as "Other" (no guest identified), same bucket the
    page already uses for a guest outside the top 6.
  - No per-quote manual "read it in context" pass (build/quote-review.json) -- infeasible by hand at this
    scale in one sitting. Snippets are still filtered mechanically (markup/label leakage, caps, per-episode
    share) but not read by a person. index.html says so plainly; treat this round's quotes as a first pass.
  - The per-passage vectors shipped for free-text search are PCA-reduced (see PCA_DIMS below) and
    renormalised, not the full 384 floats, to fit the ~10 MB lazy-load budget at this scale. Everything
    else (layout, clusters, idea vectors, neighbours, snippet targeting) still uses the full 384 numbers.
"""
import gzip, hashlib, json, math, os, re, shutil, sqlite3, sys, tempfile, time
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as B  # noqa: E402  (reuse the pilot's pure helpers)

MAP = B.MAP
DATA = B.DATA

PCA_DIMS = 112          # ~9.4 MB for vectors.i8.bin + scale.f32.bin at N=81,219 (budget: ~10 MB)


def load_config():
    cfg = {}
    lp = os.path.join(HERE, 'local.json')
    if os.path.exists(lp):
        cfg.update(json.load(open(lp, encoding='utf-8')))
    for k, e in (('corpus_db', 'MAP_CORPUS_DB'), ('terms', 'MAP_TERMS'), ('whoswho', 'MAP_WHOSWHO')):
        if os.environ.get(e):
            cfg[k] = os.environ[e]
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus-db'); ap.add_argument('--terms'); ap.add_argument('--whoswho')
    args, _ = ap.parse_known_args()
    for k in ('corpus_db', 'terms', 'whoswho'):
        v = getattr(args, k)
        if v:
            cfg[k] = v
    miss = [k for k in ('corpus_db', 'terms', 'whoswho') if not cfg.get(k)]
    if miss:
        sys.exit(f'missing inputs {miss}: pass flags, env vars, or write map/build/local.json (see module docstring)')
    return cfg

# corpus-expansion re-scraped some shows the ai-map pilot already had, under a human-readable name
# instead of the whoswho id -- canonicalise so they don't split into two "shows"
SHOW_CANON = {
    'Dwarkesh Podcast': 'pod_dwarkesh',
    'Making Sense with Sam Harris': 'pod_ms',
    'The Ezra Klein Show': 'pod_ezra',
    'pod_making_sense': 'pod_ms',
    'pod_ezra_klein': 'pod_ezra',
    'No Priors': 'pod_no_priors',
    'Hard Fork': 'pod_hard_fork',
}
# shows corpus-expansion added that aren't in the whoswho file yet
EXTRA_SHOWS = {
    'pod_no_priors': {'name': 'No Priors', 'hosts': ['Sarah Guo', 'Elad Gil'],
                       'url': 'https://www.no-priors.com/', 'nyt': False},
    'pod_hard_fork': {'name': 'Hard Fork', 'hosts': ['Kevin Roose', 'Casey Newton'],
                       'url': 'https://www.nytimes.com/column/hard-fork', 'nyt': True},
}
NYT_SHOWS = {'pod_ezra', 'pod_hard_fork'}


def log(*a):
    print(*a, flush=True)


def canon_show(raw):
    return SHOW_CANON.get(raw, raw)


# ---------------------------------------------------------------- load from corpus.sqlite
def load_corpus(corpus_db):
    conn = sqlite3.connect(corpus_db)
    eps = conn.execute('SELECT video_id, show, date, title, guests, source FROM episodes').fetchall()
    video_ids = [e[0] for e in eps]
    ep_index = {vid: i for i, vid in enumerate(video_ids)}
    ep_show_raw = [e[1] for e in eps]
    ep_date = [e[2] for e in eps]
    ep_title = [e[3] for e in eps]
    ep_guests_raw = [json.loads(e[4] or '[]') for e in eps]

    rows = conn.execute(
        'SELECT p.video_id, p.start, p.end, p.text, e.vec FROM passages p JOIN embeddings e '
        'ON e.passage_id = p.id ORDER BY p.id').fetchall()
    log(f'loaded {len(eps)} episodes, {len(rows)} passages from the corpus index')
    return video_ids, ep_index, ep_show_raw, ep_date, ep_title, ep_guests_raw, rows


# ---------------------------------------------------------------- turn/label detection on chunked text
def prep_passage_words(text, labels):
    """Like build.py's prep_cues, but for one already-chunked passage string (no per-cue boundaries)."""
    words, turns, pending = [], [], False
    for tok in B.clean(text, labels).split():
        if tok == B.TURN:
            pending = True
            continue
        if pending:
            turns.append(len(words))
            pending = False
        words.append(tok)
    return words, turns


def main():
    T = time.time()
    os.makedirs(DATA, exist_ok=True)
    cfg = load_config()
    video_ids, ep_index, ep_show_raw, ep_date, ep_title, ep_guests_raw, rows = load_corpus(cfg['corpus_db'])
    n_eps = len(video_ids)
    # public facts about the 10 pilot episodes that the manifest gets wrong or that were hand-checked
    # (captions kind confirmed on the watch page, corrected titles/dates/urls) -- reuse them here so this
    # round doesn't regress what the pilot already verified; everything else still gets a guessed kind
    extra = json.load(open(os.path.join(HERE, 'episodes-extra.json'), encoding='utf-8'))['episodes']
    for vid, xe in extra.items():
        ei = ep_index.get(vid)
        if ei is None:
            continue
        if xe.get('title'):
            ep_title[ei] = xe['title']
        if xe.get('date'):
            ep_date[ei] = xe['date']

    # ---- shows: canonicalise ids, merge duplicate names, fill in hosts/url/nyt
    who = json.load(open(cfg['whoswho'], encoding='utf-8'))
    wnodes = {n['id']: n for n in who['nodes']}
    ep_show = [canon_show(s) for s in ep_show_raw]
    shows = {}
    for cid in dict.fromkeys(ep_show):
        node = wnodes.get(cid)
        if node:
            hosts = [wnodes.get(h, {}).get('name') or h.replace('_', ' ').title() for h in node.get('hosts', [])]
            shows[cid] = {'name': node.get('name', cid), 'url': node.get('url'), 'nyt': cid in NYT_SHOWS,
                          'hosts': hosts}
        elif cid in EXTRA_SHOWS:
            shows[cid] = dict(EXTRA_SHOWS[cid])
        else:
            shows[cid] = {'name': cid.replace('_', ' ').title(), 'url': None, 'nyt': cid in NYT_SHOWS, 'hosts': []}
    log(f'shows: {len(shows)} canonical ids from {len(set(ep_show_raw))} raw names '
        f'({sorted(shows)})')

    # ---- people: only episodes with a known guest (the 93 ai-map episodes) get person nodes
    people_ids = []
    for g in ep_guests_raw:
        for name in g:
            pid = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
            if pid and pid not in people_ids:
                people_ids.append(pid)
    people_name = {}
    for g in ep_guests_raw:
        for name in g:
            pid = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
            if pid:
                people_name[pid] = name
    ep_people = [[people_ids.index(re.sub(r'[^a-z0-9]+', '_', n.lower()).strip('_')) for n in g if n]
                 for g in ep_guests_raw]
    n_with_guest = sum(1 for g in ep_people if g)
    log(f'people: {len(people_ids)} guests identified, {n_with_guest}/{n_eps} episodes carry a guest name')

    # ---- group passages by episode, run label/turn detection per episode
    by_ep = {}
    for vid, start, end, text, vec in rows:
        by_ep.setdefault(vid, []).append((start, end, text, vec))
    ep_words, ep_marked, ep_caps = [0] * n_eps, [False] * n_eps, [None] * n_eps
    P, vecs = [], []
    for vid, ei in ep_index.items():
        chunks = by_ep.get(vid, [])
        if not chunks:
            continue
        raw = ' '.join(c[2] or '' for c in chunks)
        labels = B.speaker_labels([{'text': raw}])
        any_turn = False
        for start, end, text, vec in chunks:
            words, turns = prep_passage_words(text or '', labels)
            if not words:
                continue
            if turns:
                any_turn = True
            clean_text = ' '.join(words)
            P.append({'ep': ei, 'vid': vid, 't0': round(float(start), 1), 't1': round(float(end), 1),
                      'text': clean_text, 'words': len(words), 'marks': [[0, round(float(start), 1)]],
                      'turns': turns})
            vecs.append(np.frombuffer(vec, dtype='float16').astype('float32'))
            ep_words[ei] += len(words)
        ep_marked[ei] = any_turn
        confirmed = extra.get(vid, {}).get('captions')
        ep_caps[ei] = confirmed or ('auto?' if ('>>' in raw and '\u2019' not in raw) else 'creator?')
    N = len(P)
    D = np.stack(vecs)
    norms = np.linalg.norm(D, axis=1, keepdims=True)
    norms[norms == 0] = 1
    D = (D / norms).astype('float32')
    log(f'1 chunk (from sqlite, no re-chunk): {N} passages, {sum(ep_words):,} caption words, '
        f'{sum(ep_marked)}/{n_eps} episodes carry a detected speaker turn  ({time.time() - T:.1f}s)')

    # ---- 3. tag
    terms_doc = json.load(open(cfg['terms'], encoding='utf-8'))
    terms = terms_doc['terms']
    rx = B.compile_terms(terms)
    gl_path = os.path.join(os.path.dirname(MAP), 'glossary', 'terms.json')
    glossary = set()
    if os.path.exists(gl_path):
        glossary = {t['id'] for t in json.load(open(gl_path, encoding='utf-8')).get('terms', [])}
    for p in P:
        p['ideas'] = B.tag(p['text'], rx)
    tagged = sum(1 for p in P if p['ideas'])
    idea_n = Counter(i for p in P for i in p['ideas'])
    log(f'3 tag: {tagged} of {N} ({100 * tagged / N:.0f}%) carry an idea tag; {len(idea_n)} ideas seen')

    # ---- 4. project (UMAP, full 384 numbers)
    t0 = time.time()
    XY = B.project(D)
    log(f'4 project: UMAP cosine n15 d0.1 seed42 single-thread  ({time.time() - t0:.1f}s)')

    # ---- 5. cluster
    t0 = time.time()
    from sklearn.cluster import KMeans
    k = round(math.sqrt(N / 5))
    km = KMeans(n_clusters=k, n_init=4, random_state=42).fit(D)
    C, centers = km.labels_, km.cluster_centers_
    p_person = np.array([ep_people[p['ep']][0] if ep_people[p['ep']] else -1 for p in P])
    base_rate = {i: idea_n[i] / N for i in idea_n}
    clusters, exemplar_of_cluster = [], []
    for c in range(k):
        ix = np.where(C == c)[0]
        cn = Counter(i for j in ix for i in P[j]['ideas'])
        lab = [i for i, h in cn.most_common() if h >= 8 and (h / len(ix)) / base_rate[i] >= 2 and h / len(ix) >= 0.2][:3]
        pc = Counter(p_person[ix].tolist()).most_common(1)[0]
        x, y = B.peak_xy(ix, XY)
        clusters.append({'x': x, 'y': y, 'n': int(len(ix)), 'label': lab,
                         'mostly': {'person': int(pc[0]) if pc[0] >= 0 else None, 'share': round(pc[1] / len(ix), 2)}})
        cen = centers[c] / np.linalg.norm(centers[c])
        exemplar_of_cluster.append(int(ix[np.argmax(D[ix] @ cen)]))
    log(f'5 cluster: k={k}; {sum(1 for c in clusters if c["label"])} labelled, '
        f'{sum(1 for c in clusters if not c["label"])} "mixed talk"  ({time.time() - t0:.1f}s)')

    # ---- 6. nodes
    person_n = Counter(p_person[p_person >= 0].tolist())
    people = []
    for pi, pid in enumerate(people_ids):
        ix = np.array([j for j, p in enumerate(P) if pi in ep_people[p['ep']]], dtype=int)
        x, y = B.peak_xy(ix, XY)
        people.append({'id': pid, 'name': people_name.get(pid, pid.replace('_', ' ').title()),
                       'colour': None, 'x': x, 'y': y, 'n': int(len(ix)), 'channel': None,
                       'own': B.own_share(x, y, ix, XY)})
    for slot, (pi, _) in enumerate(sorted(person_n.items(), key=lambda kv: -kv[1])[:B.PALETTE_SLOTS]):
        people[pi]['colour'] = slot
    ideas, IV = [], np.zeros((len(terms), 384), np.float32)
    for ii, t in enumerate(terms):
        ix = np.array([j for j, p in enumerate(P) if ii in p['ideas']], dtype=int)
        x, y = B.peak_xy(ix, XY) if len(ix) >= 8 else (None, None)
        if len(ix) >= 3:
            v = D[ix].mean(0)
            IV[ii] = v / np.linalg.norm(v)
        ideas.append({'id': t['id'], 'label': t['label'], 'lane': t['lane'], 'layer': t.get('layer'),
                      'precision': t.get('precision'), 'x': x, 'y': y, 'n': int(len(ix)),
                      'glossary': t['id'] in glossary, 'own': B.own_share(x, y, ix, XY)})
    IQ, IS = B.quantize(IV)
    IS[np.abs(IV).max(1) == 0] = 0
    lane_n = Counter(l for p in P for l in dict.fromkeys(terms[i]['lane'] for i in p['ideas']))
    lanes = [{'id': l, 'label': B.LANE_LABELS.get(l, l), 'n': n, 'colour': ci if ci < B.PALETTE_SLOTS else None}
             for ci, (l, n) in enumerate(lane_n.most_common())]
    log(f'6 nodes: {len(people)} people, {sum(1 for i in ideas if i["x"] is not None)} idea nodes (>=8 passages); '
        f'lanes {[(l["id"], l["n"]) for l in lanes]}')

    # ---- 7. nn + layout_keep
    t0 = time.time()
    NN = B.neighbours(D)
    log(f'7 nn: 6 neighbours/passage  ({time.time() - t0:.1f}s)')
    t0 = time.time()
    keep = B.layout_keep(D, XY)
    log(f'   layout_keep {keep}  ({time.time() - t0:.1f}s)')

    # ---- python model, for questions + snippet windows (short strings only; passages are NOT re-embedded)
    work = os.path.join(tempfile.gettempdir(), 'map-work-full')
    os.makedirs(work, exist_ok=True)
    tok, mod = B.load_py_model(work, keep_model=True)
    emb = lambda texts: B.embed_texts(texts, tok, mod)

    # ---- 8. questions
    qdoc = json.load(open(os.path.join(HERE, 'questions.json'), encoding='utf-8'))
    QE = emb([q['text'] for q in qdoc['questions']])
    questions, dropped, qvecs = [], [], []
    for q, v in zip(qdoc['questions'], QE):
        if q.get('skip'):
            dropped.append({'id': q['id'], 'why': 'skipped after reading hits (pilot round)'})
            continue
        sc = D @ v
        top = np.argsort(-sc)[:12]
        isc = IV @ v
        itop = [(int(i), round(float(isc[i]), 3)) for i in np.argsort(-isc)[:3] if isc[i] >= 0.35]
        if sc[top[0]] < 0.5:
            dropped.append({'id': q['id'], 'best': round(float(sc[top[0]]), 3)})
            continue
        questions.append({'id': q['id'], 'text': q['text'],
                          'top': [[int(j), round(float(sc[j]), 3)] for j in top], 'ideas': itop})
        qvecs.append(v)
    log(f'8 questions: kept {len(questions)}, dropped {dropped}; best scores '
        f'{[q["top"][0][1] for q in questions]}')

    # ---- 9. snippets (mechanical filter only -- no per-quote manual read this round; see module docstring)
    budget = [int(0.02 * w) for w in ep_words]
    used = [0] * n_eps
    order = []
    for q, v in zip(questions, qvecs):
        order += [(j, v, None) for j, _ in q['top']]
    order += [(j, D[j] / (np.linalg.norm(D[j]) or 1), None) for j in exemplar_of_cluster]
    for ii in range(len(terms)):
        ix = [j for j, p in enumerate(P) if ii in p['ideas']]
        if ix and IS[ii] > 0:
            best = sorted(ix, key=lambda j: -float(D[j] @ IV[ii]))[:3]
            order += [(j, IV[ii], rx[ii]) for j in best]
    snippets, skipped = {}, 0
    for j, target, must in order:
        if str(j) in snippets:
            continue
        p = P[j]
        cap = B.SNIP_CAP_NYT if shows[ep_show[p['ep']]]['nyt'] else B.SNIP_CAP
        got = B.pick_window(p, cap, ep_marked[p['ep']], target, emb, must, review=None)
        if not got:
            continue
        text, nw, ts, key, nbad = got
        if used[p['ep']] + nw > budget[p['ep']]:
            skipped += 1
            continue
        used[p['ep']] += nw
        snippets[str(j)] = {'t': text, 's': int(ts), 'm': B.word_spans(text, rx)}
    total_snip = sum(used)
    log(f'9 snippets: {len(snippets)} kept, {skipped} skipped by per-episode cap; '
        f'{total_snip:,} of {sum(ep_words):,} words ({100 * total_snip / sum(ep_words):.2f}%); '
        f'1 in {round(N / max(1, len(snippets)))} passages')

    # ---- 10. export
    episodes = []
    for ei, vid in enumerate(video_ids):
        cid = ep_show[ei]
        episodes.append({'vid': vid, 'show': cid, 'hosts': shows[cid]['hosts'],
                         'date': ep_date[ei], 'title': B.fix_mojibake(ep_title[ei]),
                         'people': ep_people[ei], 'url': extra.get(vid, {}).get('url'),
                         'captions': ep_caps[ei] or 'auto?',
                         'turns': ep_marked[ei], 'n': sum(1 for p in P if p['ep'] == ei), 'words': ep_words[ei]})
    t0 = time.time()
    kw_vocab, kw = B.key_words(P)
    log(f'   key words: {len(kw_vocab):,} terms, {sum(len(a) for a in kw) / N:.1f}/passage  ({time.time() - t0:.1f}s)')

    index = {
        'v': 1, 'shows': shows, 'people': people, 'episodes': episodes, 'lanes': lanes, 'ideas': ideas,
        'clusters': clusters,
        'passages': {'ep': [p['ep'] for p in P], 't0': [p['t0'] for p in P], 't1': [p['t1'] for p in P],
                     'x': XY[:, 0].tolist(), 'y': XY[:, 1].tolist(), 'c': C.tolist(),
                     'ideas': [p['ideas'] for p in P]},
        'questions': questions, 'excluded': [], 'layout_keep': keep,
    }
    wj = lambda name, obj: json.dump(obj, open(os.path.join(DATA, name), 'w', encoding='utf-8'),
                                     ensure_ascii=False, separators=(',', ':'))
    wj('index.json', index)
    wj('snippets.json', snippets)
    wj('words.json', {'note': 'key words per passage, picked by tf-idf; an index, not a quote', 'vocab': kw_vocab, 'p': kw})
    NN.astype('<u2').tofile(os.path.join(DATA, 'nn.u16.bin'))
    IQ.tofile(os.path.join(DATA, 'ideas.i8.bin'))
    IS.astype('<f4').tofile(os.path.join(DATA, 'ideas.scale.f32.bin'))

    # ---- PCA-reduced vectors for lazy-loaded free-text search (full 384 numbers drive everything above)
    t0 = time.time()
    from sklearn.decomposition import PCA
    pca = PCA(n_components=PCA_DIMS, random_state=42)
    R = pca.fit_transform(D).astype('float32')
    Rn = np.linalg.norm(R, axis=1, keepdims=True)
    Rn[Rn == 0] = 1
    Ru = R / Rn                       # renormalise so the reduced dot product still reads like cosine
    VQ, VS = B.quantize(Ru)
    VQ.tofile(os.path.join(DATA, 'vectors.i8.bin'))
    VS.astype('<f4').tofile(os.path.join(DATA, 'scale.f32.bin'))
    mean = pca.mean_.astype('<f4')
    comps = pca.components_.astype('<f4')          # (PCA_DIMS, 384): project = (q - mean) @ comps.T, then renorm
    with open(os.path.join(DATA, 'pca.f32.bin'), 'wb') as f:
        f.write(mean.tobytes()); f.write(comps.tobytes())
    ev = float(pca.explained_variance_ratio_.sum())
    # top-10 overlap: on a sample, how many of a passage's true 10 nearest (full 384 numbers) are still
    # among its 10 nearest in the reduced, quantised space that ships for free-text search
    rng = np.random.default_rng(42)
    sample = rng.choice(N, size=min(1200, N), replace=False)
    simF = D[sample] @ D.T
    for k_, i in enumerate(sample):
        simF[k_, i] = -9
    topF = np.argsort(-simF, axis=1)[:, :10]
    Ru_dq = VQ.astype('float32') * VS[:, None]
    simR = Ru_dq[sample] @ Ru_dq.T
    for k_, i in enumerate(sample):
        simR[k_, i] = -9
    topR = np.argsort(-simR, axis=1)[:, :10]
    overlap = float(np.mean([len(set(topF[k_].tolist()) & set(topR[k_].tolist())) / 10 for k_ in range(len(sample))]))
    log(f'   PCA {PCA_DIMS}d: explained_var={ev:.3f}  top10_overlap={overlap:.3f}  ({time.time() - t0:.1f}s)')

    info = {
        'built': time.strftime('%Y-%m-%d'),
        'model': 'sentence-transformers/all-MiniLM-L6-v2 (mean pool, L2), float16 (corpus_index.py); '
                 'browser query: Xenova/all-MiniLM-L6-v2 q8',
        'layout': 'UMAP cosine, 15 neighbours, min_dist 0.1, seed 42, single thread, on the full 384 numbers',
        'clusters': f'KMeans k={k} on 384-d vectors',
        'source': 'the recursive-transcripts corpus index (tools/corpus_index.py); passages and '
                  'embeddings reused as-is, not re-chunked or re-embedded',
        'search_vectors': {'dims': PCA_DIMS, 'method': 'PCA (fit on the full corpus), renormalised, int8',
                            'explained_variance': round(ev, 3), 'top10_overlap': round(overlap, 3),
                            'note': 'the map, clusters, idea nodes, neighbours and snippets use the full '
                                    '384 numbers; only the lazy search vectors are reduced, for size'},
        'counts': {'episodes': n_eps, 'passages': N, 'caption_words': sum(ep_words),
                   'snippets': len(snippets), 'snippet_words': total_snip, 'tagged_passages': tagged,
                   'clusters': k, 'people': len(people)},
        'snippet_share': 0.02,
        'questions_dropped': dropped,
        'quote_review': 'mechanical filter only this round (markup/label leakage, word caps, per-episode '
                        'share); not read by a person -- see the build script docstring and index.html',
    }
    wj('build-info.json', info)
    total_gz = 0
    for f in sorted(os.listdir(DATA)):
        b = open(os.path.join(DATA, f), 'rb').read()
        gz = len(gzip.compress(b, 9))
        total_gz += gz
        log(f'   data/{f:22s} {len(b):>10,} B   gz {gz:>10,} B')
    log(f'   TOTAL gz {total_gz:,} B')

    tok = mod = None
    import gc
    gc.collect()
    log(f'done in {time.time() - T:.0f}s')


if __name__ == '__main__':
    main()
