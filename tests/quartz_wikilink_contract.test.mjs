// ── WIKILINK RESOLUTION: THE FOURTH SILENT KILLER, AND ITS FIRST TEST ─────────────────────────
//
// `CrawlLinks` (plugin name **"LinkProcessing"**, `transformers/links.ts:39` — the name is not the
// exported symbol, and a name-keyed enumeration that assumes otherwise matches nothing) resolves
// every internal link through `transformLink` in `util/path.ts`, which this repo has extended with
// ~162 project-authored lines of context-aware partial-path matching (`buildSlugIndex`,
// `transformLink`'s `"shortest"` branch). It is instantiated with
// `markdownLinkResolution: "shortest"` — **not** the `"absolute"` default in `links.ts:29`.
//
// `util/path.ts` is FROZEN VERBATIM (D-01). This file READS it and asserts on it; it never changes
// it. It deliberately does NOT encode `util/path.test.ts`'s expectations: that file is **5 of 17
// red today** and describes the OLD contract (recon R15). Porting its expectations would silently
// re-point wikilinks across the corpus, which is the exact failure this test exists to prevent.
//
// ── THE RESOLUTION LADDER, MEASURED THROUGH THE REAL PIPELINE ─────────────────────────────────
// `"shortest"` tries four steps in order and then FALLS THROUGH. Each step below is asserted with
// a fixture that can only be satisfied by that step:
//   STEP 1  partial path relative to the source directory, or a `/`-containing suffix match
//   STEP 2  same-directory sibling
//   STEP 3  subdirectory named after the SOURCE FILE (single-segment targets only)
//   STEP 4  globally unique filename — and ONLY when exactly one slug has it
//   else    `joinSegments(pathToRoot(src), canonicalSlug)` — a root-relative path, unresolved
//
// ── THE FINDING THIS FILE EXISTS TO RECORD (cross-stream) ─────────────────────────────────────
// **`[[game-over]]` is NOT resolved. It falls through, exactly like a typo.**
// `content/Game Over.md` slugifies to `Game-Over`; the lowercase `game-over` is a frontmatter
// ALIAS, and `ctx.allSlugs` is built from content files only, so `game-over` is absent from every
// index. Measured, both emit a root-relative URL by the same line of code:
//     [[game-over]]        -> ../../game-over        (works, because AliasRedirects emits it)
//     [[Nonexistent Page]] -> ../../Nonexistent-Page (dead link)
// **668 content files** use `[[game-over]]` — and the ONLY reason it works is that an emitter in
// stream B materialises `game-over.html`. `path.ts` cannot tell the two cases apart, so nothing in
// stream A can detect it if that emitter changes. Recorded, not fixed (D-03).
//   Recompute: grep -rl '\[\[game-over\]\]' content --include='*.md' | wc -l
//   (CLAUDE.md §7 says 681 for the same claim; measured here as 668 — the figure has drifted.)
//
// ── WHAT THIS FILE DOES NOT COVER (CLAUDE.md §6.9) ────────────────────────────────────────────
//  · **OUT OF SCOPE, AND IT IS THE MOST IMPORTANT LINE IN THIS HEADER (D-44):** nothing here — and
//    nothing anywhere in stream A — can detect `AliasRedirects` changing. That emitter is stream
//    B's (`plugins/emitters/aliases.ts`) and it is the ONLY reason `[[game-over]]` works:
//    `golden/build0/game-over.html` is a **380-byte stub** it produced. If it stops emitting that
//    route, 668 files' most common link breaks while every assertion in this file stays GREEN,
//    because from `path.ts`'s perspective nothing changed. The ownership split that stops two
//    streams colliding is exactly what hides this, so it is written down rather than assumed.
//    quartz-cto has told B not to touch `AliasRedirects` without telling A.
//  · It does not prove any emitted link RESOLVES to a real page. That needs the emitters and the
//    alias routes, which are stream B's; a link can be perfectly transformed and still be dead.
//  · It does not cover `"absolute"` or `"relative"`, which this site does not instantiate.
//
// ── MUTATION TABLE, MEASURED ──────────────────────────────────────────────────────────────────
//   W-A  STEP 3 (file-named subdirectory) removed      -> 3 tests RED  ✓
//   W-B  STEP 4 uniqueness guard `=== 1` -> `>= 1`     -> 2 tests RED  ✓
//   W-C  indexed branch loses suffix matching only     -> 1 test  RED  ✓ (the differential)
//   W-D  external-link icon removed                    -> 1 test  RED  ✓
//   W-E  STEP 2 (same-directory sibling) removed       -> 0 tests red  ✗ SURVIVES, see below
//   W-F  STEP 1 (byExactPath) removed                  -> 0 tests red  ✗ SURVIVES, see below
//   W-E and W-F applied TOGETHER                       -> 3 tests RED  ✓
//
// W-A and W-B survived the FIRST version of this file, and the fix was not a better assertion but
// a better FIXTURE: `Top` and `Guard` were globally unique, so STEP 4 silently rescued the STEP 2
// and STEP 3 cases and the mutants passed a green suite. Both filenames are now deliberately
// ambiguous. That is the mutation discipline earning its place — the assertions were right and
// the corpus they ran against could not tell the rungs apart.
//
// ── WHY W-E AND W-F CANNOT BE KILLED INDIVIDUALLY (measured, not assumed) ─────────────────────
// STEP 1 looks up `${srcDir}/${target}` in `byExactPath`; STEP 2 looks up `${srcDir}:${target}` in
// `byDirAndFile`. For a single-segment target these are THE SAME QUERY in two spellings: measured
// over this fixture set, they agree on **96 of 100** lookups. They diverge only when `srcDir` is
// `""` — a ROOT-LEVEL source — where STEP 1 builds the key `"/index"` and misses, and only STEP 2
// resolves. So STEP 2 is not dead code; it is the rung that carries root-level pages.
// But at a root-level source, STEP 2's answer and the fallthrough's answer are the SAME STRING
// (`pathToRoot("index") + "Top"` == `../Top`), so no href-based fixture can separate them either.
// Hence: individually unkillable by construction, killable as a pair, and recorded here rather
// than papered over. `util/path.ts` is frozen (D-01) and P1-P4 reproduces rather than improves
// (D-03), so this is a note for whoever eventually owns that file, not a defect to fix now.
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline, loadQuartzModule } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

// Shaped like the real corpus: a folder page, a file-named subdirectory, unique leaves — AND a
// DELIBERATELY AMBIGUOUS filename. `Top` appears at BOTH `Positions/Mount/Top` and
// `Transitions/Top`, which is not decoration: without it, STEP 4's global-unique lookup silently
// rescues the STEP 3 fixture and two mutants survive. See the mutation table in the header.
const SLUGS = [
  "index",
  "Game-Over",
  "Positions/Mount",
  "Positions/Mount/Top",
  "Positions/Guard",
  "Submissions/Guard",
  "Transitions/Top",
  "Transitions/Knee-Slice-Pass",
  "Submissions/Armbar",
  "Submissions/Kimura",
]

async function hrefOf(wikilink, slug) {
  const { html } = await runPipeline(`---\ntitle: T\n---\n\n${wikilink}\n`, {
    slug,
    allSlugs: SLUGS,
  })
  return {
    href: html.match(/href="([^"]*)"/)?.[1] ?? null,
    dataSlug: html.match(/data-slug="([^"]*)"/)?.[1] ?? null,
    html,
  }
}

test("THE FOUR-STEP LADDER — each step, with a fixture only that step can satisfy", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const cases = [
    ["STEP 1 full path", "[[Positions/Guard]]", "Positions/Mount", "../../Positions/Guard", "Positions/Guard"],
    ["STEP 2 sibling", "[[Guard]]", "Positions/Mount", "../../Positions/Guard", "Positions/Guard"],
    ["STEP 3 file-named subdir", "[[Top]]", "Positions/Mount", "../../Positions/Mount/Top", "Positions/Mount/Top"],
    ["STEP 4 unique filename", "[[Armbar]]", "Positions/Mount", "../../Submissions/Armbar", "Submissions/Armbar"],
  ]
  for (const [label, wl, from, expectHref, expectSlug] of cases) {
    const { href, dataSlug } = await hrefOf(wl, from)
    assert.equal(href, expectHref, `${label}: href`)
    assert.equal(dataSlug, expectSlug, `${label}: data-slug feeds ContentIndex and the graph`)
  }
  console.log(`  coverage: ${cases.length} resolution steps exercised`)
  assert.ok(cases.length === 4, "all four steps must be covered, or the ladder is only partly pinned")
})

test("AMBIGUITY — STEP 4 resolves ONLY a unique filename, and never guesses", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `Top` exists at Positions/Mount/Top AND Transitions/Top. From `index` neither STEP 1, 2 nor 3
  // can apply, so STEP 4 is reached with two candidates and MUST decline — falling through to the
  // root-relative form rather than silently picking the first match. Relaxing STEP 4's
  // `length === 1` guard to `>= 1` makes it pick one, and this is what catches that.
  const ambiguous = await hrefOf("[[Top]]", "index")
  assert.equal(
    ambiguous.href,
    "../Top",
    "an ambiguous filename must FALL THROUGH, not resolve to whichever slug happens to be first",
  )
  // The same target from a directory where a sibling exists resolves by STEP 2, not by guessing.
  const sibling = await hrefOf("[[Top]]", "Transitions/Knee-Slice-Pass")
  assert.equal(sibling.href, "../../Transitions/Top", "STEP 2 resolves the sibling unambiguously")

  // STEP 2 under ambiguity: `Guard` exists in two directories, so ONLY the same-directory rung can
  // resolve it and STEP 4 must decline. The same wikilink text therefore resolves to two different
  // pages depending on where it was written — which is the whole point of the project-authored
  // context-aware matching, and what a plain global-filename resolver would get wrong.
  const guardFromPositions = await hrefOf("[[Guard]]", "Positions/Mount")
  const guardFromSubmissions = await hrefOf("[[Guard]]", "Submissions/Armbar")
  assert.equal(guardFromPositions.href, "../../Positions/Guard", "STEP 2 from Positions/")
  assert.equal(guardFromSubmissions.href, "../../Submissions/Guard", "STEP 2 from Submissions/")
  assert.notEqual(
    guardFromPositions.href,
    guardFromSubmissions.href,
    "losing STEP 2 sends both to the same page, or to neither — 668+ wikilinks re-point silently",
  )
  const guardFromRoot = await hrefOf("[[Guard]]", "index")
  assert.equal(guardFromRoot.href, "../Guard", "with no sibling and no uniqueness, it falls through")
  // And from Positions/Mount, only STEP 3 can reach it — STEP 4 now sees two candidates.
  const subdir = await hrefOf("[[Top]]", "Positions/Mount")
  assert.equal(subdir.href, "../../Positions/Mount/Top", "STEP 3 resolves the file-named subdirectory")
  assert.notEqual(
    subdir.href,
    sibling.href,
    "the SAME wikilink text must resolve differently from different sources — that is what " +
      "'context-aware' means, and a resolver that ignored context would return one answer for both",
  )
})

test("THE FALLTHROUGH — an unresolved target and [[game-over]] are the SAME code path", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const alias = await hrefOf("[[game-over]]", "Positions/Mount")
  const typo = await hrefOf("[[Nonexistent Page]]", "Positions/Mount")

  assert.equal(alias.href, "../../game-over", "the 668-file link falls through to a root-relative path")
  assert.equal(typo.href, "../../Nonexistent-Page", "a genuine typo falls through identically")
  // The shape is what matters: both are pathToRoot(src) + the slugified target. If `path.ts` ever
  // starts resolving one and not the other, one of these assertions changes and the difference
  // becomes visible — which is the only way stream A can notice at all.
  assert.ok(
    alias.href.startsWith("../../") && typo.href.startsWith("../../"),
    "both must be root-relative — path.ts has NO alias awareness and cannot distinguish them",
  )
  assert.equal(
    alias.dataSlug,
    "game-over",
    "data-slug is the lowercase alias, NOT the Game-Over content slug — ContentIndex records it as written",
  )
})

test("INDEXED AND LINEAR RESOLUTION MUST AGREE — the two-implementations differential", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `transformLink`'s "shortest" branch answers the same question twice: once through
  // `buildSlugIndex`'s five maps, and once through a linear `allSlugs` scan when no index is
  // supplied. CLAUDE.md §6.5: when one question is answered in two places, one of them is already
  // wrong. Rather than re-implement either (§6.3), this drives BOTH and asserts they agree — a
  // differential, so it cannot pass by agreeing with my reading of the code.
  const { transformLink, buildSlugIndex } = await loadQuartzModule("util/path.ts")
  const idx = buildSlugIndex(SLUGS)

  const targets = [
    "Positions/Guard", "Guard", "Top", "Armbar", "Kimura", "Mount", "Game-Over", "game-over",
    "index", "Nonexistent", "Mount/Top", "Positions/Mount#setup", "Submissions/Armbar#details",
    "Knee-Slice-Pass", "Positions/Mount/Top",
  ]
  let compared = 0
  const disagreements = []
  for (const src of SLUGS) {
    for (const target of targets) {
      const withIndex = transformLink(src, target, {
        strategy: "shortest",
        allSlugs: SLUGS,
        slugIndex: idx,
      })
      const withoutIndex = transformLink(src, target, { strategy: "shortest", allSlugs: SLUGS })
      compared += 1
      if (withIndex !== withoutIndex) {
        disagreements.push(`${src} -> [[${target}]]  indexed=${withIndex}  linear=${withoutIndex}`)
      }
    }
  }
  // POSITIVE COVERAGE, hard-failing on zero: a differential that compared nothing reports clean.
  console.log(`  coverage: ${compared} (source, target) pairs compared across both implementations`)
  assert.ok(compared >= 100, `expected a real differential, compared only ${compared} pairs`)
  assert.deepEqual(
    disagreements,
    [],
    "the indexed and linear paths must return identical results; a divergence means the O(1) " +
      "index and the O(n) scan disagree and the build's answer depends on which one ran",
  )
})

test("LINK DECORATION — classes, the external icon, prettyLinks and the outgoing set", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const internal = await hrefOf("[[Positions/Guard]]", "Positions/Mount")
  assert.match(internal.html, /class="internal/, "internal links carry the `internal` class")

  const { html, file } = await runPipeline(
    `---\ntitle: T\n---\n\n[ext](https://example.com/a/b)\n\n[[Positions/Guard|renamed]]\n`,
    { slug: "Positions/Mount", allSlugs: SLUGS },
  )
  assert.match(html, /class="external/, "external links carry the `external` class")
  assert.match(html, /class="external-icon"/, "externalLinkIcon injects the SVG")
  assert.match(html, /alias/, "link text differing from the href adds the `alias` class")

  // `file.data.links` feeds ContentIndex. Insertion order and the empty array both matter.
  assert.ok(Array.isArray(file.data.links), "links must always be an array, even when empty")
  assert.ok(
    file.data.links.includes("Positions/Guard"),
    "the internal target must be recorded in the outgoing set",
  )
  assert.ok(
    !file.data.links.some((l) => l.startsWith("http")),
    "external links must NOT enter the outgoing set",
  )

  const empty = await runPipeline(`---\ntitle: T\n---\n\nno links here\n`, {
    slug: "index",
    allSlugs: SLUGS,
  })
  assert.deepEqual(empty.file.data.links, [], "a page with no links records an EMPTY array, not undefined")

  // prettyLinks — NAMED IN THIS TEST'S TITLE AND, UNTIL NOW, NOT ASSERTED.
  // Measured: deleting `node.children[0].value = path.basename(...)` (links.ts:139) left this
  // whole file and quartz_pagedata green (9/9), while it changes the VISIBLE LABEL of 46,869
  // un-aliased wikilinks across 4,421 of 4,600 content files. A title that names a behaviour
  // invites the reader to infer coverage the assertions do not have (CLAUDE.md §6.9) — so the
  // four branches of the condition at links.ts:132-139 are each pinned below.
  //
  // MUTANTS RUN, with the one that does NOT kill recorded so nobody reads this as total coverage:
  //   L1  delete the basename rewrite (links.ts:139)        -> RED   (it was GREEN before this)
  //   L3  prettyLinks default true -> false                 -> RED
  //   L2  delete the `isInternal &&` guard                  -> GREEN, and it is EQUIVALENT here.
  //       `externalLinkIcon: true` appends the SVG as a SECOND child, so `children.length === 1`
  //       already excludes every external link and `isInternal` is redundant GIVEN that. Proven,
  //       not reasoned: dropping `isInternal` AND setting `externalLinkIcon: false` together DOES
  //       turn this test red. Two defaults are load-bearing for one behaviour, and neither names
  //       the other at its own site.
  const labelOf = (h, cls = "internal") => {
    const a = h.match(new RegExp(`<a[^>]*class="${cls}[^>]*>([\\s\\S]*?)</a>`))
    return a ? a[1].replace(/<svg[\s\S]*?<\/svg>/g, "") : null
  }
  let pinned = 0
  for (const [md, cls, want, why] of [
    [`[[Positions/Guard]]`, "internal", "Guard",
      "an un-aliased wikilink is displayed by BASENAME, not by its authored path"],
    [`[Positions/Guard](./Positions/Guard)`, "internal", "Guard",
      "a markdown link with slashed text takes the same rewrite — it is not wikilink-specific"],
    [`[[Positions/Guard|renamed]]`, "internal", "renamed",
      "an alias with no slash is its own basename and survives untouched"],
    [`[[Positions/Guard|Some/Label]]`, "internal", "Label",
      "INCUMBENT AND SURPRISING: prettyLinks rewrites the AUTHOR'S alias too when it contains a " +
        "slash. The condition tests the link's TEXT, not whether the text was authored"],
    [`[a/b](https://example.com/x)`, "external", "a/b",
      "an EXTERNAL link keeps its slashed text — `isInternal` gates the rewrite"],
  ]) {
    const { html: h } = await runPipeline(`---\ntitle: T\n---\n\n${md}\n`, {
      slug: "Positions/Mount",
      allSlugs: SLUGS,
    })
    assert.equal(labelOf(h, cls), want, why)
    pinned += 1
  }
  console.log(`  coverage: ${pinned} prettyLinks branches pinned`)
  assert.equal(pinned, 5, "a branch count of zero or a short loop would assert nothing")
})
