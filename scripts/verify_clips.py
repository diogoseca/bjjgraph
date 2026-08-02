#!/usr/bin/env python3
"""verify_clips.py — re-verify every curated YouTube clip in content/*.json.

Clip rot is real: videos get deleted, made private, or have embedding disabled
after we curate them. This walks every `clips` array (root + role-nested),
re-runs the machine checks (oEmbed embeddability + portrait-thumbnail Shorts
check), refreshes the `verified` date on passes, and reports failures.

Usage:
  python3 scripts/verify_clips.py                    # check everything, report
  python3 scripts/verify_clips.py --max-age-days 30  # only clips not verified recently
  python3 scripts/verify_clips.py --prune            # remove dead/embed-disabled clips
  python3 scripts/verify_clips.py --category Submissions --file Triangle

Exit code 1 if any clip failed and --prune was not given (CI-friendly).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json
from _clips import CONTENT, iter_clips_arrays, verify_video


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--category", choices=["Positions", "Transitions", "Submissions", "Principles"])
    ap.add_argument("--file", help="substring filter on content file path")
    ap.add_argument("--max-age-days", type=int, help="only re-check clips whose `verified` date is older")
    ap.add_argument("--prune", action="store_true", help="remove failing clips from the JSON")
    ap.add_argument("--sleep", type=float, default=0.5, help="seconds between checks")
    args = ap.parse_args()

    cutoff = None
    if args.max_age_days is not None:
        cutoff = (datetime.now() - timedelta(days=args.max_age_days)).date().isoformat()
    today = date.today().isoformat()

    checked = passed = 0
    failures = []       # (where, clip_id, status)
    cache = {}          # id -> verify result (same video can appear in several holders)
    changed_files = {}  # path -> data (holders share the per-file data object)

    for f, data, role, holder in iter_clips_arrays(args.category, args.file):
        where = f"{os.path.relpath(f, CONTENT)}#{role or 'root'}"
        kept = []
        changed = False
        for clip in holder["clips"]:
            vid = clip.get("id")
            if cutoff and (clip.get("verified") or "") >= cutoff:
                kept.append(clip)
                continue
            if vid not in cache:
                cache[vid] = verify_video(vid)
                time.sleep(args.sleep)
            v = cache[vid]
            checked += 1
            if v["status"] == "ok":
                passed += 1
                if clip.get("verified") != today or clip.get("vertical") != v["vertical"]:
                    clip["verified"] = today
                    clip["vertical"] = v["vertical"]
                    if v["channel"]:
                        clip["channel"] = v["channel"]
                    changed = True
                kept.append(clip)
            elif v["status"] == "error":
                # transient (network/HTTP hiccup): keep, don't refresh, don't prune
                print(f"  ? {where} {vid}: transient check error — kept")
                kept.append(clip)
            else:
                failures.append((where, vid, v["status"]))
                print(f"  ✗ {where} {vid}: {v['status']}" + (" — PRUNED" if args.prune else ""))
                if args.prune:
                    changed = True
                else:
                    kept.append(clip)
        if changed:
            if args.prune and not kept:
                holder.pop("clips", None)
            else:
                holder["clips"] = kept
            changed_files[f] = data

    for f, data in changed_files.items():
        atomic_write_json(f, data)

    print(f"\nverify_clips: {checked} checked, {passed} ok, {len(failures)} failing"
          + (f", {len(changed_files)} file(s) updated" if changed_files else ""))
    if failures and not args.prune:
        print("rerun with --prune to remove them, or replace ids by hand")
        sys.exit(1)


if __name__ == "__main__":
    main()
