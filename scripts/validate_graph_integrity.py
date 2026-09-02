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
import os
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ruleset import (  # gi/no-gi ruleset contract (calibration-v2)
    RULESETS,
    Number,
    any_ruleset_map,
    is_ruleset_map,
    iter_cells,
    sum_cells,
    present_rulesets,
)
from _votes import PRIOR_VOTE_COUNT  # forked votes schema seed sentinel (calibration-v2 Phase 2.3b)

CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
GRAPH_PATH = Path("graph.json")
VOTES_PATH = Path("templates") / "votes.json"
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


def _per_ruleset_totals(items, key):
    """Return ``(totals, absent_frames, nonnumeric_rows)`` for ``item[key]`` sums.

    ``totals``          ``[(ruleset_or_None, total)]``, one pair per frame that
                        EXISTS. Scalar (pre-migration) data -> a single
                        ``[(None, legacy_sum)]`` so existing checks behave
                        byte-identically. Forked {gi,nogi} data -> one
                        ``(ruleset, sum)`` per ruleset with any non-null cell.
    ``absent_frames``   the rulesets with NO non-null cell anywhere in this array.
                        Always empty for scalar data (a legacy scalar mirrors into
                        both frames, so no frame can be absent).
    ``nonnumeric_rows`` how many rows carry ``key`` but not a number — a bare
                        ``null`` being the one that matters.

    WHY THIS RETURNS THREE THINGS INSTEAD OF ONE. Under the null contract
    (``scripts/_ruleset.py``) a cell is ``null`` when the edge does not exist in
    that ruleset, so ``present_rulesets`` correctly drops an all-null frame. Every
    per-frame gate in this file is a ``for rs, total in _per_ruleset_totals(...)``
    loop, so a dropped frame yielded no tuple, ran no body, appended no issue and
    printed nothing: "this frame does not exist" and "nobody checked this frame"
    were the same output, on the max_errors:0 gate. That is CLAUDE.md §6.6 —
    absence produces a plausible answer — and the fix is the one this repo has
    reinvented five times: hand the caller a POSITIVE coverage count, make it
    hard-fail on zero, and make every skip PRINT.

    Callers MUST consume all three. Ignoring ``absent_frames`` restores the silence.

    ``nonnumeric_rows`` exists because a bare ``null`` is NOT the contract (which
    is per-frame, ``{gi: null, nogi: null}``): the old ``sum(it.get(key, 0) ...)``
    raised "TypeError: unsupported operand type(s) for +: 'int' and 'NoneType'" on
    one, which killed the audit mid-run at step 2 of 14 — steps 3-14 never ran and
    the gate reported nothing at all.
    """
    dict_items = [it for it in items if isinstance(it, dict)]
    values = [it[key] for it in dict_items if key in it]
    if any_ruleset_map(values):
        present = present_rulesets(values)
        totals = [(rs, sum_cells(dict_items, key, rs)) for rs in present]
        # A MIXED array — one bare `null` beside forked maps — takes this branch,
        # and `sum_cells` drops the null from every frame, so the remaining rows
        # could still total 100 and the row vanished with no error and no count.
        # Measured: outcomes [{gi:100,nogi:100}, null] summed to 100 and reported
        # nothing. Count a row that contributes to NO frame (bare null, string,
        # a dict that is not a {gi,nogi} map). A row that IS a map with a null
        # cell is the OPPOSITE case and must not be flagged: that edge genuinely
        # does not exist in that ruleset and correctly contributes 0 there.
        nonforked = sum(1 for v in values
                        if not (is_ruleset_map(v)
                                or (isinstance(v, Number) and not isinstance(v, bool))))
        return totals, [rs for rs in RULESETS if rs not in present], nonforked
    # Legacy scalar rows. Sum only real numbers so a bare null degrades to a NAMED
    # issue instead of a traceback; rows missing `key` contributed 0 before and
    # contribute nothing now, which is the same total. (bool is an int in Python —
    # a boolean probability is a defect, not a 1.)
    nonnumeric = sum(1 for v in values if not isinstance(v, Number) or isinstance(v, bool))
    total = sum(v for v in values if isinstance(v, Number) and not isinstance(v, bool))
    return [(None, total)], [], nonnumeric


def _record_frame_coverage(coverage, issues, key, file_path, name, role, totals, absent, nonnumeric):
    """Turn one ``_per_ruleset_totals`` result into coverage counts and issues.

    The ONE place that decides what an absent frame means, shared by all three sum
    gates in this file (position root transitions, position top/bottom transitions,
    technique outcomes) so the three cannot drift apart (CLAUDE.md §6.5).

    The distinction it enforces:
      - a frame absent while the OTHER frame exists is DATA — the move genuinely
        has no gi (or no no-gi) form. Severity `info`, never fails the gate, but it
        is emitted and counted so a corpus quietly shedding a ruleset is visible.
      - a value absent in EVERY frame is a DEFECT: an edge that exists in no
        ruleset is a deletion somebody wrote as a null. Severity `error`, so it
        goes through the max_errors:0 ratchet instead of vanishing.
      - a bare `null` is a schema defect: `error`, and it names the row count.
    """
    coverage["checked"] += len(totals)
    if not totals:
        # Do NOT also count these frames as `absent`. A value that exists in no
        # ruleset is ONE fact, reported once, under `dead`; counting its two empty
        # frames as absent as well printed "Skipped (frame absent...): 2" beside a
        # SKIPPED/ABSENT section that listed no absent frame at all — a count that
        # does not reconcile with its own list is the §6.6 defect one layer down.
        # (No-op on today's corpus, where both are 0.)
        # Forked rows present, every cell null in BOTH frames (scalar data can
        # never land here — it always yields one legacy total).
        coverage["dead"] += 1
        issues.append({
            "file": file_path,
            "name": name,
            "role": role,
            "type": f"{key}_no_ruleset",
            "message": (f"{name} [{role}]: {key} exists in NO ruleset — every cell is null "
                        f"in both gi and nogi, so no sum was checked; an edge that exists in "
                        f"neither ruleset is a deletion, not a null"),
            "severity": "error",
        })
    else:
        coverage["absent"] += len(absent)
        for rs in absent:
            issues.append({
                "file": file_path,
                "name": name,
                "role": role,
                "ruleset": rs,
                "type": f"{key}_frame_absent",
                "message": (f"{name} [{role}]: {key}[{rs}] frame ABSENT (all cells null) "
                            f"— sum check SKIPPED"),
                "severity": "info",
            })
    if nonnumeric:
        coverage["bare_null"] += nonnumeric
        issues.append({
            "file": file_path,
            "name": name,
            "role": role,
            "type": f"{key}_bare_null",
            "message": (f"{name} [{role}]: {key} is not a number on {nonnumeric} row(s) — an "
                        f"edge that does not exist in a ruleset is written per-frame as "
                        f"{{gi: null, nogi: null}}, never as a bare null"),
            "severity": "error",
        })


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
    # Ruleset-frame coverage. `checked` is the positive count this gate reports so
    # that "every frame summed clean" can never print the same as "no frame was
    # summed at all"; main() hard-fails when it is 0 (CLAUDE.md §6.6).
    frame_issues = []
    coverage = {"checked": 0, "absent": 0, "dead": 0, "bare_null": 0}

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
            _totals, _absent, _nonnum = _per_ruleset_totals(root_transitions, "attempt_probability")
            _record_frame_coverage(coverage, frame_issues, "attempt_probability",
                                   str(path), pos_name, "root", _totals, _absent, _nonnum)
            for rs, total in _totals:
                role_label = "root" if rs is None else f"root[{rs}]"
                roles_checked.append((role_label, names, total))
                if total != 100:
                    err = {
                        "file": str(path),
                        "position": pos_name,
                        "role": role_label,
                        "sum": total,
                        "transition_count": len(root_transitions),
                        "severity": "error",
                    }
                    if rs is not None:
                        err["ruleset"] = rs
                    probability_errors.append(err)

        # Check top/bottom roles
        for role in ["top", "bottom"]:
            if role not in data:
                continue
            transitions = data[role].get("transitions", [])
            if not transitions:
                continue
            names = [t.get("transition", "") for t in transitions]
            all_referenced_transitions.update(names)
            _totals, _absent, _nonnum = _per_ruleset_totals(transitions, "attempt_probability")
            _record_frame_coverage(coverage, frame_issues, "attempt_probability",
                                   str(path), pos_name, role, _totals, _absent, _nonnum)
            for rs, total in _totals:
                role_label = role if rs is None else f"{role}[{rs}]"
                roles_checked.append((role_label, names, total))
                if total != 100:
                    err = {
                        "file": str(path),
                        "position": pos_name,
                        "role": role_label,
                        "sum": total,
                        "transition_count": len(transitions),
                        "severity": "error",
                    }
                    if rs is not None:
                        err["ruleset"] = rs
                    probability_errors.append(err)

        position_refs[str(path)] = roles_checked

    return (all_referenced_transitions, probability_errors, position_names,
            position_files, frame_issues, coverage)


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


def build_outcome_targets():
    """Collect every `to` target across all transition + submission outcomes.

    Used to detect submissions reachable via Position -> Transition -> Submission
    (a transition's outcome lands on the submission), not only those listed
    directly in a position's transitions[]. Returns a set of target names.
    """
    targets = set()
    for cat_path in [TRANSITIONS_PATH, SUBMISSIONS_PATH]:
        for path in sorted(cat_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue
            for outcome in data.get("outcomes", []):
                to = outcome.get("to", "")
                if to:
                    targets.add(to)
    return targets


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
    """Check outcome probability sums and outliers in Transitions and Submissions.

    Returns ``(issues, coverage)`` — see _record_frame_coverage for what the
    coverage counts mean and why a gate that reports only issues is not enough.
    """
    issues = []
    coverage = {"checked": 0, "absent": 0, "dead": 0, "bare_null": 0}

    for source_path, label in [(TRANSITIONS_PATH, "Transition"), (SUBMISSIONS_PATH, "Submission")]:
        for path in sorted(source_path.rglob("*.json")):
            data = load_json(path)
            if not data:
                continue

            name = data.get("name", path.stem)

            # Family hubs are aggregator pages, not graph nodes — their variants
            # carry the outcomes (TEMPLATE-FAMILY.json has no `outcomes` field).
            # Skip them so they aren't false-flagged as "missing outcomes".
            if data.get("is_family"):
                continue

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

            # Sum check (per-ruleset when forked; legacy single-sum otherwise)
            _totals, _absent, _nonnum = _per_ruleset_totals(outcomes, "probability")
            _record_frame_coverage(coverage, issues, "probability",
                                   str(path), name, label.lower(), _totals, _absent, _nonnum)
            for rs, total in _totals:
                if total != 100:
                    rs_sfx = f" ({rs})" if rs else ""
                    issue = {
                        "file": str(path),
                        "name": name,
                        "type": "outcomes_sum",
                        "message": f"Outcomes{rs_sfx} sum to {total:g}%, not 100%",
                        "severity": "error",
                        "current": total,
                    }
                    if rs is not None:
                        issue["ruleset"] = rs
                    issues.append(issue)

            # Individual outcome checks
            for o in outcomes:
                result = o.get("result", "")
                to_pos = o.get("to", "")

                # Unknown target (probability-independent — once per outcome)
                if "Unknown" in to_pos:
                    issues.append({
                        "file": str(path),
                        "name": name,
                        "type": "unknown_target",
                        "message": f"Outcome targets 'Unknown': {to_pos}",
                        "severity": "error",
                        "outcome": o,
                    })

                # Threshold checks, per ruleset frame (scalar -> single (None, prob)).
                # NO `, 0` DEFAULT. `iter_cells` already yields nothing for a null
                # cell, an all-null map or a bare null — which is the right answer
                # under the null contract (scripts/_ruleset.py): a frame that does
                # not exist has no probability to compare against a threshold, and
                # substituting 0 would re-animate the edge as "exists, never
                # succeeds". The old `.get("probability", 0)` fabricated exactly
                # that for a row MISSING the key (0 such rows today; recompute with
                #   python3 -c "import json;from pathlib import Path;print(sum(1 for b in ('Transitions','Submissions') for f in Path('content',b).rglob('*.json') for o in (json.load(open(f)).get('outcomes') or []) if isinstance(o,dict) and 'probability' not in o))"
                # ). The skip is not counted HERE on purpose: this is the outlier
                # scan, and every one of those rows is already NAMED loudly by the
                # sum gate above in the same run ("probability[<rs>] sum is ..." or
                # the bare-null / no-ruleset issues from _record_frame_coverage),
                # so a second counter would double-report the same fact.
                for rs, prob in iter_cells(o.get("probability")):
                    rs_sfx = f"[{rs}]" if rs else ""

                    # Success too high
                    if result == "success" and prob > THRESHOLDS["success_too_high"]:
                        issues.append({
                            "file": str(path),
                            "name": name,
                            "type": "outcome_too_high",
                            "message": f"Success probability{rs_sfx} {prob:g}% > {THRESHOLDS['success_too_high']}%",
                            "severity": "warning",
                            "outcome": o,
                        })

                    # Counter too high
                    if result == "counter" and prob > THRESHOLDS["counter_too_high"]:
                        issues.append({
                            "file": str(path),
                            "name": name,
                            "type": "counter_high",
                            "message": f"Counter probability{rs_sfx} {prob:g}% > {THRESHOLDS['counter_too_high']}%",
                            "severity": "warning",
                            "outcome": o,
                        })

            # Technique-type expected ranges (check success outcomes)
            technique_type = classify_technique(name)
            expectations = TECHNIQUE_EXPECTATIONS.get(technique_type, {})
            if expectations:
                for o in outcomes:
                    if o.get("result") == "success":
                        # No `, 0` default — see the threshold scan above.
                        for rs, prob in iter_cells(o.get("probability")):
                            rs_sfx = f"[{rs}]" if rs else ""
                            if prob > expectations.get("success_max", 100):
                                issues.append({
                                    "file": str(path),
                                    "name": name,
                                    "type": "technique_range_high",
                                    "message": f"Success{rs_sfx} {prob:g}% exceeds expected max {expectations['success_max']}% for {technique_type}",
                                    "severity": "warning",
                                    "current": prob,
                                })
                            if prob < expectations.get("success_min", 0):
                                issues.append({
                                    "file": str(path),
                                    "name": name,
                                    "type": "technique_range_low",
                                    "message": f"Success{rs_sfx} {prob:g}% below expected min {expectations['success_min']}% for {technique_type}",
                                    "severity": "warning",
                                    "current": prob,
                                })

    return issues, coverage


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
                name = t.get("transition", "")
                # No `, 0` default: a frame that does not exist yields no cell, and
                # 0 would re-animate it as "exists, never attempted" — the exact
                # distinction the null contract draws. Rows this drops are already
                # named by build_position_data's sum gate in the same run.
                for rs, prob in iter_cells(t.get("attempt_probability")):
                    rs_sfx = f"[{rs}]" if rs else ""

                    if prob > THRESHOLDS["attempt_too_high"]:
                        issues.append({
                            "file": str(path),
                            "position": pos_name,
                            "role": role if rs is None else f"{role}[{rs}]",
                            "type": "attempt_dominant",
                            "message": f"{role}{rs_sfx}: '{name}' dominates with {prob:g}% attempt probability",
                            "severity": "info",
                            "transition": name,
                            "current": prob,
                        })

                    if 0 < prob < THRESHOLDS["attempt_too_low"]:
                        issues.append({
                            "file": str(path),
                            "position": pos_name,
                            "role": role if rs is None else f"{role}[{rs}]",
                            "type": "attempt_negligible",
                            "message": f"{role}{rs_sfx}: '{name}' has only {prob:g}% attempt probability",
                            "severity": "info",
                            "transition": name,
                            "current": prob,
                        })

        # Also check root-level transitions (neutral positions)
        root_transitions = data.get("transitions", [])
        if root_transitions and "top" not in data and "bottom" not in data:
            for t in root_transitions:
                name = t.get("transition", "")
                # No `, 0` default: a frame that does not exist yields no cell, and
                # 0 would re-animate it as "exists, never attempted" — the exact
                # distinction the null contract draws. Rows this drops are already
                # named by build_position_data's sum gate in the same run.
                for rs, prob in iter_cells(t.get("attempt_probability")):
                    rs_sfx = f"[{rs}]" if rs else ""

                    if prob > THRESHOLDS["attempt_too_high"]:
                        issues.append({
                            "file": str(path),
                            "position": pos_name,
                            "role": "root" if rs is None else f"root[{rs}]",
                            "type": "attempt_dominant",
                            "message": f"root{rs_sfx}: '{name}' dominates with {prob:g}% attempt probability",
                            "severity": "info",
                            "transition": name,
                            "current": prob,
                        })

                    if 0 < prob < THRESHOLDS["attempt_too_low"]:
                        issues.append({
                            "file": str(path),
                            "position": pos_name,
                            "role": "root" if rs is None else f"root[{rs}]",
                            "type": "attempt_negligible",
                            "message": f"root{rs_sfx}: '{name}' has only {prob:g}% attempt probability",
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


def check_position_type_vs_score():
    """Does the authored dominance word agree with the arithmetic that scores it?

    `state_properties.position_type` is where a human wrote "Offensive/Controlling" or
    "Defensive". Since v1.103.0 that word DECIDES the sign of the position's strength and the
    weighted formula only supplies the magnitude — so a disagreement is no longer silently
    resolved in the formula's favour, but it is still worth naming: it means either the word or
    the metrics behind it are wrong, and the metrics are what feed the odds a player sees.
    """
    issues = []
    # ADJUDICATED DISAGREEMENTS ARE INFO, NOT WARNINGS (v1.106.0). The 2026-08-17 black-belt
    # panel (two independent experts per change) ruled 73 authored words CORRECT — the metrics
    # merely disagree, and the word wins at runtime — plus a handful whose corrected word still
    # outvotes broken metrics. Re-warning those forever would bury any NEW disagreement. The
    # ledger is tests/artifacts/position_type_reviewed.json; delete an entry to re-open a case.
    reviewed = {}
    try:
        reviewed = json.loads((Path(__file__).resolve().parent.parent / "tests/artifacts/position_type_reviewed.json").read_text()).get("reviewed", {})
    except Exception:
        pass
    # NB `import os` was MISSING until v1.104.6, so `os.path.dirname` raised NameError, this bare
    # except swallowed it, and the check returned an empty list on every run since v1.103.0 — which
    # is what "0 disagreements across all 272 position-roles" actually meant. A guard that reports
    # clean because it never executed is worse than no guard, so the failure is now named.
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import score_graph_nodes as sgn
    except Exception as e:
        print("  [position_type] SKIPPED — could not load score_graph_nodes: %r" % (e,))
        return issues

    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data:
            continue
        for role in ("top", "bottom"):
            rd = data.get(role)
            if not isinstance(rd, dict):
                continue
            sp = rd.get("state_properties") or {}
            kind = str(sp.get("position_type") or "").strip()
            if not kind:
                continue
            k = kind.lower()
            # leading word decides, mirroring score_graph_nodes (v1.106.3): "Defensive with
            # offensive options" is a DEFENSIVE-leaning claim, not an offensive one.
            _head = k.split()[0] if k.split() else ""
            wants_pos = _head.startswith(("offensive", "controlling", "dominant"))
            wants_neg = _head.startswith(("defensive", "inferior"))
            if not (wants_pos or wants_neg):
                continue
            # the magnitude the formula would have produced, unsigned by the word
            try:
                raw = sgn.position_role_strength(rd)
            except Exception:
                continue
            # re-derive the pre-sign value: position_role_strength already applied the word, so
            # recompute the bare arithmetic to see whether the two ever pointed different ways
            # `or 0` SURVIVES HERE DELIBERATELY, and it is not a ruleset re-animation:
            # point_value is a plain scoring integer, never a {gi,nogi} map (measured
            # over every top/bottom state_properties block in content/Positions — all
            # int, 0 forked). Recompute:
            #   python3 -c "import json;from pathlib import Path;print({type((b.get('state_properties') or {}).get('point_value')).__name__ for f in Path('content/Positions').rglob('*.json') for b in (json.load(open(f)).get(r) for r in ('top','bottom')) if isinstance(b,dict) and 'point_value' in (b.get('state_properties') or {})})"
            # It coerces a MISSING or explicitly-null point_value to the neutral
            # midpoint of the -4..4 scale, which is what "no points scored here"
            # means for this metric. If point_value is ever forked, this line must
            # become a per-frame read, not a scalar with a default.
            bare = sgn.clamp_strength(
                sgn.W_POINT * sgn.normalize(sp.get("point_value", 0) or 0, -4, 4)
                + sgn.W_SUBMISSION * sgn.normalize(sgn._metric_value(rd.get("position_metrics") or {}, "submission_probability"), 0, 100)
                + sgn.W_RETENTION * sgn.normalize(sgn._metric_value(rd.get("position_metrics") or {}, "retention_rate"), 0, 100)
                + sgn.W_ADVANCEMENT * sgn.normalize(sgn._metric_value(rd.get("position_metrics") or {}, "advancement_probability"), 0, 100)
                - sgn.W_RISK * sgn.risk_penalty(sp.get("risk_level"))
            )
            if abs(bare) < 0.02:
                continue  # too close to zero to call a disagreement
            if (bare > 0) != wants_pos:
                _nm = rd.get("name", path.stem)
                issues.append({
                    "type": "position_type_score_disagreement",
                    "severity": "info" if _nm in reviewed else "warning",
                    "name": _nm,
                    "file": str(path),
                    "message": (f"{rd.get('name', path.stem)}: authored position_type '{kind}' but its "
                                f"metrics score {bare:+.3f} — the word now wins, so check whether the "
                                f"point_value / risk / submission-retention-advancement numbers are right"),
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

        actual_role = actual_from.rsplit("/", 1)[-1].strip().lower() if "/" in actual_from else ""

        for ref in refs:
            expected = ref["expected_from"]
            if actual_from.strip().lower() == expected.strip().lower():
                continue  # match

            # Mismatch found — determine severity
            is_single_ref = len(refs) == 1

            # Check if a position-specific variant exists
            variant_name = f"{tech_name} from {ref['position']}"
            has_variant = variant_name in all_tech_names

            # ── A ROLE DISAGREEMENT IS NEVER "ACCEPTABLE GENERICITY" ────────────────────────
            # The multi-ref escape below was written for POSITION genericity: one technique
            # reachable from several positions is normal, so its single `from_position` cannot
            # name them all. It also silently excused ROLE disagreement, which is a different
            # thing entirely — a technique has exactly one performer, so a position that offers
            # it to the OTHER side is claiming something the technique itself denies.
            #
            # That hole is not theoretical. `optionsFor()` keeps only moves that favour the side
            # playing them ("the beneficiary is the performer"), and the strength pair the app
            # filters on is derived from this very field — so a wrong role does not merely mislabel
            # the move, it DELETES it from that side's hand. Measured on 2026-08-13: 44 role
            # contradictions across the corpus, 7 of them submissions, every one of them invisible
            # here because the technique happened to be referenced by more than one position.
            # The reported case was Triangle Control/bottom, whose triangle finish is authored
            # `Triangle Control/Top` — so the player holding the triangle was offered transitions
            # and no submissions at all.
            if actual_role and actual_role != ref["role"].strip().lower():
                issues.append({
                    "type": "from_position_role_mismatch",
                    # WARNING, not error, on purpose: `validate:graph` is a halting gate in
                    # `npm run regenerate`, and turning 44 pre-existing contradictions into a hard
                    # stop would block content work rather than inform it. Promote to "error" once
                    # the corpus is clean.
                    "severity": "warning",
                    "name": tech_name,
                    "file": tech_from[tech_name]["file"],
                    "expected_from": expected,
                    "actual_from": actual_from,
                    "referencing_position": ref["file"],
                    "message": (f"Role contradiction: {ref['position']}/{ref['role']} offers "
                                f"'{tech_name}', but it is authored from '{actual_from}' — one of "
                                f"the two is wrong, and the app will drop it from that hand"),
                })
                continue

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


def write_orphaned_submissions_csv(all_issues):
    """Write the genuinely-stranded submission variants (hubs already excluded) to
    a triage CSV. Each row suggests the host position/role parsed from from_position
    so the connection work (add to that position's transitions[]) is actionable.
    """
    import csv
    orphans = [i for i in all_issues if i["type"] == "orphaned_submission"]
    csv_path = Path("tests/artifacts/orphaned_submissions.csv")
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "from_position", "suggested_host_position", "suggested_role", "file"])
        for item in sorted(orphans, key=lambda i: i.get("name", "")):
            from_pos = item.get("from_position", "") or ""
            host, role = (from_pos.split("/", 1) + [""])[:2] if "/" in from_pos else (from_pos, "")
            writer.writerow([
                item.get("name", ""),
                from_pos,
                host,
                role,
                item.get("file", ""),
            ])
    return csv_path, len(orphans)


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


# ---------------------------------------------------------------------------
# Coherence gates on generated graph.json + templates/votes.json (calibration-v2 Phase 2.3b)
# ---------------------------------------------------------------------------

def _iter_graph_technique_nodes(graph):
    """Yield (node_key, node) for every transitions/submissions node in graph.json."""
    for coll_name in ("transitions", "submissions"):
        coll = graph.get(coll_name, {})
        if isinstance(coll, dict):
            for key, node in coll.items():
                if isinstance(node, dict):
                    yield key, node


def validate_successrate_coherence(graph):
    """Every attacker/defender node's headline successRate must equal the sum of its 'success'
    outcome probabilities (within 1.0). Guards the headline<->breakdown coherence the graph build's
    outcome rescale maintains after a vote/prior override.

    Returns ``(violations, coverage)``.

    WHY IT COUNTS. graph.json carries FOLDED scalars, so once the technique-level
    fork admits nulls this gate meets them three ways, and all three used to be
    invisible: ``successRate`` null (skipped by a bare ``continue``), an outcome
    ``probability`` null (``sum(o.get("probability", 0) ...)`` raised
    ``TypeError: unsupported operand type(s) for +: 'int' and 'NoneType'`` and took
    the whole audit down), and a node with no success outcome at all. A gate that
    skipped every node still printed "Coherence violations: 0" — the §6.6 shape:
    "found no problems" and "never looked" producing the same output. So: DROP the
    null cell, COUNT the drop, PRINT the count, and hard-fail when the positive
    count is 0 while nodes exist.

    Measured on today's graph.json: 2656 attacker/defender nodes, 2656 checked,
    0 skipped. Recompute the set with
      python3 -c "import json;g=json.load(open('graph.json'));print(sum(1 for c in ('transitions','submissions') for n in (g.get(c) or {}).values() if isinstance(n,dict) and n.get('role') in ('attacker','defender')))"
    """
    violations = []
    coverage = {"checked": 0, "no_success_outcome": 0, "null_rate": 0,
                "null_probability": 0, "nodes": 0}
    for key, node in _iter_graph_technique_nodes(graph):
        if node.get("role") not in ("attacker", "defender"):
            continue
        coverage["nodes"] += 1
        outcomes = node.get("outcomes")
        if not outcomes:
            coverage["no_success_outcome"] += 1
            continue
        succ = [o for o in outcomes if o.get("result") == "success"]
        if not succ:
            coverage["no_success_outcome"] += 1
            continue
        sr = node.get("successRate")
        if sr is None or not isinstance(sr, Number) or isinstance(sr, bool):
            # A null headline rate means the technique does not exist in the folded
            # frame — correctly unchecked, but never silently.
            coverage["null_rate"] += 1
            continue
        probs = [o.get("probability") for o in succ]
        nums = [v for v in probs if isinstance(v, Number) and not isinstance(v, bool)]
        if len(nums) != len(probs):
            # A headline rate WITH a hole in its breakdown. Summing the rest would
            # invent a total that is short by exactly the missing cells and report
            # a fabricated "incoherent" delta, so the comparison is dropped, not
            # guessed. Info severity: an absent frame is data, and this gate's job
            # is to stop the drop being silent, not to fail a legitimately forked
            # corpus on the max_errors:0 ratchet.
            coverage["null_probability"] += 1
            violations.append({
                "type": "successrate_probability_null",
                "severity": "info",
                "name": node.get("name", key),
                "node": key,
                "message": (f"{key}: successRate {sr:g} kept, but {len(probs) - len(nums)} of "
                            f"{len(probs)} success outcome probabilities are null/non-numeric "
                            f"— coherence comparison SKIPPED (a partial sum would be a "
                            f"fabricated delta)"),
            })
            continue
        coverage["checked"] += 1
        succ_sum = sum(nums)
        if abs(sr - succ_sum) > 1.0:
            violations.append({
                "type": "successrate_incoherent",
                "severity": "error",
                "name": node.get("name", key),
                "node": key,
                "message": (f"{key}: successRate {sr:g} != Σ success outcomes {succ_sum:g} "
                            f"(|Δ| {abs(sr - succ_sum):g} > 1.0)"),
            })
    # THE FLOOR. Nodes present but nothing compared = this gate checked NOTHING.
    if coverage["nodes"] and coverage["checked"] == 0:
        violations.append({
            "type": "successrate_coherence_no_coverage",
            "severity": "error",
            "name": "successRate coherence",
            "message": (f"successRate coherence compared 0 of {coverage['nodes']} attacker/"
                        f"defender nodes — this gate checked NOTHING; a clean result here "
                        f"is a false pass"),
        })
    return violations, coverage


def validate_defender_complement(graph):
    """Each attacker/defender pair (matched by base slug) must have complementary success rates:
    defender.successRate ≈ 100 - attacker.successRate (within 1.5).

    Returns ``(violations, coverage)``. The two ``continue``s below are correct —
    an unpaired attacker has nothing to complement, and a null successRate means
    the technique does not exist in the folded frame — but they were SILENT, so a
    graph in which every rate went null still printed "Coherence violations: 0"
    (CLAUDE.md §6.6). They are counted and printed now, with a floor on the
    positive count. Measured today: 1328 pairs checked, 0 skipped.
    """
    violations = []
    coverage = {"checked": 0, "no_pair": 0, "null_rate": 0, "attackers": 0}
    attackers, defenders = {}, {}
    for key, node in _iter_graph_technique_nodes(graph):
        role = node.get("role")
        base = key.rsplit("/", 1)[0]
        if role == "attacker":
            attackers[base] = node
        elif role == "defender":
            defenders[base] = node
    coverage["attackers"] = len(attackers)
    for base, att in attackers.items():
        dfn = defenders.get(base)
        if dfn is None:
            coverage["no_pair"] += 1
            continue
        asr = att.get("successRate")
        dsr = dfn.get("successRate")
        if (asr is None or dsr is None
                or not isinstance(asr, Number) or isinstance(asr, bool)
                or not isinstance(dsr, Number) or isinstance(dsr, bool)):
            # NOT `or 0`: a null rate is "does not exist in this frame", and 0
            # would assert the defender wins 100% of an exchange that never
            # happens. Drop the pair, count the drop.
            coverage["null_rate"] += 1
            continue
        coverage["checked"] += 1
        if abs(dsr - (100 - asr)) > 1.5:
            violations.append({
                "type": "defender_not_complement",
                "severity": "error",
                "name": att.get("name", base),
                "node": base,
                "message": (f"{base}: defender successRate {dsr:g} != 100 - attacker {asr:g} "
                            f"(= {100 - asr:g}, |Δ| {abs(dsr - (100 - asr)):g} > 1.5)"),
            })
    # THE FLOOR — attackers present but no pair compared means this checked NOTHING.
    if coverage["attackers"] and coverage["checked"] == 0:
        violations.append({
            "type": "defender_complement_no_coverage",
            "severity": "error",
            "name": "defender complement",
            "message": (f"defender-complement compared 0 of {coverage['attackers']} attacker "
                        f"nodes — this gate checked NOTHING; a clean result here is a false "
                        f"pass"),
        })
    return violations, coverage


def validate_votes_priors(votes_data):
    """Schema gate on templates/votes.json: community and prior are SEPARATE, PAIRED keys; every
    community frame has vote_count >= PRIOR_VOTE_COUNT; every present prior frame block has
    pseudo_count >= 1 and success_rate in [0,100]. Legacy (unmigrated) entries are skipped.

    Returns ``(violations, coverage)``. `prior.<rs> is None` is an ABSENT FRAME and
    is correctly skipped — but silently, so a votes file that lost a whole ruleset
    read exactly like one that passed (CLAUDE.md §6.6). Counted and printed now.
    Measured on templates/votes.json today: 1614 entries, 339 carry a prior, 678
    prior frame-blocks present, 0 absent; 1275 entries carry no prior at all, which
    is legitimate (community-only) and is why the ABSENT rule is NOT extended to
    "present in community, absent in prior" — scoped that way it flags 1275 x 2 =
    2550 rows on the current corpus and blows the max_errors:0 ratchet. Recompute:
      python3 -c "import json;v=json.load(open('templates/votes.json'))['votes'];print(len(v),sum(1 for e in v.values() if isinstance(e,dict) and e.get('prior')))"
    """
    violations = []
    coverage = {"entries": 0, "community_frames": 0, "prior_frames": 0,
                "prior_frames_absent": 0, "no_prior": 0}

    def add(name, msg):
        violations.append({"type": "votes_schema", "severity": "error", "name": name, "message": msg})

    for name, entry in votes_data.get("votes", {}).items():
        if not isinstance(entry, dict):
            continue
        coverage["entries"] += 1
        community = entry.get("community")
        prior = entry.get("prior")
        if community is not None:
            # RULESETS (the constant pair), not present_rulesets, is DELIBERATE
            # here: a community block is the ballot itself and must exist in both
            # frames — a missing one is the "missing vote_count" error below, not
            # an absent frame.
            for rs in RULESETS:
                block = community.get(rs)
                if not isinstance(block, dict) or block.get("vote_count") is None:
                    add(name, f"{name}: community.{rs} missing vote_count")
                else:
                    coverage["community_frames"] += 1
                    if block["vote_count"] < PRIOR_VOTE_COUNT:
                        add(name, f"{name}: community.{rs} vote_count {block['vote_count']} < {PRIOR_VOTE_COUNT}")
        if prior is None:
            coverage["no_prior"] += 1
        else:
            if community is None:
                add(name, f"{name}: has 'prior' but no 'community' (keys must be separate and paired)")
            for rs in RULESETS:
                block = prior.get(rs)
                if block is None:
                    # A ruleset frame may be absent; only present frames are
                    # checked. COUNTED, so an absent frame and a checked one can
                    # never print the same thing (CLAUDE.md §6.6).
                    coverage["prior_frames_absent"] += 1
                    continue
                coverage["prior_frames"] += 1
                pc = block.get("pseudo_count")
                sr = block.get("success_rate")
                if pc is None or pc < 1:
                    add(name, f"{name}: prior.{rs} pseudo_count {pc} < 1")
                if sr is None or not (0 <= sr <= 100):
                    add(name, f"{name}: prior.{rs} success_rate {sr} out of [0,100]")
    # THE FLOOR — entries present but no community frame verified means the schema
    # gate ran over nothing.
    if coverage["entries"] and coverage["community_frames"] == 0:
        add("votes.json", f"votes schema verified 0 community frames across "
                          f"{coverage['entries']} entries — this gate checked NOTHING; "
                          f"a clean result here is a false pass")
    return violations, coverage


def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph Integrity Audit — comprehensive graph checks"
    )
    parser.add_argument("--output", "-o", type=Path, default=REPORT_PATH,
                        help=f"Save JSON report to file (default: {REPORT_PATH})")
    parser.add_argument("--errors-only", "-e", action="store_true",
                        help="Only report error-severity issues (suppress warnings/info)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="List every attempt-probability outlier (otherwise only the count is shown)")
    args = parser.parse_args()

    total_steps = 14
    print("=" * 70)
    print("BJJ GRAPH INTEGRITY AUDIT")
    print("=" * 70)

    # Step 1: Build transition file index
    print(f"\n[1/{total_steps}] Building transition file index...")
    transition_index = build_transition_index()
    print(f"  Found {len(transition_index)} transition files with names")

    # Step 2: Build position references
    print(f"[2/{total_steps}] Scanning position files for transition references...")
    (all_refs, prob_errors, position_names, position_files,
     attempt_frame_issues, attempt_cov) = build_position_data()
    print(f"  Found {len(all_refs)} unique transition references across positions")
    print(f"  Found {len(position_names)} position names")
    print(f"  attempt_probability ruleset frames summed: {attempt_cov['checked']} "
          f"(skipped as absent: {attempt_cov['absent']})")

    # Step 2b: Build submission file index
    submission_index = {}
    family_hub_names = set()
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if data and data.get("name"):
            submission_index[data["name"]] = str(path)
            if data.get("is_family"):
                family_hub_names.add(data["name"])
    submission_file_names = set(submission_index.keys())

    # Step 3: Compute orphaned and missing transitions
    print(f"[3/{total_steps}] Computing orphaned and missing transitions...")
    transition_file_names = set(transition_index.keys())
    orphaned = transition_file_names - all_refs
    missing = all_refs - transition_file_names - submission_file_names

    print(f"  Orphaned transitions (file exists, not referenced): {len(orphaned)}")
    print(f"  Missing transitions (referenced, no file): {len(missing)}")

    # Step 4: Compute orphaned submissions.
    # A submission counts as "referenced" (reachable) if it is either listed
    # directly in a position's transitions[] (all_refs) OR is the `to` target of
    # some transition/submission outcome (Position -> Transition -> Submission).
    # Family hubs are aggregator pages reached via their variants / category page,
    # not graph nodes, so they are exempt rather than reported as orphans.
    print(f"[4/{total_steps}] Computing orphaned submissions...")
    outcome_targets = build_outcome_targets()
    orphaned_submissions = submission_file_names - all_refs - family_hub_names - outcome_targets
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
    outcome_issues, outcome_cov = check_outcome_probabilities()
    print(f"  outcomes.probability ruleset frames summed: {outcome_cov['checked']} "
          f"(skipped as absent: {outcome_cov['absent']})")

    # Ruleset-frame coverage totals, aggregated across both sum gates. Computed
    # here (not at summary time) because the FLOOR below has to become an ISSUE,
    # and issues are assembled further down.
    frames_checked = attempt_cov["checked"] + outcome_cov["checked"]
    frames_absent = attempt_cov["absent"] + outcome_cov["absent"]
    frames_dead = attempt_cov["dead"] + outcome_cov["dead"]
    frames_bare_null = attempt_cov["bare_null"] + outcome_cov["bare_null"]
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
    bidir_issues += check_position_type_vs_score()
    bidir_errors = [i for i in bidir_issues if i["severity"] == "error"]
    bidir_warnings = [i for i in bidir_issues if i["severity"] == "warning"]
    print(f"  Errors: {len(bidir_errors)}, Warnings: {len(bidir_warnings)}")

    # Step 13: Coherence gates on generated graph.json + templates/votes.json (calibration-v2 2.3b)
    print(f"[13/{total_steps}] Checking successRate / defender-complement / votes-prior coherence...")
    coherence_issues = []
    # Coverage for the three coherence gates. Each one is a bag of `continue`s over
    # values that may legitimately be null; without these counts "compared every
    # node, all coherent" and "compared nothing at all" print the same line
    # (CLAUDE.md §6.6). Each gate carries its own floor as an error-severity issue.
    sr_cov = {"checked": 0, "nodes": 0, "null_rate": 0, "null_probability": 0,
              "no_success_outcome": 0}
    dc_cov = {"checked": 0, "attackers": 0, "null_rate": 0, "no_pair": 0}
    vt_cov = {"entries": 0, "community_frames": 0, "prior_frames": 0,
              "prior_frames_absent": 0, "no_prior": 0}
    graph_data = load_json(GRAPH_PATH) if GRAPH_PATH.exists() else None
    votes_data = load_json(VOTES_PATH) if VOTES_PATH.exists() else None
    if graph_data:
        _v, sr_cov = validate_successrate_coherence(graph_data)
        coherence_issues.extend(_v)
        _v, dc_cov = validate_defender_complement(graph_data)
        coherence_issues.extend(_v)
    else:
        print(f"  (graph.json not present at {GRAPH_PATH} — skipping graph coherence checks)")
    if votes_data:
        _v, vt_cov = validate_votes_priors(votes_data)
        coherence_issues.extend(_v)
    else:
        print(f"  (votes.json not present at {VOTES_PATH} — skipping votes-prior checks)")
    print(f"  Coherence violations: {len(coherence_issues)}")
    # The POSITIVE coverage counts for step 13, printed on every run so that a gate
    # which skipped everything cannot look like a gate that found nothing.
    print(f"  successRate coherence: {sr_cov['checked']} of {sr_cov['nodes']} attacker/defender "
          f"nodes compared (skipped: {sr_cov['null_rate']} null successRate, "
          f"{sr_cov['null_probability']} null outcome probability, "
          f"{sr_cov['no_success_outcome']} no success outcome)")
    print(f"  defender complement:   {dc_cov['checked']} of {dc_cov['attackers']} attacker "
          f"nodes compared (skipped: {dc_cov['null_rate']} null rate, "
          f"{dc_cov['no_pair']} no defender)")
    print(f"  votes schema:          {vt_cov['community_frames']} community frames + "
          f"{vt_cov['prior_frames']} prior frames checked across {vt_cov['entries']} entries "
          f"(prior frames absent: {vt_cov['prior_frames_absent']}, "
          f"entries with no prior: {vt_cov['no_prior']})")

    # Step 14: Summary
    print(f"[14/{total_steps}] Compiling report...")

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

    # Shortened submission variant names (error)
    # A nested submission variant's top-level `name` must keep the full
    # "<Family> from <Position>" form. The graph keys submissions by `name`, so a
    # name shortened to just "from <Position>" (no technique prefix) silently breaks
    # the position->submission edge — surfacing later as the confusing
    # missing_transition + orphaned_submission pair. By BJJ naming convention a
    # submission name always starts with the technique, never "from ", so the prefix
    # is an unambiguous signal. We flag it directly with the deterministic correct
    # name ("<parent folder> <file stem>") so the fix is copy-pasteable and caught at
    # this gate rather than at the ~10-min build.
    for name in sorted(submission_file_names):
        if name.lower().startswith("from "):
            path = submission_index[name]
            p = Path(path)
            suggested = f"{p.parent.name} {p.stem}"
            all_issues.append({
                "type": "shortened_variant_name",
                "severity": "error",
                "name": name,
                "file": path,
                "message": (
                    f"Shortened submission variant name: '{name}' in {path} — "
                    f"restore the full form (suggest: '{suggested}'). Positions reference "
                    f"the full name; the short form breaks the graph edge and orphans the file."
                ),
            })

    # ── ONE NAME, ONE SECTION (error) ──────────────────────────────────────────────────────────
    # A technique's graph id is slugify(<name>) minted PER SECTION, so the id namespace is not
    # global: the same display name authored in both content/Transitions/ and content/Submissions/
    # produces the SAME id in two sections. Everything that resolves by section survives that;
    # scripts/regenerate_neural_data.py's flashcard join does not — it keys one flat dict and the
    # second write silently wins, dropping 10 decks / 90 cards. Worse, the two copies are two
    # independent authorings: measured, all 10 role-node pairs carry DIFFERENT outcomes, and the
    # submissions copy reaches `game-over` while the transitions copy does not. Nothing reported it.
    #
    # TWO SHAPES ARE LEGITIMATE AND ARE NOT FLAGGED:
    #   · a POSITION and a technique sharing a name (Knee on Belly is both a state and the move
    #     into it) — different sections, different kinds, no join collides on it;
    #   · a transition ENTRY plus a submission FAMILY HUB of the same name (Anaconda Choke: the
    #     transition enters Anaconda Control, the `is_family` submission is an edgeless flashcard
    #     aggregator with no outcomes). That pair is the documented content pattern.
    #
    # What is flagged is the third shape: the same move authored TWICE, both non-family. Those
    # five are enumerated so a new one fails immediately rather than joining an aggregate count
    # (CLAUDE.md §6.7 — a baseline names what it tolerates). Shrinking this set always passes;
    # emptying it should delete the set and this comment's last paragraph.
    # EMPTY, and it should stay empty. The five that were here were collapsed in v1.154.2 under
    # the owner's typing ruling — a move whose success edge reaches the game-over sink IS a
    # submission, so it may not also exist as a transition record. Re-populating this set would be
    # tolerating a type error, not baselining a known issue; fix the content instead.
    KNOWN_DUAL_AUTHORED = set()
    _dual = sorted((transition_file_names & submission_file_names) - family_hub_names)
    print(f"  cross-section name check: {len(transition_file_names)} transitions x "
          f"{len(submission_file_names)} submissions -> {len(_dual)} authored in BOTH as non-family"
          + (f" ({len(set(_dual) - KNOWN_DUAL_AUTHORED)} unbaselined)" if _dual else ""))
    for name in _dual:
        if name in KNOWN_DUAL_AUTHORED:
            continue
        all_issues.append({
            "type": "dual_authored_technique",
            "severity": "error",
            "name": name,
            "file": transition_index.get(name, ""),
            "message": (
                f"'{name}' is authored as BOTH a transition ({transition_index.get(name)}) and a "
                f"non-family submission ({submission_index.get(name)}). One id, two state machines: "
                f"the flashcard join keys them identically and silently drops one deck. Keep one "
                f"file, or rename one (a grip ENTRY and its FINISH are different moves and deserve "
                f"different names)."
            ),
        })
    for name in sorted(KNOWN_DUAL_AUTHORED - set(_dual)):
        print(f"  cross-section name check: '{name}' is FIXED — remove it from KNOWN_DUAL_AUTHORED")

    # ── SUCCESS-REACHABILITY (report) ──────────────────────────────────────────────────────────
    # A position that no move can REACH BY SUCCEEDING is enterable only by failing something. That
    # is almost always a modelling accident, and the ordinary in-degree check cannot see it: when
    # the Kimura twin collapsed, `kimura-trap/bottom` went 5 -> 4 total inbound and 1 -> 0
    # success-result inbound, so every "in-degree >= 1" formulation passed it green. Count the
    # SUCCESS arrivals specifically, or this class stays invisible.
    #
    # NOW AN ERROR on any NEW instance (v1.156.0), which is what the reporting-only version of this
    # block asked for. It was reporting-only while `reviewed` held Kimura Trap/Bottom — a deliberate,
    # ratified consequence of the twin collapse. That row was resolved by authoring
    # `Half Guard to Kimura Trap`, `reviewed` is empty, and the 123 rows left in `known` are all the
    # passive-seat class (the successful performer lands on the opposite seat, which the role-split
    # derives). A NEW instance therefore means somebody deleted a state's only way in, and that is
    # an error. Baselined rows stay silent; shrinking the list still always passes.
    _succ_in, _any_in = {}, {}
    for _path in list(TRANSITIONS_PATH.rglob("*.json")) + list(SUBMISSIONS_PATH.rglob("*.json")):
        _d = load_json(_path)
        if not isinstance(_d, dict) or _d.get("is_family"):
            continue
        for _o in _d.get("outcomes") or []:
            _to = _o.get("to")
            if not _to or _to == "game-over":
                continue
            _any_in[_to] = _any_in.get(_to, 0) + 1
            if _o.get("result") == "success":
                _succ_in[_to] = _succ_in.get(_to, 0) + 1
    _fail_only = sorted(t for t in _any_in if not _succ_in.get(t))
    _base_path = Path("tests/artifacts/success_reachability_baseline.json")
    _base = load_json(_base_path) or {}
    _baselined = set(_base.get("known") or {}) | set(_base.get("reviewed") or {})
    _new = [t for t in _fail_only if t not in _baselined]
    _fixed = sorted(_baselined - set(_fail_only))
    print(f"  success-reachability: {len(_any_in)} position role-node(s) receive an outcome edge; "
          f"{len(_succ_in)} reachable by SUCCEEDING; {len(_fail_only)} only by failing "
          f"({len(_baselined)} baselined, {len(_new)} new)")
    if not _any_in:
        print("  success-reachability: 0 edges seen — the check looked at nothing, treat as broken")
    for _t in _new:
        all_issues.append({
            "type": "success_unreachable",
            "severity": "error",
            "name": _t,
            "message": (f"{_t} has {_any_in[_t]} inbound edge(s), none a success. A player can only "
                        f"arrive there by failing their own move. If a move was just deleted, it was "
                        f"that position's last way in; re-author the entry under a non-colliding name "
                        f"rather than restoring a twin (never restore the twin)."),
        })
        print(f"    success-reachability: NEW — {_t!r} has {_any_in[_t]} inbound edge(s), none a "
              f"success. A player can only arrive there by failing their own move. If a move was "
              f"just deleted, it was that position's last way in; re-author the entry under a "
              f"non-colliding name rather than restoring a twin.")
    for _t in _fixed:
        print(f"    success-reachability: {_t!r} is FIXED — remove it from {_base_path}")

    # Ruleset-frame coverage issues (info for an absent frame, error for a value
    # that exists in no frame at all, error for a bare null). These are the trace a
    # SKIPPED sum leaves behind — without them an absent frame and a clean frame
    # print identically (CLAUDE.md §6.6).
    all_issues.extend(attempt_frame_issues)

    # THE FLOOR, as an ISSUE. It has to be one: ci-validate.yml runs this script
    # with `|| true` and gates on report["summary"]["errors"], so a floor that only
    # set an exit code would be invisible to the PR ratchet — the gate that exists
    # to protect the deploy. Reached when the content tree is empty or unreadable,
    # or every probability in the corpus went null in both frames at once; all of
    # which used to print "Errors: 0" and exit 0 (CLAUDE.md §6.6).
    if frames_checked == 0:
        all_issues.append({
            "type": "no_frames_checked",
            "severity": "error",
            "message": ("0 ruleset frames were summed — this gate checked NOTHING. "
                        "Empty or unreadable content tree, or every probability null "
                        "in both frames. A clean report here is a false pass."),
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

    # Coherence gates on generated graph.json + votes.json (error)
    all_issues.extend(coherence_issues)

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

    # Shortened submission variant names
    shortened_variant_details = [i for i in all_issues if i["type"] == "shortened_variant_name"]
    if shortened_variant_details:
        print(f"\n--- SHORTENED SUBMISSION VARIANT NAMES ({len(shortened_variant_details)}) ---")
        print("(Variant top-level `name` shortened to 'from <Position>' — breaks the graph edge)")
        for i in shortened_variant_details:
            print(f"  {i['message']}")

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

    # Ruleset frames that were SKIPPED because they do not exist, plus values that
    # exist in no ruleset at all. Printed only when non-empty: the running TOTALS
    # print unconditionally in the SUMMARY block below, so a zero here is already
    # reported and a section of nothing would just be noise. Without this list a
    # skipped sum left no trace a human would ever read — the by-type tally names
    # the type but not the file (CLAUDE.md §6.6).
    frame_absent_issues = [i for i in all_issues if i["type"].endswith("_frame_absent")]
    frame_dead_issues = [i for i in all_issues
                         if i["type"].endswith("_no_ruleset") or i["type"].endswith("_bare_null")]
    if frame_absent_issues or frame_dead_issues:
        print(f"\n--- RULESET FRAMES SKIPPED / ABSENT "
              f"({len(frame_absent_issues) + len(frame_dead_issues)}) ---")
        for i in frame_dead_issues:
            print(f"  ERROR: {i['message']}")
        for i in frame_absent_issues:
            print(f"  {i['message']}")

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

    # Coherence violations (graph.json successRate/complement + votes.json prior schema)
    sr_incoherent = [i for i in all_issues if i["type"] == "successrate_incoherent"]
    complement_bad = [i for i in all_issues if i["type"] == "defender_not_complement"]
    votes_schema_bad = [i for i in all_issues if i["type"] == "votes_schema"]
    coherence_total = len(sr_incoherent) + len(complement_bad) + len(votes_schema_bad)
    # The step-13 SKIP trace: nodes whose comparison was dropped because a value is
    # null, and the two floors. These must print their own MESSAGE, not just land in
    # the by-type tally — a tally names the type, never the node, and a skip nobody
    # can read is the silence this whole pass exists to remove (CLAUDE.md §6.6).
    # Empty on today's corpus, so this section is absent from today's output.
    coherence_skips = [i for i in all_issues if i["type"] in (
        "successrate_probability_null",
        "successrate_coherence_no_coverage",
        "defender_complement_no_coverage",
    )]
    print(f"\n--- COHERENCE VIOLATIONS ({coherence_total}) ---")
    print("(graph.json successRate<->outcomes, defender complement, votes.json prior schema)")
    for e in (sr_incoherent + complement_bad + votes_schema_bad)[:20]:
        print(f"  {e['message']}")
    if coherence_total > 20:
        print(f"  ... and {coherence_total - 20} more")
    if coherence_skips:
        print(f"\n--- COHERENCE COMPARISONS SKIPPED ({len(coherence_skips)}) ---")
        for e in coherence_skips[:20]:
            print(f"  {e['message']}")
        if len(coherence_skips) > 20:
            print(f"  ... and {len(coherence_skips) - 20} more")

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
        if args.verbose:
            for o in attempt_outliers[:20]:
                print(f"  {o['message']}")
            if len(attempt_outliers) > 20:
                print(f"  ... and {len(attempt_outliers) - 20} more")
        else:
            negligible = sum(1 for o in attempt_outliers if o["type"] == "attempt_negligible")
            dominant = sum(1 for o in attempt_outliers if o["type"] == "attempt_dominant")
            print(f"  {negligible} negligible (<{THRESHOLDS['attempt_too_low']}%), {dominant} dominant "
                  f"(>{THRESHOLDS['attempt_too_high']}%) — expected for long transition lists that sum to 100%.")
            print("  (info-level; pass --verbose to list each one)")

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
    print(f"  Coherence violations:   {coherence_total} "
          f"(successRate {len(sr_incoherent)}, complement {len(complement_bad)}, votes {len(votes_schema_bad)})")
    # The positive coverage count. It prints on EVERY run, green or red, and it
    # survives --errors-only, because its whole job is to stop "no frame was ever
    # summed" from looking like "every frame summed clean" (CLAUDE.md §6.6). A
    # non-zero `skipped` is a corpus shedding a ruleset — expected once nulls land,
    # but never silent.
    print(f"  Ruleset frames summed:  {frames_checked} "
          f"(attempt {attempt_cov['checked']}, outcomes {outcome_cov['checked']})")
    print(f"    Skipped (frame absent in that ruleset): {frames_absent} "
          f"(attempt {attempt_cov['absent']}, outcomes {outcome_cov['absent']})")
    if frames_dead or frames_bare_null:
        print(f"    Values existing in NO ruleset: {frames_dead}   bare-null rows: {frames_bare_null}")
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
            "coherence_violations": coherence_total,
            "successrate_incoherent": len(sr_incoherent),
            "defender_not_complement": len(complement_bad),
            "votes_schema_violations": len(votes_schema_bad),
            # Coverage, not defects: how many gi/no-gi frames this run actually
            # summed, and how many it skipped because the frame does not exist.
            "ruleset_frames_checked": frames_checked,
            "ruleset_frames_absent": frames_absent,
            "attempt_frames_checked": attempt_cov["checked"],
            "attempt_frames_absent": attempt_cov["absent"],
            "outcome_frames_checked": outcome_cov["checked"],
            "outcome_frames_absent": outcome_cov["absent"],
            "values_in_no_ruleset": frames_dead,
            "bare_null_rows": frames_bare_null,
            # Step 13 coverage — the positive counts behind "Coherence violations".
            "successrate_nodes_compared": sr_cov["checked"],
            "successrate_nodes_total": sr_cov["nodes"],
            "successrate_skipped_null_rate": sr_cov["null_rate"],
            "successrate_skipped_null_probability": sr_cov["null_probability"],
            "complement_pairs_compared": dc_cov["checked"],
            "complement_skipped_null_rate": dc_cov["null_rate"],
            "votes_community_frames_checked": vt_cov["community_frames"],
            "votes_prior_frames_checked": vt_cov["prior_frames"],
            "votes_prior_frames_absent": vt_cov["prior_frames_absent"],
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

    # Write triage CSV of genuinely-stranded submission variants (hubs excluded)
    orphan_csv_path, orphan_csv_count = write_orphaned_submissions_csv(all_issues)
    print(f"Stranded submissions triage saved to: {orphan_csv_path} ({orphan_csv_count} entries)")

    # Append to shared suggested_new_files.csv
    result = write_suggested_new_files_csv(all_issues)
    if result:
        suggested_path, suggested_count = result
        print(f"Suggested new files appended to: {suggested_path} ({suggested_count} entries)")
    else:
        print("No new file suggestions from audit.")

    # The floor's own line. The verdict itself already rode in as an
    # error-severity issue above (so the PR ratchet sees it); this only makes the
    # reason legible to whoever is reading the run.
    if frames_checked == 0:
        print("\n  FAIL: 0 ruleset frames were summed. This gate checked NOTHING — "
              "an empty/unreadable content tree, or every probability null in both "
              "frames. A clean report here would be a false pass.")

    # Exit code 1 only for error-severity issues
    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
