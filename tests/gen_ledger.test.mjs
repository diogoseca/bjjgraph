// The `e2e:gen` red baseline is judged by e2e/gen-ledger.mjs (read by the runner through
// e2e/gen-ledger-reporter.ts). Each branch of the verdict has a test here that goes red if the
// branch is deleted, plus a static check of the REAL ledger's known-red rows.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { judgeGenRun, KNOWN_RED_FIELDS } from "../e2e/gen-ledger.mjs"

const F = "e2e/gen/a.spec.ts"
const knownRow = (extra = {}) => ({
  id: "gen-x",
  file: F,
  status: "known-red",
  known_red: { test: "T", reason: "r", owner: "o", since: "abc (v1)", ...extra },
})
const acc = { id: "gen-y", file: "e2e/gen/b.spec.ts", status: "accepted" }
const out = (file, title, outcome, error = "") => ({ file, title, outcome, error })

test("an all-green run passes and says what it looked at", () => {
  const r = judgeGenRun([acc], [out("e2e/gen/b.spec.ts", "U", "expected")])
  assert.deepEqual(r.problems, [])
  assert.match(r.summary, /ran 1 tests in 1 files: 1 green, 0 red/)
})

test("a red the ledger does not name fails the run", () => {
  const r = judgeGenRun([acc], [out("e2e/gen/b.spec.ts", "U", "unexpected", "boom")])
  assert.equal(r.problems.length, 1)
  assert.match(r.problems[0], /^RED, NOT NAMED IN THE LEDGER: e2e\/gen\/b\.spec\.ts › U$/)
})

test("a red named by file AND exact title is tolerated, and counted", () => {
  const r = judgeGenRun([knownRow()], [out(F, "T", "unexpected", "Error: x")])
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.named, ["gen-x (owner: o)"])
})

test("a known-red names ONE test: another red test in the same file is still unnamed", () => {
  const r = judgeGenRun([knownRow()], [out(F, "T", "unexpected"), out(F, "OTHER", "unexpected")])
  assert.equal(r.problems.length, 1)
  assert.match(r.problems[0], /NOT NAMED.*› OTHER$/)
})

test("a known-red that PASSED fails the run: the entry is stale", () => {
  const r = judgeGenRun([knownRow()], [out(F, "T", "expected")])
  assert.equal(r.problems.length, 1)
  assert.match(r.problems[0], /^KNOWN-RED gen-x PASSED/)
})

test("a known-red red for a DIFFERENT reason fails the run", () => {
  const rows = [knownRow({ failure: 'beat "caught" not seen' })]
  assert.deepEqual(judgeGenRun(rows, [out(F, "T", "unexpected", 'Error: beat "caught" not seen within 20000ms')]).problems, [])
  const r = judgeGenRun(rows, [out(F, "T", "unexpected", "TypeError: undefined")])
  assert.equal(r.problems.length, 1)
  assert.match(r.problems[0], /red for a DIFFERENT reason/)
})

test("a known-red row without its reason/owner/since/test is itself a failure", () => {
  for (const f of KNOWN_RED_FIELDS) {
    const row = knownRow()
    delete row.known_red[f]
    const r = judgeGenRun([row], [out(F, "T", "unexpected")])
    assert.ok(r.problems.some((p) => p.includes(`known_red.${f}`)), `missing ${f} must be reported`)
  }
})

test("zero tests ran is a failure, not a pass", () => {
  assert.match(judgeGenRun([acc], []).problems.join(), /ran ZERO tests/)
  assert.match(judgeGenRun([acc], [out(F, "T", "skipped")]).problems.join(), /ran ZERO tests/)
})

test("an error outside any test fails the run", () => {
  const r = judgeGenRun([acc], [out("e2e/gen/b.spec.ts", "U", "expected")], ["webServer died"])
  assert.match(r.problems.join(), /error outside any test: webServer died/)
})

test("the REAL ledger: every known-red row is complete, names an existing file, and a test title that file declares", () => {
  const ledger = JSON.parse(readFileSync(new URL("../e2e/gen/ledger.json", import.meta.url), "utf8"))
  const rows = ledger.tests.filter((r) => r.status === "known-red")
  let checked = 0
  for (const r of rows) {
    for (const f of KNOWN_RED_FIELDS) assert.ok(r.known_red && r.known_red[f], `${r.id}: known_red.${f} missing`)
    const path = new URL("../" + r.file, import.meta.url)
    assert.ok(existsSync(path), `${r.id}: ${r.file} does not exist`)
    const src = readFileSync(path, "utf8")
    assert.ok(src.includes(JSON.stringify(r.known_red.test).slice(1, -1)), `${r.id}: no test titled ${JSON.stringify(r.known_red.test)} in ${r.file}`)
    checked++
  }
  const statuses = new Set(ledger.tests.map((r) => r.status))
  for (const s of statuses) assert.ok(["accepted", "known-red", "quarantined-red"].includes(s), `unknown ledger status ${s}`)
  console.log(`gen ledger: ${ledger.tests.length} rows, ${checked} known-red row(s) checked against their spec files`)
})
