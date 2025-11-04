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
    "Positions": "source/content/Positions",
    "Transitions": "source/content/Transitions",
    "Submissions": "source/content/Submissions",
    "Principles": "source/content/Principles",
    "Systems": "source/content/Systems"
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


def detect_position_template_type(json_file):
    """Detect which Positions template to use via filesystem structure"""
    json_path = Path(json_file)
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    if not variant_folder.exists() or not variant_folder.is_dir():
        return 'SINGLE'

    json_files_in_folder = list(variant_folder.glob("*.json"))

    if len(json_files_in_folder) > 0:
        return 'FAMILY'
    else:
        return 'DUAL'


def load_template(category, template_name):
    """Load Jinja2 template from source/templates/"""
    if category == "Positions":
        # Positions templates are in subdirectory
        template_path = Path(f"source/templates/Positions/{template_name}")
    else:
        # Other categories use flat structure
        template_path = Path(f"source/templates/{template_name}")

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return Template(f.read())
    except Exception as e:
        raise Exception(f"Failed to load template {template_path}: {e}")


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


def aggregate_family_variants(data, json_path):
    """Aggregate variant data for FAMILY positions"""
    variants_comparison = []
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    for variant_ref in data.get('variations', []):
        variant_slug = variant_ref['slug']
        variant_file = variant_folder / f"{variant_slug}.json"

        if not variant_file.exists():
            print(f"⚠️  Variant file not found: {variant_file}")
            print(f"   Skipping {variant_ref['name']} in comparison tables")
            continue

        try:
            variant_data = load_json_file(variant_file)

            variants_comparison.append({
                'name': variant_data.get('name', variant_ref['name']),
                'bottom_risk': variant_data['bottom']['state_properties']['risk_level'],
                'top_risk': variant_data['top']['state_properties']['risk_level'],
                'bottom_energy': variant_data['bottom']['state_properties']['energy_cost'],
                'top_energy': variant_data['top']['state_properties']['energy_cost'],
                'uniqueness': variant_data.get('variant_uniqueness', '')
            })
        except Exception as e:
            print(f"⚠️  Error loading variant {variant_file}: {e}")
            continue

    return variants_comparison


def process_json_file(json_path, dry_run=False):
    """Process a single JSON file: load data, render template(s), write MD"""
    json_path = Path(json_path)

    # Determine category from path
    category = None
    for cat_name, cat_path in CATEGORIES.items():
        if cat_path in str(json_path):
            category = cat_name
            break

    if not category:
        print(f"ERROR: Could not determine category for {json_path}")
        print(f"File must be in one of: {', '.join(CATEGORIES.values())}")
        sys.exit(1)

    # Load JSON data
    data = load_json_file(json_path)

    # Handle different category types
    if category != "Positions":
        # Flat categories: render single file
        template = load_template(category, f"{category}.md.jinja2")
        markdown_content = generate_markdown(data, template)
        md_path = json_path.with_suffix('.md')
        write_markdown_file(md_path, markdown_content, dry_run)
        return [md_path]

    # Positions: detect template type
    template_type = detect_position_template_type(json_path)

    if template_type == 'SINGLE':
        # Render single file
        template = load_template(category, "TEMPLATE-SINGLE.md.jinja2")
        markdown_content = template.render(data=data)
        md_path = json_path.with_suffix('.md')
        write_markdown_file(md_path, markdown_content, dry_run)
        return [md_path]

    elif template_type in ['DUAL', 'FAMILY']:
        # Render 3 files: hub, bottom, top
        generated_files = []

        # Aggregate variants if FAMILY
        variants_comparison = []
        if template_type == 'FAMILY':
            variants_comparison = aggregate_family_variants(data, json_path)

        # Render hub page
        hub_template = load_template(category, "TEMPLATE-HUB.md.jinja2")
        hub_data = {
            **data,
            'bottom_summary': data['bottom'],
            'top_summary': data['top'],
            'variants_comparison': variants_comparison
        }
        hub_content = hub_template.render(**hub_data)
        hub_path = json_path.with_suffix('.md')
        write_markdown_file(hub_path, hub_content, dry_run)
        generated_files.append(hub_path)

        # Render bottom page
        bottom_template = load_template(category, "TEMPLATE-BOTTOM.md.jinja2")
        bottom_content = bottom_template.render(bottom=data['bottom'], slug=data.get('slug', json_path.stem))
        bottom_path = json_path.parent / data.get('slug', json_path.stem) / "bottom.md"
        bottom_path.parent.mkdir(parents=True, exist_ok=True)
        write_markdown_file(bottom_path, bottom_content, dry_run)
        generated_files.append(bottom_path)

        # Render top page
        top_template = load_template(category, "TEMPLATE-TOP.md.jinja2")
        top_content = top_template.render(top=data['top'], slug=data.get('slug', json_path.stem))
        top_path = json_path.parent / data.get('slug', json_path.stem) / "top.md"
        write_markdown_file(top_path, top_content, dry_run)
        generated_files.append(top_path)

        return generated_files

    else:
        raise ValueError(f"Unknown Position template type: {template_type}")


def process_category(category, dry_run=False):
    """Process all JSON files in a category"""
    if category not in CATEGORIES:
        print(f"ERROR: Unknown category '{category}'")
        print(f"Available categories: {', '.join(CATEGORIES.keys())}")
        sys.exit(1)

    category_path = Path(CATEGORIES[category])

    if not category_path.exists():
        print(f"ERROR: Category path not found: {category_path}")
        sys.exit(1)

    # Find all JSON files at root level only (not in subdirectories)
    # This prevents processing variant files (which are in subdirectories)
    json_files = [f for f in category_path.glob("*.json")]

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return

    print(f"\nProcessing {len(json_files)} files in {category}...")

    processed = 0
    for json_file in sorted(json_files):
        try:
            generated_files = process_json_file(json_file, dry_run)
            processed += 1
            if len(generated_files) > 1:
                print(f"  → Generated {len(generated_files)} files")
        except Exception as e:
            print(f"ERROR processing {json_file}: {e}")
            import traceback
            traceback.print_exc()

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
