#!/usr/bin/env python3
"""A listing's own outcome table, on the Python side (v1.214.0, origin coherence PR B1).

B1 is the MECHANISM with no table applied. These cases pin it on fixtures built from the real
corpus: one panel table (calibration/listing_tables.json) injected into graph.json in memory, as
regenerate_graph would emit it.

  - the emitter (`regenerate_graph._listing_table`): its fields, the fold, the rescale, and every
    error path, so a malformed table fails the run instead of dealing a fabricated exchange;
  - the seam (`solve_edge_values.listing_view` through `build_hand`): the dealt card is priced and
    expanded from the LISTING's table, and carries the technique it was priced with (`Action.tech`);
  - the kernel (`semantics/_kernel._priced`): it reads that technique, never the canonical re-read
    that was the silent join (OCPRB2);
  - byte-identity: on today's corpus every card's technique IS the canonical node.

MUTANTS (each turns this file red; measured at v1.214.0):
  - build_hand reading `graph[cat][...]` instead of `listing_view(...)`: test_the_card_is_the_listings;
  - `_priced` falling back to the canonical table: test_the_kernel_reads_the_priced_technique;
  - _listing_table without the rescale: test_the_emitter_folds_and_rescales;
  - _listing_table accepting a table without deal_here: test_the_emitter_refuses_a_malformed_table.
Run by tests/listing_tables_py.test.mjs, which `test:units` collects.
"""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "semantics"))

import regenerate_graph as rg  # noqa: E402
import solve_edge_values as sev  # noqa: E402
import _kernel  # noqa: E402

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

    def test_a_null_frame_table_is_refused(self):
        """OCPRB1-FG item 6: a gi-only table would be dealt in no-gi at its scalar rate, so the emitter
        refuses it until B2 decides the representation. The panel holds 10 such tables."""
        gi_only = [t for t in TABLES if t["result"]["success_rate"].get("nogi") is None]
        self.assertEqual(len(gi_only), 10, "the held gi-only tables (recount if the panel changes)")
        for t in gi_only:
            rg._reset_edge_stats()
            self.assertEqual(rg._listing_table(authored_listing(t), "fixture"), {}, t["key"])
            self.assertIn("null frame", rg._EDGE_STATS["own_table_errors"][0])

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

    def test_the_kernel_reads_the_priced_technique(self):
        g, edge = injected_graph(PICK)
        hand, *_ = sev.build_hand(g, PICK["listing"], sev.Opts(frame="nogi"))
        card = next(a for a in hand if a.name == PICK["move"])
        self.assertIs(_kernel._priced(card), card.tech)
        bare = sev.Action(card.name, card.target, card.cat, card.weight, card.p, card.succ, card.miss, card.empty_branch)
        with self.assertRaises(ValueError):
            _kernel._priced(bare)

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


if __name__ == "__main__":
    unittest.main()
