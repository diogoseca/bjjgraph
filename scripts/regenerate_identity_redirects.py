#!/usr/bin/env python3
"""Regenerate identity-retirement redirects from the archived source mappings.

The rest of the authored redirect file is preserved. Run this before the normal
build, whose regenerate_redirects.py carries these rules into public/_redirects.
"""

import json
from pathlib import Path

from _slug import quartz_page_path, slugify

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "calibration/node_identity_retirements.json"
OUTPUT = ROOT / "source/quartz/static/_redirects"
START = "# BEGIN generated node identity retirements"
END = "# END generated node identity retirements"
LEGACY_START = "# v1.229.0 — IDENT2 retired identities and renamed entries."


def content_url(path: str) -> str:
    return "/" + quartz_page_path(Path(path).relative_to("content").with_suffix("").as_posix())


def retirement_rules(records: list[dict], root: Path = ROOT) -> list[str]:
    """Keep canonical routes and every alias in the archived, previously published source.

    Alias sources use the old canonical parent, just as regenerate_redirects.py did
    when the record was live. They remain redirects even when the active copy drops
    an obsolete identity. D-345's DLR alias was lost by considering old_path alone.
    """
    rules = []
    seen = {}

    def add(origin: str, target: str) -> None:
        if origin in seen:
            if seen[origin] != target:
                raise ValueError(f"Conflicting retirement redirect: {origin}")
            return
        seen[origin] = target
        rules.append(f"{origin} {target} 301")

    # More specific entry paths precede their family's wildcard.
    for record in sorted(records, key=lambda r: (-len(r["old_path"]), r["old_path"])):
        old_path, new_path = record["old_path"], record["replacement_path"]
        if (root / old_path).exists() or not (root / new_path).is_file():
            raise ValueError(f"Retirement must have an absent old source and a live replacement: {old_path}")
        old_url, new_url = content_url(old_path), content_url(new_path)
        # Navigation retirements can cross from action roles (Attacker/Defender)
        # to position roles (Top/Bottom), or end at a family without role pages.
        # Those descendants resolve to the surviving hub, not a nonexistent role.
        replacement = json.loads((root / new_path).read_text())
        same_roles = ((Path(old_path).parts[1] == "Positions") ==
                      (Path(new_path).parts[1] == "Positions"))
        descendants = new_url + "/:splat" if same_roles and not replacement.get("is_family") else new_url
        for source in dict.fromkeys([old_url, old_url.lower()]):
            for origin, target in [(source + "/*", descendants), (source, new_url)]:
                add(origin, target)
        parent = old_url.rsplit("/", 1)[0]
        aliases = record["source"].get("aliases") or []
        if not isinstance(aliases, list):
            raise ValueError(f"Archived aliases must be an array: {old_path}")
        for alias in aliases:
            if not isinstance(alias, str) or not alias.strip():
                raise ValueError(f"Invalid archived alias in {old_path}: {alias!r}")
            alias_slug = slugify(alias)
            if alias_slug:
                add(f"{parent}/{alias_slug}".lower(), new_url)
    return rules


def main() -> None:
    records = json.loads(ARCHIVE.read_text())["records"]
    rules = retirement_rules(records)
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
