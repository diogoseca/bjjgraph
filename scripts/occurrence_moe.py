#!/usr/bin/env python3
"""Q3 occurrence calibration — deterministic MoE aggregation over expert panel ballots.

Input: per-container Delphi outputs (Stage 2 final ballots, 10 legends x move x {gi,nogi})
       from occurrence_elicitation/stage2/, plus the input packs (anchors, families).
Output: occurrence_calibration.json (committed provenance: final distributions + ballots
        + diagnostics) and occurrence_preview.md (the human checkpoint artifact).

Aggregation is pure code — re-running with a different CONFIG never re-elicits:
  per-expert per-frame renorm to 100
  -> specialty x ruleset weighted mean per move per frame
  -> anchor blend where the 2.2 calibrated occurrence anchors exist
     (post = (anchor_w*anchor + effective_n*panel) / (anchor_w + effective_n);
      effective_n stays small: 10 personas are ONE correlated LLM, not 10 samples)
  -> availability rulings force per-frame 0 (the only sanctioned zero)
  -> floor: every available cell >= FLOOR (owner policy: 1%)
  -> largest_remainder_round per frame (floor-preserving).
"""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _prob_norm import largest_remainder_round  # noqa: E402

RULESETS = ("gi", "nogi")

CONFIG = {
    "weights_version": "q3-v1",
    "base_weight": 1.0,
    "specialty_bonus": 0.6,  # same shape as the v1.52.0 coherence panel
    "effective_n": 2.5,      # correlated-expert discount, used ONLY for anchor blending
    "anchor_weight": 2.0,    # modest: anchors were also shown to the panel (avoid double-count)
    "floor": 1,              # owner policy: no available move below 1% in its frame
    # Per-frame-0 is decided from the BALLOTS (availability_rulings are provenance only — the
    # panel fills them with both "unavailable" AND affirmative "available in both" notes).
    # A frame is zeroed only for genuine ruleset-unavailability, detected two ways:
    #   (a) near-zero absolutely: panel mean < zero_abs  (a move essentially never balloted), OR
    #   (b) frame-specific suppression: mean < frame_keep AND the OTHER frame's mean exceeds it
    #       by >= frame_gap  (e.g. heel hook gi 0.7 vs no-gi ~13 => gi unavailable).
    # A move that is merely rare-but-present in BOTH frames (e.g. mean ~1 gi and ~1 no-gi) is NOT
    # zeroed — it floors to 1 and is surfaced as a removal_candidate for a later cleanup phase,
    # honoring the owner's "no removals this pass, floor 1% where it exists" policy.
    "zero_abs": 0.5,
    "frame_keep": 1.5,
    "frame_gap": 5.0,
    "specialties": {
        "danaher": ["leg", "back_harness", "submission_control", "pins_top"],
        "gordon": ["leg", "back_harness", "pins_top", "guard_general",
                   "submission_control", "standing_takedown"],
        "craig": ["leg", "guard_general"],
        "lachlan": ["leg", "guard_general", "submission_control"],
        "roger": ["guard_gi", "pins_top", "back_harness", "standing_takedown", "guard_general"],
        "marcelo": ["guard_general", "back_harness", "standing_takedown"],
        "mendes": ["guard_gi", "guard_general"],
        "bravo": ["guard_general", "submission_control", "leg", "pins_top"],
        "mikey": ["guard_gi", "leg", "guard_general"],
        "kade": ["back_harness", "standing_takedown", "leg", "submission_control"],
    },
    "ruleset_affinity": {
        "danaher": {"gi": 0.80, "nogi": 1.20},
        "gordon": {"gi": 0.80, "nogi": 1.20},
        "craig": {"gi": 0.75, "nogi": 1.20},
        "lachlan": {"gi": 0.85, "nogi": 1.20},
        "roger": {"gi": 1.30, "nogi": 0.75},
        "marcelo": {"gi": 1.00, "nogi": 1.05},
        "mendes": {"gi": 1.30, "nogi": 0.75},
        "bravo": {"gi": 0.70, "nogi": 1.15},
        "mikey": {"gi": 1.25, "nogi": 0.90},
        "kade": {"gi": 0.75, "nogi": 1.25},
    },
}


def expert_weight(expert: str, family: str, frame: str, cfg: dict = CONFIG) -> float:
    w = cfg["base_weight"]
    if family in cfg["specialties"].get(expert, []):
        w += cfg["specialty_bonus"]
    return w * cfg["ruleset_affinity"].get(expert, {}).get(frame, 1.0)


def _renorm_ballot(values: dict) -> dict:
    """Scale one expert's per-frame ballot {move: pct} so it sums to 100 (0-sum -> as-is)."""
    total = sum(values.values())
    if total <= 0:
        return dict(values)
    return {m: v * 100.0 / total for m, v in values.items()}


def _entropy(dist: list) -> float:
    total = sum(dist)
    if total <= 0:
        return 0.0
    h = 0.0
    for v in dist:
        if v > 0:
            p = v / total
            h -= p * math.log2(p)
    return round(h, 3)


def _head_mass(dist: list, k: int = 5) -> float:
    total = sum(dist)
    if total <= 0:
        return 0.0
    return round(sum(sorted(dist, reverse=True)[:k]) / total * 100, 1)


def floor_preserving_round(raw: dict, zeroed: set, floor: int) -> dict:
    """largest_remainder_round to 100, then re-assert the floor on available cells
    (steal from the largest cells so the sum stays exactly 100)."""
    moves = list(raw)
    vals = [0.0 if m in zeroed else max(float(floor), raw[m]) for m in moves]
    total = sum(vals)
    if total <= 0:
        return {m: 0 for m in moves}
    ints = largest_remainder_round([v / total * 100 for v in vals], 100)
    out = dict(zip(moves, ints))
    # rounding can drop a small available cell to 0 -> bump back to floor
    for m in moves:
        if m not in zeroed and out[m] < floor:
            need = floor - out[m]
            for donor in sorted(out, key=lambda x: -out[x]):
                if donor != m and out[donor] - need >= floor:
                    out[donor] -= need
                    out[m] = floor
                    break
    return out


def aggregate_container(pack: dict, stage2: dict, cfg: dict = CONFIG) -> dict:
    """One container's ballots -> final {gi,nogi} distribution + per-move provenance."""
    family = pack.get("family", "")
    move_names = [m["move"] for m in pack["moves"]]
    anchors = {m["move"]: m.get("calibrated_occurrence_anchor") for m in pack["moves"]}

    per_move = {m: {rs: {"votes": [], "weights": []} for rs in RULESETS} for m in move_names}
    for b in stage2.get("ballots", []) or []:
        expert = b.get("expert", "")
        entries = {e.get("move"): e for e in b.get("ballot", []) or [] if e.get("move") in per_move}
        if not entries:
            continue
        for rs in RULESETS:
            renormed = _renorm_ballot({m: max(0.0, float(e.get(rs) or 0)) for m, e in entries.items()})
            w = expert_weight(expert, family, rs, cfg)
            for m, v in renormed.items():
                per_move[m][rs]["votes"].append(v)
                per_move[m][rs]["weights"].append(w)

    # PASS 1: weighted panel mean + dispersion per move per frame (pre-anchor-blend).
    stat = {m: {} for m in move_names}
    for m in move_names:
        for rs in RULESETS:
            votes, weights = per_move[m][rs]["votes"], per_move[m][rs]["weights"]
            if votes:
                mean = sum(v * w for v, w in zip(votes, weights)) / sum(weights)
                var = sum(w * (v - mean) ** 2 for v, w in zip(votes, weights)) / sum(weights)
                std = math.sqrt(var)
            else:
                mean, std = 0.0, 0.0
            stat[m][rs] = {"mean": mean, "std": std}

    # PASS 2: decide per-frame zeros from BOTH frames' means (ballot-driven, rulings are only
    # provenance). Zero iff near-zero absolutely OR frame-specifically suppressed vs the other
    # frame. A move rare-but-present in both frames is kept (floors to 1), not zeroed.
    zeroed = {rs: set() for rs in RULESETS}
    for m in move_names:
        for rs in RULESETS:
            other = "nogi" if rs == "gi" else "gi"
            this_m, other_m = stat[m][rs]["mean"], stat[m][other]["mean"]
            if this_m < cfg["zero_abs"] or (
                    this_m < cfg["frame_keep"] and other_m - this_m >= cfg["frame_gap"]):
                zeroed[rs].add(m)

    # PASS 3: anchor-blend the surviving cells; assemble provenance.
    result_moves = {}
    raw = {rs: {} for rs in RULESETS}
    for m in move_names:
        result_moves[m] = {}
        a = anchors.get(m)
        for rs in RULESETS:
            mean = stat[m][rs]["mean"]
            anchor_cell = a.get(rs) if isinstance(a, dict) else None
            if m in zeroed[rs]:
                post = 0.0
            else:
                post = mean
                if anchor_cell is not None:
                    post = (cfg["anchor_weight"] * float(anchor_cell) + cfg["effective_n"] * mean) / (
                        cfg["anchor_weight"] + cfg["effective_n"])
            raw[rs][m] = post
            result_moves[m][rs] = {"panel_mean": round(mean, 2), "dispersion": round(stat[m][rs]["std"], 2),
                                   "anchor": anchor_cell, "post": round(post, 2)}

    final = {rs: floor_preserving_round(raw[rs], zeroed[rs], cfg["floor"]) for rs in RULESETS}

    # A fully-collapsed frame (every move zeroed => sums to 0) means the POSITION itself is
    # unavailable in that ruleset (e.g. lapel/worm/squid guard in no-gi — no gi to grip).
    # That is a 2.4 availability concern; the availability layer does not exist yet and the
    # graph validator requires each frame to sum to 100. Q3 keeps coherence by MIRRORING the
    # populated frame and flagging it — 2.4 will later mark the position unavailable, at which
    # point these mirrored numbers become moot. Both frames collapsing should never happen.
    frame_unavailable = []
    for rs in RULESETS:
        if sum(final[rs].values()) == 0:
            other = "nogi" if rs == "gi" else "gi"
            if sum(final[other].values()) > 0:
                final[rs] = dict(final[other])
                frame_unavailable.append(rs)
    return {"final": final, "moves": result_moves,
            "zeroed": {rs: sorted(zeroed[rs]) for rs in RULESETS},
            "frame_unavailable": frame_unavailable}


def diagnostics(pack: dict, final: dict, sealed: dict) -> dict:
    """Per-frame shift metrics vs the pre-calibration (sealed) values."""
    move_names = [m["move"] for m in pack["moves"]]
    out = {}
    for rs in RULESETS:
        cur = [float((sealed.get(m) or {}).get(rs) or 0) for m in move_names]
        new = [float(final[rs].get(m, 0)) for m in move_names]
        cur_n = [v * 100 / sum(cur) for v in cur] if sum(cur) > 0 else cur
        out[rs] = {
            "l1_shift": round(sum(abs(a - b) for a, b in zip(cur_n, new)), 1),
            "entropy_before": _entropy(cur), "entropy_after": _entropy(new),
            "head5_before": _head_mass(cur), "head5_after": _head_mass(new),
            "zero_cells": sum(1 for v in new if v == 0),
            "max_move_delta": round(max((abs(a - b) for a, b in zip(cur_n, new)), default=0.0), 1),
        }
    gi_new, nogi_new = final["gi"], final["nogi"]
    out["divergent_moves"] = sum(1 for m in move_names if abs(gi_new.get(m, 0) - nogi_new.get(m, 0)) >= 3)
    return out


def crosscheck(results: dict, packs: dict) -> list:
    """Same technique across containers: flag wild occurrence rank variance (feeds verify)."""
    from collections import defaultdict
    by_tech = defaultdict(list)
    for key, res in results.items():
        for rs in RULESETS:
            for m, v in res["final"][rs].items():
                by_tech[m].append((key, rs, v))
    flags = []
    for tech, entries in by_tech.items():
        vals = [v for _, _, v in entries]
        if len(vals) >= 3 and max(vals) - min(vals) >= 30:
            flags.append({"technique": tech, "spread": max(vals) - min(vals),
                          "sites": [f"{k}:{rs}={v}" for k, rs, v in sorted(entries, key=lambda x: -x[2])[:6]]})
    return sorted(flags, key=lambda f: -f["spread"])


def run_aggregation(el_dir: Path, out_path: Path, preview_path: Path, cfg: dict = CONFIG) -> dict:
    """Aggregate every completed Stage-2 container -> occurrence_calibration.json + preview."""
    import glob as _glob

    packs = {}
    for f in _glob.glob(str(el_dir / "input" / "*.json")):
        if Path(f).name.startswith("_"):
            continue
        p = json.loads(Path(f).read_text(encoding="utf-8"))
        packs[p["key"]] = p
    sealed = json.loads((el_dir / "input" / "_sealed_current_values.json").read_text(encoding="utf-8"))

    containers, skipped = [], []
    for f in sorted(_glob.glob(str(el_dir / "stage2" / "*.json"))):
        try:
            s2 = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            skipped.append((Path(f).name, "unreadable"))
            continue
        key = s2.get("key")
        pack = packs.get(key)
        if not pack or len(s2.get("ballots", [])) < 10:
            skipped.append((Path(f).name, "no pack" if not pack else "incomplete ballots"))
            continue
        agg = aggregate_container(pack, s2, cfg)
        diag = diagnostics(pack, agg["final"], sealed.get(key, {}))
        moves_out = []
        for m in pack["moves"]:
            name = m["move"]
            per_expert = {}
            for b in s2["ballots"]:
                e = next((x for x in b.get("ballot", []) if x.get("move") == name), None)
                if e:
                    per_expert[b["expert"]] = {"gi": e.get("gi"), "nogi": e.get("nogi")}
            mm = agg["moves"][name]
            moves_out.append({
                "transition": name,
                "prior": sealed.get(key, {}).get(name),
                "anchor": m.get("calibrated_occurrence_anchor"),
                "ballots": per_expert,
                "panel_mean": {rs: mm[rs]["panel_mean"] for rs in RULESETS},
                "dispersion": {rs: mm[rs]["dispersion"] for rs in RULESETS},
                "final": {rs: agg["final"][rs][name] for rs in RULESETS},
            })
        containers.append({
            "key": key, "file": pack["file"], "position": pack["position"], "role": pack["role"],
            "family": pack["family"], "rounds_used": s2.get("rounds_used"),
            "frame_rationale": s2.get("frame_rationale", ""),
            "availability_rulings": s2.get("availability_rulings", []),
            "removal_candidates": s2.get("removal_candidates", []),
            "frame_unavailable": agg.get("frame_unavailable", []),
            "flags": s2.get("flags", []),
            "diagnostics": diag,
            "moves": moves_out,
        })

    xflags = crosscheck({c["key"]: {"final": {rs: {m["transition"]: m["final"][rs] for m in c["moves"]}
                                              for rs in RULESETS}} for c in containers}, packs)
    cal = {
        "meta": {
            "phase": "Q3 occurrence calibration",
            "config": {k: v for k, v in cfg.items() if k != "specialties"},
            "container_count": len(containers),
            "skipped": skipped,
            "crosscheck_flags": xflags,
        },
        "containers": containers,
    }
    out_path.write_text(json.dumps(cal, indent=1, ensure_ascii=False), encoding="utf-8")
    preview_path.write_text(_preview_md(cal), encoding="utf-8")
    print(f"aggregated {len(containers)} containers -> {out_path}")
    print(f"preview -> {preview_path}")
    if skipped:
        print(f"skipped {len(skipped)}: {skipped[:8]}")
    return cal


def _preview_md(cal: dict) -> str:
    """The Q3.3 checkpoint artifact: what changes, where, and why — before anything goes live."""
    cs = cal["containers"]
    L = ["# Q3 occurrence calibration — pre-apply preview", ""]
    n_moves = sum(len(c["moves"]) for c in cs)
    l1g = sorted(c["diagnostics"]["gi"]["l1_shift"] for c in cs)
    l1n = sorted(c["diagnostics"]["nogi"]["l1_shift"] for c in cs)
    med = lambda xs: xs[len(xs) // 2] if xs else 0
    div_edges = sum(1 for c in cs for m in c["moves"] if abs(m["final"]["gi"] - m["final"]["nogi"]) >= 3)
    zeros = [(c, m) for c in cs for m in c["moves"] if 0 in m["final"].values()]
    unavail = [(c, rs) for c in cs for rs in c.get("frame_unavailable", [])]
    L += [f"- containers: **{len(cs)}**, moves: **{n_moves}**",
          f"- L1 shift per container (gi / nogi): median **{med(l1g)} / {med(l1n)}**, max {max(l1g, default=0)} / {max(l1n, default=0)}",
          f"- gi≠nogi divergent edges (|Δ|≥3): **{div_edges}** (was 0 — first real attempt divergence)",
          f"- per-frame zeros (panel balloted <1% in that frame): **{len(zeros)}**",
          f"- ruleset-unavailable positions (whole frame collapsed → mirrored for 2.4): **{len(unavail)}** — "
          + (", ".join(f"{c['position']}/{c['role']}[{rs}]" for c, rs in unavail) or "none"),
          f"- removal candidates logged: {sum(len(c['removal_candidates']) for c in cs)}",
          f"- cross-position consistency flags: {len(cal['meta']['crosscheck_flags'])}", ""]

    L.append("## Top movers (by combined L1 shift)")
    movers = sorted(cs, key=lambda c: -(c["diagnostics"]["gi"]["l1_shift"] + c["diagnostics"]["nogi"]["l1_shift"]))
    for c in movers[:25]:
        d = c["diagnostics"]
        L.append(f"### {c['position']} / {c['role']}  (L1 gi {d['gi']['l1_shift']} · nogi {d['nogi']['l1_shift']}"
                 f" · head5 {d['gi']['head5_before']}→{d['gi']['head5_after']})")
        rows = sorted(c["moves"], key=lambda m: -(m["final"]["gi"] + m["final"]["nogi"]))
        for m in rows[:12]:
            pr = m.get("prior") or {}
            L.append(f"- {m['transition']}: {pr.get('gi', '?')}/{pr.get('nogi', '?')} → "
                     f"**{m['final']['gi']}/{m['final']['nogi']}** (gi/nogi)"
                     + (f" ⚓{m['anchor']['gi']}/{m['anchor']['nogi']}" if m.get("anchor") else ""))
        if len(rows) > 12:
            L.append(f"- … {len(rows) - 12} more")
        L.append("")

    L.append("## ALL per-frame zeros (each requires an availability ruling)")
    for c, m in zeros:
        rul = next((r for r in c["availability_rulings"] if r["move"] == m["transition"]), None)
        frame = "gi" if m["final"]["gi"] == 0 else "nogi"
        both = m["final"]["gi"] == 0 and m["final"]["nogi"] == 0
        L.append(f"- {c['position']}/{c['role']} · {m['transition']} → "
                 f"{'BOTH FRAMES 0 ⚠️' if both else frame + '=0'} — "
                 + (rul["reason"] if rul else "**NO RULING FOUND ⚠️**"))
    L.append("")

    L.append("## Largest gi/no-gi divergences")
    all_moves = [(c, m) for c in cs for m in c["moves"]]
    for c, m in sorted(all_moves, key=lambda x: -abs(x[1]["final"]["gi"] - x[1]["final"]["nogi"]))[:20]:
        L.append(f"- {c['position']}/{c['role']} · {m['transition']}: gi {m['final']['gi']} vs nogi {m['final']['nogi']}")
    L.append("")

    L.append("## Removal candidates (logged only — nothing removed this pass)")
    for c in cs:
        for r in c["removal_candidates"]:
            L.append(f"- {c['position']}/{c['role']} · {r['move']} — {r['reason']}")
    L.append("")

    L.append("## Cross-position consistency flags")
    for f in cal["meta"]["crosscheck_flags"][:15]:
        L.append(f"- {f['technique']} (spread {f['spread']}): " + ", ".join(f["sites"]))
    return "\n".join(L)


def _selftest():
    pack = {"family": "leg", "moves": [
        {"move": "Heel Hook", "calibrated_occurrence_anchor": {"gi": 2, "nogi": 40}},
        {"move": "Kneebar"}, {"move": "Maintain"}]}
    stage2 = {
        # ruling text is affirmative here — proves rulings do NOT drive zeros (ballots do)
        "availability_rulings": [{"move": "Heel Hook", "frame": "gi", "reason": "available but rare"}],
        "ballots": [
            {"expert": "craig", "ballot": [
                {"move": "Heel Hook", "gi": 0, "nogi": 60}, {"move": "Kneebar", "gi": 40, "nogi": 20},
                {"move": "Maintain", "gi": 60, "nogi": 20}]},
            {"expert": "roger", "ballot": [
                {"move": "Heel Hook", "gi": 0, "nogi": 30}, {"move": "Kneebar", "gi": 50, "nogi": 30},
                {"move": "Maintain", "gi": 50, "nogi": 40}]},
        ]}
    res = aggregate_container(pack, stage2)
    for rs in RULESETS:
        assert sum(res["final"][rs].values()) == 100, res["final"]
    assert res["final"]["gi"]["Heel Hook"] == 0            # ballot-driven zero (panel mean 0)
    assert res["final"]["nogi"]["Heel Hook"] >= 30          # anchor + heavy nogi votes, NOT zeroed
    assert res["final"]["gi"]["Kneebar"] >= 1 and res["final"]["gi"]["Maintain"] >= 1
    # mean<1 => zeroed (genuine never): both experts ballot Maintain ~0 in gi
    stage2["ballots"][0]["ballot"][2]["gi"] = 1
    stage2["ballots"][1]["ballot"][2]["gi"] = 0
    stage2["ballots"][0]["ballot"][1]["gi"] = 99
    stage2["ballots"][1]["ballot"][1]["gi"] = 100
    resZ = aggregate_container(pack, stage2)
    assert resZ["final"]["gi"]["Maintain"] == 0, resZ["final"]["gi"]
    assert sum(resZ["final"]["gi"].values()) == 100
    # a small-but-present move (renormed mean >= 1) is retained, not zeroed
    stage2["ballots"][0]["ballot"][2]["gi"] = 5
    stage2["ballots"][1]["ballot"][2]["gi"] = 5
    stage2["ballots"][0]["ballot"][1]["gi"] = 90
    stage2["ballots"][1]["ballot"][1]["gi"] = 90
    resF = aggregate_container(pack, stage2)
    assert resF["final"]["gi"]["Maintain"] >= 1, resF["final"]["gi"]
    assert sum(resF["final"]["gi"].values()) == 100
    # floor bump in isolation: a kept move rounded to 0 is pushed back to the floor
    fr = floor_preserving_round({"a": 99.6, "b": 0.4}, zeroed=set(), floor=1)
    assert fr["b"] == 1 and fr["a"] == 99 and sum(fr.values()) == 100, fr
    d = diagnostics(pack, res["final"], {"Heel Hook": {"gi": 10, "nogi": 10},
                                         "Kneebar": {"gi": 45, "nogi": 45},
                                         "Maintain": {"gi": 45, "nogi": 45}})
    assert d["divergent_moves"] >= 1
    print("occurrence_moe selftest OK:", json.dumps(res["final"]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--aggregate", action="store_true",
                    help="aggregate occurrence_elicitation/stage2 -> calibration + preview")
    ap.add_argument("--elicitation-dir", default=str(Path(__file__).resolve().parent.parent / "occurrence_elicitation"))
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "occurrence_calibration.json"))
    ap.add_argument("--preview", default=str(Path(__file__).resolve().parent.parent / "occurrence_preview.md"))
    args = ap.parse_args()
    if args.selftest:
        _selftest()
    elif args.aggregate:
        run_aggregation(Path(args.elicitation_dir), Path(args.out), Path(args.preview))
    else:
        print("Use --selftest or --aggregate.")
