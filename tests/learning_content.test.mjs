import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Learning source, schema, deferred dossiers and static pages preserve complete reading", () => {
  execFileSync("python3", ["-B", "tests/learning_content.py"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    stdio: "pipe",
  });
});
