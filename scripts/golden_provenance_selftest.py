#!/usr/bin/env python3
"""Content-provenance contracts, on disposable Git repositories only.

Pins clean/current, cumulative drift, dirty and untracked/ignored content, unrelated
commits, unknown legacy capture, and named dirty paths. Does not establish build0's
missing input identity or verify renderer/code/environment provenance. Mutations
touch fixture files only; no product-source checkout/revert is used.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from contextlib import redirect_stdout
from io import StringIO

SCRIPTS = Path(__file__).resolve().parent


def baseline_bindings(repo, root, receipt):
    """Real baseline entry points; site-size floors reduced for this authored fixture.

    This proves receipt/update/compare wiring, not the production site-size floors.
    No product source or production artifact is changed.
    """
    import check_build_fingerprint as build
    import check_seo_parity as seo
    from emit_fingerprint import scan_tree
    from golden_provenance import output_identity, ProvenanceError
    public = root / 'public'; public.mkdir()
    raw = (root / 'index.html').read_bytes()
    for rel in seo.SAMPLE:
        p = public / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(raw)
    for rel in ('static/neural/app/neural.js', 'static/neural/app/neural.css', *build.BUNDLES):
        p = public / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text('fixture')
    receipt = {**receipt, 'output_roots': [str(public)], 'output_identity': output_identity(scan_tree(public, 1))}
    rp = root / 'built.content.json'; rp.write_text(json.dumps(receipt))
    budget = root / 'tests/artifacts/budget_site.json'; budget.parent.mkdir(parents=True)
    budget.write_text(json.dumps({'floors': {seo.SITE_FLOOR_KEY: 1}}))
    originals = (build.FLOORS, seo.ROOT, seo.PUBLIC, seo.BASELINE, sys.argv)
    build.FLOORS = {'files': 1, 'html_pages': 1}; seo.ROOT = root
    try:
        for name, module in [('build', build), ('seo', seo)]:
            baseline = root / (name + '-baseline.json')
            argv = ['fixture', '--source-repo', str(repo), '--tree', str(public), '--baseline', str(baseline)]
            if name == 'build': argv += ['--jobs', '1']
            sys.argv = [*argv, '--update', '--content-receipt', str(rp)]
            with redirect_stdout(StringIO()) as log:
                module.main()
            assert 'MATCH' in log.getvalue(), log.getvalue()
            baseline_before = baseline.read_bytes()
            sys.argv = argv
            with redirect_stdout(StringIO()) as log:
                module.main()
            assert 'MATCH' in log.getvalue() and ('OK' in log.getvalue()), log.getvalue()
            data = json.loads(baseline_before); del data['_meta']['content_provenance']
            baseline.write_text(json.dumps(data))
            try:
                with redirect_stdout(StringIO()): module.main()
                raise AssertionError(f'{name} accepted legacy current-content claim')
            except ProvenanceError as e:
                assert e.state == 'UNVERIFIED'
            sys.argv = [*argv, '--artifact-only']
            with redirect_stdout(StringIO()) as log: module.main()
            assert 'current-source parity NOT asserted' in log.getvalue()
            baseline.write_bytes(baseline_before); assert baseline.read_bytes() == baseline_before
            original = (public / 'index.html').read_bytes()
            (public / 'index.html').write_bytes(original + b'\n')
            sys.argv = [*argv, '--update', '--content-receipt', str(rp)]
            try:
                with redirect_stdout(StringIO()): module.main()
                raise AssertionError(f'{name} re-seeded stale output')
            except ProvenanceError as e:
                assert 'self-advancing baseline' in str(e)
            assert baseline.read_bytes() == baseline_before
            (public / 'index.html').write_bytes(original); assert (public / 'index.html').read_bytes() == original
            sys.argv = [*argv, '--update', '--artifact-only', '--content-receipt', str(rp)]
            try:
                with redirect_stdout(StringIO()): module.main()
                raise AssertionError(f'{name} allowed artifact-only baseline update')
            except ProvenanceError as e:
                assert '--artifact-only cannot authorize' in str(e)
            assert baseline.read_bytes() == baseline_before
            print(f'PASS {name} baseline entry: attested update + compare; legacy strict refusal + explicit artifact control; stale-tree update rejected without changing baseline')
    finally:
        build.FLOORS, seo.ROOT, seo.PUBLIC, seo.BASELINE, sys.argv = originals


def cli_legacy(root):
    from seam_golden import envelope, render_data, render_coverage
    raw = b'<html><head><title>Control</title><link rel="canonical" href="https://example.invalid/"></head><body><article>Control</article></body></html>'
    data = render_data(raw, 'index.html')
    page = root / 'index.html'; page.write_bytes(raw)
    golden = root / 'legacy.json'
    golden.write_text(json.dumps(envelope('render', 'index.html', data, render_coverage(data), {'git_head': '0' * 40})))
    p = subprocess.run([sys.executable, str(SCRIPTS / 'seam_golden.py'), 'verify',
                        '--golden', str(golden), '--candidate', str(page)], capture_output=True, text=True)
    assert p.returncode == 2, ('unattested legacy capture must not imply current-source parity', p.returncode, p.stdout)
    assert 'UNVERIFIED' in p.stdout, p.stdout
    control = subprocess.run([sys.executable, str(SCRIPTS / 'seam_golden.py'), 'verify',
                              '--artifact-only', '--golden', str(golden), '--candidate', str(page)],
                             capture_output=True, text=True)
    assert control.returncode == 0 and 'PASS NO DIFFERENCES; compared=1' in control.stdout
    assert 'current-source parity NOT asserted' in control.stdout
    before = golden.read_bytes()
    malformed = json.loads(before); malformed['provenance'] = []
    golden.write_text(json.dumps(malformed))
    broken = subprocess.run([sys.executable, str(SCRIPTS / 'seam_golden.py'), 'verify',
                             '--artifact-only', '--golden', str(golden), '--candidate', str(page)],
                            capture_output=True, text=True)
    assert broken.returncode == 2 and 'provenance metadata must be an object' in broken.stdout, (broken.returncode, broken.stdout, broken.stderr)
    golden.write_bytes(before); assert golden.read_bytes() == before
    from golden_provenance import receipt_from, inspect_content
    retained = root / 'retained-build'
    Path(str(retained) + '.env.txt').write_text('git_head ' + '1' * 40 + '\ngit_dirty 4 path(s)\n')
    legacy = inspect_content(receipt_from({'tree': str(retained)}), root)
    assert legacy['state'] == 'UNVERIFIED' and legacy['capture_git_head'] == '1' * 40
    assert 'dirty=4 path(s)' in legacy['reason']
    print('PASS legacy CLI: identical bytes cannot attest unknown capture inputs')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--legacy-only', action='store_true'); args = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='v-content-proof-') as tmp:
        root = Path(tmp)
        cli_legacy(root)
        if args.legacy_only:
            return
        from golden_provenance import begin_capture, finish_capture, inspect_content, ProvenanceError
        repo = root / 'repo'; repo.mkdir(); (repo / 'content').mkdir()
        def git(*argv):
            return subprocess.check_output(['git', '-C', str(repo), *argv], stderr=subprocess.PIPE, text=True).strip()
        git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
        page = repo / 'content/quoted "page".md'; page.write_text('authored fixture')
        (repo / '.gitignore').write_text('content/ignored.md\n')
        git('add', 'content', '.gitignore'); git('commit', '-qm', 'authored content')
        # Untracked and modified non-content paths are permitted but named and hashed.
        dirty = repo / 'dirty "input".txt'; dirty.write_text('code input')
        start = begin_capture(repo, 'fixture')
        assert [(x['path'], x['status']) for x in start['dirty_paths_start']] == [('dirty "input".txt', '??')]
        assert len(start['dirty_paths_start'][0]['sha256']) == 64
        complete = finish_capture(start, repo)
        assert complete['dirty_paths_end'] == start['dirty_paths_start']
        assert inspect_content(complete, repo)['state'] == 'MATCH'
        assert complete['content_files'] == 1 and complete['content_md'] == 1
        baseline_bindings(repo, root, complete)
        record_path = root / 'legacy.json'
        record = json.loads(record_path.read_text())
        record['provenance']['content_provenance'] = complete
        record_path.write_text(json.dumps(record))
        def seam(want, token):
            p = subprocess.run([sys.executable, str(SCRIPTS / 'seam_golden.py'), 'verify',
                                '--source-repo', str(repo), '--golden', str(record_path),
                                '--candidate', str(root / 'index.html')], capture_output=True, text=True)
            assert p.returncode == want and token in p.stdout, (want, token, p.stdout, p.stderr)
        seam(0, 'CONTENT golden: MATCH')
        git('add', dirty.name); git('commit', '-qm', 'unrelated code commit')
        assert inspect_content(complete, repo)['state'] == 'MATCH', 'HEAD alone is over-scoped'
        seam(0, 'PASS NO DIFFERENCES; compared=1')
        # Cumulative comparison must see an old content change through a later no-op integration.
        page.write_text('owner edit'); git('add', 'content'); git('commit', '-qm', 'owner content edit')
        (repo / 'later.txt').write_text('unrelated'); git('add', 'later.txt'); git('commit', '-qm', 'later integration')
        assert inspect_content(complete, repo)['state'] == 'DRIFTED'
        seam(2, 'EXIT 2 CONTENT_PROVENANCE_DRIFTED')
        current = finish_capture(begin_capture(repo, 'new'), repo)
        before = page.read_bytes(); page.write_text('uncommitted owner edit')
        assert inspect_content(current, repo)['state'] == 'DRIFTED'
        try:
            begin_capture(repo, 'dirty-content')
            raise AssertionError('capture accepted dirty content without an audited content tree')
        except ProvenanceError:
            pass
        page.write_bytes(before); assert page.read_bytes() == before
        for name in ('new.md', 'ignored.md'):
            extra = repo / 'content' / name; extra.write_text('added input')
            assert inspect_content(current, repo)['state'] == 'DRIFTED', name
            extra.unlink()
        assert inspect_content(None, repo)['state'] == 'UNVERIFIED'
        bad = {**current, 'content_clean_at_start': False}
        assert inspect_content(bad, repo)['state'] == 'UNVERIFIED'
        bad = {**current, 'content_tree': '0' * 40}
        assert inspect_content(bad, repo)['state'] == 'UNVERIFIED'
        git('update-index', '--assume-unchanged', '--', str(page.relative_to(repo)))
        assert inspect_content(current, repo)['state'] == 'UNVERIFIED', 'Git trust flags hide dirty bytes'
        git('update-index', '--no-assume-unchanged', '--', str(page.relative_to(repo)))
        pending = begin_capture(repo, 'moving')
        page.write_text('changed during capture')
        try:
            finish_capture(pending, repo)
            raise AssertionError('moving content accepted at completion')
        except ProvenanceError:
            pass
        page.write_bytes(before); assert page.read_bytes() == before
        assert inspect_content(current, repo)['state'] == 'MATCH'
        # Same named files, changed emitted bytes: a receipt cannot license --update.
        from golden_provenance import output_identity, read_capture_receipt
        from types import SimpleNamespace
        html = root / 'index.html'; raw = html.read_bytes()
        import hashlib
        current['output_roots'] = [str(root)]
        current['output_identity'] = output_identity({'index.html': {'size': len(raw), 'sha': hashlib.sha256(raw).hexdigest()}})
        receipt_path = root / 'receipt.json'; receipt_path.write_text(json.dumps(current))
        args = SimpleNamespace(content_receipt=receipt_path, source_repo=repo)
        actual = {'index.html': {'size': len(raw), 'sha': hashlib.sha256(raw).hexdigest()}}
        assert read_capture_receipt(args, root, files=actual, require_output_hash=True) == current
        actual['index.html']['sha'] = '0' * 64
        try:
            read_capture_receipt(args, root, files=actual, require_output_hash=True)
            raise AssertionError('re-seed accepted wrong tree bytes')
        except ProvenanceError as e:
            assert 'self-advancing baseline' in str(e)
        (repo / 'content/link.md').symlink_to(dirty)
        git('add', 'content/link.md'); git('commit', '-qm', 'unsupported external content link')
        assert inspect_content(current, repo)['state'] == 'UNVERIFIED'
        print('PASS content contracts: exact one-file corpus; unrelated commit accepted; cumulative/dirty/new/ignored drift rejected; unknown and hidden Git inputs unverified')


if __name__ == '__main__':
    main()
