#!/usr/bin/env python3
"""author_mc.py — Phase B: author ONE-LINE multiple-choice per flashcard, corpus-wide.

For every flashcard, produce (batched one Claude call per file, like the P2b wave):
  - answer_line : the single-line recall cue / correct MC option (<= MC_LINE_BUDGET chars)
  - distractors : {plausible:[2], trap:[1]} — one-line wrong options (<= budget each)
The full `answer` is PRESERVED untouched (static pages + the "More detail" tooltip use it).
Questions are returned verbatim (progress is keyed on the question hash).

Every field is verified against the shipped render rules (length <= budget, distractor ≠ answer,
length ratio, not near-dup) BEFORE writing; a card that fails verification keeps its originals.
Resumable (state in logs/mc_author/state.json). Curation-safe: the daily bot re-merges these
verbatim (restore_mc), so this is the single writer.

Usage:
  python3 scripts/author_mc.py [--curriculum-only] [--max-files N] [--file PATH]
                               [--model claude-fable-5] [--effort medium] [--dry-run]
Then: validate:json → regenerate:graph-base → regenerate:neural → validate:mc → e2e → commit.
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from audit_mc_viability import (  # noqa: E402
    MC_LINE_BUDGET,
    mc_clip,
    viable_distractor,
    viable_distractor_reason,
)
from claude_infer import call_claude  # noqa: E402

STATE_DIR = ROOT / "logs/mc_author"
CURRICULUM = ROOT / "source/public/static/neural/curriculum.json"

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
                "required": ["question", "answer_line", "plausible", "trap"],
                "properties": {
                    "question": {"type": "string"},
                    "answer_line": {"type": "string"},
                    "plausible": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2},
                    "trap": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 1},
                },
            },
        }
    },
}

PROMPT = """You are a BJJ instructional editor authoring MULTIPLE-CHOICE options for flashcards
in an interactive trainer. For EACH card below, given its question and full answer, produce a
tight 4-option multiple-choice set. The full answer stays as-is (shown as "more detail" after
the reveal) — you are only writing the short options.

Output per card:
- answer_line: the ONE correct answer as a terse cue, a phrase not a sentence, <= {budget}
  characters, no trailing period. It is the recall cue AND the correct choice. Capture the single
  most important point of the full answer (e.g. "Shrimp, frame, recover", "Kill the near
  underhook first"). It must be unambiguously correct and distinct from the wrong options.
- plausible (exactly 2): what a well-meaning beginner would pick — nearly right but subtly wrong
  (wrong order, wrong side, wrong priority, right idea/wrong detail). Same terse phrase style,
  <= {budget} chars each, no trailing period.
- trap (exactly 1): a believable but genuinely counterproductive choice that would get the
  player punished (gives up the back, gets stacked/passed, burns the grip). Terse, <= {budget}
  chars, no trailing period.

HARD RULES:
- Every option <= {budget} characters. Terse cues, not sentences. No trailing punctuation.
- The 3 wrong options must be clearly wrong to an expert yet tempting to a beginner; never
  accidentally correct, never a joke, never a near-duplicate of the correct one or each other.
- QUESTIONS MUST BE RETURNED EXACTLY AS GIVEN — byte-for-byte.

## Technique/position context
{context}

## Cards
{cards}
"""


def iter_flashcard_holders(obj):
    """Yield every (list) flashcards array in a content doc (root + roles + tiers)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.startswith("flashcards") and isinstance(v, list):
                yield v
            else:
                yield from iter_flashcard_holders(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_flashcard_holders(v)


def needs_authoring(card: dict) -> bool:
    """A card needs one-line MC if it lacks a within-budget answer_line + 3 within-budget
    distractors (idempotent: re-runs skip already-authored cards)."""
    al = card.get("answer_line")
    if not al or len(al) > MC_LINE_BUDGET:
        return True
    d = card.get("distractors") or {}
    opts = list(d.get("plausible") or []) + list(d.get("trap") or [])
    return len(opts) < 3 or any(len(x) > MC_LINE_BUDGET for x in opts)


def verify_reason(answer_line: str, plausible: list, trap: list, full_answer: str) -> tuple[bool, str]:
    """(ok, reason) where reason ∈ cue_empty | cue_len | distractor_empty | distractor_len |
    clip | ratio | sim_correct | sim_sibling | too_few | ok. Drives the salvage retry feedback
    and the residual diagnosis. Reuses the shipped guards (distractor ≠ answer, length ratio,
    not near-dup) vs the correct one-liner; clip is implicit (these are already one-line)."""
    al = (answer_line or "").strip()
    if not al:
        return False, "cue_empty"
    if len(al) > MC_LINE_BUDGET:
        return False, "cue_len"
    picked = []
    for t in list(plausible) + list(trap):
        t = (t or "").strip()
        if not t:
            return False, "distractor_empty"
        if len(t) > MC_LINE_BUDGET:
            return False, "distractor_len"
        v, why = viable_distractor_reason(t, al, picked)
        if not v:
            return False, why
        picked.append(v)
    return (True, "ok") if len(picked) >= 3 else (False, "too_few")


def verify(answer_line: str, plausible: list, trap: list, full_answer: str) -> bool:
    return verify_reason(answer_line, plausible, trap, full_answer)[0]


def process_file(path: str, model: str, effort: str, dry: bool) -> tuple[int, int]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    name = data.get("name") or Path(path).stem
    # collect the cards needing authoring (dedup by question)
    todo = {}
    for holder in iter_flashcard_holders(data):
        for c in holder:
            if isinstance(c, dict) and c.get("question") and c.get("answer") and needs_authoring(c):
                todo[c["question"]] = c["answer"]
    if not todo:
        return 0, 0
    cards_txt = json.dumps([{"question": q, "answer": a} for q, a in todo.items()],
                           indent=1, ensure_ascii=False)
    prompt = PROMPT.format(budget=MC_LINE_BUDGET, context=f"{name} ({Path(path).parent.name})",
                           cards=cards_txt)
    raw, err = call_claude(prompt, RESPONSE_SCHEMA, model, effort, timeout=1200)
    if err:
        print(f"  ERROR {path}: {err}")
        return 0, len(todo)
    out = json.loads(raw) if isinstance(raw, str) else raw
    fixes = {c["question"]: c for c in out.get("cards", []) if c.get("question") in todo}

    applied = skipped = 0
    for holder in iter_flashcard_holders(data):
        for c in holder:
            if not isinstance(c, dict):
                continue
            f = fixes.get(c.get("question"))
            if not f:
                continue
            if not verify(f.get("answer_line", ""), f.get("plausible", []), f.get("trap", []), c["answer"]):
                skipped += 1
                continue
            c["answer_line"] = f["answer_line"].strip()
            c["distractors"] = {
                "plausible": [x.strip() for x in f["plausible"]][:2],
                "trap": [x.strip() for x in f["trap"]][:1],
            }
            applied += 1
    if applied and not dry:
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return applied, skipped


def curriculum_files() -> set[str]:
    """Content files whose technique/position name backs a curriculum lesson deck."""
    names = set()
    if CURRICULUM.exists():
        cur = json.loads(CURRICULUM.read_text())
        for b in cur["belts"]:
            for u in b["units"]:
                for l in u["lessons"]:
                    names.add(l["deckKey"].split("|")[0])
    out = set()
    for f in glob.glob(str(ROOT / "content/**/*.json"), recursive=True):
        try:
            if json.loads(Path(f).read_text()).get("name") in names:
                out.add(f)
        except Exception:
            pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="claude-sonnet-5")
    ap.add_argument("--effort", default="medium")
    ap.add_argument("--curriculum-only", action="store_true")
    ap.add_argument("--max-files", type=int, default=0)
    ap.add_argument("--file", action="append", default=[])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--count-only", action="store_true")
    ap.add_argument("--shard", type=int, default=0, help="0-based shard index for parallel runs")
    ap.add_argument("--num-shards", type=int, default=1, help="total shards; each worker takes files[shard::num]")
    args = ap.parse_args()

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    # per-shard state file so parallel workers never race on one path
    state_path = STATE_DIR / ("state.json" if args.num_shards <= 1
                              else f"state-{args.shard}of{args.num_shards}.json")
    state = json.loads(state_path.read_text()) if state_path.exists() else {"done": []}
    done = set(state["done"])

    if args.file:
        files = args.file
    else:
        pool = curriculum_files() if args.curriculum_only else set(
            glob.glob(str(ROOT / "content/**/*.json"), recursive=True))
        # shard the STABLE sorted pool BEFORE filtering by done/needs_authoring — slicing the
        # filtered list would shift indices on resume and re-partition the corpus (gaps/overlap).
        candidates = sorted(pool)
        if args.num_shards > 1:
            candidates = candidates[args.shard :: args.num_shards]
        # only files that actually have a card needing authoring
        files = []
        for f in candidates:
            if f in done:
                continue
            try:
                d = json.loads(Path(f).read_text())
            except Exception:
                continue
            if any(needs_authoring(c) for h in iter_flashcard_holders(d) for c in h
                   if isinstance(c, dict) and c.get("question") and c.get("answer")):
                files.append(f)
    if args.max_files:
        files = files[: args.max_files]
    shard_tag = f"[shard {args.shard}/{args.num_shards}] " if args.num_shards > 1 else ""
    print(f"author_mc: {shard_tag}{len(files)} files to author (done so far: {len(done)}) "
          f"{'[curriculum-only] ' if args.curriculum_only else ''}budget={MC_LINE_BUDGET}")

    if args.count_only:
        cards = 0
        for f in files:
            try:
                d = json.loads(Path(f).read_text())
            except Exception:
                continue
            cards += sum(1 for h in iter_flashcard_holders(d) for c in h
                         if isinstance(c, dict) and c.get("question") and c.get("answer") and needs_authoring(c))
        print(f"  {len(files)} files, {cards} cards need one-line MC")
        return
    ta = ts = 0
    for i, f in enumerate(files):
        a, s = process_file(f, args.model, args.effort, args.dry_run)
        ta += a
        ts += s
        print(f"[{i+1}/{len(files)}] {Path(f).name}: +{a} authored, {s} skipped")
        if not args.dry_run:
            done.add(f)
            state["done"] = sorted(done)
            state_path.write_text(json.dumps(state, indent=1))
    print(f"DONE: {ta} cards authored, {ts} skipped. "
          f"Next: validate:json && regenerate:graph-base && regenerate:neural && validate:mc")


if __name__ == "__main__":
    main()
