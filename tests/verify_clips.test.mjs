// These fixtures execute the real Python verifier. Offline outcomes include dead,
// transient, zero-coverage, deadline, signal and hard-kill cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
test("clip reports are read-only, paced, complete-or-red, and durable on failure", () => {
  const result = spawnSync("python3", ["-B", "tests/verify_clips_test.py"], {
    cwd: root, encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const coverage = result.stdout.match(/verify_clips fixture coverage: (\d+) tests, (\d+) skipped/);
  assert.ok(coverage, "the Python suite reports positive coverage");
  assert.ok(Number(coverage[1]) > 0, "zero fixtures cannot pass");
  assert.equal(Number(coverage[2]), 0, "no silently skipped fixtures");
  console.log(coverage[0]);
});
