"""Equivalence proof for the graph-data wire compaction (v1.107.0). One-shot, kept as the
record of HOW the compaction was proven safe (CLAUDE.md cites it).

To re-run, first materialise the pre-compaction emitter from git:
    git show <pre-v1.107.0-rev>:scripts/regenerate_neural_data.py > scripts/_old_rnd_tmp.py
then:  python3 tests/artifacts/_verify_wire_equiv.py

Rebuilds the OLD graph-data structure (pre-change emitter, from git via scripts/_old_rnd_tmp.py)
and the NEW one, simulates the app's ingest() expansion over the new wire, and asserts that
every APP-VISIBLE read is identical:
  1. node identity/order/coords/titles/types/strength/ordinals/fromPositionId/fromRole/familyHub
  2. posId (incl. the technique-side reconstruction posId := posId || fromPositionId || null)
  3. cal.outcomes (expanded tuples == old objects, exact)
  4. calSuccess for both frames (successRateByRuleset trim is semantics-preserving)
  5. cal.avail (exact)
  6. links -> the [a,b] pair list the app builds (order + content), hence adj + deg
  7. the position half of _edgeW (ew vs moves-derived), tolerance 5e-5 (1/10000 quantization)
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "scripts"))


def load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


old = load_mod("old_rnd", os.path.join(ROOT, "scripts", "_old_rnd_tmp.py"))
layout = json.loads(open(os.path.join(ROOT, "source/quartz/static/globalGraphLayout.json")).read())
graph = json.loads(open(os.path.join(ROOT, "graph.json")).read())
ordinals = old.load_ordinals()
OLD = old.build_graph_data(layout, graph, ordinals)
NEW = json.loads(open(os.path.join(ROOT, "source/quartz/static/neural/graph-data.json")).read())

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)
        if len(fails) < 25:
            print("FAIL:", msg)


RESULT_WORD = {"s": "success", "f": "failure", "c": "counter"}
# The outcome-destination intern table (v1.144.0). `ingest()` resolves an integer slot through
# `data.toTab` and passes a string straight through; this simulation does the same, so a wrong
# index lands on the WRONG destination string and the exact comparison below goes red — which is
# the only reason interning is safe to ship. A wire without the table still compares as before.
TO_TAB = NEW.get("toTab") if isinstance(NEW.get("toTab"), list) else None


def to_of(v):
    return TO_TAB[v] if (TO_TAB is not None and isinstance(v, int)) else v

o_nodes, n_nodes = OLD["nodes"], NEW["nodes"]
check(len(o_nodes) == len(n_nodes), f"node count {len(o_nodes)} vs {len(n_nodes)}")

# ── 1+2: per-node scalar fields as the app ingests them (x || null semantics) ─────────────
def ing(v):
    return v if v is not None else None

for i, (a, b) in enumerate(zip(o_nodes, n_nodes)):
    for k in ("id", "x", "y", "t", "ty", "s", "fromRole", "o", "familyHub"):
        if a.get(k) != b.get(k):
            check(False, f"node {i} field {k}: {a.get(k)!r} vs {b.get(k)!r}")
    if a.get("fromPositionId") != b.get("fromPositionId"):
        check(False, f"node {i} fromPositionId: {a.get('fromPositionId')!r} vs {b.get('fromPositionId')!r}")
    # posId as the app reconstructs it: n.posId || n.fromPositionId || null
    old_posid = a.get("posId") or None
    new_posid = b.get("posId") or b.get("fromPositionId") or None
    if old_posid != new_posid:
        check(False, f"node {i} posId: {old_posid!r} vs reconstructed {new_posid!r}")

# ── 3+4+5: cal reads ──────────────────────────────────────────────────────────────────────
def cal_success(cal, frame):
    """port of app calSuccess over a node's cal (frame in gi|nogi)."""
    if not cal:
        return None
    br = cal.get("successRateByRuleset")
    v = br.get(frame) if isinstance(br, dict) and br.get(frame) is not None else cal.get("successRate")
    if not isinstance(v, (int, float)):
        return None
    return max(0.0, min(1.0, v / 100.0))

n_out_tuples = 0
for i, (a, b) in enumerate(zip(o_nodes, n_nodes)):
    ca, cb = a.get("cal"), b.get("cal")
    if a.get("ty") != "positions":
        # outcomes: expand new tuples, compare exactly (minus endingPosition, which is dead)
        oa = (ca or {}).get("outcomes")
        ob = (cb or {}).get("outcomes")
        if oa is None:
            check(ob is None, f"node {i}: outcomes appeared from nowhere")
        else:
            check(ob is not None, f"node {i}: outcomes lost")
            if ob is not None:
                exp = [
                    {"to": to_of(o[0]), "probability": o[1], "result": RESULT_WORD.get(o[2], o[2])}
                    for o in ob
                ]
                n_out_tuples += len(ob)
                if exp != oa:
                    check(False, f"node {i} outcomes differ:\n old={oa}\n new={exp}")
        for fr in ("gi", "nogi"):
            va, vb = cal_success(ca, fr), cal_success(cb, fr)
            if va != vb:
                check(False, f"node {i} calSuccess[{fr}]: {va} vs {vb}")
    if (ca or {}).get("avail") != (cb or {}).get("avail"):
        check(False, f"node {i} avail: {(ca or {}).get('avail')} vs {(cb or {}).get('avail')}")

# ── 6: links as the app builds them ───────────────────────────────────────────────────────
id_idx = {n["id"]: i for i, n in enumerate(o_nodes)}
old_pairs = []
for l in OLD["links"]:
    aa, bb = id_idx.get(l["source"]), id_idx.get(l["target"])
    if aa is None or bb is None or aa == bb:
        continue
    old_pairs.append([aa, bb])
new_pairs = [l for l in NEW["links"] if isinstance(l, list) and l[0] != l[1]]
check(old_pairs == new_pairs, f"link pairs differ: {len(old_pairs)} vs {len(new_pairs)}")

# ── 7: position half of _edgeW ────────────────────────────────────────────────────────────
by_name = {}
for i, nd in enumerate(o_nodes):
    if nd["ty"] != "positions" and nd["t"] not in by_name:
        by_name[nd["t"]] = i
worst = 0.0
n_ew = 0
for i, (a, b) in enumerate(zip(o_nodes, n_nodes)):
    if a.get("ty") != "positions":
        continue
    moves = (a.get("cal") or {}).get("moves") or {}
    old_w = {}
    for role in ("top", "bottom"):
        for m in moves.get(role) or []:
            ti = by_name.get(m.get("technique"))
            if ti is None:
                continue
            w = max(0.0, (m.get("attemptProbability") or 0) / 100.0) * max(0.0, (m.get("successRate") or 0) / 100.0)
            if w > old_w.get(ti, 0.0):
                old_w[ti] = w
    new_w = {e[0]: e[1] / 10000.0 for e in ((b.get("cal") or {}).get("ew") or [])}
    n_ew += len(new_w)
    # every old edge with weight that rounds >= 1e-4 must be present within quantization
    for ti, w in old_w.items():
        if round(w * 10000) <= 0:
            continue
        if ti not in new_w:
            check(False, f"pos {i} ew missing edge to {ti} (old w={w})")
            continue
        worst = max(worst, abs(new_w[ti] - w))
    for ti in new_w:
        if ti not in old_w:
            check(False, f"pos {i} ew extra edge to {ti}")
check(worst <= 5e-5 + 1e-12, f"ew worst quantization error {worst}")

print(f"\nchecked {len(o_nodes)} nodes, {len(old_pairs)} link pairs, {n_out_tuples} outcome tuples, {n_ew} ew edges")
print("worst ew quantization error:", worst)
print("RESULT:", "PASS" if not fails else f"{len(fails)} FAILURES")
sys.exit(1 if fails else 0)
