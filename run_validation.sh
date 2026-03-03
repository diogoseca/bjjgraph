#!/bin/bash
echo "=== Command 1 ==="
python3 scripts/validate_json.py --file 'source/content/Positions/Half Guard.json'
echo "Exit code: $?"
echo ""
echo "=== Command 2 ==="
python3 scripts/validate_json.py --file 'source/content/Positions/Ashi Garami/Outside Ashi-Garami.json'
echo "Exit code: $?"
