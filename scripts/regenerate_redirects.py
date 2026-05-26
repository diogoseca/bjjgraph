#!/usr/bin/env python3
"""regenerate_redirects.py — emit source/public/_redirects for Cloudflare Pages.

Static site has no router and Linux is case-sensitive, so lowercase variants
of canonical mixed-case URLs (e.g. /transitions/foo) 404 hard. This script
walks the canonical content tree and writes a Cloudflare _redirects file
that 301s lowercase paths to their canonical mixed-case form.

Hub pages only — role pages (Top/Bottom/Attacker/Defender) were never produced
as lowercase URLs, so skipping them keeps us well under Cloudflare's 2,000
static-rule limit.

Runs automatically after `npm run build` via the `postbuild` hook.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / "content"
PUBLIC_DIR = PROJECT_ROOT / "source" / "public"
OUTPUT = PUBLIC_DIR / "_redirects"

CATEGORIES = ("Positions", "Transitions", "Submissions")
ROLE_PAGES = {"Top", "Bottom", "Attacker", "Defender"}
CLOUDFLARE_STATIC_RULE_LIMIT = 2000


def main() -> None:
    rules: list[str] = []
    seen: set[str] = set()

    for cat in CATEGORIES:
        cat_dir = CONTENT_DIR / cat
        if not cat_dir.exists():
            continue
        for md in cat_dir.rglob("*.md"):
            rel = md.relative_to(CONTENT_DIR).with_suffix("")
            if rel.name in ROLE_PAGES:
                continue
            canonical = "/" + "/".join(p.replace(" ", "-") for p in str(rel).split("/"))
            lower = canonical.lower()
            if lower == canonical or lower in seen:
                continue
            seen.add(lower)
            rules.append(f"{lower} {canonical} 301")

    if len(rules) > CLOUDFLARE_STATIC_RULE_LIMIT:
        print(
            f"[regenerate_redirects] WARNING: {len(rules)} rules exceeds Cloudflare's "
            f"{CLOUDFLARE_STATIC_RULE_LIMIT}-static-rule limit. Excess will be ignored.",
            file=sys.stderr,
        )

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(rules) + "\n")
    print(f"[regenerate_redirects] Wrote {len(rules)} 301 rules to {OUTPUT}")


if __name__ == "__main__":
    main()
