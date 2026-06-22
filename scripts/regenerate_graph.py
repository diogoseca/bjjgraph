#!/usr/bin/env python3
"""
Generate graph.json for the BJJGraph state machine game.

Parses position, transition, and submission JSON files and generates a unified
state graph for the frontend game mechanics and graph visualization.

Usage:
    python scripts/regenerate_graph.py              # default: warnings only
    python scripts/regenerate_graph.py --verbose    # print every missing/orphan node
    python scripts/regenerate_graph.py --strict     # exit non-zero on missing nodes

Output: graph.json
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _slug import slugify  # shared single-source slugify (node keys + alias map)
from _atomic_io import atomic_write_json


# Neutral positions don't have top/bottom roles
NEUTRAL_POSITIONS = {
    'game-over'
}

TERMINAL_POSITIONS = {'game-over'}


# Collects (path, error) for every source JSON that failed to parse during a run.
# A single corrupt content/*.json must NOT be silently dropped from the graph
# (that orphans everything referencing it). In strict mode (default) main() prints
# these and exits non-zero BEFORE graph.json is written.
_PARSE_FAILURES: list[tuple[str, str]] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def quartz_slug(name: str) -> str:
    """Convert name to URL path matching Quartz's sluggify (case-preserving)."""
    slug = name.strip()
    slug = slug.replace('&', '-and-')
    slug = slug.replace('%', '-percent')
    slug = slug.replace('?', '')
    slug = slug.replace('#', '')
    slug = re.sub(r'\s+', '-', slug)
    return slug


# ---------------------------------------------------------------------------
# Alias resolution — old references to merged/renamed techniques still resolve
# ---------------------------------------------------------------------------

def build_alias_maps(content_dir: Path) -> tuple[dict, dict]:
    """Scan every content JSON's aliases[] and build two lookup maps.

    Returns (position_alias_map, technique_alias_map):
      - position_alias_map: slug(alias) -> slug(canonical position node)
      - technique_alias_map: slug(alias) -> {'slug': canonical_node_slug, 'name': canonical_name}

    Used by rewrite_aliases() so that when a synonym is merged (e.g. Bullfighter
    Pass folded into Toreando Pass with alias "Bullfighter Pass"), any edge that
    still references the old slug resolves to the canonical node instead of
    dangling. No-op until aliases[] arrays are populated (epic phase 12).
    """
    position_alias_map: dict[str, str] = {}
    technique_alias_map: dict[str, dict] = {}

    def _aliases_of(data: dict):
        a = data.get('aliases')
        return a if isinstance(a, list) else []

    pos_dir = content_dir / 'Positions'
    if pos_dir.exists():
        for data in load_json_files(pos_dir):
            name = data.get('name')
            if not name:
                continue
            canonical_slug = slugify(data.get('slug', name))
            for alias in _aliases_of(data):
                if isinstance(alias, str) and alias.strip():
                    position_alias_map[slugify(alias)] = canonical_slug

    for subdir in ('Transitions', 'Submissions'):
        d = content_dir / subdir
        if not d.exists():
            continue
        for data in load_json_files(d):
            name = data.get('name')
            if not name:
                continue
            canonical_slug = slugify(name)
            for alias in _aliases_of(data):
                if isinstance(alias, str) and alias.strip():
                    technique_alias_map[slugify(alias)] = {'slug': canonical_slug, 'name': name}

    return position_alias_map, technique_alias_map


def _resolve_pos_or_tech(ref: str, pos_map: dict, tech_map: dict) -> str:
    """Resolve a position-or-submission reference (optionally with /role) through alias maps."""
    if not ref or ref == 'game-over':
        return ref
    # Whole-slug submission alias (no role suffix on submissions)
    if ref in tech_map:
        return tech_map[ref]['slug']
    if '/' in ref:
        base, role = ref.split('/', 1)
        if base in pos_map:
            return f"{pos_map[base]}/{role}"
        return ref
    return pos_map.get(ref, ref)


def rewrite_aliases(graph: dict, pos_map: dict, tech_map: dict) -> int:
    """Rewrite every edge reference through the alias maps. Returns count rewritten."""
    if not pos_map and not tech_map:
        return 0

    count = 0

    def rewrite_technique_target(t: dict) -> None:
        nonlocal count
        entry = tech_map.get(t.get('target', ''))
        if entry:
            t['target'] = entry['slug']
            t['targetPath'] = quartz_slug(entry['name'])
            count += 1

    for pos in graph.get('positions', {}).values():
        for t in pos.get('transitions', []):
            rewrite_technique_target(t)
        for t in pos.get('opponentTransitions', []):
            rewrite_technique_target(t)
            so = t.get('successOutcome', '')
            new_so = _resolve_pos_or_tech(so, pos_map, tech_map)
            if new_so != so:
                t['successOutcome'] = new_so
                count += 1

    for collection in ('transitions', 'submissions'):
        for entry in graph.get(collection, {}).values():
            for o in entry.get('outcomes', []):
                new_to = _resolve_pos_or_tech(o.get('to', ''), pos_map, tech_map)
                if new_to != o.get('to', ''):
                    o['to'] = new_to
                    count += 1
            ep = entry.get('endingPosition', '')
            new_ep = _resolve_pos_or_tech(ep, pos_map, tech_map)
            if new_ep != ep:
                entry['endingPosition'] = new_ep
                count += 1
            sp = entry.get('startingPosition', '')
            if sp in pos_map:
                entry['startingPosition'] = pos_map[sp]
                count += 1
            fpid = entry.get('fromPositionId', '')
            if fpid in pos_map:
                entry['fromPositionId'] = pos_map[fpid]
                count += 1

    return count


def load_json_files(directory: Path) -> list[dict]:
    """Load all JSON files from a directory recursively."""
    files = []
    if not directory.exists():
        return files

    for json_file in directory.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    continue
                if '$schema' in data and 'title' in data and 'properties' in data:
                    continue
                data['_source_file'] = str(json_file)
                files.append(data)
        except (json.JSONDecodeError, IOError) as e:
            # Don't silently drop: record the failure so main() can hard-fail
            # before graph.json is written (a dropped node orphans its references).
            print(f"ERROR: Could not load {json_file}: {e}")
            _PARSE_FAILURES.append((str(json_file), str(e)))

    return files


def build_position_path_index(positions_dir: Path) -> dict[str, str]:
    """Map position slugs to their case-preserving relative file paths (for URL construction)."""
    index = {}
    for json_file in positions_dir.rglob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, dict):
                continue
            if '$schema' in data and 'title' in data and 'properties' in data:
                continue
            name = data.get('name', '')
            if not name:
                continue
            slug = slugify(data.get('slug', name))
            rel_path = json_file.relative_to(positions_dir)
            # Case-preserving: spaces to hyphens, preserve original casing from filename
            path_slug = str(rel_path.with_suffix('')).replace(' ', '-').replace('\\', '/')
            index[slug] = path_slug
        except (json.JSONDecodeError, IOError):
            continue
    return index


def dedupe_flashcards(cards: list[dict]) -> list[dict]:
    """Return flashcards with duplicate questions removed, preserving order."""
    seen: set[str] = set()
    out: list[dict] = []
    for card in cards:
        q = (card.get('question') or '').strip()
        if not q or q in seen:
            continue
        seen.add(q)
        out.append(card)
    return out


# Family-hub flashcard curation. A family hub (e.g. "rear-naked-choke") aggregates
# the flashcards of all its from-position variants; raw aggregation yields ~200
# cards, far more than one trainable session. Curate to a capped, breadth-balanced
# deck weighted toward the highest-percentage / most-canonical positions.
HUB_FLASHCARD_CAP = 45
MIN_PER_VARIANT = 2

# Strips a trailing "from <position>" clause so the same question re-asked per
# variant position collapses to one card. Conservative + used only as a dedup key.
_HUB_FROM_CLAUSE = re.compile(r'\s+from\s+[\w\s\-/]+\??$', re.IGNORECASE)


def _hub_dedupe_key(question: str) -> str:
    """Loose normalized key for hub-only near-duplicate collapse (key only —
    the original card text is preserved)."""
    q = _HUB_FROM_CLAUSE.sub('', (question or '').strip())
    return re.sub(r'[^a-z0-9]+', ' ', q.lower()).strip()


def curate_hub_flashcards(variants: list[dict]) -> list[dict]:
    """Curate a family-hub deck from its variants' (already exact-deduped) decks.

    Weighted Top-K per variant (more cards from higher-successRate positions) with
    a per-variant floor, round-robin interleaved for positional breadth, then a
    hub-only near-duplicate collapse, hard-capped at HUB_FLASHCARD_CAP.
    """
    rates = [max(0.0, float(v.get('successRate') or 0)) for v in variants]
    total = sum(rates)
    kept: list[list[dict]] = []
    for v, rate in zip(variants, rates):
        cards = v.get('flashcards', [])
        keep = max(MIN_PER_VARIANT, round(HUB_FLASHCARD_CAP * rate / total)) if total > 0 else MIN_PER_VARIANT
        kept.append(cards[:keep])

    out: list[dict] = []
    seen: set[str] = set()
    i = 0
    while len(out) < HUB_FLASHCARD_CAP and any(i < len(k) for k in kept):
        for k in kept:
            if i >= len(k):
                continue
            card = k[i]
            key = _hub_dedupe_key(card.get('question', ''))
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(card)
            if len(out) >= HUB_FLASHCARD_CAP:
                break
        i += 1
    return out


def is_neutral_position(slug: str) -> bool:
    base_slug = slug.split('/')[0] if '/' in slug else slug
    return base_slug in NEUTRAL_POSITIONS


def is_terminal_position(slug: str) -> bool:
    return slug in TERMINAL_POSITIONS or slug == 'game-over'


# ---------------------------------------------------------------------------
# Position processing
# ---------------------------------------------------------------------------

def process_position_role(position_data: dict, role: str, hub_slug: str, hub_path: str, path_index: dict) -> dict | None:
    role_data = position_data.get(role)
    if not role_data:
        return None

    slug = f"{hub_slug}/{role}"
    full_path = f"{hub_path}/{role.title()}"
    name = role_data.get('name', f"{position_data.get('name', 'Unknown')} {role.title()}")

    transitions = []
    for t in role_data.get('transitions', []):
        technique_name = t.get('transition', 'Unknown Technique')
        attempt_prob = t.get('attempt_probability', 0)
        technique_slug = slugify(technique_name)

        transitions.append({
            'technique': technique_name,
            'target': technique_slug,
            'targetPath': quartz_slug(technique_name),
            'isSubmission': False,
            'attemptProbability': attempt_prob
        })

    state_props = role_data.get('state_properties', {})

    flashcards = [
        {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
        for qa in role_data.get('flashcards', [])
    ]

    return {
        'name': name,
        'hub': hub_slug,
        'role': role,
        'path': full_path,
        'pointValue': state_props.get('point_value', 0),
        'positionType': state_props.get('position_type', 'Neutral'),
        'riskLevel': state_props.get('risk_level', 'Medium'),
        'energyCost': state_props.get('energy_cost', 'Medium'),
        'transitions': transitions,
        'flashcards': flashcards,
    }


def process_positions(content_dir: Path) -> dict:
    positions_dir = content_dir / 'Positions'
    position_files = load_json_files(positions_dir)
    path_index = build_position_path_index(positions_dir)
    positions = {}

    for pos_data in position_files:
        if 'name' not in pos_data:
            continue

        hub_slug = slugify(pos_data.get('slug', pos_data['name']))

        source_file = pos_data.get('_source_file', '')
        if source_file:
            rel_path = Path(source_file).relative_to(positions_dir)
            hub_path = str(rel_path.with_suffix('')).replace('\\', '/')
        else:
            hub_path = hub_slug

        # Skip terminal positions from having role pages
        if is_terminal_position(hub_slug):
            state_props = pos_data.get('state_properties', {})
            positions[hub_slug] = {
                'name': pos_data['name'],
                'hub': hub_slug,
                'role': 'terminal',
                'path': hub_path,
                'pointValue': state_props.get('point_value', 0),
                'positionType': state_props.get('position_type', 'Terminal'),
                'riskLevel': state_props.get('risk_level', 'None'),
                'energyCost': state_props.get('energy_cost', 'None'),
                'transitions': []
            }
            continue

        top = process_position_role(pos_data, 'top', hub_slug, hub_path, path_index)
        if top:
            positions[f"{hub_slug}/top"] = top

        bottom = process_position_role(pos_data, 'bottom', hub_slug, hub_path, path_index)
        if bottom:
            positions[f"{hub_slug}/bottom"] = bottom

        # Dual-role hub entry: aggregates top + bottom flashcards for the hub page
        if top or bottom:
            hub_flashcards = dedupe_flashcards(
                (top or {}).get('flashcards', []) + (bottom or {}).get('flashcards', [])
            )
            positions[hub_slug] = {
                'name': pos_data['name'],
                'hub': hub_slug,
                'role': 'hub',
                'path': hub_path,
                'flashcards': hub_flashcards,
            }

        # Neutral positions (no top/bottom - SINGLE template)
        if not top and not bottom:
            transitions = []
            for t in pos_data.get('transitions', []):
                technique_name = t.get('transition', 'Unknown')
                attempt_prob = t.get('attempt_probability', 0)
                technique_slug = slugify(technique_name)

                transitions.append({
                    'technique': technique_name,
                    'target': technique_slug,
                    'targetPath': quartz_slug(technique_name),
                    'isSubmission': False,
                    'attemptProbability': attempt_prob
                })

            if transitions:
                state_props = pos_data.get('state_properties', {})
                positions[hub_slug] = {
                    'name': pos_data['name'],
                    'hub': hub_slug,
                    'role': 'neutral',
                    'path': hub_path,
                    'pointValue': state_props.get('point_value', 0),
                    'positionType': state_props.get('position_type', 'Neutral'),
                    'riskLevel': state_props.get('risk_level', 'Medium'),
                    'energyCost': state_props.get('energy_cost', 'Medium'),
                    'transitions': transitions
                }

    # Ensure terminal positions exist even without a source JSON file
    for terminal_slug in TERMINAL_POSITIONS:
        if terminal_slug not in positions:
            positions[terminal_slug] = {
                'name': terminal_slug.replace('-', ' ').title(),
                'hub': terminal_slug,
                'role': 'terminal',
                'path': terminal_slug.replace('-', ' ').title(),
                'pointValue': 0,
                'positionType': 'Terminal',
                'riskLevel': 'None',
                'energyCost': 'None',
                'transitions': []
            }

    return positions


# ---------------------------------------------------------------------------
# Transition processing
# ---------------------------------------------------------------------------

def process_transitions(content_dir: Path) -> dict:
    transitions_dir = content_dir / 'Transitions'
    positions_dir = content_dir / 'Positions'
    transition_files = load_json_files(transitions_dir)
    path_index = build_position_path_index(positions_dir)
    transitions = {}

    for trans_data in transition_files:
        if 'name' not in trans_data:
            continue

        slug = slugify(trans_data['name'])

        # Support both flat and attacker/defender structures
        attacker = trans_data.get('attacker', {})
        attacker_flashcards = [
            {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
            for qa in attacker.get('flashcards', trans_data.get('flashcards', []))
        ]

        defender = trans_data.get('defender', {})
        defender_flashcards = [
            {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
            for qa in defender.get('flashcards', [])
        ]

        # Read from_position (the correct field name from source JSON)
        from_position_raw = trans_data.get('from_position', '')
        if from_position_raw:
            starting_pos_name = from_position_raw.split('/')[0]
            starting_position_slug = slugify(starting_pos_name)
            from_position_name = starting_pos_name.strip()
        else:
            starting_position_slug = ''
            from_position_name = ''

        effectiveness_map = {'High': 70, 'Medium': 50, 'Low': 30}
        cc_source = attacker.get('common_counters', trans_data.get('common_counters', []))
        common_counters = [
            {
                'technique': c.get('counter', 'Defense'),
                'effectiveness': effectiveness_map.get(c.get('effectiveness', 'Medium'), 50),
                'resultPosition': starting_position_slug
            }
            for c in cc_source
        ]

        success_rate = trans_data.get('success_rate', 50)

        # Derive endingPosition from first success outcome in outcomes[]
        ending_slug = ''
        ending_path = ''
        outcomes_raw = trans_data.get('outcomes', [])
        for outcome in outcomes_raw:
            if outcome.get('result') == 'success':
                to_raw = outcome.get('to', '')
                if to_raw:
                    # Split "Position/Role" format (e.g., "Mount/Top")
                    to_parts = to_raw.split('/')
                    pos_name = to_parts[0]
                    pos_slug = slugify(pos_name)
                    ending_path = path_index.get(pos_slug, pos_slug)

                    if is_terminal_position(pos_slug):
                        ending_slug = pos_slug
                    elif is_neutral_position(pos_slug):
                        ending_slug = pos_slug
                    elif len(to_parts) > 1:
                        role = to_parts[1].lower()
                        ending_slug = f"{pos_slug}/{role}"
                    else:
                        ending_slug = f"{pos_slug}/top"
                break

        # Build outcomes array — slugify each path segment separately to preserve "/"
        outcomes = []
        for o in outcomes_raw:
            to_raw = o.get('to', '')
            to_parts = to_raw.split('/')
            to_slug = '/'.join(slugify(part) for part in to_parts) if to_raw else ''
            outcomes.append({
                'to': to_slug,
                'probability': o.get('probability', 0),
                'result': o.get('result', 'success')
            })

        # Extract starting position role and path for outcome card navigation
        starting_position_role = ''
        starting_position_path = path_index.get(starting_position_slug, starting_position_slug)
        if from_position_raw and '/' in from_position_raw:
            starting_position_role = from_position_raw.split('/')[1].lower()

        trans_entry = {
            'name': trans_data['name'],
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': starting_position_role,
            # Canonical structured origin (consumers filter/link by these, not the title).
            # fromPosition = position display name; fromPositionId = position node id/slug.
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': starting_position_role,
            'endingPosition': ending_slug,
            'endingPositionPath': ending_path,
            'successRate': success_rate,
            'attackerFlashcards': attacker_flashcards,
            'defenderFlashcards': defender_flashcards,
            'flashcards': dedupe_flashcards(attacker_flashcards + defender_flashcards),
            'commonCounters': common_counters,
        }

        if outcomes:
            trans_entry['outcomes'] = outcomes

        transitions[slug] = trans_entry

    return transitions


# ---------------------------------------------------------------------------
# Submission processing
# ---------------------------------------------------------------------------

def process_submissions(content_dir: Path) -> tuple[dict, set, dict]:
    """Process submissions. Returns (submissions_dict, hub_slugs_set, family_hubs_dict)."""
    submissions_dir = content_dir / 'Submissions'
    positions_dir = content_dir / 'Positions'
    submission_files = load_json_files(submissions_dir)
    path_index = build_position_path_index(positions_dir)
    submissions = {}
    hub_slugs = set()

    family_hub_metadata: dict[str, dict] = {}

    for sub_data in submission_files:
        if 'name' not in sub_data:
            continue
        if sub_data.get('is_family', False):
            family_slug = slugify(sub_data['name'])
            hub_slugs.add(family_slug)
            family_hub_metadata[family_slug] = {
                'name': sub_data['name'],
                'description': sub_data.get('description', ''),
                'category': sub_data.get('submission_category', 'Unknown'),
                'type': sub_data.get('submission_type', 'Unknown'),
                'targetArea': sub_data.get('target_area', 'Unknown'),
            }
            continue

        slug = slugify(sub_data['name'])

        # Support both flat and attacker/defender structures
        attacker = sub_data.get('attacker', {})
        attacker_flashcards = [
            {
                'question': qa.get('question', ''),
                'answer': qa.get('answer', ''),
                'safetyCritical': qa.get('safety_critical', False),
            }
            for qa in attacker.get('flashcards', sub_data.get('flashcards', []))
        ]

        defender = sub_data.get('defender', {})
        defender_flashcards = [
            {
                'question': qa.get('question', ''),
                'answer': qa.get('answer', ''),
                'safetyCritical': qa.get('safety_critical', False),
            }
            for qa in defender.get('flashcards', [])
        ]

        from_positions = [slugify(p) for p in sub_data.get('from_positions', [])]
        success_rate = sub_data.get('success_rate', 50)

        # Determine starting position: prefer from_position (split on "/" to get position part),
        # fall back to starting_position
        from_position_raw = sub_data.get('from_position', '')
        if from_position_raw:
            starting_pos_name = from_position_raw.split('/')[0]
            starting_position_slug = slugify(starting_pos_name)
            from_position_name = starting_pos_name.strip()
        else:
            starting_position_slug = slugify(sub_data.get('starting_position', ''))
            from_position_name = sub_data.get('starting_position', '').strip()

        # Extract starting position role and path for outcome card navigation
        starting_position_role = ''
        starting_position_path = ''
        if from_position_raw and '/' in from_position_raw:
            starting_position_role = from_position_raw.split('/')[1].lower()
            starting_position_path = path_index.get(starting_position_slug, starting_position_slug)
        elif starting_position_slug:
            starting_position_path = path_index.get(starting_position_slug, starting_position_slug)

        sub_entry = {
            'name': sub_data['name'],
            'isTerminal': True,
            'category': sub_data.get('submission_category', 'Unknown'),
            'type': sub_data.get('submission_type', 'Unknown'),
            'targetArea': sub_data.get('target_area', 'Unknown'),
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': starting_position_role,
            # Canonical structured origin (unified with transitions).
            # fromPosition = position display name; fromPositionId = position node id/slug.
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': starting_position_role,
            'fromPositions': from_positions,
            'successRate': success_rate,
            'attackerFlashcards': attacker_flashcards,
            'defenderFlashcards': defender_flashcards,
            'flashcards': dedupe_flashcards(attacker_flashcards + defender_flashcards),
        }

        # Add outcomes if present (graph edge data)
        outcomes_raw = sub_data.get('outcomes', [])
        if outcomes_raw:
            sub_entry['outcomes'] = [
                {
                    'to': '/'.join(slugify(part) for part in o.get('to', '').split('/')) if o.get('to') else '',
                    'probability': o.get('probability', 0),
                    'result': o.get('result', 'success')
                }
                for o in outcomes_raw
            ]

        submissions[slug] = sub_entry

    # Build family-hub entries separately (keyed by family slug e.g. "americana").
    # Aggregates flashcards from all <family>-from-* variants. These are merged into
    # the submissions dict by the caller AFTER variant-level enrichment runs, so
    # downstream logic (successRate enrichment, outcome rewriting, ending rewriting)
    # continues to operate only on real variants.
    family_hubs: dict[str, dict] = {}
    for family_slug, meta in family_hub_metadata.items():
        prefix = f"{family_slug}-from-"
        variant_decks = [
            variant for key, variant in submissions.items()
            if key.startswith(prefix)
        ]
        family_hubs[family_slug] = {
            **meta,
            'isFamily': True,
            'isTerminal': True,
            'flashcards': curate_hub_flashcards(variant_decks),
        }

    return submissions, hub_slugs, family_hubs


# ---------------------------------------------------------------------------
# Principle and System processing (flat content — no roles, no graph edges)
# ---------------------------------------------------------------------------

def _process_flat_content(content_dir: Path, subdir: str) -> dict:
    """Build a {slug: {name, flashcards}} dict from a flat content directory.

    Shared by Principles and Systems — both are single-page-per-file content types
    with a top-level flashcards array (no role splitting, no transitions/outcomes).
    """
    target_dir = content_dir / subdir
    files = load_json_files(target_dir)
    entries: dict[str, dict] = {}
    for data in files:
        name = data.get('name')
        if not name:
            continue
        slug = slugify(name)
        flashcards = [
            {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
            for qa in data.get('flashcards', [])
            if qa.get('question') and qa.get('answer')
        ]
        entries[slug] = {
            'name': name,
            'description': data.get('description', ''),
            'tags': data.get('tags', []),
            'flashcards': flashcards,
        }
    return entries


def process_principles(content_dir: Path) -> dict:
    return _process_flat_content(content_dir, 'Principles')


# System members that referenced a node name we couldn't resolve to a real page.
# Collected during process_systems and reported once at the end (non-fatal).
_SYSTEM_UNRESOLVED: list = []


def _node_id_for_path(plural: str, rel_path: Path) -> str:
    """Quartz node id for a content file: 'Plural/Hyphenated-Segments' (case-preserving,
    spaces->hyphens per segment), matching the slugs the graph renderer uses."""
    return plural + '/' + '/'.join(quartz_slug(seg) for seg in rel_path.with_suffix('').parts)


def build_node_index(content_dir: Path) -> dict:
    """Map a content node's name (and aliases) to its graph identity.

    Returns {(type, name_lower): entry, ('', name_lower): entry} where entry is
    {'path': '<NodeId>', 'slug': '<nodeid lowercased>', 'type': 'position'|...}.
    Node ids are derived from the FILE PATH (the authoritative Quartz slug source),
    so nested variants like Submissions/Calf-Slicer/from-Carni resolve correctly.
    """
    cat_map = {
        'Positions': 'position',
        'Transitions': 'transition',
        'Submissions': 'submission',
        'Principles': 'principle',
    }
    index: dict = {}
    for plural, typ in cat_map.items():
        d = content_dir / plural
        if not d.exists():
            continue
        for jf in d.rglob('*.json'):
            try:
                data = json.loads(jf.read_text(encoding='utf-8'))
            except Exception:
                continue
            name = data.get('name')
            if not name:
                continue
            node_path = _node_id_for_path(plural, jf.relative_to(d))
            entry = {'path': node_path, 'slug': node_path.lower(), 'type': typ}
            names = [name] + [a for a in (data.get('aliases') or []) if isinstance(a, str)]
            for nm in names:
                key = str(nm).strip().lower()
                index.setdefault((typ, key), entry)
                index.setdefault(('', key), entry)
    return index


def process_systems(content_dir: Path, node_index: dict | None = None) -> dict:
    """Systems carry base flat-content fields plus resolved graph membership.

    `members[]` is derived from related_content (the canonical edge list): each
    Position/Transition/Submission/Principle reference is resolved to its node id so
    a System page can highlight exactly the part of the graph it teaches. `products[]`
    is curated affiliate data passed through verbatim.
    """
    systems = _process_flat_content(content_dir, 'Systems')
    if node_index is None:
        node_index = build_node_index(content_dir)

    files = load_json_files(content_dir / 'Systems')
    by_name = {str(d.get('name', '')).strip().lower(): d for d in files if d.get('name')}

    for slug, entry in systems.items():
        data = by_name.get(str(entry.get('name', '')).strip().lower())
        if not data:
            continue
        members = []
        seen = set()
        for item in data.get('related_content', []) or []:
            if not isinstance(item, dict):
                continue
            ct = (item.get('content_type') or '').strip()
            if ct == 'System':
                continue  # a System isn't a highlightable graph node
            nm = (item.get('name') or '').strip()
            if not nm:
                continue
            typ = ct.lower()
            node = node_index.get((typ, nm.lower())) or node_index.get(('', nm.lower()))
            if not node:
                _SYSTEM_UNRESOLVED.append((entry.get('name', slug), nm, ct))
                continue
            if node['path'] in seen:
                continue
            seen.add(node['path'])
            members.append({
                'slug': node['slug'],
                'path': node['path'],
                'type': node['type'],
                'name': nm,
                'relationship': item.get('relationship', ''),
            })
        entry['members'] = members
        products = data.get('products')
        if isinstance(products, list) and products:
            entry['products'] = products

    return systems


# ---------------------------------------------------------------------------
# Graph validation
# ---------------------------------------------------------------------------

def validate_graph(graph: dict, *, verbose: bool = False) -> dict:
    """
    Validate graph integrity. Returns a report dict with:
      - missing_positions: targets referenced but not defined
      - orphan_positions: defined but never targeted by any transition/defense
      - missing_transitions: transition techniques referenced but not in transitions dict
    """
    positions = graph['positions']
    transitions = graph['transitions']
    submissions = graph['submissions']

    defined_positions = set(positions.keys())
    defined_transitions = set(transitions.keys())
    defined_submissions = set(submissions.keys())

    referenced_positions: set[str] = set()
    referenced_from: dict[str, list[str]] = {}  # target -> list of sources

    def track_ref(target_slug: str, source: str):
        if not target_slug:
            return
        referenced_positions.add(target_slug)
        referenced_from.setdefault(target_slug, []).append(source)

    # Collect all position targets from position transitions
    for pos_key, pos_data in positions.items():
        for t in pos_data.get('transitions', []):
            target = t.get('target', '')
            if target and not t.get('isSubmission', False):
                track_ref(target, f"position:{pos_key} -> transition:{t.get('technique', '?')}")

    # Collect targets from transition outcomes
    for t_key, t_data in transitions.items():
        ending = t_data.get('endingPosition', '')
        if ending:
            track_ref(ending, f"transition:{t_key}")

    # Compute sets — position transitions reference technique slugs
    # (transitions/submissions), not just position slugs, so exclude those
    all_known = defined_positions | defined_transitions | defined_submissions | TERMINAL_POSITIONS
    missing_positions = referenced_positions - all_known
    orphan_positions = defined_positions - referenced_positions - TERMINAL_POSITIONS

    # Ignore empty-string references
    missing_positions.discard('')

    report = {
        'missing_positions': sorted(missing_positions),
        'orphan_positions': sorted(orphan_positions),
        'missing_count': len(missing_positions),
        'orphan_count': len(orphan_positions),
    }

    # Print summary
    if missing_positions:
        print(f"\n  WARNING: {len(missing_positions)} missing position(s) (referenced but not defined)")
        if verbose:
            for slug in sorted(missing_positions):
                sources = referenced_from.get(slug, [])
                print(f"    - {slug}")
                for src in sources[:3]:
                    print(f"        referenced by: {src}")
                if len(sources) > 3:
                    print(f"        ... and {len(sources) - 3} more")

    if orphan_positions:
        print(f"  INFO: {len(orphan_positions)} orphan position(s) (defined but never targeted)")
        if verbose:
            for slug in sorted(orphan_positions):
                print(f"    - {slug}")

    if not missing_positions and not orphan_positions:
        print("\n  Graph integrity: OK (no missing or orphan nodes)")

    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_votes(project_root: Path) -> dict[str, float]:
    """Load community vote rates from templates/votes.json if it exists."""
    votes_file = project_root / 'templates' / 'votes.json'
    if not votes_file.exists():
        return {}
    try:
        with open(votes_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {
            name: entry['success_rate']
            for name, entry in data.get('votes', {}).items()
            if 'success_rate' in entry
        }
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load votes.json: {e}")
        return {}


def generate_state_graph(project_root: Path) -> dict:
    content_dir = project_root / 'content'
    print(f"Processing content from: {content_dir}")

    # Load community votes for success rate overrides
    vote_rates = load_votes(project_root)
    if vote_rates:
        print(f"  Loaded {len(vote_rates)} community vote rate(s) from votes.json")

    positions = process_positions(content_dir)
    print(f"  Processed {len(positions)} position roles")

    transitions = process_transitions(content_dir)
    print(f"  Processed {len(transitions)} transitions")

    submissions, hub_slugs, family_hubs = process_submissions(content_dir)
    print(f"  Processed {len(submissions)} submission variants + {len(family_hubs)} family hubs")

    principles = process_principles(content_dir)
    print(f"  Processed {len(principles)} principles")

    systems = process_systems(content_dir)
    member_total = sum(len(s.get('members', [])) for s in systems.values())
    product_total = sum(len(s.get('products', [])) for s in systems.values())
    print(f"  Processed {len(systems)} systems ({member_total} resolved members, "
          f"{product_total} affiliate products)")
    if _SYSTEM_UNRESOLVED:
        print(f"  WARNING: {len(_SYSTEM_UNRESOLVED)} system member reference(s) did not "
              f"resolve to a page (skipped):")
        for sys_name, ref_name, ref_type in _SYSTEM_UNRESOLVED[:25]:
            print(f"    - {sys_name}: [{ref_type}] {ref_name}")
        if len(_SYSTEM_UNRESOLVED) > 25:
            print(f"    ... and {len(_SYSTEM_UNRESOLVED) - 25} more")

    # Override success rates with community votes
    if vote_rates:
        vote_overrides = 0
        for t_data in transitions.values():
            name = t_data.get('name', '')
            if name in vote_rates:
                t_data['successRate'] = round(vote_rates[name], 1)
                vote_overrides += 1
        for s_data in submissions.values():
            name = s_data.get('name', '')
            if name in vote_rates:
                s_data['successRate'] = round(vote_rates[name], 1)
                vote_overrides += 1
        if vote_overrides:
            print(f"  Applied {vote_overrides} community vote rate override(s)")

    # Mark position transitions that target submissions (including family hubs)
    all_submission_slugs = set(submissions.keys()) | hub_slugs
    marked_count = 0
    for pos_data in positions.values():
        for t in pos_data.get('transitions', []):
            if t.get('target', '') in all_submission_slugs:
                t['isSubmission'] = True
                marked_count += 1
    if marked_count:
        print(f"  Marked {marked_count} position transition(s) as submission targets")

    # Enrich position transitions with successRate from transition/submission data
    enriched = 0
    for pos_data in positions.values():
        for t in pos_data.get('transitions', []):
            target_slug = t.get('target', '')
            if target_slug in transitions:
                t['successRate'] = transitions[target_slug].get('successRate', 50)
            elif target_slug in all_submission_slugs and target_slug in submissions:
                t['successRate'] = submissions[target_slug].get('successRate', 50)
            else:
                t['successRate'] = 50
            enriched += 1
    print(f"  Enriched {enriched} position transition(s) with successRate")

    # Build path index for opponent transition outcome lookups
    positions_dir = content_dir / 'Positions'
    path_index = build_position_path_index(positions_dir)

    # Add opponentTransitions: for each position role, copy the opposite role's transitions
    opponent_count = 0
    for pos_key, pos_data in positions.items():
        role = pos_data.get('role')
        hub = pos_data.get('hub')
        if role not in ('top', 'bottom') or not hub:
            continue

        opposite_role = 'bottom' if role == 'top' else 'top'
        opposite_key = f"{hub}/{opposite_role}"
        opposite_data = positions.get(opposite_key)
        if not opposite_data:
            continue

        opponent_transitions = []
        for t in opposite_data.get('transitions', []):
            opp_t = {
                'technique': t.get('technique', ''),
                'target': t.get('target', ''),
                'targetPath': t.get('targetPath', ''),
                'isSubmission': t.get('isSubmission', False),
                'attemptProbability': t.get('attemptProbability', 0),
                'successRate': t.get('successRate', 50),
            }
            # Embed the success outcome from the transition's outcomes array
            target_slug = t.get('target', '')
            if target_slug in transitions:
                trans_outcomes = transitions[target_slug].get('outcomes', [])
                for outcome in trans_outcomes:
                    if outcome.get('result') == 'success':
                        outcome_to = outcome.get('to', '')
                        opp_t['successOutcome'] = outcome_to
                        # Look up path for the outcome position (use first segment as position name)
                        outcome_pos = outcome_to.split('/')[0] if outcome_to else ''
                        if outcome_pos:
                            opp_t['successOutcomePath'] = path_index.get(outcome_pos, outcome_pos) if not t.get('isSubmission', False) else ''
                        break
            elif target_slug in submissions:
                opp_t['successOutcome'] = 'game-over'
                opp_t['successOutcomePath'] = ''

            opponent_transitions.append(opp_t)

        if opponent_transitions:
            pos_data['opponentTransitions'] = opponent_transitions
            opponent_count += 1

    if opponent_count:
        print(f"  Added opponentTransitions to {opponent_count} position role(s)")

    # Diagnostic: check for opponentTransitions with successOutcome=game-over but isSubmission=False
    mismarked = 0
    for pos_key, pos_data in positions.items():
        for opp_t in pos_data.get('opponentTransitions', []):
            if opp_t.get('successOutcome') == 'game-over' and not opp_t.get('isSubmission', False):
                mismarked += 1
                print(f"  WARNING: opponentTransition '{opp_t.get('technique')}' on {pos_key} "
                      f"has successOutcome=game-over but isSubmission=False")
                # Auto-fix: mark as submission
                opp_t['isSubmission'] = True
    if mismarked:
        print(f"  Auto-fixed {mismarked} mismarked submission opponentTransition(s)")

    # Rewrite generic submission outcomes to position-specific variants when available
    rewrite_count = 0
    for t_key, t_data in transitions.items():
        start_path = t_data.get('startingPositionPath', '')
        if not start_path:
            continue
        # Use the leaf position name (e.g., "Side-Control" from "Side-Control/Top")
        leaf = start_path.split('/')[-1] if '/' in start_path else start_path
        leaf_slug = slugify(leaf)

        for outcome in t_data.get('outcomes', []):
            to_slug = outcome.get('to', '')
            if to_slug == 'game-over' or '-from-' in to_slug:
                continue
            # Match both active submissions and hub slugs (hubs excluded from graph)
            if to_slug not in submissions and to_slug not in hub_slugs:
                continue
            variant_slug = f'{to_slug}-from-{leaf_slug}'
            if variant_slug in submissions:
                outcome['to'] = variant_slug
                rewrite_count += 1
    if rewrite_count:
        print(f"  Rewrote {rewrite_count} outcome(s) to position-specific submission variants")

    # Post-process endingPosition: submission targets → game-over
    # (process_transitions runs before submissions are known, so it can't
    # detect submission slugs and incorrectly appends /top)
    ending_rewrite_count = 0
    for t_data in transitions.values():
        ending = t_data.get('endingPosition', '')
        if not ending:
            continue
        base = ending.rsplit('/top', 1)[0] if ending.endswith('/top') else ending
        if base in all_submission_slugs:
            t_data['endingPosition'] = 'game-over'
            t_data['endingPositionPath'] = 'Game-Over'
            ending_rewrite_count += 1
    if ending_rewrite_count:
        print(f"  Rewrote {ending_rewrite_count} endingPosition(s) from submission to game-over")

    # Merge family-hub entries into submissions AFTER variant-only processing has run
    # (successRate enrichment, outcome rewriting, ending rewriting only operate on variants).
    for family_slug, family_entry in family_hubs.items():
        if family_slug not in submissions:
            submissions[family_slug] = family_entry

    # Resolve alias references: any edge still pointing at a merged/renamed
    # technique's old slug is rewritten to the canonical node. No-op until
    # aliases[] are populated (epic phase 12).
    pos_alias_map, tech_alias_map = build_alias_maps(content_dir)
    assembled = {
        'positions': positions,
        'transitions': transitions,
        'submissions': submissions,
    }
    rewritten = rewrite_aliases(assembled, pos_alias_map, tech_alias_map)
    if rewritten:
        print(f"  Resolved {rewritten} alias reference(s) to canonical nodes")

    return {
        'positions': positions,
        'transitions': transitions,
        'submissions': submissions,
        'principles': principles,
        'systems': systems,
        'meta': {
            'generated': datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            'positionCount': len(positions),
            'transitionCount': len(transitions),
            'submissionCount': len(submissions),
            'principleCount': len(principles),
            'systemCount': len(systems),
            'unresolvedSystemMemberCount': len(_SYSTEM_UNRESOLVED),
        },
    }


def main():
    parser = argparse.ArgumentParser(description='Generate graph.json for BJJGraph')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Print every missing/orphan node')
    parser.add_argument('--strict', action='store_true',
                        help='Exit non-zero if missing nodes are found (for CI)')
    parser.add_argument('--strict-sources', dest='strict_sources',
                        action=argparse.BooleanOptionalAction, default=True,
                        help='Hard-fail (exit non-zero) if any source JSON failed '
                             'to parse, before writing graph.json (default: on; '
                             'use --no-strict-sources / --lenient to opt out)')
    parser.add_argument('--lenient', dest='strict_sources', action='store_false',
                        help='Alias for --no-strict-sources: skip unparseable files')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    state_graph = generate_state_graph(project_root)

    # Hard-fail on corrupt source files BEFORE writing graph.json so a single
    # malformed content/*.json never silently vanishes (orphaning its references)
    # while the script still exits 0.
    if _PARSE_FAILURES:
        print(f"\nERROR: {len(_PARSE_FAILURES)} source JSON file(s) failed to parse:")
        for path, err in _PARSE_FAILURES:
            print(f"  - {path}: {err}")
        if args.strict_sources:
            print("\n  Refusing to write graph.json with missing source files. "
                  "(use --no-strict-sources / --lenient to override)")
            sys.exit(1)
        else:
            print("\n  --lenient: continuing with these files omitted from the graph.")

    # Validate graph integrity
    report = validate_graph(state_graph, verbose=args.verbose)

    # Write output (atomic: never leave a truncated graph.json on crash/Ctrl-C)
    output_file = project_root / 'graph.json'
    atomic_write_json(output_file, state_graph, indent=2, ensure_ascii=False,
                      trailing_newline=False)

    print(f"\nGenerated: {output_file}")
    print(f"  Positions: {len(state_graph['positions'])}")
    print(f"  Transitions: {len(state_graph['transitions'])}")
    print(f"  Submissions: {len(state_graph['submissions'])}")
    print(f"  Principles: {len(state_graph['principles'])}")
    print(f"  Systems: {len(state_graph['systems'])}")

    if args.strict and report['missing_count'] > 0:
        print(f"\n  STRICT MODE: {report['missing_count']} missing node(s) found. Exiting with error.")
        sys.exit(1)


if __name__ == '__main__':
    main()
