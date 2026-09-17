#!/usr/bin/env python3
"""Check neutral source references and, with --built, activated emitted output.

Positive course-link coverage is required. Every displayed placeholder fails, including
keyless builds. This offline gate checks declared verification, not vendor availability.
"""
import argparse
import datetime as dt
from html import unescape
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, urlsplit
from _system_guides import canonical_course_url, is_bjjfanatics_url

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOC = PROJECT_ROOT / 'CLAUDE.md'
SYSTEMS_DIR = PROJECT_ROOT / 'content/Systems'
GRAPH = PROJECT_ROOT / 'graph.json'
PUBLIC = PROJECT_ROOT / 'source/public'
DOC_START = '<!-- CANONICAL-DISCLOSURE:START -->'
DOC_END = '<!-- CANONICAL-DISCLOSURE:END -->'
STALE_DAYS = 180


def canonical_disclosure():
    return DOC.read_text().split(DOC_START)[1].split(DOC_END)[0].strip()


def check_html(text, label, errors, built=False, ref=''):
    from apply_affiliate_ref import read_tag, affiliate_url, neutral_legacy_url
    canon = canonical_disclosure()
    if re.search(r'(?:href|data-(?:course|source)-url)\s*=\s*["\'][^"\']*REPLACE_ME', text, re.I):
        errors.append(f'{label}: displayed placeholder URL')
    marked = active_count = 0
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
            # A neutral source may contain ordinary references, but every built vendor
            # clickout must have a canonical marker so rotation/removal is checkable.
            if built:
                errors.append(f'{label}: unstamped BJJFanatics outgoing link')
            elif any(k.lower() in ('ref', 'rfsn') or k.lower().startswith('utm_') for k in parse_qs(urlsplit(attrs['href']).query)):
                errors.append(f'{label}: source outgoing link carries tracking')
        if not active and ('sponsored' in attrs.get('rel', '').split() or attrs.get('data-affiliate') == 'true'):
            errors.append(f'{label}: affiliate promotion without configured canonical link')
        if active:
            active_count += 1
            before = text[:match.start()]
            notice = re.search(r'<span class="affiliate-disclosure">([^<]*)</span>\s*$', before)
            if not notice or unescape(notice[1]) != canon:
                errors.append(f'{label}: active link lacks proximate canonical disclosure')
    notices = re.findall(r'<(?:span|p)\b[^>]*class=["\'][^"\']*affiliate-disclosure[^"\']*["\'][^>]*>', text)
    if len(notices) != active_count or (canon in text and not active_count):
        errors.append(f'{label}: disclosure count disagrees with active links')
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


def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('--built', action='store_true'); ap.add_argument('--strict-stale', action='store_true'); args = ap.parse_args()
    errors, warnings = [], []
    tally = check_products(errors, warnings, args.strict_stale)
    marked = sum(check_html(path.read_text(), path.name, errors) for path in SYSTEMS_DIR.glob('*.md'))
    if not marked:
        errors.append('No neutral source course anchors checked; regenerate Markdown')
    check_graph_json(errors)
    if args.built:
        from apply_affiliate_ref import configured_ref, validate_ref
        ref = configured_ref()
        try:
            validate_ref(ref); check_built(errors, ref)
        except ValueError:
            errors.append('Invalid affiliate configuration or emitted course URL')
    for warning in warnings: print('[affiliate gate] WARN: ' + warning)
    if errors:
        print('\n'.join('[affiliate gate] FAIL: ' + e for e in errors), file=sys.stderr); raise SystemExit(1)
    print(f'[affiliate gate] OK: {marked} neutral source links; products {tally}; built={args.built}')


if __name__ == '__main__': main()
