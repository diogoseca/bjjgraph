#!/usr/bin/env python3
"""fetch_posthog_search.py — prefetch search-referred pageviews for the SEO monitor.

SECURITY: this runs in a NON-agent CI step so the PostHog *personal* (backend) key
never sits in the environment of the Claude step. The agent only reads the JSON file
this writes, and every row's URL is visitor-written text (a prompt-injection source),
so each is reduced to one of the site's own routes and rows naming no page are dropped
and counted (scripts/_site_routes.py, v1.264.6): the agent reads only our paths.

Writes a JSON file: {"available": bool, "data"|"note": ...}, where data is
{"columns": ["path", "count"], "results": [[site path, number], ...], "dropped": n}.
Never raises — a failed or unconfigured query degrades to {"available": false,
"note": ...} so the report step stays graceful.

Env:
  POSTHOG_PERSONAL_API_KEY  PostHog personal key (phx_); project key (phc_) 401s
  POSTHOG_PROJECT_ID        PostHog project id

Usage:
  python3 scripts/fetch_posthog_search.py /tmp/seo/posthog_search.json
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site_routes import clean_rows, route_index  # noqa: E402

# "Never looked" must not read as "found nothing": an error body, an async answer or a renamed key carries no results
# list, and writing an empty one would look exactly like a real zero. The note is fixed text, never the answer's.
NO_RESULTS_NOTE = "PostHog unavailable (its answer carried no results list)"

HOGQL = (
    "SELECT properties.$current_url, count() FROM events WHERE event='$pageview' "
    "AND (properties.$referrer LIKE '%google%' OR properties.$referrer LIKE '%bing%') "
    "AND timestamp > now() - interval 14 day GROUP BY properties.$current_url "
    "ORDER BY count() DESC LIMIT 50"
)


def main() -> None:
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/seo/posthog_search.json"
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    key = os.environ.get("POSTHOG_PERSONAL_API_KEY", "").strip()
    pid = os.environ.get("POSTHOG_PROJECT_ID", "").strip()

    def write(obj: dict) -> None:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(obj, f)

    if not key or not pid:
        write({"available": False, "note": "PostHog unavailable (key/project id not set)"})
        return

    req = urllib.request.Request(
        f"https://us.posthog.com/api/projects/{pid}/query/",
        data=json.dumps({"query": {"kind": "HogQLQuery", "query": HOGQL}}).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    routes = route_index()
    if not routes:
        # Fail closed: never hand the agent rows that were not matched against the site's routes.
        write({"available": False, "note": "PostHog unavailable (no site routes found under content/)"})
        return
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001 — degrade gracefully, never fail the job
        write({"available": False, "note": f"PostHog query failed: {e}"})
        return
    rows = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        write({"available": False, "note": NO_RESULTS_NOTE})
        return
    results, dropped = clean_rows(rows, routes)
    print(f"search entry: kept {len(results)} rows naming a site page, dropped {dropped}")
    write({"available": True, "data": {"columns": ["path", "count"], "results": results, "dropped": dropped}})


if __name__ == "__main__":
    main()
