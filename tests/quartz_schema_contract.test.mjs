// ── SchemaExtractor: 8.93% OF THE SITE'S EMITTED BYTES, PARTIALLY PINNED ───────────────────────
//
// THE SHARE, measured over `golden/build0` rather than argued:
//     35,927,532 bytes of `<script type="application/ld+json">` in `<head>`
//     = 8.93% of the build's 402,368,193 emitted HTML bytes
//     33,438 blocks across 6,138 of 6,149 pages
//   Recompute: `python3 reports/quartz-a-byteshare.py` in the orchestrator tree (prints every
//   transformer's row with the pattern it counts; `BUILD=<dir>` to census a different build, and
//   it hard-fails rather than printing an empty table). That census reproduces the gfm audit's
//   INDEPENDENT figure to the byte — 41,658,803 / 10.35% — which is the control on the method.
//   The first version of this citation pointed into `/home/user/tmp-pw`: a recompute command that
//   names a tmp directory is one that vanishes, which makes the number unreproducible and the
//   claim worthless (§6.9, and the reason §7S exists).
//
// WHY THIS FILE EXISTS, established by MUTATION rather than by reading the specs (§6.9). Before
// it, five mutants of `schemaExtractor.ts` were run against every stream-A spec. TWO died:
// "stop hoisting" (3 specs) and "hoist but do not remove from the body". THREE SURVIVED, and each
// is a silent, plausible, wrong site:
//   SX-C  match the script `type` CASE-INSENSITIVELY
//   SX-D  drop the `.trim()` before `JSON.parse`
//   SX-E  widen the match to any `application/*` type
// So the transformer was PARTIALLY PINNED, not ungated. This file closes the three.
//
// WHAT IT DOES NOT CLAIM:
//  · It does not re-assert that ld+json survives `stripDangerousHtml` — that is
//    `quartz_sanitizer_contract.test.mjs`'s, and duplicating it would put one claim in two places
//    (§6.5). It does assert that `application/json` is NOT hoisted and still reaches the body,
//    which depends on that allowlist and would go red if it were lost.
//  · It is not a claim that the emitted JSON-LD is correct or complete. `scripts/check_schema_jsonld.py`
//    owns parseability across the corpus; this owns the transformer's behaviour.
//
// MUTANTS RUN, all restored byte-identical afterwards and confirmed by
// `npm run validate:frozen-surfaces` (D-27 freezes this file):
//   SX-A  `schemas.push(schema)` removed                  -> RED (test 1)
//   SX-B  the body `splice` removed                       -> RED (test 1)
//   SX-C  type matched case-insensitively                 -> RED (test 2)
//   SX-D  `.trim()` dropped before `JSON.parse`           -> RED (test 3)
//   SX-E  match widened to any `application/*`            -> RED (test 2)
//   SX-F  the EMPTINESS `.trim()` dropped                  -> RED (test 3) — see below
//   SX-G  the invalid-JSON `console.warn` removed          -> RED (test 4)
// And two on the OTHER side of the seam, in `ofm.ts`, because this transformer's behaviour is not
// decidable from its own file alone:
//   SX-H  `application/json` removed from SAFE_SCRIPT_TYPES -> RED (test 2)
//   SX-I  the sanitizer stops lower-casing the script type  -> RED (test 2)
//
// SX-F IS WHY TEST 3 ASSERTS AN ABSENCE OF OUTPUT. It survived every other assertion here: with
// `if (textContent)` instead of `if (textContent.trim())`, a whitespace-only block takes the
// invalid-JSON path instead of the silent-skip path and produces the SAME schemas and the SAME
// body. One warning line is the entire observable difference.
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const LD = "application/ld+json"
let seq = 0
const drive = (body) =>
  runPipeline(`---\ntitle: T\n---\n\n${body}\n\nTAIL\n`, { slug: `Schema${seq++}` })
const scriptsInBody = (html) => (html.match(/<script[^>]*>/g) ?? []).length

/** Drive with console.warn/log captured. The invalid-JSON branch and the whitespace-only branch
 *  are observationally IDENTICAL in schemas and in the body — the ONLY thing that separates them
 *  is whether a warning was emitted, so the warning has to be part of the assertion or the two
 *  branches cannot be told apart (that is measured: mutant SX-F survived until this existed). */
async function driveCapturing(body) {
  const lines = []
  const real = { warn: console.warn, log: console.log }
  console.warn = console.log = (...a) => lines.push(a.join(" "))
  try {
    return { ...(await drive(body)), lines }
  } finally {
    console.warn = real.warn
    console.log = real.log
  }
}

test("BOTH HALVES — hoisted into file.data.schemas AND removed from the body, in order", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const { html, file } = await drive(
    ["A", `<script type="${LD}">{"k":1}</script>`, "B", `<script type="${LD}">{"k":2}</script>`, "C"].join("\n\n"),
  )
  assert.deepEqual(file.data.schemas, [{ k: 1 }, { k: 2 }], "hoisted, and in DOCUMENT order")
  assert.equal(scriptsInBody(html), 0, "…and removed from the body — the half with the larger byte consequence")
  for (const x of ["A", "B", "C"])
    assert.match(html, new RegExp(`>${x}<`), `the reverse-index splice must not disturb sibling content (${x})`)
  console.log(`  coverage: 2 blocks hoisted, 0 left in body, 3 siblings intact`)
})

test("THE TYPE MATCH — exact and case-SENSITIVE here, case-INsensitive in the sanitizer", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // THE SEAM THIS TEST IS REALLY ABOUT, and it is documented nowhere else. TWO transformers decide
  // what "an ld+json block" is, and they decide it DIFFERENTLY:
  //   ofm.ts:555          `String(node.properties?.type ?? "").toLowerCase()` then set membership
  //                       -> case-INsensitive, and it does NOT trim
  //   schemaExtractor.ts  `node.properties?.type === "application/ld+json"`
  //                       -> case-SENSITIVE, raw ===
  // Measured consequences, each of which is silent on a build:
  //   `application/LD+JSON`   the sanitizer SPARES it, this transformer does NOT hoist it, so the
  //                           block sits in the BODY and the page's JSON-LD never reaches <head>
  //   `application/ld+json `  the sanitizer does not match it (no trim), so it is STRIPPED
  //                           ENTIRELY before this transformer ever runs — hence 0 in the body
  // Widening the match here (SX-C, SX-E) or narrowing the allowlist there moves 33,438 blocks.
  let checked = 0
  for (const [label, type, hoisted, leftInBody, why] of [
    ["exact", LD, 1, 0, "the only spelling that is both spared and hoisted"],
    ["uppercased", "application/LD+JSON", 0, 1,
      "spared by the sanitizer, NOT hoisted here — it stays in the body, un-hoisted and silent"],
    ["application/json", "application/json", 0, 1,
      "spared deliberately by the sanitizer and deliberately not hoisted; SX-E would swallow it"],
    ["trailing space", "application/ld+json ", 0, 0,
      "the SANITIZER removes it before this transformer runs — absence here is not this file's doing"],
  ]) {
    const { html, file } = await drive(`<script type="${type}">{"n":1}</script>`)
    assert.equal(file.data.schemas.length, hoisted, `${label}: hoisted count — ${why}`)
    assert.equal(scriptsInBody(html), leftInBody, `${label}: scripts left in the body — ${why}`)
    checked += 1
  }
  console.log(`  coverage: ${checked} script types, each asserting BOTH hoisting and body survival`)
  assert.equal(checked, 4, "a short loop would assert nothing")
})

test("BOTH `.trim()`s ARE REACHABLE — kills SX-D", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `JSON.parse` already skips ordinary leading whitespace, which is why a naive fixture makes the
  // trim look decorative and lets SX-D survive. It is not decorative: `trim()` also strips U+FEFF
  // and U+00A0, which `JSON.parse` rejects. A byte-order mark in front of an authored block — the
  // kind of thing a copy-paste or a generator emits — is the difference between a hoisted schema
  // and a page that silently loses it.
  for (const [label, prefix] of [["BOM U+FEFF", "﻿"], ["NBSP U+00A0", " "]]) {
    const { html, file } = await drive(`<script type="${LD}">${prefix}{"n":4}</script>`)
    assert.deepEqual(
      file.data.schemas,
      [{ n: 4 }],
      `a ${label}-prefixed block must still parse and hoist — without the trim JSON.parse throws, ` +
        "the block is left in the body, and the page loses its structured data with one warn line",
    )
    assert.equal(scriptsInBody(html), 0, `${label}: and it must leave the body`)
  }
  // The OTHER trim, on the emptiness test. A whitespace-only block is skipped ENTIRELY: not
  // parsed, not hoisted, not removed — and NOT warned. Incumbent behaviour, pinned so the port
  // cannot quietly turn it into a warning or a removal.
  const { html, file, lines } = await driveCapturing(`<script type="${LD}">   </script>`)
  assert.deepEqual(file.data.schemas, [], "a whitespace-only block is not hoisted")
  assert.equal(scriptsInBody(html), 1, "…and is left in the body")
  assert.deepEqual(
    lines.filter((l) => /SchemaExtractor/.test(l)),
    [],
    "…and SILENTLY. Without the emptiness trim, `if (textContent)` is truthy on whitespace, " +
      "JSON.parse throws, and the block takes the INVALID-JSON path instead — same schemas, same " +
      "body, one extra warning. The warning is the only observable difference, so it is the " +
      "assertion (mutant SX-F survived every other check in this file)",
  )
  console.log(`  coverage: 2 prefix forms + the whitespace-only branch, asserted silent`)
})

test("INVALID JSON STAYS IN THE BODY AND WARNS — 0 of 21,179 blocks today", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // Measured: ZERO of the corpus's 21,179 authored blocks fail to parse, so byte-parity against
  // the golden can never see this branch removed — the entire catch arm is fixture-only
  // (D-51/D-58). Recompute: `python3 scripts/check_schema_jsonld.py`.
  const { html, file, lines } = await driveCapturing(`<script type="${LD}">{not json}</script>`)
  assert.deepEqual(file.data.schemas, [], "an unparseable block must not be hoisted")
  assert.equal(scriptsInBody(html), 1, "…and must be LEFT in the body rather than dropped")
  assert.ok(
    lines.some((l) => /SchemaExtractor: Invalid JSON-LD/.test(l)),
    `the failure must be announced, not swallowed. Captured output was:\n${lines.join("\n")}`,
  )
  console.log(`  coverage: 1 invalid block — not hoisted, left in body, warned`)
})

test("ANY JSON VALUE IS HOISTED, despite the declared `object[]` — incumbent", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `JSON.parse` succeeding is the only test applied, so `null`, arrays and scalars all land in
  // `file.data.schemas` even though its type says object[]. Head.tsx then renders them. This is
  // reproduced, not corrected: P1-P4 changes no emitted byte (D-03).
  let checked = 0
  for (const [src, want] of [["null", null], ["[1,2]", [1, 2]], ["42", 42]]) {
    const { file } = await drive(`<script type="${LD}">${src}</script>`)
    assert.deepEqual(file.data.schemas, [want], `${src} is hoisted as-is`)
    checked += 1
  }
  console.log(`  coverage: ${checked} non-object JSON values hoisted`)
  assert.equal(checked, 3, "a short loop would assert nothing")
})
