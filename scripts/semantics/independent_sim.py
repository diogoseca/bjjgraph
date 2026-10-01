#!/usr/bin/env python3
"""
INDEPENDENT VERIFICATION OF THE KERNEL (doc §1.2): a Monte Carlo and an exact solve written from the
RULES, reading graph.json directly, then compared with scripts/semantics/_kernel.py.

    python3 -B scripts/semantics/independent_sim.py                # full run, ~6 min -> the artifact
    python3 -B scripts/semantics/independent_sim.py --json <out>   # same, written elsewhere
    python3 -B scripts/semantics/independent_sim.py --selfcheck    # toys only: no graph, no kernel

Writes tests/artifacts/semantics/independent_sim.json (sorted keys, rounded, deterministic, < 200 kB).
Exit 0 only when the kernel survives: under the chained-landing reading it encodes, every state of
the independent exact solve matches it to 1e-12 and no Monte Carlo comparison reaches |z| >= 4.

Ported by gs-2 (item S5) from the gs-lead refutation lane (indsim.py, exact.py, compare.py,
state_test.py, run_all.sh). The simulator is the lead's, draw for draw: the same tables, the same
uniform stream, so seed 20260924 and 300,000 rolls reproduce the lead's counts exactly.

INDEPENDENCE IS THE POINT, AND IT IS GATED. The simulator (Tables, simulate) and the exact solve
(Exact) import nothing from scripts/: they read graph.json with `json` and implement the game from
the rules below. Only the comparison step, `kernel_view`, imports `_kernel`. At import this module
(1) parses its own source and refuses any import that is not the standard library or numpy, except
`_kernel` inside `kernel_view`; and (2) refuses to load if its imports pulled in any module that
lives under scripts/. A violation raises ImportError naming the line; nothing runs.

THE RULES (as written in solve_edge_values.py's docstring and the refutation brief; implemented here
from the text, not from that code)
  * state = (the role-node I stand on, whose turn it is), always in MY frame.
  * MY turn at r = <hub>/<role>: my hand is r's authored transitions[], filtered —
      attempt cell attemptProbabilityByRuleset[frame] null -> dropped;  <= 0 -> dropped;
      no /attacker node -> dropped;  ROLE: tech.fromRole == role (never relaxed);
      no rate in this frame (successRateByRuleset[frame] null) -> dropped;
      ORIGIN: tech.fromPositionId == hub, or the position edge carries dealHere (the listing-level
      dealing rule), relaxed to the role-filtered set ONLY when it would empty the hand.
    A card is drawn with probability proportional to its attempt cell.
  * THEIR turn while I stand at r: they stand at flip(r) and draw from flip(r)'s hand.
  * a card succeeds with p = successRate/100 (the folded scalar on the /attacker node); the branch
    is the cells labelled `success` (success) or `failure`/`counter` (miss); a cell is drawn in the
    branch proportional to its authored probability.
  * a cell's `to`: game-over -> the performer finishes (the finisher is the cell's technique);
    a role-node -> the performer lands there; anything else is a HUB TARGET, which chains into that
    technique's /attacker outcomes, performed by the cell's actor on `success`, by the actor's
    opponent otherwise.
  * INITIATIVE (only for a landing on a role-node): my success keeps my turn, my miss passes it;
    shipped: the opponent NEVER keeps it; symmetric: the opponent keeps it on success.
  * an empty hand ends the roll as a draw. One STEP = one card played; `visits` also counts the
    terminal empty-hand visit, which is what a fundamental-matrix row sum counts.
  Start: standing-position/top or /bottom with probability 1/2 each, me first.

THE CHAINED-LANDING READINGS. The rule text does not say whose turn follows a landing reached
THROUGH a chained hub cell. Three readings are built, and the run records which one the kernel
encodes and by how much the others miss (exact, per state, and by per-state Monte Carlo):
  outer      the OUTER card's branch decides (the literal "my success keeps my turn")
  inner      the innermost PERFORMER's own result decides (subject to the shipped rule)
  actorkeep  the actor keeps only if it performed AND the innermost cell is a success; any other
             chained landing passes the turn to the actor's opponent
For every non-chained cell the three are identical.
"""
from __future__ import annotations

import sys

_PRE_IMPORT = set(sys.modules)      # the independence gate compares against this

import argparse  # noqa: E402
import ast  # noqa: E402
import bisect  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import math  # noqa: E402
import time  # noqa: E402
from collections import Counter, defaultdict  # noqa: E402
from pathlib import Path  # noqa: E402

import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
GRAPH = REPO / "graph.json"
OUTPUT = REPO / "tests/artifacts/semantics/independent_sim.json"
COMMAND = "python3 -B scripts/semantics/independent_sim.py"
SEED = 20260924
ROLLS = 300_000
CONFIGS = ("nogi/shipped", "nogi/symmetric", "gi/shipped", "gi/symmetric")
READINGS = ("outer", "inner", "actorkeep")
REPLICATE_SEEDS = (1, 2, 3, 4)
START_NODES = ("standing-position/top", "standing-position/bottom")
ME, THEM = 0, 1
Z_REFUTE = 4.0                      # |z| >= 4 anywhere refutes the kernel
EXACT_TOL = 1e-12                   # the kernel's reading must match the exact solve this closely
ALLOWED_THIRD_PARTY = {"numpy"}
KERNEL_SCOPE = {"kernel_view": {"_kernel"}}      # the ONLY function allowed a repo import, and which


# --------------------------------------------------------------------------- #
# the independence gate (runs at import)
# --------------------------------------------------------------------------- #
def import_violations(source):
    """Every import in `source` that is not stdlib/numpy, except KERNEL_SCOPE's names inside its
    function. Returns [(line, name, where)]; [] means independent."""
    tree = ast.parse(source)
    scoped = {}
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and fn.name in KERNEL_SCOPE:
            for n in ast.walk(fn):
                if isinstance(n, (ast.Import, ast.ImportFrom)):
                    scoped[id(n)] = fn.name
    bad = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            names = [a.name for a in n.names]
        elif isinstance(n, ast.ImportFrom):
            if n.level:
                bad.append((n.lineno, "." * n.level + (n.module or ""), "relative import"))
                continue
            names = [n.module]
        else:
            continue
        for name in names:
            top = name.split(".")[0]
            where = scoped.get(id(n))
            if where is not None and top in KERNEL_SCOPE[where]:
                continue
            if top in sys.stdlib_module_names or top in ALLOWED_THIRD_PARTY or top == "__future__":
                continue
            bad.append((n.lineno, name, f"inside {where}()" if where else "module scope"))
    return bad


def _assert_independent():
    bad = import_violations(Path(__file__).read_text(encoding="utf-8"))
    if bad:
        raise ImportError(f"independent_sim: imports break independence: {bad}")
    scripts = (REPO / "scripts").resolve()
    pulled = sorted(m for m in set(sys.modules) - _PRE_IMPORT
                    if getattr(sys.modules[m], "__file__", None)
                    and Path(sys.modules[m].__file__).resolve().is_relative_to(scripts))
    if pulled:
        raise ImportError(f"independent_sim: its imports loaded repo modules {pulled}")


_assert_independent()


def is_role_key(k):
    return k.endswith("/top") or k.endswith("/bottom")


def flip(k):
    if k.endswith("/top"):
        return k[:-4] + "/bottom"
    if k.endswith("/bottom"):
        return k[:-7] + "/top"
    raise ValueError("flip of a non-role key %r" % k)


def load(path=GRAPH):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- #
# the rule tables (independent)
# --------------------------------------------------------------------------- #
class Cell:
    """One authored outcome cell. kind: 'G' game-over, 'R' role-node, 'C' chained hub."""
    __slots__ = ("kind", "to", "result", "prob")

    def __init__(self, kind, to, result, prob):
        self.kind, self.to, self.result, self.prob = kind, to, result, prob


class Dist:
    """A discrete distribution over items with cumulative weights for bisect sampling."""
    __slots__ = ("items", "cum", "tot")

    def __init__(self, pairs):
        self.items = [x for w, x in pairs]
        c, acc = [], 0.0
        for w, _x in pairs:
            acc += w
            c.append(acc)
        self.cum, self.tot = c, acc

    def draw(self, u):
        i = bisect.bisect_right(self.cum, u * self.tot)
        return self.items[i if i < len(self.items) else len(self.items) - 1]


class Card:
    __slots__ = ("name", "hub", "p", "succ", "miss", "cat")

    def __init__(self, name, hub, cat, p, succ, miss):
        self.name, self.hub, self.cat, self.p, self.succ, self.miss = name, hub, cat, p, succ, miss


def _cells_of(g, tech, stats):
    out = []
    for o in tech.get("outcomes") or []:
        to, res, pr = o["to"], o["result"], float(o["probability"])
        if to == "game-over":
            k = "G"
            if res != "success":
                stats["gameover_cell_not_success_label"] += 1
        elif is_role_key(to):
            if to not in g["positions"]:
                stats["role_cell_unknown_node"] += 1
            k = "R"
        else:
            k = "C"
            if (to + "/attacker") not in g["submissions"] and (to + "/attacker") not in g["transitions"]:
                stats["chain_cell_unresolvable"] += 1
        out.append(Cell(k, to, res, pr))
    return out


class Tables:
    """Every hand and every card for one frame, built from the rules, nothing imported."""

    def __init__(self, g, frame):
        self.g, self.frame = g, frame
        P = g["positions"]
        self.role_nodes = sorted(k for k, n in P.items() if n.get("role") in ("top", "bottom"))
        self.stats = Counter()
        self.hands = {}
        self.chain = {}             # chained technique slug -> (hub, cell dist, tech)
        for r in self.role_nodes:
            node = P[r]
            hub, role = node["hub"], node["role"]
            if r != hub + "/" + role:
                self.stats["role_key_mismatch"] += 1
            cands = []
            for t in node.get("transitions") or []:
                m = t.get("attemptProbabilityByRuleset")
                if not isinstance(m, dict) or frame not in m:
                    self.stats["attempt_key_missing"] += 1
                    continue
                att = m[frame]
                if att is None:
                    self.stats["attempt_null_dropped"] += 1
                    continue
                att = float(att)
                if att <= 0:
                    self.stats["attempt_le0_dropped"] += 1
                    continue
                cat = "submissions" if t.get("isSubmission") else "transitions"
                tech = g[cat].get(t["target"] + "/attacker")
                if tech is None:
                    self.stats["no_attacker_node"] += 1
                    continue
                if tech.get("fromRole") != role:
                    self.stats["role_filtered"] += 1
                    continue
                rb = tech.get("successRateByRuleset")
                if isinstance(rb, dict) and frame in rb and rb[frame] is None:
                    self.stats["rate_null_dropped"] += 1
                    continue
                sr = tech.get("successRate")
                if sr is None:
                    self.stats["scalar_rate_missing_used_frame_cell"] += 1
                    sr = rb[frame]
                cands.append((att, t, cat, tech, float(sr) / 100.0))
            # ORIGIN, or a listing flagged `dealHere` (the listing-level dealing rule, v1.211.0) -
            # written from the position edge's own field, not imported from build_hand.
            same = [c for c in cands if c[3].get("fromPositionId") == hub or c[1].get("dealHere") is True]
            if same:
                use = same
            else:
                use = cands
                if cands:
                    self.stats["origin_relaxed_states"] += 1
            hand = []
            for att, t, cat, tech, p in use:
                if not (0.0 <= p <= 1.0):
                    self.stats["p_out_of_range"] += 1
                cells = _cells_of(g, tech, self.stats)
                succ = [(c.prob, c) for c in cells if c.result == "success"]
                miss = [(c.prob, c) for c in cells if c.result != "success"]
                if (p > 0 and sum(w for w, _ in succ) <= 0) or (p < 1 and sum(w for w, _ in miss) <= 0):
                    self.stats["empty_branch_with_mass"] += 1
                card = Card(t["technique"], tech["hub"], cat, p, Dist(succ), Dist(miss))
                hand.append((att, card))
                for c in cells:
                    if c.kind == "C":
                        self._register_chain(c.to)
            self.hands[r] = Dist(hand) if hand else None
            self.stats["cards_dealt"] += len(hand)
            if not hand:
                self.stats["empty_hands"] += 1

    def _register_chain(self, slug):
        if slug in self.chain:
            return
        g = self.g
        tech = g["submissions"].get(slug + "/attacker") or g["transitions"].get(slug + "/attacker")
        if tech is None:
            self.chain[slug] = None
            return
        cells = _cells_of(g, tech, self.stats)
        self.chain[slug] = (tech["hub"], Dist([(c.prob, c) for c in cells]), tech)
        rb = tech.get("successRateByRuleset")
        if isinstance(rb, dict) and rb.get(self.frame, 0) is None:
            self.stats["chain_target_null_rate_in_frame"] += 1
        for c in cells:
            if c.kind == "C":
                self.stats["chain_depth_ge2_cells"] += 1
                self._register_chain(c.to)

    def fin_type(self, hub):
        n = self.g["submissions"].get(hub + "/attacker") or self.g["transitions"].get(hub + "/attacker")
        return (n or {}).get("type")


# --------------------------------------------------------------------------- #
# the game: Monte Carlo (independent)
# --------------------------------------------------------------------------- #
class Uniforms:
    def __init__(self, rng, block=1 << 20):
        self.rng, self.block = rng, block
        self.buf = rng.random(block)
        self.i = 0
        self.used = 0

    def __call__(self):
        if self.i >= self.block:
            self.buf = self.rng.random(self.block)
            self.i = 0
        u = self.buf[self.i]
        self.i += 1
        self.used += 1
        return float(u)


def next_turn(actor, outer_ok, performer, inner_ok, chained, initiative, chain_rule):
    """Whose turn after a landing on a role-node."""
    sym = initiative == "symmetric"

    def rule(who, ok):
        if who == ME:
            return ME if ok else THEM
        if sym and ok:              # the opponent's card
            return THEM
        return ME

    if not chained or chain_rule == "outer":
        return rule(actor, outer_ok)
    if chain_rule == "inner":
        return rule(performer, inner_ok)
    if chain_rule == "actorkeep":
        if performer == actor and inner_ok:
            return rule(actor, True)
        return THEM if actor == ME else ME
    raise ValueError(chain_rule)


def simulate(T, n_rolls, initiative, chain_rule, seed=SEED, max_steps=100000, track_visits=True,
             start=None, start_nodes=START_NODES):
    """start=None: start_nodes 50/50, me first. start=(role_node, ME|THEM): a fixed state."""
    rng = np.random.default_rng(seed)
    U = Uniforms(rng)
    hands = T.hands
    chain = T.chain
    res_counts = Counter()
    steps_sum, steps_sq, visits_sum, visits_sq = Counter(), Counter(), Counter(), Counter()
    fin = Counter()              # (finisher hub, performer) -> count
    chained_landings = chain_events = truncated = 0
    visited = set()
    for _ in range(n_rolls):
        if start is None:
            r = start_nodes[0] if U() < 0.5 else start_nodes[1]
            turn = ME
        else:
            r, turn = start
        steps = 0
        while True:
            if track_visits:
                visited.add(r)
            actor_node = r if turn == ME else flip(r)
            hand = hands.get(actor_node)
            if hand is None:
                outcome, visits = "D", steps + 1
                break
            card = hand.draw(U())
            steps += 1
            ok = U() < card.p
            cell = (card.succ if ok else card.miss).draw(U())
            actor = performer = turn
            fin_hub = card.hub
            chained = False
            while cell.kind == "C":
                chained = True
                chain_events += 1
                if cell.result != "success":
                    performer = THEM if performer == ME else ME
                entry = chain[cell.to]
                fin_hub = entry[0]
                cell = entry[1].draw(U())
            if cell.kind == "G":
                outcome, visits = ("W" if performer == ME else "L"), steps
                fin[(fin_hub, "me" if performer == ME else "them")] += 1
                break
            land = cell.to if performer == ME else flip(cell.to)
            if chained:
                chained_landings += 1
            turn = next_turn(actor, ok, performer, cell.result == "success", chained, initiative, chain_rule)
            r = land
            if steps >= max_steps:
                outcome, visits = "T", steps
                truncated += 1
                break
        res_counts[outcome] += 1
        steps_sum[outcome] += steps
        steps_sq[outcome] += steps * steps
        visits_sum[outcome] += visits
        visits_sq[outcome] += visits * visits
    return {"n": n_rolls, "counts": dict(res_counts), "steps_sum": dict(steps_sum), "steps_sq": dict(steps_sq),
            "visits_sum": dict(visits_sum), "visits_sq": dict(visits_sq),
            "finishers": {"%s|%s" % k: v for k, v in fin.items()},
            "chain_events": chain_events, "chained_landings": chained_landings,
            "truncated": truncated, "uniforms_used": U.used, "visited_role_nodes": sorted(visited)}


def merge_runs(runs):
    """Pool Monte Carlo runs (replicates) into one: counts and sums add."""
    out = {"n": 0, "counts": Counter(), "visits_sum": Counter(), "visits_sq": Counter(), "finishers": Counter()}
    for r in runs:
        out["n"] += r["n"]
        for k in ("counts", "visits_sum", "visits_sq", "finishers"):
            out[k].update(r[k])
    return {k: (dict(v) if isinstance(v, Counter) else v) for k, v in out.items()}


# --------------------------------------------------------------------------- #
# the exact solve of the same tables (independent)
# --------------------------------------------------------------------------- #
def _weights(dist):
    out, prev = [], 0.0
    for c in dist.cum:
        out.append((c - prev) / dist.tot)
        prev = c
    return out


class Exact:
    """The absorbing chain of the SAME independent tables, solved exactly. The MC samples a chained
    cell sequentially; this multiplies the normalised probabilities out."""

    def __init__(self, T, initiative, chain_rule, start_nodes=START_NODES):
        self.T = T
        rn = T.role_nodes
        self.role_nodes, self.n, self.start_nodes = rn, len(rn), start_nodes
        n = self.n
        self.idx = {s: i for i, s in enumerate(rn)}
        N = 2 * n
        Q = np.zeros((N, N))
        R = np.zeros((N, 3))                 # W, L, D
        fin_cols, fin_idx, fin_entries = [], {}, []

        def fcol(hub, perf):
            if (hub, perf) not in fin_idx:
                fin_idx[(hub, perf)] = len(fin_cols)
                fin_cols.append((hub, perf))
            return fin_idx[(hub, perf)]

        def expand(t, cell, mass, actor, outer_ok, performer, fin_hub, chained):
            if cell.kind == "C":
                perf2 = performer if cell.result == "success" else (THEM if performer == ME else ME)
                hub, dist, _tech = T.chain[cell.to]
                for w, c2 in zip(_weights(dist), dist.items):
                    expand(t, c2, mass * w, actor, outer_ok, perf2, hub, True)
                return
            if cell.kind == "G":
                col = 0 if performer == ME else 1
                R[t, col] += mass
                fin_entries.append((t, fcol(fin_hub, "me" if performer == ME else "them"), mass))
                return
            land = cell.to if performer == ME else flip(cell.to)
            turn = next_turn(actor, outer_ok, performer, cell.result == "success", chained, initiative, chain_rule)
            Q[t, self.idx[land] + (n if turn == THEM else 0)] += mass

        for t in range(N):
            r = rn[t % n]
            actor = ME if t < n else THEM
            hand = T.hands.get(r if actor == ME else flip(r))
            if hand is None:
                R[t, 2] += 1.0
                continue
            for pi, card in zip(_weights(hand), hand.items):
                for ok, bp, dist in ((True, card.p, card.succ), (False, 1.0 - card.p, card.miss)):
                    if bp <= 0:
                        continue
                    if dist.tot <= 0:
                        raise ValueError("empty branch with mass at %s" % card.name)
                    for w, cell in zip(_weights(dist), dist.items):
                        expand(t, cell, pi * bp * w, actor, ok, actor, card.hub, False)
        self.Q, self.R, self.fin_cols = Q, R, fin_cols
        Rf = np.zeros((N, len(fin_cols)))
        for t, c, m in fin_entries:
            Rf[t, c] += m
        A = np.eye(N) - Q
        self.rowsum_err = float(np.abs(Q.sum(1) + R.sum(1) - 1).max())
        self.B = np.linalg.solve(A, R)
        self.ET = np.linalg.solve(A, np.ones(N))
        self.Bf = np.linalg.solve(A, Rf)
        self.ETW = np.linalg.solve(A, self.B[:, 0])
        self.ETL = np.linalg.solve(A, self.B[:, 1])

    def start(self):
        x = np.zeros(2 * self.n)
        for s in self.start_nodes:
            x[self.idx[s]] = 1.0 / len(self.start_nodes)
        return x


# --------------------------------------------------------------------------- #
# comparison (the only place the kernel is read)
# --------------------------------------------------------------------------- #
def kernel_view(frame, ini, graph):
    """Read-only handles on the kernel: absorption, visits, conditional times, the finish law."""
    sys.path.insert(0, str(HERE))
    from _kernel import load_kernel
    K = load_kernel(frame=frame, initiative=ini, graph=graph)
    s0 = K.start("standing", "me")
    B, res = K.absorption()
    lu = K.fundamental()
    ET = lu.solve(np.ones(K.n_t))
    ETW = lu.solve(np.ascontiguousarray(B[:, 0]))
    ETL = lu.solve(np.ascontiguousarray(B[:, 1]))
    Bf, fres = K.exit_law()
    meta = K.fin_meta()
    by_type, by_tech = defaultdict(float), {}
    x = s0 @ Bf
    for c, m in enumerate(meta):
        by_type[(m["type"], m["performer"])] += x[c]
        by_tech[(m["technique"], m["performer"])] = x[c]
    return {"p": s0 @ B, "ET": float(s0 @ ET), "ETW": float(s0 @ ETW), "ETL": float(s0 @ ETL),
            "by_type": dict(by_type), "by_tech": by_tech, "B": B, "ETvec": ET, "Bf": Bf, "meta": meta,
            "labels": [(s, "M") for s in K.role_nodes] + [(s, "T") for s in K.role_nodes],
            "index": K.index, "n_r": K.n_r, "reachable": sorted(K.reachable), "res": res, "fres": fres}


def z_prop(k, n, p):
    if p <= 0 or p >= 1:
        return 0.0 if (k == 0 and p <= 0) or (k == n and p >= 1) else float("inf")
    return (k / n - p) / math.sqrt(p * (1 - p) / n)


def z_mean(s1, s2, n, mu):
    m = s1 / n
    var = s2 / n - m * m
    se = math.sqrt(var / n) if var > 0 else 0.0
    return ((m - mu) / se if se > 0 else (0.0 if m == mu else float("inf"))), m, se


def mc_rows(mc, ref, fin_type):
    """Every z-score of one MC run against one reference: P(W/L/D), E[visits], E[T*1{W}],
    E[T*1{L}] (+ two informational ratios with no z), the finish law by (type, performer), and a
    chi-square over finishing (technique, performer) as a z."""
    n, c = mc["n"], mc["counts"]
    rows = []
    for i, k in enumerate(("W", "L", "D")):
        rows.append(("P(%s)" % k, c.get(k, 0) / n, float(ref["p"][i]), z_prop(c.get(k, 0), n, float(ref["p"][i]))))
    z, m, _se = z_mean(sum(mc["visits_sum"].values()), sum(mc["visits_sq"].values()), n, ref["ET"])
    rows.append(("E[visits] (=cards + empty-hand visit)", m, ref["ET"], z))
    for k, key in (("W", "ETW"), ("L", "ETL")):
        z, m, _se = z_mean(mc["visits_sum"].get(k, 0), mc["visits_sq"].get(k, 0), n, ref[key])
        rows.append(("E[T*1{%s}]" % k, m, ref[key], z))
        if c.get(k, 0):
            rows.append(("E[T | %s] (info, ratio)" % k, mc["visits_sum"][k] / c[k],
                         ref[key] / float(ref["p"][0 if k == "W" else 1]), None))
    mc_type, mc_tech = defaultdict(int), defaultdict(int)
    for key, v in mc["finishers"].items():
        hub, perf = key.split("|")
        mc_type[(fin_type(hub), perf)] += v
        mc_tech[(hub, perf)] += v
    for key in sorted(set(mc_type) | set(ref["by_type"]), key=lambda x: (str(x[0]), x[1])):
        p = ref["by_type"].get(key, 0.0)
        rows.append(("finish type=%s by %s" % key, mc_type.get(key, 0) / n, p, z_prop(mc_type.get(key, 0), n, p)))
    exp, obs, pool_e, pool_o = [], [], 0.0, 0.0
    for key in set(mc_tech) | set(ref["by_tech"]):
        e, o = ref["by_tech"].get(key, 0.0) * n, mc_tech.get(key, 0)
        if e >= 5:
            exp.append(e)
            obs.append(o)
        else:
            pool_e += e
            pool_o += o
    exp.append(pool_e + float(ref["p"][2]) * n + 1e-300)
    obs.append(pool_o + c.get("D", 0))
    exp, obs = np.array(exp), np.array(obs)
    chi2 = float(((obs - exp) ** 2 / exp).sum())
    dof = len(exp) - 1
    rows.append(("chi2 over finishing (technique, performer), as z", chi2, float(dof), (chi2 - dof) / math.sqrt(2 * dof)))
    return rows


def exact_vs_kernel(E, kv):
    """Per-state comparison over every transient state, joined by LABEL (never by position)."""
    perm = np.array([E.idx[s] + (0 if side == "M" else E.n) for s, side in kv["labels"]])
    d = np.abs(E.B[perm] - kv["B"]).max(axis=1)
    colmap = {(m["technique"], m["performer"]): c for c, m in enumerate(kv["meta"])}
    dF = 0.0
    for c, k in enumerate(E.fin_cols):
        if k in colmap:
            dF = max(dF, float(np.abs(E.Bf[perm, c] - kv["Bf"][:, colmap[k]]).max()))
    return {"states": int(len(perm)), "max_abs_dB": float(d.max()),
            "max_abs_dET": float(np.abs(E.ET[perm] - kv["ETvec"]).max()), "max_abs_dB_fin": dF,
            "finisher_columns_exact_only": sorted("%s|%s" % k for k in E.fin_cols if k not in colmap),
            "finisher_columns_kernel_only": sorted("%s|%s" % k for k in colmap if k not in set(E.fin_cols)),
            "worst_state": "%s@%s" % kv["labels"][int(d.argmax())], "states_over_1e-12": int((d > 1e-12).sum()),
            "rowsum_err": E.rowsum_err}


def replication_verdict(z_original, z_replicates, z_pooled):
    """A deviation REPLICATES only if the pooled replicates point the same way at |z| >= 3; it
    'replicates away' when they do not (the original was a tail draw)."""
    same_sign = z_original * z_pooled > 0
    return "REPLICATES" if same_sign and abs(z_pooled) >= 3.0 else "REPLICATES AWAY"


def _g(x, sig=6):
    """Round for the committed artifact (deterministic; -0.0 folds to 0.0)."""
    if x is None or isinstance(x, (int, str)):
        return x
    if not math.isfinite(x):
        return str(x)
    return float(f"{x:.{sig}g}") + 0.0


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# --------------------------------------------------------------------------- #
# the full run
# --------------------------------------------------------------------------- #
def run(rolls=ROLLS, seed=SEED, out=OUTPUT):
    t_all = time.time()
    fails = []
    g = load()
    tables = {f: Tables(g, f) for f in sorted({c.split("/")[0] for c in CONFIGS})}
    for f, T in tables.items():
        if not T.role_nodes or T.stats["cards_dealt"] == 0:
            fails.append(f"{f}: the tables are empty ({len(T.role_nodes)} role-nodes, {T.stats['cards_dealt']} cards): never looked")
    art = {"schema": "gs-2/independent_sim/v1 (item S5)", "recompute": COMMAND,
           "graph_sha256": _sha(GRAPH),
           "source_sha256": {p: _sha(REPO / p) for p in ("scripts/semantics/independent_sim.py",
                                                          "scripts/semantics/_kernel.py", "scripts/solve_edge_values.py")},
           "seed": seed, "rolls": rolls, "configurations": list(CONFIGS), "readings": list(READINGS),
           "z_refutes_at": Z_REFUTE, "exact_tolerance": EXACT_TOL,
           "independence": {"module_imports": sorted({n for _l, n in _module_imports()}),
                            "kernel_import_scope": {k: sorted(v) for k, v in KERNEL_SCOPE.items()},
                            "repo_modules_loaded_by_the_simulator": 0},
           "tables": {f: {"role_nodes": len(T.role_nodes), "states": 2 * len(T.role_nodes),
                          **{k: v for k, v in sorted(T.stats.items())}} for f, T in tables.items()}}
    configs, reading_miss, kviews, mcs = {}, {r: {} for r in READINGS}, {}, {}
    for cfg in CONFIGS:
        frame, ini = cfg.split("/")
        T = tables[frame]
        kv = kviews[cfg] = kernel_view(frame, ini, g)
        ex = {r: exact_vs_kernel(Exact(T, ini, r), kv) for r in READINGS}
        for r in READINGS:
            t0 = time.time()
            mc = simulate(T, rolls, ini, r, seed=seed)
            mcs[(cfg, r)] = mc
            rows = mc_rows(mc, kv, T.fin_type)
            fz = [row for row in rows if row[3] is not None]
            worst = max(fz, key=lambda row: abs(row[3]))
            reading_miss[r][cfg] = {**{k: _g(v) for k, v in ex[r].items() if k.startswith(("max_abs", "states"))},
                                    "worst_state": ex[r]["worst_state"],
                                    "mc_from_standing_max_abs_z": _g(abs(worst[3])),
                                    "mc_from_standing_max_abs_z_at": worst[0]}
            print(f"  {cfg:15s} chain={r:9s} MC W {mc['counts'].get('W', 0) / rolls:.5f}  max|z| vs kernel "
                  f"{abs(worst[3]):.3f} ({worst[0]})  exact-vs-kernel max|dB| {ex[r]['max_abs_dB']:.2e}  "
                  f"({time.time() - t0:.1f}s)", flush=True)
            if r != "actorkeep":
                continue
            vis = set(mc["visited_role_nodes"])
            kr = set(kv["reachable"])
            configs[cfg] = {
                "rolls": rolls, "seed": seed, "reading": r,
                "mc": {"P_W": _g(mc["counts"].get("W", 0) / rolls), "P_L": _g(mc["counts"].get("L", 0) / rolls),
                       "P_D": _g(mc["counts"].get("D", 0) / rolls), "counts": mc["counts"],
                       "E_visits": _g(sum(mc["visits_sum"].values()) / rolls), "truncated": mc["truncated"],
                       "chain_events": mc["chain_events"], "chained_landings": mc["chained_landings"],
                       "uniforms_used": mc["uniforms_used"]},
                "kernel": {"P_W": _g(float(kv["p"][0])), "P_L": _g(float(kv["p"][1])), "P_D": _g(float(kv["p"][2])),
                           "E_visits": _g(kv["ET"]), "absorption_residual": _g(kv["res"])},
                "comparisons": len(rows), "comparisons_finite_z": len(fz),
                "max_abs_z": _g(abs(worst[3])), "max_abs_z_at": worst[0], "max_z_signed": _g(worst[3]),
                "rows": [[row[0], _g(row[1]), _g(row[2]), _g(row[3])] for row in rows],
                "exact_vs_kernel": {k: (_g(v) if isinstance(v, float) else v) for k, v in ex[r].items()},
                "reach": {"mc_visited": len(vis), "kernel_reachable": len(kr),
                          "mc_visited_not_kernel_reachable": sorted(vis - kr),
                          "kernel_reachable_never_visited": sorted(kr - vis)}}
            if len(fz) < 20:
                fails.append(f"{cfg}: only {len(fz)} finite-z comparisons (floor 20)")
            if abs(worst[3]) >= Z_REFUTE:
                fails.append(f"{cfg}: |z| {abs(worst[3]):.2f} >= {Z_REFUTE} at {worst[0]}: the kernel is refuted")
            if ex[r]["max_abs_dB"] > EXACT_TOL or ex[r]["max_abs_dET"] > 1e-9:
                fails.append(f"{cfg}: the kernel's reading misses the exact solve (dB {ex[r]['max_abs_dB']:.2e})")
            if vis - kr:
                fails.append(f"{cfg}: the MC stood on {len(vis - kr)} role-nodes the kernel calls unreachable")
    art["configs"] = configs
    agree = sorted(r for r in READINGS if all(reading_miss[r][c]["max_abs_dB"] <= EXACT_TOL for c in CONFIGS))
    art["chained_landing_readings"] = {
        "kernel_encodes": agree, "by_reading": reading_miss,
        "note": ("The exact solve of each reading is compared with the kernel on every state. From standing "
                 "the Monte Carlo cannot tell the readings apart (the chained landings are rare), so the "
                 "per-state test below starts the Monte Carlo AT the state where each other reading misses most.")}
    if agree != ["actorkeep"]:
        fails.append(f"the readings that match the kernel are {agree}, expected ['actorkeep']")
    # per-state MC where the other readings miss most: derived from the exact comparison, not listed
    cases = sorted({(cfg, reading_miss[r][cfg]["worst_state"]) for r in READINGS if r not in agree for cfg in CONFIGS})
    state_test = []
    for cfg, st in cases:
        frame, ini = cfg.split("/")
        node, side = st.rsplit("@", 1)
        kv = kviews[cfg]
        t = kv["index"][node] + (0 if side == "M" else kv["n_r"])
        pk = float(kv["B"][t, 0])
        row = {"config": cfg, "state": st, "kernel_P_W": _g(pk), "by_reading": {}}
        for r in READINGS:
            mc = simulate(tables[frame], rolls, ini, r, seed=seed, track_visits=False,
                          start=(node, ME if side == "M" else THEM))
            w = mc["counts"].get("W", 0)
            row["by_reading"][r] = {"P_W": _g(w / rolls), "z": _g(z_prop(w, rolls, pk)),
                                    "chained_landings": mc["chained_landings"]}
        print(f"  state test {cfg} {st}: kernel P(W) {pk:.5f}  "
              + "  ".join(f"{r} z {row['by_reading'][r]['z']:+.2f}" for r in READINGS), flush=True)
        state_test.append(row)
        if abs(row["by_reading"]["actorkeep"]["z"]) >= Z_REFUTE:
            fails.append(f"state test {cfg} {st}: the kernel's own reading is off by z {row['by_reading']['actorkeep']['z']}")
    art["state_test"] = state_test
    # replicates of the largest deviations (the two configurations with the largest max |z|)
    top = sorted(CONFIGS, key=lambda c: -configs[c]["max_abs_z"])[:2]
    reps = []
    for cfg in top:
        frame, ini = cfg.split("/")
        q = configs[cfg]["max_abs_z_at"]
        runs = [simulate(tables[frame], rolls, ini, "actorkeep", seed=s) for s in REPLICATE_SEEDS]
        kv = kviews[cfg]
        zs = {str(s): _g(next(rw[3] for rw in mc_rows(r_, kv, tables[frame].fin_type) if rw[0] == q))
              for s, r_ in zip(REPLICATE_SEEDS, runs)}
        zp = next(rw[3] for rw in mc_rows(merge_runs(runs), kv, tables[frame].fin_type) if rw[0] == q)
        v = replication_verdict(configs[cfg]["max_z_signed"], list(zs.values()), zp)
        reps.append({"config": cfg, "quantity": q, "z_original": configs[cfg]["max_z_signed"],
                     "replicate_seeds": list(REPLICATE_SEEDS), "z_by_seed": zs,
                     "z_pooled_replicates": _g(zp), "pooled_rolls": rolls * len(REPLICATE_SEEDS), "verdict": v})
        print(f"  replicate {cfg} {q}: original z {configs[cfg]['max_z_signed']:+.3f}; seeds {zs}; pooled {zp:+.3f} -> {v}",
              flush=True)
        if v == "REPLICATES":
            fails.append(f"{cfg} {q}: the deviation replicates (pooled z {zp:+.2f})")
    art["replication"] = reps
    art["summary"] = {
        "configurations": len(CONFIGS), "rolls_per_configuration": rolls,
        "comparisons_finite_z_per_configuration": sorted({configs[c]["comparisons_finite_z"] for c in CONFIGS}),
        "max_abs_z": max(configs[c]["max_abs_z"] for c in CONFIGS),
        "max_abs_z_where": max(((configs[c]["max_abs_z"], f"{c}: {configs[c]['max_abs_z_at']}") for c in CONFIGS))[1],
        "exact_vs_kernel_states": sorted({configs[c]["exact_vs_kernel"]["states"] for c in CONFIGS}),
        "exact_vs_kernel_max_abs_dB": max(configs[c]["exact_vs_kernel"]["max_abs_dB"] for c in CONFIGS),
        "exact_vs_kernel_max_abs_dET": max(configs[c]["exact_vs_kernel"]["max_abs_dET"] for c in CONFIGS),
        "largest_deviations_replicate": [r["verdict"] for r in reps],
        "verdict": "FAIL" if fails else "PASS"}
    art["failures"] = fails
    text = json.dumps(art, sort_keys=True, indent=1, allow_nan=False) + "\n"
    if len(text.encode()) >= 200_000:
        fails.append(f"artifact is {len(text.encode())} bytes (cap 200 kB)")
    else:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text, encoding="utf-8")
    s = art["summary"]
    print(f"coverage: {len(CONFIGS)} configurations x {rolls} rolls x {len(READINGS)} readings; "
          f"{s['comparisons_finite_z_per_configuration']} finite-z comparisons per configuration; "
          f"{len(state_test)} per-state tests; {len(reps)} replicated deviations; {len(text.encode())} bytes -> {out}")
    print(f"max |z| {s['max_abs_z']} ({s['max_abs_z_where']}); exact vs kernel on {s['exact_vs_kernel_states']} states: "
          f"max|dB| {s['exact_vs_kernel_max_abs_dB']:.2e}, max|dE[T]| {s['exact_vs_kernel_max_abs_dET']:.2e}; "
          f"replication {s['largest_deviations_replicate']}; {time.time() - t_all:.0f}s")
    for f in fails:
        print("FAIL", f)
    print(("PASS" if not fails else "FAIL") + f" independent_sim: {len(fails)} failures")
    return 0 if not fails else 1


def _module_imports():
    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    out = []
    for n in tree.body:
        if isinstance(n, ast.Import):
            out += [(n.lineno, a.name.split(".")[0]) for a in n.names]
        elif isinstance(n, ast.ImportFrom) and n.module != "__future__":
            out.append((n.lineno, n.module.split(".")[0]))
    return out


# --------------------------------------------------------------------------- #
# selfcheck: toys with known answers (no graph.json, no kernel)
# --------------------------------------------------------------------------- #
def _toy_graph(chained=False):
    """a/top deals submission x (p = 1/2: success -> game-over; miss -> a/top); a/bottom deals y the
    same way. From a/top, me first: P(W) = 2/3 and E[steps] = 2 under either initiative rule.
    chained=True: x's miss cell instead chains into hub z, whose one cell (success) lands on a/top —
    a chained landing where the three readings disagree."""
    sub = lambda hub, role, miss_to: {"hub": hub, "fromRole": role, "fromPositionId": "a", "successRate": 50,
                                      "successRateByRuleset": {"nogi": 50, "gi": 50}, "type": "Toy",
                                      "outcomes": [{"to": "game-over", "result": "success", "probability": 100},
                                                   {"to": miss_to, "result": "failure", "probability": 100}]}
    pos = lambda role, target: {"hub": "a", "role": role, "transitions": [
        {"target": target, "technique": target.upper(), "isSubmission": True,
         "attemptProbabilityByRuleset": {"nogi": 100, "gi": 100}}]}
    g = {"positions": {"a/top": pos("top", "x"), "a/bottom": pos("bottom", "y")},
         "submissions": {"x/attacker": sub("x", "top", "z" if chained else "a/top"),
                         "y/attacker": sub("y", "bottom", "a/bottom")},
         "transitions": {}}
    if chained:
        g["transitions"]["z/attacker"] = {"hub": "z", "fromRole": "bottom", "fromPositionId": "a", "successRate": 100,
                                          "outcomes": [{"to": "a/top", "result": "success", "probability": 100}]}
    return g


def selfcheck():
    results = []

    def ok(name, cond, detail=""):
        results.append(bool(cond))
        print(f"  [{'OK' if cond else 'FAIL'}] {name}" + (f"  {detail}" if detail else ""), flush=True)

    # 1. the independence gate
    toys = {"import numpy as np\nimport json\n": [],
            "from _kernel import load_kernel\n": ["_kernel"],
            "def kernel_view():\n    from _kernel import load_kernel\n": [],
            "def kernel_view():\n    import solve_edge_values\n": ["solve_edge_values"],
            "def simulate():\n    from _kernel import Kernel\n": ["_kernel"],
            "from . import sibling\n": ["."]}
    got = {src: [b[1].split(".")[0] if b[1] != "." else "." for b in import_violations(src)] for src in toys}
    ok("independence gate: _kernel only inside kernel_view; any other repo module or relative import is refused",
       all(got[s] == toys[s] for s in toys), str({s.splitlines()[-1].strip(): got[s] for s in toys}))
    ok("independence gate: this file passes it, and loaded no repo module", not import_violations(
        Path(__file__).read_text(encoding="utf-8")) and not [m for m in sys.modules if m in ("_kernel", "solve_edge_values")])
    # 2. exact and MC on the toy with a closed form
    g = _toy_graph()
    T = Tables(g, "nogi")
    ok("toy tables: 2 role-nodes, one card each, no filter fired", T.role_nodes == ["a/bottom", "a/top"]
       and T.stats["cards_dealt"] == 2 and T.stats["origin_relaxed_states"] == 0, str(dict(T.stats)))
    for ini in ("shipped", "symmetric"):
        E = Exact(T, ini, "actorkeep", start_nodes=("a/top",))
        s0 = E.start()
        ok(f"toy exact ({ini}): P(W) = 2/3, E[steps] = 2 from a/top, me first; rows sum to 1",
           abs(s0 @ E.B[:, 0] - 2 / 3) < 1e-12 and abs(s0 @ E.ET - 2) < 1e-12 and E.rowsum_err < 1e-12,
           f"{s0 @ E.B[:, 0]:.15f}, {s0 @ E.ET:.15f}")
    mc = simulate(T, 40_000, "shipped", "actorkeep", seed=7, start_nodes=("a/top", "a/top"))
    z = z_prop(mc["counts"].get("W", 0), mc["n"], 2 / 3)
    zt, m, _se = z_mean(sum(mc["visits_sum"].values()), sum(mc["visits_sq"].values()), mc["n"], 2.0)
    ok("toy MC agrees with the closed form (|z| < 4 on P(W) and on E[visits])", abs(z) < 4 and abs(zt) < 4,
       f"z(P(W)) {z:+.2f}, z(E) {zt:+.2f}")
    ok("toy MC is deterministic for a seed", simulate(T, 2_000, "shipped", "actorkeep", seed=3)["counts"]
       == simulate(T, 2_000, "shipped", "actorkeep", seed=3)["counts"])
    # 3. the chained-landing readings: a toy where they disagree, with the known answers
    gc = _toy_graph(chained=True)
    Tc = Tables(gc, "nogi")
    # my miss on x chains into z, performed by THEM (a miss flips the performer); z succeeds and
    # lands on a/top in THEIR frame, i.e. a/bottom in mine. outer: my miss -> THEIR turn; inner: the
    # performer (them) succeeded -> shipped gives the turn back to me; actorkeep: they, not I,
    # performed -> the turn passes to my opponent.
    want = {"outer": "T", "inner": "M", "actorkeep": "T"}
    lands = {}
    for r in READINGS:
        E = Exact(Tc, "shipped", r, start_nodes=("a/top",))
        row = E.Q[E.idx["a/top"]]
        j = int(np.argmax(row))
        lands[r] = (E.role_nodes[j % E.n], "M" if j < E.n else "T", _g(row[j]))
    ok("chained landing: outer -> their turn, inner -> mine (shipped), actorkeep -> theirs; all on a/bottom",
       all(lands[r][0] == "a/bottom" and lands[r][1] == want[r] and abs(lands[r][2] - 0.5) < 1e-12 for r in READINGS),
       str(lands))
    zs = {}
    for r in READINGS:                   # the MC's own chained path against the exact solve, per reading
        E = Exact(Tc, "shipped", r, start_nodes=("a/top",))
        mc = simulate(Tc, 40_000, "shipped", r, seed=11, start_nodes=("a/top", "a/top"))
        pw = float(E.start() @ E.B[:, 0])
        zv, _m, _se = z_mean(sum(mc["visits_sum"].values()), sum(mc["visits_sq"].values()), mc["n"],
                             float(E.start() @ E.ET))
        zs[r] = (_g(z_prop(mc["counts"].get("W", 0), mc["n"], pw), 3), _g(zv, 3), mc["chained_landings"])
    ok("chained toy: the MC agrees with the exact solve under every reading (|z| < 4), chained landings > 0",
       all(abs(a) < 4 and abs(b) < 4 and c > 0 for a, b, c in zs.values()), str(zs))
    ok("next_turn: every non-chained landing is identical under the three readings",
       all(len({next_turn(a, ok_, a, ok_, False, ini, r) for r in READINGS}) == 1
           for a in (ME, THEM) for ok_ in (True, False) for ini in ("shipped", "symmetric")))
    ok("next_turn: shipped never lets the opponent keep; symmetric keeps its success",
       next_turn(THEM, True, THEM, True, False, "shipped", "outer") == ME
       and next_turn(THEM, True, THEM, True, False, "symmetric", "outer") == THEM
       and next_turn(ME, False, ME, False, False, "shipped", "outer") == THEM)
    # 4. statistics and verdicts
    ok("z_prop / z_mean known values", abs(z_prop(60, 100, 0.5) - 2.0) < 1e-12
       and abs(z_mean(10.0, 110.0, 10, 0.0)[0] - 1.0) < 1e-12)       # mean 1, var 10, se 1
    ok("replication verdict: a same-sign pooled |z| >= 3 replicates; noise replicates away",
       replication_verdict(3.2, [0.5, -1.0, 0.2, 1.1], 0.4) == "REPLICATES AWAY"
       and replication_verdict(3.5, [3.1, 2.9, 3.4, 3.3], 6.4) == "REPLICATES"
       and replication_verdict(-3.2, [3.0, 3.1, 2.8, 3.3], 6.1) == "REPLICATES AWAY")
    pooled = merge_runs([{"n": 2, "counts": {"W": 1, "L": 1}, "visits_sum": {"W": 3}, "visits_sq": {"W": 9},
                          "finishers": {"x|me": 1}}] * 3)
    ok("replicates pool by adding counts and sums", pooled["n"] == 6 and pooled["counts"] == {"W": 3, "L": 3}
       and pooled["finishers"] == {"x|me": 3})
    ok("Dist draws by cumulative weight", Dist([(1, "a"), (3, "b")]).draw(0.24) == "a"
       and Dist([(1, "a"), (3, "b")]).draw(0.26) == "b" and Dist([(1, "a")]).draw(1.0) == "a")
    n_bad = results.count(False)
    print(f"  {len(results)} checks, {n_bad} failed (floor 12)")
    ok_all = n_bad == 0 and len(results) >= 12
    print(("PASS" if ok_all else "FAIL") + " independent_sim selfcheck")
    return 0 if ok_all else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selfcheck", action="store_true", help="toys with known answers; no graph, no kernel")
    ap.add_argument("--json", type=Path, default=OUTPUT, help="where the artifact goes (default: the committed path)")
    ap.add_argument("--rolls", type=int, default=ROLLS)
    ap.add_argument("--seed", type=int, default=SEED)
    a = ap.parse_args(argv)
    if a.selfcheck:
        return selfcheck()
    if (a.rolls, a.seed) != (ROLLS, SEED) and a.json.resolve() == OUTPUT.resolve():
        ap.error("a non-default --rolls/--seed must not overwrite the committed artifact: pass --json <elsewhere>")
    return run(a.rolls, a.seed, a.json)


if __name__ == "__main__":
    sys.exit(main())
