#!/usr/bin/env python3
"""Origin coherence, phase 2: deal coherent listings where they are listed, re-home five moves,
and hold the per-listing outcome tables a generic move needs.

WHAT WAS LEFT (docs/GraphSemantics.md §1.4, §10 item 4; phase 1 is scripts/apply_origin_coherence.py).
A technique is authored FROM one position-role, its canonical origin, and its outcome table is
written for that origin. The game deals a card only there. Phase 1 listed every orphan at its
origin. Its panel also left three verdicts for this phase:

  deal_here  13 listings sit away from their technique's origin, and their authored table does not
             drag a miss back to that origin. The phase-1 panel judged whether each should be dealt
             where it is listed, as authored, and restored 8 (`judge` in
             calibration/origin_coherence.json). This phase sets `deal_here: true` on those 8
             listings. The listing keeps its authored share; the technique keeps its table; the
             dealers (build_hand, _mdp_mechanics, the app's optionsFor) honour the flag.
  rehome     the phase-1 panel ruled five canonical origins wrong. This phase moves each move's
             `from_position` to the panel's origin and gives it a NEW canonical table there (the old
             table was written for the old origin), from a second panel round. The same round
             rules keep/remove on the listing at the old origin; a removed listing's share is
             spread proportionally over that hand.
  tables     107 away listings the phase-1 panel said deserve their OWN outcome table
             (`own_table_at`). The same second round elicits them. They are aggregated and held
             here, and applied by the per-listing outcome-table schema (PR B), not by this file.

THE PANEL IS NOT EXPERT DATA. It is the repo's elicitation process run with LLM personas: ten
coaching archetypes (the Q3 occurrence Delphi's profiles and weights, keyed by archetype, never by a
person), each casting an independent ballot on every request, blind to the others, aggregated in
code. ONE ROUND: no deliberation and no verify pass ran; the deterministic checks below replace
the verify pass. Its numbers are a calibrated prior with named provenance, never a measurement.

AGGREGATION IS PURE CODE, with Q3's weights (`occurrence_moe.expert_weight`, family = the Q3 family
of the position-role the table is for):
  success rate   per frame, the weighted mean of the non-null votes, rounded, clamped to 1..99; a
                 frame is null only when more than half the weight votes null.
  outcome table  each ballot's rows become shares WITHIN their branch (success, or miss = failure +
                 counter). Per frame, a row's share is the weighted mean over the ballots that rate
                 that frame (a ballot without the row counts 0), then pooled over the rated frames:
                 ONE table for both rulesets, the corpus's convention (the frame difference lives in
                 the success rate). A row is kept at KEEP, one to three per branch, three to five in
                 all. Each branch is rescaled to its mass at the headline (no-gi) rate and
                 `floor_preserving_round` lands the table on integers summing to 100.
  verdicts       keep/remove on the old origin: the weighted plurality.

    python3 scripts/apply_listing_tables.py --aggregate --ballots DIR --packs DIR --meta FILE
    python3 scripts/apply_listing_tables.py --dry-run        # what would change
    python3 scripts/apply_listing_tables.py                  # write content
    python3 scripts/apply_listing_tables.py --check          # content == provenance, exit 1 if not
    python3 scripts/apply_listing_tables.py --reaggregate    # re-derive from the committed ballots

Deterministic: no randomness, everything in sorted order.
"""
from __future__ import annotations

import argparse
import copy
import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json  # noqa: E402
from occurrence_moe import CONFIG as Q3, expert_weight, floor_preserving_round  # noqa: E402
from apply_origin_coherence import ARCHETYPES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROVENANCE = ROOT / "calibration/listing_tables.json"
PHASE1 = ROOT / "calibration/origin_coherence.json"
Q3_PROV = ROOT / "calibration/occurrence_calibration.json"
AVAIL = ROOT / "tests/artifacts/ruleset_availability.json"
FRAMES = ("gi", "nogi")
EXPERTS = tuple(ARCHETYPES)
KEEP = 0.15          # a row survives at 15% of its branch in either frame
MAX_PER_BRANCH = 3
RESULTS = ("success", "failure", "counter")


# ── content lookups ─────────────────────────────────────────────────────────────────────────────
def _positions():
    """slug -> (relative file, data) for every position file."""
    out = {}
    for f in sorted(glob.glob(str(ROOT / "content/Positions/**/*.json"), recursive=True)):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        if d.get("slug"):
            out[d["slug"]] = (str(Path(f).relative_to(ROOT)), d)
    return out


def _techniques():
    """display name -> relative file, transitions first (the graph's own priority)."""
    out = {}
    for sec in ("Transitions", "Submissions"):
        for f in sorted(glob.glob(str(ROOT / f"content/{sec}/**/*.json"), recursive=True)):
            try:
                d = json.loads(Path(f).read_text(encoding="utf-8"))
            except ValueError:
                continue
            if d.get("name") and d["name"] not in out:
                out[d["name"]] = str(Path(f).relative_to(ROOT))
    return out


def _display(key, pos):
    """'open-guard/top' -> 'Open Guard/Top', the form content outcomes and from_position use."""
    slug, role = key.rsplit("/", 1)
    return f"{pos[slug][1]['name']}/{role.capitalize()}"


def _families(pos):
    q3 = json.loads(Q3_PROV.read_text(encoding="utf-8"))
    by_file = {(c["file"], c["role"]): c["family"] for c in q3["containers"]}
    return {f"{slug}/{role}": by_file.get((rel, role))
            for slug, (rel, _d) in pos.items() for role in ("top", "bottom")}


def _w(expert, family, frame=None):
    key = ARCHETYPES[expert]
    if frame:
        return expert_weight(key, family, frame, Q3)
    return sum(expert_weight(key, family, f, Q3) for f in FRAMES) / len(FRAMES)


# ── aggregation ────────────────────────────────────────────────────────────────────────────────
def aggregate_table(req, ballots, family, nogi_absent):
    """One request's ten ballots -> {success_rate, outcomes, support}. Pure."""
    res = {"success_rate": {}, "null_weight": {}}
    for f in FRAMES:
        votes = [((ballots[e].get("success_rate") or {}).get(f), _w(e, family, f)) for e in EXPERTS]
        tw = sum(w for _, w in votes)
        nw = sum(w for v, w in votes if v is None)
        live = [(float(v), w) for v, w in votes if v is not None]
        res["null_weight"][f] = round(nw / tw, 3)
        res["success_rate"][f] = (None if nw * 2 > tw or not live else
                                  int(min(99, max(1, round(sum(v * w for v, w in live) / sum(w for _, w in live))))))
    share = {f: {} for f in FRAMES}
    for f in FRAMES:
        if res["success_rate"][f] is None:
            continue
        tot = 0.0
        for e in EXPERTS:
            rows = [r for r in ballots[e].get("outcomes") or [] if isinstance(r.get(f), (int, float))]
            if (ballots[e].get("success_rate") or {}).get(f) is None or not rows:
                continue
            w = _w(e, family, f)
            tot += w
            for branch in ("success", "miss"):
                bro = [r for r in rows if (r["result"] == "success") == (branch == "success")]
                m = sum(r[f] for r in bro)
                for r in bro:
                    k = (r["to"], r["result"])
                    share[f][k] = share[f].get(k, 0.0) + w * (r[f] / m if m > 0 else 0.0)
        for k in share[f]:
            share[f][k] /= tot
    # ONE TABLE, BOTH FRAMES. The corpus authors every outcome cell equal across rulesets (4,101 of
    # 4,101 before this file), and regenerate_graph loads a technique's outcomes through
    # reduce_to_scalar, which refuses a divergent map: the ruleset difference lives in the success
    # rate, while a row is a weight WITHIN its branch. So each row's share is pooled over the
    # frames the panel rated (the mean of the two frames' within-branch shares).
    live = [f for f in FRAMES if res["success_rate"][f] is not None]
    if not live:
        raise SystemExit(f"[listing_tables] {req['key']}: no frame has a success rate")
    keys = {k for f in live for k in share[f]}
    score = {k: sum(share[f].get(k, 0.0) for f in live) / len(live) for k in keys}
    keep = []
    for branch in ("success", "miss"):
        ks = sorted((k for k in score if (k[1] == "success") == (branch == "success")),
                    key=lambda k: (-score[k], k))
        if not ks:
            raise SystemExit(f"[listing_tables] {req['key']}: no {branch} row in any ballot")
        keep += [k for i, k in enumerate(ks[:MAX_PER_BRANCH]) if i == 0 or score[k] >= KEEP]
    if len(keep) > 5:                     # drop the weakest beyond one per branch
        best = {b: max((k for k in keep if (k[1] == "success") == (b == "success")), key=lambda k: (score[k], k))
                for b in ("success", "miss")}
        rest = sorted((k for k in keep if k not in best.values()), key=lambda k: (-score[k], k))
        keep = list(best.values()) + rest[:3]
    if len(keep) < 3:                     # top up with the next strongest rows from either branch
        extra = sorted((k for k in score if k not in keep), key=lambda k: (-score[k], k))
        keep += extra[:3 - len(keep)]
    keep = sorted(keep, key=lambda k: (RESULTS.index(k[1]), -score[k], k[0]))
    # The integers are scaled to the headline frame's rate (no-gi, else gi), as the content's own
    # rows are; graph.json rescales a table to the published rate per frame anyway.
    head = "nogi" if res["success_rate"]["nogi"] is not None else "gi"
    sr = res["success_rate"][head]
    raw = {}
    for branch, mass in (("success", sr), ("miss", 100 - sr)):
        bk = [k for k in keep if (k[1] == "success") == (branch == "success")]
        s_ = sum(score[k] for k in bk)
        for k in bk:
            raw[k] = mass * (score[k] / s_ if s_ > 0 else 1.0 / len(bk))
    ints = floor_preserving_round(raw, zeroed=set(), floor=1)
    if sum(ints.values()) != 100:
        raise SystemExit(f"[listing_tables] {req['key']}: table sums {sum(ints.values())}")
    # A destination the no-gi graph excludes cannot sit in a table that no-gi deals; it is recorded,
    # and the schema that applies the table must refuse it (none of the five re-homes has one).
    res["nogi_excluded_destinations"] = sorted(k[0] for k in keep if k[0] in nogi_absent
                                               and res["success_rate"]["nogi"] is not None)
    cells = {k: {f: (ints[k] if res["success_rate"][f] is not None else None) for f in FRAMES} for k in keep}
    res["outcomes"] = [{"to": k[0], "result": k[1], "gi": cells[k]["gi"], "nogi": cells[k]["nogi"],
                        "support": round(score[k], 3)} for k in keep]
    return res


def aggregate(packs, ballots, meta):
    pos = _positions()
    fam = _families(pos)
    nogi_absent = set(json.loads(AVAIL.read_text(encoding="utf-8"))["excluded"]["nogi"]["positions"])
    out = {"meta": meta, "deal_here": _deal_here_from_phase1(), "rehome": [], "tables": []}
    for batch in sorted(packs):
        for mv in packs[batch]["moves"]:
            for req in mv["tables"]:
                bs = {}
                for e in EXPERTS:
                    ent = next((t for t in ballots[(batch, e)]["tables"] if t.get("key") == req["key"]), None)
                    if ent is None:
                        raise SystemExit(f"[listing_tables] {e} did not answer {req['key']!r}")
                    bs[e] = {k: ent.get(k) for k in ("success_rate", "null_reason", "outcomes",
                                                      "old_origin", "old_origin_reason", "reason")
                             if k in ent}
                family = fam.get(req["listing"])
                if family is None:
                    raise SystemExit(f"[listing_tables] no Q3 family for {req['listing']}")
                row = {"key": req["key"], "move": mv["move"], "listing": req["listing"], "family": family,
                       "share_here": req.get("share_here"), "ballots": bs,
                       "result": aggregate_table(req, bs, family, nogi_absent)}
                if req["kind"] == "rehome":
                    votes = {}
                    for e in EXPERTS:
                        v = bs[e].get("old_origin")
                        votes[v] = votes.get(v, 0.0) + _w(e, family)
                    win = sorted(votes.items(), key=lambda kv: (-kv[1], str(kv[0])))[0]
                    row.update({"old_origin": req["old_origin"], "old_origin_share": req.get("old_origin_share"),
                                "old_table": mv["canonical_table"], "old_success_rate": mv["canonical_success_rate"],
                                "phase1_support": req.get("rehome_panel_support")})
                    row["result"]["old_origin"] = win[0]
                    row["result"]["old_origin_support"] = round(win[1] / sum(votes.values()), 3)
                    out["rehome"].append(row)
                else:
                    out["tables"].append(row)
    out["rehome"].sort(key=lambda r: r["key"])
    out["tables"].sort(key=lambda r: r["key"])
    out["hands"] = _hands(out["rehome"])
    out["supersedes_phase1"] = _supersedes(out["rehome"])
    return out


def _hands(rehomes):
    """Every hand this phase changes, with its before and after, so content == provenance can be
    checked cell for cell. A removal starts from phase 1's `after` for that container (the hand the
    phase-1 panel left), drops the listing and spreads its points proportionally."""
    p1 = {c["key"]: c for c in json.loads(PHASE1.read_text(encoding="utf-8"))["containers"]}
    out = []
    for r in rehomes:
        if r["result"]["old_origin"] != "remove":
            continue
        c = p1.get(r["old_origin"])
        if c is None:
            raise SystemExit(f"[listing_tables] {r['old_origin']} is not a phase-1 container")
        before = [dict(x) for x in c["after"]]
        trans = [{"transition": x["move"], "attempt_probability": {f: x[f] for f in FRAMES}} for x in before]
        side = {c["role"]: {"transitions": trans}}
        _drop_listing(side, c["role"], r["move"])
        after = [{"move": t["transition"], **{f: t["attempt_probability"][f] for f in FRAMES}}
                 for t in side[c["role"]]["transitions"]]
        out.append({"key": c["key"], "file": c["file"], "role": c["role"], "removed": r["move"],
                    "why": f"{r['move']} re-homed to {r['listing']}; the panel ruled its listing here a mistake",
                    "before": before, "after": after})
    return sorted(out, key=lambda h: h["key"])


def _supersedes(rehomes):
    """Phase-1 containers whose hand this phase changes (an old-origin listing removed). Phase 1's
    own --check skips exactly these and says so; this file's --check covers them."""
    return sorted(r["old_origin"] for r in rehomes if r["result"]["old_origin"] == "remove")


def _deal_here_from_phase1():
    """The 8 restored listings: phase 1's `judge` verdicts, read, never re-typed."""
    p1 = json.loads(PHASE1.read_text(encoding="utf-8"))
    out = []
    for c in p1["containers"]:
        for j in c.get("judge") or []:
            out.append({"listing": c["key"], "file": c["file"], "role": c["role"], "move": j["move"],
                        "restore": j["result"]["restore"], "support": round(j["result"]["support"], 3)})
    return sorted(out, key=lambda r: (r["listing"], r["move"]))


def reaggregate(prov):
    fresh = copy.deepcopy(prov)
    pos = _positions()
    nogi_absent = set(json.loads(AVAIL.read_text(encoding="utf-8"))["excluded"]["nogi"]["positions"])
    for row in fresh["rehome"] + fresh["tables"]:
        r = aggregate_table({"key": row["key"]}, row["ballots"], row["family"], nogi_absent)
        if "old_origin" in row:
            votes = {}
            for e in EXPERTS:
                v = row["ballots"][e].get("old_origin")
                votes[v] = votes.get(v, 0.0) + _w(e, row["family"])
            win = sorted(votes.items(), key=lambda kv: (-kv[1], str(kv[0])))[0]
            r["old_origin"], r["old_origin_support"] = win[0], round(win[1] / sum(votes.values()), 3)
        row["result"] = r
    fresh["deal_here"] = _deal_here_from_phase1()
    fresh["hands"] = _hands(fresh["rehome"])
    fresh["supersedes_phase1"] = _supersedes(fresh["rehome"])
    del pos
    return fresh


# ── apply ──────────────────────────────────────────────────────────────────────────────────────
def _listing(data, role, move):
    side = data.get(role) or {}
    return next((t for t in side.get("transitions") or [] if t.get("transition") == move), None)


def _content_table(rows, pos):
    return [{"to": _display(r["to"], pos), "probability": {"gi": r["gi"], "nogi": r["nogi"]},
             "result": r["result"]} for r in rows]


def _drop_listing(data, role, move):
    """Remove one listing and spread its points proportionally over the rest of the hand, per frame
    (zeros stay zero, nulls stay null, floor 1 on every live cell)."""
    trans = data[role]["transitions"]
    keep = [t for t in trans if t.get("transition") != move]
    if len(keep) != len(trans) - 1:
        raise SystemExit(f"[listing_tables] {move!r} is not listed exactly once")
    for f in FRAMES:
        live = {t["transition"]: float(t["attempt_probability"][f]) for t in keep
                if t["attempt_probability"].get(f) is not None and t["attempt_probability"][f] > 0}
        zero = {t["transition"] for t in keep if t["attempt_probability"].get(f) == 0}
        if not live:
            continue
        raw = {m: v * 100.0 / sum(live.values()) for m, v in live.items()}
        raw.update({m: 0.0 for m in zero})
        ints = floor_preserving_round(raw, zeroed=zero, floor=1)
        for t in keep:
            if t["transition"] in ints:
                t["attempt_probability"][f] = ints[t["transition"]]
    data[role]["transitions"] = keep


def apply(prov, write, check):
    pos = _positions()
    techs = _techniques()
    edits, problems = {}, []

    def load(rel):
        if rel not in edits:
            edits[rel] = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        return edits[rel]

    for d in prov["deal_here"]:
        if not d["restore"]:
            continue
        data = load(d["file"])
        t = _listing(data, d["role"], d["move"])
        if t is None:
            problems.append(f"deal_here: {d['move']} is not listed at {d['listing']}")
        elif t.get("deal_here") is not True:
            problems.append(f"deal_here: {d['listing']} {d['move']} not flagged")
            t["deal_here"] = True
    for r in prov["rehome"]:
        rel = techs[r["move"]]
        t = load(rel)
        want_from = _display(r["listing"], pos)
        # The content `success_rate` is only the community SEED, and transitions load through
        # reduce_to_scalar, so it is written equal in both frames at the headline (no-gi) rate. The
        # per-frame rate the game publishes is the votes prior written below.
        r_sr = r["result"]["success_rate"]
        head = r_sr["nogi"] if r_sr["nogi"] is not None else r_sr["gi"]
        want_sr = {f: head for f in FRAMES}
        want_out = _content_table(r["result"]["outcomes"], pos)
        if t.get("from_position") != want_from:
            problems.append(f"rehome: {r['move']} from_position {t.get('from_position')!r} -> {want_from!r}")
            t["from_position"] = want_from
        if t.get("success_rate") != want_sr:
            problems.append(f"rehome: {r['move']} success_rate {t.get('success_rate')} -> {want_sr}")
            t["success_rate"] = want_sr
        if t.get("outcomes") != want_out:
            problems.append(f"rehome: {r['move']} outcomes rewritten ({len(want_out)} rows)")
            t["outcomes"] = want_out
    # THE PUBLISHED RATE IS THE VOTES PRIOR, not the content's `success_rate` (that one only seeds
    # the community count): graph.json folds templates/votes.json's calibrated `prior` with any real
    # community votes (_votes.folded_rate). A re-homed move's prior was calibrated at its OLD origin,
    # so the panel's rate replaces it, and calibration/overrides.json records the same number so a
    # later `calibrate:apply` cannot write the old-origin prior back.
    votes_p, over_p = ROOT / "templates/votes.json", ROOT / "calibration/overrides.json"
    votes = json.loads(votes_p.read_text(encoding="utf-8"))
    over = json.loads(over_p.read_text(encoding="utf-8"))
    vdirty = odirty = False
    for r in prov["rehome"]:
        sr = r["result"]["success_rate"]
        want_o = {"gi": sr["gi"], "nogi": sr["nogi"], "verdict": "rehome",
                  "reason": (f"Re-homed from {r['old_origin']} to {r['listing']} (origin coherence, phase 2): "
                             f"the old prior was calibrated at the old origin; this is the panel's rate at the new one."),
                  "reviewer": "origin-coherence phase 2, an LLM persona panel, one round (calibration/listing_tables.json); not expert data"}
        if over["overrides"].get(r["move"]) != want_o:
            problems.append(f"rehome: {r['move']} calibration override -> {sr}")
            over["overrides"][r["move"]] = want_o
            odirty = True
        e = votes["votes"].get(r["move"])
        if e is None or "community" not in e:
            raise SystemExit(f"[listing_tables] templates/votes.json has no forked entry for {r['move']!r}")
        old = e.get("prior") or {}
        want_p = {f: {"success_rate": sr[f], "pseudo_count": (old.get(f) or {}).get("pseudo_count") or 8,
                      "extrapolated": False} for f in FRAMES}
        want_p["provenance"] = {"source": "origin-coherence-p2", "run_id": "calibration/listing_tables.json",
                                "reviewed": False, "override": True}
        if e.get("prior") != want_p:
            problems.append(f"rehome: {r['move']} votes prior {[(old.get(f) or {}).get('success_rate') for f in FRAMES]} -> {sr}")
            e["prior"] = want_p
            vdirty = True
    for h in prov.get("hands", []):
        data = load(h["file"])
        trans = data[h["role"]]["transitions"]
        now = [{"move": t["transition"], **{f: t["attempt_probability"][f] for f in FRAMES}} for t in trans]
        if now == h["after"]:
            continue                                  # already applied: idempotent
        if now != h["before"]:
            raise SystemExit(f"[listing_tables] {h['key']}: content drifted since elicitation ({h['file']}); "
                             f"refusing to overwrite a hand the provenance never saw")
        problems.append(f"hand: {h['key']} drops {h['removed']}")
        by = {t["transition"]: t for t in trans}
        data[h["role"]]["transitions"] = [by[r["move"]] for r in h["after"]]
        for r in h["after"]:
            for f in FRAMES:
                by[r["move"]]["attempt_probability"][f] = r[f]
    if check:
        print(f"[listing_tables] check: {sum(1 for d in prov['deal_here'] if d['restore'])} deal_here, "
              f"{len(prov['rehome'])} rehome(s), {len(prov.get('hands', []))} hand(s); "
              f"{len(problems)} difference(s) {problems[:6]}")
        return 1 if problems else 0
    for p in problems:
        print("  " + p)
    if write:
        for rel, data in sorted(edits.items()):
            atomic_write_json(ROOT / rel, data)
        # both files are written without a trailing newline today; keep their bytes otherwise as-is
        if vdirty:
            atomic_write_json(votes_p, votes, indent=2, ensure_ascii=False, trailing_newline=False)
        if odirty:
            atomic_write_json(over_p, over, indent=2, ensure_ascii=False, trailing_newline=False)
    print(f"[listing_tables] {'wrote' if write else 'would write'} {len(problems)} change(s) in "
          f"{len(edits)} file(s) read; {len(prov['tables'])} per-listing table(s) held for the schema")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--aggregate", action="store_true")
    ap.add_argument("--reaggregate", action="store_true")
    ap.add_argument("--ballots", help="dir of ballot files <batch>__<archetype>.json (gitignored working state)")
    ap.add_argument("--packs", help="dir of the batch packs B*.json the panel read")
    ap.add_argument("--meta", help="JSON file with the run's meta block")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.aggregate:
        if not (a.ballots and a.packs and a.meta):
            ap.error("--aggregate needs --ballots, --packs and --meta")
        packs = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(Path(a.packs).glob("B*.json"))}
        ballots = {}
        for b in packs:
            for e in EXPERTS:
                f = Path(a.ballots) / f"{b}__{e}.json"
                if not f.exists():
                    raise SystemExit(f"[listing_tables] missing ballot {f}")
                ballots[(b, e)] = json.loads(f.read_text(encoding="utf-8"))
        prov = aggregate(packs, ballots, json.loads(Path(a.meta).read_text(encoding="utf-8")))
        atomic_write_json(PROVENANCE, prov)
        print(f"[listing_tables] wrote {PROVENANCE.relative_to(ROOT)}: {len(prov['deal_here'])} judged listings, "
              f"{len(prov['rehome'])} rehomes, {len(prov['tables'])} per-listing tables")
        return 0
    prov = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    if a.reaggregate:
        fresh = reaggregate(prov)
        same = json.dumps(fresh, sort_keys=True) == json.dumps(prov, sort_keys=True)
        print(f"[listing_tables] reaggregate from the committed ballots: {'identical' if same else 'DIFFERS'}")
        return 0 if same else 1
    return apply(prov, write=not a.dry_run, check=a.check)


if __name__ == "__main__":
    sys.exit(main())
