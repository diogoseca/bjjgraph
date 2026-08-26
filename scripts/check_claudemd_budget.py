#!/usr/bin/env python3
"""CLAUDE.md budget gate — a ratchet on the file that is loaded into EVERY session.

Why this exists (v1.130.0, the canon/changelog split): CLAUDE.md reached 349,512 chars —
roughly 87k tokens spent before a single word of work, against a 150k-char limit. It grew
that way because every shipped change was written into it as a full post-mortem: owner
quote, symptom, root cause, measurement tables, mutation kill tables, gate snapshot, byte
deltas. None of that is wrong to write down; it was only ever wrong to write it HERE, in
the one document every session pays for.

Splitting it once is easy; keeping it split is the hard part, and the growth rate is the
argument: +52,643 chars in 2 days across 12 commits, and a further +12,161 in the 28 hours
while the split itself was being planned. That is one target-sized CLAUDE.md every few
days. Without a ratchet the trim is undone inside a fortnight and the next reader
reasonably concludes the split failed.

WHERE IT RUNS:
  - `npm run validate:claudemd`        — the direct entry point.
  - .github/workflows/ci-validate.yml  — step "CLAUDE.md budget (gate)".
NB the ci-validate `paths:` filter MUST list CLAUDE.md and docs/**. It did not when this
gate was written, which would have made it dead on arrival for exactly the pull request
that breaks it — a gate wired to a path filter that excludes its own subject is not a gate.

What it measures, and why it is not only a size check:

  1. SIZE. CLAUDE.md against the ceiling in tests/artifacts/budget_docs.json. A ceiling is
     a MAX, so shrinking always passes; --update RAISES it and belongs in its own justified
     commit.

  2. THE MACHINE-READ DISCLOSURE BLOCK. CLAUDE.md is a build input, not inert prose. Both
     scripts/check_affiliate_surface.py and e2e/journeys/systems-surface.spec.ts read the
     CANONICAL-DISCLOSURE markers out of it and compare the enclosed sentence byte-for-byte
     against templates/Systems.md.jinja2 and neural/src/app.src.jsx. Losing the markers
     throws; rewording the sentence fails a legal-compliance gate on deploy. Checked here so
     the failure lands at edit time rather than at deploy time.

  3. NO `@`-PREFIXED IMPORTS. Claude Code auto-loads `@path` imports recursively, so one
     such line silently re-attaches everything this split moved out and the budget becomes
     a lie while still reading green.

  4. THE TRAP CATALOGUE IS STILL THERE, AND IS STILL BIG. Section 6 is the whole point of
     the file; a rewrite that quietly drops it would otherwise sail through on size alone —
     the budget would in fact look BETTER.

On (4), and on why every check prints a positive count: this repo's single largest failure
class is "absence produces a plausible answer" — a check that never ran reads as a pass. It
has 17 recorded instances in 5 vocabularies (a NameError swallowed by a bare except that
reported 0 disagreements; a harness rule naming a URL the app never fetches; two build
rewrites whose `from` strings were absent; a join that shipped fabricated odds on ~289 of
1,204 option cards). The fix the repo independently reinvented five separate times is the
same one: emit a positive coverage count and fail on zero. So this gate never reports "no
problems found" — it reports how many traps, how many sections and how many bytes it
actually saw, and it fails when a count is zero.

Deliberately stdlib-only, and takes no arguments beyond --update.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "CLAUDE.md"
BUDGET = ROOT / "tests" / "artifacts" / "budget_docs.json"

# The companion documents the split created. They are budgeted loosely: they are read on
# demand, so their cost is paid only when relevant. They are listed at all so that "shrink
# CLAUDE.md" cannot be satisfied by moving weight into a file nobody is watching.
COMPANIONS = ("docs/Neural.md", "docs/Changelog-Archive.md")

DISCLOSURE_START = "<!-- CANONICAL-DISCLOSURE:START -->"
DISCLOSURE_END = "<!-- CANONICAL-DISCLOSURE:END -->"

# A trap entry opens with its trigger in backticks or bold caps, under a "### N." group
# heading inside the catalogue. Counting the group headings is the stable signal; counting
# entries is the useful one.
TRAP_SECTION_RE = re.compile(r"^##\s+\d*\.?\s*THOUGHT TRAPS", re.M | re.I)
TRAP_ENTRY_RE = re.compile(r"^-\s+\*\*", re.M)


def measure() -> dict:
    text = DOC.read_text(encoding="utf-8")
    out = {"CLAUDE.md": len(text)}
    for rel in COMPANIONS:
        p = ROOT / rel
        out[rel] = len(p.read_text(encoding="utf-8")) if p.exists() else 0
    return out


def structural_checks(text: str) -> tuple[list[str], dict]:
    """Returns (errors, counts). Counts are printed on success — see the docstring."""
    errors: list[str] = []
    counts: dict = {}

    # (2) the machine-read block
    if DISCLOSURE_START not in text or DISCLOSURE_END not in text:
        errors.append(
            "CLAUDE.md has lost its CANONICAL-DISCLOSURE markers. "
            "scripts/check_affiliate_surface.py and e2e/journeys/systems-surface.spec.ts "
            "both parse that block out of this file; without it they throw, and the "
            "affiliate disclosure has no single source of truth."
        )
        counts["disclosure_chars"] = 0
    else:
        body = text.split(DISCLOSURE_START, 1)[1].split(DISCLOSURE_END, 1)[0].strip()
        counts["disclosure_chars"] = len(body)
        if not body:
            errors.append("the CANONICAL-DISCLOSURE block is present but EMPTY")

    # (3) auto-loading imports
    imports = [
        ln for ln in text.splitlines()
        if re.match(r"^\s*@[A-Za-z0-9_./-]+\s*$", ln)
    ]
    counts["at_imports"] = len(imports)
    if imports:
        errors.append(
            "CLAUDE.md contains @-prefixed import line(s): "
            + ", ".join(i.strip() for i in imports[:5])
            + " — these auto-load recursively, which silently re-attaches everything the "
              "canon/changelog split moved out and makes this budget meaningless."
        )

    # (4) the catalogue
    counts["trap_sections"] = len(TRAP_SECTION_RE.findall(text))
    if counts["trap_sections"] == 0:
        errors.append(
            "no THOUGHT TRAPS section found — that catalogue is the reason this file is "
            "loaded every session; a rewrite that drops it would otherwise pass on size."
        )
        counts["trap_entries"] = 0
    else:
        seg = text[TRAP_SECTION_RE.search(text).start():]
        nxt = re.search(r"^## (?!.*THOUGHT TRAPS)", seg[3:], re.M)
        if nxt:
            seg = seg[: nxt.start() + 3]
        counts["trap_entries"] = len(TRAP_ENTRY_RE.findall(seg))
        counts["trap_chars"] = len(seg)
        if counts["trap_entries"] < 20:
            errors.append(
                f"the trap catalogue holds only {counts['trap_entries']} entries; "
                "44 were verified against HEAD when it was written. A catalogue this "
                "small has been gutted, not edited."
            )

    counts["sections"] = len(re.findall(r"^## ", text, re.M))
    if counts["sections"] == 0:
        errors.append("CLAUDE.md has no '## ' sections at all — the file is not structured")
    return errors, counts


def fmt(n: int) -> str:
    return f"{n:,}"


def main() -> None:
    ap = argparse.ArgumentParser(description="CLAUDE.md budget ratchet")
    ap.add_argument("--update", action="store_true",
                    help="RAISE the ceilings to the current sizes (own commit, please)")
    args = ap.parse_args()

    if not DOC.exists():
        print(f"ERROR: {DOC} does not exist", file=sys.stderr)
        sys.exit(1)

    sizes = measure()
    text = DOC.read_text(encoding="utf-8")

    if args.update:
        BUDGET.parent.mkdir(parents=True, exist_ok=True)
        prev = json.loads(BUDGET.read_text()) if BUDGET.exists() else {}
        ceilings = dict(prev.get("ceilings", {}))
        for k, v in sizes.items():
            ceilings[k] = max(ceilings.get(k, 0), v)
        BUDGET.write_text(json.dumps(
            {"_comment": "Char ceilings for the always-loaded canon and its companions. "
                         "A ceiling is a MAX: shrinking always passes. Raising one needs "
                         "--update in its own justified commit. See "
                         "scripts/check_claudemd_budget.py.",
             "ceilings": ceilings}, indent=1, sort_keys=True) + "\n")
        print(f"[check_claudemd_budget] wrote {BUDGET.relative_to(ROOT)}")
        for k in sorted(ceilings):
            print(f"    {k:<32} {fmt(ceilings[k])}")
        return

    if not BUDGET.exists():
        print(f"ERROR: no budget at {BUDGET}; run with --update first", file=sys.stderr)
        sys.exit(1)

    ceilings = json.loads(BUDGET.read_text())["ceilings"]
    errors, counts = structural_checks(text)

    for name, size in sizes.items():
        cap = ceilings.get(name)
        if cap is None:
            errors.append(f"{name}: no ceiling committed; run --update")
            continue
        if size > cap:
            errors.append(
                f"{name}: {fmt(size)} chars exceeds the ceiling {fmt(cap)} "
                f"(+{fmt(size - cap)}). Move the narrative to docs/Changelog-Archive.md, "
                f"or raise the ceiling with --update in its own justified commit."
            )

    if errors:
        print("[check_claudemd_budget] FAILED", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    # Positive coverage, never a bare "OK" — see the docstring.
    print("[check_claudemd_budget] OK")
    for name, size in sizes.items():
        cap = ceilings.get(name, 0)
        head = cap - size
        print(f"    {name:<32} {fmt(size):>9} / {fmt(cap):<9} ({fmt(head)} spare)")
    print(f"    sections {counts['sections']} · trap groups {counts['trap_sections']} · "
          f"trap entries {counts['trap_entries']} · "
          f"disclosure {counts['disclosure_chars']} chars · "
          f"@-imports {counts['at_imports']}")


if __name__ == "__main__":
    main()
