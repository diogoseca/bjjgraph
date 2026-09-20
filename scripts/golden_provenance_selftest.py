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

SCRIPTS = Path(__file__).resolve().parent


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
        git('add', dirty.name); git('commit', '-qm', 'unrelated code commit')
        assert inspect_content(complete, repo)['state'] == 'MATCH', 'HEAD alone is over-scoped'
        # Cumulative comparison must see an old content change through a later no-op integration.
        page.write_text('owner edit'); git('add', 'content'); git('commit', '-qm', 'owner content edit')
        (repo / 'later.txt').write_text('unrelated'); git('add', 'later.txt'); git('commit', '-qm', 'later integration')
        assert inspect_content(complete, repo)['state'] == 'DRIFTED'
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
        print('PASS content contracts: exact one-file corpus; unrelated commit accepted; cumulative/dirty/new/ignored drift rejected; unknown and hidden Git inputs unverified')


if __name__ == '__main__':
    main()
