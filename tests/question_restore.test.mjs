// CARD1 (v1.301.5): the content bot's `restore_questions` puts every existing flashcard question back verbatim (the cases are
// tests/question_restore.py's, on a recorded content file; the bot itself is never run here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("the content bot puts back every existing flashcard question the model changed (CARD1)", () => {
  const result = spawnSync("python3", ["-B", "tests/question_restore.py"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran 23 tests/, "premise: all twenty-three cases ran (twelve, CARD1-S2's six on ids, and R1's five)");
});
