#!/usr/bin/env python3
"""
BJJ Graph LLM Proofreader
===========================
Uses a BJJ black belt expert persona to semantically audit every file's
transitions, outcomes, and probabilities in the knowledge graph.

The LLM returns lightweight change reports (not full file replacements).
Changes are applied surgically: removals, additions, probability adjustments,
and normalization to 100%.

THIS SCRIPT MUTATES AND SAVES AUTHORED CONTENT — it is not the read-only audit its
name suggests, and the weekly proofread-bot workflow opens a PR from what it writes.
So it loads TWICE (see process_file): the RAW document is the write target, and a
`reduce_to_scalar(frame="nogi")` copy is rendered into the prompt. Loading reduced and
saving that is what de-forked the gi/no-gi corpus before v1.153.1: one list edit
collapsed every {gi,nogi} map in the file to its no-gi cell, and the damage was
invisible because the next `npm run migrate:ruleset` re-mirrored the survivor.
Every probability the model returns is therefore a NO-GI verdict — `_prob_write`
moves only the nogi cell, and a fork-preservation gate refuses the save on the first
collapsed map.

Its LIST edits are bounded the same way: `_list_add` / `_list_remove` read minItems,
maxItems and the declared item shape from the schema `scripts/validate_json.py` will
judge the file against, because the unbounded versions produced files the bot's own
validate step then reverted — 12 of 30 on the v1.154.1 re-run.

Gated by tests/proofread_fork_safety.test.mjs.

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

sys.path.insert(0, str(Path(__file__).resolve().parent))  # make the shared helper importable
from claude_infer import call_claude as _infer_call_claude
from _atomic_io import atomic_write_json
from _prob_norm import largest_remainder_round as _largest_remainder_round
from _ruleset import reduce_to_scalar, is_ruleset_map, as_map, RULESETS  # {gi,nogi} contract (calibration-v2)
from _model import model as _model_tier, effort as _model_effort  # single source of truth: models.env

try:
    from tqdm import tqdm
except ImportError:  # CI / minimal envs without tqdm
    # ── A DEGRADED PATH HAS TO CARRY THE WHOLE API ITS CALLER USES ────────────────────
    # This fell back to the bare iterable, which satisfies `for fp in pbar` and NOTHING
    # else: `main()` then calls `pbar.set_postfix_str(...)` on the first file and
    # `pbar.close()` at the end, and a list has neither. So the script died with
    # `AttributeError: 'list' object has no attribute 'set_postfix_str'` in exactly the
    # environment this branch was written for — ci-validate.yml installs jsonschema and
    # nothing else, so tqdm is absent there and present on every dev machine that has
    # ever run the proofreader. tests/proofread_fork_safety.test.mjs 104-108 were red on
    # dev for that reason alone, and green for everyone who ran them locally.
    #
    # Reproduce the CI environment without uninstalling anything:
    #   mkdir -p /tmp/no-tqdm && echo 'raise ImportError' > /tmp/no-tqdm/tqdm.py
    #   PYTHONPATH=/tmp/no-tqdm npm run test:units
    #
    # The shim mirrors the methods this script actually calls, by name and on purpose —
    # no catch-all __getattr__, because a typo'd bar method should still fail loudly
    # under the gate rather than silently no-op. Add a method here when a caller needs
    # one; do not make it magic.
    class tqdm:  # noqa: N801 — deliberately shadows the real class's name
        def __init__(self, iterable=None, *args, **kwargs):
            self._iterable = [] if iterable is None else iterable

        def __iter__(self):
            return iter(self._iterable)

        def __len__(self):
            return len(self._iterable)

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            self.close()
            return False

        def set_postfix_str(self, *args, **kwargs):
            """Display-only on a real bar; nothing to draw without one."""

        def update(self, *args, **kwargs):
            """Display-only."""

        def close(self):
            """Display-only."""

# =============================================================================
# CONSTANTS
# =============================================================================
CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
LOGS_PATH = Path("logs/proofread")
SUGGESTIONS_CSV = Path("tests/artifacts/suggested_new_files.csv")

CLAUDE_MODEL = _model_tier()
# Reasoning effort (low|medium|high|xhigh|max). Bulk audit is one call per file
# (~25h for the full corpus at xhigh); scope with --file/--category as needed.
CLAUDE_EFFORT = _model_effort()

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

# Test seam: a canned response file replaces the inference call, so the APPLY-AND-SAVE
# path (the half that mutates authored content) is drivable without a paid model call.
# Set by --stub-response; read by call_claude. tests/proofread_fork_safety.test.mjs is
# the only consumer — without it the fork-preservation gate below has no unit gate at all.
STUB_RESPONSE: Optional[str] = None


def call_claude(prompt: str, response_schema: dict, timeout: int = 900) -> Tuple[Optional[str], Optional[str]]:
    """Structured Claude inference via the shared helper (scripts/claude_infer.py):
    read-only tools (explore but never write), forced structured output, usage-limit backoff."""
    if STUB_RESPONSE is not None:
        return STUB_RESPONSE, None
    return _infer_call_claude(prompt, response_schema, CLAUDE_MODEL, CLAUDE_EFFORT, timeout=timeout)


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
    """Normalize probability values to sum to exactly 100, in place — PER RULESET FRAME.

    Uses the shared largest-remainder normalizer (scripts/_prob_norm.py) so this
    matches regenerate_content_json.py: negatives are clamped to 0, all items are
    rescaled proportionally to integers summing to exactly 100, and the all-zero
    case is distributed evenly.

    Forked data ({gi,nogi} maps, calibration-v2) sums to 100 in EACH frame
    independently (CLAUDE.md §7), so each frame is normalized on its own and a
    frame already at 100 is left byte-identical. Collapsing the pair to one
    scalar here would destroy the other frame's authored value — that is the
    de-fork this function used to perform via its callers' reduced load.

    On all-scalar (legacy, unforked) input the map branch never runs and the
    behavior is byte-identical to the pre-fork implementation.
    """
    if not items:
        return items

    if not any(is_ruleset_map(item.get(key)) for item in items if isinstance(item, dict)):
        vals = []
        for item in items:
            try:
                vals.append(float(item.get(key, 0)))
            except (TypeError, ValueError):
                vals.append(0.0)

        if round(sum(max(0.0, v) for v in vals)) == 100:
            return items

        for item, nv in zip(items, _largest_remainder_round(vals, 100)):
            item[key] = nv
        return items

    # Forked: one independent normalization per frame. A null cell means "this
    # edge does not exist in that ruleset" and is NEVER filled in here — it is
    # skipped and left null, so normalizing cannot resurrect an excluded edge.
    maps = [as_map(item.get(key)) for item in items]
    for rs in RULESETS:
        idx = [i for i, m in enumerate(maps) if isinstance(m.get(rs), (int, float))]
        if not idx:
            continue
        vals = [float(maps[i][rs]) for i in idx]
        if round(sum(max(0.0, v) for v in vals)) == 100:
            continue
        for i, nv in zip(idx, _largest_remainder_round(vals, 100)):
            maps[i][rs] = nv
    for item, m in zip(items, maps):
        item[key] = m
    return items


# ---------------------------------------------------------------------------
# FORK-SAFE PROBABILITY WRITES
#
# The LLM audits the NO-GI headline frame — that is the frame process_file
# renders into the prompt — so every number it returns is a no-gi verdict about
# a no-gi reading. It says nothing about gi, and these two helpers are the only
# sanctioned way to put one of its numbers back into an authored document.
# ---------------------------------------------------------------------------

def _prob_write(authored: Any, suggested: Any) -> Any:
    """One audited probability written back onto its AUTHORED cell.

    - authored is a {gi,nogi} map -> only the nogi cell moves; gi stays as authored,
    - authored is a bare scalar   -> plain assignment (legacy / unforked data),
    - authored's nogi cell is null (edge absent in no-gi) -> UNCHANGED. Filling it
      would silently resurrect an edge the data says does not exist in that frame,
      off a model that was shown ``null`` and answered with a number anyway.

    Returns ``(new_value, skipped_reason_or_None)``.
    """
    if not is_ruleset_map(authored):
        return suggested, None
    m = as_map(authored)
    if m.get("nogi") is None:
        return authored, "no-gi frame is null (edge absent in no-gi) — suggestion ignored"
    m["nogi"] = suggested
    return m, None


def _prob_new(forked: bool, suggested: Any) -> Any:
    """The probability cell for a NEWLY ADDED row.

    In a forked document the value is MIRRORED into both frames. The model judged
    only no-gi, so neither frame is a claim it made; mirroring is the corpus's own
    pre-divergence default (scripts/migrate_dual_ruleset.py mapify) and is the
    conservative choice. The alternative — ``{"gi": null, ...}`` — would assert the
    move is ILLEGAL in gi, which is a much stronger claim than the audit supports.
    """
    return {rs: suggested for rs in RULESETS} if forked else suggested


def _doc_is_forked(data: Any) -> bool:
    """True iff the document carries at least one {gi,nogi} probability map."""
    if is_ruleset_map(data):
        return True
    if isinstance(data, dict):
        return any(_doc_is_forked(v) for v in data.values())
    if isinstance(data, list):
        return any(_doc_is_forked(v) for v in data)
    return False


# ---------------------------------------------------------------------------
# SCHEMA-BOUNDED LIST EDITS
#
# The audit's list edits are applied blind: it removes `from_positions` entries
# until the list is shorter than the schema's minItems, and appends a bare string
# to `related_submissions` even on a FAMILY hub, where the schema wants
# {name, relationship} objects. Both produce a file the bot's own validate step
# then REVERTS — measured on the v1.154.1 Submissions re-run, 12 of 30 files were
# discarded that way (9 to the floor, 3 to the object form), the same 18/30
# survival rate as the run before it. A ~70-minute xhigh pass throwing away 40%
# of its own output is the failure this section exists to stop.
#
# The bounds are read from the SAME schema `scripts/validate_json.py` will judge
# the file against — imported, never a second copy of the selection rules, which
# is the two-places-one-answer trap (CLAUDE.md 6.5).
# ---------------------------------------------------------------------------

def schema_for(file_path: Path, category: str) -> Optional[dict]:
    """The schema the validator will use for this file, or None if it cannot be resolved."""
    try:
        from validate_json import load_schema  # same seam the bot's validate step uses
        return load_schema(category, str(file_path))
    except BaseException as e:  # SystemExit included: load_schema exits on a missing template
        print(f"  WARNING: no schema bounds for {file_path} ({e!r}) — list edits unbounded")
        return None


def _bounds(schema: Optional[dict], field: str) -> Tuple[int, Optional[int], Optional[str]]:
    """``(minItems, maxItems, item type)`` for one array field. Permissive when unknown."""
    if not schema:
        return 0, None, None
    prop = (schema.get("properties") or {}).get(field) or {}
    return int(prop.get("minItems") or 0), prop.get("maxItems"), (prop.get("items") or {}).get("type")


def _entry_name(entry: Any) -> Any:
    """The name of a list entry, whether it is a bare string or a {name, ...} object."""
    return entry.get("name") if isinstance(entry, dict) else entry


def _list_add(items: List[Any], name: str, reason: str, schema: Optional[dict],
              field: str, log: List[str], label: str) -> bool:
    """Append ``name`` to a list field, in the SHAPE and within the BOUNDS its schema declares."""
    lo, hi, item_type = _bounds(schema, field)
    if any(_entry_name(e) == name for e in items):
        return False
    if hi is not None and len(items) >= hi:
        print(f"    SKIP add {label} '{name}': {field} is at its schema ceiling ({hi})")
        return False
    items.append({"name": name, "relationship": reason} if item_type == "object" else name)
    log.append(f"Added {label}: {name}: {reason}")
    return True


def _list_remove(items: List[Any], name: str, reason: str, schema: Optional[dict],
                 field: str, log: List[str], label: str) -> bool:
    """Remove ``name`` unless that would take the list below its schema floor."""
    lo, _, _ = _bounds(schema, field)
    idx = next((i for i, e in enumerate(items) if _entry_name(e) == name), None)
    if idx is None:
        return False
    if len(items) <= lo:
        print(f"    SKIP remove {label} '{name}': {field} is at its schema floor ({lo})")
        return False
    items.pop(idx)
    log.append(f"Removed {label}: {name}: {reason}")
    return True


def _ruleset_cells(obj: Any, path: str = "") -> Dict[str, dict]:
    """Every {gi,nogi} map in a document, keyed by its structural path.

    The fork-preservation guard compares this before and after the audit: a path
    that was a map and is no longer one is a de-fork, and the write is refused.
    """
    if is_ruleset_map(obj):
        return {path: obj}
    out: Dict[str, dict] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(_ruleset_cells(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(_ruleset_cells(v, f"{path}[{i}]"))
    return out


def apply_position_changes(data: dict, changes: dict) -> Tuple[dict, List[str]]:
    """Apply position audit changes and return modified data + change log.

    ``data`` is the RAW authored document ({gi,nogi} maps intact) — see process_file.
    """
    log = []
    forked = _doc_is_forked(data)

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
                transitions.append({"transition": name, "attempt_probability": _prob_new(forked, prob)})
                log.append(f"Added {role}/{name} ({prob}%): {item.get('reason', '')}")

        # Probability adjustments
        adjustments = changes.get(f"{prefix}_probability_adjustments", [])
        for adj in adjustments:
            name = adj.get("transition", "")
            suggested = adj.get("suggested", 0)
            for t in transitions:
                if t.get("transition") == name:
                    old = t.get("attempt_probability", 0)
                    new, skipped = _prob_write(old, suggested)
                    if skipped:
                        print(f"    SKIP {role}/{name}: {skipped}")
                        break
                    t["attempt_probability"] = new
                    log.append(f"Adjusted {role}/{name}: {old} -> {new}: {adj.get('reason', '')}")
                    break

        # Normalize
        transitions = normalize_probabilities(transitions, "attempt_probability")
        data[role]["transitions"] = transitions

    return data, log


def apply_transition_changes(data: dict, changes: dict,
                             schema: Optional[dict] = None) -> Tuple[dict, List[str]]:
    """Apply transition audit changes and return modified data + change log.

    ``data`` is the RAW authored document ({gi,nogi} maps intact) — see process_file.
    ``schema`` bounds the outcome list the same way it bounds a submission's lists.
    """
    log = []
    forked = _doc_is_forked(data)
    out_lo, out_hi, _ = _bounds(schema, "outcomes")

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
        if not any(o.get("to") == to_val for o in outcomes):
            continue
        if len(outcomes) <= out_lo:
            print(f"    SKIP remove outcome -> {to_val}: outcomes is at its schema floor ({out_lo})")
            continue
        outcomes = [o for o in outcomes if o.get("to") != to_val]
        log.append(f"Removed outcome -> {to_val}: {item.get('reason', '')}")

    # Additions
    for item in changes.get("outcomes_to_add", []):
        to_val = item.get("to", "")
        if out_hi is not None and len(outcomes) >= out_hi:
            print(f"    SKIP add outcome -> {to_val}: outcomes is at its schema ceiling ({out_hi})")
        elif not any(o.get("to") == to_val for o in outcomes):
            outcomes.append({
                "to": to_val,
                "probability": _prob_new(forked, item.get("probability", 10)),
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
                new, skipped = _prob_write(old, suggested)
                if skipped:
                    print(f"    SKIP outcome -> {to_val}: {skipped}")
                    break
                o["probability"] = new
                log.append(f"Adjusted outcome -> {to_val}: {old} -> {new}: {adj.get('reason', '')}")
                break

    # Normalize
    outcomes = normalize_probabilities(outcomes, "probability")
    data["outcomes"] = outcomes

    return data, log


def apply_submission_changes(data: dict, changes: dict,
                             schema: Optional[dict] = None) -> Tuple[dict, List[str]]:
    """Apply submission audit changes and return modified data + change log.

    ``data`` is the RAW authored document ({gi,nogi} maps intact) — see process_file.
    ``schema`` is the validator's own schema for this file; list edits stay inside its
    minItems/maxItems and match its declared item shape. None = unbounded (and warned).
    """
    log = []

    # starting_position fix
    sp_fix = changes.get("starting_position_fix")
    if sp_fix and isinstance(sp_fix, dict) and sp_fix.get("suggested"):
        old = data.get("starting_position", "")
        data["starting_position"] = sp_fix["suggested"]
        log.append(f"Fixed starting_position: '{old}' -> '{sp_fix['suggested']}': {sp_fix.get('reason', '')}")

    # from_positions / related_submissions removals + additions, bounded by the schema
    # the validator will judge this file against (see _list_add / _list_remove).
    for field, add_key, rm_key, id_key, label in (
        ("from_positions", "from_positions_to_add", "from_positions_to_remove",
         "position", "from_position"),
        ("related_submissions", "related_submissions_to_add", "related_submissions_to_remove",
         "name", "related_submission"),
    ):
        items = data.get(field, [])
        for item in changes.get(rm_key, []):
            _list_remove(items, item.get(id_key, ""), item.get("reason", ""), schema, field, log, label)
        for item in changes.get(add_key, []):
            _list_add(items, item.get(id_key, ""), item.get("reason", ""), schema, field, log, label)
        data[field] = items

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

    # Load the file TWICE, for two different jobs. This audit MUTATES AND SAVES,
    # so the document it edits must be the RAW one: a reduced doc written back
    # collapses every {gi,nogi} map in the file to one frame and destroys the
    # other frame's authored value — including cells the audit never decided.
    # (Before v1.153.1 this function loaded reduced and saved that, so one list
    # edit de-forked an entire file. Same two-loader split as
    # scripts/explode_graph_connections.py.)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)                                  # WRITE TARGET: maps intact
        view = reduce_to_scalar(data, frame="nogi")               # PROMPT ONLY: no-gi headline frame
    except Exception as e:
        print(f"  ERROR: Could not load {file_path}: {e}")
        return result_info

    authored_cells = _ruleset_cells(data)  # fork-preservation baseline (checked before the save)

    category = detect_category(file_path)
    if category == "Unknown":
        print(f"  SKIP: Unknown category for {file_path}")
        result_info["outcome"] = "skipped"
        return result_info

    # Build prompt
    if category == "Positions":
        prompt = build_position_prompt(view, refs)
    elif category == "Transitions":
        prompt = build_transition_prompt(view, refs)
    else:
        prompt = build_submission_prompt(view, refs)

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
    schema = schema_for(file_path, category)  # bounds every list edit below
    if category == "Positions":
        data, change_log = apply_position_changes(data, changes)
    elif category == "Transitions":
        data, change_log = apply_transition_changes(data, changes, schema)
    else:
        data, change_log = apply_submission_changes(data, changes, schema)

    result_info["changes_count"] = len(change_log)
    result_info["log"] = change_log
    result_info["suggested_new_files"] = parsed.get("suggested_new_files", [])

    if change_log:
        # FORK-PRESERVATION GATE. Emits a POSITIVE coverage count and refuses the
        # write on the first collapsed cell (CLAUDE.md §6.6: never let "found no
        # problems" and "never looked" produce the same output). A de-fork is
        # otherwise INVISIBLE — the next `npm run migrate:ruleset` re-mirrors the
        # surviving scalar into {gi,nogi}, so the lost frame leaves no trace.
        after_cells = _ruleset_cells(data)
        collapsed = sorted(set(authored_cells) - set(after_cells))
        if collapsed:
            msg = (f"REFUSED to save {file_path}: {len(collapsed)} of "
                   f"{len(authored_cells)} ruleset maps were de-forked, e.g. "
                   f"{collapsed[0]} {authored_cells[collapsed[0]]!r}")
            print(f"  ERROR: {msg}")
            result_info["log"].append(msg)
            return result_info
        print(f"  Ruleset maps preserved: {len(after_cells)}/{len(authored_cells)}")

        # Save modified file
        try:
            atomic_write_json(file_path, data, indent=2, ensure_ascii=False)
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
    parser.add_argument("--stub-response", type=str, default=None,
                        help="TEST ONLY: file holding a canned LLM response; skips inference "
                             "so the apply-and-save path can be gated without a paid call")

    args = parser.parse_args()

    if args.stub_response:
        global STUB_RESPONSE
        STUB_RESPONSE = Path(args.stub_response).read_text(encoding="utf-8")
        print(f"STUB MODE: canned response from {args.stub_response} (no inference)")

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
