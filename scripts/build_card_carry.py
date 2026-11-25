#!/usr/bin/env python3
"""THE ONE-TIME CARRY's SOURCE (CARD1-S3, v1.304.0): which old question key each deck's reworded card had, and which key
its card has today. Writes neural/card-carry.json, which the neural emitter checks against the decks it emits and ships
as data chunks (scripts/regenerate_neural_data.py `_carry_chunks`); the app carries a record's rows once (neural/src/
card-carry.src.js). Never hand-edited: re-run this script.

WHY. v1.182.2 (90ceb6207, "Enforce concise authored flashcard questions") rewrote about half the corpus's questions. A
card's progress was keyed by its question's hash, so every player's grade and schedule on a reworded card stayed under the
OLD hash, which no deck holds since (DUE1). The rewrite reached the dev preview on 10 Sept 2026 and production on 15 Sept
(v1.182.13, main 7494c317c). CARD1-S2 made the key stable from now on; this gives back what that rewrite took.

THE THREE EMITS it reads, each made by ITS OWN commit's emitter (`python3 scripts/regenerate_neural_data.py` in a scratch
worktree of that commit; its `source/quartz/static/neural/flashcards` copied out):
  --old  90ceb6207^ (98340ba10, v1.182.1: the last decks before the rewrite)
  --rw   90ceb6207  (v1.182.2: the rewrite itself)
  --now  the decks a player meets today (3947d4418, v1.303.0, for the committed file; content is unchanged since 510d3b25a)
Each directory holds the per-deck chunks (`{deck key: {"cards": [{"q": …, "k"?: …}, …]}}`); the manifest and the live files
are skipped.

THE PAIRING, deck by deck (every key is the app's card key: `k` when the wire carries one, else fnv1a32 of the question):
  · the rewrite's own map: a deck present at --old and --rw with the same number of cards pairs card i with card i (the
    rewrite changed text in place: every one of the 2,896 decks pairs); a card whose text changed gives old key A → B;
  · A is carried only if deck d TODAY no longer holds A (else the row is live already) and:
      direct      d holds B today: (d, A → B);
      second hop  d does not, the deck has as many cards at --rw as today, and today's card at the same place is another
                  card (reworded again since): (d, A → its key C);
    else it is left out (not recovered), and counted;
  · LEFT OUT and counted, never guessed:
      a split     A maps to more than one target (a shared question reworded differently per deck, or a question repeated
                  in its deck): no single heir;
      a collision the target was itself an OLD question of deck d (another card's text then): that card's rows are its own;
      deck gone   deck d is not on today's wire;
      other       an old question in no deck today that the rewrite did not touch (orphaned by later changes).
OUTPUT, deterministic: decks sorted by key, each deck's pairs sorted by the old key, as one string of 16 hex characters a
pair (old 8, then new 8). Two runs on the same three emits write the same bytes (tests/card_carry_build.py).

  python3 scripts/build_card_carry.py --old DIR --rw DIR --now DIR [--out neural/card-carry.json] [--check]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from _neural_content import fnv1a32  # noqa: E402

OUT = ROOT / "neural" / "card-carry.json"
CARD_ID = set("0123456789abcdef")


def _key(card: dict) -> str:
    k = card.get("k")
    return k if isinstance(k, str) and len(k) == 8 and set(k) <= CARD_ID else fnv1a32(card["q"])


def load_decks(flashcards_dir: Path) -> dict[str, list[dict]]:
    """{deck key: [card, …]} from one emit's per-deck chunks (the manifest and live files skipped)."""
    decks: dict[str, list[dict]] = {}
    files = sorted(p for p in Path(flashcards_dir).glob("*.json") if not p.name.startswith(("_", "live-", "carry-")))
    if not files:
        raise SystemExit(f"build_card_carry: no deck chunks in {flashcards_dir}: never read as an empty corpus")
    for f in files:
        for k, v in json.loads(f.read_text()).items():
            if k in decks:
                raise SystemExit(f"build_card_carry: deck {k!r} in two chunks of {flashcards_dir}")
            decks[k] = [c for c in (v or {}).get("cards", []) if isinstance(c, dict) and isinstance(c.get("q"), str)]
    return decks


def build(old: dict, rw: dict, now: dict) -> dict:
    counts = {"old_cards": sum(map(len, old.values())), "old_questions": len({fnv1a32(c["q"]) for v in old.values() for c in v}),
              "decks_paired": 0, "decks_not_paired": 0, "reworded_cards": 0,
              "direct": 0, "second_hop": 0, "split": 0, "collision": 0, "deck_gone": 0, "not_recovered": 0,
              "already_live": 0, "other_orphans": 0}
    now_keys = {d: {_key(c) for c in cards} for d, cards in now.items()}
    cand: list[tuple[str, str, str, str]] = []           # (deck, A, target, how)
    for d in sorted(old):
        oq, rq = old[d], rw.get(d)
        if rq is None or len(rq) != len(oq):
            counts["decks_not_paired"] += 1
            continue
        counts["decks_paired"] += 1
        old_texts = {fnv1a32(c["q"]) for c in oq}
        for i, (oc, rc) in enumerate(zip(oq, rq)):
            if oc["q"] == rc["q"]:
                continue
            counts["reworded_cards"] += 1
            a, b = fnv1a32(oc["q"]), _key(rc)
            if d not in now:
                counts["deck_gone"] += 1
                continue
            if a in now_keys[d]:
                counts["already_live"] += 1
                continue
            if b in now_keys[d]:
                t, how = b, "direct"
            else:
                nq = now[d]
                if len(nq) == len(rq) and _key(nq[i]) != b:
                    t, how = _key(nq[i]), "second_hop"
                else:
                    counts["not_recovered"] += 1
                    continue
            if t in old_texts:
                counts["collision"] += 1
                continue
            cand.append((d, a, t, how))
    # a split: one old key with more than one heir, anywhere (a shared question reworded differently per deck, or one
    # repeated in its deck): none of its entries is carried
    heirs: dict[str, set[str]] = {}
    for d, a, t, _ in cand:
        heirs.setdefault(a, set()).add(t)
    split = {a for a, ts in heirs.items() if len(ts) > 1}
    decks: dict[str, dict[str, str]] = {}
    for d, a, t, how in cand:
        if a in split:
            counts["split"] += 1
            continue
        decks.setdefault(d, {})[a] = t
        counts[how] += 1
    counts["split_questions"] = len(split)
    # the old questions no deck holds today that the rewrite did not touch (counted, not carried)
    live_now = set().union(*now_keys.values()) if now_keys else set()
    reworded_old = {fnv1a32(oc["q"]) for d in old if d in rw and len(rw[d]) == len(old[d])
                    for oc, rc in zip(old[d], rw[d]) if oc["q"] != rc["q"]}
    counts["other_orphans"] = len({fnv1a32(c["q"]) for v in old.values() for c in v} - live_now - reworded_old)
    counts["pairs"] = sum(map(len, decks.values()))
    counts["questions"] = len({a for v in decks.values() for a in v})
    counts["decks"] = len(decks)
    return {"decks": {d: "".join(a + decks[d][a] for a in sorted(decks[d])) for d in sorted(decks)}, "counts": counts}


def render(result: dict, commits: dict) -> str:
    head = {"_comment": "THE ONE-TIME CARRY (CARD1-S3, v1.304.0): per deck, the old key of each card v1.182.2 reworded and "
                        "its card's key today, 16 hex characters a pair (old 8, new 8). GENERATED by "
                        "scripts/build_card_carry.py from the three emits named in `commits`; never hand-edited. The neural "
                        "emitter checks every pair against the decks it emits and ships the kept ones as data chunks "
                        "(carry/<i>.json); neural/src/card-carry.src.js carries a record's rows once.",
            "v": 1, "commits": commits, "counts": result["counts"]}
    lines = [json.dumps(head, indent=1, sort_keys=True)[:-2] + ',\n "decks": {']
    items = list(result["decks"].items())
    for i, (d, s) in enumerate(items):
        lines.append("  " + json.dumps(d, ensure_ascii=False) + ": " + json.dumps(s) + ("," if i < len(items) - 1 else ""))
    lines.append(" }\n}\n")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--old", required=True, type=Path)
    ap.add_argument("--rw", required=True, type=Path)
    ap.add_argument("--now", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--check", action="store_true", help="fail if --out differs from what the three emits give")
    a = ap.parse_args()
    commits = {}
    for name in ("old", "rw", "now"):
        c = getattr(a, name).parent / "COMMIT"
        commits[name] = c.read_text().strip() if c.exists() else "unknown"
    result = build(load_decks(a.old), load_decks(a.rw), load_decks(a.now))
    text = render(result, commits)
    c = result["counts"]
    print(f"card carry: {c['pairs']:,} pairs ({c['questions']:,} questions) in {c['decks']:,} decks: {c['direct']:,} direct, "
          f"{c['second_hop']:,} second hop; left out: {c['split']:,} split ({c['split_questions']} questions), "
          f"{c['collision']:,} collision, {c['deck_gone']:,} deck gone, {c['not_recovered']:,} not recovered, "
          f"{c['already_live']:,} still live; {c['other_orphans']:,} old questions orphaned by other changes")
    if not c["pairs"]:
        print("card carry: FAILED: no pair found: a carry that maps nothing must not read as a pass")
        return 1
    if a.check:
        same = a.out.exists() and a.out.read_text() == text
        print("card carry: " + ("matches " if same else "DIFFERS from ") + str(a.out))
        return 0 if same else 1
    a.out.write_text(text)
    print(f"card carry: wrote {a.out} ({len(text.encode()):,} B)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
