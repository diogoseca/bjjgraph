#!/usr/bin/env python3
"""
Fix remaining submission pages missing frontmatter.

This script handles files with different description patterns.
"""

import os
import re
from pathlib import Path

# Directory containing submission files
# Use relative path from script location
SCRIPT_DIR = Path(__file__).parent.parent.parent  # bjjgraph root
SUBMISSIONS_DIR = SCRIPT_DIR / "source" / "content" / "Submissions"

# Files identified as missing frontmatter
TARGET_FILES = [
    "Switch to Triangle.md",
    "Submission Defense Principles.md",
    "Omoplata.md",
    "Modern Leg Lock Meta.md",
    "Toe Hold.md",
    "Leg Lock Defense Framework.md",
    "Mount to Armbar.md",
    "Arm Triangle Progression.md",
    "Submission-Focused Strategy.md",
    "D'arce-Anaconda Connection.md",
    "Americana.md",
    "Front Headlock Submission System.md",
    "Can Opener.md",
    "Triangle Choke Front.md",
    "North-South to Kimura.md",
    "Rear Naked Choke Pathway.md",
    "Bicep Slicer.md"
]

def extract_submission_name(content):
    """Extract submission name from heading."""
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None

def extract_description(content):
    """Extract description from various locations in content."""

    # Try Visual Finishing Sequence first
    pattern1 = r'### Visual Finishing Sequence\s+Detailed description for technical completion:\s+(.+?)(?=\n\n|\*\*Template\*\*)'
    match = re.search(pattern1, content, re.DOTALL)
    if match:
        desc_text = match.group(1).strip()
        # Clean up list items
        desc_text = re.sub(r'^- ', '', desc_text, flags=re.MULTILINE)
        # Take first couple of sentences
        sentences = desc_text.split('\n')
        description = ' '.join(sentences[:2]).strip()
        if len(description) > 200:
            cutoff = description[:197].rfind(' ')
            description = description[:cutoff] + '...'
        return description

    # Try Visual Execution Sequence
    pattern2 = r'### Visual Execution Sequence\s+[^\n]*:\s+(.+?)(?=\n\n|\*\*Template\*\*)'
    match = re.search(pattern2, content, re.DOTALL)
    if match:
        sequence = match.group(1).strip()
        sentences = re.split(r'(?<=[.!?])\s+', sequence)
        description = ' '.join(sentences[:2])
        if len(description) > 200:
            cutoff = description[:197].rfind(' ')
            description = description[:cutoff] + '...'
        return description

    # Try extracting from the existing WebPage schema description (clean it up)
    pattern3 = r'"description":\s*"([^"]+)"'
    match = re.search(pattern3, content)
    if match:
        desc = match.group(1)
        # If it's a placeholder, try to extract from content
        if "Detailed description for technical completion" in desc or "Detailed step-by-step" in desc:
            # Look for any paragraph after the header
            pattern4 = r'## State Machine Content Elements\s+###[^\n]+\s+[^\n]+:\s+(.+?)(?=\n\n)'
            match2 = re.search(pattern4, content, re.DOTALL)
            if match2:
                text = match2.group(1).strip()
                text = re.sub(r'^- ', '', text, flags=re.MULTILINE)
                sentences = text.split('\n')
                description = ' '.join(sentences[:2]).strip()
                if len(description) > 200:
                    cutoff = description[:197].rfind(' ')
                    description = description[:cutoff] + '...'
                return description
        else:
            # Use existing non-placeholder description
            return desc.split('\\n')[0]  # Take first line

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

def process_file(filepath):
    """Process a single submission file."""
    print(f"\nProcessing: {filepath.name}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already has frontmatter
    if content.strip().startswith('---'):
        print(f"  ✓ Already has frontmatter - skipping")
        return "skipped"

    # Extract submission name
    submission_name = extract_submission_name(content)
    if not submission_name:
        print(f"  ✗ Could not extract submission name")
        return "failed"

    print(f"  → Submission: {submission_name}")

    # Extract description
    description = extract_description(content)
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
    print("Fixing Remaining Submission Frontmatter")
    print("=" * 60)

    results = {
        "fixed": [],
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
    print(f"Files skipped (already correct): {len(results['skipped'])}")
    print(f"Files failed: {len(results['failed'])}")

    if results['fixed']:
        print("\n✓ Added frontmatter to:")
        for f in results['fixed']:
            print(f"  - {f}")

    if results['failed']:
        print("\n✗ Failed to process:")
        for f in results['failed']:
            print(f"  - {f}")

    print("\n" + "=" * 60)
    print(f"Total files processed: {len(TARGET_FILES)}")
    print(f"Total fixes applied: {len(results['fixed'])}")
    print("=" * 60)

if __name__ == "__main__":
    main()
