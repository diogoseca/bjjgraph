"""Behavior fixtures for read-only clip reports, unique checks, and durable failures.

Named mutation checks (all killed): report-writes-content and check-duplicate-twice
by duplicate_id_is_checked_once_and_metadata_is_unchanged; rot-passes by
dead_and_disabled_are_reported_red_without_pruning; zero-passes by
zero_corpus_fails; drop-partial-log by deadline_keeps_first_result_and_reports_unchecked_ids.
These offline fixtures do not establish current YouTube availability or Actions
artifact delivery; the live measurement and workflow lint cover separate claims.
"""
import collections
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result
v = module('verify_clips', REPO / 'scripts' / 'verify_clips.py')
h = module('clips_helper', REPO / 'scripts' / '_clips.py')


def clip(vid, **kw):
    return {'id': vid, 'title': vid, 'vertical': True, 'verified': '2026-01-01', **kw}


class Reports(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.report = self.root / 'report'
        self.calls = collections.Counter()
        self.data = {}

    def fixture(self, data):
        self.data = copy.deepcopy(data)
        self.path = self.root / 'Fixture.json'
        self.path.write_text(json.dumps(self.data))
        self.before = self.path.read_bytes()
        self.original = copy.deepcopy(self.data)
        return [(str(self.path), self.data, None, self.data)]

    def run_check(self, holders, response, *extra):
        def verify(vid, **kw):
            self.calls[vid] += 1
            self.assertFalse(kw['check_format'])
            return response(vid)
        with patch.object(v, 'iter_clips_arrays', return_value=holders), \
             patch.object(v, 'verify_video', side_effect=verify), \
             contextlib.redirect_stdout(io.StringIO()):
            result = v.main(['--report-dir', str(self.report), '--sleep', '0', *extra])
        self.summary = json.loads((self.report / 'summary.json').read_text())
        self.rows = [json.loads(s) for s in (self.report / 'results.jsonl').read_text().splitlines()]
        return result

    def assert_read_only(self):
        self.assertEqual(self.path.read_bytes(), self.before)
        self.assertEqual(self.data, self.original)

    def test_duplicate_id_is_checked_once_and_metadata_is_unchanged(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        result = self.run_check(holders, lambda _: {'status': 'ok', 'vertical': False, 'channel': 'New'}, '--report-only')
        self.assertEqual(result, 0)
        self.assertEqual(self.calls, {'aaaaaaaaaaa': 1, 'bbbbbbbbbbb': 1})
        self.assertEqual(self.summary['coverage']['checked_unique_ids'], 2)
        self.assertEqual(self.summary['coverage']['clip_references'], 3)
        self.assert_read_only()

    def test_dead_and_disabled_are_reported_red_without_pruning(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        result = self.run_check(holders, lambda vid: {'status': 'gone' if vid[0] == 'a' else 'embed-disabled'})
        self.assertEqual(result, 1)
        self.assertEqual(len(self.summary['dead']), 2)
        self.assertIn('oEmbed HTTP 404', (self.report / 'summary.md').read_text())
        self.assert_read_only()

    def test_transient_retry_is_bounded_and_still_fails(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa')]})
        result = self.run_check(holders, lambda _: {'status': 'error'})
        self.assertEqual(result, 2)
        self.assertEqual(self.calls['aaaaaaaaaaa'], 2)
        self.assertEqual(self.summary['coverage']['errors'], 1)
        self.assertEqual(self.rows[0]['attempts'], 2)
        self.assert_read_only()

    def test_retry_can_recover_but_is_one_unique_id(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa')]})
        result = self.run_check(holders, lambda vid: {'status': 'error' if self.calls[vid] == 1 else 'ok'})
        self.assertEqual(result, 0)
        self.assertEqual(self.summary['coverage']['checked_unique_ids'], 1)
        self.assertEqual(len(self.rows), 1)
        self.assertEqual(self.rows[0]['attempts'], 2)

    def test_zero_corpus_fails(self):
        result = self.run_check([], lambda _: self.fail('should not check'))
        self.assertEqual(result, 2)
        self.assertFalse(self.summary['complete'])
        self.assertIn('zero IDs checked', (self.report / 'summary.md').read_text())

    def test_all_recent_fails_zero_coverage(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa', verified='9999-01-01')]})
        self.assertEqual(self.run_check(holders, lambda _: self.fail('should not check'), '--max-age-days', '30'), 2)
        self.assertEqual(self.summary['coverage']['skipped_recent'], 1)
        self.assert_read_only()

    def test_stale_duplicate_checks_id_and_reports_all_references(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa', verified='9999-01-01'), clip('aaaaaaaaaaa')]})
        result = self.run_check(holders, lambda _: {'status': 'gone'}, '--max-age-days', '30')
        self.assertEqual(result, 1)
        self.assertEqual(self.calls['aaaaaaaaaaa'], 1)
        self.assertEqual(len(self.summary['dead'][0]['references']), 2)

    def test_prune_removes_only_dead_and_keeps_live_metadata(self):
        holders = self.fixture({'name': 'Keep', 'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        result = self.run_check(holders, lambda vid: {'status': 'gone' if vid[0] == 'a' else 'ok'}, '--prune')
        self.assertEqual(result, 0)
        self.assertEqual(json.loads(self.path.read_text()), {'name': 'Keep', 'clips': [self.original['clips'][1]]})

    def test_deadline_keeps_first_result_and_reports_unchecked_ids(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        def slow(_):
            time.sleep(0.15)
            return {'status': 'ok'}
        result = self.run_check(holders, slow, '--workers', '1', '--max-seconds', '0.1')
        self.assertEqual(result, 2)
        self.assertEqual(self.summary['coverage']['checked_unique_ids'], 1)
        self.assertEqual(self.summary['coverage']['unchecked'], 1)
        self.assertEqual(len(self.rows), 1)
        self.assertFalse(self.summary['complete'])
        self.assert_read_only()

    def test_results_are_durable_before_the_next_check_finishes(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        def response(vid):
            if vid[0] == 'b':
                first = json.loads((self.report / 'results.jsonl').read_text())
                self.assertEqual(first['id'], 'aaaaaaaaaaa')
                partial = json.loads((self.report / 'summary.json').read_text())
                self.assertFalse(partial['complete'])
                self.assertEqual(partial['coverage']['checked_unique_ids'], 1)
            return {'status': 'ok'}
        self.assertEqual(self.run_check(holders, response, '--workers', '1'), 0)

    def test_sigterm_keeps_partial_results_and_returns_failure(self):
        holders = self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        def response(_):
            os.kill(os.getpid(), signal.SIGTERM)
            time.sleep(0.02)
            return {'status': 'ok'}
        self.assertEqual(self.run_check(holders, response, '--workers', '1'), 2)
        self.assertFalse(self.summary['complete'])
        self.assertEqual(self.summary['coverage']['unchecked'], 1)
        self.assertEqual(len(self.rows), 1)
        self.assert_read_only()

    def test_hard_kill_keeps_already_completed_results(self):
        self.fixture({'clips': [clip('aaaaaaaaaaa'), clip('bbbbbbbbbbb')]})
        marker = self.root / 'second-started'
        child = f"""
import importlib.util, json, sys, time
from pathlib import Path
sys.path.insert(0, {str(REPO / 'scripts')!r})
spec = importlib.util.spec_from_file_location('verify_child', {v.__file__!r})
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p = Path({str(self.path)!r})
data = json.loads(p.read_text())
m.iter_clips_arrays = lambda *args: [(str(p), data, None, data)]
def check(vid, **kw):
    if vid == 'bbbbbbbbbbb':
        Path({str(marker)!r}).write_text('started')
        time.sleep(60)
    return {{'status': 'ok'}}
m.verify_video = check
sys.exit(m.main(['--workers', '1', '--sleep', '0', '--report-dir', {str(self.report)!r}]))
"""
        process = subprocess.Popen([sys.executable, '-B', '-c', child], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 5
            while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertTrue(marker.exists(), 'second request must be running before the timeout')
            process.kill()  # only this fixture's child; emulate a CI step hard timeout
            process.communicate(timeout=5)
            summary = json.loads((self.report / 'summary.json').read_text())
            rows = [json.loads(line) for line in (self.report / 'results.jsonl').read_text().splitlines()]
            self.assertFalse(summary['complete'])
            self.assertEqual(summary['coverage']['checked_unique_ids'], 1)
            self.assertEqual(summary['coverage']['unchecked'], 1)
            self.assertEqual([row['id'] for row in rows], ['aaaaaaaaaaa'])
            self.assert_read_only()
        finally:
            if process.poll() is None:
                process.kill()
            process.communicate(timeout=5)

    def test_request_start_pacing_is_global_and_concurrency_is_bounded(self):
        holders = self.fixture({'clips': [clip(str(i) * 11) for i in range(6)]})
        starts = []
        active = [0, 0]
        lock = threading.Lock()
        def response(_):
            with lock:
                starts.append(time.monotonic())
                active[0] += 1
                active[1] = max(active)
            time.sleep(0.04)
            with lock:
                active[0] -= 1
            return {'status': 'ok'}
        self.assertEqual(self.run_check(holders, response, '--workers', '2', '--sleep', '0.02'), 0)
        self.assertLessEqual(active[1], 2)
        self.assertGreater(active[1], 1)
        self.assertTrue(all(b - a >= 0.019 for a, b in zip(starts, starts[1:])))


class HealthChecks(unittest.TestCase):
    def test_report_check_does_not_probe_thumbnails(self):
        with patch.object(h.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"author_name":"Example"}')), \
             patch.object(h, 'is_short') as short:
            result = h.verify_video('aaaaaaaaaaa', check_format=False)
        self.assertEqual(result['status'], 'ok')
        self.assertIsNone(result['vertical'])
        short.assert_not_called()

    def test_sourcing_still_checks_format(self):
        with patch.object(h.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"author_name":"Example"}')), \
             patch.object(h, 'is_short', return_value=True) as short:
            result = h.verify_video('aaaaaaaaaaa')
        self.assertTrue(result['vertical'])
        short.assert_called_once()

    def test_http_statuses_distinguish_rot_from_transient_errors(self):
        for status, expected in [(401, 'embed-disabled'), (403, 'embed-disabled'), (404, 'gone'), (429, 'error'), (503, 'error')]:
            with self.subTest(status=status), \
                 patch.object(h.urllib.request, 'urlopen', side_effect=h.urllib.error.HTTPError('url', status, 'failure', {}, None)):
                result = h.verify_video('aaaaaaaaaaa', check_format=False)
                self.assertEqual(result['status'], expected)
                self.assertIn(str(status), result['reason'])


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f'verify_clips fixture coverage: {result.testsRun} tests, {len(result.skipped)} skipped')
    sys.exit(0 if result.testsRun and result.wasSuccessful() and not result.skipped else 1)
