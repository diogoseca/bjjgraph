#!/usr/bin/env bash
# RED PROOF for e2e/journeys/known-move-seal.spec.ts (v1.272.0, the owner's seal). Each mutant edits the SERVED bundle
# (source/public/static/neural/app/neural.js or neural.css) at an anchor that must occur EXACTLY ONCE, runs the whole
# spec, and prints which tests went red and at which message; the bundle is restored from a backup after each one.
# A neutral control (a warn string) must stay green in all four tests; "dev" serves dev's own bundle (BASE_DIST).
#
#   npm run dev:neural:app            # the bundle under test, served from source/public
#   BUILD_PEAK_MIB=4000 source <the build lock> seal "mutants" && bash tests/artifacts/_seal_mutants.sh [BASE_DIST]
set -uo pipefail
cd "$(dirname "$0")/../.."
APP=source/public/static/neural/app
BAK=$(mktemp -d)
cp -p "$APP"/* "$BAK/"
restore() { cp -p "$BAK"/* "$APP/"; }
trap 'restore; rm -rf "$BAK"' EXIT
export TMPDIR=${TMPDIR:-/home/user/tmp-pw}

run() {  # run <name>
  out=$(npx playwright test -c e2e/playwright.config.ts e2e/journeys/known-move-seal.spec.ts --reporter=line 2>&1)
  red=$(echo "$out" | grep -oE "[0-9]+ failed" | head -1); green=$(echo "$out" | grep -oE "[0-9]+ passed" | head -1)
  echo "── $1: ${red:-0 failed}, ${green:-0 passed}"
  echo "$out" | grep -E "^\s+[0-9]+\) |^\s+Error: " | sed -E 's/^\s+/   /'
}
# mutate <file> <old> <new>: a literal replace that must match exactly once
mutate() { python3 - "$APP/$1" "$2" "$3" <<'EOF'
import sys
p, old, new = sys.argv[1:4]
s = open(p, encoding="utf-8").read()
n = s.count(old)
assert n == 1, f"anchor matched {n} times in {p}: {old[:80]}"
open(p, "w", encoding="utf-8").write(s.replace(old, new))
EOF
}
append() { printf '%s\n' "$2" >> "$APP/$1"; }

run "baseline"

mutate neural.js '[neural] mastery gold unavailable' '[neural] mastery gold unavailablE' && node --check "$APP/neural.js" && run "M0 control: a warn string"; restore

append neural.css '.ng-choice-card[data-seal]{border-color:rgba(232,196,106,.9);box-shadow:0 0 0 .5px rgba(232,196,106,.6),0 0 6px rgba(255,214,128,.22)}' && run "M1 the gold outline back (dev's own rule, on a sealed card)"; restore

mutate neural.js 'let s=t==="known"||t==="learned"?t:null,' 'let s=t==="known"||t==="learned"?t:t==="new"&&!this._moveRow(e._choiceOpt)&&e._choiceOpt.action!=="escape"&&this.deckMastery(this.deckKeyFor(e._choiceOpt.node).key)>=1?"learned":null,' && node --check "$APP/neural.js" && run "M2 the hollow seal on a move with a due flashcard (deck learned, its due card ignored)"; restore

mutate neural.js 'let s=t==="known"||t==="learned"?t:null,' 'let s=t==="due"?"known":t==="known"||t==="learned"?t:null,' && node --check "$APP/neural.js" && run "M3 the filled seal on a due move"; restore

mutate neural.js '_paintCard(e){let t=this._moveState(e._choiceOpt);this._sealCard(e,t),this._applyHide(e,t)}' '_paintCard(e){let t=this._moveState(e._choiceOpt);e._sealed||(e._sealed=1,this._sealCard(e,t)),this._applyHide(e,t)}' && node --check "$APP/neural.js" && run "M4 the seal on a face-down card (painted at the deal only, the face repainted alone)"; restore

mutate neural.js 'let s=t==="known"||t==="learned"?t:null,' 'let s=t==="known"?"learned":t==="learned"?"known":null,' && node --check "$APP/neural.js" && run "M5 filled and hollow swapped"; restore

append neural.css '@media (max-width:330px){.ng-choice-seal{top:20px}}' && run "M6 the seal over the title, at 320 wide only"; restore

append neural.css '.ng-choice-card[data-asking]:not([data-hover]){border-color:rgba(150,170,210,.25);box-shadow:none}' && run "M7 the card asked by touch wears no outline (as on dev)"; restore

if [ -n "${1:-}" ]; then
  cp "$1"/* "$APP/" && run "dev's own bundle ($1, every file)"; restore
fi
run "baseline again"
