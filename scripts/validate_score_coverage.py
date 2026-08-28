#!/usr/bin/env python3
"""validate_score_coverage.py — what Game Knowledge can SEE, REPORTED, not gated.

`curriculum.weights` is the only thing the app's `gameScore` sums (`neural/src/app.src.jsx`), so a
deck with no key in it is not scored low — it is INVISIBLE. Mastering every card in it moves the
only number the product publishes by exactly zero, and nothing anywhere says so. That is this
repo's most repeated failure class (CLAUDE.md section 6.6): absence produces a plausible answer.
The user sees a believable percentage either way.

Nothing counted the score's own reach until now. There is ONE writer of `weights`
(`regenerate_neural_data.build_technique_weights`), TWO readers (`gameScore`, `startPosTraffic`)
and, before this file, ZERO validators. `validate_curriculum.py` structurally cannot cover it: it
runs BEFORE the weights are built and reads `templates/curriculum.json`, which has no `weights`
key at all.

WHAT IT REPORTS, and the claim behind each section:

  1. RULESET REACH. For each frame, the techniques ATTEMPTABLE in that frame that carry no weight
     in it. This is a DEFECT with a known cause, not a matter of taste: `build_technique_weights`
     reads the folded `attemptProbability` — the no-gi scalar — while `attemptProbabilityByRuleset`
     sits on the same dict on every edge. `--gate` fires on this section and nothing else.

  2. WHAT IS LEFT OUT, and why. Until v1.145.13 this was two whole categories — all 1,326
     `|Defender` decks and all 272 `|Top`/`|Bottom` decks, 9,071 cards, 41.4% of the corpus,
     scoring exactly zero on an agent's design decision that no human ever made. The owner ruled:
     score the whole corpus and let scores fall, while nobody yet holds a belt worth losing. The
     table now spans three blocks and the only legitimate residue is `orphan` — a technique node
     no position edge targets, unreachable in the state machine, so no weight is correct for it.
     A whole ROLE appearing here again means a block stopped producing keys.

  3. THE JOIN'S OWN COVERAGE. See the exit rule below.

WHAT IT DOES NOT DO. It does not read `source/quartz/static/neural/` — that directory is gitignored
in its entirety (`.gitignore:71`), so a check that reads the emitted artifacts is a check that
silently does not run on a fresh checkout, which is one of the three ways a gate could not fail
this week. Every number here is derived from the COMMITTED `graph.json` through the emitter's own
functions, so the thing measured is the thing that ships.

IT DOES NOT DUPLICATE `validate_occurrence_surface.py`. That asks whether content's per-frame
availability is internally coherent. This asks whether the SCORE covers what content says is
available. Section 1 here is downstream of that file's subject and the two sets are not disjoint —
never quote one as though it excluded the other.

RESOLVED BY THE TARGET, NEVER BY THE NAME. A position edge's `technique` display name and the node
it targets disagree: `aoki-lock-control/top` offers "Aoki Lock" but targets
`aoki-lock-from-aoki-lock-control`, whose node is named "Aoki Lock from Aoki Lock Control". A
name-keyed join files availability against a deck key no position actually feeds. This walks the
target, which is the same mapping `build_technique_weights` uses to name its own output, so the
check and the thing checked cannot drift onto two spellings.

REPORTING ONLY. Exits 0 whatever it finds, like `validate_occurrence_surface.py` and for the same
reason: the behaviour change that closes section 1 moves every gi player's score and is not
shipping before the owner has seen it. `--gate` makes section 1 fatal and is deliberately wired
into no workflow.

ZERO COVERAGE IS ALWAYS FATAL, even in reporting mode (CLAUDE.md 6.6). A per-frame check with an
empty denominator reports "0 techniques unweighted" — which is exactly what a clean run prints.
The floor is on the DENOMINATOR, not on the answer.

Usage:  python3 scripts/validate_score_coverage.py [--gate] [--write]
Exit:   0 = reported · 1 = hollow join (or --gate with section-1 findings)
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = ROOT / "tests/artifacts/score_coverage.json"

# The availability join must reach at least this share of attacker decks. A floor on the
# DENOMINATOR: below it, section 1 is vacuous and would report a clean run.
JOIN_FLOOR = 0.95


def _tech_deck_key_by_target(graph: dict) -> dict:
    """Position-edge TARGET slug -> that technique's attacker deck key. See the header on why
    this may not be keyed by the edge's `technique` display name."""
    out: dict[str, str] = {}
    for bucket in ("transitions", "submissions"):
        for tid, node in (graph.get(bucket) or {}).items():
            if node.get("role") != "attacker":
                continue
            base = tid.rsplit("/", 1)[0]
            out[base] = f"{node.get('name') or base}|Attacker"
    return out


def frame_avail_by_deck(graph: dict) -> dict:
    """{attacker deck key: {"gi": bool, "nogi": bool}} — attemptable in frame F iff SOME position
    offers it with attemptProbability[F] > 0. A key ABSENT from this map is offered by no position
    in any ruleset: unreachable in the state machine, so no weight is correct for it, and it is
    reported under `orphan` rather than as a ruleset finding."""
    from regenerate_neural_data import _frame_positive
    keys = _tech_deck_key_by_target(graph)
    av: dict[str, dict] = {}
    for node in (graph.get("positions") or {}).values():
        for t in node.get("transitions") or []:
            k = keys.get(t.get("target"))
            if not k:
                continue
            a = av.setdefault(k, {"gi": False, "nogi": False})
            for fr in ("gi", "nogi"):
                if _frame_positive(t, fr):
                    a[fr] = True
    return av


def score_coverage(decks: dict, graph: dict, tables: dict, write: bool = False) -> dict:
    """Classify every authored deck against what the score can see. Prints; returns the ledger.
    Raises SystemExit only on a hollow join — findings are reported, never fatal here."""
    avail = frame_avail_by_deck(graph)
    n = {k: len(d.get("cards") or []) for k, d in decks.items()}
    by_role: dict[str, list] = {}
    for k, d in decks.items():
        by_role.setdefault(d.get("role") or "?", []).append(k)
    attackers = by_role.get("Attacker", [])
    total_cards = sum(n.values())

    def tot(keys):
        return {"decks": len(keys), "cards": sum(n.get(k, 0) for k in keys)}

    reached = [k for k in attackers if k in avail]
    pct_join = 100.0 * len(reached) / max(1, len(attackers))
    seen = {k for t in tables.values() for k in t}
    scored = [k for k in decks if k in seen]

    led = {
        "totals": {"decks": len(decks), "cards": total_cards},
        "scored": dict(tot(scored), card_pct=round(100.0 * sum(n[k] for k in scored) / max(1, total_cards), 2)),
        "ruleset": {},
        "unscored": {},
        "join": {"attacker_decks": len(attackers), "reached": len(reached), "pct": round(pct_join, 2)},
    }
    print(f"  score coverage: {total_cards:,} authored cards across {len(decks):,} decks")
    for fr in sorted(tables):
        tbl = tables[fr]
        live = [k for k in attackers if (avail.get(k) or {}).get(fr)]
        miss = sorted(k for k in live if not tbl.get(k))
        led["ruleset"][fr] = dict(
            attemptable=tot(live), unweighted=tot(miss),
            unweighted_examples=[k.split("|")[0] for k in miss[:5]])
        flag = "" if not miss else f"   <-- {len(miss)} attemptable, weight 0 ({sum(n[k] for k in miss):,} cards)"
        print(f"    weighted {fr:<4}: {len(live) - len(miss):>5}/{len(live):<5} attemptable attacker decks, "
              f"{sum(n[k] for k in live) - sum(n[k] for k in miss):>6,}/{sum(n[k] for k in live):<6,} cards{flag}")

    # WHAT IS LEFT OUT, GROUPED BY THE REASON IT IS LEFT OUT — never by a tolerated-class name.
    # Since v1.145.13 the table spans all three blocks (position / attacker / defender), so a
    # whole ROLE appearing here again is a block that stopped producing keys, which is the defect
    # this ledger was written for. `orphan` is the one legitimate residue: a technique node no
    # position edge targets is unreachable in the state machine, so no weight is the right answer
    # for it and its defender twin — that is graph wiring, not scoring.
    orphans = {k for k in attackers if k not in avail}
    # A technique's defender deck inherits its attacker's reachability: the defender block mirrors
    # the attacker one, so whatever leaves a technique out of the table leaves both seats out.
    ruleset = {k for k in attackers if k not in seen and k in avail}
    for group in (orphans, ruleset):
        group |= {k.replace("|Attacker", "|Defender") for k in list(group)}
    groups: dict[str, list] = {}
    unscored = [k for k in decks if k not in seen]
    for k in unscored:
        label = ("orphan" if k in orphans else "ruleset" if k in ruleset
                 else f"role:{decks[k].get('role')}")
        groups.setdefault(label, []).append(k)
    for label, keys in sorted(groups.items()):
        why = {
            "orphan": "no position edge targets the node - unreachable, graph wiring, see Group 1",
            "ruleset": "attemptable in gi only, and the table is solved in the folded no-gi frame "
                       "- the OPEN defect the ruleset rows above report; both seats, not just the "
                       "attacker",
        }.get(label, "IN a scored role yet carrying no key: a block or a join stopped producing")
        led["unscored"][label] = dict(tot(keys), why=why)
        led["unscored"][label]["keys"] = sorted(keys)[:12]
        t = tot(keys)
        print(f"    NOT SCORED {label:<12}: {t['decks']:>4} decks / {t['cards']:>6,} cards   ({why})")
    if not unscored:
        print("    NOT SCORED none - every authored deck carries a weight")
    print(f"    the score can see {led['scored']['cards']:,} of {total_cards:,} cards "
          f"({led['scored']['card_pct']}%) in {led['scored']['decks']:,} decks")

    if not decks or not seen or pct_join < JOIN_FLOOR:
        raise SystemExit(
            f"[score-coverage] the ruleset-availability join reached {len(reached)}/{len(attackers)} "
            f"attacker decks ({pct_join:.1f}%), against a {JOIN_FLOOR:.0%} floor "
            f"({len(decks)} decks, {len(seen)} weighted keys). Below the floor the per-frame rows "
            f"above are VACUOUS: they would print zero findings because they had nothing to "
            f"iterate. Zero coverage is fatal even in reporting mode."
        )
    if write:
        led["_meta"] = {
            "note": "OBSERVED, not a ceiling. What curriculum.weights can see, derived from the "
                    "committed graph.json through the emitter's own functions. `ruleset` is a "
                    "DEFECT class with a known cause; `unscored` is an open question for the "
                    "owner and is deliberately NOT an exemption list.",
            "recompute": "npm run validate:score-coverage -- --write",
        }
        ARTIFACT.write_text(json.dumps(led, indent=2, sort_keys=True) + "\n")
        print(f"    -> {ARTIFACT.relative_to(ROOT)}")
    return led


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gate", action="store_true",
                    help="make the RULESET section fatal (wired into no workflow; see the header)")
    ap.add_argument("--write", action="store_true", help=f"rewrite {ARTIFACT.relative_to(ROOT)}")
    args = ap.parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from regenerate_neural_data import build_flashcards, build_score_weights

    graph = json.loads((ROOT / "graph.json").read_text())
    decks = build_flashcards(graph)
    w = build_score_weights(graph)
    # ONE table today, and it is the NO-GI one: `build_technique_weights` reads the folded
    # `attemptProbability`. Asking each frame the same question of it is not a modelling choice,
    # it is the honest statement of what ships — and it is exactly what the gi row reports.
    led = score_coverage(decks, graph, {"gi": w, "nogi": w}, write=args.write)

    bad = {fr: r for fr, r in led["ruleset"].items() if r["unweighted"]["decks"]}
    if bad and args.gate:
        parts = "; ".join(f"{fr}: {r['unweighted']['decks']} decks / {r['unweighted']['cards']} cards "
                          f"(e.g. {', '.join(r['unweighted_examples'][:3])})" for fr, r in sorted(bad.items()))
        print(f"[score-coverage] --gate: a ruleset scores attemptable techniques at ZERO — {parts}",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
