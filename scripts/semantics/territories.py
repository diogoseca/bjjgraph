#!/usr/bin/env python3
"""
TERRITORIES — which regions the DYNAMICS of the corpus's game supports, each claim with a proof.
(graph-semantics cell, seat gs-1, item T2R.)

WHAT THIS COMPUTES, ON WHICH SET
  Every number is a statement about the CORPUS'S GAME (both seats sample authored attempt shares;
  `_kernel.py` docstring) and about ONE of three state sets of the Q-PROCESS — the chain
  conditioned never to finish, `K.qprocess()`, on the transient states reachable from standing:
      state  (role-node, whose turn)      e.g. 486 states  (nogi / symmetric / origin filter on)
      role   role-node, both turns lumped  e.g. 244         (`K.lump` onto `K.groups_role()`)
      hub    position, both seats lumped   e.g. 122         (`K.lump` onto `K.groups_hub()`)
  Real-roll figures use the KILLED chain (K.Q) from standing (K.start("standing", first)).

THE PROPOSITIONS (proved in the gs-1 lane file, T2R; toys in `_territory_audit.py --selfcheck`)
  P2  lam*(S) := h(S)+h(S^c)-1 = (h(S)-mu(S))/(1-mu(S)) is the non-unit eigenvalue of the two-block
      lumping of S|S^c and the Rayleigh quotient of R = (P+P*)/2 at the centred indicator.
  P3  lam*(S) <= lambda_2(R) for every S; residence r(S) <= 1/((1-lambda_2)(1-mu(S))).
  P4  the Cheeger ceiling 2/(1-lambda_2) the refuter used is P3 at mu(S) = 1/2.
  P5  hub <= role <= state: lambda_2 interlaces under lumping; a coarser certificate covers fewer sets.
  P6  every non-unit eigenvalue of P has real part <= lambda_2(R).
  P7  G-PCCA+'s Galerkin persistence_excess = mean of the selected eigenvalues (a spectral number).
  P2' tau_lin = r(S) mu(S^c): a relaxation time understates a region's residence by >= 1/mu(S^c).
  SECTORS under the symmetric rule the seat indicator is ODD and every hub-union is EVEN under the
      player swap, so the two splits live in orthogonal spectral sectors with separate ceilings.

THE PHASE SPLIT, DEFINED. lam* (= 1 - normalised cut) is maximised over unions of hubs subject to a
  BALANCE FLOOR beta (both sides hold mu >= beta). Without a floor the optimum is the stickiest
  SMALL region, because for a light set lam*(S) ~ h(S) (P2); that "localized optimum" is reported
  separately. The phase split is the optimum at beta0 = 0.1, and the beta-frontier shows the
  interval of floors over which it is the SAME set (its plateau). The refuter's Fiedler-sign split
  is kept as `phase_sign` for continuity.

CONFIGURATIONS (ruling 4): headline nogi / symmetric / rates=shipped / origin filter ON / H = inf;
  also nogi/shipped, gi/symmetric, gi/shipped, and nogi/symmetric with origin=False. Time is
  reported in STEPS (one card) and PLIES (0-ply stay-put cells, `K.Q0`, cost nothing), and for the
  real roll also under the clock H in {9..12} plies.

USAGE
    python3 -B scripts/semantics/territories.py --selfcheck     # toys + real-kernel proofs, floor
    python3 -B scripts/semantics/territories.py                 # writes the artifact + scratch dump
    python3 -B scripts/semantics/territories.py --seeds 200 --map-seeds 20   (the defaults)
    python3 -B scripts/semantics/territories.py --full-out <path>   # + the full dump (not committed)
  Artifact: tests/artifacts/semantics/territories.json (< 1 MB); it records the sha256 of the
  graph.json it was computed from (meta.graph_sha256, meta.sources.graph). Full per-size
  memberships, per-seed ensembles and the whole technique table go ONLY to an explicit --full-out
  path (default: not written; refused under tests/artifacts/). No machine-specific path is used.
  Deterministic: fixed seeds, sorted keys, single-threaded BLAS when run as a script; no wall-clock
  field is stored, so two runs on one graph.json are byte-comparable.
"""
if __name__ == "__main__":
    import os as _os
    for _var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
        _os.environ.setdefault(_var, "1")

import argparse
import hashlib
import json
import os
import sys
import time
from types import SimpleNamespace

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.dirname(os.path.dirname(HERE))

from _kernel import Kernel, load_kernel  # noqa: E402
from solve_edge_values import GRAPH_PATH, load_graph  # noqa: E402  (path inserted by _kernel)
from _territory_methods import (  # noqa: E402
    SchurPairSplitError, _labels, gpcca, map_equation_search, partition_similarity,
)
import _territory_audit as audit  # noqa: E402
from _territory_audit import (  # noqa: E402
    clocked_sojourn, crisp_persistence, expected_roll, free_holding_search, holding_search,
    involution_sectors, killed_sojourn, module_summary, rev_spectrum, set_statistics,
    simulate_killed, sweep, two_block_search,
)

ARTIFACT = os.path.join(REPO, "tests", "artifacts", "semantics", "territories.json")
RECOMPUTE = "python3 -B scripts/semantics/territories.py"
CONFIGS = (("nogi", "symmetric", True), ("nogi", "shipped", True), ("gi", "symmetric", True),
           ("gi", "shipped", True), ("nogi", "symmetric", False))
PRIMARY = CONFIGS[0]
SIZES = tuple(range(3, 31))
HORIZONS = (9, 10, 11, 12)
KS = tuple(range(2, 9))
STANDING = "standing-position"
LEVELS = ("state", "role", "hub")
BETA0 = 0.1
BETA_GRID = (0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45)
SEED_QUANTILES = (0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 0.99)
# coverage floors (positive counts; below these the run refuses rather than prints)
FLOOR_STATES = {"nogi": 400, "gi": 450}
FLOOR_HUBS = 100
FLOOR_TECH_JOIN = 0.95
# gs-3's accepted exit-law TV territories (G2R; gs-shared.md section 8): read, never recomputed here
GEOMETRY = os.path.join(REPO, "tests", "artifacts", "semantics", "geometry.json")
GS3_CASE = {"nogi/symmetric/origin-on": "nogi/symmetric/shipped",        # ours (ckey) -> gs-3's case key
            "nogi/shipped/origin-on": "nogi/shipped/shipped",
            "gi/symmetric/origin-on": "gi/symmetric/shipped",
            "gi/shipped/origin-on": "gi/shipped/shipped",
            "nogi/symmetric/origin-off": "nogi/symmetric/shipped/origin=False"}
SELFCHECK_FLOOR = 36    # real-kernel checks (the audit toys carry their own floor)
# THE LEG-SET UNIVERSE, frozen here so this artifact never depends on another lane's file: the union
# of the five leg sets of T3's exact algebra (map module M17, the dynamical LOCALIZED set, gs-3's
# exit-TV LEG territory, gs-5's R_LEG(3) and R_LEG(2)), which IS gs-5's R_LEG(2) (22 positions,
# nogi/player-neutral). Used ONLY to name a G-PCCA+ block by its content. `--selfcheck` re-derives
# it read-only from naming.json + geometry.json + this artifact and fails if it has drifted.
LEG_UNIVERSE = frozenset((
    "50-50-guard", "aoki-lock-control", "ashi-garami", "backside-50-50", "carni", "cross-ashi-garami",
    "estima-lock-control", "grasshopper-guard", "honey-hole", "inside-ashi-garami", "inside-sankaku",
    "kneebar-control", "leg-entanglement", "leg-knot", "outside-ashi-garami", "saddle",
    "single-leg-x-guard", "straight-ankle-lock-control", "toe-hold-control", "truck",
    "ushiro-ashi-garami", "x-guard"))
LEG_NAME, REST_NAME = "leg-entanglement cluster", "the rest of the map"


def ckey(frame, initiative, origin):
    return "%s/%s/%s" % (frame, initiative, "origin-on" if origin else "origin-off")


def _sig(x, digits=12):
    """Round a float to `digits` significant digits (stable JSON across BLAS roundoff)."""
    if isinstance(x, (int, np.integer)):
        return int(x)
    x = float(x)
    if not np.isfinite(x):
        return None if np.isnan(x) else ("inf" if x > 0 else "-inf")
    return float("%.*g" % (digits, x))


def _clean(obj):
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [_clean(v) for v in obj.tolist()]
    if isinstance(obj, (complex, np.complexfloating)):
        return {"re": _sig(obj.real), "im": _sig(obj.imag)}
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (float, np.floating, int, np.integer)):
        return _sig(obj)
    return obj


# --------------------------------------------------------------------------- #
# the chain on its three levels
# --------------------------------------------------------------------------- #
def qprocess(K, Q=None):
    """The kernel's OWN `Kernel.qprocess` code; with Q given, on that (perturbed) Q, same index set."""
    if Q is None:
        return K.qprocess()
    return Kernel.qprocess(SimpleNamespace(Q=Q, reach_t=K.reach_t))


def levels_of(K, qp):
    """state / role / hub chains of one Q-process; `unit[i]` = the level unit of Q-process state i."""
    idx, Pq, mu = qp["idx"], qp["Pq"], qp["mu"]
    out = {"state": dict(P=Pq, mu=mu, unit=np.arange(len(idx)),
                         names=["%s|%s" % K.labels[t] for t in idx])}
    for level, groups in (("role", K.groups_role()), ("hub", K.groups_hub())):
        uniq, inv = np.unique(groups[idx], return_inverse=True)
        Pa, pa = K.lump(sp.csr_matrix(Pq), mu, inv, len(uniq))
        names = [K.role_nodes[u] for u in uniq] if level == "role" else [K.hubs[u] for u in uniq]
        if pa.min() <= 0 or np.max(abs(Pa.sum(axis=1) - 1)) > 1e-12:
            raise ArithmeticError("%s lumping lost stochasticity or mass" % level)
        out[level] = dict(P=Pa, mu=pa, unit=inv, names=names)
    return out


def swap_perm(K, qp, lvs, level):
    """The player swap (r, M) <-> (flip r, T) on the Q-process index (state), r <-> flip r (role)."""
    if level == "state":
        idx = qp["idx"]
        pos = {int(t): i for i, t in enumerate(idx)}
        img = [(K.n_r + K.flipidx[t]) if t < K.n_r else K.flipidx[t - K.n_r] for t in idx]
        if any(int(j) not in pos for j in img):
            return None
        return np.array([pos[int(j)] for j in img])
    if level == "role":
        names = lvs["role"]["names"]
        pos = {n: i for i, n in enumerate(names)}
        img = [K.role_nodes[K.flipidx[K.index[n]]] for n in names]
        if any(n not in pos for n in img):
            return None
        return np.array([pos[n] for n in img])
    return None


def seat_units(K, lv, level):
    """Indices (at `level`) of every unit whose role-node is /bottom. None at hub level: every
    hub-constant function is swap-EVEN, so the seat split is not representable there."""
    if level == "hub":
        return None
    if level == "role":
        return np.array([i for i, n in enumerate(lv["names"]) if n.endswith("/bottom")])
    return np.array([i for i, n in enumerate(lv["names"]) if n.split("|")[0].endswith("/bottom")])


def units_from_hubs(K, qp, lvs, level, hub_names):
    """Indices at `level` of every unit whose hub is in `hub_names` (exact lift of a hub union)."""
    hubs = set(hub_names)
    if level == "hub":
        return np.array([i for i, n in enumerate(lvs["hub"]["names"]) if n in hubs], dtype=int)
    if level == "role":
        return np.array([i for i, n in enumerate(lvs["role"]["names"]) if K.hub_of[K.index[n]] in hubs],
                        dtype=int)
    return np.array([i for i, t in enumerate(qp["idx"]) if K.hub_of[t % K.n_r] in hubs], dtype=int)


def transient_mask(K, predicate):
    return np.array([bool(predicate(t % K.n_r)) for t in range(K.n_t)])


def spectral_seeds(P, mu, F, js=(1, 2, 3, 4, 5, 6)):
    """Level-set prefixes of the slow reversibilised eigenvectors at fixed MASS quantiles (both ends)."""
    n = len(P)
    seeds = []
    for j in js:
        if j >= F.shape[1]:
            break
        for o in (np.argsort(F[:, j], kind="stable"), np.argsort(-F[:, j], kind="stable")):
            cm = np.cumsum(mu[o])
            for q in SEED_QUANTILES:
                k = min(max(int(np.searchsorted(cm, q)) + 1, 1), n - 1)
                seeds.append(np.sort(o[:k]))
    return seeds


# --------------------------------------------------------------------------- #
# the phase split, the localized optimum and the beta-frontier (hub level)
# --------------------------------------------------------------------------- #
def phase_split(lv_hub, frontier=True, localized=True):
    """See the module docstring, THE PHASE SPLIT, DEFINED. Oriented so standing is on the + side.

    Returns index sets (hub-level): `sign` (refuter: Fiedler sign), `phase` (lam* optimum at beta0),
    `localized` (the LIGHTER side of the unconstrained lam* optimum, seeded also from every single
    hub) and, with `frontier`, the optimum at every beta in BETA_GRID with its plateau around beta0.
    """
    P, mu, names = lv_hub["P"], lv_hub["mu"], lv_hub["names"]
    n = len(P)
    w, F = rev_spectrum(P, mu)
    s = names.index(STANDING)
    v = F[:, 1] if F[s, 1] > 0 else -F[:, 1]
    sign = np.flatnonzero(v > 0)
    seeds = [sign, sweep(P, mu, v)["two_block"][1]] + spectral_seeds(P, mu, F)

    def orient(S):
        S = np.sort(np.asarray(S, dtype=int))
        return S if s in set(S.tolist()) else np.setdiff1d(np.arange(n), S)

    value, S, cov = two_block_search(P, mu, seeds, min_mass=BETA0)
    out = dict(lambda2=float(w[1]), fiedler=v, sign=np.sort(sign), phase=orient(S), phase_value=value,
               phase_coverage=cov)
    if localized:
        lv, L, lcov = two_block_search(P, mu, seeds + [[i] for i in range(n)], min_mass=0.0)
        if mu[L].sum() > 0.5:
            L = np.setdiff1d(np.arange(n), L)
        out.update(localized=np.sort(L), localized_value=lv, localized_coverage=lcov)
    if frontier:
        rows = []
        base = set(np.setdiff1d(np.arange(n), out["phase"]).tolist())
        for beta in BETA_GRID:
            bv, BS, _ = two_block_search(P, mu, seeds + ([[i] for i in range(n)] if beta < 0.01 else []),
                                         min_mass=beta)
            other = set(np.setdiff1d(np.arange(n), orient(BS)).tolist())       # the non-standing side
            jac = len(other & base) / len(other | base) if other | base else 1.0
            rows.append(dict(beta=beta, lam_star=bv, non_standing_hubs=len(other),
                             non_standing_mu=float(mu[list(other)].sum()), same_as_phase=other == base,
                             jaccard_vs_phase=jac,
                             top=[names[i] for i in sorted(other, key=lambda i: (-mu[i], names[i]))[:5]]))
        k0 = BETA_GRID.index(BETA0)
        lo = hi = k0
        while lo > 0 and rows[lo - 1]["same_as_phase"]:
            lo -= 1
        while hi < len(rows) - 1 and rows[hi + 1]["same_as_phase"]:
            hi += 1
        out.update(frontier=rows, plateau=(BETA_GRID[lo], BETA_GRID[hi]))
    return out


# --------------------------------------------------------------------------- #
# statistics of named sets
# --------------------------------------------------------------------------- #
def real_roll(K, inside, lu, Qp):
    """Killed-roll sojourn of a transient-state set from standing, steps + plies + clocked plies."""
    ply_cost = 1 - np.asarray(K.Q0.sum(axis=1)).ravel()
    out = {}
    for first in ("me", "coin"):
        s0 = K.start("standing", first)
        st = killed_sojourn(K.Q, s0, inside, np.ones(K.n_t), lu=lu)
        pl = killed_sojourn(K.Q, s0, inside, ply_cost, lu=lu)
        cl = clocked_sojourn(Qp, s0, inside, HORIZONS)
        out[first] = dict(entries=st["entries"], p_visit=st["p_visit"], capture=st["capture"],
                          steps=dict(sojourn=st["sojourn"], time=st["time"], roll=st["roll"],
                                     share=st["time_share"]),
                          plies=dict(sojourn=pl["sojourn"], time=pl["time"], roll=pl["roll"],
                                     share=pl["time_share"]),
                          clocked_plies=dict(sojourn=cl["sojourn"], time=cl["time"], entries=cl["entries"],
                                             roll=cl["roll"], share=cl["time_share"]),
                          route_error=max(st["route_error"], pl["route_error"]))
    return out


def set_row(stats, names, members, mu, top=5):
    order = sorted(np.asarray(members).tolist(), key=lambda i: (-mu[i], names[i]))
    keep = ("mu_mass", "holding", "residence_steps", "two_block_eigenvalue", "complement_residence_steps",
            "tau_lin_steps", "tau_log_steps", "kappa_residence_over_tau_log", "p3_ceiling_residence",
            "p3_slack", "cheeger_ceiling_residence")
    row = {k: stats.get(k) for k in keep}
    row.update(units=len(order), top=[names[i] for i in order[:top]])
    return row


def spectra(lvs, qp):
    out = {}
    for level in LEVELS:
        P, mu = lvs[level]["P"], lvs[level]["mu"]
        ev = np.linalg.eigvals(P)
        ev = ev[np.lexsort((-ev.imag, -ev.real, -np.abs(ev)))]
        w, _ = rev_spectrum(P, mu)
        nonunit = ev[1:]
        out[level] = dict(units=len(P), P_top8=ev[:8], R_top8=w[:8], lambda2_R=float(w[1]),
                          cheeger_ceiling_residence=2 / (1 - w[1]),
                          max_nonunit_real=float(nonunit.real.max()),
                          p6_holds=bool(nonunit.real.max() <= w[1] + 1e-10),
                          nonreversible_second_modulus=float(abs(ev[1])),
                          tau_nonreversible=float(-1 / np.log(abs(ev[1]))))
    if not out["hub"]["lambda2_R"] <= out["role"]["lambda2_R"] + 1e-12 <= out["state"]["lambda2_R"] + 2e-12:
        raise ArithmeticError("P5 interlacing violated across levels")
    out["survival_per_step"] = float(qp["lam"])
    return out


def split_rows(K, qp, lvs, hubs, lam2):
    """Statistics of a hub union at every level; P5 demands identical lam* (asserted)."""
    rows, lamstars = {}, []
    for level in LEVELS:
        u = units_from_hubs(K, qp, lvs, level, hubs)
        st = set_statistics(lvs[level]["P"], lvs[level]["mu"], u, lambda2=lam2[level])
        rows[level] = set_row(st, lvs[level]["names"], u, lvs[level]["mu"])
        lamstars.append(st["two_block_eigenvalue"])
    if max(lamstars) - min(lamstars) > 1e-9:
        raise ArithmeticError("P5: a hub union's lam* differs across levels")
    return rows


# --------------------------------------------------------------------------- #
# per configuration
# --------------------------------------------------------------------------- #
def analyse_config(G, frame, initiative, origin, verbose=True):
    t0 = time.time()
    tag = ckey(frame, initiative, origin)
    K = load_kernel(frame, initiative, "shipped", graph=G, origin=origin)
    qp = qprocess(K)
    lvs = levels_of(K, qp)
    idx = qp["idx"]
    if len(idx) < FLOOR_STATES[frame] or len(lvs["hub"]["P"]) < FLOOR_HUBS:
        raise SystemExit("[territories] %s: Q-process covers %d states / %d hubs, below floor"
                         % (tag, len(idx), len(lvs["hub"]["P"])))
    res = dict(coverage=dict(qprocess_states=len(idx), role_units=len(lvs["role"]["P"]),
                             hub_units=len(lvs["hub"]["P"]), transient_states=K.n_t,
                             kernel={k: K.coverage[k] for k in (
                                 "cards_dealt_mine", "cells", "origin_dropped_share",
                                 "origin_orphaned_techniques", "reachable_role_nodes_from_standing")}))
    res["spectrum"] = spc = spectra(lvs, qp)
    lam2 = {lv: spc[lv]["lambda2_R"] for lv in LEVELS}
    hub_names = lvs["hub"]["names"]

    # ---- named splits: phase (beta0), phase_sign (refuter), localized, seat -----------------
    ph = phase_split(lvs["hub"])
    guard_hubs = [hub_names[i] for i in ph["phase"]]
    sign_hubs = [hub_names[i] for i in ph["sign"]]
    loc_hubs = [hub_names[i] for i in ph["localized"]]
    splits = dict(
        phase=dict(levels=split_rows(K, qp, lvs, guard_hubs, lam2), guard_side_hubs=sorted(guard_hubs),
                   guard_side_count=len(guard_hubs), beta0=BETA0, plateau=ph["plateau"],
                   frontier=ph["frontier"], coverage=ph["phase_coverage"],
                   definition="max lam*(S) over hub unions with both sides mu >= beta0; standing side = guard"),
        phase_sign=dict(levels=split_rows(K, qp, lvs, sign_hubs, lam2), guard_side_hubs=sorted(sign_hubs),
                        guard_side_count=len(sign_hubs),
                        definition="refuter: sign of the Fiedler vector of R_hub, standing +"),
        localized=dict(levels=split_rows(K, qp, lvs, loc_hubs, lam2), hubs=sorted(loc_hubs),
                       count=len(loc_hubs), coverage=ph["localized_coverage"],
                       definition="lighter side of the unconstrained lam* optimum (seeds: spectral + every hub)"))
    moved = sorted(set(guard_hubs) ^ set(sign_hubs))
    mu_h = dict(zip(hub_names, lvs["hub"]["mu"]))
    splits["phase"]["vs_sign"] = dict(hubs_moved=len(moved), mu_moved=float(sum(mu_h[h] for h in moved)),
                                      moved=[(h, "to guard" if h in set(guard_hubs) else "to pinned", mu_h[h])
                                             for h in sorted(moved, key=lambda h: -mu_h[h])])
    seat_rows, lamstars = {}, []
    for level in ("state", "role"):
        u = seat_units(K, lvs[level], level)
        st = set_statistics(lvs[level]["P"], lvs[level]["mu"], u, lambda2=lam2[level])
        seat_rows[level] = set_row(st, lvs[level]["names"], u, lvs[level]["mu"])
        lamstars.append(st["two_block_eigenvalue"])
    if max(lamstars) - min(lamstars) > 1e-9:
        raise ArithmeticError("P5: the seat split's lam* differs between state and role level")
    splits["seat"] = dict(levels=seat_rows, definition="S = every /bottom role-node, both turns")
    role = lvs["role"]
    bottom = np.zeros(len(role["P"]), dtype=int)
    bottom[seat_units(K, role, "role")] = 1
    guard = np.zeros(len(role["P"]), dtype=int)
    guard[units_from_hubs(K, qp, lvs, "role", guard_hubs)] = 1
    pe4, _ = crisp_persistence(role["P"], role["mu"], 2 * bottom + guard)
    wr, _ = rev_spectrum(role["P"], role["mu"])
    splits["seat_x_phase"] = dict(level="role", blocks=4, persistence_excess=pe4,
                                  kyfan_ceiling=float(np.mean(wr[1:4])))
    sectors = {}
    if initiative == "symmetric":
        for level in ("state", "role"):
            perm = swap_perm(K, qp, lvs, level)
            if perm is None:
                sectors[level] = dict(status="index set not swap-invariant")
                continue
            sec = involution_sectors(lvs[level]["P"], lvs[level]["mu"], perm)
            seat_ls = splits["seat"]["levels"][level]["two_block_eigenvalue"]
            phase_ls = splits["phase"]["levels"][level]["two_block_eigenvalue"]
            loc_ls = splits["localized"]["levels"][level]["two_block_eigenvalue"]
            if (seat_ls > sec["odd_lambda1"] + 1e-10 or max(phase_ls, loc_ls) > sec["even_lambda2"] + 1e-10
                    or sec["asymmetry_P"] > 1e-9):
                raise ArithmeticError("sector certificate violated at %s level" % level)
            sectors[level] = dict(even_top4=sec["even"][:4], odd_top4=sec["odd"][:4],
                                  even_lambda2=sec["even_lambda2"], odd_lambda1=sec["odd_lambda1"],
                                  seat_lam_star=seat_ls, phase_lam_star=phase_ls, localized_lam_star=loc_ls,
                                  asymmetry_P=sec["asymmetry_P"], asymmetry_mu=sec["asymmetry_mu"])
    res["splits"] = splits
    res["sectors"] = sectors

    # ---- the real killed roll from standing -------------------------------------------------
    lu = K.fundamental()
    Qp = (K.Q1 + K.Q0 @ K.Q1).tocsr()
    roll = expected_roll(K)
    whole = np.ones(K.n_t, dtype=bool)
    res["roll"] = dict(standing_me=roll["starts"]["standing_me"], standing_coin=roll["starts"]["standing_coin"],
                       clocked_plies_me=clocked_sojourn(Qp, K.start("standing", "me"), whole, HORIZONS)["roll"],
                       clocked_plies_coin=clocked_sojourn(Qp, K.start("standing", "coin"), whole, HORIZONS)["roll"],
                       neumann_cross_check_error=roll["independent_max_error"])
    gs, ss, ls = set(guard_hubs), set(sign_hubs), set(loc_hubs)
    sides = {
        "seat:/bottom": transient_mask(K, lambda r: K.role_of[r] == "bottom"),
        "seat:/top": transient_mask(K, lambda r: K.role_of[r] == "top"),
        "phase:guard/standing": transient_mask(K, lambda r: K.hub_of[r] in gs),
        "phase:passed/pinned": transient_mask(K, lambda r: K.hub_of[r] not in gs),
        "phase_sign:guard/standing": transient_mask(K, lambda r: K.hub_of[r] in ss),
        "phase_sign:passed/pinned": transient_mask(K, lambda r: K.hub_of[r] not in ss),
        "localized": transient_mask(K, lambda r: K.hub_of[r] in ls),
    }
    res["real_roll_sojourn"] = {name: real_roll(K, m, lu, Qp) for name, m in sides.items()}

    # ---- best sets per size (holding, mass cap 1/2) and size-free optima --------------------
    best, size_free, full_sets = {}, {}, {}
    for level in LEVELS:
        P, mu, names = lvs[level]["P"], lvs[level]["mu"], lvs[level]["names"]
        hs = holding_search(P, mu, sizes=SIZES, cap=0.5)
        best[level] = [dict(size=r["size"], **set_row(r, names, np.asarray(r["indices"]), mu))
                       for r in hs["results"]]
        full_sets[level] = [dict(size=r["size"], members=sorted(names[i] for i in r["indices"]))
                            for r in hs["results"]]
        w, F = rev_spectrum(P, mu)
        seeds = spectral_seeds(P, mu, F)
        named = {"phase": units_from_hubs(K, qp, lvs, level, guard_hubs)}
        if level != "hub":
            named["seat"] = seat_units(K, lvs[level], level)
        named_list = list(named.values())
        named_c = [np.setdiff1d(np.arange(len(P)), u) for u in named_list]
        hv, hS, hcov = free_holding_search(P, mu, seeds + named_list + named_c
                                           + [np.asarray(r["indices"]) for r in hs["results"]], cap=0.5)
        tv, tS, tcov = two_block_search(P, mu, seeds + named_list + [[i] for i in range(len(P))])
        bv, bS, bcov = two_block_search(P, mu, seeds + named_list, min_mass=BETA0)
        if mu[tS].sum() > 0.5:
            tS = np.setdiff1d(np.arange(len(P)), tS)
        agree = {}
        for nm, u in named.items():
            x, y = np.zeros(len(P), bool), np.zeros(len(P), bool)
            x[bS], y[u] = True, True
            same = float(mu[x == y].sum())
            agree[nm] = max(same, 1 - same)          # mu-mass classified alike, up to side labels
        size_free[level] = dict(
            lambda2_R=float(w[1]),
            max_holding_cap_half=set_row(set_statistics(P, mu, hS, lambda2=w[1]), names, hS, mu),
            max_holding_coverage=hcov,
            max_two_block_localized=set_row(set_statistics(P, mu, tS, lambda2=w[1]), names, tS, mu),
            localized_certificate_gap=float(w[1] - tv), localized_coverage=tcov,
            max_two_block_balanced=dict(set_row(set_statistics(P, mu, bS, lambda2=w[1]), names, bS, mu),
                                        mu_agreement_with=agree, beta=BETA0),
            balanced_certificate_gap=float(w[1] - bv), balanced_coverage=bcov)
        full_sets["size_free_" + level] = dict(max_holding=sorted(names[i] for i in hS),
                                               localized=sorted(names[i] for i in tS),
                                               balanced=sorted(names[i] for i in bS))
    res["best_sets_by_size"] = best
    res["size_free"] = size_free
    res["gpcca"] = {level: gpcca_table(lvs[level]["P"], lvs[level]["mu"]) for level in ("hub", "role")}
    k2 = gpcca_k2_blocks(lvs["hub"]["P"], lvs["hub"]["mu"], hub_names)
    row2 = next(r for r in res["gpcca"]["hub"] if r["k"] == 2)
    if abs(row2["crispness"] - k2["crispness"]) > 1e-12 or \
            abs(row2["mass_with_membership_ge_0_9"] - k2["mass_with_membership_ge_0_9"]) > 1e-12:
        raise ArithmeticError("k = 2 blocks disagree with the gpcca table row")
    res["gpcca_k2_blocks"] = k2
    seconds = time.time() - t0              # printed only: a wall-clock field would break byte-identical reruns
    if verbose:
        print("[territories] %s: %d Q-process states, lambda2(R) state/role/hub %.4f/%.4f/%.4f, lam* "
              "seat %.4f phase %.4f (plateau beta %s) sign %.4f localized %.4f [%d hubs] (%.1fs)"
              % (tag, len(idx), lam2["state"], lam2["role"], lam2["hub"],
                 splits["seat"]["levels"]["role"]["two_block_eigenvalue"], ph["phase_value"], ph["plateau"],
                 splits["phase_sign"]["levels"]["hub"]["two_block_eigenvalue"], ph["localized_value"],
                 len(loc_hubs), seconds), flush=True)
    ctx = dict(K=K, qp=qp, lvs=lvs, guard_hubs=guard_hubs, loc_hubs=loc_hubs, full_sets=full_sets,
               lu=lu, Qp=Qp)
    return res, ctx


def gpcca_table(P, mu):
    """G-PCCA+ k = 2..8: crispness, three persistence readings, and the P7 identity (asserted)."""
    w, _ = rev_spectrum(P, mu)
    rows = []
    for k in KS:
        try:
            r = gpcca(P, mu, k)
        except SchurPairSplitError as err:
            rows.append(dict(k=k, status="rejected: k splits a complex-conjugate Schur pair", detail=str(err)))
            continue
        except (RuntimeError, ArithmeticError) as err:
            rows.append(dict(k=k, status="failed: %s" % type(err).__name__, detail=str(err)))
            continue
        sel = np.asarray(r["eigenvalues"])
        mean_sel = float((sel.real.sum() - 1) / (k - 1))
        pe = r["persistence_excess"]
        p7_error = None if pe is None else abs(pe - mean_sel)
        if p7_error is not None and p7_error > 1e-7:
            raise ArithmeticError("P7 violated: Galerkin persistence %.12f != mean selected eigenvalue %.12f"
                                  % (pe, mean_sel))
        chi = r["chi"]
        labels = _labels(np.argmax(chi, axis=1))
        k_eff = int(labels.max() + 1)
        pe_crisp = crisp_persistence(P, mu, labels)[0] if k_eff > 1 else None
        kyfan = float(np.mean(w[1:k_eff])) if k_eff > 1 else None
        if pe_crisp is not None and pe_crisp > kyfan + 1e-10:
            raise ArithmeticError("P7 crisp Ky Fan ceiling violated")
        rows.append(dict(k=k, status=r["coarse_status"], crispness=r["crispness"], minChi=r["minChi"],
                         persistence_excess_galerkin=pe, mean_selected_eigenvalue=mean_sel,
                         p7_error=p7_error, persistence_excess_flux=r["persistence_excess_flux"],
                         crisp_argmax_blocks=k_eff, crisp_argmax_persistence=pe_crisp,
                         kyfan_ceiling_crisp=kyfan,
                         mass_with_membership_ge_0_9=float(mu[chi.max(axis=1) >= 0.9].sum()),
                         coarse_is_stochastic=r["coarse_is_stochastic"],
                         optimiser=r["optimisation"].get("method")))
    return rows


def gpcca_k2_blocks(P, mu, names, universe=LEG_UNIVERSE):
    """The k = 2 G-PCCA+ decomposition at hub level, block by block, named by content.

    Per block: the argmax members, their mu-mass, the self-overlap S_aa = <chi_a,chi_a>/<chi_a,1>
    (the diagonal of Roeblitz-Weber's S; crispness = mean S_aa), the crisp mass (mu of the hubs with
    chi_a >= 0.9, necessarily argmax members) and the fuzzy mass mu.chi_a. The LIGHTER block is
    named the leg-entanglement cluster only if its members lie inside the leg-set universe, and
    after the member whose mu is largest otherwise, so a changed block can never keep the leg
    name silently; the heavier block is the rest of the map.
    """
    r = gpcca(P, mu, 2)
    chi = r["chi"]
    lab = np.argmax(chi, axis=1)
    S = np.diag(chi.T @ (mu[:, None] * chi)) / (mu @ chi)
    blocks = []
    for a in range(2):
        mem = np.flatnonzero(lab == a)
        blocks.append(dict(members=sorted(names[i] for i in mem), count=int(len(mem)),
                           mu_mass=float(mu[mem].sum()), self_overlap=float(S[a]),
                           crisp_mass=float(mu[mem][chi[mem, a] >= 0.9].sum()), fuzzy_mass=float(mu @ chi[:, a]),
                           heaviest=names[int(mem[np.argmax(mu[mem])])] if len(mem) else None))
    blocks.sort(key=lambda b: (b["mu_mass"], b["members"]))
    light, heavy = blocks
    outside = sorted(set(light["members"]) - set(universe))
    light.update(role="lighter", within_leg_universe=not outside, outside_leg_universe=outside,
                 name=LEG_NAME if not outside else "cluster around %s" % light["heaviest"])
    heavy.update(role="heavier", name=REST_NAME)
    crisp_all = float(mu[chi.max(axis=1) >= 0.9].sum())
    err = max(abs(np.mean(S) - r["crispness"]), abs(light["crisp_mass"] + heavy["crisp_mass"] - crisp_all),
              abs(light["mu_mass"] + heavy["mu_mass"] - 1), abs(light["fuzzy_mass"] + heavy["fuzzy_mass"] - 1))
    if err > 1e-9:
        raise ArithmeticError("k = 2 block bookkeeping disagrees with the decomposition (%.3g)" % err)
    return dict(level="hub", k=2, crispness=r["crispness"], mass_with_membership_ge_0_9=crisp_all,
                blocks=[light, heavy], identity_error=err,
                definition="G-PCCA+ k = 2 on the hub-lumped Q-process; blocks by argmax membership; "
                           "self_overlap = S_aa (crispness = their mean); crisp mass = mu with chi_a >= 0.9")


# --------------------------------------------------------------------------- #
# the map equation (hub-lumped Q-process)
# --------------------------------------------------------------------------- #
def module_label(j, labels, mu, names):
    """'M<j> <heaviest hub>': the ONE module label used by the map table and technique territories."""
    mem = np.flatnonzero(labels == j)
    heavy = max(mem, key=lambda i: (mu[i], names[i]))
    return "M%02d %s" % (j, names[heavy])


def relabel_by_mass(labels, mu):
    labels = _labels(labels)
    mass = np.bincount(labels, weights=mu)
    order = sorted(range(len(mass)), key=lambda m: (-mass[m], int(np.flatnonzero(labels == m)[0])))
    new = np.empty(len(mass), dtype=int)
    new[order] = np.arange(len(mass))
    return new[labels]


def map_block(lv_hub, guard_hubs, restarts=32, K=None, lu=None, Qp=None):
    P, mu, names = lv_hub["P"], lv_hub["mu"], lv_hub["names"]
    m = map_equation_search(P, mu, restarts=restarts)
    labels = relabel_by_mass(m["partition"], mu)
    w, _ = rev_spectrum(P, mu)
    mods = module_summary(P, mu, labels, names, names, lambda2=w[1])
    gset = set(guard_hubs)
    phase = np.array([1 if n in gset else 0 for n in names])
    nmod = int(labels.max() + 1)
    purity_mu = sum(max(float(mu[(labels == j) & (phase == 1)].sum()), float(mu[(labels == j) & (phase == 0)].sum()))
                    for j in range(nmod))
    straddle = [j for j in range(nmod) if (phase[labels == j] == 1).any() and (phase[labels == j] == 0).any()]
    table = []
    # `module_summary` renumbers modules by first appearance; OUR label j is the mass order. Join the
    # two on hub NAMES and assert set equality — an index join here printed a right-looking wrong
    # phase side in the first run (CLAUDE.md 6.6), so the join now refuses to guess.
    pos = {n: i for i, n in enumerate(names)}
    for row in mods:
        js = {int(labels[pos[h]]) for h in row["hubs"]}
        if len(js) != 1:
            raise ArithmeticError("module_summary row spans several of our modules")
        j = js.pop()
        if set(row["hubs"]) != {names[i] for i in np.flatnonzero(labels == j)}:
            raise ArithmeticError("module join is not a set equality")
        sides = {int(phase[pos[h]]) for h in row["hubs"]}
        entry = dict(module=j, label=module_label(j, labels, mu, names), hubs=row["states"],
                     mu=row["mu_mass"], top3=[(t["hub"], t["mu"]) for t in row["top3_hubs"]],
                     members=row["hubs"] if row["states"] <= 15 else None,
                     internal_flow=row["internal_flow_share"], holding=row["holding"],
                     residence_steps=row.get("residence_steps"),
                     two_block_eigenvalue=row.get("two_block_eigenvalue"),
                     phase_side="straddles" if len(sides) > 1 else ("guard/standing" if sides == {1}
                                                                     else "passed/pinned"))
        if K is not None:
            hubs = set(row["hubs"])
            rr = real_roll(K, transient_mask(K, lambda r, hubs=hubs: K.hub_of[r] in hubs), lu, Qp)["coin"]
            entry["real_roll_coin"] = dict(p_visit=rr["p_visit"], capture=rr["capture"],
                                           sojourn_steps=rr["steps"]["sojourn"], sojourn_plies=rr["plies"]["sojourn"],
                                           sojourn_clocked_plies=rr["clocked_plies"]["sojourn"],
                                           time_share_steps=rr["steps"]["share"])
        table.append(entry)
    table.sort(key=lambda r: r["module"])
    return dict(L=m["L"], one_module_L=m["one_module_L"], saving=m["saving"],
                saving_share=m["saving"] / m["one_module_L"], modules=nmod,
                singletons=int(sum(1 for r in mods if r["states"] == 1)),
                spread=dict(min=m["spread"]["min"], median=m["spread"]["median"], max=m["spread"]["max"],
                            top5_pairwise_nmi_min=min(p["nmi"] for p in m["spread"]["top5_pairwise_nmi"])),
                restarts=restarts, coverage=m["coverage"], module_table=table,
                vs_phase=dict(partition_similarity(labels, phase), refinement_purity_mu=purity_mu,
                              straddling_modules=len(straddle),
                              straddling_mu=float(sum(mu[labels == j].sum() for j in straddle)))), labels


# --------------------------------------------------------------------------- #
# technique territories (item 4)
# --------------------------------------------------------------------------- #
def technique_territories(K, qp, lv_hub, labels, top=30):
    """Every dealt technique gets its ORIGIN hub's module (fromPositionId); a border crosser is a
    success-branch landing in another module. Weighted by the Q-process stationary flow of the
    cell (mu_i * mass * phi_j / (lam * phi_i)), with expected crossings per roll from standing."""
    g = K.graph
    idx, mu, phi, lam = qp["idx"], qp["mu"], qp["phi"], qp["lam"]
    pos = -np.ones(K.n_t, dtype=int)
    pos[idx] = np.arange(len(idx))
    names = lv_hub["names"]
    hub_mod = {n: int(labels[i]) for i, n in enumerate(names)}
    mod_label = {j: module_label(j, labels, lv_hub["mu"], names) for j in range(labels.max() + 1)}
    c = K.cells
    trans = (c["act"] >= 0) & (c["dst"] >= 0)
    src_in = pos[c["src"]] >= 0
    dst_pos = np.where(c["dst"] >= 0, pos[np.maximum(c["dst"], 0)], -1)
    if np.any(trans & src_in & (dst_pos < 0)):
        raise ArithmeticError("a reachable state leads outside the Q-process index set")
    use = trans & src_in
    sp_ = pos[c["src"][use]]
    dp_ = dst_pos[use]
    flow = mu[sp_] * c["mass"][use] * phi[dp_] / (lam * phi[sp_])
    F = sp.csr_matrix((flow, (sp_, dp_)), shape=(len(idx), len(idx))).toarray()
    flow_err = float(np.max(abs(F - mu[:, None] * qp["Pq"])))
    if flow_err > 1e-12 or abs(F.sum() - 1) > 1e-10:
        raise ArithmeticError("technique cell flows do not reassemble the Q-process flow (%.3g)" % flow_err)
    nu = K.fundamental().solve(K.start("standing", "coin"), "T")
    acts = K.actions
    cells_used = np.flatnonzero(use)
    per, unjoined = {}, set()
    for k, ci in enumerate(cells_used):
        a = acts[c["act"][ci]]
        tid = a["target"]
        node = g[a["cat"]].get(tid + "/attacker") or {}
        origin = node.get("fromPositionId")
        rec = per.setdefault(tid, dict(name=node.get("name") or tid, cat=a["cat"], origin_hub=origin,
                                       success=0.0, cross=0.0, per_roll_cross=0.0, dest={}))
        if origin not in hub_mod:
            unjoined.add(tid)
            continue
        if c["branch"][ci] != 0:
            continue
        dhub = K.hub_of[int(c["dst"][ci]) % K.n_r]
        f = float(flow[k])
        rec["success"] += f
        if hub_mod[dhub] != hub_mod[origin]:
            rec["cross"] += f
            rec["per_roll_cross"] += float(nu[c["src"][ci]] * c["mass"][ci])
            rec["dest"][hub_mod[dhub]] = rec["dest"].get(hub_mod[dhub], 0.0) + f
    joined = [t for t in per if t not in unjoined]
    share_joined = len(joined) / max(1, len(per))
    if not per or share_joined < FLOOR_TECH_JOIN:
        raise SystemExit("[territories] technique origin join covers %.3f < %.2f" % (share_joined, FLOOR_TECH_JOIN))
    # authored geometry: share of the success branch's cell weight landing in another module
    ai_of = {}
    for i, a in enumerate(acts):
        if a["performer"] == "me" and a["target"] not in ai_of:
            ai_of[a["target"]] = i
    geo = {}
    for tid in joined:
        if tid not in ai_of:
            continue
        rows = c[(c["act"] == ai_of[tid]) & (c["branch"] == 0)]
        cw = rows["wcw"] / acts[ai_of[tid]]["pi"]
        land = rows["dst"] >= 0
        om = hub_mod[per[tid]["origin_hub"]]
        crossing = np.array([d >= 0 and hub_mod.get(K.hub_of[int(d) % K.n_r], -1) != om for d in rows["dst"]])
        tot = float(cw.sum())
        geo[tid] = dict(finish_share=float(cw[~land].sum() / tot) if tot else None,
                        crossing_share=float(cw[crossing].sum() / tot) if tot else None)
    total_cross = sum(per[t]["cross"] for t in joined)
    ranked = sorted(joined, key=lambda t: (-per[t]["cross"], t))
    table = []
    for t in ranked[:top]:
        r = per[t]
        dest = sorted(r["dest"].items(), key=lambda kv: (-kv[1], kv[0]))[:2]
        table.append(dict(technique=t, name=r["name"], category=r["cat"], origin_hub=r["origin_hub"],
                          origin_module=mod_label[hub_mod[r["origin_hub"]]], crossing_flow=r["cross"],
                          share_of_own_success_flow=r["cross"] / r["success"] if r["success"] else None,
                          share_of_all_crossing=r["cross"] / total_cross if total_cross else None,
                          crossings_per_roll_standing_coin=r["per_roll_cross"], authored=geo.get(t),
                          destinations=[(mod_label[m], f / r["cross"]) for m, f in dest]))
    by_module = {}
    for t in joined:
        lab = mod_label[hub_mod[per[t]["origin_hub"]]]
        by_module[lab] = by_module.get(lab, 0) + 1
    full = {t: dict(per[t], dest={mod_label[m]: f for m, f in per[t]["dest"].items()},
                    module=mod_label[hub_mod[per[t]["origin_hub"]]], authored=geo.get(t)) for t in joined}
    crossing_total_per_roll = sum(per[t]["per_roll_cross"] for t in joined)
    return dict(coverage=dict(techniques_seen=len(per), techniques_joined=len(joined), join_share=share_joined,
                              unjoined=sorted(unjoined), cells=int(len(cells_used)), flow_reassembly_error=flow_err),
                total_crossing_success_flow=total_cross, crossings_per_roll_all=crossing_total_per_roll,
                top30_share_of_crossing=sum(r["share_of_all_crossing"] for r in table),
                techniques_per_module=dict(sorted(by_module.items())), top=table), full


# --------------------------------------------------------------------------- #
# perturbation ensembles (ruling 1)
# --------------------------------------------------------------------------- #
def robustness(K, base_lvs, base_guard, base_loc, seeds, eps=0.2):
    names = base_lvs["hub"]["names"]
    base = np.array([n in set(base_guard) for n in names])
    base_l = set(base_loc)
    same = np.zeros(len(names))
    rows = []
    for seed in seeds:
        pert = K.perturbed(eps, eps, seed)
        qp = qprocess(K, pert["Q"])
        lvs = levels_of(K, qp)
        if lvs["hub"]["names"] != names:
            raise ArithmeticError("perturbation changed the hub index set")
        ph = phase_split(lvs["hub"], frontier=False)
        side = np.zeros(len(names), bool)
        side[ph["phase"]] = True
        same += (side == base)
        loc = {names[i] for i in ph["localized"]}
        w_state = rev_spectrum(lvs["state"]["P"], lvs["state"]["mu"], check=False)[0][1]
        w_role = rev_spectrum(lvs["role"]["P"], lvs["role"]["mu"], check=False)[0][1]
        seat_ls = set_statistics(lvs["role"]["P"], lvs["role"]["mu"],
                                 seat_units(K, lvs["role"], "role"))["two_block_eigenvalue"]
        lu = spla.splu((sp.identity(K.n_t, format="csc") - pert["Q"].tocsc()))
        steps = float(K.start("standing", "coin") @ lu.solve(np.ones(K.n_t)))
        rows.append(dict(seed=seed, lambda2_state=float(w_state), lambda2_role=float(w_role),
                         lambda2_hub=ph["lambda2"], phase_lam_star=ph["phase_value"], seat_lam_star=seat_ls,
                         localized_lam_star=ph["localized_value"],
                         localized_jaccard=len(loc & base_l) / len(loc | base_l),
                         cheeger_ceiling_state=2 / (1 - w_state), roll_steps_standing_coin=steps,
                         phase_hubs_moved=int((side != base).sum()),
                         phase_mu_moved=float(lvs["hub"]["mu"][side != base].sum())))
    frac = same / len(seeds)

    def q(key):
        v = np.array([r[key] for r in rows])
        return dict(min=float(v.min()), median=float(np.median(v)), max=float(v.max()))
    return dict(eps_attempt=eps, eps_rate=eps, seeds=[int(seeds[0]), int(seeds[-1])], n=len(seeds),
                per_hub_same_side={names[i]: float(frac[i]) for i in range(len(names))},
                hubs_ge_0_95=int((frac >= 0.95).sum()), hubs_lt_0_5=int((frac < 0.5).sum()),
                mu_weighted_same_side=float(base_lvs["hub"]["mu"] @ frac),
                summary={k: q(k) for k in ("lambda2_state", "lambda2_role", "lambda2_hub", "phase_lam_star",
                                           "seat_lam_star", "localized_lam_star", "localized_jaccard",
                                           "cheeger_ceiling_state", "roll_steps_standing_coin",
                                           "phase_hubs_moved", "phase_mu_moved")},
                ceiling_below_roll_share=float(np.mean([r["cheeger_ceiling_state"] < r["roll_steps_standing_coin"]
                                                        for r in rows])),
                phase_slower_than_seat_share=float(np.mean([r["phase_lam_star"] > r["seat_lam_star"] for r in rows])),
                localized_identical_share=float(np.mean([r["localized_jaccard"] == 1.0 for r in rows])),
                regimes=dict(same_split_share=float(np.mean([r["phase_mu_moved"] <= 0.05 for r in rows])),
                             same_split_max_hubs_moved=int(max([r["phase_hubs_moved"] for r in rows
                                                                if r["phase_mu_moved"] <= 0.05], default=-1)),
                             jumped_share=float(np.mean([r["phase_mu_moved"] > 0.05 for r in rows])),
                             definition="same split: the perturbed beta0 optimum moves <= 0.05 of hub mass; "
                                        "jumped: it lands on a different balanced split")), rows


def map_stability(K, base_labels, seeds, eps=0.2, restarts=32):
    rows = []
    for seed in seeds:
        pert = K.perturbed(eps, eps, seed)
        lvs = levels_of(K, qprocess(K, pert["Q"]))
        m = map_equation_search(lvs["hub"]["P"], lvs["hub"]["mu"], restarts=restarts)
        sim = partition_similarity(base_labels, m["partition"])
        rows.append(dict(seed=seed, nmi=sim["nmi"], adjusted_rand=sim["adjusted_rand"], vi=sim["vi"],
                         saving=m["saving"], modules=int(m["partition"].max() + 1)))
    nmi = np.array([r["nmi"] for r in rows])
    return dict(eps_attempt=eps, eps_rate=eps, seeds=[int(seeds[0]), int(seeds[-1])], restarts=restarts,
                nmi=dict(min=float(nmi.min()), median=float(np.median(nmi)), max=float(nmi.max())),
                adjusted_rand_median=float(np.median([r["adjusted_rand"] for r in rows])),
                saving=dict(min=float(min(r["saving"] for r in rows)), max=float(max(r["saving"] for r in rows))),
                modules=dict(min=min(r["modules"] for r in rows), max=max(r["modules"] for r in rows)),
                rows=rows)


# --------------------------------------------------------------------------- #
# comparison with gs-3's exit-law TV territories (joined on hub NAMES, set equality asserted)
# --------------------------------------------------------------------------- #
def load_exit_tv():
    """{our config key: {"k": selected k, "clusters": [(medoid, [hubs])]}} from gs-3's artifact."""
    if not os.path.exists(GEOMETRY):
        raise SystemExit("[territories] %s missing: gs-3's accepted territories are an input here" % GEOMETRY)
    with open(GEOMETRY, encoding="utf-8") as fh:
        cases = json.load(fh)["cases"]
    out = {}
    for ours, theirs in GS3_CASE.items():
        if theirs not in cases:
            raise SystemExit("[territories] geometry.json has no case %r" % theirs)
        e = cases[theirs]["clusterings"]["exit_tv"]
        out[ours] = dict(case=theirs, k=e["selected_k"],
                         clusters=[(c["medoid"], sorted(c["hubs"])) for c in e["clusters"]])
    return out


def compare_exit_tv(names, mu, partitions, tv):
    """NMI/ARI (unweighted over hubs) of each of our hub partitions against gs-3's exit-TV clustering,
    the mu-weighted purity of ours inside theirs (1.0 = ours refines theirs), and per-territory
    Jaccard of every two-block side. The hub sets must be EQUAL: an index join that silently matched
    a subset would print a plausible NMI over the wrong set (CLAUDE.md 6.6)."""
    theirs = {}
    for j, (medoid, hubs) in enumerate(tv["clusters"]):
        for h in hubs:
            if h in theirs:
                raise ArithmeticError("gs-3 hub %s sits in two clusters" % h)
            theirs[h] = j
    if set(theirs) != set(names):
        raise SystemExit("[territories] exit-TV join: %d of our %d hubs, %d of theirs matched — refusing"
                         % (len(set(theirs) & set(names)), len(names), len(theirs)))
    ref = np.array([theirs[n] for n in names])
    out = dict(case=tv["case"], k=tv["k"], hubs_joined=len(names),
               territories=[dict(medoid=m, hubs=len(h), mu=float(sum(mu[names.index(x)] for x in h)))
                            for m, h in tv["clusters"]])
    for label, part in partitions.items():
        part = _labels(np.asarray(part))                 # contiguous labels 0..m-1
        sim = partition_similarity(part, ref)
        purity = sum(max(float(mu[(part == a) & (ref == b)].sum()) for b in range(ref.max() + 1))
                     for a in range(part.max() + 1))
        row = dict(nmi=sim["nmi"], adjusted_rand=sim["adjusted_rand"], vi=sim["vi"], blocks=int(part.max() + 1),
                   purity_mu_ours_in_theirs=purity)
        if part.max() == 1:                      # a two-block split: which territory is each side
            for side in (0, 1):
                S = {names[i] for i in np.flatnonzero(part == side)}
                row["side%d_jaccard" % side] = {m: len(S & set(h)) / len(S | set(h)) for m, h in tv["clusters"]}
        out[label] = row
    return out


# --------------------------------------------------------------------------- #
# the run
# --------------------------------------------------------------------------- #
def load_graph_hashed(path=GRAPH_PATH):
    """Parse graph.json from the SAME bytes that are hashed, so the recorded sha256 names exactly the
    graph every number was computed from (no read-then-hash race)."""
    raw = open(path, "rb").read()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def run(seeds=200, map_seeds=20, write=True, full_out=None):
    t0 = time.time()
    if full_out is not None:
        full_out = os.path.abspath(full_out)
        if full_out.startswith(os.path.join(REPO, "tests", "artifacts") + os.sep):
            raise SystemExit("[territories] --full-out under tests/artifacts/ is refused: the full dump is not committed")
    G, graph_sha = load_graph_hashed()
    out = dict(meta=dict(
        graph_sha256=graph_sha,
        sources=dict(graph=dict(path="graph.json", sha256=graph_sha)),
        item="T2R", seat="gs-1", recompute=RECOMPUTE, game="the corpus's game (both seats sample authored shares)",
        headline=ckey(*PRIMARY), rates="shipped", horizon="infinity unless marked clocked", beta0=BETA0,
        sets=dict(state="Q-process transient states (role-node, turn) reachable from standing",
                  role="role-nodes, both turns lumped by K.lump (mu-weighted)",
                  hub="positions, both seats and both turns lumped by K.lump",
                  real_roll="killed chain K.Q from K.start('standing', first), first in {me, coin}"),
        units=dict(step="one card played", ply="one card, 0 for the kernel's stay-put cells (K.Q0)",
                   clocked_plies="uniform mixture over maxMoves H in {9,10,11,12} plies"),
        propositions="lane-gs-1.md T2R; toys: python3 -B scripts/semantics/_territory_audit.py --selfcheck",
        leg_universe=dict(hubs=sorted(LEG_UNIVERSE), size=len(LEG_UNIVERSE),
                          definition="union of the five leg sets of T3 (M17, LOCALIZED, TV-LEG, R_LEG(3), "
                                     "R_LEG(2)) = gs-5's R_LEG(2), nogi; names G-PCCA+ blocks only; "
                                     "re-derived and asserted by --selfcheck")))
    configs, ctxs = {}, {}
    for frame, initiative, origin in CONFIGS:
        res, ctx = analyse_config(G, frame, initiative, origin)
        configs[ckey(frame, initiative, origin)] = res
        ctxs[ckey(frame, initiative, origin)] = ctx
    out["configs"] = configs
    full = dict(sets={k: c["full_sets"] for k, c in ctxs.items()})

    pk = ckey(*PRIMARY)
    pc = ctxs[pk]
    mp, labels = map_block(pc["lvs"]["hub"], pc["guard_hubs"], K=pc["K"], lu=pc["lu"], Qp=pc["Qp"])
    names = pc["lvs"]["hub"]["names"]
    full["map_partition"] = {n: int(labels[i]) for i, n in enumerate(names)}
    print("[territories] map (%s, hub): %d modules, L %.4f vs %.4f, saving %.4f bits; NMI vs phase %.3f"
          % (pk, mp["modules"], mp["L"], mp["one_module_L"], mp["saving"], mp["vs_phase"]["nmi"]), flush=True)
    stab = map_stability(pc["K"], labels, list(range(map_seeds)))
    full["map_stability_rows"] = stab.pop("rows")
    mp["stability"] = stab
    print("[territories] map stability over %d corpus perturbations: NMI min/median %.3f/%.3f"
          % (map_seeds, stab["nmi"]["min"], stab["nmi"]["median"]), flush=True)
    others, map_labels = {}, {pk: labels}
    for k, c in ctxs.items():
        if k == pk:
            continue
        m2, lab2 = map_block(c["lvs"]["hub"], c["guard_hubs"])
        map_labels[k] = lab2
        common = [n for n in names if n in set(c["lvs"]["hub"]["names"])]
        a = [labels[names.index(n)] for n in common]
        b = [lab2[c["lvs"]["hub"]["names"].index(n)] for n in common]
        others[k] = dict(L=m2["L"], one_module_L=m2["one_module_L"], saving=m2["saving"], modules=m2["modules"],
                         nmi_vs_headline=partition_similarity(a, b)["nmi"], common_hubs=len(common),
                         vs_own_phase_nmi=m2["vs_phase"]["nmi"],
                         vs_own_phase_purity_mu=m2["vs_phase"]["refinement_purity_mu"],
                         top_modules=[(r["label"], r["mu"], r["hubs"]) for r in m2["module_table"][:8]])
    mp["other_configs"] = others
    out["map_equation"] = {pk: mp}

    tv = load_exit_tv()
    vs_tv = {}
    for k, c in ctxs.items():
        hn, hmu = c["lvs"]["hub"]["names"], c["lvs"]["hub"]["mu"]
        two = lambda hubs: np.array([1 if n in set(hubs) else 0 for n in hn])
        sign = [hn[i] for i in phase_split(c["lvs"]["hub"], frontier=False, localized=False)["sign"]]
        vs_tv[k] = compare_exit_tv(hn, hmu, {"map_modules": map_labels[k], "phase": two(c["guard_hubs"]),
                                             "phase_sign": two(sign), "localized": two(c["loc_hubs"]),
                                             "phase_x_localized": 2 * two(c["guard_hubs"]) + two(c["loc_hubs"])},
                                   tv[k])
    out["vs_exit_tv_territories"] = vs_tv
    polished = {}
    hn, hmu, hP = names, pc["lvs"]["hub"]["mu"], pc["lvs"]["hub"]["P"]
    w_h = rev_spectrum(hP, hmu)[0][1]
    phase_val = configs[pk]["splits"]["phase"]["levels"]["hub"]["two_block_eigenvalue"]
    for medoid, hubs in tv[pk]["clusters"]:
        T0 = np.array(sorted(hn.index(h) for h in hubs))
        m0 = float(hmu[T0].sum())
        floor = BETA0 if min(m0, 1 - m0) >= BETA0 else 0.0
        st0 = set_statistics(hP, hmu, T0, lambda2=w_h)
        # one seed, single-hub flips: the returned side IS the territory, evolved
        pv, PS, pcov = two_block_search(hP, hmu, [T0], min_mass=floor)
        A, B = {hn[i] for i in T0}, {hn[i] for i in PS}
        polished[medoid] = dict(hubs=len(A), mu=m0, lam_star=st0["two_block_eigenvalue"], floor=floor,
                                polished_lam_star=pv, polished_hubs=len(B), polished_mu=float(hmu[PS].sum()),
                                jaccard=len(A & B) / len(A | B), added=sorted(B - A), dropped=sorted(A - B),
                                gap_to_phase=pv - phase_val, flips=pcov["flips"])
    out["exit_tv_polished"] = {pk: dict(territories=polished, phase_lam_star=phase_val, lambda2_hub=w_h,
                                        definition="local max of lam* (single-hub flips) seeded AT each gs-3 "
                                                   "territory; floor beta0 when the territory holds >= beta0")}
    p = vs_tv[pk]
    print("[territories] vs gs-3 exit-TV territories (%s, k=%d): map NMI %.3f ARI %.3f purity %.3f; phase NMI %.3f;"
          " localized Jaccard vs LEG %.3f" % (pk, p["k"], p["map_modules"]["nmi"], p["map_modules"]["adjusted_rand"],
                                              p["map_modules"]["purity_mu_ours_in_theirs"], p["phase"]["nmi"],
                                              p["localized"]["side1_jaccard"].get("inside-ashi-garami", float("nan"))),
          flush=True)

    tt, tfull = technique_territories(pc["K"], pc["qp"], pc["lvs"]["hub"], labels)
    out["technique_territories"] = {pk: tt}
    full["technique_territories"] = tfull

    base = set(pc["guard_hubs"])
    cross = {}
    for k, c in ctxs.items():
        if k == pk:
            continue
        other, present = set(c["guard_hubs"]), set(c["lvs"]["hub"]["names"])
        common = [n for n in names if n in present]
        agree = [n for n in common if (n in base) == (n in other)]
        loc = set(c["loc_hubs"])
        cross[k] = dict(common_hubs=len(common), same_side=len(agree),
                        mu_same_side=float(sum(pc["lvs"]["hub"]["mu"][names.index(n)] for n in agree)),
                        differ=sorted(set(common) - set(agree)), localized=sorted(loc),
                        localized_jaccard_vs_headline=len(loc & set(pc["loc_hubs"])) / len(loc | set(pc["loc_hubs"])))
    rob, rob_rows = robustness(pc["K"], pc["lvs"], pc["guard_hubs"], pc["loc_hubs"], list(range(seeds)))
    full["robustness_rows"] = rob_rows
    print("[territories] phase robustness over %d corpus perturbations: %d/%d hubs keep their side in >= 95%%"
          % (seeds, rob["hubs_ge_0_95"], len(names)), flush=True)
    per_hub = {}
    for n in names:
        per_hub[n] = dict(side="guard/standing" if n in base else "passed/pinned",
                          perturbed_same_side=rob["per_hub_same_side"][n],
                          **{k: (None if n not in set(ctxs[k]["lvs"]["hub"]["names"])
                                 else ((n in set(ctxs[k]["guard_hubs"])) == (n in base))) for k in cross})
    rob.pop("per_hub_same_side")
    out["phase_robustness"] = {pk: dict(ensemble=rob, across_configs=cross, per_hub=per_hub)}
    out = _clean(out)
    if write:
        text = json.dumps(out, sort_keys=True, indent=1)
        if len(text.encode()) >= 1_000_000:
            raise SystemExit("[territories] artifact would be %d bytes (>= 1 MB budget)" % len(text.encode()))
        with open(ARTIFACT, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
        print("[territories] wrote %s (%d bytes; graph.json sha256 %s…) (%.0fs)"
              % (os.path.relpath(ARTIFACT, REPO), len(text.encode()), graph_sha[:12], time.time() - t0), flush=True)
    if full_out is not None:
        os.makedirs(os.path.dirname(full_out) or ".", exist_ok=True)
        with open(full_out, "w", encoding="utf-8") as fh:
            json.dump(_clean(full), fh, sort_keys=True, indent=1)
        print("[territories] wrote the full dump to %s" % full_out, flush=True)
    return out


# --------------------------------------------------------------------------- #
# selfcheck: the toys, then every proposition on the REAL kernel
# --------------------------------------------------------------------------- #
def selfcheck():
    audit.selfcheck()
    records = []

    def check(name, ok, **detail):
        records.append(dict(name=name, status="PASS" if ok else "FAIL", **_clean(detail)))
        print(json.dumps(records[-1], sort_keys=True), flush=True)

    G = load_graph()
    for frame, initiative, origin in (PRIMARY, ("nogi", "shipped", True)):
        tag = ckey(frame, initiative, origin)
        K = load_kernel(frame, initiative, "shipped", graph=G, origin=origin)
        qp = qprocess(K)
        # (1) the SimpleNamespace route IS the kernel's code: an eps = 0 perturbation reproduces it
        qp0 = qprocess(K, K.perturbed(0.0, 0.0, 0)["Q"])
        err = float(max(np.max(abs(qp0["Pq"] - qp["Pq"])), np.max(abs(qp0["mu"] - qp["mu"]))))
        check("%s qprocess.namespace_route" % tag, err < 1e-12, max_error=err, states=len(qp["idx"]))
        # (2) an independent route to the Perron root and vectors: power iteration
        Qr = K.Q.toarray()[np.ix_(qp["idx"], qp["idx"])]
        x = np.ones(len(Qr)) / len(Qr)
        y = x.copy()
        for _ in range(3000):
            x = Qr @ x
            x /= x.sum()
            y = y @ Qr
            y /= y.sum()
        lam_pi = float((Qr @ x).sum() / x.sum())
        mu_pi = x * y / (x * y).sum()
        err = float(max(abs(lam_pi - qp["lam"]), np.max(abs(mu_pi - qp["mu"]))))
        check("%s qprocess.power_iteration" % tag, err < 1e-9, max_error=err, lam=qp["lam"])
        lvs = levels_of(K, qp)
        spc = spectra(lvs, qp)
        lam2 = {lv: spc[lv]["lambda2_R"] for lv in LEVELS}
        check("%s P5.interlacing_hub_role_state" % tag, lam2["hub"] <= lam2["role"] <= lam2["state"], lambda2=lam2)
        check("%s P6.numerical_range_all_levels" % tag, all(spc[lv]["p6_holds"] for lv in LEVELS),
              max_real={lv: spc[lv]["max_nonunit_real"] for lv in LEVELS}, lambda2=lam2)
        # (3) P1/P2/P3 on random subsets of every level (set_statistics raises on any disagreement)
        rng = np.random.default_rng(2718)
        worst, slack, n_sets = 0.0, np.inf, 0
        for lv in LEVELS:
            P, mu = lvs[lv]["P"], lvs[lv]["mu"]
            for _ in range(150):
                S = rng.choice(len(P), int(rng.integers(1, len(P))), replace=False)
                st = set_statistics(P, mu, S, lambda2=lam2[lv])
                worst, slack, n_sets = max(worst, st["identity_error"]), min(slack, st["p3_slack"]), n_sets + 1
        check("%s P1P2P3.random_subsets" % tag, worst < 1e-9 and slack >= -1e-10 and n_sets == 450,
              sets=n_sets, max_identity_error=worst, min_p3_slack=slack)
        # (4) named splits: identical lam* at every level they are representable at (P5), below P3
        ph = phase_split(lvs["hub"])
        hubs = [lvs["hub"]["names"][i] for i in ph["phase"]]
        ls = [set_statistics(lvs[lv]["P"], lvs[lv]["mu"], units_from_hubs(K, qp, lvs, lv, hubs),
                             lambda2=lam2[lv])["two_block_eigenvalue"] for lv in LEVELS]
        seat = [set_statistics(lvs[lv]["P"], lvs[lv]["mu"], seat_units(K, lvs[lv], lv),
                               lambda2=lam2[lv])["two_block_eigenvalue"] for lv in ("state", "role")]
        check("%s P5.named_splits_level_invariant" % tag, max(ls) - min(ls) < 1e-10 and abs(seat[0] - seat[1]) < 1e-10,
              phase=ls, seat=seat)
        ph2 = phase_split(lvs["hub"])
        check("%s phase.deterministic" % tag, np.array_equal(ph["phase"], ph2["phase"])
              and np.array_equal(ph["localized"], ph2["localized"]), guard_hubs=len(hubs))
        pm = float(lvs["hub"]["mu"][ph["phase"]].sum())
        check("%s phase.balanced_and_on_plateau" % tag,
              BETA0 <= pm <= 1 - BETA0 and ph["plateau"][0] <= BETA0 <= ph["plateau"][1]
              and ph["phase_value"] >= set_statistics(lvs["hub"]["P"], lvs["hub"]["mu"], ph["sign"])["two_block_eigenvalue"] - 1e-12
              and ph["phase_value"] <= lam2["hub"] + 1e-12,
              guard_mu=pm, plateau=ph["plateau"], lam_star=ph["phase_value"], lambda2_hub=lam2["hub"])
        loc_mu = float(lvs["hub"]["mu"][ph["localized"]].sum())
        check("%s localized.light_and_below_certificate" % tag,
              0 < loc_mu <= 0.5 and ph["localized_value"] >= ph["phase_value"] - 1e-12
              and ph["localized_value"] <= lam2["hub"] + 1e-12,
              localized_mu=loc_mu, localized_lam_star=ph["localized_value"], hubs=len(ph["localized"]))
        # (5) sectors under the symmetric rule
        if initiative == "symmetric":
            ok, detail = True, {}
            for lv in ("state", "role"):
                sec = involution_sectors(lvs[lv]["P"], lvs[lv]["mu"], swap_perm(K, qp, lvs, lv))
                ok &= seat[0] <= sec["odd_lambda1"] + 1e-10 and ls[0] <= sec["even_lambda2"] + 1e-10
                ok &= sec["asymmetry_P"] < 1e-9 and sec["asymmetry_mu"] < 1e-9
                detail[lv] = dict(odd=sec["odd_lambda1"], even=sec["even_lambda2"], asym=sec["asymmetry_P"])
            # the role level's EVEN sector is exactly the hub-lumped chain (hub-constant functions)
            sec = involution_sectors(lvs["role"]["P"], lvs["role"]["mu"], swap_perm(K, qp, lvs, "role"))
            ok &= abs(sec["even_lambda2"] - lam2["hub"]) < 1e-10
            check("%s sectors.seat_odd_phase_even" % tag, ok, hub_lambda2=lam2["hub"], **detail)
        # (6) the killed roll: two linear routes (asserted inside) and a seeded Monte Carlo
        inside = transient_mask(K, lambda r: K.role_of[r] == "bottom")
        s0 = K.start("standing", "me")
        ply_cost = 1 - np.asarray(K.Q0.sum(axis=1)).ravel()
        st = killed_sojourn(K.Q, s0, inside, np.ones(K.n_t))
        pl = killed_sojourn(K.Q, s0, inside, ply_cost)
        mc = simulate_killed(K.Q0, K.Q1, np.asarray(K.R.sum(axis=1)).ravel(), s0, inside, 30000, 8128)
        tol = 0.05
        check("%s P8.killed_seat_monte_carlo" % tag,
              abs(mc["steps_per_entry"] - st["sojourn"]) < tol and abs(mc["plies_per_entry"] - pl["sojourn"]) < tol
              and abs(mc["entries_per_roll"] - st["entries"]) < tol,
              exact_steps=st["sojourn"], mc_steps=mc["steps_per_entry"], exact_plies=pl["sojourn"],
              mc_plies=mc["plies_per_entry"], exact_entries=st["entries"], mc_entries=mc["entries_per_roll"],
              rolls=30000, seed=8128)
        Qp = (K.Q1 + K.Q0 @ K.Q1).tocsr()
        cl = clocked_sojourn(Qp, s0, inside, [800])
        check("%s P8.clocked_limit_equals_plies" % tag, abs(cl["sojourn"] - pl["sojourn"]) < 1e-8,
              clocked_h800=cl["sojourn"], unclocked_plies=pl["sojourn"])
        roll = expected_roll(K)
        check("%s roll.neumann_cross_check" % tag, roll["independent_max_error"] < 1e-9,
              standing_me=roll["starts"]["standing_me"], error=roll["independent_max_error"])
        # (7) P7 on the real hub chain
        rows = gpcca_table(lvs["hub"]["P"], lvs["hub"]["mu"])
        computed = [r for r in rows if r.get("p7_error") is not None]
        check("%s P7.galerkin_is_spectral_hub" % tag,
              len(computed) >= 3 and max(r["p7_error"] for r in computed) < 1e-7,
              ks=[r["k"] for r in computed], max_error=max((r["p7_error"] for r in computed), default=None))
        # (8) exhaustive: the best capped size-3 hub set
        P, mu = lvs["hub"]["P"], lvs["hub"]["mu"]
        flow = mu[:, None] * P
        W = flow + flow.T
        n = len(P)
        best_brute, sets = -np.inf, 0
        for i in range(n):
            for j in range(i + 1, n):
                ks = np.arange(j + 1, n)
                if not len(ks):
                    continue
                m = mu[i] + mu[j] + mu[ks]
                inner = flow[i, i] + flow[j, j] + W[i, j] + np.diag(flow)[ks] + W[i, ks] + W[j, ks]
                best_brute = max(best_brute, float(np.where(m <= 0.5, inner / m, -np.inf).max()))
                sets += len(ks)
        found = holding_search(P, mu, sizes=[3], cap=0.5)["results"][0]["holding"]
        check("%s search.hub_size3_exhaustive" % tag,
              abs(found - best_brute) < 1e-12 and sets == n * (n - 1) * (n - 2) // 6,
              found=found, exhaustive=best_brute, sets=sets)
        # (9) the join with gs-3's exit-TV territories: set equality, positive and negative controls
        tv = load_exit_tv()[tag]
        names_h = lvs["hub"]["names"]
        own = np.zeros(len(names_h), dtype=int)
        for j, (_m, hs_) in enumerate(tv["clusters"]):
            own[[names_h.index(h) for h in hs_]] = j
        ctl = compare_exit_tv(names_h, lvs["hub"]["mu"], {"theirs": own}, tv)
        refused = False
        try:
            compare_exit_tv(names_h[:-1], lvs["hub"]["mu"][:-1], {"theirs": own[:-1]}, tv)
        except SystemExit:
            refused = True
        check("%s exit_tv.join_controls" % tag,
              ctl["hubs_joined"] == len(names_h) and abs(ctl["theirs"]["nmi"] - 1) < 1e-12
              and abs(ctl["theirs"]["adjusted_rand"] - 1) < 1e-12 and refused,
              hubs=ctl["hubs_joined"], self_nmi=ctl["theirs"]["nmi"], short_join_refused=refused)
        if (frame, initiative, origin) == PRIMARY:
            mb, labels = map_block(lvs["hub"], hubs, restarts=8)
            hn_ = lvs["hub"]["names"]
            prim_sets = dict(localized={hn_[i] for i in ph["localized"]},
                             leg_module={hn_[i] for i in np.flatnonzero(labels == labels[hn_.index("inside-ashi-garami")])})
            tt, _ = technique_territories(K, qp, lvs["hub"], labels, top=5)
            hn = lvs["hub"]["names"]
            gset = set(hubs)
            ok, rows_checked = True, 0
            for row in mb["module_table"]:
                mem = [hn[i] for i in np.flatnonzero(labels == row["module"])]
                ok &= row["label"] == module_label(row["module"], labels, lvs["hub"]["mu"], hn)
                ok &= row["hubs"] == len(mem)
                sides = {h in gset for h in mem}
                want = "straddles" if len(sides) > 1 else ("guard/standing" if sides == {True} else "passed/pinned")
                ok &= row["phase_side"] == want
                rows_checked += 1
            ok &= {r["origin_module"] for r in tt["top"]} <= {r["label"] for r in mb["module_table"]}
            check("%s map.table_joined_by_name" % tag, ok and rows_checked == mb["modules"],
                  modules=rows_checked, standing_module=[r["label"] for r in mb["module_table"]
                                                         if STANDING in (r["members"] or [])])
            check("%s technique.join_and_flow" % tag,
                  tt["coverage"]["join_share"] >= FLOOR_TECH_JOIN and tt["coverage"]["flow_reassembly_error"] < 1e-12
                  and tt["coverage"]["cells"] > 1000, coverage=tt["coverage"])
    # (10) the k = 2 G-PCCA+ blocks, in EVERY configuration: the lighter block is the leg cluster
    ok_all, detail, prim = True, {}, None
    for frame, initiative, origin in CONFIGS:
        tag = ckey(frame, initiative, origin)
        K = load_kernel(frame, initiative, "shipped", graph=G, origin=origin)
        lv = levels_of(K, qprocess(K))["hub"]
        k2 = gpcca_k2_blocks(lv["P"], lv["mu"], lv["names"])
        light, heavy = k2["blocks"]
        ok_all &= (light["within_leg_universe"] and light["name"] == LEG_NAME and heavy["name"] == REST_NAME
                   and light["mu_mass"] < heavy["mu_mass"] and k2["identity_error"] < 1e-9)
        detail[tag] = dict(lighter=light["count"], heavier=heavy["count"], lighter_mu=light["mu_mass"],
                           outside=light["outside_leg_universe"])
        if (frame, initiative, origin) == PRIMARY:
            prim = (lv, k2)
    check("gpcca_k2.lighter_block_is_the_leg_cluster_in_every_config", ok_all and len(detail) == len(CONFIGS),
          **detail)
    # (11) negative control: the name must NOT survive a universe missing one lighter-block member
    lv, k2 = prim
    victim = k2["blocks"][0]["members"][0]
    bad = gpcca_k2_blocks(lv["P"], lv["mu"], lv["names"], universe=LEG_UNIVERSE - {victim})
    check("gpcca_k2.name_can_fail", not bad["blocks"][0]["within_leg_universe"]
          and bad["blocks"][0]["name"] != LEG_NAME and bad["blocks"][0]["outside_leg_universe"] == [victim],
          removed=victim, name_given=bad["blocks"][0]["name"])
    # (12) the frozen universe has not drifted: == gs-5's R_LEG(2) == the union of the five leg sets
    # (read-only; gs-5 and gs-3 files are READ here, never by the build, so the artifact stays self-contained)
    with open(os.path.join(REPO, "tests", "artifacts", "semantics", "naming.json"), encoding="utf-8") as fh:
        leg = json.load(fh)["territories"]["LEG"]
    with open(os.path.join(REPO, "tests", "artifacts", "semantics", "geometry.json"), encoding="utf-8") as fh:
        tv_cl = json.load(fh)["cases"]["nogi/symmetric/shipped"]["clusterings"]["exit_tv"]["clusters"]
    r2 = set(leg["standing_me|ratio|2.0"]["members"])
    r3 = set(leg["standing_me|ratio|3.0"]["members"])
    tv = {h for c in tv_cl if c["medoid"] == "inside-ashi-garami" for h in c["hubs"]}
    union = r2 | r3 | tv | prim_sets["localized"] | prim_sets["leg_module"]
    check("gpcca_k2.leg_universe_not_drifted", set(LEG_UNIVERSE) == r2 == union and len(tv) > 0,
          universe=len(LEG_UNIVERSE), r_leg2=len(r2), union=len(union),
          only_in_constant=sorted(set(LEG_UNIVERSE) - union), only_in_sources=sorted(union - set(LEG_UNIVERSE)))
    failures = [r for r in records if r["status"] != "PASS"]
    ok = not failures and len(records) >= SELFCHECK_FLOOR
    print("%s real-kernel checks: %d run (floor %d), %d failed; %s --selfcheck"
          % ("PASS" if ok else "FAIL", len(records), SELFCHECK_FLOOR, len(failures), RECOMPUTE), flush=True)
    return 0 if ok else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--seeds", type=int, default=200, help="perturbation ensemble size (phase robustness)")
    ap.add_argument("--map-seeds", type=int, default=20, help="perturbation seeds for map stability")
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--full-out", default=None,
                    help="also write the full dump (per-size memberships, per-seed rows, technique table) here; "
                         "default: not written; refused under tests/artifacts/")
    a = ap.parse_args(argv)
    if a.selfcheck:
        return selfcheck()
    if a.seeds < 1 or a.map_seeds < 1:
        raise SystemExit("[territories] refusing an empty ensemble")
    run(seeds=a.seeds, map_seeds=a.map_seeds, write=not a.no_write, full_out=a.full_out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
