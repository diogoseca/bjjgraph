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
        counts = graph._rescale_outcomes_by_ruleset(node)
        self.assertEqual(counts, {'rescaled': 2, 'skipped': 0, 'dropped': {'gi': 0, 'nogi': 0}})
        self.assertEqual([o['probabilityByRuleset'] for o in node['outcomes']],
                         [{'gi': 50, 'nogi': 25}, {'gi': 50, 'nogi': 75}])
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


if __name__ == '__main__':
    mutant = sys.argv[1] if len(sys.argv) > 1 else None
    if mutant:
        suite = unittest.defaultTestLoader.loadTestsFromName(
            'TechniqueRulesetReader.test_divergent_and_null_cells_survive_actual_readers', sys.modules[__name__])
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
        elif mutant:
            raise SystemExit('Unknown mutant: ' + mutant)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f'Technique ruleset readers: {result.testsRun} tests; transitions and submissions exercised.')
    raise SystemExit(0 if result.wasSuccessful() else 1)
