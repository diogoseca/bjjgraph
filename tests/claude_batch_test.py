"""Offline stdlib-only tests of the real regeneration main/process_file/inference path.

Validation and prompt inputs are stubbed; every Claude subprocess is replaced.
Dropping ClaudeAuthAbort.abort's shared signal must fail
test_six_file_parallel_auth_stops_even_before_main_collects_results.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed, wait
from contextlib import ExitStack, redirect_stdout
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts import claude_infer as infer

# The tests exercise orchestration, not JSON-schema validation. Stub the validator
# at import time so this suite needs only stdlib, even without jsonschema installed.
with patch.dict(sys.modules, {"scripts.validate_json": SimpleNamespace(**{
    name: Mock(side_effect=AssertionError("unexpected real validation"))
    for name in ("validate_json_file", "load_schema", "detect_position_template_type",
                 "detect_transition_template_type")
})}):
    import scripts.regenerate_content_json as regen


def cli(rc=1, stdout="", stderr="API Error: 401", communicate=None):
    return SimpleNamespace(returncode=rc, communicate=communicate or (lambda **_: (stdout, stderr)))


class RegenerationBatchTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory(prefix="fixbots-batch-")))
        self.files = [self.root / "content/Principles" / f"Fixture{i}.json" for i in range(6)]
        self.output = io.StringIO()
        self.stack.enter_context(redirect_stdout(self.output))
        self.stack.enter_context(patch.object(sys, "argv", ["regen", "--batch", "--parallel", "2"]))
        for name, value in {"CONTENT_PATH": self.root / "content", "LOGS_PATH": self.root / "logs",
                            "stats": {**regen.stats, "errors": []}}.items():
            self.stack.enter_context(patch.object(regen, name, value))
        for name, kwargs in {
            "collect_files": {"return_value": self.files},
            "build_reference_lists": {"return_value": {key: [] for key in
                ("positions", "transitions", "submissions", "principles", "systems", "learning")}},
            "load_json": {"side_effect": lambda path: {"name": path.stem}},
            "run_validation": {"return_value": (False, True, ["fixture"], [])},
            "build_response_schema": {"return_value": {}},
            "build_prompt": {"side_effect": lambda path, *args: str(path)},
        }.items():
            self.stack.enter_context(patch.object(regen, name, **kwargs))
        self.popen = self.stack.enter_context(patch.object(infer.subprocess, "Popen", return_value=cli()))
        self.sleep = self.stack.enter_context(patch.object(infer.time, "sleep"))
        self.notice_threads = []
        original_print = regen.tprint

        def record_notice(*args, **kwargs):
            if infer.AUTH_DIAGNOSTIC in args:
                self.notice_threads.append(threading.current_thread())
            original_print(*args, **kwargs)

        self.stack.enter_context(patch.object(regen, "tprint", side_effect=record_notice))

    def assert_fatal_batch(self, expected_calls):
        with self.assertRaises(infer.ClaudeAuthenticationError) as error:
            regen.main()
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(self.popen.call_count, expected_calls)
        self.sleep.assert_not_called()
        self.assertEqual(self.output.getvalue().count("Authentication failed"), 1)
        self.assertEqual(self.notice_threads, [threading.main_thread()])
        self.assertEqual(list(self.root.rglob("*")), [], "auth failure must not write fixtures or reports")

    def test_sequential_auth_stops_after_first_file(self):
        with patch.object(sys, "argv", ["regen", "--batch", "--parallel", "1"]):
            self.assert_fatal_batch(1)

    def test_six_file_parallel_auth_stops_even_before_main_collects_results(self):
        started = threading.Barrier(2)
        calls = 0

        def start(*args, **kwargs):
            nonlocal calls
            calls += 1
            first_pair = calls <= 2

            def communicate(**kwargs):
                if first_pair:
                    started.wait(timeout=5)
                return "", "API Error: 401"

            return cli(communicate=communicate)

        self.popen.side_effect = start

        def collect_after_workers(futures):
            # Deliberately deschedule the owner until workers have drained the
            # queue. Cancellation alone cannot pass: the shared signal must stop
            # calls before the main thread observes the first failed future.
            _, pending = wait(futures, timeout=5)
            self.assertFalse(pending)
            return as_completed(futures)

        with patch.object(regen, "as_completed", side_effect=collect_after_workers):
            self.assert_fatal_batch(2)

    def test_parallel_auth_cancels_queue_and_joins_inflight_without_retry(self):
        started = threading.Barrier(2)
        main_diagnosed = threading.Event()
        cancelled = []
        calls = 0
        original_print = regen.tprint

        def start(*args, **kwargs):
            nonlocal calls
            calls += 1
            first = calls == 1

            def communicate(**kwargs):
                started.wait(timeout=5)
                if not first:
                    self.assertTrue(main_diagnosed.wait(timeout=5))
                return "", "API Error: 401" if first else "502 Bad Gateway"

            return cli(communicate=communicate)

        def notice(*args, **kwargs):
            original_print(*args, **kwargs)
            if infer.AUTH_DIAGNOSTIC in args:
                main_diagnosed.set()

        def record_futures(futures):
            for future in futures:
                original_cancel = future.cancel

                def cancel(future=future, original_cancel=original_cancel):
                    cancelled.append(future)
                    return original_cancel()

                future.cancel = cancel
            return as_completed(futures)

        self.popen.side_effect = start
        with patch.object(regen, "as_completed", side_effect=record_futures), \
                patch.object(regen, "tprint", side_effect=notice):
            self.assert_fatal_batch(2)
        self.assertEqual(len(set(cancelled)), len(self.files))


class SharedAbortTests(unittest.TestCase):
    def test_signal_is_checked_before_retrying_a_call(self):
        abort = infer.ClaudeAuthAbort()
        with patch.object(infer.subprocess, "Popen", return_value=cli(stderr="429 retry-after: 120")) as popen, \
                patch.object(abort, "wait", side_effect=lambda _: abort.abort()):
            with self.assertRaises(infer.ClaudeAuthenticationError):
                infer.call_claude("prompt", {}, "model", "high", log=lambda _: None, auth_abort=abort)
        popen.assert_called_once()

    def test_auth_wakes_another_workers_backoff(self):
        abort = infer.ClaudeAuthAbort()
        waiting = threading.Event()
        with patch.object(infer.subprocess, "Popen", side_effect=[
                cli(stderr="429 retry-after: 401"), cli()]) as popen, \
                patch.object(infer.time, "sleep") as sleep, ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(infer.call_claude, "first", {}, "model", "high",
                                 log=lambda _: waiting.set(), auth_abort=abort)
            try:
                self.assertTrue(waiting.wait(timeout=5))
                with self.assertRaises(infer.ClaudeAuthenticationError):
                    infer.call_claude("second", {}, "model", "high", auth_abort=abort)
                with self.assertRaises(infer.ClaudeAuthenticationError):
                    future.result(timeout=5)
            finally:
                abort.abort()  # also release the worker if an assertion fails
            self.assertEqual(popen.call_count, 2)
            sleep.assert_not_called()

    def test_abort_is_scoped_to_one_batch(self):
        aborted = infer.ClaudeAuthAbort()
        aborted.abort()
        with patch.object(infer.subprocess, "Popen", return_value=cli(
                0, json.dumps({"structured_output": {"ok": True}}), "")) as popen:
            with self.assertRaises(infer.ClaudeAuthenticationError):
                infer.call_claude("prompt", {}, "model", "high", auth_abort=aborted)
            popen.assert_not_called()
            result, error = infer.call_claude("prompt", {}, "model", "high", auth_abort=infer.ClaudeAuthAbort())
            self.assertIsNone(error)
            self.assertEqual(json.loads(result), {"ok": True})
            popen.assert_called_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
