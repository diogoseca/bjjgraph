// scripts/ci-local.sh (`npm run ci:validate`) replays ci-validate.yml's own `run:` steps. These cases
// pin what makes it a REPLAY rather than a hand-kept copy: it reads the workflow it is given, keeps
// its order, substitutes (out loud) only the steps that cannot run on a seat, stops at the first red,
// fails closed on what it cannot interpret, and never reports a clean pass for nothing.
// Runs with --list or tiny fixture workflows only: it never executes the real job (no recursion).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const run = (args, workflow, env = {}) => spawnSync("bash", ["scripts/ci-local.sh", ...args], {
  encoding: "utf8", env: { ...process.env, ...(workflow ? { CI_LOCAL_WORKFLOW: workflow } : {}), ...env },
});
const fixture = (yamlText) => {
  const dir = mkdtempSync(join(tmpdir(), "ci-local-"));
  const p = join(dir, "wf.yml");
  writeFileSync(p, yamlText);
  return p;
};
let asserted = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserted++; };

test("the real workflow: every step, in order, with installer and baseline substitutions named", () => {
  const r = run(["--list"]);
  ok(r.status === 0, r.stderr + r.stdout);
  const lines = r.stdout.split("\n").filter((l) => /^\s+\d+\. \[/.test(l));
  ok(lines.length >= 20, `a positive, plausible step count (${lines.length})`);
  const at = (name) => lines.findIndex((l) => l.includes(name));
  ok(at("Emit the neural payload") >= 0 && at("Emit the neural payload") < at("Pure unit suites"),
    "the workflow's own order: the payload emit stays above the unit suites");
  ok(/\[pip\] Install Python dependencies/.test(r.stdout), "pip install becomes an import check");
  ok(/\[npm\] Install source\/ dependencies/.test(r.stdout), "npm ci becomes a resolve check (never run into a shared donor)");
  ok(/\[actionlint\] Install actionlint.*version check: 1\.7\.7/.test(r.stdout), "actionlint uses the workflow's version pin");
  ok(at("Install actionlint") < at("Check GitHub workflow") && at("Check GitHub workflow") < at("Pure unit suites"),
    "the real lint gate runs after provisioning and before units");
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

const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ci-actionlint-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test("actionlint installer replay checks the workflow pin, rejects missing/wrong binaries, and never downloads", (t) => {
  const dir = scratch(t);
  const binary = join(dir, "actionlint");
  writeFileSync(binary, '#!/usr/bin/env bash\nprintf "2.3.4\\n"\n', { mode: 0o755 });
  const downloaded = join(dir, "downloaded");
  writeFileSync(join(dir, "curl"), '#!/usr/bin/env bash\ntouch "$TEST_DOWNLOADED"\nexit 99\n', { mode: 0o755 });
  for (const [pin, tool, passes] of [["2.3.4", binary, true], ["9.9.9", binary, false], ["2.3.4", join(dir, "missing"), false]]) {
    const wf = fixture(`jobs:\n  j:\n    steps:\n      - name: install\n        env:\n          ACTIONLINT_VERSION: "${pin}"\n        run: bash scripts/install_actionlint.sh\n      - name: after\n        run: echo AFTER-INSTALL\n`);
    const r = run([], wf, { ACTIONLINT: tool, PATH: `${dir}:${process.env.PATH}`, TEST_DOWNLOADED: downloaded });
    ok(r.status === (passes ? 0 : 1), r.stdout + r.stderr);
    ok(r.stdout.includes("SUBSTITUTED actionlint install"), "installer substitution is explicit");
    ok(r.stdout.includes("AFTER-INSTALL") === passes, "a failed presence/version check stops the replay");
    ok(!existsSync(downloaded), "local replay never executes the download installer");
  }
});

test("actionlint installation verifies the archive checksum before extraction or execution", (t) => {
  const dir = scratch(t);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const archive = join(dir, "release.tar.gz");
  const executed = join(dir, "executed");
  writeFileSync(join(dir, "actionlint"), '#!/usr/bin/env bash\ntouch "$TEST_EXECUTED"\nprintf "1.7.7\\n"\n', { mode: 0o755 });
  const tar = spawnSync("tar", ["-czf", archive, "-C", dir, "actionlint"], { encoding: "utf8" });
  ok(tar.status === 0, tar.stderr);
  writeFileSync(join(bin, "curl"), '#!/usr/bin/env bash\nwhile (($#)); do\n  if [[ "$1" == --output ]]; then cp "$TEST_ARCHIVE" "$2"; exit; fi\n  shift\ndone\nexit 99\n', { mode: 0o755 });
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  for (const [checksum, passes] of [["0".repeat(64), false], [digest, true]]) {
    const githubPath = join(dir, "github-path");
    const r = spawnSync("bash", ["scripts/install_actionlint.sh"], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
        ACTIONLINT_VERSION: "1.7.7", ACTIONLINT_SHA256: checksum, RUNNER_TEMP: dir,
        GITHUB_PATH: githubPath, TEST_ARCHIVE: archive, TEST_EXECUTED: executed },
    });
    ok(r.status === (passes ? 0 : 1), r.stdout + r.stderr);
    ok(existsSync(executed) === passes, "only a verified archive's executable may run");
    ok(existsSync(githubPath) === passes, "only a verified install reaches GITHUB_PATH");
    if (passes) ok(existsSync(join(readFileSync(githubPath, "utf8").trim(), "actionlint")), "published install exists");
    else {
      ok(/checksum did NOT match/.test(r.stderr), "checksum mismatch fails explicitly");
      ok(readdirSync(dir).filter((name) => name.startsWith("actionlint.")).every((name) => !existsSync(join(dir, name, "actionlint"))),
        "an unverified archive is not extracted");
    }
  }
});

test("workflow lint counts both extensions, disables shellcheck, and propagates lint failures", (t) => {
  const dir = scratch(t);
  const workflows = join(dir, ".github/workflows");
  mkdirSync(workflows, { recursive: true });
  for (const name of ["a.yml", "b.yaml", "ignored.txt"]) writeFileSync(join(workflows, name), "fixture\n");
  const binary = join(dir, "actionlint");
  const args = join(dir, "args");
  writeFileSync(binary, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$TEST_ARGS"\nexit "$TEST_EXIT"\n', { mode: 0o755 });
  for (const code of [0, 1]) {
    const r = spawnSync("bash", [resolve("scripts/lint_workflows.sh")], {
      cwd: dir, encoding: "utf8", env: { ...process.env, ACTIONLINT: binary, TEST_ARGS: args, TEST_EXIT: String(code) },
    });
    ok(r.status === code, r.stdout + r.stderr);
    ok(readFileSync(args, "utf8") === "-shellcheck=\n.github/workflows/a.yml\n.github/workflows/b.yaml\n", "all workflow paths reach actionlint");
    ok(/inspecting 2 workflow files/.test(r.stdout), "positive coverage is printed");
    ok(r.stdout.includes("checked 2 workflow files; passed") === (code === 0), "no success line after lint failure");
  }
});

test("workflow lint refuses an empty workflow inventory", (t) => {
  const dir = scratch(t);
  const r = spawnSync("bash", [resolve("scripts/lint_workflows.sh")], { cwd: dir, encoding: "utf8" });
  ok(r.status === 1, r.stdout + r.stderr);
  ok(/0 workflow files found/.test(r.stderr), "nothing inspected is a failure");
});

test.after(() => console.log(`ci-local: ${asserted} assertions`));
