"""Real CLI mutation specs for the post-processor input boundary.

Kills: every one of the eleven index literal shapes; SVG/document-title confusion;
missing/duplicate articles; sitemap zero/below-floor/missing target; missing noindex
and missing source coverage; unknown article-free artifacts. No surviving seeded
mutants. Marker preservation belongs to system_affiliates.py, not this gate.
The unchanged share-shell is also executed; this is not a copied renderer.
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


if __name__ == '__main__':
    unittest.main()
