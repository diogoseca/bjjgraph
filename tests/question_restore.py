"""CARD1 (v1.301.5; the orchestrator's ruling): the content bot never changes an EXISTING flashcard question.

A card's progress, for every player, is keyed by a hash of its exact question text, so a reworded question resets that
card for everyone (until the card key ships, CARD1 slice 2). `restore_questions` (scripts/regenerate_content_json.py), run
after the model answers and before the MC re-merge, puts every existing question back verbatim. The bot is not run here:
the function is pure, and each case below is a recorded input (a real content file, as the bot reads it) against a model
answer built from it. Run by tests/question_restore.test.mjs (in the units).
MUTANTS, each run alone against a clean 12 of 12: step 2 (the same answer) removed → 1 red ("…also moved…"; until that
case was added the position step hid it, a survivor); step 4 (a deleted card put back) removed → 1 red; the original
order not kept → 5 red.
"""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from regenerate_content_json import restore_questions  # noqa: E402

RECORD = ROOT / "content" / "Transitions" / "100% Sweep.json"


def qs(d, role):
    return [c["question"] for c in d[role]["flashcards"]]


class RestoreQuestions(unittest.TestCase):
    def setUp(self):
        self.orig = json.loads(RECORD.read_text())
        self.fixed = copy.deepcopy(self.orig)
        a = self.orig["attacker"]["flashcards"]
        self.assertGreaterEqual(len(a), 4, "premise: the recorded record has an attacker deck of four cards or more")
        self.assertGreaterEqual(len(self.orig["defender"]["flashcards"]), 2, "premise: and a defender deck")

    def test_nothing_changed_restores_nothing_and_leaves_the_record_identical(self):
        self.assertEqual(restore_questions(self.orig, self.fixed), 0)
        self.assertEqual(self.fixed, self.orig)

    def test_a_reworded_question_with_its_answer_kept_is_put_back(self):
        c = self.fixed["attacker"]["flashcards"][1]
        c["question"] = "Shorter: " + c["question"][:30] + "?"
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(qs(self.fixed, "attacker"), qs(self.orig, "attacker"))

    def test_a_corrected_answer_is_kept_its_question_untouched(self):
        c = self.fixed["attacker"]["flashcards"][2]
        c["answer"] = c["answer"] + " (Corrected.)"
        self.assertEqual(restore_questions(self.orig, self.fixed), 0)
        self.assertEqual(self.fixed["attacker"]["flashcards"][2]["answer"], c["answer"])

    def test_a_question_reworded_with_its_answer_is_put_back_whole_by_position(self):
        c = self.fixed["attacker"]["flashcards"][3]
        c["question"] = "A new way to ask this?"; c["answer"] = "A new answer that answers the new way of asking it, at length."
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        o = self.orig["attacker"]["flashcards"][3]
        self.assertEqual([self.fixed["attacker"]["flashcards"][3][k] for k in ("question", "answer")], [o["question"], o["answer"]])

    def test_reordered_cards_come_back_in_the_original_order_nothing_counted(self):
        a = self.fixed["attacker"]["flashcards"]
        a.reverse()
        self.assertEqual(restore_questions(self.orig, self.fixed), 0)
        self.assertEqual(qs(self.fixed, "attacker"), qs(self.orig, "attacker"))

    def test_a_reworded_card_that_also_moved_is_found_by_its_answer(self):
        # the deck reversed and one question reworded, its answer kept: only the answer can pair it (step 2), since the
        # card now standing at its old position is another, already matched
        a = self.fixed["attacker"]["flashcards"]
        a.reverse()
        a[0]["question"] = "Reworded and moved?"
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(self.fixed["attacker"]["flashcards"], self.orig["attacker"]["flashcards"])

    def test_a_deleted_card_is_put_back_whole_where_it_was(self):
        del self.fixed["attacker"]["flashcards"][2]
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(self.fixed["attacker"]["flashcards"], self.orig["attacker"]["flashcards"])

    def test_a_new_card_inserted_in_the_middle_passes_through_after_the_existing_cards(self):
        new = {"question": "What does a new card ask?", "answer": "It asks something no existing card asks, at some length."}
        self.fixed["attacker"]["flashcards"].insert(2, new)
        self.assertEqual(restore_questions(self.orig, self.fixed), 0)
        self.assertEqual(qs(self.fixed, "attacker"), qs(self.orig, "attacker") + [new["question"]])

    def test_a_new_card_and_a_reword_in_one_answer(self):
        new = {"question": "What does a new card ask?", "answer": "It asks something no existing card asks, at some length."}
        a = self.fixed["attacker"]["flashcards"]
        a[0]["question"] = "Reworded first question?"
        a.insert(1, new)
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(qs(self.fixed, "attacker"), qs(self.orig, "attacker") + [new["question"]])

    def test_a_question_shared_by_two_arrays_is_restored_in_each_on_its_own(self):
        shared = self.orig["attacker"]["flashcards"][0]
        self.orig["defender"]["flashcards"].append(copy.deepcopy(shared))
        self.fixed = copy.deepcopy(self.orig)
        # reworded in the defender's array only; the attacker's copy, untouched, must not satisfy it
        self.fixed["defender"]["flashcards"][-1]["question"] = "Reworded in one deck only?"
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(qs(self.fixed, "defender"), qs(self.orig, "defender"))
        self.assertEqual(qs(self.fixed, "attacker"), qs(self.orig, "attacker"))

    def test_a_whole_array_the_model_dropped_comes_back(self):
        del self.fixed["defender"]["flashcards"]
        n = len(self.orig["defender"]["flashcards"])
        self.assertEqual(restore_questions(self.orig, self.fixed), n)
        self.assertEqual(self.fixed["defender"]["flashcards"], self.orig["defender"]["flashcards"])

    def test_the_mc_fields_follow_the_restored_question(self):
        # the bot runs restore_mc right after, which finds a card's MC by its question text: with the question back, the
        # curated answer_line and distractors come back too
        from regenerate_content_json import restore_mc
        o = self.orig["attacker"]["flashcards"][1]
        o["answer_line"] = "A curated one-line answer"; o["distractors"] = [{"text": "wrong", "grade": 1}]
        self.fixed = copy.deepcopy(self.orig)
        c = self.fixed["attacker"]["flashcards"][1]
        c["question"] = "Reworded?"; c.pop("answer_line"); c.pop("distractors")
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        restore_mc(self.orig, self.fixed)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1], self.orig["attacker"]["flashcards"][1])


if __name__ == "__main__":
    unittest.main(verbosity=1)
