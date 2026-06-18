#!/usr/bin/env python3
"""Atomic file writers for the content/graph pipeline.

A crash, Ctrl-C, or timeout mid-write must never leave a truncated pipeline
output (graph.json, content/*.json, layout files) behind. Opening the
destination in 'w' mode truncates it to zero immediately; instead we write to a
temp file in the SAME directory, fsync it, then os.replace() it into place. On
the same filesystem os.replace is atomic, so a reader always sees either the
old file or the fully-written new one — never a half-written one.

Used by:
- regenerate_graph.py        (graph.json)
- regenerate_content_json.py (content/*.json stubs + edits)
- proofread_all_transitions.py (content/*.json edits)
- explode_graph_connections.py (content/*.json edits)
"""

import json
import os
import tempfile


def atomic_write_text(path, text):
    """Write `text` to `path` atomically (write temp + fsync + os.replace)."""
    path = os.fspath(path)
    dirname = os.path.dirname(path) or '.'
    tmp = tempfile.NamedTemporaryFile(
        dir=dirname, delete=False, mode='w', encoding='utf-8',
        prefix='.tmp-', suffix='.tmp',
    )
    try:
        tmp.write(text)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp.close()
        os.replace(tmp.name, path)
    except BaseException:
        try:
            tmp.close()
        except Exception:
            pass
        try:
            os.remove(tmp.name)
        except OSError:
            pass
        raise


def atomic_write_json(path, obj, *, indent=2, ensure_ascii=False, trailing_newline=True):
    """Serialize `obj` to JSON and write it to `path` atomically.

    Matches the json.dump kwargs used at the call sites (indent=2,
    ensure_ascii=False). `trailing_newline` appends a final newline to mirror
    the existing `f.write("\\n")` after json.dump at most call sites.
    """
    text = json.dumps(obj, indent=indent, ensure_ascii=ensure_ascii)
    if trailing_newline:
        text += '\n'
    atomic_write_text(path, text)
