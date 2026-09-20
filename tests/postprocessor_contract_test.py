"""Real CLI mutation specs for the post-processor input boundary.

Kills: every one of the eleven index literal shapes; SVG/document-title confusion;
missing/duplicate articles; sitemap zero/below-floor/missing target; missing noindex
and missing source coverage; unknown article-free artifacts. No surviving seeded
mutants. Marker preservation belongs to system_affiliates.py, not this gate.
The unchanged share-shell is also executed; this is not a copied renderer.

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
import json
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / 'scripts/check_postprocessor_contract.py'
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
                '<meta name="robots" content="noindex, follow"/><article>Private</article>')
        cls.urls = ['https://bjjgraph.org/']
        (cls.public / 'Positions').mkdir()
        for n in range(3999):
            relative = f'Positions/P{n}'
            (cls.public / (relative + '.html')).write_text('<article>A position</article>')
            cls.urls.append('https://bjjgraph.org/' + relative)
        cls.sitemap = '<urlset>' + ''.join(f'<url><loc>{url}</loc></url>' for url in cls.urls) + '</urlset>'
        (cls.public / 'sitemap.xml').write_text(cls.sitemap)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_gate(self):
        return subprocess.run([sys.executable, str(CHECK), '--public', str(self.public),
                               '--content', str(self.content)], capture_output=True, text=True)

    def mutation(self, relative, replacement, diagnostic):
        path = self.public / relative
        original = path.read_text()
        path.write_text(replacement(original))
        try:
            result = self.run_gate()
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn(diagnostic, result.stderr)
        finally:
            path.write_text(original)

    def test_complete_fixture_accepts_svg_title_and_reports_positive_counts(self):
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for count in ('11 literal shapes', '4000 sitemap URLs', '4002 article pages', '2 noindex pages'):
            self.assertIn(count, result.stdout)
        self.assertIn('check_affiliate_surface.py --built', result.stdout)

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
        sources = {path: path.read_text() for path in self.content.glob('*.md')}
        try:
            for path, original in sources.items():
                path.write_text(original.replace('noindex: true', 'noindex: false'))
            result = self.run_gate()
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('2 sources/0 noindex', result.stderr)
        finally:
            for path, original in sources.items():
                path.write_text(original)

    def test_only_named_article_exceptions_are_accepted(self):
        path = self.public / 'dev/index.html'
        path.parent.mkdir(exist_ok=True)
        path.write_text('<html>Catalog</html>')
        try:
            result = self.run_gate()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('1 named article exception', result.stdout)
            unknown = path.with_name('unknown.html')
            unknown.write_text('<html>Unexpected missing article</html>')
            try:
                result = self.run_gate()
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn('dev/unknown.html', result.stderr)
            finally:
                unknown.unlink()
        finally:
            path.unlink()

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
            index.write_text(INDEX.replace('<meta charset="utf-8"/>', '<meta charset="utf-8">'))
            command = ['node', str(root / 'scripts/build_share_shell.mjs')]
            red = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(red.returncode, 1)
            self.assertIn('refusing to guess', red.stderr)
            index.write_text(INDEX)
            green = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(green.returncode, 0, green.stderr)
            shell = (public / 'l.html').read_text()
            self.assertIn('<title data-share-title="1">', shell)
            self.assertIn('<svg><title>Search</title></svg>', shell)
            self.assertEqual(shell.count('data-share-og='), 5)


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
        original = script.read_text()
        anchors = {'no-op': '    main()\n', 'write-deletion': write_statement}
        try:
            for label, anchor in anchors.items():
                with self.subTest(mutant=f'{script.stem}/{label}'):
                    self.assertEqual(original.count(anchor), 1, f'dead mutant anchor: {label}')
                    script.write_text(original.replace(anchor, '    pass  # seeded mutant\n', 1))
                    # Syntax/runtime errors do NOT count: the script must exit 0,
                    # and the SAME positive-output assertion must go red.
                    with self.assertRaisesRegex(AssertionError, 'fresh output missing:'):
                        self.fresh_output(script, output_name, verify)
                    print(f'[fresh-postprocessor] RED {script.stem}/{label}: fresh output assertion rejected mutant')
        finally:
            script.write_text(original)
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
        original = script.read_text()
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

        populate(2001)
        try:
            script.write_text(original.replace(guard, '    if False:  # seeded removed overflow guard\n', 1))
            with self.assertRaisesRegex(AssertionError, 'overflow guard must reject'):
                assert_overflow_rejected()
            print('[fresh-postprocessor] RED redirects/removed-overflow-guard: 2001-rule assertion rejected mutant')
        finally:
            script.write_text(original)
        populate(2000)
        result = self.run_script(script)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(len((self.public / '_redirects').read_text().splitlines()), 2000)
        self.assertIn('Wrote 2000 301 rules', result.stdout)
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
        sitemap = self.write_input('source/public/sitemap.xml', f'<urlset><url><loc>{url}</loc></url></urlset>')
        script = self.copy_script('regenerate_agent_discovery.py')
        red = self.run_script(script)
        self.assertEqual(red.returncode, 1, red.stdout + red.stderr)
        self.assertIn('ValueError: ' + diagnostic, red.stderr)
        self.assertFalse((self.public / 'site-index.json').exists())
        # Same copied consumer and fixture, repaired URL: prove the failure was
        # the selected validation branch, not missing assets or a broken harness.
        sitemap.write_text('<urlset><url><loc>https://bjjgraph.org/</loc></url></urlset>')
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


if __name__ == '__main__':
    unittest.main()
