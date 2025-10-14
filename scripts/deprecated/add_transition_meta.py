#!/usr/bin/env python3
"""
Script to add YAML frontmatter with SEO meta descriptions and titles to Transition pages.
Extracts success rates and states from existing content and generates optimized metadata.
"""

import os
import re
from pathlib import Path

def extract_transition_data(content):
    """Extract transition data from content."""
    data = {
        'starting_state': None,
        'ending_state': None,
        'beginner': None,
        'intermediate': None,
        'advanced': None
    }

    # Extract starting and ending states
    starting_match = re.search(r'\*\*Starting State\*\*:\s*\[\[([\w\s]+)\]\]', content)
    if starting_match:
        data['starting_state'] = starting_match.group(1).strip()

    ending_match = re.search(r'\*\*Ending State\*\*:\s*\[\[([\w\s,]+)\]\]', content)
    if ending_match:
        # Take first ending state if multiple are listed
        endings = ending_match.group(1).split(',')
        data['ending_state'] = endings[0].strip()

    # Extract success probabilities
    success_match = re.search(r'\*\*Success Probability\*\*:\s*Beginner\s*(\d+)%.*?Intermediate\s*(\d+)%.*?Advanced\s*(\d+)%', content, re.IGNORECASE)
    if success_match:
        data['beginner'] = success_match.group(1)
        data['intermediate'] = success_match.group(2)
        data['advanced'] = success_match.group(3)

    return data

def generate_meta_description(transition_name, data):
    """Generate SEO-optimized meta description."""
    # Base template
    desc = f"Learn {transition_name} in BJJ. Step-by-step execution"

    # Add from/to states if available
    if data['starting_state'] and data['ending_state']:
        desc += f" from {data['starting_state']} to {data['ending_state']}."
    else:
        desc += "."

    # Add success rates
    if data['beginner'] and data['intermediate'] and data['advanced']:
        desc += f" Success: Beginner {data['beginner']}%, Intermediate {data['intermediate']}%, Advanced {data['advanced']}%."
    else:
        desc += " Complete technique guide with expert insights."

    # Ensure under 160 characters for optimal SEO
    if len(desc) > 160:
        # Try shorter version
        desc = f"Learn {transition_name} in BJJ"
        if data['starting_state'] and data['ending_state']:
            desc += f" from {data['starting_state']} to {data['ending_state']}"
        if data['beginner']:
            desc += f". Success: {data['beginner']}/{data['intermediate']}/{data['advanced']}%"
        else:
            desc += ". Complete technique guide."

        if len(desc) > 160:
            desc = desc[:157] + "..."

    return desc

def generate_title(transition_name):
    """Generate SEO-optimized title tag."""
    title = f"{transition_name} | BJJ Technique | BJJ Graph"

    # Ensure under 60 characters
    if len(title) > 60:
        # Try shorter version
        title = f"{transition_name} | BJJ Graph"
        if len(title) > 60:
            # Truncate transition name if still too long
            max_name_length = 60 - len(" | BJJ Graph")
            title = f"{transition_name[:max_name_length]} | BJJ Graph"

    return title

def has_frontmatter(content):
    """Check if file already has YAML frontmatter."""
    return content.strip().startswith('---')

def process_transition_file(filepath):
    """Process a single transition file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has frontmatter
    if has_frontmatter(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has frontmatter)")
        return False

    # Extract transition name from first # heading
    name_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if not name_match:
        print(f"  ⚠️  Warning: Could not extract transition name from {filepath.name}")
        return False

    transition_name = name_match.group(1).strip()

    # Extract transition data
    data = extract_transition_data(content)

    # Generate metadata
    title = generate_title(transition_name)
    description = generate_meta_description(transition_name, data)

    # Create frontmatter
    frontmatter = f"""---
title: "{title}"
description: "{description}"
---

"""

    # Add frontmatter to content
    new_content = frontmatter + content

    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ✅ Updated {filepath.name}")
    print(f"     Title: {title}")
    print(f"     Desc: {description[:80]}...")

    return True

def main():
    """Main function to process all transition files."""
    # Get the transitions directory
    script_dir = Path(__file__).parent
    transitions_dir = script_dir.parent / 'source' / 'content' / 'Transitions'

    if not transitions_dir.exists():
        print(f"Error: Transitions directory not found at {transitions_dir}")
        return

    print(f"Processing Transition files in: {transitions_dir}\n")

    # Get all markdown files except the standard
    transition_files = sorted([f for f in transitions_dir.glob('*.md') if f.name != '000.STANDARD.md'])

    print(f"Found {len(transition_files)} transition files\n")

    updated_count = 0
    skipped_count = 0

    for filepath in transition_files:
        if process_transition_file(filepath):
            updated_count += 1
        else:
            skipped_count += 1

    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Total files: {len(transition_files)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
