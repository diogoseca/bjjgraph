#!/usr/bin/env python3
"""
THE ATLAS — one joined, cross-checked table of what every place means. (gs-1, item T3.)

WHAT THIS IS
  Every lane of the graph-semantics cell published per-place facts in its own artifact. CLAUDE.md
  §6.5: "when one question is answered in two places, one of them is already wrong". This file
  (1) JOINS them per position hub (all 133) and per role-node (all 266), in the headline
  configuration (nogi / symmetric / origin filter on, rates=shipped, H = inf) and in gi (gi /
  symmetric), strictly on ids, with set equality of every source's id set asserted against the
  kernel's; (2) runs CROSS-LANE DIFFERENTIALS wherever two lanes computed the same quantity by
  different code, plus a full-precision KERNEL recompute (this file's own code) as a third route;
  and (3) emits the per-hub SEMANTIC CARD fields as data.

SOURCES (read-only; sha256 recorded)
  gs-1 tests/artifacts/semantics/territories.json   phase side, map module, localized set
  gs-2 tests/artifacts/semantics/scalars.json       committor, clocked committor, tempo, hub exit laws, flags
  gs-3 tests/artifacts/semantics/geometry.json      exit-TV territory + robustness, ground coords, Q-process mass
  gs-4 tests/artifacts/semantics/flux.json          passage in won / lost rolls (TOP-k lists only)
  gs-5 tests/artifacts/semantics/naming.json        class shares, enrichment, names, R_C territories, cores
  gs-5 tests/artifacts/semantics/naming_cards.json  N3 cards (name, phrase, class)
  lead `python3 -B scripts/semantics/_kernel.py --structure` (printed text, parsed with anchored patterns)

ROUNDING, AND THE TOLERANCE IT IMPLIES (stated per differential, never guessed)
  gs-2, gs-3, gs-4 round to 6 SIGNIFICANT digits: |error| <= 5e-6 |v| per value.
  gs-5 rounds to 6 DECIMALS: |error| <= 5e-7 per value.
  gs-1 rounds to 12 significant digits. The lead's --structure prints 4 decimals (2 for steps).
  A differential's tolerance is the SUM of its operands' rounding bounds (+1e-12), computed per
  comparison; the kernel recompute is full precision. A pair of exact routes uses 1e-9.

ABSENCE IS NAMED, NEVER ZERO
  The 11 no-gi hubs unreachable from standing carry status UNREACHABLE_FROM_STANDING and null
  fields. A lane that stores only a TOP-k list (gs-4's passage) marks the rest ABSENT_TRUNCATED;
  the atlas's own kernel recompute of the same quantity (gs-4's definition, a different solver)
  supplies every value, and the listed ones are the differential. A field a lane does not store for
  a configuration is ABSENT_NOT_STORED with the reason.

USAGE
    python3 -B scripts/semantics/atlas.py              # build + all differentials; writes atlas.json
    python3 -B scripts/semantics/atlas.py --selfcheck  # the above, plus join / perturbation controls
Exit status is non-zero if ANY differential fails or any join is not a set equality.
"""
if __name__ == "__main__":
    import os as _os
    for _var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
        _os.environ.setdefault(_var, "1")

import argparse
import contextlib
import copy
import hashlib
import io
import json
import os
import re
import sys
import time

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.dirname(os.path.dirname(HERE))

import _kernel  # noqa: E402
from _kernel import load_kernel  # noqa: E402
from solve_edge_values import GRAPH_PATH  # noqa: E402

ART = os.path.join(REPO, "tests", "artifacts", "semantics")
OUT = os.path.join(ART, "atlas.json")
RECOMPUTE = "python3 -B scripts/semantics/atlas.py"
SOURCES = {"gs-1": "territories.json", "gs-2": "scalars.json", "gs-3": "geometry.json", "gs-4": "flux.json",
           "gs-5": "naming.json", "gs-5-cards": "naming_cards.json", "lexicon": "vocabulary.json"}
CONFIGS = {
    "headline": dict(frame="nogi", initiative="symmetric", origin=True, gs1="nogi/symmetric/origin-on",
                     gs2="nogi/symmetric/shipped/origin=on", gs3="nogi/symmetric/shipped", gs4="headline",
                     gs5="primary", lead="nogi/symmetric"),
    "gi": dict(frame="gi", initiative="symmetric", origin=True, gs1="gi/symmetric/origin-on",
               gs2="gi/symmetric/shipped/origin=on", gs3="gi/symmetric/shipped", gs4="gi",
               gs5="other_frame", lead="gi/symmetric"),
}
HORIZONS = (9, 10, 11, 12)
SEATS = ("TOP", "BOTTOM")
UNREACHABLE = "UNREACHABLE_FROM_STANDING"
TRUNCATED = "ABSENT_TRUNCATED"
NOT_STORED = "ABSENT_NOT_STORED"
EXACT_TOL = 1e-9
FLOOR_ROLE = 266
FLOOR_HUB = 133


# EVERY FIELD'S SOURCE. <cfg> = the lane's own key for the configuration (meta.configurations);
# "atlas kernel" = this file's full-precision recompute, which a differential ties to the lane value.
FIELDS = {
    "hubs.*.status": "atlas kernel: both role-nodes in K.reachable; UNREACHABLE_FROM_STANDING = zero Q-process mass (== gs-5 not_evaluable)",
    "hubs.*.committor.<SEAT>.q_bar": "gs-2 scalars.json states[<gs2>].rows[<hub>/<seat>].{M,T}[q_W], (M+T)/2; 6 sig. digits",
    "hubs.*.committor.<SEAT>.clocked_q_bar": "gs-2 scalars.json states[<gs2>].rows[<hub>/<seat>].{M,T}[clocked_W], (M+T)/2; H uniform 9..12 plies",
    "hubs.*.seat_advantage_top": "derived from gs-2 rows: q_bar(top) - q_bar(bottom) (Prop D: = 2 q_bar - 1 under the symmetric rule)",
    "hubs.*.tempo_E_plies.<SEAT>": "gs-2 scalars.json states[<gs2>].rows[<hub>/<seat>].{M,T}[E_plies], (M+T)/2: expected plies to the finish",
    "hubs.*.passage.{W,L}": "atlas kernel, gs-4's definition: P(roll visits the hub | it ends W / L), K.start('standing','me'); direct hitting solve",
    "hubs.*.passage.gs4_listed": "gs-4 flux.json configs[<gs4>].passage_hubs.{W,L} (TOP-16 by design; else ABSENT_TRUNCATED)",
    "hubs.*.territory_tv": "gs-3 geometry.json cases[<gs3>].clusterings.exit_tv.clusters (medoid id; label = the cell's accepted reading)",
    "hubs.*.territory_tv.robustness": "gs-3 geometry.json per_hub_claims.records (primary configuration only)",
    "hubs.*.phase.side": "gs-1 territories.json configs[<gs1>].splits.phase.guard_side_hubs (complement = passed/pinned)",
    "hubs.*.phase.robustness": "gs-1 territories.json phase_robustness[<gs1>].per_hub (headline only)",
    "hubs.*.localized_leg_set": "gs-1 territories.json configs[<gs1>].splits.localized.hubs",
    "hubs.*.map_module": "gs-1 territories.json map_equation[<gs1>].module_table[].members (headline only)",
    "hubs.*.q_mass": "atlas kernel: K.qprocess() mu summed over the hub's 4 transient states (== gs-3 hub_stationary_mass, gs-5 mu_time)",
    "hubs.*.ground_xy": "gs-3 geometry.json cases[<gs3>].shipped_ground_coordinates, joined through cases[<gs3>].hub_ids",
    "hubs.*.name.{card,phrase,card_class}": "gs-5 naming_cards.json hubs[<hub>].{name,phrase,class} (N3)",
    "hubs.*.name.n2r_best_name": "gs-5 naming.json hubs[<hub>].best_name (gi: names.by_configuration.other_frame.names)",
    "hubs.*.name.robustness_n3": "gs-5 naming.json hubs[<hub>].robustness_n3 (perturbation fraction + the three 'holds')",
    "hubs.*.class_share": "gs-5 naming.json hubs[<hub>].share: P(class | decided), hub start uniform over its 4 states; 6 decimals",
    "hubs.*.core_classes": "gs-5 naming.json hubs[<hub>].seat_core (== kernel R_fin support by finisher seat, differential)",
    "hubs.*.R_C": "gs-5 naming.json territories[<C>]['standing_me|ratio|<theta>'].members, theta in {2,3}; core/halo from gs-5 core_classes",
    "hubs.*.coherence_flagged_role_nodes": "gs-2 scalars.json coherence[<gs2>].disagreements (complete: flag counts match its totals)",
    "role_nodes.*.{q_W,q_L,clocked_W,E_plies}.{M,T}": "gs-2 scalars.json states[<gs2>].rows[<role>]; 6 sig. digits",
    "role_nodes.*.q_bar / seat_advantage": "derived from gs-2 rows: (M+T)/2; q_bar(r) - q_bar(flip r)",
    "role_nodes.*.passage": "atlas kernel (gs-4 definition, role-node = both turns) + gs-4 passage_roles TOP-15",
    "role_nodes.*.class_share_{me,them}": "gs-5 naming.json role_nodes[<role>].{me,them} (headline, reachable only)",
    "role_nodes.*.coherence": "gs-2 scalars.json coherence[<gs2>].disagreements[] (flagged) else not flagged",
    "role_nodes.*.phase_side": "gs-1 phase side of the role-node's hub",
    "cards.<hub>": "the item-3 semantic card: a projection of hubs.headline.<hub>, no new numbers",
}


def sig_bound(v, sig=6):
    """Rounding bound of a value printed to `sig` significant digits (0.5 ulp <= 5*10^-sig |v|)."""
    return 5.0 * 10.0 ** (-sig) * abs(float(v))


def dec_bound(nd=6):
    return 0.5 * 10.0 ** (-nd)


def _sig(x, digits=10):
    if x is None:
        return None
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    x = float(x)
    if not np.isfinite(x):
        return None
    return float("%.*g" % (digits, x))


def _clean(obj, digits=10):
    if isinstance(obj, dict):
        return {str(k): _clean(v, digits) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v, digits) for v in obj]
    if isinstance(obj, np.ndarray):
        return [_clean(v, digits) for v in obj.tolist()]
    if isinstance(obj, (bool, np.bool_, int, np.integer, float, np.floating)) or obj is None:
        return _sig(obj, digits)
    return obj


# --------------------------------------------------------------------------- #
# sources
# --------------------------------------------------------------------------- #
def load_sources():
    src, sha = {}, {}
    for lane, name in SOURCES.items():
        path = os.path.join(ART, name)
        if not os.path.exists(path):
            raise SystemExit("[atlas] source %s (%s) is missing — refusing a partial atlas" % (lane, name))
        raw = open(path, "rb").read()
        src[lane] = json.loads(raw)
        sha[lane] = dict(path="tests/artifacts/semantics/" + name, sha256=hashlib.sha256(raw).hexdigest())
    return src, sha


def lead_structure():
    """Parse the lead's `--structure` printout with ANCHORED patterns (print-before-anchoring: the
    exact lines were inspected with cat -A before these were written); refuse on any miss."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        _kernel.structure()
    text = buf.getvalue()
    out, cur = {}, None
    pats = {
        "P_I_finish": re.compile(r"^  from standing, me first, H=inf: P\(I finish\) ([0-9.]+)  P\(they finish\) ([0-9.]+)"),
        "E_steps": re.compile(r"^  expected steps to the finish from standing \(me first\): ([0-9.]+);"),
        "E_plies": re.compile(r"^  expected PLIES to the finish from standing \(me first\): ([0-9.]+) "),
        "clocked_P_I_finish": re.compile(r"^  CLOCKED \(maxMoves uniform 9\.\.12\), from standing, me first: P\(I finish\) ([0-9.]+)"),
    }
    for line in text.splitlines():
        m = re.match(r"^== (\S+)$", line)
        if m:
            cur = m.group(1)
            out[cur] = {}
            continue
        for key, pat in pats.items():
            m = pat.match(line)
            if m and cur is not None:
                out[cur][key] = float(m.group(1))
    for cfg in ("nogi/symmetric", "gi/symmetric"):
        if set(out.get(cfg, {})) != set(pats):
            raise SystemExit("[atlas] lead --structure parse: %s found %s of %s" % (cfg, sorted(out.get(cfg, {})), sorted(pats)))
    return out, dict(lines=len(text.splitlines()), values=sum(len(v) for v in out.values()))


# --------------------------------------------------------------------------- #
# the kernel recompute (this file's own code; full precision)
# --------------------------------------------------------------------------- #
class Recompute:
    def __init__(self, G, cfg, lexicon):
        c = CONFIGS[cfg]
        self.cfg = cfg
        K = self.K = load_kernel(c["frame"], c["initiative"], "shipped", graph=G, origin=c["origin"])
        B, res = K.absorption()
        if res > 1e-10:
            raise ArithmeticError("absorption residual %.3g" % res)
        self.qW, self.qL, self.qD = B[:, 0], B[:, 1], B[:, 2]
        self.clockedW = np.mean([K.finite_horizon(H)[0] for H in HORIZONS], axis=0)
        lu = K.fundamental()
        self.E_steps = lu.solve(np.ones(K.n_t))
        c_ = K.cells
        self.E_plies = lu.solve(np.bincount(c_["src"], weights=c_["mass"] * c_["plies"], minlength=K.n_t))
        # finisher columns -> class (the gs-5 lexicon, joined on the technique HUB ID) and raw type
        meta = K.fin_meta()
        classes = sorted({rec["body_region"]["class"] for rec in lexicon["techniques"].values() if "body_region" in rec})
        self.classes = classes
        cls = []
        for m in meta:
            rec = lexicon["techniques"].get(m["technique"] + "/attacker")
            if rec is None or "body_region" not in rec:
                raise SystemExit("[atlas] finisher %s has no lexicon class — refusing" % m["technique"])
            cls.append(rec["body_region"]["class"])
        self.fin_class = cls
        self.fin_type = [m["type"] for m in meta]
        self.fin_perf = [m["performer"] for m in meta]
        Bf, res = K.exit_law()
        if res > 1e-10:
            raise ArithmeticError("exit-law residual %.3g" % res)
        self.Bf = Bf
        Rf = K.R_fin.toarray()
        self.Rf = Rf
        self.types = sorted(set(self.fin_type))
        self.reachable = set(K.reachable)
        qp = K.qprocess()
        mu = np.zeros(K.n_t)
        mu[qp["idx"]] = qp["mu"]
        self.qp_mu = mu
        self.s0 = K.start("standing", "me")
        self.pW, self.pL = float(self.s0 @ self.qW), float(self.s0 @ self.qL)

    def hub_states(self, hub):
        K = self.K
        top, bot = K.index[hub + "/top"], K.index[hub + "/bottom"]
        return [(top, "M", "top"), (K.n_r + top, "T", "top"), (bot, "M", "bottom"), (K.n_r + bot, "T", "bottom")]

    def _seat(self, role, performer):
        return ("TOP" if role == "top" else "BOTTOM") if performer == "me" else ("BOTTOM" if role == "top" else "TOP")

    def hub_profile(self, hub, M=None):
        """Seat x class masses (uniform over the hub's 4 transient states), their decided total, and
        the seat x raw-type vector gs-2 publishes as `hubs_coin`. M = the column matrix (Bf or Rf)."""
        M = self.Bf if M is None else M
        seat_cls = {s: {c: 0.0 for c in self.classes} for s in SEATS}
        seat_type = {s: {t: 0.0 for t in self.types} for s in SEATS}
        for t, _turn, role in self.hub_states(hub):
            row = M[t]
            for j in np.flatnonzero(row):
                seat = self._seat(role, self.fin_perf[j])
                seat_cls[seat][self.fin_class[j]] += 0.25 * row[j]
                seat_type[seat][self.fin_type[j]] += 0.25 * row[j]
        return seat_cls, seat_type

    def role_shares(self, rn):
        """me / them x class, start 1/2 (r, my turn) + 1/2 (r, their turn), conditioned on decided."""
        K = self.K
        r = K.index[rn]
        me = {c: 0.0 for c in self.classes}
        them = {c: 0.0 for c in self.classes}
        for t in (r, K.n_r + r):
            row = self.Bf[t]
            for j in np.flatnonzero(row):
                (me if self.fin_perf[j] == "me" else them)[self.fin_class[j]] += 0.5 * row[j]
        d = sum(me.values()) + sum(them.values())
        return ({c: v / d for c, v in me.items()}, {c: v / d for c, v in them.items()}) if d > 0 else (None, None)

    def passage(self, groups, n_groups):
        """P(the roll visits group X | it ends W), and | L, from K.start('standing','me') — gs-4's
        definition (a visit = starting in X or entering it), solved here DIRECTLY: g = q on X and
        (I - Q_{X^c X^c}) g = Q_{X^c X} q_X off it. gs-4 uses Woodbury avoid-kills; a different route."""
        K = self.K
        Q = K.Q.tocsr()
        outW, outL = np.full(n_groups, np.nan), np.full(n_groups, np.nan)
        for x in range(n_groups):
            inside = groups == x
            S, Sc = np.flatnonzero(inside), np.flatnonzero(~inside)
            if not len(S):
                continue
            A = (sp.identity(len(Sc), format="csc") - Q[Sc][:, Sc].tocsc())
            lu = spla.splu(A)
            QcS = Q[Sc][:, S]
            gW, gL = np.zeros(K.n_t), np.zeros(K.n_t)
            gW[S], gL[S] = self.qW[S], self.qL[S]
            gW[Sc] = lu.solve(QcS @ self.qW[S])
            gL[Sc] = lu.solve(QcS @ self.qL[S])
            outW[x] = float(self.s0 @ gW) / self.pW
            outL[x] = float(self.s0 @ gL) / self.pL
        return outW, outL


# --------------------------------------------------------------------------- #
# joins: set equality or refusal, and a coverage line per source
# --------------------------------------------------------------------------- #
def require_equal(source, keys, expected, coverage, cfg, kind, note=""):
    keys, expected = set(keys), set(expected)
    line = "%d/%d" % (len(keys & expected), len(expected))
    coverage.setdefault(cfg, {})["%s %s" % (source, kind)] = line + ((" " + note) if note else "")
    if keys != expected:
        raise SystemExit("[atlas] JOIN REFUSED: %s %s (%s) has %d ids, expected %d; only in source %s, missing %s"
                         % (source, kind, cfg, len(keys), len(expected), sorted(keys - expected)[:5],
                            sorted(expected - keys)[:5]))
    return line


class Differentials:
    """Every pair checked, with n, max |difference|, the tolerance and WHY that tolerance."""

    def __init__(self):
        self.rows = []

    def add(self, name, cfg, a_label, b_label, pairs, reason, exact=False):
        """pairs: iterable of (key, a, b, tol) — tol per comparison (rounding sum), or exact."""
        n, worst, worst_key, fails, detail = 0, 0.0, None, [], []
        pairs = list(pairs)
        for key, a, b, tol in pairs:
            if a is None or b is None:
                raise SystemExit("[atlas] differential %s: a None operand at %s — absence must be named, "
                                 "not compared" % (name, key))
            d = abs(float(a) - float(b))
            t = EXACT_TOL if exact else tol
            n += 1
            if d > worst:
                worst, worst_key = d, key
            if d > t:
                fails.append((str(key), float(a), float(b), d, t))
            if len(pairs) <= 12:                      # small multi-lane rows: show every pair
                detail.append(dict(pair=str(key), a=float(a), b=float(b), abs_diff=d, tol=t))
        if n == 0:
            raise SystemExit("[atlas] differential %s compared NOTHING — never looked is not agreement" % name)
        row = dict(name=name, configuration=cfg, a=a_label, b=b_label, n=n, max_abs_diff=worst,
                   at=str(worst_key), tolerance=reason, status="PASS" if not fails else "FAIL",
                   failures=fails[:5], failure_count=len(fails))
        if detail:
            row["pairs"] = detail
        self.rows.append(row)
        return row

    def add_sets(self, name, cfg, a_label, b_label, pairs, reason):
        """pairs: (key, set_a, set_b); a set differential passes only on exact equality."""
        n, fails = 0, []
        for key, a, b in pairs:
            n += 1
            if set(a) != set(b):
                fails.append((str(key), sorted(set(a) - set(b)), sorted(set(b) - set(a))))
        if n == 0:
            raise SystemExit("[atlas] set differential %s compared NOTHING" % name)
        row = dict(name=name, configuration=cfg, a=a_label, b=b_label, n=n, max_abs_diff=None,
                   tolerance=reason, status="PASS" if not fails else "FAIL", failures=fails[:5],
                   failure_count=len(fails))
        self.rows.append(row)
        return row

    def failed(self):
        return [r for r in self.rows if r["status"] != "PASS"]


def resolve_path(root, path):
    """Walk an artifact path whose KEYS may contain '/' (class names such as 'HIP/GROIN'): at each
    level take the LONGEST run of remaining parts that is a key. Refuses rather than guesses."""
    parts, node, i = path.split("/"), root, 0
    while i < len(parts):
        if isinstance(node, list):
            node, i = node[int(parts[i])], i + 1
            continue
        for j in range(len(parts), i, -1):
            key = "/".join(parts[i:j])
            if key in node:
                node, i = node[key], j
                break
        else:
            raise SystemExit("[atlas] cited path %r does not resolve at %r" % (path, "/".join(parts[i:])))
    return node


# --------------------------------------------------------------------------- #
# the build
# --------------------------------------------------------------------------- #
def gs3_clusters(case):
    """TV territory label of every hub in one gs-3 case, named by the medoid's role in the cell's
    accepted reading (LEG = the inside-ashi-garami / leg-entanglement medoid; the smaller non-leg
    cluster = BACK/CHOKE-CONTROL; the largest = MIDDLE GAME). Label names are a convenience; the
    medoid id is carried beside it."""
    cl = case["clusterings"]["exit_tv"]["clusters"]
    leg = [c for c in cl if c["medoid"] in ("inside-ashi-garami", "leg-entanglement")]
    rest = sorted([c for c in cl if c not in leg], key=lambda c: c["size"])
    label = {}
    for c in cl:
        if c in leg:
            name = "LEG"
        elif len(rest) == 2 and c is rest[0]:
            name = "BACK/CHOKE-CONTROL"
        else:
            name = "MIDDLE GAME" if len(cl) == 3 else "REST"
        for h in c["hubs"]:
            if h in label:
                raise SystemExit("[atlas] gs-3 hub %s in two clusters" % h)
            label[h] = (name, c["medoid"])
    return label, cl


def load_graph_hashed(path=GRAPH_PATH):
    """Parse graph.json from the SAME bytes that are hashed (no read-then-hash race)."""
    raw = open(path, "rb").read()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def build(verbose=True, sources=None, G=None):
    t0 = time.time()
    src, sha = sources if sources is not None else load_sources()
    G, graph_sha = load_graph_hashed() if G is None else G
    lead, lead_cov = lead_structure()
    D = Differentials()
    coverage = {}
    sources_meta = dict(sha, graph=dict(path="graph.json", sha256=graph_sha))
    atlas = dict(meta=dict(item="T3", seat="gs-1", recompute=RECOMPUTE, graph_sha256=graph_sha, sources=sources_meta,
                           game="the corpus's game (both seats sample authored shares; _kernel.py)",
                           configurations={k: {kk: v for kk, v in c.items()} for k, c in CONFIGS.items()},
                           lead_structure_coverage=lead_cov),
                 hubs={}, role_nodes={}, coverage=coverage)
    s2, s3, s4, s5, s5c, s1 = src["gs-2"], src["gs-3"], src["gs-4"], src["gs-5"], src["gs-5-cards"], src["gs-1"]
    recs = {}
    for cfg, c in CONFIGS.items():
        R = recs[cfg] = Recompute(G, cfg, src["lexicon"])
        K = R.K
        hubs, roles = list(K.hubs), list(K.role_nodes)
        if len(hubs) < FLOOR_HUB or len(roles) < FLOOR_ROLE:
            raise SystemExit("[atlas] kernel covers %d hubs / %d role-nodes, below floor" % (len(hubs), len(roles)))
        reach_roles = sorted(R.reachable)
        hub_reach = [h for h in hubs if h + "/top" in R.reachable and h + "/bottom" in R.reachable]
        hub_mass = {h: float(sum(R.qp_mu[t] for t, _a, _b in R.hub_states(h))) for h in hubs}
        pos_mass = [h for h in hubs if hub_mass[h] > 0]
        unreachable = sorted(set(hubs) - set(hub_reach))
        require_equal("kernel", hub_reach, pos_mass, coverage, cfg, "hubs: both seats reachable == positive Q-process mass")

        # ---- gs-2: rows (all 266 role-nodes, M and T), hub exit laws (all 133 hubs) ------------
        rows = s2["states"][c["gs2"]]["rows"]
        cols = s2["states"][c["gs2"]]["columns"]
        require_equal("gs-2 scalars.json states.rows", rows, roles, coverage, cfg, "role-nodes")
        ix = {k: cols.index(k) for k in ("q_W", "q_L", "clocked_W", "E_plies", "E_steps")}
        el2 = s2["exit_law"][c["gs2"]]
        hc, hcols = el2.get("hubs_coin"), el2.get("hub_columns")
        if hc is not None:
            require_equal("gs-2 scalars.json exit_law.hubs_coin", hc, hubs, coverage, cfg, "hubs")
        else:
            coverage[cfg]["gs-2 scalars.json exit_law.hubs_coin"] = NOT_STORED + " (gs-2 stores hub exit laws for the headline only)"

        # ---- gs-3: 122 positive-mass hubs, index-aligned lists joined through their OWN id list ----
        case = s3["cases"][c["gs3"]]
        g3_mass, g3_xy = None, None
        if "hub_ids" in case:
            g3_ids = case["hub_ids"]
            for key in ("shipped_ground_coordinates", "hub_stationary_mass"):
                if len(case[key]) != len(g3_ids):
                    raise SystemExit("[atlas] gs-3 %s length %d != hub_ids %d" % (key, len(case[key]), len(g3_ids)))
            require_equal("gs-3 geometry.json cases.hub_ids", g3_ids, pos_mass, coverage, cfg, "hubs",
                          "(+%d unreachable: zero Q-process mass)" % len(unreachable))
            g3_mass = dict(zip(g3_ids, case["hub_stationary_mass"]))
            g3_xy = dict(zip(g3_ids, case["shipped_ground_coordinates"]))
        else:
            coverage[cfg]["gs-3 geometry.json cases.hub_ids / mass / coords"] = NOT_STORED + " (gs-3 stores them for the primary only)"
        tv_label, tv_clusters = gs3_clusters(case)
        require_equal("gs-3 geometry.json exit_tv.clusters", tv_label, pos_mass, coverage, cfg, "hubs")
        claims = {}
        if cfg == "headline":
            claims = {r["hub"]: r for r in s3["per_hub_claims"]["records"]}
            require_equal("gs-3 geometry.json per_hub_claims", claims, pos_mass, coverage, cfg, "hubs")

        # ---- gs-4: passage lists are TOP-k (truncated by design) ------------------------------
        f4 = s4["configs"][c["gs4"]]
        if f4["set"]["frame"] != c["frame"] or f4["set"]["initiative"] != c["initiative"]:
            raise SystemExit("[atlas] gs-4 config %s is not %s/%s" % (c["gs4"], c["frame"], c["initiative"]))
        p4 = {kind: {col: {row[0]: row[2] for row in f4["passage_" + kind][col]} for col in ("W", "L")}
              for kind in ("hubs", "roles")}
        for kind, ids in (("hubs", hubs), ("roles", roles)):
            for col in ("W", "L"):
                listed = set(p4[kind][col])
                if not listed or not listed <= set(ids):
                    raise SystemExit("[atlas] gs-4 passage_%s %s: %d listed, %d unknown ids"
                                     % (kind, col, len(listed), len(listed - set(ids))))
                coverage[cfg]["gs-4 flux.json passage_%s.%s" % (kind, col)] = \
                    "%d/%d listed (TOP-k; the rest %s)" % (len(listed), len(ids), TRUNCATED)

        # ---- gs-5 -------------------------------------------------------------------------------
        if cfg == "headline":
            require_equal("gs-5 naming.json hubs", s5["hubs"], hub_reach, coverage, cfg, "hubs")
            require_equal("gs-5 naming.json not_evaluable", s5["not_evaluable"], unreachable, coverage, cfg, "hubs")
            require_equal("gs-5 naming.json role_nodes", s5["role_nodes"], reach_roles, coverage, cfg, "role-nodes")
            require_equal("gs-5 naming_cards.json hubs", s5c["hubs"], hub_reach, coverage, cfg, "hubs")
            tvr = s5["tv_regions"]["regions"]
            require_equal("gs-5 naming.json tv_regions", {h for r in tvr.values() for h in r["members"]},
                          pos_mass, coverage, cfg, "hubs")
        g5_names = s5["names"]["by_configuration"][c["gs5"]]["names"] if cfg == "gi" else None
        if cfg == "gi":
            require_equal("gs-5 naming.json names.by_configuration.other_frame", g5_names, hubs, coverage, cfg, "hubs")

        # ---- gs-1 (mine) --------------------------------------------------------------------------
        t1 = s1["configs"][c["gs1"]]
        guard = set(t1["splits"]["phase"]["guard_side_hubs"])
        loc = set(t1["splits"]["localized"]["hubs"])
        if not guard <= set(pos_mass) or not loc <= set(pos_mass):
            raise SystemExit("[atlas] gs-1 phase/localized ids outside the reachable hubs")
        coverage[cfg]["gs-1 territories.json splits.phase"] = "%d guard-side of %d hubs (complement = passed/pinned)" % (len(guard), len(pos_mass))
        module_of = {}
        per_hub_phase = {}
        if cfg == "headline":
            mt = s1["map_equation"][c["gs1"]]["module_table"]
            for row in mt:
                if row["members"] is None:
                    raise SystemExit("[atlas] gs-1 module %s has a truncated member list" % row["label"])
                for h in row["members"]:
                    if h in module_of:
                        raise SystemExit("[atlas] gs-1 hub %s in two modules" % h)
                    module_of[h] = row["label"]
            require_equal("gs-1 territories.json map_equation.module_table", module_of, pos_mass, coverage, cfg,
                          "hubs (a partition: disjoint, covering)")
            per_hub_phase = s1["phase_robustness"][c["gs1"]]["per_hub"]
            require_equal("gs-1 territories.json phase_robustness.per_hub", per_hub_phase, pos_mass, coverage, cfg, "hubs")
            D.add_sets("gs-1 per_hub side == gs-1 splits.phase guard_side_hubs", cfg, "phase_robustness.per_hub.side",
                       "splits.phase.guard_side_hubs",
                       [("guard side", {h for h, v in per_hub_phase.items() if v["side"] == "guard/standing"}, guard)],
                       "two copies of one set in one artifact must be identical")

        # =========================== DIFFERENTIALS =====================================================
        # D1 committor, clocked committor, tempo: gs-2 rows vs the kernel recompute (all 532 states)
        for name, col, arr in (("q_W", "q_W", R.qW), ("q_L", "q_L", R.qL), ("clocked_W (H 9..12 plies)", "clocked_W", R.clockedW),
                               ("E_plies", "E_plies", R.E_plies), ("E_steps", "E_steps", R.E_steps)):
            pairs = []
            for rn in roles:
                r = K.index[rn]
                for turn, t in (("M", r), ("T", K.n_r + r)):
                    v = rows[rn][turn][ix[col]]
                    pairs.append(("%s|%s" % (rn, turn), v, arr[t], sig_bound(v) + 1e-12))
            D.add("committor/tempo %s: gs-2 rows vs kernel recompute" % name, cfg, "gs-2 scalars.json states.rows",
                  "atlas kernel", pairs, "gs-2 rounds to 6 significant digits: |d| <= 5e-6|v|")
        # D2 gs-2 seat-labelled hub exit law (hubs_coin, raw type) vs the kernel recompute
        prof = {h: R.hub_profile(h) for h in hubs}
        if hc is not None:
            pairs = []
            for h in hubs:
                st = prof[h][1]
                for j, key in enumerate(hcols):
                    seat, typ = key.split("|", 1)
                    v = hc[h][j]
                    pairs.append(("%s|%s" % (h, key), v, st[seat.upper()].get(typ, 0.0), sig_bound(v) + 1e-12))
            D.add("hub exit law (seat x raw type): gs-2 hubs_coin vs kernel recompute", cfg, "gs-2 exit_law.hubs_coin",
                  "atlas kernel (uniform over the hub's 4 states, finisher seat)", pairs,
                  "gs-2 rounds to 6 significant digits")
        # D2b gs-2's standing exit law (performer x raw type) vs the kernel — stored for every configuration
        law = R.s0 @ R.Bf
        grp = {}
        for j in np.flatnonzero(law):
            key = "%s|%s" % (R.fin_perf[j], R.fin_type[j])
            grp[key] = grp.get(key, 0.0) + law[j]
        fs = el2["from_standing_me_first"]
        D.add("standing exit law (performer x raw type): gs-2 vs kernel recompute", cfg,
              "gs-2 exit_law.from_standing_me_first", "atlas kernel s0 @ K.exit_law()",
              [(k, v, grp.get(k, 0.0), sig_bound(v, 10) + 1e-12) for k, v in fs.items()],
              "gs-2 prints 10 significant digits")
        # D3 gs-3's TV-cluster exit profile (equal-weight cluster mean) vs gs-2 hubs_coin and vs the kernel
        pairs, pairs_k = [], []
        for cl in tv_clusters:
            for seat_l, typ, v in cl["top_exit_columns"]:
                kmean = float(np.mean([prof[h][1][seat_l.upper()].get(typ, 0.0) for h in cl["hubs"]]))
                pairs_k.append(("%s|%s|%s" % (cl["medoid"], seat_l, typ), v, kmean, sig_bound(v) + 1e-12))
                if hc is not None:
                    j = hcols.index(seat_l.lower() + "|" + typ)
                    vals = [hc[h][j] for h in cl["hubs"]]
                    tol = sig_bound(v) + sum(sig_bound(x) for x in vals) / len(vals) + 1e-12
                    pairs.append(("%s|%s|%s" % (cl["medoid"], seat_l, typ), v, float(np.mean(vals)), tol))
        if pairs:
            D.add("TV-territory exit profile: gs-3 cluster columns vs mean of gs-2 hubs_coin", cfg,
                  "gs-3 exit_tv.clusters.top_exit_columns", "gs-2 hubs_coin, equal-weight cluster mean", pairs,
                  "both round to 6 significant digits: tol = sum of the operands' bounds")
        D.add("TV-territory exit profile: gs-3 cluster columns vs kernel cluster mean", cfg,
              "gs-3 exit_tv.clusters.top_exit_columns", "atlas kernel, equal-weight cluster mean", pairs_k,
              "gs-3 rounds to 6 significant digits")
        # D4 the standing roll: P(I finish), clocked P(I finish), E steps, E plies — every lane that prints it
        hl = [r for r in s2["headline"] if r["configuration"] == c["gs2"] and r["start"] == "standing, me first"]
        if len(hl) != 1:
            raise SystemExit("[atlas] gs-2 headline row for %s: %d found" % (c["gs2"], len(hl)))
        hl = hl[0]
        clocked_k = float(R.s0 @ R.clockedW)
        roll1 = s1["configs"][c["gs1"]]["roll"]["standing_me"]
        E_st, E_pl = float(R.s0 @ R.E_steps), float(R.s0 @ R.E_plies)
        ld = lead[c["lead"]]
        D.add("standing P(I finish), H=inf: every lane vs kernel", cfg, "lanes", "atlas kernel", [
            ("gs-2 headline.P_I_finish", hl["P_I_finish"], R.pW, sig_bound(hl["P_I_finish"], 10) + 1e-12),
            ("gs-4 configs.probabilities.W", f4["probabilities"]["W"], R.pW, sig_bound(f4["probabilities"]["W"]) + 1e-12),
            ("lead --structure P(I finish)", ld["P_I_finish"], R.pW, dec_bound(4) + 1e-12)],
            "gs-2 10 sig. digits, gs-4 6 sig. digits, lead 4 decimals")
        D.add("standing clocked P(I finish), H in 9..12 plies: every lane vs kernel", cfg, "lanes", "atlas kernel", [
            ("gs-2 headline.clocked_P_I_finish", hl["clocked_P_I_finish"], clocked_k, sig_bound(hl["clocked_P_I_finish"], 10) + 1e-12),
            ("gs-3 clocked_exit_law.p_i_finish", case["clocked_exit_law"]["from_standing_me_first"]["p_i_finish"], clocked_k,
             sig_bound(case["clocked_exit_law"]["from_standing_me_first"]["p_i_finish"]) + 1e-12),
            ("lead --structure CLOCKED P(I finish)", ld["clocked_P_I_finish"], clocked_k, dec_bound(4) + 1e-12)],
            "gs-2 10 sig. digits, gs-3 6 sig. digits, lead 4 decimals")
        D.add("standing roll length (steps and plies): gs-1 / gs-2 / lead vs kernel", cfg, "lanes", "atlas kernel", [
            ("gs-1 roll.standing_me.steps", roll1["steps"], E_st, sig_bound(roll1["steps"], 12) + 1e-12),
            ("gs-1 roll.standing_me.plies", roll1["plies"], E_pl, sig_bound(roll1["plies"], 12) + 1e-12),
            ("gs-2 headline.E_steps", hl["E_steps"], E_st, sig_bound(hl["E_steps"], 10) + 1e-12),
            ("gs-2 headline.E_plies", hl["E_plies"], E_pl, sig_bound(hl["E_plies"], 10) + 1e-12),
            ("lead --structure steps", ld["E_steps"], E_st, dec_bound(2) + 1e-12),
            ("lead --structure plies", ld["E_plies"], E_pl, dec_bound(2) + 1e-12)],
            "gs-1 12 sig. digits, gs-2 10 sig. digits, lead 2 decimals")
        # D5 the Q-process hub mass: gs-3 vs (gs-5) vs kernel
        if g3_mass is not None:
            pairs = [(h, g3_mass[h], hub_mass[h], sig_bound(g3_mass[h]) + 1e-12) for h in pos_mass]
            D.add("Q-process hub mass: gs-3 hub_stationary_mass vs kernel", cfg, "gs-3 cases.hub_stationary_mass",
                  "atlas kernel (K.qprocess mu summed over the hub's 4 states)", pairs, "gs-3 rounds to 6 significant digits")
        if cfg == "headline":
            D.add("Q-process hub mass: gs-5 mu_time vs gs-3 hub_stationary_mass", cfg, "gs-5 hubs.mu_time",
                  "gs-3 cases.hub_stationary_mass",
                  [(h, s5["hubs"][h]["mu_time"], g3_mass[h], dec_bound() + sig_bound(g3_mass[h]) + 1e-12) for h in hub_reach],
                  "gs-5 6 decimals + gs-3 6 sig. digits")
        # D6 passage: gs-4's listed entries vs this file's direct solve
        hub_grp = K.groups_hub()
        pW_h, pL_h = R.passage(hub_grp, len(K.hubs))
        pW_r, pL_r = R.passage(K.groups_role(), K.n_r)
        for kind, ids, (pW_, pL_) in (("hubs", hubs, (pW_h, pL_h)), ("roles", roles, (pW_r, pL_r))):
            index = {x: i for i, x in enumerate(K.hubs if kind == "hubs" else K.role_nodes)}
            pairs = []
            for col, arr in (("W", pW_), ("L", pL_)):
                for x, v in p4[kind][col].items():
                    pairs.append(("%s|%s" % (x, col), v, arr[index[x]], sig_bound(v) + 1e-9))
            D.add("passage (%s) in won / lost rolls: gs-4 listed vs direct solve" % kind, cfg, "gs-4 passage_%s (TOP-k)" % kind,
                  "atlas kernel (hitting solve, start standing me)", pairs, "gs-4 rounds to 6 significant digits")

        if cfg == "headline":
            # D7 gs-5 class shares: vs gs-2's hubs_coin grouped by the lexicon (type -> class is single-valued)
            t2c = {}
            for typ, cl in zip(R.fin_type, R.fin_class):
                if t2c.setdefault(typ, cl) != cl:
                    raise SystemExit("[atlas] raw type %s maps to two classes — the grouping would be ambiguous" % typ)
            pairs_s, pairs_seat, pairs_k, pairs_kseat = [], [], [], []
            for h in hub_reach:
                tot = sum(hc[h])
                grp = {s: {cl: 0.0 for cl in R.classes} for s in SEATS}
                bnd = {s: {cl: 0.0 for cl in R.classes} for s in SEATS}
                for j, key in enumerate(hcols):
                    seat, typ = key.split("|", 1)
                    grp[seat.upper()][t2c[typ]] += hc[h][j]
                    bnd[seat.upper()][t2c[typ]] += sig_bound(hc[h][j])
                tot_b = sum(sig_bound(x) for x in hc[h])
                sc, _st = prof[h]
                dk = sum(sum(v.values()) for v in sc.values())
                for cl in R.classes:
                    v5 = s5["hubs"][h]["share"][cl]
                    both = grp["TOP"][cl] + grp["BOTTOM"][cl]
                    tol = dec_bound() + (bnd["TOP"][cl] + bnd["BOTTOM"][cl]) / tot + both * tot_b / tot ** 2 + 1e-12
                    pairs_s.append(("%s|%s" % (h, cl), v5, both / tot, tol))
                    pairs_k.append(("%s|%s" % (h, cl), v5, (sc["TOP"][cl] + sc["BOTTOM"][cl]) / dk, dec_bound() + 1e-12))
                    for seat in SEATS:
                        v5s = s5["hubs"][h]["seat_share"][seat][cl]
                        tol_s = dec_bound() + bnd[seat][cl] / tot + grp[seat][cl] * tot_b / tot ** 2 + 1e-12
                        pairs_seat.append(("%s|%s|%s" % (h, seat, cl), v5s, grp[seat][cl] / tot, tol_s))
                        pairs_kseat.append(("%s|%s|%s" % (h, seat, cl), v5s, sc[seat][cl] / dk, dec_bound() + 1e-12))
            D.add("hub class shares: gs-5 share vs gs-2 hubs_coin grouped by the gs-5 lexicon", cfg, "gs-5 hubs.share",
                  "gs-2 exit_law.hubs_coin / total, grouped type -> class", pairs_s,
                  "gs-5 6 decimals + gs-2 6 sig. digits propagated through the grouped ratio")
            D.add("hub seat shares: gs-5 seat_share vs gs-2 hubs_coin seat x class", cfg, "gs-5 hubs.seat_share",
                  "gs-2 exit_law.hubs_coin", pairs_seat, "gs-5 6 decimals + gs-2 6 sig. digits (ratio)")
            D.add("hub class shares: gs-5 share vs kernel recompute", cfg, "gs-5 hubs.share", "atlas kernel", pairs_k,
                  "gs-5 rounds to 6 decimals")
            D.add("hub seat shares: gs-5 seat_share vs kernel recompute", cfg, "gs-5 hubs.seat_share", "atlas kernel",
                  pairs_kseat, "gs-5 rounds to 6 decimals")
            # D8 committor two ways: gs-2 q-bar (committor solve) vs gs-5 role shares (exit-law grouping)
            pairs_me, pairs_them, pairs_rk = [], [], []
            for rn in reach_roles:
                qbar = 0.5 * (rows[rn]["M"][ix["q_W"]] + rows[rn]["T"][ix["q_W"]])
                qb = 0.5 * (sig_bound(rows[rn]["M"][ix["q_W"]]) + sig_bound(rows[rn]["T"][ix["q_W"]]))
                me5 = sum(s5["role_nodes"][rn]["me"].values())
                them5 = sum(s5["role_nodes"][rn]["them"].values())
                tol = qb + len(R.classes) * dec_bound() + 1e-12
                pairs_me.append((rn, me5, qbar, tol))
                pairs_them.append((rn, 1 - them5, qbar, tol))
                kme, kthem = R.role_shares(rn)
                for cl in R.classes:
                    pairs_rk.append(("%s|me|%s" % (rn, cl), s5["role_nodes"][rn]["me"][cl], kme[cl], dec_bound() + 1e-12))
                    pairs_rk.append(("%s|them|%s" % (rn, cl), s5["role_nodes"][rn]["them"][cl], kthem[cl], dec_bound() + 1e-12))
            D.add("committor q-bar: gs-5 sum of MY class shares vs gs-2 turn-neutral committor", cfg,
                  "gs-5 role_nodes.me (sum over classes)", "gs-2 rows q_W, (M+T)/2", pairs_me,
                  "gs-2 6 sig. digits + 6 classes x gs-5 6 decimals; decided == all at reachable states (P(draw)=0)")
            D.add("committor q-bar: 1 - gs-5 sum of THEIR class shares vs gs-2 committor", cfg,
                  "1 - gs-5 role_nodes.them (sum)", "gs-2 rows q_W, (M+T)/2", pairs_them, "as above")
            D.add("role class shares: gs-5 role_nodes vs kernel recompute", cfg, "gs-5 role_nodes.me/them",
                  "atlas kernel", pairs_rk, "gs-5 rounds to 6 decimals")
            # D9 the standing baseline class shares (gs-5) vs kernel
            b5 = s5["baselines"]["primary"]["standing_me"]
            base = {cl: 0.0 for cl in R.classes}
            law = R.s0 @ R.Bf
            for j in np.flatnonzero(law):
                base[R.fin_class[j]] += law[j]
            dsum = sum(base.values())
            D.add("standing class baseline: gs-5 baselines.primary.standing_me vs kernel", cfg, "gs-5 baselines",
                  "atlas kernel", [(cl, b5[cl], base[cl] / dsum, dec_bound() + 1e-12) for cl in R.classes],
                  "gs-5 rounds to 6 decimals")
            # D10 seat advantage and q-bar inside gs-2's coherence list vs gs-2's own rows (two code paths)
            dis = s2["coherence"][c["gs2"]]["disagreements"]
            live = s2["coherence"][c["gs2"]]["live"]
            if sum(1 for x in dis if x["seat_flag"]) != live["disagreements_seat"] or \
                    sum(1 for x in dis if x["threshold_flag"]) != live["disagreements_threshold"]:
                raise SystemExit("[atlas] gs-2 coherence list is truncated (flag counts do not match its own totals)")
            pairs = []
            for x in dis:
                rn = x["role_node"]
                fl = K.role_nodes[K.flipidx[K.index[rn]]]
                q1 = 0.5 * (rows[rn]["M"][ix["q_W"]] + rows[rn]["T"][ix["q_W"]])
                q2 = 0.5 * (rows[fl]["M"][ix["q_W"]] + rows[fl]["T"][ix["q_W"]])
                b = sum(sig_bound(v) for v in (rows[rn]["M"][ix["q_W"]], rows[rn]["T"][ix["q_W"]],
                                               rows[fl]["M"][ix["q_W"]], rows[fl]["T"][ix["q_W"]])) / 2
                pairs.append(("%s seat_advantage" % rn, x["seat_advantage"], q1 - q2, b + sig_bound(x["seat_advantage"], 10) + 1e-12))
                pairs.append(("%s q_bar" % rn, x["q_bar"], q1, b / 2 + sig_bound(x["q_bar"], 10) + 1e-12))
            D.add("seat advantage and q-bar: gs-2 coherence list vs gs-2 rows", cfg, "gs-2 coherence.disagreements",
                  "gs-2 states.rows (derived)", pairs, "rows 6 sig. digits; the list prints 10")
            # D11 sets: gs-3 TV territories == gs-5's imported copy; gs-3 per-hub claim == its cluster
            D.add_sets("TV territories: gs-3 clusters == gs-5 tv_regions members", cfg, "gs-3 exit_tv.clusters",
                       "gs-5 tv_regions.regions",
                       [(cl["medoid"], cl["hubs"], tvr["tv:" + cl["medoid"]]["members"]) for cl in tv_clusters],
                       "gs-5 imports gs-3's regions; must be identical")
            D.add_sets("TV territory per hub: gs-3 per_hub_claims.medoid == gs-3 cluster", cfg,
                       "gs-3 per_hub_claims", "gs-3 exit_tv.clusters",
                       [(h, [claims[h]["medoid"]], [tv_label[h][1]]) for h in pos_mass], "one artifact, two tables")
            # D12 cores: gs-5 seat_core and core_classes vs the kernel's R_fin support (a different route)
            pairs_seat, pairs_cls = [], []
            for h in hub_reach:
                rc, _rt = R.hub_profile(h, R.Rf)
                mine = {s: [cl for cl in R.classes if rc[s][cl] > 0] for s in SEATS}
                g5 = s5["hubs"][h]
                for s in SEATS:
                    pairs_seat.append(("%s|%s" % (h, s), g5["seat_core"][s], mine[s]))
                pairs_cls.append((h, g5["core_classes"], sorted(set(mine["TOP"]) | set(mine["BOTTOM"]))))
            D.add_sets("core classes by seat: gs-5 seat_core vs kernel R_fin support", cfg, "gs-5 hubs.seat_core",
                       "atlas kernel (R_fin > 0 at the hub's states, finisher seat)", pairs_seat, "exact set equality")
            D.add_sets("core classes: gs-5 core_classes (max-principle cores) vs kernel R_fin support", cfg,
                       "gs-5 hubs.core_classes", "atlas kernel", pairs_cls, "exact set equality")
            # D13 the N3 cards cite naming.json: every cited number must be the value at its path
            pairs = []
            for h, card in s5c["hubs"].items():
                for path, val, _txt in card["numbers"]:
                    pairs.append(("%s:%s" % (h, path), val, resolve_path(s5, path), 1e-12))
            D.add("N3 card numbers == the naming.json value at the cited path", cfg, "gs-5 naming_cards numbers",
                  "gs-5 naming.json", pairs, "a citation must be exact")

        # =========================== THE JOIN ==========================================================
        hub_rows = {}
        for h in hubs:
            top, bot = h + "/top", h + "/bottom"
            q = {}
            for seat, rn in (("TOP", top), ("BOTTOM", bot)):
                q[seat] = dict(q_bar=0.5 * (rows[rn]["M"][ix["q_W"]] + rows[rn]["T"][ix["q_W"]]),
                               clocked_q_bar=0.5 * (rows[rn]["M"][ix["clocked_W"]] + rows[rn]["T"][ix["clocked_W"]]),
                               E_plies=0.5 * (rows[rn]["M"][ix["E_plies"]] + rows[rn]["T"][ix["E_plies"]]))
            hi = K.hub_index[h]
            rec = dict(status="ok" if h in hub_reach else UNREACHABLE)
            if h not in hub_reach:
                rec.update(reason="no roll from standing reaches it in this kernel (zero Q-process mass)",
                           committor=None, tempo=None, passage=None, territory_tv=None, phase=None)
                hub_rows[h] = rec
                continue
            rec["committor"] = {s: dict(q_bar=q[s]["q_bar"], clocked_q_bar=q[s]["clocked_q_bar"]) for s in SEATS}
            rec["seat_advantage_top"] = q["TOP"]["q_bar"] - q["BOTTOM"]["q_bar"]
            rec["tempo_E_plies"] = {s: q[s]["E_plies"] for s in SEATS}
            rec["passage"] = dict(W=pW_h[hi], L=pL_h[hi],
                                  gs4_listed={col: p4["hubs"][col].get(h, TRUNCATED) for col in ("W", "L")})
            rec["territory_tv"] = dict(territory=tv_label[h][0], medoid=tv_label[h][1])
            if claims:
                cr = claims[h]
                rec["territory_tv"]["robustness"] = dict(perturbation_share=cr["perturbation_share"],
                                                         other_initiative=cr["other_initiative"],
                                                         other_frame=cr["other_frame"], origin_off=cr["origin_off"],
                                                         tv_margin=cr["tv_margin_to_second_medoid"])
            else:
                rec["territory_tv"]["robustness"] = NOT_STORED + ": gs-3 stores per-hub robustness for the primary only"
            rec["phase"] = dict(side="guard/standing" if h in guard else "passed/pinned")
            if per_hub_phase:
                ph = per_hub_phase[h]
                rec["phase"]["robustness"] = dict(perturbed_same_side=ph["perturbed_same_side"],
                                                  **{k: ph[k] for k in ph if "/" in k})
            rec["localized_leg_set"] = h in loc
            rec["map_module"] = module_of.get(h, NOT_STORED + ": gs-1 stores the headline map partition only")
            rec["q_mass"] = hub_mass[h]
            rec["ground_xy"] = g3_xy[h] if g3_xy is not None else NOT_STORED + ": gs-3 stores coordinates for the primary only"
            if cfg == "headline":
                g5 = s5["hubs"][h]
                card = s5c["hubs"][h]
                rec["name"] = dict(card=card["name"], phrase=card["phrase"], card_class=card["class"],
                                   n2r_best_name=g5["best_name"],
                                   robustness_n3=dict(perturbation_fraction=g5["robustness_n3"]["perturbation_fraction"],
                                                      **{k: g5["robustness_n3"][k]["holds"] for k in
                                                         ("origin_false", "other_rule", "other_frame")}))
                rec["class_share"] = g5["share"]
                rec["core_classes"] = dict(TOP=g5["seat_core"]["TOP"], BOTTOM=g5["seat_core"]["BOTTOM"])
                in_rc = {}
                for cl, terr in s5["territories"].items():
                    for theta in ("2.0", "3.0"):
                        t = terr["standing_me|ratio|" + theta]
                        if t.get("status") == "ok" and h in t["members"]:
                            in_rc.setdefault(cl, []).append(float(theta))
                rec["R_C"] = {cl: dict(thetas=ths, role="core" if cl in g5["core_classes"] else "halo")
                              for cl, ths in sorted(in_rc.items())}
                flags = [x["role_node"] for x in s2["coherence"][c["gs2"]]["disagreements"] if x["hub"] == h]
                rec["coherence_flagged_role_nodes"] = sorted(flags)
            else:
                rec["name"] = dict(n2r_best_name=g5_names[h],
                                   card=NOT_STORED + ": gs-5 publishes gi names only (no gi cards)")
                rec["class_share"] = NOT_STORED + ": gs-5 stores gi names and baselines only"
            hub_rows[h] = rec
        role_rows = {}
        flagged = {x["role_node"]: x for x in s2["coherence"][c["gs2"]]["disagreements"]} if cfg == "headline" else {}
        for rn in roles:
            r = K.index[rn]
            row = rows[rn]
            rec = dict(status="ok" if rn in R.reachable else UNREACHABLE,
                       q_W={t: row[t][ix["q_W"]] for t in ("M", "T")},
                       q_L={t: row[t][ix["q_L"]] for t in ("M", "T")},
                       clocked_W={t: row[t][ix["clocked_W"]] for t in ("M", "T")},
                       E_plies={t: row[t][ix["E_plies"]] for t in ("M", "T")})
            fl = K.role_nodes[K.flipidx[r]]
            rec["q_bar"] = 0.5 * (row["M"][ix["q_W"]] + row["T"][ix["q_W"]])
            rec["seat_advantage"] = rec["q_bar"] - 0.5 * (rows[fl]["M"][ix["q_W"]] + rows[fl]["T"][ix["q_W"]])
            if rn in R.reachable:
                rec["passage"] = dict(W=pW_r[r], L=pL_r[r],
                                      gs4_listed={col: p4["roles"][col].get(rn, TRUNCATED) for col in ("W", "L")})
                hub = K.hub_of[r]
                rec["phase_side"] = ("guard/standing" if hub in guard else "passed/pinned") if hub in set(pos_mass) else None
                if cfg == "headline":
                    rec["class_share_me"] = s5["role_nodes"][rn]["me"]
                    rec["class_share_them"] = s5["role_nodes"][rn]["them"]
            if cfg == "headline":
                x = flagged.get(rn)
                rec["coherence"] = (dict(flagged=True, positionType=x["positionType"], seat_flag=x["seat_flag"],
                                         threshold_flag=x["threshold_flag"],
                                         robust_all_four=bool(all(x["robustness"][k] for k in ("origin_off", "other_frame", "other_rule"))
                                                              and x["robustness"]["perturbation_fraction_holding"] >= 0.95))
                                    if x else dict(flagged=False))
            role_rows[rn] = rec
        atlas["hubs"][cfg] = hub_rows
        atlas["role_nodes"][cfg] = role_rows
        if verbose:
            for key, line in coverage[cfg].items():
                print("  [join %s] %-70s %s" % (cfg, key, line), flush=True)
            print("[atlas] %s: %d hubs (%d reachable, %d %s), %d role-nodes joined; %d differentials so far (%.1fs)"
                  % (cfg, len(hubs), len(hub_reach), len(unreachable), UNREACHABLE, len(roles), len(D.rows),
                     time.time() - t0), flush=True)

    # ---- the LEG set algebra (a finding, not a failure) --------------------------------------------
    hl_rows = atlas["hubs"]["headline"]
    sets = {
        "gs-3 TV LEG territory": {h for h, r in hl_rows.items() if r["status"] == "ok" and r["territory_tv"]["territory"] == "LEG"},
        "gs-5 R_LEG(2)": set(s5["territories"]["LEG"]["standing_me|ratio|2.0"]["members"]),
        "gs-5 R_LEG(3)": set(s5["territories"]["LEG"]["standing_me|ratio|3.0"]["members"]),
        "gs-1 LOCALIZED": set(s1["configs"]["nogi/symmetric/origin-on"]["splits"]["localized"]["hubs"]),
        "gs-1 map module (leg)": {h for h, r in hl_rows.items() if r["status"] == "ok"
                                  and str(r["map_module"]).endswith("inside-ashi-garami")},
    }
    names = list(sets)
    union = set().union(*sets.values())
    algebra = dict(sizes={k: len(v) for k, v in sets.items()},
                   jaccard={"%s ~ %s" % (a, b): len(sets[a] & sets[b]) / len(sets[a] | sets[b])
                            for i, a in enumerate(names) for b in names[i + 1:]},
                   core_of_all=sorted(set.intersection(*sets.values())),
                   membership={h: [k for k in names if h in sets[k]] for h in sorted(union)},
                   subset={"%s <= %s" % (a, b): sets[a] <= sets[b] for a in names for b in names if a != b},
                   identities={
                       "R_LEG(3) == TV-LEG | LOCALIZED": sets["gs-5 R_LEG(3)"] == (sets["gs-3 TV LEG territory"] | sets["gs-1 LOCALIZED"]),
                       "TV-LEG & LOCALIZED": sorted(sets["gs-3 TV LEG territory"] & sets["gs-1 LOCALIZED"]),
                       "TV-LEG - LOCALIZED": sorted(sets["gs-3 TV LEG territory"] - sets["gs-1 LOCALIZED"]),
                       "LOCALIZED - TV-LEG": sorted(sets["gs-1 LOCALIZED"] - sets["gs-3 TV LEG territory"]),
                       "R_LEG(2) - R_LEG(3)": sorted(sets["gs-5 R_LEG(2)"] - sets["gs-5 R_LEG(3)"])})
    atlas["leg_set_algebra"] = algebra
    atlas["fields"] = FIELDS
    cards = {}
    for h, r in hl_rows.items():
        if r["status"] != "ok":
            cards[h] = dict(status=r["status"])
            continue
        core = r["core_classes"]
        cards[h] = dict(name=r["name"]["card"], phrase=r["name"]["phrase"],
                        name_holds_in=r["name"]["robustness_n3"]["perturbation_fraction"],
                        territory=r["territory_tv"]["territory"], phase=r["phase"]["side"],
                        committor={s_: r["committor"][s_]["q_bar"] for s_ in SEATS},
                        clocked_committor={s_: r["committor"][s_]["clocked_q_bar"] for s_ in SEATS},
                        tempo_plies=r["tempo_E_plies"]["TOP"],
                        passage=dict(won=r["passage"]["W"], lost=r["passage"]["L"]),
                        core=core, halo=sorted(cl for cl, v in r["R_C"].items() if v["role"] == "halo"),
                        leg_territory_R_LEG2="LEG" in r["R_C"], localized_leg_set=r["localized_leg_set"],
                        map_module=r["map_module"], long_fight_time=r["q_mass"])
    atlas["cards"] = cards
    atlas["differentials"] = D.rows
    fails = D.failed()
    atlas["meta"]["differentials"] = dict(checked=len(D.rows), failed=len(fails),
                                          comparisons=sum(r["n"] for r in D.rows))
    if verbose:
        for r in D.rows:
            print("  [%s] %-4s %-8s n=%-6d max|d|=%s  %s" % (r["status"], "", r["configuration"], r["n"],
                                                       "%.3g" % r["max_abs_diff"] if r["max_abs_diff"] is not None else "sets",
                                                       r["name"]), flush=True)
        print("[atlas] %d differentials, %d comparisons, %d FAILED" % (len(D.rows), atlas["meta"]["differentials"]["comparisons"], len(fails)))
    return atlas, D, recs


def dumps_atlas(atlas):
    """indent=1 JSON, except that hubs / role_nodes / cards put ONE compact entity per line (half the
    bytes, and a git diff stays one line per place). Round-trips exactly (asserted by write)."""
    compact = lambda v: json.dumps(v, sort_keys=True, separators=(",", ":"))
    out = []
    keys = sorted(atlas)
    for i, k in enumerate(keys):
        v = atlas[k]
        tail = "," if i < len(keys) - 1 else ""
        if k in ("hubs", "role_nodes", "cards"):
            groups = v if k != "cards" else {"": v}
            block = []
            for gi, g in enumerate(sorted(groups)):
                ents = groups[g]
                rows = ["   %s: %s%s" % (json.dumps(e), compact(ents[e]), "," if ei < len(ents) - 1 else "")
                        for ei, e in enumerate(sorted(ents))]
                if k == "cards":
                    block = rows
                else:
                    block.append("  %s: {\n%s\n  }%s" % (json.dumps(g), "\n".join(rows), "," if gi < len(groups) - 1 else ""))
            out.append(" %s: {\n%s\n }%s" % (json.dumps(k), "\n".join(block), tail))
        else:
            body = json.dumps(v, sort_keys=True, indent=1).replace("\n", "\n ")
            out.append(" %s: %s%s" % (json.dumps(k), body, tail))
    return "{\n" + "\n".join(out) + "\n}"


def write(atlas):
    clean = _clean(atlas)
    text = dumps_atlas(clean)
    if json.loads(text) != json.loads(json.dumps(clean)):
        raise AssertionError("[atlas] the line-per-entity writer does not round-trip")
    size = len(text.encode())
    if size >= 1_000_000:
        raise SystemExit("[atlas] atlas.json would be %d bytes (>= 1 MB budget)" % size)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text + "\n")
    print("[atlas] wrote %s (%d bytes)" % (os.path.relpath(OUT, REPO), size), flush=True)


# --------------------------------------------------------------------------- #
# selfcheck: join controls, perturbation controls, an independent passage route
# --------------------------------------------------------------------------- #
def selfcheck():
    records = []

    def check(name, ok, **detail):
        records.append(dict(name=name, status="PASS" if ok else "FAIL", **_clean(detail)))
        print(json.dumps(records[-1], sort_keys=True), flush=True)

    src, sha = load_sources()
    G = load_graph_hashed()           # parsed ONCE: the kernel cache keys on it, so rebuilds reuse kernels
    atlas, D, recs = build(verbose=False, sources=(src, sha), G=G)
    check("build.all_differentials_pass", not D.failed() and len(D.rows) >= 30,
          differentials=len(D.rows), failed=[r["name"] for r in D.failed()])
    # (1) a one-hub-short source must be refused
    bad = copy.deepcopy(src)
    victim = sorted(bad["gs-5"]["hubs"])[0]
    del bad["gs-5"]["hubs"][victim]
    try:
        build(verbose=False, sources=(bad, sha), G=G)
        refused = False
    except SystemExit as err:
        refused = "JOIN REFUSED" in str(err)
    check("control.one_hub_short_refused", refused, removed=victim, source="gs-5 naming.json hubs")
    bad = copy.deepcopy(src)
    bad["gs-3"]["cases"]["nogi/symmetric/shipped"]["hub_ids"] = bad["gs-3"]["cases"]["nogi/symmetric/shipped"]["hub_ids"][:-1]
    try:
        build(verbose=False, sources=(bad, sha), G=G)
        refused = False
    except SystemExit as err:
        refused = "JOIN REFUSED" in str(err) or "length" in str(err)
    check("control.index_aligned_list_short_refused", refused, source="gs-3 hub_ids")
    # (2) a perturbed field must be caught by its differential (and ONLY the differentials that read it)
    for lane, mutate, expect in (
            ("gs-5", lambda s: s["hubs"]["mount"]["share"].__setitem__("ARM", s["hubs"]["mount"]["share"]["ARM"] + 1e-4),
             "hub class shares: gs-5 share vs"),
            ("gs-2", lambda s: s["states"]["nogi/symmetric/shipped/origin=on"]["rows"]["mount/top"]["M"].__setitem__(0,
                     s["states"]["nogi/symmetric/shipped/origin=on"]["rows"]["mount/top"]["M"][0] + 1e-4),
             "committor/tempo q_W"),
            ("gs-4", lambda s: s["configs"]["headline"]["passage_hubs"]["W"][1].__setitem__(2,
                     s["configs"]["headline"]["passage_hubs"]["W"][1][2] + 1e-4),
             "passage (hubs)"),
            ("gs-3", lambda s: s["cases"]["nogi/symmetric/shipped"]["hub_stationary_mass"].__setitem__(5,
                     s["cases"]["nogi/symmetric/shipped"]["hub_stationary_mass"][5] * 1.001),
             "Q-process hub mass: gs-3")):
        bad = copy.deepcopy(src)
        mutate(bad[lane])
        _a, Db, _r = build(verbose=False, sources=(bad, sha), G=G)
        caught = [r["name"] for r in Db.failed()]
        check("control.perturbed_%s_caught" % lane, any(n.startswith(expect) for n in caught),
              perturbation="+1e-4 (x1.001 for a mass)", caught_by=caught)
    # (3) passage: the direct solve vs a seeded, VECTORISED Monte Carlo of the killed roll.
    # History, kept honest: a 40,000-roll loop version (seed 8128) put half-guard's W passage 4.0
    # sigma (own s.e.) from the exact value, while 100,000-roll runs on seeds 1 and 2 agreed within
    # 1.1 sigma and the exact values match gs-4's independent Woodbury route to 6 digits. The check
    # was therefore FIXED IN ADVANCE of its re-run at 400,000 rolls, seed 8128, and a family threshold
    # of 5 sigma on each comparison's own s.e. (8 correlated comparisons: false alarm ~1e-5).
    R = recs["headline"]
    K = R.K
    Q = K.Q.tocsr()
    Rm = np.asarray(K.R.todense())
    n_t = K.n_t
    dest_rows, cum_rows = [], []
    for i in range(n_t):
        d = Q.indices[Q.indptr[i]:Q.indptr[i + 1]]
        p = Q.data[Q.indptr[i]:Q.indptr[i + 1]]
        prob = np.concatenate([p, Rm[i]])
        dest_rows.append(np.concatenate([d, [-1, -2, -3]]))
        cum_rows.append(i + np.cumsum(prob) / prob.sum())          # row i lives in (i, i+1]
    dest_flat = np.concatenate(dest_rows)
    cum_flat = np.concatenate(cum_rows)
    hub_of_t = K.groups_hub()
    targets = ["side-control", "half-guard", "mount", "back-control"]
    tix = np.array([K.hub_index[h] for h in targets])
    rng = np.random.default_rng(8128)
    n_rolls = 400_000
    state = rng.choice(n_t, size=n_rolls, p=R.s0)
    seen = np.zeros((n_rolls, len(targets)), dtype=bool)
    end = np.zeros(n_rolls, dtype=int)
    alive = np.arange(n_rolls)
    for _step in range(10_000):
        if not len(alive):
            break
        seen[alive] |= hub_of_t[state[alive]][:, None] == tix[None, :]
        u = state[alive] + rng.random(len(alive))
        k = np.minimum(np.searchsorted(cum_flat, u, side="right"), len(cum_flat) - 1)
        nxt = dest_flat[k]
        done = nxt < 0
        end[alive[done]] = nxt[done]
        state[alive[~done]] = nxt[~done]
        alive = alive[~done]
    else:
        raise RuntimeError("Monte Carlo rolls did not all end")
    pW_h, pL_h = R.passage(K.groups_hub(), len(K.hubs))
    isW, isL = end == -1, end == -2
    nW, nL = int(isW.sum()), int(isL.sum())
    zs, detail = [], {}
    for j, h in enumerate(targets):
        ew, el = pW_h[tix[j]], pL_h[tix[j]]
        mw, ml = seen[isW, j].mean(), seen[isL, j].mean()
        zw = (mw - ew) / np.sqrt(ew * (1 - ew) / nW)
        zl = (ml - el) / np.sqrt(el * (1 - el) / nL)
        zs += [zw, zl]
        detail[h] = dict(exact_W=ew, mc_W=mw, z_W=zw, exact_L=el, mc_L=ml, z_L=zl)
    zp = (nW / n_rolls - R.pW) / np.sqrt(R.pW * (1 - R.pW) / n_rolls)
    check("passage.monte_carlo", max(abs(z) for z in zs) < 5 and abs(zp) < 5, rolls=n_rolls, seed=8128,
          max_abs_z=max(abs(z) for z in zs), z_P_W=zp, threshold="5 sigma, own s.e., fixed before the run", **detail)
    # (4) coverage: every hub and role-node of both configurations is in the atlas, absence named
    ok = all(len(atlas["hubs"][c]) == 133 and len(atlas["role_nodes"][c]) == 266 for c in CONFIGS)
    unr = [h for h, r in atlas["hubs"]["headline"].items() if r["status"] != "ok"]
    ok &= len(unr) == 11 and all(atlas["hubs"]["headline"][h]["committor"] is None for h in unr)
    check("coverage.every_place_present_absence_named", ok, unreachable_headline=unr)
    failures = [r for r in records if r["status"] != "PASS"]
    floor = 9
    print("%s atlas selfcheck: %d checks (floor %d), %d failed; %s --selfcheck"
          % ("PASS" if not failures and len(records) >= floor else "FAIL", len(records), floor, len(failures), RECOMPUTE))
    return 0 if not failures and len(records) >= floor else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--no-write", action="store_true")
    a = ap.parse_args(argv)
    if a.selfcheck:
        return selfcheck()
    atlas, D, _r = build()
    if D.failed():
        print("[atlas] REFUSING TO WRITE: %d differential(s) failed" % len(D.failed()))
        return 1
    if not a.no_write:
        write(atlas)
    return 0


if __name__ == "__main__":
    sys.exit(main())
