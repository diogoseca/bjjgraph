// VID1 source mutants for e2e/journeys/video-viewer.spec.ts (manifest: tests/artifacts/video_viewer_mutants.json).
//   source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh <seat> "<job>" && \
//     TMPDIR=<roomy dir> node tests/artifacts/video_viewer_mutants.mjs <evidence dir> [only-regex]
// For each row: every anchor must occur exactly once (a stale anchor THROWS, CLAUDE.md §6.4); the mutant is built by
// `npm run dev:neural:app` (its regenerate:mdp re-pins the MDP manifest to the mutant's own app.src.jsx hash: a bare
// build.mjs refuses any edited app.src.jsx, "graph/gameplay changed after metadata emission") and copied into
// source/public; the named test must FAIL with the named assertion in its failure text, and the control
// must PASS, in one Playwright run on the core config's own port. The exact source bytes are restored and verified
// (sha256) after every row, and the clean bundle is rebuilt at the end; a chunk only a mutant emitted (its hashed
// game-worker-core) is then removed from both served trees, or the payload gate counts it as deferred weight.
// A zero-test run is a setup error, not a kill.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const out = process.argv[2], only = process.argv[3] ? new RegExp(process.argv[3]) : null
if (!out || out.startsWith('/tmp')) throw Error('Name an evidence directory outside /tmp')
if (!process.env.TMPDIR) throw Error('Set TMPDIR to a roomy directory (CLAUDE.md §6.4)')
mkdirSync(out, { recursive: true })
const manifest = JSON.parse(readFileSync(join(root, 'tests/artifacts/video_viewer_mutants.json'), 'utf8'))
const files = [...new Set(manifest.mutants.map(m => m.file || 'neural/src/app.src.jsx'))]
const original = Object.fromEntries(files.map(f => [f, readFileSync(join(root, f))]))
const sha = b => createHash('sha256').update(b).digest('hex')
const hashes = Object.fromEntries(files.map(f => [f, sha(original[f])]))

function restore() {
  for (const f of files) { writeFileSync(join(root, f), original[f]); if (sha(readFileSync(join(root, f))) !== hashes[f]) throw Error('restore failed: ' + f) }
}
const APP_DIRS = ['source/quartz/static/neural/app', 'source/public/static/neural/app']
function build(label) {
  const r = spawnSync('npm', ['run', 'dev:neural:app'], { cwd: root, encoding: 'utf8' })
  writeFileSync(join(out, label + '-build.log'), r.stdout + r.stderr)
  if (r.status !== 0) throw Error('build failed: ' + label)
}
function prune() {
  const keep = new Set(readdirSync(join(root, 'neural/dist')))
  for (const dir of APP_DIRS) for (const f of readdirSync(join(root, dir))) if (!keep.has(f)) {
    rmSync(join(root, dir, f)); console.log('pruned ' + dir + '/' + f)
  }
}
function flat(suites, acc = []) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) for (const t of spec.tests || []) {
      const r = t.results.at(-1) || {}
      acc.push({ title: spec.title, status: r.status, error: (r.errors || []).map(e => e.message || '').join('\n') })
    }
    flat(s.suites, acc)
  }
  return acc
}
function run(label, grep) {
  const json = join(out, label + '.json')
  const r = spawnSync('npx', ['playwright', 'test', '-c', 'e2e/playwright.config.ts', manifest.spec, '--grep', grep,
    '--reporter=json', '--output', join(out, 'tr-' + label)], { cwd: root, encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json } })
  writeFileSync(join(out, label + '.log'), (r.stdout || '') + (r.stderr || ''))
  const data = JSON.parse(readFileSync(json, 'utf8'))
  if (data.errors?.length) throw Error(label + ': run errors ' + JSON.stringify(data.errors).slice(0, 400))
  return flat(data.suites)
}

const results = []
try {
  for (const m of manifest.mutants) {
    if (only && !only.test(m.name)) continue
    restore()
    const file = m.file || 'neural/src/app.src.jsx'
    let src = original[file].toString()
    for (const [from, to] of m.edits) {
      const count = src.split(from).length - 1
      if (count !== 1) throw Error(`${m.name}: anchor found ${count} times, not once: ${from.slice(0, 80)}`)
      src = src.replace(from, () => to)
    }
    writeFileSync(join(root, file), src)
    build(m.name)
    const rows = run(m.name, `${m.test}|${m.control}`)
    const red = rows.filter(t => new RegExp(m.test).test(t.title)), green = rows.filter(t => new RegExp(m.control).test(t.title))
    const killed = red.length > 0 && red.every(t => t.status !== 'passed' && t.status !== 'skipped' && t.error.includes(m.assertion))
    const control = green.length > 0 && green.every(t => t.status === 'passed')
    results.push({ name: m.name, killed, control, red: red.map(t => [t.title, t.status, t.error.split('\n')[0].slice(0, 200)]), green: green.map(t => [t.title, t.status]) })
    console.log(`${m.name}: ${killed ? 'KILLED' : 'SURVIVED'} at ${red.length} test(s); control ${control ? 'green' : 'NOT GREEN'}`)
  }
} finally {
  restore(); build('restored'); prune()
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 1) + '\n')
}
const bad = results.filter(r => !r.killed || !r.control)
console.log(`${results.length - bad.length} of ${results.length} killed with a green control`)
process.exit(bad.length ? 1 : 0)
