#!/usr/bin/env python3
"""G4: page-ready geometry for the owner's visual explainer (the lead's Artifact page draws it).

One JSON file, written OUTSIDE the repository (the caller's scratch dir):
  * the 133 position hubs: id, display name by the app's `graphName` rule, SCREEN coordinates for the
    shipped layout and for G3's candidates A (2.5%) / B (5%) / C (the knee), computed by the app's
    own projection in `_deriveDualPairs` (no pair lift: one dot per hub), zero-mass flag, the primary
    exit-law-TV territory, the robust flag (ruling 1's four facts) and the leg-vs-rest flag;
  * alpha-shape polygons (r = h, as in G3) per territory and for leg / rest, as simple rings
    (outer boundaries + holes), in shipped screen coordinates and in candidate C's;
  * the 1,315 technique hubs (shipped only): screen point + origin hub id;
  * a `sources` block: sha256 of every file read, the exact recompute command.

THE PROJECTION IS THE APP'S, NOT A COPY OF IT. The three source lines (CO/SI constants, sx, sy) are
read from neural/src/app.src.jsx at run time, asserted verbatim, and EVALUATED BY NODE on every point
this file emits; the Python reimplementation (JS Math.round = nearest integer, ties toward +inf —
NOT Python's round(), which ties to even) must agree on all of them, or the run fails. The same is
done for `posFamily` (the rule `graphName` applies to a position).

    python3 -B scripts/semantics/_geometry_page.py --selfcheck
    python3 -B scripts/semantics/_geometry_page.py --out <scratch>/page_geometry.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.spatial import Delaunay
from scipy.spatial.distance import pdist, squareform

from _geometry_methods import REPO, _require

COMMAND = "python3 -B scripts/semantics/_geometry_page.py --out <scratch>/page_geometry.json"
APP = REPO / "neural/src/app.src.jsx"
WIRE = REPO / "source/quartz/static/neural/graph-data.json"
LAYOUT = REPO / "source/quartz/static/globalGraphLayout.json"
G2R = REPO / "tests/artifacts/semantics/geometry.json"
G3 = REPO / "tests/artifacts/semantics/geometry_choices.json"
PRIMARY = "nogi/symmetric/shipped"
CANDIDATES = {"A": "move_2.5pct", "B": "move_5pct", "C": "knee"}
APP_LINES = {
    "constants": "const CO = 0.8660254037844387, SI = 0.5, H = 4.0;   // cos30, sin30, PAIR_DIST/2",
    "sx": "const sx = Math.round((gx - gy) * CO * 10) / 10;",
    "sy": "const sy = Math.round((gx + gy) * SI * 10) / 10;",
    "posFamily": 'posFamily(t) { return (t || "").replace(/\\s+(Top|Bottom)\\s*$/i, "").trim(); }',
    "graphName": 'graphName(n) { return n.ty === "positions" ? this.posFamily(n.t) : this.splitName(n.t).main; }',
}
CO, SI = 0.8660254037844387, 0.5


# --------------------------------------------------------------------------- #
# the app's rules, reimplemented, and the harness that checks them against node
# --------------------------------------------------------------------------- #
def js_round(v):
    """ECMAScript Math.round: the closest integer, ties toward +infinity (exact: v - floor(v) is exact)."""
    f = math.floor(v)
    return f + 1 if v - f >= 0.5 else f


def project(gx, gy):
    """_deriveDualPairs: sx = Math.round((gx - gy) * CO * 10) / 10, sy = Math.round((gx + gy) * SI * 10) / 10."""
    return js_round((gx - gy) * CO * 10) / 10, js_round((gx + gy) * SI * 10) / 10


def pos_family(t):
    return re.sub(r"\s+(Top|Bottom)\s*$", "", t or "", flags=re.IGNORECASE).strip()


def app_source_lines():
    """Line numbers of the verbatim app lines; hard-fails if any line has changed."""
    text = APP.read_text().splitlines()
    found = {}
    for key, line in APP_LINES.items():
        hits = [i + 1 for i, row in enumerate(text) if row.strip() == line]
        _require(len(hits) == 1, f"app line '{key}' not found exactly once — the projection or name rule changed")
        found[key] = hits[0]
    return found


def node_eval(points, titles):
    """Run the app's OWN source lines in node over every point and title; return its answers."""
    js = (APP_LINES["constants"].split("//")[0] + "\n"
          "const fam = { " + APP_LINES["posFamily"] + " };\n"
          "let buf = ''; process.stdin.on('data', d => buf += d); process.stdin.on('end', () => {\n"
          "  const inp = JSON.parse(buf);\n"
          "  const pts = inp.points.map(([gx, gy]) => { " + APP_LINES["sx"] + " " + APP_LINES["sy"] + " return [sx, sy]; });\n"
          "  const names = inp.titles.map(t => fam.posFamily(t));\n"
          "  process.stdout.write(JSON.stringify({pts, names, version: process.version}));\n"
          "});\n")
    r = subprocess.run(["node", "-e", js], input=json.dumps({"points": points, "titles": titles}),
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


# --------------------------------------------------------------------------- #
# alpha shapes -> simple rings
# --------------------------------------------------------------------------- #
def alpha_triangles_idx(P, radius):
    """Indices of the Delaunay triangles of P with circumradius <= radius (G3's alpha rule), CCW."""
    if len(P) < 3:
        return np.zeros((0, 3), dtype=int)
    tri = Delaunay(P).simplices
    T = P[tri]
    a = np.linalg.norm(T[:, 1] - T[:, 2], axis=1)
    b = np.linalg.norm(T[:, 0] - T[:, 2], axis=1)
    c = np.linalg.norm(T[:, 0] - T[:, 1], axis=1)
    cross = (T[:, 1, 0] - T[:, 0, 0]) * (T[:, 2, 1] - T[:, 0, 1]) - (T[:, 2, 0] - T[:, 0, 0]) * (T[:, 1, 1] - T[:, 0, 1])
    area = 0.5 * np.abs(cross)
    with np.errstate(divide="ignore", invalid="ignore"):
        R = np.where(area > 0, a * b * c / (4 * area), np.inf)
    keep = tri[R <= radius]
    flip = cross[R <= radius] < 0
    keep[flip] = keep[flip][:, [0, 2, 1]]
    return keep


def signed_area(P, ring):
    x, y = P[ring, 0], P[ring, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def rings_from_triangles(P, tris):
    """Boundary of a union of CCW triangles as rings; region always on the LEFT of travel.

    Boundary edge = an edge of exactly one kept triangle, directed as in that triangle. At a vertex
    the next edge is the first outgoing edge CLOCKWISE from the reversed incoming direction (the
    tightest left turn), so two pieces that touch at one vertex come out as two rings, never one
    figure-eight. The successor map must be a bijection on the directed boundary edges; its cycles
    are the rings. Positive signed area = outer boundary, negative = hole.
    """
    count = defaultdict(int)
    for t in tris:
        for u, v in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            count[frozenset((int(u), int(v)))] += 1
    out = defaultdict(list)
    edges = []
    for t in tris:
        for u, v in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if count[frozenset((int(u), int(v)))] == 1:
                out[int(u)].append(int(v))
                edges.append((int(u), int(v)))
    succ = {}
    for u, v in edges:
        back = math.atan2(P[u, 1] - P[v, 1], P[u, 0] - P[v, 0])
        best, pick = None, None
        for w in out[v]:
            ang = math.atan2(P[w, 1] - P[v, 1], P[w, 0] - P[v, 0])
            cw = (back - ang) % (2 * math.pi)
            cw = 2 * math.pi if cw == 0 else cw
            if best is None or cw < best:
                best, pick = cw, w
        succ[(u, v)] = (v, pick)
    _require(len(set(succ.values())) == len(succ), "boundary successor map is not a bijection")
    rings, seen = [], set()
    for e in sorted(succ):
        if e in seen:
            continue
        ring, cur = [], e
        while cur not in seen:
            seen.add(cur)
            ring.append(cur[0])
            cur = succ[cur]
        _require(cur == e, "boundary walk did not close on its first edge")
        rings.extend(split_at_repeats(ring))
    return rings


def split_at_repeats(ring):
    """A traced ring that revisits a vertex is a KEYHOLE: a hole (or lobe) touching the rest at one
    point. Split it there, recursively, into rings that each visit every vertex once; the pieces
    keep the region on their left, so an enclosed pocket comes out negative (a hole touching its
    shell at a single vertex, which is a valid polygon)."""
    seen = {}
    for pos, v in enumerate(ring):
        if v in seen:
            i = seen[v]
            return split_at_repeats(ring[:i] + ring[pos:]) + split_at_repeats(ring[i:pos])
        seen[v] = pos
    return [ring]


def point_in_ring(pt, ring_xy):
    """Even-odd crossing test; ring_xy is an open list of vertices."""
    x, y = pt
    inside = False
    n = len(ring_xy)
    for i in range(n):
        (x1, y1), (x2, y2) = ring_xy[i], ring_xy[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xi > x:
                inside = not inside
    return inside


def _segments_cross(p1, p2, q1, q2):
    """Proper or collinear-overlap intersection of two closed segments (shared endpoints excluded by caller)."""
    def orient(a, b, c):
        v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        return 0 if v == 0 else (1 if v > 0 else -1)

    def on_seg(a, b, c):
        return min(a[0], b[0]) <= c[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= c[1] <= max(a[1], b[1])

    o1, o2, o3, o4 = orient(p1, p2, q1), orient(p1, p2, q2), orient(q1, q2, p1), orient(q1, q2, p2)
    if o1 != o2 and o3 != o4 and 0 not in (o1, o2, o3, o4):
        return True
    return ((o1 == 0 and on_seg(p1, p2, q1)) or (o2 == 0 and on_seg(p1, p2, q2))
            or (o3 == 0 and on_seg(q1, q2, p1)) or (o4 == 0 and on_seg(q1, q2, p2)))


def ring_validity(rings_xy):
    """Per ring: closed-able, >= 3 distinct vertices, no repeated vertex, no zero-length edge, no
    crossing or overlap between non-adjacent edges; across rings: edges meet only at shared vertices."""
    report = {"rings": len(rings_xy), "vertices": sum(len(r) for r in rings_xy), "repeated_vertex_rings": 0,
              "zero_length_edges": 0, "self_crossings": 0, "cross_ring_crossings": 0, "too_small": 0}
    segs = []
    for k, r in enumerate(rings_xy):
        pts = [tuple(p) for p in r]
        if len(pts) < 3:
            report["too_small"] += 1
        if len(set(pts)) != len(pts):
            report["repeated_vertex_rings"] += 1
        n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            if a == b:
                report["zero_length_edges"] += 1
            segs.append((k, i, a, b, n))
    for x in range(len(segs)):
        k1, i1, a1, b1, n1 = segs[x]
        for y in range(x + 1, len(segs)):
            k2, i2, a2, b2, n2 = segs[y]
            shared = {a1, b1} & {a2, b2}
            if k1 == k2 and (abs(i1 - i2) == 1 or abs(i1 - i2) == n1 - 1):
                continue                                     # adjacent edges share their vertex
            if shared:
                # touching at a shared vertex is allowed ACROSS rings (pinch / hole contact); within a
                # ring it would be a repeated vertex, already counted. Collinear overlap is not allowed.
                if len(shared) == 2:
                    report["cross_ring_crossings" if k1 != k2 else "self_crossings"] += 1
                continue
            if _segments_cross(a1, b1, a2, b2):
                report["cross_ring_crossings" if k1 != k2 else "self_crossings"] += 1
    # Rings may TOUCH at a shared vertex, never CROSS there: at a vertex two rings share, one ring's two
    # edges must not separate the other ring's two edges (angular interleaving = a transversal crossing).
    report["vertex_crossings"] = 0
    at = defaultdict(list)
    for k, r in enumerate(rings_xy):
        pts = [tuple(p) for p in r]
        for i, v in enumerate(pts):
            at[v].append((k, pts[i - 1], pts[(i + 1) % len(pts)]))
    for v, visits in at.items():
        for x in range(len(visits)):
            for y in range(x + 1, len(visits)):
                (_, a1, a2), (_, b1, b2) = visits[x], visits[y]
                ang = [math.atan2(q[1] - v[1], q[0] - v[0]) % (2 * math.pi) for q in (a1, a2, b1, b2)]
                lo, hi = sorted(ang[:2])
                inside = [lo < t < hi for t in ang[2:]]
                if inside[0] != inside[1] and all(t not in (lo, hi) for t in ang[2:]):
                    report["vertex_crossings"] += 1
    report["valid"] = (report["repeated_vertex_rings"] == 0 and report["zero_length_edges"] == 0
                       and report["vertex_crossings"] == 0
                       and report["self_crossings"] == 0 and report["cross_ring_crossings"] == 0
                       and report["too_small"] == 0)
    return report


def polygons_from_rings(P, rings):
    """Group rings: outer (area > 0) with the holes (area < 0) it contains."""
    outers = [r for r in rings if signed_area(P, r) > 0]
    holes = [r for r in rings if signed_area(P, r) < 0]
    polys = [{"outer": r, "holes": []} for r in sorted(outers, key=lambda r: -signed_area(P, r))]
    for h in holes:
        c = P[h].mean(axis=0)
        owners = [p for p in polys if point_in_ring(c, P[p["outer"]].tolist())]
        _require(owners, "a hole lies in no outer ring")
        min(owners, key=lambda p: signed_area(P, p["outer"]))["holes"].append(h)
    return polys


def shape(P_ground, idx, radius, screen_of):
    """Alpha shape of the hubs `idx` (indices into P_ground) -> polygons in screen coordinates + checks."""
    local = P_ground[idx]
    tris = alpha_triangles_idx(local, radius)
    rings = rings_from_triangles(local, tris) if len(tris) else []
    polys = polygons_from_rings(local, rings) if rings else []
    union_area = float(sum(abs(signed_area(local, list(t))) for t in tris))
    ring_area = float(sum(signed_area(local, r) for r in rings))
    covered = sorted({int(v) for t in tris for v in t})
    screen = [screen_of[int(idx[i])] for i in range(len(idx))]
    polys_xy = [{"outer": [list(screen[v]) for v in p["outer"]] + [list(screen[p["outer"][0]])],
                 "holes": [[list(screen[v]) for v in h] + [list(screen[h[0]])] for h in p["holes"]]}
                for p in polys]
    all_rings_xy = [[tuple(screen[v]) for v in r] for r in rings]
    # centroid containment: every kept triangle inside (even-odd over all rings), every dropped one outside
    all_tri = Delaunay(local).simplices if len(local) >= 3 else np.zeros((0, 3), int)
    kept = {tuple(sorted(map(int, t))) for t in tris}
    misplaced = 0
    for t in all_tri:
        cen = np.mean([screen[int(v)] for v in t], axis=0)
        inside = sum(point_in_ring(cen, r) for r in all_rings_xy) % 2 == 1
        misplaced += inside != (tuple(sorted(map(int, t))) in kept)
    return polys_xy, {"triangles": len(tris), "rings": len(rings), "polygons": len(polys),
                      "holes": sum(len(p["holes"]) for p in polys),
                      "ground_area_triangles": union_area, "ground_area_rings": ring_area,
                      "ring_vs_triangle_area_relative_error": abs(ring_area - union_area) / max(union_area, 1e-300),
                      "delaunay_triangles_checked": len(all_tri), "centroids_misclassified_in_screen": misplaced,
                      "uncovered_hubs": [int(idx[i]) for i in range(len(idx)) if i not in covered],
                      "validity_screen": ring_validity(all_rings_xy)}


# --------------------------------------------------------------------------- #
# selfcheck on known answers (and JS/Python agreement on tricky values)
# --------------------------------------------------------------------------- #
def selfcheck():
    checks = 0

    def check(ok, name):
        nonlocal checks
        _require(ok, "G4 selfcheck: " + name)
        checks += 1

    tricky = [(0.05, 0.0), (-0.05, 0.0), (1.25, 1.25), (-1.25, -1.25), (0.0577350269189626, 0.0),
              (12.34, -56.78), (-800.0, 799.95), (0.049999999999999996, 0.0), (1e3 + 0.05, 0.0), (-0.15, 0.0)]
    titles = ["K-Guard Top", "Turtle bottom", "Topaz", "Stop Top", "Mount  Top  ", "Guard", "", "X TOP"]
    js = node_eval([list(p) for p in tricky], titles)
    check(all(tuple(a) == project(*p) for a, p in zip(js["pts"], tricky)), "Python projection == node on tricky ties")
    check(js["names"] == [pos_family(t) for t in titles], "Python posFamily == node")
    check(js_round(2.5) == 3 and js_round(-2.5) == -2 and round(2.5) == 2, "Math.round ties toward +inf, unlike round()")
    P = np.array([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1]], float)
    one = rings_from_triangles(P, np.array([[0, 1, 2]]))
    check(len(one) == 1 and abs(signed_area(P, one[0]) - .5) < 1e-12, "single triangle ring")
    sq = rings_from_triangles(P, np.array([[0, 1, 3], [0, 3, 2]]))
    check(len(sq) == 1 and len(sq[0]) == 4 and abs(signed_area(P, sq[0]) - 1) < 1e-12, "square from two triangles")
    Q = np.array([[0, 0], [-1, 1], [-1, -1], [1, -1], [1, 1]], float)
    bow = rings_from_triangles(Q, np.array([[0, 1, 2], [0, 3, 4]]))
    check(len(bow) == 2 and all(abs(signed_area(Q, r) - 1) < 1e-12 for r in bow), "bow-tie splits into two rings at the pinch")
    check(ring_validity([[tuple(Q[v]) for v in r] for r in bow])["valid"], "bow-tie rings valid (touch at one vertex only)")
    # annulus: an outer square ring of 8 triangles around an empty unit square
    A = np.array([[0, 0], [3, 0], [3, 3], [0, 3], [1, 1], [2, 1], [2, 2], [1, 2]], float)
    tris = np.array([[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])
    ann = rings_from_triangles(A, tris)
    polys = polygons_from_rings(A, ann)
    check(len(ann) == 2 and len(polys) == 1 and len(polys[0]["holes"]) == 1, "annulus: one outer + one hole")
    check(abs(sum(signed_area(A, r) for r in ann) - 8) < 1e-12, "annulus area = 9 - 1")
    check(ring_validity([[tuple(A[v]) for v in r] for r in ann])["valid"], "annulus rings valid")
    K = np.array([[0, 0], [2, 0], [4, 0], [2, 4], [2.5, 1], [1.5, 1]], float)        # A M B C Q1 Q2
    key = rings_from_triangles(K, np.array([[0, 1, 5], [1, 2, 4], [2, 3, 4], [3, 5, 4], [3, 0, 5]]))
    check(sorted(round(signed_area(K, r), 12) for r in key) == [-0.5, 8.0],
          "keyhole: pocket touching the shell at one vertex -> outer 8 + hole -0.5")
    kp = polygons_from_rings(K, key)
    check(len(kp) == 1 and len(kp[0]["holes"]) == 1 and ring_validity([[tuple(K[v]) for v in r] for r in key])["valid"],
          "keyhole rings valid: hole touches its shell at a single vertex")
    cross = ring_validity([[(0, 0), (1, 1), (1, -1)], [(0, 0), (-1, 1), (2, 0.5)]])
    touch = ring_validity([[(0, 0), (1, 1), (1, -1)], [(0, 0), (-1, -1), (-1, 1)]])
    check(cross["vertex_crossings"] == 1 and not cross["valid"] and touch["vertex_crossings"] == 0 and touch["valid"],
          "rings crossing at a shared vertex are rejected; rings merely touching there are not")
    bad = ring_validity([[(0, 0), (2, 2), (2, 0), (0, 2)]])
    check(not bad["valid"] and bad["self_crossings"] >= 1, "a figure-eight ring is rejected")
    pts = np.random.default_rng(3104).normal(size=(40, 2))
    screen = {i: project(*pts[i] * 100) for i in range(40)}
    polys_xy, info = shape(pts * 100, np.arange(40), 80.0, screen)
    check(info["ring_vs_triangle_area_relative_error"] < 1e-12 and info["centroids_misclassified_in_screen"] == 0,
          "random alpha shape: rings enclose exactly the kept triangles")
    check(all(p["outer"][0] == p["outer"][-1] for p in polys_xy), "rings emitted closed")
    S = np.array([[CO, -CO], [SI, SI]])
    tri = np.array([[0., 0.], [3., 1.], [1., 2.]])
    check(abs(np.linalg.det(S) - 2 * CO * SI) < 1e-15 and
          abs(signed_area(tri @ S.T, [0, 1, 2]) - np.linalg.det(S) * signed_area(tri, [0, 1, 2])) < 1e-12 and
          signed_area(tri @ S.T, [0, 1, 2]) > 0, "projection det = 2 CO SI > 0: orientation kept, area x 0.866")
    _require(checks >= 17, f"G4 selfcheck coverage {checks} below floor 17")
    print(f"PASS G4 selfcheck; SET: tricky JS rounding ties, title strings, triangles, bow-tie, annulus, keyhole, a random "
          f"point cloud; command: python3 -B scripts/semantics/_geometry_page.py --selfcheck; "
          f"{json.dumps({'assertions': checks, 'node': js['version']})}", flush=True)
    return checks


# --------------------------------------------------------------------------- #
# build
# --------------------------------------------------------------------------- #
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def build():
    checks = selfcheck()
    lines = app_source_lines()
    wire = json.loads(WIRE.read_text())
    layout = json.loads(LAYOUT.read_text())
    g2r = json.loads(G2R.read_text())
    g3 = json.loads(G3.read_text())
    graph = json.loads((REPO / "graph.json").read_text())
    from _geometry_methods import _layout_join
    joined = _layout_join(graph, layout)
    lay_by_id = {n["id"]: n for n in layout["nodes"]}
    wire_by_id = {n["id"]: n for n in wire["nodes"]}
    _require(set(lay_by_id) == set(wire_by_id), "wire and layout node ids differ")
    _require(all((wire_by_id[i]["x"], wire_by_id[i]["y"]) == (lay_by_id[i]["x"], lay_by_id[i]["y"]) for i in lay_by_id),
             "wire x/y differ from the layout's ground x/y")
    hubs_all = sorted(joined["positions"])
    lid = {h: joined["positions"][h]["layout_id"] for h in hubs_all}
    case = g2r["cases"][PRIMARY]
    primary = case["hub_ids"]
    clusters = case["clusterings"]["exit_tv"]["clusters"]
    territory = {h: c["cluster"] for c in clusters for h in c["hubs"]}
    _require(set(territory) == set(primary) and len(primary) == 122, "territory join")
    leg_id = next(c["cluster"] for c in clusters if c["medoid"] == "inside-ashi-garami")
    claims = {r["hub"]: r for r in g2r["per_hub_claims"]["records"]}
    robust = {h: bool(claims[h]["perturbation_share"] >= .9 and all(claims[h][a] is True for a in
                                                                  ("other_initiative", "other_frame", "origin_off")))
              for h in primary}
    ground = {"shipped": {h: (wire_by_id[lid[h]]["x"], wire_by_id[lid[h]]["y"]) for h in hubs_all}}
    for key, cand in CANDIDATES.items():
        coords = g3["candidates"][cand]["ground_coordinates"]
        _require(set(coords) == set(primary), f"candidate {key} hub set")
        ground[key] = {h: (tuple(coords[h]) if h in coords else ground["shipped"][h]) for h in hubs_all}
    techs = [n for n in wire["nodes"] if n.get("ty") in ("transitions", "submissions")]
    _require(len(techs) >= 1300, "technique join below floor")
    # --- every emitted point, projected by Python AND by node running the app's own lines
    pts = [ground[k][h] for k in ground for h in hubs_all] + [(n["x"], n["y"]) for n in techs]
    titles = [wire_by_id[lid[h]]["t"] for h in hubs_all]
    js = node_eval([list(p) for p in pts], titles)
    py = [project(*p) for p in pts]
    mismatch = sum(1 for a, b in zip(js["pts"], py) if tuple(a) != b)
    _require(mismatch == 0 and len(js["pts"]) == len(pts), f"projection: {mismatch} points differ from the app's own lines")
    names = [pos_family(t) for t in titles]
    _require(js["names"] == names, "names differ from the app's posFamily")
    # The wire titles every position hub with its /top role-node's name ("K-Guard Top"); graph.json's
    # HUB record carries the bare authored name. graphName(title) must recover it on every hub.
    same_as_graph_name = sum(1 for h, nm in zip(hubs_all, names) if graph["positions"].get(h, {}).get("name") == nm)
    _require(same_as_graph_name == len(hubs_all), f"graphName(wire title) differs from graph.json's hub name on "
                                                  f"{len(hubs_all) - same_as_graph_name} hubs")
    screen = {k: {h: project(*ground[k][h]) for h in hubs_all} for k in ground}
    ten = [{"hub": h, "ground": list(ground["shipped"][h]), "screen_python": list(screen["shipped"][h]),
            "screen_node": js["pts"][hubs_all.index(h)]} for h in hubs_all[::13][:10]]
    # --- alpha shapes at r = h, h fixed from the SHIPPED 133 ground points (G3's rule)
    G = np.array([ground["shipped"][h] for h in hubs_all], float)
    h_scale = float(np.median(np.sort(squareform(pdist(G)), axis=1)[:, 5]))
    g3h = g3["overlay"]["three_territories"]["kde_bandwidth"]
    _require(abs(h_scale - g3h) < 1e-3 * g3h, "alpha scale differs from G3's h")
    idx_of = {h: i for i, h in enumerate(hubs_all)}
    classes = {f"territory_{c['cluster']}": [h for h in c["hubs"]] for c in clusters}
    classes["leg"] = [h for h in primary if territory[h] == leg_id]
    classes["rest"] = [h for h in primary if territory[h] != leg_id]
    shapes, checks_out = {}, {}
    for layout_key in ("shipped", "C"):
        Pg = np.array([ground[layout_key][h] for h in hubs_all], float)
        scr = {i: screen[layout_key][h] for i, h in enumerate(hubs_all)}
        shapes[layout_key], checks_out[layout_key] = {}, {}
        for cls, members in classes.items():
            polys, info = shape(Pg, np.array([idx_of[m] for m in members]), h_scale, scr)
            info["uncovered_hubs"] = [hubs_all[i] for i in info["uncovered_hubs"]]
            shapes[layout_key][cls] = polys
            checks_out[layout_key][cls] = info
    # tie to G3: exact alpha areas at r = h for the shipped layout
    g3_areas = g3["overlay"]["three_territories"]["exact_checks"]["alpha_r1h_area"]
    g3_names = [r["territory"] for r in g3["overlay"]["three_territories"]["convex"]["territories"]]
    medoid_of = {f"territory_{c['cluster']}": c["medoid"] for c in clusters}
    area_err = max(abs(checks_out["shipped"][cls]["ground_area_triangles"] - g3_areas[g3_names.index(medoid_of[cls])])
                   / g3_areas[g3_names.index(medoid_of[cls])] for cls in medoid_of)
    _require(area_err < 1e-4, f"alpha areas differ from G3 by {area_err:.3g}")
    for lk in checks_out:
        for cls, info in checks_out[lk].items():
            _require(info["validity_screen"]["valid"] and info["centroids_misclassified_in_screen"] == 0
                     and info["ring_vs_triangle_area_relative_error"] < 1e-9, f"invalid rings: {lk}/{cls}")
    # hubs strictly inside a FOREIGN territory shape (shipped), to compare with G3's r = h list
    foreign = []
    for h in primary:
        for c in clusters:
            if c["cluster"] == territory[h]:
                continue
            rings = [p["outer"][:-1] for p in shapes["shipped"][f"territory_{c['cluster']}"]] + \
                    [hole[:-1] for p in shapes["shipped"][f"territory_{c['cluster']}"] for hole in p["holes"]]
            if sum(point_in_ring(screen["shipped"][h], r) for r in rings) % 2 == 1:
                foreign.append({"hub": h, "inside": c["medoid"]})
    g3_foreign = g3["overlay"]["three_territories"]["alpha_r1h"]["hubs_inside_a_foreign_region"]
    hub_rows = []
    for h in hubs_all:
        row = {"id": h, "layout_id": lid[h], "name": names[hubs_all.index(h)], "zero_mass": h not in territory,
               "territory": territory.get(h), "robust": robust.get(h), "leg": (territory.get(h) == leg_id) if h in territory else None,
               "screen": {k: list(screen[k][h]) for k in ("shipped", "A", "B", "C")}}
        hub_rows.append(row)
    tech_rows = [{"id": n["id"], "s": list(project(n["x"], n["y"])), "o": lay_by_id[n["id"]]["fromPositionId"]}
                 for n in sorted(techs, key=lambda n: n["id"])]
    _require(all(t["o"] in joined["positions"] for t in tech_rows), "technique origin not a position hub")
    paths = {"neural/src/app.src.jsx": APP, "source/quartz/static/neural/graph-data.json": WIRE,
             "source/quartz/static/globalGraphLayout.json": LAYOUT, "graph.json": REPO / "graph.json",
             "tests/artifacts/semantics/geometry.json": G2R, "tests/artifacts/semantics/geometry_choices.json": G3,
             "scripts/semantics/_geometry_page.py": Path(__file__).resolve()}
    return {
        "schema": "page-geometry-g4-v1",
        "game": "the corpus's game; primary configuration nogi / symmetric initiative / shipped rates / origin ON / H = inf",
        "sources": {"sha256": {k: sha(p) for k, p in paths.items()}, "recompute": COMMAND,
                    "app_lines": lines, "node": js["version"],
                    "graphName_of_wire_title_equals_graph_hub_name": same_as_graph_name},
        "projection": {"rule": "screen = (Math.round((gx - gy) * CO * 10) / 10, Math.round((gx + gy) * SI * 10) / 10), "
                               "CO = 0.8660254037844387, SI = 0.5; no pair lift (one dot per hub)",
                       "points_checked_against_node": len(pts), "mismatches": 0, "ten_hubs": ten,
                       "note": "screen y grows downward on the canvas; ring orientation below is in these raw coordinates"},
        "definitions": {
            "name": "the app's graphName for a position = posFamily(title): the wire title minus a trailing Top/Bottom",
            "territory": "G2R primary exit-law-TV k=3 cluster index; medoids in `territories`; null for the 11 zero-mass hubs",
            "robust": "all four ruling-1 facts hold for 'h is in territory m' (G2R per_hub_claims)",
            "leg": "territory == the inside-ashi-garami territory",
            "candidates": "G3: A = 2.5% median move, B = 5%, C = the knee (~9.2%); the 11 zero-mass hubs keep their shipped points",
            "shapes": "alpha shapes: Delaunay triangles with circumradius <= h, h = median distance from a shipped "
                      "position hub to its 5th-nearest (shipped ground plane; the same h for candidate C), computed on "
                      "GROUND points and mapped through the projection (affine, det 0.866 > 0: containment and "
                      "orientation are preserved). Each polygon: an outer ring (positive signed area) and holes "
                      "(negative), every ring closed (first vertex repeated). Rings of one class may touch at a "
                      "single vertex (a pinch), never cross.",
            "techniques": "shipped only: screen point by the same projection, `o` = canonical origin position hub",
        },
        "territories": [{"id": c["cluster"], "medoid": c["medoid"], "hubs": len(c["hubs"]),
                         "robust_hubs": sum(robust[h] for h in c["hubs"]),
                         "leg": c["cluster"] == leg_id} for c in clusters],
        "hubs": hub_rows,
        "shapes": shapes,
        "shape_checks": {"alpha_h": h_scale, "g3_alpha_area_max_relative_error": area_err,
                         "per_layout": checks_out,
                         "hubs_inside_a_foreign_territory_shape_shipped": foreign,
                         "g3_same_list": [x["hub"] for x in g3_foreign]},
        "techniques": tech_rows,
        "selfcheck_assertions": checks,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--selfcheck", action="store_true")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.selfcheck:
            selfcheck()
            return 0
        _require(args.out is not None, "--out is required")
        out = args.out.resolve()
        _require(REPO not in out.parents, "G4 output goes to scratch, never into the repository")
        result = build()
        text = json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
        _require(len(text.encode()) < 300_000, f"page geometry is {len(text.encode())} bytes (limit 300 kB)")
        out.write_text(text)
        print(f"PASS page geometry written; SET: 133 position hubs, 1315 technique hubs, shapes for shipped and C; "
              f"command: {COMMAND}; " + json.dumps({"bytes": len(text.encode()), "path": str(out),
                                                    "points_checked_against_node": result["projection"]["points_checked_against_node"]}),
              flush=True)
        return 0
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as exc:
        print("FAIL page geometry:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
