#!/usr/bin/env python3
"""Known-answer set and timescale helpers for territories.py; this module never reads the corpus.

Every function takes an explicit chain (P, mu), or a killed kernel (Q, s0, cost), and a state set.
Nothing here builds a transition matrix from graph.json. The one lumping used anywhere is the
kernel's own `Kernel.lump` (a static method: importing it reads no graph). The propositions below
are PROVED in the gs-1 lane file (item T2R), checked on toys with known answers by --selfcheck
here, and checked on the real kernel by `territories.py --selfcheck`.

NOTATION. P row-stochastic and irreducible, stationary mu > 0, L2(mu) inner product
<f,g> = sum_i mu_i f_i g_i, adjoint P* = D^-1 P^T D, additive reversibilisation R = (P+P*)/2
(self-adjoint in L2(mu); 1 = lambda_1(R) >= lambda_2(R) >= ...). For 0 < mu(S) < 1:
F(A,B) = sum_{i in A, j in B} mu_i P_ij, holding h(S) = F(S,S)/mu(S), exit rate e(S) = 1-h(S),
residence r(S) = 1/e(S). Stationarity gives F(S,S^c) = F(S^c,S).

P1 RAYLEIGH   f_S = 1_S - mu(S)1:  <f_S,(I-R)f_S> = F(S,S^c)  and  ||f_S||^2 = mu(S) mu(S^c).
P2 TWO-BLOCK  the mu-lumped chain of S|S^c has eigenvalues 1 and
                  lam*(S) = 1 - e(S) - e(S^c) = h(S) + h(S^c) - 1 = (h(S) - mu(S))/(1 - mu(S))
                          = <f_S,R f_S>/||f_S||^2          ("mass-adjusted holding" IS lam*)
              tau_lin = 1/(1-lam*) = 1/(e(S)+e(S^c)) = r(S) mu(S^c) = r(S^c) mu(S), i.e. half the
              harmonic mean of the two residences; tau_log = -1/ln(lam*) <= tau_lin.
P3 CEILING    lam*(S) <= lambda_2(R) for EVERY proper S, hence r(S) <= 1/((1-lambda_2)(1-mu(S))),
              with equality iff f_S is a lambda_2-eigenvector of R.
P4 CHEEGER    the easy Cheeger ceiling r(S) <= 2/(1-lambda_2) for mu(S) <= 1/2 is P3 relaxed by
              1-mu(S) >= 1/2: P3 is tighter by exactly 2(1-mu(S)); they coincide at mu(S) = 1/2.
P5 LUMPING    lumping onto groups commutes with reversibilisation, preserves h and lam* of every
              union of groups, and lambda_2(R_lumped) <= lambda_2(R) (Rayleigh-Ritz).
P6 RANGE      every eigenvalue z != 1 of P has Re z <= lambda_2(R).
P7 K-WAY      crisp k-partition: (trace(Pc)-1)/(k-1) <= mean(lambda_2..lambda_k of R) (Ky Fan).
              G-PCCA+'s Galerkin coarse operator on an invariant real Schur subspace is similar to
              the Schur block, so its trace is the sum of the selected eigenvalues WHATEVER the
              memberships: its persistence_excess is a spectral number, not a territory number.
P8 KAC        stationary: the mean spell length over entrances is mu(S)/F(S,S^c) = r(S).
              killed chain from s0 with occupancy nu = s0 (I-Q)^-1: entrance measure
              e_in = s0|_S + nu|_{S^c} Q_{S^c,S} satisfies nu|_S = e_in (I-Q_SS)^-1, so
              time(S)/entries(S) = nu(S)/|e_in| is the mean spell length over all spells.

r(S) is an entrance-distribution mean, not the mean first exit from mu conditioned on S; mass
alone makes it large even for independent draws (h(S) = mu(S) there). That is why lam*(S) is
the territory statistic and r(S) is reported beside it, never alone.

    python3 -B scripts/semantics/_territory_audit.py --selfcheck
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys

import numpy as np
from scipy import linalg, sparse
from scipy.sparse import linalg as spla

from _kernel import Kernel
from _territory_methods import (
    _chain, _entropy_L, _feasible_optimise, _feasible_rotation, _inner_simplex, _jsonable, _labels,
    _ordered_schur, _partitions, _planted, _stationary, gpcca, map_equation_L, perturb,
)

SELFCHECK_FLOOR = 29
RECOMPUTE = "python3 -B scripts/semantics/_territory_audit.py --selfcheck"
IDENTITY_TOL = 1e-9


# --------------------------------------------------------------------------- #
# spectra
# --------------------------------------------------------------------------- #
def rev_spectrum(P, mu, check=True):
    """Eigenpairs of R = (P+P*)/2 in L2(mu), eigenvalues DESCENDING; columns of F mu-orthonormal."""
    if check:
        P, mu = _chain(P, mu, positive=True)
    root = np.sqrt(mu)
    B = root[:, None] * P / root[None, :]
    values, vectors = linalg.eigh((B + B.T) / 2)
    order = np.argsort(-values, kind="stable")
    return values[order], vectors[:, order] / root[:, None]


def spectrum(P, mu):
    """Full non-reversible spectrum, step timescales, and the additive-reversibilisation lambda_2."""
    P, mu = _chain(P, mu, positive=True)
    values, vectors = linalg.eig(P)
    residual = float(np.max(abs(P @ vectors - vectors * values)))
    stationary = int(np.argmin(abs(values - 1)))
    order = [stationary] + sorted((i for i in range(len(P)) if i != stationary),
                                  key=lambda i: (-abs(values[i]), -values[i].real, -values[i].imag))
    modes = []
    for j, i in enumerate(order):
        magnitude = float(abs(values[i]))
        tau = None if j == 0 else (0.0 if magnitude == 0 else float(-1 / np.log(magnitude)))
        modes.append(dict(real=float(values[i].real), imag=float(values[i].imag),
                          magnitude=magnitude, timescale_steps=tau))
    if residual > 1e-9 or abs(values.sum().real - np.trace(P)) > 1e-9:
        raise ArithmeticError("spectrum fails eigen-equation/trace cross-check")
    rev_values, rev_vectors = rev_spectrum(P, mu, check=False)
    nonunit = np.delete(values, stationary)
    return dict(modes=modes, eigen_equation_residual=residual,
                trace_error=float(abs(values.sum() - np.trace(P))),
                additive_lambda2=float(rev_values[1]),
                max_nonunit_real_part=float(nonunit.real.max()) if len(nonunit) else None,
                positive_self_loops=int(np.count_nonzero(np.diag(P) > 0))), rev_vectors


def involution_sectors(P, mu, perm):
    """P5/P2 sector split under a state involution perm (perm[perm] = id) that commutes with P.

    Returns the spectrum of R restricted to EVEN functions (f o perm = f) and ODD functions
    (f o perm = -f). A set S with perm(S) = S has an even centred indicator, so lam*(S) is bounded
    by the even sector's lambda_2; a set with perm(S) = S^c has an odd one, bounded by the odd
    sector's lambda_1. The asymmetry actually present is returned, never assumed away.
    """
    P, mu = _chain(P, mu, positive=True)
    perm = np.asarray(perm, dtype=int)
    n = len(P)
    if perm.shape != (n,) or not np.array_equal(perm[perm], np.arange(n)):
        raise ValueError("perm must be an involution on the state set")
    asym_P = float(np.max(abs(P[np.ix_(perm, perm)] - P)))
    asym_mu = float(np.max(abs(mu[perm] - mu)))
    root = np.sqrt(mu)
    B = root[:, None] * P / root[None, :]
    Sym = (B + B.T) / 2
    Sym = (Sym + Sym[np.ix_(perm, perm)]) / 2          # exact commutation for the decomposition
    even, odd = [], []
    for i in range(n):
        j = perm[i]
        if j == i:
            v = np.zeros(n)
            v[i] = 1.0
            even.append(v)
        elif i < j:
            v = np.zeros(n)
            v[i] = v[j] = 1 / np.sqrt(2)
            even.append(v)
            w = np.zeros(n)
            w[i], w[j] = 1 / np.sqrt(2), -1 / np.sqrt(2)
            odd.append(w)
    E = np.array(even).T
    ev = np.sort(linalg.eigvalsh(E.T @ Sym @ E))[::-1]
    if odd:
        O = np.array(odd).T
        ov = np.sort(linalg.eigvalsh(O.T @ Sym @ O))[::-1]
    else:
        ov = np.zeros(0)
    whole = np.sort(linalg.eigvalsh(Sym))[::-1]
    union_error = float(np.max(abs(np.sort(np.concatenate([ev, ov]))[::-1] - whole)))
    if union_error > 1e-9:
        raise ArithmeticError("sector spectra do not reassemble the reversibilised spectrum")
    return dict(even=ev, odd=ov, even_lambda2=float(ev[1]) if len(ev) > 1 else None,
                odd_lambda1=float(ov[0]) if len(ov) else None, fixed_points=int(np.sum(perm == np.arange(n))),
                orbit_pairs=len(odd), asymmetry_P=asym_P, asymmetry_mu=asym_mu, union_error=union_error)


# --------------------------------------------------------------------------- #
# one set: P1, P2, P3, P4, P8 on a stationary chain
# --------------------------------------------------------------------------- #
def set_statistics(P, mu, selected, lambda2=None):
    """Holding, residence, the two-block eigenvalue by FOUR routes, timescales, Kac cross-check."""
    selected = np.asarray(selected, dtype=int)
    n = len(P)
    if not 0 < len(selected) < n or len(set(selected.tolist())) != len(selected):
        raise ValueError("selected must be a nonempty proper state set without duplicates")
    inside = np.zeros(n, dtype=bool)
    inside[selected] = True
    outside = np.flatnonzero(~inside)
    mass = float(mu[selected].sum())
    comp = float(mu[outside].sum())
    flow = mu[:, None] * P
    internal = float(flow[np.ix_(selected, selected)].sum())
    comp_internal = float(flow[np.ix_(outside, outside)].sum())
    outgoing = float(flow[np.ix_(selected, outside)].sum())
    incoming = flow[np.ix_(outside, selected)].sum(axis=0)
    holding, comp_holding = internal / mass, comp_internal / comp
    a, b = outgoing / mass, float(incoming.sum()) / comp
    lam = 1 - a - b
    # route 2: Rayleigh quotient of the centred indicator under R, applied without forming R
    f = np.where(inside, 1.0 - mass, -mass)
    Rf = 0.5 * (P @ f + (P.T @ (mu * f)) / mu)
    rq = float((mu * f) @ Rf / ((mu * f) @ f))
    # route 3: the explicit 2x2 lumped chain's eigenvalues
    two = np.array([[holding, a], [b, comp_holding]])
    eig = np.sort(linalg.eigvals(two).real)
    identity_error = float(max(abs(lam - rq), abs(lam - (holding - mass) / (1 - mass)),
                               abs(lam - (holding + comp_holding - 1)), abs(lam - eig[0]),
                               abs(eig[1] - 1), abs(outgoing - incoming.sum()),
                               abs(((mu * f) @ f) - mass * comp)))
    if identity_error > IDENTITY_TOL:
        raise ArithmeticError("P1/P2 two-block identities disagree (error %.3g)" % identity_error)
    # P8: entrance-weighted mean first exit (an independent linear solve) == mu(S)/F(S,S^c)
    exits = linalg.solve(np.eye(len(selected)) - P[np.ix_(selected, selected)], np.ones(len(selected)))
    residence = 1 / a
    by_entry = float((incoming / incoming.sum()) @ exits)
    from_stationary_inside = float((mu[selected] / mass) @ exits)
    kac_error = abs(by_entry - residence) / max(1.0, residence)
    if kac_error > 1e-8:
        raise ArithmeticError("P8 stationary spell identity disagrees with independent first-exit solve")
    tau_lin = 1 / (a + b)
    timescale_error = max(abs(residence * comp - tau_lin), abs(1 / tau_lin - (a + b)),
                          abs(tau_lin - 0.5 * 2 / (1 / residence + 1 / (1 / b))))
    if timescale_error > 1e-8 * max(1.0, tau_lin):
        raise ArithmeticError("P2 timescale identities disagree")
    tau_log = float(-1 / np.log(lam)) if 0 < lam < 1 else None
    out = dict(mu_mass=mass, internal_flow=internal, outgoing_flow=outgoing,
               holding=holding, residence_steps=residence,
               complement_holding=comp_holding, complement_residence_steps=1 / b,
               exit_rate=a, complement_exit_rate=b,
               two_block_eigenvalue=lam, mass_adjusted_holding=(holding - mass) / (1 - mass),
               rayleigh_quotient=rq, identity_error=identity_error,
               tau_lin_steps=tau_lin, tau_log_steps=tau_log,
               kappa_residence_over_tau_log=None if tau_log is None else residence / tau_log,
               independent_entry_residence_steps=by_entry, entry_route_relative_error=kac_error,
               first_exit_from_stationary_inside_steps=from_stationary_inside,
               iid_residence_steps=1 / (1 - mass), holding_excess=holding - mass)
    if lambda2 is not None:
        lambda2 = float(lambda2)
        if lam > lambda2 + 1e-10:
            raise ArithmeticError("P3 violated: lam*(S)=%.12f > lambda_2(R)=%.12f" % (lam, lambda2))
        out.update(p3_ceiling_residence=1 / ((1 - lambda2) * comp), p3_slack=lambda2 - lam,
                   cheeger_ceiling_residence=(2 / (1 - lambda2)) if mass <= 0.5 + 1e-12 else None)
        if residence > out["p3_ceiling_residence"] * (1 + 1e-10):
            raise ArithmeticError("P3 residence ceiling violated")
    return out


# --------------------------------------------------------------------------- #
# searches (local; only the P3 ceiling is global)
# --------------------------------------------------------------------------- #
def _objective(internal, mass, objective):
    if objective == "holding":
        return internal / mass
    if objective == "two_block":                                   # P2: lam* = (h - m)/(1 - m)
        return (internal / mass - mass) / (1 - mass)
    raise ValueError(objective)


def _swap_improve(flow, mu, selected, audit=False, cap=np.inf, objective="holding"):
    """Best-improvement one-for-one swaps until none strictly improves the objective (mass <= cap)."""
    selected = np.sort(np.asarray(selected, dtype=int))
    n = len(mu)
    sym = flow + flow.T
    diagonal = np.diag(flow)
    candidates = swaps = audited = 0
    for sweep in range(2000):
        outside = np.setdiff1d(np.arange(n), selected)
        mass = mu[selected].sum()
        internal = flow[np.ix_(selected, selected)].sum()
        connection = sym[:, selected].sum(axis=1)
        proposed_flow = (internal - connection[selected, None] + diagonal[selected, None]
                         + connection[None, outside] + diagonal[None, outside]
                         - sym[np.ix_(selected, outside)])
        proposed_mass = mass - mu[selected, None] + mu[None, outside]
        with np.errstate(divide="ignore", invalid="ignore"):
            values = _objective(proposed_flow, proposed_mass, objective)
        values = np.where((proposed_mass <= cap + 1e-15) & (proposed_mass < 1 - 1e-15), values, -np.inf)
        candidates += values.size
        if audit:
            for a, b in itertools.product(range(len(selected)), range(len(outside))):
                trial = selected.copy()
                trial[a] = outside[b]
                m = mu[trial].sum()
                if m > cap + 1e-15:
                    continue
                exact = _objective(flow[np.ix_(trial, trial)].sum(), m, objective)
                if abs(exact - values[a, b]) > 1e-11:
                    raise AssertionError("swap delta disagrees with direct summation")
                audited += 1
        a, b = np.unravel_index(int(np.argmax(values)), values.shape)
        if values[a, b] <= _objective(internal, mass, objective) + 1e-13:
            return selected, dict(swap_candidates=candidates, accepted_swaps=swaps, audited_swaps=audited)
        selected[a] = outside[b]
        selected.sort()
        swaps += 1
    raise RuntimeError("swap search failed to converge")


def _repair(mu, selected, cap):
    """Make a seed feasible: swap its heaviest member for the lightest non-member until mass <= cap."""
    selected = list(dict.fromkeys(int(i) for i in selected))
    order = np.argsort(mu, kind="stable")
    for _ in range(len(mu) * len(selected) + 1):
        if mu[selected].sum() <= cap + 1e-15:
            return tuple(sorted(selected))
        heaviest = max(selected, key=lambda i: (mu[i], i))
        light = next(int(i) for i in order if int(i) not in selected)
        if mu[light] >= mu[heaviest]:
            break
        selected[selected.index(heaviest)] = light
    raise ValueError("no feasible set of this size under the mass cap")


def _greedy_grow(flow, mu, start, size, cap, objective):
    chosen = [int(start)]
    sym = flow + flow.T
    internal, mass = float(flow[start, start]), float(mu[start])
    connection = sym[:, start].copy()
    inside = np.zeros(len(mu), dtype=bool)
    inside[start] = True
    while len(chosen) < size:
        cand = np.flatnonzero(~inside)
        new_internal = internal + connection[cand] + np.diag(flow)[cand]
        new_mass = mass + mu[cand]
        with np.errstate(divide="ignore", invalid="ignore"):
            val = _objective(new_internal, new_mass, objective)
        val = np.where((new_mass <= cap + 1e-15) & (new_mass < 1 - 1e-15), val, -np.inf)
        if not np.isfinite(val).any():
            return None
        j = int(cand[np.argmax(val)])
        chosen.append(j)
        inside[j] = True
        internal, mass = float(new_internal[np.argmax(val)]), float(new_mass[np.argmax(val)])
        connection += sym[:, j]
    return tuple(sorted(chosen))


def holding_search(P, mu, sizes=range(3, 31), seed=3201, random_starts=16, cap=0.5,
                   objective="holding", greedy_starts=8):
    """Per-cardinality best set under mu(S) <= cap: spectral, occupancy, greedy, random, nested seeds.

    Local, not exhaustive: each reported set certifies EXISTENCE. The global statement is P3,
    checked on every reported set (its own-mass ceiling) and per cardinality (the ceiling at the
    largest feasible mass, min(cap, mass of the `size` heaviest states)).
    """
    P, mu = _chain(P, mu, positive=True)
    cap = np.inf if cap is None else float(cap)
    values, X = rev_spectrum(P, mu, check=False)
    lam2 = float(values[1])
    n = len(P)
    flow = mu[:, None] * P
    orders = [np.argsort(-mu, kind="stable")]
    for j in range(1, min(13, n)):
        orders.extend([np.argsort(X[:, j], kind="stable"), np.argsort(-X[:, j], kind="stable")])
    rng = np.random.default_rng(seed)
    results, previous = [], None
    total = dict(cardinalities=0, distinct_seeds=0, swap_candidates=0, accepted_swaps=0)
    heavy = np.argsort(-mu, kind="stable")
    for size in sizes:
        if not 1 <= size < n:
            raise ValueError("all searched sizes must be positive and below state count")
        seeds = {_repair(mu, order[:size], cap) for order in orders}
        for r in range(random_starts):
            seeds.add(_repair(mu, rng.choice(n, size, replace=False, p=mu if r % 2 else None), cap))
        if previous is not None and len(previous) < size:
            extras = [int(i) for i in heavy if int(i) not in previous][:size - len(previous)]
            seeds.add(_repair(mu, list(previous) + extras, cap))
        for start in heavy[:greedy_starts]:
            grown = _greedy_grow(flow, mu, int(start), size, cap, objective)
            if grown is not None:
                seeds.add(grown)
        best = None
        for initial in sorted(seeds):
            chosen, counts = _swap_improve(flow, mu, initial, cap=cap, objective=objective)
            value = _objective(flow[np.ix_(chosen, chosen)].sum(), mu[chosen].sum(), objective)
            for key in ("swap_candidates", "accepted_swaps"):
                total[key] += counts[key]
            candidate = (float(value), tuple(int(i) for i in chosen))
            if best is None or candidate[0] > best[0] + 1e-13 or (
                    abs(candidate[0] - best[0]) <= 1e-13 and candidate[1] < best[1]):
                best = candidate
        chosen = np.asarray(best[1])
        stats = set_statistics(P, mu, chosen, lambda2=lam2)
        max_mass = float(min(np.sort(mu)[-size:].sum(), cap))
        upper_h = max_mass + lam2 * (1 - max_mass)
        if stats["holding"] > upper_h + 1e-10:
            raise ArithmeticError("holding candidate violates the P3 cardinality ceiling")
        results.append(dict(size=size, indices=chosen, seeds=len(seeds), objective=objective,
                            objective_value=best[0], **stats,
                            all_sets_holding_upper_bound=float(upper_h),
                            all_sets_residence_upper_bound=float(1 / (1 - upper_h))))
        total["cardinalities"] += 1
        total["distinct_seeds"] += len(seeds)
        previous = chosen
    if not results or total["swap_candidates"] < len(results):
        raise AssertionError("set search has zero/insufficient coverage")
    return dict(results=results, coverage=total, additive_lambda2=lam2, cap=None if cap == np.inf else cap,
                guarantee="best encountered local optimum; only the P3 ceiling is global")


def sweep(P, mu, vector, cap=0.5):
    """Every level set of `vector`: the best two-block split (any mass) and best holding (mass <= cap)."""
    order = np.argsort(vector, kind="stable")
    n = len(P)
    flow = mu[:, None] * P
    W = (flow + flow.T) / 2
    x = np.zeros(n)
    cut = mass = 0.0
    inner = 0.0
    best_lam, best_h = (-np.inf, None), (-np.inf, None)
    comp_inner = float(flow.sum())
    for k in range(n - 1):
        u = order[k]
        # adding u to S: cut changes by (W(u,S^c) - W_uu) - W(u,S)
        ws = float(W[u] @ x)
        wc = float(W[u].sum() - ws - W[u, u])
        cut += wc - ws
        mass += mu[u]
        inner += 2 * ws + W[u, u]                     # flow(S,S) (W symmetric, same total)
        x[u] = 1
        lam = 1 - cut / (mass * (1 - mass))
        if lam > best_lam[0] + 1e-13:
            best_lam = (lam, k + 1)
        # the prefix S and the suffix S^c are both candidates for the capped holding problem
        h_prefix = 1 - cut / mass
        h_suffix = 1 - cut / (1 - mass)
        if mass <= cap + 1e-15 and h_prefix > best_h[0] + 1e-13:
            best_h = (h_prefix, ("prefix", k + 1))
        if 1 - mass <= cap + 1e-15 and h_suffix > best_h[0] + 1e-13:
            best_h = (h_suffix, ("suffix", k + 1))
    two = np.sort(order[:best_lam[1]])
    hs = None
    if best_h[1] is not None:
        side, k = best_h[1]
        hs = np.sort(order[:k]) if side == "prefix" else np.sort(order[k:])
    return dict(two_block=(float(best_lam[0]), two),
                holding_cap=(float(best_h[0]), hs) if hs is not None else (None, None),
                levels=n - 1)


def two_block_search(P, mu, seeds, audit=False, max_iter=20000, min_mass=0.0):
    """Size-free local maximiser of lam*(S) (P2) by single-state flips, from every seed.

    lam* is symmetric in S <-> S^c, so no mass cap is needed; `min_mass` = beta keeps BOTH sides
    at mu >= beta (a balance floor). Why a floor exists at all: for a light set lam*(S) ~ h(S)
    (P2 with e(S^c) = mu(S) e(S)/mu(S^c) -> 0), so the unconstrained optimum is the stickiest
    SMALL region, not a balanced mode; both are reported. Local: the P3 ceiling lambda_2(R) is the
    only global statement, and the gap to it is reported, never hidden. Seeds violating the floor
    are skipped and counted.
    """
    n = len(P)
    flow = mu[:, None] * P
    W = (flow + flow.T) / 2
    rowsum = W.sum(axis=1)
    diag = np.diag(W).copy()
    best = (-np.inf, None)
    lo, hi = max(float(min_mass), 1e-15), 1 - max(float(min_mass), 1e-15)
    coverage = dict(seeds=0, infeasible_seeds=0, flips=0, evaluations=0, audited=0, min_mass=float(min_mass))
    for seed in seeds:
        x = np.zeros(n, dtype=bool)
        x[np.asarray(seed, dtype=int)] = True
        if not 0 < x.sum() < n or not lo - 1e-15 <= float(mu[x].sum()) <= hi + 1e-15:
            coverage["infeasible_seeds"] += 1
            continue
        coverage["seeds"] += 1
        ws = W @ x
        mass = float(mu[x].sum())
        cut = float(ws[~x].sum())
        for _ in range(max_iter):
            same = np.where(x, ws - diag, rowsum - ws - diag)
            other = np.where(x, rowsum - ws, ws)
            new_cut = cut + same - other
            new_mass = np.where(x, mass - mu, mass + mu)
            inside_count = int(x.sum())
            new_count = np.where(x, inside_count - 1, inside_count + 1)     # EXACT: no empty side
            ok = (new_count > 0) & (new_count < n) & (new_mass >= lo - 1e-15) & (new_mass <= hi + 1e-15)
            with np.errstate(divide="ignore", invalid="ignore"):
                val = np.where(ok, 1 - new_cut / (new_mass * (1 - new_mass)), -np.inf)
            coverage["evaluations"] += n
            if audit:
                for u in range(n):
                    if not ok[u]:
                        continue
                    y = x.copy()
                    y[u] = not y[u]
                    m = mu[y].sum()
                    direct = 1 - flow[np.ix_(y, ~y)].sum() / (m * (1 - m))
                    if abs(direct - val[u]) > 1e-11:
                        raise AssertionError("two-block flip delta disagrees with direct recomputation")
                    coverage["audited"] += 1
            u = int(np.argmax(val))
            current = 1 - cut / (mass * (1 - mass))
            if val[u] <= current + 1e-13:
                break
            sign = -1.0 if x[u] else 1.0
            x[u] = not x[u]
            ws += sign * W[:, u]
            cut, mass = float(new_cut[u]), float(new_mass[u])
            coverage["flips"] += 1
        else:
            raise RuntimeError("two-block flip search did not converge")
        value = 1 - cut / (mass * (1 - mass))
        key = tuple(np.flatnonzero(x))
        if value > best[0] + 1e-13 or (abs(value - best[0]) <= 1e-13 and best[1] is not None and key < best[1]):
            best = (float(value), key)
    if coverage["seeds"] == 0:
        raise AssertionError("two-block search received no feasible seed (min_mass %.3g)" % min_mass)
    return best[0], np.asarray(best[1], dtype=int), coverage


def free_holding_search(P, mu, seeds, cap=0.5, max_iter=20000):
    """Size-free max h(S) with mu(S) <= cap (the Cheeger problem at cap 1/2): add/remove/swap moves."""
    n = len(P)
    flow = mu[:, None] * P
    sym = flow + flow.T
    diag = np.diag(flow).copy()
    best = (-np.inf, None)
    coverage = dict(seeds=0, moves=0)
    for seed in seeds:
        # a size-free seed is made feasible by SHRINKING (drop its heaviest member), not by the
        # fixed-size repair: the size is not part of this problem
        members = sorted((int(i) for i in seed), key=lambda i: (mu[i], i))
        while len(members) > 1 and mu[members].sum() > cap + 1e-15:
            members.pop()
        if not members or mu[members].sum() > cap + 1e-15:
            continue
        x = np.zeros(n, dtype=bool)
        x[members] = True
        coverage["seeds"] += 1
        for _ in range(max_iter):
            S, out = np.flatnonzero(x), np.flatnonzero(~x)
            internal = flow[np.ix_(S, S)].sum()
            mass = mu[S].sum()
            conn = sym[:, S].sum(axis=1)
            h0 = internal / mass
            cands = []
            nm = mass + mu[out]
            v = np.where(nm <= cap + 1e-15, (internal + conn[out] + diag[out]) / nm, -np.inf)
            if len(v):
                cands.append((float(v.max()), ("add", int(out[np.argmax(v)]))))
            if len(S) > 1:
                nm = mass - mu[S]
                v = (internal - conn[S] + diag[S]) / nm
                cands.append((float(v.max()), ("remove", int(S[np.argmax(v)]))))
            if len(out):
                nf = (internal - conn[S, None] + diag[S, None] + conn[None, out] + diag[None, out]
                      - sym[np.ix_(S, out)])
                nm = mass - mu[S, None] + mu[None, out]
                v = np.where(nm <= cap + 1e-15, nf / nm, -np.inf)
                a, b = np.unravel_index(int(np.argmax(v)), v.shape)
                cands.append((float(v[a, b]), ("swap", int(S[a]), int(out[b]))))
            value, move = max(cands, key=lambda c: c[0])
            if value <= h0 + 1e-13:
                break
            if move[0] == "add":
                x[move[1]] = True
            elif move[0] == "remove":
                x[move[1]] = False
            else:
                x[move[1]], x[move[2]] = False, True
            coverage["moves"] += 1
        else:
            raise RuntimeError("free holding search did not converge")
        S = np.flatnonzero(x)
        value = float(flow[np.ix_(S, S)].sum() / mu[S].sum())
        if value > best[0] + 1e-13:
            best = (value, S)
    if coverage["seeds"] == 0:
        raise AssertionError("free holding search received no feasible seed")
    return best[0], best[1], coverage


# --------------------------------------------------------------------------- #
# the killed roll (P8, killed form) — any substochastic Q, any start, any per-step cost
# --------------------------------------------------------------------------- #
def killed_sojourn(Q, s0, inside, cost, lu=None):
    """Occupancy, entries, time, spell length, capture and P(visit) of a set in a killed chain.

    Two routes to the same numbers (asserted): entries(S) = nu(S) - F_nu(S,S), and the entrance
    measure e_in with nu|_S = e_in (I - Q_SS)^-1 (P8). `cost[i]` = expected cost of the one
    transition taken from i (1 per step; for plies, 1 minus the 0-ply mass).
    """
    Q = sparse.csr_matrix(Q)
    n = Q.shape[0]
    inside = np.asarray(inside, dtype=bool)
    s0 = np.asarray(s0, dtype=float)
    if lu is None:
        lu = spla.splu((sparse.identity(n, format="csc") - Q.tocsc()))
    nu = lu.solve(s0, "T")
    S, Sc = np.flatnonzero(inside), np.flatnonzero(~inside)
    if len(S) == 0:
        raise ValueError("empty set")
    QSS = Q[S][:, S]
    stay = float(nu[S] @ np.asarray(QSS.sum(axis=1)).ravel())
    entries = float(nu[S].sum() - stay)
    e_in = s0[S] + np.asarray(Q[Sc][:, S].T @ nu[Sc]).ravel()
    A = (sparse.identity(len(S), format="csc") - QSS.tocsc())
    nu_S = spla.splu(A).solve(e_in, "T")
    route_error = float(max(np.max(abs(nu_S - nu[S])) if len(S) else 0.0, abs(e_in.sum() - entries)))
    if route_error > 1e-9 * max(1.0, float(nu.sum())):
        raise ArithmeticError("killed-chain entrance route disagrees with occupancy route")
    absorb = 1 - np.asarray(Q.sum(axis=1)).ravel()
    time = float(nu[S] @ cost[S])
    finish = float(nu[S] @ absorb[S])
    # P(visit): hitting probability, 1 on S
    hit = np.ones(n)
    if len(Sc):
        B = (sparse.identity(len(Sc), format="csc") - Q[Sc][:, Sc].tocsc())
        rhs = np.asarray(Q[Sc][:, S].sum(axis=1)).ravel()
        hit[Sc] = spla.splu(B).solve(rhs)
    total_time = float(nu @ cost)
    return dict(occupancy=float(nu[S].sum()), time=time, entries=entries,
                sojourn=time / entries if entries > 0 else None, roll=total_time,
                time_share=time / total_time if total_time > 0 else None,
                capture=finish / entries if entries > 0 else None, p_visit=float(s0 @ hit),
                route_error=route_error)


def clocked_sojourn(Qp, s0, inside, horizons):
    """Uniform mixture over clocks H: time in S, entries and spell length over the first H units.

    x_0 = s0, x_m = x_{m-1} Qp; time(S) = sum_{m<H} x_m(S); entries(S) = x_0(S) +
    sum_{1<=m<H} (x_{m-1}|_{S^c} Qp)(S). The mixture averages time and entries separately.
    """
    QT = sparse.csr_matrix(Qp).T.tocsr()
    inside = np.asarray(inside, dtype=bool)
    rows = []
    for H in horizons:
        x = np.asarray(s0, dtype=float).copy()
        time = entries = float(x[inside].sum())
        roll = float(x.sum())
        for m in range(1, H):
            entries += float((QT @ np.where(inside, 0.0, x))[inside].sum())
            x = QT @ x
            time += float(x[inside].sum())
            roll += float(x.sum())
        rows.append((time, entries, roll))
    t, e, r = (float(np.mean([row[i] for row in rows])) for i in range(3))
    return dict(time=t, entries=e, roll=r, sojourn=t / e if e > 0 else None,
                time_share=t / r if r > 0 else None, horizons=list(horizons))


def simulate_killed(Q0, Q1, absorb, s0, inside, rolls, seed):
    """Seeded Monte Carlo of a killed chain with 0-cost (Q0) and 1-cost (Q1) moves; independent route."""
    Q0, Q1 = sparse.csr_matrix(Q0), sparse.csr_matrix(Q1)
    n = Q0.shape[0]
    rng = np.random.default_rng(seed)
    tables = []
    for i in range(n):
        d0, p0 = Q0.indices[Q0.indptr[i]:Q0.indptr[i + 1]], Q0.data[Q0.indptr[i]:Q0.indptr[i + 1]]
        d1, p1 = Q1.indices[Q1.indptr[i]:Q1.indptr[i + 1]], Q1.data[Q1.indptr[i]:Q1.indptr[i + 1]]
        dest = np.concatenate([d0, d1, [-1]])
        cost = np.concatenate([np.zeros(len(d0)), np.ones(len(d1)), [1.0]])
        prob = np.concatenate([p0, p1, [max(0.0, absorb[i])]])
        tables.append((dest, cost, np.cumsum(prob) / prob.sum()))
    starts = rng.choice(n, size=rolls, p=np.asarray(s0) / np.sum(s0))
    uniforms = rng.random(rolls * 64)
    used = 0
    steps_in = plies_in = entries = 0.0
    for r in range(rolls):
        i, prev_in = int(starts[r]), False
        while True:
            if used >= len(uniforms):
                uniforms = rng.random(rolls * 64)
                used = 0
            dest, cost, cum = tables[i]
            k = int(np.searchsorted(cum, uniforms[used], side="right"))
            used += 1
            k = min(k, len(dest) - 1)
            if inside[i]:
                steps_in += 1
                plies_in += cost[k]
                if not prev_in:
                    entries += 1
            prev_in = bool(inside[i])
            if dest[k] < 0:
                break
            i = int(dest[k])
    return dict(rolls=rolls, steps_per_entry=steps_in / entries if entries else None,
                plies_per_entry=plies_in / entries if entries else None,
                entries_per_roll=entries / rolls, steps_in_per_roll=steps_in / rolls)


# --------------------------------------------------------------------------- #
# partitions
# --------------------------------------------------------------------------- #
def crisp_persistence(P, mu, labels):
    """(trace(Pc) - 1)/(k - 1) of the crisp mu-lumping, via the kernel's own Kernel.lump."""
    labels = _labels(labels, len(P))
    k = int(labels.max() + 1)
    Pc, _ = Kernel.lump(sparse.csr_matrix(P), mu, labels, k)
    return (float(np.trace(Pc)) - 1) / (k - 1) if k > 1 else None, Pc


def module_summary(P, mu, partition, ids, hub_of, lambda2=None):
    """Every module's stationary mass, global internal flow, holding and two-block statistics."""
    labels = _labels(partition, len(P))
    if len(ids) != len(P) or len(hub_of) != len(P) or len(set(ids)) != len(ids):
        raise ValueError("module summary requires a unique ID per chain state")
    flow = mu[:, None] * P
    modules = []
    for m in range(labels.max() + 1):
        members = np.flatnonzero(labels == m)
        mass = float(mu[members].sum())
        internal = float(flow[np.ix_(members, members)].sum())
        by_hub = {}
        for i in members:
            by_hub[hub_of[i]] = by_hub.get(hub_of[i], 0.0) + float(mu[i])
        top = sorted(by_hub.items(), key=lambda pair: (-pair[1], pair[0]))[:3]
        row = dict(module=m, state_ids=[ids[i] for i in members], hubs=sorted(by_hub),
                   states=len(members), mu_mass=mass, internal_flow_share=internal,
                   holding=internal / mass,
                   top3_hubs=[dict(hub=hub, mu=weight) for hub, weight in top])
        if 0 < len(members) < len(P):
            st = set_statistics(P, mu, members, lambda2=lambda2)
            row.update(residence_steps=st["residence_steps"], two_block_eigenvalue=st["two_block_eigenvalue"])
        modules.append(row)
    total_internal = sum(module["internal_flow_share"] for module in modules)
    for module in modules:
        module["share_of_all_internal_flow"] = module["internal_flow_share"] / total_internal
    direct = _entropy_L(flow, mu, labels)
    if abs(direct - map_equation_L(P, mu, labels)) > 1e-10:
        raise ArithmeticError("module codebooks do not reproduce map equation")
    return modules


def expected_roll(K):
    """Kernel LU cross-checked against independent Neumann policy iteration (steps and plies)."""
    steps = K.fundamental().solve(np.ones(K.n_t))
    reward = np.bincount(K.cells["src"], weights=K.cells["mass"] * K.cells["plies"], minlength=K.n_t)
    plies = K.fundamental().solve(reward)
    iterate = np.zeros(K.n_t)
    for iteration in range(10000):
        next_value = 1 + K.Q @ iterate
        if np.max(abs(next_value - iterate)) < 1e-13:
            iterate = next_value
            break
        iterate = next_value
    else:
        raise ArithmeticError("Neumann roll-length cross-check failed to converge")
    error = float(np.max(abs(steps - iterate)))
    if error > 1e-9:
        raise ArithmeticError("kernel LU and independent expected-roll recurrence disagree")
    starts = {}
    for where, first in itertools.product(("standing", "anywhere"), ("coin", "me")):
        start = K.start(where, first)
        starts[f"{where}_{first}"] = dict(steps=float(start @ steps), plies=float(start @ plies),
                                          start_states=int(np.count_nonzero(start)))
    return dict(starts=starts, recurrence_iterations=iteration + 1,
                independent_max_error=error, states_compared=K.n_t)


# --------------------------------------------------------------------------- #
# selfcheck: every proposition on a toy with a known answer
# --------------------------------------------------------------------------- #
def _dirichlet(n, seed):
    rng = np.random.default_rng(seed)
    P = rng.dirichlet(np.ones(n), size=n)
    return P, _stationary(P)


def _subsets(n):
    for size in range(1, n):
        yield from itertools.combinations(range(n), size)


def selfcheck():
    records = []

    def check(name, passed, **values):
        records.append(dict(name=name, status="PASS" if passed else "FAIL", **_jsonable(values)))
        print(json.dumps(records[-1], sort_keys=True), flush=True)

    # ---- the eight inherited checks (the search now takes an explicit cap) ----------------------
    P, mu, truth, _ = _planted(blocks=3, size=3)
    result = holding_search(P, mu, sizes=[3], random_starts=4, cap=0.5)
    selected = result["results"][0]
    exhaustive = [sum(mu[list(S)] @ P[np.ix_(S, S)]) / mu[list(S)].sum()
                  for S in itertools.combinations(range(9), 3)]
    check("holding.planted_exhaustive", abs(selected["holding"] - 0.9) < 1e-12
          and abs(max(exhaustive) - selected["holding"]) < 1e-12,
          state_set="all 84 size-three subsets of nine planted states", holding=selected["holding"],
          residence=selected["residence_steps"], candidates=len(exhaustive))
    check("holding.entry_residence", abs(selected["residence_steps"] - 10) < 1e-10
          and selected["entry_route_relative_error"] < 1e-12,
          state_set="one complete block of the nine-state planted chain",
          residence=selected["residence_steps"], error=selected["entry_route_relative_error"])
    mu_iid = np.asarray([0.4, 0.3, 0.2, 0.04, 0.03, 0.02, 0.01])
    iid = np.tile(mu_iid, (7, 1))
    iid_result = holding_search(iid, mu_iid, sizes=[3], random_starts=4, cap=None)["results"][0]
    check("holding.large_mass_is_not_metastability", abs(iid_result["holding"] - 0.9) < 1e-12
          and abs(iid_result["mass_adjusted_holding"]) < 1e-12 and abs(iid_result["two_block_eigenvalue"]) < 1e-12,
          state_set="independent seven-state chain; top three states have mass 0.9 (uncapped search)",
          holding=iid_result["holding"], two_block=iid_result["two_block_eigenvalue"])
    random_P, random_mu = _dirichlet(7, 62)
    _, counts = _swap_improve(random_mu[:, None] * random_P, random_mu, [0, 2, 5], audit=True)
    _, counts2 = _swap_improve(random_mu[:, None] * random_P, random_mu, [0, 2, 5], audit=True,
                               cap=0.5, objective="two_block")
    check("holding.swap_deltas", counts["audited_swaps"] >= 12 and counts2["audited_swaps"] >= 1,
          state_set="seven-state directed Dirichlet chain, seed=62; holding and capped two-block objectives",
          holding_audited=counts["audited_swaps"], two_block_audited=counts2["audited_swaps"])
    spec, _ = spectrum(random_P, random_mu)
    excess = [set_statistics(random_P, random_mu, S)["mass_adjusted_holding"] for S in _subsets(7)]
    check("holding.global_spectral_bound", max(excess) <= spec["additive_lambda2"] + 1e-12
          and len(excess) == 126,
          state_set="all 126 nonempty proper subsets of seven-state directed Dirichlet chain",
          maximum_excess=max(excess), additive_bound=spec["additive_lambda2"], sets=len(excess))
    summary = module_summary(P, mu, truth, [str(i) for i in range(9)], [str(i) for i in range(9)])
    check("modules.flow_conservation", abs(sum(m["mu_mass"] for m in summary) - 1) < 1e-12
          and abs(sum(m["internal_flow_share"] for m in summary) - 0.9) < 1e-12,
          state_set="all nine planted states and three known blocks", modules=len(summary))
    perturbed = perturb(P, 0.6, np.random.default_rng(2))
    pp = _stationary(perturbed)
    X, _, _ = _ordered_schur(perturbed, pp, 3)
    A, _ = _inner_simplex(X)
    optimised, info = _feasible_optimise(X, A)
    chi = X @ optimised
    _, objective = _feasible_rotation(optimised[1:, 1:].ravel(), X)
    direct = np.sum(np.sum(pp[:, None] * chi ** 2, axis=0) / (pp @ chi)) / 3
    check("gpcca.feasible_route", chi.min() >= -1e-12 and np.max(abs(chi.sum(axis=1) - 1)) < 1e-12
          and abs(direct - (1 - objective)) < 1e-10 and info["success"],
          state_set="nine-state perturbed planted chain, seed=2, eps=0.6, k=3",
          crispness=direct, method=info["method"])
    flat = A[1:, 1:].ravel() + np.asarray([0.011, -0.037, 0.024, 0.017])
    _, gradient = _feasible_rotation(flat, X, gradient=True)
    finite = np.zeros_like(flat)
    for i in range(len(flat)):
        delta = np.eye(len(flat))[i] * 1e-6
        finite[i] = (_feasible_rotation(flat + delta, X)[1] - _feasible_rotation(flat - delta, X)[1]) / 2e-6
    check("gpcca.feasible_gradient", np.max(abs(gradient - finite)) < 1e-7,
          state_set="all four feasible-rotation coordinates of nine-state perturbed fixture",
          gradient_error=float(np.max(abs(gradient - finite))))

    # ---- P1/P2: four routes to lam*(S) on every subset ------------------------------------------
    worst = 0.0
    for S in _subsets(7):
        st = set_statistics(random_P, random_mu, S)
        worst = max(worst, st["identity_error"])
    check("P1P2.two_block_identity_all_subsets", worst < 1e-12,
          state_set="all 126 nonempty proper subsets, seven-state Dirichlet chain seed=62",
          max_identity_error=worst, routes="1-e(S)-e(S^c) | (h-mu)/(1-mu) | h+h'-1 | Rayleigh | 2x2 eig")
    # known answer: planted 3x10, one block vs the rest: e(S)=0.1, e(S^c)=0.05, lam*=0.85
    P30, mu30, truth30, _ = _planted(blocks=3, size=10)
    block = np.flatnonzero(truth30 == 0)
    st = set_statistics(P30, mu30, block, lambda2=rev_spectrum(P30, mu30)[0][1])
    check("P2.planted_known_answer", abs(st["two_block_eigenvalue"] - 0.85) < 1e-12
          and abs(st["exit_rate"] - 0.1) < 1e-12 and abs(st["complement_exit_rate"] - 0.05) < 1e-12
          and abs(st["tau_lin_steps"] - 1 / 0.15) < 1e-10
          and abs(st["residence_steps"] - st["tau_lin_steps"] / (2 / 3)) < 1e-10,
          state_set="planted 3x10 chain (stay 0.9), block 0 vs blocks 1-2",
          lam_star=st["two_block_eigenvalue"], residence=st["residence_steps"],
          tau_lin=st["tau_lin_steps"], tau_log=st["tau_log_steps"],
          kappa=st["kappa_residence_over_tau_log"])
    # P2 timescale ordering on all subsets
    ordered = True
    for S in _subsets(7):
        st = set_statistics(random_P, random_mu, S)
        if st["tau_log_steps"] is not None:
            ordered &= st["tau_log_steps"] <= st["tau_lin_steps"] + 1e-12
        ordered &= st["tau_lin_steps"] <= min(st["residence_steps"], st["complement_residence_steps"]) + 1e-12
    check("P2.timescale_order", ordered, state_set="all 126 subsets, Dirichlet seed=62",
          claim="tau_log <= tau_lin <= min(r(S), r(S^c))")

    # ---- P3: equality case (planted block is an eigenvector) and strict case ----------------------
    lam2_30 = rev_spectrum(P30, mu30)[0][1]
    check("P3.equality_planted", abs(lam2_30 - 0.85) < 1e-12
          and abs(set_statistics(P30, mu30, block)["two_block_eigenvalue"] - lam2_30) < 1e-12,
          state_set="planted 3x10 chain; block indicator is a lambda_2 eigenvector", lambda2=lam2_30)
    lam2_7 = spec["additive_lambda2"]
    check("P3.strict_random", max(excess) < lam2_7 - 1e-6, state_set="all 126 subsets, Dirichlet seed=62",
          max_lam_star=max(excess), lambda2=lam2_7, slack=lam2_7 - max(excess))

    # ---- P4: ratio of the two ceilings is 2(1-mu(S)) on every light subset ----------------------
    worst_ratio, light = 0.0, 0
    for S in _subsets(7):
        st = set_statistics(random_P, random_mu, S, lambda2=lam2_7)
        if st["mu_mass"] <= 0.5:
            light += 1
            ratio = st["cheeger_ceiling_residence"] / st["p3_ceiling_residence"]
            worst_ratio = max(worst_ratio, abs(ratio - 2 * (1 - st["mu_mass"])))
            if not st["residence_steps"] <= st["p3_ceiling_residence"] <= st["cheeger_ceiling_residence"] + 1e-12:
                worst_ratio = np.inf
    check("P4.cheeger_is_relaxed_p3", worst_ratio < 1e-12 and light > 0,
          state_set="every subset of the Dirichlet seed=62 chain with mu(S) <= 1/2",
          light_sets=light, max_ratio_error=worst_ratio)

    # ---- P5: lumping commutes with reversibilisation; interlacing; unions preserved ---------------
    P8_, mu8 = _dirichlet(8, 5)
    groups = np.array([0, 0, 1, 1, 1, 2, 3, 3])
    Pa, mua = Kernel.lump(sparse.csr_matrix(P8_), mu8, groups, 4)
    Pstar = (P8_.T * mu8[None, :]) / mu8[:, None]
    Ra_from_R, _ = Kernel.lump(sparse.csr_matrix((P8_ + Pstar) / 2), mu8, groups, 4)
    Pa_star = (Pa.T * mua[None, :]) / mua[:, None]
    commute = float(np.max(abs(Ra_from_R - (Pa + Pa_star) / 2)))
    lam2_fine, lam2_coarse = rev_spectrum(P8_, mu8)[0][1], rev_spectrum(Pa, mua)[0][1]
    union_err = 0.0
    for A_ in _subsets(4):
        fine = np.flatnonzero(np.isin(groups, A_))
        union_err = max(union_err, abs(set_statistics(P8_, mu8, fine)["two_block_eigenvalue"]
                                       - set_statistics(Pa, mua, A_)["two_block_eigenvalue"]))
    check("P5.lumping", commute < 1e-12 and lam2_coarse <= lam2_fine + 1e-12 and union_err < 1e-12,
          state_set="8-state Dirichlet seed=5 lumped to 4 groups; all 14 unions",
          commute_error=commute, lambda2_fine=lam2_fine, lambda2_lumped=lam2_coarse, union_error=union_err)

    # ---- P6: numerical range, equality on a normal (circulant) chain, strict on random ones -------
    Pc4, muc4, _, _ = _planted(blocks=4, size=10, cycle=True)
    s4, _ = spectrum(Pc4, muc4)
    rng_max = []
    for seed in range(5):
        Pr, mur = _dirichlet(9, 100 + seed)
        sr, _ = spectrum(Pr, mur)
        rng_max.append((sr["max_nonunit_real_part"], sr["additive_lambda2"]))
    check("P6.numerical_range", abs(s4["max_nonunit_real_part"] - 0.9) < 1e-10
          and abs(s4["additive_lambda2"] - 0.9) < 1e-10 and all(a <= b + 1e-12 for a, b in rng_max),
          state_set="directed four-clique cycle (equality 0.9) and five 9-state Dirichlet chains seeds 100-104",
          cycle=(s4["max_nonunit_real_part"], s4["additive_lambda2"]), random=rng_max)

    # ---- P7: Galerkin trace = selected eigenvalues; crisp Ky Fan on every partition ---------------
    g3 = gpcca(P30, mu30, 3)
    sel = np.sort(np.real(g3["eigenvalues"]))[::-1]
    kyfan3 = float(np.mean(rev_spectrum(P30, mu30)[0][1:3]))
    check("P7.galerkin_trace_planted", abs(g3["persistence_excess"] - np.mean(sel[1:])) < 1e-10
          and abs(g3["persistence_excess"] - 0.85) < 1e-10 and abs(kyfan3 - 0.85) < 1e-10,
          state_set="planted 3x10 chain, G-PCCA+ k=3", persistence_excess=g3["persistence_excess"],
          selected=sel, kyfan=kyfan3)
    gc = gpcca(Pc4, muc4, 3)
    selc = np.real(np.asarray(gc["eigenvalues"]))
    check("P7.galerkin_trace_complex_pair", abs(gc["persistence_excess"] - (selc.sum() - 1) / 2) < 1e-10,
          state_set="directed four-clique cycle, G-PCCA+ k=3 (keeps the conjugate pair 0.9 +/- 0.1i)",
          persistence_excess=gc["persistence_excess"], selected_real_parts=selc)
    P6_, mu6 = _dirichlet(6, 11)
    w6 = rev_spectrum(P6_, mu6)[0]
    worst_gap, partitions = -np.inf, 0
    for labels in _partitions(6):
        k = labels.max() + 1
        if not 2 <= k <= 5:
            continue
        pe, _ = crisp_persistence(P6_, mu6, labels)
        worst_gap = max(worst_gap, pe - float(np.mean(w6[1:k])))
        partitions += 1
    check("P7.crisp_kyfan_all_partitions", worst_gap <= 1e-12 and partitions == 201,
          state_set="all 201 partitions of a 6-state Dirichlet seed=11 chain into 2..5 blocks",
          max_excess_over_kyfan=worst_gap, partitions=partitions)

    # ---- P8: Kac on all subsets; killed chain analytic answer, two routes, and Monte Carlo --------
    kac = max(set_statistics(random_P, random_mu, S)["entry_route_relative_error"] for S in _subsets(7))
    check("P8.kac_all_subsets", kac < 1e-12, state_set="all 126 subsets, Dirichlet seed=62",
          max_relative_error=kac)
    a_, c_, d_ = 0.6, 0.25, 0.7          # 0: stay a, to 1 c, die 1-a-c ; 1: to 0 d, die 1-d ; S={0}
    Qk = np.array([[a_, c_], [d_, 0.0]])
    q_ = c_ * d_ / (1 - a_)
    out = killed_sojourn(Qk, np.array([1.0, 0.0]), np.array([True, False]), np.ones(2))
    check("P8.killed_known_answer", abs(out["sojourn"] - 1 / (1 - a_)) < 1e-12
          and abs(out["entries"] - 1 / (1 - q_)) < 1e-12 and abs(out["p_visit"] - 1) < 1e-12
          and abs(out["capture"] - (1 - a_ - c_) / (1 - a_)) < 1e-12,
          state_set="two-state killed chain, S = {0}, start at 0", sojourn=out["sojourn"],
          entries=out["entries"], analytic_entries=1 / (1 - q_), capture=out["capture"])
    rng = np.random.default_rng(404)
    Qr = rng.dirichlet(np.ones(7), size=6) [:, :6] * 0.93
    Q0 = np.zeros_like(Qr)
    Q0[0, 3], Q0[2, 5] = Qr[0, 3], Qr[2, 5]
    Q1 = Qr - Q0
    inS = np.array([True, True, False, True, False, False])
    s0 = np.array([0.5, 0, 0.5, 0, 0, 0])
    cost = 1 - Q0.sum(axis=1)
    ex_steps = killed_sojourn(Qr, s0, inS, np.ones(6))
    ex_plies = killed_sojourn(Qr, s0, inS, cost)
    mc = simulate_killed(Q0, Q1, 1 - Qr.sum(axis=1), s0, inS, 40000, 8128)
    check("P8.killed_monte_carlo", abs(mc["steps_per_entry"] - ex_steps["sojourn"]) < 0.03
          and abs(mc["plies_per_entry"] - ex_plies["sojourn"]) < 0.03
          and abs(mc["entries_per_roll"] - ex_steps["entries"]) < 0.03,
          state_set="6-state killed chain seed=404 (two 0-ply cells), S={0,1,3}, 40000 rolls seed=8128",
          exact_steps=ex_steps["sojourn"], mc_steps=mc["steps_per_entry"],
          exact_plies=ex_plies["sojourn"], mc_plies=mc["plies_per_entry"],
          exact_entries=ex_steps["entries"], mc_entries=mc["entries_per_roll"])
    cl1 = clocked_sojourn(Qr, s0, inS, [1])
    cl_inf = clocked_sojourn(Qr, s0, inS, [600])
    check("P8.clocked_limits", abs(cl1["sojourn"] - 1) < 1e-12
          and abs(cl_inf["sojourn"] - ex_steps["sojourn"]) < 1e-10,
          state_set="the same 6-state killed chain, H=1 and H=600", h1=cl1["sojourn"],
          h600=cl_inf["sojourn"], unclocked=ex_steps["sojourn"])

    # ---- sectors: an involution splits R's spectrum; odd/even sets bounded by their sector -------
    P0, _ = _dirichlet(6, 21)
    perm = np.array([3, 4, 5, 0, 1, 2])
    Ps = (P0 + P0[np.ix_(perm, perm)]) / 2
    mus = _stationary(Ps)
    sec = involution_sectors(Ps, mus, perm)
    odd_set = set_statistics(Ps, mus, [0, 1, 2])["two_block_eigenvalue"]
    even_set = set_statistics(Ps, mus, [0, 3])["two_block_eigenvalue"]
    check("sectors.involution", sec["union_error"] < 1e-12 and odd_set <= sec["odd_lambda1"] + 1e-12
          and even_set <= sec["even_lambda2"] + 1e-12,
          state_set="6-state swap-symmetric chain (Dirichlet seed=21 symmetrised under i<->i+3)",
          odd_lambda1=sec["odd_lambda1"], even_lambda2=sec["even_lambda2"],
          odd_set_lam_star=odd_set, even_set_lam_star=even_set)

    # ---- searches: exhaustive known optima ------------------------------------------------------
    P12, mu12 = _dirichlet(12, 77)
    flow12 = mu12[:, None] * P12
    ok_sizes, detail = True, []
    for size in (3, 4):
        found = holding_search(P12, mu12, sizes=[size], random_starts=8, cap=0.5)["results"][0]["holding"]
        brute = max((flow12[np.ix_(S, S)].sum() / mu12[list(S)].sum())
                    for S in itertools.combinations(range(12), size) if mu12[list(S)].sum() <= 0.5)
        ok_sizes &= abs(found - brute) < 1e-12
        detail.append((size, found, brute))
    check("search.capped_exhaustive", ok_sizes,
          state_set="12-state Dirichlet seed=77, every size-3 and size-4 subset with mu <= 1/2", sizes=detail)
    P10, mu10 = _dirichlet(10, 91)
    w10, F10 = rev_spectrum(P10, mu10)
    seeds = [sweep(P10, mu10, F10[:, j])["two_block"][1] for j in range(1, 6)]
    seeds += [[i] for i in range(10)]
    value, S2, cov = two_block_search(P10, mu10, seeds, audit=True)
    brute = max(set_statistics(P10, mu10, S)["two_block_eigenvalue"] for S in _subsets(10))
    check("search.two_block_exhaustive", abs(value - brute) < 1e-12 and value <= w10[1] + 1e-12
          and cov["audited"] > 0,
          state_set="all 1022 proper subsets of a 10-state Dirichlet seed=91 chain",
          found=value, exhaustive=brute, lambda2=float(w10[1]), audited_flips=cov["audited"])
    beta = 0.3                      # binds: the unconstrained optimum's lighter side holds 0.261
    bal_seeds = [np.argsort(F10[:, j], kind="stable")[:k] for j in range(1, 6) for k in range(1, 10)]
    bvalue, BS, bcov = two_block_search(P10, mu10, bal_seeds, audit=True, min_mass=beta)
    bbrute = max(set_statistics(P10, mu10, S)["two_block_eigenvalue"] for S in _subsets(10)
                 if beta <= mu10[list(S)].sum() <= 1 - beta)
    bmass = float(mu10[BS].sum())
    check("search.two_block_balanced_exhaustive", abs(bvalue - bbrute) < 1e-12
          and beta <= bmass <= 1 - beta and bcov["infeasible_seeds"] > 0 and bbrute < brute - 1e-6,
          state_set="every subset with both sides mu >= 0.3 of the 10-state Dirichlet seed=91 chain",
          found=bvalue, exhaustive=bbrute, unconstrained=brute, side_mass=bmass,
          skipped_seeds=bcov["infeasible_seeds"])
    hv, HS, _ = free_holding_search(P10, mu10, seeds + [list(range(5))], cap=0.5)
    brute_h = max(set_statistics(P10, mu10, S)["holding"] for S in _subsets(10) if mu10[list(S)].sum() <= 0.5)
    check("search.free_holding_exhaustive", abs(hv - brute_h) < 1e-12,
          state_set="all subsets with mu <= 1/2 of the 10-state Dirichlet seed=91 chain",
          found=hv, exhaustive=brute_h)
    sw = sweep(P10, mu10, F10[:, 1])
    direct_best = max(set_statistics(P10, mu10, np.argsort(F10[:, 1], kind="stable")[:k])["two_block_eigenvalue"]
                      for k in range(1, 10))
    check("search.sweep_direct", abs(sw["two_block"][0] - direct_best) < 1e-12 and sw["levels"] == 9,
          state_set="all 9 level sets of the Fiedler vector, 10-state Dirichlet seed=91",
          sweep=sw["two_block"][0], direct=direct_best)

    failures = [row for row in records if row["status"] != "PASS"]
    if len(records) < SELFCHECK_FLOOR or failures:
        raise AssertionError("audit toy suite: %d checks (floor %d), %d failed"
                             % (len(records), SELFCHECK_FLOOR, len(failures)))
    print("PASS audit toys: checks=%d floor=%d; %s" % (len(records), SELFCHECK_FLOOR, RECOMPUTE))
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selfcheck", action="store_true", required=True)
    parser.parse_args()
    selfcheck()
