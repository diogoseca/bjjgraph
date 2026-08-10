"""_curriculum.py — shared curriculum loading/resolution/pool logic.

One seam used by BOTH scripts/validate_curriculum.py (the gate) and
scripts/regenerate_neural_data.py (the emission), so validation and emission can never
disagree about what a lesson resolves to or what a belt-test opponent pool contains.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "templates/curriculum.json"
GRAPH_DATA = ROOT / "source/quartz/static/neural/graph-data.json"
# Deck SIZES only — read straight from the boot manifest, so this needs no chunk reads at all.
# (flashcards.json, the 16.4MB monolith, was deleted in v1.80.4.)
FLASHCARDS_DIR = ROOT / "source/quartz/static/neural/flashcards"


def load_curriculum() -> dict:
    return json.loads(CURRICULUM.read_text())


def load_graph_index():
    """id -> node, plus deck sizes. graph-data position nodes are HUB-COLLAPSED
    (one node carries cal.moves for both roles; the ' Top' in the title is display)."""
    gd = json.loads(GRAPH_DATA.read_text())
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from _neural_decks import manifest_counts
    nodes = {n["id"]: n for n in gd["nodes"]}
    return nodes, manifest_counts(FLASHCARDS_DIR)


def pos_base(node: dict) -> str:
    """posFamily equivalent: strip the display role suffix from a position node title."""
    t = node["t"]
    return t.rsplit(" ", 1)[0] if t.endswith((" Top", " Bottom")) else t


def expected_deck_keys(node: dict) -> set[str]:
    """The deck keys a lesson pointing at this node may legally use (deckKeyFor port)."""
    if node.get("ty") == "positions":
        base = pos_base(node)
        return {f"{base}|Top", f"{base}|Bottom"}
    return {f"{node['t']}|Attacker", f"{node['t']}|Defender"}


def base_name(title: str) -> str:
    """splitName(t).main equivalent: 'Armbar from Mount' -> 'armbar' (lowercased)."""
    return title.split(" from ")[0].strip().lower()


def technique_avail(node: dict) -> dict:
    av = (node.get("cal") or {}).get("avail") or {}
    # absent avail = live in both frames (uncalibrated nodes)
    return {"gi": av.get("gi", True), "nogi": av.get("nogi", True)}


def lesson_frames(lesson: dict, node: dict) -> dict:
    """Frames a lesson is live in: authored override ∩ technique availability."""
    authored = set(lesson.get("frames") or ["gi", "nogi"])
    av = technique_avail(node)
    return {f: (f in authored and av.get(f, True)) for f in ("gi", "nogi")}


def compute_pools(belts: list, upto_index: int, nodes: dict) -> dict:
    """Belt-test opponent pool for belts[upto_index]: cumulative lesson base-names of this
    belt + all prior belts, split per frame by technique availability. Computed, never
    authored."""
    pools = {"gi": set(), "nogi": set()}
    for b in belts[: upto_index + 1]:
        for u in b["units"]:
            for l in u["lessons"]:
                n = nodes.get(l["nodeId"])
                if not n or n.get("ty") == "positions":
                    continue
                frames = lesson_frames(l, n)
                for f in ("gi", "nogi"):
                    if frames[f]:
                        pools[f].add(base_name(n["t"]))
    return {f: sorted(v) for f, v in pools.items()}
