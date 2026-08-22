#!/usr/bin/env bash
# Triple-run replay proof for the four journeys that pin the roll loop's determinism.
#
# WHY (v1.80.4): decks are now fetched on demand, so "what is resident" became a timeline
# instead of an invariant. If residency could shift the RNG stream — one extra draw in the MC
# distractor pooler is enough — these journeys would replay differently run to run, and the
# whole rigged-RNG test contract would rot silently. Three consecutive runs, byte-identical
# reporting, is the evidence that it does not.
#
# Byte-identical means: same tests, same pass/fail, and the same fx BEAT STREAM per test (the
# journeys assert on beats, so the beats are the observable). Playwright's JSON reporter carries
# per-test titles + status; timings are stripped before hashing (a clock is not behaviour).
#
# Usage: scripts/triple_replay.sh [runs]        (default 3)
set -uo pipefail
cd "$(dirname "$0")/.."
RUNS="${1:-3}"
SPECS="golden-path jit-loop mc-flashcards landing-card replay-digest"
OUT="$PWD/tests/artifacts/triple_replay"   # absolute: PLAYWRIGHT_JSON_OUTPUT_NAME resolves against the config dir, not the cwd
mkdir -p "$OUT"
rm -f "$OUT"/run-*.json "$OUT"/digest-*.txt

fail=0
for i in $(seq 1 "$RUNS"); do
  echo "── replay $i/$RUNS ──"
  REPLAY_RUN="$i" PLAYWRIGHT_JSON_OUTPUT_NAME="$OUT/run-$i.json" \
    flock /tmp/bjj-pw.lock npx playwright test --config e2e/playwright.config.ts \
    $SPECS --reporter=json >"$OUT/raw-$i.json" 2>"$OUT/err-$i.txt" || fail=1
  # A killed or crashed run must ABORT, never be reported as "differs": a missing report is an
  # infrastructure fact, and calling it a determinism divergence sends the reader hunting a bug
  # that is not there. (Seen for real: a run cut off after 3 of 27 tests.)
  if [ ! -s "$OUT/run-$i.json" ]; then
    echo "✗ replay $i produced NO report — the run was killed or crashed, not a divergence."
    echo "  stdout tail:"; tail -5 "$OUT/raw-$i.json" 2>/dev/null | sed 's/^/    /'
    exit 2
  fi
  # normalise: keep only the test identity + outcome, drop every duration/timestamp/attachment
  python3 - "$OUT/run-$i.json" "$OUT/digest-$i.txt" <<'PY'
import json, sys, re
# PLAYWRIGHT_JSON_OUTPUT_NAME sends the report to a FILE, so stdout carries nothing to parse
# (an earlier version scraped stdout and silently digested zero results — a comparison of two
# empty strings always passes, which is the worst possible way for a gate to be green).
data = json.load(open(sys.argv[1]))
rows = []
def walk(suite, prefix=""):
    for spec in suite.get("specs", []):
        for t in spec.get("tests", []):
            for r in t.get("results", []):
                rows.append(f"{spec.get('file')}::{spec.get('title')}::{r.get('status')}")
    for s in suite.get("suites", []):
        walk(s, prefix)
for s in data.get("suites", []):
    walk(s)
rows.sort()
if not rows:
    raise SystemExit("FATAL: digested zero test results — the report was not parsed")
open(sys.argv[2], "w").write("\n".join(rows) + "\n")
print(f"  {len(rows)} test results digested")
PY
done

echo
first="$OUT/digest-1.txt"
for i in $(seq 2 "$RUNS"); do
  if ! diff -q "$first" "$OUT/digest-$i.txt" >/dev/null; then
    echo "✗ replay $i DIFFERS from replay 1:"
    diff "$first" "$OUT/digest-$i.txt" | head -20
    fail=1
  fi
done
# the replay DIGEST (the scripted roll's own observable) must match byte for byte too
RD="$PWD/tests/artifacts/replay"
for i in $(seq 2 "$RUNS"); do
  if [ -f "$RD/run-$i.json" ] && ! cmp -s "$RD/run-1.json" "$RD/run-$i.json"; then
    echo "✗ replay digest $i differs from 1"; diff "$RD/run-1.json" "$RD/run-$i.json" | head -20; fail=1
  fi
done
if [ "$fail" -eq 0 ]; then
  echo "✓ $RUNS replays byte-identical — $(wc -l <"$first") test results, digest sha $(sha256sum "$RD/run-1.json" | cut -c1-16)"
fi
exit "$fail"
