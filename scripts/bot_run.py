#!/usr/bin/env python3
"""Free candidate selection, Claude execution gate, and counted bot summaries."""
import argparse
from datetime import date
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote, urlsplit

from bot_queue import filter_candidates, read_state


def check_execution(path):
    if not path:
        raise ValueError("Claude action supplied no execution_file")
    raw = Path(path).read_text()
    try:
        records = json.loads(raw)
    except json.JSONDecodeError:
        records = [json.loads(line) for line in raw.splitlines() if line.strip()]
    if isinstance(records, dict):
        records = [records]
    results = [row for row in records if isinstance(row, dict) and row.get("type") == "result"]
    if not results or any(row.get("is_error") is not False or row.get("subtype") != "success"
                          for row in results):
        raise ValueError(f"Claude execution failed or lacked an explicit success result ({len(results)} results checked)")
    print(f"Claude execution: checked {len(results)} result record(s); is_error=false.")


def select_analytics(analytics, count, output):
    """Select before inference so reserved files never enter a paid batch."""
    candidates = sorted(Path("content").rglob("*.json"))
    if not candidates or count < 1:
        raise ValueError("Analytics selection needs source files and a positive limit")
    allowed = filter_candidates(candidates)
    state = read_state()
    state["candidates_checked"] += len(candidates)
    state["skipped"] += len(candidates) - len(allowed)
    Path(os.environ["BOT_QUEUE_STATE"]).write_text(json.dumps(state) + "\n")

    def key(path):
        return unquote(path).strip("/").removesuffix(".html").replace(" ", "-").lower()

    sources = {}
    data = {}
    for path in allowed:
        data[path] = json.loads(path.read_text())
        stem = str(path.relative_to("content").with_suffix(""))
        for suffix in ("", "/Top", "/Bottom", "/Attacker", "/Defender"):
            sources[key(stem + suffix)] = path
    metrics = {}
    for metric, rows in json.loads(analytics.read_text()).items():
        if metric not in ("pageviews", "session_duration", "bounce_rate", "search_entry"):
            continue
        for url, value in rows:
            path = sources.get(key(urlsplit(url).path)) if isinstance(url, str) else None
            if path is not None and isinstance(value, (int, float)):
                metrics.setdefault(path, {})[metric] = value

    def rank(path):
        row, source = metrics.get(path, {}), data[path]
        traffic = row.get("pageviews", 0)
        weak = row.get("session_duration", 1000) < 20 or row.get("bounce_rate", 0) > .7
        overview = source.get("overview", "")
        thin = len(overview) < 500 or "TODO" in json.dumps(source)
        improved = (source.get("bot_metadata") or {}).get("last_improved", "0001-01-01")
        try:
            age = (date.today() - date.fromisoformat(improved)).days
        except (ValueError, TypeError):
            age = 1000000
        return (-(traffic if weak else 0), -(row.get("search_entry", 0) if thin else 0),
                -(traffic if age > 60 else 0), -age, str(path))

    selected = sorted(allowed, key=rank)[:count]
    output.write_text("".join(f"{p}\n" for p in selected))
    print(f"Analytics selection: {len(candidates)} sources checked; {len(selected)} selected.")


def summarize(files, failed=False, skipped=0):
    selected = list(dict.fromkeys(files.read_text().splitlines())) if files.exists() else []
    valid = failures = 0
    for path in selected:
        if not path:
            continue
        if failed:
            failures += 1
        elif path.endswith(".json"):
            result = subprocess.run([sys.executable, "scripts/validate_json.py", "--file", path],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            valid += result.returncode == 0
            failures += result.returncode != 0
        else:
            # No source-schema gate for hand-authored Markdown; do not count as validated.
            skipped += 1
    state = read_state()
    skipped += state.get("skipped", 0) if state else 0
    message = f"Files: attempted={len(selected)}, valid={valid}, skipped={skipped}, failed={failures}"
    print(message)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(message + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    action = commands.add_parser("check-execution")
    action.add_argument("path")
    select = commands.add_parser("select-analytics")
    select.add_argument("analytics", type=Path)
    select.add_argument("output", type=Path)
    select.add_argument("--count", type=int, required=True)
    summary = commands.add_parser("summary")
    summary.add_argument("files", type=Path)
    summary.add_argument("--failed", action="store_true")
    args = parser.parse_args()
    if args.command == "check-execution":
        check_execution(args.path)
    elif args.command == "select-analytics":
        select_analytics(args.analytics, args.count, args.output)
    else:
        summarize(args.files, args.failed)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError) as exc:
        sys.exit(f"Bot run FAILED: {exc}")
