"""One-shot rename: knowledge_assessment → flashcards across content + templates JSON.

Operates on parsed JSON (not text substitution) to avoid corrupting descriptions
that happen to mention the phrase. Walks every dict at every depth and rewrites
the key if present. Leaves content/Learning/ and templates/Learning*.json alone
per scope decision.

Usage:
    python3 scripts/rename_knowledge_assessment.py --dry-run
    python3 scripts/rename_knowledge_assessment.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


RENAMES = {
    "knowledge_assessment": "flashcards",
}

EXCLUDE_DIR_PARTS = {"Learning"}
EXCLUDE_FILE_NAMES = {"Learning.json"}


def rewrite_keys(obj: object) -> tuple[object, int]:
    changes = 0
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            new_k = RENAMES.get(k, k)
            if new_k != k:
                changes += 1
            new_v, sub = rewrite_keys(v)
            changes += sub
            new[new_k] = new_v
        return new, changes
    if isinstance(obj, list):
        out = []
        for item in obj:
            new_item, sub = rewrite_keys(item)
            changes += sub
            out.append(new_item)
        return out, changes
    return obj, 0


def should_skip(path: Path) -> bool:
    if path.name in EXCLUDE_FILE_NAMES:
        return True
    return any(part in EXCLUDE_DIR_PARTS for part in path.parts)


def process_file(path: Path, dry_run: bool) -> int:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"  skip (unreadable): {path} — {e}", file=sys.stderr)
        return 0

    new_data, changes = rewrite_keys(data)
    if changes == 0:
        return 0

    if not dry_run:
        with path.open("w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    return changes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    parser.add_argument(
        "--root",
        default=".",
        help="repo root (default: cwd)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    targets = [
        root / "content" / "Positions",
        root / "content" / "Transitions",
        root / "content" / "Submissions",
        root / "content" / "Principles",
        root / "content" / "Systems",
        root / "templates",
    ]

    total_files = 0
    total_changes = 0
    changed_files = 0

    for base in targets:
        if not base.exists():
            print(f"  missing: {base}")
            continue
        for path in sorted(base.rglob("*.json")):
            if should_skip(path):
                continue
            total_files += 1
            changes = process_file(path, args.dry_run)
            if changes:
                changed_files += 1
                total_changes += changes
                rel = path.relative_to(root)
                print(f"  {'[dry]' if args.dry_run else '[ok] '} {rel}: {changes} renames")

    verb = "would rename" if args.dry_run else "renamed"
    print(
        f"\n{verb}: {total_changes} keys across {changed_files}/{total_files} files"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
