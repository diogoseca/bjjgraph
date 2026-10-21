#!/usr/bin/env python3
"""Published URLs survive an identity retirement, including old authored aliases.

The corpus guard checks every source in the recorded frozen-base inventory, so it
also works in CI's shallow checkout. The negative control deletes the DLR alias from
today's emission and requires exactly that source to fail, despite its archived
record and canonical-path redirects still being present.
"""

import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import check_identity_redirects as guard
import regenerate_identity_redirects as emitter


class ArchivedAliases(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="identity-alias-fixture-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def record(self, old, new, aliases):
        path = self.root / new
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}\n")
        return {"old_path": old, "replacement_path": new, "source": {"aliases": aliases}}

    def test_old_alias_keeps_its_published_parent_and_targets_the_live_replacement(self):
        record = self.record("content/Submissions/Old Family/Old Move.json",
                             "content/Submissions/New Family/New Move.json", ["Old Entry"])
        rules = emitter.retirement_rules([record], self.root)
        self.assertIn("/submissions/old-family/old-entry /Submissions/New-Family/New-Move 301", rules)
        self.assertIn("/Submissions/Old-Family/Old-Move/* /Submissions/New-Family/New-Move/:splat 301", rules)
        self.assertFalse(any(rule.startswith("/submissions/old-entry ") for rule in rules),
                         "a nested alias must not hijack an unrelated category-root URL")

    def test_alias_equal_to_old_canonical_source_is_emitted_once(self):
        record = self.record("content/Transitions/Old Move.json", "content/Transitions/New Move.json",
                             ["Old Move", "Old Entry", "Old Entry"])
        rules = emitter.retirement_rules([record], self.root)
        self.assertEqual(sum(rule.startswith("/transitions/old-move ") for rule in rules), 1)
        self.assertEqual(sum(rule.startswith("/transitions/old-entry ") for rule in rules), 1)

    def test_alias_collision_with_a_different_replacement_fails(self):
        first = self.record("content/Transitions/First.json", "content/Transitions/First New.json", ["Old"])
        second = self.record("content/Transitions/Second.json", "content/Transitions/Second New.json", ["Old"])
        with self.assertRaisesRegex(ValueError, "Conflicting retirement redirect"):
            emitter.retirement_rules([first, second], self.root)

    def test_shared_quartz_page_rule_handles_percent_and_punctuation(self):
        self.assertEqual(emitter.content_url("content/Transitions/100% Sweep.json"),
                         "/Transitions/100-percent-Sweep")


class PreservationGuard(unittest.TestCase):
    def test_archiving_alone_does_not_excuse_a_missing_published_url(self):
        before = guard.parse_rules("/old /Old 301\n")
        after = guard.parse_rules("/new /New 301\n")
        archived = guard.parse_rules("/old /New 301\n")
        missing, counts = guard.compare_sources(before, after, archived)
        self.assertEqual(missing, ["/old"])
        self.assertEqual(counts["missing_sources"], 1)

    def test_explicit_emitted_retirement_can_cover_a_published_descendant(self):
        before = guard.parse_rules("/Old/Bottom /Old/Bottom-page 301\n")
        after = guard.parse_rules("/Old/* /New/:splat 301\n")
        missing, counts = guard.compare_sources(before, after, after)
        self.assertEqual(missing, [])
        self.assertEqual(counts["explicit_retirement_coverage"], 1)

    def test_unrecorded_or_wrong_destination_wildcard_cannot_waive_a_lost_source(self):
        before = guard.parse_rules("/Old/Bottom /Old/Bottom-page 301\n")
        after = guard.parse_rules("/Old/* /New/:splat 301\n")
        for archived in [{}, guard.parse_rules("/Old/* /Different/:splat 301\n")]:
            with self.subTest(archived=archived):
                self.assertEqual(guard.compare_sources(before, after, archived)[0], ["/Old/Bottom"])

    def test_zero_coverage_is_not_a_pass(self):
        rules = guard.parse_rules("/old /Old 301\n")
        for before, after in [(rules, {}), ({}, rules)]:
            with self.assertRaisesRegex(ValueError, "nonempty"):
                guard.compare_sources(before, after, {})


class PublishedCorpus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        archive = json.loads((ROOT / guard.ARCHIVE_PATH).read_text())
        _, cls.before = guard.load_baseline(ROOT)
        with tempfile.TemporaryDirectory(prefix="identity-corpus-emission-") as directory:
            cls.after = guard.emit_rules(ROOT, Path(directory))
        cls.retirements = guard.parse_rules("\n".join(emitter.retirement_rules(archive["records"], ROOT)))

    def test_every_frozen_base_redirect_source_is_still_preserved(self):
        missing, counts = guard.compare_sources(self.before, self.after, self.retirements)
        self.assertEqual(counts["base_sources"], 1767,
                         "all 1,713 exact paths and 54 wildcards from the frozen base must be inspected")
        self.assertEqual(missing, [])
        print("Published source census:", json.dumps(counts, sort_keys=True))

    def test_deleting_the_actual_published_dlr_alias_is_red(self):
        source = "/transitions/dlr-inversion-to-grasshopper"
        self.assertIn(source, self.before, "the alias was actually published by the frozen base")
        self.assertEqual(self.after[source], ("/Transitions/De-La-Riva-Inversion-Entry", "301"))
        dropped = {key: value for key, value in self.after.items() if key != source}
        missing, counts = guard.compare_sources(self.before, dropped, self.retirements)
        self.assertEqual(missing, [source])
        self.assertEqual(counts["missing_sources"], 1)


if __name__ == "__main__":
    unittest.main()
