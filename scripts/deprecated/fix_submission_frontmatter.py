#!/usr/bin/env python3
"""
Fix submission pages by adding frontmatter and proper descriptions.

This script:
1. Adds YAML frontmatter to submission pages that are missing it
2. Extracts meaningful descriptions from the Visual Execution Sequence
3. Updates WebPage schema descriptions to match
"""

import os
import re
import json
from pathlib import Path

# Directory containing submission files
# Use relative path from script location
SCRIPT_DIR = Path(__file__).parent.parent.parent  # bjjgraph root
SUBMISSIONS_DIR = SCRIPT_DIR / "source" / "content" / "Submissions"

# Files with known placeholder descriptions
TARGET_FILES = [
    "Williams Shoulder Lock.md", "Twister Setup.md", "Twister Finish.md",
    "Triangle Finish.md", "Triangle Choke Side.md", "Triangle Choke Back.md",
    "Straight Ankle Lock.md", "Spine Lock.md", "Rear Naked Choke.md",
    "North-South Choke.md", "Mir Lock.md", "Loop Choke.md",
    "Kneebar Finish.md", "Kimura.md", "Inside Heel Hook.md",
    "Heel Hook Dilemma.md", "Guillotine Sequence.md", "Gogoplata Setup.md",
    "Far Side Armbar.md", "Ezekiel Choke.md", "Electric Chair Submission.md",
    "Cross Collar Choke.md", "Calf Slicer.md", "Boston Crab.md",
    "Baseball Bat Choke.md", "Banana Split.md", "Armbar Finish.md",
    "Arm Triangle.md", "Arm Crush.md", "Anaconda Choke.md"
]

def extract_submission_name(content):
    """Extract submission name from heading."""
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None

def extract_visual_sequence(content):
    """Extract the visual execution sequence paragraph."""
    # Look for the paragraph after "### Visual Execution Sequence"
    pattern = r'### Visual Execution Sequence\s+Detailed step-by-step description[^\n]*:\s+(.+?)(?=\n\n|\*\*Template\*\*)'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        sequence = match.group(1).strip()
        # Clean up the text - take first 2-3 sentences
        sentences = re.split(r'(?<=[.!?])\s+', sequence)
        # Take first 2 sentences, or up to 200 chars
        description = ' '.join(sentences[:2])
        if len(description) > 200:
            # Find a good cutoff point
            cutoff = description[:197].rfind(' ')
            description = description[:cutoff] + '...'
        return description
    return None

def create_frontmatter(submission_name, description):
    """Create YAML frontmatter."""
    title = f"{submission_name} | BJJ Submission Guide | BJJ Graph"
    return f"""---
title: "{title}"
description: "{description}"
---

"""

def update_schema_description(content, new_description):
    """Update the WebPage schema description."""
    # Find and replace the description in the WebPage schema
    pattern = r'("description":\s*)"[^"]*"'
    replacement = f'\\1"{new_description}"'
    updated = re.sub(pattern, replacement, content, count=1)
    return updated

def has_frontmatter(content):
    """Check if file already has frontmatter."""
    return content.strip().startswith('---')

def process_file(filepath):
    """Process a single submission file."""
    print(f"\nProcessing: {filepath.name}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already has frontmatter
    if has_frontmatter(content):
        print(f"  ✓ Already has frontmatter")

        # But check if schema description is placeholder
        if '"description": "Detailed step-by-step description' in content:
            print(f"  ⚠ Has placeholder schema description")

            # Extract submission name and description
            submission_name = extract_submission_name(content)
            description = extract_visual_sequence(content)

            if submission_name and description:
                # Update schema description
                updated_content = update_schema_description(content, description)

                # Update frontmatter description too
                frontmatter_pattern = r'(---\s*\ntitle:[^\n]+\ndescription:\s*")[^"]*(")'
                updated_content = re.sub(frontmatter_pattern, f'\\1{description}\\2', updated_content)

                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(updated_content)

                print(f"  ✓ Updated schema description")
                return "updated_schema"
            else:
                print(f"  ✗ Could not extract description")
                return "failed"
        else:
            return "skipped"

    # File needs frontmatter
    print(f"  ⚠ Missing frontmatter")

    # Extract submission name
    submission_name = extract_submission_name(content)
    if not submission_name:
        print(f"  ✗ Could not extract submission name")
        return "failed"

    print(f"  → Submission: {submission_name}")

    # Extract description from visual sequence
    description = extract_visual_sequence(content)
    if not description:
        print(f"  ✗ Could not extract description")
        return "failed"

    print(f"  → Description: {description[:80]}...")

    # Create frontmatter
    frontmatter = create_frontmatter(submission_name, description)

    # Update schema description
    updated_content = update_schema_description(content, description)

    # Prepend frontmatter
    final_content = frontmatter + updated_content

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  ✓ Added frontmatter and updated schema")
    return "fixed"

def main():
    """Main processing function."""
    print("=" * 60)
    print("Fixing Submission Page Frontmatter")
    print("=" * 60)

    results = {
        "fixed": [],
        "updated_schema": [],
        "skipped": [],
        "failed": []
    }

    # Process all target files
    for filename in TARGET_FILES:
        filepath = Path(SUBMISSIONS_DIR) / filename

        if not filepath.exists():
            print(f"\n⚠ File not found: {filename}")
            results["failed"].append(filename)
            continue

        result = process_file(filepath)
        results[result].append(filename)

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Files with frontmatter added: {len(results['fixed'])}")
    print(f"Files with schema updated: {len(results['updated_schema'])}")
    print(f"Files skipped (already correct): {len(results['skipped'])}")
    print(f"Files failed: {len(results['failed'])}")

    if results['fixed']:
        print("\n✓ Added frontmatter to:")
        for f in results['fixed']:
            print(f"  - {f}")

    if results['updated_schema']:
        print("\n✓ Updated schema in:")
        for f in results['updated_schema']:
            print(f"  - {f}")

    if results['failed']:
        print("\n✗ Failed to process:")
        for f in results['failed']:
            print(f"  - {f}")

    print("\n" + "=" * 60)
    print(f"Total files processed: {len(TARGET_FILES)}")
    print(f"Total fixes applied: {len(results['fixed']) + len(results['updated_schema'])}")
    print("=" * 60)

if __name__ == "__main__":
    main()
