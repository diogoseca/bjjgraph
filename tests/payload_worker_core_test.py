"""Actual proposed gate functions, isolated tiny filesystem. No full site scan."""
from pathlib import Path
import ast
import gzip
import hashlib
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'scripts/check_payload_budget.py'
tree = ast.parse(source.read_text())
# Execute actual isolated measurement/classification code; omit unrelated site gates/imports.
needed = {'NEURAL_DIR', 'CHUNK_DIRS', 'DEFERRED', 'DEFERRED_WORKER_CORE',
          'is_deferred_neural_asset', 'measure_neural'}
body = [node for node in tree.body if
        (isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in needed for t in node.targets)) or
        (isinstance(node, ast.FunctionDef) and node.name in needed)]
ns = {'gzip': gzip, 'hashlib': hashlib, 're': re}
exec(compile(ast.Module(body=body, type_ignores=[]), str(source), 'exec'), ns)

class Accounting(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        ns['PUBLIC'] = Path(self.temp.name)
        self.root = ns['PUBLIC'] / ns['NEURAL_DIR']
        self.root.mkdir(parents=True)

    def write(self, path, body):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(body)

    def core(self, body):
        path = 'app/game-worker-core-' + hashlib.sha256(body).hexdigest() + '.js'
        self.write(path, body)
        return path

    def test_counts_all_generations_with_legacy_and_ordinary_workers(self):
        a = self.core(b'self.a=1;')
        b = self.core(b'self.a=2;')
        self.write('systems.json', b'{"systems":[]}')
        self.write('app/game-model.worker.js', b'importScripts("core");')
        self.write('app/neural.js', b'play();')
        got = ns['measure_neural']()
        self.assertEqual(got['deferred_raw_bytes'], 18 + 14 + 22)
        self.assertEqual({x['path'] for x in got['deferred_files']}, {a,b,'systems.json','app/game-model.worker.js'})
        self.assertEqual(got['chunk_count'], 0)
        self.assertEqual(got['eager_raw_bytes'], 7)

    def test_other_or_malformed_javascript_names_are_eager(self):
        paths = ['app/game-worker-core-latest.js', 'app/game-worker-core-'+('A'*64)+'.js',
                 'app/game-worker-core-'+('a'*64)+'.js.map', 'another/game-worker-core-'+('a'*64)+'.js']
        for path in paths:
            self.assertFalse(ns['is_deferred_neural_asset'](path))
            self.write(path, b'let a=1;')
        got = ns['measure_neural']()
        self.assertEqual(got['deferred_raw_bytes'], 0)
        self.assertEqual(got['eager_raw_bytes'], len(paths)*8)

    def test_validly_named_but_mutated_core_is_rejected(self):
        path = self.core(b'self.a=1;')
        self.write(path, b'self.a=2;')
        with self.assertRaisesRegex(ValueError, 'worker core filename/content hash mismatch'):
            ns['measure_neural']()

    def test_browser_boot_ban_matches_every_retained_core_generation(self):
        browser = (ROOT/'e2e/journeys/payload-first-hand.spec.ts').read_text()
        expected = r'/\/game-worker-core-[0-9a-f]{64}\.js(\?|$)/'
        self.assertIn(expected, browser)

if __name__ == '__main__':
    unittest.main()
