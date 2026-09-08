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

THE FIVE THINGS THAT ARE EASY TO GET WRONG
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

5. NULL IS NOT ZERO.  Every forked probability is ``{"gi": x, "nogi": y}`` and a
   ``null`` cell means THE EDGE DOES NOT EXIST IN THAT RULESET - distinct from
   ``0``, "exists but is ~never attempted" (``scripts/_ruleset.py``,
   calibration-v2).  ``or 0`` anywhere in this file would re-animate an edge the
   corpus says is absent and turn a structural fact into a plausible number; the
   rule is DROP THE CELL AND COUNT WHAT YOU DROPPED (CLAUDE.md 6.6).  A state
   whose every attempt cell is null in this frame has NO HAND HERE, which is not
   the same fact as "no legal move": see ``Model.frame_absent`` for the state
   space that follows from it, and for the larger absence this file deliberately
   does NOT model.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # same seam as solve_flow.py

# ONE implementation of the ruleset contract.  `present_rulesets(values)` is the only correct way
# to ask "which frames does this thing exist in" -- a bare loop over RULESETS answers a different
# question and gets a plausible answer for a frame that is not there (CLAUDE.md 6.5).
from _ruleset import RULESETS, present_rulesets   # noqa: E402

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


def tech_rate(tech, opts):
    """
    The technique's success rate in ``opts.frame``, or ``None`` when it has none there.

    ONE SEAM, because the frame-correct version has to land in exactly one place.  Today this
    reads the FOLDED scalar ``successRate``, which ``regenerate_graph.py`` writes from the no-gi
    cell: exact in no-gi, and in gi it is the rate 146 of 1328 ``/attacker`` nodes fork away from.
    Recompute both figures -- never quote them from here (CLAUDE.md 6.9):

        python3 scripts/solve_edge_values.py --rate-fork

    Reading ``successRateByRuleset[opts.frame]`` instead is CORRECT and moves the ``--frame gi``
    report only (nogi is bit-identical, 0 of 1328 cells differ); it is deliberately NOT taken
    here so that the null-safety pass moves no number, and it belongs in its own commit with
    the 146 named.

    What IS taken here: a missing rate returns ``None`` and ``build_hand`` DROPS the card.
    ``or 0.0`` would price a technique that does not exist in this ruleset as one that always
    fails -- a plausible number where the truth is a structural absence.  Measured today: 0 of
    2656 ``/attacker`` + ``/defender`` nodes lack the field, so the drop is unreachable and this
    is null-safety, not a behaviour change.

    AVAILABILITY AND VALUE ARE TWO QUESTIONS AND THEY READ TWO DIFFERENT FIELDS.  Deferring the
    value to the folded scalar is a deliberate no-op; deferring AVAILABILITY to it as well is a
    bug, because ``regenerate_graph.py`` folds the scalar from the **no-gi** cell alone
    (grep ``_complement_rate``: it returns ``None`` for a null, and the ``success_rate is None``
    branch beside it keeps an explicit null a null -- ``.get('success_rate', 50)`` fires only on
    an ABSENT key).  So the day a technique's no-gi rate is nulled, ``successRate`` goes null in
    BOTH frames' view and a scalar-only reader silently drops the card from the **gi** hand as
    well -- deleting an edge that gi definitely has.  Reproduce on any technique node ``k``::

        n = g["transitions"][k]; n["successRateByRuleset"]["nogi"] = None; n["successRate"] = None
        for fr in ("gi", "nogi"):
            m = Model(g, Opts(frame=fr))
            print(fr, sum(1 for h in m.hands for a in h if a.name == n["name"]), m.absent_cells)

    Scalar-only prints ``gi 0`` and ``nogi 0``; this form prints ``gi 1`` and ``nogi 0, 1``.
    Availability is therefore decided by THIS frame's
    own cell, and the scalar is used only as the value once the frame has said the card exists.
    Byte-identical today (every role-node carries both cells and a non-null scalar).
    """
    m = tech.get("successRateByRuleset")
    have = isinstance(m, dict) and opts.frame in m
    if have and m[opts.frame] is None:
        return None                       # the technique DOES NOT EXIST in this ruleset
    scalar = tech.get("successRate")      # the folded no-gi headline: today's shipped value
    if scalar is not None:
        return scalar
    # The scalar folded away but this frame still has a cell -- the gi-only case above.  Reading
    # the frame's own cell is the only honest answer left; it is also what the deferred fix does
    # everywhere, so this branch never disagrees with it.
    return m[opts.frame] if have else None


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
        rate = tech_rate(tech, opts)
        # build_hand drops a rate-less technique before it can reach here.  If that ever stops
        # being true, fail loudly: pricing the card at p=0 deals a move that can only miss, and
        # a card that can only miss is indistinguishable from a hard one.
        if rate is None:
            raise ValueError("build_action: %r has no success rate in frame %s"
                             % (tech.get("name"), opts.frame))
        p = rate / 100.0
    return p, out[0], out[1], empty


def build_hand(graph, key, opts):
    """
    The dealt hand at a role-node: role-filtered, origin-filtered (relaxing ORIGIN
    and never ROLE when that empties it), weights renormalised to 1.

    Returns ``(hand, relaxed, absent, frame_absent)``:

      absent        transitions DROPPED because this ruleset has no cell for them - a null
                    attempt probability, or a technique with no success rate here.  Counted,
                    never summed as 0: ``float(raw or 0)`` deals a byte-identical hand today
                    (``att <= 0`` already drops it two lines down) while destroying the only
                    signal that says WHY the card is missing.  A dealt hand cannot tell "no
                    legal move" from "no frame"; this counter is what can.
      frame_absent  every authored transition is null here, so the state HAS NO HAND IN THIS
                    FRAME.  Not the same fact as an empty hand, and it must not be priced -
                    see ``Model.frame_absent``.
    """
    node = graph["positions"][key]
    hub, role = node["hub"], node["role"]
    ts = node.get("transitions") or []
    picks, absent = [], 0
    for t in ts:
        raw = t["attemptProbabilityByRuleset"][opts.frame]
        if raw is None:                       # the move DOES NOT EXIST in this ruleset
            absent += 1
            continue
        att = float(raw)
        if att <= 0:                          # it exists here, and is ~never attempted
            continue
        cat = "submissions" if t.get("isSubmission") else "transitions"
        tech = graph[cat].get(t["target"] + "/attacker")
        if tech is None:
            continue
        if tech.get("fromRole") != role:      # the role filter is NEVER relaxed
            continue
        if tech_rate(tech, opts) is None:     # the edge exists, the technique has no rate here
            absent += 1
            continue
        picks.append((t, att, cat, tech))

    same = [x for x in picks if x[3].get("fromPositionId") == hub]
    if same and opts.origin:
        use, relaxed = same, False
    else:
        # NOTHING WAS RELAXED WHEN THERE WAS NOTHING TO RELAX.  The old one-liner reported
        # `relaxed` here purely because `opts.origin` was on, so a state with NO cards at all was
        # swept into main()'s origin-relaxed row and printed under an OK marker.
        use, relaxed = picks, (bool(opts.origin) and bool(picks))
    tot = sum(x[1] for x in use)
    hand = []
    for t, att, cat, tech in use:
        p, succ, miss, empty = build_action(graph, tech, opts)
        hand.append(Action(t["technique"], t["target"], cat, att / tot if tot else 0.0,
                           p, succ, miss, empty))
    return hand, relaxed, absent, bool(ts) and absent == len(ts)


class Model:
    """
    The 272-state kernel: my hand at each state, and the opponent's.

    THE STATE SPACE DOES NOT SHRINK WITH THE FRAME, and that is deliberate.  Every role-node
    keeps its index so that flip(), the outcome targets and every downstream join still resolve;
    what changes per frame is which of those states may be PRICED, carried here as three named,
    printed sets rather than as a value:

      frame_absent  every attempt cell is null in this frame -> the frame deals no hand here.
      passive_opp   my hand exists but my opponent's does not, because THEIR role-node is
                    frame-absent.  The recursion's `if not hand` branch prices an optionless
                    opponent as endRound("reset") - a draw - which is right for a state that HAS
                    this frame and no legal move and wrong for a state that has no frame.  The
                    two must not share a verdict, so the second set is named.
      live          the rest: the states this frame can actually price.  Every AGGREGATE in the
                    report averages, ranks and quantiles over `live`, because 0.0 is a legal V
                    and a fabricated one is indistinguishable from an earned one.

    WHICH ABSENCE THIS IS, AND THE LARGER ONE IT IS NOT.  `frame_absent` is the STRICT reading:
    no cell at all.  The corpus's own verdict is REACHABILITY - `regenerate_neural_data.
    frame_reachable`, ledgered in `tests/artifacts/ruleset_availability.json` - which today
    isolates 18 no-gi role-nodes and 104 techniques where the strict reading isolates 0, because
    a state can be authored with a full no-gi hand and still be impossible to ARRIVE at without a
    lapel.  Adopting the reachability set here is CORRECT and is a BEHAVIOUR CHANGE: measured on
    the FLOW side, restricting the start distribution to the 254 reachable no-gi role-nodes moves
    V0 +0.076492575 -> +0.073898681 (delta -0.002594), which is an order of magnitude more than
    the whole null pass.  It belongs in its own commit, with the 18 named and the FLOW reference
    fixture regenerated; this file's absent set is deliberately the subset that moves no number
    today.
    """

    def __init__(self, graph, opts):
        self.graph, self.opts = graph, opts
        P = graph["positions"]
        self.states = tuple(sorted(k for k in P if is_role(k)))
        self.index = {s: i for i, s in enumerate(self.states)}
        self.hands, self.relaxed = [], []
        self.absent_cells = 0                 # attempt/rate cells this frame does not have
        absent = []
        for s in self.states:
            h, r, ab, gone = build_hand(graph, s, opts)
            self.hands.append(h)
            self.absent_cells += ab
            if r:
                self.relaxed.append(s)
            if gone:
                absent.append(s)
        self.frame_absent = tuple(absent)
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
        # Controls D and E empty the opponent BY CONSTRUCTION - that is the experiment, not an
        # absence - so only the mirror opponent can carry a passive partner.
        gone = set(self.frame_absent)
        self.passive_opp = (tuple(s for s in self.states if s not in gone and flip(s) in gone)
                            if opts.opponent == "mirror" else ())
        skip = gone | set(self.passive_opp)
        self.live = tuple(s for s in self.states if s not in skip)
        # THE POSITIVE COVERAGE COUNT for the whole deal.  `absent_cells` counts what was
        # DROPPED, and a drop count of 0 is what both "nothing was absent" and "the loop never
        # ran" print.  `dealt` is the number that can only be non-zero if cards actually reached
        # a hand, so it is the one main() puts a floor under (CLAUDE.md 6.6).
        self.dealt = sum(len(h) for h in self.hands)


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
                # TWO DIFFERENT FACTS ARRIVE HERE AND ONLY ONE OF THEM IS A DRAW.
                #   * a genuinely optionless opponent is endRound("reset") = a draw, which is
                #     the 0.0 already sitting here.  (Model E never reaches this loop at all:
                #     there is no opponent turn to take, so a "hand-over" is me keeping the
                #     turn -- see `noopp` in the V recursion below.)
                #   * an opponent whose role-node is FRAME-ABSENT has no frame, not no options.
                #     Nothing can be said about it here, because the recursion still needs a
                #     number for continuations that land on this state; 0.0 is a legal value and
                #     so it cannot double as "no data".  The state is named in
                #     `model.passive_opp` and every report aggregate skips it.
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
                # Same rule as the opponent branch above: 0.0 is a LEGAL value here, so it can
                # never mean "no data".  Absence lives in `model.frame_absent`, not in the
                # number.  Dropping s from sol.v / sol.q instead is NOT free -- verify(),
                # print_hand() and regenerate_neural_data.build_move_edge all index these dicts
                # by model.states and would raise KeyError.
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
    # A TRIPWIRE, not a derivation: 133 positions x 2 seats. 272 until v1.171.0, when the three
    # Kesa Gatame positions that existed twice (judo name + English name) collapsed to one each.
    # Moving this number is a statement about the corpus; say why in the commit that moves it.
    checks.append(("266 position role-nodes", len(roles) == 266, "%d" % len(roles)))
    checks.append(("non-role position entries carry no transitions",
                   all(not P[k].get("transitions") for k in P if not is_role(k)),
                   "%d entries" % (len(P) - len(roles))))

    # PER-FRAME ATTEMPT SUMS.  A null cell is a move that does not exist in that ruleset, so it is
    # DROPPED from the sum and never summed as 0 -- summing it would leave the frame short of 100
    # and trip this very check for the wrong reason.  A frame with no surviving cell is a frame
    # the state does not exist in (`_ruleset.present_rulesets`, the one place that question is
    # answered): there is nothing to sum, so the frame is skipped AND COUNTED, because "checked
    # and clean" and "never looked" must not print the same thing (CLAUDE.md 6.6).
    #
    # The old single row OR-ed three different claims together (gi, nogi and the folded scalar),
    # so its failure text could not say which of them broke.  They are three rows now.
    frames_checked, frame_gone, bad = 0, [], []
    for k in roles:
        maps = [t["attemptProbabilityByRuleset"] for t in P[k]["transitions"]]
        here = present_rulesets(maps)
        for f in RULESETS:
            if f not in here:
                frame_gone.append("%s|%s" % (k, f))
                continue
            frames_checked += 1
            if abs(sum(c for c in (m.get(f) for m in maps) if c is not None) - 100) > 1e-6:
                bad.append("%s|%s" % (k, f))
    # THE FLOOR IS NOT A MAGIC NUMBER.  Every role-node must exist in at least ONE ruleset, so the
    # loop has to land at least once per role-node; below that it has stopped looking, which is
    # the only way this check could ever pass by accident.
    floor = len(roles)
    checks.append(("attempt sums == 100, per ruleset frame",
                   not bad and frames_checked >= floor,
                   "%d frame(s) summed over %d role-nodes (floor %d), %d bad%s"
                   % (frames_checked, len(roles), floor, len(bad),
                      ": " + ", ".join(bad[:6]) if bad else "")))
    gone_per_role = Counter(x.rsplit("|", 1)[0] for x in frame_gone)
    nowhere = sorted(k for k, c in gone_per_role.items() if c == len(RULESETS))
    checks.append(("every role-node exists in at least one frame", not nowhere,
                   "%d frame(s) absent%s"
                   % (len(frame_gone),
                      "; ABSENT FROM BOTH: " + ", ".join(nowhere[:6]) if nowhere else "")))

    # THE SCALAR IS THE NO-GI CELL, folded by `regenerate_graph.py::_position_edge`
    # (`headline = cell(ap_map, 'nogi')`), and it is emitted as JSON **null** when that frame
    # carries no cell.  TWO SEPARATE THINGS FOLLOW, and missing either one is a live defect:
    #
    #   * A NULL SCALAR IS NOT A NUMBER.  `sum(t["attemptProbability"] for t in ts)` raises
    #     `TypeError: unsupported operand type(s) for +: 'int' and 'NoneType'` the moment ONE cell
    #     in an otherwise-present hand is nulled -- which is 60 of the 71 cells in the content
    #     pass, so this is the common case, not the corner.  Drop the null cells and COUNT them.
    #     Never `or 0`: the 60-cell class is nulling cells that already read 0, so `or 0` restores
    #     the exact value that makes the sum come out right and the row can then never tell a
    #     correctly-absent edge from a present one (CLAUDE.md 6.6).
    #   * A STATE WHOSE WHOLE NO-GI FRAME IS NULL has no column to check at all -- skip it, or the
    #     empty sum reads as 0 and fails a correct build.
    #
    # An earlier reading of this file assumed the retired emitter (`0 if headline is None else
    # headline`).  That fold is gone: it turned "does not exist in no-gi" into "exists and is
    # never attempted" with byte-identical output, which is the whole reason the contract exists.
    #
    # FOLD PARITY is checked in the same pass and is why this row is about the SCALAR rather than
    # being a duplicate of the per-frame row above: the scalar must be null exactly where the
    # no-gi cell is null.  A mismatch would otherwise surface only as a sum short of 100, naming
    # a role-node and no reason.
    scalar_checked, scalar_absent, scalar_bad, fold_bad = 0, 0, [], []
    for k in roles:
        ts = P[k]["transitions"]
        if "nogi" not in present_rulesets(t["attemptProbabilityByRuleset"] for t in ts):
            continue
        scalar_checked += 1
        col = []
        for t in ts:
            sc = t["attemptProbability"]
            cellv = t["attemptProbabilityByRuleset"].get("nogi")
            if (sc is None) != (cellv is None):
                fold_bad.append("%s|%s" % (k, t.get("technique", "?")))
            if sc is None:
                scalar_absent += 1
                continue
            col.append(sc)
        if abs(sum(col) - 100) > 1e-6:
            scalar_bad.append(k)
    # "0/0 ok" and "272/272 ok" must not read the same.  A no-gi column that exists NOWHERE is a
    # legitimate content state (the whole ruleset could be nulled out) and so is not a failure
    # here -- the per-frame rows above own that claim -- but the row must say out loud that it
    # checked nothing rather than showing a clean tally over an empty set.
    checks.append(("attempt scalar == 100 (the folded no-gi column)",
                   not scalar_bad and not fold_bad,
                   "NOTHING CHECKED: no role-node has a no-gi frame" if not scalar_checked else
                   "%d/%d role-nodes with a no-gi frame, %d null cell(s) dropped%s%s"
                   % (scalar_checked - len(scalar_bad), scalar_checked, scalar_absent,
                      "; BAD SUM: " + ", ".join(scalar_bad[:6]) if scalar_bad else "",
                      "; SCALAR/CELL FOLD MISMATCH: " + ", ".join(fold_bad[:6])
                      if fold_bad else "")))

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
    rate_cmp, pairs_absent = 0, 0
    for cat in ("transitions", "submissions"):
        for k, a in graph[cat].items():
            if not k.endswith("/attacker"):
                continue
            d = graph[cat].get(k[:-9] + "/defender")
            if d is None:
                viol["missing_defender"] += 1
                continue
            pairs += 1
            # THE COMPLEMENT IS A PER-FRAME CLAIM.  The retired form was
            # `(a.successRate or 0) + (d.successRate or 0)`, which computes 0 + 0 - 100 = -100 for
            # a pair correctly ABSENT from a frame -- a fabricated violation -- and, being
            # frame-blind, cannot see the one genuine defect it should be the one to catch: an
            # ASYMMETRIC null, where the attacker exists in a frame and their defender does not.
            # Both cells null -> the pair does not exist in that frame: skip it AND COUNT it.
            for fr in RULESETS:
                ra, rd = _pair_rate(a, fr), _pair_rate(d, fr)
                if ra is None and rd is None:
                    pairs_absent += 1
                    continue
                if ra is None or rd is None:
                    viol["asymmetric_null"] += 1
                    continue
                rate_cmp += 1
                if abs(ra + rd - 100) > 1e-6:
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
    # The comparison COUNT is the coverage number: a matcher that matched nothing prints the same
    # "violations: ZERO" as one that checked every pair.  Floor: one comparison per pair, because
    # a technique that exists in no ruleset at all is already a failure two rows up.
    checks.append(("attacker/defender mirror, 6 invariants",
                   not viol and rate_cmp >= pairs,
                   "%d pairs, %d (pair,frame) rate comparisons (floor %d), %d absent, "
                   "violations: %s" % (pairs, rate_cmp, pairs, pairs_absent, dict(viol) or "ZERO")))
    return checks


def _pair_rate(tech, frame):
    """One frame's success rate off a technique node, for the mirror check ONLY.

    Deliberately NOT `tech_rate`: that seam answers "what does the SOLVE price this card at", and
    it reads the folded scalar on purpose (see its docstring).  This one answers "does the
    authored pair complement in this frame", which is a question about the forked cells, so it
    reads them and falls back to the scalar only where a node carries no map at all.  Never
    `or 0` -- a missing rate is a technique that does not exist in this frame.
    """
    m = tech.get("successRateByRuleset")
    if isinstance(m, dict) and frame in m:
        return m[frame]
    return tech.get("successRate")


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

    Returns ``(mean, max, worst_state, states_averaged)``.
    """
    o = (opts or Opts())
    sol = solve(graph, lam, H, o)
    m = sol.model
    # AVERAGE OVER THE FRAME'S OWN STATES.  A frame-absent state and its passive-opponent partner
    # both carry a fabricated 0.0 in p_win, which is a real number in a real mean and drags this
    # row without changing its maximum -- so the row would move for a reason nobody could read
    # off it.  `used` is returned and PRINTED: a mean whose denominator can shrink says nothing
    # on its own.
    live = m.live
    if not live:
        # NOT ``return 0.0, 0.0, None, 0``.  A mean of 0.0 over an empty set is the exact shape
        # this whole pass exists to delete: the invariant row would print `0.0000 0.0000` and
        # read as the strongest possible PASS on a frame that priced nothing at all (CLAUDE.md
        # 6.6 -- "the comparison loop had nothing to iterate").  ``None`` cannot be mistaken for
        # a measurement, and every caller is required to say so out loud.
        return None, None, None, 0
    worst, tot, mx = None, 0.0, 0.0
    for s in live:
        d = abs(sol.pwin[s] - sol.ul[flip(s)])
        tot += d
        if d > mx:
            mx, worst = d, s
    return tot / len(live), mx, worst, len(live)


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #
BOARD = ["back-control/top", "mount/top", "side-control/top", "north-south/top",
         "knee-on-belly/top", "closed-guard/bottom", "standing-position/top",
         "half-guard/top", "closed-guard/top", "mount/bottom", "side-control/bottom",
         "back-control/bottom"]


def _rank(sol, s):
    """``(rank, population)`` over the states the FRAME actually has.

    A frame-absent state priced at a fabricated 0.0 still occupies a rank slot and silently
    renumbers everything below it, and a bare ordinal out of an unnamed population is not
    reproducible -- so the denominator travels with the number and is printed beside it.
    Returns ``(None, population)`` for a state this frame cannot price.
    """
    live = [k for k in sol.model.live if k in sol.v]
    order = sorted(live, key=lambda k: -sol.v[k])
    return (order.index(s) + 1 if s in order else None), len(order)


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

    Returns the number of AUDIT-LEVEL failures (today: only "there was nothing to audit"), so
    that a vacuous run cannot exit 0 -- printing FAIL and returning None was the same defect one
    layer down.
    """
    sol = solve(g, lam, H, base_opts)
    m = sol.model
    print("\n== SPEC HEADLINES: measured vs quoted ==")

    def line(label, measured, quoted):
        print("    %-58s measured %-30s quoted %s" % (label, measured, quoted))

    # EVERY DENOMINATOR HERE IS THE FRAME'S OWN STATE COUNT, never the hard-coded 272 this used to
    # print.  A frame-absent state has no cards, so `len(tops) <= 1` is trivially true for it and
    # it scores as "top card identical across lam" -- a state with no hand cannot agree with
    # itself, and counting it inflates the very figures this function exists to audit.
    live = [s for s in m.live if sol.q[s]]
    if len(live) < len(m.states):
        print("    NOTE: %d of %d role-nodes are not priced in this frame and are excluded from "
              "every figure below (%s)"
              % (len(m.states) - len(live), len(m.states),
                 ", ".join(sorted(set(m.states) - set(live))[:6]) or "none"))
    if not live:
        print("    FAIL no role-node in frame %s has a hand -- nothing to audit" % base_opts.frame)
        return 1

    pairs = [(s, r) for s in live for r in sol.q[s]]
    e = [r["edge"] for _, r in pairs]
    line("(state, action) pairs", len(pairs), "1246")
    line("EDGE min/p5/p25/median/p75/p95/max",
         "%d/%d/%d/%d/%d/%d/%d" % (min(e), _pct(e, .05), _pct(e, .25), _pct(e, .5),
                                   _pct(e, .75), _pct(e, .95), max(e)),
         "-51/-14/-3/0/+4/+12/+46")
    line("within +/-15", "%.1f%%" % (100.0 * sum(1 for x in e if abs(x) <= 15) / len(e)), "93.3%")
    line("in the +/-1 deadband", "%.1f%%" % (100.0 * sum(1 for x in e if abs(x) <= 1) / len(e)),
         "23.3%")
    dist = [len(set(r["edge"] for r in sol.q[s])) / float(len(sol.q[s])) for s in live]
    line("share of a hand's cards showing a distinct value",
         "%.1f%%" % (100.0 * sum(dist) / len(dist)), "89.3%")

    # 4.4 -- the label is forced.  A card that TIES for best odds is no contradiction, so
    # the test is "the top-EDGE card is not among the best-odds cards".
    forced, big = 0, 0
    for s in live:
        rows = sol.q[s]
        if len(rows) < 2:
            continue
        mx = max(r["odds"] for r in rows)
        if rows[0]["odds"] < mx - 1e-12:
            forced += 1
            if (mx - rows[0]["odds"]) * 100 > 15:
                big += 1
    line("hands where best-EDGE != best-odds", "%d / %d" % (forced, len(live)), "98 / 272")
    line("  ...of those, odds gap > 15pp", big, "17")

    # 4.1 -- drilling visibly moves it.  Baseline held fixed: this is "what does drilling
    # THIS card do to THIS card".  (Strictly B(s) moves too, since it is a weighted mean
    # that includes the card; that stricter figure is printed underneath.)
    moves, strict = [], []
    for s in live:
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
    for s in live:
        tops = set(sl[l].q[s][0]["name"] for l in sl if sl[l].q[s])
        orders = set(tuple(r["name"] for r in sl[l].q[s]) for l in sl)
        tails = set(frozenset(r["name"] for r in sl[l].q[s] if r["edge"] <= -3) for l in sl)
        same_top += len(tops) <= 1
        same_ord += len(orders) == 1
        same_tail += len(tails) == 1
    line("top card identical across lam in {1,2,4}", "%d / %d" % (same_top, len(live)), "266 / 272")
    line("full ranked order identical", "%d / %d" % (same_ord, len(live)), "246 / 272")
    line("tail (EDGE <= -3) membership identical", "%d / %d" % (same_tail, len(live)), "155 / 272")

    # 5 -- the tail rule
    print("    tail rule (EDGE <= -delta):   %-10s %-10s %-14s %s"
          % ("mean share", "median", "empty tails", "tails > 60%"))
    for d in (0, 2, 3, 5, 8):
        sh = [sum(1 for r in sol.q[s] if r["edge"] <= -d) / float(len(sol.q[s]))
              for s in live]
        print("      delta=%-2d                     %-10s %-10s %-14s %s"
              % (d, "%.1f%%" % (100 * sum(sh) / len(sh)), "%.1f%%" % (100 * _pct(sh, .5)),
                 "%d / %d" % (sum(1 for x in sh if x == 0), len(sh)), sum(1 for x in sh if x > 0.60)))
    print("      quoted:  d=0 54.4%/50.0%/0/87   d=2 34.9%/33.3%/30/17   "
          "d=3 26.7%/33.3%/66/11   d=5 17.8%/16.7%/120/4   d=8 12.4%/0.0%/157/1")

    # p_win compression, and the q-form sensitivity
    pw = sorted(sol.pwin[s] for s in live)
    line("p_win range across all %d priced states" % len(live),
         "%.2f - %.2f" % (pw[0], pw[-1]), "0.80 - 0.99")
    below = [s for s in live if sol.pwin[s] < 0.80]
    line("  ...states below p_win 0.80 (the quoted floor)",
         "%d, worst %s at %.4f" % (len(below), min(below, key=lambda s: sol.pwin[s]) if below else "-",
                                   pw[0]), "0 implied")
    alt = solve(g, lam, H, base_opts.replace(qform="marginal"))
    d = sum(1 for s in live for r in sol.q[s] if r["edge"] != alt.edge[s][r["name"]])
    line("EDGE integers moved by qform=marginal", "%d / %d" % (d, len(pairs)), "(not in the spec)")
    return 0


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
    # `symmetric_residual` returns None rather than a fabricated 0.0 when the frame prices no
    # state; a mutation table that printed 0.0000e+00 there would report the strongest possible
    # pass for the weakest possible reason.
    def _res(mean, mx, used):
        return ("n/a        n/a" if used == 0
                else "mean %.4e  max %.4e" % (mean, mx))

    for tag, gg, o in rows:
        mean, mx, _w, used = symmetric_residual(gg, lam, H, o)
        print("     %-38s %s  over %d states" % (tag, _res(mean, mx, used), used))
    saved = flip
    flip = lambda k: k                                   # noqa: E731
    try:
        mean, mx, _w, used = symmetric_residual(g, lam, H, sym)
        print("     %-38s %s  over %d states   <- STILL ZERO: near-tautology"
              % ("flip() replaced by the identity", _res(mean, mx, used), used))
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
    ap.add_argument("--rate-fork", action="store_true",
                    help="recompute how far successRateByRuleset forks from the folded scalar "
                         "(the figures tech_rate's docstring cites)")
    a = ap.parse_args(argv)

    g = load_graph(a.graph)

    if a.rate_fork:
        # The number ships with the script that recomputes it (CLAUDE.md 6.9).  `tech_rate` reads
        # the folded scalar; this says exactly what that costs, per frame, over the whole corpus.
        n, d, absent = 0, Counter(), Counter()
        for cat in ("transitions", "submissions"):
            for k, nd in g[cat].items():
                if not k.endswith("/attacker"):
                    continue
                n += 1
                for fr in RULESETS:
                    c = _pair_rate(nd, fr)
                    if c is None:
                        absent[fr] += 1
                    elif c != nd.get("successRate"):
                        d[fr] += 1
        print("/attacker nodes: %d" % n)
        for fr in RULESETS:
            print("  %-5s %4d cell(s) differ from the folded scalar, %d absent" % (fr, d[fr], absent[fr]))
        return 0

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

    # WHAT THIS FRAME DOES NOT HAVE, named rather than counted.  An aggregate is unfalsifiable and
    # rots into permanent noise (CLAUDE.md 6.7), so every member is printed; the marker is `??`
    # because a frame-absent role-node is a legitimate content fact once the null layer lands, and
    # a row that is permanently FAIL stops being read.  The HARD failures live where they cannot
    # be anything but wrong: "absent from BOTH frames" in the self-check above, and p_draw == 1.0
    # below.  `absent cells` is the positive coverage count -- 0 here means the null layer has
    # not landed yet, not that nobody looked.
    print("  [%s] %-42s %s" % ("OK" if not m.frame_absent else "??",
                               "role-nodes with NO move in this frame",
                               "%d: %s" % (len(m.frame_absent), ", ".join(m.frame_absent) or "none")))
    print("  [%s] %-42s %s" % ("OK" if not m.passive_opp else "??",
                               "...and whose opponent therefore cannot move",
                               "%d: %s" % (len(m.passive_opp), ", ".join(m.passive_opp) or "none")))
    # THE FLOOR, because a drop count is not coverage.  `0 dropped` is printed both by a frame
    # with no nulls and by a build_hand that stopped dealing, and `272 priced` is printed both by
    # a frame that priced 272 hands and by one that priced 272 empty ones.  `dealt` is the count
    # that can only be earned: at least one card per priced state, or the report below is about
    # nothing.  FAIL, not `??` -- unlike the two rows above, there is no content fact that makes
    # this legitimately empty.
    deal_floor = max(1, len(m.live))      # never print "floor 0" -- that is not a floor
    deal_ok = bool(m.live) and m.dealt >= deal_floor
    print("  [%s] %-42s %d dropped; %d of %d role-nodes priced; %d cards dealt (floor %d)"
          % ("OK" if deal_ok else "FAIL", "attempt/rate cells absent in this frame",
             m.absent_cells, len(m.live), len(m.states), m.dealt, deal_floor))
    if not deal_ok:
        failed.append("the frame dealt fewer cards than it priced states")

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
    # THE ONE ROW IN THIS REPORT THAT REACTS TO A NULL, so it has to say what it is measuring.  A
    # state with no frame is 100% draw by construction, which is not residual draw mass -- it is
    # the absence of a game.  Averaging it moves the mean and pins the max at a flat 1.0000, and
    # the row names no state, so it reads as a summary and hides the one number that changed.
    dm = sorted((sol.pdraw[s], s) for s in sol.model.live)
    if not dm:
        print("  residual draw mass at H=%d: no state in this frame has a hand" % a.horizon)
    else:
        print("  residual draw mass at H=%d over %d priced state(s): mean %.4f  median %.4f  "
              "max %.4f (%s)"
              % (a.horizon, len(dm), sum(x for x, _ in dm) / len(dm), dm[len(dm) // 2][0],
                 dm[-1][0], dm[-1][1]))
    # p_draw == 1 is not a quantile.  At a state this frame DOES price it can only mean that no
    # path out of it reached a terminal in H plies, so it is a named failure row rather than the
    # tail of a distribution.  (A frame-absent state sits at 1.0 by construction and is reported
    # by its own row above, not here -- two different facts, two different rows.)
    flat = [s for x, s in dm if x > 1.0 - 1e-9]
    if flat:
        failed.append("states at p_draw == 1.0")
        print("  [FAIL] %-42s %d: %s"
              % ("states with NO hand for the whole horizon", len(flat), ", ".join(flat[:6])))

    # ---- 3. the board
    print("\n== THE BOARD (lam=%.3g, H=%d, %s, same-origin, chained, shipped turn rule) =="
          % (a.lam, a.horizon, a.frame))
    print("  %-26s %9s %8s %8s %8s %9s"
          % ("state", "V", "p_win", "p_loss", "p_draw", "rank/of"))
    for s in BOARD:
        if s not in sol.v:
            continue
        rk, pop = _rank(sol, s)
        print("  %-26s %+9.4f %8.4f %8.4f %8.4f %5s/%-3d"
              % (s, sol.v[s], sol.pwin[s], sol.ploss[s], sol.pdraw[s],
                 "-" if rk is None else rk, pop))

    # ---- 4. the invariant check
    print("\n== INVARIANT: p_win(s | my turn) == p_loss(opp(s) | their turn) ==")
    print("  (equal only if both players play the same way; ours deliberately do not)")
    rows = [("shipped model (I argmax)", base_opts),
            ("symmetric SAMPLING, shipped turn rule", base_opts.replace(policy="sample")),
            ("fully symmetric (both sample, both keep initiative, stay-put charged 1 ply)",
             base_opts.replace(policy="sample", initiative="symmetric", stayput="charge"))]
    print("  %-72s %10s %10s %7s" % ("control", "mean", "max", "states"))
    sym_named = []
    for label, o in rows:
        mean, mx, worst_s, used = symmetric_residual(g, a.lam, a.horizon, o)
        # `states` is the denominator the mean was taken over -- the frame's own, not 272.
        # AN EMPTY DENOMINATOR IS A FAILURE, NOT A ZERO: a residual of 0.0000 over 0 states is
        # the most reassuring row in this report and it would mean the frame priced nothing.
        if used == 0:
            failed.append("invariant row measured over 0 states")
            print("  %-72s %10s %10s %7d   <- FAIL: nothing to measure"
                  % (label, "n/a", "n/a", used))
            continue
        print("  %-72s %10.4f %10.4f %7d" % (label, mean, mx, used))
        if o.initiative == "symmetric":
            # NAME every state that violates it at ANY horizon
            for h in range(1, a.horizon + 1):
                sh = solve(g, a.lam, h, o)
                for s in sh.model.live:
                    d = abs(sh.pwin[s] - sh.ul[flip(s)])
                    if d > 1e-9:
                        sym_named.append((s, h, d))
    if sym_named:
        print("  CONTENT VIOLATIONS (fully symmetric control, tolerance 1e-9):")
        for s, h, d in sym_named[:40]:
            print("      %-30s m=%-3d |delta| = %.3e" % (s, h, d))
        print("      ... %d total" % len(sym_named))
    elif not m.live:
        # "no violations found" over an empty state set is "never looked".  Say which.
        print("  NO STATE IN FRAME %s CARRIES A HAND - the residual claim below is VACUOUS"
              % a.frame)
    else:
        print("  fully-symmetric residual is EXACTLY 0 at every horizon m in 1..%d, all %d "
              "states this frame prices" % (a.horizon, len(m.live)))
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
    print("  %-6s %12s %12s %10s %9s %9s"
          % ("lam", "V(mount/top)", "V(sc/top)", "gap", "rk mnt", "rk sc"))
    for lam in (1, 2, 3, 5, 8, 20):
        sl = solve(g, float(lam), a.horizon, base_opts)
        rm, pop = _rank(sl, "mount/top")
        rs, _p = _rank(sl, "side-control/top")
        print("  %-6d %+12.4f %+12.4f %+10.4f %5s/%-3d %5s/%-3d"
              % (lam, sl.v["mount/top"], sl.v["side-control/top"],
                 sl.v["mount/top"] - sl.v["side-control/top"],
                 "-" if rm is None else rm, pop, "-" if rs is None else rs, pop))
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

    if a.verify and verify(g, base_opts, a.lam, a.horizon):
        # A vacuous audit must not exit 0: it printed FAIL and returned, which is the same
        # "found no problems" / "never looked" collision one layer down (CLAUDE.md 6.6).
        failed.append("verify() had no priced state to audit")
    if a.mutants:
        mutants(g, a.lam, a.horizon)

    for h in a.hand:
        print_hand(sol, h)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
