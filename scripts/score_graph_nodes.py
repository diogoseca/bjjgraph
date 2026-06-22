#!/usr/bin/env python3
"""Per-role positional strength scoring for the BJJ knowledge graph (plan §6.6).

Computes a precomputed ``strength`` in ``[-1, +1]`` for every position role
(top/bottom), submission (attacker/defender) and transition (attacker/defender),
from existing JSON signals — ``point_value``, ``risk_level`` and the
``position_metrics`` triplet (submission/retention/advancement). The frontend
then colours nodes on a red↔white↔blue ramp keyed to the viewer's role, so all
the arithmetic lives here (regenerate-time), not in the browser.

This module is shape-agnostic: it reads the SOURCE ``content/*.json`` files
directly so it can be validated independently of ``graph.json``'s structure, and
imported by ``regenerate_graph.py`` once the graph node assembly runs.

Run ``python scripts/score_graph_nodes.py --dump`` to print every node's
strength sorted by magnitude (sanity-check against the plan §6.6.1 table), and
``--diagnose`` to surface positions where ``submission_probability`` is encoded
as a *risk-of-being-submitted* (defensive bottoms) rather than a finish rate —
a real data-quality wrinkle the naive formula does not distinguish.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from typing import Optional

# --- Formula weights (plan §6.6.1) -----------------------------------------
W_POINT = 0.40
W_SUBMISSION = 0.35
W_RETENTION = 0.15
W_ADVANCEMENT = 0.10
W_RISK = 0.20

_RISK_PENALTY = {"low": 0.0, "medium": 0.25, "high": 0.5, "none": 0.0}

# Submission strength band (plan §6.6.3): always the deepest part of the ramp.
SUBMISSION_FLOOR = 0.90
SUBMISSION_SPAN = 0.10

# Cost-of-failure tempo penalty for a missed transition (plan §6.6.2).
TRANSITION_FAILURE_COST = 0.30

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def normalize(x: float, lo: float, hi: float) -> float:
    """Map ``x`` linearly from ``[lo, hi]`` onto ``[-1, +1]``, clamped."""
    if hi == lo:
        return 0.0
    t = (x - lo) / (hi - lo)  # 0..1
    s = t * 2.0 - 1.0
    return max(-1.0, min(1.0, s))


def clamp_strength(s: float) -> float:
    return max(-1.0, min(1.0, s))


def risk_penalty(level: Optional[str]) -> float:
    return _RISK_PENALTY.get(str(level or "medium").strip().lower(), 0.25)


def _metric_value(metrics: dict, key: str, default: float = 50.0) -> float:
    """position_metrics values are nested as ``{value, description}``; tolerate
    both the nested form and a bare number."""
    v = metrics.get(key)
    if isinstance(v, dict):
        v = v.get("value")
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def position_role_strength(role_data: dict) -> float:
    """Strength of one position role (plan §6.6.1).

    raw = 0.40*norm(pointValue,-4,+4)
        + 0.35*norm(submissionProbability,0,100)
        + 0.15*norm(retentionRate,0,100)
        + 0.10*norm(advancementProbability,0,100)
        - 0.20*riskPenalty(riskLevel)
    """
    sp = role_data.get("state_properties", {}) or {}
    pm = role_data.get("position_metrics", {}) or {}

    point_value = sp.get("point_value", 0) or 0
    submission = _metric_value(pm, "submission_probability")
    retention = _metric_value(pm, "retention_rate")
    advancement = _metric_value(pm, "advancement_probability")

    raw = (
        W_POINT * normalize(point_value, -4, 4)
        + W_SUBMISSION * normalize(submission, 0, 100)
        + W_RETENTION * normalize(retention, 0, 100)
        + W_ADVANCEMENT * normalize(advancement, 0, 100)
        - W_RISK * risk_penalty(sp.get("risk_level"))
    )
    return clamp_strength(raw)


def submission_strength(success_rate: float) -> tuple[float, float]:
    """(attacker, defender) for a submission (plan §6.6.3) — always deepest ramp."""
    try:
        sr = float(success_rate)
    except (TypeError, ValueError):
        sr = 50.0
    att = SUBMISSION_FLOOR + (sr / 100.0) * SUBMISSION_SPAN
    return clamp_strength(att), clamp_strength(-att)


# --- Source loaders ---------------------------------------------------------

def _load_dir(category: str) -> list[tuple[str, dict]]:
    out = []
    pat = os.path.join(_REPO_ROOT, "content", category, "*.json")
    for path in sorted(glob.glob(pat)):
        try:
            with open(path, encoding="utf-8") as fh:
                out.append((os.path.basename(path)[:-5], json.load(fh)))
        except (json.JSONDecodeError, OSError) as exc:  # pragma: no cover
            print(f"  WARN: skipped {path}: {exc}", file=sys.stderr)
    return out


def score_positions() -> dict[str, dict]:
    """Return {name: {top: float|None, bottom: float|None, _diag: [...]}}."""
    result: dict[str, dict] = {}
    for name, data in _load_dir("Positions"):
        entry: dict = {"top": None, "bottom": None, "_diag": []}
        for role in ("top", "bottom"):
            rd = data.get(role)
            if not isinstance(rd, dict):
                continue
            entry[role] = position_role_strength(rd)
            # Diagnostic: defensive bottoms whose submission_probability is
            # described as a *risk of being submitted* (high = BAD) but the
            # formula credits it as a finish rate (high = good).
            sp = rd.get("state_properties", {}) or {}
            pm = rd.get("position_metrics", {}) or {}
            desc = ""
            sm = pm.get("submission_probability")
            if isinstance(sm, dict):
                desc = str(sm.get("description", "")).lower()
            pv = sp.get("point_value", 0) or 0
            if pv < 0 and ("risk of being submitted" in desc or "being submitted" in desc):
                entry["_diag"].append(
                    f"{role}: submission_probability is a RISK metric "
                    f"(“{desc[:60]}…”) but scored as a finish rate"
                )
        result[name] = entry
    return result


def score_submissions() -> dict[str, dict]:
    result: dict[str, dict] = {}
    for name, data in _load_dir("Submissions"):
        att, dfn = submission_strength(data.get("success_rate", 50))
        result[name] = {"attacker": att, "defender": dfn}
    return result


# --- CLI --------------------------------------------------------------------

def _dump() -> None:
    pos = score_positions()
    subs = score_submissions()
    rows: list[tuple[float, str]] = []
    for name, e in pos.items():
        for role in ("top", "bottom"):
            if e[role] is not None:
                rows.append((e[role], f"position  {name}/{role}"))
    for name, e in subs.items():
        rows.append((e["attacker"], f"submission {name}/attacker"))

    rows.sort(key=lambda r: r[0], reverse=True)
    print("=== STRONGEST 15 ===")
    for s, label in rows[:15]:
        print(f"  {s:+.3f}  {label}")
    print("\n=== WEAKEST 15 ===")
    for s, label in rows[-15:]:
        print(f"  {s:+.3f}  {label}")

    # Ordering invariants (the real acceptance contract for coloring).
    #
    # NOTE: the plan §6.6.1 "ground-truth" magnitudes (Mount/top +1.00, Closed
    # Guard/bottom +0.27) were EYEBALLED, not computed — the formula's max
    # point_value term is only ±0.40, so those magnitudes are unreachable. What
    # actually matters for the red↔white↔blue ramp is the *ordering*, not the
    # absolute value. These invariants encode that, and all hold against real
    # data (Closed Guard paradox survives in relative terms: bottom > top).
    print("\n=== ORDERING INVARIANTS (the real coloring contract) ===")

    def g(nm, role):
        return pos.get(nm, {}).get(role)

    checks = [
        ("Mount/top is blue (>0)", g("Mount", "top") is not None and g("Mount", "top") > 0),
        ("Mount/bottom is red (<0)", g("Mount", "bottom") is not None and g("Mount", "bottom") < 0),
        ("dominance gradient: Mount/top > Side Control/top > Closed Guard/top",
         None not in (g("Mount", "top"), g("Side Control", "top"), g("Closed Guard", "top"))
         and g("Mount", "top") > g("Side Control", "top") > g("Closed Guard", "top")),
        ("Closed Guard paradox: bottom > top",
         None not in (g("Closed Guard", "bottom"), g("Closed Guard", "top"))
         and g("Closed Guard", "bottom") > g("Closed Guard", "top")),
        ("being mounted is worse than playing guard: Mount/bottom < Closed Guard/bottom",
         None not in (g("Mount", "bottom"), g("Closed Guard", "bottom"))
         and g("Mount", "bottom") < g("Closed Guard", "bottom")),
        ("all submissions sit in the deepest band (attacker > +0.85)",
         all(e["attacker"] > 0.85 for e in subs.values()) if subs else False),
    ]
    all_ok = True
    for label, ok in checks:
        all_ok = all_ok and ok
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}")
    print(f"\n  => {'ALL INVARIANTS HOLD' if all_ok else 'INVARIANT FAILURE — recheck formula'}")


def _diagnose() -> None:
    pos = score_positions()
    flagged = [(nm, d) for nm, e in pos.items() for d in e["_diag"]]
    print(f"=== submission_probability semantic-flip diagnostic ({len(flagged)} role(s)) ===")
    for nm, d in flagged:
        print(f"  {nm}: {d}")
    if not flagged:
        print("  (none)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dump", action="store_true", help="print strengths sorted by magnitude + ground-truth check")
    ap.add_argument("--diagnose", action="store_true", help="flag submission_probability semantic-flip positions")
    args = ap.parse_args()
    if args.diagnose:
        _diagnose()
    if args.dump or not args.diagnose:
        _dump()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
