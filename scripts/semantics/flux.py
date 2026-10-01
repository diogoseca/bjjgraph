#!/usr/bin/env python3
"""
EDGES — how rolls are won in the CORPUS's game: reactive flux, choke points, passage, traffic,
the success-rate gradient, and the exact bridges to FLOW and EDGE (lane gs-4, item F2R).

Everything is computed on the shared kernel (`_kernel.load_kernel`), never on a hand-rolled chain,
and every card-level number is a sum over the kernel's CELLS with ONE weight per cell
(`_tpt.cell_weights`): s_c = g(src) v(dst) at H = infinity, or the ply-recursion weight under the
clock. That single formula is what makes the bridges exact rather than analogies:

  * FLOW (`scripts/solve_flow.py`) IS the instance  H = 11, payoff (1, -2, 0), start uniform over
    live role-nodes at my turn, direction = MY cards of deck k inside the clamp (0.05, 0.95), shipped
    initiative. `--selfcheck` reproduces solve_flow.adjoint's whole vector from the kernel's cells.
  * The committor gradient d P(I finish) / d p_t is the instance H = infinity, payoff (1, 0, 0),
    start = standing, direction = every card of technique t (either performer, or one of them).
  * A_inf(s, a) = q_after(s, a) - q(s) is the POLICY GRADIENT: moving a sliver of the hand at s
    toward card a changes P(I finish) at rate occupancy(s) * A_inf(s, a). Its pi-weighted sum is
    zero at every state because that direction is the zero direction — the EDGE trap, explained.

THE MIN-CUT THEOREM (proved in the lane file; checked here on every configuration). The reactive
network saturates every edge, so a cut is minimum iff no current crosses it backwards; hence every
strongly connected component of the net current lies wholly on one side. Measured: the winning
current's support is ONE strongly connected component holding every reachable state and both
standing seeds, so the only minimum cuts are the terminal layers, and with the auxiliary edges
protected the choke points of the corpus's game are EXACTLY its finishing moves. The interior
question "which places do won rolls go through" is therefore answered by PASSAGE probabilities
(`_tpt.avoid_probabilities`): P(a won roll ever visits hub X / ever lands technique t).

USAGE
    python3 -B scripts/semantics/flux.py --selfcheck     # synthetic proofs + real-kernel identities
    python3 -B scripts/semantics/flux.py                 # compute, print, write the artifact
    python3 -B scripts/semantics/flux.py --full [--scratch DIR]  # also dump full per-technique tables
                                                         #   (DIR default: $FLUX_SCRATCH, else <tmp>/flux-scratch)
    python3 -B scripts/semantics/flux.py --robust-seeds 100
    python3 -B scripts/semantics/flux.py --origin [--full]  # F3: the origin filter, listing by listing
                                                           #   -> tests/artifacts/semantics/flux_origin.json

F3 (the origin filter). A dropped LISTING (role-node, technique) is restored by dealing origin=False's
hand restricted to the filtered cards plus that card, renormalised; the exact effect on the exit law
from standing is one k x k solve (`_tpt.row_update`, gs-2 Proposition A1 at s0), the joint change is
attributed to listings with zero remainder (row identity O1: K1 row - K0 row = sum_k pi1(k)(c_k - old)),
and every listing is tested for the TELEPORT its outcome table implies when dealt away from its origin.

Writes tests/artifacts/semantics/flux.json (sorted keys, rounded, deterministic, < 1 MB).
Which game: the corpus's (both seats sample authored shares, no resistance, control positions kept).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile

# One BLAS thread: the work here is thousands of tiny k x k solves and 532-sized products, where a
# threaded BLAS spends its time spinning (measured: sys time > user time). Results are unaffected.
for _v in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import networkx as nx  # noqa: E402
import numpy as np  # noqa: E402
import scipy.sparse as sp  # noqa: E402
from scipy.sparse.linalg import splu  # noqa: E402
from scipy.stats import spearmanr  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
REPO = os.path.dirname(SCRIPTS)
sys.path.insert(0, HERE)
sys.path.insert(0, SCRIPTS)

import _tpt  # noqa: E402
from _kernel import IW, IL, ID, load_kernel  # noqa: E402
from solve_edge_values import listing_view  # noqa: E402

ART = os.path.join(REPO, "tests", "artifacts", "semantics", "flux.json")
# Where `--full` writes its large per-technique dumps. Never committed, never read back by the
# artifact: `--scratch DIR`, else $FLUX_SCRATCH, else a directory under the system temp dir, so a
# fresh clone runs without any machine-specific path.
SCRATCH_ENV = "FLUX_SCRATCH"


def default_scratch():
    return os.environ.get(SCRATCH_ENV) or os.path.join(tempfile.gettempdir(), "flux-scratch")


def graph_sha256():
    """sha256 (full hex) of the graph.json every kernel here loads (solve_edge_values.GRAPH_PATH),
    recorded in each real-kernel artifact so a stale artifact is detectable without re-running."""
    from solve_edge_values import GRAPH_PATH
    h = hashlib.sha256()
    with open(GRAPH_PATH, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def file_sha256(rel):
    """sha256 (full hex) of a repo file, keyed in artifacts by its repo-relative path."""
    h = hashlib.sha256()
    with open(os.path.join(REPO, rel), "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def miss_geography(table, teleports):
    """Where each dropped listing's MISS branch lands, over ALL listings of one configuration.

    Per listing (`_listing_row`): the technique's authored failure + counter outcome cells that land
    on a role-node (chained hub cells skipped); the share of that branch's authored % landing on the
    LISTING's hub (either seat) and on the canonical ORIGIN's hub (either seat). Counts are over every
    listing; the maxima name their listing, ties broken by (listing, technique)."""
    def side(field):
        vals = [(r[field], r["listing"], r["technique"]) for r in table if r[field] is not None]
        top = min(vals, key=lambda v: (-v[0], v[1], v[2]))
        return {"count_gt_0": sum(1 for v in vals if v[0] > 0), "count_ge_0.5": sum(1 for v in vals if v[0] >= 0.5),
                "max": top[0], "argmax": {"listing": top[1], "technique": top[2]},
                "n_at_max": sum(1 for v in vals if v[0] == top[0])}
    out = {"n_listings": len(table),
           "n_with_role_node_miss_branch": sum(1 for r in table if r["miss_to_origin_hub"] is not None),
           "at_listing_hub": side("miss_stays_at_listing_hub"), "at_origin_hub": side("miss_to_origin_hub"),
           "definition": "miss branch = the technique's authored failure + counter outcome cells landing on a "
                         "role-node (chained hub cells skipped); share = the part of that branch's authored % "
                         "landing on the hub; 'listing hub' = the listing's position (hub, either seat); "
                         "'origin hub' = the canonical fromPositionId position (hub, either seat)"}
    _tpt._require(out["n_with_role_node_miss_branch"] >= 1000, "miss geography: fewer than 1000 listings measured")
    _tpt._require(out["at_origin_hub"]["count_ge_0.5"] == teleports,
                  "miss geography disagrees with the teleport census (%d vs %d)" % (out["at_origin_hub"]["count_ge_0.5"], teleports))
    return out


def flow_cli_json(frame, tmpdir):
    """Run the FLOW CLI itself (`solve_flow.py --json`) into a temporary directory and return the
    file: the in-process adjoint is compared against what the CLI writes, on any machine."""
    path = os.path.join(tmpdir, "flow-%s.json" % frame)
    cmd = [sys.executable, "-B", os.path.join(SCRIPTS, "solve_flow.py"), "--frame", frame, "--json", path]
    r = subprocess.run(cmd, cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    _tpt._require(r.returncode == 0 and os.path.exists(path),
                  "solve_flow.py --json failed (exit %d): %s" % (r.returncode, r.stderr[-400:]))
    return path
RECOMPUTE = "python3 -B scripts/semantics/flux.py"
CLOCK = (9, 10, 11, 12)               # solve_edge_values.HORIZON_MIX (asserted equal at run time)
LAM = 2.0                              # EDGE's and FLOW's default lambda
CONFIGS = (                            # gs-shared.md §7 ruling 4: the headline and its three companions
    ("headline", "nogi", "symmetric", True),
    ("shipped", "nogi", "shipped", True),
    ("gi", "gi", "symmetric", True),
    ("origin_off", "nogi", "symmetric", False),
)
TRAFFIC_FLOOR = 0.02                   # expected plays per roll below which a W/L ratio is not ranked
JOIN_FLOOR = 0.95                      # the emitter's own join floor (regenerate_neural_data EDGE join)


def r6(x):
    return float("%.6g" % x) if np.isfinite(x) else None


def _hub_display(graph, hub):
    """The one name (graphName): a position's title minus the role suffix the visual layer bakes in."""
    for role in ("top", "bottom"):
        node = graph["positions"].get(hub + "/" + role)
        if node and node.get("name"):
            n = node["name"]
            for suf in (" Top", " Bottom"):
                if n.endswith(suf):
                    return n[: -len(suf)]
            return n
    return hub


def _tech_name(graph, key):
    cat, target = key.split("/", 1)
    node = graph[cat].get(target + "/attacker") or {}
    return node.get("name") or target


# --------------------------------------------------------------------------- #
# one context per (kernel, masses): the cells, the chain, and its solves
# --------------------------------------------------------------------------- #
class Ctx:
    def __init__(self, K, mass=None, wcw=None, p_act=None, start=None):
        self.K = K
        c = K.cells
        self.n, self.nr = K.n_t, K.n_r
        self.src = c["src"].astype(np.int64)
        self.dst = c["dst"].astype(np.int64)
        self.plies = c["plies"].astype(np.int64)
        self.branch = c["branch"].astype(np.int64)
        self.act = c["act"].astype(np.int64)
        self.fin = c["fin"].astype(np.int64)
        self.mass = np.array(c["mass"] if mass is None else mass, dtype=float)
        self.wcw = np.array(c["wcw"] if wcw is None else wcw, dtype=float)
        self.real = self.act >= 0
        acts = K.actions
        self.a_t = np.array([a["t"] for a in acts], dtype=np.int64)
        self.a_key = [a["cat"] + "/" + a["target"] for a in acts]
        self.a_perf = np.array([0 if a["performer"] == "me" else 1 for a in acts], dtype=np.int64)
        self.a_pi = np.array([a["pi"] for a in acts]) if mass is None else self._pi_from_cells()
        self.a_p = np.array([a["p"] for a in acts]) if p_act is None else np.asarray(p_act, dtype=float)
        self.keys = sorted(set(self.a_key))
        self.key_idx = {k: i for i, k in enumerate(self.keys)}
        self.a_kidx = np.array([self.key_idx[k] for k in self.a_key], dtype=np.int64)
        self.sign = np.where(self.branch == 0, 1.0, -1.0)
        tr = self.dst >= 0
        self.tr = tr
        n = self.n
        self.Q = sp.csr_matrix((self.mass[tr], (self.src[tr], self.dst[tr])), shape=(n, n))
        self.R = sp.csr_matrix((self.mass[~tr], (self.src[~tr], -1 - self.dst[~tr])), shape=(n, 3))
        fn = self.fin >= 0
        self.R_fin = sp.csr_matrix((self.mass[fn], (self.src[fn], self.fin[fn])), shape=(n, K.n_fin))
        rows = np.asarray(self.Q.sum(axis=1)).ravel() + np.asarray(self.R.sum(axis=1)).ravel()
        _tpt._require(np.abs(rows - 1).max() < 1e-12, "Ctx: rows must sum to one")
        self.s0 = K.start("standing", "me") if start is None else np.asarray(start, dtype=float)
        A = np.eye(n) - self.Q.toarray()
        self.N = np.linalg.inv(A)
        _tpt._require(np.abs(A @ self.N - np.eye(n)).max() < 1e-9, "Ctx: fundamental matrix residual")
        Rd = self.R.toarray()
        self.h = self.N @ Rd                    # h[:, W|L|D]
        self.g = self.N.T @ self.s0             # expected visits (steps) from s0
        self.p = self.s0 @ self.h               # P(W), P(L), P(D) from s0
        self.hub_t = K.groups_hub()             # transient index -> hub index

    def _pi_from_cells(self):
        """attempt share per action, recovered from the (perturbed) conditional branch weights:
        sum of a card's SUCCESS-branch wcw is pi(a) (the branch weights sum to 1), and so is its
        miss branch; a card with only one non-empty branch still carries its pi on that branch."""
        pi_s = np.zeros(len(self.K.actions))
        pi_m = np.zeros(len(self.K.actions))
        r = self.real
        np.add.at(pi_s, self.act[r & (self.branch == 0)], self.wcw[r & (self.branch == 0)])
        np.add.at(pi_m, self.act[r & (self.branch == 1)], self.wcw[r & (self.branch == 1)])
        return np.maximum(pi_s, pi_m)

    # value of a destination for a payoff vector over (W, L, D)
    def v_dst(self, payoff):
        u = np.asarray(payoff, dtype=float)
        v = self.h @ u
        safe = np.where(self.tr, self.dst, 0)
        return np.where(self.tr, v[safe], u[np.where(self.tr, 0, -1 - self.dst)])

    def weights(self, payoff, H=None, start=None):
        """_tpt.cell_weights on this context's cells (start defaults to s0)."""
        s = self.s0 if start is None else start
        if H is None:
            return {"weights": self.g_for(s)[self.src] * self.v_dst(payoff),
                    "J": float(s @ (self.h @ np.asarray(payoff, dtype=float))),
                    "occupancy": self.g_for(s)}
        return _tpt.cell_weights(self.n, 3, self.src, self.dst, self.plies, self.mass, s,
                                 np.asarray(payoff, dtype=float), H)

    def g_for(self, s):
        return self.g if s is self.s0 else self.N.T @ s

    def per_action(self, cell_values):
        out = np.zeros(len(self.a_t))
        np.add.at(out, self.act[self.real], cell_values[self.real])
        return out

    def by_key_perf(self, action_values):
        """(n_keys, 2) array: sum over actions of each (technique key, performer)."""
        out = np.zeros((len(self.keys), 2))
        np.add.at(out, (self.a_kidx, self.a_perf), action_values)
        return out


# --------------------------------------------------------------------------- #
# perturbation: the kernel's ONE perturbation, reproduced at cell level and asserted equal
# --------------------------------------------------------------------------- #
def perturbed_ctx(K, seed, eps_a=0.2, eps_r=0.2):
    """K.perturbed returns matrices; card-level work needs cells. This recomputes the cell masses
    with the kernel's own recipe and then ASSERTS they sum to K.perturbed's (Q, R, R_fin) exactly —
    a second implementation is legitimate only with set equality against the canonical one."""
    ref = K.perturbed(eps_a, eps_r, seed)
    rng = np.random.default_rng(seed)
    acts = K.actions
    att_keys = sorted({(a["role_node"], a["target"]) for a in acts})
    rate_keys = sorted({a["target"] for a in acts})
    za = dict(zip(att_keys, rng.standard_normal(len(att_keys))))
    zr = dict(zip(rate_keys, rng.standard_normal(len(rate_keys))))
    w = np.array([a["pi"] * np.exp(eps_a * za[(a["role_node"], a["target"])]) for a in acts])
    t_of = np.array([a["t"] for a in acts])
    tot = np.bincount(t_of, weights=w, minlength=K.n_t)
    pi_new = w / tot[t_of]
    p_old = np.array([a["p"] for a in acts])
    p0 = np.clip(p_old, 1e-9, 1 - 1e-9)
    lg = np.log(p0 / (1 - p0)) + eps_r * np.array([zr[a["target"]] for a in acts])
    p_new = np.where(p_old <= 0, 0.0, np.where(p_old >= 1, 1.0, 1.0 / (1.0 + np.exp(-lg))))
    c = K.cells
    real = c["act"] >= 0
    ai = c["act"][real]
    pi_old = np.array([a["pi"] for a in acts])
    cw = c["wcw"][real] / pi_old[ai]
    mass = np.array(c["mass"], dtype=float)
    wcw = np.array(c["wcw"], dtype=float)
    wcw[real] = pi_new[ai] * cw
    mass[real] = wcw[real] * np.where(c["branch"][real] == 0, p_new[ai], 1.0 - p_new[ai])
    ctx = Ctx(K, mass=mass, wcw=wcw, p_act=p_new)
    d = max(abs(ctx.Q - ref["Q"]).max(), abs(ctx.R - ref["R"]).max(), abs(ctx.R_fin - ref["R_fin"]).max())
    _tpt._require(d < 1e-14, "perturbed cells differ from K.perturbed by %.2e" % d)
    return ctx


# --------------------------------------------------------------------------- #
# 1. flux, the min-cut theorem, rivers and routes
# --------------------------------------------------------------------------- #
def cell_current(ctx, col):
    """forward gross current carried by each cell: g(src) * mass * (h_col(dst) | 1[exit==col])."""
    safe = np.where(ctx.tr, ctx.dst, 0)
    tail = np.where(ctx.tr, ctx.h[safe, col], (-1 - ctx.dst == col).astype(float))
    return ctx.g[ctx.src] * ctx.mass * tail


def scc_verdict(ctx, f):
    n = ctx.n
    G = nx.DiGraph()
    coo = f.net.tocoo()
    for i, j in zip(coo.row, coo.col):
        if i < n and j < n:
            G.add_edge(int(i), int(j))
    carrying = set(int(i) for i in np.flatnonzero(f.occupancy * f.committor > 0))
    sccs = sorted(nx.strongly_connected_components(G), key=lambda s: (-len(s), min(s)))
    big = sccs[0] if sccs else set()
    seeds = [int(i) for i in np.flatnonzero(ctx.s0)]
    holds = bool(sccs) and carrying <= big and all(s in big for s in seeds)
    return {"states_carrying_current": len(carrying), "sccs": len(sccs), "largest_scc": len(big),
            "seeds_in_largest": sum(1 for s in seeds if s in big), "seeds": len(seeds),
            "theorem_applies": holds}, holds


def finishing_layer(ctx, col, f):
    """the formal choke points: every state -> exit[col] edge with current, with its technique set."""
    K = ctx.K
    n = ctx.n
    p = ctx.p[col]
    edges = []
    inflow = np.asarray(f.gross[:n, n + col].toarray()).ravel()
    for i in np.flatnonzero(inflow > 0):
        rn, turn = K.labels[i]
        edges.append({"state": rn, "turn": "me" if turn == "M" else "them", "share": inflow[i] / p,
                      "hub": K.hub_of[i % ctx.nr]})
    edges.sort(key=lambda e: (-e["share"], e["state"], e["turn"]))
    perf = "me" if col == IW else "them"
    cols = [k for k, (_t, pf) in enumerate(K.fin_cols) if pf == perf]
    fin = ctx.g @ ctx.R_fin.toarray()
    techs = sorted(((fin[k] / p, K.fin_cols[k][0]) for k in cols if fin[k] > 0), key=lambda x: (-x[0], x[1]))
    _tpt._close(sum(x[0] for x in techs), 1.0, "finisher technique set carries the whole cut")
    hubs = {}
    for e in edges:
        hubs[e["hub"]] = hubs.get(e["hub"], 0.0) + e["share"]
    return edges, techs, sorted(hubs.items(), key=lambda x: (-x[1], x[0]))


def group_network(ctx, col, grp, G):
    """net current aggregated to a partition of the transient states (role-nodes or hubs), with
    source/sink augmentation. Aggregating a flow sums conservation, so the result is a valid flow
    network; within-group current (turn switches, stay-puts) cancels and is dropped."""
    cur = cell_current(ctx, col)
    a = grp[ctx.src]
    b = np.where(ctx.tr, grp[np.where(ctx.tr, ctx.dst, 0)], G + (-1 - ctx.dst))
    keep = (cur > 0) & (a != b)
    M = sp.csr_matrix((cur[keep], (a[keep], b[keep])), shape=(G + 3, G + 3))
    net = M - M.T
    net.data = np.maximum(net.data, 0.0)
    net.eliminate_zeros()
    inj = np.zeros(G + 3)
    np.add.at(inj, grp, ctx.s0 * ctx.h[:, col])
    src, snk = G + 3, G + 4
    coo = net.tocoo()
    ii = np.flatnonzero(inj > 0)
    rows = list(coo.row) + [src] * len(ii) + [G + col]
    cols = list(coo.col) + list(ii) + [snk]
    vals = list(coo.data) + list(inj[ii]) + [ctx.p[col]]
    Nw = sp.csr_matrix((vals, (rows, cols)), shape=(G + 5, G + 5))
    return Nw, src, snk, cur, a, b


def hop_technique(ctx, cur, a, b, ha, hb):
    """the technique carrying the largest share of the forward gross current from hub ha to hub hb."""
    sel = np.flatnonzero((a == ha) & (b == hb) & ctx.real & (cur > 0))
    if sel.size == 0:
        return None
    by = {}
    for c in sel:
        ai = ctx.act[c]
        k = (ctx.a_key[ai], "me" if ctx.a_perf[ai] == 0 else "them")
        by[k] = by.get(k, 0.0) + cur[c]
    tot = sum(by.values())
    (key, perf), v = max(by.items(), key=lambda x: (x[1], x[0]))
    return {"technique": key, "name": _tech_name(ctx.K.graph, key), "performer": perf, "share_of_hop": v / tot}


def role_display(graph, rn):
    hub, role = rn.rsplit("/", 1)
    return "%s (%s)" % (_hub_display(graph, hub), role)


def flux_block(ctx, col, routes=10, rivers=15):
    """flux into exit `col` from s0: the SCC verdict and the formal min cut (the theorem), the
    finishing layer and its technique set, and SEAT-AWARE routes and rivers on role-nodes (a hub
    aggregate can splice my seat's current onto the opponent's; a role-node path cannot)."""
    K = ctx.K
    g = K.graph
    f = _tpt.reactive_flux(ctx.Q, ctx.R, ctx.s0, [col], committor=ctx.h[:, col], occupancy=ctx.g)
    verdict, holds = scc_verdict(ctx, f)
    edges, techs, hubs = finishing_layer(ctx, col, f)
    n = ctx.n
    aux = [(f.source, int(i)) for i in np.flatnonzero(f.injection)] + [(n + col, f.sink)]
    cut = _tpt.min_cut(f.network, f.source, f.sink, protected_edges=aux)
    layer = sorted((i, n + col) for i in np.flatnonzero(np.asarray(f.gross[:n, n + col].toarray()).ravel() > 0))
    got = sorted((i, j) for i, j, _w in cut.edges)
    verdict["networkx_cut_edges"] = len(got)
    verdict["networkx_cut_is_finishing_layer"] = got == layer
    _tpt._require(not holds or got == layer, "min-cut theorem: SCC holds but the cut is not the finishing layer")
    grp = K.groups_role()
    G = K.n_r
    Nw, src, snk, cur, a, b = group_network(ctx, col, grp, G)
    names = list(K.role_nodes) + ["W", "L", "D"]
    disp = [role_display(g, x) for x in K.role_nodes] + ["I finish", "they finish", "draw"]
    pw = _tpt.dominant_pathways(Nw, src, snk, cover=0.99, kmax=routes)
    route_rows = []
    for path in pw.paths:
        nodes = path.nodes[1:-1]
        hops = [{"from": names[x], "to": names[y], "carried_by": hop_technique(ctx, cur, a, b, x, y)}
                for x, y in zip(nodes, nodes[1:])]
        route_rows.append({"share": path.share, "nodes": [names[x] for x in nodes],
                           "display": " > ".join(disp[x] for x in nodes), "hops": hops})
    coo = Nw.tocoo()
    riv = sorted(((v / ctx.p[col], int(i), int(j)) for i, j, v in zip(coo.row, coo.col, coo.data)
                  if i < G and j < G), key=lambda x: (-x[0], x[1], x[2]))[:rivers]
    river_rows = [{"from": names[i], "to": names[j], "net_share": sh,
                   "carried_by": hop_technique(ctx, cur, a, b, i, j)} for sh, i, j in riv]
    Hn = len(K.hubs)
    Nh, _s, _t, curh, ah, bh = group_network(ctx, col, ctx.hub_t, Hn)
    hn = list(K.hubs)
    cooh = Nh.tocoo()
    rivh = sorted(((v / ctx.p[col], int(i), int(j)) for i, j, v in zip(cooh.row, cooh.col, cooh.data)
                   if i < Hn and j < Hn), key=lambda x: (-x[0], x[1], x[2]))[:rivers]
    hub_rivers = [{"from": hn[i], "to": hn[j], "net_share": sh,
                   "carried_by": hop_technique(ctx, curh, ah, bh, i, j)} for sh, i, j in rivh]
    return {"hub_rivers": hub_rivers,"target": "W" if col == IW else "L", "probability": ctx.p[col], "scc": verdict,
            "cut_capacity_equals_probability": abs(cut.capacity - ctx.p[col]) < 1e-12,
            "finishing_edges": edges, "finishing_edge_count": len(edges), "finisher_set": techs,
            "finishing_hubs": hubs, "routes": route_rows, "routes_explained_share": pw.explained_share,
            "rivers": river_rows, "net_edges": int(f.net.nnz),
            "worst_conservation_residual": max(f.residuals.values())}


# --------------------------------------------------------------------------- #
# 2. passage: which places / moves do won rolls go THROUGH
# --------------------------------------------------------------------------- #
def group_passage(ctx, grp, G, cols=(IW, IL)):
    """P(the roll visits group X | it ends at exit col), for every group X of a partition.

    Visiting X = starting inside X, or traversing a cell that ENTERS X from outside; the start
    mass inside X is a visit at time 0, so it leaves the avoiding start. Groups without start mass
    share one Woodbury call; the (few) groups holding start mass get their own start vector."""
    n = ctx.n
    payoff = {IW: np.array([1.0, 0, 0]), IL: np.array([0, 1.0, 0])}
    kills = {}
    for x in range(G):
        inside = np.flatnonzero(grp == x)
        sel = ctx.tr & np.isin(np.where(ctx.tr, ctx.dst, -1), inside) & ~np.isin(ctx.src, inside)
        dq = sp.csr_matrix((ctx.mass[sel], (ctx.src[sel], ctx.dst[sel])), shape=(n, n))
        kills[x] = (dq if dq.nnz else None, inside)
    res = {}
    zero_r = sp.csr_matrix((n, 3))
    for col in cols:
        vals = np.zeros(G)
        batch = [x for x in range(G) if kills[x][0] is not None and ctx.s0[kills[x][1]].sum() == 0]
        if batch:
            J, Jk = _tpt_avoid_quiet(ctx.Q, ctx.R, ctx.s0, payoff[col], [(kills[x][0], zero_r) for x in batch], ctx.N)
            vals[batch] = J - Jk
        for x in range(G):
            if x in set(batch):
                continue
            dq, inside = kills[x]
            s = ctx.s0.copy()
            s[inside] = 0.0
            start_inside = float(ctx.s0[inside] @ ctx.h[inside, col])
            if s.sum() == 0:
                vals[x] = ctx.p[col]
            elif dq is None:
                vals[x] = start_inside
            else:
                _J, Jk = _tpt_avoid_quiet(ctx.Q, ctx.R, s, payoff[col], [(dq, zero_r)], ctx.N)
                vals[x] = ctx.p[col] - Jk[0]
        res["W" if col == IW else "L"] = vals / ctx.p[col]
    return res


def passage(ctx, cols=(IW, IL), hubs=True, techniques=True, roles=True):
    K = ctx.K
    n = ctx.n
    out = {}
    payoff = {IW: np.array([1.0, 0, 0]), IL: np.array([0, 1.0, 0])}
    if hubs:
        out["hubs"] = group_passage(ctx, ctx.hub_t, len(K.hubs), cols)
    if roles:
        out["roles"] = group_passage(ctx, K.groups_role(), K.n_r, cols)
    if techniques:
        res = {}
        groups = {}
        for c in np.flatnonzero(ctx.real & (ctx.branch == 0) & (ctx.mass > 0)):
            ai = ctx.act[c]
            groups.setdefault((int(ctx.a_kidx[ai]), int(ctx.a_perf[ai])), []).append(c)
        order = sorted(groups)
        kills = []
        for key in order:
            cc = np.array(groups[key])
            t = ctx.tr[cc]
            dq = sp.csr_matrix((ctx.mass[cc[t]], (ctx.src[cc[t]], ctx.dst[cc[t]])), shape=(n, n))
            dr = sp.csr_matrix((ctx.mass[cc[~t]], (ctx.src[cc[~t]], -1 - ctx.dst[cc[~t]])), shape=(n, 3))
            kills.append((dq, dr))
        for col in cols:
            J, Jk = _tpt_avoid_quiet(ctx.Q, ctx.R, ctx.s0, payoff[col], kills, ctx.N)
            arr = np.zeros((len(ctx.keys), 2))
            for (ki, pf), v in zip(order, J - Jk):
                arr[ki, pf] = v / ctx.p[col]
            res["W" if col == IW else "L"] = arr
        out["techniques"] = res
        out["technique_sets"] = len(order)
    return out


def _tpt_avoid_quiet(Q, R, s0, payoff, kills, N):
    import contextlib
    import io
    with contextlib.redirect_stdout(io.StringIO()):
        return _tpt.avoid_probabilities(Q, R, s0, payoff, kills, fundamental=N)


# --------------------------------------------------------------------------- #
# 3. traffic and 4. the success-rate gradient
# --------------------------------------------------------------------------- #
def traffic(ctx, clock=True):
    plays = ctx.g[ctx.a_t] * ctx.a_pi
    wW = ctx.weights([1.0, 0, 0])["weights"]
    wL = ctx.weights([0, 1.0, 0])["weights"]
    pW = ctx.per_action(ctx.mass * wW)
    pL = ctx.per_action(ctx.mass * wL)
    # identity: E[plays AND W] + E[plays AND L] + E[plays AND D] = E[plays]
    wD = ctx.weights([0, 0, 1.0])["weights"]
    pD = ctx.per_action(ctx.mass * wD)
    _tpt._close(pW + pL + pD, plays, "traffic: W + L + D plays equal all plays")
    out = {"plays": ctx.by_key_perf(plays), "plays_W": ctx.by_key_perf(pW) / ctx.p[IW],
           "plays_L": ctx.by_key_perf(pL) / ctx.p[IL] if ctx.p[IL] > 0 else None}
    if clock:
        acc = np.zeros((len(ctx.keys), 2))
        for H in CLOCK:
            occ = ctx.weights([1.0, 0, 0], H=H)["occupancy"]
            acc += ctx.by_key_perf(occ[ctx.a_t] * ctx.a_pi)
        out["plays_clocked"] = acc / len(CLOCK)
    return out


def gradient(ctx, payoff=(1.0, 0, 0), H=None, start=None):
    """d J / d p_t for every technique key, split by performer: (n_keys, 2)."""
    w = ctx.weights(list(payoff), H=H, start=start)["weights"]
    per_act = ctx.per_action(ctx.sign * ctx.wcw * w)
    return ctx.by_key_perf(per_act), per_act


def fd_gradient(ctx, key_idx, perf=None, eps=1e-6, col=IW):
    """central finite difference of P(col | s0) in p_t — an independent route (sparse re-solves).
    The step shrinks near a boundary rate so both sides stay probabilities; None at p in {0, 1}."""
    sel_a = ctx.a_kidx == key_idx
    if perf is not None:
        sel_a &= ctx.a_perf == perf
    pr = ctx.a_p[sel_a]
    eps = min(eps, 0.5 * float(np.min(np.minimum(pr, 1.0 - pr))))
    if eps <= 0:
        return None
    cells = ctx.real & np.isin(ctx.act, np.flatnonzero(sel_a))
    vals = []
    for sgn in (-1, 1):
        m = ctx.mass.copy()
        m[cells] += sgn * eps * ctx.sign[cells] * ctx.wcw[cells]
        _tpt._require(m.min() >= -1e-15, "FD step left the simplex")
        Q = sp.csr_matrix((m[ctx.tr], (ctx.src[ctx.tr], ctx.dst[ctx.tr])), shape=(ctx.n, ctx.n))
        R = sp.csr_matrix((m[~ctx.tr], (ctx.src[~ctx.tr], -1 - ctx.dst[~ctx.tr])), shape=(ctx.n, 3))
        lu = splu((sp.identity(ctx.n, format="csc") - Q.tocsc()))
        vals.append(float(ctx.s0 @ lu.solve(R[:, col].toarray().ravel())))
    return (vals[1] - vals[0]) / (2 * eps)


def advantage(ctx, col=IW):
    """A_inf(a) = q_after(a) - q(src) per action, in committor units, and the hand identity."""
    v = ctx.v_dst([1.0 if k == col else 0.0 for k in range(3)])
    qa = ctx.per_action(ctx.mass * v) / ctx.a_pi
    A = qa - ctx.h[ctx.a_t, col]
    hand = np.zeros(ctx.n)
    np.add.at(hand, ctx.a_t, ctx.a_pi * A)
    return A, qa, float(np.abs(hand).max())


# --------------------------------------------------------------------------- #
# FLOW bridge
# --------------------------------------------------------------------------- #
def flow_bridge(graph, frame, flow_json=None):
    import solve_flow as SF
    from solve_edge_values import HORIZON_MIX
    _tpt._require(tuple(HORIZON_MIX) == CLOCK, "CLOCK must equal solve_edge_values.HORIZON_MIX")
    K = load_kernel(frame, "shipped", "shipped", graph=graph)
    ctx = Ctx(K)
    fl = SF.Flow(graph, frame=frame)
    zero = [0.0] * len(fl.deck_keys)
    grad_fl, V0, _rho = SF.adjoint(fl, zero, LAM, SF.FLOW_H)
    grad_fl = np.array(grad_fl)
    d0 = np.zeros(ctx.n)
    live = [K.index[s] for s in K.role_nodes if s in K.live]
    d0[live] = 1.0 / len(live)
    _tpt._require(len(live) == len(fl.live_idx), "FLOW live set == kernel live set")
    wf = ctx.weights([1.0, -LAM, 0.0], H=SF.FLOW_H, start=d0)
    contrib = ctx.per_action(ctx.sign * ctx.wcw * wf["weights"])
    mine = np.zeros(len(fl.deck_keys))
    deck_of = {}
    clamp_out = 0
    for ai in range(len(ctx.a_t)):
        if ctx.a_perf[ai] != 0:
            continue
        rn = K.actions[ai]["role_node"]
        cat, target = ctx.a_key[ai].split("/", 1)
        tk = SF.tech_deck_key(graph, target, cat)
        deck_of[ctx.a_key[ai]] = tk
        if rn not in K.live:
            continue
        if not (SF.P_LO < ctx.a_p[ai] < SF.P_HI):
            clamp_out += 1
            continue
        k = fl.deck(tk)
        if k >= 0:
            mine[k] += contrib[ai]
        kp = fl.deck(SF.pos_deck_key(graph, rn))
        if kp >= 0:
            mine[kp] += contrib[ai]
    repro = float(np.abs(mine - grad_fl).max())
    _tpt._close(wf["J"], V0, "kernel-cell V0 == solve_flow V0", tol=1e-12)
    out = {"frame": frame, "decks": len(fl.deck_keys), "position_decks": fl.n_pos_decks,
           "technique_decks": len(fl.deck_keys) - fl.n_pos_decks, "V0": V0,
           "reproduction_max_abs_diff": repro, "reproduction_max_abs_grad": float(np.abs(grad_fl).max()),
           "my_cards_outside_clamp": clamp_out}
    if flow_json and os.path.exists(flow_json):
        d = json.load(open(flow_json))
        byk = dict(zip(d["decks"], d["grad"]))
        common = [k for k in fl.deck_keys if k in byk]
        out["cli_json"] = {"command": "python3 -B scripts/solve_flow.py --frame %s --json <temporary file>" % frame,
                           "decks_joined": len(common),
                           "max_abs_diff_vs_in_process": float(max(abs(byk[k] - grad_fl[fl.deck(k)]) for k in common))}
    # ---- the ladder, on technique decks joined by FLOW's own key
    tech_decks = fl.deck_keys[fl.n_pos_decks:]
    key_by_deck = {}
    for key, tk in deck_of.items():
        key_by_deck.setdefault(tk, []).append(key)
    joined = [d for d in tech_decks if d in key_by_deck]
    coverage = len(joined) / len(tech_decks)
    _tpt._require(coverage >= JOIN_FLOOR, "FLOW join coverage %.3f below floor %.2f" % (coverage, JOIN_FLOOR))
    orphan_keys = sorted(set(deck_of) - {k for d in joined for k in key_by_deck[d]})

    def by_deck(vec_by_key):
        return np.array([sum(vec_by_key[ctx.key_idx[k]] for k in key_by_deck[d]) for d in joined])

    rungs = []                                   # (name, vector, index of the rung it changes ONE thing in)
    r0 = np.array([grad_fl[fl.deck(d)] for d in joined])
    rungs.append(("R0 FLOW: H=11, lambda=2, start uniform live (my turn), my cards, clamp, live only, shipped", r0, None))
    # R1: every one of my cards (no clamp, no live filter)
    wf_all = ctx.per_action(ctx.sign * ctx.wcw * wf["weights"])
    rungs.append(("R1 = R0 without the clamp and the live filter",
                  by_deck(ctx.by_key_perf(wf_all)[:, 0]), 0))
    s0 = K.start("standing", "me")
    w2 = ctx.weights([1.0, -LAM, 0.0], H=SF.FLOW_H, start=s0)["weights"]
    rungs.append(("R2 = R1 started at standing (me first)",
                  by_deck(ctx.by_key_perf(ctx.per_action(ctx.sign * ctx.wcw * w2))[:, 0]), 1))
    w3 = ctx.weights([1.0, 0.0, 0.0], H=SF.FLOW_H, start=s0)["weights"]
    rungs.append(("R3 = R2 with lambda=0: P(I finish within 11 plies)",
                  by_deck(ctx.by_key_perf(ctx.per_action(ctx.sign * ctx.wcw * w3))[:, 0]), 2))
    G4, _ = gradient(ctx)
    rungs.append(("R4 = R3 at H=infinity: d P(I finish)/d p_t, my hands only", by_deck(G4[:, 0]), 3))
    rungs.append(("R5 = R4 with the opponent's hands too (both performers)", by_deck(G4.sum(axis=1)), 4))
    Ks = load_kernel(frame, "symmetric", "shipped", graph=graph)
    cs = Ctx(Ks)
    G6, _ = gradient(cs)
    ks = {k: i for i, k in enumerate(cs.keys)}

    def by_deck_s(vec):
        return np.array([sum(vec[ks[k]] for k in key_by_deck[d] if k in ks) for d in joined])

    rungs.append(("R6 = R4 under the symmetric initiative (HEADLINE, my hands only)", by_deck_s(G6[:, 0]), 4))
    rungs.append(("R7 = R6 with both performers", by_deck_s(G6.sum(axis=1)), 6))
    rows = []
    r40 = set(np.argsort(-r0, kind="stable")[:40])
    for name, vec, parent in rungs:
        pv = rungs[parent][1] if parent is not None else vec
        t40 = set(np.argsort(-vec, kind="stable")[:40])
        p40 = set(np.argsort(-pv, kind="stable")[:40])
        rows.append({"rung": name, "parent": None if parent is None else rungs[parent][0].split(" ")[0],
                     "spearman_vs_FLOW": spearmanr(vec, r0).correlation,
                     "spearman_vs_parent": spearmanr(vec, pv).correlation if parent is not None else 1.0,
                     "top40_overlap_with_FLOW": len(t40 & r40) / 40.0,
                     "top40_overlap_with_parent": len(t40 & p40) / 40.0,
                     "negatives": int((vec < -1e-12).sum())})
    out.update({"technique_decks_joined": len(joined), "join_coverage": coverage,
                "join_floor": JOIN_FLOOR, "kernel_techniques_without_flow_deck": len(orphan_keys),
                "ladder": rows})
    return out


# --------------------------------------------------------------------------- #
# EDGE bridge
# --------------------------------------------------------------------------- #
def edge_bridge(graph):
    from solve_edge_values import HORIZON_MIX, Opts, solve_mixture
    sol_e = solve_mixture(graph, LAM, HORIZON_MIX, Opts(frame="nogi"))
    sol_s = solve_mixture(graph, LAM, HORIZON_MIX, Opts(frame="nogi", policy="sample"))
    Kh = load_kernel("nogi", "shipped", "shipped", graph=graph)
    Ky = load_kernel("nogi", "symmetric", "shipped", graph=graph)
    ch, cy = Ctx(Kh), Ctx(Ky)
    Ah, _qa, idh = advantage(ch)
    Ay, _qy, idy = advantage(cy)
    scale = 100.0 * (1.0 + LAM)                        # committor units -> EDGE points at H=inf, no draws

    def mine_by_key(ctx, A):
        out = {}
        for ai in np.flatnonzero(ctx.a_perf == 0):
            s = ctx.K.actions[ai]["role_node"]
            k = (s, ctx.a_key[ai])
            if k in out:
                _tpt._require(abs(out[k][0] - A[ai]) < 1e-12, "duplicate card with different A_inf")
                out[k] = (out[k][0], out[k][1] + ctx.a_pi[ai])
            else:
                out[k] = (A[ai], ctx.a_pi[ai])
        return out

    mh, my = mine_by_key(ch, Ah), mine_by_key(cy, Ay)

    def rows_of(sol, s):
        out = {}
        base = sol.baseline[s]
        basew = sum(r["attempt"] * r["qw"] for r in sol.q[s])
        based = sum(r["attempt"] * (r["qw"] + r["ql"]) for r in sol.q[s])
        for r in sol.q[s]:
            k = (s, r["cat"] + "/" + r["target"])
            row = {"edge": r["edge"], "real": 100.0 * (r["q"] - base), "w_adv": 100.0 * (r["qw"] - basew),
                   "decisive_adv": 100.0 * (r["qw"] + r["ql"] - based),
                   "attempt": r["attempt"], "name": r["name"]}
            if k in out:
                _tpt._require(abs(out[k]["real"] - row["real"]) < 1e-9 and out[k]["edge"] == row["edge"],
                              "duplicate EDGE row with different values")
                out[k]["attempt"] += row["attempt"]
            else:
                out[k] = row
        return out

    cards, hands = [], {}
    edge_rows = 0
    for s in Kh.role_nodes:
        re_, rs_ = rows_of(sol_e, s), rows_of(sol_s, s)
        edge_rows += len(re_)
        for k, e in re_.items():
            if k not in mh:
                continue
            smp = rs_[k]
            a_h = mh[k][0]
            a_y = my[k][0] if k in my else None
            comp = {"rounding": e["edge"] - e["real"], "continuation": e["real"] - smp["real"],
                    "lambda": smp["real"] - (1.0 + LAM) * smp["w_adv"],
                    "clock": (1.0 + LAM) * smp["w_adv"] - scale * a_h}
            total = e["edge"] - scale * a_h
            _tpt._close(sum(comp.values()), total, "EDGE - scaled A_inf decomposes exactly")
            # PROPOSITION: lambda acts only through the clock's draws. V = W - lam L = (1+lam) W - lam (W+L),
            # so the lambda component is exactly -lam x the card's advantage in P(the roll is decided).
            _tpt._close(comp["lambda"], -LAM * smp["decisive_adv"], "lambda component == -lam * decisive advantage")
            comp["horizon"] = comp["lambda"] + comp["clock"]
            cards.append({"state": s, "technique": k[1], "name": _tech_name(graph, k[1]), "edge": e["edge"],
                          "edge_real": e["real"], "edge_sample_real": smp["real"], "A_inf": a_h,
                          "A_inf_points": scale * a_h, "A_inf_headline": a_y, "components": comp, "gap": total,
                          "attempt": e["attempt"]})
            hands.setdefault(s, []).append(cards[-1])
    coverage = len(cards) / edge_rows
    _tpt._require(coverage >= 0.99, "EDGE join coverage %.4f below 0.99" % coverage)

    def within(field_a, field_b):
        rhos, top_agree, top_tie_agree, n_hands = [], 0, 0, 0
        for s, cs in hands.items():
            if len(cs) < 3:
                continue
            a = np.array([c[field_a] for c in cs if c[field_a] is not None])
            b = np.array([c[field_b] for c in cs if c[field_a] is not None])
            if len(a) < 3 or np.ptp(a) == 0 or np.ptp(b) == 0:
                continue
            n_hands += 1
            rhos.append(spearmanr(a, b).correlation)
            ia = int(np.argmax(a))
            top_agree += ia == int(np.argmax(b))
            top_tie_agree += b[ia] == b.max()
        r = np.array(rhos)
        return {"hands": n_hands, "median_spearman": float(np.median(r)), "q25": float(np.quantile(r, .25)),
                "q75": float(np.quantile(r, .75)), "share_positive": float((r > 0).mean()),
                "share_at_least_0.5": float((r >= .5).mean()), "top_card_agreement": top_agree / n_hands,
                "top_card_in_tied_top_set": top_tie_agree / n_hands}

    stats = {
        "A_inf_shipped_vs_EDGE_integer": within("A_inf", "edge"),
        "A_inf_shipped_vs_EDGE_real": within("A_inf", "edge_real"),
        "A_inf_headline_vs_EDGE_integer": within("A_inf_headline", "edge"),
        "EDGE_real_vs_authored_continuation_clocked": within("edge_sample_real", "edge_real"),
        "A_inf_shipped_vs_authored_continuation_clocked": within("A_inf", "edge_sample_real"),
    }
    mean_abs = {k: float(np.mean([abs(c["components"][k]) for c in cards]))
                for k in ("rounding", "continuation", "lambda", "clock", "horizon")}

    def reason(c):
        comp = c["components"]
        return "continuation (argmax vs authored)" if abs(comp["continuation"]) >= abs(comp["horizon"]) \
            else "horizon (clock, with lambda acting through its draws)"
    for c in cards:
        c["reason"] = reason(c)
        c["sign_flip"] = bool(c["edge"] != 0 and np.sign(c["edge"]) != np.sign(c["A_inf"])
                              and abs(c["A_inf_points"]) >= 0.5)
    flips = [c for c in cards if c["sign_flip"]]
    top = sorted(cards, key=lambda c: (-abs(c["gap"]), c["state"], c["technique"]))[:20]
    top_flips = sorted(flips, key=lambda c: (-abs(c["gap"]), c["state"], c["technique"]))[:20]
    reasons_all = {}
    for c in cards:
        reasons_all[c["reason"]] = reasons_all.get(c["reason"], 0) + 1
    return {"cards_joined": len(cards), "edge_cards": edge_rows, "join_coverage": coverage,
            "hand_identity_max_abs": {"shipped": idh, "headline": idy},
            "pooled_spearman_A_inf_vs_EDGE": spearmanr([c["A_inf"] for c in cards], [c["edge"] for c in cards]).correlation,
            "within_hand": stats, "mean_abs_component_points": mean_abs, "dominant_reason_counts": reasons_all,
            "sign_flips_nontrivial": len(flips),
            "sign_flip_rule": "EDGE != 0, sign(EDGE) != sign(A_inf), |300 A_inf| >= 0.5 point",
            "biggest_20_by_gap": top, "biggest_20_sign_flips": top_flips}


# --------------------------------------------------------------------------- #
# per-config analysis
# --------------------------------------------------------------------------- #
def analyse(ctx, full=False, clock=True):
    K = ctx.K
    graph = K.graph
    res = {"probabilities": {"W": ctx.p[IW], "L": ctx.p[IL], "D": ctx.p[ID]},
           "coverage": {k: K.coverage[k] for k in ("role_nodes", "transient_states", "cards_dealt_mine",
                                                    "cells", "reachable_role_nodes_from_standing",
                                                    "origin_orphaned_techniques", "finisher_columns")}}
    res["flux"] = {"W": flux_block(ctx, IW), "L": flux_block(ctx, IL)}
    ps = passage(ctx)
    tr = traffic(ctx, clock=clock)
    G, _ = gradient(ctx)
    res["passage_hubs"] = {c: sorted(((float(v), K.hubs[i]) for i, v in enumerate(ps["hubs"][c]) if v > 0),
                                     key=lambda x: (-x[0], x[1])) for c in ("W", "L")}
    res["passage_roles"] = {c: sorted(((float(v), K.role_nodes[i]) for i, v in enumerate(ps["roles"][c]) if v > 0),
                                      key=lambda x: (-x[0], x[1])) for c in ("W", "L")}
    res["passage_technique_sets"] = ps["technique_sets"]
    tech = []
    for ki, key in enumerate(ctx.keys):
        for pf in (0, 1):
            if tr["plays"][ki, pf] <= 0:
                continue
            row = {"technique": key, "name": _tech_name(graph, key), "performer": ("me", "them")[pf],
                   "plays": tr["plays"][ki, pf], "plays_given_W": tr["plays_W"][ki, pf],
                   "plays_given_L": tr["plays_L"][ki, pf] if tr["plays_L"] is not None else None,
                   "landed_given_W": ps["techniques"]["W"][ki, pf], "landed_given_L": ps["techniques"]["L"][ki, pf],
                   "grad": G[ki, pf], "grad_both": G[ki].sum(),
                   "is_submission": key.startswith("submissions/")}
            if clock:
                row["plays_clocked"] = tr["plays_clocked"][ki, pf]
            row["leverage"] = row["grad"] / row["plays"]
            pl = row["plays_given_L"]
            row["W_over_L"] = (row["plays_given_W"] / pl) if pl else None
            tech.append(row)
    res["techniques"] = tech
    reached = {t["technique"] for t in tech}
    res["coverage"].update({"technique_keys_dealt": len(ctx.keys), "technique_keys_reached_from_standing": len(reached),
                            "technique_keys_dealt_but_unreached": len(ctx.keys) - len(reached)})
    _tpt._require(len(reached) >= 500, "fewer than 500 techniques carry traffic: the join or the start is wrong")
    orphans = sorted(K.origin_orphans)
    dealt = {k.split("/", 1)[1] for k in ctx.keys}
    _tpt._require(not (set(orphans) & dealt), "an origin orphan is dealt somewhere")
    res["origin_orphans"] = orphans
    # per-state drill leverage (the position-deck analogue): g(s) * sum_a pi (A - B), my cards
    _G, per_act = gradient(ctx)
    lev = np.zeros(ctx.n)
    np.add.at(lev, ctx.a_t[ctx.a_perf == 0], per_act[ctx.a_perf == 0])
    res["state_leverage"] = sorted(((float(lev[t]), K.labels[t][0]) for t in range(ctx.nr) if lev[t] != 0),
                                   key=lambda x: (-x[0], x[1]))
    return res


def top_lists(res, k=10):
    """the identities of the headline's top-k lists (for robustness and cross-config survival)."""
    tech = res["techniques"]
    return {
        "finishing_edges": [(e["state"], e["turn"]) for e in res["flux"]["W"]["finishing_edges"][:k]],
        "hub_passage_W": [h for _v, h in res["passage_hubs"]["W"] if h != "standing-position"][:k],
        "landed_given_W_me": [t["technique"] for t in sorted((t for t in tech if t["performer"] == "me"),
                                                            key=lambda t: (-t["landed_given_W"], t["technique"]))][:k],
        "grad_me": [t["technique"] for t in sorted((t for t in tech if t["performer"] == "me"),
                                                  key=lambda t: (-t["grad"], t["technique"]))][:k],
    }


def robustness(K, base_lists, seeds, k=10):
    counts = {name: {str(x): {"in_top": 0, "in_cut": 0} for x in items} for name, items in base_lists.items()}
    theorem_holds = 0
    nx_checked = 0
    for seed in seeds:
        ctx = perturbed_ctx(K, seed)
        f = _tpt_quiet(lambda: _tpt.reactive_flux(ctx.Q, ctx.R, ctx.s0, [IW], committor=ctx.h[:, IW],
                                                    occupancy=ctx.g))
        _v, holds = scc_verdict(ctx, f)
        theorem_holds += holds
        if seed < 3:                                        # networkx cross-check of the theorem
            n = ctx.n
            aux = [(f.source, int(i)) for i in np.flatnonzero(f.injection)] + [(n + IW, f.sink)]
            cut = _tpt_quiet(lambda: _tpt.min_cut(f.network, f.source, f.sink, protected_edges=aux))
            layer = sorted((i, n + IW) for i in np.flatnonzero(np.asarray(f.gross[:n, n + IW].toarray()).ravel() > 0))
            _tpt._require(sorted((i, j) for i, j, _w in cut.edges) == layer or not holds,
                          "perturbed seed %d: theorem holds but networkx cut differs" % seed)
            nx_checked += 1
        inflow = np.asarray(f.gross[:ctx.n, ctx.n + IW].toarray()).ravel()
        order = sorted((i for i in np.flatnonzero(inflow > 0)), key=lambda i: (-inflow[i], K.labels[i]))
        top_edges = [(K.labels[i][0], "me" if K.labels[i][1] == "M" else "them") for i in order[:k]]
        in_layer = {(K.labels[i][0], "me" if K.labels[i][1] == "M" else "them") for i in order}
        ps = passage(ctx, cols=(IW,), roles=False)
        hubsW = sorted(((float(v), K.hubs[i]) for i, v in enumerate(ps["hubs"]["W"]) if v > 0),
                       key=lambda x: (-x[0], x[1]))
        top_hubs = [h for _v, h in hubsW if h != "standing-position"][:k]
        landW = ps["techniques"]["W"][:, 0]
        top_land = [ctx.keys[i] for i in sorted(range(len(ctx.keys)), key=lambda i: (-landW[i], ctx.keys[i]))[:k]]
        G, _ = gradient(ctx)
        top_grad = [ctx.keys[i] for i in sorted(range(len(ctx.keys)), key=lambda i: (-G[i, 0], ctx.keys[i]))[:k]]
        now = {"finishing_edges": top_edges, "hub_passage_W": top_hubs, "landed_given_W_me": top_land,
               "grad_me": top_grad}
        for name, items in base_lists.items():
            for x in items:
                counts[name][str(x)]["in_top"] += x in now[name]
                if name == "finishing_edges":
                    counts[name][str(x)]["in_cut"] += int(holds and x in in_layer)
    n = len(seeds)
    out = {"seeds": [int(seeds[0]), int(seeds[-1])], "eps_attempt": 0.2, "eps_rate": 0.2,
           "theorem_holds_share": theorem_holds / n, "networkx_cross_checks": nx_checked, "lists": {}}
    for name, items in base_lists.items():
        out["lists"][name] = [{"item": str(x), "in_top%d_share" % k: counts[name][str(x)]["in_top"] / n,
                               **({"in_cut_share": counts[name][str(x)]["in_cut"] / n}
                                  if name == "finishing_edges" else {})} for x in items]
    return out


def _tpt_quiet(fn):
    import contextlib
    import io
    with contextlib.redirect_stdout(io.StringIO()):
        return fn()


# --------------------------------------------------------------------------- #
# payload cost of the show-candidates (measured on this worktree's wire)
# --------------------------------------------------------------------------- #
def payload_costs(res):
    import payload_probe as PP
    wire_path = PP.WIRE
    if not os.path.exists(wire_path):
        return {"skipped": "no wire at %s — run the neural emitter in this worktree first" % wire_path}
    wire = json.load(open(wire_path))
    lvl = PP.gz_level()
    base = PP.gz(wire, lvl)
    out = {"wire": os.path.relpath(wire_path, REPO), "gzip_level": lvl, "base_gzip_bytes": base}
    hubs_w = {h: int(round(100 * v)) for v, h in res["passage_hubs"]["W"]}
    hubs_l = {h: int(round(100 * v)) for v, h in res["passage_hubs"]["L"]}
    w1 = dict(wire)
    w1["semPass"] = {h: [hubs_w.get(h, 0), hubs_l.get(h, 0)] for h in sorted(set(hubs_w) | set(hubs_l))}
    out["hub_passage_W_L_int_pct"] = {"entries": len(w1["semPass"]), "delta_gzip_bytes": PP.gz(w1, lvl) - base}
    tech = [t for t in res["techniques"] if t["performer"] == "me"]
    w2 = dict(wire)
    w2["semLand"] = {t["technique"].split("/", 1)[1]: int(round(1000 * t["landed_given_W"])) for t in tech}
    out["technique_landing_given_W_int_permille"] = {"entries": len(w2["semLand"]),
                                                     "delta_gzip_bytes": PP.gz(w2, lvl) - base}
    top30 = sorted(tech, key=lambda t: (-t["landed_given_W"], t["technique"]))[:30]
    w4 = dict(wire)
    w4["semChoke"] = {t["technique"].split("/", 1)[1]: int(round(1000 * t["landed_given_W"])) for t in top30}
    out["technique_landing_top30_int_permille"] = {"entries": len(w4["semChoke"]), "delta_gzip_bytes": PP.gz(w4, lvl) - base}
    w3 = dict(wire)
    w3["semLev"] = {t["technique"].split("/", 1)[1]: int(round(1e4 * t["grad"])) for t in tech}
    out["technique_gradient_int_1e4"] = {"entries": len(w3["semLev"]), "delta_gzip_bytes": PP.gz(w3, lvl) - base}
    return out


# --------------------------------------------------------------------------- #
# Monte Carlo: an independent route for the real-kernel flux numbers
# --------------------------------------------------------------------------- #
def monte_carlo(ctx, res, trials=200000, seed=20260924):
    rng = np.random.default_rng(seed)
    n = ctx.n
    order = np.lexsort((np.arange(len(ctx.src)), ctx.src))
    s_sorted = ctx.src[order]
    starts = np.searchsorted(s_sorted, np.arange(n))
    ends = np.searchsorted(s_sorted, np.arange(n), side="right")
    cum = np.cumsum(ctx.mass[order])
    base = np.where(starts > 0, cum[np.maximum(starts - 1, 0)], 0.0)
    base[starts == 0] = 0.0
    tech = res["techniques"]
    pick_tr = sorted(tech, key=lambda t: (-t["plays"], t["technique"], t["performer"]))[:8]
    pick_ld = sorted((t for t in tech if t["performer"] == "me"), key=lambda t: (-t["landed_given_W"], t["technique"]))[:8]
    hubs = [h for _v, h in res["passage_hubs"]["W"] if h != "standing-position"][:8]
    hub_i = [ctx.K.hub_index[h] for h in hubs]
    kp = {(ctx.key_idx[t["technique"]], ("me", "them").index(t["performer"])): j for j, t in enumerate(pick_tr)}
    kl = {ctx.key_idx[t["technique"]]: j for j, t in enumerate(pick_ld)}
    plays = np.zeros((trials, len(pick_tr)), dtype=np.int32)
    landed = np.zeros((trials, len(pick_ld)), dtype=bool)
    visited = np.zeros((trials, len(hubs)), dtype=bool)
    state = rng.choice(n, size=trials, p=ctx.s0)
    for j, hi in enumerate(hub_i):
        visited[:, j] |= ctx.hub_t[state] == hi
    active = np.arange(trials)
    outcome = np.full(trials, -1)
    cell_kp = np.full(len(ctx.src), -1)
    cell_kl = np.full(len(ctx.src), -1)
    for c in np.flatnonzero(ctx.real):
        ai = ctx.act[c]
        key = (int(ctx.a_kidx[ai]), int(ctx.a_perf[ai]))
        if key in kp:
            cell_kp[c] = kp[key]
        if ctx.a_perf[ai] == 0 and ctx.branch[c] == 0 and int(ctx.a_kidx[ai]) in kl:
            cell_kl[c] = kl[int(ctx.a_kidx[ai])]
    # one step draws ONE cell, i.e. one card with its branch and landing, so one hit is one play
    steps = 0
    while active.size and steps < 10000:
        st = state[active]
        u = base[st] + rng.random(active.size) * (cum[ends[st] - 1] - base[st])
        pos = np.minimum(np.searchsorted(cum, u, side="right"), ends[st] - 1)
        c = order[pos]
        hit = cell_kp[c]
        m = hit >= 0
        np.add.at(plays, (active[m], hit[m]), 1)
        hl = cell_kl[c]
        m = hl >= 0
        landed[active[m], hl[m]] = True
        d = ctx.dst[c]
        done = d < 0
        outcome[active[done]] = -1 - d[done]
        keep = ~done
        state[active[keep]] = d[keep]
        for j, hi in enumerate(hub_i):
            visited[active[keep], j] |= ctx.hub_t[d[keep]] == hi
        active = active[keep]
        steps += 1
    _tpt._require(active.size == 0, "MC truncated live rolls")
    won = outcome == IW
    zs = []

    def z(est_samples, expect):
        mean = est_samples.mean()
        se = est_samples.std(ddof=1) / np.sqrt(trials)
        return float(abs(mean - expect) / se) if se > 0 else (0.0 if abs(mean - expect) < 1e-12 else np.inf)
    zs.append(("P(W)", z(won.astype(float), ctx.p[IW])))
    for j, t in enumerate(pick_tr):
        zs.append(("plays " + t["technique"] + "|" + t["performer"], z(plays[:, j].astype(float), t["plays"])))
        zs.append(("plays AND W " + t["technique"] + "|" + t["performer"],
                   z(plays[:, j] * won, t["plays_given_W"] * ctx.p[IW])))
    for j, t in enumerate(pick_ld):
        zs.append(("landed AND W " + t["technique"], z((landed[:, j] & won).astype(float), t["landed_given_W"] * ctx.p[IW])))
    pw = dict((h, v) for v, h in res["passage_hubs"]["W"])
    for j, h in enumerate(hubs):
        zs.append(("visit AND W " + h, z((visited[:, j] & won).astype(float), pw[h] * ctx.p[IW])))
    worst = max(zs, key=lambda x: x[1])
    return {"trials": trials, "seed": seed, "comparisons": len(zs), "max_abs_z": worst[1], "worst": worst[0],
            "limit": 4.5}


# --------------------------------------------------------------------------- #
# the real-kernel selfcheck
# --------------------------------------------------------------------------- #
def selfcheck():
    checks = []

    def ok(name, cond, detail):
        checks.append((name, bool(cond), detail))
        print("  [%s] %-66s %s" % ("OK" if cond else "FAIL", name, detail))

    print("== synthetic methods (_tpt.py)")
    rep = _tpt_quiet(_tpt.selfcheck)
    ok("_tpt synthetic proofs", rep["failed"] == 0 and rep["passed"] >= 10,
       "%d passed, %d failed" % (rep["passed"], rep["failed"]))
    print("== real-kernel identities")
    base = load_kernel("nogi", "symmetric", "shipped")
    graph = base.graph
    # FLOW reproduction, both frames
    for frame in ("nogi", "gi"):
        fb = flow_bridge(graph, frame)
        ok("[%s] kernel cells reproduce solve_flow.adjoint (all decks)" % frame,
           fb["reproduction_max_abs_diff"] < 1e-12 and fb["decks"] > 1000,
           "%d decks, max |diff| %.2e (max |grad| %.3f)" % (fb["decks"], fb["reproduction_max_abs_diff"],
                                                         fb["reproduction_max_abs_grad"]))
    for name, frame, ini, origin in CONFIGS:
        K = load_kernel(frame, ini, "shipped", graph=graph, origin=origin)
        ctx = Ctx(K)
        G, _ = gradient(ctx)
        both = G.sum(axis=1)
        order = np.argsort(-both, kind="stable")
        picks = [int(order[int(round(x))]) for x in np.linspace(0, len(order) - 1, 25)]
        # criterion: |fd - adjoint| <= 1e-6 |adjoint| + 1e-9. The absolute floor is the central
        # difference's own round-off at step 1e-6 (~eps_mach / 1e-6 ~ 1e-10, measured <= 1.8e-10);
        # a pure relative test fails on the near-zero middle of the ranking for that reason alone.
        worst_abs, worst_rel, done, skipped, bad = 0.0, 0.0, 0, 0, 0
        for ki in picks:
            fd = fd_gradient(ctx, ki)
            if fd is None:
                skipped += 1
                continue
            done += 1
            err = abs(fd - both[ki])
            worst_abs = max(worst_abs, err)
            if abs(both[ki]) >= 1e-4:
                worst_rel = max(worst_rel, err / abs(both[ki]))
            bad += err > 1e-6 * abs(both[ki]) + 1e-9
        ok("[%s] success-rate adjoint vs central FD, 25 techniques across the ranking" % name,
           bad == 0 and done >= 23, "%d checked (%d at a boundary rate), max abs err %.1e, max rel err "
           "(|grad| >= 1e-4) %.1e" % (done, skipped, worst_abs, worst_rel))
        A, _qa, ident = advantage(ctx)
        ok("[%s] advantage identity sum_a pi A_inf = 0 at every state" % name, ident < 1e-12,
           "max |sum| %.2e over %d cards" % (ident, len(A)))
    # policy-gradient theorem: d P(W) along pi -> pi + eps (e_a - pi) at state s equals g(s) A_inf(s,a)
    K = load_kernel("nogi", "symmetric", "shipped", graph=graph)
    ctx = Ctx(K)
    A, _qa, _ = advantage(ctx)
    rng = np.random.default_rng(1729)
    cand = [t for t in range(ctx.n) if np.sum(ctx.a_t == t) >= 3 and ctx.g[t] > 1e-3]
    worst, bad_pg = 0.0, 0
    for t in rng.choice(cand, size=12, replace=False):
        acts = np.flatnonzero(ctx.a_t == t)
        a = int(rng.choice(acts))
        eps = 1e-6
        vals = []
        for sg in (-1, 1):
            m = ctx.mass.copy()
            for b in acts:
                cells = ctx.real & (ctx.act == b)
                m[cells] *= 1.0 + sg * eps * ((1.0 if b == a else 0.0) - ctx.a_pi[b]) / ctx.a_pi[b]
            Q = sp.csr_matrix((m[ctx.tr], (ctx.src[ctx.tr], ctx.dst[ctx.tr])), shape=(ctx.n, ctx.n))
            R = sp.csr_matrix((m[~ctx.tr], (ctx.src[~ctx.tr], -1 - ctx.dst[~ctx.tr])), shape=(ctx.n, 3))
            lu = splu(sp.identity(ctx.n, format="csc") - Q.tocsc())
            vals.append(float(ctx.s0 @ lu.solve(R[:, IW].toarray().ravel())))
        fd = (vals[1] - vals[0]) / (2 * eps)
        an = ctx.g[t] * A[a]
        worst = max(worst, abs(fd - an))
        bad_pg += abs(fd - an) > 1e-6 * abs(an) + 1e-9
    ok("[headline] policy-gradient theorem d P(W)/d(pi->e_a) = g(s) A_inf(s,a)", bad_pg == 0,
       "12 (state, card) pairs, max abs err %.1e (criterion 1e-6 rel + 1e-9 abs)" % worst)
    # symmetry propositions (symmetric initiative only)
    nr = ctx.nr
    perm = np.concatenate([nr + ctx.K.flipidx, ctx.K.flipidx])
    coin = K.start("standing", "coin")
    Gw, _ = gradient(ctx, payoff=(1, 0, 0), start=coin)
    Gd, _ = gradient(ctx, payoff=(0, 0, 1), start=coin)
    e1 = float(np.abs(Gw.sum(axis=1) + 0.5 * Gd.sum(axis=1)).max())
    ok("[headline] coin start: both-player grad of P(W) == -1/2 grad of P(D)", e1 < 1e-12,
       "max |diff| %.2e over %d techniques; max |grad P(D)| %.2e" % (e1, len(ctx.keys), np.abs(Gd).max()))
    sig_s0 = np.zeros(ctx.n)
    sig_s0[perm] = ctx.s0
    GL, _ = gradient(ctx, payoff=(0, 1, 0), start=sig_s0)
    Gm, _ = gradient(ctx)
    e2 = float(np.abs(Gm[:, 1] - GL[:, 0]).max())
    ok("[headline] their half at s0 == my half of P(L) from the swapped start", e2 < 1e-12,
       "max |diff| %.2e" % e2)
    # passage: Woodbury vs direct solves on a sample of technique landings and hubs
    ps = passage(ctx, cols=(IW,))
    worst = 0.0
    checked = 0
    for ki in rng.choice(len(ctx.keys), size=15, replace=False):
        cells = ctx.real & (ctx.branch == 0) & np.isin(ctx.act, np.flatnonzero((ctx.a_kidx == ki) & (ctx.a_perf == 0)))
        if not cells.any() or ctx.mass[cells].sum() == 0:
            continue
        m = ctx.mass.copy()
        m[cells] = 0.0
        Q = sp.csr_matrix((m[ctx.tr], (ctx.src[ctx.tr], ctx.dst[ctx.tr])), shape=(ctx.n, ctx.n))
        R = sp.csr_matrix((m[~ctx.tr], (ctx.src[~ctx.tr], -1 - ctx.dst[~ctx.tr])), shape=(ctx.n, 3))
        lu = splu(sp.identity(ctx.n, format="csc") - Q.tocsc())
        direct = (ctx.p[IW] - float(ctx.s0 @ lu.solve(R[:, IW].toarray().ravel()))) / ctx.p[IW]
        worst = max(worst, abs(direct - ps["techniques"]["W"][ki, 0]))
        checked += 1
    ok("[headline] technique passage: Woodbury == direct killed-chain solve", worst < 1e-10 and checked >= 8,
       "%d techniques, max |diff| %.2e" % (checked, worst))
    res = analyse(ctx, clock=False)
    for col in ("W", "L"):
        fbk = res["flux"][col]
        ok("[headline] min-cut theorem (%s): one SCC, cut == finishing layer, capacity == P" % col,
           fbk["scc"]["theorem_applies"] and fbk["scc"]["networkx_cut_is_finishing_layer"]
           and fbk["cut_capacity_equals_probability"],
           "SCC %d of %d carrying states, %d finishing edges" % (fbk["scc"]["largest_scc"],
                                                                fbk["scc"]["states_carrying_current"],
                                                                fbk["finishing_edge_count"]))
    # finisher set == exit law (lane 2's harmonic measure) from s0
    Bf, _r = K.exit_law()
    law = ctx.s0 @ Bf
    fs = dict((t, v) for v, t in res["flux"]["W"]["finisher_set"])
    e3 = max(abs(fs.get(t, 0.0) * ctx.p[IW] - law[k]) for k, (t, pf) in enumerate(K.fin_cols) if pf == "me")
    ok("[headline] cut technique set == K.exit_law() from standing", e3 < 1e-12, "max |diff| %.2e" % e3)
    mc = monte_carlo(ctx, res)
    ok("[headline] seeded Monte Carlo on the kernel's cells (%d rolls)" % mc["trials"], mc["max_abs_z"] <= mc["limit"],
       "%d comparisons, max |z| %.2f (%s)" % (mc["comparisons"], mc["max_abs_z"], mc["worst"]))
    # perturbation reproduction
    try:
        perturbed_ctx(K, 7)
        good, why = True, "cells sum to K.perturbed's (Q, R, R_fin) to < 1e-14"
    except AssertionError as e:
        good, why = False, str(e)
    ok("[headline] cell-level perturbation == K.perturbed (seed 7)", good, why)
    print("== F3: origin-filter restoration identities")
    origin_selfcheck(ok)
    n_fail = sum(1 for c in checks if not c[1])
    print("  %d checks, %d failed (floor 24)" % (len(checks), n_fail))
    return checks


# --------------------------------------------------------------------------- #
# F3: the origin filter, listing by listing (exact, not linearised)
# --------------------------------------------------------------------------- #
ART_ORIGIN = os.path.join(REPO, "tests", "artifacts", "semantics", "flux_origin.json")
GENERIC_TOKENS = {"guard", "control", "position", "the", "from", "to", "of", "and", "in", "on", "with",
                  "top", "bottom", "a", "vs", "x"}


def _tokens(text):
    return {w for w in "".join(ch.lower() if ch.isalnum() else " " for ch in str(text)).split()
            if w not in GENERIC_TOKENS}


class OriginPair:
    """The origin-filtered kernel K0 and its origin=False twin K1 on ONE state space.

    A LISTING is (role-node r, technique key) with positive authored attempt share in this frame,
    role-matching, dealt by K1 at r and NOT by K0 (the origin filter dropped it). RESTORING a set of
    listings rebuilds each touched hand as K1's hand RESTRICTED to K0's cards plus the restored ones,
    renormalised — built from K1's OWN cells, never re-derived. A listing at r touches exactly two
    rows: my turn at r, and their turn at flip(r) (the opponent at flip(r) samples r's hand).
    Restoring every listing reproduces K1; restoring none reproduces K0 (both asserted)."""

    def __init__(self, K0, K1):
        _tpt._require(K0.labels == K1.labels, "K0 and K1 must share the transient index space")
        self.K0, self.K1 = K0, K1
        self.n, self.nr = K0.n_t, K0.n_r
        n = self.n
        cols = sorted(set(K0.fin_cols) | set(K1.fin_cols)) + [("__draw__", "none")]
        self.cols = cols
        self.col_idx = {c: i for i, c in enumerate(cols)}
        self.m = len(cols)
        self.me_mask = np.array([pf == "me" for _t, pf in cols])
        self.them_mask = np.array([pf == "them" for _t, pf in cols])
        # base chain from K0's own matrices; exits aligned by IDENTITY (finisher, performer) + draw
        self.Q0 = K0.Q.toarray()
        self.E0rows = self._ext_rows(K0)
        self.N0 = np.linalg.inv(np.eye(n) - self.Q0)
        _tpt._require(np.abs((np.eye(n) - self.Q0) @ self.N0 - np.eye(n)).max() < 1e-9, "N0 residual")
        self.s0 = K0.start("standing", "me")
        self.g0 = self.N0.T @ self.s0
        self.B0 = self.N0 @ self.E0rows                    # n x m exit law of the base chain
        self.E0 = self.s0 @ self.B0
        # hands per row, by technique key
        self.h0 = [dict() for _ in range(n)]
        self.h1 = [dict() for _ in range(n)]
        for K, h in ((K0, self.h0), (K1, self.h1)):
            for a in K.actions:
                k = a["cat"] + "/" + a["target"]
                h[a["t"]][k] = h[a["t"]].get(k, 0.0) + a["pi"]
        # K1 card rows (conditional on the card), for every row that has a dropped card
        self.drop_rows = [t for t in range(n) if set(self.h1[t]) - set(self.h0[t])]
        c = K1.cells
        self.card_q, self.card_e = {}, {}
        act_key = [a["cat"] + "/" + a["target"] for a in K1.actions]
        want = set(self.drop_rows)
        for ci in np.flatnonzero(c["act"] >= 0):
            t = int(c["src"][ci])
            if t not in want:
                continue
            k = act_key[c["act"][ci]]
            key = (t, k)
            if key not in self.card_q:
                self.card_q[key] = np.zeros(n)
                self.card_e[key] = np.zeros(self.m)
            d = int(c["dst"][ci])
            if d >= 0:
                self.card_q[key][d] += c["mass"][ci]
            elif c["fin"][ci] >= 0:
                self.card_e[key][self.col_idx[K1.fin_cols[c["fin"][ci]]]] += c["mass"][ci]
            else:
                self.card_e[key][self.m - 1] += c["mass"][ci]
        for key in self.card_q:                            # conditional rows: divide by the card's pi
            pi = self.h1[key[0]][key[1]]
            self.card_q[key] /= pi
            self.card_e[key] /= pi
        # THE RESTRICTION IDENTITY: K0's row == K1's cards restricted to K0's keys, renormalised
        worst = 0.0
        for t in self.drop_rows:
            q, e = self.row(t, ())
            worst = max(worst, np.abs(q - self.Q0[t]).max(), np.abs(e - self.E0rows[t]).max())
        _tpt._require(worst < 1e-14, "K0 row != restricted K1 row (%.2e)" % worst)
        self.restriction_error = worst
        # listings, keyed (role-node, technique key); each touches my row at r and their row at flip r
        self.listings = sorted({(K0.role_nodes[t], k) for t in self.drop_rows if t < self.nr
                                for k in set(self.h1[t]) - set(self.h0[t])})
        for rn, k in self.listings:
            tt = self.nr + K0.index[flip_rn(rn)]
            _tpt._require(k in self.h1[tt] and k not in self.h0[tt], "their-row mirror of a listing is missing")

    def _ext_rows(self, K):
        E = np.zeros((self.n, self.m))
        c = K.cells
        ab = c["dst"] < 0
        for ci in np.flatnonzero(ab):
            if c["fin"][ci] >= 0:
                E[c["src"][ci], self.col_idx[K.fin_cols[c["fin"][ci]]]] += c["mass"][ci]
            else:
                E[c["src"][ci], self.m - 1] += c["mass"][ci]
        return E

    def rows_of(self, rn):
        return [self.K0.index[rn], self.nr + self.K0.index[flip_rn(rn)]]

    def row(self, t, extra_keys):
        keys = sorted(set(self.h0[t]) | set(extra_keys))    # sorted: set order follows the hash seed
        Z = sum(self.h1[t][k] for k in keys)
        q = sum(self.h1[t][k] * self.card_q[(t, k)] for k in keys) / Z
        e = sum(self.h1[t][k] * self.card_e[(t, k)] for k in keys) / Z
        return q, e

    def change(self, listing_set):
        """rows T, dQ[T,:], dE[T,:] for restoring a set of listings (exact rows, K1's cells)."""
        by_row = {}
        for rn, k in listing_set:
            for t in self.rows_of(rn):
                by_row.setdefault(t, set()).add(k)
        T = sorted(by_row)
        dQ = np.zeros((len(T), self.n))
        dE = np.zeros((len(T), self.m))
        for i, t in enumerate(T):
            q, e = self.row(t, by_row[t])
            dQ[i], dE[i] = q - self.Q0[t], e - self.E0rows[t]
        return np.array(T), dQ, dE

    def exit_delta(self, T, dQ, dE, g0=None):
        g0 = self.g0 if g0 is None else g0
        _g1, d = _tpt.row_update(self.N0, g0, T, dQ, dE + dQ @ self.B0)
        return d


def flip_rn(rn):
    hub, role = rn.rsplit("/", 1)
    return hub + "/" + ("bottom" if role == "top" else "top")


class HubKill:
    """The base chain with every cell ENTERING hub X from outside killed (to an unrewarded exit), for
    exact passage updates: P(I finish AND visit X) = P(I finish) - s_X^T v_X."""

    def __init__(self, op, hub):
        K = op.K0
        n = op.n
        inside = np.zeros(n, dtype=bool)
        hi = K.hub_index[hub]
        inside[:] = K.groups_hub() == hi
        self.inside = inside
        Q = op.Q0.copy()
        Q[np.ix_(~inside, inside)] = 0.0
        self.Q = Q
        self.N = np.linalg.inv(np.eye(n) - Q)
        self.s = op.s0 * (~inside)
        self.g = self.N.T @ self.s
        self.rW = op.E0rows[:, op.me_mask].sum(axis=1)
        self.v = self.N @ self.rW
        self.J = float(self.s @ self.v)                  # P(I finish AND never visit X), start outside X

    def delta(self, op, T, dQ, dE):
        dQk = dQ.copy()
        outside = ~self.inside[T]
        dQk[np.ix_(outside, self.inside)] = 0.0
        # killed entries of the NEW row: the new row's entering mass is killed too (dQ already carries
        # new - old; zeroing both sides of the entering columns kills both)
        M = dE[:, op.me_mask].sum(axis=1) + dQk @ self.v
        _g1, d = _tpt.row_update(self.N, self.g, T, dQk, M[:, None])
        return float(d[0])


def origin_analysis(graph, frame, ini, full=False, top_hubs=5):
    K0 = load_kernel(frame, ini, "shipped", graph=graph)
    K1 = load_kernel(frame, ini, "shipped", graph=graph, origin=False)
    op = OriginPair(K0, K1)
    ctx0 = Ctx(K0)
    _tpt._close(op.E0[op.me_mask].sum(), ctx0.p[IW], "aligned exit law regroups to P(W)")
    pw0 = float(op.E0[op.me_mask].sum())
    # top hubs by passage in won rolls (F2R's quantity), start hub excluded
    hp = group_passage(ctx0, ctx0.hub_t, len(K0.hubs), cols=(IW,))["W"]
    hubs = [K0.hubs[i] for i in sorted(range(len(K0.hubs)), key=lambda i: (-hp[i], K0.hubs[i]))
            if K0.hubs[i] != "standing-position"][:top_hubs]
    kills = {h: HubKill(op, h) for h in hubs}
    base_pass = {h: (pw0 - kills[h].J) / pw0 for h in hubs}
    for h in hubs:
        _tpt._close(base_pass[h], hp[K0.hub_index[h]], "HubKill passage == F2R group_passage (%s)" % h)
    # finisher metadata for coarse grouping (performer x raw type) and words
    meta = {}
    for tid, pf in op.cols:
        if tid == "__draw__":
            meta[(tid, pf)] = ("draw", "draw")
            continue
        node = graph["submissions"].get(tid + "/attacker") or graph["transitions"].get(tid + "/attacker") or {}
        meta[(tid, pf)] = (node.get("type") or node.get("category") or "untyped", node.get("name") or tid)
    groups = sorted({(pf, meta[c][0]) for c in op.cols for pf in [c[1]]})
    gidx = {gk: i for i, gk in enumerate(groups)}
    G = np.zeros((op.m, len(groups)))
    for j, c in enumerate(op.cols):
        G[j, gidx[(c[1], meta[c][0])]] = 1.0

    def effect(listing_set, local=None):
        T, dQ, dE = op.change(listing_set)
        dvec = op.exit_delta(T, dQ, dE)
        out = {"dvec": dvec, "dPW": float(dvec[op.me_mask].sum()), "tv": 0.5 * float(np.abs(dvec).sum()),
               "tv_type": 0.5 * float(np.abs(dvec @ G).sum()), "rows": len(T)}
        pw1 = pw0 + out["dPW"]
        out["passage"] = {}
        for h in hubs:
            dJ = kills[h].delta(op, T, dQ, dE)
            out["passage"][h] = (pw1 - (kills[h].J + dJ)) / pw1 - base_pass[h]
        if local is not None:
            e_t = np.zeros(op.n)
            e_t[local] = 1.0
            dloc = op.exit_delta(T, dQ, dE, g0=op.N0.T @ e_t)
            out["dq_local"] = float(dloc[op.me_mask].sum())
        return out

    # ---- every listing, singly
    rows = []
    for rn, k in op.listings:
        eff = effect([(rn, k)], local=K0.index[rn])
        rows.append((rn, k, eff))
    # ---- the joint change must BE K1 (exact identity, not a tolerance on a model)
    joint = effect(op.listings)
    B1, _r = K1.exit_law()
    E1 = np.zeros(op.m)
    law1 = K1.start("standing", "me") @ B1
    for j, c in enumerate(K1.fin_cols):
        E1[op.col_idx[c]] = law1[j]
    E1[op.m - 1] = float(K1.start("standing", "me") @ K1.absorption()[0][:, ID])
    joint_err = float(np.abs((op.E0 + joint["dvec"]) - E1).max())
    _tpt._require(joint_err < 1e-12, "restoring every listing != origin=False kernel (%.2e)" % joint_err)
    ctx1 = Ctx(K1)
    hp1 = group_passage(ctx1, ctx1.hub_t, len(K1.hubs), cols=(IW,))["W"]
    pass_err = max(abs(base_pass[h] + joint["passage"][h] - hp1[K1.hub_index[h]]) for h in hubs)
    _tpt._require(pass_err < 1e-12, "joint passage != origin=False passage (%.2e)" % pass_err)
    # ---- additivity
    S_vec = sum(e["dvec"] for _r, _k, e in rows)
    inter = joint["dvec"] - S_vec
    by_node = {}
    for rn, k, _e in rows:
        by_node.setdefault(rn, []).append((rn, k))
    node_effects = {rn: effect(ls) for rn, ls in sorted(by_node.items())}
    S_node = sum(e["dvec"] for e in node_effects.values())
    # coupling between restored rows (the proposition's off-diagonal blocks), all listings at once
    T_all, dQ_all, _dE = op.change(op.listings)
    C = dQ_all @ op.N0[:, T_all]
    blocks = {}
    for i, t in enumerate(T_all):
        rn = K0.role_nodes[t] if t < op.nr else flip_rn(K0.role_nodes[t - op.nr])
        blocks.setdefault(rn, []).append(i)
    off = C.copy()
    for idx in blocks.values():
        off[np.ix_(idx, idx)] = 0.0
    ranked = sorted(rows, key=lambda x: (-x[2]["tv"], x[0], x[1]))
    # ---- EXACT ADDITIVE ATTRIBUTION of the joint change (gs-2 Corollary A'/A'', the dilution of the
    # filtered cards apportioned by full-hand share). Row identity (Proposition O1): for every row t,
    #   K1 row - K0 row = sum_k pi1(k|t) (c_k(t) - old_row(t)),
    # linear in the listings. With A1 (new occupancy g1, old values B0) or A2 (old occupancy g0,
    # new values B1) the joint change of the exit law from s0 is a SUM over listings, zero remainder.
    Q1d = K1.Q.toarray()
    E1rows = op._ext_rows(K1)
    N1 = np.linalg.inv(np.eye(op.n) - Q1d)
    g1 = N1.T @ op.s0
    B1 = N1 @ E1rows
    worst_row = 0.0
    for t in op.drop_rows:
        dropped = sorted(set(op.h1[t]) - set(op.h0[t]))
        q_new = op.Q0[t] + sum(op.h1[t][k] * (op.card_q[(t, k)] - op.Q0[t]) for k in dropped)
        e_new = op.E0rows[t] + sum(op.h1[t][k] * (op.card_e[(t, k)] - op.E0rows[t]) for k in dropped)
        worst_row = max(worst_row, np.abs(q_new - Q1d[t]).max(), np.abs(e_new - E1rows[t]).max())
    _tpt._require(worst_row < 1e-14, "Proposition O1 row identity fails (%.2e)" % worst_row)
    attrA1, attrA2 = {}, {}
    for rn, k in op.listings:
        a1 = np.zeros(op.m)
        a2 = np.zeros(op.m)
        for t in op.rows_of(rn):
            pk = op.h1[t][k]
            dq = op.card_q[(t, k)] - op.Q0[t]
            de = op.card_e[(t, k)] - op.E0rows[t]
            a1 += g1[t] * pk * (de + dq @ op.B0)
            a2 += op.g0[t] * pk * (de + dq @ B1)
        attrA1[(rn, k)], attrA2[(rn, k)] = a1, a2
    e1 = float(np.abs(sum(attrA1.values()) - joint["dvec"]).max())
    e2 = float(np.abs(sum(attrA2.values()) - joint["dvec"]).max())
    _tpt._require(max(e1, e2) < 1e-12, "attribution does not sum to the joint change (%.2e, %.2e)" % (e1, e2))
    sig = np.sign(joint["dvec"])
    sig_t = np.sign(joint["dvec"] @ G)
    tvA1 = {key: 0.5 * float(v @ sig) for key, v in attrA1.items()}
    tvA2 = {key: 0.5 * float(v @ sig) for key, v in attrA2.items()}
    tvA1_type = {key: 0.5 * float((v @ G) @ sig_t) for key, v in attrA1.items()}
    pwA1 = {key: float(v[op.me_mask].sum()) for key, v in attrA1.items()}
    _tpt._close(sum(tvA1.values()), joint["tv"], "TV attribution (A1) sums to the joint TV")
    _tpt._close(sum(tvA2.values()), joint["tv"], "TV attribution (A2) sums to the joint TV")
    _tpt._close(sum(tvA1_type.values()), joint["tv_type"], "type-level TV attribution sums to the joint")
    keysA = sorted(tvA1, key=lambda x: (-tvA1[x], x))
    keysA2 = sorted(tvA2, key=lambda x: (-tvA2[x], x))
    renorm = [1.0 / (sum(op.h1[op.K0.index[rn]][k_] for k_ in op.h0[op.K0.index[rn]]) + op.h1[op.K0.index[rn]][k])
              for rn, k in op.listings]
    for r_ in rows:
        key = (r_[0], r_[1])
        r_[2]["tv_attr_A1"], r_[2]["tv_attr_A2"] = tvA1[key], tvA2[key]
        r_[2]["tv_type_attr_A1"], r_[2]["dPW_attr_A1"] = tvA1_type[key], pwA1[key]
    curve = []
    for N_ in (1, 5, 10, 20, 30, 50, 100, 200, 400, len(ranked)):
        if N_ > len(ranked):
            continue
        e = effect([(r_, k_) for r_, k_, _e in ranked[:N_]])
        ea = effect(keysA[:N_])
        curve.append({"top_n": N_, "by_single_tv": {"tv_to_base": e["tv"], "tv_share_of_joint": e["tv"] / joint["tv"],
                                                    "tv_to_joint_over_joint": 0.5 * float(np.abs(e["dvec"] - joint["dvec"]).sum()) / joint["tv"],
                                                    "dPW": e["dPW"]},
                      "by_attributed_tv": {"tv_to_base": ea["tv"], "tv_share_of_joint": ea["tv"] / joint["tv"],
                                           "tv_to_joint_over_joint": 0.5 * float(np.abs(ea["dvec"] - joint["dvec"]).sum()) / joint["tv"],
                                           "attributed_share": sum(tvA1[x] for x in keysA[:N_]) / joint["tv"],
                                           "dPW": ea["dPW"]}})
    additivity = {
        "sum_single_dPW": float(S_vec[op.me_mask].sum()), "joint_dPW": joint["dPW"],
        "sum_single_tv": float(sum(e["tv"] for _r, _k, e in rows)), "joint_tv": joint["tv"],
        "tv_of_summed_vector": 0.5 * float(np.abs(S_vec).sum()),
        "interaction_l1_over_joint_l1": float(np.abs(inter).sum() / np.abs(joint["dvec"]).sum()),
        "per_role_node_sum_tv_of_vector": 0.5 * float(np.abs(S_node).sum()),
        "per_role_node_interaction_l1_over_joint_l1": float(np.abs(joint["dvec"] - S_node).sum()
                                                             / np.abs(joint["dvec"]).sum()),
        "restored_rows": int(len(T_all)), "coupling_max_abs_offblock": float(np.abs(off).max()),
        "coupling_max_abs_inblock": float(max(np.abs(C[np.ix_(ix, ix)]).max() for ix in blocks.values())),
        "top_n_recovery": curve,
        "row_identity_O1_max_err": worst_row, "attribution_sum_err": {"A1": e1, "A2": e2},
        "attribution_A1_vs_A2": {"top30_overlap": len(set(keysA[:30]) & set(keysA2[:30])) / 30.0,
                                 "spearman": spearmanr([tvA1[x] for x in op.listings], [tvA2[x] for x in op.listings]).correlation,
                                 "same_top_listing": keysA[0] == keysA2[0]},
        "single_vs_attributed": {"spearman": spearmanr([r_[2]["tv"] for r_ in rows], [r_[2]["tv_attr_A1"] for r_ in rows]).correlation,
                                 "top30_overlap": len({(r_[0], r_[1]) for r_ in ranked[:30]} & set(keysA[:30])) / 30.0},
        "renormalisation_factor_single": {"mean": float(np.mean(renorm)), "max": float(np.max(renorm)),
                                          "note": "1/(Z0 + pi1(k)): how much a single restoration amplifies its "
                                                  "row change relative to its term in the joint row change"},
        "negative_attributions": sum(1 for v in tvA1.values() if v < 0),
        "sum_positive_attributions_over_joint": sum(v for v in tvA1.values() if v > 0) / joint["tv"],
        "sum_abs_attributions_over_joint": sum(abs(v) for v in tvA1.values()) / joint["tv"],
    }
    # ---- orphans as a whole (every listing of the technique restored together)
    orphan_rows = []
    for tid in sorted(K0.origin_orphans):
        ls = [(r_, k_) for r_, k_ in op.listings if k_.split("/", 1)[1] == tid]
        e = effect(ls)
        orphan_rows.append({"technique": tid, "name": _tech_name(graph, ls[0][1]) if ls else tid,
                            "listings": [r_ for r_, _k in ls], "dPW": e["dPW"], "tv": e["tv"], "tv_type": e["tv_type"],
                            "passage": e["passage"], "top_moves": _top_moves(op, meta, e["dvec"])})
    _tpt._require(all(o["listings"] for o in orphan_rows), "an orphan has no dropped listing")
    orphan_rows.sort(key=lambda o: (-o["tv"], o["technique"]))
    table = [_listing_row(graph, op, meta, rn, k, eff, K0) for rn, k, eff in ranked]
    by_key = {(r_["listing"], r_["technique"]): r_ for r_ in table}
    table_attr = [by_key[x] for x in keysA]
    coherent = [(r_["listing"], r_["technique"]) for r_ in table if not r_["teleports_on_miss"]]
    ce = effect(coherent) if coherent else None
    coherent_effect = None if ce is None else {
        "listings": len(coherent), "dPW": ce["dPW"], "tv": ce["tv"], "tv_type": ce["tv_type"],
        "passage_change": ce["passage"], "share_of_joint_tv": ce["tv"] / joint["tv"],
        "tv_to_joint_over_joint": 0.5 * float(np.abs(ce["dvec"] - joint["dvec"]).sum()) / joint["tv"],
        "items": [{"listing": a_, "technique": b_} for a_, b_ in coherent]}
    return {"table_attr": table_attr, "coherent_effect": coherent_effect,"op": op, "K0": K0, "K1": K1, "hubs": hubs, "base_pass": base_pass, "pw0": pw0,
            "table": table, "joint": joint, "joint_err": joint_err, "pass_err": pass_err,
            "additivity": additivity, "orphans": orphan_rows, "node_effects": node_effects,
            "effect": effect, "meta": meta}


def _top_moves(op, meta, dvec, k=2):
    order = np.argsort(-dvec, kind="stable")
    up = [(meta[op.cols[j]][1], op.cols[j][1], float(dvec[j])) for j in order[:k] if dvec[j] > 1e-12]
    dn = [(meta[op.cols[j]][1], op.cols[j][1], float(dvec[j])) for j in order[::-1][:k] if dvec[j] < -1e-12]
    return {"gains": up, "losses": dn}


def _listing_row(graph, op, meta, rn, k, eff, K0):
    cat, target = k.split("/", 1)
    # the card AS DEALT AT THIS LISTING: its own table when it has one (v1.214.0, origin coherence
    # PR B), so a listing that no longer teleports is not reported as teleporting
    edge = next((tr for tr in graph["positions"][rn].get("transitions") or [] if tr.get("target") == target), None)
    node = listing_view(graph[cat].get(target + "/attacker") or {}, edge)
    origin = (node.get("fromPositionId") or "?") + "/" + (node.get("fromRole") or "?")
    t = K0.index[rn]
    share = op.h1[t][k] / sum(op.h1[t].values())               # the listing's share of the authored hand
    pts = 0.0
    for tr in graph["positions"][rn].get("transitions") or []:
        c_ = "submissions" if tr.get("isSubmission") else "transitions"
        v = tr["attemptProbabilityByRuleset"].get(K0.frame)
        if tr["target"] == target and c_ == cat and v is not None and v > 0:
            pts += v
    ot = K0.index.get(origin)
    dealt_at_origin = ot is not None and k in op.h0[ot]
    orphan = target in set(K0.origin_orphans)
    hub_here, hub_origin = rn.rsplit("/", 1)[0], origin.rsplit("/", 1)[0]
    tn = _tokens(node.get("name") or target)
    th, to = _tokens(_hub_display(graph, hub_here)), _tokens(_hub_display(graph, hub_origin))
    names_here, names_origin = bool(tn & th), bool(tn & to)
    near = len(th & to) / max(1, len(th | to)) >= 1 / 3
    # EVIDENCE, not a judgement: how many role-nodes list the move, whether its origin lists it at
    # all, and how often a roll stands at the listing vs at the origin (either turn, from standing)
    n_listed = sum(1 for tt in range(op.nr) if k in op.h1[tt])
    origin_lists = ot is not None and k in op.h1[ot]
    visits = lambda rn_: (float(op.g0[K0.index[rn_]] + op.g0[op.nr + K0.index[rn_]]) if rn_ in K0.index else 0.0)
    v_here, v_origin = visits(rn), visits(origin)
    # THE TELEPORT TEST. A card's outcome table is authored at its canonical origin. Share of each
    # branch (authored %, role-node landings only; chained hub cells skipped) landing on the ORIGIN's
    # hub and on the LISTING's hub. Dealt at the listing, a miss that lands on the origin hub moves the
    # pair to a place it never was: the teleport the origin filter exists to prevent.
    br = {"success": [0.0, 0.0, 0.0], "miss": [0.0, 0.0, 0.0]}      # [to origin hub, to listing hub, total]
    for o in node.get("outcomes") or []:
        to = str(o.get("to") or "")
        if not (to.endswith("/top") or to.endswith("/bottom")):
            continue
        b = br["success" if o["result"] == "success" else "miss"]
        hub_to = to.rsplit("/", 1)[0]
        pr = float(o["probability"])
        b[2] += pr
        b[0] += pr if hub_to == hub_origin else 0.0
        b[1] += pr if hub_to == hub_here else 0.0
    frac = lambda b, i: (b[i] / b[2]) if b[2] > 0 else None
    miss_to_origin, miss_stays = frac(br["miss"], 0), frac(br["miss"], 1)
    succ_to_origin = frac(br["success"], 0)
    teleports = hub_here != hub_origin and (miss_to_origin or 0.0) >= 0.5
    if orphan and not origin_lists:
        verdict = ("metadata error likely: its canonical origin does not list it (listed at %d other role-node%s)"
                   % (n_listed, "" if n_listed == 1 else "s"))
    elif orphan:
        verdict = "orphan although its origin lists it (role or frame mismatch at the origin)"
    elif n_listed >= 4 and not names_origin:
        verdict = ("generic move listed at %d role-nodes; one canonical origin keeps one of them (a schema "
                   "limit, not an error at this listing)" % n_listed)
    elif near or names_origin:
        verdict = "variant of its origin position, listed twice"
    elif names_here:
        verdict = "the NAME matches this listing, not its origin: check the origin metadata"
    else:
        verdict = "listed at %d role-nodes including its origin; the name is silent" % n_listed
    if teleports:
        verdict = ("TELEPORTS on a miss (%.0f%% of its miss branch lands on %s, its origin's hub); "
                   % (100 * miss_to_origin, hub_origin)) + verdict
    # the card's own success landing and rate
    succ = [(o["probability"], o["to"]) for o in node.get("outcomes") or [] if o["result"] == "success"]
    landing = max(succ)[1] if succ else None
    tm = _top_moves(op, meta, eff["dvec"])
    words = ("%s at %s (%.0f%% of the listed hand, success %s%%%s): P(I finish | there, my turn) %+.4f; "
             "from standing P(I finish) %+.5f, finisher law moves TV %.4f (by type %.4f)%s%s" % (
                 node.get("name") or target, rn, 100 * share, node.get("successRate"),
                 (", lands " + landing) if landing else "", eff.get("dq_local", float("nan")), eff["dPW"], eff["tv"],
                 eff["tv_type"],
                 ("; gains " + ", ".join("%s (%s) %+.4f" % g for g in tm["gains"])) if tm["gains"] else "",
                 ("; losses " + ", ".join("%s (%s) %+.4f" % g for g in tm["losses"])) if tm["losses"] else ""))
    return {"listing": rn, "technique": k, "name": node.get("name") or target, "origin": origin,
            "attempt_points": pts, "share_of_listed_hand": share, "dealt_at_origin": dealt_at_origin,
            "orphan": orphan, "name_matches_listing": names_here, "name_matches_origin": names_origin,
            "neighbouring_hubs": near, "verdict": verdict, "role_nodes_listing_it": n_listed,
            "origin_lists_it": origin_lists, "visits_per_roll_here": v_here, "visits_per_roll_at_origin": v_origin,
            "miss_to_origin_hub": miss_to_origin, "miss_stays_at_listing_hub": miss_stays,
            "success_to_origin_hub": succ_to_origin, "teleports_on_miss": teleports, "dPW": eff["dPW"], "tv": eff["tv"],
            "tv_type": eff["tv_type"], "dq_local": eff.get("dq_local"), "passage": eff["passage"],
            "tv_attr_A1": eff["tv_attr_A1"], "tv_attr_A2": eff["tv_attr_A2"],
            "tv_type_attr_A1": eff["tv_type_attr_A1"], "dPW_attr_A1": eff["dPW_attr_A1"],
            "top_moves": tm, "words": words}


def tripod_case(graph, res):
    """The Tripod Sweep teleport: restore its open-guard/bottom listing and solve the restored chain
    DIRECTLY (dense), which also cross-checks the row update on the one listing that changes reach."""
    op, K0 = res["op"], res["K0"]
    ls = [x for x in op.listings if x[0] == "open-guard/bottom" and x[1].endswith("/tripod-sweep")]
    if not ls:
        return {"skipped": "no dropped Tripod Sweep listing at open-guard/bottom in this configuration"}
    T, dQ, dE = op.change(ls)
    Q1 = op.Q0.copy()
    E1 = op.E0rows.copy()
    Q1[T] += dQ
    E1[T] += dE
    N1 = np.linalg.inv(np.eye(op.n) - Q1)
    law = op.s0 @ (N1 @ E1)
    upd = op.E0 + op.exit_delta(T, dQ, dE)
    err = float(np.abs(law - upd).max())

    def reach(Q):
        seen = np.zeros(op.n, dtype=bool)
        st = [int(i) for i in np.flatnonzero(K0.start("standing", "coin"))]
        seen[st] = True
        while st:
            i = st.pop()
            for j in np.flatnonzero(Q[i] > 0):
                if not seen[j]:
                    seen[j] = True
                    st.append(int(j))
        rn = seen[:op.nr] | seen[op.nr:]
        return {K0.role_nodes[i] for i in np.flatnonzero(rn)}
    r0, r1 = reach(op.Q0), reach(Q1)
    new = sorted(r1 - r0)
    # P(visit spider-guard) in the restored chain, and in won rolls
    inside = K0.groups_hub() == K0.hub_index["spider-guard"]
    Qk = Q1.copy()
    Qk[np.ix_(~inside, inside)] = 0.0
    Nk = np.linalg.inv(np.eye(op.n) - Qk)
    s = op.s0 * (~inside)
    pw1 = float(law[op.me_mask].sum())
    avoidW = float(s @ (Nk @ E1[:, op.me_mask].sum(axis=1)))
    avoid_all = float(s @ (Nk @ E1.sum(axis=1)))
    row = next(r for r in res["table"] if r["listing"] == "open-guard/bottom" and r["technique"].endswith("/tripod-sweep"))
    node = graph["transitions"]["tripod-sweep/attacker"]
    return {"listing": "open-guard/bottom", "technique": ls[0][1], "canonical_origin": row["origin"],
            "outcomes": [[o["to"], o["result"], o["probability"]] for o in node.get("outcomes") or []],
            "direct_vs_update_max_abs": err, "reachable_role_nodes_before": len(r0), "after": len(r1),
            "newly_reachable": new, "P_visit_spider_guard": 1.0 - avoid_all,
            "P_visit_spider_guard_given_I_finish": (pw1 - avoidW) / pw1,
            "dPW": row["dPW"], "tv": row["tv"], "tv_type": row["tv_type"], "rank_by_tv": 1 + next(
                i for i, r in enumerate(res["table"]) if r is row),
            "listings_of_tripod_dropped": sorted(r_ for r_, k_ in op.listings if k_.endswith("/tripod-sweep"))}


def origin_main(full=False, out=ART_ORIGIN, scratch=None):
    base = load_kernel("nogi", "symmetric", "shipped")
    graph = base.graph
    configs = (("headline", "nogi", "symmetric"), ("shipped", "nogi", "shipped"), ("gi", "gi", "symmetric"))
    art = {"item": "F3", "lane": "gs-4 EDGES", "recompute": RECOMPUTE + " --origin", "graph_sha256": graph_sha256(),
           "source_sha256": {f: file_sha256(f) for f in ("scripts/semantics/flux.py", "scripts/semantics/_tpt.py")},
           "which_game": "the corpus's game; H = infinity; start = standing, me first",
           "listing": "(role-node, technique key) with positive authored attempt share in the frame, role-"
                      "matching, dealt by origin=False and dropped by the origin filter",
           "restore": "the touched hands become origin=False's hand restricted to the filtered cards plus "
                      "the restored ones, renormalised (K1's own cells); rows: my turn at r, their turn at flip r",
           "tv": "exit-law total variation from standing over finisher columns (technique, performer) + draw, "
                 "aligned by identity (gs-3 Proposition 1); tv_type = the same over (performer, raw type) + draw",
           "configs": {}}
    results = {}
    for name, fr, ini in configs:
        print("== F3 origin analysis: %s (%s/%s)" % (name, fr, ini))
        res = origin_analysis(graph, fr, ini)
        results[name] = res
        op, K0 = res["op"], res["K0"]
        tvs = np.array([r["tv"] for r in res["table"]])
        pts_total = sum(r["attempt_points"] for r in res["table"])
        _tpt._close(pts_total, K0.coverage["origin_dropped_attempt_pts"], "listing points == kernel census")
        c = {"coverage": {"listings": len(res["table"]), "role_nodes_with_listings": len({r["listing"] for r in res["table"]}),
                          "attempt_points": pts_total, "kernel_census_points": K0.coverage["origin_dropped_attempt_pts"],
                          "orphans": len(res["orphans"]), "kernel_orphans": len(K0.origin_orphans),
                          "exit_columns_aligned": op.m, "restriction_identity_max_err": op.restriction_error},
             "base": {"P_I_finish": res["pw0"], "top_hubs": res["hubs"], "passage_given_I_finish": res["base_pass"]},
             "joint_origin_false": {"dPW": res["joint"]["dPW"], "tv": res["joint"]["tv"], "tv_type": res["joint"]["tv_type"],
                                    "passage_change": res["joint"]["passage"], "equals_K1_max_abs": res["joint_err"],
                                    "passage_equals_K1_max_abs": res["pass_err"]},
             "additivity": res["additivity"],
             "distribution": {"tv_ge_0.01": int((tvs >= 0.01).sum()), "tv_ge_0.005": int((tvs >= 0.005).sum()),
                              "tv_ge_0.001": int((tvs >= 0.001).sum()), "tv_zero": int((tvs == 0).sum()),
                              "top30_share_of_sum_single_tv": float(np.sort(tvs)[::-1][:30].sum() / tvs.sum()),
                              "max_abs_dPW_single": float(max(abs(r["dPW"]) for r in res["table"]))},
             "top30": [{k: v for k, v in r.items()} for r in res["table"][:30]],
             "top30_by_attributed_tv": [{k: r[k] for k in ("listing", "technique", "name", "origin", "tv", "tv_attr_A1",
                                                           "tv_attr_A2", "tv_type_attr_A1", "dPW_attr_A1", "verdict")}
                                        for r in res["table_attr"][:30]],
             "unreachable_listings_zero_effect": sum(1 for r in res["table"] if r["tv"] == 0 and r["dPW"] == 0),
             "teleport_census": {
                 "listings_teleporting_on_miss": sum(1 for r in res["table"] if r["teleports_on_miss"]),
                 "their_attempt_points": sum(r["attempt_points"] for r in res["table"] if r["teleports_on_miss"]),
                 "listings_whose_miss_stays_at_listing_hub": sum(1 for r in res["table"] if (r["miss_stays_at_listing_hub"] or 0) >= 0.5),
                 "listings_with_miss_branch": sum(1 for r in res["table"] if r["miss_to_origin_hub"] is not None),
                 "in_top30_by_single_tv": sum(1 for r in res["table"][:30] if r["teleports_on_miss"]),
                 "share_of_joint_attributed_tv": sum(r["tv_attr_A1"] for r in res["table"] if r["teleports_on_miss"]) / res["joint"]["tv"],
                 "rule": "miss branch (failure + counter, role-node landings) lands >= 50% on the canonical origin's hub, "
                         "and the listing sits on a different hub"},
             "top10_by_tv_type": [{k: r[k] for k in ("listing", "technique", "name", "origin", "tv", "tv_type",
                                                    "tv_type_attr_A1", "dPW")}
                                  for r in sorted(res["table"], key=lambda r: (-r["tv_type"], r["listing"], r["technique"]))[:10]],
             "orphans": res["orphans"],
             "tripod": tripod_case(graph, res),
             "restore_only_non_teleporting": res["coherent_effect"],
             "miss_geography": miss_geography(res["table"], sum(1 for r in res["table"] if r["teleports_on_miss"]))}
        art["configs"][name] = c
        if full:
            os.makedirs(scratch, exist_ok=True)
            with open(os.path.join(scratch, "flux-origin-full-%s.json" % name), "w") as fh:
                json.dump(_clean(res["table"]), fh, indent=0, sort_keys=True)
    # cross-config survival of the headline top 30 (joined on (role-node, technique) identity)
    head = [(r["listing"], r["technique"]) for r in results["headline"]["table"][:30]]
    surv = []
    for key in head:
        row = {"listing": key[0], "technique": key[1]}
        for name in ("shipped", "gi"):
            tab = results[name]["table"]
            pos = next((i for i, r in enumerate(tab) if (r["listing"], r["technique"]) == key), None)
            row[name] = None if pos is None else {"rank": pos + 1, "tv": tab[pos]["tv"]}
        surv.append(row)
    art["headline_top30_in_other_configs"] = surv
    txt = json.dumps(_clean(art), indent=1, sort_keys=True, allow_nan=False) + "\n"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(txt)
    print("wrote %s (%d bytes)" % (out, len(txt)))
    _tpt._require(len(txt) < 1_000_000, "flux_origin.json over the 1 MB budget")
    return results


def _clean(x):
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, (np.floating, float)):
        return r6(float(x))
    if isinstance(x, np.integer):
        return int(x)
    if isinstance(x, np.bool_):
        return bool(x)
    if isinstance(x, np.ndarray):
        return [_clean(v) for v in x.tolist()]
    return x


def origin_selfcheck(ok):
    base = load_kernel("nogi", "symmetric", "shipped")
    graph = base.graph
    for fr, ini in (("nogi", "symmetric"), ("gi", "shipped")):
        K0 = load_kernel(fr, ini, "shipped", graph=graph)
        K1 = load_kernel(fr, ini, "shipped", graph=graph, origin=False)
        op = OriginPair(K0, K1)
        ok("[%s/%s] restriction identity: K0 rows == K1 restricted + renormalised" % (fr, ini),
           op.restriction_error < 1e-14 and len(op.drop_rows) >= 100,
           "%d rows with dropped cards, max |diff| %.1e" % (len(op.drop_rows), op.restriction_error))
        rng = np.random.default_rng(2718)
        worst = 0.0
        picks = rng.choice(len(op.listings), size=12, replace=False)
        for i in picks:
            T, dQ, dE = op.change([op.listings[i]])
            Q1, E1 = op.Q0.copy(), op.E0rows.copy()
            Q1[T] += dQ
            E1[T] += dE
            rows = Q1.sum(axis=1) + E1.sum(axis=1)
            _tpt._require(np.abs(rows - 1).max() < 1e-12, "restored rows must be stochastic")
            direct = op.s0 @ np.linalg.solve(np.eye(op.n) - Q1, E1)
            worst = max(worst, float(np.abs(direct - (op.E0 + op.exit_delta(T, dQ, dE))).max()))
        ok("[%s/%s] single-listing row update == direct dense solve (12 random listings)" % (fr, ini),
           worst < 1e-12, "max |diff| %.1e over %d exit columns" % (worst, op.m))
        T, dQ, dE = op.change(op.listings)
        d = op.exit_delta(T, dQ, dE)
        B1, _r = K1.exit_law()
        law1 = K1.start("standing", "me") @ B1
        E1v = np.zeros(op.m)
        for j, c in enumerate(K1.fin_cols):
            E1v[op.col_idx[c]] = law1[j]
        E1v[op.m - 1] = float(K1.start("standing", "me") @ K1.absorption()[0][:, ID])
        err = float(np.abs(op.E0 + d - E1v).max())
        ok("[%s/%s] restoring all %d listings == origin=False kernel exit law" % (fr, ini, len(op.listings)),
           err < 1e-12 and len(op.listings) >= 1000, "%d rows, max |diff| %.1e" % (len(T), err))
    try:
        res = origin_analysis(graph, "nogi", "symmetric")
        a = res["additivity"]
        good = (res["joint_err"] < 1e-12 and res["pass_err"] < 1e-12 and a["row_identity_O1_max_err"] < 1e-14
                and max(a["attribution_sum_err"].values()) < 1e-12)
        why = ("joint == K1 %.1e, joint passage == K1 %.1e, row identity O1 %.1e, attribution sums A1/A2 %.1e/%.1e"
               % (res["joint_err"], res["pass_err"], a["row_identity_O1_max_err"], a["attribution_sum_err"]["A1"],
                  a["attribution_sum_err"]["A2"]))
        tp = tripod_case(graph, res)
        good_t = tp["direct_vs_update_max_abs"] < 1e-12 and tp["newly_reachable"] == ["spider-guard/bottom", "spider-guard/top"]
        why_t = "direct solve vs row update %.1e; newly reachable %s" % (tp["direct_vs_update_max_abs"], tp["newly_reachable"])
    except AssertionError as e:
        good, why, good_t, why_t = False, str(e), False, "not reached"
    ok("[nogi/symmetric] origin analysis identities (asserted in the analysis itself)", good, why)
    ok("[nogi/symmetric] Tripod Sweep teleport: direct dense solve, reach +spider guard", good_t, why_t)


# --------------------------------------------------------------------------- #
# artifact
# --------------------------------------------------------------------------- #
def compact(res, graph, k_top=15):
    tech = res["techniques"]

    def trow(t, fields):
        return {f: (r6(t[f]) if isinstance(t[f], float) else t[f]) for f in fields}

    base_fields = ["technique", "name", "performer", "plays", "plays_given_W", "plays_given_L",
                   "landed_given_W", "landed_given_L", "grad", "leverage"]
    me = [t for t in tech if t["performer"] == "me"]
    them = [t for t in tech if t["performer"] == "them"]
    both = {}
    for t in tech:
        b = both.setdefault(t["technique"], {"technique": t["technique"], "name": t["name"], "me": 0.0, "them": 0.0})
        b[t["performer"]] += t["grad"]
    both = list(both.values())
    for b in both:
        b["both"] = b["me"] + b["them"]
    ratio_pool = [t for t in tech if t["plays"] >= TRAFFIC_FLOOR and t["W_over_L"] is not None]
    trans = [t for t in ratio_pool if not t["is_submission"]]
    out = {
        "probabilities": {k: r6(v) for k, v in res["probabilities"].items()},
        "coverage": res["coverage"],
        "flux": {},
        "passage_hubs": {c: [[h, _hub_display(graph, h), r6(v)] for v, h in res["passage_hubs"][c][:k_top + 1]]
                         for c in ("W", "L")},
        "passage_roles": {c: [[rn, role_display(graph, rn), r6(v)] for v, rn in res["passage_roles"][c][:k_top]]
                          for c in ("W", "L")},
        "passage_technique_sets": res["passage_technique_sets"],
        "landed_given_W_me_top": [trow(t, base_fields) for t in sorted(me, key=lambda t: (-t["landed_given_W"], t["technique"]))[:k_top]],
        "landed_given_L_them_top": [trow(t, base_fields) for t in sorted(them, key=lambda t: (-t["landed_given_L"], t["technique"]))[:k_top]],
        "traffic_top": [trow(t, base_fields + (["plays_clocked"] if "plays_clocked" in t else []))
                        for t in sorted(tech, key=lambda t: (-t["plays"], t["technique"], t["performer"]))[:k_top]],
        "over_represented_in_W": [trow(t, base_fields + ["W_over_L"]) for t in sorted(trans, key=lambda t: (-t["W_over_L"], t["technique"]))[:k_top]],
        "over_represented_in_L": [trow(t, base_fields + ["W_over_L"]) for t in sorted(trans, key=lambda t: (t["W_over_L"], t["technique"]))[:k_top]],
        "traffic_ratio_floor_plays_per_roll": TRAFFIC_FLOOR,
        "traffic_ratio_pool": {"all": len(ratio_pool), "transitions_only": len(trans)},
        "grad_me_top30": [trow(t, base_fields) for t in sorted(me, key=lambda t: (-t["grad"], t["technique"]))[:30]],
        "grad_me_bottom30": [trow(t, base_fields) for t in sorted(me, key=lambda t: (t["grad"], t["technique"]))[:30]],
        "grad_both_top30": [{k: (r6(v) if isinstance(v, float) else v) for k, v in b.items()}
                            for b in sorted(both, key=lambda b: (-b["both"], b["technique"]))[:30]],
        "grad_both_bottom30": [{k: (r6(v) if isinstance(v, float) else v) for k, v in b.items()}
                               for b in sorted(both, key=lambda b: (b["both"], b["technique"]))[:30]],
        "grad_halves": {"sum_abs_me": r6(sum(abs(b["me"]) for b in both)),
                        "sum_abs_them": r6(sum(abs(b["them"]) for b in both)),
                        "techniques_where_them_dominates": sum(1 for b in both if abs(b["them"]) > abs(b["me"])),
                        "techniques": len(both),
                        "zero_gradient_dealt": sum(1 for b in both if b["both"] == 0.0)},
        "state_leverage_top15": [[s, r6(v)] for v, s in res["state_leverage"][:15]],
        "origin_orphans": {"count": len(res["origin_orphans"]), "techniques": res["origin_orphans"],
                           "note": "never dealt under the origin filter: zero flux, zero traffic, zero gradient "
                                   "BY CONSTRUCTION — absence from a ranking is not evidence they do not matter"},
    }
    for col in ("W", "L"):
        fb = res["flux"][col]
        out["flux"][col] = {
            "probability": r6(fb["probability"]), "scc": fb["scc"],
            "cut_capacity_equals_probability": fb["cut_capacity_equals_probability"],
            "finishing_edge_count": fb["finishing_edge_count"],
            "finishing_edges_top": [[e["state"], e["turn"], r6(e["share"])] for e in fb["finishing_edges"][:k_top]],
            "finishing_hubs_top": [[h, _hub_display(graph, h), r6(v)] for h, v in fb["finishing_hubs"][:k_top]],
            "finisher_set_size": len(fb["finisher_set"]),
            "finisher_set_top": [[t, finisher_display(graph, t), r6(v)] for v, t in fb["finisher_set"][:k_top]],
            "routes": [{"share": r6(r["share"]), "display": r["display"],
                        "hops": [{"from": h["from"], "to": h["to"],
                                  "by": None if h["carried_by"] is None else
                                  [h["carried_by"]["name"], h["carried_by"]["performer"], r6(h["carried_by"]["share_of_hop"])]}
                                 for h in r["hops"]]} for r in fb["routes"]],
            "routes_explained_share": r6(fb["routes_explained_share"]),
            "rivers": [{"from": r["from"], "to": r["to"], "net_share": r6(r["net_share"]),
                        "by": None if r["carried_by"] is None else
                        [r["carried_by"]["name"], r["carried_by"]["performer"], r6(r["carried_by"]["share_of_hop"])]}
                       for r in fb["rivers"]],
            "hub_rivers": [{"from": r["from"], "to": r["to"], "net_share": r6(r["net_share"]),
                            "by": None if r["carried_by"] is None else
                            [r["carried_by"]["name"], r["carried_by"]["performer"], r6(r["carried_by"]["share_of_hop"])]}
                           for r in fb["hub_rivers"]],
            "worst_conservation_residual": fb["worst_conservation_residual"],
        }
    return out


def survival(base_lists, others):
    out = {}
    for name, items in base_lists.items():
        out[name] = []
        for x in items:
            row = {"item": str(x)}
            for cname, lists in others.items():
                row[cname] = x in lists[name]
            out[name].append(row)
    return out


def finisher_display(graph, tid):
    n = graph["submissions"].get(tid + "/attacker") or graph["transitions"].get(tid + "/attacker") or {}
    return n.get("name") or tid


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--full", action="store_true",
                    help="also dump full per-technique / per-listing tables to the scratch directory")
    ap.add_argument("--scratch", default=None,
                    help="scratch directory for --full (default: $%s, else <system temp>/flux-scratch)" % SCRATCH_ENV)
    ap.add_argument("--robust-seeds", type=int, default=100)
    ap.add_argument("--out", default=None)
    ap.add_argument("--origin", action="store_true",
                    help="F3: the origin filter listing by listing -> tests/artifacts/semantics/flux_origin.json")
    a = ap.parse_args(argv)
    scratch = a.scratch or default_scratch()
    if a.origin and not a.selfcheck:
        origin_main(full=a.full, out=a.out or ART_ORIGIN, scratch=scratch)
        return 0
    a.out = a.out or ART
    if a.selfcheck:
        checks = selfcheck()
        return 1 if (len(checks) < 24 or any(not c[1] for c in checks)) else 0

    base = load_kernel("nogi", "symmetric", "shipped")
    graph = base.graph
    art = {"item": "F2R", "lane": "gs-4 EDGES", "recompute": RECOMPUTE, "graph_sha256": graph_sha256(),
           "source_sha256": {f: file_sha256(f) for f in ("scripts/semantics/flux.py", "scripts/semantics/_tpt.py")},
           "which_game": "the corpus's game: both seats sample authored attempt shares; no resistance; "
                         "control positions kept; H = infinity unless a clock is named",
           "start": "standing, me first: K.start('standing', 'me') — the two ROLL_SEEDS, 1/2 each, my turn",
           "configs": {}}
    results, lists = {}, {}
    for name, frame, ini, origin in CONFIGS:
        K = load_kernel(frame, ini, "shipped", graph=graph, origin=origin)
        ctx = Ctx(K)
        print("== %s: %s / %s initiative / origin %s — P(W) %.4f P(L) %.4f P(D) %.4f"
              % (name, frame, ini, "on" if origin else "OFF", ctx.p[IW], ctx.p[IL], ctx.p[ID]))
        res = analyse(ctx)
        results[name] = res
        lists[name] = top_lists(res)
        c = compact(res, graph)
        c["set"] = {"frame": frame, "initiative": ini, "rates": "shipped", "origin_filter": origin,
                    "states": "532 transient (266 role-nodes x turn); flux over the reachable support",
                    "techniques": "keyed by (category, target id); performer me|them"}
        G, _ = gradient(ctx)
        both = G.sum(axis=1)
        order = np.argsort(-both, kind="stable")
        picks = [int(order[int(round(x))]) for x in np.linspace(0, len(order) - 1, 25)]
        fd_rows = []
        for ki in picks:
            fd = fd_gradient(ctx, ki)
            if fd is not None:
                fd_rows.append((ctx.keys[ki], float(both[ki]), fd, abs(fd - both[ki])))
        c["fd_check"] = {"techniques": len(fd_rows), "step": 1e-6, "rule": "|fd - adjoint| <= 1e-6 |adjoint| + 1e-9",
                         "max_abs_err": max(r[3] for r in fd_rows),
                         "max_rel_err_where_abs_grad_ge_1e-4": max((r[3] / abs(r[1]) for r in fd_rows if abs(r[1]) >= 1e-4), default=0.0),
                         "failures": sum(1 for r in fd_rows if r[3] > 1e-6 * abs(r[1]) + 1e-9),
                         "set": "25 techniques at evenly spaced ranks of the both-performer gradient"}
        _tpt._require(c["fd_check"]["failures"] == 0 and len(fd_rows) >= 23, "FD check failed in %s" % name)
        art["configs"][name] = c
        if a.full:
            os.makedirs(scratch, exist_ok=True)
            with open(os.path.join(scratch, "flux-full-%s.json" % name), "w") as fh:
                json.dump({"techniques": [{k: (r6(v) if isinstance(v, float) else v) for k, v in t.items()}
                                          for t in res["techniques"]]}, fh, indent=0, sort_keys=True)
    # clocked me-only gradient vs H=inf (headline)
    Kh = load_kernel("nogi", "symmetric", "shipped", graph=graph)
    ch = Ctx(Kh)
    Ginf, _ = gradient(ch)
    Gclk = np.mean([gradient(ch, H=H)[0] for H in CLOCK], axis=0)
    anyw = gradient(ch, start=Kh.start("anywhere", "me"))[0]
    art["headline_gradient_variants"] = {
        "spearman_me_Hinf_vs_clocked_mixture": spearmanr(Ginf[:, 0], Gclk[:, 0]).correlation,
        "spearman_me_standing_vs_anywhere": spearmanr(Ginf[:, 0], anyw[:, 0]).correlation,
        "clocked_P_W_mixture": float(np.mean([ch.weights([1, 0, 0], H=H)["J"] for H in CLOCK])),
        "set": "my-hand success-rate gradient per technique key (n=%d), nogi/symmetric/origin on" % len(ch.keys)}
    # cross-config agreement on the gradient (joined on technique key)
    agree = {}
    hk = {t["technique"]: t["grad"] for t in results["headline"]["techniques"] if t["performer"] == "me"}
    for name in ("shipped", "gi", "origin_off"):
        ok_ = {t["technique"]: t["grad"] for t in results[name]["techniques"] if t["performer"] == "me"}
        common = sorted(set(hk) & set(ok_))
        agree[name] = {"joined": len(common), "headline_only": len(set(hk) - set(ok_)),
                       "other_only": len(set(ok_) - set(hk)),
                       "spearman_grad_me": spearmanr([hk[k] for k in common], [ok_[k] for k in common]).correlation}
    art["gradient_cross_config"] = agree
    art["survival_of_headline_top10"] = survival(lists["headline"], {k: v for k, v in lists.items() if k != "headline"})
    print("== FLOW bridge")
    with tempfile.TemporaryDirectory(prefix="flux-flow-") as tmp:
        art["flow_bridge"] = {fr: flow_bridge(graph, fr, flow_cli_json(fr, tmp)) for fr in ("nogi", "gi")}
    print("== EDGE bridge")
    art["edge_bridge"] = edge_bridge(graph)
    print("== robustness (%d seeds)" % a.robust_seeds)
    art["robustness_headline"] = robustness(Kh, lists["headline"], list(range(a.robust_seeds)))
    art["monte_carlo_headline"] = monte_carlo(ch, results["headline"])
    art["payload_costs"] = payload_costs(results["headline"])
    art["tpt_selfcheck"] = {"passed": _tpt_quiet(_tpt.selfcheck)["passed"], "recompute": "python3 -B scripts/semantics/_tpt.py --selfcheck"}

    def clean(x):
        if isinstance(x, dict):
            return {str(k): clean(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [clean(v) for v in x]
        if isinstance(x, (np.floating, float)):
            return r6(float(x))
        if isinstance(x, (np.integer,)):
            return int(x)
        if isinstance(x, np.bool_):
            return bool(x)
        return x
    art = clean(art)
    txt = json.dumps(art, indent=1, sort_keys=True, allow_nan=False) + "\n"
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write(txt)
    print("wrote %s (%d bytes)" % (a.out, len(txt)))
    _tpt._require(len(txt) < 1_000_000, "artifact over the 1 MB budget")
    return 0


if __name__ == "__main__":
    sys.exit(main())
