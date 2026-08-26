// Pure-unit suite for the CLAUDE.md reference gate itself:
//   node --test tests/claudemd_refs_gate.test.mjs
//
// WHAT THIS IS FOR. `check_claudemd_refs.py` runs in ci-validate as the FOURTH step of a job
// whose remaining gates — the share-ordinal lockfile, MC viability, graph integrity — run
// after it and are SKIPPED when it exits non-zero. So a false failure here does not merely
// annoy: it silently stops three hard gates from running at all, and the job's red X looks
// like one problem while hiding three unknowns.
//
// That is exactly what happened before v1.136.2. The gate demanded that every backticked path
// exist, and the canon legitimately names four GENERATED ones (`source/public`, the emitted
// neural payload, the dev snapshot dump). Those exist for anyone who has just built and never
// in a fresh checkout — so the gate passed locally, failed in CI, and had been red on `dev`
// for hours with nobody reading past the first failure.
//
// The two tests below are the whole contract, and they pull in opposite directions on purpose:
// a generated path must NOT fail the gate, and a misspelled one still MUST. A fix for the
// first that breaks the second turns the gate into a rubber stamp, which is worse than the
// false failure it replaced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = resolve(ROOT, "scripts/check_claudemd_refs.py");

/** Drive the REAL script over a throwaway document — never a re-implementation of its rules. */
function runGate(markdown) {
  const dir = mkdtempSync(join(tmpdir(), "claudemd-refs-"));
  const doc = join(dir, "probe.md");
  try {
    writeFileSync(doc, markdown);
    const r = spawnSync("python3", [GATE, doc], { cwd: ROOT, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A path that is gitignored and that NO build writes, so it is absent in every tree — built or
// fresh. The first cut of this test asserted on `source/public` instead and was therefore a
// measurement of whether the person running it had built: green in CI (which never builds) and
// red the moment anyone ran it after `npm run build`, which is the worst direction for a flake
// to point. Nothing creates this file; if something ever does, that is the bug, not this test.
const NEVER_WRITTEN = "source/public/__refs_gate_probe_never_written__.js";

test("a GENERATED path the canon names on purpose does not fail the gate", () => {
  // All absent from a fresh checkout and gitignored; before v1.136.2 this was three CI failures.
  // Deliberately asserts only the EXIT CODE, because whether these exist depends on build state:
  // present, they resolve normally; absent, they are waved through. Both are a pass.
  const r = runGate(
    "The built site lives in `source/public`, the payload in " +
      "`source/quartz/static/neural/`, and dev snapshots land in " +
      "`tests/artifacts/snapshots/`. A real file: `scripts/check_claudemd_refs.py`.\n",
  );
  assert.equal(r.code, 0, `generated paths must pass; gate said:\n${r.out}`);
});

test("...and it SAYS what it waved through, rather than passing in silence", () => {
  // A waved-through reference is one the gate did not verify, so silence would be the same
  // failure class in a new coat (§6.6). Uses the never-written path so the claim holds in a
  // built tree too.
  const r = runGate(`A generated file nothing writes: \`${NEVER_WRITTEN}\`\n`);
  assert.equal(r.code, 0, `an ignored path must not fail the gate; gate said:\n${r.out}`);
  assert.match(r.out, /absent-but-gitignored/, "the skip must print what it waved through");
  assert.match(r.out, /__refs_gate_probe_never_written__/, "...naming it, so the list is readable");
});

test("...but a misspelled path still fails, generated-looking or not", () => {
  const r = runGate(
    "Typo file: `scripts/check_claudemd_refz.py`\n" +
      "Typo dir under a real one: `tests/artifacts/snapshotz/`\n" +
      "A module that no longer exists: `source/quartz/components/Gone.tsx`\n",
  );
  assert.equal(r.code, 1, `dangling paths must fail; gate said:\n${r.out}`);
  for (const needle of ["check_claudemd_refz.py", "snapshotz", "Gone.tsx"]) {
    assert.match(r.out, new RegExp(needle.replace(/[.]/g, "\\.")), `must name ${needle}`);
  }
});
