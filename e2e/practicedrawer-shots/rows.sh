#!/usr/bin/env bash
# PROTOTYPE ONLY (practicedrawer, PRACT1): one ROW per viewport, today / a / b / c, at the plan and in the middle of a card.
set -euo pipefail
D="${1:?shots dir}"
cd "$D"
for W in 390 1440; do
  if [ "$W" = 390 ]; then G="390x844+14+0"; else G="720x450+14+0"; fi
  args=()
  for f in 01-today-plan 02-today-card 03-a-plan 04-a-card 05-b-plan 06-b-card 07-c-plan 08-c-card; do
    [ -f "$f-$W.jpg" ] || continue
    case "$f" in
      01-*) l="Today, at the plan" ;; 02-*) l="Today, a card answered" ;;
      03-*) l="a, at the plan" ;; 04-*) l="a, a card answered" ;;
      05-*) l="b, at the plan" ;; 06-*) l="b, a card answered" ;;
      07-*) l="c, at the plan" ;; 08-*) l="c, a card answered" ;;
    esac
    args+=(-label "$l" "$f-$W.jpg")
  done
  # each tile is three args: -label, its text, the file
  n=$(( ${#args[@]} / 3 ))
  montage "${args[@]}" -tile "${n}x1" -geometry "$G" -background "#0b0d16" -fill "#e8ecf5" -pointsize 22 -quality 82 "40-row-$W.jpg"
done
ls -la "$D"/40-row-*.jpg
