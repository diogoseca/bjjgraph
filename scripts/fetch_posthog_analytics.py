#!/usr/bin/env python3
"""fetch_posthog_analytics.py — prefetch content analytics for the analytics bot.

SECURITY: runs in a NON-agent CI step so neither the PostHog key nor the step's
CLAUDE_CODE_OAUTH_TOKEN is reachable by the Claude agent (which improves content and
must not be able to run arbitrary code to exfiltrate secrets). The agent only reads
the JSON this writes. Every row's URL is visitor-written text, so each is reduced to
one of the site's own routes before it is written, and rows naming no page are
dropped and counted (scripts/_site_routes.py, v1.264.6): the agent reads only our paths.

Writes {available, pageviews, session_duration, bounce_rate, search_entry, dropped} as
JSON, each metric a list of [site path, number]. Never raises — degrades to
{"available": false, "note": ...}.

Env:
  POSTHOG_PERSONAL_API_KEY  PostHog personal key (phx_) — the Query API rejects the
                            public project key (phc_).
  POSTHOG_PROJECT_ID        PostHog project id (default 236155)

Usage:
  python3 scripts/fetch_posthog_analytics.py /tmp/analytics/analytics.json
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site_routes import clean_rows, route_index  # noqa: E402

QUERIES = {
    "pageviews": (
        "SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' "
        "AND timestamp > now() - interval 14 day GROUP BY properties.$current_url "
        "ORDER BY count() DESC LIMIT 200"
    ),
    "session_duration": (
        "SELECT properties.$current_url, avg(properties.$session_duration) FROM events "
        "WHERE event = '$pageview' AND timestamp > now() - interval 14 day "
        "GROUP BY properties.$current_url"
    ),
    "bounce_rate": (
        "SELECT properties.$current_url, countIf(properties.$session_duration < 10) / count() "
        "AS bounce_rate FROM events WHERE event = '$pageview' "
        "AND timestamp > now() - interval 14 day GROUP BY properties.$current_url HAVING count() > 5"
    ),
    "search_entry": (
        "SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' "
        "AND (properties.$referrer LIKE '%google%' OR properties.$referrer LIKE '%bing%' "
        "OR properties.$referrer LIKE '%duckduckgo%') AND timestamp > now() - interval 14 day "
        "GROUP BY properties.$current_url ORDER BY count() DESC"
    ),
}


def run_query(pid: str, key: str, hogql: str) -> list:
    req = urllib.request.Request(
        f"https://us.posthog.com/api/projects/{pid}/query/",
        data=json.dumps({"query": {"kind": "HogQLQuery", "query": hogql}}).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8")).get("results", [])


def main() -> None:
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/analytics/analytics.json"
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    key = os.environ.get("POSTHOG_PERSONAL_API_KEY", "").strip()
    pid = os.environ.get("POSTHOG_PROJECT_ID", "236155").strip()

    def write(obj: dict) -> None:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(obj, f)

    if not key:
        write({"available": False, "note": "PostHog unavailable (POSTHOG_PERSONAL_API_KEY not set)"})
        return

    routes = route_index()
    if not routes:
        # Fail closed: with no routes to match, every row would be dropped, or worse, a later edit would pass them raw.
        write({"available": False, "note": "PostHog unavailable (no site routes found under content/)"})
        return
    result: dict = {"available": True, "dropped": {}}
    for name, hogql in QUERIES.items():
        try:
            rows = run_query(pid, key, hogql)
        except Exception as e:  # noqa: BLE001 — degrade per-query, never fail the job
            rows = []
            result.setdefault("errors", {})[name] = str(e)
        result[name], result["dropped"][name] = clean_rows(rows, routes)
        print(f"{name}: kept {len(result[name])} rows naming a site page, dropped {result['dropped'][name]}")
    write(result)


if __name__ == "__main__":
    main()
