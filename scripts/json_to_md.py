#!/usr/bin/env python3
"""
BJJ Graph JSON to Markdown Generator
====================================
Generates markdown files from JSON data using category-specific Jinja2 templates.

Usage:
    python3 scripts/json_to_md.py --file source/content/Positions/Mount.json
    python3 scripts/json_to_md.py --category Positions --all
    python3 scripts/json_to_md.py --all
    python3 scripts/json_to_md.py --all --dry-run
"""

import argparse
import json
import sys
from pathlib import Path
from jinja2 import Template, Environment, FileSystemLoader

# Category configurations
CATEGORIES = {
    "Positions": {
        "path": "source/content/Positions",
        "template": "TEMPLATE.md.jinja2",
        "extension": ".md"
    },
    "Transitions": {
        "path": "source/content/Transitions",
        "template": "TEMPLATE.md.jinja2",
        "extension": ".md"
    },
    "Submissions": {
        "path": "source/content/Submissions",
        "template": "TEMPLATE.md.jinja2",
        "extension": ".md"
    },
    "Concepts": {
        "path": "source/content/Principles",
        "template": "TEMPLATE.md.jinja2",
        "extension": ".md"
    },
    "Systems": {
        "path": "source/content/Systems",
        "template": "TEMPLATE.md.jinja2",
        "extension": ".md"
    }
}


def load_json_file(json_path):
    """Load and parse JSON file"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {json_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {json_path}: {e}")
        sys.exit(1)


def load_template(category_path):
    """Load Jinja2 template for category"""
    template_path = Path(category_path) / "TEMPLATE.md.jinja2"

    if not template_path.exists():
        print(f"ERROR: Template not found: {template_path}")
        sys.exit(1)

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return Template(f.read())
    except Exception as e:
        print(f"ERROR: Failed to load template {template_path}: {e}")
        sys.exit(1)


def generate_markdown(json_data, template):
    """Generate markdown from JSON data using Jinja2 template"""
    try:
        return template.render(**json_data)
    except Exception as e:
        print(f"ERROR: Template rendering failed: {e}")
        sys.exit(1)


def write_markdown_file(md_path, content, dry_run=False):
    """Write markdown content to file"""
    if dry_run:
        print(f"[DRY RUN] Would write: {md_path}")
        return

    try:
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Generated: {md_path}")
    except Exception as e:
        print(f"ERROR: Failed to write {md_path}: {e}")
        sys.exit(1)


def process_json_file(json_path, dry_run=False):
    """Process a single JSON file: load data, render template, write MD"""
    json_path = Path(json_path)

    # Determine category from path
    category = None
    for cat_name, cat_config in CATEGORIES.items():
        if cat_config["path"] in str(json_path):
            category = cat_name
            break

    if not category:
        print(f"ERROR: Could not determine category for {json_path}")
        print(f"File must be in one of: {', '.join([c['path'] for c in CATEGORIES.values()])}")
        sys.exit(1)

    # Load JSON data
    data = load_json_file(json_path)

    # Load template
    category_path = CATEGORIES[category]["path"]
    template = load_template(category_path)

    # Generate markdown
    markdown_content = generate_markdown(data, template)

    # Determine output path (same name, .md extension)
    md_path = json_path.with_suffix('.md')

    # Write file
    write_markdown_file(md_path, markdown_content, dry_run)

    return md_path


def process_category(category, dry_run=False):
    """Process all JSON files in a category"""
    if category not in CATEGORIES:
        print(f"ERROR: Unknown category '{category}'")
        print(f"Available categories: {', '.join(CATEGORIES.keys())}")
        sys.exit(1)

    category_path = Path(CATEGORIES[category]["path"])

    if not category_path.exists():
        print(f"ERROR: Category path not found: {category_path}")
        sys.exit(1)

    # Find all JSON files (excluding TEMPLATE.json)
    json_files = [f for f in category_path.glob("*.json") if f.name != "TEMPLATE.json"]

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return

    print(f"\nProcessing {len(json_files)} files in {category}...")

    processed = 0
    for json_file in sorted(json_files):
        try:
            process_json_file(json_file, dry_run)
            processed += 1
        except Exception as e:
            print(f"ERROR processing {json_file}: {e}")

    print(f"\n✓ Processed {processed}/{len(json_files)} files in {category}")


def process_all_categories(dry_run=False):
    """Process all JSON files in all categories"""
    print("Processing all categories...")

    for category in CATEGORIES.keys():
        process_category(category, dry_run)


def main():
    parser = argparse.ArgumentParser(
        description="Generate markdown files from JSON data using Jinja2 templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate single file
  python3 scripts/json_to_md.py --file source/content/Positions/Mount.json

  # Generate all files in category
  python3 scripts/json_to_md.py --category Positions --all

  # Generate all files in all categories
  python3 scripts/json_to_md.py --all

  # Dry run (see what would be generated)
  python3 scripts/json_to_md.py --all --dry-run
        """
    )

    parser.add_argument('--file', help='Path to specific JSON file')
    parser.add_argument('--category', choices=list(CATEGORIES.keys()), help='Category to process')
    parser.add_argument('--all', action='store_true', help='Process all files (in category or all categories)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without writing files')

    args = parser.parse_args()

    # Validate arguments
    if not (args.file or (args.category and args.all) or args.all):
        parser.error("Must specify --file, --category with --all, or just --all")

    # Execute based on arguments
    if args.file:
        process_json_file(args.file, args.dry_run)
    elif args.category and args.all:
        process_category(args.category, args.dry_run)
    elif args.all:
        process_all_categories(args.dry_run)


if __name__ == "__main__":
    main()
