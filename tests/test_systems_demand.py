import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from _systems_demand import systems_demand_parts, write_systems_demand, SYSTEMS_SOURCE

class SystemsDemandTests(unittest.TestCase):
    def fixture(self):
        return {'_meta': {'count': 1}, 'systems': [{'id':'Systems/A','name':'A','difficulty':'Intermediate','aliases':['a'],'nodes':['x'],'glue':[{'nodes':['x']}],'products':[{'name':'P','instructor':'I','url':'unchanged'}]}]}
    def test_exact_roundtrip_and_search(self):
        source=self.fixture();index,records=systems_demand_parts(source)
        self.assertEqual({'_meta':index['_meta'],'systems':[json.loads(records[r['detailHash']]) for r in index['systems']]},source)
        self.assertEqual(index['systems'][0]['products'],[{'name':'P','instructor':'I'}])
        self.assertEqual(index['systems'][0]['difficulty'],'Intermediate')
    def test_legacy_bytes_and_prior_chunks_retained(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);legacy=b'legacy exact bytes\n';(root/'systems.json').write_bytes(legacy)
            _,records=write_systems_demand(root,self.fixture());(root/'systems-index.json.gz').write_bytes(gzip.compress(b'old'));source=self.fixture();source['systems'][0]['nodes']=['new'];write_systems_demand(root,source)
            self.assertEqual((root/'systems.json').read_bytes(),legacy)
            self.assertEqual(gzip.decompress((root/'systems-index.json.gz').read_bytes()),(root/'systems-index.json').read_bytes())
            for h,b in records.items():self.assertEqual((root/'content/system-records'/f'{h}.json').read_bytes(),b)
    def test_unchanged_library_leaves_every_file_untouched(self):
        # The stamper runs this INSIDE `npm run build` against the build's own generated inputs;
        # the guarded capture refuses a build that changes any of them, by inode and mtime too
        # (v1.207.13). Mutant, recorded 2026-09-30: an unconditional index write turns this red.
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);write_systems_demand(root,self.fixture());(root/'systems-index.json.gz').write_bytes(gzip.compress((root/'systems-index.json').read_bytes(),mtime=0))
            before={p:(p.stat().st_ino,p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}
            write_systems_demand(root,self.fixture())
            after={p:(p.stat().st_ino,p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}
            self.assertEqual(after,before)
            self.assertGreaterEqual(len(before),3)
    def test_duplicate_refused(self):
        source=self.fixture();source['systems']*=2
        with self.assertRaises(ValueError):systems_demand_parts(source)
    def test_oversize_refused(self):
        source=self.fixture();source['systems'][0]['extra']='x'*40000
        with self.assertRaises(ValueError):systems_demand_parts(source)
    def test_actual_corpus_exact(self):
        path=SYSTEMS_SOURCE  # the build-internal full library (v1.207.0: never served)
        if not path.exists():self.skipTest('emitted fixture unavailable')
        original=json.loads(path.read_bytes());index,records=systems_demand_parts(original)
        self.assertEqual({'_meta':index['_meta'],'systems':[json.loads(records[r['detailHash']]) for r in index['systems']]},original)
        self.assertLessEqual(max(map(len,records.values())),40000)

class SystemsStampTests(unittest.TestCase):
    def test_existing_link_policy_republishes_new_hash_without_mutating_old(self):
        import apply_affiliate_ref as stamp
        from unittest.mock import patch
        source=SystemsDemandTests().fixture()
        source['systems'][0]['products']=[{'id':'p','name':'P','instructor':'I','url':'https://bjjfanatics.com/products/p','course_url':'https://bjjfanatics.com/products/p','affiliate':False}]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); public=root/'public'; data=public/'static/neural';data.mkdir(parents=True)
            # The full library is the build-internal source (never served); only the demand route
            # lives in the served root.
            legacy=root/'internal/systems.json';legacy.parent.mkdir(parents=True);legacy.write_text(json.dumps(source))
            _,old=write_systems_demand(data,source)
            with patch.object(stamp,'PUBLIC_DIR',public),patch.object(stamp,'NEURAL_SYSTEMS',legacy),patch.object(stamp,'NEURAL_STATIC',root/'static-absent'):
                targets=stamp.targets()
                self.assertIn(legacy,targets)
                self.assertFalse(any(p.parent.name=='system-records' or p.name=='systems-index.json' for p in targets))
                for path in targets:stamp.stamp(path,'fixture-only')
                accepted=legacy.read_bytes();stamp.refresh_systems_demand()
                self.assertEqual(legacy.read_bytes(),accepted)
            for h,b in old.items():self.assertEqual((data/'content/system-records'/f'{h}.json').read_bytes(),b)
            index=json.loads((data/'systems-index.json').read_bytes())
            record=json.loads((data/'content/system-records'/(index['systems'][0]['detailHash']+'.json')).read_bytes())
            self.assertEqual(record,json.loads(accepted)['systems'][0])
            self.assertNotIn(index['systems'][0]['detailHash'],old)

if __name__ == '__main__':unittest.main()
