#!/usr/bin/env python3
"""pace_calc.py — recommend the `--interval` for a sustainable regenerate_content_json run.

Pure arithmetic, no Claude / no I/O. Reads your live weekly-usage number off the
Anthropic dashboard (% used + hours since the weekly reset) and prints the inter-call
sleep that keeps total weekly usage at/under a target ceiling, so the corpus regen
spreads across the week instead of exhausting the cap in a burst.

Method: the run currently burns `used_pct / hours_elapsed` %/h back-to-back. To land the
remaining budget over the rest of the week we need a target rate, i.e. a slowdown of
`rate_now / rate_target`; achieved by sleeping `(slowdown - 1) x call_seconds` after each
file. (Cross-checked against per-call %: identical.)

Usage:
  python3 scripts/pace_calc.py --used-pct 27 --hours-elapsed 9
  python3 scripts/pace_calc.py --used-pct 40 --hours-elapsed 30 --target-pct 70
Then: python3 scripts/regenerate_content_json.py --interval <printed> --peak-throttle
"""

from __future__ import annotations

import argparse


def main() -> int:
    ap = argparse.ArgumentParser(description="Recommend --interval for a sustainable regen.")
    ap.add_argument("--used-pct", type=float, required=True,
                    help="%% of the weekly cap already used (from the dashboard).")
    ap.add_argument("--hours-elapsed", type=float, required=True,
                    help="Hours since the weekly reset.")
    ap.add_argument("--target-pct", type=float, default=80.0,
                    help="Weekly %% ceiling to stay under (default 80 → leaves 20%% headroom).")
    ap.add_argument("--call-seconds", type=float, default=245.0,
                    help="Measured wall-clock per Claude call (default 245s ≈ 4.1 min).")
    ap.add_argument("--week-hours", type=float, default=168.0,
                    help="Length of the weekly window in hours (default 168).")
    args = ap.parse_args()

    used, elapsed, target = args.used_pct, args.hours_elapsed, args.target_pct
    call_s, week_h = args.call_seconds, args.week_hours

    if elapsed <= 0:
        print("hours-elapsed must be > 0"); return 2

    rate_now = used / elapsed                      # %/h observed
    fwd_budget = target - used                     # % left to spend under the ceiling
    fwd_hours = week_h - elapsed                    # h left in the week

    print(f"observed rate   : {rate_now:.3f} %/h   ({used:.0f}% in {elapsed:.0f}h)")
    print(f"forward budget  : {fwd_budget:.1f}% over {fwd_hours:.0f}h until reset")

    if fwd_budget <= 0:
        print(f"\n⚠️  Already at/over the {target:.0f}% ceiling — STOP the regen until the weekly reset.")
        return 0
    if fwd_hours <= 0:
        print("\n⚠️  No time left in the week — wait for the reset."); return 0

    rate_tgt = fwd_budget / fwd_hours              # %/h target
    slowdown = rate_now / rate_tgt if rate_tgt > 0 else float("inf")
    sleep_s = max(0.0, (slowdown - 1.0) * call_s)
    cycle_s = call_s + sleep_s

    print(f"target rate     : {rate_tgt:.4f} %/h  ({rate_tgt * 24:.2f}%/day)  → {slowdown:.2f}× slowdown")

    if sleep_s <= 0:
        print("\n→ Current pace already fits the budget — no extra sleep needed (--interval 0).")
        return 0

    files_day = 86400 / cycle_s
    # sanity: project the week-end total if we hold this interval the rest of the week
    per_call_pct = used / (elapsed * 3600 / call_s)
    proj_total = used + (fwd_hours * 3600 / cycle_s) * per_call_pct

    print(f"\n→ RECOMMENDED:  --interval {round(sleep_s)}   (~{sleep_s / 60:.0f} min/call)")
    print(f"   throughput   : ~{files_day:.0f} files/day")
    print(f"   week-end est : ~{proj_total:.0f}% total  (ceiling {target:.0f}%)")
    print(f"\n   python3 scripts/regenerate_content_json.py --interval {round(sleep_s)} --peak-throttle")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
