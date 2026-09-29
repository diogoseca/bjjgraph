// CTO RECOVERY-RULING: the X-09 text exception preserves the 9775 floor and accepts
// only the captured 3570-character text. These in-memory mutants never edit source.
// They pin this exception, not browser crawling, <details> visibility or whole-site SEO.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("X-09 provisional text exception is exact and cannot lower its retained floor", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const output = execFileSync("python3", ["-B", "-c", String.raw`
import copy,sys
sys.path.insert(0,'scripts')
from check_seo_parity import diff,retain_provisional,PROVISIONAL_NAME as name,PROVISIONAL_ROUTE as route,PROVISIONAL_TREE as tree
page={'title':'t','canonical':'/p','meta':{},'ldjson':[],'content_len':3570,'content_hash':'a'*64,'links':[]}
old={route:{**page,'content_len':11501,'content_floor':9775}}
cur={route:copy.deepcopy(page),'Other.html':{**page,'content_len':100,'content_floor':80}}
rules=retain_provisional(old,cur,{'content_tree':tree},True)
assert cur[route]['content_floor']==9775
base=copy.deepcopy(cur);base['_meta']={'provisional_exceptions':rules}
fail,notes=diff(base,cur)
assert not fail and len([n for n in notes if n.startswith('PROVISIONAL ')])==1,(fail,notes)
assert retain_provisional(base,copy.deepcopy(cur),{'content_tree':tree})[name]['content_floor']==9775
kills=[]
for case in ('less-text','changed-text','title','other-route','missing-route','no-exception','unknown-exception'):
    b,c=copy.deepcopy(base),copy.deepcopy(cur)
    if case=='less-text':c[route]['content_len']=3569
    elif case=='changed-text':c[route]['content_hash']='b'*64
    elif case=='title':c[route]['title']='changed'
    elif case=='other-route':c['Other.html']['content_len']=1
    elif case=='missing-route':del c[route]
    elif case=='no-exception':del b['_meta']['provisional_exceptions']
    elif case=='unknown-exception':b['_meta']['provisional_exceptions']['invented']={}
    failures,_=diff(b,c)
    assert failures,case
    kills.append(case)
for case in ('reseed-less-text','reseed-changed-text','reseed-new-content','reseed-lowered-floor'):
    b,c,r=copy.deepcopy(base),copy.deepcopy(cur),{'content_tree':tree}
    if case=='reseed-less-text':c[route]['content_len']=3569
    elif case=='reseed-changed-text':c[route]['content_hash']='b'*64
    elif case=='reseed-new-content':r['content_tree']='0'*40
    elif case=='reseed-lowered-floor':b[route]['content_floor']=3034
    try:retain_provisional(b,c,r)
    except ValueError:kills.append(case)
    else:raise AssertionError(case)
assert len(kills)==11
print('controls=3 provisional_hits=1 mutants_killed=11/11 retained_floor=9775')
`], { cwd: root, encoding: "utf8" });
  assert.match(output, /controls=3 provisional_hits=1 mutants_killed=11\/11 retained_floor=9775/);
});
