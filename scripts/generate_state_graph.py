#!/usr/bin/env python3
"""
Generate stateGraph.json for the BJJGraph state machine game.

This script parses position, transition, and submission JSON files and generates
a unified state graph for the frontend game mechanics.

Output: /source/public/static/stateGraph.json
"""

import json
import os
import re
from pathlib import Path
from typing import Any


# Neutral positions don't have top/bottom roles - they have no suffix
NEUTRAL_POSITIONS = {
    'standing-position', 'clinch', 'combat-base', 'scramble-position',
    'underhook-battle', 'standing-rear-clinch', 'dogfight-position',
    'defensive-position', 'headquarters-position', 'collar-ties',
    'leg-entanglement', 'lost-by-submission', 'won-by-submission'
}

# Terminal positions (submissions results)
TERMINAL_POSITIONS = {'won-by-submission', 'lost-by-submission'}


def slugify(name: str) -> str:
    """Convert a name to a URL-friendly slug matching Quartz's behavior."""
    # Convert to lowercase
    slug = name.lower().strip()

    # Replace special characters with their text equivalents (matching Quartz)
    # Use spaces around replacements to match how Quartz handles them
    slug = slug.replace('%', ' percent ')
    slug = slug.replace('&', ' and ')
    slug = slug.replace("'", '')
    slug = slug.replace('"', '')

    # Remove any remaining special characters except spaces and hyphens
    slug = re.sub(r'[^\w\s-]', '', slug)

    # Replace spaces and underscores with hyphens
    slug = re.sub(r'[\s_]+', '-', slug)

    # Collapse multiple hyphens
    slug = re.sub(r'-+', '-', slug)

    return slug.strip('-')


def load_json_files(directory: Path) -> list[dict]:
    """Load all JSON files from a directory."""
    files = []
    if not directory.exists():
        return files

    for json_file in directory.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Skip schema files
                if '$schema' in data and 'title' in data and 'properties' in data:
                    continue
                data['_source_file'] = str(json_file)
                files.append(data)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load {json_file}: {e}")

    return files


def build_position_path_index(positions_dir: Path) -> dict[str, str]:
    """
    Build an index mapping position slugs to their full paths.
    Handles nested positions like Twister-Control/Truck.

    Returns: dict mapping slug -> relative path (e.g., 'truck' -> 'twister-control/truck')
    """
    index = {}

    for json_file in positions_dir.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Skip schema files
            if '$schema' in data and 'title' in data and 'properties' in data:
                continue

            name = data.get('name', '')
            if not name:
                continue

            slug = slugify(data.get('slug', name))

            # Get relative path from positions_dir, remove .json extension
            rel_path = json_file.relative_to(positions_dir)
            path_str = str(rel_path.with_suffix(''))

            # Convert to lowercase with hyphens (URL format)
            path_slug = path_str.lower().replace(' ', '-').replace('\\', '/')

            # Map the slug to its full path
            index[slug] = path_slug

        except (json.JSONDecodeError, IOError):
            continue

    return index


def is_neutral_position(slug: str) -> bool:
    """Check if a position slug represents a neutral position (no top/bottom roles)."""
    # Check against known neutral positions
    base_slug = slug.split('/')[0] if '/' in slug else slug
    return base_slug in NEUTRAL_POSITIONS


def is_terminal_position(slug: str) -> bool:
    """Check if a position is a terminal state (submission result)."""
    return slug in TERMINAL_POSITIONS or 'won-by-submission' in slug or 'lost-by-submission' in slug


def process_position_role(position_data: dict, role: str, hub_slug: str, hub_path: str, path_index: dict) -> dict | None:
    """Process a position role (top/bottom) into state graph format."""
    role_data = position_data.get(role)
    if not role_data:
        return None

    slug = f"{hub_slug}/{role}"
    full_path = f"{hub_path}/{role.title()}"  # e.g., "twister-control/truck/Top"
    name = role_data.get('name', f"{position_data.get('name', 'Unknown')} {role.title()}")

    # Extract offensive transitions (your moves)
    transitions = []
    for t in role_data.get('offensive_transitions', []):
        target = t.get('target_position', '')
        success_rates = t.get('success_rates', {})

        # Determine if this is a submission (ends in "Won by Submission" or contains submission terms)
        is_submission = 'won by submission' in target.lower() or 'submission' in target.lower()

        # Build target slug with role suffix
        target_slug = slugify(target)

        # Look up full path from index if available
        target_path = path_index.get(target_slug, target_slug)

        if not is_submission and target_slug and not is_terminal_position(target_slug):
            # Check if target is a neutral position (no role suffix needed)
            if is_neutral_position(target_slug):
                # Neutral positions don't get a role suffix
                target_slug = target_slug
            else:
                # Offensive transitions put you in the dominant (top) position
                # Whether you're sweeping from bottom or passing from top
                target_slug = f"{target_slug}/top"

        transition_data = {
            'technique': t.get('technique', 'Unknown Technique'),
            'target': target_slug,
            'targetPath': target_path,  # Full path for URL construction
            'isSubmission': is_submission,
            'successRate': {
                'intermediate': success_rates.get('intermediate', 50),
                'advanced': success_rates.get('advanced', 70)
            }
        }

        # For submissions, add the submission slug for navigation to the submission page
        if is_submission:
            technique_name = t.get('technique', '')
            transition_data['submissionSlug'] = slugify(technique_name)

        transitions.append(transition_data)

    # Extract defensive responses (what opponent can do to you)
    # Role is preserved: if you're on bottom, opponent attacks keep you on bottom
    # If you're on top, opponent escapes still leave them on bottom (you're still attacking)
    defenses = []
    for d in role_data.get('defensive_responses', []):
        target = d.get('target_position', '')
        target_slug = slugify(target)

        # Look up full path from index if available
        target_path = path_index.get(target_slug, target_slug)

        # Check for terminal/submission targets
        is_terminal = is_terminal_position(target_slug)

        if target_slug and not is_terminal:
            if is_neutral_position(target_slug):
                # Neutral positions don't get a role suffix
                pass
            else:
                # Defensive responses preserve your role perspective
                # From bottom: opponent attacks → you stay bottom
                # From top: opponent escapes → they're in defensive position, you're still on top
                target_slug = f"{target_slug}/{role}"

        defenses.append({
            'technique': d.get('technique', 'Unknown Defense'),
            'target': target_slug,
            'targetPath': target_path,
            'successRate': d.get('success_rate', 50)
        })

    # Get state properties
    state_props = role_data.get('state_properties', {})

    return {
        'name': name,
        'hub': hub_slug,
        'role': role,
        'path': full_path,  # Full path for URL construction (e.g., "Twister-Control/Truck/Top")
        'pointValue': state_props.get('point_value', 0),
        'positionType': state_props.get('position_type', 'Neutral'),
        'riskLevel': state_props.get('risk_level', 'Medium'),
        'energyCost': state_props.get('energy_cost', 'Medium'),
        'transitions': transitions,
        'defenses': defenses
    }


def process_positions(content_dir: Path) -> dict:
    """Process all position JSON files into state graph positions."""
    positions_dir = content_dir / 'Positions'
    position_files = load_json_files(positions_dir)

    # Build path index for nested position resolution
    path_index = build_position_path_index(positions_dir)

    positions = {}

    for pos_data in position_files:
        # Skip if no name
        if 'name' not in pos_data:
            continue

        hub_slug = slugify(pos_data.get('slug', pos_data['name']))

        # Get the hub path from source file
        source_file = pos_data.get('_source_file', '')
        if source_file:
            rel_path = Path(source_file).relative_to(positions_dir)
            hub_path = str(rel_path.with_suffix('')).replace('\\', '/')
        else:
            hub_path = hub_slug

        # Process top role
        top = process_position_role(pos_data, 'top', hub_slug, hub_path, path_index)
        if top:
            positions[f"{hub_slug}/top"] = top

        # Process bottom role
        bottom = process_position_role(pos_data, 'bottom', hub_slug, hub_path, path_index)
        if bottom:
            positions[f"{hub_slug}/bottom"] = bottom

        # If no top/bottom, check if it's a single-perspective position (neutral)
        if not top and not bottom:
            # Check for offensive_transitions at the root level
            transitions = []
            for t in pos_data.get('offensive_transitions', []):
                target = t.get('target_position', '')
                success_rates = t.get('success_rates', {})
                is_submission = 'won by submission' in target.lower()
                target_slug = slugify(target)

                # Look up full path from index
                target_path = path_index.get(target_slug, target_slug)

                # Check if target is terminal or neutral
                is_terminal = is_terminal_position(target_slug)

                if not is_submission and target_slug and not is_terminal:
                    if is_neutral_position(target_slug):
                        # Neutral positions don't get a role suffix
                        pass
                    else:
                        # From neutral position, you typically gain top position
                        target_slug = f"{target_slug}/top"

                transitions.append({
                    'technique': t.get('technique', 'Unknown'),
                    'target': target_slug,
                    'targetPath': target_path,
                    'isSubmission': is_submission,
                    'successRate': {
                        'intermediate': success_rates.get('intermediate', 50),
                        'advanced': success_rates.get('advanced', 70)
                    }
                })

            # Process defensive responses for neutral positions
            defenses = []
            for d in pos_data.get('defensive_responses', []):
                target = d.get('target_position', '')
                target_slug = slugify(target)
                target_path = path_index.get(target_slug, target_slug)
                is_terminal = is_terminal_position(target_slug)

                if target_slug and not is_terminal:
                    if is_neutral_position(target_slug):
                        # Stay neutral
                        pass
                    else:
                        # Defensive from neutral typically means you end up on bottom
                        target_slug = f"{target_slug}/bottom"

                defenses.append({
                    'technique': d.get('technique', 'Unknown Defense'),
                    'target': target_slug,
                    'targetPath': target_path,
                    'successRate': d.get('success_rate', 50)
                })

            if transitions or defenses:
                state_props = pos_data.get('state_properties', {})
                positions[hub_slug] = {
                    'name': pos_data['name'],
                    'hub': hub_slug,
                    'role': 'neutral',
                    'path': hub_path,
                    'pointValue': state_props.get('point_value', 0),
                    'positionType': state_props.get('position_type', 'Neutral'),
                    'riskLevel': state_props.get('risk_level', 'Medium'),
                    'energyCost': state_props.get('energy_cost', 'Medium'),
                    'transitions': transitions,
                    'defenses': defenses
                }

    return positions


def process_transitions(content_dir: Path) -> dict:
    """Process all transition JSON files into state graph transitions."""
    transitions_dir = content_dir / 'Transitions'
    positions_dir = content_dir / 'Positions'
    transition_files = load_json_files(transitions_dir)

    # Build path index for position URL resolution
    path_index = build_position_path_index(positions_dir)

    transitions = {}

    for trans_data in transition_files:
        if 'name' not in trans_data:
            continue

        slug = slugify(trans_data['name'])

        # Extract knowledge assessment questions
        knowledge_assessment = []
        for qa in trans_data.get('knowledge_assessment', []):
            knowledge_assessment.append({
                'question': qa.get('question', ''),
                'answer': qa.get('answer', '')
            })

        # Extract common counters
        common_counters = []
        for counter in trans_data.get('common_counters', []):
            effectiveness_map = {'High': 70, 'Medium': 50, 'Low': 30}
            effectiveness = effectiveness_map.get(counter.get('effectiveness', 'Medium'), 50)

            common_counters.append({
                'technique': counter.get('counter', 'Defense'),
                'effectiveness': effectiveness,
                'resultPosition': slugify(trans_data.get('starting_position', ''))
            })

        success_rates = trans_data.get('success_rates', {})

        # Process ending position with role suffix
        ending_pos = trans_data.get('ending_position', '')
        ending_slug = slugify(ending_pos)
        ending_path = path_index.get(ending_slug, ending_slug)

        # Successful transitions put you in the dominant (top) position
        # unless it's a neutral or terminal position
        if ending_slug and not is_neutral_position(ending_slug) and not is_terminal_position(ending_slug):
            ending_slug = f"{ending_slug}/top"

        transitions[slug] = {
            'name': trans_data['name'],
            'startingPosition': slugify(trans_data.get('starting_position', '')),
            'endingPosition': ending_slug,
            'endingPositionPath': ending_path,
            'successRate': {
                'intermediate': success_rates.get('intermediate', 50),
                'advanced': success_rates.get('advanced', 70)
            },
            'knowledgeAssessment': knowledge_assessment,
            'commonCounters': common_counters
        }

    return transitions


def process_submissions(content_dir: Path) -> dict:
    """Process all submission JSON files into state graph submissions."""
    submissions_dir = content_dir / 'Submissions'
    submission_files = load_json_files(submissions_dir)

    submissions = {}

    for sub_data in submission_files:
        if 'name' not in sub_data:
            continue

        slug = slugify(sub_data['name'])

        # Extract knowledge assessment questions
        knowledge_assessment = []
        for qa in sub_data.get('knowledge_assessment', []):
            knowledge_assessment.append({
                'question': qa.get('question', ''),
                'answer': qa.get('answer', ''),
                'safetyCritical': qa.get('safety_critical', False)
            })

        # Extract from_positions
        from_positions = [slugify(p) for p in sub_data.get('from_positions', [])]

        success_rates = sub_data.get('success_rates', {})

        submissions[slug] = {
            'name': sub_data['name'],
            'isTerminal': True,
            'category': sub_data.get('submission_category', 'Unknown'),
            'type': sub_data.get('submission_type', 'Unknown'),
            'targetArea': sub_data.get('target_area', 'Unknown'),
            'startingPosition': slugify(sub_data.get('starting_position', '')),
            'fromPositions': from_positions,
            'successRate': {
                'intermediate': success_rates.get('intermediate', 50),
                'advanced': success_rates.get('advanced', 70)
            },
            'knowledgeAssessment': knowledge_assessment
        }

    return submissions


def generate_state_graph(project_root: Path) -> dict:
    """Generate the complete state graph from all content."""
    content_dir = project_root / 'source' / 'content'

    print(f"Processing content from: {content_dir}")

    positions = process_positions(content_dir)
    print(f"  Processed {len(positions)} position roles")

    transitions = process_transitions(content_dir)
    print(f"  Processed {len(transitions)} transitions")

    submissions = process_submissions(content_dir)
    print(f"  Processed {len(submissions)} submissions")

    return {
        'positions': positions,
        'transitions': transitions,
        'submissions': submissions,
        'meta': {
            'generated': True,
            'positionCount': len(positions),
            'transitionCount': len(transitions),
            'submissionCount': len(submissions)
        }
    }


def main():
    """Main entry point."""
    # Determine project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    # Generate state graph
    state_graph = generate_state_graph(project_root)

    # Create output directory if needed
    output_dir = project_root / 'source' / 'quartz' / 'static'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write output
    output_file = output_dir / 'stateGraph.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(state_graph, f, indent=2, ensure_ascii=False)

    print(f"\nGenerated: {output_file}")
    print(f"  Total positions: {len(state_graph['positions'])}")
    print(f"  Total transitions: {len(state_graph['transitions'])}")
    print(f"  Total submissions: {len(state_graph['submissions'])}")


if __name__ == '__main__':
    main()
