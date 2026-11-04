"""Validate curation metadata before it can select a wrong role or front."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from validate_json import validate_clips, validate_escape_clip_rows


def clip(video_id="aaaaaaaaaaa", **fields):
    return {"id": video_id, "title": "Position overview", **fields}


class ClipDataContract(unittest.TestCase):
    def test_schemas_accept_old_clips_and_optional_front_duration(self):
        schemas = [path for path in (ROOT / "templates").rglob("*.json")
                   if "clip" in json.loads(path.read_text()).get("$defs", {})]
        self.assertEqual(len(schemas), 7)
        for path in schemas:
            with self.subTest(schema=str(path.relative_to(ROOT))):
                schema = json.loads(path.read_text())["$defs"]["clip"]
                jsonschema.validate(clip(), schema)
                jsonschema.validate(clip(front=True, duration=312), schema)
                jsonschema.validate(clip(front=False), schema)
                for invalid in (clip(front="true"), clip(duration=0)):
                    with self.assertRaises(jsonschema.ValidationError):
                        jsonschema.validate(invalid, schema)
                if path.parent.name == "Positions":
                    for half in ("top", "bottom", "both"):
                        jsonschema.validate(clip(half=half), schema)
                    with self.assertRaises(jsonschema.ValidationError):
                        jsonschema.validate(clip(half="neither"), schema)
                else:
                    with self.assertRaises(jsonschema.ValidationError):
                        jsonschema.validate(clip(half="top"), schema)

    def test_front_is_optional_and_each_half_has_its_own_selection(self):
        for category, roles in (("Positions", ("top", "bottom")),
                                ("Transitions", ("attacker", "defender")),
                                ("Submissions", ("attacker", "defender"))):
            with self.subTest(category=category):
                data = {role: {"clips": [clip(front=True), clip("bbbbbbbbbbb")]}
                        for role in roles}
                before = copy.deepcopy(data)
                self.assertEqual(validate_clips(data, category)[0], [])
                self.assertEqual(data, before)
                self.assertEqual(validate_clips({roles[0]: {"clips": [clip()]}}, category)[0], [])
                self.assertEqual(validate_clips({}, category), ([], []))

    def test_two_fronts_or_a_later_front_fail_in_each_role(self):
        for role in ("top", "bottom", "attacker", "defender"):
            for clips, message in (([clip(front=True), clip("bbbbbbbbbbb", front=True)],
                                    "at most one"),
                                   ([clip(), clip("bbbbbbbbbbb", front=True)],
                                    "must be first")):
                with self.subTest(role=role, message=message):
                    errors, _ = validate_clips({role: {"clips": clips}}, "Positions")
                    self.assertTrue(any(message in error for error in errors), errors)

    def test_half_tags_belong_only_to_position_hubs(self):
        for half in ("top", "bottom", "both"):
            self.assertEqual(validate_clips({"clips": [clip(half=half)]}, "Positions")[0], [])
        for category in ("Positions", "Transitions", "Submissions", "Principles"):
            locations = ("top", "bottom", "attacker", "defender")
            for role in locations:
                with self.subTest(category=category, role=role):
                    errors, _ = validate_clips({role: {"clips": [clip(half="top")]}}, category)
                    self.assertTrue(any("only on position hub" in error for error in errors), errors)
            if category != "Positions":
                errors, _ = validate_clips({"clips": [clip(half="both")]}, category)
                self.assertTrue(any("only on position hub" in error for error in errors), errors)

    def test_clip_timing_checks_still_apply_with_curation_metadata(self):
        errors, _ = validate_clips({"top": {"clips": [clip(front=True, start=40, end=30)]}}, "Positions")
        self.assertTrue(any("must be < end" in error for error in errors), errors)
        errors, warnings = validate_clips({"clips": [clip(half="both", end=50, duration=40)]}, "Positions")
        self.assertEqual(errors, [])
        self.assertTrue(any("exceeds video duration" in warning for warning in warnings), warnings)


class EscapeClipContract(unittest.TestCase):
    """v1.246.0: an escape card shows a clip of THAT escape or nothing (owner, ESC1).

    `defender.escape_clips` joins on the printed card label. Every test here guards a way that
    join could fail quietly: an orphan row, a paid rewrite, a rot check that skips the rows, or
    a corpus walk that finds nothing and calls it clean.
    """
    SOURCE = ROOT / "content/Submissions/Americana/from Side Control.json"

    def record(self, *rows):
        data = json.loads(self.SOURCE.read_text(encoding="utf-8"))
        if rows:
            data["defender"]["escape_clips"] = list(rows)
        return data

    def label(self):
        from _clips import escape_labels
        return escape_labels(self.record())[0]

    def test_a_row_fits_the_defender_schema_of_a_submission_only(self):
        schema = json.loads((ROOT / "templates/Submissions/TEMPLATE-DUAL.json").read_text())
        rows = dict(schema["properties"]["defender"]["properties"]["escape_clips"], **{"$defs": schema["$defs"]})
        jsonschema.validate([{"escape": "Roll", "clips": [clip(front=True, start=30)]}], rows)
        for invalid in ([{"clips": [clip()]}], [{"escape": "", "clips": [clip()]}],
                        [{"escape": "Roll"}], [{"escape": "Roll", "clips": [], "note": "x"}]):
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.validate(invalid, rows)
        transitions = json.loads((ROOT / "templates/Transitions/TEMPLATE-DUAL.json").read_text())
        self.assertNotIn("escape_clips", transitions["properties"]["defender"]["properties"])
        self.assertIs(transitions["properties"]["defender"]["additionalProperties"], False)

    def test_a_real_label_joins_and_an_orphan_names_itself(self):
        self.assertEqual(validate_escape_clip_rows(self.record({"escape": self.label(), "clips": [clip(front=True)]})), [])
        errors = validate_escape_clip_rows(self.record({"escape": "No such card", "clips": [clip(front=True)]}))
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("No such card", errors[0])
        self.assertEqual(validate_escape_clip_rows(self.record()), [])

    def test_two_rows_for_one_card_fail(self):
        row = {"escape": self.label(), "clips": [clip(front=True)]}
        self.assertTrue(any("two rows" in e for e in validate_escape_clip_rows(self.record(row, dict(row)))))

    def test_the_front_rules_reach_a_row(self):
        bad = [clip(front=True), clip("bbbbbbbbbbb", front=True)]
        errors, _ = validate_clips(self.record({"escape": self.label(), "clips": bad}), "Submissions")
        self.assertTrue(any("escape_clips" in e and "at most one" in e for e in errors), errors)

    def test_the_two_override_submissions_join_with_no_defensive_option(self):
        from _clips import escape_labels
        labels = escape_labels({"name": "Triangle Choke from Triangle Control"})
        self.assertIn("Posture up", labels)
        data = {"name": "Triangle Choke from Triangle Control",
                "defender": {"escape_clips": [{"escape": "Posture up", "clips": [clip(front=True)]}]}}
        self.assertEqual(validate_escape_clip_rows(data), [])

    def test_the_paid_pass_never_sees_it_and_cannot_lose_it(self):
        sys.path.insert(0, str(ROOT))
        import scripts.regenerate_content_json as regen
        schema = regen.build_response_schema("Submissions", "DUAL")["properties"]["fixed_content"]
        defender = schema["properties"]["defender"]["properties"]
        self.assertNotIn("escape_clips", defender)
        self.assertIn("recognition_cues", defender)  # the walk reached the real block
        original = self.record({"escape": self.label(), "clips": [clip(front=True)]})
        for lost in (lambda d: d["defender"].pop("escape_clips"),
                     lambda d: d["defender"]["escape_clips"][0]["clips"].clear()):
            fixed = copy.deepcopy(original)
            lost(fixed)
            self.assertTrue(any("escape_clips" in e for e in regen.check_structural_preservation(original, fixed, "Submissions")))
            self.assertGreaterEqual(regen.restore_clips(original, fixed), 1)
            self.assertEqual(fixed["defender"]["escape_clips"], original["defender"]["escape_clips"])
        invented = self.record()
        fixed = copy.deepcopy(invented)
        fixed["defender"]["escape_clips"] = [{"escape": "x", "clips": [clip()]}]
        regen.restore_clips(invented, fixed)
        self.assertNotIn("escape_clips", fixed["defender"])

    def test_a_reworded_action_fails_preservation_by_name(self):
        sys.path.insert(0, str(ROOT))
        import scripts.regenerate_content_json as regen
        label = self.label()
        original = self.record({"escape": label, "clips": [clip(front=True)]})
        self.assertEqual([e for e in regen.check_structural_preservation(original, copy.deepcopy(original), "Submissions")
                          if "card" in e], [])
        fixed = copy.deepcopy(original)
        for option in fixed["defender"]["defensive_options"]:
            option["action"] = "Reworded " + option["action"]
        errors = regen.check_structural_preservation(original, fixed, "Submissions")
        self.assertTrue(any(label in e and "reworded" in e for e in errors), errors)

    def test_the_rot_check_sees_every_row_and_a_pruned_row_goes(self):
        import _clips
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / "Submissions"
            home.mkdir()
            data = self.record({"escape": self.label(), "clips": [clip("ccccccccccc", front=True)]})
            data["defender"]["clips"] = [clip("ddddddddddd", front=True)]
            (home / "x.json").write_text(json.dumps(data))
            with patch.object(_clips, "CONTENT", Path(tmp)):
                found = [c["id"] for _, _, _, h in _clips.iter_clips_arrays("Submissions") for c in h["clips"]]
        self.assertIn("ccccccccccc", found)
        self.assertIn("ddddddddddd", found)
        data["defender"]["escape_clips"][0].pop("clips")
        _clips.drop_empty_escape_rows(data)
        self.assertNotIn("escape_clips", data["defender"])

    def test_the_dossier_carries_player_fields_only(self):
        from _neural_content import _perspective_defender
        row = clip(front=True, start=30, channel="Someone", verified="2026-11-04", duration=90)
        out = _perspective_defender({"escape_clips": [{"escape": "Roll", "clips": [row]}, {"escape": "Empty", "clips": []}]})
        self.assertEqual(list(out["escapes"]), ["Roll"])
        self.assertEqual(out["escapes"]["Roll"][0]["start"], 30)
        self.assertNotIn("channel", out["escapes"]["Roll"][0])
        self.assertNotIn("verified", out["escapes"]["Roll"][0])
        self.assertNotIn("escapes", _perspective_defender({}))

    def test_the_corpus_validator_prints_the_join_and_refuses_zero(self):
        import contextlib, io
        from validate_json import report_escape_clip_join
        home = ROOT / "content/Submissions"
        files = sorted(home.rglob("*.json"))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(report_escape_clip_join(files), 0)
        self.assertRegex(out.getvalue(), r"escape clips: [1-9]\d* rows joined to a card, 0 orphaned")
        bare = [f for f in files if '"escape_clips"' not in f.read_text(encoding="utf-8")]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(report_escape_clip_join(bare), 1)
        self.assertIn("escape clips: 0 rows joined", out.getvalue())
        self.assertIn("never ran", out.getvalue())

    def test_a_direct_bot_edit_cannot_delete_or_orphan_a_row(self):
        import restore_curated_clips as guard
        label = self.label()
        original = self.record({"escape": label, "clips": [clip(front=True)]})
        text = json.dumps(original)
        with tempfile.TemporaryDirectory() as tmp, patch.object(guard, "ROOT", Path(tmp)):
            target = Path(tmp) / "x.json"
            deleted = copy.deepcopy(original)
            del deleted["defender"]["escape_clips"]
            target.write_text(json.dumps(deleted))
            self.assertEqual(guard.guard("x.json", text), (1, False))
            self.assertEqual(json.loads(target.read_text())["defender"]["escape_clips"],
                             original["defender"]["escape_clips"])
            reworded = copy.deepcopy(original)
            for option in reworded["defender"]["defensive_options"]:
                option["action"] = "Reworded " + option["action"]
            target.write_text(json.dumps(reworded))
            self.assertTrue(guard.guard("x.json", text)[1], "a reword that orphans a row must revert")
            target.write_text("{ broken")
            self.assertTrue(guard.guard("x.json", text)[1], "an unparsable edit must revert")
            target.write_text(text)
            self.assertEqual(guard.guard("x.json", text), (0, False))

    def test_every_direct_edit_bot_runs_the_guard_before_it_validates(self):
        for name in ("content-improvement-bot", "analytics-content-improvement", "proofread-bot"):
            flow = (ROOT / ".github/workflows" / (name + ".yml")).read_text(encoding="utf-8")
            with self.subTest(workflow=name):
                self.assertIn("python3 scripts/restore_curated_clips.py", flow)
                guard = flow.index("restore_curated_clips.py")
                self.assertLess(guard, flow.rindex("validate_json.py --file \"$"))
                if "id: improve_content" in flow:
                    self.assertLess(flow.index("id: improve_content"), guard)

    def test_the_real_corpus_joins_at_least_one_row_and_orphans_none(self):
        from _clips import escape_clip_join, escape_rows
        joined, orphans = 0, []
        for path in (ROOT / "content/Submissions").rglob("*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            if escape_rows(data):
                good, bad = escape_clip_join(data)
                joined += len(good)
                orphans += [(path.name, row["escape"]) for row in bad]
        self.assertEqual(orphans, [])
        self.assertGreater(joined, 0, "a walk that joins nothing is a check that never ran")


if __name__ == "__main__":
    unittest.main()
