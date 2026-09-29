#!/usr/bin/env python3
"""
What would it COST to ship the semantics? Measured, not estimated.

The eager-payload gate (`tests/artifacts/payload_policy.json`, `neural.eager_gzip_bytes`) gzips each
eager file SEPARATELY and caps any one change at +5,000 bytes. `graph-data.json` is eager (the boot
fetches it). So a proposal's price is gzip(graph-data.json with the addition) - gzip(graph-data.json),
measured on the file THIS worktree's emitter wrote (`python3 scripts/regenerate_neural_data.py`,
gitignored output) — never on a stale copy from another checkout (see the memory note on the owner's
:8080 serving a days-old public dir).

Each candidate below is written with REAL values from the kernel and the lane artifacts where they
exist, because gzip prices ENTROPY: a placeholder of the right length but the wrong distribution
measures the wrong thing. Candidates whose data is not computed yet are skipped and SAY so.

    python3 scripts/semantics/payload_probe.py            # the table
    python3 scripts/semantics/payload_probe.py --json out.json

Level 9 is what `scripts/check_payload_budget.py` uses (verified by reading it at run time and
printed); if that ever changes this probe says so rather than measuring at the wrong level.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import json
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

WIRE = os.path.join(REPO, "source/quartz/static/neural/graph-data.json")
ART = os.path.join(REPO, "tests/artifacts/semantics")


def gz_level():
    """Read the gzip level the payload gate actually uses, instead of assuming it."""
    src = open(os.path.join(REPO, "scripts/check_payload_budget.py")).read()
    m = re.findall(r"compresslevel\s*=\s*(\d+)", src) + re.findall(r"gzip\.compress\(.+?,\s*(\d+)\)", src)
    if len(set(m)) != 1:
        # NEVER default: a probe that silently measures at the wrong level prints a plausible delta
        raise SystemExit("[payload_probe] could not read ONE gzip level from check_payload_budget.py "
                         "(found %r) — refusing to guess" % (m,))
    return int(m[0])


def gz(obj, level):
    return len(gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode(), level))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--json")
    a = ap.parse_args(argv)
    if not os.path.exists(WIRE):
        print("no emitted wire at %s — run `python3 scripts/regenerate_neural_data.py` first" % WIRE)
        return 1
    level = gz_level()
    base = json.load(open(WIRE))
    b0 = gz(base, level)
    from _kernel import load_kernel
    K = load_kernel("nogi", "symmetric")
    Kg = load_kernel("gi", "symmetric")
    g = K.graph
    pos_nodes = [n for n in base["nodes"] if n.get("ty") == "positions"]
    sub_nodes = [n for n in base["nodes"] if n.get("ty") == "submissions"]
    rows, skipped = [], []
    from _geometry_methods import load_shipped_layout
    lay = load_shipped_layout()
    sub_hub = {}
    for cat in ("submissions",):
        for hub, rec in (lay.get(cat) or {}).items():
            sub_hub[rec["layout_id"]] = hub

    def add(name, mutate, note):
        w = copy.deepcopy(base)
        touched = mutate(w)
        rows.append({"candidate": name, "nodes_touched": touched, "gzip_delta": gz(w, level) - b0,
                     "note": note})

    # 1. per-hub committor, both seats, both frames, as 0..100 integers (the "whose position" dial)
    def committor(w):
        n = 0
        seen = set()
        for KK, fr in ((K, "nogi"), (Kg, "gi")):
            B, _ = KK.absorption()
            for node in w["nodes"]:
                if node.get("ty") != "positions":
                    continue
                hub = node.get("posId")
                qs = []
                for role in ("top", "bottom"):
                    s = "%s/%s" % (hub, role)
                    i = KK.index.get(s)
                    qs.append(int(round(100 * B[i, 0])) if i is not None else None)
                node.setdefault("sem", {})["q" + ("n" if fr == "nogi" else "g")] = qs
                seen.add(node["id"])
        return len(seen)
    add("committor per seat, both frames (0-100)", committor,
        "P(I finish | my turn here), H=inf, symmetric rule; 2 ints x 2 frames per position hub")

    # 2. per-submission body-region class (1 char) — what an in-browser exit-law needs
    lex_path = os.path.join(ART, "vocabulary.json")
    if os.path.exists(lex_path):
        voc = json.load(open(lex_path))
        cls = {}
        for k, v in (voc.get("techniques") or {}).items():
            if not isinstance(v, dict) or v.get("kind") != "submission":
                continue
            c = (v.get("body_region") or {}).get("class")
            if c:
                cls[v.get("hub") or k.split("/")[0]] = c
        if cls:
            # AN INJECTIVE ONE-CHAR CODE. The first letter is NOT injective (SHOULDER and
            # SPINE/COMPRESSION both start with S — caught by gs-2 in S3), and a non-injective
            # code prices a field that cannot be decoded. Asserted, not assumed.
            code = {"CHOKE": "C", "LEG": "L", "SHOULDER": "S", "ARM": "A",
                    "SPINE/COMPRESSION": "P", "HIP/GROIN": "H"}
            if set(cls.values()) - set(code) or len(set(code.values())) != len(code):
                raise SystemExit("[payload_probe] class code is not total+injective over %s"
                                 % sorted(set(cls.values())))
            def region(w):
                n = 0
                for node in w["nodes"]:
                    if node.get("ty") != "submissions":
                        continue
                    hub = sub_hub.get(node["id"])
                    c = cls.get(hub) if hub else None
                    if c:
                        node["br"] = code[c]
                        n += 1
                if n < len(sub_nodes):
                    # a partial join prices a smaller addition than the real one (CLAUDE.md 6.6)
                    raise SystemExit("[payload_probe] body-region join covered %d of %d submission "
                                     "nodes on the wire — refusing to price a partial join" % (n, len(sub_nodes)))
                return n
            add("body-region class per submission (1 char)", region,
                "enables an in-browser exit-law / territory computation from cal.ev + cal.outcomes")
        else:
            skipped.append("body-region class: vocabulary.json has no per-submission class field yet")
    else:
        skipped.append("body-region class: tests/artifacts/semantics/vocabulary.json not written yet")

    # 3. per-hub territory label (small int) + a names table at the top level
    nm_path = os.path.join(ART, "naming.json")
    if os.path.exists(nm_path):
        nm = json.load(open(nm_path))
        hubs = nm.get("hubs") or {}
        names = sorted({(v.get("best_name") or "") for v in hubs.values() if isinstance(v, dict)} - {""})
        if names:
            ix = {x: i for i, x in enumerate(names)}

            def terr(w):
                n = 0
                w["terr"] = names
                for node in w["nodes"]:
                    if node.get("ty") != "positions":
                        continue
                    v = hubs.get(node.get("posId")) or {}
                    if v.get("best_name") in ix:
                        node["tr"] = ix[v["best_name"]]
                        n += 1
                return n
            add("territory label per position hub + names table", terr,
                "precomputed at build time from the exit law; %d names" % len(names))
        else:
            skipped.append("territory label: naming.json has no hubs[*].best_name yet")
    else:
        skipped.append("territory label: tests/artifacts/semantics/naming.json not written yet")

    # 4. the full exit profile per seat (5 regions x me/them, 0..99) — the upper bound
    B, _ = K.exit_law()
    meta = K.fin_meta()
    types = sorted({m["type"] or "?" for m in meta})

    def profile(w):
        n = 0
        tix = {t: i for i, t in enumerate(types)}
        col_t = np.array([tix[m["type"] or "?"] for m in meta])
        me = np.array([m["performer"] == "me" for m in meta])
        for node in w["nodes"]:
            if node.get("ty") != "positions":
                continue
            hub = node.get("posId")
            prof = []
            for role in ("top", "bottom"):
                i = K.index.get("%s/%s" % (hub, role))
                if i is None:
                    prof.append(None)
                    continue
                v = []
                for side in (me, ~me):
                    for t in range(len(types)):
                        v.append(int(round(99 * B[i, (col_t == t) & side].sum())))
                prof.append(v)
            node.setdefault("sem", {})["xp"] = prof
            n += 1
        return n
    add("full exit profile by raw submission type x performer per seat (upper bound)", profile,
        "%d raw types x 2 performers x 2 seats per hub, nogi only" % len(types))

    print("eager file: graph-data.json  base gzip %d B (level %d)  cap per change: 5,000 B" % (b0, level))
    for r in rows:
        print("  %+7d B  %-72s  (%d nodes)  %s" % (r["gzip_delta"], r["candidate"], r["nodes_touched"], r["note"]))
    for s in skipped:
        print("  SKIPPED  %s" % s)
    if not rows:
        print("FAIL: priced 0 candidates")
        return 1
    if a.json:
        import hashlib
        sha = lambda f: hashlib.sha256(open(f, "rb").read()).hexdigest()
        json.dump({"base_gzip": b0, "level": level, "rows": rows, "skipped": skipped,
                   "meta": {"graph_sha256": sha(os.path.join(REPO, "graph.json")),
                            "wire_sha256": sha(WIRE),
                            "recompute": "python3 scripts/regenerate_neural_data.py && "
                                         "python3 -B scripts/semantics/payload_probe.py --json " + a.json}},
                  open(a.json, "w"), indent=1, sort_keys=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
