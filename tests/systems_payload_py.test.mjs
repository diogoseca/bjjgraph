// The Python gates of the Systems demand route and the payload gate's deferred/retired accounting.
// Until v1.207.0 nothing ran these two files — no workflow step and no wrapper — so they were notes,
// not gates (CLAUDE.md §6.4). `test:units` collects this wrapper, so both now run in CI.
// In CI a skipped Python case is a FAILURE, never a quiet pass: test_actual_corpus_exact needs the
// emitted library, and CI emits it before the unit suite (the promised-deps rule, tests/_deps_promised.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const file of ['tests/test_systems_demand.py', 'tests/payload_worker_core_test.py']) {
  test(file, () => {
    const result = spawnSync('python3', ['-B', file, '-v'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
    const out = result.stdout + result.stderr;
    assert.equal(result.status, 0, out);
    const ran = Number((out.match(/Ran (\d+) tests?/) || [])[1] || 0);
    assert.ok(ran > 0, file + ' ran no tests');
    if (process.env.CI) assert.doesNotMatch(out, /skipped=\d+/, file + ': a skipped case is a failure in CI\n' + out);
    console.log(`${file}: ${ran} Python cases${/skipped=(\d+)/.test(out) ? ', ' + out.match(/skipped=(\d+)/)[1] + ' skipped (local only)' : ''}`);
  });
}
