"""D-358: six precise exceptions, with stale approvals and blanket acceptance red."""
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
        self.approved = validator.load_single_origin_submissions()
        self.relative = "content/Submissions/Armbar/from Dead Orchard Control.json"
        self.row = self.approved[self.relative]
        self.data = json.loads((ROOT / self.relative).read_text())
        self.schema = json.loads((ROOT / "templates/Submissions/TEMPLATE-DUAL.json").read_text())
        directory = tempfile.TemporaryDirectory(prefix="single-origin-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / self.relative
        self.path.parent.mkdir(parents=True)
        self.rows = {self.relative: self.row}
        self.write()

    def write(self):
        self.path.write_text(json.dumps(self.data))

    def blocking(self, approved=None):
        rows = self.rows if approved is None else approved
        with patch.object(validator, "ROOT", self.root), \
                patch.object(validator, "load_single_origin_submissions", return_value=rows):
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
        errors = validator.validate_single_origin_approvals(self.root, self.rows)
        self.assertEqual(len(errors), 1)
        self.assertIn("stale single-origin approval", errors[0])

    def test_stale_row_with_two_entries_is_blocking(self):
        self.data["from_positions"].append("Closed Guard")
        self.write()
        errors = validator.validate_single_origin_approvals(self.root, self.rows)
        self.assertEqual(len(errors), 1)
        self.assertTrue(self.blocking())

    def test_stale_row_with_empty_or_wrong_list_is_blocking(self):
        for entries in ([], ["Closed Guard"]):
            with self.subTest(entries=entries):
                self.data["from_positions"] = entries
                self.write()
                self.assertTrue(validator.validate_single_origin_approvals(self.root, self.rows))

    def test_other_schema_errors_are_not_waived(self):
        del self.data["name"]
        self.write()
        self.assertTrue(any("required property" in error for error in self.blocking()))

    def test_exactly_six_live_approvals_match_the_corpus(self):
        self.assertEqual(len(self.approved), 6)
        self.assertEqual(validator.validate_single_origin_approvals(ROOT, self.approved), [])


if __name__ == "__main__":
    if "--mutate-accept-rule" in sys.argv:
        sys.argv.remove("--mutate-accept-rule")
        with patch.object(validator, "accept_single_origin", return_value=True):
            unittest.main()
    else:
        unittest.main()
