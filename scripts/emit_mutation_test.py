#!/usr/bin/env python3
"""Mutation proofs for V's instruments, using actual entry points and emitted bytes.

  python3 scripts/emit_mutation_test.py --capture-driver

The capture-driver suite uses tiny local command fixtures, never npm/network or a
site build. It pins supplied step order/cwd, fail-fast execution, positive output,
immutable labels, authority identity, capture-year provenance and validation-only
mode. It does not prove the deploy list agrees with workflows (F owns that gate),
browser behavior, any complete build, keyed injection or dependency closure.

The recon's 15-regression corpus table is not yet implemented here; no kill claim
for those cases follows from the driver suite. Per-page and value-rule mutants live
in seam_golden_selftest.py. Empty emit observations do not prove unexercised output
branches: positive emitter fixtures belong to B.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


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
    args = ap.parse_args()
    if not args.capture_driver:
        ap.error('select --capture-driver; no empty test run')
    capture_driver_suite()
