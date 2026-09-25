# -*- coding: utf-8 -*-
"""Generate grammars/sources-of-alignment/grammar.json, the Sources meta-grammar.

    python scripts/build_sources_grammar.py              write it in place
    python scripts/build_sources_grammar.py --out DIR    write DIR/grammars/sources-of-alignment/grammar.json
                                                         (check_all --check diffs that against the repo)

A generated projection, like recursive-tarot's people-of-tarot (scripts/build_people_grammar.py
there): never hand-edit the grammar; change the inputs and re-run.

Inputs (all in this repo, so CI can rebuild without the private research repo):
  research/lab-export/sources.json    shows, episodes, people, papers (scripts/lab_export.py)
  research/lab-export/ideas.json      term labels, for the "terms that come up" links
  grammars/institutions-of-alignment/grammar.json   OPTIONAL: when it exists, the Institutions suit
                                      is one pointer stub per institution (its card lives there,
                                      once). Build order: institutions first, then this.

Shape (levels as the viewers compute them):
  root-sources (4)
    suit-podcasts (3)  -> show-<key> (2)            -> ep-<show>-<date>-<guest> (1)
    suit-people (3)    -> people-hosts / -guests / -others (2) -> person-<id> (1)
    suit-papers (3)    -> thread-<id> (2)           -> paper-<id> (1)
    suit-institutions (3) -> the institutions grammar's groups (2) -> inst-<id> (1)   [optional]
Every item under a suit carries metadata.suit (the map's `#groupby=suit`).

Cross-links follow the one pattern (metadata.source_deck + source_item_id + deck) and only the
institution stubs use it: cards.html hides a pill whose source_deck is the grammar being viewed
(viewers/cards.html, `showSourceRef`), so links inside this grammar (a person's appearances, an
episode's guests) and to Ideas are markdown links to the card in the viewer instead. No
metadata.url, no metadata.youtube_url, no section named Link or URL (whole-card redirects).
Python standard library only.
"""
import argparse, collections, hashlib, json, re, sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SLUG = "sources-of-alignment"
OUT_REL = f"grammars/{SLUG}/grammar.json"
INPUTS = ["research/lab-export/sources.json", "research/lab-export/ideas.json"]
INSTITUTIONS = "grammars/institutions-of-alignment/grammar.json"
IDEAS = "ideas-of-alignment"

SUIT = {"podcasts": "Podcasts", "people": "People", "papers": "Papers & books", "institutions": "Institutions"}


# ------------------------------------------------------------------------------------------------
def inputs_sha256(paths):
    """sha256 over the inputs, in sorted path order: path, NUL, bytes, NUL. Never a date."""
    h = hashlib.sha256()
    for p in sorted(paths):
        h.update(p.encode("utf-8") + b"\0" + (ROOT / p).read_bytes() + b"\0")
    return h.hexdigest()


def md_text(s):
    """Text safe inside a markdown link label (the viewers' mdToHtml)."""
    return re.sub(r"\s+", " ", str(s)).replace("[", "(").replace("]", ")").replace("*", "").replace("`", "'").strip()


def md_url(u):
    return u.replace("(", "%28").replace(")", "%29").replace(" ", "%20")


def ext(label, url):
    return f"[{md_text(label)}]({md_url(url)})"


def card(slug, item_id, label):
    """A link to a card, relative to /viewers/ (every viewer lives there)."""
    return f"[{md_text(label)}](cards.html?src=../grammars/{slug}/grammar.json&item={item_id})"


def person_id(w):
    return "person-" + w.replace("_", "-")


def link_ok(check):
    return not check or int(check.split()[0]) in (200, 202, 401, 403)


def ytw(v):
    return f"https://www.youtube.com/watch?v={v}"


def years_span(ys):
    ys = sorted(ys)
    return ys[0] if len(set(ys)) == 1 else f"{ys[0]} to {ys[-1]}"


# ------------------------------------------------------------------------------------------------
def build():
    S = json.loads((ROOT / INPUTS[0]).read_text(encoding="utf-8"))
    I = json.loads((ROOT / INPUTS[1]).read_text(encoding="utf-8"))
    checks = S.get("link_checks") or {}
    ok = lambda u: link_ok(checks.get(u))
    term_label = {t["id"]: t["label"] for t in I["terms"]}
    shows = {s["id"]: s for s in S["shows"]}
    people = {p["id"]: p for p in S["people"]}
    name = lambda w: people[w]["name"] if w in people else w.replace("_", " ").title()
    eps_by_show = collections.defaultdict(list)
    for e in S["episodes"]:
        eps_by_show[e["show"]].append(e)
    appearances = collections.defaultdict(list)
    for e in S["episodes"]:
        for g in e["guests"]:
            appearances[g].append(e)
    inputs = list(INPUTS)
    items = []
    order = [0]

    def add(it):
        order[0] += 1
        it["sort_order"] = order[0]
        items.append(it)
        return it["id"]

    # ---------------------------------------------------------------- podcasts
    show_ids = []
    captioned = sum(1 for e in S["episodes"] if e["captioned"])
    for s in sorted(S["shows"], key=lambda s: s["name"].lower()):
        eps = sorted(eps_by_show[s["id"]], key=lambda e: (e["date"], e["id"]))
        ep_ids = []
        for e in eps:
            guest_links = ", ".join(card(SLUG, person_id(g), name(g)) for g in e["guests"])
            listen = [f"- {ext('The episode page', e['episode_url'])}"] if ok(e["episode_url"]) else []
            if e["video_id"] and ok(ytw(e["video_id"])):
                listen.append(f"- {ext('On YouTube', ytw(e['video_id']))}")
                if e.get("match_note"):
                    listen.append(f"- How the video was matched to the episode: {e['match_note']}.")
            else:
                listen.append(f"- YouTube: {e['video_status']}.")
            if e["captioned"] and e["top_terms"]:
                terms = ["Counted in the automatic captions; the speaker is unknown and may be the host."]
                terms += [f"- {card(IDEAS, t, term_label.get(t, t))}: {n}" for t, n in e["top_terms"]]
                terms_md = "\n".join(terms)
            elif e["captioned"]:
                terms_md = "None of the seed terms comes up in the automatic captions."
            elif e["video_id"]:
                terms_md = "No automatic captions could be fetched for this video, so it has no counts yet."
            else:
                terms_md = "No public video with captions, so this episode has no counts."
            gnames = ", ".join(name(g) for g in e["guests"])
            meta = {"kind": "episode", "suit": SUIT["podcasts"], "show": s["name"], "year": e["date"][:4],
                    "guests": [name(g) for g in e["guests"]]}
            if e["video_id"]:
                meta["youtube_video_id"] = e["video_id"]
            ep_ids.append(add({
                "id": e["id"], "name": e["title"], "level": 1,
                "description": f"{s['name']} · {e['date']} · with {gnames}",
                "metadata": meta,
                "sections": {
                    "Episode": f"**{md_text(s['name'])}**, {e['date']}.\n\nWith {guest_links}.",
                    "Where to listen": "\n".join(listen),
                    "Terms that come up": terms_md,
                },
            }))
        host_links = " and ".join(card(SLUG, person_id(h), name(h)) for h in s["hosts"])
        span = years_span([e["date"][:4] for e in eps])
        about = [f"Hosted by {host_links}. {len(eps)} episode{'s' if len(eps) != 1 else ''} in this set, {span}."]
        if ok(s["url"]):
            about.append(ext("The show's own page", s["url"]))
        show_ids.append(add({
            "id": _show_id(s["id"]),
            "name": s["name"], "level": 2,
            "description": f"Hosted by {', '.join(name(h) for h in s['hosts'])} · {len(eps)} episodes, {span}",
            "metadata": {"kind": "podcast", "suit": SUIT["podcasts"], "show": s["name"]},
            "composite_of": ep_ids,
            "sections": {"The show": "\n\n".join(about)},
        }))
    n_eps, n_app = len(S["episodes"]), sum(len(e["guests"]) for e in S["episodes"])
    suit_podcasts = add({
        "id": "suit-podcasts", "name": "Podcasts", "level": 3,
        "description": f"{n_eps} episodes of seven podcasts, with where to listen and the terms that come up.",
        "metadata": {"kind": "suit", "suit": SUIT["podcasts"]},
        "composite_of": show_ids,
        "sections": {
            "What it is": (f"{n_eps} episodes of seven podcasts ({n_app} appearances) in which people from the lab's "
                           f"who's-who speak about AI. Each card gives the show, the date, the guests, where to listen "
                           f"and, for the {captioned} episodes with automatic captions, the seed terms that come up most."),
            "How it was chosen": ("The episodes follow the lab's who's-who list of people, which leans towards people "
                                  "at AI labs, so this is a sample, not a survey. Videos were matched to episodes by "
                                  "upload date on each show's official channel; fan uploads were left out. Members-only "
                                  "episodes are listed without counts."),
        },
    })

    # ---------------------------------------------------------------- people
    groups = {"hosts": [], "guests": [], "others": []}
    for p in S["people"]:
        pidd = person_id(p["id"])
        apps = sorted(appearances.get(p["id"], []), key=lambda e: (e["date"], e["id"]))
        sec = {"Role": f"{p['role']}\n\n*From {p['role_source']}.*"}
        lines = []
        for sid in p["hosts"]:
            lines.append(f"- Hosts {card(SLUG, _show_id(sid), shows[sid]['name'])}")
        for e in apps:
            lines.append(f"- {e['date']} · {md_text(shows[e['show']]['name'])} · {card(SLUG, e['id'], e['title'])}")
        if lines:
            sec["Appearances"] = "\n".join(lines)
        if p["affiliations"]:
            aff = []
            for a in sorted(p["affiliations"], key=lambda a: (a["start"] or 0, a["org"])):
                span = ("since " + str(a["start"])) if a["start"] and not a["end"] else \
                       (f"{a['start']}-{a['end']}" if a["start"] and a["end"] else (f"until {a['end']}" if a["end"] else ""))
                aff.append(f"- {md_text(a['title'])}, {md_text(a['org'])}" + (f" ({span})" if span else ""))
            sec["Affiliations"] = "\n".join(aff) + "\n\n*From the lab's who's-who (Sep 23 2026).*"
        else_ = [f"- {ext(l['title'], l['url'])}" for l in p["elsewhere"] if ok(l["url"])]
        if else_:
            sec["Also heard on"] = "\n".join(else_)
        shows_of = sorted({shows[e["show"]]["name"] for e in apps} | {shows[s]["name"] for s in p["hosts"]})
        grp = "hosts" if p["hosts"] else ("guests" if apps else "others")
        groups[grp].append(add({
            "id": pidd, "name": p["name"], "level": 1,
            "description": p["role"],
            "metadata": {"kind": "person", "suit": SUIT["people"], "show": shows_of},
            "sections": sec,
        }))
    group_meta = [
        ("people-hosts", "Hosts", "hosts", "The hosts of the seven shows. The automatic captions carry no speaker names, so a counted term may be theirs."),
        ("people-guests", "Guests", "guests", "The people from the lab's who's-who who appear as guests in these episodes."),
        ("people-others", "Also in the lab's notes", "others", "People the lab's research follows who do not appear on the seven shows."),
    ]
    people_groups = []
    for gid, gname, key, about in group_meta:
        if not groups[key]:
            continue
        people_groups.append(add({
            "id": gid, "name": gname, "level": 2,
            "description": f"{len(groups[key])} people",
            "metadata": {"kind": "group", "suit": SUIT["people"]},
            "composite_of": groups[key],
            "sections": {"Who is here": about},
        }))
    suit_people = add({
        "id": "suit-people", "name": "People", "level": 3,
        "description": f"{len(S['people'])} people: who appears where, with roles and affiliations.",
        "metadata": {"kind": "suit", "suit": SUIT["people"]},
        "composite_of": people_groups,
        "sections": {
            "What it is": ("Who appears where: the hosts and guests of the seven shows, and one more person the lab's "
                           "research follows. Each card gives a role in one line, the appearances and the "
                           "affiliations, dated."),
            "How they are described": ("Roles are titles and affiliations only, from the lab's who's-who and players "
                                       "ledger (Sep 23 2026). No one here is labelled by a stance, scored or ranked; "
                                       "the arguments are in the episodes."),
        },
    })

    # ---------------------------------------------------------------- papers
    thread_ids = []
    by_thread = collections.defaultdict(list)
    for x in S["papers"]:
        by_thread[x["thread"]].append(x)
    for t in S["threads"]:
        ids = []
        for x in sorted(by_thread[t["id"]], key=lambda x: (x["year"], x["id"])):
            where = []
            if ok(x["url"]):
                where.append(f"- {ext(_where_label(x), x['url'])}")
            if x["doi"] and not x["url"].startswith("https://doi.org/"):
                where.append(f"- DOI {ext(x['doi'], 'https://doi.org/' + x['doi'])}")
            sec = {
                "What it is": x["about"],
                "Why the lab cites it": f"{x['used_for']} Cited in {x['cited_in']}.",
            }
            if x["reading_check"]:
                sec["Reading check"] = x["reading_check"]
            sec["Where to read it"] = "\n".join(where)
            authors = ", ".join(x["authors"])
            ids.append(add({
                "id": "paper-" + x["id"], "name": x["title"], "level": 1,
                "description": f"{authors} ({x['year']}). {x['venue']}.",
                "metadata": {"kind": x["kind"], "suit": SUIT["papers"], "thread": t["name"], "year": str(x["year"]),
                             "author": authors},
                "sections": sec,
            }))
        if ids:
            thread_ids.append(add({
                "id": t["id"], "name": t["name"], "level": 2,
                "description": f"{len(ids)} entries",
                "metadata": {"kind": "group", "suit": SUIT["papers"]},
                "composite_of": ids,
                "sections": {"What it gathers": t["about"]},
            }))
    suit_papers = add({
        "id": "suit-papers", "name": "Papers & books", "level": 3,
        "description": f"{len(S['papers'])} papers, books, reports and statements cited in the lab's plans.",
        "metadata": {"kind": "suit", "suit": SUIT["papers"]},
        "composite_of": thread_ids,
        "sections": {
            "What it is": ("The papers, books, reports and public statements the lab's plans cite, grouped by the "
                           "question they were read for. Each card says what the work is, why the lab cites it and, "
                           "where the lab checked its reading against the source, what that check found."),
            "How the links were checked": ("Every link was fetched on Sep 25 2026. Where a publisher's page refuses "
                                           "scripts, the card links the DOI, and the DOI was checked with Crossref."),
        },
    })

    suits = [suit_podcasts, suit_papers, suit_people]

    # ---------------------------------------------------------------- institutions (optional)
    ip = ROOT / INSTITUTIONS
    if ip.exists():
        inputs.append(INSTITUTIONS)
        suits.append(_institution_stubs(json.loads(ip.read_text(encoding="utf-8")), add))
    else:
        print(f"  note: {INSTITUTIONS} is not there yet; the Institutions suit is left out until it is "
              f"(rebuild this grammar after it lands)")

    add({
        "id": "root-sources", "name": "Sources", "level": 4,
        "description": "Podcasts, papers and people behind the words and the games, each described from public pages and dated.",
        "metadata": {"kind": "root"},
        "composite_of": suits,
        "sections": {
            "What it is": ("The record behind Recursive Eco-Improvement: what was said, where and when. Podcast "
                           "episodes where people in the AI debate speak, the papers and books the lab's plans cite, "
                           "and the people themselves" + (", with the institutions working on alignment." if len(suits) > 3 else ".")),
            "How to read it": ("Listing is not endorsement, and nothing here is ranked. Counts of terms come from "
                               "automatic captions, so the speaker is unknown. What the lab makes of the sources is "
                               "kept apart, in the Ideas grammar."),
        },
    })
    # root last in the file keeps the leaves first in the viewers' default order
    return items, inputs


def _show_id(pod_id):
    return "show-" + {"pod_lex": "lex", "pod_dwarkesh": "dwarkesh", "pod_ms": "making-sense", "pod_80k": "80000-hours",
                      "pod_doac": "diary-of-a-ceo", "pod_ezra": "ezra-klein",
                      "pod_yua": "your-undivided-attention"}.get(pod_id, pod_id.replace("_", "-"))


def _where_label(x):
    u = x["url"]
    if u.startswith("https://doi.org/"):
        return "DOI " + x["doi"]
    if "arxiv.org" in u:
        return "arXiv"
    if "wikipedia.org" in u:
        return "An overview (Wikipedia)"
    if "fee.org" in u:
        return "A review of the book (FEE)"
    if u.endswith(".pdf"):
        return "The PDF"
    return "Its own page"


def _institution_stubs(G, add):
    """One pointer stub per institution card in institutions-of-alignment (the card lives there)."""
    its = G.get("items") or []
    by_id = {i["id"]: i for i in its}
    leaves = [i for i in its if not i.get("composite_of") and (i.get("metadata") or {}).get("url")]
    leaf_ids = {i["id"] for i in leaves}
    deck = re.split(r"\s[—–-]\s", G.get("name") or "Institutions")[0].strip() or "Institutions"
    groups = [i for i in its if i.get("composite_of") and all(c in leaf_ids for c in i["composite_of"])]
    if not groups:
        groups = [{"id": "all", "name": "Institutions", "composite_of": [i["id"] for i in leaves]}]

    def stub(inst):
        return add({
            "id": "inst-" + inst["id"], "name": inst["name"], "level": 1,
            "description": "A pointer: this institution's card lives in the Institutions grammar.",
            "metadata": {"kind": "pointer", "suit": SUIT["institutions"],
                         "source_deck": "institutions-of-alignment", "source_item_id": inst["id"], "deck": deck},
            "sections": {"Where it lives": ("Its own card, in its own words and with a link to its site, is in the "
                                            "Institutions grammar; it opens below.")},
        })
    gids = []
    for g in groups:
        kids = [stub(by_id[c]) for c in g["composite_of"] if c in by_id]
        if not kids:
            continue
        gids.append(add({
            "id": "inst-group-" + g["id"], "name": g["name"], "level": 2,
            "description": f"{len(kids)} institutions",
            "metadata": {"kind": "group", "suit": SUIT["institutions"]},
            "composite_of": kids,
            "sections": {"What it gathers": f"Pointers to {len(kids)} cards in the Institutions grammar."},
        }))
    return add({
        "id": "suit-institutions", "name": "Institutions", "level": 3,
        "description": "Pointers to the Institutions grammar, where each card links out to the institution's own site.",
        "metadata": {"kind": "suit", "suit": SUIT["institutions"]},
        "composite_of": gids,
        "sections": {"What it is": ("Organisations working on alignment. Each one's card lives once, in the "
                                    "Institutions grammar; these are pointers to it.")},
    })


def grammar(items, inputs):
    return {
        "_grammar_commons": {
            "schema_version": "1.0", "license": "CC-BY-SA-4.0",
            "attribution": [{"name": "PlayfulProcess",
                             "note": "Generated from the lab's research (recursive-transcripts) through research/lab-export/sources.json."}],
        },
        "name": "Sources — the record behind the words",
        "slug": SLUG,
        "grammar_type": "custom",
        "creator_name": "PlayfulProcess",
        "creator_link": "https://recursive.eco",
        "default_view": "tree",
        "default_preview": "tree",
        "provenance": "record",
        "_generated": True,
        "_do_not_hand_edit": True,
        "_built_by": "scripts/build_sources_grammar.py",
        "_source_of_truth": "research/lab-export/sources.json (written by scripts/lab_export.py from the lab's research)",
        "_inputs": sorted(inputs),
        "_inputs_sha256": inputs_sha256(inputs),
        "description": ("The record behind Recursive Eco-Improvement: podcast episodes in which people in the AI "
                        "debate speak, with where to listen and the terms that come up; the papers, books and "
                        "statements the lab's plans cite; and the people, by role and affiliation. Described from "
                        "public pages and dated. Listing is not endorsement, and nothing is ranked. Term counts come "
                        "from automatic captions, so the speaker is unknown."),
        "tags": ["sources", "podcasts", "papers", "people", "alignment", "ai"],
        "is_published": True,
        "items": items,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT), help="write <out>/" + OUT_REL + " (default: the repo)")
    a = ap.parse_args()
    items, inputs = build()
    g = grammar(items, inputs)
    ids = [i["id"] for i in items]
    dup = [k for k, n in collections.Counter(ids).items() if n > 1]
    if dup:
        raise SystemExit(f"duplicate item ids: {dup}")
    out = Path(a.out) / OUT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes((json.dumps(g, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    kinds = collections.Counter((i.get("metadata") or {}).get("kind") for i in items)
    print(f"{SLUG}: {len(items)} items {dict(kinds)} -> {out}")


if __name__ == "__main__":
    main()
