#!/usr/bin/env python3
"""fix_residuals.py — Phase-3 SURGICAL pass over the review residuals (owner-approved scope).

Targets, from tests/artifacts/mc_residuals.json (the v1.67.1 weak-after-fix snapshot):
  - sev == "safety"                                  (all safety-flavored residuals)
  - sev == "broken" whose POST-FIX critique tail still mentions a correctness risk
  - entries whose re-review call failed (transients)

Per card: re-author via salvage_card() SEEDED with the post-fix critique tail → shipped-guard
verify → apply → batched re-review at the card's tier (safety→xhigh else high); only an "ok"
verdict counts as closed. Anything still weak stays as-is and is logged for the next residual
snapshot — never silently blessed. Resumable per shard; same fail-fast quota behavior as
review_mc (a failed call leaves the card un-done).

Usage:
  python3 scripts/fix_residuals.py [--model MODEL] [--num-shards N --shard I]
                                   [--max-cards N] [--count-only] [--dry-run]
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
from author_mc import iter_flashcard_holders  # noqa: E402
from review_mc import is_authored, is_safety_critical, review_batch  # noqa: E402
from salvage_mc import categorize, is_safety, salvage_card  # noqa: E402
from _model import model as _model_tier  # noqa: E402 — single source of truth: models.env

RESIDUALS = ROOT / "tests/artifacts/mc_residuals.json"
STATE_DIR = ROOT / "logs/mc_fix_residuals"

_CORRECTNESS = re.compile(
    r"accidentall?y.{0,12}correct|is (actually |in fact )?correct|also correct|near.?correct|"
    r"risks being (accepted as )?correct|blurs? the (cue|single)",
    re.I,
)


def targets() -> list[dict]:
    res = json.load(open(RESIDUALS))
    out = []
    for e in res:
        reasons = e.get("reasons", [])
        tail = " ; ".join(reasons[-2:])
        take = (
            e.get("sev") == "safety"
            or (e.get("sev") == "broken" and _CORRECTNESS.search(tail))
            or "re-review call failed" in " ; ".join(reasons)
        )
        if take and e.get("question"):
            out.append({"file": e.get("file", ""), "question": e["question"],
                        "seed": tail or " ; ".join(reasons[-1:]) or "reviewer flagged this card"})
    # dedup (file, question)
    seen, uniq = set(), []
    for t in out:
        k = (t["file"], t["question"][:100])
        if k not in seen:
            seen.add(k)
            uniq.append(t)
    return uniq


_DOCS: dict[str, dict] = {}  # path -> loaded doc, SHARED across cards of the same file so
#                              multi-card fixes in one file never clobber each other


def locate(file_basename: str, question: str):
    """Resolve (basename, question) -> (path, card_dict). Basenames collide across categories;
    the question text disambiguates. Docs are cached + shared."""
    for p in glob.glob(str(ROOT / "content" / "**" / file_basename), recursive=True):
        d = _DOCS.get(p)
        if d is None:
            try:
                d = json.loads(Path(p).read_text())
            except Exception:
                continue
            _DOCS[p] = d
        for h in iter_flashcard_holders(d):
            for c in h:
                if isinstance(c, dict) and c.get("question") == question and is_authored(c):
                    return p, c
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=_model_tier())
    ap.add_argument("--max-cards", type=int, default=0)
    ap.add_argument("--count-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--num-shards", type=int, default=1)
    args = ap.parse_args()

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tag = "" if args.num_shards <= 1 else f"-{args.shard}of{args.num_shards}"
    state_path = STATE_DIR / f"state{tag}.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"done": [], "closed": 0, "still_weak": 0}
    done = set(tuple(x) for x in state["done"])

    all_t = targets()
    if args.num_shards > 1:
        all_t = all_t[args.shard :: args.num_shards]
    todo = [t for t in all_t if (t["file"], t["question"][:100]) not in done]
    if args.max_cards:
        todo = todo[: args.max_cards]
    shard_tag = f"[shard {args.shard}/{args.num_shards}] " if args.num_shards > 1 else ""
    print(f"fix_residuals: {shard_tag}{len(todo)} target cards (done {len(done)}) model={args.model}")
    if args.count_only:
        return

    closed = still = missing = 0
    pending = []  # (path, card, old_fields, tier, key) awaiting batched re-review
    def flush():
        nonlocal closed, still
        if not pending:
            return
        touched = set()
        for eff in sorted({t for _, _, _, t, _k in pending}):
            grp = [p for p in pending if p[3] == eff]
            rv = review_batch([c for _, c, _, _, _ in grp], args.model, eff)
            for lid, (path, c, old, _t, key) in enumerate(grp):
                v = rv.get(lid, {"verdict": "weak"}) if rv is not None else {"verdict": "weak"}
                if v.get("verdict") == "ok":
                    closed += 1
                    touched.add(path)
                else:
                    # restore the pre-fix values in the SHARED doc — stays for the next snapshot
                    c["answer_line"], c["distractors"] = old
                    still += 1
                done.add(key)
        if not args.dry_run:
            for p in touched:
                Path(p).write_text(json.dumps(_DOCS[p], indent=2, ensure_ascii=False) + "\n",
                                   encoding="utf-8")
            state["done"] = sorted(list(done))
            state_path.write_text(json.dumps(state, indent=1))
        pending.clear()

    for i, t in enumerate(todo):
        path, card = locate(t["file"], t["question"])
        key = [t["file"], t["question"][:100]]
        tkey = tuple(key)
        if not card:
            missing += 1
            done.add(tkey)
            continue
        q, a = card["question"], card["answer"]
        tier = "xhigh" if is_safety_critical(q, a) else "high"
        fields, reason, _att = salvage_card(q, a, categorize(q, a), is_safety(q, a),
                                            args.model, tier, seed_note=t["seed"])
        if not fields:
            still += 1
            done.add(tkey)
            print(f"[{i+1}/{len(todo)}] {shard_tag}{t['file']}: salvage failed ({reason})")
            continue
        old = (card.get("answer_line"), card.get("distractors"))
        card["answer_line"] = fields["answer_line"]
        card["distractors"] = fields["distractors"]
        pending.append((path, card, old, tier, tkey))
        if len(pending) >= 16:
            flush()
            print(f"[{i+1}/{len(todo)}] {shard_tag}closed={closed} still_weak={still} missing={missing}")
    flush()
    if not args.dry_run:
        state["done"] = sorted(list(done))
        state_path.write_text(json.dumps(state, indent=1))
    print(f"DONE: {shard_tag}closed={closed} still_weak={still} missing={missing} "
          f"→ regate (validate:json/regen/validate:mc/e2e) then commit")


if __name__ == "__main__":
    main()
