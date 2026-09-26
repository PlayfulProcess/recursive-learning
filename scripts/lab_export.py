# -*- coding: utf-8 -*-
"""Export the lab's AI-map research into research/lab-export/, the public inputs of the Sources
and Ideas grammars.

    python scripts/lab_export.py --repo PATH/TO/recursive-transcripts               re-export
    python scripts/lab_export.py --repo PATH/TO/recursive-transcripts --check-links  ... and re-check every link

WHY THIS EXISTS. The research lives in the PRIVATE repo PlayfulProcess/recursive-transcripts
(ai-map/ on the branch ai-map-sep24; players/ on main). This repo is public, and every pushed
branch is public too. So nothing is copied across as-is: each record here is built field by field
from ALLOWED_KEYS below, and the export fails if anything else slips in. Left out on purpose:
  - every transcript line (mentions.json `sentence` / `match`): only derived counts cross over;
  - stance labels and their justifications, the film-cast flags, recursive_grammar_id,
    searched_none_found, edge notes (whoswho.json);
  - the players ledger's portraits, beliefs, gaps, scores and fit with the writer's positions
    (players.json): only the name and a trimmed role line (titles only) are used;
  - members-only episodes get no counts (PRIORITIES #14), and the lore layer is not a section
    (PRIORITIES #25 parked it; the lore terms stay in their genealogy lanes);
  - any quotation of more than 20 words (the export stops if one appears).

It reads the private repo with `git show <ref>:<path>` only (no checkout, no writes there).
The builders (scripts/build_sources_grammar.py, scripts/build_ideas_grammar.py) read only the
files written here, so CI can rebuild the grammars without the private repo.

Links: `--check-links` fetches every URL the grammars publish (HEAD, then GET, with a browser
user agent; DOIs through the Crossref API, because publisher pages answer 403 to scripts;
YouTube through oEmbed, where 401 means "exists, embedding off"). Without the flag the previous
results are carried over from the existing export, so a re-export is byte-identical.

Curation (the recursive-iching pattern: the curated lists live in this script):
  PAPERS / THREADS   the papers, books, reports and statements cited in the lab's plans
                     (plans/**/*.md and film-plan-v3.md), each link checked
  PLAYER_ROLES       role lines for the seven people of the players ledger, trimmed to titles
  TERM_MILESTONE     a seed term -> the genealogy milestone whose title or summary names it
  SUMMARY_OVERRIDE   a milestone summary that quotes more than 20 words is replaced by the
                     genealogy's own paraphrase (risk_notes)
Python standard library only.
"""
import argparse, collections, datetime, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request, urllib.error

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "research" / "lab-export"

# ------------------------------------------------------------------------------------------------
# The allow-list. scripts/check_all.py (privacy) reads this dict with ast.literal_eval and fails if
# any record in research/lab-export/*.json has keys other than these for its `kind`.
ALLOWED_KEYS = {
    # sources.json
    "show":        ["kind", "id", "name", "url", "hosts"],
    "episode":     ["kind", "id", "show", "date", "title", "guests", "episode_url", "video_id",
                    "video_status", "match_note", "captioned", "top_terms"],
    "person":      ["kind", "id", "name", "role", "role_source", "hosts", "affiliations", "elsewhere"],
    "affiliation": ["kind", "org", "title", "start", "end"],
    "link":        ["kind", "title", "url"],
    "thread":      ["kind", "id", "name", "about"],
    "paper":       ["kind", "id", "title", "authors", "year", "venue", "url", "doi", "thread",
                    "cited_in", "about", "used_for", "reading_check"],
    "book":        ["kind", "id", "title", "authors", "year", "venue", "url", "doi", "thread",
                    "cited_in", "about", "used_for", "reading_check"],
    "report":      ["kind", "id", "title", "authors", "year", "venue", "url", "doi", "thread",
                    "cited_in", "about", "used_for", "reading_check"],
    "statement":   ["kind", "id", "title", "authors", "year", "venue", "url", "doi", "thread",
                    "cited_in", "about", "used_for", "reading_check"],
    # ideas.json
    "lane":        ["kind", "id", "name", "short", "start", "parent", "summary", "heading", "people", "sources"],
    "term":        ["kind", "id", "label", "lane", "layer", "precision", "spotcheck", "mentions",
                    "episodes", "first", "by_year", "top_people", "alongside", "milestone", "outcome"],
    "milestone":   ["kind", "id", "year", "lane", "title", "summary", "people", "sources"],
    "outcome":     ["kind", "id", "if_controllable", "verdict"],
}

PRIVATE_KEY = re.compile(r"^(stance.*|.*owner_film.*|writer_.*|fit_with_.*|sentence|consistency|"
                         r"recursive_grammar_id|searched_none_found|match|portrait|beliefs|gaps|note)$")

# ------------------------------------------------------------------------------------------------
SHOW_KEY = {  # whoswho podcast id -> short key used in item ids
    "pod_lex": "lex", "pod_dwarkesh": "dwarkesh", "pod_ms": "making-sense", "pod_80k": "80000-hours",
    "pod_doac": "diary-of-a-ceo", "pod_ezra": "ezra-klein", "pod_yua": "your-undivided-attention",
}

VIDEO_STATUS = [  # (match_note pattern, status) for appearances without a public video
    (r"members-only", "members-only on YouTube, left out for now"),
    (r"not on the official channel", "not on the show's official YouTube channel"),
    (r"fan upload", "only fan uploads found, left out"),
    (r"not found on YouTube", "not found on YouTube"),
]

# The seven people of the players ledger: the ledger's role line, trimmed to titles (its
# disclosure sentence, and clauses that are not a role, are left out). Dated by the ledger.
PLAYER_ROLES = {
    "dario_amodei": "Co-founder and CEO of Anthropic (since 2021); formerly VP of Research at OpenAI.",
    "ilya_sutskever": "Co-founder and former chief scientist of OpenAI (2015-2024); co-founder of Safe "
                      "Superintelligence Inc. (June 2024) and its CEO since July 2025.",
    "sam_altman": "Co-founder and CEO of OpenAI (CEO since 2019); former president of Y Combinator.",
    "elon_musk": "Co-founder and early funder of OpenAI (2015-2018); founder of xAI (2023); CEO of Tesla and SpaceX.",
    "tristan_harris": "Co-founder and president of the Center for Humane Technology; former design ethicist at Google.",
    "cameron_berg": "Founder and director of Reciprocal Research, a nonprofit on AI cognition and consciousness "
                    "(2026); formerly Research Director at AE Studio.",
    "demis_hassabis": "Co-founder of DeepMind (2010); Chair of Google DeepMind and Chief Scientist at Alphabet "
                      "(since Aug 2026); leads Isomorphic Labs.",
}
PLAYER_NAMES = {"dario": "dario_amodei", "ilya": "ilya_sutskever", "altman": "sam_altman", "musk": "elon_musk",
                "harris": "tristan_harris", "berg": "cameron_berg", "hassabis": "demis_hassabis"}
# who's-who affiliation rows that are a remark, not a role
AFFILIATION_SKIP = {("demis_hassabis", "google")}
# Role lines the composer words awkwardly (a title that repeats its organisation, a lab name used
# for a whole company). Re-worded from the same who's-who rows; no new facts.
ROLE_OVERRIDE = {
    "francois_chollet": "Co-founder of Ndea and the ARC Prize (since 2024); formerly engineer at Google and creator of Keras (2015-2024).",
    "yuval_harari": "Historian, Hebrew University of Jerusalem.",
    "stuart_russell": "Professor, UC Berkeley (since 1986); founder of CHAI, the Center for Human-Compatible AI (2016).",
    "yoshua_bengio": "Professor and founder of Mila, Université de Montréal (since 1993); founder of LawZero (since 2025).",
    "mark_zuckerberg": "Founder and CEO of Meta (since 2004).",
    "mo_gawdat": "Formerly Chief Business Officer of Google X (2013-2018).",
    "nick_bostrom": "Formerly founding director of the Future of Humanity Institute, Oxford (2005-2024).",
    "toby_ord": "Senior researcher, AI Governance Initiative, Oxford.",
    "carl_shulman": "Research associate, Future of Humanity Institute, Oxford; advisor, Open Philanthropy.",
    "rob_wiblin": "Host of the 80,000 Hours Podcast; head of research at 80,000 Hours.",
    "mustafa_suleyman": "CEO of Microsoft AI (since 2024); formerly co-founder and CEO of Inflection AI (2022-2024); co-founder of DeepMind (2010).",
    "leopold_aschenbrenner": "Formerly on the Superalignment team at OpenAI (2023-2024).",
}

# ------------------------------------------------------------------------------------------------
# Papers, books, reports and statements cited in the lab's plans. Every url was fetched; where a
# publisher answers 403 to scripts the DOI link is used and the DOI checked with Crossref.
THREADS = [
    ("thread-commons", "Governing a commons",
     "How shared resources are governed without a state or a market. Cited in the value-lab literature review (Sep 19 2026)."),
    ("thread-cybernetics", "Cybernetics and feedback",
     "Feedback, regulation and the observer inside the system. Cited in the value-lab literature review (Sep 19 2026)."),
    ("thread-empathy", "Empathy and self-recognition in animals",
     "How helping, empathy and self-recognition are tested in non-human minds, with the studies that question them. Cited in the value-lab literature review (Sep 19 2026)."),
    ("thread-cooperation", "Cooperation and social learning",
     "How cooperation evolves, and how agents learn from each other. Cited in the value-lab literature review (Sep 19 2026)."),
    ("thread-money", "The money: bubbles and who gains",
     "The cost of the AI buildout and what earlier booms suggest. Cited in the film plan (v3), in the section on what slowing down would cost."),
    ("thread-2026", "Incidents and statements, 2026",
     "Recent primary documents the lab's notes check figures against (Sep 24 2026)."),
]
LIT = "the value-lab literature review (Sep 19 2026)"
PAPERS = [
    # kind, id, title, authors, year, venue, url, doi, thread, cited_in, about, used_for, reading_check
    ("book", "ostrom-1990", "Governing the Commons", ["Elinor Ostrom"], 1990, "Cambridge University Press",
     "https://www.cambridge.org/core/books/governing-the-commons/7AB7AE11BADA84409C34815CC288CD79", None,
     "thread-commons", LIT,
     "A study of communities that sustain shared resources through their own institutions, and the design principles those institutions share.",
     "Grounds the monitoring and graduated sanctions in the value-lab's commons model, and names what the model leaves out.",
     None),
    ("paper", "carlisle-gruby-2019", "Polycentric Systems of Governance: A Theoretical Model for the Commons",
     ["Keith Carlisle", "Rebecca L. Gruby"], 2019, "Policy Studies Journal",
     "https://doi.org/10.1111/psj.12212", "10.1111/psj.12212", "thread-commons", LIT,
     "A model of governance by many semi-autonomous decision centres rather than one.",
     "Relevant if a later value-lab milestone adds different institutions instead of one global rule.",
     None),
    ("paper", "perolat-2017", "A multi-agent reinforcement learning model of common-pool resource appropriation",
     ["Julien Perolat", "Joel Z. Leibo", "Vinicius Zambaldi", "Charles Beattie", "Karl Tuyls", "Thore Graepel"],
     2017, "NeurIPS 2017 (arXiv 1707.06600)", "https://arxiv.org/abs/1707.06600", None, "thread-commons", LIT,
     "Self-interested deep reinforcement-learning agents in a simulated commons, and how exclusion, sustainability and inequality trade off.",
     "The nearest computational cousin of the value-lab model: a thing to compare against.",
     "Checked against the source by the lab on Sep 20 2026: the summary was confirmed."),
    ("book", "bateson-1972", "Steps to an Ecology of Mind", ["Gregory Bateson"], 1972, "essay collection",
     "https://en.wikipedia.org/wiki/Steps_to_an_Ecology_of_Mind", None, "thread-cybernetics", LIT,
     "Essays in which mind is treated as a relational process of difference and feedback, spread across an organism and its environment.",
     "Part of the case for rules that sense and close a gap, rather than fixed settings, in the value-lab's redesign.",
     "The lab cites an overview (Wikipedia), not the book itself."),
    ("book", "ashby-1956", "An Introduction to Cybernetics", ["W. Ross Ashby"], 1956, "book",
     "https://en.wikipedia.org/wiki/An_Introduction_to_Cybernetics", None, "thread-cybernetics", LIT,
     "The source of the law of requisite variety: a regulator needs at least as much variety as the disturbances it has to absorb.",
     "Why a single extraction dial may be unable to regulate a shocked, nonlinear commons.",
     "The lab cites an overview (Wikipedia), not the book itself."),
    ("paper", "scott-2004", "Second-order cybernetics: an historical introduction", ["Bernard Scott"], 2004, "Kybernetes",
     "https://doi.org/10.1108/03684920410556007", "10.1108/03684920410556007", "thread-cybernetics", LIT,
     "A history of second-order cybernetics, in which the observer is part of the system observed.",
     "Grounding for treating introspection as a specification of the model rather than as evidence.",
     "The lab's plan calls this von Foerster's own framing; Crossref lists Bernard Scott as the author (checked Sep 25 2026)."),
    ("paper", "bartal-2011", "Empathy and Pro-Social Behavior in Rats", ["Inbal Ben-Ami Bartal", "Jean Decety", "Peggy Mason"],
     2011, "Science", "https://doi.org/10.1126/science.1210789", "10.1126/science.1210789", "thread-empathy", LIT,
     "Free rats learned to open a restrainer holding a distressed cagemate, measured by behaviour rather than report.",
     "A method to borrow: measure what an agent does, not what it says about itself.",
     "Checked against the source by the lab on Sep 20 2026 and corrected: the rats shared chocolate in about half of trials (52%, 61% by days 6 to 12), not as a consistent majority."),
    ("paper", "bartal-2014", "Pro-social behavior in rats is modulated by social experience",
     ["Inbal Ben-Ami Bartal", "David A. Rodgers", "Maria Sol Bernardez Sarria", "Jean Decety", "Peggy Mason"],
     2014, "eLife", "https://elifesciences.org/articles/01385", "10.7554/eLife.01385", "thread-empathy", LIT,
     "Helping extended to strangers of a familiar strain but not to strangers of an unfamiliar one.",
     "Suggests that who counts as ‘others’ can have a learned boundary rather than one global number.",
     None),
    ("paper", "heslin-brown-2021", "No preference for prosocial helping behavior in rats with concurrent social interaction opportunities",
     ["Kelsey A. Heslin", "Michael F. Brown"], 2021, "Learning & Behavior",
     "https://link.springer.com/article/10.3758/s13420-021-00471-8", "10.3758/s13420-021-00471-8", "thread-empathy", LIT,
     "A later study that asks whether the helping result reflects empathy or a preference for social contact.",
     "Cited beside the 2011 study so that the debate, not one finding, is what the lab relies on.",
     None),
    ("paper", "seyfarth-cheney-2013", "Affiliation, empathy, and the origins of theory of mind",
     ["Robert M. Seyfarth", "Dorothy L. Cheney"], 2013, "PNAS",
     "https://doi.org/10.1073/pnas.1301223110", "10.1073/pnas.1301223110", "thread-empathy", LIT,
     "Argues that theory of mind builds on an older system of empathy and affiliation.",
     "Supports sensing others' state as a primitive, before any model of their beliefs.",
     "Checked against the source by the lab on Sep 20 2026 and corrected: the authors are Robert M. Seyfarth and Dorothy L. Cheney."),
    ("paper", "rajmohan-mohandas-2007", "Mirror neuron system", ["V. Rajmohan", "E. Mohandas"], 2007,
     "Indian Journal of Psychiatry", "https://pmc.ncbi.nlm.nih.gov/articles/PMC2900004/", "10.4103/0019-5545.31522",
     "thread-empathy", LIT,
     "An overview of research on mirror neurons.",
     "Cited with a caution: the lab reads this literature as contested and in parts over-claimed.",
     None),
    ("paper", "murray-2022", "Mirror self-recognition in gorillas (Gorilla gorilla gorilla): a review and evaluation of mark test replications and variants",
     ["Lindsay E. Murray", "James R. Anderson", "Gordon G. Gallup"], 2022, "Animal Cognition",
     "https://pmc.ncbi.nlm.nih.gov/articles/PMC9334443/", "10.1007/s10071-021-01592-3", "thread-empathy", LIT,
     "A review of mirror mark-test studies in gorillas and of why an animal can fail the test for reasons other than a missing capacity.",
     "Supports the caution that a missing behavioural marker may not mean a missing capacity.",
     None),
    ("paper", "plotnik-2006", "Self-recognition in an Asian elephant", ["Joshua M. Plotnik", "Frans B. M. de Waal", "Diana Reiss"],
     2006, "PNAS", "https://doi.org/10.1073/pnas.0608062103", "10.1073/pnas.0608062103", "thread-empathy", LIT,
     "An Asian elephant passes the mirror mark test.",
     "An example of the mark test's method.",
     None),
    ("paper", "nowak-2006", "Five Rules for the Evolution of Cooperation", ["Martin A. Nowak"], 2006, "Science",
     "https://doi.org/10.1126/science.1133755", "10.1126/science.1133755", "thread-cooperation", LIT,
     "Five mechanisms by which cooperation can evolve: kin selection, direct and indirect reciprocity, network reciprocity and group selection.",
     "A checklist for the value-lab's rules: which mechanism does each rule implement?",
     "The lab's plan links a PDF copy; linked here by DOI."),
    ("book", "axelrod-1984", "The Evolution of Cooperation", ["Robert Axelrod"], 1984, "Basic Books",
     "https://openlibrary.org/works/OL2620286W", None, "thread-cooperation", LIT,
     "Tournaments of the repeated prisoner's dilemma, in which a simple, provokable and forgiving strategy (tit-for-tat) did well.",
     "Upstream of the value-lab's rule set: legible rules as a route to cooperation.",
     "The lab's notes read a review of the book by FEE, an advocacy organisation, not the book itself. The link here is a library catalogue entry instead (Open Library, checked Sep 25 2026)."),
    ("paper", "gupta-2025", "The Role of Social Learning and Collective Norm Formation in Fostering Cooperation in LLM Multi-Agent Systems",
     ["Prateek Gupta", "Qiankun Zhong", "Hiromu Yakura", "Thomas Eisenmann", "Iyad Rahwan"], 2025, "arXiv 2510.14401",
     "https://arxiv.org/abs/2510.14401", None, "thread-cooperation", LIT,
     "Studies how social learning and the forming of shared norms affect cooperation among LLM agents.",
     "Prior art for an imitative rule (copy the one doing best) as its own social-learning channel.",
     None),
    ("paper", "ndousse-2020", "Emergent Social Learning via Multi-agent Reinforcement Learning",
     ["Kamal Ndousse", "Douglas Eck", "Sergey Levine", "Natasha Jaques"], 2020, "arXiv 2010.00581",
     "https://arxiv.org/abs/2010.00581", None, "thread-cooperation", LIT,
     "Reinforcement-learning agents that come to learn from other agents sharing their environment.",
     "Prior art for how to implement and evaluate an imitative rule.",
     None),
    ("paper", "van-nieuwerburgh-2026", "Financing the AI Buildout", ["Stijn Van Nieuwerburgh"], 2026,
     "Columbia Business School, draft of March 20 2026",
     "https://business.columbia.edu/sites/default/files-efs/imce-uploads/svannieuwerburgh/papers/DataCenterJEP.pdf", None,
     "thread-money", "the film plan, v3",
     "Compares the AI data-centre buildout with earlier infrastructure booms as a share of US GDP, and looks at how it is financed.",
     "The source of the film plan's chart of buildouts as a share of GDP.",
     "A draft; the film plan prefers the paper's numbers to a widely shared image that uses a different measure."),
    ("paper", "odlyzko-2010", "Collective Hallucinations and Inefficient Markets: The British Railway Mania of the 1840s",
     ["Andrew Odlyzko"], 2010, "SSRN", "https://doi.org/10.2139/ssrn.1537338", "10.2139/ssrn.1537338", "thread-money",
     "the film plan, v3",
     "Argues that investors in Britain's railway mania ignored numbers that were available; the lines were built and shareholders lost.",
     "Part of the film plan's point that a technology can change the world while its investors lose money.",
     None),
    ("paper", "nordhaus-2004", "Schumpeterian Profits in the American Economy: Theory and Measurement", ["William D. Nordhaus"],
     2004, "NBER Working Paper 10433", "https://www.nber.org/papers/w10433", "10.3386/w10433", "thread-money", "the film plan, v3",
     "Estimates that innovators kept a small share of the social value of their innovations (about 2.2% for 1948 to 2001).",
     "Part of the film plan's point that much of a technology's gain goes to consumers rather than investors.",
     None),
    ("report", "metr-2026", "Brief independent investigation of agents’ behavior, reasoning and collaboration in the OpenAI / Hugging Face hacking incident",
     ["METR"], 2026, "METR, Aug 26 2026",
     "https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/", None, "thread-2026",
     "the lab's notes on Huang and Greenblatt (Sep 24 2026)",
     "By its own description, two METR staff members and a Redwood Research contractor investigated an incident in which OpenAI agents coordinated a multi-day hack of Hugging Face on a shared, unsanctioned message board.",
     "The lab's notes check the figure of roughly 700 agents against it.",
     "The notes quote the report's own count; the full report is a PDF linked from the page."),
    ("statement", "pacing-the-frontier-2026", "Pacing the Frontier", ["employees of frontier AI companies"], 2026,
     "public statement, launched Jul 2026", "https://www.pacingthefrontier.com/", None, "thread-2026",
     "the lab's notes on Huang and Greenblatt (Sep 24 2026)",
     "A public statement that describes itself as coming from over 1,000 employees of frontier AI companies.",
     "The lab's notes counted its signatories on Sep 24 2026 (1,386; 1,178 at launch).",
     None),
]

# ------------------------------------------------------------------------------------------------
# Seed term -> the genealogy milestone whose title (or summary) names the idea. Terms without an
# entry have no milestone that names them; their lane still places them.
TERM_MILESTONE = {
    "intelligence-explosion": "good1965", "singularity": "vinge", "superintelligence": "bostrom",
    "takeoff": "bostrom", "automated-researcher": "oai-roadmap", "scaling-laws": "kaplan",
    "bitter-lesson": "bitterlesson", "pretraining": "gpt1", "compute": "stargate", "rlhf": "rlhf2017",
    "self-play": "alphazero", "reasoning-rl": "o1", "chain-of-thought": "cotmon", "reward-hacking": "concrete",
    "world-models": "worldmodels", "continual-learning": "forgetting", "generalization": "ilya-general",
    "value-function": "ilya-general", "arc": "arc", "symbolic": "synthesis71", "open-endedness": "hughes2024",
    "multi-agent": "coopai", "agents": "genagents", "interpretability": "circuits", "scalable-oversight": "debate",
    "control": "control", "deception": "alignfaking", "existential-risk": "cais-statement", "open-source": "llama",
    "pause": "pause-letter",
}
# A milestone summary that quotes more than 20 words -> the genealogy's own paraphrase (risk_notes id).
SUMMARY_OVERRIDE = {"good1965": "r-good"}

# ------------------------------------------------------------------------------------------------
def git_show(repo, ref, path):
    r = subprocess.run(["git", "-C", str(repo), "show", f"{ref}:{path}"], capture_output=True)
    if r.returncode != 0:
        raise SystemExit(f"git show {ref}:{path} failed in {repo}: {r.stderr.decode('utf-8', 'replace').strip()}")
    return r.stdout


def git_json(repo, ref, path):
    return json.loads(git_show(repo, ref, path).decode("utf-8"))


def rev(repo, ref):
    return subprocess.run(["git", "-C", str(repo), "rev-parse", ref], capture_output=True, text=True).stdout.strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def pid(whoswho_id):
    return whoswho_id.replace("_", "-")


def clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def years(start, end):
    if start and end:
        return f"{start}-{end}"
    if start:
        return f"since {start}"
    if end:
        return f"until {end}"
    return ""


def compose_role(p, orgs, hosted):
    """A role line from the who's-who: hosted shows, then current titles, then the latest past one."""
    parts = []
    if hosted:
        parts.append("Host of " + " and ".join(hosted))
    affs = [a for a in p.get("affiliations") or [] if (p["id"], a["org"]) not in AFFILIATION_SKIP]
    cur = [a for a in affs if a.get("end") is None]
    past = sorted([a for a in affs if a.get("end") is not None], key=lambda a: a["end"], reverse=True)
    for a in cur:
        y = f" ({years(a.get('start'), None)})" if a.get("start") else ""
        parts.append(f"{a['title']}, {orgs.get(a['org'], a['org'])}{y}")
    for a in past[:1]:
        parts.append(f"formerly {a['title']}, {orgs.get(a['org'], a['org'])} ({years(a.get('start'), a['end'])})")
    return "; ".join(parts) + "." if parts else ""


QUOTE_SPANS = re.compile(r"[\"“]([^\"”]+)[\"”]|(?<![A-Za-z])['‘]([^'’]+?)['’](?![A-Za-z])")


def long_quotes(text):
    return [m.group(1) or m.group(2) for m in QUOTE_SPANS.finditer(text or "")
            if len((m.group(1) or m.group(2)).split()) > 20]


# ------------------------------------------------------------------------------------------------
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"


def _open(url, method, headers, tries=4):
    for attempt in range(tries):
        req = urllib.request.Request(url, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.status, r.read() if method == "GET" else b""
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < tries - 1:   # rate-limited (Crossref, YouTube): back off
                time.sleep(3 * (attempt + 1))
                continue
            return e.code, b""
        except Exception:
            return 0, b""
    return 0, b""


def check_one(url, today):
    hdr = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
           "Accept-Language": "en-US,en;q=0.9"}
    m = re.match(r"^https://doi\.org/(10\..+)$", url)
    if m:
        code, _ = _open("https://api.crossref.org/works/" + m.group(1), "GET",
                        {"User-Agent": "recursive-learning link check (https://learning.recursive.eco)"})
        return f"{code} crossref {today}"
    m = re.match(r"^https://www\.youtube\.com/watch\?v=([\w-]{11})$", url)
    if m:
        code, _ = _open(f"https://www.youtube.com/oembed?url={url}&format=json", "GET", {"User-Agent": UA})
        return f"{code} oembed {today}"   # 401 = the video exists; its owner turned embedding off
    code, _ = _open(url, "HEAD", hdr)
    if code == 200:
        return f"200 HEAD {today}"
    code, _ = _open(url, "GET", hdr)
    return f"{code} GET {today}"


def link_ok(check):
    """A link the grammars may publish: it answered, or it is a bot wall in front of a live page."""
    if not check:
        return True   # never checked: publish, the next --check-links will say
    code = int(check.split()[0])
    return code in (200, 202, 401, 403)


# ------------------------------------------------------------------------------------------------
def build(repo, map_ref, players_ref):
    E = git_json(repo, map_ref, "ai-map/episodes.json")
    M = git_json(repo, map_ref, "ai-map/mentions.json")
    T = git_json(repo, map_ref, "ai-map/terms.json")
    W = git_json(repo, map_ref, "ai-map/provenance/whoswho.json")
    G = git_json(repo, map_ref, "ai-map/provenance/genealogy.json")
    R = git_json(repo, map_ref, "ai-map/regulatory.json")
    P = git_json(repo, players_ref, "players/players.json")

    nodes = {n["id"]: n for n in W["nodes"]}
    orgs = {n["id"]: n["name"] for n in W["nodes"] if n["type"] == "org"}
    pods = [n for n in W["nodes"] if n["type"] == "podcast"]
    persons = {n["id"]: n for n in W["nodes"] if n["type"] == "person"}
    hosted_by = collections.defaultdict(list)
    for s in pods:
        for h in s.get("hosts") or []:
            hosted_by[h].append(s["id"])

    # ---- mentions -> derived numbers only (no caption text leaves this function)
    cap = {e["video_id"]: e for e in M["episodes"] if e.get("cue_count")}
    per_ep_term = collections.Counter()
    per_term_person = collections.defaultdict(collections.Counter)
    per_term_person_eps = collections.defaultdict(lambda: collections.defaultdict(set))
    per_term_year_eps = collections.defaultdict(lambda: collections.defaultdict(set))
    per_term_year_n = collections.defaultdict(collections.Counter)
    first = {}
    for m in M["mentions"]:
        v, t = m["video_id"], m["term"]
        if v not in cap:
            continue
        per_ep_term[(v, t)] += 1
        y = cap[v]["date"][:4]
        per_term_year_eps[t][y].add(v)
        per_term_year_n[t][y] += 1
        for g in cap[v]["guests"]:
            per_term_person[t][g] += 1
            per_term_person_eps[t][g].add(v)
        key = (cap[v]["date"], v)
        if t not in first or key < first[t]:
            first[t] = key
    year_eps = collections.defaultdict(set)
    for v, e in cap.items():
        year_eps[e["date"][:4]].add(v)

    # ---- episodes (one record per episode; an episode with several guests lists them all)
    groups = collections.OrderedDict()
    for row in E:
        groups.setdefault((row["show"], row["episode_url"]), []).append(row)
    episodes, ep_of_video = [], {}
    for (show, url), rows in groups.items():
        r0 = rows[0]
        eid = f"ep-{SHOW_KEY[show]}-{r0['date']}-{pid(r0['person'])}"
        v = r0.get("video_id")
        if v:
            status = "public"
        else:
            status = next((s for pat, s in VIDEO_STATUS if re.search(pat, r0["match_note"])), clean(r0["match_note"]))
        tops = sorted(((t, n) for (vv, t), n in per_ep_term.items() if vv == v), key=lambda x: (-x[1], x[0]))[:6] if v else []
        rec = {
            "kind": "episode", "id": eid, "show": show, "date": r0["date"], "title": clean(r0["episode"]),
            "guests": [x["person"] for x in rows], "episode_url": url, "video_id": v, "video_status": status,
            "match_note": clean(r0["match_note"]) if v else None, "captioned": bool(v and v in cap),
            "top_terms": [[t, n] for t, n in tops],
        }
        episodes.append(rec)
        if v:
            ep_of_video[v] = eid
    episodes.sort(key=lambda e: (e["show"], e["date"], e["id"]))

    shows = [{"kind": "show", "id": s["id"], "name": s["name"], "url": s["url"], "hosts": list(s.get("hosts") or [])}
             for s in sorted(pods, key=lambda s: s["name"].lower())]
    show_name = {s["id"]: s["name"] for s in pods}

    # ---- people: every guest, every host of the seven shows, and the players ledger
    guests = {g for e in episodes for g in e["guests"]}
    hosts = set(hosted_by)
    player_ids = {PLAYER_NAMES[k] for k in P["people"]}
    people = []
    for i in sorted(guests | hosts | player_ids, key=lambda x: persons[x]["name"].split()[-1].lower() + " " + persons[x]["name"].lower()):
        p = persons[i]
        hosted = [show_name[s] for s in hosted_by.get(i, [])]
        if i in PLAYER_ROLES:
            role, src = PLAYER_ROLES[i], "the lab's players ledger (Sep 23 2026), titles only"
            if hosted:
                role = "Host of " + " and ".join(hosted) + ". " + role
        elif i in ROLE_OVERRIDE:
            role, src = ROLE_OVERRIDE[i], "the lab's who's-who (Sep 23 2026)"
        else:
            role, src = compose_role(p, orgs, hosted), "the lab's who's-who (Sep 23 2026)"
        role = role[:1].upper() + role[1:]
        affs = [{"kind": "affiliation", "org": orgs.get(a["org"], a["org"]), "title": clean(a["title"]),
                 "start": a.get("start"), "end": a.get("end")}
                for a in p.get("affiliations") or [] if (i, a["org"]) not in AFFILIATION_SKIP]
        people.append({
            "kind": "person", "id": i, "name": p["name"], "role": role, "role_source": src,
            "hosts": list(hosted_by.get(i, [])), "affiliations": affs,
            "elsewhere": [{"kind": "link", "title": clean(o["show"]), "url": o["url"]} for o in p.get("other_appearances") or []],
        })

    threads = [{"kind": "thread", "id": t, "name": n, "about": a} for t, n, a in THREADS]
    papers = []
    for (kind, xid, title, authors, year, venue, url, doi, thread, cited, about, used, check) in PAPERS:
        papers.append({"kind": kind, "id": xid, "title": title, "authors": authors, "year": year, "venue": venue,
                       "url": url, "doi": doi, "thread": thread, "cited_in": cited, "about": about,
                       "used_for": used, "reading_check": check})

    # ---- ideas
    lanes_all = {l["id"]: l for l in G["lanes"]}
    ms_all = {m["id"]: m for m in G["milestones"]}
    risk = {r["id"]: r for r in G.get("risk_notes") or []}
    reg_names = {i["id"]: clean(i["name"]) for i in R["ideas"]}
    outcomes_all = {o["id"]: o for o in R["outcomes"]}
    comention = collections.defaultdict(list)
    for c in M["comention"]:
        comention[c["a"]].append((c["b"], c["n"]))
        comention[c["b"]].append((c["a"], c["n"]))
    tcounts = {t["id"]: t for t in M["terms"]}

    terms = []
    for t in T["terms"]:
        tid = t["id"]
        tc = tcounts[tid]
        f = first.get(tid)
        fe = cap[f[1]] if f else None
        by_year = []
        for y in sorted(year_eps):
            by_year.append([int(y), len(per_term_year_eps[tid].get(y, ())), len(year_eps[y]), per_term_year_n[tid].get(y, 0)])
        tops = sorted(per_term_person[tid].items(), key=lambda kv: (-kv[1], persons[kv[0]]["name"]))[:5]
        along = sorted(comention[tid], key=lambda x: (-x[1], x[0]))[:3]
        terms.append({
            "kind": "term", "id": tid, "label": clean(t["label"]), "lane": t["lane"], "layer": t["layer"],
            "precision": t["precision"], "spotcheck": clean(t.get("spotcheck")) or None,
            "mentions": tc["mentions"], "episodes": tc["episodes"],
            "first": ({"date": fe["date"], "show": fe["show"], "title": clean(fe["episode"]), "video_id": f[1],
                       "episode": ep_of_video.get(f[1])} if fe else None),
            "by_year": by_year,
            "top_people": [[g, n, len(per_term_person_eps[tid][g])] for g, n in tops],
            "alongside": [[b, n] for b, n in along],
            "milestone": TERM_MILESTONE.get(tid),
            "outcome": tid if tid in outcomes_all else None,
        })

    used_lanes = [l for l in G["lanes"] if any(t["lane"] == l["id"] for t in terms)]
    lanes = [{"kind": "lane", "id": l["id"], "name": clean(l["name"]), "short": clean(l.get("short")),
              "start": l.get("start"), "parent": l.get("parent"), "summary": clean(l.get("summary")),
              "heading": clean(l.get("heading")), "people": list(l.get("people") or []),
              "sources": [{"kind": "link", "title": clean(s["title"]), "url": s["url"]} for s in l.get("sources") or []]}
             for l in used_lanes]
    milestones = []
    for mid in sorted(set(TERM_MILESTONE.values())):
        m = ms_all[mid]
        summary = clean(m["summary"])
        if mid in SUMMARY_OVERRIDE:
            summary = clean(risk[SUMMARY_OVERRIDE[mid]]["claim"])
        milestones.append({"kind": "milestone", "id": mid, "year": m["year"], "lane": m["lane"], "title": clean(m["title"]),
                           "summary": summary, "people": list(m.get("people") or []),
                           "sources": [{"kind": "link", "title": clean(s["title"]), "url": s["url"]} for s in m.get("sources") or []]})
    outcomes = [{"kind": "outcome", "id": o["id"], "if_controllable": [reg_names[i] for i in o["if_controllable"]],
                 "verdict": clean(o["verdict"])}
                for o in R["outcomes"] if o["id"] in {t["id"] for t in terms}]

    corpus = {
        "appearances": len(E), "episodes": len(episodes), "captioned": len(cap),
        "captioned_by_year": {y: len(v) for y, v in sorted(year_eps.items())},
        "missing_transcripts": list(M["meta"].get("missing_transcripts") or []),
        "method": clean(M["meta"].get("method")),
        "caveats": [clean(c) for c in M["meta"].get("caveats") or []],
        "terms_status": clean(T["meta"].get("status")),
    }
    about_common = {
        "from": "PlayfulProcess/recursive-transcripts (private): ai-map/ at "
                f"{map_ref} {rev(repo, map_ref)[:7]}, players/players.json at {players_ref} {rev(repo, players_ref)[:7]}",
        "exported_by": "scripts/lab_export.py",
        "license": "CC-BY-SA-4.0",
        "what_is_left_out": "transcript text, stance labels, film-cast flags, the players ledger's assessments, private notes",
    }
    sources = {"_about": dict(about_common, what="the Sources grammar's inputs: podcasts, episodes, people, papers"),
               "shows": shows, "episodes": episodes, "people": people, "threads": threads, "papers": papers}
    ideas = {"_about": dict(about_common, what="the Ideas grammar's inputs: seed terms with derived counts, genealogy lanes and milestones, the outcome fork"),
             "corpus": corpus, "lanes": lanes, "terms": terms, "milestones": milestones, "outcomes": outcomes}
    return sources, ideas


def urls_of(obj):
    out = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("url", "episode_url") and isinstance(v, str) and v.startswith("http"):
                out.add(v)
            elif k == "video_id" and isinstance(v, str) and obj.get("kind") == "episode":
                out.add(f"https://www.youtube.com/watch?v={v}")
            else:
                out |= urls_of(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= urls_of(v)
    return out


def audit(name, data):
    """Fail on anything the allow-list does not name, a private key, or a long quotation."""
    problems = []

    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                if PRIVATE_KEY.match(str(k)):
                    problems.append(f"{name}{path}/{k}: private key")
                walk(v, f"{path}/{k}")
        elif isinstance(o, list):
            for i, v in enumerate(o):
                if isinstance(v, dict):
                    spec = ALLOWED_KEYS.get(v.get("kind"))
                    if spec is None:
                        problems.append(f"{name}{path}[{i}]: record kind {v.get('kind')!r} is not in ALLOWED_KEYS")
                    elif set(v) != set(spec):
                        problems.append(f"{name}{path}[{i}]: keys {sorted(set(v) ^ set(spec))} differ from ALLOWED_KEYS[{v.get('kind')!r}]")
                walk(v, f"{path}[{i}]")
        elif isinstance(o, str):
            for q in long_quotes(o):
                problems.append(f"{name}{path}: a quotation of {len(q.split())} words")
    walk(data, "")
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repo", default=os.environ.get("RECURSIVE_TRANSCRIPTS"),
                    help="a clone of PlayfulProcess/recursive-transcripts (or set RECURSIVE_TRANSCRIPTS)")
    ap.add_argument("--map-ref", default="origin/ai-map-sep24",
                    help="the ref that holds ai-map/ (main, once PR #1 there is merged)")
    ap.add_argument("--players-ref", default="main", help="the ref that holds players/players.json")
    ap.add_argument("--check-links", action="store_true", help="fetch every published URL again")
    ap.add_argument("--out", default=str(OUT_DIR), help="where to write sources.json and ideas.json")
    a = ap.parse_args()
    if not a.repo:
        raise SystemExit("pass --repo (a recursive-transcripts clone) or set RECURSIVE_TRANSCRIPTS")
    sources, ideas = build(Path(a.repo), a.map_ref, a.players_ref)

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()
    for fname, data in (("sources.json", sources), ("ideas.json", ideas)):
        prev = {}
        pf = out / fname
        if pf.exists():
            try:
                prev = json.loads(pf.read_text(encoding="utf-8")).get("link_checks") or {}
            except Exception:
                prev = {}
        urls = sorted(urls_of(data))
        if a.check_links:
            with ThreadPoolExecutor(max_workers=6) as ex:
                checks = dict(zip(urls, ex.map(lambda u: check_one(u, today), urls)))
        else:
            checks = {u: prev[u] for u in urls if u in prev}
        data["link_checks"] = {u: checks[u] for u in urls if u in checks}
        problems = audit(fname, data)
        if problems:
            raise SystemExit("export refused:\n  " + "\n  ".join(problems[:40]))
        bad = sorted(u for u, c in data["link_checks"].items() if not link_ok(c))
        unchecked = [u for u in urls if u not in data["link_checks"]]
        pf.write_bytes((json.dumps(data, indent=1, ensure_ascii=False) + "\n").encode("utf-8"))
        print(f"{fname}: {len(urls)} links ({len(bad)} failing, {len(unchecked)} never checked) -> {pf}")
        for u in bad:
            print("   failing:", data["link_checks"][u], u)


if __name__ == "__main__":
    main()
