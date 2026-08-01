#!/usr/bin/env python3
"""Apply Q3 panel-calibrated occurrence (attempt-probability) distributions into
content/Positions/*.json.

Reads occurrence_calibration.json (the committed provenance emitted by the Q3
aggregation: per container -> per move -> final {gi,nogi} ints summing to 100 per
frame). For each container it:
  - resolves the position file by its stored RELATIVE PATH (never by slug — two
    Crackhead Control files collide on the name slug),
  - loads RAW (never reduce_to_scalar: these are the divergent maps themselves),
  - locates the role container (data[role]["transitions"], root for neutral),
  - ABORTS the container if the move set drifted since elicitation,
  - writes attempt_probability = {"gi": int, "nogi": int} per move,
  - belt-and-braces largest_remainder_round per frame if a sum is off 100,
  - atomic-writes the file.

--dry-run reports everything and writes nothing.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _prob_norm import largest_remainder_round  # noqa: E402
from _atomic_io import atomic_write_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RULESETS = ("gi", "nogi")


def apply_container(entry: dict, dry_run: bool) -> dict:
    rel = entry["file"]
    role = entry["role"]
    finals = {m["transition"]: m["final"] for m in entry["moves"]}

    path = ROOT / rel
    if not path.exists():
        return {"file": rel, "role": role, "status": "error", "reason": "file not found"}
    data = json.loads(path.read_text(encoding="utf-8"))

    if role in ("top", "bottom"):
        container = data.get(role)
        if not isinstance(container, dict) or not isinstance(container.get("transitions"), list):
            return {"file": rel, "role": role, "status": "error", "reason": f"role '{role}' has no transitions"}
        trans = container["transitions"]
    else:  # neutral: root-level transitions
        trans = data.get("transitions")
        if not isinstance(trans, list):
            return {"file": rel, "role": role, "status": "error", "reason": "no root transitions"}

    current = [t.get("transition") for t in trans if isinstance(t, dict)]
    if set(current) != set(finals):
        drift = sorted(set(current) ^ set(finals))
        return {"file": rel, "role": role, "status": "drift",
                "reason": f"move set drifted since elicitation: {drift[:6]}"}

    changed = 0
    for t in trans:
        name = t.get("transition")
        new = {rs: int(finals[name].get(rs, 0)) for rs in RULESETS}
        if t.get("attempt_probability") != new:
            t["attempt_probability"] = new
            changed += 1

    # belt-and-braces: each frame must sum to exactly 100
    fixed_frames = []
    for rs in RULESETS:
        vals = [t["attempt_probability"][rs] for t in trans]
        if sum(vals) != 100 and sum(vals) > 0:
            ints = largest_remainder_round([float(v) for v in vals], 100)
            for t, v in zip(trans, ints):
                t["attempt_probability"][rs] = v
            fixed_frames.append(rs)

    if not dry_run:
        atomic_write_json(path, data, indent=2, ensure_ascii=False)
    return {"file": rel, "role": role, "status": "applied" if not dry_run else "dry_run",
            "moves_changed": changed, "renormalized_frames": fixed_frames}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--calibration", default=str(ROOT / "occurrence_calibration.json"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="comma-separated container keys to apply (default: all)")
    args = ap.parse_args()

    cal = json.loads(Path(args.calibration).read_text(encoding="utf-8"))
    containers = cal["containers"]
    if args.only:
        keys = set(args.only.split(","))
        containers = [c for c in containers if c.get("key") in keys]

    results = [apply_container(c, args.dry_run) for c in containers]
    by_status = {}
    for r in results:
        by_status.setdefault(r["status"], []).append(r)

    print(f"containers: {len(results)}  "
          + "  ".join(f"{k}={len(v)}" for k, v in sorted(by_status.items())))
    print(f"moves changed: {sum(r.get('moves_changed', 0) for r in results)}")
    renorm = [r for r in results if r.get("renormalized_frames")]
    if renorm:
        print(f"belt-and-braces renormalized: {len(renorm)} (should be ~0 — aggregation "
              "already sums to 100; investigate if large)")
    for bad in by_status.get("error", []) + by_status.get("drift", []):
        print(f"  {bad['status'].upper()}: {bad['file']} [{bad['role']}] — {bad['reason']}")
    if by_status.get("error") or by_status.get("drift"):
        sys.exit(1)


if __name__ == "__main__":
    main()
