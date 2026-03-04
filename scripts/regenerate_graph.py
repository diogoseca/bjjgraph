#!/usr/bin/env python3
"""
Generate graph.json for the BJJGraph state machine game.

Parses position, transition, and submission JSON files and generates a unified
state graph for the frontend game mechanics and graph visualization.

Usage:
    python scripts/regenerate_graph.py              # default: warnings only
    python scripts/regenerate_graph.py --verbose    # print every missing/orphan node
    python scripts/regenerate_graph.py --strict     # exit non-zero on missing nodes

Output: graph.json
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


# Neutral positions don't have top/bottom roles
NEUTRAL_POSITIONS = {
    'game-over'
}

TERMINAL_POSITIONS = {'game-over'}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(name: str) -> str:
    """Convert a name to a URL-friendly slug matching Quartz's behavior."""
    slug = name.lower().strip()
    slug = slug.replace('%', ' percent ')
    slug = slug.replace('&', ' and ')
    slug = slug.replace("'", '')
    slug = slug.replace('"', '')
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def load_json_files(directory: Path) -> list[dict]:
    """Load all JSON files from a directory recursively."""
    files = []
    if not directory.exists():
        return files

    for json_file in directory.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    continue
                if '$schema' in data and 'title' in data and 'properties' in data:
                    continue
                data['_source_file'] = str(json_file)
                files.append(data)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load {json_file}: {e}")

    return files


def build_position_path_index(positions_dir: Path) -> dict[str, str]:
    """Map position slugs to their relative file paths (for URL construction)."""
    index = {}
    for json_file in positions_dir.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, dict):
                continue
            if '$schema' in data and 'title' in data and 'properties' in data:
                continue
            name = data.get('name', '')
            if not name:
                continue
            slug = slugify(data.get('slug', name))
            rel_path = json_file.relative_to(positions_dir)
            path_slug = str(rel_path.with_suffix('')).lower().replace(' ', '-').replace('\\', '/')
            index[slug] = path_slug
        except (json.JSONDecodeError, IOError):
            continue
    return index


def is_neutral_position(slug: str) -> bool:
    base_slug = slug.split('/')[0] if '/' in slug else slug
    return base_slug in NEUTRAL_POSITIONS


def is_terminal_position(slug: str) -> bool:
    return slug in TERMINAL_POSITIONS or slug == 'game-over'


# ---------------------------------------------------------------------------
# Position processing
# ---------------------------------------------------------------------------

def process_position_role(position_data: dict, role: str, hub_slug: str, hub_path: str, path_index: dict) -> dict | None:
    role_data = position_data.get(role)
    if not role_data:
        return None

    slug = f"{hub_slug}/{role}"
    full_path = f"{hub_path}/{role.title()}"
    name = role_data.get('name', f"{position_data.get('name', 'Unknown')} {role.title()}")

    transitions = []
    for t in role_data.get('transitions', []):
        technique_name = t.get('transition', 'Unknown Technique')
        attempt_prob = t.get('attempt_probability', 0)
        technique_slug = slugify(technique_name)

        transitions.append({
            'technique': technique_name,
            'target': technique_slug,
            'targetPath': technique_slug,
            'isSubmission': False,
            'attemptProbability': attempt_prob
        })

    state_props = role_data.get('state_properties', {})

    ka_source = role_data.get('knowledge_assessment', [])
    knowledge_assessment = [
        {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
        for qa in ka_source
    ]

    return {
        'name': name,
        'hub': hub_slug,
        'role': role,
        'path': full_path,
        'pointValue': state_props.get('point_value', 0),
        'positionType': state_props.get('position_type', 'Neutral'),
        'riskLevel': state_props.get('risk_level', 'Medium'),
        'energyCost': state_props.get('energy_cost', 'Medium'),
        'transitions': transitions,
        'knowledgeAssessment': knowledge_assessment
    }


def process_positions(content_dir: Path) -> dict:
    positions_dir = content_dir / 'Positions'
    position_files = load_json_files(positions_dir)
    path_index = build_position_path_index(positions_dir)
    positions = {}

    for pos_data in position_files:
        if 'name' not in pos_data:
            continue

        hub_slug = slugify(pos_data.get('slug', pos_data['name']))

        source_file = pos_data.get('_source_file', '')
        if source_file:
            rel_path = Path(source_file).relative_to(positions_dir)
            hub_path = str(rel_path.with_suffix('')).replace('\\', '/')
        else:
            hub_path = hub_slug

        # Skip terminal positions from having role pages
        if is_terminal_position(hub_slug):
            state_props = pos_data.get('state_properties', {})
            positions[hub_slug] = {
                'name': pos_data['name'],
                'hub': hub_slug,
                'role': 'terminal',
                'path': hub_path,
                'pointValue': state_props.get('point_value', 0),
                'positionType': state_props.get('position_type', 'Terminal'),
                'riskLevel': state_props.get('risk_level', 'None'),
                'energyCost': state_props.get('energy_cost', 'None'),
                'transitions': []
            }
            continue

        top = process_position_role(pos_data, 'top', hub_slug, hub_path, path_index)
        if top:
            positions[f"{hub_slug}/top"] = top

        bottom = process_position_role(pos_data, 'bottom', hub_slug, hub_path, path_index)
        if bottom:
            positions[f"{hub_slug}/bottom"] = bottom

        # Neutral positions (no top/bottom - SINGLE template)
        if not top and not bottom:
            transitions = []
            for t in pos_data.get('transitions', []):
                technique_name = t.get('transition', 'Unknown')
                attempt_prob = t.get('attempt_probability', 0)
                technique_slug = slugify(technique_name)

                transitions.append({
                    'technique': technique_name,
                    'target': technique_slug,
                    'targetPath': technique_slug,
                    'isSubmission': False,
                    'attemptProbability': attempt_prob
                })

            if transitions:
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
                    'transitions': transitions
                }

    return positions


# ---------------------------------------------------------------------------
# Transition processing
# ---------------------------------------------------------------------------

def process_transitions(content_dir: Path) -> dict:
    transitions_dir = content_dir / 'Transitions'
    positions_dir = content_dir / 'Positions'
    transition_files = load_json_files(transitions_dir)
    path_index = build_position_path_index(positions_dir)
    transitions = {}

    for trans_data in transition_files:
        if 'name' not in trans_data:
            continue

        slug = slugify(trans_data['name'])

        # Support both flat and attacker/defender structures
        attacker = trans_data.get('attacker', {})
        ka_source = attacker.get('knowledge_assessment', trans_data.get('knowledge_assessment', []))
        knowledge_assessment = [
            {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
            for qa in ka_source
        ]

        effectiveness_map = {'High': 70, 'Medium': 50, 'Low': 30}
        cc_source = attacker.get('common_counters', trans_data.get('common_counters', []))
        common_counters = [
            {
                'technique': c.get('counter', 'Defense'),
                'effectiveness': effectiveness_map.get(c.get('effectiveness', 'Medium'), 50),
                'resultPosition': slugify(trans_data.get('starting_position', ''))
            }
            for c in cc_source
        ]

        success_rate = trans_data.get('success_rate', 50)

        ending_pos = trans_data.get('ending_position', '')
        ending_slug = slugify(ending_pos)
        ending_path = path_index.get(ending_slug, ending_slug)

        if ending_slug and not is_neutral_position(ending_slug) and not is_terminal_position(ending_slug):
            ending_slug = f"{ending_slug}/top"

        transitions[slug] = {
            'name': trans_data['name'],
            'startingPosition': slugify(trans_data.get('starting_position', '')),
            'endingPosition': ending_slug,
            'endingPositionPath': ending_path,
            'successRate': success_rate,
            'knowledgeAssessment': knowledge_assessment,
            'commonCounters': common_counters
        }

    return transitions


# ---------------------------------------------------------------------------
# Submission processing
# ---------------------------------------------------------------------------

def process_submissions(content_dir: Path) -> dict:
    submissions_dir = content_dir / 'Submissions'
    submission_files = load_json_files(submissions_dir)
    submissions = {}

    for sub_data in submission_files:
        if 'name' not in sub_data:
            continue

        slug = slugify(sub_data['name'])

        # Support both flat and attacker/defender structures
        attacker = sub_data.get('attacker', {})
        ka_source = attacker.get('knowledge_assessment', sub_data.get('knowledge_assessment', []))
        knowledge_assessment = [
            {
                'question': qa.get('question', ''),
                'answer': qa.get('answer', ''),
                'safetyCritical': qa.get('safety_critical', False)
            }
            for qa in ka_source
        ]

        from_positions = [slugify(p) for p in sub_data.get('from_positions', [])]
        success_rate = sub_data.get('success_rate', 50)

        # Determine starting position: prefer from_position (split on "/" to get position part),
        # fall back to starting_position
        from_position_raw = sub_data.get('from_position', '')
        if from_position_raw:
            starting_pos_name = from_position_raw.split('/')[0]
            starting_position_slug = slugify(starting_pos_name)
            from_position_slug = slugify(from_position_raw.replace('/', '-'))
        else:
            starting_position_slug = slugify(sub_data.get('starting_position', ''))
            from_position_slug = ''

        sub_entry = {
            'name': sub_data['name'],
            'isTerminal': True,
            'category': sub_data.get('submission_category', 'Unknown'),
            'type': sub_data.get('submission_type', 'Unknown'),
            'targetArea': sub_data.get('target_area', 'Unknown'),
            'startingPosition': starting_position_slug,
            'fromPositions': from_positions,
            'successRate': success_rate,
            'knowledgeAssessment': knowledge_assessment
        }

        # Add from_position and outcomes if present (graph edge data)
        if from_position_raw:
            sub_entry['fromPosition'] = from_position_slug

        outcomes_raw = sub_data.get('outcomes', [])
        if outcomes_raw:
            sub_entry['outcomes'] = [
                {
                    'to': slugify(o.get('to', '')),
                    'probability': o.get('probability', 0),
                    'result': o.get('result', 'success')
                }
                for o in outcomes_raw
            ]

        submissions[slug] = sub_entry

    return submissions


# ---------------------------------------------------------------------------
# Graph validation
# ---------------------------------------------------------------------------

def validate_graph(graph: dict, *, verbose: bool = False) -> dict:
    """
    Validate graph integrity. Returns a report dict with:
      - missing_positions: targets referenced but not defined
      - orphan_positions: defined but never targeted by any transition/defense
      - missing_transitions: transition techniques referenced but not in transitions dict
    """
    positions = graph['positions']
    transitions = graph['transitions']
    submissions = graph['submissions']

    defined_positions = set(positions.keys())
    defined_transitions = set(transitions.keys())
    defined_submissions = set(submissions.keys())

    referenced_positions: set[str] = set()
    referenced_from: dict[str, list[str]] = {}  # target -> list of sources

    def track_ref(target_slug: str, source: str):
        if not target_slug:
            return
        referenced_positions.add(target_slug)
        referenced_from.setdefault(target_slug, []).append(source)

    # Collect all position targets from position transitions
    for pos_key, pos_data in positions.items():
        for t in pos_data.get('transitions', []):
            target = t.get('target', '')
            if target and not t.get('isSubmission', False):
                track_ref(target, f"position:{pos_key} -> transition:{t.get('technique', '?')}")

    # Collect targets from transition outcomes
    for t_key, t_data in transitions.items():
        ending = t_data.get('endingPosition', '')
        if ending:
            track_ref(ending, f"transition:{t_key}")

    # Compute sets — position transitions reference technique slugs
    # (transitions/submissions), not just position slugs, so exclude those
    all_known = defined_positions | defined_transitions | defined_submissions | TERMINAL_POSITIONS
    missing_positions = referenced_positions - all_known
    orphan_positions = defined_positions - referenced_positions - TERMINAL_POSITIONS

    # Ignore empty-string references
    missing_positions.discard('')

    report = {
        'missing_positions': sorted(missing_positions),
        'orphan_positions': sorted(orphan_positions),
        'missing_count': len(missing_positions),
        'orphan_count': len(orphan_positions),
    }

    # Print summary
    if missing_positions:
        print(f"\n  WARNING: {len(missing_positions)} missing position(s) (referenced but not defined)")
        if verbose:
            for slug in sorted(missing_positions):
                sources = referenced_from.get(slug, [])
                print(f"    - {slug}")
                for src in sources[:3]:
                    print(f"        referenced by: {src}")
                if len(sources) > 3:
                    print(f"        ... and {len(sources) - 3} more")

    if orphan_positions:
        print(f"  INFO: {len(orphan_positions)} orphan position(s) (defined but never targeted)")
        if verbose:
            for slug in sorted(orphan_positions):
                print(f"    - {slug}")

    if not missing_positions and not orphan_positions:
        print("\n  Graph integrity: OK (no missing or orphan nodes)")

    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_votes(project_root: Path) -> dict[str, float]:
    """Load community vote rates from templates/votes.json if it exists."""
    votes_file = project_root / 'templates' / 'votes.json'
    if not votes_file.exists():
        return {}
    try:
        with open(votes_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {
            name: entry['success_rate']
            for name, entry in data.get('votes', {}).items()
            if 'success_rate' in entry
        }
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load votes.json: {e}")
        return {}


def generate_state_graph(project_root: Path) -> dict:
    content_dir = project_root / 'content'
    print(f"Processing content from: {content_dir}")

    # Load community votes for success rate overrides
    vote_rates = load_votes(project_root)
    if vote_rates:
        print(f"  Loaded {len(vote_rates)} community vote rate(s) from votes.json")

    positions = process_positions(content_dir)
    print(f"  Processed {len(positions)} position roles")

    transitions = process_transitions(content_dir)
    print(f"  Processed {len(transitions)} transitions")

    submissions = process_submissions(content_dir)
    print(f"  Processed {len(submissions)} submissions")

    # Override success rates with community votes
    if vote_rates:
        vote_overrides = 0
        for t_data in transitions.values():
            name = t_data.get('name', '')
            if name in vote_rates:
                t_data['successRate'] = round(vote_rates[name], 1)
                vote_overrides += 1
        for s_data in submissions.values():
            name = s_data.get('name', '')
            if name in vote_rates:
                s_data['successRate'] = round(vote_rates[name], 1)
                vote_overrides += 1
        if vote_overrides:
            print(f"  Applied {vote_overrides} community vote rate override(s)")

    # Mark position transitions that target submissions (Problem 3)
    submission_slugs = set(submissions.keys())
    marked_count = 0
    for pos_data in positions.values():
        for t in pos_data.get('transitions', []):
            if t.get('target', '') in submission_slugs:
                t['isSubmission'] = True
                marked_count += 1
    if marked_count:
        print(f"  Marked {marked_count} position transition(s) as submission targets")

    # Enrich position transitions with successRate from transition/submission data
    enriched = 0
    for pos_data in positions.values():
        for t in pos_data.get('transitions', []):
            target_slug = t.get('target', '')
            if target_slug in transitions:
                t['successRate'] = transitions[target_slug].get('successRate', 50)
            elif target_slug in submission_slugs:
                t['successRate'] = submissions[target_slug].get('successRate', 50)
            else:
                t['successRate'] = 50
            enriched += 1
    print(f"  Enriched {enriched} position transition(s) with successRate")

    all_position_slugs = sorted(positions.keys())

    return {
        'positions': positions,
        'transitions': transitions,
        'submissions': submissions,
        'meta': {
            'generated': datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            'positionCount': len(positions),
            'transitionCount': len(transitions),
            'submissionCount': len(submissions)
        }
    }


def main():
    parser = argparse.ArgumentParser(description='Generate graph.json for BJJGraph')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Print every missing/orphan node')
    parser.add_argument('--strict', action='store_true',
                        help='Exit non-zero if missing nodes are found (for CI)')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    state_graph = generate_state_graph(project_root)

    # Validate graph integrity
    report = validate_graph(state_graph, verbose=args.verbose)

    # Write output
    output_file = project_root / 'graph.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(state_graph, f, indent=2, ensure_ascii=False)

    print(f"\nGenerated: {output_file}")
    print(f"  Positions: {len(state_graph['positions'])}")
    print(f"  Transitions: {len(state_graph['transitions'])}")
    print(f"  Submissions: {len(state_graph['submissions'])}")

    if args.strict and report['missing_count'] > 0:
        print(f"\n  STRICT MODE: {report['missing_count']} missing node(s) found. Exiting with error.")
        sys.exit(1)


if __name__ == '__main__':
    main()
