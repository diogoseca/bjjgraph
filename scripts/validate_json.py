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
        "related_content": ["name"]
    },
    "Transitions": {
        "starting_position": ["direct"],
        "ending_position": ["direct"],
        "related_content": ["name"]
    },
    "Submissions": {
        "from_positions": ["direct"],
        "related_submissions": ["direct"],
        "related_content": ["name"]
    },
    "Principles": {
        "principle_relationships": ["principle_name"],
        "application_contexts": ["context"],
        "related_content": ["name"]
    },
    "Systems": {
        "related_content": ["name"]
    }
}

# Link count validation is now handled by schema minItems/maxItems
# No need for separate LINK_COUNT_RANGES dict

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


# validate_link_counts() removed - schema minItems/maxItems handles this automatically


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

    # Check each reference field for broken links (link counts validated by schema)
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

                # Special case for nested files: check if this could be a variant reference
                # For hub-and-spoke architecture, files are nested in subfolders
                # Example: "Inside Ashi-Garami" might be at "Ashi Garami/Inside Ashi-Garami"
                if not found:
                    # Check if any nested files match the name (just compare base filename)
                    for cat_name, cat_files in content_index.items():
                        for file_path in cat_files:
                            if '/' in file_path:  # It's a nested file
                                # Get just the filename part (last component)
                                file_name = file_path.split('/')[-1]
                                # Normalize both for comparison (case-insensitive, spaces/hyphens)
                                normalized_file = file_name.lower().replace('-', ' ').replace('_', ' ')
                                normalized_ref = ref_name.lower().replace('-', ' ').replace('_', ' ')
                                if normalized_file == normalized_ref:
                                    found = True
                                    break
                        if found:
                            break

                if not found:
                    errors.append(
                        f"Field '{field_path}': Broken link '{ref}' - file not found in any category"
                    )

    return errors


def detect_position_template_type(json_file):
    """Detect which Positions template to use via filesystem structure"""
    # Check if variant folder exists
    json_path = Path(json_file)
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    if not variant_folder.exists() or not variant_folder.is_dir():
        # No folder = SINGLE
        return 'SINGLE'

    # Folder exists - check if it has .json files
    json_files_in_folder = list(variant_folder.glob("*.json"))

    if len(json_files_in_folder) > 0:
        # Folder with .json files = FAMILY (has variant JSONs)
        return 'FAMILY'
    else:
        # Folder without .json files = DUAL (just .md files)
        return 'DUAL'

def load_schema(category_name, json_file=None):
    """Load TEMPLATE.json schema for category from source/templates/"""
    # For Positions, detect which template to use
    if category_name == "Positions":
        if not json_file:
            raise ValueError("Positions category requires json_file parameter for template detection")

        template_type = detect_position_template_type(json_file)
        schema_path = Path(f"source/templates/Positions/TEMPLATE-POSITION-{template_type}.json")
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

    # Check success_rates at root (Transitions/Submissions)
    if 'success_rates' in data:
        check_rates(data['success_rates'], f"{path}.success_rates")

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


def validate_name_matches_filename(data, json_file_path, category):
    """Validate that name field matches filename"""
    errors = []

    # Get filename without extension
    filename = Path(json_file_path).stem

    # For SINGLE template files (flat structure)
    if 'name' in data and 'bottom' not in data and 'top' not in data:
        if data['name'] != filename:
            errors.append(f"name ('{data['name']}') must match filename ('{filename}')")

    # For DUAL/FAMILY bottom section
    if 'bottom' in data and 'name' in data['bottom']:
        expected_bottom = f"{data.get('name', filename)} Bottom"
        if data['bottom']['name'] != expected_bottom:
            errors.append(f"bottom.name ('{data['bottom']['name']}') should be '{expected_bottom}'")

    # For DUAL/FAMILY top section
    if 'top' in data and 'name' in data['top']:
        expected_top = f"{data.get('name', filename)} Top"
        if data['top']['name'] != expected_top:
            errors.append(f"top.name ('{data['top']['name']}') should be '{expected_top}'")

    return errors

def validate_family_variants(data, json_file_path):
    """Validate FAMILY variations array matches actual variant files in folder

    Note: Slugs in JSON should be kebab-case (e.g., '50-50-guard', 'high-mount').
    Actual filenames may use Title Case with spaces (e.g., '50-50 Guard.json', 'High Mount.json').
    This validation normalizes both for comparison (lowercase, hyphens instead of spaces).
    """
    errors = []

    # Only for FAMILY positions (has variations array)
    if 'variations' not in data:
        return errors

    json_path = Path(json_file_path)
    variant_folder = json_path.parent / json_path.stem  # Always use filename without extension

    if not variant_folder.exists():
        errors.append(f"FAMILY position has variations array but folder not found: {variant_folder}")
        return errors

    # Get actual variant files (normalize to lowercase slugs for comparison)
    actual_files = {f.stem for f in variant_folder.glob("*.json")}
    actual_slugs = {name.lower().replace(' ', '-') for name in actual_files}

    # Get declared variants from variations array (already slugs)
    declared_slugs = {v['slug'].lower() for v in data['variations']}

    # Check for mismatches
    missing_files = declared_slugs - actual_slugs
    undeclared_files = actual_slugs - declared_slugs

    if missing_files:
        errors.append(f"variations array references missing files: {', '.join(missing_files)}")

    if undeclared_files:
        errors.append(f"Folder has variant files not in variations array: {', '.join(undeclared_files)}")

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
    name_errors = validate_name_matches_filename(data, json_path, category)
    errors.extend(name_errors)

    success_rate_errors = validate_success_rate_ordering(data, json_path.name)
    errors.extend(success_rate_errors)

    # Validate FAMILY variations array matches filesystem
    if category == "Positions":
        family_variant_errors = validate_family_variants(data, json_path)
        errors.extend(family_variant_errors)

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

    # Find all JSON files recursively
    json_files = list(category_path.rglob("*.json"))

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return True

    print(f"\nValidating {len(json_files)} files in {category}...")

    total_errors = 0
    failed_files = []

    for json_file in sorted(json_files):
        # Load appropriate schema for this file (Positions uses file-specific detection)
        schema = load_schema(category, json_file)
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

        schema = load_schema(category, json_path)
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
