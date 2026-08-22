#!/usr/bin/env python3
"""apply_affiliate_ref.py — stamp the affiliate tracking ref into BUILT artifacts.

WHY THIS EXISTS: every BJJFanatics product URL in content/Systems/*.json is
authored with the literal placeholder `?ref=REPLACE_ME`. The real tracking id is a
DEPLOYMENT PARAMETER, not content:
  * it belongs to one affiliate account and can be rotated without touching a
    single technique;
  * this repo is PUBLIC, so committing it would publish a revenue identifier into
    every fork and into git history forever, where it cannot be un-published;
  * a fork, a local `npm run build`, and a preview deploy must all work with no
    secret at all.
So it lives in exactly one place — the AFFILIATE_REF GitHub secret — and is
substituted into the build output on its way to Cloudflare Pages.

Rewrites ONLY emitted, gitignored artifacts:
  source/quartz/static/neural/systems.json   (Neural payload, `npm run regenerate:neural`)
  source/public/**                           (built site, `npx quartz build` + `build:forward`)

It NEVER rewrites content/Systems/*.json. The placeholder in authored content is
load-bearing: it keeps the ref out of git, and it is what scripts/validate_json.py
reports as "placeholder affiliate_url/image not yet replaced".

A missing ref costs attribution on one deploy; a failed build costs the deploy —
so no AFFILIATE_REF means WARNING and exit 0. A malformed ref exits 1, because it
would ship a broken href into every product card.

Commercial terms and the ref itself are intentionally NOT documented in this public repo.

Usage:  AFFILIATE_REF=<ref> python3 scripts/apply_affiliate_ref.py [--dry-run]
Exit:   0 = stamped, or nothing to do, or no ref; 1 = AFFILIATE_REF is unusable.
"""

from __future__ import annotations

import argparse
import gzip
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_text  # crash-safe writes  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEURAL_SYSTEMS = PROJECT_ROOT / "source" / "quartz" / "static" / "neural" / "systems.json"
PUBLIC_DIR = PROJECT_ROOT / "source" / "public"
CONTENT_DIR = PROJECT_ROOT / "content"

PLACEHOLDER = "REPLACE_ME"
PLACEHOLDER_B = PLACEHOLDER.encode()

# Text artifacts a product URL can reach: page HTML, Neural JSON payloads, the
# search index, feeds, llms.txt, inlined bundles. Everything else under public/ is
# binary (images, fonts) and is never read.
TEXT_SUFFIXES = {".html", ".json", ".js", ".css", ".xml", ".txt"}

# The ref is interpolated into href="" inside generated HTML, so an unvalidated
# value is an HTML-injection primitive. Vendor tracking ids are opaque tokens;
# anything outside this charset is a mis-set secret, not a ref.
REF_RE = re.compile(r"\A[A-Za-z0-9._~%-]{1,64}\Z")


def targets() -> list[Path]:
    """Emitted files that may carry the placeholder, in deterministic order."""
    found: list[Path] = []
    if NEURAL_SYSTEMS.is_file():
        found.append(NEURAL_SYSTEMS)
    if PUBLIC_DIR.is_dir():
        found.extend(
            p
            for p in sorted(PUBLIC_DIR.rglob("*"))
            # Symlinks are skipped: following one would write outside the deploy root.
            if p.is_file() and not p.is_symlink() and p.suffix in TEXT_SUFFIXES
        )
    return found


def stamp(path: Path, ref: str, dry_run: bool) -> int:
    """Replace every placeholder in `path`; return the number of occurrences."""
    # Belt and braces: the roots above are emitted-only. This makes a future
    # refactor that widens them fail loudly instead of silently committing the ref
    # into authored content.
    if CONTENT_DIR in path.parents:
        print(
            f"[apply_affiliate_ref] ERROR: refusing to rewrite authored content {path}",
            file=sys.stderr,
        )
        sys.exit(1)

    data = path.read_bytes()
    if PLACEHOLDER_B not in data:
        return 0
    hits = data.count(PLACEHOLDER_B)
    if dry_run:
        return hits

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        print(f"[apply_affiliate_ref] WARNING: {path} is not UTF-8 text, skipped")
        return 0
    stamped = text.replace(PLACEHOLDER, ref)
    atomic_write_text(path, stamped)

    # A pre-compressed sibling (contentIndex.json.gz, questionBank.json.gz) is what
    # Cloudflare serves to gzip-capable clients, so leaving it stale would serve the
    # placeholder to almost every visitor.
    sibling = path.with_suffix(path.suffix + ".gz")
    if sibling.is_file():
        sibling.write_bytes(gzip.compress(stamped.encode("utf-8"), mtime=0))
        print(f"[apply_affiliate_ref] recompressed {sibling.relative_to(PROJECT_ROOT)}")
    return hits


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--dry-run", action="store_true", help="report what would be stamped, write nothing"
    )
    args = parser.parse_args()

    ref = os.environ.get("AFFILIATE_REF", "").strip()
    if not ref:
        print(
            f"[apply_affiliate_ref] WARNING: AFFILIATE_REF is not set — leaving the "
            f"{PLACEHOLDER} placeholder in place. Affiliate clicks from this build earn "
            f"NOTHING. Set the AFFILIATE_REF secret ; a local or "
            f"fork build needs no ref."
        )
        sys.exit(0)
    if not REF_RE.match(ref):
        print(
            "[apply_affiliate_ref] ERROR: AFFILIATE_REF is not a plausible tracking id "
            f"(expected 1-64 chars of A-Z a-z 0-9 . _ ~ % -, got {len(ref)} chars). "
            "It would land inside an href in every product card.",
            file=sys.stderr,
        )
        sys.exit(1)

    # The ref value itself is never printed: it is a revenue identifier, and CI logs
    # are the one place it could leak from a secret store into plain text.
    print(f"[apply_affiliate_ref] AFFILIATE_REF present ({len(ref)} chars)")

    files = targets()
    if not files:
        print(
            f"[apply_affiliate_ref] WARNING: nothing built yet — no {PUBLIC_DIR.name}/ and no "
            f"{NEURAL_SYSTEMS.name}. Run the build first; nothing to stamp."
        )
        sys.exit(0)

    changed: list[tuple[Path, int]] = []
    for path in files:
        hits = stamp(path, ref, args.dry_run)
        if hits:
            changed.append((path, hits))

    verb = "would stamp" if args.dry_run else "stamped"
    total = sum(h for _, h in changed)
    for path, hits in changed:
        print(f"  · {path.relative_to(PROJECT_ROOT)} ({hits})")
    if not changed:
        print(
            f"[apply_affiliate_ref] WARNING: scanned {len(files)} emitted file(s) and found no "
            f"{PLACEHOLDER} — already stamped, or no system carries a product URL. Nothing done."
        )
        sys.exit(0)
    print(
        f"[apply_affiliate_ref] OK — {verb} {total} placeholder(s) in {len(changed)} of "
        f"{len(files)} emitted file(s)."
    )


if __name__ == "__main__":
    main()
