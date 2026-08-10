#!/usr/bin/env python3
"""Payload-budget gate — per-page HTML bytes + shared bundle ceilings.

Why this exists (v1.80.0, legacy-variant excision): the site shipped TWO front-ends to
every visitor. The default is the Neural app; the old Quartz page UI was opt-in via
`?variant=legacy` and nobody opted in — yet every page carried it. That dead weight was
the single largest lever on a real-user LCP P75 of ~13.7s.

Deleting weight once is easy; keeping it deleted is the hard part. This gate is a
RATCHET on emitted bytes: it measures the built site against ceilings committed in
tests/artifacts/budget_site.json and fails when the payload grows past them. It is
deliberately stdlib-only and takes no arguments beyond --update.

WHERE IT RUNS (wired in v1.80.2 — it shipped in v1.80.0 with no caller at all, and an
unwired ratchet is not a ratchet):
  - `npm run validate:payload`             — the direct entry point.
  - `npm run build`                        — chained on the end, so every local build gates.
  - .github/workflows/deploy.yaml          — step "Payload budget (gate)".
  - .github/workflows/deploy-dev.yaml      — step "Payload budget (gate)".
The workflows do NOT invoke root `npm run build` (they re-list the build steps inline), so
the step is placed there explicitly — AFTER "Copy raw HTML folder" and "Build Forward
development libraries", both of which write into source/public. Measuring before them would
compare a smaller tree than we actually ship.

What it measures:
  - postscript.js / prescript.js / index.css — the shared bundles every page loads.
  - A representative sample of page archetypes: total HTML bytes per page.
  - Aggregate emitted HTML bytes across every .html in the build (catches a regression
    that hides in the long tail rather than in the sample).
  - THE NEURAL EAGER SET (v1.80.4): every byte under static/neural/ that is NOT inside an
    on-demand chunk directory. This is the payload a first-time visitor pulls before they
    can make a move, and it was 39.3MB raw / 10.1MB gzip — the whole defect. It is measured
    as "the directory minus the chunk dirs (and the few declared DEFERRED)" rather than as
    a hand-listed set of boot files on purpose: a list of boot files could be made green by
    shortening the list, whereas this can only be made green by actually moving weight
    behind an on-demand fetch. The deferred set is small, named, separately capped, and
    cross-checked by the browser gate — see DEFERRED.

Usage:
  python3 scripts/check_payload_budget.py --update   # (re)seed ceilings from a build
  python3 scripts/check_payload_budget.py            # gate: exit 1 if over budget

A ceiling is a MAX, so shrinking always passes. Re-seeding with --update RAISES the
ceilings to whatever the current build emits, so it must be a deliberate, separately
justified commit — never a way to make a regression green. The neural ceilings are the one
exception to "seed from a build": they are TARGETS, set by hand from the field data
(Cloudflare Observatory LCP P75 13,764ms) and deliberately left RED until the code meets
them, so --update never lowers them silently — see NEURAL_TARGET below.
"""
import argparse
import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source/public"
BUDGET = ROOT / "tests/artifacts/budget_site.json"

# The Neural app's data root, and the subdirectories inside it that hold ON-DEMAND chunks
# (fetched per deck / per node, never at boot). Everything else under NEURAL_DIR is eager.
NEURAL_DIR = "static/neural"
CHUNK_DIRS = ("flashcards", "content")

# Top-level payloads the app deliberately does NOT fetch at boot. Kept as an explicit, tiny list
# because the alternative — silently scoring them as eager — makes this gate measure something
# that is not true, and a wrong gate gets worked around rather than obeyed.
#
# The obvious objection is that a list of exclusions is a loophole (add a file, weight vanishes).
# What closes it: e2e/journeys/payload-first-hand.spec.ts measures the SAME weight from a real
# browser, counting whatever the page actually requests. A file wrongly declared deferred here
# still shows up there. The two gates cross-check each other, and the deferred set has its own
# ceiling below so it cannot grow unbounded either.
#   · systems.json — the authored course library (v1.80.4): read only by the Explore tab and the
#     system buckets, fetched at idle or on first read, never on the roll path.
DEFERRED = ("systems.json",)

# Hand-set TARGETS, not seeded observations (see the module docstring). "Eager" is the raw
# and gzip weight of the boot set; a chunk ceiling keeps the on-demand path honest (a 5MB
# "chunk" is a monolith with a new name).
NEURAL_TARGET = {
    "eager_raw_bytes": 2_500_000,
    "eager_gzip_bytes": 400_000,
    "chunk_max_bytes": 40_000,
    "deferred_raw_bytes": 500_000,
}

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
FORMAT = 2


def measure_neural() -> dict:
    """Split static/neural into its EAGER set (boot) and its on-demand CHUNKS."""
    root = PUBLIC / NEURAL_DIR
    out = {
        "eager_raw_bytes": 0,
        "eager_gzip_bytes": 0,
        "eager_files": [],
        "deferred_raw_bytes": 0,
        "deferred_files": [],
        "chunk_count": 0,
        "chunk_raw_bytes": 0,
        "chunk_max_bytes": 0,
        "chunk_max_file": None,
    }
    if not root.exists():
        return out
    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(root)
        size = f.stat().st_size
        if rel.parts and rel.parts[0] in CHUNK_DIRS and not rel.name.startswith("_"):
            # an on-demand chunk. `_index.json` (the manifest) is EAGER even though it lives
            # in the chunk dir — the app cannot boot without it.
            out["chunk_count"] += 1
            out["chunk_raw_bytes"] += size
            if size > out["chunk_max_bytes"]:
                out["chunk_max_bytes"] = size
                out["chunk_max_file"] = str(rel)
            continue
        if str(rel) in DEFERRED:
            out["deferred_raw_bytes"] += size
            out["deferred_files"].append({"path": str(rel), "raw": size})
            continue
        out["eager_raw_bytes"] += size
        # gzip each file separately: that is how a CDN ships them (one response each), and
        # concatenating first would overstate the compression a real visitor gets.
        out["eager_gzip_bytes"] += len(gzip.compress(f.read_bytes(), 9))
        out["eager_files"].append({"path": str(rel), "raw": size})
    out["eager_files"].sort(key=lambda e: -e["raw"])
    return out


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
    out["neural"] = measure_neural()

    if missing:
        print(f"WARNING: {len(missing)} sample path(s) not built: {missing}", file=sys.stderr)
    return out


def fmt(n: int) -> str:
    return f"{n:,} B"


def _neural_ceilings() -> dict:
    """The neural ceilings to write on --update: whatever is already committed (so a
    hand-tightened ceiling is never loosened by a re-seed), else the hand-set target."""
    prev = {}
    if BUDGET.exists():
        try:
            prev = (json.loads(BUDGET.read_text()) or {}).get("neural") or {}
        except json.JSONDecodeError:
            prev = {}
    return {k: min(int(prev.get(k, v)), v) for k, v in NEURAL_TARGET.items()}


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
            # neural ceilings are TARGETS, never observations: --update must not be able to
            # legitimise a 39MB boot by re-seeding from a build that still ships one. An
            # existing (possibly hand-lowered) ceiling is preserved; otherwise the target.
            "neural": _neural_ceilings(),
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

    # ── the neural eager set: the bytes-to-first-move payload ──
    nb = budget.get("neural") or NEURAL_TARGET
    nc = cur["neural"]
    for field, label in (
        ("eager_raw_bytes", "neural eager (raw)"),
        ("eager_gzip_bytes", "neural eager (gzip)"),
        ("chunk_max_bytes", "largest on-demand chunk"),
        ("deferred_raw_bytes", "deferred payloads (raw)"),
    ):
        ceiling, got = nb.get(field), nc.get(field, 0)
        if ceiling is None:
            continue
        if got > ceiling:
            extra = ""
            if field == "eager_raw_bytes":
                extra = " · heaviest: " + ", ".join(
                    f"{e['path']} {fmt(e['raw'])}" for e in nc["eager_files"][:4]
                )
            elif field == "chunk_max_bytes":
                extra = f" · {nc.get('chunk_max_file')}"
            failures.append(f"{label}: {fmt(got)} exceeds ceiling {fmt(ceiling)}{extra}")
        else:
            notes.append(f"{label}: {fmt(got)} / {fmt(ceiling)}")
    notes.append(
        f"on-demand chunks: {nc.get('chunk_count', 0):,} files, "
        f"{fmt(nc.get('chunk_raw_bytes', 0))} (not fetched at boot)"
    )

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
