"""Validate curation metadata before it can select a wrong role or front."""
import copy
import json
from pathlib import Path
import sys
import unittest

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from validate_json import validate_clips


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


if __name__ == "__main__":
    unittest.main()
