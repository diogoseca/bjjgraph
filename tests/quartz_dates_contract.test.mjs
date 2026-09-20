// ── DATES: WHAT IS FIXED, AND WHAT IS IN MOTION ───────────────────────────────────────────────
//
// `CreatedModifiedDate` (`transformers/lastmod.ts`) resolves dates with the configured priority
// `frontmatter → git → filesystem` (`quartz.config.ts:110`). Losing the git tier is the **v1.36.1
// regression**: every page's dates collapse to one filesystem mtime, which is what got ContentMeta
// removed in the first place.
//
// ── THIS FILE WAS TESTING THE BUG, AND TWO REPLACEMENT DESIGNS WERE ALSO WRONG ────────────────
// Its original `PRESENCE` test asserted all THREE of created/modified/published are real Dates.
// That was true only while `coerceDate` returned `new Date()` for a missing value — so **it could
// only ever have passed by accident of the clock.** The integrated `lastmod.ts` returns `undefined`
// instead (`:27`), and `:158-159` keep `?? new Date()` for created and modified while `:160` is
// `published: publicationDate` with NO fallback.
//
// **AND THOSE TWO FALLBACKS ARE NEVER REACHED ON THIS CORPUS — measured, not assumed.** The configured priority is
// `["frontmatter","git","filesystem"]` and the filesystem branch does `created ||= st.birthtimeMs`
// / `modified ||= st.mtimeMs` UNCONDITIONALLY, so by the time `:158-159` run, both already hold a
// value. Deleting BOTH `?? new Date()` clauses turns nothing in this file red (5 pass, 0 fail).
// So created and modified are always present because of the FILESYSTEM TIER, not because of the
// fallback — the fallback is a constant with a function around it (CLAUDE.md §6.6) and would only
// fire if `filesystem` were dropped from the priority array or `stat` threw. It stays under D-03;
// it is documented here so nobody reads the assertion as gating it.
//
// **PRECISION, because "unreachable" and "never reached in this corpus" are different claims and
// only the second is measured:** `coerceDate` treats `getTime() === 0` as invalid, so a file whose
// birthtime is exactly the Unix epoch WOULD reach the fallback. Vanishingly rare, and it does not
// change the conclusion — but the honest statement is *practically* dead, not *provably* dead.
//
// ── AND THE CONSEQUENCE THAT MATTERS MORE THAN THE CORRECTION ─────────────────────────────────
// If the guarantee comes from the FILESYSTEM TIER and not from a code fallback, then "modified is
// always present" rests on **a config entry** — the string `"filesystem"` in
// `quartz.config.ts:110`'s priority array — and on nothing in `lastmod.ts` at all. Delete that one
// string and `modified` can go absent, the dead fallback will NOT catch it, and stream F's
// both-tags contract goes red for a genuinely new reason that nobody would connect to a config
// edit. A comment pointing at a line that cannot execute is not a guard. The test below is.
//
// Two replacement designs were written and withdrawn before either shipped:
//   1. "`published` is ABSENT when neither key is authored" — 4,600 of 4,600 today, and WRONG as a
//      contract: publication dates are to be derived from git, so the field returns on ~6,118 pages.
//   2. "authored → Date, unauthored → undefined" — the second half dies for the same reason.
// Both encoded TODAY. The rule that replaced them, and the one this file is built on:
// **IDENTIFY WHICH FACTS ARE IN MOTION, AND ASSERT ONLY AROUND THEM.**
//
//   FIXED  : created and modified are real Dates · an AUTHORED value beats a DERIVED one ·
//            when published is present its spread must not collapse
//   IN MOTION: whether `published` is present at all, and on how many pages
//
// Note assertion 2's shape. It is NOT "an authored publishDate produces exactly that Date": that
// flat form holds only while the git tier sits BELOW frontmatter in the priority loop. Written as
// **authored beats derived** it survives either implementation and fails only if the ordering is
// genuinely inverted — which makes it a stated acceptance condition on the git-derived work rather
// than a private assumption of this spec.
//
// ── WHY SPREAD AND NOT CARDINALITY — B'S REFUTATION, REPRODUCED HERE ──────────────────────────
// The obvious assertion is "more than one distinct value". **It passes on the exact data we call
// broken.** Measured on golden/build0: `datePublished` has 6,110 pages and **1,077 distinct
// values** — which looks healthy — and **all 1,077 fall inside 1.557 seconds on one calendar day**,
// because the field was the checkout mtime. Cardinality separates none of the three states we care
// about; spread separates all of them. So the assertion is three parts, all required:
// **distinct_days**, **span_days**, and **no single day holding more than a fraction**.
//
// FLOORS ARE PER-FIELD AND COME FROM MEASUREMENT. A 25% single-day floor sounds generous and is a
// FALSE RED on correct data: healthy `modified` has 37.7% on one day because content lands in
// batches. And the floors cannot be shared — healthy `modified` has ~17 distinct days, healthy
// `published` should have hundreds, so one floor would make the other field's rule useless.
//
// ── WHAT THIS FILE DOES NOT COVER (CLAUDE.md §6.9) ────────────────────────────────────────────
//  · It does not pin the libgit2 pathspec derivation — `tests/lastmod_git_path.test.mjs` does that
//    against the real API, and this file deliberately does not duplicate it.
//  · The golden census SKIPS, loudly, when the golden tree is absent. The scratch-repo assertions
//    always run.
//  · golden/build0 PREDATES `c55735dc4`, so its `datePublished` is the pre-fix shape. It is used as
//    the CONTROL — every part must FAIL on it — never as a candidate. See GOLDEN-RECAPTURE.md.
//
// ── MUTATION TABLE, MEASURED ──────────────────────────────────────────────────────────────────
//   DD-B  `published` computed after the loop, so derived beats authored -> test 2 RED  ✓
//         (this is the acceptance condition on the git-derived work, and it fires)
//   DD-C  `published` emitted as a STRING rather than a Date          -> tests 1+2 RED  ✓
//   DD-A  `created` loses its `?? new Date()`                         -> **SURVIVES**, and so does
//         deleting BOTH fallbacks. NOT a gap in the assertions — the code is unreachable, as the
//         header explains. Recorded so nobody later reads this file as covering it.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { REPO, harnessAvailable, runPipeline, commitFixture } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const GOLDEN = "/home/user/bjj-orchestrator/golden/build0"

test("PRESENCE — created and modified are real Dates. THOSE TWO AND ONLY THOSE TWO.", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const abs = commitFixture("Presence.md", "---\ntitle: P\n---\n\nbody\n", "2026-03-04T05:06:07+00:00")
  const { file } = await runPipeline("---\ntitle: P\n---\n\nbody\n", { slug: "Presence", file: abs })
  const d = file.data.dates
  assert.ok(d, "file.data.dates must be assigned")
  // Stable across the transition — but because the FILESYSTEM TIER always supplies both, not
  // because of the `?? new Date()` at :158-159, which is unreachable. See the header.
  for (const k of ["created", "modified"]) {
    assert.ok(d[k] instanceof Date, `dates.${k} must be a real Date, not a string`)
    assert.ok(Number.isFinite(d[k].getTime()), `dates.${k} must be a valid Date`)
  }
  // `published` (`:160`) has NO fallback. Its PRESENCE is the fact in motion, so only its SHAPE is
  // asserted — absent, or a real Date, never a string and never an Invalid Date.
  assert.ok(
    d.published === undefined || (d.published instanceof Date && Number.isFinite(d.published.getTime())),
    "dates.published must be absent or a real Date — never a string, number or Invalid Date",
  )
})

test("AUTHORED BEATS DERIVED — the property that survives either implementation", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // NOT "an authored publishDate produces exactly that Date". That flat form holds only while the
  // git tier sits BELOW frontmatter in `lastmod.ts`'s priority loop: `published` is set at :65
  // inside the `source === "frontmatter"` branch, the loop walks `opts.priority` with `||=`, and
  // first-writer-wins. If the git-derived work adds a branch to that loop, the flat form survives;
  // if it computes `published` AFTER the loop or unconditionally, authored values lose and the flat
  // assertion breaks — the same way the two designs this file already discarded broke.
  // So assert the PROPERTY, which survives either implementation and goes red only if the ordering
  // is genuinely inverted. That is a stated acceptance condition on the git-derived work, not a
  // private assumption of this spec.
  const md = "---\ntitle: A\npublishDate: 2019-05-06T07:08:09Z\n---\n\nbody\n"
  const abs = commitFixture("AuthoredWins.md", md, "2024-06-07T08:09:10+00:00")
  const { file } = await runPipeline(md, { slug: "AuthoredWins", file: abs })
  assert.ok(file.data.dates.published instanceof Date, "an authored publishDate must be honoured")
  assert.equal(
    file.data.dates.published.toISOString(),
    "2019-05-06T07:08:09.000Z",
    "the AUTHORED value must win: the git commit date is 2024-06-07, and if it appears here the " +
      "derivation has been placed above the frontmatter tier",
  )
  // `date` is the second accepted spelling, added by the same fix (`publishDate ?? date`).
  const md2 = "---\ntitle: B\ndate: 2018-01-02T03:04:05Z\n---\n\nbody\n"
  const abs2 = commitFixture("AuthoredWins2.md", md2, "2024-06-07T08:09:10+00:00")
  const r2 = await runPipeline(md2, { slug: "AuthoredWins2", file: abs2 })
  assert.equal(r2.file.data.dates.published.toISOString(), "2018-01-02T03:04:05.000Z")
})

test("THE FILESYSTEM TIER IS WHAT GUARANTEES modified — and it rests on a config entry", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // An UNCOMMITTED fixture: frontmatter supplies no dates and the git tier throws for a file git
  // does not know, so ONLY the filesystem tier can supply `modified`. That isolates the tier the
  // guarantee actually depends on, without this test having to read the config.
  //
  // Remove "filesystem" from `quartz.config.ts:110`'s priority and this goes RED — which is the
  // whole point, because the `?? new Date()` at lastmod.ts:159 is dead code that would not catch
  // it and every other assertion in this file would stay green.
  const md = "---\ntitle: Untracked\n---\n\nbody\n"
  const { file } = await runPipeline(md, { slug: "UntrackedByGit" })
  const d = file.data.dates

  assert.ok(
    d.modified instanceof Date && Number.isFinite(d.modified.getTime()),
    "modified must survive when neither frontmatter nor git can supply it — the filesystem tier " +
      "is the only remaining source, and it is a CONFIG entry rather than a code guarantee",
  )
  assert.ok(
    d.created instanceof Date && Number.isFinite(d.created.getTime()),
    "created likewise comes from st.birthtimeMs via the filesystem tier",
  )
  // ── THE ASSERTION MUST BE EXACT mtime EQUALITY, AND HERE IS WHY ──────────────────────────
  // The first version of this test asserted only "modified is recent". IT SURVIVED THE MUTANT IT
  // WAS WRITTEN TO CATCH: deleting "filesystem" from the priority array left all six tests green.
  // The reason corrects the premise this test was built on — **the `?? new Date()` fallback is not
  // dead, it is DORMANT, and it goes live exactly when the filesystem tier is removed.** So
  // dropping that config string does NOT make `modified` absent; it makes it `new Date()`, i.e.
  // BUILD TIME, identical on every page — the v1.36.1 collapse, arriving silently through the very
  // fallback that looked like a safety net. "Recent" cannot tell the two apart, because build time
  // is recent too.
  // Exact equality with the file's own mtime can: the filesystem tier yields st.mtimeMs to the
  // millisecond, while `new Date()` lands however long the run has taken since (measured ~200ms).
  const st = fs.statSync(file.data.filePath)
  assert.ok(
    Math.abs(d.modified.getTime() - st.mtimeMs) < 2,
    `modified must BE the file's mtime (${new Date(st.mtimeMs).toISOString()}), not merely recent. ` +
      `Got ${d.modified.toISOString()}. A near-but-not-equal value means the dormant ` +
      "`?? new Date()` fallback supplied it, which is build time on every page.",
  )
  // `published` still has no source, and still must not be invented.
  assert.equal(d.published, undefined, "no authored date means no publication date, not a stamp")
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

// Per-field floors. DERIVED FROM MEASUREMENT, never from intuition — see GOLDEN-RECAPTURE.md's
// calibration section. A floor picked from the shape of the worry rather than from the data is a
// false red waiting to happen, and one was: a 25% single-day floor sounds generous and FAILS on
// data everyone agrees is correct, because content legitimately lands in batches.
const FLOORS = {
  // MEASURED on golden/build0: 6,110 pages, 17 distinct days, 116-day span, busiest day 37.7%.
  // Floors set with real headroom below the measurement, not just under it.
  modified: { minDistinctDays: 12, minSpanDays: 30, maxDayShare: 0.5 },
  // DELIBERATELY EMPTY SLOT. `published` is absent today, so there is nothing to measure and any
  // number here would be invented. When git-derived publication dates land, fill it FROM THE
  // MEASUREMENT — and not from whatever the first run happens to produce, because a floor set just
  // under the first run is a baseline that can never fail (CLAUDE.md §8).
  // It must clear the known failure shape by a wide margin: a naive `git log --diff-filter=A`
  // collapses to ~4 distinct dates, because 05bcc83c2 added 1,057 content files in one commit.
  // ~2 years of real provenance across 4,600 files should give HUNDREDS of distinct days, so a
  // floor of 100+ clears four by 25x. THE distinct_days FLOOR IS THE LOAD-BEARING ONE: four bulk
  // days at ~25% each pass a 50% single-day floor, and if they span a year they pass the span
  // floor too. Neither of the other two rules catches that collapse alone.
  published: { minDistinctDays: null, minSpanDays: null, maxDayShare: 0.5 },
}

/** Profile a field for SPREAD, not cardinality. Cardinality is printed and explicitly not the test:
 *  build0's `datePublished` has 1,077 distinct values and all of them fall inside 1.557 seconds. */
function profile(values) {
  const days = new Map()
  for (const v of values) days.set(v.slice(0, 10), (days.get(v.slice(0, 10)) ?? 0) + 1)
  const times = values.map((v) => Date.parse(v)).sort((a, b) => a - b)
  const busiest = [...days.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["-", 0]
  return {
    pages: values.length,
    distinctValues: new Set(values).size,
    distinctDays: days.size,
    spanDays: values.length ? (times[times.length - 1] - times[0]) / 86400000 : 0,
    maxDayShare: values.length ? busiest[1] / values.length : 0,
    busiestDay: busiest[0],
  }
}

// ── THIS GATE IS NOT published-ONLY. IT IS THE STANDING GUARD FOR THE DORMANT FALLBACK. ──────
// Written as the acceptance condition for git-derived publication dates — but it catches the
// `modified` collapse too, corpus-wide, and that convergence is worth stating so the next reader
// does not scope it narrowly.
//
// If `"filesystem"` is ever dropped from `quartz.config.ts`'s priority array, the dormant
// `?? new Date()` at `lastmod.ts:159` goes live and `modified` becomes BUILD TIME on every page.
// Run the three parts against that and ALL THREE FAIL: distinct_days 1, span ~0, max_day_share
// 100% — the exact profile the pre-fix `datePublished` control exhibits below.
//
// So there are two independent guards on the same failure, catching it at different scales:
//   · the fixture test above    — exact mtime equality, one file, fails immediately on the edit
//   · this census               — corpus-wide, fails even if that 2ms discriminator is ever
//                                 weakened, or if the config edit happens somewhere nobody
//                                 thought to add a fixture
// Neither subsumes the other. The fixture is fast and precise; the census cannot be evaded by
// making one file look right.
test("GOLDEN CENSUS — SPREAD, not cardinality: three parts, all of which must hold", async (t) => {
  if (skip) return t.skip("harness unavailable")
  if (!fs.existsSync(GOLDEN)) {
    console.log(`  SKIP: golden tree absent at ${GOLDEN} — census NOT run, nothing asserted here`)
    return
  }
  // ── ASSERT THE GOLDEN'S CONTENT PROVENANCE AT USE TIME (COORDINATION §7N) ──────────────────
  // RECORDING PROVENANCE IS NOT ASSERTING IT. `golden/build0.env.txt` records git_head
  // 308d6f577 — a DIFFERENT commit from the seams' f649801a9 — and also `git_dirty 4 path(s)`.
  // This census reads that golden and asserts a property of the corpus, so if `content/` has moved
  // since capture it is comparing across two trees and the verdict is meaningless.
  //
  // Six scheduled workflows commit to this repo across a ~40-hour weekend window (votes-refresh,
  // seo-monitor, validation-fixer, content-improvement-bot, analytics-content-improvement,
  // proofread-bot) and ALL SIX PUSH DIRECTLY — none opens a PR. So content expires on a CLOCK, not
  // on a change anyone makes deliberately, and there is no merge step at which to hold it.
  //
  // Comparing the `content/` TREE OBJECT rather than the commit is what makes this survive: two
  // different capture commits can describe an identical corpus, and here they do.
  // CAVEAT, stated because the recorded provenance carries one: build0 was captured from a DIRTY
  // tree. A matching tree id is therefore necessary but not sufficient — it cannot see an
  // uncommitted edit that was present at capture. Nothing available now can.
  const buildEnv = "/home/user/bjj-orchestrator/golden/build0.env.txt"
  if (fs.existsSync(buildEnv)) {
    const head = (fs.readFileSync(buildEnv, "utf8").match(/git_head\s+(\S+)/) || [])[1]
    let goldenContent = null
    let hereContent = null
    try {
      goldenContent = execFileSync("git", ["rev-parse", `${head}:content`], { cwd: REPO, encoding: "utf8" }).trim()
      hereContent = execFileSync("git", ["rev-parse", "HEAD:content"], { cwd: REPO, encoding: "utf8" }).trim()
    } catch (err) {
      // DO NOT SWALLOW A PROGRAMMING ERROR AS A DATA VERDICT. The first version of this block had
      // a bare `catch` and an undefined `REPO`, so a ReferenceError in MY OWN CODE was reported as
      // the calm, plausible sentence "provenance: UNKNOWN — cannot resolve <sha>:content", which
      // reads exactly like a legitimately unreachable commit. It took a shell comparison to notice
      // the commit resolved fine. A catch that cannot tell "the data is absent" from "this check is
      // broken" will always report the former (CLAUDE.md §6.6).
      if (err instanceof ReferenceError || err instanceof TypeError) throw err
      console.log(`  provenance: UNKNOWN — git could not resolve ${head}:content (${err.message.split("\n")[0]})`)
    }
    if (goldenContent && hereContent) {
      console.log(
        `  provenance: golden captured at ${head.slice(0, 9)}, content tree ` +
          `${goldenContent.slice(0, 12)} vs HEAD ${hereContent.slice(0, 12)}`,
      )
      assert.equal(
        hereContent,
        goldenContent,
        "content/ has MOVED since this golden was captured, so the census is comparing two " +
          "different corpora and its verdict is meaningless. Six scheduled bots push to content/ " +
          "directly every weekend; re-capture (GOLDEN-RECAPTURE.md) rather than reinterpreting.",
      )
    }
  } else {
    console.log(`  provenance: UNKNOWN — ${buildEnv} absent, cannot check the golden's corpus`)
  }

  const modified = []
  const published = []
  let pages = 0
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".html")) {
        pages += 1
        const s = fs.readFileSync(p, "utf8")
        const m = s.match(/"dateModified":"([^"]*)"/)
        const q = s.match(/"datePublished":"([^"]*)"/)
        if (m) modified.push(m[1])
        if (q) published.push(q[1])
      }
    }
  }
  walk(GOLDEN)

  const mp = profile(modified)
  console.log(
    `  modified : ${mp.pages} pages · ${mp.distinctValues} distinct values (NOT the test) · ` +
      `${mp.distinctDays} days · ${mp.spanDays.toFixed(1)}d span · ` +
      `busiest ${(100 * mp.maxDayShare).toFixed(1)}% on ${mp.busiestDay}`,
  )

  // POSITIVE COVERAGE, hard-failing on zero (CLAUDE.md §6.6).
  assert.ok(pages > 6000, `expected the full golden tree, walked ${pages} pages`)
  assert.ok(mp.pages > 6000, `expected dateModified on nearly every page, found ${mp.pages}`)

  const f = FLOORS.modified
  assert.ok(
    mp.distinctDays >= f.minDistinctDays,
    `distinct_days ${mp.distinctDays} >= ${f.minDistinctDays}. THIS IS THE LOAD-BEARING RULE: a ` +
      "derivation that collapses to a handful of bulk-commit days passes the other two.",
  )
  assert.ok(mp.spanDays >= f.minSpanDays, `span_days ${mp.spanDays.toFixed(1)} >= ${f.minSpanDays}`)
  assert.ok(
    mp.maxDayShare <= f.maxDayShare,
    `max_day_share ${mp.maxDayShare.toFixed(3)} <= ${f.maxDayShare} (busiest ${mp.busiestDay})`,
  )

  // ── `published`: the golden is the PRE-FIX CONTROL, not a candidate ─────────────────────────
  // golden/build0 predates c55735dc4 (GOLDEN-RECAPTURE.md), so its datePublished is the OLD shape:
  // 1,077 distinct values inside 1.557 seconds, 100% on one day. Asserting the floors against it
  // would fail for a reason that is not a regression. Instead it is used as the CONTROL — every
  // part MUST fail on it, because a control the assertion passes is not a control.
  if (published.length) {
    const pp = profile(published)
    console.log(
      `  published: ${pp.pages} pages · ${pp.distinctValues} distinct values (NOT the test) · ` +
        `${pp.distinctDays} days · ${pp.spanDays.toFixed(3)}d span · ` +
        `busiest ${(100 * pp.maxDayShare).toFixed(1)}% on ${pp.busiestDay}  [PRE-FIX CONTROL]`,
    )
    assert.ok(
      pp.distinctDays < FLOORS.modified.minDistinctDays &&
        pp.spanDays < FLOORS.modified.minSpanDays &&
        pp.maxDayShare > FLOORS.modified.maxDayShare,
      "the pre-fix golden must FAIL all three parts — if it passes any, the floors are too weak " +
        "to detect the very collapse they exist for",
    )
  } else {
    // COORDINATION §7B: "I looked and found nothing" and "I could not look" must not render the
    // same. An absent field is NOT a clean spread result.
    console.log(
      "  published: NO VERDICT — not emitted on any golden page. Nothing to measure the spread of.",
    )
  }
})
