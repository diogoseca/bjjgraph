import json
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')
found = []

for p in BASE.rglob('content/**/*.json'):
    if p.name.startswith('TEMPLATE'):
        continue
    try:
        with open(p) as f:
            data = json.load(f)
        if 'bot_metadata' in data:
            found.append((str(p.relative_to(BASE)), data['bot_metadata']))
    except:
        pass

print(f"Files with bot_metadata: {len(found)}")
for path, meta in found[:10]:
    print(f"  {path}: {meta}")
