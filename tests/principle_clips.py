"""Principle sourcing preserves authored clips while adding verified Shorts."""
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_clips
import _clips
import verify_clips


def clip(video_id, vertical=False):
    return {"id": video_id, "title": video_id, "vertical": vertical}


class PrincipleSourcing(unittest.TestCase):
    def apply(self, existing, additions):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "Principle.json"
            original = {"name": "Example", "summary": "Keep authored text", "clips": existing}
            path.write_text(json.dumps(original))
            state = {"slots": {"Principles/Example.json#root": {
                "file": str(path), "category": "Principles", "role": None,
                "status": "verified", "verified_picks": additions,
            }}}
            args = SimpleNamespace(category="Principles", file=None, max_slots=None,
                                   dry_run=False, force=False)
            with patch.object(source_clips, "save_state"), patch.object(source_clips, "_apply_family_hubs"):
                source_clips.stage_apply(state, args)
            result = json.loads(path.read_text())
            self.assertEqual(result["summary"], original["summary"])
            return result["clips"]

    def test_short_is_added_before_existing_instructionals(self):
        old = [clip("lecture0001"), clip("lecture0002")]
        short = clip("short000001", True)
        self.assertEqual(self.apply(old, [short]), [short, *old])

    def test_duplicate_ids_keep_authored_metadata_and_count_once(self):
        old = [clip("lecture0001")]
        duplicate = {**old[0], "title": "Search replacement"}
        short = clip("short000001", True)
        self.assertEqual(self.apply(old, [duplicate, short, short]), [short, *old])

    def test_four_clip_cap_keeps_an_existing_longer_instructional(self):
        old = [clip("lecture0001"), clip("short000001", True), clip("short000002", True)]
        new = [clip("short000003", True), clip("short000004", True)]
        self.assertEqual(self.apply(old, new), [old[1], old[2], new[0], old[0]])

    def test_empty_search_or_failed_verification_does_not_remove_existing_clips(self):
        old = [clip("lecture0001"), clip("short000001", True)]
        self.assertEqual(self.apply(old, []), old)

    def test_empty_principle_gets_verified_candidates(self):
        additions = [clip("lecture0001"), clip("short000001", True)]
        self.assertEqual(self.apply([], additions), [additions[1], additions[0]])

    def test_principle_search_offers_channel_shorts_before_video_only_results(self):
        short = {**clip("short000001", True), "title": "Using frames", "shorts_source": True,
                 "channel": "Example", "duration": None, "view_count": None}
        lecture = {**clip("lecture0001"), "title": "Frames explained", "channel": "Example",
                   "duration": 600, "view_count": 100}
        state = {"slots": {"Principles/Frames.json#root": {
            "category": "Principles", "name": "Frames", "status": "queried",
            "file": "Frames.json", "queries": ["bjj frames shorts"],
        }}}
        args = SimpleNamespace(category="Principles", file=None, max_slots=None, sleep=0,
                               shorts_channel=None, relax_cap=None)
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(source_clips, "RESULTS_DIR", Path(tmp)), \
             patch.object(source_clips, "principle_shorts_candidates", return_value=([short], [])), \
             patch.object(source_clips, "search_youtube", return_value=[lecture]), \
             patch.object(source_clips, "save_state"):
            source_clips.stage_search(state, args)
            results = json.loads(next(Path(tmp).glob("*.json")).read_text())
        self.assertEqual([c["id"] for c in results], ["short000001", "lecture0001"])


class ShortsVerification(unittest.TestCase):
    def test_alternate_portrait_thumbnail_identifies_a_short(self):
        with patch.object(_clips, "_http_status", side_effect=[(404, None), (200, None)]):
            self.assertIs(_clips.is_short("short000001"), True)

    def test_missing_thumbnails_do_not_prove_landscape(self):
        with patch.object(_clips, "_http_status", return_value=(404, None)):
            self.assertIsNone(_clips.is_short("short000001"))

    def test_transient_thumbnail_errors_do_not_prove_landscape(self):
        with patch.object(_clips, "_http_status", return_value=(None, None)):
            self.assertIsNone(_clips.is_short("short000001"))

    def test_standalone_reverification_preserves_known_format_when_inconclusive(self):
        for vertical in (True, False):
            with self.subTest(vertical=vertical):
                data = {"clips": [{**clip("short000001", vertical), "verified": "2026-01-01"}]}
                source = str(_clips.CONTENT / "Principles" / "Fixture.json")
                with patch.object(sys, "argv", ["verify_clips.py", "--sleep", "0"]), \
                     patch.object(verify_clips, "iter_clips_arrays", return_value=[(source, data, None, data)]), \
                     patch.object(verify_clips, "verify_video", return_value={"status": "ok", "vertical": None, "channel": "Example"}), \
                     patch.object(verify_clips, "atomic_write_json"):
                    verify_clips.main()
                self.assertIs(data["clips"][0]["vertical"], vertical)

    def test_source_verification_keeps_official_shorts_tab_format(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "results.json"
            path.write_text(json.dumps([{"id": "short000001", "duration": None,
                                         "shorts_source": True, "vertical": True}]))
            state = {"slots": {"Principles/Example.json#root": {
                "category": "Principles", "status": "curated", "file": str(Path(tmp) / "source.json"),
                "role": None, "picks": [clip("short000001")],
            }}}
            args = SimpleNamespace(category="Principles", file=None, max_slots=None, dry_run=False)
            with patch.object(source_clips, "results_path", return_value=path), \
                 patch.object(source_clips, "verify_video", return_value={"status": "ok", "vertical": None, "channel": "Example"}), \
                 patch.object(source_clips, "save_state"), patch.object(source_clips.time, "sleep"):
                source_clips.stage_verify(state, args)
            selected = next(iter(state["slots"].values()))["verified_picks"]
            self.assertTrue(selected[0]["vertical"])

    def test_channel_candidates_require_real_short_urls_and_record_portrait_evidence(self):
        entries = [
            {"id": "short000001", "url": "https://www.youtube.com/shorts/short000001", "title": "Frames",
             "thumbnails": [{"width": 405, "height": 720}]},
            {"id": "lecture0001", "url": "https://www.youtube.com/watch?v=lecture0001", "title": "Frames"},
        ]
        proc = SimpleNamespace(stdout="\n".join(json.dumps(e) for e in entries), returncode=0)
        with patch.object(source_clips.subprocess, "run", return_value=proc):
            candidates, errors = source_clips.principle_shorts_candidates(["Example"])
        self.assertEqual(errors, [])
        self.assertEqual([c["id"] for c in candidates], ["short000001"])
        self.assertTrue(candidates[0]["vertical"])


if __name__ == "__main__":
    unittest.main()
