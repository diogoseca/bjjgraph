"""Exercise the exported reading surface with built-HTML fixtures (stdlib only)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.parse import urlsplit, unquote
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from regenerate_agent_discovery import generate, ROOT


class DiscoveryTest(unittest.TestCase):
    def test_published_article_export_and_root_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            public = Path(directory)
            (public / "Positions").mkdir()
            (public / "index.html").write_text('<title>BJJ Graph</title><article><h2>Study after class</h2><p>Free study tools.</p></article>')
            (public / "Positions/Mount.html").write_text('''<title>Mount</title>
            <nav>do not export navigation<svg><title>Search</title></svg></nav><article><h2>Escapes<a aria-hidden="true" href="#escapes">icon</a></h2>
            <p>Read <a href="../Learning">learning articles</a> &amp; <strong>practice</strong>.</p>
            <table><thead><tr><th>Option</th><th>Outcome</th></tr></thead><tbody><tr><td>Bridge</td><td>Guard</td></tr></tbody></table>
            <ul><li>Frame<ul><li>Then move</li></ul></li></ul>
            <p>Affiliate disclosure remains visible. <a href="https://example.com/course?ref=fixture">Course</a></p>
            <script>secret script</script><div hidden>hidden</div></article><footer>do not export footer</footer>''')
            (public / "Game-Over.html").write_text('<meta name="robots" content="noindex, follow"><article>Not public</article>')
            (public / "sitemap.xml").write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>https://bjjgraph.org/{p}</loc></url>' for p in ('', 'Positions/Mount', 'Game-Over')) + '</urlset>')
            generate(public)
            self.assertIn('User-agent:', (public / 'robots.txt').read_text())
            article = (public / 'markdown/Positions/Mount.md').read_text()
            for part in ('## Escapes', 'https://bjjgraph.org/Learning', '**practice**', '| Option | Outcome |', '| Bridge | Guard |', 'Then move', 'Affiliate disclosure', 'https://example.com/course?ref=fixture'):
                self.assertIn(part, article)
            for part in ('secret script', 'do not export', 'icon', 'hidden'):
                self.assertNotIn(part, article)
            self.assertNotIn('Game-Over', (public / 'sitemap.xml').read_text())
            records = json.loads((public / 'site-index.json').read_text())['pages']
            self.assertEqual(len(records), 2)
            self.assertEqual(records[1]['title'], 'Mount')
            self.assertTrue(article.startswith('# Mount\n'))
            for record in records:
                self.assertTrue((public / unquote(urlsplit(record['markdown']).path).lstrip('/')).is_file())
            catalog = json.loads((public / '.well-known/api-catalog').read_text())
            self.assertIn('service-desc', catalog['linkset'][0])
            schema = json.loads((public / 'openapi.json').read_text())
            self.assertEqual(schema['security'], [])
            self.assertTrue(all(set(item) == {'get'} for item in schema['paths'].values()))
            routes = json.loads((public / '_routes.json').read_text())
            for path in ('/', '/Positions', '/Positions/*', '/l/*', '/ping', '/unsubscribe'):
                self.assertIn(path, routes['include'])
            self.assertNotIn('/*', routes['include'])
            # A rerun cannot leave an old article available after it becomes noindex.
            (public / 'Positions/Mount.html').write_text('<meta name="robots" content="noindex"><article>Private now</article>')
            generate(public)
            self.assertFalse((public / 'markdown/Positions/Mount.md').exists())

    def test_all_retrieval_bots_share_public_access_and_exclusions(self):
        robots = RobotFileParser()
        robots.parse((ROOT / 'source/quartz/static/robots.txt').read_text().splitlines())
        for bot in ('Googlebot', 'bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'unknown'):
            for path in ('/', '/Positions/Mount', '/markdown/Positions/Mount.md', '/static/neural/app/neural.js'):
                self.assertTrue(robots.can_fetch(bot, path), (bot, path))
            for path in ('/private/profile', '/dev/screens', '/l/abc', '/unsubscribe?token=x', '/ping'):
                self.assertFalse(robots.can_fetch(bot, path), (bot, path))


if __name__ == '__main__':
    unittest.main()
