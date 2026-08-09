#!/usr/bin/env python3
"""check_affiliate_surface.py — the affiliate surface is a COMPLIANCE surface, so it gets a gate
instead of good intentions.

Four claims BJJGraph makes about every monetised link. Each one was true when written and each
one is one careless edit away from being false, silently, on the revenue path:

  1. DISCLOSURE WORDING DOES NOT DRIFT. FTC 16 CFR Part 255 and the UK ASA/CAP code require a
     clear, conspicuous disclosure. It is authored ONCE in docs/Affiliate.md and rendered from TWO
     places (templates/Systems.md.jinja2 for the generated page, neural/src/app.src.jsx for the
     app, which is the DEFAULT variant). Two hand-maintained copies of a legal sentence is exactly
     the shape that drifts, and nothing in a build would have noticed.

  2. DISCLOSURE RENDERS ADJACENT TO ITS LINK. "Close to the link" is the actual legal requirement,
     so proximity is asserted structurally: in the template source, in the app source (the
     disclosure node is appended to the shelf BEFORE any anchor), and in every GENERATED
     content/Systems/*.md — same <section>, before the first sponsored href, never wrapped in a
     <details> (a collapsed disclosure is not a disclosure).

  3. NO UNVERIFIED URL CAN RENDER. Every product in content/Systems/*.json carries link_status +
     link_checked (required by templates/Systems.json). Only "live" renders. This gate re-asserts
     the invariant on the DATA so a future edit cannot ship a CTA on nobody's verification, and
     warns when a "live" check has gone stale.

  4. graph.json CARRIES NO AFFILIATE URL. It is the one COMMITTED, public-repo artifact in the
     pipeline; apply_affiliate_ref.py deliberately does not target it, so a URL here can only ever
     be a placeholder — dead weight that would publish the revenue id into git history forever if
     someone "fixed" it by stamping. See docs/Affiliate.md §3.

Runs offline (no network, no build) so it can gate every deploy. It does NOT check that a URL
resolves — that needs a human opening it; link_status is where that human records the answer.

Usage:  python3 scripts/check_affiliate_surface.py [--strict-stale]
Exit:   0 = the affiliate surface is compliant, 1 = it is not.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOC = PROJECT_ROOT / "docs" / "Affiliate.md"
TEMPLATE = PROJECT_ROOT / "templates" / "Systems.md.jinja2"
APP = PROJECT_ROOT / "neural" / "src" / "app.src.jsx"
SCHEMA = PROJECT_ROOT / "templates" / "Systems.json"
SYSTEMS_DIR = PROJECT_ROOT / "content" / "Systems"
GRAPH = PROJECT_ROOT / "graph.json"

DOC_START = "<!-- CANONICAL-DISCLOSURE:START -->"
DOC_END = "<!-- CANONICAL-DISCLOSURE:END -->"

# How old a "live" verification may get before it is worth re-opening the URL. Vendor handles get
# renamed; two of three authored links were already 404 the first time anyone checked.
STALE_DAYS = 180

VALID_STATUS = {"live", "dead", "unverified"}


def canonical_disclosure() -> str:
    """The single authored copy of the sentence."""
    text = DOC.read_text(encoding="utf-8")
    i, j = text.find(DOC_START), text.find(DOC_END)
    if i < 0 or j < 0:
        raise ValueError(
            f"docs/Affiliate.md has no {DOC_START} … {DOC_END} block — that block IS the canonical "
            f"wording; without it the two rendered copies have no source of truth")
    return text[i + len(DOC_START):j].strip()


def template_disclosure(src: str) -> str | None:
    m = re.search(r'<p class="affiliate-disclosure">(.*?)</p>', src, re.S)
    return m.group(1) if m else None


def app_disclosure(src: str) -> str | None:
    """The app builds it from adjacent string literals; join them the way the JS engine does."""
    m = re.search(r'disc\.textContent\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+);', src)
    if not m:
        return None
    return "".join(re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1)))


def check_wording(errors: list[str]) -> str:
    canon = canonical_disclosure()
    for label, path, extract in (
        ("templates/Systems.md.jinja2", TEMPLATE, template_disclosure),
        ("neural/src/app.src.jsx", APP, app_disclosure),
    ):
        got = extract(path.read_text(encoding="utf-8"))
        if got is None:
            errors.append(f"{label}: no affiliate disclosure found at all — a monetised surface "
                          f"must render one (docs/Affiliate.md §1)")
        elif got != canon:
            errors.append(
                f"{label}: disclosure text has DRIFTED from docs/Affiliate.md.\n"
                f"      canonical: {canon!r}\n"
                f"      {label}: {got!r}\n"
                f"      Fix all three in one commit — the wording is a legal claim, not copy.")
    return canon


def _no_details_between(src: str, lo: int, hi: int) -> bool:
    """A disclosure the reader has to expand is not conspicuous."""
    return "<details" not in src[lo:hi].lower()


def check_template_adjacency(errors: list[str]) -> None:
    src = TEMPLATE.read_text(encoding="utf-8")
    d = src.find('class="affiliate-disclosure"')
    link = src.find('data-affiliate="true"')
    if link < 0:
        return  # no monetised anchor in the template at all — nothing to disclose
    if d < 0 or d > link:
        errors.append("templates/Systems.md.jinja2: the sponsored product CTA is not preceded by "
                      "the affiliate-disclosure paragraph (docs/Affiliate.md §1)")
        return
    sec_open = src.rfind("<section", 0, d)
    sec_close = src.find("</section>", d)
    if not (sec_open < d < link < sec_close):
        errors.append("templates/Systems.md.jinja2: disclosure and CTA are not inside the same "
                      "<section> — 'close to the link' means the same block")
    if not _no_details_between(src, d, link):
        errors.append("templates/Systems.md.jinja2: a <details> sits between the disclosure and "
                      "the CTA — a collapsed disclosure is not a disclosure")


def check_app_adjacency(errors: list[str]) -> None:
    src = APP.read_text(encoding="utf-8")
    disc_append = src.find("shelf.appendChild(disc)")
    cta_appends = [m.start() for m in re.finditer(r"shelf\.appendChild\(a\)", src)]
    if not cta_appends:
        errors.append("neural/src/app.src.jsx: no CTA anchor is appended to the course shelf — "
                      "this gate is asserting the wrong seam, or the shelf was renamed")
        return
    if disc_append < 0 or disc_append > min(cta_appends):
        errors.append(
            "neural/src/app.src.jsx: the disclosure is no longer appended to the course shelf "
            "BEFORE the CTA anchors. That ordering is what makes it structurally impossible for a "
            "monetised link to render without its disclosure above it (docs/Affiliate.md §1)")
    # the shelf itself must not be collapsible
    shelf = re.search(r'shelf\s*=\s*document\.createElement\("(\w+)"\)', src)
    if shelf and shelf.group(1).lower() == "details":
        errors.append("neural/src/app.src.jsx: the course shelf is a <details> — the disclosure "
                      "inside it would be hidden until the reader expands it")


def check_generated_pages(errors: list[str], canon: str) -> tuple[int, int]:
    """The bytes actually served to crawlers and to the legacy variant."""
    disclosed = monetised = 0
    for md in sorted(SYSTEMS_DIR.glob("*.md")):
        src = md.read_text(encoding="utf-8")
        link = src.find('data-affiliate="true"')
        d = src.find('class="affiliate-disclosure"')
        rel = 'rel="sponsored' in src
        if link < 0 and not rel:
            if d >= 0:
                errors.append(f"content/Systems/{md.name}: renders a disclosure but no affiliate "
                              f"link — dead copy, remove it or restore the link")
            continue
        monetised += 1
        if d < 0:
            errors.append(f"content/Systems/{md.name}: has a sponsored affiliate link with NO "
                          f"disclosure — this is the compliance failure the gate exists for")
            continue
        if d > link:
            errors.append(f"content/Systems/{md.name}: the disclosure renders AFTER the affiliate "
                          f"link; it must be above it")
            continue
        if canon not in src:
            errors.append(f"content/Systems/{md.name}: the rendered disclosure is not the "
                          f"canonical sentence — regenerate the page (`npm run regenerate:md`)")
            continue
        sec_open, sec_close = src.rfind("<section", 0, d), src.find("</section>", d)
        if not (sec_open < d < link < sec_close):
            errors.append(f"content/Systems/{md.name}: disclosure and link are in different "
                          f"<section>s — not 'close to the link'")
            continue
        if not _no_details_between(src, d, link):
            errors.append(f"content/Systems/{md.name}: a <details> sits between the disclosure "
                          f"and the link")
            continue
        disclosed += 1
    return disclosed, monetised


def check_products(errors: list[str], warnings: list[str], strict_stale: bool) -> dict:
    """link_status/link_checked are how 'never ship an unverified URL' becomes checkable."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    required = set(((schema.get("properties") or {}).get("products") or {})
                   .get("items", {}).get("required") or [])
    for field in ("link_status", "link_checked"):
        if field not in required:
            errors.append(f"templates/Systems.json: products[].{field} is not required — the "
                          f"'no unverified URL renders' rule must be enforced by the schema, not "
                          f"only by review (docs/Affiliate.md §2)")
    tally = {"live": 0, "dead": 0, "unverified": 0}
    today = dt.date.today()
    for f in sorted(SYSTEMS_DIR.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for i, p in enumerate(data.get("products") or []):
            where = f"content/Systems/{f.name} products[{i}]"
            if not isinstance(p, dict):
                errors.append(f"{where}: not an object")
                continue
            status = str(p.get("link_status") or "").lower()
            checked = str(p.get("link_checked") or "")
            if status not in VALID_STATUS:
                errors.append(f"{where} ({p.get('title')!r}): link_status={p.get('link_status')!r} "
                              f"is not one of {sorted(VALID_STATUS)} — a product nobody verified "
                              f"must say so, and then it will not render")
                continue
            tally[status] += 1
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", checked):
                errors.append(f"{where}: link_checked={checked!r} is not an ISO date")
                continue
            if status != "live":
                continue
            url = str(p.get("affiliate_url") or "")
            if not url.startswith("https://"):
                errors.append(f"{where}: a live product's affiliate_url must be https: {url!r}")
            age = (today - dt.date.fromisoformat(checked)).days
            if age > STALE_DAYS:
                msg = (f"{where} ({p.get('title')!r}): last verified {checked} ({age} days ago) — "
                       f"re-open the URL; vendor handles get renamed and products retired")
                (errors if strict_stale else warnings).append(msg)
    return tally


def check_graph_json(errors: list[str]) -> None:
    if not GRAPH.exists():
        return
    raw = GRAPH.read_text(encoding="utf-8")
    # the JSON key itself, not the `has_affiliate_url` boolean that replaced it
    if '"affiliate_url"' in raw:
        errors.append(
            "graph.json contains `affiliate_url`. It is the one COMMITTED artifact here and it "
            "lands in a public repo: apply_affiliate_ref.py deliberately does not target it, so "
            "the URL can only ever be a placeholder — and 'fixing' that by stamping the real ref "
            "would publish the revenue identifier into git history forever. regenerate_graph.py "
            "emits products without it (has_affiliate_url keeps the fact). docs/Affiliate.md §3")
    if "REPLACE_ME" in raw:
        errors.append("graph.json still contains REPLACE_ME — see above; nothing in a committed "
                      "asset should carry the ref placeholder")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strict-stale", action="store_true",
                    help="treat a stale link verification as an error, not a warning")
    args = ap.parse_args()

    errors: list[str] = []
    warnings: list[str] = []
    try:
        canon = check_wording(errors)
    except (OSError, ValueError) as exc:
        print(f"[check_affiliate_surface] FAIL\n  - {exc}", file=sys.stderr)
        sys.exit(1)
    check_template_adjacency(errors)
    check_app_adjacency(errors)
    disclosed, monetised = check_generated_pages(errors, canon)
    tally = check_products(errors, warnings, args.strict_stale)
    check_graph_json(errors)

    for w in warnings:
        print(f"[check_affiliate_surface] WARN — {w}")
    if errors:
        print("[check_affiliate_surface] FAIL", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    print(f"[check_affiliate_surface] OK — disclosure identical across docs/Affiliate.md, the "
          f"page template and the app; {disclosed}/{monetised} generated System page(s) with a "
          f"sponsored link disclose it above the link, in the same section, uncollapsed; "
          f"products: {tally['live']} live / {tally['dead']} dead / {tally['unverified']} "
          f"unverified (only live renders); graph.json carries no affiliate URL")


if __name__ == "__main__":
    main()
