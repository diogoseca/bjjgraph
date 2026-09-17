"""Offline fixture checks of neutral generation and actual emitted referral resolution."""
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
from system_guides import fixture
import apply_affiliate_ref as affiliate
import regenerate_md_from_json as pages
import regenerate_neural_data as neural
import check_affiliate_surface as gate
from regenerate_agent_discovery import ArticleParser, render as discovery_render


class SystemAffiliates(unittest.TestCase):
    def setUp(self):
        self.data = fixture()
        self.data['products'][0].update(blurb='Published course scope.', best_for='Readers comparing syllabuses.', study_focus='Read the chapter list.', practice_tip='Note a study question.')
        self.template = pages.load_template('Systems', 'Systems.md.jinja2')

    def render(self, data=None):
        return pages.generate_markdown(data or self.data, self.template, resolve_fn=lambda name: name)

    def assert_gate(self, text, ref=''):
        errors=[]; count=gate.check_html(text, 'fixture', errors, bool(ref), ref)
        self.assertGreater(count,0); self.assertEqual(errors,[])

    def test_neutral_source_course_order_and_single_overview(self):
        text=self.render()
        self.assertEqual(text.count('data-course-url='),2)
        self.assertNotIn('affiliate-disclosure',text); self.assertNotIn('commission',text)
        self.assertNotIn('REPLACE_ME',text); self.assertNotIn('utm_',text)
        for part in ('Independent BJJGraph','Not authored or endorsed','Coverage and limits', 'Sources', 'Review related technique cards'):
            self.assertIn(part,text)
        for old in ('How to Measure Your Progress','Mark whole system as known','Core Principles'):
            self.assertNotIn(old,text)
        for anchor in ('implementation-sequence','training-methodology','key-principles','key-components','common-obstacles','assessment-metrics'):
            self.assertIn('id="'+anchor+'"',text)
        self.assertEqual(text.count(self.data['overview']),1);self.assertNotIn(self.data['summary'],text)
        self.assertNotIn('Start here',text)
        markers=['Back to Systems','system-heading','data-course-placement="top"','id="overview"','id="fit"','id="coverage"','data-course-placement="end"','id="related-content"','id="sources"']
        self.assertEqual(sorted(text.index(m) for m in markers),[text.index(m) for m in markers])
        self.assert_gate(text)

    def test_unavailable_courses_do_not_render(self):
        for status in ('dead','unverified',None):
            d=copy.deepcopy(self.data); d['products'][0]['link_status']=status
            self.assertNotIn('data-course-url',self.render(d)); self.assertEqual(neural._products(d,d['name']),[])
        d=copy.deepcopy(self.data); d['products'][0]['course_url']+='?rfsn=REPLACE_ME'
        self.assertNotIn('data-course-url',self.render(d)); self.assertEqual(neural._products(d,d['name']),[])

    def test_legacy_body_fallback_without_scaffolding_for_new_guides(self):
        d=copy.deepcopy(self.data); del d['guide']; d['key_principles']=['Read the context.']
        self.assertIn('Read the context.',self.render(d)); self.assertIn('points',neural._system_body(d))
        self.assertNotIn('How to Measure Your Progress',self.render(d))
        d['guide']=self.data['guide']; self.assertNotIn('Read the context.',self.render(d))

    def test_activate_rotate_remove_and_gzip_repair(self):
        with tempfile.TemporaryDirectory() as tmp:
            page=Path(tmp)/'guide.html'; original=self.render(); page.write_text(original)
            sibling=page.with_suffix('.html.gz'); sibling.write_bytes(gzip.compress(original.encode()))
            self.assertEqual(affiliate.stamp(page,'12345.test',True),1); self.assertEqual(page.read_text(),original)
            for ref in ('12345.test','98765.rotated',''):
                affiliate.stamp(page,ref)
                self.assert_gate(page.read_text(),ref)
                self.assertEqual(gzip.decompress(sibling.read_bytes()).decode(),page.read_text())
                before=page.read_bytes(); self.assertEqual(affiliate.stamp(page,ref),0); self.assertEqual(page.read_bytes(),before)
                self.assertEqual(page.read_text().count(gate.canonical_disclosure()),3 if ref else 0)
            sibling.write_bytes(gzip.compress(b'stale'))
            self.assertEqual(affiliate.stamp(page,''),1)
            self.assertEqual(gzip.decompress(sibling.read_bytes()).decode(),page.read_text())

    def test_gordon_route_and_both_historic_placeholders(self):
        canonical='https://bjjfanatics.com/products/systematically-attacking-from-top-pins-mount-by-gordon-ryan'
        d=copy.deepcopy(self.data); d['name']='Gordon Ryan Mount Control System'; d['products'][0]['course_url']=canonical
        with tempfile.TemporaryDirectory() as tmp:
            route=Path(tmp)/'Systems/Gordon-Ryan-Mount-Control-System.html';route.parent.mkdir();route.write_text(self.render(d))
            affiliate.stamp(route,'12345.test'); html=route.read_text(); self.assert_gate(html,'12345.test')
            anchor=re.search(r'<a\b[^>]*data-course-url[^>]*>',html)[0]; attrs=affiliate.read_tag(anchor)
            url=urlsplit(attrs['href']); self.assertEqual(url.path,urlsplit(canonical).path)
            query=parse_qs(url.query);self.assertEqual(query['rfsn'],['12345.test']);self.assertEqual(query['utm_content'],['gordon-ryan-mount-control-system'])
            for param in ('ref','rfsn'):
                stale=f'<section data-system-guide><p class="affiliate-disclosure">{gate.canonical_disclosure()}</p><a data-affiliate="true" rel="sponsored" href="{canonical}?{param}=REPLACE_ME">Course</a></section>'
                for ref in ('','12345.test'):
                    route.write_text(stale); affiliate.stamp(route,ref)
                    output=route.read_text();self.assertNotIn('REPLACE_ME',output);self.assert_gate(output,ref)
                    if not ref:self.assertNotIn('commission',output);self.assertIn(f'href="{canonical}"',output)
                payload=Path(tmp)/'legacy.json';payload.write_text(json.dumps({'products':[{'url':canonical+f'?{param}=REPLACE_ME'}]}));affiliate.stamp(payload,'')
                self.assertFalse(json.loads(payload.read_text())['products'][0]['affiliate'])

    def test_neutral_product_wire_and_canonical_json_rotation(self):
        product=neural._products(self.data,self.data['name'])[0]
        for key in ('blurb','best_for','study_focus','practice_tip'):self.assertEqual(product[key],self.data['products'][0][key])
        self.assertEqual(product['url'],product['course_url']);self.assertIs(product['affiliate'],False)
        data={'systems':[{'name':self.data['name'],'products':[product]}]}
        for ref in ('12345.test','67890.rotated',''):
            data=affiliate.resolve_json(data,ref); p=data['systems'][0]['products'][0]
            self.assertEqual(p['affiliate'],bool(ref));self.assertEqual(p['course_url'],product['course_url'])
            self.assertEqual(affiliate.resolve_json(data,ref),data)
            if ref:self.assertEqual(parse_qs(urlsplit(p['url']).query)['rfsn'],[ref])
            else:self.assertEqual(p['url'],product['course_url'])

    def test_discovery_export_after_stamp_remains_resolvable(self):
        html=affiliate.resolve_html(self.render(),'12345.test')
        parser=ArticleParser();parser.feed('<article>'+html+'</article>')
        markdown=discovery_render(parser.article,'https://bjjgraph.org/Systems/Fixture-System')
        self.assertIn('data-course-url',markdown);self.assertIn(gate.canonical_disclosure(),markdown)
        self.assertNotIn('Start here:',markdown);self.assertIn('Sources',markdown);self.assertIn('data-source-url',markdown)
        for ref in ('12345.test','67890.rotated',''):
            markdown=affiliate.resolve_html(markdown,ref);self.assert_gate(markdown,ref)
            self.assertEqual(markdown.count(gate.canonical_disclosure()),3*int(bool(ref)))

    def test_built_gate_checks_final_discovery_markdown_and_json_with_positive_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);public=root/'public';public.mkdir()
            page=public/'guide.html';page.write_text(self.render())
            index=public/'systems.json';index.write_text(json.dumps({'systems':[{'name':self.data['name'],'products':neural._products(self.data,self.data['name'])}]}))
            with patch.object(affiliate,'PUBLIC_DIR',public),patch.object(affiliate,'NEURAL_SYSTEMS',root/'absent.json'),patch.object(gate,'PROJECT_ROOT',root):
                for ref in ('12345.test',''):
                    affiliate.stamp(page,ref);affiliate.stamp(index,ref)
                    parser=ArticleParser();parser.feed('<article>'+page.read_text()+'</article>')
                    article=public/'markdown/Systems/Fixture-System.md';article.parent.mkdir(parents=True,exist_ok=True)
                    article.write_text(discovery_render(parser.article,'https://bjjgraph.org/Systems/Fixture-System'))
                    affiliate.stamp(article,ref)
                    errors=[];counts=gate.check_built(errors,ref)
                    self.assertEqual(errors,[]);self.assertEqual(counts,(2,6,1))
                    good=article.read_text();article.write_text(good.replace('data-affiliate="'+str(bool(ref)).lower()+'"','data-affiliate="wrong"'))
                    errors=[];gate.check_built(errors,ref);self.assertTrue(any('Fixture-System.md' in e for e in errors))
                    article.write_text(good)
                stale=public/'feed.txt';stale.write_text('https://bjjfanatics.com/products/example?rfsn=old.token&utm_source=bjjgraph')
                affiliate.stamp(stale,'');self.assertEqual(stale.read_text(),'https://bjjfanatics.com/products/example')

    def test_source_paths_queries_host_allowlist_and_rich_chunks(self):
        canonical='https://www.bjjfanatics.com/blogs/techniques/guard?q=a%2Bb&space=a%20b&tag=one&tag=two&empty=#chapter'
        from urllib.parse import parse_qsl
        expected=parse_qsl(urlsplit(canonical).query,keep_blank_values=True)
        for ref in ('12345.test','98765.rotated',''):
            resolved,active=affiliate.affiliate_url(canonical,ref,'fixture','blog')
            u=urlsplit(resolved)
            self.assertEqual(u.path,'/blogs/techniques/guard');self.assertEqual(u.fragment,'chapter')
            actual=[(k,v) for k,v in parse_qsl(u.query,keep_blank_values=True) if k not in ('rfsn','utm_source','utm_medium','utm_campaign','utm_content','utm_term')]
            self.assertEqual(actual,expected);self.assertEqual(active,bool(ref))
            if not ref:self.assertEqual(resolved,canonical)
        for url in ('https://bjjfanatics.com.evil.test/blogs/post','https://other.test/blogs/post','https://bjjfanatics.com:444/blogs/post'):
            self.assertEqual(affiliate.affiliate_url(url,'12345.test'),(url,False))
        self.assertEqual(affiliate.affiliate_url('https://evil@bjjfanatics.com/blogs/post','12345.test'),('',False))
        data=copy.deepcopy(self.data);data['guide']['sources'].append({'id':'blog','url':canonical,'title':'Primary blog','kind':'public_instruction','checked_on':'2026-09-01','note':'Inspected scope.'})
        body=neural._system_body(data)
        wire={'fixture':{'cat':'System','name':data['name'],**body}}
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); neural_dir=root/'static/neural';chunks=neural_dir/'content';chunks.mkdir(parents=True)
            chunk=chunks/'fixture.json';chunk.write_text(json.dumps(wire));gz=chunk.with_suffix('.json.gz');gz.write_bytes(gzip.compress(b'stale'))
            with patch.object(affiliate,'NEURAL_SYSTEMS',neural_dir/'systems.json'),patch.object(affiliate,'PUBLIC_DIR',root/'public'):
                self.assertIn(chunk,affiliate.targets())
            for ref in ('12345.test','98765.rotated',''):
                affiliate.stamp(chunk,ref)
                source=json.loads(chunk.read_text())['fixture']['guide']['sources'][1]
                self.assertEqual(source['canonical_url'],canonical);self.assertEqual(source['affiliate'],bool(ref))
                self.assertEqual(source['checked_on'],'2026-09-01');self.assertEqual(source['note'],'Inspected scope.')
                self.assertEqual(parse_qs(urlsplit(source['url']).query).get('rfsn'),[ref] if ref else None)
                self.assertEqual(gzip.decompress(gz.read_bytes()).decode(),chunk.read_text())
                self.assertEqual(affiliate.stamp(chunk,ref),0)
            html=self.render(data)
            # Include an unmarked blog reference: all vendor clickouts must participate.
            html+='<a href="https://bjjfanatics.com/blogs/news/example?variant=7#part">Blog</a>'
            for ref in ('12345.test','98765.rotated',''):
                html=affiliate.resolve_html(html,ref);self.assert_gate(html,ref)
                self.assertEqual(affiliate.resolve_html(html,ref),html)
                self.assertIn('variant=7',html);self.assertIn('#part',html)

    def test_unmarked_vendor_links_only_activate_in_system_guides(self):
        canonical='https://bjjfanatics.com/blogs/techniques/guard?variant=7#part'
        plain=f'<article><a href="{canonical}" rel="noopener">Position reference</a></article>'
        self.assertEqual(affiliate.resolve_html(plain,'12345.test'),plain)
        errors=[];gate.check_html(plain,'Position',errors,True,'12345.test');self.assertEqual(errors,[])
        source={'id':'listing','kind':'official_listing','url':canonical}
        self.assertEqual(affiliate.resolve_json(source,'12345.test'),source)
        for marker in ('data-course-url','data-source-url'):
            copied=plain.replace('rel="noopener"',f'{marker}="{canonical}" rel="noopener"')
            active=affiliate.resolve_html(copied,'12345.test');self.assert_gate(active,'12345.test')
            self.assertIn('rfsn=12345.test',active);self.assertIn(gate.canonical_disclosure(),active)
        system=plain.replace('<article>','<article data-system-guide>')
        active=affiliate.resolve_html(system,'12345.test');self.assert_gate(active,'12345.test')
        self.assertIn('data-source-url=',active);self.assertIn('variant=7',active)
        neutral=affiliate.resolve_html(active,'');self.assert_gate(neutral)
        self.assertNotIn('commission',neutral)
        errors=[];gate.check_html(system,'System',errors,True,'12345.test')
        self.assertTrue(any('unstamped' in e for e in errors))

    def test_preview_ctas_share_primary_and_generic_relationships_are_compact(self):
        data=copy.deepcopy(self.data)
        data['guide']['preview']={'provider':'youtube','embed_url':'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=0','source_id':'listing','title':'Official sample','kind':'sample','checked_on':'2026-09-01','content_reviewed':False,'playback_verified_on':['https://bjjgraph.org']}
        data['related_content']=[{'name':'Guard','content_type':'Position','relationship':'Related position reference; graph linkage does not establish inclusion in the course.'}, {'name':'Sweep','content_type':'Transition','relationship':'Distinct context for the published sweep chapter.'}]
        html=self.render(data)
        self.assertEqual(html.count('data-course-url='),3)
        self.assertNotIn('graph linkage does not establish',html);self.assertIn('Distinct context',html)
        self.assertIn('2 related references (techniques and positions)',html)
        self.assertIn('<details><summary>Sources',html);self.assertIn('Expand for evidence',html)
        html=affiliate.resolve_html(html,'12345.test');self.assert_gate(html,'12345.test')
        anchors=[affiliate.read_tag(a) for a in re.findall(r'<a\b[^>]*>',html) if 'data-course-url=' in a]
        self.assertEqual(len({a['href'] for a in anchors}),1)
        self.assertEqual([a['data-placement'] for a in anchors],['top','mid','end'])
        top=re.search(r'<a[^>]*data-placement="top"[^>]*>(.*?)</a>',html,re.S)[1]
        self.assertIn('<h2>'+data['products'][0]['title']+'</h2>',top)
        self.assertEqual(html.count(gate.canonical_disclosure()),4) # three CTAs and one source

    def test_static_related_guides_filter_stock_text_and_keep_editorial_links(self):
        refs=[{'name':'Half guard: positional overview','source_name':'Andrew Wiltse Half Guard System','type':'System','url':'/Systems/Andrew-Wiltse-Half-Guard-System','relationship':'Andrew Wiltse Half Guard System: related system study, separate from the source syllabus.'}, {'name':'Frames','source_name':'Frames','type':'Principle','url':'/Principles/Frames','relationship':'Specific framing context for the underhook sequence.'}]
        with patch.object(pages,'related_references',return_value=refs):
            text=self.render()
        self.assertIn('>Half guard: positional overview</a></p>',text)
        self.assertIn('href="/Systems/Andrew-Wiltse-Half-Guard-System"',text)
        self.assertNotIn('separate from the source syllabus',text)
        self.assertIn('Specific framing context for the underhook sequence.',text)
        qualifier='These related references are not a claim about what the course teaches or evidence of practical mastery.'
        self.assertEqual(text.count(qualifier),1)
        self.assertLess(text.index(qualifier),text.index('>Half guard: positional overview'))

    def test_invalid_configuration_fails_even_without_targets_and_does_not_log_value(self):
        import subprocess
        for bad in ('REPLACE_ME','x&ref=y','x\ny','secret invalid value','%22',' '):
            with self.assertRaises(ValueError):affiliate.validate_ref(bad)
            result=subprocess.run([sys.executable,'scripts/apply_affiliate_ref.py'],env={**os.environ,'AFFILIATE_REF':bad},capture_output=True,text=True,cwd=ROOT)
            self.assertNotEqual(result.returncode,0)
            if len(bad)>1:self.assertNotIn(bad,result.stdout+result.stderr)

    def test_environment_precedence_source_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'.env').write_text('UNRELATED=$(exit 1)\nAFFILIATE_REF="12345.test"\n')
            with patch.object(affiliate,'PROJECT_ROOT',root),patch.dict(os.environ,{},clear=True):
                self.assertEqual(affiliate.configured_ref(),'12345.test');os.environ['AFFILIATE_REF']='98765.ci';self.assertEqual(affiliate.configured_ref(),'98765.ci');os.environ['AFFILIATE_REF']='';self.assertEqual(affiliate.configured_ref(),'')
            source=root/'content/Systems/source.json';source.parent.mkdir(parents=True);source.write_text('{}')
            with patch.object(affiliate,'CONTENT_DIR',root/'content'):
                with self.assertRaises(SystemExit):affiliate.stamp(source,'12345.test')
            self.assertEqual(source.read_text(),'{}')

    def test_gate_rejects_mutants_and_requires_positive_built_coverage(self):
        html=affiliate.resolve_html(self.render(),'12345.test')
        for mutant in (html+'<a href="https://bjjfanatics.com/blogs/post">Unstamped</a>',html.replace(gate.canonical_disclosure(),'Changed sentence'),html.replace('sponsored nofollow noopener','noopener'),html.replace('rfsn=12345.test','rfsn=REPLACE_ME')):
            errors=[];gate.check_html(mutant,'mutant',errors,True,'12345.test');self.assertTrue(errors)
        errors=[]
        with patch.object(affiliate,'targets',return_value=[]):gate.check_built(errors,'')
        self.assertTrue(errors)

if __name__=='__main__':unittest.main()
