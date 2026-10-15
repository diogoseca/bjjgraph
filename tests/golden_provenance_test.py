"""Real Git fixtures: vault exclusions cannot hide authored or generated content.

The CLI controls require exit 2 for real drift, including after a vault-only
commit. Legacy receipts must validate their original tree/counts before narrowing.
No product content, baseline, or Git index is mutated by these tests.

Mutation controls (disposable module copies): returning True from the scope filter
fails test_vault_dirty_staged_committed_added_removed_and_ignored_pass; excluding
all JSON fails test_real_json_and_markdown_dirty_staged_and_capture_changes_fail;
dropping tree equality fails test_committed_json_and_markdown_cannot_hide_behind_vault_commit;
adding --exclude-standard fails test_untracked_and_ignored_inputs_and_similar_paths_still_fail.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from golden_provenance import (CONTENT_SCOPE, FULL_SCOPE, SCHEMA, ProvenanceError, begin_capture,
                               committed_content, finish_capture, inspect_content)


class ContentScopeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='obsidian-provenance-')
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / 'repo'
        self.repo.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        for path, text in {
            'content/page.md': 'generated page',
            'content/page.json': '{"source": true}',
            'content/.obsidian/app.json': '{}',
            'content/.obsidian/plugins/example/main.js': 'fixture',
            '.gitignore': 'content/ignored.*\ncontent/.obsidian/workspace*.json\n',
        }.items():
            self.write(path, text)
        self.commit('initial fixture')
        self.receipt = finish_capture(begin_capture(self.repo, 'fixture'), self.repo)
        self.legacy = {**self.receipt,
                       **committed_content(str(self.repo), self.receipt['capture_git_head'], FULL_SCOPE)}
        del self.legacy['content_scope']

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.PIPE, text=True).strip()

    def write(self, path, text):
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        return p

    def commit(self, message):
        self.git('add', '--all')  # Disposable fixture only.
        self.git('commit', '-qm', message)

    def state(self, want, receipt=None):
        for proof in ([receipt] if receipt else [self.receipt, self.legacy]):
            verdict = inspect_content(proof, self.repo)
            self.assertEqual(verdict['state'], want, verdict)
        return verdict

    def cli(self, want):
        receipt_path = Path(self.tmp.name) / 'receipt.json'
        receipt_path.write_text(json.dumps(self.receipt))
        result = subprocess.run([sys.executable, '-B', '-S', str(ROOT / 'scripts/golden_provenance.py'),
                                 '--receipt', str(receipt_path), '--source-repo', str(self.repo)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, want, result.stdout + result.stderr)
        self.assertIn('CONTENT_PROVENANCE_DRIFTED' if want == 2 else 'MATCH', result.stdout)

    def test_receipt_excludes_vault_from_identity_and_counts(self):
        self.assertEqual(self.receipt['schema'], SCHEMA)
        self.assertEqual(self.receipt['content_scope'], CONTENT_SCOPE)
        self.assertEqual(self.receipt['content_files'], 2)
        self.assertEqual(self.receipt['content_md'], 1)
        self.assertEqual(self.legacy['content_files'], 4)
        self.state('MATCH')
        self.git('rm', '-qr', 'content/.obsidian')
        self.git('commit', '-qm', 'remove vault')
        self.assertEqual(self.receipt['content_tree'], self.git('rev-parse', 'HEAD:content'))
        self.state('MATCH')
        self.cli(0)
        # The virtual hash must also equal Git's real tree with nested subtrees
        # and nontrivial filename bytes, not just the two flat fixture files.
        self.write('content/nested/quoted "π"\tpage\n.md', 'nested input')
        self.write('content/.obsidian/app.json', '{}')
        self.commit('nested fixture with vault')
        nested = finish_capture(begin_capture(self.repo, 'nested'), self.repo)
        self.git('rm', '-qr', 'content/.obsidian')
        self.git('commit', '-qm', 'remove only vault again')
        self.assertEqual(nested['content_tree'], self.git('rev-parse', 'HEAD:content'))
        self.state('MATCH', nested)

    def test_vault_dirty_staged_committed_added_removed_and_ignored_pass(self):
        self.write('content/.obsidian/app.json', '{"alwaysUpdateLinks": false}')
        self.write('content/.obsidian/new.md', 'local plugin note')
        self.write('content/.obsidian/workspace.json', '{"local": true}')
        self.write('content/.obsidian/workspace-mobile.json', '{}')
        self.git('rm', '-q', 'content/.obsidian/plugins/example/main.js')
        self.state('MATCH')
        self.git('add', 'content/.obsidian/app.json', 'content/.obsidian/new.md')
        self.state('MATCH')
        self.git('commit', '-qm', 'vault changes only')
        self.state('MATCH')
        self.cli(0)
        fresh = finish_capture(begin_capture(self.repo, 'vault-local'), self.repo)
        self.assertEqual(fresh['content_files'], 2)

    def test_vault_changes_during_capture_pass(self):
        start = begin_capture(self.repo, 'local-workspace')
        self.write('content/.obsidian/app.json', '{"local": true}')
        self.write('content/.obsidian/workspace.json', '{}')
        self.state('MATCH', finish_capture(start, self.repo))

    def test_real_json_and_markdown_dirty_staged_and_capture_changes_fail(self):
        for rel in ('content/page.json', 'content/page.md'):
            with self.subTest(path=rel):
                original = (self.repo / rel).read_bytes()
                start = begin_capture(self.repo, 'before-edit')
                self.write(rel, 'changed input')
                self.state('DRIFTED')
                self.cli(2)
                with self.assertRaises(ProvenanceError):
                    begin_capture(self.repo, 'dirty-input')
                with self.assertRaises(ProvenanceError):
                    finish_capture(start, self.repo)
                self.git('add', rel)
                self.state('DRIFTED')
                (self.repo / rel).write_bytes(original)
                self.git('add', rel)
                self.state('MATCH')

    def test_committed_json_and_markdown_cannot_hide_behind_vault_commit(self):
        for rel in ('content/page.json', 'content/page.md'):
            with self.subTest(path=rel):
                original = (self.repo / rel).read_bytes()
                self.write(rel, 'committed input change')
                self.commit('real content changed')
                self.write('content/.obsidian/app.json', json.dumps({'after': rel}))
                self.commit('later vault change')
                self.state('DRIFTED')
                self.cli(2)
                (self.repo / rel).write_bytes(original)
                self.commit('restore fixture input')
                self.state('MATCH')

    def test_untracked_and_ignored_inputs_and_similar_paths_still_fail(self):
        for rel in ('content/new.json', 'content/new.md', 'content/ignored.json',
                    'content/ignored.md', 'content/image.png', 'content/.obsidian-copy/note.md',
                    'content/nested/.obsidian/note.md', 'content/.other/note.md'):
            with self.subTest(path=rel):
                extra = self.write(rel, 'new input')
                verdict = self.state('DRIFTED')
                self.assertIn(rel, verdict['changed_paths'])
                self.cli(2)
                extra.unlink()
        self.state('MATCH')

    def test_deletions_renames_and_modes_of_real_inputs_still_fail(self):
        page = self.repo / 'content/page.md'
        original = page.read_bytes()
        page.unlink()
        self.state('DRIFTED')
        page.write_bytes(original)
        self.git('mv', 'content/page.md', 'content/renamed.md')
        self.state('DRIFTED')
        self.git('mv', 'content/renamed.md', 'content/page.md')
        page.chmod(0o755)
        self.commit('executable content mode')
        self.state('DRIFTED')

    def test_git_trust_flags_are_excluded_only_in_vault(self):
        for flag in ('assume-unchanged', 'skip-worktree'):
            with self.subTest(flag=flag):
                self.git('update-index', '--' + flag, 'content/.obsidian/app.json')
                self.state('MATCH')
                for rel in ('content/page.md', 'content/page.json'):
                    self.git('update-index', '--' + flag, rel)
                    self.state('UNVERIFIED')
                    self.git('update-index', '--no-' + flag, rel)
                self.git('update-index', '--no-' + flag, 'content/.obsidian/app.json')

    def test_forged_receipts_and_unknown_schemas_remain_unverified(self):
        for receipt in (self.receipt, self.legacy):
            for delta in ({'content_files': 99}, {'content_tree': '0' * 40},
                          {'content_clean_at_start': False}, {'content_clean_at_end': False},
                          {'schema': 'invented'}, {'content_scope': 'invented'}):
                with self.subTest(scope=receipt.get('content_scope'), delta=delta):
                    self.state('UNVERIFIED', {**receipt, **delta})
        # A scoped count cannot be substituted into a full-tree v1 receipt.
        self.state('UNVERIFIED', {**self.legacy, 'content_files': 2})

    def test_build_keeps_its_explicit_obsidian_exclusion(self):
        config = (ROOT / 'source/quartz.config.ts').read_text()
        import re
        ignore = re.search(r'ignorePatterns:\s*\[([^]]+)\]', config).group(1)
        self.assertIn('".obsidian"', ignore)


if __name__ == '__main__':
    unittest.main(verbosity=2)
