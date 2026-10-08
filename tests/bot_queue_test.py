"""Offline queue/API, reservation, selection and action-result contracts. No paid calls."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import bot_queue as queue
import bot_run


def pr(number, branch="human/change", bot=False):
    return {"number": number, "head": {"ref": branch}, "labels": [],
            "user": {"type": "Bot" if bot else "User"}}


class QueueTests(unittest.TestCase):
    def test_empty_queue_is_a_successful_positive_lookup(self):
        output = io.StringIO()
        with contextlib.redirect_stderr(output):
            state = queue.snapshot("owner/repo", "proofread-bot", lambda _: [])
        self.assertEqual(state["requests_checked"], 1)
        self.assertEqual(state["own_prs"], [])
        self.assertIn("1 successful API requests", output.getvalue())
        self.assertIn("no own open PR", output.getvalue())

    def test_all_five_bots_recognized_across_categories_and_bases(self):
        for bot, prefix in queue.BOT_BRANCHES.items():
            with self.subTest(bot=bot):
                calls = []
                def get(url):
                    calls.append(url)
                    if "state=open" in url:
                        return [pr(23, prefix + "old-category-or-date")]
                    if "/files?" in url:
                        return [{"filename": "content/Positions/Mount.json"}]
                    return {"changed_files": 1}
                state = queue.snapshot("owner/repo", bot, get)
                self.assertEqual(state["own_prs"], [23])
                self.assertEqual(queue.filter_candidates(["content/unrelated.json"], state), [])
                self.assertFalse(any("base=" in url for url in calls))

    def test_paginated_prs_and_files_reserve_renames_and_generated_owners(self):
        def get(url):
            if "state=open" in url:
                return [pr(i) for i in range(100)] if url.endswith("&page=1") else [pr(101, "validation-fixer/date")]
            if "/files?" in url:
                if url.endswith("&page=1"):
                    return [{"filename": f"content/F{i}.json"} for i in range(100)]
                return [{"filename": "content/Positions/New Name/Top.md",
                         "previous_filename": "source/content/Positions/Old Name.md"}]
            return {"changed_files": 101}
        state = queue.snapshot("owner/repo", "proofread-bot", get)
        self.assertEqual(state["requests_checked"], 5)
        paths = ["content/Positions/New Name.json", "content/Positions/Old Name.json", "content/Safe.json"]
        self.assertEqual(queue.filter_candidates(paths, state), [paths[-1]])

    def test_other_bot_authors_and_automated_labels_reserve_files(self):
        rows = [pr(1, bot=True), pr(2)]
        rows[1]["labels"] = [{"name": "automated"}]
        def get(url):
            if "state=open" in url:
                return rows
            if "/files?" in url:
                return [{"filename": "graph.json"}]
            return {"changed_files": 1}
        state = queue.snapshot("owner/repo", "votes-refresh", get)
        self.assertEqual(queue.filter_candidates(["graph.json", "templates/votes.json"], state), ["templates/votes.json"])

    def test_incomplete_and_failed_lookups_never_look_empty(self):
        for count in (0, 2, 3001):
            def get(url):
                if "state=open" in url:
                    return [pr(1, bot=True)]
                if "/files?" in url:
                    return [{"filename": "content/file.json"}]
                return {"changed_files": count}
            with self.subTest(count=count), self.assertRaises(ValueError):
                queue.snapshot("owner/repo", "proofread-bot", get)
        with self.assertRaises(ValueError):
            queue.snapshot("owner/repo", "proofread-bot", lambda _: {"message": "Bad credentials"})
        with self.assertRaises(subprocess.CalledProcessError):
            queue.snapshot("owner/repo", "proofread-bot",
                           lambda _: (_ for _ in ()).throw(subprocess.CalledProcessError(1, "gh")))

    def test_oversized_votes_pr_reserves_its_batch_without_blocking_other_bots(self):
        # #192/#194/#196: a 49 MB graph diff made GitHub report zero changed files.
        for count in (0, 1, 2):
            for bot in queue.BOT_BRANCHES.keys() - {"votes-refresh"}:
                def get(url):
                    if "state=open" in url:
                        return [pr(192, "votes-refresh/date", bot=True)]
                    if "/files?" in url:
                        return []  # Also cover an incomplete positive-count response.
                    return {"changed_files": count}
                output = io.StringIO()
                with self.subTest(count=count, bot=bot), contextlib.redirect_stderr(output):
                    state = queue.snapshot("owner/repo", bot, get)
                    self.assertEqual(state["own_prs"], [])
                    self.assertEqual(state["reserved"], {"templates/votes.json": [192], "graph.json": [192]})
                    self.assertEqual(queue.filter_candidates([
                        "graph.json", "templates/votes.json", "content/Positions/Mount.json"], state),
                        ["content/Positions/Mount.json"])
                    self.assertIn("known votes-refresh batch", output.getvalue())

    def test_votes_file_api_failure_recovers_known_batch(self):
        def get(url):
            if "state=open" in url:
                return [pr(194, "votes-refresh/date", bot=True)]
            if "/files?" in url:
                raise subprocess.CalledProcessError(1, "gh")
            return {"changed_files": 2}
        state = queue.snapshot("owner/repo", "validation-fixer", get)
        self.assertEqual(set(state["reserved"]), {"templates/votes.json", "graph.json"})
        self.assertEqual(state["requests_checked"], 2)

    def test_known_batch_cannot_hide_evidence_of_other_files(self):
        def get(url):
            if "state=open" in url:
                return [pr(196, "votes-refresh/date", bot=True)]
            if "/files?" in url:
                return [{"filename": "content/unexpected.json"}]
            return {"changed_files": 2}
        with self.assertRaises(ValueError):
            queue.snapshot("owner/repo", "validation-fixer", get)

    def test_cli_lookup_failure_is_nonzero_and_does_not_authorize_work(self):
        with tempfile.TemporaryDirectory(prefix="fixbots-queue-") as temp:
            root = Path(temp)
            gh = root / "gh"
            gh.write_text("#!/bin/sh\necho 'lookup unavailable' >&2\nexit 1\n")
            gh.chmod(0o755)
            output = root / "output"
            result = subprocess.run([sys.executable, str(ROOT / "scripts/bot_queue.py"),
                                     "--bot", "proofread-bot", "--repo", "owner/repo", "--state", str(root / "state")],
                                    env={**os.environ, "PATH": str(root) + ":" + os.environ["PATH"],
                                         "GITHUB_OUTPUT": str(output)}, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("FAILED", result.stderr)
            self.assertNotIn("no own open PR", result.stderr)
            self.assertFalse(output.exists())

    def test_missing_reservation_state_fails_closed(self):
        with self.assertRaises(FileNotFoundError):
            queue.read_state("/does-not-exist/fixbots.json")

    def test_cli_outputs_and_reserved_changed_files(self):
        with tempfile.TemporaryDirectory(prefix="fixbots-cli-") as temp:
            root = Path(temp)
            gh = root / "gh"
            gh.write_text(f"#!{sys.executable}\nimport json, os\n"
                          "print(json.dumps(json.loads(os.environ['FAKE_PRS'])))\n")
            gh.chmod(0o755)
            state, output = root / "state.json", root / "output"
            env = {**os.environ, "PATH": str(root) + ":" + os.environ["PATH"],
                   "GITHUB_OUTPUT": str(output), "BOT_QUEUE_STATE": str(state)}
            command = [sys.executable, str(ROOT / "scripts/bot_queue.py")]
            for rows, proceed in [([pr(1, "proofread-bot/transitions")], "false"), ([], "true")]:
                result = subprocess.run(command + ["--bot", "proofread-bot", "--repo", "owner/repo"],
                                        env={**env, "FAKE_PRS": json.dumps(rows)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(output.read_text().splitlines()[-1], f"proceed={proceed}")
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / "content/Positions/Mount").mkdir(parents=True)
            (root / "content/Positions/Mount/Top.md").write_text("Untracked generated edit")
            # Give git diff HEAD a valid empty tree without staging any files.
            subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                            "commit", "--allow-empty", "-qm", "fixture"], cwd=root, check=True)
            snapshot = json.loads(state.read_text())
            snapshot["reserved"] = {"content/Positions/Mount.json": [9]}
            state.write_text(json.dumps(snapshot))
            result = subprocess.run(command + ["--check-changes"], cwd=root, env=env,
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Changed reserved file", result.stderr)


class RunTests(unittest.TestCase):
    def test_execution_contract_json_and_ndjson(self):
        good = {"type": "result", "subtype": "success", "is_error": False}
        bad = {**good, "is_error": True}  # Observed silent failure had subtype=success.
        cases = [(json.dumps([good]), True), (json.dumps(good), True),
                 (json.dumps({"type": "system"}) + "\n" + json.dumps(good), True),
                 (json.dumps([bad]), False), (json.dumps([good, bad]), False),
                 (json.dumps([{**good, "is_error": "false"}]), False),
                 (json.dumps([{**good, "subtype": "error_max_turns"}]), False),
                 ('[]', False), ('{}', False), ('bad json', False)]
        with tempfile.TemporaryDirectory(prefix="fixbots-results-") as temp:
            path = Path(temp) / "execution.json"
            for raw, success in cases:
                path.write_text(raw)
                with self.subTest(raw=raw):
                    if success:
                        bot_run.check_execution(path)
                    else:
                        with self.assertRaises(ValueError):
                            bot_run.check_execution(path)
            with self.assertRaises(ValueError):
                bot_run.check_execution("")

    def test_analytics_filters_reserved_sources_before_capping(self):
        with tempfile.TemporaryDirectory(prefix="fixbots-select-") as temp:
            root = Path(temp)
            previous = Path.cwd()
            try:
                os.chdir(root)
                Path("content/Positions").mkdir(parents=True)
                for name in ("Reserved Name", "Allowed Name", "Quiet Name"):
                    Path(f"content/Positions/{name}.json").write_text('{"overview":"thin"}')
                analytics = Path("analytics.json")
                analytics.write_text(json.dumps({"pageviews": [
                    ["https://bjjgraph.org/Positions/Reserved-Name/Top", 1000],
                    ["https://bjjgraph.org/Positions/Allowed-Name", 100]],
                    "bounce_rate": [["https://bjjgraph.org/Positions/Allowed-Name", .9]]}))
                state = {"version": 1, "requests_checked": 1, "own_prs": [], "skipped": 0,
                         "candidates_checked": 0, "reserved": {"content/Positions/Reserved Name.json": [23]}}
                Path("state.json").write_text(json.dumps(state))
                with patch.dict(os.environ, {"BOT_QUEUE_STATE": str(root / "state.json")}):
                    bot_run.select_analytics(analytics, 1, Path("selected.txt"))
                self.assertEqual(Path("selected.txt").read_text(), "content/Positions/Allowed Name.json\n")
                self.assertEqual(json.loads(Path("state.json").read_text())["skipped"], 1)
            finally:
                os.chdir(previous)


if __name__ == "__main__":
    unittest.main(verbosity=2)
