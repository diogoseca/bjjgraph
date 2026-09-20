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

ONE OF THOSE CEILINGS IS NO LONGER A CEILING (v1.189.0, owner's call). `eager_gzip_bytes`
left this file for the three-band policy in tests/artifacts/payload_policy.json: a target it
may sit above, an action threshold it may not cross, and a cap on how much ONE change may
add. scripts/_payload_policy.py carries the full rationale and the owner's own words. Why it
had to move, in one measurement: on the tree this change was written against the eager set
gzips to 329,808 against a 330,000 ceiling — 192 BYTES — so the next neural feature of any
size was going to go red on arrival, and the only move available was to raise the ceiling
again. budget_neural.json's `raising_a_ceiling` note is three such raises long, and one of
them skipped a deploy.

HOW THE POLICY NUMBERS ARE SET, because the old answer ("--update in its own commit") is
wrong for them and answering it wrongly is how a gate gets worked around:
  · target / action / delta_cap — BY HAND, in tests/artifacts/payload_policy.json, with the
    reasoning in that file's own _comment. There is no flag; they are a judgement, not a
    measurement, and --update refuses to touch them (it says so out loud).
  · baseline — `--accept-baseline <metric> --reason "..."`, which measures, checks the new
    figure is not itself over the action threshold, and records the previous value, the ref,
    the date and the reason. Never automatic: a baseline that advanced itself on every green
    run would make the delta cap vacuous (delta always 0) while still reading as a check that
    ran. See _payload_policy.py.
"""
import argparse
import gzip
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _payload_policy as policy  # noqa: E402  (stdlib-only sibling, same directory)

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source/public"
BUDGET = ROOT / "tests/artifacts/budget_site.json"
GATE = "scripts/check_payload_budget.py"  # how this gate names itself in the policy file

# The Neural app's data root, and the subdirectories inside it that hold ON-DEMAND chunks
# (fetched per deck / per node, never at boot). Everything else under NEURAL_DIR is eager.
NEURAL_DIR = "static/neural"
CHUNK_DIRS = ("flashcards", "content", "submission-details")

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
#   · concepts.json — the Principles + Learning index (v1.152.0): read only when the Explore tab
#     renders one of those two sections. Its readable BODIES are not here at all — they live in
#     the per-node content/ chunk space, so they are already scored as on-demand chunks.
#   · aliases.json — exact-site naming metadata, fetched when Explore/search is used.
DEFERRED = ("systems.json", "concepts.json", "aliases.json")

# Hand-set TARGETS, not seeded observations (see the module docstring). "Eager" is the raw
# and gzip weight of the boot set; a chunk ceiling keeps the on-demand path honest (a 5MB
# "chunk" is a monolith with a new name).
# Ratcheted DOWN in v1.107.1 after the graph-data wire compaction (v1.107.0) landed the eager
# set at 1,302,636 raw / 271,124 gzip: the new ceilings hold ~20% headroom for content growth
# while making a return of the fat wire (or any new eager payload of that class) a hard red.
#
# `eager_gzip_bytes` IS DELIBERATELY ABSENT (v1.189.0) — it is governed by the three-band policy
# in tests/artifacts/payload_policy.json, not by a ceiling here. Putting it back would SHADOW the
# policy silently (a stale hard ceiling and a soft one enforce different things and only the
# stricter is ever seen), so POLICY_OWNED below turns that mistake into a hard, named failure
# rather than a quiet reversion.
NEURAL_TARGET = {
    "eager_raw_bytes": 1_600_000,
    "chunk_max_bytes": 40_000,
    "deferred_raw_bytes": 500_000,
}

# Metric names under budget["neural"] that MOVED to the policy file. A ceiling left behind for one
# of these is not harmless leftover state: it re-imposes the hard rule the owner replaced.
POLICY_OWNED = ("eager_gzip_bytes",)

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
    hand-tightened ceiling is never loosened by a re-seed), else the hand-set target.

    min(committed, target) is why --update can only ever TIGHTEN these three, and why the brief
    for v1.189.0 could truthfully say "--update cannot raise a neural ceiling". That is correct
    for a ratchet and was wrong for eager_gzip_bytes, whose only escape was a hand edit of the
    committed JSON: the three-band policy is where that number lives now, and this function does
    not emit it (POLICY_OWNED). Raising one of the three that remain is still a hand edit of
    NEURAL_TARGET, deliberately."""
    prev = {}
    if BUDGET.exists():
        try:
            prev = (json.loads(BUDGET.read_text()) or {}).get("neural") or {}
        except json.JSONDecodeError:
            prev = {}
    return {k: min(int(prev.get(k, v)), v) for k, v in NEURAL_TARGET.items()}


def _measured(metric: str, cur: dict):
    """The live (value, delta_value) for a policy metric THIS gate measures.

    Returns (None, None) for a name it does not know, and the caller turns that into a hard
    failure rather than a skip: a metric the policy assigns to this gate that this gate cannot
    measure is a rule nothing enforces, which is the failure class this repo keeps re-finding
    (CLAUDE.md §6.6 — absence produces a plausible answer)."""
    if metric == "neural.eager_gzip_bytes":
        v = cur["neural"]["eager_gzip_bytes"]
        return v, v
    return None, None


def _tree_ref() -> str:
    """A human-readable stamp for a baseline: the version in package.json plus the short sha, so
    the growth log in the policy file says WHICH tree each accepted figure was measured on."""
    ver = "?"
    try:
        ver = json.loads((ROOT / "package.json").read_text()).get("version", "?")
    except (OSError, json.JSONDecodeError):
        pass
    sha = ""
    try:
        sha = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return f"v{ver}" + (f" ({sha})" if sha else "")


def _accept_baseline(metric: str, reason: str, cur: dict) -> None:
    """Advance one metric's delta baseline, deliberately and on the record.

    This is the ONLY way a baseline moves. It is not run by the gate, by a build or by CI — see
    scripts/_payload_policy.py for why a self-advancing baseline is a delta check that never runs.
    It refuses a figure that is itself over the action threshold: that band is a hard stop, and
    accepting a baseline must never be a way round it."""
    doc = policy.load()
    spec = doc["metrics"].get(metric)
    if spec is None:
        raise SystemExit(
            f"ERROR: {metric!r} is not in {policy.POLICY_PATH.relative_to(ROOT)} — "
            f"known metrics: {', '.join(sorted(doc['metrics']))}"
        )
    if not reason:
        raise SystemExit("ERROR: --accept-baseline requires --reason; an unexplained baseline move is the thing this file exists to prevent")

    src_note = ""
    if spec.get("gate") == GATE:
        value, delta_value = _measured(metric, cur)
        if value is None:
            raise SystemExit(f"ERROR: {metric!r} is assigned to {GATE} but this gate cannot measure it")
        src_note = "measured from the built tree by this script"
    else:
        # a metric another gate measures (today: the browser gate). Its observed figures are
        # written to a committed report on every run; we read that, and record WHEN it was
        # measured so a stale accept is visible in the diff rather than invisible in the number.
        src = ROOT / spec.get("accept_from", "")
        if not spec.get("accept_from") or not src.exists():
            raise SystemExit(
                f"ERROR: {metric!r} is measured by {spec.get('gate')} and its `accept_from` report "
                f"({spec.get('accept_from') or 'unset'}) is not on disk — run that gate first"
            )
        rep = json.loads(src.read_text())
        field = spec.get("delta_measured_on")
        band_field = spec.get("value_field", metric)
        if field not in rep or band_field not in rep:
            raise SystemExit(
                f"ERROR: {src.relative_to(ROOT)} carries no {field!r}/{band_field!r} — it predates "
                f"the policy; re-run {spec.get('gate')} to refresh it"
            )
        value, delta_value = rep[band_field], rep[field]
        src_note = f"read from {spec['accept_from']} measured at {rep.get('_meta', {}).get('measured_at', 'unknown')}"

    if value > spec["action"]:
        raise SystemExit(
            f"ERROR: refusing to accept {policy.fmt(value)} for {metric} — it is over the "
            f"{policy.fmt(spec['action'])} action threshold, which is a hard stop. Shed bytes, or "
            f"change the threshold by hand in {policy.POLICY_PATH.relative_to(ROOT)} with a reason."
        )

    prev = spec.get("baseline")
    spec["previous_baseline"] = prev
    spec["baseline"] = int(delta_value)
    spec["baseline_ref"] = _tree_ref()
    spec["baseline_at"] = date.today().isoformat()
    spec["baseline_reason"] = reason
    spec["baseline_source"] = src_note
    policy.POLICY_PATH.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    moved = "seeded" if not isinstance(prev, int) else f"{prev:,} -> {int(delta_value):,} ({int(delta_value) - prev:+,})"
    print(f"baseline accepted: {metric} {moved}")
    print(f"  band figure {policy.fmt(value)} · delta figure {policy.fmt(delta_value)} · {src_note}")
    print(f"  ref {spec['baseline_ref']} · reason: {reason}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--update", action="store_true", help="(re)seed the RATCHET ceilings from this build (never the policy)")
    ap.add_argument("--accept-baseline", metavar="METRIC", help="advance one policy metric's delta baseline to the current figure")
    ap.add_argument("--reason", default="", help="why the baseline moved; required with --accept-baseline, recorded in the policy file")
    args = ap.parse_args()

    if not PUBLIC.exists():
        print(f"ERROR: {PUBLIC} not found — run `npm run build` first", file=sys.stderr)
        sys.exit(1)

    cur = measure()

    if args.accept_baseline:
        _accept_baseline(args.accept_baseline, args.reason, cur)
        return

    if args.update:
        # SAY WHAT THIS FLAG DOES NOT DO. The old one-line rule ("raising a ceiling needs --update
        # in its own justified commit") was already false for the neural ceilings — _neural_ceilings()
        # takes min(committed, target) so --update can only tighten them — and is now false for the
        # policy metrics in a second way. A flag that silently declines to do the thing its name
        # implies is how a number ends up hand-edited without a record.
        try:
            skipped = sorted(policy.load()["metrics"])
            print(
                "  · --update does NOT touch the three-band policy "
                f"({policy.POLICY_PATH.relative_to(ROOT)}): {', '.join(skipped)}. "
                "target/action/delta_cap are hand-set; move a baseline with "
                "`--accept-baseline <metric> --reason \"...\"`.",
                file=sys.stderr,
            )
        except policy.PolicyError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        # PRESERVE the _meta keys this seeder does not own. It used to rebuild _meta from
        # scratch, which silently deleted `neural_note` — the paragraph explaining WHY
        # eager_gzip_bytes is absent from this file. The POLICY_OWNED guard would still have
        # fired, but the reader would have met a bare failure with no explanation anywhere,
        # which is how a correct gate gets "fixed" by putting the ceiling back.
        prev_meta = {}
        if BUDGET.exists():
            try:
                prev_meta = dict((json.loads(BUDGET.read_text()) or {}).get("_meta") or {})
            except json.JSONDecodeError:
                prev_meta = {}
        prev_meta.update(
            {
                "format": FORMAT,
                "seed_headroom": SEED_HEADROOM,
                "note": (
                    "Ceilings are MAX emitted bytes. Shrinking passes. Raising a ceiling "
                    "means the payload grew — justify it in the commit body."
                ),
            }
        )
        budget = {
            "_meta": prev_meta,
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
    for field in POLICY_OWNED:
        if field in nb:
            failures.append(
                f"neural.{field} still carries a hard ceiling in {BUDGET.relative_to(ROOT)} "
                f"({fmt(nb[field])}). It moved to the three-band policy in "
                f"{policy.POLICY_PATH.relative_to(ROOT)}; a ceiling left here shadows the policy "
                f"silently, because only the stricter of the two is ever seen. Delete the key."
            )

    # ── THE THREE-BAND POLICY: target · action · delta cap ──────────────────────────────────
    # Everything above this line is a ratchet — a MAX, red the moment it is crossed. This block
    # is the soft ceiling the owner asked for: growth is allowed, a cliff is not. The bands print
    # a warning and pass; the action threshold and the delta cap are hard.
    #
    # COVERAGE, not silence: `checked` counts the metrics that actually reached a verdict against
    # a committed baseline, and a shortfall is a FAILURE. This gate must never be able to report
    # "payload budget OK" because it found nothing to look at.
    warnings: list[str] = []
    checked = 0
    try:
        pol = policy.load()
        mine = policy.metrics_for(pol, GATE)
        if not mine:
            failures.append(
                f"{policy.POLICY_PATH.relative_to(ROOT)} assigns NO metric to {GATE} — this gate "
                f"would enforce the policy over nothing and still exit 0"
            )
        for name, spec in mine.items():
            value, delta_value = _measured(name, cur)
            if value is None:
                failures.append(
                    f"{name}: the policy assigns it to {GATE}, but this gate has no measurement "
                    f"for that name (see _measured) — the rule is unenforced, not satisfied"
                )
                continue
            r = policy.evaluate(name, spec, value, delta_value)
            checked += 1
            (notes if r["verdict"] == policy.PASS else warnings).extend(r["lines"])
            failures.extend(r["failures"])
        if checked < len(mine):
            failures.append(
                f"policy coverage: {checked} of {len(mine)} metric(s) owned by this gate reached "
                f"a verdict — the rest were not checked at all"
            )
    except policy.PolicyError as e:
        failures.append(f"payload policy unreadable: {e}")

    total_ceiling = budget.get("html_total_bytes")
    if total_ceiling is not None and cur["html_total_bytes"] > total_ceiling:
        failures.append(
            f"total emitted HTML: {fmt(cur['html_total_bytes'])} exceeds ceiling "
            f"{fmt(total_ceiling)}"
        )

    for n in notes:
        print("  ·", n)
    for w in warnings:
        print("  ", w)
    if failures:
        print(f"✗ PAYLOAD BUDGET EXCEEDED — {len(failures)} over budget:")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    # The policy count is printed on the GREEN path too, and deliberately: a reader must be able
    # to tell "the delta cap ran and passed" from "the delta cap did not run", which is the one
    # distinction this repo has lost seventeen recorded times (CLAUDE.md §6.6).
    print(
        f"✓ payload budget OK — {len(budget.get('bundles', {}))} bundles, "
        f"{len(budget.get('pages', {}))} sampled pages, "
        f"{fmt(cur['html_total_bytes'])} total HTML across {cur['html_file_count']} files · "
        f"policy: {checked} metric(s) checked against a committed baseline, "
        f"{len(warnings)} over target"
    )


if __name__ == "__main__":
    main()
