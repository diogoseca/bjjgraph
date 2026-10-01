#!/usr/bin/env python3
"""Redirect targets are Quartz's page paths, and every emitted target resolves (v1.212.7, OCREDIR1).

regenerate_redirects.py wrote targets with only the space rule, so 100% Sweep's rule pointed at
/Transitions/100%-Sweep, which is never built. Its raw-% source was also dead: Cloudflare's edge
answers it with 400. These cases pin the slug rule to path.ts, the emitter to that rule, and
scripts/check_redirect_targets.py to fail on every way a target can be missing.

MUTANTS (each turns this file red; measured at v1.212.7):
  - regenerate_redirects back on `p.replace(" ", "-")`: test_emitter_writes_page_paths;
  - a QUARTZ_SLUG_REPLACEMENTS row dropped (the "%" one): test_table_is_quartzs and
    test_page_path_matches_quartz_by_example;
  - `_page` answering "page" for anything: test_a_missing_target_fails_by_line;
  - the BAD_ESCAPE check removed: test_a_raw_percent_source_fails;
  - the empty-file floor removed: test_absence_is_not_a_pass.
Run by tests/redirect_targets_py.test.mjs, which `test:units` collects.
"""

from __future__ import annotations

import importlib
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import _slug  # noqa: E402
import check_redirect_targets as crt  # noqa: E402


def tree(files: dict[str, str]) -> Path:
    d = Path(tempfile.mkdtemp(prefix="redirects-"))
    for rel, text in files.items():
        p = d / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return d


class QuartzRule(unittest.TestCase):
    def test_table_is_quartzs(self):
        ts = (ROOT / "source/quartz/util/path.ts").read_text(encoding="utf-8")
        start = ts.index("function sluggify(")
        body = ts[start: ts.index("\n}\n", start)]
        quartz = re.findall(r'\.replace\(/((?:\\.|[^/])+)/g, "([^"]*)"\)', body)
        self.assertGreaterEqual(len(quartz), 5, f"read {len(quartz)} replacements from path.ts")
        self.assertEqual([tuple(p) for p in quartz], list(_slug.QUARTZ_SLUG_REPLACEMENTS),
                         "a drift here is a redirect to a page that is not built")

    def test_page_path_matches_quartz_by_example(self):
        self.assertEqual(_slug.quartz_page_path("Transitions/100% Sweep"), "Transitions/100-percent-Sweep")
        self.assertEqual(_slug.quartz_page_path("Positions/Fireman's Carry"), "Positions/Fireman's-Carry")
        # whitespace goes first, so "&" between spaces doubles the hyphens, exactly as Quartz does
        self.assertEqual(_slug.quartz_page_path("A & B?#/"), "A--and--B")


class Emitter(unittest.TestCase):
    def test_emitter_writes_page_paths(self):
        content = tree({"Transitions/100% Sweep.md": "x", "Transitions/100% Sweep.json": "{}",
                        "Transitions/100% Sweep/Attacker.md": "x", "Positions/Side Control.md": "x"})
        public = Path(tempfile.mkdtemp(prefix="redirects-public-"))
        rr = importlib.import_module("regenerate_redirects")
        saved = (rr.CONTENT_DIR, rr.PUBLIC_DIR, rr.OUTPUT, rr.AUTHORED_REDIRECTS)
        try:
            rr.CONTENT_DIR, rr.PUBLIC_DIR, rr.OUTPUT = content, public, public / "_redirects"
            rr.AUTHORED_REDIRECTS = content / "none"
            rr.main()
        finally:
            rr.CONTENT_DIR, rr.PUBLIC_DIR, rr.OUTPUT, rr.AUTHORED_REDIRECTS = saved
        rules = sorted((public / "_redirects").read_text().splitlines())
        self.assertEqual(rules, ["/positions/side-control /Positions/Side-Control 301",
                                 "/transitions/100-percent-sweep /Transitions/100-percent-Sweep 301"])

    def test_the_corpus_page_with_a_percent(self):
        rr = importlib.import_module("regenerate_redirects")
        f = ROOT / "content/Transitions/100% Sweep.json"
        self.assertTrue(f.exists(), "the corpus still has a page whose name carries %")
        self.assertEqual(rr.canonical_url_for(f), "/Transitions/100-percent-Sweep")


GOOD = {
    "index.html": "x", "Positions/Mount.html": "x", "Positions/Rubber-Guard/index.html": "x",
    "Positions/Rubber-Guard/Crackhead-Control.html": "x", "l.html": "x",
    "_redirects": "# a comment\n"
                  "/positions/mount /Positions/Mount 301\n"
                  "/Training / 301\n"
                  "/Positions/Crackhead-Control/* /Positions/Rubber-Guard/:splat 301\n"
                  "/l/* /l.html 200\n"
                  "/old /Positions/Rubber-Guard 301\n"
                  "/out https://example.org/ 301\n",
}


class Gate(unittest.TestCase):
    def test_a_built_tree_resolves_every_target_and_counts_them(self):
        failures, c = crt.check(tree(GOOD))
        self.assertEqual(failures, [])
        self.assertEqual((c["rules"], c["page"], c["file"], c["splat"], c["external"]), (6, 3, 1, 1, 1))

    def test_a_missing_target_fails_by_line(self):
        failures, _ = crt.check(tree({**GOOD, "_redirects": GOOD["_redirects"] + "/x /Transitions/100%-Sweep 301\n"}))
        self.assertEqual(len(failures), 1, failures)
        self.assertIn("line 8", failures[0])
        self.assertIn("/Transitions/100%-Sweep is not a built page", failures[0])

    def test_a_missing_placeholder_base_fails(self):
        failures, _ = crt.check(tree({**GOOD, "_redirects": "/a/* /Gone/:splat 301\n"}))
        self.assertEqual(len(failures), 1, failures)
        self.assertIn("base /Gone is not built", failures[0])

    def test_a_raw_percent_source_fails(self):
        failures, _ = crt.check(tree({**GOOD, "_redirects": "/transitions/100%-sweep /Positions/Mount 301\n"}))
        self.assertEqual(len(failures), 1, failures)
        self.assertIn("edge rejects with 400", failures[0])
        ok, _ = crt.check(tree({**GOOD, "_redirects": "/transitions/100%25-sweep /Positions/Mount 301\n"}))
        self.assertEqual(ok, [], "a valid escape is not a raw %")

    def test_absence_is_not_a_pass(self):
        self.assertIn("holds no rules", crt.check(tree({**GOOD, "_redirects": "# nothing\n"}))[0][0])
        missing = dict(GOOD); del missing["_redirects"]
        self.assertIn("is missing", crt.check(tree(missing))[0][0])
        self.assertIn("no built pages", crt.check(tree({"_redirects": GOOD["_redirects"]}))[0][0])
        self.assertIn("no built site", crt.check(Path(tempfile.mkdtemp()) / "absent")[0][0])

    def test_the_cli_prints_a_positive_count_and_exits_by_verdict(self):
        good = subprocess.run([sys.executable, "-B", str(ROOT / "scripts/check_redirect_targets.py"), "--public", str(tree(GOOD))],
                              capture_output=True, text=True)
        self.assertEqual(good.returncode, 0, good.stdout + good.stderr)
        self.assertIn("5 of 5 checked targets resolve", good.stdout)
        bad = subprocess.run([sys.executable, "-B", str(ROOT / "scripts/check_redirect_targets.py"),
                              "--public", str(tree({**GOOD, "_redirects": "/x /Nope 301\n"}))], capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)
        self.assertIn("FAIL line 1", bad.stderr)


if __name__ == "__main__":
    unittest.main()
