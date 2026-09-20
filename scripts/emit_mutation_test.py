#!/usr/bin/env python3
"""Mutation proofs for V's instruments, using actual entry points and emitted bytes.

  python3 scripts/emit_mutation_test.py --capture-driver
  python3 scripts/emit_mutation_test.py --app-assets
  python3 scripts/emit_mutation_test.py --date-cardinality

The capture-driver suite uses tiny local command fixtures, never npm/network or a
site build. It pins supplied step order/cwd, fail-fast execution, positive output,
immutable labels, authority identity, capture-year provenance and validation-only
mode. It does not prove the deploy list agrees with workflows (F owns that gate),
browser behavior, any complete build, keyed injection or dependency closure.

The recon's 15-regression corpus table is not yet implemented here; no kill claim
for those cases follows from the driver suite. Per-page and value-rule mutants live
in seam_golden_selftest.py. Empty emit observations do not prove unexercised output
branches: positive emitter fixtures belong to B.

The app-assets suite drives check_build_fingerprint.capture on real tiny filesystem
trees. It pins named additions, removals, same-count renames, same-size JS/CSS edits,
recursive discovery, and rejection of empty or corrupt inventories. It does not
prove browser behavior or generation of seeded assets. The golden's app region has
two files and no deferred asset yet; fixtures exercise those absent branches.
The date-cardinality suite pins retirement of BOTH exact timestamp counts without
forgiving missing meta tags or changes to unrelated fields. It does not assert date
spread or validate git provenance; that remains an explicit X-01 integration gap.
"""
import copy
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def app_assets_suite():
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-app-assets-') as tmp:
        root = Path(tmp)
        app = root / 'static/neural/app'
        app.mkdir(parents=True)
        js = app / 'neural.js'; js.write_bytes(b'let fixture=1;')
        css = app / 'neural.css'; css.write_bytes(b'.fixture{color:red}')
        base = gate.capture(1, root)
        assert base.get('app_assets', {}).get('count') == 2, 'app/ files were not inventoried'
        assert set(base['app_assets']['files']) == {
            'static/neural/app/neural.js', 'static/neural/app/neural.css'}
        for path in (js, css):
            record = base['app_assets']['files'][path.relative_to(root).as_posix()]
            assert record == {'bytes': path.stat().st_size,
                              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        checked = 0
        def expect(label, cur, *needles):
            nonlocal checked
            problems = gate.check_census(base, cur)
            if needles:
                for needle in needles:
                    assert any(needle in p for p in problems), (label, needle, problems)
            else:
                assert not problems, (label, problems)
            checked += 1
            print(f'PASS app {label}: covered_files={cur["app_assets"]["count"]}')
        expect('identical', gate.capture(1, root))
        for path in (js, css):
            old = path.read_bytes()
            path.write_bytes(bytes([old[0] ^ 1]) + old[1:])
            expect('same-size edit ' + path.name, gate.capture(1, root),
                   'app asset ' + path.relative_to(root).as_posix() + ': CHANGED')
            path.write_bytes(old)
        deferred = app / 'reading.css'; deferred.write_bytes(b'.reading{}')
        expect('new deferred CSS', gate.capture(1, root),
               'app asset static/neural/app/reading.css: ADDED', 'app asset count: 2 -> 3')
        deferred.unlink()
        renamed = app / 'reference.css'; css.rename(renamed)
        expect('same-count rename', gate.capture(1, root),
               'app asset static/neural/app/neural.css: REMOVED',
               'app asset static/neural/app/reference.css: ADDED')
        renamed.rename(css)
        old = css.read_bytes(); css.unlink()
        expect('removed CSS', gate.capture(1, root),
               'app asset static/neural/app/neural.css: REMOVED')
        css.write_bytes(old)
        nested = app / 'chunks/.future.bin'; nested.parent.mkdir()
        nested.write_bytes(b'\x00\x01')
        expect('new nested arbitrary extension', gate.capture(1, root),
               'app asset static/neural/app/chunks/.future.bin: ADDED')
        nested.unlink()
        # A malformed baseline must fail too, including empty compared to empty.
        for label, value in (
            ('zero', {'count': 0, 'files': {}}),
            ('invented count', {**base['app_assets'], 'count': 3}),
            ('missing block', None),
            ('bad hash', {'count': 1, 'files': {'static/neural/app/bad.js':
                                               {'bytes': 1, 'sha256': 'bad'}}}),
        ):
            bad = copy.deepcopy(base); bad['app_assets'] = value
            assert gate.check_app_assets(bad, 'candidate'), label
            assert gate.check_census(bad, bad), label + ' matched itself cleanly'
            checked += 1; print(f'PASS app invalid {label}')
        shutil.rmtree(app)
        (root / 'unrelated.txt').write_text('the tree exists, the app region does not')
        empty = gate.capture(1, root)
        assert any('app assets' in p for p in gate.check_floors(empty))
        checked += 1; print('PASS app missing region: covered_files=0 rejected')
        print(f'PASS coverage: {checked} app-assets cases; real filesystem mutations, no build')


def date_cardinality_suite():
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-date-cardinality-') as tmp:
        root = Path(tmp)
        (root / 'static/neural/app').mkdir(parents=True)
        (root / 'static/neural/app/fixture.js').write_text('fixture')
        page = root / 'index.html'
        published = '<meta property="article:published_time" content="2026-09-20T17:15:14.688Z">'
        modified = '<meta property="article:modified_time" content="2026-07-16T13:14:23.000Z">'
        html = '<html><head>' + published + modified + '</head><body></body></html>'
        page.write_text(html)
        base = gate.capture(1, root)
        for field in ('property=article:published_time', 'property=article:modified_time'):
            assert field not in base['distinct_values'], 'capture would re-seed ' + field
        print('PASS dates: capture omits both retired cardinalities')
        for field, value in (('property=article:published_time', 888),
                             ('property=article:modified_time', 28)):
            restored = copy.deepcopy(base); restored['distinct_values'][field] = value
            problems = gate.check_census(restored, base)
            assert any('retired date row' in p and field in p for p in problems), (
                'clean JSON merge silently restored retired row', field, problems)
            print('PASS dates: restored baseline ' + field + ' is RED')
        for tag, name in ((published, 'published'), (modified, 'modified')):
            page.write_text(html.replace(tag, ''))
            problems = gate.check_census(base, gate.capture(1, root))
            assert any('meta key property=article:' + name + '_time' in p for p in problems), problems
            print('PASS dates: missing ' + name + ' tag remains RED')
        cur = copy.deepcopy(base); cur['distinct_values']['name=description'] = 999
        assert any('name=description' in p for p in gate.check_census(base, cur))
        print('PASS dates: unrelated distinct-value row remains RED')
        baseline = root / 'baseline.json'
        for label, key, value in [('valid', None, None),
                                  ('published row restored', 'property=article:published_time', 888),
                                  ('modified row restored', 'property=article:modified_time', 28)]:
            observed = copy.deepcopy(base)
            if key:
                observed['distinct_values'][key] = value
            baseline.write_text(json.dumps(observed))
            proc = subprocess.run([sys.executable, str(Path(gate.__file__)), '--check-baseline',
                                   '--baseline', str(baseline), '--tree', str(root / 'NO-BUILT-TREE')],
                                  capture_output=True, text=True)
            assert proc.returncode == (1 if key else 0), (label, proc.stdout, proc.stderr)
            if key:
                assert 'retired date row ' + key in proc.stdout, proc.stdout
            else:
                assert 'app covered_files=1' in proc.stdout and 'built_tree_files_scanned=0' in proc.stdout
            print(f'PASS baseline CLI {label}: exit={proc.returncode}, no tree required')
        print('PASS coverage: 9 date-cardinality cases; spread and provenance unasserted')


def capture_driver_suite():
    original = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='v-capture-driver-', dir='/home/user/tmp-pw') as tmp:
        root = Path(tmp) / 'repo'; root.mkdir()
        for d in ('scripts', 'source', 'content', 'bin'):
            (root / d).mkdir()
        for name in ('emit_golden.sh', 'emit_fingerprint.py'):
            shutil.copyfile(original / name, root / 'scripts' / name)
        (root / 'source/package-lock.json').write_text('{}')
        (root / 'content/page.md').write_text('fixture')
        (root / 'authority.md').write_text('Three local fixture steps, in declared order.')
        # Any accidental legacy npm build must stop locally, never reach a package tool.
        for binary in ('npm', 'npx'):
            p = root / 'bin' / binary; p.write_text('#!/bin/sh\nexit 93\n'); p.chmod(0o755)
        subprocess.run(['git', 'init', '-q', str(root)], check=True)
        subprocess.run(['git', '-C', str(root), 'add', 'authority.md', 'source/package-lock.json', 'content/page.md'], check=True)
        subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'fixture inputs'], check=True)
        env = os.environ.copy(); env['PATH'] = str(root / 'bin') + os.pathsep + env['PATH']
        for k in ('POSTHOG_API_KEY', 'POSTHOG_API_HOST', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AFFILIATE_REF', 'SHOW_BREADCRUMBS'):
            env.pop(k, None)
        html = '<!DOCTYPE html><html><head><title>Fixture</title><link rel="canonical" href="https://example.invalid/"><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><article>fixture</article></body></html>'
        plan = {'schema': 'quartz-capture-steps-v1', 'authority': {
            'path': str(root / 'authority.md'), 'sha256': hashlib.sha256((root / 'authority.md').read_bytes()).hexdigest()},
            'steps': [
                {'cwd': 'repo', 'argv': [sys.executable, '-c', "from pathlib import Path; Path('order').write_text('1'); Path('source/public').mkdir()"]},
                {'cwd': 'source', 'argv': [sys.executable, '-c', "from pathlib import Path; p=Path('../order'); p.write_text(p.read_text()+'2'); Path('public/index.html').write_text(" + repr(html) + ")"]},
                {'cwd': 'repo', 'argv': [sys.executable, '-c', "from pathlib import Path; p=Path('order'); p.write_text(p.read_text()+'3')"]},
            ]}
        steps = root / 'steps.json'; steps.write_text(json.dumps(plan))
        dest = Path(tmp) / 'goldens'; checked = 0
        def run(label, want, *flags):
            nonlocal checked
            p = subprocess.run(['bash', str(root / 'scripts/emit_golden.sh'), str(dest), label,
                                '--steps', str(steps), *flags], cwd=root, env=env, capture_output=True, text=True)
            assert p.returncode == want, (label, p.returncode, want, p.stdout[-2200:], p.stderr[-2200:])
            checked += 1; print(f'PASS capture {label}: exit={want}')
            return p
        run('validation', 0, '--check-steps')
        assert not (root / 'order').exists() and not dest.exists(), 'validation executed or wrote capture'
        run('complete', 0)
        assert (root / 'order').read_text() == '123'
        assert (dest / 'complete/index.html').read_text() == html
        meta = (dest / 'complete.env.txt').read_text()
        assert 'capture_year' in meta and 'capture_id' in meta and 'steps_sha256' in meta
        events = json.loads((dest / 'complete.steps-run.json').read_text())
        assert len(events) == 3 and all(e['exit_code'] == 0 for e in events)
        run('complete', 2)
        assert (dest / 'complete/index.html').read_text() == html, 'existing golden overwritten'
        failing = json.loads(json.dumps(plan)); failing['steps'][1]['argv'] = [sys.executable, '-c', 'raise SystemExit(7)']
        # First step no longer creates an existing directory.
        failing['steps'][0]['argv'] = [sys.executable, '-c', "from pathlib import Path; Path('order').write_text('1')"]
        steps.write_text(json.dumps(failing)); run('fail-fast', 7)
        assert (root / 'order').read_text() == '1' and not (dest / 'fail-fast').exists()
        events = json.loads((dest / 'fail-fast.steps-run.json').read_text())
        assert len(events) == 2 and events[-1]['exit_code'] == 7
        empty = {**plan, 'steps': []}; steps.write_text(json.dumps(empty)); run('zero-steps', 2, '--check-steps')
        wrong = {**plan, 'authority': {**plan['authority'], 'sha256': '0' * 64}}
        steps.write_text(json.dumps(wrong)); run('wrong-authority', 2, '--check-steps')
        preflight = {**plan, 'preflight_steps': [{'cwd': 'repo', 'argv': [sys.executable, '-c', 'raise SystemExit(6)']}]}
        (root / 'order').write_text('unchanged')
        steps.write_text(json.dumps(preflight)); run('preflight-fails', 6)
        assert (root / 'order').read_text() == 'unchanged' and not (dest / 'preflight-fails').exists()
        no_output = {**plan, 'steps': [{'cwd': 'repo', 'argv': [sys.executable, '-c', "import shutil; shutil.rmtree('source/public')"]}]}
        steps.write_text(json.dumps(no_output)); run('zero-output', 2)
        assert not (dest / 'zero-output').exists()
        wrong_env = {**plan, 'environment': {'SHOW_BREADCRUMBS': 'fixture'}}
        steps.write_text(json.dumps(wrong_env)); run('wrong-environment', 2)
        steps.write_text(json.dumps(plan)); (root / 'source/.env').write_text('FIXTURE=not-secret')
        run('ambient-dotenv', 2)
        print(f'PASS coverage: {checked} capture-driver cases; no full build or network command executed')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--capture-driver', action='store_true')
    ap.add_argument('--app-assets', action='store_true')
    ap.add_argument('--date-cardinality', action='store_true')
    args = ap.parse_args()
    if not (args.capture_driver or args.app_assets or args.date_cardinality):
        ap.error('select --capture-driver, --app-assets or --date-cardinality; no empty test run')
    if args.capture_driver:
        capture_driver_suite()
    if args.app_assets:
        app_assets_suite()
    if args.date_cardinality:
        date_cardinality_suite()
