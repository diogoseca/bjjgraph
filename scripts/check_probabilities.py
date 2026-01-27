#!/usr/bin/env python3
"""
BJJ Graph Probability Sanity Checker
=====================================
Analyzes all probability values across the content and flags outliers.

Checks:
- Transitions: outcomes probabilities sum to 100%, realistic values
- Positions: attempt_probability sums to 100% per role
- Success rates: beginner <= intermediate <= advanced
- Outliers: Unrealistic high/low values (e.g., 95% armbar success)

Usage:
    python3 scripts/check_probabilities.py
    python3 scripts/check_probabilities.py --fix-with-llm
    python3 scripts/check_probabilities.py --output report.json
"""

import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict

# Paths
CONTENT_PATH = Path("source/content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"

# Thresholds for flagging outliers
THRESHOLDS = {
    "success_too_high": 85,      # Success rate above this is suspicious
    "success_too_low": 10,       # Success rate below this is suspicious
    "counter_too_high": 30,      # Counter probability above this is unusual
    "attempt_too_low": 3,        # Attempt probability below this is odd
    "attempt_too_high": 60,      # Single transition above this dominates
}

# Expected ranges by technique type (for smarter validation)
TECHNIQUE_EXPECTATIONS = {
    "sweep": {"success_min": 30, "success_max": 70},
    "escape": {"success_min": 25, "success_max": 60},
    "submission": {"success_min": 40, "success_max": 80},
    "pass": {"success_min": 35, "success_max": 75},
    "takedown": {"success_min": 30, "success_max": 65},
}


def load_json(path):
    """Load JSON file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


def classify_technique(name):
    """Classify technique by name."""
    name_lower = name.lower()
    if any(x in name_lower for x in ["sweep"]):
        return "sweep"
    if any(x in name_lower for x in ["escape", "defense"]):
        return "escape"
    if any(x in name_lower for x in ["choke", "lock", "bar", "crush", "crank"]):
        return "submission"
    if any(x in name_lower for x in ["pass"]):
        return "pass"
    if any(x in name_lower for x in ["takedown", "throw", "trip"]):
        return "takedown"
    return "general"


def check_success_rates(data, path):
    """Check if success rates follow beginner <= intermediate <= advanced."""
    issues = []

    sr = data.get("success_rates", {})
    if not sr:
        return issues

    b = sr.get("beginner", 0)
    i = sr.get("intermediate", 0)
    a = sr.get("advanced", 0)

    if not (b <= i <= a):
        issues.append({
            "file": str(path),
            "type": "success_rate_order",
            "message": f"Success rates not in order: B={b}%, I={i}%, A={a}%",
            "severity": "error",
            "current": {"beginner": b, "intermediate": i, "advanced": a}
        })

    # Check for unrealistic values
    technique_type = classify_technique(data.get("name", ""))
    expectations = TECHNIQUE_EXPECTATIONS.get(technique_type, {})

    if expectations:
        if a > expectations.get("success_max", 100):
            issues.append({
                "file": str(path),
                "type": "success_rate_high",
                "message": f"Advanced success rate {a}% seems high for {technique_type}",
                "severity": "warning",
                "current": a,
                "expected_max": expectations["success_max"]
            })
        if a < expectations.get("success_min", 0):
            issues.append({
                "file": str(path),
                "type": "success_rate_low",
                "message": f"Advanced success rate {a}% seems low for {technique_type}",
                "severity": "warning",
                "current": a,
                "expected_min": expectations["success_min"]
            })

    return issues


def check_outcomes(data, path):
    """Check outcomes array probabilities."""
    issues = []

    outcomes = data.get("outcomes", [])
    if not outcomes:
        issues.append({
            "file": str(path),
            "type": "missing_outcomes",
            "message": "No outcomes array",
            "severity": "error"
        })
        return issues

    # Check sum
    total = sum(o.get("probability", 0) for o in outcomes)
    if total != 100:
        issues.append({
            "file": str(path),
            "type": "outcomes_sum",
            "message": f"Outcomes sum to {total}%, not 100%",
            "severity": "error",
            "current": total
        })

    # Check individual values
    for o in outcomes:
        prob = o.get("probability", 0)
        result = o.get("result", "")
        to_pos = o.get("to", "")

        if result == "success" and prob > THRESHOLDS["success_too_high"]:
            issues.append({
                "file": str(path),
                "type": "outcome_too_high",
                "message": f"Success probability {prob}% is very high",
                "severity": "warning",
                "outcome": o
            })

        if result == "counter" and prob > THRESHOLDS["counter_too_high"]:
            issues.append({
                "file": str(path),
                "type": "counter_high",
                "message": f"Counter probability {prob}% is unusually high",
                "severity": "warning",
                "outcome": o
            })

        if "Unknown" in to_pos:
            issues.append({
                "file": str(path),
                "type": "unknown_target",
                "message": f"Outcome targets 'Unknown': {to_pos}",
                "severity": "error",
                "outcome": o
            })

    return issues


def check_position_transitions(data, path):
    """Check position transition probabilities."""
    issues = []

    for role in ["top", "bottom"]:
        if role not in data:
            continue

        transitions = data[role].get("transitions", [])
        if not transitions:
            continue

        # Check sum
        total = sum(t.get("attempt_probability", 0) for t in transitions)
        if total != 100:
            issues.append({
                "file": str(path),
                "type": "attempt_sum",
                "message": f"{role}: attempt_probability sums to {total}%, not 100%",
                "severity": "error",
                "role": role,
                "current": total
            })

        # Check individual values
        for t in transitions:
            prob = t.get("attempt_probability", 0)
            name = t.get("transition", "")

            if prob < THRESHOLDS["attempt_too_low"] and prob > 0:
                issues.append({
                    "file": str(path),
                    "type": "attempt_too_low",
                    "message": f"{role}: '{name}' has only {prob}% attempt probability",
                    "severity": "info",
                    "transition": name,
                    "current": prob
                })

            if prob > THRESHOLDS["attempt_too_high"]:
                issues.append({
                    "file": str(path),
                    "type": "attempt_dominant",
                    "message": f"{role}: '{name}' dominates with {prob}% attempt probability",
                    "severity": "info",
                    "transition": name,
                    "current": prob
                })

    return issues


def analyze_all():
    """Analyze all content files."""
    all_issues = []
    file_counts = {"positions": 0, "transitions": 0, "submissions": 0}

    # Check Transitions
    print("Checking Transitions...")
    for path in sorted(TRANSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        file_counts["transitions"] += 1

        all_issues.extend(check_success_rates(data, path))
        all_issues.extend(check_outcomes(data, path))

    # Check Submissions
    print("Checking Submissions...")
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        file_counts["submissions"] += 1

        all_issues.extend(check_success_rates(data, path))
        all_issues.extend(check_outcomes(data, path))

    # Check Positions
    print("Checking Positions...")
    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        file_counts["positions"] += 1

        all_issues.extend(check_position_transitions(data, path))

    return all_issues, file_counts


def print_report(issues, file_counts):
    """Print analysis report."""
    print(f"""
{'=' * 60}
PROBABILITY SANITY CHECK REPORT
{'=' * 60}
Files analyzed:
  - Positions:   {file_counts['positions']}
  - Transitions: {file_counts['transitions']}
  - Submissions: {file_counts['submissions']}
{'=' * 60}
""")

    # Group by severity
    by_severity = defaultdict(list)
    for issue in issues:
        by_severity[issue["severity"]].append(issue)

    print(f"Issues found: {len(issues)}")
    print(f"  - Errors:   {len(by_severity['error'])}")
    print(f"  - Warnings: {len(by_severity['warning'])}")
    print(f"  - Info:     {len(by_severity['info'])}")

    # Group by type
    by_type = defaultdict(list)
    for issue in issues:
        by_type[issue["type"]].append(issue)

    print(f"\nBy issue type:")
    for issue_type, items in sorted(by_type.items()):
        print(f"  - {issue_type}: {len(items)}")

    # Print errors
    if by_severity["error"]:
        print(f"\n{'=' * 60}")
        print("ERRORS (must fix):")
        print(f"{'=' * 60}")
        for issue in by_severity["error"][:20]:
            print(f"\n{Path(issue['file']).name}:")
            print(f"  {issue['message']}")
        if len(by_severity["error"]) > 20:
            print(f"\n... and {len(by_severity['error']) - 20} more errors")

    # Print warnings
    if by_severity["warning"]:
        print(f"\n{'=' * 60}")
        print("WARNINGS (review recommended):")
        print(f"{'=' * 60}")
        for issue in by_severity["warning"][:10]:
            print(f"\n{Path(issue['file']).name}:")
            print(f"  {issue['message']}")
        if len(by_severity["warning"]) > 10:
            print(f"\n... and {len(by_severity['warning']) - 10} more warnings")


def main():
    parser = argparse.ArgumentParser(
        description="Check probability values across BJJ Graph content"
    )

    parser.add_argument("--output", "-o", type=Path,
                        help="Save full report to JSON file")
    parser.add_argument("--errors-only", "-e", action="store_true",
                        help="Only show errors, not warnings/info")
    parser.add_argument("--fix-with-llm", action="store_true",
                        help="Use LLM to suggest fixes for outliers (Phase 2)")

    args = parser.parse_args()

    # Analyze
    issues, file_counts = analyze_all()

    # Filter if requested
    if args.errors_only:
        issues = [i for i in issues if i["severity"] == "error"]

    # Print report
    print_report(issues, file_counts)

    # Save to file if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump({
                "file_counts": file_counts,
                "issues": issues,
                "summary": {
                    "total": len(issues),
                    "errors": len([i for i in issues if i["severity"] == "error"]),
                    "warnings": len([i for i in issues if i["severity"] == "warning"]),
                    "info": len([i for i in issues if i["severity"] == "info"])
                }
            }, f, indent=2)
        print(f"\nFull report saved to: {args.output}")

    # Return error code if there are errors
    error_count = len([i for i in issues if i["severity"] == "error"])
    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
