#!/usr/bin/env python3
"""regen_mc_answers.py — the P2b targeted fix wave: rewrite flashcard ANSWERS so the first
sentence carries the key fact in ≤150 chars (MC-clippable), and author the owner's graded
distractor tiers (plausible = nearly-right beginner beliefs, trap = dangerous misconceptions).

QUESTIONS ARE PRESERVED VERBATIM — the per-card MC stage is keyed on the question hash, so an
answers-only rewrite never resets anyone's progress.

Scope comes from the live audit (scripts/audit_mc_viability.py): failing cards are mapped to
their SOURCE content files (tier-blended cards live in hub files — fixing one file heals every
deck that blends it). Every rewritten card is verified locally against the shipped clip/guard
rules before it is written; a card that fails verification keeps its original text.

Usage:
  python3 scripts/regen_mc_answers.py [--max-files N] [--file content/...json]
                                      [--model claude-fable-5] [--effort medium] [--dry-run]
Resumable: state in logs/mc_regen/state.json (gitignored).
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from audit_mc_viability import build_neighbors, mc_clip, micro_answer, viable_distractor  # noqa: E402
from claude_infer import call_claude  # noqa: E402

STATE_DIR = ROOT / "logs/mc_regen"
FLASHCARDS = ROOT / "source/quartz/static/neural/flashcards.json"
GRAPH_DATA = ROOT / "source/quartz/static/neural/graph-data.json"
CURRICULUM = ROOT / "source/quartz/static/neural/curriculum.json"

RESPONSE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["cards"],
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question", "answer", "distractors"],
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                    "distractors": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["plausible", "trap"],
                        "properties": {
                            "plausible": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 2},
                            "trap": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 1},
                        },
                    },
                },
            },
        }
    },
}

PROMPT = """You are a BJJ instructional editor making flashcards MULTIPLE-CHOICE capable for an
interactive learning app. For each card below, rewrite the ANSWER and author graded wrong
options. Rules:

ANSWER rewrite:
- Sentence 1 must be a COMPLETE, standalone statement of the key fact, 60-150 characters.
  It will be shown alone as a quiz option, so it must make sense out of context.
- Keep the original answer's depth: elaboration, details and caveats go in sentences 2+.
  Preserve ALL technical content and any safety warnings — reorganize, never dumb down.
- Never merely truncate: recompose so sentence 1 carries the point.

GRADED WRONG OPTIONS (the app shows these beside the correct first sentence):
- "plausible" (1-2): what a well-meaning beginner would believe — nearly right, subtly wrong
  (wrong order, wrong side, wrong priority). Same register and similar length as sentence 1.
- "trap" (exactly 1): a genuinely counterproductive belief that gets the player punished
  (gives up the back, gets stacked, burns grips). Must still sound believable.
- Each option: one sentence, 40-160 characters, ending with a period. Never accidentally
  true, never a joke.

QUESTIONS MUST BE RETURNED EXACTLY AS GIVEN — byte-for-byte (progress is keyed on them).

## Technique/position context
{context}

## Cards to fix
{cards}
"""


def load_targets():
    """Re-derive failing cards from the LIVE payloads and map them to source files."""
    fc = json.loads(FLASHCARDS.read_text())
    decks = fc["decks"] if "decks" in fc else fc
    gd = json.loads(GRAPH_DATA.read_text())
    neighbors = build_neighbors(gd, decks)

    cur_decks = set()
    if CURRICULUM.exists():
        cur = json.loads(CURRICULUM.read_text())
        for b in cur["belts"]:
            for u in b["units"]:
                for l in u["lessons"]:
                    cur_decks.add(l["deckKey"])

    # wave scope: curriculum decks with thin clip rates + micro decks anywhere
    wave_decks = []
    for key, deck in decks.items():
        cards = deck["cards"]
        clippable = sum(1 for c in cards if mc_clip(c.get("a", "")))
        micro = any(micro_answer(c) for c in cards)
        clip_rate = clippable / len(cards) if cards else 1.0
        if micro or (key in cur_decks and clip_rate < 0.75):
            wave_decks.append(key)

    failing = {}
    for key in wave_decks:
        for c in decks[key]["cards"]:
            if not mc_clip(c.get("a", "")) or micro_answer(c):
                failing[c["q"]] = c["a"]

    q2file = {}
    for f in glob.glob(str(ROOT / "content/**/*.json"), recursive=True):
        try:
            txt = Path(f).read_text(encoding="utf-8")
        except Exception:
            continue
        for q in failing:
            if q not in q2file and json.dumps(q, ensure_ascii=False)[1:-1] in txt:
                q2file[q] = f
    by_file: dict[str, list[str]] = {}
    for q, f in q2file.items():
        by_file.setdefault(f, []).append(q)
    return by_file, failing


def walk_flashcards(obj, fn):
    """Apply fn(card) to every flashcard-shaped dict in a content JSON."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.startswith("flashcards") and isinstance(v, list):
                for card in v:
                    if isinstance(card, dict) and "question" in card and "answer" in card:
                        fn(card)
            else:
                walk_flashcards(v, fn)
    elif isinstance(obj, list):
        for v in obj:
            walk_flashcards(v, fn)


def verify(answer: str, distractors: dict) -> bool:
    correct = mc_clip(answer)
    if not correct or len(correct) < 15:
        return False
    picked = []
    for t in list(distractors.get("plausible", [])) + list(distractors.get("trap", [])):
        v = viable_distractor(t, correct, picked)
        if v:
            picked.append(v)
    return len(picked) >= 2


def process_file(path: str, questions: list[str], failing: dict, model: str, effort: str,
                 dry: bool) -> tuple[int, int]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    name = data.get("name") or Path(path).stem
    cards_txt = json.dumps(
        [{"question": q, "current_answer": failing[q]} for q in questions],
        indent=1, ensure_ascii=False)
    prompt = PROMPT.format(context=f"{name} ({Path(path).parent.name})", cards=cards_txt)
    raw, err = call_claude(prompt, RESPONSE_SCHEMA, model, effort, timeout=900)
    if err:
        print(f"  ERROR {path}: {err}")
        return 0, len(questions)
    out = json.loads(raw) if isinstance(raw, str) else raw
    fixes = {c["question"]: c for c in out.get("cards", []) if c.get("question") in set(questions)}

    applied = 0
    skipped = 0
    def fix(card):
        nonlocal applied, skipped
        q = card.get("question")
        if q not in fixes:
            return
        f = fixes.pop(q)
        if not verify(f["answer"], f.get("distractors") or {}):
            print(f"  SKIP (verify) {q[:60]!r}")
            skipped += 1
            return
        card["answer"] = f["answer"]
        card["distractors"] = {
            "plausible": list((f.get("distractors") or {}).get("plausible", []))[:2],
            "trap": list((f.get("distractors") or {}).get("trap", []))[:1],
        }
        applied += 1

    walk_flashcards(data, fix)
    if applied and not dry:
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return applied, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="claude-fable-5")
    ap.add_argument("--effort", default="medium")
    ap.add_argument("--max-files", type=int, default=0)
    ap.add_argument("--file", action="append", default=[])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_path = STATE_DIR / "state.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"done": []}

    by_file, failing = load_targets()
    files = args.file or sorted(by_file, key=lambda f: -len(by_file[f]))
    files = [f for f in files if f in by_file and f not in state["done"]]
    if args.max_files:
        files = files[: args.max_files]
    print(f"wave: {len(files)} files, {sum(len(by_file[f]) for f in files)} cards "
          f"({len(state['done'])} files already done)")

    total_a = total_s = 0
    for i, f in enumerate(files):
        print(f"[{i + 1}/{len(files)}] {f} ({len(by_file[f])} cards)")
        a, sk = process_file(f, by_file[f], failing, args.model, args.effort, args.dry_run)
        total_a += a
        total_s += sk
        if not args.dry_run:
            state["done"].append(f)
            state_path.write_text(json.dumps(state, indent=1))
    print(f"applied {total_a}, skipped {total_s}. Next: npm run validate:json && "
          f"npm run regenerate:neural && python3 scripts/audit_mc_viability.py --gate")


if __name__ == "__main__":
    main()
