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

    def test_scope_is_exactly_the_reviewed_30_decks_and_241_cards(self):
        expected = {f'{graph.slugify(name)}/{role}' for name in REVIEWED for role in ROLES}
        self.assertEqual(graph.REVIEWED_SUBMISSION_MC_DECKS, expected)
        self.assertEqual(len(expected), 30)
        cards = 0
        for name, counts in REVIEWED.items():
            for role, count in zip(ROLES, counts):
                self.assertEqual(len(self.by_name[name][role]['flashcards']), count, (name, role))
                self.assertEqual(len(self.exported[f'{graph.slugify(name)}/{role}']['flashcards']), count)
                cards += count
        self.assertEqual(cards, 241)

    def test_reviewed_fields_survive_both_producers_and_keep_full_detail(self):
        seen = 0
        for name in REVIEWED:
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
        self.assertEqual(seen, 241)

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
    for name in REVIEWED:
        for role in ROLES:
            key = f'{graph.slugify(name)}/{role}'
            decks[f'{name}|{role.title()}'] = {'cards': neural._qa_cards(SubmissionMCExport.exported[key]['flashcards'])}
    aoki = SubmissionMCExport.by_name['Aoki Lock from Ashi Garami']['attacker']['flashcards']
    json.dump({'pythonTests': result.testsRun, 'outside': SubmissionMCExport.outside_counts, 'decks': decks,
               'legacyAoki': neural._qa_cards(legacy_cards(aoki))}, sys.stdout, ensure_ascii=False)
