/**
 * NOT check_build_fingerprint.py (V's emitted-tree gate): this checks agreement of three step lists.
 * Drives the real CLI over isolated manifests/workflows; no emitter or golden is modified.
 * Mutant claims: one-chain additions/removals/reorder/duplicate loss, command/cwd changes,
 * empty chains, unsupported shell, missing deploy-only checks, disabled steps, missing PyYAML.
 * Non-kills: does not infer arbitrary shell programs, Actions internals, or emitted-byte parity.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const gate = resolve('scripts/check_build_chains.py')
const shared = ['node emit.mjs', 'node forward.mjs', 'node share.mjs', 'python3 scripts/apply_affiliate_ref.py', 'python3 scripts/regenerate_agent_discovery.py', 'python3 scripts/apply_affiliate_ref.py', 'python3 scripts/check_payload_budget.py']
const extras = ['cd source && python3 ../scripts/check_seo_parity.py --artifact-only && cd ..', 'python3 scripts/check_systems_payload.py', 'python3 scripts/check_affiliate_surface.py --built', 'python3 scripts/check_analytics_surface.py', 'node scripts/check_analytics_nokey.mjs', 'npm run test:curated']
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'build-chains-'))
  mkdirSync(join(root, '.github/workflows'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  for (const command of [...shared, ...extras]) {
    const match = command.match(/python3 (?:\.\.\/)?(scripts\/[^ ]+\.py)/)
    if (match) writeFileSync(join(root, match[1]), 'import sys\n')
  }
  const pkg = { scripts: { build: shared.join(' && '), 'test:curated': 'node curated.mjs' } }
  const workflows = Object.fromEntries(['deploy.yaml', 'deploy-dev.yaml'].map(name => [name, { jobs: { deploy: { steps: [
    { name: 'Build Quartz', run: [...shared, ...extras].join('\n') },
    { uses: 'cloudflare/wrangler-action@pinned', with: { command: 'pages deploy source/public' } },
  ] } } }]))
  function run() {
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
    for (const [name, workflow] of Object.entries(workflows)) writeFileSync(join(root, '.github/workflows', name), JSON.stringify(workflow))
    const r = spawnSync('python3', [gate, '--root', root], { encoding: 'utf8' })
    return { status: r.status, output: r.stdout + r.stderr }
  }
  try { fn({ pkg, workflows, run }) } finally { rmSync(root, { recursive: true, force: true }) }
}
const step = (w, name) => w[name].jobs.deploy.steps[0]
function red(r, pattern) { assert.equal(r.status, 1, r.output); assert.match(r.output, pattern) }
// Authored fixture: seven shared commands and six single-command deploy gates.
// Compare complete lines so 70 cannot satisfy an expected count of 7.
const fixtureChainSummaries = [
  'deploy.yaml: compared 7 local / 7 deploy steps; 6 required deploy-only gates (6 expanded commands)',
  'deploy-dev.yaml: compared 7 local / 7 deploy steps; 6 required deploy-only gates (6 expanded commands)',
]
function assertChainFixtureCounts(output) {
  const summaries = output.split(/\r?\n/).filter(line => line.includes(': compared '))
  assert.deepEqual(summaries, fixtureChainSummaries)
}
test('matching expanded chains report exact counts for BOTH deploys', () => fixture(({run}) => {
  const r = run(); assert.equal(r.status, 0, r.output)
  assertChainFixtureCounts(r.output)
}))
test('chain count control rejects deficient, excess and duplicate summaries', () => {
  const output = fixtureChainSummaries.join('\n')
  assertChainFixtureCounts(output)
  for (const [before, after] of [
    ['compared 7 local', 'compared 6 local'],
    ['compared 7 local', 'compared 70 local'],
    ['/ 7 deploy', '/ 6 deploy'],
    ['/ 7 deploy', '/ 70 deploy'],
    ['6 required', '5 required'],
    ['6 required', '60 required'],
    ['(6 expanded', '(5 expanded'],
    ['(6 expanded', '(60 expanded'],
  ]) {
    assert.equal(output.split(before).length - 1, 2, `missing count-control anchor: ${before}`)
    assert.throws(() => assertChainFixtureCounts(output.replaceAll(before, after)), assert.AssertionError)
  }
  assert.throws(() => assertChainFixtureCounts(fixtureChainSummaries[0]), assert.AssertionError)
  assert.throws(() => assertChainFixtureCounts(output + '\n' + fixtureChainSummaries[0]), assert.AssertionError)
})
for (const name of ['deploy.yaml', 'deploy-dev.yaml']) {
  test(`${name}: missing shared command is red`, () => fixture(({workflows,run}) => {
    step(workflows,name).run = step(workflows,name).run.replace('node forward.mjs\n', '')
    red(run(), /divergence/)
  }))
  test(`${name}: extra deployment command is red`, () => fixture(({workflows,run}) => {
    step(workflows,name).run += '\nnode new-emitter.mjs'; red(run(), /new-emitter/)
  }))
  test(`${name}: reordered commands are red`, () => fixture(({workflows,run}) => {
    step(workflows,name).run = step(workflows,name).run.replace('node forward.mjs\nnode share.mjs', 'node share.mjs\nnode forward.mjs')
    red(run(), /divergence/)
  }))
  test(`${name}: losing second affiliate pass is red`, () => fixture(({workflows,run}) => {
    const s = step(workflows,name); s.run = s.run.replace('python3 scripts/apply_affiliate_ref.py\n', '')
    red(run(), /affiliate/)
  }))
  test(`${name}: missing deploy-only gate is red`, () => fixture(({workflows,run}) => {
    const s = step(workflows,name); s.run = s.run.replace('python3 scripts/check_analytics_surface.py\n', '')
    red(run(), /required deploy-only/)
  }))
  test(`${name}: cwd divergence is red`, () => fixture(({workflows,run}) => {
    step(workflows,name)['working-directory'] = './source'; red(run(), /cwd|package.json/)
  }))
  test(`${name}: conditional build is red`, () => fixture(({workflows,run}) => {
    step(workflows,name).if = 'false'; red(run(), /conditional/)
  }))
}
test('local-only new build step is red', () => fixture(({pkg,run}) => { pkg.scripts.build += ' && node replacement.mjs'; red(run(), /replacement/) }))
test('empty local chain fails closed', () => fixture(({pkg,run}) => { pkg.scripts.build = ''; red(run(), /empty|zero/) }))
test('missing workflow fails closed', () => fixture(({workflows,run}) => { workflows['deploy-dev.yaml'] = {}; red(run(), /jobs/) }))
test('empty deploy chain fails closed', () => fixture(({workflows,run}) => { step(workflows,'deploy.yaml').run = ''; red(run(), /empty|zero/) }))
test('npm aliases expand without hiding their added commands', () => fixture(({pkg,run}) => {
  pkg.scripts.forward = 'node forward.mjs'; pkg.scripts.build = pkg.scripts.build.replace('node forward.mjs', 'npm run forward')
  assert.equal(run().status, 0); pkg.scripts.forward += ' && node forgotten.mjs'; red(run(), /forgotten/)
}))
test('npm pre/post hooks participate', () => fixture(({pkg,run}) => { pkg.scripts.prebuild = 'node forgotten.mjs'; red(run(), /forgotten/) }))
test('npm alias cycles fail closed', () => fixture(({pkg,run}) => { pkg.scripts.build = 'npm run build'; red(run(), /cycle/) }))
test('unsupported shell never silently disappears', () => fixture(({pkg,run}) => { pkg.scripts.build += ' || true'; red(run(), /unsupported shell/) }))
test('new command between affiliate passes fails even in all chains', () => fixture(({pkg,workflows,run}) => {
  pkg.scripts.build = pkg.scripts.build.replace('python3 scripts/regenerate_agent_discovery.py', 'node interloper.mjs && python3 scripts/regenerate_agent_discovery.py')
  for (const name of Object.keys(workflows)) step(workflows,name).run = step(workflows,name).run.replace('python3 scripts/regenerate_agent_discovery.py', 'node interloper.mjs\npython3 scripts/regenerate_agent_discovery.py')
  red(run(), /affiliate interval/)
}))
test('absent PyYAML is an explicit hard failure', () => {
  const r = spawnSync('python3', ['-S', gate], {encoding:'utf8'})
  assert.equal(r.status, 1, r.stdout+r.stderr); assert.match(r.stderr, /PyYAML.*required/)
})

// Python provisioning: static workflow/npm entrypoints and literal Python paths in
// Node subprocess wrappers; dynamic -c/subprocess bodies remain disclosed exclusions.
function pythonProvisionFixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'python-provision-'))
  const write = (name, body) => {
    const path = join(root, name)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, body)
  }
  const workflow = { jobs: { check: { steps: [
    { run: 'python3 -m pip install PyYAML' },
    { run: 'python3 scripts/check.py' },
  ] } } }
  write('scripts/check.py', 'import sys\nimport yaml\n')
  write('package.json', JSON.stringify({scripts:{}}))
  function run() {
    write('.github/workflows/ci.yml', JSON.stringify(workflow))
    const program = `import importlib.util,json,pathlib,sys\nspec=importlib.util.spec_from_file_location('chains',sys.argv[1])\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\ntry:\n print(json.dumps(m.provisioning(pathlib.Path(sys.argv[2]))))\nexcept m.ContractError as e:\n print(e)\n sys.exit(1)\n`
    const r = spawnSync('python3', ['-B', '-c', program, gate, root], {encoding:'utf8'})
    return {status:r.status, output:r.stdout+r.stderr}
  }
  try { fn({root,write,workflow,run}) } finally {rmSync(root,{recursive:true,force:true})}
}
// One workflow/job invokes one file containing exactly `import sys` and `import
// yaml`: two import sites, one required distribution, and no excluded constructs.
const fixtureProvisionCounts = {
  workflows: 1, jobs: 1, entrypoints: 1, python_files: 1, imports: 2,
  third_party_imports: 1, node_wrappers: 0, excluded_inline: 0, optional_imports: 0,
}
function assertProvisionFixtureCounts(output, expected = fixtureProvisionCounts) {
  const jsonLines = output.split(/\r?\n/).filter(line => line.startsWith('{'))
  assert.equal(jsonLines.length, 1, output)
  assert.deepEqual(JSON.parse(jsonLines[0]), expected)
}
test('Python provisioning: exact workflow/script/import coverage', () => pythonProvisionFixture(({run}) => {
  const r=run(); assert.equal(r.status,0,r.output)
  assertProvisionFixtureCounts(r.output)
}))
test('Python provisioning: count control rejects deficient and excess JSON values', () => {
  assertProvisionFixtureCounts(JSON.stringify(fixtureProvisionCounts))
  for (const [field, expected] of Object.entries(fixtureProvisionCounts)) {
    for (const actual of new Set([expected - 1, expected + 1, expected ? expected * 10 : 10])) {
      const output = JSON.stringify({...fixtureProvisionCounts, [field]: actual})
      assert.throws(() => assertProvisionFixtureCounts(output), assert.AssertionError, `${field}: ${actual}`)
    }
  }
  const output = JSON.stringify(fixtureProvisionCounts)
  assert.throws(() => assertProvisionFixtureCounts(''), assert.AssertionError)
  assert.throws(() => assertProvisionFixtureCounts(output + '\n' + output), assert.AssertionError)
})
test('Python provisioning: missing, late and ignored pip installs fail', () => {
  for (const shape of ['missing','late','conditional','ignored','shell-conditional','echo']) pythonProvisionFixture(({workflow,run}) => {
    const steps=workflow.jobs.check.steps
    if(shape==='missing') steps.shift()
    if(shape==='late') steps.reverse()
    if(shape==='conditional') steps[0].if='false'
    if(shape==='ignored') steps[0]['continue-on-error']=true
    if(shape==='shell-conditional') steps[0].run='if false; then pip install PyYAML; fi'
    if(shape==='echo') steps[0].run='echo "pip install PyYAML"'
    red(run(), /PyYAML.*not provisioned|not provisioned.*PyYAML/)
  })
})
test('Python provisioning: same-step command order matters', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.check.steps=[{run:'pip install PyYAML && python3 scripts/check.py'}]
  assert.equal(run().status,0)
  workflow.jobs.check.steps=[{run:'python3 scripts/check.py && pip install PyYAML'}]
  red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
}))
test('Python provisioning: recursive local import requires its distribution', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/check.py','import helper\n')
  write('scripts/helper.py','import jinja2\n')
  red(run(),/jinja2.*not provisioned|not provisioned.*jinja2/)
  workflow.jobs.check.steps[0].run+=' jinja2'
  assert.equal(run().status,0)
}))
test('Python provisioning: unknown imports fail even when pip names match', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/check.py','import mystery_dependency\n')
  workflow.jobs.check.steps[0].run+=' mystery_dependency'
  red(run(),/unknown Python import.*mystery_dependency/)
}))
test('Python provisioning: missing literal Python script fails closed', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.check.steps[1].run='python3 scripts/missing.py'
  red(run(),/missing Python.*missing.py/)
}))
test('Python provisioning: root/source npm scripts, hooks and cwd expand', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('package.json',JSON.stringify({scripts:{probe:'cd source && npm run verify'}}))
  write('source/package.json',JSON.stringify({scripts:{preverify:'python3 ../scripts/check.py',verify:'node irrelevant.js'}}))
  workflow.jobs.check.steps[1].run='npm run probe'
  const r=run();assert.equal(r.status,0,r.output);assertProvisionFixtureCounts(r.output)
  workflow.jobs.check.steps.shift();red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
}))
test('Python provisioning: literal Python paths in Node test wrappers count', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('tests/wrapper.test.mjs',"import {spawnSync} from 'node:child_process'; const script=resolve('scripts/check.py'); spawnSync('python3',[script]);")
  workflow.jobs.check.steps[1].run='node --test tests/*.test.mjs'
  const r=run();assert.equal(r.status,0,r.output);assertProvisionFixtureCounts(r.output,{...fixtureProvisionCounts,node_wrappers:1})
  workflow.jobs.check.steps.shift();red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
}))
test('Python provisioning: dependencies never carry between jobs', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.install={steps:[workflow.jobs.check.steps.shift()]}
  red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
}))
test('Python provisioning: simple Python heredoc imports are checked', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.check.steps[1].run="python3 - <<'PY'\nimport yaml\nPY"
  assert.equal(run().status,0)
  workflow.jobs.check.steps.shift();red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
}))
test('Python provisioning: optional imports require a named reviewed exception', () => pythonProvisionFixture(({write,run}) => {
  write('scripts/check.py','try:\n import jinja2\nexcept ImportError:\n pass\n')
  red(run(),/jinja2.*not provisioned|not provisioned.*jinja2/)
}))
test('Python provisioning: zero Python coverage is a failure', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.check.steps=[{run:'echo no-python'}]
  red(run(),/zero.*Python|Python.*zero/)
}))

// The baseline is two named transformations over exact real command identities.
// Each has a surviving control plus a distinct third-divergence mutant.
function knownBaseline(f) {
  f.pkg.scripts.build = 'cd source && node quartz/bootstrap-cli.mjs build --concurrency 4 -d ../content && cd .. && ' + shared.slice(1).join(' && ').replace('node forward.mjs', 'node scripts/build_forward_components.mjs').replace('node share.mjs', 'node scripts/build_share_shell.mjs')
  for (const name of Object.keys(f.workflows)) {
    step(f.workflows,name).run = 'cd source && node quartz/bootstrap-cli.mjs build -d ../content && cd ..\n' + shared.slice(1).join('\n').replace('node forward.mjs\nnode share.mjs','node scripts/build_share_shell.mjs\nnode scripts/build_forward_components.mjs') + '\n' + extras.join('\n')
  }
}
test('two named baseline rows pass, without normalizing arbitrary differences', () => fixture(f => {
  knownBaseline(f); const r=f.run(); assert.equal(r.status,0,r.output)
  assert.match(r.output,/baseline implicit-four-workers/)
  assert.match(r.output,/baseline disjoint-forward-share-order/)
}))
for (const name of ['deploy.yaml','deploy-dev.yaml']) {
  test(`${name}: concurrency baseline does not tolerate an explicit two-worker mutant`, () => fixture(f => {
    knownBaseline(f); step(f.workflows,name).run=step(f.workflows,name).run.replace('build -d','build --concurrency 2 -d')
    red(f.run(),/divergence/)
  }))
  test(`${name}: order baseline does not hide a third emitter between share and Forward`, () => fixture(f => {
    knownBaseline(f); step(f.workflows,name).run=step(f.workflows,name).run.replace('node scripts/build_forward_components.mjs','node third-divergence.mjs\nnode scripts/build_forward_components.mjs')
    red(f.run(),/third-divergence/)
  }))
}
test('a new command BEFORE the known build boundary fails closed', () => fixture(f => {
  f.workflows['deploy.yaml'].jobs.deploy.steps.unshift({name:'new emitter',run:'node forgotten.mjs'})
  red(f.run(),/unreviewed preparation/)
}))
test('a non-Pages Wrangler action cannot hide later build steps', () => fixture(f => {
  f.workflows['deploy.yaml'].jobs.deploy.steps.splice(1,0,{uses:'cloudflare/wrangler-action@pin',with:{command:'deploy worker.js'}},{run:'node forgotten.mjs'})
  red(f.run(),/unreviewed action/)
}))
test('unknown local Actions cannot mutate the output invisibly', () => fixture(f => {
  f.workflows['deploy.yaml'].jobs.deploy.steps.splice(1,0,{uses:'./.github/actions/mutate-site'})
  red(f.run(),/unreviewed action/)
}))
test('workflow cwd is inherited even when a job overrides shell', () => fixture(f => {
  const w=f.workflows['deploy.yaml']; w.defaults={run:{'working-directory':'source'}}; w.jobs.deploy.defaults={run:{shell:'bash'}}
  red(f.run(),/cwd|package.json|escapes/)
}))
test('a deploy-only gate may not be smuggled into the affiliate interval', () => fixture(f => {
  const s=step(f.workflows,'deploy.yaml'); s.run=s.run.replace('\npython3 scripts/check_systems_payload.py','').replace('python3 scripts/regenerate_agent_discovery.py','python3 scripts/check_systems_payload.py\npython3 scripts/regenerate_agent_discovery.py')
  red(f.run(),/affiliate interval/)
}))
test('a deploy-only gate must run with its reviewed cwd', () => fixture(f => {
  const s=step(f.workflows,'deploy.yaml'); s.run=s.run.replace('python3 scripts/check_systems_payload.py','cd source && python3 ../scripts/check_systems_payload.py && cd ..')
  red(f.run(),/deploy-only gate cwd/)
}))
test('deployment gates must observe final output', () => fixture(f => {
  const s=step(f.workflows,'deploy.yaml'); s.run=s.run.replace('\npython3 scripts/check_systems_payload.py',''); s.run='python3 scripts/check_systems_payload.py\n'+s.run
  red(f.run(),/gate cwd\/order|before final/)
}))
test('npm install lifecycle hooks cannot add an invisible post-build emitter', () => fixture(f => {
  f.pkg.scripts.postinstall='node forgotten.mjs'
  f.workflows['deploy.yaml'].jobs.deploy.steps.splice(1,0,{name:'Install root dependencies (Playwright test runner)',run:'npm install'})
  red(f.run(),/forgotten/)
}))

test('Python provisioning: skipped shell installs cannot satisfy imports', () => {
  for (const body of ['false && pip install PyYAML\npython3 scripts/check.py', 'true || npm run deps\npython3 scripts/check.py']) pythonProvisionFixture(({write,workflow,run}) => {
    write('package.json',JSON.stringify({scripts:{deps:'pip install PyYAML'}}))
    workflow.jobs.check.steps=[{run:body}]
    red(run(),/PyYAML.*not provisioned|not provisioned.*PyYAML/)
  })
})
test('Python provisioning: cyclic import closure cannot leak between jobs', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/check.py','import helper\nimport yaml\n')
  write('scripts/helper.py','import check\n')
  workflow.jobs.other={steps:[{run:'python3 scripts/helper.py'}]}
  red(run(),/other.*PyYAML.*not provisioned/)
}))
test('Python provisioning: package initializer imports are checked', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/check.py','import localpkg.leaf\n')
  write('scripts/localpkg/__init__.py','import jinja2\n')
  write('scripts/localpkg/leaf.py','import sys\n')
  red(run(),/jinja2.*not provisioned/)
  workflow.jobs.check.steps[0].run+=' jinja2'
  assert.equal(run().status,0)
}))
test('Python provisioning: optional tqdm must retain its reviewed fallback', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/proofread_all_transitions.py','try:\n from tqdm import tqdm\nexcept ImportError:\n raise\n')
  workflow.jobs.check.steps[1].run='python3 scripts/proofread_all_transitions.py'
  red(run(),/tqdm.*not provisioned/)
}))
test('Python provisioning: nested workflow defaults preserve inherited cwd', () => pythonProvisionFixture(({write,workflow,run}) => {
  workflow.defaults={run:{'working-directory':'source'}}
  workflow.jobs.check.defaults={run:{shell:'bash'}}
  write('scripts/check.py','import sys\n')
  write('source/scripts/check.py','import jinja2\n')
  red(run(),/jinja2.*not provisioned/)
}))
test('Python provisioning: pip distribution aliases and module entrypoints', () => pythonProvisionFixture(({write,workflow,run}) => {
  write('scripts/check.py','import PIL\nimport sklearn\n')
  workflow.jobs.check.steps[0].run='pip install Pillow scikit-learn'
  assert.equal(run().status,0)
  workflow.jobs.check.steps[1].run='python3 -m pytest'
  red(run(),/pytest.*not provisioned/)
}))

test('Python provisioning: literal calls under env and Python options remain covered', () => {
  for(const command of ['env python3 scripts/check.py','python3 -W ignore scripts/check.py']) pythonProvisionFixture(({workflow,run}) => {
    workflow.jobs.check.steps[1].run=command
    const good=run();assert.equal(good.status,0,good.output)
    workflow.jobs.check.steps.shift();red(run(),/PyYAML.*not provisioned/)
  })
})
test('Python provisioning: unsupported npm prefix does not silently disappear', () => pythonProvisionFixture(({workflow,run}) => {
  workflow.jobs.check.steps[1].run='npm --prefix source run check'
  red(run(),/unsupported npm prefix/)
}))
