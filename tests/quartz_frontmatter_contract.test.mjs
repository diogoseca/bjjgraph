// ── THE TWO SILENT KILLERS IN FrontMatter, PROVEN AGAINST THE REAL TRANSFORMER ─────────────────
//
// Both contracts here produce a COMPLETE, PLAUSIBLE, WRONG site when lost: 4,600 pages still
// render, still have a title, still deploy, and every one of them is wrong. That is the class this
// programme exists to prevent, and until this file neither contract had any test at all.
//
// These drive the real `FrontMatter` transformer through `tests/_quartz_pipeline.mjs`; nothing
// here re-implements gray-matter, js-yaml or the normalisation (CLAUDE.md §6.3).
//
// ── CONTRACT 1: `.trim()` BEFORE THE FRONTMATTER PARSE ────────────────────────────────────────
// `processors/parse.ts:86` does `file.value = file.value.toString().trim()` BEFORE any
// textTransform or parse. 4,586 of 4,600 content files begin with blank lines before `---`.
// gray-matter only recognises a frontmatter block at offset 0, so untrimmed it returns `{}` and
// every page falls back to a stem-derived title with no description, no aliases and no noindex.
// MEASURED, both directions, below. This one IS visible to byte-parity — it moves 4,586 pages —
// but a differ tells you 4,586 things changed, not which contract broke.
//
// ── CONTRACT 2: WHICH YAML PARSER, AND UNDER WHICH SCHEMA ─────────────────────────────────────
// `frontmatter.ts:63-68` hands gray-matter an `engines.yaml` override that calls the DIRECTLY
// imported js-yaml (`frontmatter.ts:4`) with `schema: yaml.JSON_SCHEMA`. TWO things hang on it,
// and there are TWO distinct mutants:
//   M-A  drop `schema: yaml.JSON_SCHEMA`  -> direct js-yaml 4.3.1 DEFAULT_SCHEMA
//   M-B  drop the whole `engines` override -> gray-matter's OWN nested js-yaml 3.15.1
// Both are installed; only one is used on this path. Measured difference between all three
// parsers on this corpus: the `timestamp` tag, and on the 4.x axis also merge/binary/omap/pairs/
// set. An unquoted `date: 2026-01-02` becomes a Date object under either mutant and stays a
// string under the contract. That single assertion kills BOTH mutants.
//
// ── RECORDED NON-KILL, SO NOBODY READS THIS FILE AS BROADER THAN IT IS ────────────────────────
// The programme brief, recon §2.7 and OWNERSHIP all state the hazard as *"default YAML 1.1 turns
// yes/no/on/off into booleans, so `noindex: no` flips meaning"*. **That is false for both parsers
// actually reachable here** — js-yaml 3.15.1 already narrowed `bool` to true/false only, and
// js-yaml 4.3.1's default is the YAML 1.2 core schema. `noindex: no` parses to the STRING "no"
// under the contract AND under M-A AND under M-B. So an assertion written from that sentence
// ("noindex: no must stay a string") PASSES ON EVERY MUTANT and is not a gate at all
// (CLAUDE.md §6.3). It is asserted below anyway, explicitly labelled as a non-kill, because the
// sentence is in three programme documents and someone will otherwise re-derive it and believe it.
// Accepted as D-21. The corpus exposure of every tag that DOES differ is **0 of 4,600**, which is
// why byte-parity can never gate contract 2 and why this fixture test is the only instrument for it.
//
// ── MUTATION RESULTS, MEASURED, NOT ASSERTED ──────────────────────────────────────────────────
//   M-A drop `schema: yaml.JSON_SCHEMA`      -> CONTRACT 2 RED   ✓
//   M-B drop the whole `engines` override    -> CONTRACT 2 RED   ✓
//   M-C RemoveDrafts `|| false` -> `=== true`-> CONTRACT 4 RED   ✓
//   M-D remove the title stem fallback       -> CONTRACT 1+3 RED ✓
//   all four                                 -> the noindex test stayed GREEN, as designed
// Re-run: mutate, `node --test tests/quartz_frontmatter_contract.test.mjs`, `git checkout --` it.
//
// ── PARTIALLY PINNED (CLAUDE.md §6.9), THE ONE GAP THAT MATTERS ───────────────────────────────
// CONTRACT 1 proves the `.trim()` contract is REAL and that its loss is DETECTABLE, by driving the
// real transformer both ways. It does **not** pin the call site, `processors/parse.ts:86`: the
// harness performs the trim itself, so a driver that stopped trimming would leave this file GREEN.
// That call site is S1's surface and is being replaced, so a source pin on it would go stale at
// cutover by design. The instrument that closes this is V's transform seam, whose stage-1 record
// is the driver's own output. **Until that seam exists, nothing in this repo gates the trim.**
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { REPO, harnessAvailable, runPipeline, commitFixture } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
// A skip PRINTS. "Never looked" must never read like "found no problems" (CLAUDE.md §6.6).
if (skip) {
  console.log(
    "SKIP: source/node_modules is absent — run `npm install` in source/ before trusting this file",
  )
}

const FIXTURE = `---
title: Authored Title
description: An authored description.
tags: [alpha, Beta]
alias: Another Name
cssclass: wide
noindex: no
date: 2026-01-02
---

# Body Heading

Body text.
`

test("CONTRACT 1 — .trim() is what makes frontmatter parse at all (both directions)", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const leading = "\n\n\n" + FIXTURE

  const trimmed = await runPipeline(leading, { slug: "Trimmed", trim: true })
  const fm = trimmed.file.data.frontmatter
  assert.equal(fm.title, "Authored Title", "trimmed: the authored title must win")
  assert.equal(fm.description, "An authored description.", "trimmed: description must be present")
  assert.deepEqual(fm.aliases, ["Another Name"], "trimmed: aliases must be present")

  // The regression, seeded. If this direction ever stops reproducing, the test above has stopped
  // being able to detect the bug it exists for.
  const untrimmed = await runPipeline(leading, { slug: "Trimmed", trim: false })
  const bad = untrimmed.file.data.frontmatter
  assert.equal(
    bad.title,
    "Trimmed",
    "untrimmed: title must collapse to the file stem — this is the observable symptom on 4,586 pages",
  )
  assert.equal(bad.description, undefined, "untrimmed: the authored description must be lost")
  assert.equal(bad.aliases, undefined, "untrimmed: aliases must be lost")
  assert.notEqual(
    trimmed.file.data.description,
    untrimmed.file.data.description,
    "the two directions must differ, or this fixture is not exercising the contract",
  )
})

test("CONTRACT 1 — corpus exposure: how many files depend on the trim", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const root = path.join(REPO, "content")
  let total = 0
  let atOffsetZero = 0
  let needsTrim = 0
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".md")) {
        total += 1
        const s = fs.readFileSync(p, "utf8")
        if (s.startsWith("---")) atOffsetZero += 1
        else if (s.trimStart().startsWith("---")) needsTrim += 1
      }
    }
  }
  walk(root)
  // POSITIVE COVERAGE COUNT, hard-failing on zero (CLAUDE.md §6.6). A corpus that stopped needing
  // the trim would make the contract-1 gate above vacuous, and this is what says so out loud.
  console.log(
    `  coverage: ${total} content .md · ${needsTrim} require the trim · ${atOffsetZero} start at offset 0`,
  )
  assert.ok(total > 4000, `expected a real corpus, found ${total} markdown files`)
  assert.ok(
    needsTrim > 4000,
    `the .trim() contract is only load-bearing while files need it; found ${needsTrim}`,
  )
  assert.equal(needsTrim + atOffsetZero, total, "every content file must have a frontmatter block")
})

test("CONTRACT 2 — the parser pin: a frontmatter date stays a STRING (kills both mutants)", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const { file } = await runPipeline(FIXTURE, { slug: "Dated" })
  const fm = file.data.frontmatter

  assert.equal(
    typeof fm.date,
    "string",
    "M-A (drop schema: JSON_SCHEMA) and M-B (drop the engines override) both turn this into a Date",
  )
  assert.equal(fm.date, "2026-01-02", "the authored bytes must survive verbatim")
  assert.ok(
    !(fm.date instanceof Date),
    "a Date here silently moves article:published_time and dateModified on every dated page",
  )
})

test("CONTRACT 2 — RECORDED NON-KILL: noindex: no is a string under the contract AND both mutants", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const { file } = await runPipeline(FIXTURE, { slug: "NoIndex" })
  assert.equal(file.data.frontmatter.noindex, "no")
  assert.equal(
    typeof file.data.frontmatter.noindex,
    "string",
    "true under the contract and under BOTH mutants — asserted for the record, NOT a gate (D-21)",
  )
  // Head.tsx reads noindex with strict `=== true`, so the string "no" is falsy for its purposes
  // either way. The asymmetry with RemoveDrafts' truthiness is inherited and deliberate
  // (INTERFACE.md §2); reproducing it exactly is the P1-P4 contract, not a defect to fix.
  assert.notEqual(file.data.frontmatter.noindex, true, "strict === true must not match the string")
})

test("CONTRACT 3 — frontmatter normalisation: coalescing, coercion and the stem fallback", async (t) => {
  if (skip) return t.skip("harness unavailable")

  const { file } = await runPipeline(FIXTURE, { slug: "Norm" })
  const fm = file.data.frontmatter
  assert.deepEqual(fm.tags, ["alpha", "Beta"], "tags survive slugTag without being lower-cased")
  assert.deepEqual(fm.aliases, ["Another Name"], "the singular `alias` key coalesces into `aliases`")
  assert.deepEqual(fm.cssclasses, ["wide"], "the singular `cssclass` key coalesces into `cssclasses`")
  assert.equal(fm.alias, "Another Name", "the ORIGINAL authored key must survive normalisation")

  // A scalar comma list becomes an array; a numeric tag becomes a string.
  const scalar = await runPipeline("---\ntitle: T\ntags: one, two\n---\n\nx\n", { slug: "Scalar" })
  assert.deepEqual(scalar.file.data.frontmatter.tags, ["one", "two"], "scalar tags comma-split")

  // Missing / empty title falls back to the file stem, never to empty.
  const noTitle = await runPipeline("---\ndescription: d\n---\n\nx\n", { slug: "Folder/Stemmed" })
  assert.equal(
    noTitle.file.data.frontmatter.title,
    "Stemmed",
    "an absent title must fall back to the file stem",
  )
  const emptyTitle = await runPipeline('---\ntitle: ""\n---\n\nx\n', { slug: "Folder/Emptied" })
  assert.equal(
    emptyTitle.file.data.frontmatter.title,
    "Emptied",
    "an EMPTY title must also fall back to the stem, not stay empty",
  )
})

test("CONTRACT 4 — RemoveDrafts: the filter that currently removes nothing", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const { loadConfig } = await import("./_quartz_pipeline.mjs")
  const cfg = await loadConfig()
  const removeDrafts = cfg.plugins.filters.find((f) => f.name === "RemoveDrafts")
  assert.ok(removeDrafts, "name-keyed lookup must match — a plugin name is not its exported symbol")

  const published = await runPipeline("---\ntitle: T\n---\n\nx\n", { slug: "Pub" })
  const drafted = await runPipeline("---\ntitle: T\ndraft: true\n---\n\nx\n", { slug: "Draft" })
  assert.equal(removeDrafts.shouldPublish({}, [published.tree, published.file]), true)
  assert.equal(removeDrafts.shouldPublish({}, [drafted.tree, drafted.file]), false)

  // TRUTHINESS, not `=== true` — deliberately asymmetric with Head.tsx's noindex (INTERFACE.md §2).
  // The string "false" is TRUTHY, so it unpublishes. Pinned so the asymmetry cannot be "tidied up".
  const stringy = await runPipeline('---\ntitle: T\ndraft: "false"\n---\n\nx\n', { slug: "S" })
  assert.equal(
    removeDrafts.shouldPublish({}, [stringy.tree, stringy.file]),
    false,
    'draft: "false" is a truthy string and DOES unpublish — inherited behaviour, reproduced exactly',
  )

  // A filter that removes nothing and a filter that never ran emit the same result (CLAUDE.md §6.6),
  // so say out loud how many real pages it currently touches.
  const drafts = fs
    .readFileSync(path.join(REPO, "package.json"), "utf8") && // (keeps the walk below honest about REPO)
    (() => {
      let n = 0
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name)
          if (e.isDirectory()) walk(p)
          else if (e.name.endsWith(".md") && /^draft:/m.test(fs.readFileSync(p, "utf8"))) n += 1
        }
      }
      walk(path.join(REPO, "content"))
      return n
    })()
  console.log(`  coverage: RemoveDrafts currently filters ${drafts} of the corpus's pages`)
  assert.equal(
    drafts,
    0,
    "no content file carries a draft key today; if this ever becomes non-zero the emitted page " +
      "count changes and build0's archetype counts move with it",
  )
})
