#!/usr/bin/env python3
"""Compare the real app title function with every BUILT wire hub/role and reference.

Runs at the end of npm run build (e2e-full.yml) and both inline deploy chains.
No browser, new payload fields, guessed slug names or frontmatter oracle: HTML's
head title is the independent oracle. Missing files/rows/titles and zero coverage
fail. The app is evaluated with its existing unit prelude, not reimplemented.
"""
from __future__ import annotations

import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
APP_ROWS = r"""
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { knowledgeSource } from './tests/_knowledge_profile_harness.mjs';
const tree = process.argv[1], read = p => JSON.parse(readFileSync(resolve(tree, 'static/neural', p), 'utf8'));
const wire = read('graph-data.json'), concepts = read('concepts.json').concepts, systems = read('systems-index.json').systems;
if (!wire.nodes?.length || !concepts?.length || !systems?.length) throw Error('Title coverage input is empty');
const source = readFileSync('neural/src/app.src.jsx', 'utf8');
const Component = new Function('DCLogic', 'React', knowledgeSource + '\n' + source + '\nreturn Component;')(class {}, {createRef: () => ({current:null})});
const app = Object.create(Component.prototype);
app.settings = {}; app.beats = []; app.get = (_k, d) => d; app.set = app.track = app._saveProgress = () => {};
app.ingest(structuredClone(wire));
app._conceptsById = Object.fromEntries(concepts.map(c => [c.id, c]));
app._systemsById = Object.fromEntries(systems.map(s => [s.id, s]));
globalThis.location = {href: 'https://bjjgraph.test/'};
const rows = [], paths = new Set();
const add = (id, kind) => { const path = '/' + app._pageSlug(id); if (paths.has(path)) throw Error('Duplicate title path: ' + path); paths.add(path); rows.push({path, kind, title: app._pageTitle(path)}); };
for (const n of wire.nodes) {
  add(n.id, 'wire hub');
  for (const role of n.ty === 'positions' ? ['Top', 'Bottom'] : ['Attacker', 'Defender']) add(n.id + '/' + role, 'wire role');
}
for (const c of concepts) add(c.id, c.cat);
for (const s of systems) add(s.id, 'System');
if (app.nodes.length !== wire.nodes.length * 2) throw Error('Derived node coverage changed');
console.log(JSON.stringify({wireNodes: wire.nodes.length, derivedNodes: app.nodes.length, rows}));
"""


class HeadTitle(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.head = self.title = False
        self.count = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.head = True
        elif tag == 'title' and self.head:
            self.title = True
            self.count += 1

    def handle_endtag(self, tag):
        if tag == 'title':
            self.title = False
        elif tag == 'head':
            self.head = False

    def handle_data(self, data):
        if self.title:
            self.text.append(data)


def built_title(path):
    parser = HeadTitle()
    parser.feed(path.read_text().partition('</head>')[0] + '</head>')
    title = re.sub(r'[\t\n\f\r ]+', ' ', ''.join(parser.text)).strip()
    if parser.count != 1 or not title:
        raise ValueError(f'{path}: expected one nonempty head title, got {parser.count}')
    return title


def compare(tree, rows):
    if not rows:
        raise ValueError('Title coverage is zero')
    failures = []
    for row in rows:
        path = tree / (row['path'].lstrip('/') + '.html')
        if not path.is_file():
            failures.append(f"{row['path']}: built page missing")
            continue
        title = built_title(path)
        if not row['title'] or row['title'] != title:
            failures.append(f"{row['path']}: app={row['title']!r}, built={title!r}")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tree', type=Path, default=ROOT / 'source/public')
    args = parser.parse_args()
    result = subprocess.run(['node', '--input-type=module', '-e', APP_ROWS, str(args.tree.resolve())],
                            cwd=ROOT, text=True, capture_output=True, check=True)
    data = json.loads(result.stdout)
    failures = compare(args.tree, data['rows'])
    counts = Counter(row['kind'] for row in data['rows'])
    print(f"App title coverage: {data['wireNodes']} wire nodes / {data['derivedNodes']} derived members; "
          f"{len(data['rows'])} built pages; {dict(counts)}")
    for failure in failures:
        print('FAIL:', failure)
    if failures:
        raise ValueError(f'{len(failures)} built titles differ from the app')
    print(f"PASS: {len(data['rows'])} exact built titles; zero mismatches")


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f'FAIL app title coverage: {exc}', file=sys.stderr)
        if isinstance(exc, subprocess.CalledProcessError):
            print(exc.stderr, file=sys.stderr)
        sys.exit(1)
