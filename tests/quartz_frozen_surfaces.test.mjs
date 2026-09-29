// ── THE BYTE-FREEZE, WIRED TO A RUNNER ────────────────────────────────────────────────────────
//
// `scripts/check_frozen_surfaces.py` is the gate for D-27 (stream A's 12 pipeline files) and D-01
// (INTERFACE.md §7's 70-entry keep-list). It was a GATE IN NAME ONLY: measured on this tree, the
// string `check_frozen_surfaces` appears exactly once outside the script itself — in a COMMENT at
// `scripts/check_transform_parity.mjs:58`, which is itself in no npm script and no workflow. One
// unwired probe pointing at another. `tests/artifacts/transformer_freeze.json` pinned `toc.ts` to
// the byte and NOTHING THAT RUNS ever compared it.
//
//   git grep -n check_frozen_surfaces -- . | grep -v '^scripts/check_frozen_surfaces.py'
//
// That is CLAUDE.md §6.3 exactly: "a probe is evidence for a commit message; only a spec is a
// gate". This file is the spec. It lives in `tests/` flat, where `test:units`' glob collects it,
// so the freeze is now enforced by a runner rather than by somebody remembering.
//
// WHY package.json IS NOT TOUCHED: D-34 — "STOP BUMPING package.json. Do not touch that file at
// all." So the wiring is a collected test rather than a new npm script, deliberately.
//
// WHAT THIS ASSERTS, in the shape §6.6 demands: not merely exit 0, but a POSITIVE COVERAGE COUNT
// from each scope, with a floor. A gate that examined nothing exits 0 and prints "clean" — the
// two outcomes must not look alike.
//
// BOTH SCOPES RUN ON A FRESH CHECKOUT (v1.205.2).
//   `pipeline` (D-27, stream A's 12 files) compares globbed sources against a TRACKED baseline.
//   `keeplist` (D-01, 70 entries) used to need two inputs a CI checkout lacks: the programme's
//       INTERFACE.md, outside the repository, and `git show f649801a9:<path>`, beyond the fetch
//       depth. So in CI this file could only assert the scope's REFUSAL, and PR #228's first head
//       went green in CI while breaking every seat's local units. Both inputs are tracked now:
//       tests/artifacts/keeplist.txt, and a recorded sha per file in transformer_freeze.json. So
//       the scope must PASS everywhere, with a positive coverage count, and it runs in ci-validate
//       as `validate:frozen-surfaces`.
// The refusals the old CI branch asserted still hold, now proven on a SCRATCH repository: a
// missing inventory, an empty one, and a listed file with no record each refuse, while the
// positive control passes, with no git history at all.
//
// MUTANTS RUN, all killed (working tree restored after each), recorded in the PR:
//   F1  append a byte to a frozen pipeline file                     -> RED (pipeline scope)
//   F2  append a byte to a frozen keep-list file                     -> RED (BYTES DIFFER)
//   F3  drop a components/ line from keeplist.txt                    -> RED (ON DISK BUT NOT FROZEN)
//   F4  delete one keep-list record from the baseline                -> RED (NOT RECORDED)
//   F5  the whole gate in a --depth 1 clone with no INTERFACE.md     -> GREEN, 70 compared
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs"
import os from "node:os"
import { REPO } from "./_quartz_pipeline.mjs"

const run = promisify(execFile)

// Floors, seeded from the measured tree. They move only with a deliberate edit here, because a
// baseline that advances by itself is a check that never runs (CLAUDE.md §8).
const PIPELINE_FLOOR = 12 // plugins/transformers/** + plugins/filters/**
const KEEPLIST_FLOOR = 70 // tests/artifacts/keeplist.txt, the D-01 retained-file inventory

const SCRIPT = path.join(REPO, "scripts/check_frozen_surfaces.py")
const BASE_REF = "f649801a9" // must match check_frozen_surfaces.py's own BASE_REF

/** Run the gate and hand back {code, out}. A non-zero exit is DATA here, not an exception: this
 *  file asserts a refusal in one branch and a pass in the other. */
async function gate(...args) {
  try {
    const r = await run("python3", [SCRIPT, ...args], { cwd: REPO, maxBuffer: 8 * 1024 * 1024 })
    return { code: 0, out: r.stdout + r.stderr }
  } catch (err) {
    return { code: err.code ?? 1, out: (err.stdout ?? "") + (err.stderr ?? "") }
  }
}

test("PIPELINE SCOPE — the 12 frozen files, compared against a tracked baseline", async (t) => {
  const { code, out } = await gate("--scope", "pipeline")
  assert.equal(
    code,
    0,
    `a frozen source file changed without an --accept … --reason on record:\n\n${out}`,
  )
  const m = out.match(/pipeline scope: compared (\d+) files/)
  assert.ok(m, `no coverage line — the gate cannot be read as clean:\n${out}`)
  assert.ok(
    Number(m[1]) >= PIPELINE_FLOOR,
    `compared ${m[1]} files, floor is ${PIPELINE_FLOOR}. A shrinking comparison set is how a ` +
      "freeze stops freezing while still printing clean",
  )
  assert.match(out, /clean — no source drift/, "the scope must reach a verdict, not just print")
  console.log(`  coverage: pipeline scope compared ${m[1]} files`)
})

test("KEEP-LIST SCOPE — tracked inputs only: passes everywhere, with a positive coverage count", async () => {
  const { code, out } = await gate("--scope", "keeplist")
  assert.equal(code, 0, `keep-list drift with no --accept on record:\n\n${out}`)
  const m = out.match(/byte-compared against recorded shas\s*:\s*(\d+)/)
  assert.ok(m, `no coverage line — the gate cannot be read as clean:\n${out}`)
  assert.ok(Number(m[1]) >= KEEPLIST_FLOOR, `byte-compared ${m[1]} entries, floor is ${KEEPLIST_FLOOR}`)
  assert.match(out, /clean — complete/, "the scope must reach a verdict")
  assert.doesNotMatch(out, /INTERFACE\.md \(|no interface contract/, "the gate must not read the programme's INTERFACE.md")
  console.log(`  coverage: keep-list scope byte-compared ${m[1]} entries from tracked inputs`)
})

test("KEEP-LIST SCOPE — refuses a missing or empty inventory and an unrecorded file (scratch repo, no history)", async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bjj-keeplist-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (rel, data) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), data) }
  mkdirSync(path.join(root, "scripts"), { recursive: true })
  copyFileSync(SCRIPT, path.join(root, "scripts/check_frozen_surfaces.py"))
  put("source/quartz/components/Only.tsx", "export const only = 1\n")
  put("source/quartz/components/Extra.tsx", "export const extra = 2\n")
  const sha = (await run("python3", ["-c", "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())", path.join(root, "source/quartz/components/Only.tsx")])).stdout.trim()
  const baseline = (files) => put("tests/artifacts/transformer_freeze.json", JSON.stringify({ base_ref: "f649801a9d3b7acdb21dc3c67968294fa38e9fcf", files }))
  await run("git", ["init", "-q"], { cwd: root })
  await run("git", ["add", "-A"], { cwd: root })
  const scratch = async () => {
    try { const r = await run("python3", ["scripts/check_frozen_surfaces.py", "--scope", "keeplist"], { cwd: root }); return { code: 0, out: r.stdout + r.stderr } }
    catch (e) { return { code: e.code ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") } }
  }
  const rec = { "source/quartz/components/Only.tsx": { sha256: sha, bytes: 22, scope: "keeplist" } }

  baseline(rec)
  let r = await scratch()
  assert.equal(r.code, 2, `no inventory, yet exit ${r.code}:\n${r.out}`)
  assert.match(r.out, /no keep-list inventory at tests\/artifacts\/keeplist\.txt/)

  put("tests/artifacts/keeplist.txt", "# only comments\n\n")
  r = await scratch()
  assert.equal(r.code, 2, `empty inventory, yet exit ${r.code}:\n${r.out}`)
  assert.match(r.out, /parsed to ZERO entries/)

  // Two listed files, one recorded: the gate compares one and must NAME the other. (With ZERO
  // compared it refuses earlier, exit 2, "proved nothing", which is also a refusal.)
  put("tests/artifacts/keeplist.txt", "components/Only.tsx\ncomponents/Extra.tsx\n")
  baseline(rec)
  r = await scratch()
  assert.equal(r.code, 1, `a listed file with no record, yet exit ${r.code}:\n${r.out}`)
  assert.match(r.out, /NOT RECORDED\s+source\/quartz\/components\/Extra\.tsx/)

  // The positive control: every listed file recorded, and components/ completely listed.
  await run("git", ["rm", "-q", "--cached", "source/quartz/components/Extra.tsx"], { cwd: root })
  rmSync(path.join(root, "source/quartz/components/Extra.tsx"))
  put("tests/artifacts/keeplist.txt", "components/Only.tsx\n")
  r = await scratch()
  assert.equal(r.code, 0, `the positive control must pass (no history, no INTERFACE.md):\n${r.out}`)
  assert.match(r.out, /byte-compared against recorded shas\s*:\s*1\b/)
  console.log("  coverage: 3 refusals + 1 positive control on a scratch repo with no history")
})
