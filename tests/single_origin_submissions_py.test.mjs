import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const options = { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" }

test("six single-origin approvals are exact and stale rows fail", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, output)
  const cases = Number(output.match(/Ran (\d+) tests?/)?.[1] || 0)
  assert.ok(cases > 0, "single-origin approval tests did not run")
  assert.doesNotMatch(output, /skipped=\d+/)
  assert.match(output, /Single-origin submission approvals: 6\/6 matched/)
  console.log(`single-origin approvals: ${cases} Python cases asserted; 6/6 live rows matched`)
})

test("blanket single-origin acceptance makes the named negative control red", () => {
  const result = spawnSync("python3", ["-B", "tests/single_origin_submissions_test.py",
    "--mutate-accept-rule", "SingleOriginSubmissions.test_unlisted_single_origin_is_blocking", "-v"], options)
  const output = result.stdout + result.stderr
  assert.equal(result.status, 1, output)
  assert.match(output, /FAIL: test_unlisted_single_origin_is_blocking/)
  assert.match(output, /FAILED \(failures=1\)/)
  console.log("accept-all mutant rejected: test_unlisted_single_origin_is_blocking is red")
})
