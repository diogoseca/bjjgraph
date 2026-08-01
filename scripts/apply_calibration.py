#!/usr/bin/env python3
"""Apply the calibrated success-rate priors into templates/votes.json (calibration-v2, Phase 2.3b).

The apply SINK for the calibration pipeline. Reads the human-gated proposals + expert overrides and
folds the per-ruleset {gi, nogi} success-rate PRIOR into each votes entry — WITHOUT touching community
votes. Every entry is first migrated to the forked ``{community, prior?}`` schema (a legacy scalar
mirrors into both frames), then a ``prior`` block is attached for each proposal technique that is
eligible to apply.

Eligibility per proposal technique ``k`` (writes a prior when ANY holds):
  - ``not needs_human_review``     — the confident mid-band, auto-applies,
  - ``k in reviewed_set``          — a human reviewed it (names in review_input.json),
  - ``k in overrides``             — an expert hand-corrected it (calibration_overrides.json wins).

The prior value is the override's {gi, nogi} when present, else the proposal's proposed.success_rate.
Community votes, occurrence%, and outcome distributions are NOT written here — occurrence/outcomes stay
in the human-gated calibration_proposals.json; the graph build reduces the forked prior to a default
(no-gi) frame and rescales outcomes for coherence.

Usage:
    python3 scripts/apply_calibration.py                 # apply live to templates/votes.json
    python3 scripts/apply_calibration.py --dry-run       # report counts, write nothing
    python3 scripts/apply_calibration.py --votes P --out Q  # apply against a copy (testing)
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json
from _votes import RULESETS, migrate_entry

_REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VOTES = _REPO_ROOT / "templates" / "votes.json"
DEFAULT_PROPOSALS = _REPO_ROOT / "calibration_proposals.json"
DEFAULT_OVERRIDES = _REPO_ROOT / "calibration_overrides.json"
DEFAULT_REVIEW = _REPO_ROOT / "review_input.json"


def _load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prior_blocks(proposal: dict, override: dict | None, k: str, reviewed_set: set, run_id: str) -> dict:
    """Assemble the forked ``prior`` value for one technique: a {gi, nogi} block pair + provenance."""
    proposed_sr = (proposal.get("proposed") or {}).get("success_rate") or {}
    pseudo = proposal.get("pseudo_count") or {}
    extrapolated = bool(proposal.get("needs_human_review"))  # best-effort out-of-band flag
    prior = {}
    for rs in RULESETS:
        val = override[rs] if override is not None else proposed_sr.get(rs)
        prior[rs] = {
            "success_rate": val,
            "pseudo_count": pseudo.get(rs, 3),
            "extrapolated": extrapolated,
        }
    prior["provenance"] = {
        "source": "calibrate+review",
        "run_id": run_id,
        "reviewed": k in reviewed_set,
        "override": override is not None,
    }
    return prior


def apply_calibration(votes_data: dict, proposals: dict, overrides: dict, reviewed_set: set) -> dict:
    """Migrate every votes entry to the forked schema and attach eligible calibrated priors.

    Returns a stats dict: {migrated, priors_written, overrides_written}.
    """
    votes = votes_data.setdefault("votes", {})
    run_id = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Migrate ALL entries to the forked schema (mirror legacy scalars into both frames).
    migrated = 0
    for name, entry in list(votes.items()):
        forked = migrate_entry(entry)
        if forked is not entry:
            migrated += 1
        votes[name] = forked

    priors_written = 0
    overrides_written = 0
    for k, proposal in proposals.items():
        eligible = (not proposal.get("needs_human_review")) or (k in reviewed_set) or (k in overrides)
        if not eligible:
            continue
        entry = votes.get(k)
        if entry is None:
            # No votes entry for this technique — nothing to attach the prior to (skip quietly;
            # regenerate_votes seeds entries for content techniques, but a proposal may name a
            # technique not present in votes.json).
            continue
        override = overrides.get(k)
        entry["prior"] = build_prior_blocks(proposal, override, k, reviewed_set, run_id)
        priors_written += 1
        if override is not None:
            overrides_written += 1

    return {"migrated": migrated, "priors_written": priors_written, "overrides_written": overrides_written}


def main():
    ap = argparse.ArgumentParser(description="Apply calibrated success-rate priors into votes.json")
    ap.add_argument("--dry-run", action="store_true", help="Report counts, write nothing")
    ap.add_argument("--votes", type=Path, default=DEFAULT_VOTES, help="votes.json to read (default: templates/votes.json)")
    ap.add_argument("--out", type=Path, default=None, help="Where to write (default: same as --votes)")
    ap.add_argument("--proposals", type=Path, default=DEFAULT_PROPOSALS)
    ap.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    ap.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    args = ap.parse_args()

    votes_data = _load_json(args.votes)
    proposals = _load_json(args.proposals)
    overrides = (_load_json(args.overrides) or {}).get("overrides", {})
    review = _load_json(args.review)
    reviewed_set = {item["technique"] for item in review if isinstance(item, dict) and "technique" in item}

    print(f"Applying calibration:")
    print(f"  votes:     {args.votes} ({len(votes_data.get('votes', {}))} entries)")
    print(f"  proposals: {args.proposals} ({len(proposals)} techniques)")
    print(f"  overrides: {args.overrides} ({len(overrides)} expert fixes)")
    print(f"  reviewed:  {args.review} ({len(reviewed_set)} reviewed names)")

    stats = apply_calibration(votes_data, proposals, overrides, reviewed_set)

    print(f"  entries migrated to forked schema: {stats['migrated']}")
    print(f"  priors written:                    {stats['priors_written']}")
    print(f"    of which expert overrides:       {stats['overrides_written']}")

    out_path = args.out or args.votes
    is_real = out_path.resolve() == DEFAULT_VOTES.resolve()
    # --dry-run NEVER writes the real templates/votes.json; an explicit non-real --out is a safe
    # test sink, so `--dry-run --out /tmp/x.json` still writes the copy for inspection.
    if args.dry_run and (args.out is None or is_real):
        print("  DRY RUN — nothing written.")
        return 0

    atomic_write_json(out_path, votes_data, indent=2, ensure_ascii=False)
    print(f"  Wrote {out_path}" + (" (dry-run test sink)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
