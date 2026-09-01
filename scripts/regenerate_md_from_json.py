#!/usr/bin/env python3
"""
BJJ Graph JSON to Markdown Generator
====================================
Generates markdown files from JSON data using category-specific Jinja2 templates.

Usage:
    python3 scripts/json_to_md.py --file content/Positions/Mount.json
    python3 scripts/json_to_md.py --category Positions --all
    python3 scripts/json_to_md.py --all
    python3 scripts/json_to_md.py --all --dry-run
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path
from jinja2 import Template, Environment, FileSystemLoader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _slug import slugify  # shared single-source slugify
from _ruleset import reduce_to_scalar  # collapse mirror {gi,nogi} maps at load (calibration-v2)
from _votes import migrate_entry, folded_rate  # published (folded-votes) rate for display (2.3)


_VOTE_RATES_CACHE = None


def _display_rate(name, fallback):
    """The PUBLISHED success rate to render in the technique text: the folded-votes value (calibrated
    prior blended with community votes) at the no-gi default frame — the SAME source graph.json uses,
    so the page text and the graph/game agree. Falls back to the content value when a technique has no
    votes entry (e.g. family hubs, which are aggregate)."""
    global _VOTE_RATES_CACHE
    if _VOTE_RATES_CACHE is None:
        _VOTE_RATES_CACHE = {}
        vf = Path(__file__).resolve().parent.parent / 'templates' / 'votes.json'
        try:
            with open(vf, encoding='utf-8') as f:
                vd = json.load(f)
            for n, entry in vd.get('votes', {}).items():
                _VOTE_RATES_CACHE[n] = int(round(folded_rate(migrate_entry(entry), 'nogi')))
        except (json.JSONDecodeError, OSError):
            _VOTE_RATES_CACHE = {}
    r = _VOTE_RATES_CACHE.get(name)
    return r if r is not None else fallback

try:
    import jsonschema
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


# Shared Jinja2 environment with custom filters. slugify comes from scripts/_slug.py
# (single source of truth shared with the graph, redirect, and validation scripts).
def _jsonstr(v):
    """A JSON string literal, safe to sit inside a <script> block.

    THE FILTER EXISTS BECAUSE THE TEMPLATES WRITE JSON BY HAND. Every schema block interpolates
    authored prose into a JSON string literal (`"text": "{{ qa.answer }}"`), and Jinja has no idea
    it is writing JSON — one `"` in the prose ends the string early and the whole JSON-LD block
    becomes unparseable, silently. `scripts/check_schema_jsonld.py` is the gate; this is the fix.

    NOT Jinja's built-in `| tojson`, deliberately: that one HTML-escapes `'` to `\u0027`, which is
    correct but rewrites every apostrophe in 3,810 generated files — a 19,364-line diff whose whole
    content is cosmetic. This escapes what JSON requires (via json.dumps) plus the three characters
    that can end a <script> early, and leaves apostrophes alone. Measured: the corpus diff drops to
    the handful of files that were actually broken.
    """
    s = json.dumps("" if v is None else str(v), ensure_ascii=False)
    return s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


_JINJA_ENV = Environment()
_JINJA_ENV.filters["jsonstr"] = _jsonstr
_JINJA_ENV.filters["slugify"] = slugify


def _quartz_url_slug(name: str) -> str:
    """URL path segment matching Quartz / regenerate_graph.quartz_slug (case-preserving,
    spaces->hyphens). Used to build hrefs to content pages from raw HTML."""
    s = str(name).strip()
    s = s.replace('&', '-and-').replace('%', '-percent').replace('?', '').replace('#', '')
    s = re.sub(r'\s+', '-', s)
    return s


def _with_utm(url, system_name='', product_id=''):
    """Append BJJGraph UTM params to a curated affiliate URL for the PostHog funnel.
    Never touches the vendor's existing query (e.g. ref=) — only adds utm_*."""
    if not url:
        return url
    from urllib.parse import quote
    params = ['utm_source=bjjgraph', 'utm_medium=affiliate', 'utm_campaign=systems']
    if system_name:
        params.append('utm_content=' + quote(_quartz_url_slug(system_name).lower()))
    if product_id:
        params.append('utm_term=' + quote(str(product_id)))
    sep = '&' if '?' in str(url) else '?'
    return str(url) + sep + '&'.join(params)


_JINJA_ENV.filters["with_utm"] = _with_utm


def build_wikilink_resolver():
    """Build name->category lookup for unambiguous wikilinks.

    Returns the `resolve` callable, with two predicates attached as attributes:
    `resolve.page_exists(name)` and `resolve.family_exists(name)`. Templates use
    these to render a wikilink ONLY when its target file actually exists,
    falling back to plain text otherwise — so `family:` and `disambiguations[]`
    entries that point at not-yet-created pages don't emit dangling links (H6).
    """
    index = {}
    for category, folder in CATEGORIES.items():
        folder_path = Path(folder)
        if not folder_path.exists():
            continue
        for json_file in folder_path.rglob("*.json"):
            name = json_file.stem
            if name not in index:  # first-found wins (Positions > Transitions > Submissions)
                rel = json_file.relative_to(folder_path).parent
                if str(rel) == '.':
                    index[name] = category
                else:
                    index[name] = f"{category}/{rel}"

    # Family hubs live under content/Families/ (created in epic phase 14). Track
    # them separately so the "Part of the X family" link only fires once the hub exists.
    family_names = set()
    families_dir = Path("content/Families")
    if families_dir.exists():
        for json_file in families_dir.rglob("*.json"):
            family_names.add(json_file.stem)

    # Alias map: a reference to a merged/renamed technique's name (e.g. "Bullfighter
    # Pass" after it merged into Toreando Pass) should wikilink to the CANONICAL page,
    # not dangle. Map slugify(alias) -> canonical resolved path ("Category/Name").
    alias_to_canonical = {}
    for category, folder in CATEGORIES.items():
        folder_path = Path(folder)
        if not folder_path.exists():
            continue
        for json_file in folder_path.rglob("*.json"):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if not isinstance(data, dict):
                continue
            canonical_name = json_file.stem
            rel = json_file.relative_to(folder_path).parent
            canonical_path = canonical_name if str(rel) == '.' else None
            cat_prefix = category if str(rel) == '.' else f"{category}/{rel}"

            # THE DISPLAY NAME IS ITS OWN ALIAS whenever it differs from the filename.
            # `index` is keyed by FILE STEM and `resolve()` renders f"{index[name]}/{name}", so the
            # key has to BE the filename — which a nested submission's name is not: the record
            # named "Armbar from Crucifix" lives at Submissions/Armbar/from Crucifix.json, stem
            # "from Crucifix". Every related_content entry naming it therefore missed the index and
            # fell through to `return name`, emitting a BARE `[[Armbar from Crucifix]]`. Quartz
            # resolves a bare wikilink by FILENAME, no file has that name, and the link dangles.
            # MEASURED at v1.155.0: 481 dangling internal links across 291 distinct targets.
            # The alias path is the right seam because it returns a FULL PATH rather than being
            # re-suffixed with the key. `index` is still consulted first, so a real page always
            # wins and this can only ever rescue a name that resolves to nothing today.
            display = data.get("name")
            if isinstance(display, str) and display.strip() and display != canonical_name:
                alias_to_canonical.setdefault(slugify(display), f"{cat_prefix}/{canonical_name}")

            aliases = data.get("aliases")
            if not isinstance(aliases, list) or not aliases:
                continue
            for alias in aliases:
                if isinstance(alias, str) and alias.strip():
                    alias_to_canonical.setdefault(slugify(alias), f"{cat_prefix}/{canonical_name}")

    # Reverse system membership: which Systems reference each node. Powers the
    # "Related Systems" CTA cards on every node page (the funnel's entry point).
    # Built from each system's related_content[] — the same canonical edge list the
    # graph uses for membership — so cards and graph highlight stay consistent.
    reverse_systems = {}  # slugify(node_name) -> [card dict, ...]
    systems_dir = Path("content/Systems")
    if systems_dir.exists():
        for json_file in sorted(systems_dir.glob("*.json")):
            try:
                sdata = json.loads(json_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            sys_name = sdata.get("name") or json_file.stem
            related = sdata.get("related_content") or []
            member_count = sum(
                1 for it in related
                if isinstance(it, dict)
                and (it.get("content_type") or "") != "System"
                and (it.get("name") or "").strip()
            )
            base_card = {
                "system_name": sys_name,
                "system_url": "/Systems/" + _quartz_url_slug(sys_name),
                "system_slug": "systems/" + _quartz_url_slug(sys_name).lower(),
                "system_type": sdata.get("system_type", ""),
                "difficulty": sdata.get("difficulty_level", ""),
                "member_count": member_count,
            }
            for it in related:
                if not isinstance(it, dict) or (it.get("content_type") or "") == "System":
                    continue
                nm = (it.get("name") or "").strip()
                if not nm:
                    continue
                card = dict(base_card, relationship=it.get("relationship", ""))
                reverse_systems.setdefault(slugify(nm), []).append(card)

    def related_systems_html(node_name):
        """Render the 'Related Systems' CTA card section for a node, or '' if none.

        Cards are crawlable internal <a> links to system pages (no affiliate links —
        those live only on system pages). data-* attributes feed the PostHog funnel.
        """
        if not node_name:
            return ""
        cards = reverse_systems.get(slugify(node_name))
        if not cards:
            return ""
        # Dedupe by system (a node may be listed twice), keep the richest relationship,
        # order by how much of the system this node unlocks.
        by_sys = {}
        for c in cards:
            existing = by_sys.get(c["system_slug"])
            if existing is None or len(c.get("relationship", "")) > len(existing.get("relationship", "")):
                by_sys[c["system_slug"]] = c
        ordered = sorted(by_sys.values(), key=lambda c: (-c["member_count"], c["system_name"]))

        parts = [
            '<section id="related-systems" class="content-section related-systems">',
            '',
            '## Train this with a System',
            '',
            '<div class="related-systems-grid">',
        ]
        for c in ordered:
            name_e = html.escape(c["system_name"])
            rel_e = html.escape(c.get("relationship") or "")
            n = c["member_count"]
            badge = f"Unlocks {n} technique" + ("s" if n != 1 else "")
            chips = ""
            if c["difficulty"]:
                chips += f'<span class="system-card__chip">{html.escape(c["difficulty"])}</span>'
            if c["system_type"]:
                chips += f'<span class="system-card__chip">{html.escape(c["system_type"])}</span>'
            parts.append(
                f'<a class="system-card" href="{html.escape(c["system_url"])}" '
                f'data-cta="related-system-card" data-system-slug="{html.escape(c["system_slug"])}" '
                f'data-system-name="{name_e}" data-member-count="{n}">'
                '<span class="system-card__shine" aria-hidden="true"></span>'
                '<span class="system-card__type-chip">System</span>'
                f'<span class="system-card__name">{name_e}</span>'
                f'<span class="system-card__unlocks-badge">{badge}</span>'
                + (f'<span class="system-card__blurb">{rel_e}</span>' if rel_e else '')
                + (f'<span class="system-card__chips">{chips}</span>' if chips else '')
                + '<span class="system-card__cta">Explore system'
                '<span class="system-card__arrow" aria-hidden="true">&#8594;</span></span>'
                '</a>'
            )
        parts += ['</div>', '', '</section>']
        return "\n".join(parts)

    def resolve(name):
        if not name:
            return name
        # Handle dicts passed by mistake (e.g., related_submissions objects)
        if isinstance(name, dict):
            name = name.get('name', str(name))
        if not isinstance(name, str):
            return str(name)
        if name.lower().replace(' ', '-') == 'game-over':
            return 'game-over'
        if name in index:
            return f"{index[name]}/{name}"
        # Alias fallback: link a merged/renamed name to its canonical page.
        canon = alias_to_canonical.get(slugify(name))
        if canon:
            return canon
        return name  # fallback: bare name

    def page_exists(name):
        if isinstance(name, dict):
            name = name.get('name', '')
        if not isinstance(name, str) or not name:
            return False
        return name in index or name in family_names or slugify(name) in alias_to_canonical

    def family_exists(name):
        return isinstance(name, str) and name in family_names

    resolve.page_exists = page_exists
    resolve.family_exists = family_exists
    resolve.related_systems_html = related_systems_html
    return resolve


def load_json_file(json_path):
    """Load and parse JSON file.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file contains invalid JSON.
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            # no-gi default frame: divergent attempt maps render the same value the graph/game use
            return reduce_to_scalar(json.load(f), frame='nogi')
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {json_path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {json_path}: {e}")


def detect_position_template_type(json_file, data=None):
    """Detect which Positions template to use based on JSON structure

    - SINGLE: No bottom/top sections (neutral positions)
    - DUAL: Has bottom and top sections, no variations array
    - FAMILY: Has bottom, top, AND variations array (position with variants)
    """
    # Load data if not provided
    if data is None:
        data = load_json_file(json_file)

    # Check if has bottom/top sections (DUAL or FAMILY)
    has_bottom_top = 'bottom' in data and 'top' in data

    if not has_bottom_top:
        return 'SINGLE'

    # Check if has variations array (FAMILY)
    has_variations = 'variations' in data and len(data.get('variations', [])) > 0

    if has_variations:
        return 'FAMILY'
    else:
        return 'DUAL'


def detect_transition_template_type(json_file, data=None):
    """Detect which Transitions/Submissions template to use based on JSON structure.

    - FAMILY: Hub submission with variations array (informational only, no graph node)
    - DUAL: Has attacker and defender sections (new attacker/defender structure)
    - SINGLE: Flat structure (legacy, pre-migration)
    """
    if data is None:
        data = load_json_file(json_file)

    if data.get('is_family') and 'variations' in data:
        return 'FAMILY'
    if 'attacker' in data and 'defender' in data:
        return 'DUAL'
    return 'SINGLE'


def load_template(category, template_name):
    """Load Jinja2 template from templates/ using the shared environment.

    Uses the shared _JINJA_ENV so templates have access to custom filters
    (e.g. {{ alias | slugify }}). Falls back to flat-structure path for
    legacy templates without category subdirectories.
    """
    if category in ("Positions", "Transitions", "Submissions"):
        # These categories have templates in subdirectories
        template_path = Path(f"templates/{category}/{template_name}")
        if not template_path.exists():
            # Fallback to flat structure for legacy templates
            template_path = Path(f"templates/{template_name}")
    else:
        # Other categories use flat structure
        template_path = Path(f"templates/{template_name}")

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return _JINJA_ENV.from_string(f.read())
    except Exception as e:
        raise Exception(f"Failed to load template {template_path}: {e}")


def generate_markdown(json_data, template, resolve_fn=None):
    """Generate markdown from JSON data using Jinja2 template.

    Raises:
        RuntimeError: If template rendering fails.
    """
    try:
        kwargs = dict(json_data)
        if resolve_fn is not None:
            kwargs['resolve'] = resolve_fn
        return template.render(**kwargs)
    except Exception as e:
        raise RuntimeError(f"Template rendering failed: {e}")


def write_markdown_file(md_path, content, dry_run=False):
    """Write markdown content to file.

    Raises:
        IOError: If writing the file fails.
    """
    if dry_run:
        print(f"[DRY RUN] Would write: {md_path}")
        return

    try:
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Generated: {md_path}")
    except Exception as e:
        raise IOError(f"Failed to write {md_path}: {e}")


def find_variant_file(variant_folder, slug):
    """Find variant file by slug, handling filename case/format variations

    Slugs in JSON are kebab-case (e.g., '50-50-guard', 'high-mount').
    Actual filenames may use Title Case with spaces (e.g., '50-50 Guard.json', 'High Mount.json').
    This function normalizes both for matching (lowercase, hyphens instead of spaces).
    """
    # First try exact match (kebab-case slug)
    exact_match = variant_folder / f"{slug}.json"
    if exact_match.exists():
        return exact_match

    # Normalize slug for comparison (lowercase, hyphens)
    normalized_slug = slug.lower().replace(' ', '-')

    # Search all JSON files in folder and compare normalized names
    for json_file in variant_folder.glob("*.json"):
        file_normalized = json_file.stem.lower().replace(' ', '-')
        if file_normalized == normalized_slug:
            return json_file

    return None


def aggregate_family_variants(data, json_path):
    """Aggregate variant data for FAMILY positions"""
    variants_comparison = []
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    for variant_ref in data.get('variations', []):
        variant_slug = variant_ref['slug']
        variant_file = find_variant_file(variant_folder, variant_slug)

        if not variant_file:
            print(f"⚠️  Variant file not found for slug '{variant_slug}' in {variant_folder}")
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


def aggregate_submission_variants(data, json_path):
    """Aggregate variant data for FAMILY submissions.

    Hub JSONs sit at parent level (e.g., Submissions/Americana.json).
    Variants are in the subfolder (e.g., Submissions/Americana/from Mount.json).
    """
    variants_comparison = []
    # Hub at parent level: scan subfolder named after the hub
    variant_folder = json_path.parent / json_path.stem

    for variant_ref in data.get('variations', []):
        variant_slug = variant_ref['slug']
        variant_file = find_variant_file(variant_folder, variant_slug)

        if not variant_file:
            print(f"⚠️  Submission variant file not found for slug '{variant_slug}' in {variant_folder}")
            continue

        try:
            variant_data = load_json_file(variant_file)
            top_risk = ""
            if 'safety_considerations' in variant_data:
                risks = variant_data['safety_considerations'].get('injury_risks', [])
                top_risk = risks[0]['injury'] if risks else ""

            from_pos = variant_data.get('from_position', '')
            variants_comparison.append({
                'variant_name': variant_ref['name'],
                'from_position': from_pos,
                # Seat the attacker plays from (Top/Bottom), parsed from "Position/Role".
                'seat': from_pos.split('/')[1] if '/' in from_pos else '',
                # Whether this variant generates Attacker/Defender role pages, so the
                # hub variants table only emits Play-as links where targets exist.
                'is_dual': 'attacker' in variant_data and 'defender' in variant_data,
                'success_rate': _display_rate(variant_ref['name'], variant_data.get('success_rate', 0)),
                'top_risk': top_risk,
                'uniqueness': variant_data.get('variant_uniqueness', ''),
            })
        except Exception as e:
            print(f"⚠️  Error loading submission variant {variant_file}: {e}")
            continue

    # Highest-percentage / most-canonical variants first. Python's sort is stable,
    # so equal rates keep their source order -> deterministic regeneration diffs.
    variants_comparison.sort(key=lambda v: v['success_rate'], reverse=True)

    return variants_comparison


def load_schema(category, json_path=None):
    """Load JSON schema for a category from templates/.

    Uses the same schema files as validate_json.py. Detects template type
    (SINGLE/DUAL/FAMILY) from JSON structure for all categories.

    Args:
        category: Category name (e.g., "Positions", "Transitions").
        json_path: Path to the JSON file (required for Positions to detect type).

    Returns:
        Parsed JSON schema dict.

    Raises:
        FileNotFoundError: If the schema file does not exist.
        ValueError: If the schema contains invalid JSON.
    """
    if category == "Positions":
        template_type = detect_position_template_type(json_path)
        schema_path = Path(f"templates/Positions/TEMPLATE-{template_type}.json")
    elif category in ("Transitions", "Submissions"):
        template_type = detect_transition_template_type(json_path)
        if template_type in ('DUAL', 'FAMILY'):
            schema_path = Path(f"templates/{category}/TEMPLATE-{template_type}.json")
        else:
            schema_path = Path(f"templates/{category}.json")
    else:
        schema_path = Path(f"templates/{category}.json")

    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")

    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in schema {schema_path}: {e}")


def process_json_file(json_path, dry_run=False, resolve_fn=None):
    """Process a single JSON file: load data, render template(s), write MD.

    Raises:
        ValueError: If category cannot be determined or schema validation fails.
        FileNotFoundError: If required files are missing.
        RuntimeError: If template rendering fails.
        IOError: If writing output fails.
    """
    if resolve_fn is None:
        resolve_fn = build_wikilink_resolver()

    json_path = Path(json_path)

    # Determine category from path
    category = None
    for cat_name, cat_path in CATEGORIES.items():
        if cat_path in str(json_path):
            category = cat_name
            break

    if not category:
        raise ValueError(
            f"Could not determine category for {json_path}. "
            f"File must be in one of: {', '.join(CATEGORIES.values())}"
        )

    # Load JSON data
    data = load_json_file(json_path)

    # Validate against schema before rendering
    schema = load_schema(category, json_path)
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        raise ValueError(
            f"Schema validation failed for {json_path}: {e.message} "
            f"at path {'.'.join(str(p) for p in e.path)}"
        )

    # Handle Transitions and Submissions with attacker/defender structure
    if category in ("Transitions", "Submissions"):
        # Display the PUBLISHED (folded-votes, calibrated) success rate — same source as graph.json —
        # so the page text agrees with the graph/game. Content stays as authored; votes is the source.
        if isinstance(data.get('success_rate'), (int, float)):
            data['success_rate'] = _display_rate(data.get('name', ''), data['success_rate'])
        template_type = detect_transition_template_type(json_path, data)

        if template_type == 'FAMILY' and category == 'Submissions':
            # Family hub: 1 file only, no Attacker/Defender pages
            variants_comparison = aggregate_submission_variants(data, json_path)
            hub_data = {**data, 'variants_comparison': variants_comparison}
            hub_template = load_template(category, "TEMPLATE-FAMILY.md.jinja2")
            hub_content = hub_template.render(**hub_data, resolve=resolve_fn)
            hub_path = json_path.with_suffix('.md')
            write_markdown_file(hub_path, hub_content, dry_run)
            return [hub_path]

        elif template_type == 'DUAL':
            # Render 3 files: hub, attacker, defender
            generated_files = []
            technique_name = data.get('name', json_path.stem)

            # Compute content-relative path for role wikilinks
            content_path = str(json_path.relative_to(Path('content')).with_suffix(''))

            # Render hub page
            hub_template = load_template(category, "TEMPLATE-DUAL.md.jinja2")
            hub_content = hub_template.render(**data, resolve=resolve_fn, content_path=content_path)
            hub_path = json_path.with_suffix('.md')
            write_markdown_file(hub_path, hub_content, dry_run)
            generated_files.append(hub_path)

            # Synonym/variant/false-synonym surfaces shared by all role pages
            role_extras = dict(
                aliases=data.get('aliases', []),
                family=data.get('family', ''),
                disambiguations=data.get('disambiguations', []),
                sameAs=data.get('sameAs', []),
            )

            # Render attacker page
            attacker_template = load_template(category, "TEMPLATE-ATTACKER.md.jinja2")
            attacker_content = attacker_template.render(
                attacker=data['attacker'],
                name=technique_name,
                from_position=data.get('from_position', ''),
                outcomes=data.get('outcomes', []),
                safety_considerations=data.get('safety_considerations', {}),
                target_area=data.get('target_area', ''),
                resolve=resolve_fn,
                **role_extras,
            )
            attacker_path = json_path.parent / json_path.stem / "Attacker.md"
            attacker_path.parent.mkdir(parents=True, exist_ok=True)
            write_markdown_file(attacker_path, attacker_content, dry_run)
            generated_files.append(attacker_path)

            # Render defender page
            defender_template = load_template(category, "TEMPLATE-DEFENDER.md.jinja2")
            defender_content = defender_template.render(
                defender=data['defender'],
                name=technique_name,
                from_position=data.get('from_position', ''),
                outcomes=data.get('outcomes', []),
                safety_considerations=data.get('safety_considerations', {}),
                target_area=data.get('target_area', ''),
                resolve=resolve_fn,
                **role_extras,
            )
            defender_path = json_path.parent / json_path.stem / "Defender.md"
            write_markdown_file(defender_path, defender_content, dry_run)
            generated_files.append(defender_path)

            return generated_files
        else:
            # Legacy SINGLE: render single file using old flat template
            template = load_template(category, f"{category}.md.jinja2")
            markdown_content = generate_markdown(data, template, resolve_fn=resolve_fn)
            md_path = json_path.with_suffix('.md')
            write_markdown_file(md_path, markdown_content, dry_run)
            return [md_path]

    # Handle other flat categories (Principles, Systems)
    if category not in ("Positions",):
        template = load_template(category, f"{category}.md.jinja2")
        markdown_content = generate_markdown(data, template, resolve_fn=resolve_fn)
        md_path = json_path.with_suffix('.md')
        write_markdown_file(md_path, markdown_content, dry_run)
        return [md_path]

    # Positions: detect template type based on JSON structure
    template_type = detect_position_template_type(json_path, data)

    if template_type == 'SINGLE':
        # Render single file
        template = load_template(category, "TEMPLATE-SINGLE.md.jinja2")
        markdown_content = template.render(data=data, resolve=resolve_fn)
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
        hub_template = load_template(category, "TEMPLATE-DUAL.md.jinja2")
        hub_data = {
            **data,
            'bottom_summary': data['bottom'],
            'top_summary': data['top'],
            'variants_comparison': variants_comparison
        }
        hub_content = hub_template.render(**hub_data, resolve=resolve_fn)
        hub_path = json_path.with_suffix('.md')
        write_markdown_file(hub_path, hub_content, dry_run)
        generated_files.append(hub_path)

        # Synonym/variant/false-synonym surfaces shared by role pages
        position_extras = dict(
            aliases=data.get('aliases', []),
            family=data.get('family', ''),
            disambiguations=data.get('disambiguations', []),
            sameAs=data.get('sameAs', []),
        )

        # Render bottom page
        position_name = data.get('name', json_path.stem)  # Use position name for clean URLs
        bottom_template = load_template(category, "TEMPLATE-BOTTOM.md.jinja2")
        bottom_content = bottom_template.render(
            bottom=data['bottom'],
            position_name=position_name,
            resolve=resolve_fn,
            **position_extras,
        )
        bottom_path = json_path.parent / position_name / "Bottom.md"
        bottom_path.parent.mkdir(parents=True, exist_ok=True)
        write_markdown_file(bottom_path, bottom_content, dry_run)
        generated_files.append(bottom_path)

        # Render top page
        top_template = load_template(category, "TEMPLATE-TOP.md.jinja2")
        top_content = top_template.render(
            top=data['top'],
            position_name=position_name,
            resolve=resolve_fn,
            **position_extras,
        )
        top_path = json_path.parent / position_name / "Top.md"
        write_markdown_file(top_path, top_content, dry_run)
        generated_files.append(top_path)

        return generated_files

    else:
        raise ValueError(f"Unknown Position template type: {template_type}")


def process_category(category, dry_run=False):
    """Process all JSON files in a category.

    Collects failures and continues processing remaining files instead of
    stopping on the first error. Prints a summary of all failures at the end.

    Returns:
        List of (file_path, error_message) tuples for failed files.
    """
    if category not in CATEGORIES:
        print(f"ERROR: Unknown category '{category}'")
        print(f"Available categories: {', '.join(CATEGORIES.keys())}")
        sys.exit(1)

    category_path = Path(CATEGORIES[category])

    if not category_path.exists():
        print(f"ERROR: Category path not found: {category_path}")
        sys.exit(1)

    # Find all JSON files recursively (including nested submission variants)
    root_json_files = [f for f in category_path.glob("**/*.json")]

    # Also find JSON files in subdirectories (variant positions)
    # For Positions category only, process variant JSON files
    variant_json_files = []
    if category == "Positions":
        # Find all JSON files in subdirectories
        variant_json_files = [f for f in category_path.glob("*/*.json")]
        print(f"Found {len(variant_json_files)} variant JSON files in subdirectories")

    # Combine both lists
    json_files = root_json_files + variant_json_files

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return []

    print(f"\nProcessing {len(json_files)} files in {category} ({len(root_json_files)} root, {len(variant_json_files)} variants)...")

    resolve_fn = build_wikilink_resolver()

    processed = 0
    failures = []
    for json_file in sorted(json_files):
        try:
            generated_files = process_json_file(json_file, dry_run, resolve_fn=resolve_fn)
            processed += 1
            if len(generated_files) > 1:
                print(f"  → Generated {len(generated_files)} files")
        except Exception as e:
            failures.append((str(json_file), str(e)))
            print(f"⚠ SKIPPED {json_file}: {e}")

    print(f"\n✓ Processed {processed}/{len(json_files)} files in {category}")

    if failures:
        print(f"✗ {len(failures)} file(s) failed in {category}:")
        for file_path, error_msg in failures:
            print(f"  - {file_path}: {error_msg}")

    return failures


def process_all_categories(dry_run=False):
    """Process all JSON files in all categories.

    Prints a summary of all failures across categories at the end.
    """
    print("Processing all categories...")

    all_failures = []
    for category in CATEGORIES.keys():
        failures = process_category(category, dry_run)
        if failures:
            all_failures.extend(failures)

    if all_failures:
        print(f"\n{'='*60}")
        print(f"⚠ TOTAL: {len(all_failures)} file(s) failed across all categories:")
        for file_path, error_msg in all_failures:
            print(f"  - {file_path}: {error_msg}")
    else:
        print(f"\n{'='*60}")
        print("✓ All files processed successfully")

    return all_failures


def main():
    parser = argparse.ArgumentParser(
        description="Generate markdown files from JSON data using Jinja2 templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate single file
  python3 scripts/json_to_md.py --file content/Positions/Mount.json

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
    parser.add_argument('--strict', action='store_true', help='Exit non-zero if any files fail (for CI)')

    args = parser.parse_args()

    if not (args.file or (args.category and args.all) or args.all):
        parser.error("Must specify --file, --category with --all, or just --all")

    failures = []
    if args.file:
        process_json_file(args.file, args.dry_run)
    elif args.category and args.all:
        failures = process_category(args.category, args.dry_run)
    elif args.all:
        failures = process_all_categories(args.dry_run)

    if args.strict and failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
