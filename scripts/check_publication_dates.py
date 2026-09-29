#!/usr/bin/env python3
"""Guard publication AND modification provenance on the complete emitted corpus.

Timestamp cardinality cannot detect checkout clocks: the real broken build had 901
distinct publication values, all within 0.904 seconds. Measure UTC calendar days, span,
and largest day share instead, with separate measured policies for each date field.

The modified policy is a standing regression guard too: when authored/Git modification
is unavailable and filesystem fallback is disabled, lastmod's final coercion supplies
the build clock. "Recent" passes that failure. All three spread checks must reject it.
The 50% day-share ceiling deliberately accommodates the healthy 37.7% modification
cluster (2,307/6,118 pages on 2026-07-16); do not tighten without remeasuring the corpus.

Use the existing emit parser, never a second HTML interpretation. --captured-dates
accepts its saved per-page date maps for reproducible controls against an actual prior
build. The @curated deployment caller always scans the real built tree.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from emit_fingerprint import scan_tree

ROOT = Path(__file__).resolve().parent.parent
POLICY = ROOT / "tests/artifacts/publication_date_policy.json"
FIELDS = {
    "article:published_time": ("published", "property=article:published_time"),
    "datePublished": ("published", ".datePublished"),
    "article:modified_time": ("modified", "property=article:modified_time"),
    "dateModified": ("modified", ".dateModified"),
}


def capture_dates(tree: Path, jobs: int = 2) -> dict:
    rows = {}
    for name, record in scan_tree(tree, jobs).items():
        if record.get("cls") != "html":
            continue
        fp = record.get("fp") or {}
        row = {k: v for k, v in (fp.get("meta_map") or {}).items()
               if k in ("property=article:published_time", "property=article:modified_time")}

        def walk(obj, location):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key in ("datePublished", "dateModified"):
                        row[location + "." + key] = value
                    else:
                        walk(value, location + "." + key)
            elif isinstance(obj, list):
                for i, value in enumerate(obj):
                    walk(value, f"{location}[{i}]")

        for i, schema in enumerate(fp.get("jsonld") or []):
            walk(json.loads(schema), f"jsonld[{i}]")
        rows[name] = row
    return rows


def assess(rows: dict, policy: dict) -> tuple[dict, list[str]]:
    stats = {}
    issues = []
    if len(rows) < 6000:
        issues.append(f"HTML_COVERAGE {len(rows)} < 6000")
    for field, (kind, selector) in FIELDS.items():
        dates = []
        for name, row in rows.items():
            values = [v for k, v in row.items()
                      if k == selector or (selector.startswith(".") and k.endswith(selector))]
            if not values:
                continue
            if any(value != values[0] for value in values):
                issues.append(f"{field} disagrees between entities in {name}")
                continue
            try:
                dt = datetime.fromisoformat(values[0].replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    raise ValueError("timezone missing")
                dates.append(dt.astimezone(timezone.utc))
            except (AttributeError, TypeError, ValueError):
                issues.append(f"{field} invalid date in {name}: {values[0]!r}")
        days = Counter(dt.date().isoformat() for dt in dates)
        span = (max(dates) - min(dates)).total_seconds() / 86400 if dates else 0
        peak = max(days.values(), default=0) / len(dates) if dates else 1
        stats[field] = {
            "pages": len(dates), "distinct_values": len(set(dates)),
            "distinct_days": len(days), "span_days": span, "max_day_share": peak,
            "first": min(dates).isoformat() if dates else None,
            "last": max(dates).isoformat() if dates else None,
            "day_counts": dict(sorted(days.items())),
        }
        # Page-level OG covers a few pages with no enriched JSON-LD entity. The oldest
        # homepage date and one guide day exist only in OG: calibrate that coverage too.
        limits = {**policy[kind], **policy[kind].get("surfaces", {}).get(field, {})}
        if len(dates) < limits["min_pages"]:
            issues.append(f"{field} PAGE_COVERAGE {len(dates)} < {limits['min_pages']}")
        if len(days) < limits["min_distinct_days"]:
            issues.append(f"{field} DISTINCT_DAYS {len(days)} < {limits['min_distinct_days']}")
        if span < limits["min_span_days"]:
            issues.append(f"{field} SPAN_DAYS {span:.9f} < {limits['min_span_days']}")
        if peak > limits["max_day_share"]:
            issues.append(f"{field} MAX_DAY_SHARE {peak:.6%} > {limits['max_day_share']:.0%}")
    for name, row in rows.items():
        for kind, (_, selector) in FIELDS.items():
            if not kind.startswith("date"):
                continue
            og = row.get("property=article:published_time" if kind == "datePublished"
                         else "property=article:modified_time")
            values = [v for k, v in row.items() if k.endswith(selector)]
            if values and any(value != og for value in values):
                issues.append(f"{name}: OG and JSON-LD {kind} disagree")
    return stats, issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tree", type=Path, default=ROOT / "source/public")
    parser.add_argument("--captured-dates", type=Path)
    parser.add_argument("--policy", type=Path, default=POLICY)
    parser.add_argument("--write-dates", type=Path)
    parser.add_argument("--write-stats", type=Path)
    parser.add_argument("--jobs", type=int, default=2)
    args = parser.parse_args()
    policy = json.loads(args.policy.read_text())
    rows = (json.loads(args.captured_dates.read_text()) if args.captured_dates
            else capture_dates(args.tree, args.jobs))
    stats, issues = assess(rows, policy)
    if args.write_dates:
        args.write_dates.write_text(json.dumps(rows, indent=2, sort_keys=True) + "\n")
    if args.write_stats:
        args.write_stats.write_text(json.dumps(stats, indent=2, sort_keys=True) + "\n")
    print(f"Publication/modified date health: {len(rows)} HTML pages")
    for field, row in stats.items():
        print(f"  {field}: {row['pages']} pages, {row['distinct_values']} timestamps, "
              f"{row['distinct_days']} days, span {row['span_days']:.9f} days, "
              f"largest day {row['max_day_share']:.6%}")
    for issue in issues:
        print("FAIL " + issue)
    if not issues:
        print("PASS all per-field coverage, spread, and OG/JSON-LD agreement checks")
    return int(bool(issues))


if __name__ == "__main__":
    sys.exit(main())
