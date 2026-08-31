#!/usr/bin/env python3
"""validate_seat_decks.py — the seat axis: no deck may lie about which seat its cards were written for.

THE INVARIANT, IN ONE SENTENCE
    A card served to a seat must have been written FOR that seat, and every seat that ships a deck
    must own at least one such card.

Three ways the corpus breaks it, and this gate is the only thing that looks:

  S1 PURITY    No card question may appear on both seats of one site. A verbatim copy is not
               authorship: the reader is told "this is your side" about a card written for the
               other one. Measured at introduction: 5 files, 33 cards.

  S2 OWNERSHIP Every seat must carry >=1 card of its own. This is the one the obvious invariant
               MISSES. `_blend_deck` (regenerate_neural_data.py) falls back to the role-AGNOSTIC
               `flashcards_position` / `flashcards_family` tiers when a seat has no cards, so both
               seats receive the identical deck. Those cards are not written for the other seat —
               they are written for NEITHER — so a purity check reports clean while a bottom player
               drills the general position and never once meets their own half of it. Measured at
               introduction: 26 seats, all 13 FAMILY-schema hubs x 2, carrying 47.7% of position
               traffic between them.

  S4 ONE FINISHER  No submission family may be authored as finishing from BOTH seats of one
               position. Only one player is finishing an omoplata. This is the mechanical signature
               of "one state plays both sides of its own exchange", and it is precise: the obvious
               weaker probe — "submissions authored from both seats" — returns 10 rows and cannot
               separate a genuine defect from Closed Guard, where two-way submissions are correct.
               Measured at introduction: 1 position, 0 false positives across all 136.

               (There is no S3 here on purpose. S3 is REACHABILITY — every role a deck is keyed to
               must be one the app can actually mint — and it cannot be honestly checked from
               Python. Asserting it against `app.src.jsx` source text, or against the minified
               bundle, is a decoration that passes on a build it never read. It lives in
               e2e/journeys/seat-decks.spec.ts, which drives the real `deckKeyFor` over all 1,331
               technique sites and asserts on what it EMITTED. Numbered S3 there so the two halves
               of one invariant keep one numbering.)

WHAT IT READS, AND WHY THAT IS THE WHOLE POINT
    `content/**/*.json` and NOTHING ELSE. Not `graph.json`, not the emitted wire.
    `source/quartz/static/neural/` is gitignored in its entirety, and a gate that reads a gitignored
    payload does not fail on a fresh checkout — it SKIPS, silently, and reports the same clean line
    it would report if it had looked (CLAUDE.md section 6.6). Reading only authored source also means
    this gate cannot go stale against a regeneration it did not run, and needs no emit step ahead of
    it in CI. Every fact it asserts is a fact about what a human wrote.

POSITIVE COVERAGE, EVERY RUN
    It prints seats scanned, sites scanned and cards scanned, and hard-fails when any of them is
    zero. "Found no problems" and "never looked" must not produce the same output — a glob that
    stopped matching would otherwise read as a corpus with no defects in it.

BASELINE
    tests/artifacts/seat_deck_baseline.json, shaped on flow_validation_baseline.json: `max_new: 0`
    and a `known` map naming EVERY tolerated violation with its reason. An aggregate count is
    unfalsifiable and rots into permanent noise (section 6.7). Shrinking the list always passes, and
    a row that has been fixed is reported so it can be deleted. The baseline is read BY THIS SCRIPT,
    not by a workflow, so the runner and the reader can never disagree about it.

Usage:  python3 scripts/validate_seat_decks.py [--report] [--baseline]
Exit:   0 = every seat owns its cards and serves only its own; 1 = it does not.
Run:    npm run validate:seats

WHERE IT RUNS (an unwired ratchet is not a ratchet):
  - `npm run validate:seats`                — the direct entry point.
  - .github/workflows/ci-validate.yml       — step "Seat-deck invariant (gate)".
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
BASELINE = ROOT / "tests" / "artifacts" / "seat_deck_baseline.json"

# The two seat axes. Positions split Top/Bottom, techniques Attacker/Defender — they are DIFFERENT
# axes and must never be conflated (CLAUDE.md section 6.6, `valIdx` vs `roleIdx`), which is why the
# pair is carried here rather than a single "role" string.
SEATS = {
    "Positions": ("top", "bottom"),
    "Transitions": ("attacker", "defender"),
    "Submissions": ("attacker", "defender"),
}


def _cards(seat_obj) -> list:
    """The cards authored FOR this seat. `flashcards_position` / `flashcards_family` live at the
    file ROOT and are role-agnostic by their own schema descriptions, so they are deliberately not
    reachable from here — counting them as a seat's own is exactly the confusion S2 exists to name."""
    if not isinstance(seat_obj, dict):
        return []
    fc = seat_obj.get("flashcards")
    return fc if isinstance(fc, list) else []


def _questions(cards: list) -> list:
    return [str(c.get("question", "")).strip() for c in cards if isinstance(c, dict) and c.get("question")]


def _family(path: Path) -> str:
    """A submission's family. Nested submissions live in `content/Submissions/<Family>/<file>.json`;
    a flat one is its own family. Derived from the PATH, which is what `regenerate_graph.py` groups
    on, and never from the display name — two files in one family deliberately share name fragments."""
    return path.parent.name if path.parent.name != "Submissions" else path.stem


def scan():
    """Walk the authored corpus once. Returns (violations, counts)."""
    viol = {}          # key -> human-readable detail
    n_sites = n_seats = n_cards = 0
    n_files = defaultdict(int)
    # S4 accumulator: position -> submission family -> {seats that finish it}
    finishers = defaultdict(lambda: defaultdict(set))
    fin_members = defaultdict(lambda: defaultdict(int))   # how many submissions each pair carries

    for category, (sa, sb) in SEATS.items():
        for path in sorted((CONTENT / category).rglob("*.json")):
            try:
                doc = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                viol[f"PARSE:{path.relative_to(ROOT)}"] = f"unreadable: {exc}"
                continue
            if not isinstance(doc, dict):
                continue
            n_files[category] += 1
            name = doc.get("name") or path.stem

            # A family hub (`is_family`, or a position hub with variants) is a flashcard AGGREGATOR
            # and carries NEITHER seat. That is a real skip, and it is counted and printed rather
            # than vanishing into the pass.
            #
            # ONE seat present and the other absent is NOT that case, and the tempting single
            # `if not both: continue` swallows it — the file would be counted as an aggregator and
            # its one real seat would never be read, so S1 and S2 would both report clean on it.
            # That is this repo's own "absence produces a plausible answer" inside the gate written
            # to catch it. Zero such files exist today (136/136 positions and 1,331/1,331 techniques
            # carry both), which is exactly why it has to fail loudly the first time one appears.
            a_obj, b_obj = doc.get(sa), doc.get(sb)
            has_a, has_b = isinstance(a_obj, dict), isinstance(b_obj, dict)
            if not has_a and not has_b:
                n_files[f"{category}:hub-skipped"] += 1
                continue
            if not has_a or not has_b:
                viol[f"S0:{name}"] = (
                    f"carries `{sa if has_a else sb}` but not `{sb if has_a else sa}` — one seat of a "
                    f"pair cannot be read, so every other check silently passes on this file "
                    f"({path.relative_to(ROOT)})"
                )
                n_files[f"{category}:half-seated"] += 1
                continue

            n_sites += 1
            n_seats += 2
            qa, qb = _questions(_cards(a_obj)), _questions(_cards(b_obj))
            n_cards += len(qa) + len(qb)

            # ── S1 PURITY ─────────────────────────────────────────────────────────────────────
            shared = set(qa) & set(qb)
            if shared:
                viol[f"S1:{name}"] = (
                    f"{len(shared)} card(s) served to BOTH {sa} and {sb}"
                    + (" — the two seats are byte-identical" if qa and qa == qb else "")
                    + f" ({path.relative_to(ROOT)})"
                )

            # ── S2 OWNERSHIP ──────────────────────────────────────────────────────────────────
            for seat, qs in ((sa, qa), (sb, qb)):
                if not qs:
                    viol[f"S2:{name}|{seat.capitalize()}"] = (
                        f"seat owns 0 cards; its deck is the role-agnostic tier, identical to the "
                        f"other seat's ({path.relative_to(ROOT)})"
                    )

            # ── S4 accumulation (submissions only) ────────────────────────────────────────────
            if category == "Submissions" and not doc.get("is_family"):
                fp = str(doc.get("from_position") or "")
                if "/" in fp:
                    pos, role = fp.rsplit("/", 1)
                    finishers[pos][_family(path)].add(role)
                    fin_members[pos][_family(path)] += 1

    # ── S4 ONE FINISHER ───────────────────────────────────────────────────────────────────────
    n_finish = n_multi = 0
    for pos, fams in finishers.items():
        for fam, roles in fams.items():
            n_finish += 1
            if fin_members[pos][fam] > 1:
                n_multi += 1
            if len(roles) > 1:
                viol[f"S4:{pos}/{fam}"] = (
                    f"the {fam} family is authored as finishing from BOTH seats "
                    f"({', '.join(sorted(roles))}) of {pos} — one state, both sides of its own exchange"
                )

    counts = {
        "sites": n_sites,
        "seats": n_seats,
        "cards": n_cards,
        "position_files": n_files["Positions"],
        "transition_files": n_files["Transitions"],
        "submission_files": n_files["Submissions"],
        "hubs_skipped": sum(v for k, v in n_files.items() if k.endswith(":hub-skipped")),
        "half_seated": sum(v for k, v in n_files.items() if k.endswith(":half-seated")),
        "finisher_pairs": n_finish,
        "finisher_pairs_multiseat": n_multi,
    }
    return viol, counts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    # No --gate flag. This ALWAYS gates: a validator with an opt-in gate is one `npm run` away
    # from being wired up in a mode that cannot fail (CLAUDE.md section 6.9).
    ap.add_argument("--report", action="store_true", help="print every violation, baselined or not")
    ap.add_argument("--baseline", action="store_true", help="rewrite the baseline from today's corpus")
    args = ap.parse_args()

    viol, c = scan()

    # POSITIVE COVERAGE FIRST, always, and a hard floor on each count. A glob that matched nothing
    # would otherwise print the identical clean line a defect-free corpus prints.
    print(
        f"[validate_seat_decks] scanned {c['sites']} sites / {c['seats']} seats / {c['cards']} cards"
        f"  ({c['position_files']} position, {c['transition_files']} transition, "
        f"{c['submission_files']} submission files; {c['hubs_skipped']} family hub(s) skipped — "
        f"aggregators, no seats"
        + (f"; {c['half_seated']} file(s) carry ONE seat only" if c['half_seated'] else "") + ")"
    )
    # State the blind spot in the same breath as the count. S4 can only fire where a (position,
    # family) pair carries MORE THAN ONE authored submission — everywhere else a single row cannot
    # disagree with itself. Quoting the 292 alone would read as far more coverage than it is.
    print(f"    S4 universe: {c['finisher_pairs']} (position, submission-family) pairs, of which "
          f"{c['finisher_pairs_multiseat']} carry >1 authored submission — the only pairs where "
          f"this check can fire on today's corpus")
    sys.stdout.flush()
    floors = {"sites": 100, "seats": 200, "cards": 1000, "finisher_pairs": 100}
    starved = [f"{k}={c[k]} below floor {v}" for k, v in floors.items() if c[k] < v]
    if starved:
        print("[validate_seat_decks] FAIL — the corpus scan came back starved; this is a broken "
              "scan reporting as a clean corpus:", file=sys.stderr)
        for s in starved:
            print(f"  - {s}", file=sys.stderr)
        return 1

    if args.baseline:
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        prev = json.loads(BASELINE.read_text()) if BASELINE.exists() else {}
        BASELINE.write_text(json.dumps({
            "max_new": 0,
            "note": prev.get("note", "Seat-axis violations tolerated today. Regenerate: "
                                     "python3 scripts/validate_seat_decks.py --baseline"),
            "known": {k: viol[k] for k in sorted(viol)},
            "reviewed": prev.get("reviewed", {}),
        }, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
        print(f"[validate_seat_decks] baseline written: {len(viol)} row(s) -> {BASELINE}")
        return 0

    if not BASELINE.exists():
        known, reviewed = {}, {}
        print(f"[validate_seat_decks] NOTE: no baseline at {BASELINE} — every violation is new.")
    else:
        base = json.loads(BASELINE.read_text())
        known, reviewed = base["known"], base.get("reviewed", {})
        max_new = base["max_new"]

    by_check = defaultdict(int)
    for k in viol:
        by_check[k.split(":", 1)[0]] += 1
    print("    violations: " + (" · ".join(f"{k} {v}" for k, v in sorted(by_check.items())) or "none"))

    new = sorted(set(viol) - set(known))
    gone = sorted(set(known) - set(viol))

    if args.report:
        for k in sorted(viol):
            tag = "known " if k in known else "NEW   "
            print(f"  {tag} {k}\n         {viol[k]}")
            if k in reviewed:
                print(f"         reviewed: {reviewed[k]}")

    if gone:
        print(f"[validate_seat_decks] {len(gone)} baselined row(s) are FIXED — delete from "
              f"tests/artifacts/seat_deck_baseline.json in the same commit:")
        for k in gone:
            print(f"    FIXED  {k}")

    if new:
        print(f"[validate_seat_decks] FAIL — {len(new)} seat violation(s) not in the baseline:", file=sys.stderr)
        for k in new:
            print(f"  - {k}: {viol[k]}", file=sys.stderr)
        print("  A seat must own its cards and serve only its own. Author the seat, or add the row "
              "to tests/artifacts/seat_deck_baseline.json with the reason it stands.", file=sys.stderr)
        return 1

    print(f"[validate_seat_decks] OK — {len(viol)} tolerated violation(s), 0 new; "
          f"{c['seats'] - by_check['S2']} of {c['seats']} seats own at least one card "
          f"({(c['seats'] - by_check['S2']) / c['seats'] * 100:.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
