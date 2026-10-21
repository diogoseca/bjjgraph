// D-326 / CI 48be3a910 / D-332 controls on the served neural.js. Run after the positive journeys, under the
// shared FIFO lock. NEURAL_MUTANT_APP must be the neural.js served by NEURAL_MUTANT_CONFIG's private
// server; NEURAL_MUTANT_ONLY optionally selects controls by name. No rebuild, capture, source or
// baseline change is made, and the original bytes are restored after every control.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Script } from 'node:vm'

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
    [['this._execution.camera===!1&&this._execution.calmHeld&&', 'this._execution.camera===!1&&!1&&']], 'the catch keeps its framing through the escape'],
  // D-332 D2-B1: the window re-read every frame (the 105c5f110 code) instead of the pick's latch.
  ['calm-catch-latch-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*an escape picked just inside',
    [['this._execution.camera===!1&&this._execution.calmHeld&&', 'this._execution.camera===!1&&this._calmCatchHeld()&&']],
    'an escape picked inside the window keeps the catch framing to the landing'],
  // The intro's handover starts a fresh roll over a board staged during it (a shared-list read).
  ['intro-overrides-stage', 'defending-arrivals.spec.ts', 'a shared list link opens its defending item',
    [['this._refPage||this._staged!=null||this.startRoll()', 'this._refPage||this.startRoll()']], 'the other read role must be a reachable drawn canvas half'],
  // D-338: a saved Focus is read again by the layer seam (its reading* overrides hide the card).
  ['d338-saved-focus-layer-read', 'reading-mode.spec.ts', 'reading perspectives and Back retain canonical content without gameplay$',
    [['let t=xt[e];return!t||this.get(t,!0)!==!1', 'let t=xt[e];return!t||this.get(this.get("readingFocus",!1)?"reading"+t.slice(4):t,!0)!==!1']],
    'a saved Focus no longer hides the question'],
  // The follow-cam lifts the node against the reading band's edge again (two rest framings).
  ['reading-band-lift-restored', 'pane-layout.spec.ts', '1440px pane moves film, card, article',
    [['c.band||(a.lift={f:this.camFocus', '(a.lift={f:this.camFocus']], 127],   // back.node.y; moved from 125 by D-347's pane-layout:82 note
  // H46 (2026-10-21): landcard-modes:349 now waits for the defender's question before its press; the arrows must
  // still be what pages it (the defense mode dropped from the landing card's arrow branch).
  ['defense-arrows-lost', 'landcard-modes.spec.ts', 'the generic defending card pages its own deck with the same arrows',
    [['["land","attempt","defense"].includes(this._landMode)&&this._landPage!=null&&(n.key==="ArrowLeft"', '["land","attempt"].includes(this._landMode)&&this._landPage!=null&&(n.key==="ArrowLeft"']], 'arrows page the defender deck'],
  // D-352 (Delta 6): S1, a landing laid out with the article put away is live, so showing the article
  // mid-load publishes it pinned instead of holding it; and N1, the hand's half of D-351's hold.
  ['d352-book-rehold', 'article-sections.spec.ts', 'D-352: showing the article while its page loads',
    [['else if(!t)o.live=!0;else{', 'else if(!t);else{']], 'the live hand is never hidden again'],
  ['d351-hand-hold-removed', 'article-sections.spec.ts', 'D-351: an exchange whose article lands late',
    [['h==null||h.toggleAttribute("data-reader-pending",a>0);return l&&a<=0', 'h==null||h.toggleAttribute("data-reader-pending",!1);return l&&a<=0']], 'the new hand is shown once, at its final place'],
  // D-354 (Delta 8, B1): parts the reader adopted follow the pane's slide in the same frame.
  ['d354-pane-follow-lag', 'pane-keyboard.spec.ts', 'D-354: the landing deck and its arrows follow the pane',
    [[',this.uiShift!==s&&((r=this._reader)==null||r.layoutNow())', '']], 'the card and its arrows follow the pane in the same frame'],
  // D-354 (H95, H97): REAL BREAK from D-351. A hand the reader held starts its Win chance when it publishes.
  ['d354-held-hand-no-value', 'article-sections.spec.ts', 'D-354: a hand the reader held starts its Win chance',
    [['return l&&a<=0&&this._ensureGameValues(),a}_readerGraded(){', 'return a}_readerGraded(){']], 'the Win chance starts in the frame the held hand publishes'],
  // D-354 N1 (Delta 8): a play after the article rendered places the pinned film in its Videos slot first.
  ['d354-play-film-left-home', 'defending-landing.spec.ts', 'D-354 N1: a play after the article rendered',
    [['!==!1&&s.syncMedia(),this._expandedClip', '!==!1&&!1,this._expandedClip']], 'the playing film sits in the lifted Videos slot, with no empty slot under it'],
  // D-354 N3: the film's only remover ends the reader's media-home observation.
  ['d354-removed-film-observed', 'defending-landing.spec.ts', 'D-354 N3: a removed film',
    [['._ngRO.disconnect(),(e=this._reader)==null||e.resize.unobserve(this._landFilmEl);try{', '._ngRO.disconnect();try{']], 'the removed film is no longer observed by the reader'],
  // D-350b: the header's ZERO-overlap mutants (v1.219.0's noprelift / noahead), scripted so the frame filter is
  // shown not to carry their kills. noprelift: the arrival and the URL intro make no room for the rows.
  ['noprelift-roll-start', 'camera-continuity.spec.ts', 'camera continuity.*roll start: the intro and the staged arrival',
    [['_liftForLanding(e,t){let s=this.nodes&&this.nodes[t];', '_liftForLanding(e,t){return e;let s=this.nodes&&this.nodes[t];']], 'ZERO overlap roll start @'],
  ['noprelift-url-arrival', 'camera-continuity.spec.ts', 'camera continuity.*URL arrival: from the intro',
    [['_liftForLanding(e,t){let s=this.nodes&&this.nodes[t];', '_liftForLanding(e,t){return e;let s=this.nodes&&this.nodes[t];']], 'ZERO overlap URL arrival @'],
  // noahead: `_viewRect` ignores `ahead`, so a landing's band is not predicted before its rows mount.
  ['noahead-exchange-1440', 'camera-continuity.spec.ts', '1440px camera continuity.*an exchange lands on a new current node',
    [['e&&e.ahead!=null&&e.ahead!==!1&&(a=this._predictBottom(e.ahead),p=!0)', '!1&&(a=this._predictBottom(e.ahead),p=!0)']], 'ZERO overlap exchange @'],
  ['noahead-exchange-390', 'camera-continuity.spec.ts', '390px camera continuity.*an exchange lands on a new current node',
    [['e&&e.ahead!=null&&e.ahead!==!1&&(a=this._predictBottom(e.ahead),p=!0)', '!1&&(a=this._predictBottom(e.ahead),p=!0)']], 'ZERO overlap exchange @'],
]
const only = process.env.NEURAL_MUTANT_ONLY ? new RegExp(process.env.NEURAL_MUTANT_ONLY) : null
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
mkdirSync(out, { recursive: true })
const receipt = { original: hash(original), results: [] }
// D5-B2: a kill counts only against a GREEN unmutated baseline of the same spec and grep (once per pair).
const baselines = new Map()
const baseline = (spec, grep) => {
  const key = spec + '\n' + grep
  if (!baselines.has(key)) {
    writeFileSync(app, original)
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--reporter=list'], { cwd: root, encoding: 'utf8', timeout: 240000 })
    baselines.set(key, { green: run.status === 0 && / passed /.test(run.stdout || ''), exit: run.status })
  }
  return baselines.get(key)
}
try {
  for (const [name, spec, grep, edits, claim] of controls.filter(([n]) => !only || only.test(n))) {
    const base = baseline(spec, grep)
    let mutant = source
    for (const [from, to] of edits) {
      if (mutant.split(from).length !== 2) throw Error(name + ': the target moved: ' + from)
      mutant = mutant.replace(from, to)
    }
    // D-354: a mutant that does not parse never boots; its run waited out the 240s timeout, orphaned
    // the private server, and every later baseline read red on the busy port. Refuse it here instead.
    try { new Script(mutant) } catch (e) { throw Error(name + ': the mutant does not parse: ' + e.message) }
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
    const killed = base.green && run.status === 1 && failures.length === 1 && failures[0].status === 'failed' && errors.length > 0 &&
      errors.every(e => /expect\(/.test(text(e)) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(text(e))) &&
      errors.some(e => typeof claim === 'number' ? e.location?.line === claim : text(e).includes(claim))
    receipt.results.push({ name, spec, baseline: base, mutant: hash(mutant), exit: run.status, killed, errors: errors.map(e => text(e).split('\n')[0]) })
    console.log(name + ': ' + (!base.green ? 'BASELINE RED, not counted' : killed ? 'killed at its claim' : 'NOT KILLED'))
  }
} finally {
  writeFileSync(app, original)
  receipt.restored = hash(readFileSync(app)) === receipt.original
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (!receipt.restored || receipt.results.some(r => !r.killed)) process.exitCode = 1
