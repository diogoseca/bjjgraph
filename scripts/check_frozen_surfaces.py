#!/usr/bin/env python3
"""Byte-freeze the Quartz replacement's frozen surfaces. ONE GATE, TWO SCOPES.

    scope `pipeline`  plugins/transformers/** + plugins/filters/**   (D-27, stream A)
    scope `keeplist`  INTERFACE.md section 7's retained-file inventory (D-01, contributed by D)

Both scopes exist because two different decisions froze two DISJOINT sets for the same reason, and
two scripts doing one job is the `readers.css` / `reading.css` shape this programme has already
paid for once (D-41: quartz-cto ruled one gate, two scopes, owned here; `mgr-cl-3` contributed the
keep-list scope from `qz/d-presentation/tests/artifacts/_presentation_keeplist_check.py`).

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

WHY THE KEEP-LIST SCOPE EXISTS (D-01). The replacement keeps every component, stylesheet, i18n
module and utility VERBATIM while the engine around them is swapped. INTERFACE.md section 7
enumerates that set, and a hand-maintained enumeration can fail in TWO ways, so both are checked:

  1. THE LIST IS INCOMPLETE — a tracked file the list does not name is a file the replacement may
     change with nothing reporting it. That is CLAUDE.md 6.7's defect class: a new member is
     missing by default. Checked by set-comparing the enumeration against `git ls-files` for the
     directory the contract covers exhaustively.
  2. THE LIST IS COMPLETE BUT NO LONGER TRUE — a file drifted and "byte-for-byte unchanged"
     quietly stopped holding. Checked with `git show <base>:<path>`.

The keep-list is PARSED out of the contract rather than copied into this file, deliberately: if
section 7's heading or fence moves, this gate fails loudly instead of silently checking a stale
copy. That is the right failure (mgr-cl-3's call, kept).

HOW IT MOVES. Never automatically, and never by itself — the same rule as `payload_policy.json`'s
bands and `check_payload_budget.py`'s tier-0 floors, and for the same reason: a self-advancing
baseline is a check that never runs. A legitimate change is accepted one file at a time, with a
written reason that lands in the baseline and stays there:

    python3 scripts/check_frozen_surfaces.py --accept source/quartz/plugins/transformers/ofm.ts \\
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
import re
import subprocess
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

# ── keeplist scope ─────────────────────────────────────────────────────────────────────────────
INTERFACE = Path("/home/user/bjj-orchestrator/quartz/INTERFACE.md")
BASE_REF = "f649801a9"          # the programme's base commit; D-01 freezes against it
QZ_PREFIX = "source/quartz/"
# components/ is the one directory INTERFACE.md section 7 claims to cover EXHAUSTIVELY, so it is
# the only one a set-difference can be asserted on. The others are listed selectively by the
# contract, so they are byte-checked but not completeness-checked — stated here rather than
# silently applying an exhaustive check to a non-exhaustive list.
EXHAUSTIVE_DIR = "components"

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
    """Record ONE authorized change, in EITHER scope.

    D-82: this originally reached only the `pipeline` scope, so an authorized change to a
    keep-list file — S1's `loadGraphData` fix in `renderPage.tsx`, INTERFACE.md section 7's single
    named exception — could not be recorded at all, and `--accept` answered "not one of the 12
    watched files". A gate that fires correctly but cannot record the authorized answer pushes the
    authorization into `DECISIONS.md`, where the gate cannot see it, and leaves five streams
    hitting a red that has to be waved through by hand. That is worse than no gate: it teaches
    people to ignore this one.
    """
    if not reason.strip():
        print("FAIL: --reason may not be empty; that is the whole point of the gate", file=sys.stderr)
        return 2
    files = discover()
    if target not in files:
        # Not in the pipeline scope — try the keep-list, whose entries are relative to
        # `source/quartz/` in the contract but are addressed here by their repo-relative path.
        try:
            keeplist = {QZ_PREFIX + rel for rel in parse_keeplist()}
        except (FileNotFoundError, ValueError) as exc:
            print(f"FAIL: {target} is not a watched pipeline file, and the keep-list is "
                  f"unreadable so it cannot be checked either: {exc}", file=sys.stderr)
            return 2
        if target in keeplist:
            return accept_keeplist(target, reason)
        print(
            f"FAIL: {target} is in neither scope — not one of the {len(files)} pipeline files, "
            f"and not one of the {len(keeplist)} keep-list entries",
            file=sys.stderr,
        )
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


def accept_keeplist(target: str, reason: str) -> int:
    """Accept a keep-list delta. The recorded sha PINS THE EXACT BYTES accepted, so a LATER change
    to the same file is a new, unaccepted drift rather than being tolerated forever by one prior
    approval. Without that, `--accept` would silently convert a frozen file into an unfrozen one."""
    disk = REPO / target
    if not disk.exists():
        print(f"FAIL: {target} is not in the working tree", file=sys.stderr)
        return 2
    base = subprocess.run(["git", "show", f"{BASE_REF}:{target}"], capture_output=True, cwd=REPO)
    if base.returncode != 0:
        print(f"FAIL: {target} is not in {BASE_REF}, so there is no baseline to move from",
              file=sys.stderr)
        return 2
    new = sha256(disk)
    if disk.read_bytes() == base.stdout:
        print(f"nothing to accept: {target} is byte-identical to {BASE_REF}")
        return 0

    data = load_baseline()
    if not data:
        print("FAIL: no baseline to move; run --seed first", file=sys.stderr)
        return 2
    entry = data["files"].get(target, {})
    if entry.get("sha256") == new:
        print(f"nothing to accept: {target}'s current bytes are already recorded")
        return 0
    history = entry.get("accepted", [])
    history.append(
        {
            "date": _dt.date.today().isoformat(),
            "scope": "keeplist",
            "from": hashlib.sha256(base.stdout).hexdigest(),
            "to": new,
            "reason": reason.strip(),
        }
    )
    data["files"][target] = {"sha256": new, "bytes": disk.stat().st_size, "accepted": history}
    write_baseline(data)
    print(f"accepted (keep-list) {target}\n  differs from {BASE_REF}, now recorded at {new[:12]}"
          f"\n  reason: {reason.strip()}")
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
    print(f"pipeline scope: compared {len(files)} files against {BASELINE.relative_to(REPO)}")
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
        "record it:\n  python3 scripts/check_frozen_surfaces.py --accept <path> --reason \"...\"",
        file=sys.stderr,
    )
    return 1


# ── SCOPE 2: the D-01 keep-list ────────────────────────────────────────────────────────────────


def parse_keeplist() -> list[str]:
    """Pull the retained-file inventory out of the contract. Never copy it into this file: a stale
    copy would check itself. If the heading or fence moves, this raises rather than returning []."""
    if not INTERFACE.exists():
        raise FileNotFoundError(f"no interface contract at {INTERFACE}")
    txt = INTERFACE.read_text(encoding="utf8")
    m = re.search(r"Exact retained-file inventory.*?```text\n(.*?)```", txt, re.S)
    if not m:
        raise ValueError(
            "could not find the keep-list block in the contract — the heading or fence moved"
        )
    listed = [ln.strip() for ln in m.group(1).splitlines() if ln.strip()]
    if not listed:
        # A matcher that matches nothing reports clean (CLAUDE.md §6.6). Refuse instead.
        raise ValueError("the keep-list block parsed to ZERO entries")
    return listed


def check_keeplist(accepted: dict) -> int:
    try:
        listed = parse_keeplist()
    except (FileNotFoundError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2

    # 1. COMPLETENESS, only for the directory the contract claims to cover exhaustively.
    listed_dir = sorted(x for x in listed if x.startswith(EXHAUSTIVE_DIR + "/"))
    tracked = subprocess.run(
        ["git", "ls-files", QZ_PREFIX + EXHAUSTIVE_DIR],
        capture_output=True, text=True, cwd=REPO,
    )
    if tracked.returncode != 0:
        print("FAIL: git ls-files failed — not a repo?", file=sys.stderr)
        return 2
    on_disk = sorted(x[len(QZ_PREFIX):] for x in tracked.stdout.split())
    if not on_disk:
        print(f"FAIL: git ls-files {QZ_PREFIX}{EXHAUSTIVE_DIR} returned nothing", file=sys.stderr)
        return 2
    unfrozen = [x for x in on_disk if x not in listed_dir]
    phantom = [x for x in listed_dir if x not in on_disk]

    # 2. BYTE IDENTITY against the programme base.
    compared, drifted, accepted_drift = 0, [], []
    for rel in listed:
        full = QZ_PREFIX + rel
        disk = REPO / full
        if not disk.exists():
            drifted.append((full, "ABSENT FROM WORKING TREE"))
            continue
        r = subprocess.run(["git", "show", f"{BASE_REF}:{full}"], capture_output=True, cwd=REPO)
        if r.returncode != 0:
            drifted.append((full, f"NOT IN {BASE_REF}"))
            continue
        compared += 1
        if disk.read_bytes() != r.stdout:
            # Same moveability rule as the pipeline scope: a recorded reason downgrades a failure
            # to a reported, accepted delta. An absolute freeze gets switched off wholesale the
            # first time a legitimate change needs it.
            # An acceptance pins the EXACT bytes approved. If the file has moved again since,
            # that is a new, unapproved drift — one prior approval must never license every
            # future edit to the same file (the self-advancing property D-27 forbids).
            rec = accepted.get(full)
            if rec and rec.get("sha256") == sha256(disk):
                accepted_drift.append((full, "BYTES DIFFER"))
            else:
                drifted.append(
                    (full, "BYTES DIFFER (re-drifted since acceptance)" if rec else "BYTES DIFFER")
                )

    print(f"keep-list scope: {len(listed)} entries, {len(listed_dir)} under {EXHAUSTIVE_DIR}/")
    print(f"  tracked under {QZ_PREFIX}{EXHAUSTIVE_DIR}/ : {len(on_disk)}")
    print(f"  byte-compared against {BASE_REF}      : {compared}   <- positive coverage count")
    if accepted_drift:
        print(f"  accepted deltas                    : {len(accepted_drift)}")
        for f, _ in accepted_drift:
            print(f"      {f}  — {accepted[f]['accepted'][-1]['reason']}")

    # A run that compared nothing proved nothing, and must not exit 0.
    if compared == 0:
        print("FAIL: byte-compared ZERO files — this run proved nothing", file=sys.stderr)
        return 2
    bad = False
    for rel in unfrozen:
        print(f"  ON DISK BUT NOT FROZEN  {rel}  (the replacement may change it; nothing would report it)", file=sys.stderr)
        bad = True
    for rel in phantom:
        print(f"  FROZEN BUT NOT TRACKED  {rel}", file=sys.stderr)
        bad = True
    for f, why in drifted:
        print(f"  {why:24} {f}", file=sys.stderr)
        bad = True
    if bad:
        print(
            "\nD-01 says these are verbatim. If a change is deliberate:\n"
            '  python3 scripts/check_frozen_surfaces.py --accept <path> --reason "..."',
            file=sys.stderr,
        )
        return 1
    # Say which it is. "byte-identical" while reporting an accepted delta is a false statement in
    # the gate's own success message, and a success message nobody can trust is a gate nobody reads.
    if accepted_drift:
        print(f"  clean — complete, {len(accepted_drift)} recorded exception(s), no unapproved drift")
    else:
        print("  clean — keep-list complete and byte-identical")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", action="store_true", help="create the baseline from the current tree (once ever)")
    ap.add_argument("--force", action="store_true", help="allow --seed to overwrite an existing baseline")
    ap.add_argument("--note", default="Stream A byte-freeze, phases P1-P4 (D-27).")
    ap.add_argument(
        "--scope",
        choices=("pipeline", "keeplist", "all"),
        default="all",
        help="which frozen surface to check (default: both)",
    )
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

    data = load_baseline()
    accepted = {k: v for k, v in data.get("files", {}).items() if v.get("accepted")}
    codes = []
    if args.scope in ("pipeline", "all"):
        codes.append(check())
    if args.scope in ("keeplist", "all"):
        codes.append(check_keeplist(accepted))
    # The worst outcome wins: 2 (unusable instrument) beats 1 (drift) beats 0.
    return max(codes) if 2 not in codes else 2


if __name__ == "__main__":
    sys.exit(main())
