import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("clip curation metadata validates optional fields, front order and hub roles", () => {
  const result = spawnSync("python3", ["-B", "tests/clip_data_contract.py"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
