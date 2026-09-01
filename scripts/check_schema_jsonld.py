#!/usr/bin/env python3
"""Every emitted JSON-LD block must PARSE — because an invalid one fails silently.

WHY THIS EXISTS. `content/**/*.md` is generated from `templates/*.jinja2`, and the schema blocks
are built by interpolating authored prose straight into a JSON string literal:

    "text": "{{ qa.answer }}"

Jinja does not know it is writing JSON. One `"` in the prose ends the string early and the whole
block becomes unparseable — and NOTHING anywhere notices. Google drops an invalid block without a
word, `npm run build` prints one line among thousands (`SchemaExtractor: Invalid JSON-LD in …`)
and exits 0, and `check_seo_parity.py` reads the <article>, not the <script>. The page keeps
ranking, the rich result quietly stops existing, and the only signal is a number in a dashboard
nobody attributes to a quote mark.

That is CLAUDE.md section 6.6 exactly: absence produces a plausible answer. So this gate emits a
POSITIVE COVERAGE COUNT — blocks parsed, files scanned — and hard-fails below a floor, so "found
no problems" can never be produced by "never looked".

MEASURED at the time of writing (v1.163.0): 4,609 generated files carrying 12,000+ blocks, of
which exactly ONE did not parse — `content/Learning/Conscious Mastery.md`, whose FAQ answer says
`such as "Mount principles"`. 89 interpolations whose whole value was a single expression are now
`{{ x | jsonstr }}` (scripts/regenerate_md_from_json.py), which quotes and escapes the value
itself. NOT Jinja's `| tojson`: that also escapes every apostrophe, which rewrote 3,810 files for
no correctness gain.

WHAT IS STILL EXPOSED, and why this gate rather than a bigger rewrite: 86 values in those same
blocks are literal text PLUS an expression (`"How to Escape {{ bottom.name }}"`,
`"{{ error.consequence }} The correct approach is: {{ error.correction }}"`). `| jsonstr` cannot
wrap those without restructuring each one into a concatenation, and a half-done rewrite that
reads as finished is worse than a gate that names the file the day it breaks. Recompute the
exposure with:

    python3 scripts/check_schema_jsonld.py --report-exposure

Run: python3 scripts/check_schema_jsonld.py        (gate)
Wired into .github/workflows/ci-validate.yml, whose paths filter must include BOTH content/**
and templates/** — the gate's own inputs (CLAUDE.md section 6.7).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"

BLOCK = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
# a JSON string value on the right of a colon that carries a Jinja expression
VALUE = re.compile(r':\s*("(?:[^"\\]|\\.)*")')
# `[^{}]*?`, NOT `.*?`: under fullmatch a lazy dot-all happily spans `}} literal {{`, so a
# literal+expression value reads as a single expression. That misread is not hypothetical —
# it is how the first pass of this very fix corrupted 4 values, emitting raw prose where a
# quoted JSON string belonged. The classifier and the rewrite must use the SAME pattern, and
# the counts they produce must agree (CLAUDE.md section 6.3).
PURE = re.compile(r'"\s*\{\{-?\s*([^{}]*?)\s*-?\}\}\s*"', re.S)

# Floors: a matcher that stops matching reads exactly like a clean corpus. These are ~60% of the
# figures measured when the gate was written, so real growth passes and a broken scan fails.
MIN_FILES = 2500
MIN_BLOCKS = 6000


def report_exposure() -> int:
    """Count JSON-LD string values that are still raw literal+expression concatenations."""
    pure = mixed = 0
    per_file = {}
    for f in sorted(TEMPLATES.rglob("*.jinja2")):
        for m in BLOCK.finditer(f.read_text(encoding="utf-8")):
            for vm in VALUE.finditer(m.group(1)):
                v = vm.group(1)
                if "{{" not in v:
                    continue
                if PURE.fullmatch(v):
                    pure += 1
                else:
                    mixed += 1
                    per_file[f.name] = per_file.get(f.name, 0) + 1
    print(f"[check_schema_jsonld] exposure: {mixed} literal+expression value(s) still raw, "
          f"{pure} whole-value expression(s) (those are quoted by |jsonstr and are safe)")
    for name, n in sorted(per_file.items(), key=lambda kv: -kv[1]):
        print(f"    {n:3}  {name}")
    return 0


def main() -> int:
    if "--report-exposure" in sys.argv:
        return report_exposure()

    files = blocks = 0
    bad = []
    for f in sorted(CONTENT.rglob("*.md")):
        text = f.read_text(encoding="utf-8")
        found = BLOCK.findall(text)
        if not found:
            continue
        files += 1
        for i, blk in enumerate(found):
            blocks += 1
            try:
                json.loads(blk)
            except Exception as e:
                bad.append((f.relative_to(ROOT), i, str(e)))

    print(f"[check_schema_jsonld] {blocks} JSON-LD block(s) across {files} generated file(s) parsed")

    errs = []
    if files < MIN_FILES:
        errs.append(f"only {files} file(s) carried a JSON-LD block, floor is {MIN_FILES}. The "
                    f"scan matched almost nothing — check the <script> pattern before believing "
                    f"a green run.")
    if blocks < MIN_BLOCKS:
        errs.append(f"only {blocks} block(s) found, floor is {MIN_BLOCKS}. Same reason.")
    for rel, i, msg in bad:
        errs.append(f"{rel} block {i}: {msg}\n      An authored value almost certainly contains a "
                    f"double quote. Fix it in templates/ by wrapping that value — "
                    f"`\"{{{{ x }}}}\"` becomes `{{{{ x | jsonstr }}}}`, which quotes AND escapes "
                    f"it — then `npm run regenerate:md`. Never fix it by editing the .md: it is "
                    f"generated and carries no banner (CLAUDE.md section 1).")

    if errs:
        print("[check_schema_jsonld] FAILED", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print(f"[check_schema_jsonld] OK — every block parses")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
