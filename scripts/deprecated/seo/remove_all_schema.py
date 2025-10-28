#!/usr/bin/env python3
"""
Script to remove all existing schema markup from markdown files.
This allows clean regeneration with corrected URLs.
"""

import re
from pathlib import Path

def remove_schema_markup(content):
    """Remove all schema markup blocks from content."""
    # Remove schema comment
    content = re.sub(r'<!-- Schema Markup.*?-->\n?', '', content, flags=re.DOTALL)

    # Remove all JSON-LD script blocks
    content = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', '', content, flags=re.DOTALL)

    # Clean up excessive newlines (max 2 consecutive)
    content = re.sub(r'\n{3,}', '\n\n', content)

    return content

def process_file(filepath):
    """Remove schema markup from a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {filepath.name}: {e}")
        return False

    # Check if file has schema markup
    has_schema = '<script type="application/ld+json">' in content

    if not has_schema:
        return False

    # Remove schema markup
    new_content = remove_schema_markup(content)

    # Write back to file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✅ Cleaned {filepath.name}")
        return True
    except Exception as e:
        print(f"  Error writing {filepath.name}: {e}")
        return False

def main():
    """Main function to process all markdown files."""
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent.parent / 'source' / 'content'

    if not content_dir.exists():
        print(f"Error: Content directory not found at {content_dir}")
        return

    print("="*60)
    print("Schema Markup Removal Script")
    print("="*60)
    print(f"Content directory: {content_dir}\n")

    # Define directories to process
    target_dirs = [
        content_dir / 'Positions',
        content_dir / 'Transitions',
        content_dir / 'Submissions',
        content_dir / 'Concepts',
        content_dir / 'Systems',
        content_dir / 'Learning',
    ]

    # Also process hub pages at root
    hub_patterns = ['BJJ-*.md', 'index.md']

    total_cleaned = 0
    total_skipped = 0

    # Process each directory
    for target_dir in target_dirs:
        if not target_dir.exists():
            continue

        print(f"\nProcessing {target_dir.name}/")
        print("-" * 60)

        # Get all markdown files
        md_files = sorted([
            f for f in target_dir.glob('*.md')
            if 'STANDARD' not in f.name and 'CONTRIBUTING' not in f.name
        ])

        for filepath in md_files:
            if process_file(filepath):
                total_cleaned += 1
            else:
                total_skipped += 1

    # Process hub pages
    print(f"\nProcessing hub pages in: {content_dir.name}/")
    print("-" * 60)

    for pattern in hub_patterns:
        for filepath in sorted(content_dir.glob(pattern)):
            if process_file(filepath):
                total_cleaned += 1
            else:
                total_skipped += 1

    # Print summary
    print("\n" + "=" * 60)
    print("Schema Removal Summary:")
    print(f"  Files cleaned: {total_cleaned}")
    print(f"  Files skipped (no schema): {total_skipped}")
    print("=" * 60)

    if total_cleaned > 0:
        print(f"\n✅ Successfully removed schema markup from {total_cleaned} files!")
        print("\nNext steps:")
        print("  1. Run: python3 scripts/seo/add_webpage_schema.py")
        print("  2. Run: python3 scripts/seo/add_breadcrumb_schema.py")
        print("  3. Run: python3 scripts/seo/add_position_schema_v2.py")
        print("  4. Run: python3 scripts/seo/add_transition_schema_v2.py")
    else:
        print("\nℹ️  No files had schema markup to remove")

if __name__ == '__main__':
    main()
