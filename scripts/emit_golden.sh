#!/usr/bin/env bash
# Produce ONE emit of the static site and fingerprint it, reproducibly.
#
#     scripts/emit_golden.sh <dest-root> <label>
#
# e.g. scripts/emit_golden.sh /home/user/bjj-orchestrator/golden build0
#      -> <dest-root>/build0/           the emitted tree, byte for byte
#         <dest-root>/build0.json.gz    its fingerprint manifest
#         <dest-root>/build0.env.txt    the inputs this emit was produced under
#
# WHY A SCRIPT AND NOT A COMMENT IN A REPORT
# ------------------------------------------
# The golden baseline is only worth something if a candidate emit can be produced under
# provably identical conditions months later. Every input that changes the output is
# recorded into <label>.env.txt beside the tree, so a later diff can be checked for
# "was this even the same experiment".
#
# THE CHAIN
# ---------
# `npm run regenerate:neural`, then `npm run build`. It calls those two scripts rather
# than re-listing their steps -- see the note at the call site for why that matters here.
#
# It deliberately does NOT run `npm run dev:neural:app`. That is a dev convenience, and
# it also copies neural/src/system-preview.src.js to public/static/system-preview.js.
# Production does emit that file, but from scripts/apply_affiliate_ref.py (line ~232),
# which is already inside `npm run build`. Running dev:neural:app as well would rebuild
# the app bundle a second time for no reason and write a file by a path the deploy chain
# does not use -- both of which put avoidable variance into the baseline.
#
# HELD-CONSTANT INPUTS, WHICH ARE NOT THE SAME AS NORMALIZATIONS
# --------------------------------------------------------------
# quartz.config.ts reads POSTHOG_API_KEY / POSTHOG_API_HOST / SUPABASE_URL /
# SUPABASE_ANON_KEY through `dotenv/config`, which resolves `.env` relative to the cwd --
# and Quartz runs from `source/`, where there is no .env. apply_affiliate_ref.py reads
# AFFILIATE_REF and leaves links neutral without it. quartz.layout.ts reads
# SHOW_BREADCRUMBS. Unset, all of these give the "keyless / neutral / no-breadcrumbs"
# emit. That is a legitimate baseline for an A/B between two emitters because both sides
# see the same inputs -- but it is NOT the production emit, and the key-bearing paths
# (analytics injection, affiliate activation) are therefore NOT covered by a golden diff
# taken this way. Cover them by re-running this script with those variables set, and
# diffing that pair separately.
set -euo pipefail

DEST_ROOT="${1:?usage: emit_golden.sh <dest-root> <label>}"
LABEL="${2:?usage: emit_golden.sh <dest-root> <label>}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

OUT="$DEST_ROOT/$LABEL"
MANIFEST="$DEST_ROOT/$LABEL.json.gz"
ENVFILE="$DEST_ROOT/$LABEL.env.txt"

export TMPDIR="${TMPDIR:-/home/user/tmp-pw}"

mkdir -p "$DEST_ROOT"

# ---- refuse to run on top of a tree another process is writing --------------
# CLAUDE.md 6.4: a result taken while another process could write the tree under test is
# not a result.
if pgrep -f "bootstrap-cli.mjs build" >/dev/null 2>&1; then
  for pid in $(pgrep -f "bootstrap-cli.mjs build"); do
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
    case "$cwd" in
      "$REPO"|"$REPO"/*)
        echo "REFUSING: pid $pid is already building in this worktree ($cwd)" >&2
        exit 3;;
    esac
  done
fi

{
  echo "label            $LABEL"
  echo "repo             $REPO"
  echo "git_head         $(git rev-parse HEAD)"
  echo "git_branch       $(git rev-parse --abbrev-ref HEAD)"
  echo "git_status_dirty $(git status --porcelain | wc -l) path(s)"
  echo "node             $(node --version)"
  echo "python           $(python3 --version 2>&1)"
  echo "quartz_pkg_sha   $(sha256sum source/package-lock.json | cut -d' ' -f1)"
  echo "content_files    $(find content -name '*.md' | wc -l) md, $(find content -name '*.json' | wc -l) json"
  echo "TMPDIR           $TMPDIR"
  for v in POSTHOG_API_KEY POSTHOG_API_HOST SUPABASE_URL SUPABASE_ANON_KEY \
           AFFILIATE_REF SHOW_BREADCRUMBS CI; do
    # never print a secret's value -- only whether it was present
    val="${!v:-}"
    if [ -n "$val" ]; then echo "env $v SET(len=${#val})"; else echo "env $v unset"; fi
  done
  echo "source/.env      $([ -f source/.env ] && echo present || echo absent)"
} > "$ENVFILE"
echo "--- inputs recorded to $ENVFILE"
cat "$ENVFILE"

echo
echo "=== 1/4 regenerate:neural (payload + app bundle) ==="
npm run regenerate:neural 2>&1 | tail -3

echo
echo "=== 2/4 the build chain ==="
# Deliberately `npm run build` and NOT a re-listing of its steps. The repo already has
# TWO lists of the build chain -- package.json "build" and the inline steps in
# deploy.yaml / deploy-dev.yaml -- and no gate compares them (CLAUDE.md 6.7). A third
# copy here would be the same defect one more time, and the golden would silently stop
# matching the moment any of the three drifted.
#
# Known divergence between the two existing lists, which this script cannot paper over
# and which the migration has to resolve: package.json runs build:forward BEFORE
# build:share-shell; both deploy workflows run build_share_shell.mjs BEFORE
# build:forward. They write disjoint paths today (l.html + l-manifest.json vs dev/),
# so the emit is the same either way -- but nothing enforces that, and a future step
# that touches both would make the local golden and production diverge.
npm run build

echo
echo "=== 3/4 snapshot the emitted tree -> $OUT ==="
rm -rf "$OUT"
mkdir -p "$OUT"
# -a preserves times; the tree is a build artifact and is never committed.
cp -a source/public/. "$OUT/"
echo "$(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1)"

echo
echo "=== 4/4 fingerprint -> $MANIFEST ==="
python3 scripts/emit_fingerprint.py "$OUT" --out "$MANIFEST" \
  --label "$LABEL @ $(git rev-parse --short HEAD) ($(cat "$ENVFILE" | tr '\n' ';' | cut -c1-200))"

echo
echo "done: $OUT + $MANIFEST"
