#!/usr/bin/env python3
"""THE MISS DISTRIBUTION: what resolve() actually rolls, vs the authored kernel EDGE prices.

Reads the WIRE (source/quartz/static/neural/graph-data.json), reproduces resolve()'s outcome
selection exactly, and compares it against the within-branch kernel the EDGE solver assumes.

  SHIPPED (before this fix):  draw one row from the WHOLE table ~ w; roll Bernoulli(p) for the
                              branch; if the drawn row's branch disagrees, DISCARD it and take the
                              FIRST matching row (outcomes.find).
  AUTHORED (the model):       roll Bernoulli(p) for the branch; draw the row from the authored
                              weights RENORMALISED INSIDE that branch.

Both put mass p on the success branch and 1-p on the miss branch, so the total-variation distance
decomposes per branch and is exact in closed form -- no sampling.

This is the ANALYTIC before-picture and the counter-mass accounting. The before/after evidence from
the REAL bundle is `tests/artifacts/_resolve_kernel_probe.mjs`, which drives the shipped `resolve()`
itself; the two agree to grid resolution, which is what makes neither of them a re-implementation
trusted on its own.

  python3 tests/artifacts/_resolve_kernel_measure.py            # no-gi (the default frame)
  python3 tests/artifacts/_resolve_kernel_measure.py --frame gi
"""
import json
import sys
import os

RESULT_WORD = {"s": "success", "f": "failure", "c": "counter"}
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load(frame):
    d = json.load(open(os.path.join(ROOT, "source/quartz/static/neural/graph-data.json")))
    out = []
    for n in d["nodes"]:
        c = n.get("cal")
        if not c or not c.get("outcomes"):
            continue
        rows = []
        for o in c["outcomes"]:
            if isinstance(o, list):
                rows.append({"to": o[0], "probability": o[1], "result": RESULT_WORD.get(o[2], o[2])})
            else:
                rows.append(o)
        br = c.get("successRateByRuleset") or {}
        p = br[frame] if br.get(frame) is not None else c.get("successRate")
        out.append({"id": n["id"], "t": n["t"], "ty": n["ty"], "rows": rows,
                    "p": None if p is None else max(0.0, min(1.0, p / 100.0))})
    return out


def kernels(rows, p):
    """(shipped, authored) as lists row-index -> probability."""
    w = [max(0.0, float(r.get("probability") or 0)) for r in rows]
    W = sum(w)
    if W <= 0:
        return None, None
    succ = [i for i, r in enumerate(rows) if r["result"] == "success"]
    miss = [i for i, r in enumerate(rows) if r["result"] != "success"]
    Ws, Wm = sum(w[i] for i in succ), sum(w[i] for i in miss)

    ship = [0.0] * len(rows)
    auth = [0.0] * len(rows)
    # ---- shipped (pre-fix): one draw over the whole table, then coerce to the first row of the branch
    for i in range(len(rows)):
        q = w[i] / W                       # P(this row is the one drawn)
        is_s = rows[i]["result"] == "success"
        # success gate (mass p)
        if is_s:
            ship[i] += p * q
        else:
            tgt = succ[0] if succ else i   # .find(success) || out  -- `out` is this very row
            ship[tgt] += p * q
        # miss gate (mass 1-p)
        if not is_s:
            ship[i] += (1 - p) * q
        else:
            tgt = miss[0] if miss else i   # .find(non-success) || out
            ship[tgt] += (1 - p) * q
    # ---- authored: branch by p, row by renormalised weight inside the branch
    for i in succ:
        auth[i] += (p * w[i] / Ws) if Ws > 0 else 0.0
    for i in miss:
        auth[i] += ((1 - p) * w[i] / Wm) if Wm > 0 else 0.0
    if Ws <= 0:      # empty success branch: the shipped fallback keeps the drawn miss row
        for i in miss:
            auth[i] += p * w[i] / Wm
    if Wm <= 0:
        for i in succ:
            auth[i] += (1 - p) * w[i] / Ws
    return ship, auth


def diverge(rows, gate):
    """Measure of rigged draws u in [0,1) that land on a DIFFERENT cell before vs after the fix,
    for a pre-decided branch. Exact: both procedures are step functions of u with <=5 breakpoints,
    so intersect the intervals. This is the number that says how often a RIGGED replay changes."""
    w = [max(0.0, float(r.get("probability") or 0)) for r in rows]
    W = sum(w)
    if W <= 0:
        return 0.0
    want = bool(gate)
    sub = [i for i, r in enumerate(rows) if (r["result"] == "success") == want]
    other = [i for i, r in enumerate(rows) if (r["result"] == "success") != want]
    if not sub:
        return 0.0
    Wb = sum(w[i] for i in sub)
    first = sub[0]

    def bands(idx_order, weights, total, coerce_to):
        """[(lo, hi, row)] over u, using the app's cumulative walk."""
        out, cum = [], 0.0
        for i in idx_order:
            lo, hi = cum / total, (cum + weights[i]) / total
            out.append((lo, hi, i if coerce_to is None or i in sub else coerce_to))
            cum += weights[i]
        return out

    before = bands(range(len(rows)), w, W, first)      # whole table, coerced to the first in-branch row
    after = bands(sub, w, Wb, None)                    # branch only, renormalised
    same = 0.0
    for lo1, hi1, r1 in before:
        for lo2, hi2, r2 in after:
            if r1 != r2:
                continue
            lo, hi = max(lo1, lo2), min(hi1, hi2)
            if hi > lo:
                same += hi - lo
    _ = other
    return max(0.0, 1.0 - same)


def main():
    frame = "nogi"
    if "--frame" in sys.argv:
        frame = sys.argv[sys.argv.index("--frame") + 1]
    nodes = load(frame)
    tvs, counter_lost, rows_ending_counter, empty_branch = [], [], 0, 0
    zero, over10 = 0, 0
    worst = []
    ship_counter_mass, auth_counter_mass = 0.0, 0.0
    for n in nodes:
        rows, p = n["rows"], n["p"]
        if p is None:
            continue
        if rows and rows[-1]["result"] == "counter":
            rows_ending_counter += 1
        succ = [r for r in rows if r["result"] == "success"]
        miss = [r for r in rows if r["result"] != "success"]
        if not succ or not miss:
            empty_branch += 1
        ship, auth = kernels(rows, p)
        if ship is None:
            continue
        tv = 0.5 * sum(abs(ship[i] - auth[i]) for i in range(len(rows)))
        tvs.append(tv)
        if tv == 0:
            zero += 1
        if tv > 0.10:
            over10 += 1
        cs = sum(ship[i] for i, r in enumerate(rows) if r["result"] == "counter")
        ca = sum(auth[i] for i, r in enumerate(rows) if r["result"] == "counter")
        ship_counter_mass += cs
        auth_counter_mass += ca
        counter_lost.append(ca - cs)
        worst.append((tv, n["id"], ca - cs))
    tvs.sort()
    worst.sort(reverse=True)
    n = len(tvs)
    print("frame                  %s" % frame)
    print("nodes with outcomes    %d   (measured %d)" % (len(nodes), n))
    print("outcome lists ending in a counter  %d of %d" % (rows_ending_counter, len(nodes)))
    print("nodes with an empty branch          %d" % empty_branch)
    print("TV  mean %.4f  median %.4f  max %.4f" % (sum(tvs) / n, tvs[n // 2], tvs[-1]))
    # 88 nodes land ON 0.10 to within float noise, so "> 0.10" is a knife-edge count: strict
    # comparison says 276, at-or-above says 306 — which is exactly what the grid-sampled browser
    # probe of the same kernel reports. Both are right about the kernel; only the tie-break
    # differs. Print both so nobody reads the gap as a disagreement between the two measurements.
    ties = sum(1 for x in tvs if abs(x - 0.10) < 1e-12)
    atleast = sum(1 for x in tvs if x >= 0.10 - 1e-12)
    print("TV == 0 on %d of %d ;  > 0.10 on %d (%.1f%%) ;  >= 0.10 on %d  [%d nodes sit on 0.10 to float noise]"
          % (zero, n, over10, 100.0 * over10 / n, atleast, ties))
    print("counter mass  authored %.4f   shipped %.4f   LOST %.4f  (mean per node %.5f)"
          % (auth_counter_mass, ship_counter_mass, auth_counter_mass - ship_counter_mass,
             (auth_counter_mass - ship_counter_mass) / n))
    print("counter mass relative loss  %.2f%%" % (100.0 * (auth_counter_mass - ship_counter_mass) / auth_counter_mass))
    # How often a RIGGED draw now lands somewhere else — the "does a replay move?" number.
    dv_s = [diverge(n["rows"], True) for n in nodes if n["p"] is not None]
    dv_m = [diverge(n["rows"], False) for n in nodes if n["p"] is not None]
    print("rigged-draw divergence  success gate %.2f%% of u  (0%% on %d of %d nodes) ;  miss gate %.2f%%"
          % (100.0 * sum(dv_s) / len(dv_s), sum(1 for x in dv_s if x < 1e-12), len(dv_s),
             100.0 * sum(dv_m) / len(dv_m)))
    print("worst 5 by TV:")
    for tv, i, cl in worst[:5]:
        print("   %.4f  %-58s counter lost %.4f" % (tv, i, cl))


main()
