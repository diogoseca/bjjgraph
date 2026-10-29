#!/usr/bin/env python3
"""D-363's two clean comparisons; run under the programme build lock.

A: old code versus new code, both on the complete dev content snapshot.
B: new code on dev versus new code on the complete working content snapshot.
No old-code/current-content arm exists. Every arm runs the real graph, layout,
ordinal, strength, wire and solver functions. Layout and ordinal regeneration
start from the same dev artifacts. Outputs stay under a fresh --output directory.
"""
import argparse
import hashlib
import importlib
import json
import shutil
import subprocess
import sys
import tarfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_ROOTS = ('content', 'templates/votes.json', 'neural/submission-states.json')
SCENARIOS = ('old-dev', 'new-dev', 'new-current')
MISSING = object()


def historical(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT)


def encoded(value):
    # The production neural emitter's encoding, including field order.
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def load_before(name, ref):
    module = types.ModuleType(name)
    module.__file__ = str(ROOT / 'scripts' / (name + '.py'))
    sys.modules[name] = module
    exec(compile(historical(ref, 'scripts/' + name + '.py'), module.__file__, 'exec'), module.__dict__)
    return module


def snapshot_inputs(args):
    """Separate, complete snapshots; never overlay dev records onto current content."""
    snapshots = args.output / 'inputs'
    snapshots.mkdir()  # Refuse stale inputs from an earlier run.
    archive_path = args.output / 'dev-inputs.tar'
    with archive_path.open('wb') as output:
        subprocess.run(['git', 'archive', args.build_ref, '--', *INPUT_ROOTS],
                       cwd=ROOT, stdout=output, check=True)
    with tarfile.open(archive_path) as archive:
        for member in sorted(archive.getmembers(), key=lambda m: m.name):
            if not member.isfile() or Path(member.name).suffix not in ('.json', '.md'):
                continue
            assert not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
            target = snapshots / 'dev' / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
    current_paths = subprocess.check_output(
        ['git', 'ls-files', '-z', '-c', '-o', '--exclude-standard', '--', *INPUT_ROOTS], cwd=ROOT)
    for rel in sorted({p.decode() for p in current_paths.split(b'\0') if p}):
        source = ROOT / rel
        if source.is_file() and source.suffix in ('.json', '.md'):
            target = snapshots / 'current' / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    manifests = {}
    for label in ('dev', 'current'):
        root = snapshots / label
        manifests[label] = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                            for p in sorted(root.rglob('*')) if p.is_file()}
        assert manifests[label] and 'templates/votes.json' in manifests[label]
        assert 'neural/submission-states.json' in manifests[label]
        print(f'D-363 {label} snapshot: {len(manifests[label])} complete input files', flush=True)
    (args.output / 'input-manifests.json').write_text(json.dumps(manifests, indent=2) + '\n')


def produce(args):
    sys.path.insert(0, str(ROOT / 'scripts'))
    if args.mode == 'old-dev':
        reader = load_before('regenerate_graph', args.code_ref)
        solver = load_before('solve_edge_values', args.code_ref)
        neural = load_before('regenerate_neural_data', args.code_ref)
    else:
        reader = importlib.import_module('regenerate_graph')
        solver = importlib.import_module('solve_edge_values')
        neural = importlib.import_module('regenerate_neural_data')
    source = args.output / 'inputs' / ('current' if args.mode == 'new-current' else 'dev')
    output = args.output / args.mode
    output.mkdir()
    graph = reader.generate_state_graph(source)
    for name in ('_PARSE_FAILURES', '_RULESET_FAILURES', '_COVERAGE_FAILURES'):
        assert not getattr(reader, name), (name, getattr(reader, name))
    (output / 'graph.json').write_bytes(encoded(graph))

    # Regenerate with identical historical starting geometry and permanent ids.
    # Every arm's content lookup goes to its own complete source snapshot.
    layout_emitter = importlib.import_module('regenerate_graph_layout')
    layout_emitter.PROJECT_ROOT = source
    layout_emitter.GRAPH_JSON = output / 'graph.json'
    layout_emitter.OUTPUT_DIR = output
    layout_emitter.OUTPUT_FILE = output / 'layout.json'
    layout_emitter.OUTPUT_FILE.write_bytes(historical(args.build_ref, 'source/quartz/static/globalGraphLayout.json'))
    layout_emitter.main()
    layout = json.loads(layout_emitter.OUTPUT_FILE.read_text())
    ordinal_emitter = importlib.import_module('regenerate_node_ordinals')
    seed = json.loads(historical(args.build_ref, 'node_ordinals.json'))
    live = [node['id'] for node in layout['nodes']]
    ordinals, retired, _ = ordinal_emitter.generate(live, seed)
    ordinal_text = ordinal_emitter.render_lock(ordinals, retired, len(live))
    assert not ordinal_emitter.validate(json.loads(ordinal_text), live, seed)
    (output / 'ordinals.json').write_text(ordinal_text)
    strength = importlib.import_module('enrich_graph_strength')
    strength._REPO_ROOT = str(source)
    strength.GRAPH_JSON = str(output / 'graph.json')
    strength.LAYOUT_JSON = str(output / 'layout.json')
    assert strength.main() == 0
    graph = json.loads((output / 'graph.json').read_text())
    layout = json.loads((output / 'layout.json').read_text())

    neural.ROOT = source
    wire = neural.build_graph_data(layout, graph, ordinals)
    (output / 'wire.json').write_bytes(encoded(wire))
    solutions = {}
    states = actions = scalar_fields = 0
    for frame in ('gi', 'nogi'):
        for rates in ('folded', 'frame'):
            solution = solver.solve_mixture(graph, opts=solver.Opts(frame=frame, rates=rates))
            # Only runtime Model/Opts objects are excluded. All numeric fields,
            # complete action rows, policies and convergence data are retained.
            solutions[frame + '/' + rates] = {
                key: getattr(solution, key) for key in solution.__slots__ if key not in ('model', 'opts')}
            states += len(solution.v)
            actions += sum(len(rows) for rows in solution.q.values())
            scalar_fields += sum(len(getattr(solution, key)) for key in
                                 ('v', 'pwin', 'ploss', 'pdraw', 'uw', 'ul', 'baseline'))
    (output / 'solver.json').write_bytes(encoded(solutions))
    counts = {'source_json_files': sum(1 for _ in source.rglob('*.json')),
              'wire_nodes': len(wire['nodes']), 'wire_links': len(wire['links']),
              'outcome_rows': sum(len(node.get('outcomes') or []) for category in ('transitions', 'submissions')
                                  for node in graph[category].values()),
              'solver_configurations': len(solutions), 'solver_state_rows': states,
              'solver_action_rows': actions, 'solver_state_scalars': scalar_fields}
    assert all(value > 0 for value in counts.values()), counts
    (output / 'counts.json').write_bytes(encoded(counts))
    print(args.mode, json.dumps(counts), flush=True)


def differences(before, after, path=()):
    if isinstance(before, dict) and isinstance(after, dict):
        for key in sorted(before.keys() | after.keys()):
            yield from differences(before.get(key, MISSING), after.get(key, MISSING), path + (key,))
    elif isinstance(before, list) and isinstance(after, list):
        for i in range(max(len(before), len(after))):
            yield from differences(before[i] if i < len(before) else MISSING,
                                   after[i] if i < len(after) else MISSING, path + (i,))
    elif before != after:
        row = {'path': list(path), 'before_present': before is not MISSING, 'after_present': after is not MISSING}
        if before is not MISSING:
            row['before'] = before
        if after is not MISSING:
            row['after'] = after
        yield row


def summarize(args):
    counts = {mode: json.loads((args.output / mode / 'counts.json').read_text()) for mode in SCENARIOS}
    assert counts['old-dev'] == counts['new-dev'], counts
    report = {'code_ref': args.code_ref, 'content_ref': args.build_ref, 'counts': counts,
              'A': {'premise': 'Old versus new code; both regenerate from the complete dev snapshot.', 'comparisons': {}},
              'B': {'premise': 'New code on the complete current snapshot versus the complete dev snapshot.',
                    'status': 'Movement enumerated; approval trace review required before a capture contract is frozen.',
                    'field_counts': {}}}
    for kind in ('wire', 'solver'):
        before = (args.output / 'old-dev' / (kind + '.json')).read_bytes()
        after = (args.output / 'new-dev' / (kind + '.json')).read_bytes()
        identical = before == after
        report['A']['comparisons'][kind] = {'byte_identical': identical, 'bytes': len(after),
                                          'sha256_before': hashlib.sha256(before).hexdigest(),
                                          'sha256_after': hashlib.sha256(after).hexdigest()}
        print(f'D-363 A {kind}: {len(after)} bytes compared; byte-identical={identical}')
    for kind in ('graph', 'layout', 'ordinals', 'wire', 'solver'):
        before = json.loads((args.output / 'new-dev' / (kind + '.json')).read_text())
        after = json.loads((args.output / 'new-current' / (kind + '.json')).read_text())
        rows = list(differences(before, after))
        # List the generated timestamp too; the trace review labels it as rebuild metadata.
        (args.output / ('movement-' + kind + '.json')).write_text(json.dumps(rows, indent=2) + '\n')
        report['B']['field_counts'][kind] = len(rows)
        print(f'D-363 B {kind}: {len(rows)} moved fields enumerated')
    before = json.loads((args.output / 'old-dev/graph.json').read_text())
    after = json.loads((args.output / 'new-dev/graph.json').read_text())
    code_rows = [row for row in differences(before, after) if row['path'] != ['meta', 'generated']]
    unexpected = [row for row in code_rows if row['path'][-1] != 'probabilityByRuleset']
    (args.output / 'code-graph-movement.json').write_text(json.dumps(code_rows, indent=2) + '\n')
    report['A']['graph_probability_pairs_added'] = len(code_rows)
    report['A']['unexpected_graph_changes'] = unexpected
    print('D-363 coverage:', json.dumps(counts, sort_keys=True))
    (args.output / 'parity.json').write_text(json.dumps(report, indent=2) + '\n')
    assert not unexpected, unexpected[:3]
    assert code_rows, 'New pair reader must have positive coverage'
    if not all(row['byte_identical'] for row in report['A']['comparisons'].values()):
        raise SystemExit('D-363 code-only parity failed; inspect the old-dev/new-dev artifacts')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--code-ref', required=True, help='Pre-fix reader/solver/emitter commit')
    parser.add_argument('--build-ref', required=True, help='Dev content and layout/ordinal seed commit')
    parser.add_argument('--output', required=True, type=Path, help='Fresh proof directory')
    parser.add_argument('--mode', choices=SCENARIOS, help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.mode:
        produce(args)
        return
    snapshot_inputs(args)
    for mode in SCENARIOS:
        print('START D-363', mode, flush=True)
        cmd = [sys.executable, '-B', str(Path(__file__).resolve()), '--code-ref', args.code_ref,
               '--build-ref', args.build_ref, '--output', str(args.output), '--mode', mode]
        with (args.output / (mode + '.log')).open('w') as log:
            result = subprocess.run(cmd, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            print('\n'.join((args.output / (mode + '.log')).read_text().splitlines()[-35:]))
            raise SystemExit(result.returncode)
    summarize(args)


if __name__ == '__main__':
    main()
