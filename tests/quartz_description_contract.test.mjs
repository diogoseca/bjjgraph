// ── Description: THE TRUNCATION LENGTH NOTHING PINNED ──────────────────────────────────────────
//
// `description.ts` writes BOTH `file.data.description` — which becomes the `<meta
// name="description">` on 6,138 of 6,149 pages, 1,176,950 emitted bytes — and `file.data.text`,
// which becomes ContentIndex's `content`. Recompute the byte figure with
// `python3 reports/quartz-a-byteshare.py` in the orchestrator tree.
//
// WHY IT NEEDED A GATE, established by MUTATION rather than by reading. The existing pin is
// `quartz_pagedata_contract.test.mjs:112`, `(v) => typeof v === "string" && v.length > 0` — a
// PRESENCE-AND-TYPE check, and its own header says so. Measured: changing `descriptionLength`
// from **150 to 5** left every stream-A spec GREEN while rewriting the meta description of all
// 6,138 pages. A truncation length is exactly the kind of value that produces a complete,
// plausible, wrong site.
//
// THE 150 IN THIS FILE IS THE CONTRACT'S NUMBER, not a copy of an implementation detail:
// `defaultOptions.descriptionLength = 150` and `Plugin.Description()` at `quartz.config.ts:124`
// is the ONLY instantiation in the tree, with no arguments. Test 1 derives the expected word
// count FROM that number rather than hard-coding the answer, so the rule is what is asserted.
//
// WHAT THIS FILE DOES NOT CLAIM (§6.9):
//  · It does not assert the exact character length at which branch A takes over. Measured, the
//    flip happens between a 150- and a 151-character body, NOT at exactly `len`, because
//    `toString(tree)` and the `\s+` collapse both shift the string before `sentences[0].length`
//    is taken. Pinning "151" would be pinning a serialisation detail I would have to re-derive to
//    predict — so the tests assert the BRANCH each fixture takes and the SHAPE of what it emits.
//  · `description` does NOT reach `contentIndex.json` — `contentIndex.ts:151` does
//    `delete content.description`. Only `text` does, truncated to the first 3,000 characters by
//    `contentTruncateLength`. Neither of those is this transformer's, and neither is asserted here.
//
// MUTANTS RUN, all killed, `description.ts` restored byte-identical after each and confirmed by
// `npm run validate:frozen-surfaces`:
//   DS-A  `descriptionLength` 150 -> 5                      -> RED (test 1)  <- the known survivor
//   DS-B  `descriptionLength` 150 -> 500                    -> RED (test 1)
//   DS-C  branch A's `finalDesc.push("...")` removed        -> RED (test 2)
//   DS-D  branch B's `.` re-append removed                  -> RED (test 3)
//   DS-E  `frontMatterDescription ?? text` -> `text`        -> RED (test 4)
//   DS-F  `escapeHTML(...)` dropped from `text`             -> RED (test 5)
//   DS-G  `replaceExternalLinks` default true -> false      -> RED (test 6)
//   DS-H  Description moved BEFORE SchemaExtractor in quartz.config.ts -> RED (test 7)
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

// The instantiated contract. See the header: one instantiation, no arguments.
const DESCRIPTION_LENGTH = 150

let seq = 0
const data = async (frontmatter, body) =>
  (await runPipeline(`---\ntitle: T\n${frontmatter}---\n\n${body}\n`, { slug: `Desc${seq++}` }))
    .file.data

test("descriptionLength GOVERNS THE OUTPUT — the mutant that used to survive", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // 40 words of exactly 4 characters. Branch A accumulates WORD characters — not the spaces that
  // join them — and stops at the first word that takes the running total to >= len. So the count
  // is ceil(len / 4), derived here rather than hard-coded: change the source's 150 and this moves.
  const WORD = "word"
  const expected = Math.ceil(DESCRIPTION_LENGTH / WORD.length)
  const d = await data("", `${WORD} `.repeat(40).trim())
  const consumed = d.description.split(" ").filter((w) => w === WORD).length
  assert.equal(
    consumed,
    expected,
    `at descriptionLength=${DESCRIPTION_LENGTH} the word-wise branch must consume exactly ` +
      `${expected} four-letter words. Got ${consumed}. This is the assertion that was missing: a ` +
      "presence-and-type pin on `description` reports green while every one of 6,138 meta " +
      "descriptions is rewritten",
  )
  assert.ok(
    consumed < 40,
    "the fixture must be longer than the limit, or this test proves nothing about truncation",
  )
  console.log(`  coverage: ${consumed} of 40 words consumed at len=${DESCRIPTION_LENGTH}`)
})

test("BRANCH A — word-wise, never mid-word, and the trailing ' ...'", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const d = await data("", "word ".repeat(40).trim())
  assert.match(d.description, / \.\.\.$/, "branch A appends '...' as its own space-joined token")
  assert.ok(
    d.description.split(" ").every((w) => w === "word" || w === "..."),
    `branch A must never split a word: ${JSON.stringify(d.description.slice(-40))}`,
  )
  console.log(`  coverage: branch A shape, ${d.description.length} chars emitted`)
})

test("BRANCH B — sentence-wise, and the '.' is re-appended exactly once", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const missing = await data("", "One two. Three four. Five six")
  assert.equal(
    missing.description,
    "One two. Three four. Five six.",
    "a final sentence with no period gets one — this is branch B's dominant observable effect, " +
      "not truncation: only 5 of 4,600 pages stop early because of the length cap",
  )
  const already = await data("", "Already ends.")
  assert.equal(already.description, "Already ends.", "…and a sentence that has one is not doubled")
  assert.doesNotMatch(already.description, /\.\./, "no '..' anywhere")
  console.log(`  coverage: 2 branch-B sentence-terminator cases`)
})

test("FRONTMATTER description WINS over body text", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const d = await data('description: "From the frontmatter."\n', "Body text here.")
  assert.equal(d.description, "From the frontmatter.", "`frontMatterDescription ?? text`")
  assert.equal(d.text, "Body text here.", "…and `text` is still the BODY, not the frontmatter")
  console.log(`  coverage: both fields on one page, from different sources`)
})

test("escapeHTML APPLIES TO `text` AND NOT TO A FRONTMATTER description — incumbent", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The asymmetry is real and is reproduced, not corrected (D-03). `text` is escaped because it
  // becomes ContentIndex's `content`; `description` is not, so an authored `<` reaches the meta
  // tag raw. Pinning it means the port cannot quietly make them symmetric in either direction.
  const fromBody = await data("", "5 < 6 & 7 > 2")
  assert.equal(fromBody.text, "5 &lt; 6 &amp; 7 &gt; 2", "`text` is escaped")
  assert.match(fromBody.description, /&lt;/, "a description DERIVED from text inherits the escaping")

  const fromFm = await data('description: "5 < 6 & 7 > 2"\n', "Body.")
  assert.equal(
    fromFm.description,
    "5 < 6 & 7 > 2.",
    "an AUTHORED description is never passed through escapeHTML — only `text` is",
  )
  console.log(`  coverage: both sides of the escaping asymmetry`)
})

test("replaceExternalLinks — the scheme is stripped in BOTH text and frontmatter", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const fromBody = await data("", "Visit https://example.com/a/b now.")
  assert.match(fromBody.text, /Visit example\.com\/a\/b now\./, "`text` loses the scheme")
  assert.doesNotMatch(fromBody.text, /https:\/\//, "…entirely")
  const fromFm = await data('description: "See https://example.com/a/b"\n', "Body.")
  assert.match(fromFm.description, /See example\.com\/a\/b\./, "so does an authored description")
  console.log(`  coverage: urlRegex on both inputs (replaceExternalLinks defaults true)`)
})

test("ORDER — SchemaExtractor runs FIRST, so hoisted JSON-LD never enters searchable text", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The existing pin asserts `doesNotMatch(text, /ld\+json|<script/)`, which on this corpus cannot
  // detect the swap: by the time Description runs the blocks are gone either way, and `toString`
  // would emit the JSON *content*, not the tag. So this fixture carries a distinctive string
  // INSIDE the block — if Description ran first, that string lands in `text` and in the site's
  // search index.
  const d = await data(
    "",
    `<script type="application/ld+json">{"sentinel":"NOTSEARCHABLE"}</script>\n\nVisible body.`,
  )
  assert.doesNotMatch(
    d.text,
    /NOTSEARCHABLE/,
    "JSON-LD content reached file.data.text — Description is running BEFORE SchemaExtractor, and " +
      "every page's search index has absorbed its structured data",
  )
  assert.match(d.text, /Visible body\./, "…while the real body text is still there")
  console.log(`  coverage: 1 sentinel inside a hoisted block, absent from text`)
})
