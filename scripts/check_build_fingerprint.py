#!/usr/bin/env python3
"""check_build_fingerprint.py — prove a refactor changed NO emitted bytes.

Why this exists (v1.77.0): the Quartz fork prune deletes plugins, locales and docs that
should be unreachable. "Should be" is the whole risk. Quartz's ComponentResources emitter
collects CSS/JS only from layout-registered components, so a CORRECT prune contributes
exactly zero bytes to the bundles — which makes byte-identity the ideal proof. If the
bundles move, something deleted was live, and that is far cheaper to learn here than from
a blank page in production.

Fingerprint =
  * sha256 of index.css / prescript.js / postscript.js (content-derived, stable)
  * sorted `path:size` of every file under source/public (catches an emitter that stops
    emitting, or starts)

HTML bodies are captured but only compared under --strict: CreatedModifiedDate derives
dates from git/filesystem mtime, so page bytes legitimately differ between checkouts.
Content drift is the SEO ratchet's job (scripts/check_seo_parity.py), not this gate's.

Usage:
  python3 scripts/check_build_fingerprint.py --update   # capture (run BEFORE the refactor)
  python3 scripts/check_build_fingerprint.py            # compare (run AFTER the rebuild)
  python3 scripts/check_build_fingerprint.py --strict    # also require HTML byte-identity
Stdlib only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source" / "public"
FINGERPRINT = ROOT / "tests" / "artifacts" / "build_fingerprint.json"

# The bundles a prune must not touch. Content-hashed by us, not by filename.
BUNDLES = ("index.css", "prescript.js", "postscript.js")
FORMAT = 1


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def capture() -> dict:
    if not PUBLIC.exists():
        print(f"ERROR: {PUBLIC} not found — run `npm run build` first", file=sys.stderr)
        sys.exit(1)

    bundles = {}
    for name in BUNDLES:
        f = PUBLIC / name
        bundles[name] = {"sha256": sha256(f), "bytes": f.stat().st_size} if f.exists() else None

    manifest: dict[str, int] = {}
    html: dict[str, str] = {}
    for f in sorted(PUBLIC.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(PUBLIC).as_posix()
        manifest[rel] = f.stat().st_size
        if f.suffix == ".html":
            html[rel] = sha256(f)

    return {
        "_meta": {"format": FORMAT, "files": len(manifest), "html": len(html)},
        "bundles": bundles,
        "manifest": manifest,
        "html": html,
    }


def compare(base: dict, cur: dict, strict: bool) -> list[str]:
    problems: list[str] = []

    for name in BUNDLES:
        b, c = base["bundles"].get(name), cur["bundles"].get(name)
        if b == c:
            continue
        if b and not c:
            problems.append(f"{name}: NO LONGER EMITTED (was {b['bytes']:,} B)")
        elif c and not b:
            problems.append(f"{name}: newly emitted ({c['bytes']:,} B)")
        else:
            delta = c["bytes"] - b["bytes"]
            problems.append(
                f"{name}: bundle CHANGED — {b['bytes']:,} -> {c['bytes']:,} B ({delta:+,}). "
                f"Something deleted was reachable from the layout."
            )

    bm, cm = base["manifest"], cur["manifest"]
    gone = sorted(set(bm) - set(cm))
    added = sorted(set(cm) - set(bm))
    if gone:
        problems.append(f"{len(gone)} file(s) no longer emitted, e.g. {gone[:5]}")
    if added:
        problems.append(f"{len(added)} new file(s) emitted, e.g. {added[:5]}")

    resized = [
        f"{p} ({bm[p]:,} -> {cm[p]:,})"
        for p in sorted(set(bm) & set(cm))
        if bm[p] != cm[p] and not (p.endswith(".html") and not strict)
    ]
    if resized:
        problems.append(f"{len(resized)} file(s) changed size, e.g. {resized[:5]}")

    if strict:
        changed = sorted(
            p for p in set(base["html"]) & set(cur["html"]) if base["html"][p] != cur["html"][p]
        )
        if changed:
            problems.append(f"--strict: {len(changed)} HTML file(s) changed bytes, e.g. {changed[:3]}")

    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--update", action="store_true", help="capture the fingerprint")
    ap.add_argument("--strict", action="store_true", help="also require HTML byte-identity")
    args = ap.parse_args()

    cur = capture()

    if args.update:
        FINGERPRINT.parent.mkdir(parents=True, exist_ok=True)
        FINGERPRINT.write_text(json.dumps(cur, indent=1, sort_keys=True))
        b = cur["bundles"]
        print(
            f"fingerprint captured: {cur['_meta']['files']:,} files, "
            f"{cur['_meta']['html']:,} HTML -> {FINGERPRINT}"
        )
        for name in BUNDLES:
            if b[name]:
                print(f"  {name}: {b[name]['bytes']:,} B  {b[name]['sha256'][:12]}")
        return

    if not FINGERPRINT.exists():
        print(f"ERROR: no fingerprint at {FINGERPRINT}; run --update first", file=sys.stderr)
        sys.exit(1)
    base = json.loads(FINGERPRINT.read_text())
    if base.get("_meta", {}).get("format") != FORMAT:
        print("ERROR: fingerprint format mismatch; re-run --update", file=sys.stderr)
        sys.exit(1)

    problems = compare(base, cur, args.strict)
    if problems:
        print("✗ BUILD FINGERPRINT CHANGED:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print(
        f"✓ build fingerprint identical — {cur['_meta']['files']:,} files, bundles byte-for-byte "
        f"unchanged" + ("" if args.strict else " (HTML bodies not compared; use --strict)")
    )


if __name__ == "__main__":
    main()
