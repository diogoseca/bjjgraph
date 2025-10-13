#!/usr/bin/env python3
"""
Script to add HowTo and FAQ Schema markup to Position pages.
Generates JSON-LD structured data for enhanced search appearance.
"""

import os
import re
import json
from pathlib import Path

def extract_offensive_transitions(content):
    """Extract offensive transitions for HowTo steps."""
    steps = []

    # Find the Offensive Transitions section
    section_match = re.search(r'## Offensive Transitions \(Available From This State\)(.*?)(?=##|$)', content, re.DOTALL)
    if section_match:
        section_text = section_match.group(1)

        # Extract individual transitions
        transitions = re.findall(r'- \[\[(.+?)\]\] → \[\[(.+?)\]\]', section_text)

        for i, (technique, result) in enumerate(transitions[:6]):  # Limit to 6 steps
            steps.append({
                "@type": "HowToStep",
                "name": f"Execute {technique}",
                "text": f"From this position, execute {technique} to transition to {result}.",
                "position": i + 1
            })

    return steps

def extract_common_errors(content):
    """Extract common errors for FAQ schema."""
    faqs = []

    # Find the Common Errors section
    section_match = re.search(r'## Common Errors(.*?)(?=##|$)', content, re.DOTALL)
    if section_match:
        section_text = section_match.group(1)

        # Extract error blocks
        error_blocks = re.findall(
            r'- \*\*Error\*\*: (.+?)\s*- \*\*Consequence\*\*: (.+?)\s*- \*\*Correction\*\*: (.+?)(?=\n- \*\*Error\*\*:|$)',
            section_text,
            re.DOTALL
        )

        for error, consequence, correction in error_blocks[:5]:  # Limit to 5 FAQs
            question = f"What is a common mistake in {error.strip()}?"
            answer = f"{consequence.strip()} The correction is: {correction.strip()}"

            faqs.append({
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": answer
                }
            })

    return faqs

def extract_position_name(content):
    """Extract position name from content."""
    # Try frontmatter first
    title_match = re.search(r'^title:\s*["\'](.+?)\s*\|', content, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()

    # Fallback to heading
    heading_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()

    return None

def generate_howto_schema(position_name, steps):
    """Generate HowTo schema JSON-LD."""
    if not steps:
        return None

    schema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": f"How to Use {position_name} in BJJ",
        "description": f"Complete guide to executing techniques and transitions from {position_name}.",
        "step": steps,
        "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"],
        "totalTime": "PT5M"
    }

    return schema

def generate_faq_schema(faqs):
    """Generate FAQ schema JSON-LD."""
    if not faqs:
        return None

    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs
    }

    return schema

def schema_to_html(schema):
    """Convert schema dict to HTML script tag."""
    json_str = json.dumps(schema, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def add_schema_to_content(content, position_name, steps, faqs):
    """Add schema markup to content."""
    schema_html = "\n\n<!-- Schema Markup for SEO -->\n"

    # Add HowTo schema
    howto_schema = generate_howto_schema(position_name, steps)
    if howto_schema:
        schema_html += schema_to_html(howto_schema) + "\n\n"

    # Add FAQ schema
    faq_schema = generate_faq_schema(faqs)
    if faq_schema:
        schema_html += schema_to_html(faq_schema) + "\n"

    # Insert schema before first heading (after frontmatter)
    # Find the position after frontmatter
    frontmatter_end = content.find('---\n', 4)  # Skip first ---
    if frontmatter_end != -1:
        # Insert after frontmatter
        insert_pos = frontmatter_end + 4
        new_content = content[:insert_pos] + "\n" + schema_html + content[insert_pos:]
    else:
        # No frontmatter, insert at beginning
        new_content = schema_html + "\n" + content

    return new_content

def has_schema_markup(content):
    """Check if file already has schema markup."""
    return 'type="application/ld+json"' in content or '@context' in content

def process_position_file(filepath):
    """Process a single position file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has schema
    if has_schema_markup(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has schema)")
        return False

    # Extract position name
    position_name = extract_position_name(content)
    if not position_name:
        print(f"  ⚠️  Warning: Could not extract position name from {filepath.name}")
        return False

    # Extract data for schemas
    steps = extract_offensive_transitions(content)
    faqs = extract_common_errors(content)

    if not steps and not faqs:
        print(f"  ⚠️  Warning: No schema data found in {filepath.name}")
        return False

    # Add schema to content
    new_content = add_schema_to_content(content, position_name, steps, faqs)

    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ✅ Updated {filepath.name}")
    print(f"     Added HowTo with {len(steps)} steps, FAQ with {len(faqs)} questions")

    return True

def main():
    """Main function to process all position files."""
    # Get the positions directory
    script_dir = Path(__file__).parent
    positions_dir = script_dir.parent / 'source' / 'content' / 'Positions'

    if not positions_dir.exists():
        print(f"Error: Positions directory not found at {positions_dir}")
        return

    print(f"Processing Position files for Schema markup in: {positions_dir}\n")

    # Get all markdown files except the standard
    position_files = sorted([f for f in positions_dir.glob('*.md') if f.name != '000.STANDARD.md'])

    print(f"Found {len(position_files)} position files\n")

    updated_count = 0
    skipped_count = 0

    for filepath in position_files:
        if process_position_file(filepath):
            updated_count += 1
        else:
            skipped_count += 1

    print(f"\n{'='*60}")
    print(f"Schema Markup Summary:")
    print(f"  Total files: {len(position_files)}")
    print(f"  Updated with schema: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
