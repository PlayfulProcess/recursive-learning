"""
race_model.py - toy models behind PlayfulProcess's essay on the "nature of things".

The question: when is it RATIONAL for a developer (a lab or a country) to CONTINUE
building advanced AI even though stopping would be better for everyone?

Cases, each a proposition checked by brute force:
  (a) marginal impact: a prisoner's dilemma at p = 10%
  (b) "better us than them": each believes it is the safer winner
  (c) externality / principal-agent: the decision-maker carries a share s of the cost
  (d) stag hunt: two equilibria, and beliefs choose between them
  (e) one planner: finite catastrophe cost vs the lost future and deep uncertainty
  (f) optional: a population version of (d), tipping points and committed minorities
  (g) gambling for resurrection: when stopping already means ruin (added 28 Sep 2026)

Standard library only. Exact arithmetic with fractions.Fraction, so ties are real ties
(case (f) is a simulation and uses floats). Every claim prints PASS or FAIL and the
script exits with code 1 if any claim fails. Output is plain ASCII.

Run:  python race_model.py > race_model_output.txt
"""

from fractions import Fraction as Fr
from itertools import product
import sys

C, S = "C", "S"          # Continue, Stop
RESULTS = []


# ---------------------------------------------------------------- printing helpers
def pct(x):
    return f"{float(x) * 100:.4g}%"


def num(x):
    x = Fr(x)
    if x.denominator == 1:
        return str(x.numerator)
    return f"{float(x):.4g}"


def check(tag, claim, ok, detail=""):
    ok = bool(ok)
    RESULTS.append((tag, claim, ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {tag}  {claim}")
    if detail:
        for line in detail.split("\n"):
            print(f"           {line}")


def header(title):
    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


# ---------------------------------------------------------------- game machinery
def profiles(n):
    """Every strategy profile for n players: 2**n tuples of 'C'/'S'."""
    return list(product((C, S), repeat=n))


def flip(a):
    return S if a == C else C


def deviate(prof, i):
    """The same profile with player i switched."""
    return prof[:i] + (flip(prof[i]),) + prof[i + 1:]


def everyone(n, a):
    return tuple([a] * n)


def show(prof):
    return "".join(prof)


def pure_nash(n, u):
    """Profiles where no player gains STRICTLY by switching alone (brute force)."""
    return [prof for prof in profiles(n)
            if all(u(i, deviate(prof, i)) <= u(i, prof) for i in range(n))]


def is_strict_nash(n, u, prof):
    """Every player strictly loses by switching alone."""
    return all(u(i, deviate(prof, i)) < u(i, prof) for i in range(n))


def strictly_dominant(n, u, i, action):
    """`action` beats the alternative for player i against EVERY profile of the others."""
    return all(u(i, prof) > u(i, deviate(prof, i))
               for prof in profiles(n) if prof[i] == action)


# ---------------------------------------------------------------- the race model
def race_game(W, D, p, outsiders=0):
    """Expected payoff of developer i.

    k = number of developers who continue (outsiders always continue).
    The prize W goes to one continuer; each continuer wins with probability 1/k.
    A catastrophe happens with probability p(k); it costs EVERY developer D,
    stoppers included.  Payoff of a stopper when nobody builds = 0 (status quo).
    """
    def u(i, prof):
        k = prof.count(C) + outsiders
        prize = Fr(W) / k if prof[i] == C else Fr(0)
        return prize - p(k) * Fr(D)
    return u


def linear(step, base=Fr(0)):
    """Each continuer adds `step` to the catastrophe probability (plus a background)."""
    return lambda k: base + step * k


def front_loaded(first, extra):
    """Most of the risk comes from the technology existing at all: the first builder
    brings `first`, each additional racer adds `extra`."""
    return lambda k: Fr(0) if k == 0 else first + extra * (k - 1)


# ================================================================ (a)
def case_a():
    header("(a) MARGINAL IMPACT: a prisoner's dilemma at p = 10%")
    N, W, D, step = 5, Fr(20), Fr(100), Fr(2, 100)
    p = linear(step)
    u = race_game(W, D, p)
    print(f"  N={N} developers. Prize W={num(W)}, won by one continuer (each with prob 1/k).")
    print(f"  Catastrophe costs EVERY developer D={num(D)} (each counts it in full).")
    print(f"  p(k) = {pct(step)} x k: p = {pct(p(N))} if all continue, 0 if all stop.")

    rows = []
    for m in range(N):
        rows.append(f"m={m} others continue: my expected prize W/(m+1) = {num(W / (m + 1))}"
                    f"  vs  my added risk (p(m+1)-p(m))*D = {num((p(m + 1) - p(m)) * D)}")
    dom = all(strictly_dominant(N, u, i, C) for i in range(N))
    check("a1", "Continue is a strictly dominant strategy for every developer", dom, "\n".join(rows))

    eqs = pure_nash(N, u)
    check("a2", "The only pure Nash equilibrium is 'all continue', and it is strict",
          eqs == [everyone(N, C)] and is_strict_nash(N, u, everyone(N, C)),
          f"brute force over {2 ** N} profiles -> equilibria: {[show(e) for e in eqs]}")

    allC, allS = u(0, everyone(N, C)), u(0, everyone(N, S))
    check("a3", "All stop is Pareto-better than all continue (p = 10% at all continue)",
          p(N) == Fr(10, 100) and all(u(i, everyone(N, S)) > u(i, everyone(N, C)) for i in range(N)),
          f"all continue: each gets W/N - p*D = {num(W / N)} - {num(p(N) * D)} = {num(allC)}\n"
          f"all stop:     each gets {num(allS)}")

    lone = deviate(everyone(N, C), 0)
    check("a4", "A lone stopper only cuts the risk from 10% to 8%: gives up 4, saves 2",
          p(N - 1) == Fr(8, 100) and W / N == 4 and (p(N) - p(N - 1)) * D == 2
          and u(0, everyone(N, C)) - u(0, lone) == 2,
          f"stay in: {num(u(0, everyone(N, C)))}   stop alone: {num(u(0, lone))}")

    ok, lines = True, []
    for base in (Fr(5, 100), Fr(30, 100)):
        ub = race_game(W, D, linear(step, base))
        same_inc = all(ub(i, prof) - ub(i, deviate(prof, i)) == u(i, prof) - u(i, deviate(prof, i))
                       for prof in profiles(N) for i in range(N))
        same_eq = pure_nash(N, ub) == eqs
        ok = ok and same_inc and same_eq
        lines.append(f"background risk +{pct(base)} -> total if all continue {pct(linear(step, base)(N))}:"
                     f" same incentives {same_inc}, same equilibria {same_eq}")
    check("a5", "The LEVEL of p is not in the choice: adding risk no developer controls changes nothing",
          ok, "\n".join(lines))

    shapes = [
        ("linear: each racer adds 2 points", linear(step)),
        ("front-loaded: 10% once anyone builds", front_loaded(Fr(10, 100), Fr(0))),
        ("back-loaded: 0 until the 5th racer joins, then 10%", lambda k: Fr(10, 100) if k >= N else Fr(0)),
    ]
    ok, lines = True, []
    for name, ps in shapes:
        us = race_game(W, D, ps)
        others_in = everyone(N, C)
        # formula: with 4 others in, continue iff W/N > (p(N)-p(N-1))*D ; check against brute force for W=1..60
        for w in range(1, 61):
            uw = race_game(w, D, ps)
            brute = uw(0, others_in) > uw(0, deviate(others_in, 0))
            formula = Fr(w, N) > (ps(N) - ps(N - 1)) * D
            ok = ok and (brute == formula) and ps(N) == Fr(10, 100)
        choice = "CONTINUE" if us(0, others_in) > us(0, deviate(others_in, 0)) else "STOP"
        lines.append(f"{name}: total {pct(ps(N))}, my slice {pct(ps(N) - ps(N - 1))} -> at W=20 the 5th developer: {choice}")
    check("a6", "Same 10% total, different marginal slice, different choice (formula = brute force, W=1..60)",
          ok, "\n".join(lines))

    ok, count = True, 0
    for n in range(2, 6):
        for st in (Fr(1, 100), Fr(2, 100), Fr(3, 100)):
            for w in range(1, 81):
                un = race_game(w, D, linear(st))
                brute = (all(strictly_dominant(n, un, i, C) for i in range(n))
                         and all(un(i, everyone(n, S)) > un(i, everyone(n, C)) for i in range(n)))
                formula = st * D < Fr(w, n) < n * st * D
                ok = ok and (brute == formula)
                count += 1
    check("a7", "Prisoner's dilemma  <=>  dp*D < W/N < N*dp*D  (linear p; sweep N=2..5, dp=1-3%, W=1..80)",
          ok, f"{count} parameter sets, formula and brute force agree on all")

    totals = {k: W * (1 if k > 0 else 0) - N * p(k) * D for k in range(N + 1)}
    best_k = max(totals, key=lambda k: totals[k])
    check("a8", "Caveat: for the developers' SUM, exactly one builder beats both all-stop and all-continue",
          best_k == 1 and totals[1] == 10 and totals[0] == 0 and totals[N] == -30,
          "sum of developers' payoffs by number continuing: "
          + ", ".join(f"k={k}: {num(v)}" for k, v in totals.items()))



# ================================================================ (a) at Harris's scale
def case_a_coin():
    header("(a') THE SAME GAME AT A COIN TOSS: the dilemma needs a big prize relative to the slice")
    N, W, D = 5, Fr(20), Fr(100)
    u = race_game(W, D, linear(Fr(10, 100)))          # 5 racers x 10 points = 50%
    eq = pure_nash(N, u)
    builders = sorted({e.count(C) for e in eq})
    check("a9", "With the same prize and cost but 10 points per racer (50% if all race), all-continue is NOT an equilibrium",
          everyone(N, C) not in eq and max(builders) <= 2,
          f"numbers of builders across all equilibria: {builders}  (each racer's own slice, 10 points x 100 = 10, "
          f"now exceeds its share of the prize once three or more race)")

    # counting the world's loss instead of one's own
    uw = race_game(W, Fr(1000), linear(Fr(2, 100)))
    eqw = pure_nash(N, uw)
    check("a10", "Back at 10% (2 points each), if each counted the WORLD's loss (D = 1000) instead of its own, all-continue is not an equilibrium",
          everyone(N, C) not in eqw,
          f"equilibria: {[show(e) for e in eqw][:6]}{' ...' if len(eqw) > 6 else ''}")

# ================================================================ (b)
def belief_game(W, D, q_self, q_other):
    """Developer i's payoff AS I SEES IT: the winner's safety sets the catastrophe
    probability; i believes p = q_self if i wins and p = q_other if anyone else wins."""
    def u(i, prof):
        k = prof.count(C)
        if k == 0:
            return Fr(0)
        if prof[i] == C:
            p = (q_self + (k - 1) * q_other) / k
            return Fr(W) / k - p * Fr(D)
        return -q_other * Fr(D)
    return u


def case_b():
    header("(b) 'BETTER US THAN THEM': each believes it is the safer winner")
    N, W, D = 2, Fr(6), Fr(100)
    q_self, q_other, q_true = Fr(5, 100), Fr(15, 100), Fr(10, 100)
    ub = belief_game(W, D, q_self, q_other)          # what each developer believes
    ut = belief_game(W, D, q_true, q_true)           # the truth: equally safe, 10% each
    print(f"  N={N}, prize W={num(W)}, D={num(D)}. Each believes: p={pct(q_self)} if I win,"
          f" {pct(q_other)} if the other wins.")
    print(f"  Truth used for comparison: both equally safe, p={pct(q_true)} whoever wins.")

    # subjective p when the other continues
    p_stop = q_other
    p_cont = (q_self + q_other) / 2
    check("b1", "If the other continues, continuing LOWERS p in my own eyes (15% -> 10%)",
          p_stop == Fr(15, 100) and p_cont == Fr(10, 100) and p_cont < p_stop,
          f"stop: the other wins for sure, p={pct(p_stop)};  continue: 50/50, p={pct(p_cont)}")

    eqs = pure_nash(N, ub)
    check("b2", "With the belief, Continue is strictly dominant; unique equilibrium: both continue",
          all(strictly_dominant(N, ub, i, C) for i in range(N)) and eqs == [everyone(N, C)],
          f"payoffs as each sees them: CC {num(ub(0, ('C', 'C')))}, CS {num(ub(0, ('C', 'S')))},"
          f" SC {num(ub(0, ('S', 'C')))}, SS {num(ub(0, ('S', 'S')))}  -> equilibria {[show(e) for e in eqs]}")

    check("b3", "Both continuing is worse than both stopping, by their OWN beliefs and by the truth",
          ub(0, everyone(N, C)) == -7 and ut(0, everyone(N, C)) == -7 and ub(0, everyone(N, S)) == 0,
          f"both continue: {num(ub(0, everyone(N, C)))} as believed, {num(ut(0, everyone(N, C)))} in truth;"
          f" both stop: 0")

    eqt = pure_nash(N, ut)
    check("b4", "Without the belief the same game is a stag hunt (SS and CC): the belief deleted the stop equilibrium",
          eqt == [everyone(N, C), everyone(N, S)]
          and all(is_strict_nash(N, ut, e) for e in eqt),
          f"true-safety equilibria: {[show(e) for e in eqt]}")

    check("b5", "In truth, continuing while the other continues does not lower p at all (10% -> 10%)",
          (q_true + q_true) / 2 == q_true, "the whole gain of racing 'for safety' lives in the belief")

    u0 = belief_game(0, D, q_self, q_other)
    eq0 = pure_nash(N, u0)
    check("b6", "Even with NO prize (W=0), racing is an equilibrium for developers who believe this",
          everyone(N, C) in eq0 and is_strict_nash(N, u0, everyone(N, C)),
          f"W=0 equilibria: {[show(e) for e in eq0]} (both continue: {num(u0(0, everyone(N, C)))} each)")

    # the two beliefs cannot both be right: for any true pair of safety levels,
    # "dev0 is safer than dev1" and "dev1 is safer than dev0" are never both true
    grid = [Fr(x, 100) for x in range(0, 31)]
    ok = all(not (t0 < t1 and t1 < t0) for t0 in grid for t1 in grid)
    check("b7", "The beliefs are mutually inconsistent: at most one developer can be the safer one",
          ok, "checked on a grid of true safety levels 0-30% for each developer")


# ================================================================ (c)
def case_c():
    header("(c) EXTERNALITY / PRINCIPAL-AGENT: the decision-maker carries a share s of the cost")
    B, D, p, s = Fr(10), Fr(1000), Fr(10, 100), Fr(5, 100)
    private = lambda s_, extra=Fr(0): B - p * (s_ * D + extra)
    social = B - p * D
    print(f"  One decision. Continue: private benefit B={num(B)}, catastrophe prob p={pct(p)},")
    print(f"  cost to the world D={num(D)}; the decision-maker's own ledger carries s={pct(s)} of D.")

    check("c1", "Continuing is privately rational: B - s*p*D > 0",
          private(s) == 5, f"{num(B)} - {num(s)} x {num(p)} x {num(D)} = {num(private(s))}")
    check("c2", "Continuing is socially suboptimal: B - p*D < 0",
          social == -90, f"{num(B)} - {num(p)} x {num(D)} = {num(social)}")

    s_star = B / (p * D)
    ok = True
    for x in range(0, 61):
        sx = Fr(x, 200)                                  # 0% .. 30% in 0.5% steps
        ok = ok and ((private(sx) > 0) == (sx < s_star)) and social < 0
    check("c3", f"Privately continue  <=>  s < B/(p*D) = {pct(s_star)} (sweep s = 0..30%)", ok and s_star == Fr(1, 10))

    t = (1 - s) * p * D
    check("c4", "A Pigouvian charge t = (1-s)*p*D, paid BEFORE, makes private = social and flips to stop",
          t == 95 and private(s) - t == social,
          f"t = {num(t)}; private with charge {num(private(s) - t)} = social {num(social)}")

    A = Fr(40)
    with_liab = private(s, extra=A)
    ok = True
    for a in range(0, 101):
        ok = ok and ((private(s, extra=Fr(a)) > 0) == (s * D + a < B / p))
    check("c5", "Liability AFTER the fact is capped by what the firm has: with assets 40 it still continues",
          with_liab == 1 and ok,
          f"own loss s*D={num(s * D)} + liability paid {num(A)} -> {num(B)} - {num(p)} x {num(s * D + A)} = {num(with_liab)}\n"
          f"stops only if own loss + payable liability >= B/p = {num(B / p)} (checked for assets 0..100)")

    check("c6", "If the catastrophe leaves no one to collect (extinction), liability is worth 0: back to +5",
          private(s, extra=Fr(0)) == 5, "no court, no insurer, no claimant after the fact")

    premium = p * (1 - s) * D
    reserve = (1 - s) * D
    check("c7", "Full insurance would cost the same 95 as the Pigouvian charge, and need 950 in reserve for the one bad state",
          premium == t and reserve == 950,
          f"fair premium p x (1-s) x D = {num(premium)}; payout needed if it happens = {num(reserve)}"
          f" = {pct(reserve / D)} of the world's loss")

    ok = True
    for beta in (Fr(1, 2), Fr(4, 5), Fr(1)):
        thr = beta * B / (p * D)
        for x in range(0, 61):
            sx = Fr(x, 200)
            ok = ok and ((beta * B - sx * p * D > 0) == (sx < thr))
    check("c8", "Principal-agent: with a share beta of the benefit, continue <=> s < beta*B/(p*D) (beta = .5, .8, 1)", ok)


# ================================================================ (d)
def case_d():
    header("(d) STAG HUNT: two equilibria; beliefs about others choose")
    N, D = 2, Fr(100)
    p = front_loaded(Fr(10, 100), Fr(2, 100))
    print(f"  N={N}, D={num(D)}. p(0)=0, p(1)={pct(p(1))}, p(2)={pct(p(2))}: most of the risk comes")
    print("  from the technology existing at all; the second racer adds 2 points.")

    def table(u):
        a = u(0, (S, S)); c = u(0, (C, S)); b = u(0, (S, C)); d = u(0, (C, C))
        return a, b, c, d

    def threshold(u):
        a, b, c, d = table(u)
        return (d - b) / ((a - c) + (d - b))

    for W, tag in ((Fr(9), "W=9"), (Fr(6), "W=6")):
        u = race_game(W, D, p)
        a, b, c, d = table(u)
        print(f"  --- {tag}:  SS={num(a)}  CS(me C)={num(c)}  SC(me S)={num(b)}  CC={num(d)}")

    # W = 9
    u9 = race_game(Fr(9), D, p)
    a, b, c, d = table(u9)
    eqs = pure_nash(N, u9)
    check("d1", "W=9: exactly two pure equilibria, all stop and all continue, both strict",
          eqs == [everyone(N, C), everyone(N, S)] and all(is_strict_nash(N, u9, e) for e in eqs),
          f"brute force -> {[show(e) for e in eqs]}")
    check("d2", "W=9: all stop is payoff-dominant (0 vs -7.5 each)", a == 0 and d == Fr(-15, 2) and a > d)
    loss_S, loss_C = a - c, d - b
    check("d3", "W=9: all continue is RISK-dominant (a wrong guess costs 2.5 there, only 1 at all stop)",
          loss_S == 1 and loss_C == Fr(5, 2) and loss_C ** 2 > loss_S ** 2,
          f"deviation loss at SS = {num(loss_S)}, at CC = {num(loss_C)} (Harsanyi-Selten product {num(loss_S ** 2)} vs {num(loss_C ** 2)})")
    r = threshold(u9)
    ok = r == Fr(5, 7)
    for j in range(0, 71):
        rr = Fr(j, 70)
        eS = rr * a + (1 - rr) * b
        eC = rr * c + (1 - rr) * d
        ok = ok and ((eS > eC) == (rr > r)) and ((eS == eC) == (rr == r))
    check("d4", f"W=9: stopping is my best reply only if I'm at least {pct(r)} sure the other stops (5/7)",
          ok, "at exactly 5/7 both replies pay the same: the mixed equilibrium, unstable")

    u6 = race_game(Fr(6), D, p)
    a6, b6, c6, d6 = table(u6)
    eq6 = pure_nash(N, u6)
    r6 = threshold(u6)
    check("d5", "W=6: same two equilibria, but now all stop is payoff- AND risk-dominant; threshold 20%",
          eq6 == [everyone(N, C), everyone(N, S)] and a6 > d6 and (a6 - c6) > (d6 - b6) and r6 == Fr(1, 5),
          f"deviation loss at SS = {num(a6 - c6)}, at CC = {num(d6 - b6)}; threshold {pct(r6)}")

    u3 = race_game(Fr(9), D, p)
    eq3 = pure_nash(3, u3)
    check("d6", "N=3, W=9, p = 10%, 12%, 14%: again exactly {all stop, all continue}",
          eq3 == [everyone(3, C), everyone(3, S)],
          f"brute force over 8 profiles -> {[show(e) for e in eq3]}")

    ok, count = True, 0
    for first in (Fr(5, 100), Fr(10, 100), Fr(15, 100)):
        for extra in (Fr(0), Fr(1, 100), Fr(2, 100), Fr(3, 100), Fr(5, 100)):
            pp = front_loaded(first, extra)
            for w in range(1, 31):
                uu = race_game(w, D, pp)
                brute = is_strict_nash(2, uu, everyone(2, S)) and is_strict_nash(2, uu, everyone(2, C))
                formula = w < pp(1) * D and Fr(w, 2) > (pp(2) - pp(1)) * D
                ok = ok and brute == formula
                count += 1
    check("d7", "Stag hunt (N=2)  <=>  W < p(1)*D  and  W/2 > (p(2)-p(1))*D",
          ok, f"{count} parameter sets, formula and brute force agree on all")

    ok = True
    for n in range(2, 5):
        for st in range(1, 6):
            for w in range(1, 101):
                uu = race_game(w, D, linear(Fr(st, 100)))
                if is_strict_nash(n, uu, everyone(n, S)) and is_strict_nash(n, uu, everyone(n, C)):
                    ok = False
    check("d8", "If every racer adds the same slice (linear p), a stag hunt is impossible (N=2..4, dp=1..5%, W=1..100)",
          ok, "stag hunt needs the first builder's risk to exceed N times the last racer's slice")

    ok, count = True, 0
    for n in range(2, 5):
        for first in range(1, 21):
            for extra in range(0, 8):
                pp = front_loaded(Fr(first, 100), Fr(extra, 100))
                exists = False
                for h in range(1, 61):                 # W = 0.5 .. 30 in steps of 0.5
                    uu = race_game(Fr(h, 2), D, pp)
                    if is_strict_nash(n, uu, everyone(n, S)) and is_strict_nash(n, uu, everyone(n, C)):
                        exists = True
                        break
                formula = pp(1) > n * (pp(n) - pp(n - 1))
                ok = ok and exists == formula
                count += 1
    check("d10", "Some prize makes both 'all stop' and 'all continue' strict equilibria  <=>  p(1) > N x (p(N)-p(N-1))",
          ok, f"{count} risk shapes (N=2..4, first builder 1-20%, each extra racer 0-7%), W on a 0.5 grid")

    uo = race_game(Fr(9), D, p, outsiders=1)
    eqo = pure_nash(N, uo)
    check("d9", "Add one outsider who builds no matter what: the stop equilibrium disappears",
          eqo == [everyone(N, C)] and all(strictly_dominant(N, uo, i, C) for i in range(N))
          and uo(0, everyone(N, S)) > uo(0, everyone(N, C)),
          f"insiders' equilibria: {[show(e) for e in eqo]}; both insiders stop -> {num(uo(0, everyone(N, S)))} each,"
          f" both continue -> {num(uo(0, everyone(N, C)))} each\n"
          "(the stag hunt has turned into a prisoner's dilemma)")

    # d11: the insiders only BELIEVE an outsider builds, with probability r
    u_in, u_out = race_game(Fr(9), D, p), race_game(Fr(9), D, p, outsiders=1)
    mix = lambda r: (lambda i, prof: (1 - r) * u_in(i, prof) + r * u_out(i, prof))
    r_star = Fr(2, 7)
    ok = all(is_strict_nash(N, mix(Fr(j, 100)), everyone(N, S)) == (Fr(j, 100) < r_star) for j in range(0, 101))
    check("d11", "If the insiders believe an outsider builds with probability r, the stop equilibrium survives iff r < 2/7",
          ok and r_star == Fr(2, 7),
          f"threshold r* = {pct(r_star)} at W = 9 (swept r = 0..100%): the belief, not only the fact, removes the good ending")


# ================================================================ (e)
def case_e():
    header("(e) ONE PLANNER: when 'rational' depends on a value choice")
    V, D = Fr(20), Fr(100)
    val = lambda p, cost=D: (1 - p) * V - p * cost
    p = Fr(10, 100)
    print(f"  A single planner who controls all the risk. Continue: with prob 1-p the world gains V={num(V)};")
    print(f"  with prob p a catastrophe costs D={num(D)} (the present world). Stop: 0.")

    check("e1", "At p = 10% a utilitarian planner CONTINUES: (1-p)V - pD = 18 - 10 = 8 > 0", val(p) == 8)

    p_star = V / (V + D)
    ok = True
    for j in range(0, 101):
        pj = Fr(j, 200)                                  # 0 .. 50% in 0.5% steps
        ok = ok and ((val(pj) > 0) == (pj < p_star))
    check("e2", f"Planner continues  <=>  p < V/(V+D) = {pct(p_star)} (sweep p = 0..50%)",
          ok and p_star == Fr(1, 6),
          f"with V = D (the technology doubles the world's value) the threshold is {pct(Fr(1, 2))}")

    L = Fr(1)
    L_star = val(p) / (p * D)
    ok = True
    for j in range(0, 301):
        Lj = Fr(j, 100)
        ok = ok and ((val(p, D * (1 + Lj)) > 0) == (Lj < L_star))
    check("e3", "Count extinction as losing the future too (cost D x (1+L)): at L=1 the planner STOPS",
          val(p, D * (1 + L)) == -2 and L_star == Fr(4, 5) and ok,
          f"L=1: 18 - 0.1 x 200 = {num(val(p, D * (1 + L)))}; the decision flips once L > {num(L_star)} (sweep L = 0..3)")

    lo, hi = Fr(0), Fr(20, 100)
    grid = [lo + (hi - lo) * Fr(j, 40) for j in range(41)]
    worst = min(val(q) for q in grid)
    mid = val((lo + hi) / 2)
    check("e4", "Deep uncertainty, p somewhere in 0..20% (middle 10%): expected value continues, maximin stops",
          mid == 8 and worst == -4 and val(hi) == worst,
          f"value at the middle guess 10%: {num(mid)};  worst case (p = 20%): {num(worst)}")

    lo2, hi2 = Fr(5, 100), Fr(15, 100)
    grid2 = [lo2 + (hi2 - lo2) * Fr(j, 40) for j in range(41)]
    worst2 = min(val(q) for q in grid2)
    check("e5", "Same middle guess, narrower range 5..15%: even maximin continues (top of range < 16.7%)",
          worst2 == 2 and hi2 < p_star, f"worst case (p = 15%): {num(worst2)}")

    # e6: the other direction for V, a factual (not value) route to stopping
    V5 = Fr(5)
    val5 = (1 - p) * V5 - p * D
    check("e6", "If the technology adds only 5% to the world (V = 5), the threshold is 4.8% and at 10% the planner STOPS",
          V5 / (V5 + D) == Fr(1, 21) and val5 == Fr(-11, 2),
          f"threshold V/(V+D) = {pct(V5 / (V5 + D))}; value at 10%: {num(val5)}  (a small benefit is a factual route to 'stop')")

    # e6b: Harris's 'roll of a normal die' (1/6) sits exactly at the V = 20 threshold
    check("e6b", "At p = 1/6 (a die roll) the V = 20 planner is exactly indifferent; at a coin toss it stops unless V >= D",
          val(Fr(1, 6)) == 0 and val(Fr(1, 2)) < 0 and ((1 - Fr(1, 2)) * D - Fr(1, 2) * D) == 0)

    # e7: the value of a pause that lets you learn p (p is 0% or 20% with equal odds, mean 10%)
    now = Fr(1, 2) * val(Fr(0)) + Fr(1, 2) * val(Fr(20, 100))
    def pause(c):                        # learn p first, delay costs a share c of V; build only if safe
        return Fr(1, 2) * (1 - c) * V + Fr(1, 2) * 0
    c_star = 1 - now / (Fr(1, 2) * V)
    check("e7", "Pausing to learn p is worth more than building now unless the delay costs more than 20% of the benefit",
          now == 8 and pause(Fr(0)) == 10 and pause(Fr(1, 4)) == Fr(15, 2) and c_star == Fr(1, 5),
          f"build now: {num(now)};  pause and learn: {num(pause(Fr(0)))} (no delay cost), {num(pause(Fr(1,4)))} (delay costs 25%)")


# ================================================================ (g)
def case_g():
    header("(g) GAMBLING FOR RESURRECTION: when stopping already means ruin")
    # A self-regarding developer whose losses are capped at F (it owns F). A rival builds
    # regardless: risk p_o if only the rival builds, p if both build. If this developer stops,
    # it loses S of its F for sure, or everything if the rival's build ends in catastrophe.
    # If it continues, it wins W with chance q(1-p); otherwise it hits the floor -F.
    F, W, q, p_o = Fr(100), Fr(20), Fr(1, 2), Fr(10, 100)
    cont = lambda p: q * (1 - p) * W - (1 - q * (1 - p)) * F
    stop = lambda S: -(1 - p_o) * S - p_o * F
    print(f"  Losses capped at F={num(F)}. Win W={num(W)} with chance q={num(q)} if no catastrophe.")
    print(f"  A rival builds anyway: risk {pct(p_o)} if only the rival builds, p if both do.")
    print("  Stop: lose S for sure (or everything, if the rival's build goes wrong). Continue: win, or the floor.")

    ok = all(cont(Fr(j, 100)) > stop(F) for j in range(10, 100))
    check("g1", "If stopping means ruin (S = F), continuing is better at every p below 100%, for any agent that prefers more to less",
          ok and cont(Fr(12, 100)) == Fr(-236, 5) and cont(Fr(90, 100)) == -94 and stop(F) == -100,
          f"p = 12%: continue {num(cont(Fr(12,100)))} vs stop -100;  p = 90%: continue {num(cont(Fr(90,100)))} vs stop -100\n"
          "(at S = F the stop branch is the floor itself, so continuing dominates outcome by outcome)")

    ok = True
    for S in [Fr(v) for v in range(0, 101, 5)]:
        for j in range(10, 100):
            p = Fr(j, 100)
            ok = ok and ((cont(p) > stop(S)) == (q * (1 - p) * (W + F) > (1 - p_o) * (F - S)))
    check("g2", "Continue  <=>  q(1-p)(W+F) > (1-p_o)(F-S)   (sweep S = 0..100, p = 10..99%)", ok)

    p_star = lambda S: 1 - (1 - p_o) * (F - S) / (q * (W + F))
    check("g3", "Risk the developer will accept rises as stopping nears ruin",
          p_star(Fr(60)) == Fr(2, 5) and p_star(Fr(90)) == Fr(17, 20) and p_star(Fr(40)) == Fr(1, 10),
          f"S = 40: continues only below {pct(p_star(Fr(40)))} (so never, once both build);  "
          f"S = 60: below {pct(p_star(Fr(60)))};  S = 90: below {pct(p_star(Fr(90)))}")

    # g4: the world's ledger. The gambler, the rival (same F, W), and everyone else, who lose R
    # in a catastrophe. The world is 100 times the size of one developer.
    R = Fr(10000)
    def rival(p, both):
        win = (1 - p) * (q if both else 1)
        return win * W - (1 - win) * F
    p = Fr(12, 100)
    d_gambler = cont(p) - stop(F)
    d_rival = rival(p, True) - rival(p_o, False)
    d_rest = -(p - p_o) * R
    d_world = d_gambler + d_rival + d_rest
    check("g4", "For the world the same move is a loss: the gambler gains, the rival and everyone else lose more",
          d_gambler > 0 and d_rival < 0 and d_world < 0,
          f"at p = 12%: gambler {num(d_gambler)}, rival {num(d_rival)}, everyone else {num(d_rest)}, world {num(d_world)}\n"
          "the gambler's floor at its own ruin does not exist for anyone else")

    # g5: the gamble is rational only for an agent that counts nothing below its own ruin
    alpha = Fr(1, 100)                       # weight on everyone else's loss
    with_others = lambda p: cont(p) - alpha * p * R
    stop_others = stop(F) - alpha * p_o * R
    check("g5", "Give the gambler even a 1% weight on everyone else's loss and, at a coin toss, it stops",
          with_others(Fr(1, 2)) < stop_others and with_others(Fr(12, 100)) > stop_others,
          f"p = 12%: continue {num(with_others(Fr(12,100)))} vs stop {num(stop_others)};  "
          f"p = 50%: continue {num(with_others(Fr(1,2)))} vs stop {num(stop_others)}")


# ================================================================ (f)
def case_f():
    header("(f) OPTIONAL, POPULATION VERSION OF (d): tipping points and committed minorities")
    print("  Many developers meet in random pairs and play the N=2 game of (d); the share of")
    print("  stoppers x grows when stopping pays more than continuing (replicator dynamics).")
    print("  A metaphor for how a norm spreads, not a model of real labs.")
    D = 100.0
    p1, p2 = 0.10, 0.12

    def payoffs(W, x):
        a, c = 0.0, W - p1 * D                 # other stops: I stop / I continue
        b, d = -p1 * D, W / 2 - p2 * D         # other continues: I stop / I continue
        return x * a + (1 - x) * b, x * c + (1 - x) * d

    def run(W, x0, committed=0.0, steps=40000, eta=0.05):
        y = x0                                 # share of FLEXIBLE developers who stop
        for _ in range(steps):
            x = committed + (1 - committed) * y
            eS, eC = payoffs(W, x)
            y += eta * y * (1 - y) * (eS - eC)
            y = min(max(y, 0.0), 1.0)
        return committed + (1 - committed) * y

    lines, ok = [], True
    for W, r, starts in ((6.0, 0.2, (0.15, 0.25)), (9.0, 5 / 7, (0.70, 0.75))):
        for x0 in starts:
            end = run(W, x0)
            expect_stop = x0 > r
            good = (end > 0.999) if expect_stop else (end < 0.001)
            ok = ok and good
            lines.append(f"W={W:g}: start with {x0:.0%} stoppers -> {end:.1%} stoppers (threshold {r:.1%})")
    check("f1", "Below the threshold everyone ends up continuing, above it everyone ends up stopping",
          ok, "\n".join(lines))

    lines, ok = [], True
    for W, z, expect_stop in ((6.0, 0.25, True), (6.0, 0.15, False), (9.0, 0.25, False), (9.0, 0.75, True)):
        end = run(W, 0.01, committed=z)
        flexible = (end - z) / (1 - z)
        good = (flexible > 0.999) if expect_stop else (flexible < 0.001)
        ok = ok and good
        lines.append(f"W={W:g}, committed stoppers {z:.0%}, flexible start 1% -> flexible stoppers {flexible:.1%}")
    check("f2", "A committed group larger than the threshold tips everyone to stopping (25% suffices at W=6; at W=9 it takes 75%, a majority)",
          ok, "\n".join(lines))


# ================================================================ main
def main():
    print("race_model.py -- toy models for 'rational to continue, but suboptimal'")
    print("All payoffs are in abstract units. Parameters are illustrative, not estimates.")
    case_a()
    case_a_coin()
    case_b()
    case_c()
    case_d()
    case_e()
    case_f()
    case_g()
    header("SUMMARY")
    fails = [r for r in RESULTS if not r[2]]
    book = {"b5", "b7", "c6"}          # true by construction, a tautology, and a repeat of c1
    subst = [r for r in RESULTS if r[0] not in book]
    print(f"  {len(RESULTS) - len(fails)} of {len(RESULTS)} claims PASS "
          f"({len(subst)} substantive, {len(RESULTS) - len(subst)} bookkeeping: {', '.join(sorted(book))})")
    for tag, claim, _ in fails:
        print(f"  FAIL: {tag} {claim}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
