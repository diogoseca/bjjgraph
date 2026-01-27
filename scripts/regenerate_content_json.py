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
- Uses Opus 4.5 for all Claude calls

Usage:
    python3 scripts/regenerate_content_json.py --file "source/content/Positions/Mount.json"
    python3 scripts/regenerate_content_json.py --interval 1200 --category Positions
    python3 scripts/regenerate_content_json.py --max-files 10 --dry-run
"""

import argparse
import json
import subprocess
import sys
import time
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

# =============================================================================
# PATHS
# =============================================================================
CONTENT_PATH = Path("source/content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
TEMPLATES_PATH = Path("source/templates")
LOGS_PATH = Path("logs/fix_content")

# Model to use for all Claude calls
CLAUDE_MODEL = "claude-opus-4-5-20251101"

# =============================================================================
# STATS
# =============================================================================
stats = {
    "processed": 0,
    "fixed": 0,
    "skipped": 0,
    "failed": 0,
    "stubs_created": 0,
    "retries": 0,
    "errors": []
}

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

    # Helper to extract base filename
    def get_names(path: Path) -> List[str]:
        names = []
        for f in path.rglob("*.json"):
            if "TEMPLATE" not in f.name:
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

def run_validation(file_path: Path) -> Tuple[bool, str]:
    """Run validation on a single file."""
    try:
        result = subprocess.run(
            ["python3", "scripts/validate_json.py", "--file", str(file_path)],
            capture_output=True,
            text=True,
            cwd=Path.cwd()
        )
        output = result.stdout + result.stderr
        is_valid = "Valid" in output and "ERROR" not in output
        return is_valid, output.strip()
    except Exception as e:
        return False, f"Validation failed: {e}"


def has_todos(data: dict) -> bool:
    """Check if JSON contains TODO markers."""
    return "TODO" in json.dumps(data)


def needs_enrichment(data: dict, category: str) -> bool:
    """Check if file needs enrichment based on knowledge_assessment."""
    # Check for TODOs
    if has_todos(data):
        return True

    # Check knowledge_assessment adequacy
    min_qa = 5

    if category == "Positions":
        for role in ["top", "bottom"]:
            if role in data:
                ka = data[role].get("knowledge_assessment", [])
                if len(ka) < min_qa:
                    return True
    else:
        ka = data.get("knowledge_assessment", [])
        if len(ka) < min_qa:
            return True

    # Check for placeholder outcomes
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
            "SINGLE": "source/templates/Positions/TEMPLATE-POSITION-SINGLE.json",
            "DUAL": "source/templates/Positions/TEMPLATE-POSITION-DUAL.json",
            "FAMILY": "source/templates/Positions/TEMPLATE-POSITION-FAMILY.json",
        },
        "Transitions": "source/templates/Transitions.json",
        "Submissions": "source/templates/Submissions.json",
    }

    if category == "Positions" and template_type:
        template_path = Path(template_map["Positions"].get(template_type, template_map["Positions"]["DUAL"]))
    else:
        template_path = Path(template_map.get(category, template_map["Transitions"]))

    try:
        with open(template_path, 'r') as f:
            return f.read()
    except:
        return "Template not available"


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
- Each entry: { "transition": "Technique Name", "attempt_probability": N }
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

    return f"Set name = '{filename}' (MUST MATCH FILENAME EXACTLY)"


# =============================================================================
# COMMON PROMPT SECTIONS
# =============================================================================

REFERENCE_FORMAT_RULES = """
REFERENCE FORMAT (CRITICAL - Hub-and-Spoke Architecture):
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

### 2. Review attempt_probability Values
- MUST sum to 100% per role (top/bottom)
- Reflect realistic training choices for advanced hobbyists
- Consider what techniques are actually attempted vs theoretically possible

### 3. Add/Improve knowledge_assessment (8-12 Q&A pairs)
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

### 3. Add/Improve knowledge_assessment (8-12 Q&A pairs)
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

### 3. Add/Improve knowledge_assessment (8-12 Q&A pairs)
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
        "positions_count": len(refs["positions"]),
        "transitions_count": len(refs["transitions"]),
        "submissions_count": len(refs["submissions"]),
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

    # Fallback to Transitions
    common_params["template_content"] = get_template_content("Transitions")
    common_params["field_guidance"] = get_field_guidance("Transitions", None, filename)
    return TRANSITION_PROMPT.format(**common_params)


# =============================================================================
# CLAUDE INTERACTION
# =============================================================================

def call_claude(prompt: str, timeout: int = 300) -> Tuple[Optional[str], Optional[str]]:
    """Call Claude CLI with Opus 4.5."""
    try:
        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--model", CLAUDE_MODEL,
                "--output-format", "text"
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=Path.cwd()
        )

        if result.returncode != 0:
            return None, f"Claude CLI error: {result.stderr}"

        return result.stdout.strip(), None

    except subprocess.TimeoutExpired:
        return None, "Claude CLI timeout"
    except FileNotFoundError:
        return None, "Claude CLI not found - ensure 'claude' is in PATH"
    except Exception as e:
        return None, f"Claude CLI exception: {e}"


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
    """Create a minimal transition stub."""
    return {
        "name": name,
        "description": f"TODO: Add description for {name}",
        "tags": ["TODO"],
        "from_position": from_position,
        "outcomes": [
            {"to": to_position or "TODO", "probability": 70, "result": "success"},
            {"to": from_position.split("/")[0] if "/" in from_position else from_position, "probability": 20, "result": "failure"},
            {"to": "TODO", "probability": 10, "result": "counter"}
        ],
        "success_rates": {
            "beginner": 30,
            "intermediate": 50,
            "advanced": 70
        },
        "overview": "TODO: Add overview",
        "key_principles": ["TODO"],
        "setup_requirements": ["TODO"],
        "execution_steps": ["TODO"],
        "common_counters": [{"counter": "TODO", "response": "TODO"}],
        "common_errors": [{"error": "TODO", "correction": "TODO"}],
        "knowledge_assessment": [{"question": "TODO", "answer": "TODO"}],
        "safety_considerations": "TODO: Add safety considerations",
        "position_integration": "TODO: Add position integration",
        "related_content": []
    }


def save_transition_stub(stub: dict) -> bool:
    """Save a transition stub to file."""
    name = stub["name"]
    file_path = TRANSITIONS_PATH / f"{name}.json"

    if file_path.exists():
        return False

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(stub, f, indent=2, ensure_ascii=False)
            f.write('\n')
        return True
    except Exception as e:
        stats["errors"].append(f"Failed to save stub {name}: {e}")
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
        stats["errors"].append(f"Failed to load {path}: {e}")
        return None


def save_json(path: Path, data: dict) -> bool:
    """Save JSON file."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        return True
    except Exception as e:
        stats["errors"].append(f"Failed to save {path}: {e}")
        return False


def process_file(file_path: Path, refs: Dict[str, List[str]], dry_run: bool = False,
                 max_retries: int = 2, verbose: bool = False) -> bool:
    """Process a single file with validation loop."""

    # Load file
    data = load_json(file_path)
    if not data:
        stats["failed"] += 1
        return False

    category = detect_category(file_path)

    # Pre-validation
    is_valid, validation_output = run_validation(file_path)

    # Check if needs work
    if is_valid and not has_todos(data) and not needs_enrichment(data, category):
        print(f"  SKIP: Already valid and complete", flush=True)
        stats["skipped"] += 1
        return True

    # Show what we're fixing
    if verbose and validation_output:
        print(f"  Validation: {validation_output[:200]}...", flush=True)

    if dry_run:
        print(f"  [DRY RUN] Would call Claude to fix/enrich", flush=True)
        stats["fixed"] += 1
        return True

    # Build prompt
    prompt = build_prompt(file_path, data, validation_output, refs)

    # Process with retries
    for attempt in range(max_retries + 1):
        if attempt > 0:
            print(f"  Retry {attempt}/{max_retries}...", flush=True)
            stats["retries"] += 1

        # Call Claude
        print(f"  Calling Claude ({CLAUDE_MODEL})...", flush=True)
        response, error = call_claude(prompt)

        if error:
            stats["errors"].append(f"{file_path.name}: {error}")
            continue

        # Extract JSON
        result, extract_error = extract_json_from_response(response)

        if extract_error:
            stats["errors"].append(f"{file_path.name}: {extract_error}")
            # Save raw response for debugging
            log_path = LOGS_PATH / f"{file_path.stem}_raw_{datetime.now().strftime('%H%M%S')}.txt"
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_path, 'w') as f:
                f.write(response)
            continue

        # Get fixed content
        fixed_content = result.get("fixed_content")
        if not fixed_content:
            stats["errors"].append(f"{file_path.name}: No fixed_content in response")
            continue

        # Validate response structure before saving
        if not isinstance(fixed_content, dict):
            stats["errors"].append(f"{file_path.name}: fixed_content is {type(fixed_content).__name__}, not dict")
            continue
        if "name" not in fixed_content:
            stats["errors"].append(f"{file_path.name}: fixed_content missing required 'name' field")
            continue
        expected_name = file_path.stem
        if fixed_content["name"] != expected_name:
            print(f"  WARNING: name mismatch '{fixed_content['name']}' vs '{expected_name}', correcting", flush=True)
            fixed_content["name"] = expected_name

        # Save file
        if not save_json(file_path, fixed_content):
            continue

        # Post-validation
        is_valid, validation_output = run_validation(file_path)

        if is_valid:
            # Check for remaining TODOs
            final_data = load_json(file_path)
            if final_data and has_todos(final_data):
                print(f"  WARNING: File still contains TODOs", flush=True)
            else:
                print(f"  SUCCESS: File is valid", flush=True)

            # Handle stub creation
            created_stubs = result.get("created_stubs", [])
            for stub_info in created_stubs:
                stub_name = stub_info.get("name")
                from_pos = stub_info.get("from_position", "")
                if stub_name and not transition_exists(stub_name, from_pos, refs):
                    stub_content = stub_info.get("content", create_transition_stub(stub_name, from_pos))
                    if save_transition_stub(stub_content):
                        print(f"  Created stub: {stub_name}", flush=True)
                        stats["stubs_created"] += 1
                        refs["transitions"].append(stub_name)  # Update refs

            # Log changes
            changes = result.get("changes_summary", [])
            if changes and verbose:
                print(f"  Changes: {', '.join(changes[:3])}", flush=True)

            stats["fixed"] += 1
            return True

        # Validation failed - rebuild full prompt with updated content and errors
        # This preserves reference lists, template schema, and field guidance
        # that are essential for fixing broken references
        print(f"  Rebuilding prompt with full context for retry...", flush=True)
        prompt = build_prompt(file_path, fixed_content, validation_output, refs)
        prompt = f"RETRY ATTEMPT {attempt + 1}: Previous fix attempt FAILED validation. Focus on fixing these specific errors FIRST, then ensure all other content remains valid.\n\n" + prompt

    # All retries exhausted
    print(f"  FAILED: Could not fix after {max_retries} retries", flush=True)
    stats["failed"] += 1
    return False


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

    for path in paths:
        if "TEMPLATE" in path.name:
            continue

        # Check if needs processing
        data = load_json(path)
        if not data:
            continue

        cat = detect_category(path)
        is_valid, _ = run_validation(path)

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
  python3 scripts/regenerate_content_json.py --file "source/content/Positions/Mount.json"

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
                       choices=["Positions", "Transitions", "Submissions", "all"],
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
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Verbose output")

    args = parser.parse_args()

    # Banner
    print(f"""
{'=' * 70}
BJJ Graph Unified Content Fixer
{'=' * 70}
Mode: {'SINGLE FILE' if args.file else 'QUEUE'}
Model: {CLAUDE_MODEL}
{'File: ' + args.file if args.file else f'Interval: {args.interval}s ({86400 // args.interval} files/day)'}
Category: {args.category}
Dry Run: {args.dry_run}
{'=' * 70}

Domain-specific prompts:
  - Positions: RETENTION focus (maintaining stable states)
  - Transitions: EXECUTION focus (performing motion)
  - Submissions: FINISHING focus (mechanics that cause tap)
{'=' * 70}
""", flush=True)

    # Build reference lists
    print("Building reference lists...", flush=True)
    refs = build_reference_lists()
    print(f"  Positions: {len(refs['positions'])}", flush=True)
    print(f"  Transitions: {len(refs['transitions'])}", flush=True)
    print(f"  Submissions: {len(refs['submissions'])}", flush=True)
    print()

    # Single file mode
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"ERROR: File not found: {args.file}")
            return 1

        print(f"Processing: {file_path.name}", flush=True)
        stats["processed"] = 1
        success = process_file(file_path, refs, args.dry_run, args.max_retries, args.verbose)

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
        for i, file_path in enumerate(files):
            print(f"\n[{i+1}/{len(files)}] {file_path.relative_to(CONTENT_PATH)}", flush=True)
            stats["processed"] += 1

            process_file(file_path, refs, args.dry_run, args.max_retries, args.verbose)

            # Wait between files (skip in batch mode)
            if i < len(files) - 1 and not args.dry_run and not args.batch:
                print(f"\nWaiting {args.interval}s before next file...", flush=True)
                time.sleep(args.interval)

    # Summary
    print(f"""
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
""", flush=True)

    if stats["errors"]:
        print("Errors:", flush=True)
        for e in stats["errors"][:10]:
            print(f"  - {e}", flush=True)
        if len(stats["errors"]) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more", flush=True)

    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
