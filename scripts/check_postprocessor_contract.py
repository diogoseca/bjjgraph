#!/usr/bin/env python3
"""Read-only gate for the emitter inputs consumed by the post-processors.

The eleven literal shapes below are the share-shell's charset, title, canonical,
seven metadata rewrites and article timestamp removal pattern. The last two were
silent replacements in the consumer, so renderer retention alone was not proof.
One document title is required; the inline SVG Search title is deliberately valid.

Marker preservation (contract item 5) belongs to the existing affiliate gate:
    python3 scripts/check_affiliate_surface.py --built
This gate neither stamps output nor maintains a rival affiliate baseline.

Both timestamps remain required. Outcomes are 0=conforms, 1=real failure, and
2=expected pending ONLY when every eligible page lacks publication, all other
checks conform, and the known omission-producing Head/lastmod bytes still match.
CI must require the exact verdict marker as well as the exit code: Python itself
also exits 2 for a missing script or invalid arguments. All eleven index checks
remain required; pending honestly reports ten matches, not eleven.

Eligible paths come from static/contentIndex.json source keys plus source-backed
folder copies, independently of timestamp presence. Completeness of that index is
B's contract: jointly dropping an index key and its page metadata is not proved by
this gate. Timestamp values/provenance belong to Head/date tests. The temporary
source pin can reactivate on an exact source revert; X-01 acceptance must DELETE
the pending branch, per GOLDEN-RECAPTURE.md. No calendar, flag or ancestry machinery.

Run after the emitter, or against the completed read-only golden tree:
    python3 scripts/check_postprocessor_contract.py --public /path/to/build
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
# Explicit measured exceptions, not a dev/** exemption. These artifacts do not
# enter the discovery article exporter. A new article-free route must be reviewed.
ARTICLE_EXCEPTIONS = frozenset({
    'game-over.html',
    'dev/index.html',
    'dev/usecases/index.html',
    'dev/experiments/index.html',
    'dev/use-cases/index.html',
    'dev/user-journeys/index.html',
    'dev/sounds/index.html',
    'dev/email/index.html',
    'dev/userjourneys/index.html',
    'dev/components/index.html',
    'dev/screens/index.html',
})
LITERAL_SHAPES = (
    ('charset', r'<meta charset="utf-8"/>', 1),
    ('document-title', r'<title>[^<]*</title>', 1),
    ('canonical', r'<link rel="canonical" href="[^"]*"/>', 1),
    ('og:title', r'<meta property="og:title" content="[^"]*"/>', 1),
    ('og:description', r'<meta property="og:description" content="[^"]*"/>', 1),
    ('og:url', r'<meta property="og:url" content="[^"]*"/>', 1),
    ('og:type', r'<meta property="og:type" content="[^"]*"/>', 1),
    ('twitter:title', r'<meta name="twitter:title" content="[^"]*"/>', 1),
    ('twitter:description', r'<meta name="twitter:description" content="[^"]*"/>', 1),
    ('description', r'<meta name="description" content="[^"]*"/>', 1),
    ('article-times', r'<meta property="article:(?:published|modified)_time" content="[^"]*"/>', 2),
)


# Reviewed omission producer c55735dc4; this is an interim source witness, not a
# mutable baseline. Retire the entire pending branch when X-01 is accepted.
_PENDING_PRODUCER = {
    'source/quartz/components/Head.tsx':
        '31bf630ff3ca633b5a4b249f065fe530c7d01f5d0f468139e2f196a4a1d5f7e0',
    'source/quartz/plugins/transformers/lastmod.ts':
        '56bf63e28a16fbf9f13753a28a5a89e20b92cc8c74f492dbfbe5ade76b01e3e0',
}
_EXPECTED_INDEX_ERRORS = (
    'index-article-times: expected 2 literal matches, found 1',
    'index-article-times: require one published and one modified timestamp',
)


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.svg_depth = 0
        self.titles = []
        self.article_times = []
        self.all_article_times = []

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.in_head = True
        if tag == 'svg':
            self.svg_depth += 1
        if tag == 'title':
            self.titles.append((self.in_head, bool(self.svg_depth)))
        if tag == 'meta':
            # Inspect every pair, including duplicate attrs and name= mistakes.
            if any(name in {'property', 'name'} and value is not None
                   and value.strip().lower().startswith('article:')
                   and value.strip().lower().endswith('_time')
                   for name, value in attrs):
                raw = self.get_starttag_text()
                self.all_article_times.append(raw)
                if self.in_head:
                    self.article_times.append(raw)

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False
        if tag == 'svg':
            self.svg_depth = max(0, self.svg_depth - 1)


def check_index(text, errors):
    match = re.search(r'<head>([\s\S]*?)</head>', text)
    head = match[1] if match else ''
    if not head:
        errors.append('index-head: missing literal <head>...</head>')
    passed = 0
    for name, pattern, expected in LITERAL_SHAPES:
        count = len(re.findall(pattern, head))
        if count != expected:
            errors.append(f'index-{name}: expected {expected} literal matches, found {count}')
        else:
            passed += 1
    times = re.findall(r'<meta property="article:([^"]+)_time"', head)
    if sorted(times) != ['modified', 'published']:
        errors.append('index-article-times: require one published and one modified timestamp')
    parser = TitleParser()
    parser.feed(text)
    document_titles = [value for value in parser.titles if not value[1]]
    if document_titles != [(True, False)] or not parser.titles or parser.titles[0] != (True, False):
        errors.append('index-document-title: one head title must precede every inline SVG title')
    return passed


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'publication-index: duplicate JSON key {key!r}')
        result[key] = value
    return result


def _publication_paths(public):
    # ContentIndex includes every filtered source (includeEmptyFiles=true).
    # FolderPage reuses source data when a folder matches a simplified source
    # slug. Authored tag pages already have a ContentPage key; synthetic pages,
    # alias stubs and the intentionally dateless share shell are not eligible.
    index = json.loads((public / 'static/contentIndex.json').read_text(encoding='utf-8'),
                       object_pairs_hook=_unique_object)
    if not isinstance(index, dict) or not index or 'index' not in index:
        raise ValueError('publication-index: require a nonempty source index including index')
    for slug in index:
        path = PurePosixPath(slug)
        if (not slug or not path.parts or path.is_absolute() or '..' in path.parts
                or path.as_posix() != slug or '\\' in slug
                or any(ord(char) < 32 for char in slug)):
            raise ValueError(f'publication-index: unsafe or noncanonical slug {slug!r}')
    folders = {str(PurePosixPath(slug).parent) for slug in index} - {'.', 'tags'}
    simplified = {'' if slug == 'index' else slug[:-6] if slug.endswith('/index') else slug
                  for slug in index}
    canonical = {slug + '.html' for slug in index}
    copies = {folder + '/index.html' for folder in folders & simplified}
    return canonical | copies, len(index), len(copies - canonical)


def _timestamp_tags(text):
    # Same first literal head as check_index; a later head cannot lend coverage.
    head = re.search(r'<head>([\s\S]*?)</head>', text)
    parser = TitleParser()
    parser.feed('<head>' + (head[1] if head else '') + '</head>')
    # Incomplete tags are buffered by HTMLParser, not delivered as start tags.
    # They cannot be counted as an absent optional-looking timestamp.
    return parser.article_times + ([parser.rawdata] if parser.rawdata.strip() else [])


def _misplaced_timestamp_tags(text):
    head = re.search(r'<head>([\s\S]*?)</head>', text)
    outside = text[:head.start()] + text[head.end():] if head else text
    # Normal bodies contain no meta tags. Only parse the remainder when needed;
    # parsing distinguishes real tags from examples inside comments/scripts.
    if not re.search(r'<meta\b', outside, flags=re.I):
        return []
    parser = TitleParser()
    parser.feed(outside)
    return parser.all_article_times


def _check_publication_page(text, relative, errors):
    if _misplaced_timestamp_tags(text):
        errors.append(f'publication-placement: {relative}: timestamp meta outside the first head')
    times = []
    for raw in _timestamp_tags(text):
        match = re.fullmatch(
            r'<meta property="article:(published|modified)_time" content="[^"]*"/>', raw)
        if match is None:
            errors.append(f'publication-shape: {relative}: malformed or unknown timestamp meta')
        else:
            times.append(match[1])
    modified, published = times.count('modified'), times.count('published')
    if modified != 1:
        errors.append(f'publication-modified: {relative}: require one modified tag, found {modified}')
    if published > 1:
        errors.append(f'publication-duplicate: {relative}: require one published tag, found {published}')
    return modified == 1, published == 1


def _pending_source_errors(root=ROOT):
    errors = []
    for relative, expected in _PENDING_PRODUCER.items():
        try:
            actual = hashlib.sha256((root / relative).read_bytes()).hexdigest()
        except OSError:
            actual = None
        if actual != expected:
            errors.append(f'publication-pending-source: {relative} differs from reviewed omission '
                          'producer c55735dc4; pending is unavailable')
    return errors


def _publication_error(eligible, published):
    return f'publication-coverage: require {eligible} published pages, found {published}'


def source_page(path, content):
    # Content input paths currently need only the documented space-to-hyphen
    # spelling. Refuse a new escaping case instead of guessing Quartz semantics.
    relative = path.relative_to(content).with_suffix('.html').as_posix()
    if re.search(r'[&%?#\t\r\n]', relative):
        raise ValueError(f'frontmatter-noindex: unsupported source path spelling: {relative}')
    return relative.replace(' ', '-')


def check_contract(public, content):
    errors = []
    index = public / 'index.html'
    if not index.is_file():
        raise ValueError(f'index-head: missing {index}')
    shapes = check_index(index.read_text(encoding='utf-8'), errors)
    html_paths = sorted(public.rglob('*.html'))
    eligible, source_slugs, folder_copies = _publication_paths(public)
    articles = exceptions = modified_pages = published_pages = 0
    seen_eligible = set()
    for path in html_paths:
        relative = path.relative_to(public).as_posix()
        text = path.read_text(encoding='utf-8')
        if relative in eligible:
            seen_eligible.add(relative)
            modified, published = _check_publication_page(text, relative, errors)
            modified_pages += modified
            published_pages += published
        elif _timestamp_tags(text) or _misplaced_timestamp_tags(text):
            errors.append(f'publication-eligibility: {relative}: date-bearing page is absent '
                          'from the source-index-derived eligible set')
        count = len(re.findall(r'<article(?:\s|>)', text))
        closing = text.count('</article>')
        expected = 0 if relative in ARTICLE_EXCEPTIONS else 1
        if count != expected or closing != expected:
            errors.append(f'article-count: {relative}: expected {expected} article, found {count} opens/{closing} closes')
        elif expected:
            articles += 1
        else:
            exceptions += 1
    for relative in sorted(eligible - seen_eligible):
        errors.append(f'publication-page: required output missing: {relative}')
    if published_pages != len(eligible):
        errors.append(_publication_error(len(eligible), published_pages))
    pending_source_errors = _pending_source_errors() if published_pages == 0 else []
    errors.extend(pending_source_errors)
    if not articles:
        errors.append('article-coverage: zero article pages checked')

    sitemap = public / 'sitemap.xml'
    if not sitemap.is_file():
        raise ValueError(f'sitemap-floor: missing {sitemap}')
    sitemap_text = sitemap.read_text(encoding='utf-8')
    tree = ET.fromstring(sitemap_text)
    locs = [node.text or '' for node in tree.findall('.//{*}loc')]
    literal_locs = re.findall(r'<loc>([^<]+)</loc>', sitemap_text)
    if len(literal_locs) != len(locs):
        errors.append('sitemap-shape: loc entries do not retain literal <loc>...</loc> shape')
    if len(locs) < 4000:
        errors.append(f'sitemap-floor: require at least 4000 URLs, found {len(locs)}')
    if len(set(locs)) != len(locs):
        errors.append('sitemap-duplicate: repeated URLs cannot supply coverage')
    for loc in locs:
        url = urlsplit(loc)
        path = unquote(url.path).strip('/')
        if url.scheme != 'https' or url.netloc != 'bjjgraph.org' or any(part in {'.', '..'} for part in path.split('/')):
            errors.append(f'sitemap-target: invalid public URL {loc}')
            continue
        candidates = [public / (path + '.html'), public / path / 'index.html'] if path else [index]
        if not any(candidate.is_file() for candidate in candidates):
            errors.append(f'sitemap-target: no HTML file for {loc}')

    sources = sorted(content.rglob('*.md'))
    noindex = 0
    for source in sources:
        text = source.read_text(encoding='utf-8').strip()
        frontmatter = re.match(r'^---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, flags=re.S)
        if not frontmatter:
            continue
        declarations = re.findall(r'^noindex:\s*([^\r\n]*)', frontmatter[1], flags=re.M)
        if not declarations:
            continue
        value = declarations[0].partition('#')[0].strip()
        if len(declarations) != 1 or value not in {'true', 'false'}:
            errors.append(f'frontmatter-noindex: unsupported boolean declaration in {source.name}')
            continue
        if value != 'true':
            continue
        noindex += 1
        page = public / source_page(source, content)
        if not page.is_file():
            errors.append(f'frontmatter-noindex: missing {page.name}')
            continue
        from regenerate_agent_discovery import ArticleParser
        parser = ArticleParser()
        parser.feed(page.read_text(encoding='utf-8'))
        if not parser.noindex:
            errors.append(f'frontmatter-noindex: {page.name} lost meta name="robots" with noindex')
    if not sources or not noindex:
        errors.append(f'source-coverage: require positive Markdown and noindex coverage; found {len(sources)} sources/{noindex} noindex')
    counts = dict(shapes=shapes, sitemap=len(locs), articles=articles, exceptions=exceptions,
                  sources=len(sources), noindex=noindex, eligible=len(eligible),
                  published=published_pages, modified=modified_pages,
                  source_slugs=source_slugs, folder_copies=folder_copies,
                  pending_source_matches=not pending_source_errors)
    return errors, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=ROOT / 'source/public')
    parser.add_argument('--content', type=Path, default=ROOT / 'content')
    args = parser.parse_args()
    try:
        errors, counts = check_contract(args.public, args.content)
    except (OSError, ValueError, ET.ParseError) as exc:
        print(f'[postprocessor-contract] REAL FAILURE: {exc}', file=sys.stderr)
        print('POSTPROCESSOR_CONTRACT_RESULT=failure')
        return 1
    summary = (f"{counts['shapes']} literal shapes; {counts['sitemap']} sitemap URLs; "
               f"{counts['articles']} article pages; {counts['exceptions']} named article exceptions; "
               f"{counts['noindex']} noindex pages from {counts['sources']} source files")
    print('[postprocessor-contract] checked ' + summary)
    print(f"[postprocessor-contract] publication: {counts['published']}/{counts['eligible']} pages; "
          f"modified: {counts['modified']}/{counts['eligible']}; "
          f"{counts['source_slugs']} source slugs + {counts['folder_copies']} additional folder copies")
    if errors:
        expected = list(_EXPECTED_INDEX_ERRORS) + [_publication_error(counts['eligible'], 0)]
        # Full-list equality: an additional failure can NEVER hide behind pending.
        pending = (counts['published'] == 0 and counts['eligible'] > 0
                   and counts['modified'] == counts['eligible']
                   and sorted(errors) == sorted(expected))
        if pending:
            print('[postprocessor-contract] EXPECTED PENDING: publication is absent on EVERY '
                  'eligible page, pending git-derived publication work; known producer verified. '
                  f"{counts['shapes']}/{len(LITERAL_SHAPES)} required literal shapes match; "
                  'contract still requires both timestamps; exit 2.', file=sys.stderr)
        else:
            if counts['published'] == 0 and counts['pending_source_matches']:
                print('[postprocessor-contract] EXPECTED ABSENCE: no eligible page carries '
                      'publication under the known producer, but other deviations prevent pending.',
                      file=sys.stderr)
            print('[postprocessor-contract] REAL FAILURE: deviations exceed the exact '
                  'all-absent, known-producer pending state; exit 1.', file=sys.stderr)
        for error in errors:
            print('[postprocessor-contract] ' + ('DEVIATION: ' if pending else 'FAIL: ') + error,
                  file=sys.stderr)
        print('POSTPROCESSOR_CONTRACT_RESULT=' + ('pending' if pending else 'failure'))
        return 2 if pending else 1
    print('[postprocessor-contract] OK; markers delegated to scripts/check_affiliate_surface.py --built')
    print('POSTPROCESSOR_CONTRACT_RESULT=conforms')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
