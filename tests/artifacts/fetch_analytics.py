import requests
import json
import os

API_KEY = os.environ.get('POSTHOG_API_KEY', '')
BASE_URL = "https://us.posthog.com"
PROJECT_ID = 236155

print(f"Key prefix: {API_KEY[:10]}, length: {len(API_KEY)}")

# Try both auth approaches
def run_query(hogql, label, auth_header=None):
    print(f"Fetching {label}...")
    h = {"Content-Type": "application/json"}
    if auth_header:
        h["Authorization"] = auth_header
    resp = requests.post(
        f"{BASE_URL}/api/projects/{PROJECT_ID}/query/",
        headers=h,
        json={"query": {"kind": "HogQLQuery", "query": hogql}},
        timeout=30
    )
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  Error: {resp.text[:200]}")
        return None
    data = resp.json()
    rows = data.get('results', [])
    print(f"  Got {len(rows)} rows")
    return rows

# Try with phc_ key as Bearer
print("\n=== Attempt 1: Bearer with phc_ key ===")
rows = run_query(
    "SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' AND timestamp > now() - interval 14 day GROUP BY properties.$current_url ORDER BY count() DESC LIMIT 5",
    "pageviews_test",
    f"Bearer {API_KEY}"
)

# Try with phc_ key as project_api_key in URL
print("\n=== Attempt 2: project_api_key in URL ===")
resp2 = requests.post(
    f"{BASE_URL}/api/projects/{PROJECT_ID}/query/?project_api_key={API_KEY}",
    headers={"Content-Type": "application/json"},
    json={"query": {"kind": "HogQLQuery", "query": "SELECT count() FROM events WHERE event = '$pageview' LIMIT 1"}},
    timeout=30
)
print(f"Status: {resp2.status_code}, Response: {resp2.text[:200]}")
