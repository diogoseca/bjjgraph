#!/usr/bin/env python3
"""
BJJ Graph JSON/MD Sync Checker
===============================
CI/CD validation script that checks if JSON and MD files are in sync.
Fails build if MD files need regeneration from JSON.

Usage:
    python3 scripts/check_sync.py --all
    python3 scripts/check_sync.py --category Positions
    python3 scripts/check_sync.py --file source/content/Positions/Mount.json

Exit Codes:
    0 - All files in sync
    1 - Files out of sync (need regeneration)
"""

import argparse
import json
import sys
from pathlib import Path
from jinja2 import Template

# Category configurations
CATEGORIES = {
    "Positions": "source/content/Positions",
    "Transitions": "source/content/Transitions",
    "Submissions": "source/content/Submissions",
    "Principles": "source/content/Principles",
    "Systems": "source/content/Systems"
}


def load_template(category_path):
    """Load Jinja2 template for category"""
    template_path = Path(category_path) / "TEMPLATE.md.jinja2"

    if not template_path.exists():
        print(f"ERROR: Template not found: {template_path}")
        sys.exit(1)

    with open(template_path, 'r', encoding='utf-8') as f:
        return Template(f.read())


def generate_markdown_from_json(json_path, template):
    """Generate markdown content from JSON data"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return template.render(**data)


def check_file_sync(json_path, category):
    """Check if JSON and MD are in sync for a single file"""
    json_path = Path(json_path)
    md_path = json_path.with_suffix('.md')

    # Check if MD file exists
    if not md_path.exists():
        return False, f"MD file does not exist: {md_path}"

    # Load template
    category_path = CATEGORIES[category]
    template = load_template(category_path)

    # Generate expected MD content
    try:
        expected_content = generate_markdown_from_json(json_path, template)
    except Exception as e:
        return False, f"Failed to generate MD: {e}"

    # Load actual MD content
    try:
        with open(md_path, 'r', encoding='utf-8') as f:
            actual_content = f.read()
    except Exception as e:
        return False, f"Failed to read MD file: {e}"

    # Compare (normalize line endings)
    expected_normalized = expected_content.replace('\r\n', '\n').strip()
    actual_normalized = actual_content.replace('\r\n', '\n').strip()

    if expected_normalized != actual_normalized:
        return False, "Content mismatch - MD needs regeneration"

    return True, "In sync"


def check_category_sync(category):
    """Check sync for all files in a category"""
    if category not in CATEGORIES:
        print(f"ERROR: Unknown category '{category}'")
        sys.exit(1)

    category_path = Path(CATEGORIES[category])

    if not category_path.exists():
        print(f"ERROR: Category path not found: {category_path}")
        sys.exit(1)

    # Find all JSON files (excluding TEMPLATE.json)
    json_files = [f for f in category_path.glob("*.json") if f.name != "TEMPLATE.json"]

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return True

    print(f"\nChecking {len(json_files)} files in {category}...")

    out_of_sync = []

    for json_file in sorted(json_files):
        in_sync, message = check_file_sync(json_file, category)

        if in_sync:
            print(f"✓ {json_file.name}")
        else:
            print(f"✗ {json_file.name}: {message}")
            out_of_sync.append(json_file.name)

    print(f"\n{'='*60}")
    if not out_of_sync:
        print(f"✓ {category}: All {len(json_files)} files in sync")
        return True
    else:
        print(f"✗ {category}: {len(out_of_sync)} files out of sync")
        print(f"Files needing regeneration: {', '.join(out_of_sync)}")
        print(f"\nTo fix, run: python3 scripts/json_to_md.py --category {category} --all")
        return False


def check_all_categories():
    """Check sync for all categories"""
    print("Checking all categories for JSON/MD sync...")

    all_in_sync = True

    for category in CATEGORIES.keys():
        category_in_sync = check_category_sync(category)
        all_in_sync = all_in_sync and category_in_sync

    print(f"\n{'='*60}")
    if all_in_sync:
        print("✓ ALL FILES IN SYNC")
        return 0
    else:
        print("✗ SYNC CHECK FAILED")
        print("\nSome files need regeneration. Run:")
        print("  python3 scripts/json_to_md.py --all")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Check if JSON and MD files are in sync (CI/CD validation)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check single file
  python3 scripts/check_sync.py --file source/content/Positions/Mount.json

  # Check category
  python3 scripts/check_sync.py --category Positions

  # Check all categories (for CI/CD)
  python3 scripts/check_sync.py --all

CI/CD Usage:
  Add to .github/workflows/validate.yml:
    - name: Check JSON/MD sync
      run: python3 scripts/check_sync.py --all
        """
    )

    parser.add_argument('--file', help='Path to specific JSON file')
    parser.add_argument('--category', choices=list(CATEGORIES.keys()), help='Category to check')
    parser.add_argument('--all', action='store_true', help='Check all categories')

    args = parser.parse_args()

    # Validate arguments
    if not (args.file or args.category or args.all):
        parser.error("Must specify --file, --category, or --all")

    # Execute based on arguments
    if args.file:
        json_path = Path(args.file)
        category = None
        for cat_name, cat_path in CATEGORIES.items():
            if cat_path in str(json_path):
                category = cat_name
                break

        if not category:
            print(f"ERROR: Could not determine category for {args.file}")
            sys.exit(1)

        in_sync, message = check_file_sync(json_path, category)

        if in_sync:
            print(f"✓ {json_path.name}: {message}")
            sys.exit(0)
        else:
            print(f"✗ {json_path.name}: {message}")
            print(f"\nTo fix, run: python3 scripts/json_to_md.py --file {json_path}")
            sys.exit(1)

    elif args.category:
        in_sync = check_category_sync(args.category)
        sys.exit(0 if in_sync else 1)

    elif args.all:
        exit_code = check_all_categories()
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
