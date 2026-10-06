#!/usr/bin/env python3
"""G1: dense Markov geometry methods and an id-safe shipped-layout join.

No graph probabilities are read and no real Markov chain is constructed here.
Later callers must obtain their chain from semantics/_kernel.py. Matrix rows,
pi, embeddings and distances must use the SAME explicitly aligned state order.

diffusion_distance returns D, not D squared. diffusion_map returns an n-by-k
array for the additive pi-reversibilisation. Its full nontrivial spectrum
reproduces D for a reversible chain; a truncation and/or reversibilisation can
lose information. Negative eigenvalues are retained, ordered by magnitude.

References: Coifman & Lafon, Diffusion maps (2006), doi:10.1016/j.acha.2006.04.006;
sklearn.manifold.trustworthiness; scipy.linalg.orthogonal_procrustes.

Recompute (read-only; the selfcheck uses only synthetic chains):
    python3 -B scripts/semantics/_geometry_methods.py --selfcheck
    python3 -B scripts/semantics/_geometry_methods.py --layout-join
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys

import numpy as np
from scipy import linalg, sparse
from scipy.sparse.csgraph import connected_components
from scipy.spatial.distance import pdist, squareform
from scipy.stats import spearmanr
from sklearn.manifold import trustworthiness
from threadpoolctl import threadpool_limits


REPO = Path(__file__).resolve().parents[2]
SELF_COMMAND = "python3 -B scripts/semantics/_geometry_methods.py --selfcheck"
JOIN_COMMAND = "python3 -B scripts/semantics/_geometry_methods.py --layout-join"
TOL = 1e-11


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _chain(P, pi):
    """Reject invalid / reducible inputs, without normalising or adding mass.

    Irreducibility and positive pi suffice for these finite-time and hitting
    formulas; periodic chains are also accepted (and tested). Ergodic restart
    chains from the shared kernel are a subset of this domain.
    """
    P = np.asarray(P.toarray() if sparse.issparse(P) else P, dtype=float)
    pi = np.asarray(pi, dtype=float)
    _require(P.ndim == 2 and P.shape[0] == P.shape[1] and len(P) >= 2,
             "P must be square with at least two states")
    _require(pi.shape == (len(P),), "pi must have one entry per state")
    _require(np.isfinite(P).all() and np.isfinite(pi).all(), "non-finite chain")
    _require(np.min(P) >= 0 and np.min(pi) > 0, "P >= 0 and pi > 0 required")
    _require(np.allclose(P.sum(axis=1), 1, atol=TOL, rtol=0), "P is not stochastic")
    _require(abs(pi.sum() - 1) < TOL, "pi is not a probability distribution")
    _require(np.allclose(pi @ P, pi, atol=TOL, rtol=0), "pi is not stationary")
    components = connected_components(sparse.csr_matrix(P > 0),
                                      directed=True, connection="strong",
                                      return_labels=False)
    _require(components == 1, f"chain has {components} closed/communicating components")
    return P, pi


def _integer(value, name, lower, upper=None):
    _require(isinstance(value, (int, np.integer)) and not isinstance(value, bool),
             f"{name} must be an integer")
    _require(value >= lower and (upper is None or value <= upper),
             f"{name} out of range [{lower}, {upper}]")
    return int(value)


def diffusion_distance(P, pi, t):
    """Exact directed D_t(x,y) = ||(P^t_x - P^t_y)/sqrt(pi)||_2.

    Dense n-by-n output. t is a non-negative integer in CHAIN STEPS, not the
    shipped game's ply clock. scipy pdist avoids Gram-subtraction cancellation.
    At finite t this can be a pseudometric when two transition rows coincide.
    """
    P, pi = _chain(P, pi)
    t = _integer(t, "t", 0)
    features = np.linalg.matrix_power(P, t) / np.sqrt(pi)[None, :]
    return squareform(pdist(features))


def _canonical_basis(vectors):
    """Fix signs and repeated-eigenvalue rotations using projected state axes.

    A repeated eigenspace is otherwise arbitrary, including when k cuts it.
    Projection onto coordinate axes, in input state order, fixes this choice.
    """
    if vectors.shape[1] == 1:
        v = vectors[:, 0].copy()
        if v[np.argmax(np.abs(v))] < 0:
            v *= -1
        return v[:, None]
    chosen = []
    for i in range(len(vectors)):
        v = vectors @ vectors[i, :]
        for _ in range(2):
            for q in chosen:
                v -= q * (q @ v)
        norm = np.linalg.norm(v)
        if norm > 1e-10:
            chosen.append(v / norm)
        if len(chosen) == vectors.shape[1]:
            break
    _require(len(chosen) == vectors.shape[1], "eigenspace basis lost rank")
    return np.column_stack(chosen)


def diffusion_map(P, pi, t, k):
    """n-by-k Coifman--Lafon coordinates of A=(P+P*)/2, P*=D^-1 P^T D.

    S=D^1/2 A D^-1/2 is symmetric. If S u_j=lambda_j u_j, coordinates
    are lambda_j**t * u_j/sqrt(pi); the stationary coordinate is omitted.
    Order: descending abs(lambda), then descending lambda, then state-axis
    canonical basis in repeated eigenspaces. All n-1 modes, rather than k<n-1,
    are needed to claim exactness on a general reversible chain.
    """
    P, pi = _chain(P, pi)
    t = _integer(t, "t", 0)
    k = _integer(k, "k", 1, len(P) - 1)
    root = np.sqrt(pi)
    B = root[:, None] * P / root[None, :]
    S = (B + B.T) / 2
    eigenvalues, eigenvectors = linalg.eigh(S)
    trivial = int(np.argmax(np.abs(eigenvectors.T @ root)))
    _require(abs(eigenvalues[trivial] - 1) < TOL, "stationary mode missing")
    _require(abs(abs(eigenvectors[:, trivial] @ root) - 1) < TOL,
             "stationary eigenvector does not match pi")
    keep = [j for j in range(len(P)) if j != trivial]
    values, vectors = eigenvalues[keep], eigenvectors[:, keep]
    start = 0
    while start < len(values):
        end = start + 1
        while end < len(values) and abs(values[end] - values[start]) <= 1e-13:
            end += 1
        vectors[:, start:end] = _canonical_basis(vectors[:, start:end])
        # Numerically equal eigenvalues share exactly one scale, so an arbitrary
        # LAPACK split cannot rotate or order a repeated block differently.
        values[start:end] = values[start:end].mean()
        start = end
    order = sorted(range(len(values)), key=lambda j: (-abs(values[j]), -values[j], j))[:k]
    return (vectors[:, order] / root[:, None]) * values[order][None, :] ** t


def mean_first_passage(P, pi):
    """m[x,y] from Z=(I-P+1 pi^T)^-1; m[y,y]=0 (hitting, not return time)."""
    P, pi = _chain(P, pi)
    system = np.eye(len(P)) - P + np.broadcast_to(pi, P.shape)
    Z = linalg.solve(system, np.eye(len(P)), assume_a="gen")
    _require(np.max(np.abs(system @ Z - np.eye(len(P)))) < 1e-8,
             "fundamental-matrix residual too large")
    m = (np.diag(Z)[None, :] - Z) / pi[None, :]
    np.fill_diagonal(m, 0)
    _require(np.isfinite(m).all() and np.min(m) >= 0,
             "invalid first-passage times")
    return m


def commute_time(P, pi):
    """Dense kappa=m+m.T, in chain steps; this returns time, not sqrt(time)."""
    m = mean_first_passage(P, pi)
    return m + m.T


def _distances(D):
    D = np.asarray(D, dtype=float)
    _require(D.ndim == 2 and D.shape[0] == D.shape[1] and len(D) >= 2,
             "distances must be a square matrix on at least two states")
    _require(np.isfinite(D).all() and np.min(D) >= 0, "invalid distance entries")
    _require(np.allclose(D, D.T, atol=TOL, rtol=0), "distances not symmetric")
    _require(np.allclose(np.diag(D), 0, atol=TOL, rtol=0), "nonzero distance diagonal")
    return D


def _coordinates(X, n=None, two_dimensional=False):
    X = np.asarray(X, dtype=float)
    _require(X.ndim == 2 and len(X) >= 2 and X.shape[1] >= 1, "invalid coordinates")
    _require(np.isfinite(X).all(), "non-finite coordinates")
    _require(n is None or len(X) == n, "coordinates/distances row count mismatch")
    _require(not two_dimensional or X.shape[1] == 2, "layout must have two coordinates")
    return X


def approximation_gap(D, embedding):
    """Unscaled errors on all unordered distinct pairs; never fit away scale."""
    D = _distances(D)
    X = _coordinates(embedding, len(D))
    target = D[np.triu_indices(len(D), 1)]
    estimate = pdist(X)
    norm = np.linalg.norm(target)
    _require(norm > 0, "relative gap undefined: all target distances vanish")
    delta = estimate - target
    return {"states": len(D), "pairs": len(target),
            "relative_frobenius": float(np.linalg.norm(delta) / norm),
            "rmse": float(np.sqrt(np.mean(delta ** 2))),
            "max_abs": float(np.max(np.abs(delta)))}


def procrustes_disparity(reference, embedding):
    """Squared residual after centering, unit Frobenius scale, and O(d) fit.

    Allows rotation/reflection and removes translation and overall scale.
    Does not allow a separate scale on each axis or scipy.spatial.procrustes'
    additional shrinkage of one already-normalised matrix. Zero means the
    embeddings have the same shape with the supplied row correspondence.
    """
    A, B = _coordinates(reference), _coordinates(embedding)
    _require(A.shape == B.shape, "Procrustes requires matching shapes")
    A, B = A - A.mean(axis=0), B - B.mean(axis=0)
    a, b = np.linalg.norm(A), np.linalg.norm(B)
    _require(a > 0 and b > 0, "Procrustes undefined for a collapsed embedding")
    A, B = A / a, B / b
    rotation, _ = linalg.orthogonal_procrustes(B, A)
    return float(np.sum((B @ rotation - A) ** 2))


def _ranks(D):
    # Stable tie-break is the input state index; callers must align on ids first.
    work = D.copy()
    np.fill_diagonal(work, np.inf)
    order = np.argsort(work, axis=1, kind="stable")[:, :-1]
    ranks = np.zeros(D.shape, dtype=int)
    ranks[np.arange(len(D))[:, None], order] = np.arange(1, len(D))
    return order, ranks


def layout_fidelity(coordinates, distances, ks=(5, 10), reference_embedding=None):
    """2-D layout vs ANY finite symmetric target dissimilarity on the same ids.

    Mean per-state Jaccard@k; sklearn trustworthiness(D, X, precomputed);
    continuity = the dual rank penalty for true neighbours omitted by X;
    Spearman on unordered distinct pairs; optional normalised O(2) Procrustes.
    sklearn chooses its own deterministic neighbour ties. Jaccard/continuity
    break exact ties by row index; the result reports this convention. k<n/2.
    """
    D = _distances(distances)
    X = _coordinates(coordinates, len(D), two_dimensional=True)
    ks = tuple(_integer(k, "neighbour k", 1) for k in ks)
    _require(len(ks) > 0 and len(ks) == len(set(ks)), "ks must be nonempty and unique")
    _require(all(k < len(D) / 2 for k in ks), "each neighbour k must be < n/2")
    E = squareform(pdist(X))
    high_order, _ = _ranks(D)
    low_order, low_ranks = _ranks(E)
    scores = {}
    for k in ks:
        overlap = np.array([len(set(high_order[i, :k]) & set(low_order[i, :k]))
                            for i in range(len(D))])
        missed_ranks = low_ranks[np.arange(len(D))[:, None], high_order[:, :k]]
        factor = 2 / (len(D) * k * (2 * len(D) - 3 * k - 1))
        scores[str(k)] = {
            "states": len(D), "neighbour_slots": len(D) * k,
            "jaccard": float(np.mean(overlap / (2 * k - overlap))),
            "trustworthiness": float(trustworthiness(D, X, n_neighbors=k,
                                                       metric="precomputed")),
            "continuity": float(1 - factor * np.maximum(missed_ranks - k, 0).sum()),
        }
    upper = np.triu_indices(len(D), 1)
    _require(np.ptp(D[upper]) > 0 and np.ptp(E[upper]) > 0,
             "Spearman undefined for constant pair distances")
    rho = float(spearmanr(D[upper], E[upper]).statistic)
    _require(np.isfinite(rho), "Spearman did not return a finite score")
    result = {"states": len(D), "pairs": len(D) * (len(D) - 1) // 2,
              "knn": scores, "spearman": rho,
              "ties": "row index for Jaccard/continuity; sklearn for trustworthiness"}
    if reference_embedding is not None:
        result["procrustes_disparity"] = procrustes_disparity(reference_embedding, X)
    return result


def _layout_join(graph, layout, position_floor=133):
    """Pure join for synthetic mutation tests; public loader retains floor 133."""
    nodes = layout.get("nodes")
    _require(isinstance(nodes, list) and nodes, "no layout nodes scanned")
    ids = [node["id"] for node in nodes]
    duplicate_ids = sorted(k for k, v in Counter(ids).items() if v > 1)
    _require(not duplicate_ids, f"duplicate layout ids: {duplicate_ids}")
    unknown_ids = sorted(i for i in ids if i.split("/", 1)[0]
                         not in ("Positions", "Transitions", "Submissions"))
    coverage, joined = {}, {}
    for category in ("positions", "transitions", "submissions"):
        rows = graph.get(category)
        _require(isinstance(rows, dict) and rows, f"no {category} graph rows scanned")
        hubs = {key: row for key, row in rows.items() if row.get("role") == "hub"}
        _require(hubs, f"no {category} graph hubs found among {len(rows)} rows")
        prefix = category.title() + "/"
        by_key = {}
        for hub, row in sorted(hubs.items()):
            _require(row.get("hub") == hub, f"hub/key mismatch: {category}/{hub}")
            # Positions use the complete authored path. Techniques have NO path
            # in graph.json; exact name<->layout t is unique, checked, and does
            # not guess a hub slug from a nested URL or its leaf.
            if category == "positions":
                _require(isinstance(row.get("path"), str) and row["path"],
                         f"missing position path: {hub}")
                key = prefix + row["path"].replace(" ", "-")
            else:
                key = row.get("name")
                _require(isinstance(key, str) and key, f"missing technique name: {hub}")
            _require(key not in by_key, f"ambiguous {category} join key: {key}")
            by_key[key] = hub
        selected = [node for node in nodes if node["id"].startswith(prefix)]
        mapped, unmatched = {}, []
        for node in selected:
            key = node["id"] if category == "positions" else node.get("t")
            hub = by_key.get(key)
            if hub is None:
                unmatched.append(node["id"])
                continue
            _require(hub not in mapped, f"multiple layout nodes map to {category}/{hub}")
            xy = np.asarray([node["x"], node["y"]], dtype=float)
            _require(np.isfinite(xy).all(), f"non-finite coordinates for {node['id']}")
            mapped[hub] = {"layout_id": node["id"], "xy": xy}
        floor = position_floor if category == "positions" else len(hubs)
        coverage[category] = {
            "graph_rows_scanned": len(rows), "graph_hubs": len(hubs),
            "layout_nodes": len(selected), "joined_hubs": len(mapped), "floor": floor,
            "nested_layout_ids": sum(node["id"].count("/") > 1 for node in selected),
            "excluded_graph_rows": len(rows) - len(hubs),
            "excluded_family_rows": sum(bool(row.get("isFamily")) for row in rows.values()
                                        if row.get("role") != "hub"),
            "unmatched_layout_ids": sorted(unmatched),
            "missing_graph_hubs": sorted(set(hubs) - set(mapped)),
            "extra_mapped_hubs": sorted(set(mapped) - set(hubs)),
        }
        joined[category] = dict(sorted(mapped.items()))
    joined["coverage"] = coverage
    joined["other_layout_ids"] = unknown_ids
    joined["layout_nodes_scanned"] = len(nodes)
    return joined


def _assert_layout_coverage(result):
    for category, c in result["coverage"].items():
        _require(c["joined_hubs"] >= c["floor"],
                 f"{category}: joined {c['joined_hubs']} below floor {c['floor']}")
        _require(not c["unmatched_layout_ids"] and not c["missing_graph_hubs"]
                 and not c["extra_mapped_hubs"]
                 and c["layout_nodes"] == c["graph_hubs"] == c["joined_hubs"],
                 f"{category}: layout/graph hub sets differ: {json.dumps(c, sort_keys=True)}")
    _require(not result["other_layout_ids"],
             f"extra layout categories: {result['other_layout_ids']}")


def load_shipped_layout(graph_path=None, layout_path=None):
    """Return category->hub->{layout_id, xy}, plus printed coverage diagnostics.

    graph role-nodes, the terminal, and edgeless submission families are not
    layout hubs. Every graph role='hub' must join exactly once; every layout
    node must join. Positions have a hard floor of 133; each technique category
    has a floor equal to its independently enumerated graph hub set (>0).
    Coordinates are the unprojected ground plane, not app orb centres.
    """
    graph_path = Path(graph_path) if graph_path is not None else REPO / "graph.json"
    layout_path = (Path(layout_path) if layout_path is not None else
                   REPO / "source/quartz/static/globalGraphLayout.json")
    graph = json.loads(graph_path.read_text())
    layout = json.loads(layout_path.read_text())
    result = _layout_join(graph, layout)
    print(f"SET: all graph role=hub rows joined to all layout nodes; command: {JOIN_COMMAND}")
    print("category    graph_rows graph_hubs layout_nodes joined floor nested_ids")
    for category, c in result["coverage"].items():
        print(f"{category:11s} {c['graph_rows_scanned']:10d} {c['graph_hubs']:10d} "
              f"{c['layout_nodes']:12d} {c['joined_hubs']:6d} {c['floor']:5d} "
              f"{c['nested_layout_ids']:10d}")
        print(f"{category} diagnostics: {json.dumps(c, sort_keys=True)}")
    print(f"other_layout_ids: {json.dumps(result['other_layout_ids'])}; "
          f"layout_nodes_scanned={result['layout_nodes_scanned']}")
    _assert_layout_coverage(result)
    print("PASS layout join: exact hub set equality in every category")
    return result


def _first_passage_direct(P):
    """Independent absorbing-boundary solve, one system per target; no pi or Z."""
    m = np.zeros(P.shape)
    for target in range(len(P)):
        keep = np.arange(len(P)) != target
        m[keep, target] = linalg.solve(np.eye(len(P) - 1) - P[np.ix_(keep, keep)],
                                      np.ones(len(P) - 1))
    return m


def _diffusion_direct(P, pi, t):
    """Independent repeated multiplication and explicit weighted pair sums."""
    Pt = np.eye(len(P))
    for _ in range(t):
        Pt = Pt @ P
    D = np.zeros(P.shape)
    for x in range(len(P)):
        for y in range(x):
            D[x, y] = D[y, x] = np.sqrt(np.sum((Pt[x] - Pt[y]) ** 2 / pi))
    return D


def _walk(adjacency, lazy=0):
    degree = adjacency.sum(axis=1)
    _require(np.min(degree) > 0, "synthetic graph has isolated vertices")
    return ((1 - lazy) * adjacency / degree[:, None] + lazy * np.eye(len(degree)),
            degree / degree.sum())


def _grid(side):
    coordinates = np.array([(i, j) for i in range(side) for j in range(side)], dtype=float)
    adjacency = (squareform(pdist(coordinates, metric="cityblock")) == 1).astype(float)
    return adjacency, coordinates


def _slow_rank_score(source, target, k):
    """Independent rank formula with tuple sorting, for tie-free metric tests."""
    penalty = 0
    for i in range(len(source)):
        original = sorted((source[i, j], j) for j in range(len(source)) if j != i)
        embedding = sorted((target[i, j], j) for j in range(len(source)) if j != i)
        ranks = {j: rank + 1 for rank, (_, j) in enumerate(original)}
        penalty += sum(max(0, ranks[j] - k) for _, j in embedding[:k])
    return 1 - 2 * penalty / (len(source) * k * (2 * len(source) - 3 * k - 1))


def selfcheck():
    """Known-answer synthetic proofs; no real data or shared kernel is loaded."""
    counts = Counter()

    def check(condition, label):
        if not condition:
            raise AssertionError(label)
        counts["assertions"] += 1

    def report(name, set_definition, values):
        print(f"PASS {name}; SET: {set_definition}; command: {SELF_COMMAND}; "
              f"{json.dumps(values, sort_keys=True)}")

    def verify_chain(name, P, pi, times):
        m = mean_first_passage(P, pi)
        direct = _first_passage_direct(P)
        check(np.allclose(m, direct, atol=2e-9, rtol=2e-11), name + " MFPT direct")
        check(np.allclose(commute_time(P, pi), direct + direct.T,
                          atol=4e-9, rtol=2e-11), name + " commute direct")
        counts["chains"] += 1
        counts["first_passage_target_solves"] += len(P)
        counts["ordered_first_passage_pairs"] += len(P) * (len(P) - 1)
        diffusion_error = 0.0
        for t in times:
            D = diffusion_distance(P, pi, t)
            error = float(np.max(np.abs(D - _diffusion_direct(P, pi, t))))
            check(error < 1e-11, name + f" directed diffusion t={t}")
            diffusion_error = max(diffusion_error, error)
            counts["diffusion_time_cases"] += 1
            counts["unordered_diffusion_pairs"] += len(P) * (len(P) - 1) // 2
        report(name + " independent routes", f"all ordered pairs on {len(P)} synthetic states; "
               f"all unordered diffusion pairs at t={list(times)}", {
                   "mfpt_max_abs_error": float(np.max(np.abs(m - direct))),
                   "mfpt_max_relative_error": float(np.max(np.abs(m - direct)
                                                           / np.maximum(1, np.abs(direct)))),
                   "diffusion_max_abs_error": diffusion_error})

    # Cycles include both an aperiodic odd cycle and a periodic even cycle.
    for n in (7, 10):
        adjacency = np.zeros((n, n))
        for i in range(n):
            adjacency[i, (i + 1) % n] = adjacency[(i + 1) % n, i] = 1
        P, pi = _walk(adjacency)
        separation = np.abs(np.arange(n)[:, None] - np.arange(n)[None, :])
        # Unit-resistance C_n has m=n edges, R_eff=d(n-d)/n.
        exact = 2 * separation * (n - separation)
        kappa = commute_time(P, pi)
        check(np.max(np.abs(kappa - exact)) < 1e-10, "cycle resistance formula")
        gap = approximation_gap(diffusion_distance(P, pi, 3), diffusion_map(P, pi, 3, n - 1))
        check(gap["max_abs"] < 1e-11, "full cycle spectrum including negative modes")
        verify_chain(f"C{n}", P, pi, (0, 1, 3, 8))
        report("cycle closed form", f"all {n * (n - 1) // 2} unordered pairs of unit-edge C_{n}, "
               "non-lazy simple random walk", {
                   "commute_max_abs_error": float(np.max(np.abs(kappa - exact))),
                   "full_spectrum_relative_gap_t3": gap["relative_frobenius"]})

    # Two complete graphs linked by exactly one unit edge; no tuned labels.
    size = 80
    adjacency = linalg.block_diag(np.ones((size, size)) - np.eye(size),
                                  np.ones((size, size)) - np.eye(size))
    adjacency[size - 1, size] = adjacency[size, size - 1] = 1
    P, pi = _walk(adjacency)
    within = np.triu((np.arange(2 * size)[:, None] // size ==
                     np.arange(2 * size)[None, :] // size), 1)
    between = np.triu(~(np.arange(2 * size)[:, None] // size ==
                       np.arange(2 * size)[None, :] // size), 1)
    rows = []
    for t in range(1, 9):
        D = diffusion_distance(P, pi, t)
        ratio = float(D[within].max() / D[between].min())
        check(ratio < 0.15, f"dense clusters separated at t={t}")
        rows.append({"t": t, "within_max": float(D[within].max()),
                     "between_min": float(D[between].min()), "max_within_over_min_between": ratio})
        counts["cluster_time_cases"] += 1
    verify_chain(f"two K{size}s with one bridge", P, pi, tuple(range(1, 9)))
    report("cluster separation", f"{int(within.sum())} within-cluster and "
           f"{int(between.sum())} between-cluster unordered pairs on two K{size}s joined by one edge", rows)

    # Two conventional boundary/holding rules; do not hide this modelling choice.
    adjacency, ground = _grid(10)
    grid_variants = {"half-lazy degree walk": _walk(adjacency, lazy=0.5),
                     "uniform compass with boundary hold":
                     (adjacency / 4 + np.diag(1 - adjacency.sum(axis=1) / 4),
                      np.full(100, 0.01))}
    for name, (P, pi) in grid_variants.items():
        X = diffusion_map(P, pi, 4, 2)
        # Geometric recovery compares with the ACTUAL grid, not diffusion rows.
        metrics = layout_fidelity(X, squareform(pdist(ground)), reference_embedding=ground)
        check(metrics["procrustes_disparity"] < 0.05, name + " grid shape")
        for k in (5, 10):
            check(metrics["knn"][str(k)]["trustworthiness"] > 0.97, name + " grid trust")
            check(metrics["knn"][str(k)]["continuity"] > 0.97, name + " grid continuity")
        D = diffusion_distance(P, pi, 4)
        full_gap = approximation_gap(D, diffusion_map(P, pi, 4, len(P) - 1))
        check(full_gap["max_abs"] < 1e-10, name + " reversible full-spectrum exactness")
        metrics["exact_diffusion_gap_k2_t4"] = approximation_gap(D, X)
        metrics["exact_diffusion_gap_k99_t4"] = full_gap
        if name == "uniform compass with boundary hold":
            # Reflecting path eigenfunctions are cos(pi*(i+.5)/side); the
            # grid's leading nontrivial eigenvalue is (1+cos(pi/side))/2.
            lam = (1 + np.cos(np.pi / 10)) / 2
            analytic = np.sqrt(2) * np.cos(np.pi * (ground + 0.5) / 10) * lam ** 4
            analytic_error = float(np.max(np.abs(pdist(X) - pdist(analytic))))
            check(analytic_error < 1e-11, "grid leading modes match closed-form cosine solution")
            metrics["analytic_cosine_pair_distance_max_abs_error"] = analytic_error
        # A second route to normalised Procrustes uses just singular values.
        A, B = ground - ground.mean(axis=0), X - X.mean(axis=0)
        singular = linalg.svdvals((A / np.linalg.norm(A)).T @ (B / np.linalg.norm(B)))
        check(abs(metrics["procrustes_disparity"] - (2 - 2 * singular.sum())) < 1e-12,
              name + " independent Procrustes formula")
        verify_chain(name, P, pi, (0, 1, 4))
        report("grid recovery", "all 100 vertices / 4950 unordered pairs of the 10x10 grid; "
               f"{name}; k=2 diffusion map at t=4 vs ground coordinates", metrics)

    # Circulant directed chain: stay=.15, clockwise=.55, +3 chord=.30.
    n = 7
    directed = 0.15 * np.eye(n)
    for i in range(n):
        directed[i, (i + 1) % n] = 0.55
        directed[i, (i + 3) % n] = 0.30
    pi = np.full(n, 1 / n)
    control = (directed + directed.T) / 2
    gap_rows = []
    for name, P in (("directed cycle with chords", directed), ("reversible control", control)):
        verify_chain(name, P, pi, (0, 1, 2, 4, 8))
        for t in (1, 2, 4, 8):
            D = diffusion_distance(P, pi, t)
            full = approximation_gap(D, diffusion_map(P, pi, t, n - 1))
            truncated = approximation_gap(D, diffusion_map(P, pi, t, 2))
            if name == "reversible control":
                check(full["max_abs"] < 1e-11, "zero reversible approximation gap")
            else:
                check(full["relative_frobenius"] > 0.05, "detect directed symmetrisation loss")
            gap_rows.append({"chain": name, "t": t, "full_spectrum": full, "k2": truncated})
        # Sparse and dense interfaces must agree.
        check(np.allclose(diffusion_distance(sparse.csr_matrix(P), pi, 2),
                          diffusion_distance(P, pi, 2), atol=1e-13, rtol=0), "sparse parity")
        check(np.array_equal(diffusion_map(P, pi, 2, 2), diffusion_map(P, pi, 2, 2)),
              "repeatable spectral coordinates")
    report("directed/reversible gaps", "all 21 unordered pairs of seven-state stay/clockwise/chord "
           "chain (.15/.55/.30), uniform pi; control=(P+P.T)/2; k=6 isolates reversibilisation", gap_rows)

    # Uniform-pi toys cannot detect accidentally using a plain transpose for P*.
    nonuniform = np.array([[0.8, 0.16, 0.04], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]])
    nonuniform_pi = np.array([0.5, 0.3, 0.2])
    reverse = np.diag(1 / nonuniform_pi) @ nonuniform.T @ np.diag(nonuniform_pi)
    reversible = (nonuniform + reverse) / 2
    nonuniform_rows = []
    for name, P in (("nonuniform directed", nonuniform), ("nonuniform reversible", reversible)):
        verify_chain(name, P, nonuniform_pi, (0, 1, 4))
        X = diffusion_map(P, nonuniform_pi, 4, 2)
        gap = approximation_gap(diffusion_distance(P, nonuniform_pi, 4), X)
        control_gap = approximation_gap(diffusion_distance(reversible, nonuniform_pi, 4), X)
        check(control_gap["max_abs"] < 1e-11, "pi-weighted reversal matches explicit P*")
        if name == "nonuniform directed":
            check(gap["relative_frobenius"] > 1e-3, "nonuniform directed loss detected")
        else:
            check(gap["max_abs"] < 1e-11, "nonuniform reversible control exact")
        nonuniform_rows.append({"chain": name, "full_spectrum_gap_t4": gap})
    report("nonuniform stationary control", "all three unordered pairs of three-state chain "
           "P=[[.8,.16,.04],[.2,.6,.2],[.2,.2,.6]], pi=(.5,.3,.2); control=(P+P*)/2", nonuniform_rows)

    # Independent metric oracles avoid exact distance ties, including at k=10.
    rng = np.random.default_rng(3101)
    reference = rng.normal(size=(32, 2))
    D = squareform(pdist(reference))
    rotated = 3 * reference @ np.array([[0, -1], [1, 0]]) + [17, -5]
    exact = layout_fidelity(rotated, D, reference_embedding=reference)
    check(exact["procrustes_disparity"] < 1e-25, "known rigid/scale Procrustes")
    check(abs(exact["spearman"] - 1) < 1e-14, "identity Spearman")
    for k in (5, 10):
        check(exact["knn"][str(k)]["jaccard"] == 1, "identity Jaccard")
        check(exact["knn"][str(k)]["trustworthiness"] == 1, "identity trustworthiness")
        check(exact["knn"][str(k)]["continuity"] == 1, "identity continuity")
    shuffled = reference[rng.permutation(len(reference))]
    metrics = layout_fidelity(shuffled, D)
    E = squareform(pdist(shuffled))
    for k in (5, 10):
        row = metrics["knn"][str(k)]
        check(abs(row["trustworthiness"] - _slow_rank_score(D, E, k)) < 1e-14,
              "independent trustworthiness formula")
        check(abs(row["continuity"] - _slow_rank_score(E, D, k)) < 1e-14,
              "independent continuity formula")
        counts["metric_neighbour_cases"] += 2
    report("metric controls", "32 seeded Gaussian 2-D points (seed=3101), "
           "exact rotate/translate/scale and deliberately permuted row correspondence", {
               "exact": exact, "permuted": metrics})

    # Synthetic path/name joins and deliberate omissions/duplicates never open graph.json.
    graph = {
        "positions": {"nested-hub": {"role": "hub", "hub": "nested-hub", "path": "Mount/3-4 Mount"},
                      "other": {"role": "hub", "hub": "other", "path": "Other"}},
        "transitions": {"flat-technique": {"role": "hub", "hub": "flat-technique", "name": "Exact Technique"}},
        "submissions": {"finish-hub": {"role": "hub", "hub": "finish-hub", "name": "Exact Finish"},
                        "family": {"isFamily": True, "name": "Family"}},
    }
    layout = {"nodes": [
        {"id": "Positions/Mount/3-4-Mount", "x": 1, "y": 2},
        {"id": "Positions/Other", "x": 4, "y": 5},
        {"id": "Transitions/Arbitrary/Nested-Path", "t": "Exact Technique", "x": 3, "y": 4},
        {"id": "Submissions/Also/Nested", "t": "Exact Finish", "x": 5, "y": 6},
    ]}
    joined = _layout_join(graph, layout, position_floor=2)
    _assert_layout_coverage(joined)
    check(joined["positions"]["nested-hub"]["layout_id"] == "Positions/Mount/3-4-Mount",
          "nested position path join")
    check(joined["transitions"]["flat-technique"]["xy"].tolist() == [3, 4], "technique name join")
    check(joined["coverage"]["submissions"]["excluded_family_rows"] == 1, "family exclusion counted")
    counts["synthetic_joined_hubs"] = sum(c["joined_hubs"] for c in joined["coverage"].values())

    def reject(fn, label):
        try:
            fn()
        except ValueError:
            counts["rejected_invalid_inputs"] += 1
        else:
            raise AssertionError(label + " unexpectedly accepted")

    reject(lambda: _assert_layout_coverage(_layout_join(graph, {"nodes": layout["nodes"][1:]}, 2)),
           "missing hub")
    reject(lambda: _layout_join(graph, {"nodes": layout["nodes"] + [layout["nodes"][0]]}, 2),
           "duplicate layout id")
    reject(lambda: _assert_layout_coverage(_layout_join(graph, layout)), "position floor 133")
    reject(lambda: _assert_layout_coverage(_layout_join(graph, {"nodes": layout["nodes"] + [
        {"id": "Positions/Phantom", "x": 0, "y": 0}]}, 2)), "extra unmatched layout id")
    reject(lambda: _assert_layout_coverage(_layout_join(graph, {"nodes": layout["nodes"] + [
        {"id": "Other/Phantom", "x": 0, "y": 0}]}, 2)), "unknown layout category")
    reject(lambda: diffusion_distance(np.eye(2), [0.5, 0.5], 1), "reducible chain")
    reject(lambda: diffusion_distance(directed, pi, -1), "negative time")
    reject(lambda: diffusion_distance(directed, pi, 1.5), "fractional time")
    reject(lambda: diffusion_distance(directed, np.zeros(n), 1), "zero pi")
    reject(lambda: diffusion_distance(directed * 0.9, pi, 1), "missing probability mass")
    reject(lambda: layout_fidelity(reference, D, ks=(16,)), "k at half n")
    reject(lambda: layout_fidelity(np.zeros_like(reference), D), "collapsed layout")
    reject(lambda: diffusion_map(directed, pi, 1, n), "too many nontrivial modes")

    floors = {"assertions": 110, "chains": 9, "first_passage_target_solves": 397,
              "ordered_first_passage_pairs": 45000, "diffusion_time_cases": 38,
              "unordered_diffusion_pairs": 130000, "cluster_time_cases": 8,
              "metric_neighbour_cases": 4, "synthetic_joined_hubs": 4,
              "rejected_invalid_inputs": 13}
    for name, floor in floors.items():
        if counts[name] < floor:
            raise AssertionError(f"coverage {name}={counts[name]} below floor {floor}")
    report("selfcheck coverage", "synthetic chains, pairwise method comparisons, "
           "metric controls and join/input rejection cases only", {"counts": dict(counts), "floors": floors})
    print("PASS selfcheck: all required synthetic proofs and positive coverage floors")
    return dict(counts)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selfcheck", action="store_true", help="known-answer synthetic proofs only")
    parser.add_argument("--layout-join", action="store_true", help="read-only real layout coverage table")
    args = parser.parse_args(argv)
    if not args.selfcheck and not args.layout_join:
        parser.error("choose --selfcheck and/or --layout-join")
    try:
        with threadpool_limits(limits=1):
            if args.selfcheck:
                selfcheck()
            if args.layout_join:
                load_shipped_layout()
    except (AssertionError, ValueError, KeyError, OSError, linalg.LinAlgError) as exc:
        print(f"FAIL geometry methods: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
