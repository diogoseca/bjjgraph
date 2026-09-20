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
        ('date value', raw.replace(old, b'2026-09-21T12:34:56.789Z'), True),
        ('footer year', raw.replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © 2027'.encode()), True),
        ('missing date', raw.replace(b'"datePublished":"' + old + b'",', b''), False),
        ('missing published meta', re.sub(rb'<meta\b[^>]*property="article:published_time"[^>]*>', b'', raw), False),
        ('malformed date', raw.replace(old, b'not-a-date'), False),
        ('invalid calendar date', raw.replace(old, b'2026-02-30T12:34:56.789Z'), False),
        ('missing footer year', raw.replace('BJJGraph.org © 2026'.encode(), b'BJJGraph.org'), False),
        ('malformed footer year', raw.replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © unknown'.encode()), False),
        ('date and year together', raw.replace(old, b'2026-09-21T12:34:56.789Z').replace('BJJGraph.org © 2026'.encode(), 'BJJGraph.org © 2027'.encode()), True),
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
    args = ap.parse_args()
    if args.seeded:
        seeded_region_proofs()
    if args.values:
        value_proofs(args.tree)
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
