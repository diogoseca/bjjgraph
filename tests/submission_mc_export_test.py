"""D-321's reviewed scope, tested at the real graph and neural producers."""
import contextlib
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import regenerate_graph as graph
import regenerate_neural_data as neural

# Independent review receipt: node -> (attacker cards, defender cards). Adding a
# deck or a card is a content-review decision, not an automatic exporter rollout.
REVIEWED = {
    'Anaconda Choke from Dead Orchard': (10, 5),
    'Aoki Lock from Aoki Lock Control': (10, 6),
    'Aoki Lock from Ashi Garami': (12, 5),
    'Arm Triangle from Hindulotine': (10, 5),
    'Bow and Arrow Choke from Invisible Collar': (10, 5),
    'Calf Slicer from Carni': (9, 5),
    'Clock Choke from Invisible Collar': (10, 5),
    'Cross Collar Choke from Invisible Collar': (12, 5),
    'Guillotine Choke from Hindulotine': (10, 4),
    'Heel Hook from Carni': (8, 5),
    'High Elbow Guillotine from Hindulotine': (10, 4),
    'Hindulotine from Hindulotine': (10, 5),
    'Kneebar from Carni': (10, 5),
    'Rear Naked Choke from Invisible Collar': (10, 5),
    'Suloev Stretch from Half Guard': (21, 10),
}
ROLES = ('attacker', 'defender')


def legacy_cards(cards):
    """The pre-D-321 submission wire, including key order and the safety flag."""
    return [{'question': c.get('question', ''), 'answer': c.get('answer', ''),
             'safetyCritical': c.get('safety_critical', False)} for c in cards]


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


class SubmissionMCExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with contextlib.redirect_stdout(io.StringIO()):
            cls.exported, _, _ = graph.process_submissions(ROOT / 'content')
            cls.sources = [s for s in graph.load_json_files(ROOT / 'content/Submissions')
                           if s.get('name') and not s.get('is_family')]
        cls.by_name = {s['name']: s for s in cls.sources}
        # Premise migration approved by the owner: the unanimous retirements in
        # orchestrator reports/restructure-panel.md R20:547, R39:813, R41:841,
        # R43:869 match reports/graph-restructure-plan.md:681,687,691,695.
        # The reviewed-content claim survives: exercise every surviving deck;
        # only the ledger-backed retirements move to explicit absence assertions.
        # Keep the original 30-deck / 241-card receipt and archived card counts.
        approved = json.loads((ROOT / 'calibration/graph_restructure_phase2.json').read_text())['retirements']
        archived = {r['old_path']: r for r in json.loads(
            (ROOT / 'calibration/node_identity_retirements.json').read_text())['records']}
        cls.retired = {}
        for row in approved:
            record = archived[row['old_path']]
            name = record['source']['name']
            if name in REVIEWED:
                cls.retired[name] = record
        cls.active_reviewed = {name: counts for name, counts in REVIEWED.items() if name not in cls.retired}
        cls.active_decks = len(cls.active_reviewed) * len(ROLES)
        cls.active_cards = sum(sum(counts) for counts in cls.active_reviewed.values())

    def test_reviewed_receipt_survives_with_only_approved_retirements_absent(self):
        expected = {f'{graph.slugify(name)}/{role}' for name in REVIEWED for role in ROLES}
        self.assertEqual(graph.REVIEWED_SUBMISSION_MC_DECKS, expected)
        self.assertEqual(len(expected), 30)
        self.assertEqual(sum(sum(counts) for counts in REVIEWED.values()), 241)
        self.assertGreater(self.active_decks, 0)
        self.assertGreater(len(self.retired), 0, 'The approved retirement coverage must run')
        for name, record in self.retired.items():
            self.assertFalse((ROOT / record['old_path']).exists(), name)
            self.assertTrue((ROOT / record['replacement_path']).exists(), name)
            self.assertNotIn(name, self.by_name)
            for role, count in zip(ROLES, REVIEWED[name]):
                self.assertNotIn(f'{graph.slugify(name)}/{role}', self.exported)
                self.assertEqual(len(record['source'][role]['flashcards']), count)
        cards = 0
        for name, counts in self.active_reviewed.items():
            for role, count in zip(ROLES, counts):
                self.assertEqual(len(self.by_name[name][role]['flashcards']), count, (name, role))
                self.assertEqual(len(self.exported[f'{graph.slugify(name)}/{role}']['flashcards']), count)
                cards += count
        self.assertEqual(cards, self.active_cards)

    def test_reviewed_fields_survive_both_producers_and_keep_full_detail(self):
        seen = decks = 0
        for name in self.active_reviewed:
            for role in ROLES:
                source = self.by_name[name][role]['flashcards']
                wire = self.exported[f'{graph.slugify(name)}/{role}']['flashcards']
                cards = neural._qa_cards(wire)
                self.assertEqual(len(cards), len(source))
                for raw, exported, card in zip(source, wire, cards):
                    self.assertEqual(exported['answer_line'], raw['answer_line'])
                    self.assertEqual(exported['distractors'], raw['distractors'])
                    self.assertEqual(exported['safetyCritical'], raw.get('safety_critical', False))
                    self.assertEqual(card['q'], raw['question'])
                    self.assertEqual(card['a'], raw['answer_line'])
                    self.assertEqual(card.get('d', card['a']), raw['answer'])
                    self.assertEqual(card['mc'], {'p': raw['distractors']['plausible'],
                                                 't': raw['distractors']['trap']})
                    self.assertEqual((len(card['mc']['p']), len(card['mc']['t'])), (2, 1))
                    for option in [card['a'], *card['mc']['p'], *card['mc']['t']]:
                        self.assertGreater(len(option), 0)
                        self.assertLessEqual(len(option), 36, (name, role, option))
                    seen += 1
                decks += 1
        self.assertEqual(seen, self.active_cards)
        self.assertGreater(decks, 0, 'Zero surviving reviewed decks exercised is a failure')
        self.assertEqual(decks, self.active_decks)

    def test_every_other_submission_preserves_legacy_bytes(self):
        decks = cards = dormant_choices = 0
        for source in self.sources:
            if source['name'] in REVIEWED:
                continue
            for role in ROLES:
                raw = source.get(role, {}).get('flashcards', source.get('flashcards', []) if role == 'attacker' else [])
                legacy = legacy_cards(raw)
                actual = self.exported[f"{graph.slugify(source['name'])}/{role}"]['flashcards']
                self.assertEqual(encoded(actual), encoded(legacy), (source['name'], role))
                self.assertEqual(encoded(neural._qa_cards(actual)), encoded(neural._qa_cards(legacy)))
                self.assertTrue(all('mc' not in c for c in neural._qa_cards(actual)))
                decks += 1
                cards += len(raw)
                dormant_choices += sum(bool(c.get('distractors')) for c in raw)
        self.assertGreater(decks, 500)
        self.assertGreater(cards, 4000)
        self.assertGreater(dormant_choices, 4000)
        self.__class__.outside_counts = {'decks': decks, 'cards': cards, 'dormantChoices': dormant_choices}

    def test_unreviewed_neighbor_name_and_flat_legacy_input_do_not_opt_in(self):
        card = {'question': 'Fixture question?', 'answer': 'Full fixture explanation.',
                'answer_line': 'Fixture answer', 'distractors': {'plausible': ['First error', 'Second error'],
                                                               'trap': ['Third error']},
                'safety_critical': True}
        # A near-name must not inherit the reviewed variant's permission; the
        # old flat card schema must retain its attacker-only interpretation.
        source = {'name': 'Aoki Lock from Ashi Garami Variant', 'flashcards': [card]}
        with patch.object(graph, 'load_json_files', return_value=[source]), \
             patch.object(graph, 'build_position_path_index', return_value={}), \
             contextlib.redirect_stdout(io.StringIO()):
            exported, _, _ = graph.process_submissions(ROOT / 'content')
        stem = 'aoki-lock-from-ashi-garami-variant'
        self.assertEqual(exported[stem + '/attacker']['flashcards'], legacy_cards([card]))
        self.assertEqual(exported[stem + '/defender']['flashcards'], [])


if __name__ == '__main__':
    result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(SubmissionMCExport))
    if not result.wasSuccessful():
        raise SystemExit(1)
    # The Node test runs production mcDistractors and _mcAnswer on these actual
    # producer outputs. No separately authored "expected" deck stands in for it.
    decks = {}
    for name in SubmissionMCExport.active_reviewed:
        for role in ROLES:
            key = f'{graph.slugify(name)}/{role}'
            decks[f'{name}|{role.title()}'] = {'cards': neural._qa_cards(SubmissionMCExport.exported[key]['flashcards'])}
    aoki = SubmissionMCExport.by_name['Aoki Lock from Ashi Garami']['attacker']['flashcards']
    json.dump({'pythonTests': result.testsRun, 'outside': SubmissionMCExport.outside_counts, 'decks': decks,
               'scope': {'activeDecks': SubmissionMCExport.active_decks, 'activeCards': SubmissionMCExport.active_cards,
                         'retiredDecks': len(SubmissionMCExport.retired) * len(ROLES),
                         'retiredNames': list(SubmissionMCExport.retired)},
               'legacyAoki': neural._qa_cards(legacy_cards(aoki))}, sys.stdout, ensure_ascii=False)
