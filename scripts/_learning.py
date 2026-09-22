"""Shared reading links for Learning's app dossier and static fallback."""
import json

from _slug import slugify


READING_FOLDERS = {"Principle": "Principles", "Learning": "Learning", "System": "Systems"}


def reading_index(content_root, page_slug):
    """Resolve typed canonical names and page paths to actual source files."""
    index = {}
    for cat, folder in READING_FOLDERS.items():
        for path in sorted((content_root / folder).rglob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            name = data.get("name") or path.stem
            relative = path.relative_to(content_root).with_suffix("")
            page = "/".join(page_slug(part) for part in relative.parts)
            title = ((data.get("guide") or {}).get("display_title") if cat == "System"
                     else data.get("display_title")) or name
            entry = {"id": page, "cat": cat, "title": title, "url": "/" + page}
            for spelling in (name, str(relative), page):
                key = (cat, slugify(spelling))
                if key in index and index[key]["id"] != page:
                    raise ValueError(f"Ambiguous {cat} reading reference: {spelling!r}")
                index[key] = entry
    return index


def related_readings(data, index):
    """Return complete resolved links and misses; never invent a destination URL."""
    readings, unresolved, seen = [], [], set()
    for item in data.get("related_content") or []:
        cat, name = item.get("content_type"), (item.get("name") or "").strip()
        if cat not in READING_FOLDERS or not name:
            continue
        found = index.get((cat, slugify(name)))
        if found:
            if found["id"] not in seen:
                readings.append(dict(found))
                seen.add(found["id"])
        elif name not in unresolved:
            unresolved.append(name)
    return readings, unresolved
