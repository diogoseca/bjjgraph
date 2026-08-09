#!/usr/bin/env python3
"""check_headers_cache.py — prove the _headers cache tiers stay DISJOINT.

Why this exists (v1.77.0): Cloudflare's `_headers` contract is
    "An incoming request which matches multiple rules' URL patterns will inherit
     all rules' headers"
and
    "If a header is applied twice in the _headers file, the values are joined with
     a comma separator."

So two matching `Cache-Control` rules produce
    Cache-Control: public, max-age=300, ..., public, max-age=14400, ...
and the FIRST max-age wins. A single careless `/*` Cache-Control rule would
therefore cap the 38MB Neural data layer at the HTML TTL — with no error, no
warning, and no local symptom. Only the field metrics would move the wrong way,
weeks later.

This gate fails the build instead. It asserts:
  1. every probe path matches AT MOST ONE Cache-Control rule;
  2. `/*` never carries Cache-Control;
  3. no rule pattern is defined twice;
  4. Cloudflare's limits hold (<=100 rule blocks, <=2000 chars/line);
  5. `immutable` is absent — every asset here changes under a fixed URL on deploy,
     so immutable would pin stale bundles in browsers for the whole max-age.

Checks the CANONICAL source (source/quartz/static/_headers) and, when present, the
emitted deploy-root copy (source/public/_headers) that regenerate_headers.py writes.

Usage:  python3 scripts/check_headers_cache.py
Exit:   0 = disjoint, 1 = a rule overlap or limit breach ships otherwise.
"""

from __future__ import annotations

import fnmatch
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CANONICAL = PROJECT_ROOT / "source" / "quartz" / "static" / "_headers"
EMITTED = PROJECT_ROOT / "source" / "public" / "_headers"

CF_MAX_RULES = 100
CF_MAX_LINE = 2000

# Representative request paths: one per tier plus the deliberately-uncached ones.
PROBE_PATHS = (
    "/",
    "/Positions",
    "/Positions/Mount/Top",
    "/Transitions",
    "/Transitions/Armbar-from-Mount",
    "/Submissions/Rear-Naked-Choke",
    "/Principles/Frames",
    "/Systems/Leg-Lock-System",
    "/Learning/Fundamentals",
    "/tags/guard",
    "/Game-Over",
    "/Tree",
    "/terms",
    "/privacy",
    "/index.css",
    "/prescript.js",
    "/postscript.js",
    "/static/og-image.png",
    "/static/neural/app/neural.js",
    "/static/neural/graph-data.json",
    "/static/neural/flashcards/_index.json",
    "/static/neural/flashcards/mount__top.json",
    "/sitemap.xml",
    "/index.xml",
    "/llms.txt",
    "/404.html",
    "/dev/screens/",
)


def parse(path: Path) -> list[tuple[str, list[str]]]:
    """[(url_pattern, [header lines])] in file order."""
    blocks: list[tuple[str, list[str]]] = []
    for raw in path.read_text().splitlines():
        if raw.strip().startswith("#") or not raw.strip():
            continue
        if raw.startswith("/"):
            blocks.append((raw.strip(), []))
        elif blocks:
            blocks[-1][1].append(raw.strip())
    return blocks


def matches(pattern: str, url: str) -> bool:
    return fnmatch.fnmatchcase(url, pattern) if "*" in pattern else pattern == url


def check(path: Path) -> list[str]:
    errors: list[str] = []
    blocks = parse(path)
    label = path.relative_to(PROJECT_ROOT)

    if len(blocks) > CF_MAX_RULES:
        errors.append(f"{label}: {len(blocks)} rule blocks exceeds Cloudflare's {CF_MAX_RULES}")

    for lineno, raw in enumerate(path.read_text().splitlines(), 1):
        if len(raw) > CF_MAX_LINE:
            errors.append(f"{label}:{lineno}: line is {len(raw)} chars (Cloudflare cap {CF_MAX_LINE})")

    patterns = [p for p, _ in blocks]
    for dupe in sorted({p for p in patterns if patterns.count(p) > 1}):
        errors.append(f"{label}: pattern {dupe!r} defined more than once — headers would comma-join")

    cache_rules = [
        (p, h) for p, headers in blocks for h in headers if h.lower().startswith("cache-control:")
    ]

    for pattern, header in cache_rules:
        if pattern == "/*":
            errors.append(
                f"{label}: /* carries Cache-Control ({header!r}) — it matches EVERY path, so its "
                f"max-age would comma-join ahead of every specific tier and win. Move it to "
                f"disjoint prefixes."
            )
        if "immutable" in header.lower():
            errors.append(
                f"{label}: {pattern} sets `immutable` — these URLs are not content-hashed and "
                f"change on every deploy, so browsers would pin a stale bundle for the full max-age."
            )

    for url in PROBE_PATHS:
        hits = [p for p, _ in cache_rules if matches(p, url)]
        if len(hits) > 1:
            errors.append(
                f"{label}: {url} matches {len(hits)} Cache-Control rules {hits} — Cloudflare joins "
                f"them with a comma and the first max-age wins. Make them disjoint."
            )
    return errors


def main() -> None:
    targets = [p for p in (CANONICAL, EMITTED) if p.exists()]
    if not targets:
        print(f"[check_headers_cache] ERROR: no _headers found at {CANONICAL}", file=sys.stderr)
        sys.exit(1)

    errors: list[str] = []
    for target in targets:
        errors.extend(check(target))

    if errors:
        print("[check_headers_cache] FAIL", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    tiers = {}
    for pattern, header in (
        (p, h) for p, hs in parse(targets[0]) for h in hs if h.lower().startswith("cache-control:")
    ):
        age = header.split("max-age=")[1].split(",")[0] if "max-age=" in header else "?"
        tiers.setdefault(age, []).append(pattern)
    summary = " · ".join(f"max-age={age}: {len(pats)} rule(s)" for age, pats in sorted(tiers.items(), key=lambda kv: int(kv[0])))
    print(f"[check_headers_cache] OK — {len(targets)} file(s) checked, tiers disjoint. {summary}")


if __name__ == "__main__":
    main()
