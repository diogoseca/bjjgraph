#!/usr/bin/env python3
"""remap_layout_ids.py — Coordinate-preserving id/link remap for globalGraphLayout.json.

WHY THIS EXISTS
---------------
`source/quartz/static/globalGraphLayout.json` shipped with 130 all-lowercase node
ids (out of 1541). Two bugs in `regenerate_graph_layout.py` produced them:

  Bug #1 (build_canonical_map, nested-path):  110 real-but-unmapped nodes. The
  canonical map keyed each disk file by a space-joined folder path instead of the
  bare JSON `name` slug that graph.json actually uses, so compound
  `positions/<parent>/<child>` ids (and 3 family-nested submissions) never matched
  the map and leaked out lowercase.

  Bug #2 (transition-outcome handler, hard-coded `positions/`):  20 true phantoms.
  Every `outcome.to` was force-prefixed `positions/`, so submission-typed targets
  became phantom `positions/<slug>` nodes — DUPLICATES of the real
  `Submissions/...` node the submissions-loop already emitted.

The layout is NON-deterministic (unseeded node2vec + multi-worker Word2Vec), so
re-running `regenerate:graph-layout` would scramble every (x, y). This script is a
surgical, COORDINATE-PRESERVING id-remap instead:

  * 110 real lowercase ids  -> renamed to their canonical mixed-case URL. Same node,
    x/y byte-identical (only the `id` string changes).
  * 20 phantom `positions/<sub>` nodes -> DROPPED; their links retargeted onto the
    already-present canonical `Submissions/...` node (same technique, same strength).
    Node count therefore drops by the number of phantoms whose real twin already
    exists in the layout.

Because we load → mutate only id/source/target strings → dump with the file's own
`separators=(",", ":")`, every untouched float is reproduced byte-for-byte (verified
round-trip identical), so no coordinate can drift.

Idempotent: re-running finds zero lowercase ids and makes no changes.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _slug import slugify  # shared single-source-of-truth slugify

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GRAPH_JSON = PROJECT_ROOT / "graph.json"
CONTENT_DIR = PROJECT_ROOT / "content"
LAYOUT_FILE = PROJECT_ROOT / "source" / "quartz" / "static" / "globalGraphLayout.json"

CATEGORIES = ("Positions", "Transitions", "Submissions")
ROLE_LEAVES = ("Top", "Bottom", "Attacker", "Defender")
LOWER_PREFIX_RE = re.compile(r"^(positions|transitions|submissions)/")


def build_canonical_map() -> dict[str, str]:
    """Map lowercase-slug key -> canonical case-preserving Quartz URL slug.

    Patch B logic. graph.json keys positions/transitions/submissions off each
    entry's JSON `name` field (bare-name slug, e.g. `crackhead-control`,
    `loop-choke-from-closed-guard`), while the layout's positions-loop emits a
    compound `<cat>/<parenthub>/<child>` id derived from the position `path`. So we
    register BOTH keys per source file, each pointing at the same disk-derived URL:

      - name-slug key   `<cat>/<slug(name)>`            (transitions/submissions loops)
      - compound key    `<cat>/<slug(part)/slug(part)>` (positions loop, from `path`)

    URL = disk relative path with spaces->hyphens per segment, case preserved.
    """
    canonical: dict[str, str] = {}
    for category in CATEGORIES:
        cat_dir = CONTENT_DIR / category
        if not cat_dir.exists():
            continue
        cat = category.lower()
        for jf in sorted(cat_dir.rglob("*.json")):
            rel = jf.relative_to(CONTENT_DIR).with_suffix("")
            parts = str(rel).split("/")
            # Skip role pages — they are not hubs and never appear as layout nodes.
            if parts[-1] in ROLE_LEAVES:
                continue
            canonical_url = "/".join(p.replace(" ", "-") for p in parts)
            # graph.json's key is the JSON `name` slug (NOT the filename tail — a
            # family-nested file `Loop Choke/from Closed Guard.json` carries
            # name="Loop Choke from Closed Guard").
            try:
                name = json.load(jf.open()).get("name", "")
            except (OSError, json.JSONDecodeError):
                name = ""
            name_slug = slugify(name) if name else slugify(parts[-1])
            compound = "/".join(slugify(p) for p in parts[1:])
            canonical[f"{cat}/{name_slug}"] = canonical_url
            canonical[f"{cat}/{compound}"] = canonical_url
    return canonical


def build_submission_transition_bases() -> tuple[set[str], set[str]]:
    """Return (submission-hub-bases, transition-hub-bases) as lowercase slugs.

    Used by Patch A: a lowercase `positions/<slug>` id whose slug is really a
    submission (or transition) hub is a phantom to retarget, not a position.
    """
    with GRAPH_JSON.open() as f:
        graph = json.load(f)

    def bases(section: str) -> set[str]:
        out: set[str] = set()
        for k in graph.get(section) or {}:
            base = k
            for suf in ("/attacker", "/defender"):
                if base.endswith(suf):
                    base = base[: -len(suf)]
                    break
            out.add(base.lower())
        return out

    return bases("submissions"), bases("transitions")


def main() -> None:
    if not LAYOUT_FILE.exists():
        print(f"ERROR: {LAYOUT_FILE} not found.", file=sys.stderr)
        sys.exit(1)
    if not GRAPH_JSON.exists():
        print(f"ERROR: {GRAPH_JSON} not found.", file=sys.stderr)
        sys.exit(1)

    with LAYOUT_FILE.open() as f:
        layout = json.load(f)

    canonical = build_canonical_map()
    sub_bases, tra_bases = build_submission_transition_bases()

    present_ids = {n["id"] for n in layout["nodes"]}

    # ------------------------------------------------------------------
    # Build the id-remap dict, classifying every lowercase-prefixed node.
    #   renamed:   real node, lowercase key -> canonical mixed-case URL (x/y kept)
    #   dropped:   phantom positions/<sub|tra> whose real twin already exists ->
    #              node removed, its id aliased to the real node's id for links
    #   unresolved: could not classify (must be zero for a safe ship)
    # ------------------------------------------------------------------
    id_remap: dict[str, str] = {}   # old id -> new/canonical id (rename or alias)
    dropped_ids: set[str] = set()   # phantom node ids to delete from nodes[]
    unresolved: list[str] = []
    rename_examples: list[tuple[str, str]] = []

    for old in sorted(n["id"] for n in layout["nodes"]):
        if not LOWER_PREFIX_RE.match(old):
            continue  # already canonical mixed-case

        if old in canonical:
            # Bug #1: real node — rename to canonical URL, coordinates untouched.
            new = canonical[old]
            id_remap[old] = new
            if len(rename_examples) < 6:
                rename_examples.append((old, new))
            continue

        # Bug #2 candidate: lowercase positions/<slug> that is really a submission
        # or transition. Retarget to the canonical technique node.
        cat, rest = old.split("/", 1)
        target_key = None
        if rest in sub_bases:
            target_key = f"submissions/{rest}"
        elif rest in tra_bases:
            target_key = f"transitions/{rest}"

        target_canonical = canonical.get(target_key) if target_key else None
        if not target_canonical:
            unresolved.append(old)
            continue

        # Bug #2 phantom: retarget onto the real technique node (its twin already
        # exists in every current case; if it somehow didn't we still rename into it
        # to avoid a dangling link — the collision pass below then keeps this node).
        id_remap[old] = target_canonical

    if unresolved:
        print("ERROR: could not resolve these lowercase ids — refusing to ship:", file=sys.stderr)
        for u in unresolved:
            print(f"  {u}", file=sys.stderr)
        sys.exit(2)

    # ------------------------------------------------------------------
    # Collapse DUPLICATE nodes. After id_remap, several source nodes can land on the
    # same final id — three signatures, all genuine duplicates of one entity:
    #   * a lowercase node renamed onto an already-correct mixed-case node
    #     (20 submission phantoms → their real Submissions/... twin),
    #   * two lowercase nodes renamed onto the SAME canonical id
    #     (53 nested-position bare/compound pairs, e.g. positions/rear-triangle +
    #      positions/triangle-control/rear-triangle → Positions/Triangle-Control/Rear-Triangle).
    # For each colliding final id we keep exactly ONE survivor (first in file order)
    # and drop the rest, aliasing the dropped ids to the survivor's id so links route
    # onto the kept node. The survivor's x/y are untouched; the dropped twins' coords
    # are discarded (they are a second embedding of the same node).
    # ------------------------------------------------------------------
    def final_id(node_id: str) -> str:
        return id_remap.get(node_id, node_id)

    claimed: dict[str, str] = {}   # final id -> the original id of its chosen survivor
    for node in layout["nodes"]:
        fid = final_id(node["id"])
        if fid not in claimed:
            claimed[fid] = node["id"]  # first occurrence in file order wins

    # Any node whose final id is already claimed by a different survivor is a dropped
    # duplicate; alias it to whatever the survivor's id will be.
    alias: dict[str, str] = {}     # dropped original id -> survivor original id
    for node in layout["nodes"]:
        oid = node["id"]
        fid = final_id(oid)
        survivor = claimed[fid]
        if survivor != oid:
            dropped_ids.add(oid)
            alias[oid] = survivor

    # Compose the full link-rewrite map: an id is rewritten to its survivor's final id
    # (dropped dupes → survivor final id; survivors/others → their own final id).
    def resolve(node_id: str) -> str:
        survivor = alias.get(node_id, node_id)
        return final_id(survivor)

    # ------------------------------------------------------------------
    # Apply: rewrite nodes[].id (dropping duplicate twins), rewrite links.
    # Untouched fields (x, y, s, t, ...) are reproduced verbatim by json.dumps.
    # ------------------------------------------------------------------
    new_nodes = []
    for node in layout["nodes"]:
        old = node["id"]
        if old in dropped_ids:
            continue  # duplicate twin — its edges retarget onto the survivor
        node["id"] = final_id(old)
        new_nodes.append(node)

    # A "rename" = a lowercase source id kept as a node (not dropped) whose id changed.
    renamed_count = sum(1 for k in id_remap if k not in dropped_ids)
    dropped_count = len(dropped_ids)

    # Rewrite + dedup links. A retargeted link may now duplicate an existing edge or
    # become a self-loop (phantom and twin shared a neighbor) — drop those.
    retargeted_links = 0
    seen: set[tuple[str, str]] = set()
    new_links = []
    for link in layout["links"]:
        s_old, t_old = link["source"], link["target"]
        s_new = resolve(s_old)
        t_new = resolve(t_old)
        if s_new != s_old or t_new != t_old:
            retargeted_links += 1
        if s_new == t_new:
            continue  # self-loop created by collapse — drop
        key = (s_new, t_new)
        if key in seen:
            continue  # duplicate edge created by collapse — dedup
        seen.add(key)
        link["source"], link["target"] = s_new, t_new
        new_links.append(link)

    layout["nodes"] = new_nodes
    layout["links"] = new_links

    remaining_lower = sum(1 for n in new_nodes if LOWER_PREFIX_RE.match(n["id"]))

    with LAYOUT_FILE.open("w") as f:
        json.dump(layout, f, separators=(",", ":"))

    # ------------------------------------------------------------------
    print("[remap_layout_ids] Summary")
    print(f"  nodes renamed (lowercase -> canonical) : {renamed_count}")
    print(f"  phantoms dropped (collapsed onto twin)  : {dropped_count}")
    print(f"  links retargeted                        : {retargeted_links}")
    print(f"  final node count                        : {len(new_nodes)}")
    print(f"  final link count                        : {len(new_links)}")
    print(f"  remaining lowercase-prefixed ids        : {remaining_lower}")
    if rename_examples:
        print("  example renames:")
        for old, new in rename_examples:
            print(f"    {old}  ->  {new}")


if __name__ == "__main__":
    main()
