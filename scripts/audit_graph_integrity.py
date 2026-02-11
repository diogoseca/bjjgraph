#!/usr/bin/env python3
"""
BJJ Graph Integrity Audit
==========================
Comprehensive audit of the BJJ knowledge graph state machine.

Checks:
1. Orphaned transitions (files not referenced by any position)
2. Missing transitions (referenced by positions but no file exists)
3. Naming inconsistencies (near-matches suggesting rename fixes)
4. Position attempt_probability sums != 100%
5. Orphaned positions (not reachable from any transition outcome)
6. Transition outcome probability sums != 100%
7. Outcome outliers (high success, high counter, Unknown targets)
8. Attempt probability outliers (dominant/negligible transitions)

Usage:
    python3 scripts/audit_graph_integrity.py
    python3 scripts/audit_graph_integrity.py --output report.json
    python3 scripts/audit_graph_integrity.py --errors-only
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
REPORT_PATH = Path("tests/artifacts/audit_report.json")

# Thresholds for flagging outliers
THRESHOLDS = {
    "success_too_high": 85,      # Success outcome above this is suspicious
    "counter_too_high": 30,      # Counter outcome above this is unusual
    "attempt_too_low": 3,        # Attempt probability below this is negligible
    "attempt_too_high": 60,      # Single transition above this dominates
}

# Expected ranges by technique type
TECHNIQUE_EXPECTATIONS = {
    "sweep": {"success_min": 30, "success_max": 70},
    "escape": {"success_min": 25, "success_max": 60},
    "submission": {"success_min": 40, "success_max": 80},
    "pass": {"success_min": 35, "success_max": 75},
    "takedown": {"success_min": 30, "success_max": 65},
}


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: Could not load {path}: {e}", file=sys.stderr)
        return None


def levenshtein(s1, s2):
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr_row.append(min(curr_row[j] + 1, prev_row[j + 1] + 1, prev_row[j] + cost))
        prev_row = curr_row
    return prev_row[-1]


def classify_technique(name):
    """Classify technique by name for expected probability ranges."""
    name_lower = name.lower()
    if "sweep" in name_lower:
        return "sweep"
    if any(x in name_lower for x in ["escape", "defense"]):
        return "escape"
    if any(x in name_lower for x in ["choke", "lock", "bar", "crush", "crank"]):
        return "submission"
    if "pass" in name_lower:
        return "pass"
    if any(x in name_lower for x in ["takedown", "throw", "trip"]):
        return "takedown"
    return "general"


def build_transition_index():
    """Build map: transition_name -> file_path from all transition JSON files."""
    index = {}
    for path in sorted(TRANSITIONS_PATH.glob("*.json")):
        data = load_json(path)
        if not data:
            continue
        name = data.get("name", "")
        if name:
            index[name] = str(path)
    return index


def build_position_data():
    """Extract all transition references and probability sums from positions."""
    position_refs = {}  # position_file -> list of {role, transitions}
    all_referenced_transitions = set()
    probability_errors = []
    position_names = set()
    position_files = {}  # position_name -> file_path

    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue

        pos_name = data.get("name", path.stem)
        position_names.add(pos_name)
        position_files[pos_name] = str(path)

        roles_checked = []

        # Check root-level transitions (neutral positions)
        root_transitions = data.get("transitions", [])
        if root_transitions and "top" not in data and "bottom" not in data:
            names = [t.get("transition", "") for t in root_transitions]
            all_referenced_transitions.update(names)
            total = sum(t.get("attempt_probability", 0) for t in root_transitions)
            roles_checked.append(("root", names, total))
            if total != 100:
                probability_errors.append({
                    "file": str(path),
                    "position": pos_name,
                    "role": "root",
                    "sum": total,
                    "transition_count": len(root_transitions),
                    "severity": "error",
                })

        # Check top/bottom roles
        for role in ["top", "bottom"]:
            if role not in data:
                continue
            transitions = data[role].get("transitions", [])
            if not transitions:
                continue
            names = [t.get("transition", "") for t in transitions]
            all_referenced_transitions.update(names)
            total = sum(t.get("attempt_probability", 0) for t in transitions)
            roles_checked.append((role, names, total))
            if total != 100:
                probability_errors.append({
                    "file": str(path),
                    "position": pos_name,
                    "role": role,
                    "sum": total,
                    "transition_count": len(transitions),
                    "severity": "error",
                })

        position_refs[str(path)] = roles_checked

    return all_referenced_transitions, probability_errors, position_names, position_files


def build_reachable_positions(position_names):
    """Find positions reachable from transition outcomes."""
    reachable = set()

    # Add Standing Position as root
    reachable.add("Standing Position")

    # Scan all transition outcomes
    for path in sorted(TRANSITIONS_PATH.glob("*.json")):
        data = load_json(path)
        if not data:
            continue
        for outcome in data.get("outcomes", []):
            to_pos = outcome.get("to", "")
            if to_pos:
                reachable.add(to_pos)

    # Also check from_position fields (positions that have outgoing transitions)
    for path in sorted(TRANSITIONS_PATH.glob("*.json")):
        data = load_json(path)
        if not data:
            continue
        from_pos = data.get("from_position", "")
        if from_pos:
            # "Mount/Top" -> "Mount"
            base_pos = from_pos.split("/")[0]
            reachable.add(base_pos)

    return reachable


def find_naming_inconsistencies(orphaned_names, missing_names, max_distance=3):
    """Find near-matches between orphaned transition names and missing references."""
    matches = []
    for orphan in sorted(orphaned_names):
        for missing in sorted(missing_names):
            dist = levenshtein(orphan.lower(), missing.lower())
            if 0 < dist <= max_distance:
                matches.append({
                    "orphan_file_name": orphan,
                    "missing_reference": missing,
                    "distance": dist,
                })
    return matches


def check_outcome_probabilities():
    """Check outcome probability sums and outliers in Transitions and Submissions."""
    issues = []

    for source_path, label in [(TRANSITIONS_PATH, "Transition"), (SUBMISSIONS_PATH, "Submission")]:
        for path in sorted(source_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue

            name = data.get("name", path.stem)
            outcomes = data.get("outcomes", [])

            # Missing outcomes array
            if not outcomes:
                issues.append({
                    "file": str(path),
                    "name": name,
                    "type": "missing_outcomes",
                    "message": f"{label} has no outcomes array",
                    "severity": "error",
                })
                continue

            # Sum check
            total = sum(o.get("probability", 0) for o in outcomes)
            if total != 100:
                issues.append({
                    "file": str(path),
                    "name": name,
                    "type": "outcomes_sum",
                    "message": f"Outcomes sum to {total}%, not 100%",
                    "severity": "error",
                    "current": total,
                })

            # Individual outcome checks
            for o in outcomes:
                prob = o.get("probability", 0)
                result = o.get("result", "")
                to_pos = o.get("to", "")

                # Unknown target
                if "Unknown" in to_pos:
                    issues.append({
                        "file": str(path),
                        "name": name,
                        "type": "unknown_target",
                        "message": f"Outcome targets 'Unknown': {to_pos}",
                        "severity": "error",
                        "outcome": o,
                    })

                # Success too high
                if result == "success" and prob > THRESHOLDS["success_too_high"]:
                    issues.append({
                        "file": str(path),
                        "name": name,
                        "type": "outcome_too_high",
                        "message": f"Success probability {prob}% > {THRESHOLDS['success_too_high']}%",
                        "severity": "warning",
                        "outcome": o,
                    })

                # Counter too high
                if result == "counter" and prob > THRESHOLDS["counter_too_high"]:
                    issues.append({
                        "file": str(path),
                        "name": name,
                        "type": "counter_high",
                        "message": f"Counter probability {prob}% > {THRESHOLDS['counter_too_high']}%",
                        "severity": "warning",
                        "outcome": o,
                    })

            # Technique-type expected ranges (check success outcomes)
            technique_type = classify_technique(name)
            expectations = TECHNIQUE_EXPECTATIONS.get(technique_type, {})
            if expectations:
                for o in outcomes:
                    if o.get("result") == "success":
                        prob = o.get("probability", 0)
                        if prob > expectations.get("success_max", 100):
                            issues.append({
                                "file": str(path),
                                "name": name,
                                "type": "technique_range_high",
                                "message": f"Success {prob}% exceeds expected max {expectations['success_max']}% for {technique_type}",
                                "severity": "warning",
                                "current": prob,
                            })
                        if prob < expectations.get("success_min", 0):
                            issues.append({
                                "file": str(path),
                                "name": name,
                                "type": "technique_range_low",
                                "message": f"Success {prob}% below expected min {expectations['success_min']}% for {technique_type}",
                                "severity": "warning",
                                "current": prob,
                            })

    return issues


def check_transition_outliers():
    """Check for dominant/negligible attempt probabilities in positions."""
    issues = []

    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue

        pos_name = data.get("name", path.stem)

        for role in ["top", "bottom"]:
            if role not in data:
                continue
            transitions = data[role].get("transitions", [])
            for t in transitions:
                prob = t.get("attempt_probability", 0)
                name = t.get("transition", "")

                if prob > THRESHOLDS["attempt_too_high"]:
                    issues.append({
                        "file": str(path),
                        "position": pos_name,
                        "role": role,
                        "type": "attempt_dominant",
                        "message": f"{role}: '{name}' dominates with {prob}% attempt probability",
                        "severity": "info",
                        "transition": name,
                        "current": prob,
                    })

                if 0 < prob < THRESHOLDS["attempt_too_low"]:
                    issues.append({
                        "file": str(path),
                        "position": pos_name,
                        "role": role,
                        "type": "attempt_negligible",
                        "message": f"{role}: '{name}' has only {prob}% attempt probability",
                        "severity": "info",
                        "transition": name,
                        "current": prob,
                    })

        # Also check root-level transitions (neutral positions)
        root_transitions = data.get("transitions", [])
        if root_transitions and "top" not in data and "bottom" not in data:
            for t in root_transitions:
                prob = t.get("attempt_probability", 0)
                name = t.get("transition", "")

                if prob > THRESHOLDS["attempt_too_high"]:
                    issues.append({
                        "file": str(path),
                        "position": pos_name,
                        "role": "root",
                        "type": "attempt_dominant",
                        "message": f"root: '{name}' dominates with {prob}% attempt probability",
                        "severity": "info",
                        "transition": name,
                        "current": prob,
                    })

                if 0 < prob < THRESHOLDS["attempt_too_low"]:
                    issues.append({
                        "file": str(path),
                        "position": pos_name,
                        "role": "root",
                        "type": "attempt_negligible",
                        "message": f"root: '{name}' has only {prob}% attempt probability",
                        "severity": "info",
                        "transition": name,
                        "current": prob,
                    })

    return issues


def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph Integrity Audit — comprehensive graph checks"
    )
    parser.add_argument("--output", "-o", type=Path, default=REPORT_PATH,
                        help=f"Save JSON report to file (default: {REPORT_PATH})")
    parser.add_argument("--errors-only", "-e", action="store_true",
                        help="Only report error-severity issues (suppress warnings/info)")
    args = parser.parse_args()

    print("=" * 70)
    print("BJJ GRAPH INTEGRITY AUDIT")
    print("=" * 70)

    # Step 1: Build transition file index
    print("\n[1/8] Building transition file index...")
    transition_index = build_transition_index()
    print(f"  Found {len(transition_index)} transition files with names")

    # Step 2: Build position references
    print("[2/8] Scanning position files for transition references...")
    all_refs, prob_errors, position_names, position_files = build_position_data()
    print(f"  Found {len(all_refs)} unique transition references across positions")
    print(f"  Found {len(position_names)} position names")

    # Step 3: Compute orphaned and missing
    print("[3/8] Computing orphaned and missing transitions...")
    transition_file_names = set(transition_index.keys())
    orphaned = transition_file_names - all_refs
    missing = all_refs - transition_file_names

    print(f"  Orphaned transitions (file exists, not referenced): {len(orphaned)}")
    print(f"  Missing transitions (referenced, no file): {len(missing)}")

    # Step 4: Fuzzy matching
    print("[4/8] Finding naming inconsistencies (fuzzy matching)...")
    name_matches = find_naming_inconsistencies(orphaned, missing)
    print(f"  Found {len(name_matches)} potential name matches")

    # Step 5: Orphaned positions
    print("[5/8] Checking position reachability...")
    reachable = build_reachable_positions(position_names)
    orphaned_positions = position_names - reachable
    print(f"  Orphaned positions (not reachable): {len(orphaned_positions)}")

    # Step 6: Outcome probability checks
    print("[6/8] Checking outcome probabilities (Transitions + Submissions)...")
    outcome_issues = check_outcome_probabilities()
    outcome_errors = [i for i in outcome_issues if i["severity"] == "error"]
    outcome_warnings = [i for i in outcome_issues if i["severity"] == "warning"]
    print(f"  Errors: {len(outcome_errors)}, Warnings: {len(outcome_warnings)}")

    # Step 7: Transition attempt outliers
    print("[7/8] Checking attempt probability outliers...")
    outlier_issues = check_transition_outliers()
    print(f"  Info-level outliers: {len(outlier_issues)}")

    # Step 8: Summary
    print("[8/8] Compiling report...")

    # === Collect all issues with severity ===
    all_issues = []

    # Orphaned transitions (error)
    for name in sorted(orphaned):
        path = transition_index[name]
        data = load_json(path)
        from_pos = data.get("from_position", "NONE") if data else "LOAD_ERROR"
        all_issues.append({
            "type": "orphaned_transition",
            "severity": "error",
            "name": name,
            "file": path,
            "from_position": from_pos,
            "message": f"Orphaned transition: '{name}' (from: {from_pos})",
        })

    # Missing transitions (error)
    for name in sorted(missing):
        all_issues.append({
            "type": "missing_transition",
            "severity": "error",
            "name": name,
            "message": f"Missing transition: '{name}' (referenced but no file)",
        })

    # Probability sum errors (error)
    for e in prob_errors:
        all_issues.append({
            "type": "attempt_sum",
            "severity": "error",
            "file": e["file"],
            "position": e["position"],
            "role": e["role"],
            "sum": e["sum"],
            "message": f"{e['position']} [{e['role']}]: attempt_probability sums to {e['sum']}%",
        })

    # Orphaned positions (error)
    for name in sorted(orphaned_positions):
        all_issues.append({
            "type": "orphaned_position",
            "severity": "error",
            "name": name,
            "message": f"Orphaned position: '{name}' (not reachable)",
        })

    # Outcome issues (mixed severity)
    all_issues.extend(outcome_issues)

    # Outlier issues (info)
    all_issues.extend(outlier_issues)

    # === Filter if requested ===
    if args.errors_only:
        all_issues = [i for i in all_issues if i["severity"] == "error"]

    # === REPORT ===
    by_severity = defaultdict(list)
    for issue in all_issues:
        by_severity[issue["severity"]].append(issue)

    by_type = defaultdict(list)
    for issue in all_issues:
        by_type[issue["type"]].append(issue)

    print("\n" + "=" * 70)
    print("DETAILED REPORT")
    print("=" * 70)

    # Orphaned transitions
    orphan_details = [i for i in all_issues if i["type"] == "orphaned_transition"]
    print(f"\n--- ORPHANED TRANSITIONS ({len(orphan_details)}) ---")
    print("(Files that exist but no position references them)")
    for i in orphan_details:
        print(f"  {i['name']}")
        print(f"    file: {i['file']}")
        print(f"    from_position: {i.get('from_position', 'N/A')}")

    # Missing transitions
    missing_details = [i for i in all_issues if i["type"] == "missing_transition"]
    print(f"\n--- MISSING TRANSITIONS ({len(missing_details)}) ---")
    print("(Referenced by positions but no file exists)")
    for i in missing_details:
        print(f"  {i['name']}")

    # Naming inconsistencies
    print(f"\n--- NAMING INCONSISTENCIES ({len(name_matches)}) ---")
    print("(Orphan file name ~ Missing reference, Levenshtein <= 3)")
    for m in name_matches:
        print(f"  ORPHAN: '{m['orphan_file_name']}' <-> MISSING: '{m['missing_reference']}' (distance={m['distance']})")

    # Position attempt_probability errors
    attempt_sum_errors = [i for i in all_issues if i["type"] == "attempt_sum"]
    print(f"\n--- POSITION ATTEMPT_PROBABILITY ERRORS ({len(attempt_sum_errors)}) ---")
    for e in attempt_sum_errors:
        print(f"  {e['position']} [{e['role']}]: sum={e['sum']}%")

    # Orphaned positions
    orphaned_pos_issues = [i for i in all_issues if i["type"] == "orphaned_position"]
    print(f"\n--- ORPHANED POSITIONS ({len(orphaned_pos_issues)}) ---")
    print("(Not referenced by any transition outcome or from_position)")
    for i in orphaned_pos_issues:
        print(f"  {i['name']}")

    # Outcome probability errors
    outcome_sum_errors = [i for i in all_issues if i["type"] == "outcomes_sum"]
    outcome_missing = [i for i in all_issues if i["type"] == "missing_outcomes"]
    outcome_unknown = [i for i in all_issues if i["type"] == "unknown_target"]
    print(f"\n--- OUTCOME PROBABILITY ERRORS ({len(outcome_sum_errors) + len(outcome_missing) + len(outcome_unknown)}) ---")
    for e in outcome_missing:
        print(f"  {e['name']}: {e['message']}")
    for e in outcome_sum_errors:
        print(f"  {e['name']}: {e['message']}")
    for e in outcome_unknown:
        print(f"  {e['name']}: {e['message']}")

    # Outcome warnings (always compute for report, only print if not errors-only)
    outcome_warns = [i for i in all_issues if i["type"] in ("outcome_too_high", "counter_high", "technique_range_high", "technique_range_low")]
    attempt_outliers = [i for i in all_issues if i["type"] in ("attempt_dominant", "attempt_negligible")]

    if not args.errors_only:
        print(f"\n--- OUTCOME WARNINGS ({len(outcome_warns)}) ---")
        for w in outcome_warns[:20]:
            print(f"  {w['name']}: {w['message']}")
        if len(outcome_warns) > 20:
            print(f"  ... and {len(outcome_warns) - 20} more")

        print(f"\n--- ATTEMPT PROBABILITY OUTLIERS ({len(attempt_outliers)}) ---")
        for o in attempt_outliers[:20]:
            print(f"  {o['message']}")
        if len(attempt_outliers) > 20:
            print(f"  ... and {len(attempt_outliers) - 20} more")

    # Summary
    error_count = len(by_severity["error"])
    warning_count = len(by_severity["warning"])
    info_count = len(by_severity["info"])

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Transition files:       {len(transition_index)}")
    print(f"  Position files:         {len(position_names)}")
    print(f"  Total issues:           {len(all_issues)}")
    print(f"    Errors:               {error_count}")
    print(f"    Warnings:             {warning_count}")
    print(f"    Info:                 {info_count}")
    print()
    print(f"  By type:")
    for issue_type, items in sorted(by_type.items()):
        sev = items[0]["severity"] if items else "?"
        print(f"    {issue_type}: {len(items)} ({sev})")

    # Save JSON report
    report = {
        "summary": {
            "transition_files": len(transition_index),
            "position_files": len(position_names),
            "total_issues": len(all_issues),
            "errors": error_count,
            "warnings": warning_count,
            "info": info_count,
            "orphaned_transitions": len(orphan_details),
            "missing_transitions": len(missing_details),
            "naming_matches": len(name_matches),
            "probability_errors": len(attempt_sum_errors),
            "orphaned_positions": len(orphaned_pos_issues),
            "outcome_errors": len(outcome_sum_errors) + len(outcome_missing) + len(outcome_unknown),
            "outcome_warnings": len(outcome_warns),
            "attempt_outliers": len(attempt_outliers),
        },
        "issues": all_issues,
        "naming_inconsistencies": name_matches,
    }

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nJSON report saved to: {output_path}")

    # Exit code 1 only for error-severity issues
    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
