#!/usr/bin/env python3
"""check_build_fingerprint.py — refuse a build that emitted the wrong SHAPE of site.

WHAT CHANGED AND WHY (this file was rewritten; see the history note at the bottom)
---------------------------------------------------------------------------------
The original version (v1.77.0) was written to prove the Quartz fork prune changed no
emitted bytes, and for that job it was well aimed. It had two properties that stopped it
being a gate:

  * it had ZERO callers and no committed baseline, so it protected nothing; and
  * it compared per-file SIZE, plus whole-file HTML sha256 only under --strict. Size is
    blind to a same-length edit, and an all-or-nothing page hash is unusable across an
    emitter swap where every page differs somewhere trivial -- it can only say
    "6,149 files changed bytes", which is equally true of a correct migration and a
    catastrophic one.

It also had no non-triviality floor, which is the gap that matters most, because the
other gates do not have one either:

  * check_payload_budget.py computes html_file_count and only INTERPOLATES it into
    f-strings -- it is never compared against anything, and every ceiling is a MAX;
  * check_seo_parity.py samples 10 routes and scopes to the <article>.

So a build that emitted a tenth of its pages passes the payload gate, the SEO gate and a
byte ratchet simultaneously. Nothing in this repo currently says "you emitted 600 pages
and you used to emit 6,149".

THIS FILE IS NOW THAT CHECK. It keeps the original's bundle-hash purpose, drops the
duplicated tree walk (it now shares scripts/emit_fingerprint.py's one implementation, so
there are not two answers to "what is in the emit"), and adds the counts.

TIERS
-----
  Tier 0  ABSOLUTE FLOORS. Hard-coded, deliberately coarse, no baseline required. These
          catch catastrophe on a tree that has never been baselined, and they are the
          reason a broken extractor cannot report a clean build: if the walk stopped
          seeing pages, the floor fires instead of the comparison passing vacuously.
  Tier 1  CENSUS EQUALITY against the committed baseline: page count, per-archetype
          counts, JSON-LD blocks and their @type histogram, in-article links, the
          structural markers, static/** count, and the three bundle hashes.

WHAT THIS IS NOT
----------------
This is the cheap, committed, every-build gate. It answers "is this the right shape of
site". It does NOT answer "is page X byte-for-byte what it was" -- that is
scripts/emit_diff.py, which compares two full manifests produced by
scripts/emit_fingerprint.py and is run against an external golden snapshot during the
emitter migration. Keeping them separate is deliberate: this baseline has to be small
enough to commit and to re-seed whenever content legitimately changes, and a per-page
manifest (~16 MB compressed, 15,769 entries) is neither.

USAGE
-----
  python3 scripts/check_build_fingerprint.py --update   # (re)seed the committed census
  python3 scripts/check_build_fingerprint.py            # gate
  python3 scripts/check_build_fingerprint.py --floors-only   # Tier 0 only, no baseline
Stdlib only. Run after a build.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ONE implementation of "walk the emit and describe it". This file used to carry its own
# rglob + stat loop; two walks meant two answers to the same question, which is the defect
# CLAUDE.md 6.5 is about.
from emit_fingerprint import coverage, scan_tree  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source" / "public"
BASELINE = ROOT / "tests" / "artifacts" / "build_fingerprint.json"

BUNDLES = ("index.css", "prescript.js", "postscript.js")
FORMAT = 2

# Capabilities that live INSIDE a bundle rather than in any page's markup, so no per-page
# marker can see them. The bundle sha already catches any change, but a sha says only
# "something moved"; these say WHICH capability left. CLAUDE.md 6.8 names __bjjAuth
# specifically: AuthUI.tsx renders nothing and is the only static importer of supabase.ts,
# which installs the window.__bjjAuth facade and completes the Google OAuth redirect-back.
# Delete it and signed-in users break while every headless test stays green.
BUNDLE_TOKENS = {
    "postscript.js": ("__bjjAuth",),
}

# ---------------------------------------------------------------------------
# Tier 0 -- absolute floors.
#
# Set well below today's real figures so they catch a collapse, not drift; drift is what
# the committed census catches. They exist so that a vacuous pass is impossible: an
# extractor that silently matched nothing produces zeroes, and zeroes fail here rather
# than comparing equal to each other.
# ---------------------------------------------------------------------------
FLOORS = {
    "files": 12000,          # ~15,769 today
    "html_pages": 6000,      # ~6,149
    "jsonld_blocks": 30000,  # ~33,438
    "article_links": 200000, # ~212,983
    "static_files": 4500,    # ~4,951
    "meta_tags": 100000,     # ~122,760
}
# Counts that must be exactly zero.
ZEROS = ("html_parse_errors", "jsonld_unparseable", "gzip_decompress_errors",
         "read_errors")

# Census fields compared for exact equality against the committed baseline.
CENSUS_KEYS = (
    "files", "html_pages", "pages_with_title", "pages_with_canonical",
    "pages_with_description", "pages_with_og_title", "pages_with_article",
    "pages_with_outside_links", "jsonld_blocks", "meta_tags", "head_links",
    "article_headings", "article_links", "outside_links",
    "semantic_xml", "semantic_json", "semantic_text", "static_files", "gzip_files",
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def capture(jobs: int, tree: Path = None) -> dict:
    tree = tree or PUBLIC
    if not tree.exists():
        sys.exit(f"ERROR: {tree} not found — run `npm run build` first")

    files = scan_tree(tree, jobs)
    cov = coverage(files)

    bundles = {}
    for name in BUNDLES:
        f = tree / name
        bundles[name] = ({"sha256": sha256(f), "bytes": f.stat().st_size}
                         if f.exists() else None)

    bundle_tokens: dict[str, dict] = {}
    for name, toks in BUNDLE_TOKENS.items():
        f = tree / name
        body = f.read_text(encoding="utf-8", errors="replace") if f.exists() else ""
        bundle_tokens[name] = {t: body.count(t) for t in toks}

    by_dir: dict[str, int] = {}
    for rel in files:
        by_dir[rel.split("/")[0] if "/" in rel else "<root>"] = \
            by_dir.get(rel.split("/")[0] if "/" in rel else "<root>", 0) + 1

    return {
        "_meta": {"format": FORMAT},
        "bundles": bundles,
        "bundle_tokens": bundle_tokens,
        "census": {k: cov.get(k, 0) for k in CENSUS_KEYS},
        "zeros": {k: cov.get(k, 0) for k in ZEROS},
        "markers": cov.get("markers", {}),
        "distinct_values": cov.get("distinct_values", {}),
        "jsonld_types": cov.get("distinct_jsonld_types", {}),
        "meta_keys": cov.get("distinct_meta_keys", {}),
        "by_class": cov.get("by_class", {}),
        "by_dir": dict(sorted(by_dir.items())),
    }


def check_floors(cur: dict) -> list[str]:
    problems = []
    for k, floor in FLOORS.items():
        got = cur["census"].get(k, 0)
        if got < floor:
            problems.append(
                f"TIER 0: {k} = {got:,} is below the absolute floor {floor:,}. "
                f"This build did not emit a whole site (or the walk stopped seeing it). "
                f"No other gate in this repo reports this: check_payload_budget.py never "
                f"compares its html_file_count, and check_seo_parity.py samples 10 routes.")
    for k in ZEROS:
        got = cur["zeros"].get(k, 0)
        if got:
            problems.append(f"TIER 0: {k} = {got:,}, must be 0.")
    return problems


def check_census(base: dict, cur: dict) -> list[str]:
    problems = []
    for name in BUNDLES:
        b, c = base["bundles"].get(name), cur["bundles"].get(name)
        if b == c:
            continue
        if b and not c:
            problems.append(f"bundle {name}: NO LONGER EMITTED (was {b['bytes']:,} B)")
        elif c and not b:
            problems.append(f"bundle {name}: newly emitted ({c['bytes']:,} B)")
        else:
            problems.append(
                f"bundle {name}: CHANGED — {b['bytes']:,} -> {c['bytes']:,} B "
                f"({c['bytes'] - b['bytes']:+,}); sha {b['sha256'][:12]} -> {c['sha256'][:12]}")

    for k in CENSUS_KEYS:
        bv, cv = base["census"].get(k, 0), cur["census"].get(k, 0)
        if bv != cv:
            problems.append(f"census {k}: {bv:,} -> {cv:,} ({cv - bv:+,})")

    for bundle, toks in (base.get("bundle_tokens") or {}).items():
        got = (cur.get("bundle_tokens") or {}).get(bundle, {})
        for t, n in toks.items():
            if got.get(t, 0) != n:
                problems.append(
                    f"bundle {bundle}: token '{t}' occurred {n}x -> {got.get(t, 0)}x. "
                    f"That is a named capability leaving the bundle, not a formatting change.")

    for k in sorted(set(base.get("markers", {})) | set(cur.get("markers", {}))):
        bv, cv = base.get("markers", {}).get(k, 0), cur.get("markers", {}).get(k, 0)
        if bv != cv:
            problems.append(f"marker {k}: on {bv:,} pages -> {cv:,} ({cv - bv:+,})")

    for k in sorted(set(base.get("distinct_values", {})) | set(cur.get("distinct_values", {}))):
        bv, cv = base.get("distinct_values", {}).get(k, 0), cur.get("distinct_values", {}).get(k, 0)
        if bv != cv:
            extra = ("  <-- a COLLAPSE here means the field stopped varying; for "
                     "article:modified_time that is the git-date lookup falling back to "
                     "filesystem mtime" if cv < bv else "")
            problems.append(f"distinct values of {k}: {bv:,} -> {cv:,}{extra}")

    for label, key in (("jsonld @type", "jsonld_types"), ("meta key", "meta_keys"),
                       ("file class", "by_class"), ("top-level dir", "by_dir")):
        b, c = base.get(key, {}), cur.get(key, {})
        for k in sorted(set(b) | set(c)):
            if b.get(k, 0) != c.get(k, 0):
                problems.append(f"{label} {k}: {b.get(k, 0):,} -> {c.get(k, 0):,}")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--update", action="store_true", help="(re)seed the committed census")
    ap.add_argument("--floors-only", action="store_true",
                    help="Tier 0 only; needs no baseline")
    ap.add_argument("--jobs", type=int, default=min(8, (os.cpu_count() or 4)))
    ap.add_argument("--tree", help="emit directory to inspect (default source/public); "
                                   "use it to gate a snapshot rather than the live tree")
    a = ap.parse_args()

    cur = capture(a.jobs, Path(a.tree) if a.tree else None)
    c = cur["census"]
    print(f"emit: {c['files']:,} files · {c['html_pages']:,} pages · "
          f"{c['jsonld_blocks']:,} JSON-LD blocks · {c['article_links']:,} in-article links "
          f"· {c['static_files']:,} static files")

    floors = check_floors(cur)
    if floors:
        print("\n✗ BUILD SHAPE REJECTED:")
        for p in floors:
            print("  -", p)
        sys.exit(1)
    print(f"  Tier 0 OK — all {len(FLOORS)} floors cleared, all {len(ZEROS)} error counts zero")

    if a.floors_only:
        return

    if a.update:
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        cur["_note"] = (
            "Committed census for scripts/check_build_fingerprint.py. Re-seed with "
            "--update whenever the emit legitimately changes (content edits move "
            "article_links and the @type histogram), and say in the commit message what "
            "moved and why. This is the cheap shape gate; per-page byte/field comparison "
            "is scripts/emit_diff.py against an external golden snapshot.")
        BASELINE.write_text(json.dumps(cur, indent=1, sort_keys=True) + "\n")
        print(f"\n✓ census captured -> {BASELINE} "
              f"({BASELINE.stat().st_size:,} B)")
        for name in BUNDLES:
            b = cur["bundles"][name]
            if b:
                print(f"    {name}: {b['bytes']:,} B  {b['sha256'][:12]}")
        return

    if not BASELINE.exists():
        sys.exit(f"ERROR: no baseline at {BASELINE}; run --update first "
                 f"(or --floors-only to check Tier 0 alone)")
    base = json.loads(BASELINE.read_text())
    if base.get("_meta", {}).get("format") != FORMAT:
        sys.exit(f"ERROR: baseline format {base.get('_meta', {}).get('format')} != {FORMAT}; "
                 f"re-run --update")

    problems = check_census(base, cur)
    if problems:
        print(f"\n✗ BUILD CENSUS CHANGED ({len(problems)} difference(s)):")
        for p in problems[:80]:
            print("  -", p)
        if len(problems) > 80:
            print(f"  ... and {len(problems) - 80} more")
        print("\n  If these are legitimate (a content edit moves article_links and the "
              "@type\n  histogram), re-seed with --update and say what moved in the commit "
              "message.")
        sys.exit(1)

    print(f"✓ build fingerprint OK — census equal on {len(CENSUS_KEYS)} counts, "
          f"{len(cur['markers'])} structural markers, "
          f"{len(cur['jsonld_types'])} JSON-LD @types, {len(cur['by_dir'])} top-level dirs, "
          f"and {len(BUNDLES)} bundles byte-for-byte")


# ---------------------------------------------------------------------------
# History. v1.77.0 created this as a byte-identity proof for the fork prune: sha256 of the
# three bundles plus sorted `path:size` for every emitted file, with HTML bodies compared
# only under --strict because CreatedModifiedDate makes page bytes differ per checkout.
# It was never wired into a chain and never had a baseline. The rewrite keeps the bundle
# hashes, moves the per-file byte question to scripts/emit_diff.py (which can answer it
# per FIELD instead of per file, and so is usable during an emitter swap), and puts the
# non-triviality counts here where they can be committed and run cheaply on every build.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
