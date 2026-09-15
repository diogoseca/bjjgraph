import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('system course rendering, verification filters, and referral stamping', () => {
  const result = spawnSync('python3', ['tests/system_affiliates.py'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
