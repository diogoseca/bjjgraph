#!/usr/bin/env python3
"""
THE `opponentDefend` HONESTY GAP, MEASURED FROM BOTH CODE PATHS.

CLAUDE.md discloses that the opponent the EDGE model assumes is not the opponent the roll
ships.  The SHIPPED side reproduces from `opponentDefend`'s own gather; the MODEL side did
NOT reproduce from any definition, and a canon number nobody can reproduce is worse than no
number, so this script fixes the definition in code.

  SHIPPED  `opponentDefend()` iterates `this.adj[this.currentPos]` -- UNDIRECTED, hub-collapsed
           adjacency -- skips `ty === "positions"`, dedupes by title, and never reads
           `attemptProbability`.  `adj` is per POSITION HUB (the v1.125.0 pair keeps
           `adj[<member>]` byte-identical to `adj[<hub>]`), so both role-states of a hub see
           the same pool.

  MODEL    `Model.opp_hands[i] = hands[index[flip(s)]]` (solve_edge_values.py, opponent="mirror"):
           the opponent at MY state plays THE PAIRED ROLE-NODE'S OWN DEALT HAND -- the same
           `build_hand` that deals mine, so role-filtered (never relaxed) and origin-filtered.
           That is one line of code with one meaning, so it is the definition canon quotes.

Four candidate readings are printed side by side, because the canon used to carry one of the
wrong ones and a reader is entitled to see which, and why another was chosen:
   A  opponent-role-only  -- `hands[flip(s)]`.  What the model's code actually does.
   B  both roles          -- my hand + theirs.  Every move EITHER player may perform here.
   C  hub union           -- every authored move of the hub, both roles, before any filter.
   D  A without ORIGIN    -- the opponent's role-filtered moves before `build_hand` narrows to
                             the ones that originate here.  This is what the retired 9.1 / 23.2%
                             / 2476 figure was measuring: a set the model never holds.

Reading A is taken from `Model.opp_hands` itself, not from a re-derivation of it, so
`--mutant` (which solves with `opponent="mylist"`, model D of the spec) makes the figure MOVE:
a measurement that cannot move is not evidence.

    python3 tests/artifacts/_opponent_gap_measure.py [--mutant]
"""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, "scripts"))

from solve_edge_values import Model, Opts, load_graph, flip  # noqa: E402

PAYLOAD = os.path.join(REPO, "source", "quartz", "static", "neural", "graph-data.json")


def shipped_pools():
    """Reproduce `opponentDefend`'s gather, per position hub, from the shipped payload."""
    with open(PAYLOAD, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    nodes = data["nodes"]
    adj = [[] for _ in nodes]
    for l in data["links"]:
        a, b = (l[0], l[1]) if isinstance(l, list) else (None, None)
        if a is None or b is None or a == b:
            continue
        adj[a].append(b)
        adj[b].append(a)
    pools = {}
    for i, n in enumerate(nodes):
        if n["ty"] != "positions":
            continue
        seen = set()
        for k in adj[i]:                      # `opponentDefend`: skip positions, dedupe by title
            m = nodes[k]
            if m["ty"] == "positions":
                continue
            seen.add(m["t"])
        pools[str(n.get("posId") or "").lower()] = seen
    return pools


def main():
    mutant = "--mutant" in sys.argv
    opts = Opts(opponent="mylist") if mutant else Opts()
    if mutant:
        print("MUTANT: opponent=\"mylist\" -- the model's opponent draws MY list, not the pair's.")
    g = load_graph()
    m = Model(g, opts)
    pools = shipped_pools()

    # every authored move of a hub, both roles, unfiltered -- reading C
    hub_all = {}
    for key, node in g["positions"].items():
        if not (key.endswith("/top") or key.endswith("/bottom")):
            continue
        hub_all.setdefault(node["hub"], set()).update(
            t["technique"] for t in (node.get("transitions") or []))

    def no_origin(key):
        """`build_hand`'s picks BEFORE the origin narrowing -- reading D."""
        node = g["positions"][key]
        out = set()
        for t in node.get("transitions") or []:
            if float(t["attemptProbabilityByRuleset"][Opts().frame]) <= 0:
                continue
            cat = "submissions" if t.get("isSubmission") else "transitions"
            tech = g[cat].get(t["target"] + "/attacker")
            if tech is None or tech.get("fromRole") != node["role"]:
                continue
            out.add(t["technique"])
        return out

    rows = []
    missing = 0
    for i, s in enumerate(m.states):
        hub = g["positions"][s]["hub"]
        pool = pools.get(hub)
        if pool is None:
            missing += 1
            continue
        mine = {a.name for a in m.hands[i]}
        theirs = {a.name for a in m.opp_hands[i]}   # THE SEAM, read directly -- see --mutant
        rows.append((s, pool, mine, theirs, hub_all.get(hub, set()), no_origin(flip(s))))

    n = len(rows)
    print("states: %d   (hubs unresolved in the payload: %d)" % (n, missing))
    tot_pool = sum(len(r[1]) for r in rows)
    print("\nSHIPPED  `opponentDefend` candidate pool")
    print("   total %d over %d states  =  %.1f per state" % (tot_pool, n, tot_pool / n))

    print("\nMODEL    four readings, against that same pool")
    print("   %-30s %-11s %-9s %-14s %s"
          % ("reading", "per state", "total", "share of pool", "outside the pool"))
    for tag, pick in (("A opponent-role-only", lambda r: r[3]),
                      ("B both roles", lambda r: r[2] | r[3]),
                      ("C hub union, unfiltered", lambda r: r[4]),
                      ("D A without the origin filter", lambda r: r[5])):
        tot = sum(len(pick(r)) for r in rows)
        inside = sum(len(pick(r) & r[1]) for r in rows)
        outside = tot - inside
        print("   %-30s %-11.2f %-9d %-14s %d"
              % (tag, tot / n, tot, "%.1f%%" % (100.0 * inside / tot_pool), outside))

    # the subset claim, on reading A
    strict = sum(1 for r in rows if r[3] <= r[1])
    print("\n   reading A is a strict subset of the shipped pool in %d of %d states" % (strict, n))
    # ...and reading A really is THEIR list.  Under the shipped `opponent="mirror"` it is my own
    # hand only where the pair happens to author the same moves; under `--mutant` it is mine in
    # all 272, which is what makes the count above evidence rather than arithmetic.
    print("   reading A == MY OWN hand in %d of %d states"
          % (sum(1 for r in rows if r[3] == r[2]), n))
    off = [(r[0], sorted(r[3] - r[1])) for r in rows if not (r[3] <= r[1])]
    for s, names in off[:6]:
        print("      %-34s %d not in pool: %s" % (s, len(names), ", ".join(names[:3])))

    # what the over-inclusion is MADE of, on the shipped side
    by_name_role, by_name_origin = {}, {}
    for cat in ("transitions", "submissions"):
        for key, t in g[cat].items():
            if not key.endswith("/attacker"):
                continue
            by_name_role[t.get("name")] = t.get("fromRole")
            by_name_origin[t.get("name")] = t.get("fromPositionId")
    role_only = orig_only = both = clean = unknown = 0
    for s, pool, mine, theirs, _, _ in rows:
        role = g["positions"][s]["role"]
        opp_role = "bottom" if role == "top" else "top"
        hub = g["positions"][s]["hub"]
        for nm in pool:
            fr, fo = by_name_role.get(nm), by_name_origin.get(nm)
            if fr is None:
                unknown += 1
                continue
            wr, el = fr != opp_role, fo != hub
            if wr and el:
                both += 1
            elif wr:
                role_only += 1
            elif el:
                orig_only += 1
            else:
                clean += 1
    print("\n   THE SHIPPED POOL (%d cells) SPLIT AGAINST THE OPPONENT'S ROLE AND THIS HUB:" % tot_pool)
    for tag, v in (("the opponent's, from here", clean), ("wrong role only", role_only),
                   ("originates elsewhere only", orig_only), ("both wrong", both),
                   ("unresolved name", unknown)):
        print("      %-28s %6d  (%.1f%%)" % (tag, v, 100.0 * v / tot_pool))


if __name__ == "__main__":
    main()
