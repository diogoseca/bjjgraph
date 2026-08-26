"""Equivalence proof for the outcome-destination intern (v1.144.0). One-shot, kept as the
record of HOW the compaction was proven safe — the sibling of _verify_wire_equiv.py, which is
the same argument for the v1.107.0 compaction.

To re-run, first materialise the pre-intern emitter from git:
    git show <pre-v1.144.0-rev>:scripts/regenerate_neural_data.py > scripts/_old_rnd_tmp.py
then:  python3 tests/artifacts/_verify_wire_intern.py    (and delete _old_rnd_tmp.py after)

WHY THIS IS A WHOLE-STRUCTURE DIFFERENTIAL AND NOT A FIELD SWEEP. The intern is a pure
substitution — every `cal.outcomes[i][0]` string replaced by its index into a new top-level
`toTab`, nothing else touched — so DECODING it must reproduce the previous emitter's structure
EXACTLY, key order included. That is a much stronger claim than "the fields I remembered to
check agree", and §6.6 is explicit about why the weaker form is worthless here: a wrong-but-
complete remap satisfies every non-null count perfectly while printing a different technique's
destination on every card. So this compares the serialized bytes of both structures, and it
carries a non-triviality floor (§6.6) so it cannot pass on an empty decode.

It also asserts what the interning is FOR: that the table is smaller than the references it
replaces, and that it is exhaustive (no residual string left in an outcome slot).
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


OLD_EMITTER = os.path.join(ROOT, "scripts", "_old_rnd_tmp.py")
if not os.path.exists(OLD_EMITTER):
    sys.exit(
        "materialise the pre-intern emitter first:\n"
        "  git show <pre-v1.144.0-rev>:scripts/regenerate_neural_data.py > scripts/_old_rnd_tmp.py"
    )

old = load_mod("old_rnd", OLD_EMITTER)
layout = json.loads(open(os.path.join(ROOT, "source/quartz/static/globalGraphLayout.json")).read())
graph = json.loads(open(os.path.join(ROOT, "graph.json")).read())
OLD = old.build_graph_data(layout, graph, old.load_ordinals())
NEW = json.loads(open(os.path.join(ROOT, "source/quartz/static/neural/graph-data.json")).read())

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)
        print("FAIL:", msg)


tab = NEW.pop("toTab", None)
check(isinstance(tab, list) and len(tab) > 0, f"toTab is not a non-empty list: {type(tab)}")
tab = tab or []

# ── decode: exactly what ingest() does, on exactly the shipped wire ───────────────────────────
decoded = 0
strings_left = 0
for n in NEW["nodes"]:
    for o in (n.get("cal") or {}).get("outcomes") or []:
        if isinstance(o[0], int):
            check(0 <= o[0] < len(tab), f"outcome slot {o[0]} is outside a {len(tab)}-entry table")
            o[0] = tab[o[0]]
            decoded += 1
        else:
            strings_left += 1

# ── non-triviality floors (§6.6): an empty decode must never read as agreement ────────────────
check(decoded >= 4000, f"only {decoded} outcome references decoded — floor is 4000")
check(strings_left == 0, f"{strings_left} outcome slots were still strings — the intern is partial")
check(len(tab) < decoded / 4, f"table of {len(tab)} for {decoded} references is not worth interning")

# ── the whole structure, serialized, byte for byte ────────────────────────────────────────────
so = json.dumps(OLD, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
sn = json.dumps(NEW, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
check(so == sn, f"decoded wire differs from the pre-intern emitter ({len(so)} B vs {len(sn)} B)")
if so != sn:
    for i in range(min(len(so), len(sn))):
        if so[i] != sn[i]:
            print("  first divergence at byte", i)
            print("   old:", so[max(0, i - 90):i + 90])
            print("   new:", sn[max(0, i - 90):i + 90])
            break

print(
    f"\nchecked {len(NEW['nodes'])} nodes, {decoded} outcome references through a "
    f"{len(tab)}-entry table, {len(so):,} B of decoded wire against {len(so):,} B of "
    f"pre-intern emitter output"
)
print("RESULT:", "PASS" if not fails else f"{len(fails)} FAILURES")
sys.exit(1 if fails else 0)
