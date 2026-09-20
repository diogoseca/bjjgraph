#!/usr/bin/env bash
# RED PROOF for e2e/journeys/auth-redirect-back.spec.ts and e2e/journeys/category-nav.spec.ts.
#
# Each mutant reverts ONE claim, runs the named spec, and must see the RIGHT tests fail and the
# rest still pass. A test that cannot fail is not evidence — and a mutant that reddens EVERYTHING
# only proves the file runs. The discrimination is the proof, so every mutant declares both
# EXPECT_RED and EXPECT_GREEN and the script fails if either half is wrong.
#
#   npm run build            # or any built site at $SITE_DIR
#   bash tests/artifacts/_presentation_mutants.sh
#
# WHY THIS ONE MUTATES THE BUILT ARTIFACT, NOT THE SOURCE.
#
# Its siblings (_hand_mutants.sh, _overflow_mutants.sh, _lossaversion_mutants.sh) patch
# neural/src/*.jsx and rebuild with `npm run dev:neural:app`, which takes under a second. The
# subjects here — components/scripts/authUI.inline.ts and components/CategoryNav.tsx — are
# Quartz's, and the only way to get them into a page is a full `npm run build`: ~11 minutes,
# under a shared build mutex, ×10 mutants. So these mutants patch the EMITTED bytes that the
# spec actually loads: postscript.js (which is where authUI.inline.ts ends up) and the emitted
# HTML (which is where CategoryNav ends up).
#
# That is faithful to what each spec claims. Every one of these mutations is the exact observable
# a replacement engine would produce if it dropped the branch or the component — which is the
# question stream D exists to answer. What it does NOT prove is that a SOURCE edit produces the
# mutation; if you change the anchors below, re-derive them from a real build.
#
# EVERY PATCH ASSERTS ITS ANCHOR (CLAUDE.md §6.4). A substitution whose `from` string is absent
# must throw, never match nothing — a mutant that silently patched nothing would run the spec
# unmutated and report a reassuring GREEN.
set -uo pipefail
cd "$(dirname "$0")/../.."

SITE_DIR="${SITE_DIR:-source/public}"
CONFIG=e2e/playwright.config.ts
AUTH_SPEC=e2e/journeys/auth-redirect-back.spec.ts
NAV_SPEC=e2e/journeys/category-nav.spec.ts
export TMPDIR="${TMPDIR:-/home/user/tmp-pw}"
mkdir -p "$TMPDIR"

if [ ! -f "$SITE_DIR/postscript.js" ]; then
  echo "FATAL: no built site at $SITE_DIR (postscript.js absent). Build first, or set SITE_DIR." >&2
  exit 2
fi

# Every file a mutant may touch. The serve layer resolves /X to X/index.html in preference to
# X.html where BOTH exist (measured), so both copies are patched and both must carry the anchor.
FILES=(
  "postscript.js"
  "index.html"
  "Systems.html"
  "Systems/index.html"
  "Positions/Mount.html"
  "Positions/Mount/index.html"
  "Positions/Mount/Top.html"
)

BAKDIR=$(mktemp -d "$TMPDIR/presentation-mutants.XXXXXX")
for f in "${FILES[@]}"; do
  [ -f "$SITE_DIR/$f" ] || { echo "FATAL: $SITE_DIR/$f missing" >&2; exit 2; }
  mkdir -p "$BAKDIR/$(dirname "$f")"
  cp "$SITE_DIR/$f" "$BAKDIR/$f"
done
restore() { for f in "${FILES[@]}"; do cp "$BAKDIR/$f" "$SITE_DIR/$f"; done; }
trap 'restore; rm -rf "$BAKDIR"' EXIT INT TERM

APPLIED=0
KILLS=0
FAILURES=0

# run <mutant-id> <spec> <expect-red-regex> <expect-green-regex>
#   expect-red   : test titles (grep -E) that MUST fail under this mutant
#   expect-green : test titles that MUST still pass — this is what makes the mutant discriminating
# ONLY=M1  (or ONLY='M1|M9') runs a subset. Each mutant is independent and the tree is restored
# after every one, so a subset is a real result for the mutants it names — it is only the
# ten-of-ten completeness claim at the bottom that a filtered run cannot make, and it says so.
run() {
  local id="$1" spec="$2" red="$3" green="$4"
  if [ -n "${ONLY:-}" ] && ! echo "$id" | grep -qE "^(${ONLY})$"; then
    restore; echo "  [skip ] $id (ONLY=${ONLY})"; return
  fi
  local json="$TMPDIR/mut-$id.json"
  PLAYWRIGHT_JSON_OUTPUT_NAME="$json" npx playwright test -c "$CONFIG" "$spec" \
    --reporter=json >"$json" 2>"$TMPDIR/mut-$id.err" || true

  local verdict
  verdict=$(python3 - "$json" "$red" "$green" <<'PY'
import json, re, sys
path, red, green = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    data = json.load(open(path))
except Exception as e:
    print("ERROR could not parse playwright json: %s" % e); sys.exit(0)

results = {}
def walk(suite):
    for sp in suite.get("specs", []):
        results[sp["title"]] = "PASS" if sp.get("ok") else "FAIL"
    for s in suite.get("suites", []):
        walk(s)
for s in data.get("suites", []):
    walk(s)

if not results:
    print("ERROR the spec produced zero test results — it did not run"); sys.exit(0)

rx_red, rx_green = re.compile(red), re.compile(green)
want_red   = [t for t in results if rx_red.search(t)]
want_green = [t for t in results if rx_green.search(t)] if green else []
if not want_red:
    print("ERROR expect-red pattern %r matched none of %d test titles" % (red, len(results))); sys.exit(0)

bad = []
for t in want_red:
    if results[t] != "FAIL":
        bad.append("SURVIVED: %r still passes" % t)
for t in want_green:
    if results[t] != "PASS":
        bad.append("COLLATERAL: %r went red but must stay green" % t)
print(("OK %d red / %d green held" % (len(want_red), len(want_green))) if not bad else "BAD " + " | ".join(bad))
PY
)
  APPLIED=$((APPLIED + 1))
  if [[ "$verdict" == OK* ]]; then
    KILLS=$((KILLS + 1))
    echo "  [RED  ] $id — $verdict"
  else
    FAILURES=$((FAILURES + 1))
    echo "  [GREEN] $id — $verdict   <<< MUTANT SURVIVED OR MIS-DISCRIMINATED"
  fi
  restore
}

# patch <file> <python-expression-file> — applies a python snippet that must assert its anchor
patch_py() {
  python3 - "$SITE_DIR" "$@" || { echo "FATAL: anchor missing, mutant not applied" >&2; exit 3; }
}

echo "── site under test: $SITE_DIR ──"

# ═══════════════════════════════════════════════════════════════════════════════════════════
# AUTH: postscript.js carries authUI.inline.ts, minified. The shipped shape (verified on the
# golden build) is:
#   function ne(){let _=window.location.search+window.location.hash;
#                 return/[?&#](code|access_token|error_description)=/.test(_)}
#   document.addEventListener("nav",async()=>{window.__SUPABASE_URL&&(Y()||ne())&&await q()})
# The single-letter names are minifier output and WILL change on a rebuild, so every patch below
# anchors on the stable literals (the regex text, `window.__SUPABASE_URL&&`) and derives the
# identifiers, rather than hard-coding them.
# ═══════════════════════════════════════════════════════════════════════════════════════════

auth_anchor() {  # prints "GUARD<TAB>REGEXFN<TAB>AUTHFN<TAB>INITFN" or exits 3
  python3 - "$SITE_DIR/postscript.js" <<'PY'
import re, sys
s = open(sys.argv[1], encoding="utf8").read()
m = re.search(r'document\.addEventListener\("nav",async\(\)=>\{window\.__SUPABASE_URL&&\((\w+)\(\)\|\|(\w+)\(\)\)&&await (\w+)\(\)\}\)', s)
if not m:
    sys.stderr.write("ANCHOR MISSING: the authUI nav listener is not in postscript.js in the expected shape\n"); sys.exit(3)
print("%s\t%s\t%s\t%s" % (m.group(0), m.group(1), m.group(2), m.group(3)))
PY
}

A=$(auth_anchor) || exit 3
GUARD=$(cut -f1 <<<"$A"); IS_AUTH=$(cut -f2 <<<"$A"); HAS_PARAMS=$(cut -f3 <<<"$A"); ENSURE=$(cut -f4 <<<"$A")
echo "   authUI anchor resolved: isAuthenticated=$IS_AUTH() hasAuthRedirectParams=$HAS_PARAMS() ensureClientInitialized=$ENSURE()"

echo "── M1: the redirect-back arm is dropped from the guard (the exact defect R4 names) ──"
# The faithful shape of R4's defect is DROPPING `||hasAuthRedirectParams()`, leaving the
# isAuthenticated() arm intact — that is what "ship the façade, drop the redirect-back branch,
# pass the whole @curated gate" means. Turning the `||` into `&&` instead is a DIFFERENT defect
# (it breaks the signed-in path too) and legitimately reddens test 3, which is why an earlier
# version of this mutant reported COLLATERAL. Discrimination is the evidence, so the mutant has
# to be the defect it claims to be.
GUARD="$GUARD" HAS_PARAMS="$HAS_PARAMS" python3 - "$SITE_DIR/postscript.js" <<'PY'
import os, sys
p = sys.argv[1]; s = open(p, encoding="utf8").read()
old = os.environ["GUARD"]
assert old in s, "M1 anchor missing"
new = old.replace("||%s()" % os.environ["HAS_PARAMS"], "")   # keep isAuthenticated() only
open(p, "w", encoding="utf8").write(s.replace(old, new))
PY
run M1 "$AUTH_SPEC" 'redirect-back arrival creates|three redirect-back shapes' 'already-signed-in'

echo "── M2: the regex is narrowed to ?code= only (implicit + error arrivals stop matching) ──"
python3 - "$SITE_DIR/postscript.js" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf8").read()
old = "/[?&#](code|access_token|error_description)=/"
assert old in s, "M2 anchor missing"
open(p, "w", encoding="utf8").write(s.replace(old, "/[?&#](code)=/"))
PY
run M2 "$AUTH_SPEC" 'three redirect-back shapes' 'redirect-back arrival creates|already-signed-in'

echo "── M3: the isAuthenticated arm is dropped (returning signed-in users lose their client) ──"
GUARD="$GUARD" IS_AUTH="$IS_AUTH" python3 - "$SITE_DIR/postscript.js" <<'PY'
import os, sys
p = sys.argv[1]; s = open(p, encoding="utf8").read()
old = os.environ["GUARD"]
assert old in s, "M3 anchor missing"
new = old.replace("(%s()||" % os.environ["IS_AUTH"], "(")   # keep hasAuthRedirectParams() only
open(p, "w", encoding="utf8").write(s.replace(old, new))
PY
run M3 "$AUTH_SPEC" 'already-signed-in' 'three redirect-back shapes|redirect-back arrival creates'

echo "── M4: detectSessionInUrl:false — the client exists and never exchanges the code ──"
python3 - "$SITE_DIR/postscript.js" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf8").read()
old = "detectSessionInUrl:!0"
assert old in s, "M4 anchor missing (expected minified `detectSessionInUrl:!0`)"
open(p, "w", encoding="utf8").write(s.replace(old, "detectSessionInUrl:!1", 1))
PY
run M4 "$AUTH_SPEC" 'redirect-back arrival creates' 'already-signed-in'

echo "── M5: the whole nav listener is removed (authUI.inline.ts's second job deleted) ──"
GUARD="$GUARD" python3 - "$SITE_DIR/postscript.js" <<'PY'
import os, sys
p = sys.argv[1]; s = open(p, encoding="utf8").read()
old = os.environ["GUARD"]
assert old in s, "M5 anchor missing"
open(p, "w", encoding="utf8").write(s.replace(old, "void 0"))
PY
run M5 "$AUTH_SPEC" 'redirect-back arrival creates|three redirect-back shapes|already-signed-in' ''

# ═══════════════════════════════════════════════════════════════════════════════════════════
# CATEGORY NAV: emitted into every page's #sidebar-overlay by renderPage.tsx.
# Shipped shape: <nav class="category-nav desktop-only" aria-label="Categories"><ul><li>
#                <a href="../../../Learning/" data-cat="Learning">Learning</a></li>…</ul></nav>
# ═══════════════════════════════════════════════════════════════════════════════════════════

HTML=(index.html Systems.html Systems/index.html Positions/Mount.html Positions/Mount/index.html Positions/Mount/Top.html)

nav_patch() {  # nav_patch <label> <python-body-on-stdin>
  local label="$1"; shift
  local body; body=$(cat)
  for f in "${HTML[@]}"; do
    MUT_BODY="$body" python3 - "$SITE_DIR/$f" "$label" <<'PY'
import os, re, sys
p, label = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf8").read()
ns = {"s": s, "re": re}
exec(os.environ["MUT_BODY"], ns)
out = ns["s"]
if out == s:
    sys.stderr.write("ANCHOR MISSING in %s for %s — patch changed nothing\n" % (p, label)); sys.exit(3)
open(p, "w", encoding="utf8").write(out)
PY
    [ $? -eq 0 ] || { echo "FATAL: $label anchor missing in $f" >&2; exit 3; }
  done
}

echo "── M6: the nav element is not emitted at all ──"
nav_patch M6 <<'PY'
s2 = re.sub(r'<nav class="category-nav[^"]*"[^>]*>.*?</nav>', '', s, flags=re.S)
assert s2 != s
s = s2
PY
run M6 "$NAV_SPEC" 'category nav is emitted|carries all six|every category link resolves|still in the HTML' ''

echo "── M7: one category is dropped — five links where six are authored ──"
nav_patch M7 <<'PY'
s2 = re.sub(r'<li><a [^>]*data-cat="Systems"[^>]*>Systems</a></li>', '', s)
assert s2 != s
s = s2
PY
run M7 "$NAV_SPEC" 'carries all six|every category link resolves|still in the HTML' 'category nav is emitted'

echo "── M8: a replacement renames the wrapper class (structurally correct, gate-invisible) ──"
nav_patch M8 <<'PY'
s2 = s.replace('class="category-nav desktop-only"', 'class="cat-nav desktop-only"')
assert s2 != s
s = s2
PY
run M8 "$NAV_SPEC" 'category nav is emitted|carries all six|every category link resolves|still in the HTML' ''

echo "── M9: the six links still SAY the right thing and point at a page that is not emitted ──"
# NOTE: the obvious mutation — prefixing the existing href — is SELF-CANCELLING. The hrefs are
# `../../../Learning/`, so `__no_such_hub__/../../../Learning/` normalises straight back to
# /Learning/ and resolves 200. Measured: that version of M9 survived. The href is replaced
# outright instead, keeping the category name so the scaffold test (which matches on the name)
# legitimately stays green and only the RESOLUTION test goes red.
nav_patch M9 <<'PY'
def bust(m):
    return '<a href="__no_such_hub__/%s/" data-cat="%s">' % (m.group(1), m.group(1))
s2 = re.sub(r'<a href="[^"]*" data-cat="([^"]*)">', bust, s)
assert s2 != s
s = s2
PY
run M9 "$NAV_SPEC" 'every category link resolves' 'category nav is emitted|carries all six|still in the HTML'

echo "── M10: the nav is emitted but hidden at desktop (displayClass mis-wired) ──"
nav_patch M10 <<'PY'
s2 = s.replace('</head>', '<style>nav.category-nav{display:none!important}</style></head>', 1)
assert s2 != s
s = s2
PY
run M10 "$NAV_SPEC" 'category nav is emitted' 'carries all six|every category link resolves|still in the HTML'

echo
echo "── ${APPLIED} mutants applied · ${KILLS} killed with the right discrimination · ${FAILURES} bad ──"
if [ -z "${ONLY:-}" ]; then [ "$APPLIED" -eq 10 ] || { echo "EXPECTED 10 MUTANTS, APPLIED $APPLIED — the run was truncated"; exit 1; }; else echo "   (filtered run: ONLY=${ONLY} — this is NOT a ten-of-ten claim)"; fi
[ "$FAILURES" -eq 0 ] || exit 1
echo "── tree restored ──"
