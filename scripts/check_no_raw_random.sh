#!/usr/bin/env bash
# Determinism gate: every random draw in the Neural app must go through the tagged rng() seam
# (journeys rig those tags to replay frame-exact). Exactly ONE Math.random is allowed — the
# passthrough inside rng() itself. The sound module must contain ZERO (it draws via rng("sfx")).
set -euo pipefail
COUNT=$(grep -c 'Math.random()' neural/src/app.src.jsx || true)
if [ "$COUNT" != "1" ]; then
  echo "FAIL: expected exactly 1 Math.random() in neural/src/app.src.jsx (the rng() passthrough), found $COUNT" >&2
  grep -n 'Math.random()' neural/src/app.src.jsx >&2
  exit 1
fi
SCOUNT=$(grep -c 'Math.random()' neural/src/sound.src.js || true)
if [ "$SCOUNT" != "0" ]; then
  echo "FAIL: sound.src.js must contain zero Math.random() (use app.rng(\"sfx\")), found $SCOUNT" >&2
  grep -n 'Math.random()' neural/src/sound.src.js >&2
  exit 1
fi
echo "ok: RNG seam intact (1 passthrough, sound clean)"
