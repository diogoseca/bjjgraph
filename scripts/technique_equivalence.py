"""Conservative identity proof for reference rewrites, shared by audit and fixer."""
import json
from pathlib import Path


def technique_index():
    index = {}
    for category in ("Transitions", "Submissions"):
        for path in sorted(Path("content", category).rglob("*.json")):
            data = json.loads(path.read_text())
            entry = {"file": str(path), "data": data}
            for name in [data.get("name", path.stem), *data.get("aliases", [])]:
                if not isinstance(name, str):
                    continue
                if name in index and index[name] != entry:
                    index[name] = None  # Ambiguity is not evidence of identity.
                else:
                    index[name] = entry
    return index


def equivalence(generic, specific, index=None):
    index = technique_index() if index is None else index
    left, right = index.get(generic), index.get(specific)
    if not left or not right:
        return None
    if left["file"] == right["file"]:
        return "alias resolves to the same authored technique"
    # An aggregator may be replaced by one of its authored variants. A separate
    # navigable technique with outcomes keeps its reference, even if names overlap.
    if (left["data"].get("is_family") is True and not left["data"].get("outcomes")
            and Path(right["file"]).parent == Path(left["file"]).with_suffix("")):
        return "declared family hub and its authored variant"
    return None
