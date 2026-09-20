// ── THE A→D PAGE-DATA CONTRACT: THE KEYS THE COMPONENTS ACTUALLY READ ─────────────────────────
//
// D-43, contributed by `mgr-cl-3` from an inventory of all 48 components, RE-DERIVED here rather
// than taken on report. It converts "do not break the presentation layer" from a vague obligation
// into a short checklist of `file.data` keys that must exist after the pipeline runs. If a
// transformer stops writing one, the component renders without it and **byte-parity only catches
// it on pages where the value was non-empty** — a per-key presence assertion is cheaper, sharper
// and fires on the fixture instead of two days later at integration.
//
//   Recompute the inventory:
//     grep -rhoE 'fileData\??\.[a-zA-Z_]+' source/quartz/components/ --include=*.tsx --include=*.ts \
//       | sort | uniq -c | sort -rn
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
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

// The contract, as DATA — so the coverage count below is DERIVED from the table rather than being
// a number typed into a log line that can drift away from what actually ran.
const CONTRACT = [
  // key path                    reads  writer                      expected shape
  ["slug", 15, "processors/parse.ts (DRIVER)", (v) => typeof v === "string" && v.length > 0],
  ["filePath", 3, "processors/parse.ts (DRIVER)", (v) => typeof v === "string" && v.length > 0],
  ["dates.created", 4, "lastmod.ts", (v) => v instanceof Date && Number.isFinite(v.getTime())],
  ["dates.modified", 4, "lastmod.ts", (v) => v instanceof Date && Number.isFinite(v.getTime())],
  ["toc", 4, "toc.ts", (v) => Array.isArray(v) && v.every((e) => typeof e.slug === "string")],
  ["collapseToc", 1, "toc.ts", (v) => typeof v === "boolean"],
  ["frontmatter.title", 2, "frontmatter.ts", (v) => typeof v === "string" && v.length > 0],
  ["frontmatter.cssclasses", 3, "frontmatter.ts", (v) => Array.isArray(v)],
  ["frontmatter.noindex", 1, "frontmatter.ts", (v) => v !== undefined],
  ["frontmatter.lang", 1, "frontmatter.ts", (v) => typeof v === "string"],
  ["description", 3, "description.ts", (v) => typeof v === "string" && v.length > 0],
  ["schemas", 1, "schemaExtractor.ts", (v) => Array.isArray(v)],
]

// A fixture that exercises EVERY key above. It must carry: a title, cssclasses, noindex, lang, a
// description, >1 heading (TOC needs `length > minEntries`, default 1), and a JSON-LD block.
const FIXTURE = `---
title: Contract Fixture
description: A page that exercises every key the components read.
cssclasses:
  - hide-content
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
  for (const [keyPath, , writer, shape] of CONTRACT) {
    const v = dig(file.data, keyPath)
    if (v === undefined) missing.push(`${keyPath}  (written by ${writer})`)
    else if (!shape(v)) malformed.push(`${keyPath} = ${JSON.stringify(v)}  (written by ${writer})`)
  }

  // POSITIVE COVERAGE COUNT, derived from the table, hard-failing on zero (CLAUDE.md §6.6).
  const totalReads = CONTRACT.reduce((n, [, reads]) => n + reads, 0)
  console.log(
    `  coverage: ${CONTRACT.length} page-data keys asserted, covering ${totalReads} component reads`,
  )
  assert.ok(CONTRACT.length >= 12, "the contract table must not be empty or truncated")
  assert.deepEqual(missing, [], "a key the components read was never written")
  assert.deepEqual(malformed, [], "a key was written with the wrong shape")
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
