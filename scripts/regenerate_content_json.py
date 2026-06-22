#!/usr/bin/env python3
"""
BJJ Graph Unified Content Fixer
===============================
Consolidates regenerate_content_json.py, fix_content_queue.py, and fix_content_phase2.py into one.

Features:
- Single-file mode (--file) or queue mode (--interval)
- Template detection (SINGLE/DUAL/FAMILY for positions)
- Validation loop with correction retries
- Domain-specific prompts (RETENTION/EXECUTION/FINISHING)
- Reference list building for wikilink validation
- Stub creation for missing transitions
- Uses Opus 4.6 for all Claude calls

Usage:
    python3 scripts/regenerate_content_json.py --file "content/Positions/Mount.json"
    python3 scripts/regenerate_content_json.py --interval 1200 --category Positions
    python3 scripts/regenerate_content_json.py --max-files 10 --dry-run
"""

import argparse
import copy
import json
import os
import subprocess
import sys
import time
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

# Ensure repo root is on sys.path for cross-script imports
_repo_root = str(Path(__file__).resolve().parent.parent)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from scripts.validate_json import validate_json_file as _validate_json_file, load_schema, detect_position_template_type, detect_transition_template_type
from scripts.claude_infer import call_claude as _infer_call_claude
from scripts.peak_throttle import is_peak as _is_peak, PACIFIC as _PEAK_PACIFIC
from scripts._atomic_io import atomic_write_json
from scripts._prob_norm import largest_remainder_round as _largest_remainder_round


def _is_peak_now() -> bool:
    """True iff we're in Anthropic's weekday 05:00-11:00 PT peak window (unless disabled)."""
    if os.environ.get("PEAK_THROTTLE_DISABLE") == "1" or _PEAK_PACIFIC is None:
        return False
    return _is_peak(datetime.now(_PEAK_PACIFIC))

# =============================================================================
# PATHS
# =============================================================================
CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
PRINCIPLES_PATH = CONTENT_PATH / "Principles"
SYSTEMS_PATH = CONTENT_PATH / "Systems"
LEARNING_PATH = CONTENT_PATH / "Learning"
TEMPLATES_PATH = Path("templates")
LOGS_PATH = Path("logs/regenerate_json")

# Model to use for all Claude calls.
# Opus 4.8 with the 1M-context variant ([1m] suffix) for the largest context window.
CLAUDE_MODEL = "claude-opus-4-8[1m]"
# Reasoning effort for content generation (low|medium|high|xhigh|max). Content
# regeneration is quality-critical and intermittent, so we run near the top.
CLAUDE_EFFORT = "xhigh"

# =============================================================================
# STATS (thread-safe)
# =============================================================================
_stats_lock = threading.Lock()
_print_lock = threading.Lock()
stats = {
    "processed": 0,
    "fixed": 0,
    "skipped": 0,
    "failed": 0,
    "stubs_created": 0,
    "retries": 0,
    "errors": []
}


def stats_inc(key, n=1):
    with _stats_lock:
        stats[key] += n


def stats_append_error(msg):
    with _stats_lock:
        stats["errors"].append(msg)


def tprint(*args, **kwargs):
    """Thread-safe print."""
    kwargs.setdefault("flush", True)
    with _print_lock:
        print(*args, **kwargs)

# =============================================================================
# TEMPLATE DETECTION (ported from bash)
# =============================================================================

def detect_position_template(file_path: Path) -> str:
    """
    Detect Position template type based on folder structure.
    - SINGLE: No variant folder exists
    - FAMILY: Variant folder exists with .json files
    - DUAL: Variant folder exists but only has .md files (Top.md, Bottom.md)
    """
    position_name = file_path.stem
    variant_folder = file_path.parent / position_name

    if not variant_folder.is_dir():
        return "SINGLE"
    elif list(variant_folder.glob("*.json")):
        return "FAMILY"
    else:
        return "DUAL"


def detect_category(file_path: Path) -> str:
    """Detect content category from file path."""
    path_str = str(file_path)
    if "Positions" in path_str:
        return "Positions"
    elif "Transitions" in path_str:
        return "Transitions"
    elif "Submissions" in path_str:
        return "Submissions"
    elif "Principles" in path_str:
        return "Principles"
    elif "Systems" in path_str:
        return "Systems"
    elif "Learning" in path_str:
        return "Learning"
    return "Unknown"


# =============================================================================
# REFERENCE LIST BUILDING (ported from bash)
# =============================================================================

def build_reference_lists() -> Dict[str, List[str]]:
    """Build lists of all valid content names by category."""
    refs = {
        "positions": [],
        "transitions": [],
        "submissions": [],
        "principles": [],
        "systems": []
    }

    def get_names(path: Path) -> List[str]:
        """Extract content names, using JSON name field for nested files."""
        names = []
        for f in path.rglob("*.json"):
            if "TEMPLATE" in f.name:
                continue
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                if 'name' in data:
                    names.append(data['name'])
                    continue
            except (json.JSONDecodeError, OSError):
                pass
            names.append(f.stem)
        return sorted(set(names))

    refs["positions"] = get_names(POSITIONS_PATH)
    refs["transitions"] = get_names(TRANSITIONS_PATH)
    refs["submissions"] = get_names(SUBMISSIONS_PATH)

    principles_path = CONTENT_PATH / "Principles"
    systems_path = CONTENT_PATH / "Systems"

    if principles_path.exists():
        refs["principles"] = get_names(principles_path)
    if systems_path.exists():
        refs["systems"] = get_names(systems_path)

    learning_path = CONTENT_PATH / "Learning"
    if learning_path.exists():
        refs["learning"] = get_names(learning_path)

    return refs


def get_related_context(file_path: Path, data: dict, max_files: int = 5) -> Tuple[List[Path], str]:
    """Get related files for context."""
    context_files = []
    descriptions = []

    category = detect_category(file_path)

    if category == "Positions":
        # Get transitions referenced in the file
        for role in ["top", "bottom"]:
            if role in data:
                for t in data[role].get("transitions", [])[:3]:
                    trans_name = t.get("transition")
                    if trans_name:
                        trans_path = find_file_by_name(trans_name, "Transitions")
                        if trans_path and trans_path not in context_files:
                            context_files.append(trans_path)
                            descriptions.append(f"Related transition: {trans_name}")
                            if len(context_files) >= max_files:
                                break
                if len(context_files) >= max_files:
                    break

    elif category == "Transitions":
        # Get source position
        from_pos = data.get("from_position", "")
        if "/" in from_pos:
            pos_name = from_pos.split("/")[0]
        else:
            pos_name = from_pos.replace(" Bottom", "").replace(" Top", "")

        pos_path = find_file_by_name(pos_name, "Positions")
        if pos_path:
            context_files.append(pos_path)
            descriptions.append(f"Source position: {pos_name}")

        # Get outcome positions
        for outcome in data.get("outcomes", [])[:3]:
            to_pos = outcome.get("to", "")
            if to_pos and to_pos != "game-over":
                if "/" in to_pos:
                    pos_name = to_pos.split("/")[0]
                else:
                    pos_name = to_pos
                pos_path = find_file_by_name(pos_name, "Positions")
                if pos_path and pos_path not in context_files:
                    context_files.append(pos_path)
                    descriptions.append(f"Target position: {pos_name}")

    elif category == "Submissions":
        # Get from_positions
        for pos_name in data.get("from_positions", [])[:3]:
            pos_path = find_file_by_name(pos_name, "Positions")
            if pos_path and pos_path not in context_files:
                context_files.append(pos_path)
                descriptions.append(f"Source position: {pos_name}")

    return context_files[:max_files], "\n".join(descriptions) if descriptions else "No related files found"


def find_file_by_name(name: str, category: str) -> Optional[Path]:
    """Find a file by name in a category."""
    base_path = CONTENT_PATH / category

    # Direct match
    direct = base_path / f"{name}.json"
    if direct.exists():
        return direct

    # Search in subfolders
    for f in base_path.rglob(f"{name}.json"):
        return f

    return None


# =============================================================================
# VALIDATION
# =============================================================================

def run_validation(file_path: Path) -> Tuple[bool, bool, list, list]:
    """Run validation on a single file using direct import.

    Returns:
        (is_valid, has_blocking, blocking_errors, non_blocking_errors)
    """
    try:
        # Detect category from path
        category = detect_category(file_path)
        if category == "Unknown":
            return False, True, [f"Unknown category for {file_path}"], []

        schema = load_schema(category, file_path)
        errors, warnings, categories = _validate_json_file(file_path, schema, category)

        is_valid = len(errors) == 0
        blocking = categories.get("blocking", [])
        non_blocking = categories.get("non_blocking", [])
        # Include warnings in non_blocking for completeness
        non_blocking_set = set(non_blocking)
        for w in warnings:
            if w not in non_blocking_set:
                non_blocking.append(w)
        has_blocking = len(blocking) > 0
        return is_valid, has_blocking, blocking, non_blocking
    except Exception as e:
        return False, True, [f"Validation failed: {e}"], []


def has_todos(data: dict) -> bool:
    """Check if JSON contains TODO markers."""
    return "TODO" in json.dumps(data)


def needs_enrichment(data: dict, category: str) -> bool:
    """Check if file needs enrichment beyond validation errors.

    NOTE: Does NOT check flashcards count. The schema is the source of truth —
    if it doesn't require the field, this heuristic shouldn't contradict it.
    Checking flashcards caused an infinite loop where 12 family Position files
    were re-selected every run (schema doesn't require flashcards, so Claude
    never generates it, so this function always returned True).
    """
    if has_todos(data):
        return True

    # Answer-first SEO: Principles/Systems must carry a one-sentence `summary`.
    # It is OPTIONAL in the schema (so validation never hard-fails), but its
    # absence is treated as "needs enrichment" so the regenerate pipeline
    # backfills it via Claude. Self-terminating: once `summary` is present this
    # returns False again, so the file is skipped on subsequent runs.
    if category in ("Principles", "Systems") and not str(data.get("summary", "")).strip():
        return True

    # Check for placeholder outcomes (Transitions/Submissions)
    outcomes = data.get("outcomes", [])
    for o in outcomes:
        if "Unknown" in o.get("to", "") or o.get("probability", 0) == 0:
            return True

    return False


# =============================================================================
# TEMPLATE LOADING
# =============================================================================

def get_template_content(category: str, template_type: str = None) -> str:
    """Load the appropriate template file content."""
    template_map = {
        "Positions": {
            "SINGLE": "templates/Positions/TEMPLATE-SINGLE.json",
            "DUAL": "templates/Positions/TEMPLATE-DUAL.json",
            "FAMILY": "templates/Positions/TEMPLATE-FAMILY.json",
        },
        "Transitions": {
            "SINGLE": "templates/Transitions.json",
            "DUAL": "templates/Transitions/TEMPLATE-DUAL.json",
        },
        "Submissions": {
            "SINGLE": "templates/Submissions.json",
            "DUAL": "templates/Submissions/TEMPLATE-DUAL.json",
            "FAMILY": "templates/Submissions/TEMPLATE-FAMILY.json",
        },
        "Principles": "templates/Principles.json",
        "Systems": "templates/Systems.json",
        "Learning": "templates/Learning.json",
    }

    if category == "Positions" and template_type:
        template_path = Path(template_map["Positions"].get(template_type, template_map["Positions"]["DUAL"]))
    elif category in ("Transitions", "Submissions"):
        # Prefer DUAL (attacker/defender) schema for new content
        t_type = template_type or "DUAL"
        template_path = Path(template_map[category].get(t_type, template_map[category]["DUAL"]))
    else:
        template_path = Path(template_map.get(category, template_map["Transitions"]["SINGLE"]))

    try:
        with open(template_path, 'r') as f:
            return f.read()
    except:
        return "Template not available"


def get_template_path(category: str, template_type: str = None) -> Path:
    """Get the path to a template schema file."""
    template_map = {
        "Positions": {
            "SINGLE": "templates/Positions/TEMPLATE-SINGLE.json",
            "DUAL": "templates/Positions/TEMPLATE-DUAL.json",
            "FAMILY": "templates/Positions/TEMPLATE-FAMILY.json",
        },
        "Transitions": {
            "SINGLE": "templates/Transitions.json",
            "DUAL": "templates/Transitions/TEMPLATE-DUAL.json",
        },
        "Submissions": {
            "SINGLE": "templates/Submissions.json",
            "DUAL": "templates/Submissions/TEMPLATE-DUAL.json",
            "FAMILY": "templates/Submissions/TEMPLATE-FAMILY.json",
        },
        "Principles": "templates/Principles.json",
        "Systems": "templates/Systems.json",
        "Learning": "templates/Learning.json",
    }

    if category == "Positions" and template_type:
        return Path(template_map["Positions"].get(template_type, template_map["Positions"]["DUAL"]))
    elif category in ("Transitions", "Submissions"):
        t_type = template_type or "DUAL"
        return Path(template_map[category].get(t_type, template_map[category]["DUAL"]))
    return Path(template_map.get(category, "templates/Transitions.json"))


def resolve_schema_refs(schema: dict) -> dict:
    """Recursively resolve $ref references within a JSON schema."""
    defs = schema.get("$defs", schema.get("definitions", {}))
    if not defs:
        return schema

    def _resolve(node):
        if isinstance(node, dict):
            if "$ref" in node:
                ref_path = node["$ref"]  # e.g. "#/$defs/role_schema"
                ref_name = ref_path.split("/")[-1]
                if ref_name in defs:
                    return _resolve(copy.deepcopy(defs[ref_name]))
                return node
            # Handle allOf with $ref (common in position_metrics)
            if "allOf" in node:
                merged = {}
                for item in node["allOf"]:
                    resolved_item = _resolve(item)
                    merged.update(resolved_item)
                # Preserve any keys outside allOf
                for k, v in node.items():
                    if k != "allOf":
                        merged[k] = _resolve(v)
                return merged
            return {k: _resolve(v) for k, v in node.items()}
        elif isinstance(node, list):
            return [_resolve(item) for item in node]
        return node

    resolved = _resolve(schema)
    resolved.pop("$defs", None)
    resolved.pop("definitions", None)
    return resolved


def build_response_schema(category: str, template_type: str = None) -> dict:
    """Build --json-schema using actual category template schema with resolved $refs."""
    schema_path = get_template_path(category, template_type)
    try:
        with open(schema_path, 'r') as f:
            category_schema = json.load(f)
        # Strip meta-fields Claude CLI won't understand
        for key in ("$schema", "$id", "title"):
            category_schema.pop(key, None)
        # Resolve $ref for Position DUAL/FAMILY/SINGLE
        category_schema = resolve_schema_refs(category_schema)
        # `products` is curated affiliate data — never authored by AI. Strip it from the
        # Systems response contract so the model literally cannot return or invent it.
        if category == "Systems" and isinstance(category_schema.get("properties"), dict):
            category_schema["properties"].pop("products", None)
            if isinstance(category_schema.get("required"), list):
                category_schema["required"] = [
                    r for r in category_schema["required"] if r != "products"
                ]
    except Exception:
        category_schema = {"type": "object", "required": ["name"],
                          "properties": {"name": {"type": "string"}}}

    return {
        "type": "object",
        "properties": {
            "fixed_content": category_schema,
            "created_stubs": {"type": "array", "items": {"type": "object"}},
            "changes_summary": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["fixed_content", "changes_summary"]
    }


# =============================================================================
# CATEGORY-SPECIFIC FIELD GUIDANCE (ported from bash)
# =============================================================================

def get_field_guidance(category: str, template_type: str, filename: str) -> str:
    """Get category-specific field guidance."""

    if category == "Positions":
        return f"""DETECTED TEMPLATE TYPE: {template_type}

REQUIRED NAME FIELDS:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- If {template_type} = DUAL or FAMILY:
  - Set bottom.name = '{filename} Bottom'
  - Set top.name = '{filename} Top'
- DO NOT include 'title' field (auto-generated from name in jinja)

VARIANT UNIQUENESS (required, 50 char max):
- Add variant_uniqueness field at root level
- Explain WHY this position's risk/energy differs strategically
- Example: 'Higher positioning trades stability for submission proximity'
- NOT just technical description, but strategic trade-off

TRANSITIONS FIELD (CRITICAL - unified state machine model):
- transitions[] is the ONLY transition field. No offensive_transitions, defensive_responses, or counter_transitions.
- Each entry: {{ "transition": "Technique Name", "attempt_probability": N }}
- attempt_probability values MUST sum to 100% per role (top/bottom)
- top.transitions = what the practitioner does from the top role
- bottom.transitions = what the practitioner does from the bottom role
- SINGLE positions: transitions[] at root level (no top/bottom)

REFERENCES:
- related_content[] -> Use any content type (5-12 most relevant)
- ALWAYS use specific child variants when available (e.g., 'Mount Top' not 'Mount')"""

    elif category == "Transitions":
        return f"""REQUIRED NAME FIELD:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES:
- from_position -> Use "Position/Role" format (e.g., "Mount/Top", "Closed Guard/Bottom")
- outcomes[].to -> Use Position names or "game-over" for submissions
- related_techniques[] -> Use Transition/Submission names (select 6-15 most relevant)"""

    elif category == "Submissions":
        return f"""REQUIRED NAME FIELD:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES (ALL REQUIRED for good SEO):
- from_positions[] -> Array of Position name strings (2-10 positions where you can apply this submission)
- related_submissions[] -> Array of Submission name strings (3-15 submissions that chain or relate)
- related_content[] -> Array of objects with name/relationship (3-12 items, any type)

SAFETY REQUIREMENTS:
- safety_considerations must be comprehensive (100+ chars)
- Include injury risks with severity
- Document tap signals and release protocol"""

    elif category == "Principles":
        return f"""REQUIRED NAME FIELD:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES:
- application_contexts[].context -> Position or scenario names where principle applies
- principle_relationships[].principle_name -> Other Principle names (MUST exist in valid references)
- related_content[] -> Array of objects with name/content_type/relationship (3-15 items, any type)

KEY FIELDS:
- summary: ONE self-contained definition sentence (~15-40 words, "A {filename} is..." / "{filename} are...") that leads the page for AI answer engines / featured snippets. The overview must NOT duplicate it.
- overview: 2-3 paragraphs, 400+ characters
- key_principles: 6-9 fundamental principles
- component_skills: 5-8 discrete sub-skills with 50+ char descriptions
- decision_framework: 6-8 steps for applying the principle
- developmental_metrics: Exactly 4 levels (Beginner/Intermediate/Advanced/Expert)"""

    elif category == "Systems":
        return f"""REQUIRED NAME FIELD:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

REFERENCES:
- related_content[] -> Array of objects with name/content_type/relationship (10-30 items for comprehensive SEO)

KEY FIELDS:
- summary: ONE self-contained definition sentence (~15-40 words, "The {filename} is...") that leads the page for AI answer engines / featured snippets. The overview must NOT duplicate it.
- overview: 2-3 paragraphs, 400+ characters
- key_principles: 5-8 core principles
- key_components: 4+ main elements with 50+ char descriptions
- implementation_sequence: 5+ step-by-step implementation phases
- training_methodology.drilling_approach: 200+ characters
- training_methodology.progression_path: 4+ stages of mastery"""

    elif category == "Learning":
        return f"""REQUIRED NAME FIELD:
- Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)
- DO NOT include 'title' field (auto-generated from name)

CATEGORY FIELD:
- category: Must be one of "Strategy", "Training", or "Competition"

REFERENCES:
- related_content[] -> Array of objects with name/content_type/relationship (3-15 items)
- content_type must be one of: Position, Transition, Submission, Principle, System, Learning
- references[] -> Optional array of external citations with title/author/url

KEY FIELDS:
- overview: 2-3 paragraphs, 400+ characters, BJJ-specific (not generic self-help)
- key_takeaways: 5-8 actionable bullet points specific to BJJ
- bjj_applications: 3-6 items with scenario/application/outcome (concrete mat situations)
- common_mistakes: 3-5 items with mistake/consequence/correction
- training_exercises: 2-4 items with name/description (50+ chars)/focus
- flashcards: 4-6 Q&A pairs for self-assessment"""

    return f"Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)"


# =============================================================================
# COMMON PROMPT SECTIONS
# =============================================================================

REFERENCE_FORMAT_RULES = """
REFERENCE FORMAT (CRITICAL - Hub-and-Spoke Architecture):
- These rules govern REFERENCES TO OTHER ENTITIES (related_content[], related_submissions[],
  transition targets, etc.) ONLY. They DO NOT apply to this entity's own top-level `name`,
  which must stay verbatim (see REQUIREMENTS).
- Use ONLY the base filename (no paths, no extensions): 'Inside Ashi-Garami', 'Deep Half Guard'
- NEVER use Category/Name format: 'Positions/Inside Ashi-Garami' ❌
- NEVER use folder paths with slashes ❌
- NEVER use parent folder prefixes ❌
- For nested files in subfolders, use ONLY the final filename part
- The validator resolves categories and nested paths automatically
- Wikilinks are flat: [[Inside Ashi-Garami]] not nested paths

EXAMPLES:
✓ CORRECT: {"name": "Inside Ashi-Garami", "content_type": "Position"}
✓ CORRECT: {"name": "Deep Half Guard", "content_type": "Position"}
✓ CORRECT: {"name": "Honey Hole", "content_type": "Position"}
✗ WRONG: {"name": "Ashi Garami/Inside Ashi-Garami", "content_type": "Position"}
✗ WRONG: {"name": "Half Guard/Deep Half Guard", "content_type": "Position"}
✗ WRONG: {"name": "Positions/Ashi Garami/Honey Hole", "content_type": "Position"}
"""

EXPERT_GUIDELINES = """
EXPERT GUIDELINES:
1. John Danaher Perspective: Emphasize systematic technical precision, biomechanical analysis, and theoretical frameworks
2. Gordon Ryan Perspective: Focus on high-percentage techniques, competition-proven methods, and winning strategies
3. Eddie Bravo Perspective: Include innovative variations, 10th Planet methodology, and creative applications

CRITICAL DESCRIPTION RULES:
- Write descriptions in your own expert voice
- DO NOT mention "Expert insights from Danaher, Ryan, and Bravo" or similar phrases
- DO NOT reference specific instructors in the description field
- Focus on the technique/position itself, not who teaches it
- Keep descriptions concise and focused on what users will learn
"""

REQUIREMENTS_SECTION = """
REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanations)
- Fix ALL validation errors listed above
- Fill all TODO values with realistic, expert-level content
- Fix all broken references using ONLY flat names from the valid reference lists above
- For Position references: ALWAYS use specific child variant names when available (e.g., 'Mount Top' not 'Mount')
- Match the TEMPLATE structure exactly
- Author a root-level `summary`: ONE self-contained sentence (~15-40 words) that directly DEFINES this entity (answer-first — AI answer engines quote the first sentence). It must read standalone and be distinct from `overview`, which must NOT repeat it.
- PRESERVE the existing graph structure: never drop or rename `transitions[]` entries (positions), and never change `from_position` or drop `outcomes[].to` targets (transitions/submissions). Probabilities may be retuned (sum=100), but graph edges must not be removed.
- NEVER change this entity's own top-level `name`. For a nested submission variant (file lives in a `<Family>/` subfolder), `name` MUST stay the FULL `"<Family> from <Position>"` form (e.g. "Americana from Mount") — do NOT shorten it to the filename (e.g. "from Mount"). The graph keys submissions by this `name`; shortening it collides every family's same-position variant onto one node and breaks aggregation and edges.
- All content must be technically accurate and reflect BJJ best practices
- Safety sections must be comprehensive (especially for submissions)
"""


# =============================================================================
# DOMAIN-SPECIFIC PROMPTS
# =============================================================================

POSITION_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## Position: {file_path}
## Template Type: {template_type}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Preserve transitions; review attempt_probability
- PRESERVE every existing entry in `transitions[]`. Dropping one RE-ORPHANS a submission and is NOT allowed — keep all original transition names for both roles.
- You MAY re-tune `attempt_probability` to reflect realistic training choices, but every original transition must remain and the values MUST sum to exactly 100% per role (top/bottom).
- Do NOT invent transitions that lack a content file; only adjust probabilities across the existing set.

### 3. Add/Improve flashcards (8-12 Q&A pairs)
**Focus: RETENTION (maintaining this stable position)**

**Mix of question types (50/50):**
- SCENARIO: "Your opponent starts to bridge - what adjustment do you make?"
- RECALL: "What are the essential grips for maintaining this position?"

**Required topics:**
1. Weight distribution for maintaining position
2. Base fundamentals and common errors
3. Shutting down primary escape
4. Grip priorities
5. Pressure application
6. Anticipating movement (scenario-based)
7. Energy management
8. Recovery after partial escape

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

{reference_format_rules}

## Related Context Files:
{context_content}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "created_stubs": [{{ "name": "...", "from_position": "...", "content": {{...}} }}],
  "changes_summary": ["Description of change 1", "Description of change 2"]
}}
```
'''

TRANSITION_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## Transition: {file_path}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Review outcomes Array
Each transition has probabilistic outcomes:
- `success`: Technique works, reach target position
- `failure`: Technique fails, stay in place or regress
- `counter`: Opponent counters, you end up worse

Probabilities MUST sum to 100%.

### 2b. State Machine Modeling Rules (CRITICAL)
Transitions model THREE types of technique attempts. Classify this transition correctly:

**Type A - Direct Submissions** (outcome includes "game-over"):
- No distinct control position before the finish. Squeeze/lock and opponent taps.
- Example: "Americana from Mount" → game-over (55%), Mount (30%), Half Guard (15%)
- Applies to: Americana, Ezekiel, Cross Collar Choke, Wristlock from specific positions

**Type B - Submission Setups** (outcome leads to a Control position, NOT game-over):
- There IS a distinct control position where danger escalates before the finish.
- Example: "Armbar from Mount" → Armbar Control (55%), Mount (30%), Closed Guard (15%)
- The FINISH transition (e.g., "Armbar Finish") is separate and leads to game-over.
- Applies to: Armbar setup, Triangle setup, Omoplata setup, RNC setup, Bow and Arrow setup

**Type C - Positional Control Tools** (outcome leads to better position, NEVER game-over):
- A grip or entanglement that forces transitions but doesn't directly threaten submission.
- Example: "Kimura Trap from Bottom" → Kimura Trap (60%), Mount/Bottom (25%), Half Guard (15%)
- Applies to: Kimura Trap, Lockdown, Overhook Control, Guard retention grips

**RULES:**
- `from_position` MUST use "Position/Role" format: "Mount/Top", "Closed Guard/Bottom"
- Position-dependent techniques MUST include starting position in name: "Americana from Mount", NOT just "Americana"
- `outcomes[].to` MUST reference existing Position names (from the valid references list) or "game-over"
- Only Type A transitions may have "game-over" in outcomes

### 3. Add/Improve flashcards (8-12 Q&A pairs)
**Focus: EXECUTION (performing the motion)**

**Mix of question types (50/50):**
- SCENARIO: "Your opponent posts their hand - how do you adjust?"
- RECALL: "What is the most critical hip movement in this technique?"

**Required topics:**
1. Optimal timing window
2. Entry requirements (conditions that must exist)
3. Critical mechanical detail
4. Common failure points
5. Grip requirements
6. Direction of force
7. Opponent's likely defense (scenario)
8. Chain attacks if blocked

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

{reference_format_rules}

## Related Context Files:
{context_content}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "changes_summary": ["Change 1", "Change 2"]
}}
```
'''

SUBMISSION_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## Submission: {file_path}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Review outcomes Array
Submissions MUST have:
- One outcome to "game-over" (success - opponent taps)
- At least one other outcome (escape/counter)

Probabilities MUST sum to 100%.

### 3. Add/Improve flashcards (8-12 Q&A pairs)
**Focus: FINISHING (mechanics that cause the tap)**

**Mix of question types (50/50):**
- SCENARIO: "Your opponent starts to posture up - what adjustment prevents escape?"
- RECALL: "What anatomical structure does this submission attack?"

**Required topics:**
1. Anatomical target
2. Breaking point indicators
3. Control requirements before finish
4. Point of no escape
5. Common finishing errors
6. Grip adjustments during finish
7. Safety/injury awareness
8. Competition finishing strategies

### 4. Verify Safety Section
Ensure safety_considerations covers:
- Injury risks with severity
- Tap signals
- Release protocol
- Training restrictions

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

{reference_format_rules}

## Related Context Files:
{context_content}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "safety_notes": ["Any additional safety considerations"],
  "changes_summary": ["Change 1", "Change 2"]
}}
```
'''


PRINCIPLES_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## Principle: {file_path}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Ensure Cross-Position Application
- application_contexts[] should reference real positions from the valid references list
- principle_relationships[].principle_name MUST reference existing Principles

### 3. Review Content Quality
- overview must be 400+ characters with substantive BJJ analysis
- component_skills descriptions must be 50+ characters each
- decision_framework should have 6-8 actionable steps
- developmental_metrics must have exactly 4 levels with 3+ observable behaviors each

### 4. Author the Answer-First `summary` (REQUIRED for AI/LLM SEO)
- Add a `summary` field: ONE self-contained sentence (~15-40 words) that directly DEFINES the principle, e.g. "A wedge is any body part inserted into a gap to pry space open, redirect force, or block an opponent's movement."
- It must read as a standalone definition an AI answer engine can quote verbatim — lead with "A {filename} is..." or "{filename} are...".
- The `overview` must NOT repeat the summary sentence; start the overview with broader context/history instead.

### 5. Author flashcards (6-12 Q&A pairs — REQUIRED for the training deck)
- Add a `flashcards` array of 6-12 {{question, answer}} pairs covering recognition, application, key mechanics, and common errors of this principle.
- Each `answer` must be 50+ characters and self-contained; each `question` ends with "?".

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

**Principles ({principles_count} available):**
{principles_list}

**Systems ({systems_count} available):**
{systems_list}

{reference_format_rules}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "changes_summary": ["Change 1", "Change 2"]
}}
```
'''

SYSTEMS_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## System: {file_path}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Ensure System Completeness
- key_components[] should reference real techniques and positions
- implementation_sequence should be logical and progressive
- related_content[] should have 10-30 items for comprehensive SEO
- DO NOT add, remove, or modify the `products` field — it is curated affiliate data managed by hand and must be omitted from your output entirely (it is re-merged automatically)

### 3. Review Content Quality
- overview must be 400+ characters with substantive BJJ analysis
- key_components descriptions must be 50+ characters each
- training_methodology.drilling_approach must be 200+ characters
- training_methodology.progression_path must have 4+ stages

### 4. Author the Answer-First `summary` (REQUIRED for AI/LLM SEO)
- Add a `summary` field: ONE self-contained sentence (~15-40 words) that directly DEFINES the system, e.g. "The Kimura Trap System is a control-and-submission framework that uses the figure-four grip to chain back takes, sweeps, and kimura finishes."
- It must read as a standalone definition an AI answer engine can quote verbatim — lead with "The {filename} is...".
- The `overview` must NOT repeat the summary sentence; start the overview with broader context/history instead.

### 5. Author flashcards (6-12 Q&A pairs — REQUIRED for the training deck)
- Add a `flashcards` array of 6-12 {{question, answer}} pairs covering recognition, application, key mechanics, and common errors of this system.
- Each `answer` must be 50+ characters and self-contained; each `question` ends with "?".

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

**Principles ({principles_count} available):**
{principles_list}

**Systems ({systems_count} available):**
{systems_list}

{reference_format_rules}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "changes_summary": ["Change 1", "Change 2"]
}}
```
'''


LEARNING_PROMPT = '''You are an expert Brazilian Jiu-Jitsu black belt instructor creating content for purple/brown belt practitioners (4-5x/week serious hobbyists).

## Learning Article: {file_path}

## TEMPLATE STRUCTURE (follow this format exactly):
```json
{template_content}
```

## Current Content (fix TODOs and validation errors):
```json
{content}
```

## Validation Errors to Fix:
{validation_errors}

## FIELD GUIDANCE:
{field_guidance}

## Tasks:

### 1. Fix All Validation Errors
{error_guidance}

### 2. Ensure BJJ-Specific Application
- bjj_applications[] should reference real positions, transitions, and scenarios
- related_content[] names MUST reference existing content from the valid references
- Write original content — do NOT copy from external sources

### 3. Review Content Quality
- overview must be 400+ characters with substantive BJJ-specific analysis
- training_exercises descriptions must be 50+ characters each
- key_takeaways should be actionable, specific BJJ advice (not generic self-help)

## Valid References by Category (ONLY use names from these lists):

**Positions ({positions_count} available):**
{positions_list}

**Transitions ({transitions_count} available):**
{transitions_list}

**Submissions ({submissions_count} available):**
{submissions_list}

**Principles ({principles_count} available):**
{principles_list}

**Systems ({systems_count} available):**
{systems_list}

**Learning ({learning_count} available):**
{learning_list}

{reference_format_rules}

{expert_guidelines}

{requirements_section}

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
```json
{{
  "fixed_content": {{ ... the complete fixed JSON matching template structure ... }},
  "changes_summary": ["Change 1", "Change 2"]
}}
```
'''


def build_prompt(file_path: Path, data: dict, validation_errors: str, refs: Dict[str, List[str]]) -> str:
    """Build the appropriate prompt for a file."""
    category = detect_category(file_path)
    filename = file_path.stem

    # Get context
    context_files, context_desc = get_related_context(file_path, data)
    context_content = context_desc
    for cf in context_files:
        try:
            with open(cf, 'r') as f:
                ctx_data = f.read()
            context_content += f"\n\n### {cf.name}:\n```json\n{ctx_data}\n```"
        except:
            pass

    # Build reference strings (limit to avoid token explosion)
    positions_str = ", ".join(refs["positions"][:100])
    transitions_str = ", ".join(refs["transitions"][:100])
    submissions_str = ", ".join(refs["submissions"][:50])
    principles_str = ", ".join(refs["principles"][:50])
    systems_str = ", ".join(refs["systems"][:50])
    learning_str = ", ".join(refs.get("learning", [])[:50])

    # Error guidance based on validation output
    error_guidance = ""
    if "Broken link" in validation_errors:
        error_guidance += "- Fix broken wikilinks using ONLY names from the valid reference lists\n"
    if "sum to 100" in validation_errors:
        error_guidance += "- Fix probability values to sum to exactly 100%\n"
    if "Missing required" in validation_errors:
        error_guidance += "- Add all missing required fields\n"
    if not error_guidance:
        error_guidance = "- Fix any structural or content issues noted above"

    # Common parameters for all prompts
    common_params = {
        "file_path": str(file_path),
        "content": json.dumps(data, indent=2),
        "validation_errors": validation_errors or "None - file is valid but needs enrichment",
        "error_guidance": error_guidance,
        "filename": filename,
        "positions_list": positions_str,
        "transitions_list": transitions_str,
        "submissions_list": submissions_str,
        "principles_list": principles_str,
        "systems_list": systems_str,
        "learning_list": learning_str,
        "positions_count": len(refs["positions"]),
        "transitions_count": len(refs["transitions"]),
        "submissions_count": len(refs["submissions"]),
        "principles_count": len(refs["principles"]),
        "systems_count": len(refs["systems"]),
        "learning_count": len(refs.get("learning", [])),
        "context_content": context_content,
        "reference_format_rules": REFERENCE_FORMAT_RULES,
        "expert_guidelines": EXPERT_GUIDELINES,
        "requirements_section": REQUIREMENTS_SECTION,
    }

    # Select prompt template
    if category == "Positions":
        template_type = detect_position_template(file_path)
        common_params["template_type"] = template_type
        common_params["template_content"] = get_template_content("Positions", template_type)
        common_params["field_guidance"] = get_field_guidance("Positions", template_type, filename)
        return POSITION_PROMPT.format(**common_params)

    elif category == "Transitions":
        common_params["template_content"] = get_template_content("Transitions")
        common_params["field_guidance"] = get_field_guidance("Transitions", None, filename)
        return TRANSITION_PROMPT.format(**common_params)

    elif category == "Submissions":
        common_params["template_content"] = get_template_content("Submissions")
        common_params["field_guidance"] = get_field_guidance("Submissions", None, filename)
        return SUBMISSION_PROMPT.format(**common_params)

    elif category == "Principles":
        common_params["template_content"] = get_template_content("Principles")
        common_params["field_guidance"] = get_field_guidance("Principles", None, filename)
        return PRINCIPLES_PROMPT.format(**common_params)

    elif category == "Systems":
        common_params["template_content"] = get_template_content("Systems")
        common_params["field_guidance"] = get_field_guidance("Systems", None, filename)
        return SYSTEMS_PROMPT.format(**common_params)

    elif category == "Learning":
        common_params["template_content"] = get_template_content("Learning")
        common_params["field_guidance"] = get_field_guidance("Learning", None, filename)
        return LEARNING_PROMPT.format(**common_params)

    # Fallback to Transitions
    common_params["template_content"] = get_template_content("Transitions")
    common_params["field_guidance"] = get_field_guidance("Transitions", None, filename)
    return TRANSITION_PROMPT.format(**common_params)


# =============================================================================
# CLAUDE INTERACTION
# =============================================================================

def call_claude(prompt: str, response_schema: dict, timeout: int = 1800) -> Tuple[Optional[str], Optional[str]]:
    """Structured Claude inference via the shared helper (scripts/claude_infer.py):
    read-only tools (explore but never write), a forced structured-output contract, and
    usage-limit backoff. Returns (structured_json_str, None) or (None, error)."""
    return _infer_call_claude(prompt, response_schema, CLAUDE_MODEL, CLAUDE_EFFORT, timeout=timeout, log=tprint)


def extract_json_from_response(response: str) -> Tuple[Optional[dict], Optional[str]]:
    """Extract JSON from Claude's response."""
    # Try direct parse
    try:
        return json.loads(response), None
    except:
        pass

    # Try code block extraction
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\s\S]*?)\s*```',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, response)
        for match in matches:
            try:
                return json.loads(match), None
            except:
                continue

    # Try finding raw JSON object
    try:
        start = response.find('{')
        end = response.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end]), None
    except:
        pass

    return None, "Could not extract valid JSON from response"


# =============================================================================
# STUB CREATION
# =============================================================================

def transition_exists(name: str, from_position: str, refs: Dict[str, List[str]]) -> bool:
    """Check if a transition already exists (considering from_position uniqueness)."""
    # Check if exact name exists
    if name in refs["transitions"]:
        # Load the file to check from_position
        trans_path = find_file_by_name(name, "Transitions")
        if trans_path:
            try:
                with open(trans_path, 'r') as f:
                    existing_data = json.load(f)
                existing_from = existing_data.get("from_position", "")
                # Same name AND same from_position = duplicate
                if existing_from == from_position:
                    return True
            except:
                pass
    return False


def create_transition_stub(name: str, from_position: str, to_position: str = None) -> dict:
    """Create a minimal transition stub with attacker/defender structure."""
    failure_pos = from_position if '/' in from_position else f"{from_position}/Top"
    return {
        "name": name,
        "description": f"TODO: Add description for {name} - must be 140-180 characters for SEO meta description validation requirements here.",
        "tags": ["bjj", "technique", "TODO"],
        "from_position": from_position,
        "outcomes": [
            {"to": to_position or "TODO", "probability": 70, "result": "success"},
            {"to": failure_pos, "probability": 20, "result": "failure"},
            {"to": "TODO", "probability": 10, "result": "counter"}
        ],
        "success_rate": 50,
        "overview": "TODO: Add overview - this field requires at least 400 characters of content describing the technique with strategic context, biomechanical principles, and positional integration. The overview should cover the fundamental purpose of the technique, when it is most effective, common setups, and how it fits into the broader BJJ positional hierarchy. Include information about risk/reward tradeoffs and typical scenarios where this technique is applied at different skill levels.",
        "related_content": [
            {"name": "TODO", "relationship": "TODO"},
            {"name": "TODO", "relationship": "TODO"},
            {"name": "TODO", "relationship": "TODO"}
        ],
        "attacker": {
            "name": f"{name} Attacker",
            "description": f"How to execute {name} in BJJ. Attacking perspective with setup, execution steps, and counters.",
            "overview": "TODO - attacker overview must be at least 200 characters describing the technique from the perspective of the person executing it.",
            "key_principles": ["TODO", "TODO", "TODO", "TODO", "TODO"],
            "setup_requirements": ["TODO", "TODO", "TODO", "TODO"],
            "execution_steps": [
                {"step_number": 1, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"},
                {"step_number": 2, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"},
                {"step_number": 3, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"},
                {"step_number": 4, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"},
                {"step_number": 5, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"},
                {"step_number": 6, "action": "TODO", "description": "TODO - each step description must be at least 50 characters long for validation"}
            ],
            "common_counters": [
                {"counter": "TODO", "effectiveness": "Medium", "targets_outcome": "TODO"},
                {"counter": "TODO", "effectiveness": "Medium", "targets_outcome": "TODO"},
                {"counter": "TODO", "effectiveness": "Medium", "targets_outcome": "TODO"}
            ],
            "common_errors": [
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"}
            ],
            "training_progressions": [
                {"phase": "TODO", "focus": "TODO", "description": "TODO"},
                {"phase": "TODO", "focus": "TODO", "description": "TODO"},
                {"phase": "TODO", "focus": "TODO", "description": "TODO"},
                {"phase": "TODO", "focus": "TODO", "description": "TODO"}
            ],
            "flashcards": [
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"}
            ],
            "safety_considerations": "TODO: Add safety considerations - this field requires at least 100 characters describing safety precautions for this technique."
        },
        "defender": {
            "name": f"{name} Defender",
            "description": f"How to defend against {name} in BJJ. Recognition cues, defensive options, and escape strategies.",
            "overview": "TODO - defender overview must be at least 200 characters describing the technique from the perspective of the person defending against it.",
            "key_principles": ["TODO", "TODO", "TODO", "TODO", "TODO"],
            "recognition_cues": ["TODO", "TODO", "TODO"],
            "defensive_options": [
                {"action": "TODO", "when_to_use": "TODO", "targets_outcome": "TODO", "if_successful": "TODO", "risk": "TODO"},
                {"action": "TODO", "when_to_use": "TODO", "targets_outcome": "TODO", "if_successful": "TODO", "risk": "TODO"},
                {"action": "TODO", "when_to_use": "TODO", "targets_outcome": "TODO", "if_successful": "TODO", "risk": "TODO"}
            ],
            "favorable_outcomes": [
                {"outcome": "TODO", "how": "TODO"}
            ],
            "common_errors": [
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"},
                {"error": "TODO", "consequence": "TODO", "correction": "TODO"}
            ],
            "flashcards": [
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"},
                {"question": "TODO?", "answer": "TODO - this answer needs at least fifty characters to pass validation"}
            ],
            "training_progressions": [
                {"phase": "TODO", "focus": "TODO", "description": "TODO"},
                {"phase": "TODO", "focus": "TODO", "description": "TODO"},
                {"phase": "TODO", "focus": "TODO", "description": "TODO"}
            ]
        }
    }


def save_transition_stub(stub: dict) -> bool:
    """Save a transition stub to file."""
    name = stub["name"]
    file_path = TRANSITIONS_PATH / f"{name}.json"

    if file_path.exists():
        return False

    try:
        atomic_write_json(file_path, stub, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        stats_append_error(f"Failed to save stub {name}: {e}")
        return False


# =============================================================================
# FILE PROCESSING
# =============================================================================

def load_json(path: Path) -> Optional[dict]:
    """Load JSON file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        stats_append_error(f"Failed to load {path}: {e}")
        return None


def save_json(path: Path, data: dict) -> bool:
    """Save JSON file atomically."""
    try:
        atomic_write_json(path, data, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        stats_append_error(f"Failed to save {path}: {e}")
        return False


def _transition_names(data: dict) -> set:
    """Every transition name a Position references (outgoing graph edges), across roles."""
    names: set = set()
    lists = [r.get("transitions", []) for r in (data.get("top"), data.get("bottom")) if isinstance(r, dict)]
    lists.append(data.get("transitions", []))  # SINGLE positions keep transitions[] at root
    for lst in lists:
        if isinstance(lst, list):
            for t in lst:
                if isinstance(t, dict) and t.get("transition"):
                    names.add(t["transition"])
    return names


def check_structural_preservation(original: dict, fixed: dict, category: str) -> List[str]:
    """Blocking errors if the regen dropped graph structure that must survive.

    Positions: every original transition must remain — dropping one re-orphans a
    submission (the v1.36.7 orphan-connection work). Transitions/Submissions:
    from_position must be unchanged and no outcome `to` target dropped.
    attempt_probability MAY change; its sum=100 is enforced by the schema validator.
    """
    errors: List[str] = []
    if not isinstance(original, dict) or not isinstance(fixed, dict):
        return errors
    if category == "Positions":
        dropped = _transition_names(original) - _transition_names(fixed)
        if dropped:
            errors.append(
                "PRESERVATION: dropped transitions [" + ", ".join(sorted(dropped)) + "] — this "
                "re-orphans submissions. Restore EVERY original transition; you may retune "
                "attempt_probability but keep all transitions (sum=100 per role)."
            )
    elif category in ("Transitions", "Submissions"):
        of, nf = str(original.get("from_position", "")).strip(), str(fixed.get("from_position", "")).strip()
        if of and of != nf:
            errors.append(f"PRESERVATION: from_position changed '{of}' -> '{nf or '(missing)'}'; keep the original.")
        orig_to = {o.get("to") for o in original.get("outcomes", []) if isinstance(o, dict) and o.get("to")}
        dropped = {t for t in (orig_to - {o.get("to") for o in fixed.get("outcomes", []) if isinstance(o, dict)}) if t}
        if dropped:
            errors.append("PRESERVATION: dropped outcome targets [" + ", ".join(sorted(map(str, dropped))) + "]; keep the original graph edges.")
    elif category == "Systems":
        # `products` is curated affiliate data the AI must never alter. The save path
        # re-merges it from the original before this runs, so this is a sanity backstop.
        if original.get("products") != fixed.get("products"):
            errors.append(
                "PRESERVATION: 'products' is curated affiliate data and must not change; "
                "omit it from your output (it is re-merged automatically)."
            )
    return errors


# _largest_remainder_round is imported from scripts._prob_norm so this module and
# proofread_all_transitions.py share one correct normalizer (clamps negatives,
# rescales proportionally to sum 100, even-distributes the all-zero case).


def normalize_probabilities(data: dict, category: str) -> bool:
    """2D: rescale probabilities to sum EXACTLY 100 per group, preserving Claude's
    relative weighting — fixes only the sum so a near-miss never forces a retry.

    Positions: `attempt_probability` per role (top/bottom, or root for SINGLE).
    Transitions/Submissions: outcome `probability`. Returns True if it changed anything.
    """
    if not isinstance(data, dict):
        return False
    changed = False

    def fix_group(items, key):
        nonlocal changed
        if not isinstance(items, list) or not items:
            return
        vals = []
        for it in items:
            try:
                vals.append(max(0.0, float(it.get(key, 0)))) if isinstance(it, dict) else vals.append(0.0)
            except (TypeError, ValueError):
                vals.append(0.0)
        if round(sum(vals)) == 100:
            return
        for it, nv in zip(items, _largest_remainder_round(vals, 100)):
            if isinstance(it, dict) and it.get(key) != nv:
                it[key] = nv
                changed = True

    if category == "Positions":
        for role in ("top", "bottom"):
            rd = data.get(role)
            if isinstance(rd, dict):
                fix_group(rd.get("transitions", []), "attempt_probability")
        fix_group(data.get("transitions", []), "attempt_probability")  # SINGLE positions
    elif category in ("Transitions", "Submissions"):
        fix_group(data.get("outcomes", []), "probability")
    return changed


def process_file(file_path: Path, refs: Dict[str, List[str]], dry_run: bool = False,
                 max_retries: int = 2, verbose: bool = False, label: str = "") -> dict:
    """Process a single file with severity-aware validation loop.

    Returns:
        dict with keys: outcome ("success"|"failed"|"skipped"), attempts (int), remaining_errors (list)
    """
    tag = f"[{label}] " if label else "  "
    result_info = {"outcome": "failed", "attempts": 0, "remaining_errors": []}

    # Load file
    data = load_json(file_path)
    if not data:
        stats_inc("failed")
        return result_info

    category = detect_category(file_path)
    original_data = copy.deepcopy(data)  # pre-regen snapshot for the structural-preservation check

    # Pre-validation
    is_valid, has_blocking, blocking_errs, non_blocking_errs = run_validation(file_path)

    # Build validation summary for prompt
    all_errors = blocking_errs + non_blocking_errs
    validation_summary = "\n".join(f"- {e}" for e in all_errors) if all_errors else ""

    # Check if needs work
    if is_valid and not has_todos(data) and not needs_enrichment(data, category):
        tprint(f"{tag}SKIP: Already valid and complete")
        stats_inc("skipped")
        result_info["outcome"] = "skipped"
        return result_info

    # Show what we're fixing
    if verbose and all_errors:
        summary = "; ".join(all_errors[:3])
        tprint(f"{tag}Errors: {summary}")

    if dry_run:
        tprint(f"{tag}[DRY RUN] Would call Claude to fix/enrich")
        stats_inc("fixed")
        result_info["outcome"] = "success"
        return result_info

    # Build response schema dynamically per category
    if category == "Positions":
        template_type = detect_position_template(file_path)
    elif category in ("Transitions", "Submissions"):
        template_type = detect_transition_template_type(file_path)
    else:
        template_type = None
    response_schema = build_response_schema(category, template_type)

    # Build prompt
    prompt = build_prompt(file_path, data, validation_summary, refs)

    # Track the data state before any attempts (for revert on blocking errors)
    current_data = copy.deepcopy(data)

    # Process with retries
    for attempt in range(max_retries + 1):
        attempt_num = attempt + 1
        result_info["attempts"] = attempt_num

        if attempt > 0:
            tprint(f"{tag}Retry {attempt}/{max_retries}...")
            stats_inc("retries")

        # Call Claude
        tprint(f"{tag}Calling Claude ({CLAUDE_MODEL})...")
        response, error = call_claude(prompt, response_schema)

        if error:
            stats_append_error(f"{file_path.name}: {error}")
            tprint(f"{tag}Attempt {attempt_num}: API error - {error}")
            # Log API error for debugging
            LOGS_PATH.mkdir(parents=True, exist_ok=True)
            debug_path = LOGS_PATH / f"{file_path.stem}_attempt{attempt_num}_{datetime.now().strftime('%H%M%S')}.txt"
            with open(debug_path, 'w', encoding='utf-8') as f:
                f.write(f"=== API Error ===\n{error}\n")
            tprint(f"{tag}Debug log: {debug_path}")
            continue

        # Extract JSON
        result, extract_error = extract_json_from_response(response)

        if extract_error:
            stats_append_error(f"{file_path.name}: {extract_error}")
            tprint(f"{tag}Attempt {attempt_num}: JSON extraction failed")
            # Log failed response for debugging
            LOGS_PATH.mkdir(parents=True, exist_ok=True)
            debug_path = LOGS_PATH / f"{file_path.stem}_attempt{attempt_num}_{datetime.now().strftime('%H%M%S')}.txt"
            with open(debug_path, 'w', encoding='utf-8') as f:
                f.write(f"=== Extract Error ===\n{extract_error}\n\n")
                f.write(f"=== Response Type ===\n{type(response)}\n\n")
                f.write(f"=== Response Length ===\n{len(response) if response else 0}\n\n")
                f.write(f"=== Raw Response ===\n{response}\n")
            tprint(f"{tag}Debug log: {debug_path}")
            continue

        # --- Aggressive repair (safety nets) ---
        fixed_content = result.get("fixed_content")

        # Safety net 1: No wrapper -> try whole response as content
        if not fixed_content and isinstance(result, dict) and "name" in result:
            fixed_content = result

        # Safety net 2: String -> parse
        if isinstance(fixed_content, str):
            try:
                fixed_content = json.loads(fixed_content)
            except json.JSONDecodeError:
                stats_append_error(f"{file_path.name}: fixed_content is unparseable string")
                tprint(f"{tag}Attempt {attempt_num}: fixed_content is unparseable string")
                LOGS_PATH.mkdir(parents=True, exist_ok=True)
                debug_path = LOGS_PATH / f"{file_path.stem}_attempt{attempt_num}_{datetime.now().strftime('%H%M%S')}.txt"
                with open(debug_path, 'w', encoding='utf-8') as f:
                    f.write(f"=== Error ===\nfixed_content is unparseable string\n\n")
                    f.write(f"=== fixed_content (string) ===\n{fixed_content}\n\n")
                    f.write(f"=== Full result ===\n{json.dumps(result, indent=2)}\n")
                tprint(f"{tag}Debug log: {debug_path}")
                continue

        # Safety net 3: Not a dict -> skip
        if not isinstance(fixed_content, dict):
            stats_append_error(f"{file_path.name}: fixed_content is {type(fixed_content).__name__}, not dict")
            tprint(f"{tag}Attempt {attempt_num}: fixed_content is not a dict")
            LOGS_PATH.mkdir(parents=True, exist_ok=True)
            debug_path = LOGS_PATH / f"{file_path.stem}_attempt{attempt_num}_{datetime.now().strftime('%H%M%S')}.txt"
            with open(debug_path, 'w', encoding='utf-8') as f:
                f.write(f"=== Error ===\nfixed_content is {type(fixed_content).__name__}, not dict\n\n")
                f.write(f"=== fixed_content ===\n{fixed_content}\n\n")
                f.write(f"=== Full result ===\n{json.dumps(result, indent=2, default=str)}\n")
            tprint(f"{tag}Debug log: {debug_path}")
            continue

        # Safety net 4: Inject/correct name
        expected_name = file_path.stem
        if "name" not in fixed_content:
            fixed_content["name"] = expected_name
        elif fixed_content["name"] != expected_name:
            tprint(f"{tag}Correcting name '{fixed_content['name']}' -> '{expected_name}'")
            fixed_content["name"] = expected_name

        # Curation-safety: `products` is hand-curated affiliate data excluded from the AI
        # response contract. Restore it verbatim from the original so enrichment can never
        # drop or invent affiliate links.
        if category == "Systems":
            orig_products = original_data.get("products") if isinstance(original_data, dict) else None
            if orig_products is not None:
                fixed_content["products"] = orig_products
            else:
                fixed_content.pop("products", None)

        # Curation-safety (2D): auto-normalize probabilities to sum exactly 100 instead
        # of failing/retrying on a near-miss. Preserves Claude's relative weighting and
        # leaves all transitions intact (so the 2B preservation check still holds).
        if normalize_probabilities(fixed_content, category):
            tprint(f"{tag}Normalized probabilities to sum 100")

        # Save to disk
        if not save_json(file_path, fixed_content):
            tprint(f"{tag}Attempt {attempt_num}: Failed to save file")
            continue

        # Validate with severity
        is_valid, has_blocking, blocking_errs, non_blocking_errs = run_validation(file_path)

        # Curation-safety (2B): never drop graph structure the orphan-connection work
        # added — a dropped transition re-orphans a submission. Treat as blocking so the
        # existing revert+retry loop re-prompts Claude (with the dropped names) to restore it.
        preservation_errs = check_structural_preservation(original_data, fixed_content, category)
        if preservation_errs:
            blocking_errs = preservation_errs + blocking_errs
            has_blocking = True
            is_valid = False

        if is_valid:
            # Fully valid
            final_data = load_json(file_path)
            if final_data and has_todos(final_data):
                tprint(f"{tag}SUCCESS (with remaining TODOs)")
            else:
                tprint(f"{tag}SUCCESS")

            # Handle stub creation
            created_stubs = result.get("created_stubs", [])
            for stub_info in created_stubs:
                stub_name = stub_info.get("name")
                from_pos = stub_info.get("from_position", "")
                if stub_name and not transition_exists(stub_name, from_pos, refs):
                    stub_content = stub_info.get("content", create_transition_stub(stub_name, from_pos))
                    if save_transition_stub(stub_content):
                        tprint(f"{tag}Created stub: {stub_name}")
                        stats_inc("stubs_created")
                        with _stats_lock:
                            refs["transitions"].append(stub_name)

            # Log changes
            changes = result.get("changes_summary", [])
            if changes and verbose:
                tprint(f"{tag}Changes: {', '.join(changes[:3])}")

            stats_inc("fixed")
            result_info["outcome"] = "success"
            result_info["remaining_errors"] = []
            return result_info

        if has_blocking:
            # Blocking errors: revert file to pre-attempt state, retry
            save_json(file_path, current_data)
            error_summary = "; ".join(blocking_errs[:3])
            tprint(f"{tag}{len(blocking_errs)} blocking errors: {error_summary}")
            tprint(f"{tag}Reverted. Retrying...")
            # Rebuild prompt with failed attempt + errors for retry
            all_retry_errors = blocking_errs + non_blocking_errs
            validation_summary = "\n".join(f"- {e}" for e in all_retry_errors)
            prompt = build_prompt(file_path, fixed_content, validation_summary, refs)
            prompt = f"RETRY ATTEMPT {attempt_num}: Previous fix attempt FAILED validation with BLOCKING errors. Fix these specific errors FIRST:\n{validation_summary}\n\n" + prompt
            continue

        # Only non-blocking errors: file saved (structurally sound), update current_data, keep retrying
        current_data = copy.deepcopy(fixed_content)
        tprint(f"{tag}Saved ({len(non_blocking_errs)} non-blocking errors). Retrying for links...")
        # Rebuild prompt with saved content + errors
        validation_summary = "\n".join(f"- {e}" for e in non_blocking_errs)
        prompt = build_prompt(file_path, fixed_content, validation_summary, refs)
        prompt = f"RETRY ATTEMPT {attempt_num}: File saved but has {len(non_blocking_errs)} non-blocking errors (broken links). Fix these:\n{validation_summary}\n\n" + prompt
        continue

    # All retries exhausted
    remaining = blocking_errs + non_blocking_errs
    result_info["remaining_errors"] = remaining

    tprint(f"{tag}FAILED after {max_retries + 1} attempts.")
    if remaining:
        tprint(f"{tag}Remaining errors ({len(remaining)}):")
        for err in remaining[:5]:
            tprint(f"{tag}  - {err}")
        if len(remaining) > 5:
            tprint(f"{tag}  ... +{len(remaining) - 5} more")

    stats_inc("failed")
    return result_info


# =============================================================================
# FILE COLLECTION
# =============================================================================

def collect_files(category: str = "all", errors_only: bool = False) -> List[Path]:
    """Collect files that need processing."""
    files = []

    paths = []
    if category in ["Positions", "all"]:
        paths.extend(POSITIONS_PATH.rglob("*.json"))
    if category in ["Transitions", "all"]:
        paths.extend(TRANSITIONS_PATH.rglob("*.json"))
    if category in ["Submissions", "all"]:
        paths.extend(SUBMISSIONS_PATH.rglob("*.json"))
    if category in ["Principles", "all"]:
        paths.extend(PRINCIPLES_PATH.rglob("*.json"))
    if category in ["Systems", "all"]:
        paths.extend(SYSTEMS_PATH.rglob("*.json"))
    if category in ["Learning", "all"]:
        if LEARNING_PATH.exists():
            paths.extend(LEARNING_PATH.rglob("*.json"))

    for path in paths:
        if "TEMPLATE" in path.name:
            continue

        # Check if needs processing
        data = load_json(path)
        if not data:
            continue

        cat = detect_category(path)
        is_valid, _, _, _ = run_validation(path)

        if errors_only:
            if not is_valid:
                files.append(path)
        else:
            if not is_valid or has_todos(data) or needs_enrichment(data, cat):
                files.append(path)

    return sorted(files)


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph Unified Content Fixer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Fix single file
  python3 scripts/regenerate_content_json.py --file "content/Positions/Mount.json"

  # Queue mode with 20-minute intervals
  python3 scripts/regenerate_content_json.py --interval 1200

  # Dry run on 10 files
  python3 scripts/regenerate_content_json.py --max-files 10 --dry-run

  # Only Positions category
  python3 scripts/regenerate_content_json.py --category Positions
"""
    )

    # Mode selection
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--file", "-f", type=str,
                           help="Single file mode: path to JSON file")
    mode_group.add_argument("--interval", "-i", type=int, default=1200,
                           help="Queue mode: seconds between files (default: 1200 = 20 min)")

    # Filtering
    parser.add_argument("--category", "-c",
                       choices=["Positions", "Transitions", "Submissions", "Principles", "Systems", "Learning", "all"],
                       default="all", help="Category to process (queue mode)")
    parser.add_argument("--errors-only", "-e", action="store_true",
                       help="Only process files with validation errors")
    parser.add_argument("--max-files", "-m", type=int, default=0,
                       help="Maximum files to process (0 = unlimited)")

    # Processing options
    parser.add_argument("--max-retries", type=int, default=2,
                       help="Max correction attempts per file (default: 2)")
    parser.add_argument("--dry-run", "-n", action="store_true",
                       help="Show what would be done without calling Claude")
    parser.add_argument("--batch", "-b", action="store_true",
                       help="Batch mode: process files without waiting (for CI/regenerate)")
    parser.add_argument("--parallel", "-p", type=int, default=1,
                       help="Number of parallel workers (default: 1, use with --batch)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Verbose output")
    parser.add_argument("--peak-throttle", action="store_true",
                       help="After EACH file, if we're in Anthropic's peak window (weekday "
                            "05:00-11:00 PT) wait --peak-throttle-min minutes before the next file, "
                            "so the run trickles through peak and does the bulk off-peak. Off-peak "
                            "the wait is zero and silent. Set PEAK_THROTTLE_DISABLE=1 to force off.")
    parser.add_argument("--peak-throttle-min", type=int, default=30,
                       help="Minutes to wait after a file when peak (default 30).")

    args = parser.parse_args()

    # Banner
    print(f"""
{'=' * 70}
BJJ Graph Unified Content Fixer
{'=' * 70}
Mode: {'SINGLE FILE' if args.file else 'QUEUE'}
Model: {CLAUDE_MODEL}
{'File: ' + args.file if args.file else ('Batch: no delay' if args.batch else (f'Interval: {args.interval}s ({86400 // args.interval} files/day)' if args.interval > 0 else 'Interval: 0s (no delay, back-to-back)'))}
Parallel: {args.parallel} worker{'s' if args.parallel > 1 else ''}
Category: {args.category}
Dry Run: {args.dry_run}
{'=' * 70}

Domain-specific prompts:
  - Positions: RETENTION focus (maintaining stable states)
  - Transitions: EXECUTION focus (performing motion)
  - Submissions: FINISHING focus (mechanics that cause tap)
  - Principles: Cross-position application and decision frameworks
  - Systems: Implementation sequence and training methodology
{'=' * 70}
""", flush=True)

    # Build reference lists
    print("Building reference lists...", flush=True)
    refs = build_reference_lists()
    print(f"  Positions: {len(refs['positions'])}", flush=True)
    print(f"  Transitions: {len(refs['transitions'])}", flush=True)
    print(f"  Submissions: {len(refs['submissions'])}", flush=True)
    print(f"  Principles: {len(refs['principles'])}", flush=True)
    print(f"  Systems: {len(refs['systems'])}", flush=True)
    print(f"  Learning: {len(refs.get('learning', []))}", flush=True)
    print()

    # Run-level summary
    run_summary = {
        "started_at": datetime.now().isoformat(),
        "model": CLAUDE_MODEL,
        "dry_run": args.dry_run,
        "files": []
    }

    # Single file mode
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"ERROR: File not found: {args.file}")
            return 1

        print(f"Processing: {file_path.name}", flush=True)
        stats["processed"] = 1
        file_result = process_file(file_path, refs, args.dry_run, args.max_retries, args.verbose)
        run_summary["files"].append({"file": str(file_path), **file_result})

    # Queue mode
    else:
        print("Collecting files needing processing...", flush=True)
        files = collect_files(args.category, args.errors_only)

        if not files:
            print("No files need processing!")
            return 0

        print(f"Found {len(files)} files to process\n", flush=True)

        if args.max_files > 0:
            files = files[:args.max_files]

        # Process files
        if args.parallel > 1 and args.batch:
            # Parallel processing with thread pool
            tprint(f"Processing with {args.parallel} parallel workers...\n")

            def _worker(idx_path):
                idx, fp = idx_path
                label = f"{idx+1}/{len(files)}"
                tprint(f"\n[{label}] {fp.relative_to(CONTENT_PATH)}")
                stats_inc("processed")
                result = process_file(fp, refs, args.dry_run, args.max_retries, args.verbose, label=label)
                return {"file": str(fp), **result}

            try:
                with ThreadPoolExecutor(max_workers=args.parallel) as pool:
                    futures = {pool.submit(_worker, (i, fp)): i for i, fp in enumerate(files)}
                    for future in as_completed(futures):
                        try:
                            run_summary["files"].append(future.result())
                        except KeyboardInterrupt:
                            raise
                        except Exception as e:
                            stats_inc("failed")
                            stats_append_error(f"Worker exception: {e}")
            except KeyboardInterrupt:
                tprint(f"\n\nInterrupted. Waiting for in-flight workers to finish...")
        else:
            # Sequential processing
            try:
                for i, file_path in enumerate(files):
                    tprint(f"\n[{i+1}/{len(files)}] {file_path.relative_to(CONTENT_PATH)}")
                    stats_inc("processed")

                    file_result = process_file(file_path, refs, args.dry_run, args.max_retries, args.verbose,
                                               label=f"{i+1}/{len(files)}")
                    run_summary["files"].append({"file": str(file_path), **file_result})

                    # Sustainable inter-call pacing: sleep after EVERY file (incl. the first) to
                    # keep the weekly budget on target. During Anthropic's peak window (weekday
                    # 05:00-11:00 PT) enforce at least the peak floor — the LONGER of the two wins
                    # (they do NOT stack). Skipped in --batch / --dry-run / on the last file.
                    if i < len(files) - 1 and not args.dry_run and not args.batch:
                        wait = max(0, args.interval)
                        peak_floor = args.peak_throttle_min * 60 if (args.peak_throttle and _is_peak_now()) else 0
                        if peak_floor > wait:
                            wait = peak_floor
                            tprint(f"\n[pace] PEAK HOURS (weekday 05:00-11:00 PT) — waiting {wait // 60} min before next file...")
                        elif wait > 0:
                            tprint(f"\n[pace] sleeping ~{wait // 60} min ({wait}s) before next file...")
                        if wait > 0:
                            time.sleep(wait)
            except KeyboardInterrupt:
                tprint(f"\n\nInterrupted after {i+1}/{len(files)} files.")

    # Summary
    tprint(f"""
{'=' * 70}
SUMMARY
{'=' * 70}
Processed: {stats['processed']}
Fixed:     {stats['fixed']}
Skipped:   {stats['skipped']} (already complete)
Failed:    {stats['failed']}
Retries:   {stats['retries']}
Stubs:     {stats['stubs_created']}
Errors:    {len(stats['errors'])}
""")

    if stats["errors"]:
        tprint("Errors:")
        for e in stats["errors"][:10]:
            tprint(f"  - {e}")
        if len(stats["errors"]) > 10:
            tprint(f"  ... and {len(stats['errors']) - 10} more")

    # Write run-level summary log
    if stats["processed"] > 0 and not args.dry_run:
        LOGS_PATH.mkdir(parents=True, exist_ok=True)
        run_summary["finished_at"] = datetime.now().isoformat()
        run_summary["stats"] = dict(stats)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        summary_path = LOGS_PATH / f"run_{timestamp}.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(run_summary, f, indent=2, ensure_ascii=False)
        print(f"\nRun summary: {summary_path}", flush=True)

    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
