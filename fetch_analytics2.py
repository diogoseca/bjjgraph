import requests
import json
import os

api_key = os.environ.get('POSTHOG_API_KEY')
base_url = "https://us.posthog.com/api/projects/236155/query/"
print(f"Key type: {api_key[:10] if api_key else 'NONE'}")

# Try different auth methods
attempts = [
    ("Bearer", {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}),
    ("Token", {"Authorization": f"Token {api_key}", "Content-Type": "application/json"}),
]

query_str = "SELECT count() FROM events LIMIT 1"
payload = {"query": {"kind": "HogQLQuery", "query": query_str}}

for name, headers in attempts:
    resp = requests.post(base_url, headers=headers, json=payload)
    print(f"{name} auth - Status: {resp.status_code}, Response: {resp.text[:200]}")
