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

import json
import re
import sys
import unicodedata
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / "content"
PUBLIC_DIR = PROJECT_ROOT / "source" / "public"
OUTPUT = PUBLIC_DIR / "_redirects"

CATEGORIES = ("Positions", "Transitions", "Submissions")
ROLE_PAGES = {"Top", "Bottom", "Attacker", "Defender"}
CLOUDFLARE_STATIC_RULE_LIMIT = 2000


def slugify(s: str) -> str:
    """Lowercase kebab slug, byte-identical to regenerate_md_from_json.slugify().

    Transliterates accents to ASCII (Leão → leao) so alias-redirect FROM paths
    line up with the frontmatter `aliases:` slugs, the Quartz alias pages, and
    hand-typed alias URLs.
    """
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = s.replace("'", "").replace("`", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def canonical_url_for(json_file: Path) -> str:
    """Canonical site URL for a content JSON file (case-preserved, spaces→hyphens)."""
    rel = json_file.relative_to(CONTENT_DIR).with_suffix("")
    return "/" + "/".join(p.replace(" ", "-") for p in str(rel).split("/"))


def collect_alias_rules(seen: set[str]) -> list[str]:
    """Emit `/<Category>/<alias-slug> /<Category>/<Canonical> 301` for each alias.

    Reads `aliases[]` from every content JSON. For each alias we emit BOTH the
    category-cased path (matches the Quartz alias page location) and the
    fully-lowercased path (matches hand-typed URLs and the case-correction
    convention used by the canonical lowercase rules). True HTTP 301s are the
    strongest dedup signal per Google's canonical guidance.

    NOTE: until aliases[] arrays are populated (epic phase 12), this is a no-op.
    """
    rules: list[str] = []
    for cat in CATEGORIES:
        cat_dir = CONTENT_DIR / cat
        if not cat_dir.exists():
            continue
        for json_file in cat_dir.rglob("*.json"):
            # Skip schema templates that may have leaked into content (defensive)
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            if not isinstance(data, dict):
                continue
            aliases = data.get("aliases") or []
            if not isinstance(aliases, list) or not aliases:
                continue

            canonical = canonical_url_for(json_file)
            canonical_low = canonical.lower()
            for alias in aliases:
                if not isinstance(alias, str) or not alias.strip():
                    continue
                alias_slug = slugify(alias)
                if not alias_slug:
                    continue
                for src in (f"/{cat}/{alias_slug}", f"/{cat.lower()}/{alias_slug}"):
                    # Never shadow the canonical URL itself, and dedupe.
                    if src == canonical or src == canonical_low or src in seen:
                        continue
                    seen.add(src)
                    rules.append(f"{src} {canonical} 301")
    return rules


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

    # Alias → canonical 301s (synonym redirects). Appended after the lowercase
    # case-correction rules; `seen` is shared so the two classes never collide.
    alias_rules = collect_alias_rules(seen)
    if alias_rules:
        print(f"[regenerate_redirects] Added {len(alias_rules)} alias 301 rule(s)")
    rules.extend(alias_rules)

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
