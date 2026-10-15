import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("layout strength resolves graph slugs and fails loudly on missing content (stdlib only)", () => {
  const result = spawnSync("python3", ["-B", "-S", "tests/enrich_graph_strength_test.py"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log(result.stderr.trim());
});
