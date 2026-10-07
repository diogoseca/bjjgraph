#!/usr/bin/env python3
"""Check emitted PWA assets, actual rendered head links and deploy-root headers.

Run after the full build (both explicit deploy chains do too). --output is portable
across site engines. --release additionally refuses the unsigned example identity.
This does not claim offline support, browser install eligibility or live DAL success.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from _pwa import DEFAULT_OUTPUT, INPUT, ROOT, asset_links, icon_path, manifest, png_size
from check_headers_cache import matches, parse

# Root, deep content and the shared 404 use different Head path resolution branches.
PAGES = {"index.html": "/", "Positions/Mount/Top.html": "/Positions/Mount/Top", "404.html": "/missing/deep/path"}


class Head(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inside = False
        self.tags: list[tuple[str, dict]] = []

    def handle_starttag(self, tag, attrs):
        if tag == "head":
            self.inside = True
        if self.inside:
            self.tags.append((tag, dict(attrs)))

    def handle_endtag(self, tag):
        if tag == "head":
            self.inside = False


def check(output: Path, release: bool = False) -> None:
    app = json.loads((output / "manifest.webmanifest").read_text())
    if app != manifest():
        raise ValueError("Emitted manifest differs from pwa/manifest.json")
    for key, value in {"id": "/", "start_url": "/", "scope": "/", "display": "standalone"}.items():
        if app.get(key) != value:
            raise ValueError(f"Manifest {key} must be {value!r}")
    if not app.get("name") or not app.get("short_name"):
        raise ValueError("Manifest needs name and short_name")
    helmet = (ROOT / "neural/src/helmet.html").read_text()
    if app["theme_color"] != app["background_color"] or f'background:{app["background_color"]}' not in helmet:
        raise ValueError("Manifest theme/background must match the Neural app background")
    if not {("192x192", "any"), ("512x512", "any"), ("512x512", "maskable")} <= {
        (i["sizes"], i.get("purpose", "any")) for i in app["icons"]
    }:
        raise ValueError("Manifest needs 192/512 any icons and a separate 512 maskable icon")
    for icon in app["icons"]:
        relative = icon_path(icon)
        path = output / relative
        w, h = png_size(path)
        if f"{w}x{h}" != icon["sizes"] or icon["type"] != "image/png":
            raise ValueError(f"Wrong icon dimensions/type: {relative}")
        if path.read_bytes() != (INPUT / "icons" / relative.name).read_bytes():
            raise ValueError(f"Stale or altered install icon: {relative}")
    if json.loads((output / ".well-known/assetlinks.json").read_text()) != asset_links(release):
        raise ValueError("Emitted DAL does not match the configured Android identity")
    for relative, route in PAGES.items():
        head = Head()
        head.feed((output / relative).read_text())
        for rel, expected in [("manifest", "/manifest.webmanifest"), ("apple-touch-icon", "/static/pwa/icon-192.png")]:
            urls = [a.get("href", "") for tag, a in head.tags if tag == "link" and a.get("rel") == rel]
            if len(urls) != 1 or urlsplit(urljoin("https://bjjgraph.org" + route, urls[0])).path != expected:
                raise ValueError(f"{relative}: missing/incorrect {rel} link: {urls}")
            if urlsplit(urljoin("https://bjjgraph.org" + route, urls[0])).netloc != "bjjgraph.org":
                raise ValueError(f"{relative}: cross-origin {rel} link")
        themes = [a.get("content") for tag, a in head.tags if tag == "meta" and a.get("name") == "theme-color"]
        if themes != [app["theme_color"]]:
            raise ValueError(f"{relative}: missing/incorrect theme-color: {themes}")
    blocks = parse(output / "_headers")
    for route, mime in [("/manifest.webmanifest", "application/manifest+json"), ("/.well-known/assetlinks.json", "application/json")]:
        headers: dict[str, list[str]] = {}
        for pattern, lines in blocks:
            if matches(pattern, route):
                for line in lines:
                    name, value = line.split(":", 1)
                    headers.setdefault(name.lower(), []).append(value.strip())
        if headers.get("content-type") != [mime + "; charset=utf-8"]:
            raise ValueError(f"{route}: missing or overlapping Content-Type")
        if headers.get("cache-control") != ["public, max-age=0, must-revalidate"]:
            raise ValueError(f"{route}: missing or overlapping revalidation Cache-Control")
    print(f"[pwa] OK: manifest, configured DAL, {len(app['icons'])} icons, {len(PAGES)} rendered heads, 2 header routes")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--release", action="store_true", help="refuse placeholder Android identity")
    args = parser.parse_args()
    try:
        check(args.output, args.release)
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"[pwa] ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
