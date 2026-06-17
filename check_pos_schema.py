import json

with open('templates/Positions/TEMPLATE-DUAL.json') as f:
    schema = json.load(f)

def find_flashcards(obj, path=''):
    if isinstance(obj, dict):
        if 'flashcards' in obj:
            print(f'Found flashcards at: {path}')
        for k, v in obj.items():
            find_flashcards(v, path+'.'+k)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            find_flashcards(item, path+f'[{i}]')

find_flashcards(schema)
print('Top-level required:', schema.get('required', []))
props = schema.get('properties', {})
print('Top-level props:', list(props.keys()))

top_props = props.get('top', {}).get('properties', {})
print('Top role props:', list(top_props.keys()))
