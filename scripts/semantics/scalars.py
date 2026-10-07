#!/usr/bin/env python3
"""
STATE SCALARS — exact per-state meanings of the corpus's game, on the shared semantics kernel.

    python3 -B scripts/semantics/scalars.py --selfcheck          # S1 toys + S2 toys + real-kernel gates
    python3 -B scripts/semantics/scalars.py --json               # writes tests/artifacts/semantics/scalars.json
    python3 -B scripts/semantics/scalars.py --json --full-out <path>   # + per-state cards (~22 MB), never committed
    python3 -B scripts/semantics/scalars.py --consequences       # item S3 (needs node + the emitted wire)
    python3 -B scripts/semantics/scalars.py --state mount/top    # one role-node's full card (headline config)
    python3 -B scripts/semantics/scalars.py --state mount/top --frame gi --initiative shipped --rates frame --origin off

WHICH GAME. Every number is about THE CORPUS'S GAME (gs-shared.md §3): both seats sample the
authored, origin-filtered attempt shares; no resistance, no app policy. The app's game is a
different chain and nothing here describes it.

WHAT IS COMPUTED, per configuration (frame gi|nogi × initiative shipped|symmetric × origin on|off at
shipped rates, plus gi at frame-correct rates), for every role-node at MY turn (M) and THEIR turn (T):
  committor      q_W = P(I finish them), q_L, q_D (optionless-hand draw), q+ = q_W / (q_W + q_L)
                 at H = infinity, by `_absorbing.committor`, cross-checked against K.absorption().
  clock          V_H for H in {9,10,11,12} plies (K.finite_horizon, and independently by propagating
                 K.cells, which also yields the optionless-draw part), their uniform mixture, the ply
                 survival P(T > H), and Proposition B: 0 <= q - V_H <= P(T > H) with equality of the sum.
  tempo          E and SD of STEPS (cards) and PLIES (one card; a stay-put miss costs 0; the kernel's time unit) to the
                 finish, by `_absorbing.expected_time` with durations read from K.cells (asserted unique
                 per (src, dst) edge), cross-checked by a cell-level moment recursion.
  occupancy      expected visits per roll from standing / from "anywhere" (me first); visits in rolls I
                 win vs rolls I lose (Doob transform WITH a Bayes-updated start law).
  exit law       K.exit_law() grouped by performer x raw submission `type` (a lexicon of technique ->
                 group can replace `type`: --lexicon), per state and per hub; hub vectors convert me/them
                 to the physical TOP/BOTTOM finisher BEFORE averaging the two viewpoint seats.
  coherence      the committor against the corpus's own labels (positionType, pointValue, riskLevel,
                 strength), disagreements listed with their robustness (ruling 1: fraction of
                 K.perturbed(0.2, 0.2, seed) seeds 0..199 in which it holds, plus origin=off, the other
                 rule, the other frame).
  frames         gi vs nogi and gi frame-rates vs folded rates: per-state |dq| and exit-law TV (columns
                 joined by (technique, performer) identity, never by index), top movers with an EXACT
                 card attribution (Proposition A: zero remainder when every card is listed).

PROPOSITIONS (proved in the lane file lane-gs-2.md, S2R.0; checked numerically here):
  A  b1 - b0 = N1[(R1 - R0) g + (Q1 - Q0) b0]          exact finite-change resolvent identity
  B  0 <= q - V_H = M^H q <= M^H 1 = P(T > H)            clocked vs infinite committor
  C  h_C = Q h_C + R_C has no strict maximum off its core {R_C > 0}; max over S = max over the core
  D  symmetric rule: q̄(r) + q̄(flip r) = 1 - D̄(r)      (½ is the neutral threshold only there)
  E  symmetric rule: seat-labelled hub vectors do not depend on whose turn it is
  F  P(I finish | the roll outlasts H plies) -> ψ·q_W (Yaglom limit of the ply operator); = ½ under the
     symmetric rule, so there the clock SHARPENS every verdict (q+ - ½ scaled by ~1/(1 - P(T > H)))

Deterministic: no randomness outside numpy.random.default_rng(<fixed seed>); JSON keys sorted.
Only the kernel builds a chain; corpus fields are joined by role-node / technique id for reading.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tempfile
from types import SimpleNamespace

import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu
from scipy.stats import binom, norm, spearmanr

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))
import _absorbing as ab  # noqa: E402
from _kernel import CELL_DTYPE, ID, IL, IW, Kernel, load_kernel  # noqa: E402  (puts scripts/ on sys.path)
from score_graph_nodes import risk_penalty  # noqa: E402
from solve_edge_values import GRAPH_PATH  # noqa: E402

COMMAND = "python3 -B scripts/semantics/scalars.py"
DEFAULT_JSON = REPO / "tests/artifacts/semantics/scalars.json"
# Intermediates (FLOW JSONs, the Node route's outputs, the payload probe's table) go to a WORK dir that
# is never inside the repo: the system temp dir by default, or --work-dir. No machine path is hard-coded.
_WORK = None


def work_dir():
    global _WORK
    if _WORK is None:
        _WORK = Path(tempfile.gettempdir()) / "gs2-scalars"
    _WORK.mkdir(parents=True, exist_ok=True)
    return _WORK
HORIZONS = (9, 10, 11, 12)
TOL = 1e-11
EPS = 0.2
SEEDS = tuple(range(200))
MC_SEED = 20260924
MC_PATHS = 200_000
MC_FAMILY_ALPHA = 1e-3
ARTIFACT_LIMIT = 1_000_000
TOP = 20
HEADLINE = ("nogi", "symmetric", "shipped", True)
MAIN = tuple((f, i, "shipped", True) for f in ("nogi", "gi") for i in ("symmetric", "shipped"))
CONFIGS = MAIN + tuple((f, i, "shipped", False) for f in ("nogi", "gi") for i in ("symmetric", "shipped")) \
    + tuple(("gi", i, "frame", True) for i in ("symmetric", "shipped"))
POSITION_DIRECTION = {"Defensive": -1, "Defensive with offensive options": -1, "Neutral": 0,
                      "Offensive": 1, "Offensive/Controlling": 1}
RISK_ORDER = {"Low": 0.0, "Low to Medium": 0.5, "Medium": 1.0, "Medium to High": 1.5, "High": 2.0}
_MUTANT = None          # selfcheck-only: names one deliberately broken adapter


# --------------------------------------------------------------------------- #
# plumbing: named errors, checks, diagnostics
# --------------------------------------------------------------------------- #
class ScalarError(ValueError):
    """A named adapter failure (durations, joins, conditioning)."""


class DurationConflictError(ScalarError):
    """One (src, dst) edge carries cells with different ply costs."""


class ZeroPlyCycleError(ScalarError):
    """The 0-ply graph has a cycle, so the clock recursion is not finite."""


class JoinError(ScalarError):
    """An id join (finisher columns, labels, lexicon, metadata) is incomplete or misaligned."""


def emit(message):
    print(f"[scalars] {message}", file=sys.stderr, flush=True)


def require(condition, message, kind=ScalarError):
    if not condition:
        raise kind(message)


class Checks:
    """PASS/FAIL lines on stderr, a positive coverage count per check, failures collected."""

    def __init__(self, quiet=False):
        self.count = self.compared = 0
        self.failures = []
        self.errors = {}
        self.quiet = quiet

    def ok(self, name, condition, detail="", count=1):
        good = bool(condition) and count > 0
        self.count += 1
        self.compared += max(int(count), 0)
        if not self.quiet:
            emit(f"{'PASS' if good else 'FAIL'} {name}; compared={count}{'; ' + detail if detail else ''}")
        if not good:
            self.failures.append(name)
        return good

    def close(self, name, actual, expected, tol=TOL):
        a, b = np.asarray(actual, dtype=float), np.asarray(expected, dtype=float)
        if a.shape != b.shape or a.size == 0:
            return self.ok(name, False, f"shape {a.shape} vs {b.shape}", 0)
        both_nan = np.isnan(a) & np.isnan(b)
        diff = np.where(both_nan, 0.0, np.abs(a - b))
        err = float(np.max(diff)) if diff.size else float("nan")
        self.errors[name] = err
        self.ok(name, np.isfinite(err) and err <= tol, f"max_error={err:.3e} tol={tol:g}", a.size)
        return err

    def raises(self, name, kind, call, needles=()):
        try:
            with redirect_stdout(io.StringIO()):
                call()
        except kind as exc:
            return self.ok(name, all(n in str(exc) for n in needles), f"fired {kind.__name__}: {str(exc)[:160]}")
        except Exception as exc:  # noqa: BLE001 - the wrong failure is itself the finding
            return self.ok(name, False, f"wrong failure {type(exc).__name__}: {exc}")
        return self.ok(name, False, f"expected {kind.__name__}; nothing fired")


_RESID = re.compile(r"max_residual=([0-9.eE+-]+)")
_OWN_RESIDUAL = [0.0, 0]


def own_call(tag, function, *args, **kwargs):
    """Run an `_absorbing` method, forwarding its printed diagnostics to stderr and recording the
    largest printed LU residual (every S1 solve prints one)."""
    stream = io.StringIO()
    try:
        with redirect_stdout(stream):
            return function(*args, **kwargs)
    finally:
        for line in stream.getvalue().splitlines():
            m = _RESID.search(line)
            if m:
                _OWN_RESIDUAL[0] = max(_OWN_RESIDUAL[0], float(m.group(1)))
                _OWN_RESIDUAL[1] += 1
            emit(f"{tag} | {line}")


def cid(k):
    return f"{k.frame}/{k.initiative}/{k.rates}/origin={'on' if k.origin else 'off'}"


def ckey(frame, initiative, rates, origin):
    return f"{frame}/{initiative}/{rates}/origin={'on' if origin else 'off'}"


def lab(k, t):
    return f"{k.labels[t][0]}@{k.labels[t][1]}" if t >= 0 else ("W", "L", "D")[-1 - t]


def recompute(cfg=None, state=None):
    if state is None:
        return f"{COMMAND} --json"
    f, i, r, o = cfg
    return f"{COMMAND} --state {state} --frame {f} --initiative {i} --rates {r} --origin {'on' if o else 'off'}"


# --------------------------------------------------------------------------- #
# durations and the clock
# --------------------------------------------------------------------------- #
def zero_depth(k):
    """Longest path (in edges) of the positive-mass 0-ply transient graph; ZeroPlyCycleError names a
    cycle. Q0^(depth+1) = 0, so (I - Q0)^-1 = sum_{j<=depth} Q0^j exactly."""
    c = k.cells
    z = (c["dst"] >= 0) & (c["plies"] == 0) & (c["mass"] > 0)
    edges = sorted(set(zip(c["src"][z].tolist(), c["dst"][z].tolist())))
    succ = defaultdict(list)
    indeg = Counter()
    for s, d in edges:
        succ[s].append(d)
        indeg[d] += 1
    nodes = {s for s, _d in edges} | {d for _s, d in edges}
    depth = {n: 0 for n in nodes}
    queue = sorted(n for n in nodes if indeg[n] == 0)
    seen = 0
    while queue:
        n = queue.pop()
        seen += 1
        for d in succ[n]:
            depth[d] = max(depth[d], depth[n] + 1)
            indeg[d] -= 1
            if indeg[d] == 0:
                queue.append(d)
    if seen != len(nodes):
        cyc = sorted(n for n in nodes if indeg[n] > 0)
        raise ZeroPlyCycleError(f"{cid(k)}: 0-ply cycle through {[lab(k, n) for n in cyc][:8]} "
                                f"({len(cyc)} states); the ply clock is not finite")
    return max(depth.values(), default=0), len(edges)


def build_plies(k):
    """Durations read off ALL kernel cells, asserted unique per (src, dst) edge (transient) and per
    source (absorbing), then laid on Q's positive support with explicit zeros (S1's Plies contract)."""
    c = k.cells
    by_pair = defaultdict(set)
    for s, d, p in zip(c["src"].tolist(), c["dst"].tolist(), c["plies"].tolist()):
        by_pair[(s, d)].add(p)
    conflicts = sorted((pair, sorted(v)) for pair, v in by_pair.items() if len(v) > 1)
    if conflicts:
        raise DurationConflictError(
            f"{cid(k)}: {len(conflicts)} edge(s) with conflicting ply costs: "
            + "; ".join(f"{lab(k, s)} -> {lab(k, d)} plies {v}" for (s, d), v in conflicts[:6]))
    absorbing = defaultdict(set)
    for s, d, p in zip(c["src"].tolist(), c["dst"].tolist(), c["plies"].tolist()):
        if d < 0:
            absorbing[s].add(p)
    bad = sorted(s for s, v in absorbing.items() if len(v) > 1)
    if bad:
        raise DurationConflictError(f"{cid(k)}: absorbing exits with different ply costs at "
                                    f"{[lab(k, s) for s in bad][:6]}")
    a = np.ones(k.n_t)
    for s, v in absorbing.items():
        a[s] = float(next(iter(v)))
    q = k.Q.tocsr(copy=True)
    q.eliminate_zeros()
    q.sum_duplicates()
    q.sort_indices()
    coo = q.tocoo()
    d = q.copy()
    d.data = np.array([float(next(iter(by_pair[(int(i), int(j))]))) for i, j in zip(coo.row, coo.col)])
    depth, zero_edges = zero_depth(k)
    cov = {"cells_checked": int(len(c)), "edges_checked": len(by_pair), "positive_Q_edges": int(q.nnz),
           "zero_ply_cells": int(((c["dst"] >= 0) & (c["plies"] == 0)).sum()), "zero_ply_edges": zero_edges,
           "zero_ply_depth": depth, "absorbing_sources": len(absorbing), "duration_conflicts": 0}
    require(q.nnz > 0 and len(by_pair) > 0, f"{cid(k)}: duration adapter inspected nothing")
    return ab.Plies(d, a), cov


def cell_clock(k, horizons=HORIZONS):
    """INDEPENDENT of K.finite_horizon: x_H[s, k] = P(end in column k within H plies), propagated
    cell by cell. Column D is the optionless-hand draw inside the clock (finite_horizon lumps it
    with the timeout)."""
    c = k.cells
    tr = c["dst"] >= 0
    zero = tr & (c["plies"] == 0)
    one = tr & (c["plies"] != 0)
    ab_ = ~tr
    require(np.all(c["plies"][ab_] == 1), f"{cid(k)}: cell clock needs unit absorbing exits")
    require(np.all(c["plies"][one] == 1), f"{cid(k)}: cell clock needs plies in {{0, 1}}")
    if _MUTANT == "clock_charges_zero_ply":
        zero, one = np.zeros_like(zero), tr
    depth, _e = zero_depth(k)
    r = np.zeros((k.n_t, 3))
    np.add.at(r, (c["src"][ab_], -1 - c["dst"][ab_]), c["mass"][ab_])
    x = np.zeros((k.n_t, 3))
    out = {}
    for h in range(1, max(horizons) + 1):
        y = r.copy()
        np.add.at(y, c["src"][one], c["mass"][one, None] * x[c["dst"][one]])
        z = y.copy()
        for _ in range(depth):
            nz = y.copy()
            np.add.at(nz, c["src"][zero], c["mass"][zero, None] * z[c["dst"][zero]])
            z = nz
        x = z
        if h in horizons:
            out[h] = x.copy()
    return out


def m_operator(k):
    """M = (I - Q0)^-1 Q1, the one-PLY operator (0-ply prefix folded in); exact for nilpotent Q0."""
    depth, _e = zero_depth(k)
    inv = sparse.identity(k.n_t, format="csr")
    term = sparse.identity(k.n_t, format="csr")
    for _ in range(depth):
        term = (term @ k.Q0).tocsr()
        inv = (inv + term).tocsr()
    return (inv @ k.Q1).tocsr()


def lu_solve(k, rhs, name, transpose=False):
    x = k.fundamental().solve(np.asarray(rhs, dtype=float), trans="T" if transpose else "N")
    a = sparse.identity(k.n_t, format="csr") - k.Q
    if transpose:
        a = a.T
    res = float(np.max(np.abs(a @ x - rhs)))
    emit(f"{cid(k)} | kernel LU {name}: max_residual={res:.3e} rhs_entries={np.size(rhs)}")
    require(res <= TOL * max(1.0, float(np.max(np.abs(rhs)))), f"{cid(k)}: kernel LU residual {name}")
    return x


def cell_moments(k, durations):
    """Reward moments over CELLS (no per-edge durations assumed): m = N g, m2 = N[sum mass (d^2 + 2 d m(dst))]."""
    c = k.cells
    d = np.asarray(durations, dtype=float)
    m = lu_solve(k, np.bincount(c["src"], weights=c["mass"] * d, minlength=k.n_t), "cell mean")
    fut = np.where(c["dst"] >= 0, m[np.maximum(c["dst"], 0)], 0.0)
    m2 = lu_solve(k, np.bincount(c["src"], weights=c["mass"] * (d * d + 2 * d * fut), minlength=k.n_t),
                  "cell second moment")
    return m, np.maximum(m2 - m * m, 0.0)


def yaglom(k, M, b, checks, tag):
    """Proposition F: P_s(end in k | T > H) = (M^H B_k)(s) / (M^H 1)(s) -> ψ·B_k / ψ·1, ψ the left
    Perron vector of the ply operator M on the reachable set; under the symmetric rule ψ·q_W = ½ψ·1.
    Checked: the limit from the dense eigenvector vs the ratio at H = 400, and the ratio's spread at
    the clock horizons."""
    idx = np.flatnonzero(k.reach_t)
    Mr = M.toarray()[np.ix_(idx, idx)]
    w, V = np.linalg.eig(Mr.T)
    o = np.argsort(-np.abs(w))
    lam1, lam2 = float(w[o[0]].real), float(abs(w[o[1]]))
    psi = np.real(V[:, o[0]])
    psi = psi / psi.sum()
    require(abs(w[o[0]].imag) < 1e-12 and psi.min() > -1e-12, f"{tag}: Perron vector of M not real/nonnegative")
    limit = psi @ b[idx] / psi.sum()
    Y, one = b.copy(), np.ones(k.n_t)
    ratios = {}
    for h in range(1, 401):
        Y, one = M @ Y, M @ one
        if h in HORIZONS or h == 400:
            with np.errstate(invalid="ignore", divide="ignore"):
                ratios[h] = Y[idx] / one[idx, None]
    far = np.abs(ratios[400] - limit[None, :])
    far = far[np.isfinite(far).all(axis=1)]
    checks.ok(f"{tag} Prop F: P(end in k | T > H) -> ψ·B_k (dense Perron vector vs H = 400 ratio)",
              far.size > 0 and far.max() < 1e-8, f"max |diff| {far.max():.2e} over {far.shape[0]} states; "
              f"lambda1 {lam1:.6f}, |lambda2|/lambda1 {lam2 / lam1:.4f}", int(far.size))
    if k.initiative == "symmetric":
        d = abs(limit[0] - limit[1])
        checks.ok(f"{tag} Prop F (symmetric rule): the Yaglom limit is P(W | long roll) = P(L | long roll)",
                  d < 1e-12 and limit[2] < 1e-12, f"limit W {limit[0]:.15f}, L {limit[1]:.15f}, D {limit[2]:.1e}", 3)
    at = {}
    for h in HORIZONS:
        r = ratios[h][:, 0]
        r = r[np.isfinite(r)]
        at[h] = {"min": float(r.min()), "max": float(r.max()), "n": int(r.size)}
    return {"limit_W": float(limit[0]), "limit_L": float(limit[1]), "limit_D": float(limit[2]),
            "lambda1_per_ply": lam1, "lambda2_over_lambda1": lam2 / lam1, "ratio_W_at_H": at,
            "set_definition": f"{tag}; transient states reachable from standing (K.reach_t); ratio = P_s(I finish | "
                              "the roll outlasts H plies); ψ = left Perron vector of the ply operator M = (I+Q0)Q1"}


# --------------------------------------------------------------------------- #
# exit law: grouping, hub vectors
# --------------------------------------------------------------------------- #
def load_lexicon(path):
    """A flat {technique hub id: group} JSON, or gs-5's vocabulary format
    (techniques["<hub>/attacker"].body_region.class). Returns (dict, sha256)."""
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    if isinstance(data, dict) and isinstance(data.get("techniques"), dict):
        lex = {}
        for key, rec in data["techniques"].items():
            cls = ((rec or {}).get("body_region") or {}).get("class")
            if cls:
                lex[key[:-len("/attacker")] if key.endswith("/attacker") else key] = cls
    else:
        lex = {str(k): v for k, v in data.items()}
    require(lex, f"lexicon {path}: 0 technique -> group entries", JoinError)
    return lex, hashlib.sha256(raw).hexdigest()


def column_groups(fin_cols, meta, lexicon=None):
    """One (performer, group) per finisher column, JOINED BY TECHNIQUE ID. `meta` is K.fin_meta()."""
    pairs = tuple((m["technique"], m["performer"]) for m in meta)
    require(len(meta) == len(fin_cols) > 0 and pairs == tuple(fin_cols) and len(set(pairs)) == len(pairs),
            f"finisher metadata does not align with fin_cols by identity ({len(meta)} vs {len(fin_cols)})",
            JoinError)
    out, missing = [], []
    for m in meta:
        group = m["type"] if lexicon is None else lexicon.get(m["technique"])
        if not (isinstance(group, str) and group.strip()):
            missing.append(m["technique"])
            continue
        require(m["performer"] in ("me", "them"), f"unknown performer {m['performer']!r}", JoinError)
        out.append((m["performer"], group))
    if missing:
        raise JoinError(f"{len(missing)} finisher technique(s) have no group"
                        f"{' in the lexicon' if lexicon is not None else ' (raw type)'}: {sorted(set(missing))[:8]}")
    return tuple(out)


def group_exit(k, bf, columns, checks, tag):
    """Own `_absorbing.absorption_by_group` vs grouping the kernel's exit_law columns (two routes)."""
    got = own_call(tag, ab.absorption_by_group, k.Q, k.R_fin, columns, labels=k.labels)
    groups = tuple(sorted(set(columns)))
    where = {g: i for i, g in enumerate(got.groups)}
    require(set(where) == set(groups), "grouped output id set mismatch", JoinError)
    own = got.mass[:, [where[g] for g in groups]]
    ref = np.column_stack([bf[:, [i for i, c in enumerate(columns) if c == g]].sum(axis=1) for g in groups])
    checks.close(f"{tag} grouped exit law: own absorption_by_group vs kernel exit_law", own, ref)
    return groups, own


def hub_vectors(k, groups, grouped):
    """Seat-labelled hub vectors. For viewpoint seat σ, a `me` finish is a σ-finish and a `them`
    finish is a flip(σ)-finish; convert FIRST, then average the two viewpoint seats (½ each)."""
    kinds = sorted({kind for _p, kind in groups})
    at = {g: i for i, g in enumerate(groups)}
    columns = tuple((seat, kind) for seat in ("top", "bottom") for kind in kinds)
    seats = defaultdict(dict)
    for r, (h, role) in enumerate(zip(k.hub_of, k.role_of)):
        seats[h][role] = r
    out = {}
    for h in sorted(seats):
        require(set(seats[h]) == {"top", "bottom"}, f"hub {h} lacks a seat: {sorted(seats[h])}", JoinError)
        turns = {}
        for turn, off in (("M", 0), ("T", k.n_r)):
            v = np.zeros(len(columns))
            for my_seat in ("top", "bottom"):
                row = seats[h][my_seat] + off
                for j, (fin_seat, kind) in enumerate(columns):
                    if _MUTANT == "hub_no_seat_conversion":
                        performer = "me" if fin_seat == "top" else "them"
                    else:
                        performer = "me" if my_seat == fin_seat else "them"
                    src = at.get((performer, kind))
                    if src is not None:
                        v[j] += 0.5 * grouped[row, src]
            turns[turn] = v
        turns["coin"] = 0.5 * (turns["M"] + turns["T"])
        out[h] = turns
    return columns, out


# --------------------------------------------------------------------------- #
# Proposition C: the maximum principle, checked
# --------------------------------------------------------------------------- #
def max_principle(k, Q, R_fin, classes, H=None):
    """For each class (name -> finisher column indices): h = N R_C; core = {R_C > 0}. Verifies
    (C1) h_H = (I - Q_HH)^-1 Q_HK h_K, (C2) no halo state strictly above all successors j != t,
    (C3) h(t) <= P_t(hit core) * max reachable core value, and max_S h = max_K h. Returns a report."""
    n = Q.shape[0]
    Q = Q.tocsr()
    off = (Q - sparse.diags(Q.diagonal())).tocsr()
    off.eliminate_zeros()
    has = np.diff(off.indptr) > 0
    Rf = R_fin.tocsc()
    lu = splu(sparse.identity(n, format="csc") - Q.tocsc())
    A = sparse.identity(n, format="csr") - Q

    def succmax(v):
        out = np.full(n, -np.inf)
        if off.nnz:
            red = np.maximum.reduceat(v[off.indices], off.indptr[:-1][has])
            out[has] = red
        return out

    rep = {"classes": 0, "states_checked": 0, "halo_states_checked": 0, "violations": [],
           "core_strict_local_maxima": 0, "max_c1_residual": 0.0, "max_c3_slack_violation": 0.0,
           "per_class": {}}
    for name, cols in classes.items():
        cols = list(cols)
        rc = np.asarray(Rf[:, cols].sum(axis=1)).ravel()
        h = lu.solve(rc) if H is None else np.asarray(H[name], dtype=float)
        core = rc > 0
        halo = ~core
        rep["classes"] += 1
        rep["states_checked"] += n
        rep["halo_states_checked"] += int(halo.sum())
        sm = succmax(h)
        if not core.any():
            if np.max(np.abs(h)) > TOL:
                rep["violations"].append((name, "empty core but h != 0"))
            rep["per_class"][name] = {"core": 0, "max": float(h.max())}
            continue
        mk = float(h[core].max())
        if float(h.max()) > mk + TOL:
            rep["violations"].append((name, f"global max {h.max():.6g} above core max {mk:.6g}"))
        strict = halo & (h > sm + TOL) & (h > TOL)
        for t in np.flatnonzero(strict)[:5]:
            rep["violations"].append((name, f"halo strict local max at {lab(k, int(t)) if k else t}"))
        rep["core_strict_local_maxima"] += int((core & (h > sm + TOL)).sum())
        hi = np.flatnonzero(halo)
        ci = np.flatnonzero(core)
        if hi.size:
            QHH = Q[hi][:, hi].tocsc()
            QHK = Q[hi][:, ci]
            luh = splu(sparse.identity(hi.size, format="csc") - QHH)
            hh = luh.solve(np.asarray(QHK @ h[ci]).ravel())
            gg = luh.solve(np.asarray(QHK @ np.ones(ci.size)).ravel())
            rep["max_c1_residual"] = max(rep["max_c1_residual"], float(np.max(np.abs(hh - h[hi]))))
            if gg.max() > 1 + TOL or gg.min() < -TOL:
                rep["violations"].append((name, "hitting probability outside [0, 1]"))
            m = np.where(core, h, -np.inf)
            for _ in range(n + 1):
                nm = np.maximum(m, succmax(m))
                if np.array_equal(nm, m):
                    break
                m = nm
            reach = np.where(np.isfinite(m[hi]), m[hi], 0.0)
            slack = h[hi] - gg * reach
            rep["max_c3_slack_violation"] = max(rep["max_c3_slack_violation"], float(slack.max()))
        rep["per_class"][name] = {"core": int(core.sum()), "max": float(h.max()),
                                  "argmax": lab(k, int(np.argmax(h))) if k else int(np.argmax(h)),
                                  "max_halo": float(h[halo].max()) if halo.any() else None}
    res = float(np.max(np.abs(A @ lu.solve(np.asarray(Rf.sum(axis=1)).ravel())
                              - np.asarray(Rf.sum(axis=1)).ravel())))
    rep["lu_residual"] = res
    return rep


# --------------------------------------------------------------------------- #
# Proposition A: exact card attribution between two kernels
# --------------------------------------------------------------------------- #
def cell_keys(k):
    """Card key per cell: (src, category, technique, performer); optionless rows get a pseudo-card."""
    if getattr(k, "_s2_keys", None) is None:
        keys = []
        for c in k.cells:
            a = int(c["act"])
            if a < 0:
                keys.append((int(c["src"]), None, "<optionless hand: draw>", None))
            else:
                x = k.actions[a]
                keys.append((int(c["src"]), x["cat"], x["target"], x["performer"]))
        k._s2_keys = keys
    return k._s2_keys


def aligned_columns(k, universe):
    """Per-cell aligned absorbing column (identity join), -1 for transient cells."""
    at = {u: i for i, u in enumerate(universe)}
    c = k.cells
    out = np.full(len(c), -1, dtype=np.int64)
    coarse = tuple(universe) == ("W", "L", "D")
    for i, (d, f) in enumerate(zip(c["dst"].tolist(), c["fin"].tolist())):
        if d >= 0:
            continue
        if coarse:
            out[i] = -1 - d
        elif f >= 0:
            out[i] = at[k.fin_cols[f]]
        else:
            require(d == -1 - ID, f"{cid(k)}: a W/L cell carries no finisher column", JoinError)
            out[i] = at[("<draw>", None)]
    return out


def aligned_R(k, universe):
    col = aligned_columns(k, universe)
    c = k.cells
    m = col >= 0
    return sparse.csr_matrix((c["mass"][m], (c["src"][m], col[m])), shape=(k.n_t, len(universe)))


def card_values(k, keys, col, v_transient, g):
    """w(κ) = Σ_{cells of κ} mass · (v_transient[dst] or g[aligned column])."""
    c = k.cells
    val = np.where(c["dst"] >= 0, v_transient[np.maximum(c["dst"], 0)], g[np.maximum(col, 0)])
    contrib = c["mass"] * val
    w = defaultdict(float)
    for key, x in zip(keys, contrib.tolist()):
        w[key] += x
    return w


class Attribution:
    """Everything Proposition A needs for one kernel pair and one column universe."""

    def __init__(self, k0, k1, universe):
        require(k0.labels == k1.labels, f"label sets differ: {cid(k0)} vs {cid(k1)}", JoinError)
        self.k0, self.k1, self.U = k0, k1, tuple(universe)
        self.col0, self.col1 = aligned_columns(k0, self.U), aligned_columns(k1, self.U)
        self.R0, self.R1 = aligned_R(k0, self.U), aligned_R(k1, self.U)
        self.B0 = k0.fundamental().solve(self.R0.toarray())
        self.B1 = k1.fundamental().solve(self.R1.toarray())
        self.keys0, self.keys1 = cell_keys(k0), cell_keys(k1)

    def explain(self, g, x_rows):
        """For payoff g and adjoint rows x (one per query: x = N1^T e_s, or N1^T s0), return per
        query (delta, contributions dict key -> value) under form (A1), plus the (A2) contributions."""
        b0, b1 = self.B0 @ g, self.B1 @ g
        w0 = card_values(self.k0, self.keys0, self.col0, b0, g)
        w1 = card_values(self.k1, self.keys1, self.col1, b0, g)
        v0 = card_values(self.k0, self.keys0, self.col0, b1, g)
        v1 = card_values(self.k1, self.keys1, self.col1, b1, g)
        keys = sorted(set(w0) | set(w1), key=lambda z: (z[0], str(z[1]), z[2], str(z[3])))
        dw = np.array([w1.get(z, 0.0) - w0.get(z, 0.0) for z in keys])
        dv = np.array([v1.get(z, 0.0) - v0.get(z, 0.0) for z in keys])
        u = np.array([z[0] for z in keys], dtype=np.int64)
        delta_row = np.bincount(u, weights=dw, minlength=self.k0.n_t)
        if _MUTANT == "attribution_old_visits":
            total = self.k0.fundamental().solve(delta_row)
        else:
            total = self.k1.fundamental().solve(delta_row)
        total2 = self.k0.fundamental().solve(np.bincount(u, weights=dv, minlength=self.k0.n_t))
        out = []
        for x0, x1 in x_rows:
            out.append((keys, x1[u] * dw, x0[u] * dv))
        return b0, b1, total, total2, out


def adjoint(k, vec):
    """Row of N = (I - Q)^-1 weighted by `vec`: N^T vec (expected visits from the law `vec`)."""
    return k.fundamental().solve(np.asarray(vec, dtype=float), trans="T")


def unit(n, t):
    e = np.zeros(n)
    e[t] = 1.0
    return e


# --------------------------------------------------------------------------- #
# statistics helpers
# --------------------------------------------------------------------------- #
def correlation(x, y):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    require(x.shape == y.shape and x.size > 0, "correlation: empty or misaligned")
    keep = np.isfinite(x) & np.isfinite(y)
    n = int(keep.sum())
    require(n > 0, "correlation inspected no finite pairs")
    distinct = [int(np.unique(z[keep]).size) for z in (x, y)]
    val = None if n < 3 or min(distinct) < 2 else float(spearmanr(x[keep], y[keep]).statistic)
    return {"spearman": val, "n": n, "distinct_values": distinct,
            "undefined_reason": None if val is not None else "fewer than 3 pairs or a constant side"}


def coin(k, x):
    x = np.asarray(x, dtype=float)
    return 0.5 * (x[: k.n_r] + x[k.n_r:])


def decided(w, l):
    out = np.full(np.shape(w), np.nan)
    np.divide(w, w + l, out=out, where=(w + l) > 0)
    return out


def metadata(k):
    roles = {r for r, node in k.graph["positions"].items() if node.get("role") in ("top", "bottom")}
    require(roles == set(k.role_nodes), f"corpus vs kernel role-node id sets differ "
            f"({len(roles ^ set(k.role_nodes))} ids)", JoinError)
    out = {}
    for r in k.role_nodes:
        node = k.graph["positions"][r]
        f = {x: node.get(x) for x in ("positionType", "pointValue", "riskLevel", "strength")}
        require(f["positionType"] in POSITION_DIRECTION, f"unmapped positionType at {r}: {f}", JoinError)
        require(f["riskLevel"] in RISK_ORDER, f"unmapped riskLevel at {r}: {f}", JoinError)
        for x in ("pointValue", "strength"):
            require(isinstance(f[x], (int, float)) and np.isfinite(f[x]), f"missing {x} at {r}", JoinError)
        out[r] = f
    return out


# --------------------------------------------------------------------------- #
# the real-kernel Monte Carlo (an independent route: samples K.cells, no linear algebra)
# --------------------------------------------------------------------------- #
def mc_paths(k, start, n_paths=MC_PATHS, seed=MC_SEED, batch=20_000, horizons=HORIZONS):
    c = k.cells
    order = np.lexsort((np.arange(len(c)), c["src"]))
    cs = c[order]
    src, mass = cs["src"].astype(np.int64), cs["mass"]
    dst, pl = cs["dst"].astype(np.int64), cs["plies"].astype(np.int64)
    idx = np.arange(k.n_t)
    lo, hi = np.searchsorted(src, idx, "left"), np.searchsorted(src, idx, "right")
    require(np.all(hi > lo), f"{cid(k)}: a transient state has no cells")
    cum = np.cumsum(mass)
    base = cum[lo] - mass[lo]
    tot = cum[hi - 1] - base
    rng = np.random.default_rng(seed)
    seeds = np.flatnonzero(start > 0)
    p0 = start[seeds] / start[seeds].sum()
    S = SimpleNamespace(n=0, end=np.zeros(3, np.int64), vis=np.zeros(k.n_t), vis2=np.zeros(k.n_t),
                        cvis=np.zeros((3, k.n_t)), cvis2=np.zeros((3, k.n_t)),
                        hit=np.zeros(k.n_t, np.int64), chit=np.zeros((3, k.n_t), np.int64),
                        T=[], steps=[], within={h: np.zeros(3, np.int64) for h in horizons})
    for b0 in range(0, n_paths, batch):
        nb = min(batch, n_paths - b0)
        state = rng.choice(seeds, size=nb, p=p0)
        alive = np.arange(nb)
        ending = np.full(nb, -1)
        plies = np.zeros(nb, np.int64)
        steps = np.zeros(nb, np.int64)
        counts = np.zeros((nb, k.n_t), np.int32)
        it = 0
        while alive.size:
            it += 1
            require(it < 100_000, f"{cid(k)}: Monte Carlo path did not absorb in 100000 steps")
            st = state[alive]
            counts[alive, st] += 1
            u = rng.random(alive.size)
            ci = np.clip(np.searchsorted(cum, base[st] + u * tot[st], side="right"), lo[st], hi[st] - 1)
            d = dst[ci]
            plies[alive] += pl[ci]
            steps[alive] += 1
            done = d < 0
            ending[alive[done]] = -1 - d[done]
            state[alive[~done]] = d[~done]
            alive = alive[~done]
        S.n += nb
        for e in range(3):
            m = ending == e
            S.end[e] += int(m.sum())
            S.cvis[e] += counts[m].sum(axis=0)
            S.cvis2[e] += (counts[m].astype(np.int64) ** 2).sum(axis=0)
            S.chit[e] += (counts[m] > 0).sum(axis=0)
            for h in horizons:
                S.within[h][e] += int((m & (plies <= h)).sum())
        S.vis += counts.sum(axis=0)
        S.vis2 += (counts.astype(np.int64) ** 2).sum(axis=0)
        S.hit += (counts > 0).sum(axis=0)
        S.T.append(plies)
        S.steps.append(steps)
    S.T = np.concatenate(S.T).astype(float)
    S.steps = np.concatenate(S.steps).astype(float)
    return S


def mc_compare(k, S, start, b, steps, plies, visits, cvis, clock_cells, checks, tag):
    """z-scores of every exact quantity against the sample; family-wise Bonferroni limit."""
    n = S.n
    comps = []   # (name, estimate, exact, se)
    pz = start @ b
    for e, nm in enumerate(("W", "L", "D")):
        comps.append((f"P({nm})", S.end[e] / n, pz[e], np.sqrt(max(pz[e] * (1 - pz[e]), 0) / n)))
    for name, x, ex in (("E[plies]", S.T, start @ plies.mean), ("E[steps]", S.steps, start @ steps.mean)):
        comps.append((name, x.mean(), ex, x.std(ddof=1) / np.sqrt(n)))
    # Var[plies] of the MIXTURE over the start law: E[T^2] - E[T]^2 with per-start moments
    m2 = start @ (plies.variance + plies.mean ** 2)
    var_exact = m2 - (start @ plies.mean) ** 2
    cen = S.T - S.T.mean()
    s2 = cen.var(ddof=1)
    m4 = np.mean(cen ** 4)
    comps.append(("Var[plies]", s2, var_exact, np.sqrt(max(m4 - s2 * s2 * (n - 3) / (n - 1), 0) / n)))
    for h in HORIZONS:
        ex = start @ clock_cells[h]
        for e, nm in enumerate(("W", "L", "D")):
            comps.append((f"P({nm}, T<={h})", S.within[h][e] / n, ex[e], np.sqrt(max(ex[e] * (1 - ex[e]), 0) / n)))
        surv = 1 - ex.sum()
        comps.append((f"P(T>{h})", 1 - S.within[h].sum() / n, surv, np.sqrt(max(surv * (1 - surv), 0) / n)))
    # visits: a z-test where the sample is large enough for it (expected visiting paths >= 50), an
    # EXACT binomial test on the number of visiting paths below that. The exact hitting probability
    # of t from the start law is visits[t] / N[t,t] (N[t,t] = expected returns + 1); under the Doob
    # transform the diagonal of N is unchanged, so P(hit t | end e) = cvis_e[t] / N[t,t].
    I_Q = np.eye(k.n_t) - k.Q.toarray()
    N = np.linalg.inv(I_Q)
    require(np.abs(I_Q @ N - np.eye(k.n_t)).max() < 1e-10, f"{tag}: dense fundamental matrix residual")
    dN = np.diag(N)
    tests = []          # (name, observed paths, trials, exact probability)
    zero_exact_mismatch = well = rare = 0
    for t in range(k.n_t):
        for nm, vis_exact, tot, sq, hits, trials in (
                ("", visits[t], S.vis[t], S.vis2[t], S.hit[t], n),
                ("|W", cvis[0][t], S.cvis[0, t], S.cvis2[0, t], S.chit[0, t], S.end[0]),
                ("|L", cvis[1][t], S.cvis[1, t], S.cvis2[1, t], S.chit[1, t], S.end[1])):
            if vis_exact <= 1e-13:
                zero_exact_mismatch += int(tot != 0)
                continue
            h = min(vis_exact / dN[t], 1.0)
            if trials * h >= 50 and trials * (1 - h) >= 50:
                well += 1
                mean = tot / trials
                sd = np.sqrt(max(sq / trials - mean * mean, 0) * trials / (trials - 1))
                comps.append((f"visits{nm} {lab(k, t)}", mean, vis_exact, sd / np.sqrt(trials)))
                comps.append((f"P(hit{nm}) {lab(k, t)}", hits / trials, h, np.sqrt(h * (1 - h) / trials)))
            else:
                rare += 1
                tests.append((f"P(hit{nm}) {lab(k, t)} [exact binomial]", int(hits), int(trials), h))
    m = len(comps) + len(tests)
    zlim = float(norm.isf(MC_FAMILY_ALPHA / (2 * m)))
    worst, worst_name, bad = 0.0, "", 0
    for name, est, ex, se in comps:
        z = abs(est - ex) / se if se > 0 else (0.0 if abs(est - ex) < 1e-12 else np.inf)
        if z > worst:
            worst, worst_name = float(z), name
        bad += int(z > zlim)
    pmin, pmin_name = 1.0, ""
    for name, kk, nn, h in tests:
        pv = min(1.0, 2 * min(binom.cdf(kk, nn, h), binom.sf(kk - 1, nn, h)))
        if pv < pmin:
            pmin, pmin_name = float(pv), name
        bad += int(pv < MC_FAMILY_ALPHA / m)
    checks.ok(f"{tag} Monte Carlo ({n} paths, seed {MC_SEED}) vs exact: {m} quantities",
              bad == 0 and zero_exact_mismatch == 0 and m > 100 and well > 100,
              f"worst |z| {worst:.3f} ({worst_name}); family-wise z limit {zlim:.3f} (alpha {MC_FAMILY_ALPHA}); "
              f"{len(tests)} exact binomial tests, smallest p {pmin:.3g} ({pmin_name}) vs {MC_FAMILY_ALPHA / m:.2g}; "
              f"well-sampled state rows {well}, rare {rare}; zero-exact states sampled non-zero: {zero_exact_mismatch}", m)
    return {"paths": n, "seed": MC_SEED, "quantities": m, "worst_abs_z": worst, "worst_quantity": worst_name,
            "z_limit_familywise": zlim, "family_alpha": MC_FAMILY_ALPHA, "exceeding_limit": bad,
            "exact_binomial_tests": len(tests), "smallest_binomial_p": pmin, "smallest_binomial_p_quantity": pmin_name,
            "well_sampled_state_rows": well, "rare_state_rows": rare,
            "ending_counts": {"W": int(S.end[0]), "L": int(S.end[1]), "D": int(S.end[2])},
            "estimates": {nm: float(est) for nm, est, _e, _s in comps if "@" not in nm}}


# --------------------------------------------------------------------------- #
# one configuration, end to end
# --------------------------------------------------------------------------- #
def analyse(k, checks, lexicon=None, full=True, mc=False):
    tag = cid(k)
    require(k.n_r >= 100 and k.n_t == 2 * k.n_r, f"{tag}: state coverage below floor")
    res = SimpleNamespace(k=k, tag=tag, validation={}, coverage=dict(k.coverage))
    plies_spec, res.coverage["durations"] = build_plies(k)
    checks.ok(f"{tag} durations unique per (src,dst) edge and per absorbing source",
              res.coverage["durations"]["duration_conflicts"] == 0,
              str(res.coverage["durations"]), res.coverage["durations"]["edges_checked"])
    zc = k.cells[(k.cells["dst"] >= 0) & (k.cells["plies"] == 0)]
    checks.ok(f"{tag} every 0-ply cell maps (r,M) -> (r,T)", bool(np.all((zc["src"] < k.n_r)
              & (zc["dst"] == k.n_r + zc["src"]))) and (k.initiative == "symmetric") == (len(zc) == 0),
              f"{len(zc)} zero-ply cells", len(k.cells))
    # -- committor, two routes
    com = own_call(tag, ab.committor, k.Q, k.R, IW, IL, ID, labels=k.labels)
    res.b = np.column_stack([com.q_W, com.q_L, com.q_D])
    res.q_plus = com.q_plus
    B, bres = k.absorption()
    res.validation["absorption_two_route"] = checks.close(f"{tag} committor: own LU vs K.absorption()", res.b, B)
    res.validation["kernel_absorption_residual"] = bres
    # -- clock: kernel recursion vs cell propagation; Proposition B via the M operator
    cc = cell_clock(k)
    res.clock_cells = cc
    res.per_h = {}
    for h in HORIZONS:
        w, l = k.finite_horizon(h)
        res.validation[f"clock_two_route_H{h}"] = checks.close(
            f"{tag} H={h}: K.finite_horizon vs cell propagation", np.column_stack([w, l]), cc[h][:, :2])
        res.per_h[h] = np.column_stack([w, l])
    M = m_operator(k)
    Y, one = res.b.copy(), np.ones(k.n_t)
    res.surv = {}
    worst_b2 = worst_b3 = worst_b4 = 0.0
    for h in range(1, max(HORIZONS) + 1):
        Y, one = M @ Y, M @ one
        if h in HORIZONS:
            gap = res.b - cc[h]
            surv = 1.0 - cc[h].sum(axis=1)
            res.surv[h] = surv
            worst_b2 = max(worst_b2, float(np.abs(gap - Y).max()))
            worst_b3 = max(worst_b3, float(np.abs(surv - one).max()))
            worst_b4 = max(worst_b4, float(max(-gap.min(), (gap - surv[:, None]).max(),
                                               np.abs(gap.sum(axis=1) - surv).max())))
    checks.ok(f"{tag} Prop B2: q - V_H == M^H q (all 3 columns, H in 9..12)", worst_b2 < 1e-12,
              f"max |diff| {worst_b2:.2e}", 3 * k.n_t * len(HORIZONS))
    checks.ok(f"{tag} Prop B3: P(T>H) from cells == M^H 1", worst_b3 < 1e-12, f"max |diff| {worst_b3:.2e}",
              k.n_t * len(HORIZONS))
    checks.ok(f"{tag} Prop B4: 0 <= q - V_H <= P(T>H), columns sum to P(T>H)", worst_b4 < 1e-12,
              f"max violation {worst_b4:.2e}", 3 * k.n_t * len(HORIZONS))
    res.validation.update({"prop_B2": worst_b2, "prop_B3": worst_b3, "prop_B4": worst_b4})
    res.yaglom = yaglom(k, M, res.b, checks, tag)
    res.clock = np.mean([cc[h] for h in HORIZONS], axis=0)          # W, L, optionless D within the clock
    res.clock_timeout = np.mean([res.surv[h] for h in HORIZONS], axis=0)   # S̄
    res.clock_plus = decided(res.clock[:, 0], res.clock[:, 1])
    dec = res.b[:, 0] + res.b[:, 1]
    ok_rows = np.isfinite(res.clock_plus) & (dec > 0)
    cut = np.zeros(k.n_t)
    np.divide(dec - res.clock[:, 0] - res.clock[:, 1], dec, out=cut, where=dec > 0)
    viol = float(np.max(np.abs(res.clock_plus - res.q_plus)[ok_rows] - cut[ok_rows]))
    res.validation["cor_Bpp_decided_bound_violation"] = viol
    checks.ok(f"{tag} Cor. B'': |clocked q+ - q+| <= P(T > H, decided) / P(decided)", viol < 1e-12,
              f"max (|Δq+| - bound) {viol:.2e}", int(ok_rows.sum()))
    Vw, Vl = k.finite_horizon(4000)
    res.validation["H4000_vs_absorption"] = checks.close(f"{tag} finite_horizon(4000) -> absorption",
                                                         np.column_stack([Vw, Vl]), res.b[:, :2], 1e-9)
    # -- tempo: steps and plies, own vs cell moments; plies mean also by N(1 - Q0 1)
    unit = plies_spec.transient.copy()
    unit.data[:] = 1.0
    res.steps = own_call(tag, ab.expected_time, k.Q, ab.Plies(unit, np.ones(k.n_t)), labels=k.labels)
    res.plies = own_call(tag, ab.expected_time, k.Q, plies_spec, labels=k.labels)
    for name, own, dur in (("steps", res.steps, np.ones(len(k.cells))), ("plies", res.plies, k.cells["plies"])):
        m, v = cell_moments(k, dur)
        res.validation[f"{name}_mean_two_route"] = checks.close(f"{tag} E[{name}]: own vs cell moments", own.mean, m, 1e-9)
        res.validation[f"{name}_var_two_route"] = checks.close(f"{tag} Var[{name}]: own vs cell moments",
                                                               own.variance, v, 1e-7)
    ep = lu_solve(k, 1.0 - np.asarray(k.Q0.sum(axis=1)).ravel(), "plies via N(1 - Q0 1)")
    res.validation["plies_mean_third_route"] = checks.close(f"{tag} E[plies]: own vs N(1 - Q0 1)", res.plies.mean, ep, 1e-9)
    # -- exit law, grouped; hub vectors
    res.Bf, fres = k.exit_law()
    res.validation["kernel_exit_law_residual"] = fres
    by_me = np.array([p == "me" for _t, p in k.fin_cols])
    res.validation["exit_law_to_WL"] = checks.close(f"{tag} exit_law performer totals == q_W, q_L",
                                                    np.column_stack([res.Bf[:, by_me].sum(1), res.Bf[:, ~by_me].sum(1)]),
                                                    res.b[:, :2])
    res.meta = k.fin_meta()
    res.columns = column_groups(k.fin_cols, res.meta, lexicon)
    res.groups, res.grouped = group_exit(k, res.Bf, res.columns, checks, tag)
    res.hub_columns, res.hubs = hub_vectors(k, res.groups, res.grouped)
    for turn, off in (("M", 0), ("T", k.n_r)):
        tot = np.array([res.hubs[h][turn].sum() for h in k.hubs])
        exp = np.array([0.5 * sum(1.0 - res.b[k.index[f"{h}/{s}"] + off, 2] for s in ("top", "bottom")) for h in k.hubs])
        checks.close(f"{tag} hub vector totals ({turn}) == mean decided mass of the two seats", tot, exp)
    if k.initiative == "symmetric":
        d = max(float(np.abs(res.hubs[h]["M"] - res.hubs[h]["T"]).max()) for h in k.hubs)
        res.validation["prop_E_turn_free_hub_vectors"] = d
        checks.ok(f"{tag} Prop E: seat-labelled hub vectors are turn-free", d < 1e-12, f"max |M - T| {d:.2e}",
                  len(k.hubs) * len(res.hub_columns))
        qb, db = coin(k, res.b[:, 0]), coin(k, res.b[:, 2])
        d = float(np.abs(qb + qb[k.flipidx] - (1 - db)).max())
        res.validation["prop_D_seat_complement"] = d
        checks.ok(f"{tag} Prop D: q̄(r) + q̄(flip r) == 1 - D̄(r)", d < 1e-12, f"max |diff| {d:.2e}", k.n_r)
    # -- occupancy from standing and from anywhere, me first
    res.occ = {}
    for where in ("standing", "anywhere"):
        s0 = k.start(where, "me")
        vis = own_call(tag, ab.occupancy, k.Q, s0, labels=k.labels)
        ref = lu_solve(k, s0, f"occupancy {where}", transpose=True)
        res.validation[f"occupancy_{where}_two_route"] = checks.close(f"{tag} occupancy from {where}: own vs kernel LU", vis, ref)
        checks.close(f"{tag} occupancy from {where}: visits sum == E[steps]", vis.sum(), s0 @ res.steps.mean, 1e-9)
        cond = []
        for col in (IW, IL):
            own = own_call(tag, ab.conditional_occupancy, k.Q, k.R, s0, col, labels=k.labels)
            refc = ref * B[:, col] / (s0 @ B[:, col])
            res.validation[f"cond_occupancy_{where}_{col}"] = checks.close(
                f"{tag} occupancy from {where} given {'WL'[col]}: Doob vs Bayes identity", own, refc)
            cond.append(own)
        res.occ[where] = SimpleNamespace(s0=s0, visits=vis, cond=cond)
    res.authored = metadata(k)
    if full:
        classes = {f"{p}|{kind}": [i for i, c in enumerate(res.columns) if c == (p, kind)] for p, kind in res.groups}
        classes.update({f"col|{t}|{p}": [i] for i, (t, p) in enumerate(k.fin_cols)})
        rep = max_principle(k, k.Q, k.R_fin, classes)
        res.maxp = rep
        checks.ok(f"{tag} Prop C (maximum principle) over {rep['classes']} exit classes",
                  not rep["violations"] and rep["max_c1_residual"] < 1e-12 and rep["max_c3_slack_violation"] < 1e-12,
                  f"halo states checked {rep['halo_states_checked']}; violations {rep['violations'][:3]}; "
                  f"C1 residual {rep['max_c1_residual']:.2e}; C3 slack {rep['max_c3_slack_violation']:.2e}",
                  rep["states_checked"])
    if mc:
        S = mc_paths(k, res.occ["standing"].s0)
        res.mc = mc_compare(k, S, res.occ["standing"].s0, res.b, res.steps, res.plies, res.occ["standing"].visits,
                            res.occ["standing"].cond, cc, checks, tag)
    return res


# --------------------------------------------------------------------------- #
# perturbation ensembles (ruling 1)
# --------------------------------------------------------------------------- #
def ensemble(k, seeds=SEEDS, eps=EPS):
    out = np.empty((len(seeds), k.n_t, 3))
    worst = 0.0
    for i, s in enumerate(seeds):
        p = k.perturbed(eps, eps, seed=s)
        A = sparse.identity(k.n_t, format="csc") - p["Q"].tocsc()
        R = p["R"].toarray()
        B = splu(A).solve(R)
        worst = max(worst, float(np.abs(A @ B - R).max()), float(np.abs(B.sum(1) - 1).max()))
        out[i] = B
    return out, worst


# --------------------------------------------------------------------------- #
# coherence with the corpus's own labels
# --------------------------------------------------------------------------- #
def seat_stats(k, b):
    qb = coin(k, b[:, 0])
    return qb, qb - qb[k.flipidx]


def disagrees(k, b, direction, test):
    qb, A = seat_stats(k, b)
    if test == "threshold":
        return ((direction > 0) & (qb < 0.5 - 1e-12)) | ((direction < 0) & (qb > 0.5 + 1e-12))
    return direction * A < -1e-12


def coherence(res, ens=None, others=None, ens_residual=None):
    k, b = res.k, res.b
    n_r = k.n_r
    auth = res.authored
    direction = np.array([POSITION_DIRECTION[auth[r]["positionType"]] for r in k.role_nodes])
    qb, A = seat_stats(k, b)
    qM, qT = b[:n_r, 0], b[n_r:, 0]
    cq = coin(k, res.clock[:, 0])
    test = "threshold" if k.initiative == "symmetric" else "seat"
    out = {"primary_test": test,
           "tests": {"threshold": "Offensive* with q̄ < ½, or Defensive* with q̄ > ½ (q̄ = turn-neutral P(I finish), H = ∞)",
                     "seat": "label direction d and seat advantage A = q̄(r) − q̄(flip r) disagree in sign (rule-agnostic)"}}
    for scope in ("live", "reachable_live"):
        idx = np.array([r for r, s in enumerate(k.role_nodes)
                        if s in k.live and (scope == "live" or s in k.reachable)])
        require(idx.size > 0, f"{res.tag}: empty coherence cohort {scope}", JoinError)
        rows = [auth[k.role_nodes[r]] for r in idx]
        feats = {"positionType_direction": direction[idx],
                 "pointValue": np.array([x["pointValue"] for x in rows], float),
                 "riskLevel_ordered": np.array([RISK_ORDER[x["riskLevel"]] for x in rows]),
                 "riskLevel_strength_penalty": np.array([risk_penalty(x["riskLevel"]) for x in rows]),
                 "strength": np.array([x["strength"] for x in rows], float)}
        cors = {f: {"q_bar": correlation(v, qb[idx]), "q_my_turn": correlation(v, qM[idx]),
                    "q_their_turn": correlation(v, qT[idx]), "seat_advantage": correlation(v, A[idx]),
                    "clocked_q_bar": correlation(v, cq[idx])} for f, v in feats.items()}
        within = {}
        for nm, sel in (("offensive_labels", direction[idx] > 0), ("defensive_labels", direction[idx] < 0)):
            within[nm] = correlation(feats["strength"][sel], qb[idx][sel]) if sel.sum() else None
        means = {}
        for label in sorted({x["positionType"] for x in rows}):
            sel = idx[[x["positionType"] == label for x in rows]]
            means[label] = {"n": int(sel.size), "mean_q_bar": float(qb[sel].mean()), "min_q_bar": float(qb[sel].min()),
                            "max_q_bar": float(qb[sel].max()), "mean_seat_advantage": float(A[sel].mean()),
                            "mean_clocked_q_bar": float(cq[sel].mean())}
        flags = {t: disagrees(k, b, direction, t) for t in ("threshold", "seat")}
        directional = idx[direction[idx] != 0]
        dis = [int(r) for r in directional if flags[test][r]]
        out[scope] = {"n_role_nodes": int(idx.size), "n_directional": int(directional.size),
                      "correlations": cors, "strength_within_label_direction": within, "by_positionType": means,
                      "disagreements_threshold": int(flags["threshold"][directional].sum()),
                      "disagreements_seat": int(flags["seat"][directional].sum()),
                      "agreement_fraction_primary": 1.0 - len(dis) / directional.size,
                      "set_definition": f"{res.tag}; role-nodes in K.live{' ∩ K.reachable' if scope != 'live' else ''}; "
                                        f"q̄ = ½[q_W(r,M) + q_W(r,T)] at H = ∞; the corpus's game"}
        if scope == "live":
            out["_dis"] = dis
            out["_flags"] = flags
    # label pairs that no committor can satisfy (Proposition D ii)
    same = []
    for r, s in enumerate(k.role_nodes):
        f = int(k.flipidx[r])
        if k.role_of[r] == "top" and direction[r] != 0 and direction[r] == direction[f]:
            both = bool(out["_flags"]["seat"][r] or out["_flags"]["seat"][f] or abs(A[r]) < 1e-12)
            same.append({"position": k.hub_of[r], "labels": [auth[s]["positionType"], auth[k.role_nodes[f]]["positionType"]],
                         "seat_advantage_top": float(A[r]), "at_least_one_seat_disagrees": both})
    out["same_direction_label_pairs"] = same
    held_all = (np.array([disagrees(k, eb, direction, test) for eb in ens]) if ens is not None else None)
    rows = []
    for r in out.pop("_dis"):
        s = k.role_nodes[r]
        row = {"role_node": s, "hub": k.hub_of[r], **auth[s], "q_bar": float(qb[r]), "q_my_turn": float(qM[r]),
               "q_their_turn": float(qT[r]), "seat_advantage": float(A[r]), "clocked_q_bar": float(cq[r]),
               "reachable": s in k.reachable, "threshold_flag": bool(out["_flags"]["threshold"][r]),
               "seat_flag": bool(out["_flags"]["seat"][r]), "recompute": recompute((k.frame, k.initiative, k.rates, k.origin), s)}
        row["robustness"] = {}
        if ens is not None:
            row["robustness"]["perturbation_fraction_holding"] = float(held_all[:, r].mean())
        for nm, (other_b, other_k) in (others or {}).items():
            t2 = "threshold" if other_k.initiative == "symmetric" else "seat"
            row["robustness"][nm] = bool(disagrees(other_k, other_b, direction, t2)[r])
        rows.append(row)
    rows.sort(key=lambda x: (-abs(x["q_bar"] - 0.5), x["role_node"]))
    out["disagreements"] = rows
    out.pop("_flags")
    if ens is not None:
        out["robustness_summary"] = robust_summary(rows, ens_residual)
    return out


def robust_summary(rows, ens_residual):
    fr = [r["robustness"]["perturbation_fraction_holding"] for r in rows]
    if not rows:
        return {"n": 0, "ensemble_max_residual": ens_residual}
    four = [r for r in rows if r["robustness"]["perturbation_fraction_holding"] >= 0.95
            and all(r["robustness"].get(x, False) for x in ("origin_off", "other_rule", "other_frame"))]
    return {"n": len(rows), "perturbation": f"K.perturbed({EPS}, {EPS}, seed), seeds {SEEDS[0]}..{SEEDS[-1]} ({len(SEEDS)})",
            "holding_in_>=95%_of_seeds": sum(f >= 0.95 for f in fr),
            "holding_in_<=5%_of_seeds": sum(f <= 0.05 for f in fr),
            "in_between": sum(0.05 < f < 0.95 for f in fr),
            "robust_on_all_four_facts": len(four), "robust_on_all_four_facts_role_nodes": [r["role_node"] for r in four],
            "ensemble_max_residual": ens_residual}


# --------------------------------------------------------------------------- #
# clock, tempo, occupancy summaries
# --------------------------------------------------------------------------- #
def t_cohort(k, scope, turn):
    return np.array([t for t, (s, side) in enumerate(k.labels) if s in k.live
                     and (turn == "both" or side == turn) and (scope == "live" or k.reach_t[t])])


def srow(k, t, **v):
    s, turn = k.labels[t]
    return {"role_node": s, "turn": turn, **v}


def clock_summary(res):
    k, b = res.k, res.b
    out = {"yaglom_prop_F": res.yaglom}
    for scope in ("live", "reachable_live"):
        out[scope] = {}
        for turn in ("M", "T", "both"):
            idx = t_cohort(k, scope, turn)
            gap = b[idx, 0] - res.clock[idx, 0]
            bound = res.clock_timeout[idx]
            dq = res.clock_plus - res.q_plus
            cut = np.full(k.n_t, np.nan)
            np.divide(b[:, 0] + b[:, 1] - res.clock[:, 0] - res.clock[:, 1], b[:, 0] + b[:, 1], out=cut,
                      where=(b[:, 0] + b[:, 1]) > 0)
            dqs = np.where(np.isfinite(dq), np.abs(dq), -1.0)
            flips = [t for t in idx if (res.clock_plus[t] - 0.5) * (res.q_plus[t] - 0.5) < -1e-12]
            moved = sorted(idx, key=lambda t: (-dqs[t], k.labels[t]))[:TOP]
            # pairs whose clocked order is CERTIFIED by the bound alone (Corollary B')
            q, lo = b[idx, 0], b[idx, 0] - bound
            order = q[:, None] > q[None, :] + 1e-15
            cert = (lo[:, None] > q[None, :]) & order
            lists = scope == "reachable_live" and turn == "both"
            out[scope][turn] = {
                "n": int(idx.size), "clocked_q_plus_undefined": int(np.isnan(res.clock_plus[idx]).sum()),
                "spearman_q_W_vs_clocked": correlation(b[idx, 0], res.clock[idx, 0]),
                "spearman_q_plus_vs_clocked_plus": correlation(res.q_plus[idx], res.clock_plus[idx]),
                "gap_W_max": float(gap.max()), "gap_W_mean": float(gap.mean()),
                "bound_S_bar_max": float(bound.max()), "bound_S_bar_mean": float(bound.mean()),
                "gap_over_bound_max": float(np.max(gap / np.maximum(bound, 1e-300))),
                "gap_over_bound_min": float(np.min(gap / np.maximum(bound, 1e-300))),
                "gap_over_bound_mean": float(np.mean(gap / np.maximum(bound, 1e-300))),
                "ordered_pairs": int(order.sum()), "ordered_pairs_certified_by_bound": int(cert.sum()),
                "mean_clock_timeout": float(bound.mean()), "mean_optionless_draw_in_clock": float(res.clock[idx, 2].mean()),
                "favourite_flips_n": len(flips),
                "favourite_flips": [srow(k, t, q_plus=res.q_plus[t], clocked_q_plus=res.clock_plus[t])
                                    for t in sorted(flips, key=lambda t: (-dqs[t], k.labels[t]))[:TOP]] if lists else None,
                "largest_decided_verdict_changes": [
                    srow(k, t, q_plus=res.q_plus[t], clocked_q_plus=res.clock_plus[t], delta=dq[t],
                         cor_Bpp_bound=cut[t], q_W=b[t, 0], clocked_q_W=res.clock[t, 0], S_bar=res.clock_timeout[t])
                    for t in moved] if lists else None}
    return out


def tempo_summary(res):
    k = res.k
    out = {}
    for turn in ("M", "T"):
        idx = t_cohort(k, "reachable_live", turn)
        row = lambda t: srow(k, t, E_plies=res.plies.mean[t], SD_plies=np.sqrt(res.plies.variance[t]),
                             E_steps=res.steps.mean[t], SD_steps=np.sqrt(res.steps.variance[t]), q_W=res.b[t, 0])
        out[turn] = {"n": int(idx.size),
                     "hot_smallest_E_plies": [row(t) for t in sorted(idx, key=lambda t: (res.plies.mean[t], k.labels[t]))[:10]],
                     "cold_largest_E_plies": [row(t) for t in sorted(idx, key=lambda t: (-res.plies.mean[t], k.labels[t]))[:10]],
                     "spearman_E_plies_vs_q_W": correlation(res.plies.mean[idx], res.b[idx, 0]),
                     "median_E_plies": float(np.median(res.plies.mean[idx]))}
    return out


def occupancy_summary(res):
    k = res.k
    out = {}
    for where, o in res.occ.items():
        v = o.visits
        sw, sl = o.cond[0] / o.cond[0].sum(), o.cond[1] / o.cond[1].sum()
        d = sw - sl
        idx = np.flatnonzero(v > 1e-12)
        row = lambda t: srow(k, t, visits=v[t], visits_given_W=o.cond[0][t], visits_given_L=o.cond[1][t],
                             share_W=sw[t], share_L=sl[t], share_diff=d[t])
        rn = defaultdict(lambda: np.zeros(3))
        for t in range(k.n_t):
            rn[k.role_nodes[t % k.n_r]] += (sw[t], sl[t], v[t])
        rns = sorted(rn.items(), key=lambda x: (-(x[1][0] - x[1][1]), x[0]))
        out[where] = {
            "start": f"K.start({where!r}, 'me')", "P_W": float(o.s0 @ res.b[:, 0]), "E_steps": float(v.sum()),
            "visits_given_W_sum": float(o.cond[0].sum()), "visits_given_L_sum": float(o.cond[1].sum()),
            "where_wins_pass_through": [row(t) for t in sorted(idx, key=lambda t: (-d[t], k.labels[t]))[:12]],
            "where_losses_pass_through": [row(t) for t in sorted(idx, key=lambda t: (d[t], k.labels[t]))[:12]],
            "most_visited": [row(t) for t in sorted(idx, key=lambda t: (-v[t], k.labels[t]))[:8]],
            "role_nodes_by_share_diff (both turns; a hub total cancels the two seats, so none is given)": [
                {"role_node": h, "share_W": x[0], "share_L": x[1], "share_diff": x[0] - x[1], "visits": x[2]}
                for h, x in rns[:8] + rns[-8:]]}
    return out


def headline_rows(res):
    k = res.k
    rows = []
    for where in ("standing", "anywhere"):
        s0 = res.occ[where].s0
        pw, pl, pd = s0 @ res.b
        c = s0 @ res.clock
        rows.append({"configuration": res.tag, "start": f"{where}, me first", "P_I_finish": pw, "P_they_finish": pl,
                     "P_draw": pd, "P_I_finish_given_decided": pw / (pw + pl),
                     "clocked_P_I_finish": c[0], "clocked_P_they_finish": c[1], "clocked_optionless_draw": c[2],
                     "clocked_timeout_S_bar": float(s0 @ res.clock_timeout),
                     "clock_bound_gap_W": pw - c[0], "E_steps": s0 @ res.steps.mean,
                     "SD_steps": float(np.sqrt(s0 @ (res.steps.variance + res.steps.mean ** 2) - (s0 @ res.steps.mean) ** 2)),
                     "E_plies": s0 @ res.plies.mean,
                     "SD_plies": float(np.sqrt(s0 @ (res.plies.variance + res.plies.mean ** 2) - (s0 @ res.plies.mean) ** 2)),
                     "recompute": recompute()})
    return rows


def exit_summary(res, hubs_too):
    k = res.k
    s0 = res.occ["standing"].s0
    stand = s0 @ res.grouped
    out = {"groups": [f"{p}|{kind}" for p, kind in res.groups],
           "from_standing_me_first": {f"{p}|{kind}": float(x) for (p, kind), x in zip(res.groups, stand) if x > 5e-7},
           "set_definition": f"{res.tag}; exit law = K.exit_law() grouped by (performer, raw submission type); "
                             "hub rows: finisher SEAT|type, me/them converted to top/bottom BEFORE averaging the two "
                             "viewpoint seats, turn mixture `coin` = ½(M + T) (turn-free under the symmetric rule, Prop E); "
                             "6 significant digits (full precision: --full)"}
    if hubs_too:
        out["hub_columns"] = [f"{seat}|{kind}" for seat, kind in res.hub_columns]
        out["hubs_coin"] = {h: r6(res.hubs[h]["coin"]) for h in k.hubs}
    return out


# --------------------------------------------------------------------------- #
# frames: gi vs nogi, and frame-correct gi rates vs the folded scalar
# --------------------------------------------------------------------------- #
def listing(k, role_node, target):
    for t in k.graph["positions"][role_node].get("transitions") or []:
        if t["target"] == target:
            return t.get("attemptProbabilityByRuleset")
    return "not listed"


def card_info(k0, k1, key):
    info = {"state": lab(k0, key[0]), "category": key[1], "technique": key[2], "performer": key[3]}
    for nm, k in (("old", k0), ("new", k1)):
        if getattr(k, "_s2_act_index", None) is None:
            k._s2_act_index = defaultdict(list)
            for a in k.actions:
                k._s2_act_index[(a["t"], a["cat"], a["target"], a["performer"])].append(a)
        acts = k._s2_act_index.get(key, [])
        info[f"{nm}_dealt"] = len(acts)
        info[f"{nm}_pi"] = sum(a["pi"] for a in acts) if acts else None
        info[f"{nm}_p"] = acts[0]["p"] if acts else None
        if acts:
            info["actor_role_node"] = acts[0]["role_node"]
            info["name"] = acts[0]["name"]
    if key[1] is not None and "actor_role_node" in info:
        tech = k0.graph[key[1]].get(key[2] + "/attacker") or {}
        info["authored_attempt_by_ruleset"] = listing(k0, info["actor_role_node"], key[2])
        info["authored_success_rate_by_ruleset"] = tech.get("successRateByRuleset")
        info["folded_success_rate"] = tech.get("successRate")
    why = []
    if not info["old_dealt"] or not info["new_dealt"]:
        why.append("dealt only in the " + ("new" if info["new_dealt"] else "old") + " kernel")
    else:
        if abs(info["new_pi"] - info["old_pi"]) > 1e-12:
            why.append(f"attempt share {info['old_pi']:.4f} -> {info['new_pi']:.4f}")
        if abs(info["new_p"] - info["old_p"]) > 1e-12:
            why.append(f"success rate {info['old_p']:.4f} -> {info['new_p']:.4f}")
    info["reason"] = "; ".join(why) or "same card, same numbers: its one-step value is unchanged (0 contribution)"
    return info


def compare(r0, r1, name, checks):
    """Δ = new − old. r0 = old kernel's analysis, r1 = new."""
    k0, k1 = r0.k, r1.k
    require(k0.labels == k1.labels, f"{name}: labels differ", JoinError)
    both = np.array([t for t in range(k0.n_t) if k0.labels[t][0] in k0.live and k0.labels[t][0] in k1.live])
    coarse = Attribution(k0, k1, ("W", "L", "D"))
    checks.close(f"{name} aligned coarse R == K.R (both kernels)", np.hstack([coarse.R0.toarray(), coarse.R1.toarray()]),
                 np.hstack([k0.R.toarray(), k1.R.toarray()]), 1e-15)
    U = tuple(sorted(set(k0.fin_cols) | set(k1.fin_cols))) + (("<draw>", None),)
    fine = Attribution(k0, k1, U)
    F0 = fine.B0
    F1 = fine.B1
    me = [i for i, u in enumerate(U[:-1]) if u[1] == "me"]
    checks.close(f"{name} identity-joined fine exit law: rows sum to 1, `me` columns sum to q_W (both kernels)",
                 np.concatenate([F0.sum(1), F1.sum(1), F0[:, me].sum(1), F1[:, me].sum(1)]),
                 np.concatenate([np.ones(k0.n_t), np.ones(k1.n_t), r0.b[:, 0], r1.b[:, 0]]))
    dq = r1.b[:, 0] - r0.b[:, 0]
    tv = 0.5 * np.abs(F1 - F0).sum(axis=1)
    g = np.array([1.0, 0.0, 0.0])
    s_std = k0.start("standing", "me")
    queries = sorted(both, key=lambda t: (-abs(dq[t]), k0.labels[t]))[:TOP if "nogi" in r0.tag else 10]
    rows_x = [(adjoint(k0, unit(k0.n_t, t)), adjoint(k1, unit(k0.n_t, t))) for t in queries]
    rows_x.append((adjoint(k0, s_std), adjoint(k1, s_std)))
    b0, b1, total, total2, parts = coarse.explain(g, rows_x)
    e1 = checks.close(f"{name} Prop A1: N1[(R1-R0)g + (Q1-Q0)b0] == b1 - b0 (all states)", total, b1 - b0)
    e2 = checks.close(f"{name} Prop A2: N0[(R1-R0)g + (Q1-Q0)b1] == b1 - b0 (all states)", total2, b1 - b0)
    targets = [dq[t] for t in queries] + [s_std @ (b1 - b0)]
    worst = max(abs(p[1].sum() - tg) for p, tg in zip(parts, targets))
    worst2 = max(abs(p[2].sum() - tg) for p, tg in zip(parts, targets))
    checks.ok(f"{name} card contributions sum to Δq exactly (A1 and A2), {len(parts)} queries",
              worst < 1e-12 and worst2 < 1e-12, f"max |Σ - Δ| A1 {worst:.2e}, A2 {worst2:.2e}", len(parts))

    def explain_rows(qs, parts_, deltas, what):
        out = []
        for t, (keys, c1, c2), dl in zip(qs, parts_, deltas):
            order = sorted(range(len(keys)), key=lambda i: (-abs(c1[i]), i))
            top = order[:3]
            own = sum(c1[i] for i in range(len(keys)) if keys[i][0] == t) if isinstance(t, (int, np.integer)) else None
            lead2 = max(range(len(keys)), key=lambda i: (abs(c2[i]), -i)) if keys else None
            out.append({"query": lab(k0, int(t)) if isinstance(t, (int, np.integer)) else t, what: dl,
                        "q_old": float(r0.b[t, 0]) if isinstance(t, (int, np.integer)) else float(s_std @ r0.b[:, 0]),
                        "q_new": float(r1.b[t, 0]) if isinstance(t, (int, np.integer)) else float(s_std @ r1.b[:, 0]),
                        "cards": [{**card_info(k0, k1, keys[i]), "contribution": float(c1[i])} for i in top],
                        "remainder_other_cards": float(dl - sum(c1[i] for i in top)),
                        "n_cards_with_nonzero_contribution": int(np.sum(np.abs(c1) > 1e-15)),
                        "own_hand_share_of_delta": (float(own / dl) if own is not None and abs(dl) > 1e-15 else None),
                        "A2_same_leading_card": bool(lead2 == order[0]) if keys else None})
        return out

    movers = explain_rows(list(queries) + ["start: standing, me first"], parts, targets, "delta_q_W")
    # TV movers: payoff = sign pattern at the queried state
    tv_q = sorted(both, key=lambda t: (-tv[t], k0.labels[t]))[:10 if "nogi" in r0.tag else 5]
    tv_rows = []
    worst_tv = 0.0
    for t in tv_q:
        sgn = 0.5 * np.sign(F1[t] - F0[t])
        x0, x1 = adjoint(k0, unit(k0.n_t, t)), adjoint(k1, unit(k0.n_t, t))
        _b0, _b1, tot, _t2, prt = fine.explain(sgn, [(x0, x1)])
        worst_tv = max(worst_tv, abs(prt[0][1].sum() - tv[t]), abs(tot[t] - tv[t]))
        tv_rows.extend(explain_rows([t], prt, [tv[t]], "TV"))
    checks.ok(f"{name} Corollary A'': TV attribution sums to TV exactly, {len(tv_q)} states",
              worst_tv < 1e-12, f"max |Σ - TV| {worst_tv:.2e}", len(tv_q))
    only0 = sorted(set(k0.fin_cols) - set(k1.fin_cols))
    only1 = sorted(set(k1.fin_cols) - set(k0.fin_cols))
    return {"delta": "new − old", "old": r0.tag, "new": r1.tag,
            "set_definition": "transient states whose role-node is live in BOTH kernels; H = ∞; the corpus's game",
            "n_states": int(both.size), "max_abs_delta_q_W": float(np.abs(dq[both]).max()),
            "mean_abs_delta_q_W": float(np.abs(dq[both]).mean()), "max_TV": float(tv[both].max()),
            "mean_TV": float(tv[both].mean()), "spearman_q_W_old_vs_new": correlation(r0.b[both, 0], r1.b[both, 0]),
            "standing_me_first": {"old": float(s_std @ r0.b[:, 0]), "new": float(s_std @ r1.b[:, 0]),
                                  "TV": float(0.5 * np.abs(s_std @ F1 - s_std @ F0).sum())},
            "finisher_columns": {"old": len(k0.fin_cols), "new": len(k1.fin_cols), "union": len(U) - 1,
                                 "only_old": len(only0), "only_new": len(only1)},
            "prop_A1_max_error": e1, "prop_A2_max_error": e2,
            "top_movers_delta_q_W": movers, "top_movers_TV": tv_rows}


# --------------------------------------------------------------------------- #
# JSON
# --------------------------------------------------------------------------- #
def jsonable(x):
    if isinstance(x, dict):
        return {str(k): jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [jsonable(v) for v in x]
    if isinstance(x, (np.bool_, bool)):
        return bool(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        v = float(x)
        return None if not np.isfinite(v) else float(f"{v:.10g}")
    if isinstance(x, np.ndarray):
        return jsonable(x.tolist())
    return x


def r6(x):
    """Round a large numeric table to 6 significant digits for the committed artifact (full precision
    lives in --full); NaN stays NaN (serialised null)."""
    a = np.asarray(x, dtype=float)
    return [None if not np.isfinite(v) else float(f"{v:.6g}") for v in a.ravel()]


_SCALAR_LIST = re.compile(r"\[\n\s*((?:(?:-?[0-9.eE+-]+|null|true|false|\"[^\"\n]{0,80}\"),\n\s*)*"
                          r"(?:-?[0-9.eE+-]+|null|true|false|\"[^\"\n]{0,80}\"))\n\s*\]")


def dump(art):
    """Sorted keys, indent 1, but every list of scalars on ONE line (a 56-number hub row must not cost
    56 lines); deterministic."""
    text = json.dumps(jsonable(art), sort_keys=True, indent=1, ensure_ascii=False)
    text = _SCALAR_LIST.sub(lambda m: "[" + re.sub(r",\n\s*", ", ", m.group(1)) + "]", text)
    return text + "\n"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def state_table(res):
    k = res.k
    cols = ["q_W", "q_L", "q_D", "clocked_W", "clocked_L", "clocked_optionless_D", "S_bar", "E_plies", "SD_plies", "E_steps"]
    rows = {}
    for r, s in enumerate(k.role_nodes):
        rows[s] = {}
        for turn, t in (("M", r), ("T", k.n_r + r)):
            rows[s][turn] = r6([res.b[t, 0], res.b[t, 1], res.b[t, 2], res.clock[t, 0], res.clock[t, 1], res.clock[t, 2],
                                res.clock_timeout[t], res.plies.mean[t], np.sqrt(res.plies.variance[t]), res.steps.mean[t]])
    return {"columns": cols, "rows": rows,
            "set_definition": f"{res.tag}; every role-node (incl. frame-absent / passive rows, flagged in `flags`); "
                              "the corpus's game; 6 significant digits (full precision: --full)",
            "flags": {"frame_absent": sorted(k.frame_absent), "passive_opp": sorted(k.passive_opp),
                      "unreachable_from_standing": sorted(set(k.role_nodes) - k.reachable)}}


def full_cards(res):
    k = res.k
    cards = {}
    for r, s in enumerate(k.role_nodes):
        cards[s] = {"metadata": res.authored[s], "hub": k.hub_of[r], "turns": {}}
        for turn, t in (("M", r), ("T", k.n_r + r)):
            cards[s]["turns"][turn] = {
                "q": res.b[t], "q_plus": res.q_plus[t], "clock": {h: res.clock_cells[h][t] for h in HORIZONS},
                "survival": {h: res.surv[h][t] for h in HORIZONS}, "plies": [res.plies.mean[t], res.plies.variance[t]],
                "steps": [res.steps.mean[t], res.steps.variance[t]],
                "visits": {w: [o.visits[t], o.cond[0][t], o.cond[1][t]] for w, o in res.occ.items()},
                "exit_groups": {f"{p}|{kind}": x for (p, kind), x in zip(res.groups, res.grouped[t]) if x > 1e-9}}
    return {"configuration": res.tag, "cards": cards,
            "hubs": {h: {turn: dict(zip([f"{a}|{b}" for a, b in res.hub_columns], v)) for turn, v in x.items()}
                     for h, x in res.hubs.items()}}


# --------------------------------------------------------------------------- #
# the whole run
# --------------------------------------------------------------------------- #
def run_all(checks, lexicon=None, lexicon_sha=None, full_path=None):
    base = load_kernel(*HEADLINE[:3], origin=HEADLINE[3])
    G = base.graph
    kernels = {c: load_kernel(c[0], c[1], c[2], graph=G, origin=c[3]) for c in CONFIGS}
    for ini in ("symmetric", "shipped"):
        kf, ks = load_kernel("nogi", ini, "frame", graph=G), kernels[("nogi", ini, "shipped", True)]
        d = max(abs(kf.Q - ks.Q).max(), abs(kf.R - ks.R).max(), abs(kf.R_fin - ks.R_fin).max())
        checks.ok(f"nogi/{ini}: frame-correct rates == folded rates (the folded scalar IS the no-gi rate)",
                  d == 0 and kf.fin_cols == ks.fin_cols, f"max |d| {d}", kf.n_t)
    lab0 = kernels[HEADLINE].labels
    checks.ok("all configurations share one transient label space (id join)",
              all(k.labels == lab0 for k in kernels.values()), f"{len(kernels)} kernels", len(kernels) * len(lab0))
    R = {}
    for c in CONFIGS:
        R[c] = analyse(kernels[c], checks, lexicon, full=c in MAIN,
                       mc=c in (HEADLINE, ("nogi", "shipped", "shipped", True)))
    # robustness ensembles for the symmetric (headline) rule, both frames
    ens = {}
    for c in MAIN:
        ens[c] = ensemble(kernels[c])
        checks.ok(f"{ckey(*c)} perturbation ensemble ({len(SEEDS)} seeds, eps {EPS}) solved", ens[c][1] < 1e-10,
                  f"max residual / row error {ens[c][1]:.2e}", len(SEEDS) * kernels[c].n_t)
    coh = {}
    for c in MAIN:
        f, i, rt, o = c
        other_f = "gi" if f == "nogi" else "nogi"
        other_i = "shipped" if i == "symmetric" else "symmetric"
        others = {"origin_off": (R[(f, i, rt, False)].b, kernels[(f, i, rt, False)]),
                  "other_rule": (R[(f, other_i, rt, o)].b, kernels[(f, other_i, rt, o)]),
                  "other_frame": (R[(other_f, i, rt, o)].b, kernels[(other_f, i, rt, o)])}
        e = ens.get(c)
        coh[ckey(*c)] = coherence(R[c], e[0] if e else None, others, e[1] if e else None)
    frames = {"gi_vs_nogi": {}, "gi_frame_rates_vs_folded": {}}
    for i in ("symmetric", "shipped"):
        frames["gi_vs_nogi"][i] = compare(R[("nogi", i, "shipped", True)], R[("gi", i, "shipped", True)],
                                          f"gi-vs-nogi/{i}", checks)
        frames["gi_frame_rates_vs_folded"][i] = compare(R[("gi", i, "shipped", True)], R[("gi", i, "frame", True)],
                                                        f"gi frame-vs-folded/{i}", checks)
    hk = kernels[HEADLINE]
    rp = R[HEADLINE].maxp
    cores = {name: v for name, v in rp["per_class"].items() if not name.startswith("col|")}
    art = {
        "schema": "gs-2/scalars/v1 (item S2R)",
        "recompute": recompute(),
        "which_game": "the corpus's game: both seats sample the authored, origin-filtered attempt shares "
                      "(gs-shared.md §3); not the app's game",
        "headline_configuration": ckey(*HEADLINE),
        "source_sha256": {"graph.json": sha(GRAPH_PATH), "scripts/semantics/_kernel.py": sha(HERE / "_kernel.py"),
                          "scripts/semantics/_absorbing.py": sha(HERE / "_absorbing.py"),
                          "scripts/semantics/scalars.py": sha(Path(__file__)),
                          "scripts/solve_edge_values.py": sha(HERE.parent / "solve_edge_values.py")},
        "lexicon": {"used": lexicon is not None, "sha256": lexicon_sha,
                    "grouping": "raw submission `type`" if lexicon is None else "--lexicon technique -> group"},
        "definitions": {
            "q_W": "P(I finish them) at H = ∞ from a transient state (role-node, turn); the corpus's game",
            "q_plus": "P(I finish them | the roll is decided) = q_W / (q_W + q_L); null where undefined",
            "q_bar": "turn-neutral committor of a role-node, ½[q_W(r,M) + q_W(r,T)]",
            "seat_advantage": "q̄(r) − q̄(flip r); = 2q̄ − 1 on the draw-free set under the symmetric rule (Prop D)",
            "clocked": "uniform mixture over H ∈ {9,10,11,12} PLIES of P(end in column within H plies); "
                       "clocked_optionless_D = an optionless hand inside the clock; S_bar = mixture of P(T > H) = timeout",
            "E_plies": ("expected plies to the finish: plies (one card; a stay-put miss costs 0), the kernel's time "
                        "unit, not the app's move count; E_steps counts cards"),
            "occupancy": "expected visits per roll from K.start(where, 'me'); given W / L = Doob transform with a "
                         "Bayes-updated start law; share = visits / Σ visits in that conditional roll",
            "hub_vector": "seat-labelled exit law of a hub: me/them converted to TOP/BOTTOM finisher first, then the "
                          "two viewpoint seats averaged ½ each; `coin` = ½(M + T)",
            "robustness": "ruling 1: fraction of K.perturbed(0.2, 0.2, seed), seeds 0..199, in which the claim holds, "
                          "plus whether it holds under origin=off, the other initiative rule, the other frame",
            "live": "role-node in K.live (excludes no-gi frame_absent / passive_opp rows)",
            "reachable_live": "live and reachable from the standing seeds in this kernel (K.reachable / K.reach_t)"},
        "coverage": {ckey(*c): R[c].coverage for c in CONFIGS},
        "validation": {ckey(*c): R[c].validation for c in CONFIGS},
        "headline": [row for c in CONFIGS for row in headline_rows(R[c])],
        "clock": {ckey(*c): clock_summary(R[c]) for c in MAIN},
        "tempo": {ckey(*c): tempo_summary(R[c]) for c in MAIN},
        "occupancy": {ckey(*c): occupancy_summary(R[c]) for c in MAIN},
        "exit_law": {ckey(*c): exit_summary(R[c], c == HEADLINE) for c in MAIN},
        "cores": {"configuration": ckey(*HEADLINE), "per_group_class": cores,
                  "checked": {ckey(*c): {x: R[c].maxp[x] for x in ("classes", "states_checked", "halo_states_checked",
                                                                 "core_strict_local_maxima", "max_c1_residual",
                                                                 "max_c3_slack_violation")} for c in MAIN}},
        "coherence": coh,
        "frames": frames,
        "monte_carlo": {ckey(*c): R[c].mc for c in CONFIGS if hasattr(R[c], "mc")},
        "states": {ckey(*c): state_table(R[c]) for c in (HEADLINE, ("gi", "symmetric", "shipped", True))},
        "checks": {"passed": checks.count - len(checks.failures), "failed": len(checks.failures),
                   "compared": checks.compared, "own_method_max_printed_residual": _OWN_RESIDUAL[0],
                   "own_method_solves": _OWN_RESIDUAL[1]},
    }
    if full_path is not None:
        Path(full_path).parent.mkdir(parents=True, exist_ok=True)
        Path(full_path).write_text(json.dumps(jsonable({ckey(*c): full_cards(R[c]) for c in CONFIGS}),
                                              sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n",
                                   encoding="utf-8")
        emit(f"wrote full per-state cards: {full_path}")
    return art, R, kernels, hk


# --------------------------------------------------------------------------- #
# synthetic proofs for the S2 adapters (known answers), and mutation kills
# --------------------------------------------------------------------------- #
def toy_kernel(role_nodes, cells, fin_cols=(), actions=(), hubs=None):
    k = object.__new__(Kernel)
    k.role_nodes = tuple(role_nodes)
    k.n_r = len(role_nodes)
    k.n_t = 2 * k.n_r
    k.labels = tuple((s, "M") for s in role_nodes) + tuple((s, "T") for s in role_nodes)
    k.index = {s: i for i, s in enumerate(role_nodes)}
    k.cells = np.array(cells, dtype=CELL_DTYPE)
    k.fin_cols, k.n_fin, k.actions = tuple(fin_cols), len(fin_cols), list(actions)
    k.frame, k.initiative, k.rates, k.origin = "toy", "toy", "toy", True
    k.hub_of = tuple(s.rsplit("/", 1)[0] for s in role_nodes)
    k.role_of = tuple(s.rsplit("/", 1)[1] for s in role_nodes)
    k.hubs = tuple(sorted(set(k.hub_of)))
    k.live = frozenset(role_nodes)
    k.reach_t = np.ones(k.n_t, bool)
    k._build_matrices()
    return k


def _toy_clock_kernel(extra=()):
    """a/bottom (idx 0), a/top (idx 1); transient: 0 (a/bottom,M) 1 (a/top,M) 2 (a/bottom,T) 3 (a/top,T).
    (a/top,M): p=.5 finish W (1 ply) | stay-put to (a/top,T) (0 ply). (a/top,T): L .25 | back to (a/top,M) .75.
    (a/bottom,M): -> (a/top,T) 1 ply. (a/bottom,T): D .1, L .4, -> (a/bottom,M) .5."""
    W_, L_, D_ = -1 - IW, -1 - IL, -1 - ID
    cells = [(1, 0, 0, 1.0, 0.5, W_, 1, 0), (1, 0, 1, 1.0, 0.5, 3, 0, -1),
             (3, 1, 0, 1.0, 0.25, L_, 1, 1), (3, 1, 1, 1.0, 0.75, 1, 1, -1),
             (0, 2, 0, 1.0, 1.0, 3, 1, -1),
             (2, 3, 0, 1.0, 0.1, D_, 1, -1), (2, 3, 0, 1.0, 0.4, L_, 1, 1), (2, 3, 1, 1.0, 0.5, 0, 1, -1)]
    return toy_kernel(("a/bottom", "a/top"), list(cells) + list(extra), fin_cols=(("sub", "me"), ("sub", "them")))


def toy_clock_suite(checks):
    k = _toy_clock_kernel()
    spec, cov = build_plies(k)
    checks.ok("toy: durations adapter covers every edge", cov["edges_checked"] == 8 and cov["zero_ply_cells"] == 1,
              str(cov), cov["cells_checked"])
    com = own_call("toy", ab.committor, k.Q, k.R, IW, IL, ID, labels=k.labels)
    checks.close("toy: committor closed forms q(a/top,M)=.8, q(a/top,T)=.6, q(a/bottom,M)=.6, q(a/bottom,T)=.3",
                 com.q_W[[1, 3, 0, 2]], [0.8, 0.6, 0.6, 0.3], 1e-12)
    cc = cell_clock(k, horizons=tuple(range(1, 13)))
    for H in range(1, 13):
        checks.close(f"toy: V_H(a/top,M) = .8(1 - .375^H) and P(T>H) = .375^H at H={H}",
                     [cc[H][1, 0], 1 - cc[H][1].sum()], [0.8 * (1 - 0.375 ** H), 0.375 ** H], 1e-12)
        w, l = k.finite_horizon(H)
        checks.close(f"toy: K.finite_horizon == cell propagation at H={H}", np.column_stack([w, l]), cc[H][:, :2], 1e-14)
    M = m_operator(k)
    Y, one = com.q_W.copy(), np.ones(4)
    for H in range(1, 13):
        Y, one = M @ Y, M @ one
        checks.close(f"toy: Prop B2/B3 q - V_H == M^H q, P(T>H) == M^H 1 at H={H}",
                     [*(com.q_W - cc[H][:, 0]), *(1 - cc[H].sum(1))], [*Y, *one], 1e-14)
    t = own_call("toy", ab.expected_time, k.Q, spec, labels=k.labels)
    unit = spec.transient.copy()
    unit.data[:] = 1
    st = own_call("toy", ab.expected_time, k.Q, ab.Plies(unit, np.ones(4)), labels=k.labels)
    checks.close("toy: E[plies]=1.6, Var[plies]=0.96, E[steps]=2.4 at (a/top,M) (geometric closed forms)",
                 [t.mean[1], t.variance[1], st.mean[1]], [1.6, 0.96, 2.4], 1e-12)
    m, v = cell_moments(k, k.cells["plies"])
    checks.close("toy: cell moments == Plies moments", [*m, *v], [*t.mean, *t.variance], 1e-12)
    # brute-force enumeration of the ply clock (independent of every matrix route)
    def enum(s, budget):
        out = np.zeros(3)
        for c in k.cells[k.cells["src"] == s]:
            if c["dst"] < 0:
                if budget >= 1:
                    out[-1 - c["dst"]] += c["mass"]
            elif budget - c["plies"] >= 0:
                out += c["mass"] * enum(int(c["dst"]), budget - int(c["plies"]))
        return out
    worst = max(float(np.abs(enum(s, H) - cc[H][s]).max()) for s in range(4) for H in range(1, 9))
    checks.ok("toy: cell clock == brute-force path enumeration (4 states, H = 1..8)", worst < 1e-14,
              f"max |diff| {worst:.2e}", 4 * 8 * 3)


def toy_failure_suite(checks):
    k = _toy_clock_kernel(extra=[(1, 0, 1, 0.0, 0.0, 3, 1, -1)])   # same edge, zero mass, ply 1
    checks.raises("toy: duration conflict on one edge fires by name", DurationConflictError, lambda: build_plies(k),
                  ("a/top@M", "a/top@T"))
    cyc = _toy_clock_kernel()
    cyc.cells = cyc.cells.copy()
    cyc.cells["plies"][3] = 0                                        # (a/top,T) -> (a/top,M) now 0 ply: a cycle
    cyc._build_matrices()
    checks.raises("toy: 0-ply cycle fires by name before any clock", ZeroPlyCycleError, lambda: cell_clock(cyc),
                  ("a/top@M",))
    meta = [{"technique": "x", "performer": "me", "type": "Leg Lock"}, {"technique": "y", "performer": "them", "type": "Choke"}]
    checks.raises("toy: lexicon missing a finisher technique fires by name", JoinError,
                  lambda: column_groups((("x", "me"), ("y", "them")), meta, {"x": "LEG"}), ("y",))
    checks.raises("toy: finisher metadata out of identity order fires", JoinError,
                  lambda: column_groups((("y", "them"), ("x", "me")), meta))
    got = column_groups((("x", "me"), ("y", "them")), meta, {"y": "CHOKE", "x": "LEG", "z": "unused"})
    checks.ok("toy: lexicon joins by technique id, not by position", got == (("me", "LEG"), ("them", "CHOKE")), str(got), 2)
    checks.raises("toy: attribution refuses kernels with different label sets", JoinError,
                  lambda: Attribution(k, toy_kernel(("b/bottom", "b/top"), [(i, -1, 0, 0, 1.0, -1 - ID, 1, -1) for i in range(4)]),
                                      ("W", "L", "D")))


def toy_hub_suite(checks):
    k = toy_kernel(("h/bottom", "h/top"), [(i, -1, 0, 0.0, 1.0, -1 - ID, 1, -1) for i in range(4)])
    groups = (("me", "X"), ("them", "X"))
    grouped = np.array([[0.2, 0.5], [0.3, 0.1], [0.05, 0.15], [0.4, 0.0]])
    cols, hubs = hub_vectors(k, groups, grouped)
    want_M = {("top", "X"): 0.5 * (0.3 + 0.5), ("bottom", "X"): 0.5 * (0.2 + 0.1)}
    want_T = {("top", "X"): 0.5 * (0.4 + 0.15), ("bottom", "X"): 0.5 * (0.05 + 0.0)}
    checks.close("toy: seat-labelled hub vector converts me/them to TOP/BOTTOM before averaging",
                 [*hubs["h"]["M"], *hubs["h"]["T"], *hubs["h"]["coin"]],
                 [*(want_M[c] for c in cols), *(want_T[c] for c in cols),
                  *(0.5 * (want_M[c] + want_T[c]) for c in cols)], 1e-15)


def _random_pair(rng):
    """Two random card-structured kernels on the same 8 transient states; the new one drops a card,
    re-prices one, adds one with a finisher column the old kernel does not have."""
    roles = ("p/bottom", "p/top", "q/bottom", "q/top")
    n_t = 8
    fin = [("f0", "me"), ("f0", "them"), ("f1", "me"), ("f1", "them")]

    def build(variant):
        cells, acts, fcols = [], [], list(fin) + ([("f2", "me")] if variant else [])
        for t in range(n_t):
            cards = [("transitions", f"c{t}a"), ("transitions", f"c{t}b"), ("submissions", f"s{t}")]
            if variant and t == 3:
                cards = cards[1:]
            if variant and t == 5:
                cards.append(("submissions", "new"))
            ws = np.array([1.0 + ((7 * t + 3 * j) % 5) for j in range(len(cards))])
            ws /= ws.sum()
            for j, ((cat, tgt), pi) in enumerate(zip(cards, ws)):
                p = 0.3 + 0.1 * ((t + j) % 4) + (0.15 if variant and t == 6 and j == 0 else 0.0)
                ai = len(acts)
                acts.append({"t": t, "cat": cat, "target": tgt, "performer": "me" if t < 4 else "them", "pi": pi, "p": p,
                             "role_node": roles[t % 4], "name": tgt})
                dsts = [(t + 1 + j) % n_t, (t + 3) % n_t]
                cells.append((t, ai, 0, pi * 0.6, pi * p * 0.6, dsts[0], 1, -1))
                if cat == "submissions":
                    f = 4 if tgt == "new" else (t % 2) * 2 + (0 if t < 4 else 1)
                    cells.append((t, ai, 0, pi * 0.4, pi * p * 0.4, -1 - (IW if fcols[f][1] == "me" else IL), 1, f))
                else:
                    cells.append((t, ai, 0, pi * 0.4, pi * p * 0.4, dsts[1], 1, -1))
                cells.append((t, ai, 1, pi * 0.8, pi * (1 - p) * 0.8, (t + 5) % n_t, 1, -1))
                cells.append((t, ai, 1, pi * 0.2, pi * (1 - p) * 0.2, -1 - ID, 1, -1))
        return toy_kernel(roles, cells, fin_cols=fcols, actions=acts)
    return build(False), build(True)


def toy_attribution_suite(checks):
    rng = np.random.default_rng(MC_SEED)
    k0, k1 = _random_pair(rng)
    for k in (k0, k1):
        rows = np.asarray(k.Q.sum(1)).ravel() + np.asarray(k.R.sum(1)).ravel()
        require(np.abs(rows - 1).max() < 1e-12, "toy pair rows do not sum to 1")
    coarse = Attribution(k0, k1, ("W", "L", "D"))
    B0, _ = k0.absorption()
    B1, _ = k1.absorption()
    g = np.array([1.0, 0.0, 0.0])
    xs = [(adjoint(k0, unit(8, t)), adjoint(k1, unit(8, t))) for t in range(8)]
    b0, b1, total, total2, parts = coarse.explain(g, xs)
    checks.close("toy: Prop A1 N1[(R1-R0)g + (Q1-Q0)b0] == b1 - b0 (exact solves)", total, B1[:, 0] - B0[:, 0], 1e-14)
    checks.close("toy: Prop A2 N0[(R1-R0)g + (Q1-Q0)b1] == b1 - b0", total2, B1[:, 0] - B0[:, 0], 1e-14)
    checks.close("toy: per-card contributions sum to Δq at every state, zero remainder (A1 and A2)",
                 [*(p[1].sum() for p in parts), *(p[2].sum() for p in parts)],
                 [*(B1[:, 0] - B0[:, 0]), *(B1[:, 0] - B0[:, 0])], 1e-14)
    keys = parts[0][0]
    changed = {z for z in keys if z[2] in ("c3a", "new") or (z[0] == 6 and z[2] == "c6a")}
    zero_ok = all(abs(parts[t][1][i]) < 1e-15 for t in range(8) for i, z in enumerate(keys)
                  if z not in changed and not (z[0] in (3, 5, 6)))
    checks.ok("toy: only cards at the three edited hands carry contribution (renormalised hands included)",
              zero_ok, f"{len(keys)} card keys", len(keys) * 8)
    U = tuple(sorted(set(k0.fin_cols) | set(k1.fin_cols))) + (("<draw>", None),)
    fine = Attribution(k0, k1, U)
    worst = 0.0
    for t in range(8):
        tv = 0.5 * np.abs(fine.B1[t] - fine.B0[t]).sum()
        _a, _b, tot, _c, prt = fine.explain(0.5 * np.sign(fine.B1[t] - fine.B0[t]), [xs[t]])
        worst = max(worst, abs(prt[0][1].sum() - tv), abs(tot[t] - tv))
    checks.ok("toy: Corollary A'' TV attribution exact with a column only the new kernel has", worst < 1e-14,
              f"max |Σ - TV| {worst:.2e}", 8)
    # finite differences: an infinitesimal edit's first-order term is N (dQ b + dR g) — A1 must agree to O(eps^2)
    eps = 1e-6
    k1e = toy_kernel(k0.role_nodes, [tuple(c) for c in k0.cells], k0.fin_cols, k0.actions)
    cc = k1e.cells.copy()
    sel = cc["src"] == 2
    cc["mass"][sel & (cc["dst"] >= 0)] *= (1 - eps)
    lost = (k1e.cells["mass"][sel & (k1e.cells["dst"] >= 0)] * eps).sum()
    k1e.cells = np.concatenate([cc, np.array([(2, -1, 0, 0.0, lost, -1 - IW, 1, 0)], dtype=CELL_DTYPE)])
    k1e._build_matrices()
    Be, _ = k1e.absorption()
    fd = (Be[:, 0] - B0[:, 0]) / eps
    dQ = (k1e.Q - k0.Q).toarray() / eps
    dR = (k1e.R - k0.R).toarray() / eps
    lin = k0.fundamental().solve(dQ @ B0[:, 0] + dR @ g)
    checks.close("toy: finite differences agree with the resolvent derivative N(dQ b + dR g)", fd, lin, 1e-5)


def toy_maxp_suite(checks):
    # path 0 -> 1 -> 2, class-C exit only at 2: h increases towards the core, core = {2}
    W_ = -1 - IW
    cells = [(0, -1, 0, 0, 0.5, 1, 1, -1), (0, -1, 0, 0, 0.5, -1 - ID, 1, -1),
             (1, -1, 0, 0, 0.5, 2, 1, -1), (1, -1, 0, 0, 0.5, -1 - ID, 1, -1),
             (2, -1, 0, 0, 0.5, W_, 1, 0), (2, -1, 0, 0, 0.5, -1 - ID, 1, -1),
             (3, -1, 0, 0, 1.0, -1 - ID, 1, -1)]
    k = toy_kernel(("z/bottom", "z/top"), cells, fin_cols=(("c", "me"),))
    Bf, _ = k.exit_law()
    checks.close("toy: h along the path = (.125, .25, .5, 0), maximum at the core", Bf[:, 0], [0.125, 0.25, 0.5, 0.0], 1e-15)
    rep = max_principle(k, k.Q, k.R_fin, {"C": [0]})
    checks.ok("toy: maximum-principle checker passes a harmonic h", not rep["violations"]
              and rep["per_class"]["C"]["core"] == 1 and rep["max_c1_residual"] < 1e-14, str(rep["violations"]), 4)
    bump = {"C": np.array([0.125, 0.9, 0.5, 0.0])}
    rep2 = max_principle(k, k.Q, k.R_fin, {"C": [0]}, H=bump)
    checks.ok("toy: maximum-principle checker FLAGS a non-harmonic bump in the halo", bool(rep2["violations"]),
              str(rep2["violations"]), 4)
    k0, _k1 = _random_pair(np.random.default_rng(1))
    classes = {f"col{i}": [i] for i in range(k0.n_fin)}
    classes["all"] = list(range(k0.n_fin))
    rep3 = max_principle(k0, k0.Q, k0.R_fin, classes)
    checks.ok("toy: Prop C holds on a random card-structured chain (every class)", not rep3["violations"]
              and rep3["max_c1_residual"] < 1e-13 and rep3["max_c3_slack_violation"] < 1e-13,
              f"{rep3['classes']} classes; {rep3['violations'][:2]}", rep3["states_checked"])


def toy_reweight_suite(checks):
    k0, _k1 = _random_pair(np.random.default_rng(3))
    own = defaultdict(dict)
    for a in k0.actions:
        own[a["role_node"]][(a["cat"], a["target"])] = own[a["role_node"]].get((a["cat"], a["target"]), 0.0) + a["pi"]
    kr, cnt, lost = reweight(k0, own, set(k0.role_nodes))
    d = max(abs(kr.Q - k0.Q).max(), abs(kr.R - k0.R).max(), abs(kr.R_fin - k0.R_fin).max())
    checks.ok("toy: reweighting a kernel with its OWN shares reproduces it exactly", d < 1e-15 and lost == 0,
              f"max |d| {d:.1e}; counts {cnt}", k0.n_t)
    drop = set(k0.role_nodes) - {"q/top"}
    kr2, _c, lost2 = reweight(k0, own, drop)
    rows = np.asarray(kr2.Q.sum(1)).ravel() + np.asarray(kr2.R.sum(1)).ravel()
    into = sum(1 for c in k0.cells if c["dst"] >= 0 and k0.role_nodes[c["dst"] % k0.n_r] == "q/top"
               and k0.role_nodes[c["src"] % k0.n_r] != "q/top")
    checks.ok("toy: a destination the wire lacks becomes lost mass, rows stay stochastic", lost2 == into and into > 0
              and np.abs(rows - 1).max() < 1e-12, f"lost cells {lost2} (expected {into})", k0.n_t)
    try:
        with frame_rate_patch():
            raise RuntimeError("probe")
    except RuntimeError:
        pass
    import solve_edge_values as sev
    checks.ok("toy: the tech_rate patch is restored even when the body raises", sev.tech_rate.__name__ == "tech_rate",
              sev.tech_rate.__name__, 1)


def toy_stats_suite(checks):
    c1 = correlation([1, 2, 3, 4], [10, 20, 30, 45])
    c2 = correlation([1, 1, 1, 1], [1, 2, 3, 4])
    checks.ok("toy: Spearman of a monotone pair is 1; a constant side is undefined, never 0",
              c1["spearman"] == 1.0 and c2["spearman"] is None and c2["undefined_reason"], str((c1, c2)), 2)
    d = decided(np.array([0.2, 0.0]), np.array([0.2, 0.0]))
    checks.ok("toy: undecidable conditional is NaN (null in JSON), never 0", d[0] == 0.5 and np.isnan(d[1])
              and jsonable(d.tolist()) == [0.5, None], str(d), 2)


MUTANTS = (("clock_charges_zero_ply", toy_clock_suite), ("hub_no_seat_conversion", toy_hub_suite),
           ("attribution_old_visits", toy_attribution_suite))


def mutation_suite(checks):
    global _MUTANT
    for name, suite in MUTANTS:
        probe = Checks(quiet=True)
        _MUTANT = name
        try:
            with redirect_stdout(io.StringIO()):
                suite(probe)
        except Exception as exc:  # noqa: BLE001 - a crash is a kill too, but say so
            probe.failures.append(f"crashed: {type(exc).__name__}")
        finally:
            _MUTANT = None
        checks.ok(f"mutation '{name}' is killed by {suite.__name__}", bool(probe.failures),
                  f"killed by {probe.failures[:3]}", max(probe.count, 1))


def selfcheck():
    checks = Checks()
    old = ab._SELF_CHECK
    try:
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = ab.selfcheck()
        last = buf.getvalue().strip().splitlines()[-1] if buf.getvalue().strip() else ""
        checks.ok("S1 synthetic suites (_absorbing.py --selfcheck)", rc == 0 and "PASS set=all" in last, last[:200])
    finally:
        ab._SELF_CHECK = old
    for suite in (toy_clock_suite, toy_failure_suite, toy_hub_suite, toy_attribution_suite, toy_maxp_suite,
                  toy_reweight_suite, toy_stats_suite, mutation_suite):
        try:
            suite(checks)
        except Exception as exc:  # noqa: BLE001
            checks.ok(f"suite {suite.__name__} completed", False, f"{type(exc).__name__}: {exc}")
    art, _R, _K, _hk = run_all(checks)
    size = len(dump(art).encode("utf-8"))
    checks.ok("artifact under the public-repo budget", size < ARTIFACT_LIMIT, f"{size} bytes (limit {ARTIFACT_LIMIT})", 1)
    checks.ok("selfcheck floors", checks.count >= 250 and checks.compared >= 500_000,
              f"checks {checks.count} (floor 250), compared {checks.compared} (floor 500000)", checks.count)
    emit(f"{'FAIL' if checks.failures else 'PASS'} selfcheck: {checks.count} checks, {len(checks.failures)} failed, "
         f"{checks.compared} comparisons; failures {checks.failures[:10]}")
    return 1 if checks.failures else 0


# --------------------------------------------------------------------------- #
# --state: one role-node's card
# --------------------------------------------------------------------------- #
def state_card(role, cfg, lexicon=None):
    checks = Checks()
    base = load_kernel(*HEADLINE[:3], origin=HEADLINE[3])
    k = load_kernel(cfg[0], cfg[1], cfg[2], graph=base.graph, origin=cfg[3])
    require(role in k.index, f"unknown role-node {role!r} (ids look like 'mount/top')", JoinError)
    res = analyse(k, checks, lexicon, full=False)
    r = k.index[role]
    f = int(k.flipidx[r])
    P = print
    P(f"== {role}   [{res.tag}]   the corpus's game")
    P(f"   recompute: {recompute(cfg, role)}")
    flags = [x for x, s in (("FRAME-ABSENT (its row is a fabricated draw)", k.frame_absent), ("passive opponent", k.passive_opp)) if role in s]
    P(f"   hub {k.hub_of[r]}, seat {k.role_of[r]}; live={role in k.live} reachable_from_standing={role in k.reachable} {' '.join(flags)}")
    P(f"   authored: {res.authored[role]}")
    for turn, t in (("MY turn", r), ("THEIR turn", k.n_r + r)):
        q = res.b[t]
        P(f"-- {turn}")
        P(f"   H=inf   P(I finish) {q[0]:.4f}  P(they finish) {q[1]:.4f}  P(draw) {q[2]:.4f}  "
          f"P(I finish | decided) " + (f"{res.q_plus[t]:.4f}" if np.isfinite(res.q_plus[t]) else "undefined (never decided)"))
        P(f"   clock   " + "  ".join(f"H={h}: W {res.clock_cells[h][t, 0]:.4f} L {res.clock_cells[h][t, 1]:.4f} "
                                     f"P(T>H) {res.surv[h][t]:.4f}" for h in HORIZONS))
        P(f"   clock mixture: W {res.clock[t, 0]:.4f}  L {res.clock[t, 1]:.4f}  optionless draw {res.clock[t, 2]:.4f}  "
          f"timeout S̄ {res.clock_timeout[t]:.4f}   Prop B gap q_W - V̄_W = {q[0] - res.clock[t, 0]:.4f} <= S̄")
        P(f"   tempo   E[plies] {res.plies.mean[t]:.3f} (SD {np.sqrt(res.plies.variance[t]):.3f})  "
          f"E[steps] {res.steps.mean[t]:.3f} (SD {np.sqrt(res.steps.variance[t]):.3f})")
        for where, o in res.occ.items():
            P(f"   visits per roll from {where} (me first): {o.visits[t]:.4f}; given I win {o.cond[0][t]:.4f}; "
              f"given they win {o.cond[1][t]:.4f}")
        top = sorted(zip(res.groups, res.grouped[t]), key=lambda x: -x[1])[:8]
        P(f"   exit law (performer|{'type' if lexicon is None else 'lexicon group'}): " + ", ".join(f"{p}|{kind} {x:.4f}" for (p, kind), x in top if x > 5e-5))
    qb, A = seat_stats(k, res.b)
    d = POSITION_DIRECTION[res.authored[role]["positionType"]]
    P(f"-- coherence: q̄ {qb[r]:.4f}, partner seat {k.role_nodes[f]} q̄ {qb[f]:.4f}, seat advantage {A[r]:+.4f}; "
      f"label direction {d:+d} -> " + ("DISAGREES" if d * A[r] < -1e-12 else ("agrees" if d else "neutral label")))
    if k.initiative == "symmetric" and d != 0 and role in k.live:
        e, wr = ensemble(k)
        held = np.mean([disagrees(k, eb, np.array([POSITION_DIRECTION[res.authored[s]["positionType"]] for s in k.role_nodes]),
                                  "threshold")[r] for eb in e])
        P(f"   robustness: a label/committor disagreement (threshold test) holds in {held:.3f} of "
          f"K.perturbed({EPS},{EPS},seed) seeds 0..199")
    hv = res.hubs[k.hub_of[r]]
    for turn in ("M", "T", "coin"):
        top = sorted(zip(res.hub_columns, hv[turn]), key=lambda x: -x[1])[:6]
        P(f"   hub vector [{turn}] (finisher seat|type): " + ", ".join(f"{s}|{kind} {x:.4f}" for (s, kind), x in top if x > 5e-5))
    if cfg[0] == "nogi" or cfg[2] == "frame":
        return 0 if not checks.failures else 1
    other = load_kernel("nogi", cfg[1], "shipped", graph=base.graph, origin=cfg[3])
    r0 = analyse(other, checks, lexicon, full=False)
    for turn, t in (("M", r), ("T", k.n_r + r)):
        P(f"-- gi vs nogi [{turn}]: q_W nogi {r0.b[t, 0]:.4f} -> gi {res.b[t, 0]:.4f} (Δ {res.b[t, 0] - r0.b[t, 0]:+.4f})")
    return 0 if not checks.failures else 1


# --------------------------------------------------------------------------- #
# S3 — consequences the owner can act on (--consequences)
# --------------------------------------------------------------------------- #
CONSEQ_JSON = REPO / "tests/artifacts/semantics/scalars_consequences.json"
WIRE_PATH = REPO / "source/quartz/static/neural/graph-data.json"
VOCAB_PATH = REPO / "tests/artifacts/semantics/vocabulary.json"
NODE_SCRIPT = HERE / "wire_semantics.mjs"      # in the repo; read-only on the emitted wire
# an INJECTIVE one-char code per body-region class (the first letter is not: SHOULDER and
# SPINE/COMPRESSION both start with S)
CLASS_CODE = {"ARM": "A", "CHOKE": "C", "HIP/GROIN": "H", "LEG": "L", "SHOULDER": "S", "SPINE/COMPRESSION": "P"}


class frame_rate_patch:
    """IN-PROCESS ONLY. Replaces `solve_edge_values.tech_rate` by the frame-correct reader the
    function's own docstring describes (`successRateByRuleset[frame]`; a null stays None = the
    technique is absent), and restores the original on exit — asserted. Nothing touches disk;
    solve_edge_values.py and solve_flow.py are never edited. EDGE and FLOW both reach the rate
    through Model -> build_hand/build_action -> the module-global `tech_rate`, so one patch covers
    both; the kernel's own `from ... import tech_rate` binding is deliberately NOT patched."""

    def __enter__(self):
        import solve_edge_values as sev
        self.sev, self.orig = sev, sev.tech_rate
        self.stats = Counter()

        def tech_rate_frame(tech, opts, _s=self.stats):
            m = tech.get("successRateByRuleset")
            if isinstance(m, dict) and opts.frame in m:
                if m[opts.frame] is None:
                    _s["null_absent"] += 1
                    return None
                _s["frame_cell"] += 1
                return m[opts.frame]
            _s["fallback_scalar"] += 1
            return tech.get("successRate")

        sev.tech_rate = tech_rate_frame
        return self.stats

    def __exit__(self, *exc):
        self.sev.tech_rate = self.orig
        require(self.sev.tech_rate is self.orig, "tech_rate patch was not restored")
        return False


def _tech(g, cat, target):
    return g[cat].get(target + "/attacker") or {}


def _rates(g, cat, target):
    t = _tech(g, cat, target)
    rb = t.get("successRateByRuleset") or {}
    return {"gi": rb.get("gi"), "nogi": rb.get("nogi"), "folded": t.get("successRate")}


def patch_effect_check(g, checks):
    """The patch must price every dealt gi card exactly as the kernel's rates='frame' does, and the
    unpatched Model exactly as rates='shipped' (a join on (state, category, technique), both ways)."""
    from solve_edge_values import Model, Opts
    out = {}
    for label, patched, rates in (("folded", False, "shipped"), ("frame", True, "frame")):
        K = load_kernel("gi", "shipped", rates)
        want = Counter((K.labels[a["t"]][0], a["cat"], a["target"], round(a["p"], 12))
                       for a in K.actions if a["performer"] == "me")
        if patched:
            with frame_rate_patch() as st:
                m = Model(K.graph, Opts(frame="gi"))
            out["patch_calls"] = dict(st)
        else:
            m = Model(K.graph, Opts(frame="gi"))
        got = Counter((s, a.cat, a.target, round(a.p, 12)) for s, h in zip(m.states, m.hands) for a in h)
        checks.ok(f"S3 patch: Model(gi) {label} odds == kernel rates={rates!r} odds, card for card",
                  got == want and sum(got.values()) > 1000, f"{sum(got.values())} cards; "
                  f"only-Model {sum((got - want).values())}, only-kernel {sum((want - got).values())}",
                  sum(got.values()))
    import solve_edge_values as sev
    checks.ok("S3 patch restored: solve_edge_values.tech_rate is the shipped function again",
              sev.tech_rate.__name__ == "tech_rate", sev.tech_rate.__name__)
    return out


def _edge_decomp(r0, r1, base0, base1):
    """Exact split of 100·ΔEDGE (before rounding): own-rate term Δp·(A1−B1), downstream term
    p0·ΔA + (1−p0)·ΔB, baseline term −Δbase. Q = pA + (1−p)B makes it an identity."""
    p0, p1 = r0["odds"], r1["odds"]
    own = 100 * (p1 - p0) * (r1["A"] - r1["B"])
    down = 100 * (p0 * (r1["A"] - r0["A"]) + (1 - p0) * (r1["B"] - r0["B"]))
    base = -100 * (base1 - base0)
    exact = 100 * ((r1["q"] - base1) - (r0["q"] - base0))
    return own, down, base, exact


def compare_edge(g, checks, frame="gi", lam=2.0):
    from solve_edge_values import HORIZON_MIX, Opts, solve_mixture
    s0 = solve_mixture(g, lam, HORIZON_MIX, Opts(frame=frame))
    with frame_rate_patch() as st:
        s1 = solve_mixture(g, lam, HORIZON_MIX, Opts(frame=frame))
    rows, worst_id = [], 0.0
    pairs = changed = hands_changed = top_solver = top_int = only0 = only1 = own_changed = 0
    hist = Counter()
    for s in s0.model.states:
        a = {r["name"]: r for r in s0.q[s]}
        b = {r["name"]: r for r in s1.q[s]}
        only0 += len(set(a) - set(b))
        only1 += len(set(b) - set(a))
        any_change = False
        for name in sorted(set(a) & set(b)):
            pairs += 1
            e0, e1 = s0.edge[s][name], s1.edge[s][name]
            own, down, base, exact = _edge_decomp(a[name], b[name], s0.baseline[s], s1.baseline[s])
            worst_id = max(worst_id, abs(own + down + base - exact))
            own_changed += abs(a[name]["odds"] - b[name]["odds"]) > 1e-12
            if e1 != e0:
                changed += 1
                any_change = True
                d = abs(e1 - e0)
                hist["1" if d == 1 else "2-4" if d <= 4 else "5-9" if d <= 9 else ">=10"] += 1
                rows.append({"state": s, "card": name, "category": a[name]["cat"], "technique": a[name]["target"],
                             "edge_folded": e0, "edge_frame": e1, "delta": e1 - e0,
                             "odds_folded": a[name]["odds"], "odds_frame": b[name]["odds"],
                             "rates": _rates(g, a[name]["cat"], a[name]["target"]),
                             "term_own_rate": own, "term_downstream": down, "term_baseline": base})
        hands_changed += any_change
        top_solver += bool(s0.q[s] and s1.q[s] and s0.q[s][0]["name"] != s1.q[s][0]["name"])
        key = lambda r, sol: (-sol.edge[s][r["name"]], -r["odds"], -r["attempt"], r["name"])
        if s0.q[s] and s1.q[s]:
            t0 = min(s0.q[s], key=lambda r: key(r, s0))["name"]
            t1 = min(s1.q[s], key=lambda r: key(r, s1))["name"]
            top_int += t0 != t1
    checks.ok(f"S3 EDGE ({frame}, lambda {lam}): own-rate + downstream + baseline == 100·ΔEDGE exactly",
              worst_id < 1e-9, f"max |identity error| {worst_id:.2e}", pairs)
    rows.sort(key=lambda r: (-abs(r["delta"]), r["state"], r["card"]))
    for r in rows:
        dom = max((("own rate", abs(r["term_own_rate"])), ("downstream", abs(r["term_downstream"])),
                   ("baseline", abs(r["term_baseline"]))), key=lambda x: x[1])[0]
        r["dominant_term"] = dom
    dom_counts = Counter(r["dominant_term"] for r in rows)
    return {"frame": frame, "lambda": lam, "horizons": list(HORIZON_MIX), "policy": "argmax (the shipped EDGE)",
            "pairs_compared": pairs, "integers_changed": changed, "abs_delta_histogram": dict(hist),
            "max_abs_delta": max((abs(r["delta"]) for r in rows), default=0),
            "hands": len(s0.model.states), "hands_with_any_change": hands_changed,
            "hands_top_card_changed_solver_order": top_solver, "hands_top_card_changed_integer_order": top_int,
            "cards_whose_own_odds_changed": own_changed, "cards_only_folded": only0, "cards_only_frame": only1,
            "dominant_term_of_changed_integers": dict(dom_counts), "patch_calls": dict(st),
            "top20": rows[:20]}, s0, s1


def edge_nogi_control(g, checks):
    """In no-gi the folded scalar IS the frame cell (tech_rate docstring): the patch must move nothing."""
    from solve_edge_values import HORIZON_MIX, Opts, solve_mixture
    s0 = solve_mixture(g, 2.0, HORIZON_MIX, Opts(frame="nogi"))
    with frame_rate_patch():
        s1 = solve_mixture(g, 2.0, HORIZON_MIX, Opts(frame="nogi"))
    n = sum(len(s0.q[s]) for s in s0.q)
    d = max(abs(r0["q"] - r1["q"]) for s in s0.q for r0, r1 in zip(s0.q[s], s1.q[s]))
    same = all(s0.edge[s] == s1.edge[s] for s in s0.q)
    checks.ok("S3 control: in no-gi the frame-rate patch leaves every EDGE value bit-identical",
              same and d == 0.0 and n > 1000, f"{n} cards, max |dq| {d}", n)
    return {"cards": n, "max_abs_dq": d, "integers_identical": same}, s0


def _js_round(v):
    import math
    return int(math.floor(v + 0.5)) + 0


def app_gi_at_rest(g, s_nogi, s_gi_folded, s_gi_frame, checks):
    """What the APP prints in gi today, at rest (no drilling, no opponent resistance): the no-gi
    table's line evaluated at the gi rate, `e0 + (p_gi - p0)*c1 - shift` (moveEdge/_evShift/_evP0,
    app.src.jsx), with the wire's integer attempt percents and Math.round. Compared with the gi solve
    under both pricings, card by card, joined on (state, category, technique)."""
    def rate(t, fr):
        rb = t.get("successRateByRuleset") or {}
        v = rb.get(fr) if rb.get(fr) is not None else t.get("successRate")
        return None if v is None else v / 100.0
    cmp = Counter()
    d_frame, d_fold = [], []
    top_same = top_n = no_value = 0
    for s in s_nogi.model.states:
        nog = {}
        for r in s_nogi.q[s]:
            key = (r["cat"], r["target"])
            if key in nog:
                nog[key]["att"] += r["attempt"]
            else:
                nog[key] = {"e0": s_nogi.edge[s][r["name"]], "c1": int(round(100.0 * (r["A"] - r["B"]))),
                            "att": r["attempt"], "tech": _tech(g, *key)}
        num = den = 0.0
        for key, x in nog.items():
            p0, p = rate(x["tech"], "nogi"), rate(x["tech"], "gi")
            if p0 is None or p is None:
                continue
            a = int(round(100 * x["att"]))
            num += a * (p - p0) * x["c1"]
            den += a
        shift = num / den if den else 0.0
        app, fr, fo = {}, {}, {}
        for r in s_gi_frame.q[s]:
            key = (r["cat"], r["target"])
            x = nog.get(key)
            if x is None:
                no_value += 1
                continue
            v = x["e0"] + (rate(x["tech"], "gi") - rate(x["tech"], "nogi")) * x["c1"] - shift
            app[key] = (_js_round(v), rate(x["tech"], "gi"), r["attempt"], r["name"])
            fr[key] = s_gi_frame.edge[s][r["name"]]
            fo[key] = s_gi_folded.edge[s][r["name"]]
        for key in app:
            d_frame.append(app[key][0] - fr[key])
            d_fold.append(app[key][0] - fo[key])
        if app:
            order = lambda val: min(app, key=lambda k: (-val[k], -app[k][1], -app[k][2], app[k][3]))
            top_n += 1
            top_same += order({k: v[0] for k, v in app.items()}) == order(fr)
    d_frame, d_fold = np.array(d_frame), np.array(d_fold)
    checks.ok("S3 app-in-gi comparison covered the dealt gi cards", d_frame.size > 1000,
              f"{d_frame.size} cards valued, {no_value} gi cards with no table value", int(d_frame.size))
    hist = lambda d: {"0": int((d == 0).sum()), "1": int((np.abs(d) == 1).sum()), "2-4": int(((np.abs(d) >= 2) & (np.abs(d) <= 4)).sum()),
                      "5-9": int(((np.abs(d) >= 5) & (np.abs(d) <= 9)).sum()), ">=10": int((np.abs(d) >= 10).sum())}
    return {"what": "the integer the app prints in gi at rest = round(e0 + (p_gi − p0)·c1 − shift) from the no-gi table",
            "cards_valued": int(d_frame.size), "gi_cards_with_no_table_value": no_value,
            "vs_gi_frame_solve": {"abs_diff_histogram": hist(d_frame), "max_abs_diff": int(np.abs(d_frame).max()),
                                  "mean_abs_diff": float(np.abs(d_frame).mean())},
            "vs_gi_folded_solve": {"abs_diff_histogram": hist(d_fold), "max_abs_diff": int(np.abs(d_fold).max()),
                                   "mean_abs_diff": float(np.abs(d_fold).mean())},
            "hands_top_card_same_as_frame_solve": top_same, "hands_compared": top_n,
            "caveat": "at rest: moveChance = the gi rate with no drilling and no aiMod; aiMod is uniform across a hand "
                      "and the shift removes its mean, so it re-ranks only by slope (c1 − c̄1)"}


def _deck_tech(g):
    out = {}
    for cat in ("transitions", "submissions"):
        for key, node in g[cat].items():
            if key.endswith("/attacker") and node.get("name"):
                out[node["name"] + "|Attacker"] = (cat, key[:-len("/attacker")])
    return out


def compare_flow(g, checks, frame="gi"):
    import solve_flow
    res = {}
    for label, patched, fr in (("folded", False, frame), ("frame", True, frame), ("nogi", False, "nogi")):
        path = work_dir() / f"flow_{fr}_{label}.json"
        buf = io.StringIO()
        with redirect_stdout(buf):
            if patched:
                with frame_rate_patch():
                    rc = solve_flow.main(["--frame", fr, "--top", "40", "--json", str(path)])
            else:
                rc = solve_flow.main(["--frame", fr, "--top", "40", "--json", str(path)])
        require(rc == 0 and path.exists(), f"solve_flow --json ({label}) failed")
        res[label] = json.loads(path.read_text())
    c, bq = res["nogi"], res["frame"]
    gn, gq = dict(zip(c["decks"], c["grad"])), dict(zip(bq["decks"], bq["grad"]))
    both = sorted(set(gn) & set(gq))
    tn, tq = {r["deck"] for r in c["top"]}, {r["deck"] for r in bq["top"]}
    browser_vs = {"what": "the browser FLOW for a gi player uses cal.ev (no-gi hands) and cal.successRate (folded) — "
                          "i.e. the no-gi FLOW; compared with a frame-correct gi FLOW",
                  "decks_common": len(both), "decks_only_nogi": len(set(gn) - set(gq)), "decks_only_gi": len(set(gq) - set(gn)),
                  "spearman_linear_gain_common": correlation([gn[k] for k in both], [gq[k] for k in both]),
                  "top40_overlap": len(tn & tq), "gi_frame_top40_not_in_nogi_top40": sorted(tq - tn),
                  "v0_nogi": c["v0"], "v0_gi_frame": bq["v0"]}
    a, b = res["folded"], res["frame"]
    ga, gb = dict(zip(a["decks"], a["grad"])), dict(zip(b["decks"], b["grad"]))
    checks.ok("S3 FLOW: both pricings score the same deck set (id join, set equality)", set(ga) == set(gb),
              f"{len(ga)} vs {len(gb)} decks", len(ga))
    keys = sorted(set(ga) & set(gb))
    rho = correlation([ga[k] for k in keys], [gb[k] for k in keys])
    ta = {r["deck"]: r for r in a["top"]}
    tb = {r["deck"]: r for r in b["top"]}
    dt = _deck_tech(g)

    def row(k, inside):
        r = {"deck": k, "lin_gain_folded": ga[k] * 0.15, "lin_gain_frame": gb[k] * 0.15,
             "exact_gain": (tb if inside == "frame" else ta)[k]["gain"]}
        if k in dt:
            r["rates"] = _rates(g, *dt[k])
        return r
    enter = sorted((row(k, "frame") for k in set(tb) - set(ta)), key=lambda r: -r["exact_gain"])
    leave = sorted((row(k, "folded") for k in set(ta) - set(tb)), key=lambda r: -r["exact_gain"])
    ba = {r["deck"] for r in a["backfiring"]}
    bb = {r["deck"] for r in b["backfiring"]}
    return {"frame": frame, "lambda": a["lam"], "H": a["H"], "decks": len(keys),
            "v0_folded": a["v0"], "v0_frame": b["v0"],
            "spearman_linear_gain_all_decks": rho, "top40_overlap": len(set(ta) & set(tb)),
            "entering_top40": enter, "leaving_top40": leave,
            "backfiring_folded": len(ba), "backfiring_frame": len(bb),
            "backfiring_entering": sorted(bb - ba), "backfiring_leaving": sorted(ba - bb),
            "route": f"solve_flow.main(['--frame', '{frame}', '--top', '40', '--json', <scratch>]) in-process, "
                     "once plain and once inside frame_rate_patch",
            "browser_flow_for_a_gi_player": browser_vs}


def v0_attribution(checks):
    """Prop A on the H = infinity proxy of FLOW's V0 (uniform over live MY-turn states, value
    q_W − 2 q_L): which cards carry the folded -> frame change, exactly."""
    k0, k1 = load_kernel("gi", "shipped", "shipped"), load_kernel("gi", "shipped", "frame", graph=load_kernel("gi", "shipped", "shipped").graph)
    at = Attribution(k0, k1, ("W", "L", "D"))
    d0 = np.zeros(k0.n_t)
    live = [k0.index[s] for s in k0.role_nodes if s in k0.live]
    d0[live] = 1.0 / len(live)
    g = np.array([1.0, -2.0, 0.0])
    b0, b1, total, total2, parts = at.explain(g, [(adjoint(k0, d0), adjoint(k1, d0))])
    keys, c1, c2 = parts[0]
    delta = float(d0 @ (b1 - b0))
    checks.ok("S3 Prop A: the V0 proxy change is the exact sum of card contributions (A1 and A2)",
              abs(c1.sum() - delta) < 1e-12 and abs(c2.sum() - delta) < 1e-12,
              f"Δ {delta:.6f}; |Σ−Δ| {abs(c1.sum() - delta):.1e} / {abs(c2.sum() - delta):.1e}", len(keys))
    order = sorted(range(len(keys)), key=lambda i: (-abs(c1[i]), i))
    top = [{**card_info(k0, k1, keys[i]), "contribution": float(c1[i])} for i in order[:10]]
    return {"set": "uniform over live role-nodes, my turn; value q_W − 2·q_L at H = ∞ (FLOW solves H = 11)",
            "v0_proxy_folded": float(d0 @ b0), "v0_proxy_frame": float(d0 @ b1), "delta": delta,
            "top10_cards": top, "remainder_other_cards": delta - sum(r["contribution"] for r in top),
            "n_cards_nonzero": int(np.sum(np.abs(c1) > 1e-15))}


def write_join(path):
    with redirect_stdout(io.StringIO()):
        from _geometry_methods import load_shipped_layout
        lay = load_shipped_layout()
    node_hub = {}
    for cat in ("positions", "transitions", "submissions"):
        for hub, rec in lay[cat].items():
            node_hub[rec["layout_id"]] = hub
    lex, lsha = load_lexicon(VOCAB_PATH)
    Path(path).write_text(json.dumps({"node_hub": node_hub, "sub_class": lex}, sort_keys=True))
    return node_hub, lex, lsha


def reweight(K, wire_hands, wire_states):
    """The kernel's OWN cells with the wire's attempt shares: new pi(card) = wire share of its
    (category, technique) in the actor's wire hand, split over duplicate listings by authored pi.
    A destination the wire does not hold becomes lost mass (a draw, 1 ply), as in the browser."""
    k = object.__new__(Kernel)
    k.__dict__.update(K.__dict__)
    for attr in ("_lu", "_s2_keys", "_s2_act_index"):
        k.__dict__[attr] = None
    acts = K.actions
    tot = defaultdict(float)
    for a in acts:
        tot[(a["t"], a["cat"], a["target"])] += a["pi"]
    newpi = np.empty(len(acts))
    cnt = Counter()
    for i, a in enumerate(acts):
        hand = wire_hands.get(a["role_node"])
        if hand is None:
            newpi[i] = a["pi"]
            cnt["actor_not_on_wire"] += 1
            continue
        w = hand.get((a["cat"], a["target"]))
        if w is None:
            newpi[i] = 0.0
            cnt["kernel_card_not_on_wire"] += 1
            continue
        newpi[i] = w * a["pi"] / tot[(a["t"], a["cat"], a["target"])]
    c = K.cells.copy()
    real = c["act"] >= 0
    old = np.array([a["pi"] for a in acts])
    f = newpi[c["act"][real]] / old[c["act"][real]]
    c["mass"][real] = c["mass"][real] * f
    c["wcw"][real] = c["wcw"][real] * f
    on = np.array([s in wire_states for s in K.role_nodes])
    tr = c["dst"] >= 0
    lost = tr & on[c["src"] % K.n_r] & ~on[np.where(tr, c["dst"], 0) % K.n_r]
    c["dst"][lost] = -1 - ID
    c["plies"][lost] = 1
    c["fin"][lost] = -1
    k.cells = c
    k.actions = [dict(a, pi=float(p)) for a, p in zip(acts, newpi)]
    k._build_matrices()
    from _kernel import ROLL_SEEDS
    if all(s in k.index for s in ROLL_SEEDS):
        k._reach()
    return k, dict(cnt), int(lost.sum())


def run_node(join, rule, mask, out):
    import shutil
    import subprocess
    require(shutil.which("node") is not None, "node is not on PATH: the zero-wire-byte route (S3 part 2) needs it")
    require(WIRE_PATH.exists(), f"the emitted wire is absent ({WIRE_PATH.relative_to(REPO)}, gitignored): run "
            "`python3 scripts/regenerate_neural_data.py` first")
    require(NODE_SCRIPT.exists(), f"the reference script is missing: {NODE_SCRIPT}")
    p = subprocess.run(["node", str(NODE_SCRIPT), str(REPO), str(join), str(out), rule, mask],
                       capture_output=True, text=True, timeout=900)
    require(p.returncode == 0, f"node {rule}/{mask} failed: {p.stderr[-600:]}")
    return json.loads(Path(out).read_text()), p.stdout.strip()


def compare_wire(K, W, lex, checks, tag):
    states = list(W["states"])
    require(states and all(s in K.index for s in states), f"{tag}: wire states outside the kernel", JoinError)
    wset = set(states)
    wire_hands = {}
    for s, rows in W["hands"].items():
        h = wire_hands.setdefault(s, {})
        for ty, hub, share in rows:
            h[(ty, hub)] = h.get((ty, hub), 0.0) + share
    ker = defaultdict(lambda: defaultdict(float))
    for a in K.actions:
        if a["performer"] == "me":
            ker[K.labels[a["t"]][0]][(a["cat"], a["target"])] += a["pi"]
    mem_diff, only_wire, only_ker, share_max, share_n = [], 0, 0, 0.0, 0
    for s in states:
        wk, kk = set(wire_hands.get(s, {})), set(ker[s])
        if wk != kk:
            mem_diff.append({"state": s, "only_wire": sorted(map(list, wk - kk)), "only_kernel": sorted(map(list, kk - wk))})
        only_wire += len(wk - kk)
        only_ker += len(kk - wk)
        for key in wk & kk:
            share_n += 1
            share_max = max(share_max, abs(wire_hands[s][key] - ker[s][key]))
    Kw, cnt, lost = reweight(K, wire_hands, wset)
    rows = np.asarray(Kw.Q.sum(axis=1)).ravel() + np.asarray(Kw.R.sum(axis=1)).ravel()
    idx_w = np.array([K.index[s] for s in states])
    tidx = np.concatenate([idx_w, K.n_r + idx_w])
    row_err = float(np.abs(rows[tidx] - 1).max())
    Bw, _ = Kw.absorption()
    Bfw, _ = Kw.exit_law()
    B0, _ = K.absorption()
    Bf0, _ = K.exit_law()
    cols = W["columns"]
    groups_w = column_groups(Kw.fin_cols, Kw.fin_meta(), lex)
    groups_0 = column_groups(K.fin_cols, K.fin_meta(), lex)

    def grouped(Bf, groups):
        out = np.zeros((Bf.shape[0], len(cols) - 1))
        at = {c: i for i, c in enumerate(cols[:-1])}
        for j, (p, cls) in enumerate(groups):
            out[:, at[f"{p}|{cls}"]] += Bf[:, j]
        return out
    Gw, G0 = grouped(Bfw, groups_w), grouped(Bf0, groups_0)
    Ew = cell_moments(Kw, Kw.cells["plies"])[0]
    E0 = cell_moments(K, K.cells["plies"])[0]
    js = np.array([W["states"][s]["M"] for s in states] + [W["states"][s]["T"] for s in states])
    nC = len(cols) - 1
    me = [i for i, c in enumerate(cols[:-1]) if c.startswith("me|")]
    js_q = js[:, me].sum(axis=1)
    err_q_rw = float(np.abs(js_q - Bw[tidx, 0]).max())
    err_x_rw = float(np.abs(js[:, :nC] - Gw[tidx]).max())
    err_e_rw = float(np.abs(js[:, nC] - Ew[tidx]).max())
    exact_ok = only_wire == 0 and row_err < 1e-12
    checks.ok(f"{tag} browser route == kernel with the wire's attempt shares (committor, exit-by-class, plies)",
              exact_ok and max(err_q_rw, err_x_rw) < 1e-11 and err_e_rw < 1e-9,
              f"{len(states)} states x 2 turns; max err q {err_q_rw:.2e}, exit {err_x_rw:.2e}, plies {err_e_rw:.2e}; "
              f"wire-only cards {only_wire}, row error {row_err:.1e}", js.size)
    dq = js_q - B0[tidx, 0]
    tvx = 0.5 * (np.abs(js[:, :nC] - G0[tidx]).sum(axis=1) + np.abs((1 - js[:, :nC].sum(axis=1)) - B0[tidx, 2]))
    de = js[:, nC] - E0[tidx]
    worst = np.argsort(-np.abs(dq))[:5]
    lab2 = [f"{s}@M" for s in states] + [f"{s}@T" for s in states]
    ya = {}
    if Kw.__dict__.get("reach_t") is not None:
        y = yaglom(Kw, m_operator(Kw), Bw, checks, tag + " (wire-share kernel)")
        jr = [W["yaglomState"][s][side] for side in ("M", "T") for s in states]
        reach = np.concatenate([Kw.reach_t[idx_w], Kw.reach_t[K.n_r + idx_w]])
        jr_r = np.array([x for x, ok_ in zip(jr, reach) if ok_ and x is not None], float)
        ya = {"limit_wire_kernel": y["limit_W"], "browser_H60_min": float(jr_r.min()), "browser_H60_max": float(jr_r.max()),
              "max_abs_browser_vs_limit": float(np.abs(jr_r - y["limit_W"]).max()), "n": int(jr_r.size)}
        checks.ok(f"{tag} browser Yaglom ratio (H = 60) == ψ·q_W of the wire-share kernel",
                  ya["max_abs_browser_vs_limit"] < 1e-9, f"{ya}", int(jr_r.size))
    v0 = {}
    if W.get("flowV0_shipped") is not None:
        def flow_v0(k):
            vw, vl = k.finite_horizon(11)
            return float(np.mean(vw[idx_w] - 2.0 * vl[idx_w]))
        v0 = {"browser_ngFlowV0": W["flowV0_shipped"], "wire_share_kernel_H11": flow_v0(Kw), "authored_kernel_H11": flow_v0(K),
              "set": "uniform over the wire's states, my turn, V = P(win in 11 plies) − 2·P(loss in 11 plies) (FLOW's V0 at zero drilling)"}
        v0["browser_minus_wire_share"] = v0["browser_ngFlowV0"] - v0["wire_share_kernel_H11"]
        v0["relative_gap_browser_vs_authored"] = (v0["browser_ngFlowV0"] - v0["authored_kernel_H11"]) / abs(v0["authored_kernel_H11"])
        checks.ok(f"{tag} FLOW V0 in the browser == the wire-share kernel's H = 11 value", abs(v0["browser_minus_wire_share"]) < 1e-12,
                  f"{v0}", 1)
        # Prop A on the H = infinity proxy: which ROUNDED shares move the value, exactly
        at = Attribution(K, Kw, ("W", "L", "D"))
        d0 = np.zeros(K.n_t)
        d0[idx_w] = 1.0 / idx_w.size
        g2 = np.array([1.0, -2.0, 0.0])
        b0_, b1_, _t, _t2, parts = at.explain(g2, [(adjoint(K, d0), adjoint(Kw, d0))])
        keys, c1, _c2 = parts[0]
        dl = float(d0 @ (b1_ - b0_))
        checks.ok(f"{tag} Prop A: the rounding's effect on the V0 proxy is the exact sum of its cards",
                  abs(c1.sum() - dl) < 1e-12, f"Δ {dl:.6f}, |Σ−Δ| {abs(c1.sum() - dl):.1e}", len(keys))
        order = sorted(range(len(keys)), key=lambda i: (-abs(c1[i]), i))
        v0["rounding_attribution_H_inf_proxy"] = {
            "delta": dl, "top8": [{**card_info(K, Kw, keys[i]), "contribution": float(c1[i])} for i in order[:8]],
            "remainder": dl - float(sum(c1[i] for i in order[:8])), "cards_nonzero": int(np.sum(np.abs(c1) > 1e-15))}
        # the mechanism, as a whole-structure identity: the wire's share is the kernel's origin-
        # renormalised share rounded to a whole percent (Python round, half-to-even), renormalised
        # NB from the Model's own weights (what the emitter rounds), NOT the kernel's re-divided pi:
        # an exact 2.5% is 0.025000000000000005 there and rounds UP where the wire rounds it DOWN.
        mw = defaultdict(lambda: defaultdict(float))
        for st_, hand in zip(K.model.states, K.model.hands):
            for a_ in hand:
                mw[st_][(a_.cat, a_.target)] += a_.weight

        def rounded(scale):
            out = {}
            for st in states:
                raw = {key: int(round(scale * v)) for key, v in mw[st].items()}
                tot = sum(raw.values())
                out[st] = {key: (v / tot if tot else 0.0) for key, v in raw.items()}
            return out
        pct = rounded(100)
        err = max(abs(pct[st][key] - wire_hands[st][key]) for st in states for key in wire_hands[st])
        checks.ok(f"{tag} the wire's attempt shares ARE the kernel's shares rounded to whole percents",
                  err < 1e-12, f"max |diff| {err:.1e} over {share_n} cards", share_n)
        Kp, _c, _l = reweight(K, rounded(1000), wset)
        v0["permille_wire_kernel_H11"] = flow_v0(Kp)
        v0["relative_gap_permille_vs_authored"] = (v0["permille_wire_kernel_H11"] - v0["authored_kernel_H11"]) / abs(v0["authored_kernel_H11"])
        Bp, _ = Kp.absorption()
        v0["permille_max_abs_dq"] = float(np.abs(Bp[tidx, 0] - B0[tidx, 0]).max())
        kt = "kimura-trap/bottom"
        if kt in wire_hands:
            v0["kimura_trap_bottom_cards"] = {"wire": len(wire_hands[kt]), "kernel": len(ker[kt]),
                                              "authored_listings": len(K.graph["positions"][kt].get("transitions") or [])}
    return {"flow_v0": v0, "states": len(states), "kernel_role_nodes_not_on_wire": sorted(set(K.role_nodes) - wset),
            "membership_differences": {"states": len(mem_diff), "cards_only_on_wire": only_wire,
                                       "cards_only_in_kernel": only_ker, "examples": mem_diff[:6]},
            "attempt_share_rounding": {"cards_compared": share_n, "max_abs_share_diff": share_max},
            "reweight_counts": cnt, "lost_destination_cells": lost,
            "vs_wire_share_kernel": {"max_err_committor": err_q_rw, "max_err_exit_by_class": err_x_rw,
                                     "max_err_E_plies": err_e_rw},
            "vs_authored_kernel": {"max_abs_dq": float(np.abs(dq).max()), "mean_abs_dq": float(np.abs(dq).mean()),
                                   "worst_states": [(lab2[i], float(dq[i])) for i in worst],
                                   "max_exit_by_class_TV": float(tvx.max()), "mean_exit_by_class_TV": float(tvx.mean()),
                                   "max_abs_dE_plies": float(np.abs(de).max()), "mean_abs_dE_plies": float(np.abs(de).mean()),
                                   "spearman_q": correlation(js_q, B0[tidx, 0])},
            "yaglom": ya, "node": {k: W[k] for k in ("coverage", "iterations", "yaglom", "node",
                                                     "control_myHorizon11_vs_ngFlowBackward")}}


def price_candidates(node_hub, lex, checks, gi_frame_solves=None, yag_pair=(0.5, 0.5)):
    import copy
    import payload_probe as pp
    buf = io.StringIO()
    probe_out = work_dir() / "payload_probe.json"
    with redirect_stdout(buf):
        rc = pp.main(["--json", str(probe_out)])
    require(rc == 0, "payload_probe failed")
    probe = json.loads(probe_out.read_text())
    level = pp.gz_level()
    base = json.loads(WIRE_PATH.read_text())
    b0 = pp.gz(base, level)
    rows = []

    def add(name, fn, note):
        w = copy.deepcopy(base)
        n = fn(w)
        rows.append({"candidate": name, "nodes_touched": n, "gzip_delta": pp.gz(w, level) - b0, "note": note})

    def classes(w):
        n = 0
        subs = [x for x in w["nodes"] if x.get("ty") == "submissions"]
        for x in subs:
            hub = node_hub.get(x["id"])
            c = lex.get(hub) if hub else None
            if c:
                x["br"] = CLASS_CODE[c]
                n += 1
        require(n == len(subs), f"class join covered {n} of {len(subs)} submission nodes", JoinError)
        return n
    add("body-region class per submission, INJECTIVE 1-char code", classes,
        "the probe's c[0] maps SHOULDER and SPINE/COMPRESSION to the same 'S'")
    idx = {x["id"]: i for i, x in enumerate(base["nodes"])}
    hub_idx = {("positions" if k.startswith("Positions/") else "submissions" if k.startswith("Submissions/")
                else "transitions", h): idx[k] for k, h in node_hub.items() if k in idx}
    from solve_edge_values import Model, Opts
    K = load_kernel("gi", "shipped")
    m = Model(K.graph, Opts(frame="gi"))

    def gi_hands(w):
        n = miss = 0
        for s, h in zip(m.states, m.hands):
            hub, role = s.rsplit("/", 1)
            pi = hub_idx.get(("positions", hub))
            if pi is None or not h:
                miss += pi is None
                continue
            agg = defaultdict(float)
            for a in h:
                j = hub_idx.get((a.cat, a.target))
                require(j is not None, f"gi card {a.cat}/{a.target} has no wire node", JoinError)
                agg[j] += a.weight
            order = sorted(agg)
            w["nodes"][pi].setdefault("cal", {}).setdefault("evGi", {})[role] = [order, [int(round(100 * agg[j])) for j in order]]
            n += 1
        require(n > 250 and miss == 0, f"gi hands joined {n}, missing position nodes {miss}", JoinError)
        return n
    add("gi hands for the in-browser route (node indexes + attempt %, no EDGE)", gi_hands,
        "cal.ev is solved in no-gi only (evFrame); a gi committor from the wire needs gi hands")
    if gi_frame_solves:
        def gi_table(w):
            """cal.ev's own layout (build_move_edge): [nodeIdxs, attempt%, [e0,c1,...] per evLam], from the
            gi solve at frame rates; duplicate listings of one technique are deduped and their shares summed."""
            n = 0
            sols = gi_frame_solves
            for st in sols[0].model.states:
                hub, role = st.rsplit("/", 1)
                pi = hub_idx.get(("positions", hub))
                if pi is None or not sols[0].q[st]:
                    continue
                by_lam = [{r["name"]: r for r in sol.q[st]} for sol in sols]
                rows_, att = {}, {}
                for r0 in sols[0].q[st]:
                    j = hub_idx.get((r0["cat"], r0["target"]))
                    require(j is not None, f"gi table: {r0['target']} has no wire node", JoinError)
                    coeffs = []
                    for k, sol in enumerate(sols):
                        r = by_lam[k][r0["name"]]
                        coeffs += [sol.edge[st][r0["name"]], int(round(100.0 * (r["A"] - r["B"])))]
                    if j in rows_:
                        att[j] += r0["attempt"]
                        continue
                    rows_[j], att[j] = coeffs, r0["attempt"]
                order = sorted(rows_)
                w["nodes"][pi].setdefault("cal", {}).setdefault("evGi", {})[role] = (
                    [order, [int(round(att[j] * 100)) for j in order]]
                    + [[c for j in order for c in rows_[j][2 * k:2 * k + 2]] for k in range(len(sols))])
                n += 1
            return n
        add("gi EDGE table at frame rates (cal.ev's layout, 3 lambdas) — the full fix", gi_table,
            "what shipping a gi table would cost; includes the gi hands")
    mn = Model(load_kernel("nogi", "shipped").graph, Opts(frame="nogi"))

    def permille(w):
        n = 0
        for st, h in zip(mn.states, mn.hands):
            hub, role = st.rsplit("/", 1)
            pi = hub_idx.get(("positions", hub))
            blk = (((w["nodes"][pi].get("cal") or {}).get("ev") or {}).get(role)) if pi is not None else None
            if not blk or not h:
                continue
            share = defaultdict(float)
            for a in h:
                share[hub_idx[(a.cat, a.target)]] += a.weight
            require([int(round(100 * share[j])) for j in blk[0]] == blk[1],
                    f"cal.ev[{st}] percents are not the Model shares rounded — the join is wrong", JoinError)
            blk[1] = [int(round(1000 * share[j])) for j in blk[0]]
            n += 1
        require(n > 250, f"permille rewrite touched only {n} hands", JoinError)
        return n
    add("cal.ev attempt shares in permille instead of percent (every hand re-joined and verified)", permille,
        "the rounding fix; its effect on FLOW V0 is measured in part 2")
    def yag(w):
        w["yag"] = [round(x, 4) for x in yag_pair]
        return 1
    add("the clock constant P(I finish | long roll), both rules, one file-level pair", yag,
        "optional: the browser recovers it by a 60-ply recursion (part 2) for zero bytes")
    Kh = load_kernel(*HEADLINE[:3], origin=HEADLINE[3])
    plies = cell_moments(Kh, Kh.cells["plies"])[0]

    def tempo(w):
        n = 0
        for x in w["nodes"]:
            if x.get("ty") != "positions":
                continue
            v = []
            for role in ("top", "bottom"):
                i = Kh.index.get(f"{x.get('posId')}/{role}")
                v.append(None if i is None else int(round(plies[i])))
            x.setdefault("sem", {})["tp"] = v
            n += 1
        return n
    add("expected plies per seat, my turn (2 ints per position hub, precomputed)", tempo,
        "only needed if the browser does NOT iterate; the zero-byte route computes it")
    for r in rows:
        checks.ok(f"S3 priced: {r['candidate']}", r["nodes_touched"] > 0, f"{r['gzip_delta']:+d} B gzip", r["nodes_touched"])
    return {"eager_file": "graph-data.json", "base_gzip": b0, "gzip_level": level,
            "lead_probe": probe["rows"], "lead_probe_skipped": probe.get("skipped"), "gs2_rows": rows,
            "recompute": f"python3 -B scripts/semantics/payload_probe.py; {COMMAND} --consequences"}


def consequences(checks):
    base = load_kernel(*HEADLINE[:3], origin=HEADLINE[3])
    g = base.graph
    art = {"schema": "gs-2/scalars_consequences/v1 (item S3)", "recompute": f"{COMMAND} --consequences",
           "which_game": "the corpus's game (gs-shared.md §3); the browser route rebuilds THE SAME game from the wire",
           # keys are repo-relative paths (and one `scratch:` path outside the repo), so
           # verify_all.py can re-hash every one of them
           "source_sha256": {"graph.json": sha(GRAPH_PATH),
                             "source/quartz/static/neural/graph-data.json": sha(WIRE_PATH),
                             "tests/artifacts/semantics/vocabulary.json": sha(VOCAB_PATH),
                             "scripts/semantics/scalars.py": sha(Path(__file__)),
                             "scripts/semantics/_kernel.py": sha(HERE / "_kernel.py"),
                             "scripts/solve_edge_values.py": sha(HERE.parent / "solve_edge_values.py"),
                             "scripts/solve_flow.py": sha(HERE.parent / "solve_flow.py"),
                             "neural/src/flow.src.js": sha(REPO / "neural/src/flow.src.js"),
                             "neural/src/app.src.jsx": sha(REPO / "neural/src/app.src.jsx"),
                             "scripts/semantics/wire_semantics.mjs": sha(NODE_SCRIPT)}}
    # part 1
    nogi_ctrl, s_nogi = edge_nogi_control(g, checks)
    edge, s_fold, s_frame = compare_edge(g, checks)
    p1 = {"patch_check": patch_effect_check(g, checks), "nogi_control": nogi_ctrl, "edge": edge,
          "app_in_gi_today": app_gi_at_rest(g, s_nogi, s_fold, s_frame, checks),
          "flow": compare_flow(g, checks), "v0_mechanism_prop_A": v0_attribution(checks)}
    art["part1_folded_rates_in_gi"] = p1
    # part 2
    join = work_dir() / "wire_join.json"
    node_hub, lex, lsha = write_join(join)
    require(lsha == art["source_sha256"]["tests/artifacts/semantics/vocabulary.json"], "lexicon hash moved mid-run")
    runs, timings = {}, {}
    for rule in ("shipped", "symmetric"):
        for mask in ("none", "nogi"):
            out = work_dir() / f"wire_{rule}_{mask}.json"
            W, line = run_node(join, rule, mask, out)
            emit(line)
            timings[f"{rule}/{mask}"] = W["wall_ms"]
            K = load_kernel("nogi", rule, "shipped", graph=g)
            runs[f"{rule}/{mask}"] = compare_wire(K, W, lex, checks, f"S3 wire {rule}/{mask}")
    art["part2_zero_wire_byte_route"] = {
        "kernel_compared": "load_kernel('nogi', rule, 'shipped') (origin on) — the wire's hands are cal.ev, solved in no-gi",
        "runs": runs,
        "recompute": f"{COMMAND} --consequences (runs `node scripts/semantics/wire_semantics.mjs` four times: rule x "
                     "ruleset mask; needs node on PATH and the emitted wire from `python3 scripts/regenerate_neural_data.py`)",
        "wall_times": "not in this artifact (non-deterministic); written to <work dir>/wire_timings.json"}
    (work_dir() / "wire_timings.json").write_text(json.dumps(timings, indent=1, sort_keys=True))
    # part 3
    from solve_edge_values import HORIZON_MIX, Opts, solve_mixture
    with frame_rate_patch():
        sols = [s_frame if lam == 2 else solve_mixture(g, float(lam), HORIZON_MIX, Opts(frame="gi")) for lam in (1, 2, 4)]
    ks = load_kernel("nogi", "shipped", graph=g)
    y_ship = yaglom(ks, m_operator(ks), ks.absorption()[0],
                    checks, "S3 nogi/shipped (authored)")["limit_W"]
    art["part3_payload"] = price_candidates(node_hub, lex, checks, sols, (0.5, y_ship))
    rr = {r["candidate"]: r["gzip_delta"] for r in art["part3_payload"]["gs2_rows"]}
    lp = {r["candidate"]: r["gzip_delta"] for r in art["part3_payload"]["lead_probe"]}
    pick = lambda d, word: next((v for k, v in d.items() if word in k), None)
    sym = runs["symmetric/none"]["vs_authored_kernel"]
    shp = runs["shipped/none"]["vs_authored_kernel"]
    art["part3_show_candidates"] = [
        {"card": "whose position is this", "quantity": "q̄(r) = ½[q_W(r,M) + q_W(r,T)], H = ∞, symmetric rule",
         "set": "live role-nodes; no-gi", "recompute": f"{COMMAND} --state <role-node>",
         "route_nogi": "zero wire bytes: rebuilt in the browser from cal.ev + cal.outcomes (part 2)",
         "browser_vs_kernel_max_abs": sym["max_abs_dq"], "with_permille_shares_bytes": pick(rr, "permille"),
         "route_gi": "NOT available from today's wire (cal.ev is solved in no-gi): gi hands",
         "gi_hands_bytes": pick(rr, "gi hands"), "precomputed_both_frames_bytes": pick(lp, "committor")},
        {"card": "how fast this ends", "quantity": "E[plies to the finish] per seat and turn (stay-put miss = 0 plies)",
         "set": "live role-nodes; no-gi", "recompute": f"{COMMAND} --state <role-node>",
         "route_nogi": "zero wire bytes (same iteration, one extra column)",
         "browser_vs_kernel_max_abs_plies": shp["max_abs_dE_plies"], "precomputed_bytes": pick(rr, "expected plies")},
        {"card": "what ends rolls here", "quantity": "exit law by body region x performer (K.exit_law grouped by gs-5's lexicon)",
         "set": "live role-nodes; no-gi", "recompute": f"{COMMAND} --state <role-node> --lexicon tests/artifacts/semantics/vocabulary.json",
         "route_nogi": "one char per submission, then computed in the browser",
         "class_code_bytes_injective": pick(rr, "INJECTIVE"), "class_code_bytes_lead_probe": pick(lp, "body-region"),
         "browser_vs_kernel_max_exit_TV": sym["max_exit_by_class_TV"], "precomputed_profile_bytes_upper_bound": pick(lp, "exit profile")},
        {"card": "the clock's effect", "quantity": "Yaglom limit P(I finish | the roll outlasts H plies), Prop F",
         "set": "transient states reachable from standing", "recompute": f"{COMMAND} --json (clock.<cfg>.yaglom_prop_F)",
         "value_symmetric": 0.5, "value_shipped_nogi_kernel": y_ship, "value_shipped_browser_wire": runs["shipped/none"]["yaglom"].get("limit_wire_kernel"),
         "route": "zero bytes (60-ply recursion in the browser) or a file-level constant", "constant_bytes": pick(rr, "clock constant")}]
    art["checks"] = {"passed": checks.count - len(checks.failures), "failed": len(checks.failures),
                     "compared": checks.compared}
    return art


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--json", nargs="?", const=str(DEFAULT_JSON), default=None)
    ap.add_argument("--full", action="store_true", help="also write per-state cards to <work dir>/scalars_full.json")
    ap.add_argument("--full-out", help="write the per-state cards (~22 MB) to this path (implies --full); never under tests/")
    ap.add_argument("--work-dir", help="directory for intermediates (default: <system temp>/gs2-scalars)")
    ap.add_argument("--state")
    ap.add_argument("--frame", default=HEADLINE[0], choices=("nogi", "gi"))
    ap.add_argument("--initiative", default=HEADLINE[1], choices=("symmetric", "shipped"))
    ap.add_argument("--rates", default=HEADLINE[2], choices=("shipped", "frame"))
    ap.add_argument("--origin", default="on", choices=("on", "off"))
    ap.add_argument("--lexicon", help="technique -> group JSON (flat, or gs-5's vocabulary format)")
    ap.add_argument("--consequences", nargs="?", const=str(CONSEQ_JSON), default=None,
                    help="item S3: folded-rate blast radius, the zero-wire-byte route, show-candidate pricing")
    a = ap.parse_args(argv)
    global _WORK
    if a.work_dir:
        _WORK = Path(a.work_dir)
    full_path = Path(a.full_out) if a.full_out else (work_dir() / "scalars_full.json" if a.full else None)
    if full_path is not None and (REPO / "tests") in full_path.resolve().parents:
        ap.error("--full-out must not be under tests/: the full cards are ~22 MB and never committed")
    lex, lsha = (load_lexicon(a.lexicon) if a.lexicon else (None, None))
    if a.selfcheck:
        return selfcheck()
    if a.consequences:
        checks = Checks()
        art = consequences(checks)
        text = dump(art)
        nbytes = len(text.encode("utf-8"))
        if checks.failures or nbytes >= ARTIFACT_LIMIT:
            emit(f"FAIL: {len(checks.failures)} failed checks {checks.failures[:8]}, {nbytes} bytes; NOT written")
            return 1
        Path(a.consequences).write_text(text, encoding="utf-8")
        emit(f"wrote {a.consequences}: {nbytes} bytes; {checks.count} checks passed, {checks.compared} comparisons")
        return 0
    if a.state:
        return state_card(a.state, (a.frame, a.initiative, a.rates, a.origin == "on"), lex)
    if a.json:
        checks = Checks()
        art, _R, _K, _hk = run_all(checks, lex, lsha, full_path)
        text = dump(art)
        if checks.failures:
            emit(f"FAIL: {len(checks.failures)} checks failed; artifact NOT written: {checks.failures[:10]}")
            return 1
        nbytes = len(text.encode("utf-8"))
        if nbytes >= ARTIFACT_LIMIT:
            emit(f"FAIL: artifact {nbytes} bytes >= {ARTIFACT_LIMIT}; NOT written")
            return 1
        Path(a.json).parent.mkdir(parents=True, exist_ok=True)
        Path(a.json).write_text(text, encoding="utf-8")
        emit(f"wrote {a.json}: {nbytes} bytes; {checks.count} checks passed, {checks.compared} comparisons")
        return 0
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
