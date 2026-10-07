// Offline bot guard, real Aoki regression and workflow wiring; no paid services.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

for (const suite of ['bot_queue_test.py', 'bot_aoki_test.py', 'bot_workflows_test.py']) {
  test(suite, () => {
    const result = spawnSync('python3', ['-B', `tests/${suite}`], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const count = result.stderr.match(/Ran (\d+) tests/)
    assert.ok(count && Number(count[1]) > 0, 'Python suite must report positive coverage')
    console.log(`${suite}: ${count[1]} cases checked`)
  })
}
