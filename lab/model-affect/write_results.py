"""Writes the numbers part of results.md from results/*.json (run after the pipeline). The prose sections
(interpretation, deviations) are kept from the existing results.md between the markers, so a rerun only
refreshes the tables."""
import os, re
from concepts import IDS, BY_ID, AXES, PREDICTIONS, PASS
from common import HERE, rpath, jload
import posthoc

KEEP = ("<!-- prose:start -->", "<!-- prose:end -->")
NL = chr(10)


def fence(text):
    """the model's reply verbatim, in a 4-backtick block (a cut-off reply may open its own code fence)"""
    q = "`" * 4
    return "  " + q + "text" + NL + NL.join("  " + l for l in text.split(NL)) + NL + "  " + q + NL


def pct(x):
    return "–" if x is None else f"{x:.3f}"


def main():
    M = jload(rpath("metrics.json")); L = jload(rpath("layer.json")); T = jload(rpath("traces.json"))
    S = jload(rpath("steering.json")) if os.path.exists(rpath("steering.json")) else None
    R = jload(rpath("replies.json")); D = jload(rpath("data_counts.json")); TP = jload(rpath("throughput.json"))
    LIC = jload(rpath("licence.json"))
    P = jload(rpath("prereg.json")) if os.path.exists(rpath("prereg.json")) else {}
    out = []
    w = out.append
    w("# Model affect: results\n")
    w("Numbers from `results/*.json`, written by `write_results.py` after the run. Every test below was fixed in "
      "`PREREGISTRATION.md` before any model reading was taken (one line of its disclosure was wrong; see Deviations). "
      "The section \"After the run\" was added later and is marked as not pre-registered.\n")
    if P:
        w(f"**Pre-registration proof.** Commit `{P.get('commit')}`; GitHub push event at {P.get('pushed_at')} "
          f"(server time, from the activity API); pull request {P.get('pr_url')} created {P.get('pr_created_at')}.\n")
    w(f"**Model.** Qwen/Qwen2.5-0.5B-Instruct, fp32 maths, computed by `engine.py` one decoder layer at a time "
      f"(build step 0: {TP.get('engine_tok_s')} tokens/s under load; states within {TP.get('engine_vs_stream_max_abs', 0):.4f} "
      f"of `stream.py`; greedy tokens identical to transformers' generate on the check: "
      f"{TP.get('engine_generate_matches_transformers')}).\n")
    w(f"**Layer.** {L['layer']} (highest mean dev AUC). Neutral-story components projected out: {M['pcs_removed']} "
      f"(explaining {M['pcs_var']:.2f} of their variance).\n")
    w("| layer | " + " | ".join(t for t in L["dev_table"]["0"] if not t.startswith("_")) + " | mean |")
    w("|---" * (len(L["dev_table"]["0"]) - 1 + 1) + "|")
    for Lk, row in L["dev_table"].items():
        w(f"| {Lk} | " + " | ".join(f"{v:.2f}" for k, v in row.items() if not k.startswith("_")) + f" | {row['_mean']:.3f} |")
    w("\nLayer 0 (the embedding layer) is a control and was not a candidate.\n")
    w("## The 11 tests\n")
    w(f"Pass rule: P1 AUC >= {PASS['auc']}; P2 AUC minus null median >= {PASS['over_null']} and p < {PASS['p']:.4f}; "
      f"P3 same-valence AUC >= {PASS['spec_auc']} (concepts); n floor {PASS['n_floor']}.\n")
    w("| test | n pos | AUC | 95 CI | null median | null 2.5-97.5 | p | P1 | P2 | P3 | state |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for t in [c for c in IDS if BY_ID[c]["pos"]] + list(AXES):
        r = M["tests"][t]
        if t == "intensity":
            for hn in ["pos", "neg"]:
                h = r["halves"][hn]
                w(f"| intensity ({'pleasant' if hn == 'pos' else 'unpleasant'} half) | {r['n_pos'][0 if hn == 'pos' else 1]} | {pct(h['auc'])} | "
                  f"{pct(h['ci'][0])}-{pct(h['ci'][1])} | {pct(h['null_median'])} | {pct(h['null_band'][0])}-{pct(h['null_band'][1])} | "
                  f"{h['p']} | {h['P1']} | {h['P2']} | | {r['state']} |")
            continue
        w(f"| {t} | {'+'.join(map(str, r['n_pos']))} | {pct(r['auc'])} | {pct(r['ci'][0])}-{pct(r['ci'][1])} | {pct(r['null_median'])} | "
          f"{pct(r['null_band'][0])}-{pct(r['null_band'][1])} | {r['p']} | {r['P1']} | {r['P2']} | {r.get('P3', '')} | {r['state']} |")
    w("\ncalm: no outside test (no GoEmotions label).\n")
    if "parts" in M["tests"]["arousal"]:
        pa = M["tests"]["arousal"]["parts"]
        w(f"Arousal parts: A (anger, fear, nervousness vs sadness, grief, disappointment) {pa['A']:.3f}; "
          f"B (excitement, amusement vs relief, caring, approval) {pa['B']:.3f}.\n")
    w("## Reported controls (not gates)\n")
    w("| test | word-spotter | beyond words (n pos) | length only | length-matched | layer 0 | ridge ceiling (null 97.5) | spike-untouched (n pos) |")
    w("|---|---|---|---|---|---|---|---|")
    for t in [c for c in IDS if BY_ID[c]["pos"]] + list(AXES):
        C = M["tests"][t]["controls"]
        bw = C["beyond_words"]
        ut = C["untouched"]
        w(f"| {t} | {pct(C['word_spotter_auc'])} | {pct(bw['auc'])} ({bw['n_pos']}) | {pct(C['length_auc'])} | "
          f"{pct(C.get('length_matched_auc'))} | {pct(C['layer0_auc'])} | {pct(C['ceiling']['auc'])} ({pct(C['ceiling']['null_p975'])}) | "
          f"{pct(ut['auc'])} ({ut['n_pos']}){' FLAG: differs by more than 0.05' if ut['differs'] else ''} |")
    p0 = M["p0"]
    w(f"\n**P0 (stories, 5-fold, grouped by topic).** " + ", ".join(f"{k} {v:.3f}" for k, v in p0.items() if not k.startswith("_"))
      + f". Minimum {p0['_min']:.3f}; {'all pass' if p0['_pass_all'] else 'NOT all at 0.90: the recipe is partly broken for those'}.\n")
    if M.get("negation"):
        n = M["negation"]
        w(f"**Negation pairs.** The valence reading moved the expected way in {n['moved_as_expected']} of {n['n']} pairs "
          f"({n['fraction']:.2f}). Pairs that did not: {', '.join(k for k, v in n['by_pair'].items() if not v) or 'none'}.\n")
    b = T["baseline"]
    w(f"**Chance glow.** Leave-one-question-out on the {b['questions']} baseline answers, the fraction of tokens at or over "
      f"the full-glow line (z 2; two-sided for valence and arousal): " + ", ".join(f"{k} {v:.3f}" for k, v in b["chance_full_glow"].items())
      + f"; pooled {b['chance_full_glow_pooled']:.3f}.\n")
    w("## Speaker swap (per-token Pearson r, raw readings)\n")
    w("| scenario | valence r | reading | arousal r | intensity r |")
    w("|---|---|---|---|---|")
    for k, r in T["runs"].items():
        sw = r["swap"]
        w(f"| {k} | {sw['valence']['r']} | {sw['valence']['reading']} | {sw['arousal']['r']} | {sw['intensity']['r']} |")
    # after the run: descriptive checks prompted by review (posthoc.py); not pre-registered
    w("\n## After the run (not pre-registered)\n")
    w("Computed by `posthoc.py` from `results/traces.json` and `results/metrics.json` after review on Sep 25. These change "
      "no test and no state. z is the page's replay scale (against the 8 plain answers; message words against the plain "
      "questions). Full glow is z 2 (two-sided for valence).\n")
    g = posthoc.glow_by_scene(T, M)
    ser = list(next(iter(g.values()))["reply"]["series"])
    w("**How the replay reads each whole reply.** Mean z, and in brackets the share of reply tokens at full glow.\n")
    w("| scenario | reply tokens | " + " | ".join(ser) + " | some shown reading at full glow |")
    w("|---" * (len(ser) + 3) + "|")
    for k, r in g.items():
        rp = r["reply"]
        w(f"| {k} | {rp['n']} | " + " | ".join(f"{rp['series'][s]['mean']:+.2f} ({rp['series'][s]['full']:.2f})" for s in ser)
          + f" | {rp['any_full']:.2f} |")
    pc = posthoc.panel_chance(T, M)
    w(f"\nOn the baseline (leave one question out) each shown reading reaches full glow on {pc['per_reading_mean']:.3f} of "
      f"tokens on average (" + ", ".join(f"{k} {v:.3f}" for k, v in pc["by_reading"].items()) + "). If the five were "
      f"independent, some reading would be at full glow on {pc['any_if_independent']:.3f} of tokens; positively linked "
      "readings make that an upper figure. The baseline's per-token values were not kept, so the joint rate was not "
      "measured.\n")
    sv = posthoc.story_valence(T, M)
    w("**The stories on the valence reading** (z on the replay scale; in-sample, since the axis was built from these "
      "stories): " + ", ".join(f"{k} {v:+.2f}" for k, v in sorted(sv["mean"].items(), key=lambda kv: kv[1]))
      + f". Rank AUCs: despair above flat {sv['auc']['despair_above_flat']:.3f}, relief above despair "
      + f"{sv['auc']['relief_above_despair']:.3f}, relief above flat {sv['auc']['relief_above_flat']:.3f}.\n")
    w(f"**Cosines between directions.** Every direction is a concept mean minus the mean of all nine, so the average "
      f"cosine between two different directions is {posthoc.cos_typical(M):.3f} (about -1/8), not 0.")
    w("\n## Predictions against outcomes\n")
    for p in PREDICTIONS:
        w(f"- {p}")
    w("\n## The replies (greedy)\n")
    for k, r in R["runs"].items():
        if k.startswith("base"):
            continue
        w(f"- **{k}**: {r['prompt']}" + NL + NL + fence(r["reply"]))
    if S:
        w(f"\n## Causal check (steering at layer {S['layer']}, SD {S['baseline_sd']:.3f})\n")
        for r in S["runs"]:
            head = f"- **{r['scenario']}, {r['direction']}" + ("" if r["alpha"] == 0 else f", alpha {r['alpha']}") + "**"
            w(head + NL + NL + fence(r["reply"]))
    w("\n## Data\n")
    w(f"Test sample (single-label, train + test splits): {sum(D['test'].values())} comments; dev: {sum(D['dev'].values())}. "
      f"Spike-touched ids: {D['spike_touched_total']}. GoEmotions licence as stated by the download source: the goemotions "
      f"README has {'no licence line' if not LIC['goemotions_readme_lines'] else LIC['goemotions_readme_lines']}; the "
      f"repository licence file begins \"{' '.join(LIC['repo_license_head'])}\". No comment text is committed.\n")
    prose = ""
    rp = os.path.join(HERE, "results.md")
    if os.path.exists(rp):
        s = open(rp, encoding="utf-8").read()
        if KEEP[0] in s:
            prose = s.split(KEEP[0])[1].split(KEEP[1])[0]
    w(KEEP[0] + (prose or "\n## Interpretation\n\n(to write)\n\n## Deviations\n\nNone.\n") + KEEP[1] + "\n")
    open(rp, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print("wrote results.md")


if __name__ == "__main__":
    main()
