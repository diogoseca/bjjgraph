"""D-431: a menu's explicitly distinct setup and finish must stay distinct."""
import contextlib
import copy
import inspect
import io
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import regenerate_graph as graph


class CoListedTargets(unittest.TestCase):
    def setUp(self):
        self.fired, self.unresolved = set(), []

    def resolve(self, slug='aoki-lock', leaf='ashi-garami', listed=None, seat='ashi-garami/bottom', transitions=None):
        return graph.resolve_target(slug, leaf,
            listed_slugs=set(listed if listed is not None else ['aoki-lock', 'aoki-lock-from-ashi-garami']),
            seat=seat, transitions={'aoki-lock': {}, 'kneebar': {}} if transitions is None else transitions,
            submissions={'aoki-lock-from-ashi-garami': {}, 'kneebar-from-backside-50-50': {}},
            co_listed_seats=self.fired, unresolved_targets=self.unresolved)

    def test_colisted_aoki_setup_and_finish_remain_distinct(self):
        self.assertEqual(self.resolve(), ('aoki-lock', False))
        self.assertEqual(self.resolve('aoki-lock-from-ashi-garami'), ('aoki-lock-from-ashi-garami', True))
        self.assertEqual(self.fired, {'ashi-garami/bottom'})
        self.assertEqual(self.unresolved, [])

    def test_lone_kneebar_keeps_variant_first_resolution(self):
        self.assertEqual(self.resolve('kneebar', 'backside-50-50', ['kneebar'], 'backside-50-50/top'),
                         ('kneebar-from-backside-50-50', True))
        self.assertEqual(self.fired, set())

    def test_variant_on_another_seat_does_not_count_as_colisted(self):
        self.assertEqual(self.resolve(listed=['aoki-lock'], seat='ashi-garami/top'),
                         ('aoki-lock-from-ashi-garami', True))
        self.assertEqual(self.fired, set())

    def test_variant_alone_does_not_trigger_a_generic_row(self):
        self.assertEqual(self.resolve(listed=['aoki-lock-from-ashi-garami']),
                         ('aoki-lock-from-ashi-garami', True))
        self.assertEqual(self.fired, set())

    def test_colisting_without_a_real_transition_keeps_the_variant(self):
        self.assertEqual(self.resolve(transitions={}), ('aoki-lock-from-ashi-garami', True))
        self.assertEqual(self.fired, set())

    def test_missing_target_is_still_reported(self):
        self.assertEqual(self.resolve('missing'), ('missing', False))
        self.assertEqual(self.unresolved, [('missing', 'ashi-garami')])

    def test_unreviewed_seat_fails_the_census(self):
        with self.assertRaisesRegex(ValueError, 'census changed'):
            graph.check_co_listed_seats({'ashi-garami/bottom', 'other/top'})

    def test_zero_exercised_seats_fails_the_census(self):
        with self.assertRaisesRegex(ValueError, 'census changed'):
            graph.check_co_listed_seats(set())

    def test_expected_seat_prints_positive_count(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            graph.check_co_listed_seats({'ashi-garami/bottom'})
        self.assertIn('seats: 1 (ashi-garami/bottom)', output.getvalue())

    def test_entire_corpus_fires_only_at_the_approved_aoki_seat(self):
        def records(category):
            return [json.loads(p.read_text()) for p in (ROOT / 'content' / category).rglob('*.json')]
        transitions = {graph.slugify(d['name']): d for d in records('Transitions')}
        submissions = {graph.slugify(d['name']): d for d in records('Submissions') if not d.get('is_family')}
        checked, answers = 0, {}
        for pos in records('Positions'):
            leaf = graph.slugify(pos['name'])
            for role in ['top', 'bottom']:
                seat = leaf + '/' + role
                rows = pos.get(role, {}).get('transitions', [])
                listed = {graph.slugify(r['transition']) for r in rows}
                before = copy.deepcopy(rows)
                for row in rows:
                    slug = graph.slugify(row['transition'])
                    answers[seat, slug] = graph.resolve_target(slug, leaf, listed_slugs=listed, seat=seat,
                        transitions=transitions, submissions=submissions,
                        co_listed_seats=self.fired, unresolved_targets=self.unresolved)
                    checked += 1
                self.assertEqual(rows, before, 'resolution must not rewrite authored rows')
        self.assertGreater(checked, 2000)
        self.assertEqual(self.fired, {'ashi-garami/bottom'})
        self.assertEqual(answers['ashi-garami/bottom', 'aoki-lock'], ('aoki-lock', False))
        self.assertEqual(answers['ashi-garami/bottom', 'aoki-lock-from-ashi-garami'], ('aoki-lock-from-ashi-garami', True))
        self.assertEqual(answers['backside-50-50/top', 'kneebar'], ('kneebar-from-backside-50-50', True))
        print(f'D-431 corpus: {checked} menu rows; 1 approved co-listed seat; lone Kneebar unchanged.')


if __name__ == '__main__':
    if '--mutate-variant-first' in sys.argv:
        source = inspect.getsource(graph.resolve_target)
        guard = 'if slug in transitions and {slug, sub_variant} <= listed_slugs:'
        assert source.count(guard) == 1
        exec(compile(source.replace(guard, 'if False:  # mutant restores variant-first'),
                     graph.__file__, 'exec'), graph.__dict__)
        suite = unittest.defaultTestLoader.loadTestsFromName(
            'CoListedTargets.test_colisted_aoki_setup_and_finish_remain_distinct', sys.modules[__name__])
    else:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(CoListedTargets)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
