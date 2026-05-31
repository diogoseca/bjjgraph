#!/usr/bin/env python3
"""Shared URL/alias slug — the single slugify for the whole content pipeline.

Used by:
- regenerate_graph.py  (node keys + alias map)
- regenerate_md_from_json.py  (the `|slugify` Jinja filter + family hub URLs)
- regenerate_redirects.py  (alias 301 source paths)
- validate_json.py  (alias / disambiguation comparison keys)

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
