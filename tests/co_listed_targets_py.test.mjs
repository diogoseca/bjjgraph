import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./co_listed_targets_test.py', import.meta.url));
function run(...args) {
  const result = spawnSync('python3', ['-B', script, ...args], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test('D-431 co-listed setup and finish stay distinct, and lone Kneebar is unchanged', () => {
  const result = run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Ran 10 tests/);
  assert.match(result.output, /D-431 corpus: \d+ menu rows; 1 approved co-listed seat; lone Kneebar unchanged/);
  console.log('D-431: 10 Python contracts passed; 1 approved seat; positive whole-corpus coverage.');
});

test('restoring variant-first for co-listed moves kills the named Aoki resolver test', () => {
  const result = run('--mutate-variant-first');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /FAIL: test_colisted_aoki_setup_and_finish_remain_distinct/);
  assert.match(result.output, /FAILED \(failures=1\)/);
  console.log('Variant-first mutant killed by test_colisted_aoki_setup_and_finish_remain_distinct.');
});
