// scripts/ci-local.sh (`npm run ci:validate`) replays ci-validate.yml's own `run:` steps. These cases
// pin what makes it a REPLAY rather than a hand-kept copy: it reads the workflow it is given, keeps
// its order, substitutes (out loud) only the steps that cannot run on a seat, stops at the first red,
// fails closed on what it cannot interpret, and never reports a clean pass for nothing.
// Runs with --list or tiny fixture workflows only: it never executes the real job (no recursion).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const run = (args, workflow) => spawnSync("bash", ["scripts/ci-local.sh", ...args], {
  encoding: "utf8", env: { ...process.env, ...(workflow ? { CI_LOCAL_WORKFLOW: workflow } : {}) },
});
const fixture = (yamlText) => {
  const dir = mkdtempSync(join(tmpdir(), "ci-local-"));
  const p = join(dir, "wf.yml");
  writeFileSync(p, yamlText);
  return p;
};
let asserted = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserted++; };

test("the real workflow: every step, in order, with the three substitutions named", () => {
  const r = run(["--list"]);
  ok(r.status === 0, r.stderr + r.stdout);
  const lines = r.stdout.split("\n").filter((l) => /^\s+\d+\. \[/.test(l));
  ok(lines.length >= 20, `a positive, plausible step count (${lines.length})`);
  const at = (name) => lines.findIndex((l) => l.includes(name));
  ok(at("Emit the neural payload") >= 0 && at("Emit the neural payload") < at("Pure unit suites"),
    "the workflow's own order: the payload emit stays above the unit suites");
  ok(/\[pip\] Install Python dependencies/.test(r.stdout), "pip install becomes an import check");
  ok(/\[npm\] Install source\/ dependencies/.test(r.stdout), "npm ci becomes a resolve check (never run into a shared donor)");
  // named, not resolved: CI's own shallow checkout has no origin/dev (PR #275's first run), and the
  // merge-base is resolved only when the step runs
  ok(/--baseline-ref HEAD\^1 -> the merge-base with origin\/dev/.test(r.stdout), "HEAD^1 becomes the merge-base, said out loud");
});

test("a workflow with nothing runnable is a failure, never a clean pass", () => {
  const r = run([], fixture("jobs:\n  j:\n    steps:\n      - uses: actions/checkout@v4\n"));
  ok(r.status === 1, r.stdout + r.stderr);
  ok(/zero runnable steps/.test(r.stdout + r.stderr), "and it says why");
});

test("it stops at the first red step, as GitHub does, and names it", () => {
  const r = run([], fixture("jobs:\n  j:\n    steps:\n      - name: green\n        run: \"true\"\n      - name: red\n        run: \"false\"\n      - name: after\n        run: echo SHOULD-NOT-RUN\n"));
  ok(r.status === 1, r.stdout);
  ok(/first red: red/.test(r.stdout), "names the step");
  ok(!/SHOULD-NOT-RUN/.test(r.stdout), "and runs nothing after it");
});

test("each step runs in its working-directory with its env, under bash -eo pipefail", () => {
  const r = run([], fixture("jobs:\n  j:\n    steps:\n      - name: wd and env\n        working-directory: tests\n        env:\n          FOO: bar\n        run: |\n          test \"$FOO\" = bar\n          test \"$(basename \"$PWD\")\" = tests\n          test \"$CI\" = true\n      - name: pipefail\n        run: \"false | true\"\n"));
  ok(r.status === 1, "a failing pipe stage fails the step: " + r.stdout);
  ok(/\[1\/2\] wd and env: ok/.test(r.stdout), "cwd, env and CI=true reached the step");
});

test("what it cannot interpret fails closed, by name", () => {
  const r = run([], fixture("jobs:\n  j:\n    steps:\n      - name: conditional\n        if: github.event_name == 'push'\n        run: \"true\"\n"));
  ok(r.status === 1, r.stdout);
  ok(/cannot replay a step `if:`/.test(r.stdout), "names the construct");
});

test.after(() => console.log(`ci-local: ${asserted} assertions`));
