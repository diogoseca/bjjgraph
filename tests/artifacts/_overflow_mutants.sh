#!/usr/bin/env bash
# RED PROOF for e2e/journeys/option-overflow.spec.ts (v1.123.0). Each mutant reverts ONE claim,
# rebuilds the bundle (and the CSS, where the claim lives there), runs the named test, and must
# see it FAIL. A test that cannot fail is not evidence.
#
#   npm run dev          # or any server for source/public on :8080
#   bash tests/artifacts/_overflow_mutants.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
SRC=neural/src/app.src.jsx
CSS=neural/src/helmet.html
TPL=neural/src/xdc-template.html
BAK=$(mktemp); CBAK=$(mktemp); TBAK=$(mktemp)
cp "$SRC" "$BAK"; cp "$CSS" "$CBAK"; cp "$TPL" "$TBAK"

sync_app() {
  npm run dev:neural:app >/dev/null 2>&1
  cp neural/dist/neural.js neural/dist/neural.css source/quartz/static/neural/app/
  cp neural/dist/neural.js neural/dist/neural.css source/public/static/neural/app/
}
restore() { cp "$BAK" "$SRC"; cp "$CBAK" "$CSS"; cp "$TBAK" "$TPL"; sync_app; }
trap restore EXIT

run() {  # run <name> <spec-grep>
  out=$(flock /tmp/bjj-pw.lock npx playwright test --config e2e/playwright.config.ts \
        e2e/journeys/option-overflow.spec.ts -g "$2" --reporter=line 2>&1)
  if echo "$out" | grep -qE "[0-9]+ failed"; then
    echo "  [RED  ] $1"
    echo "$out" | grep -m1 -A3 "Error:" | sed 's/^/         /'
  else
    echo "  [GREEN] $1   <<< MUTANT SURVIVED — the test cannot fail"
  fi
}

echo "── O1: the decision clock goes back to linear ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""    const dsec = n <= NG_DECISION_KNEE
      ? base + (n - 1) * 0.8
      : base + (NG_DECISION_KNEE - 1) * 0.8 + NG_DECISION_K * Math.log2(n / NG_DECISION_KNEE);"""
assert old in s, 'O1 anchor missing'
s=s.replace(old, "    const dsec = base + (n - 1) * 0.8;")
open(p,'w').write(s)
EOF
sync_app; run "O1 sublinear clock" "stops scaling with the hand"; cp "$BAK" "$SRC"; sync_app

echo "── O2: the clock's knee is removed (pure log — small hands change too) ──"
# proves assertion 1 specifically: a curve that is merely sublinear is NOT enough, every hand at
# or under the knee has to keep its exact clock.
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""    const dsec = n <= NG_DECISION_KNEE
      ? base + (n - 1) * 0.8
      : base + (NG_DECISION_KNEE - 1) * 0.8 + NG_DECISION_K * Math.log2(n / NG_DECISION_KNEE);"""
assert old in s, 'O2 anchor missing'
s=s.replace(old, "    const dsec = base + 2.167 * Math.log2(n);")
open(p,'w').write(s)
EOF
sync_app; run "O2 knee preserves small hands" "stops scaling with the hand"; cp "$BAK" "$SRC"; sync_app

echo "── O3: the deck warm-up uncaps with the hand ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="opts.slice(0, NG_PREFETCH_CAP).map((o) => (o.node ? this.deckKeyFor(o.node).key : null))"
assert old in s, 'O3 anchor missing'
s=s.replace(old, "opts.map((o) => (o.node ? this.deckKeyFor(o.node).key : null))")
open(p,'w').write(s)
EOF
sync_app; run "O3 prefetch stays capped" "the deck warm-up did not"; cp "$BAK" "$SRC"; sync_app

echo "── O4: the hint docks below the tray again (bottom:68px, on the account chip) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="      if (more) this._dockOptionHint(hint, op);"
assert old in s, 'O4 anchor missing'
s=s.replace(old, "      if (more) hint.style.bottom = \"68px\";")
open(p,'w').write(s)
EOF
sync_app; run "O4 hint sits above the hand" "clear of the account chip"; cp "$BAK" "$SRC"; sync_app

echo "── O5: the hide rule loses its height term (the landscape-phone miss returns) ──"
python3 - <<'EOF'
p='neural/src/helmet.html'; s=open(p).read()
old="  @media (max-width:767px), (max-height:500px){\n    .ng-seemore{display:none!important;}\n  }"
assert old in s, 'O5 anchor missing'
s=s.replace(old, "  @media (max-width:640px){\n    .ng-seemore{display:none!important;}\n  }")
open(p,'w').write(s)
EOF
sync_app; run "O5 landscape phone hides it" "held sideways"; cp "$CBAK" "$CSS"; sync_app

echo "── O6: attachInput forgets the hint (setPointerCapture kills its click) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""      for (const ov of [this._landEl, this._landFilmEl, this.optDetailRef && this.optDetailRef.current,
        this.optionHintRef && this.optionHintRef.current]) {"""
assert old in s, 'O6 anchor missing'
s=s.replace(old, "      for (const ov of [this._landEl, this._landFilmEl, this.optDetailRef && this.optDetailRef.current]) {")
open(p,'w').write(s)
EOF
sync_app; run "O6 the hint is clickable by MOUSE" "click, and wheel"; cp "$BAK" "$SRC"; sync_app

echo "── O7: the tray's wheel handler is removed (card 34 unreachable by wheel) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      orow.scrollLeft += d;"""
assert old in s, 'O7 anchor missing'
s=s.replace(old, """      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      return;""")
open(p,'w').write(s)
EOF
sync_app; run "O7 a wheel scrolls the hand" "click, and wheel"; cp "$BAK" "$SRC"; sync_app



echo "── done — tree restored ──"
