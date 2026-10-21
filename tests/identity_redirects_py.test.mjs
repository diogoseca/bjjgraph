// D-345: the published-source guard belongs in the complete unit replay, even without a built site.
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("identity retirement aliases and every frozen published redirect source", () => {
  const result = spawnSync("python3", ["-B", "tests/identity_redirects_test.py", "-v"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  })
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, output)
  const cases = Number(output.match(/Ran (\d+) tests?/)?.[1] || 0)
  assert.ok(cases > 0, "the published-redirect cases did not run")
  assert.doesNotMatch(output, /skipped=\d+/, "a skipped preservation check cannot pass CI")
  console.log(`identity redirects: ${cases} Python cases; ${output.match(/Published source census: .*/)?.[0]}`)
})
