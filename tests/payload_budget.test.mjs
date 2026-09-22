// TAG-FLOOR exercises the real payload gate over an owned emitted-tree fixture, not content/.
// Counts exclude the unconditional tags/index.html and include nested named tag routes.
// This gates archetype presence, not tag content, authored-tag completeness, or build provenance.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const owned = JSON.parse(fs.readFileSync(new URL('./artifacts/payload_tag_floor.json', import.meta.url)))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
function fixture(t, { htmlDirectory = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-tag-floor-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const write = (rel, bytes) => {
    const p = path.join(root, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, bytes)
  }
  for (const script of ['check_payload_budget.py', 'emit_fingerprint.py', '_payload_policy.py'])
    write(`scripts/${script}`, fs.readFileSync(path.join(ROOT, 'scripts', script)))
  for (const rel of owned.html_paths) write(`source/public/${rel}`, owned.html)
  for (const [rel, bytes] of Object.entries(owned.other_files)) write(`source/public/${rel}`, bytes)
  for (const rel of htmlDirectory ? owned.directories : []) fs.mkdirSync(path.join(root, 'source/public', rel), { recursive: true })
  const budgetPath = path.join(root, 'tests/artifacts/budget_site.json')
  const budget = {
    _meta: { format: 2, floors_note: 'Owned fixture: preserve every deliberate floor', tag_routes_floor_note: 'Owned fixture tag floor' },
    floors: { ...owned.floors }, bundles: {}, pages: {}, html_total_bytes: 100000,
  }
  const saveBudget = () => write('tests/artifacts/budget_site.json', JSON.stringify(budget))
  saveBudget()
  write('tests/artifacts/payload_policy.json', JSON.stringify({ format: 1, metrics: {
    'neural.eager_gzip_bytes': { gate: 'scripts/check_payload_budget.py', target: 100, action: 200, delta_cap: 100, baseline: 0 },
  } }))
  const run = (...args) => {
    const r = spawnSync('python3', ['-B', path.join(root, 'scripts/check_payload_budget.py'), '--jobs', '1', ...args], { encoding: 'utf8', timeout: 30000 })
    assert.ifError(r.error)
    return { status: r.status, out: r.stdout + r.stderr }
  }
  const named = owned.named_tag_routes.map((rel) => path.join(root, 'source/public', rel))
  return { root, write, budget, saveBudget, budgetPath, named, run }
}
function coverage(r, html, tags) {
  assert.ok(r.out.includes(`tier-0 coverage: 5 floor checks over ${html} HTML files; named tag routes=${tags}`), r.out)
}

test('coverage summary rejects excess, deficient, absent and duplicated count reports', () => {
  const line = '  · tier-0 coverage: 5 floor checks over 6 HTML files; named tag routes=2'
  coverage({ out: line }, 6, 2)
  for (const wrong of [
    line.replace('routes=2', 'routes=20'),
    line.replace('routes=2', 'routes=1'),
    line.replace('5 floor', '50 floor'),
    line.replace('6 HTML', '60 HTML'),
    '', `${line}\n${line}`,
  ]) assert.throws(() => coverage({ out: wrong }, 6, 2), assert.AssertionError)
})

test('tag census counts exactly two named routes and excludes index, lookalikes, assets and directories', (t) => {
  const f = fixture(t, { htmlDirectory: true })
  assert.equal(owned.html_paths.length, 6)
  assert.equal(owned.named_tag_routes.length, 2)
  const r = f.run()
  assert.equal(r.status, 0, r.out)
  coverage(r, 6, 2)
  assert.match(r.out, /tag_routes\s+2\s+floor\s+2\s+ok/)
})

test('suppressing named tag pages alone is red and names tag_routes; byte-restored fixture is green', (t) => {
  const f = fixture(t)
  const saved = f.named.map((p) => [p, fs.readFileSync(p)])
  for (const [p] of saved) fs.unlinkSync(p)
  const red = f.run()
  assert.equal(red.status, 1, red.out)
  assert.match(red.out, /tag_routes: 0 is BELOW the floor 2/)
  coverage(red, 4, 0)
  assert.ok(fs.existsSync(path.join(f.root, 'source/public/tags/index.html')))
  for (const [p, bytes] of saved) {
    fs.writeFileSync(p, bytes)
    assert.equal(sha(fs.readFileSync(p)), sha(bytes))
  }
  const green = f.run()
  assert.equal(green.status, 0, green.out)
  coverage(green, 6, 2)
})

test('tag routes are a floor: fewer is red, exact and more are green', (t) => {
  const f = fixture(t)
  fs.unlinkSync(f.named[0])
  const red = f.run()
  assert.equal(red.status, 1, red.out)
  assert.match(red.out, /tag_routes: 1 is BELOW the floor 2/)
  coverage(red, 5, 1)
  f.write('source/public/tags/grappling.html', owned.html)
  f.write('source/public/tags/extra.html', owned.html)
  const green = f.run()
  assert.equal(green.status, 0, green.out)
  coverage(green, 7, 3)
})

test('missing or zero tag floor fails without replacing the four existing floors', (t) => {
  const f = fixture(t)
  for (const value of [undefined, 0]) {
    f.budget.floors.tag_routes = value
    f.saveBudget()
    const before = fs.readFileSync(f.budgetPath)
    const r = f.run()
    assert.equal(r.status, 1, r.out)
    assert.match(r.out, /tag_routes:.*UNSET.*--set-floors/)
    assert.match(r.out, /html_file_count\s+6\s+floor\s+2\s+ok/)
    coverage(r, 6, 2)
    assert.equal(sha(fs.readFileSync(f.budgetPath)), sha(before))
  }
})

test('--update preserves all committed floors and both floor notes exactly', (t) => {
  const f = fixture(t)
  const r = f.run('--update')
  assert.equal(r.status, 0, r.out)
  const after = JSON.parse(fs.readFileSync(f.budgetPath))
  assert.deepEqual(after.floors, f.budget.floors)
  assert.equal(after._meta.floors_note, f.budget._meta.floors_note)
  assert.equal(after._meta.tag_routes_floor_note, f.budget._meta.tag_routes_floor_note)
  coverage(r, 6, 2)
})

test('--set-floors requires a reason, refuses tag extinction, and seeds a positive selected floor', (t) => {
  const f = fixture(t)
  let before = fs.readFileSync(f.budgetPath)
  let r = f.run('--set-floors', '--floor', 'tag_routes')
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /--set-floors requires --reason/)
  assert.equal(sha(fs.readFileSync(f.budgetPath)), sha(before))
  for (const p of f.named) fs.unlinkSync(p)
  r = f.run('--set-floors', '--floor', 'tag_routes', '--reason', 'Owned suppression control')
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /refusing.*tag_routes.*0/i)
  assert.equal(sha(fs.readFileSync(f.budgetPath)), sha(before))
  f.write('source/public/tags/grappling.html', owned.html)
  r = f.run('--set-floors', '--floor', 'tag_routes', '--reason', 'Owned one-route control')
  assert.equal(r.status, 0, r.out)
  const after = JSON.parse(fs.readFileSync(f.budgetPath))
  assert.deepEqual(after.floors, { ...owned.floors, tag_routes: 1 })
  assert.match(after._meta.tag_routes_floor_note, /X-09.*tags:.*frontmatter/)
  assert.match(after._meta.tag_routes_floor_note, /tags\/index\.html/)
  assert.match(after._meta.tag_routes_floor_note, /Owned one-route control/)
})
