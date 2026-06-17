import json
import os
import subprocess
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')

def count_todos(filepath):
    with open(filepath) as f:
        content = f.read()
    return content.count('TODO') + content.count('"todo"') + content.count("'todo'")

def get_last_improved(filepath):
    with open(filepath) as f:
        try:
            data = json.load(f)
        except:
            return None
    return data.get('bot_metadata', {}).get('last_improved', None)

def get_flashcard_count(filepath):
    with open(filepath) as f:
        try:
            data = json.load(f)
        except:
            return 0
    count = 0
    # Check all possible flashcard locations
    if 'flashcards' in data:
        count += len(data.get('flashcards', []))
    if 'top' in data and isinstance(data['top'], dict):
        count += len(data['top'].get('flashcards', []))
    if 'bottom' in data and isinstance(data['bottom'], dict):
        count += len(data['bottom'].get('flashcards', []))
    if 'attacker' in data and isinstance(data['attacker'], dict):
        count += len(data['attacker'].get('flashcards', []))
    if 'defender' in data and isinstance(data['defender'], dict):
        count += len(data['defender'].get('flashcards', []))
    return count

def get_wikilink_count(filepath):
    with open(filepath) as f:
        content = f.read()
    return content.count('[[')

def get_field_depth(filepath):
    with open(filepath) as f:
        try:
            data = json.load(f)
        except:
            return 0
    depth = 0
    top = data.get('top', {}) or {}
    bottom = data.get('bottom', {}) or {}
    attacker = data.get('attacker', {}) or {}
    defender = data.get('defender', {}) or {}
    for role in [top, bottom, attacker, defender]:
        for field in ['key_principles', 'key_concepts', 'common_mistakes', 'decision_tree', 'techniques']:
            val = role.get(field, [])
            if isinstance(val, list):
                depth += len(val)
    return depth

print("Scanning content JSON files for TODO-heavy and thin content...")

# First pass: find files with actual TODOs
todo_files = []
for category in ['Positions', 'Transitions', 'Submissions']:
    cat_path = BASE / 'content' / category
    if not cat_path.exists():
        continue
    for json_file in sorted(cat_path.glob('*.json')):
        if json_file.name.startswith('TEMPLATE'):
            continue
        todos = count_todos(json_file)
        if todos > 0:
            last_improved = get_last_improved(json_file)
            fc = get_flashcard_count(json_file)
            wl = get_wikilink_count(json_file)
            todo_files.append({
                'file': str(json_file.relative_to(BASE)),
                'todos': todos,
                'last_improved': last_improved,
                'flashcards': fc,
                'wikilinks': wl
            })

todo_files.sort(key=lambda x: -x['todos'])
print(f"\nFiles with TODOs ({len(todo_files)} total):")
for f in todo_files[:20]:
    print(f"  TODOs:{f['todos']:3d} | FC:{f['flashcards']:2d} | WL:{f['wikilinks']:2d} | Improved:{f['last_improved'] or 'never':>12} | {f['file']}")

# Second pass: thin flashcards + few wikilinks + never improved
print("\n\nFiles with thin content (few flashcards AND few wikilinks, never improved):")
thin_files = []
for category in ['Positions', 'Transitions', 'Submissions']:
    cat_path = BASE / 'content' / category
    if not cat_path.exists():
        continue
    for json_file in sorted(cat_path.glob('*.json')):
        if json_file.name.startswith('TEMPLATE'):
            continue
        todos = count_todos(json_file)
        if todos > 0:
            continue  # already covered above
        last_improved = get_last_improved(json_file)
        if last_improved and last_improved >= '2026-04-01':
            continue  # recently improved
        fc = get_flashcard_count(json_file)
        wl = get_wikilink_count(json_file)
        depth = get_field_depth(json_file)
        score = 0
        if fc < 3:
            score += 20
        elif fc < 6:
            score += 10
        if wl < 6:
            score += 15
        elif wl < 10:
            score += 8
        if depth < 5:
            score += 10
        if last_improved is None:
            score += 5

        if score > 0:
            thin_files.append({
                'file': str(json_file.relative_to(BASE)),
                'todos': todos,
                'last_improved': last_improved,
                'flashcards': fc,
                'wikilinks': wl,
                'depth': depth,
                'score': score
            })

thin_files.sort(key=lambda x: -x['score'])
for f in thin_files[:15]:
    print(f"  Score:{f['score']:2d} | FC:{f['flashcards']:2d} | WL:{f['wikilinks']:2d} | Depth:{f['depth']:2d} | Improved:{f['last_improved'] or 'never':>12} | {f['file']}")

# Selection
print("\n\n=== FINAL SELECTION ===")
selected = (todo_files[:3] if todo_files else []) + (thin_files[:3] if thin_files else [])
# Deduplicate
seen = set()
final = []
for f in selected:
    if f['file'] not in seen:
        seen.add(f['file'])
        final.append(f)
final = final[:3]
for f in final:
    print(f"  {f['file']}")

with open(str(BASE / 'selected_files.json'), 'w') as fp:
    json.dump(final, fp, indent=2)
