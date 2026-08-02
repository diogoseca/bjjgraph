#!/usr/bin/env python3
"""review_mc.py — Phase 2: adversarial Opus curation of authored one-line MC cards.

A skeptical head-instructor pass over ALREADY-AUTHORED cards. The structural guards can't catch
a cue that's ambiguous, a distractor that's accidentally correct, or a "trap" that isn't
punishing (e.g. the slug cues that passed the guards but read as jargon). For each card it judges:
  1. cue unambiguously the single best answer?  2. both plausible options wrong-but-tempting and
  NOT accidentally correct?  3. trap genuinely punishing?  4. cue natural prose (not slug)?
  5. any factual/safety error?
Weak cards are fixed — apply the reviewer's rewrite if it clears the guards, else re-author via
salvage_card() seeded with the critique — then RE-REVIEWED once; anything still weak is logged
for the Phase-3 residual table. Reviews are BATCHED for throughput; fixes are per-card.

Target (high-stakes first): curriculum decks ∪ Submissions/** ∪ every file with a safety card.

Usage:
  python3 scripts/review_mc.py [--model claude-opus-4-8] [--effort high] [--batch-size 6]
                               [--num-shards N --shard I] [--max-files N] [--file P] [--dry-run]
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
from author_mc import curriculum_files, iter_flashcard_holders, verify_reason  # noqa: E402
from claude_infer import call_claude  # noqa: E402
from salvage_mc import categorize, is_safety, salvage_card  # noqa: E402

STATE_DIR = ROOT / "logs/mc_review"

REVIEW_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["cards"],
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "verdict", "reasons"],
                "properties": {
                    "id": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["ok", "weak"]},
                    "reasons": {"type": "array", "items": {"type": "string"}},
                    "suggested_rewrite": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["answer_line", "plausible", "trap"],
                        "properties": {
                            "answer_line": {"type": "string"},
                            "plausible": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2},
                            "trap": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 1},
                        },
                    },
                },
            },
        }
    },
}

PROMPT_HEAD = """You are a demanding BJJ head instructor auditing multiple-choice flashcards for a trainer. Be SKEPTICAL — flag a card WEAK unless it is clearly excellent.

For EACH card you are given its question, the full answer (GROUND TRUTH), and the current 4-option MC (1 correct cue + 2 plausible-wrong + 1 trap). Judge:
1. Is the CUE unambiguously the single best/correct answer per the full answer? (weak if ambiguous, partially wrong, or not the key point)
2. Are BOTH plausible options wrong-but-tempting to a beginner and NOT accidentally correct? (weak if any is actually correct, or is obviously wrong / silly)
3. Is the TRAP genuinely PUNISHING — gives up position, gets finished/passed/hurt — not merely suboptimal? (weak if it isn't really a trap)
4. Is the cue natural PROSE, not internal slug/jargon like "Ashi Garami/Top"? (weak if slug)
5. Any FACTUAL or SAFETY error in any option? (weak; critical for safety cards)

For EVERY card output {id, verdict:"ok"|"weak", reasons:[short strings]}. If weak, ALSO include suggested_rewrite {answer_line, plausible[2], trap[1]} that fixes the issues and obeys: every option <= 36 characters, a terse phrase, no trailing period, wrong options use DIFFERENT key words from the cue and are never accidentally correct.

## Cards
"""


def is_authored(c) -> bool:
    if not (isinstance(c, dict) and c.get("question") and c.get("answer") and (c.get("answer_line") or "").strip()):
        return False
    d = c.get("distractors") or {}
    return len(d.get("plausible") or []) >= 2 and len(d.get("trap") or []) >= 1


def _card_block(i: int, c: dict) -> str:
    d = c["distractors"]
    return (f'#{i}\nQ: {c["question"]}\nFull answer: {c["answer"][:400]}\n'
            f'  cue: {c["answer_line"]}\n  plausible: {" | ".join(d["plausible"])}\n  trap: {d["trap"][0]}')


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


def review_batch(cards: list, model: str, effort: str) -> dict | None:
    """Return {local_id: verdict_dict}, or None on a FAILED call. None must never be
    treated as 'all ok' — under a quota wall that would silently pass unreviewed cards."""
    prompt = PROMPT_HEAD + "\n\n".join(_card_block(i, c) for i, c in enumerate(cards))
    raw, err = call_claude(prompt, REVIEW_SCHEMA, model, effort, timeout=900)
    if err:
        return None
    out = _parse(raw)
    if not isinstance(out, dict):
        return None
    return {v["id"]: v for v in out.get("cards", []) if isinstance(v, dict) and "id" in v}


def _apply_rewrite(c: dict, rw: dict, answer: str) -> bool:
    ral = (rw.get("answer_line") or "").strip()
    rpl = [(x or "").strip() for x in (rw.get("plausible") or [])][:2]
    rtr = [(x or "").strip() for x in (rw.get("trap") or [])][:1]
    if verify_reason(ral, rpl, rtr, answer)[0]:
        c["answer_line"] = ral
        c["distractors"] = {"plausible": rpl, "trap": rtr}
        return True
    return False


def process_file(path, model, effort, batch_size, dry, report, only_questions=None):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    cards = [c for h in iter_flashcard_holders(data) for c in h
             if is_authored(c) and (only_questions is None or c.get("question") in only_questions)]
    if not cards:
        return 0, 0, 0
    # report keys are repo-relative (basenames collide across categories — many
    # "from Side Control.json"); reprocessing a file clears its stale entries first
    # (both new-style relpath keys and legacy basename keys matching this file's questions)
    relkey = str(Path(path).resolve().relative_to(ROOT))
    qset = {c["question"][:100] for c in cards}
    for k in [k for k, v in list(report.items())
              if k.startswith(relkey + "::")
              or (v.get("file") == Path(path).name and k.split("::", 1)[-1] in qset)]:
        del report[k]

    reviewed = weak = fixed = 0
    changed = False
    # 1) review every card (batched), TIERED: safety-critical cards get xhigh scrutiny
    #    (the effort A/B showed safety-card ambiguity is what higher effort uniquely catches);
    #    everything else runs at the base effort. A failed call fails the FILE (stays un-done,
    #    re-runs on resume) — never silently 'ok'.
    tier = {i: ("xhigh" if is_safety_critical(c.get("question", ""), c.get("answer", "")) else effort)
            for i, c in enumerate(cards)}
    verdicts = {}
    for eff in sorted(set(tier.values())):
        idxs = [i for i in range(len(cards)) if tier[i] == eff]
        for s in range(0, len(idxs), batch_size):
            chunk_idx = idxs[s : s + batch_size]
            batch = [cards[i] for i in chunk_idx]
            vr = review_batch(batch, model, eff)
            if vr is None:
                raise RuntimeError(f"review call failed ({eff} tier, {len(batch)} cards)")
            reviewed += len(batch)
            for lid, gi in enumerate(chunk_idx):
                verdicts[gi] = vr.get(lid, {"verdict": "ok", "reasons": []})
    # 2) fix each weak card in place (reviewer rewrite if it clears the guards, else re-author
    #    at the card's tier)
    to_recheck = []  # (card, orig_reasons, key, tier)
    for gi, c in enumerate(cards):
        v = verdicts.get(gi, {})
        if v.get("verdict") != "weak":
            continue
        weak += 1
        q, a = c["question"], c["answer"]
        key = f"{relkey}::{q[:100]}"
        applied = False
        rw = v.get("suggested_rewrite")
        if rw and _apply_rewrite(c, rw, a):
            applied = True
        if not applied:
            note = " ; ".join(v.get("reasons", [])[:3])
            fields, _, _ = salvage_card(q, a, categorize(q, a), is_safety(q, a), model, tier[gi], seed_note=note)
            if fields:
                c["answer_line"] = fields["answer_line"]
                c["distractors"] = fields["distractors"]
                applied = True
        if not applied:
            report[key] = {"file": Path(path).name, "outcome": "weak_unfixable",
                           "reasons": v.get("reasons", []), "question": q, "answer": a[:220]}
            continue
        changed = True
        to_recheck.append((c, v.get("reasons", []), key, tier[gi]))
    # 3) re-review the fixed cards (batched per tier) — confirm the fix actually resolved the
    #    critique. A failed re-review call lands the chunk in weak_after_fix (never silent-pass).
    for eff in sorted({t for _, _, _, t in to_recheck}):
        group = [x for x in to_recheck if x[3] == eff]
        for s in range(0, len(group), batch_size):
            chunk = group[s : s + batch_size]
            rv = review_batch([c for c, _, _, _ in chunk], model, eff)
            if rv is None:
                for c, orig, key, _t in chunk:
                    report[key] = {"file": Path(path).name, "outcome": "weak_after_fix",
                                   "reasons": orig + ["re-review call failed"],
                                   "question": c["question"], "answer": c["answer"][:220]}
                continue
            for lid, (c, orig, key, _t) in enumerate(chunk):
                if rv.get(lid, {"verdict": "ok"}).get("verdict") == "ok":
                    fixed += 1
                    report[key] = {"file": Path(path).name, "outcome": "fixed", "was": orig}
                else:
                    report[key] = {"file": Path(path).name, "outcome": "weak_after_fix",
                                   "reasons": orig + rv.get(lid, {}).get("reasons", []),
                                   "question": c["question"], "answer": c["answer"][:220]}
    if changed and not dry:
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return reviewed, weak, fixed


# tighter than salvage's is_safety (which also matches "protect"/"safe"): genuine danger cues,
# used to pick which cards in NON-curriculum/-submission files still warrant a review now.
_CRIT = re.compile(
    r"\b(tap|taps|tapping|injur\w*|\bpop\b|snap\w*|crank|hyperextend\w*|pass out|choke out|"
    r"black ?out|dislocat\w*|blackout)\b",
    re.I,
)


def is_safety_critical(question: str, answer: str) -> bool:
    return bool(_CRIT.search((question or "") + " " + (answer or "")))


def build_worklist() -> list:
    """[(file, only_questions|None)] — high-stakes scope. Full review (only_questions=None) for
    curriculum ∪ submissions; ONLY the safety-critical cards for any other file. Each file appears
    once (full-review files are excluded from the safety sweep). Full-corpus review is Phase 5."""
    full = set(curriculum_files()) | set(glob.glob(str(ROOT / "content/Submissions/**/*.json"), recursive=True))
    work = [(f, None) for f in full]
    for f in glob.glob(str(ROOT / "content/**/*.json"), recursive=True):
        if f in full:
            continue
        try:
            d = json.loads(Path(f).read_text())
        except Exception:
            continue
        qs = sorted({c["question"] for h in iter_flashcard_holders(d) for c in h
                     if is_authored(c) and is_safety_critical(c.get("question", ""), c.get("answer", ""))})
        if qs:
            work.append((f, qs))
    return work


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="claude-opus-5")
    ap.add_argument("--effort", default="high")
    ap.add_argument("--batch-size", type=int, default=6)
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
    report_path = STATE_DIR / f"report{tag}.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"done": []}
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    done = set(state["done"])

    if args.file:
        work = [(f, None) for f in args.file]
    else:
        work = sorted(build_worklist(), key=lambda t: t[0])
        if args.num_shards > 1:
            work = work[args.shard :: args.num_shards]
        work = [(f, oq) for (f, oq) in work if f not in done]
    if args.max_files:
        work = work[: args.max_files]

    shard_tag = f"[shard {args.shard}/{args.num_shards}] " if args.num_shards > 1 else ""
    if args.count_only:
        cards = 0
        for f, oq in work:
            try:
                d = json.loads(Path(f).read_text())
            except Exception:
                continue
            oqset = set(oq) if oq else None
            cards += sum(1 for h in iter_flashcard_holders(d) for c in h
                         if is_authored(c) and (oqset is None or c.get("question") in oqset))
        print(f"review_mc: {shard_tag}{len(work)} files, {cards} authored cards to review")
        return
    print(f"review_mc: {shard_tag}{len(work)} files (done {len(done)}) model={args.model} batch={args.batch_size}")

    tr = tw = tf = 0
    for i, (f, oq) in enumerate(work):
        try:
            r, w, fx = process_file(f, args.model, args.effort, args.batch_size, args.dry_run, report,
                                    only_questions=(set(oq) if oq else None))
        except Exception as e:
            # file stays OUT of `done` → re-runs on resume; keep going with the rest
            print(f"[{i+1}/{len(work)}] {shard_tag}{Path(f).name}: ERROR ({e}) — not marked done")
            continue
        tr += r
        tw += w
        tf += fx
        print(f"[{i+1}/{len(work)}] {shard_tag}{Path(f).name}: {r} reviewed, {w} weak, {fx} fixed")
        if not args.dry_run:
            done.add(f)
            state["done"] = sorted(done)
            state_path.write_text(json.dumps(state, indent=1))
            report_path.write_text(json.dumps(report, indent=1, ensure_ascii=False))
    print(f"DONE: {shard_tag}{tr} reviewed, {tw} weak, {tf} fixed → {report_path.name}")


if __name__ == "__main__":
    main()
