// ── SyntaxHighlighting: ZERO corpus exposure, and therefore fixture-only ───────────────────────
//
// THE TRANSFORMER IS THE IDENTITY FUNCTION ON THIS CORPUS. Measured: 0 of 6,149 emitted pages
// carry shiki output, and `reports/quartz-a-byteshare.py` scores its row at 0.00%. All 7 fenced
// code blocks in `content/` are BARE — `lang == null` — and rehype-pretty-code's guard is
// `if (!lang || lang === "math") return`, so nothing is highlighted anywhere on the site. Deleting
// `Plugin.SyntaxHighlighting()` outright changes zero emitted bytes today.
//   Recompute: `grep -rlE '^\x60\x60\x60[a-zA-Z]' content --include='*.md' | wc -l`  ->  0
//
// SO WHY GATE IT. Because "byte-parity cannot see it" is the argument FOR a fixture, not against
// one (D-51/D-58). The D-212 mutant sweep ran two mutants — `keepBackground: false -> true` and
// the light theme swapped — and BOTH survived all 82 assertions in this directory. Neither is
// equivalent: a fixture with a LABELLED fence reaches shiki immediately, as this file shows. The
// day one labelled fence is authored, every one of those options starts emitting bytes, and
// nothing would have been holding them.
//
// WHAT THIS FILE DOES NOT CLAIM (§6.9): it does not assert shiki's tokenisation or its colours.
// Those belong to the installed `rehype-pretty-code` / `shiki` versions, which D-11 says not to
// conclude anything about from the shared pre-prune `node_modules`. It asserts the OPTIONS this
// repo chose and the emitted shape they produce.
//
// THE MUTANTS MUST TARGET THE CALL SITE, NOT `defaultOptions`. `syntax.ts`'s `defaultOptions` is
// DEAD CODE: `quartz.config.ts:112-118` is the only instantiation and it passes `theme` and
// `keepBackground` explicitly, so the spread `{...defaultOptions, ...userOpts}` discards both
// defaults on every build. Measured — mutating `keepBackground`, the theme value AND the theme key
// inside `syntax.ts` all left this file green, which reads as a coverage gap and is not one. A
// reader who mutates the defaults and sees green will draw exactly the wrong conclusion.
//
// MUTANTS RUN, all against `source/quartz.config.ts`, every file restored byte-identical
// afterwards and confirmed by `npm run validate:frozen-surfaces`:
//   SY-2'  call site `light: "github-light"` -> `"github-dark"`  -> RED (test 1)
//   SY-1'  call site `keepBackground: false` -> `true`           -> RED (test 2)
//   SY-4   `Plugin.SyntaxHighlighting({...})` removed entirely   -> RED (tests 1, 2)
//   EQUIVALENT, recorded so nobody re-runs them expecting a kill: the same three edits made to
//   `syntax.ts`'s `defaultOptions` are unobservable, for the reason above.
import { test } from "node:test"
import assert from "node:assert/strict"
import { harnessAvailable, runPipeline } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const fence = (lang, body = "const x = 1") => ["```" + lang, body, "```"].join("\n")
let seq = 0
const emit = async (md) =>
  (await runPipeline(`---\ntitle: T\n---\n\n${md}\n`, { slug: `Syn${seq++}` })).html

test("THE THEME PAIR — both names, and the CSS custom properties its KEYS generate", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit(fence("js"))
  assert.match(html, /data-rehype-pretty-code-figure/, "a LABELLED fence must reach shiki at all")
  assert.match(
    html,
    /data-theme="github-light github-dark"/,
    "both configured theme names are emitted verbatim, in the object's key order",
  )
  // The custom-property NAMES come from the theme object's KEYS (`light`/`dark`), not its values.
  // Renaming a key silently renames every variable the stylesheet is written against.
  for (const v of ["--shiki-light", "--shiki-dark"])
    assert.ok(html.includes(v), `the theme key must generate ${v}`)
  assert.match(html, /data-language="js"/, "the fence's language is carried onto the element")
  console.log(`  coverage: theme names, both custom properties, language attribute`)
})

test("keepBackground: false — no inline background reaches the page", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit(fence("js"))
  const figure = html.match(/<figure[^>]*data-rehype-pretty-code-figure[\s\S]*?<\/figure>/)?.[0]
  assert.ok(figure, "no shiki figure emitted, so this test would prove nothing")
  // MEASURED, because the obvious assertion cannot fail: rehype-pretty-code does NOT write a
  // literal `background-color:` in either state, so `doesNotMatch(/background-color:/)` is green
  // on both and gates nothing. What `keepBackground: true` actually does is add
  // `--shiki-light-bg` / `--shiki-dark-bg` to the <pre>'s style — 518 -> 615 bytes on this fixture.
  for (const v of ["--shiki-light-bg", "--shiki-dark-bg"])
    assert.ok(
      !figure.includes(v),
      `\`keepBackground: false\` must suppress ${v}. Flipping it puts a theme-coloured background ` +
        "on every code block, overriding the site's own stylesheet",
    )
  assert.doesNotMatch(
    figure,
    /<pre style=/,
    "with the background suppressed the <pre> carries no style attribute at all",
  )
  // The other half, so a build that stopped emitting ANY style still fails: the grid default is on.
  assert.match(figure, /style="display: grid;"/, "…while `grid` (default true) still applies")
  console.log(`  coverage: background suppressed, grid retained — both halves`)
})

test("THE BARE FENCE IS DELIBERATELY UNTOUCHED — which is the whole corpus", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // `if (!lang || lang === "math") return`. All 7 corpus fences take this path, which is why this
  // transformer emits nothing on the real site. Pinned so the port cannot start highlighting them.
  const bare = await emit(fence("", "plain text"))
  assert.doesNotMatch(bare, /data-rehype-pretty-code-figure/, "an unlabelled fence is NOT highlighted")
  assert.match(bare, /<pre><code>/, "…it emits a plain <pre><code>")
  const math = await emit(fence("math", "x = 1"))
  assert.doesNotMatch(math, /data-rehype-pretty-code-figure/, "a `math` fence is skipped by name")
  console.log(`  coverage: 2 skip branches (no lang, math) — the only two the corpus exercises`)
})
