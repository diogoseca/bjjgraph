#!/usr/bin/env python3
"""Emit the manifest, install icons and Digital Asset Links AFTER the site engine.

Portable seam for both engines: python3 scripts/regenerate_pwa.py --output <site-root>.
Inputs live in pwa/ so manifest/DAL never acquire duplicate /static/ copies. PNGs
are checked in; render_pwa_icons.py is a maintainer tool, not a build dependency.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from _pwa import DEFAULT_OUTPUT, INPUT, PLACEHOLDER_PACKAGE, asset_links, icon_path, manifest, png_size


def emit(output: Path, release: bool = False) -> None:
    # Resolve and validate configuration and all inputs before writing any artifact.
    app = manifest()
    links = asset_links(release)
    icons = [(INPUT / "icons" / icon_path(i).name, icon_path(i), i["sizes"]) for i in app["icons"]]
    for source, _, sizes in icons:
        w, h = png_size(source)
        if f"{w}x{h}" != sizes:
            raise ValueError(f"Wrong dimensions for {source}: {w}x{h}, expected {sizes}")
    output.mkdir(parents=True, exist_ok=True)
    (output / ".well-known").mkdir(exist_ok=True)
    (output / "manifest.webmanifest").write_text(json.dumps(app, indent=2) + "\n")
    (output / ".well-known" / "assetlinks.json").write_text(json.dumps(links, indent=2) + "\n")
    for source, relative, _ in icons:
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    placeholder = links[0]["target"]["package_name"] == PLACEHOLDER_PACKAGE
    print(f"[pwa] emitted manifest + DAL + {len(icons)} icons to {output}")
    if placeholder:
        print("[pwa] PLACEHOLDER Android identity: web manifest ready, TWA ownership NOT verified")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--release", action="store_true", help="refuse placeholder Android identity")
    args = parser.parse_args()
    try:
        emit(args.output, args.release)
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"[pwa] ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
