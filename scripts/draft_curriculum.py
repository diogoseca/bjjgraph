#!/usr/bin/env python3
"""draft_curriculum.py — one-shot expert-panel draft of templates/curriculum.json.

Drafts the Belt Path curriculum (belts -> units -> lessons -> checkpoint -> belt test) via
sequential per-belt Claude calls (each belt sees the belts drafted before it, so coverage
composes instead of overlapping). Every nodeId / deckKey the model may use is supplied in an
inventory built from the LIVE graph + flashcards payloads, and the output is mechanically
verified against that inventory before writing — an id the graph doesn't know cannot survive.

Output is committed as PROVISIONAL (`"provisional": true`): the owner line-reviews on return;
scripts/validate_curriculum.py is the hard gate either way.

Usage: python3 scripts/draft_curriculum.py [--model MODEL] [--effort high]
       [--belt white]   (draft/redraft a single belt, preserving the others)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from claude_infer import call_claude  # noqa: E402
from _model import model as _model_tier  # noqa: E402 — single source of truth: models.env

GRAPH_DATA = ROOT / "source/quartz/static/neural/graph-data.json"
# graph.json carries the per-role move tables; graph-data.json stopped shipping `cal.moves`
# on the wire in v1.107.0 (its only runtime consumer was the edge-lighting pass, now
# precomputed as `cal.ew`), so this build-side tool reads the tables from the source graph.
GRAPH = ROOT / "graph.json"
# per-deck chunks (the flashcards.json monolith was deleted in v1.80.4)
FLASHCARDS_DIR = ROOT / "source/quartz/static/neural/flashcards"
OUT = ROOT / "templates/curriculum.json"

BELTS = [
    ("white", "White Belt", "#e8e6df"),
    ("blue", "Blue Belt", "#4a6cff"),
    ("purple", "Purple Belt", "#9a5cff"),
    ("brown", "Brown Belt", "#8a5a2b"),
    ("black", "Black Belt", "#20242f"),
]

RUBRIC = """You are an expert panel (John Danaher's systematic curriculum design, a veteran
IBJJF competition coach, and a beginner-focused academy head instructor) drafting ONE belt of
a BJJ learning path for an interactive graph app. The path is a CURATED ROUTE over an existing
technique graph — not a partition. Rules:
- 4-6 units for this belt. A unit is a position system seen from one side (e.g. "Closed Guard:
  Bottom", "Mount: Escapes"). Order units easiest-first, IBJJF-typical for this belt level.
- 4-7 lessons per unit. A lesson is EITHER the position itself (its role page: study the
  position before its techniques) or a technique from that position. Order: position first,
  then techniques from fundamental to advanced.
- Use ONLY nodeId and deckKey values that appear in the INVENTORY below — they are the graph's
  real identifiers. Never invent or reword one.
- A lesson that only makes sense in the gi (collar/sleeve/lapel techniques) must carry
  "frames": ["gi"]. Every unit must keep at least 3 lessons that work in BOTH frames.
- Techniques already used by PREVIOUSLY DRAFTED BELTS (listed below) must not repeat.
- checkpoint is always {"cards": 6, "pass": 5}.
- The belt test: pick a startNodeId/startDeckKey the student knows from THIS belt's units
  (a position lesson), maxMoves 12-16, pointsWinDominance between 0.3 and 0.45.
- Belt-appropriate content: white = survival, escapes, closed guard, mount/side control
  basics; blue = guard passing, sweeps, front headlock; purple = open/half guard systems,
  back attacks; brown = leg entanglements (no-gi heavy), pressure passing chains; black =
  advanced/expert systems tying earlier belts together."""


def _pos_moves(graph: dict, node_id: str, role: str) -> list:
    """graph.json's transitions[] for a layout position's role-node — the same join
    regenerate_neural_data.enrich uses (nested layout slugs are compound, graph.json keys
    the bare child slug)."""
    slug = node_id.split("/", 1)[1].lower() if "/" in node_id else node_id.lower()
    for c in ([slug, slug.rsplit("/", 1)[-1]] if "/" in slug else [slug]):
        n = graph.get("positions", {}).get(f"{c}/{role}")
        if n and n.get("transitions"):
            return n["transitions"]
    return []


def load_inventory():
    gd = json.loads(GRAPH_DATA.read_text())
    graph = json.loads(GRAPH.read_text())
    from _neural_decks import load_decks
    fc = {"decks": load_decks(FLASHCARDS_DIR)}
    decks = fc["decks"] if "decks" in fc else fc
    deck_sizes = {k: len(v["cards"]) for k, v in decks.items()}

    # technique name -> node id (for lesson technique resolution)
    tech_ids = {}
    for n in gd["nodes"]:
        if n.get("ty") in ("transitions", "submissions"):
            tech_ids.setdefault(n["t"], n["id"])

    positions = []
    for n in gd["nodes"]:
        if n.get("ty") != "positions" or not n.get("cal"):
            continue
        # graph-data nodes are HUB-COLLAPSED: one entry per live role, move tables from
        # graph.json (see _pos_moves)
        base = n["t"].rsplit(" ", 1)[0] if n["t"].endswith((" Top", " Bottom")) else n["t"]
        for role in ("Top", "Bottom"):
            deck_key = f"{base}|{role}"
            if deck_sizes.get(deck_key, 0) < 3:
                continue
            moves = _pos_moves(graph, n["id"], role.lower())
            menu = []
            for m in sorted(moves, key=lambda m: -(m.get("occurrence") or m.get("attemptProbability") or 0))[:10]:
                t = m.get("technique")
                tid = tech_ids.get(t)
                atk_key = f"{t}|Attacker"
                if not tid or deck_sizes.get(atk_key, 0) < 3:
                    continue
                av = m.get("avail") or {}
                frames = "gi-only" if (av.get("gi") and not av.get("nogi")) else "both"
                menu.append({"nodeId": tid, "deckKey": atk_key, "frames": frames})
            if len(menu) >= 3:
                positions.append({
                    "positionNodeId": n["id"],
                    "positionDeckKey": deck_key,
                    "role": role,
                    "deckCards": deck_sizes[deck_key],
                    "techniques": menu,
                })
    # richest positions first; cap the prompt size — but the fundamentals ALWAYS make the cut
    # (a belt path without Mount escapes because Mount|Bottom ranked #71 would be absurd)
    CORE = {
        "Closed Guard|Top", "Closed Guard|Bottom", "Mount|Top", "Mount|Bottom",
        "Side Control|Top", "Side Control|Bottom", "Back Control|Top", "Back Control|Bottom",
        "Half Guard|Top", "Half Guard|Bottom", "Standing Position|Top", "Turtle|Top", "Turtle|Bottom",
    }
    positions.sort(key=lambda p: (p["positionDeckKey"] not in CORE, -len(p["techniques"])))
    return positions[:80]


def belt_schema():
    lesson = {
        "type": "object",
        "additionalProperties": False,
        "required": ["nodeId", "deckKey"],
        "properties": {
            "nodeId": {"type": "string"},
            "deckKey": {"type": "string"},
            "frames": {"type": "array", "items": {"enum": ["gi", "nogi"]}},
        },
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["units", "test"],
        "properties": {
            "units": {
                "type": "array",
                "minItems": 4,
                "maxItems": 6,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "name", "positionNodeId", "lessons", "checkpoint"],
                    "properties": {
                        "id": {"type": "string", "pattern": "^[a-z0-9-]+$"},
                        "name": {"type": "string"},
                        "positionNodeId": {"type": "string"},
                        "lessons": {"type": "array", "minItems": 4, "maxItems": 7, "items": lesson},
                        "checkpoint": {
                            "type": "object",
                            "required": ["cards", "pass"],
                            "properties": {"cards": {"type": "integer"}, "pass": {"type": "integer"}},
                        },
                    },
                },
            },
            "test": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "startNodeId", "startDeckKey", "maxMoves", "pointsWinDominance"],
                "properties": {
                    "name": {"type": "string"},
                    "startNodeId": {"type": "string"},
                    "startDeckKey": {"type": "string"},
                    "maxMoves": {"type": "integer", "minimum": 10, "maximum": 18},
                    "pointsWinDominance": {"type": "number", "minimum": 0.25, "maximum": 0.5},
                },
            },
        },
    }


def verify_belt(belt: dict, inventory: list) -> list[str]:
    """Drop anything the graph doesn't know; return log lines."""
    node_ids = {p["positionNodeId"] for p in inventory} | {
        t["nodeId"] for p in inventory for t in p["techniques"]
    }
    deck_keys = {p["positionDeckKey"] for p in inventory} | {
        t["deckKey"] for p in inventory for t in p["techniques"]
    }
    log = []
    for unit in list(belt.get("units", [])):
        if unit["positionNodeId"] not in node_ids:
            belt["units"].remove(unit)
            log.append(f"DROP unit {unit['id']}: unknown position {unit['positionNodeId']}")
            continue
        for lesson in list(unit["lessons"]):
            if lesson["nodeId"] not in node_ids or lesson["deckKey"] not in deck_keys:
                unit["lessons"].remove(lesson)
                log.append(f"DROP lesson {lesson['nodeId']} ({lesson['deckKey']}) in {unit['id']}")
        if len(unit["lessons"]) < 3:
            belt["units"].remove(unit)
            log.append(f"DROP unit {unit['id']}: <3 surviving lessons")
    t = belt.get("test", {})
    if t.get("startNodeId") not in node_ids or t.get("startDeckKey") not in deck_keys:
        # fall back to the first unit's position
        u0 = belt["units"][0]
        pos = next(p for p in inventory if p["positionNodeId"] == u0["positionNodeId"])
        t["startNodeId"], t["startDeckKey"] = pos["positionNodeId"], pos["positionDeckKey"]
        log.append("FIX test start -> first unit's position")
    return log


def draft_belt(belt_id, belt_name, inventory, prior_belts, model, effort):
    used = sorted({l["deckKey"] for b in prior_belts for u in b["units"] for l in u["lessons"]})
    prompt = (
        f"{RUBRIC}\n\n## BELT TO DRAFT NOW: {belt_name} (id: {belt_id})\n\n"
        f"## ALREADY USED BY PREVIOUS BELTS (do not repeat as lessons)\n{json.dumps(used)}\n\n"
        f"## INVENTORY (the ONLY legal nodeId/deckKey values; 'frames':'gi-only' means the "
        f"lesson must carry frames:[\"gi\"])\n{json.dumps(load_slim(inventory))}\n\n"
        f"Return the belt as JSON per the schema."
    )
    raw, err = call_claude(prompt, belt_schema(), model, effort, timeout=1800)
    if err:
        raise RuntimeError(f"{belt_id}: {err}")
    belt = json.loads(raw) if isinstance(raw, str) else raw
    for line in verify_belt(belt, inventory):
        print(f"  [{belt_id}] {line}")
    return belt


def load_slim(inventory):
    return [
        {
            "position": p["positionNodeId"],
            "positionDeck": p["positionDeckKey"],
            "techniques": [
                {"nodeId": t["nodeId"], "deckKey": t["deckKey"], "frames": t["frames"]}
                for t in p["techniques"]
            ],
        }
        for p in inventory
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=_model_tier("deep"))
    ap.add_argument("--effort", default="high")
    ap.add_argument("--belt", help="redraft one belt id, preserving the rest")
    args = ap.parse_args()

    inventory = load_inventory()
    print(f"inventory: {len(inventory)} positions, "
          f"{sum(len(p['techniques']) for p in inventory)} technique slots")

    existing = json.loads(OUT.read_text()) if OUT.exists() else {"version": 1, "provisional": True, "belts": []}
    by_id = {b["id"]: b for b in existing.get("belts", [])}

    prior = []
    belts_out = []
    for belt_id, belt_name, color in BELTS:
        if args.belt and belt_id != args.belt and belt_id in by_id:
            belt = by_id[belt_id]  # keep as-is
        else:
            print(f"drafting {belt_id}…")
            body = draft_belt(belt_id, belt_name, inventory, prior, args.model, args.effort)
            belt = {"id": belt_id, "name": belt_name, "color": color, **body}
        belts_out.append(belt)
        prior.append(belt)

    OUT.write_text(json.dumps({"version": 1, "provisional": True, "belts": belts_out}, indent=2) + "\n")
    n_units = sum(len(b["units"]) for b in belts_out)
    n_lessons = sum(len(u["lessons"]) for b in belts_out for u in b["units"])
    print(f"wrote {OUT}: {len(belts_out)} belts, {n_units} units, {n_lessons} lessons (provisional)")


if __name__ == "__main__":
    main()
