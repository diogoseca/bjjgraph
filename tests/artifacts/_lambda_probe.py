#!/usr/bin/env python3
"""Where does "slightly loss-averse" actually sit, and does mount outrank side control?

Two questions, both from the owner's framing:

  (a) The shipped presets are lam in (1, 2, 4), labelled in the emitter comment
      "Winning / Balanced / Not getting caught".  V = p_win - lam*p_loss, so
      lam=1 is the SYMMETRIC point (a win is worth exactly what a loss costs)
      and lam=2 is already 2x loss-averse.  The owner picked "slightly
      loss-averse" as the DEFAULT.  Does any emitted preset sit where they
      meant, or is the middle rung mislabelled?

  (b) "typically in self-defence they really don't want to lose. That's why they
      prioritize mount over side control because it's more for the street" -- a
      falsifiable prediction.  Walk every role-hand offering BOTH a move that
      lands in mount and one that lands in side control, and watch the ranking
      as lam rises.

NB `Action.target` is the TECHNIQUE's own slug, not a landing position.  The
landing is in `succ`, whose cells are `_cell_outcome` tuples: `(W,)` for a
finish or `(S, state, keeps_turn)` otherwise.  Deriving the hub from `target`
reports "0 of 272 hands offer both", which is an artifact of reading the wrong
field.

Run:  python3 tests/artifacts/_lambda_probe.py
"""
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, "scripts"))

from solve_edge_values import (HORIZON_MIX, Model, Opts, load_graph,  # noqa: E402
                               solve_mixture)

LAMS = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0]
graph = load_graph()
opts = Opts(frame="nogi")
model = Model(graph, opts)
sols = {}
for lam in LAMS:
    sols[lam] = solve_mixture(model, lam, HORIZON_MIX, opts)
    print("solved lam=%.1f" % lam, file=sys.stderr)

states = sorted(sols[1.0].q.keys())
HANDS = {s: {a.name: a for a in model.hands[model.index[s]]} for s in states}


def lands_in(st, name, hub):
    """True when this move's SUCCESS branch can put you in `hub`."""
    a = HANDS[st].get(name)
    if not a:
        return False
    for _w, cell in a.succ:
        if cell[0] == "S" and cell[1].split("/")[0] == hub:
            return True
    return False


print("\n== (a) HOW MUCH DOES THE DIAL ACTUALLY MOVE? (272 role-hands) ==")
print("  measured against lam=2, today's default block")
print("  %-6s %9s %9s %10s %11s" % ("lam", "topflip", "reorder", "maxdEDGE", "meanV"))
base = sols[2.0]
for lam in LAMS:
    s = sols[lam]
    topflip = reorder = maxd = 0
    for st in states:
        a = [r["name"] for r in base.q[st]]
        b = [r["name"] for r in s.q[st]]
        if not a:
            continue
        topflip += a[0] != b[0]
        reorder += a != b
        eb = base.edge[st]
        for n, e in s.edge[st].items():
            if n in eb:
                maxd = max(maxd, abs(e - eb[n]))
    mv = sum(s.v[st] for st in states) / len(states)
    print("  %-6.1f %9d %9d %10d %11.4f" % (lam, topflip, reorder, maxd, mv))

print("\n== (b) MOUNT vs SIDE CONTROL, in hands that offer a move into both ==")
rows = []
for st in states:
    names = [r["name"] for r in sols[1.0].q[st]]
    m = [n for n in names if lands_in(st, n, "mount")]
    sc = [n for n in names if lands_in(st, n, "side-control")]
    if m and sc:
        rows.append((st, m, sc))
print("  %d of %d role-hands offer BOTH" % (len(rows), len(states)))
print()
print("  %-24s %-30s %-30s" % ("state", "best->mount", "best->side-control")
      + "".join("%7.1f" % l for l in LAMS))
flip = {l: 0 for l in LAMS}
for st, m, sc in rows:
    cells = []
    for lam in LAMS:
        e = sols[lam].edge[st]
        cells.append(max(e[n] for n in m) - max(e[n] for n in sc))
        if cells[-1] > 0:
            flip[lam] += 1
    bm = max(m, key=lambda n: sols[2.0].edge[st][n])
    bs = max(sc, key=lambda n: sols[2.0].edge[st][n])
    print("  %-24s %-30s %-30s" % (st[:24], bm[:30], bs[:30])
          + "".join("%+7d" % d for d in cells))
print()
print("  mount's best EDGE strictly ABOVE side control's best (of %d hands):" % len(rows))
for lam in LAMS:
    print("    lam=%-5.1f  %2d / %d" % (lam, flip[lam], len(rows)))

print("\n== (b2) THE POSITIONS THEMSELVES ==")
print("  %-6s %11s %11s %9s %11s %11s"
      % ("lam", "V(mnt/top)", "V(sc/top)", "diff", "ploss(mnt)", "ploss(sc)"))
for lam in LAMS:
    s = sols[lam]
    print("  %-6.1f %11.4f %11.4f %9.4f %11.4f %11.4f"
          % (lam, s.v["mount/top"], s.v["side-control/top"],
             s.v["mount/top"] - s.v["side-control/top"],
             s.ploss["mount/top"], s.ploss["side-control/top"]))

print("\n== (c) SIDE-CONTROL/TOP: the positional advances, per lam ==")
st = "side-control/top"
names = [r["name"] for r in sols[2.0].q[st] if r["cat"] != "submissions"]
print("  %-38s %6s" % ("move", "att%") + "".join("%7.1f" % l for l in LAMS))
for n in names:
    att = HANDS[st][n].weight * 100
    print("  %-38s %5.1f%%" % (n[:38], att)
          + "".join("%+7d" % sols[l].edge[st][n] for l in LAMS))
print()
print("  rank of 'Side Control to Mount' among all %d dealt:" % len(sols[2.0].q[st]))
for lam in LAMS:
    order = [r["name"] for r in sols[lam].q[st]]
    print("    lam=%-5.1f  rank %2d" % (lam, order.index("Side Control to Mount") + 1))
