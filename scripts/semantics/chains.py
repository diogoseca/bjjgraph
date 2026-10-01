#!/usr/bin/env python3
"""
THREE CHAINS, ONE GRAPH — the Markov chains this repo already runs over graph.json, measured
against each other.

CLAUDE.md §6.5: "when one question is answered in two places, one of them is already wrong". The
question "how often does a roll pass through X" is answered in THREE places today, by three
different chains, and nothing compares them:

  1. THE GAME  (solve_edge_values.Model -> scripts/semantics/_kernel.py). Two seats, the opponent
     samples the PAIRED role-node's hand, role + origin filters, the 42 chained hub cells, null
     dropped. EDGE and FLOW price THIS chain; the kernel reproduces it to 1e-15.
  2. THE SCORE WALK (regenerate_neural_data.build_technique_weights). ONE actor who keeps acting
     from wherever they land; no opponent seat; no origin filter; PageRank damping 0.85 towards
     uniform over every role-node with transitions; finishes and the chained hub cells "leak" and
     restart uniformly. It weights `gameScore` (the belt) and curriculum.
  3. THE REACHABILITY WALK (regenerate_neural_data.frame_reachable). Not a chain — a support: a BFS
     from ROLL_SEEDS over the hands `solve_edge_values.build_hand` deals (role- and origin-filtered
     since v1.209.0; role- and origin-blind before, which admitted Spider Guard and Double Sleeve
     Guard in no-gi through a Tripod Sweep listing). It decides which states the app hides per ruleset.

What this prints, per frame and initiative rule:
  * techniques: Spearman and total-variation distance between the score walk's weights and the
    game's expected plays per roll (both seats' hands, occupancy from `start`), with join coverage;
  * position decks: the same for the score walk's occupancy table vs the game's visits per roll;
  * reachability: the game's reachable role-nodes vs the walk's.

It CHANGES NOTHING. Whether the score should be weighted by the game is a product decision about
the belt; this is the measurement that decision needs.

    python3 scripts/semantics/chains.py                 # the comparison
    python3 scripts/semantics/chains.py --start anywhere
    python3 scripts/semantics/chains.py --json out.json
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys

import numpy as np
from scipy.stats import spearmanr

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

from _kernel import load_kernel  # noqa: E402

# JOIN FLOORS. A join that silently matched a fraction of either side prints a plausible rho over
# the wrong set (CLAUDE.md §6.6). Below these, refuse.
TECH_JOIN_FLOOR = 0.95      # share of the score walk's techniques the game must also key
POS_JOIN_FLOOR = 266        # every position deck


def _pos_key(graph, s):
    """`posFamily` + role — the deck key both the score walk and the app use."""
    nm = graph["positions"][s].get("name") or ""
    for suf in (" Top", " Bottom"):
        if nm.endswith(suf):
            nm = nm[: -len(suf)]
            break
    return nm + "|" + (graph["positions"][s].get("role") or "").capitalize()


def game_tables(K, where="standing"):
    """Expected card plays and expected visits per roll, from `where` (coin: either seat first)."""
    g = K.graph
    N = K.fundamental().solve(K.start(where, "coin"), "T")
    plays = {}
    for a in K.actions:
        node = g[a["cat"]].get(a["target"] + "/attacker") or {}
        k = (node.get("name") or a["target"]) + "|Attacker"
        plays[k] = plays.get(k, 0.0) + N[a["t"]] * a["pi"]
    occ = {}
    for r, s in enumerate(K.role_nodes):
        k = _pos_key(g, s)
        occ[k] = occ.get(k, 0.0) + N[r] + N[K.n_r + r]
    return plays, occ, float(N.sum())


def compare(a, b):
    """Spearman and total variation over the COMMON keys, plus the join counts."""
    common = sorted(set(a) & set(b))
    x = np.array([a[k] for k in common], dtype=float)
    y = np.array([b[k] for k in common], dtype=float)
    rho = float(spearmanr(x, y).correlation) if len(common) > 2 else float("nan")
    tv = float(0.5 * np.abs(x / x.sum() - y / y.sum()).sum()) if len(common) else float("nan")
    return {"joined": len(common), "only_a": len(set(a) - set(b)), "only_b": len(set(b) - set(a)),
            "spearman": rho, "total_variation": tv, "common": common}


def run(where="standing"):
    from regenerate_neural_data import build_technique_weights, frame_reachable
    out, failures = {}, []
    for frame in ("nogi", "gi"):
        K0 = load_kernel(frame)
        with contextlib.redirect_stdout(io.StringIO()):
            W, OCC = build_technique_weights(K0.graph, frame)
        walk = frame_reachable(K0.graph, frame)["positions"] & set(K0.role_nodes)
        for ini in ("shipped", "symmetric"):
            K = load_kernel(frame, ini)
            plays, occ, steps = game_tables(K, where)
            t = compare(W, plays)
            p = compare(OCC, occ)
            tag = "%s/%s" % (frame, ini)
            if t["joined"] < TECH_JOIN_FLOOR * len(W):
                failures.append("%s technique join %d < %.0f%% of %d" % (tag, t["joined"],
                                                                          100 * TECH_JOIN_FLOOR, len(W)))
            if p["joined"] < POS_JOIN_FLOOR:
                failures.append("%s position join %d < %d" % (tag, p["joined"], POS_JOIN_FLOOR))
            ratio = sorted(t["common"], key=lambda k: -(plays[k] / W[k] if W[k] > 0 else 0))
            never = [k for k in t["common"] if plays[k] == 0]
            out[tag] = {
                "start": where, "expected_steps_per_roll": steps,
                "techniques": {k: v for k, v in t.items() if k != "common"},
                "techniques_game_never_plays": sorted(x.split("|")[0] for x in never),
                "most_underweighted_by_score_walk": [(k.split("|")[0], plays[k] / W[k]) for k in ratio[:15]],
                "positions": {k: v for k, v in p.items() if k != "common"},
                "score_walk_top10_positions": sorted(OCC, key=lambda k: -OCC[k])[:10],
                "game_top10_positions": sorted(occ, key=lambda k: -occ[k])[:10],
                "reachable_game": len(K.reachable), "reachable_walk": len(walk),
                "walk_only": sorted(walk - K.reachable), "game_only": sorted(K.reachable - walk),
            }
    return out, failures


def main(argv=None):
    ap = argparse.ArgumentParser(description="the three chains over graph.json, compared")
    ap.add_argument("--start", default="standing", choices=("standing", "anywhere"))
    ap.add_argument("--json")
    a = ap.parse_args(argv)
    out, failures = run(a.start)
    for tag, r in out.items():
        t, p = r["techniques"], r["positions"]
        print("== %s   (game occupancy from %s, either seat first; %.2f steps/roll)"
              % (tag, r["start"], r["expected_steps_per_roll"]))
        print("  techniques: joined %d (score-walk only %d, game only %d)  Spearman %.3f  TV %.3f"
              % (t["joined"], t["only_a"], t["only_b"], t["spearman"], t["total_variation"]))
        print("    the game never plays %d techniques the score walk weights" % len(r["techniques_game_never_plays"]))
        print("    most under-weighted by the score walk (game/score): %s"
              % ", ".join("%s %.1fx" % x for x in r["most_underweighted_by_score_walk"][:6]))
        print("  position decks: joined %d  Spearman %.3f  TV %.3f"
              % (p["joined"], p["spearman"], p["total_variation"]))
        print("    score walk top5: %s" % r["score_walk_top10_positions"][:5])
        print("    game top5:       %s" % r["game_top10_positions"][:5])
        print("  reachable role-nodes: game %d, walk %d; walk-only %s; game-only %s"
              % (r["reachable_game"], r["reachable_walk"], r["walk_only"], r["game_only"]))
    if a.json:
        import hashlib
        repo = os.path.dirname(os.path.dirname(HERE))
        meta = {"graph_sha256": hashlib.sha256(open(os.path.join(repo, "graph.json"), "rb").read()).hexdigest(),
                "recompute": "python3 -B scripts/semantics/chains.py --start %s --json %s" % (a.start, a.json)}
        with open(a.json, "w") as fh:
            json.dump({"meta": meta, "configs": out}, fh, indent=1, sort_keys=True)
    if failures:
        print("FAIL: " + "; ".join(failures))
        return 1
    print("joins above floor in all %d configurations" % len(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
