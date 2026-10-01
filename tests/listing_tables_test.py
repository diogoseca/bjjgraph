#!/usr/bin/env python3
"""A listing's own outcome table, on the Python side (v1.214.0, origin coherence PR B1).

B1 is the MECHANISM with no table applied. These cases pin it on fixtures built from the real
corpus: one panel table (calibration/listing_tables.json) injected into graph.json in memory, as
regenerate_graph would emit it.

  - the emitter (`regenerate_graph._listing_table`): its fields, the fold, the rescale, and every
    error path, so a malformed table fails the run instead of dealing a fabricated exchange;
  - the seam (`solve_edge_values.listing_view` through `build_hand`): the dealt card is priced and
    expanded from the LISTING's table, and carries the technique it was priced with (`Action.tech`);
  - `solve_edge_values.priced_tech`, which semantics/_kernel.py and app_game.py read (as `_priced`)
    instead of the canonical re-read that was the silent join (OCPRB2): the helper, and a source
    tripwire that neither file re-reads `graph[a.cat][a.target + "/attacker"]` again;
  - byte-identity: on today's corpus every card's technique IS the canonical node.

MUTANTS (each turns this file red; measured at v1.214.0):
  - build_hand reading `graph[cat][...]` instead of `listing_view(...)`: test_the_card_is_the_listings;
  - `priced_tech` falling back to the canonical table: test_a_card_reads_its_priced_technique;
  - the canonical re-read restored in _kernel.py: test_no_reader_re_reads_the_canonical_table;
  - _listing_table without the rescale: test_the_emitter_folds_and_rescales;
  - _listing_table accepting a table without deal_here: test_the_emitter_refuses_a_malformed_table;
  - listing_absences ignoring the frame mask: test_a_move_the_frame_masks_is_not_repeated (v1.215.0);
  - listing_absences ignoring the dealing rule: test_a_listing_that_does_not_deal_is_not_named;
  - check_absence_hands accepting a relaxed hand: test_an_absence_may_not_empty_its_main_pass.
Run by tests/listing_tables_py.test.mjs, which `test:units` collects.
"""

from __future__ import annotations

import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "semantics"))

import regenerate_graph as rg  # noqa: E402
import solve_edge_values as sev  # noqa: E402
# NOT semantics/_kernel: it needs numpy, which the validate job does not install. Its use of the
# priced technique is pinned below by reading its source, and run for real by `_kernel --selfcheck`.

GRAPH = json.loads((ROOT / "graph.json").read_text(encoding="utf-8"))
TABLES = json.loads((ROOT / "calibration" / "listing_tables.json").read_text(encoding="utf-8"))["tables"]
# a table whose listing exists in both frames (the gi-only ones carry a null no-gi rate)
PICK = next(t for t in TABLES if t["result"]["success_rate"].get("nogi") is not None)
# ...and a variant whose authored rate sits 6 points off its success cells, so the rescale is not a
# no-op. On the real 107 tables the pooled cells equal the no-gi rate already (the gi rate is what
# differs), so a real-table fixture cannot see the rescale at all: its mutant survived (measured).
RESCALE = copy.deepcopy(PICK)
_cells = sum(o["nogi"] for o in RESCALE["result"]["outcomes"] if o["result"] == "success")
RESCALE["result"]["success_rate"] = {"gi": _cells + 6, "nogi": _cells + 6}


def authored_listing(table):
    """The panel table as a position listing would author it (the shape B2 writes)."""
    return {"transition": table["move"], "attempt_probability": table["share_here"], "deal_here": True,
            "success_rate": table["result"]["success_rate"],
            "outcomes": [{"to": o["to"], "probability": {"gi": o["gi"], "nogi": o["nogi"]}, "result": o["result"]}
                         for o in table["result"]["outcomes"]]}


def injected_graph(table):
    """graph.json with ONE listing carrying its own table, emitted by the real _listing_table."""
    g = copy.deepcopy(GRAPH)
    rg._reset_edge_stats()
    edge_fields = rg._listing_table(authored_listing(table), "fixture")
    assert edge_fields, rg._EDGE_STATS["own_table_errors"]
    hits = [t for t in g["positions"][table["listing"]]["transitions"] if t["technique"] == table["move"]]
    assert len(hits) == 1, f"{table['key']}: the listing is authored once"
    hits[0].update(edge_fields)
    hits[0]["dealHere"] = True
    return g, hits[0]


class Emitter(unittest.TestCase):
    def test_the_emitter_folds_and_rescales(self):
        rg._reset_edge_stats()
        e = rg._listing_table(authored_listing(RESCALE), "fixture")
        self.assertTrue(e["ownTable"])
        self.assertEqual(e["successRate"], round(RESCALE["result"]["success_rate"]["nogi"], 1))
        self.assertEqual(sum(o["probability"] for o in e["outcomes"]), 100)
        before = sum(o["nogi"] for o in RESCALE["result"]["outcomes"] if o["result"] == "success")
        succ = sum(o["probability"] for o in e["outcomes"] if o["result"] == "success")
        self.assertNotEqual(before, int(round(e["successRate"])), "the fixture needs a rescale to happen")
        self.assertEqual(succ, int(round(e["successRate"])), "the table is rescaled to the listing's rate")
        self.assertEqual([o["to"] for o in e["outcomes"]], [o["to"] for o in RESCALE["result"]["outcomes"]])

    def test_a_gi_only_table_is_accepted_where_the_listing_is_absent(self):
        """v1.215.0: a null frame is accepted exactly where the listing does not exist (its attempt is
        null there too), and the wire then names it in `absentAt`. The panel holds 10 such tables."""
        gi_only = [t for t in TABLES if t["result"]["success_rate"].get("nogi") is None]
        self.assertEqual(len(gi_only), 10, "the held gi-only tables (recount if the panel changes)")
        for t in gi_only:
            d = authored_listing(t)
            d["attempt_probability"] = {"gi": t["share_here"]["gi"], "nogi": None}
            rg._reset_edge_stats()
            e = rg._listing_table(d, "fixture")
            self.assertTrue(e, (t["key"], rg._EDGE_STATS["own_table_errors"]))
            self.assertIsNone(e["successRate"], "the no-gi headline stays null, never a fabricated rate")
            succ = sum(o["probability"] for o in e["outcomes"] if o["result"] == "success")
            self.assertEqual(succ, int(round(e["successRateByRuleset"]["gi"])), "rescaled to the frame it exists in")

    def test_a_null_where_the_listing_exists_is_refused(self):
        gi_only = next(t for t in TABLES if t["result"]["success_rate"].get("nogi") is None)
        for label, attempt in (("attempt present in no-gi", {"gi": 5, "nogi": 5}), ("attempt scalar", 5)):
            d = authored_listing(gi_only)
            d["attempt_probability"] = attempt
            rg._reset_edge_stats()
            self.assertEqual(rg._listing_table(d, "fixture"), {}, label)
            self.assertIn("listing exists", rg._EDGE_STATS["own_table_errors"][0], label)
        d = authored_listing(PICK)                        # both frames present, rate nulled in one
        d["success_rate"] = {"gi": PICK["result"]["success_rate"]["gi"], "nogi": None}
        rg._reset_edge_stats()
        self.assertEqual(rg._listing_table(d, "fixture"), {})
        self.assertIn("exactly in the frames", rg._EDGE_STATS["own_table_errors"][0])

    def test_the_emitter_refuses_a_malformed_table(self):
        for label, mutate in (
            ("no deal_here", lambda d: d.pop("deal_here")),
            ("no rate", lambda d: d.pop("success_rate")),
            ("divergent cells", lambda d: d["outcomes"][0].update(probability={"gi": 10, "nogi": 11})),
            ("not 100", lambda d: d["outcomes"][0].update(probability={"gi": 1, "nogi": 1})),
        ):
            d = authored_listing(PICK)
            mutate(d)
            rg._reset_edge_stats()
            self.assertEqual(rg._listing_table(d, "fixture"), {}, label)
            self.assertEqual(len(rg._EDGE_STATS["own_table_errors"]), 1, label)


class Seam(unittest.TestCase):
    def test_the_card_is_the_listings(self):
        g, edge = injected_graph(PICK)
        hand, _relaxed, _absent, _fa = sev.build_hand(g, PICK["listing"], sev.Opts(frame="nogi"))
        card = next(a for a in hand if a.name == PICK["move"])
        self.assertAlmostEqual(card.p, edge["successRate"] / 100.0)
        self.assertIs(card.tech["outcomes"], edge["outcomes"], "priced and expanded from the listing's table")
        canon = g["transitions"][edge["target"] + "/attacker"]
        self.assertNotEqual(card.tech["outcomes"], canon["outcomes"], "the fixture is a real difference")
        # the miss now lands on the listing (every panel table returns a miss there)
        self.assertTrue(any(oc[1] == PICK["listing"] for _w, oc in card.miss))

    def test_a_card_reads_its_priced_technique(self):
        g, edge = injected_graph(PICK)
        hand, *_ = sev.build_hand(g, PICK["listing"], sev.Opts(frame="nogi"))
        card = next(a for a in hand if a.name == PICK["move"])
        self.assertIs(sev.priced_tech(card), card.tech)
        bare = sev.Action(card.name, card.target, card.cat, card.weight, card.p, card.succ, card.miss, card.empty_branch)
        with self.assertRaises(ValueError):
            sev.priced_tech(bare)

    def test_no_reader_re_reads_the_canonical_table(self):
        canonical_reread = re.compile(r"\[a\.cat\]\s*\[\s*a\.target\s*\+\s*[\"']/attacker[\"']\s*\]|tech_of\(\s*self\.g\s*,\s*\(a\.cat")
        for f, uses in (("scripts/semantics/_kernel.py", 2), ("scripts/semantics/app_game.py", 1)):
            src = (ROOT / f).read_text(encoding="utf-8")
            code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
            self.assertEqual(canonical_reread.findall(code), [], f"{f} re-reads the canonical table for a card")
            self.assertGreaterEqual(code.count("_priced(a)"), uses, f"{f} reads the card's priced technique")

    def test_today_every_card_is_the_canonical_node(self):
        """B1's byte-identity, at the seam: no listing on the corpus carries a table yet."""
        cards = same = 0
        for key, node in GRAPH["positions"].items():
            if node.get("role") not in ("top", "bottom"):
                continue
            for fr in ("gi", "nogi"):
                hand, *_ = sev.build_hand(GRAPH, key, sev.Opts(frame=fr))
                for a in hand:
                    cards += 1
                    same += a.tech is GRAPH[a.cat][a.target + "/attacker"]
        self.assertGreater(cards, 2000, "the walk dealt the corpus")
        self.assertEqual(same, cards)



class Absence(unittest.TestCase):
    """regenerate_neural_data.listing_absences (v1.215.0): the listings a dealer would deal although
    their attempt is null in the frame, for a move the frame's mask still admits."""

    @classmethod
    def setUpClass(cls):
        import regenerate_neural_data as rnd
        cls.rnd = rnd
        walk = {fr: rnd.frame_reachable(GRAPH, fr) for fr in ("gi", "nogi")}
        cls.reach = {fr: (walk[fr] if fr in rnd.EXCLUDING_FRAMES else
                          {"positions": set(GRAPH["positions"]),
                           "techniques": {v["hub"] for sec in ("transitions", "submissions")
                                          for v in GRAPH[sec].values() if v.get("hub")}}) for fr in ("gi", "nogi")}

    def test_today_there_is_none(self):
        self.assertEqual(self.rnd.listing_absences(GRAPH, self.reach), {}, "B1.5 ships byte-identical")

    def test_a_dealt_listing_nulled_in_a_frame_is_named(self):
        g = copy.deepcopy(GRAPH)
        pk, t = next((pk, t) for pk, p in g["positions"].items() for t in p.get("transitions") or [] if t.get("dealHere"))
        t["attemptProbabilityByRuleset"]["nogi"] = None
        self.assertEqual(self.rnd.listing_absences(g, self.reach), {t["target"]: {"nogi": [g["positions"][pk]["hub"]]}})

    def test_a_listing_that_does_not_deal_is_not_named(self):
        g = copy.deepcopy(GRAPH)
        tech = {k[:-9]: v for sec in ("transitions", "submissions") for k, v in g[sec].items() if k.endswith("/attacker")}
        pk, t = next((pk, t) for pk, p in g["positions"].items() for t in p.get("transitions") or []
                     if not t.get("dealHere") and tech.get(t["target"], {}).get("fromPositionId") not in (None, p.get("hub")))
        t["attemptProbabilityByRuleset"]["nogi"] = None
        self.assertEqual(self.rnd.listing_absences(g, self.reach), {}, f"{pk} -> {t['technique']} is dealt nowhere here")

    def test_a_move_the_frame_masks_is_not_repeated(self):
        g = copy.deepcopy(GRAPH)
        pk, t = next((pk, t) for pk, p in g["positions"].items() for t in p.get("transitions") or [] if t.get("dealHere"))
        t["attemptProbabilityByRuleset"]["nogi"] = None
        reach = {fr: {"positions": r["positions"], "techniques": set(r["techniques"]) - {t["target"]}} for fr, r in self.reach.items()}
        self.assertEqual(self.rnd.listing_absences(g, reach), {}, "cal.avail already masks a move absent from the frame")


    def test_an_absence_may_not_empty_its_main_pass(self):
        """check_absence_hands (OCABS1 item 2): an absence that leaves its listing no main-pass card
        would hand the state to the origin-relaxed fallback, which ignores absentAt."""
        def one_and_many():
            single = many = None
            for key, p in GRAPH["positions"].items():
                if p.get("role") not in ("top", "bottom"):
                    continue
                hand, relaxed = sev.build_hand(GRAPH, key, sev.Opts(frame="nogi"))[:2]
                if relaxed:
                    continue
                if len(hand) == 1 and single is None:
                    single = (key, hand[0])
                if len(hand) >= 3 and many is None:
                    many = (key, hand[0])
                if single and many:
                    return single, many
            return single, many
        single, many = one_and_many()
        self.assertTrue(single and many, "the corpus has a one-card and a many-card main pass")
        for (key, card), want in ((single, 1), (many, 0)):
            g = copy.deepcopy(GRAPH)
            edge = next(t for t in g["positions"][key]["transitions"] if t["target"] == card.target)
            edge["attemptProbabilityByRuleset"]["nogi"] = None
            ab = self.rnd.listing_absences(g, self.reach)
            checked, bad = self.rnd.check_absence_hands(g, ab)
            self.assertGreaterEqual(checked, 1, key)
            self.assertEqual(len(bad), want, f"{key}: {bad}")


if __name__ == "__main__":
    unittest.main()
