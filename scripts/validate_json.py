#!/usr/bin/env python3
"""
BJJ Graph JSON Schema Validator
================================
Validates JSON content files against category TEMPLATE.json schemas.

Usage:
    python3 scripts/validate_json.py --file content/Positions/Mount.json
    python3 scripts/validate_json.py --category Positions --all
    python3 scripts/validate_json.py --all
    python3 scripts/validate_json.py --all --strict
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _slug import slugify as _slugify  # shared single-source slugify
from _ruleset import (  # gi/no-gi ruleset contract (calibration-v2)
    RULESETS,
    Number,
    is_ruleset_map,
    any_ruleset_map,
    available,
    cell,
    sum_cells,
    present_rulesets,
)

# When True (--strict-ruleset), probability fields MUST be {gi,nogi} maps; bare
# scalars are rejected. Default False (lenient: accept legacy int OR map) so the
# pre-migration single-int corpus validates byte-identically.
STRICT_RULESET = False

try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("ERROR: jsonschema library not installed")
    print("Install with: pip install jsonschema")
    sys.exit(1)

# Category configurations
CATEGORIES = {
    "Positions": "content/Positions",
    "Transitions": "content/Transitions",
    "Submissions": "content/Submissions",
    "Principles": "content/Principles",
    "Systems": "content/Systems",
    "Learning": "content/Learning"
}

# Reference fields by category
REFERENCE_FIELDS = {
    "Positions": {
        "related_content": ["name"],
        "transitions": ["transition"],
        "top.transitions": ["transition"],
        "bottom.transitions": ["transition"]
    },
    "Transitions": {
        "starting_position": ["direct"],
        "ending_position": ["direct"],
        "from_position": ["direct"],  # Role-based format (e.g., "Mount/Bottom")
        "related_content": ["name"],
        "outcomes": ["to"],
        # Attacker/Defender role references
        "attacker.common_counters": ["targets_outcome"],
        "defender.defensive_options": ["targets_outcome"],
        "defender.favorable_outcomes": ["outcome"]
    },
    "Submissions": {
        "starting_position": ["direct"],
        "from_positions": ["direct"],
        "from_position": ["direct"],   # Role-based format (e.g., "Mount/Top")
        "outcomes": ["to"],
        "related_submissions": ["direct"],
        "related_content": ["name"],
        # Attacker/Defender role references
        "attacker.common_counters": ["targets_outcome"],
        "defender.defensive_options": ["targets_outcome"],
        "defender.favorable_outcomes": ["outcome"]
    },
    "Principles": {
        "principle_relationships": ["principle_name"],
        "application_contexts": ["context"],
        "related_content": ["name"]
    },
    "Systems": {
        "related_content": ["name"]
    },
    "Learning": {
        "related_content": ["name"]
    }
}

# Link count validation is now handled by schema minItems/maxItems
# No need for separate LINK_COUNT_RANGES dict

def build_content_index():
    """Build index of all available content files.

    For nested files (e.g., Submissions/Kimura/from Guard.json), indexes both
    the path form ("Kimura/from Guard") and the reconstructed name form
    ("Kimura from Guard") so references using either format resolve correctly.
    """
    index = {}

    for category, path in CATEGORIES.items():
        category_path = Path(path)
        if not category_path.exists():
            continue

        entries = set()
        for f in category_path.rglob("*.json"):
            rel = str(f.relative_to(category_path)).replace('.json', '')
            entries.add(rel)
            # For nested files, also index by space-joined path
            # "Kimura/from Guard" → also add "Kimura from Guard"
            if '/' in rel:
                entries.add(rel.replace('/', ' '))

        index[category] = entries

    return index


def _normalize_alias_key(s):
    """Normalize a name for alias/disambiguation comparison.

    Delegates to the shared slugify so accented synonyms compare equal to their
    unaccented references ("Mata Leão" == "Mata Leao") and so this comparison
    key can never diverge from the slugs the graph/redirect/template pipeline
    uses. Both sides of every comparison pass through here, so the kebab form
    is fine — it only needs to be a consistent canonical key.
    """
    if not isinstance(s, str):
        return ""
    return _slugify(s)


def build_alias_index():
    """For each JSON file, read its aliases[] field and map alias → canonical filename.

    Returns dict[category] -> dict[normalized_alias] -> canonical_name. Used by the
    three reference-resolution sites (validate_references, validate_position_transitions,
    validate_transition_outcomes) to resolve old references to merged or renamed techniques.
    """
    alias_index = {cat: {} for cat in CATEGORIES.keys()}
    for category, cat_path in CATEGORIES.items():
        path = Path(cat_path)
        if not path.exists():
            continue
        for f in path.rglob("*.json"):
            try:
                with open(f, 'r', encoding='utf-8') as fp:
                    data = json.load(fp)
            except (json.JSONDecodeError, OSError):
                continue
            aliases = data.get('aliases') or []
            if not isinstance(aliases, list) or not aliases:
                continue
            # Canonical lookup name is the file's path-relative form, mirroring build_content_index
            rel = str(f.relative_to(path)).replace('.json', '')
            for alias in aliases:
                if not isinstance(alias, str):
                    continue
                key = _normalize_alias_key(alias)
                if key:
                    alias_index[category][key] = rel
    return alias_index


def resolve_through_alias(alias_index, category, ref_name):
    """Return canonical name if ref_name matches a known alias in this category, else None."""
    if not alias_index or not category or category not in alias_index:
        return None
    return alias_index[category].get(_normalize_alias_key(ref_name))


def resolve_through_alias_any_category(alias_index, ref_name):
    """Try every category. Returns (category, canonical_name) or (None, None)."""
    if not alias_index:
        return (None, None)
    key = _normalize_alias_key(ref_name)
    for cat, m in alias_index.items():
        if key in m:
            return (cat, m[key])
    return (None, None)


def load_do_not_merge():
    """Load the do-not-merge denylist as a set of frozensets for symmetric pair lookup."""
    path = Path("tests/artifacts/do_not_merge.json")
    if not path.exists():
        return set()
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return set()
    pairs = set()
    for pair in data.get('pairs', []):
        if isinstance(pair, list) and len(pair) == 2 and all(isinstance(p, str) for p in pair):
            pairs.add(frozenset({_normalize_alias_key(pair[0]), _normalize_alias_key(pair[1])}))
    return pairs


def find_file_in_category(category, name):
    """Find the JSON file matching 'name' in the given category (case/spacing-insensitive)."""
    cat_path = Path(CATEGORIES.get(category, ''))
    if not cat_path.exists():
        return None
    candidate = cat_path / f"{name}.json"
    if candidate.exists():
        return candidate
    target = _normalize_alias_key(name)
    for f in cat_path.rglob("*.json"):
        if _normalize_alias_key(f.stem) == target:
            return f
    return None


def validate_aliases_not_denylisted(data, json_path, denylist):
    """Hard-fail if any alias on this file is paired with the canonical name in the denylist."""
    errors = []
    aliases = data.get('aliases') or []
    if not isinstance(aliases, list) or not aliases:
        return errors
    canonical_candidates = {_normalize_alias_key(Path(json_path).stem)}
    if 'name' in data and isinstance(data['name'], str):
        canonical_candidates.add(_normalize_alias_key(data['name']))
    for alias in aliases:
        if not isinstance(alias, str):
            continue
        alias_key = _normalize_alias_key(alias)
        for canonical_key in canonical_candidates:
            if alias_key == canonical_key:
                continue
            pair = frozenset({alias_key, canonical_key})
            if pair in denylist:
                errors.append(
                    f"aliases: '{alias}' is denylisted as a false-synonym pairing "
                    f"(see tests/artifacts/do_not_merge.json — synonyms collapse to one file; "
                    f"false synonyms stay separate)"
                )
    return errors


def validate_disambiguations_reciprocal(data, category, json_path):
    """Warn if a disambiguation entry on file A (declaring B) is not reciprocated on file B."""
    warnings = []
    disambiguations = data.get('disambiguations') or []
    if not isinstance(disambiguations, list) or not disambiguations:
        return warnings
    self_name = Path(json_path).stem
    self_key = _normalize_alias_key(self_name)
    for entry in disambiguations:
        if not isinstance(entry, dict):
            continue
        other_name = (entry.get('name') or '').strip()
        if not other_name:
            continue
        # Disambiguation targets can be cross-category (e.g. the North-South Choke
        # submission points at the North-South position), so search every category.
        other_file = find_file_in_category(category, other_name)
        if not other_file:
            for other_cat in CATEGORIES:
                other_file = find_file_in_category(other_cat, other_name)
                if other_file:
                    break
        if not other_file:
            warnings.append(
                f"disambiguations: target '{other_name}' not found in any category"
            )
            continue
        try:
            with open(other_file, 'r', encoding='utf-8') as f:
                other_data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        other_disambs = other_data.get('disambiguations') or []
        reciprocated = any(
            isinstance(d, dict) and _normalize_alias_key(d.get('name') or '') == self_key
            for d in other_disambs
        )
        if not reciprocated:
            warnings.append(
                f"disambiguations: '{other_name}' does not reciprocally declare '{self_name}' "
                f"(disambiguations should be mutual — add the reverse entry on {other_file.name})"
            )
    return warnings


def validate_products(data, category):
    """Warn on curated affiliate products that look unfinished. Non-blocking — products
    are hand-curated; structure is enforced by the schema. Flags placeholder URLs/images
    left over from scaffolding and duplicate product ids within a system."""
    warnings = []
    if category != "Systems":
        return warnings
    products = data.get("products")
    if not isinstance(products, list):
        return warnings
    seen_ids = set()
    for i, p in enumerate(products):
        if not isinstance(p, dict):
            continue
        loc = f"products[{i}]"
        title = p.get("title", loc)
        url = str(p.get("affiliate_url", ""))
        image = str(p.get("image", ""))
        if not url:
            warnings.append(f"{loc} ('{title}'): missing affiliate_url")
        elif "REPLACE_ME" in url or "placehold.co" in image:
            warnings.append(
                f"{loc} ('{title}'): placeholder affiliate_url/image not yet replaced "
                f"with a real BJJFanatics link"
            )
        status = str(p.get("link_status", "")).lower()
        if status and status != "live":
            warnings.append(
                f"{loc} ('{title}'): link_status='{status}' (checked "
                f"{p.get('link_checked') or 'never'}) — this product does NOT render on the page "
                f"or in the app until a human re-opens the URL and confirms it resolves to this "
                f"instructional (CLAUDE.md §7, Systems: product links)"
            )
        pid = p.get("id")
        if pid:
            if pid in seen_ids:
                warnings.append(f"{loc}: duplicate product id '{pid}'")
            seen_ids.add(pid)
    return warnings


def iter_clips_arrays(data):
    """Yield (location, clips_list) for every clips array in a content file:
    root plus any role block (top/bottom/attacker/defender) that carries one."""
    if not isinstance(data, dict):
        return
    if isinstance(data.get("clips"), list):
        yield "clips", data["clips"]
    for role in ("top", "bottom", "attacker", "defender"):
        block = data.get(role)
        if isinstance(block, dict) and isinstance(block.get("clips"), list):
            yield f"{role}.clips", block["clips"]


def validate_clips(data, category):
    """Semantic checks on curated YouTube clips that the schema can't express.
    Returns (errors, warnings): inverted start/end loop bounds are blocking
    (the player would never play); end-past-duration and duplicate ids are
    warnings — clips are machine-verified externally by verify_clips.py."""
    errors = []
    warnings = []
    seen_ids = {}
    for loc, clips in iter_clips_arrays(data):
        for i, clip in enumerate(clips):
            if not isinstance(clip, dict):
                continue
            where = f"{loc}[{i}]"
            cid = clip.get("id")
            start = clip.get("start")
            end = clip.get("end")
            duration = clip.get("duration")
            if isinstance(start, int) and isinstance(end, int) and start >= end:
                errors.append(f"{where} ('{cid}'): start ({start}) must be < end ({end})")
            if isinstance(end, int) and isinstance(duration, int) and end > duration:
                warnings.append(
                    f"{where} ('{cid}'): end ({end}) exceeds video duration ({duration})"
                )
            if cid:
                if cid in seen_ids:
                    warnings.append(
                        f"{where}: duplicate clip id '{cid}' (also at {seen_ids[cid]})"
                    )
                else:
                    seen_ids[cid] = where
    return errors, warnings


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
    """Normalize a reference to (category, name) tuple.

    Handles formats:
    - Category/Name: e.g., "Positions/Mount" -> (category="Positions", name="Mount")
    - Position/Role: e.g., "Mount/Top" -> (category=None, name="Mount")
      Role suffixes "Top", "Bottom", "Attacker", "Defender" indicate Position/Role format.
    """
    if "/" in ref:
        parts = ref.split("/", 1)
        # Check if this is Position/Role format
        # Role suffixes indicate the format, not Category/Name
        if parts[1] in ('Top', 'Bottom', 'Attacker', 'Defender'):
            return (None, parts[0])
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
    if not hasattr(validate_references, 'alias_index'):
        validate_references.alias_index = build_alias_index()

    content_index = validate_references.content_index
    alias_index = validate_references.alias_index

    # Get reference fields for this category
    if category not in REFERENCE_FIELDS:
        return errors

    reference_fields = REFERENCE_FIELDS[category]

    # Check each reference field for broken links (link counts validated by schema)
    for field_path, field_config in reference_fields.items():
        references = extract_references_from_field(data, field_path, field_config)

        for ref in references:
            # Skip special terminal state references
            if isinstance(ref, str) and ref.lower() in {'game-over', 'won by submission', 'lost by submission'}:
                continue

            # Skip TODO placeholders
            if isinstance(ref, str) and ref.strip().upper() == 'TODO':
                continue

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

                # Check if file exists in that category, or if it's an alias for one that does
                if ref_name not in content_index[ref_category]:
                    if not resolve_through_alias(alias_index, ref_category, ref_name):
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

                # Alias fallback — search the alias index across categories
                if not found:
                    cat, _ = resolve_through_alias_any_category(alias_index, ref_name)
                    if cat is not None:
                        found = True

                if not found:
                    errors.append(
                        f"Field '{field_path}': Broken link '{ref}' - file not found in any category"
                    )

    return errors


def detect_position_template_type(json_file):
    """Detect which Positions template to use via filesystem structure + JSON content fallback"""
    # Check if variant folder exists
    json_path = Path(json_file)
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    if variant_folder.exists() and variant_folder.is_dir():
        # Folder exists - check if it has .json files
        json_files_in_folder = list(variant_folder.glob("*.json"))

        if len(json_files_in_folder) > 0:
            # Folder with .json files = FAMILY (has variant JSONs)
            return 'FAMILY'
        else:
            # Folder without .json files = DUAL (just .md files)
            return 'DUAL'

    # No folder - check JSON content for top/bottom keys (like transition detection)
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'top' in data and 'bottom' in data:
            return 'DUAL'
    except (json.JSONDecodeError, FileNotFoundError):
        pass

    return 'SINGLE'

def detect_transition_template_type(json_file):
    """Detect if a Transition/Submission uses FAMILY, DUAL, or SINGLE structure."""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get('is_family') and 'variations' in data:
            return 'FAMILY'
        if 'attacker' in data and 'defender' in data:
            return 'DUAL'
    except (json.JSONDecodeError, FileNotFoundError):
        pass
    return 'SINGLE'


def load_schema(category_name, json_file=None):
    """Load TEMPLATE.json schema for category from templates/"""
    # For Positions, detect which template to use
    if category_name == "Positions":
        if not json_file:
            raise ValueError("Positions category requires json_file parameter for template detection")

        template_type = detect_position_template_type(json_file)
        schema_path = Path(f"templates/Positions/TEMPLATE-{template_type}.json")
    elif category_name in ("Transitions", "Submissions"):
        template_type = detect_transition_template_type(json_file) if json_file else 'SINGLE'
        if template_type in ('DUAL', 'FAMILY'):
            schema_path = Path(f"templates/{category_name}/TEMPLATE-{template_type}.json")
        else:
            schema_path = Path("templates") / f"{category_name}.json"
    else:
        # Other categories use flat structure
        schema_path = Path("templates") / f"{category_name}.json"

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
    """Validate success rates are valid integers 0-100.

    After migration, success_rates is a single integer (success_rate),
    and position_metrics use {value, description} format.
    """
    errors = []

    def check_single_rate(rate, location):
        """Check that a single rate value is 0-100 (scalar or {gi,nogi} map)."""
        if is_ruleset_map(rate):
            # A null cell means the technique does not exist in that ruleset
            # (scripts/_ruleset.py), so it is CORRECTLY unchecked. But an unchecked
            # cell and a checked one printed the same thing — nothing — so count
            # what was actually looked at and fail on zero (CLAUDE.md §6.6). A rate
            # null in BOTH frames is a technique that exists in neither: a deletion
            # somebody wrote as a null.
            checked = 0
            for rs in RULESETS:
                c = rate.get(rs)
                if c is None:
                    continue
                checked += 1
                # UNGUARDED, deliberately out of scope for the null pass: the
                # isinstance(c, int) test lets a float through unchecked (130.0 is
                # silently accepted where 130 errors) and treats True as 1. Zero
                # float and zero bool cells exist in the corpus today (measured
                # over all 1391 success_rate maps), so widening this is a NEW gate,
                # not a null fix, and belongs in its own commit with its own
                # red-proof.
                if isinstance(c, int) and (c < 0 or c > 100):
                    errors.append(f"{location}[{rs}]: value {c} out of range 0-100")
            if checked == 0:
                errors.append(
                    f"{location}: null in BOTH gi and nogi — value unchecked; a rate that "
                    f"exists in neither ruleset means the technique exists in neither, "
                    f"which is a deletion, not a null"
                )
            return
        # A BARE `null` rate falls past every branch below and is reported by
        # nothing here — deliberately, and verified rather than assumed: the
        # schema rejects it first ("Schema validation error: None is not valid
        # under any of the given schemas at success_rate", BLOCKING, exit 1), so a
        # second check here would be a duplicate message, not new coverage. The
        # contract's null is per-FRAME ({gi: null, nogi: null}), which the
        # is_ruleset_map branch above owns. Re-verify with:
        #   python3 -c "import json;p='content/Transitions/100% Sweep.json';d=json.load(open(p));d['success_rate']=None;open('/tmp/x.json','w').write(json.dumps(d))"
        if STRICT_RULESET and isinstance(rate, int):
            errors.append(f"{location}: bare scalar {rate}; expected a {{gi,nogi}} map (--strict-ruleset)")
            return
        if isinstance(rate, int):
            if rate < 0 or rate > 100:
                errors.append(f"{location}: value {rate} out of range 0-100")
        elif isinstance(rate, dict) and 'value' in rate:
            val = rate['value']
            if isinstance(val, int) and (val < 0 or val > 100):
                errors.append(f"{location}: value {val} out of range 0-100")

    # Check success_rate (single int) at root (Transitions/Submissions)
    if 'success_rate' in data:
        check_single_rate(data['success_rate'], f"{path}.success_rate")

    # Legacy: Check success_rates triple if still present
    if 'success_rates' in data and isinstance(data['success_rates'], dict):
        rates = data['success_rates']
        if all(k in rates for k in ['beginner', 'intermediate', 'advanced']):
            if rates['beginner'] > rates['intermediate']:
                errors.append(f"{path}.success_rates: beginner ({rates['beginner']}) > intermediate ({rates['intermediate']})")
            if rates['intermediate'] > rates['advanced']:
                errors.append(f"{path}.success_rates: intermediate ({rates['intermediate']}) > advanced ({rates['advanced']})")

    # Check position_metrics (Positions) - new {value, description} format
    if 'position_metrics' in data:
        for metric_name in ['retention_rate', 'advancement_probability', 'submission_probability']:
            if metric_name in data['position_metrics']:
                metric = data['position_metrics'][metric_name]
                check_single_rate(metric, f"{path}.position_metrics.{metric_name}")

    return errors


def check_probability_sum(dict_items, key, label):
    """The ONE per-ruleset sum gate for a forked probability array.

    Three sites ask this identical question — a position role's
    `transitions[].attempt_probability`, a Transition's `outcomes[].probability`
    and a Submission's `outcomes[].probability`. They were three copies, and when
    the null contract landed each copy needed the same three fixes; per CLAUDE.md
    §6.5 the copies are DELETED rather than synced. `key` and `label` carry the
    only real difference between them (the field name and the message prefix), so
    every string emitted here is byte-identical to what each copy printed.

    THE NULL CONTRACT (`scripts/_ruleset.py`): a cell is `null` when the edge does
    NOT EXIST in that ruleset — distinct from `0` = "exists, ~never attempted".
    `present_rulesets` therefore drops a frame whose cells are all null. That is
    the CORRECT answer to "which frames does this thing exist in", and it is also
    exactly why this function has to count: a dropped frame runs no sum, appends
    no error and prints nothing, so "this frame does not exist" and "nobody
    checked this frame" used to produce identical output. That is CLAUDE.md §6.6,
    the single most repeated defect class in this repo — absence produces a
    plausible answer. The fix here is the one the repo has independently
    reinvented five times: emit a POSITIVE coverage count, hard-fail on zero, and
    make every skip PRINT.

    Returns (errors, notices, frames_checked):
      errors         BLOCKING. A present frame sums wrong; or the value exists in
                     NO ruleset at all (rows present, zero frames checked — the
                     floor breach); or a probability is a bare `null` instead of a
                     per-frame map.
      notices        NON-BLOCKING but PRINTED: one line per absent frame, naming
                     the sum check that was skipped. A ruleset legitimately not
                     existing is data, not a defect — it must never fail the gate,
                     and it must never be silent either.
      frames_checked The positive coverage count: how many ruleset frames actually
                     had their sum verified. Legacy scalar rows report 1 (one
                     frame-agnostic sum ran). Zero with rows present is a defect,
                     never a pass.
    """
    errors = []
    notices = []
    values = [it[key] for it in dict_items if key in it]

    if any_ruleset_map(values):
        # Forked data: each ruleset's available cells must independently sum to 100.
        #
        # A MIXED array is the trap here: one bare `null` beside forked maps takes
        # the forked branch, `sum_cells` drops the null cell from every frame, and
        # the remaining rows can still total 100 — so the row vanished from the sum
        # with no error and no count. Not hypothetical: outcomes
        # [{gi:100,nogi:100}, null] summed to 100 and reported nothing. A row whose
        # value is neither a {gi,nogi} map nor a number contributes to NO frame, so
        # it is counted and NAMED (a row that IS a map with a null cell is the
        # opposite case — that edge legitimately does not exist in that ruleset,
        # contributes 0 there, and must NOT be flagged).
        nonforked = [v for v in values
                     if not (is_ruleset_map(v)
                             or (isinstance(v, Number) and not isinstance(v, bool)))]
        if nonforked:
            errors.append(
                f"{label}: {key} is not a number on {len(nonforked)} of {len(values)} rows "
                f"(first: {nonforked[0]!r}); an edge that does not exist in a ruleset is "
                f"written per-frame as {{gi: null, nogi: null}}, never as a bare null"
            )
        present = present_rulesets(values)
        for rs in present:
            total = sum_cells(dict_items, key, rs)
            if total != 100:
                errors.append(f"{label}: {key}[{rs}] sum is {total:g}, should be 100")
        if not present:
            # Every cell null in BOTH frames. This is not an absent frame, it is a
            # row that exists in no ruleset at all — i.e. a deletion someone wrote
            # as a null. Blocking, because the alternative is the silence above.
            # The wording keeps the literal substring "<key> sum is", which is what
            # validate_json_file's routing keys on to mark a sum failure blocking.
            errors.append(
                f"{label}: {key} sum is UNCHECKED — every cell is null in BOTH gi and "
                f"nogi across {len(values)} rows; an edge that exists in neither ruleset "
                f"is a deletion, not a null"
            )
        else:
            for rs in RULESETS:
                if rs not in present:
                    notices.append(
                        f"{label}: {key}[{rs}] frame ABSENT (all {len(values)} cells null) "
                        f"— sum check SKIPPED"
                    )
        return errors, notices, len(present)

    # Legacy scalar rows (pre-migration). Zero of these in the corpus today; the
    # branch stays so the migration seam remains reversible.
    if STRICT_RULESET:
        errors.append(f"{label}: {key} is a bare scalar; expected {{gi,nogi}} maps (--strict-ruleset)")
    # A bare `null` is NOT the null contract — the contract is per-FRAME, written
    # {gi: null, nogi: null}. The old `sum(it.get(key, 0) ...)` raised
    # "TypeError: unsupported operand type(s) for +: 'int' and 'NoneType'" on one,
    # taking the whole gate down mid-run. Sum only real numbers, then NAME what was
    # excluded — a filter that drops rows silently is the same §6.6 defect.
    # (bool is an int in Python; a boolean probability is a defect, not a 1.)
    nonnumeric = [v for v in values if not isinstance(v, Number) or isinstance(v, bool)]
    total = sum(v for v in values if isinstance(v, Number) and not isinstance(v, bool))
    if nonnumeric:
        errors.append(
            f"{label}: {key} is not a number on {len(nonnumeric)} of {len(values)} rows "
            f"(first: {nonnumeric[0]!r}); an edge that does not exist in a ruleset is "
            f"written per-frame as {{gi: null, nogi: null}}, never as a bare null"
        )
    if total != 100:
        errors.append(f"{label}: {key} sum is {total}, should be 100")
    return errors, notices, 1


def validate_attempt_probability_sum(transitions, path=""):
    """Validate attempt_probability sums to 100% for a transitions array.

    Args:
        transitions: List of transition objects with attempt_probability field
        path: Path string for error messages (e.g., "top.transitions")

    Returns:
        (errors, notices, frames_checked) — see check_probability_sum. `notices`
        are the absent-frame skips: non-blocking, but the caller MUST surface them.
    """
    if not transitions or not isinstance(transitions, list):
        return [], [], 0

    # Check if any transition has attempt_probability.
    # This guard is why the empty case never reaches the seam here: a role that
    # authors no attempt_probability at all is a different (schema) question, and
    # the outcomes callers deliberately DO pass an empty array through, where a
    # 0-sum error is the right answer.
    has_attempt_probability = any(
        isinstance(t, dict) and 'attempt_probability' in t
        for t in transitions
    )

    if not has_attempt_probability:
        return [], [], 0

    dict_transitions = [t for t in transitions if isinstance(t, dict)]
    return check_probability_sum(dict_transitions, 'attempt_probability', path)


def validate_position_transitions(data, category, content_index, path=""):
    """Validate transition references in Position JSONs.

    Checks that each referenced transition in top.transitions and bottom.transitions
    arrays exists as a Transition JSON file.

    Args:
        data: Position JSON data
        category: Category name (should be "Positions")
        content_index: Dict mapping category names to sets of existing files
        path: Path string for error messages

    Returns:
        Tuple of (errors, warnings)
    """
    errors = []
    warnings = []

    if category != "Positions":
        return errors, warnings

    transitions_index = content_index.get("Transitions", set())
    submissions_index = content_index.get("Submissions", set())

    # Lazy-build the alias index once per validation run
    if not hasattr(validate_position_transitions, 'alias_index'):
        validate_position_transitions.alias_index = build_alias_index()
    alias_index = validate_position_transitions.alias_index

    def check_transitions_array(transitions_array, section_path):
        """Check a transitions array for missing transition references."""
        if not transitions_array or not isinstance(transitions_array, list):
            return

        for i, t in enumerate(transitions_array):
            if not isinstance(t, dict):
                continue

            transition_name = t.get('transition')
            if not transition_name:
                continue

            # Normalize the transition name for lookup
            # Strip potential path prefixes
            normalized_name = transition_name.split('/')[-1] if '/' in transition_name else transition_name

            # Check if transition exists
            found = normalized_name in transitions_index

            # Also check nested paths (e.g., "Folder/Transition Name")
            if not found:
                for existing in transitions_index:
                    if existing.endswith(f"/{normalized_name}") or existing == normalized_name:
                        found = True
                        break
                    # Normalize comparison
                    existing_name = existing.split('/')[-1] if '/' in existing else existing
                    if existing_name.lower().replace('-', ' ').replace('_', ' ') == \
                       normalized_name.lower().replace('-', ' ').replace('_', ' '):
                        found = True
                        break

            # Also check Submissions (positions can reference finishes directly)
            if not found:
                for existing in submissions_index:
                    if existing.endswith(f"/{normalized_name}") or existing == normalized_name:
                        found = True
                        break
                    existing_name = existing.split('/')[-1] if '/' in existing else existing
                    if existing_name.lower().replace('-', ' ').replace('_', ' ') == \
                       normalized_name.lower().replace('-', ' ').replace('_', ' '):
                        found = True
                        break

            # Alias fallback — resolve old names through the alias map
            if not found:
                if resolve_through_alias(alias_index, "Transitions", normalized_name) or \
                   resolve_through_alias(alias_index, "Submissions", normalized_name):
                    found = True

            if not found:
                warnings.append(
                    f"{section_path}[{i}].transition: Transition '{transition_name}' not found in Transitions/ or Submissions/"
                )

        # Validate attempt_probability sum.
        # `notices` are absent-ruleset-frame skips. They ride the WARNINGS channel
        # on purpose: a move that does not exist in gi is data, so it must not fail
        # the gate — but it must still print, or an absent frame reads exactly like
        # a checked one (CLAUDE.md §6.6).
        prob_errors, prob_notices, _frames_checked = validate_attempt_probability_sum(
            transitions_array, section_path
        )
        errors.extend(prob_errors)
        warnings.extend(prob_notices)

    # Check top.transitions
    if 'top' in data and isinstance(data['top'], dict):
        check_transitions_array(data['top'].get('transitions'), f"{path}top.transitions")

    # Check bottom.transitions
    if 'bottom' in data and isinstance(data['bottom'], dict):
        check_transitions_array(data['bottom'].get('transitions'), f"{path}bottom.transitions")

    # Check root-level transitions (SINGLE positions)
    if 'transitions' in data and isinstance(data['transitions'], list):
        check_transitions_array(data['transitions'], f"{path}transitions")

    return errors, warnings


def validate_transition_outcomes(data, category, content_index, path=""):
    """Validate outcomes array in Transition JSONs.

    For Transition JSONs with outcomes array, validates:
    - outcomes[].probability sums to 100%
    - Each outcome has valid result (success, failure, or counter)
    - Each 'to' position reference is valid

    Args:
        data: Transition JSON data
        category: Category name (should be "Transitions")
        content_index: Dict mapping category names to sets of existing files
        path: Path string for error messages

    Returns:
        (sum_errors, link_errors, notices).

        The two error lists are SEPARATE because they are routed differently and
        the routing used to be a substring test — `if "probability sum" in err` —
        which is a selector scoped to somebody else's wording rather than a marker
        this function owns (CLAUDE.md §6.7). It silently misfiled the null
        contract's new bare-null error as NON-blocking here while the Submissions
        branch, asking the identical question through the identical seam, made it
        BLOCKING. Returning the two lists apart makes the routing structural, so a
        message added later cannot land in the wrong channel by not containing a
        phrase. `notices` are absent-ruleset-frame skips: never blocking, but the
        caller must surface them (see check_probability_sum).
    """
    errors = []
    link_errors = []
    notices = []

    if category != "Transitions":
        return errors, link_errors, notices

    outcomes = data.get('outcomes')
    if not outcomes or not isinstance(outcomes, list):
        return errors, link_errors, notices

    positions_index = content_index.get("Positions", set())
    submissions_index = content_index.get("Submissions", set())
    valid_results = {'success', 'failure', 'counter'}

    # Lazy-build alias index once
    if not hasattr(validate_transition_outcomes, 'alias_index'):
        validate_transition_outcomes.alias_index = build_alias_index()
    alias_index = validate_transition_outcomes.alias_index

    # Validate probability sum (per-ruleset when forked; legacy single-sum otherwise).
    # One shared seam with the position and Submission sites — see check_probability_sum.
    dict_outcomes = [o for o in outcomes if isinstance(o, dict)]
    sum_errors, sum_notices, _frames_checked = check_probability_sum(
        dict_outcomes, 'probability', f"{path}outcomes"
    )
    # `_frames_checked` is deliberately unused at every call site: the FLOOR it
    # would guard (rows present, zero frames verified) is enforced INSIDE
    # check_probability_sum, which turns it into a blocking error there rather
    # than trusting three callers to remember. It stays in the signature because
    # it is the seam's positive coverage count and a future aggregate consumer
    # must not have to re-derive it.
    errors.extend(sum_errors)
    notices.extend(sum_notices)

    # Validate each outcome
    for i, outcome in enumerate(outcomes):
        if not isinstance(outcome, dict):
            link_errors.append(f"{path}outcomes[{i}]: expected object, got {type(outcome).__name__}")
            continue

        # Validate result field
        result = outcome.get('result')
        if result and result not in valid_results:
            link_errors.append(
                f"{path}outcomes[{i}].result: '{result}' is not valid. "
                f"Must be one of: {', '.join(sorted(valid_results))}"
            )

        # Validate 'to' position reference
        to_position = outcome.get('to')
        if to_position:
            # Handle special terminal states
            if to_position.lower() in {'game-over', 'won by submission', 'lost by submission'}:
                continue

            # Normalize: extract position name (first part before Role suffix)
            normalized = to_position.split('/')[0] if '/' in to_position else to_position

            # Check positions first, then submissions
            found = normalized in positions_index or normalized in submissions_index

            if not found:
                for existing in list(positions_index) + list(submissions_index):
                    existing_name = existing.split('/')[-1] if '/' in existing else existing
                    if existing_name.lower().replace('-', ' ').replace('_', ' ') == \
                       normalized.lower().replace('-', ' ').replace('_', ' '):
                        found = True
                        break

            # Alias fallback
            if not found:
                if resolve_through_alias(alias_index, "Positions", normalized) or \
                   resolve_through_alias(alias_index, "Submissions", normalized):
                    found = True

            if not found:
                link_errors.append(
                    f"{path}outcomes[{i}].to: '{to_position}' not found in Positions/ or Submissions/"
                )

    return errors, link_errors, notices


def validate_role_consistency(data, category, path=""):
    """Validate from_position in Transitions matches valid Position/Role format.

    Valid formats:
    - "Position Name" (just position)
    - "Position Name/Top" (position with top role)
    - "Position Name/Bottom" (position with bottom role)

    Args:
        data: Transition JSON data
        category: Category name (should be "Transitions")
        path: Path string for error messages

    Returns:
        List of error messages
    """
    errors = []

    if category != "Transitions":
        return errors

    from_position = data.get('from_position')
    if not from_position:
        return errors

    valid_roles = {'Top', 'Bottom'}

    # Check format
    if '/' in from_position:
        parts = from_position.split('/')
        if len(parts) == 2:
            position_name, role = parts
            if role not in valid_roles:
                errors.append(
                    f"{path}from_position: Role '{role}' in '{from_position}' is not valid. "
                    f"Must be one of: {', '.join(sorted(valid_roles))}"
                )
        elif len(parts) > 2:
            errors.append(
                f"{path}from_position: '{from_position}' has too many path components. "
                f"Expected format: 'Position Name' or 'Position Name/Role'"
            )

    return errors


def validate_targets_outcome(data, category, path=""):
    """Validate that targets_outcome values in attacker/defender match outcomes[].to values.

    For files with attacker/defender structure, checks:
    - attacker.common_counters[].targets_outcome must be in outcomes[].to
    - defender.defensive_options[].targets_outcome must be in outcomes[].to
    - defender.favorable_outcomes[].outcome must be in outcomes[].to
    """
    errors = []

    if category not in ("Transitions", "Submissions"):
        return errors

    if 'attacker' not in data or 'defender' not in data:
        return errors

    # Build set of valid outcome targets
    valid_targets = set()
    for outcome in data.get('outcomes', []):
        to_val = outcome.get('to', '')
        if to_val:
            valid_targets.add(to_val)

    # Skip validation if all targets are TODO
    if valid_targets == {'TODO'} or not valid_targets:
        return errors

    # Check attacker.common_counters[].targets_outcome
    for i, counter in enumerate(data.get('attacker', {}).get('common_counters', [])):
        target = counter.get('targets_outcome', '')
        if target and target != 'TODO' and target not in valid_targets:
            errors.append(
                f"{path}attacker.common_counters[{i}].targets_outcome: "
                f"'{target}' not found in outcomes[].to"
            )

    # Check defender.defensive_options[].targets_outcome
    for i, option in enumerate(data.get('defender', {}).get('defensive_options', [])):
        target = option.get('targets_outcome', '')
        if target and target != 'TODO' and target not in valid_targets:
            errors.append(
                f"{path}defender.defensive_options[{i}].targets_outcome: "
                f"'{target}' not found in outcomes[].to"
            )

    # Check defender.favorable_outcomes[].outcome
    for i, fav in enumerate(data.get('defender', {}).get('favorable_outcomes', [])):
        target = fav.get('outcome', '')
        if target and target != 'TODO' and target not in valid_targets:
            errors.append(
                f"{path}defender.favorable_outcomes[{i}].outcome: "
                f"'{target}' not found in outcomes[].to"
            )

    return errors


def validate_name_matches_filename(data, json_file_path, category):
    """Validate that name field matches filename"""
    errors = []

    # Get filename without extension
    json_path = Path(json_file_path)
    filename = json_path.stem

    # For SINGLE template files (flat structure)
    if 'name' in data and 'bottom' not in data and 'top' not in data:
        name = data['name']
        # For nested submission variants (e.g., Submissions/Americana/from 3-4 Mount.json),
        # the name is the full form "Americana from 3-4 Mount" while filename is "from 3-4 Mount".
        # Accept if name ends with filename (family prefix + filename = full name).
        name_matches = (name == filename) or (name.endswith(f" {filename}") and filename.startswith("from "))
        if not name_matches:
            errors.append(f"name ('{name}') must match filename ('{filename}')")

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
    """Validate a single JSON file against schema.

    Returns:
        Tuple of (errors, warnings, categories) where categories is a dict
        with 'blocking' and 'non_blocking' lists for error severity.
    """
    errors = []
    warnings = []
    categories = {"blocking": [], "non_blocking": []}

    # Load JSON data
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        msg = f"File not found: {json_path}"
        return [msg], [], {"blocking": [msg], "non_blocking": []}
    except json.JSONDecodeError as e:
        msg = f"Invalid JSON: {e}"
        return [msg], [], {"blocking": [msg], "non_blocking": []}

    # Validate against JSON Schema → blocking
    try:
        validate(instance=data, schema=schema)
    except ValidationError as e:
        msg = f"Schema validation error: {e.message} at {'.'.join(str(p) for p in e.path)}"
        errors.append(msg)
        categories["blocking"].append(msg)

    # Name mismatch → non_blocking
    name_errors = validate_name_matches_filename(data, json_path, category)
    errors.extend(name_errors)
    categories["non_blocking"].extend(name_errors)

    # Success rate ordering → blocking
    success_rate_errors = validate_success_rate_ordering(data, json_path.name)
    errors.extend(success_rate_errors)
    categories["blocking"].extend(success_rate_errors)

    # Validate FAMILY variations → non_blocking
    if category == "Positions":
        family_variant_errors = validate_family_variants(data, json_path)
        errors.extend(family_variant_errors)
        categories["non_blocking"].extend(family_variant_errors)

    # Reference validation → non_blocking
    reference_errors = validate_references(data, category, json_path.name)
    errors.extend(reference_errors)
    categories["non_blocking"].extend(reference_errors)

    # Alias denylist (do-not-merge) → blocking
    if not hasattr(validate_json_file, 'do_not_merge'):
        validate_json_file.do_not_merge = load_do_not_merge()
    denylist_errors = validate_aliases_not_denylisted(data, json_path, validate_json_file.do_not_merge)
    errors.extend(denylist_errors)
    categories["blocking"].extend(denylist_errors)

    # Disambiguation reciprocity → non_blocking (warnings about asymmetric pairs)
    disamb_warnings = validate_disambiguations_reciprocal(data, category, json_path)
    warnings.extend(disamb_warnings)
    categories["non_blocking"].extend(disamb_warnings)

    # Curated affiliate products → non_blocking (placeholder/duplicate-id checks)
    product_warnings = validate_products(data, category)
    warnings.extend(product_warnings)
    categories["non_blocking"].extend(product_warnings)

    # Curated YouTube clips → inverted loop bounds blocking, the rest warnings
    clip_errors, clip_warnings = validate_clips(data, category)
    errors.extend(clip_errors)
    categories["blocking"].extend(clip_errors)
    warnings.extend(clip_warnings)
    categories["non_blocking"].extend(clip_warnings)

    # Build content index for cross-file validation (cached in function)
    if not hasattr(validate_json_file, 'content_index'):
        validate_json_file.content_index = build_content_index()
    content_index = validate_json_file.content_index

    # Validate Position transitions array (references to Transitions)
    if category == "Positions":
        transition_errors, transition_warnings = validate_position_transitions(
            data, category, content_index, json_path.name + ":"
        )
        # attempt_probability sum errors → blocking, link warnings → non_blocking
        for err in transition_errors:
            errors.append(err)
            categories["blocking"].append(err)
        for warn in transition_warnings:
            warnings.append(warn)
            categories["non_blocking"].append(warn)

    # Validate Transition outcomes array
    if category == "Transitions" and isinstance(data, dict):
        outcome_sum_errors, outcome_link_errors, outcome_notices = validate_transition_outcomes(
            data, category, content_index, json_path.name + ":"
        )
        # STRUCTURAL routing, not a substring test. Everything check_probability_sum
        # emits is a probability defect and is BLOCKING — the wrong sum, the value
        # that exists in no ruleset, the bare null. The old `if "probability sum" in
        # err` keyed on wording rather than on a marker this code owns, so the null
        # contract's new bare-null error ("… is not a number on N of M rows") fell
        # through to NON_BLOCKING here while the Submissions branch — the same
        # question, the same seam — made it blocking. Order is unchanged: the sum
        # errors were already extended first.
        for err in outcome_sum_errors:
            errors.append(err)
            categories["blocking"].append(err)
        # Link errors (a bad `to`, a bad `result`) stay non-blocking, as before.
        for err in outcome_link_errors:
            errors.append(err)
            categories["non_blocking"].append(err)
        # Absent-frame skips: NOT a defect (the edge genuinely does not exist in
        # that ruleset), so they never fail the gate — but they print, so a corpus
        # quietly shedding a ruleset is visible instead of silent (CLAUDE.md §6.6).
        for note in outcome_notices:
            warnings.append(note)
            categories["non_blocking"].append(note)

        # Role consistency → non_blocking
        role_errors = validate_role_consistency(data, category, json_path.name + ":")
        errors.extend(role_errors)
        categories["non_blocking"].extend(role_errors)

    # Validate Submission outcomes array (new finish submissions)
    if category == "Submissions" and isinstance(data, dict):
        outcomes = data.get('outcomes')
        if outcomes and isinstance(outcomes, list):
            # Same question as the Transitions branch above, so it is the SAME
            # SEAM — this used to be a verbatim copy of it, which is how the null
            # contract needed the identical three fixes in two places (CLAUDE.md
            # §6.5: collapse to one named seam and DELETE the copy).
            # Blast radius, because a wrong SET is the usual way this number rots
            # (§6.9): 298 Submission files carry an `outcomes` array. Only 3 of
            # them sit at the root of Submissions/ — count them with `glob` instead
            # of `rglob` and you get "3", which is the set the validator does NOT
            # walk. Recompute:
            #   python3 -c "import json;from pathlib import Path;print(sum(1 for p in Path('content/Submissions').rglob('*.json') if isinstance(json.load(open(p)),dict) and json.load(open(p)).get('outcomes')))"
            dict_outcomes = [o for o in outcomes if isinstance(o, dict)]
            sum_errors, sum_notices, _frames_checked = check_probability_sum(
                dict_outcomes, 'probability', f"{json_path.name}:outcomes"
            )
            for err in sum_errors:
                errors.append(err)
                categories["blocking"].append(err)
            for note in sum_notices:
                warnings.append(note)
                categories["non_blocking"].append(note)

            # Validate each outcome
            valid_results = {'success', 'failure', 'counter'}
            for i, outcome in enumerate(outcomes):
                if not isinstance(outcome, dict):
                    continue
                result = outcome.get('result')
                if result and result not in valid_results:
                    err = f"{json_path.name}:outcomes[{i}].result: '{result}' not valid"
                    errors.append(err)
                    categories["blocking"].append(err)

        # Validate from_position role format
        from_position = data.get('from_position')
        if from_position and '/' in from_position:
            parts = from_position.split('/')
            valid_roles = {'Top', 'Bottom'}
            if len(parts) == 2 and parts[1] not in valid_roles:
                err = f"{json_path.name}:from_position: Role '{parts[1]}' not valid. Must be Top or Bottom"
                errors.append(err)
                categories["non_blocking"].append(err)

    # Validate targets_outcome consistency for attacker/defender files
    if category in ("Transitions", "Submissions") and isinstance(data, dict):
        target_errors = validate_targets_outcome(data, category, json_path.name + ":")
        errors.extend(target_errors)
        categories["non_blocking"].extend(target_errors)

    return errors, warnings, categories


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
    total_warnings = 0
    failed_files = []

    for json_file in sorted(json_files):
        # Load appropriate schema for this file (Positions uses file-specific detection)
        schema = load_schema(category, json_file)
        errors, warnings, cats = validate_json_file(json_file, schema, category, strict)

        # Show relative path for nested files
        relative_path = json_file.relative_to(category_path)

        # Severity gate (matches ci-validate.yml charter: the HARD gate fails on
        # SCHEMA BREAKS only). BLOCKING = schema failures / attempt-sum errors /
        # invalid-category refs → hard fail. NON_BLOCKING (broken related_content
        # links, name mismatches, disambiguation/product warnings) + plain warnings
        # are surfaced but do NOT fail the gate. `--strict` escalates everything.
        blocking = cats["blocking"]
        non_blocking = cats["non_blocking"]
        cat_all = set(blocking) | set(non_blocking)
        extra_warnings = [w for w in warnings if w not in cat_all]
        soft = non_blocking + extra_warnings  # non-failing signals

        if blocking or (strict and soft):
            print(f"\n✗ {relative_path}:")
            for error in blocking:
                print(f"  - BLOCKING: {error}")
            for error in non_blocking:
                print(f"  - NON_BLOCKING: {error}")
            for warning in extra_warnings:
                print(f"  - WARNING: {warning}")
            total_errors += len(blocking)
            if strict:
                total_errors += len(soft)
            failed_files.append(str(relative_path))
        elif soft:
            print(f"⚠ {relative_path}:")
            for warning in non_blocking:
                print(f"  - NON_BLOCKING: {warning}")
            for warning in extra_warnings:
                print(f"  - WARNING: {warning}")
            total_warnings += len(soft)
        else:
            print(f"✓ {relative_path}")

    print(f"\n{'='*60}")
    if total_errors == 0:
        if total_warnings > 0:
            print(f"✓ {category}: All {len(json_files)} files valid ({total_warnings} warnings)")
        else:
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
  python3 scripts/validate_json.py --file content/Positions/Mount.json

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
    parser.add_argument('--strict-ruleset', action='store_true',
                        help='Require probability fields to be {gi,nogi} maps (post dual-ruleset migration)')

    args = parser.parse_args()

    global STRICT_RULESET
    STRICT_RULESET = args.strict_ruleset

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
        errors, warnings, cats = validate_json_file(json_path, schema, category, args.strict)

        if errors or (warnings and args.strict):
            print(f"✗ {json_path.name}:")
            for error in cats["blocking"]:
                print(f"  - BLOCKING: {error}")
            for error in cats["non_blocking"]:
                print(f"  - NON_BLOCKING: {error}")
            cat_all = set(cats["blocking"]) | set(cats["non_blocking"])
            for warning in warnings:
                if warning not in cat_all:
                    print(f"  - WARNING: {warning}")
            sys.exit(1)
        elif warnings:
            print(f"⚠ {json_path.name}: Valid with warnings")
            for warning in warnings:
                print(f"  - WARNING: {warning}")
            sys.exit(0)
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
