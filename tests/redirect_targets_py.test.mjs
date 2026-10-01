// The redirect-target gate's Python cases (v1.212.7, OCREDIR1). `test:units` collects only
// tests/*.test.mjs, so without this wrapper tests/redirect_targets_test.py would be a note, not a
// gate (CLAUDE.md §6.4). It fails if the file ran no cases, and in CI a skipped case is a failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file = 'tests/redirect_targets_test.py';
test(file, () => {
  const result = spawnSync('python3', ['-B', file, '-v'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
  const out = result.stdout + result.stderr;
  assert.equal(result.status, 0, out);
  const ran = Number((out.match(/Ran (\d+) tests?/) || [])[1] || 0);
  assert.ok(ran > 0, file + ' ran no tests');
  if (process.env.CI) assert.doesNotMatch(out, /skipped=\d+/, file + ': a skipped case is a failure in CI\n' + out);
  console.log(`${file}: ${ran} Python cases`);
});
