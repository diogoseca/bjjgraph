// ── THE TRANSPILE BRIDGE: node --test CAN NOW DRIVE THE REAL TRANSFORMERS ──────────────────────
//
// WHY THIS EXISTS. `tests/lastmod_git_path.test.mjs` says it plainly: "a root `node --test`
// runner cannot import a .ts Quartz plugin without a transpile step, so the transformer's own
// control flow is NOT executed here. Those are unguarded." That limitation is why every existing
// assertion about `source/quartz/plugins/transformers/**` is a REGEX OVER THE SOURCE, and a regex
// pin is exactly the assertion class CLAUDE.md §6.3 warns about: it agrees with a second reading
// of the code rather than with what the code does. lastmod's own header records the resulting
// non-kill — "a mutant that swaps `repo.workdir()` for a hard-coded correct path would survive".
//
// This module removes the limitation. It esbuild-bundles the REAL `source/quartz.config.ts` with
// the SAME two loaders the real build uses (`cli/handlers.js:234-271`: sass as css-text, and the
// nested-esbuild `.inline.ts` → minified browser text), imports it, and takes
// `config.plugins.transformers` VERBATIM. Order and options therefore come from the single source
// of truth, not from a list retyped into a test that would then agree with itself.
//
// WHAT IT COVERS: every transformer's real control flow, on real input, in the contract order.
//
// WHAT IT DOES NOT COVER — read this before citing a green from it (CLAUDE.md §6.9):
//  · It reproduces the PHASE-MAJOR SCHEDULE of INTERFACE.md §4 steps 1-5 (trim → textTransform*
//    → remark-parse → markdownPlugins* → remark-rehype{allowDangerousHtml} → htmlPlugins*). It
//    does NOT drive the real driver. A scheduling change made in `processors/parse.ts` or in its
//    replacement is INVISIBLE here — that is stream V's transform seam, not this file. When V's
//    seam lands, this file keeps the fixture half and the seam takes the corpus half.
//  · It does not run workers, so it cannot see the worker/main-thread asymmetry that makes
//    `externalResources()` safe today (see `externalResourcesOf` below, which pins the
//    consequence but not the transport).
//  · It does not render a page. `<head>`, JSON-LD placement and article geometry are D's and B's.
//    **AND IF YOU EXTEND IT TO RENDER, READ THIS FIRST.** `renderPage`'s `loadGraphData` reads
//    `cwd/../graph.json` and, since S1's fix, THROWS when it cannot — deliberately, because the
//    bare catch it replaced dropped `#page-graph-data` from 4,544 pages and exited 0 (D-49/D-50).
//    This harness sets `file.cwd` to a THROWAWAY GIT REPO (see `scratchRepo`), which has no
//    `graph.json`, so any render driven from that cwd will throw `Cannot load required graph
//    data`. That is a TRUE POSITIVE, not a regression: stream B hit it on exactly the four of its
//    tests that render a page, and the fix is to render from the REAL runtime base rather than
//    from the fixture — `chdir` inside the snippet only for the cases that genuinely need the
//    fixture as cwd. The throwaway repo exists for `CreatedModifiedDate`'s libgit2 pathspec, and
//    that is the ONLY reason it is the cwd.
//  · Filters, emitters and the renderer are out of scope by design.
//
// WHY THIS FILE IS FLAT IN `tests/` AND NOT IN `tests/quartz_pipeline/`: `test:units` is
// `node --test tests/*.test.mjs` — a FLAT glob. A spec in a subdirectory is collected by nothing
// and would be a note rather than a gate (CLAUDE.md §6.4). Widening that glob means editing the
// `package.json` scripts block, which is a SHARED surface routed through quartz-cto, so the
// cheaper and safer answer is to stay flat. The leading `_` keeps this helper out of the glob,
// matching the existing `tests/_census.mjs` convention.
//
// COST: one esbuild bundle per process, measured at ~1.3 s, then ~20 ms per fixture.
// The bundle lands in `source/.quartz-cache/` — gitignored (`.gitignore:2`), the same directory
// `processors/parse.ts:46` uses for its own transpile, so it can never be committed. It is named
// distinctly from `transpiled-build.mjs`/`transpiled-worker.mjs` because COORDINATION §8 records
// that those greps identically to real source and has produced false conclusions here before.
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"
import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs"

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(REPO, "source")
// PER-PROCESS OUTPUT PATH, AND THE REASON IS A BUG THIS HARNESS ALREADY HAD.
// `node --test a.test.mjs b.test.mjs` runs each FILE IN ITS OWN PROCESS, CONCURRENTLY. With a
// single shared output path, four test files esbuild-wrote the same bundle at the same time and
// imported it mid-write: measured as 5 of 19 tests failing in one run and 0 of 19 in the next, on
// an unchanged tree. An INTERMITTENT gate is worse than no gate — it teaches the next person to
// re-run instead of to read. The pid makes each process's bundle its own, and the exit hook keeps
// `.quartz-cache/` from accumulating one per run.
const OUT = path.join(SRC, ".quartz-cache", `a-pipeline-harness-${process.pid}.mjs`)

// Every npm package below is a dependency of the Quartz sub-package, not of the root one, so it
// resolves through source/package.json exactly the way tests/lastmod_git_path.test.mjs does.
const toClean = new Set()
function cleanupOnExit(file) {
  if (toClean.size === 0) {
    process.on("exit", () => {
      for (const f of toClean) {
        try {
          fs.rmSync(f, { force: true })
        } catch {
          /* a leftover bundle in a gitignored cache dir is harmless; never fail a test over it */
        }
      }
    })
  }
  toClean.add(file)
}

let req = null
/** `require` resolved against `source/package.json`, so a spec can locate a package that only
 *  the Quartz sub-package depends on (e.g. `property-information`). Exported because the
 *  sanitizer contract needs hast's own property table to assert a MECHANISM rather than a
 *  hard-coded list of attribute names. */
export function sourceRequire() {
  if (!req) req = createRequire(path.join(SRC, "package.json"))
  return req
}

/** Every package this bridge resolves at runtime from code outside node_modules: its own requires
 *  (esbuild, esbuild-sass-plugin, unified, remark-parse, remark-rehype, vfile, hast-util-to-html)
 *  plus everything the esbuild bundle of quartz.config.ts pulls in with `packages: "external"` —
 *  every transformer's imports, which no grep of tests/ can see. TRACED, NOT GREPPED: with only
 *  @napi-rs/simple-git hidden, a two-sentinel guard stayed silent and 4 of 5 sanitizer cases
 *  went red inside the pipeline with a raw module error (measured 2026-09-21). Recompute with
 *    TRACE_OUT=/tmp/t.json node --import tests/artifacts/_promised_deps_trace.mjs tests/quartz_sanitizer_ping.test.mjs
 *  (the tracer lands with fix/promised-deps-manifests-traced); re-trace after any change to the
 *  config or to what a transformer imports. */
export const HARNESS_MODULES = Object.freeze([
  "@napi-rs/simple-git", "chalk", "dotenv", "esbuild", "esbuild-sass-plugin", "github-slugger",
  "globby", "gray-matter", "hast-util-to-html", "hast-util-to-jsx-runtime", "hast-util-to-string",
  "is-absolute-url", "js-yaml", "lightningcss", "mdast-util-find-and-replace", "mdast-util-to-hast",
  "mdast-util-to-string", "preact", "preact-render-to-string", "rehype-autolink-headings",
  "rehype-pretty-code", "rehype-raw", "rehype-slug", "remark-frontmatter", "remark-gfm",
  "remark-parse", "remark-rehype", "remark-smartypants", "rfdc", "unified", "unist-util-visit",
  "vfile", "workerpool",
])

/** True when the Quartz sub-package's node_modules is present — decided by the ONE promised-deps
 *  guard, tests/_deps_promised.mjs (v1.195.9), never by a second copy of the check. Under CI an
 *  absent module THROWS from this call naming it and the install step, so a spec that consults it
 *  fails rather than skips; at home it returns false after printing one SKIP line. Memoised per
 *  caller, so eleven specs asking is one decision. A spec that also wants the asserted-count line
 *  calls depsPromised(import.meta.url, { ...SOURCE_DEPS, modules: [...HARNESS_MODULES, …] })
 *  itself and registers through its `test`/`assert`, the way tests/quartz_sanitizer_ping.test.mjs
 *  does. */
export const harnessAvailable = () =>
  depsPromised(import.meta.url, { ...SOURCE_DEPS, modules: HARNESS_MODULES }).ok

let configPromise = null
/** The REAL instantiated QuartzConfig. Bundled once per process. */
export function loadConfig() {
  if (configPromise) return configPromise
  configPromise = (async () => {
    const r = sourceRequire()
    const esbuild = r("esbuild")
    const { sassPlugin } = r("esbuild-sass-plugin")

    // Byte-for-byte the loader from cli/handlers.js:239-270. `calloutScript` and `checkboxScript`
    // in ofm.ts:11-13 are NOT modules — they are this loader's minified browser bundle, as text.
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

    await esbuild.build({
      absWorkingDir: SRC,
      entryPoints: [path.join(SRC, "quartz.config.ts")],
      outfile: OUT,
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
    // Output must live under source/ so `packages: "external"` resolves against source/node_modules.
    cleanupOnExit(OUT)
    return (await import(OUT)).default
  })()
  return configPromise
}

// ── A THROWAWAY REPO SHAPED LIKE THIS ONE ─────────────────────────────────────────────────────
// `CreatedModifiedDate` asks libgit2 for a last-commit date and libgit2 resolves a pathspec
// against the repo WORKDIR, so a fixture that is not inside a git repo makes the transformer throw
// and fall through to filesystem mtime — which is the exact silent failure the date contract is
// about. The shape is deliberate: `workdir/content` beside `workdir/source`, reached with a `..`,
// because that is what `quartz build -d ../content` run from `source/` produces.
// Throwaway rather than this repo, for lastmod's own stated reason: the CI checkout is shallow, so
// asserting against real history would test the clone depth instead of the contract.
let repoDir = null
export function scratchRepo() {
  if (repoDir) return repoDir
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-a-pipeline-"))
  fs.mkdirSync(path.join(tmp, "content"), { recursive: true })
  fs.mkdirSync(path.join(tmp, "source"), { recursive: true })
  const git = (...args) =>
    execFileSync("git", ["-C", tmp, ...args], { stdio: ["ignore", "pipe", "pipe"] })
  git("init", "-q")
  git("config", "user.email", "test@example.invalid")
  git("config", "user.name", "test")
  git("config", "commit.gpgsign", "false")
  repoDir = { root: tmp, content: path.join(tmp, "content"), source: path.join(tmp, "source"), git }
  process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }))
  return repoDir
}

/** Write a fixture into the scratch repo and commit it at a FIXED author/committer date, so a
 *  date assertion is about the contract and never about when the suite happened to run. */
export function commitFixture(relPath, markdown, isoDate) {
  const repo = scratchRepo()
  const abs = path.join(repo.content, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, markdown)
  execFileSync("git", ["-C", repo.root, "add", path.posix.join("content", relPath)], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  execFileSync("git", ["-C", repo.root, "commit", "-qm", `add ${relPath}`], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
  })
  return abs
}

/**
 * Run one Markdown source through the real transformer chain, phase-major per INTERFACE.md §4.
 *
 * @param markdown   the raw source, INCLUDING any leading blank lines you are testing
 * @param opts.slug  the FullSlug this page is being built as
 * @param opts.trim  step 1's `.trim()`. Pass false to seed the untrimmed regression.
 * @param opts.file  a path already written by commitFixture(); otherwise a scratch file is made
 * @param opts.allSlugs  ctx.allSlugs, which LinkProcessing indexes for wikilink resolution
 * @returns { tree, file, html } — `tree` is the live HAST root, `file` the real VFile
 */
export async function runPipeline(markdown, opts = {}) {
  const { slug = "Fixture", trim = true, allSlugs = [], file: existing } = opts
  const cfg = await loadConfig()
  const r = sourceRequire()
  const { unified } = r("unified")
  const remarkParse = r("remark-parse").default
  const remarkRehype = r("remark-rehype").default
  const { VFile } = r("vfile")
  const repo = scratchRepo()

  const abs =
    existing ??
    (() => {
      const p = path.join(repo.content, `${slug.split("/").pop()}.md`)
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, markdown)
      return p
    })()

  const transformers = cfg.plugins.transformers
  const ctx = {
    buildId: "a-pipeline-harness",
    cfg,
    allSlugs,
    argv: {
      directory: path.posix.relative(repo.source, repo.content),
      output: "public",
      verbose: false,
      serve: false,
      fastRebuild: false,
      port: 8080,
      wsPort: 3001,
    },
  }

  // INTERFACE.md §4 step 1 — read, trim, then EVERY textTransform in configured order.
  const vfile = new VFile({ value: markdown, path: abs, cwd: repo.source })
  if (trim) vfile.value = vfile.value.toString().trim()
  for (const p of transformers.filter((p) => p.textTransform)) {
    vfile.value = p.textTransform(ctx, vfile.value.toString())
  }

  // step 2 — identity, assigned BEFORE parse because markdownPlugins read file.data.slug.
  vfile.data.filePath = abs
  vfile.data.relativePath = path.posix.relative(repo.content, abs)
  vfile.data.slug = slug

  // steps 2-5 — one processor per page, exactly as createProcessor composes it.
  const processor = unified()
    .use(remarkParse)
    .use(transformers.filter((p) => p.markdownPlugins).flatMap((p) => p.markdownPlugins(ctx)))
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(transformers.filter((p) => p.htmlPlugins).flatMap((p) => p.htmlPlugins(ctx)))

  const tree = await processor.run(processor.parse(vfile), vfile)
  return { tree, file: vfile, html: toHtml(tree) }
}

/** Serialize a HAST tree the way the renderer's own toHtml would, for assertions about emitted
 *  bytes rather than about tree shape. */
export function toHtml(tree) {
  return sourceRequire()("hast-util-to-html").toHtml(tree, { allowDangerousHtml: true })
}

/** The resource list a transformer contributes, collected the way `plugins/index.ts:11-19` does —
 *  on the MAIN thread. Pins the consequence of the ofm.ts inline-script loader (D-22). */
export async function externalResourcesOf(pluginName) {
  const cfg = await loadConfig()
  const p = cfg.plugins.transformers.find((t) => t.name === pluginName)
  if (!p) throw new Error(`no transformer named ${pluginName} — name-keyed lookup matched nothing`)
  return p.externalResources ? p.externalResources({ argv: {}, cfg }) : {}
}

// Bundle one frozen utility module on its own, so a test can call its exports directly instead of
// only observing them through the pipeline. Used for the indexed-vs-linear differential in
// `quartz_wikilink_contract.test.mjs`. `util/path.ts` is FROZEN VERBATIM (D-01) — this reads it,
// never writes it, and deliberately does not encode `util/path.test.ts`'s expectations, which are
// 5-of-17 red and describe the OLD contract (recon R15).
const moduleCache = new Map()
export async function loadQuartzModule(relPath) {
  if (moduleCache.has(relPath)) return moduleCache.get(relPath)
  const r = sourceRequire()
  const esbuild = r("esbuild")
  const outfile = path.join(
    SRC,
    ".quartz-cache",
    `a-pipeline-${relPath.replace(/[\/.]/g, "_")}-${process.pid}.mjs`,
  )
  await esbuild.build({
    absWorkingDir: SRC,
    entryPoints: [path.join(SRC, "quartz", relPath)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: false,
  })
  cleanupOnExit(outfile)
  const mod = await import(outfile)
  moduleCache.set(relPath, mod)
  return mod
}

/** Every content Markdown file, for the corpus half. Sorted, the way build.ts feeds the parser. */
export function corpusFiles() {
  const root = path.join(REPO, "content")
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".md")) out.push(p)
    }
  }
  walk(root)
  return out
}
