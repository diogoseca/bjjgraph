import requests
import json
import os

api_key = os.environ.get('POSTHOG_API_KEY')
base_url = "https://us.posthog.com/api/projects/236155/query/"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

def run_query(query_str, filename):
    payload = {
        "query": {
            "kind": "HogQLQuery",
            "query": query_str
        }
    }
    resp = requests.post(base_url, headers=headers, json=payload)
    print(f"Query status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        results = data.get('results', [])
        print(f"Got {len(results)} results")
        with open(f'/home/runner/work/bjjgraph/bjjgraph/{filename}', 'w') as f:
            json.dump(results, f, indent=2)
        return results
    else:
        print(f"Error: {resp.text[:500]}")
        return []

# Query 1: Pageviews per content page (last 14 days)
q1 = """SELECT properties.$current_url, count() as views
FROM events
WHERE event = '$pageview'
AND timestamp > now() - interval 14 day
GROUP BY properties.$current_url
ORDER BY views DESC
LIMIT 200"""

print("=== PAGEVIEWS ===")
pageviews = run_query(q1, 'analytics_pageviews.json')
for row in pageviews[:20]:
    print(f"  {row[1]:5d}: {row[0]}")

# Query 2: Session duration per page
q2 = """SELECT properties.$current_url, avg(properties.$session_duration) as avg_duration
FROM events
WHERE event = '$pageview'
AND timestamp > now() - interval 14 day
GROUP BY properties.$current_url
ORDER BY avg_duration ASC
LIMIT 200"""

print("\n=== SESSION DURATION (LOW FIRST) ===")
durations = run_query(q2, 'analytics_durations.json')
for row in durations[:20]:
    print(f"  {row[1]:.1f}s avg: {row[0]}")

# Query 3: Bounce rate
q3 = """SELECT properties.$current_url, countIf(properties.$session_duration < 10) / count() as bounce_rate, count() as total
FROM events
WHERE event = '$pageview'
AND timestamp > now() - interval 14 day
GROUP BY properties.$current_url
HAVING count() > 5
ORDER BY bounce_rate DESC
LIMIT 200"""

print("\n=== BOUNCE RATE (HIGH FIRST) ===")
bounces = run_query(q3, 'analytics_bounces.json')
for row in bounces[:20]:
    print(f"  {row[1]:.1%} bounce ({row[2]} views): {row[0]}")

# Query 4: Search entry pages
q4 = """SELECT properties.$current_url, count() as search_views
FROM events
WHERE event = '$pageview'
AND (properties.$referrer LIKE '%google%' OR properties.$referrer LIKE '%bing%' OR properties.$referrer LIKE '%duckduckgo%')
AND timestamp > now() - interval 14 day
GROUP BY properties.$current_url
ORDER BY search_views DESC
LIMIT 100"""

print("\n=== SEARCH ENTRY PAGES ===")
search = run_query(q4, 'analytics_search.json')
for row in search[:20]:
    print(f"  {row[1]:4d} search views: {row[0]}")
