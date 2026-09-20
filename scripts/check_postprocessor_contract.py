#!/usr/bin/env python3
"""Read-only gate for the emitter inputs consumed by the post-processors.

The eleven literal shapes below are the share-shell's charset, title, canonical,
seven metadata rewrites and article timestamp removal pattern. The last two were
silent replacements in the consumer, so renderer retention alone was not proof.
One document title is required; the inline SVG Search title is deliberately valid.

Marker preservation (contract item 5) belongs to the existing affiliate gate:
    python3 scripts/check_affiliate_surface.py --built
This gate neither stamps output nor maintains a rival affiliate baseline.

Run after the emitter, or against the completed read-only golden tree:
    python3 scripts/check_postprocessor_contract.py --public /path/to/build
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
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


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.svg_depth = 0
        self.titles = []

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.in_head = True
        if tag == 'svg':
            self.svg_depth += 1
        if tag == 'title':
            self.titles.append((self.in_head, bool(self.svg_depth)))

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
    articles = exceptions = 0
    for path in html_paths:
        relative = path.relative_to(public).as_posix()
        text = path.read_text(encoding='utf-8')
        count = len(re.findall(r'<article(?:\s|>)', text))
        closing = text.count('</article>')
        expected = 0 if relative in ARTICLE_EXCEPTIONS else 1
        if count != expected or closing != expected:
            errors.append(f'article-count: {relative}: expected {expected} article, found {count} opens/{closing} closes')
        elif expected:
            articles += 1
        else:
            exceptions += 1
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
                  sources=len(sources), noindex=noindex)
    return errors, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=ROOT / 'source/public')
    parser.add_argument('--content', type=Path, default=ROOT / 'content')
    args = parser.parse_args()
    try:
        errors, counts = check_contract(args.public, args.content)
    except (OSError, ValueError, ET.ParseError) as exc:
        print(f'[postprocessor-contract] FAIL: {exc}', file=sys.stderr)
        return 1
    summary = (f"{counts['shapes']} literal shapes; {counts['sitemap']} sitemap URLs; "
               f"{counts['articles']} article pages; {counts['exceptions']} named article exceptions; "
               f"{counts['noindex']} noindex pages from {counts['sources']} source files")
    print('[postprocessor-contract] checked ' + summary)
    if errors:
        for error in errors:
            print('[postprocessor-contract] FAIL: ' + error, file=sys.stderr)
        return 1
    print('[postprocessor-contract] OK; markers delegated to scripts/check_affiliate_surface.py --built')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
