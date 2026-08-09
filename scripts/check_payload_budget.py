#!/usr/bin/env python3
"""Payload-budget gate — per-page HTML bytes + shared bundle ceilings.

Why this exists (v1.80.0, legacy-variant excision): the site shipped TWO front-ends to
every visitor. The default is the Neural app; the old Quartz page UI was opt-in via
`?variant=legacy` and nobody opted in — yet every page carried it. That dead weight was
the single largest lever on a real-user LCP P75 of ~13.7s.

Deleting weight once is easy; keeping it deleted is the hard part. This gate is a
RATCHET on emitted bytes: it measures the built site against ceilings committed in
tests/artifacts/budget_site.json and fails when the payload grows past them. It is
deliberately stdlib-only and takes no arguments beyond --update, so it can run in CI
right after `npm run build` next to check_seo_parity.py.

What it measures:
  - postscript.js / prescript.js / index.css — the shared bundles every page loads.
  - A representative sample of page archetypes: total HTML bytes per page.
  - Aggregate emitted HTML bytes across every .html in the build (catches a regression
    that hides in the long tail rather than in the sample).

Usage:
  python3 scripts/check_payload_budget.py --update   # (re)seed ceilings from a build
  python3 scripts/check_payload_budget.py            # gate: exit 1 if over budget

A ceiling is a MAX, so shrinking always passes. Re-seeding with --update RAISES the
ceilings to whatever the current build emits, so it must be a deliberate, separately
justified commit — never a way to make a regression green.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source/public"
BUDGET = ROOT / "tests/artifacts/budget_site.json"

# Shared bundles fetched by every page. postscript.js is the one that carried the whole
# legacy client stack (pixi.js + d3 + tween via the two graph scripts).
BUNDLES = [
    "postscript.js",
    "prescript.js",
    "index.css",
]

# One route per page archetype — the same sample shape check_seo_parity.py uses, so a
# byte regression and an SEO regression are reported against comparable surfaces.
PAGES = [
    "index.html",
    "Positions/Mount.html",
    "Positions/Mount/Top.html",
    "Positions.html",
    "Transitions/Armbar-from-Back-Transition.html",
    "Transitions/Armbar-from-Back-Transition/Attacker.html",
    "Submissions/Rear-Naked-Choke.html",
    "Systems.html",
    "game-over.html",
]

# Headroom applied when seeding, so day-to-day content edits (the bot rewrites pages
# daily and legitimately adds prose) do not trip the gate. The ceiling is about
# structural weight, not about a paragraph.
SEED_HEADROOM = 1.10
FORMAT = 1


def measure() -> dict:
    out: dict = {"bundles": {}, "pages": {}}
    missing: list[str] = []

    for name in BUNDLES:
        f = PUBLIC / name
        if f.exists():
            out["bundles"][name] = f.stat().st_size
        else:
            missing.append(name)

    for route in PAGES:
        f = PUBLIC / route
        if f.exists():
            out["pages"][route] = f.stat().st_size
        else:
            missing.append(route)

    total = 0
    count = 0
    for f in PUBLIC.rglob("*.html"):
        total += f.stat().st_size
        count += 1
    out["html_total_bytes"] = total
    out["html_file_count"] = count

    if missing:
        print(f"WARNING: {len(missing)} sample path(s) not built: {missing}", file=sys.stderr)
    return out


def fmt(n: int) -> str:
    return f"{n:,} B"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--update", action="store_true", help="(re)seed the ceilings from this build")
    args = ap.parse_args()

    if not PUBLIC.exists():
        print(f"ERROR: {PUBLIC} not found — run `npm run build` first", file=sys.stderr)
        sys.exit(1)

    cur = measure()

    if args.update:
        budget = {
            "_meta": {
                "format": FORMAT,
                "seed_headroom": SEED_HEADROOM,
                "note": (
                    "Ceilings are MAX emitted bytes. Shrinking passes. Raising a ceiling "
                    "means the payload grew — justify it in the commit body."
                ),
            },
            "bundles": {k: int(v * SEED_HEADROOM) for k, v in cur["bundles"].items()},
            "pages": {k: int(v * SEED_HEADROOM) for k, v in cur["pages"].items()},
            "html_total_bytes": int(cur["html_total_bytes"] * SEED_HEADROOM),
            "observed": cur,
        }
        BUDGET.parent.mkdir(parents=True, exist_ok=True)
        BUDGET.write_text(json.dumps(budget, indent=1, sort_keys=True) + "\n")
        print(f"budget seeded -> {BUDGET}")
        for k, v in cur["bundles"].items():
            print(f"  {k}: observed {fmt(v)} -> ceiling {fmt(int(v * SEED_HEADROOM))}")
        print(
            f"  html total: observed {fmt(cur['html_total_bytes'])} across "
            f"{cur['html_file_count']} files -> ceiling "
            f"{fmt(int(cur['html_total_bytes'] * SEED_HEADROOM))}"
        )
        return

    if not BUDGET.exists():
        print(f"ERROR: no budget at {BUDGET}; run with --update first", file=sys.stderr)
        sys.exit(1)
    budget = json.loads(BUDGET.read_text())
    if budget.get("_meta", {}).get("format") != FORMAT:
        print(
            f"ERROR: budget is format {budget.get('_meta', {}).get('format')}, this gate "
            f"needs {FORMAT}",
            file=sys.stderr,
        )
        sys.exit(1)

    failures: list[str] = []
    notes: list[str] = []

    for name, ceiling in budget.get("bundles", {}).items():
        got = cur["bundles"].get(name)
        if got is None:
            notes.append(f"{name}: not emitted (was budgeted at {fmt(ceiling)})")
            continue
        if got > ceiling:
            failures.append(f"{name}: {fmt(got)} exceeds ceiling {fmt(ceiling)}")
        else:
            notes.append(f"{name}: {fmt(got)} / {fmt(ceiling)}")

    for route, ceiling in budget.get("pages", {}).items():
        got = cur["pages"].get(route)
        if got is None:
            failures.append(f"{route}: MISSING from build (was budgeted at {fmt(ceiling)})")
            continue
        if got > ceiling:
            failures.append(f"{route}: {fmt(got)} exceeds ceiling {fmt(ceiling)}")

    total_ceiling = budget.get("html_total_bytes")
    if total_ceiling is not None and cur["html_total_bytes"] > total_ceiling:
        failures.append(
            f"total emitted HTML: {fmt(cur['html_total_bytes'])} exceeds ceiling "
            f"{fmt(total_ceiling)}"
        )

    for n in notes:
        print("  ·", n)
    if failures:
        print(f"✗ PAYLOAD BUDGET EXCEEDED — {len(failures)} over budget:")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print(
        f"✓ payload budget OK — {len(budget.get('bundles', {}))} bundles, "
        f"{len(budget.get('pages', {}))} sampled pages, "
        f"{fmt(cur['html_total_bytes'])} total HTML across {cur['html_file_count']} files"
    )


if __name__ == "__main__":
    main()
