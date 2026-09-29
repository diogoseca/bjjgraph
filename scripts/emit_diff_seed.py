#!/usr/bin/env python3
"""Seed a battery of regressions into a COPY of an emitted tree, for the emit-diff self-test.

    python3 scripts/emit_diff_seed.py <mutant-tree>

Twelve mutations, one per thing scripts/emit_diff.py claims to detect, plus two that it
must NOT escalate. Targets are chosen by scanning the tree in sorted order rather than
being hard-coded, so the self-test runs against any emitted subtree.

EVERY MUTATION IS ASSERTED TO HAVE APPLIED. A mutation whose pattern silently matched
nothing would leave the mutant byte-identical to the base for that defect, the differ
would correctly report nothing, and the self-test would read as a PASS for a check that
never happened -- the exact class of failure the differ exists to prevent, reproduced
inside its own test.
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
applied: list[dict] = []


def pages() -> list[str]:
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn.sort()
        for f in sorted(fn):
            if f.endswith(".html"):
                out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)


ALL = pages()
if len(ALL) < 14:
    sys.exit(f"need >=14 pages to seed into; {ROOT} has {len(ALL)}")


def pick(pred, taken: set) -> str:
    """First page (sorted, so it is deterministic) that the mutation can actually bite."""
    for p in ALL:
        if p in taken:
            continue
        try:
            if pred(open(os.path.join(ROOT, p), encoding="utf-8").read()):
                return p
        except OSError:
            continue
    return ""


taken: set = set()


def mutate(name, sev, needs, fn):
    rel = pick(needs, taken)
    if not rel:
        sys.exit(f"NO TARGET for {name}: no page in {ROOT} matches its precondition. "
                 f"Refusing to report a self-test result for a mutation that was never planted.")
    taken.add(rel)
    p = os.path.join(ROOT, rel)
    s = open(p, encoding="utf-8").read()
    out = fn(s)
    if out is None or out == s:
        sys.exit(f"MUTATION DID NOT APPLY: {name} on {rel}")
    open(p, "w", encoding="utf-8").write(out)
    applied.append({"id": name, "path": rel, "expect_severity": sev})
    print(f"  seeded {name:30s} {sev:15s} {rel}")


JSONLD = r'<script type="application/ld\+json">(.*?)</script>'

# ---- S1_SEO_HEAD --------------------------------------------------------
mutate("drop-one-jsonld-block", "S1_SEO_HEAD",
       lambda s: len(re.findall(JSONLD, s, re.S)) >= 2,
       lambda s: re.sub(JSONLD, "", s, count=1, flags=re.S))

mutate("drop-canonical-tag", "S1_SEO_HEAD",
       lambda s: '<link rel="canonical"' in s,
       lambda s: re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', "", s, count=1))

mutate("reword-meta-description", "S1_SEO_HEAD",
       lambda s: '<meta name="description" content="' in s,
       lambda s: s.replace('<meta name="description" content="',
                           '<meta name="description" content="SEEDED ', 1))

mutate("change-html-lang", "S1_SEO_HEAD",
       lambda s: '<html lang="en">' in s,
       lambda s: s.replace('<html lang="en">', '<html lang="en-GB">', 1))

# A JSON-LD block whose MEANING changes while the block COUNT does not -- the case a
# "count the blocks" check cannot see.
mutate("corrupt-jsonld-value", "S1_SEO_HEAD",
       lambda s: '"@type":"BreadcrumbList"' in s,
       lambda s: s.replace('"@type":"BreadcrumbList"', '"@type":"BreadcrumbLst"', 1))

# ---- S2_CONTENT ---------------------------------------------------------
def demote_h2(s):
    m = re.search(r"<h2\b([^>]*)>(.*?)</h2>", s, re.S)
    return None if not m else s[:m.start()] + f"<h3{m.group(1)}>{m.group(2)}</h3>" + s[m.end():]


mutate("h2-to-h3-in-article", "S2_CONTENT",
       lambda s: "<article" in s and re.search(r"<h2\b", s) is not None, demote_h2)

mutate("reword-article-text", "S2_CONTENT",
       lambda s: "</article>" in s,
       lambda s: s.replace("</article>", "<p>SEEDED PARAGRAPH</p></article>", 1))

# ---- S3_SHELL: the surface check_seo_parity.py cannot see ---------------
def drop_nav_link(s):
    head, sep, tail = s.partition("</article>")
    if not sep:
        return None
    m = re.search(r'<a [^>]*href="[^"]*"[^>]*>.*?</a>', tail, re.S)
    return None if not m else head + sep + tail[:m.start()] + tail[m.end():]


mutate("drop-nav-link-outside-article", "S3_SHELL",
       lambda s: "</article>" in s
       and re.search(r'<a [^>]*href="[^"]*"[^>]*>.*?</a>', s.split("</article>", 1)[1], re.S)
       is not None,
       drop_nav_link)

# ---- S5_FORMAT_ONLY: must NOT be escalated ------------------------------
def reorder_jsonld_keys(s):
    m = re.search(JSONLD, s, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(1))
    except Exception:
        return None
    if not isinstance(obj, dict) or len(obj) < 2:
        return None
    flipped = json.dumps({k: obj[k] for k in reversed(list(obj))},
                         separators=(",", ":"), ensure_ascii=False)
    return s[:m.start(1)] + flipped + s[m.end(1):]


mutate("reorder-jsonld-keys", "S5_FORMAT_ONLY",
       lambda s: bool(re.search(JSONLD, s, re.S)), reorder_jsonld_keys)

mutate("trailing-newline-only", "S5_FORMAT_ONLY", lambda s: True, lambda s: s + "\n")

# ---- S0_FILE_SET --------------------------------------------------------
gone = next(p for p in reversed(ALL) if p not in taken)
os.remove(os.path.join(ROOT, gone))
taken.add(gone)
applied.append({"id": "delete-a-page", "path": gone, "expect_severity": "S0_FILE_SET"})
print(f"  seeded {'delete-a-page':30s} {'S0_FILE_SET':15s} {gone}")

orphan = "Seeded-Orphan.html"
with open(os.path.join(ROOT, orphan), "w", encoding="utf-8") as fh:
    fh.write('<!DOCTYPE html><html lang="en"><head><title>orphan</title></head>'
             "<body><article></article></body></html>")
applied.append({"id": "add-an-orphan-page", "path": orphan, "expect_severity": "S0_FILE_SET"})
print(f"  seeded {'add-an-orphan-page':30s} {'S0_FILE_SET':15s} {orphan}")

with open(os.path.join(ROOT, "..", "seeded.json"), "w") as fh:
    json.dump({"root": ROOT, "mutations": applied}, fh, indent=1)
print(f"\n{len(applied)} mutations applied")
