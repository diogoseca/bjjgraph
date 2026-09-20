// ── GIT-DERIVED DATES: PRESENCE **AND DISTINCTNESS** ──────────────────────────────────────────
//
// `CreatedModifiedDate` (`transformers/lastmod.ts`) resolves each page's dates with the configured
// priority `frontmatter → git → filesystem` (`quartz.config.ts:105-110`). Losing the git tier is
// the **v1.36.1 regression**: every page's `article:published_time` and `dateModified` collapse to
// one filesystem mtime, which is what got ContentMeta removed in the first place.
//
// WHY DISTINCTNESS AND NOT EQUALITY. `check_seo_parity` VOLATILE-normalises dates, and `emit_diff`
// must too, so the collapse is INVISIBLE to a byte-differ: 6,149 pages all carrying one identical
// date compares clean against 6,149 pages carrying 25 different ones. Equality proves nothing here.
// The only assertion that can see the failure is that the SET of emitted values has more than one
// member. That is why the stream-A brief calls it out separately from presence.
//
// MEASURED ON THE GOLDEN (`golden/build0`, 6,149 HTML pages):
//     pages with dateModified   6,110      (39 without — synthetic pages have no filesystem path)
//     DISTINCT dateModified        25      <- the number the collapse would drive to 1
//     DISTINCT datePublished    1,077
// Recompute: see `goldenDateCensus()` below, or the one-liner in reports/quartz-a-recon.md.
//
// ── A SEPARATE FINDING, RECORDED, NOT FIXED (D-03) ────────────────────────────────────────────
// **`datePublished` is build time, not content time.** Zero of 4,600 content files carry any of
// `date`, `lastmod`, `updated`, `last-modified` or `publishDate`:
//     for k in date lastmod updated last-modified publishDate; do \
//       printf "%s %s\n" "$k" "$(grep -rlE "^${k}:" content --include='*.md' | wc -l)"; done   # all 0
// So the `frontmatter` tier never fires, `published` falls to `coerceDate(fp, undefined)` =
// `new Date()`, and the golden shows 1,077 distinct millisecond-resolution values stamped during
// the build itself. That is a real defect and it is NOT this programme's to fix in P1-P4 — it is
// reproduced exactly. It is flagged because (a) any differ MUST normalise `datePublished` or every
// page differs on every build, and (b) a separate worktree is already investigating it.
//
// WHAT THIS FILE DOES NOT COVER (CLAUDE.md §6.9):
//  · It does not pin the libgit2 pathspec derivation — `tests/lastmod_git_path.test.mjs` does that
//    already, against the real API, and this file deliberately does not duplicate it.
//  · The golden census below SKIPS, loudly, when the golden tree is absent, so it is evidence in a
//    developer's tree and not a CI gate. The scratch-repo assertions always run.
//  · MEASURED NON-KILL: a mutant that reorders the priority array to `["git","frontmatter",...]`
//    survives every assertion here, because no corpus file carries frontmatter dates for the two
//    tiers to disagree about. The fixture test below covers the tier ORDER explicitly to close it.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { harnessAvailable, runPipeline, commitFixture } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const GOLDEN = "/home/user/bjj-orchestrator/golden/build0"

test("PRESENCE — every page gets three real Date objects", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const abs = commitFixture("Presence.md", "---\ntitle: P\n---\n\nbody\n", "2026-03-04T05:06:07+00:00")
  const { file } = await runPipeline("---\ntitle: P\n---\n\nbody\n", { slug: "Presence", file: abs })
  const d = file.data.dates
  assert.ok(d, "file.data.dates must be assigned")
  for (const k of ["created", "modified", "published"]) {
    assert.ok(d[k] instanceof Date, `dates.${k} must be a real Date, not a string`)
    assert.ok(Number.isFinite(d[k].getTime()), `dates.${k} must be a valid Date`)
  }
})

test("DISTINCTNESS — two pages committed at different times get different modified dates", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The collapse this guards against makes every page share ONE date. Two fixtures committed at
  // fixed, different author dates must therefore come back different — and must come back as the
  // COMMIT dates, not as the filesystem mtimes, which were both written seconds ago.
  const md = "---\ntitle: D\n---\n\nbody\n"
  const older = commitFixture("DistinctOld.md", md, "2021-01-02T03:04:05+00:00")
  const newer = commitFixture("DistinctNew.md", md, "2024-06-07T08:09:10+00:00")

  const a = await runPipeline(md, { slug: "DistinctOld", file: older })
  const b = await runPipeline(md, { slug: "DistinctNew", file: newer })
  const ma = a.file.data.dates.modified
  const mb = b.file.data.dates.modified

  assert.notEqual(
    ma.getTime(),
    mb.getTime(),
    "two differently-committed pages MUST NOT share a modified date — equal here is the v1.36.1 collapse",
  )
  assert.equal(ma.toISOString(), "2021-01-02T03:04:05.000Z", "modified must be the git commit date")
  assert.equal(mb.toISOString(), "2024-06-07T08:09:10.000Z", "modified must be the git commit date")
  // The filesystem tier would have returned two near-identical mtimes from moments ago. If these
  // ever start matching `Date.now()`, git has silently stopped being consulted.
  assert.ok(
    Date.now() - ma.getTime() > 1000 * 60 * 60 * 24,
    "a modified date within a day of now means the git tier fell through to filesystem mtime",
  )
})

test("TIER ORDER — frontmatter beats git (closes the reordering non-kill)", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const md = "---\ntitle: T\nlastmod: 2019-05-06T07:08:09Z\n---\n\nbody\n"
  const abs = commitFixture("TierOrder.md", md, "2024-06-07T08:09:10+00:00")
  const { file } = await runPipeline(md, { slug: "TierOrder", file: abs })
  assert.equal(
    file.data.dates.modified.toISOString(),
    "2019-05-06T07:08:09.000Z",
    "an authored lastmod must win over the git commit date — priority is [frontmatter, git, filesystem]",
  )
})

test("GOLDEN CENSUS — the emitted corpus really does carry more than one date", async (t) => {
  if (skip) return t.skip("harness unavailable")
  if (!fs.existsSync(GOLDEN)) {
    // A skip PRINTS (CLAUDE.md §6.6).
    console.log(`  SKIP: golden tree absent at ${GOLDEN} — census NOT run, nothing asserted here`)
    return
  }
  const modified = new Set()
  const published = new Set()
  let pages = 0
  let withModified = 0
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".html")) {
        pages += 1
        const s = fs.readFileSync(p, "utf8")
        const m = s.match(/"dateModified":"([^"]*)"/)
        const q = s.match(/"datePublished":"([^"]*)"/)
        if (m) {
          withModified += 1
          modified.add(m[1])
        }
        if (q) published.add(q[1])
      }
    }
  }
  walk(GOLDEN)
  console.log(
    `  coverage: ${pages} pages · ${withModified} with dateModified · ` +
      `${modified.size} distinct dateModified · ${published.size} distinct datePublished`,
  )
  assert.ok(pages > 6000, `expected the full golden tree, walked ${pages} pages`)
  assert.ok(withModified > 6000, `expected dateModified on nearly every page, found ${withModified}`)
  assert.ok(
    modified.size > 1,
    `THE COLLAPSE: ${modified.size} distinct dateModified across ${withModified} pages. ` +
      "One value means git dates were lost and every page now shares a filesystem mtime.",
  )
})
