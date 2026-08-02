#!/usr/bin/env bash
# Lint gate for the GENERATED journey suite (e2e/gen) — runs before `npm run e2e:gen`.
# Enforces the house rails on agent-authored specs:
#   1. app-level RNG seam intact (same check the core suite runs)
#   2. no raw Math.random( in any gen/quarantine spec (determinism)
#   3. every gen spec has a machine-readable /* @hyperspace {...} */ header
#   4. every gen spec drives the app through the journey() DSL
#   5. ledger <-> spec sync: every accepted ledger entry's file exists, and every gen spec
#      is claimed by exactly one ledger entry (no orphan specs, no dangling entries)
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/check_no_raw_random.sh

fail=0
shopt -s nullglob
for f in e2e/gen/*.spec.ts e2e/quarantine/*.spec.ts; do
  if grep -q "Math\.random(" "$f"; then
    echo "FAIL: raw Math.random( in $f (use j.rig(tag, values))"; fail=1
  fi
done
for f in e2e/gen/*.spec.ts; do
  if ! grep -q "@hyperspace" "$f"; then
    echo "FAIL: missing @hyperspace header in $f"; fail=1
  fi
  if ! grep -q "journey(" "$f"; then
    echo "FAIL: $f does not use the journey() DSL"; fail=1
  fi
done

python3 - <<'EOF' || fail=1
import json, glob, os, re, sys

ledger_path = "e2e/gen/ledger.json"
if not os.path.exists(ledger_path):
    print("FAIL: e2e/gen/ledger.json missing")
    sys.exit(1)
ledger = json.load(open(ledger_path))
entries = ledger.get("tests", [])

# accepted non-core entries must point at existing files; quarantined at quarantine files
bad = 0
claimed = {}
for e in entries:
    if e.get("origin") == "core":
        continue  # core specs live in e2e/journeys and are gated by the core suite
    f = e.get("file", "")
    if not os.path.exists(f):
        print(f"FAIL: ledger entry {e.get('id')} points at missing file {f}")
        bad += 1
    claimed.setdefault(f, []).append(e.get("id"))

for f, ids in claimed.items():
    if len(ids) > 1 and f.startswith("e2e/gen/"):
        # one spec FILE may hold several tests only if each has its own ledger id + header;
        # require the header count to match the claim count
        heads = len(re.findall(r"@hyperspace", open(f).read())) if os.path.exists(f) else 0
        if heads < len(ids):
            print(f"FAIL: {f} claimed by {ids} but has only {heads} @hyperspace header(s)")
            bad += 1

for f in glob.glob("e2e/gen/*.spec.ts"):
    if f not in claimed:
        print(f"FAIL: orphan spec {f} has no ledger entry")
        bad += 1

n_core = sum(1 for e in entries if e.get("origin") == "core")
n_auto = sum(1 for e in entries if e.get("origin") != "core" and e.get("status") == "accepted")
n_quar = sum(1 for e in entries if e.get("status") == "quarantined-red")
print(f"ledger: {n_core} core + {n_auto} accepted generated (target {ledger.get('target')}) + {n_quar} quarantined-red")
sys.exit(1 if bad else 0)
EOF

if [ "$fail" -ne 0 ]; then echo "check_gen_specs: FAIL"; exit 1; fi
echo "check_gen_specs: ok"
