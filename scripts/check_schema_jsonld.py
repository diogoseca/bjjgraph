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

MEASURED at v1.163.0: 21,545 blocks across 4,603 of the 4,609 generated files, exactly ONE not
parsing — `content/Learning/Conscious Mastery.md`, whose FAQ answer says `such as "Mount
principles"`. 89 whole-value interpolations became `{{ x | jsonstr }}` then; the remaining 86
literal+expression values (83 by the same mechanical transform, 2 if/endif and 1 for/endfor by
hand) followed one version later — verified by DECODE-EQUALITY against a pre-change baseline:
21,545 blocks re-emitted, 0 whose parsed content changed, 0 files changed AT ALL (the rewrite is
prophylactic; today's corpus needed no different bytes). `| jsonstr` lives in
scripts/regenerate_md_from_json.py; NOT Jinja's `| tojson`, which also escapes every apostrophe
and rewrote 3,810 files for no correctness gain.

TWO LAYERS, one loud and one structural:
  1. TEMPLATE RATCHET (checked here, before any regeneration): no quoted JSON string inside a
     template's ld+json block may carry `{{` or `{%` at all. Values are written as
     `"key": {{ (expr-or-concatenation) | jsonstr }}` — the filter owns the quoting, so a value
     that could break the JSON cannot be expressed. This is what makes the class
     un-reintroducible instead of merely detected.
  2. EMITTED PARSE (defense in depth): every block in content/**/*.md must json.loads — catches a
     hand-authored .md, a jsonstr regression, or any escaping path the ratchet cannot see.

THE FIRST ATTEMPT AT THE 86 IS THE CAUTIONARY TALE. A transform that only understood `{{ }}`
treated `{% if %}...{% endif %}` inside two values as literal text and shipped the raw tags into
1,328 pages' schema — caught ONLY by the decode-equality differential, not by this gate (the
output still parsed as JSON; it was semantically wrong, not syntactically). A parse gate proves
syntax; only a differential proves content. Hence the transform now hard-fails on `{%`.

Run: python3 scripts/check_schema_jsonld.py                     (gate: both layers)
     python3 scripts/check_schema_jsonld.py --report-exposure   (per-template ratchet detail)
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


ANY_STR = re.compile(r'"(?:[^"\\]|\\.)*"')

def scan_templates() -> tuple[int, int, list]:
    """The ratchet: (template files with blocks, blocks, offending values).

    A quoted string inside an ld+json block that carries `{{` or `{%` is a value Jinja will
    interpolate INTO a JSON literal — the exact construction that broke, twice. Zero is the only
    passing count. Not colon-anchored: an array element or a key is just as breakable, and the
    first survey's colon anchor is why the three statement-carrying values were found late."""
    tfiles = tblocks = 0
    offending = []
    for f in sorted(TEMPLATES.rglob("*.jinja2")):
        text = f.read_text(encoding="utf-8")
        found = BLOCK.findall(text)
        if not found:
            continue
        tfiles += 1
        for blk in found:
            tblocks += 1
            for sm in ANY_STR.finditer(blk):
                v = sm.group(0)
                if "{{" in v or "{%" in v:
                    offending.append((f.relative_to(ROOT), v[:80]))
    return tfiles, tblocks, offending


def report_exposure() -> int:
    tfiles, tblocks, offending = scan_templates()
    print(f"[check_schema_jsonld] ratchet detail: {tblocks} ld+json block(s) across {tfiles} "
          f"template(s); {len(offending)} quoted value(s) carrying template syntax (0 is the law)")
    for rel, v in offending:
        print(f"    {rel}: {v}")
    return 1 if offending else 0


def main() -> int:
    if "--report-exposure" in sys.argv:
        return report_exposure()

    tfiles, tblocks, offending = scan_templates()
    print(f"[check_schema_jsonld] templates: {tblocks} ld+json block(s) across {tfiles} file(s) "
          f"scanned, {len(offending)} carrying raw template syntax")

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
    # ratchet floors first: a scan that sees no templates is a broken scan, not a clean tree
    if tfiles < 10:
        errs.append(f"only {tfiles} template file(s) carried an ld+json block, floor is 10 — the "
                    f"template scan matched almost nothing; check TEMPLATES and the block pattern.")
    if tblocks < 25:
        errs.append(f"only {tblocks} template block(s) found, floor is 25. Same reason.")
    for rel, v in offending:
        errs.append(f"{rel}: a quoted JSON string carries template syntax: {v}\n      Jinja will "
                    f"interpolate straight into a JSON literal, which is the construction that has "
                    f"broken twice. Write the value as `{{{{ (…) | jsonstr }}}}` instead — the "
                    f"filter owns the quoting, so the prose cannot end the string early.")
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
