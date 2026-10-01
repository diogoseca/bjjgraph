import { readFileSync } from "node:fs"
import { resolve, relative } from "node:path"
import type { FullResult, Reporter, TestCase, TestResult, TestError } from "@playwright/test/reporter"
import { judgeGenRun } from "./gen-ledger.mjs"

/**
 * THE GENERATED SUITE'S RED BASELINE, READ BY THE RUNNER (v1.206.3).
 *
 * The verdict of an `e2e:gen` run is decided here, from `e2e/gen/ledger.json` and what actually
 * ran — the rules and the reason they exist are in `e2e/gen-ledger.mjs` (pure, unit-tested by
 * `tests/gen_ledger.test.mjs`). In short:
 *   - a red test the ledger does not name                  → FAIL (it is yours, CLAUDE.md §8)
 *   - a named known-red test that PASSED                   → FAIL (stale entry: flip it to accepted)
 *   - a named known-red red with a DIFFERENT message       → FAIL (it broke again, for a new reason)
 *   - zero tests ran, or an error outside any test          → FAIL (absence is not a pass, §6.6)
 *   - otherwise                                            → PASS, even if Playwright counted the named reds
 * It always prints one positive coverage line, so "checked and clean" never reads like "never looked".
 *
 * Only tests that are in THIS run are judged, so a positional filter still works:
 * `npm run e2e:gen -- gen/foo.spec.ts` judges foo alone.
 */

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "")

export default class GenLedgerReporter implements Reporter {
  private repoRoot = resolve(__dirname, "..")
  private outcomes: { file: string; title: string; outcome: string; error: string }[] = []
  private outsideErrors: string[] = []

  onError(error: TestError) {
    this.outsideErrors.push(strip(error.message || String(error.value || "error")).split("\n")[0])
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // outcome() is final only after the last retry; this suite runs retries:0, so it is final here.
    const file = relative(this.repoRoot, test.location.file).split("\\").join("/")
    const error = (result.errors || []).map((e) => strip(e.message || "")).join("\n")
    this.outcomes.push({ file, title: test.title, outcome: test.outcome(), error })
  }

  async onEnd(result: FullResult) {
    const rows = JSON.parse(readFileSync(resolve(this.repoRoot, "e2e/gen/ledger.json"), "utf8")).tests || []
    const { problems, summary, named } = judgeGenRun(rows, this.outcomes, this.outsideErrors)
    console.log("\n" + summary + (named.length ? `\n[gen-ledger] known-red, tolerated by name: ${named.join(" · ")}` : ""))
    if (problems.length) {
      console.log(`[gen-ledger] FAIL — ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`)
      return { status: "failed" as const }
    }
    if (result.status === "failed" || result.status === "passed") {
      console.log("[gen-ledger] PASS — every red test is named in e2e/gen/ledger.json with its reason and owner")
      return { status: "passed" as const }
    }
    return undefined // timedout / interrupted keep Playwright's own verdict
  }

  printsToStdio() {
    return false
  }
}
