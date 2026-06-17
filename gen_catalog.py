import os
from pathlib import Path

BASE = Path('/home/runner/work/bjjgraph/bjjgraph')
catalog = set()

for root, dirs, files in os.walk(BASE / 'content'):
    for f in files:
        if f.startswith('CONTRIBUTING-') or f.startswith('TEMPLATE') or f == 'index.md':
            continue
        name = f.rsplit('.', 1)[0]
        catalog.add(name)

catalog = sorted(catalog)
with open(BASE / 'content_catalog.txt', 'w') as fp:
    fp.write('\n'.join(catalog))

print(f"Total: {len(catalog)} entries")
print("Sample:")
for c in catalog[:20]:
    print(f"  {c}")

# Also build category-prefixed list (for wikilink validation)
prefixed = []
for category in ['Positions', 'Transitions', 'Submissions', 'Systems', 'Learning', 'Principles']:
    cat_path = BASE / 'content' / category
    if not cat_path.exists():
        continue
    for root, dirs, files in os.walk(cat_path):
        rel_root = Path(root).relative_to(BASE / 'content')
        for f in files:
            if f.startswith('CONTRIBUTING-') or f.startswith('TEMPLATE') or f == 'index.md':
                continue
            name = f.rsplit('.', 1)[0]
            prefixed.append(str(rel_root / name))

prefixed = sorted(set(prefixed))
with open(BASE / 'content_catalog_prefixed.txt', 'w') as fp:
    fp.write('\n'.join(prefixed))
print(f"\nPrefixed catalog: {len(prefixed)} entries")
for p in prefixed[:10]:
    print(f"  {p}")
