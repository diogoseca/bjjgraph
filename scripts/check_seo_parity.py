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
    "Transitions/Armbar-from-Mount.html",
    "Transitions/Armbar-from-Mount/Attacker.html",
    "Submissions/Rear-Naked-Choke.html",
    "Systems.html",
    "game-over.html",
]

META_TAGS = ("description",)
PROP_PREFIXES = ("og:", "twitter:", "article:")


def _attr(tag: str, name: str):
    m = re.search(rf'{name}\s*=\s*"([^"]*)"', tag)
    return html.unescape(m.group(1)) if m else None


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
            out["meta"][prop] = content

    lc = re.search(r'<link\b[^>]*rel="canonical"[^>]*>', head)
    if lc:
        out["canonical"] = _attr(lc.group(0), "href")

    for block in re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', doc, re.S
    ):
        try:
            out["ldjson"].append(json.loads(block.strip()))
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


def diff(base: dict, cur: dict) -> list:
    problems = []
    for route, b in base.items():
        c = cur.get(route)
        if c is None:
            problems.append(f"{route}: MISSING from current build")
            continue
        for k in ("title", "canonical", "meta", "ldjson", "content_hash", "links"):
            if b.get(k) != c.get(k):
                if k == "content_hash":
                    problems.append(
                        f"{route}: crawlable content changed "
                        f"(len {b.get('content_len')} -> {c.get('content_len')})"
                    )
                elif k == "meta":
                    for mk in set(b["meta"]) | set(c["meta"]):
                        if b["meta"].get(mk) != c["meta"].get(mk):
                            problems.append(f"{route}: meta[{mk}] changed")
                else:
                    problems.append(f"{route}: {k} changed")
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--update", action="store_true", help="(re)capture the baseline")
    args = ap.parse_args()

    if not PUBLIC.exists():
        print(f"ERROR: {PUBLIC} not found — run `npm run build` first", file=sys.stderr)
        sys.exit(1)

    cur = snapshot()
    if args.update:
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        BASELINE.write_text(json.dumps(cur, indent=1, ensure_ascii=False, sort_keys=True))
        print(f"baseline written: {len(cur)} routes -> {BASELINE}")
        return

    if not BASELINE.exists():
        print(f"ERROR: no baseline at {BASELINE}; run with --update first", file=sys.stderr)
        sys.exit(1)
    base = json.loads(BASELINE.read_text())
    problems = diff(base, cur)
    if problems:
        print(f"✗ SEO PARITY FAILED — {len(problems)} regression(s):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print(f"✓ SEO parity OK — {len(base)} routes, head/JSON-LD/crawlable content unchanged")


if __name__ == "__main__":
    main()
