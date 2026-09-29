"""Additive per-system delivery. The legacy response is never modified here."""
import gzip
import hashlib
import json
from pathlib import Path
from _atomic_io import atomic_write_text

# THE LEGACY FULL LIBRARY IS RETIRED FROM THE SERVED TREE (v1.207.0, owner ruling 2026-09-29).
# Current apps read `systems-index.json` plus one per-system record on demand; only a tab still
# running a bundle from before the demand route ever fetched the whole library, and the owner
# accepted that such a tab loses its Systems panel until it reloads. The full library remains
# the BUILD-INTERNAL source: the affiliate stamper resolves its links and regenerates the index
# and records from it, and the validators read it. It lives here, outside `static/`, so no
# emit, build or copy can serve it (served, it was 376,491 B of the 500,000 B deferred cap).
SYSTEMS_SOURCE = Path(__file__).resolve().parent.parent / 'source/quartz/.neural-internal/systems.json'

INDEX_FIELDS = ('id', 'name', 'display_title', 'aliases', 'type', 'difficulty')

def systems_demand_parts(original):
    rows, records, seen = [], {}, set()
    for system in original['systems']:
        sid = system['id']
        if not isinstance(sid, str) or not sid or sid in seen:
            raise ValueError('duplicate-or-invalid-system-id')
        seen.add(sid)
        data = json.dumps(system, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        if len(data) > 40000:
            raise ValueError('system-record-chunk-budget:' + sid)
        digest = hashlib.sha256(data).hexdigest()
        records[digest] = data
        row = {key: system[key] for key in INDEX_FIELDS if key in system}
        if 'products' in system:
            row['products'] = [{key: p[key] for key in ('name', 'instructor') if key in p}
                               for p in system['products']]
        row['detailHash'] = digest
        rows.append(row)
    index = {'version': 1, '_meta': original['_meta'], 'systems': rows}
    return index, records

def write_systems_demand(out_dir, original):
    out_dir = Path(out_dir)
    index, records = systems_demand_parts(original)
    folder = out_dir / 'content' / 'system-records'
    folder.mkdir(parents=True, exist_ok=True)
    for digest, data in records.items():
        path = folder / (digest + '.json')
        if path.exists() and path.read_bytes() != data:
            raise ValueError('system-record-hash-collision')
        if not path.exists():
            atomic_write_text(path, data.decode("utf-8"))
    # Publish index only after every referenced immutable record exists. Retain old records.
    text = json.dumps(index, ensure_ascii=False, separators=(',', ':'))
    atomic_write_text(out_dir / 'systems-index.json', text)
    compressed = out_dir / 'systems-index.json.gz'
    if compressed.is_file():
        compressed.write_bytes(gzip.compress(text.encode('utf-8'), mtime=0))
    return index, records
