// Offline CLI regression: the committed default and the missing-file fallback must agree.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const resolver = join(root, 'scripts/_model.py')

test('content default and missing-file fallback both resolve to Opus 5.5', () => {
  const env = { ...process.env }
  delete env.BJJ_CLAUDE_MODEL
  const resolve = (script) => execFileSync('python3', ['-B', script, '--print', 'default'], {
    env, encoding: 'utf8',
  }).trim()
  assert.equal(resolve(resolver), 'claude-opus-5-5')
  const configured = readFileSync(join(root, 'models.env'), 'utf8').match(/^BJJ_CLAUDE_MODEL=(.+)$/m)?.[1]

  const isolated = mkdtempSync(join(tmpdir(), 'bjj-model-default-'))
  try {
    mkdirSync(join(isolated, 'scripts'))
    const copy = join(isolated, 'scripts/_model.py')
    copyFileSync(resolver, copy) // No models.env exists beside this copy: exercise the real fallback.
    const fallback = resolve(copy)
    assert.equal(fallback, 'claude-opus-5-5')
    assert.equal(configured, fallback, 'models.env must match the resolver fallback')
  } finally {
    rmSync(isolated, { recursive: true, force: true })
  }
})
