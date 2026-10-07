#!/usr/bin/env python3
"""Synthetic-tested G2 analysis helpers; no graph data or kernel is loaded here.

Run this file with --selfcheck, or geometry.py --selfcheck for G1 + G2 proofs.
All permutations preserve the supplied ID order by permuting coordinates only.
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
from itertools import combinations
import json
import sys

import numpy as np
from scipy import linalg
from scipy.spatial.distance import cdist, pdist, squareform
from scipy.special import rel_entr
from scipy.stats import rankdata
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from threadpoolctl import threadpool_limits

from _geometry_methods import (_canonical_basis, _coordinates, _distances, _ranks,
                               _require, layout_fidelity, procrustes_disparity)

SEED = 3102
SELF_COMMAND = "python3 -B scripts/semantics/geometry.py --selfcheck"
# TV <= sqrt(2 ln 2) * J for J = sqrt(JS divergence in bits); lane G2R Proposition 2.
SQRT_2LN2 = float(np.sqrt(2 * np.log(2)))


def tagged_rng(tag, seed=SEED):
    """Stable independent streams; never Python's process-randomised hash()."""
    key = int.from_bytes(hashlib.sha256(tag.encode()).digest()[:8], "little")
    return np.random.default_rng(np.random.SeedSequence([seed, key]))


def _probability_rows(profiles):
    X = np.asarray(profiles, dtype=float)
    _require(X.ndim == 2 and len(X) >= 2 and X.shape[1] >= 2, "invalid exit profiles")
    _require(np.isfinite(X).all() and X.min() >= 0, "invalid exit-law mass")
    _require(np.max(np.abs(X.sum(axis=1) - 1)) < 1e-10, "exit-law mass does not sum to one")
    return X


def total_variation(profiles):
    """TV = half the L1 distance between rows, in [0,1].

    Lane G2R Proposition 1: for rows that are exit laws (finisher columns AND the
    draw column, so each row sums to one), TV(x,y) is the largest difference the
    two states give to ANY event about how the roll ends, and 2 TV the largest
    difference on any ending-question g with |g| <= 1. Rows that do not sum to
    one are refused: without the draw column the event identity is false.
    """
    X = _probability_rows(profiles)
    return squareform(pdist(X, "cityblock")) / 2


def exit_distances(profiles):
    """TV, Hellinger and JS distance on the SAME rows, reported side by side."""
    H, J = probability_distances(profiles)
    return {"tv": total_variation(profiles), "hellinger": H, "js": J}


def divergence_sandwich(TV, H, J, tol=1e-12):
    """Check Proposition 2 on every unordered pair; return excesses and tightness.

    H = sqrt(sum (sqrt p - sqrt q)^2 / 2), J = sqrt(JSD in bits). Then
    H^2 <= TV <= H sqrt(2 - H^2) <= sqrt(2) H  and  J^2 <= TV <= sqrt(2 ln 2) J.
    """
    TV, H, J = (np.asarray(M, dtype=float) for M in (TV, H, J))
    _require(TV.shape == H.shape == J.shape and TV.ndim == 2 and len(TV) >= 2, "sandwich shapes")
    iu = np.triu_indices(len(TV), 1)
    tv, h, j = TV[iu], H[iu], J[iu]
    upper_h = h * np.sqrt(np.maximum(2 - h * h, 0))
    excess = {"hellinger_sq_minus_tv": float(np.max(h * h - tv)),
              "tv_minus_h_sqrt_2_minus_h2": float(np.max(tv - upper_h)),
              "h_sqrt_2_minus_h2_minus_sqrt2_h": float(np.max(upper_h - np.sqrt(2) * h)),
              "js_sq_minus_tv": float(np.max(j * j - tv)),
              "tv_minus_sqrt_2ln2_js": float(np.max(tv - SQRT_2LN2 * j))}
    _require(max(excess.values()) <= tol, f"divergence sandwich violated: {excess}")
    positive = tv > 1e-12
    _require(positive.any(), "zero pairs with positive TV in sandwich check")
    tv, h, j, upper_h = tv[positive], h[positive], j[positive], upper_h[positive]

    def span(x):
        return [float(np.min(x)), float(np.median(x)), float(np.max(x))]

    return {"pairs": len(iu[0]), "pairs_with_positive_tv": int(positive.sum()), "max_excess": excess,
            "min_median_max": {"hellinger_sq_over_tv": span(h * h / tv),
                               "tv_over_h_sqrt_2_minus_h2": span(tv / upper_h),
                               "js_sq_over_tv": span(j * j / tv),
                               "tv_over_sqrt_2ln2_js": span(tv / (SQRT_2LN2 * j))}}


def absorbing_monte_carlo(src, mass, dst, fin, n_states, n_fin, start, walkers, rng, max_steps=100000):
    """Seeded simulation of an absorbing chain given as a CELL TABLE, not a matrix.

    One row per (source state, outcome) with its probability `mass`; `dst >= 0`
    is a transient state, `dst < 0` the absorbing kind k = -1 - dst. The exit
    label is `fin` when it is >= 0, else n_fin + k. Every source row must sum to
    one. Returns exit-label counts (length n_fin + number of absorbing kinds seen
    as -1-dst, padded to n_fin + 3) and the number of simulated steps.
    """
    src, mass, dst, fin = (np.asarray(a) for a in (src, mass, dst, fin))
    _require(len(src) > 0 and src.shape == mass.shape == dst.shape == fin.shape, "empty/misaligned cells")
    order = np.argsort(src, kind="stable")
    src, mass, dst, fin = src[order], mass[order].astype(float), dst[order], fin[order]
    _require(mass.min() >= 0, "negative cell mass")
    starts = np.searchsorted(src, np.arange(n_states), "left")
    ends = np.searchsorted(src, np.arange(n_states), "right")
    _require(np.all(ends > starts), "a transient state has no outgoing cells")
    totals = np.add.reduceat(mass, starts)
    _require(np.max(np.abs(totals - 1)) < 1e-12, "cell rows do not sum to one")
    cumulative = np.cumsum(mass)
    offset = np.where(starts > 0, cumulative[np.maximum(starts - 1, 0)], 0.0)
    keys = src + (cumulative - offset[src])
    n_labels = n_fin + 3
    counts = np.zeros(n_labels, dtype=np.int64)
    state = np.full(walkers, int(start))
    steps = 0
    for _ in range(max_steps):
        if len(state) == 0:
            break
        u = rng.random(len(state))
        cell = np.searchsorted(keys, state + u, "right")
        cell = np.clip(cell, starts[state], ends[state] - 1)
        steps += len(state)
        target = dst[cell]
        absorbed = target < 0
        label = np.where(fin[cell] >= 0, fin[cell], n_fin + (-1 - target))
        counts += np.bincount(label[absorbed], minlength=n_labels)
        state = target[~absorbed]
    else:
        raise ValueError("Monte Carlo walkers did not all absorb")
    _require(counts.sum() == walkers, "Monte Carlo lost walkers")
    return counts, steps


def probability_distances(profiles):
    """Hellinger and sqrt(base-2 Jensen--Shannon divergence), both in [0,1].

    Profiles must already sum to one. No implicit renormalisation or pseudocount.
    Zeros are legitimate; scipy rel_entr implements the zero-mass limit exactly.
    """
    X = _probability_rows(profiles)
    H = squareform(pdist(np.sqrt(X))) / np.sqrt(2)
    J2 = np.zeros((len(X), len(X)))
    for i, p in enumerate(X):
        mixture = (p + X) / 2
        J2[i] = (rel_entr(p, mixture).sum(axis=1)
                 + rel_entr(X, mixture).sum(axis=1)) / (2 * np.log(2))
    _require(J2.min() > -1e-13, "negative Jensen--Shannon divergence")
    J = np.sqrt(np.maximum(J2, 0))
    np.fill_diagonal(J, 0)
    _require(np.isfinite(J).all(), "undefined Jensen--Shannon distance")
    return H, J


def group_finish_columns(fin_meta, key="type"):
    """One-hot column map from (technique, performer) to (performer, fin_meta[key]).

    key="type" is the raw corpus type field; key="technique" keeps every
    finishing technique (the finest grouping, identity up to column order).
    """
    _require(len(fin_meta) > 0, "zero finishing columns")
    for col in fin_meta:
        _require(col["performer"] in ("me", "them"), "unknown finishing performer")
        _require(isinstance(col.get(key), str) and col[key].strip(),
                 f"missing raw finisher {key}: {col['technique']}")
    types = tuple(sorted({m[key] for m in fin_meta}))
    labels = tuple((performer, kind) for performer in ("me", "them") for kind in types)
    index = {label: i for i, label in enumerate(labels)}
    G = np.zeros((len(fin_meta), len(labels)))
    for c, m in enumerate(fin_meta):
        G[c, index[(m["performer"], m[key])]] = 1
    _require(np.array_equal(G.sum(axis=1), np.ones(len(G))), "column grouping lost mass")
    return G, types


def seat_swap(n_kinds, n_extras=0):
    """Permutation on (me kinds | them kinds | extras): swaps the performer blocks.

    A bottom-seat state's grouped law times this matrix is its law in the hub's
    (TOP kinds | BOTTOM kinds | extras) columns; a top-seat state needs identity.
    Its transpose (= itself) pulls a hub-column question back to the state.
    """
    size = 2 * n_kinds + n_extras
    order = np.r_[np.arange(n_kinds, 2 * n_kinds), np.arange(n_kinds), np.arange(2 * n_kinds, size)]
    return np.eye(size)[order]


def seat_exit_profiles(grouped_exit_law, role_nodes, types, hubs, turn_weights=(0.5, 0.5),
                       extras=None, extra_labels=()):
    """Equal seats; TOP/BOTTOM mean the players' seats at the STARTING hub.

    For an initial top player, me/them map to TOP/BOTTOM; reverse for bottom.
    Players keep these identity labels through sweeps. This does NOT describe
    the finisher's final top/bottom position. Primary turn weights are a fair
    coin. A me-first control has weights (1,0). All four rows are explicit.
    `extras` (2n x m) are seat-free exit columns (the draw; a round clock),
    appended unchanged, so each hub law sums to one only if nothing is missing.
    """
    B = np.asarray(grouped_exit_law, dtype=float)
    n = len(role_nodes)
    _require(B.shape == (2 * n, 2 * len(types)), "exit rows/columns do not match labels")
    X = np.zeros((2 * n, 0)) if extras is None else np.asarray(extras, dtype=float).reshape(2 * n, -1)
    _require(X.shape[1] == len(extra_labels), "extra exit columns and labels differ")
    B = np.hstack([B, X])
    _require(n > 0 and len(hubs) > 0 and len(set(role_nodes)) == n, "empty/duplicate state IDs")
    _require(len(set(hubs)) == len(hubs), "duplicate hub IDs")
    _require(B.min() >= 0 and np.isfinite(B).all(), "negative/nonfinite exit law")
    weights = np.asarray(turn_weights, dtype=float)
    _require(weights.shape == (2,) and weights.min() >= 0 and abs(weights.sum() - 1) < 1e-12,
             "turn weights must be a probability vector")
    swap = seat_swap(len(types), X.shape[1])
    index = {s: i for i, s in enumerate(role_nodes)}
    profiles, rows_used = [], []
    for hub in hubs:
        v = np.zeros(B.shape[1])
        for role in ("top", "bottom"):
            key = hub + "/" + role
            _require(key in index, f"missing hub seat: {key}")
            for turn, w in enumerate(weights):
                if w == 0:
                    continue
                t = index[key] + turn * n
                row = B[t]
                _require(abs(row.sum() - 1) < 1e-10,
                         f"{key}, turn={turn}: exit law has missing mass (a draw or clock column is absent)")
                v += 0.5 * w * (row if role == "top" else row @ swap)
                rows_used.append(t)
        profiles.append(v)
    labels = tuple((seat, kind) for seat in ("TOP", "BOTTOM") for kind in types) + tuple(extra_labels)
    return np.array(profiles), labels, rows_used


def classical_mds(distances, k=2):
    """Classical metric MDS by double centring squared distances, no optimiser."""
    D = _distances(distances)
    _require(1 <= k < len(D), "invalid MDS dimension")
    D2 = D * D
    gram = -0.5 * (D2 - D2.mean(axis=0)[None, :] - D2.mean(axis=1)[:, None] + D2.mean())
    values, vectors = linalg.eigh(gram)
    order = np.argsort(-values)
    values, vectors = values[order], vectors[:, order]
    _require(values[k - 1] > 1e-14 * max(1, values[0]), "MDS has too few positive dimensions")
    start = 0
    while start < len(values):
        end = start + 1
        while end < len(values) and abs(values[end] - values[start]) < 1e-12 * max(1, abs(values[start])):
            end += 1
        vectors[:, start:end] = _canonical_basis(vectors[:, start:end])
        values[start:end] = values[start:end].mean()
        start = end
    X = vectors[:, :k] * np.sqrt(values[:k])[None, :]
    return X, {"positive_eigenvalues": int(np.sum(values > 1e-12)),
               "negative_eigenvalue_mass": float(-values[values < -1e-12].sum()),
               "retained_positive_inertia": float(values[:k].sum() / values[values > 0].sum())}


def align_layout(embedding, reference, mode="rms"):
    """Unweighted O(2) alignment, allowing reflection, with explicit scale rule.

    rms preserves the reference's RMS radius. least_squares chooses the global
    similarity scale that minimises displacement (which may shrink a lot).
    """
    X, Y = _coordinates(embedding, two_dimensional=True), _coordinates(reference, two_dimensional=True)
    _require(X.shape == Y.shape, "alignment row IDs must match exactly")
    Xc, Yc = X - X.mean(axis=0), Y - Y.mean(axis=0)
    nx, ny = np.linalg.norm(Xc), np.linalg.norm(Yc)
    _require(nx > 0 and ny > 0, "collapsed alignment")
    R, trace = linalg.orthogonal_procrustes(Xc, Yc)
    _require(mode in ("rms", "least_squares"), "unknown alignment scale rule")
    scale = ny / nx if mode == "rms" else trace / nx ** 2
    aligned = scale * Xc @ R + Y.mean(axis=0)
    return aligned, {"mode": mode, "scale": float(scale),
                     "rms_radius_ratio": float(scale * nx / ny),
                     "procrustes_disparity": procrustes_disparity(Y, X)}


def move_statistics(aligned, reference, diameter):
    _require(diameter > 0, "zero layout diameter")
    moves = np.linalg.norm(np.asarray(aligned) - np.asarray(reference), axis=1)
    return {"median_units": float(np.median(moves)), "p90_units": float(np.quantile(moves, 0.9)),
            "median_diameter_share": float(np.median(moves) / diameter),
            "p90_diameter_share": float(np.quantile(moves, 0.9) / diameter)}


def null_summary(observed, samples, higher=True):
    x = np.asarray(samples, dtype=float)
    _require(x.ndim == 1 and len(x) >= 2 and np.isfinite(x).all() and np.isfinite(observed),
             "invalid or empty null distribution")
    extreme = np.count_nonzero(x >= observed) if higher else np.count_nonzero(x <= observed)
    return {"observed": float(observed), "null_mean": float(x.mean()),
            "null_sd": float(x.std(ddof=1)), "null_p025": float(np.quantile(x, .025)),
            "null_p975": float(np.quantile(x, .975)),
            "permutation_p": float((1 + extreme) / (1 + len(x))),
            "alternative": "greater" if higher else "less", "null_replicates": len(x)}


def flat_fidelity(result):
    out = {"spearman": result["spearman"]}
    for k, row in result["knn"].items():
        for metric in ("jaccard", "trustworthiness", "continuity"):
            out[f"{metric}_at{k}"] = row[metric]
    return out


class FidelityCache:
    """Same metrics as G1, caching target ranks and sharing sklearn neighbours.

    Refit neighbours for each coordinate permutation: this preserves sklearn's
    actual tie treatment, including coincident or equidistant coordinates.
    Nulls therefore use the SAME estimator as observed values, not a proxy.
    """

    def __init__(self, targets, ks=(5, 10)):
        _require(len(targets) > 0, "zero target metrics")
        self.targets = {name: _distances(D) for name, D in targets.items()}
        self.n = len(next(iter(self.targets.values())))
        _require(all(D.shape == (self.n, self.n) for D in self.targets.values()), "target sets differ")
        self.ks = tuple(ks)
        _require(all(0 < k < self.n / 2 for k in ks), "invalid neighbour sizes")
        self.upper = np.triu_indices(self.n, 1)
        self.rows = np.arange(self.n)[:, None]
        self.data = {}
        for name, D in self.targets.items():
            order, _ = _ranks(D)
            work = D.copy()
            np.fill_diagonal(work, np.inf)
            quick = np.argsort(work, axis=1)
            quick_ranks = np.zeros((self.n, self.n), dtype=int)
            quick_ranks[self.rows, quick] = np.arange(1, self.n + 1)
            ranked = rankdata(D[self.upper])
            ranked -= ranked.mean()
            _require(np.linalg.norm(ranked) > 0, "constant target pair distances")
            masks = {}
            for k in ks:
                mask = np.zeros((self.n, self.n), dtype=bool)
                mask[self.rows, order[:, :k]] = True
                masks[k] = mask
            self.data[name] = order, quick_ranks, ranked / np.linalg.norm(ranked), masks

    def evaluate(self, coordinates):
        X = _coordinates(coordinates, self.n, two_dimensional=True)
        E = squareform(pdist(X))
        order, ranks = _ranks(E)
        pair_ranks = rankdata(E[self.upper])
        pair_ranks -= pair_ranks.mean()
        _require(np.linalg.norm(pair_ranks) > 0, "collapsed coordinate distances")
        pair_ranks /= np.linalg.norm(pair_ranks)
        neighbours = NearestNeighbors().fit(X)
        near = {k: neighbours.kneighbors(n_neighbors=k, return_distance=False) for k in self.ks}
        out = {}
        for name, (high_order, high_ranks, target_ranks, masks) in self.data.items():
            row = {"spearman": float(np.clip(target_ranks @ pair_ranks, -1, 1))}
            for k in self.ks:
                overlap = masks[k][self.rows, order[:, :k]].sum(axis=1)
                factor = 2 / (self.n * k * (2 * self.n - 3 * k - 1))
                row[f"jaccard_at{k}"] = float(np.mean(overlap / (2 * k - overlap)))
                row[f"trustworthiness_at{k}"] = float(1 - factor *
                    np.maximum(high_ranks[self.rows, near[k]] - k, 0).sum())
                row[f"continuity_at{k}"] = float(1 - factor *
                    np.maximum(ranks[self.rows, high_order[:, :k]] - k, 0).sum())
            out[name] = row
        return out

    def benchmark(self, coordinates, permutations):
        observed = self.evaluate(coordinates)
        _require(len(permutations) >= 2, "zero/fewer than two coordinate permutations")
        nulls = {target: {metric: [] for metric in row} for target, row in observed.items()}
        for perm in permutations:
            _require(np.array_equal(np.sort(perm), np.arange(self.n)), "not a coordinate permutation")
            values = self.evaluate(coordinates[perm])
            for target, row in values.items():
                for metric, value in row.items():
                    nulls[target][metric].append(value)
        return {target: {metric: null_summary(value, nulls[target][metric])
                         for metric, value in row.items()} for target, row in observed.items()}


def kmedoids(distances, k, seed=SEED, restarts=8):
    """Seeded PAM swap descent, exact best swap per sweep; multistart heuristic."""
    D = _distances(distances)
    n = len(D)
    _require(2 <= k < n and restarts >= 1, "invalid k-medoids search")
    rng = np.random.default_rng(seed)
    best = None
    sweeps = swaps = 0
    for _ in range(restarts):
        medoids = np.sort(rng.choice(n, size=k, replace=False))
        for iteration in range(200):
            distances_to_medoids = D[:, medoids]
            assigned = np.argmin(distances_to_medoids, axis=1)
            first = distances_to_medoids[np.arange(n), assigned]
            second = np.partition(distances_to_medoids, 1, axis=1)[:, 1]
            cost = float(first.sum())
            candidate = None
            candidates = np.setdiff1d(np.arange(n), medoids)
            for slot in range(k):
                base = np.where(assigned == slot, second, first)
                costs = np.minimum(base[:, None], D[:, candidates]).sum(axis=0)
                j = int(np.argmin(costs))
                trial = (float(costs[j]), int(medoids[slot]), int(candidates[j]), slot)
                if candidate is None or trial < candidate:
                    candidate = trial
            sweeps += 1
            if candidate[0] >= cost - 1e-12:
                break
            medoids[candidate[3]] = candidate[2]
            medoids.sort()
            swaps += 1
        else:
            raise ValueError("PAM exceeded the convergence bound")
        labels = np.argmin(D[:, medoids], axis=1)
        # Duplicate profiles can have zero inter-medoid distance; retain each
        # medoid's own cluster, a deterministic nonempty tie assignment.
        labels[medoids] = np.arange(k)
        cost = float(D[np.arange(n), medoids[labels]].sum())
        candidate = (cost, tuple(int(v) for v in medoids))
        if best is None or candidate < best[0]:
            best = candidate, labels.copy(), medoids.copy()
    return {"labels": best[1], "medoids": best[2], "cost": best[0][0],
            "restarts": restarts, "swap_sweeps": sweeps, "accepted_swaps": swaps}


def silhouette(distances, labels):
    """Mean silhouette; singleton score zero, independently checked with sklearn."""
    D = _distances(distances)
    labels = np.asarray(labels)
    groups, z = np.unique(labels, return_inverse=True)
    _require(len(z) == len(D) and 2 <= len(groups) < len(D), "invalid silhouette partition")
    membership = np.eye(len(groups))[z]
    counts = membership.sum(axis=0)
    sums = D @ membership
    a = sums[np.arange(len(D)), z] / np.maximum(counts[z] - 1, 1)
    means = sums / counts[None, :]
    means[np.arange(len(D)), z] = np.inf
    b = means.min(axis=1)
    result = np.divide(b - a, np.maximum(a, b), out=np.zeros(len(D)), where=np.maximum(a, b) > 0)
    result[counts[z] == 1] = 0
    return float(result.mean())


def select_kmedoids(distances, ks, permutations, seed=SEED, restarts=8):
    trials = []
    for k in ks:
        fit = kmedoids(distances, k, seed=seed + k, restarts=restarts)
        score = silhouette(distances, fit["labels"])
        reference = silhouette_score(distances, fit["labels"], metric="precomputed")
        _require(abs(score - reference) < 1e-12, "silhouette disagrees with sklearn")
        samples = [silhouette(distances, fit["labels"][p]) for p in permutations]
        trials.append({**fit, "k": k, "silhouette": null_summary(score, samples)})
    _require(trials, "no silhouette candidates evaluated")
    selected = min(trials, key=lambda row: (-row["silhouette"]["observed"], row["k"]))
    return selected, trials


def hull_purity(coordinates, labels, permutations):
    """Nearest-neighbour cluster agreement, a locality proxy, not polygon purity."""
    labels = np.asarray(labels)
    E = squareform(pdist(coordinates))
    nearest = _ranks(E)[0][:, 0]
    observed = float(np.mean(labels == labels[nearest]))
    samples = []
    per_cluster = {int(c): [] for c in np.unique(labels)}
    for p in permutations:
        neighbour = _ranks(E[np.ix_(p, p)])[0][:, 0]
        same = labels == labels[neighbour]
        samples.append(float(same.mean()))
        for c in per_cluster:
            per_cluster[c].append(float(same[labels == c].mean()))
    counts = np.bincount(labels)
    expected = float(np.sum(counts * (counts - 1)) / (len(labels) * (len(labels) - 1)))
    return {"overall": null_summary(observed, samples), "null_exact_expectation": expected,
            "nearest_index": nearest, "same_cluster": labels == labels[nearest],
            "clusters": {str(c): {"hubs": int(np.sum(labels == c)),
                                  "agreement": null_summary(float(np.mean(
                                      labels[nearest[labels == c]] == c)), per_cluster[c]),
                                  "null_exact_expectation": float((np.sum(labels == c) - 1) / (len(labels) - 1))}
                         for c in per_cluster}}


def technique_origin_statistics(tech_xy, position_xy, origin_indices, random_indices):
    """Distance to authored origin / mean distance to a uniform position hub."""
    distances = cdist(tech_xy, position_xy)
    n = len(distances)
    rows = np.arange(n)
    origins = np.asarray(origin_indices)
    _require(n > 0 and origins.shape == (n,), "zero/misaligned technique origins")
    _require(np.all((origins >= 0) & (origins < len(position_xy))), "origin outside position set")
    means = distances.mean(axis=1)
    _require(means.min() > 0, "zero random-hub distance denominator")
    d_origin = distances[rows, origins]
    ratios = d_origin / means
    nearest = np.argmin(distances, axis=1)

    def metrics(ds, chosen):
        r = ds / means
        return {"mean_ratio": float(r.mean()), "median_ratio": float(np.median(r)),
                "p90_ratio": float(np.quantile(r, .9)), "median_distance_units": float(np.median(ds)),
                "origin_is_nearest_hub": float(np.mean(chosen == nearest))}

    observed = metrics(d_origin, origins)
    samples = {key: [] for key in observed}
    for chosen in random_indices:
        _require(np.shape(chosen) == (n,), "null origins have wrong shape")
        trial = metrics(distances[rows, chosen], chosen)
        for key, value in trial.items():
            samples[key].append(value)
    return {"metrics": {key: null_summary(value, samples[key], higher=(key == "origin_is_nearest_hub"))
                        for key, value in observed.items()},
            "ratios": ratios, "origin_distances": d_origin, "mean_random_distances": means,
            "origin_is_nearest": origins == nearest, "null_mean_ratio_exact": 1.0,
            "null_nearest_probability_exact": float(1 / len(position_xy))}


def selfcheck():
    counts = Counter()

    def check(test, name):
        _require(test, "G2 selfcheck: " + name)
        counts["assertions"] += 1

    X = np.array([[1., 0], [0, 1], [.5, .5]])
    H, J = probability_distances(X)
    check(abs(H[0, 1] - 1) < 1e-14 and abs(J[0, 1] - 1) < 1e-14, "disjoint probability laws")
    check(abs(H[0, 2] - np.sqrt(1 - 1 / np.sqrt(2))) < 1e-14, "Hellinger closed form")
    js2 = .5 * (np.log2(4 / 3) + .5 * np.log2(2 / 3) + .5)
    check(abs(J[0, 2] ** 2 - js2) < 1e-14, "Jensen--Shannon closed form")
    meta = [{"performer": p, "type": t, "technique": t} for p in ("me", "them") for t in ("choke", "knee")]
    G, types = group_finish_columns(meta)
    role_nodes = ("a/top", "a/bottom", "b/top", "b/bottom")
    B = np.array([[.8, 0, 0, .2], [0, .4, .6, 0], [0, 1, 0, 0], [0, 0, 0, 1],
                  [.6, 0, 0, .4], [0, .2, .8, 0], [0, 1, 0, 0], [0, 0, 0, 1]])
    profiles, labels, used = seat_exit_profiles(B @ G, role_nodes, types, ("a", "b"))
    perm = [2, 0, 3, 1]
    regrouped, _ = group_finish_columns([meta[i] for i in perm])
    check(np.array_equal(B[:, perm] @ regrouped, B @ G), "finisher-column ID permutation preserves grouped law")
    check(np.allclose(profiles, [[.7, 0, 0, .3], [0, 1, 0, 0]]), "seat/performer identity conversion")
    check(len(used) == 8 and labels == (("TOP", "choke"), ("TOP", "knee"),
                                      ("BOTTOM", "choke"), ("BOTTOM", "knee")), "seat coverage/labels")
    swapped = B[[5, 4, 7, 6, 1, 0, 3, 2]][:, [2, 3, 0, 1]]
    check(np.allclose(seat_exit_profiles(swapped @ G, role_nodes, types, ("a", "b"))[0], profiles),
          "player relabelling leaves hub law unchanged")

    rng = tagged_rng("selfcheck")
    ground = rng.normal(size=(32, 2))
    D = squareform(pdist(ground))
    embedding, _ = classical_mds(D)
    check(np.max(np.abs(pdist(embedding) - pdist(ground))) < 1e-12, "MDS exact Euclidean toy")
    moved = 3 * ground @ np.array([[0, -1], [1, 0]]) + [7, -3]
    for mode in ("rms", "least_squares"):
        aligned, _ = align_layout(moved, ground, mode)
        check(np.max(np.abs(aligned - ground)) < 1e-12, "alignment known transform " + mode)
    probabilities = rng.dirichlet(np.ones(5), size=32)
    H, J = probability_distances(probabilities)
    full, _ = classical_mds(H, k=5)
    check(np.max(np.abs(pdist(full) - H[np.triu_indices(32, 1)])) < 1e-12,
          "Hellinger is Euclidean in square-root probability coordinates")

    targets = {"euclidean": D, "hellinger": H, "jensen_shannon": J}
    cache = FidelityCache(targets)
    # Test both random coordinates and ties/duplicate points, and each permutation.
    tied = np.array([(i // 6, i % 6) for i in range(32)], dtype=float)
    tied[1] = tied[0]
    for xy in (ground, tied):
        for _ in range(4):
            coords = xy[rng.permutation(32)]
            fast = cache.evaluate(coords)
            for name, target in targets.items():
                reference = flat_fidelity(layout_fidelity(coords, target))
                check(max(abs(fast[name][key] - val) for key, val in reference.items()) < 1e-12,
                      "cached fidelity equals G1/sklearn on ties and permutations")
                counts["fidelity_comparisons"] += len(reference)
    permutations = np.array([rng.permutation(32) for _ in range(12)])
    check(cache.benchmark(ground, permutations) == cache.benchmark(ground, permutations), "repeatable nulls")

    tiny = squareform(pdist(np.array([[0, 0], [0, .1], [1, 0], [10, 0], [10, .1], [11, 0]])))
    fit = kmedoids(tiny, 2, seed=3102, restarts=8)
    optimum = min(np.min(tiny[:, medoids], axis=1).sum() for medoids in combinations(range(6), 2))
    check(abs(fit["cost"] - optimum) < 1e-13, "PAM matches exhaustive optimum")
    check(np.array_equal(fit["labels"][:3], np.repeat(fit["labels"][0], 3))
          and np.array_equal(fit["labels"][3:], np.repeat(fit["labels"][3], 3))
          and fit["labels"][0] != fit["labels"][3], "PAM planted groups")
    cluster_xy = np.array([[c * 10, j * .01] for c in range(3) for j in range(4)])
    CD = squareform(pdist(cluster_xy))
    cp = np.array([rng.permutation(12) for _ in range(20)])
    selected, trials = select_kmedoids(CD, range(2, 6), cp)
    check(selected["k"] == 3, "silhouette selects three known groups")
    check(abs(selected["silhouette"]["observed"] - silhouette_score(CD, selected["labels"], metric="precomputed")) < 1e-13,
          "independent silhouette")
    check(np.array_equal(selected["medoids"], select_kmedoids(CD, range(2, 6), cp)[0]["medoids"]),
          "repeatable seeded PAM selection")
    purity = hull_purity(cluster_xy, selected["labels"], cp)
    check(purity["overall"]["observed"] == 1 and abs(purity["null_exact_expectation"] - 3 / 11) < 1e-14,
          "nearest-neighbour purity and analytic conditional null")
    counts["clustering_candidates"] = len(trials)

    pos = np.array([[0, 0], [2, 0], [4, 0]], dtype=float)
    tech = np.array([[0, 0], [1, 0]], dtype=float)
    null_origins = np.array([[i, j] for i in range(3) for j in range(3)])
    stat = technique_origin_statistics(tech, pos, [0, 0], null_origins)
    check(np.allclose(stat["ratios"], [0, .6]), "origin ratio known answer")
    check(abs(stat["metrics"]["mean_ratio"]["null_mean"] - 1) < 1e-14, "enumerated origin null expectation")
    check(abs(stat["metrics"]["origin_is_nearest_hub"]["null_mean"] - 1 / 3) < 1e-14, "enumerated nearest-origin null")

    # --- Proposition 2 (sandwich), with its equality cases as known answers.
    tv_toy = total_variation(X)
    check(abs(tv_toy[0, 1] - 1) < 1e-15 and abs(tv_toy[0, 2] - .5) < 1e-15, "TV closed form")
    sand = divergence_sandwich(*(exit_distances(probabilities)[k] for k in ("tv", "hellinger", "js")))
    check(sand["pairs"] == 32 * 31 // 2 and max(sand["max_excess"].values()) <= 1e-12, "sandwich on Dirichlet laws")
    counts["sandwich_pairs"] += sand["pairs"]
    split = exit_distances(np.array([[.5, .5, 0], [.5, 0, .5]]))       # equal-or-disjoint coordinates
    check(abs(split["hellinger"][0, 1] ** 2 - .5) < 1e-15 and abs(split["js"][0, 1] ** 2 - .5) < 1e-15
          and abs(split["tv"][0, 1] - .5) < 1e-15, "H^2 = J^2 = TV on equal-or-disjoint coordinates")
    for a in (.1, .3, .45):
        binary = exit_distances(np.array([[a, 1 - a], [1 - a, a]]))
        h = binary["hellinger"][0, 1]
        check(abs(binary["tv"][0, 1] - h * np.sqrt(2 - h * h)) < 1e-14, "TV = H sqrt(2-H^2) on symmetric binary pair")
    near = exit_distances(np.array([[.5005, .4995], [.4995, .5005]]))
    ratio = near["tv"][0, 1] / (SQRT_2LN2 * near["js"][0, 1])
    check(.999 < ratio <= 1, "TV / (sqrt(2 ln 2) J) -> 1 near a common point")

    # --- Proposition 1 on a known absorbing chain: gambler's ruin on 1..5 with a
    # draw leak. Columns: ruin at 0, reach 6, draw. Closed form when leak = 0.
    def ruin(up, down, leak):
        Qt, Rt = np.zeros((5, 5)), np.zeros((5, 3))
        for i in range(5):
            if i + 1 < 5:
                Qt[i, i + 1] = up
            else:
                Rt[i, 1] = up
            if i > 0:
                Qt[i, i - 1] = down
            else:
                Rt[i, 0] = down
            Rt[i, 2] = leak
        return Qt, Rt

    Qt, Rt = ruin(.45, .55, 0.0)
    Et = linalg.solve(np.eye(5) - Qt, Rt)
    r = .55 / .45
    check(np.max(np.abs(Et[:, 1] - (1 - r ** np.arange(1, 6)) / (1 - r ** 6))) < 1e-14, "gambler's ruin closed form")
    Qt, Rt = ruin(.45, .50, .05)
    Et = linalg.solve(np.eye(5) - Qt, Rt)
    check(np.max(np.abs(Et.sum(axis=1) - 1)) < 1e-14, "exit law rows sum to one with the draw column")
    TVt = total_variation(Et)
    worst = 0.0
    for x, y in combinations(range(5), 2):
        star = np.sign(Et[x] - Et[y])
        h = linalg.solve(np.eye(5) - Qt, Rt @ star)            # the Dirichlet problem, not Et @ star
        check(abs((h[x] - h[y]) - 2 * TVt[x, y]) < 1e-14, "sup over |g|<=1 attained at sign(E_x - E_y)")
        event = (Et[x] > Et[y]).astype(float)
        he = linalg.solve(np.eye(5) - Qt, Rt @ event)
        check(abs((he[x] - he[y]) - TVt[x, y]) < 1e-14, "event A* attains TV")
        for g in tagged_rng(f"harmonic/{x}/{y}").uniform(-1, 1, size=(50, 3)):
            hg = linalg.solve(np.eye(5) - Qt, Rt @ g)
            worst = max(worst, abs(hg[x] - hg[y]) - 2 * TVt[x, y])
            counts["harmonic_questions"] += 1
    check(worst <= 1e-14, "no bounded ending-question beats 2 TV")
    finishers = Et[:, :2]
    unbalanced = np.max(np.abs(np.maximum(finishers[0] - finishers[4], 0).sum()
                               - np.maximum(finishers[4] - finishers[0], 0).sum()))
    check(unbalanced > 1e-3, "control: dropping the draw column breaks the event identity")

    # --- The cell-table Monte Carlo, against the exact exit law of the same toy.
    src, mass, dst, fin = [], [], [], []
    for i in range(5):
        for j in np.flatnonzero(Qt[i]):
            src.append(i); mass.append(Qt[i, j]); dst.append(j); fin.append(-1)
        for c, fcol in ((0, 0), (1, 1), (2, -1)):              # ruin, reach-6 are finisher columns
            if Rt[i, c] > 0:
                src.append(i); mass.append(Rt[i, c]); dst.append(-1 - c); fin.append(fcol)
    walkers = 40000
    empirical = {}
    for start in (1, 3):
        mc, steps = absorbing_monte_carlo(src, mass, dst, fin, 5, 2, start, walkers,
                                          tagged_rng(f"toy-mc/{start}"))
        freq = np.array([mc[0], mc[1], mc[2 + 2]]) / walkers   # draw is n_fin + kind 2
        se = np.sqrt(Et[start] * (1 - Et[start]) / walkers)
        check(np.all(np.abs(freq - Et[start]) <= 5 * se + 1e-12), "Monte Carlo exit law within 5 se")
        empirical[start] = freq
        counts["monte_carlo_steps"] += steps
    star = np.sign(Et[1] - Et[3])
    diff = (empirical[1] - empirical[3]) @ star
    check(abs(diff - 2 * TVt[1, 3]) < 5 * np.sqrt(2 / walkers), "Monte Carlo reproduces the attained 2 TV")

    # --- Seat swap pulls a hub question back to a bottom-seat state exactly.
    Sw = seat_swap(2, 1)
    lawb = np.array([.1, .2, .3, .15, .25])
    gq = np.array([1., -1, .5, 0, -.25])
    check(np.array_equal(Sw, Sw.T) and abs((lawb @ Sw) @ gq - lawb @ (Sw @ gq)) < 1e-15,
          "seat swap is an involution and its pull-back is exact")

    invalid = [lambda: probability_distances([[.1, .2], [.2, .3]]),
               lambda: group_finish_columns([]),
               lambda: seat_exit_profiles(B * .5, role_nodes, types, ("a", "b")),
               lambda: kmedoids(tiny, 6), lambda: silhouette(tiny, np.zeros(6)),
               lambda: null_summary(1, []), lambda: align_layout(np.zeros((32, 2)), ground),
               lambda: total_variation(finishers),
               lambda: absorbing_monte_carlo([0], [.5], [-1], [0], 1, 1, 0, 10, tagged_rng("bad"))]
    for action in invalid:
        try:
            action()
        except ValueError:
            counts["rejected_inputs"] += 1
        else:
            raise AssertionError("invalid G2 input accepted")
    floors = {"assertions": 80, "fidelity_comparisons": 168, "clustering_candidates": 4, "rejected_inputs": 9,
              "sandwich_pairs": 496, "harmonic_questions": 500, "monte_carlo_steps": 100000}
    for key, floor in floors.items():
        _require(counts[key] >= floor, f"G2 coverage {key}={counts[key]} below floor {floor}")
    print(f"PASS G2 synthetic helpers; SET: known probability laws, metric embeddings, permutations, "
          f"planted groups, exhaustive medoids, uniform-origin null, gambler's-ruin exit laws with a draw "
          f"leak (Propositions 1-2) and a cell-table Monte Carlo; command: {SELF_COMMAND}; "
          + json.dumps({"counts": dict(counts), "floors": floors}, sort_keys=True), flush=True)
    return dict(counts)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selfcheck", action="store_true", required=True)
    parser.parse_args()
    try:
        with threadpool_limits(limits=1):
            selfcheck()
    except (ValueError, AssertionError) as exc:
        print("FAIL G2 helpers:", exc, file=sys.stderr)
        sys.exit(1)
