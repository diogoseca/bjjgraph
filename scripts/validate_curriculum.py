#!/usr/bin/env python3
"""validate_curriculum.py — the hard gate for templates/curriculum.json.

Checks (exit 1 on any error):
  - unique belt/unit ids; units non-empty; every unit has a checkpoint {cards, pass<=cards}
  - every lesson nodeId resolves in the live graph; every deckKey resolves to a deck with
    >=1 card; deckKey is one this nodeId may legally use (deckKeyFor port — no mismatched
    lesson pointing camera at one node and drilling another)
  - frame liveness: a lesson whose technique is nogi-dead MUST carry frames:["gi"];
    every unit keeps >=3 live lessons in EACH frame; the belt test's start deck is live in
    both frames
  - computed belt-test opponent pools carry >=5 names per frame (pools are computed from
    cumulative lesson base-names — never authored)
  - "provisional": true only WARNS (owner line-review pending), never fails

Run: python3 scripts/validate_curriculum.py   (npm run validate:curriculum)
Also invoked from regenerate_neural_data.py::main() so a bad curriculum can't be emitted.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _curriculum import (  # noqa: E402
    compute_pools,
    expected_deck_keys,
    lesson_frames,
    load_curriculum,
    load_graph_index,
    technique_avail,
)


def main() -> int:
    try:
        cur = load_curriculum()
    except FileNotFoundError:
        print("ERROR: templates/curriculum.json not found")
        return 1
    nodes, deck_sizes = load_graph_index()
    errors: list[str] = []
    warns: list[str] = []

    if cur.get("provisional"):
        warns.append("curriculum is PROVISIONAL — owner line-review pending")

    belts = cur.get("belts", [])
    if not belts:
        errors.append("no belts")
    seen_belt, seen_unit = set(), set()

    for bi, belt in enumerate(belts):
        bid = belt.get("id", f"<belt {bi}>")
        if bid in seen_belt:
            errors.append(f"duplicate belt id {bid}")
        seen_belt.add(bid)
        if not belt.get("units"):
            errors.append(f"{bid}: no units")
            continue

        for unit in belt["units"]:
            uid = f"{bid}/{unit.get('id', '?')}"
            if uid in seen_unit:
                errors.append(f"duplicate unit id {uid}")
            seen_unit.add(uid)

            cp = unit.get("checkpoint") or {}
            if not cp.get("cards") or not cp.get("pass") or cp["pass"] > cp["cards"]:
                errors.append(f"{uid}: bad checkpoint {cp}")

            if unit.get("positionNodeId") not in nodes:
                errors.append(f"{uid}: unknown positionNodeId {unit.get('positionNodeId')}")

            live_count = {"gi": 0, "nogi": 0}
            for l in unit.get("lessons", []):
                node = nodes.get(l.get("nodeId"))
                if not node:
                    errors.append(f"{uid}: unknown lesson nodeId {l.get('nodeId')}")
                    continue
                dk = l.get("deckKey")
                if deck_sizes.get(dk, 0) < 1:
                    errors.append(f"{uid}: deckKey {dk} has no cards")
                if dk not in expected_deck_keys(node):
                    errors.append(f"{uid}: deckKey {dk} does not belong to {l['nodeId']}")
                av = technique_avail(node)
                if node.get("ty") != "positions" and not av["nogi"] and l.get("frames") != ["gi"]:
                    errors.append(f"{uid}: {l['nodeId']} is nogi-dead but not marked frames:[\"gi\"]")
                frames = lesson_frames(l, node)
                for f in ("gi", "nogi"):
                    if frames[f]:
                        live_count[f] += 1
            for f in ("gi", "nogi"):
                if live_count[f] < 3:
                    errors.append(f"{uid}: only {live_count[f]} live lessons in {f} (need >=3)")

        test = belt.get("test") or {}
        tnode = nodes.get(test.get("startNodeId"))
        if not tnode:
            errors.append(f"{bid}: test startNodeId {test.get('startNodeId')} unknown")
        else:
            if test.get("startDeckKey") not in expected_deck_keys(tnode):
                errors.append(f"{bid}: test startDeckKey {test.get('startDeckKey')} mismatched")
            tav = technique_avail(tnode)
            if not (tav["gi"] and tav["nogi"]):
                errors.append(f"{bid}: test start not live in both frames")
        pools = compute_pools(belts, bi, nodes)
        for f in ("gi", "nogi"):
            if len(pools[f]) < 5:
                errors.append(f"{bid}: computed {f} pool has {len(pools[f])} names (need >=5)")

    for w in warns:
        print(f"WARN: {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        print(f"curriculum INVALID: {len(errors)} error(s)")
        return 1
    n_units = sum(len(b['units']) for b in belts)
    n_lessons = sum(len(u['lessons']) for b in belts for u in b['units'])
    print(f"curriculum OK: {len(belts)} belts, {n_units} units, {n_lessons} lessons")
    return 0


if __name__ == "__main__":
    sys.exit(main())
