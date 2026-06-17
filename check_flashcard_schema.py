import json

with open('templates/Positions/TEMPLATE-DUAL.json') as f:
    schema = json.load(f)

defs = schema.get('$defs', {})
fc_def = defs.get('flashcards', {})
print("Flashcard $def:", json.dumps(fc_def, indent=2)[:1000])

top_fc = schema['properties']['top']['properties']['flashcards']
print("\nTop flashcards ref:", json.dumps(top_fc, indent=2))
