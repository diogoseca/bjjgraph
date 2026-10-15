import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
for (const [name, script] of [
  ["content provenance excludes only the reading vault; real JSON and Markdown still fail", "tests/golden_provenance_test.py"],
  ["content provenance keeps capture, legacy, CLI and baseline protections", "scripts/golden_provenance_selftest.py"],
]) {
  test(name, () => {
    const result = spawnSync("python3", ["-B", "-S", script], { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    console.log((result.stdout + result.stderr).trim());
  });
}
