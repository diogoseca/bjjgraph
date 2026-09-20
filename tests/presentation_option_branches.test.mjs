// ── CALL-SITE-CONFIG BRANCHES: THE ONES ENV B CANNOT CLOSE ────────────────────────────────────
//
// D-51 rule 2: a feature with ZERO corpus exercise needs a FIXTURE, and the fixture IS the gate —
// `emit_diff` reads 0 whether the feature survived the migration or was deleted. These components
// take options at their registration site in `quartz.layout.ts`. Every non-default value is
// therefore unexercised by the corpus AND unreachable from Env B, because Env B varies the
// ENVIRONMENT (`SHOW_BREADCRUMBS`, `SUPABASE_URL`, `POSTHOG_API_KEY`) and these are arguments.
//
// ── WHAT BUILDING THIS FOUND: HALF THE BRANCHES DO NOT EXIST ──────────────────────────────────
//
// Six option branches were approved for fixturing. THREE OF THEM ARE DEAD OPTIONS — declared,
// defaulted, merged into an `options` object, and then never reaching any emitted byte. They are
// documented here and deliberately NOT asserted: pinning them would make a current defect a
// contract, and D-03 says reproduce exactly rather than fix.
//
//   ContentMeta.showReadingTime  DEAD — `ContentMeta.tsx:17` computes `options` and the component
//   ContentMeta.showComma        DEAD   body never reads it. `grep -n 'options\.' ContentMeta.tsx`
//                                       returns NOTHING. Measured: all four combinations of the
//                                       two flags render the byte-identical
//                                       `<p class="content-meta">Last updated Mar 04, 2024</p>`.
//                                       `quartz.layout.ts:32` passes `{ showReadingTime: false }`
//                                       to an option nothing consults — and it is the default too.
//   FolderContent.showFolderCount DEAD — read at `:55`, but `:52-70` is inside a
//   FolderContent.sort            DEAD   `{/* Commented out to hide repetitive page listings */}`
//                                       JSX comment. `options.sort` only feeds `listProps`, which
//                                       is used only inside that dead block.
//
// CLASSIFICATION (COORDINATION §7C): all three are INHERITED, not made-reachable-by-us. The
// incumbent already has them dead and nothing in the replacement makes them reachable, so under
// D-03 they are reproduced exactly. They are post-parity cleanup, not programme work.
//
// ── AND ONE FALSE DEFECT I ALMOST FILED ───────────────────────────────────────────────────────
//
// `TagContent.numPages` measured INERT at first — 14 items rendered at `numPages` 2, 10 and 20
// alike. The code was fine and my fixture was wrong: `options.numPages` is read only at `:85`,
// `:90` and `:96`, all inside the `tag === "/"` block, i.e. the ALL-TAGS page. A specific tag page
// never consults it. Rendering `tags/index` instead of `tags/t` produces 10 / 2 / 14 exactly as
// declared. A fixture that reaches the wrong branch and asserts "it renders" would have passed;
// one that asserts a DIFFERENCE fails until the props are right. That is why condition 2 below is
// "assert the output DIFFERS", not "assert it renders".
//
// ── HARNESS ───────────────────────────────────────────────────────────────────────────────────
//
// Components are bundled with THE SAME TWO LOADERS THE REAL BUILD USES — `sassPlugin` as
// css-text and the inline-script loader — mirroring `cli/handlers.js:234-271` and
// `tests/_quartz_pipeline.mjs:114-155`. Four of these components import `.scss`, and a plain
// `tsImport` dies with ERR_UNKNOWN_FILE_EXTENSION on the first one. `loadQuartzModule` in the
// shared helper is NOT reused here because it builds without the sass plugin; folding a
// component loader into that helper is a change to A's file and is offered rather than taken.
//
// ── MUTANTS (tests/artifacts/_presentation_mutants.sh, M11-M13) ───────────────────────────────
//
//   M11 TableOfContents ignores `layout` and always returns the modern component  -> test 1 RED
//   M12 Footer ignores `links`                                                     -> test 2 RED
//   M13 TagContent ignores `numPages` (hard-codes the default)                     -> test 3 RED
//
// NON-KILLS, recorded so nobody reads this file as covering them: nothing here asserts the three
// DEAD options above, by choice. Nothing here renders a full page — these are component-level
// renders with hand-built props, so they cannot catch an emitter that stops passing an option.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(ROOT, "source")
const require = createRequire(path.join(SRC, "package.json"))
const esbuild = require("esbuild")
const { sassPlugin } = require("esbuild-sass-plugin")
const { render } = require("preact-render-to-string")

/** Byte-for-byte the loader from `cli/handlers.js:239-270`, via `_quartz_pipeline.mjs:117-140`. */
const inlineScriptLoader = {
  name: "inline-script-loader",
  setup(build) {
    build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => {
      let text = await fs.promises.readFile(args.path, "utf8")
      text = text.replace("export default", "").replace("export", "")
      const transpiled = await esbuild.build({
        stdin: {
          contents: text,
          loader: "ts",
          resolveDir: path.dirname(args.path),
          sourcefile: args.path,
        },
        write: false,
        bundle: true,
        minify: true,
        platform: "browser",
        format: "esm",
      })
      return { contents: transpiled.outputFiles[0].text, loader: "text" }
    })
  },
}

/** Bundle one component the way the build does, import it, return its constructor.
 *  Output lands under `source/` so `packages:"external"` resolves against source/node_modules. */
async function loadComponent(rel) {
  const outfile = path.join(
    SRC,
    ".quartz-cache",
    `d-optbranch-${rel.replace(/[/.]/g, "_")}-${process.pid}.mjs`,
  )
  await esbuild.build({
    absWorkingDir: SRC,
    entryPoints: [path.join(SRC, "quartz/components", rel)],
    outfile,
    bundle: true,
    keepNames: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: false,
    jsx: "automatic",
    jsxImportSource: "preact",
    plugins: [sassPlugin({ type: "css-text", cssImports: true }), inlineScriptLoader],
  })
  const mod = await import(outfile)
  fs.rmSync(outfile, { force: true })
  return mod.default
}

const baseProps = {
  cfg: { locale: "en-US", defaultDateType: "modified", baseUrl: "example.invalid" },
  externalResources: { css: [], js: [] },
  children: [],
  tree: { type: "root", children: [] },
  allFiles: [],
}
const page = (slug, title, tags = []) => ({
  slug,
  filePath: `../content/${slug}.md`,
  frontmatter: { title, tags },
  dates: { created: new Date("2024-01-02"), modified: new Date("2024-03-04") },
  description: "d",
})

/** POSITIVE COVERAGE COUNT (CLAUDE.md §6.6). A suite that silently stopped exercising these
 *  branches must not read the same as one that exercised them and found no problem. */
let branchesExercised = 0
const EXPECTED_BRANCHES = 3

test("TableOfContents layout:'legacy' renders a DIFFERENT component, not a variant of the same one", async () => {
  // The single most valuable branch here: `layout:"legacy"` swaps in LegacyTableOfContents
  // (TableOfContents.tsx:47-68) plus legacyToc.scss. That is CLAUDE.md §6.7 — deleting a component
  // deletes a capability — and `details#toc` appears on 0 of 6,149 golden pages, so a re-host
  // could drop the whole thing with nothing going red.
  const makeToc = await loadComponent("TableOfContents.tsx")
  const props = {
    ...baseProps,
    displayClass: "desktop-only",
    fileData: {
      ...page("Note", "Note"),
      toc: [
        { depth: 0, text: "Alpha", slug: "alpha" },
        { depth: 1, text: "Beta", slug: "beta" },
      ],
      collapseToc: false,
    },
  }
  const modern = makeToc()
  const legacy = makeToc({ layout: "legacy" })
  const modernHtml = render(modern(props))
  const legacyHtml = render(legacy(props))

  // CONDITION 2: assert the output DIFFERS, not merely that it renders. A stub that returned the
  // modern component for both values would satisfy "it renders" and fail this.
  assert.notEqual(
    legacyHtml,
    modernHtml,
    "layout:'legacy' produced byte-identical HTML to the default — the option is not selecting " +
      "LegacyTableOfContents (TableOfContents.tsx:71-72)",
  )
  assert.match(legacyHtml, /^<details id="toc"/, "legacy layout must render <details id='toc'>")
  assert.match(modernHtml, /id="toc-content"/, "modern layout must render #toc-content")
  assert.doesNotMatch(modernHtml, /^<details/, "the modern layout must not be the legacy shape")

  // The stylesheet swaps too, and it is the half a markup-only assertion would miss.
  assert.notEqual(legacy.css, modern.css, "the two layouts must not share a stylesheet")
  assert.ok(
    legacy.css.includes("details#toc"),
    "legacyToc.scss must be the legacy component's stylesheet",
  )
  branchesExercised++
})

test("Footer renders its links map, and the SHIPPING call site passes the empty default", async () => {
  // `quartz.layout.ts:22-24` passes `links: {}` — which IS defaultOptions. So the EXERCISED branch
  // is the empty one and the UNEXERCISED branch is a NON-EMPTY map. (I had this backwards in an
  // earlier report and am pinning the measured direction here.)
  const makeFooter = await loadComponent("Footer.tsx")
  const props = { ...baseProps, fileData: page("Note", "Note") }
  const empty = render(makeFooter({ links: {} })(props))
  const withLinks = render(makeFooter({ links: { Example: "https://example.invalid" } })(props))

  assert.notEqual(withLinks, empty, "a non-empty links map produced identical HTML to the default")
  assert.ok(
    withLinks.includes("https://example.invalid"),
    "the supplied link href is not in the emitted footer",
  )
  assert.ok(!empty.includes("example.invalid"), "the empty-links default must emit no link")
  branchesExercised++
})

test("TagContent numPages limits the ALL-TAGS listing (and only that one)", async () => {
  // Live only inside the `tag === "/"` block (:85, :90, :96). Measured on 14 pages:
  // default 10 -> 10 rows, numPages 2 -> 2, numPages 20 -> 14 (all of them).
  const makeTag = await loadComponent("pages/TagContent.tsx")
  const many = Array.from({ length: 14 }, (_, i) => page(`Note${i}`, `N${i}`, ["t"]))
  const rows = (opts) =>
    (
      render(makeTag(opts)({ ...baseProps, fileData: page("tags/index", "Tags"), allFiles: many })
      ).match(/section-li/g) ?? []
    ).length

  const dflt = rows(undefined)
  assert.equal(dflt, 10, `default numPages should list 10 of 14, listed ${dflt}`)
  assert.equal(rows({ numPages: 2 }), 2, "numPages:2 should list 2 rows")
  assert.equal(rows({ numPages: 20 }), 14, "numPages above the corpus should list all 14")

  // The narrow-branch fact that made my first fixture wrong, pinned so it cannot re-mislead:
  // a SPECIFIC tag page does not consult numPages at all.
  const specific = (
    render(
      makeTag({ numPages: 2 })({
        ...baseProps,
        fileData: page("tags/t", "t", ["t"]),
        allFiles: many,
      }),
    ).match(/section-li/g) ?? []
  ).length
  assert.equal(specific, 14, "a specific tag page must ignore numPages and list every match")
  branchesExercised++
})

test("coverage: every approved branch was actually exercised", () => {
  // Rule 3 of the approval. Zero must never read as clean.
  assert.equal(
    branchesExercised,
    EXPECTED_BRANCHES,
    `only ${branchesExercised} of ${EXPECTED_BRANCHES} option branches were exercised — a suite ` +
      `that silently stopped covering them would otherwise report green`,
  )
  // VERDICT AS THE LAST LINE OF OUTPUT, so `cmd | tail -1` shows the truth and the lazy reading
  // is the correct one rather than the forbidden one.
  console.log(
    `VERDICT: PASS — ${branchesExercised}/${EXPECTED_BRANCHES} call-site-config branches exercised ` +
      `(3 further options are DEAD and deliberately unasserted; see header)`,
  )
})
