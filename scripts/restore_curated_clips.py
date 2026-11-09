#!/usr/bin/env python3
"""Put curated clips back after a bot edited content JSON directly. No model, no network.

The paid regenerate_content_json.py pass restores `clips` and `escape_clips` itself, but the
content, analytics and proofread bots edit source JSON in place, and a file that still passes
validate_json.py after losing every clip counts as a success. Validation cannot see a deletion:
`clips` is optional. So this runs straight after the edit, before validation, with HEAD as the
pre-edit snapshot, which holds because those bots commit nothing until their PR.

For every tracked content JSON that differs from HEAD:
- `clips` (root and role) and `defender.escape_clips` are restored verbatim;
- a file is reverted whole if it no longer parses, if a reword left an orphaned escape row, or if
  its curated fields still differ from HEAD after the restore (restore_clips has nowhere to put
  them when an edit removed the whole role block). The curated clip outranks that week's copy
  edit, and the paid retry treats whatever is on disk as its original, so a damaged file must
  never survive this step. It prints a ::warning:: naming the reason.

Prints a positive count. It never fails a run: its job is to leave the tree safe for validation.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from _clips import escape_clip_join, escape_rows, restore_clips  # noqa: E402


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=False)


def curated(data):
    """Every curated clip array of one record, by holder. A missing holder reads as None."""
    holders = {"root": data}
    holders.update({role: data.get(role) for role in ("top", "bottom", "attacker", "defender")})
    fields = {name: block.get("clips") if isinstance(block, dict) else None for name, block in holders.items()}
    defender = data.get("defender")
    fields["escape_clips"] = defender.get("escape_clips") if isinstance(defender, dict) else None
    return fields


def guard(relative, original_text):
    """(arrays restored, reverted?) for one edited file."""
    path = ROOT / relative
    try:
        original = json.loads(original_text)
        current = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return 0, True
    if not isinstance(current, dict) or not isinstance(original, dict):
        return 0, True
    restored = restore_clips(original, current)
    if curated(current) != curated(original):
        print(f"::warning::{relative}: reverted, a curated clip holder could not be restored")
        return restored, True
    orphans = []
    if escape_rows(current):
        try:
            orphans = [row.get("escape") for row in escape_clip_join(current)[1]]
        except ValueError as exc:
            orphans = [str(exc)]
    if orphans:
        print(f"::warning::{relative}: reverted, the edit orphaned curated escape clips {orphans}")
        return restored, True
    if restored:
        path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return restored, False


def main():
    listing = git("diff", "--name-only", "-z", "HEAD", "--", "content").stdout.split("\0")
    seen = arrays = reverted = 0
    for relative in listing:
        if not relative.endswith(".json") or not (ROOT / relative).exists():
            continue
        shown = git("show", f"HEAD:{relative}")
        if shown.returncode:
            continue  # new in this run: nothing curated to restore
        seen += 1
        restored, revert = guard(relative, shown.stdout)
        arrays += restored
        if revert:
            git("checkout", "HEAD", "--", relative)
            reverted += 1
    print(f"restore_curated_clips: {seen} edited JSON files, {arrays} clip arrays restored, {reverted} files reverted")


if __name__ == "__main__":
    main()
