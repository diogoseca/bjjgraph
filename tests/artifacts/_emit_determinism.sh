#!/usr/bin/env bash
# PROBE (evidence for v1.204.3, not a gate): the neural emit is a function of its INPUTS, not of
# PYTHONHASHSEED.
#
#   bash tests/artifacts/_emit_determinism.sh        # ~3.5 min: two full emits
#
# Until v1.198.4 curriculum.json's score table was sorted by weight over a Python SET with no
# tiebreak, so every tie fell in hash order and the same inputs emitted a different file each run
# — gzip 20,871-20,910 B, more noise than the first-hand gate's headroom at the time (15 B). The
# table now sorts on the shipped integers with the name as the tiebreak
# (scripts/regenerate_neural_data.py, _compact_score_weights). This emits TWICE under two different
# seeds and requires the three boot-path files to be byte-equal; the rest of the emit is compared
# too and reported, but only the three decide the exit code.
#
# POSITIVE CONTROL FIRST: the two seeds must actually reorder a Python set, or "byte-equal" would
# prove nothing (§6.6 — a check that cannot fail is not a check).
# Leaves the tree holding the seed-2 emit, which is what a normal emit writes anyway.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=source/quartz/static/neural
BOOT="graph-data.json curriculum.json flashcards/_index.json"
S1=1 S2=2
T=$(mktemp -d "${TMPDIR:-/tmp}/emit-determinism.XXXXXX")
trap 'rm -rf "$T"' EXIT

probe='print(list({"Side Control|Top","Half Guard|Bottom","Mount|Top","Closed Guard|Bottom","Kimura Trap|Top","Back Control|Top","Turtle|Bottom","Knee Slice Pass"}))'
o1=$(PYTHONHASHSEED=$S1 python3 -c "$probe"); o2=$(PYTHONHASHSEED=$S2 python3 -c "$probe")
if [ "$o1" = "$o2" ]; then
  echo "CONTROL FAILED: seeds $S1 and $S2 iterate the same set in the same order — pick other seeds" >&2
  exit 2
fi
echo "control: seeds $S1 and $S2 iterate one 8-name set in different orders (the old sort's input)"

for s in $S1 $S2; do
  PYTHONHASHSEED=$s python3 scripts/regenerate_neural_data.py > "$T/emit-$s.log" 2>&1
  cp -a "$OUT" "$T/out-$s"
done

rc=0
for f in $BOOT; do
  if cmp -s "$T/out-$S1/$f" "$T/out-$S2/$f"; then
    echo "byte-equal   $f ($(wc -c < "$T/out-$S1/$f") B)"
  else
    echo "DIFFERS      $f"; rc=1
  fi
done
n=$(diff -rq "$T/out-$S1" "$T/out-$S2" | wc -l)
echo "whole emit:  $(find "$T/out-$S1" -type f | wc -l) files, $n differing"
[ "$n" -eq 0 ] || diff -rq "$T/out-$S1" "$T/out-$S2" | head -5
[ $rc -eq 0 ] && echo "DETERMINISTIC" || echo "NOT DETERMINISTIC"
exit $rc
