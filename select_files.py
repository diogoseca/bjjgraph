import json
import os
import subprocess
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')

def count_todos(filepath):
    with open(filepath) as f:
        content = f.read()
    return content.count('TODO') + content.count('todo')

def get_last_improved(filepath):
    with open(filepath) as f:
        try:
            data = json.load(f)
        except:
            return None
    return data.get('bot_metadata', {}).get('last_improved', None)

def get_overview_length(filepath):
    with open(filepath) as f:
        try:
            data = json.load(f)
        except:
            return 999
    overview = data.get('overview', '')
    if not overview:
        return 0
    return len(overview)

def get_git_age_days(filepath):
    result = subprocess.run(
        ['git', 'log', '-1', '--format=%at', '--', str(filepath)],
        capture_output=True, text=True, cwd=BASE
    )
    if result.stdout.strip():
        import time
        last_commit = int(result.stdout.strip())
        now = int(time.time())
        return (now - last_commit) // 86400
    return 999

print("Scanning content JSON files...")
candidates = []

for category in ['Positions', 'Transitions', 'Submissions']:
    cat_path = BASE / 'content' / category
    if not cat_path.exists():
        continue
    for json_file in sorted(cat_path.glob('*.json')):
        if json_file.name.startswith('TEMPLATE'):
            continue
        todos = count_todos(json_file)
        last_improved = get_last_improved(json_file)
        overview_len = get_overview_length(json_file)
        age_days = get_git_age_days(json_file)

        score = 0
        if todos > 0:
            score += todos * 10
        if last_improved is None:
            score += 20
        elif last_improved < '2026-01-01':
            score += 15
        elif last_improved < '2026-04-01':
            score += 10
        if overview_len < 300:
            score += 15
        elif overview_len < 500:
            score += 5
        if age_days > 60:
            score += 10

        candidates.append({
            'file': str(json_file.relative_to(BASE)),
            'category': category,
            'todos': todos,
            'last_improved': last_improved,
            'overview_len': overview_len,
            'age_days': age_days,
            'score': score
        })

candidates.sort(key=lambda x: -x['score'])
print(f"\nTop 10 candidates (by improvement priority):")
for c in candidates[:10]:
    print(f"  Score {c['score']:3d} | TODOs:{c['todos']:2d} | Improved:{c['last_improved'] or 'never':>12} | Overview:{c['overview_len']:4d}ch | Age:{c['age_days']:3d}d | {c['file']}")

print(f"\nSelected top 3:")
for c in candidates[:3]:
    print(f"  {c['file']}")

with open(str(BASE / 'selected_files.json'), 'w') as f:
    json.dump(candidates[:5], f, indent=2)
