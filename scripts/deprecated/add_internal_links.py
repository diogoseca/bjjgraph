#!/usr/bin/env python3
"""
Script to add intelligent internal links to Position and Transition pages.
Creates 3-5 related links based on position type, point value, and transitions.
"""

import os
import re
from pathlib import Path
from collections import defaultdict

class ContentAnalyzer:
    def __init__(self, positions_dir, transitions_dir):
        self.positions_dir = positions_dir
        self.transitions_dir = transitions_dir
        self.positions = {}
        self.transitions = {}

    def analyze_position(self, filepath):
        """Extract metadata from a position file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        data = {
            'name': filepath.stem,
            'filepath': filepath,
            'point_value': None,
            'position_type': None,
            'offensive_transitions': [],
            'related_states': []
        }

        # Extract point value
        point_match = re.search(r'\*\*Point Value\*\*:\s*(\d+)', content)
        if point_match:
            data['point_value'] = int(point_match.group(1))

        # Extract position type
        type_match = re.search(r'\*\*Position Type\*\*:\s*([^\n]+)', content)
        if type_match:
            data['position_type'] = type_match.group(1).strip()

        # Extract offensive transitions
        transitions_section = re.search(r'## Offensive Transitions.*?(?=##|$)', content, re.DOTALL)
        if transitions_section:
            transitions = re.findall(r'\[\[(.+?)\]\]', transitions_section.group(0))
            data['offensive_transitions'] = transitions[:10]  # Limit to 10

        # Extract existing related states
        related_section = re.search(r'## Related States(.*?)(?=##|$)', content, re.DOTALL)
        if related_section:
            related = re.findall(r'\[\[(.+?)\]\]', related_section.group(0))
            data['related_states'] = related

        return data

    def analyze_transition(self, filepath):
        """Extract metadata from a transition file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        data = {
            'name': filepath.stem,
            'filepath': filepath,
            'starting_state': None,
            'ending_state': None,
            'transition_type': None
        }

        # Extract starting state
        start_match = re.search(r'\*\*Starting State\*\*:\s*\[\[(.+?)\]\]', content)
        if start_match:
            data['starting_state'] = start_match.group(1).strip()

        # Extract ending state
        end_match = re.search(r'\*\*Ending State\*\*:\s*\[\[(.+?)(?:\]\]|,)', content)
        if end_match:
            data['ending_state'] = end_match.group(1).strip()

        # Extract transition type
        type_match = re.search(r'\*\*Transition Type\*\*:\s*([^\n]+)', content)
        if type_match:
            data['transition_type'] = type_match.group(1).strip()

        return data

    def load_all(self):
        """Load all positions and transitions."""
        print("Analyzing all Position and Transition files...")

        # Load positions
        for filepath in self.positions_dir.glob('*.md'):
            if filepath.name == '000.STANDARD.md':
                continue
            try:
                data = self.analyze_position(filepath)
                self.positions[data['name']] = data
            except Exception as e:
                print(f"  ⚠️  Error analyzing {filepath.name}: {e}")

        # Load transitions
        for filepath in self.transitions_dir.glob('*.md'):
            if filepath.name == '000.STANDARD.md':
                continue
            try:
                data = self.analyze_transition(filepath)
                self.transitions[data['name']] = data
            except Exception as e:
                print(f"  ⚠️  Error analyzing {filepath.name}: {e}")

        print(f"  Loaded {len(self.positions)} positions and {len(self.transitions)} transitions\n")

def find_related_positions(position_data, all_positions, max_links=5):
    """Find related positions based on similarity."""
    related = []
    scores = []

    for name, other in all_positions.items():
        if name == position_data['name']:
            continue

        score = 0

        # Same point value (high score)
        if position_data['point_value'] == other['point_value'] and position_data['point_value'] is not None:
            score += 3

        # Similar position type
        if position_data['position_type'] and other['position_type']:
            type1 = position_data['position_type'].lower()
            type2 = other['position_type'].lower()
            if 'offensive' in type1 and 'offensive' in type2:
                score += 2
            if 'defensive' in type1 and 'defensive' in type2:
                score += 2
            if 'guard' in type1 and 'guard' in type2:
                score += 2

        # Already listed in Related States
        if name in position_data['related_states']:
            score += 5  # Prioritize existing relationships

        # Connected by offensive transitions
        for trans in position_data['offensive_transitions']:
            if name in trans:
                score += 4

        # Name similarity (guard variations, mount variations, etc.)
        name1_words = set(position_data['name'].lower().split())
        name2_words = set(name.lower().split())
        common_words = name1_words & name2_words
        if common_words - {'position', 'control', 'guard', 'bottom', 'top'}:
            score += 2

        if score > 0:
            related.append((name, score))
            scores.append(score)

    # Sort by score and return top results
    related.sort(key=lambda x: x[1], reverse=True)
    return [name for name, score in related[:max_links]]

def find_related_transitions(transition_data, all_transitions, max_links=4):
    """Find related transitions."""
    related = []

    for name, other in all_transitions.items():
        if name == transition_data['name']:
            continue

        score = 0

        # Same starting state
        if transition_data['starting_state'] == other['starting_state'] and transition_data['starting_state']:
            score += 5

        # Same ending state
        if transition_data['ending_state'] == other['ending_state'] and transition_data['ending_state']:
            score += 3

        # Same transition type
        if transition_data['transition_type'] and other['transition_type']:
            if transition_data['transition_type'] == other['transition_type']:
                score += 2

        # Name similarity
        name1_words = set(transition_data['name'].lower().split())
        name2_words = set(name.lower().split())
        common_words = name1_words & name2_words
        if common_words - {'to', 'from', 'transition'}:
            score += 1

        if score > 0:
            related.append((name, score))

    related.sort(key=lambda x: x[1], reverse=True)
    return [name for name, score in related[:max_links]]

def add_related_positions_section(content, related_positions):
    """Add or update Related Positions section."""
    # Check if section already exists
    if '## Related Positions' in content:
        # Update existing section
        pattern = r'(## Related Positions)(.*?)(?=\n##|\Z)'

        new_section = "## Related Positions\n\n"
        for pos in related_positions:
            new_section += f"- [[{pos}]] - Related position\n"
        new_section += "\n"

        content = re.sub(pattern, new_section, content, flags=re.DOTALL)
    else:
        # Add new section before Decision Tree or at end
        if '## Decision Tree' in content:
            insert_pos = content.find('## Decision Tree')
        elif '## Position Metrics' in content:
            insert_pos = content.find('## Position Metrics')
        else:
            insert_pos = len(content)

        new_section = "\n## Related Positions\n\n"
        for pos in related_positions:
            new_section += f"- [[{pos}]] - Related position\n"
        new_section += "\n"

        content = content[:insert_pos] + new_section + content[insert_pos:]

    return content

def add_related_transitions_section(content, related_transitions):
    """Add or update Related Techniques section."""
    if '## Related Techniques' in content:
        pattern = r'(## Related Techniques)(.*?)(?=\n##|\Z)'

        new_section = "## Related Techniques\n\n"
        for trans in related_transitions:
            new_section += f"- [[{trans}]] - Related technique\n"
        new_section += "\n"

        content = re.sub(pattern, new_section, content, flags=re.DOTALL)
    else:
        # Add near the end
        if '## Competition Applications' in content:
            insert_pos = content.find('## Competition Applications')
        elif '## Historical Context' in content:
            insert_pos = content.find('## Historical Context')
        else:
            insert_pos = len(content)

        new_section = "\n## Related Techniques\n\n"
        for trans in related_transitions:
            new_section += f"- [[{trans}]] - Related technique\n"
        new_section += "\n"

        content = content[:insert_pos] + new_section + content[insert_pos:]

    return content

def process_positions(analyzer):
    """Add internal links to all position files."""
    print("Adding internal links to Position pages...\n")

    updated = 0

    for name, data in analyzer.positions.items():
        related = find_related_positions(data, analyzer.positions, max_links=5)

        if not related:
            continue

        with open(data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = add_related_positions_section(content, related)

        if new_content != content:
            with open(data['filepath'], 'w', encoding='utf-8') as f:
                f.write(new_content)

            print(f"  ✅ {data['filepath'].name}: Added {len(related)} related links")
            updated += 1

    print(f"\n  Updated {updated} Position pages with internal links\n")
    return updated

def process_transitions(analyzer):
    """Add internal links to all transition files."""
    print("Adding internal links to Transition pages...\n")

    updated = 0

    for name, data in analyzer.transitions.items():
        related = find_related_transitions(data, analyzer.transitions, max_links=4)

        if not related:
            continue

        with open(data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = add_related_transitions_section(content, related)

        if new_content != content:
            with open(data['filepath'], 'w', encoding='utf-8') as f:
                f.write(new_content)

            print(f"  ✅ {data['filepath'].name}: Added {len(related)} related links")
            updated += 1

    print(f"\n  Updated {updated} Transition pages with internal links\n")
    return updated

def main():
    """Main function."""
    script_dir = Path(__file__).parent
    positions_dir = script_dir.parent / 'source' / 'content' / 'Positions'
    transitions_dir = script_dir.parent / 'source' / 'content' / 'Transitions'

    if not positions_dir.exists() or not transitions_dir.exists():
        print("Error: Content directories not found")
        return

    print("="*60)
    print("Internal Linking Script")
    print("="*60 + "\n")

    # Analyze all content
    analyzer = ContentAnalyzer(positions_dir, transitions_dir)
    analyzer.load_all()

    # Process positions
    pos_updated = process_positions(analyzer)

    # Process transitions
    trans_updated = process_transitions(analyzer)

    print("="*60)
    print("Summary:")
    print(f"  Position pages updated: {pos_updated}")
    print(f"  Transition pages updated: {trans_updated}")
    print(f"  Total pages updated: {pos_updated + trans_updated}")
    print("="*60)

if __name__ == '__main__':
    main()
