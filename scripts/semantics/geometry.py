#!/usr/bin/env python3
"""G2R: which distance on the map MEANS something, and does the shipped layout carry it.

Everything here is about THE CORPUS'S GAME (both seats sample the authored attempt shares; not the
app's opponent policy). Primary configuration (gs-shared ruling 4): no-gi, symmetric initiative,
shipped rates, origin filter ON, H = infinity. Controls: shipped initiative; gi at shipped and at
frame rates; origin=False; and, for the exit law, the clocked roll (maxMoves uniform on 9..12 plies).

THE METRIC THAT MEANS SOMETHING (lane G2R, Proposition 1). The exit law E_x — the law of which
finisher ends the roll, or a draw — is the harmonic measure: every question about how the roll
ends, g on the exit columns, is answered at every state by h_g = E g, the unique harmonic function
with boundary data g. Hence
    sup_{|g| <= 1} |h_g(x) - h_g(y)| = 2 TV(E_x, E_y),   attained at g = sign(E_x - E_y),
and TV is the smallest metric in which every ending probability (the committor, one family's
finish risk, ...) is 1-Lipschitz. Hellinger and JS inherit that meaning through Proposition 2:
H^2 <= TV <= H sqrt(2 - H^2) <= sqrt(2) H  and  J^2 <= TV <= sqrt(2 ln 2) J.
`--selfcheck` proves both on chains with known answers; the real run re-checks them on every hub
pair and on the reachable state pairs, attains the bound by a harmonic solve, by an LU-free
iteration, and (primary only) by a seeded Monte Carlo that samples the kernel's CELL TABLE.

    python3 -B scripts/semantics/geometry.py --selfcheck
    python3 -B scripts/semantics/geometry.py [--full <dir>]

Output: tests/artifacts/semantics/geometry.json — the slim committed artifact (< 1 MB, floats to 6
significant digits). `--full <dir>` also writes geometry_full.json (full precision: every hub's
exit profile, every technique-origin record, every perturbation replicate) into <dir>.
"""

from __future__ import annotations

import argparse
from collections import deque
import copy
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np
from scipy import sparse
from scipy.sparse.csgraph import shortest_path
from scipy.spatial.distance import pdist, squareform
from scipy.stats import rankdata
from sklearn.metrics import adjusted_rand_score
from threadpoolctl import threadpool_limits

from _geometry_methods import (REPO, _diffusion_direct, _first_passage_direct, _require,
                               approximation_gap, commute_time, diffusion_distance,
                               diffusion_map, layout_fidelity, load_shipped_layout,
                               mean_first_passage, selfcheck as g1_selfcheck)
from _geometry_analysis import (SEED, FidelityCache, absorbing_monte_carlo, align_layout,
                                classical_mds, divergence_sandwich, exit_distances,
                                flat_fidelity, group_finish_columns, hull_purity, kmedoids,
                                move_statistics, null_summary, seat_exit_profiles, seat_swap,
                                select_kmedoids, tagged_rng, technique_origin_statistics,
                                total_variation, selfcheck as g2_selfcheck)
from _kernel import ID, IL, IW, Kernel, load_kernel


COMMAND = "python3 -B scripts/semantics/geometry.py"
PRIMARY = "nogi/symmetric/shipped"
# (frame, initiative, rates, origin filter). The first row is the primary (ruling 4).
CONFIGURATIONS = (("nogi", "symmetric", "shipped", True), ("nogi", "shipped", "shipped", True),
                  ("gi", "symmetric", "shipped", True), ("gi", "shipped", "shipped", True),
                  ("gi", "symmetric", "frame", True), ("gi", "shipped", "frame", True),
                  ("nogi", "symmetric", "shipped", False))
# The three single-axis departures ruling 1 asks every per-hub conclusion to survive.
AXES = {"other_initiative": "nogi/shipped/shipped", "other_frame": "gi/symmetric/shipped",
        "origin_off": "nogi/symmetric/shipped/origin=False"}
OUTPUT = REPO / "tests/artifacts/semantics/geometry.json"
KS = tuple(range(2, 11))
CLOCK = tuple(range(9, 13))                     # maxMoves = 9 + floor(4 rng): uniform on 9..12 plies
EXIT_METRICS = ("exit_tv", "exit_hellinger", "exit_js")
# neural/src/app.src.jsx, _deriveDualPairs: sx = (gx - gy) cos30, sy = (gx + gy) sin30.
SCREEN = np.array([[math.cos(math.pi / 6), -math.cos(math.pi / 6)],
                   [math.sin(math.pi / 6), math.sin(math.pi / 6)]])


def tag_of(config):
    tag = "/".join(config[:3])
    return tag if config[3] else tag + "/origin=False"


def jsonable(value):
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, np.ndarray):
        return jsonable(value.tolist())
    if isinstance(value, (tuple, list)):
        return [jsonable(x) for x in value]
    if isinstance(value, np.generic):
        return value.item()
    return value


def rounded(value, digits=6):
    """Deterministic significant-digit rounding for the committed (slim) artifact."""
    if isinstance(value, dict):
        return {k: rounded(v, digits) for k, v in value.items()}
    if isinstance(value, list):
        return [rounded(v, digits) for v in value]
    if isinstance(value, float):
        return float(f"{value:.{digits}g}") if math.isfinite(value) else value
    return value


def coverage_line(message, set_definition, counts):
    print(f"{message}; SET: {set_definition}; command: {COMMAND}; "
          + json.dumps(jsonable(counts), sort_keys=True), flush=True)


def upper_ranks(D):
    """Centred, unit-norm ranks of the unordered pairs: a dot product is Spearman's rho."""
    r = rankdata(D[np.triu_indices(len(D), 1)])
    r -= r.mean()
    n = np.linalg.norm(r)
    _require(n > 0, "constant pair distances")
    return r / n


# --------------------------------------------------------------------------- #
# topology benchmark + integration toys (unchanged from G2)
# --------------------------------------------------------------------------- #
def layout_hops(layout, position_layout_ids):
    """Undirected, unweighted hops in the full shipped position+technique graph.

    This is a topology benchmark, never a Markov chain. Verify all requested
    pair distances by an independent adjacency-list BFS, keyed by full IDs.
    """
    nodes = layout["nodes"]
    ids = tuple(sorted(n["id"] for n in nodes))
    _require(len(ids) > 0 and len(set(ids)) == len(ids), "empty/duplicate topology IDs")
    index = {name: i for i, name in enumerate(ids)}
    _require(len(position_layout_ids) > 0 and set(position_layout_ids) <= set(ids), "topology position join failed")
    edges, adjacency = set(), [set() for _ in ids]
    for edge in layout["links"]:
        a, b = edge["source"], edge["target"]
        _require(a in index and b in index and a != b, "invalid topology link")
        pair = tuple(sorted((index[a], index[b])))
        _require(pair not in edges, "duplicate undirected topology link")
        edges.add(pair)
        adjacency[pair[0]].add(pair[1])
        adjacency[pair[1]].add(pair[0])
    _require(edges, "zero topology links scanned")
    row, col = zip(*sorted(edges))
    A = sparse.csr_matrix((np.ones(2 * len(row)), (row + col, col + row)), shape=(len(ids), len(ids)))
    sources = np.array([index[name] for name in position_layout_ids])
    D = shortest_path(A, directed=False, unweighted=True, indices=sources)[:, sources]
    _require(np.isfinite(D).all(), "position hubs are not connected in topology benchmark")
    checked = 0
    for i, source in enumerate(sources):
        seen = {int(source): 0}
        queue = deque([int(source)])
        while queue:
            node = queue.popleft()
            for neighbour in adjacency[node]:
                if neighbour not in seen:
                    seen[neighbour] = seen[node] + 1
                    queue.append(neighbour)
        expected = np.array([seen[int(j)] for j in sources])
        _require(np.array_equal(D[i], expected), "sparse shortest paths disagree with BFS")
        checked += len(sources)
    return D, {"layout_nodes": len(ids), "undirected_links": len(edges),
               "position_hubs": len(sources), "bfs_rows_checked": len(sources),
               "ordered_pairs_including_diagonal_checked": checked}


def integration_selfcheck():
    """Small known topology and stationary-flow aggregation, before real data."""
    fixture = {"nodes": [{"id": x} for x in ("p/a", "p/b", "p/c", "t/x")],
               "links": [{"source": a, "target": b} for a, b in
                         (("p/a", "t/x"), ("t/x", "p/b"), ("p/b", "p/c"))]}
    D, counted = layout_hops(fixture, ["p/a", "p/b", "p/c"])
    _require(np.array_equal(D, [[0, 2, 3], [2, 0, 1], [3, 1, 0]]), "topology toy closed form")
    P = np.full((4, 4), .25)
    Pa, mass = Kernel.lump(sparse.csr_matrix(P), np.full(4, .25), [0, 0, 1, 2], 4)
    _require(np.array_equal(mass, [.5, .25, .25, 0]), "lump toy stationary mass")
    _require(np.array_equal(Pa[:3, :3], np.tile([.5, .25, .25], (3, 1)))
             and np.array_equal(Pa[3], np.zeros(4)), "lump toy flow and explicit zero-mass group")
    # Proposition 3 on a known pair: ground (1,1) is the least-stretched direction (1/sqrt2),
    # ground (1,-1) the most (sqrt(3/2)).
    stretch = np.linalg.norm(np.array([[1, 1], [1, -1]]) @ SCREEN.T, axis=1) / np.sqrt(2)
    _require(np.allclose(stretch, [1 / np.sqrt(2), np.sqrt(1.5)], atol=1e-15), "screen projection stretch")
    print("PASS G2 integration toys; SET: four-node path through a technique, four-state uniform chain, "
          "screen projection eigen-directions; command: python3 -B scripts/semantics/geometry.py --selfcheck; "
          + json.dumps({"assertions": 4, "topology": counted}, sort_keys=True), flush=True)
    return {"assertions": 4, "topology": counted}


def synthetic_gate():
    return {"g1": g1_selfcheck(), "g2": g2_selfcheck(), "integration": integration_selfcheck()}


# --------------------------------------------------------------------------- #
# the kernel side: Q-process hub chain, extended exit law, clocked exit law
# --------------------------------------------------------------------------- #
def qprocess_hubs(K):
    q = K.qprocess()
    groups = K.groups_hub()[q["idx"]]
    # K.lump's sparse implementation is the shared authority; only convert its
    # dense qprocess result to CSR, without modifying entries.
    full, mass = K.lump(sparse.csr_matrix(q["Pq"]), q["mu"], groups, len(K.hubs))
    keep = np.flatnonzero(mass > 0)
    hubs = tuple(K.hubs[i] for i in keep)
    P, mu = full[np.ix_(keep, keep)], mass[keep]
    _require(len(hubs) >= 120 and mu.min() > 0, "positive Q-process hub support below floor 120")
    _require(np.max(np.abs(P.sum(axis=1) - 1)) < 1e-10
             and np.max(np.abs(mu @ P - mu)) < 1e-10, "hub lump lost stationarity/mass")
    # Independent stationary-flow sum, verifying all hub-to-hub cells.
    grouped = np.zeros((len(K.hubs), len(K.hubs)))
    for a in range(len(K.hubs)):
        selected = groups == a
        if selected.any():
            outgoing = np.sum(q["mu"][selected, None] * q["Pq"][selected], axis=0)
            grouped[a] = np.bincount(groups, weights=outgoing, minlength=len(K.hubs))
    error = float(np.max(np.abs(grouped - mass[:, None] * full)))
    _require(error < 1e-12, "K.lump disagrees with direct stationary-flow sums")
    return P, mu, hubs, {"qprocess_transient_states": len(q["idx"]), "positive_mass_hubs": len(hubs),
                         "excluded_zero_mass_hubs": [h for h in K.hubs if h not in hubs],
                         "per_step_survival": float(q["lam"]), "minimum_hub_mass": float(mu.min()),
                         "lump_flow_max_abs_error": error,
                         "lump_cells_crosschecked": len(K.hubs) ** 2}


def extended_exit_law(K, verify=True):
    """E = [K.exit_law() | the draw column]: every transient row sums to one.

    Proposition 1 needs the draw column: without it a row sums to 1 - P(draw)
    and the event form of the bound is false (the helper selfcheck shows it).
    """
    Bf, residual = K.exit_law()
    lu = K.fundamental()
    Rd = K.R[:, [ID]]
    BD = lu.solve(np.asarray(Rd.todense()))
    E = np.hstack([Bf, BD.reshape(-1, 1)])
    Rext = sparse.hstack([K.R_fin, Rd]).tocsr()
    row_error = float(np.max(np.abs(E.sum(axis=1) - 1)))
    _require(row_error < 1e-12, f"extended exit law rows do not sum to one ({row_error:.3g})")
    info = {"transient_rows": K.n_t, "exit_columns": E.shape[1], "finisher_columns": Bf.shape[1],
            "kernel_harmonic_residual": residual, "row_sum_max_error": row_error,
            "max_draw_mass_any_state": float(BD.max()),
            "max_draw_mass_reachable": float(BD.ravel()[K.reach_t].max())}
    if verify:
        B, res = K.absorption()                     # a separate LU of (I - Q) against R
        me = np.array([p == "me" for _, p in K.fin_cols])
        err = max(float(np.max(np.abs(Bf[:, me].sum(axis=1) - B[:, IW]))),
                  float(np.max(np.abs(Bf[:, ~me].sum(axis=1) - B[:, IL]))),
                  float(np.max(np.abs(BD.ravel() - B[:, ID]))))
        _require(err < 1e-12, "exit law disagrees with K.absorption() on W/L/D")
        info["absorption_consistency_max_abs_error"] = err
    return E, Rext, info


def clocked_exit_law(K, Rext):
    """Exit law of the CLOCKED roll: maxMoves uniform on CLOCK plies, plus a clock column.

    The recursion is the kernel's own ply recursion (finite_horizon) run on every
    exit column; its W/L column sums are checked against K.finite_horizon(H) for
    each H, which the kernel gate ties to solve_edge_values.solve(policy="sample").
    """
    R = Rext.toarray()
    X = np.zeros_like(R)
    me = np.array([p == "me" for _, p in K.fin_cols] + [False])
    them = np.array([p == "them" for _, p in K.fin_cols] + [False])
    laws, worst = [], 0.0
    for H in range(1, max(CLOCK) + 1):
        Y = R + K.Q1 @ X
        X = Y + K.Q0 @ Y
        if H in CLOCK:
            Vw, Vl = K.finite_horizon(H)
            worst = max(worst, float(np.max(np.abs(X[:, me].sum(axis=1) - Vw))),
                        float(np.max(np.abs(X[:, them].sum(axis=1) - Vl))))
            laws.append(X.copy())
    _require(worst < 1e-12, f"clocked exit law disagrees with K.finite_horizon ({worst:.3g})")
    mix = np.mean(laws, axis=0)
    clock = 1 - mix.sum(axis=1)
    _require(clock.min() > -1e-12, "clocked law exceeds one")
    law = np.hstack([mix, np.maximum(clock, 0).reshape(-1, 1)])
    start = K.start("standing", "me")
    return law, {"horizons_plies": CLOCK, "finite_horizon_max_abs_error": worst,
                 "clock_min_raw": float(clock.min()),
                 "from_standing_me_first": {"p_i_finish": float(start @ mix[:, me].sum(axis=1)),
                                            "p_they_finish": float(start @ mix[:, them].sum(axis=1)),
                                            "p_draw": float(start @ mix[:, -1]),
                                            "p_clock": float(start @ law[:, -1])}}


def hub_exit_laws(K, hubs, E, clocked):
    """Hub laws on (TOP kinds | BOTTOM kinds | DRAW [| CLOCK]); TOP/BOTTOM = starting seats."""
    meta = K.fin_meta()
    _require([(m["technique"], m["performer"]) for m in meta] == list(K.fin_cols),
             "finisher metadata/column identity mismatch")
    nf = len(meta)
    G, types = group_finish_columns(meta, "type")
    Gt, techniques = group_finish_columns(meta, "technique")
    draw = E[:, nf:]
    out = {}
    out["type"] = seat_exit_profiles(E[:, :nf] @ G, K.role_nodes, types, hubs, (.5, .5), draw, (("DRAW", "draw"),))
    out["technique"] = seat_exit_profiles(E[:, :nf] @ Gt, K.role_nodes, techniques, hubs, (.5, .5), draw,
                                          (("DRAW", "draw"),))
    out["clocked"] = seat_exit_profiles(clocked[:, :nf] @ G, K.role_nodes, types, hubs, (.5, .5), clocked[:, nf:],
                                        (("DRAW", "draw"), ("CLOCK", "clock")))
    out["me_first"] = seat_exit_profiles(E[:, :nf] @ G, K.role_nodes, types, hubs, (1, 0), draw, (("DRAW", "draw"),))
    rows = out["type"][2]
    # Independent forward harmonic iteration on the grouped rewards (draw included),
    # not another graph-derived chain and not another LU.
    grouped = np.hstack([E[:, :nf] @ G, draw])
    reward = np.hstack([np.asarray(K.R_fin @ G), np.asarray(K.R[:, [ID]].todense())])
    iterate = np.zeros_like(grouped)
    for step in range(1, 20001):
        updated = reward + K.Q @ iterate
        if np.max(np.abs(updated - iterate)) < 1e-14:
            iterate = updated
            break
        iterate = updated
    else:
        raise ValueError("grouped harmonic iteration did not converge")
    error = float(np.max(np.abs(iterate - grouped)))
    _require(error < 1e-11, "exit-law LU disagrees with forward harmonic iteration")
    profiles = out["type"][0]
    info = {"finisher_columns": nf, "raw_types": len(types), "techniques": len(techniques),
            "hub_type_columns": len(out["type"][1]), "hub_technique_columns": len(out["technique"][1]),
            "source_transient_rows": len(rows), "source_row_floor": 4 * len(hubs),
            "source_rows_outside_standing_reach": sum(1 for t in rows if not K.reach_t[t]),
            "max_draw_mass_in_source_rows": float(draw[rows].max()),
            "row_sum_max_error": float(np.max(np.abs(profiles.sum(axis=1) - 1))),
            "harmonic_iteration_steps": step, "harmonic_iteration_max_abs_error": error,
            "non_submission_finisher_columns": sum(1 for m in meta if not m["isSubmissionNode"]),
            "coin_vs_me_first_max_hub_total_variation":
                float(np.max(np.abs(profiles - out["me_first"][0]).sum(axis=1) / 2))}
    _require(len(rows) >= 4 * len(hubs), "hub exit-law source rows below floor")
    return out, (G, types), info


# --------------------------------------------------------------------------- #
# Proposition 1, checked on the real kernel
# --------------------------------------------------------------------------- #
def _pair_excess(h, TV, factor):
    """max over unordered pairs of |h_i - h_j| - factor * TV_ij (<= 0 is the bound)."""
    return float(np.max(np.abs(h[:, None] - h[None, :]) - factor * TV))


def _ratio_stats(num, den):
    keep = den > 1e-9
    _require(keep.any(), "no positive-TV pairs for a ratio")
    r = num[keep] / den[keep]
    return {"pairs": int(keep.sum()), "median": float(np.median(r)), "p90": float(np.quantile(r, .9)),
            "max": float(r.max()), "mass_share": float(num[keep].sum() / den[keep].sum())}


def harmonic_bound_states(K, E, Rext, tag, mc_walkers=0):
    """State level: S = transient states reachable from standing; full exit law (finisher x who + draw)."""
    S = np.flatnonzero(K.reach_t)
    TV = total_variation(E[S])
    iu = np.triu_indices(len(S), 1)
    flat = TV[iu]
    order = np.argsort(flat, kind="stable")
    top, median = int(order[-1]), int(order[len(order) // 2])
    rng = tagged_rng(f"harmonic-pairs/{tag}")
    sample = [int(i) for i in rng.choice(len(flat), size=min(1000, len(flat)), replace=False)]
    chosen = [top, median] + [i for i in sample if i not in (top, median)]
    X, Y = S[iu[0][chosen]], S[iu[1][chosen]]
    target = flat[chosen]
    lu = K.fundamental()
    star = np.sign(E[X] - E[Y]).T
    rhs = np.asarray(Rext @ star)
    Hs = lu.solve(rhs)                                         # the Dirichlet problem, per question
    cols = np.arange(len(chosen))
    attained = Hs[X, cols] - Hs[Y, cols]
    err_lu = float(np.max(np.abs(attained - 2 * target)))
    it = np.zeros_like(rhs)                                    # LU-free route: h <- R g + Q h
    for steps in range(1, 20001):
        nxt = rhs + K.Q @ it
        if np.max(np.abs(nxt - it)) < 1e-14:
            it = nxt
            break
        it = nxt
    else:
        raise ValueError("harmonic iteration did not converge")
    err_iter = float(np.max(np.abs((it[X, cols] - it[Y, cols]) - 2 * target)))
    event = (E[X] > E[Y]).T.astype(float)
    He = lu.solve(np.asarray(Rext @ event))
    err_event = float(np.max(np.abs((He[X, cols] - He[Y, cols]) - target)))
    _require(max(err_lu, err_iter, err_event) < 1e-10, f"Proposition 1 not attained on {tag}")

    # The bound on EVERY reachable pair, for seeded random and named questions.
    nf = len(K.fin_cols)
    me = np.array([p == "me" for _, p in K.fin_cols] + [False], dtype=float)
    them = np.array([p == "them" for _, p in K.fin_cols] + [False], dtype=float)
    types = [m["type"] for m in K.fin_meta()] + [None]
    kinds = sorted({t for t in types if t is not None})
    named = {"i_finish": me, "they_finish": them, "draw": np.r_[np.zeros(nf), 1.0]}
    for kind in kinds:
        named["anyone_finishes_by:" + kind] = np.array([t == kind for t in types], dtype=float)
    random_g = tagged_rng(f"harmonic-questions/{tag}").uniform(-1, 1, size=(E.shape[1], 64))
    ES = E[S]
    excess_random = max(_pair_excess(h, TV, 2) for h in (ES @ random_g).T)
    excess_named = max(_pair_excess(ES @ g, TV, 1) for g in named.values())
    _require(max(excess_random, excess_named) <= 1e-12, f"Proposition 1 bound violated on {tag}")
    committor = ES @ me
    dq = np.abs(committor[:, None] - committor[None, :])[iu]
    per_type = np.max([np.abs((ES @ named["anyone_finishes_by:" + k])[:, None]
                              - (ES @ named["anyone_finishes_by:" + k])[None, :])[iu] for k in kinds], axis=0)
    out = {
        "set_definition": "transient states (role-node x whose turn) reachable from standing; exit columns = "
                          "every (finishing technique, who) plus the draw",
        "states": len(S), "exit_columns": E.shape[1], "unordered_pairs": len(flat),
        "tv_min_median_max": [float(flat.min()), float(np.median(flat)), float(flat.max())],
        "attainment": {"pairs_solved": len(chosen), "lu_max_abs_error": err_lu,
                       "lu_free_iteration_max_abs_error": err_iter, "lu_free_iteration_steps": steps,
                       "event_form_max_abs_error": err_event,
                       "max_pair": {"x": list(K.labels[X[0]]), "y": list(K.labels[Y[0]]), "tv": float(target[0]),
                                    "h_gstar_difference": float(attained[0])},
                       "median_pair": {"x": list(K.labels[X[1]]), "y": list(K.labels[Y[1]]),
                                       "tv": float(target[1]), "h_gstar_difference": float(attained[1])}},
        "bound_checked": {"random_questions": random_g.shape[1], "named_events": len(named),
                          "pair_question_comparisons": len(flat) * (random_g.shape[1] + len(named)),
                          "max_excess_random_2tv": excess_random, "max_excess_named_tv": excess_named},
        "committor_share_of_tv": _ratio_stats(dq, flat),
        "best_single_raw_type_share_of_tv": _ratio_stats(per_type, flat),
    }
    if mc_walkers:
        out["monte_carlo"] = state_monte_carlo(K, E, [(X[0], Y[0]), (X[1], Y[1])], target[:2], mc_walkers, tag)
    return out


def state_monte_carlo(K, E, pairs, tvs, walkers, tag):
    """Seeded simulation over K.cells (the cell TABLE, no matrix): does 2 TV come out of rolls?"""
    c = K.cells
    nf = len(K.fin_cols)
    results = []
    for (x, y), tv in zip(pairs, tvs):
        star = np.sign(E[x] - E[y])
        freqs, var, steps = [], 0.0, 0
        for s in (x, y):
            counts, n = absorbing_monte_carlo(c["src"], c["mass"], c["dst"], c["fin"], K.n_t, nf, int(s),
                                              walkers, tagged_rng(f"state-mc/{tag}/{int(s)}"))
            _require(counts[nf + IW] == 0 and counts[nf + IL] == 0, "a W/L cell carried no finisher column")
            f = np.r_[counts[:nf], counts[nf + ID]] / walkers
            _require(np.all(f[E[s] == 0] == 0), "Monte Carlo reached an exit the exact law says is impossible")
            freqs.append(f)
            var += (f @ star ** 2 - (f @ star) ** 2) / walkers
            steps += n
        diff = float((freqs[0] - freqs[1]) @ star)
        se = float(np.sqrt(var))
        z = (diff - 2 * tv) / se
        _require(abs(z) < 5, f"Monte Carlo 2 TV disagrees: z = {z:.2f}")
        results.append({"x": list(K.labels[x]), "y": list(K.labels[y]), "exact_2tv": float(2 * tv),
                        "monte_carlo_difference": diff, "standard_error": se, "z": float(z),
                        "walkers_per_state": walkers, "simulated_steps": steps,
                        "monte_carlo_tv_to_exact_x": float(np.abs(freqs[0] - E[x]).sum() / 2),
                        "monte_carlo_tv_to_exact_y": float(np.abs(freqs[1] - E[y]).sum() / 2)})
    return results


def harmonic_bound_hubs(K, E, Rext, grouping, hubs, profiles, labels):
    """Hub level, on EVERY hub pair: the hub answer to a hub question is an average of
    harmonic functions (pull the question back through each starting seat); Proposition 1
    holds for the mixture law and is attained. Also: coarsening and mixture (convexity) gaps."""
    G, types = grouping
    nf, kinds, extras = len(K.fin_cols), len(types), E.shape[1] - len(K.fin_cols)
    Gext = np.zeros((nf + extras, 2 * kinds + extras))
    Gext[:nf, :2 * kinds] = G
    Gext[nf:, 2 * kinds:] = np.eye(extras)
    swap = seat_swap(kinds, extras)
    TVh = total_variation(profiles)
    iu = np.triu_indices(len(hubs), 1)
    star = np.sign(profiles[iu[0]] - profiles[iu[1]]).T
    lu = K.fundamental()
    Ht = lu.solve(np.asarray(Rext @ (Gext @ star)))
    Hb = lu.solve(np.asarray(Rext @ (Gext @ swap @ star)))
    n = K.n_r
    top = np.array([K.index[h + "/top"] for h in hubs])
    bottom = np.array([K.index[h + "/bottom"] for h in hubs])

    def value(i, cols):
        return 0.25 * (Ht[top[i], cols] + Ht[top[i] + n, cols] + Hb[bottom[i], cols] + Hb[bottom[i] + n, cols])

    cols = np.arange(len(iu[0]))
    got = value(iu[0], cols) - value(iu[1], cols)
    err = float(np.max(np.abs(got - 2 * TVh[iu])))
    _require(err < 1e-10, "hub-level Proposition 1 not attained")
    # Mixture (joint convexity): TV(hub mixtures) <= mean over (seat, turn) of relabelled state TVs.
    grouped = np.hstack([E[:, :nf] @ G, E[:, nf:]])
    parts = []
    for rows, relabel in ((top, np.eye(2 * kinds + extras)), (top + n, np.eye(2 * kinds + extras)),
                          (bottom, swap), (bottom + n, swap)):
        parts.append(total_variation(grouped[rows] @ relabel))
    bound = np.mean(parts, axis=0)
    convexity = float(np.max(TVh - bound))
    _require(convexity <= 1e-12, "hub TV exceeds the mixture bound")
    top_cols = np.array([s == "TOP" for s, _ in labels], dtype=float)
    p_top = profiles @ top_cols
    k = int(np.argmax(TVh[iu]))
    a, b = iu[0][k], iu[1][k]
    delta = profiles[a] - profiles[b]
    lead = np.argsort(-np.abs(delta), kind="stable")[:6]
    return {"set_definition": "positive-mass Q-process hubs; hub law = fair seat x fair turn mixture on "
                              "(starting-seat of finisher x raw type) + draw",
            "hubs": len(hubs), "unordered_pairs": len(iu[0]), "attained_max_abs_error": err,
            "tv_min_median_max": [float(TVh[iu].min()), float(np.median(TVh[iu])), float(TVh[iu].max())],
            "mixture_bound": {"max_excess": convexity,
                              "hub_tv_over_mean_state_tv": _ratio_stats(TVh[iu], bound[iu])},
            "top_seat_finishes_share_of_tv": _ratio_stats(np.abs(p_top[:, None] - p_top[None, :])[iu], TVh[iu]),
            "max_pair": {"x": hubs[a], "y": hubs[b], "tv": float(TVh[a, b]),
                         "separating_columns": [{"column": list(labels[j]), "x_minus_y": float(delta[j])}
                                                for j in lead]}}


# --------------------------------------------------------------------------- #
# per-configuration analysis
# --------------------------------------------------------------------------- #
def displacement_benchmark(raw, shipped, permutations, diameter):
    results, coordinates = {}, {}
    for mode in ("rms", "least_squares"):
        aligned, info = align_layout(raw, shipped, mode)
        observed = move_statistics(aligned, shipped, diameter)
        observed["procrustes_disparity"] = info["procrustes_disparity"]
        observed["rms_radius_ratio"] = info["rms_radius_ratio"]
        samples = {key: [] for key in observed}
        for p in permutations:
            moved, null_info = align_layout(raw[p], shipped, mode)
            trial = move_statistics(moved, shipped, diameter)
            trial["procrustes_disparity"] = null_info["procrustes_disparity"]
            trial["rms_radius_ratio"] = null_info["rms_radius_ratio"]
            for key, value in trial.items():
                samples[key].append(value)
        results[mode] = {"alignment": info,
                         "metrics": {key: null_summary(value, samples[key], higher=False)
                                     for key, value in observed.items()}}
        coordinates[mode] = aligned
    return results, coordinates


def print_fidelity(tag, layout, target, row, n):
    fields = []
    for metric in ("spearman", "jaccard_at10", "trustworthiness_at5", "continuity_at5"):
        v = row[metric]
        fields.append(f"{metric}={v['observed']:.4f} (null {v['null_mean']:.4f}, "
                      f"95% [{v['null_p025']:.4f},{v['null_p975']:.4f}], p={v['permutation_p']:.4f})")
    print(f"FIDELITY {tag} / {layout} vs {target}; SET: {n} positive-mass hubs, equal hub weights; "
          f"command: {COMMAND}; " + "; ".join(fields), flush=True)


def target_concordance(distances, permutations):
    """Spearman between target metrics over hub pairs, with a Mantel (hub-relabelling) null."""
    names = sorted(distances)
    ranks = {name: upper_ranks(D) for name, D in distances.items()}
    out = {}
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            nulls = [float(ranks[a] @ upper_ranks(distances[b][np.ix_(p, p)])) for p in permutations]
            out[a + " ~ " + b] = null_summary(float(ranks[a] @ ranks[b]), nulls)
    return out


def analyse_case(config, graph, joined, all_hubs, full_hops, diameter, replicates, primary=False):
    tag = tag_of(config)
    frame, initiative, rates, origin = config
    K = load_kernel(frame=frame, initiative=initiative, rates=rates, graph=graph, origin=origin)
    P, mu, hubs, qinfo = qprocess_hubs(K)
    _require(set(hubs) <= set(joined["positions"]), "kernel/layout hub ID join is incomplete")
    xy = np.array([joined["positions"][h]["xy"] for h in hubs])
    E, Rext, einfo = extended_exit_law(K)
    clocked, cinfo = clocked_exit_law(K, Rext)
    laws, grouping, linfo = hub_exit_laws(K, hubs, E, clocked)
    profiles, labels = laws["type"][0], laws["type"][1]
    exits = exit_distances(profiles)
    indices = np.array([all_hubs.index(h) for h in hubs])
    distances = {f"diffusion_t{t}": diffusion_distance(P, mu, t) for t in (1, 2, 4)}
    m = mean_first_passage(P, mu)
    direct = _first_passage_direct(P)
    passage_error = float(np.max(np.abs(m - direct) / np.maximum(1, direct)))
    _require(passage_error < 1e-9, "real hub first-passage disagreement")
    distances["commute"] = commute_time(P, mu)
    distances.update({"exit_tv": exits["tv"], "exit_hellinger": exits["hellinger"], "exit_js": exits["js"],
                      "exit_tv_technique": total_variation(laws["technique"][0]),
                      "exit_tv_clocked": total_variation(laws["clocked"][0]),
                      "unweighted_hops": full_hops[np.ix_(indices, indices)]})
    coarsening = float(np.max(distances["exit_tv"] - distances["exit_tv_technique"]))
    _require(coarsening <= 1e-12, "type-grouped TV exceeds technique TV (coarsening corollary)")
    diffusion_errors = {str(t): float(np.max(np.abs(distances[f"diffusion_t{t}"]
                                             - _diffusion_direct(P, mu, t)))) for t in (1, 2, 4)}
    _require(max(diffusion_errors.values()) < 1e-9, "real diffusion direct-sum disagreement")
    sandwich = divergence_sandwich(exits["tv"], exits["hellinger"], exits["js"])
    state_bound = harmonic_bound_states(K, E, Rext, tag, mc_walkers=40000 if primary else 0)
    hub_bound = harmonic_bound_hubs(K, E, Rext, grouping, hubs, profiles, labels)
    coverage_line("KERNEL/JOIN PASS " + tag, "standing-reachable Q-process, mu-weighted hub aggregation", {
        **{k: v for k, v in qinfo.items() if k != "excluded_zero_mass_hubs"},
        "excluded_zero_mass_hubs": len(qinfo["excluded_zero_mass_hubs"]),
        "exit_law": einfo, "clocked": cinfo, "hub_laws": linfo,
        "first_passage_targets_crosschecked": len(hubs), "mfpt_max_relative_error": passage_error,
        "diffusion_max_abs_errors": diffusion_errors, "coarsening_max_excess": coarsening})
    coverage_line("PROPOSITION 1 PASS " + tag, state_bound["set_definition"], {
        "pairs": state_bound["unordered_pairs"], "attainment": state_bound["attainment"],
        "bound": state_bound["bound_checked"], "committor_share": state_bound["committor_share_of_tv"],
        **({"monte_carlo": state_bound["monte_carlo"]} if primary else {})})
    coverage_line("PROPOSITION 1 HUBS PASS " + tag, hub_bound["set_definition"], hub_bound)
    coverage_line("PROPOSITION 2 PASS " + tag, f"{len(hubs)} positive-mass hubs, type-grouped exit law", sandwich)

    permutations = np.array([tagged_rng(f"coordinates/{len(hubs)}/{i}").permutation(len(hubs))
                             for i in range(replicates)])
    cache = FidelityCache(distances)
    raw_alternatives = {f"diffusion_t{t}": diffusion_map(P, mu, t, 2) for t in (1, 2, 4)}
    mds_h, mds_h_info = classical_mds(exits["hellinger"], 2)
    mds_tv, mds_tv_info = classical_mds(exits["tv"], 2)
    raw_alternatives["exit_hellinger_mds"] = mds_h
    raw_alternatives["exit_tv_mds"] = mds_tv
    layouts = {"shipped": xy, "shipped_screen": xy @ SCREEN.T}
    motion, alternatives = {}, {}
    for name, raw in raw_alternatives.items():
        motion[name], aligned = displacement_benchmark(raw, xy, permutations, diameter)
        layouts[name] = aligned["rms"]
        alternatives[name] = {"ground_coordinates_rms": aligned["rms"],
                              "ground_coordinates_least_squares": aligned["least_squares"]}
        own = {"exit_hellinger_mds": "exit_hellinger", "exit_tv_mds": "exit_tv"}.get(name, name)
        raw_gap = approximation_gap(distances[own], raw)["relative_frobenius"]
        gap_null = [approximation_gap(distances[own], raw[p])["relative_frobenius"] for p in permutations]
        alternatives[name]["target"] = own
        alternatives[name]["unscaled_relative_error"] = null_summary(raw_gap, gap_null, higher=False)
        if name == "exit_hellinger_mds":
            alternatives[name]["classical_mds"] = mds_h_info
        if name == "exit_tv_mds":
            alternatives[name]["classical_mds"] = mds_tv_info

    fidelity, checks = {}, 0
    for name, coords in layouts.items():
        # Cross-check the observed cached estimator on EVERY real layout/target
        # against G1's direct sklearn implementation, not just the toy fixtures.
        fast = cache.evaluate(coords)
        for target, D in distances.items():
            ref = flat_fidelity(layout_fidelity(coords, D))
            _require(max(abs(fast[target][key] - value) for key, value in ref.items()) < 1e-12,
                     f"cached sklearn estimator disagrees: {tag}/{name}/{target}")
            checks += len(ref)
        fidelity[name] = cache.benchmark(coords, permutations)
        shown = distances if name.startswith("shipped") else (alternatives[name]["target"],)
        for target in shown:
            print_fidelity(tag, name, target, fidelity[name][target], len(hubs))

    clusterings = {}
    for name in EXIT_METRICS:
        selected, trials = select_kmedoids(distances[name], KS, permutations, restarts=8)
        labels_array = selected["labels"]
        purity = hull_purity(xy, labels_array, permutations)
        clusterings[name] = {
            "selected_k": selected["k"], "labels": labels_array,
            "medoid_hubs": [hubs[i] for i in selected["medoids"]], "medoid_index": selected["medoids"],
            "silhouette": selected["silhouette"], "hull_purity": purity,
            "candidates": [{"k": trial["k"], "cost": trial["cost"], "silhouette": trial["silhouette"],
                            "restarts": trial["restarts"], "swap_sweeps": trial["swap_sweeps"],
                            "accepted_swaps": trial["accepted_swaps"],
                            "cluster_sizes": np.bincount(trial["labels"])} for trial in trials],
            "clusters": [{"cluster": c, "medoid": hubs[selected["medoids"][c]],
                          "hubs": [hubs[i] for i in np.flatnonzero(labels_array == c)],
                          "mean_exit_profile": profiles[labels_array == c].mean(axis=0)}
                         for c in range(selected["k"])],
        }
        coverage_line("CLUSTERS " + tag + " / " + name, f"{len(hubs)} positive-mass hubs; nearest shipped neighbour", {
            "selected_k": selected["k"], "silhouette": selected["silhouette"],
            "nearest_same_cluster": purity["overall"], "null_exact_expectation": purity["null_exact_expectation"]})
    cluster_agreement = {}
    for i, a in enumerate(EXIT_METRICS):
        for b in EXIT_METRICS[i + 1:]:
            la, lb = clusterings[a]["labels"], clusterings[b]["labels"]
            cluster_agreement[a + " ~ " + b] = null_summary(adjusted_rand_score(la, lb),
                                                            [adjusted_rand_score(la, lb[p]) for p in permutations])
    first = exit_distances(laws["me_first"][0])
    first_control = FidelityCache({"exit_" + k: v for k, v in first.items()}).benchmark(xy, permutations)
    result = {
        "configuration": {"frame": frame, "initiative": initiative, "rates": rates, "origin_filter": origin},
        "set_definition": "positive stationary-mass hubs of the standing-reachable Q-process; equal-hub summaries",
        "hub_ids": hubs, "hub_stationary_mass": mu, "shipped_ground_coordinates": xy,
        "qprocess": qinfo, "kernel_coverage": K.coverage, "exit_law_coverage": einfo, "hub_law_coverage": linfo,
        "clocked_exit_law": cinfo, "proposition1_states": state_bound, "proposition1_hubs": hub_bound,
        "proposition2_sandwich": sandwich, "coarsening_max_excess": coarsening,
        "exit_columns": labels, "seat_exit_profiles": profiles,
        "exit_law_me_first_control": {"fidelity": first_control,
                                      "max_profile_tv": linfo["coin_vs_me_first_max_hub_total_variation"]},
        "distance_summaries": {name: {"unordered_pairs": len(hubs) * (len(hubs) - 1) // 2,
                                      "min": float(D[np.triu_indices(len(hubs), 1)].min()),
                                      "median": float(np.median(D[np.triu_indices(len(hubs), 1)])),
                                      "max": float(D.max())} for name, D in distances.items()},
        "fidelity": fidelity, "alternatives": alternatives, "displacement": motion,
        "clusterings": clusterings, "exit_cluster_ari": cluster_agreement,
        "validation": {"first_passage_targets": len(hubs), "mfpt_max_relative_error": passage_error,
                       "diffusion_direct_errors": diffusion_errors,
                       "cached_vs_g1_fidelity_values": checks},
        "recompute": COMMAND,
    }
    if primary:
        result["target_concordance"] = target_concordance(distances, permutations)
    coverage_line("CASE COMPLETE " + tag, f"{len(hubs)} positive-mass hubs; all layouts against every target", {
        "layouts": len(layouts), "targets": len(distances), "permutations_per_layout": replicates,
        "fidelity_null_values": len(layouts) * len(distances) * 7 * replicates,
        "cached_vs_g1_values_checked": checks})
    runtime = {"K": K, "hubs": hubs, "distances": distances, "shipped": xy, "permutations": permutations,
               "grouping": grouping}
    return result, runtime


# --------------------------------------------------------------------------- #
# robustness (ruling 1): perturbation ensemble + the three single-axis departures
# --------------------------------------------------------------------------- #
def _stays_with_medoid(labels, base_labels, base_medoids):
    """Per hub: is it in the same cluster as the medoid of its BASELINE cluster?

    Secondary only: a COARSER partition preserves it trivially (merge two
    clusters and every hub still sits with its medoid), so it is never the
    per-hub claim. The claim is `_nearest_medoid`.
    """
    return labels == labels[base_medoids[base_labels]]


def _nearest_medoid(D, medoids):
    """Index (into `medoids`) of each row's TV-nearest medoid: 'h is in territory m'.

    Unaffected by which k another configuration or a refit would select.
    """
    return np.argmin(np.asarray(D)[:, medoids], axis=1)


def robustness(case, runtime, replicates, eps=0.2):
    K, hubs, xy = runtime["K"], runtime["hubs"], runtime["shipped"]
    base = runtime["distances"]
    targets = ("diffusion_t1", "diffusion_t2", "diffusion_t4", "commute") + EXIT_METRICS
    ref = {t: upper_ranks(base[t]) for t in targets}
    G, types = runtime["grouping"]
    nf = len(K.fin_cols)
    clus = case["clusterings"]
    stays = {m: np.zeros(len(hubs)) for m in EXIT_METRICS}
    nearest = {m: np.zeros(len(hubs)) for m in EXIT_METRICS}
    ari = {m: [] for m in EXIT_METRICS}
    rank_corr = {t: [] for t in targets}
    fid = {t: {k: [] for k in ("spearman", "jaccard_at10", "trustworthiness_at5", "continuity_at5")} for t in targets}
    exceed = {t: 0 for t in targets}
    rows = []
    for seed in range(replicates):
        pert = K.perturbed(eps, eps, seed)
        Kp = copy.copy(K)                    # the kernel's own methods on the perturbed matrices
        Kp.Q, Kp.R, Kp.R_fin, Kp._lu = pert["Q"], pert["R"], pert["R_fin"], None
        P, mu, hubs_p, _ = qprocess_hubs(Kp)
        _require(hubs_p == hubs, "perturbation changed the positive-mass hub set")
        E, _, _ = extended_exit_law(Kp, verify=False)
        prof = seat_exit_profiles(E[:, :nf] @ G, K.role_nodes, types, hubs, (.5, .5), E[:, nf:],
                                  (("DRAW", "draw"),))[0]
        ex = exit_distances(prof)
        D = {f"diffusion_t{t}": diffusion_distance(P, mu, t) for t in (1, 2, 4)}
        D["commute"] = commute_time(P, mu)
        D.update({"exit_tv": ex["tv"], "exit_hellinger": ex["hellinger"], "exit_js": ex["js"]})
        values = FidelityCache(D).evaluate(xy)
        row = {"seed": seed}
        for t in targets:
            rank_corr[t].append(float(ref[t] @ upper_ranks(D[t])))
            for k in fid[t]:
                fid[t][k].append(values[t][k])
            exceed[t] += values[t]["spearman"] > case["fidelity"]["shipped"][t]["spearman"]["null_p975"]
            row["spearman_" + t] = values[t]["spearman"]
        for m in EXIT_METRICS:
            k = clus[m]["selected_k"]
            fit = kmedoids(D[m], k, seed=SEED + k, restarts=8)
            ari[m].append(float(adjusted_rand_score(clus[m]["labels"], fit["labels"])))
            stays[m] += _stays_with_medoid(fit["labels"], clus[m]["labels"], clus[m]["medoid_index"])
            same = _nearest_medoid(D[m], clus[m]["medoid_index"]) == clus[m]["labels"]
            nearest[m] += same
            row["ari_" + m] = ari[m][-1]
            row["nearest_medoid_kept_" + m] = int(same.sum())
        rows.append(row)

    def dist(x):
        x = np.asarray(x, dtype=float)
        return {"mean": float(x.mean()), "p025": float(np.quantile(x, .025)),
                "p975": float(np.quantile(x, .975)), "min": float(x.min())}

    out = {"eps_attempt": eps, "eps_rate": eps, "seeds": [0, replicates - 1], "replicates": replicates,
           "set_definition": f"{len(hubs)} positive-mass hubs of the primary; K.perturbed(eps, eps, seed) for "
                             f"seed 0..{replicates - 1}; clusters refit at the baseline-selected k",
           "distance_rank_correlation_to_unperturbed": {t: dist(v) for t, v in rank_corr.items()},
           "shipped_fidelity_under_perturbation": {t: {k: dist(v) for k, v in row.items()} for t, row in fid.items()},
           "share_of_seeds_shipped_spearman_above_unperturbed_null_p975": {t: exceed[t] / replicates
                                                                           for t in targets},
           "cluster_ari_to_unperturbed": {m: dist(v) for m, v in ari.items()},
           "stays_with_baseline_medoid": {m: (stays[m] / replicates) for m in EXIT_METRICS},
           "nearest_baseline_medoid_kept": {m: (nearest[m] / replicates) for m in EXIT_METRICS}}
    return out, rows


def per_hub_claims(cases, runtime, robust):
    """Ruling 1's four facts for the per-hub claim 'h is in the TV territory of medoid m':
    h's hub exit law is TV-nearest to m among the primary's baseline TV medoids.

    Checked in the K.perturbed ensemble, and under the other initiative, the other
    frame and origin=False using THAT configuration's own TV distances (the
    baseline medoids must be in its positive-mass hub set; else 'not comparable').
    """
    base = cases[PRIMARY]["clusterings"]["exit_tv"]
    hubs = runtime[PRIMARY]["hubs"]
    labels, medoids = np.asarray(base["labels"]), np.asarray(base["medoid_index"])
    D0 = runtime[PRIMARY]["distances"]["exit_tv"]
    to_medoids = np.sort(D0[:, medoids], axis=1)
    medoid_ids = [hubs[m] for m in medoids]
    axis_nearest = {}
    for axis, tag in AXES.items():
        index = {h: i for i, h in enumerate(runtime[tag]["hubs"])}
        if all(m in index for m in medoid_ids):
            cols = np.array([index[m] for m in medoid_ids])
            near = _nearest_medoid(runtime[tag]["distances"]["exit_tv"], cols)
            axis_nearest[axis] = {h: int(near[i]) for h, i in index.items()}
        else:
            axis_nearest[axis] = {}
    records = []
    for i, hub in enumerate(hubs):
        rec = {"hub": hub, "territory": int(labels[i]), "medoid": medoid_ids[labels[i]],
               "tv_margin_to_second_medoid": float(to_medoids[i, 1] - to_medoids[i, 0]),
               "perturbation_share": float(robust["nearest_baseline_medoid_kept"]["exit_tv"][i]),
               "refit_comembership_share": float(robust["stays_with_baseline_medoid"]["exit_tv"][i])}
        for axis in AXES:
            got = axis_nearest[axis].get(hub)
            rec[axis] = None if got is None else bool(got == labels[i])
        records.append(rec)
    summary = {"hubs": len(records), "medoids": medoid_ids,
               "perturbation_share_ge_0.9": sum(r["perturbation_share"] >= .9 for r in records),
               **{axis + "_holds": sum(r[axis] is True for r in records) for axis in AXES},
               **{axis + "_not_comparable": sum(r[axis] is None for r in records) for axis in AXES},
               "all_four_facts_hold": sum(r["perturbation_share"] >= .9 and all(r[a] is True for a in AXES)
                                          for r in records),
               "per_territory": {medoid_ids[c]: {"hubs": int(np.sum(labels == c)),
                                                 "all_four_facts_hold": sum(
                                                     r["territory"] == c and r["perturbation_share"] >= .9
                                                     and all(r[a] is True for a in AXES) for r in records)}
                                 for c in range(len(medoids))}}
    _require(summary["hubs"] > 0 and all(axis_nearest[a] for a in AXES), "per-hub claims: an axis compared nothing")
    return records, summary


def sensitivity(cases, runtime, replicates):
    base = runtime[PRIMARY]
    out = {}
    for tag, other in runtime.items():
        if tag == PRIMARY:
            continue
        hubs = tuple(sorted(set(base["hubs"]) & set(other["hubs"])))
        _require(len(hubs) >= 120, "common-set sensitivity below hub floor")
        i = np.array([base["hubs"].index(h) for h in hubs])
        j = np.array([other["hubs"].index(h) for h in hubs])
        D0 = {name: D[np.ix_(i, i)] for name, D in base["distances"].items()}
        D1 = {name: D[np.ix_(j, j)] for name, D in other["distances"].items()}
        perm = np.array([tagged_rng(f"sensitivity/{len(hubs)}/{n}").permutation(len(hubs)) for n in range(replicates)])
        comparisons = {}
        for name in D0:
            reference = upper_ranks(D0[name])
            comparisons[name] = null_summary(float(reference @ upper_ranks(D1[name])),
                                             [float(reference @ upper_ranks(D1[name][np.ix_(p, p)])) for p in perm])
        ari = {}
        for m in EXIT_METRICS:
            labels0 = np.array(cases[PRIMARY]["clusterings"][m]["labels"])[i]
            labels1 = np.array(cases[tag]["clusterings"][m]["labels"])[j]
            ari[m] = null_summary(adjusted_rand_score(labels0, labels1),
                                  [adjusted_rand_score(labels0, labels1[p]) for p in perm])
        out[tag] = {"common_hubs": len(hubs), "reference": PRIMARY,
                    "hubs_only_in_primary": sorted(set(base["hubs"]) - set(other["hubs"])),
                    "hubs_only_in_this": sorted(set(other["hubs"]) - set(base["hubs"])),
                    "set_definition": "common hub IDs; distances restricted after each full-chain calculation",
                    "distance_rank_correlations": comparisons, "exit_cluster_ari": ari,
                    "shipped_fidelity_on_common_set": FidelityCache(D1).benchmark(base["shipped"][i], perm),
                    "recompute": COMMAND}
        coverage_line("SENSITIVITY " + tag, f"{len(hubs)} common hubs vs {PRIMARY}", {
            "exit_tv_rank_rho": comparisons["exit_tv"]["observed"], "diffusion_t1_rank_rho":
            comparisons["diffusion_t1"]["observed"], "exit_tv_cluster_ari": ari["exit_tv"]["observed"]})
    return out


# --------------------------------------------------------------------------- #
# layout-only facts: screen projection, technique origins
# --------------------------------------------------------------------------- #
def screen_projection(joined, all_hubs, permutations):
    """Proposition 3 on every position-hub pair, and ground-vs-screen neighbour agreement."""
    ground = np.array([joined["positions"][h]["xy"] for h in all_hubs])
    screen = ground @ SCREEN.T
    g, s = pdist(ground), pdist(screen)
    _require(g.min() > 0, "coincident position hubs in the ground layout")
    ratio = s / g
    lo, hi = 1 / np.sqrt(2), np.sqrt(1.5)
    _require(ratio.min() >= lo - 1e-12 and ratio.max() <= hi + 1e-12, "screen stretch outside Proposition 3")
    cache = FidelityCache({"ground": squareform(g)})
    agreement = cache.benchmark(screen, permutations)["ground"]
    return {"set_definition": f"all {len(all_hubs)} shipped position hubs, ground plane vs the "
                              "_deriveDualPairs isometric projection (before 0.1 rounding and de-overlap)",
            "pairs": len(g), "stretch_bounds": [lo, hi], "stretch_observed_min_max": [float(ratio.min()),
                                                                                   float(ratio.max())],
            "screen_vs_ground_fidelity": agreement}


def technique_origins(graph, joined, layout, all_hubs, replicates):
    xy = np.array([joined["positions"][h]["xy"] for h in all_hubs])
    by_layout_id = {n["id"]: n for n in layout["nodes"]}
    rows = []
    for category in ("transitions", "submissions"):
        for hub, record in joined[category].items():
            node = by_layout_id[record["layout_id"]]
            origin = node.get("fromPositionId")
            _require(origin in joined["positions"], f"unmatched canonical origin: {record['layout_id']} -> {origin}")
            _require(graph[category][hub + "/attacker"]["fromPositionId"] == origin,
                     "layout and graph origin metadata disagree")
            rows.append({"hub": hub, "category": category, "layout_id": record["layout_id"],
                         "origin": origin, "xy": record["xy"], "origin_index": all_hubs.index(origin)})
    _require(len(rows) >= 1200, "technique origin join below floor 1200")
    all_nulls = tagged_rng("technique-random-origins").integers(0, len(all_hubs), size=(replicates, len(rows)))
    output = {}
    for category in ("all", "transitions", "submissions"):
        keep = np.array([i for i, row in enumerate(rows) if category == "all" or row["category"] == category])
        chosen = [rows[i] for i in keep]
        stats = technique_origin_statistics(np.array([r["xy"] for r in chosen]), xy,
                                            np.array([r["origin_index"] for r in chosen]), all_nulls[:, keep])
        records = [{"hub": row["hub"], "layout_id": row["layout_id"], "origin_hub": row["origin"],
                    "ratio": float(stats["ratios"][i]), "origin_distance": float(stats["origin_distances"][i]),
                    "mean_distance_to_uniform_hub": float(stats["mean_random_distances"][i]),
                    "origin_is_nearest": bool(stats["origin_is_nearest"][i])} for i, row in enumerate(chosen)]
        output[category] = {"techniques": len(chosen), "position_hubs_in_null": len(all_hubs),
                            "set_definition": "all joined shipped technique hubs in this category; canonical "
                                              "origin; all position hubs, including origin, in uniform null",
                            "metrics": stats["metrics"], "records": records,
                            "ratio_above_one": int(np.sum(stats["ratios"] > 1)),
                            "null_mean_ratio_exact": stats["null_mean_ratio_exact"],
                            "null_nearest_probability_exact": stats["null_nearest_probability_exact"],
                            "recompute": COMMAND}
        coverage_line("TECHNIQUE ORIGINS " + category, f"{len(chosen)} technique hubs vs {len(all_hubs)} uniformly "
                      "sampled position hubs", {**stats["metrics"], "ratio_above_one": output[category]["ratio_above_one"]})
    return output


# --------------------------------------------------------------------------- #
# run, slim, main
# --------------------------------------------------------------------------- #
def run(replicates=200):
    _require(replicates >= 200, "coordinate null floor is 200 permutations")
    checks = synthetic_gate()
    joined = load_shipped_layout()
    layout_path = REPO / "source/quartz/static/globalGraphLayout.json"
    layout = json.loads(layout_path.read_text())
    all_hubs = tuple(sorted(joined["positions"]))
    all_xy = np.array([[n["x"], n["y"]] for n in layout["nodes"]])
    diameter = float(pdist(all_xy).max())
    hub_diameter = float(pdist(np.array([joined["positions"][h]["xy"] for h in all_hubs])).max())
    hops, hop_coverage = layout_hops(layout, [joined["positions"][h]["layout_id"] for h in all_hubs])
    _require(hop_coverage["layout_nodes"] >= 1400 and hop_coverage["undirected_links"] >= 5000,
             "topology join below coverage floor")
    coverage_line("TOPOLOGY PASS", "full shipped ground layout; shortest paths use all position and technique hubs",
                  hop_coverage)
    screen_perm = np.array([tagged_rng(f"screen/{len(all_hubs)}/{i}").permutation(len(all_hubs))
                            for i in range(replicates)])
    screen = screen_projection(joined, all_hubs, screen_perm)
    coverage_line("PROPOSITION 3 PASS", screen["set_definition"], {k: v for k, v in screen.items()
                                                                  if k != "screen_vs_ground_fidelity"})
    # Share one graph object across all Kernel instances, including its large
    # authored flashcard corpus; do not load a private copy for every scenario.
    graph = json.loads((REPO / "graph.json").read_text())
    cases, runtime = {}, {}
    for config in CONFIGURATIONS:
        tag = tag_of(config)
        cases[tag], runtime[tag] = analyse_case(config, graph, joined, all_hubs, hops, diameter, replicates,
                                                primary=(tag == PRIMARY))
    _require(tag_of(CONFIGURATIONS[0]) == PRIMARY and set(AXES.values()) <= set(cases), "configuration table")
    robust, robust_rows = robustness(cases[PRIMARY], runtime[PRIMARY], replicates)
    claims, claim_summary = per_hub_claims(cases, runtime, robust)
    coverage_line("ROBUSTNESS " + PRIMARY, robust["set_definition"], {
        "cluster_ari": robust["cluster_ari_to_unperturbed"], "per_hub_claims": claim_summary,
        "shipped_above_null": robust["share_of_seeds_shipped_spearman_above_unperturbed_null_p975"]})
    common = sensitivity(cases, runtime, replicates)
    origin_stats = technique_origins(graph, joined, layout, all_hubs, replicates)
    paths = ["graph.json", "source/quartz/static/globalGraphLayout.json", "scripts/semantics/_kernel.py",
             "scripts/semantics/_geometry_methods.py", "scripts/semantics/_geometry_analysis.py",
             "scripts/semantics/geometry.py", "scripts/regenerate_graph_layout.py", "neural/src/app.src.jsx"]
    return {
        "schema": "geometry-g2r-v1", "recompute": COMMAND, "primary": PRIMARY,
        "game": "the corpus's game: both seats sample authored attempt shares (not the app's opponent policy)",
        "sources_sha256": {p: hashlib.sha256((REPO / p).read_bytes()).hexdigest() for p in paths},
        "definitions": {
            "exit_law": "E = [K.exit_law() | draw]: P(the roll ends by (finishing technique, who), or a draw). "
                        "Hub law: group finishers by raw `type` (or by technique), relabel who -> the player's "
                        "STARTING seat at the hub, average both seats and a fair starting-turn coin.",
            "exit_tv": "TV = sum|p-q|/2 on the hub law. Proposition 1: = the largest difference two hubs give "
                       "to ANY event about the ending measurable in these columns.",
            "exit_hellinger": "sqrt(sum((sqrt(p)-sqrt(q))^2)/2); H^2 <= TV <= H sqrt(2-H^2) <= sqrt(2) H.",
            "exit_js": "sqrt((KL_2(p||m)+KL_2(q||m))/2), m=(p+q)/2 (JS divergence in bits); J^2 <= TV <= sqrt(2 ln 2) J.",
            "exit_tv_technique": "TV on the (starting seat x finishing technique) + draw law: the finest grouping.",
            "exit_tv_clocked": "TV on the type-grouped law of the CLOCKED roll (maxMoves uniform on 9..12 plies) "
                               "with DRAW and CLOCK columns.",
            "diffusion": "Exact directed D_t on the mu-weighted hub lump of the standing-reachable Q-process "
                         "(the roll conditioned never to finish), t in {1,2,4} chain steps.",
            "commute": "m(x,y)+m(y,x) on that same hub chain, chain steps (= plies under symmetric initiative, "
                       "which has no 0-ply cells); no square root.",
            "hops": "Undirected unweighted shortest path over every shipped layout node/link (the layout's own "
                    "input graph), restricted to comparison hubs only after BFS.",
            "shipped_screen": "Shipped ground points through _deriveDualPairs' isometric projection, before its "
                              "0.1 rounding, the pair lift and de-overlap.",
            "null": "Seeded uniform permutations of hub coordinates (or, for target concordance, of one "
                    "matrix's hub labels); same estimator as observed.",
            "permutation_p": "(1 + nulls at least as extreme)/(replicates+1); exploratory, unadjusted.",
            "cluster_null": "Permute fitted labels at fixed cluster sizes; k/partition are NOT reoptimised.",
            "hull_purity": "Fraction of hubs whose nearest shipped ground-coordinate neighbour shares the fitted "
                           "exit-law cluster; a locality proxy, not convex-hull containment.",
            "alignment": "Primary: centre, O(2) rotation/reflection, match shipped RMS radius on the hub set; "
                         "control: least-squares similarity scale, permitting shrinkage.",
            "displacement_null": "Permute each alternative's coordinates then refit the SAME alignment.",
            "diameter": "Maximum Euclidean separation among ALL shipped layout nodes, including techniques.",
            "robustness": "Ruling 1: a per-hub claim carries the share of K.perturbed(0.2,0.2,seed 0..199) in "
                          "which it holds, and whether it holds under the other initiative, the other frame "
                          "and origin=False.",
            "scope": "Hub-only alternative coordinates; no layout change is applied; technique relayout not priced.",
        },
        "randomness": {"base_seed": SEED, "coordinate_permutations": replicates,
                       "cluster_k_candidates": KS, "pam_restarts_per_k": 8,
                       "streams": "SHA256-named SeedSequence substreams; PAM seed=3102+k; "
                                  "K.perturbed seeds 0..replicates-1"},
        "synthetic_checks": checks, "layout_join": joined["coverage"], "topology_coverage": hop_coverage,
        "diameters": {"all_shipped_nodes": len(layout["nodes"]), "all_nodes_units": diameter,
                      "position_hubs": len(all_hubs), "position_hubs_units": hub_diameter},
        "screen_projection": screen,
        "cases": cases, "common_hub_sensitivity": common, "technique_origins": origin_stats,
        "robustness": robust, "robustness_replicates": robust_rows,
        "per_hub_claims": {"summary": claim_summary, "records": claims},
        "dual_pair_invariants": ["rep top/attacker remains the hub ID and ordinal",
                                 "one ground point per hub, shared isometric projection",
                                 "upper/lower edge-anchored clearance unchanged",
                                 "de-overlap translates the pair rigidly",
                                 "no new role or technique Markov states and no extra pair transition"],
    }


SUMMARY_KEYS = ("observed", "null_mean", "null_p025", "null_p975", "permutation_p")


def _slim_summary(value):
    """Keep the null-summary core; drop repeated constants (alternative, replicates)."""
    if isinstance(value, dict) and "observed" in value and "null_mean" in value:
        return {k: value[k] for k in SUMMARY_KEYS}
    if isinstance(value, dict):
        return {k: _slim_summary(v) for k, v in value.items()}
    return value


def slim(full):
    """The committed artifact: summaries, coordinates for the primary only, no per-record tables."""
    out = {k: full[k] for k in ("schema", "recompute", "primary", "game", "sources_sha256", "definitions",
                                "randomness", "topology_coverage", "diameters", "dual_pair_invariants")}
    out["synthetic_checks"] = {"g1": full["synthetic_checks"]["g1"], "g2": full["synthetic_checks"]["g2"],
                               "integration_assertions": full["synthetic_checks"]["integration"]["assertions"]}
    out["layout_join"] = {c: {k: v for k, v in row.items() if isinstance(v, (int, float))}
                          for c, row in full["layout_join"].items()}
    out["screen_projection"] = _slim_summary(full["screen_projection"])
    out["cases"] = {}
    for tag, case in full["cases"].items():
        primary = tag == PRIMARY
        c = {k: case[k] for k in ("configuration", "set_definition", "kernel_coverage", "exit_law_coverage",
                                  "hub_law_coverage", "clocked_exit_law", "proposition1_states",
                                  "proposition1_hubs", "proposition2_sandwich", "coarsening_max_excess",
                                  "distance_summaries", "validation", "recompute")}
        c["qprocess"] = case["qprocess"]
        c["hubs"] = len(case["hub_ids"])
        fid = case["fidelity"]
        c["fidelity"] = {name: _slim_summary(rows if name.startswith("shipped") else
                                             {t: rows[t] for t in ("exit_tv", "unweighted_hops",
                                                                   case["alternatives"][name]["target"])})
                         for name, rows in fid.items()}
        c["exit_law_me_first_control"] = _slim_summary(
            {"max_profile_tv": case["exit_law_me_first_control"]["max_profile_tv"],
             "shipped_fidelity": case["exit_law_me_first_control"]["fidelity"]})
        c["alternatives"] = {name: {"target": a["target"],
                                    "unscaled_relative_error": _slim_summary(a["unscaled_relative_error"]),
                                    **({"classical_mds": a["classical_mds"]} if "classical_mds" in a else {}),
                                    **({"ground_coordinates_rms": a["ground_coordinates_rms"]} if primary else {})}
                             for name, a in case["alternatives"].items()}
        c["displacement"] = _slim_summary(case["displacement"])
        c["exit_cluster_ari"] = _slim_summary(case["exit_cluster_ari"])
        c["clusterings"] = {}
        for m, cl in case["clusterings"].items():
            labels = case["exit_columns"]
            c["clusterings"][m] = {
                "selected_k": cl["selected_k"], "silhouette": _slim_summary(cl["silhouette"]),
                "hull_purity": {"overall": _slim_summary(cl["hull_purity"]["overall"]),
                                "null_exact_expectation": cl["hull_purity"]["null_exact_expectation"],
                                "clusters": _slim_summary(cl["hull_purity"]["clusters"])},
                "candidates": [{"k": t["k"], "silhouette": t["silhouette"]["observed"],
                                "silhouette_null_p975": t["silhouette"]["null_p975"],
                                "cluster_sizes": t["cluster_sizes"]} for t in cl["candidates"]],
                "clusters": [{"cluster": k["cluster"], "medoid": k["medoid"], "size": len(k["hubs"]),
                              **({"hubs": k["hubs"]} if (primary or m == "exit_tv") else {}),
                              "top_exit_columns": [[labels[j][0], labels[j][1], float(k["mean_exit_profile"][j])]
                                                   for j in np.argsort(-np.asarray(k["mean_exit_profile"]),
                                                                       kind="stable")[:6]]}
                             for k in cl["clusters"]]}
        if primary:
            c["hub_ids"] = case["hub_ids"]
            c["hub_stationary_mass"] = case["hub_stationary_mass"]
            c["shipped_ground_coordinates"] = case["shipped_ground_coordinates"]
            c["target_concordance"] = _slim_summary(case["target_concordance"])
        out["cases"][tag] = c
    out["common_hub_sensitivity"] = {
        tag: {k: (_slim_summary(v) if isinstance(v, dict) else v) for k, v in row.items()}
        for tag, row in full["common_hub_sensitivity"].items()}
    out["technique_origins"] = {
        cat: {**{k: v for k, v in row.items() if k != "records"},
              "metrics": _slim_summary(row["metrics"]),
              "largest_ratio_records": sorted(row["records"], key=lambda r: (-r["ratio"], r["hub"]))[:10]}
        for cat, row in full["technique_origins"].items()}
    robust = dict(full["robustness"])
    for key in ("stays_with_baseline_medoid", "nearest_baseline_medoid_kept"):
        robust[key] = {m: {"min": float(np.min(v)), "median": float(np.median(v)),
                           "hubs_ge_0.9": int(np.sum(np.asarray(v) >= .9))} for m, v in robust[key].items()}
    out["robustness"] = robust
    out["per_hub_claims"] = full["per_hub_claims"]
    return rounded(jsonable(out))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selfcheck", action="store_true", help="G1 + G2 synthetic proofs only")
    parser.add_argument("--json", type=Path, default=OUTPUT, help="geometry*.json in the owned artifact directory")
    parser.add_argument("--full", type=Path, default=None, help="directory for geometry_full.json (scratch)")
    parser.add_argument("--permutations", type=int, default=200, help="null replicate count (minimum 200)")
    args = parser.parse_args(argv)
    try:
        with threadpool_limits(limits=1):
            if args.selfcheck:
                synthetic_gate()
                print("PASS geometry selfcheck: G1 and G2 synthetic gates", flush=True)
                return 0
            out = args.json.resolve()
            _require(out.parent == OUTPUT.parent and out.name.startswith("geometry") and out.suffix == ".json",
                     "output must remain within owned geometry*.json artifact paths")
            full = jsonable(run(args.permutations))
            if args.full is not None:
                path = args.full.resolve() / "geometry_full.json"
                path.write_text(json.dumps(full, sort_keys=True, allow_nan=False) + "\n")
                coverage_line("FULL dump written", "every case, record and replicate", {
                    "json_bytes": path.stat().st_size, "path": str(path)})
            result = slim(full)
            text = json.dumps(result, sort_keys=True, indent=1, allow_nan=False) + "\n"
            _require(len(text.encode()) < 1_000_000, f"slim artifact is {len(text.encode())} bytes (ruling 5: < 1 MB)")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text)
            coverage_line("PASS geometry artifact written", "all configured scenarios plus complete technique-origin join", {
                "cases": len(result["cases"]), "json_bytes": out.stat().st_size, "path": str(out)})
        return 0
    except (ValueError, AssertionError, KeyError, OSError, np.linalg.LinAlgError) as exc:
        print("FAIL geometry:", exc, file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
