import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./technique_ruleset_reader_test.py', import.meta.url));
function run(...args) {
  const r = spawnSync('python3', ['-B', script, ...args], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(r.error);
  return { status: r.status, output: r.stdout + r.stderr };
}

test('technique readers retain divergent pairs, null absence and counted vote rescaling', () => {
  const r = run();
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /Ran 9 tests/);
  console.log('9 Python contracts passed across both real file readers, solver and unchanged wire tuples.');
});

for (const mutant of ['--mutate-reduced-reader', '--mutate-null-to-zero']) {
  test(`reader negative control ${mutant} turns the divergent/null test red`, () => {
    const r = run(mutant);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /FAIL: test_divergent_and_null_cells_survive_actual_readers/);
    console.log(`${mutant}: killed by test_divergent_and_null_cells_survive_actual_readers`);
  });
}

for (const [mutant, name] of [
  ['--mutate-solver-folded', 'test_gi_solve_uses_35_45_20_from_its_pair'],
  ['--mutate-wire-folded', 'test_wire_tuple_is_the_gi_table_without_a_format_change'],
]) {
  test(`D-363 ${mutant} turns its named consumer test red`, () => {
    const r = run(mutant);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, new RegExp(`(?:FAIL|ERROR): ${name}`));
    console.log(`${mutant}: killed by ${name}`);
  });
}
