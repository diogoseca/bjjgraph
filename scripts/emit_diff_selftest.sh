#!/usr/bin/env bash
# Prove that scripts/emit_diff.py actually fails when it should.
#
#     scripts/emit_diff_selftest.sh <a-built-subtree-with-1000+-pages> [workdir]
#     e.g. scripts/emit_diff_selftest.sh source/public/Submissions
#     scripts/emit_diff_selftest.sh --controls  # four tiny files, no built tree
#
# A differ that has never gone red is not evidence of anything, and a differ whose
# red-ness was demonstrated once in a terminal is not evidence either -- nobody can
# re-check it. This runs the whole battery and asserts the exit codes, so "the differ
# catches a dropped canonical" is a claim with a command behind it.
#
# SIX PROOFS
#   1  control    : a byte-identical copy            -> exit 0, and the success line
#                                                       has exact file/page counts
#   2  mutant     : 12 seeded regressions            -> exit 1, every one named, and the
#                                                       two cosmetic ones land in S5, not S1
#   3  dead rule  : a normalization matching nothing -> exit 2
#   4  live rule  : a normalization that does match  -> exactly six seeded head hits
#   5  truncated  : a partial tree                   -> exit 2 (floor), never "no differences"
#   6  blind      : an extractor sabotaged on BOTH
#                   sides so the counts agree at 0   -> exit 2, NOT a clean report
#
# Proof 6 is the one the whole design exists for. CLAUDE.md 6.6: a check that never ran
# reports clean. If the HTML extractor silently stopped seeing JSON-LD, both manifests
# would say 0, every comparison would be trivially equal, and a broken differ would print
# the same "no differences" a perfect migration prints.
# Before any corpus run, exact-count fixtures exercise two HTML pages and two
# non-HTML decoys through the real extractor. Quoted structural siblings catch
# malformed IDs; empty/over-scoped/mangled-token mutants must each fail. Fixtures
# cover extraction only, never browser behavior or unexercised corpus features.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$REPO/scripts/emit_mutation_test.py" --extractor-controls || exit 3
if [ "${1:-}" = "--controls" ]; then exit 0; fi
SRC="${1:?usage: emit_diff_selftest.sh <built-subtree> [workdir], or --controls}"
WORK="${2:-${TMPDIR:-/tmp}/emit_diff_selftest}"
SEED="$REPO/scripts/emit_diff_seed.py"

[ -d "$SRC" ] || { echo "no such tree: $SRC" >&2; exit 3; }

pages=$(find "$SRC" -name '*.html' | wc -l)
if [ "$pages" -lt 1000 ]; then
  echo "REFUSING: $SRC has $pages html pages; the differ's own hard floor is 1,000, so a" >&2
  echo "smaller tree would make every proof exit 2 for the wrong reason." >&2
  exit 3
fi

echo "self-test tree : $SRC ($pages pages)"
echo "workdir        : $WORK"
rm -rf "$WORK"; mkdir -p "$WORK"
cp -a "$SRC" "$WORK/base"
cp -a "$SRC" "$WORK/control"
cp -a "$SRC" "$WORK/mutant"

fails=0
expect() { # expect <wanted-exit> <name> <actual-exit>
  if [ "$3" = "$1" ]; then printf '  PASS  %-34s exit %s\n' "$2" "$3"
  else printf '  FAIL  %-34s exit %s (wanted %s)\n' "$2" "$3" "$1"; fails=$((fails+1)); fi
}

echo
echo "--- seeding regressions -------------------------------------------------"
python3 "$SEED" "$WORK/mutant" || exit 3

echo
echo "--- fingerprinting ------------------------------------------------------"
for t in base control mutant; do
  python3 "$REPO/scripts/emit_fingerprint.py" "$WORK/$t" --out "$WORK/$t.json.gz" \
    --jobs 1 --label "selftest $t" > "$WORK/fingerprint-$t.log" 2>&1
  status=$?
  if [ "$status" -ne 0 ]; then cat "$WORK/fingerprint-$t.log" >&2; exit 3; fi
  tail -1 "$WORK/fingerprint-$t.log"
done
mkdir -p "$WORK/truncated"; cp "$WORK"/base/*.html "$WORK/truncated/" 2>/dev/null
find "$WORK/truncated" -name '*.html' | tail -n +40 | xargs -r rm -f
python3 "$REPO/scripts/emit_fingerprint.py" "$WORK/truncated" --out "$WORK/truncated.json.gz" \
  --jobs 1 --label "selftest truncated" > "$WORK/fingerprint-truncated.log" 2>&1
status=$?
if [ "$status" -ne 0 ]; then cat "$WORK/fingerprint-truncated.log" >&2; exit 3; fi
tail -1 "$WORK/fingerprint-truncated.log"

# proof 6: sabotage the extractor itself, identically on both sides
python3 - "$REPO/scripts/emit_fingerprint.py" "$WORK/blind_fingerprint.py" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text()
before = 'if stype == "application/ld+json":'
assert text.count(before) == 1, 'sabotage must match exactly one extractor branch'
Path(sys.argv[2]).write_text(text.replace(before, 'if stype == "application/ld+json" and False:'))
PY
[ $? -eq 0 ] || exit 3
for t in base mutant; do
  python3 "$WORK/blind_fingerprint.py" "$WORK/$t" --out "$WORK/blind-$t.json.gz" \
    --jobs 1 --label "blind $t" > "$WORK/fingerprint-blind-$t.log" 2>&1
  status=$?
  if [ "$status" -ne 0 ]; then cat "$WORK/fingerprint-blind-$t.log" >&2; exit 3; fi
done

cat > "$WORK/dead-rule.json" <<'JSON'
{"rules":[{"id":"selftest-rule-that-matches-nothing","field":"a_field_that_does_not_exist",
  "reason":"selftest fixture","evidence":"selftest fixture"}]}
JSON
cat > "$WORK/live-rule.json" <<'JSON'
{"rules":[{"id":"selftest-head-raw-sha","field":"head_raw_sha","mode":"full",
  "absence_ok":"selftest fixture only; head_raw_sha is never absent",
  "reason":"selftest fixture","evidence":"selftest fixture"}]}
JSON
cat > "$WORK/presence-rule.json" <<'JSON'
{"rules":[{"id":"selftest-canonical-value-only","field":"canonical","mode":"value",
  "reason":"selftest fixture: pretend canonical VALUES legitimately vary",
  "evidence":"selftest fixture"},
 {"id":"selftest-description-value-only","field":"meta_map\\[name=description\\]","mode":"value",
  "reason":"selftest fixture: pretend descriptions legitimately vary",
  "evidence":"selftest fixture"}]}
JSON

D="python3 $REPO/scripts/emit_diff.py"
echo
echo "--- proofs --------------------------------------------------------------"

$D "$WORK/base.json.gz" "$WORK/control.json.gz" --json "$WORK/1-control.json" > "$WORK/1-control.txt" 2>&1
expect 0 "1 control (identical copy)" $?
python3 - "$SRC" "$WORK/1-control.json" <<'PY'
from pathlib import Path
import json, sys
files = [p for p in Path(sys.argv[1]).rglob('*') if p.is_file()]
pages = [p for p in files if p.suffix.lower() == '.html']
r = json.loads(Path(sys.argv[2]).read_text())
assert r['common'] == r['identical'] == len(files), 'control exact compared file count'
for side in ('golden', 'candidate'):
    assert r['coverage'][side]['html_pages'] == len(pages), 'control exact HTML page count'
assert not r['rows'] and not r['missing'] and not r['extra'], 'control is not identical'
print(f'  PASS  1 exact scope: files={len(files)}, HTML pages={len(pages)}')
PY
[ $? -eq 0 ] || fails=$((fails+1))

$D "$WORK/base.json.gz" "$WORK/mutant.json.gz" --json "$WORK/2-mutant.json" \
   > "$WORK/2-mutant.txt" 2>&1
expect 1 "2 mutant (12 seeded regressions)" $?

python3 - "$WORK/2-mutant.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
rows = r["rows"]
have = {(x["severity"], x["field"]) for x in rows}
need = [
    ("S1_SEO_HEAD", "n_jsonld"),          # a JSON-LD block deleted
    ("S1_SEO_HEAD", "jsonld"),            # a JSON-LD block's meaning corrupted
    ("S1_SEO_HEAD", "canonical"),         # a canonical dropped
    ("S1_SEO_HEAD", "meta_map[name=description]"),
    ("S1_SEO_HEAD", "html_attrs"),        # <html lang> changed
    ("S2_CONTENT", "article.headings"),   # h2 -> h3 inside the article
    ("S2_CONTENT", "article.text_sha"),   # article text changed
    ("S3_SHELL", "outside.link_targets"), # a nav link outside <article> dropped
]
missing = [n for n in need if n not in have]
if missing:
    print("  FAIL  2 mutant did not report:", missing); sys.exit(1)
# the two cosmetic mutations must NOT be escalated
bad = [x for x in rows if x["severity"] in ("S1_SEO_HEAD", "S2_CONTENT")
       and x["field"] in ("jsonld_raw_sha", "head_raw_sha", "sha")]
if bad:
    print("  FAIL  2 mutant escalated a format-only change:", [b["field"] for b in bad]); sys.exit(1)
if not r["missing"] or not r["extra"]:
    print("  FAIL  2 mutant lost the deleted/added page"); sys.exit(1)
print(f"  PASS  2 mutant classified all 8 keyed findings + file-set, "
      f"and kept {sum(1 for x in rows if x['severity']=='S5_FORMAT_ONLY')} cosmetic row(s) in S5")
PY
[ $? -eq 0 ] || fails=$((fails+1))

$D "$WORK/base.json.gz" "$WORK/mutant.json.gz" --allow "$WORK/dead-rule.json" \
   > "$WORK/3-dead-rule.txt" 2>&1
expect 2 "3 normalization matching nothing" $?

$D "$WORK/base.json.gz" "$WORK/mutant.json.gz" --allow "$WORK/live-rule.json" --json "$WORK/4-live-rule.json" \
   > "$WORK/4-live-rule.txt" 2>&1
expect 1 "4 normalization that does match" $?
python3 - "$WORK/4-live-rule.json" <<'PY'
import json, sys
rules = json.load(open(sys.argv[1]))['normalizations']
# Six distinct seeded pages change bytes before </head>: JSON-LD removal/value/key
# order, canonical removal, description and html lang (the prefix is included).
assert len(rules) == 1 and rules[0]['id'] == 'selftest-head-raw-sha'
assert rules[0]['hits'] == 6, ('live rule exact scope', rules[0]['hits'], 6)
print('  PASS  4 exact normalization scope: six seeded head-byte differences')
PY
[ $? -eq 0 ] || fails=$((fails+1))

$D "$WORK/base.json.gz" "$WORK/mutant.json.gz" --allow "$WORK/presence-rule.json" \
   > "$WORK/5-presence.txt" 2>&1
if grep -q "NOT suppressed" "$WORK/5-presence.txt" \
   && grep -qE "^ +1x +\[html\] canonical" "$WORK/5-presence.txt"; then
  echo "  PASS  5 value-mode rule kept a VANISHED canonical visible"
else
  echo "  FAIL  5 value-mode rule swallowed a vanished canonical"; fails=$((fails+1))
fi

$D "$WORK/base.json.gz" "$WORK/truncated.json.gz" > "$WORK/6-truncated.txt" 2>&1
expect 2 "6 truncated tree (floor breach)" $?

$D "$WORK/blind-base.json.gz" "$WORK/blind-mutant.json.gz" > "$WORK/7-blind.txt" 2>&1
expect 2 "7 blind extractor, both sides" $?
grep -qF "coverage['jsonld_blocks'] = 0 is below the hard floor" "$WORK/7-blind.txt" \
  || { echo "  FAIL  7 blind run did not name the zero count"; fails=$((fails+1)); }

echo
echo "-------------------------------------------------------------------------"
if [ "$fails" -eq 0 ]; then
  echo "SELF-TEST PASSED -- outputs in $WORK/*.txt"
  exit 0
fi
echo "SELF-TEST FAILED: $fails check(s) -- outputs in $WORK/*.txt"
exit 1
