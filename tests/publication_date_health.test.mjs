// The real broken build's 901 millisecond timestamps occupied ONE day. These controls
// pin all three per-field checks, including modified's dormant new Date() fallback.
// A healthy publication distribution must not mask a collapsed modification field.
// Real pre-fix and fixed-build controls are additionally recorded in the investigation;
// the @curated journey runs this validator over the complete emitted tree on deploys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(collapsed) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "publication-health-"));
  try {
    const rows = {};
    for (let i = 0; i < 6100; i++) {
      const published = new Date(
        Date.UTC(2024, 9, 5) + (i % 20) * 40 * 86400000,
      ).toISOString();
      const modified = new Date(
        Date.UTC(2026, 4, 26) + (i % 17) * 7 * 86400000,
      ).toISOString();
      const clock = new Date(Date.UTC(2026, 8, 20) + (i % 901)).toISOString();
      rows[`${i}.html`] = {
        "property=article:published_time":
          collapsed === "published" ? clock : published,
        "jsonld[0].datePublished":
          collapsed === "published" ? clock : published,
        "property=article:modified_time":
          collapsed === "modified" ? clock : modified,
        "jsonld[0].dateModified": collapsed === "modified" ? clock : modified,
      };
    }
    const capture = path.join(tmp, "dates.json");
    fs.writeFileSync(capture, JSON.stringify(rows));
    return spawnSync(
      "python3",
      ["scripts/check_publication_dates.py", "--captured-dates", capture],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("date health accepts separate healthy publication and modification distributions", () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS all per-field/);
});

for (const [kind, fields] of [
  ["published", ["article:published_time", "datePublished"]],
  ["modified", ["article:modified_time", "dateModified"]],
]) {
  test(`all three ${kind} checks reject clock clustering despite 901 distinct values`, () => {
    const result = run(kind);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    for (const field of fields) {
      for (const metric of ["DISTINCT_DAYS", "SPAN_DAYS", "MAX_DAY_SHARE"]) {
        assert.ok(
          result.stdout.includes(`FAIL ${field} ${metric}`),
          result.stdout,
        );
      }
    }
    const other = kind === "published" ? "modified" : "published";
    assert.ok(
      !result.stdout.includes(`FAIL article:${other}_time`),
      result.stdout,
    );
    assert.ok(!result.stdout.includes("PAGE_COVERAGE"), result.stdout);
  });
}
