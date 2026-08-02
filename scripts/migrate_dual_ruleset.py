#!/usr/bin/env python3
"""One-time mechanical migration to the dual gi/no-gi ruleset model (calibration-v2, Phase 2.1).

Wraps the three graph-edge probability fields in content JSON into mirrored
``{"gi": x, "nogi": x}`` maps, and relaxes the JSON-schema templates to accept
int OR map. gi == nogi everywhere — no semantic divergence yet (a later phase
introduces real per-ruleset differences). The migration is therefore LOSSLESS:
every reader reduces a mirror map back to the original scalar, so all generated
output (markdown, graph.json, the built site) stays byte-identical.

Migrated fields (path-precise — decision_tree probabilities and position_metrics
are NOT graph edges and are left alone):
  - Positions:               transitions[].attempt_probability  (root + top + bottom)
  - Transitions/Submissions: success_rate (root) and outcomes[].probability

Idempotent (re-running is a no-op) and atomic. Usage:
  python3 scripts/migrate_dual_ruleset.py --dry-run     # report, write nothing
  python3 scripts/migrate_dual_ruleset.py               # migrate content + patch schemas
  python3 scripts/migrate_dual_ruleset.py --content-only
  python3 scripts/migrate_dual_ruleset.py --schemas-only
  python3 scripts/migrate_dual_ruleset.py --check       # mirror invariant: every prob map has gi == nogi
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ruleset import RULESETS, is_ruleset_map
from _atomic_io import atomic_write_json

CONTENT = Path("content")
CATEGORY_DIRS = {
    "Positions": CONTENT / "Positions",
    "Transitions": CONTENT / "Transitions",
    "Submissions": CONTENT / "Submissions",
}

# Schema files that declare the migrated fields.
SCHEMA_FILES = [
    Path("templates/Positions/TEMPLATE-SINGLE.json"),
    Path("templates/Positions/TEMPLATE-DUAL.json"),
    Path("templates/Positions/TEMPLATE-FAMILY.json"),
    Path("templates/Transitions.json"),
    Path("templates/Transitions/TEMPLATE-DUAL.json"),
    Path("templates/Submissions.json"),
    Path("templates/Submissions/TEMPLATE-DUAL.json"),
    Path("templates/Submissions/TEMPLATE-FAMILY.json"),
]

PROB_FIELD_NAMES = {"attempt_probability", "probability", "success_rate"}

RULESET_PROP_SCHEMA = {
    "type": "object",
    "properties": {
        "gi": {"type": ["integer", "null"], "minimum": 0, "maximum": 100},
        "nogi": {"type": ["integer", "null"], "minimum": 0, "maximum": 100},
    },
    "required": ["gi", "nogi"],
    "additionalProperties": False,
}


# --------------------------------------------------------------------------- content

def mapify(v):
    """Scalar -> mirrored {gi, nogi} map; an existing map is returned unchanged (idempotent)."""
    if is_ruleset_map(v):
        return v
    if isinstance(v, (int, float)):
        return {"gi": v, "nogi": v}
    return v


def _mapify_transitions(arr):
    changed = False
    if isinstance(arr, list):
        for t in arr:
            if isinstance(t, dict) and "attempt_probability" in t:
                nv = mapify(t["attempt_probability"])
                if nv != t["attempt_probability"]:
                    t["attempt_probability"] = nv
                    changed = True
    return changed


def migrate_content_obj(data, category):
    """In-place migrate one content object. Returns True if anything changed."""
    if not isinstance(data, dict):
        return False
    changed = False
    if category == "Positions":
        if _mapify_transitions(data.get("transitions")):  # neutral positions
            changed = True
        for role in ("top", "bottom"):
            r = data.get(role)
            if isinstance(r, dict) and _mapify_transitions(r.get("transitions")):
                changed = True
    elif category in ("Transitions", "Submissions"):
        if "success_rate" in data:
            nv = mapify(data["success_rate"])
            if nv != data["success_rate"]:
                data["success_rate"] = nv
                changed = True
        if isinstance(data.get("outcomes"), list):
            for o in data["outcomes"]:
                if isinstance(o, dict) and "probability" in o:
                    nv = mapify(o["probability"])
                    if nv != o["probability"]:
                        o["probability"] = nv
                        changed = True
    return changed


# --------------------------------------------------------------------------- mirror check

def _divergent_maps(obj, path=""):
    """Yield (path, value) for every ruleset map whose gi != nogi (mirror-invariant violations)."""
    if is_ruleset_map(obj):
        if obj.get("gi") != obj.get("nogi"):
            yield path, obj
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _divergent_maps(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _divergent_maps(v, f"{path}[{i}]")


# --------------------------------------------------------------------------- schema

def patch_schema_obj(node):
    """Recursively relax prob fields under any 'properties' to oneOf[int, ruleset_map]. Returns changed."""
    changed = False
    if isinstance(node, dict):
        props = node.get("properties")
        if isinstance(props, dict):
            for fname, fschema in list(props.items()):
                if (
                    fname in PROB_FIELD_NAMES
                    and isinstance(fschema, dict)
                    and fschema.get("type") in ("integer", "number")
                    and "oneOf" not in fschema
                ):
                    desc = fschema.get("description")
                    int_branch = {k: v for k, v in fschema.items() if k != "description"}
                    new = {"oneOf": [int_branch, json.loads(json.dumps(RULESET_PROP_SCHEMA))]}
                    if desc:
                        new["description"] = desc
                    props[fname] = new
                    changed = True
        for v in node.values():
            if patch_schema_obj(v):
                changed = True
    elif isinstance(node, list):
        for v in node:
            if patch_schema_obj(v):
                changed = True
    return changed


# --------------------------------------------------------------------------- drivers

def run_content(dry_run, check):
    migrated = checked = violations = 0
    for category, d in CATEGORY_DIRS.items():
        for path in sorted(d.rglob("*.json")):
            try:
                data = json.load(open(path, encoding="utf-8"))
            except Exception as e:
                print(f"  SKIP {path}: {e}")
                continue
            if check:
                checked += 1
                divs = list(_divergent_maps(data))
                if divs:
                    violations += 1
                    for p, v in divs[:3]:
                        print(f"  DIVERGENT {path}{p}: {v}")
                continue
            before = json.dumps(data, sort_keys=True)
            migrate_content_obj(data, category)
            if json.dumps(data, sort_keys=True) != before:
                migrated += 1
                if dry_run:
                    print(f"  would migrate {path}")
                else:
                    atomic_write_json(path, data)
    if check:
        print(f"Mirror invariant: checked {checked} files, {violations} with divergent (gi!=nogi) maps")
        return violations
    print(f"Content: {'would migrate' if dry_run else 'migrated'} {migrated} file(s)")
    return migrated


def run_schemas(dry_run):
    patched = 0
    for path in SCHEMA_FILES:
        if not path.exists():
            print(f"  SKIP (missing) {path}")
            continue
        schema = json.load(open(path, encoding="utf-8"))
        if patch_schema_obj(schema):
            patched += 1
            if dry_run:
                print(f"  would patch {path}")
            else:
                atomic_write_json(path, schema)
    print(f"Schemas: {'would patch' if dry_run else 'patched'} {patched} file(s)")
    return patched


def main():
    ap = argparse.ArgumentParser(description="Migrate content + schemas to the dual gi/no-gi ruleset model")
    ap.add_argument("--dry-run", action="store_true", help="Report what would change; write nothing")
    ap.add_argument("--check", action="store_true", help="Mirror invariant: verify every prob map has gi == nogi")
    ap.add_argument("--content-only", action="store_true")
    ap.add_argument("--schemas-only", action="store_true")
    args = ap.parse_args()

    if args.check:
        sys.exit(1 if run_content(dry_run=False, check=True) else 0)

    if not args.schemas_only:
        run_content(dry_run=args.dry_run, check=False)
    if not args.content_only:
        run_schemas(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
