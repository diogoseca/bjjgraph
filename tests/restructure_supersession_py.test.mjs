import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("approved restructure tables resist old calibration and detect drift", () => {
  const result = spawnSync("python3", ["-B", "tests/restructure_supersession_test.py", "-v"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  })
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, output)
  const cases = Number(output.match(/Ran (\d+) tests?/)?.[1] || 0)
  assert.ok(cases > 0, "the supersession and absence cases did not run")
  assert.doesNotMatch(output, /skipped=\d+/)
  console.log(`restructure supersession: ${cases} Python cases asserted`)
})
