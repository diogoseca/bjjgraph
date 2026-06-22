#!/usr/bin/env zsh
#
# retry-claude.zsh — run a command, and if it fails on a Claude usage/rate limit,
# wait until the *server-stated reset time* before retrying. Only if a parsed-time
# wait still fails do we escalate to exponential backoff with jitter.
#
# Usage:
#   ./scripts/retry-claude.zsh <command...>
# Examples:
#   ./scripts/retry-claude.zsh npm run proofread -- --batch
#   ./scripts/retry-claude.zsh claude -p "fix TODOs in Mount.json"
#
# Tunables (env vars):
#   MAX_ATTEMPTS=12  MIN_WAIT=60  BUFFER=15  BACKOFF_BASE=30  BACKOFF_CAP=900  MAX_PARSED_WAIT=18000
#
set -u

[[ $# -ge 1 ]] || { print -r -- "usage: $0 <command...>" >&2; exit 2; }

MAX_ATTEMPTS=${MAX_ATTEMPTS:-12}      # total tries before giving up
MIN_WAIT=${MIN_WAIT:-60}              # never retry sooner than this, even if the reset is "now"/past
BUFFER=${BUFFER:-15}                  # secs added on top of a parsed reset, so we wake just after
BACKOFF_BASE=${BACKOFF_BASE:-30}      # first fallback sleep
BACKOFF_CAP=${BACKOFF_CAP:-900}       # 15 min cap on fallback backoff
MAX_PARSED_WAIT=${MAX_PARSED_WAIT:-18000}  # 5h session window; a parse beyond this ⇒ mis-parse/weekly ⇒ back off

# Parse a wait (seconds) out of failure output. Echoes seconds, or nothing.
parse_wait() {
  local out=$1 now secs ts chunk h m n hh mm ampm today target
  now=$(date +%s)

  # 1) HTTP "retry-after: N" (seconds) — raw API / proxies
  secs=$(print -r -- "$out" | grep -oiE 'retry-after["[:space:]:]+[0-9]+' | grep -oE '[0-9]+' | head -1)
  [[ -n $secs ]] && { print -r -- "$secs"; return }

  # 2) reset given as a unix epoch (e.g. anthropic-ratelimit-*-reset) — 10-digit, this decade
  ts=$(print -r -- "$out" | grep -oiE 'reset[^0-9]{0,24}1[0-9]{9}' | grep -oE '1[0-9]{9}' | head -1)
  if [[ -n $ts ]]; then
    (( target = ts - now )); (( target < 0 )) && target=0
    print -r -- "$target"; return
  fi

  # 3a) relative compact: "in 2h 14m 30s" / "in 45m" / "in 90s"
  chunk=$(print -r -- "$out" | grep -oiE 'in[[:space:]]+([0-9]+[[:space:]]*[hms][[:space:]]*)+' | head -1)
  if [[ -n $chunk ]]; then
    h=$(print -r -- "$chunk" | grep -oiE '[0-9]+[[:space:]]*h' | grep -oE '[0-9]+'); h=${h:-0}
    m=$(print -r -- "$chunk" | grep -oiE '[0-9]+[[:space:]]*m' | grep -oE '[0-9]+'); m=${m:-0}
    n=$(print -r -- "$chunk" | grep -oiE '[0-9]+[[:space:]]*s' | grep -oE '[0-9]+'); n=${n:-0}
    (( target = h*3600 + m*60 + n ))
    (( target > 0 )) && { print -r -- "$target"; return }
  fi

  # 3b) relative worded: "in 5 minutes" / "try again in 30 seconds" / "in 1 hour"
  chunk=$(print -r -- "$out" | grep -oiE 'in[[:space:]]+[0-9]+[[:space:]]*(second|minute|hour)' | head -1)
  if [[ -n $chunk ]]; then
    n=$(print -r -- "$chunk" | grep -oE '[0-9]+' | head -1)
    case $chunk in
      *[Hh]our*)   (( target = n*3600 )) ;;
      *[Mm]inute*) (( target = n*60 )) ;;
      *)           (( target = n )) ;;
    esac
    print -r -- "$target"; return
  fi

  # 4) absolute clock time: "resets at 3pm" / "at 3:30pm" / "at 15:30"
  #    Require a real clock (HH:MM, or H with am/pm) so a stray "at 2 attempts" can't match.
  chunk=$(print -r -- "$out" | grep -oiE 'at[[:space:]]+([0-9]{1,2}:[0-9]{2}([[:space:]]*[ap]m)?|[0-9]{1,2}[[:space:]]*[ap]m)' | head -1)
  if [[ -n $chunk ]]; then
    hh=$(print -r -- "$chunk" | grep -oE '[0-9]{1,2}' | head -1)
    mm=$(print -r -- "$chunk" | grep -oE ':[0-9]{2}' | grep -oE '[0-9]{2}'); mm=${mm:-00}
    ampm=$(print -r -- "$chunk" | grep -oiE '[ap]m' | tr 'A-Z' 'a-z')
    [[ $ampm == pm && $hh -lt 12 ]] && (( hh += 12 ))
    [[ $ampm == am && $hh -eq 12 ]] && hh=0
    today=$(date +%Y-%m-%d)
    # BSD date (macOS); fall back to GNU date (-d) if present
    target=$(date -j -f "%Y-%m-%d %H:%M" "$today $hh:$mm" +%s 2>/dev/null) \
      || target=$(date -d "$today $hh:$mm" +%s 2>/dev/null)
    if [[ -n $target ]]; then
      (( target -= now ))
      (( target <= 0 )) && (( target += 86400 ))   # clock time already passed → next day
      print -r -- "$target"; return
    fi
  fi

  # nothing parseable
  return
}

attempt=0
backoff_n=0
last_was_parsed=0

while (( attempt < MAX_ATTEMPTS )); do
  if [[ -t 1 ]]; then
    out=$("$@" 2>&1 | tee /dev/tty); status=${pipestatus[1]}   # live + captured
  else
    out=$("$@" 2>&1); status=$?; print -r -- "$out"
  fi

  (( status == 0 )) && exit 0

  (( attempt++ ))
  (( attempt >= MAX_ATTEMPTS )) && break

  wait=$(parse_wait "$out")

  # Don't trust a parsed reset if (a) it's a *weekly* block — those are multi-day, so we'd
  # rather just back off than sleep for days; or (b) it's longer than the ~5h session window,
  # which means we almost certainly mis-parsed. Either way, drop it → fall through to backoff.
  if [[ -n $wait ]]; then
    if print -r -- "$out" | grep -qiE 'weekly|per[[:space:]]+week|7[ -]?day'; then
      print -r -- "[retry $attempt] looks like a weekly limit — not honoring its reset, backing off instead" >&2
      wait=
    elif (( wait > MAX_PARSED_WAIT )); then
      print -r -- "[retry $attempt] parsed reset ${wait}s exceeds ${MAX_PARSED_WAIT}s session window — likely a mis-parse, backing off instead" >&2
      wait=
    fi
  fi

  if [[ -n $wait && $wait -ge 0 && $last_was_parsed -eq 0 ]]; then
    (( wait += BUFFER ))
    (( wait < MIN_WAIT )) && wait=$MIN_WAIT                 # never hot-loop, even if reset is "now"/past
    last_was_parsed=1
    print -r -- "[retry $attempt] limit reset detected → sleeping ${wait}s (until $(date -r $(( $(date +%s) + wait )) '+%H:%M:%S'))" >&2
  else
    # parsed time didn't resolve it (or none found) → progressive backoff
    (( wait = BACKOFF_BASE * (2 ** backoff_n) ))
    (( wait > BACKOFF_CAP )) && wait=$BACKOFF_CAP
    (( wait += RANDOM % 10 ))            # jitter
    (( wait < MIN_WAIT )) && wait=$MIN_WAIT                 # floor here too
    (( backoff_n++ ))
    last_was_parsed=0
    print -r -- "[retry $attempt] backoff #$backoff_n → sleeping ${wait}s" >&2
  fi

  sleep "$wait"
done

print -r -- "[retry] gave up after $attempt attempts" >&2
exit 1
