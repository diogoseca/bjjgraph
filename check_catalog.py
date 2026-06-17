targets = [
    'Submissions/Americana',
    'Submissions/Armbar',
    'Submissions/Kimura',
    'Submissions/Rear Naked Choke',
    'Submissions/Cross Collar Choke',
    'Submissions/Ezekiel Choke',
    'Submissions/Triangle Choke',
    'Positions/Mount',
    'Positions/Back Control',
    'Positions/Closed Guard',
    'Positions/Half Guard',
    'Positions/Side Control',
    'Positions/High Mount',
    'Positions/S Mount',
    'Positions/Technical Mount',
    'Positions/Armbar Control',
    'Positions/Deep Half Guard',
    'Positions/Turtle',
    'Positions/North-South',
    'Positions/Knee on Belly',
    'Transitions/Mount to Armbar',
    'Transitions/Elbow Escape from Mount',
    'Transitions/Upa Escape',
    'Transitions/Americana from Mount',
    'Transitions/Cross Collar Choke from Mount',
    'Transitions/Ezekiel Choke from Mount',
    'Transitions/High Mount Transition',
    'Transitions/Gift Wrap to Technical Mount',
    'Transitions/Back Take from Top',
    'Transitions/Trap and Roll from Mount',
    'Transitions/S-Mount Transition',
    'Transitions/Mounted Triangle',
    'Transitions/Bridge and Roll',
    'Transitions/Explosive Bridge to Guard Recovery',
    'Transitions/Explosive Bridge to Turtle',
    'Transitions/Heel Drag Escape',
    'Transitions/Mount to Technical Mount',
    'Transitions/Mount Escape to Half Guard Back Take',
    'Transitions/Consolidate Mount',
    'Transitions/Loop Choke from Mount',
    'Transitions/Reverse Armbar from Mount',
    'Transitions/Kimura from Mount',
]

with open('content_catalog_prefixed.txt') as f:
    catalog = set(f.read().strip().split('\n'))

print("Checking wikilink targets:")
for t in targets:
    status = 'OK' if t in catalog else 'MISSING'
    print(f"  [{status}] {t}")
