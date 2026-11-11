// U123 (owner, 2026-11-11, "take care of it"): free roam puts the article and its index away. One control per claim of
// e2e/journeys/free-roam-article.spec.ts and legend-search.spec.ts's free-roam half, each run against a GREEN unmutated baseline of
// the same spec and grep, and counted only when the run fails once, on an assertion (never a timeout), whose text names the claim.
// The latch lives in the eager app (`_putReaderAway`), so every control edits the SERVED, minified neural.js in place, as
// tests/artifacts/neural_app_mutants.mjs does (a source edit cannot be rebuilt alone: game-bundles.mjs refuses an app whose gameplay
// hash moved after the model metadata was emitted). Each target must occur exactly once, so a rebuild that renames a local fails
// loudly here; retarget it from the built file. The served bundle is restored after every control and checked at the end. Run under the shared build lock, after the journeys
// pass, with a private config serving this worktree's source/public:
//   TMPDIR=/home/user/tmp-pw PW_PORT=8203 FREE_ROAM_MUTANT_CONFIG=e2e/playwright.private.config.ts FREE_ROAM_MUTANT_OUT=<scratch> \
//     node tests/artifacts/free_roam_mutants.mjs          (FREE_ROAM_MUTANT_ONLY=<regex> selects controls)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Script } from 'node:vm'

const root = resolve(import.meta.dirname, '../..')
const config = process.env.FREE_ROAM_MUTANT_CONFIG, out = process.env.FREE_ROAM_MUTANT_OUT
if (!config || !out) throw Error('Name a private config and a scratch output directory')
mkdirSync(out, { recursive: true })
const served = resolve(root, 'source/public/static/neural/app/neural.js'), servedBytes = readFileSync(served), bundle = servedBytes.toString()
const once = (text, from, to, name) => {
  const n = text.split(from).length - 1
  if (n !== 1) throw Error(name + ': the target occurs ' + n + ' times: ' + from)
  return text.replace(from, to)
}
const spec = 'free-roam-article.spec.ts'
// the minified forms (v1.256.2 + this change): the lift in _readArticle's then, the backstop in _readerHold, the set in _enterRoam
const SET = 'this.clearEngagement(),this._putReaderAway(!0),this.setPaused(!0)', UNSET = 'this.clearEngagement(),this.setPaused(!0)'
const LIFT = 'return this._putReaderAway(!t&&!!this._roam),(r=this._reader)==null?void 0:r.open(n)', NOLIFT = 'return(r=this._reader)==null?void 0:r.open(n)'
const BACKSTOP = ',this._readerAway&&this._putReaderAway(o>0||this._landIdx==null),o}'
// [name, spec, grep, mutate(bundle), claim]
const controls = [
  // Claim 1: the article goes. _enterRoam no longer puts it away.
  ['no-put-away', spec, 'each way in.*\\(390, by touch\\)', s => once(s, SET, UNSET, 'no-put-away'),
    'free roam: the article is not on screen (the second tap)'],
  // Claim 1, "never opacity alone": faded, not hidden.
  ['faded-not-hidden', spec, 'each way in.*\\(1440, by mouse\\)', s => once(s, 't.root.style.visibility=e?"hidden":""', 't.root.style.opacity=e?"0":""', 'faded-not-hidden'),
    'free roam: the article is not on screen (the second tap)'],
  // Claim 1, the index: it keeps its box in free roam.
  ['index-stays', spec, 'each way in.*\\(1440, by touch\\)', s => once(s, ',this._readerTocEl&&(this._readerTocEl.style.display=e?"none":"")', '', 'index-stays'),
    'free roam: the index is not on screen (the second tap)'],
  // Claim 2: the key reads the screen, and the hidden article keeps its box, so `_mapAlone` must read visibility.
  ['key-reads-boxes-only', spec, 'each way in.*\\(390, by mouse\\)', s => once(s, 'i.bottom>0&&i.top<e&&getComputedStyle(s).visibility!=="hidden"', 'i.bottom>0&&i.top<e', 'key-reads-boxes-only'),
    'free roam is the map alone: the key shows (the second tap)'],
  // Claim 3: nothing lifts the latch.
  ['nothing-lifts', spec, 'each way in.*\\(390, by mouse\\)', s => once(once(s, LIFT, NOLIFT, 'nothing-lifts'), BACKSTOP, ',o}', 'nothing-lifts'),
    'landing again: the article returns'],
  // Claim 3, the place: putting away forgets the article (the "clear" design), so the reader holds nothing to come back to.
  ['put-away-forgets', spec, 'each way in.*\\(1440, by mouse\\)', s => once(s, '_putReaderAway(e){this._readerAway=e;', '_putReaderAway(e){this._readerAway=e;e&&this._reader&&(this._reader.path=null);', 'put-away-forgets'),
    'free roam puts the article away, not cleared'],
  // ...and the return renders it again (the place lost on the way back, not on the way out).
  ['return-renders-again', spec, 'each way in.*\\(390, by touch\\)', s => once(s, '_putReaderAway(e){this._readerAway=e;', '_putReaderAway(e){!e&&this._readerAway&&this._reader&&(this._reader.path=null),this._readerAway=e;', 'return-renders-again'),
    'landing again: the same article returns, not rendered again'],
  // Claim 4: an article opened on purpose lifts the latch (only the backstop left, and a page has no landing to publish).
  ['open-keeps-away', spec, 'each way in.*\\(1440, by touch\\)', s => once(s, LIFT, NOLIFT, 'open-keeps-away'),
    'an article opened on purpose from free roam shows'],
  // Claim 5, the reference law: a page no longer holds the board in `_roam`, so the background tap roams it away.
  ['page-roams', spec, 'a page stays.*1440, by mouse\\)', s => once(s, 'this._played=!1,this._roam=!0,this.endZoom=!1', 'this._played=!1,this.endZoom=!1', 'page-roams'),
    'a page stays: the background tap leaves its article on screen'],
  // The late article: a request that reaches the reader in free roam shows the ended landing's article anyway.
  ['late-article-shows', spec, 'arrives after free roam began', s => once(s, 'this._putReaderAway(!t&&!!this._roam)', 'this._putReaderAway(!1)', 'late-article-shows'),
    'free roam: the article is not on screen (a late article)'],
  // ...and a late render builds a new index, which only the backstop's repaint keeps away.
  ['repaint-lost', spec, 'arrives after free roam began', s => once(s, BACKSTOP, ',o}', 'repaint-lost'),
    'free roam: the article is not on screen (a late article)'],
  // legend-search's free-roam half: the key comes back in free roam because the article is away.
  ['legend-no-put-away', 'legend-search.spec.ts', 'nowhere a node is revealed \\(1440', s => once(s, SET, UNSET, 'legend-no-put-away'),
    'premise: free roam, the card, the film and the article off the screen'],
]
// NOT A CONTROL, recorded: the backstop's lift (a landing that publishes is never hidden) is reachable only by a landing that asks
// the reader for nothing after free roam, and every way back today asks; removing the lift alone changes nothing a journey sees.
const only = process.env.FREE_ROAM_MUTANT_ONLY ? new RegExp(process.env.FREE_ROAM_MUTANT_ONLY) : null
const hash = b => createHash('sha256').update(b).digest('hex')
const restore = () => writeFileSync(served, servedBytes)
const runSpec = (specName, grep, tag, extra = []) => {
  const report = resolve(out, tag + '.json')
  const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, 'journeys/' + specName.replace(/\./g, '\\.') + '$', '--grep', grep, ...extra, '--output', resolve(out, tag + '-results'), '--reporter=list,json'],
    { cwd: root, encoding: 'utf8', timeout: 400000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report } })
  writeFileSync(resolve(out, tag + '.log'), (run.stdout || '') + (run.stderr || ''))
  const results = []
  try { const visit = s => { for (const sp of s.specs || []) for (const t of sp.tests) for (const r of t.results) results.push(r); for (const c of s.suites || []) visit(c) }; visit(JSON.parse(readFileSync(report, 'utf8'))) } catch {}
  return { exit: run.status, results }
}
const baselines = new Map()
const baseline = (specName, grep) => {
  const key = specName + '\n' + grep
  if (!baselines.has(key)) {
    restore()
    const r = runSpec(specName, grep, 'baseline-' + baselines.size)
    baselines.set(key, { green: r.exit === 0 && r.results.length > 0 && r.results.every(x => x.status === 'passed'), exit: r.exit, ran: r.results.length })
  }
  return baselines.get(key)
}
const receipt = { served: hash(servedBytes), results: [] }
const text = e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, '')
try {
  for (const [name, specName, grep, mutate, claim] of controls.filter(([n]) => !only || only.test(n))) {
    const base = baseline(specName, grep)
    restore()
    const mutant = mutate(bundle)
    try { new Script(mutant) } catch (e) { throw Error(name + ': the mutant does not parse: ' + e.message) }
    writeFileSync(served, mutant)
    const r = runSpec(specName, grep, name, ['--max-failures=1'])
    restore()
    const failed = r.results.filter(x => x.status !== 'passed'), errors = failed.flatMap(x => x.errors || [])
    const killed = base.green && r.exit === 1 && failed.length === 1 && failed[0].status === 'failed' && errors.length > 0 &&
      errors.every(e => /expect\(/.test(text(e)) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(text(e))) && errors.some(e => text(e).includes(claim))
    receipt.results.push({ name, spec: specName, grep, claim, baseline: base, exit: r.exit, killed, errors: errors.map(e => text(e).split('\n')[0]) })
    writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
    console.log(name + ': ' + (!base.green ? 'BASELINE RED, not counted' : killed ? 'killed at its claim' : 'NOT KILLED') + (killed ? '' : ' ' + JSON.stringify(errors.map(e => text(e).split('\n')[0]))))
  }
} finally {
  restore()
  receipt.restored = hash(readFileSync(served)) === hash(servedBytes)
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (!receipt.restored || receipt.results.some(r => !r.killed)) process.exitCode = 1
