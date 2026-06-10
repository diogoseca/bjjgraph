"""
Heuristic file selection since PostHog personal API key is unavailable.
Strategy:
1. Find JSON files with TODO fields (needs content improvement)
2. Find files with oldest/no bot_metadata.last_improved
3. Prioritize high-value content types (Positions > Submissions > Transitions)
"""
import json
import os
import glob
from datetime import datetime

def scan_todos(filepath):
    try:
        with open(filepath) as f:
            text = f.read()
        count = text.count('TODO') + text.count('"todo"') + text.count('"TODO"')
        return count
    except:
        return 0

def get_last_improved(filepath):
    try:
        with open(filepath) as f:
            data = json.load(f)
        meta = data.get('bot_metadata', {})
        li = meta.get('last_improved')
        if li:
            return datetime.strptime(li[:10], '%Y-%m-%d')
        return None
    except:
        return None

def count_overview_chars(filepath):
    try:
        with open(filepath) as f:
            data = json.load(f)
        overview = data.get('overview', data.get('description', ''))
        if isinstance(overview, dict):
            # positions have top/bottom
            chars = sum(len(v) if isinstance(v, str) else 0 for v in overview.values())
        else:
            chars = len(str(overview))
        return chars
    except:
        return 0

# Scan all JSON source files
candidates = []
for category in ['Positions', 'Transitions', 'Submissions']:
    pattern = f'content/{category}/*.json'
    for f in glob.glob(pattern):
        basename = os.path.basename(f)
        if basename.startswith('TEMPLATE') or basename.startswith('CONTRIBUTING'):
            continue
        todos = scan_todos(f)
        last_imp = get_last_improved(f)
        overview_chars = count_overview_chars(f)

        # Score: higher = needs more work
        score = 0
        score += todos * 10  # each TODO worth 10 points
        if last_imp is None:
            score += 50  # never improved
        else:
            days_since = (datetime(2026, 6, 10) - last_imp).days
            score += min(days_since, 100)  # cap at 100
        if overview_chars < 200:
            score += 30
        elif overview_chars < 500:
            score += 10

        # Priority multiplier by category
        if category == 'Positions':
            score *= 1.5
        elif category == 'Submissions':
            score *= 1.3

        candidates.append({
            'file': f,
            'category': category,
            'name': basename.replace('.json', ''),
            'todos': todos,
            'last_improved': last_imp.strftime('%Y-%m-%d') if last_imp else 'never',
            'overview_chars': overview_chars,
            'score': score
        })

candidates.sort(key=lambda x: x['score'], reverse=True)

print("Top 15 candidates by improvement score:")
print(f"{'Score':>6} | {'TODOs':>5} | {'Last Improved':>15} | {'Overview':>8} | File")
print("-" * 80)
for c in candidates[:15]:
    print(f"{c['score']:6.0f} | {c['todos']:5d} | {c['last_improved']:>15} | {c['overview_chars']:>8} | {c['file']}")

print(f"\nSelected top 3:")
selected = candidates[:3]
for c in selected:
    print(f"  {c['file']} (score={c['score']:.0f}, todos={c['todos']}, last_improved={c['last_improved']})")

# Save selected to file
with open('tests/artifacts/selected_files.json', 'w') as f:
    json.dump(selected, f, indent=2, default=str)
print("\nSaved to tests/artifacts/selected_files.json")
