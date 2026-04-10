#!/usr/bin/env python3
"""
Restructure submission files from flat to nested hierarchy.

BEFORE: Submissions/Americana from Mount.json (flat)
AFTER:  Submissions/Americana/from Mount.json (nested under base submission)

Hub submissions (e.g., "Americana") get is_family: true and are NOT graph nodes.
Only position-specific variants (e.g., "from Mount") are graph nodes.
Standalone submissions with no variants stay flat.
"""

import json
import re
import shutil
import sys
from pathlib import Path
from collections import defaultdict


def parse_submission_name(filename: str) -> tuple[str | None, str | None]:
    """Parse 'Americana from Mount' into ('Americana', 'from Mount').
    Returns (None, None) for files without ' from ' in name."""
    stem = Path(filename).stem
    match = re.match(r'^(.+?)\s+(from\s+.+)$', stem)
    if match:
        return match.group(1), match.group(2)
    return None, None


def move_file(src: Path, dst: Path, dry_run: bool = False):
    """Move a file, creating parent directories as needed."""
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        print(f"  MOVE: {src.relative_to(src.parent.parent.parent)} -> {dst.relative_to(dst.parent.parent.parent)}")
        return True
    shutil.move(str(src), str(dst))
    return True


def move_directory(src: Path, dst: Path, dry_run: bool = False):
    """Move a directory and all contents."""
    if not src.exists() or not src.is_dir():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        print(f"  MOVE DIR: {src.relative_to(src.parent.parent.parent)} -> {dst.relative_to(dst.parent.parent.parent)}")
        return True
    if dst.exists():
        # Merge contents
        for item in src.iterdir():
            dest_item = dst / item.name
            if item.is_dir():
                if dest_item.exists():
                    move_directory(item, dest_item)
                else:
                    shutil.move(str(item), str(dest_item))
            else:
                shutil.move(str(item), str(dest_item))
        src.rmdir()
    else:
        shutil.move(str(src), str(dst))
    return True


def add_is_family_to_json(json_path: Path, dry_run: bool = False):
    """Add is_family: true to a submission JSON file."""
    with open(json_path) as f:
        data = json.load(f)
    if data.get('is_family'):
        return  # already marked
    data['is_family'] = True
    if dry_run:
        print(f"  ADD is_family: {json_path.name}")
        return
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


def update_wikilinks(content_dir: Path, rename_map: dict[str, str], dry_run: bool = False):
    """Update wikilinks in all content files.
    rename_map: old_path_fragment -> new_path_fragment
    e.g., 'Submissions/Americana from Mount' -> 'Submissions/Americana/from Mount'
    """
    updated_files = 0
    total_replacements = 0

    # Sort by longest key first to avoid partial matches
    sorted_renames = sorted(rename_map.items(), key=lambda x: -len(x[0]))

    for md_file in content_dir.rglob('*.md'):
        try:
            text = md_file.read_text()
        except Exception:
            continue

        original = text
        for old_path, new_path in sorted_renames:
            # Match wikilinks: [[old_path]], [[old_path|display]], [[old_path/Attacker]]
            text = text.replace(f'[[{old_path}]]', f'[[{new_path}]]')
            text = text.replace(f'[[{old_path}/', f'[[{new_path}/')
            text = text.replace(f'[[{old_path}|', f'[[{new_path}|')

        if text != original:
            count = sum(text.count(new) - original.count(new) for _, new in sorted_renames if new in text)
            if not dry_run:
                md_file.write_text(text)
            updated_files += 1
            total_replacements += max(1, count)

    # Also update JSON files (related_submissions, related_content)
    for json_file in content_dir.rglob('*.json'):
        try:
            text = json_file.read_text()
        except Exception:
            continue

        original = text
        for old_path, new_path in sorted_renames:
            # In JSON, references are by name not path, so we mainly need
            # to update any explicit path references
            text = text.replace(f'Submissions/{old_path.split("Submissions/")[-1] if "Submissions/" in old_path else old_path}',
                                f'Submissions/{new_path.split("Submissions/")[-1] if "Submissions/" in new_path else new_path}')

        if text != original:
            if not dry_run:
                json_file.write_text(text)
            updated_files += 1

    return updated_files, total_replacements


def cleanup_empty_dirs(submissions_dir: Path):
    """Remove empty directories left after moves."""
    for d in sorted(submissions_dir.rglob('*'), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()


def main():
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print("DRY RUN — no files will be modified\n")

    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    submissions_dir = project_root / 'content' / 'Submissions'
    content_dir = project_root / 'content'

    # Step 1: Discover all submission JSON files
    json_files = list(submissions_dir.glob('*.json'))
    print(f"Found {len(json_files)} submission JSON files")

    # Step 2: Group by base name
    bases = defaultdict(list)  # base_name -> [variant_suffix, ...]
    standalone = []

    for jf in json_files:
        base, variant = parse_submission_name(jf.stem)
        if base and variant:
            bases[base].append(variant)
        else:
            # Check if this base has variants
            stem = jf.stem
            has_variants = any(
                other.stem.startswith(f"{stem} from ") for other in json_files if other != jf
            )
            if has_variants:
                bases[stem]  # ensure key exists
            else:
                standalone.append(jf)

    print(f"  Hub submissions (with variants): {len(bases)}")
    print(f"  Standalone submissions (no variants): {len(standalone)}")
    total_variants = sum(len(v) for v in bases.values())
    print(f"  Total variant files to move: {total_variants}")

    # Step 3: Move files
    rename_map = {}  # For wikilink updates
    moved_count = 0

    for base_name, variants in sorted(bases.items()):
        base_dir = submissions_dir / base_name
        base_dir.mkdir(parents=True, exist_ok=True)

        # Move hub JSON
        hub_json = submissions_dir / f"{base_name}.json"
        hub_json_dst = base_dir / f"{base_name}.json"
        if hub_json.exists() and not hub_json_dst.exists():
            move_file(hub_json, hub_json_dst, dry_run)
            add_is_family_to_json(hub_json_dst if not dry_run else hub_json, dry_run)
            moved_count += 1
        elif hub_json_dst.exists():
            add_is_family_to_json(hub_json_dst, dry_run)

        # Move hub markdown
        hub_md = submissions_dir / f"{base_name}.md"
        hub_md_dst = base_dir / f"{base_name}.md"
        if hub_md.exists() and not hub_md_dst.exists():
            move_file(hub_md, hub_md_dst, dry_run)
            moved_count += 1

        # Hub Attacker/Defender are already in Submissions/BaseName/ — no move needed

        # Move each variant
        for variant_suffix in sorted(variants):
            variant_name = f"{base_name} {variant_suffix}"

            # Move variant JSON
            var_json = submissions_dir / f"{variant_name}.json"
            var_json_dst = base_dir / f"{variant_suffix}.json"
            if var_json.exists():
                move_file(var_json, var_json_dst, dry_run)
                moved_count += 1

            # Move variant markdown
            var_md = submissions_dir / f"{variant_name}.md"
            var_md_dst = base_dir / f"{variant_suffix}.md"
            if var_md.exists():
                move_file(var_md, var_md_dst, dry_run)
                moved_count += 1

            # Move variant Attacker/Defender directory
            var_dir = submissions_dir / variant_name
            var_dir_dst = base_dir / variant_suffix
            if var_dir.exists() and var_dir.is_dir():
                move_directory(var_dir, var_dir_dst, dry_run)
                moved_count += 1

            # Track renames for wikilink updates
            old_path = f"Submissions/{variant_name}"
            new_path = f"Submissions/{base_name}/{variant_suffix}"
            rename_map[old_path] = new_path

    print(f"\nMoved {moved_count} files/directories")

    # Step 4: Cleanup empty directories
    if not dry_run:
        cleanup_empty_dirs(submissions_dir)

    # Step 5: Update wikilinks
    if rename_map:
        print(f"\nUpdating wikilinks ({len(rename_map)} path changes)...")
        updated_files, total_replacements = update_wikilinks(content_dir, rename_map, dry_run)
        print(f"  Updated {updated_files} files")

    print("\nDone!")
    if dry_run:
        print("\nRe-run without --dry-run to execute.")
    else:
        print("\nNext steps:")
        print("  1. Run: npm run regenerate:graph")
        print("  2. Run: npm run regenerate")
        print("  3. Verify: npm run build")


if __name__ == '__main__':
    main()
