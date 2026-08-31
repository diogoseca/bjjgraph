#!/usr/bin/env python3
"""check_systems_payload.py — prove source/quartz/static/neural/systems.json can carry the
Systems library and the graph highlight without lying to the app or to a paying customer.

Why this exists: systems.json is the ONLY place the Neural app (100% of default traffic) learns
that the 47 expert Systems exist, which graph nodes each one teaches, and which BJJFanatics
course to link. Two of those three are silent-failure shaped:
  * a `nodes` id that graph-data.json does not contain highlights NOTHING — the feature looks
    broken only to the user, never to the build;
  * a resolution regression (an index or alias change) degrades membership quietly, so the
    counts here are RATCHETS measured against the real numbers, not round guesses.
The third is worse than silent: a placeholder affiliate URL that ships once the AFFILIATE_REF
plumbing is live earns nothing and sends a customer to a broken promise.

Asserts:
  1. systems.json (and graph-data.json) exist and parse;
  2. one entry per content/Systems/*.json, ids unique + sorted + matching the built page path;
  3. every field the contract fixes is present and typed, summary <= 240 chars;
  4. every `nodes` id exists in graph-data.json;
  5. every system resolves >= 1 node (except KNOWN_EMPTY, empty today — see below);
  6. total unresolved <= UNRESOLVED_CEILING and total member nodes >= MIN_MEMBER_NODES;
  7. _meta counts agree with the arrays (catches a stale or hand-edited payload);
  8. product entries carry a real https URL, and no url contains "REPLACE_ME" once
     AFFILIATE_REF is set (while it is unset the placeholder is expected and only reported);
  9. THE ANCHORING INVARIANT — every node a FAMILY-EXPANDED ref contributed is anchored: its
     from-position is itself a position member of that system. See ANCHORING below;
 10. THE READABLE BODY — every System (and every concept sharing that chunk space) has a dossier
     chunk at the address the app computes from its `key`, and that chunk carries authored prose.
     See BODIES below.

ORDERING: check 8 assumes the ref has already been stamped, so in a pipeline that sets
AFFILIATE_REF this gate must run AFTER scripts/apply_affiliate_ref.py, not before it.

Usage:  python3 scripts/check_systems_payload.py
Exit:   0 = payload safe to ship, 1 = it would ship a dead highlight or a dead link.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from regenerate_graph import quartz_slug  # same page-path transform the emitter uses
from _neural_content import fnv1a32          # the chunk address's OWN constructor, never a copy

SYSTEMS_DIR = PROJECT_ROOT / "content" / "Systems"
PAYLOAD = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "systems.json"
GRAPH_DATA = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "graph-data.json"
CONCEPTS = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "concepts.json"
CHUNKS = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "content"

SUMMARY_CAP = 240  # contract cap; keep in sync with regenerate_neural_data.SUMMARY_CAP

# ── ANCHORING ─────────────────────────────────────────────────────────────────────────────────
# "In this system" means: the moves this system teaches, from the places this system teaches them.
#
# A related_content ref naming a submission FAMILY ("Calf Slicer") has no node of its own — a
# family hub is a flashcard aggregator, and 0 of 297 submission families appear in
# globalGraphLayout.json. So the emitter expands the name to the family's real "from X" finishes.
# Unfiltered, that expansion was 909 of 1711 member nodes (53%) across 109 refs: the 10th Planet
# No-Gi Guard System lit ALL ELEVEN calf slicers — from 50-50, Carni, Honey Hole, Rodeo Ride,
# Saddle … — when the two it actually teaches are from Truck and from Twister Control. The owner's
# words: one calf slicer "being applied from every fucking place".
#
# THE RULE (regenerate_neural_data._anchor_family, the single implementation both the side panel
# and the graph highlight read through): a family-expanded instance belongs to a system only if
# the system also teaches the position it is thrown from. An EXPLICITLY authored instance
# ("Kimura from Half Guard") is the author naming one exact node and is never filtered.
#
# This check is the ratchet on that rule. `fam` on a glue entry marks a ref the emitter expanded,
# so the gate reads expansion from the payload rather than inferring it from a node count — a ref
# that anchors down to one node is otherwise indistinguishable from an explicit ref.
#
# Measured 2026-08-31: family refs offered 952 candidate instances; anchoring ships 274 of them.
# Recompute both numbers with:
#   python3 -c "import json;S=json.load(open('source/quartz/static/neural/systems.json'))['systems'];\
#   f=[g for s in S for g in s['glue'] if g.get('fam')];print(len(f),sum(len(s['unanchored']) for s in S))"
FAM_REF_FLOOR = 70          # family-expanded refs the gate must actually SEE (measured 97).
                            # Zero here means the matcher matched nothing, which is not a pass.
UNANCHORED_CEILING = 31     # refs naming a family whose every instance comes from a position the
                            # system does not teach. Reported per system in `unanchored`, never
                            # expanded and never silently dropped. Each one is a CONTENT gap:
                            # lowering this means an author added the missing entry position.
                            # Known today: Craig Jones "Inside Heel Hook" (the system teaches
                            # Saddle, the finishes are authored from Honey Hole / Inside Sankaku /
                            # Ushiro Ashi Garami — separate position nodes here, same position to
                            # most readers), and Submission Clinic "Omoplata" (it teaches no guard
                            # any omoplata is authored from).

# Measured 2026-08-09 (47 systems, 818 graph-typed related_content refs): every system resolves
# at least one node, so this allow-list is EMPTY on purpose. An entry here means a System whose
# related_content points at nothing the graph renders — justify it in a comment or fix the content.
KNOWN_EMPTY: frozenset[str] = frozenset()

# Measured: 3 unresolved refs, all "Achilles Lock" — content/Submissions/Achilles Lock.json is an
# edgeless stub (no role, no outcomes), so it has a page but no node in globalGraphLayout.json.
# Ratchet: fixing that content lowers this to 0; a resolution regression raises it and fails here.
UNRESOLVED_CEILING = 3

# Measured 2026-08-31: 952 member nodes across the 47 systems (was 1711 before the anchoring rule
# above; median per system 32 -> 19, max 114 -> 57). Floor with headroom for ordinary content
# edits — a big drop means resolution broke, not that authors deleted a third of the corpus.
MIN_MEMBER_NODES = 880

REQUIRED = {
    "id": str, "key": str, "name": str, "url": str, "summary": str, "type": str,
    "difficulty": str, "nodes": list, "unresolved": list, "products": list,
    "unanchored": list,
}

# ── BODIES ────────────────────────────────────────────────────────────────────────────────────
# A System's authored file is ~20KB of prose — 145,746 words across the 47 — and until v1.155.3
# the app read two fields of it. The rest now ships as a dossier chunk in the per-node content/
# chunk space, keyed "<Name>|System", fetched on demand by the panel through the same `_ngc()`
# cache a node dossier uses. The 82 concepts (v1.152.0) ride the same space, keyed
# "<Name>|Principle" / "<Name>|Learning".
#
# WHAT GOES WRONG WITHOUT THIS CHECK, and it is the repo's most repeated failure shape: the panel
# renders its index card either way. A body that never got emitted, a chunk written to a different
# address than the app computes, an authored field renamed upstream so a block comes back empty —
# every one of them looks like "this System just has a short page". So: resolve each `key` through
# the SAME fnv1a32 the writer used (imported, never re-implemented — CLAUDE.md 6.6), open the file
# the app would open, and count what is actually in it.
#
# The per-block floors are ROT DETECTORS, not editorial rules: today every one of the 47 systems
# and 82 concepts carries every block its library authors, so a half-corpus floor cannot fire on
# ordinary content edits and does fire when a renamed field empties a block corpus-wide.
# ── THE CROSS-TYPE RUNG, AND WHY IT NEEDS A FLOOR ─────────────────────────────────────────────
# `_resolve_member` tries the graph section the author's `content_type` names, and — only when that
# finds nothing — the other two. Measured 2026-08-31: it fires ONCE across both libraries.
# `Principles/Submission-Chains` names "Triangle from Guard" as a **Submission**; the node is
# `Transitions/Triangle-from-Guard`. Right about the move, wrong about the drawer, and the miss was
# invisible because an unresolved ref is a legitimate outcome (concepts: 2 unresolved -> 1, 729 lit
# nodes -> 730).
#
# A rung that stops firing is a rung that has silently rotted, and zero reads exactly like a pass —
# so the count it publishes (`_meta.crossTypeRefs`) has a floor. THE ONE WAY THIS GOES RED WITHOUT
# A BUG: an author fixes that ref's `content_type` in content/Principles/Submission Chains.json, at
# which point the rung correctly has nothing to do. Lower the floor to 0 in that same commit.
# systems.json legitimately reports 0 today (its authors typed the right sections), so only the
# concepts payload carries this floor.
CROSS_TYPE_FLOOR = 1
# Measured 2026-08-31: 730 lit nodes across 82 concepts (656 principle + 74 learning), 1 unresolved
# ref ("Achilles Lock" — a content page with no graph node: content/Submissions/Achilles Lock.json
# is an edgeless stub, the same gap systems.json reports three times). Floors and ceilings, not
# equalities: ordinary content edits move these by a few, a resolution regression moves them by a
# lot. Two concepts resolve 0 nodes ON PURPOSE (Principles/Flow-Rolling, Learning/Economy-of-Motion
# reference only other concepts), which is why there is no per-concept floor.
CONCEPT_NODES_FLOOR = 690
CONCEPT_UNRESOLVED_CEILING = 1

BODY_BLOCKS = {
    "System": ("overview", "points", "contexts", "errors", "mistakes", "drills", "metrics"),
    "Principle": ("overview", "points", "contexts", "errors", "drills"),
    "Learning": ("overview", "points", "contexts", "errors", "drills"),
}


def check_bodies(entries: list[tuple[str, str, str]]) -> tuple[list[str], dict]:
    """Check 10. `entries` is (id, key, cat) for every System and concept.

    Returns (errors, per-category coverage). Fails on a missing chunk, a chunk that does not carry
    its own key, a body with no prose at all, and — the silent one — a BLOCK that fewer than half
    the entries of its library carry. A zero count is never a pass: `covered` is printed.
    """
    errors: list[str] = []
    cov: dict = {}
    cache: dict = {}
    for eid, key, cat in entries:
        c = cov.setdefault(cat, {"n": 0, "blocks": {b: 0 for b in BODY_BLOCKS[cat]}})
        c["n"] += 1
        if not key or not key.endswith("|" + cat):
            errors.append(f"{eid}: `key` {key!r} does not address the {cat} chunk space")
            continue
        h = fnv1a32(key)
        if h not in cache:
            f = CHUNKS / f"{h}.json"
            try:
                cache[h] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else None
            except json.JSONDecodeError as exc:
                cache[h] = None
                errors.append(f"{eid}: chunk content/{h}.json does not parse — {exc}")
        chunk = cache[h]
        if chunk is None:
            errors.append(
                f"{eid}: no readable body at content/{h}.json (the address the app computes from "
                f"key {key!r}) — the panel would open a title and a link")
            continue
        body = chunk.get(key)
        if not isinstance(body, dict):
            errors.append(
                f"{eid}: chunk content/{h}.json exists but carries no {key!r} entry — a hash "
                f"collision was written wrong, or the key changed on one side only")
            continue
        present = [b for b in BODY_BLOCKS[cat] if body.get(b)]
        if not present:
            errors.append(f"{eid}: body is empty — every authored block came back blank")
        for b in present:
            c["blocks"][b] += 1
    for cat, c in sorted(cov.items()):
        for b, n in sorted(c["blocks"].items()):
            if n * 2 < c["n"]:
                errors.append(
                    f"{cat}: only {n} of {c['n']} bodies carry `{b}` — below the half-corpus rot "
                    f"floor. An authored field was renamed or stopped parsing; the panel renders "
                    f"the rest and says nothing")
    return errors, cov


def check_anchoring(systems: list, nodes_by_id: dict) -> tuple[list[str], int, int]:
    """Check 9 — every node a family-expanded ref contributed comes from a position the system
    teaches. Returns (errors, family refs seen, unanchored refs), and the caller FAILS on a zero
    coverage count: a rule that matched nothing must never read the same as a rule that held.
    """
    errors: list[str] = []
    fam_refs = unanchored = 0
    for s in systems:
        sid = s.get("id", "<no id>")
        glue = s.get("glue")
        if not isinstance(glue, list):
            errors.append(f"{sid}: `glue` missing or not a list — the anchoring rule is unreadable")
            continue
        unanchored += len(s.get("unanchored") or [])
        # the positions this system teaches; a family instance must come from one of them
        taught = {
            nodes_by_id[n]["posId"]
            for n in s.get("nodes") or []
            if n in nodes_by_id and nodes_by_id[n].get("posId")
        }
        for g in glue:
            if not isinstance(g, dict):
                errors.append(f"{sid}: glue entry is not an object")
                continue
            g_nodes = g.get("nodes") or []
            # `fam` marks a ref the emitter expanded from a family name. Fall back to a >1 node
            # count so this gate still goes RED against a payload built before `fam` existed.
            if not (g.get("fam") or len(g_nodes) > 1):
                continue
            fam_refs += 1
            stray = [
                n for n in g_nodes
                if n in nodes_by_id and (nodes_by_id[n].get("fromPositionId") or "") not in taught
            ]
            if stray:
                errors.append(
                    f"{sid}: family ref {g.get('ref')!r} contributed {len(stray)} of {len(g_nodes)} "
                    f"node(s) from positions this system does not teach — "
                    f"{[n.split('/', 1)[1] for n in stray[:4]]}"
                    + (" …" if len(stray) > 4 else ""))
    return errors, fam_refs, unanchored


def check(payload: dict, node_ids: set[str], expected_ids: set[str]) -> list[str]:
    errors: list[str] = []
    systems = payload.get("systems")
    meta = payload.get("_meta") or {}
    if not isinstance(systems, list) or not systems:
        return ["systems.json: `systems` is missing or empty"]

    ids = [s.get("id") for s in systems]
    if len(set(ids)) != len(ids):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        errors.append(f"duplicate system ids: {dupes}")
    if ids != sorted(ids):
        errors.append("systems are not sorted by id — the payload must diff cleanly across re-runs")
    missing = expected_ids - set(ids)
    extra = set(ids) - expected_ids
    if missing:
        errors.append(f"{len(missing)} content/Systems file(s) absent from the payload: {sorted(missing)[:5]}")
    if extra:
        errors.append(f"{len(extra)} payload id(s) with no content/Systems file: {sorted(extra)[:5]}")
    if meta.get("count") != len(systems):
        errors.append(f"_meta.count {meta.get('count')} != {len(systems)} systems in the array")

    total_nodes = total_unresolved = 0
    for s in systems:
        sid = s.get("id", "<no id>")
        for key, typ in REQUIRED.items():
            if not isinstance(s.get(key), typ):
                errors.append(f"{sid}: `{key}` missing or not {typ.__name__}")
        if not isinstance(s.get("nodes"), list) or not isinstance(s.get("products"), list):
            continue  # typed errors already reported; the per-item checks below would crash
        if s.get("url") != f"/{sid}":
            errors.append(f"{sid}: url {s.get('url')!r} does not match the page path /{sid}")
        if len(s.get("summary") or "") > SUMMARY_CAP:
            errors.append(f"{sid}: summary is {len(s['summary'])} chars (cap {SUMMARY_CAP})")

        unknown = [n for n in s["nodes"] if n not in node_ids]
        if unknown:
            errors.append(
                f"{sid}: {len(unknown)} node id(s) absent from graph-data.json — the highlight "
                f"would light nothing: {unknown[:4]}")
        if not s["nodes"] and sid not in KNOWN_EMPTY:
            errors.append(f"{sid}: resolved 0 graph nodes and is not in KNOWN_EMPTY")
        total_nodes += len(s["nodes"])
        total_unresolved += len(s.get("unresolved") or [])

        for p in s["products"]:
            if not isinstance(p, dict):
                errors.append(f"{sid}: product entry is not an object")
                continue
            for key in ("name", "instructor", "url"):
                if not isinstance(p.get(key), str):
                    errors.append(f"{sid}: product `{key}` missing or not a string")
            url = p.get("url") or ""
            if not url.startswith("https://"):
                errors.append(f"{sid}: product {p.get('name')!r} url is not https: {url!r}")

    if total_unresolved > UNRESOLVED_CEILING:
        errors.append(
            f"{total_unresolved} unresolved related_content refs exceeds the measured ceiling "
            f"{UNRESOLVED_CEILING} — membership resolution regressed (or new content references a "
            f"name the graph has no node for)")
    if total_nodes < MIN_MEMBER_NODES:
        errors.append(
            f"only {total_nodes} member nodes resolved, below the floor {MIN_MEMBER_NODES} — "
            f"resolution regressed")
    if meta.get("unresolved") != total_unresolved:
        errors.append(f"_meta.unresolved {meta.get('unresolved')} != {total_unresolved} in the arrays")
    if meta.get("nodes") not in (None, total_nodes):
        errors.append(f"_meta.nodes {meta.get('nodes')} != {total_nodes} in the arrays")
    return errors


def main() -> None:
    for path in (PAYLOAD, GRAPH_DATA):
        if not path.exists():
            print(f"[check_systems_payload] ERROR: {path.relative_to(PROJECT_ROOT)} missing — run "
                  f"`npm run regenerate:neural` (or python3 scripts/regenerate_neural_data.py)",
                  file=sys.stderr)
            sys.exit(1)
    try:
        payload = json.loads(PAYLOAD.read_text())
        nodes_by_id = {n["id"]: n for n in json.loads(GRAPH_DATA.read_text())["nodes"]}
        node_ids = set(nodes_by_id)
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        print(f"[check_systems_payload] ERROR: unreadable payload — {exc}", file=sys.stderr)
        sys.exit(1)

    expected_ids = {f"Systems/{quartz_slug(p.stem)}" for p in SYSTEMS_DIR.glob("*.json")}
    errors = check(payload, node_ids, expected_ids)

    anchor_errors, fam_refs, unanchored = check_anchoring(
        payload.get("systems") or [], nodes_by_id)
    errors.extend(anchor_errors)
    if fam_refs < FAM_REF_FLOOR:
        errors.append(
            f"the anchoring rule saw only {fam_refs} family-expanded ref(s), below the floor "
            f"{FAM_REF_FLOOR} — check 9 matched (almost) nothing, which reads exactly like a pass "
            f"and is not one. Either `glue[].fam` stopped being emitted or membership resolution "
            f"regressed")
    if unanchored > UNANCHORED_CEILING:
        errors.append(
            f"{unanchored} family ref(s) anchor no instance at all, above the measured ceiling "
            f"{UNANCHORED_CEILING} — a System names a submission family but teaches none of the "
            f"positions it is thrown from. Fix the content (add the entry position to that "
            f"System's related_content), do not raise this ceiling to hide it")

    # ── check 10: the readable bodies, for BOTH libraries that share the chunk space ──
    # concepts.json is emitted by the same script in the same run, so its absence is a broken
    # emit, not an old tree — say which, rather than skipping quietly (CLAUDE.md 6.6).
    entries = [(s.get("id", "<no id>"), s.get("key") or "", "System")
               for s in payload.get("systems") or []]
    if CONCEPTS.exists():
        try:
            for c in json.loads(CONCEPTS.read_text()).get("concepts") or []:
                entries.append((c.get("id", "<no id>"), c.get("key") or "",
                                c.get("cat") if c.get("cat") in BODY_BLOCKS else "Principle"))
        except json.JSONDecodeError as exc:
            errors.append(f"concepts.json does not parse — {exc}")
    else:
        errors.append("concepts.json is missing beside systems.json — both are emitted by "
                      "regenerate_neural_data.py in one run, so one without the other means the "
                      "emit is broken, not that the tree is old")
    body_errors, body_cov = check_bodies(entries)
    errors.extend(body_errors)

    # ── the concepts payload's own ratchets, on the same read ──
    cmeta, clit, cunres = {}, 0, 0
    if CONCEPTS.exists():
        try:
            cdoc = json.loads(CONCEPTS.read_text())
            cmeta = cdoc.get("_meta") or {}
            clit = sum(len(c.get("nodes") or []) for c in cdoc.get("concepts") or [])
            cunres = sum(len(c.get("unresolved") or []) for c in cdoc.get("concepts") or [])
        except json.JSONDecodeError:
            pass  # already reported above
        if cmeta:
            if cmeta.get("crossTypeRefs", 0) < CROSS_TYPE_FLOOR:
                errors.append(
                    f"concepts: the cross-type resolution rung fired "
                    f"{cmeta.get('crossTypeRefs', 0)} time(s), below the floor {CROSS_TYPE_FLOOR} "
                    f"— a rung that matches nothing reads exactly like a rung that held. Either it "
                    f"was removed, or an author fixed the ref it exists for (then lower the floor "
                    f"to 0 in that same commit)")
            if clit < CONCEPT_NODES_FLOOR:
                errors.append(
                    f"concepts: only {clit} lit nodes across the concepts, below the floor "
                    f"{CONCEPT_NODES_FLOOR} — membership resolution regressed")
            if cunres > CONCEPT_UNRESOLVED_CEILING:
                errors.append(
                    f"concepts: {cunres} unresolved related_content refs exceeds the measured "
                    f"ceiling {CONCEPT_UNRESOLVED_CEILING} — a resolution regression, or new "
                    f"content naming something the graph has no node for")

    placeholders = [
        (s["id"], p.get("url", ""))
        for s in payload.get("systems", []) if isinstance(s.get("products"), list)
        for p in s["products"] if isinstance(p, dict) and "REPLACE_ME" in (p.get("url") or "")
    ]
    affiliate_ref = os.environ.get("AFFILIATE_REF", "").strip()
    if placeholders and affiliate_ref:
        for sid, url in placeholders:
            errors.append(f"{sid}: AFFILIATE_REF is set but the product url still says REPLACE_ME "
                          f"({url}) — run scripts/apply_affiliate_ref.py BEFORE this gate; if it "
                          f"already ran, its substitution failed and the link earns nothing")

    if errors:
        print("[check_systems_payload] FAIL", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    systems = payload["systems"]
    meta = payload.get("_meta") or {}
    nodes = sum(len(s["nodes"]) for s in systems)
    unres = sum(len(s.get("unresolved") or []) for s in systems)
    prods = sum(len(s["products"]) for s in systems)
    print(f"[check_systems_payload] OK — {len(systems)} systems, {nodes} member nodes "
          f"(all present in graph-data.json), {unres}/{UNRESOLVED_CEILING} unresolved refs, "
          f"{prods} product(s) across {sum(1 for s in systems if s['products'])} system(s), "
          f"{meta.get('nonGraphRefs', '?')} non-graph cross-refs skipped")
    print(f"[check_systems_payload] anchoring OK — {fam_refs} family-expanded ref(s) checked "
          f"(floor {FAM_REF_FLOOR}), every contributed node thrown from a position its System "
          f"teaches; {unanchored}/{UNANCHORED_CEILING} ref(s) anchor nothing and are reported, "
          f"not expanded")
    if cmeta:
        print(f"[check_systems_payload] concepts OK — {clit} lit nodes (floor "
              f"{CONCEPT_NODES_FLOOR}), {cunres}/{CONCEPT_UNRESOLVED_CEILING} unresolved, "
              f"cross-type rung fired {cmeta.get('crossTypeRefs', 0)}x (floor {CROSS_TYPE_FLOOR})")
    for cat, c in sorted(body_cov.items()):
        print(f"[check_systems_payload] bodies OK — {c['n']} {cat} dossier(s) found at the "
              f"address the app computes, blocks: "
              + ", ".join(f"{b} {n}" for b, n in sorted(c["blocks"].items())))
    if placeholders:
        print(f"[check_systems_payload] NOTE — {len(placeholders)} product url(s) still contain "
              f"REPLACE_ME. AFFILIATE_REF is unset, so that is expected: the ref-substitution "
              f"plumbing is not wired yet. These links earn NOTHING until it is: "
              f"{[sid for sid, _ in placeholders]}")


if __name__ == "__main__":
    main()
