#!/usr/bin/env python3
"""
BJJ Graph from_position Audit
================================
Complete bidirectional consistency audit between position transition
references and technique from_position fields.

Output: tests/artifacts/from_position_audit.json

Usage:
    python3 scripts/audit_from_position.py
    python3 scripts/audit_from_position.py --summary
"""

import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict

CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
OUTPUT_PATH = Path("tests/artifacts/from_position_audit.json")


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: Could not load {path}: {e}", file=sys.stderr)
        return None


def build_position_reference_map():
    """Build map: technique_name -> list of {file, position, role, attempt_probability}."""
    ref_map = defaultdict(list)

    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue

        pos_name = data.get("name", path.stem)

        for role in ("top", "bottom"):
            role_data = data.get(role)
            if not role_data:
                continue
            transitions = role_data.get("transitions", [])
            for entry in transitions:
                t_name = entry.get("transition", "")
                if not t_name:
                    continue
                ref_map[t_name].append({
                    "file": str(path),
                    "position": pos_name,
                    "role": role,
                    "expected_from": f"{pos_name}/{role.capitalize()}",
                    "attempt_probability": entry.get("attempt_probability", 0),
                })

    return dict(ref_map)


def build_technique_index():
    """Build index of all transitions and submissions with their from_position."""
    transitions = {}
    submissions = {}

    for path in sorted(TRANSITIONS_PATH.glob("*.json")):
        data = load_json(path)
        if not data:
            continue
        name = data.get("name", path.stem)
        outcomes = data.get("outcomes", [])
        has_game_over = any(
            o.get("to", "").lower() in ("game-over", "game over")
            for o in outcomes
        )
        transitions[name] = {
            "file": str(path),
            "from_position": data.get("from_position", ""),
            "has_game_over": has_game_over,
            "outcomes": outcomes,
        }

    for path in sorted(SUBMISSIONS_PATH.glob("*.json")):
        data = load_json(path)
        if not data:
            continue
        name = data.get("name", path.stem)
        # Submissions may use starting_position or from_position
        from_pos = data.get("from_position", "") or data.get("starting_position", "")
        submissions[name] = {
            "file": str(path),
            "from_position": from_pos,
        }

    return transitions, submissions


def find_slug_collisions(transitions, submissions):
    """Find names that exist in BOTH Transitions/ and Submissions/."""
    collisions = []
    shared = set(transitions.keys()) & set(submissions.keys())
    for name in sorted(shared):
        collisions.append({
            "name": name,
            "transition_file": transitions[name]["file"],
            "transition_from_position": transitions[name]["from_position"],
            "transition_has_game_over": transitions[name]["has_game_over"],
            "submission_file": submissions[name]["file"],
            "submission_from_position": submissions[name]["from_position"],
        })
    return collisions


def check_variant_exists(technique_name, position_name, all_technique_names):
    """Check if a position-specific variant exists for this technique+position combo.

    Checks patterns like:
      "{technique} from {position}"
      "{position} to {technique}"
    """
    candidates = [
        f"{technique_name} from {position_name}",
    ]
    for candidate in candidates:
        if candidate in all_technique_names:
            return candidate
    return None


def classify_mismatches(ref_map, transitions, submissions):
    """Classify every reference into actionable categories."""
    all_technique_names = set(transitions.keys()) | set(submissions.keys())
    collision_names = set(transitions.keys()) & set(submissions.keys())

    results = {
        "match": [],
        "case_a": [],       # single-ref mismatch
        "case_b_fix": [],   # generic referenced, specific variant exists
        "case_b_accept": [],  # multi-ref generic, no variant (acceptable)
        "case_c": [],       # slug collision
        "case_d": [],       # role-only mismatch
        "not_found": [],    # technique file doesn't exist
        "dual_references": [],  # position refs both generic AND specific
    }

    # Detect dual references: position/role that references both generic and specific
    # e.g., Mount/Top refs both "Americana" (generic) and "Americana from Mount" (specific)
    dual_refs = _find_dual_references(ref_map, all_technique_names)
    results["dual_references"] = dual_refs

    for technique_name, refs in sorted(ref_map.items()):
        # Find the technique in transitions or submissions
        tech_info = transitions.get(technique_name) or submissions.get(technique_name)

        if not tech_info:
            for ref in refs:
                results["not_found"].append({
                    "technique": technique_name,
                    "referenced_by": ref,
                })
            continue

        actual_from = tech_info["from_position"]
        is_collision = technique_name in collision_names

        for ref in refs:
            expected_from = ref["expected_from"]

            # Check if from_position matches
            if _from_positions_match(actual_from, expected_from):
                results["match"].append({
                    "technique": technique_name,
                    "expected_from": expected_from,
                    "actual_from": actual_from,
                    "referenced_by": ref,
                })
                continue

            # It's a mismatch — classify it
            issue = {
                "technique": technique_name,
                "technique_file": tech_info["file"],
                "expected_from": expected_from,
                "actual_from": actual_from,
                "referenced_by": ref,
            }

            # Case C: slug collision (flag separately, also classify the mismatch)
            if is_collision:
                results["case_c"].append({
                    **issue,
                    "collision_info": {
                        "transition_from": transitions[technique_name]["from_position"] if technique_name in transitions else None,
                        "submission_from": submissions[technique_name]["from_position"] if technique_name in submissions else None,
                        "transition_has_game_over": transitions[technique_name]["has_game_over"] if technique_name in transitions else None,
                    }
                })

            # Case D: role-only mismatch (base position matches, role differs)
            # Only classify as Case D for single-ref techniques; multi-ref role
            # mismatches are acceptable (technique has one canonical from_position)
            if _base_position_matches(actual_from, expected_from):
                if len(refs) == 1:
                    results["case_d"].append(issue)
                else:
                    results["case_b_accept"].append(issue)
                continue

            # Check if a position-specific variant exists
            position_name = ref["position"]
            variant = check_variant_exists(technique_name, position_name, all_technique_names)

            if variant:
                # Case B-fix: specific variant exists
                # Check if this is a dual reference (position already refs the variant too)
                is_dual = any(
                    d["position"] == ref["position"]
                    and d["role"] == ref["role"]
                    and d["generic"] == technique_name
                    for d in dual_refs
                )
                results["case_b_fix"].append({
                    **issue,
                    "variant_name": variant,
                    "is_dual_reference": is_dual,
                })
                continue

            # Single-ref vs multi-ref
            if len(refs) == 1:
                # Case A: single-ref mismatch
                results["case_a"].append(issue)
            else:
                # Case B-accept: multi-ref generic, no variant
                results["case_b_accept"].append(issue)

    return results


def _find_dual_references(ref_map, all_technique_names):
    """Find positions that reference both a generic technique and its position-specific variant."""
    duals = []

    # Group refs by (position, role)
    pos_role_refs = defaultdict(list)
    for tech_name, refs in ref_map.items():
        for ref in refs:
            key = (ref["position"], ref["role"])
            pos_role_refs[key].append(tech_name)

    for (position, role), techniques in pos_role_refs.items():
        for tech in techniques:
            # Check if "{tech} from {position}" is also in the list
            variant = f"{tech} from {position}"
            if variant in techniques:
                duals.append({
                    "position": position,
                    "role": role,
                    "generic": tech,
                    "specific": variant,
                    "generic_prob": next(
                        (r["attempt_probability"] for r in ref_map[tech]
                         if r["position"] == position and r["role"] == role), 0
                    ),
                    "specific_prob": next(
                        (r["attempt_probability"] for r in ref_map[variant]
                         if r["position"] == position and r["role"] == role), 0
                    ),
                })

    return duals


def _from_positions_match(actual, expected):
    """Check if two from_position values refer to the same position/role."""
    if not actual or not expected:
        return False
    return actual.strip().lower() == expected.strip().lower()


def _base_position_matches(actual, expected):
    """Check if the base position name matches but the role differs."""
    if not actual or not expected:
        return False
    actual_base = actual.split("/")[0].strip().lower()
    expected_base = expected.split("/")[0].strip().lower()
    return actual_base == expected_base and not _from_positions_match(actual, expected)


def generate_report(ref_map, transitions, submissions, classified, collisions):
    """Generate the complete audit report."""
    total_refs = sum(len(refs) for refs in ref_map.values())

    report = {
        "summary": {
            "total_references": total_refs,
            "total_techniques_referenced": len(ref_map),
            "total_transitions": len(transitions),
            "total_submissions": len(submissions),
            "matches": len(classified["match"]),
            "mismatches": total_refs - len(classified["match"]) - len(classified["not_found"]),
            "case_a_single_ref_mismatch": len(classified["case_a"]),
            "case_b_fix_variant_exists": len(classified["case_b_fix"]),
            "case_b_accept_multi_ref_generic": len(classified["case_b_accept"]),
            "case_c_slug_collision": len(classified["case_c"]),
            "case_d_role_mismatch": len(classified["case_d"]),
            "dual_references": len(classified["dual_references"]),
            "not_found": len(classified["not_found"]),
        },
        "case_a": classified["case_a"],
        "case_b_fix": classified["case_b_fix"],
        "case_b_accept": classified["case_b_accept"],
        "case_c": classified["case_c"],
        "case_d": classified["case_d"],
        "dual_references": classified["dual_references"],
        "not_found": classified["not_found"],
        "slug_collisions": collisions,
    }

    return report


def print_summary(report):
    """Print human-readable summary."""
    s = report["summary"]
    print("=" * 60)
    print("BJJ Graph from_position Audit Report")
    print("=" * 60)
    print(f"Total position→technique references: {s['total_references']}")
    print(f"Total unique techniques referenced:   {s['total_techniques_referenced']}")
    print(f"Total transitions on disk:            {s['total_transitions']}")
    print(f"Total submissions on disk:            {s['total_submissions']}")
    print()
    print(f"  Matches:                  {s['matches']}")
    print(f"  Total mismatches:         {s['mismatches']}")
    print()
    print("Mismatch breakdown:")
    print(f"  Case A (single-ref):      {s['case_a_single_ref_mismatch']}  → FIX from_position")
    print(f"  Case B-fix (has variant): {s['case_b_fix_variant_exists']}  → FIX position ref → specific variant")
    print(f"  Case B-accept (generic):  {s['case_b_accept_multi_ref_generic']}  → ACCEPT (multi-ref canonical)")
    print(f"  Case C (slug collision):  {s['case_c_slug_collision']}  → FLAG for review")
    print(f"  Case D (role mismatch):   {s['case_d_role_mismatch']}  → FIX role in from_position")
    print(f"  Dual references:          {s['dual_references']}  → MERGE generic into specific")
    print(f"  Not found:                {s['not_found']}  → MISSING technique file")
    print()
    print(f"Actionable fixes: {s['case_a_single_ref_mismatch'] + s['case_b_fix_variant_exists'] + s['case_d_role_mismatch']} items")
    print(f"Slug collisions:  {len(report['slug_collisions'])} names shared between Transitions/ and Submissions/")

    if report["dual_references"]:
        print()
        print("Dual references (position refs BOTH generic AND specific):")
        for d in report["dual_references"]:
            print(f"  {d['position']}/{d['role'].capitalize()}: "
                  f"\"{d['generic']}\" ({d['generic_prob']}%) + "
                  f"\"{d['specific']}\" ({d['specific_prob']}%)")

    if report["case_a"]:
        print()
        print("Case A — Single-ref mismatches (fix from_position):")
        for item in report["case_a"]:
            print(f"  {item['technique']}: "
                  f"expected={item['expected_from']}, "
                  f"actual={item['actual_from']}")

    if report["case_d"]:
        print()
        print("Case D — Role mismatches (fix role in from_position):")
        for item in report["case_d"]:
            print(f"  {item['technique']}: "
                  f"expected={item['expected_from']}, "
                  f"actual={item['actual_from']}")


def main():
    parser = argparse.ArgumentParser(description="Audit from_position bidirectional consistency")
    parser.add_argument("--summary", action="store_true", help="Print summary only (no JSON output)")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH), help="Output JSON path")
    args = parser.parse_args()

    print("Building position reference map...")
    ref_map = build_position_reference_map()

    print("Building technique index...")
    transitions, submissions = build_technique_index()

    print("Finding slug collisions...")
    collisions = find_slug_collisions(transitions, submissions)

    print("Classifying mismatches...")
    classified = classify_mismatches(ref_map, transitions, submissions)

    report = generate_report(ref_map, transitions, submissions, classified, collisions)

    print_summary(report)

    if not args.summary:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nFull report written to: {output_path}")


if __name__ == "__main__":
    main()
