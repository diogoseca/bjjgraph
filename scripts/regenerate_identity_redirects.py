#!/usr/bin/env python3
"""Regenerate identity-retirement redirects from the archived source mappings.

The rest of the authored redirect file is preserved. Run this before the normal
build, whose regenerate_redirects.py carries these rules into public/_redirects.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "calibration/node_identity_retirements.json"
OUTPUT = ROOT / "source/quartz/static/_redirects"
START = "# BEGIN generated node identity retirements"
END = "# END generated node identity retirements"
LEGACY_START = "# v1.229.0 — IDENT2 retired identities and renamed entries."


def content_url(path: str) -> str:
    return "/" + Path(path).relative_to("content").with_suffix("").as_posix().replace(" ", "-")


def main() -> None:
    records = json.loads(ARCHIVE.read_text())["records"]
    rules = []
    seen = set()
    # More specific entry paths precede their family's wildcard.
    for record in sorted(records, key=lambda r: (-len(r["old_path"]), r["old_path"])):
        old_path, new_path = record["old_path"], record["replacement_path"]
        if (ROOT / old_path).exists() or not (ROOT / new_path).is_file():
            raise ValueError(f"Retirement must have an absent old source and a live replacement: {old_path}")
        old_url, new_url = content_url(old_path), content_url(new_path)
        for source in dict.fromkeys([old_url, old_url.lower()]):
            for origin, target in [(source + "/*", new_url + "/:splat"), (source, new_url)]:
                if origin in seen:
                    raise ValueError(f"Duplicate retirement redirect: {origin}")
                seen.add(origin)
                rules.append(f"{origin} {target} 301")
    block = "\n".join([
        START,
        "# Source: calibration/node_identity_retirements.json; retain old ordinals.",
        *rules,
        END,
    ])
    previous = OUTPUT.read_text()
    if START in previous:
        prefix, tail = previous.split(START, 1)
        _, suffix = tail.split(END, 1)
        result = prefix + block + suffix
    elif LEGACY_START in previous:
        result = previous.split(LEGACY_START, 1)[0] + block + "\n"
    else:
        result = previous.rstrip() + "\n\n" + block + "\n"
    OUTPUT.write_text(result)
    print(f"Regenerated {len(rules)} retirement redirects from {len(records)} archived records.")


if __name__ == "__main__":
    main()
