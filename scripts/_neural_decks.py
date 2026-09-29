#!/usr/bin/env python3
"""Assemble the whole flashcard corpus from the per-deck chunks — and decode the ordinal-keyed
eager wire (the deck manifest and the score table) the same way the app does.

The 16.4MB flashcards.json monolith was deleted in v1.80.4: it was the Neural app's boot
payload, and shipping every card for all 2,924 decks before the visitor could make a move was
the single largest contributor to a real-user LCP P75 of 13.7s. The chunks
(static/neural/flashcards/<fnv1a32(key)>.json + _index.json) are now the ONE source of truth.

Tooling that legitimately needs the entire corpus at once — the MC-viability audit, which is
exhaustive by design — reads it through here instead of through a second emitted artifact. One
generator, one truth, no monolith to drift.

THE ORDINAL-KEYED WIRE (v1.204.3). Manifest format 4 and curriculum.json's `scoreWeightsByOrd`
key every deck and every score weight by its node's permanent share ordinal (`o`,
node_ordinals.json) instead of spelling "<Name>|<Role>" — the names were ~23 kB of gzip on the
boot path, and graph-data.json already carries every one of them. So decoding needs
graph-data.json's nodes. This is the Python READER; the JavaScript one, which the app, the
digest Worker and the unit suite share, is neural/src/wire-keys.src.js, and the two implement one
rule (see node_deck_name). The emitter round-trips its own output through the functions below
and refuses to write a wire they cannot read back exactly.

The Node/Playwright equivalent of load_decks is e2e/decks.ts.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# The app's posFamily(): a position hub is TITLED "… Top" (an artifact of the visual collapse),
# and its decks are keyed by the family name without the seat. Same regex as wire-keys.src.js.
_SEAT_SUFFIX = re.compile(r"\s+(Top|Bottom)\s*$", re.IGNORECASE)
SEATS = {"positions": ("Top", "Bottom")}          # every other type: TECH_SEATS
TECH_SEATS = ("Attacker", "Defender")
CATS = {"positions": "Position", "submissions": "Submission"}   # every other type: "Transition"


def node_deck_name(node: dict) -> str:
    """The deck NAME a graph-data node's decks are keyed by (the app's deckKeyFor `fam`)."""
    t = str(node.get("t") or "")
    return _SEAT_SUFFIX.sub("", t, count=1).strip() if node.get("ty") == "positions" else t


def node_seats(node: dict) -> tuple[str, str]:
    """[rep seat, partner seat] — the order manifest `n` pairs and score `p.r` indexes use."""
    return SEATS.get(node.get("ty"), TECH_SEATS)


def node_cat(node: dict) -> str:
    return CATS.get(node.get("ty"), "Transition")


def by_ordinal(nodes: list) -> tuple[dict[int, dict], int]:
    """ordinal -> node, plus how many nodes claimed an ordinal already taken (a broken wire —
    counted, never allowed to replace the first claimant)."""
    out: dict[int, dict] = {}
    dupes = 0
    for n in nodes or []:
        o = n.get("o")
        if not isinstance(o, int) or isinstance(o, bool):
            continue
        if o in out:
            dupes += 1
            continue
        out[o] = n
    return out, dupes


def decode_manifest(manifest: dict, nodes: list | None) -> tuple[dict, int]:
    """Return ({deckKey: {"cat", "n", "file"?}} in NAME order, unresolved ordinal count).

    Format 4 (`deckOrd`) needs graph-data.json's nodes; formats 1-3 carry the key themselves."""
    wire = manifest.get("deckOrd")
    if isinstance(wire, dict) and isinstance(wire.get("o"), list) and isinstance(wire.get("n"), list):
        idx, _dupes = by_ordinal(nodes or [])
        rows, unresolved, o = [], 0, -1
        for i, d in enumerate(wire["o"]):
            o += d + 1
            node = idx.get(o)
            if node is None:
                unresolved += 1
                continue
            name, seats, cat = node_deck_name(node), node_seats(node), node_cat(node)
            for s in (0, 1):
                n = wire["n"][2 * i + s]
                if n > 0:
                    rows.append((f"{name}|{seats[s]}", cat, n))
        rows.sort(key=lambda r: r[0])
        out: dict[str, dict] = {}
        for key, cat, n in rows:
            out.setdefault(key, {"cat": cat, "n": n})
        return out, unresolved
    out = {}
    for key, entry in (manifest.get("decks") or {}).items():
        if isinstance(entry, list) and len(entry) >= 3:
            out[key] = {"file": entry[0], "cat": entry[1], "n": entry[2]}
        elif isinstance(entry, list):
            out[key] = {"cat": entry[0], "n": entry[1]}
        else:
            out[key] = {"file": entry.get("file"), "cat": entry.get("cat"), "n": entry.get("n", 0)}
    return out, 0


def decode_score_weights(cur: dict, frame: str, nodes: list | None) -> tuple[dict, int]:
    """Return ({deckKey: weight}, unresolved) for one ruleset frame — `scoreWeightsByOrd` read
    exactly as ngWireScoreWeights reads it. Zeros ("not attemptable in this frame") are skipped;
    a `p` ordinal on a non-position or a `t` ordinal on a position is counted unresolved."""
    bo = cur.get("scoreWeightsByOrd") or {}
    p, t = bo.get("p") or {}, bo.get("t") or {}
    if frame not in p or frame not in t:
        return {}, 0
    idx, _dupes = by_ordinal(nodes or [])
    div = bo.get("div") or 10_000_000
    out: dict[str, float] = {}
    unresolved = 0
    for o, r, v in zip(p["o"], p["r"], p[frame]):
        if not v:
            continue
        node = idx.get(o)
        if node is None or node.get("ty") != "positions":
            unresolved += 1
            continue
        out[f"{node_deck_name(node)}|{node_seats(node)[r]}"] = v / div
    for o, v in zip(t["o"], t[frame]):
        if not v:
            continue
        node = idx.get(o)
        if node is None or node.get("ty") == "positions":
            unresolved += 1
            continue
        name, seats = node_deck_name(node), node_seats(node)
        out[f"{name}|{seats[0]}"] = out[f"{name}|{seats[1]}"] = v / div
    return out, unresolved


def graph_nodes(neural_dir: Path) -> list:
    """graph-data.json's nodes — what an ordinal-keyed payload beside it is decoded against."""
    return json.loads((neural_dir / "graph-data.json").read_text()).get("nodes", [])


def _decoded_manifest(fc_dir: Path) -> dict:
    manifest = json.loads((fc_dir / "_index.json").read_text())
    nodes = graph_nodes(fc_dir.parent) if "deckOrd" in manifest else None
    decks, unresolved = decode_manifest(manifest, nodes)
    if unresolved:
        # a reader that shrugs here would hand an exhaustive audit a corpus with holes in it
        raise SystemExit(f"{fc_dir / '_index.json'}: {unresolved} deck ordinal(s) name no node in "
                         f"graph-data.json — the two files are from different emits.")
    return decks


def chunk_name(key: str) -> str:
    """The chunk file for a deck key — derived, exactly as the app derives it (fnv1a32/qhash)."""
    from _neural_content import fnv1a32
    return f"{fnv1a32(key)}.json"


def load_decks(fc_dir: Path) -> dict:
    """Return {deckKey: {cat, role, cards:[…]}} for every deck in the manifest."""
    cache: dict[str, dict] = {}
    out: dict[str, dict] = {}
    for key, entry in _decoded_manifest(fc_dir).items():
        # format 3+: the address is derived from the key. Older: a filename rode along.
        fname = entry.get("file") or chunk_name(key)
        if fname not in cache:
            cache[fname] = json.loads((fc_dir / fname).read_text())
        blob = cache[fname]
        deck = blob if "cards" in blob else blob.get(key) or {}
        out[key] = {
            "cat": deck.get("cat"),
            "role": deck.get("role") or key.rsplit("|", 1)[-1],
            "cards": deck.get("cards") or [],
        }
    return out


def manifest_counts(fc_dir: Path) -> dict:
    """Return {deckKey: n} straight from the manifest, without reading any chunk."""
    return {key: entry.get("n", 0) for key, entry in _decoded_manifest(fc_dir).items()}
