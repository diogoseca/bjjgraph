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
// MUTANTS RUN, both killed (working tree restored after each):
//   F1  append a byte to a frozen pipeline file (`plugins/filters/draft.ts`)   -> RED
//   F2  append a byte to a frozen keep-list file (`components/Date.tsx`)       -> RED
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { REPO } from "./_quartz_pipeline.mjs"

const run = promisify(execFile)

// Floors, seeded from the measured tree. They move only with a deliberate edit here, because a
// baseline that advances by itself is a check that never runs (CLAUDE.md §8).
const PIPELINE_FLOOR = 12 // plugins/transformers/** + plugins/filters/**
const KEEPLIST_FLOOR = 70 // INTERFACE.md §7's retained-file inventory

test("THE BYTE-FREEZE IS ENFORCED, and both scopes report what they actually compared", async (t) => {
  let out
  try {
    const r = await run("python3", [path.join(REPO, "scripts/check_frozen_surfaces.py")], {
      cwd: REPO,
      maxBuffer: 8 * 1024 * 1024,
    })
    out = r.stdout + r.stderr
  } catch (err) {
    // A non-zero exit IS the gate firing. Surface the script's own diagnosis rather than a
    // bare "command failed", because the message names the drifted path and its reason.
    assert.fail(
      `check_frozen_surfaces.py exited ${err.code}. A frozen surface changed without an ` +
        `--accept … --reason on record:\n\n${(err.stdout ?? "") + (err.stderr ?? "")}`,
    )
  }

  // POSITIVE COVERAGE, per scope. "clean" on zero files reads exactly like "clean" on all of them.
  const pipeline = out.match(/pipeline scope: compared (\d+) files/)
  assert.ok(pipeline, `the pipeline scope printed no coverage line. Output was:\n${out}`)
  assert.ok(
    Number(pipeline[1]) >= PIPELINE_FLOOR,
    `pipeline scope compared ${pipeline[1]} files, floor is ${PIPELINE_FLOOR}. A shrinking ` +
      "comparison set is how a freeze stops freezing while still printing clean",
  )

  const keeplist = out.match(/byte-compared against \S+\s*:\s*(\d+)/)
  assert.ok(keeplist, `the keep-list scope printed no coverage line. Output was:\n${out}`)
  assert.ok(
    Number(keeplist[1]) >= KEEPLIST_FLOOR,
    `keep-list scope byte-compared ${keeplist[1]} entries, floor is ${KEEPLIST_FLOOR}`,
  )

  // Both scopes must have reached a verdict. A run that printed one scope and died in the other
  // would still exit 0 if the failure were swallowed upstream.
  const verdicts = out.match(/^\s*clean — /gm) ?? []
  assert.equal(
    verdicts.length,
    2,
    `expected a clean verdict from BOTH scopes, got ${verdicts.length}. Output was:\n${out}`,
  )

  console.log(
    `  coverage: pipeline ${pipeline[1]} files, keep-list ${keeplist[1]} entries, 2 scope verdicts`,
  )
})
