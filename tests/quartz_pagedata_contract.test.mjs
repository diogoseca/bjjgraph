// ── THE A→D PAGE-DATA CONTRACT: THE KEYS THE COMPONENTS ACTUALLY READ ─────────────────────────
//
// D-43, contributed by `mgr-cl-3` from an inventory of all 48 components, RE-DERIVED here rather
// than taken on report. It converts "do not break the presentation layer" from a vague obligation
// into a short checklist of `file.data` keys that must exist after the pipeline runs. If a
// transformer stops writing one, the component renders without it and **byte-parity only catches
// it on pages where the value was non-empty** — a per-key presence assertion is cheaper, sharper
// and fires on the fixture instead of two days later at integration.
//
//   Recompute the inventory: `deriveComponentReads()` below IS the recompute — it runs on every
//   test invocation, so the number in the log can never drift from the source it describes.
//   Current result: 17 leaf paths, 78 reads, across 23 build-time component files.
//
// ── THREE OF THE INVENTORY'S KEYS ARE A DIFFERENT OBJECT (corrected, D-43 → verified) ─────────
// The raw grep also reports `fileData.title`, `fileData.tags` and `fileData.content`. **None of
// them is build-time page data.** All three come from
// `components/scripts/search.inline.ts:514-516`, inside
//     for (const [slug, fileData] of Object.entries<ContentDetails>(data))   // :509
// — a LOOP VARIABLE of type `ContentDetails`, the RUNTIME search-index entry emitted by
// `contentIndex.ts` (which declares `title`/`tags`/`content` at :18-21). No transformer writes
// those keys: `data.title =` / `data.tags =` / `data.content =` outside frontmatter matches
// NOTHING in the tree.
//
// This matters rather than being pedantic: asserting them would pin a contract that does not
// exist, and the obvious "fix" when the assertion failed would be to ADD the fields — changing
// emitted bytes during P1-P4 for a requirement nobody has. It is the scope-your-selector-to-a-
// marker-you-own defect (CLAUDE.md §6.7), in a grep rather than in a `querySelector`.
// They ARE a real dependency, just A→**B**: `description.ts` writes `file.data.text`, and
// `contentIndex.ts` turns that into `content`. That seam is asserted at the bottom of this file.
//
// ── MUTATION TABLE, MEASURED ──────────────────────────────────────────────────────────────────
//   P-A  schemaExtractor stops assigning `schemas`   -> tests 1 and 2 RED  ✓
//   P-B  description stops writing `description`     -> test 1 RED         ✓
//   P-C  toc never set (minEntries raised)           -> test 1 RED         ✓
//   P-E  description stops writing `text`            -> test 3 RED         ✓
//   P-F  schemaExtractor stops REMOVING from body    -> test 2 RED         ✓
//   P-G  ofm stops assigning `htmlAst`               -> test 1 RED         ✓
//   P-H  ofm stops assigning `blocks`                -> test 1 RED         ✓
//   NEG  a component starts reading a NEW key        -> test 2 RED         ✓
//        (seeded by adding `fileData.links` to Head.tsx — proves the derived-set check is
//         self-maintaining and that a new component read cannot slip past this contract)
//   P-D  frontmatter drops the `cssclasses` coalesce -> **survives THIS file**, killed by
//        `quartz_frontmatter_contract.test.mjs` CONTRACT 3. Covered, but not here — recorded so
//        nobody reads this file as gating the normalisation.
//
// WHY P-D IS INVISIBLE HERE, AND WHAT IT EXPOSED. The fixture authors the PLURAL `cssclasses:`,
// which gray-matter has already parsed into an array before `frontmatter.ts` runs; the coalescing
// line only NORMALISES the singular form, so deleting it leaves the raw value in place and this
// fixture cannot tell the two apart. That is the same vacuous-fixture class as the wikilink
// spec's W-A/W-B, caught the same way — by a surviving mutant, not by review.
//   Corpus measurement it produced: the SINGULAR keys are authored in **zero** files.
//     for k in cssclasses cssclass aliases alias tags tag; do \
//       printf "%-12s %s\n" "$k" "$(grep -rlE "^${k}:" content --include='*.md' | wc -l)"; done
//     cssclasses 2 · cssclass 0 · aliases 1 · alias 0 · tags 3 · tag 0
//   So `frontmatter.ts`'s entire coalescing branch NEVER FIRES on this corpus. It stays (D-03
//   reproduces, it does not improve) and the singular path keeps its gate in the frontmatter spec,
//   but no byte of the emitted site depends on it today.
//
// ── WHAT THIS FILE DOES NOT COVER (CLAUDE.md §6.9) ────────────────────────────────────────────
//  · Presence and type, not VALUE. It proves a key exists and has the right shape, not that its
//    contents are byte-correct — that is `emit_diff` against the golden.
//  · `slug` and `filePath` are written by the DRIVER (`processors/parse.ts:94-96`), not by any
//    transformer. They are asserted because components read them, but stream A does not own them
//    and a driver that stopped writing them would be S1's defect, not a transformer's.
//  · It does not assert the components RENDER correctly with these keys. That is stream D's.
//  · **AND THE TRANSCLUSION BOUNDARY IS WORTH NAMING, because this gate looks like it covers more
//    than it does.** `blocks` and `htmlAst` are the transclusion INPUTS and this file asserts both
//    are populated — the PRODUCER side. It is structurally blind to the CONSUMER dropping them:
//    `renderPage.tsx:451-456` is a TERNARY, so a slugMap that is PRESENT AND MISSES falls to
//    `if (!page) return` and drops the transclusion SILENTLY, with the `allFiles` path unreachable
//    the moment slugMap exists — which is exactly the condition sharding creates (stream B).
//    So a page can carry perfect `blocks` and emit no transclusion at all, and nothing in stream A
//    would see it. Covered by B's shard spec, not by this one. Stated rather than left implicit,
//    because "the inputs are correct" reads like "the output is correct" to anyone in a hurry.
//
//    **AND THIS IS NOT AN INHERITED DEFECT — OUR OWN FEATURE MAKES IT REACHABLE.** Verified:
//    `contentPage.tsx:46-48` builds `slugMap` by iterating `allFiles`, and `contentPage` is the
//    ONLY emitter that passes one (`:77`). So UN-SHARDED the two sets are identical and a
//    present-and-misses CANNOT HAPPEN. The shard ABI is the first thing able to hand `renderPage`
//    a narrower `slugMap` than `allFiles`.
//    The consequence for this file: the assertions below are newly LOAD-BEARING. `blocks` and
//    `htmlAst` being populated was previously a producer-side nicety with no reachable consumer
//    failure behind it; it is now the precondition for a consumer path that CAN fail, silently,
//    on exactly the pages a shard does not hold. Same assertions, different weight — which is
//    worth knowing before anyone decides they are redundant.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { REPO, harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

// The contract, as DATA — so the coverage count below is DERIVED from the table rather than being
// a number typed into a log line that can drift away from what actually ran.
const CONTRACT = [
  // leaf path                  writer                         expected shape
  ["slug", "processors/parse.ts (DRIVER)", (v) => typeof v === "string" && v.length > 0],
  ["filePath", "processors/parse.ts (DRIVER)", (v) => typeof v === "string" && v.length > 0],
  ["dates", "lastmod.ts", (v) => v && typeof v === "object"],
  ["dates.created", "lastmod.ts", (v) => v instanceof Date && Number.isFinite(v.getTime())],
  ["dates.modified", "lastmod.ts", (v) => v instanceof Date && Number.isFinite(v.getTime())],
  ["toc", "toc.ts", (v) => Array.isArray(v) && v.every((e) => typeof e.slug === "string")],
  ["collapseToc", "toc.ts", (v) => typeof v === "boolean"],
  ["frontmatter", "frontmatter.ts", (v) => v && typeof v === "object"],
  ["frontmatter.title", "frontmatter.ts", (v) => typeof v === "string" && v.length > 0],
  ["frontmatter.cssclasses", "frontmatter.ts", (v) => Array.isArray(v)],
  ["frontmatter.noindex", "frontmatter.ts", (v) => v !== undefined],
  ["frontmatter.lang", "frontmatter.ts", (v) => typeof v === "string"],
  ["frontmatter.tags", "frontmatter.ts", (v) => Array.isArray(v)],
  ["description", "description.ts", (v) => typeof v === "string" && v.length > 0],
  ["schemas", "schemaExtractor.ts", (v) => Array.isArray(v)],
  ["blocks", "ofm.ts", (v) => v && typeof v === "object"],
  ["htmlAst", "ofm.ts", (v) => v && v.type === "root" && Array.isArray(v.children)],
  // OPTIONAL — its ABSENCE is part of the contract, not a violation. `Head.tsx:67` reads it as
  // `fileData.dates?.published?.toISOString()` and emits `article:published_time` only when it is
  // present, because `lastmod.ts:160` gives `published` NO `?? new Date()` fallback (unlike
  // `created`/`modified` at :158-159). Today 0 of 4,600 files author `publishDate`/`date`, so it is
  // absent everywhere — but that is a FACT IN MOTION: publication dates are to be derived from git,
  // at which point it becomes present on ~6,118 pages. Asserting either presence OR absence would
  // encode a transient, so this asserts only the SHAPE: absent, or a real Date. Never a string,
  // never a number, never an Invalid Date.
  ["dates.published", "lastmod.ts", (v) => v === undefined || (v instanceof Date && Number.isFinite(v.getTime())), { optional: true }],
]

// ── THE SET IS DERIVED FROM THE COMPONENTS, NOT TYPED IN HERE ────────────────────────────────
// Three of us produced three different counts for this contract (14, 11, 8-or-12) and ALL THREE
// were wrong, because every one of us anchored the grep on the receiver name `fileData`. Measured:
// `fileData` is only 43 of the reads; components also reach page data through `page`, `f`, `f1`,
// `f2`, `file`, `data`, `currentFile`, `contentPage` and `m`. Anchoring on a variable NAME
// undercounts the contract — the mirror image of D-46, where a name MATCHED something it should
// not have. Both are the same lesson: the selector is not the thing.
// So this derives the set from source at test time and fails if CONTRACT does not cover it.
const PAGE_DATA_KEYS = [
  "slug", "filePath", "relativePath", "frontmatter", "dates", "toc", "collapseToc",
  "links", "schemas", "description", "text", "blocks", "htmlAst",
]
// Receivers that merely SHARE a key name with page data. Read the enclosing TYPE, not the matching
// line (D-48) — this is the trap that cost two streams an afternoon between them.
const NOT_PAGE_DATA = {
  tocEntry: "TocEntry — its `.slug` is a HEADING ANCHOR, as toc.ts:24's own comment says",
  propertyDefaults: "the i18n locale table",
  cfg: "GlobalConfiguration",
  opts: "component options",
  props: "component props",
}
const CHAINED_METHODS = new Set([
  "trim", "split", "map", "flatMap", "filter", "join", "includes", "length",
  "toISOString", "slice", "at", "children",
])

function deriveComponentReads() {
  const dir = path.join(REPO, "source", "quartz", "components")
  const out = new Map()
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      // components/scripts/ is CLIENT-side, where the same identifier can be a different object.
      if (e.isDirectory()) {
        if (e.name !== "scripts") walk(p)
      } else if (/\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(p, "utf8")
        const re = new RegExp(
          String.raw`\b([A-Za-z_][A-Za-z0-9_]*)\??\.(${PAGE_DATA_KEYS.join("|")})\b(?:\??\.([A-Za-z_][A-Za-z0-9_]*))?`,
          "g",
        )
        for (const m of src.matchAll(re)) {
          const [, recv, key, sub] = m
          if (recv in NOT_PAGE_DATA) continue
          const leaf = !sub || CHAINED_METHODS.has(sub) ? key : `${key}.${sub}`
          out.set(leaf, (out.get(leaf) ?? 0) + 1)
        }
      }
    }
  }
  walk(dir)
  return out
}

// A fixture that exercises EVERY key in CONTRACT — which is the point: the derived-set test below
// proves the TABLE is complete, and this fixture proves the PIPELINE fills it. It carries a title,
// cssclasses, tags, noindex, lang, a description, >1 heading (TOC needs `length > minEntries`,
// default 1) and a JSON-LD block. `tags` was added after the derived check caught its absence —
// exactly the kind of gap a hand-written fixture has by default.
const FIXTURE = `---
title: Contract Fixture
description: A page that exercises every key the components read.
cssclasses:
  - hide-content
tags:
  - contract
  - fixture
noindex: true
lang: en-US
---

# First Heading

Body text, long enough that the description transformer has something to work with.

<script type="application/ld+json">{"@type":"Article","name":"contract"}</script>

## Second Heading

More body text.
`

const dig = (obj, keyPath) => keyPath.split(".").reduce((o, k) => (o == null ? o : o[k]), obj)

test("EVERY KEY THE COMPONENTS READ IS PRESENT AND WELL-SHAPED AFTER THE PIPELINE", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const { file } = await runPipeline(FIXTURE, { slug: "Contract/Fixture", allSlugs: ["Contract/Fixture"] })

  const missing = []
  const malformed = []
  const absentButOptional = []
  for (const [keyPath, writer, shape, opts = {}] of CONTRACT) {
    const v = dig(file.data, keyPath)
    if (v === undefined) {
      // An optional key's absence is the contract, but it is PRINTED rather than passed over in
      // silence — "not asserted" and "asserted and fine" must not read the same (CLAUDE.md §6.6).
      if (opts.optional) absentButOptional.push(keyPath)
      else missing.push(`${keyPath}  (written by ${writer})`)
    } else if (!shape(v)) {
      malformed.push(`${keyPath} = ${JSON.stringify(v)}  (written by ${writer})`)
    }
  }
  if (absentButOptional.length) {
    console.log(`  optional and absent on this fixture: ${absentButOptional.join(", ")}`)
  }

  console.log(`  coverage: ${CONTRACT.length} page-data leaf paths asserted`)
  assert.ok(CONTRACT.length >= 17, "the contract table must not be empty or truncated")
  assert.deepEqual(missing, [], "a key the components read was never written")
  assert.deepEqual(malformed, [], "a key was written with the wrong shape")
})

test("THE CONTRACT TABLE COVERS EVERY KEY THE COMPONENTS ACTUALLY READ", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const derived = deriveComponentReads()
  const covered = new Set(CONTRACT.map(([k]) => k))
  const uncovered = [...derived.keys()].filter((k) => !covered.has(k)).sort()
  const totalReads = [...derived.values()].reduce((a, b) => a + b, 0)

  // POSITIVE COVERAGE COUNT, hard-failing on zero (CLAUDE.md §6.6). A derivation that matched
  // nothing would otherwise report a perfectly clean "0 uncovered".
  console.log(
    `  coverage: ${derived.size} leaf paths derived from the components, ${totalReads} reads`,
  )
  assert.ok(
    derived.size >= 15,
    `derived only ${derived.size} leaf paths — the regex or the directory is wrong, and a ` +
      "derivation that finds nothing reports clean",
  )
  assert.deepEqual(
    uncovered,
    [],
    "a build-time component reads a page-data key this contract does not assert. Add it to " +
      "CONTRACT with its shape, or — if it is a same-name-different-object — to NOT_PAGE_DATA " +
      "with the reason.",
  )
})

test("schemas HAS EXACTLY ONE READER — losing it silently empties every <head>", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // Recon's seeded regression 4, and the reason it is dangerous: `validate:schema` reads
  // `content/**/*.md`, NOT emitted HTML, so it stays GREEN while every page's <head> loses its
  // JSON-LD. Measured on this corpus: 21,179 ld+json blocks are AUTHORED in content/*.md across
  // 4,594 files (what SchemaExtractor hoists), and 33,438 are EMITTED across 6,138 golden pages
  // (authored plus ~2 per page generated by Head.tsx). Both figures are correct for different
  // sets; neither is usable without its set definition attached (CLAUDE.md §6.9).
  const { file, html } = await runPipeline(FIXTURE, { slug: "Contract/Fixture" })
  assert.deepEqual(
    file.data.schemas,
    [{ "@type": "Article", name: "contract" }],
    "the authored block must be hoisted into file.data.schemas for Head.tsx's single reader",
  )
  assert.doesNotMatch(
    html,
    /ld\+json/,
    "and REMOVED from the body — a block left in place is rendered twice or not at all",
  )
  // An empty array, not undefined: Head.tsx maps over it unconditionally.
  const noSchema = await runPipeline("---\ntitle: T\n---\n\nbody\n", { slug: "NoSchema" })
  assert.deepEqual(
    noSchema.file.data.schemas,
    [],
    "a page with no JSON-LD records an EMPTY array, never undefined",
  )
})

test("THE A→B SEAM — file.data.text is what becomes contentIndex's `content`", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The three keys D-43's grep mis-attributed to the components are really this seam.
  // `description.ts` writes `file.data.text`; `contentIndex.ts` emits it as `content`, which
  // `search.inline.ts` then reads. Asserted here so the A-side of that contract is pinned even
  // though the B-side is not stream A's to gate.
  const { file } = await runPipeline(FIXTURE, { slug: "Contract/Fixture" })
  assert.equal(typeof file.data.text, "string", "file.data.text feeds the 16.4MB contentIndex.json")
  assert.ok(file.data.text.includes("First Heading"), "text must contain the rendered body text")
  assert.doesNotMatch(
    file.data.text,
    /ld\+json|<script/,
    "SchemaExtractor runs BEFORE Description precisely so hoisted JSON-LD never enters searchable text",
  )
})
