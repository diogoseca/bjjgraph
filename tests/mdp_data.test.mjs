import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Collected by the existing test:units glob, including CI. No optional dependency
// or missing-built-corpus skip can turn this producer gate green.
test('immutable MDP producer: pure mechanics, identities, failures and lossless transport', () => {
  const file = fileURLToPath(new URL('./mdp_data_test.py', import.meta.url));
  const out = execFileSync('python3', ['-B', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  assert.equal(out, '');
  console.log('MDP producer: 16 Python contract tests executed (failures propagate).');
});
