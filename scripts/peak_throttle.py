#!/usr/bin/env python3
"""peak_throttle.py — a throttle GATE for token-intensive Claude runs during Anthropic's
peak window.

Anthropic drains the rolling 5-hour SESSION limit faster on WEEKDAYS 05:00-11:00 Pacific
(rolled out ~Mar 2026; the WEEKLY cap is unchanged). For an intensive corpus job
(regenerate_content_json / proofread over 1000+ files) that can burn the session budget
in a burst, drop this gate BETWEEN sequential runs/chunks so the work spreads across the
window instead of exhausting the session at peak.

Behaviour: if it's currently peak, print a loud announcement and wait (default 30 min,
or --until-offpeak to wait out the window), then exit 0. Off-peak, it announces and exits
0 immediately. Always exits 0 so you can chain it with `&&`.

Usage:
  python3 scripts/peak_throttle.py && \
    python3 scripts/regenerate_content_json.py --batch --category Principles --max-files 20
  python3 scripts/peak_throttle.py --until-offpeak    # wait until 11:00 PT, not a fixed nap
Env: PEAK_THROTTLE_MIN (default 30), PEAK_THROTTLE_DISABLE=1 to no-op.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo

    PACIFIC = ZoneInfo("America/Los_Angeles")  # handles PST/PDT automatically
except Exception:  # pragma: no cover
    PACIFIC = None

PEAK_START_HOUR = 5   # 05:00 PT
PEAK_END_HOUR = 11    # 11:00 PT
PEAK_DAYS = range(0, 5)  # Mon-Fri (weekend is fully off-peak)


def is_peak(now_pt: datetime) -> bool:
    return now_pt.weekday() in PEAK_DAYS and PEAK_START_HOUR <= now_pt.hour < PEAK_END_HOUR


def main() -> int:
    ap = argparse.ArgumentParser(description="Throttle gate for Anthropic peak hours (05:00-11:00 PT, Mon-Fri).")
    ap.add_argument("--minutes", type=int, default=int(os.environ.get("PEAK_THROTTLE_MIN", "30")),
                    help="Minutes to wait when peak (default 30).")
    ap.add_argument("--until-offpeak", action="store_true",
                    help="Wait until 11:00 PT instead of a fixed nap.")
    args = ap.parse_args()

    if os.environ.get("PEAK_THROTTLE_DISABLE") == "1" or PACIFIC is None:
        print("[peak-throttle] disabled — proceeding immediately.", flush=True)
        return 0

    now = datetime.now(PACIFIC)
    if not is_peak(now):
        print(f"[peak-throttle] {now:%a %H:%M} PT — OFF-PEAK, proceeding immediately.", flush=True)
        return 0

    if args.until_offpeak:
        resume = now.replace(hour=PEAK_END_HOUR, minute=0, second=0, microsecond=0)
        wait = max(0, int((resume - now).total_seconds()))
        why = f"until {resume:%H:%M} PT (peak window ends)"
    else:
        wait = max(0, args.minutes) * 60
        resume = now + timedelta(seconds=wait)
        why = f"{args.minutes} min"

    bar = "=" * 70
    print(bar, flush=True)
    print(f"[peak-throttle] PEAK HOURS  —  {now:%a %Y-%m-%d %H:%M} PT", flush=True)
    print("[peak-throttle] Anthropic peak window is 05:00-11:00 PT on weekdays: the rolling", flush=True)
    print("[peak-throttle] 5-hour SESSION limit drains faster now (weekly cap unchanged). This is", flush=True)
    print(f"[peak-throttle] a token-intensive run, so THROTTLING {why} before the next generation,", flush=True)
    print("[peak-throttle] to avoid burning the session budget in a burst.", flush=True)
    print(f"[peak-throttle] Resuming ~{resume:%H:%M} PT  ·  Ctrl-C to skip the wait.", flush=True)
    print(bar, flush=True)

    try:
        time.sleep(wait)
    except KeyboardInterrupt:
        print("\n[peak-throttle] wait skipped by user — proceeding.", flush=True)
        return 0
    print(f"[peak-throttle] resumed at {datetime.now(PACIFIC):%H:%M} PT — proceeding.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
