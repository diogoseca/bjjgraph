#!/usr/bin/env python3
"""Synthetic-tested territory methods; this module never reads the graph/kernel.

Only numpy, scipy and networkx (plus the standard library) are required. Array
positions refer to the caller's ordered state set; callers must retain its IDs.
Public functions validate stochasticity and stationary flow, and reject chains
with multiple recurrent classes or a periodic recurrent class. Spectral methods
also require strictly positive pi: restrict to recurrent support explicitly.

References (the implementation below is independent):
* Rosvall & Bergstrom (2008), doi:10.1073/pnas.0706851105, two-level map equation.
  https://www.pnas.org/doi/10.1073/pnas.0706851105
* Reuter, Weber, Fackeldey, Roeblitz & Garcia (2018),
  https://doi.org/10.1021/acs.jctc.8b00079 (real Schur / G-PCCA).
* Roeblitz & Weber (2013), https://doi.org/10.1007/s11634-013-0134-6,
  Eq. 16: minimise k - trace(S), S=diag(chi.T pi)^(-1) chi.T D chi.
  This is membership crispness, NOT a test for dynamical persistence.
* The authors' API documents minChi before feasibility correction and the
  Galerkin coarse operator: https://pygpcca.readthedocs.io/en/latest/example.html

Important negative result: the requested 'low crispness for every k' on a
uniform complete chain is false. Any crisp partition spans an invariant
subspace of that chain; at k=n, crispness is necessarily 1. We test this
counterexample and report persistence_excess=(trace(Pc)-1)/(k-1) separately.
The uniform chain has persistence_excess=0, regardless of membership sharpness.
Neither crispness nor minChi alone certifies a territory or determines k.

Run: python3 -B scripts/semantics/_territory_methods.py --selfcheck
Optional deterministic evidence: --output tests/artifacts/semantics/territories-t1.json
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
from pathlib import Path
import sys

import networkx as nx
import numpy as np
from scipy import linalg, optimize, sparse
from scipy.linalg.lapack import dtrexc
from scipy.sparse.csgraph import connected_components
from scipy.special import xlogy


TOL = 1e-11
MOVE_TOL = 1e-12
DEFAULT_SEED = 1701
SELFCHECK_FLOOR = 34
RECOMPUTE = "python3 -B scripts/semantics/_territory_methods.py --selfcheck"


class SchurPairSplitError(ValueError):
    """The requested dimension cuts an indivisible real Schur block."""


def _matrix(P):
    P = P.toarray() if sparse.issparse(P) else np.asarray(P)
    if np.iscomplexobj(P):
        raise ValueError("P must be real")
    P = np.asarray(P, dtype=float)
    if P.ndim != 2 or P.shape[0] == 0 or P.shape[0] != P.shape[1]:
        raise ValueError("P must be a nonempty square matrix")
    if not np.isfinite(P).all() or np.any(P < 0):
        raise ValueError("P must have finite, nonnegative entries (null is not zero)")
    if np.max(np.abs(P.sum(axis=1) - 1)) > TOL:
        raise ValueError("P must be row-stochastic; no implicit renormalisation")
    return P


def _chain(P, pi, *, positive=False):
    P = _matrix(P)
    pi = np.asarray(pi, dtype=float)
    n = len(P)
    if (pi.shape != (n,) or not np.isfinite(pi).all() or np.any(pi < 0)
            or abs(pi.sum() - 1) > TOL):
        raise ValueError("pi must be a probability vector on exactly P's state set")
    if np.max(np.abs(pi @ P - pi)) > TOL:
        raise ValueError("pi is not stationary for P")
    count, labels = connected_components(sparse.csr_matrix(P > 0), directed=True,
                                        connection="strong")
    closed = np.ones(count, dtype=bool)
    rows, cols = np.nonzero(P)
    closed[labels[rows[labels[rows] != labels[cols]]]] = False
    if closed.sum() != 1:
        raise ValueError(f"expected one recurrent class; found {closed.sum()}")
    recurrent = np.flatnonzero(labels == np.flatnonzero(closed)[0])
    graph = nx.from_numpy_array(P[np.ix_(recurrent, recurrent)] > 0,
                               create_using=nx.DiGraph)
    if not nx.is_aperiodic(graph):
        raise ValueError("the recurrent class must be aperiodic (ergodic)")
    if positive and (np.any(pi <= 0) or len(recurrent) != n):
        raise ValueError("spectral methods require positive pi on recurrent support")
    return P, pi


def _labels(partition, n=None):
    values = list(partition)
    if not values or (n is not None and len(values) != n):
        raise ValueError("partition must label every state in the nonempty state set")
    mapping = {}
    result = []
    for label in values:
        if isinstance(label, (float, np.floating)) and not np.isfinite(label):
            raise ValueError("partition labels must be finite")
        if label not in mapping:
            mapping[label] = len(mapping)
        result.append(mapping[label])
    return np.asarray(result, dtype=int)


def _xlogx(x):
    x = np.asarray(x, dtype=float)
    return xlogy(x, x) / np.log(2.0)


def _aggregate(flow, labels):
    labels = _labels(labels, len(flow))
    m = labels.max() + 1
    rows = np.zeros((m, len(flow)))
    np.add.at(rows, labels, flow)
    both = np.zeros((m, m))
    np.add.at(both, labels, rows.T)
    return both.T


def _flow_L(flow, weights, labels, node_entropy):
    block = _aggregate(flow, labels)
    mass = np.bincount(_labels(labels), weights=weights)
    # Sum actual cross-module cells: no cancellation of tiny positive exits.
    np.fill_diagonal(block, 0)
    exits = block.sum(axis=1)
    return float(_xlogx(exits.sum()) - 2 * _xlogx(exits).sum()
                 + _xlogx(mass + exits).sum() + node_entropy)


def map_equation_L(P, pi, partition):
    """Two-level directed map equation in bits per stationary transition.

    q_m=sum_{i in m,j not in m} pi_i P_ij; p_m^o=q_m+sum_{i in m} pi_i.
    L=q H(q_m/q)+sum_m p_m^o H({pi_i/p_m^o}_{i in m},q_m/p_m^o).
    Stationarity makes module entry and exit rates equal even for directed P.
    No teleportation term is added: the supplied restart chain is already
    ergodic. We verify its single recurrent class and aperiodicity. Transient
    zero-pi states contribute no stationary symbols; they are NOT removed.
    """
    P, pi = _chain(P, pi)
    labels = _labels(partition, len(P))
    return _flow_L(pi[:, None] * P, pi, labels, -_xlogx(pi).sum())


def partition_similarity(a, b):
    """Unweighted state-set NMI (arithmetic normalisation), VI (bits), and ARI."""
    a, b = _labels(a), _labels(b)
    if len(a) != len(b):
        raise ValueError("partitions must describe exactly the same ordered state set")
    n = len(a)
    table = np.zeros((a.max() + 1, b.max() + 1), dtype=int)
    np.add.at(table, (a, b), 1)
    left, right = table.sum(axis=1), table.sum(axis=0)
    joint = table / n
    ha, hb = -_xlogx(left / n).sum(), -_xlogx(right / n).sum()
    i, j = np.nonzero(table)
    mi = float(np.sum(joint[i, j] * np.log2(table[i, j] * n / (left[i] * right[j]))))
    nmi = 1.0 if ha + hb == 0 else 2 * mi / (ha + hb)
    choose2 = lambda x: np.sum(x * (x - 1) / 2)
    pairs = n * (n - 1) / 2
    expected = 0.0 if pairs == 0 else choose2(left) * choose2(right) / pairs
    bound = (choose2(left) + choose2(right)) / 2
    ari = 1.0 if bound == expected else (choose2(table) - expected) / (bound - expected)
    return {"nmi": float(np.clip(nmi, 0, 1)), "vi": float(max(0, ha + hb - 2 * mi)),
            "adjusted_rand": float(ari), "states_compared": n}


def _greedy(flow, weights, node_entropy, initial, rng, coverage, parents=None, audit=False):
    """Exact O(number-of-modules) node-move deltas, with optional split constraints."""
    n = len(flow)
    labels = _labels(initial, n)
    counts = np.bincount(labels, minlength=n)
    mass = np.bincount(labels, weights=weights, minlength=n)
    block = _aggregate(flow, labels)
    exits = np.zeros(n)
    np.fill_diagonal(block, 0)
    exits[:len(block)] = block.sum(axis=1)
    total_exit = exits.sum()
    module_cost = _xlogx(mass + exits) - 2 * _xlogx(exits)
    exit_cost = _xlogx(total_exit)
    # For coarse tuning, discover at least two submodules per nonsingleton
    # parent. The temporary split is only accepted through a lower full L.
    owner = np.full(n, -1, dtype=int)
    parent_groups = None
    if parents is not None:
        parents = _labels(parents, n)
        owner[labels] = parents
        parent_groups = np.bincount(owner[counts > 0], minlength=parents.max() + 1)
    for sweep in range(1000):
        moved = 0
        coverage["greedy_sweeps"] += 1
        for i in rng.permutation(n):
            coverage["atoms_considered"] += 1
            a = labels[i]
            active = np.flatnonzero(counts)
            vacant = np.flatnonzero(counts == 0)
            candidates = active[active != a]
            if parents is not None:
                candidates = candidates[owner[candidates] == parents[i]]
                if counts[a] == 1 and parent_groups[parents[i]] <= 2:
                    continue
            if len(vacant) and counts[a] > 1:
                candidates = np.append(candidates, vacant[0])
            if not len(candidates):
                continue
            out = np.bincount(labels, weights=flow[i], minlength=n)
            inc = np.bincount(labels, weights=flow[:, i], minlength=n)
            ea = exits[a] - weights[i] + out[a] + inc[a] - flow[i, i]
            eb = exits[candidates] + weights[i] - out[candidates] - inc[candidates] - flow[i, i]
            if min(ea, float(eb.min())) < -TOL:
                raise ArithmeticError("negative module exit in move delta")
            ea, eb = max(0.0, ea), np.maximum(0, eb)
            new_q = np.maximum(0, total_exit + ea + eb - exits[a] - exits[candidates])
            new_ma = max(0.0, mass[a] - weights[i])
            new_mb = mass[candidates] + weights[i]
            next_exit_cost = _xlogx(new_q)
            cost_a = _xlogx(new_ma + ea) - 2 * _xlogx(ea)
            cost_b = _xlogx(new_mb + eb) - 2 * _xlogx(eb)
            gain = next_exit_cost - exit_cost + cost_a + cost_b - module_cost[a] - module_cost[candidates]
            coverage["move_candidates"] += len(candidates)
            if audit:
                before = _flow_L(flow, weights, labels, node_entropy)
                for target, delta in zip(candidates, gain):
                    trial = labels.copy()
                    trial[i] = target
                    independently = _flow_L(flow, weights, trial, node_entropy) - before
                    if abs(delta - independently) > 1e-10:
                        raise AssertionError("incremental move delta disagrees with full objective")
                    coverage["delta_checks"] += 1
            best = int(np.argmin(gain))
            if gain[best] >= -MOVE_TOL:
                continue
            b = candidates[best]
            if parents is not None:
                if counts[b] == 0:
                    owner[b] = parents[i]
                    parent_groups[parents[i]] += 1
                if counts[a] == 1:
                    parent_groups[parents[i]] -= 1
            labels[i] = b
            counts[a] -= 1
            counts[b] += 1
            mass[a], mass[b] = new_ma, new_mb[best]
            exits[a], exits[b], total_exit = ea, eb[best], new_q[best]
            module_cost[a], module_cost[b], exit_cost = cost_a, cost_b[best], next_exit_cost[best]
            moved += 1
            coverage["accepted_moves"] += 1
        if not moved:
            return _labels(labels)
    raise RuntimeError("node moves did not converge after 1000 sweeps")


def map_equation_search(P, pi, restarts=32, seed=DEFAULT_SEED):
    """Seeded Infomap-style heuristic; not an Infomap package or global certificate.

    Each restart uses default_rng(seed+r), exact directed stationary flows,
    singleton greedy moves, repeated module aggregation, original-node fine
    tuning, and submodule coarse tuning. Coarse tuning greedily splits within
    parents (a two-submodule floor), then moves whole submodules between parents.
    Only strict improvements of the ORIGINAL two-level objective are accepted;
    aggregation retains the original node entropy, not aggregate-node entropy.
    A one-module candidate is always available. Top-five stability uses the best
    min(5,restarts) runs (ties by restart index); NMI is unweighted over states.
    """
    P, pi = _chain(P, pi)
    if not isinstance(restarts, (int, np.integer)) or restarts < 1:
        raise ValueError("restarts must be a positive integer")
    n = len(P)
    flow = pi[:, None] * P
    entropy = float(-_xlogx(pi).sum())
    one = np.zeros(n, dtype=int)
    coverage = dict(states=n, positive_links=int(np.count_nonzero(P)), restarts=restarts,
                    greedy_sweeps=0, atoms_considered=0, move_candidates=0,
                    accepted_moves=0, aggregation_passes=0, fine_passes=0,
                    coarse_passes=0, submodules_considered=0, one_module_selections=0)
    runs = []
    for r in range(restarts):
        rng = np.random.default_rng(seed + r)
        labels = _greedy(flow, pi, entropy, np.arange(n), rng, coverage)
        while True:
            m = labels.max() + 1
            coarse_flow = _aggregate(flow, labels)
            coarse_pi = np.bincount(labels, weights=pi)
            coverage["aggregation_passes"] += 1
            groups = _greedy(coarse_flow, coarse_pi, entropy, np.arange(m), rng, coverage)
            candidate = _labels(groups[labels])
            if _flow_L(flow, pi, candidate, entropy) >= _flow_L(flow, pi, labels, entropy) - MOVE_TOL:
                break
            labels = candidate
        for tune in range(100):
            before = _flow_L(flow, pi, labels, entropy)
            coverage["fine_passes"] += 1
            labels = _greedy(flow, pi, entropy, labels, rng, coverage)
            coverage["coarse_passes"] += 1
            sub = _greedy(flow, pi, entropy, np.arange(n), rng, coverage, parents=labels)
            coverage["submodules_considered"] += sub.max() + 1
            representatives = np.asarray([np.flatnonzero(sub == j)[0] for j in range(sub.max() + 1)])
            grouped = _greedy(_aggregate(flow, sub), np.bincount(sub, weights=pi), entropy,
                              labels[representatives], rng, coverage)
            candidate = _labels(grouped[sub])
            if _flow_L(flow, pi, candidate, entropy) < _flow_L(flow, pi, labels, entropy) - MOVE_TOL:
                labels = candidate
            after = _flow_L(flow, pi, labels, entropy)
            if after >= before - MOVE_TOL:
                break
        else:
            raise RuntimeError("fine/coarse tuning did not converge after 100 rounds")
        raw_L = _flow_L(flow, pi, labels, entropy)
        if raw_L >= entropy - MOVE_TOL:
            labels, value = one.copy(), entropy
            coverage["one_module_selections"] += 1
        else:
            value = raw_L
        runs.append(dict(restart=r, partition=labels, L=value, raw_L=raw_L))
    ranked = sorted(runs, key=lambda run: (run["L"], run["restart"]))
    top = ranked[:5]
    pairs = [{"restarts": [a["restart"], b["restart"]],
              "nmi": partition_similarity(a["partition"], b["partition"])["nmi"]}
             for a, b in itertools.combinations(top, 2)]
    values = np.asarray([run["L"] for run in runs])
    best = ranked[0]
    if coverage["atoms_considered"] < n * restarts:
        raise AssertionError("search coverage below one state pass per restart")
    return {"partition": best["partition"], "L": best["L"], "one_module_L": entropy,
            "saving": entropy - best["L"], "seed": seed,
            "spread": {"min": float(values.min()), "median": float(np.median(values)),
                       "max": float(values.max()), "top5_pairwise_nmi": pairs,
                       "top_restart_indices": [run["restart"] for run in top]},
            "restart_L": values, "raw_restart_L": np.asarray([run["raw_L"] for run in runs]),
            "coverage": coverage}


def _schur_blocks(T, start=0):
    blocks = []
    i = start
    while i < len(T):
        width = 2 if i + 1 < len(T) and T[i + 1, i] != 0 else 1
        # Only eigenVALUES of 1x1/2x2 Schur blocks, never eigenvectors.
        values = linalg.eigvals(T[i:i + width, i:i + width])
        distance = float(np.max(np.abs(values - 1)))
        blocks.append((i, width, distance, values))
        i += width
    return blocks


def _ordered_schur(P, pi, k):
    root = np.sqrt(pi)
    B = root[:, None] * P / root[None, :]
    T, Z = linalg.schur(B, output="real")
    position = 0
    while position < k:
        blocks = _schur_blocks(T, position)
        # Stable tie breaking within roundoff; distance is to +1, not modulus.
        index, width, _, _ = min(blocks, key=lambda b: (round(b[2], 13), b[0]))
        if position + width > k:
            raise SchurPairSplitError(f"k={k} splits a complex conjugate Schur pair; use k={position} or k={position + width}")
        if index != position:
            T, Z, info = dtrexc(T, Z, index + 1, position + 1)
            if info != 0:
                raise RuntimeError(f"LAPACK dtrexc failed to reorder real Schur blocks: info={info}")
        position += width
    selected = np.concatenate([b[3] for b in _schur_blocks(T[:k, :k])])
    remaining = _schur_blocks(T, k)
    boundary_gap = None if not remaining else min(b[2] for b in remaining) - max(abs(selected - 1))
    X = Z[:, :k] / root[:, None]
    if np.dot(pi, X[:, 0]) < 0:
        X[:, 0] *= -1
    if np.max(abs(X[:, 0] - 1)) > 1e-8:
        raise ArithmeticError("first Schur vector is not the stationary constant")
    X[:, 0] = 1
    # Correct roundoff while keeping the selected REAL invariant subspace.
    for j in range(1, k):
        for repeat in range(2):
            X[:, j] -= X[:, :j] @ (X[:, :j].T @ (pi * X[:, j]))
        X[:, j] /= np.sqrt(np.dot(pi, X[:, j] ** 2))
        if X[np.argmax(abs(X[:, j])), j] < 0:
            X[:, j] *= -1
    reduced = X.T @ (pi[:, None] * (P @ X))
    residual = float(np.max(abs(P @ X - X @ reduced)))
    orthogonality = float(np.max(abs(X.T @ (pi[:, None] * X) - np.eye(k))))
    if residual > 1e-8 or orthogonality > 1e-10:
        raise ArithmeticError("ordered Schur invariant-subspace checks failed")
    return X, selected, {"invariance_residual": residual, "orthogonality_residual": orthogonality,
                         "boundary_gap": None if boundary_gap is None else float(boundary_gap),
                         "boundary_tied": boundary_gap is not None and abs(boundary_gap) < 1e-10}


def _inner_simplex(X):
    n, k = X.shape
    vertices = [int(np.argmax(np.sum(X[:, 1:] ** 2, axis=1)))]
    residual = X[:, 1:] - X[vertices[0], 1:]
    for step in range(1, k):
        index = int(np.argmax(np.sum(residual ** 2, axis=1)))
        direction = residual[index].copy()
        norm = np.linalg.norm(direction)
        if norm < 1e-12 or index in vertices:
            raise ArithmeticError("inner simplex is rank deficient")
        vertices.append(index)
        direction /= norm
        residual -= np.outer(residual @ direction, direction)
    A = linalg.solve(X[vertices], np.eye(k))
    return A, vertices


def _rotation_objective(flat, k):
    free = np.asarray(flat).reshape(k, k - 1)
    A = np.column_stack((free, np.eye(k)[:, 0] - free.sum(axis=1)))
    masses = A[0]
    # SLSQP may inspect infeasible trial points. This extension agrees with the
    # objective and its analytic derivative throughout the constrained domain.
    denom = np.maximum(masses, 1e-14)
    norm2 = (A ** 2).sum(axis=0)
    value = k - np.sum(norm2 / denom)
    grad = -2 * A / denom
    grad[0] += np.where(masses > 1e-14, norm2 / denom ** 2, 0)
    return float(value), (grad[:, :-1] - grad[:, -1:]).ravel()


def _feasible_rotation(flat, X, gradient=False):
    """PCCA+ support-function parametrisation; positivity holds by construction.

    Complete the lower rows to sum to zero, choose the smallest constant in
    each column making X A nonnegative, then normalise the constants to sum
    to one. This stays in the SAME Schur subspace. The objective is piecewise
    differentiable; the returned derivative chooses a maximising support row.
    """
    k = X.shape[1]
    free = np.asarray(flat).reshape(k - 1, k - 1)
    lower = np.column_stack((-free.sum(axis=1), free))
    projected = X[:, 1:] @ lower
    active = np.argmin(projected, axis=0)
    constants = -projected[active, np.arange(k)]
    if np.any(constants <= 1e-15):
        raise ArithmeticError("degenerate feasible PCCA+ rotation")
    total = constants.sum()
    raw = np.vstack((constants, lower))
    A = raw / total
    squares = np.sum(lower ** 2, axis=0)
    trace_raw = np.sum(constants + squares / constants)
    objective = 1 - trace_raw / (k * total)
    if not gradient:
        return A, float(objective)
    dc = -X[active, 1:].T
    dg = 2 * lower / constants + (1 - squares / constants ** 2) * dc
    derivative = -(dg / total - trace_raw * dc / total ** 2) / k
    return float(objective), (derivative[:, 1:] - derivative[:, 0:1]).ravel()


def _feasible_optimise(X, initial):
    """Numerically robust PCCA+ route when SLSQP rejects its linear constraints.

    L-BFGS minimises the same trace(S) objective over the standard feasible
    rotation parametrisation with its support-row derivative; Powell is a
    derivative-free retry. No eigenvectors, membership clipping, or new
    objective are substituted. Return explicit solver diagnostics.
    """
    start = initial[1:, 1:].ravel()
    result = optimize.minimize(lambda x: _feasible_rotation(x, X, gradient=True), start,
                               method="L-BFGS-B", jac=True,
                               options={"maxiter": 10000, "maxls": 100,
                                        "ftol": 1e-12, "gtol": 1e-8})
    method = "feasible-rotation L-BFGS-B"
    if not result.success:
        result = optimize.minimize(lambda x: _feasible_rotation(x, X)[1], result.x,
                                   method="Powell", options={"maxiter": 400, "maxfev": 150000,
                                                            "xtol": 1e-8, "ftol": 1e-10})
        method = "feasible-rotation Powell"
    if not result.success:
        raise RuntimeError(f"feasible PCCA+ optimisation failed: {result.message}")
    A, value = _feasible_rotation(result.x, X)
    return A, {"success": True, "message": str(result.message), "method": method,
               "iterations": int(result.nit), "evaluations": int(result.nfev),
               "objective": value}


def _optimise_memberships(X, pi):
    n, k = X.shape
    raw, vertices = _inner_simplex(X)
    min_chi = float(np.min(X @ raw))
    # Feasibilise by columnwise affine shifts, staying inside span(X).
    shift = np.maximum(0, -np.min(X @ raw, axis=0)) + 1e-13
    raw[0] += shift
    initial = raw / raw[0].sum()
    start = initial[:, :-1].ravel()
    initial_obj = _rotation_objective(start, k)[0]
    if initial_obj / k <= 1e-10:
        flat = start
        info = {"success": True, "message": "inner simplex attains the global crispness upper bound",
                "iterations": 0, "evaluations": 1, "initial_crispness": 1 - initial_obj / k}
    else:
        contrast = np.vstack((np.eye(k - 1), -np.ones((1, k - 1))))
        linear = np.kron(X, contrast)
        offset = np.tile(np.eye(k)[-1], n)
        # Include a positive cluster-mass floor to keep trace(S) well defined.
        mass_linear = np.kron(np.eye(k)[0:1], contrast)
        full_linear = np.vstack((linear, mass_linear))
        lower = np.concatenate((-offset, np.full(k, 1e-12) - np.eye(k)[-1]))
        # Rare states can have very large back-transformed Schur rows. Positive
        # row scaling leaves the feasible polytope unchanged and avoids false
        # 'incompatible constraints' from SLSQP's linear subproblem.
        row_scale = np.maximum(np.linalg.norm(full_linear, axis=1), 1.0)
        full_linear = full_linear / row_scale[:, None]
        lower = lower / row_scale
        constraint = optimize.LinearConstraint(full_linear, lower, np.inf)
        def objective(x):
            value, gradient = _rotation_objective(x, k)
            return value / k, gradient / k

        result = optimize.minimize(objective, start, jac=True,
                                   method="SLSQP", constraints=[constraint],
                                   options={"maxiter": 1000, "ftol": 1e-10})
        if not result.success:
            recovered, info = _feasible_optimise(X, initial)
            flat = recovered[:, :-1].ravel()
            info.update(slsqp_failure=str(result.message), slsqp_iterations=int(result.nit),
                        initial_crispness=1 - initial_obj / k)
        else:
            flat = result.x
            info = {"success": bool(result.success), "message": str(result.message), "method": "SLSQP",
                    "iterations": int(result.nit), "evaluations": int(result.nfev),
                    "initial_crispness": 1 - initial_obj / k}
    free = flat.reshape(k, k - 1)
    A = np.column_stack((free, np.eye(k)[:, 0] - free.sum(axis=1)))
    chi = X @ A
    if chi.min() < -1e-8 or np.max(abs(chi.sum(axis=1) - 1)) > 1e-10:
        A, recovered_info = _feasible_optimise(X, initial)
        recovered_info.update(slsqp_failure="reported convergence outside the membership simplex",
                              initial_crispness=1 - initial_obj / k)
        info, chi = recovered_info, X @ A
    # Correct only solver-scale roundoff through an affine shift in span(X),
    # never by entrywise clipping/renormalisation which destroys invariance.
    correction = np.maximum(0, -chi.min(axis=0)) + np.finfo(float).eps
    A[0] += correction
    A /= A[0].sum()
    chi = X @ A
    info["affine_roundoff_correction"] = float(correction.max())
    if _rotation_objective(A[:, :-1].ravel(), k)[0] > initial_obj + 1e-8:
        raise ArithmeticError("PCCA+ optimisation worsened its feasible initial guess")
    return chi, A, min_chi, vertices, info


def gpcca(P, pi, k):
    """G-PCCA+ on the k real Schur vectors with eigenvalues closest to +1.

    A real Schur decomposition of sqrt(D) P inv(sqrt(D)) is reordered with
    LAPACK block swaps; complex pairs are indivisible (invalid k raises).
    X is back-transformed and D-orthonormal, chi=X A. An inner simplex initial
    guess is optimised by constrained SLSQP with an analytic gradient for
    Roeblitz & Weber (2013), Eq. 16: k-trace(S). crispness=trace(S)/k.
    minChi is min(X A_initial) BEFORE feasibility correction/optimisation.
    The optimiser is local; Schur boundary ties are explicitly reported.

    coarse=(chi.T D chi)^(-1) chi.T D P chi is the Galerkin operator, retaining
    the selected spectrum. An ill-conditioned overlap returns coarse=None with
    an explicit status; the stochastic coarse_flux remains defined. This flags
    a degenerate requested dimension instead of using an unstable inverse.
    For general fuzzy decompositions it can have
    negative entries: coarse_is_stochastic must be checked before treating it
    as a transition matrix. No negative entries are silently clipped. Also
    return coarse_flux=diag(chi.T pi)^(-1) chi.T D P chi, which IS stochastic
    but generally has a different spectrum. The fixtures check both routes.
    """
    P, pi = _chain(P, pi, positive=True)
    n = len(P)
    if not isinstance(k, (int, np.integer)) or not 1 <= k <= n:
        raise ValueError("k must be an integer between 1 and the number of states")
    X, eigenvalues, diagnostics = _ordered_schur(P, pi, k)
    if k == 1:
        chi, A, min_chi, vertices = np.ones((n, 1)), np.ones((1, 1)), 1.0, [0]
        optimisation = dict(success=True, message="one constant membership", iterations=0,
                            evaluations=1, initial_crispness=1.0, affine_roundoff_correction=0.0)
    else:
        chi, A, min_chi, vertices, optimisation = _optimise_memberships(X, pi)
    mass = pi @ chi
    overlap = chi.T @ (pi[:, None] * chi)
    flux = chi.T @ (pi[:, None] * (P @ chi))
    condition = float(np.linalg.cond(overlap))
    coarse = None if condition > 1e13 else linalg.solve(overlap, flux, assume_a="pos")
    coarse_flux = flux / mass[:, None]
    crispness = float(np.sum(np.diag(overlap) / mass) / k)
    diagnostics.update(overlap_condition=condition, min_membership=float(chi.min()),
                       membership_row_error=float(np.max(abs(chi.sum(axis=1) - 1))),
                       coarse_row_error=None if coarse is None else float(np.max(abs(coarse.sum(axis=1) - 1))),
                       coarse_min=None if coarse is None else float(coarse.min()),
                       coarse_stationarity_error=None if coarse is None else float(np.max(abs(mass @ coarse - mass))),
                       membership_invariance_error=None if coarse is None else float(np.max(abs(P @ chi - chi @ coarse))),
                       coarse_flux_difference=None if coarse is None else float(np.max(abs(coarse - coarse_flux))))
    return {"chi": chi, "coarse": coarse, "coarse_flux": coarse_flux,
            "coarse_status": "ill_conditioned_overlap" if coarse is None else "computed",
            "coarse_is_stochastic": bool(coarse is not None and coarse.min() >= -1e-10
                                          and diagnostics["coarse_row_error"] < 1e-9),
            "crispness": crispness, "minChi": min_chi,
            "persistence_excess": None if k == 1 or coarse is None else float((np.trace(coarse) - 1) / (k - 1)),
            "persistence_excess_flux": None if k == 1 else float((np.trace(coarse_flux) - 1) / (k - 1)),
            "coarse_mass": mass, "eigenvalues": eigenvalues, "schur_vectors": X,
            "rotation": A, "simplex_vertices": vertices, "optimisation": optimisation,
            "diagnostics": diagnostics,
            "coverage": {"states": n, "positive_links": int(np.count_nonzero(P)),
                         "schur_vectors": k, "memberships": n * k}}


def _kmeans(points, k, seed):
    best = None
    for restart in range(16):
        rng = np.random.default_rng(seed + restart)
        centers = [points[int(rng.integers(len(points)))]]
        while len(centers) < k:
            distance = np.min(np.sum((points[:, None] - np.asarray(centers)[None]) ** 2, axis=2), axis=1)
            if distance.sum() <= 0:
                raise ArithmeticError("spectral embedding has fewer than k distinct points")
            centers.append(points[rng.choice(len(points), p=distance / distance.sum())])
        centers = np.asarray(centers)
        previous = None
        for iteration in range(500):
            distance = np.sum((points[:, None] - centers[None]) ** 2, axis=2)
            labels = np.argmin(distance, axis=1)
            counts = np.bincount(labels, minlength=k)
            for missing in np.flatnonzero(counts == 0):
                eligible = np.flatnonzero(counts[labels] > 1)
                farthest = eligible[np.argmax(distance[eligible, labels[eligible]])]
                counts[labels[farthest]] -= 1
                labels[farthest] = missing
                counts[missing] += 1
            centers = np.asarray([points[labels == j].mean(axis=0) for j in range(k)])
            if previous is not None and np.array_equal(previous, labels):
                break
            previous = labels.copy()
        else:
            raise RuntimeError("spectral k-means did not converge")
        inertia = float(np.sum((points - centers[labels]) ** 2))
        if best is None or inertia < best[0]:
            best = inertia, _labels(labels)
    return best[1]


def spectral_baseline(P, pi, k, seed=DEFAULT_SEED):
    """Seeded k-means labels on the top-k right eigenvectors of (P+P*)/2.

    P*=D^-1 P.T D. Compute the symmetric similar matrix with eigh, select the
    largest algebraic eigenvalues (including the constant), back-transform,
    then use unweighted k-means++ / Lloyd with 16 seeded starts. No row
    normalisation or direction information beyond additive reversibilisation.
    """
    P, pi = _chain(P, pi, positive=True)
    if not isinstance(k, (int, np.integer)) or not 1 <= k <= len(P):
        raise ValueError("k must be an integer between 1 and the number of states")
    root = np.sqrt(pi)
    B = root[:, None] * P / root[None, :]
    _, U = linalg.eigh((B + B.T) / 2, subset_by_index=(len(P) - k, len(P) - 1))
    return _kmeans(U[:, ::-1] / root[:, None], k, seed)


def perturb(P, eps, rng):
    """Multiply each positive cell by exp(N(0,eps)), then normalise its row.

    Preserve structural zeros: the authored edge set is the corpus's structure;
    its probability magnitudes are the uncertain part. This is a sensitivity
    model, not a posterior uncertainty estimate. Recompute pi after perturbing.
    Dense input returns dense; sparse input returns canonical CSR. No null
    probabilities may be passed. Extreme draws that underflow an edge raise.
    """
    dense = _matrix(P)
    if not np.isfinite(eps) or eps < 0:
        raise ValueError("eps must be finite and nonnegative")
    if not isinstance(rng, np.random.Generator):
        raise TypeError("rng must be numpy.random.Generator")
    if eps == 0:
        result = dense.copy()
    else:
        result = np.zeros_like(dense)
        for i, row in enumerate(dense):
            mask = row > 0
            logs = np.log(row[mask]) + rng.normal(0, eps, int(mask.sum()))
            weights = np.exp(logs - logs.max())
            result[i, mask] = weights / weights.sum()
        if not np.array_equal(result > 0, dense > 0):
            raise FloatingPointError("perturbation underflow changed structural support")
    return sparse.csr_matrix(result) if sparse.issparse(P) else result


def _stationary(P):
    """Synthetic-only stationary solve; not a corpus transition builder."""
    system = P.T - np.eye(len(P))
    system[-1] = 1
    target = np.zeros(len(P))
    target[-1] = 1
    pi = linalg.solve(system, target)
    _chain(P, pi, positive=True)
    return pi


def _planted(blocks=3, size=10, stay=0.9, cycle=False):
    macro = np.full((blocks, blocks), (1 - stay) / (blocks - 1))
    np.fill_diagonal(macro, stay)
    if cycle:
        macro = stay * np.eye(blocks) + (1 - stay) * np.roll(np.eye(blocks), 1, axis=1)
    P = np.kron(macro, np.full((size, size), 1 / size))
    return P, np.full(len(P), 1 / len(P)), np.repeat(np.arange(blocks), size), macro


def _entropy_L(flow, pi, labels):
    """Independent literal codebook construction for selfcheck (not search)."""
    labels = _labels(labels)
    exits, length = [], 0.0
    for group in range(labels.max() + 1):
        inside = labels == group
        q = flow[np.ix_(inside, ~inside)].sum()
        symbols = np.append(pi[inside], q)
        positive = symbols[symbols > 0]
        length -= np.sum(positive * np.log2(positive / positive.sum()))
        exits.append(q)
    exits = np.asarray(exits)
    if exits.sum() > 0:
        positive = exits[exits > 0]
        length -= np.sum(positive * np.log2(positive / positive.sum()))
    return float(length)


def _partitions(n):
    def visit(prefix):
        if len(prefix) == n:
            yield np.asarray(prefix)
        else:
            for label in range(max(prefix) + 2):
                yield from visit(prefix + [label])
    yield from visit([0])


def _jsonable(obj):
    if isinstance(obj, np.ndarray):
        return _jsonable(obj.tolist())
    if isinstance(obj, (np.integer, np.floating, np.bool_)):
        return obj.item()
    if isinstance(obj, complex):
        return {"real": obj.real, "imag": obj.imag}
    if isinstance(obj, dict):
        return {key: _jsonable(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(value) for value in obj]
    return obj


def selfcheck(output=None):
    """Run known-answer proofs, independent checks and the requested stress grid."""
    records = []
    # The receipt depends on THIS file only (it imports no kernel, no graph, no other semantics
    # module), so its one source hash is this file's; a synthetic receipt records no graph hash.
    evidence = {"scope": "synthetic chains only; no corpus/kernel reads", "recompute": RECOMPUTE,
                "source_sha256": {"scripts/semantics/_territory_methods.py":
                                  hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                "check_floor": SELFCHECK_FLOOR, "checks": records, "fixtures": {}}

    def check(name, ok, state_set, **numbers):
        record = dict(name=name, status="PASS" if bool(ok) else "FAIL", state_set=state_set,
                      recompute=RECOMPUTE, **_jsonable(numbers))
        records.append(record)
        print(json.dumps(record, sort_keys=True, allow_nan=False), flush=True)

    def rejects(call):
        try:
            call()
        except (ValueError, TypeError, ArithmeticError):
            return True
        return False

    # Analytical planted blocks and directed circulation, plus independent
    # codebook formula and Galerkin-versus-known-macro-matrix checks.
    for name, blocks, cycle in [("planted", 3, False), ("cycle", 4, True)]:
        P, pi, truth, macro = _planted(blocks=blocks, cycle=cycle)
        state_set = f"all {len(P)} synthetic states; {blocks} equal size-10 cliques; stay=0.9; cycle={cycle}"
        search = map_equation_search(P, pi)
        fuzzy = gpcca(P, pi, blocks)
        spectral = spectral_baseline(P, pi, blocks)
        similarities = {"map": partition_similarity(truth, search["partition"]),
                        "gpcca": partition_similarity(truth, fuzzy["chi"].argmax(axis=1)),
                        "spectral": partition_similarity(truth, spectral)}
        for method, similarity in similarities.items():
            check(f"{name}.{method}.recovery", similarity["nmi"] > 1 - 1e-12,
                  state_set, **similarity)
        analytic = 0.1 * np.log2(blocks) + 1.1 * np.log2(11)
        true_L = map_equation_L(P, pi, truth)
        literal = _entropy_L(pi[:, None] * P, pi, truth)
        check(f"{name}.codelength", abs(true_L - analytic) < 1e-12 and abs(true_L - literal) < 1e-12
              and true_L < search["one_module_L"], state_set,
              L=true_L, analytic_L=analytic, literal_L=literal,
              one_module_L=search["one_module_L"], saving=search["saving"], spread=search["spread"])
        order = fuzzy["chi"][np.arange(blocks) * 10].argmax(axis=1)
        coarse = fuzzy["coarse"][np.ix_(order, order)]
        error = float(np.max(abs(coarse - macro)))
        check(f"{name}.memberships_and_coarse", error < 1e-9 and abs(fuzzy["crispness"] - 1) < 1e-9
              and fuzzy["chi"].min() >= -1e-12 and fuzzy["coarse_is_stochastic"], state_set,
              coarse_error=error, crispness=fuzzy["crispness"], minChi=fuzzy["minChi"],
              persistence_excess=fuzzy["persistence_excess"], diagnostics=fuzzy["diagnostics"])
        top_nmi = [pair["nmi"] for pair in search["spread"]["top5_pairwise_nmi"]]
        check(f"{name}.restart_coverage", len(top_nmi) == 10 and min(top_nmi) > 1 - 1e-12
              and search["coverage"]["coarse_passes"] >= 32, state_set,
              coverage=search["coverage"], top5_min_nmi=min(top_nmi))
        evidence["fixtures"][name] = dict(state_set=state_set, search=search, gpcca=fuzzy,
                                            spectral=spectral, truth=truth)

    P, pi, truth, _ = _planted()
    P4, pi4, _, _ = _planted(blocks=4, cycle=True)
    check("schur.reject_split_pair", rejects(lambda: gpcca(P4, pi4, 2)),
          "40-state directed four-clique chain; requested k=2 cuts the 0.9 +/- 0.1i pair", requested_k=2)
    X3, vals3, diag3 = _ordered_schur(P4, pi4, 3)
    check("schur.keep_whole_pair", np.sum(abs(vals3.imag) > 0.05) == 2
          and diag3["invariance_residual"] < 1e-10,
          "40-state directed four-clique chain; k=3 includes constant plus complete conjugate pair",
          selected_eigenvalues=vals3, **diag3)

    oscillatory = np.kron([[0.85, 0.15], [0.15, 0.85]], [[0.025, 0.975], [0.975, 0.025]])
    selected = gpcca(oscillatory, np.full(4, 0.25), 2)
    check("schur.closest_to_one_not_modulus", np.max(abs(np.sort(selected["eigenvalues"].real)
          - np.asarray([0.7, 1.0]))) < 1e-12,
          "four-state positive chain with spectrum {1,0.7,-0.95,-0.665}; k=2",
          selected_eigenvalues=selected["eigenvalues"])

    fuzzy3 = gpcca(P4, pi4, 3)
    X, A = fuzzy3["schur_vectors"], fuzzy3["rotation"]
    similar = linalg.solve(A, (X.T @ (pi4[:, None] * (P4 @ X))) @ A)
    route_error = float(np.max(abs(similar - fuzzy3["coarse"])))
    check("gpcca.signed_galerkin_is_not_a_chain", not fuzzy3["coarse_is_stochastic"]
          and abs(fuzzy3["coarse"].min() + 0.05) < 1e-9 and route_error < 1e-10
          and fuzzy3["coarse_flux"].min() >= 0
          and np.max(abs(fuzzy3["coarse_flux"].sum(axis=1) - 1)) < 1e-10,
          "all 40 states of the directed four-clique cycle coarsened to k=3 fuzzy sets",
          galerkin_min=float(fuzzy3["coarse"].min()), independently_computed_operator_error=route_error,
          flux_min=float(fuzzy3["coarse_flux"].min()), coarse_flux_difference=fuzzy3["diagnostics"]["coarse_flux_difference"])

    # A non-normal, nonuniform stationary fixture catches missing D weights.
    macro = np.asarray([[0.94, 0.05, 0.01], [0.01, 0.94, 0.05], [0.08, 0.01, 0.91]])
    micro = np.asarray([0.1, 0.2, 0.3, 0.4])
    nonnormal = np.kron(macro, np.tile(micro, (4, 1)))
    pin = _stationary(nonnormal)
    fuzzy = gpcca(nonnormal, pin, 3)
    order = fuzzy["chi"][np.arange(3) * 4].argmax(axis=1)
    coarse_error = float(np.max(abs(fuzzy["coarse"][np.ix_(order, order)] - macro)))
    B = np.sqrt(pin[:, None]) * nonnormal / np.sqrt(pin[None, :])
    nonnormality = float(np.max(abs(B @ B.T - B.T @ B)))
    check("gpcca.nonnormal_weighted", coarse_error < 1e-9 and nonnormality > 1e-4,
          "12-state nonnormal directed three-block chain; four unequal-weight microstates per block",
          coarse_error=coarse_error, nonnormality=nonnormality, stationary_min=float(pin.min()),
          stationary_max=float(pin.max()), diagnostics=fuzzy["diagnostics"])

    # Compare exact objective and its local search against all set partitions.
    tiny, pit, _, _ = _planted(blocks=2, size=3)
    partitions = list(_partitions(len(tiny)))
    values = [map_equation_L(tiny, pit, labels) for labels in partitions]
    route_error = max(abs(value - _entropy_L(pit[:, None] * tiny, pit, labels))
                      for value, labels in zip(values, partitions))
    searched = map_equation_search(tiny, pit, restarts=8)
    check("map.exhaustive_small_global", len(partitions) == 203 and route_error < 1e-12
          and abs(searched["L"] - min(values)) < 1e-12,
          "all 203 partitions of all six states in a two-block size-3 stay=0.9 chain",
          partitions_checked=len(partitions), route_error=route_error,
          exhaustive_min=min(values), search_L=searched["L"])

    # Independent seeded stationary source/destination samples, not a reused
    # algebraic route. Every state receives visits; empirical codebooks use counts.
    rng = np.random.default_rng(8128)
    samples = 200000
    source_counts = rng.multinomial(samples, pi)
    pair_counts = np.asarray([rng.multinomial(int(count), row) for count, row in zip(source_counts, P)])
    empirical = _entropy_L(pair_counts / samples, source_counts / samples, truth)
    exact = map_equation_L(P, pi, truth)
    check("map.seeded_monte_carlo", abs(empirical - exact) < 0.025 and np.count_nonzero(source_counts) == 30,
          "200000 independent stationary transition pairs on the 30-state planted chain; seed=8128",
          samples=samples, states_visited=int(np.count_nonzero(source_counts)), empirical_L=empirical,
          exact_L=exact, absolute_error=abs(empirical - exact))

    # Uniform chain: report the original requested criterion as REFUTED, with
    # a mathematical counterexample rather than a false low-crispness gate.
    uniform = np.full((30, 30), 1 / 30)
    pu = np.full(30, 1 / 30)
    search = map_equation_search(uniform, pu)
    check("uniform.map_one_module", len(set(search["partition"])) == 1 and search["saving"] <= 0,
          "all 30 states of P_ij=1/30, including self-loops",
          modules=len(set(search["partition"])), saving=search["saving"], L=search["L"])
    curve, inadmissible = [], []
    for k in list(range(2, 9)) + [30]:
        try:
            fuzzy = gpcca(uniform, pu, k)
        except SchurPairSplitError as error:
            # Roundoff within the massively degenerate zero eigenspace can
            # appear as tiny conjugate blocks. Never split even these blocks.
            inadmissible.append(dict(k=k, reason=str(error)))
            continue
        curve.append(dict(k=k, crispness=fuzzy["crispness"], minChi=fuzzy["minChi"],
                          persistence_excess=fuzzy["persistence_excess"],
                          boundary_tied=fuzzy["diagnostics"]["boundary_tied"],
                          optimiser_iterations=fuzzy["optimisation"]["iterations"]))
    check("uniform.no_persistence", len(curve) >= 4
          and len(curve) + len(inadmissible) == 8
          and max(abs(row["persistence_excess"]) for row in curve) < 1e-10,
          "uniform 30-state chain; admissible Schur/G-PCCA+ dimensions among k=2..8 and k=30",
          curve=curve, k_checked=len(curve), inadmissible_dimensions=inadmissible)
    # Independent construction: ALL k in 2..30 admit crisp invariant partitions.
    all_k_crispness = []
    max_invariance = 0.0
    for k in range(2, 31):
        labels = np.arange(30) % k
        chi = np.eye(k)[labels]
        mass = pu @ chi
        coarse = np.tile(mass, (k, 1))
        max_invariance = max(max_invariance, float(np.max(abs(uniform @ chi - chi @ coarse))))
        all_k_crispness.append(float(np.sum(np.sum(pu[:, None] * chi ** 2, axis=0) / mass) / k))
    check("uniform.low_crispness_request_refuted", min(all_k_crispness) > 1 - 1e-12
          and max_invariance < 1e-12 and curve[-1]["crispness"] > 1 - 1e-9,
          "uniform 30-state chain; explicit crisp invariant membership construction for EVERY k=2..30",
          requested_low_crispness_criterion="REFUTED, not satisfied", k_checked=len(all_k_crispness),
          min_constructed_crispness=min(all_k_crispness), max_invariance_error=max_invariance,
          gpcca_k30_crispness=curve[-1]["crispness"])
    evidence["fixtures"]["uniform"] = dict(search=search, curve=curve, inadmissible_dimensions=inadmissible,
        limitation="Crispness alone cannot reject structureless dynamics; requested criterion (c) is false.")

    a = [0, 0, 1, 1]
    independent = partition_similarity(a, [0, 1, 0, 1])
    same = partition_similarity(a, [8, 8, 3, 3])
    one = partition_similarity([0], [5])
    check("similarity.known_answers", abs(independent["nmi"]) < 1e-12 and abs(independent["vi"] - 2) < 1e-12
          and abs(independent["adjusted_rand"] + 0.5) < 1e-12 and same["nmi"] == 1 and one["adjusted_rand"] == 1,
          "four-state balanced independent partitions, relabelled identical partitions, and a singleton",
          independent=independent, identical=same, singleton=one)

    # Independent central finite differences for the trace(S) analytic gradient.
    X, _, _ = _ordered_schur(P, pi, 3)
    A, _ = _inner_simplex(X)
    A[1:] *= 0.7
    flat = A[:, :-1].ravel()
    _, gradient = _rotation_objective(flat, 3)
    finite = np.zeros_like(flat)
    step = 1e-6
    for j in range(len(flat)):
        shift = np.zeros_like(flat)
        shift[j] = step
        finite[j] = (_rotation_objective(flat + shift, 3)[0] - _rotation_objective(flat - shift, 3)[0]) / (2 * step)
    grad_error = float(np.max(abs(finite - gradient)))
    check("gpcca.objective_gradient", grad_error < 1e-7,
          "all six free rotation coordinates for planted-chain k=3; central step=1e-6",
          coordinates_checked=len(flat), max_gradient_error=grad_error)

    checks = [rejects(lambda: map_equation_L(np.eye(2), [0.5, 0.5], [0, 1])),
              rejects(lambda: map_equation_L([[0, 1], [1, 0]], [0.5, 0.5], [0, 1])),
              rejects(lambda: map_equation_L(P, np.roll(pi * np.linspace(0.5, 1.5, 30), 1), truth)),
              rejects(lambda: map_equation_L([[None, 1], [0.5, 0.5]], [0.5, 0.5], [0, 1])),
              rejects(lambda: map_equation_L(P, pi, truth[:-1])),
              rejects(lambda: map_equation_search(P, pi, restarts=0))]
    check("validation.bad_inputs", all(checks),
          "six malformed inputs: recurrent classes, periodicity, stationary vector, null, label coverage, restart count",
          inputs_rejected=sum(checks), rejection_floor=6)
    transient = np.asarray([[0, 1, 0], [0, 0.8, 0.2], [0, 0.3, 0.7]])
    pt = np.asarray([0, 0.6, 0.4])
    transient_L = map_equation_L(transient, pt, [0, 1, 1])
    check("validation.zero_mass_transients", abs(transient_L + _xlogx(pt).sum()) < 1e-12
          and rejects(lambda: gpcca(transient, pt, 2)),
          "three-state unichain with one zero-stationary-mass transient; full state set retained by map equation",
          map_L=transient_L, gpcca_rejects_zero_pi=True)

    changed = perturb(sparse.csr_matrix(P4), 0.3, np.random.default_rng(91))
    changed2 = perturb(P4, 0.3, np.random.default_rng(91))
    identity = perturb(P4, 0, np.random.default_rng(91))
    check("perturb.support_and_reproducibility", np.array_equal(changed.toarray(), changed2)
          and np.array_equal(changed2 > 0, P4 > 0) and np.array_equal(identity, P4)
          and np.max(abs(changed2.sum(axis=1) - 1)) < 1e-12,
          "all 40 states and 800 positive cells of the directed cycle; dense/CSR seed=91, eps=0.3 and eps=0",
          positive_cells=int(np.count_nonzero(changed2)), row_sum_error=float(np.max(abs(changed2.sum(axis=1) - 1))))
    again = map_equation_search(P, pi, restarts=3, seed=811)
    repeat = map_equation_search(P, pi, restarts=3, seed=811)
    check("search.determinism", np.array_equal(again["partition"], repeat["partition"])
          and again["spread"] == repeat["spread"] and again["coverage"] == repeat["coverage"],
          "two repeated map searches on all 30 planted-chain states; three restarts, seed=811",
          repeated_runs=2, restarts_per_run=3)

    # Audit every evaluated fast move delta against a full recomputation on a
    # directed, nonuniform flow, including aggregation and parent-constrained moves.
    rng = np.random.default_rng(351)
    audit_P = rng.dirichlet(np.ones(7), size=7)
    audit_pi = _stationary(audit_P)
    audit_flow = audit_pi[:, None] * audit_P
    audit_counts = dict(again["coverage"])
    audit_counts["delta_checks"] = 0
    for parents in (None, np.asarray([0, 0, 0, 1, 1, 1, 1])):
        _greedy(audit_flow, audit_pi, -_xlogx(audit_pi).sum(), np.arange(7), rng,
                audit_counts, parents=parents, audit=True)
    check("map.move_delta_independent", audit_counts["delta_checks"] >= 40,
          "seven-state dense directed Dirichlet chain, seed=351; unrestricted and submodule-constrained moves",
          independently_checked_deltas=audit_counts["delta_checks"], required_floor=40)

    perturbations = []
    for eps in (0.1, 0.3, 0.6):
        rows = []
        for seed in range(20):
            perturbed = perturb(P, eps, np.random.default_rng(seed))
            pp = _stationary(perturbed)
            searched = map_equation_search(perturbed, pp, restarts=8, seed=DEFAULT_SEED)
            fuzzy = gpcca(perturbed, pp, 3)
            spectral = spectral_baseline(perturbed, pp, 3)
            rows.append(dict(seed=seed,
                map_nmi=partition_similarity(truth, searched["partition"])["nmi"],
                gpcca_nmi=partition_similarity(truth, fuzzy["chi"].argmax(axis=1))["nmi"],
                spectral_nmi=partition_similarity(truth, spectral)["nmi"],
                crispness=fuzzy["crispness"], minChi=fuzzy["minChi"],
                initial_crispness=fuzzy["optimisation"]["initial_crispness"],
                optimisation_iterations=fuzzy["optimisation"]["iterations"],
                coarse_min=fuzzy["diagnostics"]["coarse_min"],
                coarse_flux_difference=fuzzy["diagnostics"]["coarse_flux_difference"]))
        summary = {method: {"min": min(row[method] for row in rows),
                            "median": float(np.median([row[method] for row in rows])),
                            "max": max(row[method] for row in rows)}
                   for method in ("map_nmi", "gpcca_nmi", "spectral_nmi", "crispness", "minChi")}
        check(f"perturb.eps_{eps}", len(rows) == 20 and all(np.isfinite(row[method]) for row in rows
              for method in ("map_nmi", "gpcca_nmi", "spectral_nmi")),
              f"all 30 planted-chain states; eps={eps}; seeds=0..19; recomputed pi; map restarts=8; k=3",
              seeds_checked=len(rows), summary=summary)
        perturbations.append(dict(eps=eps, rows=rows, summary=summary))
    optimised = [row for group in perturbations for row in group["rows"]]
    check("gpcca.optimisation_exercised", sum(row["optimisation_iterations"] > 0 for row in optimised) >= 50
          and min(row["crispness"] - row["initial_crispness"] for row in optimised) > -1e-8,
          "all 60 perturbed 30-state planted chains; eps in {0.1,0.3,0.6}; seeds=0..19",
          nontrivial_optimisations=sum(row["optimisation_iterations"] > 0 for row in optimised),
          max_crispness_gain=max(row["crispness"] - row["initial_crispness"] for row in optimised),
          max_coarse_flux_difference=max(row["coarse_flux_difference"] for row in optimised))
    evidence["perturbations"] = perturbations
    check("coverage.floor", len(records) + 1 >= SELFCHECK_FLOOR,
          "all named synthetic/independent/stability checks executed by this selfcheck",
          checks_run=len(records) + 1, required_floor=SELFCHECK_FLOOR)
    failures = sum(record["status"] == "FAIL" for record in records)
    evidence["checks_run"] = len(records)
    evidence["failures"] = failures
    if output:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(_jsonable(evidence), indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(f"{'FAIL' if failures else 'PASS'}: {len(records)} checks run; floor={SELFCHECK_FLOOR}; failures={failures}; "
          "scope=synthetic chains only; requested low-crispness control REFUTED; " + RECOMPUTE, flush=True)
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selfcheck", action="store_true", help="run synthetic proofs and independent checks")
    parser.add_argument("--output", help="optional JSON evidence path (requires --selfcheck)")
    args = parser.parse_args()
    if not args.selfcheck:
        parser.error("this method module only has a --selfcheck CLI; it does not read the real graph")
    try:
        return selfcheck(args.output)
    except Exception as error:
        print(f"FAIL: selfcheck aborted ({type(error).__name__}: {error}); "
              f"required coverage floor={SELFCHECK_FLOOR} NOT certified; {RECOMPUTE}",
              file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
