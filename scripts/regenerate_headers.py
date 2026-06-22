#!/usr/bin/env python3
"""regenerate_headers.py — emit source/public/_headers for Cloudflare Pages.

SECURITY: Cloudflare Pages only serves `_headers` from the DEPLOY ROOT
(public/_headers). Quartz's static emitter copies quartz/static/_headers to
public/static/_headers, which Cloudflare ignores — so without this step NO security
headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy,
HSTS, CSP) are ever delivered. This copies the canonical file to the deploy root,
mirroring regenerate_redirects.py for `_redirects`.

Runs after `npx quartz build` in the build pipeline (the build does not wipe files
written to public/ afterwards, same as _redirects).
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CANONICAL = PROJECT_ROOT / "source" / "quartz" / "static" / "_headers"
PUBLIC_DIR = PROJECT_ROOT / "source" / "public"
OUTPUT = PUBLIC_DIR / "_headers"


def main() -> None:
    if not CANONICAL.exists():
        print(f"[regenerate_headers] ERROR: canonical {CANONICAL} not found", file=sys.stderr)
        sys.exit(1)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CANONICAL, OUTPUT)
    print(f"[regenerate_headers] Wrote security headers to {OUTPUT}")


if __name__ == "__main__":
    main()
