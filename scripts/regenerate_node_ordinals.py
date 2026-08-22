#!/usr/bin/env python3
"""regenerate_node_ordinals.py — the APPEND-ONLY ordinal lockfile for share links.

WHY THIS EXISTS
---------------
A share link ("these are the techniques we learned in today's class") has to name a
set of graph nodes inside a URL. The obvious wire encoding — the node's index in the
`nodes` array of source/quartz/static/globalGraphLayout.json — is CORRUPTING, because
that array's order is filesystem order:

  scripts/regenerate_graph.py builds graph.json by iterating `directory.rglob('*.json')`
  (unsorted dir order), and scripts/regenerate_graph_layout.py then builds its node list
  from `adjacency` DICT INSERTION order seeded by that iteration. Adding ONE content
  file re-orders pre-existing entries — measured: adding one file to a 7-file directory
  moved 2 of the 7. A link encoding array indices would therefore silently decode to a
  DIFFERENT set of techniques after any content change. Nobody would ever see an error;
  the recipient would just be shown the wrong class.

So the wire format encodes ORDINALS from this lockfile instead:

  * assigned once, per node id, and NEVER changed
  * NEVER reused, even after a node is deleted from content (its entry is retained
    forever and merely flagged in `retired`)
  * new nodes APPEND at `next_ordinal`, in sorted-id order so the assignment itself
    does not depend on filesystem order either

The lockfile is COMMITTED (it is permanent identity, not a build artifact) and this
script's --check mode is a GATE: a regeneration that renumbers, reuses, or drops an
ordinal must fail loudly rather than ship a corrupted link space.

SCOPE: the live node set is exactly the layout's `nodes[].id` — the ids the background
graph renders and the ids the Neural app carries in graph-data.json. Lists are lists of
those nodes.

USAGE
  python3 scripts/regenerate_node_ordinals.py                      # mint/append + rewrite
  python3 scripts/regenerate_node_ordinals.py --check              # gate (vs working tree)
  python3 scripts/regenerate_node_ordinals.py --check --baseline-ref HEAD^1   # gate in CI
  python3 scripts/regenerate_node_ordinals.py --check --no-git     # no append-only diff
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_text  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "source" / "quartz" / "static" / "globalGraphLayout.json"
LOCKFILE = ROOT / "node_ordinals.json"
LOCK_REL = "node_ordinals.json"
FORMAT_VERSION = 1

NOTE = (
    "APPEND-ONLY. An ordinal is a node's permanent public identity in share-link URLs: "
    "never renumber one, never reuse one, never delete an entry (retire it instead). "
    "Regenerate with `npm run regenerate:ordinals`; `--check` gates deploys."
)


def _fail(msgs: list[str]) -> int:
    for m in msgs:
        print(f"[ordinals] ERROR: {m}", file=sys.stderr)
    print(
        "[ordinals] FAILED. Ordinals are the public identity of every share link — "
        "a renumber or reuse silently rewrites what shared links mean.",
        file=sys.stderr,
    )
    return 1


def load_layout_ids() -> list[str]:
    if not LAYOUT.exists():
        raise SystemExit(
            f"[ordinals] ERROR: {LAYOUT} not found. Run `npm run regenerate:graph-layout` first."
        )
    with LAYOUT.open() as fh:
        layout = json.load(fh)
    ids = [n["id"] for n in layout.get("nodes", []) if n.get("id")]
    if not ids:
        raise SystemExit("[ordinals] ERROR: layout has no nodes.")
    return ids


def load_lock(path: Path | None = None) -> dict:
    p = path or LOCKFILE
    if not p.exists():
        return {}
    with p.open() as fh:
        return json.load(fh)


def render_lock(ordinals: dict[str, int], retired: dict[str, str], live_count: int) -> str:
    """Canonical serialization: keys sorted, one entry per line (append = pure line insert)."""
    body = {
        "format_version": FORMAT_VERSION,
        "note": NOTE,
        "source": "source/quartz/static/globalGraphLayout.json#nodes[].id",
        "next_ordinal": (max(ordinals.values()) + 1) if ordinals else 0,
        "count_assigned": len(ordinals),
        "count_live": live_count,
        "ordinals": {k: ordinals[k] for k in sorted(ordinals)},
        "retired": {k: retired[k] for k in sorted(retired)},
    }
    return json.dumps(body, indent=1, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------- validation


def validate(lock: dict, live_ids: list[str], head_lock: dict | None) -> list[str]:
    """Return a list of hard errors. Empty list == the lockfile is safe to ship."""
    errs: list[str] = []

    if not lock:
        return [f"{LOCK_REL} is missing. Run `npm run regenerate:ordinals`."]

    if lock.get("format_version") != FORMAT_VERSION:
        errs.append(
            f"format_version is {lock.get('format_version')!r}, expected {FORMAT_VERSION}. "
            "A format change must be a NEW wire version, never a reinterpretation of "
            "ordinals already in the wild."
        )

    ordinals = lock.get("ordinals")
    if not isinstance(ordinals, dict) or not ordinals:
        return errs + ["`ordinals` is missing or empty."]
    retired = lock.get("retired") or {}

    # 1. every value a non-negative int
    for nid, o in ordinals.items():
        if not isinstance(o, int) or isinstance(o, bool) or o < 0:
            errs.append(f"ordinal for {nid!r} is {o!r}; must be a non-negative integer.")
    if errs:
        return errs

    # 2. no ordinal used twice (the reuse invariant, within this file)
    by_ordinal: dict[int, list[str]] = {}
    for nid, o in ordinals.items():
        by_ordinal.setdefault(o, []).append(nid)
    for o, ids in sorted(by_ordinal.items()):
        if len(ids) > 1:
            errs.append(f"ordinal {o} is REUSED by {len(ids)} nodes: {sorted(ids)}")

    # 3. next_ordinal is exactly max+1 — the only value that cannot hand out a used one
    want_next = max(ordinals.values()) + 1
    if lock.get("next_ordinal") != want_next:
        errs.append(
            f"next_ordinal is {lock.get('next_ordinal')!r}, expected {want_next} "
            "(max assigned + 1). A lower value would re-issue a live ordinal."
        )

    # 4. canonical key order (keeps the diff an append, so a renumber is visible in review)
    if list(ordinals.keys()) != sorted(ordinals.keys()):
        errs.append("`ordinals` keys are not sorted — rewrite with `npm run regenerate:ordinals`.")

    # 5. every LIVE node has an ordinal
    live = set(live_ids)
    if len(live) != len(live_ids):
        dupes = sorted({i for i in live_ids if live_ids.count(i) > 1})
        errs.append(f"layout has duplicate node ids: {dupes[:5]}")
    unminted = sorted(live - set(ordinals))
    if unminted:
        errs.append(
            f"{len(unminted)} live node(s) have no ordinal (first few: {unminted[:5]}). "
            "Run `npm run regenerate:ordinals` and commit the lockfile."
        )

    # 6. a live node must not be flagged retired (a revived node keeps its old ordinal)
    zombie = sorted(live & set(retired))
    if zombie:
        errs.append(
            f"{len(zombie)} node(s) are live but flagged retired: {zombie[:5]}. "
            "Re-run the generator (it un-retires them, keeping their original ordinal)."
        )

    # 7. retired ids must still hold their ordinal (retire != delete)
    orphan_retired = sorted(set(retired) - set(ordinals))
    if orphan_retired:
        errs.append(
            f"{len(orphan_retired)} retired id(s) have no ordinal entry: {orphan_retired[:5]}. "
            "Retired entries are RETAINED so their ordinal is never handed to another node."
        )

    # 8. THE APPEND-ONLY GATE: nothing committed may have changed
    if head_lock:
        head_ords = head_lock.get("ordinals") or {}
        changed, dropped = [], []
        for nid, o in head_ords.items():
            if nid not in ordinals:
                dropped.append(nid)
            elif ordinals[nid] != o:
                changed.append(f"{nid}: {o} -> {ordinals[nid]}")
        if changed:
            errs.append(
                f"{len(changed)} ordinal(s) RENUMBERED vs HEAD: {changed[:5]}. "
                "Ordinals are permanent; every share link already issued would decode "
                "to different techniques."
            )
        if dropped:
            errs.append(
                f"{len(dropped)} ordinal entr(ies) DELETED vs HEAD: {dropped[:5]}. "
                "Delete nothing — the generator retires a removed node and keeps its ordinal."
            )
        head_next = head_lock.get("next_ordinal")
        if isinstance(head_next, int) and isinstance(lock.get("next_ordinal"), int):
            if lock["next_ordinal"] < head_next:
                errs.append(
                    f"next_ordinal went BACKWARDS ({head_next} -> {lock['next_ordinal']}); "
                    "the next new node would be handed an ordinal already in the wild."
                )

    return errs


def baseline_lockfile(ref: str) -> dict | None:
    """The lockfile as committed at `ref`, or None (no git, ref unreachable, not yet committed).

    WHICH REF MATTERS. Locally, HEAD is right: it catches a renumber in the working tree
    before it is ever committed. In CI, HEAD *is* the commit under test, so comparing
    against it is comparing a thing to itself and catches nothing — CI must pass the
    PREVIOUS commit (`HEAD^1`, which on a PR merge commit is the base branch tip). That is
    why this is a parameter and not a constant.
    """
    try:
        out = subprocess.run(
            ["git", "show", f"{ref}:{LOCK_REL}"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------- generation


def generate(live_ids: list[str], lock: dict) -> tuple[dict[str, int], dict[str, str], dict]:
    ordinals: dict[str, int] = dict(lock.get("ordinals") or {})
    retired: dict[str, str] = dict(lock.get("retired") or {})
    live = set(live_ids)
    today = _dt.date.today().isoformat()

    # APPEND in sorted-id order: the assignment must not inherit filesystem order either,
    # or two machines regenerating the same new content would mint different ordinals.
    minted = []
    next_ordinal = (max(ordinals.values()) + 1) if ordinals else 0
    for nid in sorted(live - set(ordinals)):
        ordinals[nid] = next_ordinal
        minted.append((nid, next_ordinal))
        next_ordinal += 1

    revived = sorted(live & set(retired))
    for nid in revived:
        retired.pop(nid, None)  # keeps its original ordinal — that is the whole point

    newly_retired = sorted(set(ordinals) - live - set(retired))
    for nid in newly_retired:
        retired[nid] = today

    stats = {"minted": minted, "revived": revived, "retired": newly_retired}
    return ordinals, retired, stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="validate only; write nothing (deploy gate)")
    ap.add_argument(
        "--baseline-ref",
        default="HEAD",
        help="git ref to prove append-only against. Default HEAD (right for a working tree). "
        "CI must pass the PREVIOUS commit (HEAD^1) — against HEAD it would compare the "
        "commit under test to itself and catch nothing.",
    )
    ap.add_argument("--no-git", action="store_true", help="skip the append-only diff entirely")
    args = ap.parse_args()

    live_ids = load_layout_ids()
    lock = load_lock()
    head = None if args.no_git else baseline_lockfile(args.baseline_ref)

    if args.check:
        errs = validate(lock, live_ids, head)
        if errs:
            return _fail(errs)
        ords = lock["ordinals"]
        print(
            f"[ordinals] OK — {len(ords)} assigned, {len(live_ids)} live, "
            f"{len(lock.get('retired') or {})} retired, next_ordinal={lock['next_ordinal']}"
            + (
                f"  (append-only verified against {args.baseline_ref})"
                if head
                else f"  (no lockfile at {args.baseline_ref}: append-only diff skipped)"
            )
        )
        return 0

    ordinals, retired, stats = generate(live_ids, lock)
    text = render_lock(ordinals, retired, len(live_ids))

    # Self-gate: never write a lockfile that would fail --check (HEAD diff included).
    candidate = json.loads(text)
    errs = validate(candidate, live_ids, head)
    if errs:
        return _fail(errs + ["refusing to write the lockfile"])

    if LOCKFILE.exists() and LOCKFILE.read_text() == text:
        print(f"[ordinals] unchanged — {len(ordinals)} assigned, {len(live_ids)} live")
        return 0

    atomic_write_text(LOCKFILE, text)
    # atomic_write_text lands a tempfile (0600); match the pipeline's other committed
    # outputs (graph.json, globalGraphLayout.json) so the mode is not a moving diff.
    LOCKFILE.chmod(0o644)
    print(
        f"[ordinals] wrote {LOCK_REL} — {len(ordinals)} assigned, {len(live_ids)} live, "
        f"+{len(stats['minted'])} minted, {len(stats['revived'])} revived, "
        f"{len(stats['retired'])} newly retired, next_ordinal={candidate['next_ordinal']}"
    )
    for nid, o in stats["minted"][:10]:
        print(f"[ordinals]   +{o}  {nid}")
    if len(stats["minted"]) > 10:
        print(f"[ordinals]   … {len(stats['minted']) - 10} more")
    for nid in stats["retired"][:10]:
        print(f"[ordinals]   retired (ordinal {ordinals[nid]} retained forever)  {nid}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
