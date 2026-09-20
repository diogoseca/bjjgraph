// ── THE FEATURES emit_diff CANNOT SEE: OFM's UNEXERCISED HALF, AND SyntaxHighlighting ─────────
//
// **THIS FILE EXISTS BECAUSE OF D-51**, which stream A proposed and quartz-cto adopted programme-
// wide: *before citing a green differ for a feature, ask how many corpus files exercise it; if the
// answer is zero, the differ is not evidence and only a fixture test is.* Applied to stream A's own
// surface, that rule immediately indicted six features this suite had left ungated. They are gated
// here. A rule whose author exempts himself is not a rule.
//
// ── THE MEASUREMENT THAT MAKES THIS FILE THE ONLY INSTRUMENT ──────────────────────────────────
// Corpus exposure across all 4,600 content files, re-derived below in the coverage test:
//
//     feature                       files   → can emit_diff see it break?
//     comments  %%x%%                   0     NO
//     highlights  ==x==                 0     NO
//     embeds  ![[x]]                    0     NO
//     block references  ^id             0     NO
//     mermaid fences                    0     NO
//     labelled code fences              0     NO   (1 file has 14 fences; ALL are UNLABELLED)
//
// Every one of these could be DELETED from `ofm.ts` and the site would emit byte-identical output.
// `emit_diff` would report 0. So would a golden seam. This fixture is the whole gate.
//
// **SyntaxHighlighting is the sharpest case and it is not broken — it is UNTRIGGERED.** Driven
// through the real pipeline: a bare fence emits `<pre><code>` and nothing else, while a ```js fence
// emits a full shiki `<figure data-rehype-pretty-code-figure>` with `data-language` and
// `data-theme`. End to end, **0 of 6,149 golden pages carry `data-language`, `data-theme` or
// `shiki`**. So the transformer plus `rehype-pretty-code` plus `shiki` contribute ZERO emitted
// bytes to this site today. It stays (D-03 reproduces, it never improves) — but a 0-diff says
// nothing about whether it survived the migration, because it would read 0 either way.
//
// ── AN INHERITED WART, PINNED DELIBERATELY (D-03) ─────────────────────────────────────────────
// A transclude embed with no alias emits the literal string `data-embed-alias="undefined"`, because
// `ofm.ts:271` interpolates a possibly-`undefined` variable straight into the HTML. It is wrong and
// it is reproduced EXACTLY, asserted below so the migration cannot "helpfully" tidy it into a diff
// nobody asked for. It belongs in `GEO-BACKLOG.md`, not in this phase.
//
// ── WHAT THIS FILE DOES NOT COVER (CLAUDE.md §6.9) ────────────────────────────────────────────
//  · The features the corpus DOES exercise — wikilinks, arrows, callouts, YouTube embeds, tables,
//    smartypants — are deliberately NOT here. `emit_diff` sees those across thousands of files, so
//    a fixture would be redundant. That asymmetry is the point of D-51, applied in both directions.
//  · It asserts the emitted shape, not that a browser renders it. Mermaid's runtime, the transclude
//    fetch and the PDF iframe are not exercised.
//  · It does not gate `externalResources()` — the callout/checkbox inline scripts are D-22/D-28 and
//    belong to S1's bundler work.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { REPO, harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const ALL_SLUGS = ["Probe", "Positions/Mount"]
async function emit(body, slug = "Probe") {
  return runPipeline(`---\ntitle: T\n---\n\n${body}\n`, { slug, allSlugs: ALL_SLUGS })
}

test("COMMENTS AND HIGHLIGHTS — the textTransform and mdast-replace pair", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `%%…%%` is stripped at the TEXT stage, before the parser ever sees it (ofm.ts:151-157).
  const comment = await emit("before %%hidden comment%% after")
  assert.doesNotMatch(comment.html, /hidden comment/, "a comment's body must never reach the DOM")
  assert.match(comment.html, /before\s+after/, "the surrounding text must survive")

  const highlight = await emit("some ==highlighted== text")
  assert.match(
    highlight.html,
    /<span class="text-highlight">highlighted<\/span>/,
    "==x== must become the text-highlight span the stylesheet targets",
  )
})

test("EMBEDS — every ![[x]] media branch, including the transclude fallthrough", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // One case per branch of ofm.ts:229-276. The `src` is asserted by PATTERN, not by exact bytes:
  // LinkProcessing rewrites it downstream (`../diagram.png`), and pinning the literal here would
  // assert a neighbouring transformer's output and go red on a correct build (CLAUDE.md §6.3).
  const cases = [
    ["image", "![[diagram.png]]", /<img src="[^"]*diagram\.png" width="auto" height="auto" alt="">/],
    ["video", "![[clip.mp4]]", /<video src="[^"]*clip\.mp4" controls><\/video>/],
    ["audio", "![[sound.mp3]]", /<audio src="[^"]*sound\.mp3" controls><\/audio>/],
    ["pdf", "![[paper.pdf]]", /<iframe src="[^"]*paper\.pdf" class="pdf"><\/iframe>/],
  ]
  let checked = 0
  for (const [label, body, expect] of cases) {
    const { html } = await emit(body)
    assert.match(html, expect, `${label} embed`)
    checked += 1
  }

  // The sizing sub-branch: `alt|WxH` is parsed by wikilinkImageEmbedRegex into three attributes.
  const sized = await emit("![[diagram.png|alt text|200x100]]")
  assert.match(sized.html, /width="200"/, "explicit width")
  assert.match(sized.html, /height="100"/, "explicit height")
  assert.match(sized.html, /alt="alt text"/, "alt text")
  checked += 1

  // The fallthrough: anything that is not a known media extension becomes a transclude blockquote.
  const trans = await emit("![[Positions/Mount]]")
  assert.match(trans.html, /<blockquote class="transclude"/, "unknown types become a transclude")
  assert.match(trans.html, /data-url="Positions\/Mount"/, "the transclude carries its target")
  // INHERITED WART, reproduced exactly (D-03): `alias` is undefined here and is interpolated
  // straight into the attribute, so the literal string "undefined" ships. Pinned so the migration
  // cannot quietly fix it into a diff nobody asked for.
  assert.match(
    trans.html,
    /data-embed-alias="undefined"/,
    'ofm.ts:271 emits the literal "undefined" for an alias-less transclude — a wart, reproduced ' +
      "exactly under D-03; the fix belongs in GEO-BACKLOG.md, not in this phase",
  )
  checked += 1
  console.log(`  coverage: ${checked} embed branches exercised`)
  assert.ok(checked === 6, "every embed branch must actually have run")
})

test("BLOCK REFERENCES — the ^id that populates file.data.blocks for the renderer", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `blocks` is read by renderPage.tsx for transclusions and is one of the three keys no
  // `fileData`-anchored inventory found (D-50).
  const { html, file } = await emit("A paragraph with a ref. ^myblock")
  assert.match(html, /<p id="myblock">/, "the block id must land on the element")
  assert.doesNotMatch(html, /\^myblock/, "the ^ref marker itself must be stripped from the text")
  assert.deepEqual(Object.keys(file.data.blocks), ["myblock"], "file.data.blocks must be keyed by id")
  assert.equal(file.data.blocks.myblock.tagName, "p", "the stored node is the live element")

  const none = await emit("no refs here")
  assert.deepEqual(none.file.data.blocks, {}, "a page with no refs gets an EMPTY object, not undefined")
})

test("MERMAID AND SYNTAX HIGHLIGHTING — the two fence branches", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const mermaid = await emit("```mermaid\ngraph TD; A-->B;\n```")
  assert.match(
    mermaid.html,
    /<code class="mermaid">/,
    "a mermaid fence must carry the class its runtime querySelector looks for",
  )

  // SyntaxHighlighting, pinned in BOTH directions because the corpus exercises neither.
  const labelled = await emit("```js\nconst x = 1\n```")
  assert.match(labelled.html, /data-rehype-pretty-code-figure/, "a labelled fence is shiki-processed")
  assert.match(labelled.html, /data-language="js"/, "the language reaches the emitted markup")
  assert.match(
    labelled.html,
    /data-theme="github-light github-dark"/,
    "both configured themes are emitted — quartz.config.ts pins github-light/github-dark",
  )

  const bare = await emit("```\nplain\n```")
  assert.match(bare.html, /<pre><code>plain/, "an UNLABELLED fence passes through untouched")
  assert.doesNotMatch(
    bare.html,
    /data-language|data-theme/,
    "and gains no shiki attributes — which is why all 14 corpus fences emit nothing, and why " +
      "deleting SyntaxHighlighting entirely would be invisible to emit_diff",
  )
})

test("D-51 COVERAGE — re-derive the zero-exposure claim these fixtures rest on", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The claim "the differ cannot see this" is only true while the corpus stays empty of it. If a
  // content file ever starts using one of these, emit_diff DOES become evidence and this file
  // stops being the sole gate — so the claim is re-measured on every run rather than asserted once.
  const pats = {
    "comments %%x%%": /%%[\s\S]*?%%/,
    "highlights ==x==": /==[^=\n]+==/,
    "embeds ![[x]]": /!\[\[[^\]]+\]\]/,
    "block refs ^id": /^\^[-_A-Za-z0-9]+$/m,
    "mermaid fences": /```mermaid/,
    "labelled fences": /^```[a-zA-Z]+/m,
  }
  const counts = Object.fromEntries(Object.keys(pats).map((k) => [k, 0]))
  let files = 0
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".md")) {
        files += 1
        const s = fs.readFileSync(p, "utf8")
        for (const [k, re] of Object.entries(pats)) if (re.test(s)) counts[k] += 1
      }
    }
  }
  walk(path.join(REPO, "content"))

  // POSITIVE COVERAGE COUNT, hard-failing on zero (CLAUDE.md §6.6): a walk that read no files
  // would report every count as 0 and look like a perfect confirmation of the claim.
  console.log(`  coverage: ${files} content files scanned · ${JSON.stringify(counts)}`)
  assert.ok(files > 4000, `expected the real corpus, walked ${files} files`)
  for (const [k, n] of Object.entries(counts)) {
    assert.equal(
      n,
      0,
      `${k} is now used by ${n} content file(s). That is not a failure of the pipeline — it means ` +
        "emit_diff can now see this feature, so update the D-51 blind-spot table in " +
        "reports/quartz-a-gates.md rather than weakening anything here.",
    )
  }
})
