#!/usr/bin/env python3
"""
Create position-specific submission variant JSON files.

For each position→transition→generic-submission path in the graph where no
position-specific variant exists, creates a new submission JSON file that
inherits safety/category data from the generic submission and uses TODO
placeholders for content the bot will fill.
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = slug.replace('%', ' percent ')
    slug = slug.replace('&', ' and ')
    slug = slug.replace("'", '')
    slug = slug.replace('"', '')
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def load_generic_submission(submissions_dir: Path, name: str) -> dict | None:
    """Load the generic submission JSON file by name."""
    path = submissions_dir / f"{name}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def make_variant(generic: dict, variant_name: str, position_name: str,
                 from_position: str, role: str) -> dict:
    """Create a variant submission JSON from a generic submission."""
    pos_slug = slugify(position_name)
    sub_slug = slugify(generic['name'])

    # Build tags from generic + position-specific
    base_tags = [t for t in generic.get('tags', []) if t not in ('bjj', 'submission')]
    pos_tag = pos_slug
    tags = ['bjj', 'submission'] + base_tags
    if pos_tag not in tags:
        tags.append(pos_tag)

    # Build from_position string
    role_cap = role.capitalize() if role else 'Top'
    from_pos_str = f"{position_name}/{role_cap}"

    # Build outcomes: success→game-over, failure→source position, counter→guard
    # Use source position for failure (stay where you are if submission fails)
    failure_pos = from_pos_str
    counter_pos = "Closed Guard/Bottom" if role_cap == "Top" else "Closed Guard/Top"

    success_pct = generic.get('success_rate', 50)
    # Distribute remaining: 60/25/15 ratio scaled to non-success portion
    # But keep it simple with the generic's own success rate
    outcomes = [
        {"to": "game-over", "probability": success_pct, "result": "success"},
        {"to": failure_pos, "probability": max(10, round((100 - success_pct) * 0.65)),
         "result": "failure"},
        {"to": counter_pos,
         "probability": max(5, 100 - success_pct - max(10, round((100 - success_pct) * 0.65))),
         "result": "counter"}
    ]
    # Ensure probabilities sum to 100
    total = sum(o['probability'] for o in outcomes)
    if total != 100:
        outcomes[1]['probability'] += 100 - total

    desc_prefix = variant_name
    if len(desc_prefix) > 80:
        desc_prefix = desc_prefix[:77] + "..."

    variant = {
        "name": variant_name,
        "description": f"TODO: SEO description for {desc_prefix} - 150-160 chars.",
        "tags": tags,
        "submission_category": generic.get('submission_category', 'TODO'),
        "submission_type": generic.get('submission_type', 'TODO'),
        "target_area": generic.get('target_area', 'TODO'),
        "starting_position": position_name,
        "from_position": from_pos_str,
        "success_rate": success_pct,
        "overview": f"TODO: Write a 2-3 paragraph overview of the {variant_name}. Describe how executing this submission from {position_name} differs from other positions. Cover the unique setup, grip mechanics, and finishing details specific to {position_name}. Minimum 400 characters.",
        "safety_considerations": generic.get('safety_considerations', {
            "injury_risks": [
                {"injury": "TODO: Primary injury risk", "severity": "High", "recovery_time": "TODO"}
            ],
            "application_speed": "SLOW and progressive - 3-5 seconds minimum.",
            "tap_signals": [
                "Verbal tap (saying 'tap')",
                "Physical hand tap on opponent or mat (minimum 2 taps)",
                "Physical foot tap on mat (minimum 2 taps)"
            ],
            "release_protocol": [
                "Immediately release all pressure",
                "Return limb to neutral position slowly",
                "Check on training partner"
            ],
            "training_restrictions": [
                "TODO: Training restriction 1",
                "TODO: Training restriction 2"
            ]
        }),
        "from_positions": [position_name],
        "related_submissions": [
            {"name": generic['name'], "relationship": f"Generic version of this submission"},
        ],
        "related_content": [
            {"name": f"Positions/{position_name}", "relationship": f"Starting position for this submission variant"}
        ],
        "outcomes": outcomes,
        "attacker": {
            "name": f"{variant_name} Attacker",
            "description": f"TODO: SEO description for attacking with {variant_name} - 150-160 chars.",
            "overview": f"TODO: Write overview of attacking with the {variant_name} from {position_name}. Minimum 200 characters.",
            "key_principles": [
                f"TODO: Key attacking principle 1 for {variant_name}",
                "TODO: Key attacking principle 2",
                "TODO: Key attacking principle 3",
                "TODO: Key attacking principle 4",
                "TODO: Key attacking principle 5"
            ],
            "setup_requirements": [
                f"TODO: Setup requirement 1 from {position_name}",
                "TODO: Setup requirement 2",
                "TODO: Setup requirement 3",
                "TODO: Setup requirement 4"
            ],
            "execution_steps": [
                {"step_number": 1, "action": "TODO: Step 1", "description": "TODO: Describe the first step of executing this submission from this position. Min 50 chars."},
                {"step_number": 2, "action": "TODO: Step 2", "description": "TODO: Describe the second step of executing this submission from this position. Min 50 chars."},
                {"step_number": 3, "action": "TODO: Step 3", "description": "TODO: Describe the third step of executing this submission from this position. Min 50 chars."},
                {"step_number": 4, "action": "TODO: Step 4", "description": "TODO: Describe the fourth step of executing this submission from this position. Min 50 chars."},
                {"step_number": 5, "action": "TODO: Step 5", "description": "TODO: Describe the fifth step of executing this submission from this position. Min 50 chars."},
                {"step_number": 6, "action": "TODO: Step 6", "description": "TODO: Describe the sixth step of executing this submission from this position. Min 50 chars."}
            ],
            "common_counters": [
                {"counter": "TODO: Counter 1", "effectiveness": "High", "your_response": "TODO: Your response", "targets_outcome": failure_pos},
                {"counter": "TODO: Counter 2", "effectiveness": "Medium", "your_response": "TODO: Your response", "targets_outcome": failure_pos},
                {"counter": "TODO: Counter 3", "effectiveness": "Low", "your_response": "TODO: Your response", "targets_outcome": counter_pos}
            ],
            "common_errors": [
                {"error": "TODO: Common error 1", "correction": "TODO: Correction 1"},
                {"error": "TODO: Common error 2", "correction": "TODO: Correction 2"},
                {"error": "TODO: Common error 3", "correction": "TODO: Correction 3"},
                {"error": "TODO: Common error 4", "correction": "TODO: Correction 4"},
                {"error": "TODO: Common error 5", "correction": "TODO: Correction 5"}
            ],
            "training_progressions": [
                {"phase": "TODO: Phase 1", "focus": "TODO: Focus", "drills": "TODO: Drills"},
                {"phase": "TODO: Phase 2", "focus": "TODO: Focus", "drills": "TODO: Drills"},
                {"phase": "TODO: Phase 3", "focus": "TODO: Focus", "drills": "TODO: Drills"},
                {"phase": "TODO: Phase 4", "focus": "TODO: Focus", "drills": "TODO: Drills"}
            ],
            "knowledge_assessment": [
                {"question": f"What is the primary setup for the {variant_name}?", "answer": f"TODO: Describe the primary setup for the {variant_name} from {position_name}. Minimum 50 characters.", "safety_critical": False},
                {"question": f"What makes the {variant_name} different from other positions?", "answer": f"TODO: Explain how {position_name} changes the execution of this submission. Minimum 50 characters.", "safety_critical": False},
                {"question": f"What are the key safety considerations when applying the {variant_name}?", "answer": "TODO: Describe safety considerations including proper application speed and tap awareness. Minimum 50 characters.", "safety_critical": True},
                {"question": f"How should you release the {variant_name} after a tap?", "answer": "TODO: Describe the proper release protocol to prevent injury after submission. Minimum 50 characters.", "safety_critical": True},
                {"question": f"What are the most common defensive responses to the {variant_name}?", "answer": "TODO: List and explain the most common defenses your opponent will attempt. Minimum 50 characters.", "safety_critical": False}
            ]
        },
        "defender": {
            "name": f"{variant_name} Defender",
            "description": f"TODO: SEO description for defending against {variant_name} - 150-160 chars.",
            "overview": f"TODO: Write overview of defending against the {variant_name}. Minimum 200 characters.",
            "key_principles": [
                f"TODO: Key defensive principle 1 against {variant_name}",
                "TODO: Key defensive principle 2",
                "TODO: Key defensive principle 3",
                "TODO: Key defensive principle 4",
                "TODO: Key defensive principle 5"
            ],
            "recognition_cues": [
                f"TODO: Recognition cue 1 for {variant_name}",
                "TODO: Recognition cue 2",
                "TODO: Recognition cue 3"
            ],
            "defensive_options": [
                {"action": "TODO: Defensive option 1", "when_to_use": "TODO", "targets_outcome": failure_pos, "if_successful": "TODO", "risk": "TODO"},
                {"action": "TODO: Defensive option 2", "when_to_use": "TODO", "targets_outcome": failure_pos, "if_successful": "TODO", "risk": "TODO"},
                {"action": "TODO: Defensive option 3", "when_to_use": "TODO", "targets_outcome": counter_pos, "if_successful": "TODO", "risk": "TODO"}
            ],
            "escape_paths": [
                {"path": "TODO: Escape path 1", "description": "TODO"},
                {"path": "TODO: Escape path 2", "description": "TODO"}
            ],
            "favorable_outcomes": [
                {"outcome": counter_pos, "how": f"TODO: How to achieve this outcome when defending against {variant_name}"}
            ],
            "common_errors": [
                {"error": "TODO: Defensive error 1", "correction": "TODO: Correction 1"},
                {"error": "TODO: Defensive error 2", "correction": "TODO: Correction 2"},
                {"error": "TODO: Defensive error 3", "correction": "TODO: Correction 3"}
            ],
            "knowledge_assessment": [
                {"question": f"How do you recognize the {variant_name} is being set up?", "answer": "TODO: Describe the key visual and tactile cues that indicate this submission is being attempted. Minimum 50 characters.", "safety_critical": False},
                {"question": f"What is the safest way to tap to the {variant_name}?", "answer": "TODO: Describe proper tap signals and when to tap to prevent injury. Minimum 50 characters.", "safety_critical": True},
                {"question": f"What defensive options are available against the {variant_name}?", "answer": "TODO: List the primary defensive techniques and when to employ each one. Minimum 50 characters.", "safety_critical": False}
            ],
            "training_progressions": [
                {"phase": "TODO: Phase 1", "focus": "TODO: Focus", "drills": "TODO: Drills"},
                {"phase": "TODO: Phase 2", "focus": "TODO: Focus", "drills": "TODO: Drills"},
                {"phase": "TODO: Phase 3", "focus": "TODO: Focus", "drills": "TODO: Drills"}
            ]
        }
    }

    return variant


def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    submissions_dir = project_root / 'content' / 'Submissions'
    graph_path = project_root / 'graph.json'

    if not graph_path.exists():
        print("ERROR: graph.json not found. Run 'npm run regenerate:graph' first.")
        sys.exit(1)

    with open(graph_path) as f:
        g = json.load(f)

    transitions = g.get('transitions', {})
    submissions = g.get('submissions', {})
    positions = g.get('positions', {})

    # Build set of existing submission names
    sub_names = set()
    for s_data in submissions.values():
        sub_names.add(s_data.get('name', ''))
    # Also check filesystem for files not yet in graph
    for p in submissions_dir.rglob('*.json'):
        sub_names.add(p.stem)

    # Find all missing variants
    variants_to_create = {}  # variant_name -> (generic_name, position_name, from_position, role)

    for p_key, p_data in positions.items():
        pos_path = p_data.get('path', '')
        parts = pos_path.split('/') if pos_path else []
        if parts and parts[-1] in ('Top', 'Bottom'):
            role = parts[-1].lower()
            parts = parts[:-1]
        else:
            role = 'top'
        leaf_pos = parts[-1] if parts else p_data.get('name', '')

        for t_entry in p_data.get('transitions', []):
            t_slug = t_entry.get('target', '')
            t_data = transitions.get(t_slug, {})
            if not t_data:
                continue
            for o in t_data.get('outcomes', []):
                if o.get('result') != 'success' or o.get('to', '') == 'game-over':
                    continue
                sub_slug = o['to'].split('/')[0] if '/' in o['to'] else o['to']
                if sub_slug not in submissions:
                    continue
                sub_name = submissions[sub_slug].get('name', '')
                if ' from ' in sub_name:
                    continue  # already a variant
                variant_name = f'{sub_name} from {leaf_pos}'
                if variant_name in sub_names:
                    continue  # already exists
                if variant_name not in variants_to_create:
                    variants_to_create[variant_name] = (sub_name, leaf_pos, pos_path, role)

    print(f"Found {len(variants_to_create)} submission variants to create")

    created = 0
    skipped = 0
    for variant_name, (generic_name, position_name, from_position, role) in sorted(variants_to_create.items()):
        out_path = submissions_dir / f"{variant_name}.json"
        if out_path.exists():
            skipped += 1
            continue

        generic = load_generic_submission(submissions_dir, generic_name)
        if not generic:
            print(f"  WARNING: Generic submission '{generic_name}' not found, skipping '{variant_name}'")
            skipped += 1
            continue

        variant = make_variant(generic, variant_name, position_name, from_position, role)

        with open(out_path, 'w') as f:
            json.dump(variant, f, indent=2)
            f.write('\n')

        created += 1

    print(f"Created {created} files, skipped {skipped}")
    if created:
        print(f"\nFiles written to: {submissions_dir}/")
        print("Run 'npm run regenerate' to validate and generate markdown from these files.")


if __name__ == '__main__':
    main()
