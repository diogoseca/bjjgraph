import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const options = { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" }

test("reviewed single origins and short trees are exact and stale rows fail", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, output)
  const cases = Number(output.match(/Ran (\d+) tests?/)?.[1] || 0)
  assert.ok(cases > 0, "single-origin approval tests did not run")
  assert.doesNotMatch(output, /skipped=\d+/)
  // ORCH-399 + explicit two-origin authorization; D-362 Top is now live too.
  assert.match(output, /Reviewed content exceptions: 10\/10 matched/)
  assert.match(output, /'single_origin': 8, 'short_decision_tree': 2/)
  console.log(`reviewed content exceptions: ${cases} Python cases asserted; 10/10 live rows matched`)
})

test("blanket acceptance makes the named origin negative control red", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py",
    "--mutate-accept-rule", "SingleOriginSubmissions.test_listed_but_not_own_origin_is_blocking", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 1, output)
  assert.match(output, /FAIL: test_listed_but_not_own_origin_is_blocking/)
  assert.match(output, /FAILED \(failures=1\)/)
  console.log("accept-all mutant rejected: test_listed_but_not_own_origin_is_blocking is red")
})

test("blanket acceptance makes the named tree-count negative control red", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py",
    "--mutate-accept-rule", "ShortDecisionTrees.test_wrong_count_is_blocking_even_when_it_meets_shared_floor", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 1, output)
  assert.match(output, /FAIL: test_wrong_count_is_blocking_even_when_it_meets_shared_floor/)
  assert.match(output, /FAILED \(failures=1\)/)
  console.log("accept-all mutant rejected: test_wrong_count_is_blocking_even_when_it_meets_shared_floor is red")
})

test("bypassing the Markdown exception hook makes both named regeneration cases red", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py",
    "--mutate-markdown-exception-path",
    "MarkdownSingleOrigins.test_listed_single_origin_regenerates_hub_and_role_pages",
    "MarkdownShortDecisionTrees.test_listed_short_tree_regenerates_hub_and_role_pages", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 1, output)
  assert.match(output, /FAIL: test_listed_single_origin_regenerates_hub_and_role_pages/)
  assert.match(output, /FAIL: test_listed_short_tree_regenerates_hub_and_role_pages/)
  assert.match(output, /FAILED \(failures=2\)/)
  console.log("Markdown hook bypass mutant rejected: both named regeneration cases are red")
})
