#!/usr/bin/env python3
"""Absorbing reactive currents, per-cell adjoint weights and passage; synthetic methods only.

Conventions and derivation
--------------------------
Q is the transient transition matrix, R the exit matrix, and s0 a probability
distribution on transient states. Every row of [Q R] sums to one, and every
transient state must eventually absorb. Let N=(I-Q)^-1, g^T=s0^T N, and
h=N R[:, target_cols] 1. The current returned here is an UNCONDITIONAL expectation
per launch, E_s0[number of edge traversals * indicator(target exit)]:

    f_ij = g_i Q_ij h_j;       f_i,alpha = g_i R_i,alpha 1{alpha in target}.

Indeed, the Markov property weights each traversal by its destination's chance
of eventually hitting the target. For p=s0^T h>0, the Doob transform on h>0 has
Q^h_ij=Q_ij h_j/h_i, R^h_i,alpha=R_i,alpha 1_target/h_i, and initial law
s0^h_i=s0_i h_i/p. Its expected visits are g^h_i=g_i h_i/p. Multiplying its
conditional traversal counts g^h_i Q^h_ij by p gives f_ij exactly. Thus conditional
counts require division by p; the target inflow in THIS convention is p, not one.
No division by h or p is needed in the implementation, including a zero target.

This is the per-launch, discrete-time absorbing counterpart of TPT current
pi_i q^-_i P_ij q^+_j. To identify the ensembles precisely, add a launch node A0,
reset every exit to A0, and send A0 to s0. Take A={A0, non-target exits}, B={target
exits}. In the reachable regenerative chain q^-=1 in the transient interior,
q^+=h, and pi_i/pi_A0=g_i. Stationary TPT current divided by pi_A0 is therefore f.
Taking A to be the physical starting states instead would discard excursions
that revisit them and would NOT describe the whole winning trajectories here.
Discrete self-transitions count as attempts in gross current; they cancel in net
current. Continuous-time TPT normally excludes self-jumps. References:
Metzner, Schuette & Vanden-Eijnden (2009), eqs. 2.24, 2.33 and sec. 2.7,
https://publications.imp.fu-berlin.de/43/1/MeScVE09.pdf ;
E & Vanden-Eijnden (2006), the reactive-trajectory ensemble,
https://web.math.princeton.edu/~weinan/pdf%20files/theory%20transition.pdf .

Outgoing minus incoming current at transient i is
g_i h_i - h_i (g_i-s0_i) = s0_i h_i. This is an injection, not a conservation
failure at a distributed start. Adding source->i with this mass and each target
exit->sink with its inflow makes every other node interior. Antisymmetrising,
f+_ij=max(f_ij-f_ji,0), preserves divergence. It removes reciprocal flow, not all
directed cycles. Widest-path shares refer to source-to-sink throughput, not to
edge-weight sum or the probabilities of particular stochastic trajectories.

Adjoint and the exact bridge to FLOW / Q / EDGE
-----------------------------------------------
Write h=(I-Q)^-1 r for one exit column. Differentiating (I-Q)h=r gives
dh=(I-Q)^-1(dQ h+dr), hence d(s0^T h)=g^T(dQ h+dr), with ONE transposed solve
for g shared by every parameter. s0 is fixed; a varying start adds (ds0)^T h.
For a dealt action a, let S_a and M_a be its conditional success/miss
distributions over continuations and exits, and let v equal h on continuations
and the target indicator on exits. Holding policy and branch distributions fixed,

    dP_s,* = sum_a pi(a|s) (S_a-M_a) dp_a,
    d h(s0) = sum_s g_s sum_a pi(a|s) (A(s,a)-B(s,a)) dp_a,
    A=S_a v, B=M_a v, Q_action=p_a A+(1-p_a) B.

Q_action denotes action value, distinct from the transition matrix named Q in
this API. This is FLOW's occupancy * pi * (A-B) form. Exactly what differs from
scripts/solve_flow.py: its value is finite-horizon p_win-lambda*p_loss; its adjoint
occupancy is indexed by state, turn AND remaining ply. A stay-put miss propagates
to the opponent at the SAME ply; other continuations consume a ply, and sweep
order matters. Here g counts transient visits until absorption, including such
zero-ply transitions. Flattening their ply costs is legitimate for eventual
absorption, never for a fixed-horizon comparison. No discount is introduced here.
Replacing terminal reward by 1_W-lambda*1_L gives the analogous infinite-horizon
value gradient by grad(W)-lambda*grad(L). Equality with FLOW is only a limit with
matching policy, transitions, start, rate conventions and parameter directions.

FLOW varies deck mastery m: a position deck and a technique deck add to the
PLAYER's success probability, with dp/dm=0 at/outside its clamp. Its opponent's
probabilities stay fixed. Our helper can vary p of a technique in BOTH players'
hands; opponent effects can have the opposite sign. It does not impose FLOW's
clamp, differentiate policy/branch weights, or identify a probability with a deck
bonus. A clamp boundary need not have a two-sided derivative. EDGE subtracts a
state's policy baseline from Q_action; its policy-weighted sum is identically
zero, and is neither occupancy nor sensitivity. All branch values here are
absolute. No graph, Model, kernel, app or corpus is imported by this module.

Per-cell weights and passage (added for F2R)
--------------------------------------------
cell_weights() generalises the adjoint to the kernel's CELL level and to the clocked game:
every card-level derivative, traffic and value is sum_c dmass_c * s_c with ONE weight per
cell, s_c = g(src) v(dst) at H = infinity and sum_m mu_m(src) cont_m(c) under the ply
recursion that solve_edge_values / solve_flow / _kernel.finite_horizon share. With the
kernel's cells, H=11, payoff (1,-2,0), start uniform over live states and the direction
"my cards of deck k inside the clamp", this reproduces solve_flow.adjoint's whole vector
(checked in flux.py, not here). avoid_probabilities() answers the TRAJECTORY question net
current cannot: P(payoff AND the roll ever traverses a set of cells), by killing the set's
mass and applying Woodbury to one dense fundamental matrix.

row_update() (added for F3) is the exact finite-change update for a change confined to a few
rows (a hand restored, a card added): one k x k solve gives the new occupancy on those rows, and
gs-2's Proposition A1 then gives the whole change of s0^T B with zero remainder.

Run every proof and its positive coverage floors:
    python3 -B scripts/semantics/_tpt.py --selfcheck
Optionally write the deterministic receipt:
    python3 -B scripts/semantics/_tpt.py --selfcheck --json tests/artifacts/semantics/flux-selfcheck.json
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import heapq
import json
from pathlib import Path

import networkx as nx
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu


TOL = 2e-10
RECOMPUTE = "python3 -B scripts/semantics/_tpt.py --selfcheck"


@dataclass(frozen=True)
class ReactiveFlux:
    """Physical matrices index transient i, then absorbing n+alpha.

    ``network`` is net current with two auxiliary terminals appended. Use it
    with ``source`` and ``sink`` for distributed starts / multiple target exits.
    ``gross`` and ``net`` contain only physical edges, never artificial edges.
    """

    gross: sparse.csr_matrix
    net: sparse.csr_matrix
    network: sparse.csr_matrix
    source: int
    sink: int
    committor: np.ndarray
    occupancy: np.ndarray
    target_probability: float
    injection: np.ndarray
    target_inflow: np.ndarray
    residuals: dict
    coverage: dict


@dataclass(frozen=True)
class Pathway:
    nodes: tuple[int, ...]
    flux: float
    share: float


@dataclass(frozen=True)
class Pathways:
    paths: tuple[Pathway, ...]
    total_flux: float
    explained_flux: float
    explained_share: float
    residual: sparse.csr_matrix
    stop_reason: str


@dataclass(frozen=True)
class Cut:
    edges: tuple[tuple[int, int, float], ...]
    capacity: float
    total_flux: float
    source_side: tuple[int, ...]
    sink_side: tuple[int, ...]


def _require(condition, message):
    # These gates remain active under python -O.
    if not condition:
        raise AssertionError(message)


def _maxabs(value):
    return float(np.max(np.abs(value), initial=0.0))


def _close(actual, expected, message, tol=TOL):
    error = _maxabs(np.asarray(actual) - np.asarray(expected))
    _require(error <= tol * max(1.0, _maxabs(expected)), f"{message}: residual={error:.3e}")
    return error


def _csr(value, name, shape=None, nonnegative=True):
    try:
        result = sparse.csr_matrix(value, dtype=float, copy=True)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a numeric matrix; null is not zero") from exc
    result.sum_duplicates()
    result.eliminate_zeros()
    result.sort_indices()
    if shape is not None and result.shape != shape:
        raise ValueError(f"{name}: shape {result.shape}, expected {shape}")
    if not np.all(np.isfinite(result.data)):
        raise ValueError(f"{name}: non-finite / null cell; drop absent cells upstream")
    if nonnegative and np.any(result.data < 0):
        raise ValueError(f"{name}: negative mass")
    return result


def _index(value, size, name):
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, (int, np.integer)):
        raise ValueError(f"{name}: an integer index is required")
    value = int(value)
    if not 0 <= value < size:
        raise ValueError(f"{name}: index out of range")
    return value


def _chain(Q, R, s0):
    q = _csr(Q, "Q")
    n = q.shape[0]
    if n < 1 or q.shape != (n, n):
        raise ValueError("Q must be a nonempty square matrix")
    r = _csr(R, "R")
    if r.shape[0] != n or r.shape[1] < 1:
        raise ValueError("R must have one row per transient and at least one exit")
    if isinstance(s0, (int, np.integer)) and not isinstance(s0, (bool, np.bool_)):
        s = np.zeros(n)
        s[_index(s0, n, "s0")] = 1.0
    else:
        s = np.asarray(s0, dtype=float)
        if s.shape != (n,) or not np.all(np.isfinite(s)) or np.any(s < 0):
            raise ValueError("s0 must be a finite nonnegative vector or a state index")
    _close(s.sum(), 1.0, "s0 normalization", tol=2e-12)
    exit_mass = np.asarray(r.sum(axis=1)).ravel()
    _close(np.asarray(q.sum(axis=1)).ravel() + exit_mass, np.ones(n),
           "[Q R] row normalization", tol=2e-12)

    # A finite stochastic chain is transient iff every state can reach an exit.
    # This also rejects closed classes unreachable from s0: no silent subsetting.
    reverse = q.T.tocsr()
    seen = exit_mass > 0
    todo = np.flatnonzero(seen).tolist()
    while todo:
        j = todo.pop()
        for i in reverse.indices[reverse.indptr[j]:reverse.indptr[j + 1]]:
            if not seen[i]:
                seen[i] = True
                todo.append(int(i))
    if not np.all(seen):
        raise ValueError(f"not absorbing: {int(seen.sum())}/{n} states can reach an exit")
    a = sparse.eye(n, format="csc") - q.tocsc()
    return q, r, s.copy(), a, splu(a)


def _solve_hg(a, factor, r_target, s, committor=None, occupancy=None):
    h = factor.solve(r_target) if committor is None else np.asarray(committor, dtype=float)
    g = factor.solve(s, trans="T") if occupancy is None else np.asarray(occupancy, dtype=float)
    _require(h.shape == g.shape == s.shape, "supplied committor/occupancy shape")
    _close(a @ h, r_target, "committor solve")
    _close(a.T @ g, s, "occupancy solve")
    _require(np.all(np.isfinite(h)) and np.all(np.isfinite(g)), "non-finite solve")
    _require(np.min(h) >= -TOL and np.max(h) <= 1 + TOL, "committor outside [0,1]")
    _require(np.min(g) >= -TOL, "negative occupancy")
    # Only eliminate solver roundoff after the bounds and equations were checked.
    return np.clip(h, 0.0, 1.0), np.maximum(g, 0.0)


def _divergence(flow):
    return np.asarray(flow.sum(axis=1)).ravel() - np.asarray(flow.sum(axis=0)).ravel()


def reactive_flux(Q, R, s0, target_cols, *, committor=None, occupancy=None):
    """Return gross/net expected traversals weighted by the selected exit event.

    Q/R may be dense or sparse. s0 is an integer transient index or a normalized
    vector. target_cols is a nonempty collection of distinct R-column indices.
    The result's auxiliary network is convenient for ``dominant_pathways`` and
    ``min_cut``. An unreachable target returns a checked zero current; pathways
    and cuts refuse zero throughput rather than report an empty successful run.
    Optional precomputed committor/occupancy are equation-checked and permit a
    shared-kernel caller to reuse one adjoint solve for several target events.
    """
    q, r, s, a, factor = _chain(Q, R, s0)
    n, m = r.shape
    cols = tuple(sorted(_index(c, m, "target_cols") for c in target_cols))
    if not cols or len(set(cols)) != len(cols):
        raise ValueError("target_cols must be nonempty with no duplicates")
    selector = np.zeros(m)
    selector[list(cols)] = 1.0
    h, g = _solve_hg(a, factor, np.asarray(r @ selector).ravel(), s, committor, occupancy)
    p = float(s @ h)
    transient = sparse.diags(g) @ q @ sparse.diags(h)
    exits = sparse.diags(g) @ r @ sparse.diags(selector)
    gross = sparse.vstack((sparse.hstack((transient, exits)),
                           sparse.csr_matrix((m, n + m))), format="csr")
    gross.eliminate_zeros()
    net = gross - gross.T
    net.data = np.maximum(net.data, 0.0)
    net.eliminate_zeros()
    injection = s * h
    inflow = np.asarray(exits.sum(axis=0)).ravel()
    expected = np.concatenate((injection, -inflow))
    gross_res = _close(_divergence(gross), expected, "gross Kirchhoff")
    net_res = _close(_divergence(net), expected, "net Kirchhoff")
    target_res = _close(inflow.sum(), p, "target inflow equals P(target | s0)")
    _close(injection.sum(), p, "target-weighted source injection")

    source, sink = n + m, n + m + 1
    coo = net.tocoo()
    ii, aa = np.flatnonzero(injection), np.flatnonzero(inflow)
    network = sparse.csr_matrix((
        np.concatenate((coo.data, injection[ii], inflow[aa])),
        (np.concatenate((coo.row, np.full(ii.size, source), n + aa)),
         np.concatenate((coo.col, ii, np.full(aa.size, sink))))),
        shape=(n + m + 2, n + m + 2))
    boundary = np.zeros(n + m + 2)
    boundary[source], boundary[sink] = p, -p
    augmented_res = _close(_divergence(network), boundary, "all augmented interior nodes")
    coverage = {"transient_states": n, "absorbing_columns": m,
                "input_edges": q.nnz + r.nnz, "start_states": int(np.count_nonzero(s)),
                "target_columns": len(cols), "gross_edges": gross.nnz,
                "net_edges": net.nnz, "interior_nodes_checked": n + m}
    _require(coverage["input_edges"] >= n, "input-edge coverage floor")
    residuals = {"gross_kirchhoff": gross_res, "net_kirchhoff": net_res,
                 "target_inflow": target_res, "augmented_kirchhoff": augmented_res}
    print(f"reactive_flux: supplied transient states={n} (floor=1), input edges={q.nnz+r.nnz} "
          f"(floor={n}), interior nodes checked={n+m}; target probability={p:.12g}; "
          f"worst conservation residual={max(residuals.values()):.3e}"
          + ("; ZERO TARGET (computed, not skipped)" if p == 0 else ""))
    return ReactiveFlux(gross, net.tocsr(), network, source, sink, h, g, p,
                        injection, inflow, residuals, coverage)


def _flow_network(f_net, source, sink):
    f = _csr(f_net, "f_net")
    n = f.shape[0]
    if f.shape != (n, n) or n < 2:
        raise ValueError("f_net must be square with distinct terminals")
    source, sink = _index(source, n, "source"), _index(sink, n, "sink")
    if source == sink:
        raise ValueError("source and sink must differ")
    if np.any(f.diagonal()) or f.multiply(f.T).nnz:
        raise ValueError("f_net must have self-flow and reciprocal flow cancelled")
    incoming = np.asarray(f.sum(axis=0)).ravel()
    outgoing = np.asarray(f.sum(axis=1)).ravel()
    if outgoing[sink] != 0:
        raise ValueError("sink must be absorbing (ReactiveFlux.network supplies a pure sink)")
    # A physical starting state may be revisited by reactive cycles. Its NET
    # injection, not its gross outgoing traffic, is the throughput to decompose.
    total = float(outgoing[source] - incoming[source])
    if total <= 0:
        raise ValueError("zero reactive throughput; no positive path/cut coverage")
    expected = np.zeros(n)
    expected[source], expected[sink] = total, -total
    _close(outgoing - incoming, expected, "input net-flow conservation")
    graph = nx.DiGraph()
    graph.add_nodes_from(range(n))
    coo = f.tocoo()
    for i, j, value in zip(coo.row, coo.col, coo.data):
        graph.add_edge(int(i), int(j), capacity=float(value))
    return f, graph, source, sink, total


def _widest(adjacency, source, sink, n):
    """Max-min Dijkstra; sorted nodes/edges give repeatable ties and simple paths."""
    widths = np.zeros(n)
    widths[source] = np.inf
    parent = np.full(n, -1, dtype=int)
    done = np.zeros(n, dtype=bool)
    queue = [(-np.inf, source)]
    while queue:
        negative_width, i = heapq.heappop(queue)
        if done[i]:
            continue
        done[i] = True
        if i == sink:
            nodes = [sink]
            while nodes[-1] != source:
                nodes.append(int(parent[nodes[-1]]))
            return tuple(reversed(nodes)), float(-negative_width)
        for j in sorted(adjacency[i]):
            candidate = min(-negative_width, adjacency[i][j])
            if not done[j] and candidate > widths[j]:
                widths[j], parent[j] = candidate, i
                heapq.heappush(queue, (-candidate, j))
    return (), 0.0


def dominant_pathways(f_net, source, sink, cover=0.9, kmax=50):
    """Greedily subtract widest-path bottlenecks; shares use ORIGINAL throughput.

    This is a deterministic flow decomposition, not a unique trajectory ranking.
    Whole bottlenecks are subtracted, so achieved coverage may exceed ``cover``.
    At kmax the receipt states the achieved fraction; residual circulation is
    retained even after all source-to-sink throughput has been explained.
    """
    if not np.isfinite(cover) or not 0 < cover <= 1:
        raise ValueError("cover must lie in (0,1]")
    if isinstance(kmax, bool) or not isinstance(kmax, (int, np.integer)) or kmax < 1:
        raise ValueError("kmax must be a positive integer")
    f, graph, source, sink, total = _flow_network(f_net, source, sink)
    adjacency = {i: {j: data["capacity"] for j, data in graph[i].items()} for i in graph}
    paths, explained = [], 0.0
    stop = "kmax"
    for _ in range(kmax):
        nodes, bottleneck = _widest(adjacency, source, sink, f.shape[0])
        if not nodes:
            _close(explained, total, "no path before full throughput was explained")
            stop = "exhausted"
            break
        for i, j in zip(nodes, nodes[1:]):
            adjacency[i][j] -= bottleneck
            if adjacency[i][j] == 0:
                del adjacency[i][j]
        explained += bottleneck
        paths.append(Pathway(nodes, bottleneck, bottleneck / total))
        if explained / total >= cover - 1e-12:
            stop = "cover"
            break
    rows, cols, values = [], [], []
    for i in sorted(adjacency):
        for j in sorted(adjacency[i]):
            rows.append(i)
            cols.append(j)
            values.append(adjacency[i][j])
    residual = sparse.csr_matrix((values, (rows, cols)), shape=f.shape)
    expected = np.zeros(f.shape[0])
    expected[source], expected[sink] = total - explained, explained - total
    _close(_divergence(residual), expected, "residual pathway flow")
    _require(len(paths) >= 1, "path coverage floor=1")
    _require(explained <= total * (1 + TOL), "path shares exceed total current")
    print(f"dominant_pathways: supplied net edges={f.nnz} (floor=1), extracted paths={len(paths)} "
          f"(floor=1), throughput share={explained/total:.12g}, stop={stop}")
    return Pathways(tuple(paths), total, explained, explained / total, residual, stop)


def min_cut(f_net, source, sink, *, protected_edges=()):
    """Return a minimum cut, preferring fewer edges among equal-capacity cuts.

    The supplied net flow itself is feasible, and the absorbing-sink cut has
    its total capacity. Max-flow/min-cut therefore equals total reactive throughput.
    This identity alone does NOT establish a unique physical choke point: many
    cuts can tie, especially in a DAG. A second, integer-capacity min-cut on the
    maximum-flow residual closure selects the fewest ORIGINAL edges among exact
    minimizers. Positive residual arcs receive a prohibitive capacity; no epsilon
    is added to the original capacities. Remaining ties follow sorted node/edge
    insertion order with NetworkX Edmonds-Karp. Auxiliary terminal edges can win
    a tie; callers must not label those physical bottlenecks. ``protected_edges``
    can forbid auxiliary launch/collection edges in the tie-breaking closure.
    At least one original minimum cut must remain admissible, otherwise fail;
    this never relaxes the total-throughput identity or changes capacities.

    FLOATING POINT: Edmonds-Karp on non-dyadic capacities leaves residues of order 1e-16 on
    SATURATED edges (measured on the real kernel: 3 arcs, max 3.6e-16). Compared to exactly 0 they
    read as open residual arcs and forbid every true minimum cut. A residual arc therefore counts
    only above RTOL * total throughput (RTOL = 1e-12), far above the residue, far below any
    capacity that matters for a choke point.
    """
    f, graph, source, sink, total = _flow_network(f_net, source, sink)
    residual = nx.algorithms.flow.edmonds_karp(graph, source, sink, capacity="capacity")
    _close(residual.graph["flow_value"], total, "max-flow equals reactive throughput")
    open_tol = 1e-12 * total
    tie_graph = nx.DiGraph()
    tie_graph.add_nodes_from(graph)
    for i, j in sorted(graph.edges):
        tie_graph.add_edge(i, j, capacity=1)
    big = graph.number_of_edges() + 1
    for i, j, data in sorted(residual.edges(data=True)):
        if data["capacity"] - data["flow"] > open_tol:
            previous = tie_graph.get_edge_data(i, j, {}).get("capacity", 0)
            tie_graph.add_edge(i, j, capacity=previous + big)
    protected = tuple(sorted(set(protected_edges)))
    for i, j in protected:
        _require(graph.has_edge(i, j), "protected edge must exist")
        previous = tie_graph.get_edge_data(i, j, {}).get("capacity", 0)
        tie_graph.add_edge(i, j, capacity=previous + big)
    _, (left, right) = nx.minimum_cut(tie_graph, source, sink, capacity="capacity",
                                    flow_func=nx.algorithms.flow.edmonds_karp)
    _require(all(not (i in left and j in right) for i, j, data in residual.edges(data=True)
                 if data["capacity"] - data["flow"] > open_tol), "tie-break cut crosses a residual arc")
    _require(all(not (i in left and j in right) for i, j in protected),
             "no minimum cut avoids every protected edge")
    edges = tuple((i, j, graph[i][j]["capacity"]) for i, j in sorted(graph.edges)
                  if i in left and j in right)
    capacity = float(sum(w for _, _, w in edges))
    _require(len(edges) >= 1, "cut edge coverage floor=1")
    _close(capacity, total, "min-cut capacity equals total reactive flux")
    print(f"min_cut: supplied net edges={f.nnz} (floor=1), cut edges={len(edges)} "
          f"(floor=1), capacity={capacity:.12g}, residual={abs(capacity-total):.3e}")
    return Cut(edges, capacity, total, tuple(sorted(left)), tuple(sorted(right)))


def committor_gradient(Q, R, s0, col, dQ_list, dR_list, *, committor=None, occupancy=None):
    """All directional derivatives, with one forward and ONE adjoint solve.

    Directions may be sparse or dense and must be finite with the original
    shapes. Arbitrary algebraic directions are accepted; the caller is
    responsible for stochastic tangency and feasible probabilities if claiming
    a two-sided Markov-chain derivative. The success-rate helper ensures row
    mass conservation. No inverse, per-parameter solve or finite difference is
    used here; finite differences belong to the independent selfcheck. Supplied
    committor/occupancy are equation-checked and avoid repeating those solves.
    """
    q, r, s, a, factor = _chain(Q, R, s0)
    col = _index(col, r.shape[1], "col")
    dqs, drs = list(dQ_list), list(dR_list)
    if len(dqs) != len(drs) or not dqs:
        raise ValueError("matched, nonempty dQ_list and dR_list are required")
    h, g = _solve_hg(a, factor, r[:, col].toarray().ravel(), s, committor, occupancy)
    grad = np.empty(len(dqs))
    entries = 0
    for k, (dq, dr) in enumerate(zip(dqs, drs)):
        dq = _csr(dq, f"dQ[{k}]", q.shape, nonnegative=False)
        dr = _csr(dr, f"dR[{k}]", r.shape, nonnegative=False)
        entries += dq.nnz + dr.nnz
        grad[k] = float(g @ (dq @ h + dr[:, col].toarray().ravel()))
    _require(np.all(np.isfinite(grad)), "non-finite gradient")
    print(f"committor_gradient: supplied transient states={q.shape[0]} (floor=1), "
          f"directions={len(grad)} (floor=1), signed entries examined={entries}; "
          f"committor solves={int(committor is None)}, adjoint solves={int(occupancy is None)} "
          "(supplied solutions are checked)")
    return grad


def success_rate_direction(n_transient, n_absorbing, records, *, verbose=True):
    """Build (dQ, dR) for raising one card's p wherever its records occur.

    Each record is (row, success_cells, miss_cells); each cell is (dst, weight).
    dst>=0 denotes a transient; dst=-1-alpha denotes absorbing column alpha,
    matching the kernel's destination convention. weight MUST be
    pi(action|row) * conditional_branch_probability, so each branch sums to the
    SAME authored attempt share. It is NOT the kernel cell's joint mass pi*p*w
    or pi*(1-p)*w. Recover conditional branches upstream; division by p at p=0
    (or by 1-p at p=1) cannot recover a missing branch. No graph adapter lives
    here. Include records from both turn layers for a both-player parameter.

    Repeated rows/destinations add. Null weights denote absent cells: dropped
    and counted, never converted to zero. Missing/unequal complete branches fail;
    no normalization or invented probability is supplied. Zero-share records
    are counted, but at least one positive-share record is required. An exactly
    zero direction from identical branches is valid and explicitly reported.
    """
    for size in (n_transient, n_absorbing):
        if isinstance(size, bool) or not isinstance(size, (int, np.integer)) or size < 1:
            raise ValueError("positive integer transient/absorbing dimensions required")
    qr, qc, qv, rr, rc, rv = [], [], [], [], [], []
    count = cells = dropped = positive = 0
    rows_seen = set()
    for row, success, miss in records:
        row = _index(row, n_transient, "record row")
        rows_seen.add(row)
        count += 1
        totals = []
        for sign, branch in ((1.0, success), (-1.0, miss)):
            total = 0.0
            for dst, weight in branch:
                cells += 1
                if weight is None:
                    dropped += 1
                    continue
                weight = float(weight)
                if not np.isfinite(weight) or weight < 0:
                    raise ValueError("branch weight must be finite and nonnegative")
                if isinstance(dst, (bool, np.bool_)) or not isinstance(dst, (int, np.integer)):
                    raise ValueError("branch destination must be an integer")
                if dst >= 0:
                    qr.append(row)
                    qc.append(_index(dst, n_transient, "branch destination"))
                    qv.append(sign * weight)
                else:
                    rr.append(row)
                    rc.append(_index(-1 - dst, n_absorbing, "branch exit"))
                    rv.append(sign * weight)
                total += weight
            totals.append(total)
        _close(totals[0], totals[1], "success/miss attempt-share equality", tol=2e-12)
        if totals[0] > 1 + 2e-12:
            raise ValueError("record attempt share exceeds one")
        positive += int(totals[0] > 0)
    _require(count >= 1 and positive >= 1 and cells >= 2, "positive branch-record coverage floor")
    dq = sparse.csr_matrix((qv, (qr, qc)), shape=(n_transient, n_transient))
    dr = sparse.csr_matrix((rv, (rr, rc)), shape=(n_transient, n_absorbing))
    dq.eliminate_zeros()
    dr.eliminate_zeros()
    _close(np.asarray(dq.sum(axis=1)).ravel() + np.asarray(dr.sum(axis=1)).ravel(),
           np.zeros(n_transient), "success-rate tangent row sums", tol=2e-12)
    if verbose:
        print(f"success_rate_direction: supplied records={count} (floor=1), positive-share records="
              f"{positive} (floor=1), states={len(rows_seen)}, branch cells examined={cells} "
              f"(floor=2), dropped nulls={dropped}, signed entries={dq.nnz+dr.nnz}")
    return dq, dr


def _cells(n_transient, n_absorbing, src, dst, plies, mass):
    src = np.asarray(src, dtype=np.int64)
    dst = np.asarray(dst, dtype=np.int64)
    plies = np.asarray(plies, dtype=np.int64)
    mass = np.asarray(mass, dtype=float)
    _require(src.shape == dst.shape == plies.shape == mass.shape and src.ndim == 1 and src.size,
             "cells: src/dst/plies/mass must be equal-length nonempty vectors")
    _require(np.all(np.isfinite(mass)) and np.all(mass >= 0), "cells: finite nonnegative mass; null is not zero")
    _require(np.all((src >= 0) & (src < n_transient)), "cells: src out of range")
    _require(np.all((dst < n_transient) & (dst >= -n_absorbing)), "cells: dst out of range")
    _require(np.all((plies == 0) | (plies == 1)), "cells: plies must be 0 or 1")
    _require(not np.any((plies == 0) & (dst < 0)), "cells: an exit cell cannot be a 0-ply cell")
    tr = dst >= 0
    shape = (n_transient, n_transient)
    q0 = sparse.csr_matrix((mass[tr & (plies == 0)], (src[tr & (plies == 0)], dst[tr & (plies == 0)])), shape=shape)
    q1 = sparse.csr_matrix((mass[tr & (plies == 1)], (src[tr & (plies == 1)], dst[tr & (plies == 1)])), shape=shape)
    r = sparse.csr_matrix((mass[~tr], (src[~tr], -1 - dst[~tr])), shape=(n_transient, n_absorbing))
    _close(np.asarray((q0 + q1).sum(axis=1)).ravel() + np.asarray(r.sum(axis=1)).ravel(),
           np.ones(n_transient), "cells: every transient row sums to one", tol=2e-12)
    _require((q0 @ q0).nnz == 0 or _maxabs((q0 @ q0).data) == 0,
             "cells: two chained 0-ply cells would make a horizon-free loop")
    return src, dst, plies, mass, tr, q0.tocsr(), q1.tocsr(), r.tocsr()


def cell_weights(n_transient, n_absorbing, src, dst, plies, mass, s0, payoff, H=None):
    """Per-CELL sensitivity weights: every card-level quantity is a sum over cells.

    A cell c is (src transient, dst transient or -1-alpha exit, plies 0|1, mass). Q0/Q1/R are
    the cell sums split by plies. The objective is J = s0^T V with terminal payoff u (one
    number per exit column), under either game:

      H=None  eventual (H = infinity): v = N R u on transients, u on exits, N = (I-Q)^-1,
              g^T = s0^T N (expected visits), and  s_c = g(src_c) * v(dst_c).
      H=int   the clocked ply recursion  V_m = (I+Q0)(R u + Q1 V_{m-1}),  V_0 = 0
              (solve_edge_values.solve / solve_flow.backward / _kernel.finite_horizon), with
              arrivals a_H = s0, mu_m^T = a_m^T (I+Q0) (the mass that PLAYS a card with m plies
              left), a_{m-1}^T = mu_m^T Q1, and
                  s_c = sum_{m=1..H} mu_m(src_c) * cont_m(c),
              cont_m = V_{m-1}(dst) for a 1-ply transient cell, V_m(dst) for a 0-ply cell
              (the stay-put rule reads the SAME horizon), u(alpha) for an exit cell.

    PROPOSITION (proved in the lane file, checked in the selfcheck): for ANY direction dmass
    that keeps every row sum fixed, dJ = sum_c dmass_c * s_c. And two traffic identities hold
    with the SAME weights: E[#plays of cells in a set C AND payoff] = sum_{c in C} mass_c s_c
    for an indicator payoff, and J = sum over exit cells of mass_c * s_c (asserted here).
    Returns dict(weights, J, occupancy (g, or sum_m mu_m), value (v on transients, or V_H)).
    """
    src, dst, plies, mass, tr, q0, q1, r = _cells(n_transient, n_absorbing, src, dst, plies, mass)
    s = np.asarray(s0, dtype=float)
    _require(s.shape == (n_transient,) and np.all(s >= 0) and np.all(np.isfinite(s)), "s0 shape/sign")
    u = np.asarray(payoff, dtype=float)
    _require(u.shape == (n_absorbing,) and np.all(np.isfinite(u)), "payoff: one finite number per exit")
    ru = r @ u
    term = np.zeros(src.size)
    term[~tr] = u[-1 - dst[~tr]]
    safe = np.where(tr, dst, 0)
    if H is None:
        a = sparse.eye(n_transient, format="csc") - (q0 + q1).tocsc()
        lu = splu(a)
        v = lu.solve(ru)
        g = lu.solve(s, trans="T")
        _close(a @ v, ru, "cell_weights value solve")
        _close(a.T @ g, s, "cell_weights occupancy solve")
        weights = g[src] * np.where(tr, v[safe], term)
        value, occupancy, J = v, g, float(s @ v)
    else:
        _require(isinstance(H, (int, np.integer)) and not isinstance(H, bool) and H >= 1, "H must be a positive integer")
        V = [np.zeros(n_transient)]
        for _ in range(H):
            y = ru + q1 @ V[-1]
            V.append(y + q0 @ y)
        arrivals = s.copy()
        weights = np.zeros(src.size)
        occupancy = np.zeros(n_transient)
        for m in range(H, 0, -1):
            mu = arrivals + q0.T @ arrivals
            occupancy += mu
            cont = np.where(tr, np.where(plies == 0, V[m][safe], V[m - 1][safe]), term)
            weights += mu[src] * cont
            arrivals = q1.T @ mu
        value, J = V[H], float(s @ V[H])
    exit_sum = float(np.sum(mass[~tr] * weights[~tr]))
    _close(exit_sum, J, "J equals the payoff-weighted exit traffic")
    return {"weights": weights, "J": J, "occupancy": occupancy, "value": value}


def avoid_probabilities(Q, R, s0, payoff, kills, *, fundamental=None):
    """J_k = E_s0[payoff at exit, on the event that NONE of kill set k's mass is ever traversed].

    Each kill is (dQ_k, dR_k): nonnegative sparse masses, elementwise <= Q and R, that are
    redirected to an unrewarded 'marked' exit. Then P(payoff AND the roll passes through set k)
    = J - J_k: the exact PASSAGE probability (a trajectory statement, unlike net current).
    Computed by Woodbury on the dense fundamental matrix N = (I-Q)^-1 (n <= a few thousand):
    only the k rows a kill touches enter, so thousands of sets cost one inverse. `s0` may be
    unnormalised (callers exclude start mass that is already inside a set). Returns (J, J_k[]).
    """
    q = _csr(Q, "Q")
    r = _csr(R, "R")
    n = q.shape[0]
    _require(q.shape == (n, n) and r.shape[0] == n, "avoid_probabilities: shapes")
    s = np.asarray(s0, dtype=float)
    _require(s.shape == (n,) and np.all(s >= 0) and s.sum() <= 1 + 1e-12, "avoid_probabilities: s0")
    u = np.asarray(payoff, dtype=float)
    _require(u.shape == (r.shape[1],), "avoid_probabilities: payoff")
    N = fundamental if fundamental is not None else np.linalg.inv(np.eye(n) - q.toarray())
    probe = np.linspace(1.0, 2.0, n)                         # O(n^2) check of a supplied inverse
    Np = N @ probe
    _close(Np - q @ Np, probe, "fundamental matrix", tol=1e-9)
    ru = np.asarray(r @ u).ravel()
    v = N @ ru
    g = N.T @ s
    J = float(s @ v)
    out = np.empty(len(kills))
    touched_total = 0
    for k, (dq, dr) in enumerate(kills):
        # light validation (thousands of kill sets): csr, shape, finite, nonnegative, and within
        # Q / R on the touched rows only — the full _csr pass per set dominated the run time
        dq = sparse.csr_matrix(dq, dtype=float)
        dr = sparse.csr_matrix(dr, dtype=float)
        _require(dq.shape == (n, n) and dr.shape == r.shape, f"kill {k}: shape")
        _require(np.all(np.isfinite(dq.data)) and np.all(dq.data >= 0) and np.all(np.isfinite(dr.data))
                 and np.all(dr.data >= 0), f"kill {k}: finite nonnegative masses; null is not zero")
        rows = np.union1d(np.unique(dq.tocoo().row), np.unique(dr.tocoo().row)).astype(int)
        _require(rows.size >= 1, f"kill {k} touches no row: an empty set is not a passage question")
        Vt = dq[rows].toarray()                               # k x n
        Er = dr[rows].toarray()
        _require(np.min(q[rows].toarray() - Vt) >= -1e-15 and np.min(r[rows].toarray() - Er) >= -1e-15,
                 f"kill {k} exceeds Q or R")
        touched_total += rows.size
        e = Er @ u                                            # killed payoff mass per touched row
        NU = N[:, rows]                                       # n x k
        Nb = v - NU @ e
        cap = np.eye(rows.size) + Vt @ NU
        rhs = Vt @ Nb
        sol = rhs / cap[0, 0] if rows.size == 1 else np.linalg.solve(cap, rhs)
        out[k] = float(s @ Nb - g[rows] @ sol)
    print(f"avoid_probabilities: kill sets={len(kills)} (floor=1), touched rows={touched_total}, "
          f"J={J:.12g}")
    _require(len(kills) >= 1, "avoid_probabilities: kill-set coverage floor=1")
    return J, out


def row_update(N0, g0, rows, dQ_rows, M_rows):
    """EXACT effect on s0^T B of replacing the rows `rows` of a chain (no linearisation).

    Chain 0 has fundamental matrix N0 = (I - Q0)^-1 and occupancy g0^T = s0^T N0. Chain 1 differs
    only on the k rows T = `rows`: Q1 = Q0 + dQ (dQ_rows = dQ[T, :], k x n) and exits R1 = R0 + dR.
    For any payoff matrix, with b0 = N0 R0 G (the old values) and M_rows = (dR G + dQ b0)[T, :]:

        LEMMA (row-supported resolvent).  g1[T]^T (I - dQ[T,:] N0[:,T]) = g0[T]^T,
        hence   s0^T (b1 - b0) = g1[T]^T M_rows          (gs-2 Proposition A1 at s0).

    Proof: g1^T (I - Q0 - dQ) = s0^T gives g1^T = g0^T + g1^T dQ N0 = g0^T + g1[T]^T dQ[T,:] N0,
    because dQ has no rows outside T; restrict to the columns T. The k x k matrix is invertible
    whenever chain 1 absorbs (det(I - Q1) = det(I - Q0) det(I - dQ[T,:] N0[:,T])). Proposition A1
    (b1 - b0 = N1 [dR G + dQ b0]) multiplied by s0^T needs only g1 on the rows the bracket lives on.
    Returns (g1[T], s0^T (b1 - b0)). Cost: one k x k solve, whatever the size of the change.
    """
    rows = np.asarray(rows, dtype=int)
    k = rows.size
    _require(k >= 1 and len(set(rows.tolist())) == k, "row_update: distinct rows, at least one")
    dq = np.asarray(dQ_rows, dtype=float).reshape(k, -1)
    M = np.asarray(M_rows, dtype=float).reshape(k, -1)
    C = dq @ N0[:, rows]
    A = np.eye(k) - C
    g1T = np.linalg.solve(A.T, g0[rows])
    _close(A.T @ g1T, g0[rows], "row_update k x k solve")
    return g1T, g1T @ M


def _proof_row_update():
    """row_update vs a direct dense solve of the changed chain, many random multi-row changes."""
    q, r, s = _random_chain()
    n, m = r.shape
    rng = np.random.default_rng(6607)
    N0 = np.linalg.inv(np.eye(n) - q)
    g0 = N0.T @ s
    B0 = N0 @ r
    worst, cases = 0.0, 0
    for k in (1, 2, 3, 5, 8):
        for _ in range(6):
            rows = rng.choice(n, size=k, replace=False)
            q1, r1 = q.copy(), r.copy()
            for t in rows:                              # replace the whole row by a new stochastic row
                cont = rng.uniform(.3, .9)
                dest = rng.choice(n, size=6, replace=False)
                q1[t] = 0.0
                q1[t, dest] = cont * rng.dirichlet(np.ones(6))
                r1[t] = (1 - cont) * rng.dirichlet(np.ones(m))
            dQ, dR = (q1 - q)[rows], (r1 - r)[rows]
            _g1T, delta = row_update(N0, g0, rows, dQ, dR + dQ @ B0)
            direct = s @ np.linalg.solve(np.eye(n) - q1, r1) - s @ B0
            worst = max(worst, _maxabs(delta - direct))
            cases += 1
    _require(cases >= 25 and worst < 1e-12, f"row_update: {cases} cases, worst {worst:.2e}")
    return {"set": "seed=6607 whole-row replacements (k in 1,2,3,5,8 rows) on the seed=41309 30-state chain, all 3 exit columns",
            "coverage": {"changes": cases, "floor": 25}, "max_abs_error_vs_direct_solve": worst}


def _proof_cell_weights():
    """Clocked and eventual per-cell weights vs brute force and finite differences."""
    rng = np.random.default_rng(5501)
    n, m = 6, 3
    cells = []
    for i in range(n):
        k = rng.integers(3, 6)
        w = rng.dirichlet(np.ones(k))
        for j in range(k):
            if j == 0 and i < 3:                               # a 0-ply cell: MY row -> THEIR row
                cells.append((i, 3 + (i + 1) % 3, 0, w[j]))
            elif rng.random() < .3:
                cells.append((i, -1 - int(rng.integers(0, m)), 1, w[j]))
            else:
                cells.append((i, int(rng.integers(0, n)), 1, w[j]))
    src, dst, plies, mass = (np.array(x) for x in zip(*cells))
    s = rng.dirichlet(np.ones(n))
    u = np.array([1.0, -2.0, 0.0])
    # brute force of the clocked value: explicit recursion on dense matrices
    _, _, _, _, tr, q0, q1, r = _cells(n, m, src, dst, plies, mass)
    worst_fd = worst_lim = 0.0
    fd_checked = 0
    for H in (1, 3, 7, None):
        base = cell_weights(n, m, src, dst, plies, mass, s, u, H)
        for _ in range(8):
            row = int(rng.integers(0, n))
            idx = np.flatnonzero(src == row)
            if idx.size < 2:
                continue
            a, b = rng.choice(idx, size=2, replace=False)
            d = np.zeros(src.size)
            d[a], d[b] = 1.0, -1.0
            eps = min(1e-6, mass[b] / 4)
            vals = []
            for sign in (-1, 1):
                vals.append(cell_weights(n, m, src, dst, plies, mass + sign * eps * d, s, u, H)["J"])
            fd = (vals[1] - vals[0]) / (2 * eps)
            an = float(d @ base["weights"])
            worst_fd = max(worst_fd, abs(fd - an) / max(abs(fd), abs(an), 1e-9))
            fd_checked += 1
    long = cell_weights(n, m, src, dst, plies, mass, s, u, 400)
    inf = cell_weights(n, m, src, dst, plies, mass, s, u, None)
    worst_lim = max(_maxabs(long["weights"] - inf["weights"]), abs(long["J"] - inf["J"]))
    _require(fd_checked >= 20 and worst_fd < 1e-6, f"cell-weight FD: {fd_checked} checks, worst {worst_fd:.2e}")
    _require(worst_lim < 1e-10, f"H=400 weights must converge to the eventual weights ({worst_lim:.2e})")
    # traffic identity by seeded Monte Carlo: E[#traversals of cell c AND exit 0]
    w0 = cell_weights(n, m, src, dst, plies, mass, s, np.array([1.0, 0, 0]), None)
    prng = np.random.default_rng(20260924)
    trials = 100000
    order = np.argsort(src, kind="stable")
    starts = np.searchsorted(src[order], np.arange(n))
    ends = np.searchsorted(src[order], np.arange(n), side="right")
    cdfs = [np.cumsum(mass[order[starts[i]:ends[i]]]) for i in range(n)]
    counts = np.zeros((trials, src.size), dtype=np.int16)
    state = prng.choice(n, size=trials, p=s)
    active = np.arange(trials)
    won = np.zeros(trials, dtype=bool)
    while active.size:
        u01 = prng.random(active.size)
        pick = np.empty(active.size, dtype=np.int64)
        for i in range(n):
            sel = state[active] == i
            if sel.any():
                pos = np.minimum(np.searchsorted(cdfs[i], u01[sel] * cdfs[i][-1], side="right"), cdfs[i].size - 1)
                pick[sel] = order[starts[i] + pos]
        counts[active, pick] += 1
        d = dst[pick]
        won[active[d == -1]] = True
        keep = d >= 0
        state[active[keep]] = d[keep]
        active = active[keep]
    counts[~won] = 0
    mean, se = counts.mean(axis=0), counts.std(axis=0, ddof=1) / np.sqrt(trials)
    expected = mass * w0["weights"]
    ok = se > 0
    z = float(np.max(np.abs(mean[ok] - expected[ok]) / se[ok]))
    _require(int(ok.sum()) >= 15 and z <= 4.0, f"cell traffic MC: {int(ok.sum())} cells, max z {z:.2f}")
    return {"set": "seed=5501 six-transient chain with 0-ply MY->THEIR cells, payoff (1,-2,0); H in 1,3,7,inf",
            "coverage": {"fd_directions": fd_checked, "floor": 20, "mc_cells": int(ok.sum()), "mc_floor": 15,
                         "mc_trials": trials},
            "max_relative_fd_error": worst_fd, "H400_vs_eventual_max_diff": worst_lim,
            "traffic_mc_max_standard_errors": z}


def _proof_avoid():
    """Woodbury passage probabilities vs direct solves and a seeded Monte Carlo."""
    q, r, s = _random_chain()
    n = q.shape[0]
    rng = np.random.default_rng(3301)
    kills, direct = [], []
    for _ in range(24):
        dq, dr = np.zeros_like(q), np.zeros_like(r)
        for row in rng.choice(n, size=int(rng.integers(1, 4)), replace=False):
            j = rng.choice(np.flatnonzero(q[row]))
            dq[row, j] = q[row, j] * rng.uniform(.3, 1.0)
            if rng.random() < .5:
                dr[row, 0] = r[row, 0]
        kills.append((sparse.csr_matrix(dq), sparse.csr_matrix(dr)))
        direct.append(float(s @ np.linalg.solve(np.eye(n) - (q - dq), (r - dr)[:, 0])))
    J, Jk = avoid_probabilities(q, r, s, np.array([1.0, 0, 0]), kills)
    err = _close(Jk, direct, "Woodbury vs direct killed-chain solve", tol=1e-10)
    # Monte Carlo: P(exit 0 AND traverse edge (i,j) at least once) on the looping toy
    q4 = np.array([[.15, .40, .20, .00], [.10, .10, .30, .15],
                   [.05, .15, .20, .25], [.10, .05, .10, .15]])
    r4 = np.array([[.10, .15], [.25, .10], [.10, .25], [.35, .25]])
    s4 = np.array([.7, .1, .1, .1])
    edges = [(0, 1), (1, 2), (2, 3), (3, 0), (2, 2)]
    ks = []
    for i, j in edges:
        dq = np.zeros_like(q4)
        dq[i, j] = q4[i, j]
        ks.append((sparse.csr_matrix(dq), sparse.csr_matrix(np.zeros_like(r4))))
    J4, Jk4 = avoid_probabilities(q4, r4, s4, np.array([1.0, 0]), ks)
    prng = np.random.default_rng(20260924)
    trials = 200000
    full = np.hstack((q4, r4))
    cdf = np.cumsum(full, axis=1)
    cdf[:, -1] = 1.0
    used = np.zeros((trials, len(edges)), dtype=bool)
    state = prng.choice(4, size=trials, p=s4)
    active = np.arange(trials)
    won = np.zeros(trials, dtype=bool)
    while active.size:
        old = state[active]
        new = np.sum(prng.random(active.size)[:, None] >= cdf[old], axis=1)
        for e, (i, j) in enumerate(edges):
            used[active[(old == i) & (new == j)], e] = True
        won[active[new == 4]] = True
        keep = new < 4
        state[active[keep]] = new[keep]
        active = active[keep]
    hit = (used & won[:, None]).astype(float)
    mean, se = hit.mean(axis=0), hit.std(axis=0, ddof=1) / np.sqrt(trials)
    z = float(np.max(np.abs(mean - (J4 - Jk4)) / se))
    _require(z <= 4.0, f"passage Monte Carlo max z {z:.2f}")
    return {"set": "24 seed=3301 kill sets on the seed=41309 30-state chain; 5 edges of the looping toy by MC",
            "coverage": {"kill_sets": len(kills), "floor": 20, "mc_edges": len(edges), "mc_trials": trials},
            "woodbury_vs_direct_max_error": err, "passage_mc_max_standard_errors": z,
            "passage_probabilities": [float(x) for x in (J4 - Jk4)]}


def _proof_bottleneck():
    q, r = np.zeros((7, 7)), np.zeros((7, 2))
    q[0, 1:3], r[0, 1] = 0.375, 0.25
    q[1, 3] = q[2, 3] = q[3, 4] = 1.0
    q[4, 5:7], r[5:7, 0] = 0.5, 1.0
    f = reactive_flux(q, r, 0, [0])
    cut = min_cut(f.net, 0, 7)
    augmented_cut = min_cut(f.network, f.source, f.sink,
                            protected_edges=[(f.source, 0), (7, f.sink)])
    _require(augmented_cut.edges == cut.edges, "protected terminals preserve physical bottleneck")
    _require(cut.edges == ((3, 4, 0.75),), f"unexpected bottleneck: {cut.edges}")
    _close(f.target_probability, 0.75, "analytic bottleneck win probability")
    expected = np.zeros((9, 9))
    for i, j, mass in ((0, 1, .375), (0, 2, .375), (1, 3, .375), (2, 3, .375),
                       (3, 4, .75), (4, 5, .375), (4, 6, .375), (5, 7, .375), (6, 7, .375)):
        expected[i, j] = mass
    error = _close(f.gross.toarray(), expected, "analytic bottleneck gross edges")
    # Enumerate every physical cut independently of NetworkX. The unused losing
    # exit is excluded, so its arbitrary side assignment cannot double the count.
    candidates = []
    for bits in range(1 << 6):
        left = {0} | {i + 1 for i in range(6) if bits & (1 << i)}
        crossing = tuple((i, j) for i, j in zip(*np.nonzero(expected)) if i in left and j not in left)
        candidates.append((sum(expected[i, j] for i, j in crossing), crossing))
    optimum = min(value for value, _ in candidates)
    minimizers = [edges for value, edges in candidates if value == optimum]
    _close(cut.capacity, optimum, "exhaustive minimum-cut capacity")
    fewest = min(len(edges) for edges in minimizers)
    _require([edges for edges in minimizers if len(edges) == fewest] == [((3, 4),)],
             "exhaustive proof of unique fewest-edge cut")
    return {"set": "seven-transient split/bridge/split toy, start=0, target=R[:,0], all physical edges",
            "coverage": {"edges_checked": 9, "floor": 9, "cut_partitions_enumerated": len(candidates)},
            "cut_edges": [list(x) for x in cut.edges], "equal_capacity_minimum_cuts": len(minimizers),
            "capacity": cut.capacity, "total_flux": f.target_probability, "gross_max_error": error,
            "qualification": "unique single-edge minimum cut; other multi-edge minimum cuts tie in capacity"}


def _proof_routes():
    q = np.array([[0, .5, .5], [0, 0, 0], [0, 0, 0]])
    r = np.array([[0], [1], [1]])
    f = reactive_flux(q, r, 0, [0])
    paths = dominant_pathways(f.net, 0, 3)
    _require(tuple(p.nodes for p in paths.paths) == ((0, 1, 3), (0, 2, 3)), "two known routes")
    _close([p.share for p in paths.paths], [.5, .5], "symmetric half shares")
    _require(paths.residual.nnz == 0, "complete two-route decomposition")
    capped = dominant_pathways(f.net, 0, 3, kmax=1)
    _close(capped.explained_share, .5, "kmax receipt must disclose missing half")
    _require(capped.stop_reason == "kmax", "path cap must be named")
    return {"set": "three-transient symmetric routes, start=0, sole absorbing target=3",
            "coverage": {"routes_checked": len(paths.paths), "floor": 2},
            "shares": [p.share for p in paths.paths], "kmax_one_share": capped.explained_share}


def _random_chain():
    rng = np.random.default_rng(41309)
    n, m = 30, 3
    q, r = np.zeros((n, n)), np.zeros((n, m))
    for i in range(n):
        continuation = rng.uniform(.45, .85)
        destinations = rng.choice(n, size=9, replace=False)
        q[i, destinations] = continuation * rng.dirichlet(np.ones(9) * 2)
        r[i] = (1 - continuation) * rng.dirichlet(np.ones(m) * 2)
    return q, r, rng.dirichlet(np.ones(n))


def _proof_random_flux():
    q, r, s = _random_chain()
    f = reactive_flux(q, r, s, [0, 2])
    # Independent forward propagation, never a fundamental-matrix solve.
    live, visits, absorption, steps = s.copy(), np.zeros(30), np.zeros(3), 0
    while live.sum() > 2e-15 and steps < 1000:
        visits += live
        absorption += live @ r
        live = live @ q
        steps += 1
    _require(steps >= 20 and live.sum() <= 2e-15, "forward-series convergence / positive coverage")
    occupancy_error = _close(f.occupancy, visits, "forward-series occupancy")
    probability_error = _close(f.target_probability, absorption[[0, 2]].sum(), "forward-series absorption")
    # Independent dense solve on the conditioned chain proves the Doob identity.
    h, p = f.committor, f.target_probability
    qh = q * h[None, :] / h[:, None]
    rh = r[:, [0, 2]] / h[:, None]
    _close(qh.sum(axis=1) + rh.sum(axis=1), np.ones(30), "Doob row sums")
    gh = np.linalg.solve((np.eye(30) - qh).T, s * h / p)
    error = _close(p * gh[:, None] * qh, f.gross[:30, :30].toarray(), "Doob traversal identity")
    _close(p * gh[:, None] * rh, f.gross[:30, [30, 32]].toarray(), "Doob terminal identity")
    cut = min_cut(f.network, f.source, f.sink)
    _close(cut.capacity, absorption[[0, 2]].sum(), "random min-cut vs forward propagation")
    return {"set": "seed=41309 random 30-transient chain, distributed start, targets=R columns 0 and 2",
            "coverage": {"transient_states": 30, "floor": 30, "forward_steps": steps,
                         "physical_input_edges": int(np.count_nonzero(q) + np.count_nonzero(r))},
            "target_probability": p, "worst_kirchhoff_residual": max(f.residuals.values()),
            "forward_occupancy_max_error": occupancy_error, "forward_absorption_error": probability_error,
            "doob_current_max_error": error, "min_cut_capacity": cut.capacity}


def _proof_gradient():
    q, r, s = _random_chain()
    n, m = r.shape
    rng = np.random.default_rng(7919)
    dqs, drs, directions, steps = [], [], [], []
    full = np.hstack((q, r))
    for _ in range(32):
        direction = np.zeros((n, n + m))
        for row in rng.choice(n, size=6, replace=False):
            plus, minus = rng.choice(np.flatnonzero(full[row]), size=2, replace=False)
            mass = rng.uniform(.2, 1.0)
            direction[row, plus], direction[row, minus] = mass, -mass
        support = direction != 0
        steps.append(min(1e-5, float(np.min(full[support] / np.abs(direction[support]))) / 4))
        directions.append(direction)
        dqs.append(sparse.csr_matrix(direction[:, :n]))
        drs.append(sparse.csr_matrix(direction[:, n:]))
    grad = committor_gradient(q, r, s, 0, dqs, drs)
    numeric = []
    for direction, eps in zip(directions, steps):
        values = []
        for sign in (-1, 1):
            varied = full + sign * eps * direction
            _require(np.min(varied) >= 0, "finite-difference direction left probability simplex")
            _close(varied.sum(axis=1), np.ones(n), "finite-difference row sums")
            values.append(float(s @ np.linalg.solve(np.eye(n) - varied[:, :n], varied[:, n])))
        numeric.append((values[1] - values[0]) / (2 * eps))
    relative = np.abs(grad - numeric) / np.maximum(np.maximum(np.abs(grad), np.abs(numeric)), 1e-12)
    worst = float(relative.max())
    _require(len(grad) >= 20 and np.count_nonzero(np.abs(grad) > 1e-8) >= 20, "nontrivial direction floor=20")
    _require(worst < 1e-6, f"adjoint relative error {worst:.3e} >= 1e-6")
    return {"set": "seed=7919 sparse row-conserving directions on seed=41309 30-state chain; target=R[:,0]",
            "coverage": {"random_directions": len(grad), "floor": 20,
                         "nontrivial_gradients": int(np.count_nonzero(np.abs(grad) > 1e-8))},
            "max_relative_error": worst, "relative_error_limit": 1e-6,
            "max_absolute_error": _maxabs(grad - numeric), "finite_difference_step_max": max(steps),
            "positive_gradients": int(np.count_nonzero(grad > 0)),
            "negative_gradients": int(np.count_nonzero(grad < 0))}


def _proof_monte_carlo():
    q = np.array([[.15, .40, .20, .00], [.10, .10, .30, .15],
                  [.05, .15, .20, .25], [.10, .05, .10, .15]])
    r = np.array([[.10, .15], [.25, .10], [.10, .25], [.35, .25]])
    s = np.array([.7, .1, .1, .1])
    f = reactive_flux(q, r, s, [0])
    rng = np.random.default_rng(20260924)
    trials, n, width = 200000, 4, 6
    # One count vector per independently launched trajectory, including losing
    # trajectories as zeros. This estimates within-trajectory correlation too;
    # individual visits are NOT treated as independent Bernoulli observations.
    counts = np.zeros((trials, n * width), dtype=np.int32)
    state = rng.choice(n, size=trials, p=s)
    active = np.arange(trials)
    winners = np.zeros(trials, dtype=bool)
    cdf = np.cumsum(np.hstack((q, r)), axis=1)
    cdf[:, -1] = 1.0
    steps = 0
    while active.size and steps < 1000:
        old = state[active]
        dest = np.sum(rng.random(active.size)[:, None] >= cdf[old], axis=1)
        counts[active, old * width + dest] += 1
        winners[active[dest == n]] = True
        keep = dest < n
        state[active[keep]] = dest[keep]
        active = active[keep]
        steps += 1
    _require(active.size == 0, "Monte Carlo must not truncate live trajectories")
    counts[~winners] = 0
    mean = counts.mean(axis=0)
    se = np.sqrt(counts.var(axis=0, ddof=1) / trials)
    expected = f.gross[:n, :width].toarray().ravel()
    stochastic = se > 0
    _require(int(stochastic.sum()) >= 15, "Monte Carlo positive-variance edge floor=15")
    z = np.zeros(n * width)
    z[stochastic] = np.abs(mean[stochastic] - expected[stochastic]) / se[stochastic]
    _close(mean[~stochastic], expected[~stochastic], "deterministic/absent MC edges", tol=1e-14)
    _require(float(z.max()) <= 4.0, f"Monte Carlo edge residual {z.max():.3f} > 4 standard errors")
    _require(int(winners.sum()) >= 50000, "winning trajectory coverage floor=50000")
    return {"set": "seed=20260924, all 4x6 physical edge slots of looping four-transient toy; winning exit=4",
            "coverage": {"trajectories": trials, "trajectory_floor": 200000,
                         "winning_trajectories": int(winners.sum()), "winner_floor": 50000,
                         "positive_variance_edges": int(stochastic.sum()), "edge_floor": 15,
                         "edge_slots_checked": n * width},
            "max_standard_errors": float(z.max()), "standard_error_limit": 4.0,
            "analytic_target_probability": f.target_probability, "empirical_target_probability": float(winners.mean()),
            "max_edge_absolute_error": _maxabs(mean - expected), "longest_trajectory_steps": steps,
            "edge_checks": [{"src": i, "dst": j, "expected": float(expected[i * width + j]),
                             "mean": float(mean[i * width + j]), "standard_error": float(se[i * width + j]),
                             "standard_errors": float(z[i * width + j])}
                            for i in range(n) for j in range(width)]}


def _proof_rate_helper():
    p = .4
    q, r = np.array([[0, 1-p], [1-p, 0]]), np.array([[p, 0], [0, p]])
    records = [(0, [(-1, 1.0)], [(1, 1.0)]), (1, [(-2, 1.0)], [(0, 1.0)])]
    both = success_rate_direction(2, 2, records)
    me = success_rate_direction(2, 2, records[:1])
    them = success_rate_direction(2, 2, records[1:])
    grad = committor_gradient(q, r, 0, 0, [both[0], me[0], them[0]], [both[1], me[1], them[1]])
    analytic = np.array([1/(2-p)**2, p/(1-(1-p)**2)**2, -p*(1-p)/(1-(1-p)**2)**2])
    # d/dp_me = p_them / [1-(1-p_me)(1-p_them)]^2.
    error = _close(grad, analytic, "both-player / player / opponent analytic derivatives")
    _close(grad[0], grad[1] + grad[2], "both hands are included with signed contributions")
    _require(grad[1] > 0 and grad[2] < 0, "opponent contribution sign")
    # Nonunit attempt share, a self-loop miss and a null edge, all explicit.
    dq, dr = success_rate_direction(1, 2, [(0, [(-1, .4), (-1, None)], [(0, .2), (-2, .2)])])
    weighted = committor_gradient([[.2*(1-p)]], [[.4*p, .6+.2*(1-p)]], 0, 0, [dq], [dr])[0]
    expected = .32/(.8+.2*p)**2
    _close(weighted, expected, "attempt-share scaling with null drop")
    zero = success_rate_direction(1, 1, [(0, [(-1, .3)], [(-1, .3)])])
    _require(zero[0].nnz + zero[1].nnz == 0, "identical branches legitimately have zero derivative")
    return {"set": "alternating two-hand toy at common p=.4 plus one-state attempt-share=.4 toy and identical branches",
            "coverage": {"analytic_derivatives": 4, "floor": 4, "both_turn_rows": 2, "dropped_null_fixture_cells": 1},
            "both_player_gradient": float(grad[0]), "player_only_gradient": float(grad[1]),
            "opponent_only_gradient": float(grad[2]), "weighted_gradient": float(weighted), "max_error": error}


def _proof_circulation():
    # A three-edge circulation survives pairwise netting. It shares vertices
    # with the route but is not part of the source-to-sink throughput.
    f = sparse.csr_matrix(([1, 1, .3, .3, .3], ([0, 1, 1, 2, 3], [1, 4, 2, 3, 1])), shape=(5, 5))
    paths = dominant_pathways(f, 0, 4, cover=1)
    _require(paths.paths[0].nodes == (0, 1, 4), "known route beside cycle")
    _require(paths.residual.nnz == 3, "three-edge circulation must survive")
    _close(_divergence(paths.residual), np.zeros(5), "leftover pure circulation")
    _close(paths.residual.sum(), .9, "cycle traversal mass is not throughput")
    # A winning path can revisit its starting state. Each circuit survives with
    # probability .5, giving geometric mean two visits and one net launch.
    looping = reactive_flux([[0, 1, 0], [0, 0, 1], [.5, 0, 0]], [[0], [0], [.5]], 0, [0])
    _close(looping.occupancy, [2, 2, 2], "analytic start-revisiting occupancy")
    physical = dominant_pathways(looping.net, 0, 3, cover=1)
    augmented = dominant_pathways(looping.network, looping.source, looping.sink, cover=1)
    cut = min_cut(looping.net, 0, 3)
    _close([physical.total_flux, augmented.total_flux, cut.capacity], [1, 1, 1],
           "source return must not inflate throughput")
    _require(physical.residual.nnz == 3, "cycle through physical source must survive decomposition")
    return {"set": "five-node route-plus-cycle flow and three-transient start-revisiting geometric toy",
            "coverage": {"cycle_edges_retained": 6, "floor": 6, "source_revisit_cases": 1},
            "explained_share": paths.explained_share, "residual_edge_weight_sum": float(paths.residual.sum()),
            "source_revisit_occupancy": looping.occupancy.tolist(), "source_revisit_throughput": physical.total_flux}


def _proof_zero_and_rejections():
    # The target is unreachable only from the chosen start, not globally. This
    # tests h=0 alongside h>0 without division by zero or removal of real states.
    q, r = np.zeros((2, 2)), np.eye(2)
    f = reactive_flux(q, r, 1, [0])
    _close(f.committor, [1, 0], "unreachable target committor")
    _require(f.gross.nnz == f.net.nnz == f.network.nnz == 0, "zero target has zero current")
    bad = [
        lambda: reactive_flux([[1]], [[0]], 0, [0]),
        lambda: reactive_flux([[0]], [[None]], 0, [0]),
        lambda: reactive_flux([[0]], [[.5]], 0, [0]),
        lambda: reactive_flux(q, r, [0, 0], [0]),
        lambda: reactive_flux(q, r, 0, []),
        lambda: reactive_flux(q, r, 0, [0, 0]),
        lambda: reactive_flux(q, r, 0, [2]),
        lambda: dominant_pathways(f.network, f.source, f.sink),
        lambda: min_cut(f.network, f.source, f.sink),
        lambda: dominant_pathways([[0, 1], [0, 0]], 0, 1, cover=0),
        lambda: dominant_pathways([[0, 1], [0, 0]], 0, 1, kmax=0),
        lambda: min_cut([[0, 1, 0], [0, 0, .5], [0, 0, 0]], 0, 2),
        lambda: committor_gradient(q, r, 0, 0, [], []),
        lambda: committor_gradient(q, r, 0, 0, [q], []),
        lambda: committor_gradient(q, r, 0, 0, [np.zeros((1, 1))], [r]),
        lambda: success_rate_direction(1, 1, []),
        lambda: success_rate_direction(1, 1, [(0, [(-1, .5)], [(-1, 1)])]),
        lambda: success_rate_direction(1, 1, [(0, [(-1, None)], [(-1, None)])]),
    ]
    rejected = 0
    for call in bad:
        try:
            call()
        except (ValueError, AssertionError):
            rejected += 1
        else:
            raise AssertionError(f"invalid-input case {rejected} was not rejected")
    _require(rejected >= 18, "invalid-input coverage floor=18")
    return {"set": "zero target from state 1 of identity exit toy, plus explicit invalid-input calls",
            "coverage": {"invalid_calls_rejected": rejected, "floor": 18, "committors_checked": 2},
            "target_probability": f.target_probability, "gross_edges": f.gross.nnz}


def selfcheck():
    """Run only synthetic chains; all cases execute even if another case fails."""
    cases = [("a_bottleneck", _proof_bottleneck), ("b_two_routes", _proof_routes),
             ("c_random_conservation", _proof_random_flux), ("d_adjoint_finite_difference", _proof_gradient),
             ("e_seeded_monte_carlo", _proof_monte_carlo), ("rate_direction_bridge", _proof_rate_helper),
             ("residual_circulation", _proof_circulation), ("zero_target_and_rejections", _proof_zero_and_rejections),
             ("f_cell_weights_clocked_and_eventual", _proof_cell_weights), ("g_passage_woodbury", _proof_avoid),
             ("h_row_update_exact", _proof_row_update)]
    report = {"item": "F1 + F2R + F3 methods", "scope": "synthetic methods only; no real graph loaded",
              "graph": "none (synthetic)",
              "source_sha256": {"scripts/semantics/_tpt.py": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
              "recompute": RECOMPUTE, "cases": {}}
    failures = 0
    for name, check in cases:
        try:
            result = check()
            result["status"], result["recompute"] = "PASS", RECOMPUTE
            report["cases"][name] = result
            brief = {key: value for key, value in result.items() if key not in ("edge_checks", "recompute")}
            print(f"PASS {name}: {json.dumps(brief, sort_keys=True)}; recompute: {RECOMPUTE}")
        except Exception as exc:
            failures += 1
            report["cases"][name] = {"status": "FAIL", "error": f"{type(exc).__name__}: {exc}", "recompute": RECOMPUTE}
            print(f"FAIL {name}: {type(exc).__name__}: {exc}; recompute: {RECOMPUTE}")
    _require(len(report["cases"]) >= 11, "selfcheck case floor=11")
    report["passed"], report["failed"] = len(cases) - failures, failures
    report["case_floor"], report["status"] = 11, "PASS" if failures == 0 else "FAIL"
    print(f"{report['status']} selfcheck: synthetic cases executed={len(cases)} (floor=11), "
          f"passed={report['passed']}, failed={failures}; recompute: {RECOMPUTE}")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--selfcheck", action="store_true", help="synthetic proofs only; never loads the corpus")
    parser.add_argument("--json", type=Path, help="optional deterministic selfcheck receipt")
    args = parser.parse_args()
    if not args.selfcheck:
        parser.error("--selfcheck is required; F1 has no real-graph execution path")
    report = selfcheck()
    if args.json is not None:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    return int(report["failed"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())
