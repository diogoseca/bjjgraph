// RDR546: the Cloudflare parser port, its upstream vectors and the brief's mutants run in the
// complete unit replay, without a built site.
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("check_redirect_limits.py is Cloudflare's parser and fails where Cloudflare drops rules", () => {
  const result = spawnSync("python3", ["-B", "tests/redirect_limits_test.py", "-v"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  })
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, output)
  const cases = Number(output.match(/Ran (\d+) tests?/)?.[1] || 0)
  assert.ok(cases > 0, "the redirect-limit cases did not run")
  assert.doesNotMatch(output, /skipped=\d+/, "a skipped parser check cannot pass CI")
  const reds = output.match(/\[redirect-limits\] RED .*/g) || []
  assert.ok(reds.length >= 6, `the brief's mutants must each print their kill; saw ${reds.length}`)
  console.log(`redirect limits: ${cases} Python cases; ${reds.length} mutant kills`)
})
