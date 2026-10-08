"""Regression for #216/#169: a transition is not its similarly named submission.

The fixture copies the three real sources; #216 removed the 7 gi / 5 nogi
incoming edge and changed the submission's 26/26 attempts to 33/31.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import audit_from_position as audit
import fix_from_position as fixer
from technique_equivalence import equivalence, technique_index


class AokiRegression(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fixbots-aoki-")
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(os.chdir, Path.cwd())
        self.root = Path(self.temp.name)
        for name in ["Positions/Aoki Lock Control.json", "Transitions/Aoki Lock.json",
                     "Submissions/Aoki Lock/from Aoki Lock Control.json"]:
            dest = self.root / "content" / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "content" / name, dest)
        os.chdir(self.root)
        self.position = Path("content/Positions/Aoki Lock Control.json")
        self.before = self.position.read_bytes()
        self.dual = {"position": "Aoki Lock Control", "role": "top",
                     "generic": "Aoki Lock", "specific": "Aoki Lock from Aoki Lock Control"}

    def test_aoki_detector_keeps_distinct_moves(self):
        refs = audit.build_position_reference_map()
        transitions, submissions = audit.build_technique_index()
        result = audit.classify_mismatches(refs, transitions, submissions)
        self.assertEqual(result["dual_references"], [])

    def test_aoki_stale_report_cannot_delete_only_incoming_reference(self):
        fixer.fix_dual_references([self.dual], dry_run=False)
        self.assertEqual(self.position.read_bytes(), self.before)
        attempts = {t["transition"]: t["attempt_probability"]
                    for t in json.loads(self.before)["top"]["transitions"]}
        self.assertEqual(attempts["Aoki Lock"], {"gi": 7, "nogi": 5})
        self.assertEqual(attempts["Aoki Lock from Aoki Lock Control"], {"gi": 26, "nogi": 26})

    def test_aoki_case_b_cannot_bypass_merger_guard(self):
        issue = {"technique": "Aoki Lock", "variant_name": self.dual["specific"],
                 "is_dual_reference": True,
                 "referenced_by": {"file": str(self.position), "role": "top"}}
        fixer.fix_case_b([issue], [self.dual], dry_run=False)
        self.assertEqual(self.position.read_bytes(), self.before)

    def test_declared_alias_merges_without_removing_a_distinct_node(self):
        move = Path("content/Transitions/Move.json")
        move.write_text(json.dumps({"name": "Move from Seat", "aliases": ["Move"],
                                   "outcomes": [{"to": "Seat/Top", "probability": 100}]}))
        seat = Path("content/Positions/Seat.json")
        seat.write_text(json.dumps({"name": "Seat", "top": {"transitions": [
            {"transition": "Move", "attempt_probability": {"gi": None, "nogi": 30}},
            {"transition": "Move from Seat", "attempt_probability": {"gi": None, "nogi": 70}}]}}))
        fixer.fix_dual_references([{"position": "Seat", "role": "top", "generic": "Move",
                                    "specific": "Move from Seat"}], dry_run=False)
        self.assertEqual(json.loads(seat.read_text())["top"]["transitions"], [
            {"transition": "Move from Seat", "attempt_probability": {"gi": None, "nogi": 100}}])
        self.assertTrue(move.exists())

    def test_declared_family_proof_rejects_separate_navigable_technique(self):
        hub = Path("content/Submissions/Move.json")
        variant = Path("content/Submissions/Move/from Seat.json")
        variant.parent.mkdir(parents=True)
        hub.write_text(json.dumps({"name": "Move", "is_family": True}))
        variant.write_text(json.dumps({"name": "Move from Seat", "from_position": "Seat/Top"}))
        self.assertIn("family", equivalence("Move", "Move from Seat"))
        hub.write_text(json.dumps({"name": "Move", "is_family": True, "outcomes": [{"to": "Other"}]}))
        self.assertIsNone(equivalence("Move", "Move from Seat"))

    def test_alias_collision_is_not_proof(self):
        Path("content/Transitions/Other.json").write_text(json.dumps(
            {"name": "Other", "aliases": ["Aoki Lock"]}))
        self.assertIsNone(technique_index()["Aoki Lock"])


class DeterministicGraphGate(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fixbots-graph-gate-")
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(os.chdir, Path.cwd())
        os.chdir(self.temp.name)
        fixer.AUDIT_PATH.parent.mkdir(parents=True)
        fixer.AUDIT_PATH.write_text(json.dumps({
            "case_a": [], "case_b_fix": [], "case_d": [], "dual_references": []}))

    def test_existing_graph_errors_remain_available_for_repair(self):
        existing = {'{"file": "existing.json", "type": "missing_outcomes"}'}
        with patch.object(fixer, 'graph_errors', side_effect=[existing, existing]) as inspect:
            with patch.object(sys, 'argv', ['fix_from_position.py']):
                fixer.main()
        self.assertEqual(inspect.call_count, 2)

    def test_new_graph_error_aborts_even_if_total_error_count_is_unchanged(self):
        for before in (set(), {'{"file": "old.json", "type": "missing_outcomes"}'}):
            after = {'{"file": "Aoki Lock.json", "type": "orphaned_transition"}'}
            with self.subTest(before=before), patch.object(fixer, 'graph_errors', side_effect=[before, after]):
                with patch.object(sys, 'argv', ['fix_from_position.py']):
                    with self.assertRaisesRegex(SystemExit, 'introduced graph errors'):
                        fixer.main()

    def test_graph_inspection_requires_a_complete_report_and_positive_coverage(self):
        error = {"severity": "error", "file": "existing.json", "type": "missing_outcomes"}
        cases = [(0, [], 2, 0, True), (1, [error], 2, 1, True),
                 (1, [], 2, 0, False), (0, [error], 2, 1, False),
                 (1, [error], 0, 1, False), (1, [error], 2, 2, False),
                 (2, [error], 2, 1, False)]
        for code, issues, coverage, count, valid in cases:
            def run(command):
                Path(command[-1]).write_text(json.dumps({
                    "issues": issues, "summary": {"errors": count, "ruleset_frames_checked": coverage}}))
                return subprocess.CompletedProcess(command, code)
            with self.subTest(code=code, coverage=coverage, count=count), patch.object(fixer.subprocess, 'run', side_effect=run):
                if valid:
                    self.assertEqual(len(fixer.graph_errors()), len(issues))
                else:
                    with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                        fixer.graph_errors()
        with patch.object(fixer.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            with self.assertRaises(FileNotFoundError):
                fixer.graph_errors()


if __name__ == "__main__":
    unittest.main(verbosity=2)
