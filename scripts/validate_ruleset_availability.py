#!/usr/bin/env python3
"""validate_ruleset_availability.py — the per-ruleset exclusion layer, gated and ledgered.

THE RULE THIS ENFORCES. A state or technique the active ruleset cannot produce is ABSENT from that
ruleset's graph — not de-ranked, not dimmed. In no-gi there are no lapels, so a lapel guard is not a
rare position, it is not a position; the app must not draw it, deal it, search it or drill it.

WHERE THE VERDICT COMES FROM. `regenerate_neural_data.frame_reachable` — a BFS from
`standing-position/{top,bottom}` over that frame's own `attemptProbabilityByRuleset`. It is imported,
never re-implemented: a second copy here would be written from the same reading of the emitter and
would agree with it by construction while both were wrong (CLAUDE.md 6.3). This script's job is to
check the emitted WIRE against that walk, to prove the switch costs no probability mass, and to write
the ledger.

NOTHING HERE READS A NAME (ruling P3a). The calibration panel refuted the name regex in advance, in
its own notes on `collar-sleeve-guard__bottom`, and a name sweep flags `Rear Naked Choke from
Invisible Collar` — the canonical no-gi choke — because the POSITION is named "Collar".

WHAT IT CHECKS, and why each one is fatal rather than reported:

  1. WIRE PARITY. Every `cal.avail` on the emitted wire equals the walk's verdict. A hand-edited or
     stale `avail` is the one failure that makes every app-side test pass while shipping the wrong
     graph: the app tests assert "no dealt move is unavailable PER THE MASK", so a mask that lies is
     invisible to all of them. This is where a planted impossible row is caught.
  2. ZERO MASS. No surviving position may lose attempt-probability mass to an excluded technique.
     This holds today because unreachability IS the consequence of a 0% attempt share — every
     excluded move already carried 0 in the frame it is excluded from, so no frame needs
     renormalizing. The day that stops being true, renormalization becomes a live decision about
     what the player is dealt, and that is the owner's call, not a script's. Fatal so it cannot be
     made silently.
  3. NO DEAD ENDS. No surviving position may lose every exit. A roll that lands somewhere with an
     empty hand is stuck, and it is the one consequence that would make exclusion unshippable.
  4. COVERAGE FLOORS. An empty walk, an all-true table and a table nobody joined all print what a
     clean run prints (CLAUDE.md 6.6, 17 recorded instances).

NON-KILLS, recorded so nobody reads this as covering more than it does:
  · Dropping ONE of the two `ROLL_SEEDS` does not turn it red — the seats reach each other, so the
    seed set is redundant. Seeds that resolve to NOTHING do fail, loudly, in `frame_reachable`.
  · It cannot see whether the APP honours `avail`; that is `tests/ruleset_availability.test.mjs`.

WHAT IT DELIBERATELY DOES NOT DECIDE. Whether the corpus's verdict is CORRECT. The walk reports that
`lasso-guard` is unreachable in no-gi; whether that is an equipment fact or an unintended cascade
from four zeroed entries is a content question, and the ledger this writes is the artifact for
answering it. Likewise the gi column, which is a LEGALITY set (heel hooks under IBJJF), not an
equipment one — the mechanism is about edges and does not care why an edge is zero.

Usage:  python3 scripts/validate_ruleset_availability.py [--ledger PATH] [--no-ledger]
Exit:   0 = clean · 1 = a check above failed.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from regenerate_neural_data import EXCLUDING_FRAMES, frame_reachable, slugify  # noqa: E402  ONE implementation

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "graph.json"
WIRE = ROOT / "source/quartz/static/neural/graph-data.json"
LEDGER = ROOT / "tests/artifacts/ruleset_availability.json"
FRAMES = ("gi", "nogi")

# Floors, re-derivable with this script's own output. A count is a claim: re-run before changing one.
MIN_POSITIONS = 250          # position role-nodes in graph.json
MIN_TECHNIQUES = 1200        # technique hubs
MIN_EXCLUDED_NOGI = 60       # the corpus authored ruleset zeros; finding none means the walk broke


def role_nodes(graph):
    return {k: v for k, v in graph["positions"].items() if v.get("role") in ("top", "bottom")}


def tech_hubs(graph):
    out = {}
    for section in ("transitions", "submissions"):
        for node in graph.get(section, {}).values():
            hub = node.get("hub")
            if hub and node.get("role") != "hub":
                out.setdefault(hub, node.get("name") or hub)
    return out


def main():
    ap = argparse.ArgumentParser(description="Gate the per-ruleset exclusion layer and write its ledger.")
    ap.add_argument("--graph", default=str(GRAPH))
    ap.add_argument("--wire", default=str(WIRE))
    ap.add_argument("--ledger", default=str(LEDGER))
    ap.add_argument("--no-ledger", action="store_true")
    a = ap.parse_args()

    graph = json.loads(Path(a.graph).read_text(encoding="utf-8"))
    positions, hubs = role_nodes(graph), tech_hubs(graph)
    walk = {fr: frame_reachable(graph, fr) for fr in FRAMES}
    # The walk answers both columns; the exclusion layer ACTS on `EXCLUDING_FRAMES` only, because
    # the gi column is IBJJF legality rather than equipment (the reasoning is at that constant).
    # A non-excluding frame is admitted whole here too, or wire parity would report the emitter
    # "wrong" for correctly shipping the policy.
    reach = {fr: (walk[fr] if fr in EXCLUDING_FRAMES else
                  {"positions": set(positions),
                   "techniques": set(hubs)}) for fr in FRAMES}
    fail = []

    print("[validate_ruleset_availability] per-ruleset exclusion")
    print(f"  position role-nodes walked      : {len(positions)}")
    print(f"  technique hubs walked           : {len(hubs)}")
    if len(positions) < MIN_POSITIONS or len(hubs) < MIN_TECHNIQUES:
        fail.append(f"coverage floor: {len(positions)} positions / {len(hubs)} techniques — the walk "
                    f"found almost nothing, which is what a clean run also looks like")

    excl, unreachable = {}, {}
    for fr in FRAMES:
        ep = sorted(k for k in positions if k not in reach[fr]["positions"])
        et = sorted(h for h in hubs if h not in reach[fr]["techniques"])
        excl[fr] = {"positions": ep, "techniques": et}
        # what the WALK found, whether or not the layer acts on it — the gi column is the report
        # that keeps the heel-hook decision visible and one-token reversible.
        unreachable[fr] = {"positions": sorted(k for k in positions if k not in walk[fr]["positions"]),
                           "techniques": sorted(h for h in hubs if h not in walk[fr]["techniques"])}
        act = "EXCLUDED" if fr in EXCLUDING_FRAMES else "reported only, not excluded"
        print(f"  {fr:<5} unreachable by the walk : {len(unreachable[fr]['positions']):>3} position "
              f"role-node(s), {len(unreachable[fr]['techniques']):>4} technique(s)  [{act}]")
    if not EXCLUDING_FRAMES:
        fail.append("EXCLUDING_FRAMES is empty — the layer is switched off, and an off layer prints "
                    "exactly what a corpus with no gi-only content prints")
    if len(excl["nogi"]["techniques"]) < MIN_EXCLUDED_NOGI:
        fail.append(f"only {len(excl['nogi']['techniques'])} techniques are absent in no-gi. The "
                    f"corpus authored per-frame zeros; a walk that finds none matched nothing.")

    # ── 2 + 3: what exclusion costs a SURVIVING position ────────────────────────────────────
    for fr in FRAMES:
        gone_t, gone_p = set(excl[fr]["techniques"]), set(excl[fr]["positions"])
        mass, dead, checked = [], [], 0
        for key, node in positions.items():
            if key in gone_p:
                continue
            live, lost = 0, 0
            for t in (node.get("transitions") or []):
                checked += 1
                v = (t.get("attemptProbabilityByRuleset") or {}).get(fr)
                v = v if isinstance(v, (int, float)) else 0
                if t.get("target") in gone_t:
                    lost += v
                elif v > 0:
                    live += 1
            if lost:
                mass.append((key, lost))
            if not live:
                dead.append(key)
        print(f"  {fr:<5} surviving positions      : {len(positions) - len(gone_p)}  "
              f"({checked} edges checked)")
        if mass:
            tot = sum(m for _, m in mass)
            fail.append(f"{fr}: {len(mass)} surviving position(s) lose {tot} attempt-percentage "
                        f"point(s) to an excluded technique — renormalization is now a real "
                        f"question and is the owner's call. First: {mass[:4]}")
        if dead:
            fail.append(f"{fr}: {len(dead)} surviving position(s) have NO exit left — a roll landing "
                        f"there is stuck. {dead[:6]}")

    # ── 1: wire parity ──────────────────────────────────────────────────────────────────────
    wire_path = Path(a.wire)
    if not wire_path.exists():
        print(f"  wire parity                     : SKIPPED — {a.wire} not emitted "
              f"(run `npm run regenerate:neural`)")
        print("    NOT a pass. The wire is what ships; this run checked graph.json only.")
    else:
        wire = json.loads(wire_path.read_text(encoding="utf-8"))
        checked, mismatch = 0, []
        for n in wire.get("nodes", []):
            av = (n.get("cal") or {}).get("avail")
            if not isinstance(av, dict):
                continue
            nid, ty = n.get("id") or "", n.get("ty")
            if ty == "positions":
                slug = nid.split("/", 1)[-1].lower() if "/" in nid else nid.lower()
                cand = [slug, slug.rsplit("/", 1)[-1]]
                want = {fr: any(f"{c}/{r}" in reach[fr]["positions"] for c in cand for r in ("top", "bottom"))
                        for fr in FRAMES}
                if not any(f"{c}/{r}" in positions for c in cand for r in ("top", "bottom")):
                    continue
            else:
                slug = nid.split("/", 1)[-1].lower() if "/" in nid else nid.lower()
                keys = [slug, slug.replace("/", "-"), slugify(n.get("t") or "")]
                keys = [k for k in keys if k in hubs]
                if not keys:
                    continue
                want = {fr: any(k in reach[fr]["techniques"] for k in keys) for fr in FRAMES}
            checked += 1
            for fr in FRAMES:
                if bool(av.get(fr)) != want[fr]:
                    mismatch.append((nid, fr, bool(av.get(fr)), want[fr]))
        print(f"  wire parity                     : {checked} node(s) joined to the walk, "
              f"{len(mismatch)} disagree")
        if checked < MIN_TECHNIQUES:
            fail.append(f"wire parity joined only {checked} nodes — the join rotted, and a join that "
                        f"matches nothing reports clean")
        for nid, fr, got, want in mismatch[:12]:
            print(f"    {nid:<52} {fr}: wire={got} walk={want}")
        if mismatch:
            fail.append(f"{len(mismatch)} wire `avail` cell(s) disagree with the reachability walk. "
                        f"The wire is what the app filters on, so a cell that lies here is invisible "
                        f"to every app-side test. Re-run `npm run regenerate:neural`.")

    if not a.no_ledger:
        led = Path(a.ledger)
        led.parent.mkdir(parents=True, exist_ok=True)
        led.write_text(json.dumps({
            "note": ("Per-ruleset exclusion, DERIVED — regenerate with "
                     "`npm run validate:availability`. A node listed here is absent from that "
                     "ruleset's graph entirely. The verdict is reachability from "
                     "standing-position over that frame's own attempt probabilities; no name is "
                     "ever read (ruling P3a). Whether each row SHOULD be excluded is a content "
                     "question — see the gi column, which is IBJJF heel-hook legality, not "
                     "equipment."),
            "source": "scripts/regenerate_neural_data.py:frame_reachable over graph.json",
            "excluding_frames": list(EXCLUDING_FRAMES),
            "counts": {fr: {"excluded_positions": len(excl[fr]["positions"]),
                            "excluded_techniques": len(excl[fr]["techniques"]),
                            "unreachable_positions": len(unreachable[fr]["positions"]),
                            "unreachable_techniques": len(unreachable[fr]["techniques"]),
                            "acts": fr in EXCLUDING_FRAMES} for fr in FRAMES},
            "excluded": {fr: {"positions": excl[fr]["positions"],
                              "techniques": [{"id": h, "name": hubs[h]} for h in excl[fr]["techniques"]]}
                         for fr in FRAMES},
            "unreachable_but_not_excluded": {
                fr: {"positions": unreachable[fr]["positions"],
                     "techniques": [{"id": h, "name": hubs[h]} for h in unreachable[fr]["techniques"]]}
                for fr in FRAMES if fr not in EXCLUDING_FRAMES},
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  ledger                          : {led.relative_to(ROOT)}")

    if fail:
        print("\n[validate_ruleset_availability] FAILED:", file=sys.stderr)
        for f in fail:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print("\n[validate_ruleset_availability] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
