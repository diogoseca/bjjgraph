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
from _ruleset import is_ruleset_map, present_rulesets  # the per-ruleset contract (calibration-v2)
from _ruleset import cell as _ruleset_cell             # one frame's value, or None where it does not exist
from _votes import migrate_entry, folded_rate  # published (folded-votes) rate for display (2.3)


# ---------------------------------------------------------------------------
# THE RENDER FRAME, AND WHAT A PAGE PRINTS WHEN A FRAME DOES NOT EXIST
#
# Every forked probability in content/ is a per-ruleset {"gi": n|null, "nogi": n|null}
# map (scripts/_ruleset.py). `null` means "this edge DOES NOT EXIST in that ruleset" —
# which is NOT 0; docs/Content.md is explicit that a frame may legitimately BE 0
# ("a gi-only technique legitimately scores 0 in the other frame"). So 0 and absent must
# render differently, and `or 0` is always the wrong repair: it re-animates an edge the
# content says is not there and turns a structural fact into a plausible number.
#
# Pages render the FOLDED NO-GI value (docs/Content.md, "How it renders") so page text,
# graph.json and the game agree. That is why _RENDER_FRAME is a named constant here and
# not a parameter: one frame, chosen once, in one place.
#
# THE TRAP THIS BLOCK CLOSES. reduce_to_scalar(doc, frame='nogi') collapses a null cell to
# a bare Python None, and this module's Jinja Environment has no finalize= and no
# undefined= — so `{{ p }}%` rendered the literal string `None%`, in body copy AND inside
# the schema.org JSON-LD blocks Google ingests (the block still PARSES, so no gate would
# have noticed). A bare None is also indistinguishable from "the key was missing" and one
# coercion away from "the value is 0". The fix is to frame to a SENTINEL that remembers
# which rulesets the value does exist in, and to route every render site through the `pct`
# / `attempt_note` filters below, neither of which can print "None".
# ---------------------------------------------------------------------------

_RENDER_FRAME = 'nogi'


class _Absent:
    """One ruleset frame of a forked probability that the content says does not exist.

    `present` is the rulesets that DO carry a value (from _ruleset.present_rulesets), so a
    page can name the ruleset a move belongs to instead of printing a number for one it is
    not part of.

    Deliberately unprintable: __str__ raises, so a template site that was never taught
    about absences fails LOUDLY — the file is skipped, and because skips are now fatal
    (see main()) the run exits non-zero naming it — instead of quietly shipping `None%` to
    every generated page. Every legal render path goes through `| pct` or `| attempt_note`.
    It is also unorderable on purpose: Python already refuses `_Absent() < 3`, which is what
    forces aggregate_submission_variants' sort to declare where absences file.
    """

    __slots__ = ('present',)

    def __init__(self, present):
        self.present = tuple(present)

    def __repr__(self):
        return f"_Absent(present={list(self.present)!r})"

    def __str__(self):
        raise TypeError(
            f"{self!r} was rendered without a ruleset-aware filter. A frame that does not "
            f"exist has no percentage: render it with `| pct` (or `| attempt_note` inside "
            f"the Positions JSON-LD), and drop the literal '%' that followed it."
        )


# Positive coverage counts, printed on EVERY run including the all-zero one, because
# "found no absences" and "the framing step never ran" must not print the same thing
# (CLAUDE.md 6.6). `maps` is the floor: process_all_categories fails the run at 0.
_FRAME_STATS = {'maps': 0, 'absent': 0}


def _frame_for_render(obj, frame=_RENDER_FRAME):
    """Collapse every {gi,nogi} map in a loaded document to ONE frame, for rendering.

    This is reduce_to_scalar(obj, frame=...) with exactly one deliberate difference: where
    that returns None for a null cell, this returns an `_Absent`.

    It is NOT a second copy of the contract (CLAUDE.md 6.5). Every semantic question — is
    this a ruleset map? what is this frame's cell? which frames exist? — is answered by
    scripts/_ruleset.py, still the single source. Only the walk is repeated, and it has to
    be, because the sentinel can only be minted AT the map: once reduce_to_scalar has handed
    back a None, the sibling frame is gone and "does not exist in no-gi" is no longer
    distinguishable from "this key was missing".

    The invariant that makes a null-free corpus render byte-identically: on a document with
    no null cells this returns exactly what reduce_to_scalar(obj, frame) returns.
    """
    if is_ruleset_map(obj):
        _FRAME_STATS['maps'] += 1
        c = _ruleset_cell(obj, frame)
        if c is not None:
            return c
        _FRAME_STATS['absent'] += 1
        return _Absent(present_rulesets([obj]))
    if isinstance(obj, dict):
        return {k: _frame_for_render(v, frame) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_frame_for_render(v, frame) for v in obj]
    return obj


def _absence_label(v):
    """The ONE spelling of an absent frame, so the corpus cannot grow two.

    "gi only" / "no-gi only" is docs/Content.md's own wording ("a gi-only or no-gi-only
    technique"). A map whose every cell is null is a content bug no schema catches, so it
    says so rather than picking a side.
    """
    present = tuple(v.present)
    if present == ('gi',):
        return 'gi only'
    if present == ('nogi',):
        return 'no-gi only'
    if not present:
        return 'not in either ruleset'
    return 'gi only'  # unreachable: a frame that is present cannot produce an _Absent


_PCT_STATS = {'numbers': 0, 'absences': 0}


def _pct(value, suffix='', prefix=''):
    """Render a per-ruleset probability: `62%`, or the absence marker when the render frame
    carries no value.

    `prefix`/`suffix` hold the words that only mean something around a NUMBER
    (`| pct(' of attempts')`, `| pct(' success')`, `| pct(' avg', '~')`) and are dropped on
    an absence, because "~gi only avg" is not a sentence. That is why the templates hand the
    surrounding words to the filter instead of writing them beside it.

    Byte-identical to the `{{ v }}%` it replaced on every numeric value: probabilities are
    schema-constrained integers and _display_rate int(round())s the published value, so
    there is no 50-vs-50.0 drift.

    Raises on None / a Jinja Undefined ON PURPOSE. That is the MISSING case, not the
    absent-by-contract case, and it used to render as a bare `%` — a page that had never
    looked and a page that found nothing printed the same thing (CLAUDE.md 6.6).
    """
    if isinstance(value, _Absent):
        _PCT_STATS['absences'] += 1
        return _absence_label(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        _PCT_STATS['numbers'] += 1
        return f"{prefix}{value}%{suffix}"
    raise TypeError(
        f"pct: expected a number or an absent ruleset frame, got {value!r}. A probability "
        f"that is missing (rather than null-by-contract) is a content or template bug; it "
        f"must not render as a bare '%'."
    )


def _attempt_note(value):
    """The HowTo step sentence in the Positions JSON-LD (TEMPLATE-TOP / -BOTTOM / -SINGLE).

    The step is KEPT when the frame is absent, deliberately: a gi-only attack is still a
    legitimate step in "How to Attack from Mount", and dropping steps out of a hand-written
    JSON array would mean fixing up its trailing commas as well. Only the percentage clause
    changes, so the block still parses and stops asserting a no-gi frequency for a move with
    no no-gi existence.

    One filter, three call sites: TOP and BOTTOM are a known copy pair and SINGLE is a third
    copy of the same line, and "same defect, missed once" is how this repo loses an evening.
    """
    if isinstance(value, _Absent):
        _PCT_STATS['absences'] += 1
        present = tuple(value.present)
        if present == ('gi',):
            return "This technique exists in the gi ruleset only; it does not occur in no-gi."
        if present == ('nogi',):
            return "This technique exists in the no-gi ruleset only."
        return "This technique has no recorded attempt frequency in either ruleset."
    return _pct(value, prefix="This technique is attempted in ",
                suffix=" of exchanges from this position.")


def _is_absent(value):
    """Jinja test: `{% if success_rate is absent %}`. For the handful of sites where the
    words AROUND the number have to disappear too (the meta-chips), not just the number."""
    return isinstance(value, _Absent)


# The ruleset the pages are rendered in, spelled the way a reader says it. Derived from
# _RENDER_FRAME so the four outcome tables cannot drift from the one constant that decides
# which frame they show.
_RENDER_RULESET_LABEL = {'gi': 'gi', 'nogi': 'no-gi'}[_RENDER_FRAME]


def _outcomes_absence_note(outcomes):
    """The footnote under an outcomes table, or '' when every outcome exists in this frame.

    ONE filter for what used to be four byte-identical hand-written sentences, so the copy
    pair problem cannot start here (CLAUDE.md 6.5).

    IT PRINTS A MEASURED TOTAL, NOT AN ASSERTED ONE. The sentence it replaced read "the rows
    that do exist still sum to 100" — an arithmetic claim the renderer never checked, sitting
    directly under the table that refutes it. Measured on a fixture with one outcome cell
    nulled and the siblings left as authored: the visible rows summed to 50 and the page
    asserted 100. The per-frame sum-to-100 rule is real, but it is enforced by
    validate_graph_integrity UPSTREAM of this script, and a claim whose checker lives in
    another process is exactly the "plausible number nobody recomputed" class (CLAUDE.md 6.9).
    So the note carries the number it actually added up: if the content is renormalised the
    reader sees 100%, and if it is not, the reader sees the truth instead of a contradiction.
    """
    absent = [o for o in outcomes if isinstance(o.get('probability'), _Absent)]
    if not absent:
        return ''
    shown = [o.get('probability') for o in outcomes
             if isinstance(o.get('probability'), (int, float))
             and not isinstance(o.get('probability'), bool)]
    head = (f"One of these outcomes does not exist in {_RENDER_RULESET_LABEL} and carries"
            if len(absent) == 1 else
            f"{len(absent)} of these outcomes do not exist in {_RENDER_RULESET_LABEL} and carry")
    return f"_{head} no probability here. The outcomes that do exist total {sum(shown)}%._"


_VOTE_RATES_CACHE = None


_VOTE_STATS = {'entries': 0, 'hits': 0, 'misses': 0, 'no_frame_rate': 0,
               'absent_skipped': 0, 'no_rate_field': 0}


def _display_rate(name, fallback):
    """The PUBLISHED success rate to render in the technique text: the folded-votes value (calibrated
    prior blended with community votes) at the no-gi default frame — the SAME source graph.json uses,
    so the page text and the graph/game agree. Falls back to the content value when a technique has no
    votes entry (e.g. family hubs, which are aggregate).

    THE CACHE IS BUILT INTO A LOCAL AND PUBLISHED ONLY WHEN THE LOOP FINISHES. It used to fill the
    module global IN PLACE, and the enclosing except caught only (JSONDecodeError, OSError) — so a
    votes entry with no rate in this frame (folded_rate returns None; int(round(None)) is a TypeError)
    would abort the loop and leave a HALF-BUILT cache behind that every later lookup then read as
    authoritative. A partial join that still prints plausible numbers is the failure this repo keeps
    re-finding (CLAUDE.md 6.6), so: build locally, publish once, catch the TypeError too, and PRINT
    what was swallowed rather than silently returning an empty dict.

    A cached None means "this technique has no published no-gi rate", not "0" — it falls through to
    the caller's content value like a cache miss does.
    """
    global _VOTE_RATES_CACHE
    if isinstance(fallback, _Absent):
        # The caller must SKIP the votes override entirely when the content says the frame does not
        # exist. Substituting a published number here would mask the absence with a confident
        # percentage — the single worst outcome available at this seam.
        raise TypeError(
            "_display_rate: refusing to publish a rate for a ruleset frame the content marks absent "
            f"({name!r}); the caller must skip the override and render the absence."
        )
    if _VOTE_RATES_CACHE is None:
        built = {}
        vf = Path(__file__).resolve().parent.parent / 'templates' / 'votes.json'
        try:
            with open(vf, encoding='utf-8') as f:
                vd = json.load(f)
            for n, entry in vd.get('votes', {}).items():
                fr = folded_rate(migrate_entry(entry), _RENDER_FRAME)
                if fr is None:
                    _VOTE_STATS['no_frame_rate'] += 1
                    built[n] = None
                else:
                    built[n] = int(round(fr))
        except (json.JSONDecodeError, OSError, TypeError, KeyError) as e:
            print(f"⚠️  votes.json unusable ({type(e).__name__}: {e}) — every page will render its "
                  f"authored content rate instead of the published one")
            built = {}
        _VOTE_RATES_CACHE = built
        _VOTE_STATS['entries'] = len(built)
    r = _VOTE_RATES_CACHE.get(name)
    if r is None:
        _VOTE_STATS['misses'] += 1
        return fallback
    _VOTE_STATS['hits'] += 1
    return r

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

# The ruleset-aware render surface. `_JINJA_ENV.from_string` in load_template() is the ONLY
# place a template is constructed in this file, so registering here covers all 13 templates
# and nothing else — no leaks, no second environment to keep in sync. This is what makes
# "None% cannot reach a .md" enforceable rather than a promise: `pct` and `attempt_note`
# raise on anything that is neither a number nor a declared absence.
_JINJA_ENV.filters["pct"] = _pct
_JINJA_ENV.filters["attempt_note"] = _attempt_note
_JINJA_ENV.filters["outcomes_absence_note"] = _outcomes_absence_note
_JINJA_ENV.tests["absent"] = _is_absent


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


def load_raw_json_file(json_path):
    """Load and parse a JSON file EXACTLY as authored — {gi,nogi} maps still maps.

    This is the shape the schemas in templates/ describe, so it is the shape
    jsonschema.validate() has to be handed (see process_json_file). Framing happens strictly
    AFTER validation; a framed document is not what any schema here documents.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file contains invalid JSON.
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {json_path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {json_path}: {e}")


def load_json_file(json_path):
    """Load a JSON file and collapse every {gi,nogi} map to the render frame.

    Divergent maps render the value the graph/game use; a frame that does not exist becomes
    an _Absent rather than a bare None (see _frame_for_render).
    """
    return _frame_for_render(load_raw_json_file(json_path))


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


# Every hub->variant join counts itself. A variant ref that resolves to no file used to
# print one line and vanish from the hub's table, and the run still reported success — the
# "a matcher that matched nothing reads as clean" shape (CLAUDE.md 6.6). These are printed
# every run, resolved AND unresolved, so the pair is falsifiable.
#
# UNGUARDED, DELIBERATELY: there is no floor on `missing`. Measured on the corpus at the
# time of writing, `--all` reports 340 resolved / 26 unresolved (11 hubs, led by Spinning
# Armbar and Bicep Slicer with 4 and 3) — variations[] entries whose variant file was never
# authored. A hard fail would therefore be red on day one and get switched off, which is
# worse than a printed pair somebody can diff. Re-derive before quoting:
#   npm run regenerate:md 2>&1 | grep -c 'variant file not found'
# `found` is the half that would go to zero if find_variant_file ever broke, and the pair
# makes that visible without a gate that cries wolf.
_VARIANT_STATS = {'found': 0, 'missing': 0, 'errors': 0}


def aggregate_family_variants(data, json_path):
    """Aggregate variant data for FAMILY positions"""
    variants_comparison = []
    position_name = json_path.stem
    variant_folder = json_path.parent / position_name

    for variant_ref in data.get('variations', []):
        variant_slug = variant_ref['slug']
        variant_file = find_variant_file(variant_folder, variant_slug)

        if not variant_file:
            _VARIANT_STATS['missing'] += 1
            print(f"⚠️  Variant file not found for slug '{variant_slug}' in {variant_folder}")
            print(f"   Skipping {variant_ref['name']} in comparison tables")
            continue

        try:
            variant_data = load_json_file(variant_file)
            _VARIANT_STATS['found'] += 1

            variants_comparison.append({
                'name': variant_data.get('name', variant_ref['name']),
                'bottom_risk': variant_data['bottom']['state_properties']['risk_level'],
                'top_risk': variant_data['top']['state_properties']['risk_level'],
                'bottom_energy': variant_data['bottom']['state_properties']['energy_cost'],
                'top_energy': variant_data['top']['state_properties']['energy_cost'],
                'uniqueness': variant_data.get('variant_uniqueness', '')
            })
        except Exception as e:
            _VARIANT_STATS['errors'] += 1
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
            _VARIANT_STATS['missing'] += 1
            print(f"⚠️  Submission variant file not found for slug '{variant_slug}' in {variant_folder}")
            continue

        try:
            variant_data = load_json_file(variant_file)
            _VARIANT_STATS['found'] += 1
            top_risk = ""
            if 'safety_considerations' in variant_data:
                risks = variant_data['safety_considerations'].get('injury_risks', [])
                top_risk = risks[0]['injury'] if risks else ""

            from_pos = variant_data.get('from_position', '')
            # No `, 0` default any more: 0 is a real authored rate here (docs/Content.md says a
            # frame may legitimately be 0), so it must not double as "the field was missing".
            sr = variant_data['success_rate']
            variants_comparison.append({
                'variant_name': variant_ref['name'],
                'from_position': from_pos,
                # Seat the attacker plays from (Top/Bottom), parsed from "Position/Role".
                'seat': from_pos.split('/')[1] if '/' in from_pos else '',
                # Whether this variant generates Attacker/Defender role pages, so the
                # hub variants table only emits Play-as links where targets exist.
                'is_dual': 'attacker' in variant_data and 'defender' in variant_data,
                # The votes override is SKIPPED when the content marks this frame absent.
                # _display_rate would otherwise hand back a confident published percentage for a
                # finish the content says does not exist in this ruleset — the null MASKED rather
                # than shown, which is worse than either honest answer.
                'success_rate': sr if isinstance(sr, _Absent) else _display_rate(variant_ref['name'], sr),
                'top_risk': top_risk,
                'uniqueness': variant_data.get('variant_uniqueness', ''),
            })
        except Exception as e:
            _VARIANT_STATS['errors'] += 1
            print(f"⚠️  Error loading submission variant {variant_file}: {e}")
            continue

    # Highest-percentage / most-canonical variants first, with ABSENCES FILED LAST. An
    # _Absent is deliberately unorderable against an int (TypeError), so this sort has to
    # declare where absences go instead of dying on the first nulled variant. `or 0` would be
    # the wrong repair: it ranks a gi-only finish below a genuine 1% no-gi finish as if both
    # existed in this ruleset.
    #
    # Ties still fall back to SOURCE ORDER. Python's sort is stable and an ascending `-rate`
    # key keeps equal elements in their original order exactly as the old `reverse=True` did,
    # so this reorders nothing today. 146 rows across 25 family hubs tie on the published rate,
    # so the content tiebreak CLAUDE.md 6.6 asks for would move real shipped pages — it belongs
    # in its own commit, not in a null-safety one.
    variants_comparison.sort(
        key=lambda v: (isinstance(v['success_rate'], _Absent),
                       0 if isinstance(v['success_rate'], _Absent) else -v['success_rate']))

    return variants_comparison


def load_schema(category, json_path=None, data=None):
    """Load JSON schema for a category from templates/.

    Uses the same schema files as validate_json.py. Detects template type
    (SINGLE/DUAL/FAMILY) from JSON structure for all categories.

    Args:
        category: Category name (e.g., "Positions", "Transitions").
        json_path: Path to the JSON file (required for Positions to detect type).
        data: The already-loaded document, so the type detectors do not re-read and
            re-frame the file behind the caller's back (which double-counted every
            {gi,nogi} map in _FRAME_STATS and made the coverage figure a lie).

    Returns:
        Parsed JSON schema dict.

    Raises:
        FileNotFoundError: If the schema file does not exist.
        ValueError: If the schema contains invalid JSON.
    """
    if category == "Positions":
        template_type = detect_position_template_type(json_path, data)
        schema_path = Path(f"templates/Positions/TEMPLATE-{template_type}.json")
    elif category in ("Transitions", "Submissions"):
        template_type = detect_transition_template_type(json_path, data)
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

    # VALIDATE THE RAW DOCUMENT, THEN FRAME IT — never the other way round.
    #
    # This used to frame first and validate the FRAMED result, which only worked while every
    # cell was non-null. Frame {"gi": 6, "nogi": null} and you get an absence where the
    # schema's oneOf offers `integer` or the {gi,nogi} object, so the file is rejected for
    # doing exactly what the ruleset contract permits. Measured on a nulled tree: 43 files
    # skipped across 32 positions, every one keeping its previous .md on disk, and the run
    # still exited 0 because failures were only fatal under an opt-in --strict that
    # `npm run regenerate:md` never passed. That pair made the whole null layer a silent
    # no-op inside the mandatory pre-commit chain.
    #
    # Validating raw is equivalent-or-stronger, never weaker: every shape the framed check
    # rejected the raw check rejects too (a missing frame key fails `required: [gi, nogi]`,
    # an out-of-range cell fails its own minimum/maximum), and it is what
    # scripts/validate_json.py has always done.
    raw = load_raw_json_file(json_path)
    schema = load_schema(category, json_path, raw)
    try:
        jsonschema.validate(instance=raw, schema=schema)
    except jsonschema.ValidationError as e:
        raise ValueError(
            f"Schema validation failed for {json_path}: {e.message} "
            f"at path {'.'.join(str(p) for p in e.absolute_path)}"
        )

    data = _frame_for_render(raw)

    # Handle Transitions and Submissions with attacker/defender structure
    if category in ("Transitions", "Submissions"):
        # Display the PUBLISHED (folded-votes, calibrated) success rate — same source as graph.json —
        # so the page text agrees with the graph/game. Content stays as authored; votes is the source.
        sr = data.get('success_rate')
        if isinstance(sr, _Absent):
            # The isinstance() test below would have skipped this anyway — but silently, and
            # for the wrong reason (None is not an int), which is how a skip path becomes
            # indistinguishable from a clean pass. Count it and print it (CLAUDE.md 6.6).
            _VOTE_STATS['absent_skipped'] += 1
        elif isinstance(sr, (int, float)):
            data['success_rate'] = _display_rate(data.get('name', ''), sr)
        elif sr is None:
            _VOTE_STATS['no_rate_field'] += 1
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


# The role pages a hub JSON owns. Scoped to these four names on purpose: a position's
# subfolder ALSO holds its variants' own pages, and listing those as stale would over-report.
_ROLE_PAGES = ('Bottom.md', 'Top.md', 'Attacker.md', 'Defender.md')

_STALE_STATS = {'pages': 0, 'files': 0}


def _stale_pages_for(json_path):
    """The .md pages a SKIPPED json leaves behind — unchanged on disk, and now lying.

    A skipped file used to print one ⚠ line and nothing else. Naming the pages is the whole
    difference between "a file failed" and "these published pages no longer match their
    source", which is what a reader of the log actually needs to decide whether to ship.
    """
    pages = []
    hub = json_path.with_suffix('.md')
    if hub.exists():
        pages.append(hub)
    role_dir = json_path.parent / json_path.stem
    for role in _ROLE_PAGES:
        if (role_dir / role).exists():
            pages.append(role_dir / role)
    return pages


def _print_render_coverage(scope, framed_here=None):
    """Positive coverage counts for every join and skip path this run took.

    Printed on EVERY run, including the all-zero one, because "found no absences" and "the
    framing step never ran" must not produce the same output — the single most repeated
    defect class in this repo (CLAUDE.md 6.6). process_all_categories turns the first line
    into a hard floor.
    """
    maps = _FRAME_STATS['maps'] if framed_here is None else framed_here
    print(f"\ncoverage [{scope}]:")
    print(f"  {{gi,nogi}} maps framed to {_RENDER_FRAME}: {maps}"
          f" (family aggregators re-read their variants, so this counts reads, not cells)")
    print(f"  frames absent in {_RENDER_FRAME}: {_FRAME_STATS['absent']}"
          f" -> rendered as a marker, never as a number")
    print(f"  probabilities rendered: {_PCT_STATS['numbers']} numeric / {_PCT_STATS['absences']} absent")
    if _VOTE_RATES_CACHE is None:
        # THE SKIP PATH PRINTS. A Positions-only run never asks for a published rate, so the
        # cache is never built and the line below would read "0 hit / 0 miss over 0 entries"
        # — which is what a BROKEN join prints too (CLAUDE.md 6.6).
        print("  votes join: not consulted — this run rendered no technique success rates")
    else:
        print(f"  votes join: {_VOTE_STATS['hits']} hit / {_VOTE_STATS['misses']} miss"
              f" over {_VOTE_STATS['entries']} entries"
              f" ({_VOTE_STATS['no_frame_rate']} carry no {_RENDER_FRAME} rate)")
    print(f"  votes override skipped, content frame absent: {_VOTE_STATS['absent_skipped']}"
          f"; no success_rate field: {_VOTE_STATS['no_rate_field']}")
    print(f"  family variant refs: {_VARIANT_STATS['found']} resolved"
          f" / {_VARIANT_STATS['missing']} unresolved / {_VARIANT_STATS['errors']} errored")
    print(f"  stale pages left by skipped files: {_STALE_STATS['pages']}"
          f" across {_STALE_STATS['files']} file(s)")


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

    # DEDUPE. `**/*.json` already matches the variant subdirectories, so the two lists
    # overlapped: 136 root + 54 variants was printed as "190 files" and rendered all 54
    # variants TWICE. The writes are idempotent so no page was ever wrong — but the printed
    # number is a coverage claim that was wrong by 54, and every counter below would have
    # inherited the same double count. Both globs stay because they document the intent.
    json_files = sorted(set(root_json_files) | set(variant_json_files))
    overlap = len(root_json_files) + len(variant_json_files) - len(json_files)

    if not json_files:
        print(f"No JSON files found in {category_path}")
        return []

    print(f"\nProcessing {len(json_files)} distinct files in {category} "
          f"({len(root_json_files)} from **/*.json, {len(variant_json_files)} variant paths, "
          f"{overlap} matched by both)...")

    resolve_fn = build_wikilink_resolver()

    framed_before = _FRAME_STATS['maps']
    processed = 0
    failures = []
    for json_file in json_files:
        try:
            generated_files = process_json_file(json_file, dry_run, resolve_fn=resolve_fn)
            processed += 1
            if len(generated_files) > 1:
                print(f"  → Generated {len(generated_files)} files")
        except Exception as e:
            failures.append((str(json_file), str(e)))
            print(f"⚠ SKIPPED {json_file}: {e}")
            # Name what is now stale. The skip itself is not the damage; the previously
            # generated pages surviving unchanged, and shipping, is.
            stale = _stale_pages_for(Path(json_file))
            if stale:
                _STALE_STATS['files'] += 1
                _STALE_STATS['pages'] += len(stale)
                print(f"  ↳ STALE, not rewritten: " + ", ".join(str(s) for s in stale))

    framed_here = _FRAME_STATS['maps'] - framed_before

    print(f"\n✓ Processed {processed}/{len(json_files)} files in {category}")

    if failures:
        print(f"✗ {len(failures)} file(s) failed in {category}:")
        for file_path, error_msg in failures:
            print(f"  - {file_path}: {error_msg}")

    # Per-category coverage FLOOR. These three categories are exactly the ones whose schemas
    # carry {gi,nogi} maps, so zero framed maps means the framing step did not run at all —
    # which would otherwise read identically to "the corpus has no forked probabilities".
    if category in ("Positions", "Transitions", "Submissions") and processed and framed_here == 0:
        msg = (f"coverage floor: 0 {{gi,nogi}} maps framed across {len(json_files)} "
               f"{category} files — the per-ruleset layer did not run")
        print(f"✗ {msg}")
        failures.append((f"<{category} coverage floor>", msg))

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

    print(f"\n{'='*60}")
    _print_render_coverage("all categories")

    if _FRAME_STATS['maps'] == 0:
        msg = ("coverage floor: not one {gi,nogi} map was framed in the entire corpus — "
               "either the framing step did not run or content/ lost its per-ruleset "
               "probabilities. Refusing to report success")
        print(f"✗ {msg}")
        all_failures.append(("<corpus coverage floor>", msg))

    # The SECOND floor, on the render surface rather than the load surface. The first one
    # only proves the documents were framed; it stays green if every `| pct` were deleted
    # from the templates and the percentages went back to being interpolated raw — which is
    # the exact regression this pass exists to prevent, and the one a future template edit
    # is most likely to reintroduce. There is deliberately NO floor on the absence counters:
    # 0 absences is the correct answer on today's corpus, so a floor there would be a
    # permanently red gate rather than a check (CLAUDE.md 6.9).
    if _PCT_STATS['numbers'] == 0:
        msg = ("coverage floor: not one probability was rendered through `| pct` in the "
               "entire corpus — the ruleset-aware render surface is not wired to the "
               "templates. Refusing to report success")
        print(f"✗ {msg}")
        all_failures.append(("<render coverage floor>", msg))

    # THE SWALLOW CHECK. Absences were minted at load and NONE of them reached a render
    # filter — so somewhere between the two a null was quietly turned back into a number or
    # dropped from a table, which is the failure this whole pass exists to prevent and the
    # one that leaves no other trace (CLAUDE.md 6.6).
    #
    # Why this is sound rather than a guess: every {gi,nogi} map in content/ lives in exactly
    # four field paths, and ALL FOUR are rendered by the templates —
    #   outcomes[].probability (4150) · success_rate (1391) ·
    #   top.transitions[].attempt_probability (1310) · bottom.transitions[].attempt_probability (1233)
    # Re-derive that set before trusting this check; if a fifth, UNRENDERED forked field is
    # ever authored, this turns into a false red and the fix is to scope it, not delete it:
    #   python3 - <<'EOF'
    #   import json, glob, sys; sys.path.insert(0, 'scripts')
    #   from _ruleset import is_ruleset_map
    #   from collections import Counter
    #   c = Counter()
    #   def walk(o, path):
    #       if is_ruleset_map(o): c[path] += 1; return
    #       if isinstance(o, dict):
    #           for k, v in o.items(): walk(v, f"{path}.{k}" if path else k)
    #       elif isinstance(o, list):
    #           for v in o: walk(v, path + "[]")
    #   for f in glob.glob('content/**/*.json', recursive=True): walk(json.load(open(f)), '')
    #   print(c.most_common())
    #   EOF
    #
    # PARTIALLY PINNED, and MEASURED as such: this catches a swallow only when EVERY absence
    # in the run was swallowed. Mutant, on the 71-null fixture — delete the `absences` counter
    # inside `_pct` but leave `_attempt_note`'s: the count fell 115 -> 36 and the run still
    # exited 0. It goes red only when both are gone (0 of 92). So a seam that drops SOME
    # absences and renders others (a votes override re-masking one family hub, say) gets past
    # it; the printed absent/absences pair is the only signal there, and reading it is a
    # human's job.
    if _FRAME_STATS['absent'] and _PCT_STATS['absences'] == 0:
        msg = (f"coverage floor: {_FRAME_STATS['absent']} ruleset frame(s) were loaded as "
               f"ABSENT but not one reached `pct`/`attempt_note`/`outcomes_absence_note` — "
               f"a null was swallowed between load and render. Refusing to report success")
        print(f"✗ {msg}")
        all_failures.append(("<absence render floor>", msg))

    if all_failures:
        print(f"\n{'='*60}")
        print(f"⚠ TOTAL: {len(all_failures)} file(s) failed across all categories:")
        for file_path, error_msg in all_failures:
            print(f"  - {file_path}: {error_msg}")
        if _STALE_STATS['pages']:
            print(f"⚠ {_STALE_STATS['pages']} generated page(s) are STALE — they were not "
                  f"rewritten and still carry their previous content. Do not ship this build.")
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
    # FAILURES ARE FATAL BY DEFAULT SINCE THE NULL LAYER LANDED.
    #
    # --strict used to be opt-in and `npm run regenerate:md` did not pass it, so a file that
    # failed schema validation kept its previous .md on disk and the whole
    # regenerate -> regenerate:build chain still reported success. A stale published page
    # that nobody is told about is worse than a red build, and this script sits inside the
    # mandatory pre-commit chain. --strict is still accepted so nothing that passes it
    # breaks; --allow-failures is the escape hatch, for exploratory runs only.
    parser.add_argument('--strict', action='store_true',
                        help='(deprecated: now the default) exit non-zero if any files fail')
    parser.add_argument('--allow-failures', action='store_true',
                        help='exit 0 even when files were skipped — exploratory runs only, '
                             'never in the regenerate chain')

    args = parser.parse_args()

    if not (args.file or (args.category and args.all) or args.all):
        parser.error("Must specify --file, --category with --all, or just --all")

    failures = []
    if args.file:
        process_json_file(args.file, args.dry_run)
        # The bot workflows regenerate one file at a time; without this they would be the only
        # entry point whose skip paths never print (CLAUDE.md 6.6).
        _print_render_coverage(str(args.file))
    elif args.category and args.all:
        failures = process_category(args.category, args.dry_run)
        # Every entry point prints its coverage. --category is the one a human types by hand
        # while debugging a single category, i.e. exactly when "nothing was reported" must
        # not be readable as "nothing was wrong" (CLAUDE.md 6.6).
        _print_render_coverage(f"category {args.category}")
    elif args.all:
        failures = process_all_categories(args.dry_run)

    if failures and not args.allow_failures:
        print(f"\n✗ {len(failures)} file(s) failed — exiting 1. Pass --allow-failures to "
              f"ignore (it will leave stale pages on disk).")
        sys.exit(1)


if __name__ == "__main__":
    main()
