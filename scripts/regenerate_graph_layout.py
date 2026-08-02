#!/usr/bin/env python3
"""
regenerate_graph_layout.py — Compute organic 2D node positions for the background graph.

Pipeline:
  1. Load graph.json → build NetworkX graph of position/transition/submission hubs.
  2. Run node2vec to embed each node into a high-dim vector (random walks capture
     local + global structure).
  3. Reduce embeddings to 2D via UMAP.
  4. Write source/quartz/static/globalGraphLayout.json (Quartz copies static assets
     to public/ during build).

Output schema matches what backgroundGraph.inline.ts expects:
  {
    "nodes": [{"id": "...", "x": float, "y": float, "t": "...", "tags": []}],
    "links": [{"source": "...", "target": "..."}]
  }

Why this beats the previous D3 force layout:
  Force simulation with uniform parameters on a sparse, scale-free graph creates
  visible concentric rings. node2vec + UMAP captures community structure naturally
  — closely related nodes cluster, hubs anchor regions, and there are no rings.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Resolve project root regardless of where the script is invoked from
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GRAPH_JSON = PROJECT_ROOT / "graph.json"
OUTPUT_DIR = PROJECT_ROOT / "source" / "quartz" / "static"
OUTPUT_FILE = OUTPUT_DIR / "globalGraphLayout.json"

# Tunable knobs — sane defaults for ~1.5K node graph
EMBED_DIM = 64
WALK_LENGTH = 30
NUM_WALKS = 200
P_RETURN = 1.0  # node2vec return parameter (1.0 = neutral)
Q_INOUT = 0.5  # node2vec in-out parameter (<1 = DFS-like, encourages community discovery)
# WORKERS = 1 (not 4): gensim Word2Vec is only reproducible single-threaded — multi-worker
# training accumulates float updates in nondeterministic thread order. Combined with SEED
# below (node2vec's random-walk RNG) and UMAP's random_state=42, a from-scratch (`--fresh`)
# run is now deterministic. The one-thread cost is acceptable for a ~1.5K-node graph.
WORKERS = 1
SEED = 42  # node2vec walk RNG seed → reproducible walks (Node2Vec.__init__ accepts seed=)

UMAP_NEIGHBORS = 15
UMAP_MIN_DIST = 0.3
UMAP_METRIC = "cosine"

# Final coordinate scaling (target viewport ~1500x1000 to fit naturally in PixiJS)
COORD_SCALE = 800.0

ALLOWED_PREFIXES = ("positions/", "transitions/", "submissions/")
ROLE_SUFFIXES = ("/bottom", "/top", "/attacker", "/defender")
CATEGORY_HUBS = {"positions", "transitions", "submissions", "systems", "principles", "learning"}


def fail(msg: str, code: int = 1) -> None:
    print(f"[regenerate_graph_layout] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def is_hub_node(slug: str) -> bool:
    lower = slug.lower()
    if not any(lower.startswith(p) for p in ALLOWED_PREFIXES):
        return False
    if any(lower.endswith(s) for s in ROLE_SUFFIXES):
        return False
    if lower in CATEGORY_HUBS:
        return False
    return True


def hub_slug(slug: str) -> str:
    """Strip role suffix to get the hub slug."""
    lower = slug.lower()
    if any(lower.endswith(s) for s in ROLE_SUFFIXES):
        return "/".join(slug.split("/")[:-1])
    return slug


def _slugify_name(name: str) -> str:
    """Mirror scripts/regenerate_graph.py's slugify() so lookup keys match graph.json keys."""
    slug = name.lower().strip()
    slug = slug.replace('%', ' percent ')
    slug = slug.replace('&', ' and ')
    slug = slug.replace("'", '')
    slug = slug.replace('"', '')
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def build_canonical_map() -> dict[str, str]:
    """Walk content/ to map lowercase-slug → mixed-case-canonical URL slug.

    graph.json's node ids look like 'submissions/loop-choke-from-mount' (slugified
    from the entry's name field). Quartz emits the page at the case-preserving
    path derived from the file path on disk (e.g. content/Submissions/Loop Choke/
    from Mount.md → /Submissions/Loop-Choke/from-Mount). We reconstruct the
    slug-style key by joining nested directory segments with spaces and slugifying,
    then map it to the canonical URL form.
    """
    canonical: dict[str, str] = {}
    content_dir = PROJECT_ROOT / "content"
    for category in ("Positions", "Transitions", "Submissions"):
        cat_dir = content_dir / category
        if not cat_dir.exists():
            continue
        cat = category.lower()
        for md_file in cat_dir.rglob("*.md"):
            rel = md_file.relative_to(content_dir).with_suffix("")
            parts = str(rel).split("/")
            # Skip role pages (Top/Bottom/Attacker/Defender) — those aren't hubs.
            if len(parts) > 1 and parts[-1] in ("Top", "Bottom", "Attacker", "Defender"):
                continue
            # Canonical Quartz URL slug: preserve case, spaces → hyphens per segment.
            canonical_slug = "/".join(p.replace(" ", "-") for p in parts)
            # graph.json keys off the file's own JSON `name` field, NOT the folder
            # path. A family-nested file (Submissions/Loop Choke/from Closed Guard.md)
            # carries name="Loop Choke from Closed Guard" → key loop-choke-from-...,
            # so read the sibling .json name rather than trusting the filename tail.
            json_file = md_file.with_suffix(".json")
            name = ""
            if json_file.exists():
                try:
                    name = json.load(json_file.open()).get("name", "")
                except (OSError, json.JSONDecodeError):
                    name = ""
            name_slug = _slugify_name(name) if name else _slugify_name(parts[-1])
            # The layout emits either a bare "cat/name-slug" (transitions/submissions
            # loops, from the graph.json key) OR a compound "cat/parenthub/child"
            # (positions loop, from entry.path). Register BOTH so every id resolves.
            compound = "/".join(_slugify_name(p) for p in parts[1:])
            canonical[f"{cat}/{name_slug}"] = canonical_slug
            canonical[f"{cat}/{compound}"] = canonical_slug
    return canonical


def _load_prev_xy() -> dict[str, tuple[float, float]]:
    """Read the existing OUTPUT_FILE → {canonical id -> (x, y)} for preserve mode.

    Returns {} if the file is missing/unreadable (falls back to a full embed).
    """
    if not OUTPUT_FILE.exists():
        return {}
    try:
        with OUTPUT_FILE.open() as f:
            prev = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    return {n["id"]: (n["x"], n["y"]) for n in prev.get("nodes", []) if "id" in n}


def main(fresh: bool = False) -> None:
    try:
        import networkx as nx  # type: ignore
        from node2vec import Node2Vec  # type: ignore
        import umap  # type: ignore
    except ImportError as e:
        fail(
            f"Missing Python dependency ({e.name}). Install with:\n"
            "  pip install --break-system-packages --user node2vec umap-learn networkx"
        )

    if not GRAPH_JSON.exists():
        fail(f"graph.json not found at {GRAPH_JSON}. Run `npm run regenerate:graph` first.")

    print(f"[regenerate_graph_layout] Loading {GRAPH_JSON}...")
    with GRAPH_JSON.open() as f:
        graph_data = json.load(f)

    # Build adjacency from positions, transitions, submissions
    # Each section's entries have outgoing edges via `transitions[*].target` (positions)
    # or `outcomes[*].to` (transitions/submissions)
    adjacency: dict[str, set[str]] = {}
    titles: dict[str, str] = {}
    node_meta: dict[str, dict] = {}

    def add_node(slug: str, title: str = "") -> None:
        if slug not in adjacency:
            adjacency[slug] = set()
        if title and slug not in titles:
            titles[slug] = title

    def add_edge(a: str, b: str) -> None:
        if a == b:
            return
        adjacency.setdefault(a, set()).add(b)
        adjacency.setdefault(b, set()).add(a)

    # Real technique node ids — gate edges on these so we never force-create a phantom
    # transitions/<slug> (or submissions/<slug>) for a target that has no real graph node.
    real_tech_ids = {f"transitions/{k}".lower() for k in (graph_data.get("transitions") or {})} \
        | {f"submissions/{k}".lower() for k in (graph_data.get("submissions") or {})}
    # Real position node ids — an outcome target that is NOT in here (but IS a real
    # technique) must be prefixed submissions/ or transitions/, never positions/.
    real_pos_ids = {f"positions/{k}".lower() for k in (graph_data.get("positions") or {})}

    # Positions: each entry has a path like "Mount/Top" — derive hub slug
    for key, entry in (graph_data.get("positions") or {}).items():
        path = entry.get("path", "")
        if not path:
            continue
        # path format: "Mount/Top" → slug "Positions/Mount" (lowercased + hyphenated)
        parts = path.split("/")
        if len(parts) < 1:
            continue
        hub_part = "/".join(parts[:-1]) if parts[-1] in ("Top", "Bottom") else path
        slug = ("Positions/" + hub_part).replace(" ", "-")
        slug_lower = slug.lower()
        if not is_hub_node(slug_lower):
            continue
        add_node(slug_lower, entry.get("name", ""))

        # Outgoing edges via transitions — prefix by the resolved type (isSubmission),
        # and only link to a node that actually exists (no phantom transitions/<slug>).
        for t in entry.get("transitions", []):
            tgt = t.get("target", "")
            if not tgt:
                continue
            prefix = "submissions/" if t.get("isSubmission") else "transitions/"
            tgt_slug = f"{prefix}{tgt}".lower()
            if tgt_slug in real_tech_ids and is_hub_node(tgt_slug):
                add_node(tgt_slug)
                add_edge(slug_lower, tgt_slug)

    # Transitions: the visual graph stays hub-collapsed (one node per technique), but the hub is
    # now edgeless — its edge + origin data lives on the /attacker role-node, so read from there.
    transitions_data = graph_data.get("transitions") or {}
    for key, entry in transitions_data.items():
        slug = f"transitions/{key}".lower()
        if not is_hub_node(slug):
            continue
        src = transitions_data.get(f"{key}/attacker", entry)
        add_node(slug, entry.get("name", ""))
        node_meta[slug] = {
            "fromPosition": src.get("fromPosition", ""),
            "fromPositionId": src.get("fromPositionId", ""),
            "fromRole": src.get("fromRole", ""),
        }

        starting = src.get("startingPosition", "")
        if starting and isinstance(starting, str):
            start_slug = f"positions/{starting}".lower()
            if is_hub_node(start_slug):
                add_node(start_slug)
                add_edge(slug, start_slug)

        for o in src.get("outcomes", []):
            to = o.get("to", "")
            if not to or to == "game-over":
                continue
            # Outcome target: could be "position-name/top" or "position-name"
            to_lower = to.lower()
            # Strip role suffix to get hub
            for suffix in ("/top", "/bottom", "/attacker", "/defender"):
                if to_lower.endswith(suffix):
                    to_lower = to_lower[: -len(suffix)]
                    break
            # Classify the outcome target by which real node set its (role-stripped)
            # base belongs to — do NOT assume positions/. A submission- or transition-
            # typed target force-prefixed positions/ becomes a phantom node (the bug
            # that produced 20 phantom positions/<sub> duplicates in the layout).
            # Positions are matched first: they are authoritative for a position target,
            # and a submission "from X" name can loosely collide with a position slug.
            if f"positions/{to_lower}" in real_pos_ids:
                tgt_slug = f"positions/{to_lower}"
            elif f"submissions/{to_lower}" in real_tech_ids:
                tgt_slug = f"submissions/{to_lower}"
            elif f"transitions/{to_lower}" in real_tech_ids:
                tgt_slug = f"transitions/{to_lower}"
            else:
                continue  # unresolved (family hub / stale ref) — never create a phantom
            if is_hub_node(tgt_slug):
                add_node(tgt_slug)
                add_edge(slug, tgt_slug)

    # Submissions: similar, edges to from_positions (origin data on the /attacker role-node).
    submissions_data = graph_data.get("submissions") or {}
    for key, entry in submissions_data.items():
        slug = f"submissions/{key}".lower()
        if not is_hub_node(slug):
            continue
        src = submissions_data.get(f"{key}/attacker", entry)
        add_node(slug, entry.get("name", ""))
        node_meta[slug] = {
            "fromPosition": src.get("fromPosition", ""),
            "fromPositionId": src.get("fromPositionId", ""),
            "fromRole": src.get("fromRole", ""),
        }

        for fp in entry.get("fromPositions", []) or src.get("fromPositions", []) or []:
            if not fp:
                continue
            fp_slug = f"positions/{fp}".lower()
            if is_hub_node(fp_slug):
                add_node(fp_slug)
                add_edge(slug, fp_slug)

    # Drop isolated nodes (no edges) — they distort the layout
    nodes = [n for n, neigh in adjacency.items() if neigh]
    if not nodes:
        fail("No connected hub nodes found in graph.json.")

    edges = set()
    for n in nodes:
        for m in adjacency[n]:
            if m in adjacency and adjacency[m]:
                edges.add(tuple(sorted([n, m])))

    print(f"[regenerate_graph_layout] {len(nodes)} hub nodes, {len(edges)} edges")

    import numpy as np  # type: ignore

    # Translate lowercase slugs → canonical mixed-case URL paths so graph clicks
    # land on real Quartz pages (Linux + npx serve are case-sensitive). Built up-front
    # because preserve-mode keys prior coordinates by the canonical output id.
    canonical_map = build_canonical_map()
    missing = sorted(n for n in nodes if n not in canonical_map)
    if missing:
        print(
            f"[regenerate_graph_layout] WARNING: {len(missing)} nodes lack a canonical URL "
            f"mapping and will keep their lowercase id (may 404). First few: {missing[:5]}",
            file=sys.stderr,
        )

    def to_canonical(slug: str) -> str:
        return canonical_map.get(slug, slug)

    # ------------------------------------------------------------------
    # PRESERVE-COORDS (default): the node2vec+UMAP embed is expensive AND — even with
    # SEED + WORKERS=1 — a full re-embed relayouts the whole graph, so re-running the
    # pipeline would visibly rearrange every node. Instead, if a previous layout exists,
    # reuse each node's (x, y) verbatim keyed by its canonical output id, and only run
    # the embed to place nodes that are genuinely NEW (absent from the prior file).
    # `--fresh` forces a full deterministic re-embed.
    # ------------------------------------------------------------------
    prev_xy = {} if fresh else _load_prev_xy()
    canon_ids = [to_canonical(n) for n in nodes]
    new_internal = [n for n, cid in zip(nodes, canon_ids) if cid not in prev_xy]

    def _run_embed() -> "np.ndarray":
        """Deterministic node2vec (SEED, WORKERS=1) + UMAP (random_state=42) → scaled 2D."""
        G = nx.Graph()
        for n in nodes:
            G.add_node(n)
        for a, b in edges:
            G.add_edge(a, b)
        print(f"[regenerate_graph_layout] Running node2vec (dim={EMBED_DIM}, walks={NUM_WALKS}, len={WALK_LENGTH}, seed={SEED})...")
        node2vec = Node2Vec(
            G,
            dimensions=EMBED_DIM,
            walk_length=WALK_LENGTH,
            num_walks=NUM_WALKS,
            p=P_RETURN,
            q=Q_INOUT,
            workers=WORKERS,
            seed=SEED,
            quiet=True,
        )
        model = node2vec.fit(window=10, min_count=1, batch_words=4, sg=1, seed=SEED)
        embeddings = np.array([model.wv[n] for n in nodes])
        print(f"[regenerate_graph_layout] Running UMAP (n_neighbors={UMAP_NEIGHBORS}, min_dist={UMAP_MIN_DIST})...")
        reducer = umap.UMAP(
            n_neighbors=UMAP_NEIGHBORS,
            min_dist=UMAP_MIN_DIST,
            metric=UMAP_METRIC,
            n_components=2,
            random_state=42,
        )
        c = reducer.fit_transform(embeddings)
        c = c - c.mean(axis=0)
        max_extent = max(abs(c).max(), 1e-6)
        return c * (COORD_SCALE / max_extent)

    if prev_xy and not new_internal:
        # Pure preserve: every node existed before → reuse all coords, skip the embed.
        print(f"[regenerate_graph_layout] Preserve mode: reusing all {len(nodes)} prior coordinates (no embed).")
        coords = np.array([prev_xy[cid] for cid in canon_ids], dtype=float)
    elif prev_xy:
        # Incremental: embed to place the NEW nodes, but overwrite every pre-existing
        # node with its prior (x, y) so established positions stay stable.
        print(f"[regenerate_graph_layout] Preserve mode: {len(new_internal)} new node(s) → embedding to place them; {len(nodes)-len(new_internal)} kept.")
        embedded = _run_embed()
        coords = np.array(
            [prev_xy[cid] if cid in prev_xy else embedded[i] for i, cid in enumerate(canon_ids)],
            dtype=float,
        )
    else:
        # Fresh: full deterministic embed (no prior file, or --fresh).
        print("[regenerate_graph_layout] Fresh mode: full deterministic re-embed.")
        coords = _run_embed()

    # Title-case a slug tail for the rare fallback (a node with no graph.json name),
    # keeping connector words like "from" lowercase — avoids the "X From Y" casing
    # the designer flagged.
    _MINOR = {"from", "to", "and", "the", "of", "on", "in", "a"}

    def _slug_title(tail: str) -> str:
        words = tail.replace("-", " ").split()
        return " ".join(w if w in _MINOR else w.capitalize() for w in words)

    # Emit JSON with same shape as backgroundGraph.inline.ts expects.
    #
    # COLLAPSE DUPLICATES: the graph.json traversal can emit two internal nodes that
    # canonicalize to the SAME url — a bare positions/<child> (from an outcome target)
    # and a compound positions/<parent>/<child> (from the position `path`). They are the
    # same position. Keep the FIRST occurrence in traversal order, drop the rest, and
    # retarget links onto the survivor (mirrors scripts/remap_layout_ids.py so a full
    # re-embed and the in-place remap agree on the node set). Without this the file would
    # carry duplicate ids.
    out_nodes = []
    seen_ids: set[str] = set()
    for i, n in enumerate(nodes):
        cid = to_canonical(n)
        if cid in seen_ids:
            continue  # duplicate twin — its edges retarget onto the kept survivor
        seen_ids.add(cid)
        title = titles.get(n) or _slug_title(n.split("/")[-1])
        out_node = {
            "id": cid,
            "x": round(float(coords[i, 0]), 1),
            "y": round(float(coords[i, 1]), 1),
            "t": title,
            "tags": [],
        }
        # Structured canonical origin for technique nodes — consumers filter/link by
        # these instead of string-parsing the title.
        meta = node_meta.get(n)
        if meta and meta.get("fromPositionId"):
            out_node["fromPosition"] = meta["fromPosition"]
            out_node["fromPositionId"] = meta["fromPositionId"]
            out_node["fromRole"] = meta["fromRole"]
        out_nodes.append(out_node)

    # Retarget + dedup links onto canonical (survivor) ids; drop self-loops and any
    # duplicate edge the collapse produced. Iterate `edges` in SORTED order — it is a
    # set, whose iteration order varies per process under hash randomization, which
    # would otherwise make the output non-idempotent (link order churns run to run).
    out_links = []
    seen_edges: set[tuple[str, str]] = set()
    for a, b in sorted(edges):
        s, t = to_canonical(a), to_canonical(b)
        if s == t:
            continue
        key = (s, t)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        out_links.append({"source": s, "target": t})

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w") as f:
        json.dump({"nodes": out_nodes, "links": out_links}, f, separators=(",", ":"))

    print(f"[regenerate_graph_layout] Wrote {OUTPUT_FILE}")
    print(f"[regenerate_graph_layout] {len(out_nodes)} nodes, {len(out_links)} links")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Force a full deterministic re-embed (node2vec+UMAP), ignoring the existing "
        "layout. Default is preserve-coords: reuse prior (x,y) and only embed NEW nodes.",
    )
    args = parser.parse_args()
    main(fresh=args.fresh)
