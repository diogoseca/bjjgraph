#!/usr/bin/env python3
"""
Enhanced script to add HowTo and FAQ Schema markup to Position pages.
Version 2: More flexible pattern matching to handle remaining 27 pages.
Generates JSON-LD structured data for enhanced search appearance.
"""

import os
import re
import json
from pathlib import Path

def extract_offensive_transitions_flexible(content):
    """Extract offensive transitions with flexible pattern matching."""
    steps = []

    # Try multiple section patterns
    section_patterns = [
        r'## Offensive Transitions \(Available From This State\)(.*?)(?=##|$)',
        r'## Offensive Transitions \(Available Actions\)(.*?)(?=##|$)',
        r'## Offensive Transitions(.*?)(?=##|$)',
        r'## Available Transitions(.*?)(?=##|$)',
        r'## Transitions(.*?)(?=##|$)',
    ]

    section_text = None
    for pattern in section_patterns:
        section_match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if section_match:
            section_text = section_match.group(1)
            break

    if not section_text:
        return steps

    # Try different link patterns
    # Pattern 1: [[Technique]] → [[Result]]
    transitions = re.findall(r'- \[\[(.+?)\]\] → \[\[(.+?)\]\]', section_text)

    if not transitions:
        # Pattern 2: [[Technique]] to [[Result]]
        transitions = re.findall(r'- \[\[(.+?)\]\] to \[\[(.+?)\]\]', section_text, re.IGNORECASE)

    if not transitions:
        # Pattern 3: Just technique links without arrows
        techniques = re.findall(r'- \[\[(.+?)\]\]', section_text)
        transitions = [(tech, "Advanced Position") for tech in techniques if tech]

    if not transitions:
        # Pattern 4: Simple bullet points
        bullets = re.findall(r'- (.+?)(?:\n|$)', section_text)
        # Extract first 1-2 words as technique name
        for bullet in bullets[:6]:
            cleaned = re.sub(r'\[\[|\]\]', '', bullet)
            technique = cleaned.split(':')[0].strip() if ':' in cleaned else cleaned.strip()
            if technique and len(technique) < 80:
                transitions.append((technique, "Next Position"))

    # Create steps from transitions
    for i, (technique, result) in enumerate(transitions[:6]):  # Limit to 6 steps
        # Clean up technique and result names
        technique = technique.strip()
        result = result.strip()

        # Skip if technique is too long or empty
        if not technique or len(technique) > 100:
            continue

        steps.append({
            "@type": "HowToStep",
            "name": f"Execute {technique}",
            "text": f"From this position, execute {technique} to transition to {result}.",
            "position": i + 1
        })

    return steps

def extract_common_errors_flexible(content):
    """Extract common errors with flexible pattern matching."""
    faqs = []

    # Try multiple section patterns
    section_patterns = [
        r'## Common Errors(.*?)(?=##|$)',
        r'## Common Mistakes(.*?)(?=##|$)',
        r'## Errors to Avoid(.*?)(?=##|$)',
        r'## Typical Mistakes(.*?)(?=##|$)',
    ]

    section_text = None
    for pattern in section_patterns:
        section_match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if section_match:
            section_text = section_match.group(1)
            break

    if not section_text:
        return faqs

    # Try Pattern 1: Structured format with Error/Consequence/Correction
    error_blocks = re.findall(
        r'- \*\*Error(?:\s+Description)?\*\*: (.+?)\s*\n\s*- \*\*Consequence\*\*: (.+?)\s*\n\s*- \*\*Correction\*\*: (.+?)(?=\n- \*\*Error|\n\n|\Z)',
        section_text,
        re.DOTALL
    )

    if error_blocks:
        for error, consequence, correction in error_blocks[:5]:
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

    # Try Pattern 2: Simple format with Error only
    if not faqs:
        error_simple = re.findall(
            r'- \*\*Error\*\*: (.+?)(?=\n- \*\*Error|\n\n|\Z)',
            section_text,
            re.DOTALL
        )

        for error in error_simple[:5]:
            error_text = error.strip()
            question = f"What is a common mistake regarding {error_text.split(':')[0].strip() if ':' in error_text else 'this position'}?"
            answer = error_text

            faqs.append({
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": answer
                }
            })

    # Try Pattern 3: Arrow format (error → consequence)
    if not faqs:
        arrow_errors = re.findall(
            r'- (.+?) → (.+?)(?=\n-|\n\n|\Z)',
            section_text
        )

        for error, consequence in arrow_errors[:5]:
            question = f"What happens if you make this mistake: {error.strip()}?"
            answer = f"This leads to: {consequence.strip()}"

            faqs.append({
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": answer
                }
            })

    # Try Pattern 4: Simple bullet list
    if not faqs:
        simple_errors = re.findall(
            r'- (.+?)(?=\n-|\n\n|\Z)',
            section_text
        )

        for error in simple_errors[:5]:
            error_text = error.strip()
            # Skip very short or very long items
            if len(error_text) < 10 or len(error_text) > 300:
                continue

            question = f"What is a common error in this position?"
            answer = error_text

            faqs.append({
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": answer
                }
            })

    return faqs

def generate_minimal_schema_from_content(content, position_name):
    """Generate minimal schema even from sparse content."""
    steps = []
    faqs = []

    # Try to extract ANY links as potential transitions
    all_links = re.findall(r'\[\[(.+?)\]\]', content)

    # Filter out common non-technique links
    skip_terms = {'won by submission', 'defensive position', 'neutral position',
                  'standing position', 'guard position', 'related position', 'mount',
                  'side control', 'back control'}

    technique_links = [link for link in all_links
                       if link.lower() not in skip_terms
                       and len(link) < 60
                       and not link.startswith('State')
                       and not link.startswith('S0')]

    # Create at least 1-2 steps if we have any content
    if technique_links:
        unique_links = list(dict.fromkeys(technique_links[:3]))  # Get first 3 unique
        for i, technique in enumerate(unique_links):
            steps.append({
                "@type": "HowToStep",
                "name": f"Execute {technique}",
                "text": f"From {position_name}, execute {technique} to advance your position.",
                "position": i + 1
            })

    # Create generic steps if nothing else works
    if not steps:
        steps = [
            {
                "@type": "HowToStep",
                "name": f"Establish {position_name}",
                "text": f"Secure control in {position_name} with proper grips and positioning.",
                "position": 1
            },
            {
                "@type": "HowToStep",
                "name": f"Maintain Control",
                "text": f"Maintain pressure and control while preventing opponent escapes.",
                "position": 2
            }
        ]

    # Try to create at least one FAQ from any heading or key principle
    if not faqs:
        # Look for key principles
        principles_match = re.search(r'## Key Principles(.*?)(?=##|$)', content, re.DOTALL)
        if principles_match:
            principles = re.findall(r'- (.+?)(?=\n-|\n\n|\Z)', principles_match.group(1))
            if principles:
                faqs.append({
                    "@type": "Question",
                    "name": f"What is a key principle of {position_name}?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": principles[0].strip()
                    }
                })

    # Generic FAQ if nothing else works
    if not faqs:
        faqs = [{
            "@type": "Question",
            "name": f"What is {position_name}?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f"{position_name} is a position in Brazilian Jiu-Jitsu that requires proper technique and positioning to execute effectively."
            }
        }]

    return steps, faqs

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
    """Check if file already has HowTo or FAQ schema markup."""
    # Only skip if it has HowTo or FAQPage schema specifically
    # We want to add these even if BreadcrumbList/WebPage exist
    return '"@type": "HowTo"' in content or '"@type": "FAQPage"' in content

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
        position_name = filepath.stem  # Use filename as fallback

    print(f"\n  📄 Processing: {filepath.name}")
    print(f"     Position: {position_name}")

    # Extract data for schemas using flexible patterns
    steps = extract_offensive_transitions_flexible(content)
    faqs = extract_common_errors_flexible(content)

    print(f"     Found {len(steps)} transition steps (flexible extraction)")
    print(f"     Found {len(faqs)} error FAQs (flexible extraction)")

    # If we found nothing, try minimal schema generation
    if not steps and not faqs:
        print(f"     ⚠️  No structured content found, generating minimal schema...")
        steps, faqs = generate_minimal_schema_from_content(content, position_name)
        print(f"     Generated {len(steps)} minimal steps and {len(faqs)} minimal FAQs")

    # If still nothing, skip
    if not steps and not faqs:
        print(f"  ❌ Error: Could not generate any schema for {filepath.name}")
        return False

    # Show what we're adding
    if steps:
        print(f"     HowTo Steps:")
        for step in steps[:3]:  # Show first 3
            print(f"       - {step['name']}")
        if len(steps) > 3:
            print(f"       ... and {len(steps) - 3} more")

    if faqs:
        print(f"     FAQ Items:")
        for faq in faqs[:2]:  # Show first 2
            print(f"       - {faq['name'][:60]}...")
        if len(faqs) > 2:
            print(f"       ... and {len(faqs) - 2} more")

    # Add schema to content
    new_content = add_schema_to_content(content, position_name, steps, faqs)

    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ✅ Updated {filepath.name}")
    print(f"     Added: HowTo schema ({len(steps)} steps), FAQ schema ({len(faqs)} items)")

    return True

def main():
    """Main function to process all position files."""
    # Get the positions directory
    script_dir = Path(__file__).parent
    positions_dir = script_dir.parent / 'source' / 'content' / 'Positions'

    if not positions_dir.exists():
        print(f"Error: Positions directory not found at {positions_dir}")
        return

    print(f"Processing Position files for Schema markup (v2 - Enhanced)")
    print(f"Location: {positions_dir}\n")
    print("="*70)

    # Get all markdown files except the standard
    position_files = sorted([f for f in positions_dir.glob('*.md') if f.name != '000.STANDARD.md'])

    print(f"Found {len(position_files)} position files\n")

    updated_count = 0
    skipped_count = 0
    error_count = 0

    for filepath in position_files:
        try:
            result = process_position_file(filepath)
            if result:
                updated_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            print(f"  ❌ Error processing {filepath.name}: {str(e)}")
            error_count += 1

    print(f"\n{'='*70}")
    print(f"Schema Markup Summary (v2):")
    print(f"  Total files processed: {len(position_files)}")
    print(f"  Successfully updated: {updated_count}")
    print(f"  Skipped (already had schema): {skipped_count}")
    print(f"  Errors: {error_count}")
    print(f"{'='*70}")

    if updated_count > 0:
        print(f"\n✅ Successfully added schema to {updated_count} Position pages!")
    else:
        print(f"\n⚠️  No pages were updated. They may already have schema markup.")

if __name__ == '__main__':
    main()
