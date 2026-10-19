// D-326 control. Run after the positive journey, under the shared FIFO lock.
// REWARD_MUTANT_APP must be the neural.js served by REWARD_MUTANT_CONFIG's
// private server. No rebuild, capture, source or baseline change is made.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const app = process.env.REWARD_MUTANT_APP, config = process.env.REWARD_MUTANT_CONFIG, out = process.env.REWARD_MUTANT_OUT
if (!app || !config || !out) throw Error('Name the served app, private config and evidence directory')
const original = readFileSync(app), source = original.toString()
// The notice keeps showing while the move executes: drop the hold and the wait.
const targets = ['this.holdChallengeReward&&this.holdChallengeReward(),', 'if(this._execution||this.__ngDestroyed)return;']
for (const t of targets) if (source.split(t).length !== 2) throw Error('The reward hold moved: ' + t)
const mutant = source.replace(targets[0], '').replace(targets[1], 'if(this.__ngDestroyed)return;')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
mkdirSync(out, { recursive: true })
const report = resolve(out, 'result.json')
const receipt = { name: 'reward-hold-lost', original: hash(original), mutant: hash(mutant), killed: false }
try {
  writeFileSync(app, mutant)
  const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config,
    'roll-execution.spec.ts', '--grep', 'reward notice yields', '--reporter=list,json'], {
    cwd: root, encoding: 'utf8', timeout: 90000,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
  })
  writeFileSync(resolve(out, 'run.log'), (run.stdout || '') + (run.stderr || ''))
  const results = []
  const visit = suite => {
    for (const spec of suite.specs || []) for (const test of spec.tests) results.push(...test.results)
    for (const child of suite.suites || []) visit(child)
  }
  try { visit(JSON.parse(readFileSync(report, 'utf8'))) } catch {}
  const errors = results.flatMap(r => (r.errors || []).map(e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, '')))
  // A wait timeout is infrastructure/fixture failure, never a mutation kill.
  receipt.killed = run.status === 1 && results.length === 1 && results[0].status === 'failed' &&
    errors.length > 0 && errors.every(e => /expect\(/.test(e) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(e)) &&
    errors.some(e => e.includes('the showing notice yields to the executing move'))
  Object.assign(receipt, { exit: run.status, errors })
} finally {
  writeFileSync(app, original)
  receipt.restored = hash(readFileSync(app)) === receipt.original
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
console.log(JSON.stringify(receipt, null, 2))
if (!receipt.killed || !receipt.restored) process.exitCode = 1
