#!/usr/bin/env python3
"""Read-only bot preflight and shared file reservations. Lookup failures fail closed.

All producers use the same Actions concurrency group for the snapshot's lifetime.
State belongs in RUNNER_TEMP, never in a bot's staged artifacts.
"""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys

BOT_BRANCHES = {
    "content-improvement-bot": "content-improvement-bot/",
    "analytics-content-improvement": "analytics-improvement/",
    "validation-fixer": "validation-fixer/",
    "proofread-bot": "proofread-bot/",
    "votes-refresh": "votes-refresh/",
}
# votes-refresh stages exactly this batch. GitHub can report zero files for its
# oversized graph diff (#192/#194/#196). The workflow contract test pins this
# fallback to the producer's actual staging scope.
KNOWN_BATCHES = {"votes-refresh": ("templates/votes.json", "graph.json")}


def api(path):
    result = subprocess.run(["gh", "api", path], capture_output=True, text=True, check=True, timeout=60)
    return json.loads(result.stdout)


def pages(path, get=api):
    rows, requests = [], 0
    separator = "&" if "?" in path else "?"
    while True:
        page = get(f"{path}{separator}per_page=100&page={requests + 1}")
        requests += 1
        if not isinstance(page, list):
            raise ValueError(f"Expected an API page of rows: {path}")
        rows.extend(page)
        if len(page) < 100:
            return rows, requests


def producer(pr):
    branch = pr["head"]["ref"]
    return next((bot for bot, prefix in BOT_BRANCHES.items() if branch.startswith(prefix)), None)


def is_bot(pr):
    return (producer(pr) is not None or pr["user"]["type"] == "Bot"
            or any(label["name"] == "automated" for label in pr["labels"]))


def reservation_key(filename):
    path = PurePosixPath(filename)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Invalid repository path: {filename}")
    # Historical bot PRs predate the move from source/content to content.
    if str(path).startswith("source/content/"):
        path = PurePosixPath(str(path)[7:])
    if str(path).startswith("content/") and path.suffix == ".md":
        if path.stem in ("Top", "Bottom", "Attacker", "Defender"):
            return str(path.parent.with_suffix(".json"))
        return str(path.with_suffix(".json"))
    return str(path)


def snapshot(repo, bot, get=api):
    requests = 0

    def lookup(path):
        nonlocal requests
        result = get(path)
        requests += 1
        return result

    prs, _ = pages(f"repos/{repo}/pulls?state=open", lookup)
    if len({p["number"] for p in prs}) != len(prs):
        raise ValueError("PR inventory changed during pagination; retry the lookup")
    own = [p["number"] for p in prs if producer(p) == bot]
    bot_prs = [pr for pr in prs if is_bot(pr)]
    reserved, files_checked, batch_paths = {}, 0, 0
    # No reservations are needed when the entire producer is already blocked.
    for pr in ([] if own else bot_prs):
        number = pr["number"]
        files, count = [], None
        try:
            detail = lookup(f"repos/{repo}/pulls/{number}")
            count = detail["changed_files"]
            if not isinstance(count, int) or count <= 0 or count > 3000:
                raise ValueError(f"GitHub reports {count} changed files")
            files, _ = pages(f"repos/{repo}/pulls/{number}/files", lookup)
            if len(files) != count or len({f['filename'] for f in files}) != count:
                raise ValueError(f"expected {count} files, received {len(files)}")
        except (ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
            batch = KNOWN_BATCHES.get(producer(pr))
            # Do not use a known batch to hide evidence of a broader change.
            listed = {path for row in files if isinstance(row, dict)
                      for path in (row.get("filename"), row.get("previous_filename")) if path}
            if (not batch
                    or (count is not None and (not isinstance(count, int) or not 0 <= count <= len(batch)))
                    or listed - set(batch)):
                raise ValueError(f"PR #{number}: cannot establish complete reservations: {exc}") from exc
            files = [{"filename": path} for path in batch]
            batch_paths += len(files)
            print(f"PR #{number}: reserving known votes-refresh batch ({', '.join(batch)}); "
                  f"GitHub file lookup unavailable: {exc}.", file=sys.stderr)
        else:
            files_checked += len(files)
            print(f"PR #{number}: GitHub files API checked {len(files)} paths.", file=sys.stderr)
        for row in files:
            for path in (row["filename"], row.get("previous_filename")):
                if path:
                    reserved.setdefault(reservation_key(path), []).append(number)
    print(f"Queue check: {requests} successful API requests; {len(prs)} open PRs checked; "
          f"{len(bot_prs)} bot PRs; {files_checked} changed files checked; "
          f"{batch_paths} known-batch paths reserved.", file=sys.stderr)
    if own:
        print(f"SKIP {bot}: own open PR(s) {own}; no paid work or new PR.", file=sys.stderr)
    else:
        print(f"{bot}: no own open PR found after successful lookup.", file=sys.stderr)
    return {"version": 1, "bot": bot, "own_prs": own, "reserved": reserved,
            "requests_checked": requests, "candidates_checked": 0, "skipped": 0}


def read_state(path=None):
    path = path or os.environ.get("BOT_QUEUE_STATE")
    if not path:
        return None  # Manual local scripts have no bot reservation context.
    state = json.loads(Path(path).read_text())
    if state.get("version") != 1 or state.get("requests_checked", 0) < 1:
        raise ValueError("Missing successful queue lookup in reservation state")
    if not isinstance(state.get("reserved"), dict):
        raise ValueError("Malformed reservations")
    return state


def filter_candidates(candidates, state=None):
    state = read_state() if state is None else state
    if state is None:
        return list(candidates)
    allowed = []
    for path in candidates:
        holders = state["reserved"].get(reservation_key(str(path)), [])
        if state["own_prs"] or holders:
            print(f"SKIP reserved candidate {path}: open PR(s) {holders or state['own_prs']}", file=sys.stderr)
        else:
            allowed.append(path)
    print(f"Reservations: checked {len(candidates)} candidates; allowed {len(allowed)}; "
          f"skipped {len(candidates) - len(allowed)}.", file=sys.stderr)
    return allowed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bot", choices=BOT_BRANCHES)
    parser.add_argument("--state", default=os.environ.get("BOT_QUEUE_STATE"))
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--filter", type=Path, help="Newline-delimited candidate file")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check-changes", action="store_true")
    parser.add_argument("--candidate", action="append", default=[])
    args = parser.parse_args()
    if not args.state:
        parser.error("--state or BOT_QUEUE_STATE is required")
    if args.bot:
        if not args.repo:
            parser.error("--repo or GITHUB_REPOSITORY is required")
        state = snapshot(args.repo, args.bot)
        allowed = filter_candidates(args.candidate, state)
        proceed = not state["own_prs"] and len(allowed) == len(args.candidate)
        Path(args.state).write_text(json.dumps(state) + "\n")
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                output.write(f"proceed={str(proceed).lower()}\n")
        return
    state = read_state(args.state)
    if args.check_changes:
        result = subprocess.run(["git", "diff", "--no-renames", "--name-only", "-z", "HEAD"],
                                capture_output=True, check=True)
        untracked = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "-z"],
                                   capture_output=True, check=True)
        candidates = list(dict.fromkeys(p for p in (result.stdout + untracked.stdout).decode().split("\0") if p))
        if len(filter_candidates(candidates, state)) != len(candidates):
            raise ValueError("Changed reserved file: aborting without a PR")
    elif args.filter and args.output:
        candidates = list(dict.fromkeys(p for p in args.filter.read_text().splitlines() if p))
        allowed = filter_candidates(candidates, state)
        state["candidates_checked"] += len(candidates)
        state["skipped"] += len(candidates) - len(allowed)
        Path(args.state).write_text(json.dumps(state) + "\n")
        args.output.write_text("".join(f"{p}\n" for p in allowed))
    else:
        parser.error("choose --bot, --check-changes, or --filter with --output")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        sys.exit(f"Queue lookup/reservation FAILED; no work authorized: {exc}")
