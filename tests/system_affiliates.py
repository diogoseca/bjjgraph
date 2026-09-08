"""Exercise rendered links and actual build stamping without contacting the vendor."""
import copy
import gzip
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import apply_affiliate_ref as affiliate
import regenerate_md_from_json as pages
import regenerate_neural_data as neural
from check_affiliate_surface import canonical_disclosure


class SystemAffiliates(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'content/Systems/Danaher Leg Lock System.json').read_text())
        self.template = pages.load_template('Systems', 'Systems.md.jinja2')

    def render(self, data):
        return pages.generate_markdown(data, self.template, resolve_fn=lambda name: name)

    def test_three_contextual_links_preserve_product_ref_and_campaign(self):
        rendered = self.render(self.data)
        anchors = re.findall(r'<a\b[^>]*data-affiliate="true"[^>]*>', rendered)
        self.assertEqual(len(anchors), 3)
        for anchor in anchors:
            url = urlsplit(re.search(r'href="([^"]+)"', anchor)[1])
            self.assertEqual(url.netloc, 'bjjfanatics.com')
            self.assertEqual(url.path, '/products/leglocks-enter-the-system-by-john-danaher')
            self.assertEqual(parse_qs(url.query)['rfsn'], ['REPLACE_ME'])
            self.assertNotIn('ref', parse_qs(url.query))
            self.assertEqual(parse_qs(url.query)['utm_campaign'], ['systems'])
        self.assertIn(self.data['products'][0]['study_focus'], rendered)
        self.assertIn(self.data['products'][0]['practice_tip'], rendered)

    def test_dead_unverified_and_missing_status_render_no_links_on_either_surface(self):
        for status in ['dead', 'unverified', None]:
            data = copy.deepcopy(self.data)
            if status is None:
                del data['products'][0]['link_status']
            else:
                data['products'][0]['link_status'] = status
            rendered = self.render(data)
            self.assertNotIn('data-affiliate="true"', rendered)
            self.assertNotIn('class="affiliate-disclosure"', rendered)
            self.assertIn('id="study-this-system"', rendered)
            self.assertEqual(neural._products(data, data['name']), [])

    def test_every_generated_cta_has_its_own_proximate_disclosure(self):
        total = 0
        expected = 3 * sum(any(p.get('link_status') == 'live' for p in json.loads(path.read_text()).get('products', []))
                           for path in (ROOT / 'content/Systems').glob('*.json'))
        self.assertGreater(expected, 0)
        for path in (ROOT / 'content/Systems').glob('*.md'):
            text = path.read_text()
            for section in re.findall(r'<section\b[^>]*>.*?</section>', text, re.S):
                if 'data-affiliate="true"' not in section:
                    continue
                total += 1
                self.assertIn('class="affiliate-disclosure"', section, path.name)
                self.assertIn(canonical_disclosure(), section, path.name)
                self.assertLess(section.index('class="affiliate-disclosure"'), section.index('data-affiliate="true"'))
                self.assertNotIn('<details', section)
        self.assertEqual(total, expected)

    def test_product_study_guidance_reaches_the_app(self):
        product = neural._products(self.data, self.data['name'])[0]
        for key in ('blurb', 'best_for', 'study_focus', 'practice_tip'):
            self.assertEqual(product[key], self.data['products'][0][key])

    def test_stamp_keeps_deep_link_and_gzip_in_sync_without_touching_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with patch.object(affiliate, 'PROJECT_ROOT', root), patch.object(affiliate, 'CONTENT_DIR', root / 'content'):
                page = root / 'system.html'
                original = self.render(self.data)
                page.write_text(original)
                compressed = page.with_suffix('.html.gz')
                compressed.write_bytes(gzip.compress(original.encode()))
                self.assertEqual(affiliate.stamp(page, '12345.test', True), 3)
                self.assertEqual(page.read_text(), original)
                self.assertEqual(affiliate.stamp(page, '12345.test', False), 3)
                self.assertIn('/products/leglocks-enter-the-system-by-john-danaher?rfsn=12345.test&', page.read_text())
                self.assertEqual(gzip.decompress(compressed.read_bytes()).decode(), page.read_text())
                source = root / 'content/Systems/source.json'
                source.parent.mkdir(parents=True)
                source.write_text('REPLACE_ME')
                with self.assertRaises(SystemExit):
                    affiliate.stamp(source, '12345.test', False)
                self.assertEqual(source.read_text(), 'REPLACE_ME')

    def test_local_configuration_is_data_and_environment_takes_precedence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.env').write_text('UNRELATED=$(exit 1)\nAFFILIATE_REF="12345.test"\n')
            with patch.object(affiliate, 'PROJECT_ROOT', root), patch.dict(os.environ, {}, clear=True):
                self.assertEqual(affiliate.configured_ref(), '12345.test')
                os.environ['AFFILIATE_REF'] = '98765.ci'
                self.assertEqual(affiliate.configured_ref(), '98765.ci')
                os.environ['AFFILIATE_REF'] = ''
                self.assertEqual(affiliate.configured_ref(), '')
        for bad in ('x&ref=y', '"><script>', 'x\ny'):
            self.assertIsNone(affiliate.REF_RE.fullmatch(bad))


if __name__ == '__main__':
    unittest.main()
