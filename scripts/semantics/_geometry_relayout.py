#!/usr/bin/env python3
"""G3 step 4: FRESH node2vec+UMAP layouts, written to a scratch directory only, by the layout
script's OWN code.

`scripts/regenerate_graph_layout.main(fresh=True)` is run unmodified, with two redirections:

  * its module globals OUTPUT_DIR / OUTPUT_FILE point at the caller's scratch directory. The
    repository's `source/quartz/static/globalGraphLayout.json` is hashed before and after, and a
    changed hash is a hard failure;
  * `node2vec.Node2Vec` — which `main()` imports LOCALLY, so the patched module attribute is what it
    binds — is wrapped. The wrapper records the graph and forwards every keyword unchanged. For the
    weighted variant it first puts a `weight` on every edge.

Everything else is the script's: graph construction (1,499 internal nodes incl. the nested-position
twins it collapses after embedding), EMBED_DIM, WALK_LENGTH, NUM_WALKS, p, q, WORKERS=1, the
word2vec call, UMAP (n_neighbors, min_dist, cosine, random_state=42), COORD_SCALE, and its writer.

VARIANTS
  unweighted   the shipped recipe, fresh (no preserved coordinates).
  kernel_flow  edge weight = the primary kernel's stationary one-step flow across that edge, in either
               direction: position hub -> technique = sum over the hub's transient states of
               mu(t) * attempt share of that card; technique -> landing position hub = sum of mu(src) *
               cell mass over the card's cells that land there; technique -> chained submission = the
               same over cells whose finisher column names a different technique. mu = the Q-process
               stationary law (the roll conditioned never to finish; G2R's diffusion basis). This is
               the one-step law of the SAME chain whose exit law defines meaning, decomposed through
               the technique nodes the layout draws.
               node2vec normalises per node, so only the RATIOS of a node's edge weights matter.
               Edges the kernel never uses (origin-dropped listings, orphans, gi-only moves) get a
               strictly positive floor, 1e-3 x the smallest positive flow, so the topology is
               identical to the unweighted run. The floor is NOT optional: node2vec 0.5 reads a zero
               weight as falsy, falls into an `except` and silently uses 1.

  authored_share
               edge weight = the CONDITIONAL one-step law read straight from graph.json, symmetrised:
               P(position hub -> technique) = 1/2 x sum over the hub's two role-nodes of the authored
               no-gi attempt share (a null share means "absent in no-gi": skipped and COUNTED, never
               read as 0), plus P(technique -> landing hub or chained submission) = the authored outcome
               cell probability. No occupancy weighting and no origin filter: the listing graph the
               layout is drawn from, with each edge weighted by how likely a step along it is from
               either end. Added after kernel_flow measured WORSE than unweighted, to separate "use the
               probabilities" from "weight by where the fight spends its time".

    python3 -B scripts/semantics/_geometry_relayout.py --selfcheck
    python3 -B scripts/semantics/_geometry_relayout.py --out <scratch dir> --variant unweighted --seed 42
    python3 -B scripts/semantics/_geometry_relayout.py --out <scratch dir> --variant kernel_flow --seed 42
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "scripts"))
sys.path.insert(0, str(HERE))

LAYOUT = REPO / "source/quartz/static/globalGraphLayout.json"
COMMAND = "python3 -B scripts/semantics/_geometry_relayout.py"
VARIANTS = ("unweighted", "kernel_flow", "authored_share")
FLOOR_FACTOR = 1e-3


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _require(ok, message):
    if not ok:
        raise ValueError(message)


@contextlib.contextmanager
def redirected(module, out_dir, name):
    saved = (module.OUTPUT_DIR, module.OUTPUT_FILE)
    module.OUTPUT_DIR, module.OUTPUT_FILE = Path(out_dir), Path(out_dir) / name
    try:
        yield module.OUTPUT_FILE
    finally:
        module.OUTPUT_DIR, module.OUTPUT_FILE = saved


@contextlib.contextmanager
def wrapped_node2vec(weigh, report, abort=False):
    """Patch node2vec.Node2Vec for the duration; `abort` records the graph and stops (no embed)."""
    import node2vec
    original = node2vec.Node2Vec

    class Recorded(Exception):
        pass

    def factory(G, **kwargs):
        if weigh is not None:
            weigh(G, report)
        report["node2vec_kwargs"] = dict(kwargs)
        report["embed_graph"] = {"nodes": G.number_of_nodes(), "edges": G.number_of_edges(),
                                 "weighted_edges": sum(1 for *_e, d in G.edges(data=True) if "weight" in d)}
        if abort:
            raise Recorded()
        return original(G, **kwargs)

    node2vec.Node2Vec = factory
    try:
        yield Recorded
    finally:
        node2vec.Node2Vec = original


def internal_to_graph_ids(graph):
    """The layout script's internal node slugs -> graph.json hub/technique ids.

    Positions: the script derives a compound slug from `path` and a bare slug from technique
    origins; both twins map to the position's `hub`. Techniques: '<category>/<key>'.
    """
    out = {}
    for key, entry in graph["positions"].items():
        hub = entry.get("hub")
        if not hub:
            continue
        out["positions/" + hub.lower()] = ("position", hub)
        path = entry.get("path", "")
        if path:
            parts = path.split("/")
            hub_part = "/".join(parts[:-1]) if parts[-1] in ("Top", "Bottom") else path
            out[("positions/" + hub_part).replace(" ", "-").lower()] = ("position", hub)
    for cat in ("transitions", "submissions"):
        for key in graph[cat]:
            base = key.split("/")[0] if key.endswith(("/attacker", "/defender")) else key
            out[f"{cat}/{base}".lower()] = ("technique", base)
    return out


def kernel_flows(graph):
    """Undirected stationary one-step flow between (position hub | technique) ids, primary kernel."""
    from _kernel import load_kernel
    K = load_kernel(frame="nogi", initiative="symmetric", rates="shipped", graph=graph)
    q = K.qprocess()
    mu = np.zeros(K.n_t)
    mu[q["idx"]] = q["mu"]
    flow = defaultdict(float)
    counts = Counter()
    for a in K.actions:
        t = a["t"]
        if mu[t] > 0:
            flow[frozenset((("position", K.hub_of[t % K.n_r]), ("technique", a["target"])))] += mu[t] * a["pi"]
            counts["attempt_terms"] += 1
    c = K.cells
    for row in c[c["act"] >= 0]:
        t = int(row["src"])
        if mu[t] <= 0 or row["mass"] <= 0:
            continue
        tech = ("technique", K.actions[int(row["act"])]["target"])
        if row["dst"] >= 0:
            flow[frozenset((tech, ("position", K.hub_of[int(row["dst"]) % K.n_r])))] += mu[t] * row["mass"]
            counts["landing_terms"] += 1
        elif row["fin"] >= 0:
            fin_tech = K.fin_cols[int(row["fin"])][0]
            if fin_tech != tech[1]:
                flow[frozenset((tech, ("technique", fin_tech)))] += mu[t] * row["mass"]
                counts["chain_terms"] += 1
    _require(counts["attempt_terms"] > 0 and counts["landing_terms"] > 0, "kernel flow: zero terms")
    return dict(flow), dict(counts), {"qprocess_states": len(q["idx"]), "mu_sum": float(mu.sum())}


def authored_flows(graph):
    """Symmetrised conditional one-step law on the listing graph, from authored numbers only."""
    techniques = {k.split("/")[0] for cat in ("transitions", "submissions") for k in graph[cat]}
    flow = defaultdict(float)
    counts = Counter()
    for node in graph["positions"].values():
        if node.get("role") not in ("top", "bottom"):
            continue
        for t in node.get("transitions") or []:
            v = (t.get("attemptProbabilityByRuleset") or {}).get("nogi")
            if v is None:
                counts["null_nogi_attempt_cells_skipped"] += 1
                continue
            if v > 0:
                flow[frozenset((("position", node["hub"]), ("technique", t["target"])))] += 0.5 * v / 100
                counts["attempt_terms"] += 1
    for cat in ("transitions", "submissions"):
        for key, node in graph[cat].items():
            if not key.endswith("/attacker"):
                continue
            tech = key[: -len("/attacker")]
            for o in node.get("outcomes") or []:
                to, pr = o.get("to"), o.get("probability")
                if pr is None:
                    counts["null_outcome_cells_skipped"] += 1
                    continue
                if to == "game-over" or pr <= 0:
                    continue
                if to in graph["positions"]:
                    other = ("position", graph["positions"][to]["hub"])
                elif to.split("/")[0] in techniques:
                    other = ("technique", to.split("/")[0])
                else:
                    counts["unresolved_outcome_targets"] += 1
                    continue
                if other != ("technique", tech):
                    flow[frozenset((("technique", tech), other))] += pr / 100
                    counts["outcome_terms"] += 1
    _require(counts["attempt_terms"] > 0 and counts["outcome_terms"] > 0, "authored flow: zero terms")
    return dict(flow), dict(counts), {"source": "graph.json authored no-gi attempt shares + outcome probabilities"}


def _entropy_profile(G):
    """Normalised entropy of each node's first-step law (1 = uniform, as in the unweighted run)."""
    out = {"position": [], "technique": []}
    for u in G.nodes():
        w = np.array([G[u][v].get("weight", 1.0) for v in G.neighbors(u)], dtype=float)
        if len(w) < 2:
            continue
        q = w / w.sum()
        h = float(-(q * np.log(q)).sum() / np.log(len(w)))
        out["position" if u.startswith("positions/") else "technique"].append(h)
    return {k: {"nodes": len(v), "median": float(np.median(v)), "p10": float(np.quantile(v, .1))} for k, v in out.items()}


def make_kernel_weigher(graph):
    return make_weigher(graph, *kernel_flows(graph))


def make_authored_weigher(graph):
    return make_weigher(graph, *authored_flows(graph))


def make_weigher(graph, flow, counts, info):
    ids = internal_to_graph_ids(graph)
    positive = min(v for v in flow.values() if v > 0)
    floor = FLOOR_FACTOR * positive

    def weigh(G, report):
        unmapped, used, floored = [], 0, 0
        mass_on_layout = 0.0
        for u, v, d in G.edges(data=True):
            if u not in ids or v not in ids:
                unmapped.append((u, v))
                continue
            w = flow.get(frozenset((ids[u], ids[v])), 0.0)
            if w > 0:
                used += 1
                mass_on_layout += w
                d["weight"] = w
            else:
                floored += 1
                d["weight"] = floor
        _require(not unmapped, f"weights: {len(unmapped)} embed-graph edges map to no graph id")
        _require(used > 0, "weights: no embed edge carries flow")
        weights = [d["weight"] for *_e, d in G.edges(data=True)]
        _require(min(weights) > 0, "weights: a non-positive weight reached node2vec")
        report["first_step_entropy"] = _entropy_profile(G)
        # The converse: kernel flow between two ids the layout graph never links is invisible to
        # any weighting of this graph. Count it rather than let it vanish.
        layout_pairs = {frozenset((ids[u], ids[v])) for u, v in G.edges()}
        missing = {k: v for k, v in flow.items() if k not in layout_pairs and len(k) == 2}
        twin_edges = sum(1 for u, v in G.edges() if ids[u][0] == "position" and u != "positions/" + ids[u][1].lower()
                         or ids[v][0] == "position" and v != "positions/" + ids[v][1].lower())
        report["weights_coverage"] = {"flow_pairs_without_a_layout_edge": len(missing),
                                      "flow_mass_without_a_layout_edge": float(sum(missing.values())),
                                      "largest_missing": sorted(([sorted(map(list, k)), v] for k, v in missing.items()),
                                                                key=lambda r: -r[1])[:5],
                                      "edges_touching_a_compound_position_twin": twin_edges}
        report["weights"] = {"edges": G.number_of_edges(), "edges_with_kernel_flow": used,
                             "edges_floored": floored, "floor": floor, "smallest_positive_flow": positive,
                             "flow_pairs_in_kernel": len(flow), "flow_terms": counts, "kernel": info,
                             "kernel_flow_mass_on_layout_edges": mass_on_layout,
                             "kernel_flow_mass_total": float(sum(flow.values()))}
    return weigh


def run(out_dir, variant, seed, abort=False):
    import regenerate_graph_layout as rgl
    _require(variant in VARIANTS, f"unknown variant {variant}")
    out_dir = Path(out_dir).resolve()
    _require(REPO not in out_dir.parents and out_dir != REPO, "refusing to write inside the repository")
    out_dir.mkdir(parents=True, exist_ok=True)
    graph = json.loads((REPO / "graph.json").read_text())
    before = _sha(LAYOUT)
    report = {"variant": variant, "seed": seed, "command": f"{COMMAND} --out <dir> --variant {variant} --seed {seed}"}
    weigh = {"kernel_flow": make_kernel_weigher, "authored_share": make_authored_weigher}.get(variant)
    weigh = weigh(graph) if weigh else None
    saved_seed = rgl.SEED
    started = time.time()
    try:
        rgl.SEED = seed
        name = f"layout_{variant}_seed{seed}.json"
        with redirected(rgl, out_dir, name) as target, wrapped_node2vec(weigh, report, abort) as Recorded:
            try:
                rgl.main(fresh=True)
            except Recorded:
                pass
    finally:
        rgl.SEED = saved_seed
    report["seconds"] = round(time.time() - started, 1)
    after = _sha(LAYOUT)
    _require(before == after, "the repository layout file changed — aborting")
    report["repo_layout_sha256_unchanged"] = before
    _require(report["node2vec_kwargs"].get("seed") == seed and report["node2vec_kwargs"].get("workers") == 1,
             "seed/workers did not reach node2vec")
    if variant == "unweighted":
        _require(report["embed_graph"]["weighted_edges"] == 0, "unweighted run carried weights")
    else:
        _require(report["embed_graph"]["weighted_edges"] == report["embed_graph"]["edges"], "an edge missed its weight")
    if not abort:
        _require(target.exists(), "script did not write the scratch layout")
        report["layout_file"] = str(target)
        report["layout_sha256"] = _sha(target)
        (out_dir / f"layout_{variant}_seed{seed}.report.json").write_text(json.dumps(report, sort_keys=True, indent=1))
    return report


def selfcheck(out_dir):
    """Mechanics only, no embed: redirect, pass-through, weights, repo file untouched."""
    out_dir = Path(out_dir) / "selfcheck"          # its own directory: real embeds live beside it
    checks = 0
    for variant in VARIANTS:
        r = run(out_dir, variant, 42, abort=True)
        _require(r["embed_graph"]["nodes"] >= 1400 and r["embed_graph"]["edges"] >= 5000, "embed graph below floor")
        _require(r["node2vec_kwargs"]["dimensions"] == 64 and r["node2vec_kwargs"]["q"] == 0.5, "script knobs not forwarded")
        checks += 3
        if variant != "unweighted":
            w = r["weights"]
            _require(w["edges_with_kernel_flow"] >= 1000, "flow reached too few edges")
            checks += 1
        print(f"PASS relayout mechanics {variant}; SET: the layout script's own embed graph; command: {COMMAND} "
              f"--selfcheck; " + json.dumps({k: r[k] for k in ("embed_graph", "node2vec_kwargs")}
                                           | ({"weights": r["weights"]} if "weights" in r else {}), sort_keys=True))
    _require(not any(Path(out_dir).glob("layout_*_seed42.json")), "abort mode wrote a layout")
    print(f"PASS relayout selfcheck; {checks} checks; repo layout sha256 unchanged", flush=True)
    return checks


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="scratch directory (never inside the repo)")
    parser.add_argument("--variant", choices=VARIANTS, default="unweighted")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--selfcheck", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.selfcheck:
            selfcheck(args.out)
        else:
            r = run(args.out, args.variant, args.seed)
            print("PASS relayout " + json.dumps(r, sort_keys=True), flush=True)
        return 0
    except ValueError as exc:
        print("FAIL relayout:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
