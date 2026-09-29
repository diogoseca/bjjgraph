// ── GitHubFlavoredMarkdown: 78 LINES, ZERO COMMENTS, ZERO TESTS, 10% OF THE SITE ───────────────
//
// `gfm.ts` had no gate of any kind. Measured across `tests/ e2e/ scripts/ .github/`, the only two
// mentions of `gfm.ts`, `rehype-slug`, `rehype-autolink-headings` or `smartypants` anywhere were
// (a) a byte pin in `tests/artifacts/transformer_freeze.json`, enforced by a script that was
// itself in no runner, and (b) a COMMENT in `quartz_ofm_contract.test.mjs:53` declaring
// smartypants deliberately out of scope. No assertion, anywhere.
//
//   git grep -lE 'gfm\.ts|rehype-slug|rehype-autolink|smartypants' -- tests/ e2e/ scripts/ .github/
//
// WHY THAT MATTERS OUT OF ALL PROPORTION TO 78 LINES. The heading anchors this file appends are
// **41,658,803 bytes, 10.35% of the build's 402,368,193 emitted HTML bytes** — 442.5 bytes on each
// of ~94,140 headings. A tenth of the site's weight is emitted by a file nothing asserted.
//
// WHAT THIS FILE DOES AND DOES NOT CLAIM (CLAUDE.md §6.9):
//  · It drives the REAL transformer chain through the real config and asserts what was EMITTED.
//    It does not re-implement slugging, smartypants or the anchor (§6.3).
//  · It does NOT assert `class="internal"` on the anchor, although the emitted anchor carries it.
//    That class is written by `LinkProcessing`, whose htmlPlugins run AFTER these in the
//    configured order. Pinning it here would assert a neighbouring transformer's output and go
//    red on a correct build — the same trap the sanitizer contract records for `src="../ok.png"`.
//  · It is not a claim that the SVG is the right icon, only that it is the emitted one.
//
// CORPUS EXPOSURE, measured, because it decides which contracts need a fixture at all (D-51/D-58):
//     tables            3,105 files / 24,797 rows     <- byte-parity sees this
//     straight '        4,572 files / 96,534
//     straight "        4,598 files / 2,131,912       <- almost all inside JSON-LD, see test 4
//     --                4,587 files / 39,064
//     ...               1,317 files / 11,732
//     strikethrough         0 files                   <- fixture-only, below
//     footnotes             0 files                   <- fixture-only
//     task lists            0 files                   <- fixture-only
//     bare www. autolinks   0 files                   <- fixture-only
//   Recompute: the python scan in `reports/quartz-a-audit.md` §gfm, or re-derive per pattern with
//   `grep -rlE '<pattern>' content --include='*.md' | wc -l`.
//
// MUTANTS RUN against `gfm.ts`, and the survivors are named rather than left to be inferred:
//   G-A  drop `rehypeAutolinkHeadings` from htmlPlugins           -> RED (test 1)
//   G-B  `behavior: "append"` -> `"prepend"`                      -> RED (test 1)
//   G-C  drop `rehypeSlug`                                        -> RED (test 2)
//   G-D  `enableSmartyPants` default true -> false                -> RED (test 3)
//   G-E  drop `remarkGfm`                                         -> RED (tests 5 and 6)
//   G-F  `linkHeadings` default true -> false                     -> RED (tests 1 and 2)
//   G-G  replace path 1's `d` with a different icon                -> RED (test 1)
// G-G is the reason test 1 pins both `d` strings VERBATIM rather than asserting the SVG's shape.
// Every other assertion in test 1 — the element, its dimensions, viewBox, stroke attributes —
// passes unchanged on G-G, so without those two literals the icon could be swapped wholesale on
// ~94,140 headings and this file would stay green. The literals are the gate; the shape is not.
// All seven mutants were run with `gfm.ts` restored byte-identical afterwards, confirmed by
// `npm run validate:frozen-surfaces` (D-27 freezes this file).
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const emit = async (body, slug = "Gfm") =>
  (await runPipeline(`---\ntitle: T\n---\n\n${body}\n`, { slug })).html

test("HEADING ANCHORS — the 10% of the site's HTML that nothing asserted", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit("## Section One\n\n### Section Two\n")
  const h2 = html.match(/<h2[\s\S]*?<\/h2>/)?.[0]
  assert.ok(h2, `no <h2> emitted at all:\n${html}`)

  // APPEND, not wrap and not prepend: the anchor follows the heading TEXT inside the <h2>.
  assert.match(h2, /<h2[^>]*>Section One<a /, "the anchor must be APPENDED after the heading text")

  // The four properties, each named, so a silently dropped one is named back.
  for (const [label, re] of [
    ["role=anchor", /role="anchor"/],
    ["aria-hidden", /aria-hidden(?:="true")?[\s>]/],
    ["tabindex=-1", /tabindex="-1"/],
    ["data-no-popover", /data-no-popover/],
    ["href to its own id", /href="#section-one"/],
  ])
    assert.match(h2, re, `the anchor lost ${label}`)

  // The SVG, including both path `d` strings VERBATIM. Shape assertions alone would let the icon
  // be swapped wholesale — that is the recorded non-kill in this file's header.
  for (const [label, re] of [
    ["svg element", /<svg /],
    ["width/height 18", /width="18"[^>]*height="18"/],
    ["viewBox", /viewBox="0 0 24 24"/],
    ["stroke=currentColor", /stroke="currentColor"/],
    ["stroke-width 2", /stroke-width="2"/],
    ["stroke-linecap round", /stroke-linecap="round"/],
    ["stroke-linejoin round", /stroke-linejoin="round"/],
    ["path 1 verbatim", /d="M10 13a5 5 0 0 0 7\.54\.54l3-3a5 5 0 0 0-7\.07-7\.07l-1\.72 1\.71"/],
    ["path 2 verbatim", /d="M14 11a5 5 0 0 0-7\.54-\.54l-3 3a5 5 0 0 0 7\.07 7\.07l1\.71-1\.71"/],
  ])
    assert.match(h2, re, `the anchor SVG lost ${label}`)

  // EVERY heading, not just the first — the byte weight is per-heading.
  const heads = html.match(/<h[1-6][^>]*>/g) ?? []
  const anchors = html.match(/role="anchor"/g) ?? []
  assert.ok(heads.length >= 2, `expected both headings, saw ${heads.length}`)
  assert.equal(anchors.length, heads.length, "every heading carries exactly one anchor")
  console.log(`  coverage: ${heads.length} headings, ${anchors.length} anchors, 14 anchor facts`)
})

test("rehype-slug IDS — derivation, and the anchor points at its own heading", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // github-slugger strips BOTH quote forms. The straight ones never survive to slugging here,
  // because smartypants has already curled them upstream in the same file — which is exactly why
  // the fixture uses straight input and the expectation is the curled-then-stripped result.
  const cases = [
    ["## A Heading's \"Quoted\" Title", "a-headings-quoted-title"],
    ["## Mount / Top", "mount--top"],
    ["## Trailing spaces   ", "trailing-spaces"],
  ]
  let checked = 0
  for (const [md, id] of cases) {
    const html = await emit(md, `Slug${checked}`)
    assert.match(html, new RegExp(`<h2 id="${id}"`), `${JSON.stringify(md)} must slug to "${id}"`)
    assert.match(html, new RegExp(`href="#${id}"`), "the anchor must target the id just derived")
    checked += 1
  }
  console.log(`  coverage: ${checked} slug derivations, each with its anchor round-trip`)
  assert.equal(checked, cases.length, "a short loop would assert nothing")
})

test("SMARTYPANTS — the four transforms, on 4,598 of 4,600 files", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit("Don't -- stop ... now, he said \"hello\".", "Sp")
  const body = html.match(/Don[\s\S]*?now/)?.[0] ?? html
  for (const [label, re] of [
    ["apostrophe -> U+2019", /Don’t/],
    ["-- -> em dash U+2014", /—/],
    ["... -> ellipsis U+2026", /…/],
    ["\" -> curly U+201C/U+201D", /“hello”/],
  ])
    assert.match(html, re, `smartypants no longer applies: ${label}`)
  assert.doesNotMatch(body, /Don't/, "the straight apostrophe must not survive in body text")
  console.log(`  coverage: 4 smartypants transforms asserted on emitted body text`)
})

test("SMARTYPANTS MUST NOT REACH RAW HTML — 21,179 JSON-LD blocks depend on it", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // THE SILENT BREAKAGE THIS FILE EXISTS FOR. 4,598 of 4,600 files carry a straight `"` and there
  // are 2,131,912 of them, overwhelmingly INSIDE `<script type="application/ld+json">`. A curled
  // quote there is not valid JSON, so every affected page would lose its structured data with no
  // error and no visual difference. smartypants is a MARKDOWN plugin operating on mdast text
  // nodes, and raw HTML arrives as `html` nodes, which is what keeps them apart — but that is a
  // property of the plugin ORDER and node kinds, not a guarantee anyone had written down.
  const { html, file } = await runPipeline(
    `---\ntitle: T\n---\n\n` +
      `<script type="application/ld+json">{"@type":"Article","name":"Don't -- stop ... now"}</script>\n\n` +
      `Body text: Don't -- stop ... now\n`,
    { slug: "SpJsonLd" },
  )
  assert.deepEqual(
    file.data.schemas,
    [{ "@type": "Article", name: "Don't -- stop ... now" }],
    "the JSON-LD payload must survive smartypants CHARACTER FOR CHARACTER — a curled quote here " +
      "is invalid JSON and silently removes the structured data from the page",
  )
  const bodyText = html.match(/Body text:[^<]*/)?.[0] ?? ""
  assert.match(bodyText, /Don’t — stop … now/, "…while body text IS transformed")
  console.log(`  coverage: 1 JSON-LD block held straight, 1 body line transformed, same page`)
})

test("remark-gfm — TABLES, the one extension this corpus actually exercises", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit("| a | b |\n| - | - |\n| 1 | 2 |\n", "Tbl")
  for (const [label, re] of [
    ["<table>", /<table>/],
    ["<thead>", /<thead>/],
    ["header cell", /<th>a<\/th>/],
    ["body cell", /<td>1<\/td>/],
  ])
    assert.match(html, re, `tables no longer render: ${label}`)
  console.log(`  coverage: 4 table facts (3,105 corpus files carry a table row)`)
})

test("remark-gfm — THE FOUR EXTENSIONS AT ZERO CORPUS EXPOSURE (D-51 quadrant)", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // Each of these is measured at ZERO files in the corpus, so byte-parity against the golden can
  // never see them removed — a fixture is the only thing that can. Note the distinction the audit
  // blurred: zero EXPOSURE is not zero CAPABILITY. Driven here, all four work today, and this is
  // what keeps them working after the re-host.
  const cases = [
    ["strikethrough", "~~struck~~", /<del>struck<\/del>/],
    ["footnotes", "A note[^1]\n\n[^1]: the body", /data-footnotes|footnote/i],
    ["task lists", "- [ ] unchecked\n- [x] checked", /type="checkbox"/],
    ["autolink literals", "see www.example.com now", /href="http:\/\/www\.example\.com"/],
  ]
  let checked = 0
  for (const [label, md, re] of cases) {
    const html = await emit(md, `Gfm${checked}`)
    assert.match(html, re, `remark-gfm no longer provides ${label}`)
    checked += 1
  }
  console.log(`  coverage: ${checked} zero-exposure gfm extensions, fixture-gated`)
  assert.equal(checked, 4, "a short loop would assert nothing")
})
