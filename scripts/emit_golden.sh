#!/usr/bin/env bash
# Execute one supplied emit chain, retain its receipt, then snapshot and fingerprint.
#
#   bash scripts/emit_golden.sh DEST LABEL --steps STEPS.json [--check-steps]
#
# The caller schedules the real run and holds the programme mutex in THIS invocation:
#   source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh mgr-cx-3 'Env B capture' && bash scripts/emit_golden.sh DEST LABEL --steps STEPS.json
# Never source the helper in a separate tool call: its EXIT trap releases the lock.
#
# --steps is the COMPLETE ordered chain; no implicit Neural or npm build prelude.
# Without it the legacy local chain is regenerate:neural then root build, explicitly
# labelled LOCAL, never DEPLOY. Env B uses F's ENVB-SPEC.md, not a guessed chain.
# --check-steps validates authority/schema and prints the plan WITHOUT executing,
# changing environment, creating capture files, or taking the mutex.
#
# Receipts: .env.txt (capture id/year/timezone/input identity), .steps.json (exact
# supplied plan), .steps-run.json (each start/end/exit/wall time), .build.log, and
# .inputs.json (source content byte/stat inputs). Failed chains retain receipts but
# do NOT produce an accepted snapshot. Existing labels are never overwritten.
# All files under the actual output filesystem are copied, not emitter return lists.
#
# BLIND SPOTS: one capture does not prove determinism, browser/CDN behavior, dependency
# closure, or the guarded branch of another environment. Same-checkout same-year
# pairs can hold birthtime and Footer year fixed (D-59). F owns workflow/order and
# Python-provisioning validation; V owns JS/TS specifiers. No normalization is applied.
# Capture-year metadata makes Footer rollover visible, not automatically forgiven.
# .capture-inputs.json names/hashes every Git-dirty path at both boundaries. Content
# must be clean and fully tracked (including no ignored extras); a changed HEAD or
# content during the chain prevents publication. .content.json binds the completed
# content proof to the emitted tree's named bytes. Old build0 has neither proof:
# its four unnamed dirty paths remain permanently input-unverified.
# Pinned by: python3 scripts/emit_mutation_test.py --capture-driver (tiny local steps).
set -euo pipefail
TASK_CAPTURE_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 - "$TASK_CAPTURE_REPO" "$@" <<'PY_CAPTURE'
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid

repo = Path(sys.argv[1])
sys.path.insert(0, str(repo / 'scripts'))
from golden_provenance import begin_capture, finish_capture, ProvenanceError
parser = argparse.ArgumentParser(description='Execute and attest a supplied emit chain; never overwrite a golden.')
parser.add_argument('dest', type=Path)
parser.add_argument('label')
parser.add_argument('--steps', type=Path)
parser.add_argument('--check-steps', action='store_true')
args = parser.parse_args(sys.argv[2:])
ENV_KEYS = ('POSTHOG_API_KEY', 'POSTHOG_API_HOST', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
            'AFFILIATE_REF', 'SHOW_BREADCRUMBS', 'CI', 'TZ', 'TMPDIR')

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def utc():
    return datetime.now(timezone.utc).isoformat()

def command(argv):
    return subprocess.check_output(argv, cwd=repo, text=True).strip()

def validate_plan(plan):
    if not isinstance(plan, dict) or plan.get('schema') != 'quartz-capture-steps-v1':
        raise ValueError('invalid step-list schema')
    authority = plan.get('authority', {})
    if not isinstance(authority, dict) or not authority.get('path') or not authority.get('sha256'):
        raise ValueError('step list requires authority path and sha256')
    if digest(Path(authority['path']).read_bytes()) != authority['sha256']:
        raise ValueError('step-list authority changed; obtain the current approved list')
    steps = plan.get('steps')
    preflight = plan.get('preflight_steps', [])
    if not isinstance(steps, list) or not steps or not isinstance(preflight, list):
        raise ValueError('zero/invalid supplied steps')
    for i, step in enumerate(preflight + steps, 1):
        if not isinstance(step, dict) or step.get('cwd') not in ('repo', 'source'):
            raise ValueError(f'step {i}: cwd must be repo or source')
        argv = step.get('argv')
        if not isinstance(argv, list) or not argv or any(not isinstance(s, str) or not s or '\x00' in s for s in argv):
            raise ValueError(f'step {i}: argv must be a nonempty string list')
    env = plan.get('environment', {})
    if not isinstance(env, dict) or any(k not in ENV_KEYS or (v is not None and not isinstance(v, str)) for k, v in env.items()):
        raise ValueError('invalid held-constant environment declaration')
    return preflight, steps

def main():
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.label):
        raise ValueError('label must be a single safe filename')
    if args.steps:
        plan = json.loads(args.steps.read_text())
    else:
        authority = repo / 'package.json'
        plan = {'schema': 'quartz-capture-steps-v1', 'kind': 'LOCAL, not DEPLOY',
                'authority': {'path': str(authority), 'sha256': digest(authority.read_bytes())},
                'steps': [{'cwd': 'repo', 'argv': ['npm', 'run', 'regenerate:neural']},
                          {'cwd': 'repo', 'argv': ['npm', 'run', 'build']}]}
    preflight, steps = validate_plan(plan)
    print(f'coverage: supplied_steps={len(steps)}, preflight_steps={len(preflight)}', flush=True)
    for group, rows in [('preflight', preflight), ('step', steps)]:
        for i, step in enumerate(rows, 1):
            # Do not dump arbitrary command arguments, which could contain environment values.
            print(f'{group} {i}: cwd={step["cwd"]}, executable={step["argv"][0]}, argc={len(step["argv"])}')
    if args.check_steps:
        print('PASS step list validated; executed_steps=0 (validation only)')
        return 0
    dest = args.dest.resolve()
    suffixes = ('', '.json.gz', '.env.txt', '.steps.json', '.steps-run.json', '.build.log', '.inputs.json', '.capture-inputs.json', '.content.json')
    if any((dest / (args.label + suffix)).exists() for suffix in suffixes):
        raise ValueError('capture label already exists; choose a new label, never overwrite')
    if (repo / 'source/.env').exists():
        raise ValueError('source/.env present: capture has an undeclared input')
    if (repo / '.env').exists() and not os.environ.get('AFFILIATE_REF'):
        raise ValueError('root .env could supply AFFILIATE_REF; capture requires an explicit environment')
    for key, value in plan.get('environment', {}).items():
        if os.environ.get(key) != value:
            raise ValueError(f'held-constant environment mismatch: {key} (values not printed)')
    # Check only this worktree; other programmes are outside our mutex (D-42).
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit() or int(proc.name) == os.getpid():
            continue
        try:
            cmd = (proc / 'cmdline').read_bytes().split(b'\0')
            cwd = (proc / 'cwd').resolve()
            if any(x.endswith(b'bootstrap-cli.mjs') for x in cmd) and b'build' in cmd and (cwd == repo or repo in cwd.parents):
                raise ValueError(f'another build is active in this worktree: pid={proc.name}')
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            pass
    os.environ.setdefault('TMPDIR', '/home/user/tmp-pw')
    runtime = json.loads(command(['node', '-e', 'process.stdout.write(JSON.stringify({year:new Date().getFullYear(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,versions:process.versions}))']))
    capture_id = uuid.uuid4().hex
    source_receipt = begin_capture(repo, capture_id)
    dest.mkdir(parents=True, exist_ok=True)
    prefix = dest / args.label
    def artifact(suffix):
        return Path(str(prefix) + suffix)
    source_receipt['output_roots'] = [str((repo / 'source/public').resolve()), str(prefix)]
    artifact('.capture-inputs.json').write_text(json.dumps(source_receipt, ensure_ascii=False, indent=2) + '\n')
    # Observer records may reference this receipt and capture ID. It is incomplete
    # until the full chain and input guard succeed; a failed run cannot attest inputs.
    os.environ['BJJ_CONTENT_RECEIPT'] = str(artifact('.capture-inputs.json'))
    os.environ['BJJ_CAPTURE_ID'] = capture_id
    plan_raw = (json.dumps(plan, ensure_ascii=False, indent=2) + '\n').encode()
    artifact('.steps.json').write_bytes(plan_raw)
    inputs = {}
    content_paths = sorted((repo / 'content').rglob('*.md'))
    # Node exposes birthtime on Linux; one batch avoids thousands of stat processes.
    stat_script = 'const fs=require("node:fs");const paths=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(JSON.stringify(Object.fromEntries(paths.map(p=>{const s=fs.statSync(p);return [p,{birthtimeMs:s.birthtimeMs,mtimeMs:s.mtimeMs}]}))))'
    node_stats = json.loads(subprocess.check_output(['node', '-e', stat_script], input=json.dumps([str(p) for p in content_paths]), text=True))
    for p in content_paths:
        st = p.stat()
        inputs[p.relative_to(repo).as_posix()] = {'sha256': digest(p.read_bytes()), 'size': st.st_size,
            'mtime_ns': st.st_mtime_ns, **node_stats[str(p)]}
    if not inputs:
        raise ValueError('zero source markdown inputs')
    artifact('.inputs.json').write_text(json.dumps(inputs, sort_keys=True, indent=2) + '\n')
    head = command(['git', 'rev-parse', 'HEAD'])
    dirty_sha = digest(subprocess.check_output(['git', 'diff', '--binary', 'HEAD'], cwd=repo))
    metadata = [f'label {args.label}', f'capture_id {capture_id}', f'repo {repo}', f'git_head {head}',
        f'git_dirty_diff_sha256 {dirty_sha}', f'git_status_paths {len(command(["git", "status", "--porcelain"]).splitlines())}',
        f'git_dirty_paths_json {json.dumps(source_receipt["dirty_paths_start"], ensure_ascii=False)}',
        f'capture_start_utc {utc()}', f'capture_year {runtime["year"]}', f'footer_rollover_year {runtime["year"] + 1}',
        f'timezone {runtime["timezone"]}', f'node_versions {json.dumps(runtime["versions"], sort_keys=True)}',
        f'python {sys.version.split()[0]}', f'steps_sha256 {digest(plan_raw)}',
        f'content_md {len(inputs)}', f'content_inputs_sha256 {digest(artifact(".inputs.json").read_bytes())}',
        f'quartz_lock_sha256 {digest((repo / "source/package-lock.json").read_bytes())}', 'source/.env absent']
    for key in ENV_KEYS:
        value = os.environ.get(key)
        metadata.append(f'env {key} ' + (f'SET(len={len(value)})' if value else 'unset'))
    artifact('.env.txt').write_text('\n'.join(metadata) + '\n')
    events = []
    secrets = [os.environ[k] for k in ENV_KEYS[:5] if os.environ.get(k)]
    with artifact('.build.log').open('x') as log:
        for group, rows in [('preflight', preflight), ('step', steps)]:
            for i, step in enumerate(rows, 1):
                cwd = repo / ('source' if step['cwd'] == 'source' else '.')
                event = {'group': group, 'number': i, 'cwd': step['cwd'], 'start_utc': utc(), 'exit_code': None}
                events.append(event)
                artifact('.steps-run.json').write_text(json.dumps(events, indent=2) + '\n')
                line = f'{group} {i}/{len(rows)} START {event["start_utc"]}\n'
                print(line, end='', flush=True); log.write(line); log.flush()
                start = time.monotonic()
                try:
                    process = subprocess.Popen(step['argv'], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace')
                    for line in process.stdout:
                        for secret in secrets:
                            line = line.replace(secret, '<ENV-REDACTED>')
                        print(line, end='', flush=True); log.write(line); log.flush()
                    code = process.wait()
                except OSError as e:
                    code = 127; log.write(f'command could not start: {type(e).__name__}\n')
                event.update(end_utc=utc(), wall_seconds=time.monotonic()-start, exit_code=code)
                artifact('.steps-run.json').write_text(json.dumps(events, indent=2) + '\n')
                if code:
                    print(f'FAIL {group} {i}: exit={code}; snapshot not created', flush=True)
                    return code if 0 < code < 126 else 2
    tree = repo / 'source/public'
    files = [p for p in tree.rglob('*') if p.is_file()]
    pages = sum(p.suffix == '.html' for p in files)
    if not files or not pages:
        raise ValueError(f'zero output coverage: files={len(files)}, html={pages}')
    completed_receipt = finish_capture(source_receipt, repo)
    # Keep a staging directory if copy is interrupted; never publish a partial golden.
    staging = dest / ('.' + args.label + '.capture-' + capture_id)
    shutil.copytree(tree, staging, symlinks=False)
    # Copying also takes time: assert again before publishing, not just before copy.
    completed_receipt = finish_capture(source_receipt, repo)
    staging.rename(prefix)
    receipt_tmp = artifact('.capture-inputs.json.tmp')
    receipt_tmp.write_text(json.dumps(completed_receipt, ensure_ascii=False, indent=2) + '\n')
    receipt_tmp.replace(artifact('.capture-inputs.json'))
    with artifact('.env.txt').open('a') as f:
        f.write(f'capture_end_utc {utc()}\ncapture_year_end {datetime.now().year}\n')
        f.write(f'git_head_end {command(["git", "rev-parse", "HEAD"])}\n')
        f.write(f'git_dirty_diff_sha256_end {digest(subprocess.check_output(["git", "diff", "--binary", "HEAD"], cwd=repo))}\n')
        f.write(f'git_dirty_paths_end_json {json.dumps(completed_receipt["dirty_paths_end"], ensure_ascii=False)}\n')
        f.write(f'completed_steps {len(steps)}\ncompleted_preflight_steps {len(preflight)}\nsnapshot_files {len(files)}\nsnapshot_html {pages}\n')
    print(f'PASS executed_steps={len(steps)}, snapshot_files={len(files)}, html={pages}', flush=True)
    return subprocess.call([sys.executable, str(repo / 'scripts/emit_fingerprint.py'), str(prefix),
                            '--out', str(artifact('.json.gz')), '--jobs', '1', '--label', f'{args.label} capture={capture_id} @ {head}',
                            '--source-repo', str(repo), '--content-receipt', str(artifact('.capture-inputs.json')),
                            '--write-content-receipt', str(artifact('.content.json'))])

try:
    raise SystemExit(main())
except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as e:
    print(f'ERROR capture has no verdict: {e}', file=sys.stderr)
    raise SystemExit(2)
PY_CAPTURE
