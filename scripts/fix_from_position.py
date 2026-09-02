#!/usr/bin/env python3
"""
BJJ Graph from_position Fix Script
=====================================
Fixes data consistency issues identified by audit_from_position.py.

Reads: tests/artifacts/from_position_audit.json
Modifies: content/Transitions/*.json, content/Submissions/*.json, content/Positions/*.json

Usage:
    python3 scripts/fix_from_position.py                # apply all fixes
    python3 scripts/fix_from_position.py --dry-run      # show planned changes
    python3 scripts/fix_from_position.py --case d       # fix only Case D (role mismatches)
    python3 scripts/fix_from_position.py --case a       # fix only Case A (single-ref)
    python3 scripts/fix_from_position.py --case b       # fix only Case B-fix (generic→specific)
    python3 scripts/fix_from_position.py --case dual    # fix only dual references
"""

import argparse
import json
import sys
from pathlib import Path

AUDIT_PATH = Path("tests/artifacts/from_position_audit.json")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ruleset import as_map, sum_cells, present_rulesets, RULESETS  # {gi,nogi} contract (calibration-v2)


def merge_cells(a, b):
    """Sum two attempt-probability cells for ONE frame, under the null contract.

    A null cell means "this edge does not exist in that ruleset" (scripts/_ruleset.py), so
    it is ABSENT from the sum rather than a 0 inside it — and if BOTH sides are absent the
    merged cell is absent too. The five-way table, measured:

        generic / variant      shipped `(g or 0) + (v or 0)`   this           verdict
        60 / 60                120                             120            same
        null / 30              30                              30             same
        0 / null               0                               0              same
        null / 0               0                               0              same
        null / null            0                               None           THE DEFECT

    One row in five, and it is the row that matters: merging two edges that exist in
    neither ruleset minted one that exists in both, at 0%, which reads as "available, never
    attempted" forever after.

    ONE function, TWO callers — fix_case_b's merge and fix_dual_references' — because they
    were two answers to one question and §6.5 says the second one is already wrong. It was:
    fix_dual_references did `generic_prob + variant_prob` on the raw values, which have been
    {gi,nogi} DICTS since calibration-v2, so `--case dual` died with
    `TypeError: unsupported operand type(s) for +: 'dict' and 'dict'` and `--case all` (i.e.
    `npm run fix:from-position`) reached the same line after already writing Cases D, A
    and B. Collapse to one named seam BEFORE a third caller exists.
    """
    cells = [c for c in (a, b) if c is not None]
    return sum(cells) if cells else None


def load_json(path):
    # RAW load (no ruleset reduce): this script saves what it loads — a reduced
    # load would flatten divergent {gi,nogi} attempt maps and destroy the gi frame.
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: Could not load {path}: {e}", file=sys.stderr)
        return None


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def validate_probability_sum(data, role_name):
    """Verify that transitions attempt_probability sums to 100 for a role.

    Checks the frames that EXIST (present_rulesets), never the RULESETS pair blind. Under
    the null contract a null cell means the edge does not exist in that ruleset, so a
    legitimately gi-only role has no no-gi frame and no no-gi sum to check — and
    `all(sum == 100 for rs in RULESETS)` answered False for the entire class the null layer
    creates. Measured: healthy both-frame role -> True; healthy gi-only role (nogi all
    null, gi sums 100) -> False, printing "Probability sum != 100 ... after edit!" and
    filing an error row; genuinely BROKEN gi-only role (gi sums 90) -> also False. A check
    whose answer is constant-False across a class carries no information about that class,
    which is worse than not running — and this script runs UNATTENDED every Saturday in
    .github/workflows/validation-fixer.yml, so nobody is watching when it is wrong.

    §6.6: the pass path prints its coverage, and "no frame at all" is an ERROR rather than
    a vacuous True, so "checked nothing" can never read like "found nothing wrong".
    """
    role_data = data.get(role_name)
    if not role_data:
        return True
    transitions = role_data.get("transitions", [])
    if not transitions:
        return True
    frames = present_rulesets(t.get("attempt_probability") for t in transitions
                              if isinstance(t, dict))
    if not frames:
        print(f"  ERROR: {role_name}: {len(transitions)} transitions but NO present ruleset "
              "frame — every attempt_probability cell is null", file=sys.stderr)
        return False
    print(f"  checked {len(frames)} frame(s) {frames} across {len(transitions)} "
          f"transitions in {role_name}")
    return all(
        sum_cells(transitions, "attempt_probability", rs) == 100 for rs in frames
    )


def fix_case_d(issues, dry_run):
    """Fix role-only mismatches: update from_position role to match referencing position."""
    results = []

    for issue in issues:
        technique_file = issue["technique_file"]
        expected = issue["expected_from"]
        actual = issue["actual_from"]

        data = load_json(technique_file)
        if not data:
            results.append({"file": technique_file, "status": "error", "reason": "could not load"})
            continue

        action = {
            "file": technique_file,
            "technique": issue["technique"],
            "old_from_position": actual,
            "new_from_position": expected,
        }

        if dry_run:
            action["status"] = "dry_run"
            results.append(action)
            print(f"  [DRY RUN] Case D: {issue['technique']}: {actual} → {expected}")
            continue

        data["from_position"] = expected
        save_json(technique_file, data)
        action["status"] = "fixed"
        results.append(action)
        print(f"  [FIXED] Case D: {issue['technique']}: {actual} → {expected}")

    return results


def fix_case_a(issues, dry_run):
    """Fix single-ref mismatches: update from_position to match the single referencing position."""
    results = []

    for issue in issues:
        technique_file = issue["technique_file"]
        expected = issue["expected_from"]
        actual = issue["actual_from"]

        data = load_json(technique_file)
        if not data:
            results.append({"file": technique_file, "status": "error", "reason": "could not load"})
            continue

        action = {
            "file": technique_file,
            "technique": issue["technique"],
            "old_from_position": actual,
            "new_from_position": expected,
        }

        if dry_run:
            action["status"] = "dry_run"
            results.append(action)
            print(f"  [DRY RUN] Case A: {issue['technique']}: {actual} → {expected}")
            continue

        data["from_position"] = expected
        save_json(technique_file, data)
        action["status"] = "fixed"
        results.append(action)
        print(f"  [FIXED] Case A: {issue['technique']}: {actual} → {expected}")

    return results


def fix_case_b(issues, dual_refs, dry_run):
    """Fix generic→specific: update position JSON to reference specific variant.

    Two sub-cases:
    1. Dual reference: position refs both generic and specific → merge probabilities
    2. Single reference to generic: rename to specific variant
    """
    results = []

    # Group by position file to batch edits
    edits_by_file = {}
    for issue in issues:
        pos_file = issue["referenced_by"]["file"]
        if pos_file not in edits_by_file:
            edits_by_file[pos_file] = []
        edits_by_file[pos_file].append(issue)

    for pos_file, file_issues in edits_by_file.items():
        data = load_json(pos_file)
        if not data:
            results.append({"file": pos_file, "status": "error", "reason": "could not load"})
            continue

        modified = False

        for issue in file_issues:
            role = issue["referenced_by"]["role"]
            generic_name = issue["technique"]
            variant_name = issue["variant_name"]
            is_dual = issue.get("is_dual_reference", False)

            role_data = data.get(role)
            if not role_data:
                continue
            transitions = role_data.get("transitions", [])

            # Find the generic entry
            generic_idx = None
            variant_idx = None
            for i, t in enumerate(transitions):
                if t.get("transition") == generic_name:
                    generic_idx = i
                if t.get("transition") == variant_name:
                    variant_idx = i

            if generic_idx is None:
                results.append({
                    "file": pos_file,
                    "technique": generic_name,
                    "status": "skipped",
                    "reason": "generic entry not found in transitions array",
                })
                continue

            action = {
                "file": pos_file,
                "role": role,
                "generic": generic_name,
                "variant": variant_name,
            }

            if is_dual and variant_idx is not None:
                # Merge: add generic probability to variant, remove generic
                # No `, 0` default: a MISSING attempt_probability asserts nothing, and
                # as_map(0) would turn that silence into "exists in both rulesets, never
                # attempted". as_map(None) is {gi:None, nogi:None} — unasserted. Zero
                # instances today (0 of 5,086 cells in content/Positions lack the key).
                generic_prob = as_map(transitions[generic_idx].get("attempt_probability"))
                variant_prob = as_map(transitions[variant_idx].get("attempt_probability"))
                new_prob = {rs: merge_cells(generic_prob.get(rs), variant_prob.get(rs))
                            for rs in RULESETS}

                action["type"] = "merge"
                action["generic_prob"] = generic_prob
                action["variant_prob"] = variant_prob
                action["merged_prob"] = new_prob
                # positive coverage on the line the [FIXED]/[DRY RUN] reader is reading:
                # a merge that dropped a frame has to say so, not just print a smaller dict
                action["null_cells_preserved"] = sum(
                    1 for rs in RULESETS if new_prob[rs] is None)

                if dry_run:
                    action["status"] = "dry_run"
                    results.append(action)
                    print(f"  [DRY RUN] Case B merge: {pos_file} {role}: "
                          f"\"{generic_name}\" ({generic_prob}%) + "
                          f"\"{variant_name}\" ({variant_prob}%) → "
                          f"\"{variant_name}\" ({new_prob}%)")
                    continue

                transitions[variant_idx]["attempt_probability"] = new_prob
                transitions.pop(generic_idx)
                modified = True
                action["status"] = "fixed"
                results.append(action)
                print(f"  [FIXED] Case B merge: {pos_file} {role}: "
                      f"\"{generic_name}\" ({generic_prob}%) + "
                      f"\"{variant_name}\" ({variant_prob}%) → "
                      f"\"{variant_name}\" ({new_prob}%)")
            else:
                # Rename: change generic to variant
                action["type"] = "rename"
                # No `, 0` default. This is a REPORT field — the rename branch changes the
                # transition's NAME and never touches its probability — but a 0 here would
                # print "exists in both rulesets, never attempted" about a transition that
                # asserted nothing, and a report is where the next reader's number comes
                # from. as_map(None) is {gi:None, nogi:None}: unasserted. No-op today
                # (0 of 5,086 position cells lack the key).
                action["probability"] = as_map(
                    transitions[generic_idx].get("attempt_probability"))

                if dry_run:
                    action["status"] = "dry_run"
                    results.append(action)
                    print(f"  [DRY RUN] Case B rename: {pos_file} {role}: "
                          f"\"{generic_name}\" → \"{variant_name}\"")
                    continue

                transitions[generic_idx]["transition"] = variant_name
                modified = True
                action["status"] = "fixed"
                results.append(action)
                print(f"  [FIXED] Case B rename: {pos_file} {role}: "
                      f"\"{generic_name}\" → \"{variant_name}\"")

        if modified and not dry_run:
            # Validate probability sums
            for role in ("top", "bottom"):
                if not validate_probability_sum(data, role):
                    print(f"  ERROR: Probability sum != 100 in {pos_file} {role} after edit!",
                          file=sys.stderr)
                    results.append({
                        "file": pos_file,
                        "role": role,
                        "status": "error",
                        "reason": "probability sum != 100 after edit",
                    })
            save_json(pos_file, data)

    return results


def fix_dual_references(dual_refs, dry_run):
    """Fix dual references that weren't covered by case_b_fix.

    Some dual references might not appear in case_b_fix because
    from_position actually matches for the generic. Handle those here.
    """
    results = []

    # Group by position file
    edits_by_file = {}
    for dual in dual_refs:
        # Need to find the position file
        pos_name = dual["position"]
        pos_file = None
        for p in Path("content/Positions").rglob("*.json"):
            d = load_json(p)
            if d and d.get("name") == pos_name:
                pos_file = str(p)
                break

        if not pos_file:
            results.append({
                "position": pos_name,
                "status": "skipped",
                "reason": "position file not found",
            })
            continue

        if pos_file not in edits_by_file:
            edits_by_file[pos_file] = []
        edits_by_file[pos_file].append(dual)

    for pos_file, duals in edits_by_file.items():
        data = load_json(pos_file)
        if not data:
            continue

        modified = False

        for dual in duals:
            role = dual["role"]
            generic_name = dual["generic"]
            variant_name = dual["specific"]

            role_data = data.get(role)
            if not role_data:
                continue
            transitions = role_data.get("transitions", [])

            generic_idx = None
            variant_idx = None
            for i, t in enumerate(transitions):
                if t.get("transition") == generic_name:
                    generic_idx = i
                if t.get("transition") == variant_name:
                    variant_idx = i

            if generic_idx is None or variant_idx is None:
                # Already fixed by case_b or no longer present
                continue

            # `generic_prob + variant_prob` on the raw values was dict + dict — a TypeError
            # on every run since calibration-v2. Same merge as fix_case_b's, so it calls the
            # same helper: two answers to one question is how it diverged in the first place.
            generic_prob = as_map(transitions[generic_idx].get("attempt_probability"))
            variant_prob = as_map(transitions[variant_idx].get("attempt_probability"))
            new_prob = {rs: merge_cells(generic_prob.get(rs), variant_prob.get(rs))
                        for rs in RULESETS}

            action = {
                "file": pos_file,
                "role": role,
                "generic": generic_name,
                "variant": variant_name,
                "generic_prob": generic_prob,
                "variant_prob": variant_prob,
                "merged_prob": new_prob,
                "null_cells_preserved": sum(1 for rs in RULESETS if new_prob[rs] is None),
            }

            if dry_run:
                action["status"] = "dry_run"
                results.append(action)
                print(f"  [DRY RUN] Dual merge: {pos_file} {role}: "
                      f"\"{generic_name}\" ({generic_prob}%) + "
                      f"\"{variant_name}\" ({variant_prob}%) → "
                      f"\"{variant_name}\" ({new_prob}%)")
                continue

            transitions[variant_idx]["attempt_probability"] = new_prob
            transitions.pop(generic_idx)
            modified = True
            action["status"] = "fixed"
            results.append(action)
            print(f"  [FIXED] Dual merge: {pos_file} {role}: "
                  f"\"{generic_name}\" ({generic_prob}%) + "
                  f"\"{variant_name}\" ({variant_prob}%) → "
                  f"\"{variant_name}\" ({new_prob}%)")

        if modified and not dry_run:
            for role in ("top", "bottom"):
                if not validate_probability_sum(data, role):
                    print(f"  ERROR: Probability sum != 100 in {pos_file} {role}!",
                          file=sys.stderr)
            save_json(pos_file, data)

    return results


def main():
    parser = argparse.ArgumentParser(description="Fix from_position consistency issues")
    parser.add_argument("--dry-run", action="store_true", help="Show planned changes without writing")
    parser.add_argument("--case", type=str, choices=["a", "b", "d", "dual", "all"],
                        default="all", help="Fix only specific case type")
    args = parser.parse_args()

    if not AUDIT_PATH.exists():
        print(f"ERROR: Audit report not found at {AUDIT_PATH}", file=sys.stderr)
        print("Run: python3 scripts/audit_from_position.py", file=sys.stderr)
        sys.exit(1)

    with open(AUDIT_PATH, "r", encoding="utf-8") as f:
        audit = json.load(f)

    all_results = {}
    mode = "DRY RUN" if args.dry_run else "APPLYING FIXES"

    print(f"{'=' * 60}")
    print(f"BJJ Graph from_position Fix — {mode}")
    print(f"{'=' * 60}")

    # Case D: role mismatches (safest, do first)
    if args.case in ("d", "all"):
        print(f"\n--- Case D: Role mismatches ({len(audit['case_d'])} issues) ---")
        all_results["case_d"] = fix_case_d(audit["case_d"], args.dry_run)

    # Case A: single-ref mismatches
    if args.case in ("a", "all"):
        print(f"\n--- Case A: Single-ref mismatches ({len(audit['case_a'])} issues) ---")
        all_results["case_a"] = fix_case_a(audit["case_a"], args.dry_run)

    # Case B-fix: generic→specific (update position references)
    if args.case in ("b", "all"):
        print(f"\n--- Case B-fix: Generic→specific ({len(audit['case_b_fix'])} issues) ---")
        all_results["case_b_fix"] = fix_case_b(
            audit["case_b_fix"], audit["dual_references"], args.dry_run
        )

    # Dual references: merge remaining duals not covered by case_b
    if args.case in ("dual", "all"):
        print(f"\n--- Dual references: Merge generic into specific ({len(audit['dual_references'])} items) ---")
        all_results["dual_refs"] = fix_dual_references(
            audit["dual_references"], args.dry_run
        )

    # Summary
    print(f"\n{'=' * 60}")
    total_fixed = sum(
        len([r for r in results if r.get("status") == "fixed"])
        for results in all_results.values()
    )
    total_dry = sum(
        len([r for r in results if r.get("status") == "dry_run"])
        for results in all_results.values()
    )
    total_errors = sum(
        len([r for r in results if r.get("status") == "error"])
        for results in all_results.values()
    )
    total_skipped = sum(
        len([r for r in results if r.get("status") == "skipped"])
        for results in all_results.values()
    )

    # §6.6 positive coverage: a merge that dropped a frame prints here whether or not
    # anybody read the per-action lines, so "merged nothing away" and "merged a whole
    # ruleset away" cannot produce the same summary.
    merges = [r for results in all_results.values() for r in results
              if "null_cells_preserved" in r]
    print(f"Merges inspected: {len(merges)}  "
          f"null cells preserved: {sum(r['null_cells_preserved'] for r in merges)}")

    if args.dry_run:
        print(f"Dry run complete: {total_dry} changes planned, {total_skipped} skipped")
    else:
        print(f"Fixes applied: {total_fixed}, Errors: {total_errors}, Skipped: {total_skipped}")

    if not args.dry_run:
        print("\nNext steps:")
        print("  python3 scripts/audit_from_position.py   # Re-audit to verify fixes")
        print("  npm run validate:graph                    # Run validation")
        print("  npm run regenerate:graph                  # Update graph.json")


if __name__ == "__main__":
    main()
