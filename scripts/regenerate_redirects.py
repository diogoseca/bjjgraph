#!/usr/bin/env python3
"""regenerate_redirects.py — emit source/public/_redirects for Cloudflare Pages.

Static site has no router and Linux is case-sensitive, so lowercase variants
of canonical mixed-case URLs (e.g. /transitions/foo) 404 hard. This script
walks the canonical content tree and writes a Cloudflare _redirects file
that 301s lowercase paths to their canonical mixed-case form.

Hub pages only — role pages (Top/Bottom/Attacker/Defender) were never produced
as lowercase URLs, so skipping them keeps us under Cloudflare's 2,000
static-rule limit.

TWO OUTPUTS (v1.236.1, RDR546). Cloudflare loaded only the first 100 of 1,954 rules
for months: see split_rules() and scripts/check_redirect_limits.py. `_redirects` now
lists every static rule first, and the category wildcards go to
static/redirect-fallback.json, which the Pages middleware consults after a 404.

Runs automatically after `npm run build` via the `postbuild` hook.

TARGETS ARE QUARTZ'S PAGE PATHS (v1.212.7, OCREDIR1). Both the canonical target and its lowercase
source come from `_slug.quartz_page_path`, the same rule Quartz builds pages with. Before, only
spaces became hyphens, so 100% Sweep's rule pointed at /Transitions/100%-Sweep, which is not
built, and the real page's lowercase variant /transitions/100-percent-sweep 404'd.
scripts/check_redirect_targets.py verifies, after the build, that every emitted target resolves.
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
from _slug import quartz_page_path, slugify  # page paths (targets) · alias 301 source slugs
import check_redirect_limits  # the exact port of Cloudflare's _redirects parser

CATEGORIES = ("Positions", "Transitions", "Submissions")
ROLE_PAGES = {"Top", "Bottom", "Attacker", "Defender"}
# The wildcard table the Pages middleware reads after a 404 (see split_rules). Its prefixes are
# a subset of regenerate_agent_discovery.py's routed CATEGORIES; check_redirect_limits.py fails
# if a fallback rule ever falls outside the built _routes.json.
FALLBACK_REL = Path("static") / "redirect-fallback.json"
FALLBACK_PREFIXES = tuple(f"/{category}/" for category in CATEGORIES)
FALLBACK_STATUSES = {301, 302, 303, 307, 308}


def canonical_url_for(json_file: Path) -> str:
    """Canonical site URL for a content JSON file: the path Quartz builds its page at (case kept)."""
    rel = json_file.relative_to(CONTENT_DIR).with_suffix("")
    return "/" + quartz_page_path(rel.as_posix())


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


def collect_rules() -> tuple[list[str], list[str], list[str]]:
    """(authored, alias, case) rules in first-match order: the file as one unlimited list."""
    seen: set[str] = set()

    # Hand-authored rules FIRST — they are the ones a human decided mattered, and
    # first-match wins in Cloudflare's static rule evaluation.
    authored_rules = collect_authored_rules(seen)

    # Alias 301s next (H5). `seen` is shared so the classes never collide.
    alias_rules = collect_alias_rules(seen)

    case_rules: list[str] = []
    for cat in CATEGORIES:
        cat_dir = CONTENT_DIR / cat
        if not cat_dir.exists():
            continue
        for md in cat_dir.rglob("*.md"):
            rel = md.relative_to(CONTENT_DIR).with_suffix("")
            if rel.name in ROLE_PAGES:
                continue
            canonical = "/" + quartz_page_path(rel.as_posix())
            lower = canonical.lower()
            if lower == canonical or lower in seen:
                continue
            seen.add(lower)
            case_rules.append(f"{lower} {canonical} 301")
    return authored_rules, alias_rules, case_rules


def split_rules(rules: list[str]) -> tuple[list[str], list[list]]:
    """(_redirects lines, fallback rules) for one first-match-ordered list (v1.236.1, RDR546).

    Cloudflare files a rule as STATIC only while no dynamic rule (a `*` or a `:placeholder`
    in the source) has been seen, and stops reading at the 101st dynamic one. Rule #1 used to
    be `/Training/*`, so only the first 100 of 1,954 rules ever worked. So:
      - every static rule goes first, in its original order: the exact map is consulted before
        any wildcard, so this keeps first-match only while no wildcard shadows an exact rule
        that follows it; check_redirect_limits.py diffs every source's destination to prove it;
      - a wildcard under a category the Pages middleware serves (`_routes.json` includes
        /Positions/* etc.) and that redirects (not a 200 rewrite) moves to the fallback table,
        which site/redirect-fallback.mjs consults only when the asset server answered 404 —
        no new Function invocations, and no ceiling;
      - every other wildcard (`/l/*`, the 200 rewrite the share links need with NO Function
        deployed; `/Training/*`, `/Tree/*`, outside the Function's routes) stays in `_redirects`,
        after the statics.
    A fallback wildcard therefore yields to a built asset where the old rule would have won;
    the gate fails if any built page sits under one.
    """
    static, edge_dynamic, fallback = [], [], []
    for rule in rules:
        source, to, *rest = rule.split()
        status = int(rest[0]) if rest else 302
        if not (check_redirect_limits.SPLAT_REGEX.search(source)
                or check_redirect_limits.PLACEHOLDER_REGEX.search(source)):
            static.append(rule)
        elif source.startswith(FALLBACK_PREFIXES) and status in FALLBACK_STATUSES:
            fallback.append([source, to, status])
        else:
            edge_dynamic.append(rule)
    return static + edge_dynamic, fallback


def fallback_json(fallback: list[list]) -> str:
    rows = ",\n".join(json.dumps(row, ensure_ascii=False) for row in fallback)
    return ('{"version": 1, "note": "Generated by scripts/regenerate_redirects.py; consulted by '
            'site/redirect-fallback.mjs after a 404, in this order, with Cloudflare\'s own wildcard '
            'semantics. Never edit.",\n"rules": [\n' + rows + "\n]}\n")


def main() -> None:
    authored_rules, alias_rules, case_rules = collect_rules()
    if authored_rules:
        print(f"[regenerate_redirects] {len(authored_rules)} authored rule(s) carried over")
    if alias_rules:
        print(f"[regenerate_redirects] {len(alias_rules)} alias 301 rule(s)")
    rules = authored_rules + alias_rules + case_rules
    edge, fallback = split_rules(rules)
    text = "\n".join(edge) + "\n"

    # Hard failure (H5): a silently-truncated _redirects must not ship. The check is the exact
    # port of Cloudflare's parser, so it also refuses a static rule demoted behind a wildcard.
    failures, parsed, redirects = check_redirect_limits.audit(text, str(OUTPUT))
    if failures:
        for failure in failures:
            print(f"[regenerate_redirects] ERROR: {failure}", file=sys.stderr)
        print(f"[regenerate_redirects] ERROR: Cloudflare would not load this _redirects as written "
              f"({check_redirect_limits.summary(parsed, redirects)}); nothing was written.", file=sys.stderr)
        sys.exit(1)

    fallback_output = PUBLIC_DIR / FALLBACK_REL
    fallback_output.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(text)
    fallback_output.write_text(fallback_json(fallback))
    print(f"[regenerate_redirects] Wrote {len(edge)} rules to {OUTPUT} "
          f"({check_redirect_limits.summary(parsed, redirects)}) and {len(fallback)} wildcard "
          f"rule(s) to {fallback_output}")


if __name__ == "__main__":
    main()
