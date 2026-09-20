#!/usr/bin/env python3
"""Seam runner red proofs: real incumbent page, byte drift, absence and blind data.

Run: python3 scripts/seam_golden_selftest.py --tree /path/to/build0
These tests do not render a second implementation. They mutate actual emitted bytes.
They do not cover browser behavior, the complete corpus, or keyed deploy behavior.
"""
import argparse
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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tree', type=Path, required=True)
    ap.add_argument('--seeded', action='store_true')
    args = ap.parse_args()
    if args.seeded:
        seeded_region_proofs()
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
    print(f'PASS coverage: {claims} seam assertions; all mutants killed')


if __name__ == '__main__':
    main()
