#!/usr/bin/env python3
"""Fast, strict seam goldens from the incumbent (P1-P4: every byte matters).

  python3 scripts/seam_golden.py extract-render --tree BUILD0 --out SEAMS/render
  python3 scripts/seam_golden.py verify --golden SEAMS/render/Positions/Mount.html.json \
      --candidate /path/to/one-rendered-page.html
  python3 scripts/seam_golden.py verify --golden SEAMS/transform/FILE/STAGE.json \
      --candidate /path/to/candidate-record.json

Exit 0: exact parity; 1: comparable candidate differs; 2: no trustworthy verdict
(missing/empty/unparseable input, blind golden, or invalid instrument).
One record is loaded per verification, never the full-site fingerprint. JSON seams
compare their `data` values exactly (object key order is not a JSON contract; array
order, AST positions, metadata, and all string bytes are). Render records retain
the full-page SHA, ordered head tuples, exact article HTML and its SHA, plus the
existing fingerprint's diagnostics. No normalization is applied, including dates.

Pinned by seam_golden_selftest.py: actual incumbent page passes in <1s; byte-only
drift and lost CategoryNav exit 1; absent/empty candidate exits 2; blind golden and
empty extraction fail; JSON booleans cannot compare equal to numbers, object keys
are unordered and array order is pinned. The corpus mutation table lives in
emit_mutation_test.py.

BLIND SPOTS: one-file success cannot see omitted sibling pages, emitter scheduling,
browser execution, layout, network/Cloudflare behavior, analytics ingestion, or a
secret-bearing deploy not represented by the golden. AST equality does not prove
render equality. Keyless build0 cannot prove keyed PostHog/affiliate behavior.
An emit manifest sees output bytes, not which source operation produced them.
Use emit_diff.py for the complete file set; keep browser and keyed-environment gates.
An explicitly completed empty emitter observation may pass with files=0 ONLY when
emitter_runs=1, discovered input coverage is positive, and emptiness has a reason
and evidence. This is evidence of observed emptiness, not of an unexercised output
branch. Never-ran, undeclared emptiness and inconsistent counts remain exit 2.
Pinned by seam_golden_selftest.py --emit (D-65).
"""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import json
from pathlib import Path, PurePosixPath
import re
import sys
import time

from emit_diff import diff_record
from emit_fingerprint import fingerprint_html, sha

SCHEMA = 'quartz-seam-v1'


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def envelope(seam, key, data, coverage, provenance):
    return dict(schema=SCHEMA, seam=seam, key=key, data=data, coverage=coverage,
                data_sha256=sha(encoded(data)), provenance=provenance)


def relative_path(value):
    p = PurePosixPath(value)
    if not value or p.is_absolute() or '..' in p.parts or str(p) != value:
        raise ValueError(f'expected a relative POSIX path, got {value!r}')
    return value


def render_data(raw, key):
    if not raw:
        raise ValueError(f'{key}: empty HTML')
    text = raw.decode('utf-8')
    fp = fingerprint_html(raw, key)
    if fp.get('parse_error') or fp.get('parse_warnings') or fp.get('n_jsonld_unparseable'):
        raise ValueError(f'{key}: invalid HTML/JSON-LD: {fp.get("parse_error") or fp.get("parse_warnings") or "JSON-LD parse error"}')
    heads = re.findall(r'<head\b[^>]*>.*?</head\s*>', text, re.S | re.I)
    articles = re.findall(r'<article\b[^>]*>.*?</article\s*>', text, re.S | re.I)
    if len(heads) != 1 or not fp.get('head_seq'):
        raise ValueError(f'{key}: coverage requires exactly one nonempty head')
    if len(articles) > 1 or bool(articles) != bool(fp.get('article')):
        raise ValueError(f'{key}: article coverage mismatch')
    article = articles[0] if articles else None
    return dict(record=dict(cls='html', size=len(raw), sha=sha(raw), fp=fp),
                head_tuples=fp['head_seq'], head_html=heads[0],
                article_html=article, article_sha256=sha(article.encode()) if article is not None else None)


def render_coverage(data):
    fp = data['record']['fp']
    return dict(files=1, head_tuples=len(data['head_tuples']), articles=int(data['article_html'] is not None),
                jsonld_blocks=fp['n_jsonld'], article_links=(fp.get('article') or {}).get('n_links', 0))


def write_record(path, record):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = encoded(record) + b'\n'
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError(f'refusing to overwrite different golden: {path}; choose a new capture directory')
        return
    with path.open('xb') as f:
        f.write(raw)


def validate_emit_record(record):
    data, counts, provenance = record['data'], record['coverage'], record.get('provenance', {})
    if not isinstance(provenance, dict):
        raise ValueError('emitter provenance must be an object')
    files, returned = data.get('files'), data.get('returned_paths')
    if data.get('emitter') != record['key'] or not isinstance(files, dict) or not isinstance(returned, list):
        raise ValueError('invalid emitter identity/file inventory/return list')
    for name, item in files.items():
        relative_path(name)
        if not isinstance(item, dict) or type(item.get('size')) is not int or item['size'] < 0 or not re.fullmatch('[0-9a-f]{64}', str(item.get('sha256', ''))):
            raise ValueError(f'{name}: invalid filesystem size/hash')
    for name in returned:
        relative_path(name)
    for name in ('files', 'returned_paths', 'seeded_files', 'parity_files', 'emitter_runs'):
        if type(counts.get(name)) is not int or counts[name] < 0:
            raise ValueError(f'{name}: missing/noninteger emitter coverage')
    if counts['emitter_runs'] != 1 or counts['files'] != len(files) or counts['returned_paths'] != len(returned):
        raise ValueError('emitter execution or inventory count mismatch')
    regions = provenance.get('seeded_regions')
    if not isinstance(regions, list):
        raise ValueError('seeded_regions must be an explicit list')
    seeded = set()
    for region in regions:
        if not isinstance(region, dict):
            raise ValueError('seeded region must be an object')
        prefix = region.get('path', '')
        relative_path(prefix.rstrip('/'))
        matched = {p for p in files if p.startswith(prefix)} if prefix.endswith('/') else ({prefix} & files.keys())
        if not region.get('reason') or not region.get('evidence') or not matched or type(region.get('files')) is not int or region['files'] != len(matched):
            raise ValueError(f'{prefix}: seeded declaration must count this output record')
        seeded.update(matched)
    if counts['seeded_files'] != len(seeded) or counts['parity_files'] != len(files) - len(seeded):
        raise ValueError('seeded/parity coverage mismatch')
    if not files:
        empty = provenance.get('empty_output', {})
        corpus = provenance.get('corpus', {})
        if not isinstance(empty, dict) or not isinstance(corpus, dict):
            raise ValueError('empty-output attestation and corpus must be objects')
        discovered = corpus.get('discovered_all', 0)
        if returned or not empty.get('reason') or not empty.get('evidence') or type(discovered) is not int or discovered < 1:
            raise ValueError('empty emitter needs completed execution, reason/evidence and positive discovered corpus')


def load_record(path):
    raw = path.read_bytes()
    record = json.loads(gzip.decompress(raw) if raw.startswith(b'\x1f\x8b') else raw)
    if not isinstance(record, dict) or record.get('schema') != SCHEMA:
        raise ValueError(f'{path}: invalid golden schema')
    if record.get('seam') not in ('render', 'parse', 'transform', 'emit', 'post-process'):
        raise ValueError(f'{path}: unknown seam')
    if not record.get('key') or not isinstance(record.get('data'), dict) or not record['data'] or not isinstance(record.get('coverage'), dict) or not record['coverage']:
        raise ValueError(f'{path}: empty golden data/coverage')
    if record['seam'] == 'emit':
        validate_emit_record(record)
    elif type(record['coverage'].get('files')) is not int or record['coverage']['files'] < 1:
        raise ValueError(f'{path}: zero golden file coverage')
    if record.get('data_sha256') != sha(encoded(record['data'])):
        raise ValueError(f'{path}: golden data digest mismatch')
    if record['seam'] == 'render':
        d = record['data']
        if not d.get('head_tuples') or d.get('record', {}).get('size', 0) < 1:
            raise ValueError(f'{path}: blind render golden')
        if render_coverage(d) != record['coverage']:
            raise ValueError(f'{path}: render coverage mismatch')
    return record


def first_differences(g, c, path='data', limit=12):
    out = []

    def walk(a, b, key):
        if len(out) >= limit or encoded(a) == encoded(b):
            return
        if type(a) is not type(b):
            out.append(f'{key}: {type(a).__name__} -> {type(b).__name__}')
        elif isinstance(a, dict):
            for k in sorted(a.keys() | b.keys()):
                if k not in a or k not in b:
                    out.append(f'{key}.{k}: {"extra" if k not in a else "missing"}')
                else:
                    walk(a[k], b[k], f'{key}.{k}')
                if len(out) >= limit:
                    break
        elif isinstance(a, list):
            if len(a) != len(b):
                out.append(f'{key}.length: {len(a)} -> {len(b)}')
            for i, (av, bv) in enumerate(zip(a, b)):
                walk(av, bv, f'{key}[{i}]')
                if len(out) >= limit:
                    break
        else:
            # Do not leak deploy environment values in diagnostics.
            out.append(f'{key}: value differs')

    walk(g, c, path)
    return out


def extract_render(args):
    tree = args.tree.resolve(strict=True)
    pages = sorted(set(args.page)) if args.page else sorted(p.relative_to(tree).as_posix() for p in tree.rglob('*.html'))
    if not pages:
        raise ValueError('zero HTML pages selected')
    coverage = Counter()
    for key in pages:
        relative_path(key)
        raw = (tree / key).read_bytes()
        data = render_data(raw, key)
        counts = render_coverage(data)
        record = envelope('render', key, data, counts, dict(tree=str(tree)))
        write_record(args.out / (key + '.json'), record)
        coverage.update(counts)
    print(f'PASS coverage: {json.dumps(dict(coverage), sort_keys=True)}; render goldens={args.out}')
    return 0


def verify(args):
    golden = load_record(args.golden)
    print(f'coverage: golden={json.dumps(golden["coverage"], sort_keys=True)}; selected=1; seam={golden["seam"]}; key={golden["key"]}')
    if not args.candidate.is_file():
        print('FAIL candidate files=0: missing candidate')
        return 2
    try:
        raw = args.candidate.read_bytes()
        if golden['seam'] == 'render':
            candidate = render_data(raw, golden['key'])
            print(f'coverage: candidate={json.dumps(render_coverage(candidate), sort_keys=True)}')
        else:
            candidate = json.loads(gzip.decompress(raw) if raw.startswith(b'\x1f\x8b') else raw)
            if isinstance(candidate, dict) and candidate.get('schema') == SCHEMA:
                if candidate.get('seam') != golden['seam'] or candidate.get('key') != golden['key']:
                    raise ValueError('candidate seam/key does not match golden')
                candidate = candidate['data']
    except (ValueError, KeyError, OSError) as e:
        print(f'FAIL candidate coverage invalid: {e}')
        return 2
    # Python considers True == 1, including inside dicts/lists. JSON does not.
    if encoded(golden['data']) == encoded(candidate):
        print('PASS NO DIFFERENCES; compared=1')
        return 0
    if golden['seam'] == 'render':
        for sev, field, _g, _c in diff_record(golden['key'], golden['data']['record'], candidate['record'])[:12]:
            print(f'FAIL {sev} {field}')
    else:
        for finding in first_differences(golden['data'], candidate):
            print(f'FAIL {finding}')
    print('FAIL byte/value parity; compared=1')
    return 1


def main():
    start = time.perf_counter()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='command', required=True)
    p = sub.add_parser('extract-render')
    p.add_argument('--tree', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--page', action='append', default=[])
    p.set_defaults(run=extract_render)
    p = sub.add_parser('verify')
    p.add_argument('--golden', type=Path, required=True)
    p.add_argument('--candidate', type=Path, required=True)
    p.set_defaults(run=verify)
    args = ap.parse_args()
    try:
        result = args.run(args)
    except (ValueError, KeyError, OSError, TypeError) as e:
        print(f'ERROR instrument coverage invalid: {e}', file=sys.stdout)
        result = 2
    print(f'elapsed={time.perf_counter()-start:.3f}s')
    return result


if __name__ == '__main__':
    sys.exit(main())
