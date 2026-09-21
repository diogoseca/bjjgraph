// The transform probe's metadata report, not a transformer or content-attestation test.
// Owned Git/seam fixtures pin the printed capture ref, exact changed-path set, advisory
// drift, and refusal before dependency loading when provenance.git_head is missing.
// A metadata-only success makes NO stage-parity claim. No external golden/deps are needed.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync, spawnSync } from "node:child_process"

const SCRIPT = fileURLToPath(new URL("../scripts/check_transform_parity.mjs", import.meta.url))

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-parity-provenance-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const write = (name, bytes) => {
    const dest = path.join(root, name)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, bytes)
  }
  const git = (...args) => execFileSync("git", [
    "-c", "user.name=Provenance fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args,
  ], { cwd: root, encoding: "utf8" }).trim()
  git("init", "-q")
  const inputs = [
    "content/fixture.md", "source/quartz/plugins/transformers/fixture.ts",
    "source/quartz/util/path.ts", "source/quartz.config.ts", "source/quartz/processors/parse.ts",
  ]
  for (const p of inputs) write(p, "captured\n")
  git("add", "--", ...inputs)
  git("commit", "-qm", "captured inputs")
  const captured = git("rev-parse", "HEAD")
  write("scripts/check_transform_parity.mjs", fs.readFileSync(SCRIPT))
  fs.mkdirSync(path.join(root, "seam/transform"), { recursive: true })
  const meta = (provenance) => write("seam/pipeline.json", JSON.stringify({ provenance }))
  meta({ git_head: captured })
  const probe = (...args) => {
    const r = spawnSync(process.execPath, [
      path.join(root, "scripts/check_transform_parity.mjs"),
      "--seam", path.join(root, "seam"), ...args,
    ], { cwd: root, encoding: "utf8", timeout: 15000 })
    assert.ifError(r.error)
    return { code: r.status, out: r.stdout + r.stderr }
  }
  return { write, git, captured, meta, probe }
}

test("PROVENANCE REF — print the seam's own ref and exact changed paths, without failing on drift", (t) => {
  const f = fixture(t)
  const changedPath = "source/quartz/processors/parse.ts"
  f.write(changedPath, "changed producer\n")
  f.write("outside.txt", "unrelated commit\n")
  f.git("add", "--", changedPath, "outside.txt")
  f.git("commit", "-qm", "producer drift plus unrelated input")
  const current = f.git("rev-parse", "HEAD")
  assert.notEqual(current, f.captured)
  const drift = f.probe("--provenance-only")
  assert.equal(drift.code, 0, drift.out)
  const printed = drift.out.match(/1 parity input\(s\) CHANGED since ([0-9a-f]+) /)
  assert.ok(printed, drift.out)
  assert.equal(printed[1], f.captured, "printed ref must equal pipeline.json provenance.git_head")
  assert.deepEqual(drift.out.split("\n").filter((line) => line.startsWith("      ")), [`      ${changedPath}`])
  assert.match(drift.out, /provenance only.*no transformer comparisons/i)
  assert.doesNotMatch(drift.out, /clean — every compared stage/)

  // A second real capture ref kills hard-coding to ANY single reference, not just the old one.
  f.meta({ git_head: current })
  const match = f.probe("--provenance-only")
  assert.equal(match.code, 0, match.out)
  assert.ok(match.out.includes(`parity inputs UNCHANGED since ${current} (5 paths checked)`), match.out)
  console.log("  coverage: 2 capture refs; exactly 1 changed producer path; 1 unrelated path excluded")
})

test("PROVENANCE REF — missing or malformed git_head is refused before comparisons, with no fallback", (t) => {
  const f = fixture(t)
  const invalid = [undefined, {}, { git_head: null }, { git_head: "" }, { git_head: "   " }, { git_head: 42 }]
  for (const provenance of invalid) {
    f.meta(provenance)
    // Normal mode too: the fixture deliberately has no transformer dependency installation.
    for (const args of [[], ["--provenance-only"]]) {
      const r = f.probe(...args)
      assert.equal(r.code, 2, r.out)
      assert.match(r.out, /FAIL: pipeline\.json requires.*provenance\.git_head.*no fallback/i)
      assert.doesNotMatch(r.out, /CHANGED since|UNCHANGED since|Cannot find module/)
    }
  }
  console.log(`  coverage: ${invalid.length} invalid metadata shapes refused in both CLI modes`)
})
