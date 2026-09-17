"""Frozen guide schema and semantic evidence contract (no network claims)."""
import copy
import json
from pathlib import Path
import sys
import unittest
import jsonschema
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from _system_guides import validate_guide


def fixture():
    return {'name':'Fixture System','description':'Independent course reading guide.', 'tags':['bjj','system'], 'system_type':'Guard System','difficulty_level':'Intermediate','summary':'A guide to reading the published guard course syllabus.', 'overview':'Use the published contents to compare scope.', 'related_content':[], 'guide':{'kind':'course_companion','display_title':'Guard course companion','audience':{'fits':['Readers comparing guard courses'],'consider_alternative_if':['You need a demonstrated physical drill']},'coverage':{'includes':['Published chapter coverage'],'limits':['Listing does not demonstrate mechanics']},'sources':[{'id':'listing','url':'https://bjjfanatics.com/products/example','title':'Official course listing','kind':'official_listing','checked_on':'2026-09-01','note':'Listing inspected, instruction not reviewed.'}]},'products':[{'id':'fixture','title':'Fixture course','instructor':'Fixture instructor','vendor':'BJJFanatics','course_url':'https://bjjfanatics.com/products/example','link_status':'live','link_checked':'2026-09-01'}]}


class GuideSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema=json.loads((ROOT/'templates/Systems.json').read_text())
        jsonschema.Draft7Validator.check_schema(cls.schema)

    def check(self,data):
        return list(jsonschema.Draft7Validator(self.schema).iter_errors(data)), validate_guide(data)

    def test_minimal_guide_no_legacy_quota(self):
        self.assertEqual(self.check(fixture()), ([], ([], [])))

    def test_required_and_reference_integrity(self):
        for field in ('audience','coverage','sources','display_title'):
            d=fixture(); del d['guide'][field]; self.assertTrue(self.check(d)[0])
        d=fixture(); d['guide']['sources']*=2; self.assertTrue(self.check(d)[1][0])

    def test_retired_tasks_rejected_and_empty_caveats_allowed(self):
        d=fixture(); d['guide']['audience']['consider_alternative_if']=[]
        self.assertEqual(self.check(d), ([], ([], [])))
        d['guide']['start_here']={'title':'Invented homework'}
        self.assertTrue(self.check(d)[0]); self.assertTrue(self.check(d)[1][0])

    def test_alternatives_resolve_exact_names_to_real_paths_only(self):
        import tempfile
        from _system_guides import resolved_guide
        from _slug import slugify
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/'Systems').mkdir()
            (root/'Systems'/'Real Target.json').write_text(json.dumps({'name':'Stable name','aliases':['Alias'], 'guide':{'display_title':'Editorial title'}}))
            data=fixture(); data['guide']['alternatives']=[{'system':'Stable name','reason':'Different supported scope.'}]
            self.assertFalse(list(jsonschema.Draft7Validator(self.schema).iter_errors(data)))
            self.assertEqual(validate_guide(data,root),([],[]))
            before=copy.deepcopy(data)
            result=resolved_guide(data,root,slugify)
            self.assertEqual(result['alternatives'],[{'system':'Stable name','reason':'Different supported scope.','url':'/systems/real-target','title':'Editorial title'}])
            self.assertEqual(data,before)
            for unknown in ('Alias','Missing'):
                data['guide']['alternatives'][0]['system']=unknown
                self.assertTrue(validate_guide(data,root)[0])
                with self.assertRaises(ValueError): resolved_guide(data,root,slugify)

    def test_no_source_exception_is_flagged(self):
        d=fixture(); d['guide']['sources']=[]
        self.assertTrue(self.check(d)[1][0]); d['guide']['kind']='topic_guide'
        self.assertFalse(self.check(d)[1][0]); self.assertTrue(self.check(d)[1][1])

    def test_canonical_products_only(self):
        for suffix in ('?ref=REPLACE_ME','?rfsn=REPLACE_ME','?rfsn=1234.test','?utm_source=source'):
            d=fixture(); d['products'][0]['course_url']+=suffix; self.assertTrue(self.check(d)[1][0])
        d=fixture(); d['products'][0]['affiliate_url']=d['products'][0].pop('course_url'); self.assertTrue(self.check(d)[0])

    def test_rich_wire_requires_source_activation_metadata(self):
        from _system_guides import resolved_guide
        from regenerate_graph import quartz_slug
        data=fixture(); data['guide']=resolved_guide(data,ROOT/'content',quartz_slug)
        self.assertEqual(validate_guide(data,emitted=True),([],[]))
        del data['guide']['sources'][0]['canonical_url']
        self.assertTrue(validate_guide(data,emitted=True)[0])
        data['guide']['alternatives']=[{'system':'Stable name','reason':'Scope','url':'https://foreign.test','title':'Title'}]
        self.assertTrue(any('comparison' in error for error in validate_guide(data,emitted=True)[0]))

    def test_preview_allowlist_disabled_autoplay_and_evidence(self):
        d=fixture(); preview={'provider':'bunny','embed_url':'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&preload=false','source_id':'listing','title':'Official sample','kind':'sample','checked_on':'2026-09-01','content_reviewed':False,'playback_verified_on':[]}; d['guide']['preview']=preview
        self.assertEqual(self.check(d), ([], ([], [])))
        for url in ('https://evil.test/embed/1/abc?autoplay=false&preload=false',preview['embed_url'].replace('autoplay=false','autoplay=true')):
            x=copy.deepcopy(d); x['guide']['preview']['embed_url']=url; self.assertTrue(self.check(x)[1][0])
        preview['checked_on']='2026-02-30'; self.assertTrue(self.check(d)[1][0])

class GuideWire(unittest.TestCase):
    def test_index_is_compact_and_dossier_preserves_evidence_and_real_references(self):
        import tempfile
        from unittest.mock import patch
        import regenerate_neural_data as neural
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); content=root/'content'; systems=content/'Systems'; systems.mkdir(parents=True)
            principles=content/'Principles'; principles.mkdir()
            data=fixture(); data['aliases']=['Fixture alias']; data['related_content']=[
                {'name':'Related principle','content_type':'Principle','relationship':'Useful context, not a claim of course coverage.'},
                {'name':'Missing guide','content_type':'System','relationship':'Must not emit an invented link.'}]
            (systems/'Fixture System.json').write_text(json.dumps(data))
            (principles/'Real Principle.json').write_text(json.dumps({'name':'Real Principle','aliases':['Related principle']}))
            with patch.object(neural,'ROOT',root),patch.object(neural,'SYSTEMS_DIR',systems):
                index,dossiers=neural.build_systems({},[])
            entry=index['systems'][0]; body=dossiers[entry['key']]
            self.assertEqual(entry['id'],'Systems/Fixture-System');self.assertEqual(entry['display_title'],data['guide']['display_title']);self.assertEqual(entry['aliases'],data['aliases'])
            for key in ('guide','sources','preview','references'):self.assertNotIn(key,entry)
            self.assertEqual(body['guide']['sources'][0],{**data['guide']['sources'][0], 'canonical_url':data['guide']['sources'][0]['url'], 'affiliate':False});self.assertNotIn('canonical_url',data['guide']['sources'][0]);self.assertEqual(body['references'],[{'name':'Related principle','type':'Principle','url':'/Principles/Real-Principle','relationship':data['related_content'][0]['relationship']}])
            self.assertFalse(entry['products'][0]['affiliate']);self.assertEqual(entry['products'][0]['url'],entry['products'][0]['course_url'])
            from regenerate_graph import process_systems
            graph=process_systems(content,{})
            product=next(iter(graph.values()))['products'][0]
            self.assertTrue(product['has_affiliate_url'])
            for field in ('affiliate_url','course_url','url'):self.assertNotIn(field,product)


    def test_static_preview_metadata_supports_immediate_verified_mount_and_fallback(self):
        import regenerate_md_from_json as pages
        d=fixture();d['guide']['preview']={'provider':'youtube','embed_url':'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=0','source_id':'listing','title':'Official sample — fixture','kind':'sample','checked_on':'2026-09-01','content_reviewed':False,'playback_verified_on':[]}
        text=pages.generate_markdown(d,pages.load_template('Systems','Systems.md.jinja2'),resolve_fn=lambda x:x)
        self.assertNotIn('data-load-preview',text);self.assertIn('data-preview-fallback',text);self.assertIn('data-preview-player',text);self.assertEqual(text.count('data-course-url='),3)
        self.assertNotIn('<iframe',text);self.assertNotIn('preconnect',text)
        self.assertIn('data-verified-origins="[]"',text)


if __name__=='__main__': unittest.main()
