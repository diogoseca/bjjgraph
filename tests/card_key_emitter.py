"""CARD1-S2 (v1.303.0): THE EMITTER KEYS A WIRE CARD BY ITS CARD KEY. Run by tests/card_key.test.mjs (in the units).

A content card may carry `id` (8 hex): the key of the text it replaced when its question was reworded. graph.json carries
it (`_qa_full`), the neural emitter writes it to the wire as `k` ONLY when it differs from its question's hash
(`_qa_cards`), and files the card by `_card_key` (`k`, else the hash) in the manifest's shared index and the live files.
With no id anywhere the wire is byte-identical to v1.301.5's: proven on the whole corpus in the PR (every one of the 4,976
emitted files), and here on fixtures.
MUTANTS, each red here: `k` written on every card with an id (even its own hash) → "k only when it differs"; the shared
index by the text again → "keeps its place"; the live files by the text's hash → "the live files"; the census's refusal
removed → "refused".
"""
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import regenerate_graph as G  # noqa: E402
import regenerate_neural_data as N  # noqa: E402
from _neural_content import fnv1a32  # noqa: E402

OLD = "What does the bottom player's near hand frame against first, before the hip escape?"
NEW = "Which frame comes first before the hip escape?"
ANSWER = "The near hand frames the far hip, so the hip escape has room."


def deck(*cards):
    return {"cat": "Position", "role": "Bottom", "cards": list(cards)}


class CardKeyEmitter(unittest.TestCase):
    def test_graph_json_carries_the_id_only_when_authored(self):
        self.assertEqual(G._qa_full({"question": NEW, "answer": ANSWER, "id": fnv1a32(OLD)})["id"], fnv1a32(OLD))
        self.assertNotIn("id", G._qa_full({"question": NEW, "answer": ANSWER}))
        self.assertEqual(G._submission_qa({"question": NEW, "answer": ANSWER, "id": fnv1a32(OLD)}, "x/attacker")["id"], fnv1a32(OLD))

    def test_k_only_when_it_differs_from_the_question_hash(self):
        kept, own, plain = N._qa_cards([
            {"question": NEW, "answer": ANSWER, "id": fnv1a32(OLD)},       # reworded: the key of the text it replaced
            {"question": OLD, "answer": ANSWER, "id": fnv1a32(OLD)},       # an id equal to its own hash: nothing to say
            {"question": OLD, "answer": ANSWER},
        ])
        self.assertEqual(kept["k"], fnv1a32(OLD))
        self.assertEqual(list(kept), ["q", "k", "a"], "k sits after q")
        self.assertNotIn("k", own)
        self.assertEqual(own, plain, "a card whose id is its own hash emits as a card with none")
        self.assertEqual([N._card_key(c) for c in (kept, own, plain)], [fnv1a32(OLD)] * 3)

    def test_a_malformed_id_is_refused(self):
        for bad in ("XYZ", "0BADC0DE", "0badc0d", 12345678):
            with self.assertRaises(SystemExit, msg=repr(bad)):
                N._qa_cards([{"question": NEW, "answer": ANSWER, "id": bad}])

    def test_the_reworded_copy_keeps_its_place_in_the_shared_group(self):
        old = {"q": OLD, "a": ANSWER}
        new = {"q": NEW, "k": fnv1a32(OLD), "a": ANSWER}
        decks = {"A|Bottom": deck(old), "B|Bottom": deck(dict(new))}
        self.assertEqual(N._shared_index(decks), {fnv1a32(OLD): [0, 1]}, "one card under two wordings: still shared")
        # without its key, the reworded copy leaves the group (today's behaviour, the reason for the id)
        bare = {"A|Bottom": deck(old), "B|Bottom": deck({"q": NEW, "a": ANSWER})}
        self.assertEqual(N._shared_index(bare), {})
        # with no `k` anywhere, today's rule to the letter: a text in two decks, and one repeated inside one deck
        plain = {"A|Bottom": deck(old, {"q": "Other?", "a": ANSWER}), "B|Bottom": deck(dict(old)),
                 "C|Bottom": deck({"q": "Twice?", "a": ANSWER}, {"q": "Twice?", "a": ANSWER})}
        self.assertEqual(N._shared_index(plain), {fnv1a32(OLD): [0, 1], fnv1a32("Twice?"): [2]})

    def test_the_live_files_carry_the_card_key(self):
        decks = {"A|Bottom": deck({"q": NEW, "k": fnv1a32(OLD), "a": ANSWER}, {"q": "Other?", "a": ANSWER})}
        live = N._live_question_bodies(decks, set())
        import base64
        body = json.loads(live["bodies"][0])
        raw = base64.b64decode(body["q"])
        vals = [int.from_bytes(raw[i:i + 2], "little") for i in range(0, len(raw), 2)]
        self.assertEqual(vals, [int(fnv1a32(OLD), 16) & 0xFFFF, int(fnv1a32("Other?"), 16) & 0xFFFF])

    def test_a_key_two_questions_share_in_one_deck_is_refused(self):
        old = {"q": OLD, "a": ANSWER}
        new = {"q": NEW, "k": fnv1a32(OLD), "a": ANSWER}
        with self.assertRaises(SystemExit):
            N._card_key_census({"A|Bottom": deck(old, new)})            # an id equal to another live card's hash
        with self.assertRaises(SystemExit):
            N._card_key_census({"A|Bottom": deck(new, {"q": "Third?", "k": fnv1a32(OLD), "a": ANSWER})})   # a duplicate id
        r = N._card_key_census({"A|Bottom": deck(new), "B|Bottom": deck(old)})   # across decks: one card, shared
        self.assertEqual((r["cards"], r["keyed"]), (2, 1))
        r = N._card_key_census({"A|Bottom": deck(old, dict(old))})      # a question repeated in its deck: as before
        self.assertEqual(r["hashed"], 0)
        with self.assertRaises(SystemExit):
            N._card_key_census({})                                       # saw nothing: never a pass


if __name__ == "__main__":
    unittest.main(verbosity=1)
