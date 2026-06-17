import json

with open('templates/Positions/TEMPLATE-DUAL.json') as f:
    schema = json.load(f)

props = schema.get('properties', {})
top_schema = props.get('top', {})
print('Top role required:', top_schema.get('required', []))

fc_schema = top_schema.get('properties', {}).get('flashcards', {})
print('Flashcards schema:', json.dumps(fc_schema, indent=2)[:500])

# Check an actual Position file with flashcards
with open('content/Positions/Mount.json') as f:
    mount = json.load(f)

top = mount.get('top', {})
print('\nMount top keys:', list(top.keys()))
print('Mount top flashcards:', top.get('flashcards', 'NOT PRESENT'))

# Check top has other content
print('Mount top key_principles:', len(top.get('key_principles', [])))
print('Mount top transitions:', len(top.get('transitions', [])))
print('Mount top decision_tree:', len(top.get('decision_tree', [])))
