#!/usr/bin/env python3
"""
Script to add YAML frontmatter with SEO meta descriptions and titles to Position pages.
Extracts success rates from existing content and generates optimized metadata.
"""

import os
import re
from pathlib import Path

def extract_position_metrics(content):
    """Extract position metrics from content."""
    metrics = {
        'retention_beginner': None,
        'retention_intermediate': None,
        'retention_advanced': None,
        'submission_prob': None
    }

    # Look for Position Retention Rate line
    retention_match = re.search(r'Position Retention Rate.*?Beginner (\d+)%.*?Intermediate (\d+)%.*?Advanced (\d+)%', content, re.IGNORECASE)
    if retention_match:
        metrics['retention_beginner'] = retention_match.group(1)
        metrics['retention_intermediate'] = retention_match.group(2)
        metrics['retention_advanced'] = retention_match.group(3)

    # Look for submission probability
    submission_match = re.search(r'Submission Probability.*?(\d+)%', content, re.IGNORECASE)
    if submission_match:
        metrics['submission_prob'] = submission_match.group(1)

    # Look for Success Rate in Position Metrics
    success_match = re.search(r'Success Rate:\s*(\d+)%', content)
    if success_match:
        metrics['success_rate'] = success_match.group(1)

    return metrics

def generate_meta_description(position_name, metrics):
    """Generate SEO-optimized meta description."""
    # Base template
    desc = f"Master {position_name} in BJJ. Complete guide covering setup, control, escapes, and transitions."

    # Add success rates if available
    if metrics['retention_beginner'] and metrics['retention_intermediate'] and metrics['retention_advanced']:
        desc += f" Success rates: Beginner {metrics['retention_beginner']}%, Intermediate {metrics['retention_intermediate']}%, Advanced {metrics['retention_advanced']}%."
    elif metrics.get('success_rate'):
        desc += f" Success rate: {metrics['success_rate']}%."
    elif metrics['submission_prob']:
        desc += f" Submission probability: {metrics['submission_prob']}%."

    # Ensure under 160 characters for optimal SEO
    if len(desc) > 160:
        desc = desc[:157] + "..."

    return desc

def generate_title(position_name):
    """Generate SEO-optimized title tag."""
    title = f"{position_name} | BJJ Position Guide | BJJ Graph"

    # Ensure under 60 characters
    if len(title) > 60:
        # Try shorter version
        title = f"{position_name} | BJJ Graph"
        if len(title) > 60:
            # Truncate position name if still too long
            max_name_length = 60 - len(" | BJJ Graph")
            title = f"{position_name[:max_name_length]} | BJJ Graph"

    return title

def has_frontmatter(content):
    """Check if file already has YAML frontmatter."""
    return content.strip().startswith('---')

def process_position_file(filepath):
    """Process a single position file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has frontmatter
    if has_frontmatter(content):
        print(f"  ⏭️  Skipping {filepath.name} (already has frontmatter)")
        return False

    # Extract position name from first # heading
    name_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if not name_match:
        print(f"  ⚠️  Warning: Could not extract position name from {filepath.name}")
        return False

    position_name = name_match.group(1).strip()

    # Extract metrics
    metrics = extract_position_metrics(content)

    # Generate metadata
    title = generate_title(position_name)
    description = generate_meta_description(position_name, metrics)

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
    """Main function to process all position files."""
    # Get the positions directory
    script_dir = Path(__file__).parent
    positions_dir = script_dir.parent / 'source' / 'content' / 'Positions'

    if not positions_dir.exists():
        print(f"Error: Positions directory not found at {positions_dir}")
        return

    print(f"Processing Position files in: {positions_dir}\n")

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
    print(f"Summary:")
    print(f"  Total files: {len(position_files)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
