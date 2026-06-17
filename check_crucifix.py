with open('content_catalog_prefixed.txt') as f:
    catalog = set(f.read().strip().split('\n'))

targets = ['Positions/Crucifix', 'Positions/Gift Wrap', 'Submissions/Bow and Arrow Choke']
for t in targets:
    print(f"[{'OK' if t in catalog else 'MISSING'}] {t}")
