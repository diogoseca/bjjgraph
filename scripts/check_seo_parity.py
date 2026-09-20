#!/usr/bin/env python3
"""SEO-parity gate for the Neural Graph variant work.

The Neural variant must NEVER regress the crawlable/indexable surface: the static HTML a
crawler (or a no-JS visitor) receives has to stay as rich as the pre-Neural baseline. The
variant switch + app mount happen entirely client-side, so the emitted `<head>` + JSON-LD
+ crawlable body content must be unchanged for BOTH variants (they ship the same HTML).

This script extracts the SEO surface from a representative sample of built pages under
source/public/ and compares it to a committed baseline (tests/artifacts/seo_baseline.json):
  - <title>, meta description, canonical, all og:* / twitter:* tags
  - every <script type="application/ld+json"> block (normalized)
  - a hash of the main crawlable article text + internal-link targets

Usage:
  python3 scripts/check_seo_parity.py --update   # (re)capture the baseline from a build
  python3 scripts/check_seo_parity.py            # gate: exit 1 on any SEO-surface drift

Run after `npm run build`. Stdlib only.
"""
import argparse
import hashlib
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "source/public"
BASELINE = ROOT / "tests/artifacts/seo_baseline.json"

# representative route sample (one per page archetype); relative to source/public
SAMPLE = [
    "index.html",
    "Positions/Mount.html",
    "Positions/Mount/Top.html",
    "Positions/Mount/Bottom.html",
    "Positions.html",
    "Transitions/Armbar-from-Back-Transition.html",
    "Transitions/Armbar-from-Back-Transition/Attacker.html",
    "Submissions/Rear-Naked-Choke.html",
    "Systems.html",
    # CAVEAT (documented v1.80.2): this is the 380-byte ALIAS stub emitted by
    # plugins/emitters/aliases.ts, NOT the terminal-state page. The real page is
    # `Game-Over.html` (~26KB, from content/Game Over.md) and it is NOT in this sample — which
    # is why nothing here noticed that it emitted a ZERO-character <article> after v1.80.0
    # deleted the VictoryDisplay it existed to host. It is `noindex` now (frontmatter). Adding
    # it to this sample would not help: `content_floor` derives from `content_len`, so a
    # zero-length article ratchets against zero. Do not assume this route covers /Game-Over.
    "game-over.html",
    # ── WIDENED (with the tier-0 floors) ──────────────────────────────────────
    # The sample above is 10 routes covering 4 archetypes. Everything below is an
    # archetype that had NO representative, which is how a defect in one page class
    # stayed invisible: the gate cannot regress on a shape it never looks at. Kept to one
    # route per archetype, because the content bot edits pages daily and a wide sample
    # makes its PRs noisy for no extra coverage (the recon's option (b)).
    "404.html",                              # its own emitter (404.tsx); baseDir differs in Head.tsx
    "Positions/index.html",                  # FolderPage — a whole emitter, previously unsampled
    "tags/beginner.html",                    # TagPage — a whole emitter, previously unsampled
    "Principles.html",                       # Principles hub
    "Principles/Action-and-Reaction.html",   # Principles leaf — a reference page, not a graph node
    "Learning.html",                         # Learning hub
    "Learning/Asymmetric-Warfare.html",      # Learning leaf
    "Submissions/Achilles-Lock.html",        # submission FAMILY hub — the only CollectionPage @type
    # The terminal page. The caveat on `game-over.html` above is explicit that the 380-byte
    # ALIAS stub is what was sampled and that the REAL page was not, which is why nobody
    # noticed it emitting a zero-character <article> after v1.80.0. Adding it does not fix
    # the content_floor problem named there (a zero length still ratchets against zero),
    # but it does pin its <head> and JSON-LD, which were never pinned at all.
    "Game-Over.html",
]

# ── WHOLE-SITE GUARD (added with the tier-0 floors) ───────────────────────────
# This gate's verdict is about SAMPLE (below), and a sample cannot see the size of the
# site it was drawn from. Measured: a build with 624 of 6,149 pages, every sampled route
# still present, printed "✓ SEO parity OK — 10 routes" — while check_payload_budget.py
# printed "✓ payload budget OK ... across 624 files", because every figure there is a MAX.
# Two green gates on a site missing 90% of itself.
#
# So this gate no longer issues a verdict without first establishing that the emit is
# whole. The count is not re-implemented here: it comes from the same walk
# check_payload_budget.py and check_build_fingerprint.py use.
SITE_FLOOR_KEY = "html_file_count"


def _site_is_whole() -> tuple[bool, str]:
    """(ok, message). Reads the committed tier-0 floor rather than carrying its own."""
    try:
        budget = json.loads((ROOT / "tests/artifacts/budget_site.json").read_text())
        floor = int((budget.get("floors") or {})[SITE_FLOOR_KEY])
    except Exception:
        return True, ("  · no tier-0 floor committed in budget_site.json — whole-site "
                      "guard SKIPPED (seed it with "
                      "`check_payload_budget.py --set-floors --reason \"...\"`)")
    count = sum(1 for _ in PUBLIC.rglob("*.html"))
    if count < floor:
        return False, (
            f"WHOLE-SITE SHORTFALL: {count:,} HTML files emitted, tier-0 floor is "
            f"{floor:,}. This gate samples {{n}} routes, so it cannot see this and its "
            f"verdict would be meaningless. Refusing to report SEO parity on a partial "
            f"build.")
    return True, f"  · whole-site guard: {count:,} HTML files (tier-0 floor {floor:,})"


# Scope note, since two findings have now hidden in it: `_extract()` narrows to the <article>
# when there is one, so ANYTHING outside it is invisible to this gate — including
# `#sidebar-overlay` (CategoryNav's six category links) and every other `body >` sibling of
# `#quartz-root`. The homepage's baseline links come from authored prose in content/index.md,
# not from CategoryNav. Layout is likewise out of scope; e2e/journeys/static-article-layout.spec.ts
# measures that.

META_TAGS = ("description",)
PROP_PREFIXES = ("og:", "twitter:", "article:")

# ── VOLATILE FIELDS (v1.77.0) ──────────────────────────────────────────────────
# This gate exited 1 with 28 "regressions" on an untouched tree, which made it
# useless as a guardrail — and it is the ONLY thing protecting 4,618 indexed URLs
# during the legacy excision. All 28 were one root cause with many faces:
# CreatedModifiedDate derives dates from git/filesystem mtime, so they differ per
# checkout, per worktree and per rebuild. They surfaced as `article:*_time` meta AND
# as `ldjson changed`, because Head.tsx's enrichSchema() stamps the same dates into
# datePublished/dateModified inside the JSON-LD.
#
# We still compare PRESENCE (a vanished og:title is a real regression) but replace
# the VALUE with a sentinel so a rebuild is not a failure.
VOLATILE_META = ("article:published_time", "article:modified_time")
VOLATILE_JSONLD_KEYS = ("datePublished", "dateModified", "uploadDate")
VOLATILE = "<volatile>"

# The crawlable body is compared as a RATCHET, not an equality: the content bot edits
# pages daily and legitimately changes the text, so an exact hash was a tripwire rather
# than a guard. What must never happen is the crawlable surface COLLAPSING (which is
# precisely the risk when deleting page components), so we assert the text does not
# shrink below a floor and that no internal link disappears.
CONTENT_FLOOR_RATIO = 0.85
BASELINE_FORMAT = 2


def _attr(tag: str, name: str):
    m = re.search(rf'{name}\s*=\s*"([^"]*)"', tag)
    return html.unescape(m.group(1)) if m else None


def _devolatile(node):
    """Recursively replace build-volatile date values inside a JSON-LD block."""
    if isinstance(node, dict):
        return {
            k: (VOLATILE if k in VOLATILE_JSONLD_KEYS else _devolatile(v))
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [_devolatile(v) for v in node]
    return node


def extract_seo(doc: str) -> dict:
    head = doc.split("</head>", 1)[0]
    out = {"meta": {}, "ldjson": [], "title": None, "canonical": None}

    mt = re.search(r"<title>(.*?)</title>", head, re.S)
    out["title"] = html.unescape(mt.group(1).strip()) if mt else None

    for tag in re.findall(r"<meta\b[^>]*>", head):
        name = _attr(tag, "name")
        prop = _attr(tag, "property")
        content = _attr(tag, "content")
        if name in META_TAGS:
            out["meta"][name] = content
        elif prop and prop.startswith(PROP_PREFIXES):
            # keep the key (presence is compared) but neutralise mtime-derived values
            out["meta"][prop] = VOLATILE if prop in VOLATILE_META else content

    lc = re.search(r'<link\b[^>]*rel="canonical"[^>]*>', head)
    if lc:
        out["canonical"] = _attr(lc.group(0), "href")

    for block in re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', doc, re.S
    ):
        try:
            out["ldjson"].append(_devolatile(json.loads(block.strip())))
        except json.JSONDecodeError:
            out["ldjson"].append({"_unparsed": hashlib.sha256(block.encode()).hexdigest()})
    # order-independent compare of the schema blocks
    out["ldjson"] = sorted(
        (json.dumps(b, sort_keys=True, ensure_ascii=False) for b in out["ldjson"])
    )

    # crawlable content: strip scripts/styles, take the <article> (or body) text + link targets
    body = doc.split("</head>", 1)[-1]
    art = re.search(r"<article\b[^>]*>(.*?)</article>", body, re.S)
    region = art.group(1) if art else body
    links = sorted(set(re.findall(r'<a\b[^>]*href="([^"]+)"', region)))
    text = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", region, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    out["content_hash"] = hashlib.sha256(text.encode()).hexdigest()
    out["content_len"] = len(text)
    out["links"] = links
    return out


def snapshot() -> dict:
    snap = {}
    missing = []
    for route in SAMPLE:
        f = PUBLIC / route
        if not f.exists():
            missing.append(route)
            continue
        snap[route] = extract_seo(f.read_text(encoding="utf-8", errors="replace"))
    if missing:
        print(f"WARNING: {len(missing)} sample route(s) not built: {missing}", file=sys.stderr)
    return snap


def diff(base: dict, cur: dict) -> tuple[list, list]:
    """Return (failures, notes).

    Failures are SEO regressions: a route vanished, a head field changed, the crawlable
    text collapsed, or an internal link disappeared. Notes are legitimate churn worth
    printing but not blocking (content rewrites, added links) — the content bot edits
    pages daily and must not need a baseline refresh to stay green.
    """
    failures: list[str] = []
    notes: list[str] = []
    for route, b in base.items():
        if route.startswith("_"):
            continue
        c = cur.get(route)
        if c is None:
            failures.append(f"{route}: MISSING from current build")
            continue

        for k in ("title", "canonical", "ldjson"):
            if b.get(k) != c.get(k):
                failures.append(f"{route}: {k} changed")

        for mk in set(b["meta"]) | set(c["meta"]):
            if b["meta"].get(mk) != c["meta"].get(mk):
                if mk not in b["meta"]:
                    notes.append(f"{route}: meta[{mk}] added")
                elif mk not in c["meta"]:
                    failures.append(f"{route}: meta[{mk}] REMOVED")
                else:
                    failures.append(f"{route}: meta[{mk}] changed")

        # crawlable text: ratchet on length, not equality
        floor = b.get("content_floor") or int(b.get("content_len", 0) * CONTENT_FLOOR_RATIO)
        cur_len = c.get("content_len", 0)
        if cur_len < floor:
            failures.append(
                f"{route}: crawlable text COLLAPSED — {cur_len} chars is below the "
                f"{floor} floor (baseline {b.get('content_len')})"
            )
        elif b.get("content_hash") != c.get("content_hash"):
            notes.append(
                f"{route}: content edited (len {b.get('content_len')} -> {cur_len}, above floor)"
            )

        # internal links may be added, never lost
        lost = sorted(set(b.get("links", [])) - set(c.get("links", [])))
        if lost:
            failures.append(
                f"{route}: {len(lost)} internal link(s) REMOVED, e.g. {lost[:3]}"
            )
        gained = len(set(c.get("links", [])) - set(b.get("links", [])))
        if gained:
            notes.append(f"{route}: {gained} internal link(s) added")
    return failures, notes


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--update", action="store_true", help="(re)capture the baseline")
    args = ap.parse_args()

    if not PUBLIC.exists():
        print(f"ERROR: {PUBLIC} not found — run `npm run build` first", file=sys.stderr)
        sys.exit(1)

    # Establish the emit is WHOLE before saying anything about its SEO surface. A sample
    # of 10 routes is a statement about 10 routes; without this, it reads as a statement
    # about the site.
    whole, msg = _site_is_whole()
    if not whole:
        print("✗ " + msg.format(n=len(SAMPLE)), file=sys.stderr)
        sys.exit(1)
    print(msg)

    cur = snapshot()
    if args.update:
        for route, snap in cur.items():
            snap["content_floor"] = int(snap["content_len"] * CONTENT_FLOOR_RATIO)
        cur["_meta"] = {
            "format": BASELINE_FORMAT,
            "floor_ratio": CONTENT_FLOOR_RATIO,
            "volatile_meta": list(VOLATILE_META),
            "volatile_jsonld_keys": list(VOLATILE_JSONLD_KEYS),
        }
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        BASELINE.write_text(json.dumps(cur, indent=1, ensure_ascii=False, sort_keys=True))
        print(f"baseline written: {len(cur) - 1} routes -> {BASELINE}")
        print(
            "NOTE: --update re-arms the ratchet. Commit it separately from any deletion, "
            "and say in the commit body WHY the surface legitimately changed."
        )
        return

    if not BASELINE.exists():
        print(f"ERROR: no baseline at {BASELINE}; run with --update first", file=sys.stderr)
        sys.exit(1)
    base = json.loads(BASELINE.read_text())
    if base.get("_meta", {}).get("format") != BASELINE_FORMAT:
        print(
            f"ERROR: baseline is format {base.get('_meta', {}).get('format', 1)}, this gate needs "
            f"{BASELINE_FORMAT} (volatile dates are now neutralised and content is a floor, not a "
            f"hash). Rebuild and re-run with --update.",
            file=sys.stderr,
        )
        sys.exit(1)

    failures, notes = diff(base, cur)
    routes = len([r for r in base if not r.startswith("_")])
    for n in notes:
        print("  ·", n)
    if failures:
        print(f"✗ SEO PARITY FAILED — {len(failures)} regression(s):")
        for p in failures:
            print("  -", p)
        sys.exit(1)
    print(
        f"✓ SEO parity OK — {routes} routes; head + JSON-LD identical, crawlable text above "
        f"floor, zero internal links lost"
        + (f" ({len(notes)} benign change(s) noted)" if notes else "")
    )


if __name__ == "__main__":
    main()
