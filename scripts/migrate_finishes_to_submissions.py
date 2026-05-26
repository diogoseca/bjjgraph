#!/usr/bin/env python3
"""
Migrate game-over transitions to Submissions.

Finds all transitions whose success outcome is game-over and either:
1. Deletes them if an equivalent submission variant already exists
2. Moves them to the appropriate Submissions/ family directory

Also updates all references (position JSONs, other transitions, wikilinks).
"""

import json
import re
import shutil
import sys
from pathlib import Path
from collections import defaultdict


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = slug.replace('%', ' percent ').replace('&', ' and ')
    slug = slug.replace("'", '').replace('"', '')
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return re.sub(r'-+', '-', slug).strip('-')


def find_game_over_transitions(transitions_dir: Path) -> list[dict]:
    """Find all transitions with success outcome = game-over."""
    results = []
    for f in sorted(transitions_dir.rglob('*.json')):
        try:
            data = json.load(open(f))
        except (json.JSONDecodeError, OSError):
            continue
        for o in data.get('outcomes', []):
            if o.get('result') == 'success' and o.get('to') == 'game-over':
                results.append({
                    'name': data.get('name', f.stem),
                    'from_position': data.get('from_position', ''),
                    'path': f,
                    'data': data,
                })
                break
    return results


def find_matching_submission(name: str, from_pos: str, submissions_dir: Path) -> Path | None:
    """Find an existing submission variant that matches this transition.

    Skips family hubs (is_family: true) — we want the specific variant, not the hub.
    Uses from_position to find the right variant when the transition name matches a family.
    """
    # First try exact name match (non-hub)
    for f in submissions_dir.rglob('*.json'):
        try:
            data = json.load(open(f))
        except (json.JSONDecodeError, OSError):
            continue
        if data.get('is_family'):
            continue
        if data.get('name') == name:
            return f

    # If transition name matches a family, find the variant by from_position
    if from_pos:
        pos_name = from_pos.split('/')[0]
        variant_name = f"{name} from {pos_name}"
        for f in submissions_dir.rglob('*.json'):
            try:
                data = json.load(open(f))
            except (json.JSONDecodeError, OSError):
                continue
            if data.get('is_family'):
                continue
            if data.get('name') == variant_name:
                return f

    return None


def get_submission_family(name: str) -> tuple[str, str]:
    """Determine the submission family and variant suffix.

    'Americana' from 'Side Control/Top' → ('Americana', 'from Side Control')
    'Armbar Finish' → ('Armbar', 'Finish')
    'Heel Hook from Saddle' → ('Heel Hook', 'from Saddle')
    'Cross Collar Choke Finish' → ('Cross Collar Choke', 'Finish')
    """
    # Pattern: "X from Y" → family X, variant "from Y"
    match = re.match(r'^(.+?)\s+(from\s+.+)$', name)
    if match:
        return match.group(1), match.group(2)

    # Pattern: "X Finish" → family X, variant "Finish"
    match = re.match(r'^(.+?)\s+Finish$', name)
    if match:
        return match.group(1), 'Finish'

    # No pattern → use from_position to create variant name
    return name, ''


def update_position_references(content_dir: Path, old_name: str, new_name: str, dry_run: bool = False):
    """Update position JSONs that reference a renamed transition."""
    updated = 0
    positions_dir = content_dir / 'Positions'
    for f in positions_dir.rglob('*.json'):
        try:
            text = f.read_text()
        except OSError:
            continue
        if old_name not in text:
            continue
        data = json.loads(text)
        changed = False
        for role in ('top', 'bottom'):
            role_data = data.get(role, {})
            for t in role_data.get('transitions', []):
                if t.get('transition') == old_name:
                    t['transition'] = new_name
                    changed = True
            # Also check decision_tree actions
            for dt in role_data.get('decision_tree', []):
                for action in dt.get('actions', []):
                    if action.get('technique') == old_name:
                        action['technique'] = new_name
                        changed = True
        if changed and not dry_run:
            with open(f, 'w') as fh:
                json.dump(data, fh, indent=2)
                fh.write('\n')
            updated += 1
    return updated


def update_transition_references(content_dir: Path, old_name: str, new_name: str, dry_run: bool = False):
    """Update other transition JSONs that reference this transition in outcomes."""
    updated = 0
    transitions_dir = content_dir / 'Transitions'
    for f in transitions_dir.rglob('*.json'):
        try:
            text = f.read_text()
        except OSError:
            continue
        if old_name not in text:
            continue
        data = json.loads(text)
        changed = False
        for o in data.get('outcomes', []):
            if o.get('to') == old_name:
                o['to'] = new_name
                changed = True
        # Check related_content
        for rc in data.get('related_content', []):
            if rc.get('name') == old_name:
                rc['name'] = new_name
                changed = True
        if changed and not dry_run:
            with open(f, 'w') as fh:
                json.dump(data, fh, indent=2)
                fh.write('\n')
            updated += 1
    return updated


def main():
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print("DRY RUN — no files will be modified\n")

    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    content_dir = project_root / 'content'
    transitions_dir = content_dir / 'Transitions'
    submissions_dir = content_dir / 'Submissions'

    # Find all game-over transitions
    game_over = find_game_over_transitions(transitions_dir)
    print(f"Found {len(game_over)} transitions with success → game-over\n")

    deleted = 0
    moved = 0
    skipped = 0
    pos_refs_updated = 0
    trans_refs_updated = 0

    for t in game_over:
        name = t['name']
        from_pos = t['from_position']
        t_path = t['path']

        # Check if equivalent submission already exists
        existing = find_matching_submission(name, from_pos, submissions_dir)

        if existing:
            # Submission exists — delete transition, it's a duplicate
            print(f"  DELETE: {name} (duplicate of {existing.relative_to(submissions_dir)})")
            if not dry_run:
                # Delete transition JSON
                t_path.unlink()
                # Delete associated markdown and subdirectory
                t_md = t_path.with_suffix('.md')
                if t_md.exists():
                    t_md.unlink()
                t_dir = t_path.parent / name
                if t_dir.exists() and t_dir.is_dir():
                    shutil.rmtree(t_dir)

            # Update references to point to submission name
            sub_data = json.load(open(existing))
            sub_name = sub_data.get('name', name)
            if sub_name != name:
                refs = update_position_references(content_dir, name, sub_name, dry_run)
                pos_refs_updated += refs
                refs = update_transition_references(content_dir, name, sub_name, dry_run)
                trans_refs_updated += refs
            deleted += 1
        else:
            # No matching submission — move to Submissions/
            family, variant = get_submission_family(name)
            if not variant and from_pos:
                # Use from_position to create variant name
                pos_name = from_pos.split('/')[0]
                variant = f"from {pos_name}"

            if not variant:
                print(f"  SKIP: {name} (can't determine family/variant)")
                skipped += 1
                continue

            family_dir = submissions_dir / family
            family_dir.mkdir(parents=True, exist_ok=True)
            dest = family_dir / f"{variant}.json"

            if dest.exists():
                # Variant already exists in Submissions — delete the transition
                print(f"  DELETE: {name} (variant already at {dest.relative_to(submissions_dir)})")
                if not dry_run:
                    t_path.unlink()
                    t_md = t_path.with_suffix('.md')
                    if t_md.exists():
                        t_md.unlink()
                    t_dir = t_path.parent / name
                    if t_dir.exists() and t_dir.is_dir():
                        shutil.rmtree(t_dir)
                deleted += 1
                continue

            print(f"  MOVE: {name} → Submissions/{family}/{variant}.json")
            if not dry_run:
                shutil.move(str(t_path), str(dest))
                # Clean up old markdown and subdirectory
                t_md = t_path.with_suffix('.md')
                if t_md.exists():
                    t_md.unlink()
                t_dir = t_path.parent / name
                if t_dir.exists() and t_dir.is_dir():
                    shutil.rmtree(t_dir)

            # Update the submission name in the JSON to match new location
            if not dry_run:
                data = json.load(open(dest))
                new_name = f"{family} {variant}" if not variant.startswith('from') else f"{family} {variant}"
                # Keep the original name for now — the graph uses name field
                # data['name'] = new_name  # Don't rename, graph references use original name
                with open(dest, 'w') as f:
                    json.dump(data, f, indent=2)
                    f.write('\n')

            moved += 1

    print(f"\nResults:")
    print(f"  Deleted (duplicates): {deleted}")
    print(f"  Moved to Submissions: {moved}")
    print(f"  Skipped: {skipped}")
    print(f"  Position refs updated: {pos_refs_updated}")
    print(f"  Transition refs updated: {trans_refs_updated}")

    if not dry_run and (deleted + moved) > 0:
        print("\nNext: run 'pnpm regenerate' to update graph and regenerate content")


if __name__ == '__main__':
    main()
