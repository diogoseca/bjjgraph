#!/usr/bin/env python3
"""
Script to add HowTo Schema markup to Transition pages.
Generates JSON-LD structured data for enhanced search appearance.
"""

import os
import re
import json
from pathlib import Path

def extract_execution_steps(content):
    """Extract execution steps for HowTo schema."""
    steps = []

    # Find the Execution Steps section
    section_match = re.search(r'### Execution Steps \(Numbered Sequence\)(.*?)(?=###|##|$)', content, re.DOTALL)
    if section_match:
        section_text = section_match.group(1)

        # Extract numbered steps
        step_matches = re.findall(r'\d+\.\s*\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|$)', section_text, re.DOTALL)

        for i, (step_name, step_text) in enumerate(step_matches):
            steps.append({
                "@type": "HowToStep",
                "name": step_name.strip(),
                "text": step_text.strip().replace('\n', ' ')[:200],  # Limit text length
                "position": i + 1
            })

    return steps

def extract_transition_name(content):
    """Extract transition name from content."""
    # Try frontmatter first
    title_match = re.search(r'^title:\s*["\'](.+?)\s*\|', content, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()

    # Fallback to heading
    heading_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()

    return None

def extract_states(content):
    """Extract starting and ending states."""
    states = {'starting': None, 'ending': None}

    # Extract starting state
    starting_match = re.search(r'\*\*Starting State\*\*:\s*\[\[([\w\s]+)\]\]', content)
    if starting_match:
        states['starting'] = starting_match.group(1).strip()

    # Extract ending state
    ending_match = re.search(r'\*\*Ending State\*\*:\s*\[\[([\w\s,]+)\]\]', content)
    if ending_match:
        endings = ending_match.group(1).split(',')
        states['ending'] = endings[0].strip()

    return states

def extract_success_probability(content):
    """Extract success probability."""
    success_match = re.search(r'\*\*Success Probability\*\*:\s*Beginner\s*(\d+)%.*?Intermediate\s*(\d+)%.*?Advanced\s*(\d+)%', content, re.IGNORECASE)
    if success_match:
        return {
            'beginner': success_match.group(1),
            'intermediate': success_match.group(2),
            'advanced': success_match.group(3)
        }
    return None

def generate_howto_schema(transition_name, steps, states, probability):
    """Generate HowTo schema JSON-LD."""
    if not steps:
        return None

    description = f"Learn how to execute {transition_name} in Brazilian Jiu-Jitsu"
    if states['starting'] and states['ending']:
        description += f" from {states['starting']} to {states['ending']}"
    description += "."

    schema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": transition_name,
        "description": description,
        "step": steps,
        "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"]
    }

    # Add estimated time based on complexity
    if len(steps) <= 3:
        schema["totalTime"] = "PT2M"
    elif len(steps) <= 5:
        schema["totalTime"] = "PT3M"
    else:
        schema["totalTime"] = "PT5M"

    return schema

def schema_to_html(schema):
    """Convert schema dict to HTML script tag."""
    json_str = json.dumps(schema, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def add_schema_to_content(content, schema):
    """Add schema markup to content."""
    schema_html = "\n\n<!-- Schema Markup for SEO -->\n"
    schema_html += schema_to_html(schema) + "\n"

    # Insert schema before first heading (after frontmatter)
    frontmatter_end = content.find('---\n', 4)  # Skip first ---
    if frontmatter_end != -1:
        insert_pos = frontmatter_end + 4
        new_content = content[:insert_pos] + "\n" + schema_html + content[insert_pos:]
    else:
        new_content = schema_html + "\n" + content

    return new_content

def has_schema_markup(content):
    """Check if file already has schema markup."""
    return 'type="application/ld+json"' in content or '@context' in content

def process_transition_file(filepath):
    """Process a single transition file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has schema
    if has_schema_markup(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has schema)")
        return False

    # Extract transition name
    transition_name = extract_transition_name(content)
    if not transition_name:
        print(f"  ⚠️  Warning: Could not extract transition name from {filepath.name}")
        return False

    # Extract data for schema
    steps = extract_execution_steps(content)
    states = extract_states(content)
    probability = extract_success_probability(content)

    if not steps:
        print(f"  ⚠️  Warning: No execution steps found in {filepath.name}")
        return False

    # Generate schema
    schema = generate_howto_schema(transition_name, steps, states, probability)
    if not schema:
        return False

    # Add schema to content
    new_content = add_schema_to_content(content, schema)

    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ✅ Updated {filepath.name}")
    print(f"     Added HowTo with {len(steps)} steps")

    return True

def main():
    """Main function to process all transition files."""
    script_dir = Path(__file__).parent
    transitions_dir = script_dir.parent / 'source' / 'content' / 'Transitions'

    if not transitions_dir.exists():
        print(f"Error: Transitions directory not found at {transitions_dir}")
        return

    print(f"Processing Transition files for Schema markup in: {transitions_dir}\n")

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
    print(f"Schema Markup Summary:")
    print(f"  Total files: {len(transition_files)}")
    print(f"  Updated with schema: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
