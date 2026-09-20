#!/usr/bin/env python3
"""Assert content provenance when a golden is USED, not just when it is captured.

The fast contract is the committed content/ tree plus a clean worktree at both
capture boundaries and at use. It checks the cumulative capture..current tree,
tracked modifications, ALL untracked content (including ignored files), and Git
assume-unchanged/skip-worktree flags. An unrelated commit does not stale content.
Dirty paths outside content are named and hashed; they are not claimed clean.

BLIND SPOTS: this proves content input identity, not code, dependencies, generated
inputs, timestamps, browser behavior, or a whole-site result. Git's worktree check
uses its index/stat machinery; this is not a fresh byte hash of every content file
per page, nor protection against a writer deliberately restoring file metadata.
No retrospective clean-tree inference is made from a recorded commit. In
particular build0's four unnamed dirty paths remain permanently UNVERIFIED.

Default consumers refuse a current-content verdict (exit 2) without this proof.
--artifact-only deliberately compares historical artifacts; it still prints the
content verdict and never claims source parity. Pure record loaders stay pure.
Pinned by golden_provenance_selftest.py: unrelated changes pass; cumulative,
dirty, added and ignored content changes fail; unknown receipts and hidden Git
inputs cannot become clean; actual CLI legacy green is rejected.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

SCHEMA = 'quartz-content-provenance-v1'
DEFAULT_REPO = Path(__file__).resolve().parent.parent


class ProvenanceError(ValueError):
    """Unavailable or contradictory input evidence, not an implementation error."""
    def __init__(self, message, state='UNVERIFIED'):
        super().__init__(message)
        self.state = state


def git(repo, *args):
    p = subprocess.run(['git', '-C', str(repo), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        raise ProvenanceError(f'git {args[0]} could not inspect inputs: {p.stderr.decode(errors="replace").strip()}')
    return p.stdout


def names(raw):
    return [os.fsdecode(x) for x in raw.split(b'\0') if x]


@lru_cache(maxsize=32)
def committed_content(repo, head):
    tree = git(repo, 'rev-parse', '--verify', f'{head}:content').decode().strip()
    entries = names(git(repo, 'ls-tree', '-r', '-z', tree))
    if any(not row.startswith(('100644 blob ', '100755 blob ')) for row in entries):
        raise ProvenanceError('content contains symlinks/submodules; a Git tree does not attest their external target bytes')
    paths = [row.split('\t', 1)[1] for row in entries]
    count = sum(p.endswith('.md') for p in paths)
    if not paths or not count:
        raise ProvenanceError('zero committed content coverage')
    return {'content_tree': tree, 'content_files': len(paths), 'content_md': count}


def current_content(repo):
    repo = str(Path(repo).resolve())
    head = git(repo, 'rev-parse', '--verify', 'HEAD').decode().strip()
    # A marked-valid index entry can conceal working-tree modifications from diff.
    flags = names(git(repo, 'ls-files', '-v', '-z', '--', 'content'))
    hidden = [line[2:] for line in flags if not line.startswith('H ')]
    if hidden:
        raise ProvenanceError('content index has trust/skip flags: ' + repr(hidden[:8]))
    dirty = names(git(repo, 'diff', '--name-only', '--no-ext-diff', '--no-textconv', '--no-renames', '-z', 'HEAD', '--', 'content'))
    # Deliberately omit --exclude-standard: an ignored new input is still an input.
    added = names(git(repo, 'ls-files', '--others', '-z', '--', 'content'))
    return {'git_head': head, **committed_content(repo, head), 'changed_paths': sorted(set(dirty + added))}


def dirty_paths(repo):
    """Porcelain -z preserves quotes/newlines; rename source is a separate field."""
    fields = names(git(repo, 'status', '--porcelain=v1', '-z', '--untracked-files=all'))
    rows = []
    i = 0
    while i < len(fields):
        field = fields[i]; i += 1
        status, rel = field[:2], field[3:]
        row = {'status': status, 'path': rel}
        if 'R' in status or 'C' in status:
            if i >= len(fields):
                raise ProvenanceError('incomplete rename in git status')
            row['original_path'] = fields[i]; i += 1
        path = Path(repo) / rel
        if path.is_symlink():
            target = os.readlink(path)
            row.update(kind='symlink', target=target, sha256=hashlib.sha256(os.fsencode(target)).hexdigest())
        elif path.is_file():
            h = hashlib.sha256()
            with path.open('rb') as f:
                for block in iter(lambda: f.read(1024 * 1024), b''):
                    h.update(block)
            row.update(kind='file', bytes=path.stat().st_size, sha256=h.hexdigest())
        elif not path.exists():
            row['kind'] = 'absent'
        else:
            raise ProvenanceError(f'unhashable dirty path: {rel!r}')
        rows.append(row)
    return sorted(rows, key=lambda r: r['path'])


def begin_capture(repo, capture_id):
    state = current_content(repo)
    if state['changed_paths']:
        raise ProvenanceError(f'capture requires clean, fully tracked content: {state["changed_paths"][:8]!r}')
    return {'schema': SCHEMA, 'state': 'capturing', 'capture_id': capture_id,
            'capture_git_head': state['git_head'],
            **{k: state[k] for k in ('content_tree', 'content_files', 'content_md')},
            'content_clean_at_start': True, 'content_clean_at_end': False,
            'dirty_paths_start': dirty_paths(repo)}


def finish_capture(start, repo):
    state = current_content(repo)
    if (state['git_head'] != start['capture_git_head'] or state['content_tree'] != start['content_tree']
            or state['changed_paths']):
        raise ProvenanceError('capture inputs moved before completion; no accepted golden')
    return {**start, 'state': 'complete', 'content_clean_at_end': True, 'dirty_paths_end': dirty_paths(repo)}


def inspect_content(receipt, repo):
    result = {'state': 'UNVERIFIED', 'capture_git_head': None, 'scope': 'content/**'}
    if not isinstance(receipt, dict):
        return {**result, 'reason': 'no capture-time content attestation; a commit alone cannot prove what the build read'}
    result['capture_git_head'] = receipt.get('capture_git_head')
    if receipt.get('schema') == 'legacy-input-unverified':
        return {**result, 'reason': receipt['reason']}
    required = ('content_files', 'content_md')
    if (receipt.get('schema') != SCHEMA or receipt.get('state') != 'complete'
            or receipt.get('content_clean_at_start') is not True or receipt.get('content_clean_at_end') is not True
            or not receipt.get('capture_id')
            or any(type(receipt.get(k)) is not int or receipt[k] <= 0 for k in required)
            or not isinstance(receipt.get('dirty_paths_start'), list) or not isinstance(receipt.get('dirty_paths_end'), list)
            or not re.fullmatch(r'[0-9a-f]{40,64}', str(receipt.get('capture_git_head')))
            or not re.fullmatch(r'[0-9a-f]{40,64}', str(receipt.get('content_tree')))):
        return {**result, 'reason': 'incomplete or invalid capture-time content attestation'}
    try:
        expected = committed_content(str(Path(repo).resolve()), receipt['capture_git_head'])
        if any(receipt[k] != v for k, v in expected.items()):
            return {**result, 'reason': 'receipt disagrees with its named capture content tree/counts'}
        actual = current_content(repo)
    except (ProvenanceError, OSError) as e:
        # Narrowly unavailable Git/filesystem data. Coding errors must propagate.
        return {**result, 'reason': str(e)}
    same = actual['content_tree'] == receipt['content_tree'] and not actual['changed_paths']
    return {**result, 'state': 'MATCH' if same else 'DRIFTED', 'current_git_head': actual['git_head'],
            'capture_content_tree': receipt['content_tree'], 'current_content_tree': actual['content_tree'],
            'covered_files': receipt['content_files'], 'markdown_files': receipt['content_md'],
            'changed_paths': actual['changed_paths'],
            'reason': 'capture content tree equals current tree; working content clean' if same else 'cumulative content tree or working inputs changed since capture'}


def read_receipt(path):
    try:
        value = json.loads(Path(path).read_text())
    except (OSError, ValueError) as e:
        raise ProvenanceError(f'cannot read content receipt {path}: {e}') from e
    if not isinstance(value, dict):
        raise ProvenanceError('content receipt must be an object')
    return value


def output_identity(files):
    """Bind the receipt to named output bytes, not just to an output directory."""
    if not files:
        raise ProvenanceError('zero output files in capture receipt')
    rows = []
    for name, record in sorted(files.items()):
        size, digest = record.get('size'), record.get('sha', record.get('sha256'))
        if type(size) is not int or size < 0 or not re.fullmatch(r'[0-9a-f]{64}', str(digest)):
            raise ProvenanceError(f'cannot bind unreadable output: {name}')
        rows.append([name, size, digest])
    raw = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
    return {'files': len(rows), 'sha256': hashlib.sha256(raw).hexdigest()}


def read_capture_receipt(args, tree, *, files=None, require_output_hash=False):
    if not args.content_receipt:
        raise ProvenanceError('capture/re-seed requires --content-receipt from the actual completed build')
    receipt = read_receipt(args.content_receipt)
    verdict = inspect_content(receipt, args.source_repo)
    if verdict['state'] != 'MATCH':
        raise ProvenanceError(f'capture inputs {verdict["state"]}: {verdict["reason"]}')
    roots = receipt.get('output_roots', [])
    if str(Path(tree).resolve()) not in roots:
        raise ProvenanceError('receipt does not name this emitted tree; cannot stamp current HEAD onto old output')
    if require_output_hash:
        if not receipt.get('output_identity'):
            raise ProvenanceError('re-seed requires a receipt bound to the actual emitted bytes')
        if files is None:
            files = {}
            for path in sorted(Path(tree).rglob('*')):
                if path.is_file():
                    h = hashlib.sha256()
                    with path.open('rb') as f:
                        for block in iter(lambda: f.read(1024 * 1024), b''):
                            h.update(block)
                    files[path.relative_to(tree).as_posix()] = {'size': path.stat().st_size, 'sha': h.hexdigest()}
        if output_identity(files) != receipt['output_identity']:
            raise ProvenanceError('emitted tree differs from the build receipt; refusing a self-advancing baseline')
    return receipt


def receipt_from(artifact):
    if artifact.get('content_provenance') is not None:
        return artifact['content_provenance']
    meta = artifact.get('provenance', artifact.get('_meta', {}))
    if meta.get('content_provenance') is not None:
        return meta['content_provenance']
    if meta.get('content_receipt'):
        receipt = read_receipt(meta['content_receipt'])
        if meta.get('capture_id') != receipt.get('capture_id'):
            raise ProvenanceError('record and content receipt capture IDs differ')
        return receipt
    # Context only, NEVER a reconstructed proof. In particular a retained build0
    # .env.txt names 308d6f577 and four dirty paths, but cannot name their identities.
    legacy_head = meta.get('git_head')
    tree = artifact.get('tree', meta.get('tree'))
    reason = 'recorded commit alone is not a capture-time clean-content attestation'
    if isinstance(tree, str):
        env = Path(tree + '.env.txt')
        if env.exists():
            try:
                fields = dict(parts for line in env.read_text().splitlines()
                              if len(parts := line.split(None, 1)) == 2)
            except OSError as e:
                raise ProvenanceError(f'cannot inspect legacy capture metadata {env}: {e}') from e
            legacy_head = fields.get('git_head', legacy_head)
            dirty = fields.get('git_dirty', fields.get('git_status_paths', 'unrecorded'))
            reason = (f'legacy capture metadata reports dirty={dirty}, without an attested content input set; '
                      'matching committed content cannot recover unknown dirty bytes')
    if legacy_head:
        return {'schema': 'legacy-input-unverified', 'capture_git_head': legacy_head, 'reason': reason}
    return None


def add_arguments(parser, *, capture=False):
    parser.add_argument('--source-repo', type=Path, default=DEFAULT_REPO,
                        help='repository whose current content is checked (not the emitted tree)')
    parser.add_argument('--artifact-only', action='store_true',
                        help='explicit historical artifact comparison; no current-source parity claim')
    if capture:
        parser.add_argument('--content-receipt', type=Path,
                            help='completed receipt from the build; never infer it from fingerprint-time HEAD')


class ContentGuard:
    def __init__(self, artifact, args, label='golden'):
        self.repo, self.artifact_only, self.label = args.source_repo, args.artifact_only, label
        self.receipt = receipt_from(artifact)
        self.verdict = inspect_content(self.receipt, self.repo)
        self.show()
        self.require()

    def show(self):
        v = self.verdict
        print(f'CONTENT {self.label}: {v["state"]}; capture={v.get("capture_git_head") or "unrecorded"}; '
              f'covered_files={v.get("covered_files", 0)}; {v["reason"]}')
        if self.artifact_only:
            print('SCOPE: ARTIFACT COMPARISON ONLY; current-source parity NOT asserted')

    def require(self):
        if not self.artifact_only and self.verdict['state'] != 'MATCH':
            raise ProvenanceError('no current-content verdict; use --artifact-only explicitly for historical byte/contract comparisons', self.verdict['state'])

    def finish(self):
        # Recheck the enumerated input set. An unrelated commit remains acceptable.
        after = inspect_content(self.receipt, self.repo)
        if after != self.verdict:
            self.verdict = after
            self.show()
        self.require()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--receipt', type=Path, required=True)
    add_arguments(ap)
    args = ap.parse_args()
    try:
        guard = ContentGuard({'content_provenance': read_receipt(args.receipt)}, args)
        guard.finish()
    except ProvenanceError as e:
        print(f'EXIT 2 CONTENT_PROVENANCE_{e.state}: {e}')
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
