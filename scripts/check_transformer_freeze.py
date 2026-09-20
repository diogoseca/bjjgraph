#!/usr/bin/env python3
"""Byte-freeze the markdown pipeline for phases P1-P4 of the Quartz replacement.

WHAT THIS IS NOT. It is not `check_build_fingerprint.py` (stream V's, which censuses the BUILT
site), it is not `emit_diff.py` (V's, which diffs emitted bytes against the golden), and it is not
a parity gate. Those all answer "did the OUTPUT change". This answers a narrower and earlier
question: **did the SOURCE of the markdown pipeline change at all**, and if so, did somebody say
why.

WHY IT EXISTS (D-27). Stream A measured that its whole surface is already decoupled from the
engine being replaced: 64 import statements across the 12 owned files, 30 of them relative,
resolving to 19 distinct internal targets, and NOT ONE inside `build.ts`, `worker.ts`,
`depgraph.ts`, `processors/`, `cli/` or `plugins/emitters/`. So stream A is a RE-HOST, not a
rewrite, and under D-03 the correct number of behavioural changes to these files during P1-P4 is
ZERO. That inverts the risk: the danger is no longer "can we reimplement 1,576 lines correctly",
it is "somebody helpfully tidies one of them". A drive-by cleanup and a migration defect are
indistinguishable once the differ is 4,600 files wide, and this gate is what tells them apart at
the moment the edit lands rather than two days later.

  Recompute the decoupling claim:
    cd source/quartz && grep -nE 'require\\(|import\\(' plugins/transformers/*.ts plugins/filters/*.ts
    # 1 hit, and it is a browser-bound CDN import inside a template string (ofm.ts:751)

HOW IT MOVES. Never automatically, and never by itself — the same rule as `payload_policy.json`'s
bands and `check_payload_budget.py`'s tier-0 floors, and for the same reason: a self-advancing
baseline is a check that never runs. A legitimate change is accepted one file at a time, with a
written reason that lands in the baseline and stays there:

    python3 scripts/check_transformer_freeze.py --accept source/quartz/plugins/transformers/ofm.ts \\
        --reason "D-A-07: port stripDangerousHtml verbatim into the new driver's htmlPlugins list"

An ABSOLUTE freeze would be worse than no gate: it blocks the first legitimate change and then gets
disabled wholesale, which is how a gate stops existing. A reason is cheap; silence is what costs.

THE ENUMERATION IS DERIVED, NOT HAND-MAINTAINED. Files are globbed from the owned directories, so a
NEW file appearing there is an UNKNOWN and fails, rather than being absent from a list by default
(CLAUDE.md §6.7 — `attachInput`'s hand-maintained overlay list is the recorded instance of that
defect class, and `.ng-seemore` was missing from it for its entire existence).

POSITIVE COVERAGE, HARD-FAILING ON ZERO. It always prints how many files it compared and exits
non-zero if that count is below a floor. "Found no problems" and "never looked" must not produce
the same output (CLAUDE.md §6.6 — 17 recorded instances in this repo).

BLIND SPOTS, stated so a green here is not read as more than it is:
  · Source identity is not behavioural identity. An npm version bump under `source/package.json`
    changes what remark/rehype/shiki emit with these files untouched; that is the payload and
    fingerprint gates' job, not this one.
  · It says nothing about the DRIVER. The trim at `processors/parse.ts:86`, the emitter order and
    the worker transport are S1's surface and are deliberately out of scope here.
  · It cannot see a change made and accepted in the same commit — the reason is the audit trail,
    not a second opinion.

Exit 0 clean · 1 drift or unknown/missing file · 2 the instrument itself is unusable.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BASELINE = REPO / "tests" / "artifacts" / "transformer_freeze.json"

# DERIVED, never hand-listed. Anything matching these globs is in scope by construction.
WATCHED_GLOBS = (
    "source/quartz/plugins/transformers/*.ts",
    "source/quartz/plugins/filters/*.ts",
)

# A floor, not an exact count: new transformers are legitimate, a collapse to nothing is not.
# 12 files today (10 transformers incl. index.ts, 2 filters). Recompute:
#   ls source/quartz/plugins/transformers/*.ts source/quartz/plugins/filters/*.ts | wc -l
MIN_FILES = 10


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def discover() -> dict[str, Path]:
    found: dict[str, Path] = {}
    for pattern in WATCHED_GLOBS:
        for p in sorted(REPO.glob(pattern)):
            found[p.relative_to(REPO).as_posix()] = p
    return found


def load_baseline() -> dict:
    if not BASELINE.exists():
        return {}
    try:
        return json.loads(BASELINE.read_text())
    except json.JSONDecodeError as exc:
        print(f"FAIL: {BASELINE} is not readable JSON: {exc}", file=sys.stderr)
        sys.exit(2)


def write_baseline(data: dict) -> None:
    BASELINE.parent.mkdir(parents=True, exist_ok=True)
    BASELINE.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def seed(note: str, force: bool = False) -> int:
    # RE-SEEDING IS A LAUNDERING PATH AND IS REFUSED BY DEFAULT. Found by running this gate's own
    # scenarios: `--accept` records a reason and its history, but a bare `--seed` over an existing
    # baseline rewrites every hash from the working tree and DELETES that history, which turns a
    # deliberate, reasoned, moveable baseline back into a self-advancing one — the exact property
    # D-27 required it not to have, and the property `check_payload_budget.py`'s `--update` is
    # forbidden to give the tier-0 floors. Seeding is therefore a once-ever operation unless
    # somebody explicitly says otherwise. Use --accept for a legitimate change.
    if BASELINE.exists() and not force:
        print(
            f"FAIL: {BASELINE.relative_to(REPO)} already exists. Re-seeding would erase the "
            "accepted-change history and silently absorb any current drift.\n"
            "  To record a legitimate change:  --accept <path> --reason \"...\"\n"
            "  To genuinely start over:        --seed --force  (and say why in the commit)",
            file=sys.stderr,
        )
        return 2
    files = discover()
    if len(files) < MIN_FILES:
        print(f"FAIL: discovered {len(files)} files, expected at least {MIN_FILES}", file=sys.stderr)
        return 2
    data = {
        "note": note,
        "phase": "P1-P4",
        "why": (
            "Stream A is a re-host, not a rewrite: 0 of 64 import statements in these files cross "
            "into the replaced engine. Under D-03 the correct number of behavioural changes here "
            "during P1-P4 is zero. Moved one file at a time via --accept --reason, never automatically."
        ),
        "files": {rel: {"sha256": sha256(p), "bytes": p.stat().st_size} for rel, p in files.items()},
    }
    write_baseline(data)
    print(f"seeded {len(files)} files into {BASELINE.relative_to(REPO)}")
    return 0


def accept(target: str, reason: str) -> int:
    if not reason.strip():
        print("FAIL: --reason may not be empty; that is the whole point of the gate", file=sys.stderr)
        return 2
    files = discover()
    if target not in files:
        print(f"FAIL: {target} is not one of the {len(files)} watched files", file=sys.stderr)
        return 2
    data = load_baseline()
    if not data:
        print("FAIL: no baseline to move; run --seed first", file=sys.stderr)
        return 2
    entry = data["files"].get(target, {})
    old = entry.get("sha256", "(absent)")
    new = sha256(files[target])
    if old == new:
        print(f"nothing to accept: {target} already matches the baseline")
        return 0
    history = entry.get("accepted", [])
    history.append(
        {
            "date": _dt.date.today().isoformat(),
            "from": old,
            "to": new,
            "reason": reason.strip(),
        }
    )
    data["files"][target] = {
        "sha256": new,
        "bytes": files[target].stat().st_size,
        "accepted": history,
    }
    write_baseline(data)
    print(f"accepted {target}\n  {old[:12]} -> {new[:12]}\n  reason: {reason.strip()}")
    return 0


def check() -> int:
    data = load_baseline()
    if not data:
        print(f"FAIL: no baseline at {BASELINE.relative_to(REPO)} — run --seed", file=sys.stderr)
        return 2
    files = discover()
    recorded = data.get("files", {})

    # A matcher that matches nothing reads exactly like a clean result, so refuse to report at all
    # below the floor rather than printing a reassuring zero.
    if len(files) < MIN_FILES:
        print(
            f"FAIL: discovered only {len(files)} watched files (floor {MIN_FILES}). "
            "Either the globs are wrong or the surface moved; this gate cannot report on an "
            "enumeration it does not trust.",
            file=sys.stderr,
        )
        return 2

    drifted, unknown, missing = [], [], []
    for rel, p in files.items():
        if rel not in recorded:
            unknown.append(rel)
        elif sha256(p) != recorded[rel]["sha256"]:
            drifted.append(rel)
    for rel in recorded:
        if rel not in files:
            missing.append(rel)

    # ALWAYS print the positive count, green or red.
    print(f"transformer freeze: compared {len(files)} files against {BASELINE.relative_to(REPO)}")
    accepted_total = sum(len(e.get("accepted", [])) for e in recorded.values())
    if accepted_total:
        print(f"  {accepted_total} previously accepted change(s) on record")

    if not (drifted or unknown or missing):
        print("  clean — no source drift in the markdown pipeline")
        return 0

    for rel in drifted:
        print(f"  DRIFT   {rel}", file=sys.stderr)
    for rel in unknown:
        print(f"  UNKNOWN {rel}  (new file in a watched directory — seed or accept it)", file=sys.stderr)
    for rel in missing:
        print(f"  MISSING {rel}  (was in the baseline and is gone)", file=sys.stderr)
    print(
        "\nP1-P4 reproduces exactly and improves nothing (D-03). If this change is deliberate, "
        "record it:\n  python3 scripts/check_transformer_freeze.py --accept <path> --reason \"...\"",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", action="store_true", help="create the baseline from the current tree (once ever)")
    ap.add_argument("--force", action="store_true", help="allow --seed to overwrite an existing baseline")
    ap.add_argument("--note", default="Stream A byte-freeze, phases P1-P4 (D-27).")
    ap.add_argument("--accept", metavar="PATH", help="accept ONE file's current bytes")
    ap.add_argument("--reason", help="why that change is legitimate; required with --accept")
    args = ap.parse_args()

    if args.seed:
        return seed(args.note, args.force)
    if args.accept:
        if not args.reason:
            print("FAIL: --accept requires --reason", file=sys.stderr)
            return 2
        return accept(args.accept, args.reason)
    return check()


if __name__ == "__main__":
    sys.exit(main())
