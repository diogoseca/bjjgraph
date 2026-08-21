#!/usr/bin/env bash
# RED PROOF for e2e/journeys/option-hand.spec.ts (v1.119.0). Each mutant reverts ONE claim, rebuilds
# whatever that claim depends on, runs the named test, and must see it FAIL. H5 mutates the BUILD
# (scripts/regenerate_neural_data.py) rather than the app, because the claim it proves is about the
# wire; it re-emits graph-data.json and restores it afterwards.
#
#   npm run dev          # or any server for source/public on :8080
#   bash tests/artifacts/_hand_mutants.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
SRC=neural/src/app.src.jsx
GEN=scripts/regenerate_neural_data.py
BAK=$(mktemp); GBAK=$(mktemp)
cp "$SRC" "$BAK"; cp "$GEN" "$GBAK"

sync_app() { npm run dev:neural:app >/dev/null 2>&1; cp neural/dist/neural.js neural/dist/neural.css source/quartz/static/neural/app/; }
sync_data() { python3 "$GEN" >/dev/null 2>&1; cp -r source/quartz/static/neural/. source/public/static/neural/; }
restore() { cp "$BAK" "$SRC"; cp "$GBAK" "$GEN"; sync_app; sync_data; sync_app; }
trap restore EXIT

run() {  # run <name> <spec-grep>
  out=$(flock /tmp/bjj-pw.lock npx playwright test --config e2e/playwright.config.ts \
        e2e/journeys/option-hand.spec.ts -g "$2" --reporter=line 2>&1)
  if echo "$out" | grep -qE "[0-9]+ failed"; then
    echo "  [RED  ] $1"
    echo "$out" | grep -m1 -A2 "Error:" | sed 's/^/         /'
  else
    echo "  [GREEN] $1   <<< MUTANT SURVIVED — the test cannot fail"
  fi
}

echo "── H1: the cap goes back to a blind slice(0,10) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""    if (sorted.length <= NG_HAND_CAP) return sorted;
    const hand = sorted.slice(0, NG_HAND_CAP);"""
assert old in s, 'H1 anchor missing'
s=s.replace(old, """    if (sorted.length <= NG_HAND_CAP) return sorted;
    return sorted.slice(0, NG_HAND_CAP);
    const hand = sorted.slice(0, NG_HAND_CAP);""")
open(p,'w').write(s)
EOF
sync_app; run "H1 category floor" "never erases one"; cp "$BAK" "$SRC"; sync_app

echo "── H2: _cmpDealt drops the name tiebreak (falls through to insertion order) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="    return a.node.t < b.node.t ? -1 : a.node.t > b.node.t ? 1 : 0;"
assert old in s, 'H2 anchor missing'
s=s.replace(old, "    return 0;")
open(p,'w').write(s)
EOF
sync_app; run "H2 total order" "not node index"; cp "$BAK" "$SRC"; sync_app

echo "── H3: a constant on every submission (the +100 defect, at the value seam) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="  moveEdge(opt) {\n    const r = opt && opt.ev; if (!r) return null;"
assert old in s, 'H3 anchor missing'
s=s.replace(old, "  moveEdge(opt) {\n    if (opt && opt.node && opt.node.ty === \"submissions\") return 100;\n    const r = opt && opt.ev; if (!r) return null;")
open(p,'w').write(s)
EOF
sync_app; run "H3 print is not a constant" "the number the hand was ranked by"; cp "$BAK" "$SRC"; sync_app

echo "── H4: unfreeze the order (re-sort inside refreshOptionOdds) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
old="""  refreshOptionOdds() {
    if (this._defendSub != null) { this.refreshEscapeOdds(); return; } // defense window: the tray holds ESCAPE cards"""
assert old in s, 'H4 anchor missing'
s=s.replace(old, old + """
    if (this._optList) { for (const o of this._optList) o.ord = this.orderScore(o); this._optList.sort((a, b) => this._cmpDealt(a, b)); const el = this.optionsRef.current; if (el) for (const o of this._optList) { const c = (this._optionCards || []).find((x) => x.node === o.node); if (c) el.appendChild(c.card); } }""")
open(p,'w').write(s)
EOF
sync_app; run "H4 frozen order" "no card"; cp "$BAK" "$SRC"; sync_app

echo "── H5: the cal join loses its slug ladder (294 submissions fall back to ~45.6%) ──"
# The ladder does not ship alone, so reverting only the ladder is not a revert. TWO build gates
# stand in front of it and each one refused the mutant in turn, keeping it out of the browser
# entirely: "cal join regressed: only 3/297 submissions carry a successRate" and then "EDGE join
# regressed: only 976/1246 moves (78.3%) reached a graph-data node". Both are neutered here, which
# is exactly the build the app ran on before the join was fixed. That the mutant needs three edits
# to land is itself the finding: the wire cannot rot silently on the build side any more.
python3 - <<'EOF'
p='scripts/regenerate_neural_data.py'; s=open(p).read()
old="""        for c in (slug, slug.replace("/", "-"), slugify(title or "")):"""
assert old in s, 'H5 anchor missing'
s=s.replace(old, """        for c in (slug,):""")
for gate in ("""        if _pct < 95.0:""", """    if pct < 95.0:"""):
    assert gate in s, 'H5 gate anchor missing: ' + gate
    s=s.replace(gate, gate.split("if")[0] + "if False:")
open(p,'w').write(s)
EOF
sync_data; run "H5 authored submission rates" "AUTHORED rate"; cp "$GBAK" "$GEN"; sync_data; sync_app

echo "── done ──"
