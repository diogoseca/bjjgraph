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


def preview_fixture():
    return {'provider':'bunny','embed_url':'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&muted=false&preload=true','source_id':'listing','title':'Official course introduction','kind':'trailer','checked_on':'2026-09-01','content_reviewed':False,'playback_verified_on':[]}


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

    def test_preview_identity_is_separate_from_playback_preferences_and_audit_origins(self):
        d=fixture(); preview=preview_fixture(); d['guide']['preview']=preview
        self.assertEqual(self.check(d), ([], ([], [])))
        for host in ('iframe.mediadelivery.net', 'player.mediadelivery.net'):
            x=copy.deepcopy(d); x['guide']['preview']['embed_url']=preview['embed_url'].replace('iframe.mediadelivery.net',host).replace('autoplay=false','autoplay=true')
            self.assertEqual(self.check(x), ([], ([], [])))
        for url in ('https://evil.test/embed/1/abc', preview['embed_url'].replace('iframe.mediadelivery.net','iframe.mediadelivery.net.evil.test'), preview['embed_url'].replace('/embed/','/play/'), preview['embed_url']+'#fragment', preview['embed_url'].replace('https://','https://user@')):
            x=copy.deepcopy(d); x['guide']['preview']['embed_url']=url; self.assertTrue(self.check(x)[1][0])
        youtube=copy.deepcopy(d); youtube['guide']['preview'].update(provider='youtube',embed_url='https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&mute=1')
        self.assertEqual(self.check(youtube), ([], ([], [])))
        preview['checked_on']='2026-02-30'; self.assertTrue(self.check(d)[1][0])

class MediaCoverage(unittest.TestCase):
    def test_missing_or_changed_opening_media_fails_coverage(self):
        from check_systems_payload import check_media
        data = fixture()
        data['products'][0]['image'] = 'https://cdn.shopify.com/fixture.jpg'
        data['guide']['preview'] = {'provider': 'bunny', 'embed_url': 'https://iframe.mediadelivery.net/embed/1/11111111-1111-1111-1111-111111111111', 'title': 'Course intro', 'kind': 'trailer'}
        row = {'id': 'Systems/Fixture-System', 'preview': dict(data['guide']['preview']), 'products': copy.deepcopy(data['products'])}
        sources = {row['id']: data}
        self.assertEqual(check_media([row], sources), ([], 1, 1))
        missing = copy.deepcopy(row); del missing['preview']
        self.assertTrue(check_media([missing], sources)[0])
        changed = copy.deepcopy(row); changed['products'][0]['image'] = 'https://cdn.shopify.com/wrong.jpg'
        self.assertTrue(check_media([changed], sources)[0])


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
            data['guide']['preview']=preview_fixture()
            data['products'][0]['image']='https://cdn.shopify.com/s/files/1/fixture-cover.jpg'
            (systems/'Fixture System.json').write_text(json.dumps(data))
            (principles/'Real Principle.json').write_text(json.dumps({'name':'Real Principle','aliases':['Related principle']}))
            with patch.object(neural,'ROOT',root),patch.object(neural,'SYSTEMS_DIR',systems):
                index,dossiers=neural.build_systems({},[])
            entry=index['systems'][0]; body=dossiers[entry['key']]
            self.assertEqual(entry['id'],'Systems/Fixture-System');self.assertEqual(entry['display_title'],data['guide']['display_title']);self.assertEqual(entry['aliases'],data['aliases'])
            for key in ('guide','sources','references'):self.assertNotIn(key,entry)
            self.assertEqual(entry['preview'],{'provider':'bunny','embed_url':data['guide']['preview']['embed_url'],'title':'Official course introduction','kind':'trailer'})
            self.assertEqual(body['guide']['preview'],data['guide']['preview'])
            self.assertEqual(entry['products'][0]['image'],data['products'][0]['image'])
            self.assertEqual(body['guide']['sources'][0],{**data['guide']['sources'][0], 'canonical_url':data['guide']['sources'][0]['url'], 'affiliate':False});self.assertNotIn('canonical_url',data['guide']['sources'][0]);self.assertEqual(body['references'],[{'name':'Related principle','source_name':'Real Principle','type':'Principle','url':'/Principles/Real-Principle','relationship':data['related_content'][0]['relationship']}])
            self.assertFalse(entry['products'][0]['affiliate']);self.assertEqual(entry['products'][0]['url'],entry['products'][0]['course_url'])
            from regenerate_graph import process_systems
            graph=process_systems(content,{})
            product=next(iter(graph.values()))['products'][0]
            self.assertTrue(product['has_affiliate_url'])
            for field in ('affiliate_url','course_url','url'):self.assertNotIn(field,product)

    def test_compact_preview_omits_missing_foreign_or_unsourced_media(self):
        from _system_guides import compact_preview
        d=fixture(); self.assertIsNone(compact_preview(d))
        d['guide']['preview']=preview_fixture()
        d['guide']['preview']['source_id']='missing'
        self.assertIsNone(compact_preview(d))
        d['guide']['preview']['source_id']='listing'
        d['guide']['preview']['embed_url']='https://foreign.test/embed/intro'
        self.assertIsNone(compact_preview(d))

    def test_payload_gate_rejects_foreign_preview_or_evidence_in_compact_media(self):
        import check_systems_payload as gate
        entry={'id':'Systems/Fixture','key':'Fixture|System','name':'Fixture','url':'/Systems/Fixture','summary':'Fixture','type':'Guard System','display_title':'Fixture','aliases':[],'difficulty':'Intermediate','nodes':['node'],'unresolved':[],'products':[],'glue':[],'preview':{'provider':'youtube','embed_url':'https://www.youtube-nocookie.com/embed/abcdefghijk','title':'Course intro','kind':'trailer'}}
        def errors():
            return gate.check({'systems':[entry],'_meta':{'count':1,'unresolved':0,'nodes':1}},{'node'},{entry['id']})
        self.assertFalse(any('preview' in error for error in errors()))
        entry['preview']['playback_verified_on']=[]
        self.assertTrue(any('preview' in error for error in errors()))
        del entry['preview']['playback_verified_on']; entry['preview']['embed_url']='https://foreign.test/embed/intro'
        self.assertTrue(any('preview' in error for error in errors()))


    def test_reference_labels_use_editorial_title_without_changing_identity_or_url(self):
        import tempfile
        from _system_guides import related_references
        from regenerate_graph import quartz_slug
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/'Systems').mkdir()
            stable='Andrew Wiltse Half Guard System'
            target={'name':stable,'aliases':['Legacy guard alias'],'guide':{'display_title':'Half guard: positional overview'}}
            (root/'Systems'/(stable+'.json')).write_text(json.dumps(target))
            data={'related_content':[{'name':'Legacy guard alias','content_type':'System','relationship':'Distinct route from seated guard.'}]}
            before=copy.deepcopy(data)
            refs=related_references(data,root,quartz_slug)
            self.assertEqual(refs,[{'name':'Half guard: positional overview','source_name':stable,'type':'System','url':'/Systems/Andrew-Wiltse-Half-Guard-System','relationship':'Distinct route from seated guard.'}])
            self.assertEqual(data,before)

    def test_stock_relationships_suppressed_across_types_but_specific_context_survives(self):
        from _system_guides import guide_relationship
        stock = [
            'Related position for orientation.',
            'Related position reference for comparing the course vocabulary.',
            'Related position: Alias name.',
            'Related principle on the graph.',
            'Further conceptual reading: Alias name.',
            'Related BJJGraph position.',
            'Related concept for organizing study.',
            'Related graph transition for separate study, not a verified course sequence.',
            'Related study guide: Alias name.',
            'Related Systems guide.',
            'Related guide with a separate scope and source list.',
            'Related study guide; its scope should be checked separately from this course.',
        ]
        for value in stock:
            self.assertEqual(guide_relationship({'relationship':value}),'',value)
        for kind in ('Position','Transition','Submission','Principle','System'):
            for value in (
                f'Related {kind.lower()} reference; graph linkage does not establish inclusion in the course.',
                f'Related {kind.lower()} reference; inclusion here does not establish course coverage.',
                f'Legacy name: related {kind.lower()} study, separate from the source syllabus.',
                f'Related {kind.lower()} reference for guard-recovery study.',
                f'Related {kind.lower()} reference: Legacy name.',
            ):
                item={'name':'Editorial name','source_name':'Legacy name','type':kind,'relationship':value}
                self.assertEqual(guide_relationship(item),'',value)
            for value in ('Related guard reference for comparing the guard-return sections in Volume 4.', 'Distinct context for the published sweep chapter.', 'Related principle reference for timing the far-side underhook.'):
                self.assertEqual(guide_relationship({'relationship':value}),value)

    def test_static_intro_precedes_course_and_overview_with_cover_fallback_and_two_ctas(self):
        import regenerate_md_from_json as pages
        d=fixture();d['guide']['preview']=preview_fixture();d['products'][0]['image']='https://cdn.shopify.com/s/files/1/fixture-cover.jpg'
        text=pages.generate_markdown(d,pages.load_template('Systems','Systems.md.jinja2'),resolve_fn=lambda x:x)
        self.assertNotIn('data-load-preview',text);self.assertIn('data-preview-fallback',text);self.assertIn('data-preview-player',text);self.assertEqual(text.count('data-course-url='),2)
        self.assertNotIn('<iframe',text);self.assertNotIn('preconnect',text)
        self.assertNotIn('data-verified-origins',text)
        self.assertIn('class="system-cover"',text)
        self.assertIn('alt="Fixture course course cover"',text)
        self.assertLess(text.index('<h1>'),text.index('data-system-preview'))
        self.assertLess(text.index('data-system-preview'),text.index('data-course-placement="top"'))
        self.assertLess(text.index('data-course-placement="top"'),text.index('id="overview"'))
        self.assertNotIn('data-course-placement="mid"',text)

    def test_static_course_without_intro_uses_cover_and_topic_guide_stays_text_only(self):
        import regenerate_md_from_json as pages
        def render(d):
            return pages.generate_markdown(d,pages.load_template('Systems','Systems.md.jinja2'),resolve_fn=lambda x:x)
        d=fixture(); d['products'][0]['image']='https://cdn.shopify.com/s/files/1/fixture-cover.jpg'
        text=render(d)
        self.assertIn('system-preview--cover',text);self.assertNotIn('data-system-preview',text)
        self.assertLess(text.index('class="system-cover"'),text.index('data-course-placement="top"'))
        d['products']=[];d['guide']['kind']='topic_guide';text=render(d)
        self.assertNotIn('system-cover',text);self.assertNotIn('system-preview',text);self.assertNotIn('data-course-url',text)
        d['guide']['preview']=preview_fixture();text=render(d)
        self.assertNotIn('data-system-preview',text);self.assertNotIn('data-preview-player',text)


if __name__=='__main__': unittest.main()
