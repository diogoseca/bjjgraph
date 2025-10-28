#!/usr/bin/env python3
"""
Hub Page Generator for BJJ Graph Position Files

Generates markdown files from position JSON files using Jinja2 templates.
Handles three template types:
1. FAMILY (hub + bottom + top): Creates hub page and two variant pages
2. DUAL (bottom + top, no hub): Creates two variant pages
3. SINGLE (no variants): Creates single page

Usage:
    python3 scripts/hub_generator.py

Template Detection Logic:
- Has 'hub' key? → FAMILY template
- Has 'bottom' and 'top' keys but no 'hub'? → DUAL template
- Neither? → SINGLE template

File Naming Convention:
- Root level: Title Case with spaces (e.g., "Mount.md")
- Variations: Title Case with spaces in subfolder (e.g., "Mount/Bottom.md", "Mount/Top.md")
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from jinja2 import Environment, FileSystemLoader, Template, TemplateNotFound

# Configuration
POSITIONS_DIR = Path("source/content/Positions")
TEMPLATES_DIR = Path("source/templates/Positions")
OUTPUT_DIR = Path("source/content/Positions")

# Template filenames
TEMPLATE_HUB = "TEMPLATE-HUB.md.jinja2"
TEMPLATE_BOTTOM = "TEMPLATE-BOTTOM.md.jinja2"
TEMPLATE_TOP = "TEMPLATE-TOP.md.jinja2"
TEMPLATE_SINGLE = "TEMPLATE-SINGLE.md.jinja2"


class TemplateType:
    """Enum for template types"""
    FAMILY = "family"  # Has hub + bottom + top
    DUAL = "dual"      # Has bottom + top, no hub
    SINGLE = "single"  # No variants


def detect_template_type(data: Dict) -> str:
    """
    Detect which template type to use based on JSON structure.

    Args:
        data: Parsed JSON data

    Returns:
        TemplateType constant (FAMILY, DUAL, or SINGLE)
    """
    has_hub = 'hub' in data
    has_bottom = 'bottom' in data
    has_top = 'top' in data

    if has_hub:
        return TemplateType.FAMILY
    elif has_bottom and has_top:
        return TemplateType.DUAL
    else:
        return TemplateType.SINGLE


def title_case_path(name: str) -> str:
    """
    Convert name to Title Case for file paths.
    Preserves spaces.

    Examples:
        "mount" → "Mount"
        "high mount" → "High Mount"
        "3-4 mount" → "3-4 Mount"
    """
    # Split on spaces and hyphens
    parts = []
    for word in name.split():
        # Don't title-case numbers or short connectors
        if word.isdigit() or word in ['-', '/']:
            parts.append(word)
        else:
            # Title case each part
            parts.append(word.capitalize())

    return ' '.join(parts)


def extract_base_name(filename: str) -> str:
    """
    Extract base position name from filename.

    Examples:
        "Mount.json" → "Mount"
        "High Mount.json" → "High Mount"
        "50-50 Guard.json" → "50-50 Guard"
    """
    return filename.replace('.json', '')


def create_slug(name: str) -> str:
    """
    Create URL slug from position name.

    Examples:
        "Mount" → "mount"
        "High Mount" → "high-mount"
        "50-50 Guard" → "50-50-guard"
    """
    return name.lower().replace(' ', '-')


def extract_summary_data(position_data: Dict) -> Dict:
    """
    Extract summary data for hub pages from full position data.

    Args:
        position_data: Full position JSON data (bottom or top variant)

    Returns:
        Dictionary with summarized data:
        - key_principles: List of principles
        - top_escapes/top_attacks: Top 3 transitions
        - top_errors: Top 3 common errors
    """
    summary = {
        'key_principles': position_data.get('key_principles', [])[:5],
        'top_errors': []
    }

    # Extract top transitions (attacks or escapes)
    transitions = position_data.get('offensive_transitions', [])[:3]

    # Determine if this is defensive (bottom) or offensive (top)
    is_defensive = position_data.get('state_properties', {}).get('position_type') == 'Defensive'

    if is_defensive:
        summary['top_escapes'] = transitions
    else:
        summary['top_attacks'] = transitions

    # Extract top 3 common errors
    errors = position_data.get('common_errors', [])[:3]
    summary['top_errors'] = errors

    return summary


def generate_family_pages(json_path: Path, data: Dict, env: Environment) -> List[Tuple[Path, str]]:
    """
    Generate hub page and bottom/top variant pages for FAMILY template.

    Args:
        json_path: Path to source JSON file
        data: Parsed JSON data with hub, bottom, top keys
        env: Jinja2 environment

    Returns:
        List of (output_path, content) tuples
    """
    pages = []
    base_name = extract_base_name(json_path.name)
    slug = create_slug(base_name)

    # Create hub page
    try:
        hub_template = env.get_template(TEMPLATE_HUB)

        # Extract summary data from bottom and top
        bottom_summary = extract_summary_data(data['bottom'])
        top_summary = extract_summary_data(data['top'])

        hub_content = hub_template.render(
            hub=data['hub'],
            bottom_summary=bottom_summary,
            top_summary=top_summary,
            slug=slug
        )

        hub_path = OUTPUT_DIR / f"{base_name}.md"
        pages.append((hub_path, hub_content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
        return pages
    except Exception as e:
        print(f"ERROR generating hub page for {base_name}: {e}")
        return pages

    # Create bottom variant page
    try:
        bottom_template = env.get_template(TEMPLATE_BOTTOM)
        bottom_content = bottom_template.render(bottom=data['bottom'])

        # Create subfolder if needed
        variant_dir = OUTPUT_DIR / base_name
        variant_dir.mkdir(exist_ok=True)

        bottom_path = variant_dir / "Bottom.md"
        pages.append((bottom_path, bottom_content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
    except Exception as e:
        print(f"ERROR generating bottom page for {base_name}: {e}")

    # Create top variant page
    try:
        top_template = env.get_template(TEMPLATE_TOP)
        top_content = top_template.render(top=data['top'])

        # Use same subfolder
        variant_dir = OUTPUT_DIR / base_name
        variant_dir.mkdir(exist_ok=True)

        top_path = variant_dir / "Top.md"
        pages.append((top_path, top_content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
    except Exception as e:
        print(f"ERROR generating top page for {base_name}: {e}")

    return pages


def generate_dual_pages(json_path: Path, data: Dict, env: Environment) -> List[Tuple[Path, str]]:
    """
    Generate bottom and top variant pages for DUAL template (no hub).

    Args:
        json_path: Path to source JSON file
        data: Parsed JSON data with bottom, top keys
        env: Jinja2 environment

    Returns:
        List of (output_path, content) tuples
    """
    pages = []
    base_name = extract_base_name(json_path.name)

    # Create subfolder for variants
    variant_dir = OUTPUT_DIR / base_name
    variant_dir.mkdir(exist_ok=True)

    # Create bottom variant page
    try:
        bottom_template = env.get_template(TEMPLATE_BOTTOM)
        bottom_content = bottom_template.render(bottom=data['bottom'])

        bottom_path = variant_dir / "Bottom.md"
        pages.append((bottom_path, bottom_content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
    except Exception as e:
        print(f"ERROR generating bottom page for {base_name}: {e}")

    # Create top variant page
    try:
        top_template = env.get_template(TEMPLATE_TOP)
        top_content = top_template.render(top=data['top'])

        top_path = variant_dir / "Top.md"
        pages.append((top_path, top_content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
    except Exception as e:
        print(f"ERROR generating top page for {base_name}: {e}")

    return pages


def generate_single_page(json_path: Path, data: Dict, env: Environment) -> List[Tuple[Path, str]]:
    """
    Generate single page for SINGLE template (no variants).

    Args:
        json_path: Path to source JSON file
        data: Parsed JSON data (flat structure)
        env: Jinja2 environment

    Returns:
        List of (output_path, content) tuples with single item
    """
    pages = []
    base_name = extract_base_name(json_path.name)

    try:
        single_template = env.get_template(TEMPLATE_SINGLE)
        content = single_template.render(data=data)

        output_path = OUTPUT_DIR / f"{base_name}.md"
        pages.append((output_path, content))

    except TemplateNotFound as e:
        print(f"ERROR: Template not found: {e}")
    except Exception as e:
        print(f"ERROR generating single page for {base_name}: {e}")

    return pages


def process_json_file(json_path: Path, env: Environment) -> int:
    """
    Process a single JSON file and generate appropriate markdown files.

    Args:
        json_path: Path to JSON file
        env: Jinja2 environment

    Returns:
        Number of markdown files generated
    """
    try:
        # Read and parse JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Detect template type
        template_type = detect_template_type(data)

        # Generate pages based on template type
        if template_type == TemplateType.FAMILY:
            print(f"  FAMILY: {json_path.name} → hub + bottom + top")
            pages = generate_family_pages(json_path, data, env)
        elif template_type == TemplateType.DUAL:
            print(f"  DUAL: {json_path.name} → bottom + top")
            pages = generate_dual_pages(json_path, data, env)
        else:  # SINGLE
            print(f"  SINGLE: {json_path.name} → single page")
            pages = generate_single_page(json_path, data, env)

        # Write generated pages to disk
        for output_path, content in pages:
            # Create parent directory if needed
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Write markdown file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"    ✓ {output_path}")

        return len(pages)

    except json.JSONDecodeError as e:
        print(f"  ERROR: Invalid JSON in {json_path.name}: {e}")
        return 0
    except Exception as e:
        print(f"  ERROR processing {json_path.name}: {e}")
        return 0


def main():
    """Main entry point"""
    print("=" * 80)
    print("BJJ Graph Hub Page Generator")
    print("=" * 80)
    print()

    # Check that directories exist
    if not POSITIONS_DIR.exists():
        print(f"ERROR: Positions directory not found: {POSITIONS_DIR}")
        sys.exit(1)

    if not TEMPLATES_DIR.exists():
        print(f"ERROR: Templates directory not found: {TEMPLATES_DIR}")
        sys.exit(1)

    # Set up Jinja2 environment
    try:
        env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=False,  # Markdown doesn't need HTML escaping
            trim_blocks=True,
            lstrip_blocks=True
        )
    except Exception as e:
        print(f"ERROR: Failed to initialize Jinja2 environment: {e}")
        sys.exit(1)

    # Find all JSON files recursively (templates are in separate directory)
    json_files = list(POSITIONS_DIR.rglob("*.json"))

    print(f"Found {len(json_files)} position JSON files")
    print()

    # Process each file
    total_pages = 0
    success_count = 0

    for json_path in sorted(json_files):
        pages_generated = process_json_file(json_path, env)
        if pages_generated > 0:
            success_count += 1
            total_pages += pages_generated

    # Summary
    print()
    print("=" * 80)
    print(f"Generation complete!")
    print(f"  Processed: {success_count}/{len(json_files)} files")
    print(f"  Generated: {total_pages} markdown pages")
    print("=" * 80)

    return 0 if success_count == len(json_files) else 1


if __name__ == "__main__":
    sys.exit(main())
