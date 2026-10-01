// THE GENERATED SUITE'S RED BASELINE — the verdict, as a pure function (v1.206.3).
//
// `e2e/gen-ledger-reporter.ts` feeds this every test outcome of an `e2e:gen` run and the rows of
// `e2e/gen/ledger.json`; it returns the problems that fail the run. Pure so that
// `tests/gen_ledger.test.mjs` can drive every branch without a browser (CLAUDE.md §6.3: mutate
// every claim — each branch below has a test that turns red if it is deleted).
//
// WHY IT EXISTS. Until v1.206.3 the known-red set lived only in prose ("the same 13 names"). Prose
// cannot be checked, so it drifted 13 → 14 → 40 while every one of the 40 was an "accepted" ledger
// row and no workflow ran the suite (CLAUDE.md §6.7: "put the baseline where the RUNNER reads it").
//
// A ledger row tolerates ONE red test, by name, with a reason and an owner:
//   "status": "known-red",
//   "known_red": { "test": "<exact Playwright test title>", "reason": "…", "owner": "…",
//                  "since": "<sha> (vX.Y.Z)", "failure": "<substring of the error it is red WITH>" }
// `failure` is optional but recommended: without it a known-red that breaks again for a NEW reason
// is still tolerated.

/** @typedef {{ file: string, title: string, outcome: string, error: string }} Outcome */

export const KNOWN_RED_FIELDS = ["test", "reason", "owner", "since"]

/**
 * @param {Array<any>} rows  ledger.tests
 * @param {Outcome[]} outcomes  one per test that the run collected (file is repo-relative)
 * @param {string[]} outsideErrors  errors Playwright reported outside any test
 * @returns {{ problems: string[], summary: string, named: string[] }}
 */
export function judgeGenRun(rows, outcomes, outsideErrors = []) {
  const problems = []
  const known = new Map() // "file::title" → row
  for (const r of rows || []) {
    if (r.status !== "known-red") continue
    const k = r.known_red
    const missing = KNOWN_RED_FIELDS.filter((f) => !k || !k[f])
    if (missing.length) {
      problems.push(`ledger ${r.id}: status known-red is missing known_red.${missing.join(", known_red.")}`)
      continue
    }
    known.set(`${r.file}::${k.test}`, r)
  }

  const ran = outcomes.filter((o) => o.outcome !== "skipped")
  const red = ran.filter((o) => o.outcome === "unexpected" || o.outcome === "flaky")
  const green = ran.filter((o) => o.outcome === "expected")
  const named = []
  for (const o of red) {
    const row = known.get(`${o.file}::${o.title}`)
    if (!row) {
      problems.push(`RED, NOT NAMED IN THE LEDGER: ${o.file} › ${o.title}`)
      continue
    }
    const want = row.known_red.failure
    if (want && !String(o.error || "").includes(want)) {
      problems.push(
        `KNOWN-RED ${row.id} is red for a DIFFERENT reason: expected the error to contain ` +
          `${JSON.stringify(want)}, got ${JSON.stringify(String(o.error || "").split("\n")[0])}`,
      )
      continue
    }
    named.push(`${row.id} (owner: ${row.known_red.owner})`)
  }
  for (const o of green) {
    const row = known.get(`${o.file}::${o.title}`)
    if (row) problems.push(`KNOWN-RED ${row.id} PASSED — the entry is stale: flip it to "accepted" and drop known_red`)
  }
  if (ran.length === 0) problems.push("ran ZERO tests — a run that looked at nothing is not a pass")
  for (const e of outsideErrors) problems.push(`error outside any test: ${e}`)

  const files = new Set(ran.map((o) => o.file)).size
  const summary =
    `[gen-ledger] ran ${ran.length} tests in ${files} files: ${green.length} green, ${red.length} red ` +
    `(${named.length} named known-red, ${red.length - named.length} not), ` +
    `${known.size} known-red row(s) in the ledger`
  return { problems, summary, named }
}
