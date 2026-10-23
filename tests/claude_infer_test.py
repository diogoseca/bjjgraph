"""Offline stdlib-only inference regressions; no Claude calls or real sleeps.

Auth-retry mutant: disabling the auth branch in call_claude must fail
test_auth_failure_exits_once_without_sleeping_or_trying_next_file.
"""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import claude_infer as infer


def cli(rc, stdout="", stderr=""):
    process = Mock(returncode=rc)
    process.communicate.return_value = (stdout, stderr)
    return process


class InferenceTests(unittest.TestCase):
    def test_auth_classification(self):
        for message in ("API Error: 401", "HTTP 401 Unauthorized", "Failed to authenticate",
                        "OAuth access token has expired", "Invalid API key", "INVALID API KEY"):
            with self.subTest(message=message):
                self.assertTrue(infer._looks_like_auth_error(message))
        for message in ("429 too many requests", "usage limit resets in 1h", "overloaded",
                        "502 Bad Gateway", "Claude CLI timeout", "request 14012 failed", ""):
            with self.subTest(message=message):
                self.assertFalse(infer._looks_like_auth_error(message))

    def test_auth_failure_exits_once_without_sleeping_or_trying_next_file(self):
        messages = ["API Error: 401", "Failed to authenticate",
                    "OAuth access token has expired", "Invalid API key",
                    "401 OAuth access token has expired; retry-after: 900"]
        for message in messages:
            for rc, stdout, stderr in (
                (1, "", message), (1, message, ""),
                (0, json.dumps({"is_error": True, "result": message}), ""),
            ):
                with self.subTest(message=message, rc=rc, stdout=stdout), \
                        patch.object(infer, "MAX_ATTEMPTS", 3), \
                        patch.object(infer.subprocess, "Popen", return_value=cli(rc, stdout, stderr)) as popen, \
                        patch.object(infer.time, "sleep") as sleep:
                    notices, files = [], []
                    with self.assertRaises(infer.ClaudeAuthenticationError) as error:
                        for name in ("first", "second"):
                            files.append(name)
                            # Content runners catch ordinary errors per file. Fatal
                            # credentials must escape that handler and end the batch.
                            try:
                                infer.call_claude(name, {}, "model", "high", log=notices.append)
                            except Exception:
                                continue
                    self.assertEqual(error.exception.code, 2)
                    popen.assert_called_once()
                    sleep.assert_not_called()
                    self.assertEqual(files, ["first"])
                    self.assertEqual(notices, [
                        "[claude] Authentication failed; refresh the CLAUDE_CODE_OAUTH_TOKEN repository secret."])

    def test_successful_content_with_auth_words_is_not_a_credentials_failure(self):
        content = {"overview": "Invalid API key; API Error: 401"}
        stdout = json.dumps({"is_error": False, "structured_output": content})
        with patch.object(infer.subprocess, "Popen", return_value=cli(0, stdout)), \
                patch.object(infer.time, "sleep") as sleep:
            result, error = infer.call_claude("prompt", {}, "model", "high")
        self.assertIsNone(error)
        self.assertEqual(json.loads(result), content)
        sleep.assert_not_called()

    def test_usage_limits_and_transient_errors_keep_their_backoff(self):
        cases = [(1, "", "429 retry-after: 120", 135),
                 (0, json.dumps({"is_error": True, "result": "usage limit retry-after: 120"}), "", 135),
                 (1, "", "502 Bad Gateway", 60)]
        for rc, stdout, stderr, wait in cases:
            with self.subTest(rc=rc, stdout=stdout, stderr=stderr), \
                    patch.multiple(infer, MAX_ATTEMPTS=3, MIN_WAIT=60, BUFFER=15,
                                   BACKOFF_BASE=30, BACKOFF_CAP=900, MAX_PARSED_WAIT=18000), \
                    patch.object(infer.random, "randint", return_value=0), \
                    patch.object(infer.subprocess, "Popen", side_effect=[
                        cli(rc, stdout, stderr),
                        cli(0, json.dumps({"structured_output": {"fixed_content": {}}})),
                    ]) as popen, patch.object(infer.time, "sleep") as sleep:
                result, error = infer.call_claude("prompt", {}, "model", "high", log=lambda _: None)
                self.assertIsNone(error)
                self.assertEqual(json.loads(result), {"fixed_content": {}})
                self.assertEqual(popen.call_count, 2)
                sleep.assert_called_once_with(wait)


if __name__ == "__main__":
    unittest.main(verbosity=2)
