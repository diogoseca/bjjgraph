"""CARD1 (v1.301.5; the orchestrator's ruling): the content bot never changes an EXISTING flashcard question.

A card's progress, for every player, is keyed by a hash of its exact question text, so a reworded question resets that
card for everyone (until the card key ships, CARD1 slice 2). `restore_questions` (scripts/regenerate_content_json.py), run
after the model answers and before the MC re-merge, puts every existing question back verbatim. The bot is not run here:
the function is pure, and each case below is a recorded input (a real content file, as the bot reads it) against a model
answer built from it. Run by tests/question_restore.test.mjs (in the units).
MUTANTS, each run alone against a clean 12 of 12: step 2 (the same answer) removed → 1 red ("…also moved…"; until that
case was added the position step hid it, a survivor); step 4 (a deleted card put back) removed → 1 red; the original
order not kept → 5 red.
IDS (CARD1-S2, v1.303.0; the last six cases): a card's `id` is its key (scripts/_card_key.py), never the model's to write:
an existing card leaves with its original's id (put back if dropped or changed, removed if invented), a new card with none;
`keep_rewords` (off in the bot, `BOT_KEEPS_REWORDS`) keeps a reword found by its answer and writes the old text's key.
Mutants: `_carry_id` not called at step 1 → "dropped"/"changed"/"invented" red; the new cards' ids kept → "a new card";
the kept reword not given its key → "keep_rewords".
CARD1-S2-R1 (the next five): an id in a NEW, an EMPTY or a NESTED array is removed too; an original's id survives that
last strip; the schema the model is shown declares no card id. Mutants: the last strip removed → "new array", "empty
array", "nested" red; a card put back whole left out of `carried` → "survives"; `_CARD_ID_SHOWN` not applied → "shown".
"""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from regenerate_content_json import BOT_KEEPS_REWORDS, restore_questions  # noqa: E402
from _neural_content import fnv1a32  # noqa: E402

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

    # ── IDS (CARD1-S2) ──
    def with_id(self):
        """the record as it stands once a card was reworded with its key: attacker card 1 carries an id"""
        o = self.orig["attacker"]["flashcards"][1]
        o["id"] = fnv1a32(o["question"]); o["question"] = "Reworded once, keeping its key?"
        self.fixed = copy.deepcopy(self.orig)
        return o

    def test_an_id_the_model_dropped_comes_back(self):
        o = self.with_id()
        del self.fixed["attacker"]["flashcards"][1]["id"]
        self.assertEqual(restore_questions(self.orig, self.fixed), 0)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1]["id"], o["id"])

    def test_an_id_the_model_changed_is_put_back(self):
        o = self.with_id()
        self.fixed["attacker"]["flashcards"][1]["id"] = "0badc0de"
        restore_questions(self.orig, self.fixed)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1]["id"], o["id"])

    def test_an_id_the_model_invented_on_an_existing_card_is_removed(self):
        self.fixed["attacker"]["flashcards"][2]["id"] = "0badc0de"
        restore_questions(self.orig, self.fixed)
        self.assertEqual(self.fixed, self.orig)

    def test_a_new_card_carries_no_id(self):
        new = {"question": "What does a new card ask?", "answer": "It asks something no card asks.", "id": "0badc0de"}
        self.fixed["attacker"]["flashcards"].append(new)
        restore_questions(self.orig, self.fixed)
        self.assertNotIn("id", self.fixed["attacker"]["flashcards"][-1])

    def test_a_restored_reword_keeps_the_cards_id(self):
        o = self.with_id()
        c = self.fixed["attacker"]["flashcards"][1]
        c["question"] = "Reworded again by the model?"; del c["id"]
        self.assertEqual(restore_questions(self.orig, self.fixed), 1)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1], o)

    def test_keep_rewords_keeps_the_models_question_under_the_old_key(self):
        self.assertIs(BOT_KEEPS_REWORDS, False, "the bot restores every reword until the orchestrator says otherwise")
        old = self.orig["attacker"]["flashcards"][2]["question"]
        c = self.fixed["attacker"]["flashcards"][2]
        c["question"] = "Shorter, kept: what does it ask?"
        p = self.fixed["attacker"]["flashcards"][3]
        p["question"] = "A new way to ask?"; p["answer"] = "A new answer, at length, for the new way."
        self.assertEqual(restore_questions(self.orig, self.fixed, keep_rewords=True), 2)
        got = self.fixed["attacker"]["flashcards"]
        self.assertEqual((got[2]["question"], got[2]["id"]), ("Shorter, kept: what does it ask?", fnv1a32(old)))
        self.assertEqual(got[3], self.orig["attacker"]["flashcards"][3], "a reword found only by its place is restored either way")

    # CARD1-S2-R1 (the PR #469 read, F1): the walk pairs only the ORIGINAL's non-empty arrays, so an id the model wrote in an
    # array the original lacks, or held empty, survived it; the bot's PRs run no ci-validate, and the gate passes such a
    # card as "a new card with an id of its own". Every card no original accounts for leaves with no id, in any array.
    NEW_ID = {"question": "What does a new card in a new place ask?", "answer": "Something no card asks yet.", "id": "feedface"}

    def test_an_id_in_a_new_array_is_removed(self):
        self.fixed["attacker"]["flashcards_position"] = [dict(self.NEW_ID)]        # a role-level array the original lacks
        self.fixed["flashcards"] = [dict(self.NEW_ID, id="cafebabe")]              # and one at the root
        restore_questions(self.orig, self.fixed)
        self.assertNotIn("id", self.fixed["attacker"]["flashcards_position"][0])
        self.assertNotIn("id", self.fixed["flashcards"][0])
        self.assertEqual(self.fixed["attacker"]["flashcards"], self.orig["attacker"]["flashcards"], "the existing deck untouched")

    def test_an_id_in_an_empty_array_is_removed(self):
        self.orig["defender"]["flashcards"] = []
        self.fixed = copy.deepcopy(self.orig)
        self.fixed["defender"]["flashcards"].append(dict(self.NEW_ID))
        restore_questions(self.orig, self.fixed)
        self.assertEqual(self.fixed["defender"]["flashcards"], [{k: v for k, v in self.NEW_ID.items() if k != "id"}])

    def test_an_id_in_a_nested_new_array_is_removed(self):
        self.fixed["attacker"]["tiers"] = [{"name": "Advanced", "flashcards": [dict(self.NEW_ID)]}]
        restore_questions(self.orig, self.fixed)
        self.assertNotIn("id", self.fixed["attacker"]["tiers"][0]["flashcards"][0])

    def test_an_originals_id_survives_the_last_strip_put_back_whole(self):
        o = self.with_id()
        del self.fixed["attacker"]["flashcards"][1]                              # a card deleted: put back whole (step 4)
        restore_questions(self.orig, self.fixed)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1], o)
        self.fixed = copy.deepcopy(self.orig)
        del self.fixed["attacker"]["flashcards"]                                 # the whole array dropped: put back whole
        restore_questions(self.orig, self.fixed)
        self.assertEqual(self.fixed["attacker"]["flashcards"][1], o)

    def test_the_schema_the_model_is_shown_has_no_card_id(self):
        import os
        import re
        import regenerate_content_json as R
        here = os.getcwd()
        os.chdir(ROOT)                                                           # the loader reads templates/ relative
        try:
            removed = 0
            for cat, t in (("Positions", "SINGLE"), ("Positions", "DUAL"), ("Positions", "FAMILY"), ("Transitions", "SINGLE"),
                           ("Transitions", "DUAL"), ("Submissions", "SINGLE"), ("Submissions", "DUAL"),
                           ("Submissions", "FAMILY"), ("Principles", None), ("Systems", None), ("Learning", None)):
                raw = R.get_template_path(cat, t).read_text()
                shown = R.get_template_content(cat, t)
                json.loads(shown)                                                # still a schema
                declared = raw.count('"pattern": "^[0-9a-f]{8}$"')
                self.assertNotIn("^[0-9a-f]{8}$", shown, f"{cat}/{t}: the card id is still shown")
                self.assertEqual(shown.count('"id"'), raw.count('"id"') - declared, f"{cat}/{t}: only the card id goes")
                removed += declared
            self.assertEqual(removed, 13, "every card-id property the nine schemas declare was found and hidden")
        finally:
            os.chdir(here)


if __name__ == "__main__":
    unittest.main(verbosity=1)
