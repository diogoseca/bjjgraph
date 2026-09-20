#!/usr/bin/env python3
"""D-01's "prove they do not move" check: the frozen keep-list is COMPLETE and HONOURED.

NOT a permanent gate and NOT scripts/check_*.py. This is a programme-lifetime probe for the
Quartz replacement: D-01 keeps every file under source/quartz/components/ (plus the styles, i18n
and util modules) verbatim while the engine around them is replaced, and INTERFACE.md section 7
enumerates that set. Two things can silently go wrong with such a list, and this checks both:

  1. THE LIST IS INCOMPLETE. A file on disk that the keep-list does not name is a file the
     replacement is free to change, and nothing would report it. This is the hand-maintained
     enumeration defect (CLAUDE.md 6.7): a new member is missing by default.

  2. THE LIST IS COMPLETE BUT NO LONGER TRUE. A file drifted from the baseline and the claim
     "byte-for-byte unchanged" quietly stopped holding.

ABSENCE MUST NOT READ AS SUCCESS (CLAUDE.md 6.6). It prints a POSITIVE count of files actually
compared and exits non-zero if that count is zero, if the keep-list cannot be parsed, or if the
two set differences are not both empty. "Found no drift" and "compared nothing" cannot produce
the same output here.

    python3 tests/artifacts/_presentation_keeplist_check.py
    python3 tests/artifacts/_presentation_keeplist_check.py --base <ref> --interface <path>

Exit 0 complete and unchanged - 1 incomplete or drifted - 2 could not check.
"""

import argparse
import os
import re
import subprocess
import sys

DEFAULT_INTERFACE = "/home/user/bjj-orchestrator/quartz/INTERFACE.md"
DEFAULT_BASE = "f649801a9"  # the programme's base commit
PREFIX = "source/quartz/"
# The directories the keep-list is expected to cover exhaustively. components/ is D's surface and
# is the one asserted set-equal; the others are listed selectively by the contract, so they are
# byte-checked but not completeness-checked.
EXHAUSTIVE = "components"


def die(code, msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(code)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--interface", default=DEFAULT_INTERFACE)
    args = ap.parse_args()

    if not os.path.exists(args.interface):
        die(2, f"no interface contract at {args.interface}")

    txt = open(args.interface, encoding="utf8").read()
    m = re.search(r"Exact retained-file inventory.*?```text\n(.*?)```", txt, re.S)
    if not m:
        die(2, "could not find the keep-list block in the contract - the heading or fence moved")
    listed = [l.strip() for l in m.group(1).splitlines() if l.strip()]
    if not listed:
        die(2, "the keep-list block parsed to ZERO entries - a matcher that matches nothing "
               "reports clean (CLAUDE.md 6.6)")

    # ---- 1. completeness, for the directory the contract covers exhaustively ----------------
    listed_dir = sorted(p for p in listed if p.startswith(EXHAUSTIVE + "/"))
    tracked = subprocess.run(
        ["git", "ls-files", PREFIX + EXHAUSTIVE], capture_output=True, text=True
    )
    if tracked.returncode != 0:
        die(2, "git ls-files failed - not a repo?")
    disk_dir = sorted(p[len(PREFIX):] for p in tracked.stdout.split())
    if not disk_dir:
        die(2, f"git ls-files {PREFIX}{EXHAUSTIVE} returned nothing")

    unfrozen = [p for p in disk_dir if p not in listed_dir]
    phantom = [p for p in listed_dir if p not in disk_dir]

    # ---- 2. byte identity against the programme base ----------------------------------------
    checked, drifted = 0, []
    for rel in listed:
        full = PREFIX + rel
        if not os.path.exists(full):
            drifted.append((full, "ABSENT FROM WORKING TREE"))
            continue
        r = subprocess.run(["git", "show", f"{args.base}:{full}"], capture_output=True)
        if r.returncode != 0:
            drifted.append((full, f"NOT IN {args.base}"))
            continue
        checked += 1
        with open(full, "rb") as fh:
            if fh.read() != r.stdout:
                drifted.append((full, "BYTES DIFFER"))

    print(f"keep-list entries              : {len(listed)}")
    print(f"  of which {EXHAUSTIVE}/{'':<20}: {len(listed_dir)}")
    print(f"tracked under {PREFIX}{EXHAUSTIVE}/  : {len(disk_dir)}")
    print(f"on disk but NOT frozen         : {len(unfrozen)} {unfrozen if unfrozen else ''}")
    print(f"frozen but NOT on disk         : {len(phantom)} {phantom if phantom else ''}")
    print(f"byte-compared against {args.base}  : {checked}   <- positive coverage count")
    print(f"drifted                        : {len(drifted)}")
    for f, why in drifted:
        print(f"    {why:24} {f}")

    if checked == 0:
        die(2, "compared ZERO files - this run proved nothing")
    if unfrozen:
        die(1, f"{len(unfrozen)} file(s) under {EXHAUSTIVE}/ are not in the frozen keep-list; "
               "the replacement is free to change them and no gate would report it")
    if phantom:
        die(1, f"{len(phantom)} keep-list entr(ies) name a file that is not tracked")
    if drifted:
        die(1, f"{len(drifted)} file(s) drifted from {args.base} - D-01 says these are verbatim")

    print(f"\nOK - keep-list complete for {EXHAUSTIVE}/ and all {checked} files unchanged.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
