#!/usr/bin/env python3
"""One-time migration: remap transition outcomes from game-over to submission names.

Transitions should never point directly to game-over. Only Submissions should.
This script remaps all transition outcome `to` fields from "game-over" (or "Game Over")
to the appropriate Submission name.

Usage:
    python scripts/fix_transition_gameover_outcomes.py [--dry-run]
"""

import json
import sys
from pathlib import Path

TRANSITIONS_DIR = Path("content/Transitions")
SUBMISSIONS_DIR = Path("content/Submissions")

# Mapping: transition filename (stem) -> submission name for game-over outcomes
MAPPING = {
    # === Exact matches (30) ===
    "Americana": "Americana",
    "Aoki Lock Finish": "Aoki Lock Finish",
    "Armbar from Crucifix": "Armbar from Crucifix",
    "Baratoplata": "Baratoplata",
    "Baseball Bat Choke": "Baseball Bat Choke",
    "Bow and Arrow Choke": "Bow and Arrow Choke",
    "Breadcutter Choke": "Breadcutter Choke",
    "Calf Slicer": "Calf Slicer",
    "Choke from Crucifix": "Choke from Crucifix",
    "Clock Choke": "Clock Choke",
    "Cross Collar Choke": "Cross Collar Choke",
    "Darce Choke": "Darce Choke",
    "Estima Lock": "Estima Lock",
    "Guillotine Choke": "Guillotine Choke",
    "Heel Hook": "Heel Hook",
    "Heel Hook from Saddle": "Heel Hook from Saddle",
    "Inside Heel Hook from Honey Hole": "Inside Heel Hook from Honey Hole",
    "Inverted Triangle": "Inverted Triangle",
    "Kimura": "Kimura",
    "North-South Choke": "North-South Choke",
    "Omoplata": "Omoplata",
    "Outside Heel Hook": "Outside Heel Hook",
    "Outside Heel Hook from Cross Ashi": "Outside Heel Hook from Cross Ashi",
    "Paper Cutter Choke": "Paper Cutter Choke",
    "Rear Naked Choke": "Rear Naked Choke",
    "Short Choke": "Short Choke",
    "Toe Hold": "Toe Hold",
    "Toe Hold from Outside Ashi": "Toe Hold from Outside Ashi",
    "Triangle Choke": "Triangle Choke",
    "Williams Shoulder Lock": "Williams Shoulder Lock",

    # === Suffix-stripped (11) ===
    "Arm in Guillotine Variation": "Arm in Guillotine",
    "Belly Down Armbar Transition": "Belly Down Armbar",
    "Cross Collar Choke Finish": "Cross Collar Choke",
    "High Elbow Guillotine Variation": "High Elbow Guillotine",
    "Inside Sankaku Heel Hook": "Inside Sankaku Heel Hook Finish",
    "Kneebar Finish": "Kneebar",
    "Peruvian Necktie Setup": "Peruvian Necktie",
    "Rear Triangle Choke Finish": "Rear Triangle Choke",
    "Short Choke Attack": "Short Choke",
    "Ten Finger Guillotine Variation": "Ten Finger Guillotine",
    "Twister Finish": "Twister",

    # === Manual mappings (18) ===
    "Americana from Modified Mount": "Americana",
    "Arm Triangle from Top": "Arm Triangle",
    "Arm Triangle from Turtle": "Arm Triangle",
    "Armbar Finish": "Belly Down Armbar Finish",
    "Ezekiel from Closed Guard": "Ezekiel Choke",
    "Heel Hook from Backside 50-50": "Outside Heel Hook from Backside 50-50",
    "Inside Heel Hook from Ushiro": "Inside Heel Hook",
    "RNC from Harness": "RNC from Seat Belt",
    "Toe Hold from Estima Lock": "Toe Hold",
    "Body Triangle Squeeze": "Body Triangle RNC",
    "Dead Orchard to Anaconda Finish": "Anaconda Finish from Dead Orchard",
    "Finish Buggy Choke": "Buggy Choke Finish",
    "Finish from Hindulotine": "Hindulotine",
    "Hindulotine Choke Finish": "Hindulotine",
    "Kimura on Trapped Arm": "Kimura",
    "Neck Crank": "Neck Crank",
    "Outside Heel Hook Adjustment": "Outside Heel Hook",
    "Straight Footlock": "Straight Ankle Lock",

    # === Counter outcomes (8) — keyed by transition name ===
    "Armbar Defense": "Armbar from Guard",
    "Counter from Ankle Lock": "Straight Ankle Lock",
    "Escape Dead Orchard Control": "Anaconda Finish from Dead Orchard",
    "Hand Fighting from Back": "Rear Naked Choke",
    "Hand Fighting to Remove Collar Grip": "Cross Collar Choke",
    "Inversion Escape": "Inside Heel Hook",
    "Reverse Heel Hook Counter": "Heel Hook",
    "Straighten Leg Kneebar Defense": "Kneebar",
}


def main():
    dry_run = "--dry-run" in sys.argv

    # Validate all target submissions exist
    submission_names = {f.stem for f in SUBMISSIONS_DIR.glob("*.json")}
    missing = []
    for transition, submission in MAPPING.items():
        if submission not in submission_names:
            missing.append(f"  {transition} -> {submission} (NOT FOUND)")
    if missing:
        print("ERROR: Target submissions not found:")
        for m in missing:
            print(m)
        sys.exit(1)

    modified = 0
    skipped = 0
    errors = []

    for json_file in sorted(TRANSITIONS_DIR.glob("*.json")):
        name = json_file.stem
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            errors.append(f"  {name}: {e}")
            continue

        outcomes = data.get("outcomes", [])
        changed = False

        for outcome in outcomes:
            to_val = outcome.get("to", "")
            if to_val.lower().replace(" ", "-") == "game-over":
                if name not in MAPPING:
                    errors.append(f"  {name}: has game-over outcome but NO MAPPING defined")
                    continue
                target_submission = MAPPING[name]
                if dry_run:
                    print(f"  [DRY RUN] {name}: '{to_val}' -> '{target_submission}'")
                else:
                    outcome["to"] = target_submission
                changed = True

        if changed and not dry_run:
            json_file.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            modified += 1
        elif changed:
            modified += 1
        else:
            skipped += 1

    prefix = "[DRY RUN] " if dry_run else ""
    print(f"\n{prefix}Results:")
    print(f"  Modified: {modified}")
    print(f"  Skipped (no game-over): {skipped}")
    if errors:
        print(f"  Errors ({len(errors)}):")
        for e in errors:
            print(e)

    # Verify no game-over remains in transitions
    if not dry_run:
        remaining = 0
        for json_file in TRANSITIONS_DIR.glob("*.json"):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                for o in data.get("outcomes", []):
                    if o.get("to", "").lower().replace(" ", "-") == "game-over":
                        remaining += 1
                        print(f"  WARNING: {json_file.stem} still has game-over outcome")
            except Exception:
                pass
        if remaining == 0:
            print("\n  VERIFIED: Zero transition outcomes reference game-over")
        else:
            print(f"\n  WARNING: {remaining} transition outcomes still reference game-over")


if __name__ == "__main__":
    main()
