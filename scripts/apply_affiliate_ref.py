#!/usr/bin/env python3
"""Resolve marked course references in emitted artifacts only.

Canonical source URLs never carry a referral. Missing configuration restores neutral
references; invalid configuration fails. Repeated runs recompute from course_url,
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
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_text
from _system_guides import canonical_course_url
from _slug import slugify

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / 'content'
PUBLIC_DIR = PROJECT_ROOT / 'source/public'
NEURAL_SYSTEMS = PROJECT_ROOT / 'source/quartz/static/neural/systems.json'
TEXT_SUFFIXES = {'.html', '.json', '.xml', '.txt', '.md', '.js'}
REF_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._~-]{0,63}')
PLACEHOLDER_RE = re.compile(r'REPLACE_ME', re.I)


def disclosure():
    text = (PROJECT_ROOT / 'CLAUDE.md').read_text()
    return text.split('<!-- CANONICAL-DISCLOSURE:START -->')[1].split('<!-- CANONICAL-DISCLOSURE:END -->')[0].strip()


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
    if not canonical_course_url(canonical):
        return '', False
    u = urlsplit(canonical)
    active = bool(ref and u.netloc in ('bjjfanatics.com', 'www.bjjfanatics.com') and re.fullmatch(r'/products/[a-z0-9-]+', u.path))
    if not active:
        return canonical, False
    campaign = [('rfsn', ref), ('utm_source', 'bjjgraph'), ('utm_medium', 'affiliate'), ('utm_campaign', 'systems'), ('utm_content', system.removeprefix('systems/')), ('utm_term', product)]
    return urlunsplit((u.scheme, u.netloc, u.path, urlencode(campaign), '')), True


def neutral_legacy_url(value):
    """Old cached ref/rfsn placeholders are never promoted. Strip only tracking keys."""
    u = urlsplit(unescape(value))
    query = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
             if k.lower() not in ('ref', 'rfsn') and not k.lower().startswith('utm_')]
    return urlunsplit((u.scheme, u.netloc, u.path, urlencode(query), u.fragment))


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
    return re.sub(r'https?://[^\s<>"\)]+', lambda m: neutral_legacy_url(m[0]) if legacy_tracking_url(m[0]) else m[0], text)


class Tag(HTMLParser):
    def handle_starttag(self, tag, attrs):
        self.tag, self.attrs = tag, dict(attrs)


def read_tag(text):
    parser = Tag(convert_charrefs=True); parser.feed(text)
    return parser.attrs


def tag_html(tag, attrs):
    return '<' + tag + ''.join(' ' + k + ('' if v is None else '="' + escape(str(v), quote=True) + '"') for k, v in attrs.items()) + '>'


def resolve_html(text, ref):
    # Remove resolver/legacy disclosures before reconstructing current state.
    text = neutralize_unmarked_text(text)
    text = re.sub(r'<p\b[^>]*class=["\'][^"\']*affiliate-disclosure[^"\']*["\'][^>]*>.*?</p>', '', text, flags=re.S | re.I)
    def anchor(match):
        raw = match[0]; attrs = read_tag(raw)
        canonical = attrs.get('data-course-url')
        if canonical is not None:
            url, active = affiliate_url(canonical, ref, attrs.get('data-system-slug', ''), attrs.get('data-product-id', ''))
            if not url:
                raise ValueError('Invalid canonical data-course-url in emitted anchor')
            attrs.update(href=url, rel='sponsored nofollow noopener' if active else 'noopener')
            attrs['data-affiliate'] = 'true' if active else 'false'
            return tag_html('a', attrs)
        href = attrs.get('href', '')
        if PLACEHOLDER_RE.search(href) or attrs.get('data-affiliate') == 'true':
            attrs['href'] = neutral_legacy_url(href)
            attrs['data-affiliate'] = 'false'; attrs['rel'] = 'noopener'
            return tag_html('a', attrs)
        return raw
    text = re.sub(r'<a\b[^>]*>', anchor, text, flags=re.I)
    def container(match):
        opening, body = match[1], match[2]
        if re.search(r'data-affiliate=["\']true["\']', body):
            return opening + '<p class="affiliate-disclosure">' + escape(disclosure()) + '</p>' + body + '</section>'
        return match[0]
    text = re.sub(r'(<section\b[^>]*\bdata-course-container(?:=["\'][^"\']*["\'])?[^>]*>)(.*?)</section>', container, text, flags=re.S | re.I)
    if 'data-system-preview' in text and 'data-system-media-script' not in text:
        text += '\n<script type="module" src="/static/system-guide-media.js" data-system-media-script></script>\n'
    return text


def resolve_json(value, ref, system=''):
    if isinstance(value, dict):
        system = slugify(value.get('name', '')) if 'products' in value else system
        out = {k: resolve_json(v, ref, system) for k, v in value.items()}
        if 'course_url' in value and ('url' in value or 'affiliate' in value):
            out['url'], out['affiliate'] = affiliate_url(value['course_url'], ref, system, value.get('id', ''))
            if not out['url']:
                raise ValueError('Invalid canonical course_url in emitted product')
        elif isinstance(value.get('url'), str) and legacy_tracking_url(value['url']):
            out['url'] = neutral_legacy_url(value['url']); out['affiliate'] = False
        return out
    if isinstance(value, list):
        return [resolve_json(v, ref, system) for v in value]
    if isinstance(value, str):
        if 'data-course-' in value or 'data-affiliate=' in value:
            return resolve_html(value, ref)
        return neutralize_unmarked_text(value)
    return value


def targets():
    found = [NEURAL_SYSTEMS] if NEURAL_SYSTEMS.is_file() else []
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
    except (ValueError, OSError) as exc:
        # Never include raw URL or configuration values in logs.
        print('[affiliate] FAIL: ' + ('AFFILIATE_REF invalid' if ref and (not REF_RE.fullmatch(ref) or PLACEHOLDER_RE.search(ref)) else type(exc).__name__ + ' resolving emitted references'), file=sys.stderr)
        raise SystemExit(1)
    print(f'[affiliate] {"Configured" if ref else "Neutral"}: {count} changed files / {len(paths)} scanned' + (' (dry run)' if args.dry_run else ''))


if __name__ == '__main__':
    main()
