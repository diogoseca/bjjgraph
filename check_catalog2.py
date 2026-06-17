targets2 = [
    'Positions/Mount/High Mount',
    'Positions/Mount/S Mount',
    'Positions/Mount/Technical Mount',
    'Positions/Mount/Mounted Triangle',
    'Positions/Mount/Mounted Crucifix',
    'Positions/Ashi Garami/Deep Half Guard',
    'Positions/Half Guard/Deep Half Guard',
    'Transitions/Americana',
    'Transitions/Americana from Mount',
    'Transitions/Cross Collar Choke',
    'Transitions/Loop Choke from Mount',
    'Transitions/Kimura from Mount',
    'Transitions/Kimura from Half Guard',
    'Transitions/Reverse Armbar from Mount',
    'Transitions/Mount Control',
    'Transitions/Trap and Roll from High Mount',
    'Transitions/Mount to Knee on Belly',
    'Transitions/Mount to 3-4 Mount',
    'Positions/Closed Guard',
    'Positions/Half Guard',
    'Positions/Gift Wrap',
    'Positions/Back Control',
    'Positions/Back Control/Body Triangle',
    'Positions/Back Control/Seat Belt Control Back',
]

with open('content_catalog_prefixed.txt') as f:
    catalog = set(f.read().strip().split('\n'))

print("Checking additional wikilink targets:")
for t in targets2:
    status = 'OK' if t in catalog else 'MISSING'
    print(f"  [{status}] {t}")
