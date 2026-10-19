// D-326 / CI 48be3a910 controls on the served neural.js. Run after the positive journeys, under the
// shared FIFO lock. NEURAL_MUTANT_APP must be the neural.js served by NEURAL_MUTANT_CONFIG's private
// server; NEURAL_MUTANT_ONLY optionally selects controls by name. No rebuild, capture, source or
// baseline change is made, and the original bytes are restored after every control.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const app = process.env.NEURAL_MUTANT_APP, config = process.env.NEURAL_MUTANT_CONFIG, out = process.env.NEURAL_MUTANT_OUT
if (!app || !config || !out) throw Error('Name the served app, private config and evidence directory')
const original = readFileSync(app), source = original.toString()
// [name, spec, grep, [[minified target, replacement]...], claim: message text or the asserting line]
const controls = [
  // D-326: the notice keeps showing while the move executes.
  ['reward-hold-lost', 'roll-execution.spec.ts', 'reward notice yields',
    [['this.holdChallengeReward&&this.holdChallengeReward(),', ''], ['if(this._execution||this.__ngDestroyed)return;', 'if(this.__ngDestroyed)return;']],
    'the showing notice yields to the executing move'],
  // A calm reading catch's lease window: an escape picked inside it re-zooms again.
  ['calm-catch-window-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*an escape: the catch keeps its own framing',
    [['this.now<(this._calmCatchUntil||0)', '!1']], 'the catch keeps its framing through the escape'],
  // The intro's handover starts a fresh roll over a board staged during it (a shared-list read).
  ['intro-overrides-stage', 'defending-arrivals.spec.ts', 'a shared list link opens its defending item',
    [['this._refPage||this._staged!=null||this.startRoll()', 'this._refPage||this.startRoll()']], 'the other read role must be a reachable drawn canvas half'],
  // The follow-cam lifts the node against the reading band's edge again (two rest framings).
  ['reading-band-lift-restored', 'pane-layout.spec.ts', '1440px pane moves film, card, article',
    [['c.band||(a.lift={f:this.camFocus', '(a.lift={f:this.camFocus']], 130],
]
const only = process.env.NEURAL_MUTANT_ONLY ? new RegExp(process.env.NEURAL_MUTANT_ONLY) : null
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
mkdirSync(out, { recursive: true })
const receipt = { original: hash(original), results: [] }
try {
  for (const [name, spec, grep, edits, claim] of controls.filter(([n]) => !only || only.test(n))) {
    let mutant = source
    for (const [from, to] of edits) {
      if (mutant.split(from).length !== 2) throw Error(name + ': the target moved: ' + from)
      mutant = mutant.replace(from, to)
    }
    writeFileSync(app, mutant)
    const report = resolve(out, name + '.json')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--max-failures=1', '--reporter=list,json'], {
      cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
    })
    writeFileSync(app, original)
    writeFileSync(resolve(out, name + '.log'), (run.stdout || '') + (run.stderr || ''))
    const failures = []
    const visit = suite => {
      for (const s of suite.specs || []) for (const t of s.tests) for (const r of t.results) if (r.status !== 'passed') failures.push(r)
      for (const child of suite.suites || []) visit(child)
    }
    try { visit(JSON.parse(readFileSync(report, 'utf8'))) } catch {}
    const errors = failures.flatMap(r => r.errors || [])
    const text = e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, '')
    // A wait timeout is infrastructure/fixture failure, never a mutation kill.
    const killed = run.status === 1 && failures.length === 1 && failures[0].status === 'failed' && errors.length > 0 &&
      errors.every(e => /expect\(/.test(text(e)) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(text(e))) &&
      errors.some(e => typeof claim === 'number' ? e.location?.line === claim : text(e).includes(claim))
    receipt.results.push({ name, spec, mutant: hash(mutant), exit: run.status, killed, errors: errors.map(e => text(e).split('\n')[0]) })
    console.log(name + ': ' + (killed ? 'killed at its claim' : 'NOT KILLED'))
  }
} finally {
  writeFileSync(app, original)
  receipt.restored = hash(readFileSync(app)) === receipt.original
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (!receipt.restored || receipt.results.some(r => !r.killed)) process.exitCode = 1
