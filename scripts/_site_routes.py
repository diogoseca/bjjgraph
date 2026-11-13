#!/usr/bin/env python3
"""The site's own routes, for analytics rows that come from outside (v1.265.1).

WHY. PostHog's `$current_url` is whatever a browser sent with the site's public project key, so anyone can record a
pageview whose "URL" is a paragraph of instructions. Two scheduled jobs hand these rows to a model
(analytics-content-improvement.yml through fetch_posthog_analytics.py, seo-monitor.yml through
fetch_posthog_search.py). Their prefetch steps, which run no model, now keep a row only when its URL path names one of
OUR pages, and write OUR canonical path for it, never the visitor's string. The model then reads no byte a visitor
wrote: not the host, not the query string, not the fragment, not a look-alike spelling of the path. A URL longer than
MAX_URL_CHARS is dropped unread, a value that is not a number is dropped, and the kept and dropped counts are printed on
every run, so a filter that matched nothing never reads like a clean one.

THE KEY. `route_key` is bot_run.py's selection key (it imports this one, so selection and sanitising cannot drift):
the URL path, percent-decoded, without slashes at either end or `.html`, spaces as hyphens, lower-cased. The host is
not part of it, exactly as in selection; what reaches the model is the canonical path alone.

THE ROUTES. Every page under content/: each JSON source and each Markdown page (generated role pages included,
since they are files), at the path Quartz builds it, `_slug.quartz_page_path` (the one Python copy of Quartz's
`sluggify`, pinned to path.ts by tests/redirect_targets_test.py), so `100% Sweep` is `/Transitions/100-percent-Sweep`.
`index` pages answer for their folder and the home page is `/`. Dot-folders (the Obsidian vault) are not pages.
Measured against a full build: every route is a served page (tests/bot_inputs_test.py pins the `%` page by name).

Pinned by tests/bot_inputs_test.py, which plants one marker in every visitor-written field and requires that it
never reaches the written file.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote, urlsplit

from _slug import quartz_page_path

MAX_URL_CHARS = 2048


def route_key(path: str) -> str:
    """bot_run.py's selection key for a URL path (see the module docstring)."""
    return unquote(path).strip("/").removesuffix(".html").replace(" ", "-").lower()


def route_index(content: Path = Path("content")) -> dict[str, str]:
    """route_key -> canonical site path, for every page under `content`."""
    routes: dict[str, str] = {}

    def add(stem: str) -> None:
        if stem == "index":
            routes[""] = "/"
            return
        canonical = "/" + quartz_page_path(stem)
        routes.setdefault(route_key(canonical), canonical)
        if stem.endswith("/index"):
            folder = stem.removesuffix("/index")
            routes.setdefault(route_key(folder), "/" + quartz_page_path(folder) + "/")

    for path in sorted(content.rglob("*")):
        if path.suffix not in (".json", ".md") or not path.is_file():
            continue
        relative = path.relative_to(content)
        if any(part.startswith(".") for part in relative.parts):
            continue
        add(relative.with_suffix("").as_posix())
    return routes


def site_path(url: object, routes: dict[str, str]) -> str | None:
    """The canonical path of one of our pages, or None: never any part of `url` itself."""
    if not isinstance(url, str) or len(url) > MAX_URL_CHARS:
        return None
    try:
        path = urlsplit(url).path
    except ValueError:
        return None
    return routes.get(route_key(path))


def clean_rows(rows: object, routes: dict[str, str]) -> tuple[list[list], int]:
    """HogQL `[url, number]` rows -> `[canonical path, number]` rows, in order, and how many were dropped."""
    if not isinstance(rows, list):
        return [], 0 if rows is None else 1
    kept: list[list] = []
    dropped = 0
    for row in rows:
        if not (isinstance(row, list) and len(row) == 2):
            dropped += 1
            continue
        url, value = row
        path = site_path(url, routes)
        if path is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            dropped += 1
            continue
        kept.append([path, value])
    return kept, dropped
