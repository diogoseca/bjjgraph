#!/usr/bin/env python3
"""
BJJ Graph LLM Proofreader
===========================
Uses a BJJ black belt expert persona to semantically audit every file's
transitions, outcomes, and probabilities in the knowledge graph.

The LLM returns lightweight change reports (not full file replacements).
Changes are applied surgically: removals, additions, probability adjustments,
and normalization to 100%.

Usage:
    python3 scripts/proofread_all_transitions.py                            # all files
    python3 scripts/proofread_all_transitions.py --dry-run                  # show prompts only
    python3 scripts/proofread_all_transitions.py --file content/Positions/Mount.json
    python3 scripts/proofread_all_transitions.py --category Transitions --max-files 10
    python3 scripts/proofread_all_transitions.py --batch                    # no delay between files
"""

import argparse
import csv
import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from tqdm import tqdm

# =============================================================================
# CONSTANTS
# =============================================================================
CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
LOGS_PATH = Path("logs/proofread")
SUGGESTIONS_CSV = Path("tests/artifacts/suggested_new_files.csv")

CLAUDE_MODEL = "claude-opus-4-8[1m]"
# Reasoning effort (low|medium|high|xhigh|max). Bulk audit is one call per file
# (~25h for the full corpus at xhigh); scope with --file/--category as needed.
CLAUDE_EFFORT = "xhigh"

# =============================================================================
# REFERENCE LIST BUILDING (matches regenerate_content_json.py pattern)
# =============================================================================

def build_reference_lists() -> Dict[str, List[str]]:
    """Build lists of all valid content names by category."""
    refs: Dict[str, List[str]] = {
        "positions": [],
        "transitions": [],
        "submissions": [],
    }

    def get_names(path: Path) -> List[str]:
        names = []
        for f in path.rglob("*.json"):
            if "TEMPLATE" not in f.name:
                names.append(f.stem)
        return sorted(set(names))

    refs["positions"] = get_names(POSITIONS_PATH)
    refs["transitions"] = get_names(TRANSITIONS_PATH)
    refs["submissions"] = get_names(SUBMISSIONS_PATH)
    return refs


def detect_category(file_path: Path) -> str:
    """Detect content category from file path."""
    path_str = str(file_path)
    if "Positions" in path_str:
        return "Positions"
    elif "Transitions" in path_str:
        return "Transitions"
    elif "Submissions" in path_str:
        return "Submissions"
    return "Unknown"


# =============================================================================
# CLAUDE INTERACTION (matches regenerate_content_json.py pattern)
# =============================================================================

def call_claude(prompt: str, response_schema: dict, timeout: int = 300) -> Tuple[Optional[str], Optional[str]]:
    """Call Claude CLI with structured JSON output."""
    try:
        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--model", CLAUDE_MODEL,
                "--effort", CLAUDE_EFFORT,
                "--output-format", "json",
                "--json-schema", json.dumps(response_schema),
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=Path.cwd(),
        )

        if result.returncode != 0:
            return None, f"Claude CLI error: {result.stderr}"

        try:
            cli_output = json.loads(result.stdout)
            structured = cli_output.get("structured_output")
            if structured is not None:
                if isinstance(structured, dict):
                    return json.dumps(structured), None
                return structured, None
            return cli_output.get("result", result.stdout.strip()), None
        except (json.JSONDecodeError, KeyError):
            return result.stdout.strip(), None

    except subprocess.TimeoutExpired:
        return None, "Claude CLI timeout"
    except FileNotFoundError:
        return None, "Claude CLI not found - ensure 'claude' is in PATH"
    except Exception as e:
        return None, f"Claude CLI exception: {e}"


def extract_json(response: str) -> Tuple[Optional[dict], Optional[str]]:
    """Extract JSON from Claude's response."""
    try:
        return json.loads(response), None
    except Exception:
        pass

    for pattern in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        matches = re.findall(pattern, response)
        for match in matches:
            try:
                return json.loads(match), None
            except Exception:
                continue

    try:
        start = response.find('{')
        end = response.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end]), None
    except Exception:
        pass

    return None, "Could not extract valid JSON from response"


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PREAMBLE = """You are a BJJ black belt master instructor with 20+ years of competitive and \
teaching experience. You are auditing a knowledge graph that models BJJ as a \
state machine (positions → transitions → positions).

Your ONLY task is to check whether the graph connections (transitions, outcomes, \
probabilities) make sense from a BJJ perspective. You are NOT rewriting content \
or improving prose — only auditing the state machine edges.

CRITICAL: You may ONLY reference names that exist in the provided file lists. \
If you want to suggest a transition/position that doesn't exist, put it in \
"suggested_new_files" instead."""


# =============================================================================
# PER-CATEGORY PROMPTS
# =============================================================================

def build_position_prompt(data: dict, refs: Dict[str, List[str]]) -> str:
    return f"""{SYSTEM_PREAMBLE}

## Task: Audit POSITION file

Audit the `transitions` arrays in top and bottom roles:
- Flag unrealistic transitions (e.g., a sweep listed under top mount — sweeps come from bottom)
- Flag missing common transitions a purple+ belt would attempt from this position
- Flag duplicate or near-duplicate transitions
- Validate attempt_probability values are realistic and sum to 100 per role
- Consider the position's nature: is it a guard (bottom offensive), a pin (top dominant), or neutral?

## File content:
```json
{json.dumps(data, indent=2)}
```

## All valid position names ({len(refs['positions'])}):
{', '.join(refs['positions'])}

## All valid transition names ({len(refs['transitions'])}):
{', '.join(refs['transitions'])}

## All valid submission names ({len(refs['submissions'])}):
{', '.join(refs['submissions'])}

IMPORTANT: Only reference names from the lists above. If a transition you want to add doesn't exist, put it in suggested_new_files."""


def build_transition_prompt(data: dict, refs: Dict[str, List[str]]) -> str:
    attacker_section = ""
    defender_section = ""
    if 'attacker' in data:
        attacker_section = """
Audit attacker section:
- Validate common_counters[].targets_outcome values match outcomes[].to
- Flag missing counters or unrealistic effectiveness ratings
- Check execution_steps are in logical order
"""
    if 'defender' in data:
        defender_section = """
Audit defender section:
- Validate defensive_options[].targets_outcome values match outcomes[].to
- Validate favorable_outcomes[].outcome values match outcomes[].to
- Flag unrealistic recognition_cues
- Check defensive_options cover the main defense scenarios
"""

    return f"""{SYSTEM_PREAMBLE}

## Task: Audit TRANSITION file

Audit `from_position` and `outcomes`:
- Validate from_position is correct (does this technique actually start from this position/role?)
- Flag unrealistic outcomes (can this technique actually reach this position?)
- Flag missing outcomes (common results not listed, e.g., missing a common counter)
- Validate result types (success/failure/counter) make sense for each outcome
- Validate outcome probabilities are realistic and sum to 100
- Consider: is this a high-percentage or low-percentage technique?
- Outcomes[].to MUST use Position/Role format (e.g., "Mount/Top", not "Mount")
{attacker_section}{defender_section}

## File content:
```json
{json.dumps(data, indent=2)}
```

## All valid position names ({len(refs['positions'])}):
{', '.join(refs['positions'])}

## All valid transition names ({len(refs['transitions'])}):
{', '.join(refs['transitions'])}

## All valid submission names ({len(refs['submissions'])}):
{', '.join(refs['submissions'])}

IMPORTANT: Only reference names from the lists above. If an outcome position you want to add doesn't exist, put it in suggested_new_files."""


def build_submission_prompt(data: dict, refs: Dict[str, List[str]]) -> str:
    attacker_section = ""
    defender_section = ""
    if 'attacker' in data:
        attacker_section = """
Audit attacker section:
- Validate common_counters[].targets_outcome values match outcomes[].to
- Check execution_steps include timing information
- Verify safety_critical flashcards questions exist
"""
    if 'defender' in data:
        defender_section = """
Audit defender section:
- Validate defensive_options[].targets_outcome values match outcomes[].to
- Validate favorable_outcomes[].outcome values match outcomes[].to
- Check escape_paths are realistic
- Verify recognition_cues are tactile/visual (not abstract)
"""

    outcomes_section = ""
    if 'outcomes' not in data or not data.get('outcomes'):
        outcomes_section = """
CRITICAL: This submission has NO outcomes[] array. You MUST suggest outcomes:
- At least one "success" outcome leading to "game-over"
- At least one "failure" outcome returning to the starting position
- Probabilities must sum to 100
"""

    return f"""{SYSTEM_PREAMBLE}

## Task: Audit SUBMISSION file

Audit `starting_position`, `outcomes`, and related content:
- Validate starting_position is accurate (can this submission actually be applied from here?)
- Flag missing or wrong related submissions that commonly chain together
- Validate from_positions list (are these positions where you'd realistically attempt this?)
- Validate outcomes[] exist and probabilities sum to 100
- Outcomes[].to MUST use Position/Role format (e.g., "Mount/Top", not "Mount")
{outcomes_section}{attacker_section}{defender_section}

## File content:
```json
{json.dumps(data, indent=2)}
```

## All valid position names ({len(refs['positions'])}):
{', '.join(refs['positions'])}

## All valid transition names ({len(refs['transitions'])}):
{', '.join(refs['transitions'])}

## All valid submission names ({len(refs['submissions'])}):
{', '.join(refs['submissions'])}

IMPORTANT: Only reference names from the lists above. If a related submission you want to add doesn't exist, put it in suggested_new_files."""


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

def build_response_schema(category: str) -> dict:
    """Build the JSON schema for the LLM response based on category."""
    change_item = {
        "type": "object",
        "properties": {
            "transition": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["transition", "reason"],
    }

    add_item = {
        "type": "object",
        "properties": {
            "transition": {"type": "string"},
            "attempt_probability": {"type": "integer"},
            "reason": {"type": "string"},
        },
        "required": ["transition", "attempt_probability", "reason"],
    }

    prob_adjust = {
        "type": "object",
        "properties": {
            "transition": {"type": "string"},
            "current": {"type": "integer"},
            "suggested": {"type": "integer"},
            "reason": {"type": "string"},
        },
        "required": ["transition", "current", "suggested", "reason"],
    }

    suggested_file = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "category": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["name", "category", "reason"],
    }

    if category == "Positions":
        return {
            "type": "object",
            "properties": {
                "file_name": {"type": "string"},
                "has_changes": {"type": "boolean"},
                "reasoning": {"type": "string"},
                "changes": {
                    "type": "object",
                    "properties": {
                        "top_transitions_to_remove": {"type": "array", "items": change_item},
                        "top_transitions_to_add": {"type": "array", "items": add_item},
                        "top_probability_adjustments": {"type": "array", "items": prob_adjust},
                        "bottom_transitions_to_remove": {"type": "array", "items": change_item},
                        "bottom_transitions_to_add": {"type": "array", "items": add_item},
                        "bottom_probability_adjustments": {"type": "array", "items": prob_adjust},
                    },
                    "required": [
                        "top_transitions_to_remove", "top_transitions_to_add", "top_probability_adjustments",
                        "bottom_transitions_to_remove", "bottom_transitions_to_add", "bottom_probability_adjustments",
                    ],
                },
                "suggested_new_files": {"type": "array", "items": suggested_file},
            },
            "required": ["file_name", "has_changes", "reasoning", "changes", "suggested_new_files"],
        }

    elif category == "Transitions":
        outcome_remove = {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["to", "reason"],
        }
        outcome_add = {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "probability": {"type": "integer"},
                "result": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["to", "probability", "result", "reason"],
        }
        outcome_adjust = {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "current": {"type": "integer"},
                "suggested": {"type": "integer"},
                "reason": {"type": "string"},
            },
            "required": ["to", "current", "suggested", "reason"],
        }
        return {
            "type": "object",
            "properties": {
                "file_name": {"type": "string"},
                "has_changes": {"type": "boolean"},
                "reasoning": {"type": "string"},
                "changes": {
                    "type": "object",
                    "properties": {
                        "from_position_fix": {
                            "type": ["object", "null"],
                            "properties": {
                                "current": {"type": "string"},
                                "suggested": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                        },
                        "outcomes_to_remove": {"type": "array", "items": outcome_remove},
                        "outcomes_to_add": {"type": "array", "items": outcome_add},
                        "outcome_probability_adjustments": {"type": "array", "items": outcome_adjust},
                    },
                    "required": ["from_position_fix", "outcomes_to_remove", "outcomes_to_add", "outcome_probability_adjustments"],
                },
                "suggested_new_files": {"type": "array", "items": suggested_file},
            },
            "required": ["file_name", "has_changes", "reasoning", "changes", "suggested_new_files"],
        }

    else:  # Submissions
        return {
            "type": "object",
            "properties": {
                "file_name": {"type": "string"},
                "has_changes": {"type": "boolean"},
                "reasoning": {"type": "string"},
                "changes": {
                    "type": "object",
                    "properties": {
                        "starting_position_fix": {
                            "type": ["object", "null"],
                            "properties": {
                                "current": {"type": "string"},
                                "suggested": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                        },
                        "from_positions_to_remove": {"type": "array", "items": {"type": "object", "properties": {"position": {"type": "string"}, "reason": {"type": "string"}}, "required": ["position", "reason"]}},
                        "from_positions_to_add": {"type": "array", "items": {"type": "object", "properties": {"position": {"type": "string"}, "reason": {"type": "string"}}, "required": ["position", "reason"]}},
                        "related_submissions_to_remove": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "reason": {"type": "string"}}, "required": ["name", "reason"]}},
                        "related_submissions_to_add": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "reason": {"type": "string"}}, "required": ["name", "reason"]}},
                    },
                    "required": ["starting_position_fix", "from_positions_to_remove", "from_positions_to_add", "related_submissions_to_remove", "related_submissions_to_add"],
                },
                "suggested_new_files": {"type": "array", "items": suggested_file},
            },
            "required": ["file_name", "has_changes", "reasoning", "changes", "suggested_new_files"],
        }


# =============================================================================
# CHANGE APPLICATION
# =============================================================================

def normalize_probabilities(items: List[dict], key: str = "attempt_probability") -> List[dict]:
    """Normalize probability values to sum to exactly 100.

    Adjusts the largest value to absorb rounding error.
    """
    if not items:
        return items

    total = sum(item.get(key, 0) for item in items)
    if total == 100 or total == 0:
        return items

    diff = 100 - total
    # Find item with largest probability to absorb the difference
    max_idx = max(range(len(items)), key=lambda i: items[i].get(key, 0))
    items[max_idx][key] = items[max_idx].get(key, 0) + diff
    return items


def apply_position_changes(data: dict, changes: dict) -> Tuple[dict, List[str]]:
    """Apply position audit changes and return modified data + change log."""
    log = []

    for role in ["top", "bottom"]:
        if role not in data:
            continue

        transitions = data[role].get("transitions", [])
        prefix = role

        # Removals
        to_remove = changes.get(f"{prefix}_transitions_to_remove", [])
        for item in to_remove:
            name = item.get("transition", "")
            before = len(transitions)
            transitions = [t for t in transitions if t.get("transition") != name]
            if len(transitions) < before:
                log.append(f"Removed {role}/{name}: {item.get('reason', '')}")

        # Additions
        to_add = changes.get(f"{prefix}_transitions_to_add", [])
        for item in to_add:
            name = item.get("transition", "")
            prob = item.get("attempt_probability", 5)
            # Don't add duplicates
            if not any(t.get("transition") == name for t in transitions):
                transitions.append({"transition": name, "attempt_probability": prob})
                log.append(f"Added {role}/{name} ({prob}%): {item.get('reason', '')}")

        # Probability adjustments
        adjustments = changes.get(f"{prefix}_probability_adjustments", [])
        for adj in adjustments:
            name = adj.get("transition", "")
            suggested = adj.get("suggested", 0)
            for t in transitions:
                if t.get("transition") == name:
                    old = t.get("attempt_probability", 0)
                    t["attempt_probability"] = suggested
                    log.append(f"Adjusted {role}/{name}: {old}% -> {suggested}%: {adj.get('reason', '')}")
                    break

        # Normalize
        transitions = normalize_probabilities(transitions, "attempt_probability")
        data[role]["transitions"] = transitions

    return data, log


def apply_transition_changes(data: dict, changes: dict) -> Tuple[dict, List[str]]:
    """Apply transition audit changes and return modified data + change log."""
    log = []

    # from_position fix
    fp_fix = changes.get("from_position_fix")
    if fp_fix and isinstance(fp_fix, dict) and fp_fix.get("suggested"):
        old = data.get("from_position", "")
        data["from_position"] = fp_fix["suggested"]
        log.append(f"Fixed from_position: '{old}' -> '{fp_fix['suggested']}': {fp_fix.get('reason', '')}")

    outcomes = data.get("outcomes", [])

    # Removals
    for item in changes.get("outcomes_to_remove", []):
        to_val = item.get("to", "")
        before = len(outcomes)
        outcomes = [o for o in outcomes if o.get("to") != to_val]
        if len(outcomes) < before:
            log.append(f"Removed outcome -> {to_val}: {item.get('reason', '')}")

    # Additions
    for item in changes.get("outcomes_to_add", []):
        to_val = item.get("to", "")
        if not any(o.get("to") == to_val for o in outcomes):
            outcomes.append({
                "to": to_val,
                "probability": item.get("probability", 10),
                "result": item.get("result", "success"),
            })
            log.append(f"Added outcome -> {to_val} ({item.get('probability', 10)}%, {item.get('result', 'success')}): {item.get('reason', '')}")

    # Probability adjustments
    for adj in changes.get("outcome_probability_adjustments", []):
        to_val = adj.get("to", "")
        suggested = adj.get("suggested", 0)
        for o in outcomes:
            if o.get("to") == to_val:
                old = o.get("probability", 0)
                o["probability"] = suggested
                log.append(f"Adjusted outcome -> {to_val}: {old}% -> {suggested}%: {adj.get('reason', '')}")
                break

    # Normalize
    outcomes = normalize_probabilities(outcomes, "probability")
    data["outcomes"] = outcomes

    return data, log


def apply_submission_changes(data: dict, changes: dict) -> Tuple[dict, List[str]]:
    """Apply submission audit changes and return modified data + change log."""
    log = []

    # starting_position fix
    sp_fix = changes.get("starting_position_fix")
    if sp_fix and isinstance(sp_fix, dict) and sp_fix.get("suggested"):
        old = data.get("starting_position", "")
        data["starting_position"] = sp_fix["suggested"]
        log.append(f"Fixed starting_position: '{old}' -> '{sp_fix['suggested']}': {sp_fix.get('reason', '')}")

    # from_positions removals/additions
    from_positions = data.get("from_positions", [])
    for item in changes.get("from_positions_to_remove", []):
        pos = item.get("position", "")
        if pos in from_positions:
            from_positions.remove(pos)
            log.append(f"Removed from_position: {pos}: {item.get('reason', '')}")

    for item in changes.get("from_positions_to_add", []):
        pos = item.get("position", "")
        if pos not in from_positions:
            from_positions.append(pos)
            log.append(f"Added from_position: {pos}: {item.get('reason', '')}")

    data["from_positions"] = from_positions

    # related_submissions removals/additions
    related = data.get("related_submissions", [])
    for item in changes.get("related_submissions_to_remove", []):
        name = item.get("name", "")
        if name in related:
            related.remove(name)
            log.append(f"Removed related_submission: {name}: {item.get('reason', '')}")

    for item in changes.get("related_submissions_to_add", []):
        name = item.get("name", "")
        if name not in related:
            related.append(name)
            log.append(f"Added related_submission: {name}: {item.get('reason', '')}")

    data["related_submissions"] = related

    return data, log


# =============================================================================
# FILE PROCESSING
# =============================================================================

def process_file(file_path: Path, refs: Dict[str, List[str]], dry_run: bool = False) -> dict:
    """Process a single file: build prompt, call LLM, apply changes.

    Returns dict with keys: outcome, changes_count, suggested_new_files, log.
    """
    result_info: Dict[str, Any] = {
        "outcome": "failed",
        "changes_count": 0,
        "suggested_new_files": [],
        "log": [],
    }

    # Load file
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ERROR: Could not load {file_path}: {e}")
        return result_info

    category = detect_category(file_path)
    if category == "Unknown":
        print(f"  SKIP: Unknown category for {file_path}")
        result_info["outcome"] = "skipped"
        return result_info

    # Build prompt
    if category == "Positions":
        prompt = build_position_prompt(data, refs)
    elif category == "Transitions":
        prompt = build_transition_prompt(data, refs)
    else:
        prompt = build_submission_prompt(data, refs)

    schema = build_response_schema(category)

    if dry_run:
        print(f"  [DRY RUN] Prompt length: {len(prompt)} chars")
        print(f"  [DRY RUN] First 500 chars of prompt:")
        print(f"  {prompt[:500]}...")
        result_info["outcome"] = "dry_run"
        return result_info

    # Call Claude
    print(f"  Calling Claude ({CLAUDE_MODEL})...", flush=True)
    response, error = call_claude(prompt, schema)

    if error:
        print(f"  ERROR: {error}")
        result_info["log"].append(f"API error: {error}")
        return result_info

    # Parse response
    parsed, parse_error = extract_json(response)
    if parse_error:
        print(f"  ERROR: {parse_error}")
        result_info["log"].append(f"Parse error: {parse_error}")
        return result_info

    # Check if LLM found changes
    has_changes = parsed.get("has_changes", False)
    reasoning = parsed.get("reasoning", "")
    print(f"  Reasoning: {reasoning[:120]}...")

    if not has_changes:
        print(f"  No changes needed")
        result_info["outcome"] = "no_changes"
        result_info["log"].append(reasoning)
        return result_info

    # Apply changes
    changes = parsed.get("changes", {})
    if category == "Positions":
        data, change_log = apply_position_changes(data, changes)
    elif category == "Transitions":
        data, change_log = apply_transition_changes(data, changes)
    else:
        data, change_log = apply_submission_changes(data, changes)

    result_info["changes_count"] = len(change_log)
    result_info["log"] = change_log
    result_info["suggested_new_files"] = parsed.get("suggested_new_files", [])

    if change_log:
        # Save modified file
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"  Applied {len(change_log)} changes")
            for entry in change_log[:5]:
                print(f"    - {entry}")
            if len(change_log) > 5:
                print(f"    ... and {len(change_log) - 5} more")
            result_info["outcome"] = "changed"
        except Exception as e:
            print(f"  ERROR saving: {e}")
            result_info["log"].append(f"Save error: {e}")
            return result_info
    else:
        print(f"  LLM reported changes but none applied (no-op)")
        result_info["outcome"] = "no_changes"

    return result_info


# =============================================================================
# FILE COLLECTION
# =============================================================================

def collect_files(category: str = "all", file_path: str = None) -> List[Path]:
    """Collect files to process."""
    if file_path:
        p = Path(file_path)
        return [p] if p.exists() else []

    files = []
    paths_to_scan = []

    if category in ["Positions", "all"]:
        paths_to_scan.append(POSITIONS_PATH)
    if category in ["Transitions", "all"]:
        paths_to_scan.append(TRANSITIONS_PATH)
    if category in ["Submissions", "all"]:
        paths_to_scan.append(SUBMISSIONS_PATH)

    for base in paths_to_scan:
        for path in base.rglob("*.json"):
            if "TEMPLATE" not in path.name:
                files.append(path)

    return sorted(files)


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph LLM Proofreader — semantic audit of state machine edges",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/proofread_all_transitions.py --dry-run --file content/Positions/Mount.json
  python3 scripts/proofread_all_transitions.py --category Transitions --max-files 10
  python3 scripts/proofread_all_transitions.py --batch
""",
    )

    parser.add_argument("--file", "-f", type=str,
                        help="Single file to process")
    parser.add_argument("--category", "-c",
                        choices=["Positions", "Transitions", "Submissions", "all"],
                        default="all", help="Category to process (default: all)")
    parser.add_argument("--max-files", "-m", type=int, default=0,
                        help="Maximum files to process (0 = unlimited)")
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Show prompts without calling LLM")
    parser.add_argument("--batch", "-b", action="store_true",
                        help="No delay between files")
    parser.add_argument("--interval", "-i", type=int, default=60,
                        help="Seconds to wait between LLM calls (default: 60)")

    args = parser.parse_args()

    print(f"""
{'=' * 70}
BJJ Graph LLM Proofreader
{'=' * 70}
Model:    {CLAUDE_MODEL}
Mode:     {'SINGLE FILE' if args.file else 'QUEUE'}
Category: {args.category}
Dry Run:  {args.dry_run}
Interval: {'none (batch)' if args.batch else f'{args.interval}s between calls'}
{'=' * 70}
""", flush=True)

    # Build reference lists
    print("Building reference lists...", flush=True)
    refs = build_reference_lists()
    print(f"  Positions:   {len(refs['positions'])}")
    print(f"  Transitions: {len(refs['transitions'])}")
    print(f"  Submissions: {len(refs['submissions'])}")
    print()

    # Collect files
    files = collect_files(args.category, args.file)
    if not files:
        print("No files to process!")
        return 0

    if args.max_files > 0:
        files = files[:args.max_files]

    # Stats
    stats = {
        "processed": 0,
        "changed": 0,
        "no_changes": 0,
        "failed": 0,
        "dry_run": 0,
        "total_changes": 0,
        "all_suggested_new_files": [],
    }

    run_log: List[dict] = []

    # Ensure CSV header exists before the loop (incremental writes)
    if not args.dry_run:
        SUGGESTIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
        if not SUGGESTIONS_CSV.exists() or SUGGESTIONS_CSV.stat().st_size == 0:
            with open(SUGGESTIONS_CSV, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(["triggered_by", "category", "suggested_name", "reason"])

    # Sequential processing with tqdm progress bar
    pbar = tqdm(files, desc="Proofreading", unit="file",
                bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]")

    for fp in pbar:
        pbar.set_postfix_str(fp.stem, refresh=True)

        result = process_file(fp, refs, args.dry_run)
        run_log.append({"file": str(fp), **result})
        stats["processed"] += 1

        outcome = result["outcome"]
        if outcome == "changed":
            stats["changed"] += 1
            stats["total_changes"] += result["changes_count"]
        elif outcome in ("no_changes", "skipped"):
            stats["no_changes"] += 1
        elif outcome == "dry_run":
            stats["dry_run"] += 1
        else:
            stats["failed"] += 1

        if result["suggested_new_files"]:
            for sf in result["suggested_new_files"]:
                sf["triggered_by"] = str(fp)
            stats["all_suggested_new_files"].extend(result["suggested_new_files"])
            # Write suggestions incrementally so they survive Ctrl+C
            if not args.dry_run:
                with open(SUGGESTIONS_CSV, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    for sf in result["suggested_new_files"]:
                        writer.writerow([
                            sf.get("triggered_by", ""),
                            sf.get("category", ""),
                            sf.get("name", ""),
                            sf.get("reason", ""),
                        ])
                print(f"  >> {len(result['suggested_new_files'])} new file(s) suggested:", flush=True)
                for sf in result["suggested_new_files"]:
                    print(f"     [{sf.get('category', '?')}] {sf.get('name', '?')}", flush=True)

        # Wait between calls
        if fp != files[-1] and not args.dry_run and not args.batch:
            time.sleep(args.interval)

    pbar.close()

    # Summary
    print(f"""
{'=' * 70}
SUMMARY
{'=' * 70}
Processed:     {stats['processed']}
Changed:       {stats['changed']}
No changes:    {stats['no_changes']}
Failed:        {stats['failed']}
Dry run:       {stats['dry_run']}
Total changes: {stats['total_changes']}
""", flush=True)

    # Suggested new files summary (already written incrementally during the loop)
    if stats["all_suggested_new_files"]:
        print(f"Suggested new files: {SUGGESTIONS_CSV} ({len(stats['all_suggested_new_files'])} total)")
    else:
        print("No new files suggested.")
    print()

    # Save run log
    if stats["processed"] > 0 and not args.dry_run:
        LOGS_PATH.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = LOGS_PATH / f"run_{timestamp}.json"
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump({
                "started_at": datetime.now().isoformat(),
                "model": CLAUDE_MODEL,
                "stats": stats,
                "files": run_log,
            }, f, indent=2, ensure_ascii=False)
        print(f"Run log saved to: {log_path}")

    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
