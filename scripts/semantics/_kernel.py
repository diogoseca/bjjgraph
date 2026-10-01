#!/usr/bin/env python3
"""
THE SEMANTICS KERNEL — the one Markov chain every graph-semantics number is computed on.

WHAT THIS IS
------------
`scripts/solve_edge_values.py` already models the game the app deals: a two-player exchange over
the 266 position role-nodes, my hand at `<hub>/<myRole>`, the opponent sampling the PAIRED
role-node's authored hand, asymmetric initiative, 42 chained hub cells, origin filter, null != 0.
It solves that game by backward induction over a finite horizon and never writes the chain down.

This file writes it down, as an ABSORBING MARKOV CHAIN, without re-deriving any of it: every card,
every branch and every outcome cell comes out of `solve_edge_values.Model`, and `selfcheck()` proves
the matrix IS that model by reproducing `solve(..., policy="sample")` to 1e-12 on every state, in
both frames and both initiative rules. The two readings of the same object:

    solve_edge_values.solve   ->  V_H(s) = P(I win within H plies), a finite-horizon VALUE
    this kernel               ->  Q, R    = the one-step law, from which every horizon follows,
                                            including H = infinity (the committor)

STATE SPACE (transient, n_t = 2 * 266 = 532)
    t = r          MY turn at role-node r            (every state written in MY frame)
    t = n_r + r    THEIR turn at role-node r         (I still stand at r; they act from flip(r))
ABSORBING
    W   I finish them        (a submission I perform lands on game-over, or a chained submission
                              the OPPONENT performs as their failure/counter branch... from THEIR
                              action, i.e. their move's miss that chains into my finish)
    L   they finish me
    D   draw: an optionless hand. `endRound("reset")` in the app, `V = 0` in the solver.

POLICY. Both players play the ORIGIN-FILTERED, RENORMALISED authored attempt shares
(`policy="sample"`), because the question this cell asks is "what does this place MEAN among the
people the corpus describes", not "what is optimal here" (that is EDGE's argmax, and its value
function is compressed to ~0.98 at every dominant state — solve_flow.py's docstring measures it).

THE ORIGIN FILTER IS THE LARGEST TRANSFORMATION BETWEEN graph.json AND THIS CHAIN, and it is
inherited, not chosen here: `build_hand` (and the app's `optionsFor`) deal a listed card only at
its canonical origin (`fromPositionId`), relaxing that only when it would empty the hand. Roughly
half of all authored, role-matching attempt points sit on listings away from the card's origin and
are dropped and renormalised away; ~41 techniques are listed only away from their origin and are
never dealt at all. `coverage["origin_dropped_attempt_pts"]` and `self.origin_orphans` report it
every build, and `origin=False` builds the same chain WITHOUT the filter so its consequence can be
measured rather than asserted (see `--structure`). Which reading of the corpus is "the" map is an
owner decision; this kernel does not make it.

WHICH GAME THIS IS. The corpus's game: both seats sample authored shares, no resistance, no round
clock in the H = infinity chain, control positions kept as positions. It is NOT the shipped app's
game: since v1.176.0 `opponentDefend` routes through `optionsFor` (role- AND origin-filtered — the
older "no role/origin filter" description in CLAUDE.md §5 is stale) but then picks by its OWN
policy (a finish with probability clamp(0.34 + 0.55*adv, .18, .85), else uniformly among the top 3
transitions by the landing's value), never reading attempt shares; the app also resists my success
odds (aiMod), re-routes 12 control hubs to submission states, and clocks the roll at 9-12 moves.
Numbers here describe what the CORPUS says a roll is; the app's own game is a different chain.

ONE-STEP LAW (read off solve(); `initiative` is the only fork)
    my card, success cell -> S(j, keeps)   (j, MY turn),    1 ply            my success keeps my turn
    my card, other cell   -> S(j)          (j, THEIR turn), 1 ply, or 0 plies when j == r
                                           (the stay-put rule: `enterFailCal` early-returns)
    their card, any cell  -> S(j)          (flip(j), MY turn), 1 ply         shipped: never keep it
                                           symmetric control: their success keeps THEIR turn
    W / L cells are read in the ACTOR's frame and flipped for the opponent's cards.
  CHAINED LANDINGS (the 21 hub-target cells whose chained submission misses and lands on a role-
  node) are a fourth case the two lines above do not cover: the `keeps` flag comes from
  `_cell_outcome(actor_frame=...)`, so a chained landing ALWAYS hands the turn to the card-player's
  opponent — even under the success branch of my own card. solve_edge_values does exactly this and
  never states it; an independent Monte Carlo refuted both alternative readings ("my success keeps
  my turn" z = +16.5 at straight-ankle-lock-control/bottom; "the performer's own result decides"
  z = +7.6 at honey-hole/bottom). From standing the choice is worth < 0.001 of P(I finish); per
  state up to ~0.018 — so per-state maps rest on it, and it is written down here.
The ply count only matters for time (MFPT) and for the finite-horizon recursion; absorption
probabilities do not depend on it.

WHAT THIS KERNEL DELIBERATELY DOES NOT DO
  * It does not decide which states "exist" in a frame. `Model.frame_absent` / `passive_opp` /
    `live` are passed through unchanged and named. A frame-absent state still has a row (a draw),
    because other states' outcome cells can land on it; every aggregate downstream must say
    whether it averages over `live`, over `reachable`, or over everything.
  * It does not model the round clock (`maxMoves = 9 + rng*4`) in the infinite chain. That is what
    `finite_horizon(H)` is for; the difference between the two is a RESULT (lane 2), not a bug.
  * `rates="shipped"` prices every card at the folded no-gi `successRate`, exactly as EDGE and
    FLOW price it (`solve_edge_values.tech_rate`). The APP does not: `calSuccess` reads
    `successRateByRuleset[_giMode]` first and `_giMode` defaults to gi, so in gi the app shows the
    frame rate. `rates="frame"` is that reading (133 dealt gi techniques fork, by up to 50pp from
    their own success-cell mass); it is offered so the consequence can be measured.
  * `origin=False` switches the inherited origin filter off (every role-matching listed card is
    dealt where it is listed). A sensitivity, not a proposal.
  * Time: a STEP is one card played. Stay-put cells are 0 PLIES, so steps overcount plies (the
    unit of the app's moveCount and clock) by ~25%; every time figure must say which it is.

USAGE
    python3 scripts/semantics/_kernel.py --selfcheck          # the gate; non-zero exit on failure
    python3 scripts/semantics/_kernel.py --summary            # coverage + headline structure

    from _kernel import load_kernel
    K = load_kernel(frame="nogi", initiative="shipped", rates="shipped")

Deterministic: states in sorted order, cards in authored order, no randomness anywhere.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
REPO = os.path.dirname(SCRIPTS)
sys.path.insert(0, SCRIPTS)

from solve_edge_values import (  # noqa: E402
    GRAPH_PATH, L, S, W, Model, Opts, _cell_outcome, _chain_target, flip, is_role, load_graph,
    solve, tech_rate,
)

ABS = ("W", "L", "D")
IW, IL, ID = 0, 1, 2

# The two seats a real roll begins from (regenerate_neural_data.ROLL_SEEDS). Imported by value
# rather than by module so this file does not pull the whole neural emitter in; `selfcheck`
# asserts the two tuples are equal, so they cannot drift.
ROLL_SEEDS = ("standing-position/top", "standing-position/bottom")

CELL_DTYPE = np.dtype([
    ("src", np.int32),      # transient index the card is played from
    ("act", np.int32),      # index into K.actions
    ("branch", np.int8),    # 0 = success branch, 1 = miss branch (failure/counter)
    ("wcw", np.float64),    # pi(card) * within-branch cell weight   (d mass / d p = +wcw / -wcw)
    ("mass", np.float64),   # pi(card) * (p or 1-p) * within-branch cell weight
    ("dst", np.int32),      # transient index, or -1-k for absorbing column k (W=0, L=1, D=2)
    ("plies", np.int8),     # 1, or 0 for the stay-put rule
    ("fin", np.int32),      # R_fin column for a W/L cell, else -1
])


# --------------------------------------------------------------------------- #
# card expansion that REMEMBERS THE FINISHER
# --------------------------------------------------------------------------- #
def _expand(graph, tech, p):
    """
    `solve_edge_values.build_action` with the finishing technique kept on every W/L cell.

    build_action flattens a chained hub cell into the chained submission's outcomes and forgets
    which submission that was; absorption-by-submission needs it. This is a line-for-line copy of
    its `chain="label"` branch with one extra field, and `Kernel._verify_expansion` asserts the
    copy equals the original cell for cell — so it cannot drift silently.

    Returns [(branch, w_within_branch, outcome, finisher_id_or_None)] with branch weights
    renormalised to 1, exactly as build_action does.
    """
    succ_raw, miss_raw = [], []
    for o in tech.get("outcomes") or []:
        to, res, prob = o["to"], o["result"], float(o["probability"])
        bucket = succ_raw if res == "success" else miss_raw
        if to == "game-over" or is_role(to):
            fin = tech.get("hub") if to == "game-over" else None
            bucket.append((prob, _cell_outcome(to, res), fin))
            continue
        ch = _chain_target(graph, to)
        if ch is None:
            continue
        by_actor = res == "success"
        for co in ch.get("outcomes") or []:
            fin = ch.get("hub") if co["to"] == "game-over" else None
            bucket.append((prob * float(co["probability"]) / 100.0,
                           _cell_outcome(co["to"], co["result"], actor_frame=by_actor), fin))
    out = []
    for bi, raw in enumerate((succ_raw, miss_raw)):
        tot = sum(w for w, _o, _f in raw)
        if tot <= 0:
            continue
        for w, oc, fin in raw:
            out.append((bi, w / tot, oc, fin))
    return out


# --------------------------------------------------------------------------- #
# the kernel
# --------------------------------------------------------------------------- #
class Kernel:
    """See the module docstring. Every public attribute is listed in gs-shared.md §3."""

    def __init__(self, graph, frame="nogi", initiative="shipped", rates="shipped", origin=True):
        if frame not in ("gi", "nogi"):
            raise ValueError("frame must be gi|nogi, got %r" % frame)
        if initiative not in ("shipped", "symmetric"):
            raise ValueError("initiative must be shipped|symmetric, got %r" % initiative)
        if rates not in ("shipped", "frame"):
            raise ValueError("rates must be shipped|frame, got %r" % rates)
        self.graph, self.frame, self.initiative, self.rates = graph, frame, initiative, rates
        self.origin = bool(origin)
        self.opts = Opts(frame=frame, initiative=initiative, policy="sample", origin=self.origin)
        self.model = m = Model(graph, self.opts)

        self.role_nodes = m.states
        self.n_r = n_r = len(self.role_nodes)
        self.n_t = n_t = 2 * n_r
        self.index = m.index
        self.flipidx = np.array(m.flipidx, dtype=np.int64)
        P = graph["positions"]
        self.hub_of = tuple(P[s]["hub"] for s in self.role_nodes)
        self.role_of = tuple(P[s]["role"] for s in self.role_nodes)
        self.hubs = tuple(sorted(set(self.hub_of)))
        self.hub_index = {h: i for i, h in enumerate(self.hubs)}
        self.labels = tuple((s, "M") for s in self.role_nodes) + tuple((s, "T") for s in self.role_nodes)
        self.ABS = ABS

        self.frame_absent = frozenset(m.frame_absent)
        self.passive_opp = frozenset(m.passive_opp)
        self.live = frozenset(m.live)

        sym = initiative == "symmetric"
        actions, cells = [], []
        fin_cols, fin_idx = [], {}
        self._rate_moved = 0          # cards whose p changed under rates="frame"
        self._rate_absent = 0         # cards dropped because the frame has no rate (rates="frame")

        def fin_col(tid, performer):
            key = (tid, performer)
            k = fin_idx.get(key)
            if k is None:
                k = fin_idx[key] = len(fin_cols)
                fin_cols.append(key)
            return k

        def card_p(a, tech):
            if rates == "shipped":
                return a.p
            rb = tech.get("successRateByRuleset")
            v = rb.get(frame) if isinstance(rb, dict) else None
            if v is None:
                return None
            p = float(v) / 100.0
            if abs(p - a.p) > 1e-12:
                self._rate_moved += 1
            return p

        # ---- my turn (t = r) and their turn (t = n_r + r)
        for side in ("M", "T"):
            hands = m.hands if side == "M" else m.opp_hands
            for r in range(n_r):
                t = r if side == "M" else n_r + r
                hand = hands[r]
                if not hand:
                    # An optionless hand is endRound("reset"): a draw. For a frame-absent state this
                    # is a fabricated value (the state has no frame, not no options) — it is NAMED in
                    # frame_absent / passive_opp, never hidden by the number.
                    cells.append((t, -1, 0, 0.0, 1.0, -1 - ID, 1, -1))
                    continue
                # renormalise defensively over the cards that survive (rates="frame" can drop one)
                kept = []
                for a in hand:
                    tech = graph[a.cat][a.target + "/attacker"]
                    p = card_p(a, tech)
                    if p is None:
                        self._rate_absent += 1
                        continue
                    kept.append((a, tech, p))
                tot = sum(a.weight for a, _t, _p in kept)
                if not kept or tot <= 0:
                    cells.append((t, -1, 0, 0.0, 1.0, -1 - ID, 1, -1))
                    continue
                for a, tech, p in kept:
                    pi = a.weight / tot
                    ai = len(actions)
                    actions.append({
                        "t": t, "target": a.target, "cat": a.cat, "name": a.name,
                        "performer": "me" if side == "M" else "them", "pi": pi, "p": p,
                        "role_node": self.role_nodes[r] if side == "M" else flip(self.role_nodes[r]),
                    })
                    for bi, cw, oc, fin in _expand(graph, tech, p):
                        bp = p if bi == 0 else 1.0 - p
                        wcw = pi * cw
                        mass = wcw * bp
                        kind = oc[0]
                        if side == "M":
                            if kind is W:
                                cells.append((t, ai, bi, wcw, mass, -1 - IW, 1, fin_col(fin, "me")))
                            elif kind is L:
                                cells.append((t, ai, bi, wcw, mass, -1 - IL, 1, fin_col(fin, "them")))
                            else:
                                j = self.index[oc[1]]
                                if oc[2]:                                   # my success keeps my turn
                                    cells.append((t, ai, bi, wcw, mass, j, 1, -1))
                                elif (not sym) and j == r:                  # stay-put: 0 plies
                                    cells.append((t, ai, bi, wcw, mass, n_r + j, 0, -1))
                                else:
                                    cells.append((t, ai, bi, wcw, mass, n_r + j, 1, -1))
                        else:
                            # THEIR card, outcome written in THEIR frame: flip it back into mine.
                            if kind is W:                                   # they win -> I lose
                                cells.append((t, ai, bi, wcw, mass, -1 - IL, 1, fin_col(fin, "them")))
                            elif kind is L:                                 # they lose -> I win
                                cells.append((t, ai, bi, wcw, mass, -1 - IW, 1, fin_col(fin, "me")))
                            else:
                                j = self.index[flip(oc[1])]
                                if sym and oc[2]:                           # symmetric control only
                                    cells.append((t, ai, bi, wcw, mass, n_r + j, 1, -1))
                                else:                                       # shipped: back to me
                                    cells.append((t, ai, bi, wcw, mass, j, 1, -1))

        self.actions = actions
        self.cells = np.array(cells, dtype=CELL_DTYPE)
        self.fin_cols = tuple(fin_cols)
        self.n_fin = len(fin_cols)
        self._build_matrices()
        self._origin_census()
        self._reach()
        self.coverage = self._coverage()

    # -- matrices ------------------------------------------------------------ #
    def _build_matrices(self):
        c, n_t = self.cells, self.n_t
        tr = c["dst"] >= 0
        self.Q = sp.csr_matrix((c["mass"][tr], (c["src"][tr], c["dst"][tr])), shape=(n_t, n_t))
        ab = ~tr
        self.R = sp.csr_matrix((c["mass"][ab], (c["src"][ab], -1 - c["dst"][ab])), shape=(n_t, 3))
        fn = c["fin"] >= 0
        self.R_fin = sp.csr_matrix((c["mass"][fn], (c["src"][fn], c["fin"][fn])),
                                   shape=(n_t, self.n_fin))
        # the ply split the finite-horizon recursion needs: 0-ply cells read the SAME horizon
        z = tr & (c["plies"] == 0)
        o = tr & (c["plies"] != 0)
        self.Q0 = sp.csr_matrix((c["mass"][z], (c["src"][z], c["dst"][z])), shape=(n_t, n_t))
        self.Q1 = sp.csr_matrix((c["mass"][o], (c["src"][o], c["dst"][o])), shape=(n_t, n_t))

    # -- restart distributions ------------------------------------------------ #
    def start(self, where="standing", first="me"):
        """
        A distribution over transient states a roll begins from.

          where="standing"  the two ROLL_SEEDS, 1/2 each — how `frame_reachable` (and a real
                            match) begins.
          where="anywhere"  uniform over LIVE role-nodes. APPROXIMATES, does not equal, the app's
                            "Anywhere" draw (the app's DEFAULT start, `startFrom()` -> "random"):
                            the app's pool `_posIdx` also excludes the 12 control-alias hubs and,
                            in no-gi, the cloth guards (112 sites no-gi / 121 gi vs 132 / 133 here).
          first="me"        I act first (the app deals the player the first hand).
          first="coin"      half the mass starts on THEIR turn — the player-neutral start the
                            symmetric control needs to be swap-symmetric.
        """
        if where == "standing":
            seeds = [self.index[s] for s in ROLL_SEEDS if s in self.index]
        elif where == "anywhere":
            seeds = [self.index[s] for s in self.role_nodes if s in self.live]
        else:
            raise ValueError(where)
        if not seeds:
            raise SystemExit("[kernel] start(%r): 0 seed states — refusing an empty start" % where)
        x = np.zeros(self.n_t)
        if first == "me":
            x[seeds] = 1.0 / len(seeds)
        elif first == "coin":
            x[seeds] = 0.5 / len(seeds)
            x[[self.n_r + s for s in seeds]] = 0.5 / len(seeds)
        else:
            raise ValueError(first)
        return x

    def _origin_census(self):
        """
        What the origin filter drops, from the Model's OWN hands (not a re-derivation): authored,
        positive, role-matching attempt points at each role-node vs the points on cards the Model
        actually dealt there. `origin_orphans` = techniques listed somewhere with positive attempt
        and role-matching, dealt nowhere. Printed by `coverage`, because a drop nobody reports is
        the "absence reads as clean" defect (CLAUDE.md §6.6).
        """
        g, fr = self.graph, self.frame
        authored = dropped = 0.0
        listed, dealt = set(), set()
        self._role_authored = np.zeros(self.n_r)
        self._role_dropped = np.zeros(self.n_r)
        for r, s in enumerate(self.role_nodes):
            node = g["positions"][s]
            here = {a.target for a in self.model.hands[r]}
            dealt |= here
            for t in node.get("transitions") or []:
                v = t["attemptProbabilityByRuleset"].get(fr)
                if v is None or v <= 0:
                    continue
                cat = "submissions" if t.get("isSubmission") else "transitions"
                tech = g[cat].get(t["target"] + "/attacker")
                if tech is None or tech.get("fromRole") != node["role"]:
                    continue
                authored += v
                self._role_authored[r] += v
                listed.add(t["target"])
                if t["target"] not in here:
                    dropped += v
                    self._role_dropped[r] += v
        self._att_authored, self._att_origin_dropped = authored, dropped
        self.origin_orphans = tuple(sorted(listed - dealt))

    def origin_dropped_share_weighted(self, start):
        """
        The origin-dropped share of authored attempt points, each role-node's hand weighted by how
        often that hand is PLAYED per roll from `start`: role-node r's hand is played by me at
        (r, my turn) and by the opponent at (flip r, their turn), so its weight is
        N[r] + N[n_r + flip(r)] with N the expected visits. Set: every role-node; law: occupancy
        of the killed chain from `start` (not the Q-process, not the restart chain).
        """
        N = self.fundamental().solve(np.asarray(start, dtype=float), "T")
        w = N[: self.n_r] + N[self.n_r + self.flipidx]
        a = float((w * self._role_authored).sum())
        return float((w * self._role_dropped).sum()) / a if a > 0 else float("nan")

    def _reach(self):
        """Role-nodes this kernel can reach from the standing seeds (either player's turn)."""
        A = (self.Q != 0).astype(np.int8).tocsr()
        seen = np.zeros(self.n_t, dtype=bool)
        stack = [int(i) for i in np.flatnonzero(self.start("standing", "coin"))]
        seen[stack] = True
        while stack:
            i = stack.pop()
            for j in A.indices[A.indptr[i]:A.indptr[i + 1]]:
                if not seen[j]:
                    seen[j] = True
                    stack.append(int(j))
        self.reach_t = seen
        rn = seen[: self.n_r] | seen[self.n_r:]
        self.reachable = frozenset(s for s, ok in zip(self.role_nodes, rn) if ok)

    def restart_chain(self, start):
        """
        The ERGODIC chain: every absorbed unit of mass (W, L or D) re-enters at `start`.

        Its stationary distribution is the long-run share of plies... more exactly of STEPS, spent
        in each transient state over an endless sequence of rolls — "where the time goes". States
        the restart cannot reach carry pi = 0 exactly; `support` names the ones that do not.
        Returns (P, pi, support) with P an (n_t x n_t) csr row-stochastic matrix.
        """
        start = np.asarray(start, dtype=float)
        a = np.asarray(self.R.sum(axis=1)).ravel()
        P = (self.Q + sp.csr_matrix(np.outer(a, start))).tocsr()
        pi = stationary(P)
        support = np.flatnonzero(pi > 1e-15)
        return P, pi, support

    @staticmethod
    def lump(P, pi, groups, n_groups=None):
        """
        pi-weighted aggregation of a chain onto a partition of its states:
            Pa[a, b] = sum_{i in a} pi_i sum_{j in b} P_ij / pi(a)
        This is the unique aggregation that preserves the stationary flow between groups
        (pia P_a = pia). Groups with pi(a) = 0 get an all-zero row and are reported.
        """
        groups = np.asarray(groups)
        G = int(n_groups if n_groups is not None else groups.max() + 1)
        n = len(groups)
        M = sp.csr_matrix((np.ones(n), (np.arange(n), groups)), shape=(n, G))
        F = sp.diags(pi) @ P @ M                       # flow i -> group b
        Fa = (M.T @ F).toarray()                       # flow a -> b
        pia = np.asarray(M.T @ pi).ravel()
        with np.errstate(invalid="ignore", divide="ignore"):
            Pa = np.where(pia[:, None] > 0, Fa / pia[:, None], 0.0)
        return Pa, pia

    def groups_role(self):
        """transient index -> role-node index (my turn and their turn collapse)."""
        return np.concatenate([np.arange(self.n_r), np.arange(self.n_r)])

    def groups_hub(self):
        """transient index -> hub index (both seats and both turns collapse)."""
        h = np.array([self.hub_index[x] for x in self.hub_of])
        return np.concatenate([h, h])

    # -- the finite-horizon recursion (the shipped value) --------------------- #
    def finite_horizon(self, H):
        """
        P(W within H plies) and P(L within H plies) from every transient state: the SAME
        recursion as solve_edge_values.solve(policy="sample"), written as matrix algebra:

            x_m = rW + Q0 x_m + Q1 x_{m-1}   =>   x_m = (I + Q0)(rW + Q1 x_{m-1})

        (Q0 only maps a MY-turn row onto a THEIR-turn column, so Q0 @ Q0 = 0 and (I-Q0)^-1 = I+Q0.)
        Returns (Vw, Vl) over all 532 transient states; the first 266 are solve()'s V, the rest U.
        """
        rW = np.asarray(self.R[:, IW].todense()).ravel()
        rL = np.asarray(self.R[:, IL].todense()).ravel()
        xw = np.zeros(self.n_t)
        xl = np.zeros(self.n_t)
        for _ in range(H):
            yw = rW + self.Q1 @ xw
            yl = rL + self.Q1 @ xl
            xw = yw + self.Q0 @ yw
            xl = yl + self.Q0 @ yl
        return xw, xl

    # -- absorption (the H = infinity limit) ---------------------------------- #
    def absorption(self):
        """B = (I - Q)^{-1} R, by sparse LU, with the residual returned."""
        A = (sp.identity(self.n_t, format="csc") - self.Q.tocsc())
        lu = spla.splu(A)
        R = self.R.toarray()
        B = lu.solve(R)
        res = float(np.abs(A @ B - R).max())
        return B, res

    def fundamental(self):
        """The sparse LU of (I - Q), memoised. `lu.solve(b)` = (I-Q)^{-1} b; `lu.solve(b, 'T')`
        = (I-Q)^{-T} b (the adjoint / occupancy direction)."""
        if getattr(self, "_lu", None) is None:
            self._lu = spla.splu(sp.identity(self.n_t, format="csc") - self.Q.tocsc())
        return self._lu

    def exit_law(self):
        """
        THE HARMONIC MEASURE: Bf[t, c] = P(the roll ends by finisher column c | start at t).

        Columns are `fin_cols` = (finishing technique hub id, "me"|"them"). Each row sums to
        P(W) + P(L) from t (= 1 - P(D)). Every absorption statistic by family, body region or
        performer is a column-grouping of this one matrix — compute it here, group it downstream,
        never re-derive it. Returns (Bf, max_residual).
        """
        lu = self.fundamental()
        Rf = self.R_fin.toarray()
        Bf = lu.solve(Rf)
        A = sp.identity(self.n_t, format="csr") - self.Q
        return Bf, float(np.abs(A @ Bf - Rf).max())

    def fin_meta(self):
        """Raw corpus fields for every finisher column (no interpretation — the lexicon that maps
        these to body regions belongs to the naming lane)."""
        out = []
        for tid, perf in self.fin_cols:
            n = (self.graph["submissions"].get(tid + "/attacker")
                 or self.graph["transitions"].get(tid + "/attacker") or {})
            out.append({"technique": tid, "performer": perf, "name": n.get("name"),
                        "category": n.get("category"), "type": n.get("type"),
                        "targetArea": n.get("targetArea"),
                        "isSubmissionNode": tid + "/attacker" in self.graph["submissions"]})
        return out

    def qprocess(self, idx=None):
        """
        THE CHAIN CONDITIONED NEVER TO FINISH (the Q-process; Collet, Martínez & San Martín 2013).

        On the transient block restricted to `idx` (default: the states reachable from standing),
        take the Perron root lam of Q, its right vector phi and left vector psi. Then
            Pq[i, j] = Q[i, j] phi[j] / (lam phi[i])      (row-stochastic)
            mu       = psi * phi, normalised             (Pq's stationary law = the QSD-weighted
                                                          "where a long fight spends its time")
        lam is the per-step survival probability of a long roll. `lam2/lam` measures how
        metastable the conditioned dynamics are. Returns dict(idx, Pq, mu, lam, spectrum, phi, psi).
        Dense: n <= 532.
        """
        if idx is None:
            idx = np.flatnonzero(self.reach_t)
        idx = np.asarray(idx)
        Qr = self.Q.toarray()[np.ix_(idx, idx)]
        w, V = np.linalg.eig(Qr)
        o = np.argsort(-np.abs(w))
        lam = float(w[o[0]].real)
        phi = V[:, o[0]].real
        phi = phi / phi.sum()
        wl, Vl = np.linalg.eig(Qr.T)
        ol = np.argsort(-np.abs(wl))
        psi = Vl[:, ol[0]].real
        psi = psi / psi.sum()
        if phi.min() <= 0 or psi.min() <= 0 or abs(float(wl[ol[0]].real) - lam) > 1e-10:
            raise SystemExit("[kernel] qprocess: Perron vectors not strictly positive on the "
                             "chosen index set (min phi %.3g, min psi %.3g) — the set is not "
                             "irreducible; pass an irreducible `idx`" % (phi.min(), psi.min()))
        Pq = (Qr * phi[None, :]) / (lam * phi[:, None])
        mu = psi * phi
        mu = mu / mu.sum()
        return {"idx": idx, "Pq": Pq, "mu": mu, "lam": lam, "spectrum": w[o], "phi": phi, "psi": psi}

    def perturbed(self, eps_attempt=0.2, eps_rate=0.2, seed=0):
        """
        ONE perturbation of the corpus's numbers, for ROBUSTNESS questions ("would this conclusion
        survive if the authored numbers were a little different?"). Exact exit shares are not
        samples, so a claim about one state has no sampling p-value; its honest confidence is the
        share of a perturbation ensemble in which it still holds. This is the one implementation
        every lane uses, so two lanes never mean two different things by "robust".

        The perturbation respects the corpus's own parameterisation, keyed so one authored number
        moves ONE way everywhere it appears:
          * attempt share of card a in the hand of role-node r: log pi(a|r) += eps_attempt * z_{r,a},
            renormalised within the hand. Keyed by (actor role-node, technique), so my hand at r
            and the opponent's copy of the same hand move together.
          * success rate of technique t: logit p_t += eps_rate * z_t, keyed by technique, shared by
            every hand that deals t and by both performers.
          * outcome-cell weights within a branch are NOT perturbed (they are the landing
            geography, not a frequency estimate), and the zero pattern is preserved: nothing that
            is absent becomes present, nothing null becomes a number.
        z ~ N(0,1) from numpy.random.default_rng(seed), drawn over SORTED keys (deterministic).
        eps = 0 reproduces (Q, R, R_fin) exactly (asserted by selfcheck).

        Returns dict(Q, R, R_fin) as csr matrices on this kernel's index spaces.
        """
        rng = np.random.default_rng(seed)
        acts = self.actions
        att_keys = sorted({(a["role_node"], a["target"]) for a in acts})
        rate_keys = sorted({a["target"] for a in acts})
        za = dict(zip(att_keys, rng.standard_normal(len(att_keys))))
        zr = dict(zip(rate_keys, rng.standard_normal(len(rate_keys))))
        # new pi per action, renormalised per transient state
        w = np.array([a["pi"] * np.exp(eps_attempt * za[(a["role_node"], a["target"])]) for a in acts])
        t_of = np.array([a["t"] for a in acts])
        tot = np.bincount(t_of, weights=w, minlength=self.n_t)
        pi_new = w / tot[t_of]
        p0 = np.clip(np.array([a["p"] for a in acts]), 1e-9, 1 - 1e-9)
        lg = np.log(p0 / (1 - p0)) + eps_rate * np.array([zr[a["target"]] for a in acts])
        p_new = 1.0 / (1.0 + np.exp(-lg))
        p_new = np.where(np.array([a["p"] for a in acts]) <= 0, 0.0,
                         np.where(np.array([a["p"] for a in acts]) >= 1, 1.0, p_new))
        c = self.cells
        real = c["act"] >= 0
        ai = c["act"][real]
        pi_old = np.array([a["pi"] for a in acts])
        cw = c["wcw"][real] / pi_old[ai]                       # within-branch cell weight
        bp = np.where(c["branch"][real] == 0, p_new[ai], 1.0 - p_new[ai])
        mass = np.array(c["mass"], dtype=float)
        mass[real] = pi_new[ai] * bp * cw
        n_t = self.n_t
        tr = c["dst"] >= 0
        Q = sp.csr_matrix((mass[tr], (c["src"][tr], c["dst"][tr])), shape=(n_t, n_t))
        ab = ~tr
        R = sp.csr_matrix((mass[ab], (c["src"][ab], -1 - c["dst"][ab])), shape=(n_t, 3))
        fn = c["fin"] >= 0
        R_fin = sp.csr_matrix((mass[fn], (c["src"][fn], c["fin"][fn])), shape=(n_t, self.n_fin))
        return {"Q": Q, "R": R, "R_fin": R_fin}

    # -- coverage -------------------------------------------------------------- #
    def _coverage(self):
        c = self.cells
        return {
            "role_nodes": self.n_r,
            "transient_states": self.n_t,
            "live_role_nodes": len(self.live),
            "frame_absent_role_nodes": len(self.frame_absent),
            "passive_opp_role_nodes": len(self.passive_opp),
            "reachable_role_nodes_from_standing": len(self.reachable),
            "cards_dealt_mine": sum(1 for a in self.actions if a["performer"] == "me"),
            "cards_dealt_theirs": sum(1 for a in self.actions if a["performer"] == "them"),
            "model_dealt": self.model.dealt,
            "null_cells_dropped_by_model": self.model.absent_cells,
            "authored_attempt_pts": self._att_authored,
            "origin_dropped_attempt_pts": self._att_origin_dropped,
            "origin_dropped_share": (self._att_origin_dropped / self._att_authored
                                     if self._att_authored else float("nan")),
            "origin_orphaned_techniques": len(self.origin_orphans),
            "origin_relaxed_role_nodes": len(self.model.relaxed),
            "cells": int(len(c)),
            "cells_zero_ply": int(((c["dst"] >= 0) & (c["plies"] == 0)).sum()),
            "empty_hand_draw_rows": int((c["act"] < 0).sum()),
            "finisher_columns": self.n_fin,
            "rates_moved_by_frame_rates": self._rate_moved,
            "cards_dropped_no_frame_rate": self._rate_absent,
        }


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def stationary(P):
    """
    The stationary distribution of a row-stochastic csr matrix with ONE recurrent class, by a
    sparse solve of pi (I - P) = 0 with one equation replaced by normalisation — then CHECKED:
    residual, non-negativity, and that it sums to 1. A chain with two recurrent classes has no
    unique pi; the residual check catches that rather than returning one of them silently.
    """
    n = P.shape[0]
    A = (sp.identity(n, format="csr") - P).T.tolil()
    # pick the normalisation row as a state with the largest diagonal to keep LU well conditioned
    A[n - 1, :] = np.ones(n)
    b = np.zeros(n)
    b[n - 1] = 1.0
    pi = spla.spsolve(A.tocsc(), b)
    pi = np.where(np.abs(pi) < 1e-15, 0.0, pi)
    res = float(np.abs(pi @ P - pi).max())
    if res > 1e-10 or pi.min() < -1e-12 or abs(pi.sum() - 1) > 1e-10:
        raise SystemExit("[kernel] stationary: not a unique stationary law (residual %.3g, "
                         "min %.3g, sum %.12f) — the chain has more than one recurrent class"
                         % (res, pi.min(), pi.sum()))
    return np.clip(pi, 0.0, None)


_CACHE = {}


def load_kernel(frame="nogi", initiative="shipped", rates="shipped", graph=None, origin=True):
    key = (frame, initiative, rates, bool(origin), id(graph) if graph is not None else None)
    if key not in _CACHE:
        _CACHE[key] = Kernel(graph if graph is not None else load_graph(), frame, initiative, rates,
                             origin)
    return _CACHE[key]


# --------------------------------------------------------------------------- #
# the gate
# --------------------------------------------------------------------------- #
def _verify_expansion(K):
    """`_expand` must equal build_action's cells, card for card, branch for branch."""
    bad = compared = 0
    for side, hands in (("M", K.model.hands), ("T", K.model.opp_hands)):
        for hand in hands:
            for a in hand:
                tech = K.graph[a.cat][a.target + "/attacker"]
                mine = _expand(K.graph, tech, a.p)
                ref = [(0, w, oc) for w, oc in a.succ] + [(1, w, oc) for w, oc in a.miss]
                compared += 1
                if len(mine) != len(ref):
                    bad += 1
                    continue
                for (b1, w1, o1, _f), (b2, w2, o2) in zip(mine, ref):
                    if b1 != b2 or abs(w1 - w2) > 1e-15 or o1 != o2:
                        bad += 1
                        break
    return compared, bad


def selfcheck(verbose=True):
    g = load_graph()
    checks = []

    def ok(name, cond, detail):
        checks.append((name, bool(cond), detail))

    try:
        from regenerate_neural_data import ROLL_SEEDS as RS, frame_reachable
    except Exception as e:   # the import is part of the check, not optional
        ok("ROLL_SEEDS / frame_reachable importable", False, repr(e))
        RS, frame_reachable = None, None
    else:
        ok("ROLL_SEEDS equals regenerate_neural_data.ROLL_SEEDS", tuple(RS) == ROLL_SEEDS, str(RS))

    sols_compared = 0
    for frame in ("nogi", "gi"):
        for ini in ("shipped", "symmetric"):
            K = Kernel(g, frame, ini, "shipped")
            tag = "%s/%s" % (frame, ini)
            rows = np.asarray(K.Q.sum(axis=1)).ravel() + np.asarray(K.R.sum(axis=1)).ravel()
            ok("[%s] every row sums to 1" % tag, np.abs(rows - 1).max() < 1e-12,
               "max |row-1| = %.2e over %d rows" % (np.abs(rows - 1).max(), K.n_t))
            fin = np.asarray(K.R_fin.sum(axis=1)).ravel()
            wl = np.asarray((K.R[:, IW] + K.R[:, IL]).todense()).ravel()
            ok("[%s] R_fin rows == R[W]+R[L]" % tag, np.abs(fin - wl).max() < 1e-12,
               "%d finisher columns, max diff %.2e" % (K.n_fin, np.abs(fin - wl).max()))
            ok("[%s] Q0 @ Q0 == 0 (0-ply cells map MY turn -> THEIR turn only)" % tag,
               (K.Q0 @ K.Q0).nnz == 0 or abs((K.Q0 @ K.Q0)).max() == 0,
               "%d zero-ply cells" % K.coverage["cells_zero_ply"])
            n, b = _verify_expansion(K)
            ok("[%s] finisher-tracking expansion == build_action" % tag, b == 0 and n > 1000,
               "%d cards compared (floor 1000), %d differ" % (n, b))
            # THE DIFFERENTIAL GATE: the matrix IS the shipped model.
            worst = 0.0
            for H in (1, 2, 5, 11):
                sol = solve(g, 2.0, H, K.opts)
                Vw, Vl = K.finite_horizon(H)
                for r, s in enumerate(K.role_nodes):
                    worst = max(worst, abs(Vw[r] - sol.pwin[s]), abs(Vl[r] - sol.ploss[s]),
                                abs(Vw[K.n_r + r] - sol.uw[s]), abs(Vl[K.n_r + r] - sol.ul[s]))
                    sols_compared += 4
            ok("[%s] finite_horizon == solve(policy=sample), H in 1,2,5,11" % tag, worst < 1e-12,
               "max |diff| = %.2e" % worst)
            # the harmonic measure: columns regroup to R's W and L columns exactly
            Bf, fres = K.exit_law()
            me = np.array([p == "me" for _t, p in K.fin_cols])
            B0, _r0 = K.absorption()
            dW = np.abs(Bf[:, me].sum(axis=1) - B0[:, IW]).max()
            dL = np.abs(Bf[:, ~me].sum(axis=1) - B0[:, IL]).max()
            ok("[%s] exit_law columns regroup to absorption W / L" % tag,
               fres < 1e-10 and max(dW, dL) < 1e-10,
               "%d columns, residual %.2e, max |W|,|L| diff %.2e" % (K.n_fin, fres, max(dW, dL)))
            qp = K.qprocess()
            ok("[%s] Q-process row-stochastic with a unique law" % tag,
               np.abs(qp["Pq"].sum(axis=1) - 1).max() < 1e-10
               and np.abs(qp["mu"] @ qp["Pq"] - qp["mu"]).max() < 1e-10,
               "%d states, survival/step %.4f, |lam2|/lam %.4f"
               % (len(qp["idx"]), qp["lam"], abs(qp["spectrum"][1]) / qp["lam"]))
            # absorbing: no closed transient class, i.e. I-Q invertible and B rows sum to 1
            B, res = K.absorption()
            ok("[%s] (I-Q) invertible, B rows sum to 1" % tag,
               res < 1e-10 and np.abs(B.sum(axis=1) - 1).max() < 1e-9,
               "LU residual %.2e, max |rowsum-1| %.2e" % (res, np.abs(B.sum(axis=1) - 1).max()))
            # H -> infinity limit of the finite recursion equals the absorption solve
            Vw, Vl = K.finite_horizon(4000)
            ok("[%s] finite_horizon(4000) -> absorption B" % tag,
               max(np.abs(Vw - B[:, IW]).max(), np.abs(Vl - B[:, IL]).max()) < 1e-9,
               "max |diff| = %.2e" % max(np.abs(Vw - B[:, IW]).max(), np.abs(Vl - B[:, IL]).max()))
            # reachability: this kernel (role- AND origin-aware) must be a SUBSET of the role-blind
            # corpus walk; the difference is reported, not asserted away
            if frame_reachable is not None:
                # the walk's set also carries the `game-over` pseudo-position; compare role-nodes only
                fr = frame_reachable(g, frame)["positions"] & set(K.role_nodes)
                extra = sorted(K.reachable - fr)
                ok("[%s] kernel-reachable ⊆ frame_reachable" % tag, not extra,
                   "kernel %d, walk %d, kernel-only %s, walk-only %d"
                   % (len(K.reachable), len(fr), extra[:5], len(fr - K.reachable)))
            # restart chain: unique stationary law, zero mass off the reachable set
            P, pi, supp = K.restart_chain(K.start("standing", "coin"))
            # "zero" is the solve's own precision, not a fixed 1e-15: an unreachable state's true pi
            # is exactly 0, and the LU leaves it at most the residual. Measured at v1.210.0 (no-gi,
            # shipped): collar-sleeve-guard/top read 1.49e-15 with a residual of 1.49e-15, i.e. the
            # whole residual sat on that one entry. A real leak (restart mass entering an unreachable
            # state) is ~1e-3 and still fails here.
            res = float(np.abs(pi @ P - pi).max())
            off = [K.labels[i] for i in supp if not K.reach_t[i] and pi[i] > res]
            ok("[%s] restart(standing) stationary law lives on the reachable set" % tag,
               not off and len(supp) > 100,
               "support %d transient states, %d outside reach above the solve residual %.2g "
               "(max off-reach pi %.2g)" % (len(supp), len(off), res,
                                            max([pi[i] for i in supp if not K.reach_t[i]] or [0.0])))
            if ini == "symmetric":
                # PLAYER-SWAP SYMMETRY: (s, M) <-> (flip s, T). Exact under the symmetric rule.
                perm = np.concatenate([K.n_r + K.flipidx, K.flipidx])
                Pm = sp.csr_matrix((np.ones(K.n_t), (np.arange(K.n_t), perm)), shape=(K.n_t, K.n_t))
                d = abs(Pm @ K.Q @ Pm.T - K.Q).max()
                Rs = K.R.toarray()
                d2 = np.abs(Rs[perm][:, [IL, IW, ID]] - Rs).max()
                ok("[%s] player-swap symmetry of Q and R" % tag, d < 1e-12 and d2 < 1e-12,
                   "max |PQP'-Q| %.2e, max |R swap| %.2e" % (d, d2))
            cov = K.coverage
            ok("[%s] coverage floors" % tag,
               cov["role_nodes"] == 266 and cov["cards_dealt_mine"] >= 1000
               and cov["cards_dealt_mine"] == cov["cards_dealt_theirs"] == cov["model_dealt"],
               "role-nodes %d, cards mine/theirs/model %d/%d/%d, cells %d, fin cols %d, "
               "frame_absent %d, passive_opp %d, reachable %d"
               % (cov["role_nodes"], cov["cards_dealt_mine"], cov["cards_dealt_theirs"],
                  cov["model_dealt"], cov["cells"], cov["finisher_columns"],
                  cov["frame_absent_role_nodes"], cov["passive_opp_role_nodes"],
                  cov["reachable_role_nodes_from_standing"]))
    ok("differential comparisons made", sols_compared >= 4 * 4 * 266 * 4,
       "%d state-values compared against solve()" % sols_compared)
    # the shared perturbation: eps=0 must reproduce the matrices; eps>0 must stay stochastic, keep
    # the zero pattern, and actually move something (a perturbation that moves nothing is a
    # robustness test that always passes)
    Kp = Kernel(g, "nogi", "symmetric")
    z = Kp.perturbed(0.0, 0.0, seed=7)
    d0 = max(abs(z["Q"] - Kp.Q).max(), abs(z["R"] - Kp.R).max(), abs(z["R_fin"] - Kp.R_fin).max())
    pz = Kp.perturbed(0.3, 0.3, seed=7)
    rows = np.asarray(pz["Q"].sum(axis=1)).ravel() + np.asarray(pz["R"].sum(axis=1)).ravel()
    moved = abs(pz["Q"] - Kp.Q).max()
    newnz = int(((pz["Q"] != 0).astype(int) - (Kp.Q != 0).astype(int)).maximum(0).sum())
    again = Kp.perturbed(0.3, 0.3, seed=7)
    ok("[nogi/symmetric] perturbed(): eps=0 exact, eps>0 stochastic, zero pattern kept, deterministic",
       d0 < 1e-15 and np.abs(rows - 1).max() < 1e-12 and moved > 1e-3 and newnz == 0
       and abs(again["Q"] - pz["Q"]).max() == 0,
       "eps=0 max|d| %.1e; eps=.3 max|row-1| %.1e, max|dQ| %.3f, new nonzeros %d"
       % (d0, np.abs(rows - 1).max(), moved, newnz))
    # origin=False is the sensitivity build: it must ALSO be exactly solve() under the same Opts,
    # and the origin census must be non-trivial in the default build (a zero drop would mean the
    # census never looked, not that nothing was dropped).
    for frame in ("nogi", "gi"):
        Kd = Kernel(g, frame, "shipped", "shipped")
        Ko = Kernel(g, frame, "shipped", "shipped", origin=False)
        worst = 0.0
        for H in (1, 5, 11):
            sol = solve(g, 2.0, H, Ko.opts)
            Vw, Vl = Ko.finite_horizon(H)
            for r, s_ in enumerate(Ko.role_nodes):
                worst = max(worst, abs(Vw[r] - sol.pwin[s_]), abs(Vl[r] - sol.ploss[s_]))
        cd, co = Kd.coverage, Ko.coverage
        ok("[%s/origin=False] finite_horizon == solve(origin=False)" % frame, worst < 1e-12,
           "max |diff| %.2e; cards dealt %d (default %d)" % (worst, co["cards_dealt_mine"],
                                                           cd["cards_dealt_mine"]))
        ok("[%s] origin census non-trivial and reported" % frame,
           cd["authored_attempt_pts"] > 20000 and cd["origin_dropped_attempt_pts"] > 0
           and co["origin_dropped_attempt_pts"] == 0,
           "authored %d pts, origin-dropped %d (%.2f%%), orphaned techniques %d; origin=False drops %d"
           % (cd["authored_attempt_pts"], cd["origin_dropped_attempt_pts"],
              100 * cd["origin_dropped_share"], cd["origin_orphaned_techniques"],
              co["origin_dropped_attempt_pts"]))
    # rates="frame" is a different model: it must build, and it must say how much it moved
    for frame in ("gi", "nogi"):
        K = Kernel(g, frame, "shipped", "frame")
        rows = np.asarray(K.Q.sum(axis=1)).ravel() + np.asarray(K.R.sum(axis=1)).ravel()
        ok("[%s/frame-rates] builds, rows sum to 1" % frame, np.abs(rows - 1).max() < 1e-12,
           "%d cards re-priced from the folded scalar, %d dropped (no rate in frame)"
           % (K.coverage["rates_moved_by_frame_rates"], K.coverage["cards_dropped_no_frame_rate"]))
    if verbose:
        for name, good, detail in checks:
            print("  [%s] %-70s %s" % ("OK" if good else "FAIL", name, detail))
        print("  %d checks, %d failed" % (len(checks), sum(1 for c in checks if not c[1])))
    return checks


def summary():
    g = load_graph()
    for frame in ("nogi", "gi"):
        for ini in ("shipped", "symmetric"):
            K = Kernel(g, frame, ini)
            B, _ = K.absorption()
            s0 = K.start("standing", "me")
            print("%s/%s  %s" % (frame, ini, K.coverage))
            print("    from standing (me first): P(W)=%.4f P(L)=%.4f P(D)=%.4f"
                  % tuple(s0 @ B))


def structure():
    """
    The lead's structural measurements, each printed with its set definition. This is the
    recompute command for every kernel-level number in docs/GraphSemantics.md.
    """
    g = load_graph()
    from regenerate_neural_data import frame_reachable
    for frame in ("nogi", "gi"):
        walk = frame_reachable(g, frame)["positions"]
        for ini in ("shipped", "symmetric"):
            K = Kernel(g, frame, ini)
            tag = "%s/%s" % (frame, ini)
            B, _ = K.absorption()
            s0 = K.start("standing", "me")
            ET = K.fundamental().solve(np.ones(K.n_t))
            reach = np.flatnonzero(K.reach_t)
            print("== %s" % tag)
            print("  role-nodes reachable from standing (either turn): %d of %d; corpus walk: %d; "
                  "walk-only: %s" % (len(K.reachable), K.n_r, len(walk & set(K.role_nodes)),
                                     sorted((walk & set(K.role_nodes)) - K.reachable)))
            print("  from standing, me first, H=inf: P(I finish) %.4f  P(they finish) %.4f  "
                  "P(draw) %.4f" % tuple(s0 @ B))
            print("  expected steps to the finish from standing (me first): %.2f; median over the "
                  "%d reachable transient states: %.2f" % (s0 @ ET, len(reach), np.median(ET[reach])))
            # plies: a 0-ply stay-put cell costs nothing on the app's clock
            q0 = np.asarray(K.Q0.sum(axis=1)).ravel()
            EP = K.fundamental().solve(1.0 - q0)
            print("  expected PLIES to the finish from standing (me first): %.2f (steps overcount by %.1f%%)"
                  % (s0 @ EP, 100 * (s0 @ ET / (s0 @ EP) - 1)))
            mix = [K.finite_horizon(H) for H in (9, 10, 11, 12)]
            pw = np.mean([s0 @ vw for vw, _vl in mix])
            pl = np.mean([s0 @ vl for _vw, vl in mix])
            print("  CLOCKED (maxMoves uniform 9..12), from standing, me first: P(I finish) %.4f  "
                  "P(they finish) %.4f  P(clock draw) %.4f" % (pw, pl, 1 - pw - pl))
            sa = K.start("anywhere", "me")
            print("  from 'anywhere' (uniform live role-nodes, me first), H=inf: P(I finish) %.4f"
                  % (sa @ B)[0])
            cov = K.coverage
            print("  origin filter: drops %d of %d authored role-matching attempt pts (%.2f%%); "
                  "%d techniques orphaned (listed, dealt nowhere); weighted by expected plays of each "
                  "hand from standing (me first, killed-chain occupancy): %.2f%%"
                  % (cov["origin_dropped_attempt_pts"], cov["authored_attempt_pts"],
                     100 * cov["origin_dropped_share"], cov["origin_orphaned_techniques"],
                     100 * K.origin_dropped_share_weighted(K.start("standing", "me"))))
            Ko = Kernel(g, frame, ini, origin=False)
            Bo, _ = Ko.absorption()
            Bf, _ = K.exit_law()
            Bfo, _ = Ko.exit_law()
            # finisher law from standing, joined on finisher column IDENTITY (never on index)
            lw = dict(zip(K.fin_cols, s0 @ Bf))
            lo = dict(zip(Ko.fin_cols, Ko.start("standing", "me") @ Bfo))
            keys = set(lw) | set(lo)
            tv = 0.5 * sum(abs(lw.get(k, 0.0) - lo.get(k, 0.0)) for k in keys)
            ETo = Ko.fundamental().solve(np.ones(Ko.n_t))
            print("  origin=False sensitivity from standing: P(I finish) %.4f -> %.4f; finisher-law TV "
                  "%.4f over %d columns; E[steps] %.2f -> %.2f"
                  % ((s0 @ B)[0], (Ko.start("standing", "me") @ Bo)[0], tv, len(keys), s0 @ ET,
                     Ko.start("standing", "me") @ ETo))
            P, pi, _s = K.restart_chain(K.start("standing", "coin"))
            Pa, pia = K.lump(P, pi, K.groups_hub(), len(K.hubs))
            live = np.flatnonzero(pia > 0)
            ev = np.linalg.eigvals(Pa[np.ix_(live, live)])
            ev = np.sort(np.abs(ev))[::-1]
            print("  restart chain (standing, coin), lumped to %d hubs with mass: |lam2| %.4f "
                  "(tau %.2f steps), |lam3| %.4f" % (len(live), ev[1], -1 / np.log(ev[1]), ev[2]))
            qp = K.qprocess()
            r2 = abs(qp["spectrum"][1]) / qp["lam"]
            print("  Q-process on %d reachable transient states: survival/step %.4f, |lam2|/lam %.4f "
                  "(tau %.2f steps)" % (len(qp["idx"]), qp["lam"], r2, -1 / np.log(r2)))
            hub_mu = {}
            for k, i in enumerate(qp["idx"]):
                h = K.hub_of[i % K.n_r]
                hub_mu[h] = hub_mu.get(h, 0.0) + qp["mu"][k]
            top = sorted(hub_mu.items(), key=lambda x: -x[1])[:8]
            print("  Q-process time share by hub (top 8): %s; top-4 total %.3f"
                  % (", ".join("%s %.3f" % x for x in top), sum(v for _h, v in top[:4])))


def main(argv=None):
    ap = argparse.ArgumentParser(description="the semantics kernel (see module docstring)")
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--summary", action="store_true")
    ap.add_argument("--structure", action="store_true",
                    help="the lead's structural measurements (spectra, reach, roll length)")
    a = ap.parse_args(argv)
    if a.selfcheck:
        checks = selfcheck()
        if len(checks) < 40 or any(not c[1] for c in checks):
            return 1
        return 0
    if a.structure:
        structure()
        return 0
    summary()
    return 0


if __name__ == "__main__":
    sys.exit(main())
