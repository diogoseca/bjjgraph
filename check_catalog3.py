targets3 = [
    'Submissions/Americana/from Mount',
    'Submissions/Armbar/from Mount',
    'Submissions/Cross Collar Choke/from Mount',
    'Submissions/Ezekiel Choke/from Mount',
    'Submissions/Kimura/from Mount',
    'Submissions/Loop Choke/from Mount',
    'Submissions/Reverse Armbar from Mount',
    'Submissions/Armbar/Reverse Armbar from Mount',
    'Transitions/Americana from Mount',
]

with open('content_catalog_prefixed.txt') as f:
    catalog = set(f.read().strip().split('\n'))

print("Checking submission variant targets:")
for t in targets3:
    status = 'OK' if t in catalog else 'MISSING'
    print(f"  [{status}] {t}")

print("\nAll submission families:")
for line in sorted(catalog):
    if line.startswith('Submissions/') and line.count('/') == 1:
        print(f"  {line}")
