#!/usr/bin/env python3
"""Check neutral source references and, with --built, activated emitted output.

The --built gate also compares each authored Systems guide's canonical marker
multiset with its emitted HTML; one surviving guide cannot hide another disappearing.
Positive course-link coverage is required. Every displayed placeholder fails, including
keyless builds. This offline gate checks declared verification, not vendor availability.
"""
import argparse
from collections import Counter
import datetime as dt
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, urlsplit
from _system_guides import canonical_course_url, is_bjjfanatics_url

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SYSTEMS_DIR = PROJECT_ROOT / 'content/Systems'
GRAPH = PROJECT_ROOT / 'graph.json'
PUBLIC = PROJECT_ROOT / 'source/public'
STALE_DAYS = 180


def check_html(text, label, errors, built=False, ref=''):
    from apply_affiliate_ref import read_tag, affiliate_url, neutral_legacy_url, is_system_guide_html
    system_guide = is_system_guide_html(text)
    if re.search(r'(?:href|data-(?:course|source)-url)\s*=\s*["\'][^"\']*REPLACE_ME', text, re.I):
        errors.append(f'{label}: displayed placeholder URL')
    marked = 0
    for match in re.finditer(r'<a\b[^>]*>', text, re.I):
        attrs = read_tag(match[0])
        canonical = attrs.get('data-course-url') or attrs.get('data-source-url')
        vendor = is_bjjfanatics_url(attrs.get('href', ''))
        active = False
        if canonical:
            marked += 1
            if neutral_legacy_url(canonical) != canonical:
                errors.append(f'{label}: canonical marker carries tracking')
            expected, active = affiliate_url(canonical, ref if built else '', attrs.get('data-system-slug', ''), attrs.get('data-product-id', ''))
            if not expected or attrs.get('href') != expected or attrs.get('data-affiliate') != str(active).lower():
                errors.append(f'{label}: outgoing link disagrees with canonical/configured state')
            if active and not {'sponsored', 'nofollow', 'noopener'} <= set(attrs.get('rel', '').split()):
                errors.append(f'{label}: active link missing sponsored attributes')
        elif vendor:
            # Only Systems guides require automatic vendor stamping. Other pages
            # may retain ordinary neutral references without affiliate promotion.
            if built and system_guide:
                errors.append(f'{label}: unstamped BJJFanatics outgoing link')
            elif any(k.lower() in ('ref', 'rfsn') or k.lower().startswith('utm_') for k in parse_qs(urlsplit(attrs['href']).query)):
                errors.append(f'{label}: unmarked outgoing link carries tracking')
        if not active and ('sponsored' in attrs.get('rel', '').split() or attrs.get('data-affiliate') == 'true'):
            errors.append(f'{label}: affiliate promotion without configured canonical link')
    notices = re.findall(r'<(?:span|p)\b[^>]*class=["\'][^"\']*affiliate-disclosure[^"\']*["\'][^>]*>', text)
    if notices:
        errors.append(f'{label}: retired affiliate disclosure remains')
    return marked


def check_products(errors, warnings, strict_stale=False):
    tally = {'live': 0, 'dead': 0, 'unverified': 0}
    for path in sorted(SYSTEMS_DIR.glob('*.json')):
        for p in json.loads(path.read_text()).get('products', []):
            status = p.get('link_status')
            if status not in tally:
                errors.append(f'{path.name}: invalid link_status'); continue
            tally[status] += 1
            url = canonical_course_url(p.get('course_url'))
            if not url or 'affiliate_url' in p:
                errors.append(f'{path.name}: source product needs neutral canonical course_url')
            if url and str(p.get('vendor', '')).lower() == 'bjjfanatics':
                parsed = urlsplit(url)
                if parsed.netloc not in ('bjjfanatics.com', 'www.bjjfanatics.com') or not re.fullmatch('/products/[a-z0-9-]+', parsed.path):
                    errors.append(f'{path.name}: vendor link must identify an exact product')
            try:
                age = (dt.date.today() - dt.date.fromisoformat(p.get('link_checked', ''))).days
                if age < 0: raise ValueError()
                if status == 'live' and age > STALE_DAYS:
                    (errors if strict_stale else warnings).append(f'{path.name}: stale link check')
            except (TypeError, ValueError):
                errors.append(f'{path.name}: invalid link_checked date')
    if not tally['live']:
        errors.append('No verified products checked; positive coverage required')
    return tally


def check_graph_json(errors):
    if GRAPH.exists():
        raw = GRAPH.read_text()
        if '"affiliate_url"' in raw or 'REPLACE_ME' in raw or re.search(r'[?&](?:rfsn|ref)=', raw):
            errors.append('graph.json carries a referral or placeholder')


def check_built(errors, ref):
    from apply_affiliate_ref import targets, resolve_json
    pages = marked = products = 0
    for path in targets():
        text = path.read_text()
        if path.suffix in ('.html', '.md') and ('<a' in text or 'affiliate-disclosure' in text):
            pages += 1; marked += check_html(text, str(path.relative_to(PROJECT_ROOT)), errors, True, ref)
        if path.suffix == '.json':
            data = json.loads(text)
            if resolve_json(data, ref) != data:
                errors.append(f'{path.name}: JSON affiliate state is stale')
            if path.name == 'systems.json':
                products += sum(len(s.get('products', [])) for s in data.get('systems', []))
        # JS bundles contain a defensive placeholder guard; only URL occurrences fail.
        if re.search(r'https?(?::|\\u003a).*?[?&](?:amp;)?(?:ref|rfsn)=REPLACE_ME', text, re.I):
            errors.append(f'{path.name}: unresolved displayed placeholder')
        sibling = path.with_suffix(path.suffix + '.gz')
        if sibling.is_file():
            import gzip
            if gzip.decompress(sibling.read_bytes()).decode() != text:
                errors.append(f'{path.name}: compressed sibling is stale')
    if not (pages and marked and products):
        errors.append('Built course pages and JSON products require positive coverage')
    return pages, marked, products


def canonical_markers(text):
    """Count both marker kinds and URLs, retaining duplicate course placements."""
    from apply_affiliate_ref import read_tag
    markers = Counter()
    for match in re.finditer(r'<a\b[^>]*>', text, re.I):
        attrs = read_tag(match[0])
        for name in ('data-course-url', 'data-source-url'):
            if name in attrs:
                markers[(name, attrs[name])] += 1
    return markers


def check_marker_preservation(errors):
    """Derive expectations from authored Markdown, never from a second baseline."""
    pages = markers = 0
    expected_paths = set()
    for source in sorted(SYSTEMS_DIR.glob('*.md')):
        # These authored names use only Quartz's space-to-hyphen path spelling.
        # Refuse newly ambiguous escaping rather than silently check another page.
        if re.search(r'[&%?#\t\r\n]', source.stem):
            errors.append(f'marker preservation: unsupported source path spelling: {source.name}')
            continue
        relative = source.stem.replace(' ', '-') + '.html'
        expected_paths.add(relative)
        expected = canonical_markers(source.read_text())
        target = PUBLIC / 'Systems' / relative
        if expected:
            pages += 1
            markers += sum(expected.values())
        if not target.is_file():
            if expected:
                errors.append(f'marker preservation: missing Systems/{relative}')
            continue
        actual = canonical_markers(target.read_text())
        if actual != expected:
            errors.append(f'marker preservation: Systems/{relative} canonical marker multiset differs '
                          f'(expected {sum(expected.values())}, found {sum(actual.values())})')
    for target in sorted((PUBLIC / 'Systems').rglob('*.html')):
        relative = target.relative_to(PUBLIC / 'Systems').as_posix()
        if relative not in expected_paths and canonical_markers(target.read_text()):
            errors.append(f'marker preservation: Systems/{relative} has markers without an authored guide')
    if not pages or not markers:
        errors.append('marker preservation: zero source marker pages/anchors checked')
    return pages, markers


def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('--built', action='store_true'); ap.add_argument('--strict-stale', action='store_true'); args = ap.parse_args()
    errors, warnings = [], []
    tally = check_products(errors, warnings, args.strict_stale)
    marked = sum(check_html(path.read_text(), path.name, errors) for path in SYSTEMS_DIR.glob('*.md'))
    if not marked:
        errors.append('No neutral source course anchors checked; regenerate Markdown')
    check_graph_json(errors)
    preservation = None
    if args.built:
        from apply_affiliate_ref import configured_ref, validate_ref
        ref = configured_ref()
        try:
            validate_ref(ref); check_built(errors, ref)
            preservation = check_marker_preservation(errors)
        except ValueError:
            errors.append('Invalid affiliate configuration or emitted course URL')
    for warning in warnings: print('[affiliate gate] WARN: ' + warning)
    if errors:
        print('\n'.join('[affiliate gate] FAIL: ' + e for e in errors), file=sys.stderr); raise SystemExit(1)
    detail = f'; {preservation[0]} marker pages, {preservation[1]} canonical markers preserved' if preservation else ''
    print(f'[affiliate gate] OK: {marked} neutral source links; products {tally}; built={args.built}' + detail)


if __name__ == '__main__': main()
