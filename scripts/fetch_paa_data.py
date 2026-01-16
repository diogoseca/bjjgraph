#!/usr/bin/env python3
"""
Fetch People Also Ask (PAA) data from DataForSEO API.
"""
import json
import os
import sys
from base64 import b64encode
import urllib.request
import urllib.error

def fetch_paa_data(keyword, login, password):
    """Fetch PAA data from DataForSEO SERP API."""

    # DataForSEO API endpoint
    endpoint = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"

    # Prepare authentication
    credentials = f"{login}:{password}"
    encoded_credentials = b64encode(credentials.encode()).decode()

    # Request payload
    payload = [{
        "keyword": keyword,
        "location_name": "United States",
        "language_code": "en",
        "device": "desktop",
        "depth": 50
    }]

    # Prepare request
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/json'
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            return result
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}", file=sys.stderr)
        print(f"Response: {e.read().decode()}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error fetching PAA data: {e}", file=sys.stderr)
        return None

def extract_paa_questions(serp_data):
    """Extract PAA questions from SERP response."""
    paa_questions = []

    if not serp_data or 'tasks' not in serp_data:
        return paa_questions

    for task in serp_data.get('tasks', []):
        result = task.get('result', [])
        if not result:
            continue

        for item in result:
            items = item.get('items', [])
            for search_item in items:
                if search_item.get('type') == 'people_also_ask':
                    items_list = search_item.get('items', [])
                    for paa_item in items_list:
                        question = paa_item.get('title')
                        answer = paa_item.get('expanded_element', [{}])[0].get('description', '') if paa_item.get('expanded_element') else ''
                        url = paa_item.get('expanded_element', [{}])[0].get('url', '') if paa_item.get('expanded_element') else ''

                        if question:
                            paa_questions.append({
                                'question': question,
                                'answer_snippet': answer[:200] if answer else '',
                                'source_url': url
                            })

    return paa_questions

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_paa_data.py <keyword>", file=sys.stderr)
        sys.exit(1)

    keyword = sys.argv[1]

    # Get credentials from environment
    login = os.environ.get('DATAFORSEO_LOGIN')
    password = os.environ.get('DATAFORSEO_PASSWORD')

    if not login or not password:
        print("Error: DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables required", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching PAA data for keyword: {keyword}", file=sys.stderr)

    # Fetch data
    serp_data = fetch_paa_data(keyword, login, password)

    if not serp_data:
        print("Failed to fetch PAA data", file=sys.stderr)
        sys.exit(1)

    # Extract PAA questions
    paa_questions = extract_paa_questions(serp_data)

    # Output as JSON
    output = {
        'keyword': keyword,
        'paa_questions': paa_questions,
        'total_questions': len(paa_questions)
    }

    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
