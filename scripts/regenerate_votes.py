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
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ruleset import as_map, present_rulesets  # forked {gi,nogi} probability contract (calibration-v2)
import _votes  # forked {community, prior} votes schema helpers (calibration-v2 Phase 2.3b)

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


def load_content_rates(content_dir: Path) -> tuple[dict[str, dict], dict]:
    """Extract each technique's FORKED ``{gi, nogi}`` success_rate from content JSON.

    Returns ``(rates, stats)``. ``rates`` maps display name -> ``{"gi": <float|None>,
    "nogi": <float|None>}``. It used to return one float per technique, built by calling
    ``reduce_to_scalar(json.load(f))`` on the whole document. Two faults, neither visible
    while gi == nogi across the whole corpus:

    * A scalar return cannot carry a one-frame technique at all. The squashed number was
      then handed to ``_votes.seed_entry``, which mirrors it back into BOTH frames — so a
      ``null`` cell ("this edge does not exist in that ruleset", scripts/_ruleset.py) came
      out the far end as a real published rate. ``null`` is not ``0``; re-animating the
      edge is worse than crashing, because votes.json is the authority regenerate_graph.py
      reads for ``successRateByRuleset``.
    * ``reduce_to_scalar`` with no ``frame=`` RAISES ``ValueError`` on a divergent map, and
      ``ValueError`` is not in the ``except`` tuple below (``json.JSONDecodeError`` is a
      SUBCLASS of it, not a superclass), so the first forked success_rate would kill the
      run mid-directory having printed not one "Could not load" line. Passing
      ``frame="nogi"`` is NOT the fix: it silently picks one frame and re-mirrors it,
      destroying the fork just as thoroughly and more quietly.

    ``stats`` carries the POSITIVE coverage counts this loader has to be judged on —
    CLAUDE.md §6.6, a check that never ran reports clean. Every exclusion is recorded with
    its path AND its cause and printed as it happens; ``report_rate_coverage`` turns any
    non-empty exclusion list into a hard failure. "Nothing was dropped" and "nothing was
    looked at" must never print the same thing.
    """
    rates: dict[str, dict] = {}
    sources: dict[str, list[str]] = defaultdict(list)  # name -> every file claiming it
    files_seen = 0   # *.json walked
    eligible = 0     # ... that is a real technique record (named, non-family, not a schema)
    missing_dirs: list[str] = []
    unreadable: list[tuple[str, str]] = []
    missing_key: list[str] = []
    no_frame: list[str] = []
    bad_cell: list[tuple[str, str]] = []

    for subdir in ['Transitions', 'Submissions']:
        directory = content_dir / subdir
        if not directory.exists():
            # Not a skip-and-carry-on: both directories are structural, and losing one
            # silently halves the corpus while `len(rates) == eligible` stays perfectly
            # satisfied. Record it so the floor below can fail on it by name.
            print(f"  MISSING DIRECTORY: {directory}")
            missing_dirs.append(str(directory))
            continue
        # sorted(): rglob order is filesystem order, and this loop's insertion order reaches
        # the committed templates/votes.json through the update path's append. A committed
        # artifact does not get to depend on scandir (CLAUDE.md §6.6, strict total order).
        for json_file in sorted(directory.rglob('*.json')):
            files_seen += 1
            rel = str(json_file.relative_to(content_dir))
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                unreadable.append((rel, str(e)))
                print(f"  UNREADABLE: {rel}: {e}")
                continue
            if not isinstance(data, dict) or 'name' not in data or data.get('is_family'):
                continue
            # Skip JSON schema files
            if '$schema' in data and 'title' in data and 'properties' in data:
                continue
            eligible += 1
            name = data['name']

            # Two DIFFERENT causes that both used to arrive here as a bare None and both
            # got the same fabricated 50: the key is absent, or the key is present and null
            # in both frames. The old line printed "has no success_rate, using 50" for the
            # second case too — a lie about the file AND an invented number, and the rates
            # dict came out byte-identical to a clean corpus. Split them, name them, and
            # exclude both rather than inventing anything.
            if 'success_rate' not in data:
                missing_key.append(rel)
                print(f"  MISSING success_rate: {rel}")
                continue
            sr_raw = data['success_rate']
            if not present_rulesets([sr_raw]):
                no_frame.append(rel)
                print(f"  NO-FRAME success_rate (exists in neither ruleset): {rel}: {sr_raw!r}")
                continue
            try:
                cells = {rs: (None if c is None else float(c))
                         for rs, c in as_map(sr_raw).items()}
            except (TypeError, ValueError) as e:
                # Narrow, and around the VALUE conversion ONLY. Widening this to swallow a
                # fork error out of _ruleset would turn "this reader cannot handle the data"
                # into "this technique quietly vanished", and the vanished name is then
                # re-seeded from nothing on the next run.
                bad_cell.append((rel, f"{sr_raw!r}: {e}"))
                print(f"  BAD success_rate cell: {rel}: {sr_raw!r} ({e})")
                continue

            rates[name] = cells
            sources[name].append(rel)

    stats = {
        'files_seen': files_seen,
        'eligible': eligible,
        'gi_present': sum(1 for m in rates.values() if m['gi'] is not None),
        'nogi_present': sum(1 for m in rates.values() if m['nogi'] is not None),
        'gi_only': sum(1 for m in rates.values() if m['gi'] is not None and m['nogi'] is None),
        'nogi_only': sum(1 for m in rates.values() if m['nogi'] is not None and m['gi'] is None),
        'collisions': {n: p for n, p in sources.items() if len(p) > 1},
        'missing_dirs': missing_dirs,
        'unreadable': unreadable,
        'missing_key': missing_key,
        'no_frame': no_frame,
        'bad_cell': bad_cell,
    }
    return rates, stats


def report_rate_coverage(rates: dict[str, dict], stats: dict) -> None:
    """Print the coverage counts every run and hard-fail below the floor.

    The floor is an EXACT IDENTITY (``len(rates) == eligible``), never a percentage — a
    fractional floor is precisely what let the live defect hide. ``rates`` is keyed by
    DISPLAY NAME, and a name claimed by two files silently last-write-wins; five names
    collided across content/Transitions and content/Submissions, so 1331 eligible files
    produced 1326 entries and the Submissions copy (second directory in the list) won five
    published success rates. 1326/1331 is 99.62% — comfortably inside any 95% band, and
    invisible in the old "Found 1326 technique(s)" line because nothing printed what it was
    1326 OF. Content resolved those five in v1.155.0 by collapsing the transition twins;
    this detector stays because nothing else stops the next one, and the resolution of a
    collision is a content decision (rename or merge), never a code default.
    """
    print(f"  Rates: {len(rates)}/{stats['eligible']} technique(s) from "
          f"{stats['files_seen']} file(s); gi {stats['gi_present']}, "
          f"nogi {stats['nogi_present']} "
          f"(gi-only {stats['gi_only']}, nogi-only {stats['nogi_only']})")

    failures = []
    if stats['collisions']:
        failures.append(f"{len(stats['collisions'])} duplicate technique name(s)")
        for name, paths in sorted(stats['collisions'].items()):
            print(f"  COLLISION: '{name}' is claimed by {len(paths)} files:")
            for p in paths:
                print(f"      {p}")
    # An identity alone cannot catch an EMPTY survey: 0 == 0 passes it, and "the corpus
    # is gone" then reads exactly like "the corpus is perfect" — the §6.6 defect this
    # whole function exists to stop. The floor therefore has an absolute leg too.
    if stats['eligible'] == 0:
        failures.append(f"0 eligible technique(s) from {stats['files_seen']} file(s) — nothing was surveyed")
    for key, label in (('missing_dirs', 'missing content directory(ies)'),
                       ('unreadable', 'unreadable file(s)'),
                       ('missing_key', 'file(s) with no success_rate key'),
                       ('no_frame', 'file(s) whose success_rate exists in neither ruleset'),
                       ('bad_cell', 'file(s) with a non-numeric success_rate cell')):
        if stats[key]:
            failures.append(f"{len(stats[key])} {label}")
    if len(rates) != stats['eligible']:
        failures.append(f"coverage {len(rates)} != {stats['eligible']} eligible")

    if failures:
        print("ERROR: content success_rate coverage is incomplete: " + "; ".join(failures))
        print("       Every eligible technique must contribute exactly one votes entry.")
        sys.exit(1)

def report_store_vs_content(votes_data: dict, content_rates: dict[str, dict]) -> None:
    """Check the EXISTING store against content's forked rates; print what was checked.

    The update path only ever MINTS from content (``seed_entry_map``, and only for names
    not yet in the store) — it never revisits an entry it already has. So the moment a
    technique's content ``success_rate`` loses a frame (``null`` = "this edge does not
    exist in that ruleset", scripts/_ruleset.py) the store keeps the number it was seeded
    with, the PostHog fold keeps folding votes into it, and ``regenerate_graph.load_votes``
    republishes it through ``_votes.folded_rates`` as ``successRateByRuleset``.

    Measured on a fixture whose content nulls one frame of an ALREADY-SEEDED technique:
    the loader correctly reports "gi-only 1", the update path touches 0 names, and the
    wire still carries ``{'gi': 34.0, 'nogi': 34.0}``. A fabricated published rate for an
    edge the content denies, and not one line of output about it — CLAUDE.md §6.6, the
    null is seen at one layer and dropped at the next.

    This REFUSES rather than repairs, deliberately. Re-seeding the frame to ``null`` would
    silently discard accumulated community votes (47 of 1614 entries carry votes above the
    pure seed today), and un-nulling the content is a content decision. Which of the two is
    right is the owner's call, never a code default — the same reasoning as the collision
    detector above.

    Both figures quoted here are measured, and every run reprints their live values in the
    "Store:" line below, so a drifted docstring is contradicted on screen (CLAUDE.md §6.9).
    Recompute standalone with::

        python3 -c "import json,sys; sys.path.insert(0,'scripts'); import _votes; \
          v=json.load(open('templates/votes.json'))['votes']; \
          print(sum(1 for e in v.values() if any(_votes.migrate_entry(e)['community'][r]['vote_count'] \
              > _votes.PRIOR_VOTE_COUNT for r in _votes.RULESETS)), 'of', len(v))"
    """
    votes = votes_data.get("votes", {})
    checked = 0
    orphans: list[str] = []
    malformed: list[tuple[str, str]] = []
    fabricated: list[tuple[str, str]] = []

    for name, entry in votes.items():
        rate_map = content_rates.get(name)
        if rate_map is None:
            # A store entry naming no content technique: retired or renamed content. NOT a
            # fabricated frame and NOT a failure — 286 exist today. Counted and printed so
            # a sudden jump is visible rather than inferred from silence.
            orphans.append(name)
            continue
        checked += 1
        try:
            community = _votes.migrate_entry(entry)["community"]
        except (KeyError, TypeError) as e:
            malformed.append((name, str(e)))
            print(f"  MALFORMED votes entry: '{name}': {e}")
            continue
        for rs in _votes.RULESETS:
            if rate_map[rs] is not None:
                continue
            if community[rs]["success_rate"] is not None:
                fabricated.append((name, rs))

    print(f"  Store: {len(votes)} entry(ies); {checked} checked against content, "
          f"{len(orphans)} orphan(s) with no content technique; "
          f"{len(fabricated)} frame(s) published where content says the ruleset is absent")

    failures = []
    # A total join collapse is the dangerous read: with checked == 0 the loop finds no
    # fabricated frames and the line above says "0", which is exactly what a clean store
    # prints. "Nothing was wrong" and "nothing was compared" must not agree.
    if votes and checked == 0:
        failures.append(f"all {len(votes)} store entry(ies) are orphans — the name join collapsed")
    if malformed:
        failures.append(f"{len(malformed)} malformed store entry(ies)")
    if fabricated:
        failures.append(f"{len(fabricated)} store frame(s) contradicting content")
        for name, rs in fabricated:
            print(f"  ABSENT-FRAME PUBLISHED: '{name}' {rs} — content says this ruleset has no "
                  f"such edge, the store still publishes "
                  f"{_votes.migrate_entry(votes[name])['community'][rs]['success_rate']}")

    if failures:
        print("ERROR: votes.json disagrees with content: " + "; ".join(failures))
        if fabricated:
            # Only this leg has a two-sided resolution; printing it for a collapsed join or a
            # malformed entry would point the reader at the wrong repair.
            print("       Resolve a contradicting frame in CONTENT (restore the frame) or in the "
                  "STORE (retire the frame to null, discarding its community votes).")
        print("       Never by defaulting the cell: null is 'no such edge', not zero.")
        sys.exit(1)


def seed_entry_map(rate_map: dict) -> dict:
    """Mint a pure-seed forked votes entry carrying the technique's OWN ``{gi, nogi}`` rate.

    The ONE seam for minting an entry — both the seed path and the update path's "new
    technique" branch call it, so there is no second copy to drift (CLAUDE.md §6.5).
    ``_votes.seed_entry`` takes a single scalar and mirrors it into both frames, which is
    right only while gi == nogi; on a forked rate it invents the absent frame. Here a null
    cell STAYS null, so the entry keeps saying what the content said: this technique does
    not exist in that ruleset.

    Byte-identical to ``_votes.seed_entry(rate)`` on a mirror map, which is why the whole
    corpus seeds to the same votes.json today.
    """
    m = as_map(rate_map)
    return {"community": {rs: {"success_rate": m.get(rs), "vote_count": _votes.PRIOR_VOTE_COUNT}
                          for rs in _votes.RULESETS}}


def _null_frames(entry: dict) -> int:
    """How many ruleset frames this entry carries as null (i.e. absent in that ruleset)."""
    return sum(1 for rs in _votes.RULESETS if entry["community"][rs]["success_rate"] is None)


def seed_votes(content_rates: dict[str, dict]) -> dict:
    """Create initial votes.json from content rates (forked {community} schema, seed vote count)."""
    votes = {}
    minted_null = 0
    for name, rate_map in sorted(content_rates.items()):
        entry = seed_entry_map(rate_map)
        minted_null += 1 if _null_frames(entry) else 0
        votes[name] = entry
    # Printed unconditionally: a null-frame mint has to be VISIBLE, not inferred from silence.
    print(f"  Seeded {len(votes)} entry(ies) ({minted_null} with a null ruleset frame)")
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

    # SECURITY/robustness: the `next` cursor is server-returned, but validate it stays
    # on the trusted PostHog host (defense against an SSRF-style redirect of the
    # Authorization header) and bound the loop so a pathological cursor can't spin
    # forever / exhaust memory.
    pages = 0
    MAX_PAGES = 1000
    while next_url and pages < MAX_PAGES:
        pages += 1
        host = urllib.parse.urlparse(next_url).hostname or ""
        if host != "us.posthog.com":
            print(f"  ERROR: refusing to follow PostHog pagination to untrusted host {host!r}")
            break

        req = urllib.request.Request(next_url)
        req.add_header("Authorization", f"Bearer {api_key}")

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
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

        # SECURITY: `adjusted_rate` and `distinct_id` come from anonymous client-emitted
        # PostHog events (the public capture key signs nothing), so this input is
        # attacker-controlled. Reject non-finite values and CLAMP to [0,100] so a forged
        # event cannot push a published success_rate out of range or poison it with
        # NaN/Infinity. (Per-identity dedup below still relies on distinct_id, which can
        # be spoofed — Sybil-resistance via authenticated voting is a deeper follow-up.)
        try:
            rate = float(adjusted_rate)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(rate):
            continue
        rate = max(0.0, min(100.0, rate))

        user_rates[technique][distinct_id] = rate

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
    unknown = 0
    # Per-frame skips: a vote that reached a ruleset the technique does not exist in.
    skipped_absent: dict[str, int] = defaultdict(int)
    for technique, user_rates in user_final_rates.items():
        if technique not in votes:
            print(f"  WARNING: Technique '{technique}' not in votes.json, skipping")
            unknown += 1
            continue

        # Migrate to the forked {community, prior} schema (mirrors a legacy scalar into both frames)
        # and preserve any calibrated `prior`. The single-number vote UI this phase applies one
        # community vote to BOTH frames equally — fold it into each frame's own success_rate/count.
        entry = _votes.migrate_entry(votes[technique])

        avg_user_rate = sum(user_rates.values()) / len(user_rates)
        num_new_votes = len(user_rates)

        folded = 0
        for rs in _votes.RULESETS:
            community = entry["community"][rs]
            current_rate = community["success_rate"]
            current_count = community["vote_count"]
            if current_rate is None:
                # null != 0: this technique has no edge in this ruleset. The vote UI casts ONE
                # number and this loop applied it to BOTH frames unconditionally, so a vote
                # could reach a frame the content denies — `None * count` is a TypeError the
                # moment a fork lands, and "fixing" it with `or 0` would be worse: it mints a
                # published rate for an edge that does not exist. Do NOT backfill from the
                # other frame either — a vote is about the frame the player was actually in.
                skipped_absent[rs] += 1
                continue
            new_rate = (current_rate * current_count + avg_user_rate * num_new_votes) / (current_count + num_new_votes)
            community["success_rate"] = round(new_rate, 2)
            community["vote_count"] = current_count + num_new_votes
            folded += 1

        votes[technique] = entry  # re-attach (migrate_entry returns a new dict for legacy entries)
        if folded:
            updated += 1

    skip_note = ", ".join(f"{rs} {n}" for rs, n in sorted(skipped_absent.items())) or "none"
    print(f"  Updated {updated} technique(s) from {len(events)} event(s) "
          f"[{unknown} unknown name(s); frames skipped as absent: {skip_note}]")

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

    # Load current content rates. report_rate_coverage prints the positive counts and
    # hard-fails below the floor, so an empty or partial load can never proceed quietly
    # into a votes.json rewrite (CLAUDE.md §6.6).
    content_rates, rate_stats = load_content_rates(content_dir)
    report_rate_coverage(content_rates, rate_stats)

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

        # The store is checked against content BEFORE anything mutates it: the add loop
        # below only mints names the store lacks, so an already-seeded entry whose content
        # frame has since gone null is otherwise never looked at again.
        report_store_vs_content(votes_data, content_rates)

        # Add any new techniques not yet in votes.json
        added = 0
        added_null = 0
        for name, rate_map in content_rates.items():
            if name not in votes_data.get("votes", {}):
                entry = seed_entry_map(rate_map)
                added_null += 1 if _null_frames(entry) else 0
                votes_data.setdefault("votes", {})[name] = entry
                added += 1
        # Unconditional: "added 0" and "the branch never ran" must not read the same.
        print(f"  Added {added} new technique(s) to votes.json ({added_null} with a null ruleset frame)")

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
