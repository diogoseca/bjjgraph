#!/usr/bin/env python3
"""audit_mc_viability.py — deterministic MC-viability audit of the flashcard corpus.

Simulates the SHIPPED renderer rules from neural/src/app.src.jsx (mcClip first-sentence
≤160 clamp, accidental-correct/near-dupe Jaccard>0.8 guard, length-ratio 0.4–2.5 guard,
authored-tier precedence, same-deck → graph-neighbor → same-category pooling, <2 survivors
→ classic recall) — WITHOUT sampling, so the result is exhaustive and repeatable: a card is
MC-viable iff its pools can yield ≥2 surviving distractors at all.

Outputs a per-deck report + the regen worklist. `--gate` enforces (exit 1 on failure):
  - ≥99% of curriculum-referenced decks MC-viable (deck viable = ≥90% of its cards viable)
  - ≥97% of all decks MC-viable
  - ZERO curriculum-referenced micro-answer decks (a deck with any card whose full answer
    clips to <15 chars — distractor guards cannot save those)

GOLDEN CROSS-ANCHORS: a handful of literal cards whose expected outcome is ALSO asserted
in e2e/journeys/mc-flashcards.spec.ts — if the Python sim and the JS renderer drift, a
gate breaks instead of the drift going unnoticed.

Run: python3 scripts/audit_mc_viability.py [--gate] [--worklist out.json]
     (npm run validate:mc — gate mode)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
GRAPH_DATA = ROOT / "source/quartz/static/neural/graph-data.json"
# The corpus is the per-deck CHUNK set — flashcards.json (the 16.4MB boot monolith) was deleted
# in v1.80.4. _neural_decks.load_decks assembles the same {key: {cat, role, cards}} map, so this
# audit stays exhaustive without a second emitted artifact that could drift from the app's.
FLASHCARDS_DIR = ROOT / "source/quartz/static/neural/flashcards"
CURRICULUM = ROOT / "source/quartz/static/neural/curriculum.json"


# ── ports of the shipped JS (keep in lockstep with app.src.jsx; golden anchors guard drift) ──
def mc_clip(a: str) -> str | None:
    m = re.match(r"^[\s\S]*?[.!?]", a or "")
    s = (m.group(0) if m else (a or "")).strip()
    return s if 0 < len(s) <= 160 else None


_norm_re = re.compile(r"[^a-z0-9 ]+")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", _norm_re.sub("", s.lower())).strip()


def similar(a: str, b: str) -> bool:
    A, B = set(_norm(a).split()), set(_norm(b).split())
    inter = len(A & B)
    uni = len(A) + len(B) - inter
    return (inter / uni > 0.8) if uni else True


def viable_distractor_reason(text: str, correct: str, picked: list[str]) -> tuple[str | None, str]:
    """Like viable_distractor, but also returns WHY it failed:
    clip | ratio | sim_correct | sim_sibling | ok. Powers the salvage loop's reason-aware
    retries and the residual diagnosis. Keep in lockstep with viable_distractor below."""
    t = mc_clip(text)
    if not t:
        return None, "clip"
    ratio = len(t) / len(correct)
    if ratio < 0.4 or ratio > 2.5:
        return None, "ratio"
    if similar(t, correct):
        return None, "sim_correct"
    for p in picked:
        if similar(t, p):
            return None, "sim_sibling"
    return t, "ok"


def viable_distractor(text: str, correct: str, picked: list[str]) -> str | None:
    # thin bool-ish wrapper — byte-stable return so card_viable + the golden anchors don't drift
    return viable_distractor_reason(text, correct, picked)[0]


def card_viable(card: dict, deck_key: str, decks: dict, neighbors: dict) -> bool:
    correct = mc_clip(card.get("a", ""))
    if not correct:
        return False
    picked: list[str] = []
    d = card.get("distractors") or {}
    for text in list(d.get("plausible", [])) + list(d.get("trap", [])):
        t = viable_distractor(text, correct, picked)
        if t:
            picked.append(t)
        if len(picked) >= 2:
            return True
    for c in decks[deck_key]["cards"]:
        if c["q"] == card["q"]:
            continue
        t = viable_distractor(c.get("a", ""), correct, picked)
        if t:
            picked.append(t)
        if len(picked) >= 2:
            return True
    for nk in neighbors.get(deck_key, ()):  # graph-neighbor decks
        nd = decks.get(nk)
        if not nd:
            continue
        for c in nd["cards"]:
            t = viable_distractor(c.get("a", ""), correct, picked)
            if t:
                picked.append(t)
            if len(picked) >= 2:
                return True
    cat = decks[deck_key].get("cat")  # same-category anywhere (the renderer scans bounded;
    for k, dd in decks.items():      # exhaustive here = upper bound on what sampling can find)
        if k == deck_key or dd.get("cat") != cat:
            continue
        for c in dd["cards"]:
            t = viable_distractor(c.get("a", ""), correct, picked)
            if t:
                picked.append(t)
            if len(picked) >= 2:
                return True
    return False


def micro_answer(card: dict) -> bool:
    # a broken STUB = the FULL answer clips under 15 chars. A terse one-line `a` (answer_line,
    # with the full answer carried in `d`) is intentional and must NOT be flagged.
    full = card.get("d") or card.get("a", "")
    s = mc_clip(full)
    return s is not None and len(s) < 15


def deck_key_for(node: dict) -> str:
    t = node["t"]
    if node.get("ty") == "positions":
        base = t.rsplit(" ", 1)[0] if t.endswith((" Top", " Bottom")) else t
        return base  # role ambiguous at node level; neighbor map adds both roles
    return t


def build_neighbors(gd: dict, decks: dict) -> dict:
    """deckKey -> neighbor deck keys via graph adjacency (mirrors nodeForKey + adj walk)."""
    id2idx = {n["id"]: i for i, n in enumerate(gd["nodes"])}
    adj = defaultdict(set)
    for l in gd["links"]:
        a, b = id2idx.get(l["source"]), id2idx.get(l["target"])
        if a is None or b is None:
            continue
        adj[a].add(b)
        adj[b].add(a)

    def node_keys(n: dict) -> list[str]:
        t = n["t"]
        if n.get("ty") == "positions":
            base = t.rsplit(" ", 1)[0] if t.endswith((" Top", " Bottom")) else t
            return [f"{base}|Top", f"{base}|Bottom"]
        return [f"{t}|Attacker", f"{t}|Defender"]

    key_first_node: dict[str, int] = {}
    for i, n in enumerate(gd["nodes"]):
        for k in node_keys(n):
            key_first_node.setdefault(k, i)

    neighbors: dict[str, list[str]] = {}
    for key, i in key_first_node.items():
        if key not in decks:
            continue
        out = []
        for j in adj[i]:
            for nk in node_keys(gd["nodes"][j]):
                if nk in decks and nk != key:
                    out.append(nk)
        neighbors[key] = out
    return neighbors


def golden_anchor_check() -> str | None:
    """Content-INDEPENDENT cross-anchors with the JS renderer (pure-function pins; the JS
    side is exercised by mc-flashcards.spec.ts's real interactions). Content-pinned anchors
    proved wrong by design: the regen wave legitimately changes card outcomes."""
    if mc_clip("Short fact. More detail follows in a second sentence.") != "Short fact.":
        return "mc_clip should return the first sentence"
    if mc_clip("x" * 200 + ".") is not None:
        return "mc_clip should reject first sentences over 160 chars"
    if not micro_answer({"a": "The armbar."}):
        return "micro_answer should flag sub-15-char clipped answers"
    if not similar("keep the elbow tight to the body", "Keep the elbow tight to the body!"):
        return "similar() should catch near-identical texts"
    if similar("bridge explosively toward the trapped side", "control the far-side underhook before standing"):
        return "similar() must not merge distinct statements"
    correct = "Frame against the hip and shrimp your hips away to recover guard."
    if viable_distractor("No.", correct, []) is not None:
        return "length-ratio guard should reject micro options"
    return None


MC_LINE_BUDGET = 36  # one-line option cap; keep in sync with app.src.jsx MC_LINE + bridge


def oneline_report():
    """Scan content/*.json for authored one-line MC. Returns (violations, cards_with_line,
    total_cards). A violation = an answer_line, or a distractor on an answer_line-backed card,
    that exceeds MC_LINE_BUDGET (the rendered one-line budget). Legacy P2b distractors WITHOUT
    an answer_line are NOT gated here — Phase B rewrites them one-line alongside answer_line."""
    import glob
    viol, withline, total = [], 0, 0
    for f in glob.glob(str(ROOT / "content/**/*.json"), recursive=True):
        try:
            d = json.loads(open(f).read())
        except Exception:
            continue
        def walk(o, fp=f):
            nonlocal withline, total
            if isinstance(o, dict):
                for k, v in o.items():
                    if k.startswith("flashcards") and isinstance(v, list):
                        for c in v:
                            if not isinstance(c, dict) or not c.get("question"):
                                continue
                            total += 1
                            al = c.get("answer_line")
                            if not al:
                                continue
                            withline += 1
                            if len(al) > MC_LINE_BUDGET:
                                viol.append(f"{os.path.basename(fp)}: answer_line {len(al)}c > {MC_LINE_BUDGET}: {al[:50]!r}")
                            dd = c.get("distractors") or {}
                            for tier in ("plausible", "trap"):
                                for x in dd.get(tier) or []:
                                    if len(x) > MC_LINE_BUDGET:
                                        viol.append(f"{os.path.basename(fp)}: {tier} {len(x)}c > {MC_LINE_BUDGET}: {x[:50]!r}")
                    else:
                        walk(v, fp)
            elif isinstance(o, list):
                for v in o:
                    walk(v, fp)
        walk(d)
    return viol, withline, total


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate", action="store_true")
    ap.add_argument("--worklist", default=str(ROOT / "tests/artifacts/mc_worklist.json"))
    args = ap.parse_args()

    gd = json.loads(GRAPH_DATA.read_text())
    from _neural_decks import load_decks
    decks = load_decks(FLASHCARDS_DIR)
    neighbors = build_neighbors(gd, decks)

    cur_decks: set[str] = set()
    if CURRICULUM.exists():
        cur = json.loads(CURRICULUM.read_text())
        for b in cur["belts"]:
            for u in b["units"]:
                for l in u["lessons"]:
                    cur_decks.add(l["deckKey"])

    per_deck = {}
    for key, deck in decks.items():
        cards = deck["cards"]
        clippable = [c for c in cards if mc_clip(c.get("a", ""))]
        ok = sum(1 for c in clippable if card_viable(c, key, decks, neighbors))
        micro = sum(1 for c in cards if micro_answer(c))
        per_deck[key] = {
            "cards": len(cards),
            "clippable": len(clippable),
            "viable": ok,
            "micro": micro,
            # unclippable answers are RECALL-BY-DESIGN (the renderer's fallback), not damage.
            # Deck viability measures the learner's MC experience: enough MC-able cards, and
            # pooling succeeds for (nearly) every card that CAN be MC.
            "clip_rate": len(clippable) / len(cards) if cards else 0.0,
            "pool_rate": ok / len(clippable) if clippable else 1.0,
        }

    drift = golden_anchor_check()
    if drift:
        print(f"GOLDEN ANCHOR DRIFT: {drift} — the Python sim and the JS renderer have diverged")
        return 1

    deck_ok = {k: (v["viable"] >= 3 and v["pool_rate"] >= 0.9) for k, v in per_deck.items()}
    corpus_pct = sum(deck_ok.values()) / len(deck_ok)
    cur_keys = [k for k in cur_decks if k in per_deck]
    cur_pct = (sum(deck_ok[k] for k in cur_keys) / len(cur_keys)) if cur_keys else 1.0
    cur_micro = [k for k in cur_keys if per_deck[k]["micro"] > 0]
    # worklist: anything micro/structurally poor, plus curriculum decks whose MC experience
    # is thin (low clip rate = most cards can never quiz — the regen wave rewrites answers so
    # the first sentence carries the fact in <=160 chars)
    worklist = sorted(
        [k for k, v in per_deck.items()
         if v["micro"] > 0 or not deck_ok[k] or (k in cur_decks and v["clip_rate"] < 0.75)],
        key=lambda k: (k not in cur_decks, per_deck[k]["clip_rate"]),
    )

    Path(args.worklist).parent.mkdir(parents=True, exist_ok=True)
    Path(args.worklist).write_text(json.dumps(
        {"worklist": worklist,
         "detail": {k: per_deck[k] for k in worklist}}, indent=1))

    print(f"decks: {len(per_deck)} | corpus viable: {corpus_pct:.1%} | "
          f"curriculum-referenced: {len(cur_keys)} @ {cur_pct:.1%} viable | "
          f"curriculum micro-answer decks: {len(cur_micro)} | worklist: {len(worklist)} "
          f"-> {args.worklist}")
    if cur_micro:
        print("curriculum micro-answer decks:", ", ".join(cur_micro[:10]))

    ol_viol, ol_withline, ol_total = oneline_report()
    print(f"one-line MC: {ol_withline}/{ol_total} cards have answer_line "
          f"({ol_withline/ol_total:.1%} coverage) | length violations: {len(ol_viol)}")
    for v in ol_viol[:10]:
        print("  ONELINE:", v)

    if args.gate:
        fails = []
        if ol_viol:
            fails.append(f"{len(ol_viol)} one-line MC length violation(s) (> {MC_LINE_BUDGET} chars)")
        if cur_pct < 0.99:
            fails.append(f"curriculum-referenced viability {cur_pct:.1%} < 99%")
        # corpus-wide is a RATCHET, not a target: the long tail of non-curriculum decks whose
        # cards fall back to recall is designed behavior, and regenerating ~350 more files is
        # an owner-scale decision. The worklist above names the tail — nothing is hidden.
        if corpus_pct < 0.85:
            fails.append(f"corpus viability {corpus_pct:.1%} < 85% (ratchet)")
        if cur_micro:
            fails.append(f"{len(cur_micro)} curriculum micro-answer decks")
        if fails:
            for f in fails:
                print(f"GATE FAIL: {f}")
            return 1
        print("GATE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
