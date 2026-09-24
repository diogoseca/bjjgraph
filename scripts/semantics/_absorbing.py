#!/usr/bin/env python3
"""Absorbing-chain methods, with synthetic proofs and no graph/kernel loader.

All matrices describe one fixed policy. Q contains transient transition
probabilities; R contains ALL absorbing columns unless explicitly called R_fin.
Public functions accept ``labels=K.labels`` for named diagnostics; absent labels
are the explicit local names ``t[0]``, etc. No probability is filled from null.

``Plies(D, a)`` (or the tuple ``(D, a)``) describes deterministic durations:
D[i,j] is the duration conditional on transient edge i->j; a[i] is the duration
conditional on ANY absorbing exit from i. These are durations, not mass-weighted
rewards. Sparse D must store every positive Q edge, INCLUDING explicit zeroes;
dense D may have zeroes outside Q's support. Parallel cells with different
durations cannot be collapsed to a mean D without losing the second moment.
Such cells need a future cell-moment adapter, not an assumption in this module.

Visits count the initial transient state and each subsequent transient arrival,
but never an absorbing state. Their sum is the number of transitions through the
absorbing exit (step units), not necessarily the number of plies. Conditional
occupancy is NORMALIZED given the selected ending, including the Bayes-updated
initial distribution. An impossible ending raises ImpossibleConditionError.

The S1 zero-duration-cycle guard rejects ANY directed cycle made of zero-duration
edges, including self-loops. This is a conservative topology contract: an
escapable zero-duration cycle does not itself imply almost-sure Zeno explosion.
Finite absorbing chains can have such cycles and finite duration moments; we
still reject them as requested, without claiming the converse theorem.

Recompute every synthetic result:
    python3 scripts/semantics/_absorbing.py --selfcheck
"""

from __future__ import annotations

import argparse
from collections.abc import Sequence
from contextlib import redirect_stdout
import inspect
import io
from typing import NamedTuple

import numpy as np
from scipy import sparse
from scipy.sparse.csgraph import connected_components
from scipy.sparse.linalg import splu


PROB_ATOL = 1e-12
CHECK_ATOL = 1e-12
RECOMPUTE = "python3 scripts/semantics/_absorbing.py --selfcheck"
_SELF_CHECK = False


class ChainError(ValueError):
    """A named, diagnosed invalid chain or conditioning event."""


class ClosedTransientClassError(ChainError):
    """At least one transient communicating class cannot reach absorption."""


class ZeroDurationCycleError(ChainError):
    """The requested conservative guard found a zero-duration cycle."""


class ImpossibleConditionError(ChainError):
    """The requested ending has zero probability under the initial law."""


class Committor(NamedTuple):
    q_W: np.ndarray  # P(I finish them)
    q_L: np.ndarray  # P(they finish me)
    q_D: np.ndarray  # P(draw)
    q_plus: np.ndarray  # P(I finish them | the roll is decided)


class Plies(NamedTuple):
    transient: object
    absorbing: object


class TimeMoments(NamedTuple):
    mean: np.ndarray
    variance: np.ndarray


class GroupAbsorption(NamedTuple):
    groups: tuple
    mass: np.ndarray


def _emit(message):
    suffix = f"; recompute={RECOMPUTE}" if _SELF_CHECK else ""
    print(message + suffix, flush=True)


def _fail(kind, message):
    _emit(f"FAIL {kind.__name__}: {message}")
    raise kind(message)


def _matrix(value, name, shape=None, *, probability=True):
    try:
        # scipy.csr_matrix([[None]], dtype=float) silently drops None as zero.
        # Validate the dense cells (or uncoalesced sparse cells) BEFORE conversion.
        raw = value.tocoo(copy=True) if sparse.issparse(value) else np.asarray(value, dtype=float)
        data = raw.data if sparse.issparse(raw) else raw
        if not np.all(np.isfinite(data)) or np.any(data < 0):
            raise ChainError(f"{name}: entries must be finite and nonnegative; null is invalid")
        out = sparse.csr_matrix(raw, dtype=float, copy=True)
    except (TypeError, ValueError) as exc:
        if isinstance(exc, ChainError):
            raise
        raise ChainError(f"{name}: expected a numeric matrix, never null cells") from exc
    if out.ndim != 2 or min(out.shape) < 1:
        raise ChainError(f"{name}: both dimensions must be positive, got {out.shape}")
    if shape is not None and out.shape != shape:
        raise ChainError(f"{name}: shape {out.shape} != required {shape}")
    # Coalescing may overflow even if the individual cells were finite.
    if not np.all(np.isfinite(out.data)) or np.any(out.data < 0):
        raise ChainError(f"{name}: entries must be finite and nonnegative; null is invalid")
    out.sum_duplicates()
    out.eliminate_zeros()
    out.sort_indices()
    if probability and np.any(out.data > 1 + PROB_ATOL):
        raise ChainError(f"{name}: probability entry exceeds one")
    return out


def _q_matrix(Q):
    q = _matrix(Q, "Q")
    if q.shape[0] != q.shape[1]:
        raise ChainError("Q must be square")
    row = np.asarray(q.sum(axis=1)).ravel()
    if np.any(row > 1 + PROB_ATOL):
        raise ChainError("Q must be substochastic: row sum exceeds one")
    return q


def _labels(labels, n):
    names = tuple(f"t[{i}]" for i in range(n)) if labels is None else tuple(map(str, labels))
    if len(names) != n or len(set(names)) != n:
        raise ChainError("labels must provide exactly one distinct name per transient state")
    return names


def _escape(q):
    raw = 1.0 - np.asarray(q.sum(axis=1)).ravel()
    rounded = int(np.count_nonzero(raw < 0))
    if rounded:
        _emit(f"coverage set=Q rows: roundoff-only negative exit deficits clipped={rounded}")
    return np.maximum(raw, 0.0)


def _r_matrix(q, R, *, complete):
    r = _matrix(R, "R" if complete else "R_fin")
    if r.shape[0] != q.shape[0]:
        raise ChainError("Q and R must have the same transient row set")
    total = np.asarray(q.sum(axis=1)).ravel() + np.asarray(r.sum(axis=1)).ravel()
    if complete and np.max(np.abs(total - 1)) > PROB_ATOL:
        raise ChainError("Q + R must sum to one on EVERY row; R must include draw exits")
    if not complete and np.any(total > 1 + PROB_ATOL):
        raise ChainError("Q + R_fin exceeds one; finishing mass cannot exceed all exit mass")
    _emit(f"coverage set={'all absorbing' if complete else 'finishing'} columns: "
          f"states={q.shape[0]} columns={r.shape[1]} positive_cells={r.nnz}; "
          "floors=1 state,1 column")
    return r


def _components(q):
    count, component = connected_components(q, directed=True, connection="strong")
    return count, component


def _closed_guard(q, exit_mass, names):
    count, component = _components(q)
    can_exit = np.zeros(count, dtype=bool)
    can_exit[component[exit_mass > 0]] = True
    edges = q.tocoo()
    outside = component[edges.row] != component[edges.col]
    can_exit[component[edges.row[outside]]] = True
    closed = [np.flatnonzero(component == c) for c in range(count) if not can_exit[c]]
    _emit(f"coverage set=all input transient states and positive Q edges: "
          f"states={q.shape[0]} edges={q.nnz} components={count} "
          f"closed_classes={len(closed)}; floors=1 state,1 component")
    if closed:
        by_name = [tuple(names[i] for i in states) for states in closed]
        _fail(ClosedTransientClassError, f"closed transient classes by label={by_name}; "
              "I-Q is singular; no inverse or pseudoinverse was attempted")


class _System:
    """One LU factorization with a residual printed for EVERY forward/adjoint solve."""

    def __init__(self, q, names, *, exit_mass=None):
        self.q, self.names = q, names
        _closed_guard(q, _escape(q) if exit_mass is None else exit_mass, names)
        self.a = sparse.eye(q.shape[0], format="csc") - q.tocsc()
        try:
            self.lu = splu(self.a)
        except RuntimeError as exc:
            _fail(ChainError, f"sparse LU failed after the closed-class guard; "
                  f"transient labels={names}; detail={exc}")

    def solve(self, rhs, name, *, transpose=False):
        b = rhs.toarray() if sparse.issparse(rhs) else np.asarray(rhs, dtype=float)
        if b.ndim not in (1, 2) or b.shape[0] != self.q.shape[0] or b.size < 1:
            raise ChainError(f"{name}: empty or misaligned right-hand side")
        if not np.all(np.isfinite(b)):
            raise ChainError(f"{name}: nonfinite right-hand side")
        x = self.lu.solve(b, trans="T" if transpose else "N")
        a = self.a.T if transpose else self.a
        residual = float(np.max(np.abs(a @ x - b)))
        scale = max(1.0, float(np.max(np.abs(b))),
                    float(np.max(abs(a) @ np.abs(x))))
        _emit(f"solve={name} set=all {self.q.shape[0]} input transient states: "
              f"rhs_entries={b.size} max_residual={residual:.17g} "
              f"scaled_residual={residual / scale:.17g}")
        if not np.all(np.isfinite(x)) or not np.isfinite(residual) or residual > PROB_ATOL * scale:
            _fail(ChainError, f"{name}: sparse LU residual exceeds tolerance; labels={self.names}")
        return x


def _nonnegative(x, name):
    scale = max(1.0, float(np.max(np.abs(x))))
    if np.min(x) < -PROB_ATOL * scale:
        _fail(ChainError, f"{name}: materially negative solution")
    count = int(np.count_nonzero(x < 0))
    if count:
        _emit(f"set={name} solution entries: clipped_roundoff_negatives={count}")
    return np.maximum(x, 0.0)


def _absorption_system(Q, R, labels):
    q = _q_matrix(Q)
    names = _labels(labels, q.shape[0])
    r = _r_matrix(q, R, complete=True)
    system = _System(q, names, exit_mass=np.asarray(r.sum(axis=1)).ravel())
    b = _nonnegative(system.solve(r, "absorption B"), "B")
    error = float(np.max(np.abs(b.sum(axis=1) - 1)))
    _emit(f"set=all {q.shape[0]} absorption rows: max_mass_error={error:.17g}")
    if error > PROB_ATOL:
        _fail(ChainError, "absorption rows do not sum to one within tolerance")
    return system, r, b


def absorption(Q, R, *, labels=None):
    """Return B=(I-Q)^(-1)R for all transient states and ALL absorbing columns.

    Closed classes are detected from positive edges and named before LU. R must
    include every absorbing outcome, including a draw/optionless-hand exit.
    """
    return _absorption_system(Q, R, labels)[2]


def _column(col, count):
    if isinstance(col, (bool, np.bool_)) or not isinstance(col, (int, np.integer)):
        raise ChainError("an absorbing column must be an integer index")
    if not 0 <= col < count:
        raise ChainError(f"absorbing column {col} outside the supplied column set")
    return int(col)


def committor(Q, R, win, lose, draw=None, *, labels=None):
    """Return named (q_W, q_L, q_D, q_plus) vectors; q_plus is NaN if undecidable.

    Integer win/lose[/draw] column indices must partition ALL supplied R columns.
    q_W = P(I finish them); q_plus = P(I finish them | the roll is decided).
    """
    b = absorption(Q, R, labels=labels)
    columns = [_column(win, b.shape[1]), _column(lose, b.shape[1])]
    if draw is not None:
        columns.append(_column(draw, b.shape[1]))
    if len(set(columns)) != len(columns) or set(columns) != set(range(b.shape[1])):
        raise ChainError("win, lose and optional draw must partition all absorbing columns")
    w, l = b[:, columns[0]], b[:, columns[1]]
    d = np.zeros(b.shape[0]) if draw is None else b[:, columns[2]]
    decisive = w + l
    plus = np.full(b.shape[0], np.nan)
    np.divide(w, decisive, out=plus, where=decisive > 0)
    _emit(f"set=all {b.shape[0]} transient states: P(I finish them)=q_W; "
          "P(I finish them | the roll is decided)=q_plus; "
          f"q_plus_NaN_count={np.count_nonzero(np.isnan(plus))}")
    return Committor(w, l, d, plus)


def _duration_data(q, plies):
    if not isinstance(plies, (tuple, list)) or len(plies) != 2:
        raise ChainError("plies must be Plies(transient_duration_matrix, absorbing_duration_vector)")
    D, a = plies
    if sparse.issparse(D):
        stored = D.tocoo(copy=True)
        d = sparse.csr_matrix(D, dtype=float, copy=True)
        d.sum_duplicates()
        if d.shape != q.shape or stored.nnz != d.nnz:
            raise ChainError("sparse duration matrix must match Q's shape without duplicate entries")
        d.sort_indices()
        if not np.array_equal(d.indptr, q.indptr) or not np.array_equal(d.indices, q.indices):
            raise ChainError("sparse durations must store exactly Q's positive support; "
                             "store zero-ply edges explicitly")
        data = d.data
    else:
        d = np.asarray(D, dtype=float)
        if d.shape != q.shape:
            raise ChainError("dense duration matrix must have Q's shape")
        edges = q.tocoo()
        data = d[edges.row, edges.col]
        outside = d.copy()
        outside[edges.row, edges.col] = 0
        if np.any(outside != 0):
            raise ChainError("duration matrix contains values outside Q's positive support")
    a = np.asarray(a, dtype=float)
    if a.shape != (q.shape[0],):
        raise ChainError("absorbing durations must be one deterministic duration per transient state")
    if not np.all(np.isfinite(data)) or np.any(data < 0) or not np.all(np.isfinite(a)) or np.any(a < 0):
        raise ChainError("durations must be finite and nonnegative; null is invalid")
    _emit(f"coverage set=Q edges and per-state absorbing durations: "
          f"transient_edges={q.nnz} absorbing_duration_rows={len(a)} "
          f"zero_ply_edges={np.count_nonzero(data == 0)}; floor=1 absorbing duration row")
    return data, a


def _zero_guard(q, duration, names):
    zero = q.copy()
    zero.data = (duration == 0).astype(float)
    zero.eliminate_zeros()
    count, component = _components(zero)
    sizes = np.bincount(component, minlength=count)
    cyclic = set(np.flatnonzero(sizes > 1).tolist())
    cyclic.update(component[np.flatnonzero(zero.diagonal() > 0)].tolist())
    _emit(f"coverage set=all {q.shape[0]} transient states under zero-duration edges: "
          f"zero_edges={zero.nnz} cyclic_components={len(cyclic)}; floor=1 state")
    if cyclic:
        by_name = [tuple(names[i] for i in np.flatnonzero(component == c)) for c in sorted(cyclic)]
        _fail(ZeroDurationCycleError, f"zero-duration cycles by label={by_name}; "
              "conservative S1 no-zero-cycle contract")


def expected_time(Q, plies, *, labels=None):
    """Return (E[T], Var[T]) in plies, including the absorbing exit's duration.

    With g_i=sum_j Q_ij D_ij + a_i exit_i and
    k_i=sum_j Q_ij D_ij^2 + a_i^2 exit_i, solve
      (I-Q)m = g,
      (I-Q)m2 = k + 2 (Q * D)m.
    Then Var[T]=m2-m^2. Here ``*`` is elementwise multiplication.
    The same LU is used for both solves; each prints its own residual.
    """
    q = _q_matrix(Q)
    names = _labels(labels, q.shape[0])
    d, a = _duration_data(q, plies)
    _zero_guard(q, d, names)
    system = _System(q, names)
    exits = _escape(q)
    first, second = q.copy(), q.copy()
    first.data *= d
    second.data *= d ** 2
    g = np.asarray(first.sum(axis=1)).ravel() + exits * a
    k = np.asarray(second.sum(axis=1)).ravel() + exits * a ** 2
    mean = _nonnegative(system.solve(g, "E[T] plies"), "E[T]")
    moment2 = _nonnegative(system.solve(k + 2 * (first @ mean), "E[T^2] plies"), "E[T^2]")
    variance = moment2 - mean ** 2
    scale = np.maximum(1.0, np.maximum(moment2, mean ** 2))
    if np.any(variance < -PROB_ATOL * scale):
        _fail(ChainError, "Var[T] has a materially negative entry")
    clipped = int(np.count_nonzero(variance < 0))
    if clipped:
        _emit(f"set=all {q.shape[0]} time variance entries: clipped_roundoff_negatives={clipped}")
    return TimeMoments(mean, np.maximum(variance, 0.0))


def _start(s0, n):
    s = np.asarray(s0, dtype=float)
    if s.shape != (n,) or not np.all(np.isfinite(s)) or np.any(s < 0):
        raise ChainError("s0 must be a finite, nonnegative vector over all transient states")
    if abs(float(s.sum()) - 1) > PROB_ATOL:
        raise ChainError("s0 must be normalized to one")
    _emit(f"coverage set=s0 on all {n} transient states: "
          f"positive_start_states={np.count_nonzero(s > 0)}; floor=1")
    return s


def occupancy(Q, s0, *, labels=None):
    """Expected visits per transient state, s0^T(I-Q)^(-1), using an adjoint solve."""
    q = _q_matrix(Q)
    s = _start(s0, q.shape[0])
    system = _System(q, _labels(labels, q.shape[0]))
    return _nonnegative(system.solve(s, "occupancy adjoint", transpose=True), "occupancy")


def conditional_occupancy(Q, R, s0, col, *, labels=None):
    """Expected visits GIVEN absorption in col, with Bayes-updated initial law.

    On h=B[:,col]>0, Qh_ij=Q_ij*h_j/h_i and s0h_i=s0_i*h_i/(s0@h).
    The result is independently checked against occupancy(Q,s0)*h/(s0@h) and
    against a backward step-time solve on Qh. Impossible conditioning fails.
    """
    system, r, b = _absorption_system(Q, R, labels)
    s = _start(s0, system.q.shape[0])
    col = _column(col, b.shape[1])
    h = b[:, col]
    probability = float(s @ h)
    if probability <= 0:
        _fail(ImpossibleConditionError, f"ending column={col} has zero mass under s0; "
              f"positive start labels={tuple(system.names[i] for i in np.flatnonzero(s > 0))}")
    support = h > 0
    idx = np.flatnonzero(support)
    hh = h[support]
    qh = (sparse.diags(1 / hh) @ system.q[support][:, support] @ sparse.diags(hh)).tocsr()
    rh = r[support, col].toarray().ravel() / hh
    sh = s[support] * hh / probability
    qh = _q_matrix(qh)
    sh = _start(sh, len(idx))
    if np.max(np.abs(np.asarray(qh.sum(axis=1)).ravel() + rh - 1)) > PROB_ATOL:
        _fail(ChainError, "Doob transformed row mass is not one")
    conditioned = _System(qh, tuple(system.names[i] for i in idx), exit_mass=rh)
    out = np.zeros_like(s)
    out[support] = _nonnegative(conditioned.solve(sh, "conditional occupancy adjoint", transpose=True),
                               "conditional occupancy")
    original = _nonnegative(system.solve(s, "unconditioned occupancy identity", transpose=True),
                            "unconditioned occupancy")
    identity_error = float(np.max(np.abs(out - original * h / probability)))
    steps = conditioned.solve(np.ones(len(idx)), "conditional E[steps]")
    time = float(sh @ steps)
    time_error = abs(float(out.sum()) - time)
    scale = max(1.0, time, float(np.max(out)))
    _emit(f"set=trajectories from s0 ending in column {col}, visits over all {len(s)} states: "
          f"event_probability={probability:.17g} positive_h_states={len(idx)} "
          f"zero_h_states={len(s)-len(idx)} expected_steps={time:.17g} "
          f"occupancy_identity_error={identity_error:.17g} visits_time_error={time_error:.17g}")
    if max(identity_error, time_error) > PROB_ATOL * scale:
        _fail(ChainError, "conditional occupancy failed its occupation identity or step-time sum")
    return out


def absorption_by_group(Q, R_fin, groups: Sequence, *, labels=None):
    """Return GroupAbsorption(group_labels, mass), preserving first-occurrence order.

    ``groups[j]`` is a hashable group label for EACH R_fin column j. R_fin may omit
    draws, so Q+R_fin need only be substochastic. Groups partition these columns;
    mass rows need not sum to one. No draw mass is invented or renormalized.
    """
    q = _q_matrix(Q)
    r = _r_matrix(q, R_fin, complete=False)
    groups = tuple(groups)
    if len(groups) != r.shape[1]:
        raise ChainError("groups must label every R_fin column exactly once")
    order = {}
    try:
        for group in groups:
            if group is None:
                raise ChainError("a finishing column cannot have a null group label")
            if group not in order:
                order[group] = len(order)
    except TypeError as exc:
        raise ChainError("group labels must be hashable") from exc
    codes = np.array([order[group] for group in groups])
    grouping = sparse.csr_matrix((np.ones(len(groups)), (np.arange(len(groups)), codes)),
                                 shape=(len(groups), len(order)))
    _emit(f"coverage set=all R_fin columns assigned once: columns={len(groups)} "
          f"groups={len(order)} matched_columns={grouping.nnz}; floors=1 column,1 group")
    system = _System(q, _labels(labels, q.shape[0]))
    mass = _nonnegative(system.solve(r @ grouping, "grouped absorption"), "grouped absorption")
    # Same factorization but independent order of aggregation and propagation.
    detailed = _nonnegative(system.solve(r, "per-finishing-column absorption"), "finishing absorption")
    error = float(np.max(np.abs(mass - (grouping.T @ detailed.T).T)))
    _emit(f"set=all {mass.size} state/group pairs: aggregate_before_after_error={error:.17g}")
    if error > PROB_ATOL:
        _fail(ChainError, "grouping before and after absorption disagree")
    return GroupAbsorption(tuple(order), mass)


class _Checks:
    def __init__(self):
        self.count = 0
        self.scalars = 0
        self.failures = []
        self.worst_z = 0.0

    def check(self, name, condition, detail, *, scalars=1):
        self.count += 1
        self.scalars += scalars
        ok = bool(condition) and scalars >= 1
        _emit(f"{'PASS' if ok else 'FAIL'} set={name}: checked={scalars}; {detail}")
        if not ok:
            self.failures.append(name)

    def close(self, name, actual, expected):
        a, b = np.asarray(actual), np.asarray(expected)
        if a.shape != b.shape or not a.size:
            self.check(name, False, f"shape mismatch/empty: actual={a.shape}, expected={b.shape}")
            return
        error = float(np.max(np.abs(a - b)))
        self.check(name, np.isfinite(error) and error <= CHECK_ATOL,
                   f"max_absolute_error={error:.17g} tolerance={CHECK_ATOL:g}", scalars=a.size)

    def raises(self, name, error_type, call, needles=()):
        diagnostic = io.StringIO()
        try:
            with redirect_stdout(diagnostic):
                call()
        except error_type as exc:
            print(diagnostic.getvalue(), end="")
            self.check(name, all(needle in str(exc) and needle in diagnostic.getvalue() for needle in needles),
                       f"expected {error_type.__name__}; labels/message={exc}")
        except Exception as exc:
            print(diagnostic.getvalue(), end="")
            self.check(name, False, f"wrong failure {type(exc).__name__}: {exc}")
        else:
            print(diagnostic.getvalue(), end="")
            self.check(name, False, f"expected {error_type.__name__} did not fire")

    def zscore(self, name, estimate, exact, se):
        estimate, exact, se = np.asarray(estimate), np.asarray(exact), np.asarray(se)
        if estimate.shape != exact.shape or estimate.shape != se.shape or not estimate.size:
            self.check(name, False, "Monte Carlo comparison shape mismatch or empty set")
            return
        z = np.full(exact.shape, np.inf)
        np.divide(np.abs(estimate - exact), se, out=z, where=se > 0)
        z[(se == 0) & (estimate == exact)] = 0
        worst = float(np.max(z))
        self.worst_z = max(self.worst_z, worst)
        index = tuple(int(i) for i in np.unravel_index(np.argmax(z), z.shape))
        self.check(name, np.all(np.isfinite(z)) and worst <= 4,
                   f"worst_z={worst:.9g} index={index} floor=positive observations; limit=4 SE",
                   scalars=exact.size)


def _unit_plies(q):
    d = sparse.csr_matrix(q, dtype=float, copy=True)
    d.data[:] = 1
    return Plies(d, np.ones(d.shape[0]))


def _gambler_checks(checks):
    N = 9
    states = np.arange(1, N, dtype=float)
    for p in (0.5, 0.37, 0.63):
        q = np.zeros((N - 1, N - 1))
        r = np.zeros((N - 1, 2))
        for i in range(N - 1):
            if i == 0:
                r[i, 1] = 1 - p
            else:
                q[i, i - 1] = 1 - p
            if i == N - 2:
                r[i, 0] = p
            else:
                q[i, i + 1] = p
        labels = tuple(f"ruin/{i}" for i in range(1, N))
        if p == 0.5:
            win = states / N
            mean = states * (N - states)
        else:
            ratio = (1 - p) / p
            win = (1 - ratio ** states) / (1 - ratio ** N)
            mean = (N * win - states) / (2 * p - 1)
        c = committor(q, r, 0, 1, labels=labels)
        moments = expected_time(q, _unit_plies(q), labels=labels)
        fixture = f"gambler p={p}, states={{1..{N-1}}}, absorbing boundaries={{0,{N}}}"
        checks.close(fixture + " P(win)", c.q_W, win)
        checks.close(fixture + " P(lose)", c.q_L, 1 - win)
        checks.close(fixture + " conditional committor", c.q_plus, win)
        checks.close(fixture + " expected steps", moments.mean, mean)
        checks.close(fixture + " draw mass", c.q_D, np.zeros(N - 1))
        if p == 0.5:
            variance = mean * (N ** 2 - 2 - 2 * mean) / 3
            checks.close(fixture + " variance of steps (closed form)", moments.variance, variance)


def _hand_checks(checks):
    q = np.array([[0, 0.5, 0], [0, 0, 0], [0, 0, 0]], dtype=float)
    r = np.array([[0.25, 0, 0.25], [0.5, 0.5, 0], [0, 0, 1]], dtype=float)
    labels = ("fork/my-turn", "finish/their-turn", "draw-only/my-turn")
    s = np.array([0.5, 0.25, 0.25])
    b = absorption(q, r, labels=labels)
    checks.close("hand chain all states/absorbing W,L,D columns", b,
                 [[0.5, 0.25, 0.25], [0.5, 0.5, 0], [0, 0, 1]])
    c = committor(q, r, 0, 1, 2, labels=labels)
    checks.close("hand chain all states W+L+D", c.q_W + c.q_L + c.q_D, np.ones(3))
    checks.close("hand chain decisive-capable states q_plus", c.q_plus[:2], [2 / 3, 0.5])
    checks.check("hand chain draw-only state conditional committor", np.isnan(c.q_plus[2]),
                 "NaN_count=1")
    d = sparse.csr_matrix(([0.0], ([0], [1])), shape=q.shape)
    moments = expected_time(q, Plies(d, [1, 2, 3]), labels=labels)
    checks.close("hand chain all states E[plies], zero edge fork->finish", moments.mean, [1.5, 2, 3])
    checks.close("hand chain all states Var[plies]", moments.variance, [0.25, 0, 0])
    checks.close("hand chain dense/sparse explicit-zero duration parity",
                 expected_time(q, (np.zeros_like(q), [1, 2, 3]), labels=labels).mean, moments.mean)
    visits = occupancy(q, s, labels=labels)
    checks.close("hand chain s0=(1/2,1/4,1/4) visits", visits, [0.5, 0.5, 0.25])
    checks.close("hand chain visits sum equals expected steps, not plies",
                 visits.sum(), s @ expected_time(q, _unit_plies(q), labels=labels).mean)
    co = conditional_occupancy(q, r, s, 0, labels=labels)
    checks.close("hand chain visits given W; Bayes-conditioned s0", co, [2 / 3, 2 / 3, 0])
    checks.close("hand chain expected step count given W", co.sum(), 4 / 3)
    # Unequal positive h is essential: the preceding fixture has equal h on its
    # W-capable starts and cannot distinguish Bayes weighting from renormalizing.
    unequal_h = conditional_occupancy(np.zeros((2, 2)), [[0.25, 0.75], [0.75, 0.25]],
                                      [0.5, 0.5], 0, labels=["low-W-start", "high-W-start"])
    checks.close("immediate-exit mixture with unequal W chances, conditional starting law",
                 unequal_h, [0.25, 0.75])
    checks.raises("hand chain impossible W from draw-only start", ImpossibleConditionError,
                  lambda: conditional_occupancy(q, r, [0, 0, 1], 0, labels=labels),
                  ("draw-only/my-turn",))
    rfin = np.column_stack([r[:, 0] * 0.25, r[:, 0] * 0.75, r[:, 1]])
    grouped = absorption_by_group(q, rfin, ["arm", "leg", "arm"], labels=labels)
    checks.check("hand chain finishing group order", grouped.groups == ("arm", "leg"),
                 f"groups={grouped.groups}", scalars=2)
    checks.close("hand chain all states/arm,leg finishing groups; draws excluded", grouped.mass,
                 np.column_stack([0.25 * b[:, 0] + b[:, 1], 0.75 * b[:, 0]]))
    checks.close("hand chain total grouped mass equals W+L", grouped.mass.sum(axis=1), b[:, :2].sum(axis=1))
    for time in (0.0, 2.0):
        t = expected_time([[0]], (sparse.csr_matrix((1, 1)), [time]), labels=["immediate-exit"])
        checks.close(f"immediate absorption duration={time} mean", t.mean, [time])
        checks.close(f"immediate absorption duration={time} variance", t.variance, [0])


def _failure_checks(checks):
    q = [[0, 0.5, 0], [0, 0, 1], [0, 1, 0]]
    r = [[0.5], [0], [0]]
    labels = ["feeder", "locked/top", "locked/bottom"]
    checks.raises("closed transient class with a feeder and a genuine exit elsewhere",
                  ClosedTransientClassError, lambda: absorption(q, r, labels=labels),
                  ("locked/top", "locked/bottom"))
    checks.raises("closed transient class adjoint guard", ClosedTransientClassError,
                  lambda: occupancy(q, [1, 0, 0], labels=labels), ("locked/top", "locked/bottom"))
    checks.raises("closed transient singleton", ClosedTransientClassError,
                  lambda: absorption([[1]], [[0]], labels=["trap/self"]), ("trap/self",))
    qz = sparse.csr_matrix([[0, 0.5], [0.5, 0]])
    dz = qz.copy()
    dz.data[:] = 0
    checks.raises("escapable zero-duration two-cycle, conservative guard", ZeroDurationCycleError,
                  lambda: expected_time(qz, (dz, [1, 1]), labels=["zeno/top", "zeno/bottom"]),
                  ("zeno/top", "zeno/bottom"))
    checks.raises("closed zero-duration two-cycle guard precedes LU", ZeroDurationCycleError,
                  lambda: expected_time([[0, 1], [1, 0]], (dz, [1, 1]),
                                        labels=["zeno-closed/top", "zeno-closed/bottom"]),
                  ("zeno-closed/top", "zeno-closed/bottom"))
    checks.raises("zero-duration self-cycle", ZeroDurationCycleError,
                  lambda: expected_time([[0.5]], ([[0]], [1]), labels=["zeno/self"]), ("zeno/self",))
    checks.raises("negative probability", ChainError, lambda: absorption([[-0.1]], [[1.1]]))
    checks.raises("negative duplicate probability cannot cancel before validation", ChainError,
                  lambda: absorption(sparse.coo_matrix(([-0.1, 0.6], ([0, 0], [0, 0])), shape=(1, 1)),
                                     [[0.5]]))
    checks.raises("null probability is not zero", ChainError, lambda: absorption([[None]], [[1]]))
    checks.raises("null absorbing probability is not zero", ChainError,
                  lambda: absorption([[0]], [[1, None]]))
    checks.raises("missing absorbing mass", ChainError, lambda: absorption([[0]], [[0.5]]))
    checks.raises("empty state set", ChainError, lambda: occupancy(np.empty((0, 0)), []))
    checks.raises("empty starting law", ChainError, lambda: occupancy([[0]], [0]))
    checks.raises("uncovered committor column", ChainError,
                  lambda: committor([[0]], [[0.25, 0.25, 0.5]], 0, 1))
    checks.raises("duplicate committor column", ChainError,
                  lambda: committor([[0]], [[0.5, 0.5]], 0, 0))
    checks.raises("missing group assignment", ChainError,
                  lambda: absorption_by_group([[0]], [[0.5, 0.5]], ["arm"]))
    checks.raises("null group assignment", ChainError,
                  lambda: absorption_by_group([[0]], [[1]], [None]))
    checks.raises("unlabelled sparse zero-ply edge", ChainError,
                  lambda: expected_time([[0, 0.5], [0, 0]], (sparse.csr_matrix((2, 2)), [1, 1])))
    checks.raises("negative duration", ChainError, lambda: expected_time([[0]], ([[0]], [-1])))
    checks.raises("duplicate transient labels", ChainError,
                  lambda: absorption([[0, 0], [0, 0]], [[1], [1]], labels=["same", "same"]))
    # Positive mass is NEVER thresholded out of the support graph.
    eps = 2.0 ** -30
    rare = absorption([[1 - eps]], [[eps]], labels=["rare-but-real-exit"])
    checks.close("positive tiny exit remains an edge, not a closed class", rare, [[1]])


def _sample_chain(q, r, d, absorbing_duration, rng, paths):
    n = q.shape[0]
    initial = rng.integers(0, n, size=paths)
    current = initial.copy()
    outcome = np.full(paths, -1, dtype=int)
    visits = np.zeros((paths, n), dtype=np.uint16)
    duration = np.zeros(paths)
    steps = np.zeros(paths, dtype=np.int32)
    cdf = np.cumsum(np.column_stack([q, r]), axis=1)
    if np.max(np.abs(cdf[:, -1] - 1)) > PROB_ATOL:
        raise AssertionError("Monte Carlo fixture rows are not stochastic")
    cdf[:, -1] = 1.0  # Only eliminate final cumulative floating-point roundoff.
    active = np.arange(paths)
    iterations = 0
    while active.size:
        iterations += 1
        if iterations > 10000:
            raise AssertionError("Monte Carlo step cap reached; no trajectories may be censored")
        state = current[active]
        visits[active, state] += 1
        steps[active] += 1
        target = np.sum(rng.random(active.size)[:, None] >= cdf[state], axis=1)
        transient = target < n
        moving, ending = active[transient], active[~transient]
        duration[moving] += d[state[transient], target[transient]]
        duration[ending] += absorbing_duration[state[~transient]]
        outcome[ending] = target[~transient] - n
        current[moving] = target[transient]
        active = moving
    _emit(f"coverage set=random synthetic chain Monte Carlo paths from iid uniform starts: "
          f"trajectories={paths} absorbed={np.count_nonzero(outcome >= 0)} "
          f"transient_visits={int(steps.sum())} max_steps={iterations}; "
          "floor=200000 completed trajectories; censoring=none")
    return initial, outcome, visits, duration, steps


def _mean_se(samples):
    return np.mean(samples, axis=0), np.std(samples, axis=0, ddof=1) / np.sqrt(len(samples))


def _mc_checks(checks):
    rng = np.random.default_rng(20260924)
    n, paths = 30, 300000
    # Every transient pair and every absorbing column has positive probability.
    transient = rng.dirichlet(np.full(n, 1.5), size=n)
    exit_mass = rng.uniform(0.12, 0.32, size=n)
    q = transient * (1 - exit_mass[:, None])
    r = rng.dirichlet(np.full(3, 2.0), size=n) * exit_mass[:, None]
    d = rng.integers(1, 4, size=(n, n)).astype(float)
    # Zero-duration edges only go to a larger index, so that subgraph is acyclic.
    d[np.triu(rng.random((n, n)) < 0.18, k=1)] = 0
    a = rng.integers(1, 4, size=n).astype(float)
    labels = tuple(f"random/{i:02d}" for i in range(n))
    s = np.full(n, 1 / n)
    b = absorption(q, r, labels=labels)
    c = committor(q, r, 0, 1, 2, labels=labels)
    t = expected_time(q, (d, a), labels=labels)
    occ = occupancy(q, s, labels=labels)
    conditional = [conditional_occupancy(q, r, s, col, labels=labels) for col in range(3)]
    groups = absorption_by_group(q, r, ["decisive", "decisive", "draw"], labels=labels)
    initial, outcome, visits, duration, steps = _sample_chain(q, r, d, a, rng, paths)
    starts = np.bincount(initial, minlength=n)
    endings = np.bincount(outcome, minlength=3)
    checks.check("random chain observed initial states", len(starts) == n and starts.min() >= 5000,
                 f"states={n} min_paths_per_state={starts.min()} floor=5000", scalars=n)
    checks.check("random chain completed trajectories/ending columns", paths >= 200000 and endings.min() >= 10000,
                 f"trajectories={paths} ending_counts={endings.tolist()} floor=200000 total,10000 per ending",
                 scalars=3)
    bhat, bse = np.zeros_like(b), np.zeros_like(b)
    mhat, mse, vhat, vse, chat, cse = (np.zeros(n) for _ in range(6))
    ghat, gse = np.zeros_like(groups.mass), np.zeros_like(groups.mass)
    for state in range(n):
        mask = initial == state
        endings_here, times_here = outcome[mask], duration[mask]
        bhat[state], bse[state] = _mean_se(endings_here[:, None] == np.arange(3))
        mhat[state], mse[state] = _mean_se(times_here)
        count = times_here.size
        vhat[state] = np.var(times_here, ddof=1)
        mu4 = np.mean((times_here - np.mean(times_here)) ** 4)
        # Plug-in finite-sample standard error of the unbiased sample variance.
        variance_of_variance = (mu4 - (count - 3) / (count - 1) * vhat[state] ** 2) / count
        if variance_of_variance <= 0:
            raise AssertionError("Monte Carlo variance standard error has no positive coverage")
        vse[state] = np.sqrt(variance_of_variance)
        decisive = endings_here[endings_here != 2]
        if decisive.size < 1000:
            raise AssertionError("Monte Carlo decisive-per-start coverage below floor=1000")
        chat[state], cse[state] = _mean_se(decisive == 0)
        ghat[state], gse[state] = _mean_se(np.column_stack([endings_here != 2, endings_here == 2]))
    checks.zscore("random chain all transient states x W,L,D absorption B", bhat, b, bse)
    checks.zscore("random chain all transient states expected plies", mhat, t.mean, mse)
    checks.zscore("random chain all transient states variance of plies", vhat, t.variance, vse)
    checks.zscore("random chain all transient states conditional committor", chat, c.q_plus, cse)
    checks.zscore("random chain all transient states x decisive,draw groups", ghat, groups.mass, gse)
    estimate, se = _mean_se(visits)
    checks.zscore("random chain uniform-start occupancy over all transient states", estimate, occ, se)
    for col in range(3):
        selected = outcome == col
        estimate, se = _mean_se(visits[selected])
        checks.zscore(f"random chain uniform-start visits given ending {col}, all transient states",
                      estimate, conditional[col], se)
        step_estimate, step_se = _mean_se(steps[selected])
        checks.zscore(f"random chain uniform-start step count given ending {col}",
                      step_estimate, conditional[col].sum(), step_se)
    checks.close("random chain sampled visits sum equals sampled step count for every path",
                 visits.sum(axis=1), steps)
    _emit(f"set=all exact-vs-Monte-Carlo quantities on the random synthetic chain: "
          f"worst_z={checks.worst_z:.9g}; seed=20260924; limit=4 SE")


def _mutation_checks(checks):
    """Named known-answer suites must reject plausible mistakes; no files are changed."""
    mutations = (
        ("missing second-moment cross term", expected_time, "k + 2 * (first @ mean)",
         "k + (first @ mean)", _gambler_checks),
        ("zero-ply edge charged one ply", expected_time, "first.data *= d",
         "first.data *= np.maximum(d, 1)", _hand_checks),
        ("occupancy solved without transpose", occupancy, "transpose=True",
         "transpose=False", _hand_checks),
        ("conditional starting law not Bayes-updated", conditional_occupancy,
         "sh = s[support] * hh / probability", "sh = s[support] / s[support].sum()", _hand_checks),
        ("draw mass invented in finishing groups", absorption_by_group,
         "return GroupAbsorption(tuple(order), mass)",
         "mass[:, 0] += 1 - mass.sum(axis=1)\n    return GroupAbsorption(tuple(order), mass)", _hand_checks),
        ("closed-class guard removed", _closed_guard,
         "count, component = _components(q)", "return\n    count, component = _components(q)", _failure_checks),
        ("zero-duration-cycle guard removed", _zero_guard,
         "zero = q.copy()", "return\n    zero = q.copy()", _failure_checks),
        ("named failure diagnostic not printed", _fail,
         '_emit(f"FAIL {kind.__name__}: {message}")', "pass", _failure_checks),
        ("null coerced to zero before validation", _matrix, "np.asarray(value, dtype=float)",
         "np.nan_to_num(np.asarray(value, dtype=float), nan=0.0)", _failure_checks),
    )
    for name, original, before, after, suite in mutations:
        source = inspect.getsource(original)
        if source.count(before) != 1:
            checks.check(f"mutation {name}", False, "replacement coverage must be exactly one")
            continue
        probe = _Checks()
        try:
            # Override one function only, run a named proof suite, then restore.
            exec(compile(source.replace(before, after), f"<synthetic mutation: {name}>", "exec"), globals())
            with redirect_stdout(io.StringIO()):
                try:
                    suite(probe)
                except Exception as exc:
                    probe.check(f"suite {suite.__name__} completed", False,
                                f"{type(exc).__name__}: {exc}")
        finally:
            globals()[original.__name__] = original
        checks.check(f"mutation {name}", bool(probe.failures) and probe.count > 0,
                     f"named_suite={suite.__name__} executed_checks={probe.count} "
                     f"killed_by={probe.failures}; floor=1 named failed check")


def selfcheck():
    global _SELF_CHECK
    _SELF_CHECK = True
    checks = _Checks()
    for suite in (_gambler_checks, _hand_checks, _failure_checks, _mc_checks, _mutation_checks):
        try:
            suite(checks)
        except Exception as exc:
            checks.check(f"suite {suite.__name__} completed", False, f"{type(exc).__name__}: {exc}")
    # Floors force the named suites and all substantive comparisons to execute.
    checks.check("selfcheck named assertions", checks.count >= 80,
                 f"checks_before_floor={checks.count} floor=80")
    checks.check("selfcheck scalar comparisons", checks.scalars >= 300500,
                 f"scalar_comparisons_before_floor={checks.scalars} floor=300500")
    _emit(f"{'FAIL' if checks.failures else 'PASS'} set=all synthetic selfcheck suites: "
          f"checks={checks.count} scalar_comparisons={checks.scalars} "
          f"failures={len(checks.failures)} worst_mc_z={checks.worst_z:.9g}")
    if checks.failures:
        _emit(f"FAIL named checks={checks.failures}")
        return 1
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--selfcheck", action="store_true", help="run all known-answer and seeded Monte Carlo proofs")
    args = parser.parse_args(argv)
    if not args.selfcheck:
        parser.error("this methods-only module requires --selfcheck; no real graph is loaded")
    return selfcheck()


if __name__ == "__main__":
    raise SystemExit(main())
