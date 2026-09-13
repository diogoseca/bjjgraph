#!/usr/bin/env python3
"""
FLOW — what each DECK is worth to your whole game, not what each MOVE is worth here.

    GAIN(deck) = V0(you, that deck mastered) - V0(you, now)

`solve_edge_values.py` answers "which of these cards should I play, standing here" and
ships the answer as EDGE. This answers a different question — "which deck should I DRILL"
— and the two are not interchangeable in either direction:

  * EDGE is RELATIVE to a state's own baseline. `_evShift` subtracts an attempt-weighted
    hand mean, so `sum(att * EDGE) == 0` at every state BY CONSTRUCTION. A weak-spot score
    built out of EDGE therefore has an identically-zero total at every state and its whole
    ranking is rounding noise. FLOW is built in Q, absolute, and never touches EDGE.

  * EDGE is solved under the ARGMAX policy (`sol.v`). That value function is compressed
    into nothing at the top -- every dominant state sits at p_win ~= 0.98 -- because it
    prices a player who always picks the best card. Drilling advice has to be priced under
    the policy you ACTUALLY play, so FLOW is a POLICY EVALUATION: identical recursion,
    `argmax` replaced by `pi`. Measured spread, authored pi vs argmax:
        argmax   min -0.318  median +0.810  max +0.964
        sample   min -0.928  median +0.125  max +0.786
    Only the second discriminates between states, which is the whole job.

The parameter being differentiated is the app's own drilling channel, `stateBonus`
(app.src.jsx): `mastery(key) = min(0.15, 0.03 * prep[key])`, entering `moveChance`
ADDITIVELY and summing TWO keys -- the position deck you stand on and the technique's own
deck. So the parameter vector `m` is one number per DECK KEY in [0, 0.15], a position deck
moves every card in its hand, and a technique deck moves one.

All 1501 derivatives come from ONE backward sweep plus ONE forward (adjoint) sweep, not
1501 re-solves. `--selfcheck` asserts that against finite differences.

This script EMITS NOTHING. It is the reference implementation, the gate, and the recompute
command that every FLOW number in the docs must cite (CLAUDE.md 6.9). The browser runs its
own copy in `neural/src/flow.src.js`; `tests/flow.test.mjs` asserts the two agree.

Usage:
    python3 scripts/solve_flow.py --selfcheck    # finite-difference + invariant assertions
    python3 scripts/solve_flow.py --audit        # success cells that LOWER your value
    python3 scripts/solve_flow.py --top 40       # the ranking, exact for the shortlist
    python3 scripts/solve_flow.py --json out.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

from solve_edge_values import (            # noqa: E402
    GRAPH_PATH, HORIZON_MIX, W, L, S, Model, Opts, flip, is_role, load_graph,
)

# The horizon FLOW solves at. EDGE keeps the (9,10,11,12) mixture because it PRINTS an
# integer the user reads on a card; FLOW is a RANKING, and the mixture, H=9 and H=12 were
# measured to give the same top-40 set and the same negative set at 4x the compute.
FLOW_H = 11

# `mastery()`'s cap, app.src.jsx. The full drill headroom of one deck.
M_CAP = 0.15

# `moveChance`'s clamp, app.src.jsx.
P_LO, P_HI = 0.05, 0.95


# --------------------------------------------------------------------------- #
# deck keys -- the app's key space, so the join to flashcards/_index.json is exact
# --------------------------------------------------------------------------- #
def pos_family(name: str) -> str:
    """`posFamily` (app.src.jsx): strip the role word the visual layer bakes into a title."""
    for suf in (" Top", " Bottom"):
        if name.endswith(suf):
            return name[: -len(suf)]
    return name


def pos_deck_key(graph: dict, state: str) -> str:
    node = graph["positions"][state]
    return pos_family(node["name"]) + ("|Top" if node["role"] == "top" else "|Bottom")


def tech_deck_key(graph: dict, target: str, cat: str) -> str | None:
    """`deckKeyFor` (app.src.jsx) on a technique node: its FULL authored name + |Attacker."""
    node = graph[cat].get(target + "/attacker")
    return (node["name"] + "|Attacker") if node else None


# --------------------------------------------------------------------------- #
# the kernel, resolved to flat indices once
# --------------------------------------------------------------------------- #
class Flow:
    """
    The 272-state kernel with every continuation resolved to an index and every action
    tagged with the two deck keys whose drilling moves its odds.
    """

    def __init__(self, graph, opts=None, frame="nogi"):
        self.graph = graph
        self.opts = opts or Opts(frame=frame)
        self.model = Model(graph, self.opts)
        self.states = self.model.states
        self.n = len(self.states)
        self.index = self.model.index
        self.flipidx = self.model.flipidx

        # WHAT THIS FRAME HAS, straight off the Model. `frame_absent` is "every attempt cell here
        # is null in this ruleset"; `passive_opp` is "my hand exists but my opponent's role-node
        # is frame-absent, so they cannot move"; `live` is the rest. See `Model` in
        # solve_edge_values.py for why the state INDEX space still holds all 272 either way, and
        # for the larger reachability verdict this deliberately does not use.
        self.frame_absent = self.model.frame_absent
        self.passive_opp = self.model.passive_opp
        priced = set(self.model.live)
        self.live_idx = [i for i, s in enumerate(self.states) if s in priced]

        # deck key <-> index. Positions first so a position deck is easy to spot.
        self.deck_keys: list[str] = []
        self._deck_idx: dict[str, int] = {}
        # A DECK IS REGISTERED ONLY WHERE THE FRAME CAN ACTUALLY DEAL IT, and the set that decides
        # that is `model.live` -- the SAME set `default_d0` integrates over. A deck registered at
        # a state d0 excludes carries an identically-zero gradient, and the ranking can only read
        # that as "worth nothing to drill" when the truth is that this ruleset cannot produce the
        # state at all. Two different facts, one number, and the wrong one is the plausible one.
        #
        # THE TWO SETS MUST BE THE SAME SET. Skipping only `frame_absent` here while d0 also drops
        # `passive_opp` is worse than skipping neither: it leaves behind exactly the decks that
        # can never score -- measured on the 71-cell fixture, 1 position deck (`Lapel Guard|Top`)
        # plus the 6 technique decks whose only origin is `lapel-guard/top` -- and the coverage
        # floor below then fails for a modelling choice rather than for a defect.
        #
        # `-1` marks "no deck here"; `p_eff` and `adjoint` both honour it. A technique dealt at
        # some OTHER live state keeps its deck, so only decks with no live origin disappear.
        self.pos_deck, self.skipped_pos_decks = [], []
        for s in self.states:
            if s not in priced:
                self.pos_deck.append(-1)
                self.skipped_pos_decks.append(s)
                continue
            self.pos_deck.append(self._deck(pos_deck_key(graph, s)))
        self.n_pos_decks = len(self.deck_keys)

        self.mine = [self._resolve(h, True) for h in self.model.hands]
        self.theirs = [self._resolve(h, False) for h in self.model.opp_hands]
        # technique deck per (state, action)
        self.tech_deck: list[list[int]] = []
        self.skipped_tech_cards = 0
        for i, s in enumerate(self.states):
            row = []
            live_here = s in priced
            for a in self.model.hands[i]:
                k = tech_deck_key(graph, a.target, a.cat)
                if not live_here:
                    self.skipped_tech_cards += 1
                    row.append(-1)
                    continue
                row.append(self._deck(k) if k else -1)
            self.tech_deck.append(row)

        # authored policy, renormalised per state (graph.json is exact; belt and braces)
        self.att = []
        for i in range(self.n):
            w = [a.weight for a in self.model.hands[i]]
            t = sum(w)
            self.att.append([x / t for x in w] if t > 0 else w)
        self.p0 = [[a.p for a in self.model.hands[i]] for i in range(self.n)]

    # -- deck registry ------------------------------------------------------- #
    def _deck(self, key: str) -> int:
        i = self._deck_idx.get(key)
        if i is None:
            i = len(self.deck_keys)
            self._deck_idx[key] = i
            self.deck_keys.append(key)
        return i

    def deck(self, key: str) -> int:
        return self._deck_idx.get(key, -1)

    # -- continuation resolution --------------------------------------------- #
    def _resolve(self, hand, mine: bool):
        """[(succ_cells, miss_cells)] where a cell is (w, kind, stateIdx, keeps)."""
        out = []
        for a in hand:
            br = []
            for cells in (a.succ, a.miss):
                cc = []
                for cw, oc in cells:
                    if oc[0] is S:
                        j = self.index.get(oc[1] if mine else flip(oc[1]), -1)
                        cc.append((cw, S, j, oc[2]))
                    else:
                        cc.append((cw, oc[0], -1, False))
                br.append(cc)
            out.append(br)
        return out

    def stays(self, i: int, j: int) -> bool:
        """`enterFailCal` early-returns when dest == currentPos: a stay-put miss is 0 plies."""
        return j == i

    # -- the drilled odds ----------------------------------------------------- #
    def p_eff(self, m, i: int, t: int):
        """
        `moveChance`'s player half: p0 + stateBonus(posKey) + stateBonus(techKey), clamped.
        Returns (p, dp) where dp is 0 outside the clamp -- the gradient must respect it.
        """
        td, pd = self.tech_deck[i][t], self.pos_deck[i]
        raw = self.p0[i][t] + (m[pd] if pd >= 0 else 0.0) + (m[td] if td >= 0 else 0.0)
        if raw <= P_LO:
            return P_LO, 0.0
        if raw >= P_HI:
            return P_HI, 0.0
        return raw, 1.0


# --------------------------------------------------------------------------- #
# backward: policy evaluation
# --------------------------------------------------------------------------- #
def backward(fl: Flow, m, lam=2.0, H=FLOW_H, pi=None, keep_ab=False):
    """
    `solve_edge_values.solve()` with ONE substitution: argmax -> pi. Everything else --
    the initiative asymmetry, the paired-role opponent, the free stay-put ply -- is the
    shipped recursion, because FLOW must price the game the app actually deals.

    `pi` is the player's policy (defaults to the authored attempt shares). The OPPONENT
    always samples the authored distribution: their rates are not something you drill.

    Returns (Vw, Vl, Uw, Ul, AB) with AB[ply][state][action] = (A, B) in V units when
    `keep_ab` -- ply 1 is the first computed, ply H the last (the one V0 reads).
    """
    n = fl.n
    P = pi if pi is not None else fl.att
    Vw = [0.0] * n
    Vl = [0.0] * n
    Uw = [0.0] * n
    Ul = [0.0] * n
    AB = [] if keep_ab else None

    for _ply in range(1, H + 1):
        pVw, pVl, pUw, pUl = Vw, Vl, Uw, Ul

        # ---- THEIR turn: reads V[m-1] only, so it is well founded before mine
        nUw = [0.0] * n
        nUl = [0.0] * n
        for i in range(n):
            hand = fl.theirs[i]
            if not hand:
                # optionless opponent = reset = a draw (0.0) -- TRUE for a state that HAS this
                # frame and no legal move, FALSE for one whose opponent's role-node is
                # frame-absent: that opponent has no frame, not no options, and the state is
                # named in `fl.passive_opp`. Nothing can be decided here (continuations landing
                # on this state still need a number), so `default_d0` excludes it instead.
                continue
            oppacts = fl.model.opp_hands[i]
            w = l = 0.0
            for t, br in enumerate(hand):
                a = oppacts[t]
                aw = al = 0.0
                for bw, cells in ((a.p, br[0]), (1.0 - a.p, br[1])):
                    if bw <= 0.0 or not cells:
                        continue
                    for cw, kind, j, _keeps in cells:
                        x = bw * cw
                        if kind is W:         # THEY win -> I lose
                            al += x
                        elif kind is L:
                            aw += x
                        elif j >= 0:
                            aw += x * pVw[j]
                            al += x * pVl[j]
                w += a.weight * aw
                l += a.weight * al
            nUw[i], nUl[i] = w, l
        Uw, Ul = nUw, nUl

        # ---- MY turn: may read U[m] at the SAME horizon (the free stay-put ply)
        nVw = [0.0] * n
        nVl = [0.0] * n
        ab_ply = [] if keep_ab else None
        for i in range(n):
            # An empty hand leaves vw = vl = 0.0 -- there is no `if not rows` guard here, the
            # loop simply does not run. Same rule as solve_edge_values.py's V recursion: 0.0 is a
            # LEGAL value, so it cannot double as "no data". A frame-absent state is named in
            # `fl.frame_absent` and dropped by `default_d0`; never sentinel it with a float.
            hand = fl.mine[i]
            vw = vl = 0.0
            ab_row = [] if keep_ab else None
            for t, br in enumerate(hand):
                p, _dp = fl.p_eff(m, i, t)
                bvals = []
                for bi, cells in enumerate(br):
                    bw_w = bw_l = 0.0
                    for cw, kind, j, keeps in cells:
                        if kind is W:
                            bw_w += cw
                        elif kind is L:
                            bw_l += cw
                        elif j >= 0:
                            if keeps:                       # my success keeps my turn
                                bw_w += cw * pVw[j]
                                bw_l += cw * pVl[j]
                            elif fl.stays(i, j):            # 0 plies, same horizon
                                bw_w += cw * Uw[j]
                                bw_l += cw * Ul[j]
                            else:
                                bw_w += cw * pUw[j]
                                bw_l += cw * pUl[j]
                    bvals.append((bw_w, bw_l))
                aw = p * bvals[0][0] + (1.0 - p) * bvals[1][0]
                al = p * bvals[0][1] + (1.0 - p) * bvals[1][1]
                vw += P[i][t] * aw
                vl += P[i][t] * al
                if keep_ab:
                    ab_row.append((bvals[0][0] - lam * bvals[0][1],
                                   bvals[1][0] - lam * bvals[1][1]))
            nVw[i], nVl[i] = vw, vl
            if keep_ab:
                ab_ply.append(ab_row)
        Vw, Vl = nVw, nVl
        if keep_ab:
            AB.append(ab_ply)

    return Vw, Vl, Uw, Ul, AB


def default_d0(fl: Flow):
    """
    The start distribution V0 integrates over: uniform across the states this FRAME can price.

    A MODELLING CHOICE, NOT A FACT, and it is worth saying so at the line. A real roll starts at
    `regenerate_neural_data.ROLL_SEEDS` and spreads from there; seeding from the two seats the way
    `frame_reachable` does is the honest version and is deliberately NOT taken here, because it
    moves V0 today and this pass may not (measured, no-gi: restricting d0 to the 254 role-nodes
    `tests/artifacts/ruleset_availability.json` says the frame can reach takes V0 +0.076492575 ->
    +0.073898681, a delta of -0.002594).

    What IS taken here: a state with no frame, and a state whose opponent has no frame, are
    excluded. Both are priced at a fabricated value the recursion had to invent -- V = 0.0 for the
    first (the loop simply does not run) and an inflated V for the second (an opponent who cannot
    move is scored as a draw) -- and 0.0 is a legal V, so neither can be spotted downstream. The
    denominator is PRINTED by every caller, so a shrinking population is visible rather than
    quietly diluting the mean.

    THIS SET AND THE DECK REGISTRY ARE ONE SET (`Flow.__init__` skips both position and technique
    decks outside `model.live`). Excluding a state here while still registering its decks leaves
    a deck that can never score, and the coverage floor in `selfcheck` then fails for a modelling
    choice rather than for a defect -- measured on the 71-cell fixture: 7 such decks.
    """
    live = fl.live_idx
    if not live:
        raise SystemExit("[flow] frame %s prices 0 of %d role-nodes -- refusing to integrate V0 "
                         "over a frame that does not exist" % (fl.opts.frame, fl.n))
    w = 1.0 / len(live)
    d = [0.0] * fl.n
    for i in live:
        d[i] = w
    return d


def v0(fl: Flow, m, lam=2.0, H=FLOW_H, pi=None, d0=None):
    """The number FLOW maximises: your expected p_win - lam*p_loss over a whole roll."""
    Vw, Vl, _uw, _ul, _ab = backward(fl, m, lam, H, pi)
    d = d0 if d0 is not None else default_d0(fl)
    return sum(d[i] * (Vw[i] - lam * Vl[i]) for i in range(fl.n))


# --------------------------------------------------------------------------- #
# forward: the adjoint. Every deck's derivative from ONE extra sweep.
# --------------------------------------------------------------------------- #
def adjoint(fl: Flow, m, lam=2.0, H=FLOW_H, pi=None, d0=None):
    """
    d V0 / d m_k for EVERY deck k, from one backward and one forward sweep.

    `rho` is the discounted forward OCCUPANCY -- literally "how much of V0 flows through
    this state at this ply", which is the owner's "big lakes in a river" as an exact
    quantity rather than a metaphor. Transposing the backward recursion gives it, and
    then every deck's derivative is a dot product:

        dV0/dm_k = sum_ply sum_state rho_V[ply][i] * sum_{t in deck k at i} pi(t|i)*(A-B)

    Sweep ORDER is load bearing. rho_U[ply] receives from rho_V[ply] (the free stay-put
    ply, same horizon) and from rho_V[ply+1] (hand-over, previous iteration), so rho_V at
    a ply must be distributed BEFORE rho_U at that same ply is read.

    Returns (grad, V0, rho_V) with grad indexed like `fl.deck_keys`.
    """
    n = fl.n
    P = pi if pi is not None else fl.att
    Vw, Vl, _uw, _ul, AB = backward(fl, m, lam, H, P, keep_ab=True)
    d = d0 if d0 is not None else default_d0(fl)
    V0 = sum(d[i] * (Vw[i] - lam * Vl[i]) for i in range(n))

    grad = [0.0] * len(fl.deck_keys)
    # rho_V[ply] / rho_U[ply] for ply 1..H; index 0 is unused padding for ply 0
    rhoV = [[0.0] * n for _ in range(H + 1)]
    rhoU = [[0.0] * n for _ in range(H + 1)]
    for i in range(n):
        rhoV[H][i] = d[i]

    for ply in range(H, 0, -1):
        ab_ply = AB[ply - 1]
        rv = rhoV[ply]
        # ---- 1. distribute rho_V[ply]
        for i in range(n):
            r = rv[i]
            if r == 0.0:
                continue
            hand = fl.mine[i]
            pd = fl.pos_deck[i]
            for t, br in enumerate(hand):
                w = r * P[i][t]
                if w == 0.0:
                    continue
                p, dp = fl.p_eff(m, i, t)
                if dp:
                    A, B = ab_ply[i][t]
                    g = w * (A - B) * dp
                    if pd >= 0:
                        grad[pd] += g                   # the position deck moves EVERY card
                    td = fl.tech_deck[i][t]
                    if td >= 0:
                        grad[td] += g                   # ...the technique deck moves this one
                for bw, cells in ((p, br[0]), (1.0 - p, br[1])):
                    if bw <= 0.0 or not cells:
                        continue
                    for cw, kind, j, keeps in cells:
                        if kind is not S or j < 0:
                            continue                    # W/L are terminal: nothing downstream
                        x = w * bw * cw
                        if keeps:
                            rhoV[ply - 1][j] += x
                        elif fl.stays(i, j):
                            rhoU[ply][j] += x           # 0 plies, same horizon
                        else:
                            rhoU[ply - 1][j] += x
        # ---- 2. rho_U[ply] is complete now; it only ever reads V[ply-1]
        ru = rhoU[ply]
        for i in range(n):
            r = ru[i]
            if r == 0.0:
                continue
            hand = fl.theirs[i]
            if not hand:
                continue
            oppacts = fl.model.opp_hands[i]
            for t, br in enumerate(hand):
                a = oppacts[t]
                w = r * a.weight
                if w == 0.0:
                    continue
                for bw, cells in ((a.p, br[0]), (1.0 - a.p, br[1])):
                    if bw <= 0.0 or not cells:
                        continue
                    for cw, kind, j, _keeps in cells:
                        if kind is S and j >= 0:
                            rhoV[ply - 1][j] += w * bw * cw

    return grad, V0, rhoV


def exact_gain(fl: Flow, m, deck: int, lam=2.0, H=FLOW_H, pi=None, d0=None, cap=M_CAP):
    """
    The FINITE gain: V0 with this deck at the drill cap, minus V0 now.

    The adjoint linearisation recovers 93-97% of this, which is enough to RANK but not
    enough to publish a sign on. So: rank with the adjoint, re-solve the shown shortlist
    exactly, and never show a sign that came from the tail.
    """
    base = v0(fl, m, lam, H, pi, d0)
    m2 = list(m)
    m2[deck] = cap
    return v0(fl, m2, lam, H, pi, d0) - base


# --------------------------------------------------------------------------- #
# audit: success cells that LOWER your value
# --------------------------------------------------------------------------- #
def audit(fl: Flow, lam=2.0, H=FLOW_H):
    """
    Every `success` cell whose landing is worth LESS than the state you left.

    This is the content gate, and it must run before any negative score is shown to a
    human: a technique whose success branch drops your value is either a real trap worth
    naming, or an authoring defect -- a role collision, a misfiled finish -- and the model
    cannot tell those apart. The score is only ever as honest as `cal.outcomes`.
    """
    zero = [0.0] * len(fl.deck_keys)
    Vw, Vl, _uw, _ul, _ab = backward(fl, zero, lam, H)
    V = [Vw[i] - lam * Vl[i] for i in range(fl.n)]
    rows = []
    for i, s in enumerate(fl.states):
        for t, br in enumerate(fl.mine[i]):
            a = fl.model.hands[i][t]
            for cw, kind, j, keeps in br[0]:          # the SUCCESS branch only
                if kind is not S or j < 0 or not keeps:
                    continue
                drop = V[j] - V[i]
                if drop < 0:
                    rows.append({"state": s, "move": a.name, "to": fl.states[j],
                                 "drop": round(drop, 4), "w": round(cw, 4),
                                 "att": round(a.weight, 4)})
    rows.sort(key=lambda r: r["drop"])
    return rows, V


# --------------------------------------------------------------------------- #
# selfcheck
# --------------------------------------------------------------------------- #
def selfcheck(fl: Flow, lam=2.0, H=FLOW_H, eps=1e-4, samples=8) -> int:
    """Assert the adjoint IS the derivative, plus the invariants the JS copy must hold."""
    bad = 0
    zero = [0.0] * len(fl.deck_keys)
    grad, V0, rhoV = adjoint(fl, zero, lam, H)

    # -- 1. the adjoint against finite differences -------------------------- #
    order = sorted(range(len(grad)), key=lambda k: -abs(grad[k]))
    picks = order[:samples // 2] + order[len(order) // 2: len(order) // 2 + samples // 2]
    worst = 0.0
    for k in picks:
        mp, mm = list(zero), list(zero)
        mp[k] = eps
        mm[k] = -eps
        fd = (v0(fl, mp, lam, H) - v0(fl, mm, lam, H)) / (2 * eps)
        if abs(grad[k]) < 1e-12 and abs(fd) < 1e-12:
            continue
        rel = abs(fd - grad[k]) / max(abs(fd), abs(grad[k]), 1e-12)
        worst = max(worst, rel)
        if rel > 1e-4:
            bad += 1
            print("  FAIL adjoint %-44s grad %+.9f fd %+.9f rel %.2e"
                  % (fl.deck_keys[k], grad[k], fd, rel))
    print("  adjoint vs finite differences: %d decks, worst relative error %.2e" % (len(picks), worst))

    # -- 2. rho is a real occupancy: non-negative, and rho_V[H] is d0 ------- #
    neg = sum(1 for ply in range(H + 1) for x in rhoV[ply] if x < -1e-12)
    if neg:
        bad += 1
        print("  FAIL rho has %d negative entries -- the forward sweep is not an occupancy" % neg)
    if abs(sum(rhoV[H]) - 1.0) > 1e-9:
        bad += 1
        print("  FAIL rho_V[H] does not sum to 1 (%.9f)" % sum(rhoV[H]))

    # -- 3. the sign is real: some decks must be NEGATIVE ------------------- #
    negd = [k for k in range(len(grad)) if grad[k] < -1e-9]
    print("  decks with a negative gradient: %d of %d" % (len(negd), len(grad)))
    if not negd:
        bad += 1
        print("  FAIL no deck has a negative gradient -- a sign-blind build would pass")

    # -- 4. the linearisation is close enough to RANK ----------------------- #
    top = order[:12]
    ratios = []
    for k in top:
        ex = exact_gain(fl, zero, k, lam, H)
        lin = grad[k] * M_CAP
        if abs(ex) > 1e-9:
            ratios.append(lin / ex)
    if ratios:
        print("  linearisation recovers %.1f%%-%.1f%% of the exact gain (top 12)"
              % (100 * min(ratios), 100 * max(ratios)))

    # -- 5. coverage, printed, hard-failing BELOW A REAL FLOOR (CLAUDE.md 6.6) --------- #
    # `scored == 0` is not a floor, it is total collapse: ONE dead deck rode straight through it
    # while this very comment cited 6.6. The honest floor is every registered deck -- a deck with
    # no gradient is a deck that should not have been registered, which is exactly what the
    # frame-absent position deck was.
    scored = sum(1 for g in grad if g != 0.0)
    print("  coverage: %d/%d decks carry a gradient (%d position, %d technique)"
          % (scored, len(grad), fl.n_pos_decks, len(grad) - fl.n_pos_decks))
    if scored < len(grad):
        bad += 1
        dead = [fl.deck_keys[k] for k in range(len(grad)) if grad[k] == 0.0]
        print("  FAIL %d registered deck(s) carry NO gradient: %s"
              % (len(dead), ", ".join(dead[:8]) + (" ..." if len(dead) > 8 else "")))

    # -- 6. both roles are reachable: the top-member collapse must not recur - #
    # MEASURE AT A PLY THE FORWARD SWEEP ACTUALLY COMPUTED. `rhoV[H]` IS d0, assigned directly
    # from it above, and d0 is uniform by construction -- so the retired form printed 136 of 136
    # on ANY graph, including one where three bottom states are never entered. A check that
    # cannot fail is not evidence (CLAUDE.md 6.9), and this one sat three lines under a comment
    # citing 6.6.
    entered = [i for i in range(fl.n) if fl.states[i].endswith("/bottom")
               and any(rhoV[ply][i] > 0 for ply in range(H))]
    print("  bottom-side states entered by the forward sweep: %d of %d" % (len(entered), fl.n // 2))
    if len(entered) == 0:
        bad += 1
        print("  FAIL no bottom-side state carries occupancy")
    seen = set(entered)
    never = [fl.states[i] for i in range(fl.n) if fl.states[i].endswith("/bottom")
             and i not in seen]
    if never:
        print("    never entered: %s" % ", ".join(never[:8]))

    # -- 7. what this frame does not have, NAMED (CLAUDE.md 6.7: an aggregate is unfalsifiable) - #
    print("  frame %s: %d of %d role-nodes priced; no move here %d%s; opponent has none %d%s; "
          "decks skipped %d position / %d technique card(s)"
          % (fl.opts.frame, len(fl.live_idx), fl.n,
             len(fl.frame_absent),
             (" (" + ", ".join(fl.frame_absent[:6]) + ")") if fl.frame_absent else "",
             len(fl.passive_opp),
             (" (" + ", ".join(fl.passive_opp[:6]) + ")") if fl.passive_opp else "",
             len(fl.skipped_pos_decks), fl.skipped_tech_cards))
    # THE FLOOR. Everything above this line is a diagnostic; this is the one hard claim: a frame
    # that prices nothing has produced a gradient vector of zeros, and every row in this report
    # would then read as a clean pass over an empty set.
    if not fl.live_idx:
        bad += 1
        print("  FAIL frame %s prices 0 of %d role-nodes -- this whole report is vacuous"
              % (fl.opts.frame, fl.n))

    print("  V0 at zero drilling: %+.6f  (uniform over %d start state(s))" % (V0, len(fl.live_idx)))
    return bad


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def rank(fl: Flow, m=None, lam=2.0, H=FLOW_H, top=40, exact=True):
    """Rank every deck by the adjoint, then re-solve the shortlist exactly."""
    m = m if m is not None else [0.0] * len(fl.deck_keys)
    grad, V0, _rho = adjoint(fl, m, lam, H)
    order = sorted(range(len(grad)), key=lambda k: -grad[k])
    out = []
    for k in order[:top]:
        g = exact_gain(fl, m, k, lam, H) if exact else grad[k] * M_CAP
        out.append({"deck": fl.deck_keys[k], "gain": g, "lin": grad[k] * M_CAP,
                    "pos": k < fl.n_pos_decks})
    negs = [k for k in order if grad[k] < 0]
    back = []
    for k in negs:
        back.append({"deck": fl.deck_keys[k], "gain": exact_gain(fl, m, k, lam, H) if exact
                     else grad[k] * M_CAP, "lin": grad[k] * M_CAP, "pos": k < fl.n_pos_decks})
    back.sort(key=lambda r: r["gain"])
    return out, back, V0, grad


def gate(fl, baseline_path, lam=2.0, H=FLOW_H, write=False):
    """
    The ratchet. Two things must hold before FLOW may show a human a negative number:

      1. the adjoint IS the derivative (selfcheck), and
      2. no NEW success cell drops value harder than the baseline already tolerates.

    (2) matters because a "backfiring" technique is either a real trap worth naming or a
    content defect, and the model cannot tell them apart. Every tolerated row is named in
    the baseline with a note, per CLAUDE.md 6.7 -- an aggregate count would be
    unfalsifiable, which is the failure the e2e:gen red list already has.
    """
    rows, _V = audit(fl, lam, H)
    if write:
        known = {}
        for r in rows:
            if r["drop"] <= -0.25:
                known["%s|%s" % (r["state"], r["move"])] = round(r["drop"], 3)
        doc = {
            "note": (
                "FLOW content ratchet. A row here is a SUCCESS branch that lands you somewhere "
                "worth LESS than where you left. Each is either a real trap the score should "
                "price, or an authoring defect. Regenerate with "
                "`python3 scripts/solve_flow.py --baseline`."),
            "lam": lam, "horizon": H, "frame": fl.opts.frame,
            "threshold": -0.25,
            "max_new": 0,
            "known": known,
            "reviewed": {
                "new-york-control/bottom|New York Control to Invisible Collar":
                    "SEAT INVERSION in the POSITION file, not a trap and NOT a name collision "
                    "(corrected v1.141.2 -- the earlier note here asserted two techniques share "
                    "the name; a panel disproved it). There is ONE referent: Eddie Bravo's no-gi "
                    "rubber-guard choke. The proof is the one field an LLM pass may not write -- "
                    "`content/Positions/Rubber Guard/Invisible Collar.json` carries eight "
                    "machine-verified clips and six name the position outright ('Invisible Collar "
                    "(MTS 134)' -- Eddie Bravo; 'Invisible Collar choke from Rubber Guard'; "
                    "'Double Invisible Collar cross choke, no-gi' -- Denny Prokopos), with THREE "
                    "of them filed on the `top` role whose own prerequisites demand 'Opponent "
                    "wearing gi'. Zero gi back-control footage anywhere on the file. The prose "
                    "was a confabulated gi back-mount at its birth commit (0734e5cf7), complete "
                    "with a fabricated Eddie Bravo quote explaining the contradiction away. The "
                    "directory says it too: the file lives under `Rubber Guard/`. "
                    "So the two New York transitions are CORRECT and must not be re-pointed; the "
                    "defect is that the position's two hands are swapped -- bottom holds escapes "
                    "and top holds the finishes, when the rubber-guard player attacks from the "
                    "BOTTOM. Measured counterfactual: swapping only `position_type` + `strength` "
                    "leaves this audit byte-identical; swapping the HANDS clears both rows. So "
                    "this is content re-authoring, not a two-field flip, and FLOW must not print "
                    "a backfiring badge for this family until it lands.",
                "new-york/bottom|New York to Invisible Collar": "Same collision as above.",
            },
        }
        with open(baseline_path, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1, sort_keys=True)
            fh.write("\n")
        print("  wrote %s (%d known rows at or below %.2f)" % (baseline_path, len(known), -0.25))
        return 0

    with open(baseline_path, "r", encoding="utf-8") as fh:
        base = json.load(fh)
    thr = base["threshold"]
    known = base["known"]
    bad = 0
    new = []
    for r in rows:
        if r["drop"] > thr:
            continue
        k = "%s|%s" % (r["state"], r["move"])
        if k not in known:
            new.append((k, r["drop"]))
        elif r["drop"] < known[k] - 0.02:
            new.append((k + " (WORSE than baseline %.3f)" % known[k], r["drop"]))
    print("  content ratchet: %d rows at or below %.2f, %d known, %d new"
          % (sum(1 for r in rows if r["drop"] <= thr), thr, len(known), len(new)))
    for k, d in new[: base.get("max_new", 0) + 12]:
        print("    NEW %+.3f  %s" % (d, k))
    if len(new) > base.get("max_new", 0):
        bad += 1
        print("  FAIL %d new value-dropping success cells (max_new %d)"
              % (len(new), base.get("max_new", 0)))
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--graph", default=GRAPH_PATH)
    ap.add_argument("--lam", type=float, default=2.0)
    ap.add_argument("--horizon", type=int, default=FLOW_H)
    ap.add_argument("--frame", default="nogi", choices=("gi", "nogi"))
    ap.add_argument("--top", type=int, default=25)
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--audit", action="store_true")
    ap.add_argument("--gate", action="store_true", help="selfcheck + the content ratchet")
    ap.add_argument("--baseline", action="store_true", help="rewrite the ratchet file")
    ap.add_argument("--baseline-path",
                    default=os.path.join(REPO_ROOT, "tests/artifacts/flow_validation_baseline.json"))
    ap.add_argument("--json", metavar="PATH")
    ap.add_argument("--fast", action="store_true", help="rank by the adjoint only, no exact re-solve")
    ap.add_argument("--reference", action="store_true",
                    help="write tests/artifacts/flow_reference.json (what tests/flow.test.mjs pins)")
    a = ap.parse_args(argv)

    g = load_graph(a.graph)
    fl = Flow(g, frame=a.frame)
    print("FLOW  states %d  decks %d (%d position, %d technique)  lam %.1f  H %d  frame %s"
          % (fl.n, len(fl.deck_keys), fl.n_pos_decks,
             len(fl.deck_keys) - fl.n_pos_decks, a.lam, a.horizon, a.frame))
    # The positive coverage count, printed on every run whatever the mode: 0 here means the null
    # layer has not landed, not that nobody looked.
    print("      priced %d/%d role-nodes   no move in this frame: %d%s   opponent has none: %d%s"
          % (len(fl.live_idx), fl.n,
             len(fl.frame_absent),
             (" (" + ", ".join(fl.frame_absent[:6]) + ")") if fl.frame_absent else "",
             len(fl.passive_opp),
             (" (" + ", ".join(fl.passive_opp[:6]) + ")") if fl.passive_opp else ""))

    if a.reference:
        # The whole-structure differential the JS kernel is gated against (CLAUDE.md 6.6):
        # a non-null count would pass a wrong-but-complete remap, so the fixture carries
        # EVERY deck's gradient and the test compares the whole vector.
        zero = [0.0] * len(fl.deck_keys)
        grad, V0, _rho = adjoint(fl, zero, a.lam, a.horizon)
        path = os.path.join(REPO_ROOT, "tests/artifacts/flow_reference.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({
                "note": ("FLOW reference. Emitted by `python3 scripts/solve_flow.py --reference` "
                         "from graph.json; `tests/flow.test.mjs` pins neural/src/flow.src.js "
                         "against it. The JS kernel rebuilds from the WIRE, whose attempt shares "
                         "are integer percents, so magnitudes differ where a share is small "
                         "(measured worst: Back Control to Cross Body Ride, 0.01299 -> 0.01000, "
                         "23.6%). The RANKING is not affected and the test pins that exactly."),
                "lam": a.lam, "horizon": a.horizon, "frame": a.frame, "v0": V0,
                "decks": fl.deck_keys,
                "grad": [round(x, 10) for x in grad],
                "nPosDecks": fl.n_pos_decks,
            }, fh, indent=0)
            fh.write("\n")
        print("  wrote %s  (%d decks, V0 %+.6f)" % (path, len(grad), V0))
        return 0

    if a.baseline:
        return gate(fl, a.baseline_path, a.lam, a.horizon, write=True)

    if a.gate:
        bad = selfcheck(fl, a.lam, a.horizon) + gate(fl, a.baseline_path, a.lam, a.horizon)
        print("validate:flow: %s" % ("OK" if bad == 0 else "%d FAILURES" % bad))
        return 1 if bad else 0

    if a.selfcheck:
        bad = selfcheck(fl, a.lam, a.horizon)
        print("selfcheck: %s" % ("OK" if bad == 0 else "%d FAILURES" % bad))
        return 1 if bad else 0

    if a.audit:
        rows, _V = audit(fl, a.lam, a.horizon)
        print("\nSUCCESS CELLS THAT LOWER YOUR VALUE  %d of %d success cells"
              % (len(rows), sum(len(br[0]) for i in range(fl.n) for br in fl.mine[i])))
        for r in rows[:a.top]:
            print("  %+.3f  %-28s --%-42s-> %s" % (r["drop"], r["state"], r["move"], r["to"]))
        by = {}
        for r in rows:
            by[r["state"]] = min(by.get(r["state"], 0.0), r["drop"])
        print("\n  worst by state: %s" % ", ".join(
            "%s %+.2f" % (k, v) for k, v in sorted(by.items(), key=lambda kv: kv[1])[:6]))
        if a.json:
            with open(a.json, "w", encoding="utf-8") as fh:
                json.dump({"rows": rows}, fh, indent=1)
            print("  wrote %s" % a.json)
        return 0

    out, back, V0, grad = rank(fl, lam=a.lam, H=a.horizon, top=a.top, exact=not a.fast)
    print("\nV0 at zero drilling %+.6f   (the value of a roll before you drill anything, uniform "
          "over the %d state(s) this frame prices)" % (V0, len(fl.live_idx)))
    print("\nTOP %d BY GAIN  (what mastering this deck is worth to your whole game)" % a.top)
    for i, r in enumerate(out):
        print("  %2d. %+.5f  %-8s %s" % (i + 1, r["gain"], "position" if r["pos"] else "tech", r["deck"]))
    print("\nBACKFIRING  %d decks whose mastery LOWERS V0" % len(back))
    for r in back[:15]:
        print("      %+.5f  %-8s %s" % (r["gain"], "position" if r["pos"] else "tech", r["deck"]))
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump({"v0": V0, "lam": a.lam, "H": a.horizon, "frame": a.frame,
                       "decks": fl.deck_keys, "grad": grad,
                       "top": out, "backfiring": back}, fh, indent=1)
        print("\nwrote %s" % a.json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
