// Shared static/live stamp verdict. No network: a permissive predicate must fail these cases.
// Mutant accepting max-age=14400 fails that header's assertion (v1.224.7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("the stamp carrier revalidates without any stale-serving directive", () => {
  const cases = [
    ["max-age=0, must-revalidate", true],
    ["public, MAX-AGE=0, MUST-REVALIDATE", true],
    ["public, max-age=14400, must-revalidate", false],
    ["max-age=0, must-revalidate, stale-while-revalidate=0", false],
    ["max-age=0, must-revalidate, stale-while-revalidate=300", false],
    ["max-age=0, must-revalidate, stale-if-error=300", false],
    ["max-age=14400, max-age=0, must-revalidate", false],
    ["max-age=0", false],
    ["", false],
    [null, false],
  ];
  const actual = JSON.parse(execFileSync("python3", ["-c", `
import json, sys
from scripts.check_headers_cache import stamp_uncached
print(json.dumps([stamp_uncached(h) for h in json.loads(sys.argv[1])]))
`, JSON.stringify(cases.map(([header]) => header))], { encoding: "utf8" }));
  assert.equal(actual.length, cases.length);
  cases.forEach(([header, expected], i) => assert.equal(actual[i], expected, `Cache-Control: ${header}`));
  console.log(`stamp cache predicate: ${cases.length} cases asserted`);
});
