#!/usr/bin/env python3
import requests
import json
import os
import sys

def fetch_paa_data(keyword):
    """Fetch PAA data from DataForSEO API"""

    login = os.environ.get('DATAFORSEO_LOGIN')
    password = os.environ.get('DATAFORSEO_PASSWORD')

    if not login or not password:
        print("Error: DATAFORSEO credentials not found in environment", file=sys.stderr)
        return None

    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"

    payload = [{
        "keyword": keyword,
        "location_name": "United States",
        "language_code": "en",
        "device": "desktop",
        "depth": 50
    }]

    try:
        response = requests.post(
            url,
            auth=(login, password),
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=30
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"Error fetching PAA data: {e}", file=sys.stderr)
        return None

def extract_paa_questions(data):
    """Extract PAA questions from API response"""
    paa_questions = []

    if not data or 'tasks' not in data:
        return paa_questions

    for task in data.get('tasks', []):
        if task.get('status_code') != 20000:
            continue

        result = task.get('result', [{}])[0]
        items = result.get('items', [])

        for item in items:
            if item.get('type') == 'people_also_ask':
                for qa in item.get('items', []):
                    question = qa.get('title', '')
                    answer = qa.get('expanded_element', [{}])[0].get('description', '')
                    links = qa.get('links', [])
                    source_url = links[0].get('url', '') if links else ''

                    if question:
                        paa_questions.append({
                            'question': question,
                            'answer_snippet': answer[:300] if answer else '',
                            'source_url': source_url
                        })

    return paa_questions

if __name__ == "__main__":
    keywords = [
        ("bjj position flow", "Understanding_Position_Flow"),
        ("seat belt control bjj", "Seat_Belt_Control_Back")
    ]

    for keyword, filename in keywords:
        print(f"\nFetching PAA data for: {keyword}")
        data = fetch_paa_data(keyword)

        if data:
            paa_questions = extract_paa_questions(data)
            print(f"Found {len(paa_questions)} PAA questions")

            output = {
                'keyword': keyword,
                'filename': filename,
                'paa_questions': paa_questions,
                'total_questions': len(paa_questions)
            }

            output_path = f"paa_output/{filename}_raw.json"
            with open(output_path, 'w') as f:
                json.dump(output, f, indent=2)
            print(f"Saved to {output_path}")
        else:
            print(f"Failed to fetch data for: {keyword}")
