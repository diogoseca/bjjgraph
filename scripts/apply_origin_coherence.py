#!/usr/bin/env python3
"""Origin coherence — the listings the origin filter could never deal, fixed in content.

WHAT WAS WRONG (docs/GraphSemantics.md §1.4, §10 item 4). Every technique is authored FROM one
position-role, its canonical origin (`fromPositionId` + `fromRole`), and its outcome table is
written for that origin. The game — `solve_edge_values.build_hand`, the app's `optionsFor`, and
since v1.210.0 the reachability walk `regenerate_neural_data.frame_reachable` — deals a listed card
only at that origin. On the v1.206.2 graph 41 no-gi / 40 gi techniques were listed ONLY away from
their origin, so the corpus's game dealt them nowhere (the app dealt them at the origin through
layout adjacency, with no attempt share and so no EDGE). Their origin simply never listed them.

WHAT THIS DOES. It applies a panel's verdict to content/Positions/*.json, container by container
(one position-role each), in three kinds of change:

  add      list an orphan at its origin with a per-frame attempt share. The share is funded either
           PROPORTIONALLY (every existing cell of that frame shrinks in proportion) or from ONE
           named TWIN — an existing listing the panel judged to be the same behaviour under another
           name, which gives up the share instead.
  phantom  null a no-gi cell on a move that, as authored, cannot exist in no-gi (its origin is a
           gi-only guard or marks it absent), moving the freed points proportionally or to one
           named listing that is the real no-gi version of what the cell described.
  judge    a verdict only — whether a coherent away-from-origin listing should be dealt where it is
           listed. Nothing in content changes for it here; the verdict is recorded for the
           generic-move follow-up (see `follow_ups` in the provenance).

THE PANEL IS NOT EXPERT DATA. It is the repo's elicitation process run with LLM personas: ten
coaching-profile archetypes (the Q3 occurrence Delphi's profiles and weights, keyed here by
archetype, never by a person), each casting an independent ballot on every container, blind to the
others, then aggregated in code. ONE ROUND ONLY: the Q3 Delphi followed its first round with a
deliberation per container and a verify pass; this run has neither, so every number here is the
weighted aggregate of ten independent first-round ballots and says so in the provenance's `meta`.
Its numbers are a calibrated prior with named provenance, never a measurement, and nothing here may
call them "expert".

AGGREGATION IS PURE CODE, and it reuses Q3's weights so the two layers mean the same thing:
`occurrence_moe.expert_weight` (specialty bonus x ruleset affinity) and
`occurrence_moe.floor_preserving_round` (largest remainder to exactly 100, floor 1 on every
available cell). A frame is null only when more than half the panel's weight votes null, and every
null vote carries a reason. A zero cell that is already authored stays zero (it exists and is never
attempted); a null cell stays null.

    python3 scripts/apply_origin_coherence.py --aggregate --ballots DIR --packs DIR --meta FILE  # ballots -> calibration/origin_coherence.json
    python3 scripts/apply_origin_coherence.py --dry-run                               # what would change
    python3 scripts/apply_origin_coherence.py                                         # write content
    python3 scripts/apply_origin_coherence.py --check                                 # content == provenance, exit 1 if not

`--aggregate` reads the gitignored working state (ballot files); the committed artifact is the
provenance it writes, which holds every ballot, so the aggregate can be re-derived from it alone
(`--reaggregate`). Deterministic: no randomness, containers and moves in sorted order.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json  # noqa: E402
from occurrence_moe import CONFIG as Q3, expert_weight, floor_preserving_round  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROVENANCE = ROOT / "calibration/origin_coherence.json"
FRAMES = ("gi", "nogi")
# The ten voting personas, by ARCHETYPE id: a coaching profile, never a person. Each one reuses the
# Q3 Delphi's weight profile for the same school of thought, so the value is the key Q3's
# `occurrence_moe.CONFIG` already carries for it.
ARCHETYPES = {
    "systems": "danaher", "pragmatist": "gordon", "leg-skeptic": "craig", "academic": "lachlan",
    "gi-fundamentalist": "roger", "guard-back": "marcelo", "gi-guard-modern": "mendes",
    "unorthodox": "bravo", "gi-to-nogi": "mikey", "fhl-scrambler": "kade",
}
EXPERTS = tuple(ARCHETYPES)
PROPORTIONAL = "proportional"


# ── aggregation ────────────────────────────────────────────────────────────────────────────────
def _w(expert, family, frame=None):
    """Q3's weight for one voice; a frame-free decision (a twin, a verdict) uses the mean of both."""
    key = ARCHETYPES[expert]
    if frame:
        return expert_weight(key, family, frame, Q3)
    return sum(expert_weight(key, family, f, Q3) for f in FRAMES) / len(FRAMES)


def _plurality(votes):
    """[(value, weight)] -> (winner, its weight share). Ties break on the value's text, so the
    result never depends on ballot order."""
    tot = {}
    for v, w in votes:
        tot[v] = tot.get(v, 0.0) + w
    if not tot:
        return None, 0.0
    win = sorted(tot.items(), key=lambda kv: (-kv[1], str(kv[0])))[0]
    return win[0], win[1] / sum(tot.values())


def aggregate_container(pack, ballots):
    """One container's final ballots -> the panel's verdict per question. Pure."""
    fam = pack["family"]
    by_expert = {b["expert"]: b for b in ballots}
    missing = [e for e in EXPERTS if e not in by_expert]
    if missing:
        raise SystemExit(f"[origin_coherence] {pack['key']}: no final ballot from {missing}")
    existing = {r["move"] for r in pack["current_hand"]}
    out = {"add": [], "judge": [], "phantom": []}

    for q in pack.get("moves_to_add", []):
        name, row = q["move"], {"move": q["move"], "ballots": {}}
        votes = {f: [] for f in FRAMES}
        fund, verdict, rehome, tables = [], [], [], {}
        for e in EXPERTS:
            ent = next((x for x in by_expert[e].get("add", []) if x.get("move") == name), None)
            if ent is None:
                raise SystemExit(f"[origin_coherence] {pack['key']}: {e} did not rule on {name!r}")
            row["ballots"][e] = {k: ent.get(k) for k in ("gi", "nogi", "null_reason", "fund_from",
                                                          "verdict", "rehome_to", "own_table_at", "note")}
            for f in FRAMES:
                votes[f].append((ent.get(f), _w(e, fam, f)))
            ff = ent.get("fund_from") or PROPORTIONAL
            fund.append((ff if ff in existing else PROPORTIONAL, _w(e, fam)))
            verdict.append((ent.get("verdict") or "list_here", _w(e, fam)))
            if ent.get("verdict") == "rehome" and ent.get("rehome_to"):
                rehome.append((ent["rehome_to"], _w(e, fam)))
            for k in ent.get("own_table_at") or []:
                tables[k] = tables.get(k, 0.0) + _w(e, fam)
        res = {}
        for f in FRAMES:
            tw = sum(w for _, w in votes[f])
            nw = sum(w for v, w in votes[f] if v is None)
            live = [(float(v), w) for v, w in votes[f] if v is not None]
            if nw * 2 > tw or not live:
                res[f] = None
            else:
                res[f] = max(1.0, sum(v * w for v, w in live) / sum(w for _, w in live))
            res[f + "_null_weight"] = round(nw / tw, 3)
        res["fund_from"], res["fund_support"] = _plurality(fund)
        res["verdict"], res["verdict_support"] = _plurality(verdict)
        res["rehome_to"] = _plurality(rehome)[0] if res["verdict"] == "rehome" else None
        wt = sum(_w(e, fam) for e in EXPERTS)
        res["own_table_at"] = sorted(k for k, w in tables.items() if w * 2 > wt)
        row["result"] = res
        row["already_listed_here"] = q.get("already_listed_here")
        out["add"].append(row)

    for q in pack.get("listings_to_judge", []):
        name, row = q["move"], {"move": q["move"], "ballots": {}}
        vs = []
        for e in EXPERTS:
            ent = next((x for x in by_expert[e].get("judge", []) if x.get("move") == name), None)
            if ent is None:
                raise SystemExit(f"[origin_coherence] {pack['key']}: {e} did not judge {name!r}")
            row["ballots"][e] = {"restore": bool(ent.get("restore")), "reason": ent.get("reason")}
            vs.append((bool(ent.get("restore")), _w(e, fam)))
        row["result"] = dict(zip(("restore", "support"), _plurality(vs)))
        out["judge"].append(row)

    for q in pack.get("phantom_cells", []):
        name, row = q["move"], {"move": q["move"], "frame": q["frame"], "ballots": {}}
        vs, to = [], []
        for e in EXPERTS:
            ent = next((x for x in by_expert[e].get("phantom", []) if x.get("move") == name), None)
            if ent is None:
                raise SystemExit(f"[origin_coherence] {pack['key']}: {e} did not rule on phantom {name!r}")
            row["ballots"][e] = {k: ent.get(k) for k in ("nogi", "nogi_mass_to", "reason")}
            vs.append((ent.get("nogi") or "keep", _w(e, fam)))
            m = ent.get("nogi_mass_to") or PROPORTIONAL
            if ent.get("nogi") == "null":
                to.append((m if (m in existing and m != name) else PROPORTIONAL, _w(e, fam)))
        verdict, sup = _plurality(vs)
        row["result"] = {"nogi": verdict, "support": sup,
                         "nogi_mass_to": _plurality(to)[0] if verdict == "null" else None}
        out["phantom"].append(row)
    return out


# ── the new hand ───────────────────────────────────────────────────────────────────────────────
def new_hand(before, verdict):
    """before: [{"move", "gi", "nogi"}] as authored; verdict: aggregate_container's output.
    Returns (after rows in authored order, new rows appended, sorted by name), plus a log.

    Per frame: twins give up their funded share first (floor 1; a shortfall joins the
    proportional pool); phantom cells go null and their points go to the named listing or into the
    pool; every remaining existing cell then scales so the frame sums to 100 with the new cells,
    and `floor_preserving_round` lands it on integers."""
    rows = [dict(r) for r in before]
    names = [r["move"] for r in rows]
    adds = {a["move"]: a["result"] for a in verdict["add"]}
    listed = {a["move"]: a for a in verdict["add"] if a.get("already_listed_here")}
    new_names = sorted(n for n in adds if n not in names)
    for n in new_names:
        rows.append({"move": n, "gi": None, "nogi": None})
    idx = {r["move"]: i for i, r in enumerate(rows)}
    log = []
    for f in FRAMES:
        cur = {r["move"]: r[f] for r in rows}
        new_cells = {}
        for n, res in adds.items():
            x = res[f]
            if n in listed and cur.get(n) is not None:
                continue                          # an authored cell of an already-listed move stays
            if x is None:
                continue                          # the panel says the move does not exist here in f
            new_cells[n] = float(x)
        raw = {m: (float(v) if v is not None else None) for m, v in cur.items() if m not in new_cells}
        # 1. phantom cells: null them; their points go to the named listing, or into the scale below
        for ph in verdict["phantom"]:
            if ph["frame"] != f or ph["result"]["nogi"] != "null":
                continue
            v = raw.get(ph["move"])
            if v is None:
                continue
            raw[ph["move"]] = None
            dst = ph["result"]["nogi_mass_to"]
            if dst and dst != PROPORTIONAL and raw.get(dst) is not None:
                raw[dst] += v
                log.append(f"{f}: {ph['move']} {v:g} -> null, points to {dst}")
            else:
                log.append(f"{f}: {ph['move']} {v:g} -> null, points shared proportionally")
        # 2. twins give up their funded share
        prop = 0.0
        for n, x in sorted(new_cells.items()):
            t = adds[n]["fund_from"]
            if t and t != PROPORTIONAL and raw.get(t) is not None and raw[t] > 0:
                take = min(x, raw[t] - 1.0)
                raw[t] -= take
                prop += x - take
                log.append(f"{f}: {n} {x:.2f} funded by twin {t} ({take:.2f}), {x - take:.2f} proportional")
            else:
                prop += x
        # 3. everything existing and available scales to fill what the new cells leave
        live = {m: v for m, v in raw.items() if v is not None and v > 0}
        zero = {m for m, v in raw.items() if v is not None and v == 0}
        room = 100.0 - sum(new_cells.values())
        base = sum(live.values())
        if base <= 0 or room <= 0:
            raise SystemExit(f"[origin_coherence] frame {f}: no room left ({room}) for {sorted(new_cells)}")
        scaled = {m: v * room / base for m, v in live.items()}
        scaled.update(new_cells)
        for m in zero:
            scaled[m] = 0.0
        ints = floor_preserving_round(scaled, zeroed=zero, floor=1)
        for r in rows:
            m = r["move"]
            r[f] = ints[m] if (m in new_cells or raw.get(m) is not None) else None
        if prop:
            log.append(f"{f}: {prop:.2f} point(s) of new share funded proportionally")
        tot = sum(r[f] for r in rows if r[f] is not None)
        if tot != 100:
            raise SystemExit(f"[origin_coherence] frame {f} sums to {tot}, not 100")
    return rows, new_names, log


# ── content I/O ────────────────────────────────────────────────────────────────────────────────
def _container(data, role):
    side = data.get(role)
    if not isinstance(side, dict) or not isinstance(side.get("transitions"), list):
        raise SystemExit(f"[origin_coherence] no {role}.transitions[] in this file")
    return side["transitions"]


def read_before(c):
    data = json.loads((ROOT / c["file"]).read_text(encoding="utf-8"))
    return data, [{"move": t["transition"], "gi": t["attempt_probability"]["gi"],
                   "nogi": t["attempt_probability"]["nogi"]} for t in _container(data, c["role"])]


def _superseded():
    """Containers a later phase changed on purpose (calibration/listing_tables.json, phase 2: an
    old-origin listing removed when its move was re-homed). That phase's own --check covers them."""
    p2 = ROOT / "calibration/listing_tables.json"
    return set(json.loads(p2.read_text(encoding="utf-8")).get("supersedes_phase1", [])) if p2.exists() else set()


def apply(prov, write, check):
    changed, drift, cells = 0, [], 0
    later = _superseded()
    for c in prov["containers"]:
        if c["key"] in later:
            if check:
                continue
            raise SystemExit(f"[origin_coherence] {c['key']} was changed by a later phase "
                             f"(calibration/listing_tables.json); re-applying phase 1 would revert it")
        data, before = read_before(c)
        want_before = c["before"]
        now = {r["move"]: (r["gi"], r["nogi"]) for r in before}
        after = {r["move"]: (r["gi"], r["nogi"]) for r in c["after"]}
        if check:
            if now != after:
                drift.append(c["key"])
            continue
        if now == after:
            continue                                  # already applied: idempotent
        if now != {r["move"]: (r["gi"], r["nogi"]) for r in want_before}:
            raise SystemExit(f"[origin_coherence] {c['key']}: content drifted since elicitation "
                             f"({c['file']}); refusing to overwrite a hand the panel never saw")
        trans = _container(data, c["role"])
        by = {t["transition"]: t for t in trans}
        for r in c["after"]:
            t = by.get(r["move"])
            if t is None:
                t = {"transition": r["move"], "attempt_probability": {"gi": None, "nogi": None}}
                trans.append(t)
            for f in FRAMES:
                if t["attempt_probability"].get(f) != r[f]:
                    cells += 1
                t["attempt_probability"][f] = r[f]
        changed += 1
        if write:
            atomic_write_json(ROOT / c["file"], data)
    if check:
        print(f"[origin_coherence] check: {len(prov['containers'])} containers, "
              f"{len(later)} superseded by a later phase {sorted(later)}, "
              f"{len(drift)} differ from the provenance {drift[:6]}")
        return 1 if drift else 0
    print(f"[origin_coherence] {'wrote' if write else 'would write'} {changed} container(s), "
          f"{cells} cell(s) changed")
    return 0


# ── the provenance ─────────────────────────────────────────────────────────────────────────────
def build_provenance(packs, finals, meta):
    out = {"meta": meta, "containers": []}
    for key in sorted(packs):
        pk = packs[key]
        fin = finals[key]
        verdict = aggregate_container(pk, fin["ballots"])
        before = [{"move": r["move"], "gi": r["gi"], "nogi": r["nogi"]} for r in pk["current_hand"]]
        after, added, log = new_hand(before, verdict)
        out["containers"].append({
            "key": key, "file": pk["file"], "role": pk["role"], "family": pk["family"],
            "before": before, "after": after, "added": added, "log": log,
            **verdict,
            "rounds": fin.get("rounds_used", 1),
            "final_ballots": fin["ballots"],
        })
    return out


def reaggregate(prov):
    """Recompute every verdict and hand from the ballots the provenance itself carries."""
    fresh = copy.deepcopy(prov)
    for c in fresh["containers"]:
        pk = {"key": c["key"], "family": c["family"],
              "current_hand": c["before"],
              "moves_to_add": [{"move": a["move"], "already_listed_here": a.get("already_listed_here")}
                               for a in c["add"]],
              "listings_to_judge": [{"move": j["move"]} for j in c["judge"]],
              "phantom_cells": [{"move": p["move"], "frame": p["frame"]} for p in c["phantom"]]}
        v = aggregate_container(pk, c["final_ballots"])
        after, added, log = new_hand(c["before"], v)
        c.update(v, after=after, added=added, log=log)
    return fresh


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--aggregate", action="store_true", help="ballots -> provenance")
    ap.add_argument("--reaggregate", action="store_true", help="re-derive the provenance from its own ballots; exit 1 on any difference")
    ap.add_argument("--ballots", help="dir of ballot files, one per container: {\"ballots\": [...]} (gitignored working state)")
    ap.add_argument("--packs", help="dir of the container packs the panel read")
    ap.add_argument("--meta", help="JSON file with the run's meta block")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    if a.aggregate:
        if not (a.ballots and a.packs and a.meta):
            ap.error("--aggregate needs --ballots, --packs and --meta")
        packs, finals = {}, {}
        for f in sorted(Path(a.packs).glob("*.json")):
            if f.name.startswith("_"):
                continue
            pk = json.loads(f.read_text(encoding="utf-8"))
            packs[pk["key"]] = pk
            s2 = Path(a.ballots) / f.name
            if not s2.exists():
                raise SystemExit(f"[origin_coherence] no final ballots for {pk['key']} ({s2})")
            finals[pk["key"]] = json.loads(s2.read_text(encoding="utf-8"))
        prov = build_provenance(packs, finals, json.loads(Path(a.meta).read_text(encoding="utf-8")))
        atomic_write_json(PROVENANCE, prov)
        print(f"[origin_coherence] wrote {PROVENANCE.relative_to(ROOT)}: {len(prov['containers'])} containers")
        return 0
    prov = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    if a.reaggregate:
        fresh = reaggregate(prov)
        same = json.dumps(fresh["containers"], sort_keys=True) == json.dumps(prov["containers"], sort_keys=True)
        print(f"[origin_coherence] reaggregate from the committed ballots: {'identical' if same else 'DIFFERS'}")
        return 0 if same else 1
    return apply(prov, write=not a.dry_run, check=a.check)


if __name__ == "__main__":
    sys.exit(main())
