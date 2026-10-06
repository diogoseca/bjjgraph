#!/usr/bin/env python3
"""check_redirect_targets.py — every `_redirects` target resolves to built output (v1.212.7, OCREDIR1).

WHY. `regenerate_redirects.py` wrote its targets with only the space-to-hyphen rule while Quartz
builds pages with its own `sluggify`. So 100% Sweep's rule pointed at /Transitions/100%-Sweep, a
path nothing builds, while the real page is /Transitions/100-percent-Sweep. Nothing compared the
file against the build, so a 301 to a 404 looked exactly like a working redirect. Measured on
production 2026-10-01: the rule's raw-% source got 400 from Cloudflare's edge, and the real page's
lowercase variant (/transitions/100-percent-sweep) 404'd because it had no rule.

WHAT IT CHECKS, against the BUILT tree (run it after the Quartz build AND the share-shell step,
because `/l/* /l.html 200` points at a file that step writes):
  - every rule's target resolves: "/" -> index.html; a path -> an existing file, `<path>.html`, or
    `<path>/index.html` (percent-escapes decoded first);
  - a target with a placeholder (`:splat`, `*`, `:name`) cannot name one page, so the static prefix
    before the first placeholder must resolve as a built directory or page;
  - an external target (http/https) is counted and printed, not fetched;
  - no SOURCE carries a "%" that is not a valid escape: the edge answers those with 400 before
    `_redirects` is ever read, so the rule is dead.

ABSENCE IS NOT A PASS (CLAUDE.md §6.6). It prints a positive count of what it resolved, and fails
on any miss, on an empty or missing `_redirects`, and on a tree with no built pages.

Usage: python3 scripts/check_redirect_targets.py [--public DIR]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PUBLIC = PROJECT_ROOT / "source" / "public"
TAG = "[check_redirect_targets]"
PLACEHOLDER = re.compile(r"(^|/)(\*|:[A-Za-z_]\w*)")
BAD_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")


def _page(public: Path, path: str) -> str | None:
    """'file' / 'page' when `path` names built output, else None."""
    rel = unquote(path.split("#", 1)[0].split("?", 1)[0]).strip("/")
    if not rel:
        return "page" if (public / "index.html").is_file() else None
    if (public / rel).is_file():
        return "file"
    if (public / (rel + ".html")).is_file() or (public / rel / "index.html").is_file():
        return "page"
    return None


def check(public: Path) -> tuple[list[str], dict]:
    """(failures, counts) for the `_redirects` in `public`."""
    counts = {"rules": 0, "page": 0, "file": 0, "splat": 0, "external": 0, "html": 0}
    redirects = public / "_redirects"
    if not public.is_dir():
        return [f"no built site at {public}"], counts
    counts["html"] = sum(1 for _ in public.rglob("*.html"))
    if counts["html"] == 0:
        return [f"{public} holds no built pages: run this after the build, not before"], counts
    if not redirects.is_file():
        return [f"{redirects} is missing: regenerate_redirects.py did not run"], counts
    failures = []
    for n, raw in enumerate(redirects.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            failures.append(f"line {n}: no target: {line}")
            continue
        counts["rules"] += 1
        src, target = parts[0], parts[1]
        if BAD_ESCAPE.search(src):
            failures.append(f"line {n}: the source carries a raw '%', which the edge rejects with 400 (the rule can never fire): {line}")
        if re.match(r"https?://", target):
            counts["external"] += 1
            continue
        m = PLACEHOLDER.search(target)
        if m:
            prefix = target[: m.start()] or "/"
            rel = unquote(prefix).strip("/")
            if (public / rel).is_dir() or _page(public, prefix):
                counts["splat"] += 1
            else:
                failures.append(f"line {n}: the placeholder target's base {prefix} is not built: {line}")
            continue
        kind = _page(public, target)
        if kind:
            counts[kind] += 1
        else:
            failures.append(f"line {n}: the target {target} is not a built page or file: {line}")
    if counts["rules"] == 0:
        failures.append(f"{redirects} holds no rules")
    return failures, counts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--public", type=Path, default=DEFAULT_PUBLIC)
    args = ap.parse_args()
    failures, c = check(args.public)
    resolved = c["page"] + c["file"] + c["splat"]
    print(f"{TAG} {resolved} of {c['rules'] - c['external']} checked targets resolve to built output "
          f"({c['page']} pages, {c['file']} files, {c['splat']} placeholder bases) "
          f"across {c['html']} built pages; {c['external']} external target(s) not fetched")
    if failures:
        for f in failures:
            print(f"{TAG} FAIL {f}", file=sys.stderr)
        print(f"{TAG} {len(failures)} failure(s)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
