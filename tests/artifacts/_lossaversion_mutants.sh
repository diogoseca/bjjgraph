#!/usr/bin/env bash
# RED PROOF for e2e/journeys/loss-aversion.spec.ts (v1.124.0). Each mutant reverts ONE claim,
# rebuilds the bundle, runs the named test, and must see it FAIL. A test that cannot fail is not
# evidence.
#
#   npm run dev          # or any server for source/public on :8080
#   bash tests/artifacts/_lossaversion_mutants.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
SRC=neural/src/app.src.jsx
BAK=$(mktemp)
cp "$SRC" "$BAK"

sync_app() {
  npm run dev:neural:app >/dev/null 2>&1
  cp neural/dist/neural.js neural/dist/neural.css source/quartz/static/neural/app/
  cp neural/dist/neural.js neural/dist/neural.css source/public/static/neural/app/
}
restore() { cp "$BAK" "$SRC"; sync_app; }
trap restore EXIT

run() {  # run <name> <spec-grep>
  out=$(flock /tmp/bjj-pw.lock npx playwright test --config e2e/playwright.config.ts \
        e2e/journeys/loss-aversion.spec.ts -g "$2" --reporter=line 2>&1)
  if echo "$out" | grep -qE "[0-9]+ failed"; then
    echo "  [RED  ] $1"
    echo "$out" | grep -m1 -A3 "Error:" | sed 's/^/         /'
  else
    echo "  [GREEN] $1   <<< MUTANT SURVIVED — the test cannot fail"
  fi
}

echo "── L1: the row is never rendered (the control does not ship) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="      if (lams.length > 1) {"
assert old in s, 'L1 anchor missing'
s=s.replace(old, "      if (false && lams.length > 1) {", 1)
open(p,'w').write(s)
EOF
sync_app; run "L1 the dial ships at all" "ships in Settings"; cp "$BAK" "$SRC"; sync_app

echo "── L2: the middle rung goes back to its v1.123.0 mislabel, \"Balanced\" ──"
# the whole reconciliation: lam=1 IS the balanced point, so naming lam=2 "Balanced" names the
# owner's chosen default after a posture it does not hold.
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old='  2: ["Slightly cautious",'
assert old in s, 'L2 anchor missing'
s=s.replace(old, '  2: ["Balanced",', 1)
open(p,'w').write(s)
EOF
sync_app; run "L2 the honest name on the default rung" "ships in Settings"; cp "$BAK" "$SRC"; sync_app

echo "── L3: the copy leaks the model's vocabulary onto the screen ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="Expect a nudge, not a different game."
assert old in s, 'L3 anchor missing'
s=s.replace(old, "Sets the loss aversion lambda used by the ranking.", 1)
open(p,'w').write(s)
EOF
sync_app; run "L3 white-belt words only" "ships in Settings"; cp "$BAK" "$SRC"; sync_app

echo "── L4: the presets are hardcoded instead of read off the wire ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="      const lams = (this._evLam || []).filter((l) => typeof l === \"number\");"
assert old in s, 'L4 anchor missing'
s=s.replace(old, "      const lams = [1, 2, 4];", 1)
open(p,'w').write(s)
EOF
sync_app; run "L4 wire-driven presets" "read off the wire"; cp "$BAK" "$SRC"; sync_app

echo "── L5: the dial stops selecting a block (it controls nothing) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="    let k = this._evLam.indexOf(this.get(\"lossAversion\", NG_EDGE_LAM));"
assert old in s, 'L5 anchor missing'
s=s.replace(old, "    let k = this._evLam.indexOf(NG_EDGE_LAM);", 1)
open(p,'w').write(s)
EOF
sync_app; run "L5 the dial actually re-ranks" "dealt SET is identical"; cp "$BAK" "$SRC"; sync_app

echo "── L6: the lambda is re-read per CARD instead of stamped per DEAL ──"
# the freeze. `moveEdge` reads the stamped row; this makes it re-resolve live, so flipping the
# dial repaints the tray a player is already reaching into.
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""  moveEdge(opt) {
    const r = opt && opt.ev; if (!r) return null;"""
assert old in s, 'L6 anchor missing'
new="""  moveEdge(opt) {
    let r = opt && opt.ev; if (!r) return null;
    { const m = this._ev && this._ev.get(r.key); const k2 = this._evLamIdx();
      const rr = m && m.get(opt.idx); const c = rr && rr.lam[k2];
      if (c) r = { e0: c[0], c1: c[1], att: rr.att, key: r.key, k: k2 }; }"""
s=s.replace(old, new, 1)
open(p,'w').write(s)
EOF
sync_app; run "L6 the order/numbers freeze at deal time" "cannot move the tray"; cp "$BAK" "$SRC"; sync_app

echo "── L7: the dial writes challenge evidence (a settings click farms objectives) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""            this.set("lossAversion", l);
            this.track("neural_loss_aversion_set", { preset: l });"""
assert old in s, 'L7 anchor missing'
s=s.replace(old, """            this.set("lossAversion", l);
            this.fx("options_dealt", { count: 1 });
            this.track("neural_loss_aversion_set", { preset: l });""", 1)
open(p,'w').write(s)
EOF
sync_app; run "L7 nothing earned is touched" "nothing you have earned"; cp "$BAK" "$SRC"; sync_app

echo "── L8: the dial reaches the ODDS (it must only reach the order) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="  moveChance(act) {"
assert old in s, 'L8 anchor missing'
s=s.replace(old, "  moveChance(act) {\n    if (this.get(\"lossAversion\", NG_EDGE_LAM) === 4) return 0.5;", 1)
open(p,'w').write(s)
EOF
sync_app; run "L8 odds are untouched by the dial" "dealt SET is identical"; cp "$BAK" "$SRC"; sync_app

echo
echo "restoring…"
