#!/usr/bin/env python3
"""Shared votes.json schema helpers for the gi / no-gi forked vote store (calibration-v2, Phase 2.3b).

votes.json stores one entry per technique (keyed by name). Two schemas coexist during the
migration and this module is the backward-compat seam between them:

- LEGACY (pre-fork): ``{"success_rate": <n>, "vote_count": <n>}`` — a single frame.
- FORKED (this phase): ``{"community": {"gi": {...}, "nogi": {...}}, "prior"?: {...}}`` where each
  ruleset block under ``community`` is ``{"success_rate", "vote_count"}`` and the optional ``prior``
  block carries the calibrated expert prior ``{"gi": {...}, "nogi": {...}, "provenance": {...}}``.

Two SEPARATE keys, never nested: ``community`` is the accumulated community vote (starts at the pure
seed ``vote_count == PRIOR_VOTE_COUNT``), ``prior`` is the calibrated success-rate prior. The published
rate is their Bayesian blend (``folded_rate``) — the prior dominates while community votes are pure-seed
and decays as real votes (count above the seed) accumulate.

Legacy is a scalar-cell entry, forked is a nested map, so a reader that forgets to migrate fails loudly
(it gets the wrong shape) rather than silently reading one frame. Call ``migrate_entry`` right after
loading an entry to normalize either form to the forked schema (mirroring a legacy scalar into both
frames — byte-identical to the pre-fork single number while gi == nogi).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _prob_norm import largest_remainder_round  # int distribution summing to 100

RULESETS = ("gi", "nogi")
PRIOR_VOTE_COUNT = 30  # pure-seed sentinel: an entry still at this count has no real community votes


def migrate_entry(entry: dict) -> dict:
    """Normalize a votes entry to the forked ``{community, prior?}`` schema.

    - Already forked (has ``community``): returned unchanged (idempotent, preserving any ``prior``).
    - Legacy ``{success_rate, vote_count}``: mirrored into ``community.gi`` and ``community.nogi``.
    """
    if "community" in entry:
        return entry
    sr = entry["success_rate"]
    vc = entry["vote_count"]
    return {"community": {rs: {"success_rate": sr, "vote_count": vc} for rs in RULESETS}}


def folded_rate(entry: dict, rs: str) -> float:
    """The published success rate for one ruleset frame: the Bayesian blend of the calibrated prior
    and the community votes, weighted by prior pseudo-count vs. the count of REAL votes (community
    votes above the pure seed). Falls back to the raw community rate when no usable prior exists."""
    community = entry["community"][rs]
    prior = (entry.get("prior") or {}).get(rs)
    real_n = max(0, community["vote_count"] - PRIOR_VOTE_COUNT)
    if prior and prior.get("success_rate") is not None and prior.get("pseudo_count"):
        return (prior["success_rate"] * prior["pseudo_count"] + community["success_rate"] * real_n) / (
            prior["pseudo_count"] + real_n
        )
    return community["success_rate"]


def folded_rates(entry: dict) -> dict:
    """The published ``{gi, nogi}`` success rates (prior-blended per frame)."""
    return {rs: folded_rate(entry, rs) for rs in RULESETS}


def seed_entry(rate: float) -> dict:
    """A fresh pure-seed forked entry mirroring ``rate`` into both frames at the seed vote count."""
    return {"community": {rs: {"success_rate": rate, "vote_count": PRIOR_VOTE_COUNT} for rs in RULESETS}}


def rescale_dist_to_success(dist: list, new_succ: int) -> list:
    """Rebuild an outcome distribution so its success-result cells sum to new_succ and the rest
    to 100-new_succ, preserving relative proportions within each group; renormalize to 100.

    (Copied from scripts/calibrate_probabilities.py so regenerate_graph doesn't import the calibrate CLI.)
    """
    succ = [d for d in dist if d["result"] == "success"]
    other = [d for d in dist if d["result"] != "success"]
    old_s = sum(d["probability"] for d in succ)
    old_o = sum(d["probability"] for d in other)
    tgt_o = 100 - new_succ
    vals = []
    for d in dist:
        if d["result"] == "success":
            share = (d["probability"] / old_s) if old_s > 0 else (1.0 / len(succ) if succ else 0.0)
            vals.append(new_succ * share)
        else:
            share = (d["probability"] / old_o) if old_o > 0 else (1.0 / len(other) if other else 0.0)
            vals.append(tgt_o * share)
    ints = largest_remainder_round(vals, 100)
    return [{**d, "probability": ints[i]} for i, d in enumerate(dist)]


if __name__ == "__main__":
    # migrate: legacy -> forked mirror
    legacy = {"success_rate": 55.0, "vote_count": 30}
    forked = migrate_entry(legacy)
    assert forked == {
        "community": {
            "gi": {"success_rate": 55.0, "vote_count": 30},
            "nogi": {"success_rate": 55.0, "vote_count": 30},
        }
    }
    # migrate: idempotent on an already-forked entry, preserving prior
    already = {
        "community": {"gi": {"success_rate": 40, "vote_count": 30}, "nogi": {"success_rate": 40, "vote_count": 30}},
        "prior": {"gi": {"success_rate": 33, "pseudo_count": 3}, "nogi": {"success_rate": 33, "pseudo_count": 3}},
    }
    assert migrate_entry(already) is already

    # folded_rate: pure seed (no prior) -> community value
    seed = seed_entry(50.0)
    assert folded_rate(seed, "gi") == 50.0 and folded_rate(seed, "nogi") == 50.0

    # folded_rate: pure seed + prior -> exactly the prior value (real_n == 0, weight all on prior)
    seed_with_prior = seed_entry(50.0)
    seed_with_prior["prior"] = {
        "gi": {"success_rate": 33, "pseudo_count": 3},
        "nogi": {"success_rate": 20, "pseudo_count": 3},
    }
    assert folded_rate(seed_with_prior, "gi") == 33
    assert folded_rate(seed_with_prior, "nogi") == 20
    assert folded_rates(seed_with_prior) == {"gi": 33, "nogi": 20}

    # folded_rate: real votes blend prior and community (10 real votes above the 30 seed)
    with_votes = {
        "community": {"gi": {"success_rate": 60, "vote_count": 40}, "nogi": {"success_rate": 60, "vote_count": 40}},
        "prior": {"gi": {"success_rate": 30, "pseudo_count": 3}, "nogi": {"success_rate": 30, "pseudo_count": 3}},
    }
    # (30*3 + 60*10) / (3 + 10) = 690/13
    assert abs(folded_rate(with_votes, "gi") - (690 / 13)) < 1e-9

    # folded_rate: prior with pseudo_count 0 falls back to community
    zero_pc = seed_entry(48.0)
    zero_pc["prior"] = {"gi": {"success_rate": 33, "pseudo_count": 0}, "nogi": {"success_rate": 33, "pseudo_count": 0}}
    assert folded_rate(zero_pc, "gi") == 48.0

    # rescale: sums to 100, success cells == new_succ
    dist = [
        {"to": "game-over", "result": "success", "probability": 55},
        {"to": "X/Top", "result": "failure", "probability": 30},
        {"to": "Y/Bottom", "result": "counter", "probability": 15},
    ]
    out = rescale_dist_to_success(dist, 40)
    assert sum(d["probability"] for d in out) == 100
    assert sum(d["probability"] for d in out if d["result"] == "success") == 40
    # multi-success-cell proportions preserved
    dist2 = [
        {"to": "A", "result": "success", "probability": 30},
        {"to": "B", "result": "success", "probability": 10},
        {"to": "C", "result": "failure", "probability": 60},
    ]
    out2 = rescale_dist_to_success(dist2, 60)
    assert sum(d["probability"] for d in out2) == 100
    assert sum(d["probability"] for d in out2 if d["result"] == "success") == 60
    assert out2[0]["probability"] > out2[1]["probability"]  # 30:10 ratio preserved

    print("_votes self-test: OK")
