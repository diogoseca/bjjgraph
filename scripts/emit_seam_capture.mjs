#!/usr/bin/env node
/**
 * Capture the EMIT seam: what each emitter actually put on the filesystem, per emitter.
 *
 *   node scripts/emit_seam_capture.mjs --out DIR --full | --limit N  [--emitter NAME]...
 *        [--work DIR] [--concurrency N] [--plain] [--keep] [--mutant omit-file|flip-byte] [--list]
 *   node scripts/emit_seam_capture.mjs --seed-static /path/to/golden/static/neural
 *   node scripts/emit_seam_capture.mjs --check-provenance /path/to/records   # still valid?
 *
 * Stream B produces these records under D-26; stream V owns the `quartz-seam-v1` envelope
 * (`reports/quartz-v-record-format.md`) and reviews them. Exit 0 on a complete capture, 2 when no
 * trustworthy capture could be taken (missing inputs, an emitter that threw, a coverage floor
 * breached) — never 0 with an empty or partial record, because a capture that never ran must not
 * read like a capture that found nothing (CLAUDE.md §6.6).
 *
 * HOW IT IS FAITHFUL
 *
 *   * It drives the REAL modules. `quartz.config.ts`, the real `glob`, the real `parseMarkdown`,
 *     the real `filterContent`, the real emitter instances off `cfg.plugins.emitters`. The module
 *     graph is bundled with Quartz's OWN esbuild configuration (copied from
 *     `source/quartz/cli/handlers.js` `handleBuild`), so what runs here is what the build runs.
 *     Attribution is by actual emitter execution, never by guessing which emitter a path shape
 *     belongs to.
 *   * Discovery mirrors `build.ts:70-78` exactly: `glob("**\/*.*", argv.directory, ignorePatterns)`,
 *     `.md` filtered and SORTED for parse, `allSlugs` from the UNSORTED, UNFILTERED discovery
 *     order (ambiguous link resolution depends on first matches — do not sort it).
 *   * `data.files` is a filesystem walk + read + sha256 taken AFTER each emitter's promise
 *     resolved. `returned_paths` is recorded separately and is never the inventory source: Static
 *     returns a filtered glob that omits thousands of files it copied.
 *
 * WHERE IT DELIBERATELY DIFFERS FROM A BUILD, AND WHY THAT IS SAFE
 *
 *   * `concurrency: 1` by default, so parse runs in-process instead of in `workerpool` workers.
 *     The parse-worker bundle empties `.scss` and `*.inline.ts` imports (`parse.ts:58-71`) while
 *     the main-thread bundle keeps their real text.
 *
 *     CORRECTED (V, D-58): an earlier version of this comment claimed no transformer imports
 *     either, "measured" with `grep -rn '\.scss\|\.inline"' …`. That pattern required a quote
 *     immediately after `.inline` and the real specifiers end `.inline.ts"`, so it matched
 *     nothing and read as clean — the matcher-that-matches-nothing defect, in a comment claiming
 *     to have measured. **`ofm.ts` DOES import two of them**, `callout.inline.ts:11` and
 *     `checkbox.inline.ts:13`.
 *
 *     The equivalence still holds, for a different and checkable reason: both are consumed ONLY
 *     inside `externalResources()` (`ofm.ts:731`, `:739`), as `script:` values on JSResources.
 *     `externalResources` is never called by the parse worker — `createProcessor` uses only
 *     `markdownPlugins`/`htmlPlugins` — it is collected by `getStaticResourcesFromPlugins` on the
 *     MAIN thread, which is the path this capture uses. So the worker's empty strings never reach
 *     an AST or an emitted byte. Re-check with:
 *       grep -rn 'components/scripts/\|\.scss"' source/quartz/plugins/transformers/*.ts
 *       # 2 hits, both ofm.ts, both used only under externalResources
 *   * Each emitter writes into its OWN output directory, and they run one at a time. That is what
 *     makes per-emitter attribution exact. It cannot change any emitter's file set — they write to
 *     disjoint roots — but it does mean this capture does not exercise the real build's phase-two
 *     concurrency. Scheduling is gated separately, by `tests/emitter_contract.test.mjs`, which
 *     drives the real `emitContent`.
 *   * Shared module-level memos are warmed by whoever runs first. `renderPage.tsx:30`
 *     `_rollPositionsJson` is computed once per process from the FIRST caller's `allFiles`, and
 *     `__rollPositions` is 18,759 bytes of every page. Every emitter here is handed the same
 *     complete `allFiles`, so the memo is order-independent — but a capture taken with `--limit`
 *     computes it from the truncated set, which is why a limited capture is marked
 *     `partial: true` and must never be compared against a full golden.
 *
 * SEEDED REGIONS (D-19). `source/quartz/static/neural/` is gitignored and absent from a fresh
 * worktree, so Static copies 9 files here and 4,952 in a build-ready checkout. Seed it read-only
 * from the golden with `--seed-static` and the record declares the region: path, reason, evidence
 * and actual file count, with `coverage.parity_files = files - seeded_files`. Seeded bytes are
 * still inventoried and hashed — that is what catches an incomplete or corrupt copy — only their
 * generated-content parity is not asserted.
 */
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import zlib from "node:zlib"

export const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
export const SOURCE_DIR = path.join(REPO_ROOT, "source")
const NODE_MODULES = path.join(SOURCE_DIR, "node_modules")

const SCHEMA = "quartz-seam-v1"
const SEAM = "emit"

// ---------------------------------------------------------------------------------------------
// The shared bundler. ONE definition: `tests/_emitter_probe.mjs` imports this rather than keeping
// a second copy of the config (CLAUDE.md §6.5 — collapse to one named seam before a third caller).
// ---------------------------------------------------------------------------------------------

function depUrl(rel, what) {
  const fp = path.join(NODE_MODULES, rel)
  if (!fs.existsSync(fp)) {
    throw new Error(
      `emit_seam_capture: ${what} not found at ${fp}. Run \`npm install\` in source/. ` +
        `Hard failure on purpose: a skipped capture reads exactly like a clean one.`,
    )
  }
  return pathToFileURL(fp).href
}

/** The bundler program, generated so it cannot drift from the config it mirrors. */
export function bundlerSource() {
  return `
import * as esbuild from ${JSON.stringify(depUrl("esbuild/lib/main.js", "esbuild"))}
import { sassPlugin } from ${JSON.stringify(depUrl("esbuild-sass-plugin/lib/index.js", "esbuild-sass-plugin"))}
import { promises } from "node:fs"
import path from "node:path"

const [, , outfile, entry, cwd] = process.argv
process.chdir(cwd)

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  keepNames: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "preact",
  packages: "external",
  sourcemap: false,
  logLevel: "warning",
  plugins: [
    sassPlugin({ type: "css-text", cssImports: true }),
    {
      name: "inline-script-loader",
      setup(build) {
        build.onLoad({ filter: /\\.inline\\.(ts|js)$/ }, async (args) => {
          let text = await promises.readFile(args.path, "utf8")
          text = text.replace("export default", "")
          text = text.replace("export", "")
          const sourcefile = path.relative(path.resolve("."), args.path)
          const transpiled = await esbuild.build({
            stdin: { contents: text, loader: "ts", resolveDir: path.dirname(sourcefile), sourcefile },
            write: false,
            bundle: true,
            minify: true,
            platform: "browser",
            format: "esm",
          })
          return { contents: transpiled.outputFiles[0].text, loader: "text" }
        })
      },
    },
  ],
})
`
}

const bundleCache = new Map()
const tempDirs = []
let exitHookInstalled = false
function trackTemp(dir) {
  if (!exitHookInstalled) {
    exitHookInstalled = true
    process.on("exit", () => {
      if (process.env.BJJ_KEEP_PROBE_TEMP === "1") return
      for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true })
    })
  }
  tempDirs.push(dir)
  return dir
}

/**
 * Bundle one TypeScript entry against the real Quartz module graph, using Quartz's own esbuild
 * configuration. Nothing is written inside the repository: the bundle lands in an OS temp
 * directory carrying a `node_modules` symlink, so `packages: "external"` still resolves.
 * @returns {string} path to the runnable ESM bundle
 */
export function bundleQuartzEntry(entryTs) {
  const key = crypto.createHash("sha256").update(entryTs).digest("hex")
  const hit = bundleCache.get(key)
  if (hit) return hit

  const dir = trackTemp(fs.mkdtempSync(path.join(os.tmpdir(), "bjj-quartz-bundle-")))
  fs.symlinkSync(NODE_MODULES, path.join(dir, "node_modules"), "dir")
  const entry = path.join(dir, "entry.ts")
  const bundler = path.join(dir, "bundle.mjs")
  const out = path.join(dir, "out.mjs")
  fs.writeFileSync(entry, entryTs, "utf8")
  fs.writeFileSync(bundler, bundlerSource(), "utf8")
  execFileSync(process.execPath, [bundler, out, entry, SOURCE_DIR], {
    cwd: SOURCE_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 600_000,
  })
  bundleCache.set(key, out)
  return out
}

// ---------------------------------------------------------------------------------------------
// The capture entry, run inside the bundle.
// ---------------------------------------------------------------------------------------------

const q = (p) => JSON.stringify(path.join(SOURCE_DIR, p))

const CAPTURE_ENTRY = `
import config from ${q("quartz.config")}
import { parseMarkdown } from ${q("quartz/processors/parse")}
import { filterContent } from ${q("quartz/processors/filter")}
import { getStaticResourcesFromPlugins } from ${q("quartz/plugins/index")}
import { glob } from ${q("quartz/util/glob")}
import { joinSegments, slugifyFilePath } from ${q("quartz/util/path")}
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const args = JSON.parse(process.env.BJJ_EMIT_CAPTURE_ARGS)

// --- discovery, mirroring build.ts:70-78 exactly ------------------------------------------------
const directory = args.directory
const allFiles = await glob("**/*.*", directory, config.configuration.ignorePatterns)
const fpsAll = allFiles.filter((fp) => fp.endsWith(".md")).sort()
const fps = args.limit > 0 ? fpsAll.slice(0, args.limit) : fpsAll
const filePaths = fps.map((fp) => joinSegments(directory, fp))

const ctx = {
  buildId: "emit-seam-capture",
  argv: {
    directory,
    output: args.workRoot,
    verbose: false,
    serve: false,
    fastRebuild: false,
    port: 0,
    wsPort: 0,
    // 1 keeps parse in-process: no worker bundle, no .quartz-cache write, and (measured) no
    // behavioural difference while no transformer imports .scss or *.inline.ts. Raising it uses
    // the real build's workerpool path instead, which is MORE faithful and ~4x faster on this box
    // — and is what a full-corpus capture should use, since the build itself runs --concurrency 4.
    concurrency: args.concurrency,
  },
  cfg: config,
  // NOT sorted and NOT deduped: ambiguous link resolution uses first matches (INTERFACE.md §3).
  allSlugs: allFiles.map((fp) => slugifyFilePath(fp)),
}

const t0 = Date.now()
const parsed = await parseMarkdown(ctx, filePaths)
const tParse = Date.now() - t0
const content = filterContent(ctx, parsed)
const staticResources = getStaticResourcesFromPlugins(ctx)

// --- per-emitter execution into isolated output roots -------------------------------------------
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex")

function walkHash(root) {
  const out = {}
  if (!fs.existsSync(root)) return out
  const rec = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name)
      // Directory entries are followed; a symlink that survived to the output is recorded as the
      // file it is, which is how dereference:true is observable here.
      if (ent.isDirectory()) rec(fp)
      else {
        const buf = fs.readFileSync(fp)
        out[path.relative(root, fp).split(path.sep).join("/")] = { size: buf.length, sha256: sha(buf) }
      }
    }
  }
  rec(root)
  return out
}

const wanted = args.emitters && args.emitters.length ? new Set(args.emitters) : null
const results = []
for (const emitter of config.plugins.emitters) {
  if (wanted && !wanted.has(emitter.name)) continue
  const outRoot = path.join(args.workRoot, "by-emitter", emitter.name)
  fs.mkdirSync(outRoot, { recursive: true })
  const emitterCtx = { ...ctx, argv: { ...ctx.argv, output: outRoot } }
  const started = Date.now()
  let returned = null
  let error = null
  try {
    returned = await emitter.emit(emitterCtx, content, staticResources)
  } catch (err) {
    error = { message: String((err && err.message) || err), stack: String((err && err.stack) || "") }
  }
  const elapsed = Date.now() - started
  // The walk happens HERE, after this emitter's promise resolved: the ABI promises completed
  // writes, so anything not on disk at this instant is a defect, not a timing artefact.
  const files = walkHash(outRoot)
  results.push({
    emitter: emitter.name,
    returned_paths: (returned ?? []).map((p) => path.relative(outRoot, p).split(path.sep).join("/")),
    returned_raw_count: (returned ?? []).length,
    files,
    error,
    ms: elapsed,
    // Counted AFTER emit() returned. This is what distinguishes a completed observation of an
    // empty output from an extractor that never ran (V's addendum, D-58).
    emitter_runs: error ? 0 : 1,
    output_root: outRoot,
  })
}

// Static's copy-set equality needs the SOURCE inventory too (format v1 allows copy_source_files).
const staticSource = path.join(process.cwd(), "quartz", "static")
const copySource = walkHash(staticSource)

console.log(
  "__JSON__" +
    JSON.stringify({
      results,
      copy_source_files: copySource,
      copy_source_root: path.relative(process.cwd(), staticSource).split(path.sep).join("/"),
      discovered: { all: allFiles.length, md: fpsAll.length, parsed: fps.length, published: content.length },
      parse_ms: tParse,
      // The concurrency parseMarkdown ACTUALLY used, computed the way parse.ts:123 computes it,
      // not the value that was requested.
      parse_concurrency_actual:
        ctx.argv.concurrency ?? Math.min(Math.max(Math.round(fps.length / 128), 1), 4),
      parse_path: (ctx.argv.concurrency ?? 4) === 1 ? "main-thread" : "workerpool",
    }),
)
`


// ---------------------------------------------------------------------------------------------
// The JOINED form: one build, one census, attribution from the ledger (D-B-05 + V's addendum)
// ---------------------------------------------------------------------------------------------

const JOIN_ENTRY = `
import config from ${q("quartz.config")}
import { parseMarkdown } from ${q("quartz/processors/parse")}
import { filterContent } from ${q("quartz/processors/filter")}
import { emitContent } from ${q("quartz/processors/emit")}
import { glob } from ${q("quartz/util/glob")}
import { joinSegments, slugifyFilePath } from ${q("quartz/util/path")}
import { snapshot as ledgerSnapshot, enabled as ledgerEnabled } from ${q("quartz/plugins/emitters/emitLedger")}
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const args = JSON.parse(process.env.BJJ_EMIT_CAPTURE_ARGS)
const directory = args.directory
const allFiles = await glob("**/*.*", directory, config.configuration.ignorePatterns)
const fpsAll = allFiles.filter((fp) => fp.endsWith(".md")).sort()
const fps = args.limit > 0 ? fpsAll.slice(0, args.limit) : fpsAll

const ctx = {
  buildId: "emit-seam-join",
  argv: {
    directory, output: args.output, verbose: false, serve: false, fastRebuild: false,
    port: 0, wsPort: 0, concurrency: args.concurrency,
  },
  cfg: config,
  allSlugs: allFiles.map((fp) => slugifyFilePath(fp)),
}

const t0 = Date.now()
const parsed = await parseMarkdown(ctx, fps.map((fp) => joinSegments(directory, fp)))
const tParse = Date.now() - t0
const content = filterContent(ctx, parsed)

// ONE build into ONE output directory — the production shape, including concurrent phase two.
await emitContent(ctx, content)

// THE CENSUS RUNS HERE: after every raw emitter has settled and BEFORE any post-processor.
// V's correction, and it is not a precaution — regenerate_agent_discovery.py rewrites sitemap.xml
// and apply_affiliate_ref.py rewrites emitted HTML in place. A census taken at the END of the
// deploy chain would hash a post-processor's bytes and attribute them to the emitter that
// originally wrote that path: a correctly-claimed path with a wrong hash, and the join reports
// success. Nothing looks wrong, which is what makes it the dangerous case.
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex")
const census = {}
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(fp)
    else {
      const buf = fs.readFileSync(fp)
      census[path.relative(args.output, fp).split(path.sep).join("/")] = {
        size: buf.length, sha256: sha(buf),
      }
    }
  }
}
walk(args.output)

console.log(
  "__JSON__" + JSON.stringify({
    ledgerEnabled, claims: ledgerSnapshot(), census,
    discovered: { all: allFiles.length, md: fpsAll.length, parsed: fps.length, published: content.length },
    parse_ms: tParse,
    parse_concurrency_actual: ctx.argv.concurrency,
  }),
)
`

/**
 * Join the in-build ledger with the post-emit census into per-emitter records.
 *
 * Each half comes from the source that can supply it: ATTRIBUTION from the ledger, because a
 * finished tree cannot say which emitter wrote a path; INVENTORY from the census, because a
 * producer-side record says what it DID, not what EXISTS.
 *
 * The three disagreements are NAMED AND COUNTED SEPARATELY, never summed into one number
 * (V's addendum): a claim with no file, a file with no claim, and a path claimed by two emitters
 * are three different defects with three different causes.
 */
function joinRecords(captured, outDir, opts) {
  const { claims, census } = captured
  const owner = new Map()
  const conflicts = []
  for (const [emitter, paths] of Object.entries(claims)) {
    for (const rel of paths) {
      if (owner.has(rel)) conflicts.push({ path: rel, emitters: [owner.get(rel), emitter] })
      else owner.set(rel, emitter)
    }
  }
  const claimMissing = [...owner.keys()].filter((p) => !(p in census)).sort()
  const unclaimed = Object.keys(census).filter((p) => !owner.has(p)).sort()

  // SHAPE, not membership (D-B-05): the unclaimed set is F's post-processor surface and moves.
  // What must never appear in it is an EMITTER-SHAPED path.
  const emitterShaped = unclaimed.filter((p) => p.endsWith(".html") && !p.startsWith("dev/"))

  const head = gitHead()
  const per = {}
  for (const [emitter, paths] of Object.entries(claims)) {
    const files = {}
    for (const rel of paths.slice().sort()) if (census[rel]) files[rel] = census[rel]
    per[emitter] = files
  }
  fs.mkdirSync(outDir, { recursive: true })
  for (const [emitter, files] of Object.entries(per)) {
    const data = { emitter, files, returned_paths: [] }
    const record = {
      schema: SCHEMA, seam: SEAM, key: emitter, data,
      data_sha256: crypto.createHash("sha256").update(canonical(data), "utf8").digest("hex"),
      coverage: (() => {
        const seededPrefixes = (emitter === "Static" ? opts.seeded : []).map(
          (r2) => r2.path.replace(/\/$/, "") + "/",
        )
        const seeded = Object.keys(files).filter((p) => seededPrefixes.some((pre) => p.startsWith(pre))).length
        return {
          files: Object.keys(files).length, returned_paths: 0,
          seeded_files: seeded, parity_files: Object.keys(files).length - seeded, emitter_runs: 1,
        }
      })(),
      provenance: {
        git_head: head,
        producer: `scripts/emit_seam_capture.mjs --join (stream B, D-B-05) -> ${emitter}`,
        execution:
          "ONE build through the real emitContent; ATTRIBUTION from the in-build AsyncLocalStorage " +
          "ledger, INVENTORY from a census taken after all raw emitters settled and BEFORE any " +
          "post-processor ran",
          inventory:
          "in-build ledger (attribution) joined by path with a post-emit filesystem walk (size+sha256)",
        // Required by seam_golden as an EXPLICIT list — an absent field is rejected rather than
        // read as empty, which is the right call: "no seeded regions" and "nobody said" must not
        // look the same. Found by running V's verifier against a joined record in preflight.
        seeded_regions: emitter === "Static" ? opts.seeded : [],
        input_seeded_regions: opts.seeded,
        corpus: { ...captured.discovered, partial: opts.limit > 0 },
      },
    }
    fs.writeFileSync(path.join(outDir, `${emitter}.json`), JSON.stringify(record, null, 1), "utf8")
  }
  return { per, conflicts, claimMissing, unclaimed, emitterShaped, censusSize: Object.keys(census).length }
}


/** `--join`: one build into one output dir, ledger on, census before any post-processor. */
function runJoin(val, has) {
  const outDir = val("--out")
  if (!outDir) { console.error("emit_seam_capture --join: --out DIR is required"); return 2 }
  const limit = Number(val("--limit", "0"))
  if (!limit && !has("--full")) {
    console.error("emit_seam_capture --join: pass --limit N, or --full under the build mutex.")
    return 2
  }
  const concurrency = Number(val("--concurrency", "1"))
  const work = path.resolve(val("--work", trackTemp(fs.mkdtempSync(path.join(os.tmpdir(), "bjj-join-")))))
  const output = path.join(work, "public")
  const ledgerDir = path.join(work, "ledger")
  fs.mkdirSync(output, { recursive: true })

  const contentDir = path.relative(SOURCE_DIR, path.join(REPO_ROOT, "content")) || "../content"
  const directory = contentDir.startsWith(".") ? contentDir : "./" + contentDir

  const bundle = bundleQuartzEntry(JOIN_ENTRY)
  const stdout = execFileSync(process.execPath, ["--max-old-space-size=6144", bundle], {
    cwd: SOURCE_DIR,
    env: {
      ...process.env,
      BJJ_EMIT_LEDGER_DIR: ledgerDir,
      BJJ_EMIT_CAPTURE_ARGS: JSON.stringify({ directory, limit, output, concurrency }),
    },
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    maxBuffer: 2048 * 1024 * 1024,
    timeout: 3_600_000,
  })
  const line = stdout.split("\n").find((l) => l.startsWith("__JSON__"))
  if (!line) { console.error("emit_seam_capture --join: no __JSON__ line — no verdict"); return 2 }
  const captured = JSON.parse(line.slice("__JSON__".length))
  if (!captured.ledgerEnabled) {
    console.error("emit_seam_capture --join: the ledger did not activate — no attribution, no verdict")
    return 2
  }

  const r = joinRecords(captured, outDir, { limit, seeded: seededRegions(captured.census ?? {}) })
  console.log(`\njoined ${Object.keys(r.per).length} emitter record(s) -> ${outDir}`)
  for (const [emitter, files] of Object.entries(r.per).sort()) {
    console.log(`  ${emitter.padEnd(20)} ${String(Object.keys(files).length).padStart(6)} files`)
  }
  console.log(`  census: ${r.censusSize} files after all raw emitters, before any post-processor`)
  // Three disagreements, NAMED AND COUNTED SEPARATELY — they have three different causes.
  console.log(`  claim-with-no-file : ${r.claimMissing.length} ${r.claimMissing.slice(0, 3).join(", ")}`)
  console.log(`  file-with-no-claim : ${r.unclaimed.length} ${r.unclaimed.slice(0, 3).join(", ")}`)
  console.log(`  claimed-twice      : ${r.conflicts.length} ${r.conflicts.slice(0, 3).map((c) => c.path).join(", ")}`)
  console.log(`  EMITTER-SHAPED yet unclaimed: ${r.emitterShaped.length} ${r.emitterShaped.slice(0, 3).join(", ")}`)

  let rc = 0
  if (r.claimMissing.length) { console.error("  FAIL: a claim with no file — the ledger recorded intent, not result"); rc = 1 }
  if (r.conflicts.length) { console.error("  FAIL: a path claimed by two emitters — attribution is not a partition"); rc = 1 }
  if (r.emitterShaped.length) { console.error("  FAIL: an emitter-shaped path nobody claimed"); rc = 1 }
  if (!Object.keys(r.per).length) { console.error("  NO VERDICT: nothing attributed"); return 2 }
  return rc
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function canonical(data) {
  const sortDeep = (v) => {
    if (Array.isArray(v)) return v.map(sortDeep)
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sortDeep(v[k])]),
      )
    }
    return v
  }
  return JSON.stringify(sortDeep(data))
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim()
}

// The seed manifest deliberately does NOT live inside `source/quartz/static/`. Anything under
// that directory is copied verbatim into the site by `fs.cp`, so a marker file there would ship a
// file production does not have and would show up as a spurious diff in every parity run. It goes
// in the gitignored build scratch instead.
const SEED_MANIFEST = path.join(SOURCE_DIR, "quartz", ".quartz-cache", "b-seed-manifest.json")
const STATIC_NEURAL = path.join(SOURCE_DIR, "quartz", "static", "neural")

function walkHashLocal(root) {
  const out = {}
  if (!fs.existsSync(root)) return out
  const rec = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name)
      if (ent.isDirectory()) rec(fp)
      else {
        const buf = fs.readFileSync(fp)
        out[path.relative(root, fp).split(path.sep).join("/")] = {
          size: buf.length,
          sha256: crypto.createHash("sha256").update(buf).digest("hex"),
        }
      }
    }
  }
  rec(root)
  return out
}

/**
 * Seed the gitignored neural payload from a golden tree, read-only, and record what was seeded.
 * D-19: the region's generated-content parity is NOT asserted (golden output seeded as input is
 * equal by construction), but its bytes ARE inventoried and hashed, which is what catches an
 * incomplete or corrupt copy.
 */
function seedStatic(goldenStaticNeural) {
  if (!fs.existsSync(goldenStaticNeural)) {
    console.error(`emit_seam_capture: --seed-static source not found: ${goldenStaticNeural}`)
    return 2
  }
  if (fs.existsSync(STATIC_NEURAL)) {
    console.error(
      `emit_seam_capture: ${STATIC_NEURAL} already exists. Refusing to overwrite a payload this ` +
        `script did not put there — remove it deliberately first.`,
    )
    return 2
  }
  fs.mkdirSync(path.dirname(STATIC_NEURAL), { recursive: true })
  fs.cpSync(goldenStaticNeural, STATIC_NEURAL, { recursive: true, dereference: true })

  const seededFiles = walkHashLocal(STATIC_NEURAL)
  const sourceFiles = walkHashLocal(goldenStaticNeural)
  const names = Object.keys(seededFiles).sort()
  const srcNames = Object.keys(sourceFiles).sort()

  // The copy is verified here, not assumed: same names, same sizes, same hashes. A seeded region
  // whose parity is unasserted still has to be a COMPLETE copy, or every later record is wrong in
  // a way nothing downstream can see.
  const mismatched = names.filter(
    (n) => !sourceFiles[n] || sourceFiles[n].sha256 !== seededFiles[n].sha256,
  )
  if (names.length === 0 || names.length !== srcNames.length || mismatched.length) {
    console.error(
      `emit_seam_capture: seed verification FAILED — ${names.length} copied vs ${srcNames.length} ` +
        `at source, ${mismatched.length} hash mismatches`,
    )
    return 2
  }

  const digest = crypto
    .createHash("sha256")
    .update(names.map((n) => `${n} ${seededFiles[n].size} ${seededFiles[n].sha256}`).join("\n"))
    .digest("hex")
  fs.mkdirSync(path.dirname(SEED_MANIFEST), { recursive: true })
  fs.writeFileSync(
    SEED_MANIFEST,
    JSON.stringify(
      {
        region: "static/neural/",
        seeded_from: goldenStaticNeural,
        files: names.length,
        manifest_sha256: digest,
        note:
          "Seeded read-only from the golden under D-19 because source/quartz/static/neural/ is " +
          "gitignored (.gitignore:87) and generated by regenerate:neural. Bytes are inventoried " +
          "and hashed in every emit record; their generated-content parity is NOT asserted.",
      },
      null,
      1,
    ),
    "utf8",
  )
  console.log(
    `emit_seam_capture: seeded ${names.length} files into ${STATIC_NEURAL}\n` +
      `  manifest ${SEED_MANIFEST}\n  digest ${digest}`,
  )
  return 0
}

// Every input an emit-seam record's bytes depend on. Maintained HERE, beside the producer, so it
// cannot drift from what the capture actually reads — a list of paths kept in a report drifts the
// first time an emitter gains an import.
const RECORD_INPUTS = [
  "source/quartz/plugins/emitters",
  "source/quartz/plugins/transformers",
  "source/quartz/components",
  "source/quartz/util",
  "source/quartz/i18n",
  "source/quartz/processors",
  "source/quartz.config.ts",
  "source/quartz.layout.ts",
  "content",
  "graph.json",
]

/**
 * Is an existing record set still valid against HEAD?
 *
 * THE POINT, and it is not the obvious check (quartz-cto D-95, from A). The tempting version is
 * "did the last integration touch my inputs" — and a SEQUENCE of integrations can each touch
 * nothing while the cumulative tree has drifted, because a per-merge window only sees forward
 * from a point already downstream of the damage. So this diffs from THE COMMIT THE RECORD WAS
 * CAPTURED AT, which the record itself carries, to HEAD.
 *
 * It exists as a command rather than a note because a provenance claim that depends on being
 * told is not a provenance claim. Run it; do not remember it.
 *
 * Exit 0 = inputs unchanged, records still describe HEAD. 1 = inputs changed, records are stale
 * (which under GOLDEN-RECAPTURE rule 3 is EXPECTED until the batched re-capture, not a
 * regression). 2 = no verdict.
 */
function checkProvenance(dir) {
  const files = [
    ...fs.readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".json.gz")),
  ]
  if (!files.length) {
    console.error(`NO VERDICT: no records in ${dir}`)
    return 2
  }
  const heads = new Map()
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f))
    const rec = JSON.parse((f.endsWith(".gz") ? zlib.gunzipSync(raw) : raw).toString("utf8"))
    const head = rec.provenance?.git_head
    if (!head) {
      console.error(`NO VERDICT: ${f} carries no provenance.git_head`)
      return 2
    }
    heads.set(head, (heads.get(head) ?? 0) + 1)
  }
  const now = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim()
  let stale = 0
  for (const [head, count] of heads) {
    let stat
    try {
      stat = execFileSync("git", ["diff", "--stat", `${head}..${now}`, "--", ...RECORD_INPUTS], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }).trim()
    } catch {
      console.error(`NO VERDICT: cannot diff ${head}..${now} — is the capture commit still present?`)
      return 2
    }
    console.log(`\n${count} record(s) captured at ${head.slice(0, 9)}; HEAD is ${now.slice(0, 9)}`)
    if (!stat) {
      console.log("  inputs UNCHANGED — these records still describe HEAD")
      continue
    }
    stale++
    console.log(stat.split("\n").map((l) => "  " + l).join("\n"))
    console.log(
      "  inputs CHANGED — these records are STALE. Under GOLDEN-RECAPTURE rule 3 that delta is\n" +
        "  EXPECTED until the batched re-capture, so a red you can attribute to it is not a\n" +
        "  finding. Cite the capture commit above in any report that uses them.",
    )
  }
  console.log(`\nchecked ${heads.size} capture commit(s) over ${RECORD_INPUTS.length} input paths`)
  return stale ? 1 : 0
}

function seededRegions(staticSourceFiles) {
  if (!fs.existsSync(SEED_MANIFEST)) return []
  const m = JSON.parse(fs.readFileSync(SEED_MANIFEST, "utf8"))
  const present = Object.keys(staticSourceFiles).filter((p) => p.startsWith("neural/")).length
  if (present !== m.files) {
    // The manifest and the tree disagree: say so loudly rather than declaring a region that is
    // not the region that was seeded.
    console.error(
      `emit_seam_capture: seed manifest says ${m.files} files under static/neural/ but the tree ` +
        `has ${present}. The declaration would be wrong; fix the tree or delete the manifest.`,
    )
    process.exitCode = 2
  }
  return [
    {
      // Output-relative, because each record scopes this against its own data.files paths.
      path: "static/neural/",
      reason: m.note,
      evidence: `${m.seeded_from} · manifest_sha256 ${m.manifest_sha256} · ${SEED_MANIFEST}`,
      files: present,
    },
  ]
}

function applyMutant(data, mutant) {
  const keys = Object.keys(data.files).sort()
  if (!keys.length) throw new Error("cannot mutate an empty file set")
  if (mutant === "omit-file") {
    const victim = keys[Math.floor(keys.length / 2)]
    delete data.files[victim]
    return `omitted ${victim}`
  }
  if (mutant === "flip-byte") {
    const victim = keys[Math.floor(keys.length / 2)]
    const h = data.files[victim].sha256
    data.files[victim] = {
      ...data.files[victim],
      sha256: (h[0] === "0" ? "1" : "0") + h.slice(1),
    }
    return `flipped the leading hex digit of ${victim}'s sha256`
  }
  throw new Error(`unknown mutant ${mutant}; expected omit-file or flip-byte`)
}

function main() {
  const argv = process.argv.slice(2)
  const val = (name, dflt) => {
    const i = argv.indexOf(name)
    return i < 0 ? dflt : argv[i + 1]
  }
  const many = (name) => argv.flatMap((v, i) => (v === name ? [argv[i + 1]] : []))
  const has = (name) => argv.includes(name)

  if (has("--help")) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0])
    return 0
  }

  const seedFrom = val("--seed-static")
  if (seedFrom) return seedStatic(path.resolve(seedFrom))

  const provenanceDir = val("--check-provenance")
  if (provenanceDir) return checkProvenance(path.resolve(provenanceDir))

  if (has("--join")) return runJoin(val, has)

  const outDir = val("--out")
  if (!outDir) {
    console.error("emit_seam_capture: --out DIR is required")
    return 2
  }
  const limit = Number(val("--limit", "0"))
  const concurrency = Number(val("--concurrency", "1"))

  // A full-corpus capture renders 4,600 pages and is mutex-scale (~25 min of the whole box). The
  // dangerous default is that OMITTING --limit means "do the expensive thing", so it has to be
  // asked for explicitly. Written after doing exactly that twice by accident while another seat
  // held the build mutex: the job started both times and nothing in the tool objected.
  if (!limit && !has("--full")) {
    console.error(
      "emit_seam_capture: a full-corpus capture renders 4,600 pages and takes ~25 minutes of the " +
        "whole box. Pass --full to mean it, and take the build mutex first:\n" +
        "  source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh <agent> 'emit capture'\n" +
        "Otherwise pass --limit N for a partial capture (records are marked partial and are not " +
        "comparable to a full golden).",
    )
    return 2
  }
  const emitters = many("--emitter")
  const mutant = val("--mutant")
  const plain = has("--plain")
  const workRoot = path.resolve(
    val("--work", trackTemp(fs.mkdtempSync(path.join(os.tmpdir(), "bjj-emit-seam-")))),
  )

  // A full capture writes every emitter's output into its own root: ~370 MB of ContentPage HTML,
  // ~85 MB of FolderPage, ~46 MB of Static's copy. os.tmpdir() honours TMPDIR, and on this host
  // the DEFAULT /tmp is the 25 GB ROOT volume at 77% full, not the 98 GB /home one the repo sits
  // on (CLAUDE.md §6.4). A full root does not fail loudly — it fails as a truncated write partway
  // through, and those missing files would read as an emitter defect. So check first, and refuse.
  // Verified by raising NEEDED_MB above any real free space: the branch fires and exits 2.
  const NEEDED_MB = limit > 0 ? 64 : 2048
  try {
    // The directory must exist before df can report on it. Without this, a --work path that has
    // not been created yet makes df fail, the catch fires, and the guard prints "free space
    // unknown" and proceeds — which is what happened on the first full capture: the check written
    // to protect that exact run did not run. It failed HONESTLY (it says unknown rather than OK),
    // but a guard that skips itself on the one path that needs it is not a guard.
    fs.mkdirSync(workRoot, { recursive: true })
    const df = execFileSync("df", ["-Pm", workRoot], { encoding: "utf8" }).trim().split("\n")
    const freeMb = Number(df[df.length - 1].split(/\s+/)[3])
    if (Number.isFinite(freeMb)) {
      if (freeMb < NEEDED_MB) {
        console.error(
          `emit_seam_capture: only ${freeMb} MB free on the volume holding ${workRoot}, and a ` +
            `${limit > 0 ? "limited" : "full-corpus"} capture needs about ${NEEDED_MB} MB. ` +
            `Set TMPDIR to a directory on the roomy volume (e.g. TMPDIR=/home/user/tmp-pw) or ` +
            `pass --work. Refusing: a capture that runs out of disk halfway produces a record ` +
            `whose missing files look like an emitter defect.`,
        )
        return 2
      }
      console.log(`emit_seam_capture: work dir ${workRoot} (${freeMb} MB free, need ~${NEEDED_MB})`)
    }
  } catch {
    console.log(`emit_seam_capture: work dir ${workRoot} (free space unknown — df unavailable)`)
  }
  if (has("--keep")) process.env.BJJ_KEEP_PROBE_TEMP = "1"

  const contentDir = path.relative(SOURCE_DIR, path.join(REPO_ROOT, "content")) || "../content"
  const directory = contentDir.startsWith(".") ? contentDir : "./" + contentDir

  console.log(`emit_seam_capture: bundling the real Quartz module graph …`)
  const bundle = bundleQuartzEntry(CAPTURE_ENTRY)

  console.log(
    `emit_seam_capture: running ${emitters.length ? emitters.join(", ") : "every configured emitter"}` +
      `${limit ? ` over the first ${limit} markdown files` : " over the whole corpus"} …`,
  )
  const started = Date.now()
  const stdout = execFileSync(process.execPath, ["--max-old-space-size=6144", bundle], {
    cwd: SOURCE_DIR,
    env: {
      ...process.env,
      BJJ_EMIT_CAPTURE_ARGS: JSON.stringify({ directory, limit, emitters, workRoot, concurrency }),
    },
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    maxBuffer: 2048 * 1024 * 1024,
    timeout: 3_600_000,
  })
  const wall = Date.now() - started

  const line = stdout.split("\n").find((l) => l.startsWith("__JSON__"))
  if (!line) {
    console.error("emit_seam_capture: the capture produced no __JSON__ line — no verdict")
    console.error(stdout.slice(0, 4000))
    return 2
  }
  const captured = JSON.parse(line.slice("__JSON__".length))

  if (has("--list")) {
    for (const r of captured.results) {
      console.log(
        `${r.emitter.padEnd(20)} files=${String(Object.keys(r.files).length).padStart(6)} ` +
          `returned=${String(r.returned_raw_count).padStart(6)} ${r.ms}ms${r.error ? "  ERROR" : ""}`,
      )
    }
  }

  fs.mkdirSync(outDir, { recursive: true })
  const head = gitHead()
  // The GLOBAL input seeding (what was seeded into source/quartz/static). Each record then scopes
  // it to the paths that actually appear in that record's own output.
  const inputSeeded = seededRegions(captured.copy_source_files)

  let failures = 0
  const summary = []

  // Emptiness that is a MEASURED PROPERTY OF THIS CORPUS rather than a failed capture. Assets
  // copies every non-markdown file under content/ and the corpus has none that survive the
  // ignorePatterns: 1,807 non-.md files, of which 1,679 are .json killed by
  // `**/!(bjj-graph).json` and 128 are dot-paths held out by globby's dot:false. Any OTHER
  // emitter returning zero is a failed capture, not an observation.
  const EXPECTED_EMPTY = {
    Assets:
      "Measured property of this corpus, not a failed capture: Assets copies non-markdown files " +
      "from content/ and every candidate is excluded — the .json files by the " +
      '"**/!(bjj-graph).json" ignorePattern and the dot-paths by globby\'s dot:false default. ' +
      "The emitter ran to completion and wrote nothing. This observation does NOT prove the " +
      "emitter's file-producing branch still works; that branch has no corpus witness and is " +
      "covered by the positive-floor fixture in tests/emitter_filesystem.test.mjs (D-51).",
  }

  for (const r of captured.results) {
    if (r.error) {
      console.error(`emit_seam_capture: emitter ${r.emitter} THREW — ${r.error.message}`)
      failures++
      continue
    }
    const data = { emitter: r.emitter, files: r.files, returned_paths: r.returned_paths }
    if (r.emitter === "Static") data.copy_source_files = captured.copy_source_files

    let mutantNote = null
    if (mutant) mutantNote = applyMutant(data, mutant)

    const fileCount = Object.keys(data.files).length

    // seeded_regions is PER OUTPUT RECORD: each entry's count is the paths of that region present
    // in THIS record's data.files, not the global input seeding. Only Static copies the neural
    // payload into an output, so every other record carries an empty list. The global input
    // provenance is retained separately as input_seeded_regions.
    const recordSeeded = inputSeeded
      .map((region) => {
        const prefix = region.path.replace(/\/$/, "") + "/"
        const files = Object.keys(data.files).filter((p) => p.startsWith(prefix)).length
        return { ...region, files }
      })
      .filter((region) => region.files > 0)
    const seededFiles = recordSeeded.reduce((n, region) => n + region.files, 0)

    if (fileCount === 0 && !(r.emitter in EXPECTED_EMPTY)) {
      console.error(
        `emit_seam_capture: ${r.emitter} produced ZERO files and is not a known-empty emitter. ` +
          `That is a failed capture, not an observation — refusing to write a record that would ` +
          `read like coverage.`,
      )
      failures++
      continue
    }
    if (fileCount === 0 && captured.discovered.all <= 0) {
      console.error(
        `emit_seam_capture: ${r.emitter} produced zero files AND discovery found nothing. ` +
          `An empty result is only an observation when there is proof that work happened.`,
      )
      failures++
      continue
    }

    const record = {
      schema: SCHEMA,
      seam: SEAM,
      key: r.emitter,
      data,
      data_sha256: crypto.createHash("sha256").update(canonical(data), "utf8").digest("hex"),
      coverage: {
        files: fileCount,
        returned_paths: data.returned_paths.length,
        seeded_files: seededFiles,
        parity_files: fileCount - seededFiles,
        // Counted after this emitter's emit() resolved. A completed empty observation carries
        // emitter_runs: 1; a capture that never ran carries no record at all.
        emitter_runs: r.emitter_runs,
      },
      provenance: {
        git_head: head,
        producer: `scripts/emit_seam_capture.mjs (stream B, D-26) -> ${r.emitter}.emit`,
        execution:
          "real cfg.plugins.emitters instance, invoked in-process from a bundle built with " +
          "Quartz's own esbuild config (cli/handlers.js handleBuild); parse ran at concurrency " +
          `${captured.parse_concurrency_actual} on the ${captured.parse_path} path; each emitter ` +
          "writes to its own output root and runs one at a time so attribution is by actual " +
          "execution, not path shape",
        inventory: "filesystem walk + read + sha256 after this emitter's emit() promise resolved",
        output_root: r.output_root,
        seeded_regions: recordSeeded,
        input_seeded_regions: inputSeeded,
        corpus: {
          discovered_all: captured.discovered.all,
          discovered_md: captured.discovered.md,
          parsed: captured.discovered.parsed,
          published: captured.discovered.published,
          partial: limit > 0,
          parse_concurrency: captured.parse_concurrency_actual,
        },
        ...(r.emitter === "Static" ? { copy_source_root: captured.copy_source_root } : {}),
        ...(fileCount === 0
          ? {
              empty_output: {
                reason: EXPECTED_EMPTY[r.emitter],
                evidence:
                  `emitter_runs=1 after emit() resolved; discovery found ` +
                  `${captured.discovered.all} input files and ${captured.discovered.published} ` +
                  `published pages in the same run, so the pipeline did work and this emitter ` +
                  `chose to write nothing. Recompute: node scripts/emit_seam_capture.mjs ` +
                  `--out DIR --emitter ${r.emitter} --limit 8 --plain --list`,
              },
            }
          : {}),
        ...(mutantNote ? { mutant: `${mutant}: ${mutantNote}` } : {}),
      },
    }

    const base = path.join(outDir, `${r.emitter}.json`)
    if (plain) fs.writeFileSync(base, JSON.stringify(record, null, 1), "utf8")
    else fs.writeFileSync(base + ".gz", zlib.gzipSync(Buffer.from(JSON.stringify(record), "utf8")))
    summary.push(
      `${r.emitter.padEnd(20)} files=${String(fileCount).padStart(6)} ` +
        `returned=${String(data.returned_paths.length).padStart(6)} ` +
        `seeded=${String(seededFiles).padStart(6)} parity=${String(fileCount - seededFiles).padStart(6)}` +
        `${fileCount === 0 ? "  [completed-empty, attested]" : ""}`,
    )
  }

  console.log(`\nemit_seam_capture: wrote ${summary.length} record(s) to ${outDir}`)
  for (const s of summary) console.log("  " + s)
  console.log(
    `  corpus: ${captured.discovered.md} markdown discovered, ${captured.discovered.parsed} parsed, ` +
      `${captured.discovered.published} published${limit ? "  [PARTIAL — not comparable to a full golden]" : ""}`,
  )
  console.log(`  parse ${(captured.parse_ms / 1000).toFixed(1)}s, total ${(wall / 1000).toFixed(1)}s`)
  if (mutant) console.log(`  MUTANT APPLIED: ${mutant} — these records are candidates, not goldens`)

  if (failures) {
    console.error(`emit_seam_capture: ${failures} emitter(s) produced no trustworthy record`)
    return 2
  }
  if (!summary.length) {
    console.error("emit_seam_capture: no records written — no verdict")
    return 2
  }
  return 0
}

// `process.argv[1]` is UNDEFINED under `node -e`, in a REPL, and in some loaders, and
// `pathToFileURL(undefined)` throws — so the unguarded main-module idiom makes this module
// unimportable from those contexts. Found by importing tests/_emitter_probe.mjs (which imports
// this file) from a `node -e` one-liner: it crashed here, nowhere near the caller's code.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
