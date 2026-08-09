#!/usr/bin/env python3
"""Assemble the whole flashcard corpus from the per-deck chunks.

The 16.4MB flashcards.json monolith was deleted in v1.80.4: it was the Neural app's boot
payload, and shipping every card for all 2,924 decks before the visitor could make a move was
the single largest contributor to a real-user LCP P75 of 13.7s. The chunks
(static/neural/flashcards/<slug>.json + _index.json) are now the ONE source of truth.

Tooling that legitimately needs the entire corpus at once — the MC-viability audit, which is
exhaustive by design — reads it through here instead of through a second emitted artifact. One
generator, one truth, no monolith to drift.

The Node/Playwright equivalent is e2e/decks.ts.
"""
from __future__ import annotations

import json
from pathlib import Path


def chunk_name(key: str) -> str:
    """The chunk file for a deck key — derived, exactly as the app derives it (fnv1a32/qhash)."""
    from _neural_content import fnv1a32
    return f"{fnv1a32(key)}.json"


def load_decks(fc_dir: Path) -> dict:
    """Return {deckKey: {cat, role, cards:[…]}} for every deck in the manifest."""
    manifest = json.loads((fc_dir / "_index.json").read_text())
    cache: dict[str, dict] = {}
    out: dict[str, dict] = {}
    for key, entry in (manifest.get("decks") or {}).items():
        # format 3: [cat, n], address derived. Older: [file, cat, n] / {file, cat, role, n}.
        if isinstance(entry, list) and len(entry) >= 3:
            fname = entry[0]
        elif isinstance(entry, dict):
            fname = entry.get("file") or chunk_name(key)
        else:
            fname = chunk_name(key)
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
    manifest = json.loads((fc_dir / "_index.json").read_text())
    out = {}
    for key, entry in (manifest.get("decks") or {}).items():
        if isinstance(entry, list):
            out[key] = entry[2] if len(entry) >= 3 else entry[1]
        else:
            out[key] = entry.get("n", 0)
    return out
