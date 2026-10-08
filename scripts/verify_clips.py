#!/usr/bin/env python3
"""Check unique curated YouTube IDs, report rot, and preserve partial results.

The default and --report-only never change content. --prune explicitly removes
unavailable clips, without refreshing dates or changing surviving metadata.
Health checks need oEmbed only; thumbnail-format checks belong to sourcing.

CI supplies --report-dir: results.jsonl is flushed after every result, and
summary.json / summary.md always describe current coverage, including an
incomplete run. A deadline below the CI step timeout leaves time for artifacts.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from datetime import date, timedelta, datetime, timezone
import json
import math
import os
from pathlib import Path
import signal
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json, atomic_write_text
from _clips import CONTENT, iter_clips_arrays, verify_video


def bounded_number(kind, low, high=None):
    def parse(value):
        number = kind(value)
        if not math.isfinite(number) or number < low or (high is not None and number > high):
            raise argparse.ArgumentTypeError(f'must be >= {low}' + (f' and <= {high}' if high is not None else ''))
        return number
    return parse


def arguments(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--category', choices=['Positions', 'Transitions', 'Submissions', 'Principles'])
    ap.add_argument('--file', help='substring filter on content file path')
    ap.add_argument('--max-age-days', type=bounded_number(int, 0))
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--report-only', action='store_true', help='explicit read-only mode (the default)')
    mode.add_argument('--prune', action='store_true', help='remove unavailable IDs; keep all surviving metadata')
    ap.add_argument('--workers', type=bounded_number(int, 1, 8), default=4)
    ap.add_argument('--sleep', type=bounded_number(float, 0), default=0.5,
                    help='minimum seconds between request starts across all workers')
    ap.add_argument('--timeout', type=bounded_number(float, 0.1, 60), default=15)
    ap.add_argument('--retries', type=bounded_number(int, 0, 2), default=1,
                    help='bounded retries for transient failures only')
    ap.add_argument('--max-seconds', type=bounded_number(float, 0.1), default=4800)
    ap.add_argument('--report-dir', type=Path, help='write durable JSONL results and JSON/Markdown coverage')
    args = ap.parse_args(argv)
    if args.report_dir:
        destination = args.report_dir.resolve()
        if destination == CONTENT.resolve() or CONTENT.resolve() in destination.parents:
            ap.error('--report-dir must be outside content/')
        if (destination / 'results.jsonl').exists():
            ap.error('--report-dir already has results; choose a fresh directory to preserve them')
    return args


class Pace:
    def __init__(self, gap):
        self.gap = gap
        self.next_start = 0.0
        self.lock = threading.Lock()

    def acquire(self, stopped):
        with self.lock:
            if stopped.wait(max(0, self.next_start - time.monotonic())):
                return False
            self.next_start = time.monotonic() + self.gap
            return True


def check(vid, args, pace, stopped):
    result = {'status': 'error', 'reason': 'interrupted before checking'}
    attempts = 0
    for _ in range(args.retries + 1):
        if not pace.acquire(stopped):
            break
        attempts += 1
        try:
            result = verify_video(vid, timeout=args.timeout, check_format=False)
        except Exception as exc:
            result = {'status': 'error', 'reason': f'{type(exc).__name__}: {exc}'}
        if result['status'] != 'error':
            break
    return {'id': vid, 'status': result['status'] if attempts else 'unchecked', 'attempts': attempts,
            'reason': result.get('reason') or {'ok': 'oEmbed available',
                'gone': 'oEmbed HTTP 404: unavailable or private',
                'embed-disabled': 'oEmbed HTTP 401/403: embedding unavailable',
                'error': 'transient network or HTTP error'}[result['status']],
            'checked_at': datetime.now(timezone.utc).isoformat()}


def markdown(summary):
    c = summary['coverage']
    lines = ['## YouTube clip verification', '',
             f"Checked **{c['checked_unique_ids']} / {c['eligible_unique_ids']} eligible unique IDs** "
             f"({c['corpus_unique_ids']} in the selected corpus; {c['clip_references']} references).",
             f"Passed: {c['passed']}; unavailable: {c['dead']}; errors: {c['errors']}; "
             f"unchecked: {c['unchecked']}; skipped as recent: {c['skipped_recent']}.",
             f"Complete: {summary['complete']}. Duration: {summary['elapsed_seconds']:.1f} seconds."]
    if not c['checked_unique_ids']:
        lines += ['', '**FAILED: zero IDs checked.**']
    for group in ('dead', 'errors'):
        if summary[group]:
            lines += ['', f'### {group.title()}', '']
            for row in summary[group]:
                lines.append(f"- `{row['id']}`: {row['reason']} ({len(row['references'])} references)")
    if summary.get('interrupted'):
        lines += ['', f"**Incomplete: {summary['interrupted']}.**"]
    return '\n'.join(lines) + '\n'


def main(argv=None):
    args = arguments(argv)
    started = time.monotonic()
    cutoff = (date.today() - timedelta(days=args.max_age_days)).isoformat() if args.max_age_days is not None else None
    holders = list(iter_clips_arrays(args.category, args.file))
    references, eligible = {}, set()
    for path, data, role, holder in holders:
        where = f"{os.path.relpath(path, CONTENT)}#{role or 'root'}"
        for clip in holder['clips']:
            vid = clip.get('id')
            references.setdefault(vid, []).append(where)
            if cutoff is None or (clip.get('verified') or '') < cutoff:
                eligible.add(vid)
    ids = [vid for vid in references if vid in eligible]
    print(f"verify_clips: corpus={len(references)} unique IDs, eligible={len(ids)}, "
          f"references={sum(map(len, references.values()))}, workers={args.workers}; "
          f"{'prune' if args.prune else 'report-only'}", flush=True)
    stopped = threading.Event()
    interrupted = None
    records = {}
    report_log = None
    if args.report_dir:
        args.report_dir.mkdir(parents=True, exist_ok=True)
        report_log = (args.report_dir / 'results.jsonl').open('x', encoding='utf-8')

    def report():
        counts = Counter(r['status'] for r in records.values())
        checked = sum(r['attempts'] > 0 for r in records.values())
        summary = {'complete': bool(ids) and checked == len(ids) and not interrupted,
            'elapsed_seconds': round(time.monotonic() - started, 3), 'interrupted': interrupted,
            'coverage': {'corpus_unique_ids': len(references), 'eligible_unique_ids': len(ids),
                'checked_unique_ids': checked, 'clip_references': sum(map(len, references.values())),
                'passed': counts['ok'], 'dead': counts['gone'] + counts['embed-disabled'],
                'errors': counts['error'], 'unchecked': len(ids) - checked,
                'skipped_recent': len(references) - len(ids)},
            'dead': [r for r in records.values() if r['status'] in ('gone', 'embed-disabled')],
            'errors': [r for r in records.values() if r['status'] == 'error']}
        if args.report_dir:
            atomic_write_json(args.report_dir / 'summary.json', summary)
            atomic_write_text(args.report_dir / 'summary.md', markdown(summary))
        return summary

    old_handlers = {}
    def stop(signum, frame):
        nonlocal interrupted
        interrupted = f'signal {signum}'
        stopped.set()
    for signum in (signal.SIGINT, signal.SIGTERM):
        old_handlers[signum] = signal.signal(signum, stop)
    report()
    try:
        pace = Pace(args.sleep)
        todo = iter(ids)
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            pending = {}
            while True:
                if time.monotonic() - started >= args.max_seconds and not stopped.is_set():
                    interrupted = 'verification time limit reached'
                    stopped.set()
                while len(pending) < args.workers and not stopped.is_set():
                    try:
                        vid = next(todo)
                    except StopIteration:
                        break
                    pending[pool.submit(check, vid, args, pace, stopped)] = vid
                if not pending:
                    break
                done, _ = wait(pending, timeout=0.2, return_when=FIRST_COMPLETED)
                for future in done:
                    vid = pending.pop(future)
                    row = {**future.result(), 'references': references[vid]}
                    records[vid] = row
                    if report_log:
                        report_log.write(json.dumps(row) + '\n')
                        report_log.flush()
                        os.fsync(report_log.fileno())
                    report()
                    if row['status'] != 'ok' or len(records) % 100 == 0:
                        print(f"  {len(records)}/{len(ids)} {vid}: {row['status']} — {row['reason']}", flush=True)
    finally:
        stopped.set()
        if report_log:
            report_log.close()
        for signum, handler in old_handlers.items():
            signal.signal(signum, handler)
        summary = report()
        print(markdown(summary), flush=True)

    # This is the only content-writing path. Passing metadata is never refreshed.
    if args.prune:
        dead = {vid for vid, row in records.items() if row['status'] in ('gone', 'embed-disabled')}
        changed = {}
        for path, data, role, holder in holders:
            kept = [c for c in holder['clips'] if c.get('id') not in dead]
            if len(kept) != len(holder['clips']):
                if kept:
                    holder['clips'] = kept
                else:
                    holder.pop('clips')
                changed[path] = data
        for path, data in changed.items():
            atomic_write_json(path, data)
        print(f'pruned {len(dead)} unavailable IDs from {len(changed)} file(s)', flush=True)
    c = summary['coverage']
    if not c['checked_unique_ids'] or not summary['complete'] or c['errors']:
        return 2
    return 1 if c['dead'] and not args.prune else 0


if __name__ == '__main__':
    sys.exit(main())
