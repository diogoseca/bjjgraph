#!/usr/bin/env bash
# RED PROOF for v1.118.0. Each mutant reverts ONE claim in neural/src/app.src.jsx, rebuilds the
# bundle, runs the named test, and must see it FAIL. The source is restored from git after every
# one, so a crash mid-run leaves nothing behind that `git checkout` will not fix.
set -uo pipefail
cd "$(dirname "$0")/../.."
SRC=neural/src/app.src.jsx
BAK=$(mktemp)
cp "$SRC" "$BAK"

restore() { cp "$BAK" "$SRC"; npm run dev:neural:app >/dev/null 2>&1; cp neural/dist/neural.js neural/dist/neural.css source/quartz/static/neural/app/; }
trap restore EXIT

run() {  # run <name> <spec-grep>
  npm run dev:neural:app >/dev/null 2>&1
  cp neural/dist/neural.js neural/dist/neural.css source/quartz/static/neural/app/
  out=$(flock /tmp/bjj-pw.lock npx playwright test --config e2e/playwright.config.ts \
        e2e/journeys/option-edge.spec.ts -g "$2" --reporter=line 2>&1)
  if echo "$out" | grep -q "1 failed\|2 failed\|3 failed"; then
    echo "  [RED  ] $1"
    echo "$out" | grep -A3 "Error:" | head -6 | sed 's/^/         /'
  else
    echo "  [GREEN] $1   <<< MUTANT SURVIVED — the test cannot fail"
  fi
  cp "$BAK" "$SRC"
}

echo "── M1: drop the live baseline (EDGE stops being a difference) ──"
python3 - <<'EOF'
import re,io
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("return r.e0 + (this.moveChance(opt.node) - p0) * r.c1 - this._evShift(r.key, r.k);",
            "return r.e0 + (this.moveChance(opt.node) - p0) * r.c1;")
open(p,'w').write(s)
EOF
run "M1 live baseline" "baseline moves with the hand"

echo "── M2: restore movePotential's submissions constant + rank on it ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace('  movePotential(opt) {\n    const n = opt.node;\n    const resIdx = opt.res;',
            '  movePotential(opt) {\n    const n = opt.node;\n    if (n.ty === "submissions") return 1;\n    const resIdx = opt.res;')
s=s.replace('=== "popularity" ? this.movePopularity(opt) : this.moveEdge(opt); }',
            '=== "popularity" ? this.movePopularity(opt) : this.movePotential(opt); }')
# the FULL revert: HEAD's sort too, or _cmpDealt's odds tie-break silently repairs the flat key
s=s.replace('''    for (const o of out) { o.ord = this.orderScore(o); o.ordOdds = this.moveChance(o.node); }
    out.sort((a, b) => this._cmpDealt(a, b));''',
            '''    out.sort((a, b) => this.orderScore(b) - this.orderScore(a));''')
assert 'this._cmpDealt(a, b)' not in s and 'if (n.ty === "submissions") return 1;' in s, 'M2 patch did not apply'
open(p,'w').write(s)
EOF
run "M2 submissions constant" "submissions constant is gone"

echo "── M3: unfreeze the order (re-sort inside refreshOptionOdds) ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("""  refreshOptionOdds() {
    if (this._defendSub != null) { this.refreshEscapeOdds(); return; } // defense window: the tray holds ESCAPE cards""",
"""  refreshOptionOdds() {
    if (this._defendSub != null) { this.refreshEscapeOdds(); return; } // defense window: the tray holds ESCAPE cards
    if (this._optList) { for (const o of this._optList) o.ord = this.orderScore(o); this._optList.sort((a, b) => this._cmpDealt(a, b)); const el = this.optionsRef.current; if (el) for (const o of this._optList) { const c = (this._optionCards || []).find((x) => x.node === o.node); if (c) el.appendChild(c.card); } }""")
assert 'this._optList.sort' in s, 'M3 patch did not apply'
open(p,'w').write(s)
EOF
run "M3 frozen order" "NEVER the order"

echo "── M4: glyph goes back to the technique's own strength ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("    const col = edge ? edge.col : this.hex(this.myColor(n));\n    const resName = opt.res >= 0 ? this.nodes[opt.res].t",
            "    const col = this.hex(this.myColor(n));\n    const resName = opt.res >= 0 ? this.nodes[opt.res].t")
s=s.replace('if (g) { g.style.filter = "drop-shadow(0 0 4px " + e.col + "70)"; g.innerHTML = this.catGlyphSvg(oc.node, oc.num, e.col); }','')
open(p,'w').write(s)
EOF
run "M4 one colour channel" "glyph wears the corner"

echo "── M5: an unvalued move fabricates a 0 ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("    const r = opt && opt.ev; if (!r) return null;", "    const r = opt && opt.ev; if (!r) return 0;")
open(p,'w').write(s)
EOF
run "M5 never invent" "never a fabricated 0"

echo "── M6: the sheet head goes back to movePotential ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("""        (edge
          ? '<span class="ngedgebig\"""", """        (false
          ? '<span class="ngedgebig\"""")
open(p,'w').write(s)
EOF
run "M6 sheet == card" "cannot contradict the card"

echo "── M7: anchor p0 on calSuccess (the ACTIVE ruleset) instead of the solve frame ──"
python3 - <<'EOF'
p='neural/src/app.src.jsx'; s=open(p).read()
s=s.replace("    const v = (br && this._evFrame && br[this._evFrame] != null) ? br[this._evFrame] : c.successRate;",
            "    const v = (br && this._giMode && br[this._giMode] != null) ? br[this._giMode] : c.successRate;")
open(p,'w').write(s)
EOF
run "M7 p0 frame anchor" "IS the published value"

echo "── done ──"
