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
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / "content"
PUBLIC_DIR = PROJECT_ROOT / "source" / "public"
OUTPUT = PUBLIC_DIR / "_redirects"
# Hand-authored rules. Quartz's Static emitter copies this to public/static/_redirects,
# which Cloudflare NEVER reads (it only reads the deploy root) — so this script must
# fold it into OUTPUT or the rules ship dead. See collect_authored_rules().
AUTHORED_REDIRECTS = PROJECT_ROOT / "source" / "quartz" / "static" / "_redirects"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _slug import slugify  # shared single-source slugify (alias 301 source paths)

CATEGORIES = ("Positions", "Transitions", "Submissions")
ROLE_PAGES = {"Top", "Bottom", "Attacker", "Defender"}
CLOUDFLARE_STATIC_RULE_LIMIT = 2000


def canonical_url_for(json_file: Path) -> str:
    """Canonical site URL for a content JSON file (case-preserved, spaces→hyphens)."""
    rel = json_file.relative_to(CONTENT_DIR).with_suffix("")
    return "/" + "/".join(p.replace(" ", "-") for p in str(rel).split("/"))


def collect_alias_rules(seen: set[str]) -> list[str]:
    """Emit one lowercase `/<canonical-parent>/<alias-slug> /<Canonical> 301` per alias.

    Reads `aliases[]` from every content JSON. The alias source is derived from
    the canonical URL's PARENT path (H4): for a hub like
    content/Submissions/Rear Naked Choke.json the source is
    /submissions/<alias> ; for a nested variant under
    content/Submissions/Inside Heel Hook/ the source keeps the subdir
    (/submissions/inside-heel-hook/<alias>) instead of collapsing to the
    category root where it could 301-hijack an unrelated top-level slug.

    One LOWERCASE source per alias (H5) — Cloudflare path matching plus the
    existing lowercase case-correction rules cover the cased form, so the
    cased+lowercase doubling was wasteful. True HTTP 301s are the strongest
    dedup signal per Google's canonical guidance, and `_redirects` is the single
    owner of alias redirects (frontmatter `aliases:` emission was dropped).

    NOTE: no-op until aliases[] arrays are populated (epic phase 12).
    """
    rules: list[str] = []
    for cat in CATEGORIES:
        cat_dir = CONTENT_DIR / cat
        if not cat_dir.exists():
            continue
        for json_file in cat_dir.rglob("*.json"):
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

            canonical = canonical_url_for(json_file)           # case-preserved TO
            parent = canonical.rsplit("/", 1)[0]               # keep subdir (H4)
            for alias in aliases:
                if not isinstance(alias, str) or not alias.strip():
                    continue
                alias_slug = slugify(alias)
                if not alias_slug:
                    continue
                src = f"{parent}/{alias_slug}".lower()          # single lowercase source (H5)
                if src == canonical.lower() or src in seen:
                    continue
                seen.add(src)
                rules.append(f"{src} {canonical} 301")
    return rules


def collect_authored_rules(seen: set[str]) -> list[str]:
    """Carry over the hand-authored rules from source/quartz/static/_redirects.

    These were being SILENTLY DISCARDED (v1.77.0 fix): this script does a full
    `write_text` of the rules it generates, and Quartz's Static emitter only copies
    the authored file to `public/static/_redirects`, which Cloudflare never reads —
    it reads the deploy root. Net effect since v1.20.0: `/Training/*` and the
    Crackhead-Control moves 404'd instead of redirecting, on exactly the old inbound
    links and bookmarks they exist to rescue (a plausible slice of the ~11k origin
    4xx/day in Observatory). Authored rules go FIRST so they win over any generated
    rule with the same source path.
    """
    if not AUTHORED_REDIRECTS.exists():
        return []
    rules: list[str] = []
    for raw in AUTHORED_REDIRECTS.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        src = line.split()[0]
        if src in seen:
            continue
        seen.add(src)
        rules.append(line)
    return rules


def main() -> None:
    seen: set[str] = set()

    # Hand-authored rules FIRST — they are the ones a human decided mattered, and
    # first-match wins in Cloudflare's static rule evaluation.
    authored_rules = collect_authored_rules(seen)
    if authored_rules:
        print(f"[regenerate_redirects] {len(authored_rules)} authored rule(s) carried over")

    # Alias 301s next (H5): if the file is ever truncated at Cloudflare's 2000-rule
    # limit, the high-value synonym redirects survive; only low-value case-correction
    # rules at the tail would be dropped. `seen` is shared so the classes never collide.
    alias_rules = collect_alias_rules(seen)
    if alias_rules:
        print(f"[regenerate_redirects] {len(alias_rules)} alias 301 rule(s)")

    case_rules: list[str] = []
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
            case_rules.append(f"{lower} {canonical} 301")

    rules = authored_rules + alias_rules + case_rules

    if len(rules) > CLOUDFLARE_STATIC_RULE_LIMIT:
        # Hard failure (H5): a silently-truncated _redirects must not ship.
        print(
            f"[regenerate_redirects] ERROR: {len(rules)} rules exceeds Cloudflare's "
            f"{CLOUDFLARE_STATIC_RULE_LIMIT}-static-rule limit — Cloudflare would silently "
            f"ignore the overflow. Reduce rules (e.g. fold case-correction into a Cloudflare "
            f"redirect rule) before shipping.",
            file=sys.stderr,
        )
        sys.exit(1)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(rules) + "\n")
    print(f"[regenerate_redirects] Wrote {len(rules)} 301 rules to {OUTPUT}")


if __name__ == "__main__":
    main()
