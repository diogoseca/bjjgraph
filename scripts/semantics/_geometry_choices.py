#!/usr/bin/env python3
"""G3: price the owner's options for making the map carry exit-law meaning.

Everything is about THE CORPUS'S GAME, primary configuration (no-gi, symmetric initiative, shipped
rates, origin filter ON, H = infinity), on the 122 positive-mass hubs of G2R. "Meaning distance" is
exit-law TV (G2R Proposition 1). Nothing here changes the app, the layout file or the wire: every
modified wire is a COPY written to the caller's scratch directory.

  1. FRONTIER. Anchored stress layouts: minimise
         f(X) = sum_{i<j} (||x_i - x_j|| - s * TV_ij)^2  +  lambda * sum_h ||x_h - a_h||^2
     (a = shipped ground point, s = the scale that makes the unanchored stress solution match the
     shipped hubs' RMS radius) by anchored SMACOF majorization, over a lambda grid, warm-started
     from the anchor down the grid (deterministic continuation). Each iterate provably does not
     increase f (the lane file proves it; every iteration asserts it).
  2. PRICE. For each candidate point, a byte-faithful COPY of source/quartz/static/neural/
     graph-data.json with the new hub x/y (and technique hubs translated rigidly with their origin
     hub), gzip-9 delta of that one file (the eager gate gzips each file separately at level 9).
  3. NO-MOVE OPTION. Territory hulls on the shipped ground points (convex, alpha-shape, KDE level
     set, KDE dominance colouring), overlap, purity, the "drawn outside their own colour" list, and
     the wire cost of a per-hub territory id + robustness flag.
  4. THE HYPOTHESIS. Evaluate the fresh scratch layouts written by _geometry_relayout.py (the layout
     script's own code; unweighted vs kernel-flow-weighted), plus a first-order mechanism probe.

    python3 -B scripts/semantics/_geometry_choices.py --selfcheck
    python3 -B scripts/semantics/_geometry_choices.py --scratch <dir>      # writes geometry_choices.json
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import sys

import numpy as np
from scipy import linalg
from scipy.spatial import ConvexHull, Delaunay
from scipy.spatial.distance import cdist, pdist, squareform
from threadpoolctl import threadpool_limits

from _geometry_methods import (REPO, _layout_join, _ranks, _require, diffusion_distance, load_shipped_layout,
                               procrustes_disparity)
from _geometry_analysis import (SEED, FidelityCache, align_layout, classical_mds, kmedoids, null_summary,
                                tagged_rng, technique_origin_statistics, total_variation)
import geometry as G2
from _kernel import load_kernel

COMMAND = "python3 -B scripts/semantics/_geometry_choices.py"
OUTPUT = REPO / "tests/artifacts/semantics/geometry_choices.json"
G2R_ARTIFACT = REPO / "tests/artifacts/semantics/geometry.json"
WIRE = REPO / "source/quartz/static/neural/graph-data.json"
LAYOUT = REPO / "source/quartz/static/globalGraphLayout.json"
PRIMARY = ("nogi", "symmetric", "shipped")
KAPPAS = tuple(float(k) for k in np.logspace(3, -3, 31))     # lambda = kappa * (n - 1), descending
MOVE_TARGETS = (0.025, 0.05, 0.10)                           # median hub move, share of all-node diameter
GATE_DELTA_CAP = 5000                                        # tests/artifacts/payload_policy.json


def coverage_line(message, set_definition, counts):
    print(f"{message}; SET: {set_definition}; command: {COMMAND}; "
          + json.dumps(G2.jsonable(counts), sort_keys=True), flush=True)


# --------------------------------------------------------------------------- #
# 1. anchored SMACOF
# --------------------------------------------------------------------------- #
def anchored_objective(X, delta, anchor, lam):
    D = squareform(pdist(X))
    iu = np.triu_indices(len(X), 1)
    stress = float(np.sum((D[iu] - delta[iu]) ** 2))
    penalty = float(np.sum((X - anchor) ** 2))
    return stress + lam * penalty, stress, penalty


def anchored_smacof(delta, anchor, lam, init, max_iter=50000, rtol=1e-10):
    """Majorization for stress + lam * ||X - A||^2 (unit pair weights).

    Update: (V + lam I) X+ = B(X) X + lam A, with V = n(I - J), J = 11'/n, so
    (V + lam I)^-1 = (I - J)/(n + lam) + J/lam; at lam = 0 the Guttman transform X+ = B(X) X / n.
    Every iteration asserts f(X+) <= f(X) + 1e-12 * f(X_0) — the majorization guarantee, up to the
    rounding error of evaluating f at the problem's own scale.
    """
    delta = np.asarray(delta, dtype=float)
    A = np.asarray(anchor, dtype=float)
    X = np.array(init, dtype=float)
    n = len(delta)
    _require(delta.shape == (n, n) and A.shape == (n, 2) and X.shape == (n, 2) and lam >= 0, "smacof shapes")
    f, s, p = anchored_objective(X, delta, A, lam)
    f0 = max(f, 1e-300)                      # the problem's scale: rounding in f is ~eps * f0
    worst = 0.0
    for it in range(1, max_iter + 1):
        D = squareform(pdist(X))
        with np.errstate(divide="ignore", invalid="ignore"):
            B = np.where(D > 0, -delta / D, 0.0)
        np.fill_diagonal(B, 0.0)
        np.fill_diagonal(B, -B.sum(axis=1))
        Y = B @ X
        if lam > 0:
            Y = Y + lam * A
            mean = Y.mean(axis=0)
            Xn = (Y - mean) / (n + lam) + mean / lam
        else:
            Xn = Y / n
        fn, sn, pn = anchored_objective(Xn, delta, A, lam)
        worst = max(worst, (fn - f) / f0)
        _require(fn <= f + 1e-12 * f0, f"majorization increased the objective at iteration {it}")
        done = (f - fn) <= rtol * max(f, 1e-300)
        X, f, s, p = Xn, fn, sn, pn
        if done:
            break
    else:
        raise ValueError("anchored SMACOF did not converge")
    return X, {"iterations": it, "objective": f, "stress": s, "penalty": p,
               "worst_increase_relative_to_start": worst}


def rigid_align(X, A):
    """O(2) + translation, NO scale (the gauge of the unanchored endpoint)."""
    Xc, Ac = X - X.mean(axis=0), A - A.mean(axis=0)
    R, _ = linalg.orthogonal_procrustes(Xc, Ac)
    return Xc @ R + A.mean(axis=0)


def rms_radius(X):
    Xc = X - X.mean(axis=0)
    return float(np.sqrt(np.mean(np.sum(Xc * Xc, axis=1))))


# --------------------------------------------------------------------------- #
# technique hubs moved rigidly with their origin
# --------------------------------------------------------------------------- #
def technique_metrics(pos_xy, tech_xy, origin_idx):
    Dt = cdist(tech_xy, pos_xy)
    rows = np.arange(len(tech_xy))
    ratio = Dt[rows, origin_idx] / Dt.mean(axis=1)
    return {"median_ratio": float(np.median(ratio)), "mean_ratio": float(ratio.mean()),
            "origin_is_nearest_share": float(np.mean(np.argmin(Dt, axis=1) == origin_idx)),
            "ratio_above_one": int(np.sum(ratio > 1)), "techniques": len(tech_xy)}


# --------------------------------------------------------------------------- #
# 2. the wire
# --------------------------------------------------------------------------- #
def wire_bytes(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def gzip9(data):
    return len(gzip.compress(data, 9))


def load_wire(path=WIRE):
    raw = Path(path).read_bytes()
    obj = json.loads(raw)
    _require(wire_bytes(obj) == raw, "wire re-serialisation is not byte-identical: pricing would be wrong")
    return raw, obj


def price_wire(raw, obj, edit, out_path, record_as=None):
    """Apply `edit(copy)` to a deep copy; write it to out_path (scratch); return the gzip-9 delta.

    The artifact records WHERE the copy is as `record_as` (e.g. "<scratch>/wire_copies/<file>"),
    never the host path: the repository is public (G6)."""
    new = copy.deepcopy(obj)
    changed = edit(new)
    data = wire_bytes(new)
    Path(out_path).write_bytes(data)
    g0, g1 = gzip9(raw), gzip9(data)
    return {"nodes_changed": changed, "raw_bytes_before": len(raw), "raw_bytes_after": len(data),
            "raw_delta": len(data) - len(raw), "gzip9_before": g0, "gzip9_after": g1, "gzip9_delta": g1 - g0,
            "within_delta_cap_5000": (g1 - g0) <= GATE_DELTA_CAP,
            "copy": record_as if record_as is not None else Path(out_path).name}


def machine_paths(text, forbidden):
    """The forbidden absolute paths (resolved scratch dir, $HOME) that occur in `text`."""
    return sorted({f for f in forbidden if f and f.startswith("/") and f in text})


def refuse_machine_paths(text, forbidden):
    """Write-time refusal (G6): no committed artifact may carry a machine path."""
    hits = machine_paths(text, forbidden)
    _require(not hits, f"refusing to write an artifact containing machine path(s): {hits}")


def coordinate_edit(xy_by_id):
    def edit(obj):
        changed = 0
        for node in obj["nodes"]:
            new = xy_by_id.get(node["id"])
            if new is None:
                continue
            x, y = round(float(new[0]), 1), round(float(new[1]), 1)
            if (x, y) != (node["x"], node["y"]):
                changed += 1
            node["x"], node["y"] = x, y
        return changed
    return edit


def field_edit(fields_by_id):
    def edit(obj):
        changed = 0
        for node in obj["nodes"]:
            extra = fields_by_id.get(node["id"])
            if extra:
                node.update(extra)
                changed += 1
        return changed
    return edit


# --------------------------------------------------------------------------- #
# 3. hull geometry
# --------------------------------------------------------------------------- #
def convex_polygon(P):
    hull = ConvexHull(P)
    return P[hull.vertices]                       # counter-clockwise in 2-D


def shoelace(poly):
    if len(poly) < 3:
        return 0.0
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def clip_convex(subject, clipper):
    """Sutherland–Hodgman: subject ∩ clipper, both convex, clipper counter-clockwise. Exact."""
    out = [tuple(p) for p in subject]
    m = len(clipper)
    for k in range(m):
        a, b = clipper[k], clipper[(k + 1) % m]
        inp, out = out, []
        if not inp:
            break

        def side(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])

        for i in range(len(inp)):
            cur, prev = np.array(inp[i]), np.array(inp[i - 1])
            sc, sp = side(cur), side(prev)
            if sc >= 0:
                if sp < 0:
                    out.append(tuple(prev + (cur - prev) * (sp / (sp - sc))))
                out.append(tuple(cur))
            elif sp >= 0:
                out.append(tuple(prev + (cur - prev) * (sp / (sp - sc))))
    return np.array(out) if len(out) >= 3 else np.zeros((0, 2))


def inside_convex(points, poly, tol=1e-9):
    inside = np.ones(len(points), dtype=bool)
    for k in range(len(poly)):
        a, b = poly[k], poly[(k + 1) % len(poly)]
        cross = (b[0] - a[0]) * (points[:, 1] - a[1]) - (b[1] - a[1]) * (points[:, 0] - a[0])
        inside &= cross >= -tol * max(1.0, float(np.linalg.norm(b - a)))
    return inside


def alpha_triangles(P, radius):
    """Delaunay triangles of P with circumradius <= radius (the alpha shape's 2-cells)."""
    tri = Delaunay(P)
    T = P[tri.simplices]
    a = np.linalg.norm(T[:, 1] - T[:, 2], axis=1)
    b = np.linalg.norm(T[:, 0] - T[:, 2], axis=1)
    c = np.linalg.norm(T[:, 0] - T[:, 1], axis=1)
    area = 0.5 * np.abs((T[:, 1, 0] - T[:, 0, 0]) * (T[:, 2, 1] - T[:, 0, 1])
                        - (T[:, 2, 0] - T[:, 0, 0]) * (T[:, 1, 1] - T[:, 0, 1]))
    with np.errstate(divide="ignore", invalid="ignore"):
        R = np.where(area > 0, a * b * c / (4 * area), np.inf)
    return T[R <= radius], float(area[R <= radius].sum())


def inside_triangles(points, T, tol=1e-9):
    inside = np.zeros(len(points), dtype=bool)
    for tri in T:
        v0, v1 = tri[1] - tri[0], tri[2] - tri[0]
        den = v0[0] * v1[1] - v0[1] * v1[0]
        if den == 0:
            continue
        d = points - tri[0]
        u = (d[:, 0] * v1[1] - d[:, 1] * v1[0]) / den
        v = (v0[0] * d[:, 1] - v0[1] * d[:, 0]) / den
        inside |= (u >= -tol) & (v >= -tol) & (u + v <= 1 + tol)
    return inside


class Raster:
    """A fixed grid of cell centres; areas and overlaps of any region are counted cells x cell area."""

    def __init__(self, points, spacing, margin):
        lo, hi = points.min(axis=0) - margin, points.max(axis=0) + margin
        xs = np.arange(lo[0] + spacing / 2, hi[0], spacing)
        ys = np.arange(lo[1] + spacing / 2, hi[1], spacing)
        gx, gy = np.meshgrid(xs, ys)
        self.cells = np.column_stack([gx.ravel(), gy.ravel()])
        self.cell_area = spacing * spacing
        self.spacing = spacing

    def convex(self, poly):
        return inside_convex(self.cells, poly)

    def triangles(self, T):
        mask = np.zeros(len(self.cells), dtype=bool)
        for tri in T:
            lo, hi = tri.min(axis=0), tri.max(axis=0)
            sel = np.flatnonzero((self.cells[:, 0] >= lo[0]) & (self.cells[:, 0] <= hi[0])
                                 & (self.cells[:, 1] >= lo[1]) & (self.cells[:, 1] <= hi[1]))
            if len(sel):
                mask[sel] |= inside_triangles(self.cells[sel], tri[None])
        return mask

    def area(self, mask):
        return float(mask.sum() * self.cell_area)


def kde(points_eval, centres, h, chunk=20000):
    """Unnormalised isotropic Gaussian kernel sum (each centre contributes at most 1)."""
    out = np.zeros(len(points_eval))
    for s in range(0, len(points_eval), chunk):
        d2 = cdist(points_eval[s:s + chunk], centres, "sqeuclidean")
        out[s:s + chunk] = np.exp(-d2 / (2 * h * h)).sum(axis=1)
    return out


def territory_overlay(xy, labels, names, raster, hubs, unassigned_xy, h, alpha_radii):
    """Hull geometry per territory on the SHIPPED ground points; purity counts the 122 labelled hubs,
    and separately reports the unlabelled zero-mass hubs that fall inside."""
    K = len(names)
    regions = {}
    exact = {}
    polys = [convex_polygon(xy[labels == k]) for k in range(K)]
    regions["convex"] = [raster.convex(p) for p in polys]
    exact["convex_area"] = [shoelace(p) for p in polys]
    exact["convex_intersection_area"] = {f"{names[a]} & {names[b]}": shoelace(clip_convex(polys[a], polys[b]))
                                         for a in range(K) for b in range(a + 1, K)}
    membership = {"convex": [inside_convex(xy, p) for p in polys]}
    unassigned = {"convex": [inside_convex(unassigned_xy, p) for p in polys]}
    for r in alpha_radii:
        tris = [alpha_triangles(xy[labels == k], r * h) for k in range(K)]
        key = f"alpha_r{r:g}h"
        regions[key] = [raster.triangles(T) for T, _a in tris]
        exact[key + "_area"] = [a for _T, a in tris]
        membership[key] = [inside_triangles(xy, T) for T, _a in tris]
        unassigned[key] = [inside_triangles(unassigned_xy, T) for T, _a in tris]
    dens_cells = [kde(raster.cells, xy[labels == k], h) for k in range(K)]
    dens_pts = [kde(xy, xy[labels == k], h) for k in range(K)]
    dens_un = [kde(unassigned_xy, xy[labels == k], h) for k in range(K)] if len(unassigned_xy) else None
    levels = [float(np.quantile(dens_pts[k][labels == k], 0.10)) for k in range(K)]
    regions["kde90"] = [dens_cells[k] >= levels[k] for k in range(K)]
    membership["kde90"] = [dens_pts[k] >= levels[k] for k in range(K)]
    unassigned["kde90"] = [dens_un[k] >= levels[k] for k in range(K)] if dens_un else [np.zeros(0, bool)] * K
    out = {"kde_bandwidth": h, "kde_levels_10pct_of_own_points": levels}
    for kind, masks in regions.items():
        union = np.zeros(len(raster.cells), dtype=bool)
        for m in masks:
            union |= m
        rows = []
        for k in range(K):
            inside = membership[kind][k]
            own, foreign = int(np.sum(inside & (labels == k))), int(np.sum(inside & (labels != k)))
            rows.append({"territory": names[k], "hubs": int(np.sum(labels == k)),
                         "area_raster": raster.area(masks[k]),
                         "share_of_union_area": raster.area(masks[k]) / raster.area(union),
                         "area_overlapped_by_other_territories_share":
                             raster.area(masks[k] & np.any([masks[j] for j in range(K) if j != k], axis=0))
                             / max(raster.area(masks[k]), 1e-300),
                         "own_hubs_inside": own, "foreign_hubs_inside": foreign,
                         "own_hubs_outside": int(np.sum(labels == k) - own),
                         "purity_inside": own / max(own + foreign, 1),
                         "unassigned_zero_mass_hubs_inside": int(np.sum(unassigned[kind][k]))})
        pair_jaccard = {f"{names[a]} & {names[b]}": raster.area(masks[a] & masks[b]) / raster.area(masks[a] | masks[b])
                        for a in range(K) for b in range(a + 1, K)}
        in_foreign = [{"hub": hubs[i], "own": names[labels[i]],
                       "inside": [names[k] for k in range(K) if k != labels[i] and membership[kind][k][i]]}
                      for i in range(len(hubs)) if any(membership[kind][k][i] for k in range(K) if k != labels[i])]
        out[kind] = {"territories": rows, "pairwise_area_jaccard": pair_jaccard,
                     "overlap_share_of_union": raster.area(np.sum(masks, axis=0) >= 2) / raster.area(union),
                     "hubs_inside_a_foreign_region": in_foreign}
    # The single-colour overlay a map would actually draw: each place takes the territory with the
    # most kernel mass there (sizes included, the hub's own kernel included).
    dom = np.argmax(np.array(dens_pts), axis=0)
    wrong = [{"hub": hubs[i], "own": names[labels[i]], "drawn_as": names[dom[i]]}
             for i in range(len(hubs)) if dom[i] != labels[i]]
    out["kde_dominance"] = {"drawn_outside_own_colour": wrong, "count": len(wrong),
                            "point_purity": 1 - len(wrong) / len(hubs)}
    out["exact_checks"] = exact
    return out


# --------------------------------------------------------------------------- #
# the primary context (reused from G2R, cross-checked against its artifact)
# --------------------------------------------------------------------------- #
def primary_context(graph):
    K = load_kernel(*PRIMARY, graph=graph)
    P, mu, hubs, _q = G2.qprocess_hubs(K)
    E, Rext, _e = G2.extended_exit_law(K)
    clocked, _c = G2.clocked_exit_law(K, Rext)
    laws, _grouping, _l = G2.hub_exit_laws(K, hubs, E, clocked)
    TV = total_variation(laws["type"][0])
    joined = load_shipped_layout()
    layout = json.loads(LAYOUT.read_text())
    all_pos = tuple(sorted(joined["positions"]))
    hops_all, _cov = G2.layout_hops(layout, [joined["positions"][h]["layout_id"] for h in all_pos])
    idx = np.array([all_pos.index(h) for h in hubs])
    art = json.loads(G2R_ARTIFACT.read_text())
    pc = art["cases"]["/".join(PRIMARY)]
    _require(tuple(pc["hub_ids"]) == hubs, "hub set differs from the accepted G2R artifact")
    iu = np.triu_indices(len(hubs), 1)
    _require(abs(float(np.median(TV[iu])) - pc["distance_summaries"]["exit_tv"]["median"]) < 5e-6,
             "exit-law TV differs from the accepted G2R artifact")
    # territories: the G2R selected fit, refit deterministically and checked against its hub lists
    fit3 = kmedoids(TV, 3, seed=SEED + 3, restarts=8)
    art3 = [set(c["hubs"]) for c in pc["clusterings"]["exit_tv"]["clusters"]]
    fit_sets = [set(hubs[i] for i in np.flatnonzero(fit3["labels"] == k)) for k in range(3)]
    _require(sorted(map(sorted, fit_sets)) == sorted(map(sorted, art3)), "territory refit differs from G2R")
    names3 = [hubs[m] for m in fit3["medoids"]]
    fit2 = kmedoids(TV, 2, seed=SEED + 2, restarts=8)
    from _geometry_analysis import exit_distances
    Hel = exit_distances(laws["type"][0])["hellinger"]
    fitH = kmedoids(Hel, 2, seed=SEED + 2, restarts=8)
    leg = names3.index("inside-ashi-garami")
    claims = {r["hub"]: r for r in art["per_hub_claims"]["records"]}
    robust = {h: bool(claims[h]["perturbation_share"] >= .9 and all(claims[h][a] is True for a in
                                                                  ("other_initiative", "other_frame", "origin_off")))
              for h in hubs}
    tech_rows = []
    for category in ("transitions", "submissions"):
        for hub, rec in joined[category].items():
            tech_rows.append((category, hub, rec["layout_id"], rec["xy"]))
    by_id = {n["id"]: n for n in layout["nodes"]}
    origins = [by_id[lid]["fromPositionId"] for _c, _h, lid, _xy in tech_rows]
    _require(all(o in joined["positions"] for o in origins), "technique origin join")
    return {"K": K, "hubs": hubs, "TV": TV, "D4": diffusion_distance(P, mu, 4), "D1": diffusion_distance(P, mu, 1),
            "hops": hops_all[np.ix_(idx, idx)], "joined": joined, "layout": layout, "all_pos": all_pos,
            "A": np.array([joined["positions"][h]["xy"] for h in hubs]),
            "all_pos_xy": np.array([joined["positions"][h]["xy"] for h in all_pos]),
            "labels3": fit3["labels"], "names3": names3, "labels_leg": (fit3["labels"] == leg).astype(int),
            "labels_pam2": fit2["labels"], "names_pam2": [hubs[m] for m in fit2["medoids"]],
            "hellinger_k2_sets": [sorted(hubs[i] for i in np.flatnonzero(fitH["labels"] == k)) for k in range(2)],
            "robust": robust, "claims": claims, "tech_rows": tech_rows, "tech_origin_idx": np.array([all_pos.index(o) for o in origins]),
            "tech_xy": np.array([xy for *_r, xy in tech_rows]), "g2r": pc}


# --------------------------------------------------------------------------- #
# evaluation of one layout of the 122 hubs
# --------------------------------------------------------------------------- #
def nn_purity(X, labels):
    nearest = _ranks(squareform(pdist(X)))[0][:, 0]
    return float(np.mean(labels == labels[nearest]))


def evaluate_layout(ctx, X, cache, diameter):
    A = ctx["A"]
    moves = np.linalg.norm(X - A, axis=1)
    fid = cache.evaluate(X)
    moved = {h: X[i] - A[i] for i, h in enumerate(ctx["hubs"])}
    pos_new = ctx["all_pos_xy"].copy()
    for j, h in enumerate(ctx["all_pos"]):
        if h in moved:
            pos_new[j] = pos_new[j] + moved[h]
    shift = np.array([moved.get(ctx["all_pos"][o], np.zeros(2)) for o in ctx["tech_origin_idx"]])
    tech = technique_metrics(pos_new, ctx["tech_xy"] + shift, ctx["tech_origin_idx"])
    return {"median_move_share": float(np.median(moves) / diameter), "p90_move_share": float(np.quantile(moves, .9) / diameter),
            "max_move_share": float(moves.max() / diameter),
            **{f"{t}_{m}": fid[t][m] for t in fid for m in ("spearman", "trustworthiness_at5", "continuity_at5", "jaccard_at10")},
            "territory_nn_purity": nn_purity(X, ctx["labels3"]), "leg_nn_purity": nn_purity(X, ctx["labels_leg"]),
            "technique_translated": tech}


def frontier(ctx, diameter):
    A, TV = ctx["A"], ctx["TV"]
    n = len(A)
    cache = FidelityCache({"exit_tv": TV, "unweighted_hops": ctx["hops"], "diffusion_t4": ctx["D4"]})
    # scale: RMS-match the unanchored stress solution to the shipped hubs
    cm, _ = classical_mds(TV, 2)
    s0 = rms_radius(A) / rms_radius(cm)
    init0 = align_layout(cm, A, "rms")[0]
    X0, info0 = anchored_smacof(s0 * TV, A, 0.0, init0)
    s = s0 * rms_radius(A) / rms_radius(X0)
    delta = s * TV
    points, sols = [], {}
    X = A.copy()
    for kappa in KAPPAS:
        lam = kappa * (n - 1)
        X, info = anchored_smacof(delta, A, lam, X)
        sols[kappa] = X.copy()
        points.append({"kappa": kappa, "lambda": lam, **info, **evaluate_layout(ctx, X, cache, diameter),
                       "stress1": math.sqrt(info["stress"] / float(np.sum(np.triu(delta, 1) ** 2)))})
    Xz, infoz = anchored_smacof(delta, A, 0.0, X)
    Xz = rigid_align(Xz, A)
    endpoint = {"kappa": 0.0, "lambda": 0.0, **infoz, **evaluate_layout(ctx, Xz, cache, diameter),
                "stress1": math.sqrt(infoz["stress"] / float(np.sum(np.triu(delta, 1) ** 2))),
                "gauge": "unanchored stress solution, rigidly (O(2)+translation) aligned to the shipped hubs"}
    shipped = {"kappa": None, "lambda": "infinity (the shipped layout)", **evaluate_layout(ctx, A, cache, diameter),
               "stress1": math.sqrt(anchored_objective(A, delta, A, 0)[1] / float(np.sum(np.triu(delta, 1) ** 2)))}
    penalties = [p["penalty"] for p in points]
    violations = sum(1 for a, b in zip(penalties, penalties[1:]) if b < a * (1 - 1e-9))
    med = [p["median_move_share"] for p in points]
    med_violations = sum(1 for a, b in zip(med, med[1:]) if b < a - 1e-12)
    return {"scale_s": s, "scale_rms_matched_from": s0, "points": points, "unanchored": endpoint,
            "shipped": shipped, "penalty_monotone_violations": violations,
            "median_move_monotone_violations": med_violations, "cache": cache,
            "solutions": sols, "X_unanchored": Xz, "delta": delta}


def solve_for_move(ctx, fr, target, diameter):
    """Bisection in log kappa for median move = target, warm-started from the bracketing
    larger-kappa grid solution every time (path-independent, deterministic)."""
    pts = fr["points"]
    A, n, delta = ctx["A"], len(ctx["A"]), fr["delta"]
    for a, b in zip(pts, pts[1:]):
        if a["median_move_share"] <= target <= b["median_move_share"]:
            lo, hi = math.log(b["kappa"]), math.log(a["kappa"])
            warm = fr["solutions"][a["kappa"]]
            for _ in range(60):
                mid = 0.5 * (lo + hi)
                X, info = anchored_smacof(delta, A, math.exp(mid) * (n - 1), warm)
                m = float(np.median(np.linalg.norm(X - A, axis=1)) / diameter)
                if abs(m - target) < 2e-4:
                    break
                if m > target:
                    lo = mid
                else:
                    hi = mid
            return math.exp(mid), X, info
    raise ValueError(f"move target {target} not bracketed by the lambda grid")


# --------------------------------------------------------------------------- #
# 4. scratch layouts from _geometry_relayout.py
# --------------------------------------------------------------------------- #
def evaluate_relayouts(ctx, scratch, graph, cache_full, permutations):
    out = {}
    files = sorted(Path(scratch).glob("relayout/layout_*_seed*.json"))
    files = [f for f in files if not f.name.endswith(".report.json")]
    if not files:
        return {"status": "deferred: no scratch layouts found (run _geometry_relayout.py after the heavy advisory)"}
    Xship = ctx["A"]
    for f in files:
        lay = json.loads(f.read_text())
        joined = _layout_join(graph, lay)
        _require(set(joined["positions"]) == set(ctx["all_pos"]), f"{f.name}: position set differs")
        X = np.array([joined["positions"][h]["xy"] for h in ctx["hubs"]])
        bench = cache_full.benchmark(X, permutations)
        report = json.loads(f.with_suffix(".report.json").read_text()) if f.with_suffix(".report.json").exists() else {}
        by_id = {nd["id"]: nd for nd in lay["nodes"]}
        pos_xy = np.array([joined["positions"][h]["xy"] for h in ctx["all_pos"]])
        tech_xy = np.array([by_id[lid]["x"] for _c, _h, lid, _xy in ctx["tech_rows"]])
        tech_xy = np.column_stack([tech_xy, [by_id[lid]["y"] for _c, _h, lid, _xy in ctx["tech_rows"]]])
        out[f.stem] = {"fidelity": {t: {m: bench[t][m] for m in ("spearman", "trustworthiness_at5", "jaccard_at10")}
                                    for t in bench},
                       "territory_nn_purity": nn_purity(X, ctx["labels3"]), "leg_nn_purity": nn_purity(X, ctx["labels_leg"]),
                       "procrustes_vs_shipped": float(procrustes_disparity(Xship, X)),
                       "technique_origin": technique_metrics(pos_xy, tech_xy, ctx["tech_origin_idx"]),
                       "seconds": report.get("seconds"), "weights": report.get("weights"),
                       "weights_coverage": report.get("weights_coverage"),
                       "first_step_entropy": report.get("first_step_entropy"), "layout_sha256": report.get("layout_sha256")}
    # per variant, across seeds: is the variant's effect larger than the seed-to-seed spread?
    summary = {}
    for name, row in out.items():
        variant = name.split("layout_", 1)[1].rsplit("_seed", 1)[0]
        s = summary.setdefault(variant, {"layouts": [], "exit_tv_spearman": [], "exit_tv_trustworthiness_at5": [],
                                         "diffusion_t4_spearman": [], "unweighted_hops_spearman": [],
                                         "territory_nn_purity": []})
        s["layouts"].append(name)
        for t in ("exit_tv", "diffusion_t4", "unweighted_hops"):
            s[f"{t}_spearman"].append(row["fidelity"][t]["spearman"]["observed"])
        s["exit_tv_trustworthiness_at5"].append(row["fidelity"]["exit_tv"]["trustworthiness_at5"]["observed"])
        s["territory_nn_purity"].append(row["territory_nn_purity"])
    for s in summary.values():
        for k in list(s):
            if k != "layouts":
                s[k] = {"values": s[k], "min": min(s[k]), "max": max(s[k])}
    return {"layouts": out, "by_variant": summary}


def mechanism_probe(ctx, permutations):
    """First-order: how coarse is hops, and does 'shares technique neighbours' already carry exit TV?"""
    lay = ctx["layout"]
    ids = {nd["id"]: i for i, nd in enumerate(lay["nodes"])}
    n = len(ids)
    Adj = np.zeros((n, n))
    for e in lay["links"]:
        a, b = ids[e["source"]], ids[e["target"]]
        Adj[a, b] = Adj[b, a] = 1
    rows = np.array([ids[ctx["joined"]["positions"][h]["layout_id"]] for h in ctx["hubs"]])
    M = Adj[rows]
    norms = np.linalg.norm(M, axis=1)
    _require(norms.min() > 0, "a hub has no layout neighbours")
    cos = (M @ M.T) / np.outer(norms, norms)
    nbr = 1 - cos
    np.fill_diagonal(nbr, 0)
    two = Adj @ Adj
    M2 = two[rows]
    n2 = np.linalg.norm(M2, axis=1)
    nbr2 = 1 - (M2 @ M2.T) / np.outer(n2, n2)
    np.fill_diagonal(nbr2, 0)
    nbr2 = np.maximum(nbr2, 0)
    iu = np.triu_indices(len(rows), 1)
    values, counts = np.unique(ctx["hops"][iu], return_counts=True)
    ship = squareform(pdist(ctx["A"]))
    ref = {k: G2.upper_ranks(D) for k, D in (("exit_tv", ctx["TV"]), ("shipped_distance", ship))}
    out = {"hops_distinct_values": {str(int(v)): int(c) for v, c in zip(values, counts)}}
    # The best any ranking with these tie classes can do against exit TV: give the k pairs with the
    # smallest TV the smallest hop value, and so on (a monotone assignment of the SAME class sizes).
    order = np.argsort(ctx["TV"][iu], kind="stable")
    best = np.empty(len(order))
    best[order] = np.repeat(values, counts)
    ceiling = float(G2.upper_ranks(squareform(best)) @ G2.upper_ranks(ctx["TV"]))
    p2 = counts[values == 2].sum() / counts.sum()
    out["hops_spearman_ceiling_vs_exit_tv"] = {"exact_for_these_tie_classes": ceiling,
                                               "two_class_bound_sqrt_3p_1mp": float(math.sqrt(3 * p2 * (1 - p2))),
                                               "share_of_pairs_at_2_hops": float(p2)}
    for name, D in (("neighbour_cosine_distance", nbr), ("two_step_cosine_distance", nbr2), ("unweighted_hops", ctx["hops"])):
        r = G2.upper_ranks(D)
        out[name] = {k: null_summary(float(ref[k] @ r), [float(ref[k] @ G2.upper_ranks(D[np.ix_(p, p)])) for p in permutations])
                     for k in ref}
    return out


# --------------------------------------------------------------------------- #
# selfcheck: every method on a known answer, before real data
# --------------------------------------------------------------------------- #
def selfcheck():
    checks = 0

    def check(ok, name):
        nonlocal checks
        _require(ok, "G3 selfcheck: " + name)
        checks += 1

    rng = tagged_rng("g3-selfcheck")
    P = rng.normal(size=(25, 2)) * 10
    D = squareform(pdist(P))
    X, info = anchored_smacof(D, P + 5, 0.0, P + rng.normal(size=P.shape) * .3)
    check(info["stress"] < 1e-12 * np.sum(D ** 2), "unanchored SMACOF recovers an exact Euclidean configuration")
    check(info["worst_increase_relative_to_start"] <= 1e-12, "monotone objective (exact case)")
    X, info = anchored_smacof(D, P, 3.0, P + 1.0)
    check(np.max(np.abs(X - P)) < 1e-6, "anchor that realises delta is the fixed point for any lambda")
    Q = rng.uniform(0, 1, size=(25, 25))
    Q = (Q + Q.T)
    np.fill_diagonal(Q, 0)
    anchor = rng.normal(size=(25, 2))
    pens, prev = [], anchor.copy()
    for lam in (1e4, 1e2, 10.0, 1.0, .1, .01):
        prev, info = anchored_smacof(Q, anchor, lam, prev)
        check(info["worst_increase_relative_to_start"] <= 1e-12, "monotone objective (non-Euclidean delta)")
        pens.append(info["penalty"])
    check(all(b >= a * (1 - 1e-9) for a, b in zip(pens, pens[1:])), "penalty nonincreasing in lambda along the path")
    big, _ = anchored_smacof(Q, anchor, 1e9, anchor + .5)
    check(np.max(np.abs(big - anchor)) < 1e-6, "lambda -> infinity returns the anchor")
    n, lam = 7, 2.5
    V = n * np.eye(n) - np.ones((n, n))
    J = np.ones((n, n)) / n
    check(np.allclose((V + lam * np.eye(n)) @ ((np.eye(n) - J) / (n + lam) + J / lam), np.eye(n)), "closed-form inverse")
    R = np.array([[0, -1], [1, 0]])
    check(np.allclose(rigid_align(P @ R + 3, P), P), "rigid alignment removes rotation+translation, keeps scale")

    sq1 = np.array([[0, 0], [2, 0], [2, 2], [0, 2]], float)
    sq2 = sq1 + 1
    check(abs(shoelace(sq1) - 4) < 1e-12 and abs(shoelace(clip_convex(sq1, sq2)) - 1) < 1e-12, "exact convex areas")
    check(shoelace(clip_convex(sq1, sq1 + 5)) == 0, "disjoint convex intersection is empty")
    ras = Raster(np.vstack([sq1, sq2]), 0.01, 0.5)
    check(abs(ras.area(ras.convex(sq1) & ras.convex(sq2)) - 1) < 0.02, "raster intersection matches exact")
    grid = np.array([(i, j) for i in range(6) for j in range(6)], float)
    T, area = alpha_triangles(grid, 0.8)
    check(abs(area - 25) < 1e-9 and inside_triangles(np.array([[2.5, 2.5], [9, 9]]), T).tolist() == [True, False],
          "alpha shape of a unit grid is its square")
    check(abs(ras.area(ras.triangles(alpha_triangles(sq1, 5)[0])) - 4) < 0.05, "raster alpha area")
    pts = np.vstack([rng.normal(size=(30, 2)), rng.normal(size=(30, 2)) + 6])
    labels = np.r_[np.zeros(30, int), np.ones(30, int)]
    ov = territory_overlay(pts, labels, ["a", "b"], Raster(pts, .05, 1), [f"h{i}" for i in range(60)],
                           np.zeros((0, 2)), 1.0, (1, 2))
    check(ov["convex"]["overlap_share_of_union"] == 0 and ov["kde_dominance"]["count"] == 0,
          "separated territories: no overlap, no mis-coloured hub")
    check(all(r["own_hubs_inside"] >= 27 for r in ov["kde90"]["territories"]), "KDE level set holds >= 90% of own points")

    raw_obj = {"nodes": [{"id": "Positions/A", "x": 1.0, "y": -2.5, "t": "Á"}, {"id": "T/b", "x": 3.3, "y": 4.4}],
               "links": [[0, 1]]}
    raw = wire_bytes(raw_obj)
    check(json.loads(raw) == raw_obj and wire_bytes(json.loads(raw)) == raw, "wire round trip is byte-identical")
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        same = price_wire(raw, raw_obj, coordinate_edit({"Positions/A": (1.0, -2.5)}), Path(tmp) / "c.json")
        moved = price_wire(raw, raw_obj, coordinate_edit({"Positions/A": (100.04, 7.0)}), Path(tmp) / "d.json")
        check(same["gzip9_delta"] == 0 and same["raw_delta"] == 0 and same["nodes_changed"] == 0, "no-op edit prices zero")
        check(moved["nodes_changed"] == 1 and json.loads(Path(tmp, "d.json").read_text())["nodes"][0]["x"] == 100.0,
              "edit rounds to the emitter's 0.1")
    check(moved["copy"] == "d.json", "a price with no label records the bare file name, never a path")
    home = str(Path.home())
    fake = "/tmp/gs3-g6-fake-scratch"
    for bad_text in ('{"copy": "' + fake + '/wire_copies/x.json"}', '{"copy": "' + home + '/somewhere.json"}'):
        try:
            refuse_machine_paths(bad_text, [fake, home])
        except ValueError:
            checks += 1
        else:
            raise AssertionError("G3 selfcheck: a machine path was NOT refused")
    check(machine_paths('{"copy": "<scratch>/wire_copies/x.json"}', [fake, home]) == [],
          "a <scratch>-relative record passes the refusal")
    tech = rng.normal(size=(40, 2))
    pos = rng.normal(size=(9, 2))
    orig = rng.integers(0, 9, size=40)
    mine = technique_metrics(pos, tech, orig)
    ref = technique_origin_statistics(tech, pos, orig, rng.integers(0, 9, size=(3, 40)))["metrics"]
    check(abs(mine["median_ratio"] - ref["median_ratio"]["observed"]) < 1e-12
          and abs(mine["origin_is_nearest_share"] - ref["origin_is_nearest_hub"]["observed"]) < 1e-12,
          "technique metrics equal the G2R estimator")
    _require(checks >= 28, f"G3 selfcheck coverage {checks} below floor 28")
    print(f"PASS G3 selfcheck; SET: synthetic configurations, squares, grids, Gaussian territories, a toy wire; "
          f"command: {COMMAND} --selfcheck; {json.dumps({'assertions': checks})}", flush=True)
    return checks


# --------------------------------------------------------------------------- #
# run
# --------------------------------------------------------------------------- #
def run(scratch, replicates=200):
    checks = selfcheck()
    scratch = Path(scratch).resolve()
    _require(REPO not in scratch.parents, "scratch must be outside the repository")
    wire_dir = scratch / "wire_copies"
    wire_dir.mkdir(parents=True, exist_ok=True)
    graph = json.loads((REPO / "graph.json").read_text())
    ctx = primary_context(graph)
    layout = ctx["layout"]
    all_xy = np.array([[nd["x"], nd["y"]] for nd in layout["nodes"]])
    diameter = float(pdist(all_xy).max())
    hubs = ctx["hubs"]
    perms = np.array([tagged_rng(f"coordinates/{len(hubs)}/{i}").permutation(len(hubs)) for i in range(replicates)])

    # ---- 1. frontier
    fr = frontier(ctx, diameter)
    pts = fr["points"]
    rho0, rho1 = fr["shipped"]["exit_tv_spearman"], fr["unanchored"]["exit_tv_spearman"]
    m1 = fr["unanchored"]["median_move_share"]
    knee = max(pts, key=lambda p: (p["exit_tv_spearman"] - rho0) / (rho1 - rho0) - p["median_move_share"] / m1)
    candidates = {"knee": (knee["kappa"], fr["solutions"][knee["kappa"]])}
    for target in MOVE_TARGETS:
        kappa, X, _info = solve_for_move(ctx, fr, target, diameter)
        candidates[f"move_{target * 100:g}pct"] = (kappa, X)
    cand_out = {}
    cache = fr["cache"]
    raw, wobj = load_wire()
    wire_ids = {nd["id"]: nd for nd in wobj["nodes"]}
    lay_ids = {nd["id"]: nd for nd in layout["nodes"]}
    same_xy = sum(1 for i, nd in wire_ids.items() if i in lay_ids and (nd["x"], nd["y"]) == (lay_ids[i]["x"], lay_ids[i]["y"]))
    _require(same_xy == len(lay_ids) == len(wire_ids), "wire x/y are not the layout's ground x/y for every node")
    control = price_wire(raw, wobj, coordinate_edit({}), wire_dir / "graph-data.control.json",
                         record_as="<scratch>/wire_copies/graph-data.control.json")
    _require(control["gzip9_delta"] == 0 and control["raw_delta"] == 0, "no-op wire copy is not free")
    pos_layout_id = {h: ctx["joined"]["positions"][h]["layout_id"] for h in ctx["all_pos"]}
    for name, (kappa, X) in candidates.items():
        ev = evaluate_layout(ctx, X, cache, diameter)
        bench = cache.benchmark(X, perms)
        disp = {h: X[i] - ctx["A"][i] for i, h in enumerate(hubs)}
        pos_xy = {pos_layout_id[h]: ctx["joined"]["positions"][h]["xy"] + disp[h] for h in hubs}
        tech_xy = {lid: np.array(xy) + disp.get(ctx["all_pos"][o], 0) for (_c, _h, lid, xy), o
                   in zip(ctx["tech_rows"], ctx["tech_origin_idx"])}
        price_pos = price_wire(raw, wobj, coordinate_edit(pos_xy), wire_dir / f"graph-data.{name}.positions.json",
                               record_as=f"<scratch>/wire_copies/graph-data.{name}.positions.json")
        price_all = price_wire(raw, wobj, coordinate_edit({**pos_xy, **tech_xy}), wire_dir / f"graph-data.{name}.all.json",
                               record_as=f"<scratch>/wire_copies/graph-data.{name}.all.json")
        cand_out[name] = {"kappa": kappa, "lambda": kappa * (len(hubs) - 1), **ev,
                          "fidelity_with_null": {t: {m: bench[t][m] for m in ("spearman", "trustworthiness_at5")} for t in bench},
                          "wire_price_positions_only": price_pos, "wire_price_with_techniques": price_all,
                          "ground_coordinates": {h: [round(float(v), 1) for v in X[i]] for i, h in enumerate(hubs)}}
        coverage_line(f"CANDIDATE {name}", f"{len(hubs)} primary hubs; kappa={kappa:.4g}", {
            k: cand_out[name][k] for k in ("median_move_share", "p90_move_share", "exit_tv_spearman",
                                           "exit_tv_trustworthiness_at5", "unweighted_hops_spearman")}
            | {"wire_gzip9_delta_with_techniques": price_all["gzip9_delta"],
               "wire_gzip9_delta_positions_only": price_pos["gzip9_delta"]})

    # ---- 3. territory overlay
    A = ctx["A"]
    k5 = np.sort(squareform(pdist(ctx["all_pos_xy"])), axis=1)[:, 5]
    h = float(np.median(k5))
    unassigned = np.array([ctx["joined"]["positions"][x]["xy"] for x in ctx["all_pos"] if x not in hubs])
    raster = Raster(ctx["all_pos_xy"], diameter / 1000, 0.05 * diameter)
    overlay = {"bandwidth_rule": "h = median over the 133 shipped position hubs of the distance to the 5th-nearest hub",
               "raster_spacing": raster.spacing, "unassigned_zero_mass_hubs": int(len(unassigned)),
               "three_territories": territory_overlay(A, ctx["labels3"], ctx["names3"], raster, hubs, unassigned, h, (1, 2)),
               "leg_vs_rest": territory_overlay(A, ctx["labels_leg"], ["rest", "leg (inside-ashi-garami)"], raster, hubs,
                                                unassigned, h, (1, 2)),
               "pam_k2_split": {"medoids": ctx["names_pam2"], "sizes": np.bincount(ctx["labels_pam2"]).tolist(),
                                "equals_leg_vs_rest": bool(min(np.mean(ctx["labels_pam2"] == ctx["labels_leg"]),
                                                               np.mean(ctx["labels_pam2"] != ctx["labels_leg"])) == 0)},
               "hellinger_k2_leg_set_vs_tv_leg_territory": (lambda leg, sets: {
                   "tv_leg_territory": sorted(leg), "hellinger_smaller_set": min(sets, key=len),
                   "subset": set(min(sets, key=len)) <= set(leg),
                   "tv_only": sorted(set(leg) - set(min(sets, key=len)))})(
                   [hh for hh, lab in zip(hubs, ctx["labels_leg"]) if lab == 1], ctx["hellinger_k2_sets"])}
    # Which of the mis-coloured hubs are ALREADY fragile per-hub claims (G2R ruling 1)? Stored so the
    # doc's "five of those" is a field, not a join a reader has to redo.
    dom = overlay["three_territories"]["kde_dominance"]
    drawn = [x["hub"] for x in dom["drawn_outside_own_colour"]]
    facts = ("perturbation_share_ge_0.9", "other_initiative", "other_frame", "origin_off")

    def failed(hh):
        r = ctx["claims"][hh]
        return [f for f, ok in zip(facts, (r["perturbation_share"] >= .9, r["other_initiative"] is True,
                                           r["other_frame"] is True, r["origin_off"] is True)) if not ok]

    fragile = sorted(hh for hh in hubs if not ctx["robust"][hh])
    _require(all(bool(failed(hh)) == (hh in fragile) for hh in hubs), "fragile definition disagrees with ctx robust")
    both = sorted(set(drawn) & set(fragile))
    dom["fragile_claims_among_drawn_outside"] = {
        "count": len(both), "hubs": both, "facts_failed": {hh: failed(hh) for hh in both},
        "robust_hubs_drawn_outside": sorted(set(drawn) - set(fragile)),
        "drawn_outside_count": len(drawn), "fragile_claims_total": len(fragile), "hubs_total": len(hubs),
        "definition": "fragile = G2R's per-hub claim 'h is exit-law-TV-nearest to its territory medoid among "
                      "the three primary medoids' fails at least one of ruling 1's four facts: holds in >= 90% "
                      "of 200 K.perturbed(0.2, 0.2) seeds; holds under the other initiative (nogi/shipped); "
                      "holds in the other frame (gi/symmetric); holds under origin=False. Joined with this "
                      "object's drawn_outside_own_colour on hub id.",
        "claims_from": "tests/artifacts/semantics/geometry.json /per_hub_claims/records",
    }
    for key in ("three_territories", "leg_vs_rest"):
        ex = overlay[key]["exact_checks"]
        ras = [r["area_raster"] for r in overlay[key]["convex"]["territories"]]
        err = max(abs(a - b) / b for a, b in zip(ras, ex["convex_area"]))
        _require(err < 0.01, f"raster convex area disagrees with exact shoelace by {err:.3%}")
        overlay[key]["raster_vs_exact_convex_area_max_relative_error"] = err
    # territory ids on the wire (copies only)
    ids3 = {pos_layout_id[hh]: int(k) for hh, k in zip(hubs, ctx["labels3"])}
    rob = {pos_layout_id[hh]: ctx["robust"][hh] for hh in hubs}
    enc = {
        "ter_id_plus_robust_flag": {lid: {"ter": k, **({"terR": 1} if rob[lid] else {})} for lid, k in ids3.items()},
        "ter_signed_single_field": {lid: {"ter": k if rob[lid] else -1 - k} for lid, k in ids3.items()},
        "ter_id_only": {lid: {"ter": k} for lid, k in ids3.items()},
        "leg_flag_only": {pos_layout_id[hh]: {"leg": 1} for hh, lab in zip(hubs, ctx["labels_leg"]) if lab == 1},
    }
    overlay["wire_encodings"] = {name: price_wire(raw, wobj, field_edit(fields), wire_dir / f"graph-data.{name}.json",
                                                 record_as=f"<scratch>/wire_copies/graph-data.{name}.json")
                                 for name, fields in enc.items()}

    # ---- 4. hypothesis
    cache_full = FidelityCache({"exit_tv": ctx["TV"], "diffusion_t1": ctx["D1"], "diffusion_t4": ctx["D4"],
                                "unweighted_hops": ctx["hops"]})
    ship_bench = cache_full.benchmark(A, perms)
    relayouts = evaluate_relayouts(ctx, scratch, graph, cache_full, perms)
    mechanism = mechanism_probe(ctx, perms)

    frontier_out = {k: fr[k] for k in ("scale_s", "scale_rms_matched_from", "penalty_monotone_violations",
                                       "median_move_monotone_violations")}
    frontier_out["points"] = fr["points"]
    frontier_out["unanchored_endpoint"] = fr["unanchored"]
    frontier_out["shipped"] = fr["shipped"]
    paths = ["graph.json", "source/quartz/static/globalGraphLayout.json", "source/quartz/static/neural/graph-data.json",
             "scripts/semantics/_kernel.py", "scripts/semantics/geometry.py", "scripts/semantics/_geometry_choices.py",
             "scripts/semantics/_geometry_relayout.py", "scripts/regenerate_graph_layout.py",
             "tests/artifacts/semantics/geometry.json"]
    return {
        "schema": "geometry-choices-g3-v1", "recompute": f"{COMMAND} --scratch <dir>",
        "game": "the corpus's game (both seats sample authored attempt shares); primary configuration "
                "nogi / symmetric initiative / shipped rates / origin filter ON / H = infinity",
        "set_definition": f"the {len(hubs)} positive-mass hubs of G2R's primary configuration; the 11 zero-mass "
                          "(gi-only cloth) position hubs keep their shipped coordinates; technique hubs move rigidly "
                          "with their canonical origin hub",
        "sources_sha256": {p: hashlib.sha256((REPO / p).read_bytes()).hexdigest() for p in paths},
        "diameter_all_nodes": diameter, "selfcheck_assertions": checks,
        "g2r_crosscheck": {"hub_ids_equal": True, "exit_tv_median": float(np.median(ctx["TV"][np.triu_indices(len(hubs), 1)])),
                           "territories_equal": True, "territory_medoids": ctx["names3"]},
        "frontier": frontier_out, "candidates": cand_out,
        "wire": {"file": "source/quartz/static/neural/graph-data.json", "gzip_rule": "gzip.compress(bytes, 9), one file",
                 "delta_cap": GATE_DELTA_CAP, "nodes": len(wire_ids), "nodes_with_layout_xy": same_xy,
                 "control_no_op": control,
                 "process_cost": "regenerate_graph_layout.py is PRESERVE-COORDS by default: it reuses every prior "
                                 "(x, y) keyed by canonical id and embeds only NEW nodes; --fresh re-embeds everything. "
                                 "A relayout therefore ships as a one-off rewrite of globalGraphLayout.json coordinates "
                                 "(which later runs then preserve) followed by regenerate:neural; globalGraphLayout.json "
                                 "itself is an emitter input, not a fetched payload."},
        "overlay": overlay, "shipped_fidelity": ship_bench, "relayout": relayouts, "mechanism": mechanism,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--selfcheck", action="store_true")
    parser.add_argument("--scratch", type=Path, help="scratch dir: wire copies + relayout/ inputs")
    parser.add_argument("--json", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)
    try:
        with threadpool_limits(limits=1):
            if args.selfcheck:
                selfcheck()
                return 0
            _require(args.scratch is not None, "--scratch is required for a full run")
            out = args.json.resolve()
            _require(out.parent == OUTPUT.parent and out.name.startswith("geometry") and out.suffix == ".json",
                     "output must be an owned geometry*.json artifact")
            result = G2.rounded(G2.jsonable(run(args.scratch)))
            text = json.dumps(result, sort_keys=True, indent=1, allow_nan=False) + "\n"
            _require(len(text.encode()) < 1_000_000, "artifact over 1 MB")
            refuse_machine_paths(text, [str(args.scratch.resolve()), os.environ.get("HOME", ""), str(Path.home())])
            out.write_text(text)
            coverage_line("PASS geometry_choices written", "G3 frontier, prices, overlay, relayout",
                             {"bytes": len(text.encode()), "path": str(out)})
        return 0
    except (ValueError, KeyError, OSError, np.linalg.LinAlgError) as exc:
        print("FAIL geometry_choices:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
