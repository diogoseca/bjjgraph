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
     AFFILIATE_REF is set (while it is unset the placeholder is expected and only reported).

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

SYSTEMS_DIR = PROJECT_ROOT / "content" / "Systems"
PAYLOAD = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "systems.json"
GRAPH_DATA = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "graph-data.json"

SUMMARY_CAP = 240  # contract cap; keep in sync with regenerate_neural_data.SUMMARY_CAP

# Measured 2026-08-09 (47 systems, 818 graph-typed related_content refs): every system resolves
# at least one node, so this allow-list is EMPTY on purpose. An entry here means a System whose
# related_content points at nothing the graph renders — justify it in a comment or fix the content.
KNOWN_EMPTY: frozenset[str] = frozenset()

# Measured: 3 unresolved refs, all "Achilles Lock" — content/Submissions/Achilles Lock.json is an
# edgeless stub (no role, no outcomes), so it has a page but no node in globalGraphLayout.json.
# Ratchet: fixing that content lowers this to 0; a resolution regression raises it and fails here.
UNRESOLVED_CEILING = 3

# Measured: 1711 member nodes across the 47 systems. Floor with headroom for ordinary content
# edits — a big drop means resolution broke, not that authors deleted a third of the corpus.
MIN_MEMBER_NODES = 1600

REQUIRED = {
    "id": str, "name": str, "url": str, "summary": str, "type": str,
    "difficulty": str, "nodes": list, "unresolved": list, "products": list,
}


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
        node_ids = {n["id"] for n in json.loads(GRAPH_DATA.read_text())["nodes"]}
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        print(f"[check_systems_payload] ERROR: unreadable payload — {exc}", file=sys.stderr)
        sys.exit(1)

    expected_ids = {f"Systems/{quartz_slug(p.stem)}" for p in SYSTEMS_DIR.glob("*.json")}
    errors = check(payload, node_ids, expected_ids)

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
    if placeholders:
        print(f"[check_systems_payload] NOTE — {len(placeholders)} product url(s) still contain "
              f"REPLACE_ME. AFFILIATE_REF is unset, so that is expected: the ref-substitution "
              f"plumbing is not wired yet. These links earn NOTHING until it is: "
              f"{[sid for sid, _ in placeholders]}")


if __name__ == "__main__":
    main()
