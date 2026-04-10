#!/usr/bin/env python3
"""
Unify all submissions into family structure with hubs at parent level.

1. Move 45 existing family hub files from inside folders to parent level
2. Convert 41 standalones into families (split into hub + variant)
3. Clean up duplicates and stale files

Target structure (matches Positions pattern):
  Submissions/Americana.json          ← family hub at parent level
  Submissions/Americana/
    from Side Control.json            ← variant
    from Side Control/Attacker.md
"""

import json
import shutil
import sys
from pathlib import Path


def main():
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print("DRY RUN\n")

    subs = Path('content/Submissions')

    # =========================================================================
    # PHASE 1: Move 45 family hub files from inside folders to parent level
    # =========================================================================
    print("Phase 1: Move family hub files to parent level")
    moved = 0
    for d in sorted(subs.iterdir()):
        if not d.is_dir():
            continue
        hub_inside = d / f'{d.name}.json'
        hub_outside = subs / f'{d.name}.json'
        if not hub_inside.exists():
            continue

        data = json.load(open(hub_inside))
        if not data.get('is_family'):
            continue

        # Move JSON
        if hub_outside.exists():
            # Parent-level file exists (old flat version) — replace with hub
            if not dry_run:
                hub_outside.unlink()
        if not dry_run:
            shutil.move(str(hub_inside), str(hub_outside))
        print(f"  MOVE: {d.name}/{d.name}.json → {d.name}.json")

        # Move MD
        md_inside = d / f'{d.name}.md'
        md_outside = subs / f'{d.name}.md'
        if md_inside.exists():
            if md_outside.exists() and not dry_run:
                md_outside.unlink()
            if not dry_run:
                shutil.move(str(md_inside), str(md_outside))
        moved += 1

    print(f"  Moved {moved} family hubs to parent level\n")

    # =========================================================================
    # PHASE 2: Convert 41 standalones into families
    # =========================================================================
    print("Phase 2: Convert standalones to families")
    converted = 0
    for f in sorted(subs.glob('*.json')):
        data = json.load(open(f))
        if data.get('is_family'):
            continue  # Already a family hub

        name = f.stem
        family_dir = subs / name
        from_pos = data.get('from_position', '')
        if not from_pos:
            print(f"  SKIP: {name} (no from_position)")
            continue

        # Derive variant name from from_position
        pos_base = from_pos.split('/')[0]
        variant_name = f'from {pos_base}'
        variant_filename = f'{variant_name}.json'

        # Check if variant already exists
        if family_dir.exists() and (family_dir / variant_filename).exists():
            # Variant exists — just convert the hub
            if not data.get('is_family'):
                data['is_family'] = True
                if 'variations' not in data:
                    data['variations'] = [
                        {'name': vf.stem, 'slug': vf.stem.lower().replace(' ', '-')}
                        for vf in sorted(family_dir.glob('from *.json'))
                    ]
                # Strip role content from hub
                for key in ('attacker', 'defender', 'outcomes'):
                    data.pop(key, None)
                if not dry_run:
                    with open(f, 'w') as fh:
                        json.dump(data, fh, indent=2)
                        fh.write('\n')
                print(f"  CONVERT HUB: {name} (variant already at {variant_name})")
                converted += 1
            continue

        # Create family directory
        family_dir.mkdir(parents=True, exist_ok=True)

        # Create variant JSON from the standalone's content
        variant_data = json.loads(json.dumps(data))
        variant_data['name'] = f'{name} {variant_name}'

        if not dry_run:
            with open(family_dir / variant_filename, 'w') as fh:
                json.dump(variant_data, fh, indent=2)
                fh.write('\n')

        # Move Attacker/Defender into variant subfolder
        variant_dir = family_dir / variant_name
        variant_dir.mkdir(parents=True, exist_ok=True)
        for role_file in ('Attacker.md', 'Defender.md'):
            src = family_dir / role_file
            dst = variant_dir / role_file
            if src.exists() and not dst.exists():
                if not dry_run:
                    shutil.move(str(src), str(dst))

        # Convert the parent file into a family hub
        data['is_family'] = True
        data['variations'] = [{'name': variant_name, 'slug': variant_name.lower().replace(' ', '-')}]
        # Strip role content — hub is informational only
        for key in ('attacker', 'defender', 'outcomes'):
            data.pop(key, None)

        if not dry_run:
            with open(f, 'w') as fh:
                json.dump(data, fh, indent=2)
                fh.write('\n')

        print(f"  CONVERT: {name} → hub + {variant_name}")
        converted += 1

    print(f"  Converted {converted} standalones to families\n")

    # =========================================================================
    # PHASE 3: Sync all family hub variations arrays
    # =========================================================================
    print("Phase 3: Sync variations arrays")
    synced = 0
    for f in sorted(subs.glob('*.json')):
        data = json.load(open(f))
        if not data.get('is_family'):
            continue
        family_dir = subs / f.stem
        if not family_dir.is_dir():
            continue

        actual = [
            {'name': vf.stem, 'slug': vf.stem.lower().replace(' ', '-')}
            for vf in sorted(family_dir.glob('from *.json'))
        ]
        if data.get('variations') != actual:
            data['variations'] = actual
            if not dry_run:
                with open(f, 'w') as fh:
                    json.dump(data, fh, indent=2)
                    fh.write('\n')
            synced += 1

    print(f"  Synced {synced} variations arrays\n")

    # =========================================================================
    # PHASE 4: Clean up stale files
    # =========================================================================
    print("Phase 4: Cleanup")
    cleaned = 0

    # Remove hub JSONs still inside folders (duplicates of parent-level hubs)
    for d in sorted(subs.iterdir()):
        if not d.is_dir():
            continue
        hub_inside = d / f'{d.name}.json'
        hub_outside = subs / f'{d.name}.json'
        if hub_inside.exists() and hub_outside.exists():
            if not dry_run:
                hub_inside.unlink()
            print(f"  DELETE: {d.name}/{d.name}.json (duplicate of parent)")
            cleaned += 1
            # Also remove duplicate MD
            md_inside = d / f'{d.name}.md'
            if md_inside.exists():
                if not dry_run:
                    md_inside.unlink()
                cleaned += 1

    # Remove stale Attacker/Defender from family hub directories
    for f in sorted(subs.glob('*.json')):
        data = json.load(open(f))
        if not data.get('is_family'):
            continue
        family_dir = subs / f.stem
        for role in ('Attacker.md', 'Defender.md'):
            stale = family_dir / role
            if stale.exists():
                if not dry_run:
                    stale.unlink()
                print(f"  DELETE: {f.stem}/{role} (stale role page on family hub)")
                cleaned += 1

    # Remove empty directories
    for d in sorted(subs.rglob('*'), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            if not dry_run:
                d.rmdir()
            cleaned += 1

    print(f"  Cleaned {cleaned} stale files/dirs\n")

    # =========================================================================
    # SUMMARY
    # =========================================================================
    total_hubs = len(list(subs.glob('*.json')))
    total_variants = sum(1 for _ in subs.rglob('from *.json'))
    print(f"Done! Family hubs: {total_hubs}, Variants: {total_variants}")

    if dry_run:
        print("\nRe-run without --dry-run to execute.")


if __name__ == '__main__':
    main()
