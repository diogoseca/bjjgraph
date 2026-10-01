#!/usr/bin/env python3
"""Shared URL/alias slug — the single slugify for the whole content pipeline.

Used by:
- regenerate_graph.py  (node keys + alias map)
- regenerate_md_from_json.py  (the `|slugify` Jinja filter + family hub URLs)
- regenerate_redirects.py  (alias 301 source paths)
- validate_json.py  (alias / disambiguation comparison keys)

and `quartz_page_path` below, the ONE copy of Quartz's page-path rule, by regenerate_graph.py
(`targetPath`, re-exported as `quartz_slug` for its importers), regenerate_explorer_tree.py and
regenerate_md_from_json.py (hrefs). Until v1.216.1 each of those three carried its own copy.

Before this module existed there were THREE divergent slugify functions: the
graph's kept accents (Unicode `\\w`), the md/redirects pair transliterated them,
and validate_json's `_normalize_alias_key` did neither. That meant an accented
synonym ("Mata Leão") could slug three different ways and fail to resolve. This
function is the single source of truth.

Behavior: NFKD-transliterate accents to ASCII (Leão -> leao), expand `%`/`&` to
readable words, drop apostrophes, strip remaining punctuation, kebab-case.

Verified byte-identical to the previous regenerate_graph.slugify across all 1887
current content names, so adopting it changed zero existing graph node keys.
"""

from __future__ import annotations

import re
import unicodedata


# QUARTZ'S PAGE PATH (v1.212.7, OCREDIR1). `slugify` above makes lowercase KEYS. A built page's
# PATH is a different rule, Quartz's own `sluggify` (source/quartz/util/path.ts): case kept, and
# per segment, whitespace -> "-", "&" -> "-and-", "%" -> "-percent", "?" and "#" dropped. Writing
# only the space rule made `/transitions/100%-sweep /Transitions/100%-Sweep 301`. Cloudflare's
# edge answers a raw "%" with 400, so that rule never fired, and the lowercase of the real page,
# /transitions/100-percent-sweep, had no rule at all and 404'd. The app's twin is `_pageSlug`
# (neural/src/app.src.jsx). tests/redirect_targets_test.py reads path.ts and pins this table to it.
QUARTZ_SLUG_REPLACEMENTS = ((r"\s", "-"), (r"&", "-and-"), (r"%", "-percent"), (r"\?", ""), (r"#", ""))


def quartz_page_path(rel: str) -> str:
    """A content path ("Transitions/100% Sweep", no extension) -> the path Quartz builds its page at."""
    segments = []
    for seg in str(rel).split("/"):
        for pattern, repl in QUARTZ_SLUG_REPLACEMENTS:
            seg = re.sub(pattern, repl, seg)
        segments.append(seg)
    return "/".join(segments).rstrip("/")


def slugify(name: str) -> str:
    """Convert a display name to a lowercase ASCII kebab-case slug."""
    if not isinstance(name, str):
        return ""
    # NFKD-decompose then drop combining marks: ã->a, é->e, ç->c
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    s = s.lower().strip()
    s = s.replace("%", " percent ").replace("&", " and ")
    s = s.replace("'", "").replace("`", "")
    # Remove any remaining punctuation (slashes, quotes, etc.); keep spaces/hyphens
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s
