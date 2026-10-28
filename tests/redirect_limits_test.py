#!/usr/bin/env python3
"""scripts/check_redirect_limits.py is Cloudflare's parser, and the gate fails where Cloudflare would drop rules.

1. UPSTREAM VECTORS. Every case of workers-sdk's own parseRedirects.valid.test.ts and
   parseRedirects.invalid.test.ts at fc57bc0e, transcribed: same input, same rules, same invalid
   messages. A port that passes its own author's fixtures only is a second reading of the code.
2. THE DEFECT, REPRODUCED. One wildcard on line 1 followed by static rules: rule #100 loads, #101 is
   skipped with the rest of the file. That is what the live probes measured on 2026-10-28.
3. THE BRIEF'S MUTANTS, each killed here by name: a dynamic rule moved to line 1, 101 dynamic rules,
   static rules over the cap, and a probe that requests nothing (empty URL, no probes chosen, and a
   deploy step that no longer runs it).
4. THE LAYERS. The real source emit passes; a wildcard that shadows a later exact rule, a built page
   under a fallback wildcard and a fallback rule outside the Function's routes each fail.
5. THE PROBE, against a local server that implements both layers, and two that each drop one.
"""

from __future__ import annotations

import http.server
import io
import json
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import check_redirect_limits as crl  # noqa: E402

LOOP = ("Infinite loop detected in this rule and has been ignored. This will cause a redirect to strip "
        "`.html` or `/index` and end up triggering this rule again. Please fix or remove this rule to "
        "silence this warning.")


def rules_of(parsed):
    return [{"from": r.source, "to": r.to, "status": r.status, "lineNumber": r.line_number} for r in parsed.rules]


def R(frm, to, status, line):
    return {"from": frm, "to": to, "status": status, "lineNumber": line}


class UpstreamValidVectors(unittest.TestCase):
    """parseRedirects.valid.test.ts"""

    def check(self, text, rules, **kw):
        parsed = crl.parse_redirects(text, **kw)
        self.assertEqual(rules_of(parsed), rules)
        self.assertEqual(parsed.invalid, [])

    def test_single_blank_trim_comments_default(self):
        self.check("/a /b 301", [R("/a", "/b", 301, 1)])
        self.check("\n/a /b 301\n", [R("/a", "/b", 301, 2)])
        self.check("\n  /a /b 301\n", [R("/a", "/b", 301, 2)])
        self.check("\n  # This is a comment\n  /a /b 301\n  # And one here too.\n", [R("/a", "/b", 301, 3)])
        self.check("# This is just a comment", [])
        self.check("  # indented comment", [])
        self.check("\n# First comment\n# Second comment\n  # Indented comment\n/a /b 301\n# Comment after rule\n"
                   "# Another comment\n/c /d\n# Final comment\n", [R("/a", "/b", 301, 5), R("/c", "/d", 302, 8)])
        self.check("\n# This file has no redirects\n# Just comments\n  # Some indented\n# And more comments\n", [])
        self.check("\n  /a /b 302\n  /c /d\n", [R("/a", "/b", 302, 2), R("/c", "/d", 302, 3)])

    def test_querystrings_fragments_and_hosts(self):
        self.check("\n  /a /b?query=string 302\n  /c?this=rejected /d 301\n"
                   "  /ext https://some.domain:1234/route?q=string#anchor\n",
                   [R("/a", "/b?query=string", 302, 2), R("/c", "/d", 301, 3),
                    R("/ext", "https://some.domain:1234/route?q=string#anchor", 302, 4)])
        self.check("\n  /a /b#blah 302\n", [R("/a", "/b#blah", 302, 2)])
        self.check("\n  /a /b##blah-1 302\n", [R("/a", "/b##blah-1", 302, 2)])
        self.check("\n  /a https://example.com/b##blah-1 302\n", [R("/a", "https://example.com/b##blah-1", 302, 2)])
        self.check("\n\t/a /b 200\n", [R("/a", "/b", 200, 2)])
        self.check("\n\t/foo https://bar.com/index.html 302\n", [R("/foo", "https://bar.com/index.html", 302, 2)])
        self.check("\n\t/foo https://bar.com:123/index.html 302\n\t/cat https://cat.com:12345 302\n"
                   "\t/dog https://dog.com:12345\n\t",
                   [R("/foo", "https://bar.com:123/index.html", 302, 2), R("/cat", "https://cat.com:12345/", 302, 3),
                    R("/dog", "https://dog.com:12345/", 302, 4)])
        self.check("\n\t/* /foo 200\n", [R("/*", "/foo", 200, 2)])

    def test_inline_comments(self):
        self.check("/a /b 301 # redirect a to b", [R("/a", "/b", 301, 1)])
        self.check("/a /b # redirect with default status", [R("/a", "/b", 302, 1)])
        self.check("/a /b#section 301 # redirect to section", [R("/a", "/b#section", 301, 1)])
        self.check("/a /b 301 #no space comment", [R("/a", "/b", 301, 1)])
        self.check("\n    /a /b 301 # first rule\n    /c /d # second rule with default status\n"
                   "    # full line comment\n    /e /f 307 # third rule\n  ",
                   [R("/a", "/b", 301, 2), R("/c", "/d", 302, 3), R("/e", "/f", 307, 5)])
        self.check("/a https://x.com/b#c # comment", [R("/a", "https://x.com/b#c", 302, 1)])
        self.check("/a /b #", [R("/a", "/b", 302, 1)])
        self.check("/a /b##anchor # comment", [R("/a", "/b##anchor", 302, 1)])

    def test_custom_limits(self):
        aaa, bbb = "a" * 1001, "b" * 1001
        text = (f"\n    # Valid entry\n    /a /b\n    # Jumbo comment line OK, ignored as normal\n    {'#' * 1001}\n"
                f"    # Huge path names rejected\n    /{aaa} /{bbb} 301\n  ")
        self.check(text, [R("/a", "/b", 302, 3), R(f"/{aaa}", f"/{bbb}", 301, 7)], max_line_length=3000)
        dyn = "\n".join(f"/a/{i}/* /b/{i}/:splat" for i in range(150))
        sta = "\n".join(f"/a/{i} /b/{i}" for i in range(2050))
        for text, kw, n in [(f"\n  # c\n  {dyn}\n  # c\n", {"max_dynamic": 200}, 150),
                            (f"\n  # c\n  {sta}\n  # c\n", {"max_static": 3000}, 2050),
                            (f"\n  # c\n  {sta}\n    {dyn}\n  # c\n", {"max_dynamic": 200, "max_static": 3000}, 2200)]:
            parsed = crl.parse_redirects(text, **kw)
            self.assertEqual((len(parsed.rules), len(parsed.invalid)), (n, 0))


class UpstreamInvalidVectors(unittest.TestCase):
    """parseRedirects.invalid.test.ts"""

    def check(self, text, rules, invalid, **kw):
        parsed = crl.parse_redirects(text, **kw)
        self.assertEqual(rules_of(parsed), rules)
        self.assertEqual(parsed.invalid, invalid)

    def test_malformed_lines_status_duplicates_and_length(self):
        self.check("\n    # Single token\n    /c\n    # Four tokens\n    /d /e 302 !important\n  ", [],
                   [{"line": "/c", "lineNumber": 3, "message": "Expected exactly 2 or 3 whitespace-separated tokens. Got 1."},
                    {"line": "/d /e 302 !important", "lineNumber": 5,
                     "message": "Expected exactly 2 or 3 whitespace-separated tokens. Got 4."}])
        self.check("\n    # Valid token sails through\n    /a /b 301\n    # 418 NOT OK\n    /c /d 418\n  ",
                   [R("/a", "/b", 301, 3)],
                   [{"line": "/c /d 418", "lineNumber": 5,
                     "message": "Valid status codes are 200, 301, 302 (default), 303, 307, or 308. Got 418."}])
        self.check("\n    # Valid entry\n    /a /b\n    # Nonsensical but permitted (for now)\n    /b /a\n"
                   "    # Duplicate 'from'\n    /a /c\n  ", [R("/a", "/b", 302, 3), R("/b", "/a", 302, 5)],
                   [{"line": "/a /c", "lineNumber": 7, "message": "Ignoring duplicate rule for path /a."}])
        huge = f"/{'a' * 2000} /{'b' * 2000} 301"
        self.check(f"\n    # Valid entry\n    /a /b\n    # Jumbo comment line OK, ignored as normal\n    {'#' * 2001}\n"
                   f"    # Huge path names rejected\n    {huge}\n  ", [R("/a", "/b", 302, 3)],
                   [{"message": "Ignoring line 7 as it exceeds the maximum allowed length of 2000."}])

    def test_dynamic_and_static_caps(self):
        dyn = "\n".join(f"/a/{i}/* /b/{i}/:splat" for i in range(150))
        self.check(f"\n    # COMMENTS DON'T COUNT TOWARDS TOTAL VALID RULES\n    {dyn}\n"
                   "    # BUT DO GET COUNTED AS TOTAL LINES SKIPPED\n  ",
                   [R(f"/a/{i}/*", f"/b/{i}/:splat", 302, i + 3) for i in range(100)],
                   [{"message": "Maximum number of dynamic rules supported is 100. Skipping remaining 52 lines of file."}])
        sta = "\n".join(f"/a/{i} /b/{i}" for i in range(2050))
        self.check(f"\n    # c\n    {sta}\n    # c\n  ",
                   [R(f"/a/{i}", f"/b/{i}", 302, i + 3) for i in range(2000)],
                   [{"message": "Maximum number of static rules supported is 2000. Skipping line."}] * 50)
        dyn150 = "\n".join(f"/a/{i}/* /b/{i}/:splat" for i in range(150))
        self.check(f"\n    # c\n    {sta}\n      {dyn150}\n    # c\n  ",
                   [R(f"/a/{i}", f"/b/{i}", 302, i + 3) for i in range(2000)]
                   + [R(f"/a/{i}/*", f"/b/{i}/:splat", 302, i + 2053) for i in range(100)],
                   [{"message": "Maximum number of static rules supported is 2000. Skipping line."}] * 50
                   + [{"message": "Maximum number of dynamic rules supported is 100. Skipping remaining 52 lines of file."}])

    def test_malformed_urls(self):
        self.check("\n  # Spaces rejected on token length\n  /some page /somewhere else\n"
                   "  # OK with URL escaped encoding\n  /some%20page /somewhere%20else\n"
                   "  # Unescaped URLs are handled OK by Deno, so escape & pass them through\n"
                   "  /://so;`me /nons:/&@%+~{}ense\n"
                   "  # Absolute URLs aren't OK for 'from', but are fine for 'to'\n"
                   "  https://yeah.com https://nah.com\n  /nah https://yeah.com\n"
                   "  # This is actually parsed as /yeah.com, which we might want to detect but is ok for now\n"
                   "  yeah.com https://nah.com\n",
                   [R("/some%20page", "/somewhere%20else", 302, 5), R("/://so;%60me", "/nons:/&@%+~%7B%7Dense", 302, 7),
                    R("/nah", "https://yeah.com/", 302, 10), R("/yeah.com", "https://nah.com/", 302, 12)],
                   [{"line": "/some page /somewhere else", "lineNumber": 3,
                     "message": "Expected exactly 2 or 3 whitespace-separated tokens. Got 4."},
                    {"line": "https://yeah.com https://nah.com", "lineNumber": 9,
                     "message": "Only relative URLs are allowed. Skipping absolute URL https://yeah.com."}])

    def test_proxy_host_and_index_loops(self):
        self.check("\n\t/a https://example.com/b 200\n", [],
                   [{"line": "/a https://example.com/b 200", "lineNumber": 2,
                     "message": "Proxy (200) redirects can only point to relative paths. Got https://example.com/b"}])
        text = "\n/* /index.html 200\n/* /index 200\n/ /index.html\n/ /index\n"
        self.check(text, [], [{"line": line, "lineNumber": n, "message": LOOP}
                              for n, line in enumerate(text.strip().split("\n"), 2)])
        self.check(text, [R("/", "/index.html", 302, 4)],
                   [{"line": "/* /index.html 200", "lineNumber": 2, "message": LOOP},
                    {"line": "/* /index 200", "lineNumber": 3, "message": LOOP},
                    {"line": "/ /index", "lineNumber": 5, "message": "Ignoring duplicate rule for path /."}],
                   html_handling="none")


class TheDefect(unittest.TestCase):
    def test_a_wildcard_on_line_one_loads_100_rules_and_skips_the_rest(self):
        text = "/Training/* / 301\n" + "".join(f"/old-{n} /new-{n} 301\n" for n in range(1953))
        parsed = crl.parse_redirects(text)
        redirects = crl.construct(parsed)
        self.assertEqual((len(redirects.static), len(redirects.dynamic), parsed.skipped_lines), (0, 100, 1854))
        self.assertIsNotNone(redirects.resolve("/old-98"), "rule #100 loads")
        self.assertIsNone(redirects.resolve("/old-99"), "rule #101 is skipped with the rest of the file")
        failures, _, _ = crl.audit(text, "fixture")
        self.assertTrue(any(f.startswith("SKIPPED 1854") for f in failures), failures)
        self.assertEqual(crl.summary(parsed, redirects), "static 0/2000 · dynamic 100/100 · skipped 1854 · parsed 100 of 1954")

    def test_the_same_rules_statics_first_all_load(self):
        text = "".join(f"/old-{n} /new-{n} 301\n" for n in range(1953)) + "/Training/* / 301\n"
        failures, parsed, redirects = crl.audit(text, "fixture")
        self.assertEqual(failures, [])
        self.assertEqual(crl.summary(parsed, redirects), "static 1953/2000 · dynamic 1/100 · skipped 0 · parsed 1954 of 1954")


def source_emit() -> str:
    with tempfile.TemporaryDirectory(prefix="redirect-limits-test-") as tmp:
        return crl.emit_from_source(Path(tmp)).read_text()


class BriefMutants(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = source_emit()
        cls.lines = cls.text.splitlines()

    def test_control_the_real_emit_passes(self):
        failures, parsed, redirects = crl.audit(self.text, "emit")
        self.assertEqual(failures, [])
        self.assertGreater(len(redirects.static), 1000)
        print("[redirect-limits] control:", crl.summary(parsed, redirects))

    def test_mutant_a_dynamic_rule_moved_to_line_1(self):
        dynamic = next(line for line in self.lines if line.split()[0].endswith("/*"))
        mutant = "\n".join([dynamic] + [line for line in self.lines if line != dynamic]) + "\n"
        failures, parsed, _ = crl.audit(mutant, "mutant")
        self.assertTrue(any(f.startswith("DEMOTED") for f in failures), failures[:3])
        self.assertTrue(parsed.skipped_lines > 0, "every static rule behind it became dynamic")
        print(f"[redirect-limits] RED dynamic-rule-on-line-1: {len(failures)} failures, {parsed.skipped_lines} lines skipped")

    def test_mutant_101_dynamic_rules_and_the_headroom_floor(self):
        statics = [line for line in self.lines if "*" not in line.split()[0]]
        for count, red in [(101, True), (81, True), (80, False)]:
            mutant = "\n".join(statics + [f"/Gone-{n}/* /Positions/Mount 301" for n in range(count)]) + "\n"
            failures, _, _ = crl.audit(mutant, "mutant")
            self.assertEqual(bool(failures), red, (count, failures[:2]))
        print("[redirect-limits] RED 101 dynamic (limit) and 81 dynamic (headroom floor 20); 80 passes")

    def test_mutant_static_rules_over_the_cap(self):
        for count, red in [(2001, True), (2000, False)]:
            mutant = "".join(f"/old-{n} /new-{n} 301\n" for n in range(count))
            failures, parsed, _ = crl.audit(mutant, "mutant")
            self.assertEqual(bool(failures), red, (count, failures[:2]))
        print("[redirect-limits] RED 2001 static rules; 2000 pass")

    def test_emitter_refuses_to_write_an_unordered_file(self):
        import regenerate_redirects as rr
        original = rr.split_rules
        try:
            rr.split_rules = lambda rules: (rules, [])  # seeded mutant: no reordering, no fallback
            with tempfile.TemporaryDirectory() as tmp, redirect_stderr(io.StringIO()) as err, redirect_stdout(io.StringIO()):
                saved = rr.PUBLIC_DIR, rr.OUTPUT
                rr.PUBLIC_DIR = Path(tmp)
                rr.OUTPUT = rr.PUBLIC_DIR / "_redirects"
                try:
                    with self.assertRaises(SystemExit) as stop:
                        rr.main()
                finally:
                    rr.PUBLIC_DIR, rr.OUTPUT = saved
                self.assertEqual(stop.exception.code, 1)
                self.assertFalse((Path(tmp) / "_redirects").exists(), "nothing may be written")
                self.assertIn("Cloudflare would not load this _redirects", err.getvalue())
        finally:
            rr.split_rules = original
        print("[redirect-limits] RED emitter: an unordered _redirects is refused before it is written")


class PortRefusals(unittest.TestCase):
    """RDR-R2 (LOW): shapes the port cannot model exactly make the gate fail, never guess."""

    def test_dot_segments_that_climb_past_or_collapse_to_the_root_are_unported(self):
        for path in ("/..", "/a/..", "/a/../..", "/."):
            with self.subTest(path=path):
                parsed = crl.parse_redirects(f"{path} /x 301\n")
                self.assertEqual(parsed.rules, [])
                self.assertEqual(len(parsed.unported), 1, parsed.unported)
        self.assertEqual(crl.extract_pathname("/a/./b/../c"), "/a/c")

    def test_a_placeholder_value_with_a_js_replacement_pattern_is_unported(self):
        redirects = crl.construct(crl.parse_redirects("/a/* /b/:splat 301\n"))
        for value in ("$&", "$`", "$'", "x$$y"):
            with self.subTest(value=value), self.assertRaises(crl.UnportedURL):
                redirects.resolve("/a/" + value)
        self.assertEqual(redirects.resolve("/a/plain$x")[1], "/b/plain$x")

    def test_resolve_is_explicit_about_queries_and_absolute_targets(self):
        redirects = crl.construct(crl.parse_redirects(
            "/keep/* /dest 301\n/own/* /dest?k=1 301\n/ext/* https://example.com/z 301\n/extq/* https://example.com/z?k=1#h 302\n"))
        self.assertEqual(redirects.resolve("/keep/x", "?u=1")[1], "/dest?u=1")
        self.assertEqual(redirects.resolve("/own/x", "?u=1")[1], "/dest?k=1")
        self.assertEqual(redirects.resolve("/ext/x", "?u=1")[1], "https://example.com/z?u=1")
        self.assertEqual(redirects.resolve("/extq/x", "?u=1")[1], "https://example.com/z?k=1#h")

    def test_an_empty_redirects_file_fails_in_file_mode(self):
        for text in ("", "# only a comment\n\n"):
            with self.subTest(text=text), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "_redirects"
                path.write_text(text)
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()) as err:
                    code = crl.run(SimpleNamespace(source=False, file=path, public=None, probe=None,
                                                   probe_path=[], attempts=1, wait=0))
                self.assertEqual(code, 1)
                self.assertIn("parsed 0 rules", err.getvalue())


class Layers(unittest.TestCase):
    def setUp(self):
        self.routes = crl.Routes(["/Positions", "/Positions/*"], [], "fixture routes")
        self.assets = crl.Assets({"/Positions/Mount.html"}, "fixture assets")

    def layers(self, unified: list[str]):
        import regenerate_redirects as rr
        edge_lines, table = rr.split_rules(unified)
        _, _, edge = crl.audit("\n".join(edge_lines) + "\n", "edge")
        failures, parsed, fallback = crl.load_fallback(rr.fallback_json(table))
        self.assertEqual(failures, [])
        return crl.audit_layers(edge, parsed, fallback, self.assets, self.routes, unified, retired=[])

    def test_a_wildcard_that_shadows_a_later_exact_rule_is_a_difference(self):
        failures, counts = self.layers(["/Positions/Old/* /Positions/Mount 301",
                                        "/Positions/Old/Top /Positions/Other 301"])
        self.assertTrue(any(f.startswith("DIFFER /Positions/Old/Top") for f in failures), failures)
        self.assertGreater(counts["compared"], 0)

    def test_the_table_lists_exact_rules_first_so_an_entry_beats_its_family_wildcard(self):
        # The identity block's own order: the entry's exact rule, then the family's wildcard.
        failures, _ = self.layers(["/Positions/Fam/Entry /Positions/New-Entry 301",
                                   "/Positions/Fam/* /Positions/New-Fam 301"])
        self.assertEqual(failures, [])

    def test_mutant_a_rule_that_matches_a_live_page_is_a_shadow(self):
        failures, _ = self.layers(["/Positions/Gone/* /Positions/Other 301"])
        self.assertEqual(failures, [])
        self.assets.files.add("/Positions/Gone/Top.html")
        failures, counts = self.layers(["/Positions/Gone/* /Positions/Other 301"])
        self.assertTrue(any(f.startswith("SHADOW a category rule matches the built page /Positions/Gone/Top")
                            for f in failures), failures)
        self.assertEqual(counts["shadowed"], 1)
        failures, _ = self.layers(["/Positions/Mount /Positions/Other 301"])  # an exact rule on a live page
        self.assertTrue(any("built page /Positions/Mount (" in f for f in failures), failures)

    def test_no_page_to_inspect_is_not_a_clean_shadow_check(self):
        self.assets = crl.Assets({"/index.html"}, "no category pages")
        failures, _ = self.layers(["/Positions/Gone/* /Positions/Other 301"])
        self.assertTrue(any("nothing was checked" in f for f in failures), failures)

    def test_a_fallback_rule_outside_the_routes_fails(self):
        self.routes = crl.Routes(["/Transitions/*"], [], "fixture routes")
        failures, _ = self.layers(["/Positions/Old/* /Positions/Mount 301"])
        self.assertTrue(any("never sees" in f for f in failures), failures)

    def test_mutant_on_the_real_tree_a_pattern_over_a_live_page(self):
        import regenerate_redirects as rr
        unified = crl.unified_rules() + ["/Positions/Mount/* /Positions/Side-Control 301"]
        edge_lines, table = rr.split_rules(unified)
        _, _, edge = crl.audit("\n".join(edge_lines) + "\n", "edge")
        _, parsed, fallback = crl.load_fallback(rr.fallback_json(table))
        failures, counts = crl.audit_layers(edge, parsed, fallback, crl.Assets.from_content(), crl.Routes.from_source(),
                                            unified)
        shadows = [f for f in failures if f.startswith("SHADOW")]
        self.assertTrue(shadows, "the gate must fail on a pattern over live pages")
        offenders, _ = crl.shadowed_pages(fallback, crl.Assets.from_content())
        self.assertTrue(any(o.startswith("/Positions/Mount/Top (") for o in offenders), offenders[:3])
        self.assertEqual(counts["shadowed"], len(offenders))
        print(f"[redirect-limits] RED a pattern over live pages: {counts['shadowed']} of {counts['shadow_pages']} "
              f"category page URLs shadowed, e.g. {shadows[0]}")

    def test_the_real_source_emit_passes_and_counts(self):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = crl.run(SimpleNamespace(source=True, file=None, public=None, probe=None, probe_path=[],
                                           attempts=1, wait=0))
        self.assertEqual(code, 0, err.getvalue())
        self.assertRegex(out.getvalue(), r"skipped 0 · parsed (\d+) of \1")
        self.assertRegex(out.getvalue(), r"[1-9]\d* paths compared .* · 0 differ · retired ordinals (\d+) of \1 redirect")
        self.assertRegex(out.getvalue(), r"no shadowing: 0 of [1-9]\d* built category page URLs match any of the [1-9]\d* table rules")
        print("[redirect-limits]", out.getvalue().strip().replace("\n", " | "))


class _Server(http.server.ThreadingHTTPServer):
    daemon_threads = True


def serve(behaviour):
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            status, headers = behaviour(self.path)
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = _Server(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


class LiveProbe(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import regenerate_redirects as rr
        unified = crl.unified_rules()
        edge_lines, table = rr.split_rules(unified)
        _, _, cls.edge = crl.audit("\n".join(edge_lines) + "\n", "edge")
        _, _, cls.fallback = crl.load_fallback(rr.fallback_json(table))
        cls.assets = crl.Assets.from_content()

    def run_probe(self, behaviour, edge=None, extra=()):
        server = serve(behaviour)
        self.addCleanup(server.shutdown)
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = crl.probe(f"http://127.0.0.1:{server.server_port}", edge or self.edge, self.fallback,
                             list(extra), attempts=1, wait=0, assets=self.assets)
        return code, out.getvalue() + err.getvalue()

    def pages(self, path):
        """Pages as served now: the category table first (the middleware), then _redirects, then pages."""
        if path.startswith(crl.CATEGORY_PREFIXES):
            hit = self.fallback.resolve(path)
            if hit:
                return hit[0], {"Location": hit[1], crl.FALLBACK_HEADER: "fallback"}
        hit = self.edge.resolve(path)
        if hit:
            return hit[0], {"Location": hit[1]}
        return (200, {}) if self.assets.answers(path) else (404, {})

    def test_a_deployment_that_serves_both_layers_passes_every_probe(self):
        code, output = self.run_probe(self.pages)
        self.assertEqual(code, 0, output)
        for label in ("last static rule", "last dynamic rule", "alias rule", "last exact category rule",
                      "last category wildcard", "live category page no rule covers", "unknown category path"):
            self.assertIn(label, output)
        self.assertRegex(output, r"live probe: (\d+) of \1 probes answered")
        print("[redirect-limits] probe control:", output.strip().splitlines()[-1])

    def test_a_deployment_without_the_table_fails(self):
        # The middleware's table is gone: exact category rules still 301 from _redirects, without the
        # header, and the wildcards 404, as on the live sites before this change.
        code, output = self.run_probe(lambda p: (self.edge.resolve(p)[0], {"Location": self.edge.resolve(p)[1]})
                                      if self.edge.resolve(p) else ((200, {}) if self.assets.answers(p) else (404, {})))
        self.assertEqual(code, 1, output)
        self.assertIn("FAIL last category wildcard", output)

    def test_a_fallback_that_redirects_everything_fails(self):
        # Every positive probe passes on such a deployment; only the unknown path can see it.
        code, output = self.run_probe(lambda p: self.pages(p) if self.pages(p)[0] != 404
                                      else (301, {"Location": "/", crl.FALLBACK_HEADER: "fallback"}))
        self.assertEqual(code, 1, output)
        self.assertIn("FAIL unknown category path", output)
        print("[redirect-limits] RED a fallback that redirects every unknown path")

    def test_a_table_that_redirects_a_live_page_fails(self):
        code, output = self.run_probe(lambda p: self.pages(p) if self.pages(p)[0] != 200
                                      else (301, {"Location": "/", crl.FALLBACK_HEADER: "fallback"}))
        self.assertEqual(code, 1, output)
        self.assertIn("FAIL live category page no rule covers", output)
        print("[redirect-limits] RED a deployment that redirects a live category page")

    def test_a_fallback_redirect_that_does_not_say_so_fails(self):
        code, output = self.run_probe(lambda p: (self.pages(p)[0], {k: v for k, v in self.pages(p)[1].items()
                                                                   if k != crl.FALLBACK_HEADER}))
        self.assertEqual(code, 1, output)

    def test_mutant_a_probe_that_requests_nothing(self):
        original = crl.choose_probes
        try:
            crl.choose_probes = lambda *args, **kwargs: []  # seeded mutant
            code, output = self.run_probe(self.pages)
        finally:
            crl.choose_probes = original
        self.assertEqual(code, 1)
        self.assertIn("0 probes chosen", output)
        # `${{ steps.cf.outputs.deployment-url }}` renders as "" if the step id or output changes.
        # The tree itself is green here, so only the empty URL can turn this red.
        for url in ("", "   ", "dev.bjjgraph.pages.dev"):
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()) as err:
                code = crl.run(SimpleNamespace(source=True, file=None, public=None, probe=url,
                                               probe_path=[], attempts=1, wait=0))
            self.assertEqual(code, 1, f"--probe {url!r} must not pass by requesting nothing")
            self.assertIn("deployment URL", err.getvalue())
        print("[redirect-limits] RED probe that requests nothing: no probes chosen, and an empty URL")


PROBE_RUN = 'run: python3 scripts/check_redirect_limits.py --probe "${{ steps.cf.outputs.deployment-url }}"'


def wiring_failures(workflow: str, text: str) -> list[str]:
    """Why a deploy workflow's text does not probe its own deployment after deploying, or []."""
    import yaml
    jobs = yaml.safe_load(text)["jobs"]
    steps = (jobs.get("deploy") or jobs.get("deploy-preview"))["steps"]
    failures = []
    cf = next((i for i, s in enumerate(steps) if s.get("id") == "cf"), None)
    probes = [(i, s) for i, s in enumerate(steps) if "check_redirect_limits.py --probe" in (s.get("run") or "")]
    gates = [i for i, s in enumerate(steps) if "check_redirect_limits.py" in (s.get("run") or "")
             and "--probe" not in s["run"]]
    if cf is None:
        return [f"{workflow}: no deploy step with id cf"]
    if len(probes) != 1:
        return failures + [f"{workflow}: {len(probes)} probe steps, not exactly one"]
    index, step = probes[0]
    if index < cf:
        failures.append(f"{workflow}: the probe runs before the deploy")
    if "${{ steps.cf.outputs.deployment-url }}" not in step["run"]:
        failures.append(f"{workflow}: the probe does not request the deployment's own URL")
    if len(gates) != 1 or gates[0] > cf:
        failures.append(f"{workflow}: the built-tree gate must run once, before the deploy")
    if step.get("continue-on-error"):
        # Production: the site is live, so the verdict turns red in its own job.
        if step.get("id") not in json.dumps(jobs["deploy"].get("outputs", {})):
            failures.append(f"{workflow}: the probe's outcome is not a job output")
        if f"needs.deploy.outputs.{step.get('id')}" not in json.dumps(jobs.get("deployed-console", {})):
            failures.append(f"{workflow}: no verdict job reads the probe's outcome")
    return failures


class DeployWiring(unittest.TestCase):
    """The probe must actually run after both deploys, on the deployment's own URL."""

    def test_both_deploys_probe_the_deployment_after_deploying(self):
        for workflow in ("deploy.yaml", "deploy-dev.yaml"):
            with self.subTest(workflow=workflow):
                text = (ROOT / ".github/workflows" / workflow).read_text()
                self.assertEqual(text.count(PROBE_RUN), 1, f"{workflow}: the probe line the mutants below edit")
                self.assertEqual(wiring_failures(workflow, text), [])

    def test_mutants_of_the_real_workflows_are_red(self):
        # The same assertion as above, on the real YAML with one edit each (RDR-R2 INFO).
        for workflow in ("deploy.yaml", "deploy-dev.yaml"):
            text = (ROOT / ".github/workflows" / workflow).read_text()
            for name, mutant in [("runs nothing", text.replace(PROBE_RUN, 'run: "true"')),
                                 ("requests no URL", text.replace(PROBE_RUN, PROBE_RUN.replace(
                                     ' "${{ steps.cf.outputs.deployment-url }}"', ' ""')))]:
                with self.subTest(workflow=workflow, mutant=name):
                    self.assertNotEqual(mutant, text, "dead mutant anchor")
                    self.assertTrue(wiring_failures(workflow, mutant), f"{workflow}: a probe step that {name} passed")
        print("[redirect-limits] RED deploy probe step that runs nothing or requests no URL, in both workflows")


if __name__ == "__main__":
    unittest.main()
