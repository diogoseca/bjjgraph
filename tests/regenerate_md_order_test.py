#!/usr/bin/env python3
"""The markdown generator's output does not depend on the order the filesystem lists files (B-07).

ci-validate's "Generated content matches its generator" step re-runs the generator in CI and fails on
any difference from the committed pages. On 2026-10-06 it went red on a correct commit: 7 Submissions
pages rendered differently in CI, because the wikilink resolver keeps the FIRST file found for a name,
a bare variant stem such as "from Mount" exists in several families, and Path.rglob lists files in
directory order, which the filesystem decides. These cases run the REAL resolver over the REAL corpus.

  - test_resolver_ignores_walk_order: the resolver built with every walk REVERSED answers every name
    exactly as the resolver built normally does;
  - test_an_ambiguous_bare_name_is_counted_and_resolves_to_the_sorted_first_path: "from Mount" answers
    to more than one page today; it is counted, and it links to the sorted-first family. If the corpus
    is ever disambiguated so that no such name remains, update this case rather than delete it.

MUTANTS (each turns this file red; measured 2026-10-06):
  - _sorted_walk returning list(root.rglob(...)) instead of sorted(...): test_resolver_ignores_walk_order;
  - the _AMBIGUOUS_NAMES bookkeeping removed: test_an_ambiguous_bare_name_is_counted_...;
  - the per-build reset removed (the tally accumulates across builds): test_the_ambiguity_count_is_the_same_...
Run by tests/regenerate_md_order_py.test.mjs, which `test:units` collects.
"""
import json
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
os.chdir(ROOT)  # the generator resolves content/ relative to the repo root

import regenerate_md_from_json as gen  # noqa: E402


def _build(reverse=False):
    """A fresh resolver, optionally with every Path.rglob/glob result reversed."""
    gen._AMBIGUOUS_NAMES.clear()
    if not reverse:
        return gen.build_wikilink_resolver(), dict(gen._AMBIGUOUS_NAMES)
    rg, g = pathlib.Path.rglob, pathlib.Path.glob
    pathlib.Path.rglob = lambda self, pat, *a, **k: iter(sorted(rg(self, pat, *a, **k), reverse=True))
    pathlib.Path.glob = lambda self, pat, *a, **k: iter(sorted(g(self, pat, *a, **k), reverse=True))
    try:
        return gen.build_wikilink_resolver(), dict(gen._AMBIGUOUS_NAMES)
    finally:
        pathlib.Path.rglob, pathlib.Path.glob = rg, g


def _names():
    """Every name a page may be referred to by: file stems, display names and aliases."""
    names = set()
    for path in sorted(pathlib.Path("content").rglob("*.json")):
        names.add(path.stem)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict):
            if isinstance(data.get("name"), str):
                names.add(data["name"])
            for alias in data.get("aliases") or []:
                if isinstance(alias, str):
                    names.add(alias)
    return sorted(names)


class WalkOrder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.names = _names()
        # kept in a dict: a function stored as a class attribute would bind as a method
        cls.r = {}
        cls.r["normal"], cls.normal_ambiguous = _build()
        cls.r["reversed"], cls.reversed_ambiguous = _build(reverse=True)

    def test_resolver_ignores_walk_order(self):
        # floor from measurement: 1,934 names from 1,692 JSON files on 2026-10-06
        self.assertGreater(len(self.names), 1500, "coverage floor: the corpus names were not read")
        differ = [n for n in self.names if self.r["normal"](n) != self.r["reversed"](n)]
        self.assertEqual(differ, [], f"{len(differ)} names resolve differently when the walk is reversed")
        self.assertEqual(self.normal_ambiguous, self.reversed_ambiguous)
        print(f"  {len(self.names)} names resolve identically under both walk orders")

    def test_the_ambiguity_count_is_the_same_however_many_times_the_resolver_is_built(self):
        # a full run builds the resolver once per category; the tally must not accumulate across builds
        gen._AMBIGUOUS_NAMES.clear()
        gen.build_wikilink_resolver()
        once = {k: list(v) for k, v in gen._AMBIGUOUS_NAMES.items()}
        gen.build_wikilink_resolver()
        self.assertEqual(once, dict(gen._AMBIGUOUS_NAMES), "a second build changed the ambiguity tally")
        self.assertEqual(len(once["from Side Control"]), len(set(once["from Side Control"])), "duplicate pages in one name's tally")

    def test_an_ambiguous_bare_name_is_counted_and_resolves_to_the_sorted_first_path(self):
        self.assertIn("from Mount", self.normal_ambiguous, "the bare stem 'from Mount' is no longer counted")
        pages = self.normal_ambiguous["from Mount"]
        self.assertGreaterEqual(len(pages), 2)
        self.assertEqual(self.r["normal"]("from Mount"), f"{min(pages)}/from Mount",
                         "an ambiguous name must link to its sorted-first page")
        print(f"  {len(self.normal_ambiguous)} ambiguous bare names counted; 'from Mount' answers to {len(pages)} pages")


if __name__ == "__main__":
    unittest.main()
