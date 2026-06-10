import json

with open('templates/Positions/TEMPLATE-DUAL.json') as f:
    schema = json.load(f)

# Remove bot_metadata from $defs if it ended up there
if '$defs' in schema and 'bot_metadata' in schema['$defs']:
    del schema['$defs']['bot_metadata']

# Add bot_metadata to top-level properties
schema['properties']['bot_metadata'] = {
    "type": "object",
    "description": "Bot improvement tracking metadata",
    "properties": {
        "last_improved": {
            "type": "string",
            "description": "ISO date of last bot improvement (YYYY-MM-DD)"
        },
        "improvement_notes": {
            "type": "string",
            "description": "Notes on what was improved"
        }
    },
    "additionalProperties": True
}

with open('templates/Positions/TEMPLATE-DUAL.json', 'w') as f:
    json.dump(schema, f, indent=2)

print("Fixed. Properties:", list(schema['properties'].keys())[-6:])
