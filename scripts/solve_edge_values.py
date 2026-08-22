#!/usr/bin/env python3
"""
EDGE — a finite-horizon MDP over the 272 position role-nodes in ``graph.json``.

WHAT THIS ANSWERS
-----------------
"How much better or worse is this move than the ordinary choice from where I am
standing, counting not just whether it works but where a miss leaves me?"

    V  = p_win - lam * p_loss          (my turn)
    U  = the same, when it is THEIR turn      (state always written from MY side)
    Q(s,a) = p * A(s,a) + (1-p) * B(s,a)      p = successRate/100
    EDGE(s,a) = round(100 * (Q(s,a) - baseline(s)))
    baseline(s) = sum over a of attempt%(a) * Q(s,a)      <- "the ordinary choice"

THE FOUR THINGS THAT ARE EASY TO GET WRONG
------------------------------------------
1. INITIATIVE IS ASYMMETRIC, and it is the shipped rule.  Read off
   ``neural/src/app.src.jsx``:

     my move succeeds       enterSuccessCal -> enterLand(false)      I MOVE AGAIN, 1 ply
     my move misses + moves enterFailCal -> startTravel -> opponentDefend()   1 ply, their turn
     my move misses in place enterFailCal early-return, no startTravel        0 PLIES, their turn
     their move, any outcome opponentDefend -> enterLand(false)       1 ply, BACK TO ME
     I fail an escape       enterDefense's finish()                   LOSS

   The opponent NEVER keeps initiative.  That is a large permanent player
   advantage; it is what ships, so it is what is modelled.

2. THE OPPONENT SAMPLES THE *PAIRED* ROLE-NODE'S AUTHORED TRANSITIONS.  I am at
   ``<hub>/<myRole>``; they occupy ``<hub>/<oppRole>`` and draw from ITS
   ``transitions[]`` by ``attemptProbability``.  Their move's outcomes are read
   from the technique's ``/attacker`` node (they are the attacker of their own
   move) and the landing role suffix is FLIPPED back into my frame.  The
   ``/defender`` nodes are never needed - they carry no independent information
   (six invariants, 1331 pairs, zero violations; see ``selfcheck``).

   Without this mirror every state scores ~+1.0000 and being back-mounted is a
   win.  ``--models`` prints that control table.

3. THE 42 HUB-TARGET OUTCOME CELLS ARE CHAINED, NOT DROPPED.  21 of them sit on
   ``/attacker`` nodes (the only half this model reads); 17 are the ENTIRE
   success branch of their node.  Dropping them zeroes those 17 success branches
   and manufactures a false "19 broken content nodes" finding.  There is no
   second-level chain, and ``selfcheck`` asserts it.

4. ACTIONS ARE ORIGIN-FILTERED.  ``optionsFor`` deals only moves whose
   ``fromPositionId`` equals the hub you are standing on, and only moves your
   ``fromRole`` performs.  When origin empties a hand the app relaxes ORIGIN,
   NEVER ROLE - and so does this model (3 role-nodes in no-gi, 1 in gi).

USAGE
-----
    python3 scripts/solve_edge_values.py                  # the full report
    python3 scripts/solve_edge_values.py --hand side-control/bottom
    python3 scripts/solve_edge_values.py --lam 4 --horizon 12

    from solve_edge_values import load_graph, solve
    sol = solve(load_graph(), lam=2.0, H=11)
    sol.v["mount/top"], sol.edge["side-control/bottom"]

Deterministic: states are iterated in sorted order, actions in authored order,
and nothing here draws a random number.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPH_PATH = os.path.join(REPO, "graph.json")

# outcome kinds, in the ACTOR's frame
W, L, S = "W", "L", "S"          # actor wins / actor loses / continue at a state

HORIZON_MIX = (9, 10, 11, 12)    # maxMoves = 9 + ((rng*4)|0)   app.src.jsx:9667


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def is_role(key: str) -> bool:
    return key.endswith("/top") or key.endswith("/bottom")


def flip(key: str) -> str:
    """Flip a role suffix: my frame <-> their frame."""
    if key.endswith("/top"):
        return key[:-4] + "/bottom"
    if key.endswith("/bottom"):
        return key[:-7] + "/top"
    return key


def load_graph(path: str = GRAPH_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


class Opts:
    """Model knobs.  Defaults are the shipped model."""

    __slots__ = ("frame", "chain", "origin", "stayput", "initiative", "policy",
                 "opponent", "qform")

    def __init__(self, frame="nogi", chain="label", origin=True, stayput="rolenode",
                 initiative="shipped", policy="argmax", opponent="mirror", qform="branch"):
        # chain      : label | actor | drop      (see build_action)
        # stayput    : rolenode | hub | charge   (0-ply rule; "charge" = always 1 ply)
        # initiative : shipped | symmetric       (symmetric = the opponent keeps theirs too)
        # policy     : argmax | sample
        # opponent   : mirror (A) | mylist (D) | none (E)
        # qform      : branch   -> p = successRate/100, the number the card shows and
        #                         drilling moves, so build-time EDGE == the card at zero drill
        #              marginal -> p = the authored success-cell mass.  Identical except on
        #                         the 29 /attacker nodes where successRate is a rounded copy
        #                         of that mass; measured, it moves 9 of 1246 EDGE integers by 1.
        self.frame, self.chain, self.origin = frame, chain, origin
        self.stayput, self.initiative = stayput, initiative
        self.policy, self.opponent, self.qform = policy, opponent, qform

    def replace(self, **kw) -> "Opts":
        cur = {k: getattr(self, k) for k in self.__slots__}
        cur.update(kw)
        return Opts(**cur)

    def __repr__(self):
        return "Opts(%s)" % ", ".join("%s=%r" % (k, getattr(self, k)) for k in self.__slots__)


# --------------------------------------------------------------------------- #
# the action kernel
# --------------------------------------------------------------------------- #
class Action:
    """One dealt card: its odds and its two branches, in the ACTOR's frame."""

    __slots__ = ("name", "target", "cat", "weight", "p", "succ", "miss", "empty_branch")

    def __init__(self, name, target, cat, weight, p, succ, miss, empty_branch):
        self.name, self.target, self.cat = name, target, cat
        self.weight = weight          # attempt share within the dealt hand, 0..1
        self.p = p                    # successRate/100 -- the number drilling moves
        self.succ = succ              # [(w_within_branch, outcome)] summing to 1
        self.miss = miss
        self.empty_branch = empty_branch


def _chain_target(graph, to):
    """A hub-target outcome cell resolves to the chained submission's /attacker node."""
    return graph["submissions"].get(to + "/attacker") or graph["transitions"].get(to + "/attacker")


def _cell_outcome(to, result, actor_frame=True):
    """A plain outcome cell -> (kind, state, keeps_turn) in the actor's frame."""
    if to == "game-over":
        # all 594 game-over cells sit on submission /attacker nodes: the performer wins
        return (W,) if actor_frame else (L,)
    st = to if actor_frame else flip(to)
    return (S, st, result == "success" and actor_frame)


def build_action(graph, tech, opts):
    """
    Expand one technique's /attacker node into (p, success-branch, miss-branch).

    Branch membership is decided by the AUTHORED cell label, so the 17 nodes whose
    whole success branch is a chained hub cell keep a success branch.  Within a
    branch the weights are renormalised to 1.

    Chaining (``opts.chain``):
      label  - a `success` chain is performed by the ACTOR (their game-over = actor
               wins); a `failure`/`counter` chain is performed by the OPPONENT (their
               game-over = actor LOSES, landing roles flip).  This is what the labels
               mean, and it matches the 3 same-hub counter cells whose authored
               performer really does flip.
      actor  - the actor always performs the chained submission (the flat reading).
      drop   - drop the cell and renormalise its branch (the model artifact that
               manufactures the false "19 broken nodes" finding; kept as a control).
    """
    succ_raw, miss_raw = [], []
    for o in tech.get("outcomes") or []:
        to, res, prob = o["to"], o["result"], float(o["probability"])
        bucket = succ_raw if res == "success" else miss_raw
        if to == "game-over" or is_role(to):
            bucket.append((prob, _cell_outcome(to, res)))
            continue
        # hub target -> chained submission
        if opts.chain == "drop":
            continue
        ch = _chain_target(graph, to)
        if ch is None:                       # never happens today; selfcheck asserts it
            continue
        by_actor = True if opts.chain == "actor" else (res == "success")
        for co in ch.get("outcomes") or []:
            bucket.append((prob * float(co["probability"]) / 100.0,
                           _cell_outcome(co["to"], co["result"], actor_frame=by_actor)))

    empty, out, mass = 0, [], []
    for raw in (succ_raw, miss_raw):
        tot = sum(w for w, _ in raw)
        mass.append(tot)
        if tot <= 0:
            empty += 1
            out.append([])
        else:
            out.append([(w / tot, oc) for w, oc in raw])
    if opts.qform == "marginal":
        p = mass[0] / (mass[0] + mass[1]) if (mass[0] + mass[1]) else 0.0
    else:
        p = (tech.get("successRate") or 0.0) / 100.0
    return p, out[0], out[1], empty


def build_hand(graph, key, opts):
    """
    The dealt hand at a role-node: role-filtered, origin-filtered (relaxing ORIGIN
    and never ROLE when that empties it), weights renormalised to 1.
    """
    node = graph["positions"][key]
    hub, role = node["hub"], node["role"]
    picks = []
    for t in node.get("transitions") or []:
        att = float(t["attemptProbabilityByRuleset"][opts.frame])
        if att <= 0:
            continue
        cat = "submissions" if t.get("isSubmission") else "transitions"
        tech = graph[cat].get(t["target"] + "/attacker")
        if tech is None:
            continue
        if tech.get("fromRole") != role:      # the role filter is NEVER relaxed
            continue
        picks.append((t, att, cat, tech))

    same = [x for x in picks if x[3].get("fromPositionId") == hub]
    use, relaxed = (same, False) if (same and opts.origin) else (picks, bool(opts.origin))
    tot = sum(x[1] for x in use)
    hand = []
    for t, att, cat, tech in use:
        p, succ, miss, empty = build_action(graph, tech, opts)
        hand.append(Action(t["technique"], t["target"], cat, att / tot if tot else 0.0,
                           p, succ, miss, empty))
    return hand, relaxed


class Model:
    """The 272-state kernel: my hand at each state, and the opponent's."""

    def __init__(self, graph, opts):
        self.graph, self.opts = graph, opts
        P = graph["positions"]
        self.states = tuple(sorted(k for k in P if is_role(k)))
        self.index = {s: i for i, s in enumerate(self.states)}
        self.hands, self.relaxed = [], []
        for s in self.states:
            h, r = build_hand(graph, s, opts)
            self.hands.append(h)
            if r:
                self.relaxed.append(s)
        # the opponent's hand at MY state i = the paired role-node's hand
        self.opp_hands = []
        for i, s in enumerate(self.states):
            if opts.opponent == "mylist":
                self.opp_hands.append(self.hands[i])          # model D: they draw MY list
            elif opts.opponent == "none":
                self.opp_hands.append([])                     # model E
            else:
                self.opp_hands.append(self.hands[self.index[flip(s)]])
        self.flipidx = [self.index[flip(s)] for s in self.states]


# --------------------------------------------------------------------------- #
# the solve
# --------------------------------------------------------------------------- #
class Solution:
    __slots__ = ("model", "lam", "H", "opts", "v", "pwin", "ploss", "pdraw",
                 "uw", "ul", "q", "baseline", "edge", "conv", "best")

    def state_row(self, s):
        return (self.v[s], self.pwin[s], self.ploss[s], self.pdraw[s])


def edge_str(e):
    """Render 0, never -0 (§4.2)."""
    return "0" if e == 0 else "%+d" % e


def solve(graph, lam=2.0, H=11, opts=None, **kw):
    """
    Backward induction over ``H`` plies.  Returns a ``Solution``.

    ``U[m]`` reads only ``V[m-1]``, so the 0-ply stay-put rule is well founded:
    ``V[m]`` may read ``U[m]`` at the same horizon, and ``U[m]`` is computed first.
    """
    opts = (opts or Opts()).replace(**kw) if kw else (opts or Opts())
    model = graph if isinstance(graph, Model) else Model(graph, opts)
    if isinstance(graph, Model):
        opts = model.opts
    n = len(model.states)
    fi = model.flipidx
    sym = opts.initiative == "symmetric"
    argmax = opts.policy == "argmax"
    noopp = opts.opponent == "none"       # model E: the opponent's turn never occurs
    idx = model.index

    # resolve every continuation state to an index once
    def resolve(hand, mine):
        out = []
        for a in hand:
            br = []
            for w, cells in ((a.p, a.succ), (1.0 - a.p, a.miss)):
                cc = []
                for cw, oc in cells:
                    if oc[0] is S:
                        j = idx.get(oc[1] if mine else flip(oc[1]), -1)
                        cc.append((cw, S, j, oc[2]))
                    else:
                        cc.append((cw, oc[0], -1, False))
                br.append((w, cc))
            out.append((a, br))
        return out

    mine = [resolve(h, True) for h in model.hands]
    theirs = [resolve(h, False) for h in model.opp_hands]

    Vw = [0.0] * n
    Vl = [0.0] * n
    Uw = [0.0] * n
    Ul = [0.0] * n
    conv = []
    best = [None] * n
    qtab = [None] * n

    for m in range(1, H + 1):
        pVw, pVl, pUw, pUl = Vw, Vl, Uw, Ul

        # ---- THEIR turn.  Reads V[m-1] (and U[m-1] only under the symmetric control)
        nUw = [0.0] * n
        nUl = [0.0] * n
        for i in range(n):
            hand = theirs[i]
            if not hand:
                # A genuinely optionless opponent is endRound("reset") = a draw, which is
                # the 0.0 already sitting here.  (Model E never reaches this loop at all:
                # there is no opponent turn to take, so a "hand-over" is me keeping the
                # turn -- see `noopp` in the V recursion below.)
                continue
            w = l = 0.0
            for a, br in hand:
                aw = al = 0.0
                for bw, cells in br:
                    if bw <= 0.0 or not cells:
                        continue
                    for cw, k, j, keeps in cells:
                        x = bw * cw
                        if k is W:                        # THEY win -> I lose
                            al += x
                        elif k is L:
                            aw += x
                        elif j >= 0:
                            if sym and keeps:             # symmetric control only
                                aw += x * pUw[j]
                                al += x * pUl[j]
                            else:                         # shipped: always back to me
                                aw += x * pVw[j]
                                al += x * pVl[j]
                w += a.weight * aw
                l += a.weight * al                        # the opponent always SAMPLES
            nUw[i], nUl[i] = w, l
        Uw, Ul = nUw, nUl

        # ---- MY turn.  May read U[m] at the same horizon (the free stay-put ply)
        nVw = [0.0] * n
        nVl = [0.0] * n
        nbest = [None] * n
        nq = [None] * n
        for i in range(n):
            hand = mine[i]
            rows = []
            for a, br in hand:
                aw = al = 0.0
                bvals = []
                for bw, cells in br:
                    bw_w = bw_l = 0.0
                    for cw, k, j, keeps in cells:
                        if k is W:
                            bw_w += cw
                        elif k is L:
                            bw_l += cw
                        elif j >= 0:
                            if keeps or noopp:            # my success keeps my turn
                                bw_w += cw * pVw[j]
                                bw_l += cw * pVl[j]
                            elif (not sym) and _stays(opts, i, j, fi):
                                bw_w += cw * Uw[j]        # 0 plies, same horizon
                                bw_l += cw * Ul[j]
                            else:
                                bw_w += cw * pUw[j]
                                bw_l += cw * pUl[j]
                    bvals.append((bw_w, bw_l))
                    aw += bw * bw_w
                    al += bw * bw_l
                rows.append((a, aw, al, bvals))
            if not rows:
                nVw[i] = nVl[i] = 0.0
                nq[i] = []
                continue
            if argmax:
                bi = 0
                bs = rows[0][1] - lam * rows[0][2]
                for t in range(1, len(rows)):
                    sc = rows[t][1] - lam * rows[t][2]
                    if sc > bs:
                        bs, bi = sc, t
                nVw[i], nVl[i] = rows[bi][1], rows[bi][2]
                nbest[i] = rows[bi][0].name
            else:
                nVw[i] = sum(r[0].weight * r[1] for r in rows)
                nVl[i] = sum(r[0].weight * r[2] for r in rows)
            nq[i] = rows
        Vw, Vl, best, qtab = nVw, nVl, nbest, nq
        conv.append(max(abs(Vw[i] - pVw[i]) + abs(Vl[i] - pVl[i]) for i in range(n)))

    sol = Solution()
    sol.model, sol.lam, sol.H, sol.opts = model, lam, H, opts
    sol.conv = conv
    sol.pwin = {s: Vw[i] for i, s in enumerate(model.states)}
    sol.ploss = {s: Vl[i] for i, s in enumerate(model.states)}
    sol.pdraw = {s: max(0.0, 1.0 - Vw[i] - Vl[i]) for i, s in enumerate(model.states)}
    sol.v = {s: Vw[i] - lam * Vl[i] for i, s in enumerate(model.states)}
    sol.uw = {s: Uw[i] for i, s in enumerate(model.states)}
    sol.ul = {s: Ul[i] for i, s in enumerate(model.states)}
    sol.best = {s: best[i] for i, s in enumerate(model.states)}
    sol.q, sol.baseline, sol.edge = {}, {}, {}
    for i, s in enumerate(model.states):
        rows = []
        for a, aw, al, bvals in (qtab[i] or []):
            rows.append({"name": a.name, "target": a.target, "cat": a.cat,
                         "attempt": a.weight, "odds": a.p,
                         "q": aw - lam * al, "qw": aw, "ql": al,
                         "A": bvals[0][0] - lam * bvals[0][1] if bvals else 0.0,
                         "B": bvals[1][0] - lam * bvals[1][1] if bvals else 0.0})
        base = sum(r["attempt"] * r["q"] for r in rows)
        for r in rows:
            r["edge"] = int(round(100.0 * (r["q"] - base))) + 0   # +0 kills "-0"
        rows.sort(key=lambda r: (-round(r["q"] * 100000), -r["odds"], -r["attempt"], r["name"]))
        sol.q[s], sol.baseline[s], sol.edge[s] = rows, base, {r["name"]: r["edge"] for r in rows}
    return sol


def _stays(opts, i, j, fi):
    """The 0-ply stay-put rule: enterFailCal early-returns when dest == currentPos."""
    if opts.stayput == "charge":
        return False
    if opts.stayput == "hub":        # the app compares HUB-COLLAPSED node indices
        return j == i or j == fi[i]
    return j == i                    # the MDP's own state identity (role-node)


def solve_mixture(graph, lam=2.0, horizons=HORIZON_MIX, opts=None, **kw):
    """maxMoves is uniform on {9,10,11,12}; this is what would ship."""
    sols = [solve(graph, lam, h, opts, **kw) for h in horizons]
    out = Solution()
    out.model, out.lam, out.H, out.opts = sols[-1].model, lam, horizons, sols[-1].opts
    out.conv = sols[-1].conv
    k = 1.0 / len(sols)
    for f in ("v", "pwin", "ploss", "pdraw", "uw", "ul", "baseline"):
        setattr(out, f, {s: sum(getattr(x, f)[s] for x in sols) * k for s in sols[0].v})
    out.best = sols[-1].best
    out.q, out.edge = {}, {}
    for s in sols[0].q:
        byname = {}
        for x in sols:
            for r in x.q[s]:
                d = byname.setdefault(r["name"], dict(r, q=0.0, qw=0.0, ql=0.0, A=0.0, B=0.0))
                for f in ("q", "qw", "ql", "A", "B"):
                    d[f] += r[f] * k
        rows = list(byname.values())
        base = sum(r["attempt"] * r["q"] for r in rows)
        for r in rows:
            r["edge"] = int(round(100.0 * (r["q"] - base))) + 0
        rows.sort(key=lambda r: (-round(r["q"] * 100000), -r["odds"], -r["attempt"], r["name"]))
        out.q[s], out.baseline[s], out.edge[s] = rows, base, {r["name"]: r["edge"] for r in rows}
    return out


# --------------------------------------------------------------------------- #
# the build-failing self-check
# --------------------------------------------------------------------------- #
def selfcheck(graph):
    """Every structural fact the solve depends on.  Returns [(name, ok, detail)]."""
    P = graph["positions"]
    checks = []
    roles = sorted(k for k in P if is_role(k))
    checks.append(("272 position role-nodes", len(roles) == 272, "%d" % len(roles)))
    checks.append(("non-role position entries carry no transitions",
                   all(not P[k].get("transitions") for k in P if not is_role(k)),
                   "%d entries" % (len(P) - len(roles))))

    bad = [k for k in roles
           if any(abs(sum(t["attemptProbabilityByRuleset"][f] for t in P[k]["transitions"]) - 100) > 1e-6
                  for f in ("gi", "nogi"))
           or abs(sum(t["attemptProbability"] for t in P[k]["transitions"]) - 100) > 1e-6]
    checks.append(("attempt sums == 100 (scalar/gi/nogi)", not bad,
                   "%d/%d ok" % (len(roles) - len(bad), len(roles))))

    tech, sums, chain, second, go_from_trans, unresolved = 0, 0, 0, 0, 0, 0
    for cat in ("transitions", "submissions"):
        for k, nd in graph[cat].items():
            if not (k.endswith("/attacker") or k.endswith("/defender")):
                continue
            tech += 1
            oc = nd.get("outcomes") or []
            if abs(sum(o["probability"] for o in oc) - 100) <= 1e-6:
                sums += 1
            for o in oc:
                to = o["to"]
                if to == "game-over":
                    if cat != "submissions":
                        go_from_trans += 1
                    continue
                if is_role(to):
                    if to not in P:
                        unresolved += 1
                    continue
                chain += 1
                ch = _chain_target(graph, to)
                if ch is None:
                    unresolved += 1
                    continue
                second += sum(1 for c in ch.get("outcomes") or []
                              if c["to"] != "game-over" and not is_role(c["to"]))
    checks.append(("outcome sums == 100", sums == tech, "%d/%d" % (sums, tech)))
    checks.append(("every outcome target resolves", unresolved == 0, "%d unresolved" % unresolved))
    checks.append(("game-over reached only from submissions", go_from_trans == 0,
                   "%d transition cells reach it" % go_from_trans))
    checks.append(("no second-level chain", second == 0,
                   "%d chain cells, %d second-level" % (chain, second)))

    pairs, viol = 0, Counter()
    for cat in ("transitions", "submissions"):
        for k, a in graph[cat].items():
            if not k.endswith("/attacker"):
                continue
            d = graph[cat].get(k[:-9] + "/defender")
            if d is None:
                viol["missing_defender"] += 1
                continue
            pairs += 1
            if abs((a.get("successRate") or 0) + (d.get("successRate") or 0) - 100) > 1e-6:
                viol["successRate"] += 1
            if not (a.get("fromRole") and d.get("fromRole") and a["fromRole"] != d["fromRole"]):
                viol["fromRole"] += 1
            ao, do = a.get("outcomes") or [], d.get("outcomes") or []
            if len(ao) != len(do):
                viol["outcome_count"] += 1
                continue
            for x, y in zip(ao, do):
                if flip(x["to"]) != y["to"]:
                    viol["to_flip"] += 1
                if x["probability"] != y["probability"]:
                    viol["probability"] += 1
            sa, sd = a.get("strength"), d.get("strength")
            if sa is None or sd is None or abs(sa + sd) > 1e-9:
                viol["strength"] += 1
    checks.append(("attacker/defender mirror, 6 invariants",
                   not viol, "%d pairs, violations: %s" % (pairs, dict(viol) or "ZERO")))
    return checks


def symmetric_residual(graph, lam=2.0, H=11, opts=None):
    """
    p_win(V[m][s]) vs p_loss(U[m][opp(s)]).  Under the fully symmetric control this
    is EXACTLY zero at every horizon; under the shipped rules the residual measures
    the asymmetry (argmax, initiative, the free stay-put ply).

    READ THE LIMIT OF THIS BEFORE QUOTING IT.  Under full symmetry the identity is
    provable by induction from nothing but "flip is an involution" and "the opponent's
    hand at opp(x) is my hand at x" -- so it is very nearly a TAUTOLOGY, and
    ``--mutants`` proves it: corrupting an /attacker outcome cell leaves the residual
    at 2e-16, and making flip() the identity leaves it at exactly 0.  It therefore
    CANNOT witness "the attacker/defender mirror has no content violations".  The
    evidence for that claim is the 6-invariant test over all 1331 pairs in
    ``selfcheck``, which does fail on a single flipped probability.
    """
    o = (opts or Opts())
    sol = solve(graph, lam, H, o)
    m = sol.model
    worst, tot, mx = None, 0.0, 0.0
    for s in m.states:
        d = abs(sol.pwin[s] - sol.ul[flip(s)])
        tot += d
        if d > mx:
            mx, worst = d, s
    return tot / len(m.states), mx, worst


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #
BOARD = ["back-control/top", "mount/top", "side-control/top", "north-south/top",
         "knee-on-belly/top", "closed-guard/bottom", "standing-position/top",
         "half-guard/top", "closed-guard/top", "mount/bottom", "side-control/bottom",
         "back-control/bottom"]


def _rank(sol, s):
    order = sorted(sol.v, key=lambda k: -sol.v[k])
    return order.index(s) + 1


def print_hand(sol, s):
    rows = sol.q[s]
    print("\n%s   V = %+.4f   baseline = %+.4f   %d cards"
          % (s, sol.v[s], sol.baseline[s], len(rows)))
    print("  %-3s %-46s %-6s %-6s %-6s %9s %9s" % ("#", "card", "ODDS", "att%", "EDGE", "A", "B"))
    for i, r in enumerate(rows, 1):
        print("  %-3d %-46s %5.0f%% %5.1f  %5s  %+9.4f %+9.4f"
              % (i, r["name"][:46], r["odds"] * 100, r["attempt"] * 100,
                 edge_str(r["edge"]), r["A"], r["B"]))


def _pct(vals, q):
    """Nearest-rank percentile (what reproduces the spec's quoted quantiles)."""
    v = sorted(vals)
    return v[min(len(v) - 1, int(q * len(v)))]


def verify(g, base_opts, lam, H):
    """
    Audit the spec's own headline numbers.  Prints MEASURED against QUOTED so a
    reader can see which reproduce and which do not, rather than taking my word.
    """
    sol = solve(g, lam, H, base_opts)
    m = sol.model
    print("\n== SPEC HEADLINES: measured vs quoted ==")

    def line(label, measured, quoted):
        print("    %-58s measured %-30s quoted %s" % (label, measured, quoted))

    pairs = [(s, r) for s in m.states for r in sol.q[s]]
    e = [r["edge"] for _, r in pairs]
    line("(state, action) pairs", len(pairs), "1246")
    line("EDGE min/p5/p25/median/p75/p95/max",
         "%d/%d/%d/%d/%d/%d/%d" % (min(e), _pct(e, .05), _pct(e, .25), _pct(e, .5),
                                   _pct(e, .75), _pct(e, .95), max(e)),
         "-51/-14/-3/0/+4/+12/+46")
    line("within +/-15", "%.1f%%" % (100.0 * sum(1 for x in e if abs(x) <= 15) / len(e)), "93.3%")
    line("in the +/-1 deadband", "%.1f%%" % (100.0 * sum(1 for x in e if abs(x) <= 1) / len(e)),
         "23.3%")
    dist = [len(set(r["edge"] for r in sol.q[s])) / float(len(sol.q[s])) for s in m.states if sol.q[s]]
    line("share of a hand's cards showing a distinct value",
         "%.1f%%" % (100.0 * sum(dist) / len(dist)), "89.3%")

    # 4.4 -- the label is forced.  A card that TIES for best odds is no contradiction, so
    # the test is "the top-EDGE card is not among the best-odds cards".
    forced, big = 0, 0
    for s in m.states:
        rows = sol.q[s]
        if len(rows) < 2:
            continue
        mx = max(r["odds"] for r in rows)
        if rows[0]["odds"] < mx - 1e-12:
            forced += 1
            if (mx - rows[0]["odds"]) * 100 > 15:
                big += 1
    line("hands where best-EDGE != best-odds", "%d / %d" % (forced, len(m.states)), "98 / 272")
    line("  ...of those, odds gap > 15pp", big, "17")

    # 4.1 -- drilling visibly moves it.  Baseline held fixed: this is "what does drilling
    # THIS card do to THIS card".  (Strictly B(s) moves too, since it is a weighted mean
    # that includes the card; that stricter figure is printed underneath.)
    moves, strict = [], []
    for s in m.states:
        for r in sol.q[s]:
            p2 = min(1.0, r["odds"] + 0.10)
            q2 = p2 * r["A"] + (1 - p2) * r["B"]
            e0 = 100 * (r["q"] - sol.baseline[s])
            moves.append(abs(100 * (q2 - sol.baseline[s]) - e0))
            strict.append(abs(100 * (q2 - (sol.baseline[s] + r["attempt"] * (q2 - r["q"]))) - e0))
    line("+10pp of odds moves EDGE (median/p90/p99/max)",
         "%.1f/%.1f/%.1f/%.1f" % (_pct(moves, .5), _pct(moves, .9), _pct(moves, .99), max(moves)),
         "2.7/9.3/14.8/20.6")
    line("  ...moves less than 1 point",
         "%.1f%%" % (100.0 * sum(1 for x in moves if x < 1) / len(moves)), "5.2%")
    line("  ...same, but re-weighting the baseline too",
         "%.1f/%.1f/%.1f/%.1f (%.1f%% under 1pt)"
         % (_pct(strict, .5), _pct(strict, .9), _pct(strict, .99), max(strict),
            100.0 * sum(1 for x in strict if x < 1) / len(strict)), "(not in the spec)")

    # 2.4 -- what lambda changes
    sl = {l: solve(g, float(l), H, base_opts) for l in (1, 2, 4)}
    same_top = same_ord = same_tail = 0
    for s in m.states:
        tops = set(sl[l].q[s][0]["name"] for l in sl if sl[l].q[s])
        orders = set(tuple(r["name"] for r in sl[l].q[s]) for l in sl)
        tails = set(frozenset(r["name"] for r in sl[l].q[s] if r["edge"] <= -3) for l in sl)
        same_top += len(tops) <= 1
        same_ord += len(orders) == 1
        same_tail += len(tails) == 1
    line("top card identical across lam in {1,2,4}", "%d / 272" % same_top, "266 / 272")
    line("full ranked order identical", "%d / 272" % same_ord, "246 / 272")
    line("tail (EDGE <= -3) membership identical", "%d / 272" % same_tail, "155 / 272")

    # 5 -- the tail rule
    print("    tail rule (EDGE <= -delta):   %-10s %-10s %-14s %s"
          % ("mean share", "median", "empty tails", "tails > 60%"))
    for d in (0, 2, 3, 5, 8):
        sh = [sum(1 for r in sol.q[s] if r["edge"] <= -d) / float(len(sol.q[s]))
              for s in m.states if sol.q[s]]
        print("      delta=%-2d                     %-10s %-10s %-14s %s"
              % (d, "%.1f%%" % (100 * sum(sh) / len(sh)), "%.1f%%" % (100 * _pct(sh, .5)),
                 "%d / 272" % sum(1 for x in sh if x == 0), sum(1 for x in sh if x > 0.60)))
    print("      quoted:  d=0 54.4%/50.0%/0/87   d=2 34.9%/33.3%/30/17   "
          "d=3 26.7%/33.3%/66/11   d=5 17.8%/16.7%/120/4   d=8 12.4%/0.0%/157/1")

    # p_win compression, and the q-form sensitivity
    pw = sorted(sol.pwin.values())
    line("p_win range across all 272 states", "%.2f - %.2f" % (pw[0], pw[-1]), "0.80 - 0.99")
    below = [s for s in m.states if sol.pwin[s] < 0.80]
    line("  ...states below p_win 0.80 (the quoted floor)",
         "%d, worst %s at %.4f" % (len(below), min(below, key=lambda s: sol.pwin[s]) if below else "-",
                                   pw[0]), "0 implied")
    alt = solve(g, lam, H, base_opts.replace(qform="marginal"))
    d = sum(1 for s in m.states for r in sol.q[s] if r["edge"] != alt.edge[s][r["name"]])
    line("EDGE integers moved by qform=marginal", "%d / %d" % (d, len(pairs)), "(not in the spec)")


def mutants(g, lam, H):
    """
    Mutation test.  A check that cannot fail is not evidence, so each load-bearing
    claim is re-run against a deliberately broken model or a deliberately broken
    copy of the graph, and the damage is printed.  Nothing here writes to disk.
    """
    import copy as _copy
    global flip
    base = Opts()
    print("\n== MUTANTS (a check that cannot fail is not evidence) ==")

    print("  -- the 1331-pair mirror invariant (self-check) --")
    for tag, mut in (("unmutated", lambda x: x),
                     ("one /defender probability flipped", _mut_mirror),
                     ("one /defender outcome retargeted", _mut_mirror_to)):
        gg = mut(_copy.deepcopy(g)) if tag != "unmutated" else g
        r = [c for c in selfcheck(gg) if c[0].startswith("attacker/defender")][0]
        print("     %-38s %-4s %s" % (tag, "OK" if r[1] else "FAIL", r[2]))

    print("  -- the fully-symmetric residual (and what it CANNOT see) --")
    sym = base.replace(policy="sample", initiative="symmetric", stayput="charge")
    rows = [("unmutated", g, sym), ("corrupt an /attacker outcome cell", _mut_attacker(_copy.deepcopy(g)), sym),
            ("opponent draws MY list, not the pair's", g, sym.replace(opponent="mylist"))]
    for tag, gg, o in rows:
        mean, mx, _ = symmetric_residual(gg, lam, H, o)
        print("     %-38s mean %.4e  max %.4e" % (tag, mean, mx))
    saved = flip
    flip = lambda k: k                                   # noqa: E731
    try:
        mean, mx, _ = symmetric_residual(g, lam, H, sym)
        print("     %-38s mean %.4e  max %.4e   <- STILL ZERO: near-tautology"
              % ("flip() replaced by the identity", mean, mx))
    finally:
        flip = saved

    print("  -- the model's own load-bearing rules --")
    for tag, o in (("shipped", base),
                   ("MUTANT opponent keeps initiative", base.replace(initiative="symmetric")),
                   ("MUTANT stay-put charged 1 ply", base.replace(stayput="charge")),
                   ("MUTANT stay-put compared hub-wise", base.replace(stayput="hub")),
                   ("MUTANT no origin filter", base.replace(origin=False)),
                   ("MUTANT chain dropped", base.replace(chain="drop"))):
        s = solve(g, lam, H, o)
        n = sum(1 for i in range(len(s.model.states)) for act in s.model.hands[i]
                if act.p > 0 and not act.succ)
        print("     %-38s V(mount/top) %+.4f  V(sc/bottom) %+.4f  dealt actions with no"
              " success branch: %d" % (tag, s.v["mount/top"], s.v["side-control/bottom"], n))


def _mut_mirror(g):
    d = g["transitions"]["side-control-escape/defender"]
    d["outcomes"][2]["probability"], d["outcomes"][3]["probability"] = 20, 20
    return g


def _mut_mirror_to(g):
    g["transitions"]["side-control-escape/defender"]["outcomes"][0]["to"] = "mount/top"
    return g


def _mut_attacker(g):
    a = g["transitions"]["side-control-escape/attacker"]
    a["outcomes"][0]["probability"], a["outcomes"][2]["probability"] = 50, 11
    return g


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--graph", default=GRAPH_PATH)
    ap.add_argument("--lam", type=float, default=2.0)
    ap.add_argument("--horizon", type=int, default=11)
    ap.add_argument("--frame", default="nogi", choices=("nogi", "gi"))
    ap.add_argument("--hand", action="append", default=[], help="print a state's EDGE table")
    ap.add_argument("--quick", action="store_true", help="skip the control tables")
    ap.add_argument("--verify", action="store_true",
                    help="audit the spec's headline numbers, measured vs quoted")
    ap.add_argument("--mutants", action="store_true",
                    help="mutation-test every load-bearing check (proves they can fail)")
    a = ap.parse_args(argv)

    g = load_graph(a.graph)
    base_opts = Opts(frame=a.frame)
    print("EDGE solver  -  graph.json  -  frame=%s  lam=%.3g  H=%d" % (a.frame, a.lam, a.horizon))

    # ---- 1. self-check
    print("\n== SELF-CHECK ==")
    checks = selfcheck(g)
    for name, ok, detail in checks:
        print("  [%s] %-42s %s" % ("OK" if ok else "FAIL", name, detail))
    failed = [c[0] for c in checks if not c[1]]

    sol = solve(g, a.lam, a.horizon, base_opts)
    m = sol.model
    print("  [%s] %-42s %s" % ("OK" if not m.relaxed or len(m.relaxed) < 10 else "??",
                               "origin-relaxed hands (relax ORIGIN, never ROLE)",
                               "%d: %s" % (len(m.relaxed), ", ".join(m.relaxed) or "none")))

    # branch form vs the authored marginal (58 nodes round successRate to 0.1pp)
    worst = 0.0
    for s in m.states:
        for r in sol.q[s]:
            worst = max(worst, abs(r["q"] - (r["odds"] * r["A"] + (1 - r["odds"]) * r["B"])))
    print("  [OK] %-42s max |Q - (pA+(1-p)B)| = %.2e" % ("branch form is self-consistent", worst))

    # ---- 2. convergence
    print("\n== CONVERGENCE (finite horizon; sup-norm change per added ply) ==")
    for i, c in enumerate(sol.conv, 1):
        print("    m=%-3d  ||V[m]-V[m-1]||inf = %.6f" % (i, c))
    dm = sorted(sol.pdraw.values())
    print("  residual draw mass at H=%d: mean %.4f  median %.4f  max %.4f"
          % (a.horizon, sum(dm) / len(dm), dm[len(dm) // 2], dm[-1]))

    # ---- 3. the board
    print("\n== THE BOARD (lam=%.3g, H=%d, %s, same-origin, chained, shipped turn rule) =="
          % (a.lam, a.horizon, a.frame))
    print("  %-26s %9s %8s %8s %8s %6s" % ("state", "V", "p_win", "p_loss", "p_draw", "rank"))
    for s in BOARD:
        if s not in sol.v:
            continue
        print("  %-26s %+9.4f %8.4f %8.4f %8.4f %6d"
              % (s, sol.v[s], sol.pwin[s], sol.ploss[s], sol.pdraw[s], _rank(sol, s)))

    # ---- 4. the invariant check
    print("\n== INVARIANT: p_win(s | my turn) == p_loss(opp(s) | their turn) ==")
    print("  (equal only if both players play the same way; ours deliberately do not)")
    rows = [("shipped model (I argmax)", base_opts),
            ("symmetric SAMPLING, shipped turn rule", base_opts.replace(policy="sample")),
            ("fully symmetric (both sample, both keep initiative, stay-put charged 1 ply)",
             base_opts.replace(policy="sample", initiative="symmetric", stayput="charge"))]
    print("  %-72s %10s %10s" % ("control", "mean", "max"))
    sym_named = []
    for label, o in rows:
        mean, mx, worst_s = symmetric_residual(g, a.lam, a.horizon, o)
        print("  %-72s %10.4f %10.4f" % (label, mean, mx))
        if o.initiative == "symmetric":
            # NAME every state that violates it at ANY horizon
            for h in range(1, a.horizon + 1):
                sh = solve(g, a.lam, h, o)
                for s in sh.model.states:
                    d = abs(sh.pwin[s] - sh.ul[flip(s)])
                    if d > 1e-9:
                        sym_named.append((s, h, d))
    if sym_named:
        print("  CONTENT VIOLATIONS (fully symmetric control, tolerance 1e-9):")
        for s, h, d in sym_named[:40]:
            print("      %-30s m=%-3d |delta| = %.3e" % (s, h, d))
        print("      ... %d total" % len(sym_named))
    else:
        print("  fully-symmetric residual is EXACTLY 0 at every horizon m in 1..%d, all %d states"
              % (a.horizon, len(m.states)))
        print("  -> the model is self-consistent under role reflection, so the whole residual")
        print("     above is the shipped rules (argmax + initiative + the free stay-put ply).")
        print("  NOTE: this row is close to a tautology and is NOT evidence about CONTENT -")
        print("     see --mutants.  The mirror's zero-violation claim rests on the 1331-pair")
        print("     invariant test in the self-check above, which DOES fail when data breaks.")

    if a.quick:
        for h in a.hand:
            print_hand(sol, h)
        return 1 if failed else 0

    # ---- 5. the owner's prediction
    print("\n== OWNER'S PREDICTION: mount/top vs side-control/top ==")
    print("  %-6s %12s %12s %10s %7s %7s" % ("lam", "V(mount/top)", "V(sc/top)", "gap", "rk mnt", "rk sc"))
    for lam in (1, 2, 3, 5, 8, 20):
        sl = solve(g, float(lam), a.horizon, base_opts)
        print("  %-6d %+12.4f %+12.4f %+10.4f %7d %7d"
              % (lam, sl.v["mount/top"], sl.v["side-control/top"],
                 sl.v["mount/top"] - sl.v["side-control/top"],
                 _rank(sl, "mount/top"), _rank(sl, "side-control/top")))
    print("  mechanism: p_loss %.4f (mount) vs %.4f (side control) = %.2fx, and lam multiplies it"
          % (sol.ploss["mount/top"], sol.ploss["side-control/top"],
             sol.ploss["side-control/top"] / sol.ploss["mount/top"]))
    print("  by horizon (maxMoves is uniform on {9,10,11,12}; the mixture is what would ship):")
    for h in HORIZON_MIX:
        sh = solve(g, a.lam, h, base_opts)
        print("      H=%-3d gap %+.4f" % (h, sh.v["mount/top"] - sh.v["side-control/top"]))
    mix = solve_mixture(g, a.lam, HORIZON_MIX, base_opts)
    print("      mixture gap %+.4f   (V(mount/top) %+.4f, V(side-control/top) %+.4f)"
          % (mix.v["mount/top"] - mix.v["side-control/top"],
             mix.v["mount/top"], mix.v["side-control/top"]))

    # ---- 6. the three-model control table
    print("\n== THREE MODELS OF THE OPPONENT (lam=%.3g, H=%d, same-origin) ==" % (a.lam, a.horizon))
    print("  %-52s %13s %13s %20s" % ("model", "mean V(top)", "mean V(bot)", "bottoms > mean-top"))
    for label, o in (("A - mirrored (paired role-node, the correct one)", base_opts),
                     ("D - no mirror (opponent draws MY list)", base_opts.replace(opponent="mylist")),
                     ("E - no opponent at all", base_opts.replace(opponent="none"))):
        sl = solve(g, a.lam, a.horizon, o)
        tops = [sl.v[s] for s in sl.model.states if s.endswith("/top")]
        bots = [sl.v[s] for s in sl.model.states if s.endswith("/bottom")]
        mt = sum(tops) / len(tops)
        print("  %-52s %+13.4f %+13.4f %14d / %d"
              % (label, mt, sum(bots) / len(bots), sum(1 for b in bots if b > mt), len(bots)))
    slE = solve(g, a.lam, a.horizon, base_opts.replace(opponent="none"))
    print("  model E scores back-control/bottom (being strangled) at %+.4f - loss aversion is"
          % slE.v["back-control/bottom"])
    print("  literally meaningless there.  That is why the mirror is not optional.")

    # ---- 7. chaining sensitivity
    print("\n== CHAINING THE 42 HUB-TARGET CELLS (21 sit on /attacker; 17 ARE a node's whole"
          " success branch) ==")
    for label, o in (("chained (label-driven performer)", base_opts),
                     ("chained (actor always performs)", base_opts.replace(chain="actor")),
                     ("DROPPED + renormalised (the artifact)", base_opts.replace(chain="drop"))):
        sl = solve(g, a.lam, a.horizon, o)
        zero = sum(1 for s in sl.model.states for act in sl.model.hands[sl.model.index[s]]
                   if act.p > 0 and not act.succ)
        print("  %-40s V(mount/top)=%+.4f  V(sc/bottom)=%+.4f  actions with successRate>0 and"
              " NO success branch: %d" % (label, sl.v["mount/top"], sl.v["side-control/bottom"], zero))

    if a.verify:
        verify(g, base_opts, a.lam, a.horizon)
    if a.mutants:
        mutants(g, a.lam, a.horizon)

    for h in a.hand:
        print_hand(sol, h)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
