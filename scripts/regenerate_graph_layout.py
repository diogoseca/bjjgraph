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
WORKERS = 4

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
        for md_file in cat_dir.rglob("*.md"):
            rel = md_file.relative_to(content_dir).with_suffix("")
            parts = str(rel).split("/")
            # Skip role pages (Top/Bottom/Attacker/Defender) — those aren't hubs.
            if len(parts) > 1 and parts[-1] in ("Top", "Bottom", "Attacker", "Defender"):
                continue
            # Canonical Quartz URL slug: preserve case, spaces → hyphens per segment.
            canonical_slug = "/".join(p.replace(" ", "-") for p in parts)
            # Reconstruct the implicit "name" the JSON would carry (joined with spaces),
            # then slugify it the same way regenerate_graph.py does.
            implicit_name = " ".join(parts[1:])
            lookup_key = f"{category.lower()}/{_slugify_name(implicit_name)}"
            canonical[lookup_key] = canonical_slug
    return canonical


def main() -> None:
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

        # Outgoing edges via transitions
        for t in entry.get("transitions", []):
            tgt = t.get("target", "")
            if not tgt:
                continue
            tgt_slug = f"transitions/{tgt}".lower()
            if is_hub_node(tgt_slug):
                add_node(tgt_slug)
                add_edge(slug_lower, tgt_slug)

    # Transitions: each entry has `outcomes` and a `startingPosition`
    for key, entry in (graph_data.get("transitions") or {}).items():
        slug = f"transitions/{key}".lower()
        if not is_hub_node(slug):
            continue
        add_node(slug, entry.get("name", ""))

        starting = entry.get("startingPosition", "")
        if starting and isinstance(starting, str):
            start_slug = f"positions/{starting}".lower()
            if is_hub_node(start_slug):
                add_node(start_slug)
                add_edge(slug, start_slug)

        for o in entry.get("outcomes", []):
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
            tgt_slug = f"positions/{to_lower}"
            if is_hub_node(tgt_slug):
                add_node(tgt_slug)
                add_edge(slug, tgt_slug)

    # Submissions: similar, edges to from_positions
    for key, entry in (graph_data.get("submissions") or {}).items():
        slug = f"submissions/{key}".lower()
        if not is_hub_node(slug):
            continue
        add_node(slug, entry.get("name", ""))

        for fp in entry.get("fromPositions", []) or []:
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

    # Build NetworkX graph
    G = nx.Graph()
    for n in nodes:
        G.add_node(n)
    for a, b in edges:
        G.add_edge(a, b)

    # node2vec embeddings
    print(f"[regenerate_graph_layout] Running node2vec (dim={EMBED_DIM}, walks={NUM_WALKS}, len={WALK_LENGTH})...")
    node2vec = Node2Vec(
        G,
        dimensions=EMBED_DIM,
        walk_length=WALK_LENGTH,
        num_walks=NUM_WALKS,
        p=P_RETURN,
        q=Q_INOUT,
        workers=WORKERS,
        quiet=True,
    )
    model = node2vec.fit(window=10, min_count=1, batch_words=4, sg=1)

    # Stack embeddings in node order
    import numpy as np  # type: ignore

    embeddings = np.array([model.wv[n] for n in nodes])

    # UMAP to 2D
    print(f"[regenerate_graph_layout] Running UMAP (n_neighbors={UMAP_NEIGHBORS}, min_dist={UMAP_MIN_DIST})...")
    reducer = umap.UMAP(
        n_neighbors=UMAP_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        metric=UMAP_METRIC,
        n_components=2,
        random_state=42,
    )
    coords = reducer.fit_transform(embeddings)

    # Center and scale to coordinate system
    coords = coords - coords.mean(axis=0)
    max_extent = max(abs(coords).max(), 1e-6)
    coords = coords * (COORD_SCALE / max_extent)

    # Translate lowercase slugs → canonical mixed-case URL paths so graph clicks
    # land on real Quartz pages (Linux + npx serve are case-sensitive).
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

    # Emit JSON with same shape as backgroundGraph.inline.ts expects
    out_nodes = []
    for i, n in enumerate(nodes):
        title = titles.get(n) or n.split("/")[-1].replace("-", " ").title()
        out_nodes.append(
            {
                "id": to_canonical(n),
                "x": round(float(coords[i, 0]), 1),
                "y": round(float(coords[i, 1]), 1),
                "t": title,
                "tags": [],
            }
        )

    out_links = [{"source": to_canonical(a), "target": to_canonical(b)} for a, b in edges]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w") as f:
        json.dump({"nodes": out_nodes, "links": out_links}, f, separators=(",", ":"))

    print(f"[regenerate_graph_layout] Wrote {OUTPUT_FILE}")
    print(f"[regenerate_graph_layout] {len(out_nodes)} nodes, {len(out_links)} links")


if __name__ == "__main__":
    main()
