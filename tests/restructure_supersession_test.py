"""Owner approval survives historical apply paths; drift and absence stay explicit."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from _restructure_supersession import RestructureSupersession
from apply_calibration import apply_calibration, build_prior_blocks
import apply_occurrence_calibration as occurrence
import apply_origin_coherence as origin


class PriorAbsence(unittest.TestCase):
    def test_null_override_is_an_absent_block_but_zero_is_present(self):
        prior = build_prior_blocks({}, {"gi": 0, "nogi": None}, "Move", set(), "test")
        self.assertIsNone(prior["nogi"])
        self.assertEqual(prior["gi"]["success_rate"], 0)
        self.assertEqual(prior["gi"]["pseudo_count"], 3)

    def test_null_proposal_does_not_fall_back_to_a_number(self):
        prior = build_prior_blocks({"proposed": {"success_rate": {"gi": None, "nogi": 20}}},
                                   None, "Move", set(), "test")
        self.assertIsNone(prior["gi"])
        self.assertEqual(prior["nogi"]["success_rate"], 20)


class Supersession(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="restructure-approval-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = "content/Positions/Guard.json"
        self.move_path = "content/Transitions/Move.json"
        self.hand = [{"transition": "Move", "attempt_probability": {"gi": 100, "nogi": None}}]
        self.move = {"from_position": "Guard/Bottom", "success_rate": {"gi": 20, "nogi": None},
                     "outcomes": [{"to": "Guard/Bottom", "result": "failure",
                                   "probability": {"gi": 100, "nogi": None}}]}
        self.prior = {"gi": {"success_rate": 20, "pseudo_count": 7}, "nogi": None}
        self.ledger = {"hands": {"Guard/Bottom": {"path": self.path, "after": self.hand}},
                       "techniques": {self.move_path: {"name": "Move", "after": self.move,
                                                       "prior_after": self.prior}}}
        self.write(self.path, {"bottom": {"transitions": self.hand}})
        self.write(self.move_path, self.move)
        self.write("calibration/graph_restructure_phase2.json", self.ledger)
        self.guard = RestructureSupersession(self.root)

    def write(self, path, data):
        dest = self.root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(data))

    def test_complete_approved_table_is_verified(self):
        self.assertTrue(self.guard.hand(self.path, "bottom"))
        self.assertFalse(self.guard.hand(self.path, "top"))
        self.assertEqual(len(self.guard.checked), 1)

    def test_retired_container_cannot_be_resurrected_or_lose_its_replacement(self):
        old = "content/Positions/Retired.json"
        self.write("calibration/node_identity_retirements.json", {"records": [
            {"old_path": old, "replacement_path": self.path}]})
        guard = RestructureSupersession(self.root)
        self.assertTrue(guard.hand(old, "bottom"))
        self.write(old, {})
        with self.assertRaisesRegex(SystemExit, "retirement drift"):
            guard.hand(old, "bottom")
        (self.root / old).unlink()
        (self.root / self.path).unlink()
        with self.assertRaisesRegex(SystemExit, "retirement drift"):
            guard.hand(old, "bottom")

    def test_attempt_or_topology_drift_is_red(self):
        for hand in [[], [{"transition": "Old", "attempt_probability": {"gi": 100, "nogi": None}}],
                     [{"transition": "Move", "attempt_probability": {"gi": 100, "nogi": 0}}]]:
            with self.subTest(hand=hand):
                self.write(self.path, {"bottom": {"transitions": hand}})
                with self.assertRaisesRegex(SystemExit, "approved hand drift"):
                    self.guard.hand(self.path, "bottom")

    def test_outcome_drift_is_red(self):
        changed = copy.deepcopy(self.move)
        changed["outcomes"][0]["to"] = "Guard/Top"
        self.write(self.move_path, changed)
        with self.assertRaisesRegex(SystemExit, "approved technique drift"):
            self.guard.technique("Move")

    def test_occurrence_apply_cannot_restore_old_menu_even_in_write_mode(self):
        before = (self.root / self.path).read_bytes()
        old = {"file": self.path, "role": "bottom", "moves": [
            {"transition": "Old", "final": {"gi": 100, "nogi": 100}}]}
        with patch.object(occurrence, "ROOT", self.root):
            result = occurrence.apply_container(old, dry_run=False)
        self.assertEqual(result["status"], "superseded")
        self.assertEqual((self.root / self.path).read_bytes(), before)

    def test_origin_apply_verifies_new_table_before_bypassing_old_ballot(self):
        old = {"containers": [{"key": "guard/bottom", "file": self.path, "role": "bottom"}]}
        with patch.object(origin, "ROOT", self.root):
            self.assertEqual(origin.apply(old, write=True, check=False), 0)
            self.write(self.path, {"bottom": {"transitions": []}})
            with self.assertRaisesRegex(SystemExit, "approved hand drift"):
                origin.apply(old, write=False, check=True)

    def test_calibration_replay_preserves_prior_weight_and_community_votes(self):
        votes = {"votes": {"Move": {"community": {
            "gi": {"success_rate": 33, "vote_count": 31},
            "nogi": {"success_rate": None, "vote_count": 30}}, "prior": self.prior}}}
        before = copy.deepcopy(votes)
        proposal = {"Move": {"proposed": {"success_rate": {"gi": 60, "nogi": 60}}}}
        result = apply_calibration(votes, proposal, {}, set(), self.guard)
        self.assertEqual(result["priors_written"], 0)
        self.assertEqual(votes, before)
        votes["votes"]["Move"]["prior"]["gi"]["pseudo_count"] = 3
        with self.assertRaisesRegex(SystemExit, "approved prior drift"):
            apply_calibration(votes, proposal, {}, set(), self.guard)


if __name__ == "__main__":
    unittest.main()
