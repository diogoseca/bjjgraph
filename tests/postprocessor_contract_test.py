"""Real CLI mutation specs for the post-processor input boundary.

Kills: every one of the eleven index literal shapes; SVG/document-title confusion;
missing/duplicate articles; sitemap zero/below-floor/missing target; missing noindex
and missing source coverage; unknown article-free artifacts. Claims refer to the
named seeded cases; exclusions and non-kills follow. Marker preservation belongs
to system_affiliates.py, not this gate.
The unchanged share-shell is also executed; this is not a copied renderer.

COORDINATION §7I: mutants touch disposable fixture copies only. Capture their
actual bytes and SHA-256 before mutation; restore those bytes and verify the
original digest before reuse. Restoration failures abort the run, even inside
subTest or an expected mutant AssertionError. Commit test changes before running
mutants; no git checkout is used to restore fixtures.

Publication classifier scope: BOTH dates remain required. Partial publication
absence is a real failure; sole source-pinned whole-corpus absence is pending (2),
never conformity (0). The original eleven-row index assertions remain required.
Known limitations/NON-KILLS: an exact revert of the pinned producer bytes can
reactivate pending until X-01 DELETES that branch. Source-index completeness is
B's contract; jointly removing an index key and its page metadata is outside this
F gate. Date value correctness and provenance belong to Head/date tests. These
limitations are not claimed as mutation kills or end-state acceptance.

D-51 scope: PostprocessorFreshOutputTest drives tiny fresh-output fixtures through
unchanged headers/redirects/llms scripts, and discovery's actual error branches.
It kills six copied-script no-op/write-deletion mutants plus one overflow-guard
removal. No surviving seeded mutants in this class. Unproved: Forward generation
from empty output; a real Env B emit. The existing keyless replay began with every
artifact already present and only 1,767 redirect rules, so it cannot prove these
fresh writes or the >2,000 overflow guard. Fixture coverage is not a corpus build.
Run just these tiny cases: python3 -B tests/postprocessor_contract_test.py PostprocessorFreshOutputTest -v
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / 'scripts/check_postprocessor_contract.py'
sys.path.insert(0, str(ROOT / 'scripts'))
import check_postprocessor_contract as postprocessor_contract
INDEX = '''<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Study BJJ</title><link rel="canonical" href="https://bjjgraph.org/"/>
<meta property="og:title" content="Study BJJ"/>
<meta property="og:description" content="Study techniques"/>
<meta property="og:url" content="https://bjjgraph.org/"/>
<meta property="og:type" content="website"/>
<meta name="twitter:title" content="Study BJJ"/>
<meta name="twitter:description" content="Study techniques"/>
<meta name="description" content="Study techniques"/>
<meta property="article:published_time" content="2026-09-20T00:00:00Z"/>
<meta property="article:modified_time" content="2026-09-20T01:00:00Z"/>
</head><body><svg><title>Search</title></svg><article>Study.</article></body></html>'''


PUBLISHED_TAG = '<meta property="article:published_time" content="2026-09-20T00:00:00Z"/>'
MODIFIED_TAG = '<meta property="article:modified_time" content="2026-09-20T01:00:00Z"/>'
DATED_HEAD = '<head>' + PUBLISHED_TAG + MODIFIED_TAG + '</head>'


class FixtureRestorationError(KeyboardInterrupt):
    """Abort contaminated reuse: unittest deliberately propagates KeyboardInterrupt.

    Ordinary exceptions (including AssertionError) are swallowed by subTest.
    This exception must also escape expected mutant-assertion contexts.
    """


class FixtureSnapshot:
    """Snapshot actual bytes and their pre-mutation digest, including absent files."""

    def __init__(self, *paths):
        self.before = {}
        self.digests = {}
        for path in paths:
            path = Path(path)
            data = path.read_bytes() if path.exists() else None
            self.before[path] = data
            self.digests[path] = None if data is None else hashlib.sha256(data).hexdigest()

    def text(self, path):
        return self.before[Path(path)].decode('utf-8')

    def verify(self):
        for path, expected in self.digests.items():
            try:
                data = path.read_bytes() if path.exists() else None
                actual = None if data is None else hashlib.sha256(data).hexdigest()
            except OSError as error:
                raise FixtureRestorationError(f'fixture restore unreadable: {path}: {error}') from error
            if actual != expected:
                raise FixtureRestorationError(
                    f'fixture restore SHA-256 mismatch: {path}: expected {expected}, found {actual}')

    def restore(self):
        try:
            for path, data in self.before.items():
                if data is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(data)
        except OSError as error:
            raise FixtureRestorationError(f'fixture restore failed: {path}: {error}') from error
        self.verify()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.restore()


class FixtureSnapshotTest(unittest.TestCase):
    """Failure controls mutate only disposable files, never repository sources."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='quartz-restore-control-')
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'fixture.txt'
        self.baseline = 'uncommitted café\r\nsecond line\r\n'.encode('utf-8')
        self.path.write_bytes(self.baseline)

    def test_skipped_restore_is_rejected(self):
        snapshot = FixtureSnapshot(self.path)
        try:
            self.path.write_bytes(b'mutant')
            with self.assertRaisesRegex(FixtureRestorationError, 'SHA-256 mismatch'):
                snapshot.verify()
        finally:
            snapshot.restore()

    def test_wrong_old_or_head_like_bytes_are_rejected(self):
        snapshot = FixtureSnapshot(self.path)
        try:
            self.path.write_bytes(b'older committed HEAD bytes\n')
            with self.assertRaisesRegex(FixtureRestorationError, 'SHA-256 mismatch'):
                snapshot.verify()
        finally:
            snapshot.restore()

    def test_deleted_file_is_rejected_and_restored(self):
        snapshot = FixtureSnapshot(self.path)
        try:
            self.path.unlink()
            with self.assertRaisesRegex(FixtureRestorationError, 'SHA-256 mismatch'):
                snapshot.verify()
        finally:
            snapshot.restore()

    def test_non_ascii_crlf_baseline_is_restored_byte_faithfully(self):
        with FixtureSnapshot(self.path) as snapshot:
            self.path.write_text('replacement\n', encoding='utf-8')
        self.assertEqual(self.path.read_bytes(), self.baseline)
        self.assertEqual(snapshot.digests[self.path], hashlib.sha256(self.baseline).hexdigest())

    def test_restore_failure_escapes_subtest_and_expected_mutant_assertion(self):
        snapshot = FixtureSnapshot(self.path)
        continued = False
        try:
            with self.assertRaisesRegex(FixtureRestorationError, 'SHA-256 mismatch'):
                with self.subTest(restore='silently-skipped'):
                    with self.assertRaises(AssertionError):
                        # A no-op write simulates a restore command that reports
                        # success while leaving the mutant on disk.
                        self.path.write_bytes(b'mutant')
                        with patch.object(Path, 'write_bytes', return_value=0):
                            with snapshot:
                                raise AssertionError('intended mutant rejection')
                    continued = True
            self.assertFalse(continued, 'contaminated execution must not continue')
        finally:
            snapshot.restore()


class PostprocessorContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='quartz-postprocessor-test-')
        cls.root = Path(cls.tmp.name)
        cls.public = cls.root / 'source/public'
        cls.content = cls.root / 'content'
        cls.public.mkdir(parents=True)
        cls.content.mkdir()
        (cls.public / 'index.html').write_text(INDEX)
        for stem in ('Game Over', 'Tree'):
            (cls.content / (stem + '.md')).write_text('\n---\nnoindex: true\n---\nPrivate')
            (cls.public / (stem.replace(' ', '-') + '.html')).write_text(
                DATED_HEAD.replace('</head>', '<meta name="robots" content="noindex, follow"/></head>') + '<article>Private</article>')
        cls.urls = ['https://bjjgraph.org/']
        (cls.public / 'Positions').mkdir()
        for n in range(3999):
            relative = f'Positions/P{n}'
            (cls.public / (relative + '.html')).write_text(DATED_HEAD + '<article>A position</article>')
            cls.urls.append('https://bjjgraph.org/' + relative)
        cls.sitemap = '<urlset>' + ''.join(f'<url><loc>{url}</loc></url>' for url in cls.urls) + '</urlset>'
        (cls.public / 'sitemap.xml').write_text(cls.sitemap)
        cls.source_slugs = ['index', 'Tree', 'Game-Over'] + [f'Positions/P{n}' for n in range(3999)]
        cls.eligible_paths = [cls.public / (slug + '.html') for slug in cls.source_slugs]
        (cls.public / 'static').mkdir()
        (cls.public / 'static/contentIndex.json').write_text(json.dumps({slug: {} for slug in cls.source_slugs}))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_gate(self):
        return subprocess.run([sys.executable, str(CHECK), '--public', str(self.public),
                               '--content', str(self.content)], capture_output=True, text=True)

    def mutation(self, relative, replacement, diagnostic):
        path = self.public / relative
        with FixtureSnapshot(path) as snapshot:
            path.write_text(replacement(snapshot.text(path)))
            result = self.run_gate()
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn(diagnostic, result.stderr)

    def test_complete_fixture_accepts_svg_title_and_reports_positive_counts(self):
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for count in ('11 literal shapes', '4000 sitemap URLs', '4002 article pages', '2 noindex pages'):
            self.assertIn(count, result.stdout)
        self.assertIn('check_affiliate_surface.py --built', result.stdout)

    def test_all_eligible_publications_absent_is_expected_pending(self):
        originals = FixtureSnapshot(*self.eligible_paths)
        try:
            for path in originals.before:
                original = originals.text(path)
                self.assertEqual(original.count(MODIFIED_TAG), 1)
                self.assertEqual(original.count(PUBLISHED_TAG), 1)
                path.write_text(original.replace(PUBLISHED_TAG, ''))
            result = self.run_gate()
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertIn('POSTPROCESSOR_CONTRACT_RESULT=pending', result.stdout.splitlines())
            self.assertIn('EXPECTED PENDING', result.stderr)
            self.assertIn('pending git-derived publication', result.stderr)
            self.assertIn('10/11', result.stderr)
            self.assertIn('0/4002', result.stdout)
            self.assertIn('modified: 4002/4002', result.stdout)
            self.assertNotIn('REAL FAILURE', result.stderr)
        finally:
            originals.restore()

    def assert_classifier(self, result, state):
        code = {'conforms': 0, 'failure': 1, 'pending': 2}[state]
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        verdicts = [line for line in result.stdout.splitlines()
                    if line.startswith('POSTPROCESSOR_CONTRACT_RESULT=')]
        self.assertEqual(verdicts, ['POSTPROCESSOR_CONTRACT_RESULT=' + state])
        if state == 'failure':
            self.assertIn('REAL FAILURE', result.stderr)
            self.assertNotIn('EXPECTED PENDING', result.stderr)
        elif state == 'pending':
            self.assertIn('EXPECTED PENDING', result.stderr)
            self.assertNotIn('REAL FAILURE', result.stderr)
        else:
            self.assertEqual(result.stderr, '')

    def without_all_publications(self):
        originals = FixtureSnapshot(*self.eligible_paths)
        try:
            for path in originals.before:
                original = originals.text(path)
                self.assertEqual(original.count(PUBLISHED_TAG), 1)
                path.write_text(original.replace(PUBLISHED_TAG, ''))
        except BaseException:
            originals.restore()
            raise
        return originals

    def restore_pages(self, originals):
        if originals is not None:
            originals.restore()

    def test_all_publications_present_is_conforming(self):
        result = self.run_gate()
        self.assert_classifier(result, 'conforms')
        self.assertIn('11 literal shapes', result.stdout)
        self.assertIn('4002/4002', result.stdout)
        self.assertIn('modified: 4002/4002', result.stdout)

    def test_partial_publication_in_either_direction_is_real_failure(self):
        for relative in ('index.html', 'Positions/P0.html'):
            with self.subTest(missing_only=relative):
                path = self.public / relative
                snapshot = FixtureSnapshot(path)
                try:
                    path.write_text(snapshot.text(path).replace(PUBLISHED_TAG, ''))
                    result = self.run_gate()
                    self.assert_classifier(result, 'failure')
                    self.assertIn('publication-coverage', result.stderr)
                    self.assertIn('4001/4002', result.stdout)
                finally:
                    snapshot.restore()
        originals = self.without_all_publications()
        try:
            (self.public / 'index.html').write_bytes(originals.before[self.public / 'index.html'])
            result = self.run_gate()
            self.assert_classifier(result, 'failure')
            self.assertIn('publication-coverage', result.stderr)
            self.assertIn('1/4002', result.stdout)
        finally:
            self.restore_pages(originals)

    def test_pending_cannot_hide_charset_article_noindex_or_sitemap_failure(self):
        originals = self.without_all_publications()
        mutations = (
            ('index.html', lambda text: text.replace('<meta charset="utf-8"/>', ''), 'charset'),
            ('Positions/P0.html', lambda text: text.replace('<article>', '<main>'), 'article-count'),
            ('Tree.html', lambda text: text.replace('noindex, follow', 'index, follow'), 'frontmatter-noindex'),
            ('sitemap.xml', lambda text: text.replace('<url><loc>' + self.urls[-1] + '</loc></url>', ''), 'sitemap-floor'),
        )
        try:
            for relative, mutate, diagnostic in mutations:
                with self.subTest(extra_failure=diagnostic):
                    path = self.public / relative
                    snapshot = FixtureSnapshot(path)
                    try:
                        path.write_text(mutate(snapshot.text(path)))
                        result = self.run_gate()
                        self.assert_classifier(result, 'failure')
                        self.assertIn(diagnostic, result.stderr)
                        self.assertIn('0/4002', result.stdout)
                    finally:
                        snapshot.restore()
        finally:
            self.restore_pages(originals)

    def test_missing_modified_is_real_failure_in_both_publication_states(self):
        target = self.public / 'Positions/P0.html'
        for all_absent in (False, True):
            originals = self.without_all_publications() if all_absent else None
            try:
                with FixtureSnapshot(target) as snapshot:
                    with self.subTest(all_publications_absent=all_absent):
                        target.write_text(snapshot.text(target).replace(MODIFIED_TAG, ''))
                        result = self.run_gate()
                        self.assert_classifier(result, 'failure')
                        self.assertIn('publication-modified', result.stderr)
                        self.assertIn('modified: 4001/4002', result.stdout)
            finally:
                self.restore_pages(originals)
        snapshot = FixtureSnapshot(target)
        try:
            target.write_text(snapshot.text(target).replace(MODIFIED_TAG, '').replace(PUBLISHED_TAG, ''))
            result = self.run_gate()
            self.assert_classifier(result, 'failure')
            self.assertIn('publication-modified', result.stderr)
            self.assertIn('4001/4002', result.stdout)
        finally:
            snapshot.restore()

    def test_malformed_duplicate_unknown_timestamps_cannot_be_pending(self):
        originals = self.without_all_publications()
        try:
            target = self.public / 'Positions/P0.html'
            pending_text = target.read_text()
            malformed = {
                'not-self-closing': PUBLISHED_TAG.replace('/>', '>'),
                'attribute-order': '<meta content="2026-09-20T00:00:00Z" property="article:published_time"/>',
                'single-quotes': PUBLISHED_TAG.replace('"', "'"),
                'duplicate-property-overwritten': PUBLISHED_TAG.replace('/>', ' property="og:title"/>'),
                'duplicate-content': PUBLISHED_TAG.replace('/>', ' content="another"/>'),
                'name-instead-of-property': PUBLISHED_TAG.replace('property=', 'name='),
                'duplicate-published': PUBLISHED_TAG + PUBLISHED_TAG,
                'unknown-article-time': PUBLISHED_TAG.replace('published_time', 'created_time'),
                'duplicate-modified': MODIFIED_TAG,
                'uppercase-tag': PUBLISHED_TAG.replace('<meta ', '<META '),
                'uppercase-property': PUBLISHED_TAG.replace('article:published_time', 'ARTICLE:PUBLISHED_TIME'),
                'extra-attribute': PUBLISHED_TAG.replace('/>', ' data-extra="1"/>'),
                'unterminated': '<meta property="article:published_time" content="broken',
            }
            self.assertEqual(len(malformed), 13)
            for label, tag in malformed.items():
                with self.subTest(mutant=label):
                    with FixtureSnapshot(target):
                        target.write_text(pending_text.replace('</head>', tag + '</head>'))
                        result = self.run_gate()
                        self.assert_classifier(result, 'failure')
                        self.assertIn('publication-', result.stderr)
        finally:
            self.restore_pages(originals)

    def test_misplaced_publication_cannot_be_pending(self):
        originals = self.without_all_publications()
        try:
            target = self.public / 'Positions/P0.html'
            pending_text = target.read_text()
            for label, suffix in (
                ('body', '<body>' + PUBLISHED_TAG + '</body>'),
                ('second-head', '<head>' + PUBLISHED_TAG + '</head>'),
            ):
                with self.subTest(misplaced=label):
                    with FixtureSnapshot(target):
                        target.write_text(pending_text + suffix)
                        result = self.run_gate()
                        self.assert_classifier(result, 'failure')
                        self.assertIn('publication-', result.stderr)
        finally:
            self.restore_pages(originals)

    def test_nonsemantic_publication_outside_head_remains_absent(self):
        originals = self.without_all_publications()
        try:
            target = self.public / 'Positions/P0.html'
            pending_text = target.read_text()
            for label, suffix in (
                ('comment', '<!--' + PUBLISHED_TAG + '-->'),
                ('script', '<script>' + PUBLISHED_TAG + '</script>'),
                ('escaped-code', '<pre><code>' + PUBLISHED_TAG.replace('<', '&lt;').replace('>', '&gt;') + '</code></pre>'),
            ):
                with self.subTest(nonsemantic=label):
                    with FixtureSnapshot(target):
                        target.write_text(pending_text + suffix)
                        result = self.run_gate()
                        self.assert_classifier(result, 'pending')
                        self.assertIn('0/4002', result.stdout)
        finally:
            self.restore_pages(originals)

    def test_missing_or_empty_content_index_is_real_failure(self):
        path = self.public / 'static/contentIndex.json'
        for payload in (None, '{}'):
            with self.subTest(payload=payload):
                with FixtureSnapshot(path):
                    if payload is None:
                        path.unlink()
                    else:
                        path.write_text(payload)
                    result = self.run_gate()
                    self.assert_classifier(result, 'failure')
                    self.assertIn('contentIndex.json' if payload is None else 'publication-index', result.stderr)

    def test_source_backed_folder_copy_cannot_lose_dates_or_disappear(self):
        source_index = self.public / 'static/contentIndex.json'
        folder = self.public / 'Positions/P0'
        child = folder / 'Child.html'
        copy = folder / 'index.html'
        baseline = FixtureSnapshot(source_index, child, copy)
        page = DATED_HEAD + '<article>Source-backed folder fixture</article>'
        try:
            folder.mkdir()
            child.write_text(page)
            copy.write_text(page)
            data = json.loads(baseline.text(source_index))
            data['Positions/P0/Child'] = {}
            source_index.write_text(json.dumps(data))
            result = self.run_gate()
            self.assert_classifier(result, 'conforms')
            self.assertIn('4004/4004', result.stdout)
            self.assertIn('1 additional folder copies', result.stdout)
            for label, mutant in (
                ('publication-missing', page.replace(PUBLISHED_TAG, '')),
                ('both-dates-missing', page.replace(PUBLISHED_TAG, '').replace(MODIFIED_TAG, '')),
                ('entire-copy-missing', None),
            ):
                with self.subTest(mutant=label):
                    with FixtureSnapshot(copy):
                        if mutant is None:
                            copy.unlink()
                        else:
                            copy.write_text(mutant)
                        result = self.run_gate()
                        self.assert_classifier(result, 'failure')
                        self.assertIn('publication-', result.stderr)
                        self.assertIn('4003/4004', result.stdout)
        finally:
            baseline.restore()
            try:
                if folder.exists():
                    folder.rmdir()
            except OSError as error:
                raise FixtureRestorationError(f'fixture folder cleanup failed: {folder}: {error}') from error
            if folder.exists():
                raise FixtureRestorationError(f'fixture folder cleanup failed: {folder}')

    def test_cli_pending_requires_each_source_pin_and_exact_revert_restores_it(self):
        originals = self.without_all_publications()
        try:
            with tempfile.TemporaryDirectory(prefix='quartz-pending-source-cli-') as tmp:
                root = Path(tmp)
                (root / 'scripts').mkdir()
                for name in ('check_postprocessor_contract.py', 'regenerate_agent_discovery.py'):
                    shutil.copyfile(ROOT / 'scripts' / name, root / 'scripts' / name)
                producers = ('source/quartz/components/Head.tsx', 'source/quartz/plugins/transformers/lastmod.ts')
                producer_bytes = {}
                for relative in producers:
                    target = root / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    producer_bytes[target] = (ROOT / relative).read_bytes()
                    target.write_bytes(producer_bytes[target])
                command = [sys.executable, '-B', str(root / 'scripts/check_postprocessor_contract.py'),
                           '--public', str(self.public), '--content', str(self.content)]

                def run_copied_gate():
                    return subprocess.run(command, cwd=root, capture_output=True, text=True)

                self.assert_classifier(run_copied_gate(), 'pending')
                for relative in producers:
                    with self.subTest(changed_producer=relative):
                        target = root / relative
                        snapshot = FixtureSnapshot(target)
                        try:
                            target.write_bytes(snapshot.before[target] + b'\n// fixture source-pin mutation\n')
                            result = run_copied_gate()
                            self.assert_classifier(result, 'failure')
                            self.assertIn('publication-pending-source', result.stderr)
                            self.assertIn(relative, result.stderr)
                            self.assertNotIn('ImportError', result.stderr)
                            self.assertNotIn('ModuleNotFoundError', result.stderr)
                        finally:
                            snapshot.restore()
                        # Intentional, documented non-kill until X-01 removes pending:
                        # restoring the exact reviewed source restores eligibility.
                        self.assert_classifier(run_copied_gate(), 'pending')
        finally:
            self.restore_pages(originals)

    def test_each_of_eleven_literal_shapes_is_required(self):
        cases = [
            ('charset', '<meta charset="utf-8"/>'),
            ('document-title', '<title>Study BJJ</title>'),
            ('canonical', '<link rel="canonical" href="https://bjjgraph.org/"/>'),
            ('og:title', '<meta property="og:title" content="Study BJJ"/>'),
            ('og:description', '<meta property="og:description" content="Study techniques"/>'),
            ('og:url', '<meta property="og:url" content="https://bjjgraph.org/"/>'),
            ('og:type', '<meta property="og:type" content="website"/>'),
            ('twitter:title', '<meta name="twitter:title" content="Study BJJ"/>'),
            ('twitter:description', '<meta name="twitter:description" content="Study techniques"/>'),
            ('description', '<meta name="description" content="Study techniques"/>'),
            ('article-times', '<meta property="article:published_time" content="2026-09-20T00:00:00Z"/>'),
        ]
        self.assertEqual(len(cases), 11)
        for name, literal in cases:
            with self.subTest(shape=name):
                self.mutation('index.html', lambda text, old=literal: text.replace(old, ''), name)

    def test_charset_self_closing_shape_is_literal(self):
        self.mutation('index.html', lambda text: text.replace('<meta charset="utf-8"/>', '<meta charset="utf-8">'), 'charset')

    def test_document_title_must_precede_inline_svg_title(self):
        self.mutation('index.html', lambda text: text.replace('<head>', '<head><svg><title>Before</title></svg>'), 'document-title')

    def test_duplicate_document_title_is_rejected(self):
        self.mutation('index.html', lambda text: text.replace('</head>', '<title>Extra</title></head>'), 'document-title')

    def test_missing_and_duplicate_articles_are_rejected(self):
        for replacement in ('<main>Lost</main>', '<article>One</article><article>Two</article>'):
            with self.subTest(replacement=replacement):
                self.mutation('Positions/P0.html', lambda text: replacement, 'article-count')

    def test_sitemap_floor_is_4000_not_1000(self):
        self.mutation('sitemap.xml', lambda text: text.replace('<url><loc>' + self.urls[-1] + '</loc></url>', ''), 'sitemap-floor')

    def test_zero_sitemap_coverage_is_rejected(self):
        self.mutation('sitemap.xml', lambda text: '<urlset/>', 'sitemap-floor')

    def test_duplicate_sitemap_entries_cannot_supply_the_floor(self):
        self.mutation('sitemap.xml', lambda text: text.replace(self.urls[-1] + '</loc>', self.urls[-2] + '</loc>'), 'sitemap-duplicate')

    def test_sitemap_target_must_exist(self):
        self.mutation('sitemap.xml', lambda text: text.replace(self.urls[-1] + '</loc>', 'https://bjjgraph.org/Positions/Missing</loc>'), 'sitemap-target')

    def test_frontmatter_noindex_cannot_disappear(self):
        for page in ('Tree.html', 'Game-Over.html'):
            with self.subTest(page=page):
                self.mutation(page, lambda text: text.replace('noindex', 'index'), 'frontmatter-noindex')

    def test_empty_source_cannot_report_noindex_agreement(self):
        other = self.content.with_name('empty-content')
        other.mkdir(exist_ok=True)
        result = subprocess.run([sys.executable, str(CHECK), '--public', str(self.public), '--content', str(other)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('source-coverage', result.stderr)

    def test_empty_noindex_set_cannot_report_agreement(self):
        sources = FixtureSnapshot(*self.content.glob('*.md'))
        try:
            for path in sources.before:
                path.write_text(sources.text(path).replace('noindex: true', 'noindex: false'))
            result = self.run_gate()
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('2 sources/0 noindex', result.stderr)
        finally:
            sources.restore()

    def test_only_named_article_exceptions_are_accepted(self):
        path = self.public / 'dev/index.html'
        path.parent.mkdir(exist_ok=True)
        with FixtureSnapshot(path):
            path.write_text('<html>Catalog</html>')
            result = self.run_gate()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('1 named article exception', result.stdout)
            unknown = path.with_name('unknown.html')
            with FixtureSnapshot(unknown):
                unknown.write_text('<html>Unexpected missing article</html>')
                result = self.run_gate()
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn('dev/unknown.html', result.stderr)

    def test_unchanged_share_shell_refuses_charset_mutant_then_keeps_svg_title(self):
        with tempfile.TemporaryDirectory(prefix='quartz-real-share-') as tmp:
            root = Path(tmp)
            (root / 'scripts').mkdir()
            shutil.copyfile(ROOT / 'scripts/build_share_shell.mjs', root / 'scripts/build_share_shell.mjs')
            public = root / 'source/public'
            (public / 'static/neural').mkdir(parents=True)
            (public / 'sitemap.xml').write_text(self.sitemap)
            (public / 'llms.txt').write_text('Public articles')
            (public / 'static/neural/graph-data.json').write_text(json.dumps({'nodes': [{'o': n, 't': f'Technique {n}'} for n in range(1000)]}))
            index = public / 'index.html'
            index.write_text(INDEX)
            command = ['node', str(root / 'scripts/build_share_shell.mjs')]
            with FixtureSnapshot(index) as snapshot:
                index.write_text(snapshot.text(index).replace('<meta charset="utf-8"/>', '<meta charset="utf-8">'))
                red = subprocess.run(command, capture_output=True, text=True)
                self.assertEqual(red.returncode, 1)
                self.assertIn('refusing to guess', red.stderr)
            green = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(green.returncode, 0, green.stderr)
            shell = (public / 'l.html').read_text()
            self.assertIn('<title data-share-title="1">', shell)
            self.assertIn('<svg><title>Search</title></svg>', shell)
            self.assertEqual(shell.count('data-share-og='), 5)


class PostprocessorPublicationEligibilityTest(unittest.TestCase):
    """Tiny API fixtures; eligibility comes from source keys, never date presence."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='quartz-publication-eligibility-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.public = self.root / 'public'
        (self.public / 'static').mkdir(parents=True)

    def source_index(self, slugs):
        (self.public / 'static/contentIndex.json').write_text(json.dumps({slug: {} for slug in slugs}))

    def test_parent_source_with_child_requires_its_folder_copy(self):
        self.source_index(['index', 'foo', 'foo/child'])
        paths, slugs, copies = postprocessor_contract._publication_paths(self.public)
        self.assertEqual(paths, {'index.html', 'foo.html', 'foo/child.html', 'foo/index.html'})
        self.assertEqual((slugs, copies), (3, 1))

    def test_authored_folder_index_is_counted_once(self):
        for include_flat in (False, True):
            with self.subTest(include_flat=include_flat):
                with FixtureSnapshot(self.public / 'static/contentIndex.json'):
                    keys = ['index', 'foo/index', 'foo/child'] + (['foo'] if include_flat else [])
                    self.source_index(keys)
                    paths, slugs, copies = postprocessor_contract._publication_paths(self.public)
                    expected = {'index.html', 'foo/index.html', 'foo/child.html'}
                    if include_flat:
                        expected.add('foo.html')
                    self.assertEqual(paths, expected)
                    self.assertEqual((slugs, copies), (len(keys), 0))

    def test_pure_folder_and_share_output_do_not_invent_source_eligibility(self):
        self.source_index(['index', 'foo/child'])
        (self.public / 'foo').mkdir()
        (self.public / 'foo/index.html').write_text('<article>Pure folder</article>')
        (self.public / 'l.html').write_text('<article>Share shell</article>')
        paths, slugs, copies = postprocessor_contract._publication_paths(self.public)
        self.assertEqual(paths, {'index.html', 'foo/child.html'})
        self.assertEqual((slugs, copies), (2, 0))

    def test_literal_dates_inside_comments_or_scripts_do_not_supply_coverage(self):
        for wrapper in ('<!--{}-->', '<script>{}</script>'):
            with self.subTest(wrapper=wrapper):
                errors = []
                status = postprocessor_contract._check_publication_page(
                    '<head>' + wrapper.format(MODIFIED_TAG + PUBLISHED_TAG) + '</head>',
                    'foo/index.html', errors)
                self.assertEqual(status, (False, False))
                self.assertTrue(any('publication-modified' in error for error in errors), errors)

    def test_semantic_publication_outside_first_head_is_real_error(self):
        baseline = '<head>' + MODIFIED_TAG + '</head><article>Fixture</article>'
        for label, suffix in (
            ('body', '<body>' + PUBLISHED_TAG + '</body>'),
            ('second-head', '<head>' + PUBLISHED_TAG + '</head>'),
        ):
            with self.subTest(misplaced=label):
                errors = []
                result = postprocessor_contract._check_publication_page(
                    baseline + suffix, 'fixture.html', errors)
                self.assertEqual(result, (True, False))
                self.assertTrue(errors, 'misplaced publication cannot masquerade as absence')
                self.assertTrue(any('publication-' in error for error in errors), errors)

    def test_nonsemantic_publication_outside_head_is_ignored(self):
        baseline = '<head>' + MODIFIED_TAG + '</head><article>Fixture</article>'
        for label, suffix in (
            ('comment', '<!--' + PUBLISHED_TAG + '-->'),
            ('script', '<script>' + PUBLISHED_TAG + '</script>'),
            ('escaped-code', '<pre><code>' + PUBLISHED_TAG.replace('<', '&lt;').replace('>', '&gt;') + '</code></pre>'),
        ):
            with self.subTest(nonsemantic=label):
                errors = []
                result = postprocessor_contract._check_publication_page(
                    baseline + suffix, 'fixture.html', errors)
                self.assertEqual(result, (True, False))
                self.assertEqual(errors, [])

    def test_unterminated_publication_is_malformed_not_absent(self):
        errors = []
        text = '<head>' + MODIFIED_TAG + '<meta property="article:published_time" content="broken</head>'
        result = postprocessor_contract._check_publication_page(text, 'fixture.html', errors)
        self.assertEqual(result, (True, False))
        self.assertTrue(any('publication-shape' in error for error in errors), errors)

    def test_pending_source_pin_rejects_each_changed_producer(self):
        producers = ('source/quartz/components/Head.tsx', 'source/quartz/plugins/transformers/lastmod.ts')
        originals = {}
        for relative in producers:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            originals[target] = (ROOT / relative).read_bytes()
            target.write_bytes(originals[target])
        self.assertEqual(postprocessor_contract._pending_source_errors(self.root), [])
        for relative in producers:
            with self.subTest(changed_producer=relative):
                target = self.root / relative
                snapshot = FixtureSnapshot(target)
                try:
                    target.write_bytes(snapshot.before[target] + b'\n// fixture source-pin mutation\n')
                    errors = postprocessor_contract._pending_source_errors(self.root)
                    self.assertTrue(errors)
                    self.assertTrue(any(relative in error and 'pending is unavailable' in error for error in errors), errors)
                finally:
                    snapshot.restore()


class PostprocessorFreshOutputTest(unittest.TestCase):
    """Independent of the 4,000-page fixture; each test uses one tiny temp tree."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='quartz-fresh-postprocessor-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.public = self.root / 'source/public'

    def write_input(self, relative, text):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    def copy_script(self, name):
        target = self.root / 'scripts' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'scripts' / name, target)
        if name == 'regenerate_redirects.py':
            shutil.copyfile(ROOT / 'scripts/_slug.py', target.with_name('_slug.py'))
        return target

    def run_script(self, script):
        return subprocess.run([sys.executable, '-B', str(script)], cwd=self.root,
                              capture_output=True, text=True, timeout=15)

    def fresh_output(self, script, output_name, verify):
        if self.public.exists():
            shutil.rmtree(self.public)
        output = self.public / output_name
        self.assertFalse(output.exists())
        result = self.run_script(script)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(output.is_file(), f'fresh output missing: {output_name}')
        verify(output.read_text(encoding='utf-8'))
        return result

    def kill_fresh_write_mutants(self, script, write_statement, output_name, verify):
        anchors = {'no-op': '    main()\n', 'write-deletion': write_statement}
        for label, anchor in anchors.items():
            with self.subTest(mutant=f'{script.stem}/{label}'):
                with FixtureSnapshot(script) as snapshot:
                    original = snapshot.text(script)
                    self.assertEqual(original.count(anchor), 1, f'dead mutant anchor: {label}')
                    script.write_text(original.replace(anchor, '    pass  # seeded mutant\n', 1))
                    # Syntax/runtime errors do NOT count: the script must exit 0,
                    # and the SAME positive-output assertion must go red.
                    with self.assertRaisesRegex(AssertionError, 'fresh output missing:'):
                        self.fresh_output(script, output_name, verify)
                    print(f'[fresh-postprocessor] RED {script.stem}/{label}: fresh output assertion rejected mutant')
        result = self.fresh_output(script, output_name, verify)
        print(f'[fresh-postprocessor] GREEN {script.stem}: fresh {output_name} verified')
        return result

    def test_fresh_headers_copy_kills_noop_and_write_deletion(self):
        expected = '/*\n  X-Content-Type-Options: nosniff\n/Positions/*\n  Cache-Control: public, max-age=300\n'
        self.write_input('source/quartz/static/_headers', expected)
        script = self.copy_script('regenerate_headers.py')
        result = self.kill_fresh_write_mutants(
            script, '    shutil.copyfile(CANONICAL, OUTPUT)\n', '_headers',
            lambda actual: self.assertEqual(actual, expected))
        self.assertIn('Wrote security headers', result.stdout)

    def test_missing_canonical_headers_fails_without_publishing(self):
        result = self.run_script(self.copy_script('regenerate_headers.py'))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('ERROR: canonical', result.stderr)
        self.assertIn('not found', result.stderr)
        self.assertFalse((self.public / '_headers').exists())

    def test_fresh_redirects_authored_alias_case_order_kills_write_mutants(self):
        self.write_input('source/quartz/static/_redirects',
                         '# Authored wins, even over aliases and case correction.\n'
                         '/rescue /Positions/Mount 301\n'
                         '/positions/mount /Positions/Authored-Wins 301\n'
                         '/positions/synonym /Positions/Authored-Alias 301\n'
                         '/rescue /Wrong-Duplicate 301\n')
        self.write_input('content/Positions/Mount.json', json.dumps({'aliases': ['Synonym', 'Old Mount']}))
        for name in ('Mount.md', 'Side Control.md', 'Mount/Top.md'):
            self.write_input('content/Positions/' + name, '# Fixture\n')
        expected = ['/rescue /Positions/Mount 301',
                    '/positions/mount /Positions/Authored-Wins 301',
                    '/positions/synonym /Positions/Authored-Alias 301',
                    '/positions/old-mount /Positions/Mount 301',
                    '/positions/side-control /Positions/Side-Control 301']
        script = self.copy_script('regenerate_redirects.py')
        result = self.kill_fresh_write_mutants(
            script, '    OUTPUT.write_text("\\n".join(rules) + "\\n")\n', '_redirects',
            lambda actual: self.assertEqual(actual.splitlines(), expected))
        self.assertIn('3 authored rule(s)', result.stdout)
        self.assertIn('1 alias 301 rule(s)', result.stdout)
        self.assertIn('Wrote 5 301 rules', result.stdout)

    def test_redirect_limit_accepts_2000_rejects_2001_and_kills_removed_guard(self):
        # 2,001 short lines in ONE input file; no corpus-sized filesystem fixture.
        canonical = self.write_input('source/quartz/static/_redirects', '')
        script = self.copy_script('regenerate_redirects.py')
        snapshot = FixtureSnapshot(script)
        original = snapshot.text(script)
        guard = '    if len(rules) > CLOUDFLARE_STATIC_RULE_LIMIT:\n'
        self.assertEqual(original.count(guard), 1, 'dead overflow mutant anchor')

        def populate(count):
            canonical.write_text(''.join(f'/old-{n} /new-{n} 301\n' for n in range(count)))
            if self.public.exists():
                shutil.rmtree(self.public)

        def assert_overflow_rejected():
            result = self.run_script(script)
            self.assertEqual(result.returncode, 1, 'overflow guard must reject 2001 rules')
            self.assertIn('2001 rules exceeds', result.stderr)
            self.assertIn('2000-static-rule limit', result.stderr)
            self.assertFalse((self.public / '_redirects').exists())

        with FixtureSnapshot(canonical):
            populate(2001)
            try:
                script.write_text(original.replace(guard, '    if False:  # seeded removed overflow guard\n', 1))
                with self.assertRaisesRegex(AssertionError, 'overflow guard must reject'):
                    assert_overflow_rejected()
                print('[fresh-postprocessor] RED redirects/removed-overflow-guard: 2001-rule assertion rejected mutant')
            finally:
                snapshot.restore()
        with FixtureSnapshot(canonical):
            populate(2000)
            result = self.run_script(script)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(len((self.public / '_redirects').read_text().splitlines()), 2000)
            self.assertIn('Wrote 2000 301 rules', result.stdout)
        with FixtureSnapshot(canonical):
            populate(2001)
            assert_overflow_rejected()
        print('[fresh-postprocessor] GREEN redirects boundary: 2000 accepted, 2001 rejected before write')

    def test_fresh_llms_listed_and_hub_only_categories_kill_write_mutants(self):
        inputs = {
            'Positions/Side Control': {'name': 'Side Control', 'summary': 'Top\ncontrol.'},
            'Principles/Frames': {'name': 'Frames', 'description': 'Use frames.'},
            'Systems/Study Plan': {'name': 'Study Plan', 'summary': 'Review a plan.'},
            'Learning/Safety': {'name': 'Safety'},
            'Transitions/Sweep': {'name': 'Unlisted individual sweep'},
            'Transitions/Pass': {'name': 'Unlisted individual pass'},
            'Submissions/Armbar': {'name': 'Unlisted individual armbar'},
        }
        for relative, value in inputs.items():
            self.write_input('content/' + relative + '.json', json.dumps(value))

        def verify(text):
            for line in (
                '- [Side Control](https://bjjgraph.org/Positions/Side-Control): Top control.',
                '- [Frames](https://bjjgraph.org/Principles/Frames): Use frames.',
                '- [Study Plan](https://bjjgraph.org/Systems/Study-Plan): Review a plan.',
                '- [Safety](https://bjjgraph.org/Learning/Safety)\n',
                '- [All transitions](https://bjjgraph.org/Transitions): 2 topics — browse the hub.',
                '- [All submissions](https://bjjgraph.org/Submissions): 1 topics — browse the hub.',
            ):
                self.assertIn(line, text)
            self.assertNotIn('Unlisted individual', text)
            self.assertNotIn('https://bjjgraph.org/Transitions/Sweep', text)
            self.assertNotIn('https://bjjgraph.org/Submissions/Armbar', text)

        result = self.kill_fresh_write_mutants(
            self.copy_script('regenerate_llms_txt.py'),
            '    OUTPUT.write_text("\\n".join(lines).rstrip() + "\\n", encoding="utf-8")\n',
            'llms.txt', verify)
        self.assertIn('4 listed pages + hubs', result.stdout)

    def assert_discovery_error_then_valid_homepage(self, url, diagnostic):
        self.write_input('source/public/index.html', '<title>Fixture home</title><article>Public study.</article>')
        self.write_input('source/quartz/static/robots.txt', 'User-agent: *\nAllow: /\n')
        for name, text in (('auth.md', '# Access\n'), ('api.md', '# Public API\n'), ('openapi.json', '{}\n')):
            self.write_input('site/' + name, text)
        sitemap = self.write_input('source/public/sitemap.xml', '<urlset><url><loc>https://bjjgraph.org/</loc></url></urlset>')
        script = self.copy_script('regenerate_agent_discovery.py')
        with FixtureSnapshot(sitemap):
            sitemap.write_text(f'<urlset><url><loc>{url}</loc></url></urlset>')
            red = self.run_script(script)
            self.assertEqual(red.returncode, 1, red.stdout + red.stderr)
            self.assertIn('ValueError: ' + diagnostic, red.stderr)
            self.assertFalse((self.public / 'site-index.json').exists())
        # Same copied consumer and verified original fixture: prove the failure
        # was the selected validation branch, not missing assets or a bad harness.
        green = self.run_script(script)
        self.assertEqual(green.returncode, 0, green.stdout + green.stderr)
        self.assertIn('1 public Markdown pages', green.stdout)
        self.assertIn('Public study.', (self.public / 'markdown/index.md').read_text())
        records = json.loads((self.public / 'site-index.json').read_text())['pages']
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['url'], 'https://bjjgraph.org/')

    def test_discovery_rejects_invalid_origin(self):
        self.assert_discovery_error_then_valid_homepage('https://other.invalid/', 'Unexpected sitemap origin:')

    def test_discovery_rejects_percent_encoded_unsafe_path(self):
        self.assert_discovery_error_then_valid_homepage('https://bjjgraph.org/Positions/%2e%2e/private', 'Unsafe sitemap path:')

    def test_discovery_rejects_missing_target(self):
        self.assert_discovery_error_then_valid_homepage('https://bjjgraph.org/Positions/Missing', 'Sitemap target missing:')


class PostprocessorWorkflowWrapperTest(unittest.TestCase):
    """Execute the checked-in e2e wrapper, not a copied shell implementation.

    Fourteen stub results exercise status/marker agreement and exact uniqueness.
    A separate real-Python missing-file control proves interpreter exit 2 cannot
    masquerade as pending. These are tiny shell fixtures, not site builds.
    """

    def setUp(self):
        import yaml

        workflow = yaml.safe_load(
            (ROOT / '.github/workflows/e2e-full.yml').read_text(encoding='utf-8'))
        matches = [
            step
            for job in workflow['jobs'].values()
            for step in job.get('steps', [])
            if step.get('name') == 'Postprocessor input contract'
        ]
        self.assertEqual(len(matches), 1, 'expected exactly one contract workflow step')
        step = matches[0]
        self.assertNotIn('continue-on-error', step)
        self.wrapper = step['run']
        self.assertIsInstance(self.wrapper, str)
        for marker in ('POSTPROCESSOR_CONTRACT_RESULT=',
                       'POSTPROCESSOR_CONTRACT_RESULT=conforms',
                       'POSTPROCESSOR_CONTRACT_RESULT=pending'):
            self.assertIn(marker, self.wrapper)
        self.tmp = tempfile.TemporaryDirectory(prefix='quartz-contract-wrapper-')
        self.addCleanup(self.tmp.cleanup)
        self.cwd = Path(self.tmp.name)
        self.assertFalse((self.cwd / 'scripts').exists())

    def run_wrapper(self, status=None, output=''):
        import os

        environment = dict(os.environ)
        prefix = ''
        if status is not None:
            environment['F_CONTRACT_STUB_STATUS'] = str(status)
            environment['F_CONTRACT_STUB_OUTPUT'] = output
            prefix = '''python3() {
  printf '%s' "$F_CONTRACT_STUB_OUTPUT"
  return "$F_CONTRACT_STUB_STATUS"
}
'''
        return subprocess.run(
            ['bash', '-e', '-o', 'pipefail', '-c', prefix + self.wrapper],
            cwd=self.cwd, env=environment, capture_output=True, text=True,
            timeout=10)

    def test_literal_workflow_accepts_only_matching_unique_results(self):
        conforms = 'POSTPROCESSOR_CONTRACT_RESULT=conforms'
        pending = 'POSTPROCESSOR_CONTRACT_RESULT=pending'
        cases = [
            ('conforms', 0, conforms + '\n', 0),
            ('pending', 2, pending + '\n', 0),
            ('failure-even-with-pending-marker', 1, pending + '\n', 1),
            ('exit-two-without-marker', 2, 'Python did not start\n', 1),
            ('exit-zero-without-marker', 0, 'No classification\n', 1),
            ('unexpected-exit-three', 3, conforms + '\n', 1),
            ('zero-with-wrong-pending-marker', 0, pending + '\n', 1),
            ('two-with-wrong-conforms-marker', 2, conforms + '\n', 1),
            ('duplicate-marker', 0, conforms + '\n' + conforms + '\n', 1),
            ('unknown-marker', 0, 'POSTPROCESSOR_CONTRACT_RESULT=unknown\n', 1),
            ('leading-whitespace-marker', 2, ' ' + pending + '\n', 1),
            ('trailing-whitespace-marker', 2, pending + ' \n', 1),
            ('partial-marker', 2, 'POSTPROCESSOR_CONTRACT_RESUL=pending\n', 1),
            ('conforms-without-final-newline', 0, conforms, 0),
        ]
        self.assertEqual(len(cases), 14)
        for name, status, output, expected in cases:
            with self.subTest(case=name):
                result = self.run_wrapper(status, output)
                diagnostic = result.stdout + result.stderr
                self.assertEqual(result.returncode, expected, diagnostic)
                self.assertIn(output, result.stdout, 'combined gate log must be retained')
                if name == 'pending':
                    self.assertIn('::notice::', result.stdout)
                    self.assertNotIn('::error::', result.stdout)
                elif expected == 0:
                    self.assertNotIn('::notice::', result.stdout)
                    self.assertNotIn('::error::', result.stdout)
                else:
                    self.assertIn('::error::', result.stdout)
                    self.assertNotIn('::notice::', result.stdout)

    def test_literal_workflow_rejects_real_python_missing_file_exit_two(self):
        python = shutil.which('python3')
        self.assertIsNotNone(python)
        control = subprocess.run(
            [python, 'scripts/check_postprocessor_contract.py'],
            cwd=self.cwd, capture_output=True, text=True, timeout=10)
        self.assertEqual(control.returncode, 2, control.stdout + control.stderr)
        self.assertNotIn('POSTPROCESSOR_CONTRACT_RESULT=',
                         control.stdout + control.stderr)
        result = self.run_wrapper()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('::error::', result.stdout)
        self.assertNotIn('::notice::', result.stdout)


if __name__ == '__main__':
    unittest.main()
