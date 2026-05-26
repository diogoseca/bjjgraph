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
    python3 scripts/validate_graph.py
    python3 scripts/validate_graph.py --output report.json
    python3 scripts/validate_graph.py --errors-only
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
    "sweep": {"success_min": 15, "success_max": 75},
    "escape": {"success_min": 5, "success_max": 80},
    "submission": {"success_min": 30, "success_max": 85},
    "pass": {"success_min": 10, "success_max": 80},
    "takedown": {"success_min": 25, "success_max": 70},
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

    # Exclusions: position/control names that contain submission keywords
    non_submission_names = [
        "lockdown", "body lock", "leg lock control", "arm lock control",
        "ankle lock control", "kneebar control", "dead orchard",
    ]
    if any(excl in name_lower for excl in non_submission_names):
        return "general"

    if "sweep" in name_lower:
        return "sweep"
    if any(x in name_lower for x in ["escape", "defense", "recovery"]):
        return "escape"
    # "Entry" techniques are transitions, not submissions
    if "entry" in name_lower or "setup" in name_lower:
        return "general"
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
    for path in sorted(TRANSITIONS_PATH.rglob("*.json")):
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
    """Find positions reachable from transition and submission outcomes."""
    reachable = set()

    # Add Standing Position as root
    reachable.add("Standing Position")

    # Scan all transition outcomes
    for path in sorted(TRANSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        for outcome in data.get("outcomes", []):
            to_pos = outcome.get("to", "")
            if to_pos:
                reachable.add(to_pos)

    # Scan all submission outcomes
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        for outcome in data.get("outcomes", []):
            to_pos = outcome.get("to", "")
            if to_pos:
                reachable.add(to_pos)

    # Also check from_position fields (positions that have outgoing transitions)
    for cat_path in [TRANSITIONS_PATH, SUBMISSIONS_PATH]:
        for path in sorted(cat_path.rglob("*.json")):
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


def check_targets_outcome_consistency():
    """Validate that targets_outcome values in attacker/defender match outcomes[].to."""
    issues = []

    for cat_path, cat_name in [(TRANSITIONS_PATH, "Transitions"), (SUBMISSIONS_PATH, "Submissions")]:
        for path in sorted(cat_path.rglob("*.json")):
            data = load_json(path)
            if not data or 'attacker' not in data or 'defender' not in data:
                continue

            valid_targets = {o.get('to', '') for o in data.get('outcomes', []) if o.get('to')}
            name = data.get('name', path.stem)

            # Check attacker.common_counters[].targets_outcome
            for i, counter in enumerate(data.get('attacker', {}).get('common_counters', [])):
                target = counter.get('targets_outcome', '')
                if target and target != 'TODO' and target not in valid_targets:
                    issues.append({
                        "type": "targets_outcome_mismatch",
                        "severity": "warning",
                        "name": name,
                        "file": str(path),
                        "category": cat_name,
                        "field": f"attacker.common_counters[{i}].targets_outcome",
                        "value": target,
                        "message": f"{name}: attacker.common_counters[{i}].targets_outcome '{target}' not in outcomes",
                    })

            # Check defender.defensive_options[].targets_outcome
            for i, option in enumerate(data.get('defender', {}).get('defensive_options', [])):
                target = option.get('targets_outcome', '')
                if target and target != 'TODO' and target not in valid_targets:
                    issues.append({
                        "type": "targets_outcome_mismatch",
                        "severity": "warning",
                        "name": name,
                        "file": str(path),
                        "category": cat_name,
                        "field": f"defender.defensive_options[{i}].targets_outcome",
                        "value": target,
                        "message": f"{name}: defender.defensive_options[{i}].targets_outcome '{target}' not in outcomes",
                    })

            # Check defender.favorable_outcomes[].outcome
            for i, fav in enumerate(data.get('defender', {}).get('favorable_outcomes', [])):
                target = fav.get('outcome', '')
                if target and target != 'TODO' and target not in valid_targets:
                    issues.append({
                        "type": "targets_outcome_mismatch",
                        "severity": "warning",
                        "name": name,
                        "file": str(path),
                        "category": cat_name,
                        "field": f"defender.favorable_outcomes[{i}].outcome",
                        "value": target,
                        "message": f"{name}: defender.favorable_outcomes[{i}].outcome '{target}' not in outcomes",
                    })

    return issues


def check_minimum_connectivity(position_names, transition_index):
    """Flag nodes with fewer than 3 connections (incoming + outgoing)."""
    issues = []
    connection_counts = defaultdict(int)

    # Count outgoing connections from positions (transitions referenced)
    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        pos_name = data.get("name", path.stem)
        for role in ["top", "bottom"]:
            if role in data:
                transitions = data[role].get("transitions", [])
                connection_counts[pos_name] += len(transitions)
        # Neutral positions
        if "transitions" in data and "top" not in data:
            connection_counts[pos_name] += len(data["transitions"])

    # Count incoming connections from transition and submission outcomes
    for cat_path in [TRANSITIONS_PATH, SUBMISSIONS_PATH]:
        for path in sorted(cat_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue
            for outcome in data.get("outcomes", []):
                to_pos = outcome.get("to", "")
                if to_pos and to_pos.lower() != "game-over":
                    base = to_pos.split("/")[0]
                    connection_counts[base] += 1

    # Flag low connectivity
    for pos_name in sorted(position_names):
        count = connection_counts.get(pos_name, 0)
        if count < 3:
            issues.append({
                "type": "low_connectivity",
                "severity": "warning",
                "name": pos_name,
                "connections": count,
                "message": f"Low connectivity: '{pos_name}' has only {count} connections (minimum 3 recommended)",
            })

    return issues


def check_from_position_validity(position_names):
    """Validate that from_position fields point to valid positions."""
    issues = []

    for cat_path, cat_name in [(TRANSITIONS_PATH, "Transition"), (SUBMISSIONS_PATH, "Submission")]:
        for path in sorted(cat_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue

            name = data.get("name", path.stem)
            from_pos = data.get("from_position", "")
            if not from_pos:
                continue

            # "Mount/Top" -> "Mount"
            base_pos = from_pos.split("/")[0]
            if base_pos not in position_names and base_pos != "game-over":
                issues.append({
                    "type": "invalid_from_position",
                    "severity": "error",
                    "name": name,
                    "file": str(path),
                    "category": cat_name,
                    "from_position": from_pos,
                    "message": f"{cat_name} '{name}': from_position '{from_pos}' references unknown position '{base_pos}'",
                })

    return issues


def check_from_position_bidirectional(position_names):
    """Validate bidirectional consistency between position refs and technique from_position.

    For each position → technique reference, checks if the technique's from_position
    matches the referencing position. Only flags single-ref mismatches as errors;
    multi-ref generics are acceptable (INFO).
    """
    issues = []

    # Build position reference map: technique_name -> [(position, role, file)]
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
            for entry in role_data.get("transitions", []):
                t_name = entry.get("transition", "")
                if t_name:
                    ref_map[t_name].append({
                        "position": pos_name,
                        "role": role,
                        "expected_from": f"{pos_name}/{role.capitalize()}",
                        "file": str(path),
                    })

    # Build technique from_position index
    tech_from = {}
    for cat_path in (TRANSITIONS_PATH, SUBMISSIONS_PATH):
        for path in sorted(cat_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue
            name = data.get("name", path.stem)
            from_pos = data.get("from_position", "")
            if name not in tech_from:  # transitions take priority over submissions
                tech_from[name] = {"from_position": from_pos, "file": str(path)}

    # Check all technique names that also exist as position-specific variants
    all_tech_names = set(tech_from.keys())

    for tech_name, refs in ref_map.items():
        if tech_name not in tech_from:
            continue
        actual_from = tech_from[tech_name]["from_position"]
        if not actual_from:
            continue

        for ref in refs:
            expected = ref["expected_from"]
            if actual_from.strip().lower() == expected.strip().lower():
                continue  # match

            # Mismatch found — determine severity
            is_single_ref = len(refs) == 1

            # Check if a position-specific variant exists
            variant_name = f"{tech_name} from {ref['position']}"
            has_variant = variant_name in all_tech_names

            if is_single_ref:
                severity = "error"
                msg = (f"Single-ref mismatch: '{tech_name}' referenced by "
                       f"{ref['position']}/{ref['role']} but from_position is '{actual_from}'")
            elif has_variant:
                severity = "warning"
                msg = (f"Use specific variant: '{ref['position']}/{ref['role']}' references "
                       f"'{tech_name}' but '{variant_name}' exists")
            else:
                continue  # multi-ref generic, acceptable

            issues.append({
                "type": "from_position_mismatch",
                "severity": severity,
                "name": tech_name,
                "file": tech_from[tech_name]["file"],
                "expected_from": expected,
                "actual_from": actual_from,
                "referencing_position": ref["file"],
                "message": msg,
            })

    return issues


def suggest_fixes_for_orphans(orphaned_transitions, transition_index, position_files):
    """Parse from_position to suggest which position should reference each orphaned transition."""
    suggestions = []

    for name in sorted(orphaned_transitions):
        path = transition_index.get(name)
        if not path:
            continue
        data = load_json(path)
        if not data:
            continue

        from_pos = data.get("from_position", "")
        if from_pos:
            base_pos = from_pos.split("/")[0]
            role = from_pos.split("/")[1] if "/" in from_pos else "unknown"
            suggestions.append({
                "orphan": name,
                "suggested_position": base_pos,
                "suggested_role": role,
                "position_file": position_files.get(base_pos, "NOT_FOUND"),
            })

    return suggestions


def write_files_to_create_csv(all_issues):
    """Write CSV of missing files for create_missing_files.py script."""
    import csv
    csv_path = Path("tests/artifacts/files_to_create.csv")
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    missing = [i for i in all_issues if i["type"] in ("missing_transition", "missing_outcomes")]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["type", "name", "severity", "message"])
        for item in missing:
            writer.writerow([
                item.get("type", ""),
                item.get("name", ""),
                item.get("severity", ""),
                item.get("message", ""),
            ])
    return csv_path


def write_suggested_new_files_csv(all_issues):
    """Append audit findings to suggested_new_files.csv (shared with proofreader).

    Writes orphaned positions (need transitions) and missing transitions (need files).
    """
    import csv
    csv_path = Path("tests/artifacts/suggested_new_files.csv")
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    suggestions = []

    # Orphaned positions need a "Transition to X" file to become reachable
    for issue in all_issues:
        if issue["type"] == "orphaned_position":
            name = issue["name"]
            suggestions.append({
                "triggered_by": "validate_graph_integrity",
                "category": "Transitions",
                "name": f"Transition to {name}",
                "reason": f"Position '{name}' is orphaned (not reachable from any transition outcome). "
                          f"Needs a transition that leads to it.",
            })

    # Missing transitions need files created
    for issue in all_issues:
        if issue["type"] == "missing_transition":
            suggestions.append({
                "triggered_by": "validate_graph_integrity",
                "category": "Transitions",
                "name": issue["name"],
                "reason": issue["message"],
            })

    if not suggestions:
        return None

    write_header = not csv_path.exists() or csv_path.stat().st_size == 0
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["triggered_by", "category", "suggested_name", "reason"])
        for s in suggestions:
            writer.writerow([
                s["triggered_by"],
                s["category"],
                s["name"],
                s["reason"],
            ])

    return csv_path, len(suggestions)


def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph Integrity Audit — comprehensive graph checks"
    )
    parser.add_argument("--output", "-o", type=Path, default=REPORT_PATH,
                        help=f"Save JSON report to file (default: {REPORT_PATH})")
    parser.add_argument("--errors-only", "-e", action="store_true",
                        help="Only report error-severity issues (suppress warnings/info)")
    args = parser.parse_args()

    total_steps = 13
    print("=" * 70)
    print("BJJ GRAPH INTEGRITY AUDIT")
    print("=" * 70)

    # Step 1: Build transition file index
    print(f"\n[1/{total_steps}] Building transition file index...")
    transition_index = build_transition_index()
    print(f"  Found {len(transition_index)} transition files with names")

    # Step 2: Build position references
    print(f"[2/{total_steps}] Scanning position files for transition references...")
    all_refs, prob_errors, position_names, position_files = build_position_data()
    print(f"  Found {len(all_refs)} unique transition references across positions")
    print(f"  Found {len(position_names)} position names")

    # Step 2b: Build submission file index
    submission_index = {}
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if data and data.get("name"):
            submission_index[data["name"]] = str(path)
    submission_file_names = set(submission_index.keys())

    # Step 3: Compute orphaned and missing transitions
    print(f"[3/{total_steps}] Computing orphaned and missing transitions...")
    transition_file_names = set(transition_index.keys())
    orphaned = transition_file_names - all_refs
    missing = all_refs - transition_file_names - submission_file_names

    print(f"  Orphaned transitions (file exists, not referenced): {len(orphaned)}")
    print(f"  Missing transitions (referenced, no file): {len(missing)}")

    # Step 4: Compute orphaned submissions
    print(f"[4/{total_steps}] Computing orphaned submissions...")
    orphaned_submissions = submission_file_names - all_refs
    print(f"  Orphaned submissions (file exists, not referenced): {len(orphaned_submissions)}")

    # Step 5: Fuzzy matching
    print(f"[5/{total_steps}] Finding naming inconsistencies (fuzzy matching)...")
    name_matches = find_naming_inconsistencies(orphaned, missing)
    print(f"  Found {len(name_matches)} potential name matches")

    # Step 6: Orphaned positions
    print(f"[6/{total_steps}] Checking position reachability...")
    reachable = build_reachable_positions(position_names)
    orphaned_positions = position_names - reachable
    print(f"  Orphaned positions (not reachable): {len(orphaned_positions)}")

    # Step 7: Outcome probability checks
    print(f"[7/{total_steps}] Checking outcome probabilities (Transitions + Submissions)...")
    outcome_issues = check_outcome_probabilities()
    outcome_errors = [i for i in outcome_issues if i["severity"] == "error"]
    outcome_warnings = [i for i in outcome_issues if i["severity"] == "warning"]
    print(f"  Errors: {len(outcome_errors)}, Warnings: {len(outcome_warnings)}")

    # Step 8: Transition attempt outliers
    print(f"[8/{total_steps}] Checking attempt probability outliers...")
    outlier_issues = check_transition_outliers()
    print(f"  Info-level outliers: {len(outlier_issues)}")

    # Step 9: Targets outcome consistency
    print(f"[9/{total_steps}] Checking targets_outcome consistency...")
    targets_issues = check_targets_outcome_consistency()
    print(f"  Mismatches: {len(targets_issues)}")

    # Step 10: Minimum connectivity
    print(f"[10/{total_steps}] Checking minimum connectivity...")
    connectivity_issues = check_minimum_connectivity(position_names, transition_index)
    print(f"  Low connectivity nodes: {len(connectivity_issues)}")

    # Step 11: from_position validation
    print(f"[11/{total_steps}] Validating from_position references...")
    from_pos_issues = check_from_position_validity(position_names)
    print(f"  Invalid from_position references: {len(from_pos_issues)}")

    # Step 11b: Auto-suggest fixes for orphaned transitions
    orphan_suggestions = suggest_fixes_for_orphans(orphaned, transition_index, position_files)

    # Step 12: Bidirectional from_position consistency
    print(f"[12/{total_steps}] Checking bidirectional from_position consistency...")
    bidir_issues = check_from_position_bidirectional(position_names)
    bidir_errors = [i for i in bidir_issues if i["severity"] == "error"]
    bidir_warnings = [i for i in bidir_issues if i["severity"] == "warning"]
    print(f"  Errors: {len(bidir_errors)}, Warnings: {len(bidir_warnings)}")

    # Step 13: Summary
    print(f"[13/{total_steps}] Compiling report...")

    # === Collect all issues with severity ===
    all_issues = []

    # Orphaned transitions (error)
    for name in sorted(orphaned):
        path = transition_index[name]
        data = load_json(path)
        from_pos = data.get("from_position", "NONE") if data else "LOAD_ERROR"
        suggestion = next((s for s in orphan_suggestions if s["orphan"] == name), None)
        msg = f"Orphaned transition: '{name}' (from: {from_pos})"
        if suggestion:
            msg += f" — suggest adding to {suggestion['suggested_position']}/{suggestion['suggested_role']}"
        all_issues.append({
            "type": "orphaned_transition",
            "severity": "error",
            "name": name,
            "file": path,
            "from_position": from_pos,
            "message": msg,
        })

    # Orphaned submissions (info)
    for name in sorted(orphaned_submissions):
        path = submission_index[name]
        data = load_json(path)
        from_pos = data.get("from_position", "NONE") if data else "LOAD_ERROR"
        all_issues.append({
            "type": "orphaned_submission",
            "severity": "info",
            "name": name,
            "file": path,
            "from_position": from_pos,
            "message": f"Orphaned submission: '{name}' (from: {from_pos})",
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

    # from_position validation issues (error)
    all_issues.extend(from_pos_issues)

    # Bidirectional from_position consistency (error/warning)
    all_issues.extend(bidir_issues)

    # Outcome issues (mixed severity)
    all_issues.extend(outcome_issues)

    # Outlier issues (info)
    all_issues.extend(outlier_issues)

    # Targets outcome mismatches (warning)
    all_issues.extend(targets_issues)

    # Low connectivity (warning)
    all_issues.extend(connectivity_issues)

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

    # Orphaned submissions
    orphan_sub_details = [i for i in all_issues if i["type"] == "orphaned_submission"]
    if orphan_sub_details:
        print(f"\n--- ORPHANED SUBMISSIONS ({len(orphan_sub_details)}) ---")
        print("(Submission files not referenced by any position)")
        for i in orphan_sub_details[:10]:
            print(f"  {i['name']} (from: {i.get('from_position', 'N/A')})")
        if len(orphan_sub_details) > 10:
            print(f"  ... and {len(orphan_sub_details) - 10} more")

    # Missing transitions
    missing_details = [i for i in all_issues if i["type"] == "missing_transition"]
    print(f"\n--- MISSING TRANSITIONS ({len(missing_details)}) ---")
    print("(Referenced by positions but no file exists)")
    for i in missing_details:
        print(f"  {i['name']}")

    # Invalid from_position references
    from_pos_details = [i for i in all_issues if i["type"] == "invalid_from_position"]
    if from_pos_details:
        print(f"\n--- INVALID FROM_POSITION REFERENCES ({len(from_pos_details)}) ---")
        for i in from_pos_details:
            print(f"  {i['name']}: {i['from_position']}")

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
    print(f"  Submission files:       {len(submission_index)}")
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
            "submission_files": len(submission_index),
            "position_files": len(position_names),
            "total_issues": len(all_issues),
            "errors": error_count,
            "warnings": warning_count,
            "info": info_count,
            "orphaned_transitions": len(orphan_details),
            "orphaned_submissions": len(orphan_sub_details),
            "missing_transitions": len(missing_details),
            "naming_matches": len(name_matches),
            "probability_errors": len(attempt_sum_errors),
            "orphaned_positions": len(orphaned_pos_issues),
            "invalid_from_positions": len(from_pos_details),
            "outcome_errors": len(outcome_sum_errors) + len(outcome_missing) + len(outcome_unknown),
            "outcome_warnings": len(outcome_warns),
            "attempt_outliers": len(attempt_outliers),
        },
        "issues": all_issues,
        "naming_inconsistencies": name_matches,
        "orphan_fix_suggestions": orphan_suggestions,
    }

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nJSON report saved to: {output_path}")

    # Write CSV of files to create
    csv_path = write_files_to_create_csv(all_issues)
    print(f"CSV of missing files saved to: {csv_path}")

    # Append to shared suggested_new_files.csv
    result = write_suggested_new_files_csv(all_issues)
    if result:
        suggested_path, suggested_count = result
        print(f"Suggested new files appended to: {suggested_path} ({suggested_count} entries)")
    else:
        print("No new file suggestions from audit.")

    # Exit code 1 only for error-severity issues
    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
