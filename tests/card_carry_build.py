"""CARD1-S3 (v1.304.0): THE ONE-TIME CARRY's build half. Run by tests/card_carry.test.mjs (in the units).

  1. scripts/build_card_carry.py on three fixture emits (old, the rewrite, now): a card reworded in place carries its old key
     to the card's key today, directly or by a second hop; a shared question reworded per deck carries to each deck's own heir
     (CARD1-S3-R1, F4); a split inside one deck (two heirs there), a collision (the heir was another card's old text), a deck
     gone and a card not recovered are LEFT OUT and counted; a target later reworded WITH its id (the wire's `k`) is still
     found; two runs write the same bytes.
  2. scripts/regenerate_neural_data.py `write_card_carry` on fixture decks: every pair checked against the decks emitted (a
     deck gone, a target not live, an old key live again, a malformed pair: dropped and counted); fewer than half kept is
     refused, none kept is refused; a target reworded later with its id keeps its pair; every file within its budget, each
     deck in file int(hash, 16) % n; the id deterministic; a split inside one deck refused, a heir per deck kept;
     curriculum.json carries {"id", "n"}.
  3. The committed neural/card-carry.json is well formed (decks sorted, 16 hex a pair, its counts its own).
MUTANTS, each red here: the split rule dropped (`split` never filled) -> "split"; the collision check dropped -> "collision";
the emitter's target check dropped -> "target not live"; the keep floor removed -> "refused"; the emitter's split refusal
removed -> "a split in the source".
"""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_card_carry as B  # noqa: E402
import regenerate_neural_data as N  # noqa: E402
from _neural_content import fnv1a32 as H  # noqa: E402


def emit(tmp: Path, name: str, decks: dict) -> Path:
    d = tmp / name / "flashcards"
    d.mkdir(parents=True)
    for i, (k, cards) in enumerate(sorted(decks.items())):
        (d / f"{i:08x}.json").write_text(json.dumps({k: {"cards": [c if isinstance(c, dict) else {"q": c, "a": "x"} for c in cards]}}))
    (d / "_index.json").write_text("{}")
    (d / "live-0.json").write_text("{}")
    return d


OLD = {"A|Top": ["a1?", "a2?", "a3?"], "B|Top": ["S?"], "C|Top": ["S?"], "D|Top": ["d1?"],
       "E|Top": ["x?", "y?"], "F|Top": ["p?"], "G|Top": ["g1?"], "W|Top": ["r?", "r?"]}
RW = {"A|Top": ["a1 new?", "a2?", "a3 new?"], "B|Top": ["S one?"], "C|Top": ["S two?"], "D|Top": ["d1 new?"],
      "E|Top": ["y?", "z?"], "F|Top": ["p new?"], "G|Top": ["g1 new?"], "W|Top": ["r one?", "r two?"]}
NOW = {"A|Top": ["a1 new?", "a2?", "a3 again?"], "B|Top": ["S one?"], "C|Top": ["S two?"],
       "E|Top": ["y?", "z?"], "F|Top": ["r?", "s?"],
       "G|Top": [{"q": "g1 reworded later, with its id?", "k": H("g1 new?"), "a": "x"}], "W|Top": ["r one?", "r two?"]}


class BuildCarry(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.dirs = [emit(self.tmp, n, d) for n, d in (("old", OLD), ("rw", RW), ("now", NOW))]
        self.r = B.build(*[B.load_decks(d) for d in self.dirs])

    def pairs(self, deck):
        s = self.r["decks"].get(deck, "")
        return [(s[i:i + 8], s[i + 8:i + 16]) for i in range(0, len(s), 16)]

    def test_direct_and_second_hop(self):
        self.assertEqual(self.pairs("A|Top"), sorted([(H("a1?"), H("a1 new?")), (H("a3?"), H("a3 again?"))]))
        self.assertEqual((self.r["counts"]["direct"] >= 1, self.r["counts"]["second_hop"]), (True, 1))

    def test_a_shared_question_reworded_per_deck_has_one_heir_in_each(self):
        # CARD1-S3-R1 (F4): a schedule is written per deck and a stage per deck asked, so each deck's row goes to its own heir
        self.assertEqual(self.pairs("B|Top"), [(H("S?"), H("S one?"))]); self.assertEqual(self.pairs("C|Top"), [(H("S?"), H("S two?"))])
        self.assertEqual(self.r["counts"]["cross_deck_heirs"], 1)

    def test_a_split_inside_one_deck_is_left_out_and_counted(self):
        self.assertNotIn("W|Top", self.r["decks"], "a question repeated in its deck, reworded two ways: no single heir")
        self.assertEqual((self.r["counts"]["split"], self.r["counts"]["split_questions"]), (2, 1))

    def test_a_collision_is_left_out(self):
        # x -> y: y was card 1's old text, so (E, y) rows are card 1's: left out. y -> z: y is live today (card 0's text
        # now), so (E, y) reads live already and nothing is carried for it
        self.assertNotIn("E|Top", self.r["decks"])
        self.assertEqual((self.r["counts"]["collision"], self.r["counts"]["already_live"]), (1, 1))

    def test_a_deck_gone_and_a_card_not_recovered_are_counted(self):
        self.assertNotIn("D|Top", self.r["decks"]); self.assertNotIn("F|Top", self.r["decks"])
        self.assertEqual((self.r["counts"]["deck_gone"], self.r["counts"]["not_recovered"]), (1, 1))

    def test_a_target_reworded_later_with_its_id_is_still_found(self):
        self.assertEqual(self.pairs("G|Top"), [(H("g1?"), H("g1 new?"))], "the wire's k is the card key: the pair still lands")

    def test_deterministic(self):
        again = B.build(*[B.load_decks(d) for d in self.dirs])
        self.assertEqual(B.render(again, {"old": "o"}), B.render(self.r, {"old": "o"}))
        json.loads(B.render(self.r, {"old": "o"}))


def wire(decks):
    return {k: {"cat": "Position", "role": "Top", "cards": [c if isinstance(c, dict) else {"q": c, "a": "x"} for c in cards]}
            for k, cards in decks.items()}


class EmitCarry(unittest.TestCase):
    def source(self, decks):
        p = Path(tempfile.mkdtemp()) / "card-carry.json"
        p.write_text(json.dumps({"v": 1, "decks": decks}))
        return p

    def test_every_pair_checked_against_the_wire(self):
        good = "".join(H(f"h{i}?") + H(f"h{i} new?") for i in range(4))
        src = self.source({"A|Top": H("a1?") + H("a1 new?") + H("a9?") + H("zz?") + H("a2?") + H("a1 new?"),
                           "Gone|Top": H("q?") + H("r?"),
                           "G|Top": H("g1?") + H("g1 new?"), "H|Top": good})
        out = Path(tempfile.mkdtemp())
        decks = wire({"A|Top": ["a1 new?", "a2?"], "G|Top": [{"q": "g1 reworded later?", "k": H("g1 new?"), "a": "x"}],
                      "H|Top": [f"h{i} new?" for i in range(4)]})
        r = N.write_card_carry(decks, out, src)
        kept = {}
        for f in sorted((out / "carry").glob("*.json")):
            body = json.loads(f.read_text())
            self.assertEqual((body["v"], body["id"], body["n"]), (1, r["id"], r["n"]))
            for h, s in body["d"].items():
                self.assertEqual(int(h, 16) % r["n"], body["i"], "each deck in its own file")
                kept[h] = s
        self.assertEqual(kept, {H("A|Top"): H("a1?") + H("a1 new?"), H("G|Top"): H("g1?") + H("g1 new?"), H("H|Top"): good},
                         "kept: the live target; dropped: a target not live (a9 -> zz), an old key live again (a2), a deck gone")
        self.assertEqual(N.write_card_carry(decks, Path(tempfile.mkdtemp()), src), r, "the id and file count are deterministic")
        cur = json.loads(N.curriculum_json({"belts": []}, "abcdef12", r))
        self.assertEqual(cur["cardCarry"], {"id": r["id"], "n": r["n"]})
        self.assertNotIn("cardCarry", json.loads(N.curriculum_json({"belts": []}, "abcdef12")))

    def test_refused_when_too_little_lands(self):
        src = self.source({"A|Top": H("a1?") + H("a1 new?") + H("b?") + H("nope?") + H("c?") + H("nope2?")})
        with self.assertRaises(SystemExit):
            N.write_card_carry(wire({"A|Top": ["a1 new?"]}), Path(tempfile.mkdtemp()), src)   # 1 of 3 kept: below half
        with self.assertRaises(SystemExit):
            N.write_card_carry(wire({"Other|Top": ["x?"]}), Path(tempfile.mkdtemp()), src)    # none kept
        with self.assertRaises(SystemExit):
            N.write_card_carry(wire({}), Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp()) / "missing.json")

    def test_a_split_in_the_source_is_refused_a_heir_per_deck_is_not(self):
        across = self.source({"A|Top": H("s?") + H("one?"), "B|Top": H("s?") + H("two?")})
        r = N.write_card_carry(wire({"A|Top": ["one?"], "B|Top": ["two?"]}), Path(tempfile.mkdtemp()), across)
        self.assertEqual(r["n"] >= 2, True, "one heir in each deck: kept")
        inside = self.source({"A|Top": H("s?") + H("one?") + H("s?") + H("two?")})
        with self.assertRaises(SystemExit):
            N.write_card_carry(wire({"A|Top": ["one?", "two?"]}), Path(tempfile.mkdtemp()), inside)

    def test_files_stay_in_budget(self):
        cards = [f"q{i}?" for i in range(400)]
        decks = {f"D{j}|Top": cards for j in range(40)}
        src = self.source({k: "".join(H(f"old {k} {i}?") + H(c) for i, c in enumerate(cards)) for k in decks})
        was = N.CARRY_CHUNK_BUDGET
        N.CARRY_CHUNK_BUDGET = 60_000
        try:
            out = Path(tempfile.mkdtemp())
            r = N.write_card_carry(wire(decks), out, src)
            sizes = [f.stat().st_size for f in (out / "carry").glob("*.json")]
            self.assertGreater(r["n"], 2, "more files when the pairs do not fit two")
            self.assertEqual(len(sizes), r["n"])
            self.assertLessEqual(max(sizes), 60_000)
        finally:
            N.CARRY_CHUNK_BUDGET = was


class CommittedSource(unittest.TestCase):
    def test_well_formed(self):
        src = json.loads((ROOT / "neural" / "card-carry.json").read_text())
        self.assertEqual(src["v"], 1)
        decks = src["decks"]
        self.assertEqual(list(decks), sorted(decks), "decks sorted")
        n = 0
        for d, s in decks.items():
            self.assertTrue(s and len(s) % 16 == 0 and set(s) <= set("0123456789abcdef"), d)
            olds = [s[i:i + 8] for i in range(0, len(s), 16)]
            self.assertEqual(olds, sorted(olds), d)
            n += len(olds)
        self.assertEqual(n, src["counts"]["pairs"])
        self.assertGreater(n, 9000, "premise: the v1.182.2 carry (9,553 pairs at 3947d4418)")
        self.assertEqual(set(src["commits"]), {"old", "rw", "now"})


if __name__ == "__main__":
    unittest.main(verbosity=1)
