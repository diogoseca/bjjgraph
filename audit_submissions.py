import json
import os
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')
sub_dir = BASE / 'content' / 'Submissions'

# Find all DUAL files (in subdirectories) and check for wikilinks/quality
dual_files = []
family_files = []

for p in sorted(sub_dir.rglob('*.json')):
    if p.name.startswith('TEMPLATE'):
        continue
    with open(p) as f:
        try:
            data = json.load(f)
        except:
            continue
    content = open(p).read()
    wikilinks = content.count('[[')
    is_family = data.get('is_family', False)

    if is_family:
        family_files.append({
            'path': str(p.relative_to(BASE)),
            'wikilinks': wikilinks,
            'has_variations_and_setups': bool(data.get('variations_and_setups')),
        })
    else:
        attacker = data.get('attacker', {}) or {}
        defender = data.get('defender', {}) or {}
        att_fc = len(attacker.get('flashcards', []))
        def_fc = len(defender.get('flashcards', []))
        att_kp = len(attacker.get('key_principles', []))
        def_kp = len(defender.get('key_principles', []))
        dual_files.append({
            'path': str(p.relative_to(BASE)),
            'wikilinks': wikilinks,
            'att_flashcards': att_fc,
            'def_flashcards': def_fc,
            'att_key_principles': att_kp,
            'def_key_principles': def_kp,
            'last_improved': data.get('bot_metadata', {}).get('last_improved'),
        })

print(f"DUAL files: {len(dual_files)} total")
dual_files.sort(key=lambda x: x['wikilinks'])
print("\nDual files with fewest wikilinks:")
for f in dual_files[:15]:
    print(f"  WL:{f['wikilinks']:2d} | AttFC:{f['att_flashcards']:2d} | DefFC:{f['def_flashcards']:2d} | AttKP:{f['att_key_principles']} | Improved:{f['last_improved'] or 'never':>12} | {f['path']}")

print(f"\nFAMILY files: {len(family_files)} total")
family_files.sort(key=lambda x: x['wikilinks'])
print("\nFamily files with fewest wikilinks:")
for f in family_files[:10]:
    print(f"  WL:{f['wikilinks']:2d} | HasVariationsAndSetups:{f['has_variations_and_setups']} | {f['path']}")
