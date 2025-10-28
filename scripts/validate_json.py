#!/usr/bin/env python3
"""
BJJ Graph JSON Schema Validator
================================
Validates JSON content files against category TEMPLATE.json schemas.

Usage:
    python3 scripts/validate_json.py --file source/content/Positions/Mount.json
    python3 scripts/validate_json.py --category Positions --all
    python3 scripts/validate_json.py --all
    python3 scripts/validate_json.py --all --strict
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("ERROR: jsonschema library not installed")
    print("Install with: pip install jsonschema")
    sys.exit(1)

# Category configurations
CATEGORIES = {
    "Positions": "source/content/Positions",
    "Transitions": "source/content/Transitions",
    "Submissions": "source/content/Submissions",
    "Principles": "source/content/Principles",
    "Systems": "source/content/Systems"
}

# Reference fields by category
REFERENCE_FIELDS = {
    "Positions": {
        "offensive_transitions": ["target_position"],
        "defensive_responses": ["target_position"],
        "related_content": ["name"],
        "metadata.parent_variant": ["direct"],
        "metadata.sibling_variants": ["direct"],
        "metadata.child_variants": ["direct"]
    },
    "Transitions": {
        "metadata.starting_position": ["direct"],
        "metadata.ending_position": ["direct"],
        "related_content": ["name"]
    },
    "Submissions": {
        "from_positions": ["direct"],
        "related_submissions": ["direct"],
        "related_content": ["name"]
    },
    "Principles": {
        "concept_relationships": ["concept_name"],
        "application_contexts": ["context"],
        "related_content": ["name"]
    },
    "Systems": {
        "related_positions": ["direct"],
        "related_transitions": ["direct"],
        "related_concepts": ["direct"]
    }
}

# Healthy link count ranges per field (min, max)
LINK_COUNT_RANGES = {
    "Positions": {
        "offensive_transitions": (6, 20),
        "defensive_responses": (3, 10),
        "related_content": (3, 15)
    },
    "Transitions": {
        "metadata.starting_position": (1, 1),
        "metadata.ending_position": (1, 1),
        "related_content": (3, 15)
    },
    "Submissions": {
        "from_positions": (2, 10),
        "related_submissions": (3, 15),
        "related_content": (3, 12)
    },
    "Principles": {
        "concept_relationships": (3, 15),
        "application_contexts": (5, 20),
        "related_content": (3, 15)
    },
    "Systems": {
        "related_positions": (5, 25),
        "related_transitions": (5, 25),
        "related_concepts": (5, 20)
    }
}

def build_content_index():
    """Build index of all available content files."""
    index = {}

    for category, path in CATEGORIES.items():
        category_path = Path(path)
        if not category_path.exists():
            continue

        # Find all .json files recursively
        json_files = [
            str(f.relative_to(category_path)).replace('.json', '')
            for f in category_path.rglob("*.json")
        ]

        index[category] = set(json_files)

    return index


def extract_references_from_field(data, field_path, field_config):
    """Extract references from a specific field in the JSON data."""
    references = []

    # Navigate to the field
    parts = field_path.split(".")
    current = data

    for part in parts:
        if part not in current:
            return references
        current = current[part]

    # Extract based on config
    if isinstance(current, list):
        for item in current:
            if field_config == ["direct"]:
                # Item itself is the reference
                if isinstance(item, str):
                    references.append(item)
            else:
                # Item is an object, extract from specified sub-fields
                if isinstance(item, dict):
                    for subfield in field_config:
                        if subfield in item and isinstance(item[subfield], str):
                            references.append(item[subfield])
    elif isinstance(current, str):
        # Direct string reference
        references.append(current)

    return references


def normalize_reference(ref):
    """Normalize a reference to (category, name) tuple."""
    # Handle Category/Name format
    if "/" in ref:
        parts = ref.split("/", 1)
        return (parts[0], parts[1])

    # Just a name without category
    return (None, ref)


def validate_link_counts(data, category, path=""):
    """Validate that reference fields have healthy link counts."""
    errors = []

    # Get link count ranges for this category
    if category not in LINK_COUNT_RANGES:
        return errors

    link_ranges = LINK_COUNT_RANGES[category]

    # Check each reference field
    for field_path, (min_count, max_count) in link_ranges.items():
        references = extract_references_from_field(data, field_path, REFERENCE_FIELDS[category][field_path])
        actual_count = len(references)

        if actual_count < min_count:
            errors.append(
                f"Field '{field_path}': Too few links ({actual_count}) - should have {min_count}-{max_count}"
            )
        elif actual_count > max_count:
            errors.append(
                f"Field '{field_path}': Too many links ({actual_count}) - should have {min_count}-{max_count}"
            )

    return errors


def validate_references(data, category, path=""):
    """Validate all internal references in the file."""
    errors = []

    # Build content index on first call (cached in function)
    if not hasattr(validate_references, 'content_index'):
        validate_references.content_index = build_content_index()

    content_index = validate_references.content_index

    # Get reference fields for this category
    if category not in REFERENCE_FIELDS:
        return errors

    reference_fields = REFERENCE_FIELDS[category]

    # Check link counts first
    link_count_errors = validate_link_counts(data, category, path)
    errors.extend(link_count_errors)

    # Check each reference field for broken links
    for field_path, field_config in reference_fields.items():
        references = extract_references_from_field(data, field_path, field_config)

        for ref in references:
            # Normalize reference
            ref_category, ref_name = normalize_reference(ref)

            # Determine which category to check
            if ref_category:
                # Explicit category specified
                if ref_category not in content_index:
                    errors.append(
                        f"Field '{field_path}': Invalid category in reference '{ref}'"
                    )
                    continue

                # Check if file exists in that category
                if ref_name not in content_index[ref_category]:
                    errors.append(
                        f"Field '{field_path}': Broken link '{ref}' - file not found in {ref_category}/"
                    )
            else:
                # No category specified - search all categories
                found = False
                for cat_name, cat_files in content_index.items():
                    if ref_name in cat_files:
                        found = True
                        break

                if not found:
                    errors.append(
                        f"Field '{field_path}': Broken link '{ref}' - file not found in any category"
                    )

    return errors


def load_schema(category_name):
    """Load TEMPLATE.json schema for category from source/templates/"""
    # For Positions, we have multiple templates in subdirectory
    if category_name == "Positions":
        # Use FAMILY template as the base schema (most comprehensive)
        schema_path = Path("source/templates/Positions/TEMPLATE-POSITION-FAMILY.json")
    else:
        # Other categories use flat structure
        schema_path = Path("source/templates") / f"{category_name}.json"

    if not schema_path.exists():
        print(f"ERROR: Schema not found: {schema_path}")
        sys.exit(1)

    try:
        with open(schema_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in schema {schema_path}: {e}")
        sys.exit(1)


def validate_success_rate_ordering(data, path=""):
    """Validate beginner ≤ intermediate ≤ advanced for all success rates"""
    errors = []

    def check_rates(rates, location):
        # Handle case where rates is not a dict (e.g., int, null, string)
        if not isinstance(rates, dict):
            errors.append(f"{location}: Expected object with beginner/intermediate/advanced, got {type(rates).__name__}")
            return

        if all(k in rates for k in ['beginner', 'intermediate', 'advanced']):
            if rates['beginner'] > rates['intermediate']:
                errors.append(f"{location}: beginner ({rates['beginner']}) > intermediate ({rates['intermediate']})")
            if rates['intermediate'] > rates['advanced']:
                errors.append(f"{location}: intermediate ({rates['intermediate']}) > advanced ({rates['advanced']})")

    # Check metadata success_rates (Transitions/Submissions)
    if 'metadata' in data and 'success_rates' in data['metadata']:
        check_rates(data['metadata']['success_rates'], f"{path}.metadata.success_rates")

    # Check offensive_transitions (Positions)
    if 'offensive_transitions' in data:
        for i, transition in enumerate(data['offensive_transitions']):
            if 'success_rates' in transition:
                check_rates(transition['success_rates'], f"{path}.offensive_transitions[{i}]")

    # Check position_metrics (Positions)
    if 'position_metrics' in data:
        for metric_name in ['retention_rate', 'advancement_probability', 'submission_probability']:
            if metric_name in data['position_metrics']:
                check_rates(data['position_metrics'][metric_name], f"{path}.position_metrics.{metric_name}")

    return errors


def validate_expert_insights(data, path=""):
    """Validate all 3 experts present with 200+ characters"""
    errors = []

    if 'expert_insights' not in data:
        errors.append(f"{path}: Missing expert_insights")
        return errors

    insights = data['expert_insights']
    required_experts = ['danaher', 'gordon_ryan', 'eddie_bravo']

    for expert in required_experts:
        if expert not in insights:
            errors.append(f"{path}.expert_insights: Missing {expert}")
        elif len(insights[expert]) < 200:
            errors.append(f"{path}.expert_insights.{expert}: Only {len(insights[expert])} chars (need 200+)")

    return errors


def validate_variants(data, category, path=""):
    """Validate parent_variant, sibling_variants, child_variants fields (Positions only)"""
    errors = []

    # Only validate for Positions category
    if category != "Positions":
        return errors

    if 'metadata' not in data:
        return errors

    metadata = data['metadata']
    has_parent = 'parent_variant' in metadata
    has_siblings = 'sibling_variants' in metadata
    has_children = 'child_variants' in metadata

    # Validate parent_variant (string if present)
    if has_parent:
        parent = metadata['parent_variant']
        if not isinstance(parent, str):
            errors.append(f"{path}.metadata.parent_variant: Must be a string, got {type(parent).__name__}")

    # Validate sibling_variants (array 1-11 items if present)
    if has_siblings:
        siblings = metadata['sibling_variants']

        if not isinstance(siblings, list):
            errors.append(f"{path}.metadata.sibling_variants: Must be an array")
        elif len(siblings) < 1:
            errors.append(f"{path}.metadata.sibling_variants: Must have at least 1 sibling")
        elif len(siblings) > 11:
            errors.append(f"{path}.metadata.sibling_variants: Too many siblings ({len(siblings)}) - maximum is 11")
        else:
            for i, sibling in enumerate(siblings):
                if not isinstance(sibling, str):
                    errors.append(f"{path}.metadata.sibling_variants[{i}]: Must be a string, got {type(sibling).__name__}")

    # Validate child_variants (array 1-12 items if present)
    if has_children:
        children = metadata['child_variants']

        if not isinstance(children, list):
            errors.append(f"{path}.metadata.child_variants: Must be an array")
        elif len(children) < 1:
            errors.append(f"{path}.metadata.child_variants: Must have at least 1 child variant")
        elif len(children) > 12:
            errors.append(f"{path}.metadata.child_variants: Too many children ({len(children)}) - maximum is 12")
        else:
            for i, child in enumerate(children):
                if not isinstance(child, str):
                    errors.append(f"{path}.metadata.child_variants[{i}]: Must be a string, got {type(child).__name__}")

    # Cross-validation: If parent_variant is set, should have sibling_variants
    if has_parent and not has_siblings:
        errors.append(f"{path}.metadata: Has parent_variant but missing sibling_variants array")

    # Cross-validation: Child files shouldn't have child_variants
    if has_parent and has_children:
        errors.append(f"{path}.metadata: Child variant files should not have child_variants (only parent files)")

    # Cross-validation: Parent files shouldn't have parent_variant or sibling_variants
    if has_children and (has_parent or has_siblings):
        errors.append(f"{path}.metadata: Parent files should not have parent_variant or sibling_variants (only child files)")

    return errors


def validate_json_file(json_path, schema, category, strict=False):
    """Validate a single JSON file against schema"""
    errors = []

    # Load JSON data
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return [f"File not found: {json_path}"]
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]

    # Validate against JSON Schema
    try:
        validate(instance=data, schema=schema)
    except ValidationError as e:
        errors.append(f"Schema validation error: {e.message} at {'.'.join(str(p) for p in e.path)}")

    # Custom validations
    success_rate_errors = validate_success_rate_ordering(data, json_path.name)
    errors.extend(success_rate_errors)

    expert_errors = validate_expert_insights(data, json_path.name)
    errors.extend(expert_errors)

    variant_errors = validate_variants(data, category, json_path.name)
    errors.extend(variant_errors)

    # Reference validation
    reference_errors = validate_references(data, category, json_path.name)
    errors.extend(reference_errors)

    return errors


def validate_category(category, strict=False):
    """Validate all JSON files in a category"""
    if category not in CATEGORIES:
        print(f"ERROR: Unknown category '{category}'")
        sys.exit(1)

    category_path = Path(CATEGORIES[category])

    if not category_path.exists():
        print(f"ERROR: Category path not found: {category_path}")
        sys.exit(1)

    # Load schema
    schema = load_schema(category)

    # Find all JSON files recursively
    json_files = list(category_path.rglob("*.json"))

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return True

    print(f"\nValidating {len(json_files)} files in {category}...")

    total_errors = 0
    failed_files = []

    for json_file in sorted(json_files):
        errors = validate_json_file(json_file, schema, category, strict)

        if errors:
            # Show relative path for nested files
            relative_path = json_file.relative_to(category_path)
            print(f"\n✗ {relative_path}:")
            for error in errors:
                print(f"  - {error}")
            total_errors += len(errors)
            failed_files.append(str(relative_path))
        else:
            relative_path = json_file.relative_to(category_path)
            print(f"✓ {relative_path}")

    print(f"\n{'='*60}")
    if total_errors == 0:
        print(f"✓ {category}: All {len(json_files)} files valid")
        return True
    else:
        print(f"✗ {category}: {len(failed_files)} files failed with {total_errors} errors")
        print(f"Failed files: {', '.join(failed_files)}")
        return False


def validate_all_categories(strict=False):
    """Validate all JSON files in all categories"""
    print("Validating all categories...")

    all_valid = True
    for category in CATEGORIES.keys():
        category_valid = validate_category(category, strict)
        all_valid = all_valid and category_valid

    print(f"\n{'='*60}")
    if all_valid:
        print("✓ ALL CATEGORIES VALID")
        return 0
    else:
        print("✗ VALIDATION FAILED")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Validate BJJ Graph JSON files against TEMPLATE.json schemas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate single file
  python3 scripts/validate_json.py --file source/content/Positions/Mount.json

  # Validate all files in category
  python3 scripts/validate_json.py --category Positions --all

  # Validate all categories
  python3 scripts/validate_json.py --all

  # Strict mode (fail on warnings)
  python3 scripts/validate_json.py --all --strict
        """
    )

    parser.add_argument('--file', help='Path to specific JSON file')
    parser.add_argument('--category', choices=list(CATEGORIES.keys()), help='Category to validate')
    parser.add_argument('--all', action='store_true', help='Validate all files in category or all categories')
    parser.add_argument('--strict', action='store_true', help='Strict mode: fail on warnings')

    args = parser.parse_args()

    # Validate arguments
    if not (args.file or (args.category and args.all) or args.all):
        parser.error("Must specify --file, --category with --all, or just --all")

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

        schema = load_schema(category)
        errors = validate_json_file(json_path, schema, category, args.strict)

        if errors:
            print(f"✗ {json_path.name}:")
            for error in errors:
                print(f"  - {error}")
            sys.exit(1)
        else:
            print(f"✓ {json_path.name}: Valid")
            sys.exit(0)

    elif args.category and args.all:
        valid = validate_category(args.category, args.strict)
        sys.exit(0 if valid else 1)

    elif args.all:
        exit_code = validate_all_categories(args.strict)
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
