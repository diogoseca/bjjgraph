import json
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')

def check_wikilinks(path):
    return open(path).read().count('[[')

def get_last_improved(path):
    with open(path) as f:
        try:
            data = json.load(f)
        except:
            return None
    return data.get('bot_metadata', {}).get('last_improved')

print("=== POSITIONS ===")
pos_files = sorted((BASE / 'content' / 'Positions').glob('*.json'))
pos_wl = [(check_wikilinks(p), p) for p in pos_files if not p.name.startswith('TEMPLATE')]
pos_with_wl = [(wl, p) for wl, p in pos_wl if wl > 0]
print(f"Total: {len(pos_wl)}, With wikilinks: {len(pos_with_wl)}")
for wl, p in sorted(pos_with_wl, reverse=True)[:5]:
    print(f"  WL:{wl} {p.name}")

print("\n=== TRANSITIONS ===")
trans_files = sorted((BASE / 'content' / 'Transitions').glob('*.json'))
trans_wl = [(check_wikilinks(p), p) for p in trans_files if not p.name.startswith('TEMPLATE')]
trans_with_wl = [(wl, p) for wl, p in trans_wl if wl > 0]
print(f"Total: {len(trans_wl)}, With wikilinks: {len(trans_with_wl)}")
for wl, p in sorted(trans_with_wl, reverse=True)[:5]:
    print(f"  WL:{wl} {p.name}")
    imp = get_last_improved(p)
    print(f"    Last improved: {imp or 'never'}")

print("\n=== Overall picture ===")
all_positions_no_wl = sum(1 for wl, p in pos_wl if wl == 0)
all_trans_no_wl = sum(1 for wl, p in trans_wl if wl == 0)
print(f"Positions with 0 wikilinks: {all_positions_no_wl}/{len(pos_wl)}")
print(f"Transitions with 0 wikilinks: {all_trans_no_wl}/{len(trans_wl)}")

# Focus: find highest-traffic content types to improve
# Transitions with attacker/defender flashcards but no wikilinks
print("\n=== TRANSITIONS with attacker/defender but no wikilinks ===")
for p in trans_files[:10]:
    if p.name.startswith('TEMPLATE'):
        continue
    wl = check_wikilinks(p)
    with open(p) as f:
        try:
            data = json.load(f)
        except:
            continue
    att = data.get('attacker', {}) or {}
    att_fc = len(att.get('flashcards', []))
    imp = get_last_improved(p)
    print(f"  WL:{wl:2d} | AttFC:{att_fc:2d} | Improved:{imp or 'never':>12} | {p.name}")
