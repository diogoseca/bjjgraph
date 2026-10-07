#!/usr/bin/env python3
"""Name-fit scores on explicit, ID-keyed sets, and (N2R) names derived from the exit law.

    python3 -B scripts/semantics/naming.py --selfcheck
    python3 -B scripts/semantics/naming.py --input sets.json --output <path>.json
    python3 -B scripts/semantics/naming.py --territories [--full-out <scratch>/naming_full.json]

--territories (N2R) reads the SHARED KERNEL (scripts/semantics/_kernel.py, never a
hand-built chain) and the N1 lexicon (tests/artifacts/semantics/vocabulary.json), and
writes tests/artifacts/semantics/naming.json (< 1 MB, asserted). Its definitions,
propositions and set conventions are in the N2R block below `selfcheck`; every number
it prints carries its set. The generic scorer below needs neither.

Input: {"universe": [ids], "regions": {name: [ids]}, "labels": {name: [ids]},
        "weights": {id: nonnegative_number}}. Weights are optional, must cover EXACTLY
the universe, and may be unnormalised. To use a reachable-only universe, explicitly
intersect BOTH regions and labels with it before calling. No silent intersection.

All region x label pairs belong to ONE BH family, including conservatively reserved
slots for refused empty sets. A refusal is not a zero score. Hypergeometric p-values
test uniform node subsets of fixed size, not a spatial/Markov null. BH's usual FDR
guarantee needs independence or suitable positive dependence; overlapping graph
labels/regions need not meet that condition. These are exploratory enrichments.

Weighted precision/recall/F1/lift replace cardinality by summed node weight. The
count-based hypergeometric p/q remain explicitly UNWEIGHTED: stationary masses are
not independent integer draws. Weighted significance requires a separately declared
null and is refused by name, rather than passing fractional counts to hypergeom.
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable, Mapping
from collections import Counter
import hashlib
from itertools import combinations
import json
import math
from pathlib import Path
import re
import sys

import numpy as np
from scipy.stats import hypergeom

ROOT = Path(__file__).resolve().parents[2]


def producer_sha256():
    """{repo-relative path of this script: its sha256}, recorded in every artifact it writes so that
    verify_all can tell a stale METHOD (a code change on the same graph.json) from a fresh one."""
    me = Path(__file__).resolve()
    return {me.relative_to(ROOT).as_posix(): hashlib.sha256(me.read_bytes()).hexdigest()}


class NamingRefusal(ValueError):
    """An undefined quantity or an invalid set/weight contract, never a numeric zero."""

    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(f"{code}: {detail}")


def _nodes(values: Iterable[str], subject: str) -> frozenset[str]:
    if isinstance(values, (str, bytes, Mapping)):
        raise NamingRefusal("INVALID_NODE_SET", subject)
    try:
        seq = list(values)
    except TypeError as exc:
        raise NamingRefusal("INVALID_NODE_SET", subject) from exc
    if any(not isinstance(x, str) or not x for x in seq):
        raise NamingRefusal("INVALID_NODE_ID", subject)
    if len(seq) != len(set(seq)):
        raise NamingRefusal("DUPLICATE_NODE_ID", subject)
    return frozenset(seq)


def _weights(universe: frozenset[str], weights: Mapping[str, float]) -> dict[str, float]:
    if not isinstance(weights, Mapping) or set(weights) != universe:
        keys = set(weights) if isinstance(weights, Mapping) else set()
        raise NamingRefusal("WEIGHT_ID_SET_MISMATCH",
                            f"missing={sorted(universe - keys)}, extra={sorted(keys - universe)}")
    out = {}
    for node in sorted(universe):
        value = weights[node]
        if isinstance(value, bool) or not isinstance(value, (int, float, np.integer, np.floating)):
            raise NamingRefusal("INVALID_WEIGHT", node)
        value = float(value)
        if not math.isfinite(value) or value < 0:
            raise NamingRefusal("INVALID_WEIGHT", node)
        out[node] = value
    # Scaling to a common maximum prevents overflow without changing any ratio.
    scale = max(out.values(), default=0.0)
    if scale == 0:
        raise NamingRefusal("ZERO_UNIVERSE_WEIGHT", "the universe has no positive mass")
    scaled = {k: v / scale for k, v in out.items()}
    if any(out[k] > 0 and scaled[k] == 0 for k in out):
        raise NamingRefusal("WEIGHT_DYNAMIC_RANGE_UNDERFLOW", "positive mass vanished on common scaling")
    return scaled


def _metrics(overlap: float, region: float, label: float, universe: float) -> dict:
    purity, recall, base = overlap / region, overlap / label, label / universe
    return {"precision": purity, "purity": purity, "recall": recall, "coverage": recall,
            "f1": 2 * overlap / (region + label), "base_rate": base,
            "lift": purity / base}


def _score(universe: frozenset[str], region: frozenset[str], label: frozenset[str],
           weights: dict[str, float] | None) -> dict:
    if not label:
        raise NamingRefusal("EMPTY_LABEL_SET", "recall and lift are undefined")
    if not region:
        raise NamingRefusal("EMPTY_REGION_SET", "precision is undefined")
    overlap = region & label
    n, r, s, k = len(universe), len(region), len(label), len(overlap)
    out = {"status": "ok", "counts": {"universe": n, "region": r, "label": s,
                                      "intersection": k},
           "intersection_ids": sorted(overlap),
           **_metrics(k, r, s, n),
           "p_hypergeom_upper": float(hypergeom.sf(k - 1, n, s, r))}
    if weights is not None:
        def mass(nodes):
            return math.fsum(weights[node] for node in sorted(nodes))
        total, rw, sw, kw = (mass(nodes) for nodes in (universe, region, label, overlap))
        if rw == 0 or sw == 0:
            out["weighted"] = {
                "status": "refused",
                "refusal": "ZERO_REGION_WEIGHT" if rw == 0 else "ZERO_LABEL_WEIGHT"}
        else:
            out["weighted"] = {
                "status": "ok", **_metrics(kw, rw, sw, total),
                "mass_fraction": {"universe": 1.0, "region": rw / total,
                                  "label": sw / total, "intersection": kw / total},
                "p": None, "q": None,
                "significance_refusal": "WEIGHTED_HYPERGEOMETRIC_UNDEFINED"}
    return out


def benjamini_hochberg(p_values: Iterable[float | None]) -> list[float | None]:
    """BH step-up adjusted p-values; None reserves a conservative p=1 family slot."""
    ps = list(p_values)
    if not ps:
        raise NamingRefusal("ZERO_TESTS", "BH requires at least one pair")
    if any(p is not None and (not math.isfinite(p) or not 0 <= p <= 1) for p in ps):
        raise NamingRefusal("INVALID_P_VALUE", "expected finite p in [0,1] or None")
    order = sorted(range(len(ps)), key=lambda i: (1.0 if ps[i] is None else ps[i], i))
    adjusted = [None] * len(ps)
    running = 1.0
    for rank0 in range(len(order) - 1, -1, -1):
        i = order[rank0]
        p = 1.0 if ps[i] is None else ps[i]
        running = min(running, p * len(ps) / (rank0 + 1))
        if ps[i] is not None:
            adjusted[i] = running
    return adjusted


def score_pairs(universe: Iterable[str], regions: Mapping[str, Iterable[str]],
                labels: Mapping[str, Iterable[str]], weights: Mapping[str, float] | None = None,
                *, alpha: float = 0.05) -> dict:
    """Score the complete Cartesian product in deterministic region/label name order.

    Use score_pairs(U, {"R": R}, {"S": S}, weights) for a single pair. Empty
    sets return named per-pair refusals; invalid IDs/weights refuse the entire run.
    The returned coverage counts are printed by the CLI and available to callers.
    """
    u = _nodes(universe, "universe")
    if not u:
        raise NamingRefusal("EMPTY_UNIVERSE", "the background must be specified")
    if not math.isfinite(alpha) or not 0 < alpha < 1:
        raise NamingRefusal("INVALID_ALPHA", str(alpha))
    if not regions or not labels:
        raise NamingRefusal("ZERO_TESTS", "regions and labels must each be nonempty mappings")
    sets = []
    for kind, mapping in (("region", regions), ("label", labels)):
        if not isinstance(mapping, Mapping) or any(not isinstance(k, str) or not k for k in mapping):
            raise NamingRefusal("INVALID_SET_NAMES", kind)
        group = {}
        for name in sorted(mapping):
            nodes = _nodes(mapping[name], f"{kind}:{name}")
            if not nodes <= u:
                raise NamingRefusal("NODE_OUTSIDE_UNIVERSE", f"{kind}:{name}: {sorted(nodes - u)}")
            group[name] = nodes
        sets.append(group)
    rs, ls = sets
    ws = None if weights is None else _weights(u, weights)
    rows = []
    for rn, r in rs.items():
        for sn, s in ls.items():
            try:
                score = _score(u, r, s, ws)
            except NamingRefusal as exc:
                score = {"status": "refused", "refusal": exc.code, "detail": str(exc),
                         "p_hypergeom_upper": None,
                         "counts": {"universe": len(u), "region": len(r), "label": len(s),
                                    "intersection": len(r & s)}}
            rows.append({"region": rn, "label": sn, **score})
    qs = benjamini_hochberg(row["p_hypergeom_upper"] for row in rows)
    for row, q in zip(rows, qs):
        row["q_bh"] = q
        row["bh_reject"] = q <= alpha if q is not None else None
    valid = sum(row["status"] == "ok" for row in rows)
    return {
        "schema": "graph-semantics.naming.v1",
        "set_definition": "Explicit supplied node-ID universe; all regions and labels are subsets; no implicit live/reachable filter.",
        "universe": sorted(u),
        "regions": {k: sorted(v) for k, v in rs.items()},
        "labels": {k: sorted(v) for k, v in ls.items()},
        "weights_normalized": None if ws is None else {
            k: v / math.fsum(ws.values()) for k, v in ws.items()},
        "coverage": {"universe_nodes": len(u), "regions": len(rs), "labels": len(ls),
                     "pairs_tested": len(rows), "pairs_scored": valid,
                     "pairs_refused": len(rows) - valid, "bh_family_size": len(rows),
                     "weighted_pairs_scored": sum(row.get("weighted", {}).get("status") == "ok" for row in rows)},
        "coverage_floors": {"universe_nodes": 1, "regions": 1, "labels": 1, "pairs_tested": 1},
        "inference": {"alpha": alpha, "tail": "P[X >= observed overlap]",
                      "null": "Uniform size-|R| subset of U, fixed S; unweighted nodes.",
                      "bh_family": "Every region x label pair in this call; refused pairs reserve p=1 slots but report null p/q.",
                      "limits": "Exploratory enrichment, not region discovery validation; BH FDR control is not guaranteed under arbitrary graph dependence.",
                      "weighted_significance": "Refused: WEIGHTED_HYPERGEOMETRIC_UNDEFINED; occupancy is not an integer sample count."},
        "scores": rows}


def selfcheck() -> dict:
    """Known finite sets, exhaustive randomisation tails, and known stationary weights."""
    u = list("abcdefgh")
    run = score_pairs(u, {"region": list("abcd")},
                      {"overlap": list("abe"), "disjoint": list("ef"), "empty": []},
                      dict(zip(u, range(1, 9))))
    rows = {row["label"]: row for row in run["scores"]}
    a = rows["overlap"]
    for key, value in {"precision": 1/2, "recall": 2/3, "f1": 4/7,
                       "base_rate": 3/8, "lift": 4/3, "p_hypergeom_upper": 1/2}.items():
        assert math.isclose(a[key], value, rel_tol=1e-14), (key, a[key], value)
    for key, value in {"precision": 3/10, "recall": 3/8, "f1": 1/3,
                       "base_rate": 2/9, "lift": 27/20}.items():
        assert math.isclose(a["weighted"][key], value, rel_tol=1e-14), key
    assert rows["disjoint"]["f1"] == rows["disjoint"]["lift"] == 0
    assert rows["disjoint"]["p_hypergeom_upper"] == 1
    assert rows["empty"]["refusal"] == "EMPTY_LABEL_SET"
    assert rows["empty"]["p_hypergeom_upper"] is None and rows["empty"]["q_bh"] is None
    assert benjamini_hochberg([.01, .04, .03, .002]) == [.02, .04, .04, .008]
    assert benjamini_hochberg([.01, None]) == [.02, None]
    # Independent exact tail: enumerate every fixed-size region on small universes.
    tails = subsets = 0
    for n in range(2, 9):
        universe = [str(i) for i in range(n)]
        for s in range(1, n + 1):
            label = set(universe[:s])
            for r in range(1, n + 1):
                candidates = list(combinations(universe, r))
                counts = [len(set(c) & label) for c in candidates]
                subsets += len(candidates)
                for k in sorted(set(counts)):
                    exact = sum(x >= k for x in counts) / len(counts)
                    assert math.isclose(float(hypergeom.sf(k-1, n, s, r)), exact,
                                        rel_tol=2e-14, abs_tol=2e-15)
                    tails += 1
    # An IID synthetic chain has this KNOWN stationary occupancy, independently
    # checked by pi P = pi; no real-chain implementation is introduced here.
    pi = np.array([.1, .2, .3, .4])
    p = np.tile(pi, (4, 1))
    assert np.allclose(pi @ p, pi, atol=1e-15, rtol=0)
    toy = score_pairs(list("abcd"), {"r": list("abc")}, {"s": list("bcd")},
                      dict(zip("abcd", pi)))["scores"][0]["weighted"]
    assert math.isclose(toy["precision"], 5/6)
    assert math.isclose(toy["recall"], 5/9)
    assert math.isclose(toy["f1"], 2/3)
    assert math.isclose(toy["lift"], 25/27)
    reverse = score_pairs(u[::-1], {"region": list("dcba")},
                          {"empty": [], "disjoint": list("fe"), "overlap": list("eba")},
                          dict(zip(u, range(1, 9))))
    assert run == reverse
    equal = score_pairs(u, {"r": list("abcd")}, {"s": list("abe")}, dict.fromkeys(u, 1))["scores"][0]
    for key in ("precision", "recall", "f1", "lift", "base_rate"):
        assert equal[key] == equal["weighted"][key]
    zero = score_pairs(list("ab"), {"r": ["a"]}, {"s": ["b"]}, {"a": 1, "b": 0})
    assert zero["scores"][0]["weighted"]["refusal"] == "ZERO_LABEL_WEIGHT"
    zero_region = score_pairs(list("ab"), {"r": ["b"]}, {"s": ["a"]}, {"a": 1, "b": 0})
    assert zero_region["scores"][0]["weighted"]["refusal"] == "ZERO_REGION_WEIGHT"
    huge = score_pairs(u, {"r": list("abcd")}, {"s": list("abe")}, dict.fromkeys(u, 1e308))["scores"][0]
    assert huge["weighted"] == equal["weighted"]
    empty = score_pairs(u, {"r": []}, {"s": ["a"]})
    assert empty["scores"][0]["refusal"] == "EMPTY_REGION_SET"
    refusals = [
        ([], {"r": ["a"]}, {"s": ["a"]}, None, "EMPTY_UNIVERSE"),
        (u, {}, {"s": ["a"]}, None, "ZERO_TESTS"),
        (u, {"r": ["z"]}, {"s": ["a"]}, None, "NODE_OUTSIDE_UNIVERSE"),
        (u, {"r": ["a", "a"]}, {"s": ["a"]}, None, "DUPLICATE_NODE_ID"),
        (u, {"r": ["a"]}, {"s": ["a"]}, {"a": 1}, "WEIGHT_ID_SET_MISMATCH"),
        (u, {"r": ["a"]}, {"s": ["a"]}, dict.fromkeys(u, 0), "ZERO_UNIVERSE_WEIGHT"),
        (u, {"r": ["a"]}, {"s": ["a"]}, dict.fromkeys(u, -1), "INVALID_WEIGHT"),
        (u, {"r": ["a"]}, {"s": ["a"]}, dict.fromkeys(u, float("nan")), "INVALID_WEIGHT"),
        (u, {"r": ["a"]}, {"s": ["a"]}, dict.fromkeys(u, None), "INVALID_WEIGHT"),
        (u, {"r": ["a"]}, {"s": ["a"]}, dict.fromkeys(u, complex(1, 2)), "INVALID_WEIGHT"),
        (u, {"r": None}, {"s": ["a"]}, None, "INVALID_NODE_SET"),
    ]
    for universe, rs, ls, ws, expected in refusals:
        try:
            score_pairs(universe, rs, ls, ws)
        except NamingRefusal as exc:
            assert exc.code == expected, (exc.code, expected)
        else:
            raise AssertionError(f"refusal mutant survived: {expected}")
    result = {"exact_hypergeometric_tails_checked": tails,
              "enumerated_subsets_with_multiplicity": subsets,
              "invalid_contracts_refused": len(refusals),
              "hand_computed_pair_tests": run["coverage"]["pairs_tested"],
              "synthetic_stationary_states": len(pi)}
    print("naming selfcheck: " + json.dumps(result, sort_keys=True))
    return result


# =========================================================================== #
# N2R — territories and names that come out of the exit law
# =========================================================================== #
# THE OBJECT. For a class C of finishing techniques (the N1 lexicon: structured type +
# targetArea body region; both performers pooled unless a performer is named), on the
# shared kernel's transient states t:
#     h_C(t) = P_t(the roll ends by a class-C finish)      a column group of K.exit_law()
#     R_C(t) = one-step mass from t straight into a C finish  a column group of K.R_fin
#     h_C = Q h_C + R_C                                     (harmonic off the core)
#     d(t) = sum_C h_C(t) = P_t(the roll is decided) = 1 - P_t(draw)
# CORE_C = {t : R_C(t) > 0}: states whose dealt hand finishes in class C directly or chains
# into a class-C submission. HALO_C = every other transient state.
#
# PROPOSITION 1 (maximum principle). R_C(t) = 0 implies h_C(t) <= max_{j: Q[t,j] > 0} h_C(j),
#   and h_C(t) = 0 when t has no transient successor. So every strict local maximum of h_C
#   over (a state + its successors) lies in CORE_C.
# PROPOSITION 2 (the halo inherits). On HALO, h_C = G h_C|CORE, G = (I - Q_HH)^{-1} Q_HC >= 0,
#   G 1 = P_t(reach CORE before absorption) <= 1. Hence h_C(t) <= P_t(reach CORE) max_CORE h_C,
#   and the global maximum of h_C is attained on CORE.
# PROPOSITION 3 (shares). On {d > 0}, s_C = h_C / d is harmonic for the chain CONDITIONED TO END
#   DECIDED (Doob transform by d): s_C(t) = sum_j P^d(t,j) s_C(j) + w(t) rho_C(t) with
#   P^d(t,j) = Q[t,j] d(j) / d(t), w = R_dec / d, rho_C = R_C / R_dec, rows summing to 1.
#   So Propositions 1-2 hold for shares on the conditioned chain, with the same CORE.
# Proofs: the N2R entry of lane-gs-5.md. Checked on known answers by n2r_selfcheck and on
# every kernel configuration by _max_principle.
#
# START LAWS (share_C(nu) = nu.h_C / nu.d, the class share of the rolls that END):
#   hub h        uniform over its 4 states {h/top, h/bottom} x {my turn, their turn}: seat- and
#                turn-neutral. TOP / BOTTOM name the player who STARTED on that seat.
#   role-node r  coin: 1/2 (r, my turn) + 1/2 (r, their turn); performer me / them.
#   standing     K.start("standing", "me") — baseline (i); "coin" is the hub law at standing.
#   mu           K.qprocess() mu on the reachable transient states — baseline (ii).
# UNIVERSE: hubs with BOTH role-nodes in K.reachable (from standing, in THIS kernel). Every
# other hub is listed as not evaluable, never scored as zero.
# TERRITORY R_C(theta; b, scale) = {h in U : E_C(h) >= theta}; ratio (spec) E = s / b, which
#   is bounded by 1/b, so theta * b > 1 is refused as IMPOSSIBLE_THRESHOLD; odds (sensitivity)
#   E = [s/(1-s)] / [b/(1-b)], unbounded.
# NAME best_name(h) = argmax E_C over classes with E_C >= NAME_THETA (ratio, standing b) AND
#   material excess s_C - b_C >= NAME_DELTA. NAME_DELTA = 0 is the literal spec rule; the gate
#   exists because the literal rule names hubs after a class holding < 1% of their finishes
#   whenever that class's baseline is ~0.1% (counted and listed in every run).
# CONFIDENCE of one hub's name = ROBUSTNESS (gs-shared ruling 1): the fraction of
#   K.perturbed(0.2, 0.2, seed), seeds 0..199, keeping the name (with its own recomputed
#   baseline), and whether it survives origin=False, the shipped rule and the gi frame.
# SET-LEVEL FIT (ruling 2): score_pairs — hypergeometric p + whole-family BH, EXPLORATORY.

N2R_THETAS = (1.5, 2.0, 3.0)
NAME_THETA = 2.0
NAME_DELTA = 0.05
NAME_DELTAS = (0.0, 0.02, 0.05, 0.10)
PERFORMERS = ("me", "them")
CLOCK_H = (9, 10, 11, 12)
ROBUST_SEEDS = 200
ROBUST_EPS = 0.2
MC_SEED = 20260924
MC_ROLLS = 200_000
ARTIFACT_BUDGET = 1_000_000
TOL = 1e-12
SCALES = ("ratio", "odds")
BASELINES = ("standing_me", "mu")
# (tag, frame, initiative, rates, origin) — the headline first (gs-shared ruling 4)
CONFIGS = (
    ("primary", "nogi", "symmetric", "shipped", True),
    ("other_rule", "nogi", "shipped", "shipped", True),
    ("other_frame", "gi", "symmetric", "shipped", True),
    ("origin_false", "nogi", "symmetric", "shipped", False),
    ("gi_shipped", "gi", "shipped", "shipped", True),
    ("gi_frame_rates", "gi", "symmetric", "frame", True),
)
ROBUST_ALTS = ("origin_false", "other_rule", "other_frame")
NAME_VARIANTS = {   # tag -> (theta, delta, scale, choose, baseline)
    "primary": (NAME_THETA, NAME_DELTA, "ratio", "enrichment", "standing_me"),
    "literal_delta0": (NAME_THETA, 0.0, "ratio", "enrichment", "standing_me"),
    "choose_kl": (NAME_THETA, NAME_DELTA, "ratio", "kl", "standing_me"),
    "choose_excess": (NAME_THETA, NAME_DELTA, "ratio", "excess", "standing_me"),
    "odds_scale": (NAME_THETA, NAME_DELTA, "odds", "enrichment", "standing_me"),
    "theta_1.5": (1.5, NAME_DELTA, "ratio", "enrichment", "standing_me"),
    "theta_3": (3.0, NAME_DELTA, "ratio", "enrichment", "standing_me"),
    "mu_baseline": (NAME_THETA, NAME_DELTA, "ratio", "enrichment", "mu"),
    "delta_0.02": (NAME_THETA, 0.02, "ratio", "enrichment", "standing_me"),
    "delta_0.10": (NAME_THETA, 0.10, "ratio", "enrichment", "standing_me"),
}


def _r(x, nd=6):
    """Round for the committed artifact (+0.0 folds -0.0); the full dump keeps full precision."""
    return round(float(x), nd) + 0.0


def _g(x, sig=4):
    return None if x is None else float(f"{float(x):.{sig}g}")


def _need(cond, code, detail=""):
    if not cond:
        raise NamingRefusal(code, detail)


# --------------------------------------------------------------------------- #
# pure methods (toys and the real kernel run the same code)
# --------------------------------------------------------------------------- #
def successor_max(Q, h, col_mask=None):
    """max over {j : Q[t,j] > 0 (and col_mask[j])} of h(j), per row; -inf if there is none."""
    import scipy.sparse as sp
    Q = sp.csr_matrix(Q)
    out = np.full(Q.shape[0], -np.inf)
    for t in range(Q.shape[0]):
        lo, hi = Q.indptr[t], Q.indptr[t + 1]
        js = Q.indices[lo:hi][Q.data[lo:hi] > 0]
        if col_mask is not None:
            js = js[np.asarray(col_mask, bool)[js]]
        if len(js):
            out[t] = h[js].max()
    return out


def local_maxima(Q, h, *, rows=None, col_mask=None, tol=TOL):
    """Strict: h(t) > tol and h(t) > max_succ + tol. Weak: h(t) > tol and h(t) >= max_succ - tol.
    Returns (strict indices, weak indices, successor max). `rows` limits the examined states."""
    h = np.asarray(h, float)
    m = successor_max(Q, h, col_mask)
    ok = np.ones(len(h), bool) if rows is None else np.asarray(rows, bool)
    strict = np.flatnonzero(ok & (h > tol) & (h > m + tol))
    weak = np.flatnonzero(ok & (h > tol) & (h >= m - tol))
    return strict, weak, m


def halo_decomposition(Q, h, core):
    """Proposition 2 computed: h on the HALO rebuilt from h on the CORE through the first-hit
    law G = (I - Q_HH)^{-1} Q_HC, and P_t(reach CORE before absorption) = G 1."""
    import scipy.sparse as sp
    import scipy.sparse.linalg as spla
    Q = sp.csr_matrix(Q)
    core = np.asarray(core, bool)
    hi, ci = np.flatnonzero(~core), np.flatnonzero(core)
    _need(len(ci) > 0, "EMPTY_CORE", "no state finishes in this class; Proposition 2 is vacuous")
    if not len(hi):
        return {"halo_states": 0, "core_states": int(len(ci)), "recon_residual": 0.0,
                "bound_violation": 0.0, "reach": np.zeros(0), "halo_index": hi}
    lu = spla.splu(sp.identity(len(hi), format="csc") - Q[hi][:, hi].tocsc())
    qhc = Q[hi][:, ci]
    recon = lu.solve(np.asarray(qhc @ h[ci], float).ravel())
    reach = lu.solve(np.asarray(qhc @ np.ones(len(ci)), float).ravel())
    top = float(h[ci].max())
    return {"halo_states": int(len(hi)), "core_states": int(len(ci)),
            "recon_residual": float(np.abs(recon - h[hi]).max()),
            "bound_violation": float(max(0.0, float((h[hi] - reach * top).max()))),
            "max_on_core": top, "max_on_halo": float(h[hi].max()), "reach": reach, "halo_index": hi}


def doob_share_identity(Q, Rc, Rdec, h, d):
    """Proposition 3 computed: on {d > 0}, s = h / d equals sum_j P^d s + w rho with P^d rows
    + w summing to 1. Returns (max identity residual, max |row sum - 1|, rows examined)."""
    import scipy.sparse as sp
    Q = sp.csr_matrix(Q)
    live = d > TOL
    s = np.where(live, h / np.where(live, d, 1.0), 0.0)
    Pd = sp.diags(np.where(live, 1.0 / np.where(live, d, 1.0), 0.0)) @ Q @ sp.diags(np.where(live, d, 0.0))
    w = np.where(live, Rdec / np.where(live, d, 1.0), 0.0)
    rho = np.where(Rdec > 0, Rc / np.where(Rdec > 0, Rdec, 1.0), 0.0)
    lhs = np.asarray(Pd @ s).ravel() + w * rho
    rows = np.asarray(Pd.sum(axis=1)).ravel() + w
    return (float(np.abs(lhs - s)[live].max()), float(np.abs(rows - 1)[live].max()), int(live.sum()))


def enrichment(s, b, scale="ratio"):
    _need(0 < b < 1, "BASELINE_OUTSIDE_(0,1)", f"b={b}")
    if scale == "ratio":
        return s / b
    _need(scale == "odds", "UNKNOWN_SCALE", scale)
    return math.inf if s >= 1 else (s / (1 - s)) / (b / (1 - b))


def threshold_share(theta, b, scale="ratio"):
    """The share a hub needs for E >= theta. May exceed 1 on the ratio scale (unattainable)."""
    if scale == "ratio":
        return theta * b
    o = theta * b / (1 - b)
    return o / (1 + o)


def territory(shares, b, theta, scale="ratio"):
    """R(theta) over an explicit {hub: class share} mapping. An unattainable threshold is a
    NAMED status, never an empty list that reads like 'no territory'."""
    _need(bool(shares), "EMPTY_UNIVERSE", "no hub to threshold")
    base = {"theta": theta, "scale": scale, "examined": len(shares)}
    if not 0 < b < 1:
        return {**base, "status": "BASELINE_OUTSIDE_(0,1)", "members": [], "baseline": b}
    cut = threshold_share(theta, b, scale)
    arg = max(sorted(shares), key=lambda h: shares[h])
    base.update({"threshold_share": cut, "max_share": shares[arg], "argmax": arg})
    if cut > 1:
        return {**base, "status": "IMPOSSIBLE_THRESHOLD", "members": []}
    members = sorted(h for h in shares if shares[h] >= cut - TOL)
    return {**base, "status": "ok" if members else "EMPTY", "members": members}


def name_rule(s, b, classes, *, theta=NAME_THETA, delta=NAME_DELTA, scale="ratio", choose="enrichment"):
    """The best name of ONE start law (s, b = class shares in `classes` order), or None."""
    cands = []
    for i, c in enumerate(classes):
        if not 0 < b[i] < 1 or s[i] <= 0:
            continue
        e = enrichment(s[i], b[i], scale)
        if e >= theta - TOL and s[i] - b[i] >= delta - TOL:
            key = {"enrichment": e, "kl": s[i] * math.log(s[i] / b[i]), "excess": s[i] - b[i]}[choose]
            cands.append((key, e, c))
    return max(cands)[2] if cands else None


# N3 — SEAT-AWARE NAMES. S^sigma_C(h) = P(the roll ends by a class-C finish performed by the player
# who STARTED on seat sigma | decided), from the hub start law; S^TOP_C + S^BOTTOM_C = s_C (pooled).
# Per-player baseline beta_C = b_C / 2: at standing the seat labels are arbitrary tags, so the only
# label-free baseline for "ONE given player finishes by C" is half the pooled standing share (and
# beta^TOP + beta^BOTTOM = b). (C, sigma) PASSES when S^sigma_C >= theta* beta_C AND
# S^sigma_C - beta_C >= delta (the same two gates as N2R). The seat-aware name REFINES, never
# overrides: a pooled name keeps its class and gains a qualifier (BOTH / TOP / BOTTOM / SHARED);
# an unnamed hub gains "C for the sigma player" when some (C, sigma) passes.
# PROPOSITION 5 (lane-gs-5 N3), for any start law, with beta = b/2:
#   (a) both seats pass (theta, delta) for C  =>  the pooled rule passes (theta, 2 delta) for C;
#   (b) pooled E_C >= theta  =>  max_sigma E^sigma_C >= theta              (pigeonhole);
#   (c) pooled excess >= 2 delta  =>  max_sigma excess^sigma >= delta;
#   (d) E^sigma_C <= 1 / beta_C = 2 / b_C: the seat scale doubles the pooled ceiling;
#   (e) under the symmetric rule S^TOP_C(h) = the coin "me" share of role-node h/top and
#       S^BOTTOM_C(h) = that of h/bottom (Prop. 4b; gs-2 D/E): a seat name is a property of the SEAT.
# By (a), an unnamed hub's seat name always names exactly ONE seat (asserted for beta = b/2).
SEATS = ("TOP", "BOTTOM")
SEAT_BASELINES = ("per_player", "standing_seat", "mu_per_player")


def seat_candidates(top, bottom, beta_top, beta_bottom, classes, *, theta=NAME_THETA, delta=NAME_DELTA):
    """{class: [(seat, seat enrichment)]} for every (class, seat) passing both gates."""
    out = {}
    for i, c in enumerate(classes):
        for seat, S, beta in (("TOP", top[i], beta_top[i]), ("BOTTOM", bottom[i], beta_bottom[i])):
            if not 0 < beta < 1 or S <= 0:
                continue
            e = S / beta
            if e >= theta - TOL and S - beta >= delta - TOL:
                out.setdefault(c, []).append((seat, e))
    return out


def seat_aware_name(pooled, top, bottom, beta_top, beta_bottom, classes, *, theta=NAME_THETA,
                    delta=NAME_DELTA, strict=True):
    """(class, qualifier) or (None, None). A pooled name is kept and qualified; an unnamed start
    law may gain a ONE-seat name (the class with the largest seat enrichment)."""
    cand = seat_candidates(top, bottom, beta_top, beta_bottom, classes, theta=theta, delta=delta)
    if pooled is not None:
        seats = sorted(sd for sd, _e in cand.get(pooled, []))
        return pooled, ("BOTH" if len(seats) == 2 else seats[0] if seats else "SHARED")
    if not cand:
        return None, None
    c = max(sorted(cand), key=lambda k: max(e for _sd, e in cand[k]))
    seats = sorted(sd for sd, _e in cand[c])
    if strict:
        _need(len(seats) == 1, "PROPOSITION_5A_VIOLATED", f"both seats pass {c} but the pooled rule did not")
    return c, ("BOTH" if len(seats) == 2 else seats[0])


def n3_label(name):
    c, q = name
    return None if c is None else f"{c}|{q}"


def seat_split(rows12):
    """rows12: the 4 hub states in order (top,M), (top,T), (bottom,M), (bottom,T) x interleaved
    columns [C0 me, C0 them, C1 me, ...]. Under the uniform law on those states returns the
    class masses finished by the player who STARTED on top, and by the one who started below."""
    me, them = rows12[:, 0::2], rows12[:, 1::2]
    top = 0.25 * (me[0] + me[1] + them[2] + them[3])
    bottom = 0.25 * (them[0] + them[1] + me[2] + me[3])
    return top, bottom


def clocked_masses(Q0, Q1, Rg, H):
    """P(end in each column group within H plies): the kernel's finite-horizon recursion
    x_m = (I + Q0)(Rg + Q1 x_{m-1}) with a matrix right-hand side (Q0 Q0 = 0 is gated)."""
    Rg = np.asarray(Rg, float)
    x = np.zeros_like(Rg)
    for _ in range(H):
        y = Rg + np.asarray(Q1 @ x)
        x = y + np.asarray(Q0 @ y)
    return x


def sample_rolls(src, mass, dst, fin, n_t, start, n, seed, max_steps=20_000):
    """Seeded rolls drawn CELL BY CELL (card x branch x outcome) from a cell table, never from
    Q/R: independent of the linear solve and of the column grouping. Returns (absorbing column
    per roll, finisher column or -1, censored rolls, steps per roll)."""
    src, mass, dst, fin = (np.asarray(a) for a in (src, mass, dst, fin))
    _need(bool(np.all(np.diff(src) >= 0)), "CELLS_NOT_SORTED", "cell table must be sorted by src")
    rng = np.random.default_rng(seed)
    gp = np.concatenate([[0.0], np.cumsum(mass)])
    idx = np.arange(n_t)
    lo, hi = np.searchsorted(src, idx, "left"), np.searchsorted(src, idx, "right")
    start = np.asarray(start, float)
    _need(bool(np.all(hi[start > 0] > lo[start > 0])), "START_STATE_WITHOUT_CELLS")
    base, rowsum = gp[lo], gp[hi] - gp[lo]
    state = rng.choice(n_t, size=n, p=start / start.sum())
    alive = np.ones(n, bool)
    absk, finc, steps = np.full(n, -1), np.full(n, -1), np.zeros(n, np.int64)
    for _ in range(max_steps):
        ia = np.flatnonzero(alive)
        if not len(ia):
            break
        s = state[ia]
        c = np.searchsorted(gp, base[s] + rng.random(len(ia)) * rowsum[s], side="right") - 1
        c = np.clip(c, lo[s], hi[s] - 1)
        steps[ia] += 1
        dd = dst[c]
        mv = dd >= 0
        state[ia[mv]] = dd[mv]
        done = ia[~mv]
        absk[done] = -1 - dd[~mv]
        finc[done] = fin[c[~mv]]
        alive[done] = False
    return absk, finc, int(alive.sum()), steps


def holds_fraction(reference, samples):
    """Share of samples equal to the reference claim (None == None counts: 'unnamed' holds)."""
    samples = list(samples)
    _need(len(samples) > 0, "ZERO_SAMPLES", "a robustness fraction over nothing is not 1")
    return sum(x == reference for x in samples) / len(samples)


def _assert_maxima_in_core(strict, core, label):
    outside = [int(t) for t in strict if not core[t]]
    _need(not outside, "MAXIMUM_PRINCIPLE_VIOLATED", f"{label}: strict local maxima outside the core at {outside[:10]}")


# --------------------------------------------------------------------------- #
# known-answer proofs of the methods (no kernel, no corpus)
# --------------------------------------------------------------------------- #
def _ruin(n_pos=8, p_left=0.37, kill=0.0):
    """Gambler's ruin on positions 1..n_pos-1 (index i = position i+1): left w.p. p(1-k), right
    w.p. q(1-k), draw w.p. k. Exiting left finishes class X (column 0), right class Y (column 1)."""
    m = n_pos - 1
    q = 1 - p_left
    Q = np.zeros((m, m))
    Rf = np.zeros((m, 2))
    Rd = np.full(m, kill)
    for i in range(m):
        if i > 0:
            Q[i, i - 1] = p_left * (1 - kill)
        else:
            Rf[i, 0] = p_left * (1 - kill)
        if i < m - 1:
            Q[i, i + 1] = q * (1 - kill)
        else:
            Rf[i, 1] = q * (1 - kill)
    return Q, Rf, Rd


def _cells_of(Q, Rf, Rd):
    """A cell table for a toy chain: one cell per nonzero Q / Rf / draw entry, sorted by src."""
    rows = []
    for t in range(Q.shape[0]):
        for j in np.flatnonzero(Q[t] > 0):
            rows.append((t, Q[t, j], int(j), -1))
        for c in np.flatnonzero(Rf[t] > 0):
            rows.append((t, Rf[t, c], -1 - (0 if c == 0 else 1), int(c)))
        if Rd[t] > 0:
            rows.append((t, Rd[t], -3, -1))
    a = np.array(rows, dtype=[("src", np.int64), ("mass", float), ("dst", np.int64), ("fin", np.int64)])
    return a["src"], a["mass"], a["dst"], a["fin"]


def _solve(Q, B):
    import scipy.sparse as sp
    import scipy.sparse.linalg as spla
    A = sp.identity(Q.shape[0], format="csc") - sp.csc_matrix(Q)
    X = spla.splu(A).solve(np.asarray(B, float))
    return X, float(np.abs(A @ X - B).max())


def n2r_selfcheck() -> dict:
    """Every N2R method against a known answer, then a mutant that must fail."""
    checks = {}
    # 1. closed-form exit law of gambler's ruin; Propositions 1-2 on it.
    for p_left in (0.37, 0.5, 0.63):
        Q, Rf, Rd = _ruin(8, p_left)
        H, res = _solve(Q, Rf)
        N = 8
        pos = np.arange(1, N)
        if p_left == 0.5:
            exact = 1 - pos / N
        else:
            rho = p_left / (1 - p_left)
            exact = (rho ** pos - rho ** N) / (1 - rho ** N)
        assert res < 1e-14 and np.abs(H[:, 0] - exact).max() < 1e-13, (p_left, np.abs(H[:, 0] - exact).max())
        for col in (0, 1):
            core = Rf[:, col] > 0
            strict, weak, _m = local_maxima(Q, H[:, col])
            _assert_maxima_in_core(strict, core, f"ruin p={p_left} col={col}")
            assert list(strict) == [0 if col == 0 else 6], strict
            dec = halo_decomposition(Q, H[:, col], core)
            assert dec["recon_residual"] < 1e-14 and dec["bound_violation"] < 1e-14, dec["bound_violation"]
            if col == 0:
                # P_i(hit position 1 before N) = ruin on [1, N]: known closed form
                if p_left == 0.5:
                    reach = 1 - (pos[1:] - 1) / (N - 1)
                else:
                    reach = (rho ** (pos[1:] - 1) - rho ** (N - 1)) / (1 - rho ** (N - 1))
                assert np.abs(dec["reach"] - reach).max() < 1e-13
                assert np.abs(H[1:, 0] - reach * H[0, 0]).max() < 1e-13
    checks["ruin_closed_forms"] = 3
    # the checker CAN fail: a non-harmonic bump outside the core is caught ...
    Q, Rf, Rd = _ruin(8, 0.37)
    H, _ = _solve(Q, Rf)
    bump = H[:, 0].copy()
    bump[3] += 0.3
    try:
        _assert_maxima_in_core(local_maxima(Q, bump)[0], Rf[:, 0] > 0, "mutant")
    except NamingRefusal as exc:
        assert exc.code == "MAXIMUM_PRINCIPLE_VIOLATED"
    else:
        raise AssertionError("maximum-principle checker accepted an off-core peak")
    # ... and a genuine interior finish makes an interior CORE peak, which is legal.
    Q2 = Q.copy()
    Q2[3] *= 0.5
    Rf2 = np.hstack([Rf, np.zeros((7, 1))])
    Rf2[3, 2] = 0.5                       # a third class Z dealt ONLY at position 4
    H2, _ = _solve(Q2, Rf2)
    s2 = local_maxima(Q2, H2[:, 2])[0]
    assert list(s2) == [3] and float(H2[:, 2].max()) == float(H2[3, 2]), s2
    checks["maximum_principle_mutants"] = 2
    # 2. Proposition 3 with draws: shares are harmonic for the Doob-conditioned chain.
    Q, Rf, Rd = _ruin(8, 0.37, kill=0.1)
    H, _ = _solve(Q, Rf)
    d = H.sum(axis=1)
    assert d.max() < 1 - 1e-3
    for col in (0, 1):
        resid, rows, n = doob_share_identity(Q, Rf[:, col], Rf.sum(axis=1), H[:, col], d)
        assert resid < 1e-14 and rows < 1e-14 and n == 7, (resid, rows)
        strict = local_maxima(Q, H[:, col] / d)[0]
        _assert_maxima_in_core(strict, Rf[:, col] > 0, "share")
    checks["doob_share_identity"] = 2
    # 3. territory thresholds, the ratio ceiling and the odds scale.
    sh = {"a": 0.9, "b": 0.5, "c": 0.2}
    assert territory(sh, 0.4, 2.0)["members"] == ["a"]
    assert territory(sh, 0.4, 1.5)["members"] == ["a"]
    assert territory(sh, 0.4, 3.0)["status"] == "IMPOSSIBLE_THRESHOLD"
    assert territory({"a": 0.5}, 0.4, 2.0)["status"] == "EMPTY"
    assert territory(sh, 0.4, 3.0, "odds")["members"] == ["a"]           # cut 2/3
    assert math.isclose(threshold_share(3.0, 0.4, "odds"), 2 / 3)
    assert territory(sh, 0.1, 3.0)["members"] == ["a", "b"]
    assert math.isclose(enrichment(0.75, 0.5, "odds"), 3.0)
    checks["territory_cases"] = 8
    # 4. naming rules, including the tiny-class artefact the delta gate removes.
    cls = ("A", "B", "C")
    base = (0.46, 0.066, 0.001)
    assert name_rule((0.5, 0.45, 0.05), base, cls, delta=0.0) == "C"          # literal rule
    assert name_rule((0.5, 0.45, 0.05), base, cls) == "B"                     # gated
    assert name_rule((0.5, 0.45, 0.05), base, cls, choose="kl") == "B"
    assert name_rule((0.5, 0.45, 0.05), base, cls, choose="excess") == "B"
    assert name_rule((0.80, 0.19, 0.01), base, cls) == "B"
    assert name_rule(base, base, cls) is None
    assert name_rule((0.93, 0.069, 0.001), base, cls) == "A"                  # 0.93 >= 2 x 0.46
    checks["name_rule_cases"] = 7
    # 5. seat bookkeeping on a hand table: TOP + BOTTOM = pooled, known values.
    rows = np.array([[.40, .10, .20, .00],    # (top, my turn):   I am top
                     [.20, .20, .10, .10],    # (top, their turn)
                     [.00, .30, .30, .10],    # (bottom, my turn): I am bottom
                     [.10, .40, .00, .20]])   # (bottom, their turn)
    top, bottom = seat_split(rows)
    assert np.allclose(top, [0.25 * (.40 + .20 + .30 + .40), 0.25 * (.20 + .10 + .10 + .20)])
    assert np.allclose(bottom, [0.25 * (.10 + .20 + .00 + .10), 0.25 * (.00 + .10 + .30 + .00)])
    assert np.allclose(top + bottom, 0.25 * (rows[:, 0::2] + rows[:, 1::2]).sum(axis=0))
    checks["seat_split_cases"] = 3
    # 6. the clocked recursion: without 0-ply cells it is sum_{k<H} Q^k R; with them it equals
    #    an explicit per-state recursion over (state, plies left).
    Q, Rf, Rd = _ruin(8, 0.37, kill=0.05)
    for Hh in (1, 3, 9):
        ref = sum(np.linalg.matrix_power(Q, k) @ Rf for k in range(Hh))
        assert np.abs(clocked_masses(np.zeros_like(Q), Q, Rf, Hh) - ref).max() < 1e-14
    # toy with MY/THEIR turns: states a_M, b_M, a_T, b_T; a_M -> a_T costs 0 plies.
    Q1 = np.array([[0, .2, 0, .1], [.1, 0, .2, .1], [.3, 0, 0, .2], [0, .2, .3, 0]], float)
    Q0 = np.zeros((4, 4))
    Q0[0, 2] = .3
    R = np.array([[.3, .1], [.4, .2], [.3, .2], [.4, .1]])
    assert np.allclose((Q0 + Q1).sum(1) + R.sum(1), 1)
    memo = {}

    def v(t, h):
        if h == 0:
            return np.zeros(2)
        if (t, h) not in memo:
            memo[t, h] = R[t] + sum(Q1[t, j] * v(j, h - 1) for j in range(4) if Q1[t, j] > 0) \
                + sum(Q0[t, j] * v(j, h) for j in range(4) if Q0[t, j] > 0)
        return memo[t, h]
    for Hh in (1, 2, 5, 12):
        explicit = np.array([v(t, Hh) for t in range(4)])
        assert np.abs(clocked_masses(Q0, Q1, R, Hh) - explicit).max() < 1e-14
    checks["clocked_cases"] = 7
    # 7. the cell sampler reproduces a known exit law (and so can check a real one).
    Q, Rf, Rd = _ruin(8, 0.37, kill=0.1)
    H, _ = _solve(Q, Rf)
    start = np.full(7, 1 / 7)
    absk, finc, cens, _st = sample_rolls(*_cells_of(Q, Rf, Rd), 7, start, 100_000, 11)
    assert cens == 0
    worst = 0.0
    for col, k in ((0, 0), (1, 1)):
        p = float(start @ H[:, col])
        f = float(np.mean(finc == col))
        worst = max(worst, abs(f - p) / math.sqrt(p * (1 - p) / 100_000))
    pd = float(1 - start @ H.sum(axis=1))
    fd = float(np.mean(absk == 2))
    worst = max(worst, abs(fd - pd) / math.sqrt(pd * (1 - pd) / 100_000))
    assert worst < 4, worst
    checks["sampler_max_abs_z"] = round(worst, 3)
    # 8. robustness fractions never divide by zero and treat 'unnamed' as a claim.
    assert holds_fraction(None, [None, "LEG", None, None]) == 0.75
    try:
        holds_fraction("LEG", [])
    except NamingRefusal as exc:
        assert exc.code == "ZERO_SAMPLES"
    else:
        raise AssertionError("empty robustness ensemble accepted")
    checks["robustness_cases"] = 2
    print("naming N2R selfcheck: " + json.dumps(checks, sort_keys=True))
    return checks


def n3_selfcheck() -> dict:
    """Proposition 5 on seeded random instances, then the refine-only seat rule on known cases."""
    rng = np.random.default_rng(5)
    premise = {"a": 0, "b": 0, "c": 0}
    n = 0
    for _ in range(20_000):
        b = float(rng.uniform(0.001, 0.6))
        st, sb = rng.dirichlet([1, 1, 1])[:2]
        beta = b / 2
        for theta in (1.5, 2.0, 3.0):
            for delta in (0.02, 0.05):
                n += 1
                pt = st / beta >= theta and st - beta >= delta
                pb = sb / beta >= theta and sb - beta >= delta
                pooled_e, pooled_x = (st + sb) / b, st + sb - b
                if pt and pb:
                    premise["a"] += 1
                    assert pooled_e >= theta - 1e-12 and pooled_x >= 2 * delta - 1e-12
                if pooled_e >= theta:
                    premise["b"] += 1
                    assert max(st, sb) / beta >= theta - 1e-12
                if pooled_x >= 2 * delta:
                    premise["c"] += 1
                    assert max(st, sb) - beta >= delta - 1e-12
        assert 1 / beta <= 2 / b + 1e-9
    assert min(premise.values()) > 100, premise          # every implication actually exercised
    cls = ("A", "B")
    beta = np.array([0.2, 0.03])
    # pooled name kept, qualified by the seats that pass for THAT class
    assert seat_aware_name("B", [.10, .20], [.10, .20], beta, beta, cls) == ("B", "BOTH")
    assert seat_aware_name("B", [.10, .20], [.10, .01], beta, beta, cls) == ("B", "TOP")
    assert seat_aware_name("B", [.10, .07], [.10, .07], beta, beta, cls) == ("B", "SHARED")
    # an unnamed start law gains a one-seat name; a seat below the materiality gate does not
    assert seat_aware_name(None, [.45, .01], [.10, .01], beta, beta, cls) == ("A", "TOP")
    assert seat_aware_name(None, [.10, .09], [.10, .01], beta, beta, cls) == ("B", "TOP")
    assert seat_aware_name(None, [.10, .065], [.10, .01], beta, beta, cls) == (None, None)
    # Prop. 5a is a THEOREM for beta = b/2: a caller claiming "pooled unnamed" while both seats pass is refused
    try:
        seat_aware_name(None, [.45, .01], [.45, .01], beta, beta, cls)
    except NamingRefusal as exc:
        assert exc.code == "PROPOSITION_5A_VIOLATED"
    else:
        raise AssertionError("contradictory seat/pooled input accepted")
    assert n3_label(("B", "TOP")) == "B|TOP" and n3_label((None, None)) is None
    out = {"prop5_instances": n, "prop5_premises_exercised": premise, "seat_rule_cases": 8}
    print("naming N3 selfcheck: " + json.dumps(out, sort_keys=True))
    return out


# --------------------------------------------------------------------------- #
# the real kernel
# --------------------------------------------------------------------------- #
def _import_semantics(name):
    sys.dont_write_bytecode = True
    here = str(ROOT / "scripts" / "semantics")
    if here not in sys.path:
        sys.path.insert(0, here)
    return __import__(name)


def load_lexicon():
    path = ROOT / "tests/artifacts/semantics/vocabulary.json"
    raw = path.read_bytes()
    voc = json.loads(raw)
    n = sum(1 for t in voc["techniques"].values() if "body_region" in t)
    _need(n >= 280, "LEXICON_COVERAGE_FLOOR", f"{n} classified submission attackers < 280")
    return voc, hashlib.sha256(raw).hexdigest()


def class_grouping(K, voc, classes):
    """Finisher column -> (class, performer), joined on the finishing technique's HUB ID
    ('<hub>/attacker' in the lexicon), never on a column index. Every column must join."""
    meta = K.fin_meta()
    G = np.zeros((K.n_fin, 2 * len(classes)))
    unjoined, not_submission = [], []
    for c, m in enumerate(meta):
        _need((m["technique"], m["performer"]) == tuple(K.fin_cols[c]), "FIN_META_ORDER", str(c))
        rec = voc["techniques"].get(m["technique"] + "/attacker")
        if not m["isSubmissionNode"]:
            not_submission.append(m["technique"])
        if rec is None or "body_region" not in rec:
            unjoined.append(m["technique"])
            continue
        G[c, 2 * classes.index(rec["body_region"]["class"]) + PERFORMERS.index(m["performer"])] = 1.0
    _need(K.n_fin > 0 and not unjoined and not not_submission, "FINISHER_JOIN",
          f"{K.n_fin} columns, unjoined {sorted(set(unjoined))[:10]}, non-submission {sorted(set(not_submission))[:10]}")
    return G, {"finisher_columns": int(K.n_fin), "joined_by_hub_id": int(K.n_fin),
               "distinct_finishing_techniques": len({m["technique"] for m in meta})}


def perturbed_view(K, eps, seed):
    """K with (Q, R, R_fin) replaced by K.perturbed(eps, eps, seed): the kernel's OWN exit_law /
    qprocess run on the perturbed numbers. Q0/Q1 are poisoned so no stale clocked call slips by."""
    import copy
    P = K.perturbed(eps, eps, seed)
    Kp = copy.copy(K)
    Kp.Q, Kp.R, Kp.R_fin = P["Q"], P["R"], P["R_fin"]
    Kp._lu = None
    Kp.Q0 = Kp.Q1 = None
    return Kp


def hub_states(K, hub):
    """The 4 transient states of a hub in seat_split's order: (top,M), (top,T), (bottom,M), (bottom,T)."""
    top, bot = K.index[f"{hub}/top"], K.index[f"{hub}/bottom"]
    return np.array([top, K.n_r + top, bot, K.n_r + bot])


def exit_profile(K, G, classes, *, with_mu=True):
    """Everything one kernel (or perturbed view) says about how rolls end, grouped by class."""
    Bf, res = K.exit_law()
    _need(res < 1e-10, "EXIT_LAW_RESIDUAL", str(res))
    H12 = Bf @ G
    Hc = H12[:, 0::2] + H12[:, 1::2]
    d = Hc.sum(axis=1)
    reach = set(K.reachable)
    U = [h for h in K.hubs if f"{h}/top" in reach and f"{h}/bottom" in reach]
    partial = [h for h in K.hubs if (f"{h}/top" in reach) != (f"{h}/bottom" in reach)]
    out = {"H12": H12, "Hc": Hc, "d": d, "U": U, "partial": partial, "exit_residual": res,
           "starts": {"standing_me": K.start("standing", "me"), "standing_coin": K.start("standing", "coin")}}
    if with_mu:
        qp = K.qprocess()
        mu = np.zeros(K.n_t)
        mu[qp["idx"]] = qp["mu"]
        psi = np.zeros(K.n_t)
        psi[qp["idx"]] = qp["psi"]
        out["starts"]["mu"] = mu
        out.update({"qp": qp, "psi": psi})
    out["baseline"] = {k: (v @ Hc) / (v @ d) for k, v in out["starts"].items()}
    shares, dec, mu_mass, seats = {}, {}, {}, {}
    for h in U:
        st = hub_states(K, h)
        dd = d[st].mean()
        _need(dd > 0, "HUB_NEVER_DECIDED", h)
        shares[h] = Hc[st].mean(axis=0) / dd
        dec[h] = dd
        top, bottom = seat_split(H12[st])
        seats[h] = (top / dd, bottom / dd)
        if with_mu:
            mu_mass[h] = float(out["starts"]["mu"][st].sum())
    out.update({"shares": shares, "decided": dec, "mu_mass": mu_mass, "seats": seats})
    return out


def names_for(prof, classes, variant="primary"):
    theta, delta, scale, choose, base = NAME_VARIANTS[variant]
    b = prof["baseline"][base]
    return {h: name_rule(s, b, classes, theta=theta, delta=delta, scale=scale, choose=choose)
            for h, s in prof["shares"].items()}


def seat_baselines(prof, kind="per_player"):
    b = prof["baseline"]["standing_me"]
    if kind == "per_player":
        return b / 2, b / 2
    if kind == "mu_per_player":
        return prof["baseline"]["mu"] / 2, prof["baseline"]["mu"] / 2
    _need(kind == "standing_seat" and "standing-position" in prof["seats"], "UNKNOWN_SEAT_BASELINE", kind)
    return prof["seats"]["standing-position"]


def names_n3_for(prof, classes, pooled, kind="per_player"):
    bt, bb = seat_baselines(prof, kind)
    return {h: seat_aware_name(pooled[h], *prof["seats"][h], bt, bb, classes, strict=kind == "per_player")
            for h in prof["U"]}


def seat_territories_for(prof, classes, kind="per_player", thetas=N2R_THETAS):
    """R^sigma_C(theta) = universe hubs whose seat-sigma class-C share is >= theta x beta^sigma_C."""
    bt, bb = seat_baselines(prof, kind)
    out = {}
    for i, c in enumerate(classes):
        out[c] = {}
        for si, (seat, beta) in enumerate((("TOP", bt), ("BOTTOM", bb))):
            sh = {h: float(v[si][i]) for h, v in prof["seats"].items() if h in set(prof["U"])}
            out[c][seat] = {th: territory(sh, float(beta[i]), th) for th in thetas}
    return out


def region_seat_name(K, prof, members, classes, pooled_name):
    """Seat-aware name of a REGION (uniform start over its hubs): the same refine-only rule."""
    _X, nu = start_share(K, prof, members)
    dec = float(nu @ prof["d"])
    top = sum(seat_split(prof["H12"][hub_states(K, h)])[0] for h in members) / len(members) / dec
    bot = sum(seat_split(prof["H12"][hub_states(K, h)])[1] for h in members) / len(members) / dec
    bt, bb = seat_baselines(prof)
    return seat_aware_name(pooled_name, top, bot, bt, bb, classes)


def territories_for(prof, classes, baseline="standing_me", scale="ratio", thetas=N2R_THETAS):
    out = {}
    for i, c in enumerate(classes):
        sh = {h: float(s[i]) for h, s in prof["shares"].items()}
        out[c] = {theta: territory(sh, float(prof["baseline"][baseline][i]), theta, scale) for theta in thetas}
    return out


def start_share(K, prof, hubs, weights="uniform"):
    """Class share of the rolls that end, from a start spread over `hubs` (uniform over their
    4 states each, or mu restricted to those states)."""
    nu = np.zeros(K.n_t)
    for h in hubs:
        st = hub_states(K, h)
        if weights == "uniform":
            nu[st] += 1.0
        else:
            nu[st] += prof["starts"]["mu"][st]
    _need(nu.sum() > 0, "EMPTY_START", str(hubs[:5]))
    nu /= nu.sum()
    return (nu @ prof["Hc"]) / (nu @ prof["d"]), nu


def _max_principle(K, prof, G, classes, tag):
    """Propositions 1-3 on every class (pooled) and every class x performer, on ALL transient
    states; plus the peaks (strict local maxima) that are reachable."""
    Rg12 = np.asarray(K.R_fin @ G)
    Rc = Rg12[:, 0::2] + Rg12[:, 1::2]
    Rdec = Rc.sum(axis=1)
    rows_q = np.asarray(K.Q.sum(axis=1)).ravel()
    out = {}
    funcs = [(c, Rc[:, i], prof["Hc"][:, i]) for i, c in enumerate(classes)]
    funcs += [(f"{c}|{p}", Rg12[:, 2 * i + j], prof["H12"][:, 2 * i + j])
              for i, c in enumerate(classes) for j, p in enumerate(PERFORMERS)]
    for label, r, h in funcs:
        core = r > 0
        if not core.any():
            out[label] = {"core_states": 0, "status": "EMPTY_CORE"}
            continue
        strict, weak, m = local_maxima(K.Q, h)
        _assert_maxima_in_core(strict, core, f"{tag} {label}")
        # a WEAK maximum outside the core must be a plateau with no exit at all (Prop. 1's
        # equality case): row fully transient and every successor equal
        weak_halo = [int(t) for t in weak if not core[t]]
        for t in weak_halo:
            lo, hi = K.Q.indptr[t], K.Q.indptr[t + 1]
            js = K.Q.indices[lo:hi]
            _need(abs(rows_q[t] - 1) < 1e-9 and np.abs(h[js] - h[t]).max() < 1e-9,
                  "WEAK_MAXIMUM_NOT_A_PLATEAU", f"{tag} {label} t={t}")
        dec = halo_decomposition(K.Q, h, core)
        _need(dec["recon_residual"] < 1e-9 and dec["bound_violation"] < 1e-12, "HALO_DECOMPOSITION",
              f"{tag} {label}: residual {dec['recon_residual']}, bound {dec['bound_violation']}")
        d = prof["d"]
        ds = local_maxima(K.Q, np.where(d > TOL, h / np.where(d > TOL, d, 1.0), 0.0),
                          rows=d > TOL, col_mask=d > TOL)[0]
        _assert_maxima_in_core(ds, core, f"{tag} {label} (share)")
        resid, rowdev, nrows = doob_share_identity(K.Q, r, Rdec, h, d)
        _need(resid < 1e-9 and rowdev < 1e-9, "DOOB_IDENTITY", f"{tag} {label}: {resid}, {rowdev}")
        rec = {"core_states": int(core.sum()), "core_states_reachable": int((core & K.reach_t).sum()),
               "strict_maxima": int(len(strict)), "strict_maxima_outside_core": 0,
               "share_strict_maxima_outside_core": 0, "weak_maxima_in_halo_plateaus": len(weak_halo),
               "halo_states": dec["halo_states"], "halo_recon_residual": dec["recon_residual"],
               "halo_bound_violation": dec["bound_violation"], "max_on_core": dec["max_on_core"],
               "max_on_halo": dec["max_on_halo"], "doob_identity_residual": resid,
               "doob_rows_examined": nrows}
        if "|" not in label:
            rec["peaks_reachable"] = sorted(f"{K.labels[t][0]}@{K.labels[t][1]}" for t in strict if K.reach_t[t])
            rec["core_hubs"] = sorted({K.hub_of[t % K.n_r] for t in np.flatnonzero(core)})
            halo_reach = np.zeros(K.n_t)
            halo_reach[dec["halo_index"]] = dec["reach"]
            rec["_reach"] = halo_reach          # P_t(reach core), dropped before writing
        out[label] = rec
    return out


def _system_themes(voc, graph, classes, vocabulary):
    """Theme of each System from STRUCTURED fields only: the lexicon class of each submission
    member — a direct submission attacker's class, or a submission family hub's own
    type + targetArea through the same lexicon. Theme C = strict majority of >= 2 classified
    submission members. No system name is read (counted: 0)."""
    themes, rows, unmapped = {}, {}, []
    for key, s in sorted(voc["systems"].items()):
        cls = []
        for t in voc["label_sets"]["techniques"][f"system:{key}"]["nodes"]:
            rec = voc["techniques"][t]
            if rec["kind"] == "submission":
                cls.append(rec["body_region"]["class"])
        for fam in s["joined_sets"]["family_hubs"]:
            node = graph["submissions"].get(fam) or graph["transitions"].get(fam)
            if node is None or node.get("type") is None:
                unmapped.append((key, fam, "NO_STRUCTURED_TYPE"))
                continue
            try:
                cls.append(vocabulary.classify(node)["class"])
            except ValueError:
                unmapped.append((key, fam, node.get("type")))
        count = {c: cls.count(c) for c in classes if c in cls}
        theme = None
        if len(cls) >= 2:
            best = max(sorted(count), key=lambda c: count[c])
            if count[best] * 2 > len(cls):
                theme = best
        rows[key] = {"classified_submission_members": len(cls), "class_counts": count, "theme": theme}
        if theme:
            themes.setdefault(theme, []).append(key)
    return themes, rows, unmapped


def _labels_for(voc, prof, frame, classes, core_hubs, themes):
    """Every label set, restricted EXPLICITLY to the universe U; what the restriction dropped is
    counted, and label sets left empty are dropped from the family and counted."""
    U = set(prof["U"])
    hubs = voc["label_sets"]["hubs"]
    labels, meta, dropped_empty = {}, {}, []

    def add(name, nodes, kind, evidence):
        full = set(nodes)
        kept = sorted(full & U)
        meta[name] = {"kind": kind, "evidence": evidence, "authored_size": len(full), "in_universe": len(kept)}
        if kept:
            labels[name] = kept
        else:
            dropped_empty.append(name)

    for c in classes:
        add(f"origin:{c}", hubs[f"submission-origin:{c}"]["nodes"], "canonical-origin (PRIMARY)", "structured")
        add(f"listing:{c}", hubs[f"listed-positive-submission:{frame}:{c}"]["nodes"], "positive-listing (sensitivity)", "structured")
        add(f"core:{c}", core_hubs[c], "kernel-dealt core (not corpus vocabulary)", "kernel")
        members = sorted({h for key in themes.get(c, []) for h in hubs[f"system:{key}"]["nodes"]})
        add(f"system-theme:{c}", members, "union of systems themed by structured class majority", "structured")
    for key in sorted({k for ks in themes.values() for k in ks}):
        add(f"system:{key}", hubs[f"system:{key}"]["nodes"], "one class-themed system", "structured")
    for name in sorted(k for k in hubs if k.startswith("position-family:")):
        add(name, hubs[name]["nodes"], "position family (familyHub)", "structured")
    for name in sorted(k for k in hubs if k.startswith("name-token:")):
        add(name, hubs[name]["nodes"], "name token", "name-derived")
    return labels, meta, dropped_empty


def _fit(prof, regions, labels):
    U = sorted(prof["U"])
    weights = {h: prof["mu_mass"][h] for h in U}
    regions = {k: v for k, v in regions.items()}
    return score_pairs(U, regions, labels, weights)


def _fit_summary(run, label_meta, classes, full=True):
    """Per region: every structural row for its own class, the best row per label kind, top
    name tokens — the full table goes to --full-out."""
    by_region = {}
    for row in run["scores"]:
        by_region.setdefault(row["region"], []).append(row)

    def slim(row):
        if row["status"] != "ok":
            return {"label": row["label"], "status": row["status"], "refusal": row.get("refusal")}
        w = row.get("weighted", {})
        return {"label": row["label"], "evidence": label_meta[row["label"]]["evidence"],
                "n_region": row["counts"]["region"], "n_label": row["counts"]["label"],
                "n_both": row["counts"]["intersection"], "precision": _r(row["precision"], 4),
                "recall": _r(row["recall"], 4), "f1": _r(row["f1"], 4), "lift": _r(row["lift"], 4),
                "p": _g(row["p_hypergeom_upper"]), "q_bh": _g(row["q_bh"]), "bh_reject": row["bh_reject"],
                "mu_precision": _r(w["precision"], 4) if w.get("status") == "ok" else None,
                "mu_recall": _r(w["recall"], 4) if w.get("status") == "ok" else None,
                "mu_f1": _r(w["f1"], 4) if w.get("status") == "ok" else None}
    out = {}
    for region, rows in sorted(by_region.items()):
        cls = region.split(":")[1] if ":" in region else None
        own = [slim(r) for r in rows if cls and r["label"] in
               (f"origin:{cls}", f"listing:{cls}", f"core:{cls}", f"system-theme:{cls}")]
        ok = [r for r in rows if r["status"] == "ok"]
        best = {}
        for prefix in ("origin:", "listing:", "system:", "position-family:", "name-token:"):
            cand = [r for r in ok if r["label"].startswith(prefix)]
            if cand:
                top = max(cand, key=lambda r: (r["f1"], -r["p_hypergeom_upper"], r["label"]))
                best[prefix.rstrip(":")] = slim(top)
        tokens = sorted((r for r in ok if r["label"].startswith("name-token:") and r["bh_reject"]),
                        key=lambda r: (-r["f1"], r["p_hypergeom_upper"], r["label"]))[:5]
        out[region] = {"own_class_labels": own}
        if full:
            out[region].update({"best_by_kind": best, "bh_significant_name_tokens_top5": [slim(r) for r in tokens]})
    return out


def region_name(K, prof, members, classes, variant="primary"):
    """The best name of a REGION: the name rule applied to the start law spread uniformly over the
    region's hubs (seats and turns), against the configuration's own baseline."""
    theta, delta, scale, choose, base = NAME_VARIANTS[variant]
    s, _nu = start_share(K, prof, members)
    return name_rule(s, prof["baseline"][base], classes, theta=theta, delta=delta, scale=scale, choose=choose), s


def _robustness(K, G, classes, prof, base_names, base_terr, seeds, eps, fixed_sets=None):
    """The shared perturbation ensemble (ruling 1) on ONE kernel: per-hub name persistence,
    per-territory member persistence and Jaccard, the headline share on the FIXED set, and the
    name of each fixed derived region (gs-3's exit-TV territories) with its member set held fixed."""
    fixed_sets = fixed_sets or {}
    fixed_ref = {k: region_name(K, prof, m, classes)[0] for k, m in fixed_sets.items()}
    fixed_ref_n3 = {k: region_seat_name(K, prof, m, classes, fixed_ref[k]) for k, m in fixed_sets.items()}
    fixed_hits_n3 = {k: 0 for k in fixed_sets}
    base_n3 = names_n3_for(prof, classes, base_names)
    n3_hits = {h: 0 for h in prof["U"]}
    fixed_hits = {k: 0 for k in fixed_sets}
    fixed_shares = {k: [] for k in fixed_sets}
    U = prof["U"]
    name_hits = {h: 0 for h in U}
    member_hits = {c: {th: {} for th in N2R_THETAS} for c in classes}
    jacc = {c: {th: [] for th in N2R_THETAS} for c in classes}
    headline = {c: {th: [] for th in N2R_THETAS} for c in classes}
    base_mu_terr = territories_for(prof, classes, "mu")
    mu_jacc = {c: {th: [] for th in N2R_THETAS} for c in classes}
    baselines = []
    n = 0
    for seed in range(seeds):
        Kp = perturbed_view(K, eps, seed)
        pp = exit_profile(Kp, G, classes)
        _need(pp["U"] == U, "PERTURBATION_CHANGED_REACH", str(seed))
        n += 1
        baselines.append(pp["baseline"]["standing_me"])
        names = names_for(pp, classes)
        n3 = names_n3_for(pp, classes, names)
        for h in U:
            name_hits[h] += names[h] == base_names[h]
            n3_hits[h] += n3[h] == base_n3[h]
        terr = territories_for(pp, classes)
        mterr = territories_for(pp, classes, "mu")
        for i, c in enumerate(classes):
            for th in N2R_THETAS:
                mem, ref = set(terr[c][th]["members"]), set(base_terr[c][th]["members"])
                for h in mem:
                    member_hits[c][th][h] = member_hits[c][th].get(h, 0) + 1
                if mem | ref:
                    jacc[c][th].append(len(mem & ref) / len(mem | ref))
                mm, mr = set(mterr[c][th]["members"]), set(base_mu_terr[c][th]["members"])
                if mm | mr:
                    mu_jacc[c][th].append(len(mm & mr) / len(mm | mr))
                if ref:
                    headline[c][th].append(float(start_share(Kp, pp, sorted(ref))[0][i]))
        for k, m in fixed_sets.items():
            nm, sh = region_name(Kp, pp, m, classes)
            fixed_hits[k] += nm == fixed_ref[k]
            fixed_hits_n3[k] += region_seat_name(Kp, pp, m, classes, nm) == fixed_ref_n3[k]
            fixed_shares[k].append(sh)
    _need(n == seeds and n > 0, "ROBUSTNESS_COVERAGE", f"{n} of {seeds} perturbed kernels evaluated")
    return {"n": n, "name_hits": name_hits, "member_hits": member_hits, "jaccard": jacc,
            "mu_jaccard": mu_jacc, "headline": headline, "baselines": np.array(baselines),
            "fixed_ref": fixed_ref, "fixed_hits": fixed_hits, "fixed_shares": fixed_shares,
            "n3_hits": n3_hits, "base_n3": base_n3, "fixed_ref_n3": fixed_ref_n3, "fixed_hits_n3": fixed_hits_n3}


def _quantiles(xs):
    if not xs:
        return None
    a = np.sort(np.asarray(xs, float))
    return {"min": _r(a[0], 4), "q05": _r(np.quantile(a, .05), 4), "median": _r(np.median(a), 4),
            "q95": _r(np.quantile(a, .95), 4), "max": _r(a[-1], 4), "n": int(len(a))}


def _mc_check(K, prof, G, classes, voc, rolls, seed):
    """Seeded rolls on the kernel's own cells, finisher mapped to its class BY ID; compared
    with the exact shares from two starts."""
    c = K.cells
    tech_class = {}
    for k, (tid, perf) in enumerate(K.fin_cols):
        tech_class[k] = (voc["techniques"][tid + "/attacker"]["body_region"]["class"], perf)
    out = {}
    starts = {"standing_me": prof["starts"]["standing_me"]}
    leg = territories_for(prof, classes)[classes[0]][2.0]["members"]
    if leg:
        starts[f"R_{classes[0]}(2) uniform"] = start_share(K, prof, leg)[1]
    worst = 0.0
    for si, (name, nu) in enumerate(sorted(starts.items())):
        absk, finc, cens, steps = sample_rolls(c["src"], c["mass"], c["dst"], c["fin"], K.n_t, nu, rolls, seed + si)
        _need(cens == 0, "MC_CENSORED", f"{cens} rolls never absorbed")
        exact = (nu @ prof["H12"])
        rows = {}
        for i, cl in enumerate(classes):
            for j, perf in enumerate(PERFORMERS):
                p = float(exact[2 * i + j])
                f = float(np.isin(finc, [k for k, v in tech_class.items() if v == (cl, perf)]).mean())
                z = 0.0 if p in (0.0, 1.0) else (f - p) / math.sqrt(p * (1 - p) / rolls)
                if p in (0.0, 1.0):
                    _need(f == p, "MC_DEGENERATE_MISMATCH", f"{name} {cl} {perf}")
                worst = max(worst, abs(z))
                rows[f"{cl}|{perf}"] = {"exact": _r(p), "mc": _r(f), "z": _r(z, 3)}
        out[name] = {"rolls": rolls, "censored": cens, "mean_steps": _r(steps.mean(), 3), "cells": rows,
                     "draws_mc": _r(np.mean(absk == 2)), "draws_exact": _r(1 - nu @ prof["d"])}
    return out, worst


GEOMETRY_CASE = {"primary": "nogi/symmetric/shipped", "other_rule": "nogi/shipped/shipped",
                 "other_frame": "gi/symmetric/shipped", "origin_false": "nogi/symmetric/shipped/origin=False",
                 "gi_shipped": "gi/shipped/shipped", "gi_frame_rates": "gi/symmetric/frame"}


def load_tv_regions(profs):
    """gs-3's accepted exit-TV k-medoids territories (gs-shared.md §8), read-only from
    tests/artifacts/semantics/geometry.json -> cases[case].clusterings.exit_tv.clusters, keyed
    'tv:<medoid>'. Joined on hub ids; each case's cluster union must EQUAL this lane's universe
    for the same configuration (a mismatch is reported, never silently intersected)."""
    path = ROOT / "tests/artifacts/semantics/geometry.json"
    if not path.exists():
        return None, None, {"status": "ABSENT", "path": str(path.relative_to(ROOT))}
    raw = path.read_bytes()
    geo = json.loads(raw)
    # STALENESS FIRST, so the refusal names the CAUSE. Until v1.209.2 this file was read without the
    # graph-hash check every other input gets, so a geometry.json computed on an older graph.json
    # surfaced only as the universe comparison below failing: on the v1.209.0 graph,
    # `TV_UNIVERSE_MISMATCH: origin_false: theirs-only ['double-sleeve-guard', 'spider-guard']`, a
    # downstream symptom of an upstream artifact one content change old (docs/GraphSemantics.md §11
    # runs geometry, row 10, before naming, row 15).
    check_graph_inputs({"tests/artifacts/semantics/geometry.json": geo})
    regions, audit = {}, {"status": "ok", "sha256": hashlib.sha256(raw).hexdigest(),
                          "source": "tests/artifacts/semantics/geometry.json cases[case].clusterings.exit_tv", "cases": {}}
    for tag, case in GEOMETRY_CASE.items():
        cl = geo["cases"][case]["clusterings"]["exit_tv"]
        clusters = {f"tv:{c['medoid']}": sorted(c["hubs"]) for c in cl["clusters"]}
        _need(len(clusters) == len(cl["clusters"]) == cl["selected_k"], "TV_CLUSTER_KEYS", case)
        union = [h for m in clusters.values() for h in m]
        _need(len(union) == len(set(union)), "TV_CLUSTERS_OVERLAP", case)
        mine = set(profs[tag]["U"])
        audit["cases"][tag] = {"case": case, "k": cl["selected_k"], "silhouette": cl["silhouette"],
                               "hubs": len(union), "universe_equal": set(union) == mine,
                               "only_theirs": sorted(set(union) - mine), "only_mine": sorted(mine - set(union)),
                               "sizes": {k: len(v) for k, v in clusters.items()}}
        _need(set(union) == mine, "TV_UNIVERSE_MISMATCH",
              f"{tag}: theirs-only {sorted(set(union) - mine)[:5]}, mine-only {sorted(mine - set(union))[:5]}")
        regions[tag] = clusters
    return regions, geo, audit


def run_territories(seeds=ROBUST_SEEDS, eps=ROBUST_EPS, mc_rolls=MC_ROLLS, full_out=None, selfcheck_result=None):
    kernel = _import_semantics("_kernel")
    vocabulary = _import_semantics("vocabulary")
    classes = tuple(vocabulary.CLASSES)
    voc, voc_sha = load_lexicon()
    base = kernel.load_kernel()
    graph = base.graph
    kernels, profs, groups, joins = {}, {}, {}, {}
    for tag, frame, ini, rates, origin in CONFIGS:
        K = kernel.load_kernel(frame=frame, initiative=ini, rates=rates, graph=graph, origin=origin)
        G, join = class_grouping(K, voc, classes)
        kernels[tag], groups[tag], joins[tag] = K, G, join
        profs[tag] = exit_profile(K, G, classes)
        print(f"[{tag}] {frame}/{ini}/rates={rates}/origin={origin}: finisher columns joined "
              f"{join['joined_by_hub_id']}/{join['finisher_columns']}; universe {len(profs[tag]['U'])} hubs "
              f"(both role-nodes reachable), partial {len(profs[tag]['partial'])}, of {len(K.hubs)}")
    checks = {}
    # --- identities and independent routes, every configuration
    for tag, K in kernels.items():
        pr, G = profs[tag], groups[tag]
        Rg12 = np.asarray(K.R_fin @ G)
        route2 = K.fundamental().solve(Rg12)
        B, _ = K.absorption()
        me = G[:, 0::2].sum(axis=1) > 0
        chk = {"grouped_rhs_vs_grouped_columns": float(np.abs(route2 - pr["H12"]).max()),
               "decided_vs_absorption": float(np.abs(pr["d"] - (B[:, 0] + B[:, 1])).max()),
               "rfin_grouping_mass": float(np.abs(Rg12.sum(1) - np.asarray(K.R_fin.sum(1)).ravel()).max())}
        worst = 0.0
        for Hh in (1, 5, 11):
            cm = clocked_masses(K.Q0, K.Q1, Rg12, Hh)
            vw, vl = K.finite_horizon(Hh)
            worst = max(worst, np.abs(cm[:, 0::2].sum(1) - vw).max(), np.abs(cm[:, 1::2].sum(1) - vl).max())
        chk["clocked_vs_kernel_finite_horizon"] = float(worst)
        chk["clocked_4000_vs_exit_law"] = float(np.abs(clocked_masses(K.Q0, K.Q1, Rg12, 4000) - pr["H12"]).max())
        psi, lam = pr["psi"], pr["qp"]["lam"]
        Rc = Rg12[:, 0::2] + Rg12[:, 1::2]
        chk["qsd_exit_identity"] = float(np.abs(psi @ pr["Hc"] - (psi @ Rc) / (1 - lam)).max())
        chk["reach_decided_min"] = float(pr["d"][K.reach_t].min())
        if K.initiative == "symmetric":
            chk["swap_standing_me_vs_coin"] = float(np.abs(pr["baseline"]["standing_me"] - pr["baseline"]["standing_coin"]).max())
            dev = 0.0
            for h in pr["U"]:
                for seat, role in ((0, "top"), (1, "bottom")):
                    r = K.index[f"{h}/{role}"]
                    nu = np.zeros(K.n_t)
                    nu[[r, K.n_r + r]] = 0.5
                    coin_me = (nu @ pr["H12"][:, 0::2]) / (nu @ pr["d"])
                    dev = max(dev, np.abs(pr["seats"][h][seat] - coin_me).max())
            chk["swap_hub_seat_vs_role_coin"] = float(dev)
        for key, bound in (("grouped_rhs_vs_grouped_columns", 1e-12), ("decided_vs_absorption", 1e-12),
                           ("rfin_grouping_mass", 1e-12), ("clocked_vs_kernel_finite_horizon", 1e-12),
                           ("clocked_4000_vs_exit_law", 1e-9), ("qsd_exit_identity", 1e-10),
                           ("swap_standing_me_vs_coin", 1e-12), ("swap_hub_seat_vs_role_coin", 1e-12)):
            if key in chk:
                _need(chk[key] < bound, "IDENTITY_FAILED", f"{tag} {key} = {chk[key]} >= {bound}")
        checks[tag] = {k: _g(v, 3) for k, v in chk.items()}
    # eps = 0 through the perturbation path reproduces the kernel exactly
    K, G, pr = kernels["primary"], groups["primary"], profs["primary"]
    z = exit_profile(perturbed_view(K, 0.0, 7), G, classes, with_mu=False)
    checks["primary"]["perturbed_eps0_vs_kernel"] = _g(np.abs(z["H12"] - pr["H12"]).max(), 3)
    _need(np.abs(z["H12"] - pr["H12"]).max() < 1e-12, "PERTURBATION_EPS0")
    # --- the maximum principle on every configuration
    mp = {tag: _max_principle(kernels[tag], profs[tag], groups[tag], classes, tag) for tag in kernels}
    n_funcs = sum(1 for tag in mp for rec in mp[tag].values() if rec.get("core_states"))
    _need(n_funcs >= len(CONFIGS) * len(classes) * 3 - 6, "MAX_PRINCIPLE_COVERAGE", str(n_funcs))
    print(f"maximum principle: {n_funcs} (configuration x class/performer) exit functions checked on all "
          f"transient states; 0 strict maxima outside the core; halo rebuilt from core in every one")
    # --- names and territories, every configuration
    names = {tag: {v: names_for(profs[tag], classes, v) for v in NAME_VARIANTS} for tag in kernels}
    terr = {tag: {(b, s): territories_for(profs[tag], classes, b, s) for b in BASELINES for s in SCALES}
            for tag in kernels}
    core_hubs = {tag: {c: sorted(set(mp[tag][c].get("core_hubs", [])) & set(profs[tag]["U"])) for c in classes}
                 for tag in kernels}
    # --- N3: seat-aware names (refine-only), every configuration; seat-baseline variants on the primary
    n3 = {tag: names_n3_for(profs[tag], classes, names[tag]["primary"]) for tag in kernels}
    n3_variants = {kind: names_n3_for(pr, classes, names["primary"]["primary"], kind) for kind in SEAT_BASELINES}
    seat_terr = {tag: seat_territories_for(profs[tag], classes) for tag in kernels}
    Rg12p = np.asarray(K.R_fin @ G)
    seat_core = {}
    for h in pr["U"]:
        top, bot = seat_split(Rg12p[hub_states(K, h)])
        seat_core[h] = {"TOP": [c for i, c in enumerate(classes) if top[i] > 0],
                        "BOTTOM": [c for i, c in enumerate(classes) if bot[i] > 0]}
    print("seat-aware names (N3, primary): " + json.dumps(
        {lab: sum(1 for v in n3["primary"].values() if n3_label(v) == lab)
         for lab in sorted({n3_label(v) for v in n3["primary"].values()} - {None})}, sort_keys=True)
        + f"; unnamed {sum(1 for v in n3['primary'].values() if v[0] is None)}")
    # --- gs-3's derived exit-TV territories (a second set of derived regions)
    tv, _geo, tv_audit = load_tv_regions(profs)
    if tv is not None:
        print("gs-3 exit-TV territories: " + ", ".join(
            f"{tag} k={a['k']} universe-equal={a['universe_equal']}" for tag, a in tv_audit["cases"].items()))
    # --- robustness (ruling 1), primary kernel
    print(f"robustness: {seeds} perturbed kernels (eps_attempt = eps_rate = {eps}, seeds 0..{seeds - 1}) ...")
    rob = _robustness(K, G, classes, pr, names["primary"]["primary"], terr["primary"][("standing_me", "ratio")], seeds, eps,
                      fixed_sets=(tv or {}).get("primary"))
    # --- Monte Carlo (independent route) on the primary kernel
    mc, mc_worst = _mc_check(K, pr, G, classes, voc, mc_rolls, MC_SEED)
    _need(mc_worst < 5, "MONTE_CARLO_DISAGREES", f"max |z| = {mc_worst}")
    print(f"monte carlo: {mc_rolls} rolls per start on the kernel's cells, max |z| {mc_worst:.2f} over "
          f"{len(classes) * 2} class x performer cells x {len(mc)} starts")
    # --- system themes and the set-level fit
    themes, theme_rows, unmapped = _system_themes(voc, graph, classes, vocabulary)
    fits, fit_meta = {}, {}
    for tag, frame, ini, rates, origin in CONFIGS:
        p = profs[tag]
        labels, lmeta, dropped = _labels_for(voc, p, frame, classes, core_hubs[tag], themes)
        regions = {}
        for c in classes:
            for th in N2R_THETAS:
                t = terr[tag][("standing_me", "ratio")][c][th]
                if t["status"] == "ok":
                    regions[f"R:{c}:{th}"] = t["members"]
            named = sorted(h for h, n in names[tag]["primary"].items() if n == c)
            if named:
                regions[f"named:{c}"] = named
        if tag != "primary":
            labels = {k: v for k, v in labels.items() if k.split(":")[0] in ("origin", "listing", "core", "system-theme")}
        run = _fit(p, regions, labels)
        fits[tag] = run
        fit_meta[tag] = {"labels": lmeta, "dropped_empty_in_universe": dropped, "regions": len(regions),
                         "labels_scored": len(labels), "bh_family_size": run["coverage"]["bh_family_size"]}
        if tag == "primary":
            odds_regions = {f"R_odds:{c}:{th}": terr[tag][("standing_me", "odds")][c][th]["members"]
                            for c in classes for th in N2R_THETAS
                            if terr[tag][("standing_me", "odds")][c][th]["status"] == "ok"}
            mu_regions = {f"R_mu:{c}:{th}": terr[tag][("mu", "ratio")][c][th]["members"]
                          for c in classes for th in N2R_THETAS
                          if terr[tag][("mu", "ratio")][c][th]["status"] == "ok"}
            fits["primary_odds"] = _fit(p, odds_regions, labels)
            fits["primary_mu"] = _fit(p, mu_regions, labels)
    # --- N3 seat set-fit: seat territories and seat-named sets vs SEAT-projected corpus labels
    p = profs["primary"]
    labels, lmeta, _dropped = _labels_for(voc, p, "nogi", classes, core_hubs["primary"], themes)
    U = set(p["U"])
    rn = voc["label_sets"]["role_nodes"]
    for c in classes:
        for seat, role in (("TOP", "top"), ("BOTTOM", "bottom")):
            for kind, key in (("origin", f"submission-origin:{c}"), ("listing", f"listed-positive-submission:nogi:{c}")):
                members = sorted(h for h in U if f"{h}/{role}" in set(rn[key]["nodes"]))
                if members:
                    labels[f"{kind}:{c}:{seat}"] = members
                    lmeta[f"{kind}:{c}:{seat}"] = {"kind": f"{kind} role-node on the {seat} seat", "evidence": "structured",
                                                   "authored_size": len(rn[key]["nodes"]), "in_universe": len(members)}
            members = sorted(h for h in U if c in seat_core[h][seat])
            if members:
                labels[f"core:{c}:{seat}"] = members
                lmeta[f"core:{c}:{seat}"] = {"kind": "kernel seat core (not corpus vocabulary)", "evidence": "kernel",
                                             "authored_size": len(members), "in_universe": len(members)}
    seat_regions = {}
    for c in classes:
        for seat in SEATS:
            for th in N2R_THETAS:
                t = seat_terr["primary"][c][seat][th]
                if t["status"] == "ok":
                    seat_regions[f"Rs:{c}:{seat}:{th}"] = t["members"]
    for lab in sorted({n3_label(v) for v in n3["primary"].values()} - {None}):
        seat_regions[f"n3:{lab}"] = sorted(h for h, v in n3["primary"].items() if n3_label(v) == lab)
    fits["primary_seat"] = _fit(p, seat_regions, labels)
    fit_meta["primary_seat"] = {"labels": lmeta, "dropped_empty_in_universe": _dropped, "regions": len(seat_regions),
                                "labels_scored": len(labels), "bh_family_size": fits["primary_seat"]["coverage"]["bh_family_size"]}
    if tv is not None:
        p = profs["primary"]
        labels, lmeta, _dropped = _labels_for(voc, p, "nogi", classes, core_hubs["primary"], themes)
        for c in classes:
            for th in N2R_THETAS:
                t = terr["primary"][("standing_me", "ratio")][c][th]
                if t["status"] == "ok":
                    labels[f"exit-share:{c}:{th}"] = t["members"]
                    lmeta[f"exit-share:{c}:{th}"] = {"kind": "this lane's derived territory R_C(theta)", "evidence": "kernel",
                                                     "authored_size": len(t["members"]), "in_universe": len(t["members"])}
        fits["primary_tv"] = _fit(p, tv["primary"], labels)
        fit_meta["primary_tv"] = {"labels": lmeta, "dropped_empty_in_universe": _dropped, "regions": len(tv["primary"]),
                                  "labels_scored": len(labels), "bh_family_size": fits["primary_tv"]["coverage"]["bh_family_size"]}
    print("set-level fit (exploratory, uniform-node hypergeometric + whole-family BH): " + ", ".join(
        f"{k} {v['coverage']['pairs_tested']} pairs" for k, v in fits.items()))
    result = _assemble(kernels, profs, groups, joins, checks, mp, names, terr, core_hubs, rob, mc, mc_worst, themes,
                       theme_rows, unmapped, fits, fit_meta, classes, voc_sha, seeds, eps, mc_rolls, selfcheck_result)
    result["tv_regions"] = _tv_section(kernels, profs, tv, tv_audit, terr, core_hubs, rob, fits, fit_meta, classes)
    result["seat_names"] = _seat_section(result, kernels, profs, classes, names, n3, n3_variants, seat_terr, seat_core,
                                         rob, fits, fit_meta)
    result["clock_plies"] = list(CLOCK_H)
    full = None
    if full_out is not None:
        full = _full_dump(kernels, profs, mp, names, terr, fits, rob, classes)
    return result, full


def _hub_record(h, pr, classes, names, core_hubs, rob, alt_names):
    s = pr["shares"][h]
    b = pr["baseline"]["standing_me"]
    top, bottom = pr["seats"][h]
    rb = {"perturbation_fraction": _r(rob["name_hits"][h] / rob["n"], 4), "perturbation_seeds": rob["n"],
          "perturbation_hits": rob["name_hits"][h]}
    for alt in ROBUST_ALTS:
        an = alt_names[alt]
        rb[alt] = ({"name": an[h], "holds": an[h] == names["primary"][h]} if h in an
                   else {"name": None, "holds": None, "reason": "NOT_IN_THAT_UNIVERSE"})
    return {"share": {c: _r(s[i]) for i, c in enumerate(classes)},
            "enrichment": {c: _r(s[i] / b[i], 4) for i, c in enumerate(classes)},
            "seat_share": {"TOP": {c: _r(top[i]) for i, c in enumerate(classes)},
                           "BOTTOM": {c: _r(bottom[i]) for i, c in enumerate(classes)}},
            "core_classes": [c for c in classes if h in core_hubs[c]],
            "mu_time": _r(pr["mu_mass"][h]),
            "best_name": names["primary"][h],
            "names": {v: names[v][h] for v in NAME_VARIANTS if v != "primary"},
            "robustness": rb}


def _headline(K, pr, members, i):
    """From the territory (uniform over its hubs' seats and turns): the class share of the rolls
    that end, split by the seat the finisher STARTED on; vs the two baselines."""
    X, nu = start_share(K, pr, members)
    Xmu, _ = start_share(K, pr, members, "mu")
    top = bottom = 0.0
    for h in members:
        t, b = seat_split(pr["H12"][hub_states(K, h)])
        top, bottom = top + t[i] / len(members), bottom + b[i] / len(members)
    dec = float(nu @ pr["d"])
    _need(abs((top + bottom) / dec - X[i]) < 1e-12, "SEAT_SPLIT_MISMATCH", f"{members[:3]}")
    return {"hubs": len(members), "x_uniform": _r(X[i]), "x_mu_within": _r(Xmu[i]),
            "x_finished_by_top_starter": _r(top / dec), "x_finished_by_bottom_starter": _r(bottom / dec),
            "y_standing_me": _r(pr["baseline"]["standing_me"][i]), "y_mu": _r(pr["baseline"]["mu"][i]),
            "mu_time_share": _r(sum(pr["mu_mass"][h] for h in members))}


def _clocked_headline(K, G, pr, members, i):
    """The clocked mixture (H uniform over 9..12 kernel PLIES, the app's clock length; not the app's
    own moveCount clock): class share of the rolls decided
    within the clock, from the territory (uniform) and from standing (me first)."""
    Rg12 = np.asarray(K.R_fin @ G)
    _X, nu = start_share(K, pr, members)
    s0 = pr["starts"]["standing_me"]
    num, den = np.zeros(2), np.zeros(2)
    for Hh in CLOCK_H:
        cm = clocked_masses(K.Q0, K.Q1, Rg12, Hh)
        cc = cm[:, 0::2] + cm[:, 1::2]
        num += np.array([nu @ cc[:, i], s0 @ cc[:, i]]) / len(CLOCK_H)
        den += np.array([nu @ cc.sum(1), s0 @ cc.sum(1)]) / len(CLOCK_H)
    return {"x_clocked": _r(num[0] / den[0]), "y_clocked": _r(num[1] / den[1]),
            "decided_within_clock_from_territory": _r(den[0]), "decided_within_clock_from_standing": _r(den[1])}


def _gi_vs_nogi(kernels, profs, groups, terr, names, classes):
    """Item 6: which territories grow, shrink, appear or vanish between the frames — against
    each frame's OWN baseline and against the no-gi baseline held fixed (so a moved baseline
    cannot masquerade as a moved territory)."""
    nogi, gi = profs["primary"], profs["other_frame"]
    out = {"baselines": {tag: {c: _r(profs[tag]["baseline"]["standing_me"][i]) for i, c in enumerate(classes)}
                         for tag in ("primary", "other_frame", "gi_frame_rates")},
           "universe": {"nogi": len(nogi["U"]), "gi": len(gi["U"]),
                        "gi_only_hubs": sorted(set(gi["U"]) - set(nogi["U"])),
                        "nogi_only_hubs": sorted(set(nogi["U"]) - set(gi["U"]))},
           "territories": {}, "share_movers": {}, "name_changes": {}}
    common = sorted(set(nogi["U"]) & set(gi["U"]))
    for i, c in enumerate(classes):
        out["territories"][c] = {}
        b_nogi = float(nogi["baseline"]["standing_me"][i])
        for th in N2R_THETAS:
            a = set(terr["primary"][("standing_me", "ratio")][c][th]["members"])
            g = set(terr["other_frame"][("standing_me", "ratio")][c][th]["members"])
            gf = set(terr["gi_frame_rates"][("standing_me", "ratio")][c][th]["members"])
            fixed = territory({h: float(s[i]) for h, s in gi["shares"].items()}, b_nogi, th)
            gfix = set(fixed["members"])
            out["territories"][c][str(th)] = {
                "nogi": len(a), "gi_own_baseline": len(g), "gi_nogi_baseline": len(gfix),
                "gi_frame_rates_own_baseline": len(gf),
                "status": {"nogi": terr["primary"][("standing_me", "ratio")][c][th]["status"],
                           "gi": terr["other_frame"][("standing_me", "ratio")][c][th]["status"]},
                "kept": sorted(a & g), "vanish_in_gi": sorted(a - g),
                "appear_in_gi_place_exists_in_nogi": sorted((g - a) & set(nogi["U"])),
                "appear_in_gi_place_absent_in_nogi": sorted((g - a) - set(nogi["U"])),
                "gi_nogi_baseline_vs_nogi": {"kept": len(a & gfix), "vanish": sorted(a - gfix), "appear": sorted(gfix - a)},
                "headline_nogi": _headline(kernels["primary"], nogi, sorted(a), i) if a else None,
                "headline_gi": _headline(kernels["other_frame"], gi, sorted(g), i) if g else None}
        mv = sorted(((float(gi["shares"][h][i] - nogi["shares"][h][i]), h) for h in common), key=lambda x: (x[0], x[1]))
        out["share_movers"][c] = {"most_down_in_gi": [[h, _r(v, 4)] for v, h in mv[:6]],
                                  "most_up_in_gi": [[h, _r(v, 4)] for v, h in mv[::-1][:6]],
                                  "hubs_compared": len(common)}
    # the positions that exist only in gi: how far any class's share there rises above the gi baseline
    only = sorted(set(gi["U"]) - set(nogi["U"]))
    b_gi = gi["baseline"]["standing_me"]
    per = {}
    for h in only:
        e = [float(gi["shares"][h][i] / b_gi[i]) for i in range(len(classes))]
        i = int(np.argmax(e))
        per[h] = {"class": classes[i], "enrichment": _r(e[i], 4), "share": _r(gi["shares"][h][i]),
                  "name_in_gi": names["other_frame"]["primary"][h]}
    if only:
        top = max(sorted(per), key=lambda h: per[h]["enrichment"])
        ci = classes.index(per[top]["class"])
        out["gi_only_guards"] = {
            "set_definition": "positions in the gi universe (both seats reachable from standing, gi/symmetric) and not in the no-gi one; "
                              "enrichment = class share of the rolls that end (hub start law) / the same class's share from standing in gi",
            "hubs": only, "count": len(only),
            "max_enrichment": _r(float(gi["shares"][top][ci] / b_gi[ci]), 4),
            "argmax_hub": top, "argmax_class": per[top]["class"], "argmax_share": per[top]["share"],
            "gi_baseline_share": _r(b_gi[ci]),
            "named_in_gi": sorted(h for h in only if per[h]["name_in_gi"] is not None),
            "per_hub_max": per}
    ch = [[h, names["primary"]["primary"][h], names["other_frame"]["primary"][h]] for h in common
          if names["primary"]["primary"][h] != names["other_frame"]["primary"][h]]
    out["name_changes"] = {"hubs_compared": len(common), "changed": len(ch), "rows": ch}
    return out


def _name_summary(names, profs, classes, rob):
    prim = names["primary"]["primary"]
    counts = {c: sum(1 for n in prim.values() if n == c) for c in classes}
    counts["UNNAMED"] = sum(1 for n in prim.values() if n is None)
    variants = {}
    for v in NAME_VARIANTS:
        if v == "primary":
            continue
        vn = names["primary"][v]
        diff = [[h, prim[h], vn[h]] for h in sorted(prim) if vn[h] != prim[h]]
        variants[v] = {"definition": dict(zip(("theta", "delta", "scale", "choose", "baseline"), NAME_VARIANTS[v])),
                       "counts": {c: sum(1 for n in vn.values() if n == c) for c in classes} | {
                           "UNNAMED": sum(1 for n in vn.values() if n is None)},
                       "agree_with_primary": len(prim) - len(diff), "differ": diff}
    by_config = {}
    for tag in names:
        if tag == "primary":
            continue
        tn = names[tag]["primary"]
        common = sorted(set(tn) & set(prim))
        by_config[tag] = {"hubs": len(tn), "common_with_primary": len(common),
                          "agree_with_primary": sum(tn[h] == prim[h] for h in common),
                          "counts": {c: sum(1 for n in tn.values() if n == c) for c in classes} | {
                              "UNNAMED": sum(1 for n in tn.values() if n is None)},
                          "names": tn}
    return {"primary_counts": counts, "variants": variants, "by_configuration": by_config}


def _assemble(kernels, profs, groups, joins, checks, mp, names, terr, core_hubs, rob, mc, mc_worst, themes,
              theme_rows, unmapped, fits, fit_meta, classes, voc_sha, seeds, eps, mc_rolls, selfcheck_result):
    K, pr, G = kernels["primary"], profs["primary"], groups["primary"]
    cfg = {tag: {"frame": f, "initiative": i, "rates": r, "origin_filter": o} for tag, f, i, r, o in CONFIGS}
    alt_names = {alt: names[alt]["primary"] for alt in ROBUST_ALTS}
    hubs = {h: _hub_record(h, pr, classes, names["primary"], core_hubs["primary"], rob, alt_names) for h in pr["U"]}
    not_eval = {h: ("PARTIALLY_REACHABLE" if h in pr["partial"] else "UNREACHABLE_FROM_STANDING")
                for h in K.hubs if h not in pr["U"]}
    roles = {}
    for r_id in sorted(K.reachable):
        r = K.index[r_id]
        nu = np.zeros(K.n_t)
        nu[[r, K.n_r + r]] = 0.5
        dd = nu @ pr["d"]
        me, them = (nu @ pr["H12"][:, 0::2]) / dd, (nu @ pr["H12"][:, 1::2]) / dd
        roles[r_id] = {"me": {c: _r(me[i]) for i, c in enumerate(classes)},
                       "them": {c: _r(them[i]) for i, c in enumerate(classes)}}
    territories = {}
    for c_i, c in enumerate(classes):
        territories[c] = {}
        for (bname, scale), tt in terr["primary"].items():
            for th, t in tt[c].items():
                rec = {k: (_r(v) if isinstance(v, float) else v) for k, v in t.items() if k != "members"}
                rec["members"] = t["members"]
                if t["members"]:
                    rec["core"] = [h for h in t["members"] if h in core_hubs["primary"][c]]
                    rec["halo"] = [h for h in t["members"] if h not in core_hubs["primary"][c]]
                    rec["headline"] = _headline(K, pr, t["members"], c_i)
                if bname == "standing_me" and scale == "ratio":
                    hits = rob["member_hits"][c][th]
                    rec["robustness"] = {
                        "member_fraction": {h: _r(hits.get(h, 0) / rob["n"], 4) for h in t["members"]},
                        "outsiders_in_at_least_5pct": {h: _r(n / rob["n"], 4) for h, n in sorted(hits.items())
                                                       if h not in t["members"] and n / rob["n"] >= 0.05},
                        "jaccard_to_unperturbed": _quantiles(rob["jaccard"][c][th]),
                        "headline_x_on_fixed_set": _quantiles(rob["headline"][c][th])}
                    if t["members"]:
                        rec["headline"].update(_clocked_headline(K, G, pr, t["members"], c_i))
                    alts = {}
                    for alt in ROBUST_ALTS + ("gi_shipped", "gi_frame_rates"):
                        at = terr[alt][("standing_me", "ratio")][c][th]
                        a, b = set(at["members"]), set(t["members"])
                        alts[alt] = {"status": at["status"], "size": len(a),
                                     "jaccard": _r(len(a & b) / len(a | b), 4) if a | b else None,
                                     "gained": sorted(a - b), "lost": sorted(b - a)}
                        if at["members"]:
                            alts[alt]["headline"] = _headline(kernels[alt], profs[alt], at["members"], c_i)
                    rec["other_configurations"] = alts
                if bname == "mu" and scale == "ratio":
                    rec["robustness"] = {"jaccard_to_unperturbed": _quantiles(rob["mu_jaccard"][c][th])}
                territories[c][f"{bname}|{scale}|{th}"] = rec
    prim = names["primary"]["primary"]
    unnamed = []
    b = pr["baseline"]["standing_me"]
    for h in sorted(pr["U"]):
        if prim[h] is not None:
            continue
        s = pr["shares"][h]
        i = int(np.argmax(s - b))
        unnamed.append({"hub": h, "mu_time": _r(pr["mu_mass"][h]), "largest_excess_class": classes[i],
                        "its_share": _r(s[i]), "its_enrichment": _r(s[i] / b[i], 4), "its_excess": _r(s[i] - b[i]),
                        "max_enrichment": _r(float(np.max(s / b)), 4),
                        "stays_unnamed_fraction": _r(rob["name_hits"][h] / rob["n"], 4)})
    unnamed.sort(key=lambda x: (-x["mu_time"], x["hub"]))
    mp_out = {}
    for tag, recs in mp.items():
        mp_out[tag] = {}
        for label, rec in recs.items():
            keep = {k: (_g(v, 3) if isinstance(v, float) else v) for k, v in rec.items() if not k.startswith("_")}
            if tag != "primary":
                keep.pop("peaks_reachable", None)
                keep.pop("core_hubs", None)
            mp_out[tag][label] = keep
    fit_out = {tag: {"summary": _fit_summary(run, (fit_meta[tag] if tag in fit_meta else fit_meta["primary"])["labels"],
                                             classes, full=tag == "primary"),
                     "coverage": run["coverage"]} for tag, run in fits.items()}
    coverage = {tag: {**joins[tag], "universe_hubs": len(profs[tag]["U"]), "hubs_total": len(kernels[tag].hubs),
                      "partial_hubs": len(profs[tag]["partial"]),
                      "reachable_transient_states": int(kernels[tag].reach_t.sum()),
                      "qprocess_states": int(len(profs[tag]["qp"]["idx"]))} for tag in kernels}
    return {
        "schema": "graph-semantics.naming.n2r.v1",
        "which_game": "The CORPUS's game (shared kernel: both seats sample authored attempt shares, origin filter as "
                      "configured, no round clock unless stated). Not the app's game.",
        "recompute": "python3 -B scripts/semantics/naming.py --territories",
        "lexicon_sha256": voc_sha,
        "graph_sha256": hashlib.sha256((ROOT / "graph.json").read_bytes()).hexdigest(),
        "source_sha256": producer_sha256(),
        "configurations": cfg,
        "definitions": {
            "class": "N1 lexicon body region of the FINISHING submission (structured type + targetArea); finisher columns joined by hub id.",
            "share": "P(roll ends by a class-C finish | roll ends decided), from the stated start law; both performers pooled unless named.",
            "hub_start": "uniform over the hub's 4 transient states {top, bottom} x {my turn, their turn}.",
            "role_start": "1/2 (role-node, my turn) + 1/2 (role-node, their turn); me / them = performer.",
            "seat_share": "TOP / BOTTOM = finishes by the player who STARTED on that seat (hub start law).",
            "baselines": "standing_me = K.start('standing','me'); mu = Q-process stationary law on the reachable transient states.",
            "universe": "hubs with BOTH role-nodes reachable from standing in the configuration's kernel.",
            "territory": "R_C(theta; baseline, scale) = universe hubs with enrichment >= theta; ratio = s/b (spec; bounded by 1/b), odds = [s/(1-s)]/[b/(1-b)].",
            "core_halo": "core = territory hubs with a state whose hand finishes in class C directly or by a chain (R_C > 0); halo = the rest.",
            "best_name": f"argmax ratio enrichment over classes with E >= {NAME_THETA} (standing b) and excess s - b >= {NAME_DELTA}; None = unnamed.",
            "robustness": f"fraction of K.perturbed({eps}, {eps}, seed), seeds 0..{seeds - 1}, keeping the claim (own recomputed baseline); plus origin=False, shipped rule, gi frame. Not a probability of being right.",
            "fit": "score_pairs: precision/recall/F1/lift, hypergeometric upper tail, whole-family BH — EXPLORATORY (uniform-node null; graph-derived sets are dependent); mu_* = mu-weighted, no weighted p.",
            "time": "Exit shares at H = infinity do not depend on steps vs plies; the clocked figures use the kernel's plies (one card, 0 for a stay-put miss) with H uniform over 9..12 plies, the app's clock length (maxMoves). That is not the app's own move clock, which counts moveCount (app_game.py).",
            "tv_regions": "gs-3's accepted exit-TV k-medoids territories (gs-shared.md §8; geometry.json), keyed tv:<medoid>, named here by the same rule from a uniform start over each region; robustness holds the member set FIXED."},
        "selfcheck": selfcheck_result,
        "coverage": coverage,
        "checks": {"identities": checks, "monte_carlo_max_abs_z": _r(mc_worst, 3),
                   "maximum_principle_functions_checked": sum(1 for recs in mp.values() for r in recs.values() if r.get("core_states")),
                   "strict_maxima_outside_core": 0},
        "baselines": {tag: {k: {c: _r(v[i]) for i, c in enumerate(classes)} for k, v in profs[tag]["baseline"].items()}
                      for tag in kernels},
        "hubs": hubs, "role_nodes": roles, "not_evaluable": not_eval,
        "territories": territories,
        "names": _name_summary(names, profs, classes, rob),
        "unnamed_ground": unnamed,
        "max_principle": mp_out,
        "system_themes": {"themes": themes, "systems": theme_rows, "unmapped_family_types": [list(u) for u in unmapped],
                          "system_names_read": 0},
        "fit": fit_out,
        "fit_labels": {tag: {"labels_scored": m["labels_scored"], "regions": m["regions"],
                             "bh_family_size": m["bh_family_size"],
                             "dropped_empty_in_universe": len(m["dropped_empty_in_universe"]),
                             "structural_label_sizes": {k: v for k, v in m["labels"].items() if v["evidence"] != "name-derived"
                                                        and (tag in ("primary",) or not tag.startswith("primary")
                                                             or k not in fit_meta["primary"]["labels"])}}
                       for tag, m in fit_meta.items()},
        "gi_vs_nogi": _gi_vs_nogi(kernels, profs, groups, terr, names, classes),
        "robustness": {"seeds": seeds, "eps_attempt": eps, "eps_rate": eps, "evaluated": rob["n"],
                       "baseline_standing_me_under_perturbation": {
                           c: _quantiles(list(rob["baselines"][:, i])) for i, c in enumerate(classes)}},
        "monte_carlo": mc,
        "waits_on_gs1": [
            "Scoring gs-1's flow-compression (map equation) modules against the six class territories, the canonical-origin labels and the name tokens (needs tests/artifacts/semantics/territories.json with a hub -> module map; T2R has not landed it).",
            "Naming the SEAT and PHASE splits (is leg-lock territory inside the guard/standing phase? what share of each module's exits is each class?).",
            "NMI / purity between exit-defined territories and flow modules (two independent lenses on one map)."],
    }


def _tv_section(kernels, profs, tv, audit, terr, core_hubs, rob, fits, fit_meta, classes):
    """gs-3's exit-TV territories, named in this lane's vocabulary: class shares from a uniform
    start over each region, enrichment, best name (+ variants), core/halo for that name, the four
    robustness facts for the FIXED member set, overlap with R_C(theta), and the set-level fit."""
    if tv is None:
        return {"status": audit["status"], "note": "gs-3 geometry.json absent; nothing scored"}
    out = {"audit": audit, "regions": {}, "by_configuration": {}}
    K, pr = kernels["primary"], profs["primary"]
    b = pr["baseline"]["standing_me"]
    for key, members in sorted(tv["primary"].items()):
        nm, s = region_name(K, pr, members, classes)
        rec = {"size": len(members), "members": members,
               "share": {c: _r(s[i]) for i, c in enumerate(classes)},
               "enrichment": {c: _r(s[i] / b[i], 4) for i, c in enumerate(classes)},
               "best_name": nm,
               "names": {v: region_name(K, pr, members, classes, v)[0] for v in NAME_VARIANTS if v != "primary"},
               "mu_time_share": _r(sum(pr["mu_mass"][h] for h in members))}
        _X, nu = start_share(K, pr, members)
        top = sum(seat_split(pr["H12"][hub_states(K, h)])[0] for h in members) / len(members) / float(nu @ pr["d"])
        bot = sum(seat_split(pr["H12"][hub_states(K, h)])[1] for h in members) / len(members) / float(nu @ pr["d"])
        _need(np.abs(top + bot - s).max() < 1e-12, "SEAT_SPLIT_MISMATCH", key)
        rec["seat_share"] = {"TOP": {c: _r(top[i]) for i, c in enumerate(classes)},
                             "BOTTOM": {c: _r(bot[i]) for i, c in enumerate(classes)}}
        if nm is not None:
            i = classes.index(nm)
            rec["headline"] = _headline(K, pr, members, i)
            rec["core"] = [h for h in members if h in core_hubs["primary"][nm]]
            rec["halo"] = [h for h in members if h not in core_hubs["primary"][nm]]
        n3r = region_seat_name(K, pr, members, classes, nm)
        rec["name_n3"] = {"class": n3r[0], "qualifier": n3r[1], "label": n3_label(n3r)}
        rec["robustness_n3"] = {"perturbation_hits": rob["fixed_hits_n3"][key], "perturbation_seeds": rob["n"],
                                "perturbation_fraction": _r(rob["fixed_hits_n3"][key] / rob["n"], 4)}
        for alt in ROBUST_ALTS:
            kept = sorted(set(members) & set(profs[alt]["U"]))
            if kept:
                an = region_seat_name(kernels[alt], profs[alt], kept, classes, region_name(kernels[alt], profs[alt], kept, classes)[0])
                rec["robustness_n3"][alt] = {"label": n3_label(an), "holds": an == n3r}
            else:
                rec["robustness_n3"][alt] = {"label": None, "holds": None, "reason": "NOT_IN_THAT_UNIVERSE"}
        rb = {"perturbation_fraction": _r(rob["fixed_hits"][key] / rob["n"], 4), "perturbation_seeds": rob["n"],
              "perturbation_hits": rob["fixed_hits"][key],
              "share_under_perturbation": {c: _quantiles([float(x[i]) for x in rob["fixed_shares"][key]])
                                           for i, c in enumerate(classes)}}
        for alt in ROBUST_ALTS:
            kept = sorted(set(members) & set(profs[alt]["U"]))
            an = region_name(kernels[alt], profs[alt], kept, classes)[0] if kept else None
            rb[alt] = {"name": an, "holds": an == nm if kept else None, "members_in_that_universe": len(kept)}
        rec["robustness"] = rb
        overlap = {}
        for c in classes:
            for th in N2R_THETAS:
                m = set(terr["primary"][("standing_me", "ratio")][c][th]["members"])
                if m:
                    overlap[f"{c}:{th}"] = {"jaccard": _r(len(m & set(members)) / len(m | set(members)), 4),
                                            "in_both": len(m & set(members))}
        best = max(overlap, key=lambda k: (overlap[k]["jaccard"], k)) if overlap else None
        rec["overlap_with_exit_share_territories"] = {"best": best, "all": overlap}
        out["regions"][key] = rec
    for tag, regions in sorted(tv.items()):
        if tag == "primary":
            continue
        out["by_configuration"][tag] = {key: {"size": len(m), "best_name": region_name(kernels[tag], profs[tag], m, classes)[0]}
                                        for key, m in sorted(regions.items())}
    if "primary_tv" in fits:
        out["fit"] = _fit_summary(fits["primary_tv"], fit_meta["primary_tv"]["labels"], classes)
        rows = [r for r in fits["primary_tv"]["scores"] if r["label"].startswith("exit-share:") and r["status"] == "ok"]
        out["fit_vs_exit_share_territories"] = {
            f'{r["region"]} ~ {r["label"]}': {"f1": _r(r["f1"], 4), "precision": _r(r["precision"], 4),
                                              "recall": _r(r["recall"], 4), "q_bh": _g(r["q_bh"]), "bh_reject": r["bh_reject"]}
            for r in rows if r["counts"]["intersection"] > 0}
        out["fit_coverage"] = fits["primary_tv"]["coverage"]
    return out


def _seat_fit_summary(run, label_meta):
    """Per seat region: its own seat-projected labels, its pooled labels, and the best row per kind."""
    by_region = {}
    for row in run["scores"]:
        by_region.setdefault(row["region"], []).append(row)

    def slim(row):
        if row["status"] != "ok":
            return {"label": row["label"], "status": row["status"]}
        w = row.get("weighted", {})
        return {"label": row["label"], "evidence": label_meta[row["label"]]["evidence"],
                "n_region": row["counts"]["region"], "n_label": row["counts"]["label"],
                "n_both": row["counts"]["intersection"], "precision": _r(row["precision"], 4),
                "recall": _r(row["recall"], 4), "f1": _r(row["f1"], 4), "q_bh": _g(row["q_bh"]),
                "bh_reject": row["bh_reject"],
                "mu_precision": _r(w["precision"], 4) if w.get("status") == "ok" else None,
                "mu_recall": _r(w["recall"], 4) if w.get("status") == "ok" else None}
    out = {}
    for region, rows in sorted(by_region.items()):
        if region.startswith("Rs:"):
            _p, c, seat, _th = region.split(":")
        else:
            c, q = region[3:].split("|")
            seat = q if q in SEATS else None
        wanted = {f"origin:{c}", f"listing:{c}", f"core:{c}", f"system-theme:{c}"}
        if seat:
            wanted |= {f"origin:{c}:{seat}", f"listing:{c}:{seat}", f"core:{c}:{seat}"}
        ok = [r for r in rows if r["status"] == "ok"]
        best = {}
        for prefix in ("origin:", "listing:", "system:", "position-family:", "name-token:"):
            cand = [r for r in ok if r["label"].startswith(prefix)]
            if cand:
                best[prefix.rstrip(":")] = slim(max(cand, key=lambda r: (r["f1"], -r["p_hypergeom_upper"], r["label"])))
        out[region] = {"own_labels": [slim(r) for r in rows if r["label"] in wanted]}
        if region.startswith("n3:"):
            out[region]["best_by_kind"] = best
    return out


def _seat_section(result, kernels, profs, classes, names, n3, n3_variants, seat_terr, seat_core, rob, fits, fit_meta):
    """N3: seat-aware names, their four robustness facts, seat territories, seat set-fit, and
    what they do to the unnamed ground. Also writes the N3 fields into result['hubs']."""
    pr = profs["primary"]
    bt, bb = seat_baselines(pr)
    base_n3 = n3["primary"]
    _need(base_n3 == rob["base_n3"], "N3_BASE_MISMATCH", "ensemble reference differs from the reported names")
    for h, rec in result["hubs"].items():
        top, bot = pr["seats"][h]
        c, q = base_n3[h]
        rec["name_n3"] = {"class": c, "qualifier": q, "label": n3_label((c, q))}
        rec["seat_core"] = seat_core[h]
        rb = {"perturbation_hits": rob["n3_hits"][h], "perturbation_seeds": rob["n"],
              "perturbation_fraction": _r(rob["n3_hits"][h] / rob["n"], 4)}
        for alt in ROBUST_ALTS:
            an = n3[alt].get(h)
            rb[alt] = ({"label": n3_label(an), "holds": an == (c, q)} if an is not None
                       else {"label": None, "holds": None, "reason": "NOT_IN_THAT_UNIVERSE"})
        rec["robustness_n3"] = rb
    labels = {h: n3_label(v) for h, v in base_n3.items()}
    counts = {}
    for lab in labels.values():
        counts[lab or "UNNAMED"] = counts.get(lab or "UNNAMED", 0) + 1
    pooled = names["primary"]["primary"]
    gained = sorted(h for h in labels if labels[h] and pooled[h] is None)
    unnamed_mu = sum(pr["mu_mass"][h] for h in labels if labels[h] is None)
    variants = {}
    for kind, vn in n3_variants.items():
        diff = [[h, labels[h], n3_label(vn[h])] for h in sorted(labels) if n3_label(vn[h]) != labels[h]]
        variants[kind] = {"agree_with_primary": len(labels) - len(diff), "differ": diff}
    by_config = {}
    for tag, vn in n3.items():
        if tag == "primary":
            continue
        common = sorted(set(vn) & set(labels))
        by_config[tag] = {"hubs": len(vn), "agree_with_primary": sum(n3_label(vn[h]) == labels[h] for h in common),
                          "common_with_primary": len(common),
                          "unnamed": sum(1 for v in vn.values() if v[0] is None),
                          "differ_from_primary": {h: n3_label(vn[h]) for h in sorted(vn)
                                                  if h not in labels or n3_label(vn[h]) != labels[h]}}
    robust_all = sorted(h for h, rec in result["hubs"].items()
                        if rec["robustness_n3"]["perturbation_fraction"] >= 0.95
                        and all(rec["robustness_n3"][a]["holds"] is True for a in ROBUST_ALTS))
    st = {}
    for c in classes:
        st[c] = {}
        for seat in SEATS:
            st[c][seat] = {}
            for th, t in seat_terr["primary"][c][seat].items():
                rec = {k: (_r(v) if isinstance(v, float) else v) for k, v in t.items()}
                if t["members"]:
                    rec["core"] = [h for h in t["members"] if c in seat_core[h][seat]]
                    rec["halo"] = [h for h in t["members"] if c not in seat_core[h][seat]]
                    rec["mu_time_share"] = _r(sum(pr["mu_mass"][h] for h in t["members"]))
                st[c][seat][str(th)] = rec
    return {
        "definition": {
            "seat_share": "S^sigma_C(h) = P(roll ends by a class-C finish performed by the player who STARTED on seat sigma | decided), hub start law; S^TOP + S^BOTTOM = pooled share.",
            "baseline": "per-player beta_C = b_C / 2 (b_C = pooled standing share, me first); variants: standing_seat (the standing hub's own seat shares), mu_per_player (b_mu / 2). Seat enrichment = hubs[h].seat_share[sigma][C] / baseline_per_player[C].",
            "gates": f"(C, sigma) passes when S^sigma_C >= {NAME_THETA} x beta_C and S^sigma_C - beta_C >= {NAME_DELTA}.",
            "rule": "refine-only: a pooled (N2R) name keeps its class and gains qualifier BOTH / TOP / BOTTOM / SHARED (seats passing for that class); an unnamed hub gains 'C for the sigma player' (largest seat enrichment); else unnamed.",
            "proposition_5": "lane-gs-5.md N3: (a) both seats pass => pooled passes; (b) pooled E >= theta => some seat E >= theta; (c) pooled excess >= 2 delta => some seat excess >= delta; (d) seat ceiling 2/b; (e) symmetric rule: S^TOP(h) = coin 'me' share of h/top."},
        "baseline_per_player": {c: _r(bt[i]) for i, c in enumerate(classes)},
        "counts": counts, "gained_seat_names": gained,
        "gained_mu_time": _r(sum(pr["mu_mass"][h] for h in gained)),
        "unnamed": {"hubs": counts.get("UNNAMED", 0), "mu_time": _r(unnamed_mu),
                    "n2r_hubs": sum(1 for v in pooled.values() if v is None),
                    "n2r_mu_time": _r(sum(pr["mu_mass"][h] for h, v in pooled.items() if v is None))},
        "robust_on_all_four_facts": {"hubs": len(robust_all), "of": len(labels),
                                     "not": sorted(set(labels) - set(robust_all))},
        "baseline_variants": variants, "by_configuration": by_config,
        "seat_territories": st,
        "fit": _seat_fit_summary(fits["primary_seat"], fit_meta["primary_seat"]["labels"]),
        "fit_coverage": fits["primary_seat"]["coverage"]}


def _full_dump(kernels, profs, mp, names, terr, fits, rob, classes):
    out = {"fit_rows": {k: v["scores"] for k, v in fits.items()}, "names": names, "states": {},
           "robustness_name_hits": rob["name_hits"],
           "reach_core": {}}
    for tag, K in kernels.items():
        pr = profs[tag]
        out["states"][tag] = {f"{K.labels[t][0]}@{K.labels[t][1]}": [float(x) for x in pr["H12"][t]]
                              for t in range(K.n_t)}
        out["reach_core"][tag] = {c: [float(x) for x in rec["_reach"]] for c, rec in mp[tag].items() if "_reach" in rec}
    out["territories"] = {tag: {f"{b}|{s}": {c: {str(th): t["members"] for th, t in v.items()} for c, v in tt.items()}
                                for (b, s), tt in terr[tag].items()} for tag in terr}
    return out


# --------------------------------------------------------------------------- #
# N3 — NAME CARDS: deterministic records + template sentences, read back from naming.json
# --------------------------------------------------------------------------- #
CARDS_BUDGET = 200_000
CLASS_WORDS = {   # (noun, plural, adjective used in "<adjective> territory")
    "LEG": ("leg lock", "leg locks", "leg-lock"),
    "ARM": ("arm lock", "arm locks", "arm-lock"),
    "SHOULDER": ("shoulder lock", "shoulder locks", "shoulder-lock"),
    "CHOKE": ("choke", "chokes", "choke"),
    "SPINE/COMPRESSION": ("spine lock or neck crank", "spine locks and neck cranks", "spine-lock"),
    "HIP/GROIN": ("hip or groin lock", "hip and groin locks", "hip/groin-lock"),
}
QUALIFIER_WORDS = {"BOTH": "for both players", "TOP": "for the top player", "BOTTOM": "for the bottom player",
                   "SHARED": "shared between the players"}
ALT_WORDS = {"origin_false": "with the origin filter off", "other_rule": "under the shipped initiative rule",
             "other_frame": "in gi"}
NUM_RE = re.compile(r"\d+(?:\.\d+)?")


def name_phrase(label):
    if label is None:
        return "middle game"
    c, q = label.split("|")
    return f"{CLASS_WORDS[c][2]} territory {QUALIFIER_WORDS[q]}"


def _a(noun):
    return ("an " if noun[0] in "aeiou" else "a ") + noun


def _join(parts):
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


class CardText:
    """The only way a number enters a card: fetched BY PATH from the artifact, formatted here and
    remembered. verify() refuses a sentence holding any number that did not come through here
    (position names and other literal words are registered and stripped first)."""

    def __init__(self, art):
        self.art, self.used, self.literals = art, [], []

    def get(self, *path):
        v = self.art
        for k in path:
            v = v[k]
        return v

    def _use(self, path, value, text):
        self.used.append(["/".join(str(k) for k in path), value, text])
        return text

    def pct(self, *path):
        """One decimal from 1% up; two significant digits below, so a real 0.036% never reads 0.0%."""
        v = self.get(*path)
        x = 100 * float(v)
        return self._use(path, v, f"{x:.1f}%" if abs(x) >= 1 or x == 0 else f"{x:.2g}%")

    def times(self, *path):
        v = self.get(*path)
        return self._use(path, v, f"{float(v):.1f}x")

    def dec2(self, *path):
        v = self.get(*path)
        return self._use(path, v, f"{float(v):.2f}")

    def plain(self, *path):
        v = self.get(*path)
        return self._use(path, v, f"{float(v):g}")

    def count(self, *path):
        v = self.get(*path)
        _need(isinstance(v, int) and not isinstance(v, bool), "CARD_COUNT_NOT_INT", "/".join(map(str, path)))
        return self._use(path, v, str(v))

    def length(self, *path):
        v = self.get(*path)
        _need(isinstance(v, list), "CARD_LENGTH_NOT_LIST", "/".join(map(str, path)))
        return self._use(path + ("#len",), len(v), str(len(v)))

    def literal(self, text):
        self.literals.append(text)
        return text

    def verify(self, sentence):
        _need("in the corpus's game" in sentence.lower(), "CARD_WITHOUT_GAME", sentence[:80])
        stripped = sentence
        for t in sorted(set(self.literals), key=len, reverse=True):
            stripped = stripped.replace(t, " ")
        found = Counter(NUM_RE.findall(stripped))
        allowed = Counter(tok for _p, _v, txt in self.used for tok in NUM_RE.findall(txt))
        extra = found - allowed
        _need(not extra, "CARD_NUMBER_NOT_FROM_ARTIFACT", f"{dict(extra)} in: {sentence}")
        for _p, _v, txt in self.used:
            _need(txt in sentence, "CARD_NUMBER_UNUSED", f"{txt} not in: {sentence}")
        return sentence


def _rob_clause(T, base_path, label_key="label"):
    rob = T.get(*base_path)
    txt = f"holds in {T.count(*base_path, 'perturbation_hits')}/{T.count(*base_path, 'perturbation_seeds')} perturbations"
    holds, differs = [], []
    for alt in ROBUST_ALTS:
        r = rob[alt]
        if r["holds"] is True:
            holds.append(ALT_WORDS[alt])
        elif r["holds"] is None:
            differs.append(f"{ALT_WORDS[alt]} it is not reachable")
        else:
            differs.append(f"{ALT_WORDS[alt]} it is {name_phrase(r[label_key])}")
    if holds:
        txt += " and " + _join(holds)
    if differs:
        txt += "; " + "; ".join(differs)
    return txt


def _frame_words(art):
    return "no-gi" if art["configurations"]["primary"]["frame"] == "nogi" else "gi"


def hub_card(art, h, display, classes):
    T = CardText(art)
    rec = art["hubs"][h]
    n3 = rec["name_n3"]
    label = n3["label"]
    b = art["baselines"]["primary"]["standing_me"]
    c = n3["class"] if label else max(sorted(classes), key=lambda k: rec["share"][k] - b[k])
    noun, plural, _adj = CLASS_WORDS[c]
    pos = T.literal(display)
    game = f"In the corpus's game ({_frame_words(art)})"
    share = T.pct("hubs", h, "share", c)
    base = T.pct("baselines", "primary", "standing_me", c)
    material = abs(rec["seat_share"]["TOP"][c] - rec["seat_share"]["BOTTOM"][c]) >= NAME_DELTA
    seat = ""
    if material:
        seat = (f" — {T.pct('hubs', h, 'seat_share', 'TOP', c)} by the player who started on top, "
                f"{T.pct('hubs', h, 'seat_share', 'BOTTOM', c)} by the one who started underneath")
    rob = _rob_clause(T, ("hubs", h, "robustness_n3"))
    time = T.pct("hubs", h, "mu_time")
    if label:
        q = n3["qualifier"]
        core = c in (rec["seat_core"][q] if q in SEATS else rec["core_classes"])
        core_txt = (f"it deals {plural} itself (core)" if core else
                    f"it deals no {noun} itself; its share is inherited from nearby positions that do (halo)")
        sentence = (f"{game}, {pos} is {name_phrase(label)}: {share} of the rolls that end from here end in "
                    f"{_a(noun)}, vs {base} from standing{seat}; {core_txt}; the name {rob}; "
                    f"it holds {time} of a long fight's time.")
    else:
        sentence = (f"{game}, {pos} is middle game: its rolls end much as rolls from standing do; its most "
                    f"over-represented ending, the {noun}, is {share} of the rolls that end, vs {base} from "
                    f"standing{seat}; being unnamed {rob}; it holds {time} of a long fight's time.")
    T.verify(sentence)
    return {"hub": h, "position": display, "name": label, "phrase": name_phrase(label), "class": c,
            "seat_asymmetry_material": material, "sentence": sentence, "numbers": T.used}


def territory_card(art, c, key, displays):
    T = CardText(art)
    t = art["territories"][c][key]
    noun, plural, adj = CLASS_WORDS[c]
    game = f"In the corpus's game ({_frame_words(art)})"
    P = ("territories", c, key)
    if t["status"] == "IMPOSSIBLE_THRESHOLD":
        sentence = (f"{game}, {adj} territory at {T.plain(*P, 'theta')}x cannot exist: {plural} are already "
                    f"{T.pct('baselines', 'primary', 'standing_me', c)} of all endings from standing, and "
                    f"{T.plain(*P, 'theta')} times that is {T.pct(*P, 'threshold_share')}, more than every roll.")
    elif t["status"] == "EMPTY":
        sentence = (f"{game}, there is no {adj} territory at {T.plain(*P, 'theta')}x: a position would need "
                    f"{T.pct(*P, 'threshold_share')} of its rolls that end to end in {_a(noun)} ({T.plain(*P, 'theta')} "
                    f"times the {T.pct('baselines', 'primary', 'standing_me', c)} from standing), and the most "
                    f"{adj}-heavy position, {T.literal(displays[t['argmax']])}, reaches {T.pct(*P, 'max_share')}.")
    else:
        H = P + ("headline",)
        R = P + ("robustness",)
        sentence = (
            f"{game}, {adj} territory at {T.plain(*P, 'theta')}x is {T.count(*H, 'hubs')} positions "
            f"({T.length(*P, 'core')} {'deals' if len(t['core']) == 1 else 'deal'} {plural} "
            f"{'itself' if len(t['core']) == 1 else 'themselves'}, {T.length(*P, 'halo')} "
            f"{'inherits its' if len(t['halo']) == 1 else 'inherit their'} share): from "
            f"them {T.pct(*H, 'x_uniform')} of the rolls that end, end in {_a(noun)}, vs "
            f"{T.pct(*H, 'y_standing_me')} from standing ({T.pct(*H, 'x_finished_by_top_starter')} by the player who "
            f"started on top, {T.pct(*H, 'x_finished_by_bottom_starter')} by the one underneath); under the "
            f"{T.plain('clock_plies', 0)}-{T.plain('clock_plies', -1)}-ply clock {T.pct(*H, 'x_clocked')} vs "
            f"{T.pct(*H, 'y_clocked')}; they hold {T.pct(*H, 'mu_time_share')} of a long fight's time; across "
            f"{T.count(*R, 'headline_x_on_fixed_set', 'n')} perturbations the share on this fixed set stays within "
            f"{T.pct(*R, 'headline_x_on_fixed_set', 'min')}-{T.pct(*R, 'headline_x_on_fixed_set', 'max')} and the "
            f"member set keeps a median Jaccard of {T.dec2(*R, 'jaccard_to_unperturbed', 'median')}.")
    T.verify(sentence)
    return {"class": c, "key": key, "status": t["status"], "members": t["members"], "sentence": sentence,
            "numbers": T.used}


def tv_card(art, k, displays, classes):
    T = CardText(art)
    r = art["tv_regions"]["regions"][k]
    P = ("tv_regions", "regions", k)
    label = r["name_n3"]["label"]
    b = art["baselines"]["primary"]["standing_me"]
    c = r["name_n3"]["class"] if label else max(sorted(classes), key=lambda x: r["share"][x] - b[x])
    noun, _plural, _adj = CLASS_WORDS[c]
    med = T.literal(displays[k.split(":", 1)[1]])
    src = T.literal("gs-3")
    game = f"In the corpus's game ({_frame_words(art)})"
    fit = art["tv_regions"]["fit"][k]["best_by_kind"].get("origin")
    fit_txt = ""
    if fit and fit.get("bh_reject"):
        fc = fit["label"].split(":", 1)[1]
        FP = ("tv_regions", "fit", k, "best_by_kind", "origin")
        fit_txt = (f"; as a set it matches the corpus's {CLASS_WORDS[fc][2]}-origin positions (precision "
                   f"{T.dec2(*FP, 'precision')}, recall {T.dec2(*FP, 'recall')})")
    seat = (f" ({T.pct(*P, 'seat_share', 'TOP', c)} by the player who started on top, "
            f"{T.pct(*P, 'seat_share', 'BOTTOM', c)} by the one underneath)")
    what = name_phrase(label) if label else "middle game by its endings"
    sentence = (f"{game}, {src}'s exit-TV territory around {med} ({T.count(*P, 'size')} positions) is {what}: "
                f"{T.pct(*P, 'share', c)} of the rolls that end from it end in {_a(noun)}, vs "
                f"{T.pct('baselines', 'primary', 'standing_me', c)} from standing{seat}{fit_txt}; the "
                f"{'name' if label else 'verdict'} {_rob_clause(T, P + ('robustness_n3',))}; it holds "
                f"{T.pct(*P, 'mu_time_share')} of a long fight's time.")
    T.verify(sentence)
    return {"region": k, "name": label, "phrase": what, "class": c, "sentence": sentence, "numbers": T.used}


def build_cards(art, art_sha, voc):
    classes = tuple(art["hubs"][next(iter(art["hubs"]))]["share"].keys())
    displays = {h: rec["name"] for h, rec in voc["position_hubs"].items()}
    hubs = {h: hub_card(art, h, displays[h], classes) for h in sorted(art["hubs"])}
    not_eval = {}
    for h, why in sorted(art["not_evaluable"].items()):
        T = CardText(art)
        sentence = (f"In the corpus's game ({_frame_words(art)}), {T.literal(displays[h])} is not reachable from "
                    f"standing, so it has no exit law to name ({why}).")
        T.verify(sentence)
        not_eval[h] = {"hub": h, "position": displays[h], "reason": why, "sentence": sentence}
    terr = {f"{c}|{key.rsplit('|', 1)[1]}": territory_card(art, c, key, displays)
            for c in classes for key in sorted(art["territories"][c]) if key.startswith("standing_me|ratio|")}
    tv = {k: tv_card(art, k, displays, classes) for k in sorted(art["tv_regions"]["regions"])}
    n_num = sum(len(x["numbers"]) for group in (hubs, terr, tv) for x in group.values())
    n_sent = len(hubs) + len(not_eval) + len(terr) + len(tv)
    _need(len(hubs) == len(art["hubs"]) and len(terr) == 3 * len(classes) and n_num > 0,
          "CARD_COVERAGE", f"hubs {len(hubs)}, territories {len(terr)}, numbers {n_num}")
    return {"schema": "graph-semantics.naming-cards.v1",
            "which_game": art["which_game"], "configuration": art["configurations"]["primary"],
            "source": "tests/artifacts/semantics/naming.json", "source_sha256": art_sha,
            # source_sha256 has been the naming.json string since N3; the script's own hash sits beside it
            "producer_sha256": producer_sha256(),
            "recompute": "python3 -B scripts/semantics/naming.py --cards",
            "legend": {"top / bottom": "the seat the finisher STARTED in at this position (the corpus's role labels).",
                       "rolls that end": "decided rolls; a hub start is uniform over its two seats and both turns.",
                       "long fight's time": "Q-process mu: where a roll that has not yet ended spends its time.",
                       "perturbations": "K.perturbed(0.2, 0.2, seed), seeds 0..199; robustness, not a probability of being right.",
                       "numbers": "every number in a sentence is listed in `numbers` as [artifact path, value, text]; the builder refuses any other number."},
            "coverage": {"hub_cards": len(hubs), "not_evaluable_cards": len(not_eval), "territory_cards": len(terr),
                         "tv_region_cards": len(tv), "sentences_verified": n_sent, "numbers_verified": n_num},
            "hubs": hubs, "not_evaluable": not_eval, "territories": terr, "tv_regions": tv}


def cards_selfcheck() -> dict:
    """Exact sentences on a toy artifact, then mutants the verifier must refuse."""
    classes = ("LEG", "CHOKE")
    rob = {"perturbation_hits": 190, "perturbation_seeds": 200,
           "origin_false": {"label": "LEG|BOTH", "holds": True}, "other_rule": {"label": None, "holds": False},
           "other_frame": {"label": None, "holds": None}}
    art = {"configurations": {"primary": {"frame": "nogi"}}, "which_game": "toy",
           "baselines": {"primary": {"standing_me": {"LEG": 0.05, "CHOKE": 0.5}}},
           "hubs": {"x": {"share": {"LEG": 0.4, "CHOKE": 0.3}, "seat_share": {"TOP": {"LEG": 0.3, "CHOKE": 0.15},
                                                                            "BOTTOM": {"LEG": 0.1, "CHOKE": 0.15}},
                          "name_n3": {"class": "LEG", "qualifier": "BOTH", "label": "LEG|BOTH"},
                          "core_classes": ["LEG"], "seat_core": {"TOP": ["LEG"], "BOTTOM": []},
                          "robustness_n3": rob, "mu_time": 0.025}}}
    card = hub_card(art, "x", "3-4 Mount", classes)
    expected = ("In the corpus's game (no-gi), 3-4 Mount is leg-lock territory for both players: 40.0% of the "
                "rolls that end from here end in a leg lock, vs 5.0% from standing — 30.0% by the player who "
                "started on top, 10.0% by the one who started underneath; it deals leg locks itself (core); the "
                "name holds in 190/200 perturbations and with the origin filter off; under the shipped initiative "
                "rule it is middle game; in gi it is not reachable; it holds 2.5% of a long fight's time.")
    assert card["sentence"] == expected, card["sentence"]
    refused = 0
    for bad in ("In the corpus's game, x is 42% choke.", "x is 40.0% leg lock.", "In the corpus's game, 40.0% only."):
        T = CardText(art)
        T.pct("hubs", "x", "share", "LEG")
        if bad.endswith("only."):
            T.pct("hubs", "x", "mu_time")           # a fetched number the sentence forgot
        try:
            T.verify(bad)
        except NamingRefusal:
            refused += 1
    assert refused == 3, refused
    out = {"exact_card_sentences": 1, "card_mutants_refused": refused}
    print("naming cards selfcheck: " + json.dumps(out, sort_keys=True))
    return out


# --------------------------------------------------------------------------- #
# N3 item 3 — gs-1's flow-compression lens, named by exit class
# --------------------------------------------------------------------------- #
# PROPOSITION 6 (the seat split is invisible to pooled exit classes). Under the symmetric rule,
# for any set S of hubs, the start law uniform over the TOP seats of S (both turns) and the one
# uniform over the BOTTOM seats of S give the SAME pooled class shares, for every class grouping.
# Proof: the player swap pi maps (h/top, tau) to (h/bottom, other turn) bijectively between the two
# start sets, and B[pi t, (c, me)] = B[t, (c, them)] (Prop. 4b / gs-2 D); a pooled class column
# sums me + them, so nu_top . h_C = nu_bottom . h_C. Only the SEAT-labelled shares (who finishes)
# can tell the two sides apart. Checked on the kernel in run_gs1.
GS1_BUDGET = 300_000
GS1_CASE = "nogi/symmetric/origin-on"


def partition_nmi(a, b, weights=None):
    """NMI (arithmetic normalisation, I / ((H_a + H_b) / 2)) of two labelings of the SAME ids;
    weights (mu) turn it into the NMI of the weighted joint law. 1 for identical partitions."""
    ids = sorted(a)
    _need(set(ids) == set(b), "NMI_ID_SET_MISMATCH", f"{len(set(a) ^ set(b))} ids differ")
    w = np.array([1.0 if weights is None else float(weights[i]) for i in ids])
    _need(w.sum() > 0, "NMI_ZERO_WEIGHT")
    w = w / w.sum()
    la, lb = sorted({a[i] for i in ids}, key=str), sorted({b[i] for i in ids}, key=str)
    ia, ib = {x: k for k, x in enumerate(la)}, {x: k for k, x in enumerate(lb)}
    J = np.zeros((len(la), len(lb)))
    for i, wi in zip(ids, w):
        J[ia[a[i]], ib[b[i]]] += wi
    pa, pb = J.sum(1), J.sum(0)
    nz = J > 0
    I = float((J[nz] * np.log(J[nz] / np.outer(pa, pb)[nz])).sum())
    H = lambda q: float(-(q[q > 0] * np.log(q[q > 0])).sum())
    ha, hb = H(pa), H(pb)
    return 1.0 if ha + hb == 0 else max(0.0, I / ((ha + hb) / 2))


def partition_purity(a, b, weights=None):
    """Share of (weighted) ids whose a-block's best-matching b-block contains them: sum_a max_b w(a & b)."""
    ids = sorted(a)
    _need(set(ids) == set(b), "PURITY_ID_SET_MISMATCH")
    w = {i: (1.0 if weights is None else float(weights[i])) for i in ids}
    tot = math.fsum(w.values())
    blocks = {}
    for i in ids:
        blocks.setdefault(a[i], {}).setdefault(b[i], 0.0)
        blocks[a[i]][b[i]] += w[i]
    return math.fsum(max(v.values()) for v in blocks.values()) / tot


def gs1_selfcheck() -> dict:
    """NMI / purity on known answers, and against scikit-learn on seeded random labelings."""
    a = {str(i): i // 3 for i in range(9)}
    assert abs(partition_nmi(a, a) - 1) < 1e-12 and partition_purity(a, a) == 1.0
    grid = {f"{i}{j}": i for i in range(3) for j in range(3)}
    other = {f"{i}{j}": j for i in range(3) for j in range(3)}
    assert abs(partition_nmi(grid, other)) < 1e-12            # independent product partition
    assert abs(partition_purity(grid, other) - 1 / 3) < 1e-12
    from sklearn.metrics import normalized_mutual_info_score
    rng = np.random.default_rng(3)
    worst = 0.0
    for _ in range(200):
        n = int(rng.integers(5, 60))
        x, y = rng.integers(0, 5, n), rng.integers(0, 4, n)
        mine = partition_nmi({str(i): int(v) for i, v in enumerate(x)}, {str(i): int(v) for i, v in enumerate(y)})
        worst = max(worst, abs(mine - normalized_mutual_info_score(x, y)))
    assert worst < 1e-10, worst
    out = {"nmi_known_answers": 2, "purity_known_answers": 2, "sklearn_nmi_cases": 200, "sklearn_max_abs_diff": _g(worst, 3)}
    print("naming gs1 selfcheck: " + json.dumps(out, sort_keys=True))
    return out


def _region_record(K, pr, members, classes):
    pooled, s = region_name(K, pr, members, classes)
    n3 = region_seat_name(K, pr, members, classes, pooled)
    _X, nu = start_share(K, pr, members)
    dec = float(nu @ pr["d"])
    top = sum(seat_split(pr["H12"][hub_states(K, h)])[0] for h in members) / len(members) / dec
    bot = sum(seat_split(pr["H12"][hub_states(K, h)])[1] for h in members) / len(members) / dec
    b = pr["baseline"]["standing_me"]
    # the same rule on the start law weighted by where a long fight spends its time (mu within the
    # region): a large region of rarely-visited hubs can read differently from its busy hubs
    smu, numu = start_share(K, pr, members, "mu")
    pooled_mu = name_rule(smu, b, classes)
    return {"hubs": len(members), "pooled_name": pooled, "name_n3": n3_label(n3),
            "share_mu_within": {c: _r(smu[i]) for i, c in enumerate(classes)},
            "pooled_name_mu_within": pooled_mu,
            "share": {c: _r(s[i]) for i, c in enumerate(classes)},
            "enrichment": {c: _r(s[i] / b[i], 4) for i, c in enumerate(classes)},
            "seat_share": {"TOP": {c: _r(top[i]) for i, c in enumerate(classes)},
                           "BOTTOM": {c: _r(bot[i]) for i, c in enumerate(classes)}},
            "mu_time": _r(sum(pr["mu_mass"][h] for h in members))}, n3


def run_gs1(seeds=ROBUST_SEEDS, eps=ROBUST_EPS, selfcheck_result=None):
    kernel = _import_semantics("_kernel")
    vocabulary = _import_semantics("vocabulary")
    classes = tuple(vocabulary.CLASSES)
    voc, voc_sha = load_lexicon()
    t_raw = (ROOT / "tests/artifacts/semantics/territories.json").read_bytes()
    a_raw = (ROOT / "tests/artifacts/semantics/naming.json").read_bytes()
    T, art = json.loads(t_raw), json.loads(a_raw)
    base = kernel.load_kernel()
    kern, prof, groups = {}, {}, {}
    for tag, frame, ini, rates, origin in CONFIGS:
        if tag in ("primary",) + ROBUST_ALTS:
            K = kernel.load_kernel(frame=frame, initiative=ini, rates=rates, graph=base.graph, origin=origin)
            groups[tag], _j = class_grouping(K, voc, classes)
            kern[tag], prof[tag] = K, exit_profile(K, groups[tag], classes)
    K, pr, G = kern["primary"], prof["primary"], groups["primary"]
    U = set(pr["U"])
    # this run must BE the naming.json run: hub shares agree to the artifact's rounding
    dev = max(abs(float(pr["shares"][h][i]) - art["hubs"][h]["share"][c]) for h in U for i, c in enumerate(classes))
    _need(dev <= 5e-7 and set(art["hubs"]) == U, "GS1_NAMING_JSON_MISMATCH", f"max share diff {dev}")
    me = T["map_equation"][GS1_CASE]
    modules = {m["label"]: sorted(m["members"]) for m in me["module_table"]}
    flat = [h for m in modules.values() for h in m]
    _need(len(flat) == len(set(flat)) and set(flat) == U, "GS1_MODULE_UNIVERSE",
          f"{len(flat)} members, {len(set(flat) ^ U)} differ from the naming universe")
    sp = T["configs"][GS1_CASE]["splits"]
    regions = {f"module:{k}": v for k, v in modules.items()}
    for key, hubs in (("phase", sp["phase"]["guard_side_hubs"]), ("phase_sign", sp["phase_sign"]["guard_side_hubs"]),
                      ("localized", sp["localized"]["hubs"])):
        side = sorted(hubs)
        _need(set(side) < U and side, "GS1_SPLIT_UNIVERSE", key)
        first = "guard/standing" if key.startswith("phase") else "localized"
        second = "passed/pinned" if key.startswith("phase") else "rest"
        regions[f"{key}:{first}"] = side
        regions[f"{key}:{second}"] = sorted(U - set(side))
    recs, refs = {}, {}
    for k, m in sorted(regions.items()):
        recs[k], refs[k] = _region_record(K, pr, m, classes)
        recs[k]["members"] = m if not k.startswith("module:") else None
    # the SEAT split (role level): Proposition 6, then its seat-labelled shares
    nu = {"TOP": np.zeros(K.n_t), "BOTTOM": np.zeros(K.n_t)}
    for h in U:
        for seat, role in (("TOP", "top"), ("BOTTOM", "bottom")):
            r = K.index[f"{h}/{role}"]
            nu[seat][[r, K.n_r + r]] += 1.0
    for v in nu.values():
        v /= v.sum()
    pooled = {seat: (v @ pr["Hc"]) / (v @ pr["d"]) for seat, v in nu.items()}
    prop6 = float(np.abs(pooled["TOP"] - pooled["BOTTOM"]).max())
    _need(prop6 < 1e-12, "PROPOSITION_6_VIOLATED", str(prop6))
    b = pr["baseline"]["standing_me"]
    beta = b / 2
    seat_rec = {}
    for seat, v in nu.items():
        own = (v @ pr["H12"][:, 0::2]) / (v @ pr["d"])        # the seat's own player finishes
        opp = (v @ pr["H12"][:, 1::2]) / (v @ pr["d"])
        top, bot = (own, opp) if seat == "TOP" else (opp, own)
        nm = seat_aware_name(name_rule(pooled[seat], b, classes), top, bot, beta, beta, classes)
        seat_rec[seat] = {"start": f"uniform over the {seat.lower()} seats of the {len(U)} hubs, both turns",
                          "pooled_share": {c: _r(pooled[seat][i]) for i, c in enumerate(classes)},
                          "finished_by_top_player": {c: _r(top[i]) for i, c in enumerate(classes)},
                          "finished_by_bottom_player": {c: _r(bot[i]) for i, c in enumerate(classes)},
                          "name_n3": n3_label(nm)}
    # robustness: fixed member sets, 200 perturbations + the three alternatives
    hits = {k: 0 for k in regions}
    n = 0
    for seed in range(seeds):
        pp = exit_profile(perturbed_view(K, eps, seed), G, classes, with_mu=False)
        _need(pp["U"] == pr["U"], "PERTURBATION_CHANGED_REACH", str(seed))
        n += 1
        for k, m in regions.items():
            pn = region_name(K, pp, m, classes)[0]
            hits[k] += region_seat_name(K, pp, m, classes, pn) == refs[k]
    _need(n == seeds and n > 0, "ROBUSTNESS_COVERAGE", str(n))
    for k, m in regions.items():
        rb = {"perturbation_hits": hits[k], "perturbation_seeds": n, "perturbation_fraction": _r(hits[k] / n, 4)}
        for alt in ROBUST_ALTS:
            kept = sorted(set(m) & set(prof[alt]["U"]))
            if kept:
                an = region_seat_name(kern[alt], prof[alt], kept, classes, region_name(kern[alt], prof[alt], kept, classes)[0])
                rb[alt] = {"label": n3_label(an), "holds": an == refs[k], "members_in_that_universe": len(kept)}
            else:
                rb[alt] = {"label": None, "holds": None, "reason": "NOT_IN_THAT_UNIVERSE"}
        recs[k]["robustness_n3"] = rb
    # set-level fit: gs-1 regions vs THIS lane's derived regions and the corpus's origin labels
    labels = {}
    for c in classes:
        for th in N2R_THETAS:
            t = art["territories"][c][f"standing_me|ratio|{th}"]
            if t["status"] == "ok":
                labels[f"exit-share:{c}:{th}"] = t["members"]
        o = sorted(set(voc["label_sets"]["hubs"][f"submission-origin:{c}"]["nodes"]) & U)
        if o:
            labels[f"origin:{c}"] = o
    for lab in sorted({r["name_n3"]["label"] for r in art["hubs"].values()} - {None}):
        labels[f"n3:{lab}"] = sorted(h for h, r in art["hubs"].items() if r["name_n3"]["label"] == lab)
    for k, r in art["tv_regions"]["regions"].items():
        labels[k] = r["members"]
    fit = score_pairs(sorted(U), regions, labels, {h: pr["mu_mass"][h] for h in U})
    best = {}
    for row in fit["scores"]:
        if row["status"] == "ok" and row["bh_reject"] and row["counts"]["intersection"] > 0:
            cur = best.get(row["region"])
            if cur is None or (row["f1"], row["label"]) > (cur["f1"], cur["label"]):
                best[row["region"]] = {"label": row["label"], "f1": _r(row["f1"], 4), "precision": _r(row["precision"], 4),
                                       "recall": _r(row["recall"], 4), "q_bh": _g(row["q_bh"])}
    for k in recs:
        recs[k]["best_fit_label"] = best.get(k)
    # NMI / purity: gs-1's partitions, gs-3's TV regions and this lane's name partitions
    mu = {h: pr["mu_mass"][h] for h in U}
    parts = {"map_modules": {h: k for k, m in modules.items() for h in m},
             "phase": {h: ("guard" if h in set(sp["phase"]["guard_side_hubs"]) else "passed") for h in U},
             "phase_sign": {h: ("guard" if h in set(sp["phase_sign"]["guard_side_hubs"]) else "passed") for h in U},
             "localized": {h: ("loc" if h in set(sp["localized"]["hubs"]) else "rest") for h in U},
             "tv_regions": {h: k for k, r in art["tv_regions"]["regions"].items() for h in r["members"]},
             "names_n2r": {h: (art["hubs"][h]["best_name"] or "UNNAMED") for h in U},
             "names_n3": {h: (art["hubs"][h]["name_n3"]["label"] or "UNNAMED") for h in U},
             "leg_territory_R2": {h: ("R_LEG(2)" if h in set(art["territories"]["LEG"]["standing_me|ratio|2.0"]["members"]) else "rest") for h in U}}
    table = {}
    for x in parts:
        for y in parts:
            if x < y:
                table[f"{x} ~ {y}"] = {"nmi": _r(partition_nmi(parts[x], parts[y]), 4),
                                        "nmi_mu": _r(partition_nmi(parts[x], parts[y], mu), 4),
                                        "purity_mu_x_in_y": _r(partition_purity(parts[x], parts[y], mu), 4),
                                        "purity_mu_y_in_x": _r(partition_purity(parts[y], parts[x], mu), 4)}
    theirs = T["vs_exit_tv_territories"][GS1_CASE]
    repro = {k: {"gs1": _r(theirs[k2]["nmi"], 6), "here": _r(partition_nmi(parts[k], parts["tv_regions"]), 6),
                 "purity_gs1": _r(theirs[k2]["purity_mu_ours_in_theirs"], 6),
                 "purity_here": _r(partition_purity(parts[k], parts["tv_regions"], mu), 6)}
             for k, k2 in (("map_modules", "map_modules"), ("phase", "phase"), ("phase_sign", "phase_sign"),
                           ("localized", "localized"))}
    return {"schema": "graph-semantics.naming-gs1.v1",
            "which_game": art["which_game"], "configuration": art["configurations"]["primary"],
            "recompute": "python3 -B scripts/semantics/naming.py --gs1",
            "sources": {"territories.json": hashlib.sha256(t_raw).hexdigest(), "naming.json": hashlib.sha256(a_raw).hexdigest(),
                        "gs1_case": GS1_CASE, "gs1_item": T["meta"].get("item")},
            "source_sha256": producer_sha256(),
            "status": "gs-1 T2R ACCEPTED by the lead (gs-shared.md §8); every number here is keyed to the territories.json sha256 above.",
            "selfcheck": selfcheck_result,
            "definitions": {"region_name": "the N2R pooled rule, then the N3 refine-only seat rule, on the start law uniform over the region's hubs (seats and turns).",
                            "robustness": f"fixed member sets; K.perturbed({eps}, {eps}, seed), seeds 0..{seeds - 1}; plus origin=False, shipped rule, gi (members intersected with that universe).",
                            "fit": "score_pairs (hypergeometric + whole-family BH, EXPLORATORY); labels = this lane's R_C(theta), N3 named sets, gs-3 TV regions, canonical-origin hubs; best = highest F1 among BH-rejecting pairs.",
                            "nmi": "arithmetic normalisation over the 122 universe hubs; nmi_mu weights hubs by Q-process mu; purity_mu_x_in_y = sum over x-blocks of the largest mu overlap with a y-block."},
            "coverage": {"regions": len(regions), "modules": len(modules), "universe_hubs": len(U),
                         "perturbations": n, "fit_pairs": fit["coverage"]["pairs_tested"], "partitions": len(parts),
                         "naming_json_max_share_diff": _g(dev, 3)},
            "regions": recs,
            "seat_split": {"proposition_6_max_pooled_diff": _g(prop6, 3), "sides": seat_rec},
            "nmi_purity": table,
            "reproduces_gs1_vs_tv": repro,
            "fit_coverage": fit["coverage"]}


# --------------------------------------------------------------------------- #
# N4 — the glossary for grapplers and the copy rules, as DATA with validators
# --------------------------------------------------------------------------- #
# Every entry: a sentence a black belt understands, the precise definition with its set, and where
# it is computed. `keys` are the phrases that mark a USE of the term; validate_glossary() refuses an
# entry whose text uses a term defined LATER, and resolves every cited script, symbol and JSON path.
N = "tests/artifacts/semantics/"
GLOSSARY = (
    {"term": "position and seat", "keys": ("position", "seat"),
     "grappler": "A position is a place like mount; it has two seats, top and bottom, and the maths always tracks which seat you are in.",
     "precise": "A position is a hub h (133 authored); a seat is one of its two role-nodes h/top, h/bottom (266). Only role-nodes carry techniques; hubs aggregate them.",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "self.role_nodes"),),
     "refs": ((N + "vocabulary.json", ("position_hubs", "back-control")), (N + "vocabulary.json", ("position_role_nodes", "back-control/top")))},
    {"term": "state (whose move it is)", "keys": ("state",),
     "grappler": "Mount-your-move and mount-their-move are different situations, so each is its own state.",
     "precise": "A transient state is (my seat, my move | their move), always written from MY side: 532 states (266 seats x 2).",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "self.labels"),),
     "refs": ((N + "scalars.json", ("states", "nogi/symmetric/shipped/origin=on", "set_definition")),)},
    {"term": "step", "keys": ("step", "steps"),
     "grappler": "One step is one technique attempt by whoever's move it is.",
     "precise": "One card: the mover draws a technique by its authored attempt share, it succeeds with its success rate, and one authored outcome cell of that branch decides where the pair lands (the kernel's cell table).",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "CELL_DTYPE"),),
     "refs": ((N + "territories.json", ("meta", "units", "step")),)},
    {"term": "initiative rule (shipped vs player-neutral)", "keys": ("initiative", "player-neutral", "shipped rule"),
     "grappler": "After a technique works, who moves next? In the app's version the player keeps the move after a success and the opponent never does; the player-neutral version lets whoever succeeded keep it.",
     "precise": "shipped: my success keeps my move, their card always hands the move back; symmetric (player-neutral, the headline): whoever's card succeeds keeps the move, which makes the game exactly symmetric under swapping the players.",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "initiative not in"),),
     "refs": ((N + "naming.json", ("configurations", "primary", "initiative")),)},
    {"term": "ply", "keys": ("ply", "plies"),
     "grappler": "A ply is one technique attempt as the kernel counts time, except that a missed attempt which leaves you exactly where you were costs nothing. The app's own move counter counts differently, so a ply is not one of its moves.",
     "precise": "A step that costs 1 on the kernel's horizon (K.Q1); the kernel's stay-put miss cells (K.Q0) cost 0 plies, so steps >= plies, with equality under the player-neutral initiative rule, which has no stay-put cells. The app's move count (moveCount) is a different count: it charges 2 for my missed submission and 0 for their finish attempt, for example (app_game.py).",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/app_game.py"),
     "symbols": (("scripts/semantics/_kernel.py", "self.Q0"), ("scripts/semantics/app_game.py", "my MISSED submission")),
     "refs": ((N + "territories.json", ("meta", "units", "ply")),)},
    {"term": "roll, decided roll, draw", "keys": ("roll", "rolls", "decided", "draw"),
     "grappler": "A roll is one round from the start until somebody taps; 'rolls that end' means rolls that end in a submission.",
     "precise": "A run of the absorbing chain until W (I finish them), L (they finish me) or D (a draw: an optionless hand, which no roll started on the feet ever meets when rolls are left to run); a decided roll ends in W or L.",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/scalars.py"), "symbols": (("scripts/semantics/_kernel.py", "def absorption"),),
     "refs": ((N + "scalars.json", ("states", "nogi/symmetric/shipped/origin=on", "columns")),)},
    {"term": "frame (gi / no-gi)", "keys": ("frame", "gi", "no-gi"),
     "grappler": "Gi and no-gi are two different games on the same positions, each with its own attempt shares and success rates.",
     "precise": "Two chains on the same 532 states that differ only in attempt shares, success rates (133 dealt techniques fork) and the 62 no-gi null cells; the headline is no-gi. rates='shipped' prices both at the folded no-gi rate, rates='frame' uses the gi rate in gi.",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "def card_p"),),
     "refs": ((N + "naming.json", ("gi_vs_nogi", "baselines")),)},
    {"term": "origin filter", "keys": ("origin filter", "origin=false"),
     "grappler": "A technique is dealt only from the position it is written for, even where other positions also list it; that throws away about half of the listed attempt entries.",
     "precise": "build_hand / optionsFor deal a listed card only at its canonical origin (fromPositionId): 48.4% of authored role-matching attempt points dropped and 41 techniques orphaned in no-gi; origin=False deals every listing (the comparison run).",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/flux.py"), "symbols": (("scripts/semantics/_kernel.py", "def _origin_census"),),
     "refs": ((N + "flux_origin.json", ("restore",)),)},
    {"term": "the corpus's game vs the app's game", "keys": ("corpus's game", "app's game"),
     "grappler": "The corpus's game is the sport as the written content describes it, both players choosing the way the curriculum says; the app's game is the harder product version the player actually faces.",
     "precise": "corpus's game = the kernel: both seats sample the authored attempt shares with the origin filter on, no resistance, no horizon unless stated; app's game = the app's opponent rule, escape resolution, aiMod resistance and move limit on top (P(I finish) for a roll started on the feet 0.7225 -> 0.3489, no-gi, shipped initiative).",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/app_game.py"), "symbols": (("scripts/semantics/app_game.py", "def main"),),
     "refs": ((N + "naming.json", ("which_game",)),),
     "note": "app_game.py prints its layer table (optional --json <path>); it writes no committed artifact. Doc section 1.3."},
    {"term": "the clock (H = inf vs clocked)", "keys": ("the clock", "clocked", "h = inf", "h = ∞"),
     "grappler": "Most numbers let a roll run until someone taps; clocked numbers stop it after 9 to 12 plies, the app's clock length. The app's own move clock is a different count.",
     "precise": "H = inf is absorption with no horizon; 'clocked' is the uniform mixture over H in {9, 10, 11, 12} plies (the app's clock length, maxMoves) of P(ends within H plies), computed by the kernel's finite-horizon recursion (gated against the repo's existing value solver). It is not the app's own move clock, which counts the app's move count (moveCount) and ends a roll only on some moves (app_game.py).",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/scalars.py", "scripts/semantics/app_game.py"),
     "symbols": (("scripts/semantics/_kernel.py", "def finite_horizon"), ("scripts/semantics/app_game.py", "THE CLOCK")),
     "refs": ((N + "naming.json", ("territories", "LEG", "standing_me|ratio|2.0", "headline", "x_clocked")),)},
    {"term": "finish class (body region)", "keys": ("finish class", "body region"),
     "grappler": "Every submission is sorted by what it attacks: leg, arm, shoulder, neck (choke), spine, hip/groin.",
     "precise": "The lexicon maps each of the 290 submission attackers to exactly one class by its structured type + targetArea, never its name: LEG 74, ARM 36, SHOULDER 63, CHOKE 105, SPINE/COMPRESSION 9, HIP/GROIN 3.",
     "scripts": ("scripts/semantics/vocabulary.py",), "symbols": (("scripts/semantics/vocabulary.py", "LEXICON = ("),),
     "refs": ((N + "vocabulary.json", ("techniques", "armbar-from-mount/attacker", "body_region", "class")), (N + "vocabulary.json", ("class_counts",)))},
    {"term": "start law and the standing baseline", "keys": ("start law", "baseline", "from standing"),
     "grappler": "Every number starts somewhere; 'from standing' means on the feet with me to move, and that is the average every place is compared with.",
     "precise": "A distribution over states where rolls begin: standing = K.start('standing', 'me'); a position's own start is uniform over its 4 states (2 seats x 2 moves); the baseline b_C is the class-C share of decided rolls from standing.",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/naming.py"), "symbols": (("scripts/semantics/_kernel.py", "def start"),),
     "refs": ((N + "naming.json", ("baselines", "primary", "standing_me")),)},
    {"term": "reachable universe", "keys": ("reachable", "universe"),
     "grappler": "Positions a roll that starts on the feet can never get to are left out and said to be unreachable, never scored as zero.",
     "precise": "Seats reachable from the standing seeds in the configuration's kernel (244 no-gi, 266 gi); naming's universe is the 122 no-gi positions with both seats reachable, and the other 11 are 'not reachable from standing'.",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/naming.py"), "symbols": (("scripts/semantics/_kernel.py", "def _reach"),),
     "refs": ((N + "naming.json", ("not_evaluable", "lapel-guard")),)},
    {"term": "perturbation robustness and the four facts", "keys": ("perturbation", "four facts", "robust"),
     "grappler": "The authored numbers are estimates, so every claim about one place is re-tested on 200 slightly different versions of them and under three alternative model choices.",
     "precise": "A claim's robustness is the fraction of K.perturbed(0.2, 0.2, seed), seeds 0..199 (log attempt shares and logit success rates jittered, landing cells fixed) in which it still holds, plus whether it holds with origin=False, under the other initiative rule and in the other frame: four facts, never a probability of being right.",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/naming.py"), "symbols": (("scripts/semantics/_kernel.py", "def perturbed"),),
     "refs": ((N + "naming.json", ("hubs", "back-control", "robustness_n3")), (N + "scalars.json", ("definitions", "robustness")))},
    {"term": "committor", "keys": ("committor",),
     "grappler": "From here, what are the chances that I am the one who finishes?",
     "precise": "q(s) = P(I finish them before they finish me | the roll starts at state s), no horizon; q-bar is the average of a seat's two states (my move, their move).",
     "scripts": ("scripts/semantics/scalars.py",), "symbols": (("scripts/semantics/scalars.py", "q_W"),),
     "refs": ((N + "scalars.json", ("definitions", "q_W")), (N + "scalars.json", ("definitions", "q_bar")))},
    {"term": "tempo", "keys": ("tempo",),
     "grappler": "How fast rolls from here end.",
     "precise": "Expected plies (and steps) to the end of the roll from a state.",
     "scripts": ("scripts/semantics/scalars.py",), "symbols": (("scripts/semantics/scalars.py", "E_plies"),),
     "refs": ((N + "scalars.json", ("tempo", "nogi/symmetric/shipped/origin=on")), (N + "scalars.json", ("definitions", "E_plies")))},
    {"term": "exit law (harmonic measure) and class share", "keys": ("exit law", "harmonic measure", "class share", "rolls that end"),
     "grappler": "The full list of ways rolls from here end (which submission, by which player, how often); 'of the rolls that end, 38% end in a leg lock' is one line of it.",
     "precise": "E_s(c) = P(the roll from state s ends by finisher column c = (finishing technique, who)), the rows of (I - Q)^-1 R_fin; the class share s_C(nu) = nu.h_C / nu.d is the class-C share of decided rolls from start law nu.",
     "scripts": ("scripts/semantics/_kernel.py", "scripts/semantics/naming.py"), "symbols": (("scripts/semantics/_kernel.py", "def exit_law"), ("scripts/semantics/naming.py", "def start_share")),
     "refs": ((N + "naming.json", ("hubs", "back-control", "share")), (N + "geometry.json", ("definitions", "exit_law")))},
    {"term": "exit-law TV", "keys": ("exit-law tv", "total variation"),
     "grappler": "How differently two places end: 0 means no question about the ending can tell them apart, 1 means they never end the same way.",
     "precise": "TV(E_x, E_y) = half the sum of |E_x - E_y| over (seat x raw submission type) plus draw; it is exactly the largest difference the two places give to any event about the ending (gs-3 Proposition 1).",
     "scripts": ("scripts/semantics/geometry.py",), "symbols": (("scripts/semantics/geometry.py", "exit_tv"),),
     "refs": ((N + "geometry.json", ("definitions", "exit_tv")), (N + "geometry.json", ("cases", "nogi/symmetric/shipped", "clusterings", "exit_tv")))},
    {"term": "enrichment", "keys": ("enrichment", "times as likely", "x the standing"),
     "grappler": "How many times more likely this ending is here than from standing.",
     "precise": "E_C(h) = s_C(h) / b_C; it can never exceed 1/b_C, so chokes (b = 46.4% in no-gi) cannot pass 2.15x; the odds ratio is reported as an alternative.",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def enrichment"),),
     "refs": ((N + "naming.json", ("hubs", "back-control", "enrichment")),)},
    {"term": "territory R_C(theta)", "keys": ("territory", "territories"),
     "grappler": "Leg-lock territory is the set of places from which leg locks end rolls at least twice as often as from standing.",
     "precise": "R_C(theta) = the reachable positions with E_C >= theta, theta in {1.5, 2, 3}; IMPOSSIBLE when theta.b_C > 1, EMPTY when attainable but not attained.",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def territory"),),
     "refs": ((N + "naming.json", ("territories", "LEG", "standing_me|ratio|2.0", "members")), (N + "naming.json", ("territories", "CHOKE", "standing_me|ratio|3.0", "status")))},
    {"term": "core and halo", "keys": ("core", "halo"),
     "grappler": "The core of leg-lock territory is where a leg lock is actually on the menu; the halo is nearby places that only inherit a leg-lock share by leading into the core.",
     "precise": "core_C = the states whose own hand finishes in class C within one card (directly or via a chained submission); by the maximum principle (gs-5 N2R Propositions 1-3, gs-2 Proposition C) a class share peaks on the core and a halo state gets at most P(reach core) x the best core value.",
     "scripts": ("scripts/semantics/naming.py", "scripts/semantics/scalars.py"), "symbols": (("scripts/semantics/naming.py", "def halo_decomposition"),),
     "refs": ((N + "naming.json", ("max_principle", "primary", "LEG")), (N + "naming.json", ("territories", "LEG", "standing_me|ratio|2.0", "halo")))},
    {"term": "seat share vs pooled share", "keys": ("pooled", "seat share", "started on top", "per-player"),
     "grappler": "'Pooled' counts a finish whoever does it; the seat share asks whether it was the player who started on top or the one who started underneath.",
     "precise": "S^sigma_C = P(class-C finish by the player who STARTED on seat sigma at this position | decided); S^TOP + S^BOTTOM = the pooled share; the per-player baseline is b_C / 2.",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def seat_split"),),
     "refs": ((N + "naming.json", ("hubs", "back-control", "seat_share")), (N + "naming.json", ("seat_names", "baseline_per_player")))},
    {"term": "name and middle game", "keys": ("middle game", "named", "unnamed"),
     "grappler": "A place gets a name only when one ending is both twice as common as from standing and at least five points more common; everywhere else is middle game, where rolls end the way they end everywhere.",
     "precise": "Pooled name = the class with the largest enrichment among those with E_C >= 2 and s_C - b_C >= 0.05; the seat rule refines it (BOTH / TOP / BOTTOM / SHARED) or gives an unnamed position 'C for the sigma player' when one seat passes the same gates against b_C / 2; no passing class = middle game (76 of the 122 reachable positions).",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def seat_aware_name"),),
     "refs": ((N + "naming.json", ("hubs", "back-control", "name_n3")), (N + "naming_cards.json", ("hubs", "half-guard", "sentence")))},
    {"term": "set fit (precision, recall, F1, q)", "keys": ("precision", "recall", "f1", "set fit"),
     "grappler": "How well a derived region matches a set the corpus already names, such as the positions that list a leg lock.",
     "precise": "For region R and label set S inside the universe: precision |R and S|/|R|, recall |R and S|/|S|, F1, lift, and a hypergeometric upper-tail p with Benjamini-Hochberg q over the whole family: exploratory, because graph-derived sets are dependent.",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def score_pairs"),),
     "refs": ((N + "naming.json", ("fit", "primary", "summary", "R:LEG:2.0")),)},
    {"term": "the Yaglom limit", "keys": ("yaglom", "outlasts"),
     "grappler": "The clock only ever takes finishes away, and a roll that outlasts it is a coin toss.",
     "precise": "0 <= q(s) - V_H(s) <= P_s(roll longer than H) (gs-2 Proposition B); under the player-neutral rule P(I finish | the roll outlasts H) -> exactly 1/2 at every state as H grows (Proposition F; 0.697 under the shipped rule).",
     "scripts": ("scripts/semantics/scalars.py",), "symbols": (("scripts/semantics/scalars.py", "yaglom"),),
     "refs": ((N + "scalars.json", ("clock", "nogi/symmetric/shipped/origin=on", "yaglom_prop_F")),)},
    {"term": "Q-process and a long fight's time", "keys": ("q-process", "long fight"),
     "grappler": "Imagine a fight that never ends: the Q-process is where such a fight spends its time.",
     "precise": "The chain conditioned never to finish, on the states reachable from standing (Perron vectors of Q); mu = its stationary law, and 'a long fight's time' in a set = its mu mass.",
     "scripts": ("scripts/semantics/_kernel.py",), "symbols": (("scripts/semantics/_kernel.py", "def qprocess"),),
     "refs": ((N + "naming.json", ("hubs", "half-guard", "mu_time")), (N + "territories.json", ("configs", "nogi/symmetric/origin-on", "spectrum", "hub", "lambda2_R")))},
    {"term": "residence", "keys": ("residence", "holding", "sojourn"),
     "grappler": "Once the fight is in a region, how many steps it stays before leaving.",
     "precise": "For a set S of the Q-process: holding h(S) = P(still in S next step | in S), exit rate e(S) = 1 - h(S), residence r(S) = 1/e(S) steps; the real-roll sojourn is measured on the actual (killable) roll from standing.",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/_territory_audit.py", "def set_statistics"),),
     "refs": ((N + "territories.json", ("configs", "nogi/symmetric/origin-on", "splits", "phase", "levels", "hub", "residence_steps")), (N + "territories.json", ("configs", "nogi/symmetric/origin-on", "real_roll_sojourn", "localized")))},
    {"term": "relaxation time and lambda*", "keys": ("relaxation", "lambda*"),
     "grappler": "How quickly the fight forgets which side of a divide it started on.",
     "precise": "For a split S | S-complement of the Q-process, lambda*(S) = h(S) + h(S-complement) - 1 is the two-block chain's non-unit eigenvalue; tau_lin = 1/(1 - lambda*) is exactly half the harmonic mean of the two residences (gs-1 P2').",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/_territory_audit.py", "def set_statistics"),),
     "refs": ((N + "territories.json", ("configs", "nogi/symmetric/origin-on", "splits", "phase", "levels", "hub", "two_block_eigenvalue")), (N + "territories.json", ("configs", "nogi/symmetric/origin-on", "splits", "phase", "levels", "hub", "tau_lin_steps")))},
    {"term": "no trap (the certificate)", "keys": ("no trap", "certificate", "cheeger"),
     "grappler": "No part of the map gets a roll stuck: no region holding at most half the fight keeps it much longer than eight steps.",
     "precise": "lambda*(S) <= lambda_2 of the additive reversibilisation (P + P*)/2 of the Q-process, so no set of its states with mu(S) <= 1/2 has residence above 1/((1 - lambda_2)(1 - mu(S))): 7.7-8.5 steps across the five configurations.",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/territories.py", "cheeger"),),
     "refs": ((N + "territories.json", ("configs", "gi/shipped/origin-on", "spectrum", "state", "cheeger_ceiling_residence")),
              (N + "territories.json", ("configs", "nogi/symmetric/origin-on", "spectrum", "state", "cheeger_ceiling_residence")))},
    {"term": "seat split and phase split", "keys": ("seat split", "phase split", "phase"),
     "grappler": "The two slowest divides in the map are 'who is on top' and 'are we still in the guard or standing game, or already passed and pinned'.",
     "precise": "Seat split = every /bottom seat vs every /top seat; phase split = the union of positions maximising lambda* with both sides holding mu >= 0.1 (guard/standing 64 positions vs passed/pinned 58); under the player-neutral rule the two are exactly orthogonal slow modes.",
     "scripts": ("scripts/semantics/territories.py", "scripts/semantics/naming.py"), "symbols": (("scripts/semantics/naming.py", "def run_gs1"),),
     "refs": ((N + "territories.json", ("configs", "nogi/symmetric/origin-on", "splits", "phase", "guard_side_hubs")), (N + "naming_gs1.json", ("seat_split", "proposition_6_max_pooled_diff")))},
    {"term": "the localized leg set", "keys": ("localized",),
     "grappler": "The most self-contained region of the map is a 14-position leg-entanglement cluster: rarely entered, but half the spells in it end the roll there.",
     "precise": "The lighter side of the unconstrained lambda* optimum: 14 positions, lambda* 0.6768, entered by 2.8% of rolls from standing, 48% of its spells ending the roll.",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/territories.py", "localized"),),
     "refs": ((N + "territories.json", ("configs", "nogi/symmetric/origin-on", "splits", "localized", "hubs")), (N + "naming_gs1.json", ("regions", "localized:localized", "name_n3")))},
    {"term": "metastable decomposition (G-PCCA+)", "keys": ("g-pcca", "metastable"),
     "grappler": "An attempt to carve the map into a few regions that each hold the fight: it finds only one soft region, the leg entanglements, and the rest of the map is one piece.",
     "precise": "G-PCCA+ fuzzy k-block decomposition of the position-lumped Q-process from its real Schur vectors, blocks by argmax membership. At k = 2 the lighter block is an 11-position leg-entanglement cluster (a different set from the localized leg set) with fuzzy memberships, self-overlap 0.15, while the rest of the map is one block of 111 positions holding 92% of the mass crisply (membership >= 0.9); the decomposition's crispness, 0.54, is the mean of the two self-overlaps. At every computable k from 3 to 8 (k = 7 would split a complex-conjugate Schur pair), at most 0.7% of the mass is held crisply.",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/_territory_methods.py", "gpcca"),),
     "refs": ((N + "territories.json", ("configs", "nogi/symmetric/origin-on", "gpcca_k2_blocks")),
              (N + "territories.json", ("configs", "nogi/symmetric/origin-on", "gpcca", "hub")))},
    {"term": "map-equation module", "keys": ("module", "map equation", "map-equation"),
     "grappler": "Grouping positions so that describing where the fight goes takes the fewest words: a module is a set the fight moves around inside before leaving it.",
     "precise": "The two-level map equation (Rosvall-Bergstrom) minimised on the position-lumped Q-process: 40 modules, 3.73 against 4.36 bits per step for one module (a 14.5% saving).",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/_territory_methods.py", "def "),),
     "refs": ((N + "territories.json", ("map_equation", "nogi/symmetric/origin-on", "module_table")), (N + "naming_gs1.json", ("regions", "module:M17 inside-ashi-garami", "name_n3")))},
    {"term": "road (border-crossing technique)", "keys": ("road", "border-crossing", "crossing"),
     "grappler": "The techniques that carry the fight from one module to another: passes, pin-to-pin transitions, escapes, back takes.",
     "precise": "A technique whose success lands in a different module from its origin position's, weighted by its Q-process stationary flow (2.65 expected crossings per roll from standing).",
     "scripts": ("scripts/semantics/territories.py",), "symbols": (("scripts/semantics/territories.py", "technique_territories"),),
     "refs": ((N + "territories.json", ("technique_territories", "nogi/symmetric/origin-on", "top")),)},
    {"term": "diffusion distance and commute time", "keys": ("diffusion", "commute"),
     "grappler": "How far apart two places are by how the fight moves between them, rather than by how it ends.",
     "precise": "Diffusion distance D_t on the mu-weighted position lump of the Q-process after t in {1, 2, 4} steps; commute time m(x,y) + m(y,x) in steps.",
     "scripts": ("scripts/semantics/geometry.py",), "symbols": (("scripts/semantics/geometry.py", "diffusion"),),
     "refs": ((N + "geometry.json", ("definitions", "diffusion")), (N + "geometry.json", ("definitions", "commute")))},
    {"term": "NMI and purity", "keys": ("nmi", "purity"),
     "grappler": "How much two ways of carving the map agree.",
     "precise": "Normalised mutual information (arithmetic normalisation) between two labelings of the same positions; mu-purity of A in B = the sum over A's blocks of the largest mu overlap with one B block.",
     "scripts": ("scripts/semantics/naming.py",), "symbols": (("scripts/semantics/naming.py", "def partition_nmi"),),
     "refs": ((N + "naming_gs1.json", ("nmi_purity", "map_modules ~ tv_regions")),)},
    {"term": "passage", "keys": ("passage",),
     "grappler": "The share of the rolls I win, or lose, that ever pass through a place: side control on top is in 59.6% of the rolls I win and 28.7% of those I lose.",
     "precise": "P(I finish AND the roll ever visits set C) / P(I finish), from standing (me first), no horizon; exact by redirecting C's mass to a marked exit (Woodbury on one fundamental matrix).",
     "scripts": ("scripts/semantics/flux.py", "scripts/semantics/_tpt.py"), "symbols": (("scripts/semantics/_tpt.py", "def avoid_probabilities"),),
     "refs": ((N + "flux.json", ("configs", "headline", "passage_roles")),)},
    {"term": "reactive current", "keys": ("reactive current", "winning current", "current"),
     "grappler": "The net flow of winning rolls along each technique: how much of 'I finish' moves across it after cancelling rolls that come back.",
     "precise": "f_ij = g_i Q_ij h_j with g the expected visits from the start and h the committor; the net current is max(f_ij - f_ji, 0), and its throughput equals P(I finish) (gs-4 Proposition c).",
     "scripts": ("scripts/semantics/_tpt.py", "scripts/semantics/flux.py"), "symbols": (("scripts/semantics/_tpt.py", "def reactive_flux"),),
     "refs": ((N + "flux.json", ("configs", "headline", "flux", "W", "probability")),)},
    {"term": "choke point (minimum cut) and the finishing layer", "keys": ("choke point", "minimum cut", "finishing layer"),
     "grappler": "A choke point would be a set of moves every winning roll must cross; in the corpus's game the only one is the finish itself.",
     "precise": "A minimum cut of the net winning current; its support is one strongly connected component holding both standing seeds, so the only admissible minimum cut is the finishing layer (gs-4 Theorem d): no interior choke point exists.",
     "scripts": ("scripts/semantics/flux.py",), "symbols": (("scripts/semantics/_tpt.py", "def min_cut"),),
     "refs": ((N + "flux.json", ("configs", "headline", "flux", "W", "cut_capacity_equals_probability")), (N + "flux.json", ("configs", "headline", "flux", "W", "scc")))},
    {"term": "sensitivity (traffic x leverage)", "keys": ("sensitivity", "leverage", "traffic"),
     "grappler": "Which written success rate matters most: how often the technique is played times how much a hit is worth over a miss.",
     "precise": "dP(I finish)/dp_t = E[plays of t per roll] x the play-weighted mean of (A - B), A and B the committors after success and after a miss; exact by one adjoint solve.",
     "scripts": ("scripts/semantics/flux.py",), "symbols": (("scripts/semantics/_tpt.py", "def committor_gradient"),),
     "refs": ((N + "flux.json", ("configs", "headline", "grad_me_top30")),)},
    {"term": "advantage A-inf (the policy gradient) vs EDGE", "keys": ("a-inf", "edge", "policy gradient", "advantage"),
     "grappler": "How much better one move is than your usual choice here: A-inf assumes you keep playing like the corpus, EDGE assumes you play perfectly afterwards.",
     "precise": "A-inf(s,a) = q_after(s,a) - q(s) is exactly the policy gradient at s (gs-4 Proposition b2); EDGE = 100 (Q(s,a) - sum_b pi_b Q(s,b)) on an 11-ply, lambda = 2, argmax-continuation Q; both average to zero over a hand, so only the order within one hand means anything.",
     "scripts": ("scripts/semantics/flux.py", "scripts/solve_edge_values.py"), "symbols": (("scripts/solve_edge_values.py", "def solve"),),
     "refs": ((N + "flux.json", ("edge_bridge", "within_hand")),)},
    {"term": "FLOW", "keys": ("flow ranking", "solve_flow"),
     "grappler": "The FLOW ranking is the app's what-to-drill-next list: which deck, if you got better at it, would raise your finish rate most.",
     "precise": "solve_flow's adjoint gradient of P(W) - 2 P(L) over 11 plies, from a uniform start over live seats, in my deck-mastery parameters: exactly the clocked, lambda-weighted, drill-parameterised instance of the sensitivity (the whole vector reproduced to machine precision, <= 3e-16).",
     "scripts": ("scripts/solve_flow.py", "neural/src/flow.src.js", "scripts/semantics/flux.py"), "symbols": (("scripts/solve_flow.py", "def adjoint"),),
     "refs": ((N + "flux.json", ("flow_bridge", "nogi", "reproduction_max_abs_diff")),)},
)


def _text_uses(text, key):
    k = re.escape(key.lower())
    return re.search(r"(?<![a-z0-9])" + k + r"(?![a-z0-9])", text.lower()) is not None


def validate_glossary(glossary=GLOSSARY, root=ROOT):
    """(1) no entry uses a term defined LATER (its keys, word-bounded, in grappler or precise text);
    (2) every script exists and every cited symbol is present in its file; (3) every JSON ref
    resolves to a present key path. Returns coverage; refuses on any failure."""
    seen = set()
    bad_order, missing = [], []
    for i, e in enumerate(glossary):
        _need(e["term"] not in seen, "GLOSSARY_DUPLICATE", e["term"])
        seen.add(e["term"])
        text = e["grappler"] + " " + e["precise"]
        for later in glossary[i + 1:]:
            for key in later["keys"]:
                own = any(_text_uses(k2, key) or _text_uses(key, k2) for k2 in e["keys"])
                if not own and _text_uses(text, key):
                    bad_order.append(f"{e['term']!r} uses {key!r}, defined later in {later['term']!r}")
    refs = scripts = symbols = 0
    cache = {}
    for e in glossary:
        for sc in e["scripts"]:
            scripts += 1
            if not (root / sc).exists():
                missing.append(f"script {sc}")
        for path, sym in e.get("symbols", ()):
            symbols += 1
            if sym not in (root / path).read_text():
                missing.append(f"symbol {sym!r} in {path}")
        for path, keys in e["refs"]:
            refs += 1
            if path not in cache:
                cache[path] = json.loads((root / path).read_text())
            node = cache[path]
            for k in keys:
                if isinstance(node, dict) and k in node:
                    node = node[k]
                else:
                    missing.append(f"{path} -> {keys}")
                    break
    _need(not bad_order, "GLOSSARY_ORDER", "; ".join(bad_order[:8]))
    _need(not missing, "GLOSSARY_UNRESOLVED", "; ".join(missing[:8]))
    _need(len(glossary) >= 20 and refs > 0 and scripts > 0, "GLOSSARY_COVERAGE", f"{len(glossary)} terms")
    return {"terms": len(glossary), "json_refs_resolved": refs, "scripts_found": scripts, "symbols_found": symbols,
            "order_pairs_checked": sum(len(glossary) - i - 1 for i in range(len(glossary)))}


def render_glossary(glossary=GLOSSARY):
    out = []
    for i, e in enumerate(glossary, 1):
        refs = "; ".join(f"`{p.split('/')[-1]}` -> " + "".join(f'["{k}"]' for k in ks) for p, ks in e["refs"])
        where = ", ".join(f"`{s}`" for s in e["scripts"])
        out.append(f"{i}. **{e['term']}**\n   - *For a grappler:* {e['grappler']}\n   - *Precisely:* {e['precise']}\n"
                   f"   - *Computed:* {where}; {refs}" + (f". {e['note']}" if e.get("note") else "") + "\n")
    return "\n".join(out)


# The copy rules for ANY in-app sentence built on this research. `check`: "text" (a regex over the
# sentence), "context" (needs the sentence's configuration / robustness), "construction" (enforced by
# CardText when the sentence is generated), "review" (a human check; the breaking example shows how).
COPY_RULES = (
    {"id": "R01-which-game", "check": "text",
     "rule": "Every sentence says which game it describes: 'in the corpus's game', or 'in the app's game' for numbers computed with app_game.py.",
     "reason": "The two games differ a lot: P(I finish) from standing is 0.7225 in the corpus's game and 0.3489 in the app's game (no-gi, shipped initiative; doc 1.3, app_game.py).",
     "breaks": "From standing you finish 72% of your rolls.",
     "complies": "In the corpus's game (no-gi, shipped initiative), 72.3% of the rolls that end from standing end with my finish, with no clock."},
    {"id": "R02-no-promises", "check": "text",
     "rule": "Describe how rolls end among the rolls the corpus describes; never promise the reader an outcome ('you will', 'you should', 'guaranteed').",
     "reason": "Every figure is a probability over the corpus's population of rolls, and the app's opponent plays differently (R01); a share is not a forecast for one player.",
     "breaks": "Get to side control and you will win.",
     "complies": "In the corpus's game (no-gi), side control on top is in 59.6% of the rolls I win and 28.7% of the rolls I lose."},
    {"id": "R03-share-of-what", "check": "text",
     "rule": "Every percentage names its population: of the rolls that end, of the rolls I win or lose, of all endings, or of a long fight's time.",
     "reason": "A bare percentage is ambiguous between decided rolls, all rolls, clocked rolls and time share, and these differ (38.0% of decided rolls vs 2.9% of a long fight's time for leg-lock territory; naming.json territories).",
     "breaks": "Leg locks here: 38%.",
     "complies": "In the corpus's game (no-gi), 38.0% of the rolls that end from these positions end in a leg lock, vs 6.6% from standing."},
    {"id": "R04-territory-carries-its-number", "check": "text",
     "rule": "A territory or place name always carries its number: the class share here against the share from standing.",
     "reason": "A name is a claim about a set, with a measured fit (N2R); without the number 'leg-lock territory' could mean 10% or 70%.",
     "breaks": "In the corpus's game (no-gi), Saddle is leg-lock territory.",
     "complies": "In the corpus's game (no-gi), Saddle is leg-lock territory for the top player: 47.4% of the rolls that end from here end in a leg lock, vs 6.6% from standing; the name holds in 200/200 perturbations and with the origin filter off, under the shipped initiative rule and in gi."},
    {"id": "R05-robustness-in-words", "check": "text",
     "rule": "State robustness in words (holds in k of 200 perturbations, and under which alternatives); never a 'confidence %', 'certain', 'significant', 'proven' or a p/q value.",
     "reason": "Exit shares are exact functionals of the authored numbers; there is no sample, so a confidence percentage would be invented (ruling 1). Set-fit q values are exploratory (ruling 2).",
     "breaks": "In the corpus's game (no-gi), Back Control is choke territory (97% confidence).",
     "complies": "In the corpus's game (no-gi), Back Control is choke territory for the top player: 61.2% of the rolls that end from here end in a choke, vs 46.4% from standing; the name holds in 162/200 perturbations; with the origin filter off it is middle game; under the shipped initiative rule it is middle game; in gi it is middle game."},
    {"id": "R06-seat-names-need-their-facts", "check": "context",
     "rule": "A seat qualifier ('for the top player') is shown only with its robustness clause; where it fails one of the four facts, the sentence says so. Short copy without the clause may carry a seat only when it holds on all four facts.",
     "reason": "Seat names are finer claims than pooled names: 78 of 122 names hold on all four facts against 115 for pooled names; most new seat names sit at the 2x seat gate (back-control 2.08x, 162/200, fails all three alternatives; naming.json seat_names).",
     "breaks": "In the corpus's game (no-gi), Back Control is choke territory for the top player: 61.2% of the rolls that end from here end in a choke, vs 46.4% from standing.",
     "complies": "In the corpus's game (no-gi), Armbar Control is arm-lock territory for the top player: 40.1% of the rolls that end from here end in an arm lock, vs 18.1% from standing; the name holds in 200/200 perturbations and with the origin filter off, under the shipped initiative rule and in gi."},
    {"id": "R07-middle-game-not-no-data", "check": "text",
     "rule": "An unnamed place is 'middle game' (its rolls end the way rolls from standing do), never 'no data', 'unknown' or 'N/A'.",
     "reason": "Unnamed is a measured result, not an absence: 76 of 122 positions, and their exit laws are computed like every other (naming.json unnamed_ground, seat_names.unnamed).",
     "breaks": "In the corpus's game (no-gi), Half Guard: no territory data.",
     "complies": "In the corpus's game (no-gi), Half Guard is middle game: its most over-represented ending, the leg lock, is 9.4% of the rolls that end, vs 6.6% from standing."},
    {"id": "R08-no-printed-zero", "check": "text",
     "rule": "Never print a share as 0% or 0.0%: small shares get two significant figures, exact zeros are 'never', and unreachable positions are 'not reachable from standing'.",
     "reason": "A rounded zero reads as 'never happens' when the value may be 0.0036% (twister-control's time share), and an unreachable position has no exit law at all (naming.json not_evaluable).",
     "breaks": "In the corpus's game (no-gi), Lapel Guard: 0.0% of the rolls that end, end in a leg lock.",
     "complies": "In the corpus's game (no-gi), Lapel Guard is not reachable from standing, so it has no exit law to name."},
    {"id": "R09-gi-figures-from-gi-kernels", "check": "context",
     "rule": "A figure labelled gi comes from a gi kernel (and says so); a no-gi figure is never shown to a gi player as if it were theirs.",
     "reason": "The frames differ in how rolls end: the leg-lock baseline halves in gi (3.5% vs 6.6%) and the finisher law moves by total variation 0.20; the shipped EDGE table exists in no-gi only (naming.json gi_vs_nogi; doc 8).",
     "breaks": "In the corpus's game (gi), 38.0% of the rolls that end from these positions end in a leg lock, vs 6.6% from standing.",
     "complies": "In the corpus's game (gi), 28.0% of the rolls that end from these positions end in a leg lock, vs 3.5% from standing."},
    {"id": "R10-gi-comparisons-name-the-baseline", "check": "text",
     "rule": "A gi-vs-no-gi comparison of a territory's size names the baseline it holds fixed.",
     "reason": "Against its own gi baseline leg-lock territory looks stable (23 positions); against the fixed no-gi baseline it shrinks to 17 (naming.json gi_vs_nogi.territories).",
     "breaks": "In the corpus's game, leg-lock territory is just as big in gi (23 positions).",
     "complies": "In the corpus's game, leg-lock territory shrinks from 22 positions in no-gi to 17 in gi when both are measured against the no-gi baseline."},
    {"id": "R11-default-endings", "check": "text",
     "rule": "Never call a place 'not a choke position' or 'not a shoulder-lock position' because it has no choke or shoulder-lock territory; say that chokes (or shoulder locks) are the default ending there.",
     "reason": "The ratio rule cannot name a class that is already the default ending: chokes are 46.4% of all endings from standing, so no place can double them (enrichment <= 1/b; naming.json territories.CHOKE).",
     "breaks": "In the corpus's game (no-gi), Back Control is not a choke position.",
     "complies": "In the corpus's game (no-gi), chokes are the default ending everywhere (46.4% of all endings from standing); from Back Control they are 61.2% of the rolls that end."},
    {"id": "R12-no-edge-sums", "check": "text",
     "rule": "Never total, average or rank EDGE (or any advantage) across a hand or a position; only the order of cards within one hand means anything.",
     "reason": "Both EDGE and the policy-gradient advantage average to zero over every hand by construction, so a sum is identically zero and ranking it ranks rounding noise (CLAUDE.md 6.6; gs-4 Proposition b1).",
     "breaks": "In the corpus's game (no-gi), Mount's total EDGE is +3.",
     "complies": "In the corpus's game (no-gi), EDGE orders the cards within this one hand; the order is all it says."},
    {"id": "R13-no-interior-choke-points", "check": "text",
     "rule": "Never call a position a 'choke point' or 'bottleneck' of the map; describe it by passage (the share of won and lost rolls that pass through it).",
     "reason": "The net winning current's support is one strongly connected component, so the only minimum cut is the finishing layer: no interior choke point exists (gs-4 Theorem d; flux.json configs.headline.flux).",
     "breaks": "In the corpus's game (no-gi), side control is the choke point of the map.",
     "complies": "In the corpus's game (no-gi), side control on top is in 59.6% of the rolls I win and 28.7% of the rolls I lose."},
    {"id": "R14-current-is-not-passage", "check": "text",
     "rule": "Shares of the winning current or of the finisher law are not shares of rolls passing through: say 'end with' for finishes and 'are in' for passage; never '% of rolls go through'.",
     "reason": "Current counts expected traversals (a roll can cross an edge more than once) and the finisher law counts endings; passage is the only trajectory statement (gs-4 (c), (g)).",
     "breaks": "In the corpus's game (no-gi), 9.3% of wins pass through Back Control.",
     "complies": "In the corpus's game (no-gi), 9.3% of the rolls I win end with Rear Naked Choke from Back Control."},
    {"id": "R15-time-has-units", "check": "text",
     "rule": "Durations are in steps (cards) or plies (one card, 0 for a stay-put miss: the kernel's time unit), never bare 'moves' or 'turns', and say whether a clock is on. The one exception is the app's own move clock, whose unit is the app's move count, named as such.",
     "reason": "Steps overcount plies by 25% under the shipped rule (11.32 vs 9.04 from standing; kernel --structure), and the app's move count is neither: it charges some moves differently from a ply (app_game.py).",
     "breaks": "In the corpus's game (no-gi), rolls from standing last 11 moves.",
     "complies": "In the corpus's game (no-gi, shipped initiative), rolls from standing last 11.3 steps (9.0 plies) on average when no clock stops them."},
    {"id": "R16-seat-means-starting-seat", "check": "text",
     "rule": "Top and bottom name the seat the finisher STARTED in at this position ('the player who started on top'), not where they are at the moment of the finish.",
     "reason": "Seat shares are computed from the starting seat (hub start law); rolls move through sweeps and reversals before they end (naming.json definitions.seat_share).",
     "breaks": "In the corpus's game (no-gi), from Back Control the player on top finishes 48.3% of the rolls that end by choke.",
     "complies": "In the corpus's game (no-gi), from Back Control 48.3% of the rolls that end are finished by a choke from the player who started on top."},
    {"id": "R17-descriptive-not-advice", "check": "text",
     "rule": "Names describe how rolls end; they are not instructions. No 'go to', 'hunt', 'aim for' built on a territory name.",
     "reason": "A territory is a property of the corpus's rolls, not an optimal policy; advice belongs to EDGE / FLOW, which answer different questions (doc 5.4).",
     "breaks": "Go to 50-50 Guard to hit heel hooks.",
     "complies": "In the corpus's game (no-gi), 47.2% of the rolls that end from 50-50 Guard end in a leg lock, vs 6.6% from standing."},
    {"id": "R18-numbers-from-the-artifact", "check": "construction",
     "rule": "Every number in a generated sentence is fetched by path from the artifact and verified; nothing is hand-typed.",
     "reason": "Canon numbers in this repo drifted because they were typed (CLAUDE.md 6.9); the N2R lane itself wrote 36.2% where the stored value prints as 36.1%.",
     "breaks": "In the corpus's game (no-gi), leg-lock territory at 2x: 40% of the rolls that end, end in a leg lock.",
     "complies": "(generated by CardText: every number listed in the card's `numbers` as [path, value, text])"},
    {"id": "R19-small-classes-carry-their-share", "check": "text",
     "rule": "Hip/groin and spine names always carry their percentage; their classes rest on 3 and 9 submissions.",
     "reason": "Tiny baselines make huge enrichments from small shares: the literal naming rule would call Turtle hip/groin territory on 0.31% (naming.json names.variants.literal_delta0).",
     "breaks": "In the corpus's game (no-gi), Truck is hip/groin-lock territory.",
     "complies": "In the corpus's game (no-gi), Truck is hip/groin-lock territory for the top player: 6.3% of the rolls that end from here end in a hip or groin lock, vs 0.093% from standing; the name holds in 160/200 perturbations; with the origin filter off it is leg-lock territory for the top player; in gi it is leg-lock territory for the top player."},
    {"id": "R20-regions-say-how-positions-are-weighted", "check": "review",
     "rule": "A name for a large region says how its positions were weighted, or uses the time-weighted share when the two readings differ.",
     "reason": "Counting every position equally, the guard/standing half of the map reads as leg-lock territory (16.1%); weighted by where fights spend time it is middle game (8.0%) (naming_gs1.json regions.phase:guard/standing).",
     "breaks": "In the corpus's game (no-gi), the guard/standing game is leg-lock territory.",
     "complies": "In the corpus's game (no-gi), counting every guard/standing position equally, 16.1% of the rolls that end end in a leg lock; weighted by where fights spend their time, 8.0%."},
    {"id": "R21-no-stale-canon", "check": "text",
     "rule": "Never describe the app's opponent with CLAUDE.md 5's 'no role or origin filter, ~12%'.",
     "reason": "Stale since v1.176.0: the opponent draws from the role- and origin-filtered candidates and picks by its own rule (doc 1.3; gs-shared ruling 3).",
     "breaks": "The app's opponent uses no role or origin filter, so only 12% of its moves match the corpus.",
     "complies": "In the app's game, the opponent draws from the same role- and origin-filtered candidates and chooses among them by its own rule."},
    {"id": "R22-say-whether-the-clock-is-on", "check": "review",
     "rule": "A finish probability says whether a clock is on and which one, a 9-12-ply clock (the app's clock length) or the app's own move clock; with a clock, say how many rolls run out of time.",
     "reason": "A clock takes finishes and never gives them (gs-2 Proposition B): from standing (no-gi, player-neutral) P(I finish) is 0.553 with no clock but 0.396 under a 9-12-ply clock, with 0.314 running out of time (kernel --structure); the two clocks leave different shares of rolls undecided (doc 1.3).",
     "breaks": "In the corpus's game (no-gi), I finish 55.3% of rolls from standing.",
     "complies": "In the corpus's game (no-gi, player-neutral initiative), I finish 55.3% of rolls from standing with no clock; under a 9-12-ply clock (the app's clock length) I finish 39.6% and 31.4% run out of time."},
    {"id": "R23-two-clocks", "check": "text",
     "rule": "Name a clock by what it counts: 'a 9-12-ply clock (the app's clock length)' for the kernel's horizon in plies, 'the app's own move clock' for the app's move count (moveCount); never give the app's clock a ply unit or the ply an app unit.",
     "reason": "The two clocks count different things: the app's move count charges my missed submission 2 and their finish attempt 0 and ends a roll only on some moves (app_game.py, THE CLOCK), and they leave different shares of rolls undecided (doc 1.3).",
     "breaks": "In the corpus's game (no-gi), under the app's 9-12-ply clock I finish 39.6% of rolls from standing and 31.4% run out of time.",
     "complies": "In the corpus's game (no-gi, player-neutral initiative), under a 9-12-ply clock (the app's clock length) I finish 39.6% of rolls from standing and 31.4% run out of time."},
)

_R = re.compile
_POP = _R(r"rolls (?:that end|i win|i lose)|of (?:all )?endings|long fight's time|of (?:its|their) rolls|rolls from|perturbations", re.I)
# R15's one exception: a duration on the app's own move clock is in the app's move count, named as such
_APP_MOVE_CLOCK = _R(r"app's own move clock|\bmovecount\b|app's move count", re.I)
# R23: the two clocks (N8). A 9-12-ply clock is the kernel's horizon in plies at the app's clock LENGTH;
# the app's own move clock counts moveCount (app_game.py THE CLOCK). Each alternative is one way the
# copy merged them before N8; TWO_CLOCKS_CASES pins every one, and the sanctioned phrasings stay clean.
TWO_CLOCKS = _R(
    r"\bapp's (?:own )?(?:[\d–-]+[- ])?ply\b"                                          # the app's 9-12-ply clock
    r"|\bpl(?:y|ies)\b \((?:the )?app's [\w ]*unit\)"                                       # plies (the app's clock unit)
    r"|\bapp(?:'s)? (?:[\w-]+ ){0,4}(?:stops?|ends?|cuts? off)\b[^.;()]*?\bpl(?:y|ies)\b"   # the app('s clock) stops ... plies
    r"|\bpl(?:y|ies)\b (?:is|are) (?:what |one unit of )?(?:the )?app's"                    # a ply is what the app's ... counts
    r"|\bunit of the app's (?:move count|round counter|clock)", re.I)                       # one unit of the app's move count
TWO_CLOCKS_CASES = (   # (sentence, merges the clocks?) — the seven pre-N8 merges, then the phrasings that must stay clean
    ("under the app's 9-12-ply clock I finish 39.6% and 31.4% run out of time.", True),
    ("Durations are in steps (cards) or plies (the app's clock unit), never 'moves' or 'turns'.", True),
    ("and the app's clock stops rolls at 9-12 plies (kernel --structure).", True),
    ("A ply is what the app's round counter counts.", True),
    ("A step that costs one unit of the app's move count; stay-put miss cells cost 0 plies.", True),
    ("Most numbers let a roll run until someone taps; the app instead stops the round after 9 to 12 plies.", True),
    ("the clocked figures use plies (the app's clock unit), maxMoves uniform 9..12.", True),
    ("a 9–12-ply clock (the app's clock length) leaves 29–31% of rolls from standing undecided.", False),
    ("under the app's own move clock (9–12 moves, its moveCount rules)", False),
    ("The app's own move clock leaves 35% undecided under the shipped rule.", False),
    ("under the 9-12-ply clock 30.1% vs 28.0%", False),
    ("EDGE = 100 (Q(s,a) - sum_b pi_b Q(s,b)) on an 11-ply, lambda = 2, argmax-continuation Q", False),
)


def lint_copy(sentence, *, frame=None, seat_rob=None):
    """The text- and context-checkable copy rules; returns the ids the sentence violates."""
    s, low = sentence, sentence.lower()
    out = []
    if "in the corpus's game" not in low and "in the app's game" not in low:
        out.append("R01-which-game")
    if _R(r"\byou(?:'ll| will| are going to| should| must)\b|guarantee", re.I).search(s):
        out.append("R02-no-promises")
    if "%" in s and not _POP.search(s):
        out.append("R03-share-of-what")
    if _R(r"\b(?:is|are) (?:a |an )?[\w/ -]*territory", re.I).search(s) and not ("from standing" in low and "%" in s):
        out.append("R04-territory-carries-its-number")
    if _R(r"confiden|\bcertain|probability of being right|significan|proven|\b[pq]\s*[<=]|% sure", re.I).search(s):
        out.append("R05-robustness-in-words")
    seat = _R(r"for (?:the (?:top|bottom) player|both players)", re.I).search(s)
    if seat and "perturbations" not in low:
        out.append("R06-seat-names-need-their-facts")
    if seat and seat_rob is not None:
        for alt in ROBUST_ALTS:
            held = seat_rob[alt]["holds"]
            need = None if held is True else (f"{ALT_WORDS[alt]} it is not reachable" if held is None else f"{ALT_WORDS[alt]} it is ")
            if need and need not in s:
                out.append("R06-seat-names-need-their-facts")
    if _R(r"no (?:territory )?data|\bunknown\b|not enough data|\bn/a\b|insufficient data", re.I).search(s):
        out.append("R07-middle-game-not-no-data")
    if _R(r"(?<![\d.])0(?:\.0+)?%").search(s):
        out.append("R08-no-printed-zero")
    m = _R(r"in the (?:corpus's|app's) game \((no-gi|gi)", re.I).search(s)
    if frame is not None and m and {"no-gi": "nogi", "gi": "gi"}[m.group(1).lower()] != frame:
        out.append("R09-gi-figures-from-gi-kernels")
    if _R(r"\bin gi\b|\(gi\)", re.I).search(s) and _R(r"\b(?:grows?|shrinks?|as big|bigger|smaller|larger)\b", re.I).search(s) \
            and "baseline" not in low:
        out.append("R10-gi-comparisons-name-the-baseline")
    if _R(r"\bnot (?:a|an) (?:choke|shoulder[- ]lock)", re.I).search(s):
        out.append("R11-default-endings")
    if _R(r"\b(?:total|average|mean|sum of|overall|net) (?:edge|advantage)\b", re.I).search(s):
        out.append("R12-no-edge-sums")
    if _R(r"choke[- ]?point|bottleneck|every (?:win|roll) (?:goes|passes) through", re.I).search(s):
        out.append("R13-no-interior-choke-points")
    if _R(r"% of (?:the )?(?:rolls|wins)(?: i win)? (?:go|goes|pass|passes|run|runs|flow|flows) through", re.I).search(s):
        out.append("R14-current-is-not-passage")
    if _R(r"\d+(?:\.\d+)? (?:moves|turns|exchanges)\b", re.I).search(s) and not _APP_MOVE_CLOCK.search(s):
        out.append("R15-time-has-units")
    if _R(r"player (?:on|in) (?:the )?(?:top|bottom) (?:finishes|chokes|wins|taps)", re.I).search(s):
        out.append("R16-seat-means-starting-seat")
    if _R(r"^(?:go|get|take|move|head) (?:to|for)\b|\baim for\b|\bhunt\b", re.I).search(s):
        out.append("R17-descriptive-not-advice")
    if _R(r"(?:hip/groin|spine)[- ](?:lock )?territory", re.I).search(s) and "%" not in s:
        out.append("R19-small-classes-carry-their-share")
    if _R(r"no role or origin filter", re.I).search(s):
        out.append("R21-no-stale-canon")
    if TWO_CLOCKS.search(s):
        out.append("R23-two-clocks")
    return sorted(set(out))


def copy_rules_selfcheck(rules=COPY_RULES):
    """Every checkable rule flags its OWN breaking example; every compliant example passes every
    text rule; the context rules fire only with their context."""
    n = 0
    for r in rules:
        if r["check"] not in ("text", "context"):
            continue
        ctx = {}
        if r["id"].startswith("R06"):
            ctx = {"seat_rob": {"origin_false": {"holds": False}, "other_rule": {"holds": False}, "other_frame": {"holds": False}}}
        if r["id"].startswith("R09"):
            ctx = {"frame": "nogi"}
        got = lint_copy(r["breaks"], **ctx)
        _need(r["id"] in got, "COPY_RULE_MISSES_ITS_EXAMPLE", f"{r['id']}: {got} for {r['breaks']!r}")
        ok_ctx = {"frame": "gi"} if r["id"].startswith("R09") else (
            {"seat_rob": {a: {"holds": True} for a in ROBUST_ALTS}} if r["id"].startswith("R06") else {})
        _need(not lint_copy(r["complies"], **ok_ctx), "COPY_RULE_COMPLIANT_FLAGGED", f"{r['id']}: {lint_copy(r['complies'], **ok_ctx)}")
        n += 1
    _need(n >= 15, "COPY_RULE_COVERAGE", str(n))
    # R23 (N8): every recorded merge is caught and every sanctioned phrasing passes; then no glossary or
    # copy-rule string merges the two clocks, except R23's own breaking example
    for sentence, merges in TWO_CLOCKS_CASES:
        _need(("R23-two-clocks" in lint_copy(sentence)) == merges, "TWO_CLOCKS_KNOWN_ANSWER", sentence)
    _need("R15-time-has-units" not in lint_copy("under the app's own move clock (9-12 moves, its moveCount rules)")
          and "R15-time-has-units" in lint_copy("rolls from standing last 11 moves"), "R15_APP_MOVE_CLOCK_EXCEPTION", "")
    swept = [(e["term"], f, e[f]) for e in GLOSSARY for f in ("grappler", "precise")]
    swept += [(r["id"], f, r[f]) for r in rules for f in ("rule", "reason", "breaks", "complies")
              if f in r and not (r["id"].startswith("R23") and f == "breaks")]
    merged = [(who, f) for who, f, text in swept if TWO_CLOCKS.search(text)]
    _need(bool(swept) and not merged, "TWO_CLOCKS_IN_COPY", f"{len(swept)} strings swept; merged: {merged}")
    out = {"checkable_rules": n, "rules_total": len(rules),
           "two_clocks_known_answers": len(TWO_CLOCKS_CASES) + 2, "two_clocks_strings_swept": len(swept),
           "construction_rules": sum(r["check"] == "construction" for r in rules),
           "review_rules": sum(r["check"] == "review" for r in rules)}
    print("naming copy-rules selfcheck: " + json.dumps(out, sort_keys=True))
    return out


def lint_cards(cards, art):
    """Every generated card sentence against every checkable copy rule, with its context."""
    frame = cards["configuration"]["frame"]
    n, bad = 0, []
    for group in ("hubs", "territories", "tv_regions", "not_evaluable"):
        for key, card in cards[group].items():
            rob = None
            if group == "hubs":
                rob = art["hubs"][key]["robustness_n3"]
            elif group == "tv_regions":
                rob = art["tv_regions"]["regions"][key]["robustness_n3"]
            v = lint_copy(card["sentence"], frame=frame, seat_rob=rob)
            n += 1
            if v:
                bad.append(f"{group}:{key}: {v}")
    _need(n > 0 and not bad, "CARD_COPY_RULE_VIOLATION", "; ".join(bad[:6]) or "no cards")
    return {"card_sentences_linted": n, "violations": 0}


CHECK_WORDS = {"text": "checked by `lint_copy` (regex)", "context": "checked by `lint_copy` with the sentence's configuration / robustness record",
               "construction": "enforced by `CardText.verify` when a sentence is generated", "review": "human review (no mechanical check)"}


def render_copy_rules(rules=COPY_RULES):
    out = []
    for r in rules:
        out.append(f"**{r['id']}.** {r['rule']}\n   - *Why:* {r['reason']}\n   - *Breaks it:* \"{r['breaks']}\"\n"
                   f"   - *Complies:* \"{r['complies']}\"\n   - *Check:* {CHECK_WORDS[r['check']]}.\n")
    return "\n".join(out)


# N5 — STALENESS BY HASH. Every derived naming artifact carries the sha256 of the graph.json its
# numbers descend from, and a writer refuses to mix inputs from different graphs. The cell's artifacts
# record that hash under different keys; GRAPH_SHA_KEYS lists every form in use (first match wins).
GRAPH_SHA_KEYS = (("graph_sha256",), ("meta", "graph_sha256"), ("sources_sha256", "graph.json"),
                  ("source_sha256", "graph.json"), ("source_sha256",))


def current_graph_sha():
    return hashlib.sha256((ROOT / "graph.json").read_bytes()).hexdigest()


def artifact_graph_sha(obj):
    """(sha256, where) of the graph an artifact records, or (None, None) if it records none."""
    for path in GRAPH_SHA_KEYS:
        node = obj
        for k in path:
            node = node.get(k) if isinstance(node, dict) else None
        if isinstance(node, str) and re.fullmatch(r"[0-9a-f]{64}", node):
            return node, ".".join(path)
    return None, None


def check_graph_inputs(inputs, allow_unhashed=False):
    """inputs = {repo-relative name: parsed JSON}. Every input that records a graph hash must record
    the CURRENT graph.json's (a mismatch always refuses: the output would mix two graphs); an input
    that records none refuses unless allow_unhashed, and is then returned for the artifact to record.
    Returns (current sha, [(name, where) checked], [unhashed names])."""
    _need(bool(inputs), "NO_INPUTS", "a staleness check over nothing is not a pass")
    cur = current_graph_sha()
    checked, unhashed, stale = [], [], []
    for name in sorted(inputs):
        sha, where = artifact_graph_sha(inputs[name])
        if sha is None:
            unhashed.append(name)
        elif sha != cur:
            stale.append(f"{name} [{where}] {sha[:12]}.. != graph.json {cur[:12]}..")
        else:
            checked.append([name, where])
    _need(not stale, "STALE_INPUT", "; ".join(stale) + " -- regenerate the stale input first")
    _need(not unhashed or allow_unhashed, "UNHASHED_INPUT",
          f"{unhashed} record no graph hash; pass --allow-unhashed-input to proceed (they are then recorded)")
    print(f"graph inputs: {len(checked)} checked against graph.json {cur[:12]}.., {len(unhashed)} unhashed"
          + (f" (allowed: {unhashed})" if unhashed else ""))
    return cur, checked, unhashed


def n5_selfcheck() -> dict:
    """Known answers for the staleness checks: every recorded-hash form is found, a mismatch refuses
    even when unhashed inputs are allowed, an unhashed input refuses unless allowed and is then
    reported, and an empty input set refuses."""
    cur = current_graph_sha()
    other = "0" * 64
    forms = [{"graph_sha256": cur}, {"meta": {"graph_sha256": cur}}, {"sources_sha256": {"graph.json": cur}},
             {"source_sha256": {"graph.json": cur}}, {"source_sha256": cur}]
    for f in forms:
        assert artifact_graph_sha(f)[0] == cur, f
    assert artifact_graph_sha({"source_sha256": {"x": cur}, "meta": {}}) == (None, None)
    assert artifact_graph_sha({"graph_sha256": "not-a-hash"}) == (None, None)
    c, checked, unhashed = check_graph_inputs({f"f{i}": f for i, f in enumerate(forms)})
    assert c == cur and len(checked) == len(forms) and not unhashed
    refused = 0
    for inputs, allow, code in (({"a": {"graph_sha256": other}}, True, "STALE_INPUT"),
                                ({"a": {"graph_sha256": cur}, "b": {}}, False, "UNHASHED_INPUT"),
                                ({}, True, "NO_INPUTS")):
        try:
            check_graph_inputs(inputs, allow)
        except NamingRefusal as exc:
            assert exc.code == code, (exc.code, code)
            refused += 1
        else:
            raise AssertionError(f"staleness check accepted {code}")
    _c, _k, un = check_graph_inputs({"a": {"graph_sha256": cur}, "b": {}}, True)
    assert un == ["b"]
    res = stamp_graph({}, cur, [["a", "graph_sha256"]], un)
    assert res["input_unhashed"] == ["b"] and res["graph_sha256"] == cur
    assert "input_unhashed" not in stamp_graph({}, cur, [], [])
    # N7: the producer hash names a real repo file (verify_all resolves the key as a repo path) and is
    # that file's hash, and it is never read as a graph hash, beside graph_sha256 or on its own
    prod = producer_sha256()
    assert len(prod) == 1 and all((ROOT / k).is_file() and hashlib.sha256((ROOT / k).read_bytes()).hexdigest() == v
                                  for k, v in prod.items()), prod
    assert artifact_graph_sha({"graph_sha256": cur, "source_sha256": prod}) == (cur, "graph_sha256")
    assert artifact_graph_sha({"source_sha256": prod}) == (None, None)
    out = {"hash_forms_found": len(forms), "refusals": refused, "unhashed_recorded": 1, "producer_hash_checks": 3}
    print("naming N5 selfcheck: " + json.dumps(out, sort_keys=True))
    return out


def stamp_graph(res, cur, checked, unhashed):
    res["graph_sha256"] = cur
    res["graph_inputs_checked"] = checked
    if unhashed:
        res["input_unhashed"] = unhashed
    return res


def _glossary_main(render_out=None, allow_unhashed=False) -> int:
    vocabulary = _import_semantics("vocabulary")
    cov = validate_glossary()
    rules = copy_rules_selfcheck()
    art = json.loads((ROOT / "tests/artifacts/semantics/naming.json").read_bytes())
    cards = json.loads((ROOT / "tests/artifacts/semantics/naming_cards.json").read_bytes())
    lint = lint_cards(cards, art)
    inputs = {"tests/artifacts/semantics/naming.json": art, "tests/artifacts/semantics/naming_cards.json": cards}
    for e in GLOSSARY:                      # every artifact the glossary cites is an input too
        for path, _keys in e["refs"]:
            if path not in inputs:
                inputs[path] = json.loads((ROOT / path).read_bytes())
    cur, checked, unhashed = check_graph_inputs(inputs, allow_unhashed)
    out = ROOT / "tests/artifacts/semantics/naming_glossary.json"
    res = {"schema": "graph-semantics.naming-glossary.v1", "recompute": "python3 -B scripts/semantics/naming.py --glossary",
           "which_game": art["which_game"], "source_sha256": producer_sha256(),
           "glossary": [{k: (list(v) if isinstance(v, tuple) else v) for k, v in e.items() if k != "symbols"} for e in GLOSSARY],
           "copy_rules": list(COPY_RULES),
           "validation": {"glossary": cov, "copy_rules": rules, "cards": lint}}
    stamp_graph(res, cur, checked, unhashed)
    size = vocabulary.write_compact(out, res, GS1_BUDGET)
    print(f"wrote {out} ({size} bytes); glossary {json.dumps(cov, sort_keys=True)}; cards {json.dumps(lint, sort_keys=True)}")
    if render_out is not None:
        render_out.parent.mkdir(parents=True, exist_ok=True)
        render_out.write_text(render_glossary() + "\n\n<!-- COPY RULES -->\n\n" + render_copy_rules() + "\n")
        print(f"wrote {render_out}")
    return 0


def _gs1_main(seeds, selfcheck_result, allow_unhashed=False) -> int:
    vocabulary = _import_semantics("vocabulary")
    out = ROOT / "tests/artifacts/semantics/naming_gs1.json"
    inputs = {f"tests/artifacts/semantics/{n}": json.loads((ROOT / "tests/artifacts/semantics" / n).read_bytes())
              for n in ("territories.json", "naming.json", "vocabulary.json")}
    cur, checked, unhashed = check_graph_inputs(inputs, allow_unhashed)   # before the kernel spends a minute
    res = run_gs1(seeds, ROBUST_EPS, selfcheck_result)
    _need(current_graph_sha() == cur, "GRAPH_CHANGED_DURING_RUN", "graph.json moved while --gs1 ran")
    stamp_graph(res, cur, checked, unhashed)
    size = vocabulary.write_compact(out, res, GS1_BUDGET)
    print(f"wrote {out} ({size} bytes, budget {GS1_BUDGET}); coverage " + json.dumps(res["coverage"], sort_keys=True))
    for k, v in res["reproduces_gs1_vs_tv"].items():
        print(f"  reproduces gs-1 {k} ~ TV: NMI {v['gs1']} vs {v['here']}; mu-purity {v['purity_gs1']} vs {v['purity_here']}")
    return 0


def _cards_main(art_path=None, out=None, allow_unhashed=False) -> int:
    vocabulary = _import_semantics("vocabulary")
    art_path = art_path or ROOT / "tests/artifacts/semantics/naming.json"
    out = out or ROOT / "tests/artifacts/semantics/naming_cards.json"
    raw = art_path.read_bytes()
    art = json.loads(raw)
    voc, _sha = load_lexicon()
    cur, checked, unhashed = check_graph_inputs(
        {"tests/artifacts/semantics/naming.json" if art_path == ROOT / "tests/artifacts/semantics/naming.json"
         else str(art_path): art, "tests/artifacts/semantics/vocabulary.json": voc}, allow_unhashed)
    cards = build_cards(art, hashlib.sha256(raw).hexdigest(), voc)
    cards["coverage"].update({"copy_rules_" + k: v for k, v in lint_cards(cards, art).items()})
    cards["copy_rules"] = [{"id": r["id"], "check": r["check"], "rule": r["rule"]} for r in COPY_RULES]
    stamp_graph(cards, cur, checked, unhashed)
    size = vocabulary.write_compact(out, cards, CARDS_BUDGET)
    print(f"wrote {out} ({size} bytes, budget {CARDS_BUDGET}); coverage " + json.dumps(cards["coverage"], sort_keys=True))
    return 0


def _territories_main(args, selfcheck_result) -> int:
    vocabulary = _import_semantics("vocabulary")
    out = args.output or ROOT / "tests/artifacts/semantics/naming.json"
    if args.full_out is not None:
        vocabulary.refuse_committed_path(args.full_out, "naming full dump")
    _need(args.seeds >= 1 and args.mc_rolls >= 1000, "RUN_SIZE_FLOOR", f"seeds {args.seeds}, mc rolls {args.mc_rolls}")
    result, full = run_territories(args.seeds, ROBUST_EPS, args.mc_rolls, args.full_out, selfcheck_result)
    if args.seeds != ROBUST_SEEDS or args.mc_rolls != MC_ROLLS:
        result["recompute"] += f" --seeds {args.seeds} --mc-rolls {args.mc_rolls}"
    size = vocabulary.write_compact(out, result, ARTIFACT_BUDGET)
    print(f"wrote {out} ({size} bytes, budget {ARTIFACT_BUDGET})")
    if full is not None:
        args.full_out.parent.mkdir(parents=True, exist_ok=True)
        args.full_out.write_text(json.dumps(full, sort_keys=True, allow_nan=False) + "\n")
        print(f"wrote {args.full_out}")
    cfg = result["configurations"]["primary"]
    for c, recs in result["territories"].items():
        t = recs[f"standing_me|ratio|{NAME_THETA}"]
        if t.get("headline"):
            hl = t["headline"]
            print(f"HEADLINE {c}: in the corpus's game ({cfg['frame']}, {cfg['initiative']} initiative, origin filter "
                  f"{'on' if cfg['origin_filter'] else 'off'}, H = inf), from the {hl['hubs']} hubs of R_{c}({NAME_THETA}) "
                  f"(uniform over seats and turns) {100 * hl['x_uniform']:.1f}% of the rolls that end, end in a {c} finish "
                  f"(either player), vs {100 * hl['y_standing_me']:.1f}% from standing (me first); these hubs hold "
                  f"{100 * hl['mu_time_share']:.1f}% of a long fight's time (Q-process mu); clocked 9..12 plies: "
                  f"{100 * hl['x_clocked']:.1f}% vs {100 * hl['y_clocked']:.1f}%")
        else:
            print(f"HEADLINE {c}: R_{c}({NAME_THETA}) is {t['status']} (threshold share {t.get('threshold_share')}, "
                  f"best hub {t.get('argmax')} at {t.get('max_share')})")
    print("names (primary rule): " + json.dumps(result["names"]["primary_counts"], sort_keys=True))
    if out == ROOT / "tests/artifacts/semantics/naming.json":
        return _cards_main(out)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--selfcheck", action="store_true")
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path, help="required with --input; --territories defaults to tests/artifacts/semantics/naming.json")
    parser.add_argument("--alpha", type=float, default=.05)
    parser.add_argument("--territories", action="store_true", help="N2R: exit-law territories and names on the shared kernel")
    parser.add_argument("--full-out", type=Path, help="N2R full dump (per-state exit masses, every fit row); refused under tests/artifacts/")
    parser.add_argument("--seeds", type=int, default=ROBUST_SEEDS)
    parser.add_argument("--mc-rolls", type=int, default=MC_ROLLS)
    parser.add_argument("--cards", action="store_true", help="N3: rebuild naming_cards.json from naming.json (no kernel)")
    parser.add_argument("--gs1", action="store_true", help="N3 item 3: name and score gs-1's territories.json (naming_gs1.json)")
    parser.add_argument("--glossary", action="store_true", help="N4: validate the glossary + copy rules, lint the cards (naming_glossary.json)")
    parser.add_argument("--render-out", type=Path, help="N4: also write the rendered glossary markdown here (scratch)")
    parser.add_argument("--allow-unhashed-input", action="store_true",
                        help="N5: proceed when an input artifact records no graph hash (recorded as input_unhashed)")
    args = parser.parse_args()
    try:
        checked = None
        if args.selfcheck or args.cards or args.glossary:
            copy_rules_selfcheck()
        if args.selfcheck or args.cards or args.glossary or args.gs1 or args.territories:
            n5_selfcheck()
        if args.selfcheck or args.territories or args.cards or args.gs1:
            selfcheck()
            checked = n2r_selfcheck()
            checked = {**checked, "n3": n3_selfcheck(), "cards": cards_selfcheck()}
            if args.selfcheck or args.gs1:
                checked["gs1"] = gs1_selfcheck()
        if args.territories:
            return _territories_main(args, checked)
        if args.cards:
            return _cards_main(allow_unhashed=args.allow_unhashed_input)
        if args.gs1:
            return _gs1_main(args.seeds, checked, args.allow_unhashed_input)
        if args.glossary:
            if args.render_out is not None:
                _import_semantics("vocabulary").refuse_committed_path(args.render_out, "rendered glossary")
            return _glossary_main(args.render_out, args.allow_unhashed_input)
        if args.input is None:
            if args.selfcheck:
                return 0
            parser.error("provide --input, --territories or --selfcheck; no real regions are invented")
        if args.output is None:
            parser.error("--input needs an explicit --output (naming.json is the N2R territory artifact)")
        data = json.loads(args.input.read_text())
        result = score_pairs(data["universe"], data["regions"], data["labels"],
                             data.get("weights"), alpha=args.alpha)
        result["recompute"] = f"python3 scripts/semantics/naming.py --input {args.input} --output {args.output} --alpha {args.alpha}"
        # the generic scorer reads explicit ID sets, not a graph: record the graph an input declares, or
        # say there is none (the toy input declares none; it is synthetic)
        sha, _where = artifact_graph_sha(data)
        if sha is not None:
            result["graph_sha256"] = sha
        else:
            result["graph"] = "none (synthetic)"
        result["source_sha256"] = producer_sha256()
        print("naming coverage: " + json.dumps(result["coverage"], sort_keys=True))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n")
        print(f"wrote {args.output}")
        return 0 if result["coverage"]["pairs_scored"] else 2
    except (NamingRefusal, ValueError, KeyError) as exc:
        # Flush stdout FIRST. stdout is block-buffered into a file and stderr is not, so in a
        # combined log (`> log 2>&1`) the refusal used to land at the TOP, above every progress line
        # the buffer flushed at exit, and the log read as an exit 2 with no reason.
        sys.stdout.flush()
        print(f"naming REFUSED: {exc!s}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
