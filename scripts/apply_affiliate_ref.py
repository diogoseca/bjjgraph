#!/usr/bin/env python3
"""Resolve course and evidence references in emitted artifacts only.

Canonical source URLs never carry a referral. Missing configuration restores neutral
references; invalid configuration fails. Repeated runs recompute from canonical URLs,
including rotations/removal, and keep compressed siblings synchronized.
"""
from __future__ import annotations
import argparse
import gzip
from html import escape, unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit, unquote
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_text
from _system_guides import canonical_course_url, is_bjjfanatics_url
from _slug import slugify

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / 'content'
PUBLIC_DIR = PROJECT_ROOT / 'source/public'
NEURAL_SYSTEMS = PROJECT_ROOT / 'source/quartz/static/neural/systems.json'
TEXT_SUFFIXES = {'.html', '.json', '.xml', '.txt', '.md', '.js', '.css'}
REF_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._~-]{0,63}')
PLACEHOLDER_RE = re.compile(r'REPLACE_ME', re.I)


def configured_ref():
    if 'AFFILIATE_REF' in os.environ:
        return os.environ['AFFILIATE_REF']
    path = PROJECT_ROOT / '.env'
    if path.is_file():
        for line in path.read_text().splitlines():
            key, sep, value = line.strip().partition('=')
            if sep and key.strip() == 'AFFILIATE_REF':
                return value.strip().strip('\"\'')
    return ''


def validate_ref(ref):
    if ref and (not REF_RE.fullmatch(ref) or PLACEHOLDER_RE.search(ref)):
        raise ValueError('AFFILIATE_REF is invalid; use a real tracking token (1–64 letters, digits, dot, underscore, tilde or hyphen)')


def affiliate_url(canonical, ref, system='', product=''):
    """Only the supported vendor gets its referral syntax; other references stay neutral."""
    validate_ref(ref)
    try:
        u = urlsplit(canonical)
        if u.scheme != 'https' or not u.hostname or u.username or u.password or PLACEHOLDER_RE.search(unquote(canonical)):
            return '', False
    except (TypeError, ValueError):
        return '', False
    canonical = neutral_legacy_url(canonical)
    u = urlsplit(canonical)
    active = bool(ref and is_bjjfanatics_url(canonical))
    if not active:
        return canonical, False
    campaign = [('rfsn', ref), ('utm_source', 'bjjgraph'), ('utm_medium', 'affiliate'), ('utm_campaign', 'systems'), ('utm_content', system.removeprefix('systems/')), ('utm_term', product)]
    return urlunsplit((u.scheme, u.netloc, u.path, urlencode(parse_qsl(u.query, keep_blank_values=True) + campaign), u.fragment)), True


def neutral_legacy_url(value):
    """Strip tracking keys while preserving path, fragment and nontracking query semantics."""
    value = unescape(value)
    u = urlsplit(value)
    # Keep canonical bytes untouched when already clean (e.g. %20 vs +, duplicate
    # parameters, empty values). Removing tracking also preserves untouched pairs.
    pairs = u.query.split('&') if u.query else []
    query = []
    for pair in pairs:
        key = unquote(pair.partition('=')[0]).lower()
        if key not in ('ref', 'rfsn') and not key.startswith('utm_'):
            query.append(pair)
    if query == pairs:
        return value
    return urlunsplit((u.scheme, u.netloc, u.path, '&'.join(query), u.fragment))



def legacy_tracking_url(value):
    try:
        u = urlsplit(unescape(value))
        keys = {k.lower() for k, _ in parse_qsl(u.query)}
        return bool(PLACEHOLDER_RE.search(value) or (u.hostname in ('bjjfanatics.com', 'www.bjjfanatics.com') and keys & {'ref', 'rfsn'}))
    except ValueError:
        return False


def neutralize_unmarked_text(text):
    # Normalize previous built URLs before markers reconstruct this build's state.
    # This also covers old search snippets, XML feeds and plain discovery text.
    return re.sub(r'https?://[^\s<>"\'\)]+', lambda m: neutral_legacy_url(m[0]) if legacy_tracking_url(m[0]) else m[0], text)


class Tag(HTMLParser):
    def handle_starttag(self, tag, attrs):
        self.tag, self.attrs = tag, dict(attrs)


def read_tag(text):
    parser = Tag(convert_charrefs=True); parser.feed(text)
    return parser.attrs


def tag_html(tag, attrs):
    return '<' + tag + ''.join(' ' + k + ('' if v is None else '="' + escape(str(v), quote=True) + '"') for k, v in attrs.items()) + '>'


def is_system_guide_html(text):
    return bool(re.search(r'<[^>]+\sdata-system-guide(?:\s|=|>)', text, re.I))


def resolve_html(text, ref):
    # Automatically mark vendor links only in Systems guides. Explicit canonical
    # markers still resolve in copied snippets and discovery on any surface.
    system_guide = is_system_guide_html(text)
    text = neutralize_unmarked_text(text)
    # Clean pages emitted before inline commission notices were retired.
    text = re.sub(r'<(p|span)\b[^>]*class=["\'][^"\']*affiliate-disclosure[^"\']*["\'][^>]*>.*?</\1>', '', text, flags=re.S | re.I)
    def anchor(match):
        raw = match[0]; attrs = read_tag(raw)
        href = attrs.get('href', '')
        canonical = attrs.get('data-course-url') or attrs.get('data-source-url')
        if canonical is None and system_guide and is_bjjfanatics_url(href):
            canonical = neutral_legacy_url(href)
            attrs['data-source-url'] = canonical
        if canonical is not None:
            url, active = affiliate_url(canonical, ref, attrs.get('data-system-slug', ''), attrs.get('data-product-id', ''))
            if not url:
                raise ValueError('Invalid canonical outbound URL in emitted anchor')
            attrs.update(href=url, rel='sponsored nofollow noopener' if active else 'noopener')
            attrs['data-affiliate'] = 'true' if active else 'false'
            return tag_html('a', attrs)
        if PLACEHOLDER_RE.search(href) or attrs.get('data-affiliate') == 'true':
            attrs['href'] = neutral_legacy_url(href)
            attrs['data-affiliate'] = 'false'; attrs['rel'] = 'noopener'
            return tag_html('a', attrs)
        return raw
    text = re.sub(r'<a\b[^>]*>', anchor, text, flags=re.I)
    if 'data-system-guide' in text and 'data-system-guide-style' not in text:
        style = '<link rel="stylesheet" href="/static/system-guide.css" data-system-guide-style>'
        text = text.replace('</head>', style + '</head>', 1) if '</head>' in text else style + text
    if 'data-system-preview' in text and 'data-system-media-script' not in text:
        text += '\n<script type="module" src="/static/system-guide-media.js" data-system-media-script></script>\n'
    return text


def resolve_json(value, ref, system=''):
    if isinstance(value, dict):
        system = slugify(value.get('name', '')) if 'products' in value or value.get('cat') == 'System' else system
        out = {k: resolve_json(v, ref, system) for k, v in value.items()}
        if 'course_url' in value and ('url' in value or 'affiliate' in value):
            out['url'], out['affiliate'] = affiliate_url(value['course_url'], ref, system, value.get('id', ''))
            if not out['url']:
                raise ValueError('Invalid canonical course_url in emitted product')
        elif 'url' in value and 'canonical_url' in value:
            canonical = value.get('canonical_url') or neutral_legacy_url(value['url'])
            out['canonical_url'] = canonical
            out['url'], out['affiliate'] = affiliate_url(canonical, ref, system, value.get('id', ''))
            if not out['url']:
                raise ValueError('Invalid canonical source URL in emitted evidence')
        elif isinstance(value.get('url'), str) and legacy_tracking_url(value['url']):
            out['url'] = neutral_legacy_url(value['url']); out['affiliate'] = False
        return out
    if isinstance(value, list):
        return [resolve_json(v, ref, system) for v in value]
    if isinstance(value, str):
        if '<a' in value or 'data-course-' in value or 'data-affiliate=' in value:
            return resolve_html(value, ref)
        return neutralize_unmarked_text(value)
    return value


def targets():
    found = [NEURAL_SYSTEMS] if NEURAL_SYSTEMS.is_file() else []
    content_chunks = NEURAL_SYSTEMS.parent / 'content'
    if content_chunks.is_dir():
        found += [p for p in sorted(content_chunks.glob('*.json')) if p.is_file() and not p.is_symlink()]
    if PUBLIC_DIR.is_dir():
        found += [p for p in sorted(PUBLIC_DIR.rglob('*')) if p.is_file() and not p.is_symlink() and p.suffix in TEXT_SUFFIXES]
    return found


def stamp(path, ref, dry_run=False):
    validate_ref(ref)
    if path.is_symlink() or CONTENT_DIR.resolve() in path.resolve().parents:
        raise SystemExit('Refusing to rewrite source content or a symlink')
    original = path.read_text(encoding='utf-8')
    if path.suffix == '.json':
        value = json.loads(original)
        resolved = resolve_json(value, ref)
        text = json.dumps(resolved, ensure_ascii=False, separators=(',', ':')) if resolved != value else original
    elif path.suffix in ('.html', '.md'):
        text = resolve_html(original, ref)
    else:
        text = neutralize_unmarked_text(original)
    changed = int(text != original)
    if not dry_run:
        if changed:
            atomic_write_text(path, text)
        sibling = path.with_suffix(path.suffix + '.gz')
        if sibling.is_file() and not sibling.is_symlink():
            expected = text.encode()
            try:
                same = gzip.decompress(sibling.read_bytes()) == expected
            except (OSError, EOFError):
                same = False
            if not same:
                sibling.write_bytes(gzip.compress(expected, mtime=0))
                changed = 1
    return changed


def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('--dry-run', action='store_true'); args = ap.parse_args()
    ref = configured_ref()
    try:
        validate_ref(ref)
        paths = targets()
        count = sum(stamp(p, ref, args.dry_run) for p in paths)
        if PUBLIC_DIR.is_dir() and not args.dry_run:
            destination = PUBLIC_DIR / 'static/system-guide-media.js'
            destination.parent.mkdir(parents=True, exist_ok=True)
            atomic_write_text(destination, (PROJECT_ROOT / 'scripts/system_guide_media.js').read_text())
            stamp(destination, ref)  # Refresh an existing compressed sibling after copying.
            preview = PUBLIC_DIR / 'static/system-preview.js'
            atomic_write_text(preview, (PROJECT_ROOT / 'neural/src/system-preview.src.js').read_text())
            stamp(preview, ref)
            stylesheet = PUBLIC_DIR / 'static/system-guide.css'
            atomic_write_text(stylesheet, (PROJECT_ROOT / 'scripts/system_guide.css').read_text())
            stamp(stylesheet, ref)
    except (ValueError, OSError) as exc:
        # Never include raw URL or configuration values in logs.
        print('[affiliate] FAIL: ' + ('AFFILIATE_REF invalid' if ref and (not REF_RE.fullmatch(ref) or PLACEHOLDER_RE.search(ref)) else type(exc).__name__ + ' resolving emitted references'), file=sys.stderr)
        raise SystemExit(1)
    print(f'[affiliate] {"Configured" if ref else "Neutral"}: {count} changed files / {len(paths)} scanned' + (' (dry run)' if args.dry_run else ''))


if __name__ == '__main__':
    main()
