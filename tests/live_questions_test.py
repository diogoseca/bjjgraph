"""The live-question emitter (scripts/regenerate_neural_data.py, v1.273.0), on a synthetic emit.

A question repeated inside ONE deck fills two slots of one deck, so the manifest's `shared` lists it with that one deck; the app
ignores a one-deck entry, so the live files must keep the question, or it would be in neither and its row would read as retired
(LIVE2 F2).

A REWORDING MOVES THE LIVE FILES AND THE STAMP, NEVER THE DECK MANIFEST (LIVE3). The study bundles pin
`flashcards/_index.json` byte for byte (neural/build/study-bundles.mjs embeds its sha256), so the live files' fingerprint
rides curriculum.json (`ratingLive`): two emits that differ only in one unshared card's wording give a byte-identical
manifest, live files that differ, and a curriculum.json that differs by the stamp alone. Run: python3 -B
tests/live_questions_test.py -v (collected by tests/live_questions_py.test.mjs)."""
import base64, copy, hashlib, json, sys, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import regenerate_neural_data as R
from _neural_content import fnv1a32

# the two decks' graph nodes, so the real ordinal encoder runs (a position's title carries its " Top" seat suffix)
NODES = [{"t": "A Top", "ty": "positions", "o": 0}, {"t": "B Top", "ty": "positions", "o": 1}]
DECKS = {
    "A|Top": {"cat": "Position", "role": "Top", "cards": [{"q": "repeated in A", "a": "1"}, {"q": "repeated in A", "a": "2"}, {"q": "in A and B", "a": "3"}]},
    "B|Top": {"cat": "Position", "role": "Top", "cards": [{"q": "in A and B", "a": "4"}, {"q": "only in B", "a": "5"}]},
}


def decoded(live):
    out = {}
    keys = sorted(DECKS)
    for body in live["bodies"]:
        f = json.loads(body); n = base64.b64decode(f["n"]); q = base64.b64decode(f["q"]); at = 0
        for i, c in enumerate(n):
            out[keys[f["from"] + i]] = [q[at + 2 * j] | (q[at + 2 * j + 1] << 8) for j in range(c)]; at += 2 * c
    return out


class LiveQuestions(unittest.TestCase):
    def test_a_question_repeated_in_one_deck_stays_in_the_live_files(self):
        shared = R._shared_index(DECKS)
        self.assertEqual(shared[fnv1a32("repeated in A")], [0], "the manifest lists it with its one deck")
        self.assertEqual(shared[fnv1a32("in A and B")], [0, 1])
        app = R._shared_the_apps_way(shared)
        self.assertEqual(app, {fnv1a32("in A and B")}, "the app's rule: two or more distinct decks")
        got = decoded(R._live_question_bodies(DECKS, app))
        k = int(fnv1a32("repeated in A"), 16) & 0xFFFF
        self.assertEqual(got["A|Top"], [k, k], "both of A's copies are live cards")
        self.assertEqual(got["B|Top"], [int(fnv1a32("only in B"), 16) & 0xFFFF], "the shared question is left to the index")

    def test_the_data_fingerprint_is_over_the_files_in_order(self):
        live = R._live_question_bodies(DECKS, R._shared_the_apps_way(R._shared_index(DECKS)))
        files = [json.loads(b) for b in live["bodies"]]
        self.assertEqual(live["fp"], fnv1a32("|".join(f["n"] + "|" + f["q"] for f in files)))
        self.assertGreaterEqual(len(files), 2)


    def test_a_rewording_moves_the_live_files_and_the_stamp_never_the_manifest(self):
        reworded = copy.deepcopy(DECKS)
        reworded["B|Top"]["cards"][1]["q"] = "only in B, reworded"          # unshared: in B alone
        def emit(decks):
            with tempfile.TemporaryDirectory() as d:
                n_decks, n_cards, stamp = R.write_flashcards(decks, Path(d), NODES)
                return {p.name: p.read_bytes() for p in (Path(d) / "flashcards").glob("*.json")}, stamp
        fa, sa = emit(DECKS)
        fb, sb = emit(reworded)
        self.assertEqual(fa["_index.json"], fb["_index.json"], "the deck manifest is byte-identical")
        self.assertEqual(hashlib.sha256(fa["_index.json"]).hexdigest(), hashlib.sha256(fb["_index.json"]).hexdigest(),
                         "so the study bundles' index hash is the same")
        man = json.loads(fa["_index.json"])
        self.assertEqual(man["_meta"], {"format": 4}, "the manifest carries no stamp")
        self.assertNotIn(sa.encode(), fa["_index.json"])
        live = lambda f: {k: v for k, v in f.items() if k.startswith("live-")}
        self.assertGreaterEqual(len(live(fa)), 2)
        self.assertNotEqual(live(fa), live(fb), "the live files move")
        self.assertNotEqual(sa, sb, "and so does their fingerprint")
        # the carrier: the same curriculum under the two stamps differs by the stamp alone
        cur = {"belts": [{"id": "white", "units": []}], "scoreWeightsByOrd": {"div": 1, "gi": [], "nogi": []}}
        ca, cb = R.curriculum_json(cur, sa), R.curriculum_json(cur, sb)
        self.assertNotEqual(ca, cb, "curriculum.json moves")
        ja, jb = json.loads(ca), json.loads(cb)
        self.assertEqual((ja.pop("ratingLive"), jb.pop("ratingLive")), (sa, sb), "by its stamp")
        self.assertEqual(ja, jb, "and by nothing else")
        self.assertEqual(ja, cur)
        with self.assertRaises(SystemExit):
            R.curriculum_json(cur, None)                                   # no stamp to carry: refuse, never write one without


if __name__ == "__main__":
    unittest.main()
