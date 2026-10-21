"""Exercise the real transition/submission readers with divergent and absent frames."""
import contextlib
import copy
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import regenerate_graph as graph
import regenerate_neural_data as neural
import solve_edge_values as solver


class TechniqueRulesetReader(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='technique-ruleset-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.divergent = {
            'name': 'Divergent Fixture', 'from_position': 'Half Guard/Bottom',
            'success_rate': {'gi': 41, 'nogi': 38},
            'outcomes': [
                {'to': 'Half Guard/Top', 'result': 'success', 'probability': {'gi': 41, 'nogi': 38}},
                {'to': 'Half Guard/Bottom', 'result': 'failure', 'probability': {'gi': 59, 'nogi': 62}},
            ],
        }
        self.absent = {
            'name': 'Absent Fixture', 'from_position': 'Leg Weave/Bottom',
            'success_rate': {'gi': 35, 'nogi': None},
            'outcomes': [
                {'to': 'Half Guard/Top', 'result': 'success', 'probability': {'gi': 35, 'nogi': None}},
                {'to': 'Leg Weave/Bottom', 'result': 'failure', 'probability': {'gi': 45, 'nogi': None}},
                {'to': 'Side Control/Bottom', 'result': 'counter', 'probability': {'gi': 20, 'nogi': None}},
            ],
        }
        for category in ('Transitions', 'Submissions'):
            folder = self.root / 'content' / category
            folder.mkdir(parents=True)
            for data in (self.divergent, self.absent):
                (folder / (data['name'] + '.json')).write_text(json.dumps(data))
        graph._PARSE_FAILURES.clear()
        graph._RULESET_FAILURES.clear()

    def read(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            transitions = graph.process_transitions(self.root / 'content')
            submissions, _, _ = graph.process_submissions(self.root / 'content')
        self.assertEqual(graph._PARSE_FAILURES, [], 'Both readers must load divergent maps intact')
        self.assertEqual(graph._RULESET_FAILURES, [], 'A gi-only exchange has a real frame')
        return (transitions, submissions), output.getvalue()

    def test_divergent_and_null_cells_survive_actual_readers(self):
        collections, log = self.read()
        for nodes in collections:
            with self.subTest(category=nodes['divergent-fixture/attacker'].get('isTerminal', False)):
                att, dfn = (nodes['divergent-fixture/' + role] for role in ('attacker', 'defender'))
                self.assertEqual(att['successRate'], 38)
                self.assertEqual(att['successRateByRuleset'], {'gi': 41, 'nogi': 38})
                self.assertEqual(dfn['successRate'], 62)
                self.assertEqual(dfn['successRateByRuleset'], {'gi': 59, 'nogi': 62})
                self.assertEqual(att['outcomes'][0]['probability'], 38)
                self.assertEqual(att['outcomes'][0]['probabilityByRuleset'], {'gi': 41, 'nogi': 38})
                self.assertEqual(dfn['outcomes'][0], {
                    'to': 'half-guard/bottom', 'result': 'failure', 'probability': 38,
                    'probabilityByRuleset': {'gi': 41, 'nogi': 38},
                })
                for role, gi_rate in (('attacker', 35), ('defender', 65)):
                    node = nodes['absent-fixture/' + role]
                    self.assertIsNone(node['successRate'])
                    self.assertEqual(node['successRateByRuleset'], {'gi': gi_rate, 'nogi': None})
                    self.assertEqual(len(node['outcomes']), 3, 'Combined graph retains the gi edges')
                    for outcome, gi in zip(node['outcomes'], (35, 45, 20)):
                        self.assertIsNone(outcome['probability'], 'No-gi absence must never become zero or gi')
                        self.assertEqual(outcome['probabilityByRuleset'], {'gi': gi, 'nogi': None})
        for scope in ('transitions', 'submissions'):
            self.assertEqual(graph._OUTCOME_STATS[scope]['outcomes'], 5)
            self.assertEqual(graph._OUTCOME_STATS[scope]['no_nogi'], 3, 'Authored rows counted once, not per role')
            self.assertEqual(graph._OUTCOME_STATS[scope]['sr_no_nogi'], 1)
            self.assertIn(scope.capitalize() + ' outcome cells absent (dropped from that frame): gi 0, no-gi 3', log)

    def test_vote_rescale_keeps_pairs_coherent_and_counts_absent_cells(self):
        collections, _ = self.read()
        node = collections[0]['divergent-fixture/attacker']
        node['successRate'] = 25
        node['successRateByRuleset'] = {'gi': 50, 'nogi': 25}
        # D-363 keeps the pre-fix common table despite a divergent success rate.
        for outcome in node['outcomes']:
            outcome['probabilityByRuleset']['gi'] = outcome['probabilityByRuleset']['nogi']
        counts = graph._rescale_outcomes_by_ruleset(node)
        self.assertEqual(counts, {'rescaled': 1, 'skipped': 0, 'dropped': {'gi': 0, 'nogi': 0}})
        self.assertEqual([o['probabilityByRuleset'] for o in node['outcomes']],
                         [{'gi': 25, 'nogi': 25}, {'gi': 75, 'nogi': 75}])
        self.assertEqual([o['probability'] for o in node['outcomes']], [25, 75])
        for role in ('attacker', 'defender'):
            node = collections[0]['absent-fixture/' + role]
            before = copy.deepcopy(node)
            counts = graph._rescale_outcomes_by_ruleset(node)
            self.assertEqual(counts, {'rescaled': 1, 'skipped': 1, 'dropped': {'gi': 0, 'nogi': 3}})
            self.assertEqual(node, before, 'An unavailable frame stays absent after vote rescaling')

    def test_all_null_rate_still_fails_the_source_contract(self):
        data = {**self.absent, 'success_rate': {'gi': None, 'nogi': None}}
        graph._reset_outcome_stats('transitions')
        graph._technique_rate(data, 'all-null-fixture', 'transitions')
        self.assertEqual(graph._RULESET_FAILURES,
                         [('all-null-fixture', 'success_rate exists in no ruleset frame')])

    def gi_fixture(self):
        # D-363's approved real record, not a separately maintained probability table.
        source = json.loads((ROOT / 'content/Transitions/Sweep from Leg Weave.json').read_text())
        with patch.object(graph, 'load_json_files', return_value=[source]), \
             patch.object(graph, 'build_position_path_index', return_value={}), \
             contextlib.redirect_stdout(io.StringIO()):
            nodes = graph.process_transitions(ROOT / 'content')
        stem = graph.slugify(source['name'])
        positions = {'leg-weave/bottom': {'hub': 'leg-weave', 'role': 'bottom', 'transitions': [{
            'technique': source['name'], 'target': stem, 'isSubmission': False,
            'attemptProbability': None, 'attemptProbabilityByRuleset': {'gi': 100, 'nogi': None},
        }]}}
        return {'positions': positions, 'transitions': nodes, 'submissions': {}}, nodes[stem + '/attacker']

    def test_gi_solve_uses_35_45_20_from_its_pair(self):
        data, node = self.gi_fixture()
        self.assertEqual([value for _, value in solver.frame_outcomes(node, 'gi')], [35, 45, 20])
        p, success, miss, empty = solver.build_action(data, node, solver.Opts(frame='gi'))
        self.assertEqual(p, .35)
        self.assertEqual(success, [(1.0, ('S', 'half-guard/top', True))])
        self.assertEqual([outcome for _, outcome in miss], [('S', 'leg-weave/bottom', False), ('S', 'side-control/bottom', False)])
        self.assertAlmostEqual(miss[0][0] * 65, 45)
        self.assertAlmostEqual(miss[1][0] * 65, 20)
        self.assertEqual(empty, 0)
        hand, _, absent, _ = solver.build_hand(data, 'leg-weave/bottom', solver.Opts(frame='gi'))
        self.assertEqual(len(hand), 1)
        self.assertEqual(absent, 0)
        self.assertEqual(hand[0].succ, success)
        self.assertEqual(hand[0].miss, miss)

    def test_nogi_cannot_reach_the_absent_technique(self):
        data, node = self.gi_fixture()
        with self.assertRaisesRegex(ValueError, 'absent in frame nogi'):
            solver.build_action(data, node, solver.Opts(frame='nogi'))
        self.assertEqual(solver.build_hand(data, 'leg-weave/bottom', solver.Opts(frame='nogi')),
                         ([], False, 1, True))
        edge = data['positions']['leg-weave/bottom']['transitions'][0]
        for invalid in (0, 100):
            edge['attemptProbabilityByRuleset']['nogi'] = invalid
            with self.assertRaisesRegex(ValueError, 'attempt cell must be null'):
                solver.build_hand(data, 'leg-weave/bottom', solver.Opts(frame='nogi'))

    def test_wire_tuple_is_the_gi_table_without_a_format_change(self):
        _, node = self.gi_fixture()
        before = copy.deepcopy(node)
        counts = {'techniques': 0, 'tuples': 0, 'without_nogi': 0}
        self.assertEqual(neural.wire_outcomes(node, counts), [
            ['half-guard/top', 35, 's'], ['leg-weave/bottom', 45, 'f'], ['side-control/bottom', 20, 'c']])
        self.assertEqual(counts, {'techniques': 1, 'tuples': 3, 'without_nogi': 1})
        self.assertEqual(node, before, 'The wire must not fill the graph\'s absent frame')

    def test_wire_refuses_different_present_frames(self):
        collections, _ = self.read()
        with self.assertRaisesRegex(ValueError, 'differs or is absent across present frames'):
            neural.wire_outcomes(collections[0]['divergent-fixture/attacker'])

    def test_wire_refuses_a_technique_without_a_present_frame(self):
        _, node = self.gi_fixture()
        node['successRateByRuleset']['gi'] = None
        with self.assertRaisesRegex(ValueError, 'no present outcome frame'):
            neural.wire_outcomes(node)

    def test_selfcheck_sums_present_frames_and_rejects_an_absent_attempt(self):
        data, _ = self.gi_fixture()
        checks = {name: (ok, detail) for name, ok, detail in solver.selfcheck(data)}
        self.assertTrue(checks['outcome sums == 100'][0])
        self.assertIn('2/2 present frames', checks['outcome sums == 100'][1])
        self.assertIn('2 absent frames, 6 null cells dropped', checks['outcome sums == 100'][1])
        self.assertTrue(checks['absent techniques have null attempt cells'][0])
        data['positions']['leg-weave/bottom']['transitions'][0]['attemptProbabilityByRuleset']['nogi'] = 0
        checks = {name: (ok, detail) for name, ok, detail in solver.selfcheck(data)}
        self.assertFalse(checks['absent techniques have null attempt cells'][0])


if __name__ == '__main__':
    mutant = sys.argv[1] if len(sys.argv) > 1 else None
    if mutant:
        named = {'--mutate-solver-folded': 'test_gi_solve_uses_35_45_20_from_its_pair',
                 '--mutate-wire-folded': 'test_wire_tuple_is_the_gi_table_without_a_format_change'}
        suite = unittest.defaultTestLoader.loadTestsFromName(
            'TechniqueRulesetReader.' + named.get(mutant, 'test_divergent_and_null_cells_survive_actual_readers'),
            sys.modules[__name__])
    else:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(TechniqueRulesetReader)
    with contextlib.ExitStack() as stack:
        if mutant == '--mutate-reduced-reader':
            original = graph.load_json_files
            def reduced(directory, **kwargs):
                if directory.name in ('Transitions', 'Submissions'):
                    kwargs['reduce'] = True
                return original(directory, **kwargs)
            stack.enter_context(patch.object(graph, 'load_json_files', reduced))
        elif mutant == '--mutate-null-to-zero':
            original = graph._outcome_prob
            def fabricated(*args):
                fields = original(*args)
                if fields['probability'] is None:
                    fields['probability'] = 0
                return fields
            stack.enter_context(patch.object(graph, '_outcome_prob', fabricated))
        elif mutant in ('--mutate-solver-folded', '--mutate-wire-folded'):
            target = solver if mutant == '--mutate-solver-folded' else neural
            stack.enter_context(patch.object(target, 'outcome_cell', lambda outcome, frame: outcome['probability']))
        elif mutant:
            raise SystemExit('Unknown mutant: ' + mutant)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f'Technique ruleset readers: {result.testsRun} tests; transitions and submissions exercised.')
    raise SystemExit(0 if result.wasSuccessful() else 1)
