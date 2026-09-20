#!/usr/bin/env python3
"""Seam runner red proofs: real incumbent page, byte drift, absence and blind data.

Run: python3 scripts/seam_golden_selftest.py --tree /path/to/build0
These tests do not render a second implementation. They mutate actual emitted bytes.
They do not cover browser behavior, the complete corpus, or keyed deploy behavior.
"""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def seeded_region_proofs():
    from emit_diff import seeded_coverage
    golden = {'static/neural/a.json': {}, 'static/neural/b.json': {}, 'index.html': {}}
    candidate = {'static/neural/a.json': {}, 'index.html': {}}
    spec = {'regions': [{'path': 'static/neural/', 'reason': 'fixture input copied', 'evidence': 'selftest'}]}
    report, paths, problems = seeded_coverage(spec, golden, candidate)
    assert not problems
    assert report['golden_files'] == 2 and report['candidate_files'] == 1
    assert paths == {'static/neural/a.json', 'static/neural/b.json'}
    assert report['common_files'] == 1 and report['generated_parity_files'] == 1
    dead = {'regions': [{'path': 'absent/', 'reason': 'fixture', 'evidence': 'fixture'}]}
    assert seeded_coverage(dead, golden, candidate)[2]
    assert seeded_coverage({'regions': []}, golden, candidate)[2]
    assert seeded_coverage({'regions': [{'path': '../escape', 'reason': 'x', 'evidence': 'x'}]}, golden, candidate)[2]
    print('PASS coverage: 4 seeded-region proofs; declarations never suppress copy differences')


def value_proofs(tree):
    from emit_fingerprint import fingerprint_html, html_value_proofs, sha
    from emit_diff import diff_record, Allow
    raw = (tree / 'Positions/Mount.html').read_bytes()
    def record(b):
        return {'cls': 'html', 'sha': sha(b), 'size': len(b), 'fp': fingerprint_html(b, 'page.html'),
                'value_proofs': html_value_proofs(b)}
    g = record(raw)
    allow = Allow({'rules': [{'id': 'date-fallback', 'field': r'html\.value\.published-time',
                             'reason': 'selftest only', 'evidence': 'actual emitted fixture'},
                            {'id': 'year', 'field': r'html\.value\.footer-year',
                             'reason': 'selftest only', 'evidence': 'actual emitted fixture'}]})
    import re
    old = re.search(rb'"datePublished":"([^"]+)"', raw).group(1)
    cases = [
        ('Head date remains strict', raw.replace(old, b'2026-09-21T12:34:56.789Z'), False),
        ('footer year', raw.replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © 2027'.encode()), True),
        ('missing date', raw.replace(b'"datePublished":"' + old + b'",', b''), False),
        ('missing published meta', re.sub(rb'<meta\b[^>]*property="article:published_time"[^>]*>', b'', raw), False),
        ('malformed date', raw.replace(old, b'not-a-date'), False),
        ('invalid calendar date', raw.replace(old, b'2026-02-30T12:34:56.789Z'), False),
        ('missing footer year', raw.replace('BJJGraph.org © 2026'.encode(), b'BJJGraph.org'), False),
        ('malformed footer year', raw.replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © unknown'.encode()), False),
        ('date and year together', raw.replace(old, b'2026-09-21T12:34:56.789Z').replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © 2027'.encode()), False),
        ('date plus unextracted body change', raw.replace(old, b'2026-09-21T12:34:56.789Z').replace(b'under active development', b'under silent corruption'), False),
        ('year plus unextracted body change', raw.replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © 2027'.encode()).replace(b'under active development', b'under silent corruption'), False),
    ]
    for name, candidate, accepted in cases:
        assert candidate != raw, name
        rows = diff_record('page.html', g, record(candidate))
        assert rows, name
        remaining = [r for r in rows if not allow.suppress('page.html', r[1], r[2], r[3])]
        assert (not remaining) == accepted, (name, rows)
    print(f'PASS coverage: {len(cases)} value-normalization proofs; presence, format and unrelated bytes remain pinned')


def xml_date_proofs(tree, other_feed_path=None):
    """Real sitemap/RSS bytes, strict Head dates, and a bounded RSS set allowance."""
    import re
    from emit_fingerprint import fingerprint_file, fingerprint_xml, xml_value_proofs, sha
    from emit_diff import diff_record, Allow
    sitemap = (tree / 'sitemap.xml').read_bytes()
    feed = (tree / 'index.xml').read_bytes()
    from xml.sax.saxutils import escape
    from emit_fingerprint import fingerprint_html
    if other_feed_path is not None:
        other_feed = other_feed_path.read_bytes()
    else:
        # Derive a different eligible item from actual emitted HTML, keeping RSS markup.
        mount = fingerprint_html((tree/'Positions/Mount.html').read_bytes(), 'Positions/Mount.html')
        block = re.findall(rb'<item>.*?</item>', feed, re.S)[-1]
        new = block
        values = {'title': mount['title'], 'description': mount['meta_map']['name=description'],
                  'link': 'https://bjjgraph.org/Positions/Mount', 'guid': 'https://bjjgraph.org/Positions/Mount'}
        for field, value in values.items():
            pattern = rb'<' + field.encode() + rb'>[^<]*</' + field.encode() + rb'>'
            replacement = ('<' + field + '>' + escape(value) + '</' + field + '>').encode()
            new = re.sub(pattern, lambda m: replacement, new)
        other_feed = feed.replace(block, new).replace(b'Sun, 20 Sep 2026', b'Mon, 21 Sep 2026')
    def record(raw, name):
        return {'cls': 'xml', 'sha': sha(raw), 'size': len(raw), 'fp': fingerprint_xml(raw, name),
                'value_proofs': xml_value_proofs(raw, name)}
    # Load only the actual artifact metadata that the two feed selections exercise.
    from urllib.parse import urlsplit, unquote
    import xml.etree.ElementTree as ET
    golden_links = {i.findtext('link') for i in ET.fromstring(feed).findall('./channel/item')}
    new_item = next(i for i in ET.fromstring(other_feed).findall('./channel/item') if i.findtext('link') not in golden_links)
    paths = set()
    for raw in (feed, other_feed):
        for item in ET.fromstring(raw).findall('./channel/item'):
            route = unquote(urlsplit(item.findtext('link')).path).strip('/') or 'index'
            paths.add(route + '.html')
    metadata = dict(fingerprint_file((str(tree), rel)) for rel in paths)
    metadata.update([fingerprint_file((str(tree), 'static/contentIndex.json'))])
    def rows(raw, name, original):
        return diff_record(name, record(original, name), record(raw, name), site_records=(metadata, metadata))
    rules = {'rules': [
        {'id': 'sitemap-date', 'path': '^sitemap\\.xml$', 'field': '^xml\\.value\\.sitemap-lastmod$', 'reason': 'fixture', 'evidence': 'mutated real artifact'},
        {'id': 'rss-date', 'path': '^index\\.xml$', 'field': '^xml\\.value\\.rss-pubdate$', 'reason': 'fixture', 'evidence': 'mutated real artifact'},
        {'id': 'rss-set', 'path': '^index\\.xml$', 'field': '^xml\\.rss\\.selection$', 'reason': 'fixture', 'evidence': 'two real emit selections'},
    ]}
    claims = 0
    def check(name, raw, rel, original, want):
        nonlocal claims
        assert raw != original, name
        differences = rows(raw, rel, original)
        assert differences, (name, 'strict differ must remain red')
        allow = Allow(rules)
        remaining = [r for r in differences if not allow.suppress(rel, r[1], r[2], r[3])]
        assert (not remaining) == want, (name, differences)
        claims += 1
        print('PASS XML', name, 'allowed' if want else 'REJECTED')
        return differences
    stamp = re.search(rb'<lastmod>([^<]+)</lastmod>', sitemap).group(1)
    check('sitemap value', sitemap.replace(stamp, b'2026-09-21T01:02:03.004Z'), 'sitemap.xml', sitemap, True)
    for label, replacement in [('empty', b''), ('malformed', b'never'), ('invalid calendar', b'2026-02-30T01:02:03.004Z')]:
        check('sitemap '+label, sitemap.replace(stamp, replacement), 'sitemap.xml', sitemap, False)
    check('sitemap missing date', re.sub(rb'<lastmod>[^<]+</lastmod>', b'', sitemap, count=1), 'sitemap.xml', sitemap, False)
    check('sitemap unrelated URL', sitemap.replace(b'/Learning</loc>', b'/MISSING</loc>', 1), 'sitemap.xml', sitemap, False)
    check('sitemap dropped URL', re.sub(rb'<url>.*?</url>', b'', sitemap, count=1, flags=re.S), 'sitemap.xml', sitemap, False)
    blocks = list(re.finditer(rb'<url>.*?</url>', sitemap, re.S))
    a, b = blocks[:2]
    reordered = sitemap[:a.start()] + b.group() + sitemap[a.end():b.start()] + a.group() + sitemap[b.end():]
    order_rows = check('sitemap order stays strict beside allowed dates',
                       reordered.replace(stamp, b'2026-09-21T01:02:03.004Z'), 'sitemap.xml', sitemap, False)
    assert any(r[1] == 'order_sha' for r in order_rows), order_rows
    check('RSS pubDate only', feed.replace(b'Sun, 20 Sep 2026', b'Mon, 21 Sep 2026'), 'index.xml', feed, True)
    check('RSS independent checkout selection' if other_feed_path else 'RSS eligible selection fixture', other_feed, 'index.xml', feed, True)
    for label, raw in [
        ('item omitted', re.sub(rb'<item>.*?</item>', b'', other_feed, count=1, flags=re.S)),
        ('duplicate item', re.sub(rb'<item>.*?</item>', re.search(rb'<item>.*?</item>', other_feed, re.S).group(), other_feed, count=2, flags=re.S)),
        ('title corrupt', other_feed.replace(b'<title>Privacy Policy</title>', b'<title>Wrong title</title>', 1)),
        ('description corrupt', other_feed.replace(b'How BJJGraph collects', b'WRONG BJJGraph collects', 1)),
        ('newly selected title corrupt', other_feed.replace(escape(new_item.findtext('title')).encode(), b'CORRUPTED TITLE', 1)),
        ('non-corpus URL', other_feed.replace(b'https://bjjgraph.org/privacy', b'https://bjjgraph.org/NOT-IN-CORPUS')),
        ('date invalid calendar', re.sub(rb'<pubDate>[^<]+</pubDate>', b'<pubDate>Mon, 30 Feb 2026 00:00:00 GMT</pubDate>', other_feed, count=1)),
        ('guid corrupt', other_feed.replace(b'<guid>https://bjjgraph.org/privacy</guid>', b'<guid>https://bjjgraph.org/terms</guid>', 1)),
        ('date missing', re.sub(rb'<pubDate>[^<]+</pubDate>', b'', other_feed, count=1)),
        ('date malformed', re.sub(rb'<pubDate>[^<]+</pubDate>', b'<pubDate>invalid</pubDate>', other_feed, count=1)),
        ('date weekday wrong', re.sub(rb'<pubDate>[^<]+</pubDate>', b'<pubDate>Mon, 20 Sep 2026 00:00:00 GMT</pubDate>', other_feed, count=1)),
        ('channel changed', other_feed.replace(b'<title>BJJ Graph</title>', b'<title>WRONG</title>')),
        ('item format changed', other_feed.replace(b'<guid>', b'<guid extra="bad">', 1)),
        ('unrelated field added', other_feed.replace(b'</item>', b'<unexpected>1</unexpected></item>', 1)),
    ]:
        check('RSS '+label, raw, 'index.xml', feed, False)
    for label, changed_metadata in [('missing index', {k:v for k,v in metadata.items() if k!='static/contentIndex.json'}),
                                    ('missing page', {k:v for k,v in metadata.items() if k!='privacy.html'})]:
        differences=diff_record('index.xml', record(feed,'index.xml'), record(other_feed,'index.xml'),
                                site_records=(metadata,changed_metadata))
        allow=Allow(rules)
        assert any(not allow.suppress('index.xml',r[1],r[2],r[3]) for r in differences), label
        claims+=1; print('PASS XML RSS',label,'REJECTED')
    differences=diff_record('index.xml',record(feed,'index.xml'),record(other_feed,'index.xml'))
    allow=Allow(rules)
    assert any(not allow.suppress('index.xml',r[1],r[2],r[3]) for r in differences)
    claims+=1; print('PASS XML RSS missing cross-artifact context REJECTED')
    from emit_fingerprint import fingerprint_json
    index_raw = (tree/'static/contentIndex.json').read_bytes()
    index_data = json.loads(index_raw)
    reordered_index = json.dumps(dict(reversed(list(index_data.items()))),
                                 ensure_ascii=False, separators=(',', ':')).encode()
    def index_record(raw):
        return {'cls': 'json_semantic', 'sha': sha(raw), 'size': len(raw),
                'fp': fingerprint_json(raw, 'static/contentIndex.json')}
    gi, ci = index_record(index_raw), index_record(reordered_index)
    assert gi['fp']['canon_sha'] == ci['fp']['canon_sha'] and gi['sha'] != ci['sha']
    differences = diff_record('static/contentIndex.json', gi, ci)
    allow = Allow(rules)
    assert any(not allow.suppress('static/contentIndex.json',r[1],r[2],r[3]) for r in differences)
    claims+=1; print('PASS contentIndex key order REJECTED independently of RSS')
    # Existing manifests with old Head value proofs must no longer activate the fallback.
    from emit_fingerprint import fingerprint_html, html_value_proofs
    page=(tree/'Positions/Mount.html').read_bytes()
    changed=re.sub(rb'("datePublished":")([^"]+)', rb'\g<1>2026-09-21T01:02:03.004Z',page,count=1)
    def html_record(b):
        return {'cls':'html','sha':sha(b),'size':len(b),'fp':fingerprint_html(b,'page.html'),'value_proofs':html_value_proofs(b)}
    diffs=diff_record('page.html',html_record(page),html_record(changed))
    assert diffs and not any(r[1]=='html.value.published-time' for r in diffs), diffs
    claims+=1
    old_g, old_c = html_record(page), html_record(changed)
    for rec, stamp in [(old_g,'2026-09-20T17:15:14.688Z'),(old_c,'2026-09-21T01:02:03.004Z')]:
        rec['value_proofs']['published-time']={'valid':True,'sha':'legacy-masked-proof',
            'counts':{'published-time':1},'values':{'published-time':[stamp]}}
    diffs=diff_record('page.html',old_g,old_c)
    assert diffs and not any(r[1]=='html.value.published-time' for r in diffs), diffs
    claims+=1
    print(f'PASS coverage: {claims} XML/date scope proofs; item membership/order allowance never licenses missing or corrupted content')


def emit_record_proofs():
    from seam_golden import envelope, encoded, load_record
    base = envelope('emit', 'Assets', {'emitter': 'Assets', 'files': {}, 'returned_paths': []},
                    {'files': 0, 'returned_paths': 0, 'seeded_files': 0, 'parity_files': 0, 'emitter_runs': 1},
                    {'empty_output': {'reason': 'no eligible fixture input', 'evidence': 'fixture discovery'},
                     'corpus': {'discovered_all': 8}, 'seeded_regions': []})
    cases = [('completed empty emitter observation', base, True)]
    for name, mutate in [
        ('emitter never ran', lambda r: r['coverage'].update(emitter_runs=0)),
        ('empty output undeclared', lambda r: r['provenance'].pop('empty_output')),
        ('malformed empty-output attestation', lambda r: r['provenance'].update(empty_output='not an object')),
        ('zero discovered input corpus', lambda r: r['provenance']['corpus'].update(discovered_all=0)),
        ('invented positive file count', lambda r: r['coverage'].update(files=1)),
        ('return count mismatch', lambda r: r['coverage'].update(returned_paths=1)),
        ('unmatched seeded declaration', lambda r: r['provenance'].update(seeded_regions=[{
            'path': 'static/neural/', 'files': 1, 'reason': 'fixture', 'evidence': 'fixture'}])),
    ]:
        r = copy.deepcopy(base); mutate(r); cases.append((name, r, False))
    with tempfile.TemporaryDirectory(prefix='emit-record-proof-') as d:
        path = Path(d) / 'record.json'
        for name, record, want in cases:
            path.write_bytes(encoded(record))
            try:
                load_record(path); valid = True
            except (ValueError, KeyError, TypeError):
                valid = False
            assert valid == want, (name, valid, want)
            print(f'PASS {name}: record valid={valid}')
    print(f'PASS coverage: {len(cases)} emitter-record instrument assertions; zero files never means positive file parity')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tree', type=Path, required=True)
    ap.add_argument('--seeded', action='store_true')
    ap.add_argument('--values', action='store_true')
    ap.add_argument('--emit', action='store_true')
    ap.add_argument('--xml-dates', action='store_true')
    ap.add_argument('--rss-other', type=Path, help='optional second actual RSS capture for set-drift proof')
    args = ap.parse_args()
    if args.seeded:
        seeded_region_proofs()
    if args.values:
        value_proofs(args.tree)
    if args.xml_dates:
        xml_date_proofs(args.tree, args.rss_other)
    if args.emit:
        emit_record_proofs()
    runner = Path(__file__).with_name('seam_golden.py')
    page = 'Positions/Mount.html'
    raw = (args.tree / page).read_bytes()
    claims = 0
    with tempfile.TemporaryDirectory(prefix='seam-proof-') as tmp:
        tmp = Path(tmp)
        records, candidate = tmp / 'records', tmp / 'candidate.html'

        def run(want, name, *argv):
            nonlocal claims
            start = time.perf_counter()
            p = subprocess.run([sys.executable, str(runner), *map(str, argv)],
                               capture_output=True, text=True)
            elapsed = time.perf_counter() - start
            assert p.returncode == want, (name, p.returncode, p.stdout, p.stderr)
            assert 'coverage' in p.stdout.lower(), (name, p.stdout, p.stderr)
            claims += 1
            print(f'PASS {name}: exit={want}, {elapsed:.3f}s')
            return elapsed

        run(0, 'extract actual incumbent page', 'extract-render', '--tree', args.tree,
            '--out', records, '--page', page)
        candidate.write_bytes(raw)
        elapsed = run(0, 'identical actual page', 'verify', '--golden', records / (page + '.json'),
                      '--candidate', candidate)
        assert elapsed < 1, f'one-page verification took {elapsed:.3f}s (limit <1s)'
        candidate.write_bytes(raw + b'\n')
        run(1, 'single byte format drift', 'verify', '--golden', records / (page + '.json'),
            '--candidate', candidate)
        assert b'class="category-nav' in raw
        candidate.write_bytes(raw.replace(b'class="category-nav', b'class="lost-category-nav', 1))
        run(1, 'CategoryNav marker lost', 'verify', '--golden', records / (page + '.json'),
            '--candidate', candidate)
        candidate.write_bytes(b'')
        run(2, 'empty candidate', 'verify', '--golden', records / (page + '.json'),
            '--candidate', candidate)
        run(2, 'missing candidate', 'verify', '--golden', records / (page + '.json'),
            '--candidate', tmp / 'missing.html')
        blind = tmp / 'blind.json'
        blind.write_text('{}')
        run(2, 'blind golden', 'verify', '--golden', blind, '--candidate', candidate)
        empty = tmp / 'empty'
        empty.mkdir()
        run(2, 'zero-page extraction', 'extract-render', '--tree', empty, '--out', tmp / 'none')
        from seam_golden import envelope, encoded
        typed = tmp / 'typed-golden.json'
        typed.write_bytes(encoded(envelope('transform', 'typed', {'flag': True, 'items': [1, 2]},
                                          {'files': 1}, {'fixture': 'JSON value types'})))
        candidate.write_text('{"flag":1,"items":[1,2]}')
        run(1, 'JSON boolean is not number', 'verify', '--golden', typed, '--candidate', candidate)
        candidate.write_text('{"items":[1,2],"flag":true}')
        run(0, 'object key order is immaterial', 'verify', '--golden', typed, '--candidate', candidate)
        candidate.write_text('{"flag":true,"items":[2,1]}')
        run(1, 'array order remains pinned', 'verify', '--golden', typed, '--candidate', candidate)
    print(f'PASS coverage: {claims} seam assertions; all mutants killed')


if __name__ == '__main__':
    main()
