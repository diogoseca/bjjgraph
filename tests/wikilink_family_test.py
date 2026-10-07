#!/usr/bin/env python3
"""A bare wikilink resolves inside the linking page's OWN family first, and what family cannot decide
is counted and ratcheted (B07-RED1, v1.224.0).

A bare variant stem such as "from Gift Wrap" answers to a page in every family that has that variant
(Gift Wrap Armbar, Kimura, Rear Naked Choke, Short Choke). The context-free resolver links the
sorted-first one (B-07), which is right for at most one family: under it, Rear Naked Choke's own
variants linked Gift Wrap Armbar's "from Gift Wrap". These cases run the REAL resolver over the REAL
corpus, and derive the candidate families from the FILESYSTEM, not from the resolver's own index, so a
wrong index cannot agree with itself (CLAUDE.md 6.3).

  - test_every_page_in_a_family_links_that_familys_own_variant: for EVERY bare stem more than one page
    answers to, and every family folder holding one of them, a sibling page in that folder (and the
    family's hub, when there is one) links the family's own page, never another family's;
  - test_rear_naked_chokes_gift_wrap_is_its_own: the case that was reported, by name;
  - test_a_name_no_family_can_decide_falls_back_and_is_counted: a page outside every candidate family
    gets the context-free (sorted-first) target, and the pair is COUNTED as cross-family;
  - test_an_unambiguous_name_is_counted_nowhere: the tallies hold only ambiguous names;
  - the ratchet (_check_ambiguity_baseline): a NEW name fails any run; a cleared name fails a full run
    only; a missing baseline fails; the baseline in the tree is well-formed and non-trivial;
  - test_accepting_needs_the_whole_corpus_and_a_reason: --accept-ambiguity is refused on --file and
    without --reason.

MUTANTS (each turns this file red; measured 2026-10-07):
  - `if family in prefixes:` -> `if False:` (no family preference): test_every_page_..., test_rear_...;
  - _page_family returning parts[:-1] for every page (the hub is not in its own family):
    test_every_page_... (the hub half), test_rear_...;
  - the _CROSS_FAMILY.setdefault(...) bookkeeping removed: test_a_name_no_family_can_decide_...;
  - the NEW-name loop in _check_ambiguity_baseline removed: test_a_new_name_fails_any_run;
  - the `if full_run:` cleared-name loop removed: test_a_cleared_name_fails_a_full_run_only;
  - `if full_run:` -> `if True:` (a --file run judges names it cannot see): the same case;
  - the --accept-ambiguity parser guard removed: test_accepting_needs_the_whole_corpus_and_a_reason.
Run by tests/wikilink_family_py.test.mjs, which `test:units` collects.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
os.chdir(ROOT)  # the generator resolves content/ relative to the repo root

import regenerate_md_from_json as gen  # noqa: E402

RNC = pathlib.Path("content/Submissions/Rear Naked Choke")


def _filesystem_candidates():
    """stem -> sorted folder prefixes ('Submissions/Kimura', 'Positions') holding a <stem>.json, read
    straight off the disk over the generator's own category folders."""
    out = {}
    for folder in gen.CATEGORIES.values():
        for path in sorted(pathlib.Path(folder).rglob("*.json")):
            out.setdefault(path.stem, set()).add(str(path.parent.relative_to("content")))
    return {stem: sorted(p) for stem, p in out.items() if len(p) > 1}


class FamilyFirst(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = {"resolve": gen.build_wikilink_resolver()}
        cls.ambiguous = _filesystem_candidates()

    def setUp(self):
        gen._reset_family_stats()

    def bound(self, page):
        return self.r["resolve"].for_page(pathlib.Path(page))

    def test_every_page_in_a_family_links_that_familys_own_variant(self):
        checked, hubs, wrong = 0, 0, []
        for stem, prefixes in self.ambiguous.items():
            for prefix in prefixes:
                folder = pathlib.Path("content") / prefix
                if prefix.count("/") < 1:
                    continue  # a category root ('Positions') is no family
                linkers = [p for p in sorted(folder.glob("*.json")) if p.stem != stem][:1]
                hub = folder.with_suffix(".json")
                if hub.exists():
                    linkers.append(hub)
                    hubs += 1
                for page in linkers:
                    got = self.bound(page)(stem)
                    checked += 1
                    if got != f"{prefix}/{stem}":
                        wrong.append(f"{page} -> {stem!r} linked {got!r}, not {prefix}/{stem}")
        # floors from measurement, 2026-10-07: 77 ambiguous stems; 455 family links checked, 241 of them from hubs
        self.assertGreater(len(self.ambiguous), 50, "coverage floor: the ambiguous stems were not found")
        self.assertGreater(checked, 350, "coverage floor: too few family pages were checked")
        self.assertGreater(hubs, 180, "coverage floor: too few family hubs were checked")
        self.assertEqual(wrong, [], f"{len(wrong)} of {checked} family links left the family:\n" + "\n".join(wrong[:10]))
        print(f"  {checked} family links checked ({hubs} from hubs) over {len(self.ambiguous)} ambiguous stems")

    def test_rear_naked_chokes_gift_wrap_is_its_own(self):
        self.assertIn("from Gift Wrap", self.ambiguous)
        self.assertNotEqual(self.r["resolve"]("from Gift Wrap"), "Submissions/Rear Naked Choke/from Gift Wrap",
                            "the context-free pick is RNC's own: this case no longer proves anything")
        for page in (RNC / "from Rodeo.json", RNC / "from Mounted Crucifix.json", RNC.with_suffix(".json")):
            self.assertEqual(self.bound(page)("from Gift Wrap"), "Submissions/Rear Naked Choke/from Gift Wrap", str(page))
            self.assertEqual(self.bound(page)({"name": "from Gift Wrap"}),
                             "Submissions/Rear Naked Choke/from Gift Wrap", f"{page}, a related_submissions object")
        self.assertIn(("Submissions/Rear Naked Choke/from Rodeo.json", "from Gift Wrap"), gen._FAMILY_RESOLVED)

    def test_a_name_no_family_can_decide_falls_back_and_is_counted(self):
        page = pathlib.Path("content/Positions/Mount.json")
        self.assertTrue(page.exists())
        got = self.bound(page)("from Gift Wrap")
        self.assertEqual(got, self.r["resolve"]("from Gift Wrap"), "the fallback must be the context-free target")
        self.assertEqual(gen._CROSS_FAMILY.get("from Gift Wrap"), {"Positions/Mount.json"})
        self.assertEqual(gen._FAMILY_RESOLVED, set())

    def test_an_unambiguous_name_is_counted_nowhere(self):
        self.assertNotIn("Mount", self.ambiguous)
        self.bound(RNC / "from Rodeo.json")("Mount")
        self.assertEqual((gen._CROSS_FAMILY, gen._FAMILY_RESOLVED), ({}, set()))


class Ratchet(unittest.TestCase):
    def setUp(self):
        gen._reset_family_stats()
        self.saved = gen._AMBIGUITY_BASELINE
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR"))
        gen._AMBIGUITY_BASELINE = pathlib.Path(self.tmp.name) / "baseline.json"

    def tearDown(self):
        gen._AMBIGUITY_BASELINE = self.saved
        gen._reset_family_stats()
        self.tmp.cleanup()

    def baseline(self, *names):
        gen._AMBIGUITY_BASELINE.write_text(json.dumps({"names": {n: {"pages": 1} for n in names}}))

    def test_a_new_name_fails_any_run(self):
        self.baseline("Gift Wrap")
        gen._CROSS_FAMILY.update({"Gift Wrap": {"a.json"}, "Brand New": {"b.json"}})
        for full in (False, True):
            failures = gen._check_ambiguity_baseline(full_run=full)
            self.assertEqual([f[0] for f in failures], ["<wikilink ambiguity: 'Brand New'>"], f"full_run={full}")
            self.assertIn("b.json", failures[0][1])

    def test_a_cleared_name_fails_a_full_run_only(self):
        self.baseline("Gift Wrap", "Gone")
        gen._CROSS_FAMILY.update({"Gift Wrap": {"a.json"}})
        self.assertEqual(gen._check_ambiguity_baseline(full_run=False), [], "a partial run judged a name it cannot see")
        failures = gen._check_ambiguity_baseline(full_run=True)
        self.assertEqual([f[0] for f in failures], ["<wikilink ambiguity: 'Gone'>"])

    def test_a_missing_baseline_fails(self):
        self.assertEqual(len(gen._check_ambiguity_baseline(full_run=False)), 1)

    def test_the_committed_baseline_is_well_formed(self):
        doc = json.loads(self.saved.read_text(encoding="utf-8"))
        names = doc["names"]
        self.assertEqual(doc["_meta"]["names"], len(names))
        self.assertEqual(doc["_meta"]["page_links"], sum(v["pages"] for v in names.values()))
        self.assertTrue(doc["_meta"]["reason"].strip())
        # every baselined name really is ambiguous on disk: a stale row is caught here too, cheaply
        stale = sorted(set(names) - set(_filesystem_candidates()))
        self.assertEqual(stale, [], "baselined names no page shares any more")
        self.assertGreater(len(names), 0)


class AcceptGuard(unittest.TestCase):
    def test_accepting_needs_the_whole_corpus_and_a_reason(self):
        script = str(ROOT / "scripts" / "regenerate_md_from_json.py")
        for argv in (["--file", "content/Positions/Mount.json", "--accept-ambiguity", "--reason", "x"],
                     ["--all", "--accept-ambiguity"],
                     ["--category", "Positions", "--all", "--accept-ambiguity", "--reason", "x"]):
            run = subprocess.run([sys.executable, "-B", script, "--dry-run", *argv], capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(run.returncode, 2, f"{argv} was not refused:\n{run.stdout[-400:]}{run.stderr[-400:]}")
            self.assertIn("--accept-ambiguity needs", run.stderr)


if __name__ == "__main__":
    unittest.main()
