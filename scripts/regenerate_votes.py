#!/usr/bin/env python3
"""
Seed and maintain templates/votes.json with community vote data.

Idempotent — safe to run repeatedly:
  1. If votes.json doesn't exist → seed from content JSON files (vote_count: 30)
  2. If votes.json exists → update from PostHog events API, add any new techniques

Environment variables (only needed for PostHog sync, not for seeding):
  POSTHOG_PERSONAL_API_KEY - PostHog personal API key
  POSTHOG_PROJECT_ID       - PostHog project ID

Usage:
    python scripts/regenerate_votes.py              # seed or update
    python scripts/regenerate_votes.py --seed-only  # only seed, skip PostHog
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

PRIOR_VOTE_COUNT = 30  # Expert opinion weight


def load_dotenv(project_root: Path):
    """Load .env file into os.environ if it exists."""
    env_file = project_root / '.env'
    if not env_file.exists():
        return
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            os.environ.setdefault(key.strip(), value.strip())


def load_content_rates(content_dir: Path) -> dict[str, float]:
    """Extract success_rate from all transition and submission JSON files."""
    rates = {}

    for subdir in ['Transitions', 'Submissions']:
        directory = content_dir / subdir
        if not directory.exists():
            continue
        for json_file in directory.glob('*.json'):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if not isinstance(data, dict) or 'name' not in data:
                    continue
                # Skip JSON schema files
                if '$schema' in data and 'title' in data and 'properties' in data:
                    continue
                name = data['name']
                rate = data.get('success_rate')
                if rate is None:
                    print(f"  WARNING: {json_file.name} has no success_rate, using 50")
                    rate = 50
                rates[name] = float(rate)
            except (json.JSONDecodeError, IOError) as e:
                print(f"  WARNING: Could not load {json_file}: {e}")

    return rates


def seed_votes(content_rates: dict[str, float]) -> dict:
    """Create initial votes.json from content rates."""
    votes = {}
    for name, rate in sorted(content_rates.items()):
        votes[name] = {
            "success_rate": rate,
            "vote_count": PRIOR_VOTE_COUNT
        }
    return {
        "last_updated_at": None,
        "votes": votes
    }


def fetch_posthog_events(api_key: str, project_id: str, after: str | None = None) -> list[dict]:
    """Fetch move_vote events from PostHog Events API."""
    import urllib.request
    import urllib.parse

    events = []
    url = f"https://us.posthog.com/api/projects/{project_id}/events"
    params = {
        "event": "move_vote",
        "limit": "1000",
    }
    if after:
        params["after"] = after

    next_url = f"{url}?{urllib.parse.urlencode(params)}"

    while next_url:
        req = urllib.request.Request(next_url)
        req.add_header("Authorization", f"Bearer {api_key}")

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"  ERROR: PostHog API request failed: {e}")
            break

        results = data.get("results", [])
        events.extend(results)
        next_url = data.get("next")

    return events


def compute_user_final_rates(events: list[dict]) -> dict[str, dict[str, float]]:
    """
    Group events by (distinct_id, technique), take the last event per user per technique.
    Returns {technique: {user_id: adjusted_rate}}.
    """
    # Sort by timestamp to ensure last event wins
    events.sort(key=lambda e: e.get("timestamp", ""))

    user_rates: dict[str, dict[str, float]] = defaultdict(dict)

    for event in events:
        props = event.get("properties", {})
        technique = props.get("technique")
        adjusted_rate = props.get("adjusted_rate")
        distinct_id = event.get("distinct_id")

        if not technique or adjusted_rate is None or not distinct_id:
            continue

        user_rates[technique][distinct_id] = float(adjusted_rate)

    return dict(user_rates)


def update_votes_from_posthog(votes_data: dict, api_key: str, project_id: str) -> dict:
    """Update votes.json with PostHog event data."""
    last_updated = votes_data.get("last_updated_at")
    votes = votes_data.get("votes", {})

    print(f"  Fetching PostHog events" + (f" after {last_updated}" if last_updated else " (all time)") + "...")
    events = fetch_posthog_events(api_key, project_id, after=last_updated)
    print(f"  Fetched {len(events)} event(s)")

    if not events:
        print("  No new events to process")
        return votes_data

    user_final_rates = compute_user_final_rates(events)

    updated = 0
    for technique, user_rates in user_final_rates.items():
        if technique not in votes:
            print(f"  WARNING: Technique '{technique}' not in votes.json, skipping")
            continue

        entry = votes[technique]
        current_rate = entry["success_rate"]
        current_count = entry["vote_count"]

        avg_user_rate = sum(user_rates.values()) / len(user_rates)
        num_new_votes = len(user_rates)

        new_rate = (current_rate * current_count + avg_user_rate * num_new_votes) / (current_count + num_new_votes)
        new_count = current_count + num_new_votes

        entry["success_rate"] = round(new_rate, 2)
        entry["vote_count"] = new_count
        updated += 1

    print(f"  Updated {updated} technique(s) from {len(events)} event(s)")

    votes_data["last_updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return votes_data


def main():
    parser = argparse.ArgumentParser(description='Seed and maintain votes.json')
    parser.add_argument('--seed-only', action='store_true',
                        help='Only seed from content, skip PostHog sync')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    load_dotenv(project_root)
    content_dir = project_root / 'content'
    votes_file = project_root / 'templates' / 'votes.json'

    print("Regenerating votes...")

    # Load current content rates
    content_rates = load_content_rates(content_dir)
    print(f"  Found {len(content_rates)} technique(s) in content")

    if not votes_file.exists():
        # Seed mode
        print("  Seeding votes.json from content...")
        votes_data = seed_votes(content_rates)
        votes_file.parent.mkdir(parents=True, exist_ok=True)
        with open(votes_file, 'w', encoding='utf-8') as f:
            json.dump(votes_data, f, indent=2, ensure_ascii=False)
        print(f"  Created {votes_file} with {len(votes_data['votes'])} technique(s)")
    else:
        # Update mode
        with open(votes_file, 'r', encoding='utf-8') as f:
            votes_data = json.load(f)

        # Add any new techniques not yet in votes.json
        added = 0
        for name, rate in content_rates.items():
            if name not in votes_data.get("votes", {}):
                votes_data.setdefault("votes", {})[name] = {
                    "success_rate": rate,
                    "vote_count": PRIOR_VOTE_COUNT
                }
                added += 1
        if added:
            print(f"  Added {added} new technique(s) to votes.json")

        # PostHog sync
        if not args.seed_only:
            api_key = os.environ.get("POSTHOG_PERSONAL_API_KEY")
            project_id = os.environ.get("POSTHOG_PROJECT_ID")

            if api_key and project_id:
                votes_data = update_votes_from_posthog(votes_data, api_key, project_id)
            else:
                print("  Skipping PostHog sync (POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set)")

        with open(votes_file, 'w', encoding='utf-8') as f:
            json.dump(votes_data, f, indent=2, ensure_ascii=False)
        print(f"  Updated {votes_file}")

    print("Done.")


if __name__ == '__main__':
    main()
