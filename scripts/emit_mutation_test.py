#!/usr/bin/env python3
"""Mutation proofs for V's instruments, using actual entry points and emitted bytes.

  python3 scripts/emit_mutation_test.py --capture-driver
  python3 scripts/emit_mutation_test.py --app-assets
  python3 scripts/emit_mutation_test.py --date-cardinality
  python3 scripts/emit_mutation_test.py --phantom-controls
  python3 scripts/emit_mutation_test.py --extractor-controls
  python3 scripts/emit_mutation_test.py --visible-date-disclosure

The capture-driver suite uses tiny local command fixtures, never npm/network or a
site build. It pins supplied step order/cwd, fail-fast execution, positive output,
immutable labels, authority identity, capture-year provenance and validation-only
mode. Hostile ambient TZ is pinned to UTC, the child renders exact winter/summer
dates, contradictory plans fail before execution, and an unpinned environment is
refused. These are environment controls, not proof of source-date provenance.
It does not prove the deploy list agrees with workflows (F owns that gate),
browser behavior, any complete build, keyed injection or dependency closure.

The recon's 15-regression corpus table is not yet implemented here; no kill claim
for those cases follows from the driver suite. Per-page and value-rule mutants live
in seam_golden_selftest.py. Empty emit observations do not prove unexercised output
branches: positive emitter fixtures belong to B.

The app-assets suite drives check_build_fingerprint.capture on real tiny filesystem
trees. It pins named additions, removals, same-count renames, same-size JS/CSS edits,
recursive discovery, and rejection of empty or corrupt inventories. It does not
prove browser behavior or generation of seeded assets. The golden's app region has
two files and no deferred asset yet; fixtures exercise those absent branches.
The date-cardinality suite pins retirement of BOTH exact timestamp counts without
forgiving missing meta tags or changes to unrelated fields. It does not assert date
spread or validate git provenance; that remains an explicit X-01 integration gap.

The phantom-controls suite runs the real JS/TS gate's selftest from isolated module
copies. It kills empty, duplicated and token-remapped parser results. Exact counts
and exact specifiers supplement positive execution; quoted structural siblings and
a malformed-quote fixture pin the token path. No product source is changed or
reverted; its SHA-256 is asserted unchanged in finally (COORDINATION 7I/7K).
The extractor-controls suite uses two authored HTML fixtures and two non-HTML
decoys containing the same bytes. Exact file/page/field counts catch overscope;
single/double quoted ID siblings pin the token path. Temporary-copy mutants remove
JSON-LD, broaden HTML classification and mangle parsed IDs. This is extractor
evidence, not a full-site parity or feature-exercise claim.
The visible-date-disclosure suite verifies the explicit field-reporting blind spot:
an identical 1,000-page fixture exits 0, changing only p.content-meta exits 1 via
the raw hash, and BOTH reports name the gap. It does not extract visible dates.
"""
import copy
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def extractor_control_probe(module):
    spec = importlib.util.spec_from_file_location('v_extractor_control', module)
    gate = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = gate
    spec.loader.exec_module(gate)
    html = '''<!DOCTYPE html><html lang="en"><head><title>Fixture</title>
<meta name="description" content="Fixture description"><meta property="og:title" content="Fixture">
<link rel="canonical" href="https://example.invalid/fixture">
<script type="application/ld+json">{"@type":"WebPage","name":"Fixture"}</script>
<script type="application/ld+json">{"@type":"BreadcrumbList","name":"Fixture"}</script>
</head><body><div id="quartz-root" data-id="sidebar-overlay"></div>
<article><h2>Fixture heading</h2><a href="/inside">inside</a></article>
<nav class="category-nav"><a href="/outside">outside</a></nav></body></html>'''
    with tempfile.TemporaryDirectory(prefix='v-extractor-fixture-') as tmp:
        root = Path(tmp)
        # Same semantic IDs through both quoting forms, plus non-HTML decoys.
        (root / 'double.html').write_text(html)
        (root / 'single.html').write_text(html.replace('id="quartz-root"', "id='quartz-root'"))
        (root / 'decoy.css').write_text(html)
        (root / 'decoy.js').write_text(html)
        files = gate.scan_tree(root, jobs=1)
        assert set(files) == {'double.html', 'single.html', 'decoy.css', 'decoy.js'}, 'exact fixture file set'
        counts = gate.coverage(files)
        expected = {'files': 4, 'html_pages': 2, 'jsonld_blocks': 4, 'meta_tags': 4,
                    'pages_with_canonical': 2, 'head_links': 2, 'article_headings': 2,
                    'article_links': 2, 'outside_links': 2}
        for name, value in expected.items():
            assert counts[name] == value, (f'exact corpus coverage {name}', counts[name], value)
        assert counts['by_class'] == {'html': 2, 'css': 1, 'js': 1}, counts['by_class']
        assert counts['markers']['id:quartz-root'] == 2, 'exact marker coverage id:quartz-root'
        assert counts['markers']['id:sidebar-overlay'] == 0, 'data-id must not count as id'
        assert counts['markers']['class:category-nav'] == 2, 'exact marker coverage class:category-nav'
        for name in ('double.html', 'single.html'):
            fp = files[name]['fp']
            assert fp['canonical'] == 'https://example.invalid/fixture'
            assert fp['meta_map'] == {'name=description': 'Fixture description', 'property=og:title': 'Fixture'}
            assert fp['jsonld_types'] == ['WebPage', 'BreadcrumbList']
            assert '#quartz-root' in fp['outside']['selectors'], 'quoted ID structural sibling'
        print('PASS exact extractor control: files=4 html=2 css=1 js=1 JSON-LD=4 meta=4; quoted-ID siblings=2; data-id decoy excluded')


def extractor_controls_suite():
    source = Path(__file__).resolve().with_name('emit_fingerprint.py')
    inputs = [source, Path(__file__).resolve()]
    stamp = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    code = source.read_text()
    def change(needle, replacement):
        assert code.count(needle) == 1, ('extractor mutant anchor', needle, code.count(needle))
        return code.replace(needle, replacement)
    cases = [
        ('clean', code, 0, None),
        ('matches-nothing', change('if stype == "application/ld+json":',
                                   'if stype == "application/ld+json" and False:'),
         1, 'exact corpus coverage jsonld_blocks'),
        ('matches-too-much', change('if low.endswith(".html"):',
                                    'if low.endswith((".html", ".css", ".js")):'),
         1, 'exact corpus coverage html_pages'),
        ('malformed-token', change('ids.add(n.attrs["id"])',
                                   'ids.add("\\\\" + n.attrs["id"])'),
         1, 'exact marker coverage id:quartz-root'),
    ]
    try:
        with tempfile.TemporaryDirectory(prefix='v-extractor-controls-') as tmp:
            for name, text, want, reason in cases:
                module = Path(tmp) / (name + '.py'); module.write_text(text)
                proc = subprocess.run([sys.executable, str(Path(__file__).resolve()),
                                       '--extractor-probe', str(module)], capture_output=True, text=True, timeout=30)
                assert proc.returncode == want, (name, proc.returncode, want, proc.stdout, proc.stderr)
                if reason:
                    assert reason in proc.stderr, (name, 'wrong failure', proc.stderr)
                else:
                    print(proc.stdout, end='')
                print(f'PASS extractor control {name}: exit={proc.returncode}')
        print('PASS coverage: 4 extractor CLI controls, 3/3 mutants killed; no built tree required')
    finally:
        assert {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs} == stamp, 'extractor input set changed; run is void'
        print('PASS extractor input hashes unchanged: files=2; product reverts=0')


def phantom_controls_suite():
    source = Path(__file__).resolve().with_name('check_phantom_imports.mjs')
    before = source.read_bytes()
    before_sha = hashlib.sha256(before).hexdigest()
    original = before.decode()
    root = source.parent.parent
    # Relocate only dependency resolution for the isolated copy; parser/assertions
    # remain the actual implementation. Every replacement must hit exactly once.
    def change(text, needle, replacement):
        assert text.count(needle) == 1, ('mutant anchor count', needle, text.count(needle))
        return text.replace(needle, replacement)
    code = change(original,
                  "const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
                  'const toolRoot = ' + json.dumps(str(root)) + ';')
    code = change(code, "createRequire(new URL('../source/package.json', import.meta.url))",
                  "createRequire(path.join(toolRoot, 'source/package.json'))")
    cases = [
        ('clean', code, 0, None),
        ('matches-nothing', change(code, 'return rows;', 'return [];'), 2, 'zero import specifiers'),
        ('matches-too-much', change(code, 'return rows;', 'return rows.concat(rows);'),
         2, 'exact specifier count'),
        ('wrong-token', change(code, 'if (ts.isStringLiteralLike(n)) return n.text;',
                              'if (ts.isStringLiteralLike(n)) return n.text.replace("preact", "@scope/pkg");'),
         2, 'exact specifier identity'),
    ]
    try:
        with tempfile.TemporaryDirectory(prefix='v-phantom-controls-') as tmp:
            for name, text, want, reason in cases:
                module = Path(tmp) / (name + '.mjs')
                module.write_text(text)
                proc = subprocess.run(['node', str(module), '--selftest'],
                                      capture_output=True, text=True, timeout=30)
                assert proc.returncode == want, (name, proc.returncode, want, proc.stdout, proc.stderr)
                if reason:
                    assert reason in proc.stderr, (name, 'wrong failure', proc.stderr)
                else:
                    clean_stdout = proc.stdout
                print(f'PASS phantom control {name}: exit={proc.returncode}')
            assert 'quoted structural siblings' in clean_stdout, clean_stdout
            assert 'malformed quoted import is not absence' in clean_stdout, clean_stdout
        print('PASS coverage: 4 phantom CLI controls, 3/3 parser mutants killed; no site build')
    finally:
        assert hashlib.sha256(source.read_bytes()).hexdigest() == before_sha, 'phantom source changed during mutant run'
        print('PASS phantom source SHA-256 unchanged; source reverts=0')


def app_assets_suite():
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-app-assets-') as tmp:
        root = Path(tmp)
        app = root / 'static/neural/app'
        app.mkdir(parents=True)
        # The versioned file carries its one baked literal, as neural/build/build.mjs emits it.
        js = app / 'neural.js'; js.write_bytes(b'let fixture=1;globalThis.NG_APP_VERSION="1.0.0";')
        css = app / 'neural.css'; css.write_bytes(b'.fixture{color:red}')
        base = gate.capture(1, root)
        assert base.get('app_assets', {}).get('count') == 2, 'app/ files were not inventoried'
        assert set(base['app_assets']['files']) == {
            'static/neural/app/neural.js', 'static/neural/app/neural.css'}
        stood_in = js.read_bytes().replace(b'NG_APP_VERSION="1.0.0"', b'NG_APP_VERSION="' + gate.VERSION_STAND_IN + b'"')
        assert base['app_assets']['files']['static/neural/app/neural.js'] == {
            'bytes': len(stood_in), 'sha256': hashlib.sha256(stood_in).hexdigest(),
            'version_token': 'normalised'}, 'the versioned row is not the stand-in hash'
        assert base['app_assets']['files']['static/neural/app/neural.css'] == {
            'bytes': css.stat().st_size, 'sha256': hashlib.sha256(css.read_bytes()).hexdigest()}
        assert base['_app_baked'] == {'static/neural/app/neural.js': ['1.0.0']}
        checked = 0
        def expect(label, cur, *needles):
            nonlocal checked
            problems = gate.check_census(base, cur)
            if needles:
                for needle in needles:
                    assert any(needle in p for p in problems), (label, needle, problems)
            else:
                assert not problems, (label, problems)
            checked += 1
            print(f'PASS app {label}: covered_files={cur["app_assets"]["count"]}')
        def expect_version(label, cur, version, needle):
            nonlocal checked
            problems = gate.check_app_version(cur['_app_baked'], version)
            assert (any(needle in p for p in problems) if needle else not problems), (label, problems)
            checked += 1
            print(f'PASS app version {label}')
        expect('identical', gate.capture(1, root))
        expect_version('matches package.json', gate.capture(1, root), '1.0.0', None)
        for path in (js, css):
            old = path.read_bytes()
            path.write_bytes(bytes([old[0] ^ 1]) + old[1:])
            expect('same-size edit ' + path.name, gate.capture(1, root),
                   'app asset ' + path.relative_to(root).as_posix() + ': CHANGED')
            path.write_bytes(old)
        # FORMAT 4. A version-only bump moves no row; the version itself is still asserted.
        old = js.read_bytes()
        js.write_bytes(old.replace(b'"1.0.0"', b'"1.0.10"'))
        bumped = gate.capture(1, root)
        expect('version-only bump (1.0.0 -> 1.0.10, a different length)', bumped)
        expect_version('bumped bundle vs bumped package.json', bumped, '1.0.10', None)
        expect_version('stale bundle vs bumped package.json', gate.capture(1, root), '1.0.11',
                       "carries version '1.0.10' but package.json says '1.0.11'")
        # An edit adjacent to the literal is NOT inside it, so it still moves the row.
        js.write_bytes(old.replace(b';globalThis.', b':globalThis.'))
        expect('edit next to the version literal', gate.capture(1, root),
               'app asset static/neural/app/neural.js: CHANGED')
        js.write_bytes(old.replace(b'NG_APP_VERSION="1.0.0";', b''))
        expect_version('literal absent', gate.capture(1, root), '1.0.0', 'carries its version literal 0 time(s)')
        js.write_bytes(old + b'NG_APP_VERSION="1.0.0";')
        expect_version('literal twice', gate.capture(1, root), '1.0.0', 'carries its version literal 2 time(s)')
        js.write_bytes(old)
        # Only the NAMED file is normalised: the same literal in any other file is ordinary bytes.
        oldcss = css.read_bytes()
        css.write_bytes(oldcss + b'/*NG_APP_VERSION="1.0.0"*/')
        cur = gate.capture(1, root)
        css.write_bytes(oldcss + b'/*NG_APP_VERSION="1.0.1"*/')
        problems = gate.check_census(cur, gate.capture(1, root))
        assert any('neural.css: CHANGED' in p for p in problems), problems
        checked += 1; print('PASS app literal outside the named file is not normalised')
        css.write_bytes(oldcss)
        deferred = app / 'reading.css'; deferred.write_bytes(b'.reading{}')
        expect('new deferred CSS', gate.capture(1, root),
               'app asset static/neural/app/reading.css: ADDED', 'app asset count: 2 -> 3')
        deferred.unlink()
        renamed = app / 'reference.css'; css.rename(renamed)
        expect('same-count rename', gate.capture(1, root),
               'app asset static/neural/app/neural.css: REMOVED',
               'app asset static/neural/app/reference.css: ADDED')
        renamed.rename(css)
        oldcss = css.read_bytes(); css.unlink()
        expect('removed CSS', gate.capture(1, root),
               'app asset static/neural/app/neural.css: REMOVED')
        css.write_bytes(oldcss)
        nested = app / 'chunks/.future.bin'; nested.parent.mkdir()
        nested.write_bytes(b'\x00\x01')
        expect('new nested arbitrary extension', gate.capture(1, root),
               'app asset static/neural/app/chunks/.future.bin: ADDED')
        nested.unlink()
        # A malformed baseline must fail too, including empty compared to empty.
        js_row = base['app_assets']['files']['static/neural/app/neural.js']
        css_row = base['app_assets']['files']['static/neural/app/neural.css']
        for label, value in (
            ('zero', {'count': 0, 'files': {}}),
            ('invented count', {**base['app_assets'], 'count': 3}),
            ('missing block', None),
            ('bad hash', {'count': 1, 'files': {'static/neural/app/bad.js':
                                               {'bytes': 1, 'sha256': 'bad'}}}),
            ('format-3 raw row for the versioned file', {'count': 2, 'files': {
                'static/neural/app/neural.js': {k: v for k, v in js_row.items() if k != 'version_token'},
                'static/neural/app/neural.css': css_row}}),
            ('stand-in claimed on an unversioned file', {'count': 2, 'files': {
                'static/neural/app/neural.js': js_row,
                'static/neural/app/neural.css': {**css_row, 'version_token': 'normalised'}}}),
        ):
            bad = copy.deepcopy(base); bad['app_assets'] = value
            assert gate.check_app_assets(bad, 'candidate'), label
            assert gate.check_census(bad, bad), label + ' matched itself cleanly'
            checked += 1; print(f'PASS app invalid {label}')
        shutil.rmtree(app)
        (root / 'unrelated.txt').write_text('the tree exists, the app region does not')
        empty = gate.capture(1, root)
        assert any('app assets' in p for p in gate.check_floors(empty))
        checked += 1; print('PASS app missing region: covered_files=0 rejected')
        print(f'PASS coverage: {checked} app-assets cases; real filesystem mutations, no build')
    app_reseed_suite()
    bundle_stamp_suite()
    version_value_suite()


def bundle_stamp_suite():
    """Format 5: postscript.js carries the deploy's build stamp; one literal, normalised, asserted."""
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-bundle-stamp-') as tmp:
        root = Path(tmp)
        (root / 'static/neural/app').mkdir(parents=True)
        (root / 'static/neural/app/neural.js').write_bytes(b'globalThis.NG_APP_VERSION="1.0.0";')
        (root / 'index.css').write_bytes(b'.a{}')
        pre = root / 'prescript.js'; pre.write_bytes(b'loader();/*"1.0.0"*/')
        post = root / 'postscript.js'
        stamp = lambda v, shape='var': (b'x();var e="' + v + b'";window.__NEURAL_BUILD=e;y()' if shape == 'var'
                                        else b'x();window.__NEURAL_BUILD="' + v + b'";y()')
        post.write_bytes(stamp(b'1.0.0'))
        base = gate.capture(1, root)
        assert base['bundles']['postscript.js']['version_token'] == 'normalised'
        assert 'version_token' not in base['bundles']['prescript.js']
        assert base['_app_baked']['postscript.js'] == ['1.0.0']
        assert not gate.check_baseline({**base, 'distinct_values': {}}), 'a captured format-5 row is invalid'
        checked = 0
        def census(label, *needles):
            nonlocal checked
            problems = gate.check_census(base, gate.capture(1, root))
            assert (all(any(n in p for p in problems) for n in needles) if needles else not problems), (label, problems)
            checked += 1; print(f'PASS stamp {label}')
        def version(label, expected, needle):
            nonlocal checked
            baked = gate.capture(1, root)['_app_baked']   # the stamp alone: the fixture's neural.js stays 1.0.0
            problems = gate.check_app_version({'postscript.js': baked['postscript.js']}, expected)
            assert (any(needle in p for p in problems) if needle else not problems), (label, problems)
            checked += 1; print(f'PASS stamp version {label}')
        census('identical')
        post.write_bytes(stamp(b'1.0.10'))
        census('version-only bump moves no bundle row (1.0.0 -> 1.0.10)')
        version('bumped stamp vs bumped package.json', '1.0.10', None)
        version('stale stamp vs bumped package.json', '1.0.11', "postscript.js: carries version '1.0.10'")
        post.write_bytes(stamp(b'1.0.0', 'inline'))
        version('the inline shape is read too', '1.0.0', None)
        post.write_bytes(stamp(b'1.0.0') + b'var f="1.0.0";window.__NEURAL_BUILD=f;')
        version('stamp twice', '1.0.0', 'postscript.js: carries its version literal 2 time(s)')
        post.write_bytes(b'x();y()')
        version('stamp absent', '1.0.0', 'postscript.js: carries its version literal 0 time(s)')
        post.write_bytes(stamp(b'1.0.0').replace(b'x();', b'z();'))
        census('an edit beside the stamp still moves the row', 'bundle postscript.js: CHANGED')
        post.write_bytes(stamp(b'1.0.0'))
        pre.write_bytes(b'loader();/*"1.0.10"*/')
        census('the same literal in an unversioned bundle is ordinary bytes', 'bundle prescript.js: CHANGED')
        pre.write_bytes(b'loader();/*"1.0.0"*/')
        for label, bundles in (
            ('format-4 raw row for postscript.js', {**base['bundles'], 'postscript.js':
                {k: v for k, v in base['bundles']['postscript.js'].items() if k != 'version_token'}}),
            ('stand-in claimed on prescript.js', {**base['bundles'], 'prescript.js':
                {**base['bundles']['prescript.js'], 'version_token': 'normalised'}}),
        ):
            bad = {**base, 'bundles': bundles, 'distinct_values': {}}
            assert any('baseline bundle' in p for p in gate.check_baseline(bad)), label
            checked += 1; print(f'PASS stamp invalid {label}')
        print(f'PASS coverage: {checked} bundle-stamp cases; real filesystem trees, no build')


def version_value_suite():
    """v1.206.2: the version VALUE is normalised in every listed file, required there at least once,
    and forbidden (with its context printed) in every other fingerprinted file."""
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-version-value-') as tmp:
        root = Path(tmp)
        app = root / 'static/neural/app'; app.mkdir(parents=True)
        nj, st, ot = app / 'neural.js', app / 'settings-ui.js', app / 'other.js'
        pre, post = root / 'prescript.js', root / 'postscript.js'
        (root / 'index.css').write_bytes(b'.a{}')
        def write(v, extra_other=b''):
            nj.write_bytes(b'globalThis.NG_APP_VERSION="' + v + b'";var Ds="' + v + b':abc";u.set("v","' + v + b'")')
            st.write_bytes(b'var F="' + v + b':abc";')
            ot.write_bytes(b'let o=1;' + extra_other)
            pre.write_bytes(b'loader();')
            post.write_bytes(b'window.__NEURAL_BUILD="' + v + b'";')
        write(b'2.0.0')
        base = gate.capture(1, root, version='2.0.0')
        assert base['app_assets']['files']['static/neural/app/settings-ui.js']['version_token'] == 'normalised'
        assert base['_version_refs']['static/neural/app/neural.js'][0] == 3
        checked = 0
        def expect(label, version, census_needles=(), version_needles=()):
            nonlocal checked
            cur = gate.capture(1, root, version=version)
            census = gate.check_census(base, cur)
            vp = gate.check_app_version(cur['_app_baked'], version) + gate.check_version_refs(cur['_version_refs'], version)
            assert all(any(n in p for p in census) for n in census_needles) if census_needles else not census, (label, census)
            assert all(any(n in p for p in vp) for n in version_needles) if version_needles else not vp, (label, vp)
            checked += 1; print(f'PASS value {label}')
        expect('identical', '2.0.0')
        write(b'2.0.10')
        expect('a bump moves NO row, though neural.js carries the value 3x and settings-ui.js 1x', '2.0.10')
        st.write_bytes(b'var F="2.0.0:abc";')
        expect('a stale listed bundle (still 2.0.0) is named, and its row moves too', '2.0.10',
               census_needles=('app asset static/neural/app/settings-ui.js: CHANGED',),
               version_needles=("settings-ui.js: listed as versioned but carries package.json's version '2.0.10' 0 times",))
        write(b'2.0.10', extra_other=b'var x="2.0.10:zz";')
        expect('an UNLISTED app file embedding the version fails, with its context printed', '2.0.10',
               census_needles=('app asset static/neural/app/other.js: CHANGED',),
               version_needles=("other.js: embeds the app version '2.0.10' 1 time(s) but is NOT listed", 'Matched: …', 'var x="2.0.10:zz"'))
        write(b'2.0.10', extra_other=b'var y="12.0.10",z="2.0.101",w="2.0.10.5";')
        expect('coincidental digit runs are not the version', '2.0.10', census_needles=('app asset static/neural/app/other.js: CHANGED',))
        write(b'2.0.10')
        pre.write_bytes(b'loader("2.0.10");')
        expect('a ROOT bundle embedding the version fails too', '2.0.10', census_needles=('bundle prescript.js: CHANGED',),
               version_needles=("prescript.js: embeds the app version '2.0.10' 1 time(s) but is NOT listed",))
        pre.write_bytes(b'loader();')
        assert 'static/neural/app/game-values.js' in gate.VERSIONED_APP_ASSETS and not (app / 'game-values.js').exists()
        expect('a listed file that is absent is simply not checked', '2.0.10')
        print(f'PASS coverage: {checked} version-value cases; real filesystem trees, no build')


def app_reseed_suite():
    """--update-app-assets in a throwaway git repo, with a stand-in bundle build."""
    import check_build_fingerprint as gate
    def fake_build(bake):
        return ('python3', '-c', 'import pathlib; d = pathlib.Path("neural/dist"); '
                'd.mkdir(parents=True, exist_ok=True); '
                f'(d / "neural.js").write_bytes(b\'let a=1;globalThis.NG_APP_VERSION="{bake}";\'); '
                '(d / "neural.css").write_bytes(b".a{}")')
    with tempfile.TemporaryDirectory(prefix='v-app-reseed-') as tmp:
        root = Path(tmp)
        def run(*cmd):
            subprocess.run(cmd, cwd=root, check=True, capture_output=True)
        (root / 'neural/src').mkdir(parents=True); (root / 'neural/build').mkdir()
        (root / 'source').mkdir()
        (root / 'package.json').write_text('{"version": "2.0.0"}\n')
        (root / 'source/package-lock.json').write_text('{}\n')
        (root / 'neural/src/app.src.jsx').write_text('x\n')
        (root / 'neural/build/build.mjs').write_text('// stand-in\n')
        (root / '.gitignore').write_text('neural/dist/\n')
        run('git', 'init', '-q'); run('git', 'add', '-A')
        run('git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'fixture')
        head = subprocess.run(('git', 'rev-parse', 'HEAD'), cwd=root, check=True,
                              capture_output=True, text=True).stdout.strip()
        receipt = {'schema': 'fixture-receipt', 'capture_id': 'untouched'}
        base = {'_meta': {'format': gate.FORMAT, 'content_provenance': receipt}, '_note': 'old',
                'census': {'files': 123}, 'bundles': {'postscript.js': {'bytes': 1, 'sha256': '0' * 64,
                                                                        'version_token': 'normalised'}},
                'distinct_values': {}, 'markers': {'tag:main': 7},
                'app_assets': {'count': 1, 'files': {'static/neural/app/neural.js':
                                                     {'bytes': 1, 'sha256': 'a' * 64}}}}
        bl = root.parent / (root.name + '-baseline.json')
        checked = 0
        def refuse(label, needle, build):
            nonlocal checked
            bl.write_text(json.dumps(base))
            before = bl.read_bytes()
            try:
                gate.update_app_assets(bl, root, build)
            except SystemExit as e:
                assert needle in str(e.code) or needle == 'exit 1' and e.code == 1, (label, e.code)
            else:
                raise AssertionError(f'{label}: re-seeded instead of refusing')
            assert bl.read_bytes() == before, f'{label}: baseline was written anyway'
            checked += 1; print(f'PASS app re-seed refused: {label}')
        try:
            (root / 'neural/dist').mkdir()
            (root / 'neural/dist/leftover.js').write_text('an older build')
            bl.write_text(json.dumps(base))
            new = gate.update_app_assets(bl, root, fake_build('2.0.0'))
            assert json.loads(bl.read_text()) == new, 'written baseline differs from the returned one'
            assert new['_meta']['format'] == gate.FORMAT
            assert new['_meta']['content_provenance'] == receipt, 'the content receipt was touched'
            prov = new['_meta']['app_provenance']
            assert prov['git_head'] == head and prov['package_version'] == '2.0.0', prov
            assert set(prov['inputs']) == set(gate.APP_INPUTS), prov['inputs']
            for key in set(base) | set(new):
                if key not in ('app_assets', '_meta', '_note'):
                    assert new.get(key) == base.get(key), f'{key} changed'
            rows = new['app_assets']['files']
            assert set(rows) == {'static/neural/app/neural.js', 'static/neural/app/neural.css'}, \
                'a leftover dist file from an older build was seeded'
            assert rows['static/neural/app/neural.js']['version_token'] == 'normalised'
            checked += 1; print('PASS app re-seed: only app rows + app provenance moved; leftover not seeded')
            refuse('bundle baked at a stale version', 'exit 1', fake_build('1.9.9'))
            (root / 'neural/src/app.src.jsx').write_text('y\n')
            refuse('dirty tracked input', 'not clean committed bytes', fake_build('2.0.0'))
            run('git', 'checkout', '-q', '--', 'neural/src/app.src.jsx')
            (root / 'neural/src/new.src.js').write_text('untracked\n')
            refuse('untracked input', 'not clean committed bytes', fake_build('2.0.0'))
            (root / 'neural/src/new.src.js').unlink()
            touching = fake_build('2.0.0')[:2] + (fake_build('2.0.0')[2] +
                                                  '; pathlib.Path("neural/src/app.src.jsx").write_text("z")',)
            refuse('build rewrote its own input', 'modified its own inputs', touching)
            run('git', 'checkout', '-q', '--', 'neural/src/app.src.jsx')
            base['_meta']['format'] = 4
            refuse('format-4 baseline (bundle rows changed meaning in 5)', 'format 4', fake_build('2.0.0'))
        finally:
            bl.unlink(missing_ok=True)
        print(f'PASS coverage: {checked} app re-seed cases; a real git repo, a stand-in build')


def date_cardinality_suite():
    import check_build_fingerprint as gate
    with tempfile.TemporaryDirectory(prefix='v-date-cardinality-') as tmp:
        root = Path(tmp)
        (root / 'static/neural/app').mkdir(parents=True)
        (root / 'static/neural/app/fixture.js').write_text('fixture')
        page = root / 'index.html'
        published = '<meta property="article:published_time" content="2026-09-20T17:15:14.688Z">'
        modified = '<meta property="article:modified_time" content="2026-07-16T13:14:23.000Z">'
        html = '<html><head>' + published + modified + '</head><body></body></html>'
        page.write_text(html)
        base = gate.capture(1, root)
        for field in ('property=article:published_time', 'property=article:modified_time'):
            assert field not in base['distinct_values'], 'capture would re-seed ' + field
        print('PASS dates: capture omits both retired cardinalities')
        for field, value in (('property=article:published_time', 888),
                             ('property=article:modified_time', 28)):
            restored = copy.deepcopy(base); restored['distinct_values'][field] = value
            problems = gate.check_census(restored, base)
            assert any('retired date row' in p and field in p for p in problems), (
                'clean JSON merge silently restored retired row', field, problems)
            print('PASS dates: restored baseline ' + field + ' is RED')
        for tag, name in ((published, 'published'), (modified, 'modified')):
            page.write_text(html.replace(tag, ''))
            problems = gate.check_census(base, gate.capture(1, root))
            assert any('meta key property=article:' + name + '_time' in p for p in problems), problems
            print('PASS dates: missing ' + name + ' tag remains RED')
        cur = copy.deepcopy(base); cur['distinct_values']['name=description'] = 999
        assert any('name=description' in p for p in gate.check_census(base, cur))
        print('PASS dates: unrelated distinct-value row remains RED')
        baseline = root / 'baseline.json'
        for label, key, value in [('valid', None, None),
                                  ('published row restored', 'property=article:published_time', 888),
                                  ('modified row restored', 'property=article:modified_time', 28)]:
            observed = copy.deepcopy(base)
            if key:
                observed['distinct_values'][key] = value
            baseline.write_text(json.dumps(observed))
            proc = subprocess.run([sys.executable, str(Path(gate.__file__)), '--check-baseline',
                                   '--baseline', str(baseline), '--tree', str(root / 'NO-BUILT-TREE')],
                                  capture_output=True, text=True)
            assert proc.returncode == (1 if key else 0), (label, proc.stdout, proc.stderr)
            if key:
                assert 'retired date row ' + key in proc.stdout, proc.stdout
            else:
                assert 'app covered_files=1' in proc.stdout and 'built_tree_files_scanned=0' in proc.stdout
            print(f'PASS baseline CLI {label}: exit={proc.returncode}, no tree required')
        print('PASS coverage: 9 date-cardinality cases; spread and provenance unasserted')


def capture_driver_suite():
    original = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='v-capture-driver-', dir='/home/user/tmp-pw') as tmp:
        root = Path(tmp) / 'repo'; root.mkdir()
        for d in ('scripts', 'source', 'content', 'bin'):
            (root / d).mkdir()
        for name in ('emit_golden.sh', 'emit_fingerprint.py', 'golden_provenance.py', 'capture_environment.py'):
            shutil.copyfile(original / name, root / 'scripts' / name)
        (root / 'source/package-lock.json').write_text('{}')
        (root / 'content/page.md').write_text('fixture')
        (root / 'authority.md').write_text('Three local fixture steps, in declared order.')
        # Any accidental legacy npm build must stop locally, never reach a package tool.
        for binary in ('npm', 'npx'):
            p = root / 'bin' / binary; p.write_text('#!/bin/sh\nexit 93\n'); p.chmod(0o755)
        subprocess.run(['git', 'init', '-q', str(root)], check=True)
        subprocess.run(['git', '-C', str(root), 'add', 'authority.md', 'source/package-lock.json', 'content/page.md'], check=True)
        subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'fixture inputs'], check=True)
        env = os.environ.copy(); env['PATH'] = str(root / 'bin') + os.pathsep + env['PATH']
        env['TZ'] = 'Pacific/Honolulu'  # hostile inherited zone, never the capture contract
        for k in ('POSTHOG_API_KEY', 'POSTHOG_API_HOST', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AFFILIATE_REF', 'SHOW_BREADCRUMBS'):
            env.pop(k, None)
        html = '<!DOCTYPE html><html><head><title>Fixture</title><link rel="canonical" href="https://example.invalid/"><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><article>fixture</article></body></html>'
        plan = {'schema': 'quartz-capture-steps-v1', 'authority': {
            'path': str(root / 'authority.md'), 'sha256': hashlib.sha256((root / 'authority.md').read_bytes()).hexdigest()},
            'environment': {'TZ': 'UTC'},
            'steps': [
                {'cwd': 'repo', 'argv': [sys.executable, '-c', "import os; assert os.environ['TZ']=='UTC', 'step did not inherit UTC'; from pathlib import Path; Path('order').write_text('1'); Path('source/public').mkdir()"]},
                {'cwd': 'source', 'argv': [sys.executable, '-c', "from pathlib import Path; p=Path('../order'); p.write_text(p.read_text()+'2'); Path('public/index.html').write_text(" + repr(html) + ")"]},
                {'cwd': 'repo', 'argv': [sys.executable, '-c', "from pathlib import Path; p=Path('order'); p.write_text(p.read_text()+'3')"]},
            ]}
        steps = root / 'steps.json'; steps.write_text(json.dumps(plan))
        dest = Path(tmp) / 'goldens'; checked = 0
        def run(label, want, *flags):
            nonlocal checked
            p = subprocess.run(['bash', str(root / 'scripts/emit_golden.sh'), str(dest), label,
                                '--steps', str(steps), *flags], cwd=root, env=env, capture_output=True, text=True)
            assert p.returncode == want, (label, p.returncode, want, p.stdout[-2200:], p.stderr[-2200:])
            checked += 1; print(f'PASS capture {label}: exit={want}')
            return p
        run('validation', 0, '--check-steps')
        assert not (root / 'order').exists() and not dest.exists(), 'validation executed or wrote capture'
        run('complete', 0)
        assert (root / 'order').read_text() == '123'
        assert (dest / 'complete/index.html').read_text() == html
        meta = (dest / 'complete.env.txt').read_text()
        assert 'capture_year' in meta and 'capture_id' in meta and 'steps_sha256' in meta
        receipt = json.loads((dest / 'complete.content.json').read_text())
        assert 'environment_assertions' in receipt, 'capture must attest its UTC environment'
        assert receipt['environment_assertions']['TZ']['observed'] == 'UTC'
        probes = receipt['environment_assertions']['TZ']['probes']
        assert [p['offset_minutes'] for p in probes] == [0, 0]
        assert [p['visible_date'] for p in probes] == ['Jan 01, 2026', 'Jul 01, 2026']
        assert 'timezone UTC\n' in meta and 'capture_tz UTC\n' in meta
        assert receipt['state'] == 'complete' and receipt['content_files'] == 1 and receipt['content_md'] == 1
        assert receipt['content_clean_at_start'] and receipt['content_clean_at_end']
        assert 'scripts/emit_golden.sh' in {r['path'] for r in receipt['dirty_paths_start']}
        assert all('kind' in row for row in receipt['dirty_paths_start'])
        assert receipt['output_identity']['files'] == 1 and len(receipt['output_identity']['sha256']) == 64
        events = json.loads((dest / 'complete.steps-run.json').read_text())
        assert len(events) == 3 and all(e['exit_code'] == 0 for e in events)
        for tz in (None, 'Europe/Lisbon'):
            wrong_tz = {**plan, 'environment': {'TZ': tz}}
            steps.write_text(json.dumps(wrong_tz))
            p = run('wrong-tz-' + ('unset' if tz is None else 'west'), 2, '--check-steps')
            assert 'capture requires TZ=UTC' in p.stdout + p.stderr
            assert (root / 'order').read_text() == '123'
        steps.write_text(json.dumps(plan))
        from capture_environment import assert_utc_environment
        try:
            assert_utc_environment(env, root)
        except ValueError as e:
            assert 'capture timezone assertion failed' in str(e)
        else:
            raise AssertionError('an unpinned child environment passed the UTC assertion')
        print('PASS timezone unpinned control: hostile child rejected; 2 exact UTC date probes')
        run('complete', 2)
        assert (dest / 'complete/index.html').read_text() == html, 'existing golden overwritten'
        failing = json.loads(json.dumps(plan)); failing['steps'][1]['argv'] = [sys.executable, '-c', 'raise SystemExit(7)']
        # First step no longer creates an existing directory.
        failing['steps'][0]['argv'] = [sys.executable, '-c', "from pathlib import Path; Path('order').write_text('1')"]
        steps.write_text(json.dumps(failing)); run('fail-fast', 7)
        assert (root / 'order').read_text() == '1' and not (dest / 'fail-fast').exists()
        events = json.loads((dest / 'fail-fast.steps-run.json').read_text())
        assert len(events) == 2 and events[-1]['exit_code'] == 7
        empty = {**plan, 'steps': []}; steps.write_text(json.dumps(empty)); run('zero-steps', 2, '--check-steps')
        wrong = {**plan, 'authority': {**plan['authority'], 'sha256': '0' * 64}}
        steps.write_text(json.dumps(wrong)); run('wrong-authority', 2, '--check-steps')
        preflight = {**plan, 'preflight_steps': [{'cwd': 'repo', 'argv': [sys.executable, '-c', 'raise SystemExit(6)']}]}
        (root / 'order').write_text('unchanged')
        steps.write_text(json.dumps(preflight)); run('preflight-fails', 6)
        assert (root / 'order').read_text() == 'unchanged' and not (dest / 'preflight-fails').exists()
        no_output = {**plan, 'steps': [{'cwd': 'repo', 'argv': [sys.executable, '-c', "import shutil; shutil.rmtree('source/public')"]}]}
        steps.write_text(json.dumps(no_output)); run('zero-output', 2)
        assert not (dest / 'zero-output').exists()
        wrong_env = {**plan, 'environment': {'SHOW_BREADCRUMBS': 'fixture'}}
        steps.write_text(json.dumps(wrong_env)); run('wrong-environment', 2)
        changed = {**plan, 'steps': [{'cwd': 'repo', 'argv': [sys.executable, '-c',
                   "from pathlib import Path; Path('content/page.md').write_text('owner edit'); Path('source/public').mkdir(exist_ok=True); Path('source/public/index.html').write_text(" + repr(html) + ")"]}]}
        steps.write_text(json.dumps(changed)); before = (root / 'content/page.md').read_bytes()
        result = run('content-moved', 2)
        assert 'capture inputs moved' in result.stderr and not (dest / 'content-moved').exists()
        (root / 'content/page.md').write_bytes(before)
        assert (root / 'content/page.md').read_bytes() == before
        (root / 'content/added.md').write_text('untracked new input')
        result = run('untracked-content', 2)
        assert 'fully tracked content' in result.stderr and not (dest / 'untracked-content').exists()
        (root / 'content/added.md').unlink()
        # Same committed tool, a different engine checkout with NO capture scripts.
        # A path option that still builds/attests the tool repo must fail this control.
        foreign = Path(tmp) / 'foreign'; foreign.mkdir()
        (foreign / 'source').mkdir(); (foreign / 'content').mkdir()
        (foreign / 'source/package-lock.json').write_text('{}')
        (foreign / 'content/page.md').write_text('different engine content')
        subprocess.run(['git', 'init', '-q', str(foreign)], check=True)
        subprocess.run(['git', '-C', str(foreign), 'add', 'source/package-lock.json', 'content/page.md'], check=True)
        subprocess.run(['git', '-C', str(foreign), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'external engine fixture'], check=True)
        steps.write_text(json.dumps(plan))
        run('external-checkout', 0, '--source-repo', str(foreign))
        external = json.loads((dest / 'external-checkout.content.json').read_text())
        assert external['capture_git_head'] == subprocess.check_output(['git','-C',str(foreign),'rev-parse','HEAD'],text=True).strip()
        assert external['content_tree'] != receipt['content_tree']
        assert (foreign / 'order').read_text() == '123' and not (foreign / 'scripts').exists()
        assert (dest / 'external-checkout/index.html').read_text() == html
        steps.write_text(json.dumps(plan)); (root / 'source/.env').write_text('FIXTURE=not-secret')
        run('ambient-dotenv', 2)
        print(f'PASS coverage: {checked} capture-driver cases; no full build or network command executed')


def visible_date_disclosure_suite():
    scripts = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='v-visible-date-') as tmp:
        root = Path(tmp); tree = root / 'public'; tree.mkdir()
        html = ('<html><head><title>Fixture</title><link rel="canonical" href="https://example.invalid/">'
                '<meta name="description" content="fixture"><script type="application/ld+json">'
                '{"@type":"WebPage"}</script></head><body><p class="content-meta">'
                'Last updated Sep 06, 2026</p><article>fixture</article></body></html>')
        for i in range(1000):
            (tree / f'{i}.html').write_text(html)
        def fingerprint(name):
            path = root / (name + '.json.gz')
            proc = subprocess.run([sys.executable, str(scripts / 'emit_fingerprint.py'),
                                   str(tree), '--out', str(path), '--jobs', '1'],
                                  capture_output=True, text=True, timeout=30)
            assert proc.returncode == 0, (proc.stdout, proc.stderr)
            return path
        golden = fingerprint('golden')
        for name, wanted in (('identical', 0), ('visible-date-only', 1)):
            if wanted:
                (tree / '0.html').write_text(html.replace('Sep 06', 'Sep 08'))
            candidate = fingerprint(name) if wanted else golden
            report = root / (name + '.json')
            proc = subprocess.run([sys.executable, str(scripts / 'emit_diff.py'), '--artifact-only',
                                   str(golden), str(candidate), '--json', str(report)],
                                  capture_output=True, text=True, timeout=30)
            assert proc.returncode == wanted, (name, proc.stdout, proc.stderr)
            data = json.loads(report.read_text())
            assert data['common'] == data['coverage']['golden']['html_pages'] == 1000
            assert data['identical'] == 1000 - wanted
            assert not data['missing'] and not data['extra'] and not data['problems']
            assert not data['normalizations']
            assert len(data['field_reporting_blind_spots']) == 1
            assert 'p.content-meta' in data['field_reporting_blind_spots'][0]
            assert proc.stdout.count('FIELD-REPORTING BLIND SPOT:') == 1
            assert proc.stdout.index('FIELD-REPORTING BLIND SPOT:') < proc.stdout.index('golden    :')
            if wanted:
                assert len(data['rows']) == 1 and data['rows'][0]['field'] == 'sha'
                assert data['rows'][0]['count'] == 1 and data['rows'][0]['examples'][0]['path'] == '0.html'
                assert 'DIFFERENCES FOUND: 1' in proc.stdout
            else:
                assert not data['rows'] and 'NO DIFFERENCES.' in proc.stdout
            print(f'PASS visible-date disclosure {name}: exit={wanted}; compared=1000; named gap=1')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--capture-driver', action='store_true')
    ap.add_argument('--app-assets', action='store_true')
    ap.add_argument('--date-cardinality', action='store_true')
    ap.add_argument('--phantom-controls', action='store_true')
    ap.add_argument('--extractor-controls', action='store_true')
    ap.add_argument('--visible-date-disclosure', action='store_true')
    ap.add_argument('--extractor-probe', type=Path, help=argparse.SUPPRESS)
    args = ap.parse_args()
    if not any(vars(args).values()):
        ap.error('select a named suite; no empty test run')
    if args.capture_driver:
        capture_driver_suite()
    if args.app_assets:
        app_assets_suite()
    if args.date_cardinality:
        date_cardinality_suite()
    if args.phantom_controls:
        phantom_controls_suite()
    if args.extractor_controls:
        extractor_controls_suite()
    if args.extractor_probe:
        extractor_control_probe(args.extractor_probe)
    if args.visible_date_disclosure:
        visible_date_disclosure_suite()
