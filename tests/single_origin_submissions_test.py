"""D-358/D-362: exact origin and role exceptions, with stale rows and mutants red."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import validate_json as validator


class SingleOriginSubmissions(unittest.TestCase):
    def setUp(self):
        self.approved = validator.load_content_exceptions()
        self.relative = "content/Submissions/Armbar/from Dead Orchard Control.json"
        self.row = self.approved[('single_origin', self.relative, None)]
        self.data = json.loads((ROOT / self.relative).read_text())
        self.schema = json.loads((ROOT / "templates/Submissions/TEMPLATE-DUAL.json").read_text())
        directory = tempfile.TemporaryDirectory(prefix="single-origin-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / self.relative
        self.path.parent.mkdir(parents=True)
        self.rows = {('single_origin', self.relative, None): self.row}
        self.write()

    def write(self):
        self.path.write_text(json.dumps(self.data))

    def blocking(self, approved=None):
        rows = self.rows if approved is None else approved
        with patch.object(validator, "ROOT", self.root), \
                patch.object(validator, "load_content_exceptions", return_value=rows):
            _, _, categories = validator.validate_json_file(self.path, self.schema, "Submissions")
        return categories["blocking"]

    def test_listed_single_origin_passes_without_changing_shared_schema(self):
        self.assertEqual(self.blocking(), [])
        self.assertEqual(self.schema["properties"]["from_positions"]["minItems"], 2)
        unchanged = json.loads((ROOT / "templates/Submissions/TEMPLATE-DUAL.json").read_text())
        self.assertEqual(unchanged["properties"]["from_positions"]["minItems"], 2)

    def test_unlisted_single_origin_is_blocking(self):
        errors = self.blocking(approved={})
        self.assertTrue(any("from_positions" in error for error in errors), errors)

    def test_listed_but_not_own_origin_is_blocking(self):
        self.data["from_positions"] = ["Closed Guard"]
        self.write()
        self.assertTrue(any("exactly one entry" in error for error in self.blocking()))

    def test_matching_list_and_changed_origin_still_requires_new_approval(self):
        self.data["from_position"] = "Closed Guard/Bottom"
        self.data["from_positions"] = ["Closed Guard"]
        self.write()
        self.assertTrue(any("approved origin" in error for error in self.blocking()))

    def test_stale_missing_file_row_is_blocking(self):
        self.path.unlink()
        errors = validator.validate_content_exceptions(self.root, self.rows)
        self.assertEqual(len(errors), 1)
        self.assertIn("stale content exception", errors[0])

    def test_stale_row_with_two_entries_is_blocking(self):
        self.data["from_positions"].append("Closed Guard")
        self.write()
        errors = validator.validate_content_exceptions(self.root, self.rows)
        self.assertEqual(len(errors), 1)
        self.assertTrue(self.blocking())

    def test_stale_row_with_empty_or_wrong_list_is_blocking(self):
        for entries in ([], ["Closed Guard"]):
            with self.subTest(entries=entries):
                self.data["from_positions"] = entries
                self.write()
                self.assertTrue(validator.validate_content_exceptions(self.root, self.rows))

    def test_other_schema_errors_are_not_waived(self):
        del self.data["name"]
        self.write()
        self.assertTrue(any("required property" in error for error in self.blocking()))

    def test_exactly_six_live_approvals_match_the_corpus(self):
        self.assertEqual(sum(r['kind']=='single_origin' for r in self.approved.values()), 6)
        self.assertEqual(validator.validate_content_exceptions(ROOT, self.approved), [])


class ShortDecisionTrees(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="short-decision-tree-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.relative = "content/Positions/Rubber Guard/Crackhead Control.json"
        self.path = self.root / self.relative
        self.path.parent.mkdir(parents=True)
        self.data = json.loads((ROOT / self.relative).read_text())
        # Fixture only: both roles begin at the shared floor, then Top is shortened.
        full = copy.deepcopy(self.data["top"]["decision_tree"])
        self.assertEqual(len(full), 3)
        self.data["bottom"]["decision_tree"] = copy.deepcopy(full)
        self.data["top"]["decision_tree"] = full[:2]
        self.schema = json.loads((ROOT / "templates/Positions/TEMPLATE-DUAL.json").read_text())
        self.row = {"kind": "short_decision_tree", "file": self.relative, "role": "top",
                    "expected_count": 2, "reason": "Fixture: approved deletions", "plan_ref": "D-362 fixture"}
        self.rows = {("short_decision_tree", self.relative, "top"): self.row}
        self.write()

    def write(self):
        self.path.write_text(json.dumps(self.data))

    def blocking(self, approved=None):
        rows = self.rows if approved is None else approved
        with patch.object(validator, "ROOT", self.root), \
                patch.object(validator, "load_content_exceptions", return_value=rows):
            _, _, categories = validator.validate_json_file(self.path, self.schema, "Positions")
        return categories["blocking"]

    def test_listed_short_tree_passes_without_lowering_shared_floor(self):
        self.assertEqual(self.blocking(), [])
        self.assertEqual(self.schema["$defs"]["decision_tree"]["minItems"], 3)
        unchanged = json.loads((ROOT / "templates/Positions/TEMPLATE-DUAL.json").read_text())
        self.assertEqual(unchanged["$defs"]["decision_tree"]["minItems"], 3)

    def test_unlisted_short_tree_is_blocking(self):
        self.assertTrue(any("top.decision_tree" in error for error in self.blocking(approved={})))

    def test_wrong_count_is_blocking_even_when_it_meets_shared_floor(self):
        self.data["top"]["decision_tree"] = copy.deepcopy(self.data["bottom"]["decision_tree"])
        self.write()
        self.assertTrue(any("exactly 2 conditions" in error for error in self.blocking()))

    def test_wrong_count_below_approved_count_is_blocking(self):
        self.data["top"]["decision_tree"] = self.data["top"]["decision_tree"][:1]
        self.write()
        self.assertTrue(any("exactly 2 conditions" in error for error in self.blocking()))

    def test_one_role_exception_does_not_waive_the_other_role(self):
        self.data["bottom"]["decision_tree"] = self.data["bottom"]["decision_tree"][:2]
        self.write()
        self.assertTrue(any("bottom.decision_tree" in error for error in self.blocking()))

    def test_stale_missing_file_row_is_blocking(self):
        self.path.unlink()
        errors = validator.validate_content_exceptions(self.root, self.rows)
        self.assertEqual(len(errors), 1)
        self.assertIn("stale content exception", errors[0])

    def test_stale_missing_role_and_restored_full_tree_rows_are_blocking(self):
        for change in ("missing", "full"):
            with self.subTest(change=change):
                if change == "missing":
                    self.data.pop("top")
                else:
                    self.data["top"] = {"decision_tree": self.data["bottom"]["decision_tree"]}
                self.write()
                self.assertTrue(validator.validate_content_exceptions(self.root, self.rows))

    def test_real_bottom_row_is_live_and_top_row_is_not_installed(self):
        rows = validator.load_content_exceptions()
        short = [r for r in rows.values() if r["kind"] == "short_decision_tree"]
        self.assertEqual([(r["file"], r["role"], r["expected_count"]) for r in short],
                         [(self.relative, "bottom", 2)])
        self.assertEqual(validator.validate_content_exceptions(ROOT, rows), [])


if __name__ == "__main__":
    if "--mutate-accept-rule" in sys.argv:
        sys.argv.remove("--mutate-accept-rule")
        with patch.object(validator, "accept_content_exception", return_value=True):
            unittest.main()
    else:
        unittest.main()
