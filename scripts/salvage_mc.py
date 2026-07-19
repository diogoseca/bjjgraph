#!/usr/bin/env python3
"""salvage_mc.py — Phase 1: rescue the flashcards the single-shot wave (author_mc.py) skipped.

The batch wave dropped a card whenever the model's first attempt didn't compress into a
<=36-char cue + 3 guard-clearing distractors. Diagnosis: 100% of the ~595 uncovered cards have
long (>160c) answers, 75% multi-step lists. This script fixes AUTHORING, not the guards:

  - ONE card per Claude call (no batch → no silent omission).
  - CATEGORY-AWARE prompt: list → cue = the single decisive step, distractors = the OTHER steps
    done in the wrong order/priority/side (naturally distinct words); prose → cue = the one
    decisive principle; yes/no → cue = the deciding mechanism, never "yes/no".
  - REASON-AWARE RETRY (<=3): on verify failure, re-prompt with the exact guard that tripped
    (cue too long, distractor too similar, wrong length ratio, ...).
  - SAFETY cards get a mandatory "never make a dangerous action the correct cue" instruction.
  - Same guards on write (unchanged; they mirror the renderer + golden anchors).

Curation-safe (restore_mc re-merges answer_line + distractors), resumable (per-shard state),
and shardable for parallel background runs. Whatever still fails after retries is logged to
logs/mc_salvage/reasons-*.json for the Phase-3 residual table.

Usage:
  python3 scripts/salvage_mc.py [--model claude-opus-4-8] [--effort high]
                                [--num-shards N --shard I] [--max-files N] [--file P] [--dry-run]
Then: validate:json && regenerate:graph-base && regenerate:neural && validate:mc && e2e && commit.
"""

from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from audit_mc_viability import MC_LINE_BUDGET  # noqa: E402
from author_mc import iter_flashcard_holders, needs_authoring, verify_reason  # noqa: E402
from claude_infer import call_claude  # noqa: E402

STATE_DIR = ROOT / "logs/mc_salvage"

RESPONSE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["answer_line", "plausible", "trap"],
    "properties": {
        "answer_line": {"type": "string"},
        "plausible": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2},
        "trap": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 1},
    },
}

_YESNO = re.compile(r"^\s*(should|is|are|do|does|did|can|could|will|would|has|have|was|were|must)\b", re.I)
_SEQ = re.compile(r"\b(first|second|third|then|next|finally|begin by|start by)\b", re.I)
_SAFETY = re.compile(
    r"\b(tap|taps?|tapping|injur\w*|safe\w*|danger\w*|\bpop\b|crank|release|snap\w*|"
    r"hyperextend\w*|pass out|choke out|black ?out|damage|protect)\b",
    re.I,
)


def categorize(question: str, answer: str) -> str:
    q, a = question or "", answer or ""
    if _YESNO.match(q):  # genuine either/or asks ("Should you X or Y?") also start with a yes/no verb
        return "yesno"
    if a.count(", ") >= 2 or "; " in a or " and then " in a.lower() or _SEQ.search(a) or re.search(r"\b[1-9]\.\s", a):
        return "list"
    return "prose"


def is_safety(question: str, answer: str) -> bool:
    return bool(_SAFETY.search(question or "") or _SAFETY.search(answer or ""))


_CAT_HINT = {
    "list": (
        "This answer is a MULTI-STEP sequence. Make the cue the SINGLE most decisive step "
        f"(<= {MC_LINE_BUDGET} chars). Build the 3 wrong options from the OTHER steps performed "
        "in the WRONG ORDER, WRONG PRIORITY, or WRONG SIDE — these naturally use different key "
        "words from the cue, so they won't read as rewordings of it."
    ),
    "prose": (
        f"Distill the answer to its ONE decisive principle for the cue (<= {MC_LINE_BUDGET} chars). "
        "The 3 wrong options are common MISAPPLICATIONS of that principle, worded with DIFFERENT "
        "key words from the cue."
    ),
    "yesno": (
        "Do NOT phrase the cue as yes/no. Make the cue the KEY MECHANISM or reason that decides "
        f"the answer (<= {MC_LINE_BUDGET} chars); the wrong options are plausible but wrong "
        "mechanisms a beginner might believe."
    ),
}
_SAFETY_HINT = (
    "\nSAFETY-CRITICAL card: the correct cue and every option must be factually safe. NEVER make "
    "a dangerous action the correct cue. The trap must be a REALISTIC unsafe temptation a beginner "
    "might try (never absurd), and nothing that would injure someone who mistook it for correct."
)
_REASON_MSG = {
    "cue_empty": "the cue was empty.",
    "cue_len": f"the cue exceeded {MC_LINE_BUDGET} characters — compress it much harder into a phrase.",
    "distractor_empty": "a wrong option was empty.",
    "distractor_len": f"a wrong option exceeded {MC_LINE_BUDGET} characters — make it terser.",
    "clip": "a wrong option wasn't a clean single phrase.",
    "ratio": "a wrong option's length was too different from the cue — keep the options close in length to the cue.",
    "sim_correct": "a wrong option shared too many words with the correct cue — use a DIFFERENT concept and different words.",
    "sim_sibling": "two wrong options were too similar to each other — make them clearly distinct.",
    "too_few": "there were not 3 usable distinct options — give 2 distinct plausible + 1 distinct trap, all different from the cue and each other.",
    "unparseable": "the response was not the required JSON object.",
}


def build_prompt(question: str, answer: str, cat: str, safety: bool, prev_reason: str, seed_note: str = "") -> str:
    p = f"""You are a BJJ instructional editor writing a ONE-LINE multiple-choice set for a single flashcard in an interactive trainer. The full answer stays as-is (shown as "more detail" after the reveal) — you only write the short options.

Output JSON: {{"answer_line": "...", "plausible": ["...", "..."], "trap": ["..."]}}
- answer_line: the correct answer as a terse cue, a phrase not a sentence, <= {MC_LINE_BUDGET} characters, no trailing period. It is BOTH the recall cue AND the correct choice; it must be unambiguously correct and capture the single most important point.
- plausible (exactly 2): what a well-meaning beginner would pick — nearly right but subtly wrong (wrong order, wrong side, wrong priority, right idea/wrong detail). <= {MC_LINE_BUDGET} chars each, no trailing period.
- trap (exactly 1): a believable but genuinely PUNISHING choice that gets the player hurt on the mat (gives up the back, gets stacked/passed/finished). <= {MC_LINE_BUDGET} chars, no trailing period.

HARD RULES:
- Every option <= {MC_LINE_BUDGET} characters. Terse cues, not sentences. No trailing punctuation.
- The 3 wrong options must be clearly wrong to an expert yet tempting to a beginner; never accidentally correct, never a near-duplicate of the correct one or of each other. Use DIFFERENT KEY WORDS from the correct answer — an option that merely rewords the cue is rejected as too similar.

{_CAT_HINT[cat]}{_SAFETY_HINT if safety else ""}

Question: {question}
Full answer: {answer}"""
    if prev_reason:
        p += (
            f"\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: {_REASON_MSG.get(prev_reason, 'it failed validation.')} "
            "Produce a corrected set that fixes exactly that while keeping every rule above."
        )
    if seed_note:
        p += f"\n\nEDITOR NOTE — a reviewer flagged the prior version; address this specifically: {seed_note}"
    return p


def _parse(raw):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        try:
            return json.loads(m.group(0)) if m else None
        except Exception:
            return None


def salvage_card(question, answer, cat, safety, model, effort, max_retries=3, seed_note=""):
    """Return (fields|None, final_reason, attempts). fields = {answer_line, distractors}."""
    prev = ""
    reason = "no_attempt"
    for attempt in range(1, max_retries + 1):
        raw, err = call_claude(build_prompt(question, answer, cat, safety, prev, seed_note),
                               RESPONSE_SCHEMA, model, effort, timeout=600)
        if err:
            reason = "claude_error"
            continue
        out = _parse(raw)
        if not isinstance(out, dict):
            reason = "unparseable"
            prev = "unparseable"
            continue
        al = (out.get("answer_line") or "").strip()
        pl = [(x or "").strip() for x in (out.get("plausible") or [])][:2]
        tr = [(x or "").strip() for x in (out.get("trap") or [])][:1]
        ok, reason = verify_reason(al, pl, tr, answer)
        if ok:
            return {"answer_line": al, "distractors": {"plausible": pl, "trap": tr}}, "ok", attempt
        prev = reason
    return None, reason, max_retries


def process_file(path, model, effort, dry, reasons):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    applied = failed = 0
    for holder in iter_flashcard_holders(data):
        for c in holder:
            if not (isinstance(c, dict) and c.get("question") and c.get("answer") and needs_authoring(c)):
                continue
            q, a = c["question"], c["answer"]
            cat, safety = categorize(q, a), is_safety(q, a)
            fields, reason, attempts = salvage_card(q, a, cat, safety, model, effort)
            key = f"{Path(path).name}::{q[:100]}"
            if fields:
                c["answer_line"] = fields["answer_line"]
                c["distractors"] = fields["distractors"]
                applied += 1
                reasons[key] = {"file": Path(path).name, "outcome": "authored",
                                "category": cat, "safety": safety, "attempts": attempts}
            else:
                failed += 1
                reasons[key] = {"file": Path(path).name, "outcome": "failed", "category": cat,
                                "safety": safety, "reason": reason, "attempts": attempts,
                                "question": q, "answer": a[:220]}
    if applied and not dry:
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return applied, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="claude-opus-4-8")
    ap.add_argument("--effort", default="high")
    ap.add_argument("--max-files", type=int, default=0)
    ap.add_argument("--file", action="append", default=[])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--count-only", action="store_true")
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--num-shards", type=int, default=1)
    args = ap.parse_args()

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tag = "" if args.num_shards <= 1 else f"-{args.shard}of{args.num_shards}"
    state_path = STATE_DIR / f"state{tag}.json"
    reasons_path = STATE_DIR / f"reasons{tag}.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"done": []}
    reasons = json.loads(reasons_path.read_text()) if reasons_path.exists() else {}
    done = set(state["done"])

    if args.file:
        files = args.file
    else:
        # shard the STABLE sorted pool BEFORE filtering (resume-stable, gap-free/overlap-free)
        candidates = sorted(glob.glob(str(ROOT / "content/**/*.json"), recursive=True))
        if args.num_shards > 1:
            candidates = candidates[args.shard :: args.num_shards]
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
    if args.count_only:
        cards = sum(1 for f in files for d in [json.loads(Path(f).read_text())]
                    for h in iter_flashcard_holders(d) for c in h
                    if isinstance(c, dict) and c.get("question") and c.get("answer") and needs_authoring(c))
        print(f"salvage_mc: {shard_tag}{len(files)} files, {cards} uncovered cards to rescue")
        return
    print(f"salvage_mc: {shard_tag}{len(files)} files (done {len(done)}) model={args.model} effort={args.effort}")

    ta = tf = 0
    for i, f in enumerate(files):
        a, fl = process_file(f, args.model, args.effort, args.dry_run, reasons)
        ta += a
        tf += fl
        print(f"[{i+1}/{len(files)}] {shard_tag}{Path(f).name}: +{a} rescued, {fl} still failing")
        if not args.dry_run:
            done.add(f)
            state["done"] = sorted(done)
            state_path.write_text(json.dumps(state, indent=1))
            reasons_path.write_text(json.dumps(reasons, indent=1, ensure_ascii=False))
    print(f"DONE: {shard_tag}{ta} rescued, {tf} still failing → {reasons_path.name}")


if __name__ == "__main__":
    main()
