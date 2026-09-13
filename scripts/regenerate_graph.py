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
from _ruleset import reduce_to_scalar, as_map, cell, present_rulesets, RULESETS  # {gi,nogi} contract (calibration-v2); positions load raw since Q3
import _votes  # forked {community, prior} votes schema — prior-blended per-ruleset rates (Phase 2.3b)


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


# Collects (where, what) for every value that violates the {gi,nogi} contract in a way no
# fold can repair: a probability whose EVERY frame is null exists in no ruleset at all, so
# there is nothing to emit and nothing to fall back on. Kept apart from _PARSE_FAILURES
# because the file parsed fine — the CONTENT is the problem — but handled the same way:
# main() prints every offender by name and, under --strict-sources (the default), refuses
# to write graph.json. The alternative is the defect this whole pass exists to remove: a
# structural absence folded into a plausible 0 that no consumer can tell from an authored
# "exists but is never attempted".
_RULESET_FAILURES: list[tuple[str, str]] = []


# Collects (where, what) for every JOIN, CENSUS or OVERRIDE PASS that ran and matched
# NOTHING. Distinct from both lists above: no file is corrupt and no value is contract-
# breaking — the code simply looked at zero rows and then printed a line whose zeros read
# exactly like a clean bill of health. That is CLAUDE.md 6.6's most repeated defect
# ("a check that never ran reports clean"), and the counters this module prints are
# themselves subject to it: "0 with no gi frame" out of "0 total" is not the same claim as
# "0 with no gi frame" out of "2543 total". Each feeder below therefore states the
# DENOMINATOR that made it fire. Same --strict-sources escape hatch as the other two.
_COVERAGE_FAILURES: list[tuple[str, str]] = []


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

    # alias mapping only reads name/slug/aliases — never probabilities — so load RAW
    # (reduce=False): positions now carry divergent {gi,nogi} attempt maps that
    # reduce_to_scalar(frame=None) would raise on (Q3).
    pos_dir = content_dir / 'Positions'
    if pos_dir.exists():
        for data in load_json_files(pos_dir, reduce=False):
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
        for data in load_json_files(d, reduce=False):  # name/slug/aliases only — load raw
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


def load_json_files(directory: Path, reduce: bool = True) -> list[dict]:
    """Load all JSON files from a directory recursively.

    reduce=False keeps {gi,nogi} ruleset maps intact (Q3+: positions carry REAL
    attempt divergence; reduce_to_scalar would raise on it). Callers that pass
    reduce=False handle maps at each probability read site via as_map/cell.
    """
    files = []
    if not directory.exists():
        # A skip path that PRINTS (CLAUDE.md 6.6). A renamed, moved or missing content
        # directory used to return an empty list in TOTAL SILENCE, which is indistinguishable
        # from a directory that loaded cleanly and happened to hold nothing — and the caller's
        # own "Processed 0 X" line reads the same way. The coverage print below claims to run
        # on every call; this branch is what makes that claim true.
        print(f"  Loaded 0 of 0 JSON file(s) from {directory.name}/ (DIRECTORY ABSENT: {directory})")
        return files

    found = skipped_schema = skipped_nondict = 0
    for json_file in directory.rglob('*.json'):
        found += 1
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            # Don't silently drop: record the failure so main() can hard-fail
            # before graph.json is written (a dropped node orphans its references).
            print(f"ERROR: Could not load {json_file}: {e}")
            _PARSE_FAILURES.append((str(json_file), str(e)))
            continue

        if reduce:
            # reduce_to_scalar raises a plain ValueError on a DIVERGENT {gi,nogi} map, and
            # the handler above does NOT catch it: json.JSONDecodeError is a subclass of
            # ValueError, not the other way round. So before this narrow try the fork error
            # escaped the loader entirely — the run died at the FIRST offending file, after
            # "Processed N position roles" had already printed, with a message that named
            # the map but no path, and this function's own "Could not load {path}" line (the
            # one mechanism that names the offender) never ran.
            #
            # Do NOT instead widen the handler above to ValueError: that turns a fork error
            # into a silent `continue`, dropping the technique from the graph and orphaning
            # every edge that references it — precisely what _PARSE_FAILURES exists to stop.
            try:
                data = reduce_to_scalar(data)
            except ValueError as e:
                print(f"ERROR: Could not load {json_file}: {e}")
                _PARSE_FAILURES.append((str(json_file), f"ruleset fork: {e}"))
                continue

        if not isinstance(data, dict):
            skipped_nondict += 1
            continue
        if '$schema' in data and 'title' in data and 'properties' in data:
            skipped_schema += 1
            continue
        data['_source_file'] = str(json_file)
        files.append(data)

    # Positive coverage, printed on EVERY call including the zero cases (CLAUDE.md 6.6):
    # this loader had no way to say how much it had seen, so "the directory holds nothing",
    # "everything in it was filtered out" and "everything in it failed to parse" all
    # produced the same empty list and the same silence. Naming each skip path separately
    # is what keeps "found no problems" distinct from "never looked".
    print(f"  Loaded {len(files)} of {found} JSON file(s) from {directory.name}/ "
          f"(skipped {skipped_schema} schema, {skipped_nondict} non-dict)")
    if found and not files:
        _PARSE_FAILURES.append((str(directory), f"0 of {found} JSON file(s) loaded"))

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


def _qa_full(qa: dict) -> dict:
    """Flashcard card reduced for graph.json, RETAINING the optional MC fields (one-line
    `answer_line` + graded `distractors`) so the neural bridge can surface them. Plain
    {question,answer} for the static-page contract; extras only when present."""
    c = {'question': qa.get('question', ''), 'answer': qa.get('answer', '')}
    if qa.get('answer_line'):
        c['answer_line'] = qa['answer_line']
    if qa.get('distractors'):
        c['distractors'] = qa['distractors']
    return c


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


def curate_hub_flashcards(variants: list[dict], stats: dict | None = None) -> list[dict]:
    """Curate a family-hub deck from its variants' (already exact-deduped) decks.

    Weighted Top-K per variant (more cards from higher-successRate positions) with
    a per-variant floor, round-robin interleaved for positional breadth, then a
    hub-only near-duplicate collapse, hard-capped at HUB_FLASHCARD_CAP.

    THE WEIGHTING IS DEAD TODAY, and has been since the role split. `variants` are the
    variant HUB nodes, and a submission hub is built (process_submissions) with
    name/hub/role/isTerminal/**meta/flashcards and NO successRate — the rate lives on the
    /attacker role-node. Measured: 0 of 283 variant decks carry the key, so `total` is 0 on
    every hub and every variant gets exactly MIN_PER_VARIANT. `stats` counts that instead of
    letting it read as "the weighting ran and happened to come out even" — a value identical
    across a whole category is a constant until proven otherwise (CLAUDE.md 6.6).

    Repairing it (weight off `submissions[f'{key}/attacker']`, or attach the rate to the
    variant hub) MOVES real decks on the current corpus, so it is a behaviour change and the
    owner's call — deliberately NOT bundled into a null-safety pass.

    READ THIS BEFORE REPAIRING IT. The line below still resolves a missing/None rate to
    **0.0**, which is `or 0` with the coercion spelled out — behaviour-identical to what was
    here before, and harmless ONLY because `total` is 0 on every hub today so the weighted
    branch is unreachable. The moment the weighting is made live, 0.0 stops meaning "no
    information" and starts meaning "rank this variant LAST", which is the fabricated-number
    defect this pass exists to remove. The correct null semantics is to EXCLUDE a null-rate
    variant from `total` and give it the equal-weight floor. Both halves must land together.
    """
    if stats is not None:
        stats['variants'] = stats.get('variants', 0) + len(variants)
        stats['rated'] = stats.get('rated', 0) + sum(
            1 for v in variants if v.get('successRate') is not None)
    # Written out rather than `float(v.get('successRate') or 0)` so the null case is a
    # branch you can see, not a coercion hidden in an `or`. Identical result on every input.
    rates = [0.0 if v.get('successRate') is None else max(0.0, float(v['successRate']))
             for v in variants]
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

# ONE place where a position -> technique edge is built, for BOTH the role-split branch
# (process_position_role) and the neutral single-template branch in process_positions.
# They were two verbatim copies of the same seven lines: a fix applied to one of them left
# the other wrong by construction (CLAUDE.md 6.5 — when one question is answered in two
# places, one of them is already wrong). The neutral branch is DEAD on today's corpus —
# measured 0 nodes with role 'neutral', because every one of the 136 position files carries
# a top or a bottom — which is exactly why it must not be a second implementation: nobody
# would notice it drifting. _EDGE_STATS['neutral_edges'] prints that 0 rather than assuming it.
# (Unifying them merged one cosmetic difference: the neutral copy's missing-name default was
# 'Unknown', the role copy's 'Unknown Technique'. Doubly unreachable — the branch never runs,
# and every authored transition carries a `transition` key — so 'Unknown Technique' wins.)
#
# `attemptProbability` is the FOLDED headline (default no-gi frame) and is emitted as JSON
# **null** when that frame carries no cell. It used to read `0 if headline is None else
# headline`, which is the exact defect the ruleset contract exists to prevent: null means
# "this edge does not exist in no-gi", 0 means "it exists and is ~never attempted", and a
# consumer reading only the scalar cannot tell them apart. Measured on the 71-cell null
# pass, that fold turned 11 lapel-guard/bottom edges from 18/9/12/… into 0 with byte-
# identical console output and exit 0.
#
# The edge is NOT dropped from transitions[]: graph.json carries ONE edge list for both
# frames, so attemptProbabilityByRuleset is the only place the gi cell still exists. A
# consumer that wants the hand for a frame filters on that map, never on the scalar.
_EDGE_STATS: dict = {}


def _reset_edge_stats() -> None:
    _EDGE_STATS.clear()
    _EDGE_STATS.update({'edges': 0, 'neutral_edges': 0, 'no_gi': 0, 'no_nogi': 0,
                        'no_ap_key': 0, 'no_frame': [], 'dead_hands': []})


_reset_edge_stats()


def _position_edge(t: dict, state_id: str) -> dict:
    """One position -> technique edge, with its per-frame availability counted."""
    technique_name = t.get('transition', 'Unknown Technique')
    # The `0` default fires only on an ABSENT key, never on an explicit null — as_map(None)
    # is {gi: None, nogi: None} and flows through as the no-frame case below. An absent key
    # is a DIFFERENT fact from a null one (unauthored vs. deliberately does-not-exist) and it
    # is the one place here that still fabricates a number, so it is counted rather than
    # assumed away: 0 of 2543 position transitions lack the key today
    # (`grep -c attempt_probability` per file), and a fallback that never says it fired buys
    # months of silence (CLAUDE.md 6.6).
    if 'attempt_probability' not in t:
        _EDGE_STATS['no_ap_key'] += 1
    ap_map = as_map(t.get('attempt_probability', 0))
    headline = cell(ap_map, 'nogi')  # no-gi default frame, same as successRate
    frames = present_rulesets([ap_map])

    _EDGE_STATS['edges'] += 1
    if 'gi' not in frames:
        _EDGE_STATS['no_gi'] += 1
    if 'nogi' not in frames:
        _EDGE_STATS['no_nogi'] += 1
    if not frames:
        # No frame at all: the edge is authored but exists in neither ruleset. There is no
        # honest scalar for it and no fold that recovers one, so main() hard-fails on it
        # rather than shipping an edge the state machine can enter and never leave.
        _EDGE_STATS['no_frame'].append(f"{state_id} -> {technique_name}")

    return {
        'technique': technique_name,
        'target': slugify(technique_name),
        'targetPath': quartz_slug(technique_name),
        'isSubmission': False,
        'attemptProbability': headline,
        'attemptProbabilityByRuleset': ap_map,
    }


def _position_edges(raw_transitions: list, state_id: str, neutral: bool = False) -> list:
    """Build a state's outgoing edges and record which frames its whole HAND survives in.

    A state whose every edge lost a frame has no legal move at all in that ruleset — a
    dead end the per-edge counts cannot show, because each individual edge still looks
    like an ordinary absence. Named here so it reads as one line in the run log instead
    of being reconstructed from graph.json afterwards.
    """
    edges = [_position_edge(t, state_id) for t in (raw_transitions or [])]
    if neutral:
        _EDGE_STATS['neutral_edges'] += len(edges)
    if edges:
        frames = present_rulesets([e['attemptProbabilityByRuleset'] for e in edges])
        for rs in RULESETS:
            if rs not in frames:
                _EDGE_STATS['dead_hands'].append(f"{state_id} [{rs}]")
    return edges


def process_position_role(position_data: dict, role: str, hub_slug: str, hub_path: str, path_index: dict, family_ctx: dict | None = None) -> dict | None:
    role_data = position_data.get(role)
    if not role_data:
        return None

    slug = f"{hub_slug}/{role}"
    full_path = f"{hub_path}/{role.title()}"
    name = role_data.get('name', f"{position_data.get('name', 'Unknown')} {role.title()}")

    transitions = _position_edges(role_data.get('transitions', []), slug)

    state_props = role_data.get('state_properties', {})

    flashcards = [
        _qa_full(qa)
        for qa in role_data.get('flashcards', [])
    ]

    # multi-level flashcard hierarchy: own ROLE cards (above) + role-agnostic POSITION cards from
    # the file root (flashcards_position, shared by top+bottom) + FAMILY cards from the owning hub.
    # flat `flashcards` stays = the node's own role deck (unchanged contract); tiers are additive.
    position_tier = dedupe_flashcards([
        _qa_full(qa)
        for qa in position_data.get('flashcards_position', [])
    ])
    family_tier = family_ctx['cards'] if family_ctx else []

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
        'flashcardTiers': {'family': family_tier, 'position': position_tier, 'role': flashcards},
        'familyHub': family_ctx['hub_name'] if family_ctx else None,
    }


def process_positions(content_dir: Path) -> dict:
    _reset_edge_stats()   # module-level counters; one run == one census
    positions_dir = content_dir / 'Positions'
    # raw load: attempt_probability may be a divergent {gi,nogi} map (Q3 occurrence calibration)
    position_files = load_json_files(positions_dir, reduce=False)
    path_index = build_position_path_index(positions_dir)
    positions = {}

    # multi-level flashcard hierarchy: index each FAMILY hub's variants -> the hub's authored
    # family-tier cards (flashcards_family). Membership is by variations[].slug (position families
    # do NOT set a `family` back-pointer). Used to attach flashcardTiers.family to each variant.
    def _map_qa(cards):
        return dedupe_flashcards([
            _qa_full(qa) for qa in (cards or [])
        ])
    family_of = {}            # variant_slug -> {'hub_slug', 'hub_name', 'cards'}
    family_cards_by_hub = {}  # hub_slug -> family cards (for the hub node itself)
    family_name_by_hub = {}   # hub_slug -> family display name (for tier deck keys)
    for pd in position_files:
        if pd.get('variations'):
            fam_cards = _map_qa(pd.get('flashcards_family'))
            h_slug = slugify(pd.get('slug', pd.get('name', '')))
            h_name = pd.get('name', h_slug)
            family_cards_by_hub[h_slug] = fam_cards
            family_name_by_hub[h_slug] = h_name
            for v in pd['variations']:
                vslug = slugify(v.get('slug') or v.get('name', ''))
                if vslug:
                    family_of[vslug] = {'hub_slug': h_slug, 'hub_name': h_name, 'cards': fam_cards}

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

        # a variant leaf inherits its family's cards (by its own slug); a family hub's OWN role
        # nodes also belong to the family (so drilling base Mount surfaces Mount family principles)
        fam_ctx = family_of.get(hub_slug)
        if fam_ctx is None and hub_slug in family_cards_by_hub:
            fam_ctx = {'hub_slug': hub_slug, 'hub_name': family_name_by_hub[hub_slug], 'cards': family_cards_by_hub[hub_slug]}

        top = process_position_role(pos_data, 'top', hub_slug, hub_path, path_index, family_ctx=fam_ctx)
        if top:
            positions[f"{hub_slug}/top"] = top

        bottom = process_position_role(pos_data, 'bottom', hub_slug, hub_path, path_index, family_ctx=fam_ctx)
        if bottom:
            positions[f"{hub_slug}/bottom"] = bottom

        # Hub entry. A FAMILY hub's deck is its AUTHORED family-tier cards (flashcards_family) —
        # a real "family principles" deck (empty until backfilled), NOT the old empty top+bottom
        # aggregate. A standalone dual position (no variations) keeps the classic top+bottom aggregate.
        if top or bottom:
            if hub_slug in family_cards_by_hub:
                fam_cards = family_cards_by_hub[hub_slug]
                hub_flashcards = fam_cards
            else:
                fam_cards = []
                hub_flashcards = dedupe_flashcards(
                    (top or {}).get('flashcards', []) + (bottom or {}).get('flashcards', [])
                )
            positions[hub_slug] = {
                'name': pos_data['name'],
                'hub': hub_slug,
                'role': 'hub',
                'path': hub_path,
                'flashcards': hub_flashcards,
                'flashcardTiers': {'family': fam_cards, 'position': [], 'role': []},
            }

        # Neutral positions (no top/bottom - SINGLE template)
        if not top and not bottom:
            transitions = _position_edges(pos_data.get('transitions', []), hub_slug,
                                          neutral=True)

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

    _report_position_edges(len(positions))
    return positions


def _report_position_edges(n_roles: int) -> None:
    """The positive coverage the fold never had (CLAUDE.md 6.6).

    Every one of the 71 cells in the first null pass was invisible: console output and the
    exit code were byte-identical to the pristine run, and the only trace was 11 folded
    scalars deep inside graph.json. These four numbers are printed on EVERY run — including
    the all-zero run that today's corpus produces — so "no edge lost a frame" can never be
    confused with "nobody counted".
    """
    st = _EDGE_STATS
    print(f"  Position edges: {st['edges']} total ({st['neutral_edges']} from neutral "
          f"single-template states); {st['no_gi']} with no gi frame, "
          f"{st['no_nogi']} with no no-gi frame, "
          f"{st['no_ap_key']} with no attempt_probability key (defaulted to 0)")
    if st['no_ap_key']:
        print(f"  WARNING: {st['no_ap_key']} position edge(s) carry NO attempt_probability "
              f"key and were defaulted to 0 in BOTH frames — a fabricated number, not an "
              f"absence. Author the key or null the frame that does not exist.")
    if n_roles and not st['edges']:
        # The zeros above are only a clean bill of health against a non-zero denominator.
        _COVERAGE_FAILURES.append(
            ('position edges',
             f"censused 0 edges across {n_roles} position role(s) — the edge builder "
             f"matched nothing, which is not the same as finding nothing"))
    if st['dead_hands']:
        shown = ', '.join(st['dead_hands'][:15])
        more = f" ... and {len(st['dead_hands']) - 15} more" if len(st['dead_hands']) > 15 else ''
        print(f"  WARNING: {len(st['dead_hands'])} state(s) lose an ENTIRE frame's hand "
              f"(no legal move in that ruleset): {shown}{more}")
    for ref in st['no_frame']:
        _RULESET_FAILURES.append((ref, 'attempt_probability exists in no ruleset frame'))


# ---------------------------------------------------------------------------
# Transition processing
# ---------------------------------------------------------------------------

# Role-typed technique split (mirrors the position top/bottom split). A technique becomes THREE
# graph nodes: an edgeless `<slug>` hub (flashcard aggregator), `<slug>/attacker` (the player
# attempting it — outcomes/successRate as authored), and `<slug>/defender` (the opponent — the SAME
# exchange viewed from the other side: outcome targets role-flipped, results re-perspectived, and
# successRate = 100 − attacker successRate). This makes the state machine a fully role-typed
# alternating game (position-role → technique/attacker → position-role …).

def _flip_role(role: str) -> str:
    return {'top': 'bottom', 'bottom': 'top'}.get(role, role)


def _flip_role_suffix(slug: str) -> str:
    """Flip a `position/role` target's role for the defender's perspective. game-over / neutral /
    bare-position targets are unchanged (no role to flip)."""
    if slug.endswith('/top'):
        return slug[:-len('/top')] + '/bottom'
    if slug.endswith('/bottom'):
        return slug[:-len('/bottom')] + '/top'
    return slug


# Defender's result label for each attacker result: the attacker winning the exchange is a loss for
# the defender; the attacker failing or being countered is a win (a successful defense/reversal).
_DEFENDER_RESULT = {'success': 'failure', 'failure': 'success', 'counter': 'success'}


def _defender_outcomes(att_outcomes: list) -> list:
    """Mirror an attacker outcome list into the defender's perspective: same probabilities, role-
    flipped targets, re-perspectived result labels.

    The probabilities are COPIED, never re-read from content, so a null attacker cell stays a
    null defender cell and the census in `_outcome_prob` counts each authored outcome exactly
    once. `o.get('probability', 0)` here can only see what the attacker site already emitted.
    """
    return [
        {
            'to': _flip_role_suffix(o.get('to', '')),
            'probability': o.get('probability', 0),
            'result': _DEFENDER_RESULT.get(o.get('result', 'success'), o.get('result', 'success')),
        }
        for o in att_outcomes
    ]


# The authored outcome distribution is the OTHER place a technique's probabilities live, and
# it is the one the null-safety pass left uncounted. Proven, with the patch applied: null the
# `probability` of one outcome and empty templates/votes.json, and graph.json ships
# `probability: null` on the attacker AND its role-flipped defender, exit 0, with NOTHING on
# the console — the only counter that could have caught it ("rescaled N, skipped M") lives
# inside the vote-override branch and reads 0 when there are no votes. So it reported the same
# thing for "no outcome was absent" and "nobody looked". These counters are the positive
# coverage; they change no emitted value.
_OUTCOME_STATS: dict = {}


def _reset_outcome_stats(scope: str) -> None:
    _OUTCOME_STATS[scope] = {'outcomes': 0, 'no_prob_key': 0, 'no_frame': 0, 'no_frame_refs': [],
                             'techniques': 0, 'no_sr_key': 0}


def _outcome_prob(o: dict, ref: str, scope: str):
    """The authored probability of ONE outcome, censused as it is read.

    Read at the two AUTHORED sites only (the transition attacker and the submission
    attacker). `_defender_outcomes` deliberately does NOT call this: it is a role-FLIP of an
    already-counted attacker list, not a second read of content, and counting it there would
    double every number for no new information (CLAUDE.md 6.5).

    Like every other probability here the value is passed through UNCHANGED — an explicit
    null stays null. The `0` default fires only on an ABSENT key (0 of 4,150 authored
    outcomes today), and when it does it is a fabricated number, so it says so.
    """
    st = _OUTCOME_STATS[scope]
    st['outcomes'] += 1
    if 'probability' not in o:
        st['no_prob_key'] += 1
        return 0
    prob = o['probability']
    if not present_rulesets([prob]):
        st['no_frame'] += 1
        if len(st['no_frame_refs']) < 40:
            st['no_frame_refs'].append(ref)
    return prob


def _count_success_rate_key(data: dict, scope: str) -> None:
    """Census the OTHER numeric default on a technique: `.get('success_rate', 50)`.

    Two different absences hide behind that one expression and only one of them is handled
    elsewhere. An explicit null is caught by `_record_no_frame_rate` and hard-fails; an ABSENT
    key silently becomes a fabricated 50, in both frames, on a technique nobody authored a rate
    for. 0 of 1,391 technique files lack the key today, and a fallback that never says it fired
    is the defect this pass exists to remove (CLAUDE.md 6.6), so the zero is printed.
    """
    st = _OUTCOME_STATS[scope]
    st['techniques'] += 1
    if 'success_rate' not in data:
        st['no_sr_key'] += 1


def _report_outcomes(scope: str) -> None:
    st = _OUTCOME_STATS[scope]
    print(f"  {scope.capitalize()} rates: {st['techniques']} technique(s); "
          f"{st['no_sr_key']} with no success_rate key (defaulted to 50)")
    if st['no_sr_key']:
        print(f"  WARNING: {st['no_sr_key']} {scope} carry NO success_rate key and were "
              f"defaulted to 50 in BOTH frames — a fabricated number, not an absence.")
    print(f"  {scope.capitalize()} outcomes: {st['outcomes']} authored; "
          f"{st['no_prob_key']} with no probability key (defaulted to 0), "
          f"{st['no_frame']} that exist in no ruleset frame (emitted null)")
    if st['no_prob_key']:
        print(f"  WARNING: {st['no_prob_key']} {scope} outcome(s) carry NO probability key "
              f"and were defaulted to 0 — a fabricated number, not an absence.")
    if st['no_frame']:
        shown = ', '.join(st['no_frame_refs'][:15])
        more = f" ... and {st['no_frame'] - 15} more" if st['no_frame'] > 15 else ''
        print(f"  WARNING: {st['no_frame']} {scope} outcome(s) exist in NO ruleset frame and "
              f"ship as `probability: null`: {shown}{more}")


def _complement_rate(success_rate):
    """The defender's side of an exchange: 100 - attacker, or None when there is no exchange.

    Transitions and Submissions still load REDUCED (reduce_to_scalar), so a DIVERGENT
    {gi,nogi} rate is caught in load_json_files and never reaches here; a MIRROR null
    ({gi:null,nogi:null}) collapses to a bare None and DOES. `max(0, 100 - None)` is a
    TypeError that killed the run after "Processed N position roles" with no path in the
    message — but coercing to `max(0, 100 - 0)` = 100 would be far worse: it hands the
    defender a 100% success rate in a ruleset where the exchange does not exist at all.
    A null attacker frame must yield a null defender frame; nothing else is honest.
    """
    return None if success_rate is None else max(0, 100 - success_rate)


def _record_no_frame_rate(data: dict, slug: str) -> None:
    """Flag a technique whose success_rate exists in no ruleset frame.

    `trans_data.get('success_rate', 50)` READS like a safety net and is not one: the 50
    fires only on an ABSENT key, never on an explicit null ({'success_rate': None}.get(
    'success_rate', 50) is None). Rather than teach the default to swallow the null — which
    would invent a 50% rate for an exchange the content says does not exist — name the file
    and let main() hard-fail on it.
    """
    _RULESET_FAILURES.append((data.get('_source_file', slug),
                              'success_rate exists in no ruleset frame'))


def _first_success_target(outcomes: list) -> str:
    for o in outcomes:
        if o.get('result') == 'success':
            return o.get('to', '')
    return ''


def process_transitions(content_dir: Path) -> dict:
    transitions_dir = content_dir / 'Transitions'
    positions_dir = content_dir / 'Positions'
    transition_files = load_json_files(transitions_dir)
    path_index = build_position_path_index(positions_dir)
    transitions = {}
    _reset_outcome_stats('transitions')   # module-level counters; one run == one census

    for trans_data in transition_files:
        if 'name' not in trans_data:
            continue

        slug = slugify(trans_data['name'])

        # Support both flat and attacker/defender structures
        attacker = trans_data.get('attacker', {})
        attacker_flashcards = [
            _qa_full(qa)
            for qa in attacker.get('flashcards', trans_data.get('flashcards', []))
        ]

        defender = trans_data.get('defender', {})
        defender_flashcards = [
            _qa_full(qa)
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

        _count_success_rate_key(trans_data, 'transitions')
        success_rate = trans_data.get('success_rate', 50)
        if success_rate is None:
            _record_no_frame_rate(trans_data, slug)

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
                'probability': _outcome_prob(o, f"{slug} -> {to_slug or '?'}", 'transitions'),
                'result': o.get('result', 'success')
            })

        # Extract starting position role and path for outcome card navigation
        starting_position_role = ''
        starting_position_path = path_index.get(starting_position_slug, starting_position_slug)
        if from_position_raw and '/' in from_position_raw:
            starting_position_role = from_position_raw.split('/')[1].lower()

        att_role = starting_position_role
        def_role = _flip_role(starting_position_role)

        # ATTACKER role-node — the player attempting the technique (outcomes as authored).
        attacker_entry = {
            'name': trans_data['name'],
            'hub': slug,
            'role': 'attacker',
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': att_role,
            # Canonical structured origin (consumers filter/link by these, not the title).
            # fromPosition = position display name; fromPositionId = position node id/slug.
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': att_role,
            'endingPosition': ending_slug,
            'endingPositionPath': ending_path,
            'successRate': success_rate,
            'flashcards': attacker_flashcards,
            'commonCounters': common_counters,
        }
        if outcomes:
            attacker_entry['outcomes'] = outcomes

        # DEFENDER role-node — the opponent, same exchange role-flipped.
        def_outcomes = _defender_outcomes(outcomes) if outcomes else []
        defender_entry = {
            'name': trans_data['name'],
            'hub': slug,
            'role': 'defender',
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': def_role,
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': def_role,
            'endingPosition': _first_success_target(def_outcomes),  # already role-flipped in def_outcomes
            'endingPositionPath': '',
            'successRate': _complement_rate(success_rate),
            'flashcards': defender_flashcards,
            'commonCounters': [],
        }
        if def_outcomes:
            defender_entry['outcomes'] = def_outcomes

        # HUB — edgeless flashcard aggregator (mirrors the position hub).
        transitions[slug] = {
            'name': trans_data['name'],
            'hub': slug,
            'role': 'hub',
            'flashcards': dedupe_flashcards(attacker_flashcards + defender_flashcards),
        }
        transitions[f"{slug}/attacker"] = attacker_entry
        transitions[f"{slug}/defender"] = defender_entry

    _report_outcomes('transitions')
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
    _reset_outcome_stats('submissions')   # module-level counters; one run == one census

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
        _count_success_rate_key(sub_data, 'submissions')
        success_rate = sub_data.get('success_rate', 50)
        if success_rate is None:
            _record_no_frame_rate(sub_data, slug)

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

        outcomes_raw = sub_data.get('outcomes', [])
        outcomes = [
            {
                'to': '/'.join(slugify(part) for part in o.get('to', '').split('/')) if o.get('to') else '',
                'probability': _outcome_prob(o, f"{slug} -> {o.get('to', '?')}", 'submissions'),
                'result': o.get('result', 'success')
            }
            for o in outcomes_raw
        ]

        att_role = starting_position_role
        def_role = _flip_role(starting_position_role)
        meta = {
            'category': sub_data.get('submission_category', 'Unknown'),
            'type': sub_data.get('submission_type', 'Unknown'),
            'targetArea': sub_data.get('target_area', 'Unknown'),
        }

        # ATTACKER role-node — the finishing perspective (terminal on success).
        attacker_entry = {
            'name': sub_data['name'],
            'hub': slug,
            'role': 'attacker',
            'isTerminal': True,
            **meta,
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': att_role,
            # Canonical structured origin (unified with transitions).
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': att_role,
            'fromPositions': from_positions,
            'successRate': success_rate,
            'flashcards': attacker_flashcards,
        }
        if outcomes:
            attacker_entry['outcomes'] = outcomes

        # DEFENDER role-node — the defending perspective (same exchange role-flipped; not terminal).
        def_outcomes = _defender_outcomes(outcomes) if outcomes else []
        defender_entry = {
            'name': sub_data['name'],
            'hub': slug,
            'role': 'defender',
            **meta,
            'startingPosition': starting_position_slug,
            'startingPositionPath': starting_position_path,
            'startingPositionRole': def_role,
            'fromPosition': from_position_name,
            'fromPositionId': starting_position_slug,
            'fromRole': def_role,
            'fromPositions': from_positions,
            'successRate': _complement_rate(success_rate),
            'flashcards': defender_flashcards,
        }
        if def_outcomes:
            defender_entry['outcomes'] = def_outcomes

        # HUB — edgeless flashcard aggregator carrying the submission's identity metadata.
        submissions[slug] = {
            'name': sub_data['name'],
            'hub': slug,
            'role': 'hub',
            'isTerminal': True,
            **meta,
            'flashcards': dedupe_flashcards(attacker_flashcards + defender_flashcards),
        }
        submissions[f"{slug}/attacker"] = attacker_entry
        submissions[f"{slug}/defender"] = defender_entry

    # Build family-hub entries separately (keyed by family slug e.g. "americana").
    # Aggregates flashcards from all <family>-from-* variants. These are merged into
    # the submissions dict by the caller AFTER variant-level enrichment runs, so
    # downstream logic (successRate enrichment, outcome rewriting, ending rewriting)
    # continues to operate only on real variants.
    family_hubs: dict[str, dict] = {}
    hub_weight_stats: dict = {}
    for family_slug, meta in family_hub_metadata.items():
        prefix = f"{family_slug}-from-"
        # Aggregate from the variant HUB nodes only (skip the /attacker + /defender role-nodes,
        # whose keys also match the prefix) so flashcards aren't triple-counted.
        variant_decks = [
            variant for key, variant in submissions.items()
            if key.startswith(prefix) and variant.get('role') == 'hub'
        ]
        family_hubs[family_slug] = {
            **meta,
            'isFamily': True,
            'isTerminal': True,
            'flashcards': curate_hub_flashcards(variant_decks, stats=hub_weight_stats),
        }

    # Printed UNCONDITIONALLY, with both denominators. Guarding it on `family_hub_metadata`
    # reintroduced the defect one layer up: if the family-hub scan ever stopped matching, the
    # line vanished and the run looked exactly like a corpus with no families (CLAUDE.md 6.6).
    rated = hub_weight_stats.get('rated', 0)
    seen = hub_weight_stats.get('variants', 0)
    print(f"  Family-hub decks: {len(family_hub_metadata)} family hub(s); {rated} of {seen} "
          f"variant deck(s) carry a successRate weight "
          f"({seen - rated} equal-weighted at MIN_PER_VARIANT={MIN_PER_VARIANT})")
    if family_hub_metadata and not seen:
        _COVERAGE_FAILURES.append(
            ('family-hub decks',
             f"aggregated 0 variant decks across {len(family_hub_metadata)} family hub(s) — "
             f"the `{{family}}-from-` variant join matched nothing, so every family hub ships "
             f"an EMPTY deck"))

    _report_outcomes('submissions')
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
            _qa_full(qa)
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
    is curated affiliate data, passed through MINUS `affiliate_url` (see below).
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
            # NO AFFILIATE URL IN graph.json. Unlike every other emitted artifact, graph.json is
            # COMMITTED and lands in a PUBLIC repo (raw.githubusercontent serves it), and no
            # consumer reads the URL: renderPage.tsx uses len(products) only, trainingData.ts
            # ignores products entirely, and apply_affiliate_ref.py deliberately does not target
            # this file. So the URL here is dead weight that can only cause harm — today it
            # publishes a `?ref=REPLACE_ME` link that would earn nothing if anyone ever wired it
            # up, and stamping the real ref into a committed file would publish the revenue
            # identifier into git history forever, which is the exact failure the placeholder
            # design exists to prevent. `has_affiliate_url` keeps the fact without the payload.
            entry['products'] = [
                dict(
                    {k: v for k, v in p.items() if k != 'affiliate_url'},
                    has_affiliate_url=bool(p.get('affiliate_url')),
                ) if isinstance(p, dict) else p
                for p in products
            ]

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

    # Role-typed technique invariants (the hub + /attacker + /defender split):
    #   - every technique hub has exactly an /attacker and a /defender child (pairing),
    #   - the hub is edgeless (no outcomes),
    #   - attacker.successRate + defender.successRate ≈ 100 (perspective complement).
    role_violations: list[str] = []
    sr_compared = sr_absent = hub_count = 0
    for coll_name, coll in (('transitions', transitions), ('submissions', submissions)):
        for key, node in coll.items():
            if node.get('role') != 'hub':
                continue
            hub_count += 1
            att, dfn = coll.get(f"{key}/attacker"), coll.get(f"{key}/defender")
            if att is None or dfn is None:
                role_violations.append(f"{coll_name}:{key} missing role-node "
                                       f"(attacker={att is not None}, defender={dfn is not None})")
                continue
            if node.get('outcomes'):
                role_violations.append(f"{coll_name}:{key} hub is not edgeless (has outcomes)")
            # `(att.get('successRate', 0) or 0) + (dfn.get('successRate', 0) or 0)` read a
            # null pair as 0 + 0 and reported "successRate complement off (0)" — a FALSE
            # violation about a correctly-absent exchange, byte-identical to the string a
            # pair that simply LACKS the key produces, so the two causes were indistinguishable
            # in the log. Classify before any arithmetic touches the values.
            a_sr, d_sr = att.get('successRate'), dfn.get('successRate')
            if a_sr is None and d_sr is None:
                sr_absent += 1          # no exchange in any ruleset: nothing to complement
            elif a_sr is None or d_sr is None:
                role_violations.append(f"{coll_name}:{key} successRate present on ONE side only "
                                       f"(attacker={a_sr}, defender={d_sr})")
            else:
                sr_compared += 1
                if abs(a_sr + d_sr - 100) > 1.5:
                    role_violations.append(
                        f"{coll_name}:{key} successRate complement off ({a_sr + d_sr})")

    report = {
        'missing_positions': sorted(missing_positions),
        'orphan_positions': sorted(orphan_positions),
        'missing_count': len(missing_positions),
        'orphan_count': len(orphan_positions),
        'role_violations': role_violations,
        # How many complements were actually EXAMINED. The "Role-typed techniques: OK" line
        # below used to print unchanged on a run that compared zero pairs, so main() floors it.
        'sr_compared': sr_compared,
        'sr_absent': sr_absent,
        'hub_count': hub_count,
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

    if role_violations:
        print(f"  WARNING: {len(role_violations)} role-typed technique invariant violation(s)")
        for v in role_violations[:15]:
            print(f"    - {v}")
        if len(role_violations) > 15:
            print(f"    ... and {len(role_violations) - 15} more")
    else:
        print(f"  Role-typed techniques: OK ({sr_compared} of {hub_count} hub(s) complement-"
              f"checked, {sr_absent} absent in every ruleset; every hub paired with "
              f"/attacker + /defender, edgeless)")

    if not missing_positions and not orphan_positions:
        print("\n  Graph integrity: OK (no missing or orphan nodes)")

    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Vote rates are per-frame, so both the headline and its complement have to survive a null
# frame. Named functions rather than inline expressions because the SAME two operations are
# applied four times below and drifting one of them is invisible in the output.

def _rate_cell(x):
    """One frame of a voted rate, or None when that frame carries no vote at all.
    `round(None, 1)` is a TypeError — the block below died on the first null cell."""
    return None if x is None else round(x, 1)


def _rate_complement(x):
    """The defender's frame: the attacker's complement, or None when the frame is absent.
    Never 100 — that would hand the defender a full success rate in a ruleset where the
    exchange does not exist. (Same rule as _complement_rate, applied to voted rates.)"""
    return None if x is None else max(0, round(100 - x, 1))


def load_votes(project_root: Path) -> dict[str, dict]:
    """Load per-ruleset published rates from templates/votes.json — one prior-blended {gi,nogi} map
    per technique name (community votes folded with the calibrated prior). Missing file -> {}."""
    votes_file = project_root / 'templates' / 'votes.json'
    if not votes_file.exists():
        print("  Loaded 0 of 0 community vote rate(s) from votes.json (file absent)")
        return {}
    try:
        with open(votes_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        # A corrupt votes.json used to warn and return {}, and the caller's `if vote_rates:`
        # guard then swallowed the consequence: no override line printed, exit 0, and a graph
        # shipped with every published rate silently reverted to the authored one.
        print(f"Warning: Could not load votes.json: {e}")
        _PARSE_FAILURES.append((str(votes_file), str(e)))
        return {}

    raw = data.get('votes', {})
    rates = {
        name: _votes.folded_rates(_votes.migrate_entry(entry))
        for name, entry in raw.items()
        if 'community' in entry or 'success_rate' in entry
    }
    # Printed unconditionally, WITH its denominator, including the 0-of-0 case (CLAUDE.md
    # 6.6). Measured: with templates/votes.json replaced by `{"votes": {}}` this run printed
    # NEITHER "Loaded N …" NOR "Applied N …" — both lines were guarded — and still exited 0
    # having written a complete graph. A filter that matched nothing must not read the same
    # as a store that is genuinely empty, and neither may read the same as never looking.
    print(f"  Loaded {len(rates)} of {len(raw)} community vote rate(s) from votes.json")
    if raw and len(rates) * 2 < len(raw):
        _PARSE_FAILURES.append(
            (str(votes_file),
             f"only {len(rates)} of {len(raw)} vote entries matched the "
             f"{{community|success_rate}} shape"))
    return rates


def generate_state_graph(project_root: Path) -> dict:
    content_dir = project_root / 'content'
    print(f"Processing content from: {content_dir}")

    # Load community votes for success rate overrides
    vote_rates = load_votes(project_root)   # prints its own coverage, always

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

    # Override success rates with community votes (prior-blended, per {gi,nogi} frame).
    vote_overrides = 0
    rescaled = rescale_skipped = 0
    # The join's real coverage is how many of the LOADED NAMES were found, not how many role-
    # nodes were written: each matched name writes two nodes (attacker + defender), so a
    # node count against a name denominator prints the nonsense "2656 of 1614".
    voted_names_hit: set[str] = set()
    if vote_rates:
        # Role-aware: the attacker node carries the voted success rate; the defender node carries its
        # complement (defender success = attacker failure); the edgeless hub has no successRate.
        # graph.json keeps `successRate` SCALAR (no consumer churn this phase) by reducing to the
        # default no-gi frame; the full {gi,nogi} pair is preserved in `successRateByRuleset`.
        for coll in (transitions, submissions):
            for data in coll.values():
                role = data.get('role')
                if role not in ('attacker', 'defender'):
                    continue
                name = data.get('name', '')
                if name in vote_rates:
                    voted_names_hit.add(name)
                    rate = vote_rates[name]  # {gi, nogi}
                    # A null frame stays null on the attacker rate AND on the complement.
                    # Note the deliberate asymmetry, preserved from the original: the scalar
                    # headline complements the ALREADY-ROUNDED `att`, while each ByRuleset
                    # cell complements the raw rate — two different roundings that can differ
                    # in the last digit, so they are kept exactly as they were.
                    att = _rate_cell(rate['nogi'])  # default headline frame = no-gi
                    if role == 'attacker':
                        data['successRate'] = att
                        data['successRateByRuleset'] = {
                            "gi": _rate_cell(rate['gi']),
                            "nogi": _rate_cell(rate['nogi']),
                        }
                    else:  # defender carries the complement of the attacker's rate, per frame
                        data['successRate'] = _rate_complement(att)
                        data['successRateByRuleset'] = {
                            "gi": _rate_complement(rate['gi']),
                            "nogi": _rate_complement(rate['nogi']),
                        }
                    # Headline <-> breakdown coherence: rescale the outcome distribution so the
                    # success-result cells sum to the node's scalar successRate.
                    #
                    # The rescale runs on the FOLDED scalar rate and on scalar outcome
                    # probabilities, and either can be null once the technique layer forks:
                    # `int(round(None))` raises here, and one null probability cell raises
                    # inside _votes.rescale_dist_to_success at `sum(d['probability'] …)`.
                    # Skip and COUNT — a rescale that silently did not run is the same failure
                    # class as a check that never ran, so the count is printed either way.
                    outcomes = data.get('outcomes')
                    if outcomes and any(o.get('result') == 'success' for o in outcomes):
                        if data['successRate'] is None or any(
                                o.get('probability') is None for o in outcomes):
                            rescale_skipped += 1
                        else:
                            data['outcomes'] = _votes.rescale_dist_to_success(
                                outcomes, int(round(data['successRate']))
                            )
                            rescaled += 1
                    vote_overrides += 1
    print(f"  Applied {vote_overrides} community vote rate override(s) from "
          f"{len(voted_names_hit)} of {len(vote_rates)} loaded rate(s); "
          f"rescaled {rescaled} outcome distribution(s), skipped {rescale_skipped} "
          f"(rate or outcome absent in every frame)")
    if vote_rates and not voted_names_hit:
        # The name join is `data.get('name', '') in vote_rates` — a spelling-sensitive join
        # with no coverage of its own (CLAUDE.md 6.6, `_tech_keys`). If it ever stops matching,
        # every published rate silently reverts to the authored one and the run still exits 0
        # with a complete graph; "Applied 0" against a loaded 1614 is the only visible trace,
        # and a bare "Applied 0" is exactly what an empty vote store prints too. Hence the
        # denominator above and this floor.
        _COVERAGE_FAILURES.append(
            ('community vote overrides',
             f"matched 0 of {len(vote_rates)} loaded vote rate(s) — the technique-name join "
             f"matched nothing, so every published rate reverted to the authored one"))

    # Resolve position transition targets BY TYPE (type-aware disambiguation):
    #   position-specific variant > real submission > transition; NEVER an edgeless family hub.
    # Fixes same-name collisions where a generic name exists as both a transition (entry) and a
    # family-hub submission (grouping): the old membership-only check shadowed the entry transition
    # and bound position attempts to edgeless hubs (silent dead-ends). The isSubmission flag now
    # reflects the resolved target's actual type, and successRate is read from the matching node.
    # NOTE: at this point `submissions` holds REAL variants only (family hubs merge in later, ~:1129),
    # so `slug in submissions` == a real (non-hub) submission node.
    all_submission_slugs = set(submissions.keys()) | hub_slugs
    unresolved_targets = []

    def resolve_target(slug, leaf):
        """Return (resolved_slug, is_submission) for a position->technique target, by node type."""
        if not slug:
            return slug, False
        if '-from-' not in slug and leaf:
            sub_variant = f"{slug}-from-{leaf}"
            if sub_variant in submissions:
                return sub_variant, True
            if sub_variant in transitions:
                return sub_variant, False
        if slug in submissions:          # real submission (hubs not in `submissions` yet)
            return slug, True
        if slug in transitions:          # entry/movement transition
            return slug, False
        # Only a family hub (or nothing) matches — do NOT bind to the edgeless hub.
        unresolved_targets.append((slug, leaf))
        return slug, False

    resolved_count = 0
    sr_from_attacker = sr_from_hub = sr_defaulted = sr_null = 0
    for pos_data in positions.values():
        leaf = pos_data.get('hub', '')
        for t in pos_data.get('transitions', []):
            orig = t.get('target', '')
            resolved, is_sub = resolve_target(orig, leaf)
            t['target'] = resolved
            t['isSubmission'] = is_sub
            coll = submissions if is_sub else transitions
            node = coll.get(resolved, {})              # the (edgeless) hub node
            if resolved != orig and node.get('name'):
                t['targetPath'] = quartz_slug(node['name'])
            # successRate lives on the attacker role-node now (a position attempt = the attacker move)
            #
            # The `50` fires ONLY when neither the attacker role-node nor the hub carries the
            # key at all — it does not fire on an explicit null, because
            # {'successRate': None}.get('successRate', 50) is None. That is the intended
            # reading, not a bug to "fix": a technique whose rate exists in no frame must not
            # be handed a fabricated 50 here. But it means the default is not the safety net
            # it looks like, so which branch actually supplies each edge is counted rather
            # than assumed — today 2543 of 2543 come from the attacker node.
            att = coll.get(f"{resolved}/attacker", {})
            if 'successRate' in att:
                sr_from_attacker += 1
            elif 'successRate' in node:
                sr_from_hub += 1
            else:
                sr_defaulted += 1
            t['successRate'] = att.get('successRate', node.get('successRate', 50))
            if t['successRate'] is None:
                sr_null += 1
            resolved_count += 1
    print(f"  Resolved {resolved_count} position transition target(s) by type "
          f"(successRate: {sr_from_attacker} from /attacker, {sr_from_hub} from hub, "
          f"{sr_defaulted} defaulted to 50, {sr_null} null)")
    if sr_defaulted:
        # Measured cause, on the divergent-fork fixture: one dropped Transitions file left 2
        # position edges with no attacker node, and they were handed a FABRICATED 50 that
        # nothing else in the run reported. Buried among four numbers on the line above it
        # reads like bookkeeping, so it gets its own line the moment it is non-zero.
        print(f"  WARNING: {sr_defaulted} position edge(s) found NEITHER an /attacker node nor "
              f"a hub successRate and were handed a fabricated 50 — usually a technique file "
              f"that failed to load (see the parse errors above).")
    if sr_null:
        print(f"  INFO: {sr_null} position edge(s) carry successRate null (the technique's "
              f"rate exists in no ruleset frame) — deliberately NOT defaulted to 50.")
    if unresolved_targets:
        uniq = sorted({s for s, _ in unresolved_targets})
        print(f"  WARNING: {len(unresolved_targets)} position target(s) resolved to no real node "
              f"(edgeless hub or missing) — {len(uniq)} distinct: {', '.join(uniq[:15])}")

    # Opponent moves (the opposite position role's transitions, with resolved success outcomes)
    # are no longer baked here — they are derived at render time in renderPage.tsx
    # (resolveOpponentMoves) directly from the canonical role-split nodes. This keeps graph.json
    # free of the denormalized reverse-perspective mirror.

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
        # Kind-D guard: a slug that is BOTH a submission and a position (e.g. buggy-choke,
        # hindulotine) means "advance to that control position" here — don't mis-terminate it.
        is_position = base in positions or f"{base}/top" in positions or f"{base}/bottom" in positions
        if base in all_submission_slugs and not is_position:
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

    # Hard-fail on values that exist in NO ruleset frame, for the same reason and at the
    # same point as _PARSE_FAILURES: there is no honest scalar for them, and the fold that
    # used to invent one (`0 if headline is None else headline`) is exactly what made the
    # first 71-cell null pass invisible. Same --strict-sources escape hatch, so the owner
    # can still get a graph out while the content is being repaired.
    if _RULESET_FAILURES:
        print(f"\nERROR: {len(_RULESET_FAILURES)} value(s) exist in no ruleset frame "
              f"(neither gi nor no-gi):")
        for where, what in _RULESET_FAILURES[:40]:
            print(f"  - {where}: {what}")
        if len(_RULESET_FAILURES) > 40:
            print(f"  ... and {len(_RULESET_FAILURES) - 40} more")
        if args.strict_sources:
            print("\n  Refusing to write graph.json with values that exist in no ruleset. "
                  "(use --no-strict-sources / --lenient to override)")
            sys.exit(1)
        else:
            print("\n  --lenient: continuing; these values are emitted as null.")

    # Hard-fail on a JOIN OR CENSUS THAT MATCHED NOTHING. Every count this script prints is
    # only a claim about what it examined: "0 with no gi frame" out of "0 total" is the
    # never-looked answer wearing the found-nothing answer's clothes (CLAUDE.md 6.6). Each
    # entry here fired against a non-zero denominator, so it is a broken join, not a quiet
    # corpus. Same --strict-sources escape hatch as the two blocks above.
    if _COVERAGE_FAILURES:
        print(f"\nERROR: {len(_COVERAGE_FAILURES)} join/census produced ZERO coverage "
              f"against a non-zero denominator:")
        for where, what in _COVERAGE_FAILURES:
            print(f"  - {where}: {what}")
        if args.strict_sources:
            print("\n  Refusing to write graph.json from a pass that matched nothing. "
                  "(use --no-strict-sources / --lenient to override)")
            sys.exit(1)
        else:
            print("\n  --lenient: continuing with these passes having matched nothing.")

    # Validate graph integrity
    report = validate_graph(state_graph, verbose=args.verbose)

    # Zero-coverage floor on the complement check (CLAUDE.md 6.6): "Role-typed techniques:
    # OK" is printed by the same code path whether it examined 1628 hubs or none, so a loop
    # that stopped matching would read as a clean bill of health. Fail on a run that
    # produced hubs but compared nothing.
    if report['hub_count'] and not report['sr_compared']:
        print(f"\nERROR: successRate complement checked 0 of {report['hub_count']} hub(s) "
              f"— the check matched nothing, which is not the same as finding nothing.")
        sys.exit(1)

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
