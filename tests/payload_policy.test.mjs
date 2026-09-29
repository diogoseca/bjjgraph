/**
 * THE THREE-BAND PAYLOAD POLICY, PINNED IN BOTH LANGUAGES.
 *
 * Two gates enforce one policy and neither can call the other's language:
 *   · scripts/check_payload_budget.py   — `npm run validate:payload`, both deploys, `npm run build`
 *   · e2e/journeys/payload-first-hand.spec.ts — the @curated browser gate
 * so the band logic exists twice, in scripts/_payload_policy.py and scripts/_payload_policy.js.
 * CLAUDE.md §6.5's standing remedy for two names for one value is "a test pins them equal", and
 * this is that test. It runs in `npm run test:units`, so it fires on a push to dev — before any
 * Playwright and a deploy earlier than the browser gate could speak.
 *
 * WHAT IT ASSERTS, and why each assertion is here rather than implied:
 *   1. every case in tests/artifacts/payload_policy_cases.json gets the verdict the table says
 *      it should — the table is the SPEC, not merely a diff surface;
 *   2. the two implementations agree case for case — a diff alone would pass happily if both
 *      sides were wrong in the same direction, hence (1);
 *   3. positive coverage (CLAUDE.md §6.6): all four verdict classes are exercised, and the case
 *      count is asserted non-zero. A table that silently emptied would otherwise report clean;
 *   4. the SHIPPED policy file loads, validates, and is claimed by exactly the two gates that
 *      exist — so deleting a metric, or orphaning one onto a gate that never runs, goes red here.
 *
 * NON-KILLS, recorded so nobody reads this spec as covering them (CLAUDE.md §6.3): it does not
 * measure a single byte of payload and does not run either gate. Whether check_payload_budget.py
 * feeds `evaluate` the right numbers, and whether the browser gate measures the right requests,
 * are not tested here.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createRequire } from "node:module"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const CASES = resolve(ROOT, "tests/artifacts/payload_policy_cases.json")
const POLICY = resolve(ROOT, "tests/artifacts/payload_policy.json")
const require = createRequire(import.meta.url)
const js = require(resolve(ROOT, "scripts/_payload_policy.js"))

const cases = JSON.parse(readFileSync(CASES, "utf8")).cases

/** Run one case through the JS side exactly as _selftest runs it through the python side. */
function jsVerdict(c) {
  try {
    js.validateSpec(c.name, c.spec)
    return js.evaluate(c.name, c.spec, c.value, c.delta_value).verdict
  } catch (e) {
    if (e instanceof js.PolicyError) return "policy-error"
    throw e
  }
}

test("the case table is non-empty and exercises every verdict class", () => {
  assert.ok(cases.length >= 20, `only ${cases.length} band cases — the table has been gutted`)
  const seen = new Set(cases.map((c) => c.expect))
  for (const v of ["pass", "warn", "fail", "policy-error"])
    assert.ok(seen.has(v), `no case expects "${v}" — that band is unexercised`)
  for (const c of cases) {
    assert.ok(c.why, `case ${c.name} carries no \`why\``)
    assert.ok(Number.isInteger(c.value) && Number.isInteger(c.delta_value), `case ${c.name}: bad inputs`)
  }
})

test("the JS implementation returns the verdict the table specifies", () => {
  const wrong = cases.filter((c) => jsVerdict(c) !== c.expect)
  assert.deepEqual(
    wrong.map((c) => `${c.name}: expected ${c.expect}, got ${jsVerdict(c)} (${c.why})`),
    [],
  )
})

test("the python implementation agrees with the JS one, case for case", () => {
  const out = execFileSync("python3", [resolve(ROOT, "scripts/_payload_policy.py"), "--selftest", CASES], {
    encoding: "utf8",
  })
  const py = out.trim().split("\n").map((l) => l.split("\t"))
  assert.equal(py.length, cases.length, "python emitted a different number of verdicts")
  const disagreements = []
  for (let i = 0; i < cases.length; i++) {
    const [name, verdict] = py[i]
    assert.equal(name, cases[i].name, `case order diverged at index ${i}`)
    const mine = jsVerdict(cases[i])
    if (verdict !== mine) disagreements.push(`${name}: python ${verdict} vs js ${mine}`)
    if (verdict !== cases[i].expect) disagreements.push(`${name}: python ${verdict} vs table ${cases[i].expect}`)
  }
  assert.deepEqual(disagreements, [])
})

test("the shipped policy file is valid and is claimed by the gates that exist", () => {
  const doc = js.load(POLICY)
  const names = Object.keys(doc.metrics)
  assert.ok(names.length >= 2, `policy covers ${names.length} metric(s); both gates need one`)
  const pyGate = js.metricsFor(doc, "scripts/check_payload_budget.py")
  const e2eGate = js.metricsFor(doc, "e2e/journeys/payload-first-hand.spec.ts")
  assert.deepEqual(Object.keys(pyGate), ["neural.eager_gzip_bytes"])
  assert.deepEqual(Object.keys(e2eGate), ["first_hand_gzip_bytes"])
  assert.equal(
    Object.keys(pyGate).length + Object.keys(e2eGate).length,
    names.length,
    "a policy metric is claimed by a gate that does not exist — nothing would enforce it",
  )
  for (const [name, spec] of Object.entries(doc.metrics)) {
    assert.ok(Number.isInteger(spec.baseline), `${name}: baseline is not an integer`)
    assert.ok(spec.baseline_ref, `${name}: baseline carries no ref — the growth log needs one`)
    assert.ok(spec.baseline_reason, `${name}: baseline carries no reason`)
    assert.ok(
      spec.baseline <= spec.action,
      `${name}: the committed baseline is already over the action threshold`,
    )
  }
})
