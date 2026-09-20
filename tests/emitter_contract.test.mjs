// The emitter registry and the emit SCHEDULE — gated against the live modules, not against source
// text. Stream B (quartz replacement programme), file names approved as D-B-01 / D-23.
//
// WHAT THIS PINS, AND WHY EACH ONE IS HERE
//
//   1. The nine configured emitter INSTANCE NAMES, in configured order. The partition that keeps
//      the build correct is done by instance name (`processors/emit.ts`), so a renamed instance
//      silently moves an emitter between phases. There is no other gate on these names.
//
//   2. INSTANCE NAME ≠ EXPORTED SYMBOL. `404.tsx` exports `NotFoundPage` and names its instance
//      `"404Page"`; the same trap exists on the transformer side (`CrawlLinks` → `LinkProcessing`).
//      Any name-keyed enumeration written from the export list alone selects nothing and reports
//      clean, so the mapping is pinned explicitly and the match count is printed.
//
//   3. The ABI every emitter must carry: `emit` and `getQuartzComponents`. `getDependencyGraph` is
//      deliberately NOT required — it is transitional, the driver no longer calls it (D-S1-02),
//      and B removes the imports before quartz-cto retires `depgraph.ts`. Requiring it here would
//      make that planned removal look like a regression.
//
//   4. The SCHEDULE ITSELF, driven through the real `emitContent`: ComponentResources completes,
//      then Static completes, then everything else runs concurrently.
//
//      A correction to the reason, because the stated one is wrong and a gate justified by a wrong
//      mechanism can never go red. `emit.ts:18-19`, INTERFACE.md §4 and stream B's own brief all
//      say Static's whole-directory copy would CLOBBER the generated `static/contentIndex.json`.
//      Measured: `fs.cp(src, dst, {recursive:true})` MERGES — copying into a destination holding
//      `contentIndex.json` and `sub/other.txt` leaves both in place. Nothing is clobbered, and
//      reordering Static after ContentIndex would not lose a byte today.
//
//      What the ordering actually buys is the absence of a concurrent-write RACE on the shared
//      `output/static/` tree: ContentIndex writes `static/contentIndex.json{,.gz}` into it and
//      ComponentResources writes `static/fonts/*.ttf` into it, both while `fs.cp` is creating and
//      populating the same directory. That hazard is dormant — `cdnCaching: true` means the fonts
//      branch never fires, and no path in `quartz/static/` collides with an emitted one — which is
//      precisely why it must be pinned rather than rediscovered: it is invisible until the day a
//      path does collide, and then it is a flaky, ordering-dependent corruption.
//
//      So this test pins the ORDER, which is the frozen contract (D-03), and does not pretend to
//      demonstrate the clobber that does not happen.
//
// COVERAGE COUNTS: every check prints how many things it compared and fails on zero. A matcher
// that matches nothing emits exactly what success emits (CLAUDE.md §6.6) — the most repeated
// defect class in this repo, and the reason the name-keyed enumeration is gated at all.
//
// MUTANTS THAT MUST TURN THIS FILE RED (re-run after any change here):
//   - `name: "404Page"` → `"NotFoundPage"` in `404.tsx`                     … kills check 1 and 2
//   - swap two entries of the `emitters:` array in `quartz.config.ts`       … kills check 1
//   - delete `getQuartzComponents` from any emitter                         … kills check 3
//   - `emit.ts`: drop `"Static"` from `sequentialNames`                     … kills check 4
//   - `emit.ts`: replace the phase-2 `Promise.all` with a sequential loop   … kills check 4
//   - `emit.ts`: run the sequential set with `Promise.all` too              … kills check 4
//
// NON-KILLS — recorded so nobody reads this file as covering them:
//   - This file asserts NOTHING about emitted bytes, page counts or `static/**` coverage.
//     Archetype counts are asserted against V's artifact manifest; filesystem coverage lives in
//     `emitter_filesystem.test.mjs`.
//   - The schedule is driven with FAKE emitters. It proves the driver's ordering, not that the
//     real ComponentResources and Static are the only two emitters that need it.
//   - The probe runs the main-thread transpile path (see `_emitter_probe.mjs`); emission is
//     main-thread in the real build, so that is the right path here, but no claim is made about
//     anything a worker parsed.

import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { probe, SOURCE_DIR } from "./_emitter_probe.mjs"

const q = (p) => JSON.stringify(path.join(SOURCE_DIR, p))

// The configured emitter list, in configured order. `quartz.config.ts` is the source of truth;
// this literal is the pin. During the byte-parity phase (D-03) a change to either side is meant
// to turn this red — an emitter added or reordered changes what the site emits.
const EXPECTED_CONFIGURED = [
  "AliasRedirects",
  "ComponentResources",
  "ContentPage",
  "FolderPage",
  "TagPage",
  "ContentIndex",
  "Assets",
  "Static",
  "404Page",
]

// exported factory symbol -> the instance name it produces. The two differ for exactly one
// emitter today; that one is the whole reason this table is written out.
const EXPECTED_SYMBOL_TO_NAME = {
  AliasRedirects: "AliasRedirects",
  Assets: "Assets",
  ComponentResources: "ComponentResources",
  ContentIndex: "ContentIndex",
  ContentPage: "ContentPage",
  FolderPage: "FolderPage",
  NotFoundPage: "404Page",
  Static: "Static",
  TagPage: "TagPage",
}

// The emitters whose output shares a directory with another emitter's, and therefore must have
// finished before phase two begins.
const EXPECTED_SEQUENTIAL = ["ComponentResources", "Static"]

const SNIPPET = `
import config from ${q("quartz.config")}
import * as Emitters from ${q("quartz/plugins/emitters/index")}
import { emitContent } from ${q("quartz/processors/emit")}

const registry = config.plugins.emitters.map((e, i) => ({
  i,
  name: e.name,
  emit: typeof e.emit === "function",
  getQuartzComponents: typeof e.getQuartzComponents === "function",
  getDependencyGraph: typeof e.getDependencyGraph === "function",
}))

const exported = Object.keys(Emitters)
  .sort()
  .map((symbol) => {
    const factory = Emitters[symbol]
    const instance = typeof factory === "function" ? factory() : null
    return {
      symbol,
      isFactory: typeof factory === "function",
      name: instance && instance.name,
      emit: !!instance && typeof instance.emit === "function",
      getQuartzComponents: !!instance && typeof instance.getQuartzComponents === "function",
    }
  })

// ---- the schedule, driven through the REAL emitContent -------------------------------------
// Fake emitters recording start/end. ComponentResources sits at index 1 and Static at index 3 so
// that "phase one keeps relative CONFIG order" is distinguishable from "phase one is sorted" and
// from "phase one is whatever order the name set was written in".
const events = []
let tick = 0
const fake = (name) => ({
  name,
  getQuartzComponents: () => [],
  async emit() {
    events.push({ name, edge: "start", t: tick++ })
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    events.push({ name, edge: "end", t: tick++ })
    return []
  },
})

const scheduleCtx = {
  buildId: "emitter-contract-probe",
  argv: {
    directory: "../content",
    output: "__probe_never_written__",
    verbose: false,
    serve: false,
    fastRebuild: false,
    port: 0,
    wsPort: 0,
  },
  cfg: {
    configuration: config.configuration,
    plugins: {
      transformers: [],
      filters: [],
      emitters: [
        fake("AliasRedirects"),
        fake("ComponentResources"),
        fake("Alpha"),
        fake("Static"),
        fake("Beta"),
      ],
    },
  },
  allSlugs: [],
}

await emitContent(scheduleCtx, [])

console.log("__JSON__" + JSON.stringify({ registry, exported, events }))
`

const { value: PROBE } = probe(SNIPPET)

test("configured emitter instance names, in configured order", () => {
  const names = PROBE.registry.map((e) => e.name)
  assert.ok(
    names.length > 0,
    "coverage floor: the live config produced ZERO emitters — the probe looked at nothing",
  )
  assert.deepEqual(
    names,
    EXPECTED_CONFIGURED,
    "configured emitter names/order changed; if deliberate, it is an emitted-byte change and needs a DECISIONS entry (D-03)",
  )
  console.log(`  [coverage] matched ${names.length}/${EXPECTED_CONFIGURED.length} configured emitter instance names`)
})

test("every exported factory's INSTANCE NAME is pinned (404Page is not NotFoundPage)", () => {
  const got = Object.fromEntries(PROBE.exported.map((e) => [e.symbol, e.name]))
  const symbols = Object.keys(got)
  assert.ok(symbols.length > 0, "coverage floor: emitters/index.ts exported nothing")
  assert.deepEqual(
    got,
    EXPECTED_SYMBOL_TO_NAME,
    "an exported emitter symbol or its instance name changed",
  )

  // The specific trap, asserted by itself so the failure message names it.
  assert.equal(got.NotFoundPage, "404Page", "NotFoundPage must still produce the instance name 404Page")
  const differing = symbols.filter((s) => got[s] !== s)
  assert.ok(
    differing.length > 0,
    "expected at least one emitter whose exported symbol differs from its instance name; " +
      "if that is genuinely gone, this test is the thing that should be updated, deliberately",
  )
  console.log(
    `  [coverage] checked ${symbols.length} exported emitter factories; ` +
      `${differing.length} carry an instance name different from their symbol (${differing.join(", ")})`,
  )
})

test("every configured emitter carries the emit ABI", () => {
  let checked = 0
  for (const e of PROBE.registry) {
    assert.ok(e.emit, `emitter ${e.name} has no emit()`)
    assert.ok(e.getQuartzComponents, `emitter ${e.name} has no getQuartzComponents()`)
    checked++
  }
  assert.ok(checked > 0, "coverage floor: zero emitters checked for the ABI")
  // getDependencyGraph is transitional and is NOT required; it is only reported.
  const withDepGraph = PROBE.registry.filter((e) => e.getDependencyGraph).length
  console.log(
    `  [coverage] checked the emit ABI on ${checked} emitters; ` +
      `${withDepGraph} still declare the transitional getDependencyGraph hook`,
  )
})

test("configured emitters all come from emitters/index.ts", () => {
  const known = new Set(PROBE.exported.map((e) => e.name))
  let checked = 0
  for (const e of PROBE.registry) {
    assert.ok(known.has(e.name), `configured emitter ${e.name} is not exported by emitters/index.ts`)
    checked++
  }
  assert.ok(checked > 0, "coverage floor: zero configured emitters cross-checked against the index")
  console.log(`  [coverage] cross-checked ${checked} configured emitters against ${known.size} exported names`)
})

test("emit schedule: shared-output emitters run to completion first, in config order, then the rest concurrently", () => {
  const events = PROBE.events
  assert.ok(events.length > 0, "coverage floor: the real emitContent produced no emitter events")

  const at = (name, edge) => {
    const ev = events.find((e) => e.name === name && e.edge === edge)
    assert.ok(ev, `emitContent never ${edge}ed emitter ${name}`)
    return ev.t
  }

  // 1. phase one runs in CONFIG order: ComponentResources (index 1) before Static (index 3).
  assert.deepEqual(
    events.filter((e) => e.edge === "start" && EXPECTED_SEQUENTIAL.includes(e.name)).map((e) => e.name),
    EXPECTED_SEQUENTIAL,
    "shared-output emitters did not start in configured relative order",
  )

  // 2. each phase-one emitter COMPLETES before the next one starts — no overlap at all.
  assert.ok(
    at("ComponentResources", "end") < at("Static", "start"),
    "Static started before ComponentResources finished; the two shared-output emitters overlapped",
  )

  // 3. nothing from phase two starts until every phase-one emitter has finished. This is the one
  //    that matters for bytes: Static's whole-directory copy would clobber ContentIndex's output.
  const lastSequentialEnd = Math.max(...EXPECTED_SEQUENTIAL.map((n) => at(n, "end")))
  for (const name of ["AliasRedirects", "Alpha", "Beta"]) {
    assert.ok(
      at(name, "start") > lastSequentialEnd,
      `${name} started before the shared-output phase finished`,
    )
  }

  // 4. phase two is genuinely concurrent: every phase-two emitter has started before the first
  //    one finishes. Without this, a sequential phase two would satisfy 1-3 and look correct.
  const phaseTwo = ["AliasRedirects", "Alpha", "Beta"]
  const firstPhaseTwoEnd = Math.min(...phaseTwo.map((n) => at(n, "end")))
  for (const name of phaseTwo) {
    assert.ok(
      at(name, "start") < firstPhaseTwoEnd,
      `${name} did not start until another phase-two emitter had finished; phase two is not concurrent`,
    )
  }

  console.log(
    `  [coverage] scheduled ${new Set(events.map((e) => e.name)).size} emitters through the real emitContent: ` +
      `${EXPECTED_SEQUENTIAL.length} sequential (${EXPECTED_SEQUENTIAL.join(" then ")}), ${phaseTwo.length} concurrent`,
  )
})
