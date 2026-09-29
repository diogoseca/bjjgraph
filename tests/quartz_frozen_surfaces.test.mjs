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
// TWO SCOPES, AND ONLY ONE OF THEM CAN RUN ON A FRESH CHECKOUT.
//   `pipeline` (D-27, stream A's 12 files) compares globbed sources against a TRACKED baseline.
//       Self-contained. Verified green with both keep-list inputs removed. This runs everywhere,
//       including `ci-validate.yml`, where it is wired as `validate:frozen-surfaces:pipeline`.
//   `keeplist` (D-01, INTERFACE.md §7's 70 entries) needs TWO inputs a CI checkout does not have:
//       the programme's `INTERFACE.md`, which lives OUTSIDE the repository, and
//       `git show <base>:<path>` against a base commit unreachable at `fetch-depth: 2`.
// So this file does not skip the second scope when its inputs are missing — a silent skip reads
// exactly like a pass, which is the whole point of the gate (CLAUDE.md §6.6). It ASSERTS THE
// REFUSAL: with the inputs absent, `--scope keeplist` must exit non-zero and say
// `byte-compared ZERO files — this run proved nothing`. Absence is therefore checked, not assumed.
//
// MUTANTS RUN, all killed (working tree restored after each):
//   F1  append a byte to a frozen pipeline file (`plugins/filters/draft.ts`)   -> RED
//   F2  append a byte to a frozen keep-list file (`components/Date.tsx`)       -> RED
//   F3  point INTERFACE at a nonexistent path                                 -> exit 2,
//         `--scope all` refuses; `--scope pipeline` stays green, which is what lets CI run it
//   F4  the gate in a `--depth 2` clone, base commit unreachable               -> exit 2, and
//         `byte-compared against f649801a9 : 0` followed by the ZERO-files FAIL
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { existsSync } from "node:fs"
import { REPO } from "./_quartz_pipeline.mjs"

const run = promisify(execFile)

// Floors, seeded from the measured tree. They move only with a deliberate edit here, because a
// baseline that advances by itself is a check that never runs (CLAUDE.md §8).
const PIPELINE_FLOOR = 12 // plugins/transformers/** + plugins/filters/**
const KEEPLIST_FLOOR = 70 // INTERFACE.md §7's retained-file inventory

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

test("KEEP-LIST SCOPE — it passes with its inputs, and REFUSES without them", async (t) => {
  // Its two inputs, probed rather than assumed.
  const iface = "/home/user/bjj-orchestrator/quartz/INTERFACE.md"
  const haveIface = existsSync(iface)
  const haveBase = (await gate.call(null)) && (await baseReachable())
  const { code, out } = await gate("--scope", "keeplist")

  if (haveIface && haveBase) {
    assert.equal(code, 0, `keep-list drift with no --accept on record:\n\n${out}`)
    const m = out.match(/byte-compared against \S+\s*:\s*(\d+)/)
    assert.ok(m, `no coverage line:\n${out}`)
    assert.ok(
      Number(m[1]) >= KEEPLIST_FLOOR,
      `byte-compared ${m[1]} entries, floor is ${KEEPLIST_FLOOR}`,
    )
    assert.match(out, /clean — complete/, "the scope must reach a verdict")
    console.log(`  coverage: keep-list scope byte-compared ${m[1]} entries`)
    return
  }

  // THE OTHER BRANCH IS AN ASSERTION, NOT A SKIP. Whichever input is missing, the gate must
  // refuse — and refuse FOR THE RIGHT REASON. The two inputs fail at different points and print
  // different diagnoses, so the expected message is chosen per input rather than matched loosely.
  // Written the loose way first and it was WRONG: an `INTERFACE.md`-absent run never reaches the
  // byte comparison, so asserting `byte-compared ZERO files` there is an assertion stricter than
  // its own claim and would have gone RED on a correct CI build (CLAUDE.md §6.3).
  const [missing, expected] = !haveIface
    ? [`INTERFACE.md (${iface})`, /FAIL: no interface contract at /]
    : [`the base commit ${BASE_REF}`, /byte-compared ZERO files — this run proved nothing/]
  assert.notEqual(
    code,
    0,
    `${missing} is absent, yet the keep-list scope exited 0. A gate that cannot see its inputs ` +
      `must not report clean:\n\n${out}`,
  )
  assert.match(
    out,
    expected,
    `${missing} is absent and the gate did fail, but not for that reason — so this test is no ` +
      `longer asserting what it says it asserts:\n${out}`,
  )
  console.log(`  coverage: keep-list input absent (${missing}); asserted the REFUSAL, not a skip`)
})

async function baseReachable() {
  try {
    await run("git", ["cat-file", "-e", "f649801a9^{commit}"], { cwd: REPO })
    return true
  } catch {
    return false
  }
}
