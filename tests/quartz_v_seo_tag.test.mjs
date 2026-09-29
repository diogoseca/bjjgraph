// Tag SEO covers the enclosing TagContent listing, not only its empty article.
// Exact text/link controls exclude header/sidebar/footer content. In-memory mutants
// remove a named listing, one link, or the index listings; each must turn the gate red.
// This does not inventory every tag route (F's tier-0 floor) or test browser behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("tag SEO samples include the listing and exclude surrounding chrome", () => {
  const output = execFileSync("python3", ["-B", "-c", String.raw`
import copy,hashlib,json,sys,tempfile
from pathlib import Path
sys.path.insert(0,'scripts')
import check_seo_parity as gate
header='<div class="popover-hint"><h1>CHROME</h1><a href="/header">header</a></div>'
footer='<footer><a href="/footer">FOOTER</a></footer>'
named='<div class="custom popover-hint"><article></article><div class="page-listing"><p>2 items.</p><div><ul><li><a href="/A">Alpha</a></li><li><a href="/B">Beta</a></li></ul></div></div></div>'
index='<div class="popover-hint"><article><p></p></article><p>Found 2 tags.</p><div><h2><a href="/tags/a">a</a></h2><div class="page-listing"><a href="/A">Alpha</a></div><h2><a href="/tags/b">b</a></h2><div class="page-listing"><a href="/B">Beta</a></div></div></div>'
def doc(region): return '<html><head><title>T</title></head><body>'+header+region+footer+'</body></html>'
with tempfile.TemporaryDirectory() as tmp:
    gate.PUBLIC=Path(tmp)
    gate.SAMPLE=['tags/beginner.html','tags/index.html','Ordinary.html']
    (gate.PUBLIC/'tags').mkdir()
    pages={'tags/beginner.html':doc(named),'tags/index.html':doc(index),'Ordinary.html':doc('<article><a href="/only">Only</a></article>')}
    for path,body in pages.items(): (gate.PUBLIC/path).write_text(body)
    actual=gate.snapshot()
    expected={'tags/beginner.html':('2 items. Alpha Beta',['/A','/B']),
              'tags/index.html':('Found 2 tags. a Alpha b Beta',['/A','/B','/tags/a','/tags/b']),
              'Ordinary.html':('Only',['/only'])}
    for path,(text,links) in expected.items():
        row=actual[path]
        assert row['content_len']==len(text),(path,row)
        assert row['content_hash']==hashlib.sha256(text.encode()).hexdigest(),path
        assert row['links']==links,(path,row['links'])
    base=copy.deepcopy(actual)
    for row in base.values(): row['content_floor']=int(row['content_len']*.85)
    assert gate.diff(base,actual)[0]==[]
    kills=[]
    mutants={
        'named-listing-removed':('tags/beginner.html','<div class="popover-hint"><article></article></div>'),
        'one-link-removed':('tags/beginner.html',named.replace('href="/B"','data-removed="/B"')),
        'index-listings-removed':('tags/index.html','<div class="popover-hint"><article><p></p></article><p>Found 2 tags.</p></div>'),
    }
    for case,(path,region) in mutants.items():
        (gate.PUBLIC/path).write_text(doc(region))
        failures,_=gate.diff(base,gate.snapshot())
        assert any(path in f for f in failures),(case,failures)
        kills.append(case)
        (gate.PUBLIC/path).write_text(pages[path])
    assert gate.snapshot()==actual
    print('routes=3 exact_text_controls=3 exact_link_controls=3 mutants_killed=3/3')
`], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.match(output, /routes=3 exact_text_controls=3 exact_link_controls=3 mutants_killed=3\/3/);
});
